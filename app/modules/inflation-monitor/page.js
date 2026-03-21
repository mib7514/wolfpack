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
};

const TREND_ICONS = {
  급등: "⬆️", 상승: "↗️", 보합: "➡️", 하락: "↘️", 급락: "⬇️",
};

const CAT_COLORS = {
  energy_raw: "#f97316",
  logistics: "#3b82f6",
  intermediate: "#8b5cf6",
  core_services: "#ec4899",
  expectations: "#eab308",
  wage_second: "#22c55e",
};

function getScoreStatus(score) {
  if (score <= 25) return "안정";
  if (score <= 50) return "주의";
  if (score <= 75) return "경고";
  return "위험";
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
// AI Prompt Builder
// ═══════════════════════════════════════════════════════════════

function buildPrompts(framework) {
  const systemPrompt = `당신은 인플레이션 확산 모니터링 전문 분석가입니다. 현재 중동발 에너지/물류 쇼크가 다양한 품목으로 확산되어 CPI가 상승할 우려가 있는 상황을 모니터링하고 있습니다.

각 지표를 최신 데이터 기반으로 분석. 점수: 0~25 안정, 26~50 주의, 51~75 경고, 76~100 위험.
한국·미국·글로벌 관점. 오늘: ${new Date().toISOString().split("T")[0]}

중요: 토큰 절약을 위해 모든 텍스트 필드는 반드시 1문장(30자 이내)으로 작성하세요. 길게 쓰지 마세요.
응답은 반드시 다음 JSON 형식으로만 (다른 텍스트 없이, markdown 코드블록도 없이):
{
  "categories": {
    "[category_id]": {
      "score": number,
      "status": "안정|주의|경고|위험",
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
  "overall_index": number,
  "overall_status": "안정|주의|경고|위험",
  "overall_summary": "종합 판단 2문장 이내",
  "key_signals": ["신호1", "신호2", "신호3"],
  "scenario_update": {
    "base": "1문장",
    "upside": "1문장",
    "downside": "1문장"
  }
}`;

  const categories = framework.categories;
  const categoryDescriptions = categories.map((c) => {
    const indDesc = c.indicators.map((ind) => `  - ${ind.id}: ${ind.name} — ${ind.description}`).join("\n");
    return `### ${c.name} (${c.id}, 가중치 ${c.weight})\n${c.description}\n${indDesc}`;
  }).join("\n\n");

  const userPrompt = `아래 프레임워크의 모든 카테고리·지표를 분석. 중동/호르무즈 리스크, 운임 고착화, 중간재 스프레드, 코어서비스 MoM, BEI/기간프리미엄, 임금전가 중점. 반드시 JSON만, 각 analysis는 1문장.

${categoryDescriptions}

JSON 형식으로만 응답.`;

  return { systemPrompt, userPrompt };
}

// ═══════════════════════════════════════════════════════════════
// 공통 UI 컴포넌트
// ═══════════════════════════════════════════════════════════════

function ScoreGauge({ score, size = 80 }) {
  const status = getScoreStatus(score);
  const cfg = STATUS_CONFIG[status];
  const circumference = 2 * Math.PI * 34;
  const offset = circumference - (score / 100) * circumference;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      <circle cx="40" cy="40" r="34" fill="none" stroke={cfg.color} strokeWidth="6"
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 40 40)" style={{ transition: "stroke-dashoffset 1s ease" }} />
      <text x="40" y="36" textAnchor="middle" fill={cfg.color} fontSize="18" fontWeight="700">{score}</text>
      <text x="40" y="50" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontWeight="500">{cfg.label}</text>
    </svg>
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

// ═══════════════════════════════════════════════════════════════
// 카테고리 카드 (기존)
// ═══════════════════════════════════════════════════════════════

function CategoryCard({ category, catData, framework, expanded, onToggle }) {
  const fwCat = framework.categories.find((c) => c.id === category);
  if (!fwCat || !catData) return null;
  const cfg = STATUS_CONFIG[catData.status] || STATUS_CONFIG["주의"];

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: `1px solid ${expanded ? cfg.border : "rgba(255,255,255,0.06)"}`,
      borderRadius: 16, overflow: "hidden", transition: "border-color 0.3s ease",
    }}>
      <div onClick={onToggle} style={{
        padding: "20px 24px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16,
        borderBottom: expanded ? "1px solid rgba(255,255,255,0.06)" : "none",
      }}>
        <span style={{ fontSize: 28 }}>{fwCat.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{fwCat.name}</span>
            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: cfg.bg, color: cfg.color, letterSpacing: 0.5 }}>{catData.status}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>가중치 {(fwCat.weight * 100).toFixed(0)}%</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ScoreBar score={catData.score} />
            <span style={{ fontSize: 14, fontWeight: 700, color: cfg.color, minWidth: 32 }}>{catData.score}</span>
          </div>
        </div>
        <span style={{ fontSize: 18, color: "rgba(255,255,255,0.3)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
      </div>

      {expanded && (
        <div style={{ padding: "16px 24px 24px" }}>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 20 }}>{catData.summary}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {fwCat.indicators.map((ind) => {
              const indData = catData.indicators?.[ind.id];
              if (!indData) return null;
              const indStatus = getScoreStatus(indData.score);
              const indCfg = STATUS_CONFIG[indStatus];
              return (
                <div key={ind.id} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>{ind.name}</span>
                    <span style={{ fontSize: 14 }}>{TREND_ICONS[indData.trend] || "➡️"}</span>
                    <span style={{ fontSize: 11, color: indCfg.color, fontWeight: 600, marginLeft: "auto" }}>{indData.score}</span>
                  </div>
                  <ScoreBar score={indData.score} height={4} />
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, marginTop: 8 }}>{indData.analysis}</p>
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
// 시나리오 / 핵심신호 / 히트맵 / 전이경로 (기존)
// ═══════════════════════════════════════════════════════════════

function ScenarioPanel({ scenario }) {
  if (!scenario) return null;
  const items = [
    { key: "base", label: "베이스", emoji: "⚖️", color: "#eab308" },
    { key: "upside", label: "상방 (구조적 인플레)", emoji: "🔺", color: "#ef4444" },
    { key: "downside", label: "하방 (스파이크 후 둔화)", emoji: "🔻", color: "#22c55e" },
  ];
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", padding: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>🎯 시나리오 업데이트</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map((item) => (
          <div key={item.key} style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.02)", borderLeft: `3px solid ${item.color}` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: item.color, marginBottom: 6 }}>{item.emoji} {item.label}</div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, margin: 0 }}>{scenario[item.key]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function KeySignals({ signals }) {
  if (!signals || signals.length === 0) return null;
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", padding: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>📡 핵심 신호</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {signals.map((sig, i) => (
          <div key={i} style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ color: "#f97316", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>#{i + 1}</span>
            {sig}
          </div>
        ))}
      </div>
    </div>
  );
}

function HeatmapRow({ categories, catDataMap, framework }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${categories.length}, 1fr)`, gap: 8 }}>
      {categories.map((catId) => {
        const fwCat = framework.categories.find((c) => c.id === catId);
        const catData = catDataMap?.[catId];
        if (!fwCat || !catData) return <div key={catId} />;
        const cfg = STATUS_CONFIG[catData.status] || STATUS_CONFIG["주의"];
        return (
          <div key={catId} style={{ background: cfg.bg, borderRadius: 10, padding: "12px 8px", border: `1px solid ${cfg.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{fwCat.emoji}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4, lineHeight: 1.3 }}>{fwCat.name}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: cfg.color }}>{catData.score}</div>
          </div>
        );
      })}
    </div>
  );
}

function PropagationFlow({ catDataMap }) {
  const steps = [
    { id: "energy_raw", label: "에너지/원료", stage: "1차" },
    { id: "logistics", label: "물류/보험", stage: "1.5차" },
    { id: "intermediate", label: "중간재", stage: "2차" },
    { id: "core_services", label: "코어서비스", stage: "3차" },
    { id: "expectations", label: "기대인플레", stage: "심리" },
    { id: "wage_second", label: "임금/2차파급", stage: "고착" },
  ];
  return (
    <div style={{ marginTop: 24, background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", padding: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>🔗 인플레이션 전이 경로</h3>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexWrap: "wrap", padding: "12px 0" }}>
        {steps.map((step, i) => {
          const cat = catDataMap[step.id];
          const score = cat?.score || 0;
          const status = cat?.status || "안정";
          const cfg = STATUS_CONFIG[status];
          return (
            <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10, padding: "10px 12px", textAlign: "center", minWidth: 80 }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>{step.stage}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#cbd5e1", marginBottom: 4 }}>{step.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: cfg.color }}>{score}</div>
              </div>
              {i < 5 && <span style={{ fontSize: 16, color: "rgba(255,255,255,0.15)" }}>→</span>}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 8 }}>
        1차(원료) → 1.5차(물류) → 2차(중간재) → 3차(서비스) 순으로 전이. 3차+임금까지 붙으면 구조적 인플레
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📈 시계열 차트 (SVG)
// ═══════════════════════════════════════════════════════════════

function TimeSeriesChart({ history, framework }) {
  const W = 800, H = 360, PAD = { top: 30, right: 24, bottom: 60, left: 48 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const sorted = useMemo(() =>
    [...history].sort((a, b) => new Date(a.snapshot_date) - new Date(b.snapshot_date)),
    [history]
  );

  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [showCategories, setShowCategories] = useState(true);

  if (sorted.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 24px", color: "rgba(255,255,255,0.4)" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
        <div style={{ fontSize: 14 }}>히스토리 데이터가 없습니다. AI 업데이트를 2회 이상 실행하면 시계열이 표시됩니다.</div>
      </div>
    );
  }

  const catIds = framework?.categories?.map(c => c.id) || [];

  // Build data points
  const points = sorted.map((row, i) => {
    const d = row.data;
    const overall = d?.overall_index ?? 0;
    const cats = {};
    catIds.forEach(cid => { cats[cid] = d?.categories?.[cid]?.score ?? null; });
    return { date: row.snapshot_date, overall, cats, updatedAt: row.updated_at };
  });

  const n = points.length;
  const xScale = (i) => PAD.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yScale = (v) => PAD.top + plotH - (v / 100) * plotH;

  // Build SVG path
  const buildPath = (getData) => {
    const vals = points.map((p, i) => ({ x: xScale(i), y: yScale(getData(p)) }));
    return vals.map((v, i) => `${i === 0 ? "M" : "L"}${v.x},${v.y}`).join(" ");
  };

  // Zones
  const zones = [
    { y0: 0, y1: 25, color: "rgba(34,197,94,0.06)", label: "안정" },
    { y0: 25, y1: 50, color: "rgba(234,179,8,0.06)", label: "주의" },
    { y0: 50, y1: 75, color: "rgba(249,115,22,0.06)", label: "경고" },
    { y0: 75, y1: 100, color: "rgba(239,68,68,0.06)", label: "위험" },
  ];

  return (
    <div>
      {/* Toggle */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12, gap: 8 }}>
        <button
          onClick={() => setShowCategories(!showCategories)}
          style={{
            padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)",
            background: showCategories ? "rgba(255,255,255,0.08)" : "transparent",
            color: showCategories ? "#e2e8f0" : "rgba(255,255,255,0.4)",
            fontSize: 11, cursor: "pointer",
          }}
        >
          카테고리별 표시
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <svg
          width={W} height={H} viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", height: "auto", maxHeight: 360 }}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Background zones */}
          {zones.map((z, i) => (
            <g key={i}>
              <rect x={PAD.left} y={yScale(z.y1)} width={plotW} height={yScale(z.y0) - yScale(z.y1)} fill={z.color} />
              <text x={PAD.left - 6} y={yScale(z.y1) + 12} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize="9">{z.y1}</text>
            </g>
          ))}
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(v => (
            <line key={v} x1={PAD.left} x2={PAD.left + plotW} y1={yScale(v)} y2={yScale(v)} stroke="rgba(255,255,255,0.06)" strokeDasharray="4,4" />
          ))}
          <text x={PAD.left - 6} y={yScale(0) + 4} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize="9">0</text>

          {/* Category lines */}
          {showCategories && catIds.map(cid => {
            const c = framework.categories.find(x => x.id === cid);
            const color = CAT_COLORS[cid] || "#6b7280";
            const hasData = points.some(p => p.cats[cid] !== null);
            if (!hasData) return null;
            return (
              <path
                key={cid}
                d={buildPath(p => p.cats[cid] ?? 0)}
                fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.4"
                strokeDasharray="4,3"
              />
            );
          })}

          {/* Overall line */}
          <path d={buildPath(p => p.overall)} fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data points */}
          {points.map((p, i) => {
            const cx = xScale(i), cy = yScale(p.overall);
            const isHovered = hoveredIdx === i;
            const status = getScoreStatus(p.overall);
            const cfg = STATUS_CONFIG[status];
            return (
              <g key={i}>
                {/* Hover area */}
                <rect
                  x={cx - (n === 1 ? plotW / 2 : plotW / (n - 1) / 2)}
                  y={PAD.top} width={n === 1 ? plotW : plotW / (n - 1)}
                  height={plotH} fill="transparent"
                  onMouseEnter={() => setHoveredIdx(i)}
                  style={{ cursor: "pointer" }}
                />
                {/* Vertical line on hover */}
                {isHovered && <line x1={cx} x2={cx} y1={PAD.top} y2={PAD.top + plotH} stroke="rgba(255,255,255,0.15)" strokeDasharray="3,3" />}

                {/* Overall dot */}
                <circle cx={cx} cy={cy} r={isHovered ? 7 : 5} fill={cfg.color} stroke="#0a0c10" strokeWidth="2" style={{ transition: "r 0.15s" }} />

                {/* Category dots on hover */}
                {isHovered && showCategories && catIds.map(cid => {
                  const v = p.cats[cid];
                  if (v === null) return null;
                  return <circle key={cid} cx={cx} cy={yScale(v)} r={4} fill={CAT_COLORS[cid] || "#6b7280"} stroke="#0a0c10" strokeWidth="1.5" />;
                })}

                {/* Score label */}
                {(isHovered || n <= 15) && (
                  <text x={cx} y={cy - 12} textAnchor="middle" fill={cfg.color} fontSize="11" fontWeight="700">{p.overall}</text>
                )}

                {/* Date label */}
                <text
                  x={cx} y={H - 16}
                  textAnchor={n <= 7 ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                  fill={isHovered ? "#e2e8f0" : "rgba(255,255,255,0.3)"} fontSize="10"
                  transform={n > 10 ? `rotate(-45 ${cx} ${H - 16})` : ""}
                >
                  {formatDate(p.date)}
                </text>
              </g>
            );
          })}

          {/* Hover tooltip */}
          {hoveredIdx !== null && (() => {
            const p = points[hoveredIdx];
            const cx = xScale(hoveredIdx);
            const tooltipW = 180;
            const tooltipX = Math.min(Math.max(cx - tooltipW / 2, PAD.left), W - PAD.right - tooltipW);
            const lines = [
              { label: "종합", value: p.overall, color: "#f97316" },
              ...catIds.map(cid => {
                const c = framework.categories.find(x => x.id === cid);
                return { label: c?.name?.replace(/\/.*/, "") || cid, value: p.cats[cid], color: CAT_COLORS[cid] };
              }),
            ];
            return (
              <g>
                <rect x={tooltipX} y={PAD.top} width={tooltipW} height={16 + lines.length * 16 + 8} rx="8" fill="rgba(10,12,16,0.95)" stroke="rgba(255,255,255,0.1)" />
                <text x={tooltipX + 10} y={PAD.top + 14} fill="#e2e8f0" fontSize="10" fontWeight="600">{formatDate(p.date)}</text>
                {lines.map((l, i) => (
                  <g key={i}>
                    <circle cx={tooltipX + 14} cy={PAD.top + 28 + i * 16} r={3} fill={l.color} />
                    <text x={tooltipX + 24} y={PAD.top + 32 + i * 16} fill="rgba(255,255,255,0.6)" fontSize="10">{l.label}</text>
                    <text x={tooltipX + tooltipW - 10} y={PAD.top + 32 + i * 16} textAnchor="end" fill={l.color} fontSize="10" fontWeight="700">{l.value ?? "-"}</text>
                  </g>
                ))}
              </g>
            );
          })()}

          {/* Zone labels */}
          {zones.map((z, i) => (
            <text key={i} x={PAD.left + plotW + 4} y={yScale((z.y0 + z.y1) / 2) + 4} fill="rgba(255,255,255,0.15)" fontSize="8">{z.label}</text>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12, justifyContent: "center" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#f97316" }}>
          <span style={{ width: 16, height: 3, background: "#f97316", borderRadius: 2, display: "inline-block" }} /> 종합 지수
        </span>
        {showCategories && framework?.categories?.map(c => (
          <span key={c.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: CAT_COLORS[c.id] || "#6b7280" }}>
            <span style={{ width: 16, height: 2, background: CAT_COLORS[c.id], borderRadius: 2, display: "inline-block", opacity: 0.5 }} /> {c.emoji} {c.name.replace(/\/.*/, "")}
          </span>
        ))}
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
    <div style={{ overflowX: "auto", marginTop: 16 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>날짜</th>
            <th style={{ padding: "10px 8px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#f97316", fontWeight: 700 }}>종합</th>
            {framework?.categories?.map(c => (
              <th key={c.id} style={{ padding: "10px 8px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", color: CAT_COLORS[c.id], fontWeight: 600, fontSize: 11 }}>
                {c.emoji}
              </th>
            ))}
            <th style={{ padding: "10px 8px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>상태</th>
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

            return (
              <tr
                key={row.id || row.snapshot_date}
                onClick={() => onSelect(row)}
                style={{
                  cursor: "pointer",
                  background: isSelected ? "rgba(249,115,22,0.08)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                  borderLeft: isSelected ? "3px solid #f97316" : "3px solid transparent",
                }}
              >
                <td style={{ padding: "10px 12px", color: isSelected ? "#e2e8f0" : "rgba(255,255,255,0.6)", fontWeight: isSelected ? 600 : 400, whiteSpace: "nowrap" }}>
                  {formatDate(row.snapshot_date)}
                </td>
                <td style={{ padding: "10px 8px", textAlign: "center" }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: cfg.color }}>{overall}</span>
                  {delta !== null && delta !== 0 && (
                    <span style={{ fontSize: 10, color: delta > 0 ? "#ef4444" : "#22c55e", marginLeft: 4 }}>
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  )}
                </td>
                {catIds.map(cid => {
                  const score = d?.categories?.[cid]?.score;
                  const prevScore = prev?.categories?.[cid]?.score;
                  const cDelta = score != null && prevScore != null ? score - prevScore : null;
                  const sCfg = score != null ? STATUS_CONFIG[getScoreStatus(score)] : null;
                  return (
                    <td key={cid} style={{ padding: "10px 8px", textAlign: "center" }}>
                      {score != null ? (
                        <>
                          <span style={{ fontWeight: 600, color: sCfg?.color || "rgba(255,255,255,0.5)" }}>{score}</span>
                          {cDelta !== null && cDelta !== 0 && (
                            <span style={{ fontSize: 9, color: cDelta > 0 ? "#ef4444" : "#22c55e", marginLeft: 2 }}>
                              {cDelta > 0 ? "↑" : "↓"}
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ color: "rgba(255,255,255,0.15)" }}>-</span>
                      )}
                    </td>
                  );
                })}
                <td style={{ padding: "10px 8px", textAlign: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: cfg.bg, color: cfg.color }}>{status}</span>
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

  // 시계열 관련
  const [tab, setTab] = useState("current"); // "current" | "history"
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);

  // ─── 데이터 로딩 ───
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

  // 히스토리 탭 전환 시 로드
  useEffect(() => {
    if (tab === "history" && history.length === 0) {
      fetchHistory();
    }
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

      setUpdateLog("🤖 AI가 6개 카테고리 20개 지표를 분석 중... (30~60초 소요)");
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
          max_tokens: 4096,
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
      // 히스토리 캐시 갱신
      if (history.length > 0) fetchHistory();
      setUpdateLog("✅ 업데이트 완료!");
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

  // selectedSnapshot이 있으면 그 데이터로, 없으면 latest
  const displayData = selectedSnapshot || data;
  const catDataMap = displayData?.data?.categories || {};
  const overall = displayData?.data;
  const overallScore = overall?.overall_index;
  const overallStatus = overall?.overall_status;
  const overallCfg = overallStatus ? STATUS_CONFIG[overallStatus] : null;
  const displayDate = selectedSnapshot?.snapshot_date || data?.snapshot_date;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0c10", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📡</div>
          <div>인플레이션 확산 모니터 로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0c10", fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", color: "#e2e8f0" }}>
      {/* Header */}
      <div style={{ padding: "24px 24px 0", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <a href="/" style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>← 컨트롤타워</a>
          <button onClick={() => setShowPin(!showPin)} style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "rgba(255,255,255,0.5)", cursor: "pointer",
          }}>🔐 AI 업데이트</button>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "16px 0 4px", letterSpacing: -0.5 }}>🌡️ CPI 확산 모니터</h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "0 0 16px" }}>중동발 에너지·물류 쇼크 → 물가 확산 경로 실시간 추적</p>

        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4 }}>
          {[
            { key: "current", label: "📊 현재 상태", subtitle: displayDate ? formatDate(displayDate) : "" },
            { key: "history", label: "📈 시계열", subtitle: history.length > 0 ? `${history.length}일` : "" },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); if (t.key === "current") setSelectedSnapshot(null); }}
              style={{
                flex: 1, padding: "10px 16px", borderRadius: 8, border: "none",
                background: tab === t.key ? "rgba(249,115,22,0.15)" : "transparent",
                color: tab === t.key ? "#f97316" : "rgba(255,255,255,0.4)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {t.label}
              {t.subtitle && <span style={{ display: "block", fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.6 }}>{t.subtitle}</span>}
            </button>
          ))}
        </div>

        {/* Admin Panel */}
        {showPin && (
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", padding: 16, marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="password" placeholder="관리자 PIN" value={pin} onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAIUpdate()}
                style={{ flex: 1, padding: "8px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e2e8f0", fontSize: 13, outline: "none" }} />
              <button onClick={handleAIUpdate} disabled={updating || !pin} style={{
                padding: "8px 20px", borderRadius: 8, border: "none",
                background: updating ? "rgba(255,255,255,0.1)" : "#f97316",
                color: "#fff", fontSize: 13, fontWeight: 600,
                cursor: updating ? "wait" : "pointer", opacity: !pin ? 0.4 : 1,
              }}>
                {updating ? "분석 중..." : "전체 업데이트"}
              </button>
            </div>
            {updateLog && <div style={{ marginTop: 8, fontSize: 12, color: "#f97316" }}>{updateLog}</div>}
          </div>
        )}

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#ef4444", wordBreak: "break-all" }}>{error}</div>
        )}
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 80px" }}>

        {/* ═══ TAB: 현재 상태 ═══ */}
        {tab === "current" && (
          <>
            {/* Snapshot banner (히스토리에서 선택한 경우) */}
            {selectedSnapshot && (
              <div style={{
                background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)",
                borderRadius: 10, padding: "10px 16px", marginBottom: 16,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 13, color: "#f97316" }}>
                  📅 {formatDate(selectedSnapshot.snapshot_date)} 스냅샷을 보고 있습니다
                </span>
                <button onClick={() => setSelectedSnapshot(null)} style={{
                  padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(249,115,22,0.3)",
                  background: "transparent", color: "#f97316", fontSize: 11, cursor: "pointer",
                }}>최신으로 돌아가기</button>
              </div>
            )}

            {/* Overall Index */}
            {overall && overallCfg && (
              <div style={{
                background: `linear-gradient(135deg, ${overallCfg.bg}, rgba(0,0,0,0.2))`,
                border: `1px solid ${overallCfg.border}`, borderRadius: 20, padding: "28px 24px", marginBottom: 24, textAlign: "center",
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" }}>CPI Diffusion Index</div>
                <ScoreGauge score={overallScore} size={110} />
                <div style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, maxWidth: 600, margin: "12px auto 0" }}>{overall.overall_summary}</div>
                {displayData?.updated_at && (
                  <div style={{ marginTop: 16, fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                    {selectedSnapshot ? `스냅샷: ${formatDate(selectedSnapshot.snapshot_date)}` : `마지막 업데이트: ${formatDateTime(displayData.updated_at)}`}
                  </div>
                )}
              </div>
            )}

            {/* Heatmap */}
            {framework && Object.keys(catDataMap).length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <HeatmapRow categories={catOrder} catDataMap={catDataMap} framework={framework} />
              </div>
            )}

            {/* No data state */}
            {(!overall || Object.keys(catDataMap).length === 0) && (
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px dashed rgba(255,255,255,0.1)", padding: "60px 24px", textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>아직 데이터가 없습니다</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>관리자 PIN으로 AI 업데이트를 실행하세요</div>
              </div>
            )}

            {/* Category Cards */}
            {catOrder.length > 0 && Object.keys(catDataMap).length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                {catOrder.map((catId) => (
                  <CategoryCard key={catId} category={catId} catData={catDataMap[catId]} framework={framework}
                    expanded={!!expanded[catId]} onToggle={() => setExpanded((prev) => ({ ...prev, [catId]: !prev[catId] }))} />
                ))}
              </div>
            )}

            {/* Key Signals + Scenarios */}
            {overall && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <KeySignals signals={overall.key_signals} />
                <ScenarioPanel scenario={overall.scenario_update} />
              </div>
            )}

            {/* Propagation Flow */}
            {overall && <PropagationFlow catDataMap={catDataMap} />}
          </>
        )}

        {/* ═══ TAB: 시계열 ═══ */}
        {tab === "history" && (
          <>
            {historyLoading ? (
              <div style={{ textAlign: "center", padding: "60px 24px", color: "rgba(255,255,255,0.4)" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                <div>히스토리 로딩 중...</div>
              </div>
            ) : (
              <>
                {/* 시계열 차트 */}
                <div style={{
                  background: "rgba(255,255,255,0.03)", borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.06)", padding: 24, marginBottom: 24,
                }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    📈 CPI 확산 지수 추이
                  </h3>
                  <TimeSeriesChart history={history} framework={framework} />
                </div>

                {/* 히스토리 테이블 */}
                <div style={{
                  background: "rgba(255,255,255,0.03)", borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.06)", padding: 24,
                }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                    📋 업데이트 히스토리
                  </h3>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                    날짜를 클릭하면 해당 시점의 상세 분석을 볼 수 있습니다
                  </p>
                  <HistoryTable
                    history={history}
                    framework={framework}
                    selectedDate={selectedSnapshot?.snapshot_date}
                    onSelect={(row) => {
                      setSelectedSnapshot(row);
                      setTab("current");
                    }}
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
