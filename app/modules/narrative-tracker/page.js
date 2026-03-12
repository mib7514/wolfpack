'use client';

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

// ═══════════════════════════════════════════════════════════════════════
// 🐺 NARRATIVE ALPHA TRACKER v2 — AI-Powered
// 내러티브 이름만 입력하면 AI가 전부 분석
// ═══════════════════════════════════════════════════════════════════════

const STAGES = [
  { key: 'birth', label: '탄생', emoji: '🌱', color: '#4ade80', desc: '시장에서 처음 언급' },
  { key: 'strengthen', label: '강화', emoji: '📈', color: '#facc15', desc: '주요 매체/기관 인용' },
  { key: 'peak', label: '절정', emoji: '🔥', color: '#f97316', desc: '모든 참여자 인지' },
  { key: 'weaken', label: '약화', emoji: '📉', color: '#a78bfa', desc: '반론 등장' },
  { key: 'extinct', label: '소멸', emoji: '💀', color: '#6b7280', desc: '영향력 없음' },
];

const STAGE_MULT = { birth: 0.4, strengthen: 0.8, peak: 1.0, weaken: 0.5, extinct: 0.1 };

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

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════
export default function NarrativeTrackerPage() {
  const [tab, setTab] = useState('dashboard');
  const [narratives, setNarratives] = useState([]);
  const [loading, setLoading] = useState(true);

  // Input state
  const [inputName, setInputName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [editingId, setEditingId] = useState(null);

  // Reanalyze state
  const [reanalyzing, setReanalyzing] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const sb = createClient();
      const { data } = await sb.from('narratives').select('*').order('score', { ascending: false });
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

  // ─── AI Analysis ───────────────────────────────────────────────────
  const runAI = async (name, isReanalyze = false) => {
    if (isReanalyze) setReanalyzing(name);
    else setAnalyzing(true);

    try {
      const res = await fetch('/api/narrative-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ narrativeName: name, existingNarratives: narratives }),
      });
      const data = await res.json();
      if (data.success) {
        if (isReanalyze) return data.analysis;
        setAiResult(data.analysis);
      } else {
        alert('AI 분석 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (e) {
      alert('AI 호출 오류: ' + e.message);
    }
    if (isReanalyze) setReanalyzing(null);
    else setAnalyzing(false);
    return null;
  };

  // ─── Save ──────────────────────────────────────────────────────────
  const saveNarrative = async () => {
    if (!aiResult) return;
    const connScore = narratives.filter(n => n.id !== editingId).reduce((acc, n) => {
      const shared = (aiResult.assets || []).filter(a => (n.assets || []).some(na => na.asset === a.asset));
      return acc + (shared.length > 0 ? Math.min(10, shared.length * 2) : 0);
    }, 0);
    const connectivity = Math.min(10, connScore);

    const record = {
      id: editingId || `n_${Date.now()}`,
      name: inputName,
      description: aiResult.description,
      category: aiResult.category,
      stage: aiResult.stage,
      stageReasoning: aiResult.stageReasoning || '',
      marketImpact: aiResult.scoring?.marketImpact || 5,
      mediaIntensity: aiResult.scoring?.mediaIntensity || 5,
      dataSupport: aiResult.scoring?.dataSupport || 5,
      duration: aiResult.scoring?.duration || 5,
      connectivity,
      indicators: JSON.stringify(aiResult.indicators || []),
      assets: JSON.stringify(aiResult.assets || []),
      scoring: JSON.stringify(aiResult.scoring || {}),
      kelly: JSON.stringify(aiResult.kelly || {}),
      kellyProb: aiResult.kelly?.prob || 55,
      kellyOdds: aiResult.kelly?.odds || 2.0,
      updated_at: new Date().toISOString(),
    };
    record.score = calcScore(record);

    try {
      const sb = createClient();
      if (editingId) {
        await sb.from('narratives').update(record).eq('id', editingId);
      } else {
        await sb.from('narratives').insert(record);
      }
    } catch (e) { console.log('DB save skipped:', e); }

    if (editingId) {
      setNarratives(p => p.map(n => n.id === editingId ? { ...record, indicators: aiResult.indicators, assets: aiResult.assets, scoring: aiResult.scoring, kelly: aiResult.kelly } : n));
    } else {
      setNarratives(p => [...p, { ...record, indicators: aiResult.indicators, assets: aiResult.assets, scoring: aiResult.scoring, kelly: aiResult.kelly }]);
    }
    setInputName('');
    setAiResult(null);
    setEditingId(null);
    setTab('dashboard');
  };

  const reanalyze = async (n) => {
    setReanalyzing(n.id);
    const analysis = await runAI(n.name, true);
    if (analysis) {
      const connectivity = narratives.filter(x => x.id !== n.id).reduce((acc, x) => {
        const shared = (analysis.assets || []).filter(a => (x.assets || []).some(xa => xa.asset === a.asset));
        return acc + (shared.length > 0 ? Math.min(10, shared.length * 2) : 0);
      }, 0);
      const updated = {
        ...n,
        description: analysis.description,
        category: analysis.category,
        stage: analysis.stage,
        stageReasoning: analysis.stageReasoning || '',
        marketImpact: analysis.scoring?.marketImpact || 5,
        mediaIntensity: analysis.scoring?.mediaIntensity || 5,
        dataSupport: analysis.scoring?.dataSupport || 5,
        duration: analysis.scoring?.duration || 5,
        connectivity: Math.min(10, connectivity),
        indicators: analysis.indicators || [],
        assets: analysis.assets || [],
        scoring: analysis.scoring || {},
        kelly: analysis.kelly || {},
        kellyProb: analysis.kelly?.prob || 55,
        kellyOdds: analysis.kelly?.odds || 2.0,
        updated_at: new Date().toISOString(),
      };
      updated.score = calcScore(updated);

      try {
        const sb = createClient();
        await sb.from('narratives').update({
          ...updated,
          indicators: JSON.stringify(updated.indicators),
          assets: JSON.stringify(updated.assets),
          scoring: JSON.stringify(updated.scoring),
          kelly: JSON.stringify(updated.kelly),
        }).eq('id', n.id);
      } catch (e) { console.log('Update skipped:', e); }

      setNarratives(p => p.map(x => x.id === n.id ? updated : x));
    }
    setReanalyzing(null);
  };

  const deleteN = async (id) => {
    try { const sb = createClient(); await sb.from('narratives').delete().eq('id', id); } catch (e) {}
    setNarratives(p => p.filter(n => n.id !== id));
  };

  // ─── Computed ──────────────────────────────────────────────────────
  const totalScore = useMemo(() => narratives.reduce((s, n) => s + (n.score || 0), 0), [narratives]);
  const weights = useMemo(() => {
    if (!totalScore) return {};
    const w = {};
    narratives.forEach(n => { w[n.id] = (n.score || 0) / totalScore; });
    return w;
  }, [narratives, totalScore]);

  const assetMap = useMemo(() => {
    const m = {};
    narratives.forEach(n => {
      const w = weights[n.id] || 0;
      (n.assets || []).forEach(a => {
        if (!m[a.asset]) m[a.asset] = { asset: a.asset, total: 0, sources: [] };
        const wi = a.impact * w * 100;
        m[a.asset].total += wi;
        m[a.asset].sources.push({ name: n.name, impact: a.impact, weight: w, weighted: wi, stage: n.stage, reason: a.reason || '' });
      });
    });
    return m;
  }, [narratives, weights]);

  const sortedAssets = useMemo(() =>
    Object.values(assetMap).sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
  [assetMap]);

  // ═══════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Pretendard', -apple-system, 'Noto Sans KR', sans-serif" }}>
      {/* Header */}
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
        <div style={{ display: 'flex', gap: 8 }}>
          <Pill color={C.green}>{narratives.length}개 내러티브</Pill>
          <Pill color={C.accent}>{Object.keys(assetMap).length}개 자산</Pill>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 24px 0' }}>
        <div style={{ display: 'flex', gap: 4, background: C.input, borderRadius: 10, padding: 4 }}>
          {[
            { key: 'dashboard', label: '📊 대시보드' },
            { key: 'input', label: '📝 내러티브 입력' },
            { key: 'assets', label: '🎯 자산 영향도' },
            { key: 'ideas', label: '💡 투자 아이디어' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '10px 8px', borderRadius: 8, border: 'none',
              background: tab === t.key ? C.accent : 'transparent',
              color: tab === t.key ? '#000' : C.dim,
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px' }}>
        {loading ? <div style={{ textAlign: 'center', padding: 60, color: C.dim }}>로딩 중...</div> : (
          <>
            {tab === 'dashboard' && <Dashboard narratives={narratives} weights={weights} assetMap={assetMap} onReanalyze={reanalyze} onDelete={deleteN} reanalyzing={reanalyzing} onGoInput={() => setTab('input')} />}
            {tab === 'input' && <InputTab inputName={inputName} setInputName={setInputName} analyzing={analyzing} aiResult={aiResult} onAnalyze={() => runAI(inputName)} onSave={saveNarrative} onReset={() => { setAiResult(null); setInputName(''); setEditingId(null); }} />}
            {tab === 'assets' && <AssetsTab sortedAssets={sortedAssets} />}
            {tab === 'ideas' && <IdeasTab narratives={narratives} weights={weights} sortedAssets={sortedAssets} />}
          </>
        )}
      </div>

      <div style={{ padding: '16px 28px', borderTop: `1px solid ${C.border}`, textAlign: 'center', marginTop: 40 }}>
        <span style={{ fontSize: 11, color: C.muted }}>🐺 늑대무리원정단 · Narrative Alpha Tracker v2 · 투자 결정은 본인의 판단과 책임 하에</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
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

// ═══════════════════════════════════════════════════════════════════════
// TAB: INPUT — 이름만 입력, AI가 전부 분석
// ═══════════════════════════════════════════════════════════════════════
function InputTab({ inputName, setInputName, analyzing, aiResult, onAnalyze, onSave, onReset }) {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Name Input */}
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
              cursor: analyzing ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
              minWidth: 140,
            }}>
            {analyzing ? '🔄 분석 중...' : '🤖 AI 분석'}
          </button>
        </div>
        {analyzing && (
          <div style={{ marginTop: 16, padding: 16, background: C.bg, borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🧠</div>
            <div style={{ fontSize: 13, color: C.accent, fontWeight: 600 }}>AI가 내러티브를 분석하고 있습니다...</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>설명 · 라이프사이클 · 핵심지표 · 스코어링 · 자산매핑 · 켈리 파라미터</div>
          </div>
        )}
      </Card>

      {/* AI Result Preview */}
      {aiResult && (
        <>
          <Card title="✅ AI 분석 결과" subtitle="검토 후 저장하세요. 수정이 필요하면 다시 분석할 수 있습니다.">
            {/* Description */}
            <div style={{ padding: 14, background: C.bg, borderRadius: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>📝 설명</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{aiResult.description}</div>
            </div>

            {/* Stage & Category */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div style={{ padding: 14, background: C.bg, borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>🔄 라이프사이클 단계</div>
                {(() => {
                  const s = STAGES.find(x => x.key === aiResult.stage);
                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 24 }}>{s?.emoji}</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: s?.color }}>{s?.label}</span>
                      </div>
                      <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>{aiResult.stageReasoning}</div>
                    </div>
                  );
                })()}
              </div>
              <div style={{ padding: 14, background: C.bg, borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>📂 카테고리</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#818cf8' }}>{aiResult.category}</div>
              </div>
            </div>

            {/* Scoring */}
            <div style={{ padding: 14, background: C.bg, borderRadius: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>📊 스코어링</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { key: 'marketImpact', label: '시장 충격도', weight: '30%' },
                  { key: 'mediaIntensity', label: '미디어 강도', weight: '20%' },
                  { key: 'dataSupport', label: '데이터 뒷받침', weight: '25%' },
                  { key: 'duration', label: '지속 기간', weight: '10%' },
                ].map(item => (
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

            {/* Indicators */}
            <div style={{ padding: 14, background: C.bg, borderRadius: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>🔬 핵심 추적 지표</div>
              {(aiResult.indicators || []).map((ind, i) => {
                const sigColor = ind.currentSignal === 'positive' ? C.green : ind.currentSignal === 'negative' ? C.red : C.muted;
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < aiResult.indicators.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center' }}>
                    <span style={{ width: 20, fontSize: 12, color: C.muted, textAlign: 'right' }}>{i + 1}.</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{ind.name}</span>
                      <div style={{ fontSize: 11, color: C.dim, marginTop: 1 }}>{ind.description}</div>
                    </div>
                    <Pill color={sigColor} style={{ fontSize: 10 }}>
                      {ind.currentSignal === 'positive' ? '긍정' : ind.currentSignal === 'negative' ? '부정' : '중립'}
                    </Pill>
                  </div>
                );
              })}
            </div>

            {/* Assets */}
            <div style={{ padding: 14, background: C.bg, borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>🎯 영향 자산 Top 5</div>
              {(aiResult.assets || []).map((a, i) => {
                const imp = IMPACT_MAP[a.impact] || IMPACT_MAP[0];
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < aiResult.assets.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: imp.color }}>{imp.symbol}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{a.asset}</span>
                      <div style={{ fontSize: 11, color: C.dim, marginTop: 1 }}>{a.reason}</div>
                    </div>
                    <Pill color={imp.color}>{imp.label}</Pill>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Actions */}
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
function Dashboard({ narratives, weights, assetMap, onReanalyze, onDelete, reanalyzing, onGoInput }) {
  if (narratives.length === 0) return (
    <Card style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📡</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>등록된 내러티브가 없습니다</div>
      <div style={{ fontSize: 13, color: C.dim, marginBottom: 20 }}>내러티브 입력 탭에서 이름만 입력하면 AI가 분석합니다</div>
      <Btn primary onClick={onGoInput}>첫 내러티브 등록하기</Btn>
    </Card>
  );

  const sorted = [...narratives].sort((a, b) => (b.score || 0) - (a.score || 0));

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* KPIs */}
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

      {/* Lifecycle */}
      <Card title="🔄 라이프사이클 분포">
        <div style={{ display: 'grid', gap: 8 }}>
          {STAGES.map(s => {
            const cnt = narratives.filter(n => n.stage === s.key).length;
            const pct = (cnt / narratives.length) * 100;
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>{s.emoji}</span>
                <span style={{ fontSize: 12, color: C.dim, width: 36 }}>{s.label}</span>
                <div style={{ flex: 1, height: 8, background: C.input, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: s.color, borderRadius: 4, transition: 'width 0.5s' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.color, width: 20, textAlign: 'right' }}>{cnt}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Scoreboard */}
      <Card title="📋 내러티브 스코어보드" subtitle="점수 높은 순 · AI 자동 스코어링 · 🔄 버튼으로 재분석">
        <div style={{ display: 'grid', gap: 10 }}>
          {sorted.map((n, i) => {
            const stage = STAGES.find(s => s.key === n.stage);
            const w = weights[n.id] || 0;
            const isReanalyzing = reanalyzing === n.id;
            return (
              <div key={n.id} style={{
                padding: '16px 20px', background: C.bg, borderRadius: 10,
                border: `1px solid ${i === 0 ? C.accent + '66' : C.border}`,
                opacity: isReanalyzing ? 0.6 : 1, transition: 'opacity 0.3s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: i === 0 ? C.accent : C.muted }}>#{i + 1}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{n.name}</span>
                    <Pill color={stage?.color}>{stage?.emoji} {stage?.label}</Pill>
                    <Pill color="#818cf8">{n.category}</Pill>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 26, fontWeight: 900, color: C.accent }}>{n.score}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>점</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: C.dim, marginBottom: 8, lineHeight: 1.5 }}>{n.description}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {(n.assets || []).map((a, j) => {
                    const imp = IMPACT_MAP[a.impact] || IMPACT_MAP[0];
                    return <Pill key={j} color={imp.color}>{imp.symbol} {a.asset}</Pill>;
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: C.muted }}>
                    비중 {(w * 100).toFixed(1)}% · 업데이트 {n.updated_at ? new Date(n.updated_at).toLocaleDateString('ko') : '-'}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn small onClick={() => onReanalyze(n)} disabled={isReanalyzing}>
                      {isReanalyzing ? '분석중...' : '🔄 재분석'}
                    </Btn>
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
        <Card title="🟢 긍정 영향 자산" subtitle="복수 내러티브 가중합산">
          {pos.length === 0 ? <div style={{ fontSize: 12, color: C.dim }}>해당 없음</div> : pos.slice(0, 10).map((a, i) => (
            <AssetRow key={a.asset} a={a} i={i} positive />
          ))}
        </Card>
        <Card title="🔴 부정 영향 자산" subtitle="복수 내러티브 가중합산">
          {neg.length === 0 ? <div style={{ fontSize: 12, color: C.dim }}>해당 없음</div> : neg.slice(0, 10).map((a, i) => (
            <AssetRow key={a.asset} a={a} i={i} />
          ))}
        </Card>
      </div>

      <Card title="📊 전체 자산 영향도">
        <div style={{ display: 'grid', gap: 4 }}>
          {sortedAssets.map(a => {
            const maxAbs = Math.max(...sortedAssets.map(x => Math.abs(x.total)), 1);
            const pct = (Math.abs(a.total) / maxAbs) * 100;
            const isPos = a.total >= 0;
            return (
              <div key={a.asset} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 60px', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                <span style={{ fontSize: 11, color: C.dim, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.asset}</span>
                <div style={{ height: 14, background: C.input, borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', [isPos ? 'left' : 'right']: 0, top: 0, bottom: 0, width: `${Math.max(2, pct)}%`, background: isPos ? C.green : C.red, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: isPos ? C.green : C.red, textAlign: 'right' }}>{isPos ? '+' : ''}{a.total.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="🔎 자산별 내러티브 소스 분해">
        <div style={{ display: 'grid', gap: 8 }}>
          {sortedAssets.slice(0, 15).map(a => (
            <details key={a.asset} style={{ background: C.bg, borderRadius: 8, padding: '10px 14px' }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', justifyContent: 'space-between' }}>
                <span>{a.asset}</span>
                <span style={{ color: a.total >= 0 ? C.green : C.red, fontWeight: 800 }}>{a.total >= 0 ? '+' : ''}{a.total.toFixed(1)}</span>
              </summary>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                {a.sources.map((s, i) => (
                  <div key={i} style={{ padding: '4px 0', fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: C.dim }}>
                      <span>{s.name} <Pill color={STAGES.find(x => x.key === s.stage)?.color}>{STAGES.find(x => x.key === s.stage)?.label}</Pill></span>
                      <span>영향 {s.impact > 0 ? '+' : ''}{s.impact} × 비중 {(s.weight * 100).toFixed(1)}% = <b style={{ color: s.weighted >= 0 ? C.green : C.red }}>{s.weighted >= 0 ? '+' : ''}{s.weighted.toFixed(1)}</b></span>
                    </div>
                    {s.reason && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>→ {s.reason}</div>}
                  </div>
                ))}
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
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: col, width: 20 }}>{i + 1}</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.text }}>{a.asset}</span>
      <div style={{ width: 80, height: 6, background: C.input, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, Math.abs(a.total) * 2)}%`, height: '100%', background: col, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: col, width: 50, textAlign: 'right' }}>{positive ? '+' : ''}{a.total.toFixed(1)}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB: INVESTMENT IDEAS (Kelly here)
// ═══════════════════════════════════════════════════════════════════════
function IdeasTab({ narratives, weights, sortedAssets }) {
  const active = narratives.filter(n => n.stage !== 'extinct');
  if (active.length === 0) return <Card style={{ textAlign: 'center', padding: 40 }}><div style={{ fontSize: 13, color: C.dim }}>활성 내러티브를 먼저 등록하세요</div></Card>;

  const stageAction = {
    birth: '🔍 소규모 관찰 포지션 진입 고려',
    strengthen: '📈 확신 시 포지션 확대',
    peak: '⚖️ 기존 포지션 유지 또는 일부 익절',
    weaken: '📉 포지션 축소 / 반대 포지션 탐색',
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <Card title="💡 내러티브 기반 투자 아이디어" subtitle="AI 자동 분석 · 라이프사이클 + 켈리 공식 + 가중 영향도">
        {active.sort((a, b) => (b.score || 0) - (a.score || 0)).map(n => {
          const stage = STAGES.find(s => s.key === n.stage);
          const kelly = n.kelly || {};
          const k = kellyF((kelly.prob || 55) / 100, kelly.odds || 2);
          const topA = (n.assets || []).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 5);

          return (
            <div key={n.id} style={{ padding: 20, background: C.bg, borderRadius: 12, marginBottom: 12, border: `1px solid ${stage?.color}33` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{n.name}</span>
                    <Pill color={stage?.color}>{stage?.emoji} {stage?.label}</Pill>
                  </div>
                  <div style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>→ {stageAction[n.stage] || ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: C.dim }}>점수</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: C.accent }}>{n.score}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Assets */}
                <div>
                  <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>주요 영향 자산</div>
                  {topA.map((a, i) => {
                    const imp = IMPACT_MAP[a.impact] || IMPACT_MAP[0];
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: C.text }}>
                        <span>{a.asset}</span>
                        <span style={{ color: imp.color, fontWeight: 600 }}>{imp.symbol} {imp.label}</span>
                      </div>
                    );
                  })}
                  {topA[0]?.reason && <div style={{ fontSize: 10, color: C.muted, marginTop: 4, fontStyle: 'italic' }}>→ {topA[0].reason}</div>}
                </div>

                {/* Kelly */}
                <div>
                  <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>🎰 켈리 공식 (AI 추정)</div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
                    승률 {kelly.prob || 55}% · 보상비 {kelly.odds || 2}x
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {[
                      { label: '풀 켈리', val: k, color: C.red, note: '이론적 최적' },
                      { label: '하프 켈리', val: k / 2, color: C.accent, note: '실전 권장' },
                      { label: '쿼터 켈리', val: k / 4, color: C.green, note: '보수적' },
                    ].map(x => (
                      <div key={x.label} style={{ padding: 8, background: C.card, borderRadius: 6, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: C.dim }}>{x.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: x.color }}>{(x.val * 100).toFixed(1)}%</div>
                        <div style={{ fontSize: 9, color: C.muted }}>{x.note}</div>
                      </div>
                    ))}
                  </div>
                  {kelly.reasoning && (
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 6, fontStyle: 'italic' }}>AI: {kelly.reasoning}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </Card>

      {/* Composite Heatmap */}
      <Card title="🗺️ 종합 자산 배분 시그널" subtitle="모든 활성 내러티브 가중 합산">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {sortedAssets.slice(0, 12).map(a => {
            const intensity = Math.min(1, Math.abs(a.total) / 50);
            const isPos = a.total >= 0;
            return (
              <div key={a.asset} style={{
                padding: '14px 16px', borderRadius: 10,
                background: isPos ? `rgba(34,197,94,${intensity * 0.25})` : `rgba(239,68,68,${intensity * 0.25})`,
                border: `1px solid ${isPos ? `rgba(34,197,94,${intensity * 0.5})` : `rgba(239,68,68,${intensity * 0.5})`}`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{a.asset}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: isPos ? C.green : C.red }}>
                  {isPos ? '▲' : '▼'} {Math.abs(a.total).toFixed(1)}
                </div>
                <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{a.sources.length}개 내러티브</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
