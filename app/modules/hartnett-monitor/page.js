'use client';

import { useState, useEffect, useCallback } from 'react';

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

function CheckRow({ item, checkData }) {
  const d = checkData || {};
  const met = d.met;
  const isNull = met === null || met === undefined;
  const status = isNull ? 'neutral' : met ? 'red' : 'green';
  const c = SC[status];

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 12px',
      background: met ? 'rgba(239,68,68,0.06)' : 'transparent',
      borderRadius: '6px', borderLeft: `3px solid ${met ? '#ef4444' : isNull ? '#334155' : '#22c55e'}`,
    }}>
      <div style={{ marginTop: '3px' }}>
        <Dot status={status} size={8} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', color: met ? '#f87171' : isNull ? '#64748b' : '#94a3b8' }}>
          {item.label}
        </div>
        {d.comment && (
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{d.comment}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ color: '#334155', fontSize: '10px', background: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>
          {item.cat}
        </span>
        {isNull && (
          <span style={{ fontSize: '9px', color: '#475569', background: '#0f172a', padding: '1px 4px', borderRadius: '3px' }}>수동</span>
        )}
        {!isNull && (
          <span style={{ fontSize: '9px', color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '1px 4px', borderRadius: '3px' }}>AI</span>
        )}
      </div>
    </div>
  );
}

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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('adminPin')) setIsAdmin(true);
  }, []);

  const handlePinSubmit = () => { sessionStorage.setItem('adminPin', pinInput); setIsAdmin(true); setShowPin(false); };
  const getPin = () => typeof window !== 'undefined' && sessionStorage.getItem('adminPin');

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError('');
    try {
      const res = await fetch('/api/hartnett-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': getPin() },
        body: JSON.stringify({
          manualOverrides: {
            dxy: manualDxy ? parseFloat(manualDxy) : undefined,
            brent: manualBrent ? parseFloat(manualBrent) : undefined,
          },
        }),
      });
      const result = await res.json();
      if (!res.ok) { setError(result.error || '분석 실패'); return; }
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const assessment = savedData?.assessment || {};
  const triggers = assessment.triggers || {};
  const savedLevels = savedData?.input_levels || {};
  const metCount = assessment.triggers_met_count ?? 0;
  const overall = assessment.overall || 'neutral';
  const overallC = SC[overall] || SC.neutral;

  const dailyChecks = assessment.daily_checks || {};
  const weeklyChecks = assessment.weekly_checks || {};
  const dailyRedCount = DAILY_ITEMS.filter(i => dailyChecks[i.id]?.met === true).length;
  const weeklyRedCount = WEEKLY_ITEMS.filter(i => weeklyChecks[i.id]?.met === true).length;
  const totalAlerts = dailyRedCount + weeklyRedCount;

  const currentLevel = (key) => {
    if (fredLive?.[key]?.value != null) return fredLive[key].value;
    return savedLevels[key] || null;
  };

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
                <span style={{ fontSize: '24px' }}>🔴</span>
                <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>하트넷 2008 프레임워크 모니터</h1>
              </div>
              <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0 36px' }}>
                FRED 자동수집 · AI 체크리스트 자동 평가 · 정책풋 확률 추적
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {savedData?.updated_at && (
                <span style={{ color: '#475569', fontSize: '11px' }}>
                  {new Date(savedData.updated_at).toLocaleString('ko-KR')}
                </span>
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
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 24px' }}>
        {/* 종합 신호 */}
        <div style={{ background: overallC.bg, border: `1px solid ${overallC.border}`, borderRadius: '12px', padding: '20px 24px', marginBottom: '20px', boxShadow: `0 0 30px ${overallC.glow}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Dot status={overall} size={14} />
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: overallC.text, textTransform: 'uppercase' }}>
                  {overall === 'red' ? '경계 (RED)' : overall === 'yellow' ? '주의 (YELLOW)' : overall === 'green' ? '안정 (GREEN)' : '미평가'}
                </div>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
                  {assessment.overall_comment || 'AI 업데이트를 실행해주세요.'}
                </div>
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
        <h2 style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          정책 풋 트리거
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {TRIGGER_CONFIG.map(cfg => {
            const t = triggers[cfg.key] || {};
            const level = t.level ?? currentLevel(cfg.key);
            const met = t.met;
            const status = met ? 'red' : level == null ? 'neutral' :
              cfg.direction === 'below' ? (level < cfg.threshold ? 'red' : level < cfg.threshold * 1.03 ? 'yellow' : 'green') :
              (level > cfg.threshold ? 'red' : level > cfg.threshold * 0.95 ? 'yellow' : 'green');
            const c = SC[status];
            const fredDate = fredLive?.[cfg.key]?.date;
            return (
              <div key={cfg.key} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cfg.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {cfg.fred && <span style={{ fontSize: '9px', color: '#475569', background: '#1e293b', padding: '1px 4px', borderRadius: '3px' }}>FRED</span>}
                    <Dot status={status} size={10} />
                  </div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: c.text, fontFamily: 'monospace' }}>
                  {formatVal(level, cfg.unit)}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  트리거: {cfg.direction === 'below' ? '<' : '>'} {cfg.unit === '$' ? '$' : ''}{cfg.threshold}{cfg.unit === '%' ? '%' : ''}
                  {fredDate && <span style={{ marginLeft: '8px' }}>({fredDate})</span>}
                </div>
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{cfg.desc}</div>
                {t.comment && <div style={{ fontSize: '12px', color: c.text, marginTop: '6px', opacity: 0.8 }}>{t.comment}</div>}
              </div>
            );
          })}
        </div>

        {/* 보조 지표 */}
        <h2 style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          보조 지표 (FRED 자동)
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          {EXTRA_INDICATORS.map(ind => {
            const val = currentLevel(ind.key);
            const fredDate = fredLive?.[ind.key]?.date;
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

        {/* 체크리스트 — AI 자동 평가 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h2 style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                일일 경보 ({dailyRedCount}/{DAILY_ITEMS.length})
              </h2>
              <span style={{ fontSize: '10px', color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: '4px' }}>AI 자동 평가</span>
            </div>
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '6px' }}>
              {DAILY_ITEMS.map(item => (
                <CheckRow key={item.id} item={item} checkData={dailyChecks[item.id]} />
              ))}
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h2 style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                주간 원인분해 ({weeklyRedCount}/{WEEKLY_ITEMS.length})
              </h2>
              <span style={{ fontSize: '10px', color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: '4px' }}>AI 자동 평가</span>
            </div>
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '6px' }}>
              {WEEKLY_ITEMS.map(item => (
                <CheckRow key={item.id} item={item} checkData={weeklyChecks[item.id]} />
              ))}
            </div>
          </div>
        </div>

        {/* 범례 */}
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '11px', color: '#64748b' }}>
            <span><Dot status="red" size={6} /> 경보 (데이터 기반 충족)</span>
            <span><Dot status="green" size={6} /> 안정 (미충족)</span>
            <span><Dot status="neutral" size={6} /> 수동 확인 필요 (뉴스/어닝 기반)</span>
            <span style={{ color: '#6366f1' }}>AI = FRED 데이터 기반 자동 판단</span>
          </div>
        </div>

        {/* 관리자 패널 */}
        {isAdmin && (
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '14px', color: '#e2e8f0', marginBottom: '12px', fontWeight: 600 }}>🤖 AI 업데이트</h2>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
              FRED에서 10개 시리즈 자동수집 → AI가 트리거 + 체크리스트 + 전략 한 번에 평가.
              <b style={{ color: '#f59e0b' }}> DXY만 수동입력</b> (FRED 미제공).
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#f59e0b', display: 'block', marginBottom: '4px' }}>DXY (수동 · 필수)</label>
                <input type="number" step="any" value={manualDxy} onChange={e => setManualDxy(e.target.value)} placeholder="99.5"
                  style={{ width: '140px', background: '#1e293b', border: '1px solid #f59e0b', color: '#e2e8f0', padding: '8px 10px', borderRadius: '6px', fontSize: '14px', fontFamily: 'monospace' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Brent (선택 · FRED도 수집)</label>
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
              <span style={{ fontSize: '11px', color: '#475569' }}>
                FRED 10개 자동 → AI ~2,000토큰 (~$0.007) → 트리거+체크리스트+전략 일괄
              </span>
            </div>
            {error && (
              <div style={{ marginTop: '12px', padding: '10px 14px', background: '#2e0a0a', border: '1px solid #7f1d1d', borderRadius: '6px', color: '#fca5a5', fontSize: '13px' }}>❌ {error}</div>
            )}
          </div>
        )}

        {/* 프레임워크 */}
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px', fontSize: '12px', color: '#64748b', lineHeight: '1.8' }}>
          <h3 style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>프레임워크 요약</h3>
          <p style={{ margin: '0 0 8px' }}><b style={{ color: '#94a3b8' }}>공통점:</b> ①유가급등 (2008: $70→$140 / 2026: $60→$100+) ②신용스트레스 (2008: 서브프라임 / 2026: 사모대출펀드)</p>
          <p style={{ margin: '0 0 8px' }}><b style={{ color: '#94a3b8' }}>차이점:</b> 현재는 완화 사이클 (연준 여력 있음). 사모대출은 비은행권·직접대출 구조.</p>
          <p style={{ margin: 0 }}><b style={{ color: '#94a3b8' }}>핵심:</b> "비슷한 스트레스 조합"은 맞으나 "2008급 시스템 리스크 자동 전이"는 아직 입증 부족.</p>
        </div>

        <div style={{ textAlign: 'center', padding: '20px 0', color: '#334155', fontSize: '11px' }}>
          하트넷 2008 프레임워크 모니터 • FRED API • 늑대무리원정단
        </div>
      </div>
    </div>
  );
}
