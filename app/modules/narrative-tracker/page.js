'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';

// ═══════════════════════════════════════════════════════════════════════
// 🐺 NARRATIVE ALPHA TRACKER v3 — AI-Powered + 시계열 추적
// ═══════════════════════════════════════════════════════════════════════

const STAGES = [
  { key: 'birth', label: '탄생', emoji: '🌱', color: '#4ade80', desc: '시장에서 처음 언급' },
  { key: 'strengthen', label: '강화', emoji: '📈', color: '#facc15', desc: '주요 매체/기관 인용' },
  { key: 'peak', label: '절정', emoji: '🔥', color: '#f97316', desc: '모든 참여자 인지' },
  { key: 'weaken', label: '약화', emoji: '📉', color: '#a78bfa', desc: '반론 등장' },
  { key: 'extinct', label: '소멸', emoji: '💀', color: '#6b7280', desc: '영향력 없음' },
];
const STAGE_IDX = { birth: 0, strengthen: 1, peak: 2, weaken: 3, extinct: 4 };
const STAGE_MULT = { birth: 0.4, strengthen: 0.8, peak: 1.0, weaken: 0.5, extinct: 0.1 };
const MOMENTUM = { birth: 1.3, strengthen: 1.15, peak: 1.0, weaken: -0.5, extinct: -0.8 };
const IMPACT_MAP = {
  2: { label: '강한 긍정', color: '#22c55e', symbol: '▲▲' },
  1: { label: '약한 긍정', color: '#86efac', symbol: '▲' },
  0: { label: '중립', color: '#6b7280', symbol: '—' },
  '-1': { label: '약한 부정', color: '#fca5a5', symbol: '▼' },
  '-2': { label: '강한 부정', color: '#ef4444', symbol: '▼▼' },
};
const C = {
  bg: '#0a0e17', card: '#111827', border: '#1e293b',
  accent: '#f59e0b', green: '#22c55e', red: '#ef4444',
  text: '#e2e8f0', dim: '#94a3b8', muted: '#475569',
  input: '#1e293b', inputB: '#334155',
};

const calcScore = (n) => {
  const m = STAGE_MULT[n.stage] || 0.5;
  const { marketImpact = 5, mediaIntensity = 5, dataSupport = 5, duration = 5, connectivity = 0 } = n;
  return Math.round((marketImpact * 0.30 + mediaIntensity * 0.20 + dataSupport * 0.25 + duration * 0.10 + connectivity * 0.15) * 10 * m);
};
const kellyF = (p, b) => b <= 0 ? 0 : Math.max(0, Math.min(1, (p * b - (1 - p)) / b));

// ─── 히스토리 스냅샷 저장 헬퍼 ────────────────────────────────────
const saveSnapshot = async (record) => {
  try {
    const sb = createClient();
    const snapshot = {
      id: `nh_${record.id}_${Date.now()}`,
      narrative_id: record.id,
      name: record.name,
      stage: record.stage,
      score: record.score || 0,
      scoring: typeof record.scoring === 'string' ? record.scoring : JSON.stringify(record.scoring || {}),
      kelly: typeof record.kelly === 'string' ? record.kelly : JSON.stringify(record.kelly || {}),
      assets: typeof record.assets === 'string' ? record.assets : JSON.stringify(record.assets || []),
      indicators: typeof record.indicators === 'string' ? record.indicators : JSON.stringify(record.indicators || []),
      description: record.description || '',
      category: record.category || '',
      snapshot_at: new Date().toISOString(),
    };
    const { error } = await sb.from('narrative_history').insert(snapshot);
    if (error) console.error('히스토리 저장 오류:', error.message);
  } catch (e) {
    console.error('히스토리 저장 실패:', e.message);
  }
};

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════
export default function NarrativeTrackerPage() {
  const [tab, setTab] = useState('dashboard');
  const [narratives, setNarratives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputName, setInputName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [reanalyzing, setReanalyzing] = useState(null);

  // ─── 히스토리 ──────────────────────────────────────────────────────
  const [history, setHistory] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ─── Admin PIN ─────────────────────────────────────────────────────
  const [adminPin, setAdminPin] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('wolfpack_admin_pin');
    if (saved) { setAdminPin(saved); setIsAdmin(true); }
  }, []);

  const verifyPin = async (pin) => {
    try {
      const res = await fetch('/api/narrative-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({ narrativeName: '__pin_check__', existingNarratives: [] }),
      });
      if (res.status === 401) return false;
      return true;
    } catch { return false; }
  };

  const handlePinSubmit = async () => {
    setPinError('');
    const ok = await verifyPin(adminPin);
    if (ok) {
      setIsAdmin(true);
      sessionStorage.setItem('wolfpack_admin_pin', adminPin);
      setShowPinModal(false);
      if (pendingAction) { pendingAction(); setPendingAction(null); }
    } else {
      setPinError('PIN이 일치하지 않습니다');
    }
  };

  const requireAdmin = (action) => {
    if (isAdmin) { action(); return; }
    setPendingAction(() => action);
    setShowPinModal(true);
  };

  const logout = () => {
    setIsAdmin(false);
    setAdminPin('');
    sessionStorage.removeItem('wolfpack_admin_pin');
  };

  // ─── Data ──────────────────────────────────────────────────────────
  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const sb = createClient();
      const { data, error } = await sb.from('narratives').select('*').order('score', { ascending: false });
      if (error) console.error('DB 로드 오류:', error.message);
      if (data) {
        setNarratives(data.map(d => ({
          ...d,
          indicators: typeof d.indicators === 'string' ? JSON.parse(d.indicators) : (d.indicators || []),
          assets: typeof d.assets === 'string' ? JSON.parse(d.assets) : (d.assets || []),
          scoring: typeof d.scoring === 'string' ? JSON.parse(d.scoring) : (d.scoring || {}),
          kelly: typeof d.kelly === 'string' ? JSON.parse(d.kelly) : (d.kelly || {}),
        })));
      }
    } catch (e) { console.log('Load fallback:', e); }
    setLoading(false);
  };

  // ─── 히스토리 로드 ─────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (historyLoaded) return;
    setHistoryLoading(true);
    try {
      const sb = createClient();
      const { data, error } = await sb
        .from('narrative_history')
        .select('*')
        .order('snapshot_at', { ascending: true });
      if (error) {
        console.error('히스토리 로드 오류:', error.message);
      } else if (data) {
        setHistory(data.map(d => ({
          ...d,
          scoring: typeof d.scoring === 'string' ? JSON.parse(d.scoring) : (d.scoring || {}),
          kelly: typeof d.kelly === 'string' ? JSON.parse(d.kelly) : (d.kelly || {}),
          assets: typeof d.assets === 'string' ? JSON.parse(d.assets) : (d.assets || []),
          indicators: typeof d.indicators === 'string' ? JSON.parse(d.indicators) : (d.indicators || []),
        })));
        setHistoryLoaded(true);
      }
    } catch (e) {
      console.error('히스토리 로드 실패:', e.message);
    }
    setHistoryLoading(false);
  }, [historyLoaded]);

  // 타임라인 탭 진입 시 히스토리 로드
  useEffect(() => {
    if (tab === 'timeline') loadHistory();
  }, [tab, loadHistory]);

  // ─── AI (PIN 필요) ─────────────────────────────────────────────────
  const callAI = async (name) => {
    try {
      const res = await fetch('/api/narrative-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': adminPin },
        body: JSON.stringify({ narrativeName: name, existingNarratives: narratives }),
      });
      const data = await res.json();
      if (res.status === 401) { setIsAdmin(false); sessionStorage.removeItem('wolfpack_admin_pin'); alert('인증이 만료되었습니다. 다시 PIN을 입력해주세요.'); return null; }
      if (data.success) return data.analysis;
      alert('AI 분석 실패: ' + (data.error || ''));
    } catch (e) { alert('AI 호출 오류: ' + e.message); }
    return null;
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    const result = await callAI(inputName);
    if (result) setAiResult(result);
    setAnalyzing(false);
  };

  const saveNarrative = async () => {
    if (!aiResult) return;
    const connScore = narratives.filter(n => n.id !== editingId).reduce((acc, n) => {
      const shared = (aiResult.assets || []).filter(a => (n.assets || []).some(na => na.asset === a.asset));
      return acc + (shared.length > 0 ? Math.min(10, shared.length * 2) : 0);
    }, 0);
    const record = {
      id: editingId || `n_${Date.now()}`,
      name: inputName, description: aiResult.description, category: aiResult.category,
      stage: aiResult.stage, stageReasoning: aiResult.stageReasoning || '',
      marketImpact: aiResult.scoring?.marketImpact || 5, mediaIntensity: aiResult.scoring?.mediaIntensity || 5,
      dataSupport: aiResult.scoring?.dataSupport || 5, duration: aiResult.scoring?.duration || 5,
      connectivity: Math.min(10, connScore),
      indicators: JSON.stringify(aiResult.indicators || []), assets: JSON.stringify(aiResult.assets || []),
      scoring: JSON.stringify(aiResult.scoring || {}), kelly: JSON.stringify(aiResult.kelly || {}),
      kellyProb: aiResult.kelly?.prob || 55, kellyOdds: aiResult.kelly?.odds || 2.0,
      updated_at: new Date().toISOString(),
    };
    record.score = calcScore(record);
    try {
      const sb = createClient();
      let result;
      if (editingId) result = await sb.from('narratives').update(record).eq('id', editingId);
      else result = await sb.from('narratives').insert(record);
      if (result.error) { alert('DB 저장 오류: ' + result.error.message); return; }
    } catch (e) { alert('DB 저장 오류: ' + e.message); return; }

    // ─── 히스토리 스냅샷 저장 ───
    await saveSnapshot({
      ...record,
      scoring: aiResult.scoring || {},
      kelly: aiResult.kelly || {},
      assets: aiResult.assets || [],
      indicators: aiResult.indicators || [],
    });
    setHistoryLoaded(false); // 다음 타임라인 탭 진입 시 리로드

    const parsed = { ...record, indicators: aiResult.indicators, assets: aiResult.assets, scoring: aiResult.scoring, kelly: aiResult.kelly };
    if (editingId) setNarratives(p => p.map(n => n.id === editingId ? parsed : n));
    else setNarratives(p => [...p, parsed]);
    setInputName(''); setAiResult(null); setEditingId(null); setTab('dashboard');
  };

  const reanalyze = async (n) => {
    setReanalyzing(n.id);
    const analysis = await callAI(n.name);
    if (analysis) {
      const connectivity = narratives.filter(x => x.id !== n.id).reduce((acc, x) => {
        const shared = (analysis.assets || []).filter(a => (x.assets || []).some(xa => xa.asset === a.asset));
        return acc + (shared.length > 0 ? Math.min(10, shared.length * 2) : 0);
      }, 0);
      const updated = {
        ...n, description: analysis.description, category: analysis.category,
        stage: analysis.stage, stageReasoning: analysis.stageReasoning || '',
        marketImpact: analysis.scoring?.marketImpact || 5, mediaIntensity: analysis.scoring?.mediaIntensity || 5,
        dataSupport: analysis.scoring?.dataSupport || 5, duration: analysis.scoring?.duration || 5,
        connectivity: Math.min(10, connectivity),
        indicators: analysis.indicators || [], assets: analysis.assets || [],
        scoring: analysis.scoring || {}, kelly: analysis.kelly || {},
        kellyProb: analysis.kelly?.prob || 55, kellyOdds: analysis.kelly?.odds || 2.0,
        updated_at: new Date().toISOString(),
      };
      updated.score = calcScore(updated);
      const dbPayload = {
        ...updated,
        indicators: JSON.stringify(updated.indicators),
        assets: JSON.stringify(updated.assets),
        scoring: JSON.stringify(updated.scoring),
        kelly: JSON.stringify(updated.kelly),
      };
      try {
        const sb = createClient();
        const result = await sb.from('narratives').update(dbPayload).eq('id', n.id);
        if (result.error) alert('DB 업데이트 오류: ' + result.error.message);
      } catch (e) { alert('DB 업데이트 오류: ' + e.message); }

      // ─── 히스토리 스냅샷 저장 ───
      await saveSnapshot(updated);
      setHistoryLoaded(false);

      setNarratives(p => p.map(x => x.id === n.id ? updated : x));
    }
    setReanalyzing(null);
  };

  const deleteN = async (id) => {
    try {
      const sb = createClient();
      const result = await sb.from('narratives').delete().eq('id', id);
      if (result.error) { alert('DB 삭제 오류: ' + result.error.message); return; }
      // 히스토리도 삭제
      await sb.from('narrative_history').delete().eq('narrative_id', id);
    } catch (e) { alert('DB 오류: ' + e.message); return; }
    setNarratives(p => p.filter(n => n.id !== id));
    setHistory(p => p.filter(h => h.narrative_id !== id));
  };

  // ─── Computed ──────────────────────────────────────────────────────
  const totalScore = useMemo(() => narratives.reduce((s, n) => s + (n.score || 0), 0), [narratives]);
  const weights = useMemo(() => {
    if (!totalScore) return {};
    const w = {}; narratives.forEach(n => { w[n.id] = (n.score || 0) / totalScore; }); return w;
  }, [narratives, totalScore]);
  const assetMap = useMemo(() => {
    const m = {};
    narratives.forEach(n => {
      const w = weights[n.id] || 0;
      (n.assets || []).forEach(a => {
        if (!m[a.asset]) m[a.asset] = { asset: a.asset, total: 0, sources: [] };
        const momentum = MOMENTUM[n.stage] || 1.0;
        const wi = a.impact * w * momentum * 100;
        m[a.asset].total += wi;
        m[a.asset].sources.push({ name: n.name, impact: a.impact, weight: w, weighted: wi, stage: n.stage, reason: a.reason || '', momentum });
      });
    }); return m;
  }, [narratives, weights]);
  const sortedAssets = useMemo(() => Object.values(assetMap).sort((a, b) => Math.abs(b.total) - Math.abs(a.total)), [assetMap]);

  // ─── 히스토리 그룹핑 ──────────────────────────────────────────────
  const historyByNarrative = useMemo(() => {
    const m = {};
    history.forEach(h => {
      if (!m[h.narrative_id]) m[h.narrative_id] = [];
      m[h.narrative_id].push(h);
    });
    // 각 내러티브별 시간순 정렬 (이미 ascending이지만 안전하게)
    Object.values(m).forEach(arr => arr.sort((a, b) => new Date(a.snapshot_at) - new Date(b.snapshot_at)));
    return m;
  }, [history]);

  // ═══════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Pretendard', -apple-system, 'Noto Sans KR', sans-serif" }}>
      {showPinModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { setShowPinModal(false); setPendingAction(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, width: 360, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔐</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>관리자 인증</div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 20 }}>AI 기능은 관리자만 사용할 수 있습니다</div>
            <input type="password" value={adminPin} onChange={e => setAdminPin(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handlePinSubmit(); }}
              placeholder="관리자 PIN 입력" autoFocus
              style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: `1px solid ${pinError ? C.red : C.inputB}`, background: C.input, color: C.text, fontSize: 15, outline: 'none', textAlign: 'center', letterSpacing: 8, fontWeight: 700, boxSizing: 'border-box' }} />
            {pinError && <div style={{ fontSize: 12, color: C.red, marginTop: 8 }}>{pinError}</div>}
            <button onClick={handlePinSubmit} style={{ marginTop: 16, width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: C.accent, color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>확인</button>
          </div>
        </div>
      )}

      <div style={{ padding: '20px 28px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <a href="/" style={{ color: C.muted, fontSize: 12, textDecoration: 'none', display: 'block', marginBottom: 4 }}>← 컨트롤 타워</a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: C.accent }}>🐺 NARRATIVE ALPHA</span>
            <Pill color={C.green}>LIVE</Pill>
            <Pill color="#818cf8">AI-Powered</Pill>
          </div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>내러티브 이름만 입력 → AI가 분석 · 스코어링 · 자산매핑 · 투자 아이디어 자동 생성</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Pill color={C.green}>{narratives.length}개 내러티브</Pill>
          <Pill color={C.accent}>{Object.keys(assetMap).length}개 자산</Pill>
          {isAdmin ? (
            <button onClick={logout} title="관리자 로그아웃" style={{ background: 'none', border: `1px solid ${C.green}44`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12 }}>🔓</span><span style={{ fontSize: 10, color: C.green, fontWeight: 600 }}>ADMIN</span>
            </button>
          ) : (
            <button onClick={() => setShowPinModal(true)} title="관리자 로그인" style={{ background: 'none', border: `1px solid ${C.muted}44`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12 }}>🔒</span><span style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>GUEST</span>
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 24px 0' }}>
        <div style={{ display: 'flex', gap: 4, background: C.input, borderRadius: 10, padding: 4 }}>
          {[
            { key: 'dashboard', label: '📊 대시보드' },
            { key: 'input', label: '📝 입력' },
            { key: 'timeline', label: '📅 타임라인' },
            { key: 'assets', label: '🎯 자산 영향도' },
            { key: 'ideas', label: '💡 투자 아이디어' },
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
            {tab === 'dashboard' && <Dashboard narratives={narratives} weights={weights} assetMap={assetMap} onReanalyze={(n) => requireAdmin(() => reanalyze(n))} onDelete={(id) => requireAdmin(() => deleteN(id))} reanalyzing={reanalyzing} onGoInput={() => setTab('input')} isAdmin={isAdmin} />}
            {tab === 'input' && <InputTab inputName={inputName} setInputName={setInputName} analyzing={analyzing} aiResult={aiResult} onAnalyze={() => requireAdmin(runAnalysis)} onSave={saveNarrative} onReset={() => { setAiResult(null); setInputName(''); setEditingId(null); }} isAdmin={isAdmin} />}
            {tab === 'timeline' && <TimelineTab narratives={narratives} history={history} historyByNarrative={historyByNarrative} historyLoading={historyLoading} />}
            {tab === 'assets' && <AssetsTab sortedAssets={sortedAssets} />}
            {tab === 'ideas' && <IdeasTab narratives={narratives} weights={weights} sortedAssets={sortedAssets} />}
          </>
        )}
      </div>

      <div style={{ padding: '16px 28px', borderTop: `1px solid ${C.border}`, textAlign: 'center', marginTop: 40 }}>
        <span style={{ fontSize: 11, color: C.muted }}>🐺 늑대무리원정단 · Narrative Alpha Tracker v3 · 투자 결정은 본인의 판단과 책임 하에</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SHARED
// ═══════════════════════════════════════════════════════════════════════
function Pill({ children, color = '#f59e0b', style }) {
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: color + '22', color, border: `1px solid ${color}44`, ...style }}>{children}</span>;
}
function Card({ children, title, subtitle, style }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px', ...style }}>
      {title && <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: subtitle ? 2 : 12 }}>{title}</div>}
      {subtitle && <div style={{ fontSize: 12, color: C.dim, marginBottom: 14 }}>{subtitle}</div>}
      {children}
    </div>
  );
}
function Btn({ children, onClick, primary, small, disabled, danger, style }) {
  return <button onClick={onClick} disabled={disabled} style={{ padding: small ? '6px 14px' : '10px 20px', borderRadius: 8, border: primary ? 'none' : `1px solid ${danger ? C.red + '44' : C.inputB}`, background: primary ? C.accent : 'transparent', color: primary ? '#000' : danger ? C.red : C.text, fontWeight: 600, fontSize: small ? 12 : 13, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, ...style }}>{children}</button>;
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}
function formatDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════════
// TAB: TIMELINE (신규)
// ═══════════════════════════════════════════════════════════════════════
function TimelineTab({ narratives, history, historyByNarrative, historyLoading }) {
  const [selectedId, setSelectedId] = useState(null);

  if (historyLoading) {
    return <Card style={{ textAlign: 'center', padding: 60 }}><div style={{ fontSize: 13, color: C.dim }}>히스토리 로딩 중...</div></Card>;
  }

  if (history.length === 0) {
    return (
      <Card style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>아직 히스토리가 없습니다</div>
        <div style={{ fontSize: 13, color: C.dim }}>내러티브를 저장하거나 재분석하면 자동으로 시계열 데이터가 쌓입니다</div>
      </Card>
    );
  }

  const selected = selectedId ? narratives.find(n => n.id === selectedId) : null;
  const selectedHistory = selectedId ? (historyByNarrative[selectedId] || []) : [];

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* 전체 내러티브 스코어 추이 차트 */}
      <ScoreEvolutionChart history={history} historyByNarrative={historyByNarrative} narratives={narratives} onSelect={setSelectedId} selectedId={selectedId} />

      {/* 전체 내러티브 라이프사이클 변화 */}
      <StageTimelineChart history={history} historyByNarrative={historyByNarrative} narratives={narratives} onSelect={setSelectedId} selectedId={selectedId} />

      {/* 개별 내러티브 상세 히스토리 */}
      {selected && selectedHistory.length > 0 && (
        <NarrativeDetailHistory narrative={selected} history={selectedHistory} onClose={() => setSelectedId(null)} />
      )}

      {/* 시장 내러티브 지형 변화 */}
      <MarketLandscapeTimeline history={history} historyByNarrative={historyByNarrative} narratives={narratives} />
    </div>
  );
}

// ─── 스코어 추이 차트 ────────────────────────────────────────────────
function ScoreEvolutionChart({ history, historyByNarrative, narratives, onSelect, selectedId }) {
  const WIDTH = 1050;
  const HEIGHT = 260;
  const PAD = { top: 30, right: 20, bottom: 40, left: 50 };
  const chartW = WIDTH - PAD.left - PAD.right;
  const chartH = HEIGHT - PAD.top - PAD.bottom;

  // 전체 시간 범위
  const allTimes = history.map(h => new Date(h.snapshot_at).getTime());
  const minT = Math.min(...allTimes);
  const maxT = Math.max(...allTimes);
  const timeRange = maxT - minT || 1;

  // 최대 스코어
  const maxScore = Math.max(...history.map(h => h.score || 0), 10);

  // 색상 팔레트
  const COLORS = ['#f59e0b', '#818cf8', '#22c55e', '#f97316', '#ec4899', '#06b6d4', '#a78bfa', '#84cc16', '#e879f9', '#fbbf24'];
  const narIds = Object.keys(historyByNarrative);

  const getX = (t) => PAD.left + ((t - minT) / timeRange) * chartW;
  const getY = (s) => PAD.top + chartH - (s / maxScore) * chartH;

  // 시간 축 레이블
  const timeLabels = [];
  const labelCount = Math.min(8, Math.max(2, Math.floor(chartW / 100)));
  for (let i = 0; i <= labelCount; i++) {
    const t = minT + (timeRange * i) / labelCount;
    timeLabels.push({ x: getX(t), label: formatDate(new Date(t)) });
  }

  return (
    <Card title="📈 내러티브 스코어 추이" subtitle="각 내러티브의 점수 변화를 시계열로 추적합니다. 내러티브를 클릭하면 상세 히스토리를 볼 수 있습니다.">
      <div style={{ overflowX: 'auto' }}>
        <svg width={WIDTH} height={HEIGHT} style={{ display: 'block' }}>
          {/* 배경 그리드 */}
          {[0, 0.25, 0.5, 0.75, 1].map(r => {
            const y = PAD.top + chartH * (1 - r);
            return (
              <g key={r}>
                <line x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y} stroke={C.border} strokeWidth={1} />
                <text x={PAD.left - 8} y={y + 4} textAnchor="end" fill={C.muted} fontSize={10}>{Math.round(maxScore * r)}</text>
              </g>
            );
          })}
          {/* 시간 축 */}
          {timeLabels.map((tl, i) => (
            <text key={i} x={tl.x} y={HEIGHT - 8} textAnchor="middle" fill={C.muted} fontSize={10}>{tl.label}</text>
          ))}
          {/* 각 내러티브 라인 */}
          {narIds.map((nid, idx) => {
            const pts = historyByNarrative[nid] || [];
            if (pts.length < 1) return null;
            const col = COLORS[idx % COLORS.length];
            const isSelected = selectedId === nid;
            const opacity = selectedId ? (isSelected ? 1 : 0.2) : 0.8;

            // 라인 패스
            const pathD = pts.map((p, i) => {
              const x = getX(new Date(p.snapshot_at).getTime());
              const y = getY(p.score || 0);
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ');

            return (
              <g key={nid} style={{ cursor: 'pointer' }} onClick={() => onSelect(isSelected ? null : nid)} opacity={opacity}>
                <path d={pathD} fill="none" stroke={col} strokeWidth={isSelected ? 3 : 2} strokeLinejoin="round" />
                {pts.map((p, i) => {
                  const x = getX(new Date(p.snapshot_at).getTime());
                  const y = getY(p.score || 0);
                  return <circle key={i} cx={x} cy={y} r={isSelected ? 5 : 3} fill={col} stroke={C.card} strokeWidth={1.5} />;
                })}
                {/* 마지막 포인트에 이름 표시 */}
                {pts.length > 0 && (() => {
                  const last = pts[pts.length - 1];
                  const x = getX(new Date(last.snapshot_at).getTime());
                  const y = getY(last.score || 0);
                  return <text x={Math.min(x + 6, WIDTH - 60)} y={y - 8} fill={col} fontSize={10} fontWeight={600}>{last.name?.slice(0, 10)}</text>;
                })()}
              </g>
            );
          })}
        </svg>
      </div>
      {/* 범례 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
        {narIds.map((nid, idx) => {
          const nar = narratives.find(n => n.id === nid);
          const pts = historyByNarrative[nid] || [];
          const col = COLORS[idx % COLORS.length];
          const isSelected = selectedId === nid;
          return (
            <div key={nid} onClick={() => onSelect(isSelected ? null : nid)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', background: isSelected ? col + '22' : 'transparent', border: `1px solid ${isSelected ? col + '44' : 'transparent'}` }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: col }} />
              <span style={{ fontSize: 11, color: isSelected ? col : C.dim, fontWeight: isSelected ? 700 : 400 }}>
                {nar?.name || pts[0]?.name || nid.slice(0, 8)} ({pts.length}회)
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── 스테이지 타임라인 차트 ──────────────────────────────────────────
function StageTimelineChart({ history, historyByNarrative, narratives, onSelect, selectedId }) {
  const narIds = Object.keys(historyByNarrative);
  if (narIds.length === 0) return null;

  const allTimes = history.map(h => new Date(h.snapshot_at).getTime());
  const minT = Math.min(...allTimes);
  const maxT = Math.max(...allTimes);
  const timeRange = maxT - minT || 1;

  return (
    <Card title="🔄 라이프사이클 변화 추적" subtitle="각 내러티브의 생애주기 단계 변화를 시간순으로 표시합니다">
      <div style={{ display: 'grid', gap: 8 }}>
        {narIds.map(nid => {
          const pts = historyByNarrative[nid] || [];
          const nar = narratives.find(n => n.id === nid);
          const isSelected = selectedId === nid;
          if (pts.length === 0) return null;

          return (
            <div key={nid} onClick={() => onSelect(isSelected ? null : nid)}
              style={{ padding: '12px 16px', background: isSelected ? C.accent + '11' : C.bg, borderRadius: 10, cursor: 'pointer', border: `1px solid ${isSelected ? C.accent + '44' : C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text, flex: 1 }}>{nar?.name || pts[0]?.name}</span>
                <Pill color={STAGES.find(s => s.key === pts[pts.length - 1]?.stage)?.color}>
                  {STAGES.find(s => s.key === pts[pts.length - 1]?.stage)?.emoji} {STAGES.find(s => s.key === pts[pts.length - 1]?.stage)?.label}
                </Pill>
              </div>
              {/* 스테이지 도트 타임라인 */}
              <div style={{ position: 'relative', height: 36, background: C.input, borderRadius: 6, overflow: 'hidden' }}>
                {/* 스테이지 배경 바 */}
                {pts.map((p, i) => {
                  const stage = STAGES.find(s => s.key === p.stage);
                  const x1pct = ((new Date(p.snapshot_at).getTime() - minT) / timeRange) * 100;
                  const x2pct = i < pts.length - 1
                    ? ((new Date(pts[i + 1].snapshot_at).getTime() - minT) / timeRange) * 100
                    : 100;
                  return (
                    <div key={i} style={{
                      position: 'absolute', top: 0, bottom: 0,
                      left: `${x1pct}%`, width: `${Math.max(1, x2pct - x1pct)}%`,
                      background: (stage?.color || '#6b7280') + '33',
                    }} />
                  );
                })}
                {/* 도트 */}
                {pts.map((p, i) => {
                  const stage = STAGES.find(s => s.key === p.stage);
                  const xpct = ((new Date(p.snapshot_at).getTime() - minT) / timeRange) * 100;
                  const stageChanged = i > 0 && pts[i - 1].stage !== p.stage;
                  return (
                    <div key={i} title={`${formatDateTime(p.snapshot_at)} · ${stage?.label} · ${p.score}점`}
                      style={{
                        position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
                        left: `${Math.max(2, Math.min(98, xpct))}%`,
                        width: stageChanged ? 16 : 10, height: stageChanged ? 16 : 10,
                        borderRadius: '50%', background: stage?.color || '#6b7280',
                        border: stageChanged ? `2px solid ${C.text}` : `2px solid ${C.card}`,
                        zIndex: stageChanged ? 2 : 1,
                      }} />
                  );
                })}
              </div>
              {/* 날짜 범위 표시 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 10, color: C.muted }}>{formatDate(pts[0]?.snapshot_at)}</span>
                <span style={{ fontSize: 10, color: C.muted }}>{pts.length}회 기록</span>
                <span style={{ fontSize: 10, color: C.muted }}>{formatDate(pts[pts.length - 1]?.snapshot_at)}</span>
              </div>
            </div>
          );
        })}
      </div>
      {/* 스테이지 범례 */}
      <div style={{ display: 'flex', gap: 12, marginTop: 14, justifyContent: 'center' }}>
        {STAGES.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
            <span style={{ fontSize: 10, color: C.dim }}>{s.emoji} {s.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── 개별 내러티브 상세 히스토리 ─────────────────────────────────────
function NarrativeDetailHistory({ narrative, history, onClose }) {
  if (history.length === 0) return null;

  return (
    <Card title={`📋 ${narrative.name} 상세 변화 기록`} subtitle={`총 ${history.length}회 분석 기록`}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Btn small onClick={onClose}>닫기 ✕</Btn>
      </div>

      {/* 스코어링 세부 추이 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 8, fontWeight: 600 }}>📊 스코어링 변화</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: '8px 6px', textAlign: 'left', color: C.dim, fontWeight: 600 }}>일시</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', color: C.dim, fontWeight: 600 }}>단계</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', color: C.dim, fontWeight: 600 }}>종합</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', color: C.dim, fontWeight: 600 }}>시장충격</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', color: C.dim, fontWeight: 600 }}>미디어</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', color: C.dim, fontWeight: 600 }}>데이터</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', color: C.dim, fontWeight: 600 }}>지속성</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', color: C.dim, fontWeight: 600 }}>승률</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', color: C.dim, fontWeight: 600 }}>보상비</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((h, i) => {
                const prev = i < history.length - 1 ? [...history].reverse()[i + 1] : null;
                const stage = STAGES.find(s => s.key === h.stage);
                const stageChanged = prev && prev.stage !== h.stage;
                const scoreChanged = prev && prev.score !== h.score;
                const scoreDiff = prev ? h.score - prev.score : 0;

                return (
                  <tr key={h.id} style={{ borderBottom: `1px solid ${C.border}`, background: stageChanged ? stage?.color + '11' : 'transparent' }}>
                    <td style={{ padding: '8px 6px', color: C.text, whiteSpace: 'nowrap' }}>{formatDateTime(h.snapshot_at)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                      <span style={{ color: stage?.color, fontWeight: 700 }}>
                        {stage?.emoji} {stage?.label}
                        {stageChanged && <span style={{ fontSize: 10, marginLeft: 4 }}>⚡</span>}
                      </span>
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 800, color: C.accent }}>{h.score}</span>
                      {scoreChanged && scoreDiff !== 0 && (
                        <span style={{ fontSize: 10, color: scoreDiff > 0 ? C.green : C.red, marginLeft: 4 }}>
                          {scoreDiff > 0 ? '▲' : '▼'}{Math.abs(scoreDiff)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', color: C.text }}>{h.scoring?.marketImpact || '-'}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', color: C.text }}>{h.scoring?.mediaIntensity || '-'}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', color: C.text }}>{h.scoring?.dataSupport || '-'}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', color: C.text }}>{h.scoring?.duration || '-'}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', color: C.text }}>{h.kelly?.prob || '-'}%</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', color: C.text }}>{h.kelly?.odds || '-'}x</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 자산 영향 변화 */}
      <div>
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 8, fontWeight: 600 }}>🎯 자산 영향 변화</div>
        <AssetImpactDiff history={history} />
      </div>
    </Card>
  );
}

// ─── 자산 영향 변화 비교 ─────────────────────────────────────────────
function AssetImpactDiff({ history }) {
  if (history.length < 2) {
    return <div style={{ fontSize: 12, color: C.muted, padding: 10 }}>2회 이상 기록이 쌓이면 자산 영향 변화를 추적합니다</div>;
  }

  const first = history[0];
  const last = history[history.length - 1];
  const firstAssets = (first.assets || []).reduce((m, a) => { m[a.asset] = a.impact; return m; }, {});
  const lastAssets = (last.assets || []).reduce((m, a) => { m[a.asset] = a.impact; return m; }, {});

  const allAssetNames = [...new Set([...Object.keys(firstAssets), ...Object.keys(lastAssets)])];

  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {allAssetNames.map(name => {
        const before = firstAssets[name];
        const after = lastAssets[name];
        const impBefore = before !== undefined ? IMPACT_MAP[before] || IMPACT_MAP[0] : null;
        const impAfter = after !== undefined ? IMPACT_MAP[after] || IMPACT_MAP[0] : null;
        const changed = before !== after;

        return (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: changed ? C.accent + '11' : C.bg, borderRadius: 6, border: `1px solid ${changed ? C.accent + '33' : C.border}` }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text, flex: 1 }}>{name}</span>
            {impBefore ? (
              <span style={{ fontSize: 11, color: impBefore.color, fontWeight: 600 }}>{impBefore.symbol}</span>
            ) : (
              <span style={{ fontSize: 11, color: C.muted }}>—</span>
            )}
            <span style={{ fontSize: 11, color: C.muted }}>→</span>
            {impAfter ? (
              <span style={{ fontSize: 11, color: impAfter.color, fontWeight: 600 }}>{impAfter.symbol}</span>
            ) : (
              <span style={{ fontSize: 11, color: C.muted }}>제거됨</span>
            )}
            {changed && <span style={{ fontSize: 10, color: C.accent }}>⚡</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── 시장 내러티브 지형 변화 ─────────────────────────────────────────
function MarketLandscapeTimeline({ history, historyByNarrative, narratives }) {
  // 날짜별로 그룹핑 — 같은 날의 스냅샷을 하나의 "시점"으로 묶음
  const dateMap = {};
  history.forEach(h => {
    const dateKey = new Date(h.snapshot_at).toISOString().split('T')[0];
    if (!dateMap[dateKey]) dateMap[dateKey] = {};
    // 같은 날 같은 내러티브의 가장 최신 스냅샷 사용
    const existing = dateMap[dateKey][h.narrative_id];
    if (!existing || new Date(h.snapshot_at) > new Date(existing.snapshot_at)) {
      dateMap[dateKey][h.narrative_id] = h;
    }
  });

  const dates = Object.keys(dateMap).sort();
  if (dates.length === 0) return null;

  // 각 날짜에서의 "주도 내러티브" = 점수 기준 Top 3
  const snapshots = dates.map(date => {
    const items = Object.values(dateMap[date]);
    const sorted = items.sort((a, b) => (b.score || 0) - (a.score || 0));
    return { date, items: sorted, top: sorted.slice(0, 3) };
  });

  return (
    <Card title="🗺️ 시장 내러티브 지형 변화" subtitle="날짜별 주도 내러티브와 전체 구성 변화를 추적합니다">
      <div style={{ display: 'grid', gap: 12 }}>
        {snapshots.map((snap, si) => {
          const prevSnap = si > 0 ? snapshots[si - 1] : null;
          // 새로 등장한 내러티브
          const prevIds = prevSnap ? prevSnap.items.map(i => i.narrative_id) : [];
          const newIds = snap.items.filter(i => !prevIds.includes(i.narrative_id)).map(i => i.narrative_id);
          // 스테이지 변화
          const stageChanges = snap.items.filter(item => {
            if (!prevSnap) return false;
            const prevItem = prevSnap.items.find(p => p.narrative_id === item.narrative_id);
            return prevItem && prevItem.stage !== item.stage;
          });
          const totalScore = snap.items.reduce((s, i) => s + (i.score || 0), 0);

          return (
            <div key={snap.date} style={{ padding: '14px 18px', background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.accent }}>{snap.date}</span>
                  <Pill color={C.dim}>{snap.items.length}개 내러티브</Pill>
                  {newIds.length > 0 && <Pill color={C.green}>+{newIds.length} 신규</Pill>}
                  {stageChanges.length > 0 && <Pill color="#818cf8">{stageChanges.length}개 단계변화</Pill>}
                </div>
                <span style={{ fontSize: 11, color: C.muted }}>합산 {totalScore}점</span>
              </div>
              {/* Top 3 주도 내러티브 */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {snap.top.map((item, i) => {
                  const stage = STAGES.find(s => s.key === item.stage);
                  const pct = totalScore > 0 ? ((item.score || 0) / totalScore * 100).toFixed(0) : 0;
                  const isNew = newIds.includes(item.narrative_id);
                  const stageChange = stageChanges.find(sc => sc.narrative_id === item.narrative_id);
                  const prevStage = stageChange && prevSnap ? STAGES.find(s => s.key === prevSnap.items.find(p => p.narrative_id === item.narrative_id)?.stage) : null;

                  return (
                    <div key={item.narrative_id} style={{
                      flex: '1 1 30%', padding: '10px 14px', borderRadius: 8,
                      background: C.card, border: `1px solid ${i === 0 ? C.accent + '44' : C.border}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: i === 0 ? C.accent : C.muted }}>#{i + 1}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{item.name}</span>
                        {isNew && <span style={{ fontSize: 10, color: C.green, fontWeight: 600 }}>NEW</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: C.accent }}>{item.score}</span>
                        <span style={{ fontSize: 10, color: C.muted }}>({pct}%)</span>
                        {stageChange && prevStage ? (
                          <span style={{ fontSize: 10 }}>
                            <span style={{ color: prevStage.color }}>{prevStage.emoji}</span>
                            <span style={{ color: C.muted }}> → </span>
                            <span style={{ color: stage?.color }}>{stage?.emoji}</span>
                          </span>
                        ) : (
                          <Pill color={stage?.color} style={{ fontSize: 9 }}>{stage?.emoji} {stage?.label}</Pill>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* 스테이지 변화 알림 */}
              {stageChanges.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {stageChanges.map(sc => {
                    const prevItem = prevSnap?.items.find(p => p.narrative_id === sc.narrative_id);
                    const from = STAGES.find(s => s.key === prevItem?.stage);
                    const to = STAGES.find(s => s.key === sc.stage);
                    return (
                      <div key={sc.narrative_id} style={{ fontSize: 11, color: C.dim, padding: '3px 8px', background: C.card, borderRadius: 4 }}>
                        ⚡ {sc.name}: <span style={{ color: from?.color }}>{from?.label}</span> → <span style={{ color: to?.color }}>{to?.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB: INPUT
// ═══════════════════════════════════════════════════════════════════════
function InputTab({ inputName, setInputName, analyzing, aiResult, onAnalyze, onSave, onReset, isAdmin }) {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <Card title="🐺 내러티브 입력" subtitle="이름만 입력하세요. AI가 나머지를 전부 분석합니다.">
        <div style={{ display: 'flex', gap: 12 }}>
          <input value={inputName} onChange={e => setInputName(e.target.value)}
            placeholder="예: 미중 관세전쟁 격화, AI 버블론, BOJ 금리인상, 유럽 재무장..."
            onKeyDown={e => { if (e.key === 'Enter' && inputName.trim() && !analyzing) onAnalyze(); }}
            style={{ flex: 1, padding: '14px 18px', borderRadius: 10, border: `1px solid ${C.inputB}`, background: C.input, color: C.text, fontSize: 15, outline: 'none', fontWeight: 600 }} />
          <button onClick={onAnalyze} disabled={!inputName.trim() || analyzing}
            style={{
              padding: '14px 28px', borderRadius: 10, border: 'none',
              background: analyzing ? '#374151' : `linear-gradient(135deg, ${C.accent}, #f97316)`,
              color: analyzing ? C.dim : '#000', fontWeight: 700, fontSize: 14,
              cursor: (!inputName.trim() || analyzing) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', minWidth: 140,
            }}>
            {analyzing ? '🔄 분석 중...' : isAdmin ? '🤖 AI 분석' : '🔐 AI 분석'}
          </button>
        </div>
        {!isAdmin && !analyzing && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: C.bg, borderRadius: 8, fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
            🔒 AI 분석은 관리자 인증이 필요합니다. 오른쪽 위 자물쇠 버튼으로 로그인하세요.
          </div>
        )}
        {analyzing && (
          <div style={{ marginTop: 16, padding: 16, background: C.bg, borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🧠</div>
            <div style={{ fontSize: 13, color: C.accent, fontWeight: 600 }}>AI가 내러티브를 분석하고 있습니다...</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>설명 · 라이프사이클 · 핵심지표 · 스코어링 · 자산매핑 · 켈리 파라미터</div>
          </div>
        )}
      </Card>

      {aiResult && (
        <>
          <Card title="✅ AI 분석 결과" subtitle="검토 후 저장하세요">
            <div style={{ padding: 14, background: C.bg, borderRadius: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>📝 설명</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{aiResult.description}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div style={{ padding: 14, background: C.bg, borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>🔄 라이프사이클</div>
                {(() => { const s = STAGES.find(x => x.key === aiResult.stage); return (<div><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 24 }}>{s?.emoji}</span><span style={{ fontSize: 18, fontWeight: 800, color: s?.color }}>{s?.label}</span></div><div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>{aiResult.stageReasoning}</div></div>); })()}
              </div>
              <div style={{ padding: 14, background: C.bg, borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>📂 카테고리</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#818cf8' }}>{aiResult.category}</div>
              </div>
            </div>
            <div style={{ padding: 14, background: C.bg, borderRadius: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>📊 스코어링</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[{ key: 'marketImpact', label: '시장 충격도', weight: '30%' }, { key: 'mediaIntensity', label: '미디어 강도', weight: '20%' }, { key: 'dataSupport', label: '데이터 뒷받침', weight: '25%' }, { key: 'duration', label: '지속 기간', weight: '10%' }].map(item => (
                  <div key={item.key} style={{ padding: 10, background: C.card, borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: C.dim }}>{item.label} ({item.weight})</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.accent }}>{aiResult.scoring?.[item.key]}/10</span>
                    </div>
                    <div style={{ height: 4, background: C.input, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${(aiResult.scoring?.[item.key] || 0) * 10}%`, height: '100%', background: C.accent, borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{aiResult.scoring?.[`${item.key}Reason`]}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: 14, background: C.bg, borderRadius: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>🔬 핵심 추적 지표</div>
              {(aiResult.indicators || []).map((ind, i) => {
                const sc = ind.currentSignal === 'positive' ? C.green : ind.currentSignal === 'negative' ? C.red : C.muted;
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < aiResult.indicators.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center' }}>
                    <span style={{ width: 20, fontSize: 12, color: C.muted, textAlign: 'right' }}>{i + 1}.</span>
                    <div style={{ flex: 1 }}><span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{ind.name}</span><div style={{ fontSize: 11, color: C.dim, marginTop: 1 }}>{ind.description}</div></div>
                    <Pill color={sc} style={{ fontSize: 10 }}>{ind.currentSignal === 'positive' ? '긍정' : ind.currentSignal === 'negative' ? '부정' : '중립'}</Pill>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: 14, background: C.bg, borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>🎯 영향 자산 Top 5</div>
              {(aiResult.assets || []).map((a, i) => {
                const imp = IMPACT_MAP[a.impact] || IMPACT_MAP[0];
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < aiResult.assets.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: imp.color }}>{imp.symbol}</span>
                    <div style={{ flex: 1 }}><span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{a.asset}</span><div style={{ fontSize: 11, color: C.dim, marginTop: 1 }}>{a.reason}</div></div>
                    <Pill color={imp.color}>{imp.label}</Pill>
                  </div>
                );
              })}
            </div>
          </Card>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Btn onClick={onReset}>초기화</Btn>
            <Btn onClick={() => { setAiResult(null); }} style={{ borderColor: C.accent + '44', color: C.accent }}>🔄 다시 분석</Btn>
            <Btn primary onClick={onSave}>💾 저장하기</Btn>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB: DASHBOARD
// ═══════════════════════════════════════════════════════════════════════
function Dashboard({ narratives, weights, assetMap, onReanalyze, onDelete, reanalyzing, onGoInput, isAdmin }) {
  if (narratives.length === 0) return (
    <Card style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📡</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>등록된 내러티브가 없습니다</div>
      <Btn primary onClick={onGoInput}>첫 내러티브 등록하기</Btn>
    </Card>
  );
  const sorted = [...narratives].sort((a, b) => (b.score || 0) - (a.score || 0));
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: '추적 중', val: narratives.length, unit: '개', color: C.accent },
          { label: '평균 강도', val: Math.round(narratives.reduce((s, n) => s + (n.score || 0), 0) / narratives.length), unit: '점', color: '#818cf8' },
          { label: '영향 자산', val: Object.keys(assetMap).length, unit: '개', color: C.green },
          { label: '절정 단계', val: narratives.filter(n => n.stage === 'peak').length, unit: '개', color: '#f97316' },
        ].map(m => (
          <div key={m.label} style={{ padding: '16px 20px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>{m.label}</div>
            <span style={{ fontSize: 28, fontWeight: 800, color: m.color }}>{m.val}</span>
            <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>{m.unit}</span>
          </div>
        ))}
      </div>
      <Card title="🔄 라이프사이클 분포">
        <div style={{ display: 'grid', gap: 8 }}>
          {STAGES.map(s => {
            const cnt = narratives.filter(n => n.stage === s.key).length;
            const pct = (cnt / narratives.length) * 100;
            return (<div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 18 }}>{s.emoji}</span><span style={{ fontSize: 12, color: C.dim, width: 36 }}>{s.label}</span><div style={{ flex: 1, height: 8, background: C.input, borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: s.color, borderRadius: 4 }} /></div><span style={{ fontSize: 12, fontWeight: 700, color: s.color, width: 20, textAlign: 'right' }}>{cnt}</span></div>);
          })}
        </div>
      </Card>
      <Card title="📋 내러티브 스코어보드" subtitle={isAdmin ? "🔓 관리자 모드 · 재분석/삭제 가능" : "🔒 읽기 전용 · 관리자 인증 시 편집 가능"}>
        <div style={{ display: 'grid', gap: 10 }}>
          {sorted.map((n, i) => {
            const stage = STAGES.find(s => s.key === n.stage);
            const w = weights[n.id] || 0;
            const isR = reanalyzing === n.id;
            return (
              <div key={n.id} style={{ padding: '16px 20px', background: C.bg, borderRadius: 10, border: `1px solid ${i === 0 ? C.accent + '66' : C.border}`, opacity: isR ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: i === 0 ? C.accent : C.muted }}>#{i + 1}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{n.name}</span>
                    <Pill color={stage?.color}>{stage?.emoji} {stage?.label}</Pill>
                    <Pill color="#818cf8">{n.category}</Pill>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 26, fontWeight: 900, color: C.accent }}>{n.score}</span><span style={{ fontSize: 11, color: C.muted }}>점</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: C.dim, marginBottom: 8, lineHeight: 1.5 }}>{n.description}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {(n.assets || []).map((a, j) => { const imp = IMPACT_MAP[a.impact] || IMPACT_MAP[0]; return <Pill key={j} color={imp.color}>{imp.symbol} {a.asset}</Pill>; })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: C.muted }}>비중 {(w * 100).toFixed(1)}% · {n.updated_at ? new Date(n.updated_at).toLocaleDateString('ko') : ''}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn small onClick={() => onReanalyze(n)} disabled={isR}>{isR ? '분석중...' : '🔄 재분석'}</Btn>
                    <Btn small danger onClick={() => onDelete(n.id)}>삭제</Btn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB: ASSETS
// ═══════════════════════════════════════════════════════════════════════
function AssetsTab({ sortedAssets }) {
  if (sortedAssets.length === 0) return <Card style={{ textAlign: 'center', padding: 40 }}><div style={{ fontSize: 13, color: C.dim }}>내러티브를 등록하면 자산 영향도가 자동 분석됩니다</div></Card>;
  const pos = sortedAssets.filter(a => a.total > 0);
  const neg = sortedAssets.filter(a => a.total < 0);
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Card title="🟢 긍정 영향 자산">{pos.length === 0 ? <div style={{ fontSize: 12, color: C.dim }}>해당 없음</div> : pos.slice(0, 10).map((a, i) => <AssetRow key={a.asset} a={a} i={i} positive />)}</Card>
        <Card title="🔴 부정 영향 자산">{neg.length === 0 ? <div style={{ fontSize: 12, color: C.dim }}>해당 없음</div> : neg.slice(0, 10).map((a, i) => <AssetRow key={a.asset} a={a} i={i} />)}</Card>
      </div>
      <Card title="📊 전체 자산 영향도">
        <div style={{ display: 'grid', gap: 4 }}>
          {sortedAssets.map(a => {
            const maxAbs = Math.max(...sortedAssets.map(x => Math.abs(x.total)), 1);
            const pct = (Math.abs(a.total) / maxAbs) * 100; const isPos = a.total >= 0;
            return (<div key={a.asset} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 60px', alignItems: 'center', gap: 8, padding: '3px 0' }}><span style={{ fontSize: 11, color: C.dim, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.asset}</span><div style={{ height: 14, background: C.input, borderRadius: 3, overflow: 'hidden', position: 'relative' }}><div style={{ position: 'absolute', [isPos ? 'left' : 'right']: 0, top: 0, bottom: 0, width: `${Math.max(2, pct)}%`, background: isPos ? C.green : C.red, borderRadius: 3 }} /></div><span style={{ fontSize: 11, fontWeight: 700, color: isPos ? C.green : C.red, textAlign: 'right' }}>{isPos ? '+' : ''}{a.total.toFixed(1)}</span></div>);
          })}
        </div>
      </Card>
      <Card title="🔎 자산별 소스 분해">
        <div style={{ display: 'grid', gap: 8 }}>
          {sortedAssets.slice(0, 15).map(a => (
            <details key={a.asset} style={{ background: C.bg, borderRadius: 8, padding: '10px 14px' }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', justifyContent: 'space-between' }}><span>{a.asset}</span><span style={{ color: a.total >= 0 ? C.green : C.red, fontWeight: 800 }}>{a.total >= 0 ? '+' : ''}{a.total.toFixed(1)}</span></summary>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                {a.sources.map((s, i) => (<div key={i} style={{ padding: '4px 0', fontSize: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', color: C.dim }}><span>{s.name} <Pill color={STAGES.find(x => x.key === s.stage)?.color}>{STAGES.find(x => x.key === s.stage)?.label}</Pill></span><span>영향 {s.impact > 0 ? '+' : ''}{s.impact} × 비중 {(s.weight * 100).toFixed(1)}% = <b style={{ color: s.weighted >= 0 ? C.green : C.red }}>{s.weighted >= 0 ? '+' : ''}{s.weighted.toFixed(1)}</b></span></div>{s.reason && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>→ {s.reason}</div>}</div>))}
              </div>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
function AssetRow({ a, i, positive }) {
  const col = positive ? C.green : C.red;
  return (<div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}><span style={{ fontSize: 12, fontWeight: 800, color: col, width: 20 }}>{i + 1}</span><span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.text }}>{a.asset}</span><div style={{ width: 80, height: 6, background: C.input, borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, Math.abs(a.total) * 2)}%`, height: '100%', background: col, borderRadius: 3 }} /></div><span style={{ fontSize: 12, fontWeight: 700, color: col, width: 50, textAlign: 'right' }}>{positive ? '+' : ''}{a.total.toFixed(1)}</span></div>);
}

// ═══════════════════════════════════════════════════════════════════════
// TAB: IDEAS
// ═══════════════════════════════════════════════════════════════════════
function IdeasTab({ narratives, weights, sortedAssets }) {
  const active = narratives.filter(n => n.stage !== 'extinct');
  if (active.length === 0) return <Card style={{ textAlign: 'center', padding: 40 }}><div style={{ fontSize: 13, color: C.dim }}>활성 내러티브를 등록하세요</div></Card>;
  const stageAction = { birth: '🔍 소규모 관찰 포지션 진입 고려', strengthen: '📈 확신 시 포지션 확대', peak: '⚖️ 기존 포지션 유지 또는 일부 익절', weaken: '📉 포지션 축소 / 반대 포지션 탐색' };
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <Card title="💡 내러티브 기반 투자 아이디어" subtitle="AI 자동 분석 · 라이프사이클 + 켈리 + 가중 영향도">
        {active.sort((a, b) => (b.score || 0) - (a.score || 0)).map(n => {
          const stage = STAGES.find(s => s.key === n.stage);
          const kelly = n.kelly || {};
          const k = kellyF((kelly.prob || 55) / 100, kelly.odds || 2);
          const topA = (n.assets || []).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 5);
          return (
            <div key={n.id} style={{ padding: 20, background: C.bg, borderRadius: 12, marginBottom: 12, border: `1px solid ${stage?.color}33` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{n.name}</span><Pill color={stage?.color}>{stage?.emoji} {stage?.label}</Pill></div><div style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>→ {stageAction[n.stage] || ''}</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, color: C.dim }}>점수</div><div style={{ fontSize: 22, fontWeight: 900, color: C.accent }}>{n.score}</div></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>주요 영향 자산</div>
                  {topA.map((a, i) => { const imp = IMPACT_MAP[a.impact] || IMPACT_MAP[0]; return (<div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: C.text }}><span>{a.asset}</span><span style={{ color: imp.color, fontWeight: 600 }}>{imp.symbol} {imp.label}</span></div>); })}
                  {topA[0]?.reason && <div style={{ fontSize: 10, color: C.muted, marginTop: 4, fontStyle: 'italic' }}>→ {topA[0].reason}</div>}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>🎰 켈리 공식 (AI 추정)</div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>승률 {kelly.prob || 55}% · 보상비 {kelly.odds || 2}x</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {[{ label: '풀 켈리', val: k, color: C.red, note: '이론적 최적' }, { label: '하프 켈리', val: k / 2, color: C.accent, note: '실전 권장' }, { label: '쿼터 켈리', val: k / 4, color: C.green, note: '보수적' }].map(x => (
                      <div key={x.label} style={{ padding: 8, background: C.card, borderRadius: 6, textAlign: 'center' }}><div style={{ fontSize: 10, color: C.dim }}>{x.label}</div><div style={{ fontSize: 16, fontWeight: 800, color: x.color }}>{(x.val * 100).toFixed(1)}%</div><div style={{ fontSize: 9, color: C.muted }}>{x.note}</div></div>
                    ))}
                  </div>
                  {kelly.reasoning && <div style={{ fontSize: 10, color: C.muted, marginTop: 6, fontStyle: 'italic' }}>AI: {kelly.reasoning}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </Card>
      <Card title="🗺️ 종합 자산 배분 시그널" subtitle="모든 활성 내러티브 가중 합산">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {sortedAssets.slice(0, 12).map(a => {
            const intensity = Math.min(1, Math.abs(a.total) / 50); const isPos = a.total >= 0;
            return (<div key={a.asset} style={{ padding: '14px 16px', borderRadius: 10, background: isPos ? `rgba(34,197,94,${intensity * 0.25})` : `rgba(239,68,68,${intensity * 0.25})`, border: `1px solid ${isPos ? `rgba(34,197,94,${intensity * 0.5})` : `rgba(239,68,68,${intensity * 0.5})`}` }}><div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{a.asset}</div><div style={{ fontSize: 20, fontWeight: 900, color: isPos ? C.green : C.red }}>{isPos ? '▲' : '▼'} {Math.abs(a.total).toFixed(1)}</div><div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{a.sources.length}개 내러티브</div></div>);
          })}
        </div>
      </Card>
    </div>
  );
}
