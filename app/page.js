'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MODULES = [
  { id: 'business-cycle', name: '경기순환 추적기', emoji: '🔄', path: '/modules/business-cycle', color: 'from-blue-500 to-purple-500' },
  { id: 'us-market', name: 'US 마켓 리포트', emoji: '🇺🇸', path: '/modules/us-market', color: 'from-green-500 to-teal-500' },
  { id: 'oil-cpi', name: 'Oil & CPI 모니터', emoji: '⛽', path: '/modules/oil-cpi', color: 'from-amber-500 to-orange-500' },
  { id: 'deficit-watch', name: '적자기업 워치', emoji: '📉', path: '/modules/deficit-watch', color: 'from-red-500 to-pink-500' },
  { id: 'inbound-tourism', name: '인바운드 관광', emoji: '✈️', path: '/modules/inbound-tourism', color: 'from-cyan-500 to-blue-500' },
  { id: 'valuation-parity', name: '밸류에이션 패리티', emoji: '⚖️', path: '/modules/valuation-parity', color: 'from-indigo-500 to-purple-500' },
  { id: 'market-consumer', name: '시장/소비심리', emoji: '📊', path: '/modules/market-consumer', color: 'from-emerald-500 to-green-500' },
  { id: 'taylor-rule', name: '테일러 룰', emoji: '🎯', path: '/modules/taylor-rule', color: 'from-violet-500 to-purple-500' },
  { id: 'narrative-radar', name: '내러티브 레이더', emoji: '📡', path: '/modules/narrative-radar', color: 'from-rose-500 to-pink-500' },
  { id: 'inflation-monitor', name: '인플레이션 모니터', emoji: '🔥', path: '/modules/inflation-monitor', color: 'from-orange-500 to-red-500' },
  { id: 'gold-monitor', name: 'Gold Monitor', emoji: '🥇', path: '/modules/gold-monitor', color: 'from-yellow-500 to-amber-500' },
  { id: 'growth-radar', name: 'Growth Radar', emoji: '🚀', path: '/modules/growth-radar', color: 'from-teal-500 to-cyan-500' },
];

function StatusDot({ status }) {
  const colors = {
    active: 'bg-green-400',
    warning: 'bg-yellow-400',
    error: 'bg-red-400',
    unknown: 'bg-gray-400'
  };
  return <div className={`w-2 h-2 rounded-full ${colors[status]} animate-pulse`} />;
}

export default function ControlTower() {
  const [systemStatus, setSystemStatus] = useState({});

  useEffect(() => {
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    const status = {};
    
    // Check Supabase connection
    try {
      const { data, error } = await supabase.from('cycle_data').select('*').limit(1);
      status.database = error ? 'error' : 'active';
    } catch {
      status.database = 'error';
    }

    // Check environment variables
    status.env = (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) 
      ? 'active' : 'warning';

    setSystemStatus(status);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-3xl">🐺</div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Hello Wolfpack
                </h1>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  늑대무리원정단 Control Tower
                </h1>
                <p className="text-sm text-slate-400">Macro · Credit · Portfolio 통합 모니터링</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <StatusDot status={systemStatus.database} />
                <span className="text-sm text-slate-400">DB</span>
              </div>
              <div className="flex items-center space-x-2">
                <StatusDot status={systemStatus.env} />
                <span className="text-sm text-slate-400">ENV</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {MODULES.map((module) => (
            <div key={module.id} className="group">
              <div className="relative overflow-hidden rounded-xl bg-slate-800/50 border border-slate-700 hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10">
                <div className={`absolute inset-0 bg-gradient-to-br ${module.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                <div className="relative p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-2xl">{module.emoji}</div>
                    <StatusDot status="active" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2 group-hover:text-blue-400 transition-colors">
                    {module.name}
                  </h3>
                  <p className="text-sm text-slate-400 mb-4">
                    실시간 데이터 모니터링 및 분석
                  </p>
                  <a
                    href={module.path}
                    className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    모듈 열기
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* System Info */}
        <div className="mt-12 bg-slate-800/30 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <span className="text-xl mr-2">⚙️</span>
            System Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Database:</span>
              <span className={`ml-2 ${systemStatus.database === 'active' ? 'text-green-400' : 'text-red-400'}`}>
                {systemStatus.database === 'active' ? '연결됨' : '연결 실패'}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Environment:</span>
              <span className={`ml-2 ${systemStatus.env === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
                {systemStatus.env === 'active' ? '설정 완료' : '일부 누락'}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Modules:</span>
              <span className="ml-2 text-blue-400">{MODULES.length}개 활성화</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}