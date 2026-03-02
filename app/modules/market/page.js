"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import {
  RANGE_PRESETS, SEED_MARKET, SEED_CSI,
  indexData, formatDateLabel as fmtMarket,
} from "@/lib/market-constants";
import {
  COUNTRY_LABELS, CURRENCY_LABELS,
  SEED_INBOUND, SEED_CURRENCY,
  getTopCountries, pivotInbound, pivotCurrency,
  formatDateLabel as fmtInbound,
} from "@/lib/inbound-constants";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ════════════════════════════════
// 공용 컴포넌트
// ════════════════════════════════
function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white/[.02] rounded-xl px-3.5 py-3"
      style={{ border: `1px solid ${accent}22`, borderLeftWidth: 3, borderLeftColor: accent }}>
      <div className="text-[10px] opacity-50 tracking-wide mb-0.5">{label}</div>
      <div className="text-[22px] font-black leading-tight" style={{ color: accent }}>{value}</div>
      <div className="text-[10px] opacity-45 mt-0.5">{sub}</div>
    </div>
  );
}

function LogPanel({ aiLog, showLog, logRef }) {
  if (!showLog || !aiLog) return null;
  return (
    <div ref={logRef} className="bg-black/40 border border-white/[.06] rounded-xl px-3.5 py-2.5 mb-4 max-h-40 overflow-y-auto text-[11px] font-mono text-gray-500 leading-relaxed whitespace-pre-wrap">
      {aiLog}
    </div>
  );
}

// ════════════════════════════════
// Tab 1: 소비주 모니터링
// ════════════════════════════════
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
              <span className="opacity-60 ml-1">({p.value > 100 ? "+" : ""}{(p.value - 100).toFixed(1)}%)</span>
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
          {p.value >= 100 ? <span className="text-green-400 ml-1.5">낙관</span> : <span className="text-red-400 ml-1.5">비관</span>}
        </div>
      ))}
    </div>
  );
}

function ConsumerTab() {
  const [marketData, setMarketData] = useState(SEED_MARKET);
  const [csiData, setCSIData] = useState(SEED_CSI);
  const [range, setRange] = useState(12);
  const [displayMode, setDisplayMode] = useState("index");
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("시드 데이터");
  const [aiLog, setAiLog] = useState("");
  const [showLog, setShowLog] = useState(false);
  const logRef = useRef(null);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [aiLog]);

  useEffect(() => {
    async function load() {
      try {
        const { data: prices, error: e1 } = await supabase.from("market_prices").select("date, kospi, kodex").order("date", { ascending: true });
        const { data: sentiment, error: e2 } = await supabase.from("consumer_sentiment").select("date, csi").order("date", { ascending: true });
        if (!e1 && prices?.length > 0) setMarketData(prices.map((r) => ({ date: r.date, kospi: Number(r.kospi), kodex: Number(r.kodex) })));
        if (!e2 && sentiment?.length > 0) setCSIData(sentiment.map((r) => ({ date: r.date, csi: Number(r.csi) })));
        const { data: logs } = await supabase.from("market_update_log").select("created_at").eq("status", "success").order("created_at", { ascending: false }).limit(1);
        if (logs?.[0]) setLastUpdate(`DB (${new Date(logs[0].created_at).toLocaleString("ko-KR")})`);
      } catch { console.log("[market] 시드 데이터 사용"); }
    }
    load();
  }, []);

  const filtered = range >= 999 ? marketData : marketData.slice(-range);
  const filteredCSI = range >= 999 ? csiData : csiData.slice(-range);
  const indexed = indexData(filtered, 0, "kospi", "kodex");
  const chart = (displayMode === "index" ? indexed : filtered).map((d) => ({ ...d, label: fmtMarket(d.date) }));
  const chartCSI = filteredCSI.map((d) => ({ ...d, label: fmtMarket(d.date) }));

  const latest = marketData[marketData.length - 1] || {};
  const prev = marketData[marketData.length - 2] || {};
  const latestCSI = csiData[csiData.length - 1] || {};
  const kospiChg = latest.kospi && prev.kospi ? ((latest.kospi - prev.kospi) / prev.kospi * 100).toFixed(1) : "—";
  const kodexChg = latest.kodex && prev.kodex ? ((latest.kodex - prev.kodex) / prev.kodex * 100).toFixed(1) : "—";
  const spread = indexed.length > 1 ? (indexed[indexed.length - 1].kodexIdx - indexed[indexed.length - 1].kospiIdx).toFixed(1) : "—";

  const handleUpdate = useCallback(async () => {
    setLoading(true); setAiLog(""); setShowLog(true);
    const log = (m) => setAiLog((p) => p + m + "\n");
    try {
      log("🔍 /api/market-update 호출 중...");
      const res = await fetch("/api/market-update", { method: "POST" });
      const body = await res.json();
      if (!body.ok) { log(`⚠️ 실패: ${body.error}`); return; }
      log("✅ 수신 완료");
      if (body.parsed?.kospi) log(`  KOSPI: ${body.parsed.kospi.value?.toLocaleString()}`);
      if (body.parsed?.kodex_consumer) log(`  KODEX: ${body.parsed.kodex_consumer.value?.toLocaleString()}`);
      if (body.parsed?.consumer_sentiment) log(`  CSI: ${body.parsed.consumer_sentiment.value}`);
      if (body.parsed?.notes) log(`  💬 ${body.parsed.notes}`);
      if (body.market?.length) setMarketData(body.market.map((r) => ({ date: r.date, kospi: Number(r.kospi), kodex: Number(r.kodex) })));
      if (body.sentiment?.length) setCSIData(body.sentiment.map((r) => ({ date: r.date, csi: Number(r.csi) })));
      setLastUpdate(`AI ${new Date().toLocaleString("ko-KR")}`);
      log("✅ 완료!");
    } catch (err) { log(`❌ ${err.message}`); } finally { setLoading(false); }
  }, []);

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {RANGE_PRESETS.map((p) => (
              <button key={p.label} onClick={() => setRange(p.months)}
                className={`px-3.5 py-1 rounded-md text-xs font-semibold border transition-all ${range === p.months ? "border-red-600/50 bg-red-600/15 text-red-400" : "border-white/[.06] bg-white/[.02] text-gray-500 hover:text-gray-300"}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-white/[.08] mx-1 hidden sm:block" />
          <div className="flex gap-1">
            {[{ key: "index", label: "수익률 비교" }, { key: "price", label: "절대가격" }].map((m) => (
              <button key={m.key} onClick={() => setDisplayMode(m.key)}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold border transition-all ${displayMode === m.key ? "border-blue-400/40 bg-blue-400/10 text-blue-300" : "border-white/[.06] bg-white/[.02] text-gray-600 hover:text-gray-400"}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={handleUpdate} disabled={loading}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[12px] font-bold text-white transition-all ${loading ? "bg-gray-600 cursor-wait opacity-60" : "bg-gradient-to-br from-red-600 to-red-800 border border-red-600/50 hover:shadow-[0_0_20px_rgba(220,38,38,0.3)]"}`}>
          {loading ? <><span className="animate-spin inline-block">⟳</span> 분석 중...</> : <>⚡ AI 업데이트</>}
        </button>
      </div>

      <LogPanel aiLog={aiLog} showLog={showLog} logRef={logRef} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <StatCard label="KOSPI" value={latest.kospi?.toLocaleString()} sub={`MoM ${kospiChg > 0 ? "+" : ""}${kospiChg}%`} accent="#60a5fa" />
        <StatCard label="KODEX 경기소비재" value={latest.kodex?.toLocaleString()} sub={`MoM ${kodexChg > 0 ? "+" : ""}${kodexChg}%`} accent="#f97316" />
        <StatCard label="스프레드" value={`${Number(spread) > 0 ? "+" : ""}${spread}%p`} sub="초과수익" accent={Number(spread) >= 0 ? "#4ade80" : "#f87171"} />
        <StatCard label="소비자심리" value={latestCSI.csi} sub={latestCSI.csi >= 100 ? "낙관" : "비관"} accent={latestCSI.csi >= 100 ? "#4ade80" : "#facc15"} />
      </div>

      <div className="bg-white/[.015] border border-white/[.06] rounded-2xl pt-4 pr-1 pb-2 mb-4">
        <div className="flex items-center gap-2 px-5 mb-2 text-[13px] font-bold opacity-80">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_#60a5fa]" /><span>KOSPI</span>
          <span className="opacity-30 mx-0.5">vs</span>
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_6px_#f97316]" /><span>KODEX 경기소비재</span>
          {displayMode === "index" && <span className="text-[10px] opacity-40 ml-2">({chart[0]?.label} = 100)</span>}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chart} margin={{ top: 10, right: 24, left: 8, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} />
            <YAxis yAxisId="left" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => displayMode === "index" ? v : v.toLocaleString()} />
            {displayMode === "price" && <YAxis yAxisId="right" orientation="right" tick={{ fill: "#996633", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString()} />}
            <Tooltip content={<MarketTooltip mode={displayMode} />} />
            {displayMode === "index" && <ReferenceLine y={100} yAxisId="left" stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />}
            <Line type="monotone" dataKey={displayMode === "index" ? "kospiIdx" : "kospi"} name="KOSPI" stroke="#60a5fa" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} yAxisId="left" />
            <Line type="monotone" dataKey={displayMode === "index" ? "kodexIdx" : "kodex"} name="KODEX 경기소비재" stroke="#f97316" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} yAxisId={displayMode === "price" ? "right" : "left"} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="line" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white/[.015] border border-white/[.06] rounded-2xl pt-4 pr-1 pb-2 mb-4">
        <div className="flex items-center gap-2 px-5 mb-2 text-[13px] font-bold opacity-80">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_6px_#facc15]" />
          <span>소비자심리지수 (CCSI)</span>
          <span className="text-[10px] opacity-40 ml-2">100 = 중립</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartCSI} margin={{ top: 10, right: 24, left: 8, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} />
            <YAxis tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} domain={[85, 115]} />
            <Tooltip content={<CSITooltip />} />
            <ReferenceLine y={100} stroke="rgba(74,222,128,0.25)" strokeDasharray="4 4" label={{ value: "중립", position: "right", fill: "#4ade80", fontSize: 9, opacity: 0.6 }} />
            <Line type="monotone" dataKey="csi" name="CSI" stroke="#facc15" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-red-600/[.04] border border-red-600/15 rounded-xl px-4 py-3.5">
        <div className="text-xs font-bold text-red-600 mb-2">🐺 읽는 법</div>
        <div className="text-xs leading-relaxed opacity-70">
          <strong>수익률 비교</strong>에서 KODEX 선이 KOSPI 위 → 소비재 아웃퍼폼. 증시 랠리 초기엔 대형주 주도, 소비주는 6~12개월 시차.
          <strong> CSI</strong>가 100 돌파 시점이 소비주 아웃퍼폼 트리거.
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════
// Tab 2: 인바운드 & 환율
// ════════════════════════════════
function InboundTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[rgba(10,10,18,0.96)] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-gray-400 backdrop-blur-md min-w-[160px]">
      <div className="font-bold text-white mb-1.5">{label}</div>
      {payload.filter(p => p.value > 0).map((p, i) => (
        <div key={i} style={{ color: p.color || p.fill }} className="flex justify-between gap-3 my-0.5">
          <span>{p.name}</span>
          <span className="font-semibold">{Number(p.value).toLocaleString()}천</span>
        </div>
      ))}
    </div>
  );
}

function CurrencyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[rgba(10,10,18,0.96)] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-gray-400 backdrop-blur-md">
      <div className="font-bold text-white mb-1.5">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }} className="flex justify-between gap-3 my-0.5">
          <span>{p.name}</span>
          <span className="font-semibold">{Number(p.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function InboundTab() {
  const [inboundData, setInboundData] = useState(SEED_INBOUND);
  const [currencyData, setCurrencyData] = useState(SEED_CURRENCY);
  const [range, setRange] = useState(12);
  const [loading, setLoading] = useState(false);
  const [aiLog, setAiLog] = useState("");
  const [showLog, setShowLog] = useState(false);
  const logRef = useRef(null);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [aiLog]);

  useEffect(() => {
    async function load() {
      try {
        const { data: ib, error: e1 } = await supabase.from("inbound_tourists").select("date, country, visitors").order("date", { ascending: true });
        const { data: cr, error: e2 } = await supabase.from("currency_rates").select("date, currency, rate").order("date", { ascending: true });
        if (!e1 && ib?.length > 0) setInboundData(ib.map((r) => ({ date: r.date, country: r.country, visitors: Number(r.visitors) })));
        if (!e2 && cr?.length > 0) setCurrencyData(cr.map((r) => ({ date: r.date, currency: r.currency, rate: Number(r.rate) })));
      } catch { console.log("[inbound] 시드 데이터 사용"); }
    }
    load();
  }, []);

  const topCountries = getTopCountries(inboundData, 3);
  const pivoted = pivotInbound(inboundData);
  const currPivoted = pivotCurrency(currencyData);
  const filtered = range >= 999 ? pivoted : pivoted.slice(-range);
  const filteredCurr = range >= 999 ? currPivoted : currPivoted.slice(-range);
  const chartInbound = filtered.map((d) => ({ ...d, label: fmtInbound(d.date) }));
  const chartCurrency = filteredCurr.map((d) => ({ ...d, label: fmtInbound(d.date) }));

  // Top 3 국가에 매핑되는 통화
  const countryToCurrency = { CN: "CNY", JP: "JPY", US: "USD", TW: "TWD" };
  const topCurrencies = [...new Set(topCountries.map((c) => countryToCurrency[c]).filter(Boolean))];

  const latest = pivoted[pivoted.length - 1] || {};
  const prev = pivoted[pivoted.length - 2] || {};
  const totalChg = latest.total && prev.total ? ((latest.total - prev.total) / prev.total * 100).toFixed(1) : "—";
  const latestCurr = currPivoted[currPivoted.length - 1] || {};

  const handleUpdate = useCallback(async () => {
    setLoading(true); setAiLog(""); setShowLog(true);
    const log = (m) => setAiLog((p) => p + m + "\n");
    try {
      log("🔍 /api/inbound-update 호출 중...");
      const res = await fetch("/api/inbound-update", { method: "POST" });
      const body = await res.json();
      if (!body.ok) { log(`⚠️ 실패: ${body.error}`); return; }
      log("✅ 수신 완료");
      if (body.parsed?.inbound) log(`  인바운드: ${body.parsed.inbound.date}`);
      if (body.parsed?.currency) log(`  환율: USD ${body.parsed.currency.USD}`);
      if (body.parsed?.notes) log(`  💬 ${body.parsed.notes}`);
      if (body.inbound?.length) setInboundData(body.inbound.map((r) => ({ date: r.date, country: r.country, visitors: Number(r.visitors) })));
      if (body.currency?.length) setCurrencyData(body.currency.map((r) => ({ date: r.date, currency: r.currency, rate: Number(r.rate) })));
      log("✅ 완료!");
    } catch (err) { log(`❌ ${err.message}`); } finally { setLoading(false); }
  }, []);

  const allCountries = Object.keys(COUNTRY_LABELS);

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex gap-1">
          {RANGE_PRESETS.map((p) => (
            <button key={p.label} onClick={() => setRange(p.months)}
              className={`px-3.5 py-1 rounded-md text-xs font-semibold border transition-all ${range === p.months ? "border-red-600/50 bg-red-600/15 text-red-400" : "border-white/[.06] bg-white/[.02] text-gray-500 hover:text-gray-300"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <button onClick={handleUpdate} disabled={loading}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[12px] font-bold text-white transition-all ${loading ? "bg-gray-600 cursor-wait opacity-60" : "bg-gradient-to-br from-red-600 to-red-800 border border-red-600/50 hover:shadow-[0_0_20px_rgba(220,38,38,0.3)]"}`}>
          {loading ? <><span className="animate-spin inline-block">⟳</span> 분석 중...</> : <>⚡ AI 업데이트</>}
        </button>
      </div>

      <LogPanel aiLog={aiLog} showLog={showLog} logRef={logRef} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <StatCard label="월간 총 방한" value={`${latest.total?.toLocaleString() || "—"}천`} sub={`MoM ${totalChg > 0 ? "+" : ""}${totalChg}%`} accent="#4FC3F7" />
        {topCountries.slice(0, 3).map((c) => {
          const info = COUNTRY_LABELS[c];
          const val = latest[c];
          const prevVal = prev[c];
          const chg = val && prevVal ? ((val - prevVal) / prevVal * 100).toFixed(1) : "—";
          return <StatCard key={c} label={`${info.flag} ${info.name}`} value={`${val?.toLocaleString() || "—"}천`} sub={`MoM ${chg > 0 ? "+" : ""}${chg}%`} accent={info.color} />;
        })}
      </div>

      {/* 국가별 스택 바 차트 */}
      <div className="bg-white/[.015] border border-white/[.06] rounded-2xl pt-4 pr-1 pb-2 mb-4">
        <div className="flex items-center gap-2 px-5 mb-2 text-[13px] font-bold opacity-80">
          <span>✈️ 국가별 방한 관광객</span>
          <span className="text-[10px] opacity-40 ml-2">(천 명)</span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartInbound} margin={{ top: 10, right: 24, left: 8, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} />
            <YAxis tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip content={<InboundTooltip />} />
            {allCountries.map((c) => (
              <Bar key={c} dataKey={c} name={`${COUNTRY_LABELS[c].flag} ${COUNTRY_LABELS[c].name}`} stackId="a" fill={COUNTRY_LABELS[c].color} />
            ))}
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top 국가 대응 환율 */}
      <div className="bg-white/[.015] border border-white/[.06] rounded-2xl pt-4 pr-1 pb-2 mb-4">
        <div className="flex items-center gap-2 px-5 mb-2 text-[13px] font-bold opacity-80">
          <span>💱 Top 방한국 통화 vs 원화</span>
          <span className="text-[10px] opacity-40 ml-2">
            {topCurrencies.map((c) => CURRENCY_LABELS[c]?.symbol).join(" · ")}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartCurrency} margin={{ top: 10, right: 24, left: 8, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} />
            <YAxis yAxisId="left" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} />
            {topCurrencies.length > 1 && <YAxis yAxisId="right" orientation="right" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} />}
            <Tooltip content={<CurrencyTooltip />} />
            {topCurrencies.map((c, i) => (
              <Line key={c} type="monotone" dataKey={c} name={CURRENCY_LABELS[c]?.symbol || c} stroke={CURRENCY_LABELS[c]?.color || "#888"} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} yAxisId={i === 0 ? "left" : "right"} />
            ))}
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="line" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-red-600/[.04] border border-red-600/15 rounded-xl px-4 py-3.5">
        <div className="text-xs font-bold text-red-600 mb-2">🐺 읽는 법</div>
        <div className="text-xs leading-relaxed opacity-70">
          <strong>인바운드 증가 + 원화 약세</strong>가 동시에 진행되면 외국인 관광객의 한국 내 구매력이 극대화됨.
          일본 사례에서 엔화 약세 + 방일 4,000만 명이 세이코 등 소비주 랠리의 핵심 드라이버였음.
          Top 3 국가의 통화가 원화 대비 강세(환율 상승)일수록 인바운드 소비 수혜 확대.
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════
// 메인: 탭 컨테이너
// ════════════════════════════════
const TABS = [
  { key: "consumer", label: "소비주", icon: "📈" },
  { key: "inbound", label: "인바운드 & 환율", icon: "✈️" },
];

export default function MarketDashboard() {
  const [tab, setTab] = useState("consumer");

  return (
    <div className="min-h-screen bg-[#08080f] text-gray-300">
      <div className="border-b border-red-900/30 px-4 sm:px-6 py-3 flex items-center justify-between flex-wrap gap-2"
        style={{ background: "linear-gradient(90deg, rgba(220,38,38,0.1) 0%, transparent 60%)" }}>
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🐺</span>
          <span className="text-[13px] font-extrabold tracking-wider uppercase text-red-600">
            늑대무리원정단
            <span className="text-[10px] opacity-40 ml-2 font-normal normal-case tracking-normal">CONTROL TOWER · MARKET</span>
          </span>
        </div>
      </div>

      <div className="max-w-[960px] mx-auto px-4 py-5">
        <h1 className="text-[22px] font-black text-gray-100 leading-tight">한국 소비주 모니터링</h1>
        <p className="text-xs opacity-40 mt-0.5 mb-4">탑다운으로 가보자고 #4 — 한국의 명품 소비주 찾기</p>

        {/* 탭 */}
        <div className="flex gap-1 mb-5 border-b border-white/[.06] pb-0">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-[13px] font-semibold transition-all border-b-2 -mb-px ${tab === t.key ? "border-red-600 text-red-400" : "border-transparent text-gray-600 hover:text-gray-400"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === "consumer" && <ConsumerTab />}
        {tab === "inbound" && <InboundTab />}

        <div className="text-center text-[10px] opacity-30 py-3 mt-4">
          탑다운으로 가보자고 #4 — 한국의 명품 소비주 찾기
        </div>
      </div>
    </div>
  );
}
