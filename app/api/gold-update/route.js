import { NextResponse } from 'next/server';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function callClaude(prompt, maxTokens = 4096, timeoutMs = 50000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
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
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${errBody.slice(0, 300)}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

    const text = data.content
      ?.filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    if (!text || text.trim().length < 5) {
      throw new Error('Empty response from Claude');
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function safeJSON(raw, fallback) {
  if (!raw) return fallback;
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch {}
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
    // ─── PIN ───
    const adminPin = process.env.ADMIN_PIN;
    const userPin = request.headers.get('x-admin-pin');
    if (!adminPin || userPin !== adminPin) {
      return NextResponse.json({ error: '관리자 인증이 필요합니다' }, { status: 401 });
    }
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });
    }

    // ═══ 두 호출을 병렬 실행 (Vercel 60s 타임아웃 대응) ═══
    const [cbibResult, newsResult] = await Promise.allSettled([

      // ── Call 1: CB + IB ──
      callClaude(`Search for "central bank gold purchases 2026" and "gold price forecast 2026 investment banks".

Return a JSON object with CB gold reserves data and IB forecasts. Use null for unknown values. No markdown.

{"cb":{"year2025_total":null,"countries":{"poland":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""},"china":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""},"czech":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""},"india":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""},"kazakhstan":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""},"turkey":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""},"brazil":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""},"uzbekistan":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""},"malaysia":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""},"korea":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""}}},"ib":{"forecasts":[{"bank":"","target_2026":"","cb_forecast":"","stance":""}]}}`, 4096, 50000),

      // ── Call 2: News + Events ──
      callClaude(`Search for "gold market news today" and "gold price FOMC 2026".

Return JSON with recent gold news and upcoming events. No markdown. Only verified facts.

{"news":[{"date":"2026.03.19","title":"","tag":"지정학","impact":"↑"}],"events":[{"date":"3/19","event":"","note":""}]}

Tags: 지정학, 전망, 중앙은행, 시장, 데이터, 정책. Impact: ↑ ↓ →. Max 8 news, 6 events.`, 3000, 50000),
    ]);

    // ─── 결과 처리 ───
    const errors = [];

    let cbData = null, ibData = null;
    if (cbibResult.status === 'fulfilled') {
      const parsed = safeJSON(cbibResult.value, {});
      if (parsed.cb?.countries && Object.keys(parsed.cb.countries).length > 0) cbData = parsed.cb;
      else errors.push('CB: JSON 파싱 성공했으나 countries 데이터 없음');
      if (parsed.ib?.forecasts?.length > 0) ibData = parsed.ib;
      else errors.push('IB: JSON 파싱 성공했으나 forecasts 데이터 없음');
    } else {
      errors.push(`CB+IB 호출 실패: ${cbibResult.reason?.message || cbibResult.reason}`);
    }

    let newsData = [], eventsData = [];
    if (newsResult.status === 'fulfilled') {
      const parsed = safeJSON(newsResult.value, {});
      if (Array.isArray(parsed.news) && parsed.news.length > 0) newsData = parsed.news;
      else errors.push('뉴스: JSON 파싱 성공했으나 news 배열 없음');
      if (Array.isArray(parsed.events) && parsed.events.length > 0) eventsData = parsed.events;
    } else {
      errors.push(`뉴스 호출 실패: ${newsResult.reason?.message || newsResult.reason}`);
    }

    const result = {
      cb: cbData,
      ib: ibData,
      news: newsData,
      events: eventsData,
      errors: errors.length > 0 ? errors : undefined,
      updated_at: new Date().toISOString(),
    };

    // ─── Supabase (수동 금가격 보존) ───
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/gold_monitor_data?id=eq.latest`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        });
        const rows = await existingRes.json();
        const prevData = rows?.[0]?.data || {};

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
          body: JSON.stringify({ id: 'latest', data: mergedData, updated_at: result.updated_at }),
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
}import { NextResponse } from 'next/server';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function callClaude(prompt, maxTokens = 4096, timeoutMs = 50000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
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
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${errBody.slice(0, 300)}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

    const text = data.content
      ?.filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    if (!text || text.trim().length < 5) {
      throw new Error('Empty response from Claude');
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function safeJSON(raw, fallback) {
  if (!raw) return fallback;
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch {}
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
    // ─── PIN ───
    const adminPin = process.env.ADMIN_PIN;
    const userPin = request.headers.get('x-admin-pin');
    if (!adminPin || userPin !== adminPin) {
      return NextResponse.json({ error: '관리자 인증이 필요합니다' }, { status: 401 });
    }
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });
    }

    // ═══ 두 호출을 병렬 실행 (Vercel 60s 타임아웃 대응) ═══
    const [cbibResult, newsResult] = await Promise.allSettled([

      // ── Call 1: CB + IB ──
      callClaude(`Search for "central bank gold purchases 2026" and "gold price forecast 2026 investment banks".

Return a JSON object with CB gold reserves data and IB forecasts. Use null for unknown values. No markdown.

{"cb":{"year2025_total":null,"countries":{"poland":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""},"china":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""},"czech":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""},"india":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""},"kazakhstan":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""},"turkey":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""},"brazil":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""},"uzbekistan":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""},"malaysia":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""},"korea":{"current_reserves":null,"latest_month":"","latest_month_tonnes":null,"note":""}}},"ib":{"forecasts":[{"bank":"","target_2026":"","cb_forecast":"","stance":""}]}}`, 4096, 50000),

      // ── Call 2: News + Events ──
      callClaude(`Search for "gold market news today" and "gold price FOMC 2026".

Return JSON with recent gold news and upcoming events. No markdown. Only verified facts.

{"news":[{"date":"2026.03.19","title":"","tag":"지정학","impact":"↑"}],"events":[{"date":"3/19","event":"","note":""}]}

Tags: 지정학, 전망, 중앙은행, 시장, 데이터, 정책. Impact: ↑ ↓ →. Max 8 news, 6 events.`, 3000, 50000),
    ]);

    // ─── 결과 처리 ───
    const errors = [];

    let cbData = null, ibData = null;
    if (cbibResult.status === 'fulfilled') {
      const parsed = safeJSON(cbibResult.value, {});
      if (parsed.cb?.countries && Object.keys(parsed.cb.countries).length > 0) cbData = parsed.cb;
      else errors.push('CB: JSON 파싱 성공했으나 countries 데이터 없음');
      if (parsed.ib?.forecasts?.length > 0) ibData = parsed.ib;
      else errors.push('IB: JSON 파싱 성공했으나 forecasts 데이터 없음');
    } else {
      errors.push(`CB+IB 호출 실패: ${cbibResult.reason?.message || cbibResult.reason}`);
    }

    let newsData = [], eventsData = [];
    if (newsResult.status === 'fulfilled') {
      const parsed = safeJSON(newsResult.value, {});
      if (Array.isArray(parsed.news) && parsed.news.length > 0) newsData = parsed.news;
      else errors.push('뉴스: JSON 파싱 성공했으나 news 배열 없음');
      if (Array.isArray(parsed.events) && parsed.events.length > 0) eventsData = parsed.events;
    } else {
      errors.push(`뉴스 호출 실패: ${newsResult.reason?.message || newsResult.reason}`);
    }

    const result = {
      cb: cbData,
      ib: ibData,
      news: newsData,
      events: eventsData,
      errors: errors.length > 0 ? errors : undefined,
      updated_at: new Date().toISOString(),
    };

    // ─── Supabase (수동 금가격 보존) ───
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/gold_monitor_data?id=eq.latest`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        });
        const rows = await existingRes.json();
        const prevData = rows?.[0]?.data || {};

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
          body: JSON.stringify({ id: 'latest', data: mergedData, updated_at: result.updated_at }),
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
