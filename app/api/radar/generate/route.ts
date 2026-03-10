// app/api/radar/generate/route.ts
// Claude API를 서버사이드에서 호출하는 API 라우트
// .env.local에 ANTHROPIC_API_KEY 필요

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { ticker, exchange } = await req.json();

    if (!ticker) {
      return NextResponse.json({ error: "ticker required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
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
        messages: [
          {
            role: "user",
            content: `You are a growth stock analyst specializing in high-upside speculative opportunities. Research "${ticker.toUpperCase()}" on ${exchange || "NYSE"} and generate a concise investment thesis in Korean.

Return ONLY a valid JSON object (no markdown, no backticks, no preamble) with these exact fields:
{
  "name": "company full name in English",
  "thesis_oneliner": "한줄 투자 thesis 요약 (Korean, max 60 chars)",
  "bull_case": "Bull case 핵심 논리 3-4줄 (Korean)",
  "bear_case": "Bear case 핵심 리스크 3-4줄 (Korean)",
  "catalysts": "향후 12개월 핵심 카탈리스트 3-5개, 각 줄 앞에 • 사용 (Korean)",
  "key_metrics": "추적해야 할 핵심 지표 3-5개, 각 줄 앞에 • 사용 (Korean)",
  "entry_exit": "진입 조건 1-2줄 + 손절 조건 1-2줄 (Korean)",
  "suggested_category": "one of: BTC_TREASURY, AI_INFRA, AI_APP, BIOTECH, SPAC, IPO, ROBOTICS, ENERGY, FINTECH, CRYPTO, SEMI, OTHER",
  "win_prob": 0.45,
  "wl_ratio": 2.5
}

win_prob = estimated probability of thesis playing out (0.1 to 0.9, be conservative)
wl_ratio = potential upside divided by potential downside (0.5 to 10)`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Claude API error:", errText);
      return NextResponse.json({ error: "Claude API failed" }, { status: 502 });
    }

    const data = await response.json();

    // Extract text blocks from response
    const textContent = data.content
      ?.filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");

    // Clean and parse JSON
    const cleaned = textContent.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Generate thesis error:", error);
    return NextResponse.json(
      { error: "Failed to generate thesis" },
      { status: 500 }
    );
  }
}
