// app/radar/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
  RadarStock,
  fetchStocks,
  addStock as dbAdd,
  updateStock as dbUpdate,
  deleteStock as dbDelete,
  generateThesis,
} from "@/lib/radar";

// ── Kelly Criterion ──────────────────────────
function calcKelly(wp: number, wlr: number) {
  if (!wp || !wlr) return { full: 0, half: 0, quarter: 0 };
  const q = 1 - wp;
  const k = Math.max(0, Math.min((wp * wlr - q) / wlr, 1));
  return {
    full: +(k * 100).toFixed(1),
    half: +(k * 50).toFixed(1),
    quarter: +(k * 25).toFixed(1),
  };
}

// ── Constants ────────────────────────────────
const STATUS = {
  WATCHING: { label: "Watching", icon: "👁", c: "#6b8aad" },
  STALKING: { label: "Stalking", icon: "🐺", c: "#d4a843" },
  ENTERED: { label: "Entered", icon: "⚡", c: "#4ade80" },
  EXITED: { label: "Exited", icon: "🚪", c: "#94a3b8" },
  KILLED: { label: "Killed", icon: "💀", c: "#ef4444" },
} as const;

const CATS = [
  "BTC_TREASURY","AI_INFRA","AI_APP","BIOTECH","SPAC","IPO",
  "ROBOTICS","ENERGY","FINTECH","CRYPTO","SEMI","OTHER",
];
const CC: Record<string,string> = {
  BTC_TREASURY:"#f7931a",AI_INFRA:"#8b5cf6",AI_APP:"#a78bfa",
  BIOTECH:"#10b981",SPAC:"#f59e0b",IPO:"#ec4899",
  ROBOTICS:"#06b6d4",ENERGY:"#84cc16",FINTECH:"#3b82f6",
  CRYPTO:"#eab308",SEMI:"#6366f1",OTHER:"#6b7280",
};

// ── Kelly Panel ──────────────────────────────
function KellyPanel({
  stock,
  onSave,
}: {
  stock: RadarStock;
  onSave: (wp: number, wlr: number) => void;
}) {
  const [wp, setWp] = useState(stock.kelly_win_prob || 0.5);
  const [wlr, setWlr] = useState(stock.kelly_wl_ratio || 2);
  const k = calcKelly(wp, wlr);

  return (
    <div className="mt-3 p-4 rounded-xl bg-black/20 border border-white/5">
      <div className="text-[10px] font-bold tracking-[3px] text-amber-500 mb-3 font-mono">
        KELLY CRITERION
      </div>
      <div className="grid grid-cols-2 gap-4 mb-3">
        <label>
          <div className="text-[10px] text-slate-500 mb-1">승률 (Win Prob)</div>
          <input
            type="range" min={0.05} max={0.95} step={0.05} value={wp}
            onChange={(e) => setWp(+e.target.value)}
            onMouseUp={() => onSave(wp, wlr)}
            onTouchEnd={() => onSave(wp, wlr)}
            className="w-full accent-amber-500"
          />
          <div className="text-sm text-center text-slate-200">
            {(wp * 100).toFixed(0)}%
          </div>
        </label>
        <label>
          <div className="text-[10px] text-slate-500 mb-1">보상/손실 비율</div>
          <input
            type="range" min={0.5} max={10} step={0.25} value={wlr}
            onChange={(e) => setWlr(+e.target.value)}
            onMouseUp={() => onSave(wp, wlr)}
            onTouchEnd={() => onSave(wp, wlr)}
            className="w-full accent-amber-500"
          />
          <div className="text-sm text-center text-slate-200">
            {wlr.toFixed(2)}x
          </div>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {([
          { l: "Full", v: k.full, c: "text-red-400 border-red-400/20" },
          { l: "Half", v: k.half, c: "text-amber-400 border-amber-400/20" },
          { l: "Quarter", v: k.quarter, c: "text-green-400 border-green-400/20" },
        ] as const).map(({ l, v, c }) => (
          <div key={l} className={`bg-black/40 rounded-lg p-2 text-center border ${c}`}>
            <div className="text-[9px] text-slate-500">{l} Kelly</div>
            <div className={`text-lg font-extrabold font-mono ${c.split(" ")[0]}`}>
              {v}%
            </div>
          </div>
        ))}
      </div>
      {k.full <= 0 && (
        <div className="text-[10px] text-red-400 text-center mt-2">
          ⚠ 음의 기대값 — 베팅하지 마세요
        </div>
      )}
    </div>
  );
}

// ── Thesis Section ───────────────────────────
function ThesisBlock({ label, color, text }: { label: string; color: string; text?: string }) {
  if (!text) return null;
  return (
    <div className="mb-3">
      <div className={`text-[10px] font-bold mb-1`} style={{ color }}>
        {label}
      </div>
      <div className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

// ── Stock Card ───────────────────────────────
function StockCard({
  stock,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
}: {
  stock: RadarStock;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (s: RadarStock) => void;
  onDelete: (id: string) => void;
}) {
  const st = STATUS[stock.status] || STATUS.WATCHING;
  const cat = stock.category || "OTHER";

  const handleStatusChange = async (newStatus: string) => {
    onUpdate({ ...stock, status: newStatus as RadarStock["status"] });
  };

  const handleKellySave = (wp: number, wlr: number) => {
    onUpdate({ ...stock, kelly_win_prob: wp, kelly_wl_ratio: wlr });
  };

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        expanded
          ? "border-amber-500/30 shadow-[0_0_30px_rgba(212,168,67,0.08)]"
          : "border-white/5 hover:border-white/10"
      }`}
      style={{ background: "linear-gradient(145deg,#151a2e,#1a1f35)" }}
    >
      {/* Header */}
      <div
        onClick={onToggle}
        className="flex items-center gap-3 p-4 cursor-pointer"
      >
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: st.c, boxShadow: `0 0 8px ${st.c}88` }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-extrabold text-slate-100 font-mono">
              {stock.ticker}
            </span>
            <span
              className="text-[9px] px-2 py-0.5 rounded-full font-semibold border"
              style={{
                background: `${CC[cat]}18`,
                color: CC[cat],
                borderColor: `${CC[cat]}44`,
              }}
            >
              {cat}
            </span>
            <span
              className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: `${st.c}18`, color: st.c }}
            >
              {st.icon} {st.label}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1 truncate">
            {stock.thesis_oneliner || "Thesis 미작성"}
          </div>
        </div>
        <div
          className={`text-[10px] text-slate-600 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        >
          ▼
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5">
          {/* Status buttons */}
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {Object.entries(STATUS).map(([key, { label, icon, c }]) => (
              <button
                key={key}
                onClick={() => handleStatusChange(key)}
                className="px-2.5 py-1 rounded-md text-[10px] font-semibold border transition-all"
                style={{
                  borderColor:
                    stock.status === key ? c : `${c}33`,
                  background:
                    stock.status === key ? `${c}18` : "transparent",
                  color: stock.status === key ? c : "#6b7b8d",
                }}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Thesis */}
          {stock.thesis_json && (
            <div className="mt-4">
              <ThesisBlock label="▲ BULL CASE" color="#4ade80" text={stock.thesis_json.bull_case} />
              <ThesisBlock label="▼ BEAR CASE" color="#ef4444" text={stock.thesis_json.bear_case} />
              <ThesisBlock label="⚡ CATALYSTS" color="#d4a843" text={stock.thesis_json.catalysts} />
              <ThesisBlock label="📊 KEY METRICS" color="#8b5cf6" text={stock.thesis_json.key_metrics} />
              <ThesisBlock label="🎯 ENTRY / EXIT" color="#06b6d4" text={stock.thesis_json.entry_exit} />
            </div>
          )}

          {/* Kelly */}
          <KellyPanel stock={stock} onSave={handleKellySave} />

          {/* Delete */}
          <div className="flex justify-end mt-3">
            <button
              onClick={() => onDelete(stock.id)}
              className="px-3 py-1.5 rounded-md text-[11px] border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Modal ────────────────────────────────
function AddModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (s: RadarStock) => void;
}) {
  const [ticker, setTicker] = useState("");
  const [exchange, setExchange] = useState("NYSE");
  const [category, setCategory] = useState("OTHER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hunt = async () => {
    if (!ticker.trim()) return;
    setLoading(true);
    setError("");

    try {
      const thesis = await generateThesis(ticker, exchange);

      const newStock: any = {
        ticker: ticker.toUpperCase(),
        exchange,
        name: thesis.name || ticker.toUpperCase(),
        category: thesis.suggested_category || category,
        status: "WATCHING",
        thesis_oneliner: thesis.thesis_oneliner || "",
        thesis_json: {
          bull_case: thesis.bull_case || "",
          bear_case: thesis.bear_case || "",
          catalysts: thesis.catalysts || "",
          key_metrics: thesis.key_metrics || "",
          entry_exit: thesis.entry_exit || "",
        },
        kelly_win_prob: thesis.win_prob || 0.45,
        kelly_wl_ratio: thesis.wl_ratio || 2.0,
      };

      const saved = await dbAdd(newStock);
      if (saved) onAdd(saved);
      onClose();
    } catch (e) {
      console.error(e);
      setError("AI 분석 실패. 수동으로 추가합니다.");
      const fallback: any = {
        ticker: ticker.toUpperCase(),
        exchange,
        name: ticker.toUpperCase(),
        category,
        status: "WATCHING",
        thesis_oneliner: "",
        thesis_json: {},
        kelly_win_prob: 0.5,
        kelly_wl_ratio: 2.0,
      };
      const saved = await dbAdd(fallback);
      if (saved) onAdd(saved);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-5"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-amber-500/20 p-6"
        style={{
          background: "linear-gradient(145deg,#151a2e,#1a1f35)",
          boxShadow: "0 20px 60px #000a",
        }}
      >
        <div className="text-sm font-extrabold text-amber-500 font-mono tracking-[3px] mb-5">
          🐺 NEW TARGET
        </div>

        <div className="flex gap-2.5 mb-4">
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="TICKER"
            maxLength={10}
            className="flex-[2] px-3 py-2.5 bg-black/40 border border-white/10 rounded-lg text-slate-100 text-base font-bold font-mono outline-none focus:border-amber-500 transition-colors"
          />
          <select
            value={exchange}
            onChange={(e) => setExchange(e.target.value)}
            className="flex-1 px-2 py-2.5 bg-black/40 border border-white/10 rounded-lg text-slate-400 text-xs outline-none"
          >
            {["NYSE","NASDAQ","HKEX","KRX","TSE","LSE","OTHER"].map((ex) => (
              <option key={ex} value={ex}>{ex}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-1.5 flex-wrap mb-5">
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="px-2.5 py-1 rounded-md text-[9px] font-semibold border transition-all"
              style={{
                borderColor: category === c ? CC[c] : `${CC[c]}33`,
                background: category === c ? `${CC[c]}18` : "transparent",
                color: category === c ? CC[c] : "#5a6474",
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {error && (
          <div className="text-[11px] text-red-400 mb-3">{error}</div>
        )}

        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg text-xs border border-white/10 text-slate-500 hover:text-slate-300 transition-colors"
          >
            취소
          </button>
          <button
            onClick={hunt}
            disabled={!ticker.trim() || loading}
            className="flex-[2] py-3 rounded-lg text-sm font-extrabold font-mono tracking-wider disabled:opacity-40 transition-all"
            style={{
              background: loading
                ? "#2a3040"
                : "linear-gradient(135deg,#d4a843,#b8860b)",
              color: loading ? "#6b7b8d" : "#0a0e18",
            }}
          >
            {loading ? "🔍 AI 분석 중..." : "⚡ HUNT"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────
export default function RadarPage() {
  const [stocks, setStocks] = useState<RadarStock[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [catFilter, setCatFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  // Initial fetch
  useEffect(() => {
    fetchStocks().then((data) => {
      setStocks(data);
      setLoading(false);
    });
  }, []);

  const handleAdd = (stock: RadarStock) => {
    setStocks((prev) => [stock, ...prev]);
  };

  const handleUpdate = async (stock: RadarStock) => {
    setStocks((prev) => prev.map((s) => (s.id === stock.id ? stock : s)));
    await dbUpdate(stock.id, {
      status: stock.status,
      kelly_win_prob: stock.kelly_win_prob,
      kelly_wl_ratio: stock.kelly_wl_ratio,
    });
  };

  const handleDelete = async (id: string) => {
    setStocks((prev) => prev.filter((s) => s.id !== id));
    if (expanded === id) setExpanded(null);
    await dbDelete(id);
  };

  const filtered = stocks.filter((s) => {
    if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
    if (catFilter !== "ALL" && s.category !== catFilter) return false;
    return true;
  });

  const counts = stocks.reduce<Record<string, number>>((a, s) => {
    a[s.status] = (a[s.status] || 0) + 1;
    return a;
  }, {});

  const activeCats = [...new Set(stocks.map((s) => s.category))];

  return (
    <div className="min-h-screen bg-[#0a0e18] text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0a0e18]/95 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-extrabold font-mono text-amber-500 tracking-[3px]">
                🐺 WOLF RADAR
              </h1>
              <p className="text-[11px] text-slate-600 mt-0.5">
                성장주 발굴 · {stocks.length}개 추적 중
              </p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="px-5 py-2.5 rounded-lg text-xs font-extrabold font-mono tracking-wider"
              style={{
                background: "linear-gradient(135deg,#d4a843,#b8860b)",
                color: "#0a0e18",
              }}
            >
              + HUNT
            </button>
          </div>

          {/* Status filter */}
          <div className="flex gap-1.5 flex-wrap mb-2">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                statusFilter === "ALL"
                  ? "border-slate-400/30 bg-slate-400/10 text-slate-300"
                  : "border-white/5 text-slate-600"
              }`}
            >
              ALL ({stocks.length})
            </button>
            {Object.entries(STATUS).map(([key, { icon, c }]) => (
              <button
                key={key}
                onClick={() =>
                  setStatusFilter(statusFilter === key ? "ALL" : key)
                }
                className="px-3 py-1 rounded-full text-[10px] font-semibold border transition-all"
                style={{
                  borderColor:
                    statusFilter === key ? `${c}66` : "rgba(255,255,255,0.05)",
                  background:
                    statusFilter === key ? `${c}15` : "transparent",
                  color: statusFilter === key ? c : "#5a6474",
                }}
              >
                {icon} {counts[key] || 0}
              </button>
            ))}
          </div>

          {/* Category filter */}
          {activeCats.length > 1 && (
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setCatFilter("ALL")}
                className={`px-2.5 py-0.5 rounded-full text-[9px] border transition-all ${
                  catFilter === "ALL"
                    ? "border-slate-500/30 bg-slate-500/10 text-slate-400"
                    : "border-white/5 text-slate-700"
                }`}
              >
                ALL
              </button>
              {activeCats.map((c) => (
                <button
                  key={c}
                  onClick={() => setCatFilter(catFilter === c ? "ALL" : c)}
                  className="px-2.5 py-0.5 rounded-full text-[9px] border transition-all"
                  style={{
                    borderColor:
                      catFilter === c ? `${CC[c]}66` : "rgba(255,255,255,0.03)",
                    background:
                      catFilter === c ? `${CC[c]}15` : "transparent",
                    color: catFilter === c ? CC[c] : "#3a4454",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Stock list */}
      <main className="max-w-2xl mx-auto px-4 py-4 pb-24 flex flex-col gap-2.5">
        {loading ? (
          <div className="text-center py-20 text-slate-600 text-sm">
            로딩 중...
          </div>
        ) : stocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-5 opacity-70">
            <div className="text-6xl">🐺</div>
            <div className="text-center font-mono text-slate-500">
              Wolf Radar 활성화 대기 중
              <br />
              <span className="text-xs text-slate-600">
                첫 번째 사냥감을 등록하세요
              </span>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="px-8 py-3 rounded-lg text-sm font-extrabold font-mono tracking-wider"
              style={{
                background: "linear-gradient(135deg,#d4a843,#b8860b)",
                color: "#0a0e18",
              }}
            >
              + ADD TARGET
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-600 text-sm">
            필터 조건에 맞는 종목 없음
          </div>
        ) : (
          filtered.map((stock) => (
            <StockCard
              key={stock.id}
              stock={stock}
              expanded={expanded === stock.id}
              onToggle={() =>
                setExpanded(expanded === stock.id ? null : stock.id)
              }
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))
        )}
      </main>

      {/* Add modal */}
      {showAdd && (
        <AddModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />
      )}
    </div>
  );
}
