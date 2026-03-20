"use client";

import { useState, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// 기저 데이터: 2025 월별 CPI 지수
// 한국: 2020=100 기준 (통계청 발표)
// 미국: 1982-84=100 기준 (BLS 발표)
// ═══════════════════════════════════════════════════════════════
// 한국 2025 CPI: Jan=115.72(역산: 118.03/1.02), Feb=116.08(118.40/1.02),
// Dec=117.57(발표). 나머지는 Y-Y 2.1%·MoM 추세로 보간.
const DEFAULT_KR_2025 = [115.72, 116.08, 115.50, 115.80, 115.40, 115.60, 115.90, 116.20, 116.40, 116.80, 117.20, 117.57];

// 미국 2025 CPI-U: Dec=318.4(발표 2.7% Y-Y). Jan 2026=319.1(2.4% Y-Y 역산)
// 2025 연간 2.7% Dec-Dec 기준 추정
const DEFAULT_US_2025 = [309.7, 310.2, 310.8, 311.4, 312.0, 312.5, 313.2, 314.0, 314.5, 315.3, 316.4, 318.4];

// 2026 실현값 (발표된 월만 입력, 나머지 null)
const DEFAULT_KR_2026 = [118.03, 118.40, null, null, null, null, null, null, null, null, null, null];
const DEFAULT_US_2026 = [319.1, 319.8, null, null, null, null, null, null, null, null, null, null];

// ═══════════════════════════════════════════════════════════════
// 2025 월별 유가(WTI $/bbl) 실제 데이터
// 소스: EIA, Statista, IEA. Aug=$65(Statista), Nov~$59(IEA), Dec~$60
// ═══════════════════════════════════════════════════════════════
const DEFAULT_OIL_2025 = [74, 72, 68, 63, 61, 63, 65, 65, 67, 62, 59, 60];

// 2025 월별 USDKRW 실제 데이터 (x-rates.com 월평균)
const DEFAULT_FX_2025 = [1455, 1446, 1458, 1440, 1392, 1366, 1377, 1389, 1393, 1423, 1457, 1466];

// 2026 실현 유가/환율 (1~2월 추정, 3월은 현재 진행중이므로 null)
const DEFAULT_OIL_2026 = [73, 75, null, null, null, null, null, null, null, null, null, null];
const DEFAULT_FX_2026 = [1460, 1450, null, null, null, null, null, null, null, null, null, null];

const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ═══════════════════════════════════════════════════════════════
// 패스스루 파라미터 — v2.1 수정
// ═══════════════════════════════════════════════════════════════
const PARAMS = {
  KR: {
    energy_weight: 0.075,      // CPI 내 에너지 가중치 ~7.5%
    oil_passthrough: 0.38,     // ★수정: 60%→38%. 유류세 인하·공공요금 미연동 반영
    oil_lag: [0.30, 0.35, 0.25, 0.10], // ★수정: 4개월 분산 (한국은 미국보다 느림)
    fx_passthrough: 0.03,      // 환율 변동 → 비에너지CPI 전가율
    fx_lag: [0.20, 0.25, 0.30, 0.25], // 4개월 분산
    label: "한국",
    unit: "2020=100",
  },
  US: {
    energy_weight: 0.073,
    oil_passthrough: 0.55,     // ★미세 수정: 65%→55%. 미국도 일부 버퍼 존재
    oil_lag: [0.45, 0.35, 0.20], // 3개월 분산 (미국이 더 빠름)
    fx_passthrough: 0.0,
    fx_lag: [],
    label: "미국",
    unit: "1982-84=100",
  },
};

// ═══════════════════════════════════════════════════════════════
// 시나리오 프리셋 — v2.1 환율도 현실적으로 조정
// ═══════════════════════════════════════════════════════════════
const SCENARIO_PRESETS = [
  { name: "🕊️ 평화 (유가 하락)", oil: 70, fx: 1400, desc: "이란 분쟁 해소, 유가 70$ 복귀" },
  { name: "📊 기본 (현 수준)", oil: 95, fx: 1470, desc: "현재 유가/환율 수준 지속" },
  { name: "🔥 긴장 지속", oil: 110, fx: 1500, desc: "호르무즈 긴장 지속, 유가 110$" },
  { name: "💥 위기 심화", oil: 130, fx: 1550, desc: "해협 봉쇄 장기화, 유가 130$" },
];

// ═══════════════════════════════════════════════════════════════
// ★핵심 수정: 스무딩 전환 함수
// 실현 유가 → 시나리오 유가를 3개월에 걸쳐 선형 보간
// ═══════════════════════════════════════════════════════════════
function buildSmoothedOilPath(oil2026Realized, oilScenario, smoothMonths = 3) {
  const n = 12;
  const firstNull = oil2026Realized.findIndex(v => v === null);
  if (firstNull === -1) return [...oil2026Realized]; // 모두 실현

  const lastRealizedOil = firstNull > 0 ? oil2026Realized[firstNull - 1] : 60; // fallback

  return Array.from({ length: n }, (_, i) => {
    if (i < firstNull) return oil2026Realized[i];
    const monthsAfter = i - firstNull;
    if (monthsAfter < smoothMonths) {
      // 선형 보간: 마지막 실현값 → 시나리오값
      const t = (monthsAfter + 1) / smoothMonths;
      return lastRealizedOil + (oilScenario - lastRealizedOil) * t;
    }
    return oilScenario;
  });
}

function buildSmoothedFxPath(fx2026Realized, fxScenario, smoothMonths = 2) {
  const n = 12;
  const firstNull = fx2026Realized.findIndex(v => v === null);
  if (firstNull === -1) return [...fx2026Realized];

  const lastRealizedFx = firstNull > 0 ? fx2026Realized[firstNull - 1] : 1450;

  return Array.from({ length: n }, (_, i) => {
    if (i < firstNull) return fx2026Realized[i];
    const monthsAfter = i - firstNull;
    if (monthsAfter < smoothMonths) {
      const t = (monthsAfter + 1) / smoothMonths;
      return Math.round(lastRealizedFx + (fxScenario - lastRealizedFx) * t);
    }
    return fxScenario;
  });
}

// ═══════════════════════════════════════════════════════════════
// CPI 투사 엔진 — v2.1
// ═══════════════════════════════════════════════════════════════
function projectCPI({ cpi2025, cpi2026Realized, oil2025, fx2025, oil2026Realized, fx2026Realized, oilScenario, fxScenario, nonEnergyMom, params }) {
  const n = 12;

  // ★스무딩 적용
  const oil2026 = buildSmoothedOilPath(oil2026Realized, oilScenario, 3);
  const fx2026 = buildSmoothedFxPath(fx2026Realized, fxScenario, 2);

  const cpi2026 = [...cpi2026Realized];
  const firstNull = cpi2026.findIndex(v => v === null);

  if (firstNull === -1) {
    const yy = cpi2026.map((v, i) => ((v / cpi2025[i]) - 1) * 100);
    const avgCpi2026 = cpi2026.reduce((a, b) => a + b, 0) / n;
    const avgCpi2025 = cpi2025.reduce((a, b) => a + b, 0) / n;
    return { cpi2026, yy, yearEndYY: yy[11], annualAvgYY: ((avgCpi2026 / avgCpi2025) - 1) * 100, oil2026, fx2026 };
  }

  for (let m = firstNull; m < n; m++) {
    let energyMom = 0;
    for (let lag = 0; lag < params.oil_lag.length; lag++) {
      const mLag = m - lag;
      if (mLag >= 0) {
        // 원화환산 유가 MoM
        const oilKrwCur = oil2026[mLag] * (params.fx_passthrough > 0 ? fx2026[mLag] : 1);
        const oilKrwPrev = mLag > 0
          ? oil2026[mLag - 1] * (params.fx_passthrough > 0 ? fx2026[mLag - 1] : 1)
          : oil2025[11] * (params.fx_passthrough > 0 ? fx2025[11] : 1);
        const oilMom = oilKrwPrev > 0 ? (oilKrwCur / oilKrwPrev - 1) : 0;
        energyMom += params.oil_lag[lag] * oilMom * params.oil_passthrough;
      }
    }
    const energyContrib = params.energy_weight * energyMom;

    // 환율 → 비에너지 (한국만)
    let fxContrib = 0;
    if (params.fx_passthrough > 0) {
      for (let lag = 0; lag < params.fx_lag.length; lag++) {
        const mLag = m - lag;
        if (mLag >= 0) {
          const fxCur = fx2026[mLag];
          const fxPrev = mLag > 0 ? fx2026[mLag - 1] : fx2025[11];
          const fxMom = fxPrev > 0 ? (fxCur / fxPrev - 1) : 0;
          fxContrib += params.fx_lag[lag] * fxMom * params.fx_passthrough;
        }
      }
    }

    const prevCpi = m > 0 ? cpi2026[m - 1] : cpi2025[11];
    cpi2026[m] = prevCpi * (1 + nonEnergyMom / 100 + energyContrib + fxContrib);
  }

  const yy = cpi2026.map((v, i) => ((v / cpi2025[i]) - 1) * 100);
  const avgCpi2026 = cpi2026.reduce((a, b) => a + b, 0) / n;
  const avgCpi2025 = cpi2025.reduce((a, b) => a + b, 0) / n;

  return {
    cpi2026: cpi2026.map(v => Math.round(v * 100) / 100),
    yy: yy.map(v => Math.round(v * 100) / 100),
    yearEndYY: Math.round(yy[11] * 100) / 100,
    annualAvgYY: Math.round(((avgCpi2026 / avgCpi2025) - 1) * 10000) / 100,
    oil2026,
    fx2026,
  };
}

// ═══════════════════════════════════════════════════════════════
// 메인 컴포넌트
// ═══════════════════════════════════════════════════════════════
export default function OilCPIMonitor() {
  const [country, setCountry] = useState("KR");
  const [oilScenario, setOilScenario] = useState(95);
  const [fxScenario, setFxScenario] = useState(1470);
  const [nonEnergyMom, setNonEnergyMom] = useState(0.15);
  const [showDataEdit, setShowDataEdit] = useState(false);
  const [tab, setTab] = useState("projection");

  const [krCpi2025, setKrCpi2025] = useState([...DEFAULT_KR_2025]);
  const [usCpi2025, setUsCpi2025] = useState([...DEFAULT_US_2025]);
  const [krCpi2026, setKrCpi2026] = useState([...DEFAULT_KR_2026]);
  const [usCpi2026, setUsCpi2026] = useState([...DEFAULT_US_2026]);
  const [oil2025, setOil2025] = useState([...DEFAULT_OIL_2025]);
  const [fx2025, setFx2025] = useState([...DEFAULT_FX_2025]);
  const [oil2026, setOil2026] = useState([...DEFAULT_OIL_2026]);
  const [fx2026, setFx2026] = useState([...DEFAULT_FX_2026]);

  const params = PARAMS[country];
  const cpi2025 = country === "KR" ? krCpi2025 : usCpi2025;
  const cpi2026Realized = country === "KR" ? krCpi2026 : usCpi2026;

  const projection = useMemo(() => {
    return projectCPI({
      cpi2025, cpi2026Realized, oil2025, fx2025,
      oil2026Realized: oil2026, fx2026Realized: fx2026,
      oilScenario, fxScenario, nonEnergyMom, params,
    });
  }, [cpi2025, cpi2026Realized, oil2025, fx2025, oil2026, fx2026, oilScenario, fxScenario, nonEnergyMom, params]);

  const multiScenario = useMemo(() => {
    return SCENARIO_PRESETS.map(s => ({
      ...s,
      result: projectCPI({
        cpi2025, cpi2026Realized, oil2025, fx2025,
        oil2026Realized: oil2026, fx2026Realized: fx2026,
        oilScenario: s.oil, fxScenario: s.fx, nonEnergyMom, params,
      }),
    }));
  }, [cpi2025, cpi2026Realized, oil2025, fx2025, oil2026, fx2026, nonEnergyMom, params]);

  // 민감도
  const oilRange = [70, 80, 90, 95, 100, 110, 120, 130];
  const fxRange = country === "KR" ? [1380, 1430, 1470, 1500, 1550] : [100];

  const sensitivity = useMemo(() => {
    if (tab !== "sensitivity") return null;
    return oilRange.map(oil =>
      fxRange.map(fx =>
        projectCPI({
          cpi2025, cpi2026Realized, oil2025, fx2025,
          oil2026Realized: oil2026, fx2026Realized: fx2026,
          oilScenario: oil, fxScenario: country === "KR" ? fx : 1,
          nonEnergyMom, params,
        })
      )
    );
  }, [tab, cpi2025, cpi2026Realized, oil2025, fx2025, oil2026, fx2026, nonEnergyMom, params, country]);

  const realizedCount = cpi2026Realized.filter(v => v !== null).length;
  const yyMin = Math.min(...projection.yy) - 0.3;
  const yyMax = Math.max(...projection.yy) + 0.3;

  const yyColor = (v) => {
    if (v >= 3.0) return "#ef4444";
    if (v >= 2.5) return "#f97316";
    if (v >= 2.0) return "#eab308";
    if (v >= 1.5) return "#22c55e";
    return "#3b82f6";
  };

  const S = {
    page: { minHeight: "100vh", background: "#0a0e17", color: "#e2e8f0", fontFamily: "'Pretendard', -apple-system, sans-serif", padding: "0" },
    header: { padding: "24px 24px 16px", borderBottom: "1px solid #1e293b" },
    title: { fontSize: "20px", fontWeight: 700, color: "#f1f5f9", margin: 0, letterSpacing: "-0.5px" },
    subtitle: { fontSize: "12px", color: "#64748b", marginTop: "4px", fontFamily: "monospace" },
    body: { padding: "20px 24px", maxWidth: "1200px" },
    card: { background: "#111827", border: "1px solid #1e293b", borderRadius: "8px", padding: "16px", marginBottom: "16px" },
    label: { fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px", marginBottom: "8px" },
    input: { background: "#0f172a", border: "1px solid #334155", borderRadius: "4px", padding: "6px 10px", color: "#e2e8f0", fontSize: "13px", width: "100%" },
    btn: (active) => ({
      padding: "6px 14px", borderRadius: "6px", border: active ? "1px solid #6366f1" : "1px solid #334155",
      background: active ? "#312e81" : "transparent", color: active ? "#a5b4fc" : "#94a3b8",
      fontSize: "12px", fontWeight: 600, cursor: "pointer",
    }),
    scenarioBtn: (active) => ({
      padding: "8px 12px", borderRadius: "6px", border: active ? "1px solid #6366f1" : "1px solid #1e293b",
      background: active ? "#1e1b4b" : "#0f172a", color: active ? "#c7d2fe" : "#94a3b8",
      fontSize: "12px", cursor: "pointer", textAlign: "left", width: "100%",
    }),
    th: { padding: "6px 8px", fontSize: "11px", color: "#64748b", fontWeight: 600, textAlign: "center", borderBottom: "1px solid #1e293b" },
    td: (hl) => ({
      padding: "5px 8px", fontSize: "12px", textAlign: "center", fontFamily: "monospace",
      color: hl ? "#f1f5f9" : "#94a3b8", borderBottom: "1px solid #0f172a",
      background: hl ? "#1e1b4b22" : "transparent",
    }),
    bigNum: { fontSize: "28px", fontWeight: 700, fontFamily: "monospace", letterSpacing: "-1px" },
  };

  const updateArr = (setter, idx, val) => {
    setter(prev => {
      const next = [...prev];
      next[idx] = val === "" ? null : parseFloat(val);
      return next;
    });
  };

  return (
    <div style={S.page}>
      {/* ═══ 헤더 ═══ */}
      <div style={S.header}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={S.title}>🛢️ Oil → CPI Projection Monitor</h1>
            <p style={S.subtitle}>유가/환율 시나리오 → CPI Y-Y 연말값 · 연평균값 투사 (v2.1 시차+스무딩 모델)</p>
          </div>
          <a href="/" style={{ fontSize: "12px", color: "#64748b", textDecoration: "none" }}>← 컨트롤타워</a>
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <button style={S.btn(country === "KR")} onClick={() => setCountry("KR")}>🇰🇷 한국</button>
          <button style={S.btn(country === "US")} onClick={() => setCountry("US")}>🇺🇸 미국</button>
          <div style={{ flex: 1 }} />
          <button style={{ ...S.btn(false), fontSize: "11px" }} onClick={() => setShowDataEdit(!showDataEdit)}>
            {showDataEdit ? "📊 데이터 편집 닫기" : "✏️ 기저 데이터 편집"}
          </button>
        </div>
      </div>

      <div style={S.body}>
        {/* ═══ 핵심 요약 ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          {[
            { label: "연말 CPI Y-Y", value: projection.yearEndYY, suffix: "%", isYY: true },
            { label: "연평균 CPI Y-Y", value: projection.annualAvgYY, suffix: "%", isYY: true },
            { label: "유가 시나리오", value: oilScenario, suffix: " $/bbl" },
            { label: country === "KR" ? "환율 시나리오" : "Energy Wt.", value: country === "KR" ? fxScenario : (params.energy_weight * 100).toFixed(1), suffix: country === "KR" ? " ₩/$" : "%" },
          ].map((item, i) => (
            <div key={i} style={S.card}>
              <div style={S.label}>{item.label}</div>
              <div style={{ ...S.bigNum, color: item.isYY ? yyColor(item.value) : "#e2e8f0" }}>
                {typeof item.value === "number" ? item.value.toFixed(i < 2 ? 2 : 0) : item.value}
                <span style={{ fontSize: "14px", fontWeight: 400, color: "#64748b" }}>{item.suffix}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ═══ 시나리오 입력 ═══ */}
        <div style={S.card}>
          <div style={S.label}>시나리오 입력 — 유가는 3개월에 걸쳐 점진적 전환 (스무딩)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "16px", marginBottom: "12px" }}>
            {SCENARIO_PRESETS.map((s, i) => (
              <button key={i} style={S.scenarioBtn(oilScenario === s.oil && fxScenario === s.fx)}
                onClick={() => { setOilScenario(s.oil); setFxScenario(s.fx); }}>
                <div style={{ fontWeight: 600, marginBottom: "2px" }}>{s.name}</div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>WTI ${s.oil} · ₩{s.fx}</div>
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>WTI 유가 ($/bbl)</div>
              <input type="number" style={S.input} value={oilScenario} onChange={e => setOilScenario(Number(e.target.value))} />
              <input type="range" min="50" max="150" step="5" value={oilScenario}
                onChange={e => setOilScenario(Number(e.target.value))} style={{ width: "100%", marginTop: "4px", accentColor: "#6366f1" }} />
            </div>
            {country === "KR" && (
              <div>
                <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>USDKRW 환율</div>
                <input type="number" style={S.input} value={fxScenario} onChange={e => setFxScenario(Number(e.target.value))} />
                <input type="range" min="1300" max="1600" step="10" value={fxScenario}
                  onChange={e => setFxScenario(Number(e.target.value))} style={{ width: "100%", marginTop: "4px", accentColor: "#6366f1" }} />
              </div>
            )}
            <div>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>비에너지 MoM 추세 (%)</div>
              <input type="number" step="0.01" style={S.input} value={nonEnergyMom}
                onChange={e => setNonEnergyMom(Number(e.target.value))} />
              <input type="range" min="0" max="0.4" step="0.01" value={nonEnergyMom}
                onChange={e => setNonEnergyMom(Number(e.target.value))} style={{ width: "100%", marginTop: "4px", accentColor: "#6366f1" }} />
            </div>
          </div>
        </div>

        {/* ═══ 탭 ═══ */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          {[
            { id: "projection", icon: "📈", label: "월별 투사" },
            { id: "scenario", icon: "🔀", label: "시나리오 비교" },
            { id: "sensitivity", icon: "📊", label: "민감도 매트릭스" },
            { id: "params", icon: "⚙️", label: "모델 설명" },
          ].map(t => (
            <button key={t.id} style={S.btn(tab === t.id)} onClick={() => setTab(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ═══ 탭: 월별 투사 ═══ */}
        {tab === "projection" && (
          <>
            {/* 바 차트 */}
            <div style={S.card}>
              <div style={S.label}>{params.label} CPI Y-Y 월별 추이 (2026)</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "180px", marginTop: "8px" }}>
                {projection.yy.map((v, i) => {
                  const isRealized = i < realizedCount;
                  const barH = Math.max(4, ((v - yyMin) / (yyMax - yyMin)) * 150);
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ fontSize: "10px", fontFamily: "monospace", color: yyColor(v), fontWeight: 600, marginBottom: "2px" }}>
                        {v.toFixed(1)}
                      </div>
                      <div style={{
                        width: "100%", height: `${barH}px`, borderRadius: "3px 3px 0 0",
                        background: isRealized
                          ? `linear-gradient(180deg, ${yyColor(v)}, ${yyColor(v)}88)`
                          : `repeating-linear-gradient(135deg, ${yyColor(v)}40, ${yyColor(v)}40 2px, ${yyColor(v)}20 2px, ${yyColor(v)}20 4px)`,
                        border: isRealized ? "none" : `1px dashed ${yyColor(v)}60`,
                        transition: "height 0.3s ease",
                      }} />
                      <div style={{ fontSize: "10px", color: isRealized ? "#94a3b8" : "#475569", marginTop: "4px" }}>
                        {MONTHS_EN[i]}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: "16px", marginTop: "8px", justifyContent: "center" }}>
                <span style={{ fontSize: "10px", color: "#64748b" }}>
                  <span style={{ display: "inline-block", width: "12px", height: "8px", background: "#6366f1", borderRadius: "2px", marginRight: "4px" }} /> 실현
                </span>
                <span style={{ fontSize: "10px", color: "#64748b" }}>
                  <span style={{ display: "inline-block", width: "12px", height: "8px", background: "repeating-linear-gradient(135deg, #6366f140, #6366f140 2px, #6366f120 2px, #6366f120 4px)", border: "1px dashed #6366f160", borderRadius: "2px", marginRight: "4px" }} /> 투사
                </span>
              </div>
            </div>

            {/* 상세 테이블 */}
            <div style={S.card}>
              <div style={S.label}>{params.label} 2026 월별 CPI 투사 상세</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={S.th}></th>
                      {MONTHS.map((m, i) => (
                        <th key={i} style={{ ...S.th, color: i < realizedCount ? "#a5b4fc" : "#475569" }}>{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ ...S.td(false), textAlign: "left", fontWeight: 600, fontSize: "11px" }}>2025 CPI</td>
                      {cpi2025.map((v, i) => <td key={i} style={S.td(false)}>{v.toFixed(1)}</td>)}
                    </tr>
                    <tr>
                      <td style={{ ...S.td(true), textAlign: "left", fontWeight: 600, fontSize: "11px" }}>2026 CPI</td>
                      {projection.cpi2026.map((v, i) => (
                        <td key={i} style={{ ...S.td(i < realizedCount), fontWeight: i < realizedCount ? 600 : 400 }}>{v.toFixed(1)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ ...S.td(false), textAlign: "left", fontWeight: 600, fontSize: "11px", color: "#eab308" }}>Y-Y %</td>
                      {projection.yy.map((v, i) => (
                        <td key={i} style={{ ...S.td(false), color: yyColor(v), fontWeight: 600 }}>{v.toFixed(2)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ ...S.td(false), textAlign: "left", fontWeight: 600, fontSize: "11px" }}>유가 $/bbl</td>
                      {projection.oil2026.map((v, i) => (
                        <td key={i} style={{ ...S.td(false), color: i < realizedCount ? "#94a3b8" : (i < realizedCount + 3 ? "#c7d2fe" : "#94a3b8") }}>
                          {Math.round(v)}
                        </td>
                      ))}
                    </tr>
                    {country === "KR" && (
                      <tr>
                        <td style={{ ...S.td(false), textAlign: "left", fontWeight: 600, fontSize: "11px" }}>USDKRW</td>
                        {projection.fx2026.map((v, i) => (
                          <td key={i} style={{ ...S.td(false), color: i < realizedCount ? "#94a3b8" : (i < realizedCount + 2 ? "#c7d2fe" : "#94a3b8") }}>
                            {Math.round(v)}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: "8px", fontSize: "10px", color: "#475569" }}>
                * 유가/환율 보라색 = 스무딩 전환 구간 (실현값 → 시나리오값 점진 이행)
              </div>
            </div>
          </>
        )}

        {/* ═══ 탭: 시나리오 비교 ═══ */}
        {tab === "scenario" && (
          <div style={S.card}>
            <div style={S.label}>{params.label} 시나리오별 CPI Y-Y 비교</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={S.th}>시나리오</th>
                  <th style={S.th}>WTI</th>
                  {country === "KR" && <th style={S.th}>USDKRW</th>}
                  <th style={S.th}>연말 Y-Y</th>
                  <th style={S.th}>연평균 Y-Y</th>
                  <th style={S.th}>6월 Y-Y</th>
                  <th style={S.th}>9월 Y-Y</th>
                </tr>
              </thead>
              <tbody>
                {multiScenario.map((s, i) => (
                  <tr key={i}>
                    <td style={{ ...S.td(false), textAlign: "left" }}>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: "10px", color: "#64748b" }}>{s.desc}</div>
                    </td>
                    <td style={S.td(false)}>${s.oil}</td>
                    {country === "KR" && <td style={S.td(false)}>₩{s.fx}</td>}
                    <td style={{ ...S.td(true), color: yyColor(s.result.yearEndYY), fontWeight: 700, fontSize: "14px" }}>
                      {s.result.yearEndYY.toFixed(2)}%
                    </td>
                    <td style={{ ...S.td(true), color: yyColor(s.result.annualAvgYY), fontWeight: 700, fontSize: "14px" }}>
                      {s.result.annualAvgYY.toFixed(2)}%
                    </td>
                    <td style={{ ...S.td(false), color: yyColor(s.result.yy[5]) }}>{s.result.yy[5].toFixed(2)}%</td>
                    <td style={{ ...S.td(false), color: yyColor(s.result.yy[8]) }}>{s.result.yy[8].toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 참고 벤치마크 */}
            <div style={{ marginTop: "16px", padding: "10px 14px", background: "#0f172a", borderRadius: "6px", border: "1px solid #1e293b" }}>
              <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, marginBottom: "6px" }}>참고: 공식 전망</div>
              <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.8" }}>
                • <strong style={{ color: "#a5b4fc" }}>한국은행</strong> 2026 CPI 전망: 2.2% (3월 수정, 유가 $80대 중반 가정)<br />
                • <strong style={{ color: "#a5b4fc" }}>Fed</strong> 2026 Core PCE 전망: ~2.8% (FOMC 3/19)<br />
                • <strong style={{ color: "#a5b4fc" }}>EIA</strong> Brent 전망: $95+ 단기 → 3Q26 $80 이하 → 연말 $70 (분쟁 해소 가정)
              </div>
            </div>
          </div>
        )}

        {/* ═══ 탭: 민감도 매트릭스 ═══ */}
        {tab === "sensitivity" && sensitivity && (
          <div style={S.card}>
            <div style={S.label}>{params.label} 민감도 — 연말 CPI Y-Y (%){country === "KR" ? " · 유가 × 환율" : ""}</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, textAlign: "left" }}>WTI{country === "KR" ? " \\ USDKRW" : ""}</th>
                    {fxRange.map(fx => <th key={fx} style={S.th}>{country === "KR" ? `₩${fx}` : "—"}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {oilRange.map((oil, oi) => (
                    <tr key={oil}>
                      <td style={{ ...S.td(false), textAlign: "left", fontWeight: 600 }}>${oil}</td>
                      {sensitivity[oi].map((r, fi) => {
                        const v = r.yearEndYY;
                        const isBase = oil === oilScenario && (country !== "KR" || fxRange[fi] === fxScenario);
                        return (
                          <td key={fi} style={{
                            ...S.td(isBase), color: yyColor(v), fontWeight: isBase ? 700 : 400,
                            background: isBase ? "#312e8144" : "transparent",
                            outline: isBase ? "1px solid #6366f1" : "none",
                          }}>
                            {v.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {country === "KR" && (
              <>
                <div style={{ ...S.label, marginTop: "20px" }}>{params.label} 민감도 — 연평균 CPI Y-Y (%)</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ ...S.th, textAlign: "left" }}>WTI \ USDKRW</th>
                        {fxRange.map(fx => <th key={fx} style={S.th}>₩{fx}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {oilRange.map((oil, oi) => (
                        <tr key={oil}>
                          <td style={{ ...S.td(false), textAlign: "left", fontWeight: 600 }}>${oil}</td>
                          {sensitivity[oi].map((r, fi) => {
                            const v = r.annualAvgYY;
                            const isBase = oil === oilScenario && fxRange[fi] === fxScenario;
                            return (
                              <td key={fi} style={{ ...S.td(isBase), color: yyColor(v), fontWeight: isBase ? 700 : 400 }}>
                                {v.toFixed(2)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ 탭: 모델 설명 ═══ */}
        {tab === "params" && (
          <div style={S.card}>
            <div style={S.label}>투사 모델 v2.1 — 수정 사항 및 파라미터</div>
            <div style={{ fontSize: "13px", lineHeight: "1.9", color: "#94a3b8" }}>
              <p style={{ color: "#e2e8f0", fontWeight: 600, marginBottom: "8px" }}>
                ✅ v2.1 수정 내역 (v2.0 대비)
              </p>
              <div style={{ background: "#0f172a", padding: "12px", borderRadius: "6px", fontSize: "12px", margin: "8px 0", lineHeight: "2" }}>
                <strong style={{ color: "#22c55e" }}>1. 전가율 하향</strong><br />
                &nbsp;&nbsp;한국: 60% → <strong style={{ color: "#a5b4fc" }}>38%</strong> (유류세 한시인하, 전기/가스 원가 미연동 반영)<br />
                &nbsp;&nbsp;미국: 65% → <strong style={{ color: "#a5b4fc" }}>55%</strong> (일부 정책 버퍼 반영)<br /><br />
                <strong style={{ color: "#22c55e" }}>2. 스무딩 전환</strong><br />
                &nbsp;&nbsp;실현 유가 → 시나리오 유가를 <strong style={{ color: "#a5b4fc" }}>3개월에 걸쳐 선형 보간</strong><br />
                &nbsp;&nbsp;(기존: 계단식 즉시 전환 → 1개월 만에 31% 점프 발생)<br /><br />
                <strong style={{ color: "#22c55e" }}>3. 기저 데이터 보정</strong><br />
                &nbsp;&nbsp;2025 WTI: EIA/Statista 실제 월평균 반영 (Jan $74 ~ Dec $60)<br />
                &nbsp;&nbsp;2025 USDKRW: x-rates.com 실제 월평균 반영 (Jan 1455 ~ Dec 1466)<br /><br />
                <strong style={{ color: "#22c55e" }}>4. 시차 구조 조정</strong><br />
                &nbsp;&nbsp;한국: 3개월→<strong style={{ color: "#a5b4fc" }}>4개월</strong> 분산 (한국이 미국보다 전가 느림)
              </div>

              <p style={{ marginTop: "16px" }}>
                <strong style={{ color: "#c7d2fe" }}>파라미터 ({params.label}):</strong>
              </p>
              <table style={{ borderCollapse: "collapse", marginTop: "4px" }}>
                <tbody>
                  {[
                    ["에너지 CPI 가중치", `${(params.energy_weight * 100).toFixed(1)}%`],
                    ["유가 전가율", `${(params.oil_passthrough * 100)}%`],
                    ["유가 시차 구조", params.oil_lag.map((v, i) => `t${i > 0 ? `-${i}` : ""}: ${(v * 100)}%`).join(", ")],
                    ["스무딩 전환", "유가 3개월 / 환율 2개월 선형보간"],
                    ["환율 전가율", `${(params.fx_passthrough * 100)}%`],
                    ["환율 시차 구조", params.fx_lag.length > 0 ? params.fx_lag.map((v, i) => `t${i > 0 ? `-${i}` : ""}: ${(v * 100)}%`).join(", ") : "N/A"],
                  ].map(([k, v], i) => (
                    <tr key={i}>
                      <td style={{ padding: "4px 12px 4px 0", fontSize: "12px", color: "#64748b" }}>{k}</td>
                      <td style={{ padding: "4px 0", fontSize: "12px", fontFamily: "monospace", color: "#a5b4fc" }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p style={{ marginTop: "16px", padding: "10px", background: "#1e1b4b33", borderRadius: "6px", border: "1px solid #312e81", fontSize: "12px" }}>
                ⚠️ <strong>한계:</strong> 에너지 직접효과 + 환율 1차효과만 반영. 2차효과(운송비→식품), 정부 보조금/유류세 변동,
                수요 변동에 따른 근원물가 변화는 비에너지 MoM 파라미터로 조정. BOK/Fed 전망과 교차 검증 권장.
              </p>
            </div>
          </div>
        )}

        {/* ═══ 기저 데이터 편집 ═══ */}
        {showDataEdit && (
          <div style={{ ...S.card, marginTop: "8px" }}>
            <div style={{ ...S.label, marginBottom: "12px" }}>기저 데이터 편집 — 새 CPI/유가 발표 시 업데이트</div>
            {[
              { label: `${params.label} 2025 CPI (${params.unit})`, data: cpi2025, setter: country === "KR" ? setKrCpi2025 : setUsCpi2025, step: "0.01" },
              { label: `${params.label} 2026 실현 CPI (미발표=비우기)`, data: cpi2026Realized, setter: country === "KR" ? setKrCpi2026 : setUsCpi2026, step: "0.01", isRealized: true },
              { label: "2025 WTI ($/bbl)", data: oil2025, setter: setOil2025, step: "1" },
              { label: "2026 실현 WTI (미래=비우기)", data: oil2026, setter: setOil2026, step: "1", isRealized: true },
              ...(country === "KR" ? [
                { label: "2025 USDKRW", data: fx2025, setter: setFx2025, step: "1" },
                { label: "2026 실현 USDKRW (미래=비우기)", data: fx2026, setter: setFx2026, step: "1", isRealized: true },
              ] : []),
            ].map((row, ri) => (
              <div key={ri} style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>{row.label}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "4px" }}>
                  {MONTHS_EN.map((m, i) => (
                    <div key={i}>
                      <div style={{ fontSize: "9px", color: "#475569", textAlign: "center" }}>{m}</div>
                      <input
                        type="number" step={row.step}
                        style={{ ...S.input, fontSize: "11px", padding: "4px", textAlign: "center",
                          borderColor: row.isRealized && row.data[i] !== null ? "#6366f1" : "#334155" }}
                        value={row.data[i] !== null ? row.data[i] : ""}
                        onChange={e => updateArr(row.setter, i, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ 푸터 ═══ */}
        <div style={{ marginTop: "24px", padding: "12px 0", borderTop: "1px solid #1e293b", fontSize: "11px", color: "#475569", textAlign: "center" }}>
          Oil → CPI Projection Monitor v2.1 · 시차+스무딩 모델 · 늑대무리원정단<br />
          기저 데이터: 2026.02 CPI 발표 기준 · 2025 유가/환율: EIA·x-rates 실제 월평균 · 전가율: KR 38% / US 55%
        </div>
      </div>
    </div>
  );
}
