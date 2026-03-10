"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// ── Kelly ────────────────────────────────────
function calcKelly(wp, wlr) {
  if (!wp || !wlr) return { full: 0, half: 0, quarter: 0 };
  const q = 1 - wp;
  const k = Math.max(0, Math.min((wp * wlr - q) / wlr, 1));
  return { full: +(k * 100).toFixed(1), half: +(k * 50).toFixed(1), quarter: +(k * 25).toFixed(1) };
}

// ── Constants ────────────────────────────────
const ST = {
  WATCHING: { label: "Watching", icon: "👁", c: "#6b8aad" },
  STALKING: { label: "Stalking", icon: "🐺", c: "#d4a843" },
  ENTERED: { label: "Entered", icon: "⚡", c: "#4ade80" },
  EXITED:  { label: "Exited",  icon: "🚪", c: "#94a3b8" },
  KILLED:  { label: "Killed",  icon: "💀", c: "#ef4444" },
};

const CATS = ["BTC_TREASURY","AI_INFRA","AI_APP","BIOTECH","SPAC","IPO","ROBOTICS","ENERGY","FINTECH","CRYPTO","SEMI","OTHER"];
const CC = {
  BTC_TREASURY:"#f7931a",AI_INFRA:"#8b5cf6",AI_APP:"#a78bfa",BIOTECH:"#10b981",
  SPAC:"#f59e0b",IPO:"#ec4899",ROBOTICS:"#06b6d4",ENERGY:"#84cc16",
  FINTECH:"#3b82f6",CRYPTO:"#eab308",SEMI:"#6366f1",OTHER:"#6b7280",
};

// ── DB helpers ───────────────────────────────
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

// ── Kelly Panel ──────────────────────────────
function KellyPanel({ stock, onSave }) {
  const [wp, setWp] = useState(stock.kelly_win_prob || 0.5);
  const [wlr, setWlr] = useState(stock.kelly_wl_ratio || 2);
  const k = calcKelly(wp, wlr);

  return (
    <div className="mt-3 p-4 rounded-xl bg-black/30 border border-white/5">
      <div className="text-[10px] font-bold tracking-[3px] text-amber-500/80 mb-3 font-mono">KELLY CRITERION</div>
      <div className="grid grid-cols-2 gap-4 mb-3">
        <label>
          <div className="text-[10px] text-slate-500 mb-1">승률 (Win Prob)</div>
          <input type="range" min={0.05} max={0.95} step={0.05} value={wp}
            onChange={e => setWp(+e.target.value)}
            onMouseUp={() => onSave(wp, wlr)} onTouchEnd={() => onSave(wp, wlr)}
            className="w-full accent-amber-500" />
          <div className="text-sm text-center text-slate-300 font-mono">{(wp * 100).toFixed(0)}%</div>
        </label>
        <label>
          <div className="text-[10px] text-slate-500 mb-1">보상/손실 비율</div>
          <input type="range" min={0.5} max={10} step={0.25} value={wlr}
            onChange={e => setWlr(+e.target.value)}
            onMouseUp={() => onSave(wp, wlr)} onTouchEnd={() => onSave(wp, wlr)}
            className="w-full accent-amber-500" />
          <div className="text-sm text-center text-slate-300 font-mono">{wlr.toFixed(2)}x</div>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: "Full Kelly", v: k.full, border: "border-red-500/20", text: "text-red-400" },
          { l: "Half Kelly", v: k.half, border: "border-amber-500/20", text: "text-amber-400" },
          { l: "¼ Kelly", v: k.quarter, border: "border-emerald-500/20", text: "text-emerald-400" },
        ].map(({ l, v, border, text }) => (
          <div key={l} className={`bg-black/40 rounded-lg p-2 text-center border ${border}`}>
            <div className="text-[9px] text-slate-500">{l}</div>
            <div className={`text-lg font-extrabold font-mono ${text}`}>{v}%</div>
          </div>
        ))}
      </div>
      {k.full <= 0 && <div className="text-[10px] text-red-400 text-center mt-2">⚠ 음의 기대값 — 베팅 금지</div>}
    </div>
  );
}

// ── Thesis Block ─────────────────────────────
function ThesisBlock({ label, color, text }) {
  if (!text) return null;
  return (
    <div className="mb-3">
      <div className="text-[10px] font-bold mb-1" style={{ color }}>{label}</div>
      <div className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{text}</div>
    </div>
  );
}

// ── Stock Card ───────────────────────────────
function StockCard({ stock, expanded, onToggle, onUpdate, onDelete }) {
  const st = ST[stock.status] || ST.WATCHING;
  const cat = stock.category || "OTHER";
  const thesis = stock.thesis_json || {};

  return (
    <div className={`rounded-xl border transition-all duration-200 ${expanded ? "border-amber-500/25 shadow-[0_0_24px_rgba(212,168,67,0.06)]" : "border-white/[0.04] hover:border-white/[0.08]"}`}
      style={{ background: "linear-gradient(145deg,#13172a,#181d32)" }}>
      {/* Header */}
      <div onClick={onToggle} className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: st.c, boxShadow: `0 0 8px ${st.c}66` }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-extrabold text-slate-100 font-mono">{stock.ticker}</span>
            <span className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold border"
              style={{ background: `${CC[cat]}15`, color: CC[cat], borderColor: `${CC[cat]}33` }}>{cat}</span>
            <span className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold"
              style={{ background: `${st.c}15`, color: st.c }}>{st.icon} {st.label}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">{stock.thesis_oneliner || "—"}</div>
        </div>
        <span className={`text-[10px] text-slate-600 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>▼</span>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/[0.04]">
          {/* Status selector */}
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

          {/* Thesis */}
          <div className="mt-4">
            <ThesisBlock label="▲ BULL CASE" color="#4ade80" text={thesis.bull_case} />
            <ThesisBlock label="▼ BEAR CASE" color="#ef4444" text={thesis.bear_case} />
            <ThesisBlock label="⚡ CATALYSTS" color="#d4a843" text={thesis.catalysts} />
            <ThesisBlock label="📊 KEY METRICS" color="#8b5cf6" text={thesis.key_metrics} />
            <ThesisBlock label="🎯 ENTRY / EXIT" color="#06b6d4" text={thesis.entry_exit} />
          </div>

          {/* Kelly */}
          <KellyPanel stock={stock}
            onSave={(wp, wlr) => {
              onUpdate({ ...stock, kelly_win_prob: wp, kelly_wl_ratio: wlr });
              dbUpdate(stock.id, { kelly_win_prob: wp, kelly_wl_ratio: wlr });
            }} />

          {/* Delete */}
          <div className="flex justify-end mt-3">
            <button onClick={() => { onDelete(stock.id); dbDelete(stock.id); }}
              className="px-3 py-1.5 rounded-md text-[11px] border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors">삭제</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Modal ────────────────────────────────
function AddModal({ onClose, onAdd }) {
  const [ticker, setTicker] = useState("");
  const [exchange, setExchange] = useState("NYSE");
  const [category, setCategory] = useState("OTHER");
  const [loading, setLoading] = useState(false);

  const hunt = async () => {
    if (!ticker.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/radar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, exchange }),
      });
      const thesis = res.ok ? await res.json() : null;

      const row = {
        ticker: ticker.toUpperCase(),
        exchange,
        name: thesis?.name || ticker.toUpperCase(),
        category: thesis?.suggested_category || category,
        status: "WATCHING",
        thesis_oneliner: thesis?.thesis_oneliner || "",
        thesis_json: {
          bull_case: thesis?.bull_case || "",
          bear_case: thesis?.bear_case || "",
          catalysts: thesis?.catalysts || "",
          key_metrics: thesis?.key_metrics || "",
          entry_exit: thesis?.entry_exit || "",
        },
        kelly_win_prob: thesis?.win_prob || 0.5,
        kelly_wl_ratio: thesis?.wl_ratio || 2.0,
      };

      const saved = await dbInsert(row);
      if (saved) onAdd(saved);
      onClose();
    } catch (e) {
      console.error(e);
      const saved = await dbInsert({
        ticker: ticker.toUpperCase(), exchange, name: ticker.toUpperCase(),
        category, status: "WATCHING", thesis_oneliner: "", thesis_json: {},
        kelly_win_prob: 0.5, kelly_wl_ratio: 2.0,
      });
      if (saved) onAdd(saved);
      onClose();
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-5" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-amber-500/15 p-6 shadow-2xl"
        style={{ background: "linear-gradient(145deg,#13172a,#181d32)" }}>
        <div className="text-sm font-extrabold text-amber-500 font-mono tracking-[3px] mb-5">🐺 NEW TARGET</div>

        <div className="flex gap-2.5 mb-4">
          <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
            placeholder="TICKER" maxLength={10}
            className="flex-[2] px-3 py-2.5 bg-black/40 border border-white/10 rounded-lg text-slate-100 text-base font-bold font-mono outline-none focus:border-amber-500 transition-colors" />
          <select value={exchange} onChange={e => setExchange(e.target.value)}
            className="flex-1 px-2 py-2.5 bg-black/40 border border-white/10 rounded-lg text-slate-400 text-xs outline-none">
            {["NYSE","NASDAQ","HKEX","KRX","TSE","LSE","OTHER"].map(ex => (
              <option key={ex} value={ex}>{ex}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-1.5 flex-wrap mb-5">
          {CATS.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className="px-2.5 py-1 rounded-md text-[9px] font-semibold border transition-all"
              style={{
                borderColor: category === c ? CC[c] : `${CC[c]}22`,
                background: category === c ? `${CC[c]}15` : "transparent",
                color: category === c ? CC[c] : "#4a5568",
              }}>{c}</button>
          ))}
        </div>

        <div className="flex gap-2.5">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-lg text-xs border border-white/10 text-slate-500 hover:text-slate-300 transition-colors">취소</button>
          <button onClick={hunt} disabled={!ticker.trim() || loading}
            className="flex-[2] py-3 rounded-lg text-sm font-extrabold font-mono tracking-wider disabled:opacity-40 transition-all"
            style={{ background: loading ? "#2a3040" : "linear-gradient(135deg,#d4a843,#b8860b)", color: loading ? "#6b7b8d" : "#0a0e18" }}>
            {loading ? "🔍 AI 분석 중..." : "⚡ HUNT"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────
export default function RadarPage() {
  const [stocks, setStocks] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [sFilter, setSFilter] = useState("ALL");
  const [cFilter, setCFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => { dbFetch().then(d => { setStocks(d); setLoading(false); }); }, []);

  const filtered = stocks.filter(s =>
    (sFilter === "ALL" || s.status === sFilter) &&
    (cFilter === "ALL" || s.category === cFilter)
  );

  const counts = stocks.reduce((a, s) => { a[s.status] = (a[s.status] || 0) + 1; return a; }, {});
  const activeCats = [...new Set(stocks.map(s => s.category))];

  return (
    <div className="min-h-screen bg-[#0a0e18] text-slate-200">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.04] bg-[#0a0e18]/95 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <Link href="/" className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors">← Control Tower</Link>
              <h1 className="text-lg font-extrabold font-mono text-amber-500 tracking-[3px] mt-1">🐺 WOLF RADAR</h1>
              <p className="text-[11px] text-slate-600 mt-0.5">성장주 발굴 · {stocks.length}개 추적 중</p>
            </div>
            <button onClick={() => setShowAdd(true)}
              className="px-5 py-2.5 rounded-lg text-xs font-extrabold font-mono tracking-wider"
              style={{ background: "linear-gradient(135deg,#d4a843,#b8860b)", color: "#0a0e18" }}>+ HUNT</button>
          </div>

          {/* Status filter */}
          <div className="flex gap-1.5 flex-wrap mb-2">
            <button onClick={() => setSFilter("ALL")}
              className={`px-3 py-1 rounded-full text-[10px] font-semibold border transition-all ${sFilter === "ALL" ? "border-slate-400/20 bg-slate-400/10 text-slate-300" : "border-white/[0.04] text-slate-600"}`}>
              ALL ({stocks.length})</button>
            {Object.entries(ST).map(([key, { icon, c }]) => (
              <button key={key} onClick={() => setSFilter(sFilter === key ? "ALL" : key)}
                className="px-3 py-1 rounded-full text-[10px] font-semibold border transition-all"
                style={{
                  borderColor: sFilter === key ? `${c}55` : "rgba(255,255,255,0.04)",
                  background: sFilter === key ? `${c}12` : "transparent",
                  color: sFilter === key ? c : "#4a5568",
                }}>{icon} {counts[key] || 0}</button>
            ))}
          </div>

          {/* Category filter */}
          {activeCats.length > 1 && (
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setCFilter("ALL")}
                className={`px-2.5 py-0.5 rounded-full text-[9px] border transition-all ${cFilter === "ALL" ? "border-slate-500/20 bg-slate-500/8 text-slate-400" : "border-white/[0.03] text-slate-700"}`}>ALL</button>
              {activeCats.map(c => (
                <button key={c} onClick={() => setCFilter(cFilter === c ? "ALL" : c)}
                  className="px-2.5 py-0.5 rounded-full text-[9px] border transition-all"
                  style={{
                    borderColor: cFilter === c ? `${CC[c]}55` : "rgba(255,255,255,0.03)",
                    background: cFilter === c ? `${CC[c]}12` : "transparent",
                    color: cFilter === c ? CC[c] : "#3a4454",
                  }}>{c}</button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* List */}
      <main className="max-w-2xl mx-auto px-4 py-4 pb-24 flex flex-col gap-2.5">
        {loading ? (
          <div className="text-center py-20 text-slate-600 text-sm animate-pulse">로딩 중...</div>
        ) : stocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-5 opacity-70">
            <div className="text-6xl">🐺</div>
            <div className="text-center font-mono text-slate-500 leading-relaxed">
              Wolf Radar 활성화 대기 중<br />
              <span className="text-xs text-slate-600">첫 번째 사냥감을 등록하세요</span>
            </div>
            <button onClick={() => setShowAdd(true)}
              className="px-8 py-3 rounded-lg text-sm font-extrabold font-mono tracking-wider"
              style={{ background: "linear-gradient(135deg,#d4a843,#b8860b)", color: "#0a0e18" }}>+ ADD TARGET</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-600 text-sm">필터 조건에 맞는 종목 없음</div>
        ) : (
          filtered.map(s => (
            <StockCard key={s.id} stock={s} expanded={expanded === s.id}
              onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
              onUpdate={u => setStocks(prev => prev.map(p => p.id === u.id ? u : p))}
              onDelete={id => { setStocks(prev => prev.filter(p => p.id !== id)); if (expanded === id) setExpanded(null); }} />
          ))
        )}
      </main>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdd={s => setStocks(prev => [s, ...prev])} />}
    </div>
  );
}
