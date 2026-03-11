import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function extractJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()); } catch {}
  const arrMatch = text.match(/\[[\s\S]*\]/g);
  if (arrMatch) {
    for (const m of arrMatch.sort((a, b) => b.length - a.length)) {
      try { const p = JSON.parse(m); if (Array.isArray(p)) return p; } catch {}
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
  const endRank = body.endRank || 30;
  const count = endRank - startRank + 1;

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
        max_tokens: 8000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `네이버증권에서 코스닥 시가총액 ${startRank}위~${endRank}위 종목을 검색해줘.

각 종목: rank, name, code(6자리), cap(억원), per, roe, type(적자유형: A=GP적자, B=OP적자/GP흑, C=EBITDA적자, D=NI적자/OP흑, E=FCF적자/NI흑, 흑자), detail(한줄 30자)

JSON 배열만 응답:
[{"rank":${startRank},"name":"종목명","code":"000000","cap":0,"per":0,"roe":0,"type":"흑자","detail":"설명"}]

${count}개 종목. 설명 없이 JSON만.`,
        }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `API ${res.status}: ${errText.slice(0, 100)}` }, { status: 500 });
    }

    const data = await res.json();
    const text = (data.content?.filter(b => b.type === "text") || []).map(b => b.text).join("\n");
    const companies = extractJSON(text);

    if (!companies || !Array.isArray(companies) || companies.length === 0) {
      return NextResponse.json({ error: "파싱 실패", raw: text.slice(0, 200) }, { status: 500 });
    }

    // Save to Supabase
    const supabase = getSupabase();
    const now = new Date().toISOString();
    const rows = companies.map(c => ({
      rank: c.rank || 0, name: c.name, code: c.code || "",
      cap: c.cap || 0, per: c.per || 0, roe: c.roe || 0,
      type: c.type || "흑자", detail: c.detail || "", updated_at: now,
    }));
    await supabase.from("deficit_companies").upsert(rows, { onConflict: "name" });

    return NextResponse.json({ ok: true, count: companies.length, companies });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
