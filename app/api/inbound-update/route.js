import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { INBOUND_AI_PROMPT, parseAIResponse } from "@/lib/inbound-constants";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function extractJSON(text) {
  if (!text) return null;
  try {
    return JSON.parse(text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim());
  } catch {}
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
        messages: [{ role: "user", content: INBOUND_AI_PROMPT }],
      }),
    });

    if (!apiRes.ok) {
      const errBody = await apiRes.text();
      throw new Error(`Anthropic API ${apiRes.status}: ${errBody}`);
    }

    const apiData = await apiRes.json();
    const fullText = (apiData.content?.filter((b) => b.type === "text") || []).map((b) => b.text).join("\n");
    const parsed = extractJSON(fullText) || parseAIResponse(fullText);

    if (!parsed) {
      return NextResponse.json({ ok: false, error: "JSON 파싱 실패", raw: fullText?.slice(0, 500) }, { status: 422 });
    }

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

    const { data: inbound } = await supabase.from("inbound_tourists").select("*").order("date", { ascending: true });
    const { data: currency } = await supabase.from("currency_rates").select("*").order("date", { ascending: true });
    return NextResponse.json({ ok: true, parsed, inbound, currency });
  } catch (err) {
    console.error("[inbound-update] Error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
