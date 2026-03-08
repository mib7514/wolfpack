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
    { id:"poland",flag:"🇵🇱",name:"폴란드",nameEn:"NBP",current:550,target:700,targetDate:"미정",annualPlan:30,share:"28%",targetShare:"30%+",rationale:"안보, 지정학 대비",note:"700t 목표 공식화, 150t 추가 승인",color:RED,
      m2025:{Jan:3,Feb:29,Mar:14,Apr:1,May:0,Jun:0,Jul:0,Aug:0,Sep:0,Oct:16,Nov:12,Dec:35},m2026:{Jan:null,Feb:null},streak:"Oct~Dec 재매입" },
    { id:"china",flag:"🇨🇳",name:"중국",nameEn:"PBOC",current:2308,target:null,targetDate:"상시",annualPlan:null,share:"9.6%",targetShare:"탈달러",rationale:"탈달러, 위안화 신뢰도",note:"15개월 연속, Goldman 추정 ~250t/yr",color:RED,
      m2025:{Jan:5,Feb:5,Mar:2,Apr:2,May:2,Jun:2,Jul:2,Aug:2,Sep:1.2,Oct:1,Nov:1,Dec:1},m2026:{Jan:1.2,Feb:null},streak:"15개월 연속" },
    { id:"czech",flag:"🇨🇿",name:"체코",nameEn:"CNB",current:72,target:100,targetDate:"2028",annualPlan:9.3,share:"3%",targetShare:"~4%",rationale:"수익률, 변동성 감소",note:"34개월 연속, 월 ~2t",color:BLU,
      m2025:{Jan:2,Feb:2,Mar:2,Apr:2,May:2,Jun:2,Jul:2,Aug:2,Sep:2,Oct:2,Nov:2,Dec:2},m2026:{Jan:2,Feb:null},streak:"34개월+ 연속" },
    { id:"serbia",flag:"🇷🇸",name:"세르비아",nameEn:"NBS",current:52,target:100,targetDate:"2030",annualPlan:12.8,share:"-",targetShare:"-",rationale:"경제 안정성",note:"Vučić 대통령 2030년 100t 목표",color:PUR,
      m2025:{Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0,Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0},m2026:{Jan:null,Feb:null},streak:"목표 선언" },
    { id:"india",flag:"🇮🇳",name:"인도",nameEn:"RBI",current:880,target:null,targetDate:"상시",annualPlan:50,share:"11%",targetShare:"다변화",rationale:"다변화, 경상수지 방어",note:"2024 대규모 매입 후 둔화",color:ORG,
      m2025:{Jan:3,Feb:0,Mar:3,Apr:3,May:3,Jun:0,Jul:0,Aug:0,Sep:3,Oct:0,Nov:0,Dec:0},m2026:{Jan:null,Feb:null},streak:"간헐적" },
    { id:"kazakhstan",flag:"🇰🇿",name:"카자흐스탄",nameEn:"NBK",current:340,target:null,targetDate:"상시",annualPlan:null,share:"54%",targetShare:"지정학 대비",rationale:"원자재국 다변화",note:"2025 역대 최대 57t",color:GRN,
      m2025:{Jan:4,Feb:0,Mar:4,Apr:4,May:4,Jun:4,Jul:4,Aug:4,Sep:4,Oct:1,Nov:8,Dec:17},m2026:{Jan:null,Feb:null},streak:"국내 금 생산 매입" },
    { id:"turkey",flag:"🇹🇷",name:"튀르키예",nameEn:"CBRT",current:644,target:null,targetDate:"상시",annualPlan:null,share:"38%",targetShare:"탈달러",rationale:"리라화 헤지",note:"23개월 연속",color:CYA,
      m2025:{Jan:2,Feb:3,Mar:3,Apr:2,May:2,Jun:2,Jul:2,Aug:2,Sep:2,Oct:3,Nov:null,Dec:null},m2026:{Jan:null,Feb:null},streak:"23개월+ 연속" },
    { id:"brazil",flag:"🇧🇷",name:"브라질",nameEn:"BCB",current:172,target:null,targetDate:"상시",annualPlan:null,share:"7%",targetShare:"다변화",rationale:"BRICS 비축",note:"4년만에 재진입, 3개월 43t",color:"#FFD700",
      m2025:{Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0,Jul:0,Aug:0,Sep:15,Oct:16,Nov:11,Dec:null},m2026:{Jan:null,Feb:null},streak:"2025.09 재진입" },
    { id:"uzbekistan",flag:"🇺🇿",name:"우즈베키스탄",nameEn:"CBU",current:399,target:null,targetDate:"상시",annualPlan:null,share:"86%",targetShare:"금 비중 확대",rationale:"원자재국 금 비축",note:"2026.01 9t 매입, Oct부터 연속 매입. 외환보유 대비 86%",color:"#1E90FF",
      m2025:{Jan:null,Feb:null,Mar:null,Apr:null,May:null,Jun:null,Jul:null,Aug:null,Sep:null,Oct:null,Nov:null,Dec:null},m2026:{Jan:9,Feb:null},streak:"Oct~ 연속 매입" },
    { id:"malaysia",flag:"🇲🇾",name:"말레이시아",nameEn:"BNM",current:42,target:null,targetDate:"상시",annualPlan:null,share:"5%",targetShare:"다변화",rationale:"외환보유 다변화",note:"2018년 이후 최초 금 매입 (2026.01 +3t). 수요 기반 확대 신호",color:"#FF4500",
      m2025:{Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0,Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0},m2026:{Jan:3,Feb:null},streak:"2026.01 재진입" },
    { id:"korea",flag:"🇰🇷",name:"한국",nameEn:"BOK",current:104,target:null,targetDate:"상시",annualPlan:null,share:"4%",targetShare:"ETF 편입",rationale:"유동성·거래편의성",note:"Q1 2026부터 해외상장 실물금 ETF 외환보유고 편입. 2013년 이후 최초 금 관련 투자",color:"#0047AB",
      m2025:{Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0,Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0},m2026:{Jan:null,Feb:null},streak:"ETF 편입 예정" },
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

  // AI Update state
  const [updating, setUpdating] = useState(false);
  const [updateLog, setUpdateLog] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Live data (merged from Supabase + base)
  const [livePrice, setLivePrice] = useState(BASE.price);
  const [liveNews, setLiveNews] = useState(BASE.newsItems);
  const [liveEvents, setLiveEvents] = useState(BASE.events);
  const [liveIB, setLiveIB] = useState(BASE.ibForecasts);
  const [liveCountries, setLiveCountries] = useState(BASE.countries);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Load saved data from Supabase on mount
  useEffect(() => {
    async function loadSaved() {
      try {
        const { data, error } = await supabase
          .from("gold_monitor_data")
          .select("data, updated_at")
          .eq("id", "latest")
          .single();
        if (!error && data?.data) {
          applyUpdate(data.data);
          setLastUpdate(data.updated_at);
        }
      } catch (e) {
        console.log("No saved gold data yet");
      }
    }
    loadSaved();
  }, []);

  function applyUpdate(result) {
    if (result.price?.price) {
      setLivePrice(result.price);
    }
    if (result.news?.length > 0) {
      const tagColors = { "지정학":RED, "전망":BLU, "중앙은행":GRN, "시장":ORG, "데이터":T2, "정책":PUR };
      setLiveNews(result.news.map(n => ({
        ...n,
        color: tagColors[n.tag] || T2,
      })));
    }
    if (result.events?.length > 0) {
      setLiveEvents(result.events);
    }
    if (result.ib?.forecasts?.length > 0) {
      const colors = [ORG,"#FFD700",RED,BLU,GRN,PUR,CYA,"#E67E22","#FF1493"];
      setLiveIB(result.ib.forecasts.map((f,i) => ({
        bank: f.bank,
        target2026: f.target_2026,
        cbForecast: f.cb_forecast,
        stance: f.stance,
        color: colors[i % colors.length],
      })));
    }
    if (result.cb?.countries) {
      setLiveCountries(prev => prev.map(c => {
        const upd = result.cb.countries[c.id];
        if (!upd) return c;
        const updated = {
          ...c,
          current: upd.current_reserves || c.current,
        };
        // Update m2026 monthly data if available
        if (upd.latest_month && upd.latest_month_tonnes != null) {
          const monthMap = {"jan":"Jan","feb":"Feb","mar":"Mar","apr":"Apr","may":"May","jun":"Jun","jul":"Jul","aug":"Aug","sep":"Sep","oct":"Oct","nov":"Nov","dec":"Dec"};
          const monthKey = monthMap[upd.latest_month.toLowerCase().slice(0,3)];
          if (monthKey && updated.m2026) {
            updated.m2026 = { ...updated.m2026, [monthKey]: upd.latest_month_tonnes };
          }
        }
        if (upd.note) updated.note = upd.note;
        return updated;
      }));
    }
  }

  // ─── AI UPDATE ───
  const handleAIUpdate = useCallback(async () => {
    setUpdating(true);
    setUpdateLog(["🔍 웹 검색 중... 금가격, CB 매입, IB 전망, 뉴스"]);
    try {
      const res = await fetch("/api/gold-update", { method: "POST" });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      setUpdateLog(prev => [...prev, "✅ 데이터 수신 완료"]);

      // Apply updates
      applyUpdate(result);
      setLastUpdate(result.updated_at);

      setUpdateLog(prev => [...prev,
        result.price?.price ? `💰 금가격: $${result.price.price.toLocaleString()} (${result.price.change_pct > 0 ? "+" : ""}${result.price.change_pct}%)` : "⚠️ 금가격 업데이트 실패",
        result.cb?.year2025_total ? `🏦 2025 CB 매입: ${result.cb.year2025_total}t` : "⚠️ CB 데이터 부분 실패",
        result.ib?.forecasts?.length ? `🔮 IB 전망 ${result.ib.forecasts.length}개 업데이트` : "⚠️ IB 전망 업데이트 실패",
        result.news?.length ? `📰 뉴스 ${result.news.length}건 업데이트` : "⚠️ 뉴스 업데이트 실패",
        "───────────────────",
        "🎉 업데이트 완료!",
      ]);
    } catch (err) {
      setUpdateLog(prev => [...prev, `❌ 오류: ${err.message}`]);
    } finally {
      setUpdating(false);
    }
  }, []);

  const sorted = [...liveCountries].sort((a,b) => {
    if (sortBy==="target") { if(!a.target&&!b.target)return 0;if(!a.target)return 1;if(!b.target)return -1;return(b.current/b.target)-(a.current/a.target); }
    if (sortBy==="y2025") return Object.values(b.m2025).reduce((s,v)=>s+(v||0),0)-Object.values(a.m2025).reduce((s,v)=>s+(v||0),0);
    return b.current-a.current;
  });

  const tabs = [
    { id:"overview",label:"📊 Overview" },{ id:"purchases",label:"🏦 CB 매입" },
    { id:"countries",label:"🌍 국가별" },{ id:"forecasts",label:"🔮 IB 전망" },{ id:"news",label:"📰 뉴스" },
  ];

  const currentPrice = livePrice?.price || BASE.price.price;
  const changePct = livePrice?.change_pct || BASE.price.change_pct;

  return (
    <div style={{ fontFamily:"'DM Sans','Pretendard',-apple-system,sans-serif",background:BG,color:T1,minHeight:"100vh" }}>
      {/* ─── HEADER ─── */}
      <div style={{ background:`linear-gradient(135deg,${BG} 0%,#1A1510 50%,${BG} 100%)`,borderBottom:`1px solid ${BD}`,padding:"18px 20px 14px" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10 }}>
          <div>
            <div style={{ marginBottom:4 }}><a href="/" style={{ fontSize:10,color:T3,textDecoration:"none" }}>← Control Tower</a></div>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4 }}>
              <span style={{ fontSize:26 }}>🐺</span>
              <h1 style={{ fontSize:18,fontWeight:800,margin:0,background:`linear-gradient(90deg,${GOLD},${GOLD_L})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>Gold Central Bank Monitor</h1>
            </div>
            <p style={{ color:T2,fontSize:11,margin:0 }}>세계 중앙은행 금 매입 동향 & 글로벌 IB 전망</p>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ display:"flex",alignItems:"center",gap:6 }}>
              <span style={{ fontSize:10,color:T2 }}>XAU/USD</span>
              <span style={{ fontSize:22,fontWeight:800,color:GOLD }}>${currentPrice.toLocaleString()}</span>
              <span style={{ fontSize:10,fontWeight:600,color:changePct>=0?GRN:RED,background:changePct>=0?"rgba(62,207,142,0.12)":"rgba(232,72,85,0.12)",padding:"2px 6px",borderRadius:4 }}>{changePct>0?"+":""}{changePct}%</span>
            </div>
            <p style={{ fontSize:9,color:T3,margin:"2px 0 0" }}>{livePrice?.updated || time.toLocaleDateString("ko-KR")} 기준</p>
          </div>
        </div>

        {/* Tabs + Update Button */}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,flexWrap:"wrap",gap:8 }}>
          <div style={{ display:"flex",gap:3,flexWrap:"wrap" }}>
            {tabs.map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                padding:"6px 12px",fontSize:11,fontWeight:600,border:"none",borderRadius:6,cursor:"pointer",
                background:tab===t.id?GOLD:"rgba(255,255,255,0.05)",color:tab===t.id?BG:T2,transition:"all 0.15s"
              }}>{t.label}</button>
            ))}
          </div>
          <button
            onClick={handleAIUpdate}
            disabled={updating}
            style={{
              padding:"6px 14px",fontSize:11,fontWeight:700,border:"none",borderRadius:6,cursor:updating?"not-allowed":"pointer",
              background:updating?"rgba(255,255,255,0.05)":`linear-gradient(135deg,${GOLD},#B8860B)`,
              color:updating?T2:"#000",transition:"all 0.2s",opacity:updating?0.7:1,
              display:"flex",alignItems:"center",gap:6,
            }}
          >
            {updating ? (
              <><span style={{ display:"inline-block",width:12,height:12,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:GOLD,borderRadius:"50%",animation:"spin 0.8s linear infinite" }} /> 업데이트 중...</>
            ) : (
              <>🤖 AI 업데이트</>
            )}
          </button>
        </div>

        {/* Update Log */}
        {updateLog.length > 0 && (
          <div style={{ marginTop:10,background:"rgba(0,0,0,0.4)",borderRadius:8,padding:"10px 12px",border:`1px solid ${BD}`,maxHeight:160,overflowY:"auto" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
              <span style={{ fontSize:10,fontWeight:700,color:GOLD }}>📡 업데이트 로그</span>
              {!updating && <button onClick={()=>setUpdateLog([])} style={{ fontSize:9,color:T3,background:"none",border:"none",cursor:"pointer" }}>닫기 ✕</button>}
            </div>
            {updateLog.map((log,i) => (
              <div key={i} style={{ fontSize:10,color:T2,lineHeight:1.6,fontFamily:"monospace" }}>{log}</div>
            ))}
          </div>
        )}
        {lastUpdate && updateLog.length === 0 && (
          <div style={{ marginTop:6,fontSize:9,color:T3,textAlign:"right" }}>
            마지막 AI 업데이트: {new Date(lastUpdate).toLocaleString("ko-KR")}
          </div>
        )}
      </div>

      {/* ─── CONTENT ─── */}
      <div style={{ padding:"14px 18px",maxWidth:1100,margin:"0 auto" }}>

        {/* ══ OVERVIEW ══ */}
        {tab === "overview" && (<div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,marginBottom:14 }}>
            {[
              { label:"2025 CB 순매입",value:"863t",sub:"YoY -17.4%",c:GOLD },
              { label:"2026.01 CB 순매입",value:"5t",sub:"12개월 평균 27t 대비↓",c:GRN },
              { label:"2026E CB 전망",value:"755~850t",sub:"JPM/WGC",c:BLU },
              { label:"수요 확대 신호",value:"MY·KR",sub:"말레이시아·한국 복귀",c:ORG },
            ].map((k,i) => (
              <div key={i} style={{ background:BGC,borderRadius:10,padding:"12px 14px",border:`1px solid ${BD}` }}>
                <p style={{ fontSize:9,color:T3,margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.5px" }}>{k.label}</p>
                <p style={{ fontSize:18,fontWeight:800,color:k.c,margin:"0 0 2px" }}>{k.value}</p>
                <p style={{ fontSize:10,color:T2,margin:0 }}>{k.sub}</p>
              </div>
            ))}
          </div>
          <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}`,marginBottom:12 }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 12px",color:GOLD }}>연간 글로벌 CB 금 순매입 (톤) & YoY</h3>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={BASE.annualData} margin={{top:5,right:16,left:-4,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="year" tick={{fill:T2,fontSize:10}} />
                <YAxis yAxisId="l" tick={{fill:T2,fontSize:9}} />
                <YAxis yAxisId="r" orientation="right" tick={{fill:T2,fontSize:9}} unit="%" />
                <Tooltip content={({active,payload,label})=>active&&payload?.length?<div style={{background:BGC,border:`1px solid ${BD}`,borderRadius:6,padding:"8px 12px",fontSize:11}}><div style={{fontWeight:600}}>{label}</div>{payload[0]?.value!=null&&<div style={{color:GOLD}}>매입: {payload[0].value}t</div>}{payload[1]?.value!=null&&<div style={{color:payload[1].value>=0?GRN:RED}}>YoY: {payload[1].value>0?"+":""}{payload[1].value}%</div>}</div>:null} />
                <Bar yAxisId="l" dataKey="total" radius={[3,3,0,0]}>{BASE.annualData.map((e,i)=><Cell key={i} fill={e.year==="2026E"?"rgba(212,160,23,0.35)":GOLD} stroke={e.year==="2026E"?GOLD:"none"} strokeDasharray={e.year==="2026E"?"4 2":"0"} />)}</Bar>
                <Line yAxisId="r" type="monotone" dataKey="yoy" stroke={BLU} strokeWidth={2} dot={{r:3,fill:BLU}} connectNulls />
                <ReferenceLine yAxisId="l" y={473} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" label={{value:"2010-21 avg 473t",fill:T3,fontSize:8}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}`,marginBottom:12 }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 12px",color:GOLD }}>금 가격 추이 ($/oz)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={BASE.goldPriceHistory} margin={{top:5,right:16,left:-4,bottom:0}}>
                <defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD} stopOpacity={0.25} /><stop offset="100%" stopColor={GOLD} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" tick={{fill:T2,fontSize:9}} />
                <YAxis tick={{fill:T2,fontSize:9}} domain={[1800,5800]} tickFormatter={v=>`$${(v/1000).toFixed(1)}k`} />
                <Tooltip content={({active,payload,label})=>active&&payload?.length?<div style={{background:BGC,border:`1px solid ${BD}`,borderRadius:6,padding:"6px 10px",fontSize:11}}>{label}: <strong style={{color:GOLD}}>${payload[0].value?.toLocaleString()}</strong></div>:null} />
                <Area type="monotone" dataKey="price" stroke="none" fill="url(#gg)" />
                <Line type="monotone" dataKey="price" stroke={GOLD} strokeWidth={2.5} dot={{r:3.5,fill:GOLD}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}` }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 10px",color:GOLD }}>📡 Latest</h3>
            {liveNews.slice(0,5).map((n,i) => (
              <div key={i} style={{ display:"flex",alignItems:"flex-start",gap:8,padding:"7px 0",borderBottom:i<4?"1px solid rgba(255,255,255,0.04)":"none" }}>
                <span style={{ fontSize:8,fontWeight:700,color:n.color||T2,background:`${n.color||T2}18`,padding:"2px 6px",borderRadius:4,whiteSpace:"nowrap" }}>{n.tag}</span>
                <div style={{ flex:1,fontSize:11,lineHeight:1.4 }}>{n.title}<div style={{ fontSize:9,color:T3,marginTop:1 }}>{n.date}</div></div>
                <span style={{ fontSize:13,color:n.impact==="↑"?GRN:n.impact==="↓"?RED:T2 }}>{n.impact}</span>
              </div>
            ))}
          </div>
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
            {liveCountries.filter(c=>c.target).map((c,i)=>(
              <div key={i} style={{ marginBottom:10 }}>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2 }}>
                  <span style={{fontWeight:700}}>{c.flag} {c.name}</span>
                  <span style={{color:T2,fontSize:10}}>{c.current}t → {c.target}t (잔여 {c.target-c.current}t)</span>
                </div>
                <ProgressBar current={c.current} target={c.target} color={c.color} />
              </div>
            ))}
          </div>
          <div style={{ display:"flex",gap:4,marginBottom:8,alignItems:"center" }}>
            <span style={{fontSize:10,color:T3}}>정렬:</span>
            {[{id:"y2025",l:"2025 매입순"},{id:"current",l:"보유량순"},{id:"target",l:"목표달성률"}].map(s=>(
              <button key={s.id} onClick={()=>setSortBy(s.id)} style={{padding:"3px 8px",fontSize:9,fontWeight:600,border:"none",borderRadius:4,cursor:"pointer",background:sortBy===s.id?GOLD:"rgba(255,255,255,0.06)",color:sortBy===s.id?BG:T3}}>{s.l}</button>
            ))}
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
              <tbody>{liveIB.map((f,i)=>{
                const tn=parseFloat((f.target2026||"").replace(/[$,]/g,""));
                const imp=tn?((tn-currentPrice)/currentPrice*100).toFixed(1):null;
                return <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{padding:8,fontWeight:700}}><span style={{display:"inline-block",width:3,height:12,background:f.color,borderRadius:2,marginRight:6,verticalAlign:"middle"}} />{f.bank}</td>
                  <td style={{padding:8,fontWeight:800,color:f.color,fontSize:13}}>{f.target2026}</td>
                  <td style={{padding:8,fontSize:10,color:T2}}>{f.cbForecast}</td>
                  <td style={{padding:8}}><span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:3,background:f.stance?.includes("Very")?"rgba(232,72,85,0.12)":"rgba(62,207,142,0.12)",color:f.stance?.includes("Very")?RED:GRN}}>{f.stance}</span></td>
                  <td style={{padding:8,fontWeight:600,fontSize:11,color:imp&&parseFloat(imp)>=0?GRN:RED}}>{imp?`${parseFloat(imp)>0?"+":""}${imp}%`:"-"}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}` }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 12px",color:GOLD }}>🔑 핵심 전망 근거</h3>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:8 }}>
              {[
                { i:"🏦",t:"CB 구조적 매입",d:"EM CB 달러 다변화. 폴란드·체코·세르비아 명시적 확대" },
                { i:"🌐",t:"수요 기반 확대",d:"말레이시아·한국 등 장기 공백 후 복귀. 2026 핵심 테마" },
                { i:"💵",t:"화폐가치 하락",d:"미 재정적자, 글로벌 부채 증가, 달러 신뢰 약화" },
                { i:"🌍",t:"지정학 리스크",d:"미-이란, 미중 관세, 러-우" },
                { i:"📉",t:"Fed 인하 사이클",d:"실질금리↓ → 금 보유 기회비용↓" },
              ].map((d,i)=><div key={i} style={{background:BGC2,borderRadius:8,padding:12,border:`1px solid ${BD}`}}><div style={{fontSize:18,marginBottom:4}}>{d.i}</div><div style={{fontSize:11,fontWeight:700,color:GOLD,marginBottom:4}}>{d.t}</div><div style={{fontSize:10,color:T2,lineHeight:1.5}}>{d.d}</div></div>)}
            </div>
          </div>
        </div>)}

        {/* ══ NEWS ══ */}
        {tab === "news" && (<div>
          <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}`,marginBottom:12 }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 12px",color:GOLD }}>📰 Gold News Flow</h3>
            {liveNews.map((n,i) => (
              <div key={i} style={{ display:"flex",alignItems:"flex-start",gap:10,padding:"10px 0",borderBottom:i<liveNews.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>
                <span style={{ fontSize:9,fontWeight:700,color:n.color||T2,background:`${n.color||T2}18`,padding:"2px 7px",borderRadius:4,whiteSpace:"nowrap",minWidth:50,textAlign:"center" }}>{n.tag}</span>
                <div style={{ flex:1 }}><div style={{fontSize:12,lineHeight:1.4,fontWeight:500}}>{n.title}</div><div style={{fontSize:9,color:T3,marginTop:2}}>{n.date}</div></div>
                <span style={{ fontSize:16,fontWeight:800,color:n.impact==="↑"?GRN:n.impact==="↓"?RED:T2 }}>{n.impact}</span>
              </div>
            ))}
          </div>
          <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}`,marginBottom:12 }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 10px",color:GOLD }}>📅 주요 이벤트</h3>
            {liveEvents.map((e,i) => (
              <div key={i} style={{ display:"flex",gap:10,padding:"8px 0",borderBottom:i<liveEvents.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>
                <span style={{fontSize:10,fontWeight:700,color:BLU,minWidth:58}}>{e.date}</span>
                <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600}}>{e.event}</div><div style={{fontSize:9,color:T3}}>{e.note}</div></div>
              </div>
            ))}
          </div>
          <div style={{ background:BGC,borderRadius:12,padding:16,border:`1px solid ${BD}` }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:"0 0 10px",color:GOLD }}>📊 센티먼트 (Kitco)</h3>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              {[{l:"Wall Street",u:67,n:22,d:11},{l:"개인 투자자",u:76,n:14,d:10}].map((s,i)=>(
                <div key={i}><div style={{fontSize:10,color:T2,marginBottom:4}}>{s.l}</div><div style={{display:"flex",gap:3}}>
                  <div style={{flex:s.u,height:22,background:GRN,borderRadius:"4px 0 0 4px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700}}>상승 {s.u}%</div>
                  <div style={{flex:s.n,height:22,background:T2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:BG}}>{s.n}%</div>
                  <div style={{flex:s.d,height:22,background:RED,borderRadius:"0 4px 4px 0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700}}>{s.d}%</div>
                </div></div>
              ))}
            </div>
          </div>
        </div>)}

        {/* FOOTER */}
        <div style={{ marginTop:18,padding:"10px 0",borderTop:`1px solid ${BD}`,textAlign:"center" }}>
          <p style={{ fontSize:8,color:"rgba(255,255,255,0.2)",margin:0,lineHeight:1.5 }}>
            🐺 늑대무리원정단 | Source: WGC, IMF, JPMorgan, Goldman Sachs, UBS, SSGA, Kitco, Reuters
            <br/>Data as of {livePrice?.updated || "March 1, 2026"}. 투자 판단의 참고자료이며, 투자 권유가 아닙니다.
          </p>
        </div>
      </div>

      {/* Spinner animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
