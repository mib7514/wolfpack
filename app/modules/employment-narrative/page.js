"use client";
import { useState, useCallback } from "react";

/* ─── DATA ─── */
const MONTHS = [
  { month:"2025-09",label:"Sep 25",nfp:-35,ur:4.4,wage_yoy:3.5,lfpr:62.4,epop:59.7,u6:8.2,parttime_econ:4579,discouraged:557,longterm_unemp:1814,sectors_up:["Healthcare +29K","Social Asst +15K","Construction +12K"],sectors_down:["Federal Gov -22K","Info Tech -8K","Manufacturing -6K"],fed_gov_chg:-22,revised:true,note:"정부 셧다운 영향, DOGE 해고 본격화"},
  { month:"2025-10",label:"Oct 25",nfp:-10,ur:4.4,wage_yoy:3.6,lfpr:62.4,epop:59.6,u6:8.3,parttime_econ:4800,discouraged:580,longterm_unemp:1850,sectors_up:["Healthcare +25K","Food Services +18K","Social Asst +12K"],sectors_down:["Federal Gov -28K","Retail -15K","Info Tech -10K"],fed_gov_chg:-28,revised:true,note:"정부 셧다운으로 서베이 수집 실패"},
  { month:"2025-11",label:"Nov 25",nfp:56,ur:4.5,wage_yoy:3.6,lfpr:62.5,epop:59.6,u6:8.7,parttime_econ:5488,discouraged:651,longterm_unemp:1910,sectors_up:["Healthcare +30K","Food Services +22K","Social Asst +14K"],sectors_down:["Federal Gov -25K","Retail -18K","Manufacturing -8K"],fed_gov_chg:-25,revised:true,note:"Reentrants +293K 급증, 비자발적 파트타임 +909K"},
  { month:"2025-12",label:"Dec 25",nfp:-17,ur:4.4,wage_yoy:3.8,lfpr:62.4,epop:59.7,u6:8.4,parttime_econ:5300,discouraged:461,longterm_unemp:1900,sectors_up:["Food Services +27K","Healthcare +21K","Social Asst +17K"],sectors_down:["Retail -25K","Warehouse -19K","Food Retailers -9K"],fed_gov_chg:-18,revised:true,note:"수정치 -17K. 소매업 홀리데이에도 붕괴"},
  { month:"2026-01",label:"Jan 26",nfp:126,ur:4.4,wage_yoy:3.8,lfpr:62.1,epop:59.2,u6:8.1,parttime_econ:5100,discouraged:480,longterm_unemp:1900,sectors_up:["Healthcare +82K","Social Asst +42K","Construction +33K"],sectors_down:["Federal Gov -34K","Financial -22K","Info -5K"],fed_gov_chg:-34,revised:true,note:"인구추계 업데이트. Healthcare 주도 반등"},
  { month:"2026-02",label:"Feb 26",nfp:-92,ur:4.4,wage_yoy:3.8,lfpr:62.1,epop:59.2,u6:7.9,parttime_econ:4900,discouraged:470,longterm_unemp:1900,sectors_up:["Social Asst +9K"],sectors_down:["Healthcare -28K","Manufacturing -12K","Construction -11K"],fed_gov_chg:-10,revised:false,note:"Kaiser 파업 -30K. 5개월 중 3번째 마이너스. 평균실업 25.7주"}
];

const INIT_NARRATIVES = [
  { id:"k-shaped",name:"K자 경제 양극화",nameEn:"K-Shaped Economy",status:"strengthening",startMonth:"2025-09",evidenceMonths:6,
    description:"고소득/고숙련 vs 저소득/저숙련 노동시장 구조적 분리. Healthcare·Social Assistance 확대, Retail·Manufacturing 감소.",
    supporting:[{month:"2025-11",text:"소매업 -18K vs Healthcare +30K"},{month:"2025-12",text:"홀리데이에도 Retail -25K"},{month:"2026-01",text:"Healthcare +82K 주도"},{month:"2026-02",text:"Manufacturing -12K, 백인3.7% vs 흑인7.7%"}],
    contradicting:[],
    implication:"연준 정책이 양극화 심화 가능. 단일 지표보다 분포가 중요.",
    bondView:"소비 집중도 상승 → 상위층 둔화 시 변동성 증폭",
    lifecycle:[{month:"2025-09",status:"emerging"},{month:"2025-11",status:"strengthening"},{month:"2026-02",status:"strengthening"}]},
  { id:"doge-restructuring",name:"DOGE 구조조정",nameEn:"DOGE Restructuring",status:"strengthening",startMonth:"2025-03",evidenceMonths:12,
    description:"연방정부 -330K(-11%). 해고자 재진입이 마찰적 실업과 K자 양극화 심화.",
    supporting:[{month:"2025-09",text:"연방정부 -22K"},{month:"2025-11",text:"Reentrants +293K"},{month:"2026-01",text:"연방정부 -34K"},{month:"2026-02",text:"누적 -330K"}],
    contradicting:[{month:"2025-12",text:"Discouraged -190K (재진입 의지)"}],
    implication:"노동공급 복원 중장기 긍정, 매칭 실패 시 구조적 실업 리스크.",
    bondView:"재정적자 축소 + 단기 둔화 → 채권 강세 요인",
    lifecycle:[{month:"2025-03",status:"emerging"},{month:"2025-09",status:"strengthening"},{month:"2026-02",status:"strengthening"}]},
  { id:"ai-displacement",name:"AI 고용 대체",nameEn:"AI Displacement",status:"emerging",startMonth:"2025-10",evidenceMonths:5,
    description:"Info 섹터 지속 감소, 제조업 자동화 가속. AI 디스인플레 내러티브와 결합.",
    supporting:[{month:"2025-10",text:"Info -10K"},{month:"2025-11",text:"Info -8K, 제조업 -8K"},{month:"2026-02",text:"Info -11K, Manufacturing 누적 -100K"}],
    contradicting:[{month:"2026-01",text:"Healthcare +82K (AI 무관 섹터 주도)"}],
    implication:"아직 '내러티브' 단계. 3개월 연속 Info 감소 시 강화.",
    bondView:"AI 디스인플레 → 10년물 4% 하회 드라이버 1순위",
    lifecycle:[{month:"2025-10",status:"emerging"},{month:"2026-02",status:"emerging"}]}
];

const ST = {
  strengthening:{label:"강화",color:"#e63946",bg:"rgba(230,57,70,0.07)",border:"rgba(230,57,70,0.22)"},
  stable:{label:"유지",color:"#457b9d",bg:"rgba(69,123,157,0.07)",border:"rgba(69,123,157,0.22)"},
  weakening:{label:"약화",color:"#f4a261",bg:"rgba(244,162,97,0.07)",border:"rgba(244,162,97,0.22)"},
  collapsed:{label:"붕괴",color:"#555",bg:"rgba(80,80,80,0.05)",border:"rgba(80,80,80,0.15)"},
  emerging:{label:"부상",color:"#2a9d8f",bg:"rgba(42,157,143,0.07)",border:"rgba(42,157,143,0.22)"},
  candidate:{label:"후보",color:"#bb86fc",bg:"rgba(187,134,252,0.05)",border:"rgba(187,134,252,0.18)"}
};
const ICONS = {strengthening:"▲",stable:"■",weakening:"▼",collapsed:"✕",emerging:"◆",candidate:"?"};

/* ─── SMALL COMPONENTS ─── */
function Spark({data,k,color="#457b9d",h=34,w=150}){
  const v=data.map(d=>d[k]).filter(x=>x!=null);if(v.length<2)return null;
  const mn=Math.min(...v),mx=Math.max(...v),r=mx-mn||1;
  const pts=v.map((val,i)=>`${(i/(v.length-1))*w},${h-((val-mn)/r)*(h-8)-4}`).join(" ");
  return <svg width={w} height={h} style={{display:"block"}}><polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round"/>{v.map((val,i)=>{const x=(i/(v.length-1))*w,y=h-((val-mn)/r)*(h-8)-4;return <circle key={i} cx={x} cy={y} r={i===v.length-1?3:1.5} fill={i===v.length-1?color:"rgba(255,255,255,0.2)"}/>})}</svg>;
}
function Bar({value}){
  const z=50,vp=50+Math.max(-50,Math.min(50,value))/100*50,l=value>=0?z:vp,w=Math.abs(vp-z);
  return <div style={{position:"relative",height:14,background:"rgba(255,255,255,0.02)",borderRadius:2,overflow:"hidden"}}><div style={{position:"absolute",left:"50%",top:0,bottom:0,width:1,background:"rgba(255,255,255,0.08)"}}/><div style={{position:"absolute",left:`${l}%`,top:2,bottom:2,width:`${w}%`,background:value>=0?"rgba(42,157,143,0.55)":"rgba(230,57,70,0.55)",borderRadius:1}}/></div>;
}

/* ─── NARRATIVE LIFECYCLE TIMELINE ─── */
function NarrativeTimeline({narratives, months}){
  const allNarr = narratives.filter(n=>n.lifecycle&&n.lifecycle.length>0);
  const monthLabels = months.map(m=>m.label);
  const monthKeys = months.map(m=>m.month);
  const statusColor = s => ({strengthening:"#e63946",stable:"#457b9d",weakening:"#f4a261",collapsed:"#555",emerging:"#2a9d8f",candidate:"#bb86fc"}[s]||"#555");
  
  return (
    <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:8,padding:"14px 16px",marginBottom:18}}>
      <div style={{fontSize:10,color:"#5a5850",fontWeight:700,letterSpacing:"0.04em",marginBottom:10}}>NARRATIVE LIFECYCLE TIMELINE</div>
      {/* Month headers */}
      <div style={{display:"grid",gridTemplateColumns:`120px repeat(${monthLabels.length},1fr)`,gap:0,marginBottom:4}}>
        <div/>
        {monthLabels.map((l,i)=><div key={i} style={{fontSize:8,color:"#4a4840",textAlign:"center"}}>{l}</div>)}
      </div>
      {/* Each narrative row */}
      {allNarr.map(n=>{
        const c = ST[n.status]||ST.emerging;
        const opacity = n.status==="collapsed"?0.3:n.status==="weakening"?0.55:1;
        return (
          <div key={n.id} style={{display:"grid",gridTemplateColumns:`120px repeat(${monthKeys.length},1fr)`,gap:0,marginBottom:6,opacity,transition:"opacity 0.5s"}}>
            <div style={{fontSize:10,color:c.color,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:6}}>{n.name}</div>
            {monthKeys.map((mk,i)=>{
              // Find if this narrative has a lifecycle entry for this month or is active during this period
              const lcEntry = n.lifecycle?.find(lc=>lc.month===mk);
              const startIdx = monthKeys.indexOf(n.startMonth||n.lifecycle?.[0]?.month);
              const isActive = startIdx>=0 && i>=startIdx;
              // Find closest previous status
              let currentStatus = null;
              if(isActive && n.lifecycle){
                for(let j=n.lifecycle.length-1;j>=0;j--){
                  const lcMIdx = monthKeys.indexOf(n.lifecycle[j].month);
                  if(lcMIdx>=0 && lcMIdx<=i){ currentStatus=n.lifecycle[j].status; break; }
                }
              }
              const col = currentStatus ? statusColor(currentStatus) : "transparent";
              const isTransition = lcEntry != null;
              return (
                <div key={mk} style={{display:"flex",alignItems:"center",justifyContent:"center",height:18}}>
                  {isActive && currentStatus ? (
                    <div style={{position:"relative",width:"100%",height:6,display:"flex",alignItems:"center"}}>
                      <div style={{width:"100%",height:4,background:col,opacity:0.5,borderRadius:i===startIdx?"2px 0 0 2px":"0"}}/>
                      {isTransition && <div style={{position:"absolute",left:"50%",transform:"translateX(-50%)",width:10,height:10,borderRadius:"50%",background:col,border:"2px solid #0f0f0e"}}/>}
                    </div>
                  ) : <div style={{width:"100%",height:4}}/>}
                </div>
              );
            })}
          </div>
        );
      })}
      {/* Legend */}
      <div style={{display:"flex",gap:12,marginTop:8,flexWrap:"wrap"}}>
        {[["strengthening","강화"],["stable","유지"],["emerging","부상"],["weakening","약화"],["collapsed","붕괴"]].map(([s,l])=>(
          <div key={s} style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:8,height:4,borderRadius:1,background:statusColor(s)}}/>
            <span style={{fontSize:8.5,color:"#5a5850"}}>{l}</span>
          </div>
        ))}
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:"#6b6960"}}/>
          <span style={{fontSize:8.5,color:"#5a5850"}}>상태 전환</span>
        </div>
      </div>
    </div>
  );
}

/* ─── NARRATIVE CARD (with fade) ─── */
function NCard({n,expanded,onToggle}){
  const c=ST[n.status]||ST.emerging;
  const fade=n.status==="collapsed"?0.3:n.status==="weakening"?0.6:1;
  return (
    <div onClick={onToggle} style={{background:c.bg,border:`1px solid ${c.border}`,borderRadius:8,padding:"13px 16px",marginBottom:8,cursor:"pointer",opacity:fade,transition:"opacity 0.6s ease, transform 0.3s",transform:n.status==="collapsed"?"scale(0.97)":"scale(1)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2,flexWrap:"wrap"}}>
            <span style={{color:c.color,fontSize:12,fontWeight:700}}>{ICONS[n.status]||"?"}</span>
            <span style={{fontSize:13,fontWeight:700,color:"#e8e6e1"}}>{n.name}</span>
            <span style={{fontSize:9,padding:"1px 6px",borderRadius:10,background:c.color,color:"#fff",fontWeight:600}}>{c.label}</span>
            {n.isNew&&<span style={{fontSize:8.5,padding:"1px 5px",borderRadius:8,background:"rgba(187,134,252,0.3)",color:"#bb86fc",fontWeight:600,animation:"pulse 2s infinite"}}>AI 발견</span>}
            {n.rank!=null&&<span style={{fontSize:8.5,padding:"1px 5px",borderRadius:8,background:"rgba(244,162,97,0.2)",color:"#f4a261",fontWeight:600}}>#{n.rank} 후보</span>}
          </div>
          <div style={{fontSize:10,color:"#5a5850"}}>{n.nameEn} · {n.evidenceMonths}개월</div>
        </div>
        <div style={{fontSize:9,color:"#5a5850",transform:expanded?"rotate(180deg)":"",transition:"transform 0.2s"}}>▼</div>
      </div>
      {expanded&&(
        <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${c.border}`}}>
          <p style={{fontSize:11.5,color:"#a8a6a0",lineHeight:1.6,margin:"0 0 10px"}}>{n.description}</p>
          {n.supporting?.length>0&&<div style={{marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:700,color:"#2a9d8f",marginBottom:4}}>SUPPORTING</div>
            {n.supporting.map((e,i)=><div key={i} style={{fontSize:10.5,color:"#8a8780",padding:"2px 0 2px 9px",borderLeft:"2px solid rgba(42,157,143,0.3)",marginBottom:2}}><span style={{color:"#4a4840",fontFamily:"monospace",fontSize:9,marginRight:4}}>{e.month}</span>{e.text}</div>)}
          </div>}
          {n.contradicting?.length>0&&<div style={{marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:700,color:"#e63946",marginBottom:4}}>CONTRADICTING</div>
            {n.contradicting.map((e,i)=><div key={i} style={{fontSize:10.5,color:"#8a8780",padding:"2px 0 2px 9px",borderLeft:"2px solid rgba(230,57,70,0.3)",marginBottom:2}}><span style={{color:"#4a4840",fontFamily:"monospace",fontSize:9,marginRight:4}}>{e.month}</span>{e.text}</div>)}
          </div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:6}}>
            <div style={{background:"rgba(255,255,255,0.02)",borderRadius:5,padding:"8px 10px"}}>
              <div style={{fontSize:9,color:"#4a4840",fontWeight:600,marginBottom:2}}>MACRO</div>
              <div style={{fontSize:10.5,color:"#8a8780",lineHeight:1.45}}>{n.implication}</div>
            </div>
            <div style={{background:"rgba(255,255,255,0.02)",borderRadius:5,padding:"8px 10px"}}>
              <div style={{fontSize:9,color:"#4a4840",fontWeight:600,marginBottom:2}}>BOND VIEW</div>
              <div style={{fontSize:10.5,color:"#8a8780",lineHeight:1.45}}>{n.bondView}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── AI PANEL ─── */
function AIPanel({months,narratives,onResult,loading,lastResult}){
  const [mode,setMode]=useState("analyze");
  const [newData,setNewData]=useState("");
  const [ctx,setCtx]=useState("");
  const [showInput,setShowInput]=useState(false);

  const prompt=()=>{
    const recent=months.slice(-3);
    const md=recent.map(m=>`${m.label}: NFP${m.nfp>=0?"+":""}${m.nfp}K UR${m.ur}% Wage${m.wage_yoy}% U6${m.u6}% UP:${m.sectors_up.join(",")} DOWN:${m.sectors_down.join(",")}`).join("\n");
    const older=months.slice(0,-3).map(m=>`${m.label}: NFP${m.nfp>=0?"+":""}${m.nfp}K UR${m.ur}%`).join(" | ");
    const nd=narratives.filter(n=>n.status!=="collapsed").map(n=>`[${n.status}] ${n.name}(${n.id})`).join(", ");
    return `US employment narrative analyst for Korean bond PM (insurance).

Recent: ${md}
Earlier: ${older}
Active narratives: ${nd}
${mode==="add_data"&&newData?`New data: ${newData}`:""}
${ctx?`Context: ${ctx}`:""}

Return ONLY valid JSON, no backticks. Keep all text SHORT (each field under 40 chars for candidates).
{"narrative_updates":[{"id":"existing-id","action":"update_status","new_status":"strengthening|stable|weakening|collapsed","evidence":{"month":"YYYY-MM","text":"short KR"},"reason":"short KR"}],"candidates":[{"id":"kebab-id","name":"한국어 10자내","nameEn":"Short En","probability":0.85,"description":"한국어 1문장","evidence":"핵심증거 15자","implication":"함의 15자","bondView":"채권 15자"}],"synthesis":"종합 2-3문장 한국어","next_watch":"검증 1문장"}

Rules: candidates must be exactly 5, probability desc, new angles only. narrative_updates: [] if no changes. Bond investor view required.`;
  };

  // Attempt to repair truncated JSON
  const repairJSON=(str)=>{
    let s=str.replace(/```json|```/g,"").trim();
    try{ return JSON.parse(s); }catch(e){}
    // Try closing open structures
    let opened=0, inStr=false, esc=false;
    for(let i=0;i<s.length;i++){
      const c=s[i];
      if(esc){esc=false;continue;}
      if(c==='\\'){esc=true;continue;}
      if(c==='"'){inStr=!inStr;continue;}
      if(inStr)continue;
      if(c==='{'||c==='[')opened++;
      if(c==='}'||c===']')opened--;
    }
    // Close any unclosed strings
    if(inStr) s+='"';
    // Close arrays/objects
    // Find last complete element
    const lastComma=s.lastIndexOf(',');
    const lastBrace=Math.max(s.lastIndexOf('}'),s.lastIndexOf(']'));
    if(lastComma>lastBrace) s=s.substring(0,lastComma);
    // Recount and close
    opened=0; inStr=false; esc=false;
    for(let i=0;i<s.length;i++){
      const c=s[i];
      if(esc){esc=false;continue;}
      if(c==='\\'){esc=true;continue;}
      if(c==='"'){inStr=!inStr;continue;}
      if(inStr)continue;
      if(c==='{'||c==='[')opened++;
      if(c==='}'||c===']')opened--;
    }
    // Build closing chars by scanning what was opened
    const stack=[];
    inStr=false; esc=false;
    for(let i=0;i<s.length;i++){
      const c=s[i];
      if(esc){esc=false;continue;}
      if(c==='\\'){esc=true;continue;}
      if(c==='"'){inStr=!inStr;continue;}
      if(inStr)continue;
      if(c==='{')stack.push('}');
      else if(c==='[')stack.push(']');
      else if(c==='}'||c===']')stack.pop();
    }
    s+=stack.reverse().join('');
    try{ return JSON.parse(s); }catch(e2){
      // Last resort: try to extract at least synthesis
      const synthMatch=s.match(/"synthesis"\s*:\s*"([^"]+)"/);
      return {narrative_updates:[],candidates:[],synthesis:synthMatch?synthMatch[1]:"분석 결과를 파싱할 수 없습니다. 다시 시도해주세요.",next_watch:""};
    }
  };

  const run=async()=>{
    onResult({type:"loading"});
    try{
      const res=await fetch("/api/narrative-ai",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({prompt:prompt(),system:"You output ONLY valid compact JSON. No markdown. No backticks. No explanation. Keep Korean text very concise."})});
      const d=await res.json();
      const t=d.content?.map(i=>i.text||"").join("")||"";
      if(!t) throw new Error("Empty response from API");
      const parsed=repairJSON(t);
      onResult({type:"success",result:parsed});
    }catch(e){onResult({type:"error",error:e.message});}
  };

  return (
    <div style={{background:"linear-gradient(135deg,rgba(187,134,252,0.06),rgba(42,157,143,0.04))",border:"1px solid rgba(187,134,252,0.2)",borderRadius:10,padding:"16px 18px",marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:showInput?12:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>🤖</span>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#bb86fc"}}>AI Narrative Engine</div>
            <div style={{fontSize:9.5,color:"#6b6960"}}>내러티브 재평가 · 후보 5개 발견 · 붕괴 판단</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setShowInput(!showInput)} style={{padding:"6px 12px",border:"1px solid rgba(255,255,255,0.08)",borderRadius:5,background:"transparent",color:"#8a8780",cursor:"pointer",fontSize:10,fontWeight:600}}>
            {showInput?"접기":"입력 ▼"}
          </button>
          <button onClick={run} disabled={loading} style={{
            padding:"6px 18px",border:"none",borderRadius:6,
            background:loading?"rgba(187,134,252,0.1)":"linear-gradient(135deg,#bb86fc,#2a9d8f)",
            color:loading?"#6b6960":"#0f0f0e",cursor:loading?"wait":"pointer",fontSize:11,fontWeight:800,letterSpacing:"0.02em"
          }}>
            {loading?"⏳ 분석 중...":"🔍 AI 업데이트"}
          </button>
        </div>
      </div>
      {showInput&&(
        <div>
          <div style={{display:"flex",gap:4,marginBottom:8}}>
            {[{k:"analyze",l:"현재 재분석"},{k:"add_data",l:"신규 데이터"}].map(t=>(
              <button key={t.k} onClick={()=>setMode(t.k)} style={{padding:"3px 10px",border:`1px solid ${mode===t.k?"rgba(187,134,252,0.4)":"rgba(255,255,255,0.06)"}`,borderRadius:4,background:mode===t.k?"rgba(187,134,252,0.1)":"transparent",color:mode===t.k?"#bb86fc":"#5a5850",cursor:"pointer",fontSize:10,fontWeight:600}}>{t.l}</button>
            ))}
          </div>
          {mode==="add_data"&&<textarea value={newData} onChange={e=>setNewData(e.target.value)} placeholder="3월 NFP +85K, UR 4.3%, Healthcare +45K..." style={{width:"100%",minHeight:55,background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:5,padding:"7px 9px",color:"#b5b3ae",fontSize:11,resize:"vertical",fontFamily:"inherit",lineHeight:1.5,boxSizing:"border-box",marginBottom:6}}/>}
          <textarea value={ctx} onChange={e=>setCtx(e.target.value)} placeholder="추가 맥락 (연준 발언, 시장 반응 등)" style={{width:"100%",minHeight:35,background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:5,padding:"7px 9px",color:"#b5b3ae",fontSize:11,resize:"vertical",fontFamily:"inherit",lineHeight:1.5,boxSizing:"border-box"}}/>
        </div>
      )}
      {lastResult?.type==="error"&&<div style={{marginTop:8,padding:"6px 10px",background:"rgba(230,57,70,0.08)",borderRadius:5,fontSize:10.5,color:"#e63946"}}>⚠️ {lastResult.error}</div>}
    </div>
  );
}

/* ─── CANDIDATES SECTION ─── */
function CandidatesPanel({candidates}){
  if(!candidates||candidates.length===0) return null;
  const sorted=[...candidates].sort((a,b)=>(b.probability||0)-(a.probability||0));
  const top3=sorted.slice(0,3);
  const rest=sorted.slice(3);
  return (
    <div style={{marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <span style={{fontSize:13,fontWeight:800,color:"#bb86fc"}}>★ Narrative Candidates</span>
        <span style={{fontSize:9.5,color:"#5a5850"}}>AI가 발견한 신규 후보 · 상위 3개 하이라이트</span>
      </div>
      {/* Top 3 */}
      {top3.map((c,i)=>{
        const prob=Math.round((c.probability||0)*100);
        const barW=prob;
        const accent=i===0?"#bb86fc":i===1?"#8ecae6":"#2a9d8f";
        return (
          <div key={c.id} style={{background:"rgba(187,134,252,0.04)",border:`1px solid ${i===0?"rgba(187,134,252,0.25)":"rgba(187,134,252,0.1)"}`,borderRadius:8,padding:"12px 14px",marginBottom:6,position:"relative",overflow:"hidden"}}>
            {/* Probability bar background */}
            <div style={{position:"absolute",top:0,left:0,bottom:0,width:`${barW}%`,background:`linear-gradient(90deg,${accent}08,transparent)`,pointerEvents:"none"}}/>
            <div style={{position:"relative"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:14,fontWeight:800,color:accent}}>#{i+1}</span>
                  <span style={{fontSize:12.5,fontWeight:700,color:"#e8e6e1"}}>{c.name}</span>
                  <span style={{fontSize:9,color:"#6b6960"}}>{c.nameEn}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <div style={{width:40,height:5,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}>
                    <div style={{width:`${prob}%`,height:"100%",background:accent,borderRadius:3}}/>
                  </div>
                  <span style={{fontSize:11,fontWeight:700,color:accent,fontFamily:"monospace"}}>{prob}%</span>
                </div>
              </div>
              <div style={{fontSize:11,color:"#9a9890",lineHeight:1.5,marginBottom:4}}>{c.description}</div>
              <div style={{display:"flex",gap:12,fontSize:10,color:"#6b6960"}}>
                <span>📌 {c.evidence}</span>
              </div>
              <div style={{display:"flex",gap:10,marginTop:6,fontSize:10}}>
                <span style={{color:"#5a5850"}}>Macro: <span style={{color:"#8a8780"}}>{c.implication}</span></span>
                <span style={{color:"#5a5850"}}>Bond: <span style={{color:"#8a8780"}}>{c.bondView}</span></span>
              </div>
            </div>
          </div>
        );
      })}
      {/* Rest (dimmed) */}
      {rest.map((c,i)=>(
        <div key={c.id} style={{background:"rgba(255,255,255,0.015)",border:"1px solid rgba(255,255,255,0.04)",borderRadius:6,padding:"8px 12px",marginBottom:4,opacity:0.5}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11,color:"#5a5850",fontWeight:600}}>#{i+4}</span>
              <span style={{fontSize:11,color:"#8a8780"}}>{c.name}</span>
              <span style={{fontSize:9,color:"#4a4840"}}>{c.nameEn}</span>
            </div>
            <span style={{fontSize:10,color:"#4a4840",fontFamily:"monospace"}}>{Math.round((c.probability||0)*100)}%</span>
          </div>
          <div style={{fontSize:10,color:"#5a5850",marginTop:2}}>{c.description}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── AI SYNTHESIS ─── */
function AISynth({result}){
  if(!result||result.type!=="success") return null;
  const r=result.result;
  return (
    <div style={{background:"rgba(187,134,252,0.04)",border:"1px solid rgba(187,134,252,0.15)",borderRadius:8,padding:"14px 16px",marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}>
        <span style={{fontSize:11}}>🤖</span>
        <span style={{fontSize:10.5,fontWeight:700,color:"#bb86fc"}}>AI SYNTHESIS</span>
      </div>
      {r.synthesis&&<div style={{fontSize:11.5,color:"#b5b3ae",lineHeight:1.65,marginBottom:10}}>{r.synthesis}</div>}
      {r.narrative_updates?.length>0&&<div style={{marginBottom:8}}>
        <div style={{fontSize:9.5,color:"#8a8780",fontWeight:700,marginBottom:3}}>CHANGES APPLIED</div>
        {r.narrative_updates.map((u,i)=><div key={i} style={{fontSize:10.5,color:"#9a9890",padding:"2px 0 2px 8px",borderLeft:"2px solid rgba(187,134,252,0.25)",marginBottom:2}}><strong style={{color:"#bb86fc"}}>{u.id}</strong> {u.action}{u.new_status?` → ${u.new_status}`:""} {u.reason?`| ${u.reason}`:""}</div>)}
      </div>}
      {r.next_watch&&<div style={{fontSize:10.5,color:"#7a7870",padding:"6px 8px",background:"rgba(255,255,255,0.015)",borderRadius:4}}>📡 {r.next_watch}</div>}
    </div>
  );
}

/* ─── MAIN ─── */
export default function App(){
  const [narratives,setNarratives]=useState(INIT_NARRATIVES);
  const [sel,setSel]=useState(MONTHS.length-1);
  const [expN,setExpN]=useState("k-shaped");
  const [ai,setAi]=useState({loading:false,lastResult:null});
  const [candidates,setCandidates]=useState(null);

  const cur=MONTHS[sel], prv=sel>0?MONTHS[sel-1]:null;
  const d=k=>prv?cur[k]-prv[k]:null;

  const handleAI=useCallback(update=>{
    if(update.type==="loading"){setAi({loading:true,lastResult:null});return;}
    setAi({loading:false,lastResult:update});
    if(update.type==="success"&&update.result){
      const r=update.result;
      // Apply narrative updates
      setNarratives(prev=>{
        let u=prev.map(n=>({...n,supporting:[...n.supporting],contradicting:[...n.contradicting],lifecycle:[...(n.lifecycle||[])]}));
        if(r.narrative_updates){
          for(const up of r.narrative_updates){
            const idx=u.findIndex(n=>n.id===up.id);if(idx===-1)continue;
            if(up.new_status){
              u[idx].status=up.new_status;
              u[idx].lifecycle.push({month:MONTHS[MONTHS.length-1].month,status:up.new_status});
            }
            if(up.action==="add_evidence"&&up.evidence)u[idx].supporting.push(up.evidence);
            if(up.action==="add_contradiction"&&up.evidence)u[idx].contradicting.push(up.evidence);
          }
        }
        return u;
      });
      // Set candidates
      if(r.candidates) setCandidates(r.candidates);
    }
  },[]);

  const active=narratives.filter(n=>n.status!=="collapsed");
  const fading=narratives.filter(n=>n.status==="weakening"||n.status==="collapsed");
  const collapsed=narratives.filter(n=>n.status==="collapsed");

  return (
    <div style={{fontFamily:"'IBM Plex Sans','Pretendard',-apple-system,sans-serif",background:"#0f0f0e",color:"#e8e6e1",minHeight:"100vh",padding:"20px 16px",maxWidth:960,margin:"0 auto"}}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      {/* HEADER */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,paddingBottom:12,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:16,fontWeight:800,letterSpacing:"-0.04em"}}>🐺 US Employment Narrative Monitor</span>
            <span style={{fontSize:9,padding:"2px 6px",borderRadius:10,background:"rgba(230,57,70,0.15)",color:"#e63946",fontWeight:600}}>LIVE</span>
          </div>
          <div style={{fontSize:10,color:"#4a4840",marginTop:2}}>늑대무리원정단 · 3개월 증거 기반 · AI 자동 발견/붕괴</div>
        </div>
      </div>

      {/* AI PANEL — 최상단 배치 */}
      <AIPanel months={MONTHS} narratives={narratives} onResult={handleAI} loading={ai.loading} lastResult={ai.lastResult}/>

      {/* AI Synthesis */}
      <AISynth result={ai.lastResult}/>

      {/* Candidates (AI 발견 후보) */}
      <CandidatesPanel candidates={candidates}/>

      {/* TIMELINE SELECTOR */}
      <div style={{display:"flex",gap:3,marginBottom:16,overflowX:"auto",paddingBottom:3}}>
        {MONTHS.map((m,i)=>(
          <button key={m.month} onClick={()=>setSel(i)} style={{
            padding:"6px 10px",border:"1px solid",borderColor:i===sel?"rgba(69,123,157,0.5)":"rgba(255,255,255,0.04)",
            borderRadius:5,background:i===sel?"rgba(69,123,157,0.1)":"transparent",
            color:i===sel?"#8ecae6":"#4a4840",cursor:"pointer",fontSize:10,fontWeight:600,whiteSpace:"nowrap",position:"relative"
          }}>
            {m.label}
            <div style={{fontSize:9,marginTop:1,color:m.nfp>=0?"#2a9d8f":"#e63946",fontFamily:"monospace"}}>{m.nfp>=0?"+":""}{m.nfp}K</div>
            {m.revised&&<div style={{position:"absolute",top:0,right:2,fontSize:6,color:"#f4a261"}}>R</div>}
          </button>
        ))}
      </div>

      {/* METRICS */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:14}}>
        {[{label:"비농업고용",value:`${cur.nfp>=0?"+":""}${cur.nfp}K`,dd:d("nfp"),u:"K",color:cur.nfp>=0?"#2a9d8f":"#e63946",inv:false},
          {label:"실업률",value:`${cur.ur}%`,dd:d("ur"),u:"%p",color:"#e8e6e1",inv:true},
          {label:"임금 YoY",value:`${cur.wage_yoy}%`,dd:d("wage_yoy"),u:"%p",color:cur.wage_yoy>=3.5?"#f4a261":"#2a9d8f",inv:false},
          {label:"U-6",value:`${cur.u6}%`,dd:d("u6"),u:"%p",color:"#e8e6e1",inv:true}
        ].map((m,i)=>(
          <div key={i} style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.04)",borderRadius:7,padding:"10px 12px"}}>
            <div style={{fontSize:9,color:"#4a4840",fontWeight:600,letterSpacing:"0.04em",marginBottom:4}}>{m.label}</div>
            <div style={{fontSize:19,fontWeight:800,color:m.color,fontFamily:"'IBM Plex Mono',monospace"}}>{m.value}</div>
            {m.dd!=null&&<div style={{fontSize:9,color:m.dd>0?(m.inv?"#e63946":"#2a9d8f"):m.dd<0?(m.inv?"#2a9d8f":"#e63946"):"#4a4840",marginTop:1}}>{m.dd>0?"+":""}{m.dd.toFixed(1)}{m.u}</div>}
          </div>
        ))}
      </div>

      {/* SPARKLINES + NFP BARS */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:14}}>
        {[{l:"NFP",k:"nfp",c:"#457b9d"},{l:"UR",k:"ur",c:"#e63946"},{l:"WAGE",k:"wage_yoy",c:"#f4a261"}].map((s,i)=>(
          <div key={i} style={{background:"rgba(255,255,255,0.02)",borderRadius:7,padding:"9px 12px"}}>
            <div style={{fontSize:9,color:"#4a4840",fontWeight:600,marginBottom:5}}>{s.l}</div>
            <Spark data={MONTHS} k={s.k} color={s.c}/>
          </div>
        ))}
      </div>

      <div style={{background:"rgba(255,255,255,0.02)",borderRadius:7,padding:"12px 16px",marginBottom:14,border:"1px solid rgba(255,255,255,0.04)"}}>
        <div style={{display:"grid",gridTemplateColumns:`repeat(${MONTHS.length},1fr)`,gap:4}}>
          {MONTHS.map((m,i)=>(
            <div key={m.month} style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:m.nfp>=0?"#2a9d8f":"#e63946",fontFamily:"monospace",fontWeight:700,marginBottom:2}}>{m.nfp>=0?"+":""}{m.nfp}</div>
              <Bar value={m.nfp}/>
              <div style={{fontSize:8,color:i===sel?"#8ecae6":"#2a2820",marginTop:2,fontWeight:i===sel?700:400}}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTORS */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:14}}>
        <div style={{background:"rgba(42,157,143,0.03)",border:"1px solid rgba(42,157,143,0.1)",borderRadius:7,padding:"10px 12px"}}>
          <div style={{fontSize:9,color:"#2a9d8f",fontWeight:700,marginBottom:5}}>증가 · {cur.label}</div>
          {cur.sectors_up.map((s,i)=><div key={i} style={{fontSize:11,color:"#8a8780",padding:"1px 0"}}>{s}</div>)}
        </div>
        <div style={{background:"rgba(230,57,70,0.03)",border:"1px solid rgba(230,57,70,0.1)",borderRadius:7,padding:"10px 12px"}}>
          <div style={{fontSize:9,color:"#e63946",fontWeight:700,marginBottom:5}}>감소 · {cur.label}</div>
          {cur.sectors_down.map((s,i)=><div key={i} style={{fontSize:11,color:"#8a8780",padding:"1px 0"}}>{s}</div>)}
        </div>
      </div>

      {/* NOTE */}
      {cur.note&&<div style={{background:"rgba(244,162,97,0.04)",border:"1px solid rgba(244,162,97,0.12)",borderRadius:7,padding:"10px 12px",marginBottom:18}}>
        <div style={{fontSize:9,color:"#f4a261",fontWeight:700,marginBottom:2}}>NOTE · {cur.label}</div>
        <div style={{fontSize:11,color:"#a8a6a0",lineHeight:1.55}}>{cur.note}</div>
      </div>}

      {/* NARRATIVE LIFECYCLE TIMELINE */}
      <NarrativeTimeline narratives={narratives} months={MONTHS}/>

      {/* ACTIVE NARRATIVES (with fade for weakening) */}
      <div style={{marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <span style={{fontSize:12.5,fontWeight:800,color:"#e8e6e1"}}>Active Narratives</span>
          <span style={{fontSize:9.5,color:"#4a4840"}}>최대 3개 · opacity로 강도 표현</span>
        </div>
        <div style={{fontSize:10,color:"#6b6960",marginBottom:10,padding:"8px 10px",background:"rgba(255,255,255,0.012)",borderRadius:5,lineHeight:1.5}}>
          📐 <strong style={{color:"#8a8780"}}>시각 규칙</strong>: 강화 → 100% 선명 · 유지 → 80% · 약화 → 60% 페이드 · 붕괴 → 30% + 축소. AI 후보 중 3개월 지지 시 승격.
        </div>
        {active.map(n=><NCard key={n.id} n={n} expanded={expN===n.id} onToggle={()=>setExpN(expN===n.id?null:n.id)}/>)}
      </div>

      {/* COLLAPSED (visually faded) */}
      {collapsed.length>0&&<div style={{marginBottom:16}}>
        <div style={{fontSize:10,color:"#3a3830",fontWeight:600,marginBottom:6}}>Archived (붕괴)</div>
        {collapsed.map(n=><NCard key={n.id} n={n} expanded={expN===n.id} onToggle={()=>setExpN(expN===n.id?null:n.id)}/>)}
      </div>}

      {/* DOGE */}
      <div style={{background:"rgba(255,255,255,0.02)",borderRadius:7,padding:"12px 16px",marginBottom:16,border:"1px solid rgba(255,255,255,0.04)"}}>
        <div style={{fontSize:9,color:"#4a4840",fontWeight:600,marginBottom:6}}>DOGE TRACKER</div>
        <div style={{display:"flex",gap:16,marginBottom:6}}>
          <div><div style={{fontSize:20,fontWeight:800,color:"#e63946",fontFamily:"monospace"}}>-330K</div><div style={{fontSize:9,color:"#4a4840"}}>누적 감소</div></div>
          <div><div style={{fontSize:20,fontWeight:800,color:"#e63946",fontFamily:"monospace"}}>-11%</div><div style={{fontSize:9,color:"#4a4840"}}>감축률</div></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:`repeat(${MONTHS.length},1fr)`,gap:2}}>
          {MONTHS.map(m=><div key={m.month} style={{textAlign:"center"}}><div style={{fontSize:8.5,color:"#e63946",fontFamily:"monospace",fontWeight:600}}>{m.fed_gov_chg}K</div><div style={{height:Math.abs(m.fed_gov_chg)*0.9,background:"rgba(230,57,70,0.22)",borderRadius:1,margin:"1px auto",width:"50%"}}/><div style={{fontSize:7,color:"#2a2820"}}>{m.label.slice(-5)}</div></div>)}
        </div>
      </div>

      {/* NEXT */}
      <div style={{background:"rgba(255,255,255,0.012)",border:"1px dashed rgba(255,255,255,0.06)",borderRadius:7,padding:"10px 12px"}}>
        <div style={{fontSize:9,color:"#4a4840",fontWeight:600,marginBottom:3}}>NEXT</div>
        <div style={{fontSize:11,color:"#8a8780"}}>📅 <strong style={{color:"#8ecae6"}}>3월 고용</strong> 2026.04.03 — Healthcare 반등? Manufacturing 추가 악화? 연방정부 감축 지속?</div>
      </div>

      <div style={{fontSize:8,color:"#1a1810",textAlign:"center",marginTop:18}}>Wolfpack · Employment Narrative · Mar 8 2026</div>
    </div>
  );
}
