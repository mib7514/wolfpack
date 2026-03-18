"use client";

import { useState, useEffect, useCallback } from "react";

const STATUS_CONFIG = {
  안정: { color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)", label: "STABLE" },
  주의: { color: "#eab308", bg: "rgba(234,179,8,0.12)", border: "rgba(234,179,8,0.3)", label: "CAUTION" },
  경고: { color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)", label: "WARNING" },
  위험: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", label: "DANGER" },
};

const TREND_ICONS = {
  급등: "⬆️", 상승: "↗️", 보합: "➡️", 하락: "↘️", 급락: "⬇️",
};

function getScoreStatus(score) {
  if (score <= 25) return "안정";
  if (score <= 50) return "주의";
  if (score <= 75) return "경고";
  return "위험";
}

// Robust JSON extraction with brace matching
function extractJSON(text) {
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          return JSON.parse(text.substring(start, i + 1));
        } catch (e) {
          start = -1;
        }
      }
    }
  }
  return null;
}

// Build the AI prompt
function buildPrompts(framework) {
  const systemPrompt = `당신은 인플레이션 확산 모니터링 전문 분석가입니다. 현재 중동발 에너지/물류 쇼크가 다양한 품목으로 확산되어 CPI가 상승할 우려가 있는 상황을 모니터링하고 있습니다.

각 지표에 대해 가장 최근 학습 데이터를 기반으로 분석해주세요.
점수 기준:
- 0~25: 안정 (인플레 확산 위험 낮음)
- 26~50: 주의 (일부 상승 신호, 아직 제한적)
- 51~75: 경고 (확산 진행 중, 모니터링 강화 필요)
- 76~100: 위험 (광범위한 확산, 구조적 인플레 위험)

한국과 미국 양쪽 모두 고려하되 글로벌 관점에서 분석하세요.
오늘 날짜: ${new Date().toISOString().split("T")[0]}

응답은 반드시 다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이, markdown 코드블록도 없이):
{
  "categories": {
    "[category_id]": {
      "score": number,
      "status": "안정|주의|경고|위험",
      "summary": "카테고리 전체 요약 (2-3문장)",
      "indicators": {
        "[indicator_id]": {
          "score": number,
          "trend": "상승|하락|보합|급등|급락",
          "analysis": "지표별 분석 (2-3문장, 구체적 수치/사실 포함)"
        }
      }
    }
  },
  "overall_index": number,
  "overall_status": "안정|주의|경고|위험",
  "overall_summary": "전체 CPI 확산 위험 종합 판단 (3-5문장)",
  "key_signals": ["주요 신호 1", "주요 신호 2", "주요 신호 3"],
  "scenario_update": {
    "base": "베이스 시나리오 업데이트 (2-3문장)",
    "upside": "상방(구조적 인플레) 시나리오 변화 (2-3문장)",
    "downside": "하방(스파이크 후 둔화) 시나리오 변화 (2-3문장)"
  }
}`;

  const categories = framework.categories;
  const categoryDescriptions = categories.map((c) => {
    const indDesc = c.indicators.map((ind) => `  - ${ind.id}: ${ind.name} — ${ind.description}`).join("\n");
    return `### ${c.name} (${c.id}, 가중치 ${c.weight})\n${c.description}\n${indDesc}`;
  }).join("\n\n");

  const userPrompt = `다음 인플레이션 확산 모니터링 프레임워크의 모든 카테고리와 지표를 분석해주세요.

${categoryDescriptions}

특히 다음을 중점 확인하세요:
1. 호르무즈/중동 리스크가 에너지·원료 가격에 미치는 현재 영향
2. 해상운임/보험료가 이벤트성 스파이크인지, 고점 고착화인지
3. PE/PP 등 중간재 스프레드 방향
4. 미국/한국 코어 서비스 물가 최근 추이 (MoM)
5. 5Y5Y 브레이크이븐, 기간프리미엄 움직임
6. 임금/기업 가격전가 최근 동향

JSON 형식으로만 응답하세요.`;

  return { systemPrompt, userPrompt };
}

function ScoreGauge({ score, size = 80 }) {
  const status = getScoreStatus(score);
  const cfg = STATUS_CONFIG[status];
  const circumference = 2 * Math.PI * 34;
  const offset = circumference - (score / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      <circle
        cx="40" cy="40" r="34" fill="none"
        stroke={cfg.color} strokeWidth="6"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 40 40)"
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
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
      <div style={{
        width: `${score}%`, height: "100%", background: cfg.color,
        borderRadius: height / 2, transition: "width 0.8s ease",
      }} />
    </div>
  );
}

function CategoryCard({ category, catData, framework, expanded, onToggle }) {
  const fwCat = framework.categories.find((c) => c.id === category);
  if (!fwCat || !catData) return null;

  const cfg = STATUS_CONFIG[catData.status] || STATUS_CONFIG["주의"];

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${expanded ? cfg.border : "rgba(255,255,255,0.06)"}`,
      borderRadius: 16, overflow: "hidden",
      transition: "border-color 0.3s ease",
    }}>
      <div
        onClick={onToggle}
        style={{
          padding: "20px 24px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 16,
          borderBottom: expanded ? "1px solid rgba(255,255,255,0.06)" : "none",
        }}
      >
        <span style={{ fontSize: 28 }}>{fwCat.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{fwCat.name}</span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
              background: cfg.bg, color: cfg.color, letterSpacing: 0.5,
            }}>{catData.status}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>
              가중치 {(fwCat.weight * 100).toFixed(0)}%
            </span>
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
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 20 }}>
            {catData.summary}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {fwCat.indicators.map((ind) => {
              const indData = catData.indicators?.[ind.id];
              if (!indData) return null;
              const indStatus = getScoreStatus(indData.score);
              const indCfg = STATUS_CONFIG[indStatus];
              return (
                <div key={ind.id} style={{
                  background: "rgba(255,255,255,0.02)", borderRadius: 10,
                  padding: "14px 16px", border: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>{ind.name}</span>
                    <span style={{ fontSize: 14 }}>{TREND_ICONS[indData.trend] || "➡️"}</span>
                    <span style={{ fontSize: 11, color: indCfg.color, fontWeight: 600, marginLeft: "auto" }}>{indData.score}</span>
                  </div>
                  <ScoreBar score={indData.score} height={4} />
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, marginTop: 8 }}>
                    {indData.analysis}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ScenarioPanel({ scenario }) {
  if (!scenario) return null;
  const items = [
    { key: "base", label: "베이스", emoji: "⚖️", color: "#eab308" },
    { key: "upside", label: "상방 (구조적 인플레)", emoji: "🔺", color: "#ef4444" },
    { key: "downside", label: "하방 (스파이크 후 둔화)", emoji: "🔻", color: "#22c55e" },
  ];
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.06)", padding: 24,
    }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        🎯 시나리오 업데이트
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map((item) => (
          <div key={item.key} style={{
            padding: "14px 16px", borderRadius: 10,
            background: "rgba(255,255,255,0.02)",
            borderLeft: `3px solid ${item.color}`,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: item.color, marginBottom: 6 }}>
              {item.emoji} {item.label}
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, margin: 0 }}>
              {scenario[item.key]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function KeySignals({ signals }) {
  if (!signals || signals.length === 0) return null;
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.06)", padding: 24,
    }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        📡 핵심 신호
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {signals.map((sig, i) => (
          <div key={i} style={{
            padding: "12px 16px", borderRadius: 10,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.04)",
            fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5,
            display: "flex", gap: 10, alignItems: "flex-start",
          }}>
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
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${categories.length}, 1fr)`,
      gap: 8,
    }}>
      {categories.map((catId) => {
        const fwCat = framework.categories.find((c) => c.id === catId);
        const catData = catDataMap?.[catId];
        if (!fwCat || !catData) return <div key={catId} />;
        const cfg = STATUS_CONFIG[catData.status] || STATUS_CONFIG["주의"];
        return (
          <div key={catId} style={{
            background: cfg.bg, borderRadius: 10, padding: "12px 8px",
            border: `1px solid ${cfg.border}`, textAlign: "center",
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{fwCat.emoji}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4, lineHeight: 1.3 }}>{fwCat.name}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: cfg.color }}>{catData.score}</div>
          </div>
        );
      })}
    </div>
  );
}

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

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAIUpdate = async () => {
    if (!pin || !framework) return;
    setUpdating(true);
    setError("");

    try {
      // Step 1: Verify PIN and get API key from server
      setUpdateLog("🔐 관리자 인증 중...");
      const keyRes = await fetch("/api/inflation-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify({ action: "get_api_key" }),
      });
      const keyJson = await keyRes.json();
      if (keyJson.error) {
        setError(keyJson.error);
        setUpdateLog("");
        setUpdating(false);
        return;
      }
      const apiKey = keyJson.apiKey;

      // Step 2: Call Anthropic API directly from browser (no timeout!)
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
      try {
        aiData = JSON.parse(aiRawText);
      } catch (e) {
        setError(`AI API 응답 파싱 실패 (HTTP ${aiRes.status}): ${aiRawText.substring(0, 300)}`);
        setUpdateLog("");
        setUpdating(false);
        return;
      }

      if (aiData.error) {
        setError(`AI API 오류: ${aiData.error.message || JSON.stringify(aiData.error)}`);
        setUpdateLog("");
        setUpdating(false);
        return;
      }

      const textBlocks = (aiData.content || []).filter((b) => b.type === "text").map((b) => b.text);
      const aiResponseText = textBlocks.join("\n");
      const parsed = extractJSON(aiResponseText);

      if (!parsed) {
        setError("AI 응답에서 JSON을 추출할 수 없습니다: " + aiResponseText.substring(0, 300));
        setUpdateLog("");
        setUpdating(false);
        return;
      }

      // Step 3: Save result to Supabase via server
      setUpdateLog("💾 분석 결과 저장 중...");
      const saveRes = await fetch("/api/inflation-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify({ action: "save_result", analysisData: parsed }),
      });
      const saveJson = await saveRes.json();
      if (saveJson.error) {
        setError("저장 실패: " + saveJson.error);
        setUpdateLog("");
        setUpdating(false);
        return;
      }

      // Success!
      setData(saveJson.data);
      setShowPin(false);
      setPin("");
      setUpdateLog("✅ 업데이트 완료!");
      setTimeout(() => setUpdateLog(""), 3000);

    } catch (err) {
      setError("업데이트 실패: " + err.message);
      setUpdateLog("");
    } finally {
      setUpdating(false);
    }
  };

  const catOrder = framework?.categories?.map((c) => c.id) || [];
  const catDataMap = data?.data?.categories || {};
  const overall = data?.data;

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

  const overallScore = overall?.overall_index;
  const overallStatus = overall?.overall_status;
  const overallCfg = overallStatus ? STATUS_CONFIG[overallStatus] : null;

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0c10",
      fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
      color: "#e2e8f0",
    }}>
      {/* Header */}
      <div style={{
        padding: "24px 24px 0",
        maxWidth: 900, margin: "0 auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <a href="/" style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>← 컨트롤타워</a>
          <button
            onClick={() => setShowPin(!showPin)}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
            }}
          >
            🔐 AI 업데이트
          </button>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "16px 0 4px", letterSpacing: -0.5 }}>
          🌡️ CPI 확산 모니터
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "0 0 20px" }}>
          중동발 에너지·물류 쇼크 → 물가 확산 경로 실시간 추적
        </p>

        {/* Admin Panel */}
        {showPin && (
          <div style={{
            background: "rgba(255,255,255,0.04)", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.08)", padding: 16, marginBottom: 20,
          }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="password"
                placeholder="관리자 PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAIUpdate()}
                style={{
                  flex: 1, padding: "8px 12px", background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                  color: "#e2e8f0", fontSize: 13, outline: "none",
                }}
              />
              <button
                onClick={handleAIUpdate}
                disabled={updating || !pin}
                style={{
                  padding: "8px 20px", borderRadius: 8, border: "none",
                  background: updating ? "rgba(255,255,255,0.1)" : "#f97316",
                  color: "#fff", fontSize: 13, fontWeight: 600,
                  cursor: updating ? "wait" : "pointer",
                  opacity: !pin ? 0.4 : 1,
                }}
              >
                {updating ? "분석 중..." : "전체 업데이트"}
              </button>
            </div>
            {updateLog && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#f97316" }}>{updateLog}</div>
            )}
          </div>
        )}

        {error && (
          <div style={{
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 10, padding: "10px 14px", marginBottom: 16,
            fontSize: 12, color: "#ef4444", wordBreak: "break-all",
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 80px" }}>

        {/* Overall Index */}
        {overall && overallCfg && (
          <div style={{
            background: `linear-gradient(135deg, ${overallCfg.bg}, rgba(0,0,0,0.2))`,
            border: `1px solid ${overallCfg.border}`,
            borderRadius: 20, padding: "28px 24px", marginBottom: 24,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" }}>
              CPI Diffusion Index
            </div>
            <ScoreGauge score={overallScore} size={110} />
            <div style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, maxWidth: 600, margin: "12px auto 0" }}>
              {overall.overall_summary}
            </div>
            {data?.updated_at && (
              <div style={{ marginTop: 16, fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                마지막 업데이트: {new Date(data.updated_at).toLocaleString("ko-KR")}
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
          <div style={{
            background: "rgba(255,255,255,0.03)", borderRadius: 16,
            border: "1px dashed rgba(255,255,255,0.1)", padding: "60px 24px",
            textAlign: "center", marginBottom: 24,
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
              아직 데이터가 없습니다
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
              관리자 PIN으로 AI 업데이트를 실행하세요
            </div>
          </div>
        )}

        {/* Category Cards */}
        {catOrder.length > 0 && Object.keys(catDataMap).length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            {catOrder.map((catId) => (
              <CategoryCard
                key={catId}
                category={catId}
                catData={catDataMap[catId]}
                framework={framework}
                expanded={!!expanded[catId]}
                onToggle={() => setExpanded((prev) => ({ ...prev, [catId]: !prev[catId] }))}
              />
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

        {/* Propagation Flow Diagram */}
        {overall && (
          <div style={{
            marginTop: 24, background: "rgba(255,255,255,0.03)", borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.06)", padding: 24,
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              🔗 인플레이션 전이 경로
            </h3>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 4, flexWrap: "wrap", padding: "12px 0",
            }}>
              {[
                { id: "energy_raw", label: "에너지/원료", stage: "1차" },
                { id: "logistics", label: "물류/보험", stage: "1.5차" },
                { id: "intermediate", label: "중간재", stage: "2차" },
                { id: "core_services", label: "코어서비스", stage: "3차" },
                { id: "expectations", label: "기대인플레", stage: "심리" },
                { id: "wage_second", label: "임금/2차파급", stage: "고착" },
              ].map((step, i) => {
                const cat = catDataMap[step.id];
                const score = cat?.score || 0;
                const status = cat?.status || "안정";
                const cfg = STATUS_CONFIG[status];
                return (
                  <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{
                      background: cfg.bg, border: `1px solid ${cfg.border}`,
                      borderRadius: 10, padding: "10px 12px", textAlign: "center",
                      minWidth: 80,
                    }}>
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
        )}
      </div>
    </div>
  );
}
