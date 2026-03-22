'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════
// 상수
// ═══════════════════════════════════════════════════════════════

const TRIGGER_CONFIG = [
  { key: 'sp500', label: 'S&P 500', threshold: 6600, unit: '', direction: 'below', desc: '부의효과 감소 → 소비심리 꺾임', fred: true },
  { key: 'wti', label: 'WTI 유가', threshold: 100, unit: '$', direction: 'above', desc: '기업마진 직접 훼손', fred: true },
  { key: 'dxy', label: 'DXY 달러', threshold: 100, unit: '', direction: 'above', desc: '글로벌 유동성 압박', fred: false },
  { key: 'ust30y', label: '30Y 금리', threshold: 5.0, unit: '%', direction: 'above', desc: '자금조달비용 위험수준', fred: true },
];

const EXTRA_INDICATORS = [
  { key: 'ust10y', label: '10Y 금리', unit: '%' },
  { key: 'ust2y', label: '2Y 금리', unit: '%' },
  { key: 'hy_oas', label: 'HY OAS', unit: 'bp' },
  { key: 'vix', label: 'VIX', unit: '' },
  { key: 'bei_5y', label: '5Y BEI', unit: '%' },
  { key: 'brent', label: 'Brent', unit: '$' },
];

const DAILY_ITEMS = [
  { id: 'wti_sustained', label: 'WTI $95+ 5영업일 유지', cat: '에너지쇼크' },
  { id: 'brent_wti_spread', label: 'Brent-WTI 스프레드 확대', cat: '에너지쇼크' },
  { id: 'crack_spread', label: '정제마진(크랙) 급등', cat: '에너지쇼크' },
  { id: 'hy_oas_wide', label: 'HY OAS 급확대 (400bp+)', cat: '신용스트레스' },
  { id: 'loan_distress', label: '레버리지론 가격 par 95 이하', cat: '신용스트레스' },
  { id: 'financials_weak', label: '금융주 상대수익률 급락', cat: '신용스트레스' },
  { id: 'dxy_above100', label: 'DXY 100+ 유지', cat: '유동성압박' },
  { id: 'real_rates_up', label: '장단기 실질금리 동반 상승', cat: '유동성압박' },
];

const WEEKLY_ITEMS = [
  { id: 'supply_shock', label: '유가↑ + PMI↓ → 공급쇼크(스태그)', cat: '원인분해' },
  { id: 'demand_recovery', label: '유가↑ + PMI↑ → 수요회복(경기강)', cat: '원인분해' },
  { id: 'bei_rising', label: '5y5y 기대인플레 추세적 상승', cat: '인플레기대' },
  { id: 'stagflation_signal', label: '인플레↑ + 성장↓ 동시 발생', cat: '인플레기대' },
  { id: 'pc_gate_spreading', label: '세미리퀴드펀드 게이트/지급지연 확산', cat: 'Priv. Credit' },
  { id: 'pc_price_falling', label: '사모대출 거래가격 추세 하락', cat: 'Priv. Credit' },
  { id: 'triple_pressure', label: '유가↑+달러↑+장기금리↑ 같은 주', cat: '정책풋' },
  { id: 'credit_equity_diverge', label: '주식↓ + 크레딧스프레드↑ 동시', cat: '정책풋' },
  { id: 'margin_pressure', label: '기업 가이던스에 원가압박 명시', cat: '정책풋' },
  { id: 'policy_sequence', label: '금리인하보다 유동성/규제/재정 선행', cat: '정책풋' },
];

const SC = {
  green: { bg: '#0a2e1a', border: '#22c55e', text: '#4ade80', glow: 'rgba(34,197,94,0.3)' },
  yellow: { bg: '#2e2a0a', border: '#eab308', text: '#facc15', glow: 'rgba(234,179,8,0.3)' },
  red: { bg: '#2e0a0a', border: '#ef4444', text: '#f87171', glow: 'rgba(239,68,68,0.3)' },
  neutral: { bg: '#1a1a2e', border: '#475569', text: '#94a3b8', glow: 'rgba(71,85,105,0.2)' },
};

function Dot({ status = 'neutral', size = 10 }) {
  const c = SC[status] || SC.neutral;
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: c.border, boxShadow: `0 0 8px ${c.glow}` }} />;
}

function formatVal(val, unit) {
  if (val == null) return '—';
  if (unit === '$') return `$${Number(val).toFixed(2)}`;
  if (unit === '%') return `${Number(val).toFixed(3)}%`;
  if (unit === 'bp') return `${Number(val).toFixed(0)}bp`;
  return typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(val);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function CheckRow({ item, checkData }) {
  const d = checkData || {};
  const met = d.met;
  const isNull = met === null || met === undefined;
  const status = isNull ? 'neutral' : met ? 'red' : 'green';
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 12px',
      background: met ? 'rgba(239,68,68,0.06)' : 'transparent',
      borderRadius: '6px', borderLeft: `3px solid ${met ? '#ef4444' : isNull ? '#334155' : '#22c55e'}`,
    }}>
      <div style={{ marginTop: '3px' }}><Dot status={status} size={8} /></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', color: met ? '#f87171' : isNull ? '#64748b' : '#94a3b8' }}>{item.label}</div>
        {d.comment && <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{d.comment}</div>}
      </div>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ color: '#334155', fontSize: '10px', background: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>{item.cat}</span>
        {isNull ? (
          <span style={{ fontSize: '9px', color: '#475569', background: '#0f172a', padding: '1px 4px', borderRadius: '3px' }}>수동</span>
        ) : (
          <span style={{ fontSize: '9px', color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '1px 4px', borderRadius: '3px' }}>AI</span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📈 시계열 차트 (SVG)
// ═══════════════════════════════════════════════════════════════

function TimeSeriesChart({ history }) {
  const W = 800, H = 320, PAD = { top: 30, right: 80, bottom: 50, left: 48 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const sorted = useMemo(() =>
    [...history].sort((a, b) => new Date(a.snapshot_date) - new Date(b.snapshot_date)),
    [history]
  );

  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [chartMode, setChartMode] = useState('triggers'); // 'triggers' | 'levels'

  if (sorted.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', color: 'rgba(255,255,255,0.4)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
        <div style={{ fontSize: 14 }}>히스토리 데이터가 없습니다. AI 업데이트를 2회 이상 실행하면 시계열이 표시됩니다.</div>
      </div>
    );
  }

  const points = sorted.map(row => {
    const a = row.assessment || {};
    const il = row.input_levels || {};
    const dailyRed = DAILY_ITEMS.filter(i => a.daily_checks?.[i.id]?.met === true).length;
    const weeklyRed = WEEKLY_ITEMS.filter(i => a.weekly_checks?.[i.id]?.met === true).length;
    return {
      date: row.snapshot_date,
      overall: a.overall || 'neutral',
      triggersMetCount: a.triggers_met_count ?? 0,
      totalAlerts: dailyRed + weeklyRed,
      sp500: il.sp500, wti: il.wti, dxy: il.dxy, ust30y: il.ust30y,
      hy_oas: il.hy_oas, vix: il.vix,
    };
  });

  const n = points.length;
  const xScale = (i) => PAD.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);

  // Two chart modes
  const TRIGGER_SERIES = [
    { key: 'triggersMetCount', label: '트리거 충족', color: '#ef4444', max: 4 },
    { key: 'totalAlerts', label: '총 경보', color: '#f97316', max: 18 },
  ];

  const LEVEL_SERIES = [
    { key: 'wti', label: 'WTI', color: '#f97316', unit: '$' },
    { key: 'ust30y', label: '30Y', color: '#3b82f6', unit: '%' },
    { key: 'hy_oas', label: 'HY OAS', color: '#ef4444', unit: 'bp' },
  ];

  // For trigger mode: dual Y axis (triggers 0-4 left, alerts 0-18 right)
  // For level mode: normalize each to 0-1

  const renderTriggerMode = () => {
    const yTrigger = (v) => PAD.top + plotH - (v / 4) * plotH;
    const yAlert = (v) => PAD.top + plotH - (Math.min(v, 18) / 18) * plotH;

    const triggerPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yTrigger(p.triggersMetCount)}`).join(' ');
    const alertPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yAlert(p.totalAlerts)}`).join(' ');

    return (
      <>
        {/* Background zones for triggers */}
        {[
          { y0: 0, y1: 1, color: 'rgba(34,197,94,0.06)' },
          { y0: 1, y1: 2, color: 'rgba(234,179,8,0.06)' },
          { y0: 2, y1: 3, color: 'rgba(249,115,22,0.06)' },
          { y0: 3, y1: 4, color: 'rgba(239,68,68,0.06)' },
        ].map((z, i) => (
          <rect key={i} x={PAD.left} y={yTrigger(z.y1)} width={plotW} height={yTrigger(z.y0) - yTrigger(z.y1)} fill={z.color} />
        ))}

        {/* Grid */}
        {[0, 1, 2, 3, 4].map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left + plotW} y1={yTrigger(v)} y2={yTrigger(v)} stroke="rgba(255,255,255,0.06)" strokeDasharray="4,4" />
            <text x={PAD.left - 6} y={yTrigger(v) + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="10">{v}</text>
          </g>
        ))}

        {/* Alert Y labels (right) */}
        {[0, 6, 12, 18].map(v => (
          <text key={v} x={PAD.left + plotW + 6} y={yAlert(v) + 4} fill="#f97316" fontSize="9" opacity="0.5">{v}</text>
        ))}

        {/* Lines */}
        <path d={alertPath} fill="none" stroke="#f97316" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.6" />
        <path d={triggerPath} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots + overall color */}
        {points.map((p, i) => {
          const cx = xScale(i), cy = yTrigger(p.triggersMetCount);
          const oC = SC[p.overall] || SC.neutral;
          const isHov = hoveredIdx === i;
          return (
            <g key={i}>
              <rect x={cx - (n === 1 ? plotW / 2 : plotW / (n - 1) / 2)} y={PAD.top} width={n === 1 ? plotW : plotW / (n - 1)} height={plotH}
                fill="transparent" onMouseEnter={() => setHoveredIdx(i)} style={{ cursor: 'pointer' }} />
              {isHov && <line x1={cx} x2={cx} y1={PAD.top} y2={PAD.top + plotH} stroke="rgba(255,255,255,0.15)" strokeDasharray="3,3" />}
              {/* Overall status dot */}
              <circle cx={cx} cy={cy} r={isHov ? 8 : 6} fill={oC.border} stroke="#0f0f1a" strokeWidth="2" />
              <text x={cx} y={cy - 12} textAnchor="middle" fill={oC.text} fontSize="12" fontWeight="700">{p.triggersMetCount}</text>
              {/* Alert dot */}
              <circle cx={cx} cy={yAlert(p.totalAlerts)} r={3} fill="#f97316" opacity="0.6" />
            </g>
          );
        })}

        {/* Axis labels */}
        <text x={PAD.left - 8} y={PAD.top - 8} fill="#ef4444" fontSize="10" textAnchor="end">트리거</text>
        <text x={PAD.left + plotW + 8} y={PAD.top - 8} fill="#f97316" fontSize="10">경보</text>
      </>
    );
  };

  const renderLevelMode = () => {
    // Each series normalized independently
    const getRange = (key) => {
      const vals = points.map(p => p[key]).filter(v => v != null);
      if (vals.length === 0) return { min: 0, max: 1 };
      const min = Math.min(...vals), max = Math.max(...vals);
      const pad = (max - min) * 0.1 || 1;
      return { min: min - pad, max: max + pad };
    };

    return (
      <>
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <line key={v} x1={PAD.left} x2={PAD.left + plotW} y1={PAD.top + plotH * (1 - v)} y2={PAD.top + plotH * (1 - v)} stroke="rgba(255,255,255,0.04)" strokeDasharray="4,4" />
        ))}

        {LEVEL_SERIES.map(s => {
          const range = getRange(s.key);
          const yScale = (v) => PAD.top + plotH - ((v - range.min) / (range.max - range.min)) * plotH;
          const path = points.map((p, i) => {
            const v = p[s.key];
            if (v == null) return null;
            return `${i === 0 || points[i - 1]?.[s.key] == null ? 'M' : 'L'}${xScale(i)},${yScale(v)}`;
          }).filter(Boolean).join(' ');

          return (
            <g key={s.key}>
              <path d={path} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
              {points.map((p, i) => {
                const v = p[s.key];
                if (v == null) return null;
                const isHov = hoveredIdx === i;
                return (
                  <g key={i}>
                    <circle cx={xScale(i)} cy={yScale(v)} r={isHov ? 5 : 3} fill={s.color} stroke="#0f0f1a" strokeWidth="1.5" />
                    {isHov && <text x={xScale(i)} y={yScale(v) - 10} textAnchor="middle" fill={s.color} fontSize="10" fontWeight="600">{formatVal(v, s.unit)}</text>}
                  </g>
                );
              })}
              {/* Label at last point */}
              {(() => {
                const lastIdx = [...points].reverse().findIndex(p => p[s.key] != null);
                if (lastIdx < 0) return null;
                const idx = points.length - 1 - lastIdx;
                const v = points[idx][s.key];
                return <text x={xScale(idx) + 8} y={yScale(v) + 4} fill={s.color} fontSize="10" fontWeight="600">{s.label}</text>;
              })()}
            </g>
          );
        })}

        {/* Hover areas */}
        {points.map((p, i) => (
          <rect key={i} x={xScale(i) - (n === 1 ? plotW / 2 : plotW / (n - 1) / 2)} y={PAD.top} width={n === 1 ? plotW : plotW / (n - 1)} height={plotH}
            fill="transparent" onMouseEnter={() => setHoveredIdx(i)} style={{ cursor: 'pointer' }} />
        ))}
      </>
    );
  };

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, justifyContent: 'flex-end' }}>
        {[
          { key: 'triggers', label: '트리거/경보' },
          { key: 'levels', label: '지표 수준' },
        ].map(m => (
          <button key={m.key} onClick={() => setChartMode(m.key)} style={{
            padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
            background: chartMode === m.key ? 'rgba(99,102,241,0.15)' : 'transparent',
            color: chartMode === m.key ? '#818cf8' : 'rgba(255,255,255,0.4)',
            fontSize: 11, cursor: 'pointer',
          }}>{m.label}</button>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', maxHeight: 320 }}
          onMouseLeave={() => setHoveredIdx(null)}>

          {chartMode === 'triggers' ? renderTriggerMode() : renderLevelMode()}

          {/* X axis dates */}
          {points.map((p, i) => {
            const cx = xScale(i);
            const isHov = hoveredIdx === i;
            return (
              <text key={i} x={cx} y={H - 10} textAnchor={n <= 7 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
                fill={isHov ? '#e2e8f0' : 'rgba(255,255,255,0.3)'} fontSize="10"
                transform={n > 10 ? `rotate(-45 ${cx} ${H - 10})` : ''}>
                {formatDate(p.date)}
              </text>
            );
          })}

          {/* Hover tooltip */}
          {hoveredIdx !== null && (() => {
            const p = points[hoveredIdx];
            const cx = xScale(hoveredIdx);
            const tooltipW = 170;
            const tooltipX = Math.min(Math.max(cx - tooltipW / 2, PAD.left), W - PAD.right - tooltipW);
            const oC = SC[p.overall] || SC.neutral;
            const rows = [
              { label: '종합', val: p.overall === 'red' ? 'RED' : p.overall === 'yellow' ? 'YELLOW' : 'GREEN', color: oC.border },
              { label: '트리거', val: `${p.triggersMetCount}/4`, color: p.triggersMetCount >= 3 ? '#ef4444' : p.triggersMetCount >= 2 ? '#eab308' : '#22c55e' },
              { label: '경보', val: String(p.totalAlerts), color: p.totalAlerts >= 5 ? '#ef4444' : '#f97316' },
              { label: 'WTI', val: p.wti ? `$${p.wti.toFixed(1)}` : '—', color: '#f97316' },
              { label: '30Y', val: p.ust30y ? `${p.ust30y.toFixed(2)}%` : '—', color: '#3b82f6' },
              { label: 'HY OAS', val: p.hy_oas ? `${p.hy_oas.toFixed(0)}bp` : '—', color: '#ef4444' },
            ];
            return (
              <g>
                <rect x={tooltipX} y={PAD.top} width={tooltipW} height={16 + rows.length * 16 + 8} rx="8" fill="rgba(15,15,26,0.95)" stroke="rgba(255,255,255,0.1)" />
                <text x={tooltipX + 10} y={PAD.top + 14} fill="#e2e8f0" fontSize="10" fontWeight="600">{formatDate(p.date)}</text>
                {rows.map((r, i) => (
                  <g key={i}>
                    <text x={tooltipX + 12} y={PAD.top + 32 + i * 16} fill="rgba(255,255,255,0.5)" fontSize="10">{r.label}</text>
                    <text x={tooltipX + tooltipW - 10} y={PAD.top + 32 + i * 16} textAnchor="end" fill={r.color} fontSize="10" fontWeight="700">{r.val}</text>
                  </g>
                ))}
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 10, justifyContent: 'center', fontSize: 11 }}>
        {chartMode === 'triggers' ? (
          <>
            <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 14, height: 3, background: '#ef4444', borderRadius: 2, display: 'inline-block' }} /> 트리거 충족 (0-4)
            </span>
            <span style={{ color: '#f97316', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 14, height: 2, background: '#f97316', borderRadius: 2, display: 'inline-block', opacity: 0.6 }} /> 총 경보 수
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Dot status="green" size={6} /> <Dot status="yellow" size={6} /> <Dot status="red" size={6} /> 종합 상태
            </span>
          </>
        ) : (
          LEVEL_SERIES.map(s => (
            <span key={s.key} style={{ color: s.color, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 14, height: 3, background: s.color, borderRadius: 2, display: 'inline-block' }} /> {s.label}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📋 히스토리 테이블
// ═══════════════════════════════════════════════════════════════

function HistoryTable({ history, onSelect, selectedDate }) {
  const sorted = useMemo(() =>
    [...history].sort((a, b) => new Date(b.snapshot_date) - new Date(a.snapshot_date)),
    [history]
  );

  return (
    <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {['날짜', '종합', '트리거', '경보', 'WTI', '30Y', 'HY OAS', 'VIX', '정책풋'].map(h => (
              <th key={h} style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const a = row.assessment || {};
            const il = row.input_levels || {};
            const overall = a.overall || 'neutral';
            const oC = SC[overall] || SC.neutral;
            const metCount = a.triggers_met_count ?? 0;
            const dailyRed = DAILY_ITEMS.filter(it => a.daily_checks?.[it.id]?.met === true).length;
            const weeklyRed = WEEKLY_ITEMS.filter(it => a.weekly_checks?.[it.id]?.met === true).length;
            const totalAlerts = dailyRed + weeklyRed;
            const isSelected = row.snapshot_date === selectedDate;

            const prev = sorted[i + 1];
            const prevMet = prev?.assessment?.triggers_met_count ?? null;
            const metDelta = prevMet !== null ? metCount - prevMet : null;

            return (
              <tr key={row.id || row.snapshot_date} onClick={() => onSelect(row)} style={{
                cursor: 'pointer',
                background: isSelected ? 'rgba(99,102,241,0.08)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                borderLeft: isSelected ? '3px solid #6366f1' : '3px solid transparent',
              }}>
                <td style={{ padding: '10px 8px', color: isSelected ? '#e2e8f0' : 'rgba(255,255,255,0.6)', fontWeight: isSelected ? 600 : 400, whiteSpace: 'nowrap' }}>{formatDate(row.snapshot_date)}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center' }}><Dot status={overall} size={10} /></td>
                <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                  <span style={{ fontWeight: 700, color: metCount >= 3 ? '#ef4444' : metCount >= 2 ? '#eab308' : '#22c55e', fontFamily: 'monospace' }}>{metCount}/4</span>
                  {metDelta !== null && metDelta !== 0 && (
                    <span style={{ fontSize: 10, color: metDelta > 0 ? '#ef4444' : '#22c55e', marginLeft: 4 }}>{metDelta > 0 ? `+${metDelta}` : metDelta}</span>
                  )}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center', color: totalAlerts >= 5 ? '#ef4444' : '#f97316', fontWeight: 600, fontFamily: 'monospace' }}>{totalAlerts}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}>{il.wti ? `$${Number(il.wti).toFixed(1)}` : '—'}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}>{il.ust30y ? `${Number(il.ust30y).toFixed(2)}%` : '—'}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}>{il.hy_oas ? `${Number(il.hy_oas).toFixed(0)}` : '—'}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}>{il.vix ? Number(il.vix).toFixed(1) : '—'}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11 }}>
                  {a.policy_put_probability === 'high' ? '🔴' : a.policy_put_probability === 'medium' ? '🟡' : a.policy_put_probability === 'low' ? '🟢' : '—'}
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

export default function HartnettMonitorPage() {
  const [savedData, setSavedData] = useState(null);
  const [fredLive, setFredLive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [manualDxy, setManualDxy] = useState('');
  const [manualBrent, setManualBrent] = useState('');
  const [manualUst30y, setManualUst30y] = useState('');

  // 시계열
  const [tab, setTab] = useState('current');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/hartnett-monitor?live=true');
      if (!res.ok) throw new Error('데이터 로드 실패');
      const json = await res.json();
      setSavedData(json.latest);
      setFredLive(json.fredLive);
      if (json.latest?.input_levels?.dxy) setManualDxy(String(json.latest.input_levels.dxy));
      if (json.latest?.input_levels?.brent) setManualBrent(String(json.latest.input_levels.brent));
      if (json.latest?.input_levels?.ust30y) setManualUst30y(String(json.latest.input_levels.ust30y));
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/hartnett-monitor?action=history');
      const json = await res.json();
      if (json.history) setHistory(json.history);
    } catch (err) { console.error('히스토리 로딩 실패:', err); }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (tab === 'history' && history.length === 0) fetchHistory(); }, [tab, history.length, fetchHistory]);
  useEffect(() => { if (typeof window !== 'undefined' && sessionStorage.getItem('adminPin')) setIsAdmin(true); }, []);

  const handlePinSubmit = () => { sessionStorage.setItem('adminPin', pinInput); setIsAdmin(true); setShowPin(false); };
  const getPin = () => typeof window !== 'undefined' && sessionStorage.getItem('adminPin');

  const runAnalysis = async () => {
    setAnalyzing(true); setError('');
    try {
      const res = await fetch('/api/hartnett-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': getPin() },
        body: JSON.stringify({ manualOverrides: { dxy: manualDxy ? parseFloat(manualDxy) : undefined, brent: manualBrent ? parseFloat(manualBrent) : undefined, ust30y: manualUst30y ? parseFloat(manualUst30y) : undefined } }),
      });
      const result = await res.json();
      if (!res.ok) { setError(result.error || '분석 실패'); return; }
      await loadData();
      if (history.length > 0) fetchHistory();
    } catch (err) { setError(err.message); } finally { setAnalyzing(false); }
  };

  // 렌더링 데이터 (스냅샷 선택 시 해당 데이터)
  const displayData = selectedSnapshot || savedData;
  const assessment = displayData?.assessment || {};
  const triggers = assessment.triggers || {};
  const savedLevels = displayData?.input_levels || {};
  const dailyChecks = assessment.daily_checks || {};
  const weeklyChecks = assessment.weekly_checks || {};
  const dailyRedCount = DAILY_ITEMS.filter(i => dailyChecks[i.id]?.met === true).length;
  const weeklyRedCount = WEEKLY_ITEMS.filter(i => weeklyChecks[i.id]?.met === true).length;
  const totalAlerts = dailyRedCount + weeklyRedCount;

  const currentLevel = (key) => {
    if (selectedSnapshot) return savedLevels[key] || null;
    if (fredLive?.[key]?.value != null) return fredLive[key].value;
    return savedLevels[key] || null;
  };

  // 트리거 충족을 실제 레벨에서 직접 계산 (AI 판단에 의존하지 않음)
  const computedMetCount = TRIGGER_CONFIG.reduce((count, cfg) => {
    const level = currentLevel(cfg.key);
    if (level == null) return count;
    const met = cfg.direction === 'below' ? level < cfg.threshold : level > cfg.threshold;
    return count + (met ? 1 : 0);
  }, 0);
  const metCount = computedMetCount;
  const overall = computedMetCount >= 3 ? 'red' : computedMetCount >= 2 ? 'yellow' : (assessment.overall || 'neutral');
  const overallC = SC[overall] || SC.neutral;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f1a', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: '#64748b' }}>FRED 데이터 수집 중...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a', color: '#e2e8f0', fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(180deg, #0f172a 0%, #0f0f1a 100%)', borderBottom: '1px solid #1e293b', padding: '20px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <a href="/" style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>← 컨트롤타워</a>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: 8 }}>
                <span style={{ fontSize: '24px' }}>🔴</span>
                <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>하트넷 2008 프레임워크 모니터</h1>
              </div>
              <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0 36px' }}>
                FRED 자동수집 · AI 체크리스트 자동 평가 · 정책풋 확률 추적
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {displayData?.updated_at && (
                <span style={{ color: '#475569', fontSize: '11px' }}>{new Date(displayData.updated_at).toLocaleString('ko-KR')}</span>
              )}
              {!isAdmin ? (
                <button onClick={() => setShowPin(true)} style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>🔑 관리자</button>
              ) : (
                <span style={{ color: '#22c55e', fontSize: '11px', background: '#0a2e1a', padding: '4px 8px', borderRadius: '4px' }}>✓ 관리자</span>
              )}
            </div>
          </div>
          {showPin && (
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder="PIN" onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
                style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', width: '120px' }} />
              <button onClick={handlePinSubmit} style={{ background: '#22c55e', color: '#000', border: 'none', padding: '6px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>확인</button>
            </div>
          )}

          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: 4, marginTop: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4 }}>
            {[
              { key: 'current', label: '📊 현재 상태', sub: displayData?.snapshot_date ? formatDate(displayData.snapshot_date) : '' },
              { key: 'history', label: '📈 시계열', sub: history.length > 0 ? `${history.length}일` : '' },
            ].map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); if (t.key === 'current') setSelectedSnapshot(null); }}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none',
                  background: tab === t.key ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: tab === t.key ? '#818cf8' : 'rgba(255,255,255,0.4)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                {t.label}
                {t.sub && <span style={{ display: 'block', fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.6 }}>{t.sub}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 24px' }}>
        {error && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: '#2e0a0a', border: '1px solid #7f1d1d', borderRadius: '6px', color: '#fca5a5', fontSize: '13px' }}>❌ {error}</div>
        )}

        {/* ═══ TAB: 현재 상태 ═══ */}
        {tab === 'current' && (
          <>
            {/* Snapshot banner */}
            {selectedSnapshot && (
              <div style={{
                background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 10, padding: '10px 16px', marginBottom: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 13, color: '#818cf8' }}>📅 {formatDate(selectedSnapshot.snapshot_date)} 스냅샷을 보고 있습니다</span>
                <button onClick={() => setSelectedSnapshot(null)} style={{
                  padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.3)',
                  background: 'transparent', color: '#818cf8', fontSize: 11, cursor: 'pointer',
                }}>최신으로 돌아가기</button>
              </div>
            )}

            {/* 종합 신호 */}
            <div style={{ background: overallC.bg, border: `1px solid ${overallC.border}`, borderRadius: '12px', padding: '20px 24px', marginBottom: '20px', boxShadow: `0 0 30px ${overallC.glow}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <Dot status={overall} size={14} />
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: overallC.text, textTransform: 'uppercase' }}>
                      {overall === 'red' ? '경계 (RED)' : overall === 'yellow' ? '주의 (YELLOW)' : overall === 'green' ? '안정 (GREEN)' : '미평가'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>{assessment.overall_comment || 'AI 업데이트를 실행해주세요.'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '24px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: metCount >= 3 ? '#ef4444' : metCount >= 2 ? '#eab308' : '#22c55e', fontFamily: 'monospace' }}>{metCount}/4</div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>트리거</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: totalAlerts >= 5 ? '#ef4444' : totalAlerts >= 3 ? '#eab308' : '#22c55e', fontFamily: 'monospace' }}>{totalAlerts}</div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>경보</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#94a3b8', fontFamily: 'monospace', marginTop: '4px' }}>
                      {assessment.policy_put_probability === 'high' ? '🔴 HIGH' : assessment.policy_put_probability === 'medium' ? '🟡 MED' : assessment.policy_put_probability === 'low' ? '🟢 LOW' : '—'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>정책풋</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4대 트리거 */}
            <h2 style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>정책 풋 트리거</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              {TRIGGER_CONFIG.map(cfg => {
                const level = currentLevel(cfg.key) ?? (triggers[cfg.key]?.level || null);
                const status = level == null ? 'neutral' :
                  cfg.direction === 'below' ? (level < cfg.threshold ? 'red' : level < cfg.threshold * 1.03 ? 'yellow' : 'green') :
                  (level > cfg.threshold ? 'red' : level > cfg.threshold * 0.95 ? 'yellow' : 'green');
                const c = SC[status];
                const fredDate = !selectedSnapshot && fredLive?.[cfg.key]?.date;
                const aiComment = triggers[cfg.key]?.comment;
                return (
                  <div key={cfg.key} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cfg.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {cfg.fred && <span style={{ fontSize: '9px', color: '#475569', background: '#1e293b', padding: '1px 4px', borderRadius: '3px' }}>FRED</span>}
                        <Dot status={status} size={10} />
                      </div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: c.text, fontFamily: 'monospace' }}>{formatVal(level, cfg.unit)}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      트리거: {cfg.direction === 'below' ? '<' : '>'} {cfg.unit === '$' ? '$' : ''}{cfg.threshold}{cfg.unit === '%' ? '%' : ''}
                      {fredDate && <span style={{ marginLeft: '8px' }}>({fredDate})</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{cfg.desc}</div>
                    {aiComment && <div style={{ fontSize: '12px', color: c.text, marginTop: '6px', opacity: 0.8 }}>{aiComment}</div>}
                  </div>
                );
              })}
            </div>

            {/* 보조 지표 */}
            <h2 style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>보조 지표{!selectedSnapshot && ' (FRED 자동)'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '20px' }}>
              {EXTRA_INDICATORS.map(ind => {
                const val = currentLevel(ind.key);
                const fredDate = !selectedSnapshot && fredLive?.[ind.key]?.date;
                return (
                  <div key={ind.key} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>{ind.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>{formatVal(val, ind.unit)}</div>
                    {fredDate && <div style={{ fontSize: '9px', color: '#334155', marginTop: '2px' }}>{fredDate}</div>}
                  </div>
                );
              })}
            </div>

            {/* 스트레스 + 전략 */}
            {(assessment.energy_shock || assessment.credit_stress || assessment.liquidity_pressure) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: '⛽ 에너지 쇼크', data: assessment.energy_shock },
                  { label: '💳 신용 스트레스', data: assessment.credit_stress },
                  { label: '💧 유동성 압박', data: assessment.liquidity_pressure },
                ].map(({ label, data: d }) => {
                  if (!d) return null;
                  const c = SC[d.status] || SC.neutral;
                  return (
                    <div key={label} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>{label}</span>
                        <Dot status={d.status} />
                      </div>
                      <div style={{ fontSize: '12px', color: c.text, opacity: 0.85 }}>{d.comment}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {assessment.hartnett_strategy && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <div style={{ background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600, marginBottom: '4px' }}>📉 과열 (매도)</div>
                  <div style={{ fontSize: '13px', color: '#fca5a5' }}>{assessment.hartnett_strategy.sell}</div>
                </div>
                <div style={{ background: '#0a1a0a', border: '1px solid #166534', borderRadius: '8px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '12px', color: '#22c55e', fontWeight: 600, marginBottom: '4px' }}>📈 바닥 (매수)</div>
                  <div style={{ fontSize: '13px', color: '#86efac' }}>{assessment.hartnett_strategy.buy}</div>
                </div>
                <div style={{ background: '#1a1a0a', border: '1px solid #854d0e', borderRadius: '8px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '12px', color: '#eab308', fontWeight: 600, marginBottom: '4px' }}>❓ 모호</div>
                  <div style={{ fontSize: '13px', color: '#fde047' }}>{assessment.hartnett_strategy.uncertain}</div>
                </div>
              </div>
            )}

            {assessment.key_risk && (
              <div style={{ background: '#1e1a2e', border: '1px solid #6366f1', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px' }}>
                <span style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600 }}>⚠️ 핵심 리스크: </span>
                <span style={{ fontSize: '13px', color: '#c7d2fe' }}>{assessment.key_risk}</span>
              </div>
            )}

            {/* 체크리스트 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h2 style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>일일 경보 ({dailyRedCount}/{DAILY_ITEMS.length})</h2>
                  <span style={{ fontSize: '10px', color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: '4px' }}>AI 자동 평가</span>
                </div>
                <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '6px' }}>
                  {DAILY_ITEMS.map(item => <CheckRow key={item.id} item={item} checkData={dailyChecks[item.id]} />)}
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h2 style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>주간 원인분해 ({weeklyRedCount}/{WEEKLY_ITEMS.length})</h2>
                  <span style={{ fontSize: '10px', color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: '4px' }}>AI 자동 평가</span>
                </div>
                <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '6px' }}>
                  {WEEKLY_ITEMS.map(item => <CheckRow key={item.id} item={item} checkData={weeklyChecks[item.id]} />)}
                </div>
              </div>
            </div>

            {/* 범례 */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '11px', color: '#64748b' }}>
                <span><Dot status="red" size={6} /> 경보 (충족)</span>
                <span><Dot status="green" size={6} /> 안정 (미충족)</span>
                <span><Dot status="neutral" size={6} /> 수동 확인 필요</span>
                <span style={{ color: '#6366f1' }}>AI = FRED 데이터 기반 자동</span>
              </div>
            </div>

            {/* 관리자 패널 */}
            {isAdmin && !selectedSnapshot && (
              <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '14px', color: '#e2e8f0', marginBottom: '12px', fontWeight: 600 }}>🤖 AI 업데이트</h2>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                  FRED 10개 시리즈 자동수집 → AI 체크리스트+전략 평가. <b style={{ color: '#f59e0b' }}>DXY 필수 수동입력</b>. 30Y 등은 FRED 지연 시 수동 오버라이드 가능. <b style={{ color: '#ef4444' }}>트리거 충족은 실제 데이터에서 코드로 자동 판단</b>.
                </p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#f59e0b', display: 'block', marginBottom: '4px' }}>DXY (수동 · 필수)</label>
                    <input type="number" step="any" value={manualDxy} onChange={e => setManualDxy(e.target.value)} placeholder="99.5"
                      style={{ width: '140px', background: '#1e293b', border: '1px solid #f59e0b', color: '#e2e8f0', padding: '8px 10px', borderRadius: '6px', fontSize: '14px', fontFamily: 'monospace' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#f59e0b', display: 'block', marginBottom: '4px' }}>30Y 금리 (FRED 지연 시 수동)</label>
                    <input type="number" step="any" value={manualUst30y} onChange={e => setManualUst30y(e.target.value)} placeholder="4.947"
                      style={{ width: '140px', background: '#1e293b', border: '1px solid #f59e0b', color: '#e2e8f0', padding: '8px 10px', borderRadius: '6px', fontSize: '14px', fontFamily: 'monospace' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Brent (선택)</label>
                    <input type="number" step="any" value={manualBrent} onChange={e => setManualBrent(e.target.value)} placeholder="108.8"
                      style={{ width: '140px', background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', padding: '8px 10px', borderRadius: '6px', fontSize: '14px', fontFamily: 'monospace' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button onClick={runAnalysis} disabled={analyzing} style={{
                    background: analyzing ? '#334155' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px',
                    fontSize: '14px', fontWeight: 600, cursor: analyzing ? 'not-allowed' : 'pointer',
                    boxShadow: analyzing ? 'none' : '0 0 20px rgba(99,102,241,0.3)',
                  }}>
                    {analyzing ? '⏳ FRED + AI 분석 중...' : '🤖 AI 업데이트'}
                  </button>
                  <span style={{ fontSize: '11px', color: '#475569' }}>~2,000토큰 (~$0.007) · 날짜별 자동 저장</span>
                </div>
              </div>
            )}

            {/* 프레임워크 */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px', fontSize: '12px', color: '#64748b', lineHeight: '1.8' }}>
              <h3 style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>프레임워크 요약</h3>
              <p style={{ margin: '0 0 8px' }}><b style={{ color: '#94a3b8' }}>공통점:</b> ①유가급등 (2008: $70→$140 / 2026: $60→$100+) ②신용스트레스 (2008: 서브프라임 / 2026: 사모대출펀드)</p>
              <p style={{ margin: '0 0 8px' }}><b style={{ color: '#94a3b8' }}>차이점:</b> 현재는 완화 사이클 (연준 여력 있음). 사모대출은 비은행권·직접대출 구조.</p>
              <p style={{ margin: 0 }}><b style={{ color: '#94a3b8' }}>핵심:</b> "비슷한 스트레스 조합"은 맞으나 "2008급 시스템 리스크 자동 전이"는 아직 입증 부족.</p>
            </div>
          </>
        )}

        {/* ═══ TAB: 시계열 ═══ */}
        {tab === 'history' && (
          <>
            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 24px', color: 'rgba(255,255,255,0.4)' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                <div>히스토리 로딩 중...</div>
              </div>
            ) : (
              <>
                {/* 시계열 차트 */}
                <div style={{ background: '#0f172a', borderRadius: 12, border: '1px solid #1e293b', padding: 24, marginBottom: 24 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    📈 하트넷 프레임워크 추이
                  </h3>
                  <TimeSeriesChart history={history} />
                </div>

                {/* 히스토리 테이블 */}
                <div style={{ background: '#0f172a', borderRadius: 12, border: '1px solid #1e293b', padding: 24 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    📋 업데이트 히스토리
                  </h3>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>
                    날짜를 클릭하면 해당 시점의 상세 분석을 볼 수 있습니다
                  </p>
                  <HistoryTable
                    history={history}
                    selectedDate={selectedSnapshot?.snapshot_date}
                    onSelect={(row) => { setSelectedSnapshot(row); setTab('current'); }}
                  />
                </div>
              </>
            )}
          </>
        )}

        <div style={{ textAlign: 'center', padding: '20px 0', color: '#334155', fontSize: '11px' }}>
          하트넷 2008 프레임워크 모니터 • FRED API • 늑대무리원정단
        </div>
      </div>
    </div>
  );
}
