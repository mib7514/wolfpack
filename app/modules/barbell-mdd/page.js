'use client';

import { useState, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell, Legend, Line, ComposedChart, Area } from "recharts";

const C = {
  bg: "#0a0e17", sf: "#111827", bd: "#1e293b", bdL: "#334155",
  ac: "#3b82f6", acG: "rgba(59,130,246,0.15)",
  dn: "#ef4444", dnG: "rgba(239,68,68,0.12)",
  ok: "#10b981", okG: "rgba(16,185,129,0.12)",
  wn: "#f59e0b", wnG: "rgba(245,158,11,0.12)",
  lb: "#a78bfa", lbG: "rgba(167,139,250,0.12)",
  tx: "#f1f5f9", txM: "#94a3b8", txD: "#64748b",
};
const mono = "'JetBrains Mono', monospace";

function Sl({ label, value, onChange, min, max, step, unit, desc, color }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: C.txM }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: color || C.tx, fontFamily: mono }}>
          {step < 1 ? value.toFixed(step < 0.01 ? 3 : 2) : value.toFixed(step < 1 ? 1 : 0)}{unit}
        </span>
      </div>
      {desc && <div style={{ fontSize: 10, color: C.txD, marginBottom: 5 }}>{desc}</div>}
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", height: 5, appearance: "none",
          background: `linear-gradient(to right, ${color || C.ac} ${pct}%, ${C.bd} ${pct}%)`,
          borderRadius: 3, cursor: "pointer", outline: "none" }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
        <span style={{ fontSize: 9, color: C.txD }}>{min}{unit}</span>
        <span style={{ fontSize: 9, color: C.txD }}>{max}{unit}</span>
      </div>
    </div>
  );
}

function NI({ label, value, onChange, min, max, step, unit }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginRight: 14, marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: C.txM }}>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v))); }}
        style={{ width: 65, padding: "3px 6px", fontSize: 12, fontFamily: mono, fontWeight: 600,
          background: C.bg, border: `1px solid ${C.bd}`, borderRadius: 5, color: C.tx, textAlign: "right", outline: "none" }} />
      <span style={{ fontSize: 10, color: C.txD }}>{unit}</span>
    </div>
  );
}

function ST({ children, icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: C.tx, letterSpacing: "0.04em", textTransform: "uppercase" }}>{children}</span>
    </div>
  );
}

function Card({ children, style }) {
  return <div style={{ background: C.sf, border: `1px solid ${C.bd}`, borderRadius: 12, padding: 18, ...style }}>{children}</div>;
}

function SB({ label, value, unit, color, sub, glow }) {
  return (
    <div style={{ background: glow || C.bg, border: `1px solid ${color}33`, borderRadius: 10, padding: "12px 14px", flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 10, color: C.txD, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: mono }}>
        {value}<span style={{ fontSize: 12, fontWeight: 500 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 10, color: C.txM, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Heatmap({ rateRange, spreadRange, calc, curRate, curSpread }) {
  const rs = [], ss = [];
  for (let r = rateRange[0]; r <= rateRange[1]; r += rateRange[2]) rs.push(Math.round(r * 100) / 100);
  for (let s = spreadRange[0]; s <= spreadRange[1]; s += spreadRange[2]) ss.push(Math.round(s * 100) / 100);
  const gc = v => {
    if (v >= 0.5) return `rgba(16,185,129,${Math.min(0.9, 0.3 + v / 3)})`;
    if (v >= 0.1) return `rgba(16,185,129,${0.15 + v / 3})`;
    if (v >= 0) return "rgba(16,185,129,0.08)";
    if (v >= -0.1) return "rgba(245,158,11,0.2)";
    if (v >= -0.3) return `rgba(239,68,68,${0.15 + Math.abs(v) / 2})`;
    return `rgba(239,68,68,${Math.min(0.85, 0.3 + Math.abs(v) / 3)})`;
  };
  const tc = v => v >= 0 ? "#10b981" : v >= -0.1 ? "#f59e0b" : "#ef4444";
  const mr = rs.length > 25 ? rs.filter((_, i) => i % Math.ceil(rs.length / 25) === 0) : rs;
  const ms = ss.length > 25 ? ss.filter((_, i) => i % Math.ceil(ss.length / 25) === 0) : ss;

  // 현재 시나리오에 가장 가까운 셀 찾기
  const nearR = mr.reduce((a, b) => Math.abs(b - curRate) < Math.abs(a - curRate) ? b : a, mr[0]);
  const nearS = ms.reduce((a, b) => Math.abs(b - curSpread) < Math.abs(a - curSpread) ? b : a, ms[0]);

  return (
    <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 480 }}>
      <table style={{ borderCollapse: "collapse", fontSize: 10, fontFamily: mono, width: "100%" }}>
        <thead><tr>
          <th style={{ position: "sticky", top: 0, left: 0, zIndex: 3, background: C.sf, padding: "5px 3px",
            borderBottom: `2px solid ${C.bdL}`, borderRight: `2px solid ${C.bdL}`, fontSize: 8, color: C.txD, minWidth: 65, textAlign: "center" }}>
            금리↓\스프레드→</th>
          {ms.map(s => {
            const isCol = s === nearS;
            return <th key={s} style={{ position: "sticky", top: 0, zIndex: 2, padding: "5px 2px",
              background: isCol ? "rgba(255,255,255,0.08)" : C.sf,
              borderBottom: `2px solid ${isCol ? "#fff" : C.bdL}`,
              color: isCol ? "#fff" : C.txM, textAlign: "center", minWidth: 40, fontSize: 8,
              fontWeight: isCol ? 800 : 400 }}>+{s}</th>;
          })}
        </tr></thead>
        <tbody>{mr.map(r => {
          const isRow = r === nearR;
          return <tr key={r}>
            <td style={{ position: "sticky", left: 0, zIndex: 1, padding: "4px 5px",
              background: isRow ? "rgba(255,255,255,0.08)" : C.sf,
              borderRight: `2px solid ${isRow ? "#fff" : C.bdL}`,
              color: isRow ? "#fff" : C.txM, textAlign: "center", fontWeight: isRow ? 800 : 600, fontSize: 8 }}>+{r}bp</td>
            {ms.map(s => {
              const v = calc(r, s);
              const isCur = r === nearR && s === nearS;
              const isAxis = r === nearR || s === nearS;
              return (
                <td key={s} style={{
                  background: isCur ? "rgba(255,255,255,0.25)" : isAxis ? `${gc(v)}` : gc(v),
                  padding: "4px 1px", textAlign: "center",
                  color: isCur ? "#fff" : tc(v),
                  fontWeight: isCur ? 900 : isAxis ? 700 : 600,
                  fontSize: isCur ? 10 : 8,
                  border: isCur ? "2px solid #fff" : isAxis ? `1px solid rgba(255,255,255,0.15)` : `1px solid ${C.bg}`,
                  borderRadius: isCur ? 4 : 2, cursor: "default",
                  boxShadow: isCur ? "0 0 12px rgba(255,255,255,0.3)" : "none",
                  transition: "all 0.15s ease",
                }}
                title={`금리+${r}bp 스프레드+${s}bp → ${v >= 0 ? "+" : ""}${v.toFixed(3)}%`}>
                  {v >= 0 ? "+" : ""}{v.toFixed(2)}</td>
              );
            })}
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}

function WeightBar({ items }) {
  return (
    <div style={{ display: "flex", gap: 4, height: 36 }}>
      {items.map(({ w, color, label }) => w > 0 && (
        <div key={label} style={{ flex: Math.max(w, 2), background: `linear-gradient(90deg, ${color}44, ${color}22)`,
          borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 600, border: `1px solid ${color}44`, color,
          transition: "flex 0.3s", overflow: "hidden", whiteSpace: "nowrap" }}>
          {w > 12 ? `${label} ${w}%` : w > 5 ? `${w}%` : ""}
        </div>
      ))}
    </div>
  );
}

function Row({ left, right, leftColor, rightColor }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
      <span style={{ color: C.txM }}>{left}</span>
      <span style={{ color: rightColor || leftColor || C.tx, fontFamily: mono, fontWeight: 600 }}>{right}</span>
    </div>
  );
}

export default function BarbelMDDPage() {
  // 만기매칭
  const [mmYtm, setMmYtm] = useState(2.80);
  const [mmMat, setMmMat] = useState(1.0);
  // 베크플
  const [bcDur, setBcDur] = useState(2.0);
  const [bcCarry, setBcCarry] = useState(3.80);
  // 장기국채
  const [ltDur, setLtDur] = useState(8.0);
  const [ltCarry, setLtCarry] = useState(3.00);
  // 공통
  const [months, setMonths] = useState(6);
  // 비중
  const [wMM, setWMM] = useState(40);
  const [wBC, setWBC] = useState(35);
  const wLT = Math.max(0, 100 - wMM - wBC);
  // 스트레스
  const [dRate, setDRate] = useState(30);
  const [dSpread, setDSpread] = useState(20);
  // 6개 시나리오
  const [scenarios, setScenarios] = useState([
    { name: "금리 급락", icon: "🚀", rate: -50, spread: 0 },
    { name: "금리 소폭↓", icon: "📉", rate: -20, spread: 0 },
    { name: "현행 유지", icon: "➖", rate: 0, spread: 0 },
    { name: "금리 소폭↑", icon: "📈", rate: 20, spread: 10 },
    { name: "스트레스", icon: "🔥", rate: 50, spread: 30 },
    { name: "위기 시나리오", icon: "💥", rate: 80, spread: 50 },
  ]);
  const updateScenario = (idx, key, val) => {
    setScenarios(prev => prev.map((s, i) => i === idx ? { ...s, [key]: val } : s));
  };
  // 히트맵
  const [hmRM, setHmRM] = useState(80);
  const [hmSM, setHmSM] = useState(50);
  const [hmSt, setHmSt] = useState(5);

  const t = months / 12;
  const f = (v, d = 2) => v.toFixed(d);
  const fs = (v, d = 2) => (v >= 0 ? "+" : "") + v.toFixed(d);

  const calcScenario = useCallback((rate, spread) => {
    const mm = wMM / 100 * mmYtm * t;
    const bc = wBC / 100 * (bcCarry * t - bcDur * rate / 100 - bcDur * spread / 100);
    const lt = wLT / 100 * (ltCarry * t - ltDur * rate / 100);
    return { mm, bc, lt, total: mm + bc + lt };
  }, [wMM, wBC, wLT, mmYtm, bcCarry, bcDur, ltCarry, ltDur, t]);

  // 각 자산 수익
  const mmRet = mmYtm * t;
  const bcRet = useMemo(() => bcCarry * t - bcDur * dRate / 100 - bcDur * dSpread / 100, [bcCarry, t, bcDur, dRate, dSpread]);
  const ltRet = useMemo(() => ltCarry * t - ltDur * dRate / 100, [ltCarry, t, ltDur, dRate]); // 국채라 스프레드 없음
  const totalRet = wMM / 100 * mmRet + wBC / 100 * bcRet + wLT / 100 * ltRet;

  // 히트맵
  const calcHM = useCallback((r, s) => {
    const mm = mmYtm * t;
    const bc = bcCarry * t - bcDur * r / 100 - bcDur * s / 100;
    const lt = ltCarry * t - ltDur * r / 100;
    return wMM / 100 * mm + wBC / 100 * bc + wLT / 100 * lt;
  }, [mmYtm, t, bcCarry, bcDur, ltCarry, ltDur, wMM, wBC, wLT]);

  // 손익분기
  const be = useMemo(() => {
    let ro = 0, so = 0, bo = 0;
    for (let r = 1; r <= 400; r++) if (calcHM(r, 0) < 0) { ro = r; break; }
    for (let s = 1; s <= 400; s++) if (calcHM(0, s) < 0) { so = s; break; }
    for (let x = 1; x <= 400; x++) if (calcHM(x, x) < 0) { bo = x; break; }
    return { ro, so, bo };
  }, [calcHM]);

  // 최적 비중 탐색 (brute force, 5% 단위)
  const optimal = useMemo(() => {
    let best = null;
    for (let m = 0; m <= 100; m += 5) {
      for (let b = 0; b <= 100 - m; b += 5) {
        const l = 100 - m - b;
        // 스트레스 시나리오에서의 수익
        const ret = m / 100 * mmYtm * t + b / 100 * (bcCarry * t - bcDur * dRate / 100 - bcDur * dSpread / 100) + l / 100 * (ltCarry * t - ltDur * dRate / 100);
        if (ret >= 0) {
          // 금리 -50bp 시나리오(상방) 수익
          const upside = m / 100 * mmYtm * t + b / 100 * (bcCarry * t + bcDur * 50 / 100 + bcDur * 0 / 100) + l / 100 * (ltCarry * t + ltDur * 50 / 100);
          if (!best || upside > best.upside) best = { m, b, l, ret, upside };
        }
      }
    }
    return best || { m: 100, b: 0, l: 0, ret: mmYtm * t, upside: mmYtm * t };
  }, [mmYtm, t, bcCarry, bcDur, dRate, dSpread, ltCarry, ltDur]);

  // 금리 하락 시나리오 (upside)
  const upsideRet = wMM / 100 * mmRet + wBC / 100 * (bcCarry * t + bcDur * 50 / 100) + wLT / 100 * (ltCarry * t + ltDur * 50 / 100);

  const bcCarryAmt = bcCarry * t;
  const bcRateLoss = bcDur * dRate / 100;
  const bcSpreadLoss = bcDur * dSpread / 100;
  const ltCarryAmt = ltCarry * t;
  const ltRateLoss = ltDur * dRate / 100;

  // 수익 프로파일 데이터: 금리 -80bp ~ +100bp, 스프레드는 현재 설정값 고정
  const profileData = useMemo(() => {
    const pts = [];
    for (let r = -80; r <= 100; r += 5) {
      const mm = wMM / 100 * mmYtm * t;
      const bc = wBC / 100 * (bcCarry * t - bcDur * Math.max(r, 0) / 100 - bcDur * (r > 0 ? dSpread : 0) / 100);
      // 금리 하락 시 베크플도 가격 상승 (금리 하락분만, 스프레드는 변동 없다고 가정)
      const bcFull = wBC / 100 * (bcCarry * t - bcDur * r / 100 - bcDur * dSpread / 100);
      const lt = wLT / 100 * (ltCarry * t - ltDur * r / 100);
      const total = mm + bcFull + lt;
      pts.push({ rate: r, 만기매칭: parseFloat(mm.toFixed(3)), 베크플: parseFloat(bcFull.toFixed(3)), 장기국채: parseFloat(lt.toFixed(3)), 전체: parseFloat(total.toFixed(3)) });
    }
    return pts;
  }, [wMM, wBC, wLT, mmYtm, t, bcCarry, bcDur, dSpread, ltCarry, ltDur]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;
    return (
      <div style={{ background: C.sf, border: `1px solid ${C.bd}`, borderRadius: 8, padding: "10px 12px", fontSize: 11 }}>
        <div style={{ fontWeight: 700, color: C.tx, marginBottom: 6, fontFamily: mono }}>금리 {label >= 0 ? "+" : ""}{label}bp</div>
        {payload.map(p => (
          <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}>
            <span style={{ color: p.color }}>{p.name}</span>
            <span style={{ color: p.color, fontFamily: mono, fontWeight: 600 }}>{p.value >= 0 ? "+" : ""}{p.value.toFixed(2)}%</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.tx,
      fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", padding: "20px 16px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid ${C.ac};cursor:pointer;box-shadow:0 0 6px rgba(59,130,246,0.4);}
        input[type=number]:focus{border-color:${C.ac}!important;box-shadow:0 0 0 2px rgba(59,130,246,0.2);}
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:${C.bg};}::-webkit-scrollbar-thumb{background:${C.bd};border-radius:3px;}
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <a href="/" style={{ fontSize: 11, color: C.txD, textDecoration: "none", display: "inline-block", marginBottom: 10,
          padding: "4px 12px", border: `1px solid ${C.bd}`, borderRadius: 20 }}>
          ← 컨트롤타워
        </a>
        <div style={{ fontSize: 10, color: C.ac, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 5, fontWeight: 600 }}>
          늑대무리원정단 · Fund Idea Lab
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, lineHeight: 1.3,
          background: "linear-gradient(135deg, #f1f5f9, #94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          베크플 바벨 MDD방어형
        </h1>
        <div style={{ fontSize: 11, color: C.txD, marginTop: 5 }}>
          만기매칭(쿠션) + 베크플(크레딧 캐리) + 장기국채(금리하락 부스터) — MDD 방어 바벨 설계
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <SB label="스트레스 시 수익률" value={fs(totalRet)} unit="%" color={totalRet >= 0 ? C.ok : C.dn}
          glow={totalRet >= 0 ? C.okG : C.dnG} sub={`금리+${dRate}bp 스프레드+${dSpread}bp`} />
        <SB label="금리 -50bp 시 수익률" value={fs(upsideRet)} unit="%" color={C.ok} glow={C.okG}
          sub="금리 하락 시 부스터 효과" />
        <SB label="추천 최적비중" value={`${optimal.m}/${optimal.b}/${optimal.l}`} unit=""
          color={C.ac} glow={C.acG} sub="만기매칭/베크플/장기채" />
        <SB label="손익분기 금리" value={be.ro > 0 ? `+${be.ro}bp` : ">400"} unit=""
          color={be.ro > 0 ? C.wn : C.ok} glow={be.ro > 0 ? C.wnG : C.okG} sub="스프레드 불변 시" />
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14 }}>
        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* 만기매칭 */}
          <Card>
            <ST icon="🛡️">만기매칭형 채권 (쿠션)</ST>
            <div style={{ fontSize: 10, color: C.txD, marginBottom: 10, padding: "6px 8px", background: C.bg, borderRadius: 5, border: `1px solid ${C.bd}` }}>
              만기보유 → 금리변동 무관, YTM 확정 수익. 전체 구조의 안전판
            </div>
            <Sl label="YTM" value={mmYtm} onChange={setMmYtm} min={1} max={6} step={0.05} unit="%" color={C.ok} />
            <Sl label="채권 만기" value={mmMat} onChange={setMmMat} min={0.25} max={5} step={0.25} unit="년" color={C.ok} />
            <div style={{ padding: "8px 10px", background: C.bg, borderRadius: 6, border: `1px solid ${C.bd}` }}>
              <Row left={`${months}개월 확정수익`} right={`+${f(mmRet)}%`} leftColor={C.txM} rightColor={C.ok} />
              {months / 12 > mmMat && <div style={{ fontSize: 9, color: C.wn, marginTop: 4 }}>⚠ 보유기간 &gt; 만기, 재투자 필요</div>}
            </div>
          </Card>

          {/* 베크플 */}
          <Card>
            <ST icon="💎">베크플 (크레딧 캐리)</ST>
            <Sl label="펀드 듀레이션" value={bcDur} onChange={setBcDur} min={0.5} max={5} step={0.1} unit="년" color={C.ac} />
            <Sl label="연간 캐리" value={bcCarry} onChange={setBcCarry} min={1} max={8} step={0.05} unit="%" color={C.ok} />
            <div style={{ padding: "8px 10px", background: C.bg, borderRadius: 6, border: `1px solid ${C.bd}` }}>
              <Row left="캐리 수익" right={`+${f(bcCarryAmt)}%`} rightColor={C.ok} />
              <Row left={`금리↑ 손실 (${f(bcDur,1)}×${dRate}bp)`} right={`−${f(bcRateLoss)}%`} rightColor={C.dn} />
              <Row left={`스프레드↑ 손실 (${f(bcDur,1)}×${dSpread}bp)`} right={`−${f(bcSpreadLoss)}%`} rightColor={C.dn} />
              <div style={{ borderTop: `1px solid ${C.bd}`, marginTop: 4, paddingTop: 5 }}>
                <Row left="베크플 순수익" right={`${fs(bcRet)}%`} rightColor={bcRet >= 0 ? C.ok : C.dn} />
              </div>
            </div>
          </Card>

          {/* 장기국채 */}
          <Card>
            <ST icon="🏛️">장기국채 (금리 부스터)</ST>
            <div style={{ fontSize: 10, color: C.txD, marginBottom: 10, padding: "6px 8px", background: C.bg, borderRadius: 5, border: `1px solid ${C.bd}` }}>
              국채 → 스프레드 리스크 0. 금리 하락 시 높은 자본차익, 상승 시 큰 손실
            </div>
            <Sl label="듀레이션" value={ltDur} onChange={setLtDur} min={3} max={15} step={0.5} unit="년" color={C.lb}
              desc="10년국채≈8, 20년≈13, 30년≈15" />
            <Sl label="연간 캐리" value={ltCarry} onChange={setLtCarry} min={1} max={5} step={0.05} unit="%" color={C.ok} />
            <div style={{ padding: "8px 10px", background: C.bg, borderRadius: 6, border: `1px solid ${C.bd}` }}>
              <Row left="캐리 수익" right={`+${f(ltCarryAmt)}%`} rightColor={C.ok} />
              <Row left={`금리↑ 손실 (${f(ltDur,1)}×${dRate}bp)`} right={`−${f(ltRateLoss)}%`} rightColor={C.dn} />
              <div style={{ borderTop: `1px solid ${C.bd}`, marginTop: 4, paddingTop: 5 }}>
                <Row left="장기채 순수익" right={`${fs(ltRet)}%`} rightColor={ltRet >= 0 ? C.ok : C.dn} />
              </div>
            </div>
          </Card>

          {/* 공통 */}
          <Card>
            <ST icon="⏱️">보유기간 & 스트레스</ST>
            <Sl label="보유기간" value={months} onChange={setMonths} min={1} max={24} step={1} unit="개월" color={C.wn} />
            <Sl label="국고3년 금리 상승" value={dRate} onChange={setDRate} min={0} max={150} step={1} unit="bp" color={C.dn} />
            <Sl label="크레딧스프레드 확대" value={dSpread} onChange={setDSpread} min={0} max={100} step={1} unit="bp" color={C.wn}
              desc="베크플에만 적용 (장기국채는 스프레드 무관)" />
          </Card>
        </div>

        {/* Right */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* 비중 */}
          <Card>
            <ST icon="⚖️">3자산 비중 배분</ST>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <Sl label="만기매칭 비중" value={wMM} onChange={v => { setWMM(v); if (v + wBC > 100) setWBC(100 - v); }}
                min={0} max={100} step={1} unit="%" color={C.ok} />
              <Sl label="베크플 비중" value={wBC} onChange={v => { setWBC(Math.min(v, 100 - wMM)); }}
                min={0} max={100 - wMM} step={1} unit="%" color={C.ac} />
            </div>
            <div style={{ fontSize: 12, color: C.lb, textAlign: "center", marginBottom: 8, fontWeight: 600, fontFamily: mono }}>
              장기국채 비중: {wLT}% (자동 계산)
            </div>
            <WeightBar items={[
              { w: wMM, color: C.ok, label: "만기매칭" },
              { w: wBC, color: C.ac, label: "베크플" },
              { w: wLT, color: C.lb, label: "장기국채" },
            ]} />

            {totalRet >= 0 ? (
              <div style={{ marginTop: 10, padding: "7px 10px", background: C.okG, borderRadius: 7,
                border: `1px solid ${C.ok}33`, fontSize: 11, color: C.ok, fontWeight: 500 }}>
                ✓ 스트레스 시나리오에서도 전체 구조 플러스 유지
              </div>
            ) : (
              <div style={{ marginTop: 10, padding: "7px 10px", background: C.dnG, borderRadius: 7,
                border: `1px solid ${C.dn}33`, fontSize: 11, color: C.dn, fontWeight: 500 }}>
                ⚠ 마이너스 발생! 추천 비중: 만기매칭 {optimal.m}% / 베크플 {optimal.b}% / 장기채 {optimal.l}%
              </div>
            )}

            {/* 멀티 시나리오 비교 */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.tx }}>📊 시나리오별 수익 분해</span>
                <span style={{ fontSize: 9, color: C.txD }}>금리·스프레드 조절 가능</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {scenarios.map((sc, idx) => {
                  const r = calcScenario(sc.rate, sc.spread);
                  const isNeg = r.total < 0;
                  return (
                    <div key={idx} style={{ padding: 10, background: isNeg ? C.dnG : C.bg, borderRadius: 8,
                      border: `1px solid ${isNeg ? C.dn + "33" : C.bd}`, transition: "all 0.2s" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: C.tx }}>{sc.icon} {sc.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: isNeg ? C.dn : C.ok, fontFamily: mono }}>
                          {fs(r.total)}%
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 8, color: C.txD, marginBottom: 2 }}>금리</div>
                          <input type="number" value={sc.rate} step={5}
                            onChange={e => updateScenario(idx, "rate", parseInt(e.target.value) || 0)}
                            style={{ width: "100%", padding: "2px 4px", fontSize: 10, fontFamily: mono, fontWeight: 600,
                              background: C.sf, border: `1px solid ${C.bd}`, borderRadius: 4,
                              color: sc.rate > 0 ? C.dn : sc.rate < 0 ? C.ok : C.tx, textAlign: "center", outline: "none" }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 8, color: C.txD, marginBottom: 2 }}>스프레드</div>
                          <input type="number" value={sc.spread} step={5}
                            onChange={e => updateScenario(idx, "spread", parseInt(e.target.value) || 0)}
                            style={{ width: "100%", padding: "2px 4px", fontSize: 10, fontFamily: mono, fontWeight: 600,
                              background: C.sf, border: `1px solid ${C.bd}`, borderRadius: 4,
                              color: sc.spread > 0 ? C.wn : C.spread < 0 ? C.ok : C.tx, textAlign: "center", outline: "none" }} />
                        </div>
                      </div>
                      {/* 3자산 기여 바 */}
                      <div style={{ display: "flex", gap: 1, height: 4, borderRadius: 2, overflow: "hidden", marginBottom: 4,
                        background: C.bd }}>
                        {r.mm > 0 && <div style={{ width: `${Math.max(0, r.mm / (Math.abs(r.mm) + Math.abs(r.bc) + Math.abs(r.lt) + 0.01)) * 100}%`,
                          background: C.ok, minWidth: 2 }} />}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9 }}>
                          <span style={{ color: C.ok }}>🛡 만기매칭</span>
                          <span style={{ color: C.ok, fontFamily: mono, fontWeight: 600 }}>+{f(r.mm)}%</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9 }}>
                          <span style={{ color: C.ac }}>💎 베크플</span>
                          <span style={{ color: r.bc >= 0 ? C.ok : C.dn, fontFamily: mono, fontWeight: 600 }}>{fs(r.bc)}%</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9 }}>
                          <span style={{ color: C.lb }}>🏛 장기국채</span>
                          <span style={{ color: r.lt >= 0 ? C.ok : C.dn, fontFamily: mono, fontWeight: 600 }}>{fs(r.lt)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* 모든 시나리오 플러스인지 체크 */}
              {(() => {
                const allOk = scenarios.every(sc => calcScenario(sc.rate, sc.spread).total >= 0);
                const failCount = scenarios.filter(sc => calcScenario(sc.rate, sc.spread).total < 0).length;
                return allOk ? (
                  <div style={{ marginTop: 8, padding: "6px 10px", background: C.okG, borderRadius: 6,
                    border: `1px solid ${C.ok}33`, fontSize: 10, color: C.ok, fontWeight: 500, textAlign: "center" }}>
                    ✓ 전 시나리오 플러스 — 손실 없는 구조 확인
                  </div>
                ) : (
                  <div style={{ marginTop: 8, padding: "6px 10px", background: C.dnG, borderRadius: 6,
                    border: `1px solid ${C.dn}33`, fontSize: 10, color: C.dn, fontWeight: 500, textAlign: "center" }}>
                    ⚠ {failCount}개 시나리오에서 마이너스 발생 — 비중 조정 필요
                  </div>
                );
              })()}
            </div>
          </Card>

          {/* 수익 프로파일 차트 */}
          <Card>
            <ST icon="📈">금리 변동별 수익 프로파일</ST>
            <div style={{ fontSize: 10, color: C.txD, marginBottom: 12, padding: "6px 8px", background: C.bg, borderRadius: 5, border: `1px solid ${C.bd}` }}>
              금리가 내리면 장기국채가 부스터 🚀 · 금리가 올라도 만기매칭이 쿠션 🛡️ · 스프레드는 현재 설정값({dSpread}bp) 고정
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={profileData} margin={{ top: 10, right: 10, left: -5, bottom: 5 }}
                stackOffset="sign">
                <CartesianGrid strokeDasharray="3 3" stroke={C.bd} />
                <XAxis dataKey="rate" tick={{ fill: C.txD, fontSize: 9, fontFamily: mono }}
                  tickFormatter={v => `${v >= 0 ? "+" : ""}${v}`}
                  label={{ value: "금리 변동 (bp)", position: "insideBottom", offset: -2, fill: C.txD, fontSize: 10 }} />
                <YAxis tick={{ fill: C.txD, fontSize: 9, fontFamily: mono }}
                  tickFormatter={v => `${v >= 0 ? "+" : ""}${v}%`}
                  label={{ value: "수익률 (%)", angle: -90, position: "insideLeft", fill: C.txD, fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke={C.txD} strokeWidth={1.5} strokeDasharray="4 2" />
                <ReferenceLine x={0} stroke={C.txD} strokeWidth={1} strokeDasharray="2 2" />
                <ReferenceLine x={dRate} stroke="#fff" strokeWidth={1.5} strokeDasharray="6 3"
                  label={{ value: `+${dRate}bp`, position: "top", fill: "#fff", fontSize: 9, fontWeight: 700 }} />
                {dRate > 0 && <ReferenceLine x={-dRate} stroke={C.ok} strokeWidth={1} strokeDasharray="4 3"
                  label={{ value: `−${dRate}bp`, position: "top", fill: C.ok, fontSize: 9 }} />}
                <Bar dataKey="만기매칭" stackId="a" fill={C.ok} fillOpacity={0.7} radius={0} />
                <Bar dataKey="베크플" stackId="a" fill={C.ac} fillOpacity={0.7} radius={0} />
                <Bar dataKey="장기국채" stackId="a" fill={C.lb} fillOpacity={0.7} radius={0} />
                <Line type="monotone" dataKey="전체" stroke="#fff" strokeWidth={2.5} dot={false}
                  strokeDasharray="0" />
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 14, marginTop: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {[
                [C.ok, "만기매칭 (확정)"],
                [C.ac, "베크플 (크레딧)"],
                [C.lb, "장기국채 (부스터)"],
                ["#fff", "전체 수익률"],
              ].map(([color, label]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: label === "전체 수익률" ? 16 : 10, height: label === "전체 수익률" ? 2 : 10,
                    borderRadius: label === "전체 수익률" ? 0 : 2, background: color }} />
                  <span style={{ fontSize: 9, color: C.txD }}>{label}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Heatmap */}
          <Card style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 6 }}>
              <ST icon="🗺️">시나리오 히트맵</ST>
              <div style={{ fontSize: 9, color: C.txD, padding: "3px 6px", background: C.bg, borderRadius: 3 }}>
                {wMM}/{wBC}/{wLT} 비중 | 전체 수익률(%)
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <NI label="금리 최대" value={hmRM} onChange={setHmRM} min={10} max={200} step={5} unit="bp" />
              <NI label="스프레드 최대" value={hmSM} onChange={setHmSM} min={10} max={150} step={5} unit="bp" />
              <NI label="간격" value={hmSt} onChange={setHmSt} min={1} max={20} step={1} unit="bp" />
            </div>
            <Heatmap rateRange={[0, hmRM, hmSt]} spreadRange={[0, hmSM, hmSt]} calc={calcHM} curRate={dRate} curSpread={dSpread} />
            <div style={{ display: "flex", gap: 14, marginTop: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {[["rgba(16,185,129,0.4)", "플러스"], ["rgba(245,158,11,0.3)", "0 근접"], ["rgba(239,68,68,0.5)", "마이너스"]].map(([bg, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: bg }} />
                  <span style={{ fontSize: 9, color: C.txD }}>{l}</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, border: "2px solid #fff", background: "rgba(255,255,255,0.2)" }} />
                <span style={{ fontSize: 9, color: C.txD }}>현재 시나리오</span>
              </div>
            </div>
            <div style={{ textAlign: "center", marginTop: 8, padding: "5px 10px", background: C.bg,
              borderRadius: 6, border: `1px solid ${C.bd}`, fontSize: 10, color: C.txM }}>
              📍 현재: 금리 <b style={{ color: C.dn, fontFamily: mono }}>+{dRate}bp</b> / 스프레드{" "}
              <b style={{ color: C.wn, fontFamily: mono }}>+{dSpread}bp</b> → 전체{" "}
              <b style={{ color: totalRet >= 0 ? C.ok : C.dn, fontFamily: mono }}>{fs(totalRet)}%</b>
            </div>
          </Card>

          {/* 손익분기 */}
          <Card>
            <ST icon="📐">손익분기 분석</ST>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { t: "스프레드 불변 시", s: "금리 상승 한도", v: be.ro, fmt: v => v > 0 ? `+${v}bp` : ">400bp" },
                { t: "금리 불변 시", s: "스프레드 확대 한도", v: be.so, fmt: v => v > 0 ? `+${v}bp` : ">400bp" },
                { t: "동시 발생 (1:1)", s: "금리·스프레드 한도", v: be.bo, fmt: v => v > 0 ? `각 +${v}bp` : ">400bp" },
              ].map(x => (
                <div key={x.t} style={{ padding: 12, background: C.bg, borderRadius: 7, border: `1px solid ${C.bd}` }}>
                  <div style={{ fontSize: 10, color: C.txD, marginBottom: 4 }}>{x.t}</div>
                  <div style={{ fontSize: 9, color: C.txD, marginBottom: 3 }}>{x.s}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: x.v > 0 ? C.wn : C.ok, fontFamily: mono }}>{x.fmt(x.v)}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* 설계 요약 */}
          <Card>
            <ST icon="📋">설계 요약</ST>
            <div style={{ padding: 12, background: C.bg, borderRadius: 7, border: `1px solid ${C.bd}`,
              fontSize: 11, color: C.txM, lineHeight: 1.8 }}>
              <b style={{ color: C.ok }}>만기매칭 {wMM}%</b> +{" "}
              <b style={{ color: C.ac }}>베크플 {wBC}%</b> +{" "}
              <b style={{ color: C.lb }}>장기국채 {wLT}%</b> 바벨 구조,{" "}
              <b style={{ color: C.tx }}>{months}개월</b> 보유 시
              <br />
              ▸ <span style={{ color: C.dn }}>금리 +{dRate}bp & 스프레드 +{dSpread}bp</span> →{" "}
              전체 <b style={{ color: totalRet >= 0 ? C.ok : C.dn, fontFamily: mono }}>{fs(totalRet)}%</b>
              {totalRet >= 0 ? " ✓" : " ✗"}
              <br />
              ▸ <span style={{ color: C.ok }}>금리 -50bp</span> →{" "}
              전체 <b style={{ color: C.ok, fontFamily: mono }}>{fs(upsideRet)}%</b>{" "}
              (장기채 부스터 효과)
              <br />
              ▸ 만기매칭의 확정수익 <b style={{ color: C.ok, fontFamily: mono }}>+{f(mmRet)}%</b>가
              베크플·장기채의 MDD를 흡수하는 쿠션 역할
            </div>
          </Card>
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: 20, padding: "10px 0", fontSize: 9,
        color: C.txD, fontFamily: mono, lineHeight: 1.8 }}>
        WOLF PACK EXPEDITION · FUND IDEA LAB · 베크플 바벨 MDD방어형 v1.0
      </div>
    </div>
  );
}
