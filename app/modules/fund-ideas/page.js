"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  BarChart, Bar, Cell, ComposedChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Legend,
} from "recharts";

const C = {
  bg: "#0a0e17", card: "#111827", border: "#1e293b",
  accent: "#f59e0b", bond: "#3b82f6", equity: "#10b981",
  danger: "#ef4444", text: "#f1f5f9", dim: "#64748b",
  muted: "#475569", grid: "#1e293b", core: "#6366f1",
};
const MONO = "'JetBrains Mono','SF Mono','Fira Code',monospace";
const DISPLAY = "'Playfair Display',Georgia,serif";

/* ── PV math ─────────────────────────────────────────── */
function calcPV(bondBase, r, years) {
  // PV of semi-annual coupons from bondBase at annual rate r over Y years
  // pvFactor = 1 - (1 + r/2)^(-2Y)
  const n = Math.round(years * 2);
  const sr = r / 100 / 2;
  if (sr <= 0 || n <= 0) return 0;
  const pvF = 1 - Math.pow(1 + sr, -n);
  // E = bondBase * pvF / (1 + pvF)  -- solving simultaneous equation
  return bondBase * pvF / (1 + pvF);
}

function buildData(years, bcpRatio, coreYield, bcpYield, eqRet) {
  const bondBase = 100 - bcpRatio; // non-BCP portion
  const eqPre = calcPV(bondBase, coreYield, years);
  const coreAmt = bondBase - eqPre;
  const bcpAmt = bcpRatio;

  const steps = Math.round(years * 2); // semi-annual
  const data = [];
  let coreInc = 0, bcpCum = 0, eq1 = eqPre, eq2 = 0;

  for (let i = 0; i <= steps; i++) {
    const t = i / 2;
    if (i > 0) {
      const semiCoreInt = coreAmt * (coreYield / 100) / 2;
      coreInc += semiCoreInt;
      const semiBcpRet = bcpAmt * (bcpYield / 100) / 2;
      bcpCum += semiBcpRet;
      // BCP excess returns flow into Track 2 equity
      if (semiBcpRet > 0) {
        eq2 += semiBcpRet;
        bcpCum -= semiBcpRet; // BCP returns are redirected to equity
      }
      // Equity fluctuates
      const eqGrowth = (eq1 + eq2) * (eqRet / 100) / 2;
      eq1 += eqPre > 0 ? eqGrowth * (eq1 / (eq1 + eq2 || 1)) : 0;
      eq2 += (eq1 + eq2) > 0 ? eqGrowth * (eq2 / (eq1 + eq2 || 1)) : 0;
    }

    data.push({
      label: `${t}Y`,
      t,
      bonds: +(coreAmt + bcpAmt).toFixed(2),
      coreAmt: +coreAmt.toFixed(2),
      bcpAmt: +bcpAmt.toFixed(2),
      income: +coreInc.toFixed(2),
      equity: +(eq1 + eq2).toFixed(2),
      eq1: +eq1.toFixed(2),
      eq2: +eq2.toFixed(2),
      total: +(coreAmt + bcpAmt + coreInc + eq1 + eq2).toFixed(2),
    });
  }

  return { data, eqPre: +eqPre.toFixed(2), coreAmt: +coreAmt.toFixed(2), bcpAmt: +bcpAmt.toFixed(2) };
}

/* ── range slider ────────────────────────────────────── */
function Slider({ label, value, min, max, step, onChange, color, unit, prefix }) {
  const pct = ((value - min) / (max - min)) * 100;
  const id = label.replace(/\s/g, "");
  return (
    <div className="flex-1 min-w-[200px]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px]" style={{ color: C.dim }}>{label}</span>
        <span className="text-[13px] font-bold tabular-nums" style={{ color }}>
          {prefix && value > 0 ? "+" : ""}{value.toFixed(step < 1 ? 1 : 0)}{unit}
        </span>
      </div>
      <div className="relative h-6 flex items-center">
        <div className="absolute w-full h-1.5 rounded-full" style={{ background: C.border }} />
        <div className="absolute h-1.5 rounded-full" style={{ background: color, width: `${pct}%`, opacity: 0.6 }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`abs-slider-${id} absolute w-full bg-transparent cursor-pointer`}
          style={{ height: 24, margin: 0, WebkitAppearance: "none", appearance: "none" }} />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[8px]" style={{ color: C.muted }}>{min}{unit}</span>
        <span className="text-[8px]" style={{ color: C.muted }}>{max}{unit}</span>
      </div>
      <style>{`
        .abs-slider-${id}::-webkit-slider-thumb { -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:${color}; border:2px solid #fff; box-shadow:0 1px 6px rgba(0,0,0,.5); cursor:pointer; }
        .abs-slider-${id}::-moz-range-thumb { width:18px; height:18px; border-radius:50%; background:${color}; border:2px solid #fff; box-shadow:0 1px 6px rgba(0,0,0,.5); cursor:pointer; }
      `}</style>
    </div>
  );
}

/* ── custom tooltip ──────────────────────────────────── */
function ChartTip({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg p-3 text-[11px]" style={{ background: "#1e293b", border: `1px solid ${C.accent}33`, fontFamily: MONO }}>
      <p className="font-bold mb-1" style={{ color: C.text }}>{d.label}</p>
      <p style={{ color: C.core }}>만기매칭: {d.coreAmt} · BCP: {d.bcpAmt}</p>
      <p style={{ color: C.accent }}>누적 이자: +{d.income}</p>
      <p style={{ color: C.equity }}>주식: {d.equity} <span className="text-[9px]" style={{ color: C.dim }}>(T1:{d.eq1} T2:{d.eq2})</span></p>
      <p className="mt-1 pt-1 font-bold" style={{ color: C.text, borderTop: `1px solid ${C.border}` }}>총 가치: {d.total}</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════ */
export default function FundIdeasPage() {
  const [years, setYears] = useState(3);
  const [bcpRatio, setBcpRatio] = useState(10);
  const [coreYield, setCoreYield] = useState(3.5);
  const [bcpYield, setBcpYield] = useState(5.5);
  const [eqRet, setEqRet] = useState(12);
  const [tab, setTab] = useState("allocator");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const { data, eqPre, coreAmt, bcpAmt } = useMemo(
    () => buildData(years, bcpRatio, coreYield, bcpYield, eqRet),
    [years, bcpRatio, coreYield, bcpYield, eqRet]
  );
  const last = data[data.length - 1];

  const scenarios = useMemo(() => {
    const bi = coreAmt * coreYield / 100 * years;
    return [
      { name: "최악", desc: `주식-100% BCP-3%`, result: +(coreAmt + bcpAmt * 0.97 + bi - eqPre).toFixed(1), color: C.danger },
      { name: "하락", desc: "주식-30%", result: +(coreAmt + bcpAmt + bi - eqPre * 0.3).toFixed(1), color: "#f97316" },
      { name: "보합", desc: "주식 0%", result: +(coreAmt + bcpAmt + bi + eqPre).toFixed(1), color: C.dim },
      { name: "상승", desc: "주식+30%", result: +(coreAmt + bcpAmt + bi + eqPre * 1.3).toFixed(1), color: C.equity },
      { name: "강세", desc: "주식+60%", result: +(coreAmt + bcpAmt + bi + eqPre * 1.6 + bcpAmt * bcpYield / 100 * years).toFixed(1), color: "#22d3ee" },
    ];
  }, [coreAmt, bcpAmt, eqPre, coreYield, bcpYield, years]);

  const fade = (d = 0) => ({ opacity: ready ? 1 : 0, transform: ready ? "translateY(0)" : "translateY(16px)", transition: `all .7s cubic-bezier(.16,1,.3,1) ${d}s` });

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
          확정이자의 현재가치만큼 Day 0부터 주식에 투자 · 만기매칭 코어 + BCP 새틀라이트 코어-새틀라이트 전략
        </p>
      </header>

      {/* ─ params ─ */}
      <div style={fade(0.15)} className="rounded-xl p-5 mb-5" css={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <span className="text-[10px] tracking-[2px] uppercase" style={{ color: C.muted }}>파라미터</span>
          <div className="flex items-center gap-2">
            <label className="text-[11px]" style={{ color: C.dim }}>투자기간</label>
            <select value={years} onChange={(e) => setYears(Number(e.target.value))}
              className="rounded-md px-2 py-1 text-xs" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: MONO }}>
              {[1,1.5,2,2.5,3,4,5].map(v => <option key={v} value={v}>{v}년</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px]" style={{ color: C.dim }}>BCP 비중</label>
            <select value={bcpRatio} onChange={(e) => setBcpRatio(Number(e.target.value))}
              className="rounded-md px-2 py-1 text-xs" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: MONO }}>
              {[0,5,10,15,20,25,30].map(v => <option key={v} value={v}>{v}%</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-6 flex-wrap">
          <Slider label="만기매칭 금리" value={coreYield} min={1.0} max={5.0} step={0.1} onChange={setCoreYield} color={C.core} unit="%" />
          <Slider label="BCP 기대수익률" value={bcpYield} min={2.0} max={8.0} step={0.1} onChange={setBcpYield} color={C.accent} unit="%" />
          <Slider label="주식 기대수익률" value={eqRet} min={-30} max={40} step={0.1} onChange={setEqRet} color={C.equity} unit="%" prefix />
        </div>
      </div>

      {/* ─ tabs ─ */}
      <div className="flex gap-1 mb-5">
        {[
          { k: "allocator", l: "PV 자산배분" },
          { k: "structure", l: "포트폴리오 변화" },
          { k: "scenario", l: "시나리오" },
          { k: "compare", l: "전략 비교" },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className="flex-1 py-2.5 rounded-lg text-[11px] transition-all"
            style={{ fontFamily: MONO, background: tab === t.k ? `${C.accent}20` : C.card, border: `1px solid ${tab === t.k ? C.accent+"60" : C.border}`, color: tab === t.k ? C.accent : C.dim, fontWeight: tab === t.k ? 700 : 400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ════ TAB: PV allocator ════ */}
      {tab === "allocator" && (
        <section className="rounded-xl p-5 mb-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>

          {/* PV formula explanation */}
          <p className="text-[10px] tracking-[2px] uppercase mb-2" style={{ color: C.muted }}>핵심 로직 — 확정이자의 현재가치</p>
          <div className="rounded-lg p-4 mb-5" style={{ background: C.bg }}>
            <p className="text-[12px] leading-relaxed mb-3" style={{ color: C.dim }}>
              만기매칭 채권의 이자는 <span style={{ color: C.core }} className="font-bold">확정</span>이다.
              {years}년간 받을 확정이자를 현재가치로 할인하면, 그만큼을 <span style={{ color: C.equity }} className="font-bold">Day 0부터 주식에 투자</span>할 수 있다.
              주식이 전멸해도 만기에 들어오는 이자가 손실을 정확히 메운다.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <div className="rounded-md px-4 py-3 text-center" style={{ background: `${C.core}15`, border: `1px solid ${C.core}30` }}>
                <p className="text-[9px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>만기매칭 {coreYield}% × {years}년</p>
                <p className="text-[9px]" style={{ color: C.core }}>확정이자 합계</p>
                <p className="text-[20px] font-bold" style={{ color: C.core }}>{(coreAmt * coreYield / 100 * years).toFixed(2)}%</p>
              </div>
              <div className="text-xl" style={{ color: C.accent }}>→</div>
              <div className="rounded-md px-4 py-3 text-center" style={{ background: `${C.accent}15`, border: `1px solid ${C.accent}30` }}>
                <p className="text-[9px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>현재가치 할인</p>
                <p className="text-[9px]" style={{ color: C.accent }}>PV @ {coreYield}%</p>
                <p className="text-[20px] font-bold" style={{ color: C.accent }}>{eqPre}%</p>
              </div>
              <div className="text-xl" style={{ color: C.equity }}>→</div>
              <div className="rounded-md px-4 py-3 text-center" style={{ background: `${C.equity}15`, border: `1px solid ${C.equity}30` }}>
                <p className="text-[9px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Day 0 주식 비중</p>
                <p className="text-[9px]" style={{ color: C.equity }}>Track 1 선취</p>
                <p className="text-[20px] font-bold" style={{ color: C.equity }}>{eqPre}%</p>
              </div>
            </div>
          </div>

          {/* Day 0 allocation visual */}
          <p className="text-[10px] tracking-[2px] uppercase mb-3" style={{ color: C.muted }}>Day 0 포트폴리오</p>
          <div className="rounded-lg overflow-hidden mb-2" style={{ height: 40 }}>
            <div className="flex h-full">
              <div style={{ width: `${coreAmt}%`, background: `${C.core}cc` }} className="flex items-center justify-center">
                {coreAmt >= 12 && <span className="text-[10px] font-bold text-white/90">만기매칭 {coreAmt}%</span>}
              </div>
              <div style={{ width: `${bcpAmt}%`, background: `${C.accent}cc` }} className="flex items-center justify-center">
                {bcpAmt >= 8 && <span className="text-[10px] font-bold text-white/90">BCP {bcpAmt}%</span>}
              </div>
              <div style={{ width: `${eqPre}%`, background: `${C.equity}cc` }} className="flex items-center justify-center">
                {eqPre >= 5 && <span className="text-[10px] font-bold text-white/90">주식 {eqPre}%</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-center mb-5">
            {[
              [C.core, `만기매칭 ${coreAmt}%`, "원금+이자 확정"],
              [C.accent, `BCP ${bcpAmt}%`, "크레딧 α 추구"],
              [C.equity, `주식 ${eqPre}%`, "이자 PV로 펀딩"],
            ].map(([c, l, s]) => (
              <div key={l} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c }} />
                <span className="text-[10px]" style={{ color: C.dim }}>{l}</span>
                <span className="text-[9px]" style={{ color: C.muted }}>({s})</span>
              </div>
            ))}
          </div>

          {/* Two tracks */}
          <p className="text-[10px] tracking-[2px] uppercase mb-3" style={{ color: C.muted }}>투 트랙 시스템</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-lg p-4" style={{ background: `${C.equity}10`, border: `1px solid ${C.equity}30` }}>
              <p className="text-[11px] font-bold mb-1" style={{ color: C.equity }}>Track 1 · 선취 (Day 0)</p>
              <p className="text-[22px] font-bold mb-1" style={{ color: C.equity }}>{eqPre}%</p>
              <p className="text-[10px] leading-relaxed" style={{ color: C.dim }}>
                확정이자 PV = 초기 주식 비중<br/>
                만기에 이자가 들어와 자동 상환<br/>
                <span style={{ color: C.equity }}>주식 전멸해도 원금 복원</span>
              </p>
            </div>
            <div className="rounded-lg p-4" style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}30` }}>
              <p className="text-[11px] font-bold mb-1" style={{ color: C.accent }}>Track 2 · 후취 (BCP 실현)</p>
              <p className="text-[22px] font-bold mb-1" style={{ color: C.accent }}>+α</p>
              <p className="text-[10px] leading-relaxed" style={{ color: C.dim }}>
                BCP 수익이 실현될 때마다 추가 주식 투자<br/>
                BCP {bcpYield}% 기대 → {years}년간 +{(bcpAmt * bcpYield / 100 * years).toFixed(1)}% 추가 여력<br/>
                <span style={{ color: C.accent }}>시간이 갈수록 주식 비중 자연 확대</span>
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { l: "초기 주식", v: eqPre, c: C.equity },
              { l: "기대 총 가치", v: last?.total, c: C.text },
              { l: `${years}년 뒤 주식`, v: last?.equity, c: C.equity },
              { l: "최악 시 가치", v: scenarios[0].result, c: C.danger },
            ].map(s => (
              <div key={s.l} className="rounded-lg p-3 text-center" style={{ background: C.bg }}>
                <p className="text-[9px] uppercase tracking-[1px] mb-1" style={{ color: C.muted }}>{s.l}</p>
                <p className="text-[18px] font-bold" style={{ color: s.c }}>{s.v}<span className="text-[10px]" style={{ color: C.dim }}>%</span></p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ════ TAB: structure (stacked bars) ════ */}
      {tab === "structure" && (
        <section className="rounded-xl p-5 mb-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <p className="text-[10px] tracking-[2px] uppercase" style={{ color: C.muted }}>포트폴리오 가치 변화 — {years}년</p>
          <p className="text-[12px] mb-4" style={{ color: C.dim }}>
            반기별 스냅샷 · 채권 원금 위에 이자와 주식 수익이 쌓인다
          </p>

          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 20, left: -5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: C.dim, fontSize: 10, fontFamily: MONO }} stroke={C.grid} />
              <YAxis tick={{ fill: C.dim, fontSize: 10, fontFamily: MONO }} stroke={C.grid}
                domain={[0, (dm) => Math.ceil(dm / 10) * 10]}
                label={{ value: "포트폴리오 가치 (%)", angle: -90, position: "insideLeft", fill: C.muted, fontSize: 9, fontFamily: MONO, dx: 10 }} />
              <Tooltip content={<ChartTip />} />
              <ReferenceLine y={100} stroke={C.danger} strokeDasharray="4 4" strokeWidth={1.5} />

              <Bar dataKey="bonds" stackId="a" fill={C.core} fillOpacity={0.7} radius={[0,0,0,0]} name="채권 원금" />
              <Bar dataKey="income" stackId="a" fill={C.accent} fillOpacity={0.8} name="누적 이자" />
              <Bar dataKey="equity" stackId="a" fill={C.equity} fillOpacity={0.8} radius={[4,4,0,0]} name="주식 가치" />
              <Line type="monotone" dataKey="total" stroke={C.text} strokeWidth={2} dot={{ r: 3, fill: C.text }} name="총 가치" />
            </ComposedChart>
          </ResponsiveContainer>

          <div className="flex gap-4 justify-center mt-2 flex-wrap">
            {[
              [C.core, "채권 원금 (만기매칭+BCP)"],
              [C.accent, "누적 이자"],
              [C.equity, "주식 가치 (T1+T2)"],
              [C.text, "── 총 가치"],
              [C.danger, "--- 원금 100"],
            ].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c }} />
                <span className="text-[10px]" style={{ color: C.dim }}>{l}</span>
              </div>
            ))}
          </div>

          {/* Year-end summary table */}
          <div className="mt-5 rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
            <div className="grid grid-cols-6 gap-0 text-[9px] uppercase tracking-wide text-center" style={{ background: `${C.border}`, color: C.muted }}>
              {["시점","채권","이자","주식","총 가치","vs 원금"].map(h => <div key={h} className="py-2">{h}</div>)}
            </div>
            {data.filter((_, i) => i % (years <= 2 ? 1 : 2) === 0 || i === data.length - 1).map((d, idx) => (
              <div key={idx} className="grid grid-cols-6 gap-0 text-[10px] text-center" style={{ background: idx % 2 === 0 ? C.bg : C.card, borderTop: `1px solid ${C.border}` }}>
                <div className="py-2 font-bold" style={{ color: C.text }}>{d.label}</div>
                <div className="py-2" style={{ color: C.core }}>{d.bonds}</div>
                <div className="py-2" style={{ color: C.accent }}>+{d.income}</div>
                <div className="py-2" style={{ color: C.equity }}>{d.equity}</div>
                <div className="py-2 font-bold" style={{ color: C.text }}>{d.total}</div>
                <div className="py-2 font-bold" style={{ color: d.total >= 100 ? C.equity : C.danger }}>
                  {d.total >= 100 ? "+" : ""}{(d.total - 100).toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ════ TAB: scenario ════ */}
      {tab === "scenario" && (
        <section className="rounded-xl p-5 mb-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <p className="text-[10px] tracking-[2px] uppercase" style={{ color: C.muted }}>시나리오별 최종 가치 — 만기매칭 {coreAmt}% · BCP {bcpAmt}% · 주식(초기) {eqPre}%</p>
          <p className="text-[12px] mb-5" style={{ color: C.dim }}>확정이자 PV 구조 덕분에 극단적 시나리오에서도 원금 근사 보전</p>

          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={scenarios} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: C.dim, fontSize: 11, fontFamily: MONO }} stroke={C.grid} />
              <YAxis tick={{ fill: C.dim, fontSize: 10, fontFamily: MONO }} stroke={C.grid} domain={[Math.min(95, scenarios[0].result - 2), "auto"]} />
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
            {scenarios.map(s => (
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
              {["📈 주식으로 시작","🎯 목표수익 달성 시","🛡️ 패시브 채권으로 전환"].map(t => (<p key={t} className="text-[11px] mb-2" style={{ color: C.dim }}>{t}</p>))}
              <div className="rounded-md p-2 mt-3 text-[10px] leading-relaxed" style={{ background: `${C.danger}15`, color: C.danger }}>⚠️ 원금 손실 가능<br/>⚠️ 전환 타이밍 시장 종속<br/>⚠️ 채권 파트 패시브</div>
            </div>
            <div className="rounded-lg p-4" style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}40` }}>
              <p className="text-[11px] font-bold mb-3" style={{ color: C.accent }}>역목표전환형 (PV 기반) ✦</p>
              {["🔒 확정이자 PV → Day 0 주식","⚡ BCP 실현수익 → 주식 추가","📐 만기 시 이자가 주식 손실 상환"].map(t => (<p key={t} className="text-[11px] mb-2" style={{ color: C.text }}>{t}</p>))}
              <div className="rounded-md p-2 mt-3 text-[10px] leading-relaxed" style={{ background: `${C.equity}15`, color: C.equity }}>✓ 수학적 원금 보전 구조<br/>✓ 채권·주식 모두 액티브<br/>✓ Day 0부터 주식 참여</div>
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
        <p className="text-[9px] tracking-[1px]" style={{ color: C.muted }}>WOLFPACK CONTROL TOWER · 역목표전환형 · v0.5</p>
        <p className="text-[9px] mt-1" style={{ color: C.muted }}>PV-Based Core-Satellite Reverse Target Conversion Fund</p>
      </footer>
    </div>
  );
}
