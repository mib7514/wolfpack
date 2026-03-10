"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// ── Kelly ──
function calcKelly(wp, wlr) {
  if (!wp || !wlr) return { full: 0, half: 0, quarter: 0 };
  const q = 1 - wp;
  const k = Math.max(0, Math.min((wp * wlr - q) / wlr, 1));
  return { full: +(k * 100).toFixed(1), half: +(k * 50).toFixed(1), quarter: +(k * 25).toFixed(1) };
}

// ── Constants ──
const ST = {
  WATCHING: { label: "Watching", icon: "👁", c: "#6b8aad" },
  STALKING: { label: "Stalking", icon: "🐺", c: "#d4a843" },
  ENTERED: { label: "Entered", icon: "⚡", c: "#4ade80" },
  EXITED:  { label: "Exited",  icon: "🚪", c: "#94a3b8" },
  KILLED:  { label: "Killed",  icon: "💀", c: "#ef4444" },
};

const CC = {
  BTC_TREASURY:"#f7931a",AI_INFRA:"#8b5cf6",AI_APP:"#a78bfa",BIOTECH:"#10b981",
  SPAC:"#f59e0b",IPO:"#ec4899",ROBOTICS:"#06b6d4",ENERGY:"#84cc16",
  FINTECH:"#3b82f6",CRYPTO:"#eab308",SEMI:"#6366f1",OTHER:"#6b7280",
};

// ── DB helpers ──
async function dbFetch() {
  const { data } = await supabase.from("radar_stocks").select("*").order("added_at", { ascending: false });
  return data || [];
}
async function dbInsert(stock) {
  const { data } = await supabase.from("radar_stocks").insert(stock).select().single();
  return data;
}
async function dbUpdate(id, updates) {
  await supabase.from("radar_stocks").update(updates).eq("id", id);
}
async function dbDelete(id) {
  await supabase.from("radar_stocks").delete().eq("id", id);
}

// ── Score Ring ──
function ScoreRing({ score, size = 44 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circ * (1 - pct / 100);
  const color = pct >= 70 ? "#4ade80" : pct >= 40 ? "#d4a843" : "#ef4444";
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dashoffset 0.5s" }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={size * 0.3} fontWeight={800} fontFamily="monospace">{Math.round(pct)}</text>
    </svg>
  );
}

// ── Indicator Score Slider ──
function IndicatorRow({ ind, onChange }) {
  const score = ind.score ?? 50;
  const color = score >= 70 ? "#4ade80" : score >= 40 ? "#d4a843" : "#ef4444";
  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono"
            style={{ background: ind.type === "auto" ? "#8b5cf620" : "#d4a84320", color: ind.type === "auto" ? "#8b5cf6" : "#d4a843" }}>
            {ind.type === "auto" ? "AUTO" : "MANUAL"}
          </span>
          <span className="text-[11px] font-semibold text-slate-300 truncate">{ind.name}</span>
        </div>
        <div className="text-[9px] text-slate-600 mt-0.5">목표: {ind.target} · 가중치 {ind.weight}%</div>
      </div>
      <input type="range" min={0} max={100} step={5} value={score}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-20 h-1 rounded appearance-none cursor-pointer"
        style={{ accentColor: color, background: `linear-gradient(to right, ${color} ${score}%, #1a2030 ${score}%)` }} />
      <span className="text-sm font-mono font-bold w-8 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

// ── Detail Panel ──
function DetailPanel({ stock, onClose, onUpdate, onDelete }) {
  const thesis = stock.thesis_json || {};
  const indicators = stock.indicators || [];
  const [localIndicators, setLocalIndicators] = useState(indicators);
  const [showAddIndicator, setShowAddIndicator] = useState(false);
  const [newInd, setNewInd] = useState({ name: "", type: "manual", target: "", weight: 10 });

  useEffect(() => {
    setLocalIndicators(stock.indicators || []);
  }, [stock]);

  const totalScore = localIndicators.length > 0
    ? Math.round(localIndicators.reduce((s, i) => s + (i.score ?? 50) * (i.weight || 1), 0) / Math.max(1, localIndicators.reduce((s, i) => s + (i.weight || 1), 0)))
    : 0;

  const handleIndicatorChange = (idx, score) => {
    const updated = [...localIndicators];
    updated[idx] = { ...updated[idx], score };
    setLocalIndicators(updated);
    onUpdate({ ...stock, indicators: updated });
    dbUpdate(stock.id, { indicators: updated });
  };

  const addIndicator = () => {
    if (!newInd.name) return;
    const updated = [...localIndicators, { ...newInd, score: 50 }];
    setLocalIndicators(updated);
    onUpdate({ ...stock, indicators: updated });
    dbUpdate(stock.id, { indicators: updated });
    setNewInd({ name: "", type: "manual", target: "", weight: 10 });
    setShowAddIndicator(false);
  };

  const removeIndicator = (idx) => {
    const updated = localIndicators.filter((_, i) => i !== idx);
    setLocalIndicators(updated);
    onUpdate({ ...stock, indicators: updated });
    dbUpdate(stock.id, { indicators: updated });
  };

  const kelly = calcKelly(stock.kelly_win_prob, stock.kelly_wl_ratio);
  const st = ST[stock.status] || ST.WATCHING;

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex justify-end" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-[#0d1220] h-full overflow-y-auto border-l border-white/[0.06]">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0d1220]/95 backdrop-blur-md border-b border-white/[0.04] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <ScoreRing score={totalScore} size={52} />
              <div>
                <div className="text-lg font-extrabold font-mono text-slate-100">{stock.ticker}</div>
                <div className="text-[11px] text-slate-500">{stock.name} · {stock.exchange}</div>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-600 hover:text-slate-300 text-xl">✕</button>
          </div>
          <div className="text-[12px] text-slate-400 italic">{stock.thesis_oneliner || "—"}</div>

          {/* Status buttons */}
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {Object.entries(ST).map(([key, { label, icon, c }]) => (
              <button key={key}
                onClick={() => { onUpdate({ ...stock, status: key }); dbUpdate(stock.id, { status: key }); }}
                className="px-2 py-1 rounded-md text-[10px] font-semibold border transition-all"
                style={{
                  borderColor: stock.status === key ? c : `${c}22`,
                  background: stock.status === key ? `${c}15` : "transparent",
                  color: stock.status === key ? c : "#4a5568",
                }}>{icon} {label}</button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* Score Summary */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-center">
            <div className="text-[10px] text-slate-600 tracking-wider font-mono mb-2">MONITORING SCORE</div>
            <div className="text-4xl font-black font-mono" style={{ color: totalScore >= 70 ? "#4ade80" : totalScore >= 40 ? "#d4a843" : "#ef4444" }}>
              {totalScore}<span className="text-lg opacity-50">/100</span>
            </div>
            <div className="text-[10px] text-slate-600 mt-1">{localIndicators.length}개 지표 · 가중평균</div>
          </div>

          {/* Monitoring Indicators */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-bold text-slate-400 tracking-wider font-mono">MONITORING INDICATORS</div>
              <button onClick={() => setShowAddIndicator(!showAddIndicator)}
                className="text-[10px] px-2 py-1 rounded border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 transition">
                + 추가
              </button>
            </div>

            {showAddIndicator && (
              <div className="bg-black/30 rounded-lg p-3 mb-3 space-y-2">
                <input value={newInd.name} onChange={e => setNewInd(p => ({...p, name: e.target.value}))}
                  placeholder="지표명 (예: 매출 성장률)"
                  className="w-full px-2 py-1.5 bg-black/40 border border-white/10 rounded text-xs text-slate-200 outline-none" />
                <div className="flex gap-2">
                  <select value={newInd.type} onChange={e => setNewInd(p => ({...p, type: e.target.value}))}
                    className="px-2 py-1.5 bg-black/40 border border-white/10 rounded text-xs text-slate-300 outline-none">
                    <option value="auto">Auto</option>
                    <option value="manual">Manual</option>
                  </select>
                  <input value={newInd.target} onChange={e => setNewInd(p => ({...p, target: e.target.value}))}
                    placeholder="목표 (예: >20%)"
                    className="flex-1 px-2 py-1.5 bg-black/40 border border-white/10 rounded text-xs text-slate-200 outline-none" />
                  <input type="number" value={newInd.weight} onChange={e => setNewInd(p => ({...p, weight: parseInt(e.target.value)||10}))}
                    className="w-16 px-2 py-1.5 bg-black/40 border border-white/10 rounded text-xs text-slate-200 outline-none"
                    placeholder="가중치" />
                </div>
                <button onClick={addIndicator}
                  className="w-full py-1.5 rounded text-xs font-bold bg-amber-600/20 text-amber-500 border border-amber-500/30 hover:bg-amber-600/30">
                  등록
                </button>
              </div>
            )}

            {localIndicators.length === 0 ? (
              <div className="text-center py-6 text-slate-600 text-xs">
                등록된 모니터링 지표가 없습니다
              </div>
            ) : (
              localIndicators.map((ind, i) => (
                <div key={i} className="group relative">
                  <IndicatorRow ind={ind} onChange={(score) => handleIndicatorChange(i, score)} />
                  <button onClick={() => removeIndicator(i)}
                    className="absolute right-0 top-1 text-[8px] text-red-400/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition">✕</button>
                </div>
              ))
            )}
          </div>

          {/* Thesis */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-3">
            <div className="text-[11px] font-bold text-slate-400 tracking-wider font-mono mb-2">THESIS</div>
            {[
              { label: "▲ BULL CASE", color: "#4ade80", text: thesis.bull_case },
              { label: "▼ BEAR CASE", color: "#ef4444", text: thesis.bear_case },
              { label: "⚡ CATALYSTS", color: "#d4a843", text: thesis.catalysts },
              { label: "📊 KEY METRICS", color: "#8b5cf6", text: thesis.key_metrics },
              { label: "🎯 ENTRY / EXIT", color: "#06b6d4", text: thesis.entry_exit },
            ].map(({ label, color, text }) => text && (
              <div key={label}>
                <div className="text-[10px] font-bold mb-1" style={{ color }}>{label}</div>
                <div className="text-[11px] text-slate-400 leading-relaxed whitespace-pre-wrap">{text}</div>
              </div>
            ))}
          </div>

          {/* Kelly */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <div className="text-[11px] font-bold text-slate-400 tracking-wider font-mono mb-2">KELLY CRITERION</div>
            <div className="flex gap-4 text-center">
              {[
                { label: "Full Kelly", value: kelly.full },
                { label: "Half Kelly", value: kelly.half },
                { label: "Quarter Kelly", value: kelly.quarter },
              ].map(({ label, value }) => (
                <div key={label} className="flex-1 bg-black/20 rounded-lg py-2">
                  <div className="text-lg font-mono font-bold text-amber-500">{value}%</div>
                  <div className="text-[9px] text-slate-600">{label}</div>
                </div>
              ))}
            </div>
            <div className="text-[9px] text-slate-600 mt-2 text-center font-mono">
              Win Prob: {((stock.kelly_win_prob || 0.5) * 100).toFixed(0)}% · W/L Ratio: {(stock.kelly_wl_ratio || 2.0).toFixed(1)}x
            </div>
          </div>

          {/* Delete */}
          <div className="flex justify-end">
            <button onClick={() => { onDelete(stock.id); dbDelete(stock.id); onClose(); }}
              className="px-4 py-2 rounded-md text-xs border border-red-500/20 text-red-400 hover:bg-red-500/10 transition">
              종목 삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stock Card ──
function StockCard({ stock, onClick }) {
  const st = ST[stock.status] || ST.WATCHING;
  const cat = stock.category || "OTHER";
  const indicators = stock.indicators || [];
  const totalScore = indicators.length > 0
    ? Math.round(indicators.reduce((s, i) => s + (i.score ?? 50) * (i.weight || 1), 0) / Math.max(1, indicators.reduce((s, i) => s + (i.weight || 1), 0)))
    : 0;

  return (
    <div onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03] hover:border-white/[0.08] transition-all cursor-pointer">
      <ScoreRing score={totalScore} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-extrabold text-slate-100 font-mono">{stock.ticker}</span>
          <span className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold border"
            style={{ background: `${CC[cat]}15`, color: CC[cat], borderColor: `${CC[cat]}33` }}>{cat}</span>
          <span className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold"
            style={{ background: `${st.c}15`, color: st.c }}>{st.icon} {st.label}</span>
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5 truncate">{stock.thesis_oneliner || "—"}</div>
      </div>
      <div className="text-[10px] text-slate-600">▶</div>
    </div>
  );
}

// ── Main Page ──
export default function RadarPage() {
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [sFilter, setSFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => { dbFetch().then(d => { setStocks(d); setLoading(false); }); }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const res = await fetch("/api/radar/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResult(data);
      } else {
        setSearchResult({ error: "검색 실패" });
      }
    } catch (e) {
      setSearchResult({ error: e.message });
    }
    setSearching(false);
  }, [searchQuery]);

  const handleRegister = useCallback(async (result) => {
    const row = {
      ticker: result.ticker,
      exchange: result.exchange || "NYSE",
      name: result.name || result.ticker,
      category: result.category || "OTHER",
      status: "WATCHING",
      thesis_oneliner: result.thesis_oneliner || "",
      thesis_json: {
        bull_case: result.bull_case || "",
        bear_case: result.bear_case || "",
        catalysts: result.catalysts || "",
        key_metrics: result.key_metrics || "",
        entry_exit: result.entry_exit || "",
      },
      indicators: (result.suggested_indicators || []).map(ind => ({ ...ind, score: 50 })),
      kelly_win_prob: result.win_prob || 0.5,
      kelly_wl_ratio: result.wl_ratio || 2.0,
    };
    const saved = await dbInsert(row);
    if (saved) {
      setStocks(prev => [saved, ...prev]);
      setSearchResult(null);
      setSearchQuery("");
    }
  }, []);

  const filtered = stocks.filter(s => sFilter === "ALL" || s.status === sFilter);
  const counts = stocks.reduce((a, s) => { a[s.status] = (a[s.status] || 0) + 1; return a; }, {});
  const existingTickers = new Set(stocks.map(s => s.ticker));

  return (
    <div className="min-h-screen bg-[#0a0e18] text-slate-200">
      <header className="sticky top-0 z-40 border-b border-white/[0.04] bg-[#0a0e18]/95 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <Link href="/" className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors">← Control Tower</Link>
              <h1 className="text-lg font-extrabold font-mono text-amber-500 tracking-[3px] mt-1">🐺 WOLF RADAR</h1>
              <p className="text-[11px] text-slate-600 mt-0.5">종목 검색 · 등록 · 모니터링 · {stocks.length}개 추적 중</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex gap-2 mb-3">
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="종목명 또는 티커 검색... (예: TSLA, 삼성전자, NVDA)"
              className="flex-1 px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 outline-none focus:border-amber-500/50 transition-colors placeholder:text-slate-700"
            />
            <button onClick={handleSearch} disabled={searching || !searchQuery.trim()}
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold font-mono tracking-wider disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#d4a843,#b8860b)", color: "#0a0e18" }}>
              {searching ? "🔍..." : "🔍 검색"}
            </button>
          </div>

          {/* Search Result */}
          {searching && (
            <div className="text-center py-4 text-amber-500 text-sm animate-pulse font-mono">
              AI가 종목을 분석하고 있습니다...
            </div>
          )}

          {searchResult && !searchResult.error && (
            <div className="bg-[#13172a] border border-amber-500/20 rounded-xl p-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-lg font-extrabold font-mono text-slate-100">{searchResult.ticker}</span>
                  <span className="text-xs text-slate-500 ml-2">{searchResult.name} · {searchResult.exchange}</span>
                </div>
                {existingTickers.has(searchResult.ticker) ? (
                  <span className="text-[10px] text-slate-500 font-mono">이미 등록됨</span>
                ) : (
                  <button onClick={() => handleRegister(searchResult)}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-600/20 text-amber-500 border border-amber-500/30 hover:bg-amber-600/30 transition">
                    + 등록
                  </button>
                )}
              </div>
              <div className="text-[12px] text-amber-400/80 italic mb-2">{searchResult.thesis_oneliner}</div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                {searchResult.bull_case && (
                  <div className="bg-green-500/5 border border-green-500/10 rounded p-2">
                    <div className="text-green-400 font-bold mb-1">▲ Bull Case</div>
                    <div className="text-slate-400 leading-relaxed">{searchResult.bull_case?.slice(0, 120)}...</div>
                  </div>
                )}
                {searchResult.bear_case && (
                  <div className="bg-red-500/5 border border-red-500/10 rounded p-2">
                    <div className="text-red-400 font-bold mb-1">▼ Bear Case</div>
                    <div className="text-slate-400 leading-relaxed">{searchResult.bear_case?.slice(0, 120)}...</div>
                  </div>
                )}
              </div>
              {searchResult.suggested_indicators && (
                <div className="mt-2 text-[9px] text-slate-600">
                  추천 모니터링 지표: {searchResult.suggested_indicators.map(i => i.name).join(" · ")}
                </div>
              )}
            </div>
          )}

          {searchResult?.error && (
            <div className="text-center py-3 text-red-400 text-xs">{searchResult.error}</div>
          )}

          {/* Status Filters */}
          {stocks.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setSFilter("ALL")}
                className={`px-3 py-1 rounded-full text-[10px] font-semibold border transition-all ${sFilter === "ALL" ? "border-slate-400/20 bg-slate-400/10 text-slate-300" : "border-white/[0.04] text-slate-600"}`}>
                ALL ({stocks.length})</button>
              {Object.entries(ST).map(([key, { icon, c }]) => (
                counts[key] ? (
                  <button key={key} onClick={() => setSFilter(sFilter === key ? "ALL" : key)}
                    className="px-3 py-1 rounded-full text-[10px] font-semibold border transition-all"
                    style={{
                      borderColor: sFilter === key ? `${c}55` : "rgba(255,255,255,0.04)",
                      background: sFilter === key ? `${c}12` : "transparent",
                      color: sFilter === key ? c : "#4a5568",
                    }}>{icon} {counts[key]}</button>
                ) : null
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 pb-24 flex flex-col gap-2.5">
        {loading ? (
          <div className="text-center py-20 text-slate-600 text-sm animate-pulse">로딩 중...</div>
        ) : stocks.length === 0 && !searchResult ? (
          <div className="flex flex-col items-center justify-center py-28 gap-6 opacity-80">
            <div className="text-6xl">🐺</div>
            <div className="text-center font-mono text-slate-500 leading-relaxed">
              Wolf Radar 활성화 대기 중<br />
              <span className="text-xs text-slate-600">위 검색창에서 종목을 검색하여 등록하세요</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-600 text-sm">필터 조건에 맞는 종목 없음</div>
        ) : (
          filtered.map(s => (
            <StockCard key={s.id} stock={s} onClick={() => setSelectedStock(s)} />
          ))
        )}
      </main>

      {selectedStock && (
        <DetailPanel
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
          onUpdate={u => {
            setStocks(prev => prev.map(p => p.id === u.id ? u : p));
            setSelectedStock(u);
          }}
          onDelete={id => {
            setStocks(prev => prev.filter(p => p.id !== id));
            setSelectedStock(null);
          }}
        />
      )}
    </div>
  );
}
