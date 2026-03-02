"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import {
  RANGE_PRESETS, SEED_MARKET, SEED_CSI,
  indexData, formatDateLabel,
} from "@/lib/market-constants";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function MarketTooltip({ active, payload, label, mode }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[rgba(10,10,18,0.96)] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-gray-400 backdrop-blur-md min-w-[140px]">
      <div className="font-bold text-white mb-1.5">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }} className="flex justify-between gap-3 my-0.5">
          <span>{p.name}</span>
          <span className="font-semibold">
            {mode === "index" ? p.value : p.value?.toLocaleString()}
            {mode === "index" && p.value !== 100 && (
              <span className="opacity-60 ml-1">
                ({p.value > 100 ? "+" : ""}{(p.value - 100).toFixed(1)}%)
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function CSITooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[rgba(10,10,18,0.96)] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-gray-400 backdrop-blur-md">
      <div className="font-bold text-white mb-1.5">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }} className="my-0.5">
          소비자심리지수: <strong>{p.value}</strong>
          {p.value >= 100
            ? <span className="text-green-400 ml-1.5">낙관</span>
            : <span className="text-red-400 ml-1.5">비관</span>}
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div
      className="bg-white/[.02] rounded-xl px-3.5 py-3"
      style={{ border: `1px solid ${accent}22`, borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <div className="text-[10px] opacity-50 tracking-wide mb-0.5">{label}</div>
      <div className="text-[22px] font-black leading-tight" style={{ color: accent }}>{value}</div>
      <div className="text-[10px] opacity-45 mt-0.5">{sub}</div>
    </div>
  );
}

export default function MarketDashboard() {
  const [marketData, setMarketData] = useState(SEED_MARKET);
  const [csiData, setCSIData] = useState(SEED_CSI);
  const [range, setRange] = useState(12);
  const [displayMode, setDisplayMode] = useState("index");
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("시드 데이터");
  const [aiLog, setAiLog] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [aiLog]);

  useEffect(() => {
    async function loadFromDB() {
      try {
        const { data: prices, error: e1 } = await supabase
          .from("market_prices").select("date, kospi, kodex").order("date", { ascending: true });
        const { data: sentiment, error: e2 } = await supabase
          .from("consumer_sentiment").select("date, csi").order("date", { ascending: true });

        if (!e1 && prices?.length > 0) {
          setMarketData(prices.map((r) => ({ date: r.date, kospi: Number(r.kospi), kodex: Number(r.kodex) })));
          setDbReady(true);
        }
        if (!e2 && sentiment?.length > 0) {
          setCSIData(sentiment.map((r) => ({ date: r.date, csi: Number(r.csi) })));
        }

        const { data: logs } = await supabase
          .from("market_update_log").select("created_at, notes")
          .eq("status", "success").order("created_at", { ascending: false }).limit(1);
        if (logs?.[0]) {
          setLastUpdate(`DB 로드 (최종: ${new Date(logs[0].created_at).toLocaleString("ko-KR")})`);
        }
      } catch {
        console.log("[market] Supabase 연결 실패, 시드 데이터 사용");
      }
    }
    loadFromDB();
  }, []);

  const filteredMarket = range >= 999 ? marketData : marketData.slice(-range);
  const filteredCSI = range >= 999 ? csiData : csiData.slice(-range);
  const indexed = indexData(filteredMarket, 0, "kospi", "kodex");

  const chartMarket = (displayMode === "index" ? indexed : filteredMarket).map((d) => ({
    ...d, label: formatDateLabel(d.date),
  }));
  const chartCSI = filteredCSI.map((d) => ({ ...d, label: formatDateLabel(d.date) }));

  const latest = marketData[marketData.length - 1] || {};
  const prev = marketData[marketData.length - 2] || {};
  const latestCSI = csiData[csiData.length - 1] || {};

  const kospiChg = latest.kospi && prev.kospi
    ? ((latest.kospi - prev.kospi) / prev.kospi * 100).toFixed(1) : "—";
  const kodexChg = latest.kodex && prev.kodex
    ? ((latest.kodex - prev.kodex) / prev.kodex * 100).toFixed(1) : "—";
  const periodSpread = indexed.length > 1
    ? (indexed[indexed.length - 1].kodexIdx - indexed[indexed.length - 1].kospiIdx).toFixed(1) : "—";

  const handleAIUpdate = useCallback(async () => {
    setLoading(true);
    setAiLog("");
    setShowLog(true);
    const log = (msg) => setAiLog((p) => p + msg + "\n");

    try {
      log("🔍 서버 API 호출 중...");
      log("   → /api/market-update (웹서치 + Supabase 저장)");

      const res = await fetch("/api/market-update", { method: "POST" });
      const body = await res.json();

      if (!body.ok) {
        log(`⚠️ 업데이트 실패: ${body.error}`);
        if (body.raw) log(`   원본: ${body.raw}`);
        setLastUpdate(`실패 — ${new Date().toLocaleString("ko-KR")}`);
        return;
      }

      log("✅ 데이터 수신 완료");
      if (body.parsed?.kospi) log(`  KOSPI: ${body.parsed.kospi.value?.toLocaleString()} (${body.parsed.kospi.date})`);
      if (body.parsed?.kodex_consumer) log(`  KODEX 경기소비재: ${body.parsed.kodex_consumer.value?.toLocaleString()}`);
      if (body.parsed?.consumer_sentiment) log(`  소비자심리지수: ${body.parsed.consumer_sentiment.value}`);
      if (body.parsed?.notes) log(`  💬 ${body.parsed.notes}`);

      if (body.market?.length) {
        setMarketData(body.market.map((r) => ({ date: r.date, kospi: Number(r.kospi), kodex: Number(r.kodex) })));
      }
      if (body.sentiment?.length) {
        setCSIData(body.sentiment.map((r) => ({ date: r.date, csi: Number(r.csi) })));
      }

      setLastUpdate(`AI 업데이트 ${new Date().toLocaleString("ko-KR")}`);
      setDbReady(true);
      log("\n✅ 대시보드 업데이트 완료!");
    } catch (err) {
      log(`❌ 네트워크 에러: ${err.message}`);
      setLastUpdate(`에러 — ${new Date().toLocaleString("ko-KR")}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#08080f] text-gray-300">
      <div className="border-b border-red-900/30 px-4 sm:px-6 py-3 flex items-center justify-between flex-wrap gap-2"
        style={{ background: "linear-gradient(90deg, rgba(220,38,38,0.1) 0%, transparent 60%)" }}>
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🐺</span>
          <span className="text-[13px] font-extrabold tracking-wider uppercase text-red-600">
            늑대무리원정단
            <span className="text-[10px] opacity-40 ml-2 font-normal normal-case tracking-normal">
              CONTROL TOWER · MARKET
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] opacity-40 hidden sm:inline">{lastUpdate}</span>
          {!dbReady && (
            <span className="text-[10px] text-yellow-500/70 hidden sm:inline">⚠ 시드 데이터 사용 중</span>
          )}
          <button onClick={handleAIUpdate} disabled={loading}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-[13px] font-bold text-white transition-all
              ${loading
                ? "bg-gray-600 cursor-wait opacity-60"
                : "bg-gradient-to-br from-red-600 to-red-800 border border-red-600/50 shadow-[0_0_20px_rgba(220,38,38,0.15)] hover:shadow-[0_0_30px_rgba(220,38,38,0.3)]"
              }`}>
            {loading ? <><span className="animate-spin inline-block">⟳</span> 분석 중...</> : <>⚡ AI 업데이트</>}
          </button>
        </div>
      </div>

      <div className="max-w-[960px] mx-auto px-4 py-5">
        <h1 className="text-[22px] font-black text-gray-100 leading-tight">한국 소비주 모니터링</h1>
        <p className="text-xs opacity-40 mt-0.5 mb-5">KOSPI × KODEX 경기소비재 × 소비자심리지수 | 탑다운으로 가보자고 #4</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
          <StatCard label="KOSPI" value={latest.kospi?.toLocaleString()} sub={`MoM ${kospiChg > 0 ? "+" : ""}${kospiChg}%`} accent="#60a5fa" />
          <StatCard label="KODEX 경기소비재" value={latest.kodex?.toLocaleString()} sub={`MoM ${kodexChg > 0 ? "+" : ""}${kodexChg}%`} accent="#f97316" />
          <StatCard label="경기소비재 스프레드" value={`${Number(periodSpread) > 0 ? "+" : ""}${periodSpread}%p`} sub="선택 기간 초과수익" accent={Number(periodSpread) >= 0 ? "#4ade80" : "#f87171"} />
          <StatCard label="소비자심리지수" value={latestCSI.csi} sub={latestCSI.csi >= 100 ? "낙관 구간" : "비관 구간"} accent={latestCSI.csi >= 100 ? "#4ade80" : "#facc15"} />
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2.5 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              {RANGE_PRESETS.map((p) => (
                <button key={p.label} onClick={() => setRange(p.months)}
                  className={`px-3.5 py-1 rounded-md text-xs font-semibold border transition-all
                    ${range === p.months
                      ? "border-red-600/50 bg-red-600/15 text-red-400"
                      : "border-white/[.06] bg-white/[.02] text-gray-500 hover:text-gray-300"}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-white/[.08] mx-1 hidden sm:block" />
            <div className="flex gap-1">
              {[{ key: "index", label: "수익률 비교" }, { key: "price", label: "절대가격" }].map((m) => (
                <button key={m.key} onClick={() => setDisplayMode(m.key)}
                  className={`px-3 py-1 rounded-md text-[11px] font-semibold border transition-all
                    ${displayMode === m.key
                      ? "border-blue-400/40 bg-blue-400/10 text-blue-300"
                      : "border-white/[.06] bg-white/[.02] text-gray-600 hover:text-gray-400"}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {showLog && aiLog && (
          <div ref={logRef} className="bg-black/40 border border-white/[.06] rounded-xl px-3.5 py-2.5 mb-4 max-h-40 overflow-y-auto text-[11px] font-mono text-gray-500 leading-relaxed whitespace-pre-wrap">
            {aiLog}
          </div>
        )}

        <div className="bg-white/[.015] border border-white/[.06] rounded-2xl pt-4 pr-1 pb-2 mb-4">
          <div className="flex items-center gap-2 px-5 mb-2 text-[13px] font-bold opacity-80">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_#60a5fa]" />
            <span>KOSPI</span>
            <span className="opacity-30 mx-0.5">vs</span>
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_6px_#f97316]" />
            <span>KODEX 경기소비재</span>
            {displayMode === "index" && (
              <span className="text-[10px] opacity-40 ml-2">({chartMarket[0]?.label} = 100)</span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartMarket} margin={{ top: 10, right: 24, left: 8, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} />
              <YAxis yAxisId="left" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={(v) => displayMode === "index" ? v : v.toLocaleString()} />
              {displayMode === "price" && (
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#996633", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString()} />
              )}
              <Tooltip content={<MarketTooltip mode={displayMode} />} />
              {displayMode === "index" && (
                <ReferenceLine y={100} yAxisId="left" stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
              )}
              <Line type="monotone" dataKey={displayMode === "index" ? "kospiIdx" : "kospi"} name="KOSPI" stroke="#60a5fa" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#60a5fa" }} yAxisId="left" />
              <Line type="monotone" dataKey={displayMode === "index" ? "kodexIdx" : "kodex"} name="KODEX 경기소비재" stroke="#f97316" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#f97316" }} yAxisId={displayMode === "price" ? "right" : "left"} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="line" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white/[.015] border border-white/[.06] rounded-2xl pt-4 pr-1 pb-2 mb-4">
          <div className="flex items-center gap-2 px-5 mb-2 text-[13px] font-bold opacity-80">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_6px_#facc15]" />
            <span>한국은행 소비자심리지수 (CCSI)</span>
            <span className="text-[10px] opacity-40 ml-2">기준선 100 = 중립</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartCSI} margin={{ top: 10, right: 24, left: 8, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} />
              <YAxis tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} domain={[85, 115]} />
              <Tooltip content={<CSITooltip />} />
              <ReferenceLine y={100} stroke="rgba(74,222,128,0.25)" strokeDasharray="4 4"
                label={{ value: "중립 (100)", position: "right", fill: "#4ade80", fontSize: 9, opacity: 0.6 }} />
              <Line type="monotone" dataKey="csi" name="소비자심리지수" stroke="#facc15" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#facc15" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-red-600/[.04] border border-red-600/15 rounded-xl px-4 py-3.5 mb-4">
          <div className="text-xs font-bold text-red-600 mb-2">🐺 읽는 법</div>
          <div className="text-xs leading-relaxed opacity-70">
            <strong>수익률 비교 모드</strong>에서 KODEX 경기소비재 선이 KOSPI 위에 있으면 소비재 섹터가 아웃퍼폼 중.
            일본 사례에서 확인된 것처럼 증시 랠리 초기엔 대형주가 주도하고, 소비/내수주는 6~12개월 시차를 두고 초과수익을 냄.
            <strong> 소비자심리지수</strong>가 100을 상향 돌파하는 시점이 소비주 본격 아웃퍼폼의 트리거. 두 차트의 가로축이 동기화되어 있으므로 타이밍 비교 가능.
          </div>
        </div>

        <div className="text-center text-[10px] opacity-30 py-3 leading-relaxed">
          KODEX 경기소비재 ETF (266410) | 소비자심리지수 = 한국은행 CCSI<br />
          탑다운으로 가보자고 #4 — 한국의 명품 소비주 찾기
        </div>
      </div>
    </div>
  );
}
