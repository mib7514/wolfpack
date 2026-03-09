"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from "recharts";

const C = {
  bg: "#0a0e17", card: "#111827", border: "#1e293b",
  accent: "#f59e0b", bond: "#3b82f6", equity: "#10b981",
  danger: "#ef4444", text: "#f1f5f9", dim: "#64748b",
  muted: "#475569", grid: "#1e293b", purple: "#a855f7",
  core: "#6366f1",
};
const MONO = "'JetBrains Mono','SF Mono','Fira Code',monospace";
const DISPLAY = "'Playfair Display',Georgia,serif";

/* ── helpers ──────────────────────────────────────────── */
function buildTimeSeries(years, coreRatio, bcpRatio, eqRatio, coreYield, bcpYield, eqRet) {
  const data = [];
  const months = years * 12;
  let coreIncome = 0, bcpIncome = 0, eqPnL = 0;
  for (let m = 0; m <= months; m++) {
    if (m > 0) {
      coreIncome += (coreRatio * coreYield / 100) / 12;
      bcpIncome += (bcpRatio * bcpYield / 100) / 12;
      eqPnL += (eqRatio) * (eqRet / 12 / 100);
    }
    data.push({
      month: m,
      core: +coreRatio.toFixed(1),
      coreIncome: +coreIncome.toFixed(2),
      bcpIncome: +bcpIncome.toFixed(2),
      eqPnL: +eqPnL.toFixed(2),
      totalValue: +(coreRatio + bcpRatio + eqRatio + coreIncome + bcpIncome + eqPnL).toFixed(2),
    });
  }
  return data;
}

function Sel({ label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px]" style={{ color: C.dim }}>{label}</label>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-md px-2 py-1 text-xs"
        style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: MONO }}>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

/* ── draggable allocation bar ─────────────────────────── */
function AllocationBar({ coreRatio, bcpRatio, eqRatio, onChange }) {
  const barRef = useRef(null);
  const dragging = useRef(null);

  const getPos = useCallback((e) => {
    const rect = barRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }, []);

  const onDown = useCallback((handle) => (e) => {
    e.preventDefault();
    dragging.current = handle;
  }, []);

  const onMove = useCallback((e) => {
    if (!dragging.current) return;
    const pos = getPos(e);
    const h = dragging.current;
    if (h === "a") {
      const newCore = Math.max(50, Math.min(95, Math.round(pos)));
      const remaining = 100 - newCore;
      const oldBcpEq = bcpRatio + eqRatio;
      if (oldBcpEq > 0) {
        const newBcp = Math.max(0, Math.round(remaining * bcpRatio / oldBcpEq));
        const newEq = remaining - newBcp;
        onChange(newCore, newBcp, newEq);
      } else {
        onChange(newCore, remaining, 0);
      }
    } else if (h === "b") {
      const newCoreBcp = Math.max(coreRatio + 1, Math.min(100, Math.round(pos)));
      const newBcp = newCoreBcp - coreRatio;
      const newEq = 100 - newCoreBcp;
      if (newBcp >= 0 && newEq >= 0) {
        onChange(coreRatio, newBcp, newEq);
      }
    }
  }, [coreRatio, bcpRatio, eqRatio, onChange, getPos]);

  const onUp = useCallback(() => { dragging.current = null; }, []);

  useEffect(() => {
    const mm = (e) => onMove(e);
    const mu = () => onUp();
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    window.addEventListener("touchmove", mm);
    window.addEventListener("touchend", mu);
    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
      window.removeEventListener("touchmove", mm);
      window.removeEventListener("touchend", mu);
    };
  }, [onMove, onUp]);

  const handleStyle = {
    position: "absolute", top: -4, width: 20, height: 36,
    borderRadius: 6, cursor: "ew-resize", zIndex: 10,
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
  };

  return (
    <div className="mb-6">
      <div ref={barRef} className="relative rounded-lg overflow-visible" style={{ height: 28, userSelect: "none" }}>
        <div className="absolute inset-0 flex rounded-lg overflow-hidden">
          <div style={{ width: `${coreRatio}%`, background: `${C.core}cc`, transition: dragging.current ? "none" : "width 0.2s" }}
            className="flex items-center justify-center">
            {coreRatio >= 15 && <span className="text-[10px] font-bold text-white/90">만기매칭 {coreRatio}%</span>}
          </div>
          <div style={{ width: `${bcpRatio}%`, background: `${C.accent}cc`, transition: dragging.current ? "none" : "width 0.2s" }}
            className="flex items-center justify-center">
            {bcpRatio >= 10 && <span className="text-[10px] font-bold text-white/90">BCP {bcpRatio}%</span>}
          </div>
          <div style={{ width: `${eqRatio}%`, background: `${C.equity}cc`, transition: dragging.current ? "none" : "width 0.2s" }}
            className="flex items-center justify-center">
            {eqRatio >= 8 && <span className="text-[10px] font-bold text-white/90">주식 {eqRatio}%</span>}
          </div>
        </div>
        {/* Handle A: between core and bcp */}
        <div onMouseDown={onDown("a")} onTouchStart={onDown("a")}
          style={{ ...handleStyle, left: `calc(${coreRatio}% - 10px)`, background: "#fff", border: `2px solid ${C.core}` }}>
          <span style={{ color: C.core, fontSize: 10, fontWeight: 900 }}>⋮</span>
        </div>
        {/* Handle B: between bcp and equity */}
        <div onMouseDown={onDown("b")} onTouchStart={onDown("b")}
          style={{ ...handleStyle, left: `calc(${coreRatio + bcpRatio}% - 10px)`, background: "#fff", border: `2px solid ${C.accent}` }}>
          <span style={{ color: C.accent, fontSize: 10, fontWeight: 900 }}>⋮</span>
        </div>
      </div>
      <p className="text-[9px] mt-2 text-center" style={{ color: C.muted }}>
        ◀ 핸들을 드래그하여 비율 조정 ▶
      </p>
    </div>
  );
}

/* ── main ─────────────────────────────────────────────── */
export default function FundIdeasPage() {
  const [years, setYears] = useState(3);
  const [coreRatio, setCoreRatio] = useState(85);
  const [bcpRatio, setBcpRatio] = useState(10);
  const [eqRatio, setEqRatio] = useState(5);
  const [coreYield, setCoreYield] = useState(3.5);
  const [bcpYield, setBcpYield] = useState(5.5);
  const [eqRet, setEqRet] = useState(12);
  const [tab, setTab] = useState("allocator");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const handleAlloc = useCallback((c, b, e) => {
    setCoreRatio(c); setBcpRatio(b); setEqRatio(e);
  }, []);

  const ts = useMemo(() => buildTimeSeries(years, coreRatio, bcpRatio, eqRatio, coreYield, bcpYield, eqRet),
    [years, coreRatio, bcpRatio, eqRatio, coreYield, bcpYield, eqRet]);
  const last = ts[ts.length - 1];

  const totalBondIncome = +(last?.coreIncome + last?.bcpIncome).toFixed(2);
  const worstCase = +(coreRatio + bcpRatio * (1 - 0.03 * years) + last?.coreIncome).toFixed(1);

  const scenarios = useMemo(() => {
    const bondIncome = (coreRatio * coreYield / 100 + bcpRatio * bcpYield / 100) * years;
    return [
      { name: "최악", desc: "주식-100% BCP-3%", result: +(coreRatio + bcpRatio * 0.97 + bondIncome - eqRatio).toFixed(1), color: C.danger },
      { name: "하락", desc: "주식-30%", result: +(100 + bondIncome - eqRatio * 0.3).toFixed(1), color: "#f97316" },
      { name: "보합", desc: "주식 0%", result: +(100 + bondIncome).toFixed(1), color: C.dim },
      { name: "상승", desc: "주식+30%", result: +(100 + bondIncome + eqRatio * 0.3).toFixed(1), color: C.equity },
      { name: "강세", desc: "주식+60%", result: +(100 + bondIncome + eqRatio * 0.6).toFixed(1), color: "#22d3ee" },
    ];
  }, [coreRatio, bcpRatio, eqRatio, coreYield, bcpYield, eqRet, years]);

  const fade = (d = 0) => ({
    opacity: ready ? 1 : 0, transform: ready ? "translateY(0)" : "translateY(16px)",
    transition: `all .7s cubic-bezier(.16,1,.3,1) ${d}s`,
  });

  return (
    <div className="min-h-screen p-5 overflow-auto" style={{ background: C.bg, color: C.text, fontFamily: MONO }}>

      <header style={fade(0)} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: C.accent, boxShadow: `0 0 10px ${C.accent}66` }} />
          <span className="text-[11px] tracking-[3px] uppercase" style={{ color: C.accent }}>늑대무리원정단 · 역목표전환형</span>
        </div>
        <h1 className="text-[28px] font-bold leading-tight" style={{ fontFamily: DISPLAY, background: `linear-gradient(135deg,${C.text},${C.accent})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          역목표전환형 펀드
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed max-w-xl" style={{ color: C.dim }}>
          만기매칭 코어로 원금을 구조적으로 보전하고, BCP 크레딧 알파 + 주식 업사이드를 추구하는 코어-새틀라이트 전략
        </p>
      </header>

      {/* core structure */}
      <section style={fade(0.15)} className="rounded-xl p-5 mb-5" css={{ background: C.card, border: `1px solid ${C.border}` }}>
        <p className="text-[10px] tracking-[2px] uppercase mb-4" style={{ color: C.muted }}>핵심 구조 — 코어-새틀라이트</p>
        <div className="flex items-center justify-center gap-2 flex-wrap mb-5">
          {[
            { emoji: "🔒", title: "만기매칭 코어", sub: `원금 구조적 확정 · ${coreRatio}%`, val: `${coreYield}%`, color: C.core },
            null,
            { emoji: "⚡", title: "BCP 새틀라이트", sub: `크레딧 α 추구 · ${bcpRatio}%`, val: `${bcpYield}%`, color: C.accent },
            null,
            { emoji: "📈", title: "주식 업사이드", sub: `BCP 수익 재원 · ${eqRatio}%`, val: "α", color: C.equity },
          ].map((b, i) =>
            b ? (
              <div key={i} className="flex-1 min-w-[120px] max-w-[160px] rounded-lg p-3 text-center" style={{ background: `${b.color}12`, border: `1px solid ${b.color}40` }}>
                <div className="text-xl mb-1">{b.emoji}</div>
                <div className="text-[12px] font-bold" style={{ color: b.color }}>{b.title}</div>
                <div className="text-[9px] mt-1" style={{ color: C.dim }}>{b.sub}</div>
                <div className="text-lg font-bold mt-1" style={{ color: b.color }}>{b.val}</div>
              </div>
            ) : (
              <div key={i} className="flex flex-col items-center px-0.5">
                <span className="text-lg" style={{ color: C.dim }}>+</span>
              </div>
            )
          )}
        </div>
        <div className="rounded-lg p-3 text-center text-[12px] font-semibold" style={{ background: `${C.core}08`, border: `1px solid ${C.core}20`, color: C.core }}>
          만기매칭 {coreRatio}%가 원금을 구조적으로 잠근다 → BCP 시가 변동과 무관하게 원금 보전
        </div>
      </section>

      {/* controls */}
      <div style={fade(0.25)} className="rounded-xl p-4 mb-5 flex flex-wrap items-center gap-5" css={{ background: C.card, border: `1px solid ${C.border}` }}>
        <span className="text-[10px] tracking-[2px] uppercase" style={{ color: C.muted }}>파라미터</span>
        <Sel label="투자기간" value={years} onChange={setYears} options={[1,2,3,5].map(v=>({v,l:`${v}년`}))} />
        <Sel label="만기매칭 금리" value={coreYield} onChange={setCoreYield} options={[2.5,3.0,3.5,4.0,4.5].map(v=>({v,l:`${v}%`}))} />
        <Sel label="BCP 수익률" value={bcpYield} onChange={setBcpYield} options={[4.0,4.5,5.0,5.5,6.0,6.5,7.0].map(v=>({v,l:`${v}%`}))} />
        <Sel label="주식 기대수익" value={eqRet} onChange={setEqRet} options={[-30,-20,-10,0,8,12,15,20,30].map(v=>({v,l:`${v>0?"+":""}${v}%`}))} />
      </div>

      {/* tabs */}
      <div className="flex gap-1 mb-5">
        {[
          { k: "allocator", l: "자산배분 설계" },
          { k: "structure", l: "구조 변화" },
          { k: "scenario", l: "시나리오 분석" },
          { k: "compare", l: "전략 비교" },
        ].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className="flex-1 py-2.5 rounded-lg text-[11px] transition-all"
            style={{ fontFamily: MONO, background: tab === t.k ? `${C.accent}20` : C.card, border: `1px solid ${tab === t.k ? C.accent+"60" : C.border}`, color: tab === t.k ? C.accent : C.dim, fontWeight: tab === t.k ? 700 : 400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ════ TAB: allocator ════ */}
      {tab === "allocator" && (
        <section className="rounded-xl p-5 mb-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <p className="text-[10px] tracking-[2px] uppercase" style={{ color: C.muted }}>자산배분 설계</p>
          <p className="text-[12px] mb-5" style={{ color: C.dim }}>핸들을 드래그해서 만기매칭 / BCP / 주식 비율을 직접 조정</p>

          <AllocationBar coreRatio={coreRatio} bcpRatio={bcpRatio} eqRatio={eqRatio} onChange={handleAlloc} />

          {/* 3-column detail */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-lg p-4" style={{ background: `${C.core}10`, border: `1px solid ${C.core}30` }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🔒</span>
                <span className="text-[11px] font-bold" style={{ color: C.core }}>만기매칭 코어</span>
              </div>
              <div className="text-[28px] font-bold mb-1" style={{ color: C.core }}>{coreRatio}%</div>
              <p className="text-[9px] leading-relaxed" style={{ color: C.dim }}>
                1년 만기 국채/AA+급 · 만기보유 → 금리 변동 무관 원금 확정 · {years}년 누적 이자: <span className="font-bold" style={{ color: C.core }}>+{(coreRatio * coreYield / 100 * years).toFixed(1)}%</span>
              </p>
            </div>

            <div className="rounded-lg p-4" style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}30` }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">⚡</span>
                <span className="text-[11px] font-bold" style={{ color: C.accent }}>BCP 새틀라이트</span>
              </div>
              <div className="text-[28px] font-bold mb-1" style={{ color: C.accent }}>{bcpRatio}%</div>
              <p className="text-[9px] leading-relaxed" style={{ color: C.dim }}>
                A-이상 크레딧 액티브 · 듀레이션 2년 · 시가평가 변동 있음 · {years}년 기대수익: <span className="font-bold" style={{ color: C.accent }}>+{(bcpRatio * bcpYield / 100 * years).toFixed(1)}%</span>
              </p>
              <div className="rounded-md p-2 mt-2 text-[9px]" style={{ background: `${C.danger}10`, color: C.danger }}>
                ⚠️ 금리↑ / 스프레드↑ 시 일시적 평가손 가능 — 만기매칭 코어가 원금 방어
              </div>
            </div>

            <div className="rounded-lg p-4" style={{ background: `${C.equity}10`, border: `1px solid ${C.equity}30` }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">📈</span>
                <span className="text-[11px] font-bold" style={{ color: C.equity }}>주식 업사이드</span>
              </div>
              <div className="text-[28px] font-bold mb-1" style={{ color: C.equity }}>{eqRatio}%</div>
              <p className="text-[9px] leading-relaxed" style={{ color: C.dim }}>
                채권 이자수익이 쌓이면 주식 비중 확대 여지 · 최대 손실 = 주식 배분분 · {years}년 기대: <span className="font-bold" style={{ color: C.equity }}>{eqRet >= 0 ? "+" : ""}{(eqRatio * eqRet / 100 * years).toFixed(1)}%</span>
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-lg p-4" style={{ background: C.bg }}>
            <p className="text-[10px] tracking-[2px] uppercase mb-3" style={{ color: C.muted }}>{years}년 투자 시 기대 결과</p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { l: "채권 이자 합계", v: `+${totalBondIncome}`, c: C.accent },
                { l: "주식 기대손익", v: `${last?.eqPnL >= 0 ? "+" : ""}${last?.eqPnL}`, c: last?.eqPnL >= 0 ? C.equity : C.danger },
                { l: "기대 총 가치", v: `${last?.totalValue}`, c: C.text },
                { l: "최악 시 가치", v: `${scenarios[0].result}`, c: C.danger },
              ].map(s => (
                <div key={s.l} className="text-center">
                  <p className="text-[9px] uppercase tracking-[1px] mb-1" style={{ color: C.muted }}>{s.l}</p>
                  <p className="text-[18px] font-bold" style={{ color: s.c }}>{s.v}<span className="text-[10px]" style={{ color: C.dim }}>%</span></p>
                </div>
              ))}
            </div>

            <div className="rounded-md p-3 mt-3" style={{ background: `${C.core}10`, border: `1px solid ${C.core}25` }}>
              <p className="text-[11px] leading-relaxed" style={{ color: C.core }}>
                <span className="font-bold">원금 방어 로직:</span> 만기매칭 {coreRatio}%는 만기보유로 원금 확정.
                BCP {bcpRatio}%에서 최대 평가손(-3%/yr 가정)이 발생해도
                만기매칭 이자({(coreRatio * coreYield / 100 * years).toFixed(1)}%)가 상쇄.
                주식 {eqRatio}%가 전멸해도 총 가치 <span className="font-bold">{scenarios[0].result}%</span> — {scenarios[0].result >= 100 ? "원금 보존 ✓" : `${(100 - scenarios[0].result).toFixed(1)}% 제한적 손실`}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ════ TAB: structure ════ */}
      {tab === "structure" && (
        <section className="rounded-xl p-5 mb-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <p className="text-[10px] tracking-[2px] uppercase" style={{ color: C.muted }}>시간에 따른 가치 변화</p>
          <p className="text-[12px] mb-4" style={{ color: C.dim }}>만기매칭 이자 + BCP 수익이 누적되며 총 가치 상승</p>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={ts} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
              <XAxis dataKey="month" tickFormatter={v => v % 12 === 0 ? `${v/12}Y` : ""} tick={{ fill: C.dim, fontSize: 10, fontFamily: MONO }} stroke={C.grid} interval={0} />
              <YAxis tick={{ fill: C.dim, fontSize: 10, fontFamily: MONO }} stroke={C.grid} domain={[96,"auto"]} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-lg p-3 text-[11px]" style={{ background: "#1e293b", border: `1px solid ${C.accent}33`, fontFamily: MONO }}>
                    <p style={{ color: C.dim }}>{d.month}개월차</p>
                    <p style={{ color: C.core }}>만기매칭 이자: +{d.coreIncome}%</p>
                    <p style={{ color: C.accent }}>BCP 수익: +{d.bcpIncome}%</p>
                    <p style={{ color: d.eqPnL >= 0 ? C.equity : C.danger }}>주식 손익: {d.eqPnL > 0 ? "+" : ""}{d.eqPnL}%</p>
                    <p className="mt-1 pt-1 font-bold" style={{ color: C.text, borderTop: `1px solid ${C.border}` }}>총 가치: {d.totalValue}%</p>
                  </div>
                );
              }} />
              <Area type="monotone" dataKey={() => coreRatio + bcpRatio + eqRatio} stackId="1" fill={`${C.core}20`} stroke={C.core} strokeWidth={0} name="원금" />
              <Area type="monotone" dataKey="coreIncome" stackId="1" fill={`${C.core}40`} stroke={C.core} strokeWidth={1} />
              <Area type="monotone" dataKey="bcpIncome" stackId="1" fill={`${C.accent}40`} stroke={C.accent} strokeWidth={1} />
              <Area type="monotone" dataKey="eqPnL" stackId="1" fill={eqRet >= 0 ? `${C.equity}40` : `${C.danger}40`} stroke={eqRet >= 0 ? C.equity : C.danger} strokeWidth={1} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center mt-3 flex-wrap">
            {[[C.core,"원금 + 만기매칭 이자"],[C.accent,"BCP 수익"],[eqRet >= 0 ? C.equity : C.danger,"주식 손익"]].map(([c,l]) => (
              <div key={l} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c }} />
                <span className="text-[10px]" style={{ color: C.dim }}>{l}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { l: "최종 가치", v: last?.totalValue, c: C.text },
              { l: "채권 이자 합계", v: `+${totalBondIncome}`, c: C.accent },
              { l: "주식 손익", v: `${last?.eqPnL > 0 ? "+" : ""}${last?.eqPnL}`, c: last?.eqPnL >= 0 ? C.equity : C.danger },
            ].map((s) => (
              <div key={s.l} className="rounded-lg p-3 text-center" style={{ background: C.bg }}>
                <p className="text-[9px] tracking-[1px] uppercase mb-1" style={{ color: C.muted }}>{s.l}</p>
                <p className="text-[22px] font-bold" style={{ color: s.c }}>{s.v}<span className="text-[11px]" style={{ color: C.dim }}>%</span></p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ════ TAB: scenario ════ */}
      {tab === "scenario" && (
        <section className="rounded-xl p-5 mb-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <p className="text-[10px] tracking-[2px] uppercase" style={{ color: C.muted }}>시나리오별 최종 가치 — 만기매칭 {coreRatio}% · BCP {bcpRatio}% · 주식 {eqRatio}%</p>
          <p className="text-[12px] mb-5" style={{ color: C.dim }}>만기매칭 코어가 원금을 구조적으로 방어</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={scenarios} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: C.dim, fontSize: 11, fontFamily: MONO }} stroke={C.grid} />
              <YAxis tick={{ fill: C.dim, fontSize: 10, fontFamily: MONO }} stroke={C.grid} domain={[Math.min(95, scenarios[0].result - 2),"auto"]} />
              <ReferenceLine y={100} stroke={C.danger} strokeDasharray="4 4" label={{ value: "원금 100", fill: C.danger, fontSize: 9, fontFamily: MONO, position: "left" }} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload;
                return (<div className="rounded-lg p-3 text-[11px]" style={{ background: "#1e293b", border: `1px solid ${C.accent}33`, fontFamily: MONO }}><p className="font-bold" style={{ color: d.color }}>{d.name} — {d.desc}</p><p style={{ color: C.text }}>최종 가치: {d.result}%</p></div>);
              }} />
              <Bar dataKey="result" radius={[4,4,0,0]}>{scenarios.map((e, i) => <Cell key={i} fill={e.color + "cc"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4">
            {scenarios.map((s) => (
              <div key={s.name} className="flex items-center justify-between py-2 px-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: s.color }} />
                  <span className="text-[11px]" style={{ color: C.dim }}>{s.name}</span>
                  <span className="text-[10px]" style={{ color: C.muted }}>({s.desc})</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[12px] font-bold" style={{ color: s.result >= 100 ? C.equity : C.danger }}>{s.result}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: s.result >= 100 ? `${C.equity}20` : `${C.danger}20`, color: s.result >= 100 ? C.equity : C.danger }}>
                    {s.result >= 100 ? "원금 보존 ✓" : `${(100 - s.result).toFixed(1)}% 제한 손실`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ════ TAB: compare ════ */}
      {tab === "compare" && (
        <section className="rounded-xl p-5 mb-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <p className="text-[10px] tracking-[2px] uppercase mb-4" style={{ color: C.muted }}>기존 목표전환형 vs 역목표전환형</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-4" style={{ background: `${C.muted}10`, border: `1px solid ${C.muted}30` }}>
              <p className="text-[11px] font-bold mb-3" style={{ color: C.muted }}>기존 목표전환형</p>
              {["📈 주식으로 시작","🎯 목표수익 달성 시","🛡️ 패시브 채권으로 전환"].map((t) => (<p key={t} className="text-[11px] mb-2" style={{ color: C.dim }}>{t}</p>))}
              <div className="rounded-md p-2 mt-3 text-[10px] leading-relaxed" style={{ background: `${C.danger}15`, color: C.danger }}>
                ⚠️ 목표 미달성 시 원금 손실 가능<br/>⚠️ 전환 타이밍이 시장에 종속<br/>⚠️ 채권 파트는 패시브 (알파 없음)
              </div>
            </div>
            <div className="rounded-lg p-4" style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}40` }}>
              <p className="text-[11px] font-bold mb-3" style={{ color: C.accent }}>역목표전환형 (코어-새틀라이트) ✦</p>
              {["🔒 만기매칭 코어로 원금 구조 확정","⚡ BCP 새틀라이트로 크레딧 α","📈 주식으로 추가 업사이드"].map((t) => (<p key={t} className="text-[11px] mb-2" style={{ color: C.text }}>{t}</p>))}
              <div className="rounded-md p-2 mt-3 text-[10px] leading-relaxed" style={{ background: `${C.equity}15`, color: C.equity }}>
                ✓ 만기매칭이 원금 구조적 보전<br/>✓ BCP 평가손에도 원금 방어 유지<br/>✓ 채권·주식 모두 액티브
              </div>
            </div>
          </div>
          <div className="rounded-lg p-4 mt-5" style={{ background: C.bg }}>
            <p className="text-[10px] tracking-[2px] uppercase mb-3" style={{ color: C.muted }}>타겟 고객</p>
            {[
              ["🏦","예금금리(2%)에 만족 못하지만 원금손실은 절대 불가인 보수적 투자자"],
              ["🏢","보험사 일반계정 — K-ICS 친화적 구조 + 주식 업사이드 참여"],
              ["👴","퇴직연금/은퇴자금 — 원금보존 + 인플레이션 방어가 동시에 필요한 수요"],
              ["💼","법인 여유자금 — 원금 훼손 불가 + 예금 이상의 수익률 추구"],
            ].map(([e,t]) => (
              <div key={t} className="flex items-start gap-2.5 mb-2">
                <span className="text-base">{e}</span>
                <span className="text-[11px] leading-relaxed" style={{ color: C.dim }}>{t}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="text-center pt-4 mt-2" style={{ borderTop: `1px solid ${C.border}` }}>
        <p className="text-[9px] tracking-[1px]" style={{ color: C.muted }}>WOLFPACK CONTROL TOWER · 역목표전환형 · v0.3</p>
        <p className="text-[9px] mt-1" style={{ color: C.muted }}>Core-Satellite Reverse Target Conversion Fund · Maturity-Matched + BCP + Equity</p>
      </footer>
    </div>
  );
}
