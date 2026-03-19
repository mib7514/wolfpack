'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── 상수 ───
const TRIGGER_CONFIG = [
  { key: 'sp500', label: 'S&P 500', threshold: 6600, unit: '', direction: 'below', desc: '부의효과 감소 → 소비심리 꺾임', fred: 'SP500' },
  { key: 'wti', label: 'WTI 유가', threshold: 100, unit: '$', direction: 'above', desc: '기업마진 직접 훼손', fred: 'DCOILWTICO' },
  { key: 'dxy', label: 'DXY 달러', threshold: 100, unit: '', direction: 'above', desc: '글로벌 유동성 압박', fred: null },
  { key: 'ust30y', label: '30Y 금리', threshold: 5.0, unit: '%', direction: 'above', desc: '자금조달비용 위험수준', fred: 'DGS30' },
];

const EXTRA_INDICATORS = [
  { key: 'ust10y', label: '10Y 금리', unit: '%', fred: true },
  { key: 'ust2y', label: '2Y 금리', unit: '%', fred: true },
  { key: 'hy_oas', label: 'HY OAS', unit: 'bp', fred: true },
  { key: 'vix', label: 'VIX', unit: '', fred: true },
  { key: 'bei_5y', label: '5Y BEI', unit: '%', fred: true },
];

const DAILY_MONITORS = [
  { id: 'wti_level', label: 'WTI $95+ 5영업일 유지', category: '에너지쇼크' },
  { id: 'brent_spread', label: 'Brent-WTI 스프레드 확대', category: '에너지쇼크' },
  { id: 'crack_spread', label: '정제마진(크랙) 급등', category: '에너지쇼크' },
  { id: 'hy_oas', label: 'HY OAS 급확대 (400bp+)', category: '신용스트레스' },
  { id: 'loan_price', label: '레버리지론 가격 par 95 이하', category: '신용스트레스' },
  { id: 'financials', label: '금융주 상대수익률 급락', category: '신용스트레스' },
  { id: 'dxy_100', label: 'DXY 100+ 유지', category: '유동성압박' },
  { id: 'real_rates', label: '장단기 실질금리 동반 상승', category: '유동성압박' },
];

const WEEKLY_CHECKS = [
  { id: 'oil_type', label: '유가↑ + PMI↓ → 공급쇼크(스태그)', category: '원인분해' },
  { id: 'oil_demand', label: '유가↑ + PMI↑ → 수요회복(경기강)', category: '원인분해' },
  { id: 'bei_trend', label: '5y5y 기대인플레 추세적 상승', category: '인플레기대' },
  { id: 'stagflation', label: '인플레↑ + 성장↓ 동시 발생', category: '인플레기대' },
  { id: 'gate_news', label: '세미리퀴드펀드 게이트/지급지연 확산', category: 'Private Credit' },
  { id: 'pc_price', label: '사모대출 거래가격 추세 하락', category: 'Private Credit' },
  { id: 'simultaneous', label: '유가↑+달러↑+장기금리↑ 같은 주', category: '정책풋' },
  { id: 'credit_equity', label: '주식↓ + 크레딧스프레드↑ 동시', category: '정책풋' },
  { id: 'margin_call', label: '기업 가이던스에 원가압박 명시', category: '정책풋' },
  { id: 'policy_type', label: '금리인하보다 유동성/규제/재정 선행', category: '정책풋' },
];

const SC = {
  green: { bg: '#0a2e1a', border: '#22c55e', text: '#4ade80', glow: 'rgba(34,197,94,0.3)' },
  yellow: { bg: '#2e2a0a', border: '#eab308', text: '#facc15', glow: 'rgba(234,179,8,0.3)' },
  red: { bg: '#2e0a0a', border: '#ef4444', text: '#f87171', glow: 'rgba(239,68,68,0.3)' },
  neutral: { bg: '#1a1a2e', border: '#475569', text: '#94a3b8', glow: 'rgba(71,85,105,0.2)' },
};

// ─── 소형 컴포넌트 ───
function Dot({ status = 'neutral', size = 10 }) {
  const c = SC[status] || SC.neutral;
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: c.border, boxShadow: `0 0 8px ${c.glow}` }} />;
}

function triggerStatus(config, level) {
  if (level == null) return 'neutral';
  if (config.direction === 'below') {
    if (level < config.threshold) return 'red';
    if (level < config.threshold * 1.03) return 'yellow';
    return 'green';
  } else {
    if (level > config.threshold) return 'red';
    if (level > config.threshold * 0.95) return 'yellow';
    return 'green';
  }
}

function formatVal(val, unit) {
  if (val == null) return '—';
  if (unit === '$') return `$${val.toFixed(2)}`;
  if (unit === '%') return `${val.toFixed(3)}%`;
  if (unit === 'bp') return `${val.toFixed(0)}bp`;
  return typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : val;
}

// ─── 메인 ───
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
  const [dailyChecks, setDailyChecks] = useState({});
  const [weeklyChecks, setWeeklyChecks] = useState({});

  // ─── 데이터 로드 ───
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/hartnett-monitor?live=true');
      if (!res.ok) throw new Error('데이터 로드 실패');
      const json = await res.json();
      setSavedData(json.latest);
      setFredLive(json.fredLive);
      if (json.latest?.assessment?.daily_checks) setDailyChecks(json.latest.assessment.daily_checks);
      if (json.latest?.assessment?.weekly_checks) setWeeklyChecks(json.latest.assessment.weekly_checks);
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
    const saved = typeof window !== 'undefined' && sessionStorage.getItem('adminPin');
    if (saved) setIsAdmin(true);
  }, []);

  const handlePinSubmit = () => { sessionStorage.setItem('adminPin', pinInput); setIsAdmin(true); setShowPin(false); };
  const getPin = () => typeof window !== 'undefined' && sessionStorage.getItem('adminPin');

  // ─── AI 분석 ───
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

  // ─── 체크 저장 ───
  const saveChecks = async () => {
    if (!savedData) return;
    try {
      const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      await fetch(`${supaUrl}/rest/v1/hartnett_monitor?id=eq.${savedData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', apikey: supaKey, Authorization: `Bearer ${supaKey}`, Prefer: 'return=representation' },
        body: JSON.stringify({ assessment: { ...(savedData.assessment || {}), daily_checks: dailyChecks, weekly_checks: weeklyChecks } }),
      });
      await loadData();
    } catch (err) { setError('체크리스트 저장 실패'); }
  };

  // ─── 데이터 계산 ───
  const assessment = savedData?.assessment || {};
  const triggers = assessment.triggers || {};
  const savedLevels = savedData?.input_levels || {};
  const metCount = assessment.triggers_met_count ?? 0;
  const overall = assessment.overall || 'neutral';
  const overallC = SC[overall] || SC.neutral;
  const dailyRedCount = Object.values(dailyChecks).filter(Boolean).length;
  const weeklyRedCount = Object.values(weeklyChecks).filter(Boolean).length;

  // FRED 실시간 + 저장된 값 병합
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
      {/* ═══ 헤더 ═══ */}
      <div style={{ background: 'linear-gradient(180deg, #0f172a 0%, #0f0f1a 100%)', borderBottom: '1px solid #1e293b', padding: '20px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>🔴</span>
                <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>하트넷 2008 프레임워크 모니터</h1>
              </div>
              <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0 36px' }}>
                FRED API 자동수집 • Michael Hartnett "구조적으로 닮은" 스트레스 조합 추적
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {savedData?.updated_at && (
                <span style={{ color: '#475569', fontSize: '11px' }}>
                  AI 분석: {new Date(savedData.updated_at).toLocaleString('ko-KR')}
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
        {/* ═══ 종합 신호 ═══ */}
        <div style={{ background: overallC.bg, border: `1px solid ${overallC.border}`, borderRadius: '12px', padding: '20px 24px', marginBottom: '20px', boxShadow: `0 0 30px ${overallC.glow}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Dot status={overall} size={14} />
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: overallC.text, textTransform: 'uppercase' }}>
                  {overall === 'red' ? '경계 (RED)' : overall === 'yellow' ? '주의 (YELLOW)' : overall === 'green' ? '안정 (GREEN)' : '미평가'}
                </div>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
                  {assessment.overall_comment || 'AI 업데이트 버튼을 눌러 분석을 실행하세요.'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '24px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: metCount >= 3 ? '#ef4444' : metCount >= 2 ? '#eab308' : '#22c55e', fontFamily: 'monospace' }}>{metCount}/4</div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>트리거</div>
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

        {/* ═══ 4대 트리거 ═══ */}
        <h2 style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          정책 풋 트리거
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {TRIGGER_CONFIG.map(cfg => {
            const t = triggers[cfg.key] || {};
            const level = t.level ?? currentLevel(cfg.key);
            const status = t.met ? 'red' : triggerStatus(cfg, level);
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

        {/* ═══ 보조 지표 (FRED 자동) ═══ */}
        <h2 style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          보조 지표 (FRED 자동 수집)
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          {EXTRA_INDICATORS.map(ind => {
            const val = currentLevel(ind.key);
            const fredDate = fredLive?.[ind.key]?.date;
            return (
              <div key={ind.key} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>{ind.label}</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>{formatVal(val, ind.unit)}</div>
                {fredDate && <div style={{ fontSize: '9px', color: '#334155', marginTop: '2px' }}>{fredDate}</div>}
              </div>
            );
          })}
        </div>

        {/* ═══ 스트레스 + 전략 ═══ */}
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

        {/* ═══ 체크리스트 ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '13px', color: '#64748b', marginBottom: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
              일일 경보 ({dailyRedCount}/{DAILY_MONITORS.length})
            </h2>
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '6px' }}>
              {DAILY_MONITORS.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 12px', background: dailyChecks[item.id] ? 'rgba(239,68,68,0.08)' : 'transparent', borderRadius: '6px', borderLeft: dailyChecks[item.id] ? '3px solid #ef4444' : '3px solid transparent' }}>
                  {isAdmin ? (
                    <input type="checkbox" checked={!!dailyChecks[item.id]} onChange={e => setDailyChecks(p => ({ ...p, [item.id]: e.target.checked }))}
                      style={{ accentColor: '#ef4444', cursor: 'pointer', width: 16, height: 16 }} />
                  ) : <Dot status={dailyChecks[item.id] ? 'red' : 'green'} size={8} />}
                  <span style={{ color: dailyChecks[item.id] ? '#f87171' : '#94a3b8', fontSize: '13px', flex: 1 }}>{item.label}</span>
                  <span style={{ color: '#475569', fontSize: '10px', background: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>{item.category}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: '13px', color: '#64748b', marginBottom: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
              주간 원인분해 ({weeklyRedCount}/{WEEKLY_CHECKS.length})
            </h2>
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '6px' }}>
              {WEEKLY_CHECKS.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 12px', background: weeklyChecks[item.id] ? 'rgba(239,68,68,0.08)' : 'transparent', borderRadius: '6px', borderLeft: weeklyChecks[item.id] ? '3px solid #ef4444' : '3px solid transparent' }}>
                  {isAdmin ? (
                    <input type="checkbox" checked={!!weeklyChecks[item.id]} onChange={e => setWeeklyChecks(p => ({ ...p, [item.id]: e.target.checked }))}
                      style={{ accentColor: '#ef4444', cursor: 'pointer', width: 16, height: 16 }} />
                  ) : <Dot status={weeklyChecks[item.id] ? 'red' : 'green'} size={8} />}
                  <span style={{ color: weeklyChecks[item.id] ? '#f87171' : '#94a3b8', fontSize: '13px', flex: 1 }}>{item.label}</span>
                  <span style={{ color: '#475569', fontSize: '10px', background: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>{item.category}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isAdmin && (
          <button onClick={saveChecks} style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '8px 20px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', marginBottom: '20px' }}>
            💾 체크리스트 저장
          </button>
        )}

        {/* ═══ 관리자: AI 업데이트 ═══ */}
        {isAdmin && (
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '14px', color: '#e2e8f0', marginBottom: '12px', fontWeight: 600 }}>🤖 AI 업데이트</h2>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
              S&P500, WTI, 30Y 금리, HY OAS, VIX, BEI 등은 <b style={{ color: '#22c55e' }}>FRED에서 자동 수집</b>됩니다.
              DXY와 Brent만 아래에 수동 입력하세요.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>DXY (필수 · 수동입력)</label>
                <input type="number" step="any" value={manualDxy} onChange={e => setManualDxy(e.target.value)} placeholder="100.5"
                  style={{ width: '140px', background: '#1e293b', border: '1px solid #6366f1', color: '#e2e8f0', padding: '8px 10px', borderRadius: '6px', fontSize: '14px', fontFamily: 'monospace' }} />
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
                {analyzing ? '⏳ FRED 수집 + AI 분석 중...' : '🤖 AI 업데이트'}
              </button>
              <span style={{ fontSize: '11px', color: '#475569' }}>
                FRED 8개 시리즈 자동수집 → AI 분석 ~1,500토큰 (~$0.005)
              </span>
            </div>
            {error && (
              <div style={{ marginTop: '12px', padding: '10px 14px', background: '#2e0a0a', border: '1px solid #7f1d1d', borderRadius: '6px', color: '#fca5a5', fontSize: '13px' }}>❌ {error}</div>
            )}
          </div>
        )}

        {/* ═══ 프레임워크 요약 ═══ */}
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px', marginBottom: '20px', fontSize: '12px', color: '#64748b', lineHeight: '1.8' }}>
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
