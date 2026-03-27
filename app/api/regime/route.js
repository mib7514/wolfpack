import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════
// GET: 저장된 주간 데이터 + 현재 레짐 조회
// ?current=true → Alpha Cockpit용 (현재 레짐만)
// ═══════════════════════════════════════════
export async function GET(req) {
  const supabase = getSupabase();
  const { searchParams } = new URL(req.url);

  try {
    // Alpha Cockpit 연동: 현재 레짐만 조회
    if (searchParams.get("current") === "true") {
      const { data, error } = await supabase
        .from("regime_current")
        .select("*")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, regime: data });
    }

    // 전체 조회: 최근 4주 데이터 + 현재 레짐
    const { data: weeks, error: weeksErr } = await supabase
      .from("regime_weeks")
      .select("*")
      .order("week_date", { ascending: false })
      .limit(4);
    if (weeksErr) throw weeksErr;

    const { data: current } = await supabase
      .from("regime_current")
      .select("*")
      .eq("id", 1)
      .single();

    return NextResponse.json({
      ok: true,
      weeks: (weeks || []).reverse(), // oldest first
      current: current || null,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || "조회 실패" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════
// POST: 주간 데이터 저장 + 레짐 업데이트
// Header: x-admin-pin (필수)
// Body: { week: { week_date, filename, rates }, regime?, trend_4w? }
// ═══════════════════════════════════════════
export async function POST(req) {
  // PIN 인증
  const pin = req.headers.get("x-admin-pin");
  if (pin !== process.env.ADMIN_PIN) {
    return NextResponse.json({ ok: false, error: "PIN 인증 필요" }, { status: 401 });
  }

  const supabase = getSupabase();

  try {
    const body = await req.json();
    const { week, regime, trend_4w } = body;

    if (!week?.week_date || !week?.rates) {
      return NextResponse.json(
        { ok: false, error: "week_date와 rates 필수" },
        { status: 400 }
      );
    }

    // 주간 데이터 upsert (같은 날짜면 업데이트)
    const { error: weekErr } = await supabase
      .from("regime_weeks")
      .upsert(
        {
          week_date: week.week_date,
          filename: week.filename || "",
          rates: week.rates,
        },
        { onConflict: "week_date" }
      );
    if (weekErr) throw new Error(`주간 데이터 저장 실패: ${weekErr.message}`);

    // 현재 레짐 업데이트 (있으면)
    if (regime) {
      const { error: regErr } = await supabase
        .from("regime_current")
        .upsert(
          {
            id: 1,
            regime_name: regime.regimeName,
            regime_color: regime.regimeColor,
            rate_dir: regime.rateDir,
            spread_dir: regime.spreadDir,
            rate_delta: regime.rateDelta,
            spread_delta: regime.spreadDelta,
            rate_now: regime.rateNow,
            spread_now: regime.spreadNow,
            engines: regime.engines,
            week_date: week.week_date,
            trend_4w: trend_4w || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      if (regErr) throw new Error(`레짐 저장 실패: ${regErr.message}`);
    }

    return NextResponse.json({ ok: true, msg: `${week.week_date} 저장 완료` });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || "저장 실패" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════
// DELETE: 특정 주간 데이터 삭제
// Header: x-admin-pin (필수)
// Body: { week_date: "2026-03-21" }
// ═══════════════════════════════════════════
export async function DELETE(req) {
  const pin = req.headers.get("x-admin-pin");
  if (pin !== process.env.ADMIN_PIN) {
    return NextResponse.json({ ok: false, error: "PIN 인증 필요" }, { status: 401 });
  }

  const supabase = getSupabase();

  try {
    const body = await req.json();
    if (!body?.week_date) {
      return NextResponse.json({ ok: false, error: "week_date 필수" }, { status: 400 });
    }

    const { error } = await supabase
      .from("regime_weeks")
      .delete()
      .eq("week_date", body.week_date);
    if (error) throw error;

    return NextResponse.json({ ok: true, msg: `${body.week_date} 삭제 완료` });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || "삭제 실패" },
      { status: 500 }
    );
  }
}
