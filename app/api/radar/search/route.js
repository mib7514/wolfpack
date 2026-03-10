import { NextResponse } from "next/server";

function extractJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()); } catch {}
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

export async function POST(req) {
  try {
    const { query } = await req.json();
    if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

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
        max_tokens: 4096,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `Search for the stock "${query}" and generate a comprehensive investment thesis.

If this is a ticker symbol, find the company. If it is a company name, find the ticker.
Search for recent news, financial data, analyst opinions.

Return ONLY valid JSON (no markdown, no backticks):
{
  "ticker": "TSLA",
  "exchange": "NASDAQ",
  "name": "Tesla Inc",
  "category": "AI_APP",
  "thesis_oneliner": "한줄 투자 thesis (Korean, max 60 chars)",
  "bull_case": "Bull case 3-4줄 (Korean)",
  "bear_case": "Bear case 3-4줄 (Korean)",
  "catalysts": "향후 12개월 카탈리스트 3-5개, • 사용 (Korean)",
  "key_metrics": "핵심 추적 지표 3-5개, • 사용 (Korean)",
  "entry_exit": "진입 조건 + 손절 조건 (Korean)",
  "suggested_indicators": [
    {"name": "매출 성장률 YoY", "type": "auto", "target": ">20%", "weight": 20},
    {"name": "영업이익률", "type": "auto", "target": ">10%", "weight": 15},
    {"name": "PER 합리성", "type": "auto", "target": "<40x", "weight": 10},
    {"name": "경쟁우위 유지", "type": "manual", "target": "Moat 건재", "weight": 15},
    {"name": "카탈리스트 진행", "type": "manual", "target": "On track", "weight": 20},
    {"name": "시장 센티먼트", "type": "manual", "target": "긍정적", "weight": 10},
    {"name": "리스크 관리", "type": "manual", "target": "통제 가능", "weight": 10}
  ],
  "win_prob": 0.45,
  "wl_ratio": 2.5
}

category must be one of: BTC_TREASURY, AI_INFRA, AI_APP, BIOTECH, SPAC, IPO, ROBOTICS, ENERGY, FINTECH, CRYPTO, SEMI, OTHER
suggested_indicators: 7개 내외, weight 합계 = 100, type은 auto(데이터로 확인) 또는 manual(주관적 판단)`
        }]
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Search failed" }, { status: 502 });
    }

    const data = await res.json();
    const text = (data.content?.filter(b => b.type === "text") || []).map(b => b.text).join("");
    const parsed = extractJSON(text);

    if (!parsed) {
      return NextResponse.json({ error: "Failed to parse result" }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (e) {
    console.error("Search error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
