import { NextResponse } from "next/server";

function extractJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()); } catch {}
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      let depth = 0, inStr = false, esc = false;
      for (let j = i; j < text.length; j++) {
        const ch = text[j];
        if (esc) { esc = false; continue; }
        if (ch === "\\") { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === "{") depth++;
        if (ch === "}") { depth--; if (depth === 0) { try { return JSON.parse(text.slice(i, j+1)); } catch {} break; } }
      }
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
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
        messages: [{
          role: "user",
          content: `"${query}" 종목을 웹검색해서 투자 분석해줘. US/KR/HK/JP 등 글로벌 거래소 지원.

반드시 JSON만 응답 (마크다운/백틱 없이):
{
  "ticker": "CPNG",
  "exchange": "NYSE",
  "name": "Coupang",
  "category": "카테고리",
  "thesis_oneliner": "핵심 투자 thesis 한줄 (Korean, max 60자)",
  "thesis_detail": {
    "core_thesis": "왜 지금 이 종목인지 3-5줄 (Korean)",
    "bull_case": "강세 시나리오 3줄 (Korean)",
    "bear_case": "약세 시나리오 3줄 (Korean)",
    "catalysts": "카탈리스트 3-5개 • 구분 (Korean)",
    "key_metrics": "핵심 지표 3-5개 • 구분 (Korean)"
  },
  "momentum": {
    "current_price": 0, "high_52w": 0,
    "ma5": 0, "ma20": 0, "ma60": 0, "ma120": 0,
    "ma_aligned": true, "ma120_trend": "up"
  },
  "monitoring_indicators": [
    {
      "name": "지표명", "weight": 20,
      "sub_indicators": [
        {"name": "세부지표", "target": "목표", "current": "현재", "score": 75}
      ]
    }
  ],
  "kelly_win_prob": 0.45,
  "kelly_wl_ratio": 2.5
}

규칙:
- category: BTC_TREASURY/AI_INFRA/AI_APP/BIOTECH/SPAC/IPO/ROBOTICS/ENERGY/FINTECH/CRYPTO/SEMI/OTHER
- monitoring_indicators 5-7개, 각 sub_indicators 3-5개, weight합=100, score 0-100
- momentum: 웹검색 실제 데이터
- kelly_win_prob(0-1): 점수+모멘텀+카탈리스트 종합 승률
- kelly_wl_ratio(1-5): 목표가/손절가 비율 기반 승패비`
        }]
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const msg = errBody?.error?.message || errBody?.message || `API error ${res.status}`;
      console.error("Radar search API error:", res.status, msg);
      return NextResponse.json({ error: `Search failed: ${msg}` }, { status: 502 });
    }

    const data = await res.json();
    const allText = (data.content?.filter(b => b.type === "text") || []).map(b => b.text).join("\n");
    const parsed = extractJSON(allText);

    if (!parsed) return NextResponse.json({ error: "Failed to parse result" }, { status: 500 });

    return NextResponse.json(parsed);
  } catch (e) {
    console.error("Radar search error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
