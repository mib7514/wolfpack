import { createClient } from "@supabase/supabase-js";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  try {
    // ─── Call Claude with web search ───
    const prompt = `Search CME FedWatch tool for the latest Fed Funds rate probabilities for all upcoming 2026 FOMC meetings.

I need the probability distribution for each meeting: Mar 18, Apr 29, Jun 17, Jul 29, Sep 17, Oct 29, Dec 10.

Also find:
- Current Fed Funds Rate target range
- How many rate cuts are priced in for 2026
- When the first cut is expected
- Any recent notable Fed speaker comments (last 2-4 weeks)

Respond ONLY in JSON (no markdown, no backticks):
{
  "current_rate": "425-450",
  "meetings": [
    {
      "date": "2026-03-18",
      "label": "Mar",
      "probs": [
        {"range": "425-450", "pct": 96.0},
        {"range": "400-425", "pct": 4.0}
      ],
      "expected_rate": 4.355,
      "cut_prob": 4.0
    }
  ],
  "cuts_priced_2026": 2,
  "first_cut_expected": "Jun 2026",
  "commentary": "한국어로 2-3문장 시장 코멘터리. 채권 PM 관점에서 핵심 내용.",
  "risks": ["리스크1", "리스크2", "리스크3"],
  "recent_fed_speakers": [
    {"name": "이름", "date": "2026-MM-DD", "message": "한국어 요약"}
  ]
}

Use exact range format like "350-375", "325-350", "300-325" etc (basis points without decimal).
Percentages should sum to ~100 for each meeting.
Provide the MOST CURRENT data available from CME FedWatch.`;

    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 4000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return Response.json({ error: `Anthropic API error: ${res.status} - ${errText.slice(0, 300)}` }, { status: 500 });
    }

    const data = await res.json();
    const rawText = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    // Parse JSON from response
    let parsed;
    try {
      const cleaned = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return Response.json({ error: "Failed to parse AI response as JSON" }, { status: 500 });
      }
    }

    // Build result
    const now = new Date().toISOString();
    const result = {
      probabilities: { meetings: parsed.meetings || [] },
      commentary: {
        fed_ye2026_projection: "3.25-3.50",
        market_ye2026_expected: parsed.current_rate || "350-375",
        cuts_priced_2026: parsed.cuts_priced_2026 || 2,
        first_cut_expected: parsed.first_cut_expected || "Jun 2026",
        commentary: parsed.commentary || "",
        risks: parsed.risks || [],
        recent_fed_speakers: parsed.recent_fed_speakers || [],
      },
      rate: parsed.current_rate
        ? {
            current_rate_lower: parseInt(parsed.current_rate.split("-")[0]),
            current_rate_upper: parseInt(parsed.current_rate.split("-")[1]),
          }
        : null,
      updated_at: now,
    };

    // ─── Save to Supabase (best-effort) ───
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseKey) {
        const sb = createClient(supabaseUrl, supabaseKey);
        await sb.from("fedwatch_data").upsert({ id: "latest", data: result, updated_at: now });
        const today = now.split("T")[0];
        const snap = {
          date: today,
          meetings: (parsed.meetings || []).map((m) => ({
            date: m.date,
            label: m.label,
            expected_rate: m.expected_rate || 0,
            cut_prob: m.cut_prob || 0,
          })),
        };
        await sb.from("fedwatch_snapshots").insert({ data: snap });
      }
    } catch (e) {
      console.log("Supabase save skipped:", e.message);
    }

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
