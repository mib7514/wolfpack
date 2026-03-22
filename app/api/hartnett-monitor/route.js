import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const FRED_SERIES = {
  sp500: 'SP500',
  wti: 'DCOILWTICO',
  ust30y: 'DGS30',
  ust10y: 'DGS10',
  hy_oas: 'BAMLH0A0HYM2',
  vix: 'VIXCLS',
  bei_5y: 'T5YIE',
  ust2y: 'DGS2',
  tips10y: 'DFII10',
  brent: 'DCOILBRENTEU',
};

async function fetchFredSeries(seriesId, apiKey) {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=10`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const valid = (data.observations || []).filter(o => o.value && o.value !== '.');
    if (valid.length === 0) return null;
    return {
      value: parseFloat(valid[0].value),
      date: valid[0].date,
      prev: valid.length > 1 ? parseFloat(valid[1].value) : null,
      prev5: valid.length > 4 ? parseFloat(valid[4].value) : null,
    };
  } catch (err) {
    console.error(`FRED error ${seriesId}:`, err.message);
    return null;
  }
}

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

// Supabase helper
function supaFetch(path, options = {}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

// ─── POST: AI 분석 + 날짜별 저장 ───
export async function POST(request) {
  try {
    const pin = request.headers.get('x-admin-pin');
    if (pin !== process.env.ADMIN_PIN) {
      return NextResponse.json({ error: '관리자 인증 실패' }, { status: 401 });
    }

    const body = await request.json();
    const { manualOverrides } = body || {};

    const fredKey = process.env.FRED_API_KEY;
    if (!fredKey) {
      return NextResponse.json({ error: 'FRED_API_KEY 환경변수 미설정' }, { status: 500 });
    }

    const fredData = await fetchAllFredData(fredKey);

    const inputLevels = {
      sp500: manualOverrides?.sp500 || fredData.sp500?.value || null,
      wti: manualOverrides?.wti || fredData.wti?.value || null,
      wti_prev5: fredData.wti?.prev5 || null,
      dxy: manualOverrides?.dxy || null,
      ust30y: manualOverrides?.ust30y || fredData.ust30y?.value || null,
      ust10y: fredData.ust10y?.value || null,
      ust2y: fredData.ust2y?.value || null,
      hy_oas: manualOverrides?.hy_oas || fredData.hy_oas?.value || null,
      hy_oas_prev: fredData.hy_oas?.prev || null,
      vix: fredData.vix?.value || null,
      bei_5y: fredData.bei_5y?.value || null,
      bei_5y_prev5: fredData.bei_5y?.prev5 || null,
      tips10y: fredData.tips10y?.value || null,
      tips10y_prev: fredData.tips10y?.prev || null,
      brent: manualOverrides?.brent || fredData.brent?.value || null,
      loan_price: manualOverrides?.loan_price || null,
    };

    const dataAsOf = {};
    for (const [key, val] of Object.entries(fredData)) {
      if (val?.date) dataAsOf[key] = val.date;
    }

    if (!inputLevels.sp500 || !inputLevels.wti || !inputLevels.ust30y) {
      const missing = [];
      if (!inputLevels.sp500) missing.push('S&P500');
      if (!inputLevels.wti) missing.push('WTI');
      if (!inputLevels.ust30y) missing.push('30Y금리');
      return NextResponse.json({
        error: `FRED 데이터 수집 실패: ${missing.join(', ')}`,
        fredData, inputLevels,
      }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `당신은 마이클 하트넷의 2008 금융위기 유사성 프레임워크 기반 시장 상태 평가 분석가입니다.
트리거: S&P500<6600, WTI>100, DXY>100, 30Y UST>5.0%
FRED에서 수집된 실제 시장 데이터를 기반으로 트리거 판단 + 일일/주간 체크리스트를 자동 평가합니다.
JSON만 반환. 마크다운/백틱 없이 순수 JSON만. 모든 comment는 반드시 1문장(20자 이내)으로.`;

    const userPrompt = `데이터: ${JSON.stringify(inputLevels)}

아래 JSON을 반환하라. 체크리스트는 데이터에서 판단 가능하면 true/false, 데이터 부족시 null. 모든 comment는 1문장 20자 이내:
{
"overall":"green|yellow|red",
"overall_comment":"1문장 총평",
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
"sell":"1문장","buy":"1문장","uncertain":"1문장"
},
"daily_checks":{
"wti_sustained":{"met":bool,"comment":"10자"},
"brent_wti_spread":{"met":bool,"comment":"10자"},
"crack_spread":{"met":bool,"comment":"10자"},
"hy_oas_wide":{"met":bool,"comment":"10자"},
"loan_distress":{"met":bool,"comment":"10자"},
"financials_weak":{"met":bool,"comment":"10자"},
"dxy_above100":{"met":bool,"comment":"10자"},
"real_rates_up":{"met":bool,"comment":"10자"}
},
"weekly_checks":{
"supply_shock":{"met":bool,"comment":"10자"},
"demand_recovery":{"met":bool,"comment":"10자"},
"bei_rising":{"met":bool,"comment":"10자"},
"stagflation_signal":{"met":bool,"comment":"10자"},
"pc_gate_spreading":{"met":null,"comment":"수동"},
"pc_price_falling":{"met":null,"comment":"수동"},
"triple_pressure":{"met":bool,"comment":"10자"},
"credit_equity_diverge":{"met":bool,"comment":"10자"},
"margin_pressure":{"met":null,"comment":"수동"},
"policy_sequence":{"met":null,"comment":"수동"}
}
}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');

    let assessment;
    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      assessment = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Raw:', text.substring(0, 400));
      return NextResponse.json({ error: 'AI 응답 파싱 실패', raw: text.substring(0, 300) }, { status: 500 });
    }

    // ─── 날짜별 저장 (upsert) ───
    const now = new Date();
    const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 기존 컬럼만 저장: assessment, input_levels, data_as_of, updated_at, snapshot_date
    const savePayload = {
      assessment,
      input_levels: inputLevels,
      data_as_of: dataAsOf,
      updated_at: now.toISOString(),
      snapshot_date: kstDate,
    };

    // 같은 날짜 데이터 존재 여부 확인
    const checkRes = await supaFetch(`hartnett_monitor?snapshot_date=eq.${kstDate}&select=id`);
    const existing = await checkRes.json();

    let saveRes;
    if (existing && existing.length > 0) {
      // 같은 날짜 → 덮어쓰기
      saveRes = await supaFetch(`hartnett_monitor?snapshot_date=eq.${kstDate}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(savePayload),
      });
    } else {
      // 새 날짜 → INSERT
      saveRes = await supaFetch('hartnett_monitor', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(savePayload),
      });
    }

    if (!saveRes.ok) {
      const errText = await saveRes.text();
      console.error('Supabase save error:', errText);
      return NextResponse.json({ ...savePayload, save_warning: 'DB 저장 실패: ' + errText });
    }

    return NextResponse.json(savePayload);
  } catch (err) {
    console.error('Hartnett monitor error:', err);
    return NextResponse.json({ error: err.message || '서버 오류' }, { status: 500 });
  }
}

// ─── GET ───
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const live = url.searchParams.get('live') === 'true';

    // 히스토리 전체 조회 (시계열용)
    if (action === 'history') {
      const res = await supaFetch(
        'hartnett_monitor?select=id,snapshot_date,assessment,input_levels,updated_at&order=snapshot_date.desc&limit=100'
      );
      if (!res.ok) {
        return NextResponse.json({ error: '히스토리 조회 실패' }, { status: 500 });
      }
      const rows = await res.json();
      return NextResponse.json({ history: rows });
    }

    // 기본: 최신 1건
    const res = await supaFetch(
      'hartnett_monitor?order=snapshot_date.desc,updated_at.desc&limit=1',
      { cache: 'no-store' }
    );

    if (!res.ok) return NextResponse.json({ error: 'DB 조회 실패' }, { status: 500 });

    const data = await res.json();
    const latest = data.length > 0 ? data[0] : null;

    if (live && process.env.FRED_API_KEY) {
      const fredData = await fetchAllFredData(process.env.FRED_API_KEY);
      return NextResponse.json({ latest, fredLive: fredData });
    }

    return NextResponse.json({ latest });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
