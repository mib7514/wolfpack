// app/api/radar/generate/route.js
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { ticker, exchange } = await req.json();
    if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key not set" }, { status: 500 });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `You are a growth stock analyst. Research "${ticker.toUpperCase()}" on ${exchange} and generate a concise investment thesis in Korean.

Return ONLY valid JSON (no markdown, no backticks):
{
  "name": "company name in English",
  "thesis_oneliner": "한줄 thesis (Korean, max 60 chars)",
  "bull_case": "Bull case 3-4줄 (Korean)",
  "bear_case": "Bear case 3-4줄 (Korean)",
  "catalysts": "향후 12개월 카탈리스트 3-5개, • 사용 (Korean)",
  "key_metrics": "핵심 추적 지표 3-5개, • 사용 (Korean)",
  "entry_exit": "진입 조건 + 손절 조건 (Korean)",
  "suggested_category": "one of: BTC_TREASURY, AI_INFRA, AI_APP, BIOTECH, SPAC, IPO, ROBOTICS, ENERGY, FINTECH, CRYPTO, SEMI, OTHER",
  "win_prob": 0.45,
  "wl_ratio": 2.5
}
win_prob = probability of thesis playing out (0.1~0.9, conservative)
wl_ratio = upside / downside ratio (0.5~10)`
        }]
      }),
    });

    if (!res.ok) {
      console.error("Claude API error:", await res.text());
      return NextResponse.json({ error: "Claude API failed" }, { status: 502 });
    }

    const data = await res.json();
    const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

    return NextResponse.json(parsed);
  } catch (e) {
    console.error("Generate error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
