import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AI_UPDATE_PROMPT, parseAIResponse } from "@/lib/market-constants";

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
        messages: [{ role: "user", content: AI_UPDATE_PROMPT }],
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
      await supabase.from("market_update_log").insert({
        raw_response: apiData,
        status: "parse_error",
        notes: fullText?.slice(0, 500),
      });
      return NextResponse.json(
        { ok: false, error: "JSON 파싱 실패", raw: fullText?.slice(0, 500) },
        { status: 422 }
      );
    }

    if (parsed.kospi?.value && parsed.kodex_consumer?.value) {
      const date = parsed.kospi.date?.slice(0, 7) || new Date().toISOString().slice(0, 7);
      await supabase.from("market_prices").upsert(
        { date, kospi: parsed.kospi.value, kodex: parsed.kodex_consumer.value, source: "ai_update", updated_at: new Date().toISOString() },
        { onConflict: "date" }
      );
    }

    if (parsed.consumer_sentiment?.value) {
      const csiDate = parsed.consumer_sentiment.date || new Date().toISOString().slice(0, 7);
      await supabase.from("consumer_sentiment").upsert(
        { date: csiDate, csi: parsed.consumer_sentiment.value, source: "ai_update", updated_at: new Date().toISOString() },
        { onConflict: "date" }
      );
    }

    await supabase.from("market_update_log").insert({
      raw_response: apiData,
      parsed_data: parsed,
      notes: parsed.notes || null,
      status: "success",
    });

    const { data: prices } = await supabase.from("market_prices").select("*").order("date", { ascending: true });
    const { data: sentiment } = await supabase.from("consumer_sentiment").select("*").order("date", { ascending: true });

    return NextResponse.json({ ok: true, parsed, market: prices, sentiment });
  } catch (err) {
    console.error("[market-update] Error:", err);
    await supabase.from("market_update_log").insert({ status: "api_error", notes: err.message?.slice(0, 500) }).catch(() => {});
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
