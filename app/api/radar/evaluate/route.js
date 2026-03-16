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
    const { ticker, exchange, name, indicators, kelly_win_prob, kelly_wl_ratio } = await req.json();
    if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key not set" }, { status: 500 });

    const indicatorList = (indicators || []).map((ind, i) =>
      `${i+1}. ${ind.name} (가중치 ${ind.weight}%):\n${(ind.sub_indicators || []).map(s =>
        `   - ${s.name} (목표: ${s.target}, 이전 점수: ${s.score ?? "N/A"})`).join("\n")}`
    ).join("\n");

    const prevKelly = kelly_win_prob && kelly_wl_ratio
      ? `\n현재 켈리 파라미터: 승률=${kelly_win_prob}, 승패비=${kelly_wl_ratio}`
      : "";

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
          content: `${ticker} (${exchange}, ${name || ""}) 종목의 모니터링 지표를 웹 검색으로 재평가해줘.

현재 모니터링 지표:
${indicatorList}
${prevKelly}

각 세부지표를 웹검색으로 최신 데이터 확인 후 0-100점으로 재평가해줘.
또한 기술적 모멘텀도 확인해줘:
- 현재가, 52주 최고가
- 5일, 20일, 60일, 120일 이동평균선 (대략적 수치)
- 이평선 정배열(5>20>60>120) 여부
- 120일선 상승추세 여부

또한 업데이트된 평가를 기반으로 켈리 공식 파라미터를 재계산해줘:
- kelly_win_prob (승률 0.0-1.0): 업데이트된 모니터링 점수 수준, 기술적 모멘텀(정배열/역배열, 120일선 추세), 카탈리스트 진행 상황, 현재가의 52주 고점 대비 위치 등을 종합적으로 반영
- kelly_wl_ratio (승패비 1.0-5.0): 현재가 대비 목표가(상승여력)와 손절가(하락위험)의 비율, 밸류에이션 매력도, 최근 주가 모멘텀 방향 등을 반영

IMPORTANT: 주가가 크게 올랐으면 상승여력이 줄어들어 kelly_wl_ratio가 낮아져야 하고, 주가가 빠졌으면 상승여력이 커져 kelly_wl_ratio가 높아져야 해. 반드시 현재 주가 수준을 반영해서 동적으로 재계산할 것.

IMPORTANT: 반드시 JSON만 응답:
{
  "indicators": [
    {
      "name": "지표명",
      "weight": 20,
      "sub_indicators": [
        {"name": "세부지표명", "target": "목표", "current": "현재 상태 설명", "score": 75}
      ]
    }
  ],
  "momentum": {
    "current_price": 0,
    "high_52w": 0,
    "ma5": 0,
    "ma20": 0,
    "ma60": 0,
    "ma120": 0,
    "ma_aligned": true,
    "ma120_trend": "up"
  },
  "kelly_win_prob": 0.45,
  "kelly_wl_ratio": 2.5,
  "kelly_reasoning": "켈리 파라미터 변경 근거 한줄 (Korean)",
  "summary": "한줄 평가 요약 (Korean)",
  "evaluated_at": "2026-03-17"
}`
        }]
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const msg = errBody?.error?.message || errBody?.message || `API error ${res.status}`;
      console.error("Radar evaluate API error:", res.status, msg);
      return NextResponse.json({ error: `Evaluate failed: ${msg}` }, { status: 502 });
    }

    const data = await res.json();
    const allText = (data.content?.filter(b => b.type === "text") || []).map(b => b.text).join("\n");
    const parsed = extractJSON(allText);

    if (!parsed) return NextResponse.json({ error: "Parse failed" }, { status: 500 });

    return NextResponse.json(parsed);
  } catch (e) {
    console.error("Radar evaluate error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
