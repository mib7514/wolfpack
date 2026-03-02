import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { INBOUND_AI_PROMPT, parseAIResponse } from "@/lib/inbound-constants";

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
        messages: [{ role: "user", content: INBOUND_AI_PROMPT }],
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
      await supabase.from("inbound_update_log").insert({
        raw_response: apiData,
        status: "parse_error",
        notes: fullText?.slice(0, 500),
      });
      return NextResponse.json(
        { ok: false, error: "JSON 파싱 실패", raw: fullText?.slice(0, 500) },
        { status: 422 }
      );
    }

    // inbound upsert
    if (parsed.inbound?.date) {
      const d = parsed.inbound;
      const countries = ["CN", "JP", "US", "TW", "TH", "VN", "OTHER"];
      for (const c of countries) {
        if (d[c] != null) {
          await supabase.from("inbound_tourists").upsert(
            { date: d.date, country: c, visitors: d[c], source: "ai_update", updated_at: new Date().toISOString() },
            { onConflict: "date,country" }
          );
        }
      }
    }

    // currency upsert
    if (parsed.currency?.date) {
      const d = parsed.currency;
      const currencies = ["USD", "JPY", "CNY", "TWD"];
      for (const c of currencies) {
        if (d[c] != null) {
          await supabase.from("currency_rates").upsert(
            { date: d.date, currency: c, rate: d[c], source: "ai_update", updated_at: new Date().toISOString() },
            { onConflict: "date,currency" }
          );
        }
      }
    }

    await supabase.from("inbound_update_log").insert({
      raw_response: apiData,
      parsed_data: parsed,
      notes: parsed.notes || null,
      status: "success",
    });

    const { data: inbound } = await supabase.from("inbound_tourists").select("*").order("date", { ascending: true });
    const { data: currency } = await supabase.from("currency_rates").select("*").order("date", { ascending: true });

    return NextResponse.json({ ok: true, parsed, inbound, currency });
  } catch (err) {
    console.error("[inbound-update] Error:", err);
    await supabase.from("inbound_update_log").insert({ status: "api_error", notes: err.message?.slice(0, 500) }).catch(() => {});
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
