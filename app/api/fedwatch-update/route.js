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
  return data.content
    ?.filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

function safeJSON(raw, fallback) {
  if (!raw) return fallback;
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
}

export async function POST() {
  try {
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });
    }

    // ── 1. Current rate + next meeting ──
    const rateRaw = await callClaude(
      `Search for the current US Federal Funds Rate target range and the next upcoming FOMC meeting date.
Return ONLY valid JSON, no markdown, no backticks:
{"current_rate_upper":number,"current_rate_lower":number,"next_meeting":"YYYY-MM-DD","last_decision":"hold or cut or hike","last_decision_date":"YYYY-MM-DD"}`
    );

    // ── 2. Probabilities for each upcoming FOMC meeting ──
    const probRaw = await callClaude(
      `Search for the latest CME FedWatch probabilities for ALL upcoming 2026 FOMC meetings.
For each meeting, I need the probability distribution of the target rate ranges.
The 2026 FOMC meeting dates are: Mar 18, Apr 29, Jun 17, Jul 29, Sep 17, Oct 29, Dec 10.
For each meeting, provide the probability for each rate range (e.g., 375-400, 350-375, 325-350, 300-325, 275-300, 250-275, etc).
Also calculate the probability-weighted expected rate (midpoint of each range * probability).

Return ONLY valid JSON, no markdown:
{
  "as_of":"YYYY-MM-DD",
  "meetings":[
    {
      "date":"YYYY-MM-DD",
      "label":"Mar",
      "probs":[{"range":"350-375","pct":96},{"range":"325-350","pct":4}],
      "expected_rate":3.61,
      "most_likely":"350-375",
      "most_likely_pct":96,
      "cut_prob":4,
      "hold_prob":96,
      "hike_prob":0
    }
  ]
}`
    );

    // ── 3. Market commentary + dot plot context ──
    const commentRaw = await callClaude(
      `Search for the latest Fed commentary, dot plot expectations, and market consensus on 2026 rate path.
Include: Fed's own projection for YE 2026, market pricing vs Fed dots, key risks (inflation, tariffs, labor).
Return ONLY valid JSON, no markdown:
{
  "fed_ye2026_projection":"3.25-3.50",
  "market_ye2026_expected":"3.00-3.25",
  "cuts_priced_2026":2,
  "first_cut_expected":"Jun 2026",
  "commentary":"brief summary",
  "risks":["risk1","risk2","risk3"],
  "recent_fed_speakers":[{"name":"","date":"","message":""}]
}`
    );

    const result = {
      rate: safeJSON(rateRaw, null),
      probabilities: safeJSON(probRaw, null),
      commentary: safeJSON(commentRaw, null),
      updated_at: new Date().toISOString(),
    };

    // ── Save snapshot to Supabase ──
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        // Save latest state
        await fetch(`${SUPABASE_URL}/rest/v1/fedwatch_data`, {
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

        // Save time-series snapshot (one per day)
        const today = new Date().toISOString().split('T')[0];
        if (result.probabilities?.meetings) {
          const snapshot = {
            date: today,
            meetings: result.probabilities.meetings.map(m => ({
              date: m.date,
              label: m.label,
              expected_rate: m.expected_rate,
              cut_prob: m.cut_prob,
              hold_prob: m.hold_prob,
            })),
          };
          await fetch(`${SUPABASE_URL}/rest/v1/fedwatch_snapshots`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              Prefer: 'resolution=merge-duplicates',
            },
            body: JSON.stringify({
              id: today,
              data: snapshot,
              created_at: result.updated_at,
            }),
          });
        }
      } catch (e) {
        console.log('Supabase save failed:', e.message);
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('FedWatch update error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
