"use client";

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
    status: "live",
  },
  {
    id: "taylor-rule",
    name: "테일러 룰 모니터",
    subtitle: "Modified Taylor Rule Monitor",
    icon: "📐",
    description: "수정 테일러 룰 기반 적정금리 vs 기준금리 괴리 분석 · 국고3년 GAP 비교",
    path: "/taylor-rule",
    layer: "macro",
    status: "live",
  },
  {
    id: "fed-watch",
    name: "Fed Watch",
    subtitle: "FOMC 금리 전망 모니터",
    icon: "🏛️",
    description: "CME FedWatch 기반 금리 기대값 시계열 추적",
    path: "/modules/fed-watch",
    layer: "macro",
    status: "live",
  },
  {
    id: "oil-cpi",
    name: "Oil → CPI Monitor",
    subtitle: "유가-물가 패스스루 시뮬레이터",
    icon: "🛢️",
    description: "국제유가 시나리오별 한미 CPI 영향 분석 · 실질금리 추적",
    path: "/modules/oil-cpi",
    layer: "macro",
    status: "live",
  },
  {
    id: "rate-scenario",
    name: "금리 시나리오",
    subtitle: "Rate Scenario Calculator",
    icon: "⊿",
    description: "확률가중 금리 전망 시뮬레이션",
    path: "/modules/rate-scenario",
    layer: "macro",
    status: "planned",
  },
  {
    id: "employment-narrative",
    name: "고용 내러티브",
    subtitle: "Employment Narrative Monitor",
    icon: "🐺",
    description: "미국 고용지표 내러티브 추적 · AI 자동 발견",
    path: "/modules/employment-narrative",
    layer: "macro",
    status: "live",
  },
  // ─── Layer 2: MARKET ───
  {
    id: "market-monitor",
    name: "Market Monitor",
    subtitle: "글로벌 시장 모니터링",
    icon: "📊",
    description: "차트 스크린샷 AI 분석 · Chart Vision",
    path: "/market",
    layer: "market",
    status: "live",
  },
  {
    id: "consumer-sector",
    name: "소비주 모니터링",
    subtitle: "Consumer Sector Tracker",
    icon: "🛍️",
    description: "KOSPI vs KODEX 경기소비재 · 소비자심리지수 추적",
    path: "/modules/market",
    layer: "market",
    status: "live",
  },
  {
    id: "gold-monitor",
    name: "Gold CB Monitor",
    subtitle: "중앙은행 금 매입 추적",
    icon: "🥇",
    description: "글로벌 CB 금 매입 · IB 전망 · 국가별 추적",
    path: "/modules/gold-monitor",
    layer: "market",
    status: "live",
  },
  // ─── Layer 3: CREDIT ───
  {
    id: "sector-watch",
    name: "Sector Watch",
    subtitle: "산업별 조기경보",
    icon: "◉",
    description: "산업별 크레딧 신호등 모니터링",
    path: "/modules/sector-watch",
    layer: "credit",
    status: "planned",
  },
  {
    id: "risk-alert",
    name: "Risk Alert",
    subtitle: "종목별 위기감지",
    icon: "⚑",
    description: "고빈도 선행지표 기반 크레딧 경보",
    path: "/modules/risk-alert",
    layer: "credit",
    status: "planned",
  },
  // ─── Layer 4: PORTFOLIO ───
  {
    id: "portfolio-tracker",
    name: "Portfolio Tracker",
    subtitle: "보유종목 & 매매",
    icon: "⊞",
    description: "듀레이션, 커브, 섹터 포지션 현황",
    path: "/modules/portfolio-tracker",
    layer: "portfolio",
    status: "planned",
  },
  {
    id: "deficit-analysis",
    name: "적자기업 투자분석",
    subtitle: "Deficit Company Analysis",
    icon: "🎯",
    description: "코스닥 Top50 적자유형 · 위험대비수익 Top10 · ETF 매칭",
    path: "/modules/deficit-analysis",
    layer: "portfolio",
    status: "live",
  },
  {
    id: "reit-scoring",
    name: "K-REIT 스코어링",
    subtitle: "REIT Screening & Scoring",
    icon: "◉",
    description: "채권 투자자 관점 5축 분석 · 연율화 캐리 · 금리 스트레스 테스트",
    path: "/modules/reit-scoring",
    layer: "portfolio",
    status: "live",
  },
];

const LAYERS = [
  { id: "macro", label: "Layer 1 · MACRO", color: "#f59e0b" },
  { id: "market", label: "Layer 2 · MARKET", color: "#3b82f6" },
  { id: "credit", label: "Layer 3 · CREDIT", color: "#ef4444" },
  { id: "portfolio", label: "Layer 4 · PORTFOLIO", color: "#10b981" },
];

export default function ControlTower() {
  const liveCount = MODULES.filter((m) => m.status === "live").length;
  const totalCount = MODULES.length;

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
          {liveCount} / {totalCount} modules active
        </p>
      </header>

      {/* Module Grid by Layer */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {LAYERS.map((layer) => {
          const layerModules = MODULES.filter((m) => m.layer === layer.id);
          if (layerModules.length === 0) return null;

          return (
            <section key={layer.id}>
              <h2
                className="text-xs font-bold tracking-[0.25em] uppercase mb-4 pl-1"
                style={{ color: layer.color }}
              >
                {layer.label}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {layerModules.map((mod) => (
                  <ModuleCard key={mod.id} module={mod} layerColor={layer.color} />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-6 text-center">
        <p className="text-xs text-gray-600 font-mono">
          늑대무리원정단 v1.3.0
          <span className="text-gray-700 mx-1">·</span>
          Macro · Market · Credit · Portfolio
        </p>
      </footer>
    </div>
  );
}

function ModuleCard({ module, layerColor }) {
  const isLive = module.status === "live";

  const card = (
    <div
      className={`
        relative group rounded-xl border p-5 transition-all duration-200
        ${
          isLive
            ? "border-gray-800 bg-[#111827] hover:border-gray-700 hover:bg-[#151e2e] cursor-pointer"
            : "border-gray-800/50 bg-[#0d1117] opacity-50 cursor-default"
        }
      `}
    >
      {/* Status badge */}
      <div className="absolute top-4 right-4">
        {isLive ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-emerald-400">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            LIVE
          </span>
        ) : (
          <span className="text-[10px] font-bold tracking-wider uppercase text-gray-600">
            PLANNED
          </span>
        )}
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
  );

  if (isLive) {
    return <Link href={module.path}>{card}</Link>;
  }

  return card;
}
