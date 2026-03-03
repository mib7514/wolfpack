import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { VALUATION_AI_PROMPT, parseAIResponse } from "@/lib/valuation-constants";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export const dynamic = "force-dynamic";

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
        max_tokens: 1024,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: VALUATION_AI_PROMPT }],
      }),
    });

    if (!apiRes.ok) {
      const errBody = await apiRes.text();
      throw new Error(`Anthropic API ${apiRes.status}: ${errBody}`);
    }

    const apiData = await apiRes.json();
    const textBlocks = apiData.content?.filter((b) => b.type === "text") || [];
    const fullText = textBlocks.map((b) => b.text).join("\n");
    const parsed = parseAIResponse(fullText);

    if (!parsed) {
      await supabase.from("valuation_update_log").insert({
        raw_response: apiData,
        status: "parse_error",
        notes: fullText?.slice(0, 500),
      });
      return NextResponse.json(
        { ok: false, error: "JSON 파싱 실패", raw: fullText?.slice(0, 500) },
        { status: 422 }
      );
    }

    // metrics upsert
    if (parsed.metrics?.date) {
      const m = parsed.metrics;
      await supabase.from("valuation_metrics").upsert(
        {
          date: m.date,
          kospi_pbr: m.kospi_pbr,
          kospi_div_yield: m.kospi_div_yield,
          valueup_index: m.valueup_index,
          kospi_close: m.kospi_close,
          pbr_below1_pct: m.pbr_below1_pct,
          valueup_corps_count: m.valueup_corps_count,
          source: "ai_update",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "date" }
      );
    }

    // events insert (중복 방지: 같은 날짜+제목 스킵)
    if (parsed.events?.length) {
      for (const ev of parsed.events) {
        const { data: existing } = await supabase
          .from("valueup_events")
          .select("id")
          .eq("date", ev.date)
          .eq("title", ev.title)
          .limit(1);

        if (!existing?.length) {
          await supabase.from("valueup_events").insert({
            date: ev.date,
            category: ev.category || "policy",
            title: ev.title,
            description: ev.description || "",
            impact: ev.impact || "neutral",
            source: "ai_update",
          });
        }
      }
    }

    await supabase.from("valuation_update_log").insert({
      raw_response: apiData,
      parsed_data: parsed,
      notes: parsed.notes || null,
      status: "success",
    });

    const { data: metrics } = await supabase.from("valuation_metrics").select("*").order("date", { ascending: true });
    const { data: events } = await supabase.from("valueup_events").select("*").order("date", { ascending: false });

    return NextResponse.json({ ok: true, parsed, metrics, events });
  } catch (err) {
    console.error("[valuation-update] Error:", err);
    await supabase.from("valuation_update_log").insert({ status: "api_error", notes: err.message?.slice(0, 500) }).catch(() => {});
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
