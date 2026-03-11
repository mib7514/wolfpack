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
        max_tokens: 8000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `Search for the stock "${query}".

This could be:
- A US stock (NASDAQ, NYSE, AMEX)
- A Korean stock (KRX KOSPI/KOSDAQ) — search 네이버증권
- A Hong Kong stock (HKEX) — search with .HK suffix or HKEX
- A Japanese stock (TSE)
- Any other global exchange

Find the company, then generate a DETAILED INVESTMENT THESIS (not a company overview).

The thesis should focus on:
- WHY this is an investment opportunity NOW
- What specific asymmetric risk/reward exists
- What the market is mispricing or missing
- Concrete catalysts with timelines

Also look up the stock's current technical data:
- Current price, 52-week high
- 5-day, 20-day, 60-day, 120-day moving averages (approximate)
- Whether moving averages are in bullish alignment (5>20>60>120)
- Whether 120-day MA is trending up/flat/down

Generate 5-7 monitoring indicators, each with 3-5 sub-indicators for detailed evaluation.
Each sub-indicator should be auto-evaluatable through web search or financial data.

IMPORTANT: Return ONLY valid JSON, no markdown, no backticks:
{
  "ticker": "9618.HK",
  "exchange": "HKEX",
  "name": "JD.com",
  "category": "AI_APP",
  "thesis_oneliner": "투자 thesis 핵심 한줄 (Korean, max 60 chars)",
  "thesis_detail": {
    "core_thesis": "핵심 투자 thesis 3-5줄. 왜 지금 이 종목인지. 시장이 놓치고 있는 것. (Korean)",
    "bull_case": "강세 시나리오 3-4줄. 구체적 수치와 타임라인 포함. (Korean)",
    "bear_case": "약세 시나리오 3-4줄. 구체적 리스크와 확률. (Korean)",
    "catalysts": "향후 12개월 카탈리스트 3-5개 • 구분자 사용 (Korean)",
    "key_metrics": "핵심 추적 지표 3-5개 • 구분자 사용 (Korean)"
  },
  "momentum": {
    "current_price": 150.50,
    "high_52w": 200.00,
    "ma5": 148.0,
    "ma20": 145.0,
    "ma60": 140.0,
    "ma120": 135.0,
    "ma_aligned": true,
    "ma120_trend": "up"
  },
  "monitoring_indicators": [
    {
      "name": "매출 성장 모멘텀",
      "weight": 20,
      "sub_indicators": [
        {"name": "최근 분기 QoQ 매출 성장률", "target": ">10%", "current": "+15%", "score": 80},
        {"name": "연간 YoY 매출 성장률", "target": ">20%", "current": "+25%", "score": 75},
        {"name": "컨센서스 대비 서프라이즈", "target": "Beat", "current": "Beat 5%", "score": 85}
      ]
    },
    {
      "name": "수익성 개선",
      "weight": 15,
      "sub_indicators": [
        {"name": "영업이익률 추이", "target": "개선", "current": "12%→15%", "score": 80},
        {"name": "FCF 마진", "target": ">5%", "current": "8%", "score": 75},
        {"name": "비용 구조 효율화", "target": "진행 중", "current": "SGA 비율 감소", "score": 70}
      ]
    },
    {
      "name": "경쟁우위 & Moat",
      "weight": 15,
      "sub_indicators": [
        {"name": "시장점유율 변화", "target": "유지/확대", "current": "확대 중", "score": 75},
        {"name": "진입장벽 강도", "target": "높음", "current": "높음", "score": 80},
        {"name": "고객 전환비용", "target": "높음", "current": "중간", "score": 60}
      ]
    },
    {
      "name": "카탈리스트 진행도",
      "weight": 20,
      "sub_indicators": [
        {"name": "핵심 카탈리스트 1 진행", "target": "On track", "current": "구체적 상황", "score": 70},
        {"name": "핵심 카탈리스트 2 진행", "target": "On track", "current": "구체적 상황", "score": 65},
        {"name": "신규 카탈리스트 출현", "target": "있음", "current": "구체적 내용", "score": 60}
      ]
    },
    {
      "name": "밸류에이션",
      "weight": 15,
      "sub_indicators": [
        {"name": "PER 대비 성장률 (PEG)", "target": "<1.5", "current": "1.2", "score": 75},
        {"name": "섹터 평균 대비 할인율", "target": "할인", "current": "-20%", "score": 80},
        {"name": "EV/EBITDA 합리성", "target": "<15x", "current": "12x", "score": 75}
      ]
    },
    {
      "name": "기술적 모멘텀",
      "weight": 15,
      "sub_indicators": [
        {"name": "이평선 정배열 여부", "target": "정배열", "current": "5>20>60>120 여부", "score": 70},
        {"name": "120일선 상승추세", "target": "상승", "current": "up/flat/down", "score": 65},
        {"name": "52주 고점 대비 위치", "target": ">80%", "current": "75%", "score": 60},
        {"name": "거래량 추이", "target": "증가", "current": "5일/20일 비율", "score": 55}
      ]
    }
  ],
  "kelly_win_prob": 0.45,
  "kelly_wl_ratio": 2.5
}

category: BTC_TREASURY, AI_INFRA, AI_APP, BIOTECH, SPAC, IPO, ROBOTICS, ENERGY, FINTECH, CRYPTO, SEMI, OTHER
monitoring_indicators weight 합계 = 100
sub_indicators score: 0-100, 현재 상태 기반으로 객관적 평가
momentum: 웹검색으로 실제 데이터 반영`
        }]
      }),
    });

    if (!res.ok) return NextResponse.json({ error: "Search failed" }, { status: 502 });

    const data = await res.json();
    const allText = (data.content?.filter(b => b.type === "text") || []).map(b => b.text).join("\n");
    const parsed = extractJSON(allText);

    if (!parsed) return NextResponse.json({ error: "Failed to parse result" }, { status: 500 });

    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
