import { NextResponse } from "next/server";

function extractJSON(text) {
  if (!text) return null;
  try {
    return JSON.parse(text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim());
  } catch {}
  const matches = text.match(/\{[\s\S]*\}/g);
  if (matches) {
    for (const m of matches.sort((a, b) => b.length - a.length)) {
      try { return JSON.parse(m); } catch {}
    }
  }
  return null;
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다" }, { status: 500 });
  }

  try {
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

Use exact range format like "350-375", "325-350", "300-325" etc.
Percentages should sum to ~100 for each meeting.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic API error:", res.status, errText);
      return NextResponse.json({ error: `Anthropic API ${res.status}: ${errText.slice(0, 200)}` }, { status: 500 });
    }

    const data = await res.json();
    const rawText = (data.content?.filter((b) => b.type === "text") || []).map((b) => b.text).join("\n");
    const parsed = extractJSON(rawText);

    if (!parsed) {
      console.error("JSON parse failed. Raw:", rawText.slice(0, 500));
      return NextResponse.json({ error: "AI 응답을 JSON으로 파싱할 수 없습니다", raw: rawText.slice(0, 300) }, { status: 500 });
    }

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
      rate: parsed.current_rate ? {
        current_rate_lower: parseInt(parsed.current_rate.split("-")[0]),
        current_rate_upper: parseInt(parsed.current_rate.split("-")[1]),
      } : null,
      updated_at: now,
    };

    // Supabase save (best-effort)
    try {
      const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (sbUrl && sbKey) {
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(sbUrl, sbKey);
        await sb.from("fedwatch_data").upsert({ id: "latest", data: result, updated_at: now });
        const today = now.split("T")[0];
        await sb.from("fedwatch_snapshots").insert({
          data: {
            date: today,
            meetings: (parsed.meetings || []).map((m) => ({
              date: m.date, label: m.label,
              expected_rate: m.expected_rate || 0, cut_prob: m.cut_prob || 0,
            })),
          },
        });
      }
    } catch (e) {
      console.log("Supabase save skipped:", e.message);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("FedWatch update error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
