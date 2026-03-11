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

function extractText(content) {
  if (!content) return "";
  if (Array.isArray(content)) return content.filter(b => b.type === "text").map(b => b.text).join("\n");
  return String(content);
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ news: "⚠️ ANTHROPIC_API_KEY가 설정되지 않았습니다.", momentum: null });
  }

  let body = {};
  try { body = await req.json(); } catch {}
  const names = body.names || [];
  const codes = body.codes || {};

  if (names.length === 0) {
    return NextResponse.json({ news: "⚠️ 종목 리스트가 비어있습니다.", momentum: null });
  }

  try {
    // ── Step 1: 모멘텀 데이터 수집 ──
    const stockList = names.map(n => `- ${n} (${codes[n] || ""})`).join("\n");

    const momentumRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `아래 코스닥 종목들의 기술적 데이터를 네이버증권에서 검색해서 JSON으로 정리해줘.

종목 리스트:
${stockList}

각 종목별 수집:
1. currentPrice: 현재가(원)
2. high52w: 52주 최고가(원)
3. ma20, ma60, ma120: 이동평균선(원)
4. ma120dir: 120일선 방향(up/flat/down)
5. volume5d, volume20d: 평균 거래량

추정치도 괜찮아. 검색 안 되면 null.

IMPORTANT: 반드시 아래 JSON만 응답. 다른 텍스트 없이:
{"data":[{"name":"종목명","currentPrice":0,"high52w":0,"ma20":0,"ma60":0,"ma120":0,"ma120dir":"up","volume5d":0,"volume20d":0}],"dataDate":"2026-03-11"}`,
        }],
      }),
    });

    const momentumData = await momentumRes.json();
    const momentumText = extractText(momentumData.content);
    const parsedMomentum = extractJSON(momentumText);

    let momentumScores = null;
    if (parsedMomentum?.data) {
      momentumScores = parsedMomentum.data.map(stock => {
        if (!stock?.currentPrice) return { name: stock?.name, error: true };
        const pct52wHigh = stock.high52w > 0 ? stock.currentPrice / stock.high52w : 0;
        let maAlign = "none";
        if (stock.ma20 && stock.ma60 && stock.ma120) {
          if (stock.ma20 > stock.ma60 && stock.ma60 > stock.ma120) maAlign = "full";
          else if (stock.ma20 > stock.ma120 || stock.ma60 > stock.ma120) maAlign = "partial";
        }
        const volRatio = (stock.volume5d && stock.volume20d && stock.volume20d > 0) ? Math.round((stock.volume5d / stock.volume20d) * 100) / 100 : 1.0;
        const s1 = Math.min(6, Math.round(pct52wHigh * 6 * 10) / 10);
        const s2 = maAlign === "full" ? 6 : maAlign === "partial" ? 3 : 0;
        const s3 = (stock.ma120dir || "flat") === "up" ? 4 : stock.ma120dir === "flat" ? 0 : -3;
        const s4 = Math.min(4, Math.round(Math.max(0, (volRatio - 0.8)) * 5 * 10) / 10);
        return {
          name: stock.name, currentPrice: stock.currentPrice, high52w: stock.high52w,
          pct52wHigh: Math.round(pct52wHigh * 1000) / 10,
          maAlign, ma120dir: stock.ma120dir || "flat", volRatio,
          scores: { s1, s2, s3, s4 },
          momScore: Math.round((s1 + s2 + s3 + s4) * 10) / 10,
        };
      });
    }

    // ── Step 2: 뉴스 ──
    const newsRes = await fetch("https://api.anthropic.com/v1/messages", {
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
          content: `오늘 날짜 기준, 아래 코스닥 종목들의 최근 1주일 뉴스를 검색해줘. 실적, 공시, 주가 급등락 위주로 한국어 요약 400자 이내. 뉴스가 없으면 "특이사항 없음"이라고 적어줘.
종목: ${names.slice(0, 10).join(", ")}`,
        }],
      }),
    });

    const newsData = await newsRes.json();
    const newsText = extractText(newsData.content) || "뉴스 검색 결과 없음";

    return NextResponse.json({
      news: newsText,
      momentum: momentumScores,
      dataDate: parsedMomentum?.dataDate || new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message, news: "API 오류: " + e.message, momentum: null }, { status: 500 });
  }
}
