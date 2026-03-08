import { NextResponse } from 'next/server';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  // Extract all text blocks
  return data.content
    ?.filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

export async function POST() {
  try {
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });
    }

    // ── 1. Gold price + headline ──
    const priceRaw = await callClaude(
      `Search for the current gold price (XAU/USD) today and the daily change percentage, plus ATH and YTD performance.
Return ONLY valid JSON, no markdown, no backticks:
{"price":number,"change_pct":number,"ath":number,"ytd_pct":number,"updated":"YYYY-MM-DD"}`
    );

    // ── 2. Central bank purchases latest ──
    const cbRaw = await callClaude(
      `Search for the latest World Gold Council (WGC) monthly central bank gold statistics report. Also search "central bank gold purchases 2026" and "WGC central bank gold statistics".
I need the latest monthly net purchases data for these 11 countries: Poland, China, Czech Republic, Serbia, India, Kazakhstan, Turkey, Brazil, Uzbekistan, Malaysia, South Korea (BOK).
Also include: total global CB net purchases for 2025 full year, and any 2026 monthly data available (especially January 2026).
Note: BOK announced plans to incorporate overseas-listed physical gold ETFs into reserves from Q1 2026.
Return ONLY valid JSON, no markdown:
{
  "year2025_total":number,
  "year2025_yoy":number,
  "latest_month":"Jan 2026",
  "latest_month_total":number,
  "countries":{
    "poland":{"current_reserves":number,"2025_total":number,"latest_month":"","latest_month_tonnes":number},
    "china":{"current_reserves":number,"2025_total":number,"latest_month":"","latest_month_tonnes":number},
    "czech":{"current_reserves":number,"2025_total":number,"latest_month":"","latest_month_tonnes":number},
    "serbia":{"current_reserves":number,"2025_total":number,"latest_month":"","latest_month_tonnes":number},
    "india":{"current_reserves":number,"2025_total":number,"latest_month":"","latest_month_tonnes":number},
    "kazakhstan":{"current_reserves":number,"2025_total":number,"latest_month":"","latest_month_tonnes":number},
    "turkey":{"current_reserves":number,"2025_total":number,"latest_month":"","latest_month_tonnes":number},
    "brazil":{"current_reserves":number,"2025_total":number,"latest_month":"","latest_month_tonnes":number},
    "uzbekistan":{"current_reserves":number,"2025_total":number,"latest_month":"","latest_month_tonnes":number},
    "malaysia":{"current_reserves":number,"2025_total":number,"latest_month":"","latest_month_tonnes":number},
    "korea":{"current_reserves":number,"2025_total":number,"latest_month":"","latest_month_tonnes":number,"note":"ETF"}
  }
}`
    );

    // ── 3. IB forecasts ──
    const ibRaw = await callClaude(
      `Search for the latest 2026 gold price forecasts from major investment banks (JPMorgan, Goldman Sachs, UBS, Deutsche Bank, Bank of America, Morgan Stanley, Standard Chartered, Jefferies, etc).
Also search for their central bank gold purchase forecasts for 2026.
Return ONLY valid JSON, no markdown:
{"forecasts":[{"bank":"","target_2026":"","cb_forecast":"","stance":""}]}`
    );

    // ── 4. News ──
    const newsRaw = await callClaude(
      `Search for the latest gold market news from the past 2 weeks. Focus on: central bank gold purchases, geopolitical events affecting gold, major price movements, and IB forecast updates.
Return ONLY valid JSON array, no markdown:
[{"date":"YYYY.MM.DD","title":"","tag":"","impact":"↑ or ↓ or →"}]
Return maximum 10 items, most recent first.`
    );

    // ── 5. Upcoming events ──
    const eventsRaw = await callClaude(
      `Search for upcoming events in the next 4 weeks that could impact gold prices: FOMC meetings, economic data releases (CPI, NFP, PMI), geopolitical events, WGC reports.
Return ONLY valid JSON array, no markdown:
[{"date":"MM/DD","event":"","note":""}]
Return maximum 8 items.`
    );

    // ── Parse all results ──
    function safeJSON(raw, fallback) {
      if (!raw) return fallback;
      try {
        // Strip markdown code fences if present
        const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        return JSON.parse(cleaned);
      } catch {
        return fallback;
      }
    }

    const result = {
      price: safeJSON(priceRaw, null),
      cb: safeJSON(cbRaw, null),
      ib: safeJSON(ibRaw, null),
      news: safeJSON(newsRaw, []),
      events: safeJSON(eventsRaw, []),
      updated_at: new Date().toISOString(),
    };

    // ── Save to Supabase if configured ──
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
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
            data: result,
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
