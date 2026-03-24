import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const stockId = searchParams.get("stock_id");
    if (!stockId) return NextResponse.json({ error: "stock_id required" }, { status: 400 });

    const sb = getSupabase();
    const { data, error } = await sb
      .from("radar_score_history")
      .select("*")
      .eq("stock_id", stockId)
      .order("snapshot_date", { ascending: true });

    if (error) {
      console.error("History fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (e) {
    console.error("History API error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
