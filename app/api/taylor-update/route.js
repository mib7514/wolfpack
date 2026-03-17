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

export async function POST(request) {
  // ─── 관리자 PIN 검증 ───
  const adminPin = process.env.ADMIN_PIN;
  const userPin = request.headers.get("x-admin-pin");
  if (!adminPin || userPin !== adminPin) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다" }, { status: 401 });
  }
  // ─────────────────────────

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  try {
    const prompt = `오늘 날짜 기준으로 아래 한국 경제지표 최신 데이터를 검색해서 JSON으로만 응답해줘. 다른 텍스트 없이 순수 JSON만:
1. 한국은행 기준금리 (현재)
2. 국고채 3년물 금리 (가장 최근 거래일 종가/민평)
3. 한국 소비자물가지수(CPI) 전년동월대비 상승률 (가장 최근 발표)
4. 한국 GDP갭(산출갭) 추정치 (한국은행 추정 또는 최신 전망)
응답 형식:
{
  "date": "2026.03",
  "bok_rate": 2.75,
  "ktb3y": 3.18,
  "cpi_yoy": 2.4,
  "output_gap": 0.4,
  "notes": "간단한 코멘트 1줄 (한국어)"
}
숫자는 % 단위 (예: 2.75는 2.75%).`;

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
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `API ${res.status}: ${errText.slice(0, 200)}` }, { status: 500 });
    }

    const data = await res.json();
    const rawText = (data.content?.filter((b) => b.type === "text") || []).map((b) => b.text).join("\n");
    const parsed = extractJSON(rawText);

    if (!parsed) {
      return NextResponse.json({ error: "JSON 파싱 실패", raw: rawText.slice(0, 300) }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ...parsed });
  } catch (err) {
    console.error("[taylor-update] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
