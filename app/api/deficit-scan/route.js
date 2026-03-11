import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function extractJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()); } catch {}
  // Find array
  const arrMatch = text.match(/\[[\s\S]*\]/g);
  if (arrMatch) {
    for (const m of arrMatch.sort((a, b) => b.length - a.length)) {
      try { const p = JSON.parse(m); if (Array.isArray(p)) return p; } catch {}
    }
  }
  // Find object with companies
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
        if (ch === "}") {
          depth--;
          if (depth === 0) {
            try {
              const p = JSON.parse(text.slice(i, j + 1));
              if (p.companies && Array.isArray(p.companies)) return p.companies;
              if (p.data && Array.isArray(p.data)) return p.data;
            } catch {}
            break;
          }
        }
      }
    }
  }
  return null;
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  let body = {};
  try { body = await req.json(); } catch {}
  const startRank = body.startRank || 1;
  const endRank = body.endRank || 50;

  try {
    const prompt = `코스닥(KOSDAQ) 시가총액 순위 ${startRank}위~${endRank}위 기업 목록을 검색해줘.

네이버증권에서 "코스닥 시가총액 순위"를 검색해서 ${startRank}~${endRank}위를 찾아줘.

각 기업별로:
1. rank: 시총 순위
2. name: 종목명
3. code: 종목코드 (6자리)
4. cap: 시가총액 (억원)
5. per: PER (적자면 음수, 없으면 0)
6. roe: ROE (%, 없으면 0)
7. type: 적자유형 분류
   - "A": 매출총이익 적자 (팔수록 손해)
   - "B": 영업이익 적자이나 GP 흑자 (성장 투자 초과)
   - "C": EBITDA 적자 (현금 소각)
   - "D": 순이익 적자이나 영업이익 흑자 (일회성/재무구조)
   - "E": FCF 적자이나 순이익 흑자 (대규모 Capex)
   - "흑자": 전구간 흑자
8. detail: 적자 원인 또는 사업 한줄 (Korean, 30자 이내)

IMPORTANT: JSON 배열만 응답. 설명 없이 배열만:
[{"rank":${startRank},"name":"종목명","code":"000000","cap":100000,"per":0,"roe":0,"type":"흑자","detail":"설명"}]

${endRank - startRank + 1}개 종목 포함.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
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
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `API ${res.status}: ${errText.slice(0, 200)}` }, { status: 500 });
    }

    const data = await res.json();
    const text = (data.content?.filter(b => b.type === "text") || []).map(b => b.text).join("\n");
    const companies = extractJSON(text);

    if (!companies || !Array.isArray(companies) || companies.length === 0) {
      return NextResponse.json({ error: "파싱 실패", raw: text.slice(0, 300) }, { status: 500 });
    }

    // Save to Supabase
    const supabase = getSupabase();
    const now = new Date().toISOString();
    const rows = companies.map(c => ({
      rank: c.rank || 0,
      name: c.name,
      code: c.code || "",
      cap: c.cap || 0,
      per: c.per || 0,
      roe: c.roe || 0,
      type: c.type || "흑자",
      detail: c.detail || "",
      updated_at: now,
    }));

    await supabase.from("deficit_companies").upsert(rows, { onConflict: "name" });

    return NextResponse.json({
      ok: true,
      count: companies.length,
      companies: companies,
      batch: `${startRank}-${endRank}`,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
