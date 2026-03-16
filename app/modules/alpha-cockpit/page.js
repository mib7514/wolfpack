"use client";

import { useState } from "react";
import Link from "next/link";

// ─── Architecture Data ───────────────────────────────────────────

const REGIME_MATRIX = {
  rows: ["금리 하락", "금리 보합", "금리 상승"],
  cols: ["스프레드 축소", "스프레드 보합", "스프레드 확대"],
  cells: [
    ["골디락스", "듀레이션 랠리", "Flight to Quality"],
    ["캐리 천국", "정상 상태", "크레딧 스트레스"],
    ["리플레이션", "베어 스티프닝", "스태그플레이션"],
  ],
  // which engines shine in each regime
  engineMap: [
    [["①", "②", "④"], ["①", "⑤"], ["①"]],
    [["②", "③", "④", "⑥"], ["⑤", "⑥"], ["④", "⑤"]],
    [["②", "⑥"], ["③"], ["⑤"]],
  ],
};

const ENGINES = [
  {
    id: 1,
    num: "①",
    name: "Duration & Curve",
    nameKr: "듀레이션 & 커브",
    source: "금리 변동 손익",
    description:
      "금리 방향·커브 형태 전망 기반 듀레이션/커브 포지셔닝. Kelly 기반 베팅 사이즈 결정.",
    color: "#f59e0b",
    status: "live",
    module: "/modules/rate-scenario",
    moduleName: "Duration Commander",
  },
  {
    id: 2,
    num: "②",
    name: "Credit Selection & Curve Positioning",
    nameKr: "크레딧 선정 & 커브 포지셔닝",
    source: "스프레드 캐리 + 스프레드 변동 (종목/커브)",
    description:
      "발행체 선정(which name) + 만기 포지셔닝(which point)을 하나의 의사결정으로 통합. 구 Engine ②+③.",
    color: "#3b82f6",
    status: "planned",
    module: null,
    moduleName: null,
  },
  {
    id: 3,
    num: "③",
    name: "Segment Allocation",
    nameKr: "세그먼트 배분",
    source: "스프레드 변동 (시장 구간 레벨)",
    description:
      "은행채/공사채/카드채/캐피탈채/회사채 간 비중 조절. 크레딧 사이클에 따른 구간 로테이션.",
    color: "#8b5cf6",
    status: "planned",
    module: null,
    moduleName: null,
  },
  {
    id: 4,
    num: "④",
    name: "Rating Boundary Arbitrage",
    nameKr: "등급 경계 차익",
    source: "등급 경계 구조적 비효율",
    description:
      "A+→AA-, BBB+→A- 등 등급 경계의 비연속적 가격 점프를 선제 포착. 인덱스·가이드라인 구조적 요인.",
    color: "#ec4899",
    status: "planned",
    module: null,
    moduleName: null,
  },
  {
    id: 5,
    num: "⑤",
    name: "Liquidity Premium Harvesting",
    nameKr: "유동성 프리미엄 수확",
    source: "유동성 프리미엄",
    description:
      "같은 크레딧, 다른 유동성. 유통 물량·발행 시기에 의한 가격 할인을 체계적으로 수확.",
    color: "#14b8a6",
    status: "planned",
    module: null,
    moduleName: null,
  },
  {
    id: 6,
    num: "⑥",
    name: "New Issue Premium Capture",
    nameKr: "신규 발행 프리미엄 포착",
    source: "신규 발행 프리미엄",
    description:
      "수요예측 참여 → 발행 후 스프레드 축소 수익. 1차 시장 구조적 프리미엄의 체계적 수확.",
    color: "#f97316",
    status: "planned",
    module: null,
    moduleName: null,
  },
];

const MATURITY_BUCKETS = [
  {
    id: "Z",
    name: "Zone Zero",
    range: "0 ~ 6M",
    role: "유동성 버퍼 · 환매 대응",
    target: 10,
    band: [5, 20],
    color: "#64748b",
  },
  {
    id: "S",
    name: "Short",
    range: "6M ~ 1.5Y",
    role: "롤링 수확 구간",
    target: 25,
    band: [15, 35],
    color: "#14b8a6",
  },
  {
    id: "C",
    name: "Core",
    range: "1.5Y ~ 2.5Y",
    role: "주력 캐리 + 롤링 진행",
    target: 40,
    band: [25, 50],
    color: "#3b82f6",
  },
  {
    id: "L",
    name: "Long",
    range: "2.5Y ~ 5Y",
    role: "래더 공급원 · 신규 진입",
    target: 25,
    band: [10, 35],
    color: "#a855f7",
  },
];

const REINVESTMENT_TREE = [
  {
    step: 1,
    condition: "Z 버킷 < 하한(5%)?",
    action: "Z 버킷 보충 (CP/전단채)",
    icon: "🛡️",
  },
  {
    step: 2,
    condition: "래더에 빈 구간 존재?",
    action: "빈 구간 우선 충당 + Engine ② 시그널",
    icon: "🔧",
  },
  {
    step: 3,
    condition: "Engine ⑥ 매력적 딜?",
    action: "신규발행 참여 (래더 기여도 점검)",
    icon: "🎯",
  },
  {
    step: 4,
    condition: "위 조건 모두 불충족",
    action: "Roll-down sweet spot 구간 투자",
    icon: "📐",
  },
];

// ─── Components ──────────────────────────────────────────────────

function FlowArrow({ label }) {
  return (
    <div className="flex flex-col items-center py-3">
      <div className="w-px h-6 bg-gradient-to-b from-gray-700 to-gray-600" />
      {label && (
        <span className="text-[10px] text-gray-500 font-mono tracking-wider my-1">
          {label}
        </span>
      )}
      <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-gray-600" />
    </div>
  );
}

function RegimeDetector() {
  const [hoveredCell, setHoveredCell] = useState(null);

  return (
    <section className="arch-section">
      <SectionHeader
        tag="DETECTION LAYER"
        title="Market Regime Detector"
        subtitle="9-Regime Matrix · 금리 방향 × 스프레드 방향"
        color="#f59e0b"
      />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-2" />
              {REGIME_MATRIX.cols.map((col, i) => (
                <th
                  key={i}
                  className="p-2 text-center font-mono text-gray-400 font-normal tracking-wide"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REGIME_MATRIX.rows.map((row, ri) => (
              <tr key={ri}>
                <td className="p-2 text-right font-mono text-gray-400 whitespace-nowrap pr-4">
                  {row}
                </td>
                {REGIME_MATRIX.cols.map((_, ci) => {
                  const isHovered =
                    hoveredCell && hoveredCell[0] === ri && hoveredCell[1] === ci;
                  const engines = REGIME_MATRIX.engineMap[ri][ci];
                  return (
                    <td
                      key={ci}
                      className={`
                        p-3 text-center border border-gray-800/50 rounded cursor-default transition-all duration-200
                        ${isHovered ? "bg-amber-500/10 border-amber-500/30" : "bg-[#111827]/60 hover:bg-[#1a2035]"}
                      `}
                      onMouseEnter={() => setHoveredCell([ri, ci])}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <div className="font-semibold text-gray-200 mb-1.5">
                        {REGIME_MATRIX.cells[ri][ci]}
                      </div>
                      <div className="flex gap-1 justify-center flex-wrap">
                        {engines.map((e) => {
                          const engine = ENGINES.find((eng) => eng.num === e);
                          return (
                            <span
                              key={e}
                              className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
                              style={{
                                backgroundColor: engine
                                  ? `${engine.color}20`
                                  : "#333",
                                color: engine ? engine.color : "#999",
                              }}
                            >
                              {e}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EnginePanel() {
  const [expanded, setExpanded] = useState(null);

  return (
    <section className="arch-section">
      <SectionHeader
        tag="ALPHA GENERATION LAYER"
        title="6 Alpha Engines"
        subtitle="각 엔진이 물리적으로 구별되는 알파 원천에 1:1 매핑"
        color="#3b82f6"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ENGINES.map((engine) => {
          const isExpanded = expanded === engine.id;
          return (
            <div
              key={engine.id}
              className={`
                relative rounded-xl border p-4 transition-all duration-200 cursor-pointer
                ${isExpanded ? "border-opacity-60 bg-[#151e2e]" : "border-gray-800 bg-[#111827] hover:bg-[#151e2e]"}
              `}
              style={{
                borderColor: isExpanded ? engine.color : undefined,
              }}
              onClick={() => setExpanded(isExpanded ? null : engine.id)}
            >
              {/* Status */}
              <div className="absolute top-3 right-3">
                {engine.status === "live" ? (
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

              {/* Engine number */}
              <div
                className="text-lg font-black mb-2"
                style={{ color: engine.color }}
              >
                {engine.num}
              </div>

              {/* Names */}
              <h3 className="text-sm font-bold text-white leading-tight">
                {engine.name}
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">{engine.nameKr}</p>

              {/* Alpha source */}
              <div className="mt-3 flex items-center gap-1.5">
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: `${engine.color}15`,
                    color: engine.color,
                  }}
                >
                  α원천
                </span>
                <span className="text-[11px] text-gray-400">{engine.source}</span>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {engine.description}
                  </p>
                  {engine.module && (
                    <Link
                      href={engine.module}
                      className="inline-flex items-center gap-1.5 mt-3 text-[11px] font-semibold transition-colors"
                      style={{ color: engine.color }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {engine.moduleName} →
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PortfolioConstructionOS() {
  return (
    <section className="arch-section">
      <SectionHeader
        tag="PORTFOLIO CONSTRUCTION LAYER"
        title="Portfolio Construction OS"
        subtitle="엔진 시그널을 시간 축 위에 배치하는 운영 체제"
        color="#10b981"
      />

      <div className="space-y-6">
        {/* Maturity Ladder */}
        <div className="rounded-xl border border-gray-800 bg-[#111827] p-5">
          <h4 className="text-xs font-bold tracking-widest text-emerald-400 uppercase mb-4">
            Maturity Ladder Discipline
          </h4>

          {/* Pipeline visualization */}
          <div className="flex items-end gap-1 h-40 mb-4">
            {MATURITY_BUCKETS.map((bucket) => (
              <div
                key={bucket.id}
                className="flex-1 flex flex-col items-center justify-end"
              >
                {/* Bar */}
                <div className="relative w-full group">
                  {/* Band range (subtle background) */}
                  <div
                    className="absolute bottom-0 w-full rounded-t opacity-10"
                    style={{
                      height: `${bucket.band[1] * 2.5}px`,
                      backgroundColor: bucket.color,
                    }}
                  />
                  {/* Target bar */}
                  <div
                    className="relative w-full rounded-t transition-all duration-300 group-hover:opacity-90"
                    style={{
                      height: `${bucket.target * 2.5}px`,
                      backgroundColor: `${bucket.color}90`,
                      boxShadow: `0 0 20px ${bucket.color}20`,
                    }}
                  >
                    {/* Target label */}
                    <div
                      className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-bold"
                      style={{ color: bucket.color }}
                    >
                      {bucket.target}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bucket labels */}
          <div className="flex gap-1">
            {MATURITY_BUCKETS.map((bucket) => (
              <div key={bucket.id} className="flex-1 text-center">
                <div
                  className="text-sm font-black"
                  style={{ color: bucket.color }}
                >
                  {bucket.id}
                </div>
                <div className="text-[10px] text-gray-500 font-mono">
                  {bucket.range}
                </div>
                <div className="text-[10px] text-gray-600 mt-0.5">
                  {bucket.role}
                </div>
              </div>
            ))}
          </div>

          {/* Flow direction */}
          <div className="flex items-center justify-center mt-4 gap-2">
            <span className="text-[10px] text-gray-600 font-mono">L</span>
            <div className="flex-1 h-px bg-gradient-to-r from-purple-500/40 via-blue-500/40 via-teal-500/40 to-gray-500/40 relative">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent border-l-[5px] border-l-gray-500/40" />
            </div>
            <span className="text-[10px] text-gray-600 font-mono">Z</span>
            <span className="text-[10px] text-gray-500 ml-2">
              → 만기상환 → 재투자
            </span>
          </div>
        </div>

        {/* Two columns: Rules + Reinvestment Tree */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Operating Rules */}
          <div className="rounded-xl border border-gray-800 bg-[#111827] p-5">
            <h4 className="text-xs font-bold tracking-widest text-emerald-400 uppercase mb-4">
              Operating Rules
            </h4>
            <div className="space-y-3">
              {[
                {
                  rule: "분기별 흐름 점검",
                  desc: "만기 도래 물량 → 신규 매수 예산 산출",
                  tag: "QUARTERLY",
                },
                {
                  rule: "래더 기여도 필터",
                  desc: "빈 버킷 종목 우선순위 ↑ / 밀집 버킷 ↓",
                  tag: "PER TRADE",
                },
                {
                  rule: "만기 밀집 경보",
                  desc: "6개월 윈도우 내 AUM 20%+ 만기 도래 시 발동",
                  tag: "ALERT",
                },
                {
                  rule: "Roll-down Sweet Spot",
                  desc: "커브 최급경사 구간 → C 버킷 중심 설정",
                  tag: "QUARTERLY",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-2.5 rounded-lg bg-[#0d1117]/60"
                >
                  <span className="text-[9px] font-bold tracking-wider text-emerald-400/70 bg-emerald-400/10 px-1.5 py-0.5 rounded whitespace-nowrap mt-0.5">
                    {item.tag}
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-gray-200">
                      {item.rule}
                    </div>
                    <div className="text-[11px] text-gray-500">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reinvestment Decision Tree */}
          <div className="rounded-xl border border-gray-800 bg-[#111827] p-5">
            <h4 className="text-xs font-bold tracking-widest text-emerald-400 uppercase mb-4">
              Reinvestment Decision Tree
            </h4>
            <div className="space-y-2">
              {REINVESTMENT_TREE.map((node, i) => (
                <div key={node.step}>
                  <div className="flex items-start gap-3 p-2.5 rounded-lg bg-[#0d1117]/60">
                    <span className="text-lg">{node.icon}</span>
                    <div className="flex-1">
                      <div className="text-[11px] text-gray-500 font-mono mb-0.5">
                        IF: {node.condition}
                      </div>
                      <div className="text-xs font-semibold text-gray-200">
                        → {node.action}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-gray-600 mt-1">
                      #{node.step}
                    </span>
                  </div>
                  {i < REINVESTMENT_TREE.length - 1 && (
                    <div className="flex items-center justify-center py-1">
                      <span className="text-[10px] text-gray-700 font-mono">
                        ELSE ↓
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Risk Constraints */}
        <div className="rounded-xl border border-gray-800 bg-[#111827] p-5">
          <h4 className="text-xs font-bold tracking-widest text-red-400/70 uppercase mb-3">
            Risk Constraints
          </h4>
          <div className="flex flex-wrap gap-2">
            {[
              "듀레이션 타겟 & 밴드",
              "발행체 집중도 한도",
              "세그먼트 비중 한도",
              "유동성 버퍼 (Z ≥ 5%)",
              "만기 밀집 경보 (20%/6M)",
            ].map((constraint) => (
              <span
                key={constraint}
                className="text-[11px] text-gray-400 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-1.5"
              >
                {constraint}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ tag, title, subtitle, color }) {
  return (
    <div className="mb-5">
      <span
        className="text-[10px] font-bold tracking-[0.3em] uppercase"
        style={{ color }}
      >
        {tag}
      </span>
      <h2 className="text-xl font-extrabold text-white mt-1">{title}</h2>
      {subtitle && (
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function AlphaCockpit() {
  return (
    <div className="min-h-screen bg-[#0a0e17] text-gray-200">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors mb-6"
          >
            ← Control Tower
          </Link>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[10px] font-bold tracking-[0.3em] text-amber-500/80 uppercase">
              베스트크레딧플러스 · Alpha Architecture
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Alpha Cockpit
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Market Regime → 6 Engines → Portfolio Construction OS → Final
            Portfolio
          </p>

          {/* Quick stats */}
          <div className="flex gap-4 mt-5">
            {[
              {
                label: "Engines",
                value: `${ENGINES.filter((e) => e.status === "live").length}/${ENGINES.length}`,
                sub: "live",
              },
              { label: "Regimes", value: "9", sub: "3×3 matrix" },
              { label: "Buckets", value: "4", sub: "Z·S·C·L" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-[#111827] border border-gray-800 rounded-lg px-4 py-2.5"
              >
                <div className="text-lg font-extrabold text-white">
                  {stat.value}
                </div>
                <div className="text-[10px] text-gray-500 font-mono">
                  {stat.label}{" "}
                  <span className="text-gray-600">· {stat.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Architecture Flow */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Level 0: Regime Detector */}
        <RegimeDetector />

        <FlowArrow label="regime signal" />

        {/* Level 1: Alpha Engines */}
        <EnginePanel />

        <FlowArrow label="trade signals" />

        {/* Level 2: Portfolio Construction OS */}
        <PortfolioConstructionOS />

        <FlowArrow label="" />

        {/* Level 3: Final Portfolio */}
        <section className="arch-section">
          <div className="rounded-xl border border-dashed border-gray-700 bg-[#111827]/40 p-8 text-center">
            <div className="text-2xl mb-2">🐺</div>
            <h3 className="text-lg font-extrabold text-white">
              Final Portfolio
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Portfolio Tracker 모듈 연동 예정
            </p>
            <p className="text-[10px] text-gray-600 mt-3 font-mono">
              종목 입력 → 실시간 버킷 분포 · 래더 건전성 · 엔진별 기여도 추적
            </p>
          </div>
        </section>

        {/* Design Philosophy */}
        <section className="mt-12 mb-8 rounded-xl border border-gray-800/50 bg-[#0d1117] p-6">
          <h4 className="text-[10px] font-bold tracking-[0.3em] text-gray-500 uppercase mb-3">
            Design Philosophy · First Principles
          </h4>
          <blockquote className="text-sm text-gray-400 leading-relaxed italic border-l-2 border-amber-500/30 pl-4">
            "알파 엔진이 무엇을 할 것인가를 결정하고,
            <br />
            Maturity Ladder OS가 그 결정들을 시간 축 위에 어떻게 배치할
            것인가를 결정한다."
          </blockquote>
          <div className="flex flex-wrap gap-3 mt-4">
            {[
              "6 engines × 1:1 alpha source mapping",
              "9-regime awareness",
              "Pipeline, not snapshot",
              "Solo practitioner + AI",
            ].map((principle) => (
              <span
                key={principle}
                className="text-[10px] font-mono text-amber-500/60 bg-amber-500/5 px-2.5 py-1 rounded"
              >
                {principle}
              </span>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-6 text-center">
        <p className="text-xs text-gray-600 font-mono">
          베스트크레딧플러스 Alpha Cockpit v1.0
          <span className="text-gray-700 mx-1">·</span>
          Regime → Engines → Construction OS → Portfolio
        </p>
      </footer>
    </div>
  );
}
