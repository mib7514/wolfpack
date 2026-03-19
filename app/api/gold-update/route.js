import { NextResponse } from 'next/server';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Haiku: 더 저렴하고, Tier 1에서도 50K ITPM (Sonnet 30K 대비 높음)
const MODEL = 'claude-haiku-4-5-20251001';

async function callClaude(prompt, maxTokens = 3000, timeoutMs = 45000) {
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
        model: MODEL,
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

    if (!text || text.trim().length < 5) throw new Error('Empty response');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function safeJSON(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
  } catch {}
  const m = raw.match(/[\[{][\s\S]*[\]}]/g);
  if (m) for (const s of m.sort((a, b) => b.length - a.length)) {
    try { return JSON.parse(s); } catch {}
  }
  return fallback;
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

export async function POST(request) {
  try {
    const adminPin = process.env.ADMIN_PIN;
    const userPin = request.headers.get('x-admin-pin');
    if (!adminPin || userPin !== adminPin) {
      return NextResponse.json({ error: '관리자 인증이 필요합니다' }, { status: 401 });
    }
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });
    }

    const errors = [];
    let cbData = null, ibData = null, newsData = [], eventsData = [];

    // ═══ Call 1: CB + IB (순차 — rate limit 방지) ═══
    try {
      const raw = await callClaude(
`Search "central bank gold purchases 2026" and "gold price forecast 2026".
Return ONLY JSON. No markdown. null for unknowns.
{"cb":{"year2025_total":null,"countries":{"poland":{"current_reserves":null,"note":""},"china":{"current_reserves":null,"note":""},"czech":{"current_reserves":null,"note":""},"india":{"current_reserves":null,"note":""},"kazakhstan":{"current_reserves":null,"note":""},"turkey":{"current_reserves":null,"note":""},"brazil":{"current_reserves":null,"note":""},"uzbekistan":{"current_reserves":null,"note":""},"malaysia":{"current_reserves":null,"note":""},"korea":{"current_reserves":null,"note":""}}},"ib":{"forecasts":[{"bank":"","target_2026":"","stance":""}]}}`, 3000, 45000);

      const parsed = safeJSON(raw, {});
      if (parsed.cb?.countries) cbData = parsed.cb;
      else errors.push('CB: 데이터 없음');
      if (parsed.ib?.forecasts?.length > 0) ibData = parsed.ib;
      else errors.push('IB: 데이터 없음');
    } catch (e) {
      errors.push(`CB+IB: ${e.message?.slice(0, 150)}`);
    }

    // ── 60초 대기 (분당 토큰 한도 리셋) ──
    await delay(5000);

    // ═══ Call 2: News + Events ═══
    try {
      const raw = await callClaude(
`Search "gold news today March 2026".
Return ONLY JSON. No markdown.
{"news":[{"date":"2026.03.19","title":"","tag":"시장","impact":"↑"}],"events":[{"date":"3/19","event":"","note":""}]}
Tags: 지정학/전망/중앙은행/시장/데이터. Impact: ↑/↓/→. Max 6 news, 4 events.`, 2000, 45000);

      const parsed = safeJSON(raw, {});
      if (Array.isArray(parsed.news) && parsed.news.length > 0) newsData = parsed.news;
      else errors.push('뉴스: 데이터 없음');
      if (Array.isArray(parsed.events) && parsed.events.length > 0) eventsData = parsed.events;
    } catch (e) {
      errors.push(`뉴스: ${e.message?.slice(0, 150)}`);
    }

    const result = {
      cb: cbData, ib: ibData, news: newsData, events: eventsData,
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
