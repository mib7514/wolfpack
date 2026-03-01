'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const MODULES = [
  {
    id: 'business-cycle',
    layer: 'MACRO',
    title: '경기순환 체크리스트',
    subtitle: 'Business Cycle Dashboard',
    description: '한국/미국 68개 문항 경기국면 분석',
    href: '/modules/business-cycle',
    icon: '◈',
    accentColor: '#f97316',
    status: 'active',
  },
  {
    id: 'rates-scenario',
    layer: 'MACRO',
    title: '금리 시나리오',
    subtitle: 'Rate Scenario Calculator',
    description: '확률가중 금리 전망 시뮬레이션',
    href: null,
    icon: '⊿',
    accentColor: '#38bdf8',
    status: 'planned',
  },
  {
    id: 'market-monitor',
    layer: 'MARKET',
    title: 'Market Monitor',
    subtitle: '글로벌 시장 모니터링',
    description: '차트 스크린샷 AI 분석 · Chart Vision',
    href: '/market',
    icon: '📊',
    accentColor: '#4FC3F7',
    status: 'active',
  },
  {
    id: 'sector-watch',
    layer: 'CREDIT',
    title: 'Sector Watch',
    subtitle: '산업별 조기경보',
    description: '산업별 크레딧 신호등 모니터링',
    href: null,
    icon: '◉',
    accentColor: '#a78bfa',
    status: 'planned',
  },
  {
    id: 'credit-monitor',
    layer: 'CREDIT',
    title: 'Risk Alert',
    subtitle: '종목별 위기감지',
    description: '고빈도 선행지표 기반 크레딧 경보',
    href: null,
    icon: '⚑',
    accentColor: '#f87171',
    status: 'planned',
  },
  {
    id: 'portfolio',
    layer: 'PORTFOLIO',
    title: 'Portfolio Tracker',
    subtitle: '보유종목 & 매매',
    description: '듀레이션, 커브, 섹터 포지션 현황',
    href: null,
    icon: '⊞',
    accentColor: '#34d399',
    status: 'planned',
  },
];

const LAYER_ORDER = ['MACRO', 'MARKET', 'CREDIT', 'PORTFOLIO'];

const LAYER_LABELS = {
  MACRO: { label: 'Layer 1 · MACRO', color: '#f97316' },
  MARKET: { label: 'Layer 2 · MARKET', color: '#4FC3F7' },
  CREDIT: { label: 'Layer 3 · CREDIT', color: '#a78bfa' },
  PORTFOLIO: { label: 'Layer 4 · PORTFOLIO', color: '#34d399' },
};

function StatusBadge({ status }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        LIVE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-gray-500 border border-white/5">
      PLANNED
    </span>
  );
}

function CycleSummary({ data }) {
  if (!data) return null;
  const phases = ['침체', '회복', '확장', '둔화'];
  const phaseColors = { '침체': '#ef4444', '회복': '#eab308', '확장': '#22c55e', '둔화': '#3b82f6' };

  return (
    <div className="mt-3 pt-3 border-t border-white/5">
      <div className="grid grid-cols-2 gap-3">
        {['KR', 'US'].map(c => {
          const scores = data[c];
          if (!scores) return null;
          const totals = { '침체': 0, '회복': 0, '확장': 0, '둔화': 0 };
          const QUESTIONS_PHASES = {
            1:'침체',2:'회복',3:'확장',4:'둔화',5:'침체',6:'회복',7:'확장',8:'둔화',
            9:'침체',10:'회복',11:'확장',12:'둔화',13:'침체',14:'회복',15:'확장',16:'둔화',
            17:'침체',18:'회복',19:'확장',20:'둔화',21:'침체',22:'회복',23:'확장',24:'둔화',
            25:'침체',26:'회복',27:'확장',28:'둔화',29:'침체',30:'회복',31:'확장',32:'둔화',
            33:'침체',34:'회복',35:'확장',36:'둔화',37:'침체',38:'회복',39:'확장',40:'둔화',
            41:'침체',42:'회복',43:'확장',44:'둔화',45:'침체',46:'회복',47:'확장',48:'둔화',
            49:'침체',50:'회복',51:'확장',52:'둔화',53:'침체',54:'회복',55:'확장',56:'둔화',
            57:'침체',58:'회복',59:'확장',60:'둔화',61:'침체',62:'회복',63:'확장',64:'둔화',
            65:'침체',66:'회복',67:'확장',68:'둔화',
          };
          const latestIdx = 13; // 2026-02
          for (let qn = 1; qn <= 68; qn++) {
            const phase = QUESTIONS_PHASES[qn];
            totals[phase] += (scores[qn]?.[latestIdx] || 0);
          }
          const max = Math.max(...Object.values(totals));
          const dominant = phases.find(p => totals[p] === max);
          const net = (totals['확장'] + totals['회복']) - (totals['침체'] + totals['둔화']);

          return (
            <div key={c} className="text-center">
              <div className="text-[10px] text-gray-500 mb-1">{c === 'KR' ? '🇰🇷 한국' : '🇺🇸 미국'}</div>
              <div className="text-sm font-bold" style={{ color: phaseColors[dominant] }}>{dominant}</div>
              <div className="text-[10px] text-gray-500">Net {net > 0 ? '+' : ''}{net}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ControlTower() {
  const [cycleData, setCycleData] = useState(null);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const now = new Date();
    setCurrentTime(now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }));

    // Load business cycle data from Supabase
    async function loadCycleData() {
      try {
        const { data, error } = await supabase
          .from('business_cycle_scores')
          .select('country, scores')
          .order('updated_at', { ascending: false });

        if (!error && data?.length > 0) {
          const result = {};
          data.forEach(row => { result[row.country] = row.scores; });
          setCycleData(result);
        }
      } catch (e) {
        console.log('Supabase not configured yet, using defaults');
      }
    }
    loadCycleData();
  }, []);

  const groupedModules = {};
  MODULES.forEach(m => {
    if (!groupedModules[m.layer]) groupedModules[m.layer] = [];
    groupedModules[m.layer].push(m);
  });

  // Use LAYER_ORDER to maintain consistent ordering
  const orderedLayers = LAYER_ORDER.filter(l => groupedModules[l]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-white/5 bg-gradient-to-b from-[#111827] to-transparent">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-wolf-600 to-wolf-800 flex items-center justify-center text-lg font-black text-white shadow-lg shadow-wolf-600/20">
                  🐺
                </div>
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight">
                    늑대무리원정단
                  </h1>
                  <p className="text-[11px] text-gray-500 tracking-widest uppercase">
                    Wolf Pack Expedition · Control Tower
                  </p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">{currentTime}</div>
              <div className="text-[10px] text-gray-600 mt-0.5">
                {MODULES.filter(m => m.status === 'active').length} / {MODULES.length} modules active
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Module Grid */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {orderedLayers.map((layer, layerIdx) => {
          const modules = groupedModules[layer];
          return (
            <div key={layer} className="mb-10 animate-fade-in" style={{ animationDelay: `${layerIdx * 0.1}s` }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent" style={{ backgroundImage: `linear-gradient(to right, ${LAYER_LABELS[layer].color}33, transparent)` }} />
                <span className="text-[11px] font-bold tracking-widest" style={{ color: LAYER_LABELS[layer].color }}>
                  {LAYER_LABELS[layer].label}
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent" style={{ backgroundImage: `linear-gradient(to left, ${LAYER_LABELS[layer].color}33, transparent)` }} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {modules.map((mod, i) => {
                  const CardWrapper = mod.href ? Link : 'div';
                  const cardProps = mod.href ? { href: mod.href } : {};

                  return (
                    <CardWrapper
                      key={mod.id}
                      {...cardProps}
                      className={`block rounded-xl border border-white/5 bg-[#1a2035] p-5 card-hover animate-fade-in ${mod.href ? 'cursor-pointer' : 'opacity-50 cursor-default'}`}
                      style={{ animationDelay: `${(layerIdx * 0.1) + (i * 0.05)}s` }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-base font-bold"
                            style={{ background: `${mod.accentColor}15`, color: mod.accentColor }}
                          >
                            {mod.icon}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-gray-100">{mod.title}</h3>
                            <p className="text-[10px] text-gray-500 tracking-wide">{mod.subtitle}</p>
                          </div>
                        </div>
                        <StatusBadge status={mod.status} />
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{mod.description}</p>

                      {/* Show live data summary for active modules */}
                      {mod.id === 'business-cycle' && <CycleSummary data={cycleData} />}
                    </CardWrapper>
                  );
                })}
              </div>
            </div>
          );
        })}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <span className="text-[10px] text-gray-600">늑대무리원정단 v1.1.0</span>
          <span className="text-[10px] text-gray-600">Macro · Market · Credit · Portfolio</span>
        </div>
      </footer>
    </div>
  );
}
