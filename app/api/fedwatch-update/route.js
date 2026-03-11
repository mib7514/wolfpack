import { NextResponse } from "next/server";

// Web search 응답에서 JSON 추출 — 여러 전략 시도
function extractJSON(rawContent) {
  if (!rawContent) return null;

  // 전략 1: content 배열에서 각 text 블록을 개별 시도
  if (Array.isArray(rawContent)) {
    for (const block of rawContent) {
      if (block.type === "text" && block.text) {
        const result = parseJSONFromText(block.text);
        if (result) return result;
      }
    }
    // 전략 2: 모든 text 블록을 합쳐서 시도
    const allText = rawContent.filter(b => b.type === "text").map(b => b.text).join("\n");
    return parseJSONFromText(allText);
  }

  // 문자열인 경우
  if (typeof rawContent === "string") {
    return parseJSONFromText(rawContent);
  }
  return null;
}

function parseJSONFromText(text) {
  if (!text) return null;
  // 1) 코드펜스 제거 후 직접 파싱
  try {
    const clean = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    return JSON.parse(clean);
  } catch {}

  // 2) 밸런스드 브레이스 매칭으로 가장 큰 JSON 객체 추출
  let maxObj = null;
  let maxLen = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      let depth = 0;
      let inStr = false;
      let esc = false;
      for (let j = i; j < text.length; j++) {
        const ch = text[j];
        if (esc) { esc = false; continue; }
        if (ch === "\\") { esc = true; continue; }
        if (ch === '"' && !esc) { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === "{") depth++;
        if (ch === "}") depth--;
        if (depth === 0) {
          const candidate = text.slice(i, j + 1);
          if (candidate.length > maxLen) {
            try {
              const parsed = JSON.parse(candidate);
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                maxObj = parsed;
                maxLen = candidate.length;
              }
            } catch {}
          }
          break;
        }
      }
    }
  }
  return maxObj;
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

IMPORTANT: Respond with ONLY a JSON object. No explanations, no markdown. Just the raw JSON:
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
  "commentary": "한국어로 2-3문장 시장 코멘터리",
  "risks": ["리스크1", "리스크2", "리스크3"],
  "recent_fed_speakers": [
    {"name": "이름", "date": "2026-MM-DD", "message": "한국어 요약"}
  ]
}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Anthropic API ${res.status}: ${errText.slice(0, 200)}` }, { status: 500 });
    }

    const data = await res.json();
    // content 배열 자체를 전달 — 각 블록별로 JSON 추출 시도
    const parsed = extractJSON(data.content);

    if (!parsed) {
      const rawText = (data.content?.filter(b => b.type === "text") || []).map(b => b.text).join("\n");
      return NextResponse.json({
        error: "AI 응답을 JSON으로 파싱할 수 없습니다",
        raw: rawText.slice(0, 500),
        stop_reason: data.stop_reason,
      }, { status: 500 });
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

    // Supabase save
    try {
      const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (sbUrl && sbKey) {
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(sbUrl, sbKey);
        await sb.from("fedwatch_data").upsert({ id: "latest", data: result, updated_at: now });
        await sb.from("fedwatch_snapshots").insert({
          data: {
            date: now.split("T")[0],
            meetings: (parsed.meetings || []).map(m => ({
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
