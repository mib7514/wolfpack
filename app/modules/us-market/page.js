'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

// ═══════════════════════════════════════════════════════════════════════
// 🐺 US MARKET WEEKLY — FRED(무료) + AI(최소비용) 하이브리드
// ═══════════════════════════════════════════════════════════════════════

const C = {
  bg: '#0a0e17', card: '#111827', border: '#1e293b',
  accent: '#f59e0b', green: '#22c55e', red: '#ef4444',
  text: '#e2e8f0', dim: '#94a3b8', muted: '#475569',
  input: '#1e293b', inputB: '#334155',
  blue: '#3b82f6', purple: '#818cf8', cyan: '#06b6d4',
  pink: '#ec4899', orange: '#f97316',
};

const THEME_COLORS = [
  { bg: '#818cf822', border: '#818cf844', text: '#818cf8' },
  { bg: '#06b6d422', border: '#06b6d444', text: '#06b6d4' },
  { bg: '#f59e0b22', border: '#f59e0b44', text: '#f59e0b' },
  { bg: '#ec489922', border: '#ec489944', text: '#ec4899' },
];

const RATE_KEYS = ['dgs10', 'dgs2', 'bei5y'];
const BP_KEYS = ['hy_oas'];

function changeUnit(name) {
  const n = name.toLowerCase();
  if (n.includes('treasury') || n.includes('bei') || n === '10y' || n === '2y' || n === '5y bei') return 'pp';
  if (n.includes('oas')) return 'bp';
  return '%';
}

// ═══════════════════════════════════════════════════════════════════════
export default function USMarketPage() {
  const [tab, setTab] = useState('report');
  const [reports, setReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [weekEnd, setWeekEnd] = useState('');
  const [userContext, setUserContext] = useState('');

  // Admin
  const [adminPin, setAdminPin] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('wolfpack_admin_pin');
    if (saved) { setAdminPin(saved); setIsAdmin(true); }
  }, []);

  useEffect(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? 2 : day === 6 ? 1 : day >= 5 ? 0 : (5 - day);
    const friday = new Date(today);
    friday.setDate(today.getDate() - (day <= 5 && day > 0 ? day - 5 + 7 : day === 0 ? 2 : 1));
    // 간단히: 오늘이 토일이면 어제/그저께 금요일, 평일이면 지난 금요일
    const d = new Date();
    while (d.getDay() !== 5) d.setDate(d.getDate() - 1);
    setWeekEnd(d.toISOString().split('T')[0]);
  }, []);

  const handlePinSubmit = async () => {
    setPinError('');
    try {
      const res = await fetch('/api/us-market-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': adminPin },
        body: JSON.stringify({ weekEnd: '2000-01-07' }),
      });
      if (res.status === 401) { setPinError('PIN 불일치'); return; }
      setIsAdmin(true);
      sessionStorage.setItem('wolfpack_admin_pin', adminPin);
      setShowPinModal(false);
      if (pendingAction) { pendingAction(); setPendingAction(null); }
    } catch { setPinError('인증 오류'); }
  };

  const requireAdmin = (action) => {
    if (isAdmin) { action(); return; }
    setPendingAction(() => action);
    setShowPinModal(true);
  };

  // ─── Data ──────────────────────────────────────────
  useEffect(() => { loadReports(); }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const sb = createClient();
      const { data, error } = await sb.from('us_market_reports').select('*').order('created_at', { ascending: false });
      if (error) console.error('로드 오류:', error.message);
      if (data && data.length > 0) {
        const parsed = data.map(d => ({
          ...d,
          report: typeof d.report === 'string' ? JSON.parse(d.report) : d.report,
        }));
        setReports(parsed);
        setCurrentReport(parsed[0]);
      }
    } catch (e) { console.error('Load error:', e); }
    setLoading(false);
  };

  const generateReport = async () => {
    if (!weekEnd) return;
    setGenerating(true);
    setGenError('');
    try {
      const res = await fetch('/api/us-market-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': adminPin },
        body: JSON.stringify({ weekEnd, userContext }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setIsAdmin(false);
        sessionStorage.removeItem('wolfpack_admin_pin');
        setGenError('인증 만료');
        setGenerating(false);
        return;
      }
      if (!data.success) {
        setGenError(data.error || '생성 실패');
        setGenerating(false);
        return;
      }

      const record = {
        id: `umr_${Date.now()}`,
        week_start: data.weekStart,
        week_end: data.weekEnd,
        title: data.report.narrative?.keyNarrative || `${data.weekStart}~${data.weekEnd}`,
        report: data.report,
        user_context: userContext,
        created_at: new Date().toISOString(),
      };

      try {
        const sb = createClient();
        const { error: dbErr } = await sb.from('us_market_reports').insert(record);
        if (dbErr) {
          console.error('DB 저장 오류:', dbErr.message);
          setGenError('리포트 생성 완료, DB 저장 실패: ' + dbErr.message);
        }
      } catch (e) {
        console.error('DB 오류:', e.message);
        setGenError('리포트 생성 완료, DB 저장 실패: ' + e.message);
      }

      setReports(prev => [{ ...record, report: data.report }, ...prev]);
      setCurrentReport({ ...record, report: data.report });
      setTab('report');
      setUserContext('');
    } catch (e) {
      setGenError('오류: ' + e.message);
    }
    setGenerating(false);
  };

  const deleteReport = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      const sb = createClient();
      await sb.from('us_market_reports').delete().eq('id', id);
      const remaining = reports.filter(r => r.id !== id);
      setReports(remaining);
      if (currentReport?.id === id) setCurrentReport(remaining[0] || null);
    } catch (e) { alert('삭제 오류: ' + e.message); }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Pretendard', -apple-system, 'Noto Sans KR', sans-serif" }}>
      {/* PIN Modal */}
      {showPinModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { setShowPinModal(false); setPendingAction(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, width: 360, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔐</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>관리자 인증</div>
            <input type="password" value={adminPin} onChange={e => setAdminPin(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handlePinSubmit(); }}
              placeholder="PIN" autoFocus
              style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: `1px solid ${pinError ? C.red : C.inputB}`, background: C.input, color: C.text, fontSize: 15, outline: 'none', textAlign: 'center', letterSpacing: 8, fontWeight: 700, boxSizing: 'border-box' }} />
            {pinError && <div style={{ fontSize: 12, color: C.red, marginTop: 8 }}>{pinError}</div>}
            <button onClick={handlePinSubmit} style={{ marginTop: 16, width: '100%', padding: 12, borderRadius: 10, border: 'none', background: C.accent, color: '#000', fontWeight: 700, cursor: 'pointer' }}>확인</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '20px 28px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <a href="/" style={{ color: C.muted, fontSize: 12, textDecoration: 'none', display: 'block', marginBottom: 4 }}>← 컨트롤 타워</a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: C.accent }}>🐺 US MARKET WEEKLY</span>
            <Pill color={C.green}>FRED 무료</Pill>
            <Pill color={C.purple}>AI 최소비용</Pill>
          </div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>FRED 무료 API로 시장 데이터 수집 + AI로 52주 신고가 & 내러티브 분석</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Pill color={C.blue}>{reports.length}개 리포트</Pill>
          {isAdmin ? (
            <button onClick={() => { setIsAdmin(false); setAdminPin(''); sessionStorage.removeItem('wolfpack_admin_pin'); }}
              style={{ background: 'none', border: `1px solid ${C.green}44`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
              <span style={{ fontSize: 10, color: C.green, fontWeight: 600 }}>🔓 ADMIN</span>
            </button>
          ) : (
            <button onClick={() => setShowPinModal(true)}
              style={{ background: 'none', border: `1px solid ${C.muted}44`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
              <span style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>🔒 GUEST</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 24px 0' }}>
        <div style={{ display: 'flex', gap: 4, background: C.input, borderRadius: 10, padding: 4 }}>
          {[
            { key: 'report', label: '📊 리포트' },
            { key: 'generate', label: '🤖 생성' },
            { key: 'timeline', label: '📅 시계열' },
            { key: 'archive', label: '📚 아카이브' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '10px 8px', borderRadius: 8, border: 'none',
              background: tab === t.key ? C.accent : 'transparent',
              color: tab === t.key ? '#000' : C.dim, fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px' }}>
        {loading ? <div style={{ textAlign: 'center', padding: 60, color: C.dim }}>로딩 중...</div> : (
          <>
            {tab === 'report' && (currentReport ? <ReportView record={currentReport} /> : <EmptyState onGen={() => setTab('generate')} />)}
            {tab === 'generate' && <GenerateTab weekEnd={weekEnd} setWeekEnd={setWeekEnd} userContext={userContext} setUserContext={setUserContext} generating={generating} genError={genError} onGenerate={() => requireAdmin(generateReport)} isAdmin={isAdmin} />}
            {tab === 'timeline' && <TimelineTab reports={reports} />}
            {tab === 'archive' && <ArchiveTab reports={reports} currentId={currentReport?.id} onSelect={r => { setCurrentReport(r); setTab('report'); }} onDelete={id => requireAdmin(() => deleteReport(id))} isAdmin={isAdmin} />}
          </>
        )}
      </div>

      <div style={{ padding: '16px 28px', borderTop: `1px solid ${C.border}`, textAlign: 'center', marginTop: 40 }}>
        <span style={{ fontSize: 11, color: C.muted }}>🐺 늑대무리원정단 · US Market Weekly · FRED 무료 + AI 최소비용 · 투자 결정은 본인 책임</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
function Pill({ children, color = C.accent, style }) {
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: color + '22', color, border: `1px solid ${color}44`, ...style }}>{children}</span>;
}
function Card({ children, title, subtitle, style }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px', ...style }}>
      {title && <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: subtitle ? 2 : 14 }}>{title}</div>}
      {subtitle && <div style={{ fontSize: 12, color: C.dim, marginBottom: 14 }}>{subtitle}</div>}
      {children}
    </div>
  );
}
function Btn({ children, onClick, primary, small, disabled, danger, style }) {
  return <button onClick={onClick} disabled={disabled} style={{ padding: small ? '6px 14px' : '10px 20px', borderRadius: 8, border: primary ? 'none' : `1px solid ${danger ? C.red + '44' : C.inputB}`, background: primary ? C.accent : 'transparent', color: primary ? '#000' : danger ? C.red : C.text, fontWeight: 600, fontSize: small ? 12 : 13, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, ...style }}>{children}</button>;
}

function EmptyState({ onGen }) {
  return (
    <Card style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📈</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>아직 리포트가 없습니다</div>
      <Btn primary onClick={onGen}>첫 리포트 생성</Btn>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// GENERATE TAB
// ═══════════════════════════════════════════════════════════════
function GenerateTab({ weekEnd, setWeekEnd, userContext, setUserContext, generating, genError, onGenerate, isAdmin }) {
  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 700, margin: '0 auto' }}>
      <Card title="🤖 주간 리포트 생성" subtitle="FRED(무료)로 시장 데이터 수집 → AI로 52주 신고가 & 내러티브 분석">
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 6 }}>📅 기준 주 금요일</label>
            <input type="date" value={weekEnd} onChange={e => setWeekEnd(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: `1px solid ${C.inputB}`, background: C.input, color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 6 }}>💬 추가 맥락 (선택)</label>
            <textarea value={userContext} onChange={e => setUserContext(e.target.value)}
              placeholder="예: FOMC 회의, AI 섹터 관심, 에너지 집중..."
              rows={2}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: `1px solid ${C.inputB}`, background: C.input, color: C.text, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          <button onClick={onGenerate} disabled={!weekEnd || generating}
            style={{
              padding: '14px', borderRadius: 10, border: 'none',
              background: generating ? '#374151' : `linear-gradient(135deg, ${C.accent}, ${C.orange})`,
              color: generating ? C.dim : '#000', fontWeight: 700, fontSize: 14,
              cursor: (!weekEnd || generating) ? 'not-allowed' : 'pointer',
            }}>
            {generating ? '🔄 생성 중... (FRED 수집 + AI 분석)' : isAdmin ? '🤖 리포트 생성' : '🔐 관리자 인증 필요'}
          </button>
          {genError && <div style={{ padding: '10px 14px', background: C.red + '11', border: `1px solid ${C.red}33`, borderRadius: 8, fontSize: 12, color: C.red }}>⚠️ {genError}</div>}
          {generating && (
            <div style={{ padding: 16, background: C.bg, borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🌐</div>
              <div style={{ fontSize: 13, color: C.accent, fontWeight: 600 }}>FRED → 시장 데이터 수집 (무료)</div>
              <div style={{ fontSize: 13, color: C.purple, fontWeight: 600, marginTop: 4 }}>AI → 52주 신고가 & 내러티브 (최소 토큰)</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>30~60초 소요</div>
            </div>
          )}
        </div>
      </Card>

      <Card title="💰 비용 구조">
        <div style={{ display: 'grid', gap: 8 }}>
          {[
            { label: 'FRED 시장 데이터 (11개 시리즈)', cost: '무료', color: C.green, desc: 'S&P500, Nasdaq, DJIA, WTI, Gold, 10Y, 2Y, VIX, HY OAS, BEI, DXY' },
            { label: 'AI 분석 (52주 신고가 + 내러티브)', cost: '~$0.02', color: C.accent, desc: 'web_search 5회 제한, max_tokens 4096, 프롬프트 압축' },
            { label: 'Supabase 저장', cost: '무료', color: C.green, desc: 'Free tier 내' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: C.bg, borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{item.label}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{item.desc}</div>
              </div>
              <Pill color={item.color}>{item.cost}</Pill>
            </div>
          ))}
          <div style={{ padding: '10px 14px', background: C.accent + '11', border: `1px solid ${C.accent}33`, borderRadius: 8, fontSize: 12, color: C.accent, textAlign: 'center' }}>
            주 1회 실행 기준 → 월 ~$0.08 (거의 무료)
          </div>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REPORT VIEW
// ═══════════════════════════════════════════════════════════════
function ReportView({ record }) {
  const r = record.report || {};
  const nar = r.narrative || {};
  const themes = r.themes || [];
  const dives = r.deepDives || [];
  const impl = r.implications || {};
  const breadth = r.breadth || {};

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* 헤더 */}
      <div style={{ padding: '20px 24px', background: `linear-gradient(135deg, ${C.card}, ${C.bg})`, border: `1px solid ${C.accent}33`, borderRadius: 14 }}>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>📅 {r.weekRange || `${record.week_start} ~ ${record.week_end}`}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: C.accent, marginBottom: 6 }}>{nar.keyNarrative || '주간 리포트'}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Pill color={C.blue}>{themes.length}개 테마</Pill>
          <Pill color={C.green}>{themes.reduce((s, t) => s + (t.stocks?.length || 0), 0)}개 신고가</Pill>
          <Pill color={C.purple}>{dives.length}개 심층분석</Pill>
        </div>
      </div>

      {/* A: 내러티브 */}
      <Card title="📊 A. 주간 시장 내러티브">
        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.8, marginBottom: 14, padding: '12px 16px', background: C.bg, borderRadius: 10 }}>
          {nar.summary || '요약 없음'}
        </div>
        {(nar.events || []).length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 6, fontWeight: 600 }}>📰 주요 이벤트</div>
            {(nar.events || []).map((ev, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 12px', background: C.bg, borderRadius: 8, marginBottom: 4 }}>
                <span style={{ flexShrink: 0 }}>⚡</span>
                <div><span style={{ fontSize: 13, fontWeight: 700 }}>{ev.event}</span> <span style={{ fontSize: 12, color: C.dim }}>— {ev.impact}</span></div>
              </div>
            ))}
          </div>
        )}
        {nar.sectorSummary && (
          <div style={{ padding: '8px 12px', background: C.bg, borderRadius: 8, marginBottom: 14, fontSize: 12 }}>
            <span style={{ color: C.dim, fontWeight: 600 }}>🏭 섹터: </span><span style={{ color: C.text }}>{nar.sectorSummary}</span>
          </div>
        )}
      </Card>

      {/* 변동률 차트 */}
      {((nar.indices || []).length > 0 || (nar.assets || []).length > 0) && (
        <Card title="📈 주간 변동률" subtitle="FRED 데이터 기반 (정확한 수치)">
          <BarChart items={[...(nar.indices || []), ...(nar.assets || [])]} />
        </Card>
      )}

      {/* Breadth */}
      {(breadth.sp500NewHighs > 0 || breadth.nasdaqNewHighs > 0) && <BreadthCard b={breadth} />}

      {/* B: 테마 */}
      {themes.length > 0 && (
        <Card title="🏆 B. 52주 신고가 — 테마별 분류">
          <div style={{ display: 'grid', gap: 14 }}>
            {themes.map((theme, ti) => {
              const tc = THEME_COLORS[ti % THEME_COLORS.length];
              return (
                <div key={ti} style={{ padding: '16px 18px', background: tc.bg, border: `1px solid ${tc.border}`, borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: tc.text }}>#{ti + 1}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{theme.name}</span>
                    <Pill color={tc.text}>{theme.stocks?.length || 0}종목</Pill>
                  </div>
                  <div style={{ fontSize: 12, color: C.dim, marginBottom: 12 }}>{theme.description}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                    {(theme.stocks || []).map((s, si) => (
                      <div key={si} style={{ padding: '10px 12px', background: C.card, borderRadius: 8, border: `1px solid ${C.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 900, color: tc.text }}>{s.ticker}</span>
                          {s.marketCap && <span style={{ fontSize: 10, color: C.muted }}>{s.marketCap}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>{s.name}</div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                          {s.yoyReturn != null && <span><span style={{ color: C.muted }}>YoY </span><span style={{ color: s.yoyReturn >= 0 ? C.green : C.red, fontWeight: 700 }}>{s.yoyReturn >= 0 ? '+' : ''}{s.yoyReturn}%</span></span>}
                          {s.weekReturn != null && <span><span style={{ color: C.muted }}>주간 </span><span style={{ color: s.weekReturn >= 0 ? C.green : C.red, fontWeight: 700 }}>{s.weekReturn >= 0 ? '+' : ''}{s.weekReturn}%</span></span>}
                        </div>
                        {s.catalyst && <div style={{ fontSize: 10, color: C.muted, marginTop: 3, fontStyle: 'italic' }}>→ {s.catalyst}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* C: 심층분석 */}
      {dives.length > 0 && (
        <Card title="🔬 C. 종목 심층분석">
          <div style={{ display: 'grid', gap: 10 }}>
            {dives.map((d, i) => (
              <details key={i} style={{ background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }} open={i < 2}>
                <summary style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: C.accent }}>{d.ticker}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</span>
                    {d.theme && <Pill color={C.purple}>{d.theme}</Pill>}
                  </div>
                  <span style={{ fontSize: 11, color: C.muted }}>▸</span>
                </summary>
                <div style={{ padding: '0 16px 14px', display: 'grid', gap: 8 }}>
                  {[
                    { icon: '🎯', label: '왜 지금?', text: d.whyNow },
                    { icon: '📊', label: '실적', text: d.earnings },
                    { icon: '🔗', label: '구조적 테마', text: d.structuralTheme },
                    { icon: '⚠️', label: '리스크', text: d.risk },
                  ].filter(x => x.text).map((x, j) => (
                    <div key={j} style={{ padding: '8px 12px', background: C.card, borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: C.dim, marginBottom: 3, fontWeight: 600 }}>{x.icon} {x.label}</div>
                      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{x.text}</div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </Card>
      )}

      {/* D: 시사점 */}
      <Card title="💡 D. 투자 시사점">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: (impl.nextWeekEvents || []).length > 0 ? 14 : 0 }}>
          <div style={{ padding: 14, background: C.bg, borderRadius: 10, border: `1px solid ${C.blue}22` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.blue, marginBottom: 6 }}>🏦 채권 / 매크로</div>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>{impl.bondMacro || '-'}</div>
          </div>
          <div style={{ padding: 14, background: C.bg, borderRadius: 10, border: `1px solid ${C.green}22` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 6 }}>📈 주식</div>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>{impl.equity || '-'}</div>
          </div>
        </div>
        {(impl.nextWeekEvents || []).length > 0 && (
          <div style={{ padding: '10px 14px', background: C.bg, borderRadius: 10, border: `1px solid ${C.accent}22` }}>
            <span style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>📅 다음 주: </span>
            {(impl.nextWeekEvents || []).map((ev, i) => <Pill key={i} color={C.accent} style={{ marginLeft: 4, marginBottom: 2 }}>{ev}</Pill>)}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── 바 차트 ─────────────────────────────────────────
function BarChart({ items }) {
  const maxAbs = Math.max(...items.map(it => Math.abs(it.changePercent || 0)), 0.1);

  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {items.map((item, i) => {
        const val = item.changePercent || 0;
        const pct = (Math.abs(val) / maxAbs) * 100;
        const isPos = val >= 0;
        const color = isPos ? C.green : C.red;
        const unit = changeUnit(item.name);

        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 70px', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <span style={{ fontSize: 11, color: C.dim, textAlign: 'right', fontWeight: 600 }}>{item.name}</span>
            <div style={{ height: 16, background: C.input, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                position: 'absolute', top: 0, bottom: 0,
                [isPos ? 'left' : 'right']: '50%',
                width: `${Math.max(1, pct / 2)}%`,
                background: color, borderRadius: isPos ? '0 4px 4px 0' : '4px 0 0 4px', opacity: 0.7,
              }} />
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: C.border }} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color }}>{isPos ? '+' : ''}{val.toFixed(2)}{unit}</span>
              {item.level && <div style={{ fontSize: 9, color: C.muted }}>{item.level}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BreadthCard({ b }) {
  const items = [
    { label: 'S&P 500', highs: b.sp500NewHighs || 0, lows: b.sp500NewLows || 0 },
    { label: 'Nasdaq', highs: b.nasdaqNewHighs || 0, lows: b.nasdaqNewLows || 0 },
  ];
  return (
    <Card title="🌡️ Breadth (신고가 vs 신저가)">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {items.map(it => {
          const total = Math.max(it.highs + it.lows, 1);
          return (
            <div key={it.label} style={{ padding: 12, background: C.bg, borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: C.dim, marginBottom: 6, fontWeight: 600 }}>{it.label}</div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                <div><span style={{ fontSize: 20, fontWeight: 900, color: C.green }}>{it.highs}</span><span style={{ fontSize: 10, color: C.dim }}> 신고가</span></div>
                <div><span style={{ fontSize: 20, fontWeight: 900, color: C.red }}>{it.lows}</span><span style={{ fontSize: 10, color: C.dim }}> 신저가</span></div>
              </div>
              <div style={{ height: 6, background: C.input, borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${(it.highs / total) * 100}%`, background: C.green, borderRadius: '3px 0 0 3px' }} />
                <div style={{ flex: 1, background: C.red, borderRadius: '0 3px 3px 0' }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// TIMELINE TAB — 시계열 추적 (추가 비용 0원, 저장된 리포트 데이터만 사용)
// ═══════════════════════════════════════════════════════════════
function TimelineTab({ reports }) {
  // 시간순 정렬 (오래된 것 먼저)
  const sorted = [...reports].sort((a, b) => new Date(a.week_end) - new Date(b.week_end));

  if (sorted.length < 1) {
    return (
      <Card style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>시계열 데이터가 아직 없습니다</div>
        <div style={{ fontSize: 13, color: C.dim }}>리포트가 2개 이상 쌓이면 시계열 추적이 시작됩니다</div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* 1. 지수 추이 */}
      <FredTrendChart sorted={sorted} title="📈 주요 지수 추이"
        subtitle="주간 리포트 시점의 지수 레벨 변화"
        keys={['sp500', 'nasdaq', 'djia']}
        colors={[C.accent, C.purple, C.blue]} />

      {/* 2. 자산/금리 추이 */}
      <FredTrendChart sorted={sorted} title="📊 자산 · 금리 추이"
        subtitle="금리, VIX, HY OAS, BEI 등 핵심 매크로 지표"
        keys={['dgs10', 'dgs2', 'vix', 'hy_oas', 'bei5y']}
        colors={[C.orange, C.pink, C.red, C.cyan, C.green]} />

      {/* 3. 원자재 추이 */}
      <FredTrendChart sorted={sorted} title="🛢️ 원자재 · 달러 추이"
        subtitle="WTI, Gold, Dollar Index"
        keys={['wti', 'gold', 'dxy']}
        colors={['#a78bfa', C.accent, C.green]} />

      {/* 4. 주간 내러티브 흐름 */}
      <NarrativeFlow sorted={sorted} />

      {/* 5. 테마 진화 추적 */}
      <ThemeEvolution sorted={sorted} />

      {/* 6. 반복 신고가 종목 (모멘텀) */}
      <RecurringStocks sorted={sorted} />

      {/* 7. Breadth 추이 */}
      <BreadthTrend sorted={sorted} />
    </div>
  );
}

// ─── FRED 데이터 라인 차트 ───────────────────────────────────────────
function FredTrendChart({ sorted, title, subtitle, keys, colors }) {
  // sorted 리포트에서 fredData 추출
  const points = sorted.map(r => {
    const fred = r.report?.fredData || {};
    const weekLabel = r.week_end?.slice(5) || '?';
    const vals = {};
    keys.forEach(k => { vals[k] = fred[k]?.current || null; });
    return { weekLabel, weekEnd: r.week_end, vals };
  }).filter(p => keys.some(k => p.vals[k] != null));

  if (points.length < 2) return null;

  // 키별 min/max 계산 — 다축 (normalize to 0~1)
  const ranges = {};
  keys.forEach(k => {
    const vals = points.map(p => p.vals[k]).filter(v => v != null);
    if (vals.length === 0) { ranges[k] = { min: 0, max: 1 }; return; }
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    ranges[k] = { min, max: max === min ? max + 1 : max };
  });

  const W = 1050, H = 220;
  const PAD = { top: 20, right: 20, bottom: 35, left: 10 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const getX = (i) => PAD.left + (i / Math.max(1, points.length - 1)) * cW;
  const getY = (val, key) => {
    const r = ranges[key];
    const norm = (val - r.min) / (r.max - r.min);
    return PAD.top + cH * (1 - norm);
  };

  return (
    <Card title={title} subtitle={subtitle}>
      <div style={{ overflowX: 'auto' }}>
        <svg width={W} height={H} style={{ display: 'block' }}>
          {/* 그리드 */}
          {[0, 0.5, 1].map(r => (
            <line key={r} x1={PAD.left} y1={PAD.top + cH * (1 - r)} x2={W - PAD.right} y2={PAD.top + cH * (1 - r)} stroke={C.border} strokeWidth={1} />
          ))}
          {/* x축 날짜 */}
          {points.map((p, i) => {
            // 라벨 간격 조절 — 최대 10개
            if (points.length > 10 && i % Math.ceil(points.length / 10) !== 0 && i !== points.length - 1) return null;
            return <text key={i} x={getX(i)} y={H - 5} textAnchor="middle" fill={C.muted} fontSize={10}>{p.weekLabel}</text>;
          })}
          {/* 라인 */}
          {keys.map((k, ki) => {
            const validPts = points.map((p, i) => p.vals[k] != null ? { i, val: p.vals[k] } : null).filter(Boolean);
            if (validPts.length < 2) return null;
            const d = validPts.map((pt, j) => `${j === 0 ? 'M' : 'L'} ${getX(pt.i)} ${getY(pt.val, k)}`).join(' ');
            return (
              <g key={k}>
                <path d={d} fill="none" stroke={colors[ki]} strokeWidth={2} strokeLinejoin="round" opacity={0.8} />
                {validPts.map((pt, j) => (
                  <circle key={j} cx={getX(pt.i)} cy={getY(pt.val, k)} r={3} fill={colors[ki]} stroke={C.card} strokeWidth={1.5} />
                ))}
                {/* 마지막 값 표시 */}
                {validPts.length > 0 && (() => {
                  const last = validPts[validPts.length - 1];
                  return <text x={Math.min(getX(last.i) + 4, W - 50)} y={getY(last.val, k) - 6} fill={colors[ki]} fontSize={10} fontWeight={700}>{last.val.toFixed(1)}</text>;
                })()}
              </g>
            );
          })}
        </svg>
      </div>
      {/* 범례 */}
      <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
        {keys.map((k, ki) => {
          const r = ranges[k];
          const fred = sorted[sorted.length - 1]?.report?.fredData?.[k];
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: colors[ki] }} />
              <span style={{ fontSize: 11, color: colors[ki], fontWeight: 600 }}>{fred?.label || k}</span>
              <span style={{ fontSize: 10, color: C.muted }}>({r.min.toFixed(1)}~{r.max.toFixed(1)})</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── 주간 내러티브 흐름 ──────────────────────────────────────────────
function NarrativeFlow({ sorted }) {
  if (sorted.length < 1) return null;

  return (
    <Card title="📰 주간 핵심 내러티브 흐름" subtitle="매주 시장을 지배한 스토리의 변화를 추적합니다">
      <div style={{ display: 'grid', gap: 6 }}>
        {sorted.map((r, i) => {
          const nar = r.report?.narrative || {};
          const prevNar = i > 0 ? sorted[i - 1].report?.narrative : null;
          // 키 내러티브가 바뀌었는지 체크
          const changed = prevNar && prevNar.keyNarrative !== nar.keyNarrative;

          return (
            <div key={r.id} style={{
              display: 'flex', gap: 12, padding: '10px 14px', background: changed ? C.accent + '11' : C.bg,
              borderRadius: 8, border: `1px solid ${changed ? C.accent + '33' : C.border}`, alignItems: 'flex-start',
            }}>
              <div style={{ flexShrink: 0, textAlign: 'center', width: 55 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.accent }}>{r.week_end?.slice(5)}</div>
                {changed && <div style={{ fontSize: 9, color: C.accent, marginTop: 2 }}>⚡전환</div>}
              </div>
              <div style={{ position: 'relative', width: 2, background: changed ? C.accent : C.border, flexShrink: 0, minHeight: 30, marginTop: 2 }}>
                <div style={{ position: 'absolute', top: 4, left: -4, width: 10, height: 10, borderRadius: '50%', background: changed ? C.accent : C.muted }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>{nar.keyNarrative || '-'}</div>
                {nar.sectorSummary && <div style={{ fontSize: 11, color: C.dim }}>🏭 {nar.sectorSummary}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── 테마 진화 추적 ──────────────────────────────────────────────────
function ThemeEvolution({ sorted }) {
  if (sorted.length < 2) return null;

  // 모든 테마 수집 + 각 주별 등장 여부
  const allThemes = {};
  sorted.forEach((r, wi) => {
    (r.report?.themes || []).forEach(t => {
      if (!allThemes[t.name]) allThemes[t.name] = { name: t.name, weeks: [], totalStocks: 0, firstSeen: wi, lastSeen: wi };
      allThemes[t.name].weeks.push({ weekIdx: wi, weekEnd: r.week_end, stocks: t.stocks?.length || 0 });
      allThemes[t.name].totalStocks += (t.stocks?.length || 0);
      allThemes[t.name].lastSeen = wi;
    });
  });

  // 빈도순 정렬
  const themeList = Object.values(allThemes).sort((a, b) => b.weeks.length - a.weeks.length).slice(0, 12);
  if (themeList.length === 0) return null;

  const totalWeeks = sorted.length;

  return (
    <Card title="🔄 테마 진화 타임라인" subtitle="각 테마가 어느 주에 등장했는지, 지속성과 강도를 추적합니다">
      <div style={{ display: 'grid', gap: 8 }}>
        {themeList.map((theme, ti) => {
          const tc = THEME_COLORS[ti % THEME_COLORS.length];
          const span = theme.lastSeen - theme.firstSeen + 1;
          const density = theme.weeks.length / span; // 등장 밀도

          return (
            <div key={theme.name} style={{ padding: '10px 14px', background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{theme.name}</span>
                  <Pill color={theme.weeks.length >= 3 ? C.green : theme.weeks.length >= 2 ? C.accent : C.dim} style={{ fontSize: 9 }}>
                    {theme.weeks.length}주 등장
                  </Pill>
                </div>
                <span style={{ fontSize: 10, color: C.muted }}>{theme.totalStocks}종목 누적</span>
              </div>
              {/* 주차별 히트맵 바 */}
              <div style={{ display: 'flex', gap: 2 }}>
                {sorted.map((r, wi) => {
                  const weekData = theme.weeks.find(w => w.weekIdx === wi);
                  const active = !!weekData;
                  const stocks = weekData?.stocks || 0;
                  const intensity = active ? Math.min(1, 0.3 + stocks * 0.15) : 0;

                  return (
                    <div key={wi} title={`${r.week_end?.slice(5)} ${active ? `${stocks}종목` : '없음'}`}
                      style={{
                        flex: 1, height: 20, borderRadius: 2,
                        background: active ? tc.text : C.input,
                        opacity: active ? intensity : 0.3,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      {active && stocks > 0 && totalWeeks <= 12 && (
                        <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>{stocks}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* 주차 라벨 */}
              <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                {sorted.map((r, wi) => (
                  <div key={wi} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: C.muted }}>
                    {totalWeeks <= 12 ? r.week_end?.slice(5) : (wi === 0 || wi === totalWeeks - 1 ? r.week_end?.slice(5) : '')}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── 반복 신고가 종목 (모멘텀 추적) ─────────────────────────────────
function RecurringStocks({ sorted }) {
  if (sorted.length < 2) return null;

  // 종목별 등장 주차 추적
  const stockMap = {};
  sorted.forEach((r, wi) => {
    (r.report?.themes || []).forEach(t => {
      (t.stocks || []).forEach(s => {
        const key = s.ticker;
        if (!key) return;
        if (!stockMap[key]) stockMap[key] = { ticker: key, name: s.name, appearances: [], themes: new Set() };
        stockMap[key].appearances.push({ weekIdx: wi, weekEnd: r.week_end, theme: t.name, weekReturn: s.weekReturn, yoyReturn: s.yoyReturn });
        stockMap[key].themes.add(t.name);
      });
    });
  });

  // 2회 이상 등장 종목만 (연속 신고가 = 강한 모멘텀)
  const recurring = Object.values(stockMap)
    .filter(s => s.appearances.length >= 2)
    .sort((a, b) => b.appearances.length - a.appearances.length)
    .slice(0, 15);

  if (recurring.length === 0) {
    return (
      <Card title="🔥 연속 신고가 종목 추적" subtitle="2주 이상 52주 신고가를 반복한 종목을 추적합니다">
        <div style={{ padding: 16, textAlign: 'center', color: C.dim, fontSize: 13 }}>
          아직 2주 이상 연속 신고가 종목이 없습니다. 리포트가 쌓이면 자동으로 추적됩니다.
        </div>
      </Card>
    );
  }

  // 연속 등장 여부 체크
  const isConsecutive = (apps) => {
    for (let i = 1; i < apps.length; i++) {
      if (apps[i].weekIdx - apps[i - 1].weekIdx > 1) return false;
    }
    return true;
  };

  return (
    <Card title="🔥 연속 신고가 종목 추적" subtitle="2주 이상 52주 신고가를 반복한 종목 — 강한 모멘텀 시그널">
      <div style={{ display: 'grid', gap: 6 }}>
        {recurring.map((s, i) => {
          const consecutive = isConsecutive(s.appearances);
          const latestApp = s.appearances[s.appearances.length - 1];
          const span = latestApp.weekIdx - s.appearances[0].weekIdx + 1;

          return (
            <div key={s.ticker} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.bg, borderRadius: 8, border: `1px solid ${consecutive ? C.green + '44' : C.border}` }}>
              <div style={{ width: 55, textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: consecutive ? C.green : C.accent }}>{s.ticker}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: C.dim, marginBottom: 2 }}>{s.name}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[...s.themes].slice(0, 3).map(t => <Pill key={t} color={C.purple} style={{ fontSize: 9 }}>{t}</Pill>)}
                </div>
              </div>
              {/* 등장 히트맵 */}
              <div style={{ display: 'flex', gap: 2 }}>
                {sorted.map((r, wi) => {
                  const app = s.appearances.find(a => a.weekIdx === wi);
                  return (
                    <div key={wi} title={r.week_end?.slice(5)}
                      style={{ width: 8, height: 20, borderRadius: 2, background: app ? C.green : C.input, opacity: app ? 0.9 : 0.3 }} />
                  );
                })}
              </div>
              <div style={{ textAlign: 'right', width: 80 }}>
                <Pill color={consecutive ? C.green : s.appearances.length >= 3 ? C.accent : C.dim} style={{ fontSize: 9 }}>
                  {consecutive ? `${s.appearances.length}주 연속` : `${s.appearances.length}/${span}주`}
                </Pill>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Breadth 추이 ────────────────────────────────────────────────────
function BreadthTrend({ sorted }) {
  const points = sorted.map(r => ({
    weekEnd: r.week_end,
    weekLabel: r.week_end?.slice(5) || '?',
    sp500H: r.report?.breadth?.sp500NewHighs || 0,
    sp500L: r.report?.breadth?.sp500NewLows || 0,
    nasdaqH: r.report?.breadth?.nasdaqNewHighs || 0,
    nasdaqL: r.report?.breadth?.nasdaqNewLows || 0,
  })).filter(p => p.sp500H > 0 || p.nasdaqH > 0);

  if (points.length < 2) return null;

  const maxVal = Math.max(...points.map(p => Math.max(p.sp500H, p.sp500L, p.nasdaqH, p.nasdaqL)), 1);
  const W = 1050, H = 200;
  const PAD = { top: 20, right: 20, bottom: 35, left: 40 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const getX = (i) => PAD.left + (i / Math.max(1, points.length - 1)) * cW;
  const getY = (v) => PAD.top + cH * (1 - v / maxVal);

  const makePath = (vals) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(v)}`).join(' ');

  return (
    <Card title="🌡️ Breadth 추이" subtitle="S&P 500 52주 신고가/신저가 수의 주간 변화">
      <div style={{ overflowX: 'auto' }}>
        <svg width={W} height={H} style={{ display: 'block' }}>
          {[0, 0.5, 1].map(r => (
            <g key={r}>
              <line x1={PAD.left} y1={PAD.top + cH * (1 - r)} x2={W - PAD.right} y2={PAD.top + cH * (1 - r)} stroke={C.border} strokeWidth={1} />
              <text x={PAD.left - 6} y={PAD.top + cH * (1 - r) + 4} textAnchor="end" fill={C.muted} fontSize={10}>{Math.round(maxVal * r)}</text>
            </g>
          ))}
          {points.map((p, i) => (
            <text key={i} x={getX(i)} y={H - 5} textAnchor="middle" fill={C.muted} fontSize={10}>{p.weekLabel}</text>
          ))}
          {/* S&P 신고가 */}
          <path d={makePath(points.map(p => p.sp500H))} fill="none" stroke={C.green} strokeWidth={2} opacity={0.8} />
          {points.map((p, i) => <circle key={`sh${i}`} cx={getX(i)} cy={getY(p.sp500H)} r={3} fill={C.green} />)}
          {/* S&P 신저가 */}
          <path d={makePath(points.map(p => p.sp500L))} fill="none" stroke={C.red} strokeWidth={2} opacity={0.8} />
          {points.map((p, i) => <circle key={`sl${i}`} cx={getX(i)} cy={getY(p.sp500L)} r={3} fill={C.red} />)}
        </svg>
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: C.green }} />
          <span style={{ fontSize: 11, color: C.green }}>S&P 신고가</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: C.red }} />
          <span style={{ fontSize: 11, color: C.red }}>S&P 신저가</span>
        </div>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// ARCHIVE TAB
// ═══════════════════════════════════════════════════════════════
function ArchiveTab({ reports, currentId, onSelect, onDelete, isAdmin }) {
  if (reports.length === 0) return <Card style={{ textAlign: 'center', padding: 40 }}><div style={{ color: C.dim }}>저장된 리포트 없음</div></Card>;

  // 테마 빈도
  const themeFreq = {};
  reports.forEach(r => (r.report?.themes || []).forEach(t => { themeFreq[t.name] = (themeFreq[t.name] || 0) + 1; }));
  const topThemes = Object.entries(themeFreq).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* 통계 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: '총 리포트', val: reports.length, color: C.accent },
          { label: '총 테마', val: reports.reduce((s, r) => s + (r.report?.themes || []).length, 0), color: C.purple },
          { label: '총 신고가', val: reports.reduce((s, r) => s + (r.report?.themes || []).reduce((ss, t) => ss + (t.stocks?.length || 0), 0), 0), color: C.green },
        ].map(m => (
          <div key={m.label} style={{ padding: '14px 18px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>{m.label}</div>
            <span style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{m.val}</span>
          </div>
        ))}
      </div>

      {/* 테마 추적 */}
      {topThemes.length > 0 && (
        <Card title="🔄 반복 테마 추적" subtitle="2회 이상 등장 = 지속 모멘텀 신호">
          <div style={{ display: 'grid', gap: 6 }}>
            {topThemes.map(([name, freq], i) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: C.bg, borderRadius: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text, flex: 1 }}>{name}</span>
                <div style={{ width: 80, height: 6, background: C.input, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, freq * 25)}%`, height: '100%', background: THEME_COLORS[i % THEME_COLORS.length].text, borderRadius: 3 }} />
                </div>
                <Pill color={freq >= 3 ? C.green : freq >= 2 ? C.accent : C.dim} style={{ fontSize: 9, minWidth: 50, textAlign: 'center' }}>
                  {freq}회{freq >= 3 ? ' 강한' : freq >= 2 ? ' 지속' : ''}
                </Pill>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 목록 */}
      <Card title="📚 전체 리포트">
        <div style={{ display: 'grid', gap: 8 }}>
          {reports.map(r => {
            const themes = r.report?.themes || [];
            const isCur = r.id === currentId;
            return (
              <div key={r.id} onClick={() => onSelect(r)}
                style={{ padding: '12px 16px', background: isCur ? C.accent + '11' : C.bg, borderRadius: 10, cursor: 'pointer', border: `1px solid ${isCur ? C.accent + '44' : C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.accent }}>{r.week_start}~{r.week_end}</span>
                    {isCur && <Pill color={C.green} style={{ fontSize: 9 }}>현재</Pill>}
                  </div>
                  <div style={{ fontSize: 11, color: C.dim, marginBottom: 3 }}>{r.title}</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {themes.slice(0, 3).map((t, j) => <Pill key={j} color={THEME_COLORS[j % THEME_COLORS.length].text} style={{ fontSize: 9 }}>{t.name}</Pill>)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: C.muted }}>{r.created_at ? new Date(r.created_at).toLocaleDateString('ko') : ''}</span>
                  {isAdmin && (
                    <button onClick={e => { e.stopPropagation(); onDelete(r.id); }}
                      style={{ background: 'none', border: `1px solid ${C.red}33`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 10, color: C.red }}>삭제</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
