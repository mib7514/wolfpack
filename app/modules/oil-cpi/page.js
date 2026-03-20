"use client";

import { useState, useMemo, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// 기저 데이터: 2025 월별 CPI 지수 (2020=100 기준, 한국 / 1982-84=100, 미국)
// 관리자가 수정 가능. 새 데이터 발표 시 업데이트.
// ═══════════════════════════════════════════════════════════════
const DEFAULT_KR_2025 = [115.72, 116.08, 115.50, 115.70, 115.30, 115.50, 115.80, 116.10, 116.30, 116.70, 117.10, 117.57];
const DEFAULT_US_2025 = [310.5, 311.0, 312.0, 313.0, 313.5, 314.0, 314.8, 315.5, 316.0, 316.5, 317.5, 318.4];

// 2026 실현값 (발표된 월만 입력, 나머지 null)
const DEFAULT_KR_2026 = [118.03, 118.40, null, null, null, null, null, null, null, null, null, null];
const DEFAULT_US_2026 = [317.9, 318.5, null, null, null, null, null, null, null, null, null, null];

// 2025 월별 유가(WTI $/bbl) 및 환율(USDKRW) - 기저효과 계산용
const DEFAULT_OIL_2025 = [75, 72, 68, 62, 60, 70, 73, 68, 70, 72, 68, 70];
const DEFAULT_FX_2025 = [1450, 1440, 1460, 1370, 1380, 1390, 1380, 1350, 1330, 1360, 1400, 1470];

// 2026 실현 유가/환율 (발표된 월만)
const DEFAULT_OIL_2026 = [73, 72, null, null, null, null, null, null, null, null, null, null];
const DEFAULT_FX_2026 = [1450, 1440, null, null, null, null, null, null, null, null, null, null];

const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ═══════════════════════════════════════════════════════════════
// 패스스루 파라미터
// ═══════════════════════════════════════════════════════════════
const PARAMS = {
  KR: {
    energy_weight: 0.075,      // CPI 내 에너지 가중치 ~7.5%
    oil_passthrough: 0.60,     // 유가 변동의 60%가 에너지CPI에 반영
    oil_lag: [0.40, 0.35, 0.25], // t, t-1, t-2 월 가중치
    fx_passthrough: 0.03,      // 환율 변동의 3%가 비에너지CPI에 반영
    fx_lag: [0.25, 0.25, 0.25, 0.25], // 4개월 분산
    label: "한국",
    unit: "2020=100",
  },
  US: {
    energy_weight: 0.073,
    oil_passthrough: 0.65,
    oil_lag: [0.50, 0.35, 0.15],
    fx_passthrough: 0.0,       // 미국은 FX 패스스루 무시
    fx_lag: [],
    label: "미국",
    unit: "1982-84=100",
  },
};

// ═══════════════════════════════════════════════════════════════
// 시나리오 프리셋
// ═══════════════════════════════════════════════════════════════
const SCENARIO_PRESETS = [
  { name: "🕊️ 평화 (유가 하락)", oil: 70, fx: 1380, desc: "이란 분쟁 해소, 유가 70$ 복귀" },
  { name: "📊 기본 (현 수준 유지)", oil: 95, fx: 1430, desc: "현재 유가/환율 수준 지속" },
  { name: "🔥 긴장 지속", oil: 110, fx: 1470, desc: "호르무즈 긴장 지속, 유가 110$" },
  { name: "💥 위기 심화", oil: 130, fx: 1520, desc: "해협 봉쇄 장기화, 유가 130$" },
];

// ═══════════════════════════════════════════════════════════════
// CPI 투사 엔진
// ═══════════════════════════════════════════════════════════════
function projectCPI({ cpi2025, cpi2026Realized, oil2025, fx2025, oil2026Realized, fx2026Realized, oilScenario, fxScenario, nonEnergyMom, params }) {
  const n = 12;
  // 2026 유가/환율 배열 구성 (실현 + 시나리오)
  const oil2026 = Array.from({ length: n }, (_, i) =>
    oil2026Realized[i] !== null ? oil2026Realized[i] : oilScenario
  );
  const fx2026 = Array.from({ length: n }, (_, i) =>
    fx2026Realized[i] !== null ? fx2026Realized[i] : fxScenario
  );

  // CPI 지수 투사
  const cpi2026 = [...cpi2026Realized];
  const firstNull = cpi2026.findIndex(v => v === null);

  if (firstNull === -1) {
    // 모든 월 실현됨
    const yy = cpi2026.map((v, i) => ((v / cpi2025[i]) - 1) * 100);
    const avgCpi2026 = cpi2026.reduce((a, b) => a + b, 0) / n;
    const avgCpi2025 = cpi2025.reduce((a, b) => a + b, 0) / n;
    return { cpi2026, yy, yearEndYY: yy[11], annualAvgYY: ((avgCpi2026 / avgCpi2025) - 1) * 100 };
  }

  for (let m = firstNull; m < n; m++) {
    // 에너지 MoM 기여도 계산
    let energyMom = 0;
    for (let lag = 0; lag < params.oil_lag.length; lag++) {
      const mLag = m - lag;
      if (mLag >= 0) {
        // 유가(원화) MoM 변동
        const oilKrwCur = oil2026[mLag] * fx2026[mLag];
        const oilKrwPrev = mLag > 0
          ? oil2026[mLag - 1] * fx2026[mLag - 1]
          : oil2025[11] * fx2025[11]; // 전년 12월
        const oilMom = oilKrwPrev > 0 ? (oilKrwCur / oilKrwPrev - 1) : 0;
        energyMom += params.oil_lag[lag] * oilMom * params.oil_passthrough;
      }
    }
    const energyContrib = params.energy_weight * energyMom;

    // 환율 → 비에너지 MoM 기여도 (한국만)
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

  // Y-Y 계산
  const yy = cpi2026.map((v, i) => ((v / cpi2025[i]) - 1) * 100);
  const avgCpi2026 = cpi2026.reduce((a, b) => a + b, 0) / n;
  const avgCpi2025 = cpi2025.reduce((a, b) => a + b, 0) / n;

  return {
    cpi2026: cpi2026.map(v => Math.round(v * 100) / 100),
    yy: yy.map(v => Math.round(v * 100) / 100),
    yearEndYY: Math.round(yy[11] * 100) / 100,
    annualAvgYY: Math.round(((avgCpi2026 / avgCpi2025) - 1) * 10000) / 100,
  };
}

// ═══════════════════════════════════════════════════════════════
// 민감도 매트릭스 계산
// ═══════════════════════════════════════════════════════════════
function calcSensitivity({ cpi2025, cpi2026Realized, oil2025, fx2025, oil2026Realized, fx2026Realized, nonEnergyMom, params, oilRange, fxRange }) {
  const results = [];
  for (const oil of oilRange) {
    const row = [];
    for (const fx of fxRange) {
      const r = projectCPI({
        cpi2025, cpi2026Realized, oil2025, fx2025,
        oil2026Realized, fx2026Realized,
        oilScenario: oil, fxScenario: fx,
        nonEnergyMom, params,
      });
      row.push(r);
    }
    results.push(row);
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════
// 메인 컴포넌트
// ═══════════════════════════════════════════════════════════════
export default function OilCPIMonitor() {
  const [country, setCountry] = useState("KR");
  const [oilScenario, setOilScenario] = useState(95);
  const [fxScenario, setFxScenario] = useState(1430);
  const [nonEnergyMom, setNonEnergyMom] = useState(0.15); // 비에너지 MoM %
  const [showDataEdit, setShowDataEdit] = useState(false);
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [tab, setTab] = useState("projection"); // projection | sensitivity | params

  // 편집 가능한 기저 데이터
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

  // ─── 메인 투사 ───
  const projection = useMemo(() => {
    return projectCPI({
      cpi2025, cpi2026Realized, oil2025, fx2025,
      oil2026Realized: oil2026, fx2026Realized: fx2026,
      oilScenario, fxScenario, nonEnergyMom, params,
    });
  }, [cpi2025, cpi2026Realized, oil2025, fx2025, oil2026, fx2026, oilScenario, fxScenario, nonEnergyMom, params]);

  // ─── 멀티 시나리오 ───
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

  // ─── 민감도 매트릭스 ───
  const oilRange = [70, 80, 90, 95, 100, 110, 120, 130];
  const fxRange = country === "KR" ? [1350, 1400, 1430, 1470, 1520] : [100]; // US는 FX 무관
  const sensitivity = useMemo(() => {
    if (!showSensitivity) return null;
    return calcSensitivity({
      cpi2025, cpi2026Realized, oil2025, fx2025,
      oil2026Realized: oil2026, fx2026Realized: fx2026,
      nonEnergyMom, params, oilRange,
      fxRange: country === "KR" ? fxRange : [1],
    });
  }, [showSensitivity, cpi2025, cpi2026Realized, oil2025, fx2025, oil2026, fx2026, nonEnergyMom, params, country]);

  // 실현 월 수
  const realizedCount = cpi2026Realized.filter(v => v !== null).length;

  // YY 차트의 max/min
  const yyMin = Math.min(...projection.yy) - 0.3;
  const yyMax = Math.max(...projection.yy) + 0.3;

  // 색상 함수
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
    td: (highlight) => ({
      padding: "5px 8px", fontSize: "12px", textAlign: "center", fontFamily: "monospace",
      color: highlight ? "#f1f5f9" : "#94a3b8", borderBottom: "1px solid #0f172a",
      background: highlight ? "#1e1b4b22" : "transparent",
    }),
    bigNum: { fontSize: "28px", fontWeight: 700, fontFamily: "monospace", letterSpacing: "-1px" },
    tag: (color) => ({
      display: "inline-block", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600,
      background: color + "20", color: color, marginLeft: "8px",
    }),
  };

  // ─── 데이터 편집 핸들러 ───
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
            <p style={S.subtitle}>유가/환율 시나리오 → CPI Y-Y 연말값 · 연평균값 투사 (시차 반영 모델)</p>
          </div>
          <a href="/" style={{ fontSize: "12px", color: "#64748b", textDecoration: "none" }}>← 컨트롤타워</a>
        </div>

        {/* 국가 전환 */}
        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <button style={S.btn(country === "KR")} onClick={() => setCountry("KR")}>🇰🇷 한국</button>
          <button style={S.btn(country === "US")} onClick={() => setCountry("US")}>🇺🇸 미국</button>
          <div style={{ flex: 1 }} />
          <button
            style={{ ...S.btn(false), fontSize: "11px" }}
            onClick={() => setShowDataEdit(!showDataEdit)}
          >
            {showDataEdit ? "📊 데이터 편집 닫기" : "✏️ 기저 데이터 편집"}
          </button>
        </div>
      </div>

      <div style={S.body}>
        {/* ═══ 핵심 요약 카드 ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          {[
            { label: "연말 CPI Y-Y", value: projection.yearEndYY, suffix: "%" },
            { label: "연평균 CPI Y-Y", value: projection.annualAvgYY, suffix: "%" },
            { label: "유가 시나리오", value: oilScenario, suffix: " $/bbl" },
            { label: country === "KR" ? "환율 시나리오" : "Energy Wt.", value: country === "KR" ? fxScenario : (params.energy_weight * 100).toFixed(1), suffix: country === "KR" ? " ₩/$" : "%" },
          ].map((item, i) => (
            <div key={i} style={S.card}>
              <div style={S.label}>{item.label}</div>
              <div style={{ ...S.bigNum, color: i < 2 ? yyColor(item.value) : "#e2e8f0" }}>
                {typeof item.value === "number" ? item.value.toFixed(i < 2 ? 2 : 0) : item.value}
                <span style={{ fontSize: "14px", fontWeight: 400, color: "#64748b" }}>{item.suffix}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ═══ 시나리오 입력 ═══ */}
        <div style={S.card}>
          <div style={S.label}>시나리오 입력</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "16px", marginBottom: "12px" }}>
            {SCENARIO_PRESETS.map((s, i) => (
              <button
                key={i}
                style={S.scenarioBtn(oilScenario === s.oil && fxScenario === s.fx)}
                onClick={() => { setOilScenario(s.oil); setFxScenario(s.fx); }}
              >
                <div style={{ fontWeight: 600, marginBottom: "2px" }}>{s.name}</div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>WTI ${s.oil} · ₩{s.fx}</div>
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>WTI 유가 ($/bbl)</div>
              <input
                type="number" style={S.input} value={oilScenario}
                onChange={e => setOilScenario(Number(e.target.value))}
              />
              <input
                type="range" min="50" max="150" step="5" value={oilScenario}
                onChange={e => setOilScenario(Number(e.target.value))}
                style={{ width: "100%", marginTop: "4px", accentColor: "#6366f1" }}
              />
            </div>
            {country === "KR" && (
              <div>
                <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>USDKRW 환율</div>
                <input
                  type="number" style={S.input} value={fxScenario}
                  onChange={e => setFxScenario(Number(e.target.value))}
                />
                <input
                  type="range" min="1250" max="1600" step="10" value={fxScenario}
                  onChange={e => setFxScenario(Number(e.target.value))}
                  style={{ width: "100%", marginTop: "4px", accentColor: "#6366f1" }}
                />
              </div>
            )}
            <div>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>비에너지 MoM 추세 (%)</div>
              <input
                type="number" step="0.01" style={S.input} value={nonEnergyMom}
                onChange={e => setNonEnergyMom(Number(e.target.value))}
              />
              <input
                type="range" min="0" max="0.4" step="0.01" value={nonEnergyMom}
                onChange={e => setNonEnergyMom(Number(e.target.value))}
                style={{ width: "100%", marginTop: "4px", accentColor: "#6366f1" }}
              />
            </div>
          </div>
        </div>

        {/* ═══ 탭 전환 ═══ */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <button style={S.btn(tab === "projection")} onClick={() => setTab("projection")}>📈 월별 투사</button>
          <button style={S.btn(tab === "scenario")} onClick={() => setTab("scenario")}>🔀 시나리오 비교</button>
          <button style={S.btn(tab === "sensitivity")} onClick={() => { setTab("sensitivity"); setShowSensitivity(true); }}>📊 민감도 매트릭스</button>
          <button style={S.btn(tab === "params")} onClick={() => setTab("params")}>⚙️ 모델 설명</button>
        </div>

        {/* ═══ 탭: 월별 투사 ═══ */}
        {tab === "projection" && (
          <>
            {/* CPI Y-Y 월별 바 차트 */}
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
                  <span style={{ display: "inline-block", width: "12px", height: "8px", background: "#6366f1", borderRadius: "2px", marginRight: "4px" }} />
                  실현
                </span>
                <span style={{ fontSize: "10px", color: "#64748b" }}>
                  <span style={{ display: "inline-block", width: "12px", height: "8px", background: "repeating-linear-gradient(135deg, #6366f140, #6366f140 2px, #6366f120 2px, #6366f120 4px)", border: "1px dashed #6366f160", borderRadius: "2px", marginRight: "4px" }} />
                  투사
                </span>
              </div>
            </div>

            {/* 월별 상세 테이블 */}
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
                        <td key={i} style={{ ...S.td(i < realizedCount), fontWeight: i < realizedCount ? 600 : 400 }}>
                          {v.toFixed(1)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ ...S.td(false), textAlign: "left", fontWeight: 600, fontSize: "11px", color: "#eab308" }}>Y-Y %</td>
                      {projection.yy.map((v, i) => (
                        <td key={i} style={{ ...S.td(false), color: yyColor(v), fontWeight: 600 }}>
                          {v.toFixed(2)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ ...S.td(false), textAlign: "left", fontWeight: 600, fontSize: "11px" }}>유가 $/bbl</td>
                      {Array.from({ length: 12 }, (_, i) => oil2026[i] !== null ? oil2026[i] : oilScenario).map((v, i) => (
                        <td key={i} style={S.td(false)}>{v}</td>
                      ))}
                    </tr>
                    {country === "KR" && (
                      <tr>
                        <td style={{ ...S.td(false), textAlign: "left", fontWeight: 600, fontSize: "11px" }}>USDKRW</td>
                        {Array.from({ length: 12 }, (_, i) => fx2026[i] !== null ? fx2026[i] : fxScenario).map((v, i) => (
                          <td key={i} style={S.td(false)}>{v}</td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
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
                    <td style={{ ...S.td(false), color: yyColor(s.result.yy[5]) }}>
                      {s.result.yy[5].toFixed(2)}%
                    </td>
                    <td style={{ ...S.td(false), color: yyColor(s.result.yy[8]) }}>
                      {s.result.yy[8].toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 시나리오별 월별 YY 비교 차트 */}
            <div style={{ marginTop: "20px" }}>
              <div style={S.label}>시나리오별 월별 CPI Y-Y 경로</div>
              <div style={{ position: "relative", height: "200px", marginTop: "8px" }}>
                {/* Y축 눈금 */}
                {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0].map(v => {
                  const allYY = multiScenario.flatMap(s => s.result.yy);
                  const chartMin = Math.min(...allYY, v) - 0.3;
                  const chartMax = Math.max(...allYY, v) + 0.3;
                  const top = ((chartMax - v) / (chartMax - chartMin)) * 200;
                  if (top < 0 || top > 200) return null;
                  return (
                    <div key={v} style={{ position: "absolute", top: `${top}px`, left: 0, right: 0, borderTop: "1px solid #1e293b", fontSize: "9px", color: "#475569" }}>
                      {v.toFixed(1)}%
                    </div>
                  );
                })}
                {/* 라인들 */}
                <svg width="100%" height="200" style={{ position: "absolute", top: 0, left: "30px", width: "calc(100% - 30px)" }}>
                  {multiScenario.map((s, si) => {
                    const allYY = multiScenario.flatMap(sc => sc.result.yy);
                    const chartMin = Math.min(...allYY) - 0.3;
                    const chartMax = Math.max(...allYY) + 0.3;
                    const colors = ["#22c55e", "#6366f1", "#f97316", "#ef4444"];
                    const points = s.result.yy.map((v, i) => {
                      const x = (i / 11) * 100;
                      const y = ((chartMax - v) / (chartMax - chartMin)) * 200;
                      return `${x}%,${y}`;
                    }).join(" ");
                    return (
                      <polyline key={si} points={points} fill="none" stroke={colors[si]}
                        strokeWidth="2" strokeDasharray={si > 0 ? "4 2" : "none"} opacity={0.8} />
                    );
                  })}
                </svg>
              </div>
              <div style={{ display: "flex", gap: "16px", marginTop: "8px", paddingLeft: "30px" }}>
                {multiScenario.map((s, i) => {
                  const colors = ["#22c55e", "#6366f1", "#f97316", "#ef4444"];
                  return (
                    <span key={i} style={{ fontSize: "10px", color: colors[i] }}>
                      ● {s.name.replace(/[^\w가-힣 ]/g, "").trim()}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ 탭: 민감도 매트릭스 ═══ */}
        {tab === "sensitivity" && sensitivity && (
          <div style={S.card}>
            <div style={S.label}>
              {params.label} 민감도 매트릭스 — 연말 CPI Y-Y (%)
              {country === "KR" && <span style={{ color: "#475569", fontWeight: 400 }}> · 유가 × 환율</span>}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, textAlign: "left" }}>WTI \ {country === "KR" ? "USDKRW" : ""}</th>
                    {fxRange.map(fx => (
                      <th key={fx} style={S.th}>{country === "KR" ? `₩${fx}` : "—"}</th>
                    ))}
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
                            border: isBase ? "1px solid #6366f1" : "none",
                            borderBottom: "1px solid #0f172a",
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
                <div style={{ ...S.label, marginTop: "20px" }}>
                  {params.label} 민감도 매트릭스 — 연평균 CPI Y-Y (%)
                </div>
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
                              <td key={fi} style={{
                                ...S.td(isBase), color: yyColor(v), fontWeight: isBase ? 700 : 400,
                                background: isBase ? "#312e8144" : "transparent",
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
              </>
            )}
          </div>
        )}

        {/* ═══ 탭: 모델 설명 ═══ */}
        {tab === "params" && (
          <div style={S.card}>
            <div style={S.label}>투사 모델 구조 및 파라미터</div>
            <div style={{ fontSize: "13px", lineHeight: "1.9", color: "#94a3b8" }}>
              <p style={{ color: "#e2e8f0", fontWeight: 600, marginBottom: "8px" }}>
                ✅ 수정된 모델: 시차(lag) 반영 CPI 월별 투사
              </p>
              <p>
                <strong style={{ color: "#c7d2fe" }}>핵심 변경:</strong> 현재 CPI에 현재 유가가 이미 반영됐다는 가정을 폐기.
                대신 2025 월별 CPI(기저) + 2026 실현 CPI를 기반으로, 유가/환율 시나리오를 <em>시차를 두고</em> 남은 월의 CPI에 반영하여 투사.
              </p>
              <p style={{ marginTop: "12px" }}>
                <strong style={{ color: "#c7d2fe" }}>월별 CPI 지수 투사 공식:</strong>
              </p>
              <div style={{ background: "#0f172a", padding: "12px", borderRadius: "6px", fontFamily: "monospace", fontSize: "12px", margin: "8px 0" }}>
                CPI(m) = CPI(m-1) × (1 + 비에너지_MoM + 에너지_기여도 + 환율_기여도)<br /><br />
                에너지_기여도 = 에너지가중치 × Σᵢ lag(i) × [유가원화(m-i)/유가원화(m-i-1) - 1] × 전가율<br /><br />
                유가원화 = WTI × USDKRW
              </div>
              <p style={{ marginTop: "12px" }}>
                <strong style={{ color: "#c7d2fe" }}>파라미터 ({params.label}):</strong>
              </p>
              <table style={{ borderCollapse: "collapse", marginTop: "4px" }}>
                <tbody>
                  {[
                    ["에너지 CPI 가중치", `${(params.energy_weight * 100).toFixed(1)}%`],
                    ["유가 전가율", `${(params.oil_passthrough * 100)}%`],
                    ["유가 시차 구조", params.oil_lag.map((v, i) => `t${i > 0 ? `-${i}` : ""}: ${(v * 100)}%`).join(", ")],
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
              <p style={{ marginTop: "16px" }}>
                <strong style={{ color: "#c7d2fe" }}>출력 지표:</strong>
              </p>
              <div style={{ fontSize: "12px", lineHeight: "2" }}>
                • <strong>연말 CPI Y-Y</strong> = CPI(2026.12) / CPI(2025.12) - 1<br />
                • <strong>연평균 CPI Y-Y</strong> = avg(CPI 2026 전월) / avg(CPI 2025 전월) - 1<br />
                • 실현 월은 실제 발표값 사용, 미래 월만 투사<br />
                • 비에너지 MoM은 사용자 가정 (기본 0.15%/월 ≈ 연 1.8%)
              </div>

              <p style={{ marginTop: "16px", padding: "10px", background: "#1e1b4b33", borderRadius: "6px", border: "1px solid #312e81", fontSize: "12px" }}>
                ⚠️ <strong>한계:</strong> 이 모델은 에너지 직접효과와 환율 1차효과만 반영. 2차효과(운송비→식품가격 등),
                정부 보조금/유류세 조정, 수요 변동에 따른 근원물가 변화는 비에너지 MoM 추세 조정으로 대응.
                BOK/Fed 전망과 교차 검증 권장.
              </p>
            </div>
          </div>
        )}

        {/* ═══ 기저 데이터 편집 (접이식) ═══ */}
        {showDataEdit && (
          <div style={{ ...S.card, marginTop: "8px" }}>
            <div style={{ ...S.label, marginBottom: "12px" }}>기저 데이터 편집 — 새 CPI 발표 시 업데이트</div>

            {/* 2025 CPI */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>
                {params.label} 2025 월별 CPI 지수 ({params.unit})
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "4px" }}>
                {MONTHS_EN.map((m, i) => (
                  <div key={i}>
                    <div style={{ fontSize: "9px", color: "#475569", textAlign: "center" }}>{m}</div>
                    <input
                      type="number" step="0.01"
                      style={{ ...S.input, fontSize: "11px", padding: "4px", textAlign: "center" }}
                      value={cpi2025[i] || ""}
                      onChange={e => updateArr(country === "KR" ? setKrCpi2025 : setUsCpi2025, i, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 2026 CPI (실현) */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>
                {params.label} 2026 실현 CPI 지수 (미발표월은 비워두기)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "4px" }}>
                {MONTHS_EN.map((m, i) => (
                  <div key={i}>
                    <div style={{ fontSize: "9px", color: "#475569", textAlign: "center" }}>{m}</div>
                    <input
                      type="number" step="0.01"
                      style={{ ...S.input, fontSize: "11px", padding: "4px", textAlign: "center", borderColor: cpi2026Realized[i] !== null ? "#6366f1" : "#334155" }}
                      value={cpi2026Realized[i] !== null ? cpi2026Realized[i] : ""}
                      onChange={e => updateArr(country === "KR" ? setKrCpi2026 : setUsCpi2026, i, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 2025 유가 */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>
                2025 월별 WTI 유가 ($/bbl)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "4px" }}>
                {MONTHS_EN.map((m, i) => (
                  <div key={i}>
                    <div style={{ fontSize: "9px", color: "#475569", textAlign: "center" }}>{m}</div>
                    <input
                      type="number"
                      style={{ ...S.input, fontSize: "11px", padding: "4px", textAlign: "center" }}
                      value={oil2025[i] || ""}
                      onChange={e => updateArr(setOil2025, i, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 2025 환율 */}
            {country === "KR" && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>
                  2025 월별 USDKRW 환율
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "4px" }}>
                  {MONTHS_EN.map((m, i) => (
                    <div key={i}>
                      <div style={{ fontSize: "9px", color: "#475569", textAlign: "center" }}>{m}</div>
                      <input
                        type="number"
                        style={{ ...S.input, fontSize: "11px", padding: "4px", textAlign: "center" }}
                        value={fx2025[i] || ""}
                        onChange={e => updateArr(setFx2025, i, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2026 실현 유가/환율 */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>
                2026 실현 WTI 유가 (미래월은 비워두기 → 시나리오 값 사용)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "4px" }}>
                {MONTHS_EN.map((m, i) => (
                  <div key={i}>
                    <div style={{ fontSize: "9px", color: "#475569", textAlign: "center" }}>{m}</div>
                    <input
                      type="number"
                      style={{ ...S.input, fontSize: "11px", padding: "4px", textAlign: "center", borderColor: oil2026[i] !== null ? "#22c55e" : "#334155" }}
                      value={oil2026[i] !== null ? oil2026[i] : ""}
                      onChange={e => updateArr(setOil2026, i, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {country === "KR" && (
              <div>
                <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>
                  2026 실현 USDKRW (미래월은 비워두기)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "4px" }}>
                  {MONTHS_EN.map((m, i) => (
                    <div key={i}>
                      <div style={{ fontSize: "9px", color: "#475569", textAlign: "center" }}>{m}</div>
                      <input
                        type="number"
                        style={{ ...S.input, fontSize: "11px", padding: "4px", textAlign: "center", borderColor: fx2026[i] !== null ? "#22c55e" : "#334155" }}
                        value={fx2026[i] !== null ? fx2026[i] : ""}
                        onChange={e => updateArr(setFx2026, i, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ 푸터 ═══ */}
        <div style={{ marginTop: "24px", padding: "12px 0", borderTop: "1px solid #1e293b", fontSize: "11px", color: "#475569", textAlign: "center" }}>
          Oil → CPI Projection Monitor v2.0 · 시차 반영 모델 · 늑대무리원정단
          <br />
          기저 데이터 최종 업데이트: 2026.02 CPI 기준 · 모델 한계: 에너지 직접효과 + 환율 1차효과만 반영
        </div>
      </div>
    </div>
  );
}
