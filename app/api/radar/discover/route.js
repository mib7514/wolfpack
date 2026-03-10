// app/api/radar/discover/route.js
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { theme } = await req.json();
    if (!theme) return NextResponse.json({ error: "theme required" }, { status: 400 });

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
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `You are a growth stock scout. Search the web for the most interesting speculative growth stocks related to the theme: "${theme}"

Focus on:
- Recently IPO'd or SPAC-merged companies (last 12 months)
- Small/mid cap with high upside potential  
- Companies getting attention on social media, Reddit, fintwit
- Stocks trading at interesting valuations (deep discount to NAV, high short interest, unusual volume)
- Both US and global markets (Hong Kong, Korea, Japan, Europe)

Return ONLY a valid JSON array (no markdown, no backticks, no preamble). Each element:
{
  "ticker": "XXI",
  "exchange": "NYSE",
  "name": "Twenty One Capital",
  "category": "BTC_TREASURY",
  "thesis_oneliner": "NAV 31% 할인 BTC proxy (Korean, max 60 chars)",
  "bull_case": "Bull case 2-3줄 (Korean)",
  "bear_case": "Bear case 2-3줄 (Korean)",
  "catalysts": "카탈리스트 2-3개 • 사용 (Korean)",
  "key_metrics": "핵심 지표 2-3개 • 사용 (Korean)",
  "entry_exit": "진입/손절 조건 (Korean)",
  "win_prob": 0.45,
  "wl_ratio": 2.5,
  "heat": 8
}

heat = 1~10 how "hot" this stock is right now (buzz, momentum, timeliness)
category must be one of: BTC_TREASURY, AI_INFRA, AI_APP, BIOTECH, SPAC, IPO, ROBOTICS, ENERGY, FINTECH, CRYPTO, SEMI, OTHER

Return 5-8 stocks, ranked by heat descending. Be creative — find genuinely interesting, non-obvious picks.`
        }]
      }),
    });

    if (!res.ok) {
      console.error("Claude API error:", await res.text());
      return NextResponse.json({ error: "Claude API failed" }, { status: 502 });
    }

    const data = await res.json();
    const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(Array.isArray(parsed) ? parsed : [parsed]);
  } catch (e) {
    console.error("Discover error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
