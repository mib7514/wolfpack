"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, Cell, ReferenceLine
} from "recharts";

const GOLD = "#D4A017", GOLD_L = "#F5E6B8", BG = "#0A0A0F", BGC = "#111118", BGC2 = "#16161F";
const BD = "#2A2A35", T1 = "#E8E4DD", T2 = "#9A9690", T3 = "#5A5650";
const RED = "#E84855", GRN = "#3ECF8E", BLU = "#4A9EFF", ORG = "#FF6B35", PUR = "#9B59B6", CYA = "#1ABC9C";

/* ─── Admin PIN Hook ─── */
function useAdminPin(moduleKey) {
  const storageKey = `wolfpack_admin_${moduleKey}`;
  const [pin, setPin] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pinError, setPinError] = useState('');
  useEffect(() => { const saved = sessionStorage.getItem(storageKey); if (saved) { setPin(saved); setIsAdmin(true); } }, [storageKey]);
  const openModal = useCallback(() => { setPinError(''); setShowModal(true); }, []);
  const closeModal = useCallback(() => { setShowModal(false); setPinError(''); }, []);
  const logout = useCallback(() => { setIsAdmin(false); setPin(''); sessionStorage.removeItem(storageKey); }, [storageKey]);
  const verify = useCallback(async (inputPin) => {
    try {
      const res = await fetch('/api/gold-update', { method: 'POST', headers: { 'x-admin-pin': inputPin } });
      if (res.status === 401) { setPinError('PIN이 일치하지 않습니다'); return false; }
      setPin(inputPin); setIsAdmin(true); sessionStorage.setItem(storageKey, inputPin); setShowModal(false); setPinError(''); return true;
    } catch { setPinError('서버 연결 오류'); return false; }
  }, [storageKey]);
  return { pin, isAdmin, showModal, pinError, openModal, closeModal, logout, verify };
}

function PinModal({ admin }) {
  const [inputPin, setInputPin] = useState('');
  if (!admin.showModal) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}} onClick={admin.closeModal}>
      <div style={{background:BGC2,border:`1px solid ${BD}`,borderRadius:14,padding:24,width:300,boxShadow:"0 8px 32px rgba(0,0,0,0.4)"}} onClick={e=>e.stopPropagation()}>
        <h3 style={{fontSize:15,fontWeight:700,color:T1,marginBottom:4}}>🔐 관리자 인증</h3>
        <p style={{fontSize:11,color:T3,marginBottom:16}}>AI 업데이트는 관리자만 사용할 수 있습니다</p>
        <input type="password" placeholder="PIN 입력" value={inputPin} onChange={e=>setInputPin(e.target.value)} onKeyDown={e=>e.key==='Enter'&&admin.verify(inputPin)}
          style={{width:"100%",padding:"10px 14px",background:"rgba(0,0,0,0.3)",border:`1px solid ${BD}`,borderRadius:8,fontSize:16,textAlign:"center",letterSpacing:"0.3em",color:T1,outline:"none",boxSizing:"border-box"}} autoFocus />
        {admin.pinError && <p style={{color:RED,fontSize:11,textAlign:"center",marginTop:8}}>{admin.pinError}</p>}
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <button onClick={admin.closeModal} style={{flex:1,padding:"9px 0",border:`1px solid ${BD}`,borderRadius:8,background:"transparent",color:T3,fontSize:12,cursor:"pointer"}}>취소</button>
          <button onClick={()=>admin.verify(inputPin)} style={{flex:1,padding:"9px 0",border:"none",borderRadius:8,background:GOLD,color:"#000",fontSize:12,fontWeight:700,cursor:"pointer"}}>인증</button>
        </div>
      </div>
    </div>
  );
}

// ─── BASE DATA (fallback when no AI update yet) ───
const BASE = {
  price: { price: 5278, change_pct: 1.97, ath: 5595, ytd_pct: 21.6, updated: "2026-03-01" },
  monthlyData: [
    { month:"Jan",m2024:18,m2025:18,m2026:5,label:"1월" },{ month:"Feb",m2024:19,m2025:24,m2026:null,label:"2월" },
    { month:"Mar",m2024:36,m2025:17,m2026:null,label:"3월" },{ month:"Apr",m2024:33,m2025:15,m2026:null,label:"4월" },
    { month:"May",m2024:10,m2025:16,m2026:null,label:"5월" },{ month:"Jun",m2024:12,m2025:17,m2026:null,label:"6월" },
    { month:"Jul",m2024:37,m2025:11,m2026:null,label:"7월" },{ month:"Aug",m2024:20,m2025:19,m2026:null,label:"8월" },
    { month:"Sep",m2024:186,m2025:39,m2026:null,label:"9월" },{ month:"Oct",m2024:60,m2025:53,m2026:null,label:"10월" },
    { month:"Nov",m2024:53,m2025:45,m2026:null,label:"11월" },{ month:"Dec",m2024:333,m2025:null,m2026:null,label:"12월" },
  ],
  annualData: [
    { year:"2018",total:656,yoy:null },{ year:"2019",total:605,yoy:-7.8 },
    { year:"2020",total:255,yoy:-57.9 },{ year:"2021",total:463,yoy:81.6 },
    { year:"2022",total:1082,yoy:133.7 },{ year:"2023",total:1037,yoy:-4.2 },
    { year:"2024",total:1045,yoy:0.8 },{ year:"2025",total:863,yoy:-17.4 },
    { year:"2026E",total:850,yoy:-1.5 },
  ],
  topBuyers: [
    { country:"🇵🇱 폴란드",tonnes:102,reserves:550,share:"26%" },
    { country:"🇰🇿 카자흐스탄",tonnes:57,reserves:340,share:"54%" },
    { country:"🇧🇷 브라질",tonnes:43,reserves:172,share:"7%" },
    { country:"🇦🇿 아제르바이잔",tonnes:38,reserves:null,share:"-" },
    { country:"🇨🇳 중국",tonnes:27,reserves:2306,share:"~9%" },
    { country:"🇹🇷 튀르키예",tonnes:27,reserves:644,share:"-" },
    { country:"🇨🇿 체코",tonnes:20,reserves:72,share:"-" },
    { country:"🇮🇩 인도네시아",tonnes:10,reserves:80,share:"5.9%" },
  ],
  topBuyers2026: [
    { country:"🇺🇿 우즈베키스탄",tonnes:9,reserves:399,share:"86%",note:"1월 최대 매입국" },
    { country:"🇲🇾 말레이시아",tonnes:3,reserves:42,share:"5%",note:"2018년 이후 최초" },
    { country:"🇨🇿 체코",tonnes:2,reserves:72,share:"3%",note:"연속 매입" },
    { country:"🇨🇳 중국",tonnes:1.2,reserves:2308,share:"~9.6%",note:"15개월 연속" },
    { country:"🇧🇬 불가리아",tonnes:-2,reserves:null,share:"-",note:"유로존 가입에 따른 매도" },
  ],
  thesis: {
    target: 900, ytdReported: 5, monthsElapsed: 1, monthsRemaining: 11,
    projections: [
      { id:"china",flag:"🇨🇳",name:"중국 (PBOC)",reported:15,estimated:250,note:"Goldman 추정 ~250t/yr, 공식 보고 대비 10배",confidence:"high",basis:"15개월 연속, 탈달러 구조적" },
      { id:"poland",flag:"🇵🇱",name:"폴란드 (NBP)",reported:50,estimated:50,note:"700t 목표 공식화, 150t 잔여. 연 30~50t 페이스",confidence:"high",basis:"목표 명시적, 의회 승인" },
      { id:"kazakhstan",flag:"🇰🇿",name:"카자흐스탄",reported:50,estimated:50,note:"2025 역대 최대 57t, 국내 생산 매입 지속",confidence:"mid",basis:"순매입국 유지 선언" },
      { id:"uzbekistan",flag:"🇺🇿",name:"우즈베키스탄",reported:60,estimated:60,note:"1월 9t, Oct부터 연속. 보유 비중 86%",confidence:"mid",basis:"원자재국 금 비축" },
      { id:"brazil",flag:"🇧🇷",name:"브라질 (BCB)",reported:30,estimated:30,note:"3개월 43t 매입 후 페이스 둔화 가능",confidence:"mid",basis:"BRICS 비축, 4년만 재진입" },
      { id:"turkey",flag:"🇹🇷",name:"튀르키예 (CBRT)",reported:25,estimated:25,note:"23개월+ 연속, 월 ~2t",confidence:"high",basis:"리라화 헤지 구조적" },
      { id:"czech",flag:"🇨🇿",name:"체코 (CNB)",reported:24,estimated:24,note:"34개월+ 연속, 100t 목표까지 28t 잔여",confidence:"high",basis:"목표 명시적 (2028)" },
      { id:"india",flag:"🇮🇳",name:"인도 (RBI)",reported:15,estimated:40,note:"2024 대규모 매입 후 간헐적, 다변화 지속",confidence:"low",basis:"간헐적, 예측 어려움" },
      { id:"serbia",flag:"🇷🇸",name:"세르비아 (NBS)",reported:10,estimated:10,note:"2030 100t 목표, 연 ~13t 필요",confidence:"low",basis:"목표 선언, 실적 미미" },
      { id:"malaysia",flag:"🇲🇾",name:"말레이시아 ★NEW",reported:10,estimated:10,note:"2018년 이후 최초 복귀, 수요 기반 확대 시그널",confidence:"low",basis:"신규 진입, 지속성 미지수" },
      { id:"korea",flag:"🇰🇷",name:"한국 (BOK) ★NEW",reported:5,estimated:5,note:"ETF 방식 편입, 2013년 이후 최초",confidence:"low",basis:"ETF 편입 예정, 규모 미정" },
      { id:"others",flag:"🌍",name:"기타 + 비보고",reported:50,estimated:350,note:"WGC: 2025 전체의 57%가 비보고 매입",confidence:"mid",basis:"비보고 비중 구조적" },
    ],
    scenarios: [
      { name:"Bear",total:750,prob:20,color:RED,desc:"고금가에 가격 민감도 상승, PBOC 둔화, 신규 진입국 지속성 약화",key:"$5,000+ 금가에 일부 CB 매입 보류, 중국 보고 감소" },
      { name:"Base",total:870,prob:50,color:GOLD,desc:"2025년과 유사한 페이스, 신규 진입국이 가격 민감도를 상쇄",key:"폴란드·체코 구조적 매입 + 말레이시아·한국 소규모 추가" },
      { name:"Bull",total:1050,prob:30,color:GRN,desc:"지정학 악화로 CB 매입 가속, PBOC 실질 매입 확대, 수요 기반 급확대",key:"이란 사태 에스컬레이션 + 비보고 매입 급증 + 신규 EM CB 진입" },
    ],
    watchSignals: [
      { signal:"PBOC 실질 매입 페이스",direction:"↑",status:"monitoring",note:"Goldman 추정 ~250t/yr, 공식 보고의 10배. 이 수치가 핵심 변수",impact:"극대",color:RED },
      { signal:"수요 기반 확대 (Broadening)",direction:"↑",status:"positive",note:"말레이시아·한국 복귀 = 2026 핵심 테마. 추가 EM CB 진입 여부",impact:"대",color:GRN },
      { signal:"금가격 민감도",direction:"↓",status:"risk",note:"$5,000+ 고가에서 일부 CB 매입 보류 가능성 (1월 5t의 원인)",impact:"대",color:ORG },
      { signal:"지정학 리스크",direction:"↑",status:"elevated",note:"미-이란, 미중 관세 → CB 안전자산 수요 유지·확대",impact:"중",color:RED },
      { signal:"비보고 매입 비중",direction:"?",status:"structural",note:"2025: 전체의 57% 비보고. 실제 매입 >> 보고 매입",impact:"극대",color:PUR },
      { signal:"BOK ETF 편입 규모",direction:"↑",status:"pending",note:"Q1 2026 시작, 104t 보유 대비 증분 규모가 관건",impact:"중",color:BLU },
    ],
  },
  goldPriceHistory: [
    { period:"24Q1",price:2150 },{ period:"24Q2",price:2350 },{ period:"24Q3",price:2550 },
    { period:"24Q4",price:2700 },{ period:"25Q1",price:3100 },{ period:"25Q2",price:3500 },
    { period:"25Q3",price:3800 },{ period:"25Q4",price:4341 },{ period:"현재",price:5278 },
    { period:"26E",price:5400 },
  ],
  ibForecasts: [
    { bank:"JPMorgan",target2026:"$6,300",cbForecast:"755t/yr",stance:"Very Bullish",color:ORG },
    { bank:"Goldman Sachs",target2026:"$5,400",cbForecast:"60t/월 (720t/yr)",stance:"Bullish",color:"#FFD700" },
    { bank:"UBS",target2026:"$6,200",cbForecast:"구조적 매입 지속",stance:"Very Bullish",color:RED },
    { bank:"Deutsche Bank",target2026:"$6,000",cbForecast:"EM CB 매입 가속",stance:"Very Bullish",color:BLU },
    { bank:"Bank of America",target2026:"$5,000",cbForecast:"CB 매입 견조",stance:"Bullish",color:GRN },
    { bank:"Morgan Stanley",target2026:"$4,800",cbForecast:"구조적 상승 지속",stance:"Bullish",color:PUR },
    { bank:"Std Chartered",target2026:"$4,800",cbForecast:"EM 다변화 수요",stance:"Bullish",color:CYA },
    { bank:"SSGA",target2026:"773~1,117t",cbForecast:"2026 CB 매입 전망",stance:"Bullish",color:"#E67E22" },
    { bank:"Jefferies",target2026:"$6,600",cbForecast:"최대 강세",stance:"Very Bullish",color:"#FF1493" },
  ],
  newsItems: [
    { date:"2026.03.04",title:"WGC: 1월 CB 순매입 5t, 12개월 평균 27t 대비 급감. 수요 기반 확대 주목",tag:"데이터",impact:"→",color:T2 },
    { date:"2026.03.04",title:"한국은행(BOK), Q1 2026 해외상장 실물금 ETF 외환보유고 편입 (2013년 이후 최초)",tag:"중앙은행",impact:"↑",color:GRN },
    { date:"2026.03.04",title:"말레이시아 BNM, 2018년 이후 최초 금 3t 매입. 우즈베키스탄 9t 매입",tag:"중앙은행",impact:"↑",color:GRN },
    { date:"2026.02.28",title:"미-이스라엘 이란 공습에 금 $5,300 돌파",tag:"지정학",impact:"↑",color:RED },
    { date:"2026.02.25",title:"JPMorgan, 2026 금가격 목표 $6,300으로 상향",tag:"전망",impact:"↑",color:BLU },
    { date:"2026.02.25",title:"Goldman Sachs, 2026 YE 금가격 $5,400 유지",tag:"전망",impact:"→",color:GOLD },
    { date:"2026.02.19",title:"중동 긴장에 금 $5,000 회복, 안전자산 수요 급증",tag:"지정학",impact:"↑",color:RED },
    { date:"2026.01.29",title:"금, 사상 최고 $5,595 기록 후 $4,410까지 급락",tag:"시장",impact:"↓",color:ORG },
    { date:"2026.01.20",title:"폴란드 NBP, 700t 목표 공식화",tag:"중앙은행",impact:"↑",color:GRN },
    { date:"2026.01.xx",title:"중국 PBOC, 15개월 연속 금 매입 (2,308t)",tag:"중앙은행",impact:"↑",color:GRN },
  ],
  events: [
    { date:"3/2",event:"ISM 제조업 PMI (2월)",note:"금 변동성 확대 가능" },
    { date:"3/5",event:"Fed Beige Book",note:"경기 둔화 신호 → 금 강세" },
    { date:"3/17-18",event:"FOMC 회의",note:"동결 예상(98%)" },
    { date:"미정",event:"WGC FY2025 최종 리포트",note:"CB 데이터 확정" },
    { date:"미정",event:"미-이란 긴장 전개",note:"에스컬레이션 시 $5,500+" },
  ],
  countries: [
    { id:"poland",flag:"🇵🇱",name:"폴란드",nameEn:"NBP",current:550,target:700,targetDate:"미정",annualPlan:30,share:"28%",targetShare:"30%+",rationale:"안보, 지정학 대비",note:"700t 목표 공식화, 150t 추가 승인",color:RED,m2025:{Jan:3,Feb:29,Mar:14,Apr:1,May:0,Jun:0,Jul:0,Aug:0,Sep:0,Oct:16,Nov:12,Dec:35},m2026:{Jan:null,Feb:null},streak:"Oct~Dec 재매입" },
    { id:"china",flag:"🇨🇳",name:"중국",nameEn:"PBOC",current:2308,target:null,targetDate:"상시",annualPlan:null,share:"9.6%",targetShare:"탈달러",rationale:"탈달러, 위안화 신뢰도",note:"15개월 연속, Goldman 추정 ~250t/yr",color:RED,m2025:{Jan:5,Feb:5,Mar:2,Apr:2,May:2,Jun:2,Jul:2,Aug:2,Sep:1.2,Oct:1,Nov:1,Dec:1},m2026:{Jan:1.2,Feb:null},streak:"15개월 연속" },
    { id:"czech",flag:"🇨🇿",name:"체코",nameEn:"CNB",current:72,target:100,targetDate:"2028",annualPlan:9.3,share:"3%",targetShare:"~4%",rationale:"수익률, 변동성 감소",note:"34개월 연속, 월 ~2t",color:BLU,m2025:{Jan:2,Feb:2,Mar:2,Apr:2,May:2,Jun:2,Jul:2,Aug:2,Sep:2,Oct:2,Nov:2,Dec:2},m2026:{Jan:2,Feb:null},streak:"34개월+ 연속" },
    { id:"serbia",flag:"🇷🇸",name:"세르비아",nameEn:"NBS",current:52,target:100,targetDate:"2030",annualPlan:12.8,share:"-",targetShare:"-",rationale:"경제 안정성",note:"Vučić 대통령 2030년 100t 목표",color:PUR,m2025:{Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0,Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0},m2026:{Jan:null,Feb:null},streak:"목표 선언" },
    { id:"india",flag:"🇮🇳",name:"인도",nameEn:"RBI",current:880,target:null,targetDate:"상시",annualPlan:50,share:"11%",targetShare:"다변화",rationale:"다변화, 경상수지 방어",note:"2024 대규모 매입 후 둔화",color:ORG,m2025:{Jan:3,Feb:0,Mar:3,Apr:3,May:3,Jun:0,Jul:0,Aug:0,Sep:3,Oct:0,Nov:0,Dec:0},m2026:{Jan:null,Feb:null},streak:"간헐적" },
    { id:"kazakhstan",flag:"🇰🇿",name:"카자흐스탄",nameEn:"NBK",current:340,target:null,targetDate:"상시",annualPlan:null,share:"54%",targetShare:"지정학 대비",rationale:"원자재국 다변화",note:"2025 역대 최대 57t",color:GRN,m2025:{Jan:4,Feb:0,Mar:4,Apr:4,May:4,Jun:4,Jul:4,Aug:4,Sep:4,Oct:1,Nov:8,Dec:17},m2026:{Jan:null,Feb:null},streak:"국내 금 생산 매입" },
    { id:"turkey",flag:"🇹🇷",name:"튀르키예",nameEn:"CBRT",current:644,target:null,targetDate:"상시",annualPlan:null,share:"38%",targetShare:"탈달러",rationale:"리라화 헤지",note:"23개월 연속",color:CYA,m2025:{Jan:2,Feb:3,Mar:3,Apr:2,May:2,Jun:2,Jul:2,Aug:2,Sep:2,Oct:3,Nov:null,Dec:null},m2026:{Jan:null,Feb:null},streak:"23개월+ 연속" },
    { id:"brazil",flag:"🇧🇷",name:"브라질",nameEn:"BCB",current:172,target:null,targetDate:"상시",annualPlan:null,share:"7%",targetShare:"다변화",rationale:"BRICS 비축",note:"4년만에 재진입, 3개월 43t",color:"#FFD700",m2025:{Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0,Jul:0,Aug:0,Sep:15,Oct:16,Nov:11,Dec:null},m2026:{Jan:null,Feb:null},streak:"2025.09 재진입" },
    { id:"uzbekistan",flag:"🇺🇿",name:"우즈베키스탄",nameEn:"CBU",current:399,target:null,targetDate:"상시",annualPlan:null,share:"86%",targetShare:"금 비중 확대",rationale:"원자재국 금 비축",note:"2026.01 9t 매입, Oct부터 연속 매입. 외환보유 대비 86%",color:"#1E90FF",m2025:{Jan:null,Feb:null,Mar:null,Apr:null,May:null,Jun:null,Jul:null,Aug:null,Sep:null,Oct:null,Nov:null,Dec:null},m2026:{Jan:9,Feb:null},streak:"Oct~ 연속 매입" },
    { id:"malaysia",flag:"🇲🇾",name:"말레이시아",nameEn:"BNM",current:42,target:null,targetDate:"상시",annualPlan:null,share:"5%",targetShare:"다변화",rationale:"외환보유 다변화",note:"2018년 이후 최초 금 매입 (2026.01 +3t). 수요 기반 확대 신호",color:"#FF4500",m2025:{Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0,Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0},m2026:{Jan:3,Feb:null},streak:"2026.01 재진입" },
    { id:"korea",flag:"🇰🇷",name:"한국",nameEn:"BOK",current:104,target:null,targetDate:"상시",annualPlan:null,share:"4%",targetShare:"ETF 편입",rationale:"유동성·거래편의성",note:"Q1 2026부터 해외상장 실물금 ETF 외환보유고 편입. 2013년 이후 최초 금 관련 투자",color:"#0047AB",m2025:{Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0,Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0},m2026:{Jan:null,Feb:null},streak:"ETF 편입 예정" },
  ],
};

const ALL_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ═══ COMPONENTS ═══
function ProgressBar({ current, target, color }) {
  if (!target) return null;
  const pct = Math.min((current / target) * 100, 100);
  return (
    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
      <div style={{ flex:1,height:7,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden" }}>
        <div style={{ width:`${pct}%`,height:"100%",borderRadius:4,background:`linear-gradient(90deg,${color},${color}88)` }} />
      </div>
      <span style={{ fontSize:10,fontWeight:700,color,minWidth:34,textAlign:"right" }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

function CountryCard({ c, expanded, onToggle }) {
  const t2025 = Object.values(c.m2025).reduce((s,v)=>s+(v||0),0);
  const chartData = ALL_MONTHS.map(m=>({m,t:c.m2025[m]??0}));
  return (
    <div style={{ background:BGC,borderRadius:10,border:`1px solid ${BD}`,overflow:"hidden" }}>
      <div onClick={onToggle} style={{ padding:"12px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,borderBottom:expanded?`1px solid ${BD}`:"none" }}>
        <span style={{ fontSize:24 }}>{c.flag}</span>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <span style={{ fontSize:14,fontWeight:800 }}>{c.name}</span>
            <span style={{ fontSize:10,color:T2 }}>{c.nameEn}</span>
          </div>
          <div style={{ display:"flex",gap:10,marginTop:3,flexWrap:"wrap",fontSize:10,color:T2 }}>
            <span>보유 <strong style={{ color:GOLD }}>{c.current.toLocaleString()}t</strong></span>
            {c.target && <span>목표 <strong style={{ color:c.color }}>{c.target}t</strong></span>}
            <span>비중 <strong style={{ color:T1 }}>{c.share}</strong></span>
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:16,fontWeight:800,color:GOLD }}>{t2025}t</div>
          <div style={{ fontSize:8,color:T3 }}>2025</div>
        </div>
        <span style={{ fontSize:14,color:T3,transform:expanded?"rotate(180deg)":"none",transition:"transform 0.2s" }}>▼</span>
      </div>
      {expanded && (
        <div style={{ padding:"12px 14px" }}>
          {c.target && <div style={{ marginBottom:12 }}>
            <div style={{ display:"flex",justifyContent:"space-between",fontSize:10,color:T2,marginBottom:3 }}><span>목표 달성도</span><span>{c.current}t / {c.target}t</span></div>
            <ProgressBar current={c.current} target={c.target} color={c.color} />
          </div>}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12 }}>
            {[{l:"매입 근거",v:c.rationale},{l:"패턴",v:c.streak},{l:"비중/목표",v:`${c.share} → ${c.targetShare}`},{l:"연간 계획",v:c.annualPlan?`~${c.annualPlan}t/yr`:"비공개"}].map((x,i)=>(
              <div key={i} style={{ background:BGC2,borderRadius:6,padding:"6px 8px" }}>
                <div style={{ fontSize:8,color:T3 }}>{x.l}</div>
                <div style={{ fontSize:10,fontWeight:600,marginTop:1 }}>{x.v}</div>
              </div>
            ))}
          </div>
          <div style={{ padding:"8px 10px",background:`${c.color}10`,borderLeft:`3px solid ${c.color}`,borderRadius:"0 6px 6px 0",marginBottom:12,fontSize:10,color:T2,lineHeight:1.5 }}>💡 {c.note}</div>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11,fontWeight:700,color:GOLD,marginBottom:6 }}>2025 월간 매입 (톤)</div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={chartData} margin={{top:2,right:2,left:-22,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="m" tick={{fill:T3,fontSize:8}} /><YAxis tick={{fill:T3,fontSize:8}} />
                <Tooltip content={({active,payload,label})=>active&&payload?.length?<div style={{background:BGC,border:`1px solid ${BD}`,borderRadius:6,padding:"4px 8px",fontSize:10}}>{label}: <strong style={{color:c.color}}>{payload[0].value}t</strong></div>:null} />
                <Bar dataKey="t" radius={[2,2,0,0]}>{chartData.map((e,i)=><Cell key={i} fill={e.t>0?c.color:"rgba(255,255,255,0.04)"} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div style={{ fontSize:11,fontWeight:700,color:BLU,marginBottom:6 }}>📡 2026 월간 추적</div>
            <div style={{ display:"flex",gap:3,flexWrap:"wrap" }}>
              {ALL_MONTHS.map((m,i)=>{const v=c.m2026?.[m];const future=i>=new Date().getMonth();const has=v!=null;
                return <div key={m} style={{ flex:"1 0 36px",minWidth:36,background:future?"rgba(255,255,255,0.02)":has?`${c.color}12`:"rgba(255,255,255,0.04)",border:`1px solid ${has?c.color+"40":"rgba(255,255,255,0.06)"}`,borderRadius:5,padding:"5px 2px",textAlign:"center" }}>
                  <div style={{fontSize:8,color:T3}}>{m}</div>
                  <div style={{fontSize:12,fontWeight:700,color:future?T3:has?c.color:T2}}>{future?"—":has?`${v}t`:"⏳"}</div>
                </div>;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ MAIN PAGE ═══
export default function GoldMonitorPage() {
  const [tab, setTab] = useState("overview");
  const [time, setTime] = useState(new Date());
  const [expandedCountry, setExpandedCountry] = useState("poland");
  const [sortBy, setSortBy] = useState("y2025");
  const [updating, setUpdating] = useState(false);
  const [updateLog, setUpdateLog] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [livePrice, setLivePrice] = useState(BASE.price);
  const [liveNews, setLiveNews] = useState(BASE.newsItems);
  const [liveEvents, setLiveEvents] = useState(BASE.events);
  const [liveIB, setLiveIB] = useState(BASE.ibForecasts);
  const [liveCountries, setLiveCountries] = useState(BASE.countries);
  const [showPriceEdit, setShowPriceEdit] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [changePctInput, setChangePctInput] = useState("");
  const [priceSaving, setPriceSaving] = useState(false);

  // 🔒 Admin PIN
  const admin = useAdminPin('gold-monitor');

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 60000); return () => clearInterval(t); }, []);

  useEffect(() => {
    async function loadSaved() {
      try {
        const { data, error } = await supabase.from("gold_monitor_data").select("data, updated_at").eq("id", "latest").single();
        if (!error && data?.data) { applyUpdate(data.data); setLastUpdate(data.updated_at); }
      } catch (e) { console.log("No saved gold data yet"); }
    }
    loadSaved();
  }, []);

  // ── 금가격 수동 입력 ──
  const saveManualPrice = useCallback(async () => {
    const price = parseFloat(priceInput);
    const pct = parseFloat(changePctInput);
    if (isNaN(price) || price <= 0) return;
    setPriceSaving(true);
    const newPrice = { price, change_pct: isNaN(pct) ? 0 : pct, updated: new Date().toISOString().slice(0, 10) };
    setLivePrice(newPrice);
    setShowPriceEdit(false);
    try {
      const { data: existing } = await supabase.from("gold_monitor_data").select("data").eq("id", "latest").single();
      const currentData = existing?.data || {};
      currentData.price = newPrice;
      await supabase.from("gold_monitor_data").upsert({ id: "latest", data: currentData, updated_at: new Date().toISOString() });
    } catch (e) { console.error("Price save error:", e); }
    setPriceSaving(false);
  }, [priceInput, changePctInput]);

  function applyUpdate(result) {
    // 금가격은 수동 입력 — AI 업데이트에서 덮어쓰지 않음
    if (result.price?.price && !result._skipPrice) setLivePrice(result.price);
    if (result.news?.length > 0) {
      const tagColors = { "지정학":RED, "전망":BLU, "중앙은행":GRN, "시장":ORG, "데이터":T2, "정책":PUR };
      setLiveNews(result.news.map(n => ({ ...n, color: tagColors[n.tag] || T2 })));
    }
    if (result.events?.length > 0) setLiveEvents(result.events);
    if (result.ib?.forecasts?.length > 0) {
      const colors = [ORG,"#FFD700",RED,BLU,GRN,PUR,CYA,"#E67E22","#FF1493"];
      setLiveIB(result.ib.forecasts.map((f,i) => ({ bank:f.bank, target2026:f.target_2026, cbForecast:f.cb_forecast, stance:f.stance, color:colors[i%colors.length] })));
    }
    if (result.cb?.countries) {
      setLiveCountries(prev => prev.map(c => {
        const upd = result.cb.countries[c.id]; if (!upd) return c;
        const updated = { ...c, current: upd.current_reserves || c.current };
        if (upd.latest_month && upd.latest_month_tonnes != null) {
          const monthMap = {"jan":"Jan","feb":"Feb","mar":"Mar","apr":"Apr","may":"May","jun":"Jun","jul":"Jul","aug":"Aug","sep":"Sep","oct":"Oct","nov":"Nov","dec":"Dec"};
          const monthKey = monthMap[upd.latest_month.toLowerCase().slice(0,3)];
          if (monthKey && updated.m2026) updated.m2026 = { ...updated.m2026, [monthKey]: upd.latest_month_tonnes };
        }
        if (upd.note) updated.note = upd.note;
        return updated;
      }));
    }
  }

  // 🔒 AI UPDATE with PIN
  const handleAIUpdate = useCallback(async () => {
    if (!admin.isAdmin) { admin.openModal(); return; }
    setUpdating(true);
    setUpdateLog(["🔍 웹 검색 중... CB 매입, IB 전망, 뉴스"]);
    try {
      const res = await fetch("/api/gold-update", { method: "POST", headers: { "x-admin-pin": admin.pin } });
      if (res.status === 401) { setUpdateLog(prev => [...prev, "⚠️ 인증 만료"]); admin.logout(); admin.openModal(); setUpdating(false); return; }
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setUpdateLog(prev => [...prev, "✅ 데이터 수신 완료"]);
      applyUpdate(result);
      setLastUpdate(result.updated_at);

      const logItems = [
        result.cb?.countries ? `🏦 CB 데이터 ${Object.keys(result.cb.countries).length}개국 업데이트` : "⚠️ CB 데이터 업데이트 실패",
        result.ib?.forecasts?.length ? `🔮 IB 전망 ${result.ib.forecasts.length}개 업데이트` : "⚠️ IB 전망 업데이트 실패",
        result.news?.length ? `📰 뉴스 ${result.news.length}건 업데이트` : "⚠️ 뉴스 업데이트 실패",
      ];
      const failCount = logItems.filter(l => l.startsWith("⚠️")).length;
      const successCount = logItems.length - failCount;
      const finalMsg = failCount === 0
        ? "🎉 업데이트 완료!"
        : successCount === 0
          ? "❌ 전체 업데이트 실패 — 잠시 후 다시 시도해주세요"
          : `⚠️ 부분 완료 (${successCount}/${logItems.length} 성공, ${failCount}건 실패)`;

      setUpdateLog(prev => [...prev, ...logItems, "───────────────────", finalMsg]);
    } catch (err) { setUpdateLog(prev => [...prev, `❌ 오류: ${err.message}`]); } finally { setUpdating(false); }
  }, [admin]);

  const sorted = [...liveCountries].sort((a,b) => {
    if (sortBy==="target") { if(!a.target&&!b.target)return 0;if(!a.target)return 1;if(!b.target)return -1;return(b.current/b.target)-(a.current/a.target); }
    if (sortBy==="y2025") return Object.values(b.m2025).reduce((s,v)=>s+(v||0),0)-Object.values(a.m2025).reduce((s,v)=>s+(v||0),0);
    return b.current-a.current;
  });

  const tabs = [
    { id:"overview",label:"🎯 900t Thesis" },{ id:"purchases",label:"🏦 CB 매입" },
    { id:"countries",label:"🌍 국가별" },{ id:"forecasts",label:"🔮 IB 전망" },{ id:"news",label:"📰 뉴스" },
  ];

  const currentPrice = livePrice?.price || BASE.price.price;
  const changePct = livePrice?.change_pct || BASE.price.change_pct;

  return (
    <div style={{ fontFamily:"'DM Sans','Pretendard',-apple-system,sans-serif",background:BG,color:T1,minHeight:"100vh" }}>
      {/* 🔒 PIN Modal */}
      <PinModal admin={admin} />

      {/* ─── HEADER ─── */}
      <div style={{ background:`linear-gradient(135deg,${BG} 0%,#1A1510 50%,${BG} 100%)`,borderBottom:`1px solid ${BD}`,padding:"18px 20px 14px" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10 }}>
          <div>
            <div style={{ marginBottom:4 }}><a href="/" style={{ fontSize:10,color:T3,textDecoration:"none" }}>← Control Tower</a></div>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4 }}>
              <span style={{ fontSize:26 }}>🐺</span>
              <h1 style={{ fontSize:18,fontWeight:800,margin:0,background:`linear-gradient(90deg,${GOLD},${GOLD_L})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>Gold Central Bank Monitor</h1>
            </div>
            <p style={{ color:T2,fontSize:11,margin:0 }}>2026 중앙은행 금 매입 900t 돌파 가능성 추적</p>
          </div>
          <div style={{ textAlign:"right" }}>
            {showPriceEdit && admin.isAdmin ? (
              <div style={{ display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end" }}>
                <div style={{ display:"flex",gap:4,alignItems:"center" }}>
                  <span style={{ fontSize:10,color:T2 }}>$/oz</span>
                  <input value={priceInput} onChange={e=>setPriceInput(e.target.value)} placeholder="5278" type="number"
                    style={{ width:90,padding:"4px 8px",background:"rgba(0,0,0,0.4)",border:`1px solid ${GOLD}40`,borderRadius:5,fontSize:14,fontWeight:800,color:GOLD,outline:"none",textAlign:"right",fontFamily:"monospace" }} autoFocus />
                  <input value={changePctInput} onChange={e=>setChangePctInput(e.target.value)} placeholder="±%" type="number" step="0.01"
                    style={{ width:60,padding:"4px 8px",background:"rgba(0,0,0,0.4)",border:`1px solid ${BD}`,borderRadius:5,fontSize:12,color:T1,outline:"none",textAlign:"right",fontFamily:"monospace" }} />
                  <span style={{ fontSize:9,color:T3 }}>%</span>
                </div>
                <div style={{ display:"flex",gap:4 }}>
                  <button onClick={()=>setShowPriceEdit(false)} style={{ padding:"3px 10px",fontSize:10,border:`1px solid ${BD}`,borderRadius:4,background:"transparent",color:T3,cursor:"pointer" }}>취소</button>
                  <button onClick={saveManualPrice} disabled={priceSaving} style={{ padding:"3px 10px",fontSize:10,border:"none",borderRadius:4,background:GOLD,color:BG,fontWeight:700,cursor:"pointer" }}>{priceSaving?"저장중...":"저장"}</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                  <span style={{ fontSize:10,color:T2 }}>XAU/USD</span>
                  <span style={{ fontSize:22,fontWeight:800,color:GOLD }}>${currentPrice.toLocaleString()}</span>
                  <span style={{ fontSize:10,fontWeight:600,color:changePct>=0?GRN:RED,background:changePct>=0?"rgba(62,207,142,0.12)":"rgba(232,72,85,0.12)",padding:"2px 6px",borderRadius:4 }}>{changePct>0?"+":""}{changePct}%</span>
                  {admin.isAdmin && <button onClick={()=>{setPriceInput(String(currentPrice));setChangePctInput(String(changePct));setShowPriceEdit(true);}}
                    style={{ padding:"2px 6px",fontSize:10,border:`1px solid ${BD}`,borderRadius:4,background:"rgba(255,255,255,0.04)",color:T3,cursor:"pointer" }}>✏️</button>}
                </div>
                <p style={{ fontSize:9,color:T3,margin:"2px 0 0" }}>{livePrice?.updated || time.toLocaleDateString("ko-KR")} 기준</p>
              </>
            )}
          </div>
        </div>

        {/* Tabs + Lock + Update Button */}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,flexWrap:"wrap",gap:8 }}>
          <div style={{ display:"flex",gap:3,flexWrap:"wrap" }}>
            {tabs.map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                padding:"6px 12px",fontSize:11,fontWeight:600,border:"none",borderRadius:6,cursor:"pointer",
                background:tab===t.id?GOLD:"rgba(255,255,255,0.05)",color:tab===t.id?BG:T2,transition:"all 0.15s"
              }}>{t.label}</button>
            ))}
          </div>
          <div style={{ display:"flex",gap:6,alignItems:"center" }}>
            {/* 🔒 Admin Lock Button */}
            {admin.isAdmin ? (
              <button onClick={admin.logout} style={{padding:"6px 10px",fontSize:12,border:`1px solid ${GRN}30`,borderRadius:6,background:`${GRN}08`,color:GRN,cursor:"pointer"}}>🔓</button>
            ) : (
              <button onClick={admin.openModal} style={{padding:"6px 10px",fontSize:12,border:`1px solid ${BD}`,borderRadius:6,background:"rgba(255,255,255,0.04)",color:T3,cursor:"pointer"}}>🔒</button>
            )}
            <button onClick={handleAIUpdate} disabled={updating||!admin.isAdmin} style={{
              padding:"6px 14px",fontSize:11,fontWeight:700,border:"none",borderRadius:6,
              cursor:updating||!admin.isAdmin?"not-allowed":"pointer",
              background:updating?"rgba(255,255,255,0.05)":admin.isAdmin?`linear-gradient(135deg,${GOLD},#B8860B)`:"rgba(255,255,255,0.05)",
              color:updating||!admin.isAdmin?T2:"#000",transition:"all 0.2s",
              opacity:updating?0.7:admin.isAdmin?1:0.4,
              display:"flex",alignItems:"center",gap:6,
            }}>
              {updating ? (<><span style={{ display:"inline-block",width:12,height:12,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:GOLD,borderRadius:"50%",animation:"spin 0.8s linear infinite" }} /> 업데이트 중...</>) : (<>🤖 AI 업데이트</>)}
            </button>
          </div>
        </div>

        {/* Update Log */}
        {updateLog.length > 0 && (
          <div style={{ marginTop:10,background:"rgba(0,0,0,0.4)",borderRadius:8,padding:"10px 12px",border:`1px solid ${BD}`,maxHeight:160,overflowY:"auto" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
              <span style={{ fontSize:10,fontWeight:700,color:GOLD }}>📡 업데이트 로그</span>
              {!updating && <button onClick={()=>setUpdateLog([])} style={{ fontSize:9,color:T3,background:"none",border:"none",cursor:"pointer" }}>닫기 ✕</button>}
            </div>
            {updateLog.map((log,i) => (<div key={i} style={{ fontSize:10,color:T2,lineHeight:1.6,fontFamily:"monospace" }}>{log}</div>))}
          </div>
        )}
        {lastUpdate && updateLog.length === 0 && (
          <div style={{ marginTop:6,fontSize:9,color:T3,textAlign:"right" }}>마지막 AI 업데이트: {new Date(lastUpdate).toLocaleString("ko-KR")}</div>
        )}
      </div>

      {/* ─── CONTENT ─── */}
      <div style={{ padding:"14px 18px",maxWidth:1100,margin:"0 auto" }}>

        {/* ══ OVERVIEW: 900t THESIS TRACKER ══ */}
        {tab === "overview" && (<div>
          {(() => {
            const T = BASE.thesis;
            const projTotal = T.projections.reduce((s,p) => s + p.estimated, 0);
            const pctOfTarget = Math.min((projTotal / T.target) * 100, 150);
            const requiredMonthlyPace = Math.round((T.target - T.ytdReported) / T.monthsRemaining);
            const avg2025Monthly = Math.round(863 / 12);

            return (<>
            <div style={{ background:`linear-gradient(135deg,${BGC} 0%,rgba(212,160,23,0.08) 100%)`,borderRadius:14,padding:"20px 18px",border:`1px solid ${GOLD}30`,marginBottom:14 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12 }}>
                <div>
                  <div style={{ fontSize:10,color:T2,marginBottom:4,letterSpacing:"1px",textTransform:"uppercase" }}>Core Thesis</div>
                  <h2 style={{ fontSize:20,fontWeight:800,margin:"0 0 6px",color:T1 }}>2026 CB 금 매입 <span style={{ color:GOLD }}>900t</span> 돌파 가능한가?</h2>
                  <p style={{ fontSize:11,color:T2,margin:0,lineHeight:1.5 }}>비탄력적 수요인 중앙은행 매입량이 금 가격의 구조적 하방을 결정</p>
                </div>
                <div style={{ textAlign:"center",minWidth:110 }}>
                  <div style={{ position:"relative",width:100,height:100,margin:"0 auto" }}>
                    <svg viewBox="0 0 100 100" style={{ transform:"rotate(-90deg)" }}>
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke={projTotal >= T.target ? GRN : GOLD} strokeWidth="8" strokeDasharray={`${Math.min(pctOfTarget, 100) * 2.64} 264`} strokeLinecap="round" />
                    </svg>
                    <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center" }}>
                      <div style={{ fontSize:22,fontWeight:900,color:projTotal >= T.target ? GRN : GOLD }}>{projTotal}</div>
                      <div style={{ fontSize:8,color:T3 }}>/ {T.target}t</div>
                    </div>
                  </div>
                  <div style={{ fontSize:9,fontWeight:700,color:projTotal >= T.target ? GRN : ORG,marginTop:4 }}>{projTotal >= T.target ? "✅ 돌파 가능" : `⚠️ ${T.target - projTotal}t 부족`}</div>
                </div>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginTop:16 }}>
                {[
                  { l:"YTD 보고 (1월)",v:`${T.ytdReported}t`,sub:`${T.monthsElapsed}개월`,c:T.ytdReported >= requiredMonthlyPace ? GRN : ORG },
                  { l:"900t 필요 페이스",v:`${requiredMonthlyPace}t/월`,sub:`잔여 ${T.monthsRemaining}개월`,c:BLU },
                  { l:"2025 월평균",v:`${avg2025Monthly}t/월`,sub:"보고 기준",c:GOLD },
                  { l:"보고 vs 실제",v:"×2.3",sub:"비보고 57% 감안",c:PUR },
                ].map((m,i) => (
                  <div key={i} style={{ background:"rgba(0,0,0,0.3)",borderRadius:8,padding:"10px 10px" }}>
                    <div style={{ fontSize:8,color:T3,marginBottom:3 }}>{m.l}</div>
                    <div style={{ fontSize:16,fontWeight:800,color:m.c }}>{m.v}</div>
                    <div style={{ fontSize:9,color:T2 }}>{m.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:12,padding:"8px 12px",background:"rgba(212,160,23,0.08)",borderRadius:8,borderLeft:`3px solid ${GOLD}` }}>
                <div style={{ fontSize:10,color:T2,lineHeight:1.6 }}>
                  <strong style={{ color:GOLD }}>Key Insight:</strong> 1월 보고 매입 5t은 휴일·고금가 영향으로 과소. 그러나 <strong style={{ color:GRN }}>비보고 매입(전체의 57%)</strong>을 감안하면 실제 페이스는 훨씬 높을 가능성. 말레이시아·한국 등 <strong style={{ color:ORG }}>수요 기반 확대</strong>가 2026 핵심 변수.
                </div>
              </div>
            </div>

            <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}`,marginBottom:12 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                <h3 style={{ fontSize:13,fontWeight:700,margin:0,color:GOLD }}>🏦 국가별 기여도 적산 → 900t</h3>
                <div style={{ fontSize:9,color:T3 }}>보고 + 비보고 추정 합산</div>
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
                {T.projections.map((p) => {
                  const maxBar = 260;
                  const confColor = p.confidence === "high" ? GRN : p.confidence === "mid" ? GOLD : T3;
                  return (
                    <div key={p.id} style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <div style={{ minWidth:130,fontSize:10,display:"flex",alignItems:"center",gap:4 }}><span>{p.flag}</span><span style={{ fontWeight:600,fontSize:10 }}>{p.name}</span></div>
                      <div style={{ flex:1,position:"relative" }}>
                        <div style={{ height:20,background:"rgba(255,255,255,0.04)",borderRadius:4,overflow:"hidden",position:"relative" }}>
                          <div style={{ position:"absolute",left:0,top:0,height:"100%",width:`${(p.reported/maxBar)*100}%`,background:GOLD,borderRadius:"4px 0 0 4px" }} />
                          {p.estimated > p.reported && <div style={{ position:"absolute",left:`${(p.reported/maxBar)*100}%`,top:0,height:"100%",width:`${((p.estimated-p.reported)/maxBar)*100}%`,background:`${GOLD}40`,borderRight:`1px dashed ${GOLD}` }} />}
                        </div>
                      </div>
                      <div style={{ minWidth:50,textAlign:"right" }}><span style={{ fontSize:13,fontWeight:800,color:GOLD }}>{p.estimated}t</span></div>
                      <div style={{ minWidth:14,textAlign:"center" }}><span style={{ fontSize:7,fontWeight:700,color:confColor }}>●</span></div>
                    </div>
                  );
                })}
                <div style={{ display:"flex",alignItems:"center",gap:8,borderTop:`2px solid ${BD}`,paddingTop:8,marginTop:4 }}>
                  <div style={{ minWidth:130,fontSize:11,fontWeight:800,color:T1 }}>합계</div>
                  <div style={{ flex:1 }}>
                    <div style={{ height:4,background:"rgba(255,255,255,0.04)",borderRadius:2,position:"relative" }}>
                      <div style={{ height:"100%",width:`${Math.min((projTotal/T.target)*100,100)}%`,background:projTotal>=T.target?GRN:ORG,borderRadius:2 }} />
                      <div style={{ position:"absolute",left:`${(T.target/Math.max(projTotal,T.target+50))*100}%`,top:-6,height:16,width:1,background:RED }} />
                    </div>
                  </div>
                  <div style={{ minWidth:50,textAlign:"right" }}><span style={{ fontSize:15,fontWeight:900,color:projTotal>=T.target?GRN:ORG }}>{projTotal}t</span></div>
                  <div style={{ minWidth:14 }} />
                </div>
                <div style={{ display:"flex",justifyContent:"flex-end",gap:12,marginTop:2 }}>
                  <span style={{ fontSize:8,color:T3 }}>● <span style={{ color:GOLD }}>■</span> 보고</span>
                  <span style={{ fontSize:8,color:T3 }}>● <span style={{ color:`${GOLD}50` }}>■</span> 비보고 추정</span>
                  <span style={{ fontSize:8,color:T3 }}>신뢰도: <span style={{color:GRN}}>●</span>높음 <span style={{color:GOLD}}>●</span>중 <span style={{color:T3}}>●</span>낮음</span>
                </div>
              </div>
            </div>

            <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}`,marginBottom:12 }}>
              <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 12px",color:GOLD }}>📊 시나리오 분석: 2026 CB 금 매입</h3>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
                {T.scenarios.map((s,i) => (
                  <div key={i} style={{ background:BGC2,borderRadius:10,padding:14,border:`1px solid ${s.color}30`,position:"relative",overflow:"hidden" }}>
                    <div style={{ position:"absolute",top:0,left:0,right:0,height:3,background:s.color }} />
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                      <span style={{ fontSize:12,fontWeight:800,color:s.color }}>{s.name}</span>
                      <span style={{ fontSize:9,fontWeight:700,color:BG,background:s.color,padding:"2px 6px",borderRadius:4 }}>{s.prob}%</span>
                    </div>
                    <div style={{ fontSize:28,fontWeight:900,color:s.color,marginBottom:6 }}>{s.total}t</div>
                    <div style={{ fontSize:9,color:T2,lineHeight:1.5,marginBottom:8 }}>{s.desc}</div>
                    <div style={{ fontSize:9,color:T1,background:"rgba(0,0,0,0.3)",padding:"6px 8px",borderRadius:6,lineHeight:1.4 }}><strong>핵심 조건:</strong> {s.key}</div>
                    {s.total >= T.target ? <div style={{ marginTop:8,fontSize:9,fontWeight:700,color:GRN,textAlign:"center" }}>✅ 900t 돌파</div> : <div style={{ marginTop:8,fontSize:9,fontWeight:700,color:RED,textAlign:"center" }}>❌ 900t 미달 ({T.target - s.total}t 부족)</div>}
                  </div>
                ))}
              </div>
              <div style={{ marginTop:10,padding:"8px 12px",background:"rgba(62,207,142,0.06)",borderRadius:8,borderLeft:`3px solid ${GRN}` }}>
                <div style={{ fontSize:10,color:T2,lineHeight:1.6 }}>
                  <strong style={{ color:GRN }}>확률 가중 기대치:</strong>{" "}
                  {(() => { const ev = T.scenarios.reduce((s,sc) => s + sc.total * sc.prob / 100, 0); return <><strong style={{ color:GOLD }}>{Math.round(ev)}t</strong> — 900t {ev >= 900 ? <span style={{color:GRN}}>돌파 가능성 우위</span> : <span style={{color:ORG}}>소폭 하회, Bull 시나리오 실현 여부가 관건</span>}</>; })()}
                </div>
              </div>
            </div>

            <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}`,marginBottom:12 }}>
              <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 12px",color:GOLD }}>🔭 900t 돌파를 좌우할 핵심 시그널</h3>
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {T.watchSignals.map((w,i) => {
                  const statusStyle = { positive:{bg:"rgba(62,207,142,0.08)",border:GRN,label:"긍정",labelColor:GRN}, risk:{bg:"rgba(255,107,53,0.08)",border:ORG,label:"리스크",labelColor:ORG}, monitoring:{bg:"rgba(74,158,255,0.08)",border:BLU,label:"모니터링",labelColor:BLU}, elevated:{bg:"rgba(232,72,85,0.08)",border:RED,label:"경계",labelColor:RED}, structural:{bg:"rgba(155,89,182,0.08)",border:PUR,label:"구조적",labelColor:PUR}, pending:{bg:"rgba(74,158,255,0.08)",border:BLU,label:"대기",labelColor:BLU} }[w.status] || {bg:"rgba(255,255,255,0.04)",border:T3,label:"—",labelColor:T3};
                  return (
                    <div key={i} style={{ display:"flex",gap:10,padding:"10px 12px",background:statusStyle.bg,borderRadius:8,borderLeft:`3px solid ${statusStyle.border}`,alignItems:"flex-start" }}>
                      <div style={{ minWidth:24,textAlign:"center" }}><span style={{ fontSize:16,fontWeight:800,color:w.color }}>{w.direction}</span></div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:3 }}>
                          <span style={{ fontSize:11,fontWeight:700,color:T1 }}>{w.signal}</span>
                          <span style={{ fontSize:8,fontWeight:700,color:statusStyle.labelColor,background:`${statusStyle.labelColor}18`,padding:"1px 5px",borderRadius:3 }}>{statusStyle.label}</span>
                          <span style={{ fontSize:8,fontWeight:700,color:w.impact==="극대"?RED:w.impact==="대"?ORG:BLU,background:"rgba(0,0,0,0.3)",padding:"1px 5px",borderRadius:3 }}>임팩트: {w.impact}</span>
                        </div>
                        <div style={{ fontSize:10,color:T2,lineHeight:1.5 }}>{w.note}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12 }}>
              <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}` }}>
                <h3 style={{ fontSize:12,fontWeight:700,margin:"0 0 10px",color:GOLD }}>연간 CB 매입 추이</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={BASE.annualData} margin={{top:5,right:8,left:-10,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="year" tick={{fill:T2,fontSize:8}} /><YAxis tick={{fill:T2,fontSize:8}} />
                    <Tooltip content={({active,payload,label})=>active&&payload?.length?<div style={{background:BGC,border:`1px solid ${BD}`,borderRadius:6,padding:"6px 10px",fontSize:10}}><div style={{fontWeight:600}}>{label}</div><div style={{color:GOLD}}>매입: {payload[0]?.value}t</div></div>:null} />
                    <Bar dataKey="total" radius={[3,3,0,0]}>{BASE.annualData.map((e,i)=><Cell key={i} fill={e.year==="2026E"?"rgba(212,160,23,0.35)":GOLD} stroke={e.year==="2026E"?GOLD:"none"} strokeDasharray={e.year==="2026E"?"4 2":"0"} />)}</Bar>
                    <ReferenceLine y={900} stroke={RED} strokeDasharray="4 4" label={{value:"900t",fill:RED,fontSize:9,fontWeight:700}} />
                    <ReferenceLine y={473} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" label={{value:"'10-21 avg",fill:T3,fontSize:7}} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}` }}>
                <h3 style={{ fontSize:12,fontWeight:700,margin:"0 0 10px",color:GOLD }}>📡 Latest</h3>
                {liveNews.slice(0,6).map((n,i) => (
                  <div key={i} style={{ display:"flex",alignItems:"flex-start",gap:6,padding:"5px 0",borderBottom:i<5?"1px solid rgba(255,255,255,0.04)":"none" }}>
                    <span style={{ fontSize:7,fontWeight:700,color:n.color||T2,background:`${n.color||T2}18`,padding:"1px 5px",borderRadius:3,whiteSpace:"nowrap" }}>{n.tag}</span>
                    <div style={{ flex:1,fontSize:10,lineHeight:1.4 }}>{n.title}<div style={{ fontSize:8,color:T3,marginTop:1 }}>{n.date}</div></div>
                    <span style={{ fontSize:11,color:n.impact==="↑"?GRN:n.impact==="↓"?RED:T2 }}>{n.impact}</span>
                  </div>
                ))}
              </div>
            </div>
            </>);
          })()}
        </div>)}

        {/* ══ PURCHASES ══ */}
        {tab === "purchases" && (<div>
          <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}`,marginBottom:12 }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 3px",color:GOLD }}>월간 글로벌 CB 금 순매입 비교 (톤)</h3>
            <p style={{ fontSize:10,color:T3,margin:"0 0 12px" }}>2024 vs 2025 vs 2026</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={BASE.monthlyData} margin={{top:5,right:8,left:-4,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{fill:T2,fontSize:9}} /><YAxis tick={{fill:T2,fontSize:9}} />
                <Tooltip content={({active,payload,label})=>active&&payload?.length?<div style={{background:BGC,border:`1px solid ${BD}`,borderRadius:6,padding:"6px 10px",fontSize:11}}><div style={{fontWeight:600}}>{label}</div>{payload.map((p,i)=><div key={i} style={{color:p.color}}>{p.name}: {p.value!=null?`${p.value}t`:"N/A"}</div>)}</div>:null} />
                <Legend wrapperStyle={{fontSize:10}} />
                <Bar dataKey="m2024" name="2024" fill={BLU} radius={[3,3,0,0]} barSize={12} />
                <Bar dataKey="m2025" name="2025" fill={GOLD} radius={[3,3,0,0]} barSize={12} />
                <Bar dataKey="m2026" name="2026" fill={GRN} radius={[3,3,0,0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}`,marginBottom:12 }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 4px",color:GRN }}>2026년 1월 주요국 매입 현황</h3>
            <p style={{ fontSize:10,color:T3,margin:"0 0 10px" }}>WGC Monthly CB Statistics (2026.03) | 순매입 5t — 12개월 평균 27t 대비 급감, 수요 기반 확대 주목</p>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                <thead><tr style={{ borderBottom:`2px solid ${BD}` }}>{["국가","매입(t)","보유(t)","비중","비고"].map(h=><th key={h} style={{ textAlign:"left",padding:"6px 8px",color:T3,fontSize:9 }}>{h}</th>)}</tr></thead>
                <tbody>{BASE.topBuyers2026.map((b,i)=><tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}><td style={{padding:8,fontWeight:600}}>{b.country}</td><td style={{padding:8,color:b.tonnes>=0?GOLD:RED,fontWeight:700}}>{b.tonnes>0?"+":""}{b.tonnes}t</td><td style={{padding:8}}>{b.reserves?`${b.reserves.toLocaleString()}t`:"-"}</td><td style={{padding:8}}>{b.share}</td><td style={{padding:8,fontSize:10,color:T2}}>{b.note}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
          <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}`,marginBottom:12 }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 12px",color:GOLD }}>2025 주요국 매입 현황</h3>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                <thead><tr style={{ borderBottom:`2px solid ${BD}` }}>{["국가","매입(t)","보유(t)","비중"].map(h=><th key={h} style={{ textAlign:"left",padding:"6px 8px",color:T3,fontSize:9 }}>{h}</th>)}</tr></thead>
                <tbody>{BASE.topBuyers.map((b,i)=><tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}><td style={{padding:8,fontWeight:600}}>{b.country}</td><td style={{padding:8,color:GOLD,fontWeight:700}}>{b.tonnes}t</td><td style={{padding:8}}>{b.reserves?`${b.reserves.toLocaleString()}t`:"-"}</td><td style={{padding:8}}>{b.share}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
          <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}` }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 12px",color:GOLD }}>연간 CB 순매입 & YoY</h3>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                <thead><tr style={{ borderBottom:`2px solid ${BD}` }}>{["연도","순매입(t)","YoY","Bar"].map(h=><th key={h} style={{ textAlign:"left",padding:"6px 8px",color:T3,fontSize:9 }}>{h}</th>)}</tr></thead>
                <tbody>{BASE.annualData.map((d,i)=><tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)",background:d.year==="2025"?"rgba(212,160,23,0.05)":"transparent" }}><td style={{padding:"7px 8px",fontWeight:d.year==="2025"||d.year==="2026E"?700:400}}>{d.year}</td><td style={{padding:"7px 8px",fontWeight:700,color:GOLD}}>{d.total}t</td><td style={{padding:"7px 8px",fontWeight:600,color:d.yoy==null?T3:d.yoy>=0?GRN:RED}}>{d.yoy==null?"-":`${d.yoy>0?"+":""}${d.yoy}%`}</td><td style={{padding:"7px 8px"}}><div style={{height:8,borderRadius:3,width:`${Math.min((d.total/1100)*100,100)}%`,background:GOLD,opacity:d.year==="2026E"?0.45:1}} /></td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </div>)}

        {/* ══ COUNTRIES ══ */}
        {tab === "countries" && (<div>
          <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}`,marginBottom:12,overflowX:"auto" }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 10px",color:GOLD }}>📋 주요국 중앙은행 금 매입 전략 요약</h3>
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:10,minWidth:600 }}>
              <thead><tr style={{ borderBottom:`2px solid ${BD}` }}>{["","보유량(t)","목표(t)","기한","계획(t/yr)","근거"].map((h,i)=><th key={i} style={{ textAlign:"left",padding:"7px 6px",color:T3,fontSize:8 }}>{h}</th>)}</tr></thead>
              <tbody>{liveCountries.map((c,i)=><tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}><td style={{padding:"7px 6px",fontWeight:700,whiteSpace:"nowrap",fontSize:11}}>{c.flag} {c.name}</td><td style={{padding:"7px 6px",fontWeight:700,color:GOLD}}>{c.current.toLocaleString()}</td><td style={{padding:"7px 6px",fontWeight:600,color:c.target?c.color:T3}}>{c.target||"—"}</td><td style={{padding:"7px 6px",color:T2}}>{c.targetDate}</td><td style={{padding:"7px 6px",fontWeight:600}}>{c.annualPlan||"—"}</td><td style={{padding:"7px 6px",color:T2}}>{c.rationale}</td></tr>)}</tbody>
            </table>
          </div>
          <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}`,marginBottom:12 }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 10px",color:GOLD }}>🎯 목표 달성 진척도</h3>
            {liveCountries.filter(c=>c.target).map((c,i)=>(<div key={i} style={{ marginBottom:10 }}><div style={{ display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2 }}><span style={{fontWeight:700}}>{c.flag} {c.name}</span><span style={{color:T2,fontSize:10}}>{c.current}t → {c.target}t (잔여 {c.target-c.current}t)</span></div><ProgressBar current={c.current} target={c.target} color={c.color} /></div>))}
          </div>
          <div style={{ display:"flex",gap:4,marginBottom:8,alignItems:"center" }}>
            <span style={{fontSize:10,color:T3}}>정렬:</span>
            {[{id:"y2025",l:"2025 매입순"},{id:"current",l:"보유량순"},{id:"target",l:"목표달성률"}].map(s=>(<button key={s.id} onClick={()=>setSortBy(s.id)} style={{padding:"3px 8px",fontSize:9,fontWeight:600,border:"none",borderRadius:4,cursor:"pointer",background:sortBy===s.id?GOLD:"rgba(255,255,255,0.06)",color:sortBy===s.id?BG:T3}}>{s.l}</button>))}
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:6,marginBottom:12 }}>
            {sorted.map(c=><CountryCard key={c.id} c={c} expanded={expandedCountry===c.id} onToggle={()=>setExpandedCountry(expandedCountry===c.id?null:c.id)} />)}
          </div>
          <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}` }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 10px",color:ORG }}>⚠️ 비보고 매입 추정</h3>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
              <div style={{ background:BGC2,borderRadius:8,padding:12 }}><div style={{fontSize:9,color:T3}}>WGC 비보고 비중</div><div style={{fontSize:20,fontWeight:800,color:ORG}}>57%</div><div style={{fontSize:9,color:T2}}>2025 총 매입의 57% 미보고</div></div>
              <div style={{ background:BGC2,borderRadius:8,padding:12 }}><div style={{fontSize:9,color:T3}}>Goldman 중국 실제 추정</div><div style={{fontSize:20,fontWeight:800,color:RED}}>~250t/yr</div><div style={{fontSize:9,color:T2}}>공식 27t의 약 10배</div></div>
            </div>
          </div>
        </div>)}

        {/* ══ FORECASTS ══ */}
        {tab === "forecasts" && (<div>
          <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}`,marginBottom:12,overflowX:"auto" }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 3px",color:GOLD }}>글로벌 IB 2026 금가격 전망</h3>
            <p style={{ fontSize:10,color:T3,margin:"0 0 12px" }}>현재가 ${currentPrice.toLocaleString()}</p>
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:500 }}>
              <thead><tr style={{ borderBottom:`2px solid ${BD}` }}>{["IB","2026 YE","CB 매입 전망","스탠스","Implied"].map(h=><th key={h} style={{ textAlign:"left",padding:"6px 8px",color:T3,fontSize:9 }}>{h}</th>)}</tr></thead>
              <tbody>{liveIB.map((f,i)=>{const tn=parseFloat((f.target2026||"").replace(/[$,]/g,""));const imp=tn?((tn-currentPrice)/currentPrice*100).toFixed(1):null;return <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}><td style={{padding:8,fontWeight:700}}><span style={{display:"inline-block",width:3,height:12,background:f.color,borderRadius:2,marginRight:6,verticalAlign:"middle"}} />{f.bank}</td><td style={{padding:8,fontWeight:800,color:f.color,fontSize:13}}>{f.target2026}</td><td style={{padding:8,fontSize:10,color:T2}}>{f.cbForecast}</td><td style={{padding:8}}><span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:3,background:f.stance?.includes("Very")?"rgba(232,72,85,0.12)":"rgba(62,207,142,0.12)",color:f.stance?.includes("Very")?RED:GRN}}>{f.stance}</span></td><td style={{padding:8,fontWeight:600,fontSize:11,color:imp&&parseFloat(imp)>=0?GRN:RED}}>{imp?`${parseFloat(imp)>0?"+":""}${imp}%`:"-"}</td></tr>;})}</tbody>
            </table>
          </div>
          <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}` }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 12px",color:GOLD }}>🔑 핵심 전망 근거</h3>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:8 }}>
              {[{i:"🏦",t:"CB 구조적 매입",d:"EM CB 달러 다변화. 폴란드·체코·세르비아 명시적 확대"},{i:"🌐",t:"수요 기반 확대",d:"말레이시아·한국 등 장기 공백 후 복귀. 2026 핵심 테마"},{i:"💵",t:"화폐가치 하락",d:"미 재정적자, 글로벌 부채 증가, 달러 신뢰 약화"},{i:"🌍",t:"지정학 리스크",d:"미-이란, 미중 관세, 러-우"},{i:"📉",t:"Fed 인하 사이클",d:"실질금리↓ → 금 보유 기회비용↓"}].map((d,i)=><div key={i} style={{background:BGC2,borderRadius:8,padding:12,border:`1px solid ${BD}`}}><div style={{fontSize:18,marginBottom:4}}>{d.i}</div><div style={{fontSize:11,fontWeight:700,color:GOLD,marginBottom:4}}>{d.t}</div><div style={{fontSize:10,color:T2,lineHeight:1.5}}>{d.d}</div></div>)}
            </div>
          </div>
        </div>)}

        {/* ══ NEWS ══ */}
        {tab === "news" && (<div>
          <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}`,marginBottom:12 }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 12px",color:GOLD }}>📰 Gold News Flow</h3>
            {liveNews.map((n,i) => (<div key={i} style={{ display:"flex",alignItems:"flex-start",gap:10,padding:"10px 0",borderBottom:i<liveNews.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}><span style={{ fontSize:9,fontWeight:700,color:n.color||T2,background:`${n.color||T2}18`,padding:"2px 7px",borderRadius:4,whiteSpace:"nowrap",minWidth:50,textAlign:"center" }}>{n.tag}</span><div style={{ flex:1 }}><div style={{fontSize:12,lineHeight:1.4,fontWeight:500}}>{n.title}</div><div style={{fontSize:9,color:T3,marginTop:2}}>{n.date}</div></div><span style={{ fontSize:16,fontWeight:800,color:n.impact==="↑"?GRN:n.impact==="↓"?RED:T2 }}>{n.impact}</span></div>))}
          </div>
          <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}`,marginBottom:12 }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 10px",color:GOLD }}>📅 주요 이벤트</h3>
            {liveEvents.map((e,i) => (<div key={i} style={{ display:"flex",gap:10,padding:"8px 0",borderBottom:i<liveEvents.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}><span style={{fontSize:10,fontWeight:700,color:BLU,minWidth:58}}>{e.date}</span><div style={{flex:1}}><div style={{fontSize:11,fontWeight:600}}>{e.event}</div><div style={{fontSize:9,color:T3}}>{e.note}</div></div></div>))}
          </div>
          <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}` }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 10px",color:GOLD }}>📊 센티먼트 (Kitco)</h3>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              {[{l:"Wall Street",u:67,n:22,d:11},{l:"개인 투자자",u:76,n:14,d:10}].map((s,i)=>(<div key={i}><div style={{fontSize:10,color:T2,marginBottom:4}}>{s.l}</div><div style={{display:"flex",gap:3}}><div style={{flex:s.u,height:22,background:GRN,borderRadius:"4px 0 0 4px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700}}>상승 {s.u}%</div><div style={{flex:s.n,height:22,background:T2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:BG}}>{s.n}%</div><div style={{flex:s.d,height:22,background:RED,borderRadius:"0 4px 4px 0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700}}>{s.d}%</div></div></div>))}
            </div>
          </div>
        </div>)}

        <div style={{ marginTop:18,padding:"10px 0",borderTop:`1px solid ${BD}`,textAlign:"center" }}>
          <p style={{ fontSize:8,color:"rgba(255,255,255,0.2)",margin:0,lineHeight:1.5 }}>
            🐺 늑대무리원정단 | Source: WGC, IMF, JPMorgan, Goldman Sachs, UBS, SSGA, Kitco, Reuters
            <br/>Data as of {livePrice?.updated || "March 1, 2026"}. 투자 판단의 참고자료이며, 투자 권유가 아닙니다.
          </p>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
