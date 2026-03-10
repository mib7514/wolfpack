import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { VALUATION_AI_PROMPT } from "@/lib/valuation-constants";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function extractJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()); } catch {}
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

export async function POST() {
  const supabase = getSupabase();
  try {
    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: VALUATION_AI_PROMPT }],
      }),
    });

    if (!apiRes.ok) {
      const errBody = await apiRes.text();
      throw new Error(`Anthropic API ${apiRes.status}: ${errBody}`);
    }

    const apiData = await apiRes.json();
    const fullText = (apiData.content?.filter((b) => b.type === "text") || []).map((b) => b.text).join("\n");
    const parsed = extractJSON(fullText);

    if (!parsed) {
      return NextResponse.json({ ok: false, error: "JSON 파싱 실패", raw: fullText?.slice(0, 500) }, { status: 422 });
    }

    // Valuation data upsert
    if (parsed.valuation?.date) {
      const d = parsed.valuation;
      await supabase.from("valuation_data").upsert(
        {
          date: d.date,
          kospi: d.kospi || null,
          valueup: d.valueup || null,
          kospi_pbr: d.kospi_pbr || null,
          pbr_below1_pct: d.pbr_below1_pct || null,
          kospi_div_yield: d.kospi_div_yield || null,
          total_dividend: d.total_dividend || null,
          source: "ai_update",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "date" }
      );
    }

    // Events upsert
    if (parsed.events && Array.isArray(parsed.events)) {
      for (const ev of parsed.events) {
        if (ev.date && ev.title) {
          await supabase.from("valuation_events").upsert(
            { date: ev.date, title: ev.title, category: ev.category || "policy", impact: ev.impact || "neutral", source: "ai_update" },
            { onConflict: "date,title" }
          );
        }
      }
    }

    const { data: valuation } = await supabase.from("valuation_data").select("*").order("date", { ascending: true });
    const { data: events } = await supabase.from("valuation_events").select("*").order("date", { ascending: false }).limit(20);

    return NextResponse.json({ ok: true, parsed, valuation, events });
  } catch (err) {
    console.error("[valuation-update] Error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
