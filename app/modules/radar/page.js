"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// ── Admin PIN Hook ──
function useAdminPin(moduleKey) {
  const storageKey = `wolfpack_admin_${moduleKey}`;
  const [pin, setPin] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pinError, setPinError] = useState('');
  useEffect(() => { const saved = sessionStorage.getItem(storageKey); if (saved) { setPin(saved); setIsAdmin(true); } }, [storageKey]);
  const openModal = useCallback(() => { setPinError(''); setShowModal(true); }, []);
  const closeModal = useCallback(() => { setShowModal(false); setPinError(''); }, []);
  const logout = useCallback(() => { setIsAdmin(false); setPin(''); sessionStorage.removeItem(storageKey); }, [storageKey]);
  const verify = useCallback(async (inputPin) => {
    try {
      const res = await fetch('/api/radar/search', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': inputPin }, body: JSON.stringify({ query: '__pin_check' }) });
      if (res.status === 401) { setPinError('PIN이 일치하지 않습니다'); return false; }
      setPin(inputPin); setIsAdmin(true); sessionStorage.setItem(storageKey, inputPin); setShowModal(false); setPinError(''); return true;
    } catch { setPinError('서버 연결 오류'); return false; }
  }, [storageKey]);
  return { pin, isAdmin, showModal, pinError, openModal, closeModal, logout, verify };
}
function PinModal({ admin }) {
  const [inputPin, setInputPin] = useState('');
  if (!admin.showModal) return null;
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={admin.closeModal}>
      <div style={{background:'#0d1220',border:'1px solid rgba(212,168,67,0.3)',borderRadius:14,padding:24,width:300,boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
        <h3 style={{fontSize:15,fontWeight:700,color:'#e2e8f0',marginBottom:4}}>🔐 관리자 인증</h3>
        <p style={{fontSize:11,color:'#64748b',marginBottom:16}}>검색/등록/평가/삭제는 관리자만 가능합니다</p>
        <input type="password" placeholder="PIN 입력" value={inputPin} onChange={e=>setInputPin(e.target.value)} onKeyDown={e=>e.key==='Enter'&&admin.verify(inputPin)}
          style={{width:'100%',padding:'10px 14px',background:'rgba(0,0,0,0.4)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,fontSize:16,textAlign:'center',letterSpacing:'0.3em',color:'#e2e8f0',outline:'none',boxSizing:'border-box'}} autoFocus />
        {admin.pinError && <p style={{color:'#ef4444',fontSize:11,textAlign:'center',marginTop:8}}>{admin.pinError}</p>}
        <div style={{display:'flex',gap:8,marginTop:16}}>
          <button onClick={admin.closeModal} style={{flex:1,padding:'9px 0',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,background:'transparent',color:'#64748b',fontSize:12,cursor:'pointer'}}>취소</button>
          <button onClick={()=>admin.verify(inputPin)} style={{flex:1,padding:'9px 0',border:'none',borderRadius:8,background:'linear-gradient(135deg,#d4a843,#b8860b)',color:'#0a0e18',fontSize:12,fontWeight:700,cursor:'pointer'}}>인증</button>
        </div>
      </div>
    </div>
  );
}

// ── Kelly ──
function calcKelly(wp, wlr) {
  if (!wp || !wlr || wp <= 0 || wlr <= 0) return { full: 0, half: 0, quarter: 0 };
  const q = 1 - wp;
  const k = Math.max(0, Math.min((wp * wlr - q) / wlr, 1));
  return { full: +(k * 100).toFixed(1), half: +(k * 50).toFixed(1), quarter: +(k * 25).toFixed(1) };
}

const KELLY_FRACTIONS = [
  { key: "full", label: "Full Kelly", mult: 1, color: "#ef4444", desc: "최대 기대수익, 높은 변동성" },
  { key: "half", label: "Half Kelly", mult: 0.5, color: "#d4a843", desc: "수익의 75%, 변동성 절반" },
  { key: "quarter", label: "Quarter Kelly", mult: 0.25, color: "#4ade80", desc: "보수적 배분, 안정적 성장" },
];

const CC = {
  BTC_TREASURY:"#f7931a",AI_INFRA:"#8b5cf6",AI_APP:"#a78bfa",BIOTECH:"#10b981",
  SPAC:"#f59e0b",IPO:"#ec4899",ROBOTICS:"#06b6d4",ENERGY:"#84cc16",
  FINTECH:"#3b82f6",CRYPTO:"#eab308",SEMI:"#6366f1",OTHER:"#6b7280",
};

// ── DB ──
async function dbFetch() {
  const { data } = await supabase.from("radar_stocks").select("*").order("added_at", { ascending: false });
  return data || [];
}
async function dbInsert(stock) {
  const { data, error } = await supabase.from("radar_stocks").insert(stock).select().single();
  if (error) { console.error("dbInsert error:", error); return { __error: error.message }; }
  return data;
}
async function dbUpdate(id, updates) {
  await supabase.from("radar_stocks").update(updates).eq("id", id);
}
async function dbDelete(id) {
  await supabase.from("radar_stocks").delete().eq("id", id);
}

// ── Score Color ──
function sc(score) {
  return score >= 70 ? "#4ade80" : score >= 40 ? "#d4a843" : "#ef4444";
}

// ── Score Ring ──
function ScoreRing({ score, size = 44 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circ * (1 - pct / 100);
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={sc(pct)} strokeWidth={3}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dashoffset 0.5s" }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        fill={sc(pct)} fontSize={size * 0.3} fontWeight={800} fontFamily="monospace">{Math.round(pct)}</text>
    </svg>
  );
}

// ── 총점 계산 ──
function calcTotalScore(indicators) {
  if (!indicators || indicators.length === 0) return 0;
  let weightedSum = 0, totalWeight = 0;
  for (const ind of indicators) {
    const subs = ind.sub_indicators || [];
    const indScore = subs.length > 0
      ? subs.reduce((s, sub) => s + (sub.score ?? 50), 0) / subs.length
      : (ind.score ?? 50);
    weightedSum += indScore * (ind.weight || 1);
    totalWeight += (ind.weight || 1);
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

// ── Momentum Bar ──
function MomentumSection({ momentum }) {
  if (!momentum) return null;
  const m = momentum;
  const pctHigh = m.high_52w > 0 ? ((m.current_price / m.high_52w) * 100).toFixed(1) : "—";
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
      <div className="text-[11px] font-bold text-slate-400 tracking-wider font-mono mb-3">TECHNICAL MOMENTUM</div>
      <div className="flex justify-between items-center mb-3 pb-3 border-b border-white/[0.04]">
        <div>
          <div className="text-xl font-black font-mono text-slate-100">{m.current_price?.toLocaleString() || "—"}</div>
          <div className="text-[9px] text-slate-600">52w High 대비 {pctHigh}%</div>
        </div>
        <div className="text-right text-[10px] text-slate-500">52w High: {m.high_52w?.toLocaleString() || "—"}</div>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[{label:"MA5",val:m.ma5},{label:"MA20",val:m.ma20},{label:"MA60",val:m.ma60},{label:"MA120",val:m.ma120}].map(({label,val})=>(
          <div key={label} className="text-center bg-black/20 rounded-lg py-2">
            <div className="text-[9px] text-slate-600 mb-0.5">{label}</div>
            <div className="text-[11px] font-mono font-bold text-slate-300">{val ? val.toLocaleString() : "—"}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <div className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-bold ${m.ma_aligned ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
          이평선 {m.ma_aligned ? "정배열 ✓" : "역배열 ✗"}
        </div>
        <div className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-bold ${m.ma120_trend === "up" ? "bg-green-500/10 text-green-400 border border-green-500/20" : m.ma120_trend === "down" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-slate-500/10 text-slate-400 border border-slate-500/20"}`}>
          120일선 {m.ma120_trend === "up" ? "상승 ▲" : m.ma120_trend === "down" ? "하락 ▼" : "횡보 ─"}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ── PORTFOLIO KELLY PANEL ──
// ══════════════════════════════════════════════════════════════
function PortfolioKellyPanel({ stocks, kellyFraction, setKellyFraction }) {
  const selected = stocks.filter(s => s.in_portfolio);

  const allocations = useMemo(() => {
    if (selected.length === 0) return [];

    const fraction = KELLY_FRACTIONS.find(f => f.key === kellyFraction) || KELLY_FRACTIONS[1];

    // 1) 개별 raw Kelly % 계산
    const raw = selected.map(s => {
      const k = calcKelly(s.kelly_win_prob, s.kelly_wl_ratio);
      return {
        id: s.id, ticker: s.ticker, category: s.category || "OTHER",
        score: calcTotalScore(s.indicators || []),
        winProb: s.kelly_win_prob, wlRatio: s.kelly_wl_ratio,
        rawKelly: k.full, // raw full Kelly %
      };
    });

    // 2) raw Kelly 합계 기준으로 정규화 → 비중 합이 fraction의 총 배분 한도가 되도록
    const totalRaw = raw.reduce((sum, r) => sum + r.rawKelly, 0);
    if (totalRaw === 0) return raw.map(r => ({ ...r, allocation: 0 }));

    return raw.map(r => ({
      ...r,
      allocation: +((r.rawKelly / totalRaw) * totalRaw * fraction.mult).toFixed(1),
    }));
  }, [selected, kellyFraction]);

  const totalAllocation = allocations.reduce((sum, a) => sum + a.allocation, 0);
  const cashPct = Math.max(0, +(100 - totalAllocation).toFixed(1));

  if (selected.length === 0) return null;

  const currentFraction = KELLY_FRACTIONS.find(f => f.key === kellyFraction) || KELLY_FRACTIONS[1];

  return (
    <div className="bg-gradient-to-b from-[#111730] to-[#0d1220] border border-amber-500/15 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.04]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] font-bold text-amber-500 tracking-[2px] font-mono">PORTFOLIO KELLY</div>
            <div className="text-[10px] text-slate-600 mt-0.5">{selected.length}종목 편입 · 포트폴리오 기준 자금배분</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-black font-mono" style={{ color: currentFraction.color }}>
              {totalAllocation.toFixed(1)}%
            </div>
            <div className="text-[9px] text-slate-600">투자비중</div>
          </div>
        </div>

        {/* Kelly Fraction Selector */}
        <div className="flex gap-1.5">
          {KELLY_FRACTIONS.map(f => (
            <button key={f.key} onClick={() => setKellyFraction(f.key)}
              className="flex-1 py-2 rounded-lg text-[10px] font-bold font-mono transition-all"
              style={{
                background: kellyFraction === f.key ? `${f.color}18` : "rgba(255,255,255,0.02)",
                border: `1px solid ${kellyFraction === f.key ? `${f.color}40` : "rgba(255,255,255,0.04)"}`,
                color: kellyFraction === f.key ? f.color : "#475569",
              }}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="text-[9px] text-slate-600 mt-1.5 text-center italic">{currentFraction.desc}</div>
      </div>

      {/* Allocation Table */}
      <div className="px-4 py-3 space-y-1.5">
        {allocations.sort((a, b) => b.allocation - a.allocation).map(a => (
          <div key={a.id} className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-slate-200 w-16 shrink-0">{a.ticker}</span>
              <div className="flex-1 h-5 bg-black/30 rounded-md overflow-hidden relative">
                <div className="h-full rounded-md transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (a.allocation / Math.max(totalAllocation, 1)) * 100)}%`,
                    background: `linear-gradient(90deg, ${CC[a.category]}80, ${CC[a.category]}30)`,
                  }} />
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold text-white/70">
                  {a.allocation > 0 ? `${a.allocation}%` : "—"}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0 w-20">
              <span className="text-[9px] text-slate-600">
                {a.winProb ? `${(a.winProb * 100).toFixed(0)}%` : "—"} / {a.wlRatio ? `${a.wlRatio.toFixed(1)}x` : "—"}
              </span>
            </div>
          </div>
        ))}

        {/* Cash row */}
        <div className="flex items-center gap-2 pt-1.5 border-t border-white/[0.04]">
          <div className="flex-1 flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-slate-500 w-16 shrink-0">CASH</span>
            <div className="flex-1 h-5 bg-black/30 rounded-md overflow-hidden relative">
              <div className="h-full rounded-md transition-all duration-500"
                style={{ width: `${Math.min(100, (cashPct / 100) * 100)}%`, background: "rgba(100,116,139,0.3)" }} />
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold text-slate-500">
                {cashPct}%
              </span>
            </div>
          </div>
          <div className="text-right shrink-0 w-20">
            <span className="text-[9px] text-slate-600">현금</span>
          </div>
        </div>
      </div>

      {/* Summary footer */}
      <div className="px-4 py-2.5 bg-black/20 border-t border-white/[0.04] flex items-center justify-between">
        <span className="text-[9px] text-slate-600">
          개별 Kelly 합: {allocations.reduce((s, a) => s + a.rawKelly, 0).toFixed(1)}% →
          {" "}{currentFraction.label}: {totalAllocation.toFixed(1)}%
        </span>
        <span className="text-[9px] font-mono" style={{ color: currentFraction.color }}>
          {currentFraction.mult * 100}% 적용
        </span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ── DETAIL PANEL ──
// ══════════════════════════════════════════════════════════════
function DetailPanel({ stock, onClose, onUpdate, onDelete, onTogglePortfolio, admin }) {
  const thesis = stock.thesis_json || {};
  const indicators = stock.indicators || [];
  const momentum = stock.momentum || null;
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState(null);
  const totalScore = calcTotalScore(indicators);

  const handleEvaluate = useCallback(async () => {
    if (!admin.isAdmin) { admin.openModal(); return; }
    setEvaluating(true);
    setEvalResult(null);
    try {
      const res = await fetch("/api/radar/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": admin.pin },
        body: JSON.stringify({
          ticker: stock.ticker, exchange: stock.exchange, name: stock.name,
          indicators: indicators, kelly_win_prob: stock.kelly_win_prob, kelly_wl_ratio: stock.kelly_wl_ratio,
        }),
      });
      if (res.status === 401) { admin.logout(); admin.openModal(); setEvaluating(false); return; }
      if (res.ok) {
        const data = await res.json();
        const newKellyWP = data.kelly_win_prob ?? stock.kelly_win_prob;
        const newKellyWL = data.kelly_wl_ratio ?? stock.kelly_wl_ratio;
        const updated = { ...stock, indicators: data.indicators || indicators, momentum: data.momentum || momentum, kelly_win_prob: newKellyWP, kelly_wl_ratio: newKellyWL };
        onUpdate(updated);
        dbUpdate(stock.id, { indicators: data.indicators || indicators, momentum: data.momentum || momentum, kelly_win_prob: newKellyWP, kelly_wl_ratio: newKellyWL });
        const kellyNote = data.kelly_reasoning ? ` | Kelly: ${data.kelly_reasoning}` : "";
        setEvalResult((data.summary || "평가 완료") + kellyNote);
      } else {
        const err = await res.json().catch(() => ({}));
        setEvalResult(err.error || "평가 실패");
      }
    } catch (e) { setEvalResult("오류: " + e.message); }
    setEvaluating(false);
  }, [stock, indicators, momentum, onUpdate, admin]);

  const handleDelete = useCallback(() => {
    if (!admin.isAdmin) { admin.openModal(); return; }
    onDelete(stock.id); dbDelete(stock.id); onClose();
  }, [stock.id, onDelete, onClose, admin]);

  const kelly = calcKelly(stock.kelly_win_prob, stock.kelly_wl_ratio);

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex justify-end" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-[#0d1220] h-full overflow-y-auto border-l border-white/[0.06]">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0d1220]/95 backdrop-blur-md border-b border-white/[0.04] p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <ScoreRing score={totalScore} size={52} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-extrabold font-mono text-slate-100">{stock.ticker}</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold border"
                    style={{ background: `${CC[stock.category || "OTHER"]}15`, color: CC[stock.category || "OTHER"], borderColor: `${CC[stock.category || "OTHER"]}33` }}>
                    {stock.category || "OTHER"}
                  </span>
                  {stock.in_portfolio && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                      편입
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">{stock.name} · {stock.exchange}</div>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-600 hover:text-slate-300 text-xl">✕</button>
          </div>
          <div className="text-[12px] text-amber-400/80 italic">{stock.thesis_oneliner || "—"}</div>

          {/* Portfolio Toggle in Detail */}
          <button
            onClick={() => {
              if (!admin.isAdmin) { admin.openModal(); return; }
              onTogglePortfolio(stock.id, !stock.in_portfolio);
            }}
            className="mt-3 w-full py-2 rounded-lg text-xs font-bold font-mono transition-all"
            style={{
              background: stock.in_portfolio ? "rgba(212,168,67,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${stock.in_portfolio ? "rgba(212,168,67,0.3)" : "rgba(255,255,255,0.08)"}`,
              color: stock.in_portfolio ? "#d4a843" : "#475569",
            }}>
            {stock.in_portfolio ? "✓ 포트폴리오 편입됨 — 클릭하여 제외" : "+ 포트폴리오에 편입"}
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Score + Evaluate */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-center">
            <div className="text-[10px] text-slate-600 tracking-wider font-mono mb-2">MONITORING SCORE</div>
            <div className="text-4xl font-black font-mono" style={{ color: sc(totalScore) }}>
              {totalScore}<span className="text-lg opacity-50">/100</span>
            </div>
            <div className="text-[10px] text-slate-600 mt-1">{indicators.length}개 지표 · 가중평균</div>
            <button onClick={handleEvaluate} disabled={evaluating || !admin.isAdmin}
              className="mt-3 px-5 py-2 rounded-lg text-xs font-bold bg-amber-600/20 text-amber-500 border border-amber-500/30 hover:bg-amber-600/30 transition disabled:opacity-40">
              {evaluating ? "🔍 AI 평가 중..." : admin.isAdmin ? "🔄 AI 자동 평가" : "🔒 AI 자동 평가"}
            </button>
            {evalResult && <div className="mt-2 text-[10px] text-slate-400 leading-relaxed">{evalResult}</div>}
          </div>

          {/* Monitoring Indicators */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <div className="text-[11px] font-bold text-slate-400 tracking-wider font-mono mb-3">MONITORING INDICATORS</div>
            {indicators.length === 0 ? (
              <div className="text-center py-4 text-slate-600 text-xs">AI 자동 평가를 실행하면 지표가 생성됩니다</div>
            ) : (
              indicators.map((ind, i) => {
                const subs = ind.sub_indicators || [];
                const indScore = subs.length > 0
                  ? Math.round(subs.reduce((s, sub) => s + (sub.score ?? 50), 0) / subs.length)
                  : (ind.score ?? 50);
                return (
                  <div key={i} className="mb-3 last:mb-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-slate-300">{ind.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-slate-600">w:{ind.weight}%</span>
                        <span className="text-sm font-mono font-bold" style={{ color: sc(indScore) }}>{indScore}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/[0.04] rounded-full mb-2 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${indScore}%`, background: sc(indScore) }} />
                    </div>
                    {subs.map((sub, j) => (
                      <div key={j} className="flex items-center gap-2 py-1 pl-3 text-[10px] border-l-2 border-white/[0.04]">
                        <span className="flex-1 text-slate-500">{sub.name}</span>
                        <span className="text-slate-600 text-[9px]">{sub.current || "—"}</span>
                        <span className="font-mono font-bold w-6 text-right" style={{ color: sc(sub.score ?? 50) }}>{sub.score ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>

          {/* Momentum */}
          <MomentumSection momentum={momentum} />

          {/* Thesis */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-3">
            <div className="text-[11px] font-bold text-slate-400 tracking-wider font-mono mb-2">INVESTMENT THESIS</div>
            {[
              { label: "🎯 CORE THESIS", color: "#d4a843", text: thesis.core_thesis },
              { label: "▲ BULL CASE", color: "#4ade80", text: thesis.bull_case },
              { label: "▼ BEAR CASE", color: "#ef4444", text: thesis.bear_case },
              { label: "⚡ CATALYSTS", color: "#a78bfa", text: thesis.catalysts },
              { label: "📊 KEY METRICS", color: "#06b6d4", text: thesis.key_metrics },
            ].map(({ label, color, text }) => text && (
              <div key={label}>
                <div className="text-[10px] font-bold mb-1" style={{ color }}>{label}</div>
                <div className="text-[11px] text-slate-400 leading-relaxed whitespace-pre-wrap">{text}</div>
              </div>
            ))}
          </div>

          {/* Individual Kelly (참고용) */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <div className="text-[11px] font-bold text-slate-400 tracking-wider font-mono mb-3">KELLY CRITERION (개별)</div>
            <div className="flex gap-3 mb-3">
              <div className="flex-1 bg-black/20 rounded-lg py-2 px-3">
                <div className="text-[9px] text-slate-600 mb-0.5">승률 (Win Prob)</div>
                <div className="text-sm font-mono font-bold text-slate-300">{stock.kelly_win_prob ? (stock.kelly_win_prob * 100).toFixed(0) + "%" : "—"}</div>
              </div>
              <div className="flex-1 bg-black/20 rounded-lg py-2 px-3">
                <div className="text-[9px] text-slate-600 mb-0.5">승패비 (W/L Ratio)</div>
                <div className="text-sm font-mono font-bold text-slate-300">{stock.kelly_wl_ratio ? stock.kelly_wl_ratio.toFixed(1) + "x" : "—"}</div>
              </div>
            </div>
            <div className="flex gap-4 text-center">
              {[{label:"Full",value:kelly.full,color:"#ef4444"},{label:"Half",value:kelly.half,color:"#d4a843"},{label:"Quarter",value:kelly.quarter,color:"#4ade80"}].map(({label,value,color})=>(
                <div key={label} className="flex-1 bg-black/20 rounded-lg py-2">
                  <div className="text-lg font-mono font-bold" style={{color}}>{value}%</div>
                  <div className="text-[9px] text-slate-600">{label}</div>
                </div>
              ))}
            </div>
            <div className="text-[9px] text-slate-600 mt-2 text-center italic">AI 자동 평가 시 승률·승패비가 현재 주가 수준 반영하여 업데이트됩니다</div>
          </div>

          {/* Delete */}
          <div className="flex justify-end pt-2">
            <button onClick={handleDelete}
              className="px-4 py-2 rounded-md text-xs border border-red-500/20 text-red-400 hover:bg-red-500/10 transition">
              {admin.isAdmin ? "종목 삭제" : "🔒 종목 삭제"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ── STOCK CARD (with portfolio toggle) ──
// ══════════════════════════════════════════════════════════════
function StockCard({ stock, onClick, onTogglePortfolio, admin }) {
  const cat = stock.category || "OTHER";
  const indicators = stock.indicators || [];
  const totalScore = calcTotalScore(indicators);
  const inPf = stock.in_portfolio;

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!admin.isAdmin) { admin.openModal(); return; }
    onTogglePortfolio(stock.id, !inPf);
  };

  return (
    <div onClick={onClick}
      className="flex items-center gap-2 px-3 py-3 rounded-xl border transition-all cursor-pointer"
      style={{
        background: inPf ? "rgba(212,168,67,0.04)" : "rgba(255,255,255,0.015)",
        borderColor: inPf ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.04)",
      }}>
      {/* Portfolio Toggle */}
      <button onClick={handleToggle}
        className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all"
        style={{
          background: inPf ? "rgba(212,168,67,0.2)" : "rgba(255,255,255,0.03)",
          border: `1.5px solid ${inPf ? "rgba(212,168,67,0.5)" : "rgba(255,255,255,0.08)"}`,
        }}
        title={inPf ? "포트폴리오에서 제외" : "포트폴리오에 편입"}>
        {inPf ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="#d4a843" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <div className="w-2 h-2 rounded-sm bg-white/10" />
        )}
      </button>

      <ScoreRing score={totalScore} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-extrabold text-slate-100 font-mono">{stock.ticker}</span>
          <span className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold border"
            style={{ background: `${CC[cat]}15`, color: CC[cat], borderColor: `${CC[cat]}33` }}>{cat}</span>
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5 truncate">{stock.thesis_oneliner || "—"}</div>
      </div>
      <div className="text-right shrink-0">
        {stock.momentum?.current_price && (
          <div className="text-[11px] font-mono font-bold text-slate-300">{stock.momentum.current_price.toLocaleString()}</div>
        )}
        <div className="text-[9px] text-slate-600">{indicators.length > 0 ? `${indicators.length}개 지표` : "미평가"}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ── MAIN PAGE ──
// ══════════════════════════════════════════════════════════════
export default function RadarPage() {
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registerError, setRegisterError] = useState(null);
  const [kellyFraction, setKellyFraction] = useState("half"); // default: Half Kelly

  const admin = useAdminPin('wolf-radar');

  useEffect(() => { dbFetch().then(d => { setStocks(d); setLoading(false); }); }, []);

  // ── 포트폴리오 편입/제외 토글 ──
  const handleTogglePortfolio = useCallback(async (id, value) => {
    setStocks(prev => prev.map(s => s.id === id ? { ...s, in_portfolio: value } : s));
    // selectedStock도 업데이트
    setSelectedStock(prev => prev && prev.id === id ? { ...prev, in_portfolio: value } : prev);
    await dbUpdate(id, { in_portfolio: value });
  }, []);

  // 🔒 검색
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    if (!admin.isAdmin) { admin.openModal(); return; }
    setSearching(true);
    setSearchResult(null);
    try {
      const res = await fetch("/api/radar/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": admin.pin },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });
      if (res.status === 401) { admin.logout(); admin.openModal(); setSearching(false); return; }
      if (res.ok) { setSearchResult(await res.json()); }
      else { const err = await res.json(); setSearchResult({ error: err.error || "검색 실패" }); }
    } catch (e) { setSearchResult({ error: e.message }); }
    setSearching(false);
  }, [searchQuery, admin]);

  // 🔒 등록
  const handleRegister = useCallback(async (result) => {
    if (!admin.isAdmin) { admin.openModal(); return; }
    setRegisterError(null);
    try {
      const row = {
        ticker: result.ticker, exchange: result.exchange || "NYSE",
        name: result.name || result.ticker, category: result.category || "OTHER",
        status: "WATCHING", thesis_oneliner: (result.thesis_oneliner || "").slice(0, 200),
        thesis_json: JSON.parse(JSON.stringify(result.thesis_detail || {
          core_thesis: result.core_thesis || "", bull_case: result.bull_case || "",
          bear_case: result.bear_case || "", catalysts: result.catalysts || "", key_metrics: result.key_metrics || "",
        })),
        indicators: JSON.parse(JSON.stringify(
          (result.monitoring_indicators || []).map(ind => ({
            name: ind.name || "", weight: ind.weight || 10,
            sub_indicators: (ind.sub_indicators || []).map(s => ({
              name: s.name || "", target: s.target || "", current: s.current || "", score: s.score ?? 50,
            })),
          }))
        )),
        momentum: result.momentum ? JSON.parse(JSON.stringify(result.momentum)) : null,
        kelly_win_prob: result.kelly_win_prob || 0.5, kelly_wl_ratio: result.kelly_wl_ratio || 2.0,
        in_portfolio: false,
      };
      const saved = await dbInsert(row);
      if (saved?.__error) { setRegisterError("저장 오류: " + saved.__error); return; }
      if (saved) { setStocks(prev => [saved, ...prev]); setSearchResult(null); setSearchQuery(""); }
      else { setRegisterError("저장 실패: 응답 없음"); }
    } catch (e) { setRegisterError("등록 오류: " + e.message); }
  }, [admin]);

  const existingTickers = new Set(stocks.map(s => s.ticker));
  const portfolioCount = stocks.filter(s => s.in_portfolio).length;

  return (
    <div className="min-h-screen bg-[#0a0e18] text-slate-200">
      <PinModal admin={admin} />

      <header className="sticky top-0 z-40 border-b border-white/[0.04] bg-[#0a0e18]/95 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="mb-3">
            <Link href="/" className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors">← Control Tower</Link>
            <div className="flex items-center justify-between mt-1">
              <div>
                <h1 className="text-lg font-extrabold font-mono text-amber-500 tracking-[3px]">🐺 WOLF RADAR</h1>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  종목 검색 · AI 분석 · 모니터링 스코어링 · {stocks.length}개 추적 중
                  {portfolioCount > 0 && <span className="text-amber-500/60"> · {portfolioCount}개 편입</span>}
                </p>
              </div>
              {admin.isAdmin ? (
                <button onClick={admin.logout} className="px-3 py-1.5 rounded-lg text-xs border border-green-500/30 bg-green-500/10 text-green-400">🔓</button>
              ) : (
                <button onClick={admin.openModal} className="px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-white/[0.03] text-slate-600">🔒</button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="flex gap-2 mb-3">
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="종목명/티커 검색 (TSLA, 삼성전자, 9618.HK, MiniMax...)"
              className="flex-1 px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 outline-none focus:border-amber-500/50 transition-colors placeholder:text-slate-700" />
            <button onClick={handleSearch} disabled={searching || !searchQuery.trim()}
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold font-mono tracking-wider disabled:opacity-40"
              style={{ background: admin.isAdmin ? "linear-gradient(135deg,#d4a843,#b8860b)" : "rgba(255,255,255,0.05)", color: admin.isAdmin ? "#0a0e18" : "#475569", opacity: admin.isAdmin ? 1 : 0.5 }}>
              {searching ? "🔍..." : admin.isAdmin ? "🔍 검색" : "🔒 검색"}
            </button>
          </div>

          {/* Search Result */}
          {searching && (
            <div className="text-center py-6 text-amber-500 text-sm animate-pulse font-mono">AI가 종목을 분석하고 모니터링 지표를 생성하고 있습니다...</div>
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
              <div className="text-[12px] text-amber-400/80 italic mb-3">{searchResult.thesis_oneliner}</div>
              {searchResult.thesis_detail?.core_thesis && (
                <div className="text-[10px] text-slate-400 leading-relaxed mb-2 bg-black/20 rounded-lg p-2.5">
                  {searchResult.thesis_detail.core_thesis.slice(0, 200)}...
                </div>
              )}
              {searchResult.monitoring_indicators && (
                <div className="flex flex-wrap gap-1.5">
                  {searchResult.monitoring_indicators.map((ind, i) => {
                    const avg = ind.sub_indicators?.length > 0
                      ? Math.round(ind.sub_indicators.reduce((s, sub) => s + (sub.score || 50), 0) / ind.sub_indicators.length) : 50;
                    return (
                      <div key={i} className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                        <span className="text-slate-500">{ind.name}</span>
                        <span className="font-mono font-bold" style={{ color: sc(avg) }}>{avg}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {searchResult.momentum && (
                <div className="flex gap-2 mt-2 text-[9px]">
                  <span className="text-slate-600">현재가: {searchResult.momentum.current_price?.toLocaleString()}</span>
                  <span className={searchResult.momentum.ma_aligned ? "text-green-400" : "text-red-400"}>
                    {searchResult.momentum.ma_aligned ? "이평선 정배열 ✓" : "이평선 역배열"}
                  </span>
                  <span className={searchResult.momentum.ma120_trend === "up" ? "text-green-400" : "text-slate-500"}>
                    120MA {searchResult.momentum.ma120_trend}
                  </span>
                </div>
              )}
            </div>
          )}

          {searchResult?.error && (
            <div className="text-center py-3 text-red-400 text-xs mb-2">{searchResult.error}</div>
          )}
          {registerError && (
            <div className="text-center py-3 text-red-400 text-xs mb-2 bg-red-500/5 rounded-lg">{registerError}</div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 pb-24 flex flex-col gap-2.5">
        {/* Portfolio Kelly Panel — 편입된 종목이 있을 때만 표시 */}
        {portfolioCount > 0 && (
          <PortfolioKellyPanel stocks={stocks} kellyFraction={kellyFraction} setKellyFraction={setKellyFraction} />
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-600 text-sm animate-pulse">로딩 중...</div>
        ) : stocks.length === 0 && !searchResult ? (
          <div className="flex flex-col items-center justify-center py-28 gap-6 opacity-80">
            <div className="text-6xl">🐺</div>
            <div className="text-center font-mono text-slate-500 leading-relaxed">
              Wolf Radar 활성화 대기 중<br />
              <span className="text-xs text-slate-600">위 검색창에서 종목을 검색하여 등록하세요</span><br />
              <span className="text-[10px] text-slate-700">US, KR, HK, JP 등 글로벌 주식 검색 가능</span>
            </div>
          </div>
        ) : (
          stocks.map(s => (
            <StockCard key={s.id} stock={s}
              onClick={() => setSelectedStock(s)}
              onTogglePortfolio={handleTogglePortfolio}
              admin={admin} />
          ))
        )}
      </main>

      {selectedStock && (
        <DetailPanel
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
          onUpdate={u => { setStocks(prev => prev.map(p => p.id === u.id ? u : p)); setSelectedStock(u); }}
          onDelete={id => { setStocks(prev => prev.filter(p => p.id !== id)); setSelectedStock(null); }}
          onTogglePortfolio={handleTogglePortfolio}
          admin={admin}
        />
      )}
    </div>
  );
}
