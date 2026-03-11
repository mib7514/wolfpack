import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "NO_API_KEY" }, { status: 500 });
  }

  let startRank = 1, endRank = 30;
  try {
    const body = await req.json();
    startRank = body.startRank || 1;
    endRank = body.endRank || 30;
  } catch {}

  const count = endRank - startRank + 1;

  // Step 1: Call Claude
  let apiData;
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
          content: `네이버증권에서 코스닥 시가총액 ${startRank}위~${endRank}위 종목 ${count}개를 검색해줘.

JSON 배열만 응답 (설명 없이):
[{"rank":1,"name":"에코프로","code":"086520","cap":230000,"per":-1148,"roe":-12.5,"type":"B","detail":"양극재 영업손실"}]

type: A=GP적자, B=OP적자/GP흑, C=EBITDA적자, D=NI적자/OP흑, E=FCF적자/NI흑, 흑자
cap=시총(억원). ${count}개 전부 포함.`,
        }],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `CLAUDE_${res.status}`, detail: (await res.text()).slice(0, 200) }, { status: 200 });
    }

    apiData = await res.json();
  } catch (e) {
    return NextResponse.json({ error: "FETCH_FAIL", detail: e.message }, { status: 200 });
  }

  // Step 2: Extract text
  let rawText = "";
  try {
    rawText = (apiData.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n");
  } catch (e) {
    return NextResponse.json({ error: "TEXT_EXTRACT_FAIL", detail: e.message, content_types: (apiData.content || []).map(b => b.type) }, { status: 200 });
  }

  if (!rawText) {
    return NextResponse.json({
      error: "NO_TEXT",
      stop_reason: apiData.stop_reason,
      content_types: (apiData.content || []).map(b => b.type),
    }, { status: 200 });
  }

  // Step 3: Parse JSON
  let companies = null;
  try {
    // Try direct parse
    const clean = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    companies = JSON.parse(clean);
  } catch {}

  if (!companies) {
    // Find array in text
    try {
      const arrMatch = rawText.match(/\[[\s\S]*\]/g);
      if (arrMatch) {
        for (const m of arrMatch.sort((a, b) => b.length - a.length)) {
          try { companies = JSON.parse(m); break; } catch {}
        }
      }
    } catch {}
  }

  if (!companies || !Array.isArray(companies)) {
    return NextResponse.json({
      error: "PARSE_FAIL",
      raw_preview: rawText.slice(0, 500),
      raw_length: rawText.length,
    }, { status: 200 });
  }

  // Step 4: Save to Supabase
  try {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (sbUrl && sbKey) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(sbUrl, sbKey);
      const now = new Date().toISOString();
      const rows = companies.map(c => ({
        rank: c.rank || 0, name: c.name || "unknown",
        code: c.code || "", cap: c.cap || 0,
        per: c.per || 0, roe: c.roe || 0,
        type: c.type || "흑자", detail: c.detail || "",
        updated_at: now,
      }));
      const { error: sbErr } = await supabase.from("deficit_companies").upsert(rows, { onConflict: "name" });
      if (sbErr) {
        return NextResponse.json({ ok: true, count: companies.length, companies, sb_warning: sbErr.message });
      }
    }
  } catch (e) {
    return NextResponse.json({ ok: true, count: companies.length, companies, sb_warning: e.message });
  }

  return NextResponse.json({ ok: true, count: companies.length, companies });
}
