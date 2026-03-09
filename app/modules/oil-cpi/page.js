"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ComposedChart
} from "recharts";

// ─── Default macro data (verified Mar 2026) ───
const DEFAULT_DATA = {
  us: {
    currentCPI: 2.4,
    currentRate: 3.75,
    energyWeightDirect: 0.075,
    energyWeightIndirect: 0.045,
    oilPassThrough: { "1y": 0.038, "3y": 0.035, "5y": 0.032, "10y": 0.028 },
    indirectMultiplier: { "1y": 1.55, "3y": 1.65, "5y": 1.70, "10y": 1.80 },
    history: [
      { date: "2023-01", cpi: 6.4, rate: 4.50, brent: 84, wti: 79, usdkrw: 1230 },
      { date: "2023-04", cpi: 4.9, rate: 5.00, brent: 80, wti: 76, usdkrw: 1320 },
      { date: "2023-07", cpi: 3.2, rate: 5.50, brent: 80, wti: 77, usdkrw: 1280 },
      { date: "2023-10", cpi: 3.2, rate: 5.50, brent: 90, wti: 85, usdkrw: 1350 },
      { date: "2024-01", cpi: 3.1, rate: 5.50, brent: 80, wti: 75, usdkrw: 1310 },
      { date: "2024-04", cpi: 3.4, rate: 5.50, brent: 88, wti: 83, usdkrw: 1370 },
      { date: "2024-07", cpi: 2.9, rate: 5.50, brent: 82, wti: 78, usdkrw: 1380 },
      { date: "2024-10", cpi: 2.6, rate: 5.00, brent: 73, wti: 69, usdkrw: 1370 },
      { date: "2025-01", cpi: 3.0, rate: 4.50, brent: 76, wti: 73, usdkrw: 1450 },
      { date: "2025-04", cpi: 2.3, rate: 4.25, brent: 66, wti: 62, usdkrw: 1420 },
      { date: "2025-07", cpi: 2.5, rate: 4.25, brent: 65, wti: 62, usdkrw: 1390 },
      { date: "2025-10", cpi: 2.7, rate: 4.00, brent: 72, wti: 69, usdkrw: 1410 },
      { date: "2026-01", cpi: 2.4, rate: 3.75, brent: 67, wti: 64, usdkrw: 1430 },
    ],
  },
  kr: {
    currentCPI: 2.0,
    currentRate: 2.50,
    energyWeightDirect: 0.095,
    energyWeightIndirect: 0.055,
    oilPassThrough: { "1y": 0.045, "3y": 0.042, "5y": 0.038, "10y": 0.033 },
    indirectMultiplier: { "1y": 1.60, "3y": 1.70, "5y": 1.80, "10y": 1.90 },
    // FX pass-through: KRW depreciation → import prices → CPI
    // BOK WP: 10% KRW depreciation → ~0.3%p CPI (short-run), ~0.5%p (long-run)
    // Decomposed: non-oil import PT + oil-FX amplification
    fxPassThrough: {
      "1y": { nonOilImport: 0.030, oilFxAmplifier: 1.10 },
      "3y": { nonOilImport: 0.035, oilFxAmplifier: 1.12 },
      "5y": { nonOilImport: 0.032, oilFxAmplifier: 1.10 },
      "10y": { nonOilImport: 0.028, oilFxAmplifier: 1.08 },
    },
    history: [
      { date: "2023-01", cpi: 5.2, rate: 3.50, brent: 84, wti: 79, usdkrw: 1230 },
      { date: "2023-04", cpi: 3.7, rate: 3.50, brent: 80, wti: 76, usdkrw: 1320 },
      { date: "2023-07", cpi: 2.3, rate: 3.50, brent: 80, wti: 77, usdkrw: 1280 },
      { date: "2023-10", cpi: 3.8, rate: 3.50, brent: 90, wti: 85, usdkrw: 1350 },
      { date: "2024-01", cpi: 2.8, rate: 3.50, brent: 80, wti: 75, usdkrw: 1310 },
      { date: "2024-04", cpi: 2.9, rate: 3.50, brent: 88, wti: 83, usdkrw: 1370 },
      { date: "2024-07", cpi: 2.6, rate: 3.50, brent: 82, wti: 78, usdkrw: 1380 },
      { date: "2024-10", cpi: 1.3, rate: 3.25, brent: 73, wti: 69, usdkrw: 1370 },
      { date: "2025-01", cpi: 2.2, rate: 3.00, brent: 76, wti: 73, usdkrw: 1450 },
      { date: "2025-04", cpi: 2.1, rate: 2.75, brent: 66, wti: 62, usdkrw: 1420 },
      { date: "2025-07", cpi: 2.1, rate: 2.50, brent: 65, wti: 62, usdkrw: 1390 },
      { date: "2025-10", cpi: 2.4, rate: 2.50, brent: 72, wti: 69, usdkrw: 1410 },
      { date: "2026-01", cpi: 2.0, rate: 2.50, brent: 67, wti: 64, usdkrw: 1430 },
    ],
  },
  currentBrent: 93,
  currentWTI: 91,
  currentUSDKRW: 1430,
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
  const [benchmark, setBenchmark] = useState("brent");
  const currentOilPrice = benchmark === "brent" ? data.currentBrent : data.currentWTI;
  const [oilScenario, setOilScenario] = useState(data.currentBrent);
  const [fxScenario, setFxScenario] = useState(data.currentUSDKRW);
  const [includeIndirect, setIncludeIndirect] = useState(false);
  const [includeFx, setIncludeFx] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);

  const handleBenchmarkChange = (b) => {
    setBenchmark(b);
    setOilScenario(b === "brent" ? data.currentBrent : data.currentWTI);
  };

  // ─── CPI Impact Calculation (US: oil only) ───
  const calculateUSImpact = useCallback(
    (oilPrice, tf, indirect) => {
      const c = data.us;
      const oilChange = ((oilPrice - currentOilPrice) / currentOilPrice) * 100;
      const passThrough = c.oilPassThrough[tf];
      let directImpact = oilChange * passThrough;
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
        // No FX components for US
        fxNonOilImpact: 0,
        fxOilAmplifyImpact: 0,
        fxTotalImpact: 0,
      };
    },
    [data, currentOilPrice]
  );

  // ─── CPI Impact Calculation (KR: oil + FX) ───
  const calculateKRImpact = useCallback(
    (oilPrice, fxRate, tf, indirect, useFx) => {
      const c = data.kr;
      const oilChange = ((oilPrice - currentOilPrice) / currentOilPrice) * 100;
      const fxChange = ((fxRate - data.currentUSDKRW) / data.currentUSDKRW) * 100;
      const passThrough = c.oilPassThrough[tf];
      const fxPT = c.fxPassThrough[tf];

      // 1) Oil direct effect
      let oilDirect = oilChange * passThrough;
      // 2) Oil indirect (transport, production costs)
      let oilTotal = indirect ? oilDirect * c.indirectMultiplier[tf] : oilDirect;
      let oilIndirect = oilTotal - oilDirect;

      // 3) FX effects (Korean CPI only)
      let fxNonOilImpact = 0;
      let fxOilAmplifyImpact = 0;
      if (useFx && fxChange !== 0) {
        // a) Non-oil import price channel: KRW depreciation → import prices → CPI
        fxNonOilImpact = fxChange * fxPT.nonOilImport;
        // b) Oil-FX amplification: oil priced in USD → KRW depreciation amplifies oil CPI effect
        fxOilAmplifyImpact = oilTotal * (fxPT.oilFxAmplifier - 1);
      }
      let fxTotalImpact = fxNonOilImpact + fxOilAmplifyImpact;

      let totalImpact = oilTotal + fxTotalImpact;

      return {
        directImpact: Math.round(oilDirect * 100) / 100,
        indirectImpact: Math.round(oilIndirect * 100) / 100,
        oilTotalImpact: Math.round(oilTotal * 100) / 100,
        fxNonOilImpact: Math.round(fxNonOilImpact * 100) / 100,
        fxOilAmplifyImpact: Math.round(fxOilAmplifyImpact * 100) / 100,
        fxTotalImpact: Math.round(fxTotalImpact * 100) / 100,
        totalImpact: Math.round(totalImpact * 100) / 100,
        newCPI: Math.round((c.currentCPI + totalImpact) * 100) / 100,
        newRealRate: Math.round((c.currentRate - (c.currentCPI + totalImpact)) * 100) / 100,
        currentRealRate: Math.round((c.currentRate - c.currentCPI) * 100) / 100,
        oilChangePct: Math.round(oilChange * 10) / 10,
        fxChangePct: Math.round(fxChange * 10) / 10,
      };
    },
    [data, currentOilPrice]
  );

  const usImpact = useMemo(
    () => calculateUSImpact(oilScenario, timeframe, includeIndirect),
    [oilScenario, timeframe, includeIndirect, calculateUSImpact]
  );
  const krImpact = useMemo(
    () => calculateKRImpact(oilScenario, fxScenario, timeframe, includeIndirect, includeFx),
    [oilScenario, fxScenario, timeframe, includeIndirect, includeFx, calculateKRImpact]
  );

  // ─── History chart data ───
  const buildHistoryData = useCallback(
    (country) => {
      const c = data[country];
      return c.history.map((h) => ({
        date: h.date,
        cpi: h.cpi,
        rate: h.rate,
        oil: h[benchmark],
        usdkrw: h.usdkrw,
        realRate: Math.round((h.rate - h.cpi) * 100) / 100,
      }));
    },
    [data, benchmark]
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
        currentBrent: parsed.brent_oil ?? prev.currentBrent,
        currentWTI: parsed.wti_oil ?? prev.currentWTI,
        currentUSDKRW: parsed.usdkrw ?? prev.currentUSDKRW,
      }));
      const newPrice = benchmark === "brent"
        ? (parsed.brent_oil ?? data.currentBrent)
        : (parsed.wti_oil ?? data.currentWTI);
      setOilScenario(newPrice);
      setFxScenario(parsed.usdkrw ?? data.currentUSDKRW);
      setAiStatus({ ok: true, msg: `Updated: ${parsed.notes || parsed.data_date}` });
    } catch (e) {
      console.error(e);
      setAiStatus({ ok: false, msg: "업데이트 실패 — 재시도 해주세요" });
    }
    setAiLoading(false);
  };

  // ─── Presets ───
  const oilPresets = [
    { label: "$50", value: 50 },
    { label: "$60", value: 60 },
    { label: "$70", value: 70 },
    { label: "$80", value: 80 },
    { label: "$90", value: 90 },
    { label: "$100", value: 100 },
    { label: "$120", value: 120 },
  ];
  const fxPresets = [
    { label: "₩1,200", value: 1200 },
    { label: "₩1,300", value: 1300 },
    { label: "₩1,350", value: 1350 },
    { label: "₩1,400", value: 1400 },
    { label: "₩1,450", value: 1450 },
    { label: "₩1,500", value: 1500 },
    { label: "₩1,550", value: 1550 },
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
    const isKR = country === "kr";
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
            {isKR ? "한국 CPI 영향분석" : "미국 CPI 영향분석"}
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <MetricCard label="현재 CPI" value={countryData.currentCPI} unit="%" small />
          <MetricCard label="시나리오 CPI" value={impact.newCPI} unit="%" color={cpiColor} small />
          <MetricCard
            label="유가 직접"
            value={(impact.directImpact >= 0 ? "+" : "") + impact.directImpact}
            unit="%p"
            color={impact.directImpact > 0 ? "#fb923c" : impact.directImpact < 0 ? COLORS.green : COLORS.textDim}
            small
          />
          {includeIndirect && (
            <MetricCard
              label="유가 간접"
              value={(impact.indirectImpact >= 0 ? "+" : "") + impact.indirectImpact}
              unit="%p"
              color={impact.indirectImpact > 0 ? COLORS.red : impact.indirectImpact < 0 ? COLORS.green : COLORS.textDim}
              small
            />
          )}
          {/* FX effect cards — Korean only */}
          {isKR && includeFx && (
            <>
              <MetricCard
                label="환율→수입물가"
                value={(impact.fxNonOilImpact >= 0 ? "+" : "") + impact.fxNonOilImpact}
                unit="%p"
                color={impact.fxNonOilImpact > 0 ? COLORS.cyan : impact.fxNonOilImpact < 0 ? COLORS.green : COLORS.textDim}
                small
              />
              <MetricCard
                label="환율→원유증폭"
                value={(impact.fxOilAmplifyImpact >= 0 ? "+" : "") + impact.fxOilAmplifyImpact}
                unit="%p"
                color={impact.fxOilAmplifyImpact > 0 ? COLORS.purple : impact.fxOilAmplifyImpact < 0 ? COLORS.green : COLORS.textDim}
                small
              />
            </>
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
        {/* FX decomposition box (KR only) */}
        {isKR && includeFx && impact.fxTotalImpact !== 0 && (
          <div style={{
            marginTop: 14,
            padding: "12px 16px",
            borderRadius: 8,
            background: `linear-gradient(135deg, rgba(6,182,212,0.04), rgba(168,85,247,0.04))`,
            border: `1px solid rgba(6,182,212,0.15)`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 12 }}>💱</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.cyan, fontFamily: FONT }}>
                환율 효과 분해 (USD/KRW {fxScenario.toLocaleString()}원, {impact.fxChangePct > 0 ? "+" : ""}{impact.fxChangePct}%)
              </span>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <div>
                <div style={{ fontSize: 9, color: COLORS.textDim, fontFamily: FONT }}>비에너지 수입물가</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: impact.fxNonOilImpact > 0 ? COLORS.red : COLORS.green, fontFamily: FONT }}>
                  {impact.fxNonOilImpact >= 0 ? "+" : ""}{impact.fxNonOilImpact}%p
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: COLORS.textDim, fontFamily: FONT }}>원유 달러표시 증폭</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: impact.fxOilAmplifyImpact > 0 ? COLORS.red : COLORS.green, fontFamily: FONT }}>
                  {impact.fxOilAmplifyImpact >= 0 ? "+" : ""}{impact.fxOilAmplifyImpact}%p
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: COLORS.textDim, fontFamily: FONT }}>환율 효과 합계</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: impact.fxTotalImpact > 0 ? COLORS.red : COLORS.green, fontFamily: FONT }}>
                  {impact.fxTotalImpact >= 0 ? "+" : ""}{impact.fxTotalImpact}%p
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const RateChart = ({ chartData, country, flag, impact, countryData }) => {
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>{flag}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, fontFamily: FONT }}>
            {country === "us" ? "미국" : "한국"} 기준금리 · CPI · 실질금리
          </span>
        </div>
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
            <ReferenceLine y={impact.newCPI} stroke={COLORS.red} strokeDasharray="6 4" strokeWidth={1} opacity={0.5} />
            <ReferenceLine y={impact.newRealRate} stroke={COLORS.purple} strokeDasharray="6 4" strokeWidth={1} opacity={0.5} />
            <Legend wrapperStyle={{ fontSize: 10, fontFamily: FONT }} />
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <ScenarioBadge label="시나리오 CPI" from={countryData.currentCPI} to={impact.newCPI} unit="%" color={COLORS.red}
            direction={impact.totalImpact > 0 ? "up" : impact.totalImpact < 0 ? "down" : "flat"} />
          <ScenarioBadge label="시나리오 실질금리" from={impact.currentRealRate} to={impact.newRealRate} unit="%" color={COLORS.purple}
            direction={impact.newRealRate < impact.currentRealRate ? "down" : impact.newRealRate > impact.currentRealRate ? "up" : "flat"} />
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
        <span style={{ fontSize: 9, color: COLORS.textDim, fontFamily: FONT, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.textDim, fontFamily: FONT }}>{from}{unit}</span>
        <span style={{ fontSize: 18, color, fontWeight: 800, lineHeight: 1 }}>{arrow}</span>
        <span style={{ fontSize: 16, fontWeight: 800, color, fontFamily: FONT }}>{to}{unit}</span>
        <span style={{ fontSize: 10, color, fontFamily: FONT, fontWeight: 700, background: `${color}20`, borderRadius: 4, padding: "2px 6px" }}>
          {to - from > 0 ? "+" : ""}{Math.round((to - from) * 100) / 100}%p
        </span>
      </div>
    );
  };

  const oilChangePct = Math.round(((oilScenario - currentOilPrice) / currentOilPrice) * 1000) / 10;
  const fxChangePct = Math.round(((fxScenario - data.currentUSDKRW) / data.currentUSDKRW) * 1000) / 10;
  const benchmarkLabel = benchmark === "brent" ? "Brent" : "WTI";

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
          <div style={{ fontSize: 28, filter: "drop-shadow(0 0 8px rgba(245,158,11,0.4))" }}>🐺</div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.accent, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>
              늑대무리원정단 WOLFPACK
            </div>
            <div style={{
              fontSize: 20, fontWeight: 800,
              background: "linear-gradient(90deg, #f59e0b, #06b6d4, #ef4444)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: -0.5,
            }}>
              Oil + FX → CPI Monitor
            </div>
          </div>
        </div>
        <button
          onClick={handleAIUpdate}
          disabled={aiLoading}
          style={{
            background: aiLoading ? "rgba(245,158,11,0.15)" : "linear-gradient(135deg, #f59e0b, #d97706)",
            color: aiLoading ? COLORS.accent : "#000",
            border: "none", borderRadius: 8, padding: "10px 22px",
            fontFamily: FONT, fontSize: 12, fontWeight: 700,
            cursor: aiLoading ? "wait" : "pointer",
            display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s",
          }}
        >
          {aiLoading ? (<><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> AI 업데이트 중...</>)
            : (<>⚡ AI 데이터 업데이트</>)}
        </button>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>

      {aiStatus && (
        <div style={{
          margin: "12px 28px 0", padding: "8px 16px", borderRadius: 6, fontSize: 11,
          background: aiStatus.ok ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
          color: aiStatus.ok ? COLORS.green : COLORS.red,
          border: `1px solid ${aiStatus.ok ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
        }}>
          {aiStatus.ok ? "✓" : "✗"} {aiStatus.msg}
        </div>
      )}

      <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ─── Controls Row ─── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
          {/* Timeframe */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.textDim, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>패스스루 추정 기간</div>
            <div style={{ display: "flex", gap: 4 }}>
              {["1y", "3y", "5y", "10y"].map((tf) => (
                <button key={tf} onClick={() => setTimeframe(tf)} style={{
                  background: timeframe === tf ? COLORS.accent : "rgba(255,255,255,0.05)",
                  color: timeframe === tf ? "#000" : COLORS.textDim,
                  border: `1px solid ${timeframe === tf ? COLORS.accent : COLORS.cardBorder}`,
                  borderRadius: 6, padding: "6px 14px", fontSize: 12,
                  fontWeight: timeframe === tf ? 700 : 500, cursor: "pointer", fontFamily: FONT, transition: "all 0.15s",
                }}>{tf.replace("y", "Y")}</button>
              ))}
            </div>
          </div>

          {/* Indirect toggle */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.textDim, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>간접효과</div>
            <button onClick={() => setIncludeIndirect(!includeIndirect)} style={{
              background: includeIndirect ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)",
              color: includeIndirect ? COLORS.red : COLORS.textDim,
              border: `1px solid ${includeIndirect ? "rgba(239,68,68,0.4)" : COLORS.cardBorder}`,
              borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: FONT, display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
            }}>
              <span style={{
                display: "inline-block", width: 14, height: 14, borderRadius: 3,
                border: `2px solid ${includeIndirect ? COLORS.red : COLORS.textMuted}`,
                background: includeIndirect ? COLORS.red : "transparent", transition: "all 0.15s", position: "relative",
              }}>{includeIndirect && <span style={{ position: "absolute", top: -1, left: 1, fontSize: 10, color: "#fff" }}>✓</span>}</span>
              간접적 기여도 포함
            </button>
          </div>

          {/* FX toggle (NEW) */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.textDim, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>환율효과</div>
            <button onClick={() => setIncludeFx(!includeFx)} style={{
              background: includeFx ? "rgba(6,182,212,0.15)" : "rgba(255,255,255,0.05)",
              color: includeFx ? COLORS.cyan : COLORS.textDim,
              border: `1px solid ${includeFx ? "rgba(6,182,212,0.4)" : COLORS.cardBorder}`,
              borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: FONT, display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
            }}>
              <span style={{
                display: "inline-block", width: 14, height: 14, borderRadius: 3,
                border: `2px solid ${includeFx ? COLORS.cyan : COLORS.textMuted}`,
                background: includeFx ? COLORS.cyan : "transparent", transition: "all 0.15s", position: "relative",
              }}>{includeFx && <span style={{ position: "absolute", top: -1, left: 1, fontSize: 10, color: "#fff" }}>✓</span>}</span>
              환율 기여도 포함 (🇰🇷)
            </button>
          </div>

          {/* Benchmark */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.textDim, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>유종 선택</div>
            <div style={{ display: "flex", gap: 4 }}>
              {[{ id: "brent", label: "Brent", price: data.currentBrent }, { id: "wti", label: "WTI", price: data.currentWTI }].map((b) => (
                <button key={b.id} onClick={() => handleBenchmarkChange(b.id)} style={{
                  background: benchmark === b.id ? COLORS.accent : "rgba(255,255,255,0.05)",
                  color: benchmark === b.id ? "#000" : COLORS.textDim,
                  border: `1px solid ${benchmark === b.id ? COLORS.accent : COLORS.cardBorder}`,
                  borderRadius: 6, padding: "6px 14px", fontSize: 12,
                  fontWeight: benchmark === b.id ? 700 : 500, cursor: "pointer", fontFamily: FONT, transition: "all 0.15s",
                }}>{b.label} <span style={{ opacity: 0.6, fontSize: 10 }}>${b.price}</span></button>
              ))}
            </div>
          </div>

          {/* Current info */}
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 10, color: COLORS.textDim, letterSpacing: 1, textTransform: "uppercase" }}>현재 {benchmarkLabel}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.accent }}>
              ${currentOilPrice}<span style={{ fontSize: 11, color: COLORS.textDim }}>/bbl</span>
            </div>
            <div style={{ fontSize: 9, color: COLORS.textMuted }}>
              Brent ${data.currentBrent} · WTI ${data.currentWTI} · Spread ${data.currentBrent - data.currentWTI} · USD/KRW {data.currentUSDKRW.toLocaleString()}
            </div>
          </div>
        </div>

        {/* ─── Oil + FX Scenario Sliders ─── */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {/* Oil Slider */}
          <div style={{
            background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: 12, padding: "18px 24px", flex: 1, minWidth: 340,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>🛢️ {benchmarkLabel} 유가 시나리오</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: COLORS.accent }}>${oilScenario}</span>
                <span style={{ fontSize: 12, color: COLORS.textDim }}>/bbl</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: oilChangePct > 0 ? COLORS.red : oilChangePct < 0 ? COLORS.green : COLORS.textDim, marginLeft: 8 }}>
                  {oilChangePct > 0 ? "+" : ""}{oilChangePct}%
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {oilPresets.map((p) => (
                <button key={p.value} onClick={() => setOilScenario(p.value)} style={{
                  background: oilScenario === p.value ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)",
                  color: oilScenario === p.value ? COLORS.accent : COLORS.textDim,
                  border: `1px solid ${oilScenario === p.value ? COLORS.accentDim : COLORS.cardBorder}`,
                  borderRadius: 5, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                }}>{p.label}</button>
              ))}
            </div>
            <input type="range" min={30} max={150} step={1} value={oilScenario}
              onChange={(e) => setOilScenario(Number(e.target.value))}
              style={{
                width: "100%", height: 6, appearance: "none",
                background: `linear-gradient(to right, ${COLORS.green} 0%, ${COLORS.accent} 40%, ${COLORS.red} 100%)`,
                borderRadius: 3, outline: "none", cursor: "pointer",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 9, color: COLORS.textMuted }}>$30</span>
              <span style={{ fontSize: 9, color: COLORS.textMuted }}>$70</span>
              <span style={{ fontSize: 9, color: COLORS.textMuted }}>$100</span>
              <span style={{ fontSize: 9, color: COLORS.textMuted }}>$150</span>
            </div>
          </div>

          {/* FX Slider (NEW) */}
          <div style={{
            background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: 12, padding: "18px 24px", flex: 1, minWidth: 340,
            opacity: includeFx ? 1 : 0.4, transition: "opacity 0.3s",
            pointerEvents: includeFx ? "auto" : "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>💱 USD/KRW 환율 시나리오</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: COLORS.cyan }}>₩{fxScenario.toLocaleString()}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: fxChangePct > 0 ? COLORS.red : fxChangePct < 0 ? COLORS.green : COLORS.textDim, marginLeft: 8 }}>
                  {fxChangePct > 0 ? "+" : ""}{fxChangePct}%
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {fxPresets.map((p) => (
                <button key={p.value} onClick={() => setFxScenario(p.value)} style={{
                  background: fxScenario === p.value ? "rgba(6,182,212,0.2)" : "rgba(255,255,255,0.04)",
                  color: fxScenario === p.value ? COLORS.cyan : COLORS.textDim,
                  border: `1px solid ${fxScenario === p.value ? "rgba(6,182,212,0.4)" : COLORS.cardBorder}`,
                  borderRadius: 5, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                }}>{p.label}</button>
              ))}
            </div>
            <input type="range" min={1100} max={1650} step={10} value={fxScenario}
              onChange={(e) => setFxScenario(Number(e.target.value))}
              style={{
                width: "100%", height: 6, appearance: "none",
                background: `linear-gradient(to right, ${COLORS.green} 0%, ${COLORS.cyan} 50%, ${COLORS.red} 100%)`,
                borderRadius: 3, outline: "none", cursor: "pointer",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 9, color: COLORS.textMuted }}>₩1,100</span>
              <span style={{ fontSize: 9, color: COLORS.textMuted }}>₩1,300</span>
              <span style={{ fontSize: 9, color: COLORS.textMuted }}>₩1,500</span>
              <span style={{ fontSize: 9, color: COLORS.textMuted }}>₩1,650</span>
            </div>
          </div>
        </div>

        {/* ─── Impact Panels ─── */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <ImpactPanel country="us" impact={usImpact} countryData={data.us} flag="🇺🇸" />
          <ImpactPanel country="kr" impact={krImpact} countryData={data.kr} flag="🇰🇷" />
        </div>

        {/* ─── Oil × FX Cross Scenario Heatmap (NEW) ─── */}
        {includeFx && (
          <div style={{
            background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: 12, padding: 20, overflowX: "auto",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 14 }}>
              🔥 유가 × 환율 교차 시나리오 → 🇰🇷 CPI
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: "left" }}>{benchmarkLabel} \ USD/KRW</th>
                  {[1200, 1300, 1400, 1500, 1600].map(fx => (
                    <th key={fx} style={{ ...thStyle, color: COLORS.cyan }}>₩{fx.toLocaleString()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[50, 60, 70, 80, 90, 100, 120].map((oil) => (
                  <tr key={oil}>
                    <td style={{ ...tdStyle, textAlign: "left", fontWeight: 700, color: COLORS.accent }}>${oil}</td>
                    {[1200, 1300, 1400, 1500, 1600].map((fx) => {
                      const kr = calculateKRImpact(oil, fx, timeframe, includeIndirect, true);
                      const intensity = Math.min(Math.abs(kr.totalImpact) / 3, 1);
                      const bg = kr.totalImpact >= 0
                        ? `rgba(239,68,68,${intensity * 0.3})`
                        : `rgba(16,185,129,${intensity * 0.3})`;
                      const isSelected = oil === oilScenario && fx === fxScenario;
                      return (
                        <td key={fx}
                          onClick={() => { setOilScenario(oil); setFxScenario(fx); }}
                          style={{
                            ...tdStyle, background: bg, fontWeight: 600,
                            color: kr.totalImpact >= 0 ? COLORS.red : COLORS.green,
                            outline: isSelected ? `2px solid ${COLORS.accent}` : "none",
                            cursor: "pointer",
                          }}
                        >
                          {kr.newCPI}%
                          <div style={{ fontSize: 9, color: COLORS.textMuted, fontWeight: 400 }}>
                            ({kr.totalImpact >= 0 ? "+" : ""}{kr.totalImpact}%p)
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 9, color: COLORS.textMuted, marginTop: 6, textAlign: "center", fontFamily: FONT }}>
              셀 클릭 시 해당 시나리오로 이동 · 현재 선택: ${oilScenario} / ₩{fxScenario.toLocaleString()}
            </div>
          </div>
        )}

        {/* ─── Oil Sensitivity Table ─── */}
        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
          borderRadius: 12, padding: 20, overflowX: "auto",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 14 }}>
            📊 유가 시나리오별 CPI 민감도 ({includeIndirect ? "직접+간접" : "직접 효과만"}{includeFx ? ` · 환율 ₩${fxScenario.toLocaleString()} 고정` : ""})
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={thStyle}>{benchmarkLabel}</th>
                <th style={thStyle}>변동률</th>
                <th style={{ ...thStyle, color: COLORS.blue }}>🇺🇸 CPI 변동</th>
                <th style={{ ...thStyle, color: COLORS.blue }}>🇺🇸 예상 CPI</th>
                <th style={{ ...thStyle, color: COLORS.blue }}>🇺🇸 실질금리</th>
                <th style={{ ...thStyle, color: COLORS.cyan }}>🇰🇷 CPI 변동</th>
                {includeFx && <th style={{ ...thStyle, color: COLORS.cyan, fontSize: 9 }}>🇰🇷 환율효과</th>}
                <th style={{ ...thStyle, color: COLORS.cyan }}>🇰🇷 예상 CPI</th>
                <th style={{ ...thStyle, color: COLORS.cyan }}>🇰🇷 실질금리</th>
              </tr>
            </thead>
            <tbody>
              {[50, 60, 70, 80, 90, 100, 120].map((oil) => {
                const us = calculateUSImpact(oil, timeframe, includeIndirect);
                const kr = calculateKRImpact(oil, fxScenario, timeframe, includeIndirect, includeFx);
                const isActive = oil === oilScenario;
                return (
                  <tr key={oil} onClick={() => setOilScenario(oil)}
                    style={{ cursor: "pointer", background: isActive ? "rgba(245,158,11,0.08)" : "transparent", transition: "background 0.15s" }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: isActive ? COLORS.accent : COLORS.text }}>${oil}</td>
                    <td style={{ ...tdStyle, color: us.oilChangePct > 0 ? COLORS.red : us.oilChangePct < 0 ? COLORS.green : COLORS.textDim }}>
                      {us.oilChangePct > 0 ? "+" : ""}{us.oilChangePct}%
                    </td>
                    <td style={{ ...tdStyle, color: us.totalImpact > 0 ? COLORS.red : us.totalImpact < 0 ? COLORS.green : COLORS.textDim }}>
                      {us.totalImpact > 0 ? "+" : ""}{us.totalImpact}%p
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: us.newCPI > 3 ? COLORS.red : COLORS.text }}>{us.newCPI}%</td>
                    <td style={{ ...tdStyle, color: us.newRealRate > 0 ? COLORS.green : COLORS.red }}>{us.newRealRate}%</td>
                    <td style={{ ...tdStyle, color: kr.oilTotalImpact > 0 ? COLORS.red : kr.oilTotalImpact < 0 ? COLORS.green : COLORS.textDim }}>
                      {kr.oilTotalImpact > 0 ? "+" : ""}{kr.oilTotalImpact}%p
                    </td>
                    {includeFx && (
                      <td style={{ ...tdStyle, color: kr.fxTotalImpact > 0 ? COLORS.red : kr.fxTotalImpact < 0 ? COLORS.green : COLORS.textDim, fontSize: 10 }}>
                        {kr.fxTotalImpact > 0 ? "+" : ""}{kr.fxTotalImpact}%p
                      </td>
                    )}
                    <td style={{ ...tdStyle, fontWeight: 700, color: kr.newCPI > 3 ? COLORS.red : COLORS.text }}>{kr.newCPI}%</td>
                    <td style={{ ...tdStyle, color: kr.newRealRate > 0 ? COLORS.green : COLORS.red }}>{kr.newRealRate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ─── FX Sensitivity Table (NEW — KR only) ─── */}
        {includeFx && (
          <div style={{
            background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: 12, padding: 20, overflowX: "auto",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 14 }}>
              💱 환율 시나리오별 🇰🇷 CPI 민감도 (유가 ${oilScenario}/bbl 고정)
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={thStyle}>USD/KRW</th>
                  <th style={thStyle}>변동률</th>
                  <th style={{ ...thStyle, color: COLORS.cyan }}>수입물가 경로</th>
                  <th style={{ ...thStyle, color: COLORS.purple }}>원유 증폭 효과</th>
                  <th style={{ ...thStyle, color: COLORS.cyan, fontWeight: 800 }}>환율효과 합계</th>
                  <th style={{ ...thStyle, color: COLORS.text }}>유가효과</th>
                  <th style={{ ...thStyle, color: COLORS.red, fontWeight: 800 }}>🇰🇷 예상 CPI</th>
                  <th style={{ ...thStyle, color: COLORS.green }}>🇰🇷 실질금리</th>
                </tr>
              </thead>
              <tbody>
                {fxPresets.map(({ value: fx }) => {
                  const kr = calculateKRImpact(oilScenario, fx, timeframe, includeIndirect, true);
                  const isActive = fx === fxScenario;
                  return (
                    <tr key={fx} onClick={() => setFxScenario(fx)}
                      style={{ cursor: "pointer", background: isActive ? "rgba(6,182,212,0.08)" : "transparent", transition: "background 0.15s" }}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: isActive ? COLORS.cyan : COLORS.text }}>₩{fx.toLocaleString()}</td>
                      <td style={{ ...tdStyle, color: kr.fxChangePct > 0 ? COLORS.red : kr.fxChangePct < 0 ? COLORS.green : COLORS.textDim }}>
                        {kr.fxChangePct > 0 ? "+" : ""}{kr.fxChangePct}%
                      </td>
                      <td style={{ ...tdStyle, color: kr.fxNonOilImpact > 0 ? COLORS.red : kr.fxNonOilImpact < 0 ? COLORS.green : COLORS.textDim }}>
                        {kr.fxNonOilImpact >= 0 ? "+" : ""}{kr.fxNonOilImpact}%p
                      </td>
                      <td style={{ ...tdStyle, color: kr.fxOilAmplifyImpact > 0 ? COLORS.red : kr.fxOilAmplifyImpact < 0 ? COLORS.green : COLORS.textDim }}>
                        {kr.fxOilAmplifyImpact >= 0 ? "+" : ""}{kr.fxOilAmplifyImpact}%p
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: kr.fxTotalImpact > 0 ? COLORS.red : kr.fxTotalImpact < 0 ? COLORS.green : COLORS.textDim }}>
                        {kr.fxTotalImpact >= 0 ? "+" : ""}{kr.fxTotalImpact}%p
                      </td>
                      <td style={{ ...tdStyle, color: kr.oilTotalImpact > 0 ? COLORS.red : kr.oilTotalImpact < 0 ? COLORS.green : COLORS.textDim }}>
                        {kr.oilTotalImpact >= 0 ? "+" : ""}{kr.oilTotalImpact}%p
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: kr.newCPI > 3 ? COLORS.red : COLORS.text }}>{kr.newCPI}%</td>
                      <td style={{ ...tdStyle, color: kr.newRealRate > 0 ? COLORS.green : COLORS.red }}>{kr.newRealRate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

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
          • <b style={{ color: COLORS.cyan }}>환율 → 수입물가 경로</b>: 환율 변동률 × 수입물가 패스스루 계수 (BOK/KDI 실증분석 기반, 10% 원화 절하 시 ~0.3%p CPI)
          <br />
          • <b style={{ color: COLORS.purple }}>환율 → 원유 증폭 효과</b>: 원유가 USD 표시 → 원화 절하 시 원화 환산 유가 추가 상승분 반영
          <br />
          • 미국 에너지 CPI 가중치 ~7.5%, 한국 석유류 CPI 가중치 ~9.5%
          <br />
          • 한국 수입물가 환율 전가율: 단기 ~20-30%, 장기 ~40-50% (BOK Working Paper) · 수입물가→소비자물가 전가: ~15-20% (KDI)
          <br />
          • 실질금리 = 기준금리 − CPI (사후적 실질금리 기준)
          <br />
          • AI 업데이트 시 최신 CPI, 기준금리, 유가, 환율 데이터가 반영됩니다
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
