"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ComposedChart
} from "recharts";

// ─── Default macro data (verified Mar 2026) ───
// US rate = Fed Funds upper bound, KR rate = BOK base rate
// Brent oil ~$93 (Iran-US war, Hormuz disruption)
const DEFAULT_DATA = {
  us: {
    currentCPI: 2.4,
    currentRate: 3.75,
    energyWeightDirect: 0.075,
    energyWeightIndirect: 0.045,
    oilPassThrough: { "1y": 0.038, "3y": 0.035, "5y": 0.032, "10y": 0.028 },
    indirectMultiplier: { "1y": 1.55, "3y": 1.65, "5y": 1.70, "10y": 1.80 },
    history: [
      // Fed: 4.25-4.50 → 4.50-4.75(Feb) → 4.75-5.00(Mar) → 5.00-5.25(May) → 5.25-5.50(Jul)
      { date: "2023-01", cpi: 6.4, rate: 4.50, oil: 84 },
      { date: "2023-04", cpi: 4.9, rate: 5.00, oil: 80 },
      { date: "2023-07", cpi: 3.2, rate: 5.50, oil: 80 },
      { date: "2023-10", cpi: 3.2, rate: 5.50, oil: 90 },
      // Fed held 5.25-5.50 through Sep 2024
      { date: "2024-01", cpi: 3.1, rate: 5.50, oil: 80 },
      { date: "2024-04", cpi: 3.4, rate: 5.50, oil: 88 },
      { date: "2024-07", cpi: 2.9, rate: 5.50, oil: 82 },
      // Sep -50bp(5.00), Nov -25bp(4.75), Dec -25bp(4.50)
      { date: "2024-10", cpi: 2.6, rate: 5.00, oil: 73 },
      // 2025: Mar -25bp(4.25), Sep -25bp(4.00), Dec -25bp(3.75)
      { date: "2025-01", cpi: 3.0, rate: 4.50, oil: 76 },
      { date: "2025-04", cpi: 2.3, rate: 4.25, oil: 66 },
      { date: "2025-07", cpi: 2.5, rate: 4.25, oil: 65 },
      { date: "2025-10", cpi: 2.7, rate: 4.00, oil: 72 },
      { date: "2026-01", cpi: 2.4, rate: 3.75, oil: 67 },
    ],
  },
  kr: {
    currentCPI: 2.0,
    currentRate: 2.50,
    energyWeightDirect: 0.095,
    energyWeightIndirect: 0.055,
    oilPassThrough: { "1y": 0.045, "3y": 0.042, "5y": 0.038, "10y": 0.033 },
    indirectMultiplier: { "1y": 1.60, "3y": 1.70, "5y": 1.80, "10y": 1.90 },
    history: [
      // BOK held 3.50 through Sep 2024
      { date: "2023-01", cpi: 5.2, rate: 3.50, oil: 84 },
      { date: "2023-04", cpi: 3.7, rate: 3.50, oil: 80 },
      { date: "2023-07", cpi: 2.3, rate: 3.50, oil: 80 },
      { date: "2023-10", cpi: 3.8, rate: 3.50, oil: 90 },
      { date: "2024-01", cpi: 2.8, rate: 3.50, oil: 80 },
      { date: "2024-04", cpi: 2.9, rate: 3.50, oil: 88 },
      { date: "2024-07", cpi: 2.6, rate: 3.50, oil: 82 },
      // Oct -25bp(3.25), Nov -25bp(3.00)
      { date: "2024-10", cpi: 1.3, rate: 3.25, oil: 73 },
      // Feb 2025 -25bp(2.75), May 2025 -25bp(2.50), held since
      { date: "2025-01", cpi: 2.2, rate: 3.00, oil: 76 },
      { date: "2025-04", cpi: 2.1, rate: 2.75, oil: 66 },
      { date: "2025-07", cpi: 2.1, rate: 2.50, oil: 65 },
      { date: "2025-10", cpi: 2.4, rate: 2.50, oil: 72 },
      { date: "2026-01", cpi: 2.0, rate: 2.50, oil: 67 },
    ],
  },
  currentOilPrice: 93,
};

// ─── Styling constants ───
const COLORS = {
  bg: "#0a0e17",
  card: "#111827",
  cardBorder: "#1e293b",
  accent: "#f59e0b",
  accentDim: "#92400e",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  red: "#ef4444",
  green: "#10b981",
  purple: "#a855f7",
  text: "#e2e8f0",
  textDim: "#64748b",
  textMuted: "#475569",
  gridLine: "#1e293b",
};

const FONT = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

export default function OilCPIMonitor() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [timeframe, setTimeframe] = useState("3y");
  const [oilScenario, setOilScenario] = useState(data.currentOilPrice);
  const [includeIndirect, setIncludeIndirect] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);

  // ─── CPI Impact Calculation ───
  const calculateCPIImpact = useCallback(
    (country, oilPrice, tf, indirect) => {
      const c = data[country];
      const oilChange = ((oilPrice - data.currentOilPrice) / data.currentOilPrice) * 100;
      const passThrough = c.oilPassThrough[tf];
      let directImpact = (oilChange * passThrough);
      let totalImpact = directImpact;
      if (indirect) {
        totalImpact = directImpact * c.indirectMultiplier[tf];
      }
      return {
        directImpact: Math.round(directImpact * 100) / 100,
        indirectImpact: Math.round((totalImpact - directImpact) * 100) / 100,
        totalImpact: Math.round(totalImpact * 100) / 100,
        newCPI: Math.round((c.currentCPI + totalImpact) * 100) / 100,
        newRealRate: Math.round((c.currentRate - (c.currentCPI + totalImpact)) * 100) / 100,
        currentRealRate: Math.round((c.currentRate - c.currentCPI) * 100) / 100,
        oilChangePct: Math.round(oilChange * 10) / 10,
      };
    },
    [data]
  );

  const usImpact = useMemo(
    () => calculateCPIImpact("us", oilScenario, timeframe, includeIndirect),
    [oilScenario, timeframe, includeIndirect, calculateCPIImpact]
  );
  const krImpact = useMemo(
    () => calculateCPIImpact("kr", oilScenario, timeframe, includeIndirect),
    [oilScenario, timeframe, includeIndirect, calculateCPIImpact]
  );

  // ─── History-only chart data (no linear projection) ───
  const buildHistoryData = useCallback(
    (country) => {
      const c = data[country];
      return c.history.map((h) => ({
        date: h.date,
        cpi: h.cpi,
        rate: h.rate,
        realRate: Math.round((h.rate - h.cpi) * 100) / 100,
      }));
    },
    [data]
  );

  const usChartData = useMemo(() => buildHistoryData("us"), [buildHistoryData]);
  const krChartData = useMemo(() => buildHistoryData("kr"), [buildHistoryData]);

  // ─── AI Update ───
  const handleAIUpdate = async () => {
    setAiLoading(true);
    setAiStatus(null);
    try {
      const response = await fetch("/api/oil-cpi-update", { method: "POST" });
      if (!response.ok) throw new Error("API error");
      const parsed = await response.json();

      setData((prev) => ({
        ...prev,
        us: {
          ...prev.us,
          currentCPI: parsed.us_cpi ?? prev.us.currentCPI,
          currentRate: parsed.us_rate ?? prev.us.currentRate,
        },
        kr: {
          ...prev.kr,
          currentCPI: parsed.kr_cpi ?? prev.kr.currentCPI,
          currentRate: parsed.kr_rate ?? prev.kr.currentRate,
        },
        currentOilPrice: parsed.brent_oil ?? prev.currentOilPrice,
      }));
      setOilScenario(parsed.brent_oil ?? data.currentOilPrice);
      setAiStatus({ ok: true, msg: `Updated: ${parsed.notes || parsed.data_date}` });
    } catch (e) {
      console.error(e);
      setAiStatus({ ok: false, msg: "업데이트 실패 — 재시도 해주세요" });
    }
    setAiLoading(false);
  };

  // ─── Oil scenario presets ───
  const oilPresets = [
    { label: "$50", value: 50 },
    { label: "$60", value: 60 },
    { label: "$70", value: 70 },
    { label: "$80", value: 80 },
    { label: "$90", value: 90 },
    { label: "$100", value: 100 },
    { label: "$120", value: 120 },
  ];

  // ─── Render helpers ───
  const MetricCard = ({ label, value, unit, sub, color, small }) => (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${COLORS.cardBorder}`,
      borderRadius: 8,
      padding: small ? "10px 14px" : "14px 18px",
      minWidth: small ? 100 : 130,
    }}>
      <div style={{ fontSize: 10, color: COLORS.textDim, letterSpacing: 1, textTransform: "uppercase", fontFamily: FONT }}>
        {label}
      </div>
      <div style={{ fontSize: small ? 20 : 26, fontWeight: 700, color: color || COLORS.text, fontFamily: FONT, marginTop: 2 }}>
        {value}<span style={{ fontSize: 12, color: COLORS.textDim, marginLeft: 2 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2, fontFamily: FONT }}>{sub}</div>}
    </div>
  );

  const ImpactPanel = ({ country, impact, countryData, flag }) => {
    const cpiColor = impact.totalImpact > 0 ? COLORS.red : impact.totalImpact < 0 ? COLORS.green : COLORS.text;
    const realRateColor = impact.newRealRate > 0 ? COLORS.green : COLORS.red;
    return (
      <div style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 12,
        padding: 20,
        flex: 1,
        minWidth: 300,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 22 }}>{flag}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, fontFamily: FONT }}>
            {country === "us" ? "미국 CPI 영향분석" : "한국 CPI 영향분석"}
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <MetricCard label="현재 CPI" value={countryData.currentCPI} unit="%" small />
          <MetricCard label="시나리오 CPI" value={impact.newCPI} unit="%" color={cpiColor} small />
          <MetricCard
            label="직접 기여"
            value={(impact.directImpact >= 0 ? "+" : "") + impact.directImpact}
            unit="%p"
            color={impact.directImpact > 0 ? "#fb923c" : COLORS.green}
            small
          />
          {includeIndirect && (
            <MetricCard
              label="간접 기여"
              value={(impact.indirectImpact >= 0 ? "+" : "") + impact.indirectImpact}
              unit="%p"
              color={impact.indirectImpact > 0 ? COLORS.red : COLORS.green}
              small
            />
          )}
          <MetricCard
            label="총 영향"
            value={(impact.totalImpact >= 0 ? "+" : "") + impact.totalImpact}
            unit="%p"
            color={cpiColor}
            small
          />
          <MetricCard label="기준금리" value={countryData.currentRate} unit="%" small />
          <MetricCard
            label="현 실질금리"
            value={impact.currentRealRate}
            unit="%"
            color={impact.currentRealRate > 0 ? COLORS.green : COLORS.red}
            small
          />
          <MetricCard
            label="시나리오 실질금리"
            value={impact.newRealRate}
            unit="%"
            color={realRateColor}
            small
            sub={`${impact.newRealRate < impact.currentRealRate ? "▼" : "▲"} ${Math.abs(Math.round((impact.newRealRate - impact.currentRealRate) * 100) / 100)}%p`}
          />
        </div>
      </div>
    );
  };

  const RateChart = ({ chartData, country, flag, impact, countryData }) => {
    // Compute Y domain to include scenario values
    const allVals = chartData.flatMap(d => [d.cpi, d.rate, d.realRate]).filter(v => v != null);
    allVals.push(impact.newCPI, impact.newRealRate);
    const yMin = Math.floor(Math.min(...allVals) - 0.5);
    const yMax = Math.ceil(Math.max(...allVals) + 0.5);

    return (
      <div style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 12,
        padding: 20,
        flex: 1,
        minWidth: 340,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 18 }}>{flag}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, fontFamily: FONT }}>
            {country === "us" ? "미국" : "한국"} 기준금리 · CPI · 실질금리
          </span>
        </div>
        <div style={{ position: "relative" }}>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gridLine} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: COLORS.textDim, fontFamily: FONT }} interval={1} />
              <YAxis tick={{ fontSize: 9, fill: COLORS.textDim, fontFamily: FONT }} domain={[yMin, yMax]} />
              <Tooltip
                contentStyle={{
                  background: "#1a2233",
                  border: `1px solid ${COLORS.cardBorder}`,
                  borderRadius: 8,
                  fontFamily: FONT,
                  fontSize: 11,
                  color: COLORS.text,
                }}
              />
              <ReferenceLine y={0} stroke={COLORS.textMuted} strokeDasharray="4 4" />
              <Line type="stepAfter" dataKey="rate" stroke={COLORS.accent} strokeWidth={2.5} dot={false} name="기준금리" />
              <Line type="monotone" dataKey="cpi" stroke={COLORS.blue} strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, index } = props;
                  if (index === chartData.length - 1) {
                    return <circle cx={cx} cy={cy} r={5} fill={COLORS.blue} stroke="#fff" strokeWidth={1.5} />;
                  }
                  return null;
                }}
                name="CPI"
              />
              <Line type="monotone" dataKey="realRate" stroke={COLORS.green} strokeWidth={1.5} strokeDasharray="4 4"
                dot={(props) => {
                  const { cx, cy, index } = props;
                  if (index === chartData.length - 1) {
                    return <circle cx={cx} cy={cy} r={5} fill={COLORS.green} stroke="#fff" strokeWidth={1.5} />;
                  }
                  return null;
                }}
                name="실질금리"
              />
              {/* Scenario reference lines (horizontal targets) */}
              <ReferenceLine y={impact.newCPI} stroke={COLORS.red} strokeDasharray="6 4" strokeWidth={1} opacity={0.5} />
              <ReferenceLine y={impact.newRealRate} stroke={COLORS.purple} strokeDasharray="6 4" strokeWidth={1} opacity={0.5} />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: FONT }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ─── Scenario arrow badges (right side of chart) ─── */}
        <div style={{
          display: "flex",
          gap: 8,
          marginTop: 10,
          justifyContent: "flex-end",
          flexWrap: "wrap",
        }}>
          <ScenarioBadge
            label="시나리오 CPI"
            from={countryData.currentCPI}
            to={impact.newCPI}
            unit="%"
            color={COLORS.red}
            direction={impact.totalImpact > 0 ? "up" : impact.totalImpact < 0 ? "down" : "flat"}
          />
          <ScenarioBadge
            label="시나리오 실질금리"
            from={impact.currentRealRate}
            to={impact.newRealRate}
            unit="%"
            color={COLORS.purple}
            direction={impact.newRealRate < impact.currentRealRate ? "down" : impact.newRealRate > impact.currentRealRate ? "up" : "flat"}
          />
        </div>
      </div>
    );
  };

  const ScenarioBadge = ({ label, from, to, unit, color, direction }) => {
    const arrow = direction === "up" ? "↗" : direction === "down" ? "↘" : "→";
    return (
      <div style={{
        background: `${color}12`,
        border: `1px solid ${color}40`,
        borderRadius: 8,
        padding: "8px 14px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <span style={{ fontSize: 9, color: COLORS.textDim, fontFamily: FONT, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.textDim, fontFamily: FONT }}>
          {from}{unit}
        </span>
        <span style={{ fontSize: 18, color, fontWeight: 800, lineHeight: 1 }}>
          {arrow}
        </span>
        <span style={{ fontSize: 16, fontWeight: 800, color, fontFamily: FONT }}>
          {to}{unit}
        </span>
        <span style={{
          fontSize: 10,
          color,
          fontFamily: FONT,
          fontWeight: 700,
          background: `${color}20`,
          borderRadius: 4,
          padding: "2px 6px",
        }}>
          {to - from > 0 ? "+" : ""}{Math.round((to - from) * 100) / 100}%p
        </span>
      </div>
    );
  };

  const oilChangePct = Math.round(((oilScenario - data.currentOilPrice) / data.currentOilPrice) * 1000) / 10;

  return (
    <div style={{
      background: COLORS.bg,
      minHeight: "100vh",
      color: COLORS.text,
      fontFamily: FONT,
      padding: "0 0 40px 0",
    }}>
      {/* ─── Header ─── */}
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1a1a2e 50%, #16213e 100%)",
        borderBottom: `1px solid ${COLORS.cardBorder}`,
        padding: "20px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            fontSize: 28,
            filter: "drop-shadow(0 0 8px rgba(245,158,11,0.4))",
          }}>🐺</div>
          <div>
            <div style={{
              fontSize: 11,
              color: COLORS.accent,
              letterSpacing: 3,
              textTransform: "uppercase",
              fontWeight: 600,
            }}>
              늑대무리원정단 WOLFPACK
            </div>
            <div style={{
              fontSize: 20,
              fontWeight: 800,
              background: "linear-gradient(90deg, #f59e0b, #ef4444)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: -0.5,
            }}>
              Oil → CPI Monitor
            </div>
          </div>
        </div>
        <button
          onClick={handleAIUpdate}
          disabled={aiLoading}
          style={{
            background: aiLoading
              ? "rgba(245,158,11,0.15)"
              : "linear-gradient(135deg, #f59e0b, #d97706)",
            color: aiLoading ? COLORS.accent : "#000",
            border: "none",
            borderRadius: 8,
            padding: "10px 22px",
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 700,
            cursor: aiLoading ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.2s",
          }}
        >
          {aiLoading ? (
            <>
              <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
              AI 업데이트 중...
            </>
          ) : (
            <>⚡ AI 데이터 업데이트</>
          )}
        </button>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>

      {aiStatus && (
        <div style={{
          margin: "12px 28px 0",
          padding: "8px 16px",
          borderRadius: 6,
          fontSize: 11,
          background: aiStatus.ok ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
          color: aiStatus.ok ? COLORS.green : COLORS.red,
          border: `1px solid ${aiStatus.ok ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
        }}>
          {aiStatus.ok ? "✓" : "✗"} {aiStatus.msg}
        </div>
      )}

      <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ─── Controls Row ─── */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "flex-end",
        }}>
          {/* Timeframe selector */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.textDim, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>
              패스스루 추정 기간
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {["1y", "3y", "5y", "10y"].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  style={{
                    background: timeframe === tf ? COLORS.accent : "rgba(255,255,255,0.05)",
                    color: timeframe === tf ? "#000" : COLORS.textDim,
                    border: `1px solid ${timeframe === tf ? COLORS.accent : COLORS.cardBorder}`,
                    borderRadius: 6,
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: timeframe === tf ? 700 : 500,
                    cursor: "pointer",
                    fontFamily: FONT,
                    transition: "all 0.15s",
                  }}
                >
                  {tf.replace("y", "Y")}
                </button>
              ))}
            </div>
          </div>

          {/* Indirect toggle */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.textDim, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>
              간접효과
            </div>
            <button
              onClick={() => setIncludeIndirect(!includeIndirect)}
              style={{
                background: includeIndirect ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)",
                color: includeIndirect ? COLORS.red : COLORS.textDim,
                border: `1px solid ${includeIndirect ? "rgba(239,68,68,0.4)" : COLORS.cardBorder}`,
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: FONT,
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s",
              }}
            >
              <span style={{
                display: "inline-block",
                width: 14,
                height: 14,
                borderRadius: 3,
                border: `2px solid ${includeIndirect ? COLORS.red : COLORS.textMuted}`,
                background: includeIndirect ? COLORS.red : "transparent",
                transition: "all 0.15s",
                position: "relative",
              }}>
                {includeIndirect && (
                  <span style={{ position: "absolute", top: -1, left: 1, fontSize: 10, color: "#fff" }}>✓</span>
                )}
              </span>
              간접적 기여도 포함
            </button>
          </div>

          {/* Current oil info */}
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 10, color: COLORS.textDim, letterSpacing: 1, textTransform: "uppercase" }}>
              현재 브렌트유
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.accent }}>
              ${data.currentOilPrice}<span style={{ fontSize: 11, color: COLORS.textDim }}>/bbl</span>
            </div>
          </div>
        </div>

        {/* ─── Oil Scenario Slider ─── */}
        <div style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.cardBorder}`,
          borderRadius: 12,
          padding: "18px 24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>
              🛢️ 국제유가 시나리오
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: COLORS.accent }}>
                ${oilScenario}
              </span>
              <span style={{ fontSize: 12, color: COLORS.textDim }}>/bbl</span>
              <span style={{
                fontSize: 13,
                fontWeight: 700,
                color: oilChangePct > 0 ? COLORS.red : oilChangePct < 0 ? COLORS.green : COLORS.textDim,
                marginLeft: 8,
              }}>
                {oilChangePct > 0 ? "+" : ""}{oilChangePct}%
              </span>
            </div>
          </div>

          {/* Presets */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {oilPresets.map((p) => (
              <button
                key={p.value}
                onClick={() => setOilScenario(p.value)}
                style={{
                  background: oilScenario === p.value ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)",
                  color: oilScenario === p.value ? COLORS.accent : COLORS.textDim,
                  border: `1px solid ${oilScenario === p.value ? COLORS.accentDim : COLORS.cardBorder}`,
                  borderRadius: 5,
                  padding: "4px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: FONT,
                  transition: "all 0.15s",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Slider */}
          <div style={{ position: "relative", padding: "0 4px" }}>
            <input
              type="range"
              min={30}
              max={150}
              step={1}
              value={oilScenario}
              onChange={(e) => setOilScenario(Number(e.target.value))}
              style={{
                width: "100%",
                height: 6,
                appearance: "none",
                background: `linear-gradient(to right, ${COLORS.green} 0%, ${COLORS.accent} 40%, ${COLORS.red} 100%)`,
                borderRadius: 3,
                outline: "none",
                cursor: "pointer",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 9, color: COLORS.textMuted }}>$30</span>
              <span style={{ fontSize: 9, color: COLORS.textMuted }}>$70</span>
              <span style={{ fontSize: 9, color: COLORS.textMuted }}>$100</span>
              <span style={{ fontSize: 9, color: COLORS.textMuted }}>$150</span>
            </div>
          </div>
        </div>

        {/* ─── Impact Panels ─── */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <ImpactPanel country="us" impact={usImpact} countryData={data.us} flag="🇺🇸" />
          <ImpactPanel country="kr" impact={krImpact} countryData={data.kr} flag="🇰🇷" />
        </div>

        {/* ─── Sensitivity Table ─── */}
        <div style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.cardBorder}`,
          borderRadius: 12,
          padding: 20,
          overflowX: "auto",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 14 }}>
            📊 유가 시나리오별 CPI 민감도 ({includeIndirect ? "직접+간접" : "직접 효과만"})
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={thStyle}>Brent</th>
                <th style={thStyle}>변동률</th>
                <th style={{ ...thStyle, color: COLORS.blue }}>🇺🇸 CPI 변동</th>
                <th style={{ ...thStyle, color: COLORS.blue }}>🇺🇸 예상 CPI</th>
                <th style={{ ...thStyle, color: COLORS.blue }}>🇺🇸 실질금리</th>
                <th style={{ ...thStyle, color: COLORS.cyan }}>🇰🇷 CPI 변동</th>
                <th style={{ ...thStyle, color: COLORS.cyan }}>🇰🇷 예상 CPI</th>
                <th style={{ ...thStyle, color: COLORS.cyan }}>🇰🇷 실질금리</th>
              </tr>
            </thead>
            <tbody>
              {[50, 60, 70, 80, 90, 100, 120].map((oil) => {
                const us = calculateCPIImpact("us", oil, timeframe, includeIndirect);
                const kr = calculateCPIImpact("kr", oil, timeframe, includeIndirect);
                const isActive = oil === oilScenario;
                return (
                  <tr
                    key={oil}
                    onClick={() => setOilScenario(oil)}
                    style={{
                      cursor: "pointer",
                      background: isActive ? "rgba(245,158,11,0.08)" : "transparent",
                      transition: "background 0.15s",
                    }}
                  >
                    <td style={{ ...tdStyle, fontWeight: 700, color: isActive ? COLORS.accent : COLORS.text }}>
                      ${oil}
                    </td>
                    <td style={{ ...tdStyle, color: us.oilChangePct > 0 ? COLORS.red : us.oilChangePct < 0 ? COLORS.green : COLORS.textDim }}>
                      {us.oilChangePct > 0 ? "+" : ""}{us.oilChangePct}%
                    </td>
                    <td style={{ ...tdStyle, color: us.totalImpact > 0 ? COLORS.red : us.totalImpact < 0 ? COLORS.green : COLORS.textDim }}>
                      {us.totalImpact > 0 ? "+" : ""}{us.totalImpact}%p
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: us.newCPI > 3 ? COLORS.red : COLORS.text }}>
                      {us.newCPI}%
                    </td>
                    <td style={{ ...tdStyle, color: us.newRealRate > 0 ? COLORS.green : COLORS.red }}>
                      {us.newRealRate}%
                    </td>
                    <td style={{ ...tdStyle, color: kr.totalImpact > 0 ? COLORS.red : kr.totalImpact < 0 ? COLORS.green : COLORS.textDim }}>
                      {kr.totalImpact > 0 ? "+" : ""}{kr.totalImpact}%p
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: kr.newCPI > 3 ? COLORS.red : COLORS.text }}>
                      {kr.newCPI}%
                    </td>
                    <td style={{ ...tdStyle, color: kr.newRealRate > 0 ? COLORS.green : COLORS.red }}>
                      {kr.newRealRate}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ─── Charts ─── */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <RateChart chartData={usChartData} country="us" flag="🇺🇸" impact={usImpact} countryData={data.us} />
          <RateChart chartData={krChartData} country="kr" flag="🇰🇷" impact={krImpact} countryData={data.kr} />
        </div>

        {/* ─── Methodology Note ─── */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: `1px solid ${COLORS.cardBorder}`,
          borderRadius: 8,
          padding: "14px 18px",
          fontSize: 10,
          color: COLORS.textMuted,
          lineHeight: 1.7,
        }}>
          <span style={{ color: COLORS.textDim, fontWeight: 700 }}>📐 산출 방법론</span>
          <br />
          • <b style={{ color: COLORS.textDim }}>직접 효과</b>: CPI 에너지 항목 가중치 × 유가 변동률 × 패스스루 계수 (기간별 회귀분석 기반)
          <br />
          • <b style={{ color: COLORS.textDim }}>간접 효과</b>: 직접 효과 × 간접 승수 (운송비, 생산비용, 서비스 물가 등 2차 파급효과)
          <br />
          • 미국 에너지 CPI 가중치 ~7.5%, 한국 석유류 CPI 가중치 ~9.5%
          <br />
          • 실질금리 = 기준금리 − CPI (사후적 실질금리 기준)
          <br />
          • AI 업데이트 시 최신 CPI, 기준금리, 유가 데이터가 반영됩니다
        </div>
      </div>
    </div>
  );
}

const thStyle = {
  padding: "8px 10px",
  textAlign: "right",
  borderBottom: `1px solid ${COLORS.cardBorder}`,
  color: COLORS.textDim,
  fontSize: 10,
  fontFamily: FONT,
  letterSpacing: 0.5,
  fontWeight: 600,
};

const tdStyle = {
  padding: "7px 10px",
  textAlign: "right",
  borderBottom: `1px solid rgba(30,41,59,0.5)`,
  fontFamily: FONT,
  fontSize: 11,
};

