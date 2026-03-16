"use client";

import { useState } from "react";
import Link from "next/link";

const MODULES = [
  // ─── Layer 1: MACRO ───
  {
    id: "business-cycle",
    name: "경기순환 체크리스트",
    subtitle: "Business Cycle Dashboard",
    icon: "◈",
    description: "한국/미국 68개 문항 경기국면 분석",
    path: "/modules/business-cycle",
    layer: "macro",
  },
  {
    id: "taylor-rule",
    name: "테일러 룰 모니터",
    subtitle: "Modified Taylor Rule Monitor",
    icon: "📐",
    description: "수정 테일러 룰 기반 적정금리 vs 기준금리 괴리 분석 · 국고3년 GAP 비교",
    path: "/taylor-rule",
    layer: "macro",
  },
  {
    id: "fed-watch",
    name: "Fed Watch",
    subtitle: "FOMC 금리 전망 모니터",
    icon: "🏛️",
    description: "CME FedWatch 기반 금리 기대값 시계열 추적",
    path: "/modules/fed-watch",
    layer: "macro",
  },
  {
    id: "oil-cpi",
    name: "Oil → CPI Monitor",
    subtitle: "유가-물가 패스스루 시뮬레이터",
    icon: "🛢️",
    description: "국제유가 시나리오별 한미 CPI 영향 분석 · 실질금리 추적",
    path: "/modules/oil-cpi",
    layer: "macro",
  },
  {
    id: "employment-narrative",
    name: "고용 내러티브",
    subtitle: "Employment Narrative Monitor",
    icon: "🐺",
    description: "미국 고용지표 내러티브 추적 · AI 자동 발견",
    path: "/modules/employment-narrative",
    layer: "macro",
  },
  // ─── Layer 2: MARKET ───
  {
    id: "narrative-tracker",
    name: "내러티브 알파 트래커",
    subtitle: "Narrative Alpha Tracker",
    icon: "📡",
    description: "금융시장 내러티브 추적 · 스코어링 · 자산영향도 · 켈리 투자 아이디어",
    path: "/modules/narrative-tracker",
    layer: "market",
  },
  {
    id: "consumer-sector",
    name: "소비주 모니터링",
    subtitle: "Consumer Sector Tracker",
    icon: "🛍️",
    description: "KOSPI vs KODEX 경기소비재 · 소비자심리지수 추적",
    path: "/modules/market",
    layer: "market",
  },
  {
    id: "gold-monitor",
    name: "Gold CB Monitor",
    subtitle: "중앙은행 금 매입 추적",
    icon: "🥇",
    description: "글로벌 CB 금 매입 · IB 전망 · 국가별 추적",
    path: "/modules/gold-monitor",
    layer: "market",
  },
  // ─── Layer 3: INVESTMENT IDEA ───
  {
    id: "deficit-analysis",
    name: "적자기업 투자분석",
    subtitle: "Deficit Company Analysis",
    icon: "🎯",
    description: "코스닥 시총 상위 150개 적자유형 · 위험대비수익 Top10 · ETF 매칭",
    path: "/modules/deficit-analysis",
    layer: "investment-idea",
  },
  {
    id: "reit-scoring",
    name: "K-REIT 스코어링",
    subtitle: "REIT Screening & Scoring",
    icon: "◉",
    description: "채권 투자자 관점 5축 분석 · 연율화 캐리 · 금리 스트레스 테스트",
    path: "/modules/reit-scoring",
    layer: "investment-idea",
  },
  {
    id: "wolf-radar",
    name: "Wolf Radar",
    subtitle: "성장주 발굴",
    icon: "🐺",
    description: "종목 검색 · AI thesis 생성 · 모니터링 지표 스코어링",
    path: "/modules/radar",
    layer: "investment-idea",
  },
  // ─── Layer 4: FUND IDEA ───
  {
    id: "fund-ideas",
    name: "역목표전환형",
    subtitle: "BCP-Powered Reverse Target Conversion",
    icon: "💡",
    description: "베스트크레딧플러스 기반 원금보존형 · 경과수익 한도 내 주식 투자 전략",
    path: "/modules/fund-ideas",
    layer: "fund-idea",
  },
  {
    id: "becpl-shield",
    name: "베크플 MDD Shield",
    subtitle: "BECPL Drawdown Protector",
    icon: "🛡️",
    description: "베스트크레딧플러스 + 만기매칭 구조 마이너스 방어 설계",
    path: "/modules/becpl-shield",
    layer: "fund-idea",
  },
  {
    id: "barbell-mdd",
    name: "베크플 바벨 MDD방어형",
    subtitle: "Barbell MDD Defense Designer",
    icon: "⚖️",
    description: "만기매칭 + 베크플 + 장기국채 바벨, 6시나리오 MDD 방어 설계",
    path: "/modules/barbell-mdd",
    layer: "fund-idea",
  },
  // ─── Layer 5: BCP (PIN-protected) ───
  {
    id: "alpha-cockpit",
    name: "Alpha Cockpit",
    subtitle: "BCP Alpha Architecture · 6 Engines",
    icon: "🎛️",
    description: "Market Regime → 6 Alpha Engines → Portfolio Construction OS · 제1원칙 설계",
    path: "/modules/alpha-cockpit",
    layer: "bcp",
  },
  {
    id: "duration-commander",
    name: "Duration Commander",
    subtitle: "Engine ① · Rate Scenario · Kelly Duration",
    icon: "⊿",
    description: "확률가중 금리시나리오 · 켈리 듀레이션 포지셔닝 · 내러티브 지표 추적",
    path: "/modules/rate-scenario",
    layer: "bcp",
  },
];

const LAYERS = [
  { id: "macro", label: "Layer 1 · MACRO", color: "#f59e0b" },
  { id: "market", label: "Layer 2 · MARKET", color: "#3b82f6" },
  { id: "investment-idea", label: "Layer 3 · INVESTMENT IDEA", color: "#10b981" },
  { id: "fund-idea", label: "Layer 4 · FUND IDEA", color: "#a855f7" },
  { id: "bcp", label: "Layer 5 · BCP", color: "#ef4444", locked: true },
];

const BCP_PIN = "7514";

export default function ControlTower() {
  const moduleCount = MODULES.length;
  const [bcpUnlocked, setBcpUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  const handlePinSubmit = () => {
    if (pinInput === BCP_PIN) {
      setBcpUnlocked(true);
      setShowPinModal(false);
      setPinInput("");
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput("");
    }
  };

  const handlePinKeyDown = (e) => {
    if (e.key === "Enter") handlePinSubmit();
    if (e.key === "Escape") {
      setShowPinModal(false);
      setPinInput("");
      setPinError(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-gray-200">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="text-sm text-amber-500/60 tracking-widest uppercase font-semibold">
            늑대무리원정단 — Control Tower
          </span>
        </div>
        <div className="text-5xl mb-4 drop-shadow-[0_0_12px_rgba(245,158,11,0.3)]">
          🐺
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
          늑대무리원정단
        </h1>
        <p className="text-sm text-gray-500 tracking-wide">
          Wolf Pack Expedition · Control Tower
        </p>
        <p className="text-xs text-gray-600 mt-3 font-mono">
          {moduleCount} modules active
        </p>
      </header>

      {/* Module Grid by Layer */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {LAYERS.map((layer) => {
          const layerModules = MODULES.filter((m) => m.layer === layer.id);
          if (layerModules.length === 0) return null;

          const isLocked = layer.locked && !bcpUnlocked;

          return (
            <section key={layer.id}>
              <div className="flex items-center gap-3 mb-4">
                <h2
                  className="text-xs font-bold tracking-[0.25em] uppercase pl-1"
                  style={{ color: layer.color }}
                >
                  {layer.label}
                </h2>
                {layer.locked && !bcpUnlocked && (
                  <button
                    onClick={() => {
                      setShowPinModal(true);
                      setPinError(false);
                      setPinInput("");
                    }}
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md border transition-all duration-200 cursor-pointer"
                    style={{
                      color: layer.color,
                      borderColor: `${layer.color}30`,
                      backgroundColor: `${layer.color}08`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = `${layer.color}60`;
                      e.currentTarget.style.backgroundColor = `${layer.color}15`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = `${layer.color}30`;
                      e.currentTarget.style.backgroundColor = `${layer.color}08`;
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 1a4 4 0 0 0-4 4v3H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4zm-2.5 4a2.5 2.5 0 1 1 5 0v3h-5V5z"/>
                    </svg>
                    LOCKED
                  </button>
                )}
                {layer.locked && bcpUnlocked && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M11.5 1a3.5 3.5 0 0 0-3.5 3.5V8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H9.5V4.5a2 2 0 1 1 4 0V8H15V4.5A3.5 3.5 0 0 0 11.5 1z"/>
                    </svg>
                    UNLOCKED
                  </span>
                )}
              </div>

              {isLocked ? (
                <div
                  className="rounded-xl border border-dashed p-8 text-center cursor-pointer transition-all duration-200"
                  style={{
                    borderColor: `${layer.color}20`,
                    backgroundColor: `${layer.color}05`,
                  }}
                  onClick={() => {
                    setShowPinModal(true);
                    setPinError(false);
                    setPinInput("");
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${layer.color}40`;
                    e.currentTarget.style.backgroundColor = `${layer.color}08`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = `${layer.color}20`;
                    e.currentTarget.style.backgroundColor = `${layer.color}05`;
                  }}
                >
                  <div className="text-2xl mb-2 opacity-40">🔒</div>
                  <p className="text-sm text-gray-500">관리자 인증이 필요합니다</p>
                  <p className="text-[11px] text-gray-600 mt-1">PIN을 입력하여 접근하세요</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {layerModules.map((mod) => (
                    <ModuleCard key={mod.id} module={mod} layerColor={layer.color} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </main>

      {/* PIN Modal */}
      {showPinModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPinModal(false);
              setPinInput("");
              setPinError(false);
            }
          }}
        >
          <div className="bg-[#111827] border border-gray-700 rounded-2xl p-8 w-80 shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-3xl mb-3">🔐</div>
              <h3 className="text-lg font-extrabold text-white">BCP Access</h3>
              <p className="text-xs text-gray-500 mt-1">관리자 PIN을 입력하세요</p>
            </div>

            <div className="space-y-4">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(false);
                }}
                onKeyDown={handlePinKeyDown}
                placeholder="PIN"
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-center text-lg font-mono tracking-[0.5em] bg-[#0a0e17] border outline-none transition-all duration-200"
                style={{
                  borderColor: pinError ? "rgba(239,68,68,0.6)" : "rgba(55,65,81,1)",
                  color: pinError ? "#f87171" : "white",
                }}
                onFocus={(e) => {
                  if (!pinError) e.target.style.borderColor = "rgba(239,68,68,0.4)";
                }}
                onBlur={(e) => {
                  if (!pinError) e.target.style.borderColor = "rgba(55,65,81,1)";
                }}
              />
              {pinError && (
                <p className="text-xs text-red-400 text-center">잘못된 PIN입니다</p>
              )}
              <button
                onClick={handlePinSubmit}
                className="w-full py-3 rounded-xl text-sm font-bold tracking-wider uppercase transition-all duration-200 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 hover:border-red-500/50"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-6 text-center">
        <p className="text-xs text-gray-600 font-mono">
          늑대무리원정단 v3.0.0
          <span className="text-gray-700 mx-1">·</span>
          Macro · Market · Investment Idea · Fund Idea · BCP
        </p>
      </footer>
    </div>
  );
}

function ModuleCard({ module, layerColor }) {
  return (
    <Link href={module.path}>
      <div className="relative group rounded-xl border p-5 transition-all duration-200 border-gray-800 bg-[#111827] hover:border-gray-700 hover:bg-[#151e2e] cursor-pointer">
        {/* Status badge */}
        <div className="absolute top-4 right-4">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-emerald-400">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            LIVE
          </span>
        </div>

        {/* Icon */}
        <div
          className="text-2xl mb-3 w-10 h-10 flex items-center justify-center rounded-lg"
          style={{ backgroundColor: `${layerColor}10` }}
        >
          {module.icon}
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-white mb-0.5">{module.name}</h3>
        <p className="text-[11px] text-gray-500 mb-2 font-mono">{module.subtitle}</p>

        {/* Description */}
        <p className="text-xs text-gray-400 leading-relaxed">{module.description}</p>
      </div>
    </Link>
  );
}
