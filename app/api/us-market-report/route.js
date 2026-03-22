import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════════
// FRED API — 완전 무료, rate limit 120req/분
// ═══════════════════════════════════════════════════════════════
const FRED_SERIES = {
  sp500:   { id: 'SP500',            label: 'S&P 500' },
  nasdaq:  { id: 'NASDAQCOM',        label: 'Nasdaq' },
  djia:    { id: 'DJIA',             label: 'DJIA' },
  wti:     { id: 'DCOILWTICO',       label: 'WTI Crude' },
  gold:    { id: 'GOLDAMGBD228NLBM', label: 'Gold' },
  dgs10:   { id: 'DGS10',            label: '10Y Treasury' },
  dgs2:    { id: 'DGS2',             label: '2Y Treasury' },
  vix:     { id: 'VIXCLS',           label: 'VIX' },
  hy_oas:  { id: 'BAMLH0A0HYM2',    label: 'HY OAS' },
  bei5y:   { id: 'T5YIE',            label: '5Y BEI' },
  dxy:     { id: 'DTWEXBGS',         label: 'Dollar Index' },
};

const RATE_KEYS = ['dgs10', 'dgs2', 'bei5y']; // 절대변화(pp)
const BP_KEYS = ['hy_oas']; // 절대변화(bp)

async function fetchFredSeries(seriesId, apiKey) {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=15`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.observations || [])
      .filter(o => o.value && o.value !== '.')
      .map(o => ({ date: o.date, value: parseFloat(o.value) }));
  } catch { return []; }
}

async function fetchAllFred(apiKey, weekEnd) {
  const endDate = new Date(weekEnd);
  const weekAgoDate = new Date(endDate);
  weekAgoDate.setDate(weekAgoDate.getDate() - 7);
  const results = {};

  const entries = Object.entries(FRED_SERIES);
  const fetched = await Promise.all(
    entries.map(([, s]) => fetchFredSeries(s.id, apiKey))
  );

  entries.forEach(([key, s], i) => {
    const obs = fetched[i];
    if (obs.length === 0) {
      results[key] = { label: s.label, current: null, change: null };
      return;
    }
    const current = obs.find(o => new Date(o.date) <= endDate);
    const weekAgo = obs.find(o => new Date(o.date) <= weekAgoDate);
    const curVal = current?.value || null;
    const prevVal = weekAgo?.value || null;
    let change = null;
    if (curVal != null && prevVal != null && prevVal !== 0) {
      if (RATE_KEYS.includes(key) || BP_KEYS.includes(key)) {
        change = Math.round((curVal - prevVal) * 100) / 100;
      } else {
        change = Math.round(((curVal - prevVal) / prevVal) * 10000) / 100;
      }
    }
    results[key] = { label: s.label, current: curVal, currentDate: current?.date, change };
  });
  return results;
}

// ═══════════════════════════════════════════════════════════════
function extractJSON(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') {
      let depth = 0, inStr = false, esc = false;
      for (let j = i; j < cleaned.length; j++) {
        const ch = cleaned[j];
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === '{') depth++;
        if (ch === '}') { depth--; if (depth === 0) { try { return JSON.parse(cleaned.slice(i, j + 1)); } catch {} break; } }
      }
      break;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
export async function POST(request) {
  try {
    const adminPin = process.env.ADMIN_PIN;
    const userPin = request.headers.get('x-admin-pin');
    if (!adminPin || userPin !== adminPin) {
      return NextResponse.json({ error: '관리자 인증 필요' }, { status: 401 });
    }

    const { weekEnd, userContext } = await request.json();
    if (!weekEnd) {
      return NextResponse.json({ error: 'weekEnd 필요' }, { status: 400 });
    }

    const fredKey = process.env.FRED_API_KEY;
    if (!fredKey) {
      return NextResponse.json({ error: 'FRED_API_KEY 환경변수 필요. fred.stlouisfed.org에서 무료 발급.' }, { status: 500 });
    }

    // ─── 1단계: FRED 무료 수집 ───
    const fredData = await fetchAllFred(fredKey, weekEnd);

    const endDate = new Date(weekEnd);
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 4);
    const ws = startDate.toISOString().split('T')[0];
    const we = endDate.toISOString().split('T')[0];

    // FRED 요약 → AI 프롬프트용 (토큰 최소화)
    const fredLines = Object.entries(fredData)
      .filter(([, v]) => v.current != null)
      .map(([k, v]) => {
        const suffix = RATE_KEYS.includes(k) ? 'pp' : BP_KEYS.includes(k) ? 'bp' : '%';
        const chg = v.change != null ? `(${v.change >= 0 ? '+' : ''}${v.change}${suffix})` : '';
        return `${v.label}:${v.current}${chg}`;
      }).join(', ');

    const ctx = userContext ? ` 맥락:${userContext}` : '';

    // ─── 2단계: AI — 52주 신고가 + 내러티브만 (최소 토큰) ───
    // web_search 1회당 ~50K 토큰 추가됨 → 3회로 제한 (총 ~150K 이내)
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{
        role: 'user',
        content: `${ws}~${we} 미국 주간시장. FRED: ${fredLines}.${ctx}
웹검색: "52 week high stocks ${we}" 검색 1회로 신고가 종목 수집. 간결 JSON만(백틱없이):
{"narrative":{"summary":"시장요약2문장","keyNarrative":"핵심1줄","events":[{"event":"명","impact":"1문장"}],"sectorSummary":"섹터강약1문장"},"themes":[{"name":"테마","description":"1문장","stocks":[{"ticker":"XX","name":"이름","marketCap":"1T","yoyReturn":10,"weekReturn":2,"catalyst":"1문장"}]}],"deepDives":[{"ticker":"XX","name":"이름","theme":"테마","whyNow":"1문장","earnings":"1문장","structuralTheme":"1문장","risk":"1문장"}],"implications":{"bondMacro":"채권1문장","equity":"주식1문장","nextWeekEvents":["ev1","ev2"]},"breadth":{"sp500NewHighs":0,"sp500NewLows":0,"nasdaqNewHighs":0,"nasdaqNewLows":0}}
themes 2~3개(각2~4종목),deepDives 3개,breadth 확인불가시0.모든텍스트1문장이내.`
      }],
    });

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const ai = extractJSON(text);
    if (!ai) {
      return NextResponse.json({ error: 'AI JSON 파싱 실패', rawPreview: text.slice(0, 300) }, { status: 500 });
    }

    // ─── 3단계: FRED 수치 + AI 내러티브 병합 ───
    const indices = [
      { name: 'S&P 500', level: String(fredData.sp500?.current || '?'), changePercent: fredData.sp500?.change || 0 },
      { name: 'Nasdaq', level: String(fredData.nasdaq?.current || '?'), changePercent: fredData.nasdaq?.change || 0 },
      { name: 'DJIA', level: String(fredData.djia?.current || '?'), changePercent: fredData.djia?.change || 0 },
    ];
    const assets = [
      { name: 'Gold', level: String(fredData.gold?.current || '?'), changePercent: fredData.gold?.change || 0 },
      { name: 'WTI', level: fredData.wti?.current ? `$${fredData.wti.current}` : '?', changePercent: fredData.wti?.change || 0 },
      { name: 'Dollar', level: String(fredData.dxy?.current || '?'), changePercent: fredData.dxy?.change || 0 },
      { name: '10Y', level: fredData.dgs10?.current ? `${fredData.dgs10.current}%` : '?', changePercent: fredData.dgs10?.change || 0 },
      { name: '2Y', level: fredData.dgs2?.current ? `${fredData.dgs2.current}%` : '?', changePercent: fredData.dgs2?.change || 0 },
      { name: 'VIX', level: String(fredData.vix?.current || '?'), changePercent: fredData.vix?.change || 0 },
      { name: 'HY OAS', level: fredData.hy_oas?.current ? `${fredData.hy_oas.current}bp` : '?', changePercent: fredData.hy_oas?.change || 0 },
      { name: '5Y BEI', level: fredData.bei5y?.current ? `${fredData.bei5y.current}%` : '?', changePercent: fredData.bei5y?.change || 0 },
    ];

    const report = {
      weekRange: `${ws} ~ ${we}`,
      narrative: { ...(ai.narrative || {}), indices, assets },
      themes: ai.themes || [],
      deepDives: ai.deepDives || [],
      implications: ai.implications || {},
      breadth: ai.breadth || {},
      fredData,
    };

    return NextResponse.json({ success: true, report, weekStart: ws, weekEnd: we });
  } catch (error) {
    console.error('US Market Report error:', error);
    const msg = error?.error?.message || error?.message || String(error);
    return NextResponse.json({ error: `리포트 오류: ${msg}` }, { status: 500 });
  }
}
