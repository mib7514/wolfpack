"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ComposedChart, Area
} from "recharts";

// ═══════════════════════════════════════════
// Real Monthly Data: 2019.01 ~ 2026.03
// KTB 3Y: e-나라지표 + market data
// BOK Rate: 한국은행 기준금리 이력
// CPI: 통계청 소비자물가 YoY
// Output Gap: BOK 추정 근사
// ═══════════════════════════════════════════
const D = [
  {d:"2019.01",cpi:0.8,gap:-0.6,bok:1.75,k:1.81},{d:"2019.02",cpi:0.5,gap:-0.7,bok:1.75,k:1.80},
  {d:"2019.03",cpi:0.4,gap:-0.7,bok:1.75,k:1.79},{d:"2019.04",cpi:0.6,gap:-0.8,bok:1.75,k:1.74},
  {d:"2019.05",cpi:0.7,gap:-0.8,bok:1.75,k:1.59},{d:"2019.06",cpi:0.7,gap:-0.9,bok:1.75,k:1.47},
  {d:"2019.07",cpi:0.6,gap:-0.9,bok:1.50,k:1.29},{d:"2019.08",cpi:0.0,gap:-1.0,bok:1.50,k:1.17},
  {d:"2019.09",cpi:-0.4,gap:-1.1,bok:1.50,k:1.30},{d:"2019.10",cpi:0.0,gap:-1.0,bok:1.25,k:1.47},
  {d:"2019.11",cpi:0.2,gap:-1.0,bok:1.25,k:1.39},{d:"2019.12",cpi:0.7,gap:-0.9,bok:1.25,k:1.36},
  {d:"2020.01",cpi:1.5,gap:-0.8,bok:1.25,k:1.30},{d:"2020.02",cpi:1.1,gap:-1.0,bok:1.25,k:1.10},
  {d:"2020.03",cpi:1.0,gap:-2.5,bok:0.75,k:1.07},{d:"2020.04",cpi:0.1,gap:-4.5,bok:0.75,k:1.01},
  {d:"2020.05",cpi:-0.3,gap:-5.2,bok:0.50,k:0.83},{d:"2020.06",cpi:0.0,gap:-4.8,bok:0.50,k:0.84},
  {d:"2020.07",cpi:0.3,gap:-3.5,bok:0.50,k:0.80},{d:"2020.08",cpi:0.7,gap:-3.0,bok:0.50,k:0.94},
  {d:"2020.09",cpi:1.0,gap:-2.5,bok:0.50,k:0.85},{d:"2020.10",cpi:0.5,gap:-2.0,bok:0.50,k:0.94},
  {d:"2020.11",cpi:0.6,gap:-1.8,bok:0.50,k:0.98},{d:"2020.12",cpi:0.5,gap:-1.5,bok:0.50,k:0.98},
  {d:"2021.01",cpi:0.6,gap:-0.8,bok:0.50,k:0.97},{d:"2021.02",cpi:1.1,gap:-0.6,bok:0.50,k:1.02},
  {d:"2021.03",cpi:1.5,gap:-0.4,bok:0.50,k:1.13},{d:"2021.04",cpi:2.3,gap:-0.1,bok:0.50,k:1.14},
  {d:"2021.05",cpi:2.6,gap:0.1,bok:0.50,k:1.23},{d:"2021.06",cpi:2.4,gap:0.2,bok:0.50,k:1.45},
  {d:"2021.07",cpi:2.6,gap:0.3,bok:0.50,k:1.42},{d:"2021.08",cpi:2.6,gap:0.4,bok:0.75,k:1.41},
  {d:"2021.09",cpi:2.5,gap:0.5,bok:0.75,k:1.52},{d:"2021.10",cpi:3.2,gap:0.6,bok:0.75,k:1.84},
  {d:"2021.11",cpi:3.7,gap:0.7,bok:1.00,k:1.95},{d:"2021.12",cpi:3.7,gap:0.8,bok:1.00,k:1.80},
  {d:"2022.01",cpi:3.6,gap:0.7,bok:1.25,k:2.06},{d:"2022.02",cpi:3.7,gap:0.6,bok:1.25,k:2.29},
  {d:"2022.03",cpi:4.1,gap:0.6,bok:1.25,k:2.37},{d:"2022.04",cpi:4.8,gap:0.5,bok:1.50,k:2.94},
  {d:"2022.05",cpi:5.4,gap:0.4,bok:1.75,k:3.02},{d:"2022.06",cpi:6.0,gap:0.3,bok:1.75,k:3.48},
  {d:"2022.07",cpi:6.3,gap:0.2,bok:2.25,k:3.24},{d:"2022.08",cpi:5.7,gap:0.1,bok:2.50,k:3.25},
  {d:"2022.09",cpi:5.6,gap:0.0,bok:2.50,k:3.90},{d:"2022.10",cpi:5.7,gap:-0.1,bok:3.00,k:4.24},
  {d:"2022.11",cpi:5.0,gap:-0.2,bok:3.25,k:3.90},{d:"2022.12",cpi:5.0,gap:-0.3,bok:3.25,k:3.63},
  {d:"2023.01",cpi:5.2,gap:-0.4,bok:3.50,k:3.46},{d:"2023.02",cpi:4.8,gap:-0.4,bok:3.50,k:3.47},
  {d:"2023.03",cpi:4.2,gap:-0.4,bok:3.50,k:3.46},{d:"2023.04",cpi:3.7,gap:-0.3,bok:3.50,k:3.26},
  {d:"2023.05",cpi:3.3,gap:-0.3,bok:3.50,k:3.33},{d:"2023.06",cpi:2.7,gap:-0.3,bok:3.50,k:3.55},
  {d:"2023.07",cpi:2.3,gap:-0.2,bok:3.50,k:3.64},{d:"2023.08",cpi:3.4,gap:-0.1,bok:3.50,k:3.73},
  {d:"2023.09",cpi:3.7,gap:-0.1,bok:3.50,k:3.84},{d:"2023.10",cpi:3.8,gap:0.0,bok:3.50,k:4.03},
  {d:"2023.11",cpi:3.3,gap:0.0,bok:3.50,k:3.77},{d:"2023.12",cpi:3.2,gap:0.0,bok:3.50,k:3.35},
  {d:"2024.01",cpi:2.8,gap:-0.1,bok:3.50,k:3.25},{d:"2024.02",cpi:3.1,gap:-0.1,bok:3.50,k:3.38},
  {d:"2024.03",cpi:3.1,gap:-0.2,bok:3.50,k:3.42},{d:"2024.04",cpi:2.9,gap:-0.2,bok:3.50,k:3.48},
  {d:"2024.05",cpi:2.7,gap:-0.1,bok:3.50,k:3.42},{d:"2024.06",cpi:2.4,gap:-0.1,bok:3.50,k:3.24},
  {d:"2024.07",cpi:2.6,gap:0.0,bok:3.50,k:3.10},{d:"2024.08",cpi:2.0,gap:0.0,bok:3.50,k:2.99},
  {d:"2024.09",cpi:1.6,gap:0.0,bok:3.50,k:2.89},{d:"2024.10",cpi:1.3,gap:0.0,bok:3.25,k:2.85},
  {d:"2024.11",cpi:1.5,gap:0.1,bok:3.00,k:2.73},{d:"2024.12",cpi:1.9,gap:0.1,bok:3.00,k:2.60},
  {d:"2025.01",cpi:2.2,gap:0.1,bok:3.00,k:2.53},{d:"2025.02",cpi:2.0,gap:0.2,bok:2.75,k:2.60},
  {d:"2025.03",cpi:2.1,gap:0.2,bok:2.75,k:2.57},{d:"2025.04",cpi:2.0,gap:0.2,bok:2.75,k:2.52},
  {d:"2025.05",cpi:2.1,gap:0.3,bok:2.75,k:2.55},{d:"2025.06",cpi:2.2,gap:0.3,bok:2.50,k:2.48},
  {d:"2025.07",cpi:2.3,gap:0.3,bok:2.50,k:2.52},{d:"2025.08",cpi:2.3,gap:0.4,bok:2.50,k:2.58},
  {d:"2025.09",cpi:2.4,gap:0.4,bok:2.50,k:2.65},{d:"2025.10",cpi:2.4,gap:0.4,bok:2.50,k:2.72},
  {d:"2025.11",cpi:2.5,gap:0.4,bok:2.50,k:2.80},{d:"2025.12",cpi:2.5,gap:0.5,bok:2.50,k:2.88},
  {d:"2026.01",cpi:2.4,gap:0.4,bok:2.50,k:2.95},{d:"2026.02",cpi:2.3,gap:0.4,bok:2.50,k:3.02},
  {d:"2026.03",cpi:2.4,gap:0.4,bok:2.50,k:3.18,live:true},
];

const PRESETS = {
  hawkish:{ label:"매파",sub:"Hawkish",rStar:1.0,piTarget:2.0,alpha:1.0,beta:0.5,
    desc:"r*=1.0, α=1.0 — 물가 안정 최우선, 인플레이션 갭 강반응, 인상 시그널 강조",color:"#c0392b",bg:"#fef5f4"},
  neutral:{ label:"중립",sub:"Neutral",rStar:0.5,piTarget:2.0,alpha:0.5,beta:0.5,
    desc:"Taylor 1993 원본 파라미터, 인플레/산출갭 균형 반응함수",color:"#636e72",bg:"#f5f5f5"},
  dovish:{ label:"비둘기",sub:"Dovish",rStar:0.25,piTarget:2.5,alpha:0.5,beta:0.25,
    desc:"r*=0.25, π*=2.5 — 성장 중시, 완화적 허용범위 확대, 인하 여지 확보",color:"#0984e3",bg:"#f0f7ff"},
  custom:{ label:"커스텀",sub:"Custom",rStar:0.75,piTarget:2.0,alpha:1.0,beta:0.5,
    desc:"파라미터를 직접 조절하여 시나리오를 시뮬레이션합니다. 설정값은 자동 저장됩니다.",color:"#6c5ce7",bg:"#f5f3ff"},
};

const RANGES = [
  {label:"3M",months:3},{label:"6M",months:6},{label:"1Y",months:12},
  {label:"2Y",months:24},{label:"3Y",months:36},{label:"MAX",months:999},
];

function calc({rStar,piTarget,alpha,beta,cpi,gap}){
  return rStar+cpi+alpha*(cpi-piTarget)+beta*gap;
}

const mono="'JetBrains Mono','SF Mono','Consolas',monospace";
const STORAGE_KEY = "wolfpack-taylor-custom";

// ── Sub-components ──

function Tip1({active,payload,label}){
  if(!active||!payload?.length)return null;
  return(<div style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:6,padding:"10px 14px",fontSize:11.5,boxShadow:"0 2px 12px rgba(0,0,0,0.06)",fontFamily:mono}}>
    <div style={{fontWeight:700,marginBottom:6,color:"#1a1a2e",fontSize:12}}>{label}</div>
    {payload.filter(p=>p.value!=null).map((p,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",gap:20,marginBottom:2}}>
      <span style={{color:p.color}}>{p.name}</span>
      <span style={{fontWeight:600,color:"#1a1a2e"}}>{p.value.toFixed(2)}%</span>
    </div>))}
  </div>);
}

function Tip2({active,payload,label}){
  if(!active||!payload?.length)return null;
  return(<div style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:6,padding:"10px 14px",fontSize:11.5,boxShadow:"0 2px 12px rgba(0,0,0,0.06)",fontFamily:mono}}>
    <div style={{fontWeight:700,marginBottom:6,color:"#1a1a2e",fontSize:12}}>{label}</div>
    {payload.filter(p=>p.value!=null).map((p,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",gap:20,marginBottom:2}}>
      <span style={{color:p.color}}>{p.name}</span>
      <span style={{fontWeight:600,color:"#1a1a2e"}}>{p.value>=0?"+":""}{p.value.toFixed(2)}%p</span>
    </div>))}
  </div>);
}

function Slider({label,sym,value,min,max,step,onChange}){
  return(<div style={{marginBottom:13}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
      <span style={{fontSize:11.5,color:"#555",fontWeight:500}}>{label} <span style={{color:"#aaa",fontSize:10}}>({sym})</span></span>
      <span style={{fontSize:15,fontWeight:700,color:"#1a1a2e",fontFamily:mono}}>{value.toFixed(step<0.1?2:1)}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e=>onChange(parseFloat(e.target.value))}
      style={{width:"100%",cursor:"pointer"}}/>
    <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#ccc",marginTop:2,fontFamily:mono}}><span>{min}</span><span>{max}</span></div>
  </div>);
}

function Stat({label,value,sub,hl}){
  return(<div style={{flex:1,minWidth:130,padding:"12px 14px",background:hl?"#f9f7f2":"#fafafa",border:`1px solid ${hl?"#d6cdb3":"#eee"}`,borderRadius:8}}>
    <div style={{fontSize:9,color:"#999",letterSpacing:1.5,textTransform:"uppercase",marginBottom:5,fontFamily:mono}}>{label}</div>
    <div style={{fontSize:21,fontWeight:800,color:"#1a1a2e",fontFamily:mono,lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:10.5,color:"#999",marginTop:5}}>{sub}</div>}
  </div>);
}

function GapTag({gap}){
  const c=gap<-0.5?{t:"완화적 LOOSE",c:"#c0392b",bg:"#fef5f4"}:gap>0.5?{t:"긴축적 TIGHT",c:"#0984e3",bg:"#f0f7ff"}:{t:"중립 NEUTRAL",c:"#636e72",bg:"#f5f5f5"};
  return(<span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:10,background:c.bg,color:c.c,fontSize:9.5,fontWeight:700,letterSpacing:0.8,fontFamily:mono}}>
    <span style={{width:5,height:5,borderRadius:"50%",background:c.c}}/>{c.t}
  </span>);
}

// ═══════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════
export default function TaylorRulePage(){
  const [mode,setMode]=useState("hawkish");
  const [custom,setCustom]=useState({rStar:0.75,piTarget:2.0,alpha:1.0,beta:0.5});
  const [range,setRange]=useState("MAX");
  const [data,setData]=useState(D);
  const [aiLoading,setAiLoading]=useState(false);
  const [aiResult,setAiResult]=useState(null);
  const [mounted,setMounted]=useState(false);

  // ── Load custom params from localStorage ──
  useEffect(()=>{
    setMounted(true);
    try{
      const saved=localStorage.getItem(STORAGE_KEY);
      if(saved){
        const p=JSON.parse(saved);
        if(p.rStar!==undefined) setCustom(p);
      }
    }catch(e){}
  },[]);

  // ── Save custom params ──
  useEffect(()=>{
    if(!mounted)return;
    if(mode==="custom"){
      try{localStorage.setItem(STORAGE_KEY,JSON.stringify(custom));}catch(e){}
    }
  },[custom,mode,mounted]);

  const p=PRESETS[mode];
  const params=mode==="custom"?custom:p;

  const chartData=useMemo(()=>{
    return data.map(r=>{
      const t=calc({rStar:params.rStar,piTarget:params.piTarget,alpha:params.alpha,beta:params.beta,cpi:r.cpi,gap:r.gap});
      return{
        date:r.d,bok:r.bok,taylor:parseFloat(t.toFixed(2)),ktb3y:r.k,
        taylorGap:parseFloat((t-r.bok).toFixed(2)),
        ktbGap:parseFloat((r.k-r.bok).toFixed(2)),
        live:r.live||false,
      };
    });
  },[params,data]);

  const rangeMonths=RANGES.find(r=>r.label===range)?.months||999;
  const filtered=useMemo(()=>{
    if(rangeMonths>=999)return chartData;
    return chartData.slice(-rangeMonths);
  },[chartData,rangeMonths]);

  const latest=chartData[chartData.length-1];
  const policyGap=latest.bok-latest.taylor;

  // ── AI Update (Claude API + web search) ──
  const handleAIUpdate=useCallback(async()=>{
    setAiLoading(true);
    setAiResult(null);
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-5-20250514",
          max_tokens:1000,
          tools:[{type:"web_search_20250305",name:"web_search"}],
          messages:[{role:"user",content:"오늘 한국 국고채 3년 금리가 몇 %인지 알려줘. 숫자만 JSON으로 답해줘: {\"rate\": 숫자, \"date\": \"YYYY.MM.DD\"} 형식으로. 반드시 웹검색해서 최신 데이터를 찾아줘."}],
        }),
      });
      const d=await res.json();
      const txt=d.content?.map(c=>c.text||"").join("")||"";
      const m=txt.match(/\{[^}]*"rate"\s*:\s*([\d.]+)[^}]*"date"\s*:\s*"([^"]+)"[^}]*\}/);
      if(m){
        const rate=parseFloat(m[1]);
        const date=m[2];
        setAiResult({rate,date,ok:true});
        setData(prev=>{
          const nd=[...prev];
          const li=nd.length-1;
          if(nd[li].live) nd[li]={...nd[li],k:rate};
          return nd;
        });
      }else{
        const nm=txt.match(/([\d]+\.[\d]+)\s*%/);
        if(nm){
          const rate=parseFloat(nm[1]);
          setAiResult({rate,date:"최신",ok:true});
          setData(prev=>{
            const nd=[...prev];
            const li=nd.length-1;
            if(nd[li].live) nd[li]={...nd[li],k:rate};
            return nd;
          });
        }else{
          setAiResult({ok:false,msg:"데이터를 파싱할 수 없습니다"});
        }
      }
    }catch(e){
      setAiResult({ok:false,msg:e.message});
    }
    setAiLoading(false);
  },[]);

  const xInterval=filtered.length>48?5:filtered.length>24?3:filtered.length>12?2:1;

  if(!mounted) return null;

  return(
    <div style={{minHeight:"100vh",background:"#ffffff",color:"#1a1a2e",fontFamily:"'Pretendard',-apple-system,'Segoe UI',sans-serif",padding:"28px 24px"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;}
        input[type="range"]{-webkit-appearance:none;appearance:none;height:3px;border-radius:2px;background:#e0e0e0;outline:none;}
        input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:#1a1a2e;cursor:pointer;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.18);}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      `}</style>

      <div style={{maxWidth:1060,margin:"0 auto"}}>

        {/* Header */}
        <div style={{marginBottom:22,borderBottom:"2px solid #1a1a2e",paddingBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <a href="/" style={{fontSize:9,letterSpacing:3,color:"#aaa",fontFamily:mono,textDecoration:"none"}}>
              ← WOLF PACK CONTROL TOWER
            </a>
            <span style={{fontSize:9,color:"#ddd",fontFamily:mono}}>·</span>
            <span style={{fontSize:9,letterSpacing:3,color:"#aaa",fontFamily:mono}}>MACRO LAYER</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:8}}>
            <div>
              <h1 style={{fontSize:23,fontWeight:800,letterSpacing:-0.3,color:"#1a1a2e",marginBottom:3}}>수정 테일러 룰 적정금리 모니터</h1>
              <div style={{fontSize:11,color:"#999",fontFamily:mono}}>i* = r* + π + α(π − π*) + β(y − y*) · Monthly · 2019.01 – 2026.03</div>
            </div>
            <button onClick={handleAIUpdate} disabled={aiLoading} style={{
              padding:"7px 14px",border:"1px solid #1a1a2e",borderRadius:6,background:aiLoading?"#f5f5f5":"#1a1a2e",
              color:aiLoading?"#999":"#fff",cursor:aiLoading?"wait":"pointer",fontFamily:mono,fontSize:10.5,fontWeight:600,
              display:"flex",alignItems:"center",gap:6,transition:"all 0.15s",letterSpacing:0.5,
            }}>
              {aiLoading?<span style={{animation:"pulse 1s infinite"}}>검색 중...</span>:<><span style={{fontSize:13}}>⚡</span>국고3년 AI 업데이트</>}
            </button>
          </div>
          {aiResult&&(
            <div style={{marginTop:8,padding:"6px 12px",borderRadius:6,fontSize:11,fontFamily:mono,
              background:aiResult.ok?"#f0f7ff":"#fef5f4",color:aiResult.ok?"#0984e3":"#c0392b",fontWeight:600}}>
              {aiResult.ok?`✓ 국고3년 업데이트: ${aiResult.rate}% (${aiResult.date})`:`✗ ${aiResult.msg}`}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          <Stat label="한은 기준금리" value={`${latest.bok.toFixed(2)}%`} sub={latest.date}/>
          <Stat label="적정금리 (Taylor)" value={`${latest.taylor.toFixed(2)}%`} sub={`${p.label} 시나리오`} hl/>
          <Stat label="정책 괴리" value={`${policyGap>=0?"+":""}${policyGap.toFixed(2)}%p`} sub={<GapTag gap={policyGap}/>}/>
          <Stat label={<span>국고채 3년 {latest.live&&<span style={{color:"#0984e3",fontSize:8}}>● LIVE</span>}</span>} value={`${latest.ktb3y.toFixed(2)}%`} sub={`스프레드 ${latest.ktbGap>=0?"+":""}${latest.ktbGap.toFixed(2)}%p`}/>
        </div>

        {/* Main Grid */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 240px",gap:12,marginBottom:16}}>
          {/* Chart 1 */}
          <div style={{border:"1px solid #eee",borderRadius:10,padding:"14px 10px 8px",background:"#fff"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,paddingLeft:6,paddingRight:6}}>
              <span style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:"#aaa",fontFamily:mono}}>기준금리 vs 적정금리 vs 국고3년</span>
              <div style={{display:"flex",gap:3}}>
                {RANGES.map(r=>(<button key={r.label} onClick={()=>setRange(r.label)} style={{
                  padding:"3px 8px",border:`1px solid ${range===r.label?"#1a1a2e":"#e0e0e0"}`,borderRadius:4,
                  background:range===r.label?"#1a1a2e":"#fff",color:range===r.label?"#fff":"#999",
                  fontSize:9.5,fontWeight:600,cursor:"pointer",fontFamily:mono,transition:"all 0.1s",
                }}>{r.label}</button>))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={270}>
              <ComposedChart data={filtered} margin={{top:5,right:14,left:-6,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="date" tick={{fontSize:9.5,fill:"#bbb",fontFamily:"JetBrains Mono"}} axisLine={{stroke:"#e8e8e8"}} tickLine={false} interval={xInterval}/>
                <YAxis tick={{fontSize:9.5,fill:"#bbb",fontFamily:"JetBrains Mono"}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} domain={["auto","auto"]}/>
                <Tooltip content={<Tip1/>}/>
                <Legend verticalAlign="top" align="right" height={26} wrapperStyle={{fontSize:10,fontFamily:mono}}/>
                <Line type="stepAfter" dataKey="bok" name="기준금리" stroke="#c0392b" strokeWidth={2} dot={false}/>
                <Line type="monotone" dataKey="taylor" name="적정금리" stroke="#1a1a2e" strokeWidth={2} dot={false}/>
                <Line type="monotone" dataKey="ktb3y" name="국고3년" stroke="#0984e3" strokeWidth={1.8} dot={false}/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Right Panel */}
          <div style={{border:"1px solid #eee",borderRadius:10,padding:14,background:"#fff",display:"flex",flexDirection:"column"}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:"#aaa",marginBottom:10,fontFamily:mono}}>시나리오</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:12}}>
              {Object.entries(PRESETS).map(([key,pr])=>{
                const on=mode===key;
                return(<button key={key} onClick={()=>setMode(key)} style={{
                  padding:"6px 4px",border:`1.5px solid ${on?pr.color:"#e8e8e8"}`,borderRadius:6,
                  background:on?pr.bg:"#fff",cursor:"pointer",fontFamily:mono,fontSize:10,
                  fontWeight:on?700:500,color:on?pr.color:"#aaa",transition:"all 0.12s",lineHeight:1.3,
                }}>{pr.label}<br/><span style={{fontSize:8,fontWeight:400,opacity:0.6}}>{pr.sub}</span></button>);
              })}
            </div>
            <div style={{fontSize:10,color:"#777",lineHeight:1.6,marginBottom:12,padding:"7px 9px",background:p.bg,borderRadius:6,borderLeft:`3px solid ${p.color}`}}>{p.desc}</div>

            {mode!=="custom"?(
              <div style={{flex:1}}>
                {[{l:"중립금리 r*",v:`${params.rStar.toFixed(2)}%`},{l:"물가목표 π*",v:`${params.piTarget.toFixed(1)}%`},{l:"인플레 α",v:params.alpha.toFixed(1)},{l:"산출갭 β",v:params.beta.toFixed(1)}].map(({l,v})=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #f5f5f5",fontSize:11,fontFamily:mono}}>
                    <span style={{color:"#888"}}>{l}</span><span style={{fontWeight:700,color:"#1a1a2e"}}>{v}</span>
                  </div>
                ))}
              </div>
            ):(
              <div style={{flex:1}}>
                <Slider label="중립금리" sym="r*" value={custom.rStar} min={0} max={2.5} step={0.25} onChange={v=>setCustom(c=>({...c,rStar:v}))}/>
                <Slider label="물가목표" sym="π*" value={custom.piTarget} min={1.0} max={3.0} step={0.25} onChange={v=>setCustom(c=>({...c,piTarget:v}))}/>
                <Slider label="인플레 가중치" sym="α" value={custom.alpha} min={0} max={2.0} step={0.1} onChange={v=>setCustom(c=>({...c,alpha:v}))}/>
                <Slider label="산출갭 가중치" sym="β" value={custom.beta} min={0} max={1.5} step={0.1} onChange={v=>setCustom(c=>({...c,beta:v}))}/>
                <div style={{fontSize:9,color:"#bbb",fontFamily:mono,marginTop:4,textAlign:"center"}}>⟳ 설정값 자동 저장</div>
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Dual Gap */}
        <div style={{border:"1px solid #eee",borderRadius:10,padding:"14px 10px 8px",background:"#fff",marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,paddingLeft:6,paddingRight:6}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:"#aaa",fontFamily:mono}}>GAP 비교 — 시장 선반영 vs 정책 괴리</div>
              <div style={{fontSize:10,color:"#ccc",marginTop:2}}>좌축: 적정금리−기준금리 / 우축: 국고3년−기준금리</div>
            </div>
            <div style={{display:"flex",gap:3}}>
              {RANGES.map(r=>(<button key={r.label} onClick={()=>setRange(r.label)} style={{
                padding:"3px 8px",border:`1px solid ${range===r.label?"#1a1a2e":"#e0e0e0"}`,borderRadius:4,
                background:range===r.label?"#1a1a2e":"#fff",color:range===r.label?"#fff":"#999",
                fontSize:9.5,fontWeight:600,cursor:"pointer",fontFamily:mono,transition:"all 0.1s",
              }}>{r.label}</button>))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={filtered} margin={{top:8,right:10,left:-6,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="date" tick={{fontSize:9.5,fill:"#bbb",fontFamily:"JetBrains Mono"}} axisLine={{stroke:"#e8e8e8"}} tickLine={false} interval={xInterval}/>
              <YAxis yAxisId="left" tick={{fontSize:9.5,fill:"#1a1a2e",fontFamily:"JetBrains Mono"}} axisLine={false} tickLine={false} tickFormatter={v=>`${v>=0?"+":""}${v}`} label={{value:"정책 괴리 (%p)",angle:-90,position:"insideLeft",offset:16,style:{fontSize:9,fill:"#1a1a2e",fontFamily:mono}}}/>
              <YAxis yAxisId="right" orientation="right" tick={{fontSize:9.5,fill:"#0984e3",fontFamily:"JetBrains Mono"}} axisLine={false} tickLine={false} tickFormatter={v=>`${v>=0?"+":""}${v}`} label={{value:"시장 스프레드 (%p)",angle:90,position:"insideRight",offset:16,style:{fontSize:9,fill:"#0984e3",fontFamily:mono}}}/>
              <Tooltip content={<Tip2/>}/>
              <ReferenceLine yAxisId="left" y={0} stroke="#ddd" strokeWidth={1}/>
              <Legend verticalAlign="top" align="right" height={26} wrapperStyle={{fontSize:10,fontFamily:mono}}/>
              <Area yAxisId="left" type="monotone" dataKey="taylorGap" name="적정금리−기준금리" stroke="#1a1a2e" fill="#1a1a2e" fillOpacity={0.05} strokeWidth={2} dot={false}/>
              <Line yAxisId="right" type="monotone" dataKey="ktbGap" name="국고3년−기준금리" stroke="#0984e3" strokeWidth={2} dot={false}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Interpretation */}
        <div style={{border:"1px solid #eee",borderRadius:10,padding:"14px 16px",background:"#fafafa",marginBottom:16}}>
          <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,color:"#aaa",marginBottom:6,fontFamily:mono}}>해석</div>
          <div style={{fontSize:12,color:"#555",lineHeight:1.85}}>
            <span style={{color:"#0984e3",fontWeight:600}}>국고3년−기준금리</span>(우축, 파란색)는 채권시장이 향후 금리 경로를 선반영한 결과이며,{" "}
            <span style={{color:"#1a1a2e",fontWeight:600}}>적정금리−기준금리</span>(좌축, 검정색)는 테일러 룰이 시사하는 정책 조정 필요분입니다.
            {latest.taylorGap>0&&latest.ktbGap<latest.taylorGap&&(
              <span style={{display:"block",marginTop:8,padding:"7px 11px",background:"#fef5f4",borderRadius:6,color:"#c0392b",fontWeight:600,fontSize:11}}>
                ▸ {latest.date} 기준: 테일러 룰은 {latest.taylorGap.toFixed(2)}%p 인상을 시사하나, 국고3년 스프레드({latest.ktbGap.toFixed(2)}%p)는 이를 충분히 반영하지 못하고 있습니다.
              </span>
            )}
            {latest.taylorGap<=0&&(
              <span style={{display:"block",marginTop:8,padding:"7px 11px",background:"#f0f7ff",borderRadius:6,color:"#0984e3",fontWeight:600,fontSize:11}}>
                ▸ {latest.date} 기준: 테일러 룰상 현 기준금리가 적정 수준이거나 긴축적입니다.
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{fontSize:10,color:"#ccc",lineHeight:1.7,fontFamily:mono,borderTop:"1px solid #eee",paddingTop:10}}>
          <strong style={{color:"#aaa"}}>NOTE</strong>&ensp;·&ensp;
          국고채 3년: e-나라지표/민평 기준 월평균. 기준금리: 한국은행 공시. CPI/산출갭: 통계청·한은 추정 근사.
          커스텀 파라미터는 localStorage에 자동 저장됩니다.
        </div>
      </div>
    </div>
  );
}
