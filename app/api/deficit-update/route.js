import { NextResponse } from "next/server";

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      result: "⚠️ ANTHROPIC_API_KEY가 설정되지 않았습니다.\nVercel Dashboard → Settings → Environment Variables에서 추가해주세요."
    });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [
          {
            role: "user",
            content: `오늘 날짜 기준 코스닥 시장의 주요 적자기업 관련 최신 뉴스를 검색해줘.
아래 종목들 중 최근 1주일 내 실적 발표, 중요 공시, 주가 급등락이 있었던 기업을 알려줘.
응답은 한국어로, 핵심만 간결하게 300자 이내:

에코프로, 에코프로비엠, 테크윙, 로보티즈, 서진시스템, 태성, 성호전자, 하나마이크론, 알지노믹스, 원익홀딩스`,
          },
        ],
      }),
    });

    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message });
    }

    const text = data.content
      ?.filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return NextResponse.json({ result: text || "결과 없음" });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
