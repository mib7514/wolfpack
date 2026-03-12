'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════
// 🐺 NARRATIVE ALPHA TRACKER — 늑대무리원정단
// 금융시장 내러티브 추적 · 스코어링 · 자산영향도 · 투자 아이디어
// ═══════════════════════════════════════════════════════════════════════

// ─── Supabase Client (optional persistence) ──────────────────────────
import { createClient } from '@/lib/supabase';

// ─── Constants ───────────────────────────────────────────────────────
const LIFECYCLE_STAGES = [
  { key: 'birth', label: '탄생', emoji: '🌱', color: '#4ade80', desc: '시장에서 처음 언급 시작' },
  { key: 'strengthen', label: '강화', emoji: '📈', color: '#facc15', desc: '주요 매체/기관 인용, 데이터 뒷받침' },
  { key: 'peak', label: '절정', emoji: '🔥', color: '#f97316', desc: '모든 참여자 인지, 가격 반영' },
  { key: 'weaken', label: '약화', emoji: '📉', color: '#a78bfa', desc: '반론 등장, 데이터 불일치' },
  { key: 'extinct', label: '소멸', emoji: '💀', color: '#6b7280', desc: '시장 영향력 없음' },
];

const STAGE_MULTIPLIER = { birth: 0.4, strengthen: 0.8, peak: 1.0, weaken: 0.5, extinct: 0.1 };

const ASSET_CATEGORIES = [
  // 주식 - 국가별
  '한국주식', '미국주식', '중국주식', '일본주식', '유럽주식',
  // 채권
  '한국국채', '미국국채', '하이일드채권', 'IG채권', '이머징채권',
  // 원자재
  '금', '은', '원유(WTI)', '천연가스', '구리', '리튬', '우라늄',
  // 환율
  '달러(DXY)', '원/달러', '엔/달러', '유로/달러', '위안/달러',
  // 크립토
  '비트코인', '이더리움',
  // 지수
  '코스피', '코스닥', 'S&P500', '나스닥100', '다우존스', '항셍', '닛케이225',
  // 섹터
  '반도체섹터', 'AI/테크섹터', '방산섹터', '바이오섹터', '에너지섹터', '금융섹터', '유틸리티섹터', '리츠(REITs)',
  // 개별종목
  'SK하이닉스', '삼성전자', 'NVIDIA', 'TSMC', 'Apple', 'Microsoft', 'Tesla',
  '한전', '두산에너빌리티', 'HD현대중공업', '셀트리온',
  // 변동성/위험지표
  'VIX', 'MOVE지수', 'CDS스프레드', 'TED스프레드',
  // 경제지표
  'CPI', 'PPI', 'PMI', '실업률', '기준금리(한국)', '기준금리(미국)',
];

const IMPACT_OPTIONS = [
  { value: 2, label: '강한 긍정', color: '#22c55e', symbol: '▲▲' },
  { value: 1, label: '약한 긍정', color: '#86efac', symbol: '▲' },
  { value: 0, label: '중립', color: '#6b7280', symbol: '—' },
  { value: -1, label: '약한 부정', color: '#fca5a5', symbol: '▼' },
  { value: -2, label: '강한 부정', color: '#ef4444', symbol: '▼▼' },
];

const INDICATOR_TEMPLATES = {
  '경제정책': ['관련 법안 발의 수', '정책 발표 빈도', '중앙은행 발언 톤', '재정지출 규모 변화', '시장 서프라이즈 지수'],
  '지정학': ['뉴스 헤드라인 빈도', '관련국 CDS 변화', '군사비 지출 변화', '외교 회담 빈도', '제재/관세 규모'],
  '기술혁신': ['관련 특허 출원 수', 'VC 투자 규모', '기업 CAPEX 변화', '검색 트렌드(구글)', '관련 ETF 자금유입'],
  '금융위기': ['VIX 수준', '신용스프레드 변화', '은행간 금리', '중앙은행 긴급조치', '자금시장 유동성'],
  '인플레이션': ['CPI/PCE 변화율', '기대인플레이션(BEI)', '임금상승률', '원자재 가격지수', '주거비 변화율'],
  '통화정책': ['금리선물 내재확률', '연준 점도표 변화', 'QE/QT 규모', '역레포 잔고', 'M2 증가율'],
  '산업전환': ['관련 기업 매출성장률', '시장점유율 변화', '규제 변화', '소비자 채택률', '공급망 변화'],
  '커스텀': ['지표1', '지표2', '지표3', '지표4', '지표5'],
};

// ─── Helpers ─────────────────────────────────────────────────────────
const calcScore = (n) => {
  const stageM = STAGE_MULTIPLIER[n.stage] || 0.5;
  const { marketImpact = 5, mediaIntensity = 5, dataSupport = 5, duration = 5, connectivity = 0 } = n;
  const base = (marketImpact * 0.30 + mediaIntensity * 0.20 + dataSupport * 0.25 + duration * 0.10 + connectivity * 0.15) * 10;
  return Math.round(base * stageM);
};

const kellyF = (p, b) => {
  if (b <= 0) return 0;
  return Math.max(0, Math.min(1, (p * b - (1 - p)) / b));
};

const fmtDate = (d) => {
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`;
};

// ─── Styles ──────────────────────────────────────────────────────────
const C = {
  bg: '#0a0e17', card: '#111827', border: '#1e293b',
  accent: '#f59e0b', green: '#22c55e', red: '#ef4444',
  text: '#e2e8f0', dim: '#94a3b8', muted: '#475569',
  input: '#1e293b', inputB: '#334155',
};

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function NarrativeTrackerPage() {
  const [tab, setTab] = useState('dashboard');
  const [narratives, setNarratives] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form
  const emptyForm = {
    name: '', description: '', category: '경제정책', stage: 'birth',
    marketImpact: 5, mediaIntensity: 5, dataSupport: 5, duration: 5,
    indicators: [], assets: [], kellyProb: 55, kellyOdds: 2.0,
  };
  const [form, setForm] = useState({ ...emptyForm });
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ─── Supabase Persistence ────────────────────────────────────────
  useEffect(() => {
    loadNarratives();
  }, []);

  const loadNarratives = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('narratives')
        .select('*')
        .order('score', { ascending: false });
      if (!error && data) {
        const parsed = data.map(d => ({
          ...d,
          indicators: typeof d.indicators === 'string' ? JSON.parse(d.indicators) : (d.indicators || []),
          assets: typeof d.assets === 'string' ? JSON.parse(d.assets) : (d.assets || []),
        }));
        setNarratives(parsed);
      }
    } catch (e) {
      // Fallback: load from local state (no Supabase table yet)
      console.log('Supabase not configured yet, using local state');
    }
    setLoading(false);
  };

  const persistNarrative = async (narrativeData) => {
    try {
      const supabase = createClient();
      const toSave = {
        ...narrativeData,
        indicators: JSON.stringify(narrativeData.indicators || []),
        assets: JSON.stringify(narrativeData.assets || []),
      };
      if (editingId) {
        await supabase.from('narratives').update(toSave).eq('id', editingId);
      } else {
        await supabase.from('narratives').insert(toSave);
      }
    } catch (e) {
      console.log('Supabase save skipped:', e.message);
    }
  };

  const deleteFromDb = async (id) => {
    try {
      const supabase = createClient();
      await supabase.from('narratives').delete().eq('id', id);
    } catch (e) {
      console.log('Supabase delete skipped');
    }
  };

  // ─── CRUD ──────────────────────────────────────────────────────────
  const saveNarrative = async () => {
    if (!form.name.trim()) return;
    setSaving(true);

    const connectivity = narratives.filter(n => n.id !== editingId).reduce((acc, n) => {
      const shared = (form.assets || []).filter(a => (n.assets || []).some(na => na.asset === a.asset));
      return acc + (shared.length > 0 ? Math.min(10, shared.length * 2) : 0);
    }, 0);

    const data = {
      ...form,
      connectivity: Math.min(10, connectivity),
      id: editingId || `n_${Date.now()}`,
      updated_at: new Date().toISOString(),
    };
    data.score = calcScore(data);

    await persistNarrative(data);

    if (editingId) {
      setNarratives(p => p.map(n => n.id === editingId ? data : n));
      setEditingId(null);
    } else {
      setNarratives(p => [...p, data]);
    }
    setForm({ ...emptyForm });
    setSaving(false);
    setTab('dashboard');
  };

  const startEdit = (n) => {
    setForm({ ...n });
    setEditingId(n.id);
    setTab('input');
  };

  const remove = async (id) => {
    await deleteFromDb(id);
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
        m[a.asset].sources.push({ name: n.name, impact: a.impact, weight: w, weighted: wi, stage: n.stage });
      });
    });
    return m;
  }, [narratives, weights]);

  const sortedAssets = useMemo(() =>
    Object.values(assetMap).sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
  [assetMap]);

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Pretendard', -apple-system, 'Noto Sans KR', sans-serif" }}>
      {/* Header */}
      <div style={{ padding: '20px 28px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <a href="/" style={{ color: C.muted, fontSize: 12, textDecoration: 'none', marginBottom: 4, display: 'block' }}>← 컨트롤 타워</a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: C.accent, letterSpacing: '-0.03em' }}>
              🐺 NARRATIVE ALPHA
            </span>
            <span style={{ fontSize: 10, padding: '2px 8px', background: '#22c55e22', color: '#22c55e', borderRadius: 4, fontWeight: 600, border: '1px solid #22c55e44' }}>LIVE</span>
          </div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
            금융시장 내러티브 추적 · 스코어링 · 투자 아이디어
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.dim }}>로딩 중...</div>
        ) : (
          <>
            {tab === 'dashboard' && <DashboardTab narratives={narratives} weights={weights} assetMap={assetMap} onEdit={startEdit} onDelete={remove} onGoInput={() => setTab('input')} />}
            {tab === 'input' && <InputTab form={form} upd={upd} editingId={editingId} saving={saving} onSave={saveNarrative} onCancel={() => { setEditingId(null); setForm({...emptyForm}); }} />}
            {tab === 'assets' && <AssetsTab sortedAssets={sortedAssets} />}
            {tab === 'ideas' && <IdeasTab narratives={narratives} weights={weights} assetMap={assetMap} sortedAssets={sortedAssets} />}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 28px', borderTop: `1px solid ${C.border}`, textAlign: 'center', marginTop: 40 }}>
        <span style={{ fontSize: 11, color: C.muted }}>
          🐺 늑대무리원정단 · Narrative Alpha Tracker · 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

function Pill({ children, color = '#f59e0b' }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 6,
      fontSize: 11, fontWeight: 600, background: color + '22', color, border: `1px solid ${color}44`,
    }}>{children}</span>
  );
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
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? '6px 14px' : '10px 20px', borderRadius: 8,
      border: primary ? 'none' : `1px solid ${danger ? C.red + '44' : C.inputB}`,
      background: primary ? C.accent : 'transparent',
      color: primary ? '#000' : danger ? C.red : C.text,
      fontWeight: 600, fontSize: small ? 12 : 13,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, ...style,
    }}>{children}</button>
  );
}

function Inp({ value, onChange, placeholder, type = 'text', style }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{
        width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${C.inputB}`,
        background: C.input, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', ...style,
      }} />
  );
}

function Sel({ value, onChange, options, style }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${C.inputB}`,
        background: C.input, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', appearance: 'none', ...style,
      }}>
      {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </select>
  );
}

function Slider({ label, value, onChange, min = 1, max = 10, suffix }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: C.dim }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>{suffix || `${value}/${max}`}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: C.accent }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB: DASHBOARD
// ═══════════════════════════════════════════════════════════════════════
function DashboardTab({ narratives, weights, assetMap, onEdit, onDelete, onGoInput }) {
  if (narratives.length === 0) return (
    <Card style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📡</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>등록된 내러티브가 없습니다</div>
      <div style={{ fontSize: 13, color: C.dim, marginBottom: 20 }}>내러티브 입력 탭에서 시장 내러티브를 등록하세요</div>
      <Btn primary onClick={onGoInput}>첫 내러티브 등록하기</Btn>
    </Card>
  );

  const sorted = [...narratives].sort((a, b) => (b.score || 0) - (a.score || 0));

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* KPI Row */}
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

      {/* Lifecycle Distribution */}
      <Card title="🔄 라이프사이클 분포">
        <div style={{ display: 'grid', gap: 8 }}>
          {LIFECYCLE_STAGES.map(s => {
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

      {/* Narrative Cards */}
      <Card title="📋 내러티브 스코어보드" subtitle="점수 높은 순 · 비중 = 해당 내러티브 점수 / 전체 합산">
        <div style={{ display: 'grid', gap: 10 }}>
          {sorted.map((n, i) => {
            const stage = LIFECYCLE_STAGES.find(s => s.key === n.stage);
            const w = weights[n.id] || 0;
            const k = kellyF((n.kellyProb || 55) / 100, n.kellyOdds || 2);
            return (
              <div key={n.id} style={{
                padding: '14px 18px', background: C.bg, borderRadius: 10,
                border: `1px solid ${i === 0 ? C.accent + '66' : C.border}`,
                display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 14, alignItems: 'center',
              }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: i === 0 ? C.accent : C.muted, textAlign: 'center' }}>#{i + 1}</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{n.name}</span>
                    <Pill color={stage?.color}>{stage?.emoji} {stage?.label}</Pill>
                    <Pill color="#818cf8">{n.category}</Pill>
                  </div>
                  <div style={{ fontSize: 12, color: C.dim, marginBottom: 4 }}>{n.description || ''}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.muted, flexWrap: 'wrap' }}>
                    <span>자산 {(n.assets || []).length}개</span>
                    <span>비중 {(w * 100).toFixed(1)}%</span>
                    <span>하프켈리 {(k / 2 * 100).toFixed(1)}%</span>
                    <span style={{ color: C.muted }}>업데이트 {n.updated_at ? fmtDate(n.updated_at) : '-'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <div><span style={{ fontSize: 24, fontWeight: 900, color: C.accent }}>{n.score}</span><span style={{ fontSize: 11, color: C.muted }}>점</span></div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn small onClick={() => onEdit(n)}>수정</Btn>
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
// TAB: INPUT
// ═══════════════════════════════════════════════════════════════════════
function InputTab({ form, upd, editingId, saving, onSave, onCancel }) {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Basic Info */}
      <Card title={editingId ? '✏️ 내러티브 수정' : '➕ 새 내러티브 등록'} subtitle="금융시장에 영향을 주는 내러티브를 입력하세요">
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 4 }}>내러티브 이름 *</label>
            <Inp value={form.name} onChange={v => upd('name', v)} placeholder="예: 미국 관세전쟁 확대, AI 버블론, BOJ 금리인상 등" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 4 }}>상세 설명</label>
            <textarea value={form.description} onChange={e => upd('description', e.target.value)}
              placeholder="내러티브의 배경, 핵심 논리, 시장 전파 경로 등" rows={3}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${C.inputB}`, background: C.input, color: C.text, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 4 }}>카테고리</label>
              <Sel value={form.category} onChange={v => upd('category', v)} options={Object.keys(INDICATOR_TEMPLATES).map(k => ({ value: k, label: k }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 4 }}>라이프사이클</label>
              <Sel value={form.stage} onChange={v => upd('stage', v)} options={LIFECYCLE_STAGES.map(s => ({ value: s.key, label: `${s.emoji} ${s.label} — ${s.desc}` }))} />
            </div>
          </div>
        </div>
      </Card>

      {/* Scoring */}
      <Card title="📊 스코어링 요소" subtitle="시장 영향력 평가 (1~10)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
          <Slider label="시장 충격도 (30%)" value={form.marketImpact} onChange={v => upd('marketImpact', v)} />
          <Slider label="미디어 강도 (20%)" value={form.mediaIntensity} onChange={v => upd('mediaIntensity', v)} />
          <Slider label="데이터 뒷받침 (25%)" value={form.dataSupport} onChange={v => upd('dataSupport', v)} />
          <Slider label="지속 기간 (10%)" value={form.duration} onChange={v => upd('duration', v)} />
        </div>
        <div style={{ marginTop: 12, padding: '12px 16px', background: C.bg, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: C.dim }}>연결도 (15%) — 자산 저장 후 자동 계산</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>예상 {calcScore({ ...form, connectivity: 0 })}점</span>
        </div>
      </Card>

      {/* Indicators */}
      <Card title="🔬 핵심 추적 지표" subtitle={`'${form.category}' 기본 지표 — 자유 수정 가능`}>
        <div style={{ display: 'grid', gap: 8 }}>
          {(form.indicators.length > 0 ? form.indicators : INDICATOR_TEMPLATES[form.category] || []).map((ind, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: C.muted, width: 20, textAlign: 'right' }}>{i + 1}.</span>
              <Inp value={form.indicators[i] ?? ind} onChange={v => {
                const next = [...(form.indicators.length > 0 ? form.indicators : INDICATOR_TEMPLATES[form.category])];
                next[i] = v;
                upd('indicators', next);
              }} style={{ flex: 1 }} />
            </div>
          ))}
        </div>
      </Card>

      {/* Asset Mapping */}
      <Card title="🎯 영향 자산 매핑" subtitle="내러티브가 영향을 주는 자산 추가">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {(form.assets || []).map((a, i) => {
            const imp = IMPACT_OPTIONS.find(o => o.value === a.impact);
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                background: (imp?.color || C.muted) + '22', border: `1px solid ${(imp?.color || C.muted)}44`, borderRadius: 8,
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{a.asset}</span>
                <span style={{ fontSize: 10, color: imp?.color }}>{imp?.symbol}</span>
                <button onClick={() => upd('assets', form.assets.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
              </div>
            );
          })}
        </div>
        <AssetAdder onAdd={(asset, impact) => upd('assets', [...(form.assets || []), { asset, impact }])} />
      </Card>

      {/* Kelly */}
      <Card title="🎰 켈리 공식 파라미터" subtitle="투자의 승률과 보상비율 설정">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Slider label="승률 (p)" value={form.kellyProb} onChange={v => upd('kellyProb', v)} min={1} max={99} suffix={`${form.kellyProb}%`} />
          <Slider label="보상/위험 비율 (b)" value={form.kellyOdds * 10} onChange={v => upd('kellyOdds', v / 10)} min={5} max={100} suffix={`${form.kellyOdds.toFixed(1)}x`} />
        </div>
        {(() => {
          const k = kellyF(form.kellyProb / 100, form.kellyOdds);
          return (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: '풀 켈리', val: k, color: C.red, note: '이론적 최적 (위험)' },
                { label: '하프 켈리', val: k / 2, color: C.accent, note: '실전 권장' },
                { label: '쿼터 켈리', val: k / 4, color: C.green, note: '보수적' },
              ].map(x => (
                <div key={x.label} style={{ padding: 12, background: C.bg, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: C.dim }}>{x.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: x.color }}>{(x.val * 100).toFixed(1)}%</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{x.note}</div>
                </div>
              ))}
            </div>
          );
        })()}
      </Card>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        {editingId && <Btn onClick={onCancel}>취소</Btn>}
        <Btn primary onClick={onSave} disabled={!form.name.trim() || saving}>
          {saving ? '저장 중...' : editingId ? '수정 완료' : '내러티브 저장 →'}
        </Btn>
      </div>
    </div>
  );
}

// ─── Asset Adder ─────────────────────────────────────────────────────
function AssetAdder({ onAdd }) {
  const [search, setSearch] = useState('');
  const [impact, setImpact] = useState(1);
  const [open, setOpen] = useState(false);

  const filtered = ASSET_CATEGORIES.filter(a => a.toLowerCase().includes(search.toLowerCase())).slice(0, 12);
  const add = (name) => { onAdd(name, impact); setSearch(''); setOpen(false); };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px auto', gap: 8, alignItems: 'start' }}>
        <div style={{ position: 'relative' }}>
          <Inp value={search} onChange={v => { setSearch(v); setOpen(true); }} placeholder="자산 검색 (예: SK하이닉스, 금, S&P500...)" />
          {open && search && filtered.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
              background: C.card, border: `1px solid ${C.inputB}`, borderRadius: 8, maxHeight: 200, overflowY: 'auto', marginTop: 4,
            }}>
              {filtered.map(a => (
                <div key={a} onClick={() => add(a)} style={{ padding: '8px 14px', fontSize: 12, color: C.text, cursor: 'pointer', borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.target.style.background = C.input} onMouseLeave={e => e.target.style.background = 'transparent'}>{a}</div>
              ))}
            </div>
          )}
        </div>
        <Sel value={impact} onChange={v => setImpact(Number(v))} options={IMPACT_OPTIONS.map(o => ({ value: o.value, label: `${o.symbol} ${o.label}` }))} />
        <Btn small primary onClick={() => { if (search.trim()) add(search.trim()); }} disabled={!search.trim()}>추가</Btn>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {['SK하이닉스', '삼성전자', 'NVIDIA', 'S&P500', '금', '원유(WTI)', '원/달러', '미국국채', '비트코인', 'VIX'].map(q => (
          <button key={q} onClick={() => add(q)} style={{
            padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.inputB}`,
            background: 'transparent', color: C.dim, fontSize: 11, cursor: 'pointer',
          }}>{q}</button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB: ASSETS
// ═══════════════════════════════════════════════════════════════════════
function AssetsTab({ sortedAssets }) {
  if (sortedAssets.length === 0) return (
    <Card style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 13, color: C.dim }}>내러티브에 자산을 매핑한 후 확인하세요</div>
    </Card>
  );

  const pos = sortedAssets.filter(a => a.total > 0);
  const neg = sortedAssets.filter(a => a.total < 0);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Card title="🟢 긍정 영향 Top 10" subtitle="복수 내러티브 가중합산">
          {pos.length === 0 ? <div style={{ fontSize: 12, color: C.dim }}>해당 없음</div> : pos.slice(0, 10).map((a, i) => (
            <AssetRow key={a.asset} a={a} i={i} positive />
          ))}
        </Card>
        <Card title="🔴 부정 영향 Top 10" subtitle="복수 내러티브 가중합산">
          {neg.length === 0 ? <div style={{ fontSize: 12, color: C.dim }}>해당 없음</div> : neg.slice(0, 10).map((a, i) => (
            <AssetRow key={a.asset} a={a} i={i} />
          ))}
        </Card>
      </div>

      {/* Bar chart - pure CSS */}
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
                  <div style={{
                    position: 'absolute', [isPos ? 'left' : 'right']: 0, top: 0, bottom: 0,
                    width: `${Math.max(2, pct)}%`, background: isPos ? C.green : C.red,
                    borderRadius: 3, transition: 'width 0.4s',
                  }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: isPos ? C.green : C.red, textAlign: 'right' }}>
                  {isPos ? '+' : ''}{a.total.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Source Breakdown */}
      <Card title="🔎 자산별 내러티브 소스 분해">
        <div style={{ display: 'grid', gap: 8 }}>
          {sortedAssets.slice(0, 15).map(a => (
            <details key={a.asset} style={{ background: C.bg, borderRadius: 8, padding: '10px 14px' }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', justifyContent: 'space-between' }}>
                <span>{a.asset}</span>
                <span style={{ color: a.total >= 0 ? C.green : C.red, fontWeight: 800 }}>
                  {a.total >= 0 ? '+' : ''}{a.total.toFixed(1)}
                </span>
              </summary>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                {a.sources.map((s, i) => {
                  const st = LIFECYCLE_STAGES.find(x => x.key === s.stage);
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.dim, padding: '3px 0' }}>
                      <span>{s.name} <Pill color={st?.color} >{st?.label}</Pill></span>
                      <span>영향 {s.impact > 0 ? '+' : ''}{s.impact} × 비중 {(s.weight * 100).toFixed(1)}% = <b style={{ color: s.weighted >= 0 ? C.green : C.red }}>{s.weighted >= 0 ? '+' : ''}{s.weighted.toFixed(1)}</b></span>
                    </div>
                  );
                })}
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
      <span style={{ fontSize: 12, fontWeight: 700, color: col, width: 50, textAlign: 'right' }}>
        {positive ? '+' : ''}{a.total.toFixed(1)}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB: INVESTMENT IDEAS
// ═══════════════════════════════════════════════════════════════════════
function IdeasTab({ narratives, weights, assetMap, sortedAssets }) {
  const active = narratives.filter(n => n.stage !== 'extinct');
  if (active.length === 0) return (
    <Card style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 13, color: C.dim }}>활성 내러티브를 먼저 등록하세요</div>
    </Card>
  );

  const stageAction = {
    birth: '🔍 소규모 관찰 포지션 진입 고려',
    strengthen: '📈 확신 시 포지션 확대',
    peak: '⚖️ 기존 포지션 유지 또는 일부 익절',
    weaken: '📉 포지션 축소 / 반대 포지션 탐색',
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <Card title="💡 내러티브 기반 투자 아이디어" subtitle="라이프사이클 + 켈리 + 가중 영향도 종합">
        {active.sort((a, b) => (b.score || 0) - (a.score || 0)).map(n => {
          const stage = LIFECYCLE_STAGES.find(s => s.key === n.stage);
          const k = kellyF((n.kellyProb || 55) / 100, n.kellyOdds || 2);
          const topA = (n.assets || []).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 5);
          return (
            <div key={n.id} style={{
              padding: 20, background: C.bg, borderRadius: 12, marginBottom: 12,
              border: `1px solid ${stage?.color}33`,
            }}>
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
                  <div style={{ fontSize: 20, fontWeight: 900, color: C.accent }}>{n.score}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>주요 영향 자산</div>
                  {topA.map((a, i) => {
                    const imp = IMPACT_OPTIONS.find(o => o.value === a.impact);
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: C.text }}>
                        <span>{a.asset}</span>
                        <span style={{ color: imp?.color, fontWeight: 600 }}>{imp?.symbol} {imp?.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>켈리 배분 (p={n.kellyProb || 55}%, b={n.kellyOdds || 2}x)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {[
                      { label: '풀', val: k, color: C.red },
                      { label: '하프', val: k / 2, color: C.accent },
                      { label: '쿼터', val: k / 4, color: C.green },
                    ].map(x => (
                      <div key={x.label} style={{ padding: 8, background: C.card, borderRadius: 6, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: C.dim }}>{x.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: x.color }}>{(x.val * 100).toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, color: C.muted, fontStyle: 'italic' }}>
                    ※ 실전: 하프~쿼터 켈리 권장
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </Card>

      {/* Composite Heatmap */}
      <Card title="🗺️ 종합 자산 배분 시그널" subtitle="모든 활성 내러티브 가중 합산 최종 뷰">
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
                <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{a.sources.length}개 내러티브 영향</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
