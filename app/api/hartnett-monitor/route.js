import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// ─── FRED 시리즈 매핑 ───
const FRED_SERIES = {
  sp500: 'SP500',
  wti: 'DCOILWTICO',
  ust30y: 'DGS30',
  ust10y: 'DGS10',
  hy_oas: 'BAMLH0A0HYM2',
  vix: 'VIXCLS',
  bei_5y: 'T5YIE',
  ust2y: 'DGS2',
};

// FRED API에서 최신값 가져오기
async function fetchFredSeries(seriesId, apiKey) {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=5`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const obs = data.observations?.find(o => o.value && o.value !== '.');
    if (!obs) return null;
    return { value: parseFloat(obs.value), date: obs.date };
  } catch (err) {
    console.error(`FRED fetch error for ${seriesId}:`, err.message);
    return null;
  }
}

// 모든 FRED 데이터 병렬 수집
async function fetchAllFredData(apiKey) {
  const results = {};
  const entries = Object.entries(FRED_SERIES);
  const promises = entries.map(async ([key, seriesId]) => {
    const data = await fetchFredSeries(seriesId, apiKey);
    return [key, data];
  });
  const settled = await Promise.all(promises);
  for (const [key, data] of settled) {
    results[key] = data;
  }
  return results;
}

// ─── POST: AI 분석 실행 ───
export async function POST(request) {
  try {
    const pin = request.headers.get('x-admin-pin');
    if (pin !== process.env.ADMIN_PIN) {
      return NextResponse.json({ error: '관리자 인증 실패' }, { status: 401 });
    }

    const body = await request.json();
    const { manualOverrides } = body || {};

    // 1) FRED에서 자동 수집
    const fredKey = process.env.FRED_API_KEY;
    if (!fredKey) {
      return NextResponse.json({ error: 'FRED_API_KEY 환경변수가 설정되지 않았습니다' }, { status: 500 });
    }

    const fredData = await fetchAllFredData(fredKey);

    // 2) 수동 입력값으로 덮어쓰기 (DXY 등 FRED에 없는 것)
    const inputLevels = {
      sp500: manualOverrides?.sp500 || fredData.sp500?.value || null,
      wti: manualOverrides?.wti || fredData.wti?.value || null,
      dxy: manualOverrides?.dxy || null,
      ust30y: manualOverrides?.ust30y || fredData.ust30y?.value || null,
      ust10y: fredData.ust10y?.value || null,
      ust2y: fredData.ust2y?.value || null,
      hy_oas: manualOverrides?.hy_oas || fredData.hy_oas?.value || null,
      vix: fredData.vix?.value || null,
      bei_5y: fredData.bei_5y?.value || null,
      brent: manualOverrides?.brent || null,
      loan_price: manualOverrides?.loan_price || null,
    };

    const dataAsOf = {};
    for (const [key, val] of Object.entries(fredData)) {
      if (val?.date) dataAsOf[key] = val.date;
    }

    // 필수값 체크
    if (!inputLevels.sp500 || !inputLevels.wti || !inputLevels.ust30y) {
      const missing = [];
      if (!inputLevels.sp500) missing.push('S&P500');
      if (!inputLevels.wti) missing.push('WTI');
      if (!inputLevels.ust30y) missing.push('30Y금리');
      return NextResponse.json({
        error: `FRED에서 데이터를 가져오지 못했습니다: ${missing.join(', ')}. 수동 입력해주세요.`,
        fredData, inputLevels,
      }, { status: 400 });
    }

    // 3) AI 분석
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `당신은 마이클 하트넷의 2008 금융위기 유사성 프레임워크 기반 시장 상태 평가 분석가입니다.
트리거 기준: S&P500<6600, WTI>100, DXY>100, 30Y UST>5.0%
JSON만 반환. 마크다운/백틱 없이 순수 JSON만.`;

    const userPrompt = `시장데이터: ${JSON.stringify(inputLevels)}
위 데이터로 하트넷 프레임워크 평가를 JSON으로 반환:
{
"overall":"green|yellow|red",
"overall_comment":"2문장 이내 총평",
"triggers":{
"sp500":{"level":숫자,"threshold":6600,"met":bool,"comment":"1문장"},
"wti":{"level":숫자,"threshold":100,"met":bool,"comment":"1문장"},
"dxy":{"level":숫자,"threshold":100,"met":bool,"comment":"1문장"},
"ust30y":{"level":숫자,"threshold":5.0,"met":bool,"comment":"1문장"}
},
"triggers_met_count":숫자,
"energy_shock":{"status":"green|yellow|red","comment":"1문장"},
"credit_stress":{"status":"green|yellow|red","comment":"1문장"},
"liquidity_pressure":{"status":"green|yellow|red","comment":"1문장"},
"policy_put_probability":"low|medium|high",
"key_risk":"1문장",
"hartnett_strategy":{
"sell":"과열 매도 대상 1문장",
"buy":"바닥 매수 대상 1문장",
"uncertain":"모호 영역 1문장"
}
}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');

    let assessment;
    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      assessment = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Raw:', text.substring(0, 300));
      return NextResponse.json({ error: 'AI 응답 파싱 실패. 다시 시도해주세요.', raw: text.substring(0, 200) }, { status: 500 });
    }

    // 4) Supabase 저장
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const savePayload = {
      assessment,
      input_levels: inputLevels,
      data_as_of: dataAsOf,
      updated_at: new Date().toISOString(),
    };

    const saveRes = await fetch(`${supabaseUrl}/rest/v1/hartnett_monitor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(savePayload),
    });

    if (!saveRes.ok) {
      const errText = await saveRes.text();
      console.error('Supabase save error:', errText);
      return NextResponse.json({ ...savePayload, save_warning: 'DB 저장 실패' });
    }

    return NextResponse.json(savePayload);
  } catch (err) {
    console.error('Hartnett monitor error:', err);
    return NextResponse.json({ error: err.message || '서버 오류' }, { status: 500 });
  }
}

// ─── GET: 최신 평가 + 실시간 FRED 데이터 ───
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const live = url.searchParams.get('live') === 'true';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const res = await fetch(
      `${supabaseUrl}/rest/v1/hartnett_monitor?order=updated_at.desc&limit=1`,
      {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
        cache: 'no-store',
      }
    );

    if (!res.ok) return NextResponse.json({ error: 'DB 조회 실패' }, { status: 500 });

    const data = await res.json();
    const latest = data.length > 0 ? data[0] : null;

    // live 모드: FRED 현재 시세도 반환
    if (live && process.env.FRED_API_KEY) {
      const fredData = await fetchAllFredData(process.env.FRED_API_KEY);
      return NextResponse.json({ latest, fredLive: fredData });
    }

    return NextResponse.json({ latest });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
