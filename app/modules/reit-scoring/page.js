'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

// ── DB ↔ Frontend 변환 ──
const DB_MAP = {
  div_yield:'divYield', ffo_based_payout:'ffoBasedPayout', funding_rate:'fundingRate',
  cap_rate:'capRate', fixed_rate_ratio:'fixedRateRatio', hedge_ratio:'hedgeRatio',
  debt_maturing_2y:'debtMaturingIn2Y', avg_debt_maturity:'avgDebtMaturity',
  ltv:'ltv', debt_ratio:'debtRatio', occupancy:'occupancy', wale:'wale',
  price:'price', nav:'nav', ret_3m:'ret3m', ret_6m:'ret6m',
  avg_vol_20d:'avgVol20d', avg_vol_60d:'avgVol60d',
  special_div:'specialDiv', special_div_note:'specialDivNote',
  note:'note', name:'name', ticker:'ticker', sector:'sector',
  data_source:'dataSource', updated_at:'updatedAt',
};
const FRONT_MAP = Object.fromEntries(Object.entries(DB_MAP).map(([k,v])=>[v,k]));

function toFront(row) {
  const r = { id: row.id };
  for (const [db, fe] of Object.entries(DB_MAP)) if (row[db] !== undefined) r[fe] = row[db];
  return r;
}
function toDb(data) {
  const r = {};
  for (const [fe, val] of Object.entries(data)) {
    const db = FRONT_MAP[fe];
    if (db) r[db] = val; else r[fe] = val;
  }
  return r;
}

const REIT_FIELDS = [
  {key:'divYield',label:'배당수익률(%)',step:0.1},{key:'ffoBasedPayout',label:'FFO Payout(%)',step:1},
  {key:'fundingRate',label:'조달금리(%)',step:0.1},{key:'capRate',label:'Cap Rate(%)',step:0.1},
  {key:'fixedRateRatio',label:'고정금리비중(%)',step:1},{key:'hedgeRatio',label:'헷지비율(%)',step:1},
  {key:'debtMaturingIn2Y',label:'2Y내 만기비중(%)',step:1},{key:'avgDebtMaturity',label:'평균잔존만기(Y)',step:0.1},
  {key:'ltv',label:'LTV(%)',step:1},{key:'debtRatio',label:'부채비율(%)',step:1},
  {key:'occupancy',label:'임대율(%)',step:0.1},{key:'wale',label:'WALE(Y)',step:0.1},
];

// ── Scoring ──
function scoreCarrySize(r){let s=0;if(r.divYield>=5&&r.divYield<=9)s+=Math.min(40,(r.divYield-3)*10);else if(r.divYield>9)s+=30;if(r.ffoBasedPayout<=95)s+=60*(1-Math.abs(r.ffoBasedPayout-87)/30);else s+=Math.max(0,60-(r.ffoBasedPayout-95)*3);return Math.round(Math.min(100,Math.max(0,s)));}
function scoreCarryQuality(r){const sp=(r.capRate-r.fundingRate)*100;return Math.round(Math.min(100,Math.max(0,Math.min(50,sp/4)+(r.fixedRateRatio/100)*30+(r.hedgeRatio/100)*20)));}
function scoreRefiRisk(r){return Math.round(Math.min(100,Math.max(0,100-r.debtMaturingIn2Y*1.2-Math.max(0,(5-r.avgDebtMaturity)*10))));}
function scoreLeverage(r){let s=r.ltv<=40?100:r.ltv<=55?100-(r.ltv-40)*2:Math.max(0,70-(r.ltv-55)*4);if(r.debtRatio>150)s-=(r.debtRatio-150)*0.5;return Math.round(Math.min(100,Math.max(0,s)));}
function scoreCFStability(r){let s=r.occupancy>=98?50:r.occupancy>=95?40:r.occupancy>=90?25:Math.max(0,r.occupancy-80);s+=Math.min(50,r.wale*6);return Math.round(Math.min(100,Math.max(0,s)));}
function computeScores(r,w){const c=scoreCarrySize(r),q=scoreCarryQuality(r),rf=scoreRefiRisk(r),l=scoreLeverage(r),cf=scoreCFStability(r);return{carry:c,quality:q,refi:rf,lev:l,cf,total:Math.round(c*w[0]/100+q*w[1]/100+rf*w[2]/100+l*w[3]/100+cf*w[4]/100)};}
function getGrade(s){if(s>=80)return{grade:'A',color:'#22d3ee'};if(s>=65)return{grade:'B+',color:'#34d399'};if(s>=50)return{grade:'B',color:'#fbbf24'};if(s>=35)return{grade:'C',color:'#fb923c'};return{grade:'D',color:'#f87171'};}
function annCarry(r,shock=0){const fr=r.fundingRate+shock/100;const sp=r.capRate-fr;const lev=r.ltv/(100-r.ltv);return r.capRate+sp*lev;}
function fmtC(v){return v.toFixed(1);}
function cColor(v){return v>=10?'#22d3ee':v>=7?'#34d399':v>=4?'#fbbf24':v>=2?'#fb923c':'#f87171';}
function pNavDisc(r){return r.nav>0?(((r.price-r.nav)/r.nav)*100).toFixed(1):'N/A';}
function pNav(r){return r.nav>0?((r.price/r.nav)*100).toFixed(1):'N/A';}
function momSignal(r){const disc=r.nav>0?(r.price-r.nav)/r.nav*100:0;const vr=r.avgVol60d>0?r.avgVol20d/r.avgVol60d:1;let sig=0;if(r.ret3m>3)sig+=1;else if(r.ret3m<-5)sig-=1;if(r.ret6m>5)sig+=1;else if(r.ret6m<-10)sig-=1;if(disc>-5)sig+=0.5;else if(disc<-25)sig-=0.5;if(vr>1.2)sig+=0.5;if(sig>=2)return{label:'강세',color:'#22d3ee',icon:'▲'};if(sig>=1)return{label:'양호',color:'#34d399',icon:'△'};if(sig>=-0.5)return{label:'중립',color:'#94a3b8',icon:'—'};if(sig>=-1.5)return{label:'약세',color:'#fb923c',icon:'▽'};return{label:'경고',color:'#f87171',icon:'▼'};}

const ML=['캐리크기','캐리질','리파이리스크','레버리지','CF안정성'];
const MK=['carry','quality','refi','lev','cf'];
const SC={'오피스':'#6366f1','오피스(해외)':'#818cf8','물류':'#22d3ee','리테일':'#f472b6','인프라':'#34d399','인프라/리테일':'#a78bfa'};

// ── 방법론 상세 ──
const METHOD_DETAIL = [
  { key:'carry', label:'캐리 크기', color:'#f97316',
    what:'리츠가 투자자에게 돌려주는 현금흐름의 크기를 평가합니다.',
    inputs:['배당수익률 (시가배당률)', 'FFO 기반 Payout Ratio'],
    logic:'배당수익률 5~9% 구간에서 점수가 높아지며, 9% 초과 시 오히려 감점 (과도한 배당 = 지속성 의심). FFO Payout 80~95%가 최적 구간이고, 100% 초과 시 자본잠식 신호로 큰 감점.',
    good:'배당수익률 6~7%, FFO Payout 85~95%',
    bad:'배당수익률 10%+ (함정), FFO Payout 110%+ (감가상각 이상 지급)',
    tip:'특별배당이 포함된 배당수익률은 왜곡될 수 있으므로 반드시 FFO Payout과 교차 확인. 분배금 원천이 이익잉여금인지 자본잉여금인지도 체크.', },
  { key:'quality', label:'캐리 질', color:'#6366f1',
    what:'리츠의 수익 엔진인 Cap Rate와 조달금리 간 스프레드의 건전성과 방어력을 평가합니다.',
    inputs:['Cap Rate − 조달금리 스프레드 (bp)', '고정금리 차입 비중 (%)', '변동금리 헷지(스왑) 비율 (%)'],
    logic:'스프레드가 넓을수록 캐리 버퍼가 크고, 고정금리·헷지 비중이 높을수록 금리 변동에 덜 흔들립니다. 스프레드 200bp 이상 + 고정금리 70%+ + 헷지 50%+이면 최고점.',
    good:'스프레드 ≥150bp, 고정금리 ≥70%, 헷지 ≥50%',
    bad:'스프레드 <100bp (금리 소폭 상승에도 캐리 붕괴), 변동금리 위주 + 무헷지',
    tip:'2026 BoK 인상 시나리오 감안 시, 현재 스프레드가 +100bp 충격에도 양(+)을 유지하는지가 핵심. 금리 충격 슬라이더로 확인.', },
  { key:'refi', label:'리파이낸싱 리스크', color:'#38bdf8',
    what:'향후 1~2년 내 차입금 만기 도래에 따른 리파이낸싱 부담을 평가합니다.',
    inputs:['2년 내 만기 도래 차입금 비중 (%)', '전체 차입금 평균잔존만기 (년)'],
    logic:'100점에서 시작하여 2년내 만기비중이 높을수록, 평균만기가 짧을수록 감점. 2년내 만기 40%+ 이면 대규모 감점.',
    good:'2Y 만기비중 ≤20%, 평균잔존만기 ≥4년',
    bad:'2Y 만기비중 ≥40%, 평균만기 <2년 (단기 집중 리파이 리스크)',
    tip:'현재 시장금리로 리파이낸싱 시 이자비용 증가분이 FFO를 얼마나 갉아먹는지까지 시뮬레이션해야 완전한 분석. 고정→변동 전환 리스크도 주의.', },
  { key:'lev', label:'레버리지', color:'#a78bfa',
    what:'리츠의 차입 수준과 자산가격 하락에 대한 버퍼를 평가합니다.',
    inputs:['LTV — Loan to Value (%)', '부채비율 — 총부채/자기자본 (%)'],
    logic:'LTV 40% 이하면 만점, 55%까지 완만 감점, 55% 초과 시 급격 감점. 부채비율 150% 초과 시 추가 감점 적용.',
    good:'LTV ≤45%, 부채비율 ≤120%',
    bad:'LTV ≥60%, 부채비율 ≥170% (자산가격 10% 하락 시 담보가치 훼손 위험)',
    tip:'감정평가 기준 LTV와 시가 기준 LTV의 괴리에 주의. 부동산 감정평가가 시장가 대비 높게 나오는 경우가 많아 보수적 접근 필요.', },
  { key:'cf', label:'CF 안정성', color:'#34d399',
    what:'임대 수입의 안정성과 예측 가능성을 평가합니다.',
    inputs:['임대율 — 현재 가동률 (%)', 'WALE — 가중평균잔여임대기간 (년)'],
    logic:'임대율 98%+ 이면 최고점, 95~98% 양호, 90% 미만 시 급격 감점. WALE은 5년 이상이면 우수, 1년당 6점 가산.',
    good:'임대율 ≥98%, WALE ≥6년',
    bad:'임대율 <90%, WALE <3년 (공실+재계약 리스크 동시 노출)',
    tip:'임대율이 높아도 WALE이 짧으면 조만간 재계약 협상이 몰려 금리 상승기에 임차인 교섭력이 강해질 수 있음. 두 지표를 반드시 같이 볼 것.', },
];

// ── AI Update (서버 API 경유) ──
async function aiUpdateViaAPI(names) {
  const res = await fetch('/api/ai-update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      module: 'reit-scoring',
      prompt: `다음 국내 상장 리츠들의 최신 데이터를 웹에서 검색하여 JSON 배열로 반환해주세요:\n${names.join(', ')}\n\n포함 항목: 배당수익률(divYield), FFO Payout(ffoBasedPayout), 조달금리(fundingRate), Cap Rate(capRate), 고정금리비중(fixedRateRatio), 헷지비율(hedgeRatio), 2년내만기비중(debtMaturingIn2Y), 평균잔존만기(avgDebtMaturity), LTV(ltv), 부채비율(debtRatio), 임대율(occupancy), WALE(wale), 현재주가(price), NAV(nav), 3개월수익률(ret3m), 6개월수익률(ret6m), 20일평균거래량(avgVol20d), 60일평균거래량(avgVol60d), 특별배당여부(specialDiv), 특별배당상세(specialDivNote), name, ticker, sector, note. 최신 사업보고서/IR/DART 기준. JSON 배열만 반환.`,
    }),
  });
  if (!res.ok) throw new Error('AI 업데이트 실패');
  const data = await res.json();
  // API가 텍스트로 돌아올 수 있으므로 JSON 추출
  const txt = typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
  const match = txt.replace(/```json|```/g,'').match(/\[[\s\S]*\]/);
  if (!match) throw new Error('JSON 파싱 실패');
  return JSON.parse(match[0]);
}

// ── Main Page Component ──
export default function ReitScoringPage() {
  const [reits, setReits] = useState([]);
  const [weights, setWeights] = useState([20,25,25,15,15]);
  const [sel, setSel] = useState(null);
  const [sortBy, setSortBy] = useState('total');
  const [rateShock, setRateShock] = useState(0);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [lastUpd, setLastUpd] = useState(null);
  const [methodOpen, setMethodOpen] = useState(null); // null or metric key

  // ── Load from Supabase ──
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('reits').select('*').order('name');
      if (error) { console.error(error); setLoading(false); return; }
      setReits(data.map(toFront));
      setLoading(false);
    }
    load();
  }, []);

  // ── Scoring ──
  const scored = useMemo(() => {
    return reits.map(r => {
      const sh = { ...r, fundingRate: r.fundingRate + rateShock / 100 };
      return { ...r, scores: computeScores(sh, weights), ac: annCarry(r, rateShock), mom: momSignal(r) };
    }).sort((a, b) => sortBy === 'total' ? b.scores.total - a.scores.total
      : sortBy === 'ac' ? b.ac - a.ac
      : (b.scores[sortBy] ?? 0) - (a.scores[sortBy] ?? 0));
  }, [reits, weights, sortBy, rateShock]);

  const handleW = (idx, val) => {
    const nw=[...weights];const diff=val-nw[idx];nw[idx]=val;
    const ot=[0,1,2,3,4].filter(i=>i!==idx);
    const tot=ot.reduce((s,i)=>s+nw[i],0);
    if(tot>0)ot.forEach(i=>{nw[i]=Math.max(0,Math.round(nw[i]-diff*(nw[i]/tot)));});
    const sm=nw.reduce((a,b)=>a+b,0);if(sm!==100)nw[ot[0]]+=(100-sm);
    setWeights(nw);
  };

  // ── AI Update ──
  const doAI = useCallback(async () => {
    setAiLoading(true); setStatus(null);
    try {
      const res = await aiUpdateViaAPI(reits.map(r=>r.name));
      // Supabase에 upsert
      for (const aiReit of res) {
        const dbData = toDb(aiReit);
        dbData.data_source = 'ai_update';
        await supabase.from('reits').upsert(dbData, { onConflict: 'ticker' });
      }
      // 다시 로드
      const { data } = await supabase.from('reits').select('*').order('name');
      setReits(data.map(toFront));
      const ts = new Date().toLocaleString('ko-KR');
      setLastUpd(ts);
      setStatus({ ok: true, msg: `${res.length}개 리츠 업데이트 완료 · ${ts}` });
    } catch (e) {
      setStatus({ ok: false, msg: `실패: ${e.message}` });
    } finally { setAiLoading(false); }
  }, [reits]);

  // ── Manual Edit ──
  const startEdit = r => { setEditId(r.id); setEditForm(Object.fromEntries(REIT_FIELDS.map(f=>[f.key,r[f.key]]))); };
  const saveEdit = async () => {
    const dbData = toDb(editForm);
    dbData.data_source = 'manual';
    await supabase.from('reits').update(dbData).eq('id', editId);
    setReits(p => p.map(r => r.id === editId ? { ...r, ...editForm } : r));
    if (sel?.id === editId) setSel(p => ({ ...p, ...editForm }));
    setEditId(null);
  };

  const radar = sel ? MK.map((k, i) => ({ metric: ML[i], score: sel.scores[k], fullMark: 100 })) : [];

  const Tip = ({ active, payload }) => {
    if (!active || !payload?.length) return null; const d = payload[0].payload;
    return (<div style={{background:'rgba(15,23,42,0.95)',border:'1px solid rgba(99,102,241,0.3)',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#e2e8f0'}}>
      <div style={{fontWeight:700}}>{d.name}</div>
      <div style={{color:'#94a3b8',fontSize:11}}>{d.sector}</div>
      <div style={{marginTop:6,fontWeight:600,color:getGrade(d.total).color,fontSize:16}}>{d.total}점 ({getGrade(d.total).grade})</div>
    </div>);
  };

  if (loading) return (
    <div style={{minHeight:'100vh',background:'linear-gradient(165deg,#0a0e1a 0%,#0f172a 40%,#111827 100%)',display:'flex',alignItems:'center',justifyContent:'center',color:'#64748b',fontSize:14}}>
      데이터 로딩 중...
    </div>
  );

  // ── Render ──
  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(165deg,#0a0e1a 0%,#0f172a 40%,#111827 100%)',color:'#e2e8f0',fontFamily:"'Pretendard','Noto Sans KR',-apple-system,sans-serif",padding:'24px 20px'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{maxWidth:1200,margin:'0 auto'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6,flexWrap:'wrap',gap:12}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <a href="/" style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#6366f1,#22d3ee)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:900,color:'#fff',textDecoration:'none'}}>W</a>
            <div>
              <div style={{fontSize:10,letterSpacing:3,color:'#6366f1',fontWeight:600,textTransform:'uppercase'}}>Wolfpack Control Tower · Portfolio Layer</div>
              <h1 style={{fontSize:22,fontWeight:800,margin:0,background:'linear-gradient(90deg,#e2e8f0,#94a3b8)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>K-REIT 옥석가리기 스코어링</h1>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            {lastUpd&&<span style={{fontSize:10,color:'#475569'}}>Last: {lastUpd}</span>}
            <button onClick={doAI} disabled={aiLoading}
              style={{background:aiLoading?'rgba(99,102,241,0.15)':'linear-gradient(135deg,#6366f1,#4f46e5)',border:'1px solid rgba(99,102,241,0.4)',borderRadius:10,color:'#fff',fontWeight:700,fontSize:13,padding:'10px 22px',cursor:aiLoading?'wait':'pointer',display:'flex',alignItems:'center',gap:8,boxShadow:aiLoading?'none':'0 0 24px rgba(99,102,241,0.3)'}}>
              {aiLoading?<span style={{display:'inline-block',width:16,height:16,border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid #fff',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
              :<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>}
              {aiLoading?'AI 검색 중...':'AI 데이터 업데이트'}
            </button>
          </div>
        </div>
        <p style={{color:'#64748b',fontSize:12,margin:'4px 0 16px 48px'}}>채권 투자자 관점 5축 분석 — 캐리 크기 × 캐리 질 × 리파이 리스크 × 레버리지 × CF 안정성</p>

        {/* Status */}
        {status&&(<div style={{padding:'10px 16px',borderRadius:10,marginBottom:14,fontSize:12,fontWeight:600,background:status.ok?'rgba(52,211,153,0.08)':'rgba(248,113,113,0.08)',border:`1px solid ${status.ok?'rgba(52,211,153,0.25)':'rgba(248,113,113,0.25)'}`,color:status.ok?'#34d399':'#f87171',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>{status.msg}</span><button onClick={()=>setStatus(null)} style={{background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:14}}>✕</button>
        </div>)}

        {/* Weights + Rate Shock */}
        <div style={{background:'rgba(30,41,59,0.5)',borderRadius:12,border:'1px solid rgba(99,102,241,0.15)',padding:'16px 20px',marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:8}}>
            <span style={{fontSize:13,fontWeight:700,color:'#94a3b8'}}>가중치 조절 (합계 100%)</span>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:11,color:'#64748b'}}>금리 충격</span>
              <div style={{display:'flex',alignItems:'center',gap:6,background:'rgba(15,23,42,0.6)',borderRadius:8,padding:'4px 10px',border:'1px solid rgba(248,113,113,0.2)'}}>
                <input type="range" min={-100} max={200} value={rateShock} onChange={e=>setRateShock(+e.target.value)} style={{width:90,accentColor:rateShock>0?'#f87171':'#34d399'}}/>
                <span style={{fontSize:13,fontWeight:700,minWidth:55,textAlign:'right',color:rateShock>0?'#f87171':rateShock<0?'#34d399':'#94a3b8'}}>{rateShock>=0?'+':''}{rateShock}bp</span>
              </div>
            </div>
          </div>
          <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
            {ML.map((label,i)=>(<div key={i} style={{flex:1,minWidth:130}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <div style={{display:'flex',alignItems:'center',gap:4}}>
                  <span style={{fontSize:11,color:'#94a3b8'}}>{label}</span>
                  <button onClick={()=>setMethodOpen(methodOpen===MK[i]?null:MK[i])}
                    style={{width:16,height:16,borderRadius:'50%',border:'1px solid',borderColor:methodOpen===MK[i]?METHOD_DETAIL[i].color:'rgba(99,102,241,0.3)',background:methodOpen===MK[i]?`${METHOD_DETAIL[i].color}20`:'transparent',color:methodOpen===MK[i]?METHOD_DETAIL[i].color:'#64748b',fontSize:9,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1,padding:0}}>?</button>
                </div>
                <span style={{fontSize:12,fontWeight:700,color:'#6366f1'}}>{weights[i]}%</span>
              </div>
              <input type="range" min={0} max={60} value={weights[i]} onChange={e=>handleW(i,+e.target.value)} style={{width:'100%',accentColor:'#6366f1'}}/>
            </div>))}
          </div>
        </div>

        {/* ── 방법론 상세 패널 ── */}
        {methodOpen && (()=>{
          const m = METHOD_DETAIL.find(d=>d.key===methodOpen);
          if(!m) return null;
          return (
            <div style={{background:'rgba(30,41,59,0.6)',borderRadius:12,border:`1px solid ${m.color}30`,padding:20,marginBottom:20,animation:'fadeIn 0.2s ease'}}>
              <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:32,height:32,borderRadius:8,background:`${m.color}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:900,color:m.color,border:`1.5px solid ${m.color}40`}}>{ML[MK.indexOf(m.key)][0]}</div>
                  <div>
                    <h3 style={{margin:0,fontSize:16,fontWeight:800,color:'#e2e8f0'}}>{m.label}</h3>
                    <p style={{margin:0,fontSize:11,color:'#94a3b8',marginTop:2}}>{m.what}</p>
                  </div>
                </div>
                <button onClick={()=>setMethodOpen(null)} style={{background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:16,padding:'0 4px'}}>✕</button>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                {/* 입력 변수 */}
                <div style={{background:'rgba(15,23,42,0.5)',borderRadius:8,padding:'12px 14px'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>입력 변수</div>
                  {m.inputs.map((inp,j)=>(<div key={j} style={{fontSize:11,color:'#94a3b8',padding:'3px 0',display:'flex',alignItems:'center',gap:6}}>
                    <span style={{color:m.color,fontSize:8}}>●</span>{inp}
                  </div>))}
                </div>

                {/* 스코어링 로직 */}
                <div style={{background:'rgba(15,23,42,0.5)',borderRadius:8,padding:'12px 14px'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>스코어링 로직</div>
                  <div style={{fontSize:11,color:'#94a3b8',lineHeight:1.7}}>{m.logic}</div>
                </div>

                {/* 양호 기준 */}
                <div style={{background:'rgba(52,211,153,0.05)',borderRadius:8,padding:'12px 14px',border:'1px solid rgba(52,211,153,0.1)'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#34d399',marginBottom:6}}>▲ 양호 기준</div>
                  <div style={{fontSize:11,color:'#94a3b8',lineHeight:1.6}}>{m.good}</div>
                </div>

                {/* 위험 기준 */}
                <div style={{background:'rgba(248,113,113,0.05)',borderRadius:8,padding:'12px 14px',border:'1px solid rgba(248,113,113,0.1)'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#f87171',marginBottom:6}}>▼ 위험 신호</div>
                  <div style={{fontSize:11,color:'#94a3b8',lineHeight:1.6}}>{m.bad}</div>
                </div>
              </div>

              {/* 실전 팁 */}
              <div style={{marginTop:12,padding:'10px 14px',borderRadius:8,background:`${m.color}08`,border:`1px solid ${m.color}15`}}>
                <div style={{fontSize:10,fontWeight:700,color:m.color,marginBottom:4}}>실전 팁</div>
                <div style={{fontSize:11,color:'#94a3b8',lineHeight:1.7}}>{m.tip}</div>
              </div>
            </div>
          );
        })()}

        {/* Main Grid */}
        <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>

          {/* Left: Table + Chart */}
          <div style={{flex:'1 1 660px',minWidth:0}}>
            <div style={{background:'rgba(30,41,59,0.4)',borderRadius:12,border:'1px solid rgba(99,102,241,0.12)',overflow:'hidden'}}>
              <div style={{padding:'12px 16px',borderBottom:'1px solid rgba(99,102,241,0.1)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:13,fontWeight:700}}>스코어 랭킹</span>
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{background:'rgba(15,23,42,0.8)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:6,color:'#94a3b8',fontSize:11,padding:'4px 8px'}}>
                  <option value="total">종합점수</option><option value="ac">연율화 캐리</option>
                  {MK.map((k,i)=><option key={k} value={k}>{ML[i]}</option>)}
                </select>
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{background:'rgba(15,23,42,0.5)'}}>
                    <th style={th}>#</th><th style={{...th,textAlign:'left'}}>리츠</th><th style={th}>종합</th>
                    <th style={{...th,color:'#22d3ee'}}>캐리<br/><span style={{fontSize:8,color:'#475569'}}>연율화</span></th>
                    {ML.map(l=><th key={l} style={th}>{l}</th>)}
                    <th style={th}>모멘텀</th><th style={th}>등급</th><th style={th}></th>
                  </tr></thead>
                  <tbody>
                    {scored.map((r,idx)=>{const g=getGrade(r.scores.total),isSel=sel?.id===r.id,cc=cColor(r.ac);
                      return (<tr key={r.id} onClick={()=>setSel(isSel?null:r)}
                        style={{cursor:'pointer',background:isSel?'rgba(99,102,241,0.12)':'transparent',borderBottom:'1px solid rgba(99,102,241,0.06)',transition:'background 0.15s'}}
                        onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background='rgba(99,102,241,0.06)'}}
                        onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background='transparent'}}>
                        <td style={td}>{idx+1}</td>
                        <td style={{...td,textAlign:'left'}}>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <div><div style={{fontWeight:600}}>{r.name}</div><div style={{fontSize:10,color:SC[r.sector]||'#64748b'}}>{r.sector}</div></div>
                            {r.specialDiv&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:4,background:'rgba(251,191,36,0.15)',color:'#fbbf24',fontWeight:700,border:'1px solid rgba(251,191,36,0.3)',whiteSpace:'nowrap'}}>특배</span>}
                          </div>
                        </td>
                        <td style={{...td,fontWeight:800,fontSize:14,color:g.color}}>{r.scores.total}</td>
                        <td style={td}><div style={{display:'inline-flex',alignItems:'baseline',gap:2,padding:'3px 10px',borderRadius:6,background:`${cc}12`,border:`1px solid ${cc}30`}}>
                          <span style={{fontWeight:800,fontSize:14,color:cc}}>{fmtC(r.ac)}</span><span style={{fontSize:9,color:cc,opacity:0.7}}>%</span>
                        </div></td>
                        {MK.map(k=>(<td key={k} style={td}><div style={{display:'inline-block',padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:600,background:`${getGrade(r.scores[k]).color}18`,color:getGrade(r.scores[k]).color}}>{r.scores[k]}</div></td>))}
                        <td style={td}><span style={{color:r.mom.color,fontWeight:700,fontSize:12}}>{r.mom.icon}</span></td>
                        <td style={td}><span style={{display:'inline-block',width:28,height:28,lineHeight:'28px',borderRadius:'50%',textAlign:'center',fontWeight:800,fontSize:11,background:`${g.color}20`,color:g.color,border:`1.5px solid ${g.color}40`}}>{g.grade}</span></td>
                        <td style={td}><button onClick={e=>{e.stopPropagation();startEdit(r);}} style={{background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:6,color:'#818cf8',fontSize:10,padding:'3px 8px',cursor:'pointer'}}>수정</button></td>
                      </tr>);})}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Edit */}
            {editId&&(<div style={{background:'rgba(30,41,59,0.95)',borderRadius:12,border:'1px solid rgba(99,102,241,0.25)',padding:20,marginTop:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <span style={{fontWeight:700,fontSize:14}}>{reits.find(r=>r.id===editId)?.name} 데이터 수정</span>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={saveEdit} style={{background:'linear-gradient(135deg,#6366f1,#4f46e5)',border:'none',borderRadius:8,color:'#fff',fontWeight:700,fontSize:12,padding:'6px 16px',cursor:'pointer'}}>저장</button>
                  <button onClick={()=>setEditId(null)} style={{background:'rgba(100,116,139,0.15)',border:'1px solid rgba(100,116,139,0.2)',borderRadius:8,color:'#94a3b8',fontSize:12,padding:'6px 12px',cursor:'pointer'}}>취소</button>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
                {REIT_FIELDS.map(f=>(<div key={f.key}>
                  <label style={{fontSize:10,color:'#64748b',display:'block',marginBottom:3}}>{f.label}</label>
                  <input type="number" step={f.step} value={editForm[f.key]??''} onChange={e=>setEditForm(p=>({...p,[f.key]:parseFloat(e.target.value)||0}))}
                    style={{width:'100%',background:'rgba(15,23,42,0.8)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:6,color:'#e2e8f0',fontSize:12,padding:'6px 10px',boxSizing:'border-box'}}/>
                </div>))}
              </div>
            </div>)}

            {/* Bar Chart */}
            <div style={{background:'rgba(30,41,59,0.4)',borderRadius:12,border:'1px solid rgba(99,102,241,0.12)',padding:16,marginTop:16}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>종합 스코어 비교</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={scored.map(r=>({name:r.name,total:r.scores.total,sector:r.sector}))} barCategoryGap="20%">
                  <XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis domain={[0,100]} tick={{fill:'#64748b',fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<Tip/>} cursor={{fill:'rgba(99,102,241,0.05)'}}/>
                  <Bar dataKey="total" radius={[4,4,0,0]} maxBarSize={36}>
                    {scored.map((d,i)=><Cell key={i} fill={getGrade(d.scores.total).color+'cc'}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: Detail */}
          <div style={{flex:'0 0 380px',minWidth:340}}>
            {sel ? (<div style={{background:'rgba(30,41,59,0.5)',borderRadius:12,border:'1px solid rgba(99,102,241,0.15)',padding:20,position:'sticky',top:20}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
                <div><h2 style={{margin:0,fontSize:18,fontWeight:800}}>{sel.name}</h2><div style={{fontSize:11,color:SC[sel.sector],marginTop:2}}>{sel.sector} · {sel.ticker}</div></div>
                <div style={{width:44,height:44,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:16,background:`${getGrade(sel.scores.total).color}18`,color:getGrade(sel.scores.total).color,border:`2px solid ${getGrade(sel.scores.total).color}40`}}>{getGrade(sel.scores.total).grade}</div>
              </div>
              {/* Hero */}
              <div style={{display:'flex',justifyContent:'center',alignItems:'flex-end',gap:20,margin:'14px 0 8px'}}>
                <div style={{textAlign:'center'}}><div style={{fontSize:10,color:'#64748b',marginBottom:2}}>종합점수</div><div style={{fontSize:32,fontWeight:900,color:getGrade(sel.scores.total).color,lineHeight:1}}>{sel.scores.total}</div></div>
                <div style={{width:1,height:44,background:'rgba(99,102,241,0.15)'}}/>
                <div style={{textAlign:'center'}}><div style={{fontSize:10,color:'#64748b',marginBottom:2}}>연율화 캐리</div><div style={{fontSize:32,fontWeight:900,color:cColor(sel.ac),lineHeight:1}}>{fmtC(sel.ac)}<span style={{fontSize:14,opacity:0.6}}>%</span></div><div style={{fontSize:9,color:'#475569',marginTop:3}}>Cap {sel.capRate}% + 레버리지 (LTV {sel.ltv}%)</div></div>
              </div>
              <div style={{background:'rgba(15,23,42,0.4)',borderRadius:8,padding:'8px 12px',margin:'6px 0 10px',fontSize:10,color:'#64748b',lineHeight:1.7}}>
                <span style={{color:'#94a3b8',fontWeight:600}}>캐리 분해</span>: Cap {sel.capRate}% + (Cap {sel.capRate}% − 조달 {(sel.fundingRate+rateShock/100).toFixed(1)}%) × D/E {(sel.ltv/(100-sel.ltv)).toFixed(2)} = <span style={{color:cColor(sel.ac),fontWeight:700}}>{fmtC(sel.ac)}%</span>
              </div>
              {/* Radar */}
              <ResponsiveContainer width="100%" height={190}>
                <RadarChart data={radar} cx="50%" cy="50%" outerRadius="68%"><PolarGrid stroke="rgba(99,102,241,0.15)"/><PolarAngleAxis dataKey="metric" tick={{fill:'#94a3b8',fontSize:10}}/><PolarRadiusAxis domain={[0,100]} tick={false} axisLine={false}/><Radar dataKey="score" fill="#6366f1" fillOpacity={0.25} stroke="#6366f1" strokeWidth={2} dot={{r:3,fill:'#6366f1'}}/></RadarChart>
              </ResponsiveContainer>
              {/* Key Metrics */}
              <div style={{fontSize:12,marginTop:4}}>
                <div style={{color:'#64748b',fontSize:10,fontWeight:600,marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>핵심 지표</div>
                {[['배당수익률',`${sel.divYield}%`,'FFO Payout',`${sel.ffoBasedPayout}%`],['조달금리',`${(sel.fundingRate+rateShock/100).toFixed(2)}%`,'Cap Rate',`${sel.capRate}%`],['스프레드',`${Math.round((sel.capRate-sel.fundingRate-rateShock/100)*100)}bp`,'고정금리비중',`${sel.fixedRateRatio}%`],['2Y내 만기',`${sel.debtMaturingIn2Y}%`,'평균잔존만기',`${sel.avgDebtMaturity}Y`],['LTV',`${sel.ltv}%`,'부채비율',`${sel.debtRatio}%`],['임대율',`${sel.occupancy}%`,'WALE',`${sel.wale}Y`]].map(([l1,v1,l2,v2],i)=>(
                  <div key={i} style={{display:'flex',gap:6,marginBottom:5}}>
                    <div style={{flex:1,display:'flex',justifyContent:'space-between',background:'rgba(15,23,42,0.5)',borderRadius:6,padding:'5px 10px'}}><span style={{color:'#64748b'}}>{l1}</span><span style={{fontWeight:700}}>{v1}</span></div>
                    <div style={{flex:1,display:'flex',justifyContent:'space-between',background:'rgba(15,23,42,0.5)',borderRadius:6,padding:'5px 10px'}}><span style={{color:'#64748b'}}>{l2}</span><span style={{fontWeight:700}}>{v2}</span></div>
                  </div>))}
              </div>
              {/* Momentum */}
              <div style={{marginTop:10,padding:'12px 14px',borderRadius:8,background:'rgba(15,23,42,0.4)',border:'1px solid rgba(99,102,241,0.1)'}}>
                <div style={{fontSize:10,fontWeight:700,color:'#64748b',marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>시장 센티먼트 (보조지표)</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                  <div style={{textAlign:'center'}}><div style={{fontSize:9,color:'#475569'}}>P/NAV</div><div style={{fontSize:16,fontWeight:800,color:parseFloat(pNavDisc(sel))<-15?'#34d399':parseFloat(pNavDisc(sel))>0?'#f87171':'#fbbf24'}}>{pNav(sel)}%</div><div style={{fontSize:9,color:'#475569'}}>{pNavDisc(sel)}% 할인</div></div>
                  <div style={{textAlign:'center'}}><div style={{fontSize:9,color:'#475569'}}>3M 수익률</div><div style={{fontSize:16,fontWeight:800,color:sel.ret3m>0?'#34d399':'#f87171'}}>{sel.ret3m>0?'+':''}{sel.ret3m}%</div><div style={{fontSize:9,color:'#475569'}}>6M: {sel.ret6m>0?'+':''}{sel.ret6m}%</div></div>
                  <div style={{textAlign:'center'}}><div style={{fontSize:9,color:'#475569'}}>모멘텀</div><div style={{fontSize:16,fontWeight:800,color:sel.mom.color}}>{sel.mom.icon}</div><div style={{fontSize:9,color:sel.mom.color}}>{sel.mom.label}</div></div>
                </div>
              </div>
              {/* Special Div */}
              {sel.specialDiv&&(<div style={{marginTop:10,padding:'10px 14px',borderRadius:8,background:'rgba(251,191,36,0.06)',border:'1px solid rgba(251,191,36,0.2)'}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}><span style={{fontSize:14}}>⚠</span><span style={{fontSize:11,fontWeight:700,color:'#fbbf24'}}>특별배당 이슈</span></div>
                <div style={{fontSize:11,color:'#94a3b8',lineHeight:1.6}}>{sel.specialDivNote}</div>
                <div style={{fontSize:10,color:'#64748b',marginTop:4,fontStyle:'italic'}}>특별배당 포함 시 배당수익률이 과대계상될 수 있음. FFO Payout과 교차 확인 필요.</div>
              </div>)}
              {/* Note */}
              <div style={{marginTop:10,padding:'10px 14px',borderRadius:8,background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.12)',fontSize:11,color:'#94a3b8',lineHeight:1.6}}>
                <span style={{color:'#6366f1',fontWeight:700}}>Analyst Note</span><br/>{sel.note}
              </div>
              {/* Stress */}
              {rateShock!==0&&(<div style={{marginTop:10,padding:'8px 12px',borderRadius:8,background:rateShock>0?'rgba(248,113,113,0.08)':'rgba(52,211,153,0.08)',border:`1px solid ${rateShock>0?'rgba(248,113,113,0.2)':'rgba(52,211,153,0.2)'}`,fontSize:11}}>
                <span style={{fontWeight:700,color:rateShock>0?'#f87171':'#34d399'}}>Stress Test ({rateShock>=0?'+':''}{rateShock}bp)</span><br/>
                <span style={{color:'#94a3b8'}}>조달금리 {sel.fundingRate}% → {(sel.fundingRate+rateShock/100).toFixed(2)}% · 연율화 캐리 {fmtC(annCarry(sel,0))}% → {fmtC(sel.ac)}%</span>
              </div>)}
            </div>) : (
              <div style={{background:'rgba(30,41,59,0.3)',borderRadius:12,border:'1px dashed rgba(99,102,241,0.2)',padding:40,textAlign:'center',color:'#475569'}}>
                <div style={{fontSize:32,marginBottom:8}}>←</div><div style={{fontSize:13}}>리츠를 선택하면<br/>상세 분석을 보여드립니다</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const th={padding:'10px 6px',textAlign:'center',fontSize:10,fontWeight:600,color:'#64748b',borderBottom:'1px solid rgba(99,102,241,0.1)',whiteSpace:'nowrap'};
const td={padding:'10px 6px',textAlign:'center',whiteSpace:'nowrap'};
