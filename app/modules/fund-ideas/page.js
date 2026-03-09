"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, Cell, ComposedChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from "recharts";

const C = {
  bg: "#0a0e17", card: "#111827", border: "#1e293b",
  accent: "#f59e0b", bond: "#3b82f6", equity: "#10b981",
  danger: "#ef4444", text: "#f1f5f9", dim: "#64748b",
  muted: "#475569", grid: "#1e293b", core: "#6366f1",
  safe: "#22c55e", warn: "#f97316",
};
const MONO = "'JetBrains Mono','SF Mono','Fira Code',monospace";
const DISPLAY = "'Playfair Display',Georgia,serif";

/* ── PV math ─────────────────────────────────────────── */
function pvAnnuity(rate, years) {
  const n = Math.round(years * 2);
  const sr = rate / 100 / 2;
  if (sr <= 0 || n <= 0) return 0;
  return (1 - Math.pow(1 + sr, -n)) / sr;
}

function safeEquityMax(coreBase, coreYield, years) {
  // max equity E such that: coreBase * coupon * pvFactor = E * (1 + pvFactor * coupon)
  // simplified: E = coreBase * c * pvF / (1 + c * pvF)
  const c = coreYield / 100 / 2;
  const pvF = pvAnnuity(coreYield, years);
  if (pvF <= 0) return 0;
  return coreBase * c * pvF / (1 + c * pvF);
}

function worstCase(coreAmt, bcpAmt, eqAmt, coreYield, bcpStress, years) {
  const coreIncome = coreAmt * coreYield / 100 * years;
  const bcpLoss = bcpAmt * bcpStress / 100;
  return coreAmt + bcpAmt - bcpLoss + coreIncome - eqAmt;
}

function buildData(years, coreAmt, bcpAmt, eqAmt, coreYield, bcpYield, eqRet) {
  const steps = Math.round(years * 2);
  const data = [];
  let ci = 0, bi = 0, eqVal = eqAmt;
  for (let i = 0; i <= steps; i++) {
    if (i > 0) {
      ci += coreAmt * (coreYield / 100) / 2;
      bi += bcpAmt * (bcpYield / 100) / 2;
      eqVal += eqVal * (eqRet / 100) / 2;
    }
    data.push({
      label: `${(i / 2).toFixed(1)}Y`,
      bonds: +(coreAmt + bcpAmt).toFixed(2),
      income: +ci.toFixed(2),
      bcpIncome: +bi.toFixed(2),
      equity: +eqVal.toFixed(2),
      total: +(coreAmt + bcpAmt + ci + bi + eqVal).toFixed(2),
    });
  }
  return data;
}

/* ── slider ───────────────────────────────────────────── */
function Slider({ label, value, min, max, step, onChange, color, unit, prefix, marker, markerLabel }) {
  const pct = ((value - min) / (max - min)) * 100;
  const mPct = marker != null ? ((marker - min) / (max - min)) * 100 : null;
  const id = label.replace(/[\s·→%]/g, "");
  return (
    <div className="flex-1 min-w-[200px]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px]" style={{ color: C.dim }}>{label}</span>
        <span className="text-[13px] font-bold tabular-nums" style={{ color }}>
          {prefix && value > 0 ? "+" : ""}{value.toFixed(step < 1 ? 1 : 0)}{unit}
        </span>
      </div>
      <div className="relative h-7 flex items-center">
        <div className="absolute w-full h-1.5 rounded-full" style={{ background: C.border }} />
        <div className="absolute h-1.5 rounded-full" style={{ background: color, width: `${pct}%`, opacity: 0.6 }} />
        {mPct != null && (
          <div className="absolute flex flex-col items-center" style={{ left: `${mPct}%`, transform: "translateX(-50%)", top: -14 }}>
            <span className="text-[8px] font-bold whitespace-nowrap px-1 rounded" style={{ background: C.safe, color: "#000" }}>{markerLabel}</span>
            <div style={{ width: 2, height: 22, background: C.safe, opacity: 0.8 }} />
          </div>
        )}
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`sl-${id} absolute w-full bg-transparent cursor-pointer`}
          style={{ height: 24, margin: 0, WebkitAppearance: "none", appearance: "none", zIndex: 5 }} />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[8px]" style={{ color: C.muted }}>{min}{unit}</span>
        <span className="text-[8px]" style={{ color: C.muted }}>{max}{unit}</span>
      </div>
      <style>{`
        .sl-${id}::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.5);cursor:pointer;}
        .sl-${id}::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.5);cursor:pointer;}
      `}</style>
    </div>
  );
}

/* ── tooltip ──────────────────────────────────────────── */
function ChartTip({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg p-3 text-[11px]" style={{ background: "#1e293b", border: `1px solid ${C.accent}33`, fontFamily: MONO }}>
      <p className="font-bold mb-1" style={{ color: C.text }}>{d.label}</p>
      <p style={{ color: C.core }}>채권: {d.bonds}</p>
      <p style={{ color: C.accent }}>이자: +{d.income} · BCP: +{d.bcpIncome}</p>
      <p style={{ color: C.equity }}>주식: {d.equity}</p>
      <p className="mt-1 pt-1 font-bold" style={{ color: C.text, borderTop: `1px solid ${C.border}` }}>총: {d.total}</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════ */
export default function FundIdeasPage() {
  const [years, setYears] = useState(3);
  const [bcpRatio, setBcpRatio] = useState(10);
  const [eqRatio, setEqRatio] = useState(0); // will be auto-set
  const [coreYield, setCoreYield] = useState(3.5);
  const [bcpYield, setBcpYield] = useState(5.5);
  const [bcpStress, setBcpStress] = useState(3);
  const [eqRet, setEqRet] = useState(12);
  const [tab, setTab] = useState("design");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const coreBase = 100 - bcpRatio;
  const safeMax = useMemo(() => +safeEquityMax(coreBase, coreYield, years).toFixed(1), [coreBase, coreYield, years]);

  // auto-set equity to safe max on param change
  useEffect(() => { setEqRatio(safeMax); }, [safeMax]);

  const coreAmt = +(coreBase - eqRatio).toFixed(1);
  const worst = useMemo(() => +worstCase(coreAmt, bcpRatio, eqRatio, coreYield, bcpStress, years).toFixed(1),
    [coreAmt, bcpRatio, eqRatio, coreYield, bcpStress, years]);
  const isSafe = worst >= 100;
  const isOverLimit = eqRatio > safeMax;

  const data = useMemo(() => buildData(years, coreAmt, bcpRatio, eqRatio, coreYield, bcpYield, eqRet),
    [years, coreAmt, bcpRatio, eqRatio, coreYield, bcpYield, eqRet]);
  const last = data[data.length - 1];

  const scenarios = useMemo(() => {
    const ci = coreAmt * coreYield / 100 * years;
    const bi = bcpRatio * bcpYield / 100 * years;
    const bLoss = bcpRatio * bcpStress / 100;
    return [
      { name: "최악", desc: `주식전멸+BCP-${bcpStress}%`, result: +(coreAmt + bcpRatio - bLoss + ci).toFixed(1), color: C.danger },
      { name: "하락", desc: "주식-30%", result: +(coreAmt + bcpRatio + ci + bi + eqRatio * 0.7).toFixed(1), color: "#f97316" },
      { name: "보합", desc: "주식 0%", result: +(coreAmt + bcpRatio + ci + bi + eqRatio).toFixed(1), color: C.dim },
      { name: "상승", desc: "주식+30%", result: +(coreAmt + bcpRatio + ci + bi + eqRatio * 1.3).toFixed(1), color: C.equity },
      { name: "강세", desc: "주식+60%", result: +(coreAmt + bcpRatio + ci + bi + eqRatio * 1.6).toFixed(1), color: "#22d3ee" },
    ];
  }, [coreAmt, bcpRatio, eqRatio, coreYield, bcpYield, bcpStress, years]);

  const fade = (d = 0) => ({ opacity: ready ? 1 : 0, transform: ready ? "translateY(0)" : "translateY(16px)", transition: `all .7s cubic-bezier(.16,1,.3,1) ${d}s` });

  return (
    <div className="min-h-screen p-5 overflow-auto" style={{ background: C.bg, color: C.text, fontFamily: MONO }}>

      <header style={fade(0)} className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: C.accent, boxShadow: `0 0 10px ${C.accent}66` }} />
          <span className="text-[11px] tracking-[3px] uppercase" style={{ color: C.accent }}>늑대무리원정단 · 역목표전환형</span>
        </div>
        <h1 className="text-[28px] font-bold leading-tight" style={{ fontFamily: DISPLAY, background: `linear-gradient(135deg,${C.text},${C.accent})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          역목표전환형 펀드
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed max-w-xl" style={{ color: C.dim }}>
          확정이자 PV만큼 Day 0부터 주식 참여 · 최악에서도 원금 100을 지키는 구조 설계
        </p>
      </header>

      {/* ═══ WORST CASE DASHBOARD — always visible ═══ */}
      <div style={fade(0.1)} className="rounded-xl p-4 mb-5 flex items-center gap-5 flex-wrap"
        css={{ background: isSafe ? `${C.safe}08` : `${C.danger}08`, border: `1px solid ${isSafe ? C.safe+"40" : C.danger+"40"}` }}>
        <div className="flex-1 min-w-[160px]">
          <p className="text-[9px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>최악의 시나리오 (주식 전멸 + BCP -{bcpStress}%)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-[36px] font-bold tabular-nums" style={{ color: isSafe ? C.safe : C.danger }}>{worst}</span>
            <span className="text-[14px]" style={{ color: C.dim }}>/ 100</span>
          </div>
        </div>
        <div className="flex-shrink-0 rounded-lg px-4 py-3 text-center"
          style={{ background: isSafe ? `${C.safe}20` : `${C.danger}20`, border: `1px solid ${isSafe ? C.safe+"60" : C.danger+"60"}` }}>
          {isSafe ? (
            <><p className="text-[20px] font-bold" style={{ color: C.safe }}>✓ 원금 보존</p>
              <p className="text-[10px]" style={{ color: C.safe }}>만기매칭 이자가 모든 손실을 상쇄</p></>
          ) : (
            <><p className="text-[20px] font-bold" style={{ color: C.danger }}>⚠ -{(100 - worst).toFixed(1)}%</p>
              <p className="text-[10px]" style={{ color: C.danger }}>주식 비중을 {safeMax}% 이하로 낮추세요</p></>
          )}
        </div>
      </div>

      {/* ═══ CONTROLS ═══ */}
      <div style={fade(0.15)} className="rounded-xl p-5 mb-5" css={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <span className="text-[10px] tracking-[2px] uppercase" style={{ color: C.muted }}>설계 파라미터</span>
          <div className="flex items-center gap-2">
            <label className="text-[11px]" style={{ color: C.dim }}>투자기간</label>
            <select value={years} onChange={(e) => setYears(Number(e.target.value))}
              className="rounded-md px-2 py-1 text-xs" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: MONO }}>
              {[1,1.5,2,2.5,3,4,5].map(v => <option key={v} value={v}>{v}년</option>)}
            </select>
          </div>
        </div>

        {/* Row 1: Yields */}
        <div className="flex gap-6 flex-wrap mb-4">
          <Slider label="만기매칭 금리" value={coreYield} min={1.0} max={5.0} step={0.1} onChange={setCoreYield} color={C.core} unit="%" />
          <Slider label="BCP 기대수익률" value={bcpYield} min={2.0} max={8.0} step={0.1} onChange={setBcpYield} color={C.accent} unit="%" />
          <Slider label="주식 기대수익률" value={eqRet} min={-30} max={40} step={0.1} onChange={setEqRet} color={C.equity} unit="%" prefix />
        </div>

        {/* Row 2: Allocation + Stress */}
        <div className="flex gap-6 flex-wrap">
          <Slider label="BCP 비중" value={bcpRatio} min={0} max={30} step={1} onChange={setBcpRatio} color={C.accent} unit="%" />
          <Slider label="주식 비중" value={eqRatio} min={0} max={Math.min(30, coreBase)} step={0.1} onChange={setEqRatio} color={C.equity} unit="%"
            marker={safeMax} markerLabel={`안전한도 ${safeMax}%`} />
          <Slider label="BCP 스트레스" value={bcpStress} min={0} max={10} step={0.5} onChange={setBcpStress} color={C.danger} unit="%" />
        </div>
      </div>

      {/* ═══ ALLOCATION BAR ═══ */}
      <div style={fade(0.2)} className="rounded-xl p-4 mb-5" css={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] tracking-[2px] uppercase" style={{ color: C.muted }}>Day 0 포트폴리오</span>
          {isOverLimit && <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: `${C.danger}20`, color: C.danger }}>⚠ 안전한도 초과</span>}
        </div>
        <div className="rounded-lg overflow-hidden" style={{ height: 36 }}>
          <div className="flex h-full">
            <div style={{ width: `${coreAmt}%`, background: `${C.core}cc` }} className="flex items-center justify-center">
              {coreAmt >= 12 && <span className="text-[10px] font-bold text-white/90">만기매칭 {coreAmt}%</span>}
            </div>
            <div style={{ width: `${bcpRatio}%`, background: `${C.accent}cc` }} className="flex items-center justify-center">
              {bcpRatio >= 6 && <span className="text-[10px] font-bold text-white/90">BCP {bcpRatio}%</span>}
            </div>
            <div style={{ width: `${eqRatio}%`, background: isOverLimit ? `${C.danger}cc` : `${C.equity}cc` }} className="flex items-center justify-center">
              {eqRatio >= 3 && <span className="text-[10px] font-bold text-white/90">주식 {eqRatio}%</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-4 justify-center mt-2 flex-wrap">
          {[
            [C.core, `만기매칭 ${coreAmt}%`, "원금+이자 확정"],
            [C.accent, `BCP ${bcpRatio}%`, "크레딧 α"],
            [isOverLimit ? C.danger : C.equity, `주식 ${eqRatio}%`, eqRatio <= safeMax ? "이자PV 이내 ✓" : "한도 초과 ⚠"],
          ].map(([c, l, s]) => (
            <div key={l} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c }} />
              <span className="text-[10px]" style={{ color: C.dim }}>{l}</span>
              <span className="text-[9px]" style={{ color: c }}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <div className="flex gap-1 mb-5">
        {[
          { k: "design", l: "구조 설계" },
          { k: "chart", l: "포트폴리오 변화" },
          { k: "scenario", l: "시나리오" },
          { k: "compare", l: "전략 비교" },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className="flex-1 py-2.5 rounded-lg text-[11px] transition-all"
            style={{ fontFamily: MONO, background: tab === t.k ? `${C.accent}20` : C.card, border: `1px solid ${tab === t.k ? C.accent+"60" : C.border}`, color: tab === t.k ? C.accent : C.dim, fontWeight: tab === t.k ? 700 : 400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ════ TAB: design ════ */}
      {tab === "design" && (
        <section className="rounded-xl p-5 mb-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <p className="text-[10px] tracking-[2px] uppercase mb-4" style={{ color: C.muted }}>원금 보존 구조 — 왜 마이너스가 안 나는가</p>

          {/* The core logic flow */}
          <div className="rounded-lg p-4 mb-5" style={{ background: C.bg }}>
            <div className="grid grid-cols-4 gap-2 items-center text-center">
              <div className="rounded-md p-3" style={{ background: `${C.core}15`, border: `1px solid ${C.core}30` }}>
                <p className="text-[9px] uppercase mb-1" style={{ color: C.muted }}>만기매칭 확정이자</p>
                <p className="text-[20px] font-bold" style={{ color: C.core }}>{(coreAmt * coreYield / 100 * years).toFixed(1)}%</p>
                <p className="text-[8px]" style={{ color: C.dim }}>{coreAmt}% × {coreYield}% × {years}Y</p>
              </div>
              <div>
                <p className="text-[9px] mb-1" style={{ color: C.muted }}>이자를 할인</p>
                <p className="text-lg" style={{ color: C.accent }}>→</p>
              </div>
              <div className="rounded-md p-3" style={{ background: `${C.equity}15`, border: `1px solid ${C.equity}30` }}>
                <p className="text-[9px] uppercase mb-1" style={{ color: C.muted }}>안전 주식 한도</p>
                <p className="text-[20px] font-bold" style={{ color: C.safe }}>{safeMax}%</p>
                <p className="text-[8px]" style={{ color: C.dim }}>= 이자의 현재가치</p>
              </div>
              <div>
                <p className="text-[9px] mb-1" style={{ color: C.muted }}>현재 주식 비중</p>
                <p className="text-[20px] font-bold" style={{ color: isOverLimit ? C.danger : C.equity }}>{eqRatio}%</p>
                <p className="text-[8px] font-bold" style={{ color: isOverLimit ? C.danger : C.safe }}>
                  {isOverLimit ? `한도 대비 +${(eqRatio - safeMax).toFixed(1)}%p` : "안전 범위 ✓"}
                </p>
              </div>
            </div>
          </div>

          {/* Loss absorption waterfall */}
          <p className="text-[10px] tracking-[2px] uppercase mb-3" style={{ color: C.muted }}>최악 시나리오 손실 흡수 워터폴</p>
          <div className="rounded-lg p-4 mb-5" style={{ background: C.bg }}>
            {(() => {
              const eqLoss = eqRatio;
              const bcpLoss = +(bcpRatio * bcpStress / 100).toFixed(2);
              const totalLoss = +(eqLoss + bcpLoss).toFixed(2);
              const coreIncome = +(coreAmt * coreYield / 100 * years).toFixed(2);
              const net = +(coreIncome - totalLoss).toFixed(2);
              return (
                <div className="space-y-3">
                  {/* Loss side */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] w-20 text-right" style={{ color: C.danger }}>손실</span>
                    <div className="flex-1 rounded-md overflow-hidden" style={{ height: 28 }}>
                      <div className="flex h-full">
                        <div style={{ width: `${eqLoss / Math.max(totalLoss, coreIncome) * 100}%`, background: `${C.danger}cc` }}
                          className="flex items-center justify-center">
                          <span className="text-[9px] font-bold text-white">주식 -{eqLoss}</span>
                        </div>
                        <div style={{ width: `${bcpLoss / Math.max(totalLoss, coreIncome) * 100}%`, background: `${C.warn}cc` }}
                          className="flex items-center justify-center">
                          {bcpLoss >= 0.3 && <span className="text-[9px] font-bold text-white">BCP -{bcpLoss}</span>}
                        </div>
                      </div>
                    </div>
                    <span className="text-[12px] font-bold w-16 text-right" style={{ color: C.danger }}>-{totalLoss}%</span>
                  </div>
                  {/* Absorption side */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] w-20 text-right" style={{ color: C.core }}>흡수</span>
                    <div className="flex-1 rounded-md overflow-hidden" style={{ height: 28 }}>
                      <div className="h-full" style={{ width: `${coreIncome / Math.max(totalLoss, coreIncome) * 100}%`, background: `${C.core}cc` }}
                        className="flex items-center justify-center">
                        <span className="text-[9px] font-bold text-white">만기매칭 이자 +{coreIncome}</span>
                      </div>
                    </div>
                    <span className="text-[12px] font-bold w-16 text-right" style={{ color: C.core }}>+{coreIncome}%</span>
                  </div>
                  {/* Net */}
                  <div className="flex items-center gap-3 pt-2" style={{ borderTop: `1px dashed ${C.border}` }}>
                    <span className="text-[10px] w-20 text-right font-bold" style={{ color: C.text }}>순 효과</span>
                    <div className="flex-1" />
                    <span className="text-[16px] font-bold w-16 text-right" style={{ color: net >= 0 ? C.safe : C.danger }}>
                      {net >= 0 ? "+" : ""}{net}%
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Two tracks */}
          <p className="text-[10px] tracking-[2px] uppercase mb-3" style={{ color: C.muted }}>투 트랙 주식 투자</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-4" style={{ background: `${C.equity}10`, border: `1px solid ${C.equity}30` }}>
              <p className="text-[11px] font-bold mb-1" style={{ color: C.equity }}>Track 1 · 선취</p>
              <p className="text-[22px] font-bold mb-1" style={{ color: C.equity }}>{Math.min(eqRatio, safeMax).toFixed(1)}%</p>
              <p className="text-[10px] leading-relaxed" style={{ color: C.dim }}>
                확정이자 PV = Day 0 주식<br/>
                주식 전멸해도 만기 이자가 상환<br/>
                <span className="font-bold" style={{ color: C.safe }}>수학적 원금 보전</span>
              </p>
            </div>
            <div className="rounded-lg p-4" style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}30` }}>
              <p className="text-[11px] font-bold mb-1" style={{ color: C.accent }}>Track 2 · 후취</p>
              <p className="text-[22px] font-bold mb-1" style={{ color: C.accent }}>+α</p>
              <p className="text-[10px] leading-relaxed" style={{ color: C.dim }}>
                BCP 수익 실현 시 추가 주식 투자<br/>
                {years}년간 BCP 기대: +{(bcpRatio * bcpYield / 100 * years).toFixed(1)}%<br/>
                <span className="font-bold" style={{ color: C.accent }}>시간이 갈수록 확대</span>
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ════ TAB: chart ════ */}
      {tab === "chart" && (
        <section className="rounded-xl p-5 mb-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <p className="text-[10px] tracking-[2px] uppercase" style={{ color: C.muted }}>포트폴리오 가치 변화 — {years}년</p>
          <p className="text-[12px] mb-4" style={{ color: C.dim }}>반기별 스냅샷 · 채권 위에 이자와 주식 수익이 쌓인다</p>

          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: C.dim, fontSize: 10, fontFamily: MONO }} stroke={C.grid} />
              <YAxis tick={{ fill: C.dim, fontSize: 10, fontFamily: MONO }} stroke={C.grid}
                domain={[0, (dm) => Math.ceil(dm / 10) * 10]}
                label={{ value: "가치 (%)", angle: -90, position: "insideLeft", fill: C.muted, fontSize: 9, fontFamily: MONO, dx: 15 }} />
              <Tooltip content={<ChartTip />} />
              <ReferenceLine y={100} stroke={C.danger} strokeDasharray="4 4" strokeWidth={1.5} />
              <Bar dataKey="bonds" stackId="a" fill={C.core} fillOpacity={0.7} name="채권" />
              <Bar dataKey="income" stackId="a" fill={`${C.core}`} fillOpacity={0.35} name="만기매칭 이자" />
              <Bar dataKey="bcpIncome" stackId="a" fill={C.accent} fillOpacity={0.6} name="BCP 수익" />
              <Bar dataKey="equity" stackId="a" fill={C.equity} fillOpacity={0.8} radius={[3,3,0,0]} name="주식" />
              <Line type="monotone" dataKey="total" stroke={C.text} strokeWidth={2} dot={{ r: 3, fill: C.text }} name="총 가치" />
            </ComposedChart>
          </ResponsiveContainer>

          <div className="flex gap-3 justify-center mt-2 flex-wrap">
            {[
              [`${C.core}b3`, "채권"], [`${C.core}59`, "이자"], [C.accent, "BCP수익"], [C.equity, "주식"], [C.text, "── 총가치"], [C.danger, "--- 원금100"],
            ].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: c }} /><span className="text-[9px]" style={{ color: C.dim }}>{l}</span></div>
            ))}
          </div>

          <div className="mt-4 rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
            <div className="grid grid-cols-6 text-[9px] uppercase tracking-wide text-center" style={{ background: C.border, color: C.muted }}>
              {["시점","채권","이자","BCP","주식","총 가치"].map(h => <div key={h} className="py-2">{h}</div>)}
            </div>
            {data.map((d, i) => (
              <div key={i} className="grid grid-cols-6 text-[10px] text-center" style={{ background: i % 2 === 0 ? C.bg : C.card, borderTop: `1px solid ${C.border}` }}>
                <div className="py-1.5 font-bold" style={{ color: C.text }}>{d.label}</div>
                <div className="py-1.5" style={{ color: C.core }}>{d.bonds}</div>
                <div className="py-1.5" style={{ color: C.core }}>+{d.income}</div>
                <div className="py-1.5" style={{ color: C.accent }}>+{d.bcpIncome}</div>
                <div className="py-1.5" style={{ color: C.equity }}>{d.equity}</div>
                <div className="py-1.5 font-bold" style={{ color: d.total >= 100 ? C.safe : C.danger }}>{d.total}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ════ TAB: scenario ════ */}
      {tab === "scenario" && (
        <section className="rounded-xl p-5 mb-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <p className="text-[10px] tracking-[2px] uppercase" style={{ color: C.muted }}>시나리오별 최종 가치</p>
          <p className="text-[12px] mb-5" style={{ color: C.dim }}>만기매칭 {coreAmt}% · BCP {bcpRatio}% · 주식 {eqRatio}% · {years}년</p>

          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={scenarios} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: C.dim, fontSize: 11, fontFamily: MONO }} stroke={C.grid} />
              <YAxis tick={{ fill: C.dim, fontSize: 10, fontFamily: MONO }} stroke={C.grid} domain={[Math.min(95, scenarios[0].result - 2), "auto"]} />
              <ReferenceLine y={100} stroke={C.danger} strokeDasharray="4 4" label={{ value: "원금", fill: C.danger, fontSize: 9, fontFamily: MONO, position: "left" }} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload;
                return (<div className="rounded-lg p-3 text-[11px]" style={{ background: "#1e293b", border: `1px solid ${C.accent}33`, fontFamily: MONO }}><p className="font-bold" style={{ color: d.color }}>{d.name} — {d.desc}</p><p style={{ color: C.text }}>최종: {d.result}%</p></div>);
              }} />
              <Bar dataKey="result" radius={[4,4,0,0]}>{scenarios.map((e, i) => <Cell key={i} fill={e.color + "cc"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4">
            {scenarios.map(s => (
              <div key={s.name} className="flex items-center justify-between py-2 px-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: s.color }} />
                  <span className="text-[11px]" style={{ color: C.dim }}>{s.name}</span>
                  <span className="text-[10px]" style={{ color: C.muted }}>({s.desc})</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[12px] font-bold" style={{ color: s.result >= 100 ? C.safe : C.danger }}>{s.result}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: s.result >= 100 ? `${C.safe}20` : `${C.danger}20`, color: s.result >= 100 ? C.safe : C.danger }}>
                    {s.result >= 100 ? "원금 보존 ✓" : `${(100 - s.result).toFixed(1)}% 손실`}
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
              {["📈 주식으로 시작","🎯 목표수익 달성 시","🛡️ 패시브 채권으로 전환"].map(t => (<p key={t} className="text-[11px] mb-2" style={{ color: C.dim }}>{t}</p>))}
              <div className="rounded-md p-2 mt-3 text-[10px] leading-relaxed" style={{ background: `${C.danger}15`, color: C.danger }}>⚠️ 원금 손실 가능<br/>⚠️ 전환 타이밍 시장 종속<br/>⚠️ 채권 파트 패시브</div>
            </div>
            <div className="rounded-lg p-4" style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}40` }}>
              <p className="text-[11px] font-bold mb-3" style={{ color: C.accent }}>역목표전환형 (PV 기반) ✦</p>
              {["🔒 확정이자 PV → Day 0 주식","⚡ BCP 실현수익 → 추가 주식","📐 만기 시 이자가 손실 상환"].map(t => (<p key={t} className="text-[11px] mb-2" style={{ color: C.text }}>{t}</p>))}
              <div className="rounded-md p-2 mt-3 text-[10px] leading-relaxed" style={{ background: `${C.safe}15`, color: C.safe }}>✓ 수학적 원금 보전<br/>✓ 채권·주식 모두 액티브<br/>✓ Day 0부터 주식 참여</div>
            </div>
          </div>
          <div className="rounded-lg p-4 mt-5" style={{ background: C.bg }}>
            <p className="text-[10px] tracking-[2px] uppercase mb-3" style={{ color: C.muted }}>타겟 고객</p>
            {[
              ["🏦","예금금리에 만족 못하지만 원금손실은 절대 불가인 보수적 투자자"],
              ["🏢","보험사 일반계정 — K-ICS 친화적 + 주식 업사이드"],
              ["👴","퇴직연금/은퇴자금 — 원금보존 + 인플레이션 방어"],
              ["💼","법인 여유자금 — 원금 훼손 불가 + 예금 이상 수익률"],
            ].map(([e,t]) => (
              <div key={t} className="flex items-start gap-2.5 mb-2"><span className="text-base">{e}</span><span className="text-[11px] leading-relaxed" style={{ color: C.dim }}>{t}</span></div>
            ))}
          </div>
        </section>
      )}

      <footer className="text-center pt-4 mt-2" style={{ borderTop: `1px solid ${C.border}` }}>
        <p className="text-[9px] tracking-[1px]" style={{ color: C.muted }}>WOLFPACK CONTROL TOWER · 역목표전환형 · v0.6</p>
        <p className="text-[9px] mt-1" style={{ color: C.muted }}>PV-Based Core-Satellite · Maturity-Matched + BCP + Equity</p>
      </footer>
    </div>
  );
}
