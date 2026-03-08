import { NextResponse } from "next/server";

const TOP10_NAMES = [
  "서진시스템", "에코프로비엠", "에코프로", "태성", "테크윙",
  "성호전자", "로보티즈", "하나마이크론", "알지노믹스", "원익홀딩스",
];

const TOP10_CODES = {
  "서진시스템": "178320", "에코프로비엠": "247540", "에코프로": "086520",
  "태성": "045390", "테크윙": "089030", "성호전자": "043260",
  "로보티즈": "108490", "하나마이크론": "067310", "알지노믹스": "536560",
  "원익홀딩스": "030530",
};

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      news: "⚠️ ANTHROPIC_API_KEY가 설정되지 않았습니다.",
      momentum: null,
    });
  }

  try {
    // ── Step 1: 모멘텀 데이터 수집 ──
    const momentumRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `아래 코스닥 종목 10개의 기술적 데이터를 검색해서 JSON으로 정리해줘.
각 종목마다 네이버증권이나 다음금융 등에서 검색해서 아래 데이터를 수집해:

종목 리스트 (종목코드):
${TOP10_NAMES.map(n => `- ${n} (${TOP10_CODES[n]})`).join("\n")}

각 종목별로 수집할 데이터:
1. currentPrice: 현재가 (원)
2. high52w: 52주 최고가 (원)
3. ma20: 20일 이동평균선 (원, 대략적 수치)
4. ma60: 60일 이동평균선 (원, 대략적 수치)
5. ma120: 120일 이동평균선 (원, 대략적 수치)
6. ma120_prev: 한달 전 120일 이동평균선 대비 현재 방향 (up/flat/down)
7. volume5d: 최근 5일 평균 거래량
8. volume20d: 최근 20일 평균 거래량

정확한 수치를 모르면 검색 결과에서 추정해도 괜찮아. 검색이 안 되는 종목은 null로.

반드시 아래 JSON 형식으로만 응답해. 다른 텍스트 없이 JSON만:
{
  "data": [
    {
      "name": "종목명",
      "currentPrice": 숫자,
      "high52w": 숫자,
      "ma20": 숫자,
      "ma60": 숫자,
      "ma120": 숫자,
      "ma120dir": "up|flat|down",
      "volume5d": 숫자,
      "volume20d": 숫자
    }
  ],
  "dataDate": "2026-03-08"
}`,
        }],
      }),
    });

    const momentumData = await momentumRes.json();
    let parsedMomentum = null;

    if (momentumData.content) {
      const textBlocks = momentumData.content.filter(b => b.type === "text").map(b => b.text);
      const fullText = textBlocks.join("\n");

      // JSON 추출 시도
      const jsonMatch = fullText.match(/\{[\s\S]*"data"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const cleaned = jsonMatch[0].replace(/```json|```/g, "").trim();
          parsedMomentum = JSON.parse(cleaned);
        } catch (e) {
          // JSON 파싱 실패 시 텍스트에서 다시 시도
          try {
            const bracketStart = fullText.indexOf("{");
            const bracketEnd = fullText.lastIndexOf("}");
            if (bracketStart >= 0 && bracketEnd > bracketStart) {
              parsedMomentum = JSON.parse(fullText.slice(bracketStart, bracketEnd + 1));
            }
          } catch (e2) { /* 파싱 불가 */ }
        }
      }
    }

    // 모멘텀 스코어 계산
    let momentumScores = null;
    if (parsedMomentum?.data) {
      momentumScores = parsedMomentum.data.map(stock => {
        if (!stock || !stock.currentPrice) return { name: stock?.name, error: true };

        const pct52wHigh = stock.high52w > 0 ? stock.currentPrice / stock.high52w : 0;

        // 이평선 정배열 판정: 20 > 60 > 120
        let maAlign = "none";
        if (stock.ma20 && stock.ma60 && stock.ma120) {
          if (stock.ma20 > stock.ma60 && stock.ma60 > stock.ma120) maAlign = "full";
          else if (stock.ma20 > stock.ma120 || stock.ma60 > stock.ma120) maAlign = "partial";
        }

        const ma120dir = stock.ma120dir || "flat";

        const volRatio = (stock.volume5d && stock.volume20d && stock.volume20d > 0)
          ? Math.round((stock.volume5d / stock.volume20d) * 100) / 100
          : 1.0;

        // 스코어 계산 (20점 만점)
        const s1 = Math.min(6, Math.round(pct52wHigh * 6 * 10) / 10);
        const s2 = maAlign === "full" ? 6 : maAlign === "partial" ? 3 : 0;
        const s3 = ma120dir === "up" ? 4 : ma120dir === "flat" ? 0 : -3;
        const s4 = Math.min(4, Math.round(Math.max(0, (volRatio - 0.8)) * 5 * 10) / 10);
        const momScore = Math.round((s1 + s2 + s3 + s4) * 10) / 10;

        return {
          name: stock.name,
          currentPrice: stock.currentPrice,
          high52w: stock.high52w,
          pct52wHigh: Math.round(pct52wHigh * 1000) / 10,
          ma20: stock.ma20,
          ma60: stock.ma60,
          ma120: stock.ma120,
          maAlign,
          ma120dir,
          volume5d: stock.volume5d,
          volume20d: stock.volume20d,
          volRatio,
          scores: { s1, s2, s3, s4 },
          momScore,
        };
      });
    }

    // ── Step 2: 뉴스 업데이트 (병렬 가능하지만 순차로 안전하게) ──
    const newsRes = await fetch("https://api.anthropic.com/v1/messages", {
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
        messages: [{
          role: "user",
          content: `오늘 날짜 기준 아래 코스닥 종목들의 최신 뉴스를 검색해줘.
최근 1주일 내 실적 발표, 중요 공시, 주가 급등락 위주로 핵심만 한국어 300자 이내:
${TOP10_NAMES.join(", ")}`,
        }],
      }),
    });

    const newsData = await newsRes.json();
    const newsText = newsData.content
      ?.filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n") || "뉴스 검색 결과 없음";

    return NextResponse.json({
      news: newsText,
      momentum: momentumScores,
      dataDate: parsedMomentum?.dataDate || new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString(),
    });

  } catch (e) {
    return NextResponse.json({ error: e.message, news: null, momentum: null }, { status: 500 });
  }
}
