import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function extractJSON(text) {
  if (!text) return null;
  // Try array first
  try { return JSON.parse(text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()); } catch {}
  // Find largest array
  const arrMatch = text.match(/\[[\s\S]*\]/g);
  if (arrMatch) {
    for (const m of arrMatch.sort((a, b) => b.length - a.length)) {
      try { return JSON.parse(m); } catch {}
    }
  }
  // Find object with data array
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
        if (ch === "}") { depth--; if (depth === 0) { try { const p = JSON.parse(text.slice(i, j+1)); if (p.companies) return p.companies; return p; } catch {} break; } }
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

async function scanBatch(apiKey, startRank, endRank) {
  const prompt = `코스닥(KOSDAQ) 시가총액 순위 ${startRank}위~${endRank}위 기업 목록을 검색해줘.

네이버증권이나 KRX에서 코스닥 시가총액 상위 종목을 검색해서, ${startRank}~${endRank}위를 찾아줘.

각 기업별로:
1. rank: 시총 순위
2. name: 종목명
3. code: 종목코드 (6자리)
4. cap: 시가총액 (억원)
5. per: PER (적자면 음수)
6. roe: ROE (%)
7. type: 적자유형 분류
   - "A": 매출총이익 적자 (팔수록 손해)
   - "B": 영업이익 적자이나 GP 흑자 (성장 투자 초과)
   - "C": EBITDA 적자 (현금 소각)
   - "D": 순이익 적자이나 영업이익 흑자 (일회성/재무구조)
   - "E": FCF 적자이나 순이익 흑자 (대규모 Capex)
   - "흑자": 전구간 흑자
8. detail: 적자 원인 또는 사업 상황 한줄 설명 (Korean, 40자 이내)

IMPORTANT: JSON 배열만 응답. 다른 텍스트 없이:
[
  {"rank":1,"name":"에코프로","code":"086520","cap":230000,"per":-1148.65,"roe":-12.57,"type":"B","detail":"양극재 영업손실. GP 유지. 사이클릭 적자"},
  {"rank":2,"name":"알테오젠","code":"196170","cap":199000,"per":158.86,"roe":29.52,"type":"흑자","detail":"ADC 플랫폼 라이선싱 흑자"}
]

반드시 ${endRank - startRank + 1}개 종목을 포함해줘. 정확하지 않으면 추정치도 괜찮아.`;

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

  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  const text = (data.content?.filter(b => b.type === "text") || []).map(b => b.text).join("\n");
  const parsed = extractJSON(text);
  return Array.isArray(parsed) ? parsed : [];
}

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const supabase = getSupabase();
  const allCompanies = [];
  const errors = [];

  try {
    // 3 batches: 1-50, 51-100, 101-150
    for (const [start, end] of [[1, 50], [51, 100], [101, 150]]) {
      try {
        const batch = await scanBatch(apiKey, start, end);
        allCompanies.push(...batch);
      } catch (e) {
        errors.push(`${start}-${end}: ${e.message}`);
      }
    }

    if (allCompanies.length === 0) {
      return NextResponse.json({ error: "스캔 실패", errors }, { status: 500 });
    }

    // Re-rank by cap descending
    allCompanies.sort((a, b) => (b.cap || 0) - (a.cap || 0));
    allCompanies.forEach((c, i) => { c.rank = i + 1; });

    // Save to Supabase
    const now = new Date().toISOString();

    // Clear old data and insert new
    await supabase.from("deficit_companies").delete().neq("rank", -1); // delete all
    
    // Insert in chunks of 50
    for (let i = 0; i < allCompanies.length; i += 50) {
      const chunk = allCompanies.slice(i, i + 50).map(c => ({
        rank: c.rank,
        name: c.name,
        code: c.code || "",
        cap: c.cap || 0,
        per: c.per || 0,
        roe: c.roe || 0,
        type: c.type || "흑자",
        detail: c.detail || "",
        updated_at: now,
      }));
      await supabase.from("deficit_companies").upsert(chunk, { onConflict: "name" });
    }

    return NextResponse.json({
      ok: true,
      count: allCompanies.length,
      companies: allCompanies,
      errors: errors.length > 0 ? errors : undefined,
      updatedAt: now,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message, partial: allCompanies.length, errors }, { status: 500 });
  }
}
