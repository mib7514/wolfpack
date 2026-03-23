"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// 상수 & 유틸
// ═══════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
  안정: { color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)", label: "STABLE" },
  주의: { color: "#eab308", bg: "rgba(234,179,8,0.12)", border: "rgba(234,179,8,0.3)", label: "CAUTION" },
  경고: { color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)", label: "WARNING" },
  위험: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", label: "DANGER" },
  위기: { color: "#dc2626", bg: "rgba(220,38,38,0.18)", border: "rgba(220,38,38,0.5)", label: "CRISIS" },
};

const TREND_ICONS = {
  급등: "⬆️", 상승: "↗️", 보합: "➡️", 하락: "↘️", 급락: "⬇️",
};

const CAT_COLORS = {
  energy_raw: "#f97316",
  fx_multiplier: "#a855f7",
  logistics: "#3b82f6",
  supply_disruption: "#dc2626",
  intermediate: "#8b5cf6",
  food_shock: "#10b981",
  core_services: "#ec4899",
  expectations: "#eab308",
  wage_second: "#64748b",
};

const FX_BANDS = [
  { min: 0, max: 1400, color: "rgba(34,197,94,0.08)", label: "< 1,400", mult: 1.00 },
  { min: 1400, max: 1450, color: "rgba(234,179,8,0.08)", label: "1,400~1,450", mult: 1.05 },
  { min: 1450, max: 1500, color: "rgba(249,115,22,0.08)", label: "1,450~1,500", mult: 1.10 },
  { min: 1500, max: 1550, color: "rgba(239,68,68,0.08)", label: "1,500~1,550", mult: 1.15 },
  { min: 1550, max: 9999, color: "rgba(220,38,38,0.12)", label: "> 1,550", mult: 1.25 },
];

function getScoreStatus(score) {
  if (score <= 20) return "안정";
  if (score <= 45) return "주의";
  if (score <= 65) return "경고";
  if (score <= 85) return "위험";
  return "위기";
}

function getFxMultiplier(fxScore) {
  // fxScore에서 환율 수준을 추정 (AI가 usdkrw_level indicator에 별도 제공)
  // 여기서는 fx_multiplier 카테고리의 score를 기반으로 승수 산출
  if (fxScore <= 25) return 1.00;
  if (fxScore <= 45) return 1.05;
  if (fxScore <= 65) return 1.10;
  if (fxScore <= 80) return 1.15;
  return 1.25;
}

function computeCompositeIndex(categories, framework) {
  if (!categories || !framework?.categories) return null;
  let weightedSum = 0;
  let totalWeight = 0;
  let fxScore = 0;

  for (const cat of framework.categories) {
    const catData = categories[cat.id];
    if (!catData) continue;
    weightedSum += cat.weight * catData.score;
    totalWeight += cat.weight;
    if (cat.id === "fx_multiplier") fxScore = catData.score;
  }

  if (totalWeight === 0) return null;
  const baseIndex = weightedSum / totalWeight;
  const multiplier = getFxMultiplier(fxScore);
  return Math.min(100, Math.round(baseIndex * multiplier));
}

function extractJSON(text) {
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") { if (depth === 0) start = i; depth++; }
    else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        try { return JSON.parse(text.substring(start, i + 1)); } catch (e) { start = -1; }
      }
    }
  }
  return null;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

// ═══════════════════════════════════════════════════════════════
// AI Prompt Builder v2.0
// ═══════════════════════════════════════════════════════════════

function buildPrompts(framework) {
  const today = new Date().toISOString().split("T")[0];

  const systemPrompt = `당신은 CPI 확산 모니터링 v2.0 전문 분석가입니다.

[분석 프레임워크]
9개 카테고리: 에너지/원료, 환율 승수, 물류/보험, 공급 단절, 중간재 스프레드, 비에너지 식품 쇼크, 코어 서비스, 기대인플레, 임금/2차파급.

[핵심 v2.0 변경]
1. 환율 승수: 원/달러 환율이 다른 모든 채널을 증폭하는 multiplicative 효과. usdkrw_level 지표에 현재 원/달러 환율 수치를 반드시 analysis에 포함.
2. 공급 단절: NCC 가동률, Force Majeure, 나프타 재고 등 물리적 공급 중단. 가격 스프레드에 선행하는 물량 지표.
3. 비에너지 식품 쇼크: ASF/HPAI 등 질병 기반 독립 공급 충격 + 환율 결합 이중 압력.

[스코어링] 0~20 안정, 21~45 주의, 46~65 경고, 66~85 위험, 86~100 위기.
[관점] 한국·미국·글로벌. 오늘: ${today}

[추가 분석 필드]
- fx_level: 현재 원/달러 환율 수치 (숫자)
- fx_multiplier_value: 환율 승수 계수 (1.00~1.25)
- supply_constraint_flag: 공급 단절 인덱스 60+ 시 true
- stagflation_signal: 공급단절 위험+ & 코어서비스+임금 하락 시 true

중요: 토큰 절약. 모든 텍스트 필드는 1문장(40자 이내). JSON만 응답(markdown 코드블록 없이):
{
  "categories": {
    "[category_id]": {
      "score": number,
      "status": "안정|주의|경고|위험|위기",
      "summary": "1문장 요약",
      "indicators": {
        "[indicator_id]": {
          "score": number,
          "trend": "상승|하락|보합|급등|급락",
          "analysis": "핵심 수치 포함 1문장"
        }
      }
    }
  },
  "fx_level": number,
  "fx_multiplier_value": number,
  "supply_constraint_flag": boolean,
  "stagflation_signal": boolean,
  "overall_index": number,
  "overall_status": "안정|주의|경고|위험|위기",
  "overall_summary": "종합 판단 2문장 이내",
  "key_signals": ["신호1", "신호2", "신호3", "신호4"],
  "scenario_update": {
    "base": "1문장",
    "upside": "1문장",
    "downside": "1문장"
  }
}`;

  const categories = framework.categories;
  const categoryDescriptions = categories.map((c) => {
    const indDesc = c.indicators.map((ind) => `  - ${ind.id}: ${ind.name} — ${ind.description}`).join("\n");
    return `### ${c.name} (${c.id}, 가중치 ${(c.weight * 100).toFixed(0)}%, 단계: ${c.stage})
${c.description}
${indDesc}`;
  }).join("\n\n");

  const userPrompt = `아래 v2.0 프레임워크의 9개 카테고리·지표를 분석.

[v2.0 중점 분석 항목]
- 환율: 원/달러 현재 수준, NDF 방향, 수입물가 전이
- 공급 단절: NCC 가동률(여수/대산/울산), FM 선언, 나프타 재고
- 식품 쇼크: ASF/HPAI 현황, 축산물·쌀·수입식품 가격
- 기존: 중동/호르무즈, 해운+화물운임, 석화 스프레드, 코어서비스 MoM, BEI, 임금전가

[종합지수] overall_index = Σ(Wi × Ci) × fx_multiplier_value로 산출. 100 초과 시 100으로 cap.
[스태그플레이션] supply_disruption ≥ 66 이면서 core_services + wage_second 평균 ≤ 40이면 stagflation_signal = true.

${categoryDescriptions}

JSON 형식으로만 응답.`;

  return { systemPrompt, userPrompt };
}

// ═══════════════════════════════════════════════════════════════
// 공통 UI 컴포넌트
// ═══════════════════════════════════════════════════════════════

function ScoreGauge({ score, size = 80, showMultiplier, fxMult }) {
  const status = getScoreStatus(score);
  const cfg = STATUS_CONFIG[status];
  const circumference = 2 * Math.PI * 34;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <svg width={size} height={size} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx="40" cy="40" r="34" fill="none" stroke={cfg.color} strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 40 40)" style={{ transition: "stroke-dashoffset 1s ease" }} />
        <text x="40" y="36" textAnchor="middle" fill={cfg.color} fontSize="18" fontWeight="700">{score}</text>
        <text x="40" y="50" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontWeight="500">{cfg.label}</text>
      </svg>
      {showMultiplier && fxMult > 1.0 && (
        <div style={{
          position: "absolute", top: -4, right: -8, background: "#a855f7",
          borderRadius: 6, padding: "1px 5px", fontSize: 9, fontWeight: 700, color: "#fff",
          boxShadow: "0 2px 8px rgba(168,85,247,0.4)",
        }}>×{fxMult.toFixed(2)}</div>
      )}
    </div>
  );
}

function ScoreBar({ score, height = 6 }) {
  const status = getScoreStatus(score);
  const cfg = STATUS_CONFIG[status];
  return (
    <div style={{ width: "100%", height, background: "rgba(255,255,255,0.06)", borderRadius: height / 2, overflow: "hidden" }}>
      <div style={{ width: `${score}%`, height: "100%", background: cfg.color, borderRadius: height / 2, transition: "width 0.8s ease" }} />
    </div>
  );
}

function Badge({ text, color, bg }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: bg, color, letterSpacing: 0.5 }}>{text}</span>
  );
}

// ═══════════════════════════════════════════════════════════════
// FX 승수 인디케이터 배너
// ═══════════════════════════════════════════════════════════════

function FxMultiplierBanner({ overall }) {
  const fxLevel = overall?.fx_level;
  const fxMult = overall?.fx_multiplier_value;
  const supplyFlag = overall?.supply_constraint_flag;
  const stagSignal = overall?.stagflation_signal;

  if (!fxLevel && !fxMult) return null;

  const fxBand = FX_BANDS.find(b => fxLevel >= b.min && fxLevel < b.max) || FX_BANDS[FX_BANDS.length - 1];

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16,
    }}>
      {/* FX 승수 */}
      <div style={{
        background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.25)",
        borderRadius: 12, padding: "14px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>💱</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>환율 승수</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          {fxLevel && (
            <span style={{ fontSize: 22, fontWeight: 800, color: "#a855f7" }}>₩{fxLevel.toLocaleString()}</span>
          )}
          {fxMult && (
            <span style={{
              fontSize: 13, fontWeight: 700, color: fxMult > 1.1 ? "#ef4444" : fxMult > 1.0 ? "#eab308" : "#22c55e",
              background: fxMult > 1.1 ? "rgba(239,68,68,0.12)" : fxMult > 1.0 ? "rgba(234,179,8,0.12)" : "rgba(34,197,94,0.12)",
              padding: "2px 6px", borderRadius: 4,
            }}>×{fxMult.toFixed(2)}</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{fxBand.label} 구간</div>
      </div>

      {/* 플래그 */}
      <div style={{
        background: stagSignal ? "rgba(220,38,38,0.08)" : supplyFlag ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${stagSignal ? "rgba(220,38,38,0.3)" : supplyFlag ? "rgba(249,115,22,0.25)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 12, padding: "14px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>{stagSignal ? "🚨" : supplyFlag ? "⚠️" : "✅"}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>경보 상태</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: supplyFlag ? "#f97316" : "#22c55e" }} />
            <span style={{ fontSize: 12, color: supplyFlag ? "#f97316" : "rgba(255,255,255,0.4)" }}>
              공급 제약 {supplyFlag ? "발동" : "정상"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: stagSignal ? "#dc2626" : "#22c55e" }} />
            <span style={{ fontSize: 12, color: stagSignal ? "#dc2626" : "rgba(255,255,255,0.4)" }}>
              스태그플레이션 {stagSignal ? "경보" : "정상"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 카테고리 카드
// ═══════════════════════════════════════════════════════════════

function CategoryCard({ category, catData, framework, expanded, onToggle, supplyFlag }) {
  const fwCat = framework.categories.find((c) => c.id === category);
  if (!fwCat || !catData) return null;
  const cfg = STATUS_CONFIG[catData.status] || STATUS_CONFIG["주의"];

  // 공급 제약 플래그: intermediate 카테고리 + supplyFlag 활성 시
  const showSupplyFlag = category === "intermediate" && supplyFlag;

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: `1px solid ${expanded ? cfg.border : "rgba(255,255,255,0.06)"}`,
      borderRadius: 16, overflow: "hidden", transition: "border-color 0.3s ease",
    }}>
      <div onClick={onToggle} style={{
        padding: "18px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14,
        borderBottom: expanded ? "1px solid rgba(255,255,255,0.06)" : "none",
      }}>
        <span style={{ fontSize: 24 }}>{fwCat.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{fwCat.name}</span>
            <Badge text={catData.status} color={cfg.color} bg={cfg.bg} />
            {fwCat.stage && (
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", padding: "1px 5px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3 }}>{fwCat.stage}</span>
            )}
            {showSupplyFlag && (
              <span style={{ fontSize: 9, fontWeight: 700, color: "#f97316", background: "rgba(249,115,22,0.15)", padding: "1px 6px", borderRadius: 3 }}>🏭 공급 제약</span>
            )}
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>{(fwCat.weight * 100).toFixed(0)}%</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ScoreBar score={catData.score} />
            <span style={{ fontSize: 14, fontWeight: 700, color: cfg.color, minWidth: 28 }}>{catData.score}</span>
          </div>
        </div>
        <span style={{ fontSize: 16, color: "rgba(255,255,255,0.25)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
      </div>

      {expanded && (
        <div style={{ padding: "14px 20px 20px" }}>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 16 }}>{catData.summary}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {fwCat.indicators.map((ind) => {
              const indData = catData.indicators?.[ind.id];
              if (!indData) return null;
              const indStatus = getScoreStatus(indData.score);
              const indCfg = STATUS_CONFIG[indStatus];
              return (
                <div key={ind.id} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#cbd5e1" }}>{ind.name}</span>
                    <span style={{ fontSize: 13 }}>{TREND_ICONS[indData.trend] || "➡️"}</span>
                    <span style={{ fontSize: 11, color: indCfg.color, fontWeight: 600, marginLeft: "auto" }}>{indData.score}</span>
                  </div>
                  <ScoreBar score={indData.score} height={4} />
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, marginTop: 6, margin: "6px 0 0" }}>{indData.analysis}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 시나리오 / 핵심신호
// ═══════════════════════════════════════════════════════════════

function ScenarioPanel({ scenario }) {
  if (!scenario) return null;
  const items = [
    { key: "base", label: "베이스", emoji: "⚖️", color: "#eab308" },
    { key: "upside", label: "상방 (구조적 인플레)", emoji: "🔺", color: "#ef4444" },
    { key: "downside", label: "하방 (스파이크 후 둔화)", emoji: "🔻", color: "#22c55e" },
  ];
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", padding: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>🎯 시나리오 업데이트</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((item) => (
          <div key={item.key} style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", borderLeft: `3px solid ${item.color}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: item.color, marginBottom: 4 }}>{item.emoji} {item.label}</div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, margin: 0 }}>{scenario[item.key]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function KeySignals({ signals }) {
  if (!signals || signals.length === 0) return null;
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", padding: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>📡 핵심 신호</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {signals.map((sig, i) => (
          <div key={i} style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ color: "#f97316", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>#{i + 1}</span>
            {sig}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 히트맵 (9개 카테고리)
// ═══════════════════════════════════════════════════════════════

function HeatmapRow({ categories, catDataMap, framework }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(categories.length, 5)}, 1fr)`, gap: 6 }}>
      {categories.map((catId) => {
        const fwCat = framework.categories.find((c) => c.id === catId);
        const catData = catDataMap?.[catId];
        if (!fwCat || !catData) return <div key={catId} />;
        const cfg = STATUS_CONFIG[catData.status] || STATUS_CONFIG["주의"];
        return (
          <div key={catId} style={{ background: cfg.bg, borderRadius: 10, padding: "10px 6px", border: `1px solid ${cfg.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 18, marginBottom: 2 }}>{fwCat.emoji}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 3, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fwCat.name.split("/")[0]}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: cfg.color }}>{catData.score}</div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 인플레이션 전이 경로 v2.0 (9개 노드)
// ═══════════════════════════════════════════════════════════════

function PropagationFlow({ catDataMap }) {
  // 전이 경로: 에너지 → 환율(승수) → 물류 → 공급단절 → 중간재 → 식품(독립) → 코어서비스 → 기대인플레 → 임금
  const steps = [
    { id: "energy_raw", label: "에너지", stage: "1차" },
    { id: "fx_multiplier", label: "환율 승수", stage: "승수" },
    { id: "logistics", label: "물류", stage: "1.5차" },
    { id: "supply_disruption", label: "공급 단절", stage: "2차 선행" },
    { id: "intermediate", label: "중간재", stage: "2차" },
    { id: "food_shock", label: "식품 쇼크", stage: "독립" },
    { id: "core_services", label: "코어서비스", stage: "3차" },
    { id: "expectations", label: "기대인플레", stage: "심리" },
    { id: "wage_second", label: "임금/파급", stage: "고착" },
  ];

  return (
    <div style={{ marginTop: 20, background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", padding: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>🔗 인플레이션 전이 경로 v2.0</h3>

      {/* 상단: 메인 전이 경로 (에너지 → 환율 → 물류 → 중간재 → 코어 → 기대 → 임금) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, flexWrap: "wrap", padding: "8px 0" }}>
        {steps.filter(s => s.id !== "supply_disruption" && s.id !== "food_shock").map((step, i, arr) => {
          const cat = catDataMap[step.id];
          const score = cat?.score || 0;
          const status = cat?.status || "안정";
          const cfg = STATUS_CONFIG[status];
          const isMultiplier = step.id === "fx_multiplier";
          return (
            <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{
                background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10,
                padding: "8px 10px", textAlign: "center", minWidth: 72,
                boxShadow: isMultiplier ? `0 0 12px ${cfg.border}` : "none",
              }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 1 }}>{step.stage}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#cbd5e1", marginBottom: 3 }}>{step.label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: cfg.color }}>{score}</div>
              </div>
              {i < arr.length - 1 && <span style={{ fontSize: 14, color: "rgba(255,255,255,0.12)" }}>→</span>}
            </div>
          );
        })}
      </div>

      {/* 하단: 독립 채널 (공급 단절 / 식품 쇼크) */}
      <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 12 }}>
        {steps.filter(s => s.id === "supply_disruption" || s.id === "food_shock").map((step) => {
          const cat = catDataMap[step.id];
          const score = cat?.score || 0;
          const status = cat?.status || "안정";
          const cfg = STATUS_CONFIG[status];
          return (
            <div key={step.id} style={{
              background: cfg.bg, border: `1px dashed ${cfg.border}`, borderRadius: 10,
              padding: "8px 16px", textAlign: "center", minWidth: 100,
            }}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>{step.stage}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#cbd5e1", marginBottom: 3 }}>{step.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: cfg.color }}>{score}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>
                {step.id === "supply_disruption" ? "→ 중간재에 선행" : "→ 코어서비스에 합류"}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 10 }}>
        메인 경로: 1차(원료) → 환율(승수) → 1.5차(물류) → 2차(중간재) → 3차(서비스) → 심리 → 고착 ┃ 독립 채널: 공급 단절(물량) · 식품 쇼크(질병)
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📈 시계열 차트 (SVG) v2.0 — FX 밴드 오버레이 포함
// ═══════════════════════════════════════════════════════════════

function TimeSeriesChart({ history, framework }) {
  const W = 820, H = 380, PAD = { top: 30, right: 24, bottom: 60, left: 48 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const sorted = useMemo(() =>
    [...history].sort((a, b) => new Date(a.snapshot_date) - new Date(b.snapshot_date)),
    [history]
  );

  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [showCategories, setShowCategories] = useState(true);
  const [showFxOverlay, setShowFxOverlay] = useState(true);

  if (sorted.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "50px 24px", color: "rgba(255,255,255,0.4)" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
        <div style={{ fontSize: 13 }}>히스토리 데이터가 없습니다. AI 업데이트를 2회 이상 실행하면 시계열이 표시됩니다.</div>
      </div>
    );
  }

  const catIds = framework?.categories?.map(c => c.id) || [];

  const points = sorted.map((row) => {
    const d = row.data;
    const overall = d?.overall_index ?? 0;
    const fxLevel = d?.fx_level ?? null;
    const fxMult = d?.fx_multiplier_value ?? null;
    const cats = {};
    catIds.forEach(cid => { cats[cid] = d?.categories?.[cid]?.score ?? null; });
    return { date: row.snapshot_date, overall, fxLevel, fxMult, cats, updatedAt: row.updated_at };
  });

  const n = points.length;
  const xScale = (i) => PAD.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yScale = (v) => PAD.top + plotH - (v / 100) * plotH;

  const buildPath = (getData) => {
    const vals = points.map((p, i) => ({ x: xScale(i), y: yScale(getData(p)) }));
    return vals.map((v, i) => `${i === 0 ? "M" : "L"}${v.x},${v.y}`).join(" ");
  };

  const zones = [
    { y0: 0, y1: 20, color: "rgba(34,197,94,0.05)", label: "안정" },
    { y0: 20, y1: 45, color: "rgba(234,179,8,0.05)", label: "주의" },
    { y0: 45, y1: 65, color: "rgba(249,115,22,0.05)", label: "경고" },
    { y0: 65, y1: 85, color: "rgba(239,68,68,0.05)", label: "위험" },
    { y0: 85, y1: 100, color: "rgba(220,38,38,0.08)", label: "위기" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10, gap: 6 }}>
        {[
          { key: "cat", label: "카테고리", active: showCategories, toggle: () => setShowCategories(!showCategories) },
          { key: "fx", label: "💱 FX 승수", active: showFxOverlay, toggle: () => setShowFxOverlay(!showFxOverlay) },
        ].map(btn => (
          <button key={btn.key} onClick={btn.toggle} style={{
            padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)",
            background: btn.active ? "rgba(255,255,255,0.08)" : "transparent",
            color: btn.active ? "#e2e8f0" : "rgba(255,255,255,0.35)", fontSize: 10, cursor: "pointer",
          }}>{btn.label}</button>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <svg
          width={W} height={H} viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", height: "auto", maxHeight: 380 }}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Background zones (5단계) */}
          {zones.map((z, i) => (
            <g key={i}>
              <rect x={PAD.left} y={yScale(z.y1)} width={plotW} height={yScale(z.y0) - yScale(z.y1)} fill={z.color} />
              <text x={PAD.left - 6} y={yScale(z.y1) + 10} textAnchor="end" fill="rgba(255,255,255,0.18)" fontSize="8">{z.y1}</text>
            </g>
          ))}
          {[0, 20, 45, 65, 85, 100].map(v => (
            <line key={v} x1={PAD.left} x2={PAD.left + plotW} y1={yScale(v)} y2={yScale(v)} stroke="rgba(255,255,255,0.05)" strokeDasharray="4,4" />
          ))}
          <text x={PAD.left - 6} y={yScale(0) + 4} textAnchor="end" fill="rgba(255,255,255,0.18)" fontSize="8">0</text>

          {/* FX 승수 오버레이 (각 포인트 구간에 색상 밴드) */}
          {showFxOverlay && points.map((p, i) => {
            if (p.fxMult === null || p.fxMult <= 1.0) return null;
            const band = FX_BANDS.find(b => p.fxLevel >= b.min && p.fxLevel < b.max);
            if (!band) return null;
            const w = n === 1 ? plotW : plotW / (n - 1);
            const x = xScale(i) - w / 2;
            return (
              <rect key={`fx-${i}`} x={Math.max(PAD.left, x)} y={PAD.top} width={Math.min(w, PAD.left + plotW - x)}
                height={plotH} fill={band.color} opacity={0.6} />
            );
          })}

          {/* Category lines */}
          {showCategories && catIds.map(cid => {
            const color = CAT_COLORS[cid] || "#6b7280";
            const hasData = points.some(p => p.cats[cid] !== null);
            if (!hasData) return null;
            return (
              <path key={cid} d={buildPath(p => p.cats[cid] ?? 0)}
                fill="none" stroke={color} strokeWidth="1.2" strokeOpacity="0.35" strokeDasharray="4,3" />
            );
          })}

          {/* Overall line */}
          <path d={buildPath(p => p.overall)} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data points & interactivity */}
          {points.map((p, i) => {
            const cx = xScale(i), cy = yScale(p.overall);
            const isHovered = hoveredIdx === i;
            const status = getScoreStatus(p.overall);
            const cfg = STATUS_CONFIG[status];
            return (
              <g key={i}>
                <rect
                  x={cx - (n === 1 ? plotW / 2 : plotW / (n - 1) / 2)}
                  y={PAD.top} width={n === 1 ? plotW : plotW / (n - 1)}
                  height={plotH} fill="transparent"
                  onMouseEnter={() => setHoveredIdx(i)} style={{ cursor: "pointer" }}
                />
                {isHovered && <line x1={cx} x2={cx} y1={PAD.top} y2={PAD.top + plotH} stroke="rgba(255,255,255,0.12)" strokeDasharray="3,3" />}
                <circle cx={cx} cy={cy} r={isHovered ? 6 : 4} fill={cfg.color} stroke="#0a0c10" strokeWidth="2" style={{ transition: "r 0.15s" }} />
                {isHovered && showCategories && catIds.map(cid => {
                  const v = p.cats[cid];
                  if (v === null) return null;
                  return <circle key={cid} cx={cx} cy={yScale(v)} r={3} fill={CAT_COLORS[cid] || "#6b7280"} stroke="#0a0c10" strokeWidth="1.5" />;
                })}
                {(isHovered || n <= 12) && (
                  <text x={cx} y={cy - 10} textAnchor="middle" fill={cfg.color} fontSize="10" fontWeight="700">{p.overall}</text>
                )}
                <text x={cx} y={H - 16} textAnchor={n <= 7 ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                  fill={isHovered ? "#e2e8f0" : "rgba(255,255,255,0.25)"} fontSize="9"
                  transform={n > 10 ? `rotate(-45 ${cx} ${H - 16})` : ""}>{formatDate(p.date)}</text>
              </g>
            );
          })}

          {/* Hover tooltip */}
          {hoveredIdx !== null && (() => {
            const p = points[hoveredIdx];
            const cx = xScale(hoveredIdx);
            const tooltipW = 200;
            const tooltipX = Math.min(Math.max(cx - tooltipW / 2, PAD.left), W - PAD.right - tooltipW);
            const mainLines = [
              { label: "종합 (×FX)", value: p.overall, color: "#f97316" },
              ...(p.fxLevel ? [{ label: `환율 ₩${p.fxLevel.toLocaleString()}`, value: `×${(p.fxMult || 1).toFixed(2)}`, color: "#a855f7" }] : []),
            ];
            const catLines = catIds.map(cid => {
              const c = framework.categories.find(x => x.id === cid);
              return { label: c?.emoji + " " + (c?.name?.split("/")[0] || cid), value: p.cats[cid], color: CAT_COLORS[cid] };
            });
            const allLines = [...mainLines, ...catLines];
            return (
              <g>
                <rect x={tooltipX} y={PAD.top} width={tooltipW} height={16 + allLines.length * 15 + 8} rx="8" fill="rgba(10,12,16,0.95)" stroke="rgba(255,255,255,0.1)" />
                <text x={tooltipX + 10} y={PAD.top + 13} fill="#e2e8f0" fontSize="9" fontWeight="600">{formatDate(p.date)}</text>
                {allLines.map((l, i) => (
                  <g key={i}>
                    <circle cx={tooltipX + 12} cy={PAD.top + 25 + i * 15} r={2.5} fill={l.color} />
                    <text x={tooltipX + 22} y={PAD.top + 29 + i * 15} fill="rgba(255,255,255,0.55)" fontSize="9">{l.label}</text>
                    <text x={tooltipX + tooltipW - 10} y={PAD.top + 29 + i * 15} textAnchor="end" fill={l.color} fontSize="9" fontWeight="700">{l.value ?? "-"}</text>
                  </g>
                ))}
              </g>
            );
          })()}

          {/* Zone labels */}
          {zones.map((z, i) => (
            <text key={i} x={PAD.left + plotW + 4} y={yScale((z.y0 + z.y1) / 2) + 4} fill="rgba(255,255,255,0.12)" fontSize="7">{z.label}</text>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10, justifyContent: "center" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#f97316" }}>
          <span style={{ width: 14, height: 3, background: "#f97316", borderRadius: 2, display: "inline-block" }} /> 종합×FX
        </span>
        {showCategories && framework?.categories?.map(c => (
          <span key={c.id} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: CAT_COLORS[c.id] || "#6b7280" }}>
            <span style={{ width: 12, height: 2, background: CAT_COLORS[c.id], borderRadius: 2, display: "inline-block", opacity: 0.5 }} /> {c.emoji}
          </span>
        ))}
        {showFxOverlay && (
          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#a855f7" }}>
            <span style={{ width: 12, height: 8, background: "rgba(168,85,247,0.2)", borderRadius: 2, display: "inline-block", border: "1px solid rgba(168,85,247,0.3)" }} /> FX밴드
          </span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📋 히스토리 테이블
// ═══════════════════════════════════════════════════════════════

function HistoryTable({ history, framework, onSelect, selectedDate }) {
  const sorted = useMemo(() =>
    [...history].sort((a, b) => new Date(b.snapshot_date) - new Date(a.snapshot_date)),
    [history]
  );
  const catIds = framework?.categories?.map(c => c.id) || [];

  return (
    <div style={{ overflowX: "auto", marginTop: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>날짜</th>
            <th style={{ padding: "8px 6px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#f97316", fontWeight: 700 }}>종합</th>
            <th style={{ padding: "8px 6px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#a855f7", fontWeight: 600, fontSize: 10 }}>FX</th>
            {framework?.categories?.filter(c => c.id !== "fx_multiplier").map(c => (
              <th key={c.id} style={{ padding: "8px 4px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", color: CAT_COLORS[c.id], fontWeight: 600, fontSize: 10 }}>
                {c.emoji}
              </th>
            ))}
            <th style={{ padding: "8px 6px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>상태</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const d = row.data;
            const overall = d?.overall_index ?? 0;
            const status = d?.overall_status || getScoreStatus(overall);
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["주의"];
            const isSelected = row.snapshot_date === selectedDate;
            const prev = sorted[i + 1]?.data;
            const delta = prev ? overall - (prev.overall_index ?? 0) : null;
            const fxMult = d?.fx_multiplier_value;

            return (
              <tr key={row.id || row.snapshot_date} onClick={() => onSelect(row)} style={{
                cursor: "pointer",
                background: isSelected ? "rgba(249,115,22,0.08)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                borderLeft: isSelected ? "3px solid #f97316" : "3px solid transparent",
              }}>
                <td style={{ padding: "8px 10px", color: isSelected ? "#e2e8f0" : "rgba(255,255,255,0.55)", fontWeight: isSelected ? 600 : 400, whiteSpace: "nowrap", fontSize: 11 }}>
                  {formatDate(row.snapshot_date)}
                </td>
                <td style={{ padding: "8px 6px", textAlign: "center" }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: cfg.color }}>{overall}</span>
                  {delta !== null && delta !== 0 && (
                    <span style={{ fontSize: 9, color: delta > 0 ? "#ef4444" : "#22c55e", marginLeft: 3 }}>
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  )}
                </td>
                <td style={{ padding: "8px 6px", textAlign: "center" }}>
                  {fxMult ? (
                    <span style={{ fontSize: 10, fontWeight: 600, color: fxMult > 1.1 ? "#ef4444" : fxMult > 1.0 ? "#a855f7" : "rgba(255,255,255,0.3)" }}>
                      ×{fxMult.toFixed(2)}
                    </span>
                  ) : <span style={{ color: "rgba(255,255,255,0.15)" }}>-</span>}
                </td>
                {catIds.filter(cid => cid !== "fx_multiplier").map(cid => {
                  const score = d?.categories?.[cid]?.score;
                  const sCfg = score != null ? STATUS_CONFIG[getScoreStatus(score)] : null;
                  return (
                    <td key={cid} style={{ padding: "8px 4px", textAlign: "center" }}>
                      {score != null ? (
                        <span style={{ fontWeight: 600, color: sCfg?.color || "rgba(255,255,255,0.5)", fontSize: 11 }}>{score}</span>
                      ) : (
                        <span style={{ color: "rgba(255,255,255,0.15)" }}>-</span>
                      )}
                    </td>
                  );
                })}
                <td style={{ padding: "8px 6px", textAlign: "center" }}>
                  <Badge text={status} color={cfg.color} bg={cfg.bg} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 🏠 메인 페이지
// ═══════════════════════════════════════════════════════════════

export default function InflationMonitorPage() {
  const [data, setData] = useState(null);
  const [framework, setFramework] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});
  const [updateLog, setUpdateLog] = useState("");
  const [tab, setTab] = useState("current");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/inflation-monitor");
      const json = await res.json();
      if (json.framework) setFramework(json.framework);
      if (json.data) setData(json.data);
    } catch (err) {
      setError("데이터 로딩 실패: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/inflation-monitor?action=history");
      const json = await res.json();
      if (json.history) setHistory(json.history);
    } catch (err) {
      console.error("히스토리 로딩 실패:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (tab === "history" && history.length === 0) fetchHistory();
  }, [tab, history.length, fetchHistory]);

  // ─── AI 업데이트 ───
  const handleAIUpdate = async () => {
    if (!pin || !framework) return;
    setUpdating(true);
    setError("");

    try {
      setUpdateLog("🔐 관리자 인증 중...");
      const keyRes = await fetch("/api/inflation-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify({ action: "get_api_key" }),
      });
      const keyJson = await keyRes.json();
      if (keyJson.error) { setError(keyJson.error); setUpdateLog(""); setUpdating(false); return; }
      const apiKey = keyJson.apiKey;

      setUpdateLog("🤖 AI가 9개 카테고리 30+ 지표를 분석 중... (40~80초 소요)");
      const { systemPrompt, userPrompt } = buildPrompts(framework);

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 6144,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      const aiRawText = await aiRes.text();
      let aiData;
      try { aiData = JSON.parse(aiRawText); } catch (e) {
        setError(`AI API 응답 파싱 실패 (HTTP ${aiRes.status}): ${aiRawText.substring(0, 300)}`);
        setUpdateLog(""); setUpdating(false); return;
      }

      if (aiData.error) {
        setError(`AI API 오류: ${aiData.error.message || JSON.stringify(aiData.error)}`);
        setUpdateLog(""); setUpdating(false); return;
      }

      const textBlocks = (aiData.content || []).filter((b) => b.type === "text").map((b) => b.text);
      const parsed = extractJSON(textBlocks.join("\n"));
      if (!parsed) {
        setError("AI 응답에서 JSON을 추출할 수 없습니다: " + textBlocks.join("\n").substring(0, 300));
        setUpdateLog(""); setUpdating(false); return;
      }

      // v2.0: 클라이언트 측 종합지수 재검증
      if (parsed.categories && framework) {
        const recomputed = computeCompositeIndex(parsed.categories, framework);
        if (recomputed !== null) {
          parsed.overall_index = recomputed;
          parsed.overall_status = getScoreStatus(recomputed);
        }
      }

      setUpdateLog("💾 분석 결과 저장 중...");
      const saveRes = await fetch("/api/inflation-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify({ action: "save_result", analysisData: parsed }),
      });
      const saveJson = await saveRes.json();
      if (saveJson.error) { setError("저장 실패: " + saveJson.error); setUpdateLog(""); setUpdating(false); return; }

      setData(saveJson.data);
      setShowPin(false);
      setPin("");
      if (history.length > 0) fetchHistory();
      setUpdateLog("✅ v2.0 업데이트 완료!");
      setTimeout(() => setUpdateLog(""), 3000);

    } catch (err) {
      setError("업데이트 실패: " + err.message);
      setUpdateLog("");
    } finally {
      setUpdating(false);
    }
  };

  // ─── 렌더링 데이터 ───
  const catOrder = framework?.categories?.map((c) => c.id) || [];
  const displayData = selectedSnapshot || data;
  const catDataMap = displayData?.data?.categories || {};
  const overall = displayData?.data;
  const overallScore = overall?.overall_index;
  const overallStatus = overall?.overall_status;
  const overallCfg = overallStatus ? STATUS_CONFIG[overallStatus] : null;
  const displayDate = selectedSnapshot?.snapshot_date || data?.snapshot_date;
  const fxMult = overall?.fx_multiplier_value || 1.0;
  const supplyFlag = overall?.supply_constraint_flag || false;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0c10", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📡</div>
          <div>CPI 확산 모니터 v2.0 로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0c10", fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", color: "#e2e8f0" }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0", maxWidth: 920, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <a href="/" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>← 컨트롤타워</a>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.04)", padding: "2px 6px", borderRadius: 4 }}>v2.0</span>
            <button onClick={() => setShowPin(!showPin)} style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, padding: "5px 12px", fontSize: 11, color: "rgba(255,255,255,0.5)", cursor: "pointer",
            }}>🔐 AI 업데이트</button>
          </div>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 800, margin: "12px 0 3px", letterSpacing: -0.5 }}>🌡️ CPI 확산 모니터</h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: "0 0 14px" }}>
          9개 채널 × 환율 승수 — 복합 공급 쇼크 확산 경로 추적
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 3, marginBottom: 14, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 3 }}>
          {[
            { key: "current", label: "📊 현재 상태", subtitle: displayDate ? formatDate(displayDate) : "" },
            { key: "history", label: "📈 시계열", subtitle: history.length > 0 ? `${history.length}일` : "" },
          ].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); if (t.key === "current") setSelectedSnapshot(null); }}
              style={{
                flex: 1, padding: "8px 14px", borderRadius: 8, border: "none",
                background: tab === t.key ? "rgba(249,115,22,0.12)" : "transparent",
                color: tab === t.key ? "#f97316" : "rgba(255,255,255,0.35)",
                fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
              }}>
              {t.label}
              {t.subtitle && <span style={{ display: "block", fontSize: 9, fontWeight: 400, marginTop: 1, opacity: 0.6 }}>{t.subtitle}</span>}
            </button>
          ))}
        </div>

        {/* Admin Panel */}
        {showPin && (
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", padding: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="password" placeholder="관리자 PIN" value={pin} onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAIUpdate()}
                style={{ flex: 1, padding: "7px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e2e8f0", fontSize: 12, outline: "none" }} />
              <button onClick={handleAIUpdate} disabled={updating || !pin} style={{
                padding: "7px 18px", borderRadius: 8, border: "none",
                background: updating ? "rgba(255,255,255,0.1)" : "#f97316",
                color: "#fff", fontSize: 12, fontWeight: 600,
                cursor: updating ? "wait" : "pointer", opacity: !pin ? 0.4 : 1,
              }}>
                {updating ? "분석 중..." : "v2.0 전체 업데이트"}
              </button>
            </div>
            {updateLog && <div style={{ marginTop: 6, fontSize: 11, color: "#f97316" }}>{updateLog}</div>}
          </div>
        )}

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "8px 12px", marginBottom: 14, fontSize: 11, color: "#ef4444", wordBreak: "break-all" }}>{error}</div>
        )}
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "0 20px 80px" }}>

        {/* ═══ TAB: 현재 상태 ═══ */}
        {tab === "current" && (
          <>
            {/* Snapshot banner */}
            {selectedSnapshot && (
              <div style={{
                background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)",
                borderRadius: 10, padding: "8px 14px", marginBottom: 14,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 12, color: "#f97316" }}>📅 {formatDate(selectedSnapshot.snapshot_date)} 스냅샷</span>
                <button onClick={() => setSelectedSnapshot(null)} style={{
                  padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(249,115,22,0.3)",
                  background: "transparent", color: "#f97316", fontSize: 10, cursor: "pointer",
                }}>최신으로</button>
              </div>
            )}

            {/* Overall Index */}
            {overall && overallCfg && (
              <div style={{
                background: `linear-gradient(135deg, ${overallCfg.bg}, rgba(0,0,0,0.2))`,
                border: `1px solid ${overallCfg.border}`, borderRadius: 20, padding: "24px 20px", marginBottom: 16, textAlign: "center",
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: 1.5, marginBottom: 10, textTransform: "uppercase" }}>CPI Diffusion Index v2.0</div>
                <ScoreGauge score={overallScore} size={110} showMultiplier fxMult={fxMult} />
                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, maxWidth: 600, margin: "10px auto 0" }}>{overall.overall_summary}</div>
                {displayData?.updated_at && (
                  <div style={{ marginTop: 12, fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
                    {selectedSnapshot ? `스냅샷: ${formatDate(selectedSnapshot.snapshot_date)}` : `마지막 업데이트: ${formatDateTime(displayData.updated_at)}`}
                  </div>
                )}
              </div>
            )}

            {/* FX 승수 배너 + 경보 상태 */}
            {overall && <FxMultiplierBanner overall={overall} />}

            {/* Heatmap (2줄) */}
            {framework && Object.keys(catDataMap).length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                <HeatmapRow categories={catOrder.slice(0, 5)} catDataMap={catDataMap} framework={framework} />
                <HeatmapRow categories={catOrder.slice(5)} catDataMap={catDataMap} framework={framework} />
              </div>
            )}

            {/* No data state */}
            {(!overall || Object.keys(catDataMap).length === 0) && (
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px dashed rgba(255,255,255,0.1)", padding: "50px 24px", textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>아직 데이터가 없습니다</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>관리자 PIN으로 v2.0 AI 업데이트를 실행하세요</div>
              </div>
            )}

            {/* Category Cards */}
            {catOrder.length > 0 && Object.keys(catDataMap).length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {catOrder.map((catId) => (
                  <CategoryCard key={catId} category={catId} catData={catDataMap[catId]} framework={framework}
                    expanded={!!expanded[catId]} onToggle={() => setExpanded((prev) => ({ ...prev, [catId]: !prev[catId] }))}
                    supplyFlag={supplyFlag} />
                ))}
              </div>
            )}

            {/* Key Signals + Scenarios */}
            {overall && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <KeySignals signals={overall.key_signals} />
                <ScenarioPanel scenario={overall.scenario_update} />
              </div>
            )}

            {/* Propagation Flow v2.0 */}
            {overall && <PropagationFlow catDataMap={catDataMap} />}
          </>
        )}

        {/* ═══ TAB: 시계열 ═══ */}
        {tab === "history" && (
          <>
            {historyLoading ? (
              <div style={{ textAlign: "center", padding: "50px 24px", color: "rgba(255,255,255,0.4)" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                <div>히스토리 로딩 중...</div>
              </div>
            ) : (
              <>
                <div style={{
                  background: "rgba(255,255,255,0.03)", borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.06)", padding: 20, marginBottom: 20,
                }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    📈 CPI 확산 지수 추이 <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontWeight: 400 }}>v2.0 — FX 승수 반영</span>
                  </h3>
                  <TimeSeriesChart history={history} framework={framework} />
                </div>

                <div style={{
                  background: "rgba(255,255,255,0.03)", borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.06)", padding: 20,
                }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 3, display: "flex", alignItems: "center", gap: 8 }}>
                    📋 업데이트 히스토리
                  </h3>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginBottom: 6 }}>
                    날짜를 클릭하면 해당 시점의 상세 분석을 볼 수 있습니다
                  </p>
                  <HistoryTable
                    history={history} framework={framework}
                    selectedDate={selectedSnapshot?.snapshot_date}
                    onSelect={(row) => { setSelectedSnapshot(row); setTab("current"); }}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
