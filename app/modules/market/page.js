"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
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
import {
  SEED_VALUATION, SEED_EVENTS, EVENT_CATEGORY,
  indexValueup, formatDateLabel as fmtVal,
} from "@/lib/valuation-constants";

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

function RangeButtons({ range, setRange }) {
  return (
    <div className="flex gap-1">
      {RANGE_PRESETS.map((p) => (
        <button key={p.label} onClick={() => setRange(p.months)}
          className={`px-3.5 py-1 rounded-md text-xs font-semibold border transition-all ${range === p.months ? "border-red-600/50 bg-red-600/15 text-red-400" : "border-white/[.06] bg-white/[.02] text-gray-500 hover:text-gray-300"}`}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

function UpdateButton({ loading, onClick }) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[12px] font-bold text-white transition-all ${loading ? "bg-gray-600 cursor-wait opacity-60" : "bg-gradient-to-br from-red-600 to-red-800 border border-red-600/50 hover:shadow-[0_0_20px_rgba(220,38,38,0.3)]"}`}>
      {loading ? <><span className="animate-spin inline-block">⟳</span> 분석 중...</> : <>⚡ AI 업데이트</>}
    </button>
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
      log("✅ 완료!");
    } catch (err) { log(`❌ ${err.message}`); } finally { setLoading(false); }
  }, []);

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <RangeButtons range={range} setRange={setRange} />
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
        <UpdateButton loading={loading} onClick={handleUpdate} />
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

function SingleCurrencyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[rgba(10,10,18,0.96)] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-400 backdrop-blur-md">
      <div className="font-bold text-white mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }} className="flex justify-between gap-3 my-0.5">
          <span>{p.name}</span>
          <span className="font-semibold">{Number(p.value).toLocaleString()} 원</span>
        </div>
      ))}
    </div>
  );
}

function CurrencyMiniChart({ data, currencyCode, info }) {
  const values = data.map((d) => d[currencyCode]).filter(Boolean);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.15 || 5;
  const domainMin = Math.floor(min - pad);
  const domainMax = Math.ceil(max + pad);
  const latest = values[values.length - 1];
  const prev = values[values.length - 2];
  const chg = latest && prev ? ((latest - prev) / prev * 100).toFixed(1) : "—";
  return (
    <div className="bg-white/[.015] border border-white/[.06] rounded-2xl pt-3 pr-1 pb-2">
      <div className="flex items-center justify-between px-4 mb-1">
        <div className="flex items-center gap-2 text-[12px] font-bold opacity-80">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: info.color, boxShadow: `0 0 6px ${info.color}` }} />
          <span>{info.symbol}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-bold" style={{ color: info.color }}>{latest?.toLocaleString()}</span>
          <span className={`${Number(chg) > 0 ? "text-red-400" : "text-blue-400"} font-semibold`}>
            {Number(chg) > 0 ? "▲" : "▼"} {Math.abs(Number(chg))}%
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis domain={[domainMin, domainMax]} tick={{ fill: "#555", fontSize: 9 }} tickLine={false} axisLine={false} width={45} />
          <Tooltip content={<SingleCurrencyTooltip />} />
          <Line type="monotone" dataKey={currencyCode} name={info.symbol} stroke={info.color} strokeWidth={2} dot={false} activeDot={{ r: 3, fill: info.color }} />
        </LineChart>
      </ResponsiveContainer>
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
  const countryToCurrency = { CN: "CNY", JP: "JPY", US: "USD", TW: "TWD" };
  const topCurrencies = [...new Set(topCountries.map((c) => countryToCurrency[c]).filter(Boolean))];
  const latest = pivoted[pivoted.length - 1] || {};
  const prev = pivoted[pivoted.length - 2] || {};
  const totalChg = latest.total && prev.total ? ((latest.total - prev.total) / prev.total * 100).toFixed(1) : "—";

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
        <RangeButtons range={range} setRange={setRange} />
        <UpdateButton loading={loading} onClick={handleUpdate} />
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
      <div className="flex items-center gap-2 px-1 mb-3 text-[13px] font-bold opacity-80">
        <span>💱 Top 방한국 통화 vs 원화</span>
        <span className="text-[10px] opacity-40">원화 약세(상승) = 인바운드 구매력 ↑</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {topCurrencies.map((c) => (
          <CurrencyMiniChart key={c} data={chartCurrency} currencyCode={c} info={CURRENCY_LABELS[c]} />
        ))}
      </div>
      <div className="bg-red-600/[.04] border border-red-600/15 rounded-xl px-4 py-3.5">
        <div className="text-xs font-bold text-red-600 mb-2">🐺 읽는 법</div>
        <div className="text-xs leading-relaxed opacity-70">
          <strong>인바운드 증가 + 원화 약세</strong>가 동시에 진행되면 외국인 관광객의 한국 내 구매력이 극대화됨.
          환율 차트가 <strong>우상향(원화 약세)</strong>이면서 바 차트가 성장하는 구간이 소비주 최대 수혜 구간.
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════
// Tab 3: 밸류에이션 & 주주환원
// ════════════════════════════════
function ValTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[rgba(10,10,18,0.96)] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-gray-400 backdrop-blur-md min-w-[140px]">
      <div className="font-bold text-white mb-1.5">{label}</div>
      {payload.filter(p => p.value != null).map((p, i) => (
        <div key={i} style={{ color: p.color }} className="flex justify-between gap-3 my-0.5">
          <span>{p.name}</span>
          <span className="font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function EventTimeline({ events }) {
  if (!events?.length) return null;
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  return (
    <div className="bg-white/[.015] border border-white/[.06] rounded-2xl px-5 py-4 mb-4">
      <div className="text-[13px] font-bold opacity-80 mb-3">📋 밸류업 이벤트 타임라인</div>
      <div className="space-y-3">
        {sorted.map((ev, i) => {
          const cat = EVENT_CATEGORY[ev.category] || EVENT_CATEGORY.policy;
          const impactColor = ev.impact === "positive" ? "text-green-400" : ev.impact === "negative" ? "text-red-400" : "text-gray-500";
          return (
            <div key={i} className="flex gap-3 items-start">
              <div className="flex flex-col items-center mt-0.5">
                <span className="text-sm">{cat.icon}</span>
                {i < sorted.length - 1 && <div className="w-px h-full bg-white/[.06] mt-1" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] text-gray-500">{ev.date}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>{cat.label}</span>
                  <span className={`text-[9px] font-bold ${impactColor}`}>{ev.impact === "positive" ? "▲" : ev.impact === "negative" ? "▼" : "—"}</span>
                </div>
                <div className="text-[12px] font-semibold text-gray-200">{ev.title}</div>
                {ev.description && <div className="text-[11px] text-gray-500 mt-0.5">{ev.description}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ValuationTab() {
  const [valData, setValData] = useState(SEED_VALUATION);
  const [events, setEvents] = useState(SEED_EVENTS);
  const [range, setRange] = useState(12);
  const [loading, setLoading] = useState(false);
  const [aiLog, setAiLog] = useState("");
  const [showLog, setShowLog] = useState(false);
  const logRef = useRef(null);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [aiLog]);

  useEffect(() => {
    async function load() {
      try {
        const { data: m, error: e1 } = await supabase.from("valuation_metrics").select("*").order("date", { ascending: true });
        const { data: ev, error: e2 } = await supabase.from("valueup_events").select("*").order("date", { ascending: false });
        if (!e1 && m?.length > 0) setValData(m.map((r) => ({
          date: r.date, kospi_pbr: Number(r.kospi_pbr), kospi_div_yield: Number(r.kospi_div_yield),
          total_dividend: r.total_dividend ? Number(r.total_dividend) : null,
          valueup_index: r.valueup_index ? Number(r.valueup_index) : null,
          kospi_close: Number(r.kospi_close), pbr_below1_pct: r.pbr_below1_pct ? Number(r.pbr_below1_pct) : null,
          valueup_corps_count: r.valueup_corps_count ? Number(r.valueup_corps_count) : null,
        })));
        if (!e2 && ev?.length > 0) setEvents(ev);
      } catch { console.log("[valuation] 시드 데이터 사용"); }
    }
    load();
  }, []);

  const filtered = range >= 999 ? valData : valData.slice(-range);
  const indexed = indexValueup(filtered);
  const chart = indexed.map((d) => ({ ...d, label: fmtVal(d.date) }));

  const latest = valData[valData.length - 1] || {};
  const prev = valData[valData.length - 2] || {};
  const pbrChg = latest.kospi_pbr && prev.kospi_pbr ? (latest.kospi_pbr - prev.kospi_pbr).toFixed(2) : "—";
  const vuChg = latest.valueup_index && prev.valueup_index ? ((latest.valueup_index - prev.valueup_index) / prev.valueup_index * 100).toFixed(1) : "—";

  const latestDiv = [...valData].reverse().find(d => d.total_dividend != null);
  const prevDiv = latestDiv ? [...valData].reverse().find(d => d.total_dividend != null && d.date < latestDiv.date) : null;
  const divChg = latestDiv?.total_dividend && prevDiv?.total_dividend
    ? ((latestDiv.total_dividend - prevDiv.total_dividend) / prevDiv.total_dividend * 100).toFixed(1) : "—";

  const pbrValues = filtered.map(d => d.kospi_pbr).filter(Boolean);
  const pbrMin = Math.floor((Math.min(...pbrValues) - 0.05) * 20) / 20;
  const pbrMax = Math.ceil((Math.max(...pbrValues) + 0.05) * 20) / 20;

  const below1Values = filtered.map(d => d.pbr_below1_pct).filter(Boolean);
  const below1Min = Math.floor(Math.min(...below1Values) - 2);
  const below1Max = Math.ceil(Math.max(...below1Values) + 2);

  const handleUpdate = useCallback(async () => {
    setLoading(true); setAiLog(""); setShowLog(true);
    const log = (m) => setAiLog((p) => p + m + "\n");
    try {
      log("🔍 /api/valuation-update 호출 중...");
      const res = await fetch("/api/valuation-update", { method: "POST" });
      const body = await res.json();
      if (!body.ok) { log(`⚠️ 실패: ${body.error}`); return; }
      log("✅ 수신 완료");
      if (body.parsed?.metrics) {
        const m = body.parsed.metrics;
        log(`  PBR: ${m.kospi_pbr}x / 배당수익률: ${m.kospi_div_yield}%`);
        log(`  밸류업지수: ${m.valueup_index}`);
        if (m.total_dividend) log(`  총 배당: ${m.total_dividend}조원`);
      }
      if (body.parsed?.events?.length) log(`  이벤트 ${body.parsed.events.length}건 추가`);
      if (body.parsed?.notes) log(`  💬 ${body.parsed.notes}`);
      if (body.metrics?.length) setValData(body.metrics.map((r) => ({
        date: r.date, kospi_pbr: Number(r.kospi_pbr), kospi_div_yield: Number(r.kospi_div_yield),
        total_dividend: r.total_dividend ? Number(r.total_dividend) : null,
        valueup_index: r.valueup_index ? Number(r.valueup_index) : null,
        kospi_close: Number(r.kospi_close), pbr_below1_pct: r.pbr_below1_pct ? Number(r.pbr_below1_pct) : null,
        valueup_corps_count: r.valueup_corps_count ? Number(r.valueup_corps_count) : null,
      })));
      if (body.events?.length) setEvents(body.events);
      log("✅ 완료!");
    } catch (err) { log(`❌ ${err.message}`); } finally { setLoading(false); }
  }, []);

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <RangeButtons range={range} setRange={setRange} />
        <UpdateButton loading={loading} onClick={handleUpdate} />
      </div>
      <LogPanel aiLog={aiLog} showLog={showLog} logRef={logRef} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <StatCard label="KOSPI PBR" value={`${latest.kospi_pbr?.toFixed(2)}x`} sub={`MoM ${Number(pbrChg) > 0 ? "+" : ""}${pbrChg}`} accent="#60a5fa" />
        <StatCard label="총 배당금액" value={`${latestDiv?.total_dividend || "—"}조`} sub={`YoY ${Number(divChg) > 0 ? "+" : ""}${divChg}%`} accent="#22c55e" />
        <StatCard label="밸류업지수" value={latest.valueup_index?.toLocaleString() || "—"} sub={`MoM ${Number(vuChg) > 0 ? "+" : ""}${vuChg}%`} accent="#f97316" />
        <StatCard label="PBR<1 비율" value={`${latest.pbr_below1_pct || "—"}%`} sub={`공시 ${latest.valueup_corps_count || "—"}개사`} accent={latest.pbr_below1_pct < 60 ? "#4ade80" : "#f87171"} />
      </div>

      {/* 밸류업지수 vs KOSPI */}
      <div className="bg-white/[.015] border border-white/[.06] rounded-2xl pt-4 pr-1 pb-2 mb-4">
        <div className="flex items-center gap-2 px-5 mb-2 text-[13px] font-bold opacity-80">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_6px_#f97316]" /><span>밸류업지수</span>
          <span className="opacity-30 mx-0.5">vs</span>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_#60a5fa]" /><span>KOSPI</span>
          <span className="text-[10px] opacity-40 ml-2">(밸류업지수 출범 = 100)</span>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chart} margin={{ top: 10, right: 24, left: 8, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} />
            <YAxis tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip content={<ValTooltip />} />
            <ReferenceLine y={100} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="kospiIdx" name="KOSPI" stroke="#60a5fa" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="valueupIdx" name="밸류업지수" stroke="#f97316" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="line" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 주주환원 듀얼 차트 */}
      <div className="bg-white/[.015] border border-white/[.06] rounded-2xl pt-4 pr-1 pb-2 mb-4">
        <div className="flex items-center gap-2 px-5 mb-1 text-[13px] font-bold opacity-80">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_#22c55e]" /><span>배당수익률</span>
          <span className="opacity-30 mx-0.5">+</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" /><span>총 배당금액</span>
        </div>
        <div className="px-5 mb-2 text-[10px] opacity-40">
          배당수익률 ↓ + 총 배당금액 ↑ = 주가 리레이팅 진행 중 (좋은 신호) · 둘 다 ↓ = 위험 신호
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chart} margin={{ top: 10, right: 24, left: 8, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} />
            <YAxis yAxisId="yield" tick={{ fill: "#22c55e", fontSize: 10 }} tickLine={false} axisLine={false}
              domain={[0.8, 2.5]} tickFormatter={(v) => `${v}%`} />
            <YAxis yAxisId="total" orientation="right" tick={{ fill: "#10b981", fontSize: 10 }} tickLine={false} axisLine={false}
              domain={[20, 40]} tickFormatter={(v) => `${v}조`} />
            <Tooltip content={<ValTooltip />} />
            <Line type="monotone" dataKey="kospi_div_yield" name="배당수익률(%)" stroke="#22c55e" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} yAxisId="yield" />
            <Line type="stepAfter" dataKey="total_dividend" name="총 배당금액(조원)" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} yAxisId="total" connectNulls={false} strokeDasharray="6 3" />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="line" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* PBR + PBR<1 비율 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="bg-white/[.015] border border-white/[.06] rounded-2xl pt-3 pr-1 pb-2">
          <div className="flex items-center justify-between px-4 mb-1">
            <div className="text-[12px] font-bold opacity-80">KOSPI PBR</div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-blue-400">{latest.kospi_pbr?.toFixed(2)}x</span>
              {latest.kospi_pbr >= 1 && <span className="text-[9px] text-green-400 font-semibold">1배 돌파 ✓</span>}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chart} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="pbrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis domain={[pbrMin, pbrMax]} tick={{ fill: "#555", fontSize: 9 }} tickLine={false} axisLine={false} width={35} />
              <Tooltip content={<ValTooltip />} />
              <ReferenceLine y={1} stroke="rgba(239,68,68,0.4)" strokeDasharray="3 3" label={{ value: "1x", position: "left", fill: "#ef4444", fontSize: 9, opacity: 0.6 }} />
              <Area type="monotone" dataKey="kospi_pbr" name="PBR" stroke="#60a5fa" strokeWidth={2} fill="url(#pbrGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white/[.015] border border-white/[.06] rounded-2xl pt-3 pr-1 pb-2">
          <div className="flex items-center justify-between px-4 mb-1">
            <div className="text-[12px] font-bold opacity-80">PBR{'<'}1 비율</div>
            <span className={`text-[11px] font-bold ${latest.pbr_below1_pct < 60 ? "text-green-400" : "text-red-400"}`}>
              {latest.pbr_below1_pct}%
            </span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chart} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="belowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis domain={[below1Min, below1Max]} tick={{ fill: "#555", fontSize: 9 }} tickLine={false} axisLine={false} width={35} />
              <Tooltip content={<ValTooltip />} />
              <ReferenceLine y={50} stroke="rgba(74,222,128,0.3)" strokeDasharray="3 3" label={{ value: "50%", position: "left", fill: "#4ade80", fontSize: 9, opacity: 0.6 }} />
              <Area type="monotone" dataKey="pbr_below1_pct" name="PBR<1 비율(%)" stroke="#f87171" strokeWidth={2} fill="url(#belowGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <EventTimeline events={events} />

      <div className="bg-red-600/[.04] border border-red-600/15 rounded-xl px-4 py-3.5">
        <div className="text-xs font-bold text-red-600 mb-2">🐺 읽는 법</div>
        <div className="text-xs leading-relaxed opacity-70">
          <strong>밸류업지수가 KOSPI를 아웃퍼폼</strong>하면 주주환원 기업이 프리미엄 받기 시작했다는 신호.
          배당 차트는 두 선을 같이 봐야 함: <strong>배당수익률이 하락하더라도 총 배당금액이 증가</strong>하면 주가 상승(리레이팅)이 배당 증가보다 빠른 것 — 이건 좋은 신호.
          진짜 위험한 건 총 배당금액도 같이 줄어드는 경우.
          <strong> PBR{'<'}1 비율 하락</strong>은 밸류업이 작동 중이라는 증거. 50% 아래 = 구조적 전환.
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
  { key: "valuation", label: "밸류업 & 주주환원", icon: "💎" },
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

        <div className="flex gap-1 mb-5 border-b border-white/[.06] pb-0 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-[13px] font-semibold transition-all border-b-2 -mb-px whitespace-nowrap ${tab === t.key ? "border-red-600 text-red-400" : "border-transparent text-gray-600 hover:text-gray-400"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === "consumer" && <ConsumerTab />}
        {tab === "inbound" && <InboundTab />}
        {tab === "valuation" && <ValuationTab />}

        <div className="text-center text-[10px] opacity-30 py-3 mt-4">
          탑다운으로 가보자고 #4 — 한국의 명품 소비주 찾기
        </div>
      </div>
    </div>
  );
}
