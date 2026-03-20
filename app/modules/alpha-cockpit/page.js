'use client';
import { useState, useEffect, useMemo } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const RATINGS_ORDER = ['AAA','AA+','AA0','AA-','A+','A0','A-'];
const RATING_DISPLAY = { 'AA0':'AA', 'A0':'A' };
const A_GRADE = ['A+','A0','A-'];
const TENORS = ['3M','6M','9M','1Y','1.5Y','2Y','2.5Y','3Y','4Y','5Y','7Y','10Y','15Y','20Y','30Y'];
const TENOR_YEARS = [0.25,0.5,0.75,1,1.5,2,2.5,3,4,5,7,10,15,20,30];
const BUCKETS = [
  { id:'Z', range:'0~6M', min:0, max:0.5, color:'#3b82f6', desc:'유동성 버퍼 · 환매 대응' },
  { id:'S', range:'6M~1.5Y', min:0.5, max:1.5, color:'#10b981', desc:'롤링 수확 구간' },
  { id:'C', range:'1.5~2.5Y', min:1.5, max:2.5, color:'#f59e0b', desc:'주력 캐리 + 롤링 진행' },
  { id:'L', range:'2.5~3.5Y', min:2.5, max:3.5, color:'#ef4444', desc:'래더 공급원 · 신규 진입' },
];
const REGIME_MATRIX = [
  [{ name:'골디락스', engines:'①②④', bg:'#065f46' },{ name:'듀레이션 랠리', engines:'①⑤', bg:'#1e3a5f' },{ name:'Flight to Quality', engines:'①', bg:'#312e81' }],
  [{ name:'캐리 천국', engines:'②③④⑥', bg:'#166534' },{ name:'정상 상태', engines:'⑤⑥', bg:'#374151' },{ name:'크레딧 스트레스', engines:'④⑤', bg:'#7f1d1d' }],
  [{ name:'리플레이션', engines:'②⑥', bg:'#92400e' },{ name:'베어 스티프닝', engines:'③', bg:'#78350f' },{ name:'스태그플레이션', engines:'⑤', bg:'#991b1b' }],
];
const RATE_LABELS = ['금리 하락','금리 보합','금리 상승'];
const SPREAD_LABELS = ['스프레드 축소','스프레드 보합','스프레드 확대'];
const RISK_CONSTRAINTS = [
  { label:'듀레이션 밴드', value:'1.0 ~ 2.0Y (Center 1.5Y)', note:'월중 일시적 2Y 초과 허용', icon:'📏' },
  { label:'신용등급 하한', value:'A- 이상', note:'A- 미만 편입 불가', icon:'🛡️' },
  { label:'A급 비중 상한', value:'50% 미만', note:'A-~A+ 합산, NAV 대비', icon:'📊' },
  { label:'발행체 집중도', value:'내부 기준 적용', note:'단일 발행체 한도', icon:'🏢' },
  { label:'유동성 버퍼', value:'Z 버킷 ≥ 5%', note:'CP/전단채 확보', icon:'💧' },
  { label:'만기 밀집 경보', value:'6M 내 AUM 20%+', note:'만기 도래 시 발동', icon:'⚠️' },
  { label:'레포매도 한도', value:'NAV 50% 미만', note:'유동성·단기레버리지·결제', icon:'🔄' },
];

// 금리판 → 등급 그룹 매핑
const RATING_CURVE_MAP = {
  'AAA': '공모/무보증 AAA',
  'AA+': '공모/무보증 AA+',
  'AA0': '공모/무보증 AA0',
  'AA-': '공모/무보증 AA-',
  'A+': '공모/무보증 A+',
  'A0': '공모/무보증 A0',
  'A-': '공모/무보증 A-',
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function calcBucket(maturityDate) {
  const yrs = calcRemainYrs(maturityDate);
  if (yrs <= 0.5) return 'Z';
  if (yrs <= 1.5) return 'S';
  if (yrs <= 2.5) return 'C';
  return 'L';
}

function calcRemainYrs(maturityDate) {
  return Math.max(0, (new Date(maturityDate) - new Date()) / (365.25*24*3600*1000));
}

function determineRegime(snapshots) {
  if (snapshots.length < 2) return null;
  const [latest, prev] = snapshots;
  const rd = latest.gov3y - prev.gov3y;
  const sd = latest.aa_spread - prev.aa_spread;
  const ri = rd <= -5 ? 0 : rd >= 5 ? 2 : 1;
  const si = sd <= -3 ? 0 : sd >= 3 ? 2 : 1;
  return { ...REGIME_MATRIX[ri][si], rateDir:ri, spreadDir:si, rateDiff:rd, spreadDiff:sd };
}

function interpolateYield(tenorYrs, curveData) {
  if (!curveData || !curveData.length) return null;
  // curveData is array of {tenor, yield}
  if (tenorYrs <= curveData[0].tenor) return curveData[0].yield;
  if (tenorYrs >= curveData[curveData.length-1].tenor) return curveData[curveData.length-1].yield;
  for (let i = 0; i < curveData.length-1; i++) {
    if (tenorYrs >= curveData[i].tenor && tenorYrs <= curveData[i+1].tenor) {
      const t = (tenorYrs - curveData[i].tenor) / (curveData[i+1].tenor - curveData[i].tenor);
      return curveData[i].yield + t * (curveData[i+1].yield - curveData[i].yield);
    }
  }
  return null;
}

function parseRateBoard(text) {
  // EUC-KR already decoded by browser. Parse TSV.
  const lines = text.split('\n').map(l => l.replace(/\r/g,''));
  // find header line
  const headerIdx = lines.findIndex(l => l.includes('3M') && l.includes('6M') && l.includes('1Y'));
  if (headerIdx < 0) return null;

  const result = { gov3y:null, aaSpread:null, date:null, curves:{}, raw:[] };

  for (let i = headerIdx+1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (cols.length < 14) continue;
    const group = (cols[3]||'').trim();
    const issuer = (cols[4]||'').trim();
    // yields start at col 6
    const yields = [];
    for (let j = 0; j < TENORS.length; j++) {
      const v = parseFloat((cols[6+j]||'').trim());
      if (!isNaN(v)) yields.push({ tenor: TENOR_YEARS[j], yield: v, label: TENORS[j] });
    }
    if (yields.length === 0) continue;

    // 국고채
    if (group === '국고채 양곡,외평,재정' && issuer === '국고채 양곡,외평,재정') {
      result.govCurve = yields;
      const y3 = yields.find(y => y.label === '3Y');
      if (y3) result.gov3y = y3.yield;
    }

    // 등급별 그룹 평균 (group === issuer인 행)
    if (group === issuer) {
      const key = group;
      result.curves[key] = yields;

      // AA- spread
      if (key === '공모/무보증 AA-' && result.gov3y != null) {
        const aa3 = yields.find(y => y.label === '3Y');
        if (aa3) result.aaSpread = Math.round((aa3.yield - result.gov3y) * 100); // bp
      }
    }

    // 개별 발행사 rows
    if (group !== issuer && issuer && group) {
      result.raw.push({ group, issuer, yields });
    }
  }
  return result;
}

const fmt = (n,d=1) => n!=null ? Number(n).toFixed(d) : '-';
const fmtAmt = (n) => n!=null ? Number(n).toLocaleString('ko-KR') : '-';
const rd = (r) => RATING_DISPLAY[r] || r;

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const S = {
  page: { minHeight:'100vh', background:'#06080f', color:'#d1d5db', fontFamily:"'Pretendard',-apple-system,BlinkMacSystemFont,sans-serif" },
  header: { borderBottom:'1px solid #1f2937', padding:'24px 20px', textAlign:'center' },
  content: { maxWidth:1100, margin:'0 auto', padding:'20px 16px 60px' },
  card: { background:'#111827', border:'1px solid #1f2937', borderRadius:12, padding:16, marginBottom:12 },
  sTitle: { fontSize:11, fontWeight:700, color:'#f59e0b', letterSpacing:2, textTransform:'uppercase', marginBottom:12 },
  cTitle: { fontSize:14, fontWeight:700, color:'#e5e7eb', marginBottom:10 },
  btn: { padding:'8px 16px', borderRadius:8, border:'none', fontSize:12, fontWeight:700, cursor:'pointer' },
  btnP: { background:'#f59e0b', color:'#000' },
  btnD: { background:'#dc2626', color:'#fff' },
  btnG: { background:'transparent', border:'1px solid #374151', color:'#9ca3af' },
  input: { width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid #374151', background:'#0d1117', color:'#e5e7eb', fontSize:13, boxSizing:'border-box' },
  select: { width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid #374151', background:'#0d1117', color:'#e5e7eb', fontSize:13, boxSizing:'border-box' },
  label: { display:'block', fontSize:11, fontWeight:600, color:'#9ca3af', marginBottom:4 },
  tag: (c) => ({ display:'inline-block', padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:700, background:c+'22', color:c, border:`1px solid ${c}44` }),
  mono: { fontFamily:"'JetBrains Mono',monospace" },
};

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
export default function AlphaCockpit() {
  const supabase = createClientComponentClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [bonds, setBonds] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ kr_code:'', name:'', issuer:'', rating:'AA-', coupon_rate:'', maturity_date:'', purchase_date:new Date().toISOString().split('T')[0], face_amount:'', purchase_amount:'', purchase_yield:'', duration:'', notes:'' });
  const [snapshots, setSnapshots] = useState([]);
  const [rateBoard, setRateBoard] = useState(null); // parsed rate board
  const [rateBoardDate, setRateBoardDate] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    const p = sessionStorage.getItem('adminPin');
    if (p) { setPinInput(p); setIsAdmin(true); }
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [pR, rR] = await Promise.all([
        supabase.from('bcp_portfolio').select('*').eq('is_active',true).order('maturity_date'),
        supabase.from('bcp_regime_snapshots').select('*').order('snapshot_date',{ascending:false}).limit(4),
      ]);
      if (pR.data) setBonds(pR.data);
      if (rR.data) setSnapshots(rR.data);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  async function handleLogin() {
    try {
      const r = await fetch('/api/verify-pin',{ method:'POST', headers:{'Content-Type':'application/json','x-admin-pin':pinInput}});
      if (r.ok) { setIsAdmin(true); sessionStorage.setItem('adminPin',pinInput); }
      else alert('PIN 불일치');
    } catch { alert('인증 오류'); }
  }

  // ─── PORTFOLIO CRUD ───
  async function saveBond() {
    const bucket = calcBucket(form.maturity_date);
    const payload = { ...form, coupon_rate:parseFloat(form.coupon_rate)||0, face_amount:parseFloat(form.face_amount)||0, purchase_amount:parseFloat(form.purchase_amount)||0, purchase_yield:parseFloat(form.purchase_yield)||0, duration:parseFloat(form.duration)||0, bucket };
    const { error } = editId
      ? await supabase.from('bcp_portfolio').update(payload).eq('id',editId)
      : await supabase.from('bcp_portfolio').insert(payload);
    if (error) { alert('저장 실패: '+error.message); return; }
    setShowForm(false); setEditId(null); resetForm(); loadData();
  }
  async function removeBond(id) {
    if (!confirm('포트폴리오에서 제거?')) return;
    await supabase.from('bcp_portfolio').update({is_active:false}).eq('id',id);
    loadData();
  }
  function startEdit(b) {
    setForm({ kr_code:b.kr_code||'', name:b.name, issuer:b.issuer||'', rating:b.rating, coupon_rate:String(b.coupon_rate||''), maturity_date:b.maturity_date, purchase_date:b.purchase_date||'', face_amount:String(b.face_amount||''), purchase_amount:String(b.purchase_amount||''), purchase_yield:String(b.purchase_yield||''), duration:String(b.duration||''), notes:b.notes||'' });
    setEditId(b.id); setShowForm(true);
  }
  function resetForm() {
    setForm({ kr_code:'', name:'', issuer:'', rating:'AA-', coupon_rate:'', maturity_date:'', purchase_date:new Date().toISOString().split('T')[0], face_amount:'', purchase_amount:'', purchase_yield:'', duration:'', notes:'' });
  }

  // ─── RATE BOARD UPLOAD ───
  async function handleRateBoardUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // try EUC-KR first, fallback to UTF-8
    let text;
    try {
      text = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsText(file, 'EUC-KR');
      });
    } catch {
      text = await file.text();
    }
    const parsed = parseRateBoard(text);
    if (!parsed || parsed.gov3y == null) { alert('금리판 파싱 실패 — 형식을 확인해주세요'); return; }
    setRateBoard(parsed);

    // 파일명에서 날짜 추출 시도 (예: 4788_260313_.txt → 2026-03-13)
    const m = file.name.match(/(\d{2})(\d{2})(\d{2})/);
    const dateStr = m ? `20${m[1]}-${m[2]}-${m[3]}` : new Date().toISOString().split('T')[0];
    setRateBoardDate(dateStr);

    // 자동으로 regime snapshot 저장
    if (isAdmin && parsed.gov3y != null && parsed.aaSpread != null) {
      const { error } = await supabase.from('bcp_regime_snapshots').insert({
        snapshot_date: dateStr,
        gov3y: parsed.gov3y,
        aa_spread: parsed.aaSpread,
        notes: `금리판 ${file.name}`,
      });
      if (!error) {
        loadData(); // refresh snapshots
      }
    }
  }

  async function deleteSnapshot(id) {
    if (!confirm('삭제?')) return;
    await supabase.from('bcp_regime_snapshots').delete().eq('id',id);
    loadData();
  }

  // ─── COMPUTED ───
  const ps = useMemo(() => {
    if (!bonds.length) return null;
    const totalAmt = bonds.reduce((s,b) => s+(b.face_amount||0), 0);
    if (!totalAmt) return null;
    const bd = {}; BUCKETS.forEach(bk => { bd[bk.id]={count:0,amount:0,pct:0,durC:0}; });
    let totalDur=0, aAmt=0;
    const rd2 = {};
    bonds.forEach(b => {
      const bk = b.bucket||calcBucket(b.maturity_date);
      if(!bd[bk]) bd[bk]={count:0,amount:0,pct:0,durC:0};
      bd[bk].count++; bd[bk].amount += b.face_amount||0;
      const dur = b.duration || calcRemainYrs(b.maturity_date)*0.95;
      bd[bk].durC += dur*(b.face_amount||0)/totalAmt;
      totalDur += dur*(b.face_amount||0)/totalAmt;
      rd2[b.rating] = (rd2[b.rating]||0) + (b.face_amount||0);
      if(A_GRADE.includes(b.rating)) aAmt += b.face_amount||0;
    });
    Object.keys(bd).forEach(k => { bd[k].pct = (bd[k].amount/totalAmt)*100; });
    const aPct = (aAmt/totalAmt)*100;
    const zPct = bd['Z']?.pct||0;
    return {
      totalAmt, bd, totalDur, ratingDist:rd2, aPct, zPct, n:bonds.length,
      cst: {
        dur: { ok:totalDur>=1&&totalDur<=2, warn:totalDur>2&&totalDur<=2.3, v:totalDur },
        rf: { ok:bonds.every(b=>RATINGS_ORDER.indexOf(b.rating)>=0&&RATINGS_ORDER.indexOf(b.rating)<=6), viol:bonds.filter(b=>RATINGS_ORDER.indexOf(b.rating)<0||RATINGS_ORDER.indexOf(b.rating)>6) },
        ag: { ok:aPct<50, v:aPct },
        zb: { ok:zPct>=5, v:zPct },
      }
    };
  }, [bonds]);

  const regime = useMemo(() => determineRegime(snapshots), [snapshots]);

  // 포트폴리오 시장가 분석
  const bondAnalysis = useMemo(() => {
    if (!bonds.length || !rateBoard) return null;
    return bonds.map(b => {
      const curveKey = RATING_CURVE_MAP[b.rating];
      const curve = curveKey ? rateBoard.curves[curveKey] : null;
      const remainYrs = calcRemainYrs(b.maturity_date);
      const mktYield = curve ? interpolateYield(remainYrs, curve) : null;
      // 개별 발행사 커브 찾기
      const issuerRow = rateBoard.raw.find(r => r.issuer === b.issuer);
      const issuerYield = issuerRow ? interpolateYield(remainYrs, issuerRow.yields) : null;
      const useYield = issuerYield || mktYield;
      const yieldDiff = (useYield != null && b.purchase_yield) ? (useYield - b.purchase_yield) : null;
      return { ...b, remainYrs, mktYield, issuerYield, useYield, yieldDiff, curveKey };
    });
  }, [bonds, rateBoard]);

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={{ fontSize:12, color:'#f59e0b99', letterSpacing:2, textTransform:'uppercase', fontWeight:600 }}>늑대무리원정단 — Control Tower</div>
        <a href="/" style={{ fontSize:12, color:'#6b7280', textDecoration:'none' }}>← Control Tower</a>
        <h1 style={{ fontSize:28, fontWeight:800, color:'#fff', margin:'8px 0 4px', letterSpacing:'-0.5px' }}>Alpha Cockpit</h1>
        <p style={{ fontSize:13, color:'#6b7280' }}>베스트크레딧플러스 · 펀드 운용 가이드라인 반영</p>
        <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:16, flexWrap:'wrap', alignItems:'center' }}>
          {[{id:'dashboard',l:'📊 Dashboard'},{id:'architecture',l:'🏗️ Architecture'}].map(t => (
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ ...S.btn, ...(activeTab===t.id?S.btnP:S.btnG) }}>{t.l}</button>
          ))}
          {!isAdmin ? (
            <div style={{ display:'flex', gap:4, marginLeft:12 }}>
              <input type="password" placeholder="Admin PIN" value={pinInput} onChange={e=>setPinInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{ ...S.input, width:120 }} />
              <button onClick={handleLogin} style={{ ...S.btn, ...S.btnP }}>🔑</button>
            </div>
          ) : <span style={{ ...S.tag('#10b981'), marginLeft:12 }}>🔓 Admin</span>}
        </div>
      </header>

      <div style={S.content}>
        {loading ? <div style={{ textAlign:'center', padding:60, color:'#6b7280' }}>Loading...</div> :
          activeTab==='dashboard' ? renderDash() : renderArch()}
      </div>
      <footer style={{ textAlign:'center', padding:'20px 16px 40px', borderTop:'1px solid #1f2937', fontSize:10, color:'#4b5563' }}>
        Alpha Cockpit v2.1 · 가이드라인 반영 · Regime → Engines → Construction OS → Portfolio
      </footer>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════════
  function renderDash() {
    return (<>
      {/* RATE BOARD UPLOAD */}
      <div style={{ ...S.card, display:'flex', flexWrap:'wrap', alignItems:'center', gap:12, padding:'12px 16px' }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#e5e7eb' }}>📄 금리판 업로드</div>
        <input type="file" accept=".txt,.csv,.tsv" onChange={handleRateBoardUpload} style={{ fontSize:11, color:'#9ca3af' }} />
        {rateBoard && (
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
            <span style={S.tag('#10b981')}>✅ 파싱 완료 {rateBoardDate && `(${rateBoardDate})`}</span>
            <span style={{ fontSize:11, color:'#3b82f6', ...S.mono }}>국고3Y: {fmt(rateBoard.gov3y,3)}%</span>
            <span style={{ fontSize:11, color:'#ef4444', ...S.mono }}>AA-스프: {rateBoard.aaSpread}bp</span>
            <span style={{ fontSize:10, color:'#6b7280' }}>{Object.keys(rateBoard.curves).length}개 커브 · {rateBoard.raw.length}개 발행사</span>
          </div>
        )}
        {!rateBoard && <span style={{ fontSize:10, color:'#4b5563' }}>금리판 TXT 파일을 올리면 레짐 판단 + 포트폴리오 분석이 자동 실행됩니다</span>}
      </div>

      {/* TOP ROW: Regime + Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        {renderRegimeCard()}
        {renderSummaryCard()}
      </div>

      {/* CONSTRAINT MONITOR */}
      {ps && renderConstraints()}

      {/* BUCKET DISTRIBUTION */}
      {renderBuckets()}

      {/* PORTFOLIO + MARKET ANALYSIS */}
      {renderPortfolioTable()}

      {/* BOND FORM */}
      {showForm && renderBondForm()}
    </>);
  }

  function renderRegimeCard() {
    return (
      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={S.sTitle}>🎯 Market Regime</div>
          <a href="/modules/regime-detector" style={{ fontSize:10, color:'#6b7280', textDecoration:'none' }}>상세 →</a>
        </div>
        {regime ? (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
              <div style={{ padding:'12px 20px', borderRadius:10, background:regime.bg, fontSize:18, fontWeight:800, color:'#fff', textAlign:'center', minWidth:140 }}>
                {regime.name}
              </div>
              <div>
                <div style={{ fontSize:11, color:'#9ca3af' }}>주요 엔진: {regime.engines}</div>
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
                  금리 {regime.rateDiff>0?'▲':regime.rateDiff<0?'▼':'→'} {fmt(regime.rateDiff,0)}bp
                  {' · '}스프레드 {regime.spreadDiff>0?'▲':regime.spreadDiff<0?'▼':'→'} {fmt(regime.spreadDiff,0)}bp
                </div>
              </div>
            </div>
            {/* mini 3x3 */}
            <div style={{ display:'grid', gridTemplateColumns:'60px repeat(3,1fr)', gap:2, fontSize:9 }}>
              <div></div>
              {SPREAD_LABELS.map((l,i)=><div key={i} style={{textAlign:'center',color:'#6b7280',padding:2}}>{l}</div>)}
              {RATE_LABELS.map((rl,ri)=>(
                <>{[<div key={'rl'+ri} style={{color:'#6b7280',display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:4}}>{rl}</div>]}
                  {REGIME_MATRIX[ri].map((cell,ci)=>{
                    const on = regime.rateDir===ri&&regime.spreadDir===ci;
                    return <div key={ci} style={{ padding:'4px 2px', borderRadius:4, textAlign:'center', fontWeight:on?800:400, background:on?cell.bg:'#1f293711', color:on?'#fff':'#4b5563', border:on?'2px solid #f59e0b':'1px solid #1f2937' }}>{cell.name}</div>;
                  })}
                </>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ padding:20, textAlign:'center', color:'#4b5563', fontSize:12 }}>
            금리판 2회 이상 업로드 시 레짐 판단 시작
          </div>
        )}
        {/* Snapshots */}
        {snapshots.length>0 && (
          <div style={{ marginTop:10, borderTop:'1px solid #1f2937', paddingTop:8 }}>
            <div style={{ fontSize:10, color:'#6b7280', marginBottom:4 }}>최근 금리판 ({snapshots.length}/4)</div>
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(snapshots.length,4)},1fr)`, gap:6 }}>
              {snapshots.slice(0,4).map((snap,i)=>(
                <div key={snap.id} style={{ padding:'6px 8px', borderRadius:6, background:i===0?'#1e3a5f':'#0d1117', border:'1px solid #1f2937', position:'relative' }}>
                  <div style={{ fontSize:9, color:'#6b7280' }}>{i===0?'W-0 (최신)':`W-${i}`}</div>
                  <div style={{ fontSize:10, color:'#e5e7eb', fontWeight:700, ...S.mono }}>{snap.snapshot_date}</div>
                  <div style={{ fontSize:10, color:'#3b82f6', ...S.mono }}>3Y: {fmt(snap.gov3y,3)}%</div>
                  <div style={{ fontSize:10, color:'#ef4444', ...S.mono }}>AA-: {fmt(snap.aa_spread,0)}bp</div>
                  {snap.notes && <div style={{ fontSize:9, color:'#6b7280', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{snap.notes}</div>}
                  {isAdmin && <button onClick={()=>deleteSnapshot(snap.id)} style={{ position:'absolute', top:4, right:4, background:'none', border:'none', color:'#4b5563', cursor:'pointer', fontSize:10 }}>✕</button>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderSummaryCard() {
    return (
      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={S.sTitle}>📋 Portfolio Summary</div>
          {isAdmin && <button onClick={()=>{resetForm();setEditId(null);setShowForm(!showForm);}} style={{...S.btn,...S.btnP,fontSize:10,padding:'4px 10px'}}>{showForm?'닫기':'+ 채권 등록'}</button>}
        </div>
        {ps ? (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:12 }}>
              {[
                {l:'보유 종목', v:ps.n+'개', c:'#e5e7eb'},
                {l:'총 액면', v:fmtAmt(ps.totalAmt)+'억', c:'#3b82f6'},
                {l:'듀레이션', v:fmt(ps.totalDur,2)+'Y', c:ps.cst.dur.ok?'#10b981':ps.cst.dur.warn?'#f59e0b':'#ef4444'},
                {l:'A급 비중', v:fmt(ps.aPct,1)+'%', c:ps.cst.ag.ok?'#10b981':'#ef4444'},
              ].map((x,i)=>(
                <div key={i} style={{textAlign:'center'}}>
                  <div style={{fontSize:10,color:'#6b7280'}}>{x.l}</div>
                  <div style={{fontSize:20,fontWeight:800,color:x.c,...S.mono}}>{x.v}</div>
                </div>
              ))}
            </div>
            {/* Duration band */}
            <div>
              <div style={{fontSize:10,color:'#6b7280',marginBottom:4}}>듀레이션 밴드</div>
              <div style={{position:'relative',height:28,background:'#1f2937',borderRadius:6,overflow:'hidden'}}>
                <div style={{position:'absolute',left:`${(1/3)*100}%`,width:`${(1/3)*100}%`,height:'100%',background:'#10b98122',borderLeft:'2px solid #10b981',borderRight:'2px solid #10b981'}}></div>
                <div style={{position:'absolute',left:`${(1.5/3)*100}%`,width:1,height:'100%',background:'#f59e0b88'}}></div>
                <div style={{position:'absolute',left:`${Math.min(Math.max(ps.totalDur/3,0),1)*100}%`,top:'50%',transform:'translate(-50%,-50%)',width:12,height:12,borderRadius:'50%',background:ps.cst.dur.ok?'#10b981':'#ef4444',border:'2px solid #fff',zIndex:2}}></div>
                <div style={{position:'absolute',left:`${(1/3)*100}%`,bottom:0,transform:'translateX(-50%)',fontSize:8,color:'#6b7280'}}>1.0Y</div>
                <div style={{position:'absolute',left:`${(1.5/3)*100}%`,top:0,transform:'translateX(-50%)',fontSize:8,color:'#f59e0b'}}>1.5Y</div>
                <div style={{position:'absolute',left:`${(2/3)*100}%`,bottom:0,transform:'translateX(-50%)',fontSize:8,color:'#6b7280'}}>2.0Y</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{padding:20,textAlign:'center',color:'#4b5563',fontSize:12}}>채권 등록 시 요약 표시</div>
        )}
      </div>
    );
  }

  function renderConstraints() {
    if(!ps) return null;
    const c = ps.cst;
    const items = [
      {l:'듀레이션 밴드', st:c.dur.ok?'ok':c.dur.warn?'warn':'fail', d:`${fmt(c.dur.v,2)}Y (1.0~2.0Y)`},
      {l:'신용등급 ≥ A-', st:c.rf.ok?'ok':'fail', d:c.rf.ok?'전 종목 충족':`${c.rf.viol.length}건 위반`},
      {l:'A급 < 50%', st:c.ag.ok?'ok':'fail', d:`${fmt(c.ag.v,1)}% / 50%`},
      {l:'Z 유동성 ≥ 5%', st:c.zb.ok?'ok':'fail', d:`${fmt(c.zb.v,1)}% / 5%`},
    ];
    const sc = {ok:'#10b981',warn:'#f59e0b',fail:'#ef4444'};
    const si = {ok:'✅',warn:'⚠️',fail:'❌'};
    return (
      <div style={{ ...S.card, border: items.some(i=>i.st==='fail')?'1px solid #ef444444':'1px solid #1f2937' }}>
        <div style={S.sTitle}>🚦 Constraint Monitor</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
          {items.map((x,i)=>(
            <div key={i} style={{padding:'8px 10px',borderRadius:8,background:'#0d1117',border:`1px solid ${sc[x.st]}33`}}>
              <div style={{fontSize:14,marginBottom:2}}>{si[x.st]}</div>
              <div style={{fontSize:11,fontWeight:700,color:'#e5e7eb'}}>{x.l}</div>
              <div style={{fontSize:10,color:sc[x.st],...S.mono}}>{x.d}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderBuckets() {
    return (
      <div style={S.card}>
        <div style={S.sTitle}>🪜 Maturity Ladder (Z·S·C·L)</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
          {BUCKETS.map(bk => {
            const d = ps?.bd?.[bk.id] || {count:0,amount:0,pct:0,durC:0};
            return (
              <div key={bk.id} style={{padding:'10px 12px',borderRadius:8,background:'#0d1117',borderTop:`3px solid ${bk.color}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:14,fontWeight:800,color:bk.color}}>{bk.id}</span>
                  <span style={{fontSize:18,fontWeight:900,color:'#e5e7eb',...S.mono}}>{fmt(d.pct,1)}%</span>
                </div>
                <div style={{fontSize:10,color:'#6b7280',marginTop:2}}>{bk.range} · {bk.desc}</div>
                <div style={{fontSize:10,color:'#9ca3af',...S.mono,marginTop:4}}>{d.count}종목 · {fmtAmt(d.amount)}억</div>
                <div style={{fontSize:10,color:bk.color,...S.mono}}>듀레이션 기여: {fmt(d.durC,3)}Y</div>
                <div style={{marginTop:4,height:4,background:'#1f2937',borderRadius:2}}>
                  <div style={{height:4,borderRadius:2,background:bk.color,width:`${Math.min(d.pct,100)}%`}}></div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{textAlign:'center',marginTop:8,fontSize:10,color:'#4b5563'}}>L → C → S → Z → 만기상환 → 재투자</div>
      </div>
    );
  }

  function renderPortfolioTable() {
    const rows = bondAnalysis || bonds.map(b=>({...b, remainYrs:calcRemainYrs(b.maturity_date), mktYield:null, issuerYield:null, useYield:null, yieldDiff:null}));
    return (
      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, flexWrap:'wrap', gap:8 }}>
          <div style={S.sTitle}>📑 보유 채권 {rateBoard ? '· 시장 분석' : ''}</div>
          {isAdmin && !showForm && <button onClick={()=>{resetForm();setEditId(null);setShowForm(true);}} style={{...S.btn,...S.btnP,fontSize:10,padding:'4px 10px'}}>+ 채권 등록</button>}
        </div>
        {bonds.length===0 ? (
          <div style={{padding:30,textAlign:'center',color:'#4b5563',fontSize:12}}>
            {isAdmin ? '"+ 채권 등록" 버튼으로 채권을 추가하세요.' : '등록된 채권이 없습니다.'}
          </div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
              <thead>
                <tr style={{borderBottom:'2px solid #1f2937'}}>
                  {['버킷','종목명','발행사','등급','이자율','만기','잔존','액면(억)','매수YTM',
                    ...(rateBoard ? ['시장YTM','차이','상태'] : []),
                    'KR코드',''
                  ].map((h,i)=>(
                    <th key={i} style={{padding:'6px 6px',textAlign:'left',color:'#6b7280',fontWeight:600,whiteSpace:'nowrap',fontSize:10}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((b,idx)=>{
                  const bk = BUCKETS.find(x=>x.id===b.bucket)||BUCKETS[2];
                  const yd = b.yieldDiff;
                  return (
                    <tr key={b.id||idx} style={{borderBottom:'1px solid #1f293766'}}>
                      <td style={{padding:'5px 6px'}}><span style={S.tag(bk.color)}>{b.bucket}</span></td>
                      <td style={{padding:'5px 6px',fontWeight:600,color:'#e5e7eb',maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.name}</td>
                      <td style={{padding:'5px 6px',color:'#9ca3af',maxWidth:80,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.issuer}</td>
                      <td style={{padding:'5px 6px'}}><span style={S.tag(A_GRADE.includes(b.rating)?'#f59e0b':'#10b981')}>{rd(b.rating)}</span></td>
                      <td style={{padding:'5px 6px',...S.mono}}>{fmt(b.coupon_rate,2)}%</td>
                      <td style={{padding:'5px 6px',...S.mono,whiteSpace:'nowrap',fontSize:10}}>{b.maturity_date}</td>
                      <td style={{padding:'5px 6px',...S.mono}}>{fmt(b.remainYrs,1)}Y</td>
                      <td style={{padding:'5px 6px',...S.mono,textAlign:'right'}}>{fmtAmt(b.face_amount)}</td>
                      <td style={{padding:'5px 6px',...S.mono}}>{b.purchase_yield?fmt(b.purchase_yield,2)+'%':'-'}</td>
                      {rateBoard && <>
                        <td style={{padding:'5px 6px',...S.mono,color:'#3b82f6'}}>
                          {b.useYield!=null ? fmt(b.useYield,2)+'%' : '-'}
                          {b.issuerYield!=null && <span style={{fontSize:8,color:'#4b5563'}}> (발행사)</span>}
                        </td>
                        <td style={{padding:'5px 6px',...S.mono,color: yd==null?'#6b7280':yd>0?'#ef4444':'#10b981',fontWeight:700}}>
                          {yd!=null ? (yd>0?'+':'')+fmt(yd*100,0)+'bp' : '-'}
                        </td>
                        <td style={{padding:'5px 6px',fontSize:12}}>
                          {yd==null ? '—' : yd>0.1 ? '📉' : yd<-0.1 ? '📈' : '➡️'}
                        </td>
                      </>}
                      <td style={{padding:'5px 6px',fontSize:9,color:'#4b5563',...S.mono}}>{b.kr_code||'-'}</td>
                      <td style={{padding:'5px 6px'}}>
                        {isAdmin && (
                          <div style={{display:'flex',gap:4}}>
                            <button onClick={()=>startEdit(b)} style={{background:'none',border:'none',color:'#6b7280',cursor:'pointer',fontSize:11}}>✏️</button>
                            <button onClick={()=>removeBond(b.id)} style={{background:'none',border:'none',color:'#6b7280',cursor:'pointer',fontSize:11}}>🗑️</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rateBoard && (
              <div style={{marginTop:8,fontSize:10,color:'#4b5563'}}>
                📉 시장금리 {'>'} 매수금리 = 평가손 방향 · 📈 시장금리 {'<'} 매수금리 = 평가익 방향 · 발행사 개별 커브가 있으면 우선 적용
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderBondForm() {
    return (
      <div style={{ ...S.card, border:'1px solid #f59e0b33' }}>
        <div style={S.cTitle}>{editId?'✏️ 채권 수정':'📝 채권 등록'}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
          {[
            {k:'name',l:'종목명 *',p:'국민은행30-이1'},
            {k:'issuer',l:'발행사',p:'국민은행'},
            {k:'kr_code',l:'KR코드',p:'KR6000001234'},
          ].map(f=>(
            <div key={f.k}><label style={S.label}>{f.l}</label><input style={S.input} value={form[f.k]} onChange={e=>setForm({...form,[f.k]:e.target.value})} placeholder={f.p} /></div>
          ))}
          <div>
            <label style={S.label}>신용등급 *</label>
            <select style={S.select} value={form.rating} onChange={e=>setForm({...form,rating:e.target.value})}>
              {RATINGS_ORDER.map(r=><option key={r} value={r}>{rd(r)}</option>)}
            </select>
          </div>
          {[
            {k:'coupon_rate',l:'이자율 (%)',p:'3.50',t:'number',s:'0.01'},
            {k:'maturity_date',l:'만기일 *',t:'date'},
            {k:'purchase_date',l:'매수일',t:'date'},
            {k:'face_amount',l:'액면 (억원)',p:'10',t:'number',s:'0.1'},
            {k:'purchase_amount',l:'매수금액 (억원)',p:'10.05',t:'number',s:'0.1'},
            {k:'purchase_yield',l:'매수수익률 (%)',p:'3.45',t:'number',s:'0.01'},
            {k:'duration',l:'듀레이션 (Y)',p:'자동추정',t:'number',s:'0.01'},
            {k:'notes',l:'메모',p:'Engine ② 시그널'},
          ].map(f=>(
            <div key={f.k}>
              <label style={S.label}>{f.l}</label>
              <input style={S.input} type={f.t||'text'} step={f.s} value={form[f.k]} onChange={e=>setForm({...form,[f.k]:e.target.value})} placeholder={f.p||''} />
            </div>
          ))}
        </div>
        {form.maturity_date && (
          <div style={{marginTop:8,fontSize:11,color:'#6b7280'}}>
            → 버킷: <span style={{fontWeight:700,color:BUCKETS.find(b=>b.id===calcBucket(form.maturity_date))?.color}}>{calcBucket(form.maturity_date)}</span>
            {RATINGS_ORDER.indexOf(form.rating)>6 && <span style={{color:'#ef4444',marginLeft:8}}>⚠️ A- 미만 — 가이드라인 위반</span>}
          </div>
        )}
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <button onClick={saveBond} disabled={!form.name||!form.maturity_date} style={{...S.btn,...S.btnP,opacity:(!form.name||!form.maturity_date)?0.5:1}}>
            {editId?'수정 저장':'등록'}</button>
          <button onClick={()=>{setShowForm(false);setEditId(null);resetForm();}} style={{...S.btn,...S.btnG}}>취소</button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // ARCHITECTURE TAB
  // ═══════════════════════════════════════════════════════════════
  function renderArch() {
    return (<>
      {/* Regime Matrix */}
      <div style={{marginBottom:24}}>
        <div style={S.sTitle}>Detection Layer</div>
        <div style={S.card}>
          <h2 style={{fontSize:16,fontWeight:800,color:'#e5e7eb',marginBottom:12}}>Market Regime Detector · 9-Regime Matrix</h2>
          <div style={{display:'grid',gridTemplateColumns:'80px repeat(3,1fr)',gap:4}}>
            <div></div>
            {SPREAD_LABELS.map((l,i)=><div key={i} style={{textAlign:'center',fontSize:10,fontWeight:600,color:'#9ca3af',padding:6}}>{l}</div>)}
            {RATE_LABELS.map((rl,ri)=>(
              <>{[<div key={'r'+ri} style={{fontSize:10,fontWeight:600,color:'#9ca3af',display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:8}}>{rl}</div>]}
                {REGIME_MATRIX[ri].map((cell,ci)=>(
                  <div key={ci} style={{padding:'8px 6px',borderRadius:6,background:cell.bg,textAlign:'center'}}>
                    <div style={{fontSize:12,fontWeight:700,color:'#fff'}}>{cell.name}</div>
                    <div style={{fontSize:9,color:'#ffffff88'}}>{cell.engines}</div>
                  </div>
                ))}
              </>
            ))}
          </div>
        </div>
      </div>

      {/* 6 Engines */}
      <div style={{marginBottom:24}}>
        <div style={S.sTitle}>Alpha Generation Layer · 6 Engines</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
          {[
            {n:'①',name:'Duration & Curve',desc:'금리 변동 손익',st:'LIVE',note:''},
            {n:'②',name:'Credit Selection',desc:'스프레드 캐리 + 변동',st:'PLANNED',note:'A- 이상 확정 종목만'},
            {n:'③',name:'Segment Allocation',desc:'시장 구간 레벨',st:'PLANNED',note:''},
            {n:'④',name:'Rating Boundary',desc:'등급 경계 비효율',st:'PLANNED',note:'A- 이상 확정 후에만 진입'},
            {n:'⑤',name:'Liquidity Premium',desc:'유동성 프리미엄',st:'PLANNED',note:''},
            {n:'⑥',name:'New Issue Premium',desc:'신규 발행 프리미엄',st:'PLANNED',note:''},
          ].map((e,i)=>(
            <div key={i} style={{...S.card,padding:12,borderLeft:e.st==='LIVE'?'3px solid #10b981':'3px solid #374151'}}>
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:16,fontWeight:800,color:'#e5e7eb'}}>{e.n}</span><span style={S.tag(e.st==='LIVE'?'#10b981':'#6b7280')}>{e.st}</span></div>
              <div style={{fontSize:12,fontWeight:700,color:'#e5e7eb',marginTop:4}}>{e.name}</div>
              <div style={{fontSize:10,color:'#6b7280'}}>{e.desc}</div>
              {e.note && <div style={{fontSize:9,color:'#f59e0b',marginTop:4}}>⚠️ {e.note}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Construction OS */}
      <div style={{marginBottom:24}}>
        <div style={S.sTitle}>Portfolio Construction OS</div>
        {/* Maturity Ladder */}
        <div style={S.card}>
          <h3 style={S.cTitle}>🪜 Maturity Ladder</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
            {BUCKETS.map(bk=>(
              <div key={bk.id} style={{padding:'10px 12px',borderRadius:8,background:'#0d1117',borderTop:`3px solid ${bk.color}`}}>
                <div style={{fontSize:16,fontWeight:800,color:bk.color}}>{bk.id}</div>
                <div style={{fontSize:11,color:'#e5e7eb',fontWeight:600}}>{bk.range}</div>
                <div style={{fontSize:10,color:'#6b7280',marginTop:2}}>{bk.desc}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Operating + Leverage */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div style={S.card}>
            <h3 style={S.cTitle}>⚙️ Operating Rules</h3>
            {[
              {f:'QUARTERLY',n:'분기별 흐름 점검',d:'만기 도래 → 매수 예산 산출'},
              {f:'PER TRADE',n:'래더 기여도 필터',d:'빈 버킷 ↑ / 밀집 버킷 ↓'},
              {f:'ALERT',n:'만기 밀집 경보',d:'6M 내 AUM 20%+ 시 발동'},
              {f:'QUARTERLY',n:'Roll-down Sweet Spot',d:'커브 최급경사 → C 버킷'},
            ].map((r,i)=>(
              <div key={i} style={{padding:'6px 0',borderBottom:i<3?'1px solid #1f2937':'none',display:'flex',gap:8}}>
                <span style={S.tag(r.f==='ALERT'?'#ef4444':'#3b82f6')}>{r.f}</span>
                <div><div style={{fontSize:11,fontWeight:600,color:'#e5e7eb'}}>{r.n}</div><div style={{fontSize:10,color:'#6b7280'}}>{r.d}</div></div>
              </div>
            ))}
          </div>
          <div style={S.card}>
            <h3 style={S.cTitle}>🔄 Leverage Rules</h3>
            <div style={{padding:16,background:'#0d1117',borderRadius:8,border:'1px solid #1f2937'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span style={{fontSize:12,fontWeight:700,color:'#e5e7eb'}}>레포매도 한도</span>
                <span style={{fontSize:16,fontWeight:800,color:'#ef4444',...S.mono}}>{'< 50% NAV'}</span>
              </div>
              <div style={{fontSize:10,color:'#6b7280'}}>용도: 유동성 · 단기레버리지 · 결제</div>
            </div>
          </div>
        </div>
        {/* Decision Tree */}
        <div style={S.card}>
          <h3 style={S.cTitle}>🌳 Reinvestment Decision Tree</h3>
          {[
            {g:'GATE 0',icon:'📊',q:'A급 비중 ≥ 50%?',a:'→ A급 신규 매수 불가, AA- 이상으로 한정',c:'#f59e0b'},
            {g:'#1',icon:'🛡️',q:'Z 버킷 < 5%?',a:'→ Z 보충 (CP/전단채)',c:'#3b82f6'},
            {g:'#2',icon:'🔧',q:'래더에 빈 구간?',a:'→ 빈 구간 충당 + Engine ②',c:'#10b981'},
            {g:'#3',icon:'🎯',q:'Engine ⑥ 매력적?',a:'→ 신규발행 참여',c:'#a855f7'},
            {g:'#4',icon:'📐',q:'모두 불충족',a:'→ Roll-down sweet spot',c:'#6b7280'},
          ].map((s,i)=>(
            <div key={i} style={{display:'flex',gap:10,alignItems:'flex-start',padding:'8px 0',borderBottom:i<4?'1px solid #1f293744':'none'}}>
              <span style={{...S.tag(s.c),minWidth:50,textAlign:'center'}}>{s.g}</span>
              <div style={{fontSize:18}}>{s.icon}</div>
              <div><div style={{fontSize:12,fontWeight:600,color:'#e5e7eb'}}>{s.q}</div><div style={{fontSize:11,color:s.c}}>{s.a}</div></div>
              {i<4 && <div style={{marginLeft:'auto',fontSize:10,color:'#4b5563'}}>ELSE ↓</div>}
            </div>
          ))}
        </div>
        {/* Risk Constraints */}
        <div style={S.card}>
          <h3 style={S.cTitle}>🚧 Risk Constraints</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
            {RISK_CONSTRAINTS.map((rc,i)=>(
              <div key={i} style={{padding:'10px 12px',borderRadius:8,background:'#0d1117',border:'1px solid #1f2937',display:'flex',gap:10}}>
                <div style={{fontSize:20}}>{rc.icon}</div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:'#e5e7eb'}}>{rc.label}</div>
                  <div style={{fontSize:13,fontWeight:800,color:'#f59e0b',...S.mono}}>{rc.value}</div>
                  <div style={{fontSize:10,color:'#6b7280'}}>{rc.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Philosophy */}
      <div style={{...S.card,textAlign:'center',borderTop:'2px solid #f59e0b22'}}>
        <div style={{fontSize:11,fontWeight:600,color:'#f59e0b',marginBottom:8}}>Design Philosophy</div>
        <p style={{fontSize:13,fontStyle:'italic',color:'#9ca3af',lineHeight:1.8}}>
          "알파 엔진이 무엇을 할 것인가를 결정하고,<br/>Maturity Ladder OS가 그 결정들을 시간 축 위에 배치한다."
        </p>
        <div style={{display:'flex',justifyContent:'center',gap:12,marginTop:12,flexWrap:'wrap'}}>
          {['6 engines × 1:1 mapping','9-regime awareness','Pipeline, not snapshot','Solo + AI'].map((p,i)=>(
            <span key={i} style={S.tag('#6b7280')}>{p}</span>
          ))}
        </div>
      </div>
    </>);
  }
}
