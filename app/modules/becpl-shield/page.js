'use client';

import { useState, useMemo, useCallback } from 'react';

const COLORS = {
  bg: "#0a0e17",
  surface: "#111827",
  border: "#1e293b",
  borderLight: "#334155",
  accent: "#3b82f6",
  accentGlow: "rgba(59,130,246,0.15)",
  danger: "#ef4444",
  dangerGlow: "rgba(239,68,68,0.12)",
  safe: "#10b981",
  safeGlow: "rgba(16,185,129,0.12)",
  warn: "#f59e0b",
  warnGlow: "rgba(245,158,11,0.12)",
  text: "#f1f5f9",
  textMuted: "#94a3b8",
  textDim: "#64748b",
};

function SliderInput({ label, value, onChange, min, max, step, unit, description, color }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: COLORS.textMuted }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: color || COLORS.text, fontFamily: "'JetBrains Mono', monospace" }}>
          {step < 1 ? value.toFixed(step < 0.01 ? 3 : 2) : value.toFixed(step < 1 ? 1 : 0)}{unit}
        </span>
      </div>
      {description && <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 6 }}>{description}</div>}
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", height: 6, appearance: "none",
          background: `linear-gradient(to right, ${color || COLORS.accent} ${pct}%, ${COLORS.border} ${pct}%)`,
          borderRadius: 3, cursor: "pointer", outline: "none" }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 10, color: COLORS.textDim }}>{min}{unit}</span>
        <span style={{ fontSize: 10, color: COLORS.textDim }}>{max}{unit}</span>
      </div>
    </div>
  );
}

function NumberInput({ label, value, onChange, min, max, step, unit }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 16, marginBottom: 8 }}>
      <span style={{ fontSize: 12, color: COLORS.textMuted }}>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v))); }}
        style={{ width: 70, padding: "4px 8px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
          background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.text, textAlign: "right", outline: "none" }} />
      <span style={{ fontSize: 11, color: COLORS.textDim }}>{unit}</span>
    </div>
  );
}

function SectionTitle({ children, icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, letterSpacing: "0.04em", textTransform: "uppercase" }}>{children}</span>
    </div>
  );
}

function Card({ children, style }) {
  return <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20, ...style }}>{children}</div>;
}

function StatBox({ label, value, unit, color, sub, glow }) {
  return (
    <div style={{ background: glow || COLORS.bg, border: `1px solid ${color}33`, borderRadius: 10, padding: "14px 16px", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace" }}>
        {value}<span style={{ fontSize: 13, fontWeight: 500 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Heatmap({ rateRange, spreadRange, calcReturn }) {
  const rateSteps = [];
  for (let r = rateRange[0]; r <= rateRange[1]; r += rateRange[2]) rateSteps.push(Math.round(r * 100) / 100);
  const spreadSteps = [];
  for (let s = spreadRange[0]; s <= spreadRange[1]; s += spreadRange[2]) spreadSteps.push(Math.round(s * 100) / 100);

  const getColor = (val) => {
    if (val >= 0.5) return `rgba(16,185,129,${Math.min(0.9, 0.3 + val / 3)})`;
    if (val >= 0.1) return `rgba(16,185,129,${0.15 + val / 3})`;
    if (val >= 0) return "rgba(16,185,129,0.08)";
    if (val >= -0.1) return "rgba(245,158,11,0.2)";
    if (val >= -0.3) return `rgba(239,68,68,${0.15 + Math.abs(val) / 2})`;
    return `rgba(239,68,68,${Math.min(0.85, 0.3 + Math.abs(val) / 3)})`;
  };
  const getTextColor = (val) => val >= 0 ? "#10b981" : val >= -0.1 ? "#f59e0b" : "#ef4444";

  const maxRate = rateSteps.length > 25 ? rateSteps.filter((_, i) => i % Math.ceil(rateSteps.length / 25) === 0) : rateSteps;
  const maxSpread = spreadSteps.length > 25 ? spreadSteps.filter((_, i) => i % Math.ceil(spreadSteps.length / 25) === 0) : spreadSteps;

  return (
    <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 500 }}>
      <table style={{ borderCollapse: "collapse", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ position: "sticky", top: 0, left: 0, zIndex: 3, background: COLORS.surface, padding: "6px 4px",
              borderBottom: `2px solid ${COLORS.borderLight}`, borderRight: `2px solid ${COLORS.borderLight}`,
              fontSize: 9, color: COLORS.textDim, minWidth: 70, textAlign: "center" }}>
              <div>금리↓ \ 스프레드→</div>
            </th>
            {maxSpread.map((s) => (
              <th key={s} style={{ position: "sticky", top: 0, zIndex: 2, background: COLORS.surface, padding: "6px 3px",
                borderBottom: `2px solid ${COLORS.borderLight}`, color: COLORS.textMuted, textAlign: "center", minWidth: 42, fontSize: 9 }}>+{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {maxRate.map((r) => (
            <tr key={r}>
              <td style={{ position: "sticky", left: 0, zIndex: 1, background: COLORS.surface, padding: "5px 6px",
                borderRight: `2px solid ${COLORS.borderLight}`, color: COLORS.textMuted, textAlign: "center", fontWeight: 600, fontSize: 9 }}>+{r}bp</td>
              {maxSpread.map((s) => {
                const ret = calcReturn(r, s);
                return (
                  <td key={s} style={{ background: getColor(ret), padding: "5px 2px", textAlign: "center",
                    color: getTextColor(ret), fontWeight: 600, fontSize: 9, border: `1px solid ${COLORS.bg}`, borderRadius: 2, cursor: "default" }}
                    title={`금리+${r}bp, 스프레드+${s}bp → 전체 ${ret >= 0 ? "+" : ""}${ret.toFixed(3)}%`}>
                    {ret >= 0 ? "+" : ""}{ret.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BECPLShieldPage() {
  const [duration, setDuration] = useState(2.0);
  const [carry, setCarry] = useState(3.80);
  const [holdingMonths, setHoldingMonths] = useState(6);
  const [safeMaturity, setSafeMaturity] = useState(1.0);
  const [safeYtm, setSafeYtm] = useState(2.80);
  const [rateChg, setRateChg] = useState(30);
  const [spreadChg, setSpreadChg] = useState(20);
  const [becplWeight, setBecplWeight] = useState(60);
  const [hmRateMax, setHmRateMax] = useState(80);
  const [hmSpreadMax, setHmSpreadMax] = useState(50);
  const [hmStep, setHmStep] = useState(5);

  const t = holdingMonths / 12;
  const safeWeight = 100 - becplWeight;
  const safeReturn = useMemo(() => safeYtm * t, [safeYtm, t]);
  const carryIncome = carry * t;
  const rateLoss = duration * rateChg / 100;
  const spreadLoss = duration * spreadChg / 100;
  const becplReturn = useMemo(() => carryIncome - rateLoss - spreadLoss, [carryIncome, rateLoss, spreadLoss]);
  const totalReturn = (becplWeight / 100 * becplReturn) + (safeWeight / 100 * safeReturn);

  const maxAllocation = useMemo(() => {
    const becpl = carry * t - duration * rateChg / 100 - duration * spreadChg / 100;
    const safe = safeYtm * t;
    if (becpl >= 0) return 100;
    const diff = safe - becpl;
    if (diff <= 0) return 0;
    return Math.min(100, Math.max(0, safe / diff * 100));
  }, [carry, t, duration, rateChg, spreadChg, safeYtm]);

  const calcHeatmapReturn = useCallback((r, s) => {
    const becpl = carry * t - duration * r / 100 - duration * s / 100;
    const safe = safeYtm * t;
    return (becplWeight / 100 * becpl) + (safeWeight / 100 * safe);
  }, [carry, t, duration, safeYtm, becplWeight, safeWeight]);

  const breakEvenInfo = useMemo(() => {
    let rateOnly = 0, spreadOnly = 0, both = 0;
    for (let r = 1; r <= 300; r++) { if (calcHeatmapReturn(r, 0) < 0) { rateOnly = r; break; } }
    for (let s = 1; s <= 300; s++) { if (calcHeatmapReturn(0, s) < 0) { spreadOnly = s; break; } }
    for (let x = 1; x <= 300; x++) { if (calcHeatmapReturn(x, x) < 0) { both = x; break; } }
    return { rateOnly, spreadOnly, both };
  }, [calcHeatmapReturn]);

  const fmt = (v, d = 2) => v.toFixed(d);
  const fmtSign = (v, d = 2) => (v >= 0 ? "+" : "") + v.toFixed(d);

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text,
      fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", padding: "24px 20px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance:none;appearance:none;width:16px;height:16px;border-radius:50%;
          background:#fff;border:2px solid ${COLORS.accent};cursor:pointer;box-shadow:0 0 8px rgba(59,130,246,0.4);
        }
        input[type=number]:focus{border-color:${COLORS.accent}!important;box-shadow:0 0 0 2px rgba(59,130,246,0.2);}
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:6px;height:6px;}
        ::-webkit-scrollbar-track{background:${COLORS.bg};}
        ::-webkit-scrollbar-thumb{background:${COLORS.border};border-radius:3px;}
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28, textAlign: "center" }}>
        <a href="/" style={{ fontSize: 11, color: COLORS.textDim, textDecoration: "none", display: "inline-block", marginBottom: 10,
          padding: "4px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 20 }}>
          ← 컨트롤타워
        </a>
        <div style={{ fontSize: 11, color: COLORS.accent, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>
          늑대무리원정단 · Fund Idea Lab
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, lineHeight: 1.3,
          background: "linear-gradient(135deg, #f1f5f9, #94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          베크플 MDD Shield Designer
        </h1>
        <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 6 }}>
          베스트크레딧플러스 + 만기매칭형 채권 조합으로 전체 구조 마이너스 방어 설계
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <StatBox label="전체 포트폴리오 수익률" value={fmtSign(totalReturn)} unit="%"
          color={totalReturn >= 0 ? COLORS.safe : COLORS.danger}
          glow={totalReturn >= 0 ? COLORS.safeGlow : COLORS.dangerGlow}
          sub={`${holdingMonths}개월 보유 기준`} />
        <StatBox label="베크플 예상 수익" value={fmtSign(becplReturn)} unit="%"
          color={becplReturn >= 0 ? COLORS.safe : COLORS.danger}
          glow={becplReturn >= 0 ? COLORS.safeGlow : COLORS.dangerGlow}
          sub={`캐리 ${fmt(carryIncome)}% − 손실 ${fmt(rateLoss + spreadLoss)}%`} />
        <StatBox label="베크플 최대 편입비중" value={fmt(maxAllocation, 1)} unit="%"
          color={maxAllocation >= becplWeight ? COLORS.safe : COLORS.danger}
          glow={maxAllocation >= becplWeight ? COLORS.safeGlow : COLORS.dangerGlow}
          sub="전체 수익 ≥ 0 유지 상한" />
        <StatBox label="만기매칭 수익 기여" value={fmtSign(safeWeight / 100 * safeReturn)} unit="%"
          color={COLORS.accent} glow={COLORS.accentGlow}
          sub={`비중 ${safeWeight}% × ${fmt(safeReturn)}%`} />
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16 }}>
        {/* Left Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <SectionTitle icon="📊">베크플 펀드</SectionTitle>
            <SliderInput label="펀드 듀레이션" value={duration} onChange={setDuration}
              min={0.5} max={5.0} step={0.1} unit="년" color={COLORS.accent}
              description="금리·스프레드 변동에 대한 가격 민감도" />
            <SliderInput label="연간 캐리 (YTM)" value={carry} onChange={setCarry}
              min={1.0} max={8.0} step={0.05} unit="%" color={COLORS.safe}
              description="보유기간 경과이자 수익률" />
            <SliderInput label="보유기간" value={holdingMonths} onChange={setHoldingMonths}
              min={1} max={24} step={1} unit="개월" color={COLORS.warn} />
          </Card>

          <Card>
            <SectionTitle icon="🛡️">만기매칭형 채권</SectionTitle>
            <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 12,
              padding: "8px 10px", background: COLORS.bg, borderRadius: 6,
              border: `1px solid ${COLORS.border}`, lineHeight: 1.5 }}>
              만기보유 전제 → 금리 변동 시에도 평가손실 없음. 보유기간 동안 YTM 확정 수익 실현
            </div>
            <SliderInput label="채권 만기" value={safeMaturity} onChange={setSafeMaturity}
              min={0.25} max={5.0} step={0.25} unit="년" color={COLORS.safe}
              description="만기매칭형 채권 잔존만기" />
            <SliderInput label="YTM" value={safeYtm} onChange={setSafeYtm}
              min={1.0} max={6.0} step={0.05} unit="%" color={COLORS.safe}
              description="만기보유 시 확정 수익률" />
            <div style={{ padding: "10px 12px", background: COLORS.bg, borderRadius: 8,
              border: `1px solid ${COLORS.border}`, marginTop: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: COLORS.textMuted }}>{holdingMonths}개월 보유 시 확정수익</span>
                <span style={{ color: COLORS.safe, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>+{fmt(safeReturn)}%</span>
              </div>
              {holdingMonths / 12 > safeMaturity && (
                <div style={{ fontSize: 10, color: COLORS.warn, marginTop: 6 }}>
                  ⚠ 보유기간({holdingMonths}개월)이 채권만기({safeMaturity}년)보다 깁니다. 재투자 필요
                </div>
              )}
            </div>
          </Card>

          <Card>
            <SectionTitle icon="⚖️">편입비중</SectionTitle>
            <SliderInput label="베크플 비중" value={becplWeight} onChange={setBecplWeight}
              min={0} max={100} step={1} unit="%"
              color={becplWeight <= maxAllocation ? COLORS.accent : COLORS.danger} />
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <div style={{ flex: Math.max(becplWeight, 3), background: `linear-gradient(90deg, ${COLORS.accent}44, ${COLORS.accent}22)`,
                borderRadius: 6, padding: "8px 10px", textAlign: "center", fontSize: 11, fontWeight: 600,
                border: `1px solid ${COLORS.accent}44`, color: COLORS.accent, transition: "flex 0.3s", overflow: "hidden", whiteSpace: "nowrap" }}>
                {becplWeight > 15 ? `베크플 ${becplWeight}%` : becplWeight > 5 ? `${becplWeight}%` : ""}
              </div>
              <div style={{ flex: Math.max(safeWeight, 3), background: `linear-gradient(90deg, ${COLORS.safe}22, ${COLORS.safe}44)`,
                borderRadius: 6, padding: "8px 10px", textAlign: "center", fontSize: 11, fontWeight: 600,
                border: `1px solid ${COLORS.safe}44`, color: COLORS.safe, transition: "flex 0.3s", overflow: "hidden", whiteSpace: "nowrap" }}>
                {safeWeight > 15 ? `만기매칭 ${safeWeight}%` : safeWeight > 5 ? `${safeWeight}%` : ""}
              </div>
            </div>
            {becplWeight > maxAllocation ? (
              <div style={{ marginTop: 10, padding: "8px 12px", background: COLORS.dangerGlow,
                borderRadius: 8, border: `1px solid ${COLORS.danger}33`, fontSize: 12, color: COLORS.danger, fontWeight: 500 }}>
                ⚠ 현재 시나리오에서 마이너스 발생! 최대 {fmt(maxAllocation, 1)}% 이하로 조정 필요
              </div>
            ) : (
              <div style={{ marginTop: 10, padding: "8px 12px", background: COLORS.safeGlow,
                borderRadius: 8, border: `1px solid ${COLORS.safe}33`, fontSize: 12, color: COLORS.safe, fontWeight: 500 }}>
                ✓ 전체 구조 플러스 유지 (여유 {fmt(maxAllocation - becplWeight, 1)}%p)
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle icon="🔥">스트레스 시나리오</SectionTitle>
            <SliderInput label="국고3년 금리 변동" value={rateChg} onChange={setRateChg}
              min={0} max={150} step={1} unit="bp" color={COLORS.danger}
              description="기준금리/국고채 금리 상승폭" />
            <SliderInput label="크레딧스프레드 변동" value={spreadChg} onChange={setSpreadChg}
              min={0} max={100} step={1} unit="bp" color={COLORS.warn}
              description="신용스프레드 확대폭" />

            <div style={{ marginTop: 12, padding: 12, background: COLORS.bg, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 8, fontWeight: 600 }}>베크플 손익 분해</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: COLORS.textMuted }}>① 캐리 수익 ({holdingMonths}개월)</span>
                  <span style={{ color: COLORS.safe, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>+{fmt(carryIncome)}%</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: COLORS.textMuted }}>② 금리↑ 손실 (dur {fmt(duration, 1)} × {rateChg}bp)</span>
                  <span style={{ color: COLORS.danger, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>−{fmt(rateLoss)}%</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: COLORS.textMuted }}>③ 스프레드↑ 손실 (dur {fmt(duration, 1)} × {spreadChg}bp)</span>
                  <span style={{ color: COLORS.danger, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>−{fmt(spreadLoss)}%</span>
                </div>
                <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: 4, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                  <span style={{ color: COLORS.text }}>베크플 순수익 (①−②−③)</span>
                  <span style={{ color: becplReturn >= 0 ? COLORS.safe : COLORS.danger, fontFamily: "'JetBrains Mono', monospace" }}>{fmtSign(becplReturn)}%</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 10, padding: 12, background: COLORS.bg, borderRadius: 8, border: `1px solid ${COLORS.accent}33` }}>
              <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 8, fontWeight: 600 }}>전체 포트폴리오 합산</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: COLORS.textMuted }}>베크플 기여 ({becplWeight}% × {fmtSign(becplReturn)}%)</span>
                  <span style={{ color: becplReturn * becplWeight >= 0 ? COLORS.safe : COLORS.danger,
                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{fmtSign(becplWeight / 100 * becplReturn)}%</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: COLORS.textMuted }}>만기매칭 기여 ({safeWeight}% × +{fmt(safeReturn)}%)</span>
                  <span style={{ color: COLORS.safe, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>+{fmt(safeWeight / 100 * safeReturn)}%</span>
                </div>
                <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: 4, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                  <span style={{ color: COLORS.text }}>전체 수익률</span>
                  <span style={{ color: totalReturn >= 0 ? COLORS.safe : COLORS.danger,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 15 }}>{fmtSign(totalReturn)}%</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <SectionTitle icon="🗺️">시나리오 히트맵</SectionTitle>
              <div style={{ fontSize: 10, color: COLORS.textDim, padding: "4px 8px", background: COLORS.bg, borderRadius: 4 }}>
                베크플 {becplWeight}% + 만기매칭 {safeWeight}% | 전체 수익률(%)
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              <NumberInput label="금리 최대" value={hmRateMax} onChange={setHmRateMax} min={10} max={200} step={5} unit="bp" />
              <NumberInput label="스프레드 최대" value={hmSpreadMax} onChange={setHmSpreadMax} min={10} max={150} step={5} unit="bp" />
              <NumberInput label="간격" value={hmStep} onChange={setHmStep} min={1} max={20} step={1} unit="bp" />
            </div>
            <Heatmap rateRange={[0, hmRateMax, hmStep]} spreadRange={[0, hmSpreadMax, hmStep]} calcReturn={calcHeatmapReturn} />
            <div style={{ display: "flex", gap: 16, marginTop: 12, justifyContent: "center" }}>
              {[["rgba(16,185,129,0.4)", "플러스"], ["rgba(245,158,11,0.3)", "0 근접"], ["rgba(239,68,68,0.5)", "마이너스"]].map(([bg, lbl]) => (
                <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: bg }} />
                  <span style={{ fontSize: 10, color: COLORS.textDim }}>{lbl}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle icon="📐">손익분기 분석</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                { title: "스프레드 불변 시", sub: "금리 상승 한도", val: breakEvenInfo.rateOnly, fmt: v => v > 0 ? `+${v}bp` : ">300bp" },
                { title: "금리 불변 시", sub: "스프레드 확대 한도", val: breakEvenInfo.spreadOnly, fmt: v => v > 0 ? `+${v}bp` : ">300bp" },
                { title: "동시 발생 시 (1:1)", sub: "금리·스프레드 한도", val: breakEvenInfo.both, fmt: v => v > 0 ? `각 +${v}bp` : ">300bp" },
              ].map((item) => (
                <div key={item.title} style={{ padding: 14, background: COLORS.bg, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 6 }}>{item.title}</div>
                  <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 4 }}>{item.sub}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: item.val > 0 ? COLORS.warn : COLORS.safe,
                    fontFamily: "'JetBrains Mono', monospace" }}>{item.fmt(item.val)}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle icon="📋">설계 요약</SectionTitle>
            <div style={{ padding: 14, background: COLORS.bg, borderRadius: 8, border: `1px solid ${COLORS.border}`,
              fontSize: 12, color: COLORS.textMuted, lineHeight: 1.8 }}>
              <b style={{ color: COLORS.text }}>베크플</b>{" "}
              <span style={{ color: COLORS.accent, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{becplWeight}%</span>
              {" "}+{" "}
              <b style={{ color: COLORS.text }}>만기매칭형 채권</b>{" "}
              <span style={{ color: COLORS.safe, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{safeWeight}%</span>
              {" "}(만기 {safeMaturity}년, YTM {fmt(safeYtm)}%) 구조로{" "}
              <b style={{ color: COLORS.text }}>{holdingMonths}개월</b> 보유 시,
              <br />
              국고3년 <span style={{ color: COLORS.danger, fontWeight: 600 }}>+{rateChg}bp</span> 상승 &{" "}
              크레딧스프레드 <span style={{ color: COLORS.warn, fontWeight: 600 }}>+{spreadChg}bp</span> 확대가 동시 발생하더라도
              <br />
              → 전체 수익률{" "}
              <b style={{ color: totalReturn >= 0 ? COLORS.safe : COLORS.danger,
                fontSize: 14, fontFamily: "'JetBrains Mono', monospace" }}>{fmtSign(totalReturn)}%</b>
              {totalReturn >= 0 ? " — 마이너스 방어 성공 ✓" : " — 마이너스 발생, 비중 조정 필요 ✗"}
            </div>
          </Card>

          <Card>
            <SectionTitle icon="💡">설계 포인트</SectionTitle>
            <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.7 }}>
              <p style={{ margin: "0 0 10px" }}>
                <b style={{ color: COLORS.text }}>만기매칭형의 역할:</b> 금리가 아무리 올라도 만기보유 시 평가손실 없이
                YTM({fmt(safeYtm)}%)만큼 확정 수익을 가져갑니다. 이 확정 수익이 베크플의 MDD를 흡수하는 쿠션 역할.
              </p>
              <p style={{ margin: "0 0 10px" }}>
                <b style={{ color: COLORS.text }}>투자자 설득 로직:</b> &quot;채권 펀드인데 마이너스&quot;라는 해지 사유를 구조적으로 차단.
                히트맵으로 &quot;이 정도로 가혹한 시나리오에서도 전체 구조는 플러스&quot;를 시각적으로 증명.
              </p>
              <p style={{ margin: 0 }}>
                <b style={{ color: COLORS.text }}>핵심 조절 변수:</b> 보유기간 ↑ → 캐리 축적으로 방어력 ↑ /
                만기매칭 YTM ↑ → 버퍼 ↑ / 베크플 듀레이션 ↓ → 금리·스프레드 민감도 ↓
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", marginTop: 24, padding: "12px 0", fontSize: 10,
        color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.8 }}>
        WOLF PACK EXPEDITION · PORTFOLIO LAYER · BECPL MDD SHIELD v1.0
      </div>
    </div>
  );
}
