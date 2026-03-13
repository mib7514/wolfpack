'use client';

import { useState, useMemo, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════
// NARRATIVE → INDICATOR KEYWORD MAPS
// ═══════════════════════════════════════════════════════
const KR_MAP = {
  "금리인하": ["한은 기준금리", "국고3Y", "CD 91일", "IRS 1Y"],
  "금리인상": ["한은 기준금리", "국고3Y", "CD 91일", "통안2Y"],
  "인플레이션": ["CPI YoY", "Core CPI", "기대인플레이션", "수입물가"],
  "물가": ["CPI YoY", "Core CPI", "PPI", "농산물가격"],
  "경기둔화": ["GDP 성장률", "경기선행지수", "산업생산", "설비투자"],
  "경기회복": ["GDP 성장률", "경기선행지수", "PMI", "소비자심리지수"],
  "부동산": ["주택가격지수", "PF대출 잔액", "건설투자", "미분양"],
  "환율": ["USD/KRW", "원화 실효환율", "외국인 채권순매수", "경상수지"],
  "수급": ["국채발행계획", "외국인 순매수", "보험/연기금", "MMF 잔고"],
  "크레딧": ["AA- 스프레드", "A+ 스프레드", "회사채 발행", "부도율"],
  "관세": ["수출증감률", "무역수지", "USD/KRW", "제조업 PMI"],
  "재정": ["국채발행계획", "재정수지", "국고채 수급", "국채선물 OI"],
  "한은": ["기준금리", "금통위 의사록", "경제전망", "물가안정목표"],
  "외국인": ["외국인 채권잔고", "외국인 순매수", "CRS", "통화스왑"],
  "PF": ["PF대출 잔액", "브릿지론", "건설업 스프레드", "저축은행"],
  "은행": ["은행 NIM", "가계대출", "BIS비율", "은행채 스프레드"],
  "회사채": ["회사채 발행", "AA- 스프레드", "BBB- 스프레드", "미매각"],
};
const US_MAP = {
  "rate cut": ["Fed Funds Rate", "2Y UST", "FF Futures", "OIS 1Y"],
  "rate hike": ["Fed Funds Rate", "2Y UST", "FF Futures", "SOFR"],
  "inflation": ["CPI YoY", "Core PCE", "5Y BEI", "Wage Growth"],
  "recession": ["GDP", "ISM PMI", "2s10s Curve", "LEI"],
  "employment": ["NFP", "Unemployment", "Initial Claims", "JOLTs"],
  "tariff": ["Trade Balance", "Import Prices", "DXY", "EM FX"],
  "QT": ["Fed Balance Sheet", "RRP", "TGA", "Bank Reserves"],
  "fiscal": ["Treasury Supply", "Budget Deficit", "10Y UST", "MOVE"],
  "AI": ["NASDAQ", "Tech Capex", "IG Spreads", "Semi Index"],
  "geopolitical": ["VIX", "Gold", "Oil", "DXY"],
  "credit": ["IG OAS", "HY OAS", "CDX IG", "Default Rate"],
  "housing": ["Case-Shiller", "Housing Starts", "MBA Apps", "30Y Mortgage"],
  "fed": ["FOMC Dots", "Fed Minutes", "Beige Book", "Fed Speakers"],
  "treasury": ["Auction Results", "Bid-to-Cover", "Foreign Holdings", "TIC"],
  "dollar": ["DXY", "EUR/USD", "USD/JPY", "Real Effective Rate"],
  "oil": ["WTI", "Brent", "OPEC+", "SPR"],
};

// ═══════════════════════════════════════════════════════
// RATE TABLE PARSER
// ═══════════════════════════════════════════════════════
const TENORS = ["3M","6M","9M","1Y","1.5Y","2Y","2.5Y","3Y","4Y","5Y","7Y","10Y","15Y","20Y","30Y"];

function parseRateTable(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const parsed = { date: null, curves: {}, issuers: {} };
  const dateMatch = text.match(/(\d{6})/);
  if (dateMatch) {
    const d = dateMatch[1];
    parsed.date = `20${d.slice(0,2)}.${d.slice(2,4)}.${d.slice(4,6)}`;
  }
  for (const line of lines) {
    const cols = line.split("\t");
    if (cols.length < 7) continue;
    const bondGroup = (cols[1] || "").trim();
    const subGroup = (cols[3] || "").trim();
    const issuer = (cols[4] || "").trim();
    const evalCo = (cols[5] || "").trim();
    if (!evalCo.includes("3사")) continue;
    const yields = {};
    for (let i = 0; i < TENORS.length; i++) {
      const val = parseFloat((cols[6 + i] || "").trim());
      if (!isNaN(val) && val > 0) yields[TENORS[i]] = val;
    }
    if (Object.keys(yields).length < 3) continue;
    const hasCount = cols[2] && /^\d+$/.test(cols[2].trim());
    if (bondGroup === "전체") parsed.curves["국고채"] = yields;
    const allRatings = [
      "공모/무보증 AAA","공모/무보증 AA+","공모/무보증 AA0","공모/무보증 AA-",
      "공모/무보증 A+","공모/무보증 A0","공모/무보증 A-",
      "공모/무보증 BBB+","공모/무보증 BBB0","공모/무보증 BBB-",
      "사모/무보증 AAA","사모/무보증 AA+","사모/무보증 AA0","사모/무보증 AA-",
      "사모/무보증 A+","사모/무보증 A0","사모/무보증 A-",
      "사모/무보증 BBB+","사모/무보증 BBB0","사모/무보증 BBB-",
    ];
    if (allRatings.includes(subGroup) && subGroup === issuer) parsed.curves[subGroup] = yields;
    if (allRatings.includes(bondGroup) && hasCount) parsed.curves[bondGroup] = yields;
    const otherCurves = [
      "은행채 AAA","은행채 AA+","은행채 AA0","은행채 AA-",
      "카드채 AA+","카드채 AA0","카드채 AA-",
      "공사/공단채 정부보증","공사/공단채 AAA","공사/공단채 AA+","공사/공단채 AA0","공사/공단채 AA-",
      "통안증권 이표채","커버드본드 AAA",
    ];
    if (otherCurves.includes(bondGroup) && hasCount) parsed.curves[bondGroup] = yields;
    if (!hasCount && issuer && issuer !== subGroup) {
      const ratingGroup = subGroup || bondGroup;
      if (allRatings.includes(ratingGroup)) {
        if (!parsed.issuers[ratingGroup]) parsed.issuers[ratingGroup] = [];
        parsed.issuers[ratingGroup].push({ name: issuer, yields,
          industry: (cols[cols.length - 1] || "").trim() });
      }
    }
  }
  return parsed;
}

function calcSpread(ktCurve, corpCurve) {
  const sp = {};
  for (const t of TENORS) {
    if (ktCurve[t] != null && corpCurve[t] != null)
      sp[t] = +((corpCurve[t] - ktCurve[t]) * 100).toFixed(1);
  }
  return sp;
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
function interpCurve(kt1y, kt3y) {
  const s = kt3y - kt1y;
  return { "3M":+(kt1y-s*0.7).toFixed(3),"6M":+(kt1y-s*0.5).toFixed(3),"9M":+(kt1y-s*0.2).toFixed(3),
    "1Y":kt1y,"1.5Y":+(kt1y+s*0.3).toFixed(3),"2Y":+(kt1y+s*0.5).toFixed(3),"2.5Y":+(kt1y+s*0.75).toFixed(3),
    "3Y":kt3y,"4Y":+(kt3y+s*0.25).toFixed(3),"5Y":+(kt3y+s*0.45).toFixed(3),"7Y":+(kt3y+s*0.65).toFixed(3),
    "10Y":+(kt3y+s*0.80).toFixed(3),"15Y":+(kt3y+s*0.85).toFixed(3),"20Y":+(kt3y+s*0.82).toFixed(3),
    "30Y":+(kt3y+s*0.72).toFixed(3) };
}
function interpSpread(sp1y, sp3y) {
  const s = sp3y - sp1y;
  return { "3M":+(sp1y-s*0.6).toFixed(1),"6M":+(sp1y-s*0.4).toFixed(1),"9M":+(sp1y-s*0.15).toFixed(1),
    "1Y":sp1y,"1.5Y":+(sp1y+s*0.3).toFixed(1),"2Y":+(sp1y+s*0.5).toFixed(1),"2.5Y":+(sp1y+s*0.75).toFixed(1),
    "3Y":sp3y,"4Y":+(sp3y+s*0.15).toFixed(1),"5Y":+(sp3y+s*0.3).toFixed(1) };
}
function extractIndicators(text, map) {
  const found = new Set();
  const lower = text.toLowerCase();
  Object.entries(map).forEach(([key, inds]) => { if (lower.includes(key.toLowerCase())) inds.forEach(i => found.add(i)); });
  return [...found];
}
function kellyCalc(scenarios, maxDev) {
  const total = scenarios.reduce((s, sc) => s + sc.prob, 0);
  if (total === 0) return { full:0,half:0,quarter:0,ir:0,eDy:0,stdDy:0,fraction:0,direction:"NEUTRAL" };
  const norm = scenarios.map(sc => ({ ...sc, prob: sc.prob / total }));
  const eDy = norm.reduce((s, sc) => s + sc.prob * sc.dy, 0);
  const eDy2 = norm.reduce((s, sc) => s + sc.prob * sc.dy * sc.dy, 0);
  const stdDy = Math.sqrt(Math.max(0, eDy2 - eDy * eDy));
  const ir = stdDy > 0.01 ? Math.abs(eDy) / stdDy : 0;
  const frac = Math.tanh(ir);
  const dir = eDy < 0 ? 1 : eDy > 0 ? -1 : 0;
  return { full:+(dir*frac*maxDev).toFixed(3), half:+(dir*frac*maxDev/2).toFixed(3),
    quarter:+(dir*frac*maxDev/4).toFixed(3), ir:+ir.toFixed(3), eDy:+eDy.toFixed(2),
    stdDy:+stdDy.toFixed(2), fraction:+(frac*100).toFixed(1), direction: dir>0?"LONG":dir<0?"SHORT":"NEUTRAL" };
}

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const S = { bg:"#0b1017",surface:"#111922",elevated:"#192230",border:"#263040",
  text:"#c8d4e0",dim:"#687888",accent:"#e8a020",green:"#28c860",red:"#f04858",blue:"#4090e0" };
const baseInput = { background:S.elevated,border:`1px solid ${S.border}`,color:S.text,
  padding:"6px 8px",borderRadius:4,fontSize:13,width:"100%",textAlign:"right",outline:"none",
  fontFamily:"'JetBrains Mono','Fira Code',monospace",boxSizing:"border-box" };

function NumInput({value,onChange,step=0.01,style={}}) {
  return <input type="number" step={step} value={value} onChange={e=>onChange(parseFloat(e.target.value)||0)}
    style={{...baseInput,...style}} onFocus={e=>e.target.select()} />;
}
function Badge({children,color=S.accent}) {
  return <span style={{background:color+"22",color,padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{children}</span>;
}
function SectionTitle({children,sub}) {
  return <div style={{marginBottom:16}}><div style={{color:S.accent,fontSize:14,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase"}}>{children}</div>
    {sub&&<div style={{color:S.dim,fontSize:12,marginTop:2}}>{sub}</div>}</div>;
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function DurationCommander() {
  const [tab,setTab]=useState("scenario");
  const fileRef=useRef(null);
  const [uploadedData,setUploadedData]=useState(null);
  const [uploadStatus,setUploadStatus]=useState(null);
  const [curKt1y,setCurKt1y]=useState(2.736);
  const [curKt3y,setCurKt3y]=useState(3.185);
  const [curAa1y,setCurAa1y]=useState(28);
  const [curAa3y,setCurAa3y]=useState(43);
  const [rateSc,setRateSc]=useState([
    {name:"강세",prob:30,m1_1y:2.60,m1_3y:3.05,m3_1y:2.45,m3_3y:2.90},
    {name:"기본",prob:50,m1_1y:2.73,m1_3y:3.18,m3_1y:2.70,m3_3y:3.15},
    {name:"약세",prob:20,m1_1y:2.85,m1_3y:3.30,m3_1y:2.95,m3_3y:3.45},
  ]);
  const [spSc,setSpSc]=useState([
    {name:"축소",prob:25,m1_1y:22,m1_3y:38,m3_1y:18,m3_3y:33},
    {name:"기본",prob:55,m1_1y:28,m1_3y:43,m3_1y:26,m3_3y:42},
    {name:"확대",prob:20,m1_1y:35,m1_3y:55,m3_1y:40,m3_3y:62},
  ]);
  const [neutralDur,setNeutralDur]=useState(1.50);
  const [maxDev,setMaxDev]=useState(0.50);
  const [narr,setNarr]=useState({kr:{daily:"",weekly:"",monthly:"",quarterly:""},us:{daily:"",weekly:"",monthly:"",quarterly:""}});

  const handleFileUpload=useCallback((e)=>{
    const file=e.target.files[0]; if(!file) return;
    setUploadStatus("파싱 중...");
    const reader=new FileReader();
    reader.onload=(evt)=>{
      try {
        let text;
        const bytes=new Uint8Array(evt.target.result);
        try { const dec=new TextDecoder("euc-kr"); text=dec.decode(bytes);
          if(!text.includes("채권그룹")&&!text.includes("국고채")) text=new TextDecoder("utf-8").decode(bytes);
        } catch { text=new TextDecoder("utf-8").decode(bytes); }
        const parsed=parseRateTable(text); setUploadedData(parsed);
        const kt=parsed.curves["국고채"]; const aa=parsed.curves["공모/무보증 AA-"];
        if(kt){ if(kt["1Y"])setCurKt1y(kt["1Y"]); if(kt["3Y"])setCurKt3y(kt["3Y"]); }
        if(kt&&aa){
          if(kt["1Y"]&&aa["1Y"])setCurAa1y(+((aa["1Y"]-kt["1Y"])*100).toFixed(1));
          if(kt["3Y"]&&aa["3Y"])setCurAa3y(+((aa["3Y"]-kt["3Y"])*100).toFixed(1));
        }
        const cc=Object.keys(parsed.curves).length;
        const ic=Object.values(parsed.issuers).reduce((s,a)=>s+a.length,0);
        setUploadStatus(`✅ ${parsed.date||"날짜미상"} 기준 | ${cc}개 커브, ${ic}개 발행사 로드 완료`);
      } catch(err){ setUploadStatus(`❌ 파싱 실패: ${err.message}`); }
    };
    reader.readAsArrayBuffer(file);
  },[]);

  const updRate=useCallback((i,f,v)=>{setRateSc(p=>p.map((s,j)=>j===i?{...s,[f]:v}:s));},[]);
  const updSpread=useCallback((i,f,v)=>{setSpSc(p=>p.map((s,j)=>j===i?{...s,[f]:v}:s));},[]);
  const updNarr=useCallback((c,tf,v)=>{setNarr(p=>({...p,[c]:{...p[c],[tf]:v}}));},[]);

  const combined=useMemo(()=>{
    const combos=[];
    rateSc.forEach((r,ri)=>{spSc.forEach((s,si)=>{
      combos.push({id:`${ri}-${si}`,rName:r.name,sName:s.name,prob:+((r.prob/100)*(s.prob/100)*100).toFixed(2),
        m1:{kt1y:r.m1_1y,kt3y:r.m1_3y,aa1y:s.m1_1y,aa3y:s.m1_3y},
        m3:{kt1y:r.m3_1y,kt3y:r.m3_3y,aa1y:s.m3_1y,aa3y:s.m3_3y}});
    });});
    return combos.sort((a,b)=>b.prob-a.prob);
  },[rateSc,spSc]);
  const top3=useMemo(()=>combined.slice(0,3),[combined]);

  const projected=useMemo(()=>{
    const tp=top3.reduce((s,c)=>s+c.prob,0); if(tp===0) return null;
    const calc=(h)=>{
      let w1=0,w3=0,ws1=0,ws3=0;
      top3.forEach(c=>{const w=c.prob/tp; w1+=w*c[h].kt1y; w3+=w*c[h].kt3y; ws1+=w*c[h].aa1y; ws3+=w*c[h].aa3y;});
      const kt=interpCurve(w1,w3), sp=interpSpread(ws1,ws3), aa={};
      Object.keys(kt).forEach(t=>{if(sp[t]!=null) aa[t]=+(kt[t]+sp[t]/100).toFixed(3);});
      return {kt,sp,aa};
    };
    return {m1:calc("m1"),m3:calc("m3")};
  },[top3]);

  const kellyResult=useMemo(()=>{
    if(!projected) return null;
    const tp=top3.reduce((s,c)=>s+c.prob,0);
    const calc=(h)=>{
      const sc=top3.map(c=>({dy:(c[h].kt3y-curKt3y)*100,prob:c.prob/tp}));
      const ssc=top3.map(c=>({d:c[h].aa3y-curAa3y,prob:c.prob/tp}));
      const eS=ssc.reduce((s,x)=>s+x.prob*x.d,0);
      return {...kellyCalc(sc,maxDev),eSpread:+eS.toFixed(1)};
    };
    return {m1:calc("m1"),m3:calc("m3")};
  },[top3,projected,curKt3y,curAa3y,maxDev]);

  const narrIndicators=useMemo(()=>{
    const r={};
    ["kr","us"].forEach(c=>{r[c]={};const m=c==="kr"?KR_MAP:US_MAP;
      ["daily","weekly","monthly","quarterly"].forEach(tf=>{r[c][tf]=narr[c][tf]?extractIndicators(narr[c][tf],m):[];});});
    return r;
  },[narr]);

  const curveDisplay=useMemo(()=>{
    if(!uploadedData) return null;
    const kt=uploadedData.curves["국고채"]; if(!kt) return null;
    const ratings=["공모/무보증 AAA","공모/무보증 AA+","공모/무보증 AA0","공모/무보증 AA-",
      "공모/무보증 A+","공모/무보증 A0","공모/무보증 A-"].filter(r=>uploadedData.curves[r]);
    const spreads={}; ratings.forEach(r=>{spreads[r]=calcSpread(kt,uploadedData.curves[r]);});
    return {kt,ratings,curves:uploadedData.curves,spreads};
  },[uploadedData]);

  const tabs=[{id:"scenario",icon:"◈",label:"시나리오 엔진"},{id:"kelly",icon:"⊕",label:"듀레이션 포지셔닝"},{id:"narrative",icon:"◉",label:"내러티브 트래커"}];

  return (
    <div style={{background:S.bg,color:S.text,minHeight:"100vh",fontFamily:"'Pretendard',-apple-system,sans-serif",fontSize:13}}>
      {/* Header */}
      <div style={{padding:"20px 24px 0",borderBottom:`1px solid ${S.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
          <span style={{fontSize:20}}>🐺</span>
          <span style={{color:S.accent,fontSize:11,fontWeight:700,letterSpacing:2}}>WOLF PACK — ENGINE ①</span>
        </div>
        <h1 style={{fontSize:22,fontWeight:800,margin:"4px 0 12px",letterSpacing:-0.5,color:"#fff"}}>Duration Commander</h1>

        {/* File Upload */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,padding:"10px 14px",background:S.surface,borderRadius:6,border:`1px solid ${S.border}`}}>
          <span style={{fontSize:16}}>📋</span>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:600,color:S.dim,marginBottom:2}}>예상금리판 업로드</div>
            <div style={{fontSize:11,color:uploadStatus?.startsWith("✅")?S.green:uploadStatus?.startsWith("❌")?S.red:S.dim}}>
              {uploadStatus||"탭 구분 금리판 파일(.txt)을 업로드하면 현재 금리를 자동 반영합니다"}
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".txt,.csv,.tsv" onChange={handleFileUpload} style={{display:"none"}} />
          <button onClick={()=>fileRef.current?.click()} style={{background:S.accent,color:"#000",border:"none",padding:"7px 16px",borderRadius:4,fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>파일 선택</button>
        </div>

        <div style={{display:"flex",gap:0}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              background:tab===t.id?S.surface:"transparent",color:tab===t.id?S.accent:S.dim,
              border:`1px solid ${tab===t.id?S.border:"transparent"}`,
              borderBottom:tab===t.id?`1px solid ${S.surface}`:`1px solid ${S.border}`,
              padding:"10px 20px",cursor:"pointer",fontSize:12,fontWeight:600,
              borderRadius:"6px 6px 0 0",marginBottom:-1,transition:"all 0.2s",letterSpacing:0.5}}>
              <span style={{marginRight:6}}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:24}}>
        {/* ═══ TAB 1: SCENARIO ═══ */}
        {tab==="scenario"&&(
          <div>
            {curveDisplay&&(
              <div style={{marginBottom:28}}>
                <SectionTitle sub={`${uploadedData.date||""} 기준 업로드 금리판`}>UPLOADED RATE TABLE</SectionTitle>
                <div style={{background:S.surface,borderRadius:8,border:`1px solid ${S.border}`,overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead><tr style={{color:S.dim,fontSize:10,fontWeight:600}}>
                      <th style={{padding:"6px 8px",textAlign:"left",position:"sticky",left:0,background:S.surface,zIndex:1,minWidth:120}}>구분</th>
                      {TENORS.map(t=><th key={t} style={{padding:"6px 3px",textAlign:"right",whiteSpace:"nowrap"}}>{t}</th>)}
                    </tr></thead>
                    <tbody>
                      <tr style={{background:S.elevated}}>
                        <td style={{padding:"5px 8px",fontWeight:700,color:"#fff",position:"sticky",left:0,background:S.elevated}}>국고채</td>
                        {TENORS.map(t=><td key={t} style={{padding:"5px 3px",textAlign:"right",fontFamily:"monospace"}}>{curveDisplay.kt[t]!=null?curveDisplay.kt[t].toFixed(3):"-"}</td>)}
                      </tr>
                      {curveDisplay.ratings.map(r=>(
                        <tr key={r} style={{borderBottom:`1px solid ${S.border}22`,background:r==="공모/무보증 AA-"?S.accent+"08":"transparent"}}>
                          <td style={{padding:"5px 8px",fontWeight:r==="공모/무보증 AA-"?700:400,color:r==="공모/무보증 AA-"?S.accent:S.text,
                            position:"sticky",left:0,background:r==="공모/무보증 AA-"?S.accent+"08":S.surface,fontSize:11}}>
                            {r.replace("공모/무보증 ","")} sp
                          </td>
                          {TENORS.map(t=>{const sp=curveDisplay.spreads[r]?.[t];
                            return <td key={t} style={{padding:"5px 3px",textAlign:"right",fontFamily:"monospace",fontSize:10,color:sp!=null?S.text:S.dim}}>
                              {sp!=null?`${sp>0?"+":""}${sp.toFixed(0)}`:"-"}</td>;})}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <SectionTitle sub="현재 금리 (업로드 시 자동반영, 수동 수정 가능)">CURRENT MARKET</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:28}}>
              {[["국고 1Y (%)",curKt1y,setCurKt1y],["국고 3Y (%)",curKt3y,setCurKt3y],
                ["AA- 스프레드 1Y (bp)",curAa1y,setCurAa1y,1],["AA- 스프레드 3Y (bp)",curAa3y,setCurAa3y,1]].map(([l,v,fn,st],i)=>(
                <div key={i} style={{background:S.surface,padding:12,borderRadius:6,border:`1px solid ${S.border}`}}>
                  <div style={{color:S.dim,fontSize:11,marginBottom:6,fontWeight:600}}>{l}</div>
                  <NumInput value={v} onChange={fn} step={st||0.01}/>
                </div>))}
            </div>

            <SectionTitle sub="국고채 금리 시나리오 3가지 (절대 수준, %)">RATE SCENARIOS</SectionTitle>
            <div style={{overflowX:"auto",marginBottom:28}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{color:S.dim,fontSize:11,fontWeight:600}}>
                  {["시나리오","확률(%)","1M후 국고1Y","1M후 국고3Y","3M후 국고1Y","3M후 국고3Y"].map((h,i)=>
                    <th key={i} style={{padding:"8px 6px",textAlign:i>0?"right":"left",borderBottom:`1px solid ${S.border}`,whiteSpace:"nowrap"}}>{h}</th>)}
                </tr></thead>
                <tbody>{rateSc.map((sc,i)=>(
                  <tr key={i} style={{borderBottom:`1px solid ${S.border}22`}}>
                    <td style={{padding:"6px"}}><input value={sc.name} onChange={e=>updRate(i,"name",e.target.value)} style={{...baseInput,textAlign:"left",fontWeight:600,width:80}}/></td>
                    {["prob","m1_1y","m1_3y","m3_1y","m3_3y"].map(f=>
                      <td key={f} style={{padding:"4px 3px"}}><NumInput value={sc[f]} onChange={v=>updRate(i,f,v)} step={f==="prob"?5:0.05}/></td>)}
                  </tr>))}</tbody>
              </table>
            </div>

            <SectionTitle sub="AA-(무보증) 스프레드 시나리오 3가지 (bp)">SPREAD SCENARIOS</SectionTitle>
            <div style={{overflowX:"auto",marginBottom:28}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{color:S.dim,fontSize:11,fontWeight:600}}>
                  {["시나리오","확률(%)","1M후 AA-1Y","1M후 AA-3Y","3M후 AA-1Y","3M후 AA-3Y"].map((h,i)=>
                    <th key={i} style={{padding:"8px 6px",textAlign:i>0?"right":"left",borderBottom:`1px solid ${S.border}`}}>{h}</th>)}
                </tr></thead>
                <tbody>{spSc.map((sc,i)=>(
                  <tr key={i} style={{borderBottom:`1px solid ${S.border}22`}}>
                    <td style={{padding:"6px"}}><input value={sc.name} onChange={e=>updSpread(i,"name",e.target.value)} style={{...baseInput,textAlign:"left",fontWeight:600,width:80}}/></td>
                    {["prob","m1_1y","m1_3y","m3_1y","m3_3y"].map(f=>
                      <td key={f} style={{padding:"4px 3px"}}><NumInput value={sc[f]} onChange={v=>updSpread(i,f,v)} step={f==="prob"?5:1}/></td>)}
                  </tr>))}</tbody>
              </table>
            </div>

            <SectionTitle sub="금리 × 스프레드 조합 (결합확률 순, Top 3 하이라이트) — 9개 레짐">COMBINED SCENARIOS — 9 MATRIX</SectionTitle>
            <div style={{overflowX:"auto",marginBottom:28}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{color:S.dim,fontSize:11,fontWeight:600}}>
                  {["#","금리","스프레드","결합확률","1M 국고3Y","1M AA-sp","3M 국고3Y","3M AA-sp"].map((h,i)=>
                    <th key={i} style={{padding:"8px 6px",textAlign:i>2?"right":"left",borderBottom:`1px solid ${S.border}`,whiteSpace:"nowrap"}}>{h}</th>)}
                </tr></thead>
                <tbody>{combined.map((c,i)=>{const isTop=i<3;return(
                  <tr key={c.id} style={{background:isTop?S.accent+"08":"transparent",borderLeft:isTop?`3px solid ${S.accent}`:"3px solid transparent",borderBottom:`1px solid ${S.border}22`}}>
                    <td style={{padding:"6px 8px",color:isTop?S.accent:S.dim,fontWeight:700}}>{isTop?`★${i+1}`:i+1}</td>
                    <td style={{padding:"6px 8px",fontWeight:isTop?600:400}}>{c.rName}</td>
                    <td style={{padding:"6px 8px",fontWeight:isTop?600:400}}>{c.sName}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",fontWeight:700,color:isTop?S.accent:S.text,fontFamily:"monospace"}}>{c.prob.toFixed(1)}%</td>
                    <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"monospace"}}>{c.m1.kt3y.toFixed(2)}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"monospace"}}>{c.m1.aa3y}bp</td>
                    <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"monospace"}}>{c.m3.kt3y.toFixed(2)}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"monospace"}}>{c.m3.aa3y}bp</td>
                  </tr>);})}</tbody>
              </table>
            </div>

            {projected&&(<>
              <SectionTitle sub="Top 3 확률가중 예상 금리판 (보간 포함)">PROJECTED RATE TABLE</SectionTitle>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                {["m1","m3"].map(h=>{const p=projected[h];const label=h==="m1"?"1개월 후":"3개월 후";return(
                  <div key={h} style={{background:S.surface,borderRadius:8,border:`1px solid ${S.border}`,overflow:"hidden"}}>
                    <div style={{padding:"10px 14px",background:S.elevated,borderBottom:`1px solid ${S.border}`,color:S.accent,fontSize:12,fontWeight:700}}>📊 {label} 예상 금리판</div>
                    <div style={{padding:12,overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                        <thead><tr style={{color:S.dim,fontSize:10,fontWeight:600}}>
                          <th style={{padding:"4px 6px",textAlign:"left",minWidth:55}}>구분</th>
                          {TENORS.map(t=><th key={t} style={{padding:"4px 2px",textAlign:"right",whiteSpace:"nowrap"}}>{t}</th>)}
                        </tr></thead>
                        <tbody>
                          <tr><td style={{padding:"4px 6px",color:S.dim,fontWeight:600}}>국고채</td>
                            {TENORS.map(t=>{const proj=p.kt[t];const cur=uploadedData?.curves?.["국고채"]?.[t];
                              const diff=proj!=null&&cur!=null?((proj-cur)*100).toFixed(1):null;
                              return <td key={t} style={{padding:"4px 2px",textAlign:"right",fontFamily:"monospace"}}>
                                <div>{proj!=null?(+proj).toFixed(2):"-"}</div>
                                {diff!=null&&<div style={{fontSize:9,color:parseFloat(diff)<0?S.green:parseFloat(diff)>0?S.red:S.dim}}>{parseFloat(diff)>0?"+":""}{diff}</div>}
                              </td>;})}</tr>
                          <tr><td style={{padding:"4px 6px",color:S.dim,fontWeight:600}}>AA- sp</td>
                            {TENORS.map(t=><td key={t} style={{padding:"4px 2px",textAlign:"right",fontFamily:"monospace"}}>{p.sp[t]!=null?`${(+p.sp[t]).toFixed(0)}`:"-"}</td>)}</tr>
                          <tr style={{borderTop:`1px solid ${S.border}`}}><td style={{padding:"4px 6px",color:S.accent,fontWeight:700}}>AA-금리</td>
                            {TENORS.map(t=><td key={t} style={{padding:"4px 2px",textAlign:"right",fontFamily:"monospace",fontWeight:600}}>{p.aa[t]!=null?(+p.aa[t]).toFixed(2):"-"}</td>)}</tr>
                        </tbody>
                      </table>
                    </div>
                  </div>);})}
              </div>
            </>)}
          </div>
        )}

        {/* ═══ TAB 2: KELLY ═══ */}
        {tab==="kelly"&&(
          <div>
            <SectionTitle sub="뉴트럴 듀레이션 및 최대 이탈폭 설정">POSITION PARAMETERS</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:28}}>
              <div style={{background:S.surface,padding:14,borderRadius:6,border:`1px solid ${S.border}`}}>
                <div style={{color:S.dim,fontSize:11,marginBottom:6,fontWeight:600}}>뉴트럴 듀레이션 (년)</div>
                <NumInput value={neutralDur} onChange={setNeutralDur} step={0.1}/>
              </div>
              <div style={{background:S.surface,padding:14,borderRadius:6,border:`1px solid ${S.border}`}}>
                <div style={{color:S.dim,fontSize:11,marginBottom:6,fontWeight:600}}>최대 이탈폭 (±년)</div>
                <NumInput value={maxDev} onChange={setMaxDev} step={0.1}/>
              </div>
            </div>
            {kellyResult&&["m1","m3"].map(h=>{const k=kellyResult[h];const label=h==="m1"?"1개월":"3개월";
              const irC=k.ir>=0.75?S.green:k.ir>=0.3?S.accent:S.dim;return(
              <div key={h} style={{background:S.surface,borderRadius:8,border:`1px solid ${S.border}`,marginBottom:20,overflow:"hidden"}}>
                <div style={{padding:"12px 16px",background:S.elevated,borderBottom:`1px solid ${S.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                  <span style={{color:S.accent,fontSize:13,fontWeight:700}}>⊕ {label} 듀레이션 포지셔닝</span>
                  <div style={{display:"flex",gap:8}}>
                    <Badge color={k.direction==="LONG"?S.green:k.direction==="SHORT"?S.red:S.dim}>{k.direction}</Badge>
                    <Badge color={irC}>IR {k.ir}</Badge><Badge>켈리 {k.fraction}%</Badge>
                  </div>
                </div>
                <div style={{padding:16}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
                    {[["기대 금리변화",`${k.eDy>0?"+":""}${k.eDy}bp`,k.eDy<0?S.green:k.eDy>0?S.red:S.dim],
                      ["변동성(σ)",`${k.stdDy}bp`,S.text],
                      ["스프레드 변화",`${k.eSpread>0?"+":""}${k.eSpread}bp`,k.eSpread<0?S.green:k.eSpread>0?S.red:S.dim],
                      ["Information Ratio",k.ir,irC]].map(([l,v,c],i)=>(
                      <div key={i} style={{textAlign:"center"}}><div style={{color:S.dim,fontSize:10,fontWeight:600,marginBottom:4}}>{l}</div>
                        <div style={{color:c,fontSize:18,fontWeight:800,fontFamily:"monospace"}}>{v}</div></div>))}
                  </div>
                  <div style={{marginBottom:16}}>
                    <div style={{position:"relative",height:44,background:S.elevated,borderRadius:6,border:`1px solid ${S.border}`,overflow:"hidden"}}>
                      <div style={{position:"absolute",left:"50%",top:0,bottom:0,width:2,background:S.dim+"40",zIndex:1}}/>
                      {[{dev:k.quarter,label:"Q¼",op:0.35},{dev:k.half,label:"H½",op:0.55},{dev:k.full,label:"F",op:0.85}].map((it,idx)=>{
                        const pct=50+(maxDev>0?(it.dev/maxDev)*45:0);return(
                        <div key={idx} style={{position:"absolute",left:`${Math.max(2,Math.min(96,pct))}%`,top:4,bottom:4,width:30,marginLeft:-15,
                          borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",
                          background:(it.dev>0?S.green:it.dev<0?S.red:S.dim)+Math.round(it.op*255).toString(16).padStart(2,"0"),
                          color:"#fff",fontSize:10,fontWeight:800,zIndex:2}}>{it.label}</div>);})}
                      <div style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",fontSize:9,color:S.dim}}>SHORT -{maxDev}y</div>
                      <div style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",fontSize:9,color:S.dim}}>LONG +{maxDev}y</div>
                    </div>
                  </div>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{color:S.dim,fontSize:10,fontWeight:600}}>
                      {["포지션","듀레이션 이탈","목표 듀레이션","기대 손익(bp)","최악 시나리오"].map((hd,i)=>
                        <th key={i} style={{padding:"6px 8px",textAlign:i>0?"right":"left",borderBottom:`1px solid ${S.border}`}}>{hd}</th>)}
                    </tr></thead>
                    <tbody>{[["뉴트럴",0],["Quarter Kelly",k.quarter],["Half Kelly",k.half],["Full Kelly",k.full]].map(([name,dev],i)=>{
                      const tD=+(neutralDur+dev).toFixed(3);const eP=+(dev*(-k.eDy)).toFixed(2);
                      const wD=k.direction==="LONG"?Math.max(...top3.map(c=>(c[h].kt3y-curKt3y)*100)):Math.min(...top3.map(c=>(c[h].kt3y-curKt3y)*100));
                      const wP=+(-dev*wD).toFixed(2);return(
                      <tr key={i} style={{background:i===0?"transparent":i===3?S.elevated:`${S.elevated}${i===2?"88":"44"}`,borderBottom:`1px solid ${S.border}22`}}>
                        <td style={{padding:"8px",fontWeight:600,color:i===0?S.dim:i===3?S.accent:S.text}}>{name}</td>
                        <td style={{padding:"8px",textAlign:"right",fontFamily:"monospace"}}>{dev>0?"+":""}{dev.toFixed(3)}y</td>
                        <td style={{padding:"8px",textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#fff"}}>{tD.toFixed(2)}y</td>
                        <td style={{padding:"8px",textAlign:"right",fontFamily:"monospace",color:eP>0?S.green:eP<0?S.red:S.dim}}>{eP>0?"+":""}{eP}</td>
                        <td style={{padding:"8px",textAlign:"right",fontFamily:"monospace",color:wP<0?S.red:S.dim,fontSize:11}}>{wP>0?"+":""}{wP}</td>
                      </tr>);})}</tbody>
                  </table>
                </div>
              </div>);})}
            <div style={{background:S.surface,borderRadius:8,border:`1px solid ${S.border}`,padding:16}}>
              <div style={{color:S.dim,fontSize:11,fontWeight:600,marginBottom:8}}>📐 KELLY SIZING GUIDE</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,fontSize:11}}>
                {[["IR < 0.25","약한 시그널","Quarter Kelly 권장",S.dim],["0.25 ≤ IR < 0.5","보통 시그널","Half Kelly 적정",S.text],
                  ["0.5 ≤ IR < 1.0","강한 시그널","Half~Full Kelly",S.accent],["IR ≥ 1.0","매우 강한 시그널","Full Kelly 가능",S.green]].map(([r,sg,rc,c],i)=>(
                  <div key={i} style={{background:S.elevated,padding:10,borderRadius:4,border:`1px solid ${S.border}`}}>
                    <div style={{color:c,fontWeight:700,marginBottom:2}}>{r}</div><div style={{color:S.dim}}>{sg}</div>
                    <div style={{color:S.text,marginTop:4}}>{rc}</div></div>))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB 3: NARRATIVE ═══ */}
        {tab==="narrative"&&(
          <div>
            <SectionTitle sub="내러티브 입력 → 핵심 모니터링 지표 자동 매핑 → 시나리오 가정 지원">NARRATIVE → INDICATOR ENGINE</SectionTitle>
            {[{key:"kr",flag:"🇰🇷",label:"KOREA",ph:{daily:"예: 한은 금리인하 기대, 원화 약세 압력",weekly:"예: 크레딧 스프레드 확대, 은행채 수급 양호",monthly:"예: 경기둔화 우려, 재정확대 기대",quarterly:"예: 금리인하 사이클, PF 리스크 완화"}},
              {key:"us",flag:"🇺🇸",label:"UNITED STATES",ph:{daily:"예: rate cut expectations, employment",weekly:"예: treasury supply, credit spreads",monthly:"예: inflation sticky, fed hawkish",quarterly:"예: recession risk, QT tapering"}}
            ].map(({key,flag,label,ph})=>(
              <div key={key} style={{background:S.surface,borderRadius:8,border:`1px solid ${S.border}`,marginBottom:20,overflow:"hidden"}}>
                <div style={{padding:"12px 16px",background:S.elevated,borderBottom:`1px solid ${S.border}`,color:S.accent,fontSize:13,fontWeight:700}}>{flag} {label}</div>
                <div style={{padding:16}}>
                  {[{tf:"quarterly",label:"분기 내러티브",icon:"🏛️",desc:"6~12개월 구조적 테마"},
                    {tf:"monthly",label:"월간 내러티브",icon:"📅",desc:"1~3개월 방향성"},
                    {tf:"weekly",label:"주간 내러티브",icon:"📊",desc:"이번 주 핵심 테마"},
                    {tf:"daily",label:"일간 내러티브",icon:"⚡",desc:"오늘의 촉매"}].map(({tf,label:tl,icon,desc})=>{
                    const text=narr[key][tf];const inds=narrIndicators[key][tf];return(
                    <div key={tf} style={{marginBottom:16,padding:12,background:S.elevated,borderRadius:6,border:`1px solid ${S.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                        <div><span style={{marginRight:6}}>{icon}</span><span style={{fontWeight:700,fontSize:12}}>{tl}</span>
                          <span style={{color:S.dim,fontSize:10,marginLeft:8}}>{desc}</span></div>
                        {inds.length>0&&<Badge color={S.blue}>{inds.length}개 지표</Badge>}
                      </div>
                      <textarea value={text} onChange={e=>updNarr(key,tf,e.target.value)} placeholder={ph[tf]} rows={2}
                        style={{width:"100%",background:S.bg,border:`1px solid ${S.border}`,color:S.text,padding:"8px 10px",
                          borderRadius:4,fontSize:12,resize:"vertical",outline:"none",lineHeight:1.5,boxSizing:"border-box",
                          fontFamily:"'Pretendard',sans-serif"}}/>
                      {inds.length>0&&<div style={{marginTop:8,display:"flex",flexWrap:"wrap",gap:4}}>
                        {inds.map((ind,i)=><span key={i} style={{background:S.blue+"18",color:S.blue,padding:"2px 8px",borderRadius:3,fontSize:10,fontWeight:600,border:`1px solid ${S.blue}30`}}>{ind}</span>)}
                      </div>}
                    </div>);})}
                </div>
              </div>
            ))}
            <div style={{background:S.surface,borderRadius:8,border:`1px solid ${S.border}`,padding:16}}>
              <SectionTitle sub="모든 내러티브에서 추출된 핵심 지표 종합">MONITORING DASHBOARD</SectionTitle>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                {[{key:"kr",flag:"🇰🇷",label:"한국"},{key:"us",flag:"🇺🇸",label:"미국"}].map(({key,flag,label})=>{
                  const all=new Set();Object.values(narrIndicators[key]).forEach(x=>x.forEach(i=>all.add(i)));const sorted=[...all].sort();return(
                  <div key={key}><div style={{color:S.accent,fontSize:12,fontWeight:700,marginBottom:8}}>{flag} {label} — {sorted.length}개 지표</div>
                    {sorted.length===0?<div style={{color:S.dim,fontSize:11,fontStyle:"italic"}}>내러티브를 입력하면 지표가 자동 매핑됩니다</div>:
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{sorted.map((ind,i)=>{
                      const cnt=Object.values(narrIndicators[key]).filter(x=>x.includes(ind)).length;
                      const clr=cnt>=3?S.accent:cnt>=2?S.blue:S.dim;return(
                      <span key={i} style={{background:clr+"15",color:clr,padding:"3px 8px",borderRadius:3,fontSize:10,fontWeight:600,border:`1px solid ${clr}30`}}>
                        {ind}{cnt>1&&<span style={{opacity:0.6}}> ×{cnt}</span>}</span>);})}</div>}
                  </div>);})}
              </div>
              <div style={{marginTop:20,padding:14,background:S.accent+"10",borderRadius:6,border:`1px solid ${S.accent}30`}}>
                <div style={{color:S.accent,fontSize:11,fontWeight:700,marginBottom:6}}>💡 시나리오 가정 제안 → 시나리오 엔진 Tab 반영</div>
                <div style={{color:S.text,fontSize:12,lineHeight:1.6,whiteSpace:"pre-line"}}>
                  {(()=>{const ka=Object.values(narrIndicators.kr).flat();const ua=Object.values(narrIndicators.us).flat();const sg=[];
                    if(ka.some(i=>i.includes("기준금리")||i.includes("금리")))sg.push("• 한은 기준금리 방향 → 국고채 금리 시나리오 확률 조정");
                    if(ka.some(i=>i.includes("스프레드")||i.includes("크레딧")))sg.push("• 크레딧 이벤트 → 스프레드 확대 확률 상향 검토");
                    if(ua.some(i=>i.includes("Fed")||i.includes("FF")))sg.push("• Fed 정책 변화 → 국내 강세 시나리오 확률 조정");
                    if(ua.some(i=>i.includes("GDP")||i.includes("PMI")))sg.push("• 미국 경기둔화 → 리스크오프 감안 스프레드 확대 검토");
                    if(ka.some(i=>i.includes("환율")||i.includes("KRW")))sg.push("• 환율 변동 → 외국인 수급 감안 금리 시나리오 재점검");
                    return sg.length?sg.join("\n"):"내러티브를 입력하면 시나리오 가정 제안이 생성됩니다.";})()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div style={{padding:"16px 24px",borderTop:`1px solid ${S.border}`,color:S.dim,fontSize:10,display:"flex",justifyContent:"space-between"}}>
        <span>Duration Commander v1.1 · Engine ① · Rate Table Upload</span>
        <span>Wolf Pack Expedition · Alpha Engine System</span>
      </div>
    </div>
  );
}
