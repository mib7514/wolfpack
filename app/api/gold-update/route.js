import { NextResponse } from 'next/server';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function callClaude(prompt, maxTokens = 4096) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  const text = data.content
    ?.filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  if (!text) throw new Error('No text content in response');
  return text;
}

function safeJSON(raw, fallback) {
  if (!raw) return fallback;
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch {}
  // Try to find the largest JSON block
  const matches = raw.match(/[\[{][\s\S]*[\]}]/g);
  if (matches) {
    for (const m of matches.sort((a, b) => b.length - a.length)) {
      try { return JSON.parse(m); } catch {}
    }
  }
  return fallback;
}

export async function POST(request) {
  try {
    // ─── PIN 검증 ───
    const adminPin = process.env.ADMIN_PIN;
    const userPin = request.headers.get('x-admin-pin');
    if (!adminPin || userPin !== adminPin) {
      return NextResponse.json({ error: '관리자 인증이 필요합니다' }, { status: 401 });
    }

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });
    }

    const errors = [];

    // ═══ Call 1: CB + IB (구조적 데이터) ═══
    let cbData = null, ibData = null;
    try {
      const raw = await callClaude(`You are a gold market research analyst. Please search for the following two topics:

TOPIC 1: Central bank gold purchases
- Search "World Gold Council central bank gold purchases 2026" and "central bank gold buying 2026"
- Find: total CB net purchases for 2025, any 2026 monthly data
- For these countries, find latest reserves (tonnes) and any recent purchase data:
  Poland, China, Czech Republic, Serbia, India, Kazakhstan, Turkey, Brazil, Uzbekistan, Malaysia, South Korea (BOK)

TOPIC 2: Investment bank gold forecasts
- Search "gold price forecast 2026 investment bank"
- Find 2026 year-end gold price targets from: JPMorgan, Goldman Sachs, UBS, Deutsche Bank, Bank of America, Morgan Stanley, Standard Chartered, Jefferies

CRITICAL INSTRUCTIONS:
- Return ONLY a raw JSON object. No markdown fences, no explanation text before or after.
- Use null for any data you cannot verify. Do NOT invent numbers.
- Start your response with { and end with }

{
  "cb": {
    "year2025_total": null,
    "countries": {
      "poland": {"current_reserves": null, "latest_month": "", "latest_month_tonnes": null, "note": ""},
      "china": {"current_reserves": null, "latest_month": "", "latest_month_tonnes": null, "note": ""},
      "czech": {"current_reserves": null, "latest_month": "", "latest_month_tonnes": null, "note": ""},
      "serbia": {"current_reserves": null, "latest_month": "", "latest_month_tonnes": null, "note": ""},
      "india": {"current_reserves": null, "latest_month": "", "latest_month_tonnes": null, "note": ""},
      "kazakhstan": {"current_reserves": null, "latest_month": "", "latest_month_tonnes": null, "note": ""},
      "turkey": {"current_reserves": null, "latest_month": "", "latest_month_tonnes": null, "note": ""},
      "brazil": {"current_reserves": null, "latest_month": "", "latest_month_tonnes": null, "note": ""},
      "uzbekistan": {"current_reserves": null, "latest_month": "", "latest_month_tonnes": null, "note": ""},
      "malaysia": {"current_reserves": null, "latest_month": "", "latest_month_tonnes": null, "note": ""},
      "korea": {"current_reserves": null, "latest_month": "", "latest_month_tonnes": null, "note": ""}
    }
  },
  "ib": {
    "forecasts": [
      {"bank": "JPMorgan", "target_2026": "$6,300", "cb_forecast": "755t/yr", "stance": "Very Bullish"}
    ]
  }
}`, 4096);

      const parsed = safeJSON(raw, {});
      if (parsed.cb?.countries && Object.keys(parsed.cb.countries).length > 0) {
        cbData = parsed.cb;
      }
      if (parsed.ib?.forecasts?.length > 0) {
        ibData = parsed.ib;
      }
    } catch (e) {
      errors.push(`CB+IB: ${e.message}`);
      console.error('Call 1 (CB+IB) failed:', e.message);
    }

    // ═══ Call 2: News + Events (동적 데이터) ═══
    let newsData = [], eventsData = [];
    try {
      const raw = await callClaude(`You are a gold market news analyst. Please search for:

1. Latest gold market news (past 2 weeks):
   - Search "gold price news today" and "central bank gold news 2026"
   - Focus on: CB gold purchases, geopolitical events, major price moves, IB forecast changes

2. Upcoming events (next 4 weeks):
   - Search "FOMC meeting 2026" and "economic calendar gold"
   - Include: Fed meetings, CPI/NFP releases, WGC reports, geopolitical events

CRITICAL INSTRUCTIONS:
- Return ONLY a raw JSON object. No markdown fences, no explanation before or after.
- Only include real, verified news. Do NOT fabricate.
- Start your response with { and end with }

{
  "news": [
    {"date": "2026.03.19", "title": "headline", "tag": "지정학", "impact": "↑"}
  ],
  "events": [
    {"date": "3/19", "event": "event name", "note": "impact note"}
  ]
}

Tags must be one of: 지정학, 전망, 중앙은행, 시장, 데이터, 정책
Impact must be one of: ↑, ↓, →
Max 8 news (most recent first), max 6 events.`, 3000);

      const parsed = safeJSON(raw, {});
      if (Array.isArray(parsed.news) && parsed.news.length > 0) {
        newsData = parsed.news;
      }
      if (Array.isArray(parsed.events) && parsed.events.length > 0) {
        eventsData = parsed.events;
      }
    } catch (e) {
      errors.push(`News: ${e.message}`);
      console.error('Call 2 (News+Events) failed:', e.message);
    }

    const result = {
      cb: cbData,
      ib: ibData,
      news: newsData,
      events: eventsData,
      errors: errors.length > 0 ? errors : undefined,
      updated_at: new Date().toISOString(),
    };

    // ─── Supabase 저장 (기존 수동 금가격 보존) ───
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        // 기존 데이터 조회 (수동 입력한 금가격 보존)
        const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/gold_monitor_data?id=eq.latest`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        });
        const rows = await existingRes.json();
        const prevData = rows?.[0]?.data || {};

        // 수동 금가격은 보존, 나머지만 AI 데이터로 업데이트
        const mergedData = { ...prevData };
        if (cbData) mergedData.cb = cbData;
        if (ibData) mergedData.ib = ibData;
        if (newsData.length > 0) mergedData.news = newsData;
        if (eventsData.length > 0) mergedData.events = eventsData;
        mergedData.updated_at = result.updated_at;

        await fetch(`${SUPABASE_URL}/rest/v1/gold_monitor_data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            id: 'latest',
            data: mergedData,
            updated_at: result.updated_at,
          }),
        });
      } catch (e) {
        console.log('Supabase save failed:', e.message);
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('Gold update error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
