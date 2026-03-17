import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AI_UPDATE_PROMPT } from "@/lib/market-constants";

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

export async function POST(request) {
  // ─── 관리자 PIN 검증 ───
  const adminPin = process.env.ADMIN_PIN;
  const userPin = request.headers.get("x-admin-pin");
  if (!adminPin || userPin !== adminPin) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다" }, { status: 401 });
  }
  // ─────────────────────────

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
        messages: [{ role: "user", content: AI_UPDATE_PROMPT }],
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

    const { data: prices } = await supabase.from("market_prices").select("*").order("date", { ascending: true });
    const { data: sentiment } = await supabase.from("consumer_sentiment").select("*").order("date", { ascending: true });

    return NextResponse.json({ ok: true, parsed, market: prices, sentiment });
  } catch (err) {
    console.error("[market-update] Error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
