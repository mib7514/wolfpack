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
    // ─── 관리자 PIN 검증 ───
    const adminPin = process.env.ADMIN_PIN;
    const userPin = req.headers.get("x-admin-pin");
    if (!adminPin || userPin !== adminPin) {
      return NextResponse.json({ error: "관리자 인증이 필요합니다" }, { status: 401 });
    }
    // ─────────────────────────

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

    const requestBody = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{
        role: "user",
        content: `${ticker} (${exchange}, ${name || ""}) 종목의 모니터링 지표를 웹 검색으로 재평가해줘.

현재 모니터링 지표:
${indicatorList}
${prevKelly}

각 세부지표를 웹검색으로 최신 데이터 확인 후 0-100점으로 재평가.
기술적 모멘텀: 현재가, 52주 고가, 5/20/60/120일 이평선, 정배열 여부, 120일선 추세.
켈리 재계산: kelly_win_prob(0-1), kelly_wl_ratio(1-5). 주가 상승→상승여력↓→wl_ratio↓.

JSON만 응답:
{"indicators":[{"name":"","weight":20,"sub_indicators":[{"name":"","target":"","current":"","score":75}]}],"momentum":{"current_price":0,"high_52w":0,"ma5":0,"ma20":0,"ma60":0,"ma120":0,"ma_aligned":true,"ma120_trend":"up"},"kelly_win_prob":0.45,"kelly_wl_ratio":2.5,"kelly_reasoning":"한줄근거","summary":"한줄요약","evaluated_at":"2026-03-18"}`
      }]
    });

    // ── API 호출 (429 시 1회 재시도) ──
    async function callAPI() {
      return fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: requestBody,
      });
    }

    let res = await callAPI();

    // Rate limit (429) → 10초 대기 후 1회 재시도
    if (res.status === 429) {
      console.log("Rate limited, retrying in 10s...");
      await new Promise(r => setTimeout(r, 10000));
      res = await callAPI();
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const msg = errBody?.error?.message || errBody?.message || `API error ${res.status}`;
      console.error("Radar evaluate API error:", res.status, msg);
      const userMsg = res.status === 429
        ? "API 사용량 한도 초과입니다. 1분 후 다시 시도해주세요."
        : `평가 실패: ${msg}`;
      return NextResponse.json({ error: userMsg }, { status: 502 });
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
