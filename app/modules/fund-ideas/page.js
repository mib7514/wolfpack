"use client";

import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from "recharts";

/* ── colours & tokens ────────────────────────────────── */
const C = {
  bg: "#0a0e17", card: "#111827", border: "#1e293b",
  accent: "#f59e0b", bond: "#3b82f6", equity: "#10b981",
  danger: "#ef4444", text: "#f1f5f9", dim: "#64748b",
  muted: "#475569", grid: "#1e293b",
};
const MONO = "'JetBrains Mono','SF Mono','Fira Code',monospace";
const DISPLAY = "'Playfair Display',Georgia,serif";

/* ── helpers ──────────────────────────────────────────── */
function buildTimeSeries(years, coupon, eqRet) {
  const data = [];
  const months = years * 12;
  let buf = 0, pnl = 0;
  for (let m = 0; m <= months; m++) {
    if (m > 0) {
      buf += coupon / 12;
      pnl += buf * (eqRet / 12 / 100);
    }
    data.push({
      month: m,
      principal: 100,
      accruedInterest: +buf.toFixed(2),
      equityPnL: +pnl.toFixed(2),
      totalValue: +(100 + buf + pnl).toFixed(2),
    });
  }
  return data;
}

function buildScenarios(years, coupon) {
  const tot = coupon * years;
  return [
    { name: "최악", desc: "주식 -100%", ret: -100, result: 100, color: C.danger },
    { name: "하락", desc: "주식 -30%",  ret: -30,  result: +(100 + tot * 0.7).toFixed(1), color: "#f97316" },
    { name: "보합", desc: "주식 0%",    ret: 0,    result: +(100 + tot).toFixed(1), color: C.dim },
    { name: "상승", desc: "주식 +30%",  ret: 30,   result: +(100 + tot * 1.3).toFixed(1), color: C.equity },
    { name: "강세", desc: "주식 +60%",  ret: 60,   result: +(100 + tot * 1.6).toFixed(1), color: "#22d3ee" },
  ];
}

/* ── tiny select ─────────────────────────────────────── */
function Sel({ label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px]" style={{ color: C.dim }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-md px-2 py-1 text-xs"
        style={{
          background: C.bg, border: `1px solid ${C.border}`,
          color: C.text, fontFamily: MONO,
        }}
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
    </div>
  );
}

/* ── tooltip ─────────────────────────────────────────── */
function Tip({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-lg p-3 text-[11px]"
      style={{ background: "#1e293b", border: `1px solid ${C.accent}33`, fontFamily: MONO }}
    >
      <p style={{ color: C.dim }}>{d.month}개월차</p>
      <p style={{ color: C.bond }}>채권 원금: {d.principal}</p>
      <p style={{ color: C.accent }}>경과이자: {d.accruedInterest}%</p>
      <p style={{ color: d.equityPnL >= 0 ? C.equity : C.danger }}>
        주식 손익: {d.equityPnL > 0 ? "+" : ""}{d.equityPnL}%
      </p>
      <p className="mt-1 pt-1 font-bold" style={{ color: C.text, borderTop: `1px solid ${C.border}` }}>
        총 가치: {d.totalValue}%
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════ */
export default function FundIdeasPage() {
  const [years, setYears] = useState(3);
  const [coupon, setCoupon] = useState(4.0);
  const [eqRet, setEqRet] = useState(12);
  const [tab, setTab] = useState("structure");
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  const ts = useMemo(() => buildTimeSeries(years, coupon, eqRet), [years, coupon, eqRet]);
  const scenarios = useMemo(() => buildScenarios(years, coupon), [years, coupon]);
  const last = ts[ts.length - 1];

  const fade = (delay = 0) => ({
    opacity: ready ? 1 : 0,
    transform: ready ? "translateY(0)" : "translateY(16px)",
    transition: `all .7s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  /* ── render ─────────────────────────────────────────── */
  return (
    <div className="min-h-screen p-5 overflow-auto" style={{ background: C.bg, color: C.text, fontFamily: MONO }}>

      {/* ─ header ─ */}
      <header style={fade(0)} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: C.accent, boxShadow: `0 0 10px ${C.accent}66` }}
          />
          <span className="text-[11px] tracking-[3px] uppercase" style={{ color: C.accent }}>
            늑대무리원정단 · 펀드아이디어
          </span>
        </div>
        <h1
          className="text-[28px] font-bold leading-tight"
          style={{
            fontFamily: DISPLAY,
            background: `linear-gradient(135deg,${C.text},${C.accent})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}
        >
          역목표전환형 펀드
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed max-w-xl" style={{ color: C.dim }}>
          채권 원금은 보존하고, 경과이자 범위 내에서만 주식에 투자하는 원금보존형 자산배분 전략
          — <span style={{ color: C.accent }}>Interest-Only Equity Participation</span>
        </p>
      </header>

      {/* ─ core structure ─ */}
      <section
        style={fade(0.15)}
        className="rounded-xl p-5 mb-5"
        css={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        <p className="text-[10px] tracking-[2px] uppercase mb-4" style={{ color: C.muted }}>핵심 구조</p>

        <div className="flex items-center justify-center gap-2 flex-wrap mb-5">
          {[
            { emoji: "🛡️", title: "채권 원금", sub: "100% 보존", val: "100", color: C.bond },
            null,
            { emoji: "⚡", title: "이자 버퍼", sub: "매일 경과이자 누적", val: `${coupon}%/yr`, color: C.accent },
            null,
            { emoji: "📈", title: "주식 업사이드", sub: "최대 손실 = 이자수익", val: "α", color: C.equity },
          ].map((b, i) =>
            b ? (
              <div
                key={i}
                className="flex-1 min-w-[130px] max-w-[170px] rounded-lg p-4 text-center"
                style={{ background: `${b.color}12`, border: `1px solid ${b.color}40` }}
              >
                <div className="text-2xl mb-1">{b.emoji}</div>
                <div className="text-[13px] font-bold" style={{ color: b.color }}>{b.title}</div>
                <div className="text-[10px] mt-1" style={{ color: C.dim }}>{b.sub}</div>
                <div className="text-xl font-bold mt-2" style={{ color: b.color }}>{b.val}</div>
              </div>
            ) : (
              <div key={i} className="flex flex-col items-center px-1">
                <span className="text-[9px] text-center leading-tight mb-1" style={{ color: i === 1 ? C.accent : C.equity }}>
                  {i === 1 ? <>경과이자<br />실시간 연동</> : <>버퍼 한도 내<br />주식 투자</>}
                </span>
                <span className="text-lg" style={{ color: i === 1 ? C.accent : C.equity }}>→</span>
              </div>
            )
          )}
        </div>

        <div
          className="rounded-lg p-3 text-center text-[12px] font-semibold"
          style={{ background: `${C.accent}08`, border: `1px solid ${C.accent}20`, color: C.accent }}
        >
          "최악의 시나리오에서도 원금 100은 절대 안 까인다"
        </div>
      </section>

      {/* ─ controls ─ */}
      <div
        style={fade(0.25)}
        className="rounded-xl p-4 mb-5 flex flex-wrap items-center gap-5"
        css={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        <span className="text-[10px] tracking-[2px] uppercase" style={{ color: C.muted }}>시뮬레이션</span>
        <Sel label="투자기간" value={years} onChange={setYears}
          options={[1,2,3,5,7,10].map(v=>({v,l:`${v}년`}))} />
        <Sel label="쿠폰" value={coupon} onChange={setCoupon}
          options={[2.5,3,3.5,4,4.5,5,5.5].map(v=>({v,l:`${v}%`}))} />
        <Sel label="주식 기대수익" value={eqRet} onChange={setEqRet}
          options={[-20,-10,0,5,8,12,15,20,30].map(v=>({v,l:`${v>0?"+":""}${v}%`}))} />
      </div>

      {/* ─ tabs ─ */}
      <div className="flex gap-1 mb-5">
        {[
          { k: "structure", l: "자산 구조 변화" },
          { k: "scenario",  l: "시나리오 분석" },
          { k: "compare",   l: "전략 비교" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className="flex-1 py-2.5 rounded-lg text-[11px] transition-all"
            style={{
              fontFamily: MONO,
              background: tab === t.k ? `${C.accent}20` : C.card,
              border: `1px solid ${tab === t.k ? C.accent + "60" : C.border}`,
              color: tab === t.k ? C.accent : C.dim,
              fontWeight: tab === t.k ? 700 : 400,
            }}
          >
            {t.l}
          </button>
        ))}
      </div>

      {/* ════ TAB: structure ════ */}
      {tab === "structure" && (
        <section className="rounded-xl p-5 mb-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <p className="text-[10px] tracking-[2px] uppercase" style={{ color: C.muted }}>시간에 따른 자산 구조 변화</p>
          <p className="text-[12px] mb-4" style={{ color: C.dim }}>경과이자가 쌓일수록 주식 익스포저가 자연스럽게 확대</p>

          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={ts} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
              <XAxis dataKey="month" tickFormatter={v => v % 12 === 0 ? `${v/12}Y` : ""} tick={{ fill: C.dim, fontSize: 10, fontFamily: MONO }} stroke={C.grid} interval={0} />
              <YAxis tick={{ fill: C.dim, fontSize: 10, fontFamily: MONO }} stroke={C.grid} domain={[96,"auto"]} />
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="principal" stackId="1" fill={`${C.bond}30`} stroke={C.bond} strokeWidth={1} />
              <Area type="monotone" dataKey="accruedInterest" stackId="1" fill={`${C.accent}40`} stroke={C.accent} strokeWidth={1} />
              <Area type="monotone" dataKey="equityPnL" stackId="1" fill={eqRet >= 0 ? `${C.equity}40` : `${C.danger}40`} stroke={eqRet >= 0 ? C.equity : C.danger} strokeWidth={1} />
            </AreaChart>
          </ResponsiveContainer>

          {/* legend */}
          <div className="flex gap-4 justify-center mt-3 flex-wrap">
            {[
              [C.bond, "채권 원금"],
              [C.accent, "경과이자 (주식 한도)"],
              [eqRet >= 0 ? C.equity : C.danger, "주식 손익"],
            ].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c }} />
                <span className="text-[10px]" style={{ color: C.dim }}>{l}</span>
              </div>
            ))}
          </div>

          {/* stats */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { l: "최종 펀드 가치", v: last?.totalValue, u: "%", c: C.text },
              { l: "누적 이자 버퍼", v: last?.accruedInterest, u: "%", c: C.accent },
              { l: "주식 알파", v: `${last?.equityPnL > 0 ? "+" : ""}${last?.equityPnL}`, u: "%", c: last?.equityPnL >= 0 ? C.equity : C.danger },
            ].map((s) => (
              <div key={s.l} className="rounded-lg p-3 text-center" style={{ background: C.bg }}>
                <p className="text-[9px] tracking-[1px] uppercase mb-1" style={{ color: C.muted }}>{s.l}</p>
                <p className="text-[22px] font-bold" style={{ color: s.c }}>
                  {s.v}<span className="text-[11px]" style={{ color: C.dim }}>{s.u}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ════ TAB: scenario ════ */}
      {tab === "scenario" && (
        <section className="rounded-xl p-5 mb-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <p className="text-[10px] tracking-[2px] uppercase" style={{ color: C.muted }}>
            시나리오별 최종 가치 — {years}년 · 쿠폰 {coupon}%
          </p>
          <p className="text-[12px] mb-5" style={{ color: C.dim }}>주식이 전멸해도 원금 100은 지켜짐</p>

          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={scenarios} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: C.dim, fontSize: 11, fontFamily: MONO }} stroke={C.grid} />
              <YAxis tick={{ fill: C.dim, fontSize: 10, fontFamily: MONO }} stroke={C.grid} domain={[95,"auto"]} />
              <ReferenceLine y={100} stroke={C.danger} strokeDasharray="4 4" label={{ value: "원금 100", fill: C.danger, fontSize: 9, fontFamily: MONO, position: "left" }} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-lg p-3 text-[11px]" style={{ background: "#1e293b", border: `1px solid ${C.accent}33`, fontFamily: MONO }}>
                    <p className="font-bold" style={{ color: d.color }}>{d.name} — {d.desc}</p>
                    <p style={{ color: C.text }}>최종 가치: {d.result}%</p>
                  </div>
                );
              }} />
              <Bar dataKey="result" radius={[4,4,0,0]}>
                {scenarios.map((e, i) => <Cell key={i} fill={e.color + "cc"} />)}
              </Bar>
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
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: `${C.equity}20`, color: C.equity }}>원금 보존 ✓</span>
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
            {/* old */}
            <div className="rounded-lg p-4" style={{ background: `${C.muted}10`, border: `1px solid ${C.muted}30` }}>
              <p className="text-[11px] font-bold mb-3" style={{ color: C.muted }}>기존 목표전환형</p>
              {["📈 주식으로 시작", "🎯 목표수익 달성 시", "🛡️ 채권으로 전환"].map((t) => (
                <p key={t} className="text-[11px] mb-2" style={{ color: C.dim }}>{t}</p>
              ))}
              <div className="rounded-md p-2 mt-3 text-[10px] leading-relaxed" style={{ background: `${C.danger}15`, color: C.danger }}>
                ⚠️ 목표 미달성 시 원금 손실 가능<br/>⚠️ 전환 타이밍이 시장에 종속
              </div>
            </div>

            {/* new */}
            <div className="rounded-lg p-4" style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}40` }}>
              <p className="text-[11px] font-bold mb-3" style={{ color: C.accent }}>역목표전환형 ✦</p>
              {["🛡️ 채권으로 시작 (원금 잠금)", "⚡ 경과이자 → 주식 투자", "📈 시간 = 버퍼 확대"].map((t) => (
                <p key={t} className="text-[11px] mb-2" style={{ color: C.text }}>{t}</p>
              ))}
              <div className="rounded-md p-2 mt-3 text-[10px] leading-relaxed" style={{ background: `${C.equity}15`, color: C.equity }}>
                ✓ 원금 100% 보존 구조적 보장<br/>✓ 시간이 무기: 장기 보유할수록 유리
              </div>
            </div>
          </div>

          {/* targets */}
          <div className="rounded-lg p-4 mt-5" style={{ background: C.bg }}>
            <p className="text-[10px] tracking-[2px] uppercase mb-3" style={{ color: C.muted }}>타겟 고객</p>
            {[
              ["🏦", "예금금리(2%)에 만족 못하지만 원금손실은 절대 불가인 보수적 투자자"],
              ["🏢", "보험사 일반계정 — K-ICS 친화적 구조 + 주식 업사이드 참여"],
              ["👴", "퇴직연금/은퇴자금 — 원금보존 + 인플레이션 방어가 동시에 필요한 수요"],
              ["💼", "법인 여유자금 — 원금 훼손 불가 + 예금 이상의 수익률 추구"],
            ].map(([e, t]) => (
              <div key={t} className="flex items-start gap-2.5 mb-2">
                <span className="text-base">{e}</span>
                <span className="text-[11px] leading-relaxed" style={{ color: C.dim }}>{t}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─ footer ─ */}
      <footer className="text-center pt-4 mt-2" style={{ borderTop: `1px solid ${C.border}` }}>
        <p className="text-[9px] tracking-[1px]" style={{ color: C.muted }}>
          WOLFPACK CONTROL TOWER · FUND IDEAS LAYER · v0.1
        </p>
        <p className="text-[9px] mt-1" style={{ color: C.muted }}>
          Interest-Only Equity Participation — Reverse Target Conversion Fund
        </p>
      </footer>
    </div>
  );
}
