"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, Cell, ReferenceLine
} from "recharts";

const GOLD_COLOR = "#D4A017";
const GOLD_LIGHT = "#F5E6B8";
const BG_DARK = "#0A0A0F";
const BG_CARD = "#111118";
const BG_CARD_2 = "#16161F";
const BORDER = "#2A2A35";
const TEXT_PRIMARY = "#E8E4DD";
const TEXT_SECONDARY = "#9A9690";
const TEXT_MUTE = "#5A5650";
const RED = "#E84855";
const GREEN = "#3ECF8E";
const BLUE = "#4A9EFF";
const ORANGE = "#FF6B35";
const PURPLE = "#9B59B6";
const CYAN = "#1ABC9C";

// ─── DATA: Global monthly (2024 vs 2025) ───
const monthlyData = [
  { month: "Jan", m2024: 18, m2025: 18, label: "1월" },
  { month: "Feb", m2024: 19, m2025: 24, label: "2월" },
  { month: "Mar", m2024: 36, m2025: 17, label: "3월" },
  { month: "Apr", m2024: 33, m2025: 15, label: "4월" },
  { month: "May", m2024: 10, m2025: 16, label: "5월" },
  { month: "Jun", m2024: 12, m2025: 17, label: "6월" },
  { month: "Jul", m2024: 37, m2025: 11, label: "7월" },
  { month: "Aug", m2024: 20, m2025: 19, label: "8월" },
  { month: "Sep", m2024: 186, m2025: 39, label: "9월" },
  { month: "Oct", m2024: 60, m2025: 53, label: "10월" },
  { month: "Nov", m2024: 53, m2025: 45, label: "11월" },
  { month: "Dec", m2024: 333, m2025: null, label: "12월" },
];

// ─── DATA: Annual totals ───
const annualData = [
  { year: "2018", total: 656, yoy: null },
  { year: "2019", total: 605, yoy: -7.8 },
  { year: "2020", total: 255, yoy: -57.9 },
  { year: "2021", total: 463, yoy: 81.6 },
  { year: "2022", total: 1082, yoy: 133.7 },
  { year: "2023", total: 1037, yoy: -4.2 },
  { year: "2024", total: 1045, yoy: 0.8 },
  { year: "2025", total: 863, yoy: -17.4 },
  { year: "2026E", total: 850, yoy: -1.5 },
];

// ─── DATA: Top buyers 2025 ───
const topBuyers2025 = [
  { country: "🇵🇱 폴란드", tonnes: 102, reserves: 550, share: "26%" },
  { country: "🇦🇿 아제르바이잔", tonnes: 38, reserves: null, share: "-" },
  { country: "🇰🇿 카자흐스탄", tonnes: 49, reserves: null, share: "-" },
  { country: "🇨🇳 중국", tonnes: 27, reserves: 2306, share: "~9%" },
  { country: "🇹🇷 튀르키예", tonnes: 27, reserves: 644, share: "-" },
  { country: "🇧🇷 브라질", tonnes: 43, reserves: 172, share: "7%" },
  { country: "🇨🇿 체코", tonnes: 20, reserves: 72, share: "-" },
  { country: "🇮🇩 인도네시아", tonnes: 10, reserves: 80, share: "5.9%" },
];

// ─── DATA: IB forecasts ───
const ibForecasts = [
  { bank: "JPMorgan", target2026: "$6,300", cbForecast: "755t/yr (190t/qtr)", stance: "Very Bullish", color: ORANGE },
  { bank: "Goldman Sachs", target2026: "$5,400", cbForecast: "60t/월 (720t/yr)", stance: "Bullish", color: "#FFD700" },
  { bank: "UBS", target2026: "$6,200", cbForecast: "구조적 매입 지속", stance: "Very Bullish", color: RED },
  { bank: "Deutsche Bank", target2026: "$6,000", cbForecast: "EM CB 매입 가속", stance: "Very Bullish", color: BLUE },
  { bank: "Bank of America", target2026: "$5,000", cbForecast: "CB 매입 견조", stance: "Bullish", color: GREEN },
  { bank: "Morgan Stanley", target2026: "$4,800", cbForecast: "구조적 상승 지속", stance: "Bullish", color: PURPLE },
  { bank: "Standard Chartered", target2026: "$4,800", cbForecast: "EM 다변화 수요", stance: "Bullish", color: CYAN },
  { bank: "SSGA", target2026: "773~1,117t", cbForecast: "2026 CB 매입 전망", stance: "Bullish", color: "#E67E22" },
  { bank: "Jefferies", target2026: "$6,600", cbForecast: "최대 강세", stance: "Very Bullish", color: "#FF1493" },
];

// ─── DATA: Gold price history ───
const goldPriceHistory = [
  { period: "24Q1", price: 2150 }, { period: "24Q2", price: 2350 },
  { period: "24Q3", price: 2550 }, { period: "24Q4", price: 2700 },
  { period: "25Q1", price: 3100 }, { period: "25Q2", price: 3500 },
  { period: "25Q3", price: 3800 }, { period: "25Q4", price: 4341 },
  { period: "현재", price: 5278 }, { period: "26E", price: 5400 },
];

// ─── DATA: News ───
const newsItems = [
  { date: "2026.02.28", title: "미-이스라엘 이란 공습에 금 $5,300 돌파", tag: "지정학", impact: "↑", color: RED },
  { date: "2026.02.25", title: "JPMorgan, 2026 금가격 목표 $6,300으로 상향", tag: "전망", impact: "↑", color: BLUE },
  { date: "2026.02.25", title: "Goldman Sachs, 2026 YE 금가격 $5,400 유지", tag: "전망", impact: "→", color: GOLD_COLOR },
  { date: "2026.02.19", title: "중동 긴장에 금 $5,000 회복, 안전자산 수요 급증", tag: "지정학", impact: "↑", color: RED },
  { date: "2026.01.29", title: "금, 사상 최고 $5,595 기록 후 $4,410까지 급락", tag: "시장", impact: "↓", color: ORANGE },
  { date: "2026.01.20", title: "폴란드 NBP, 700t 목표 공식화 (150t 추가 승인)", tag: "중앙은행", impact: "↑", color: GREEN },
  { date: "2026.01.xx", title: "중국 PBOC, 15개월 연속 금 매입 (2,308t)", tag: "중앙은행", impact: "↑", color: GREEN },
  { date: "2025.12.xx", title: "WGC: 2025 연간 CB 순매입 863t, 전년比 -17%", tag: "데이터", impact: "→", color: TEXT_SECONDARY },
  { date: "2025.12.xx", title: "폴란드 NBP, 2025 최대 금 매입국 (102t)", tag: "중앙은행", impact: "↑", color: GREEN },
  { date: "2025.11.xx", title: "금 수요 5,002t 기록, 사상 첫 5,000t 돌파", tag: "데이터", impact: "↑", color: GOLD_COLOR },
];

// ─── DATA: Country-level tracker ───
const ALL_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const countries = [
  {
    id: "poland", flag: "🇵🇱", name: "폴란드", nameEn: "NBP",
    current: 550, target: 700, targetDate: "미정 (수년 내)", annualPlan: 30,
    share: "28%", targetShare: "30%+", rationale: "안보, 지정학적 위험 대비",
    note: "2026.01 Glapiński 총재 700t 목표 공식화, 150t 추가 매입 승인. EU 자금 유입으로 외환보유액 $2,710억, 매입 재원 충분",
    color: RED,
    m2025: { Jan:3,Feb:29,Mar:14,Apr:1,May:0,Jun:0,Jul:0,Aug:0,Sep:0,Oct:16,Nov:12,Dec:35 },
    m2026: { Jan:null, Feb:null },
    streak: "Oct~Dec 2025 연속 매입 재개",
  },
  {
    id: "china", flag: "🇨🇳", name: "중국", nameEn: "PBOC",
    current: 2308, target: null, targetDate: "상시", annualPlan: null,
    share: "9.6%", targetShare: "탈달러", rationale: "탈달러, 위안화 신뢰도",
    note: "15개월 연속 매입 (2024.11~). Goldman 추정 실제 매입량 공식의 10배 (~250t/yr). 2026.01 보유 $3,696억 사상 최고",
    color: RED,
    m2025: { Jan:5,Feb:5,Mar:2,Apr:2,May:2,Jun:2,Jul:2,Aug:2,Sep:1.2,Oct:1,Nov:1,Dec:1 },
    m2026: { Jan:1.2, Feb:null },
    streak: "15개월 연속 (2024.11~)",
  },
  {
    id: "czech", flag: "🇨🇿", name: "체코", nameEn: "CNB",
    current: 72, target: 100, targetDate: "2028", annualPlan: 9.3,
    share: "3%", targetShare: "~4%", rationale: "수익률, 변동성 감소",
    note: "34개월 연속 매입 중. 월 ~2t 기계적 적립 전략. 2028년까지 100t 공식 목표",
    color: BLUE,
    m2025: { Jan:2,Feb:2,Mar:2,Apr:2,May:2,Jun:2,Jul:2,Aug:2,Sep:2,Oct:2,Nov:2,Dec:2 },
    m2026: { Jan:2, Feb:null },
    streak: "34개월+ 연속 매입",
  },
  {
    id: "serbia", flag: "🇷🇸", name: "세르비아", nameEn: "NBS",
    current: 52, target: 100, targetDate: "2030", annualPlan: 12.8,
    share: "-", targetShare: "-", rationale: "경제 안정성",
    note: "Vučić 대통령 2030년까지 100t 보유 목표 공식 발표. 현재 52t에서 약 2배 확대 필요",
    color: PURPLE,
    m2025: { Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0,Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0 },
    m2026: { Jan:null, Feb:null },
    streak: "목표 선언 (실행 주시)",
  },
  {
    id: "india", flag: "🇮🇳", name: "인도", nameEn: "RBI",
    current: 880, target: null, targetDate: "상시", annualPlan: 50,
    share: "11%", targetShare: "다변화", rationale: "다변화, 경상수지 방어",
    note: "2024 대규모 매입(~73t) 후 2025 둔화. 국내 보관 확대 중. 세계 8위 금 보유국",
    color: ORANGE,
    m2025: { Jan:3,Feb:0,Mar:3,Apr:3,May:3,Jun:0,Jul:0,Aug:0,Sep:3,Oct:0,Nov:0,Dec:0 },
    m2026: { Jan:null, Feb:null },
    streak: "간헐적 (분기별)",
  },
  {
    id: "kazakhstan", flag: "🇰🇿", name: "카자흐스탄", nameEn: "NBK",
    current: 340, target: null, targetDate: "상시", annualPlan: null,
    share: "54%", targetShare: "지정학 대비", rationale: "지정학, 원자재국 다변화",
    note: "2025 역대 최대 57t 매입. 국내 생산금 매입 프로그램 운영. 보유비중 54% 최고 수준",
    color: GREEN,
    m2025: { Jan:4,Feb:0,Mar:4,Apr:4,May:4,Jun:4,Jul:4,Aug:4,Sep:4,Oct:1,Nov:8,Dec:17 },
    m2026: { Jan:null, Feb:null },
    streak: "국내 금 생산 매입 지속",
  },
  {
    id: "turkey", flag: "🇹🇷", name: "튀르키예", nameEn: "CBRT",
    current: 644, target: null, targetDate: "상시", annualPlan: null,
    share: "38%", targetShare: "탈달러", rationale: "리라화 헤지, 탈달러",
    note: "23개월 연속 매입 (2025.10 기준). 상업은행 금 포함 시 보유량 더 큼",
    color: CYAN,
    m2025: { Jan:2,Feb:3,Mar:3,Apr:2,May:2,Jun:2,Jul:2,Aug:2,Sep:2,Oct:3,Nov:null,Dec:null },
    m2026: { Jan:null, Feb:null },
    streak: "23개월+ 연속",
  },
  {
    id: "brazil", flag: "🇧🇷", name: "브라질", nameEn: "BCB",
    current: 172, target: null, targetDate: "상시", annualPlan: null,
    share: "7%", targetShare: "다변화", rationale: "BRICS 전략적 비축",
    note: "4년만에 재진입 (2025.09~). 3개월간 43t 공격적 매입. BRICS+ 전략적 비축",
    color: "#FFD700",
    m2025: { Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0,Jul:0,Aug:0,Sep:15,Oct:16,Nov:11,Dec:null },
    m2026: { Jan:null, Feb:null },
    streak: "2025.09 재진입",
  },
];

// ═══════════════ COMPONENTS ═══════════════

function ProgressBar({ current, target, color }) {
  if (!target) return null;
  const pct = Math.min((current / target) * 100, 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 7, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color, minWidth: 34, textAlign: "right" }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

function CountryCard({ c, expanded, onToggle }) {
  const t2025 = Object.values(c.m2025).reduce((s, v) => s + (v || 0), 0);
  const chartData = ALL_MONTHS.map(m => ({ m, t: c.m2025[m] ?? 0 }));
  return (
    <div style={{ background: BG_CARD, borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
      <div onClick={onToggle} style={{ padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderBottom: expanded ? `1px solid ${BORDER}` : "none" }}>
        <span style={{ fontSize: 24 }}>{c.flag}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{c.name}</span>
            <span style={{ fontSize: 10, color: TEXT_SECONDARY }}>{c.nameEn}</span>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap", fontSize: 10, color: TEXT_SECONDARY }}>
            <span>보유 <strong style={{ color: GOLD_COLOR }}>{c.current.toLocaleString()}t</strong></span>
            {c.target && <span>목표 <strong style={{ color: c.color }}>{c.target}t</strong> <span style={{ color: TEXT_MUTE }}>({c.targetDate})</span></span>}
            <span>비중 <strong style={{ color: TEXT_PRIMARY }}>{c.share}</strong></span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: GOLD_COLOR }}>{t2025}t</div>
          <div style={{ fontSize: 8, color: TEXT_MUTE }}>2025</div>
        </div>
        <span style={{ fontSize: 14, color: TEXT_MUTE, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
      </div>
      {expanded && (
        <div style={{ padding: "12px 14px" }}>
          {c.target && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: TEXT_SECONDARY, marginBottom: 3 }}>
                <span>목표 달성도</span>
                <span>{c.current}t / {c.target}t (잔여 {c.target - c.current}t)</span>
              </div>
              <ProgressBar current={c.current} target={c.target} color={c.color} />
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
            {[
              { l: "매입 근거", v: c.rationale }, { l: "매입 패턴", v: c.streak },
              { l: "보유비중 / 목표", v: `${c.share} → ${c.targetShare}` },
              { l: "연간 계획", v: c.annualPlan ? `~${c.annualPlan}t/yr` : "비공개" },
            ].map((x, i) => (
              <div key={i} style={{ background: BG_CARD_2, borderRadius: 6, padding: "6px 8px" }}>
                <div style={{ fontSize: 8, color: TEXT_MUTE, textTransform: "uppercase" }}>{x.l}</div>
                <div style={{ fontSize: 10, fontWeight: 600, marginTop: 1 }}>{x.v}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: "8px 10px", background: `${c.color}10`, borderLeft: `3px solid ${c.color}`, borderRadius: "0 6px 6px 0", marginBottom: 12, fontSize: 10, color: TEXT_SECONDARY, lineHeight: 1.5 }}>
            💡 {c.note}
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: GOLD_COLOR, marginBottom: 6 }}>2025 월간 매입 (톤)</div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={chartData} margin={{ top: 2, right: 2, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="m" tick={{ fill: TEXT_MUTE, fontSize: 8 }} />
                <YAxis tick={{ fill: TEXT_MUTE, fontSize: 8 }} />
                <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                  <div style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 8px", fontSize: 10 }}>
                    {label}: <strong style={{ color: c.color }}>{payload[0].value}t</strong>
                  </div>
                ) : null} />
                <Bar dataKey="t" radius={[2, 2, 0, 0]}>
                  {chartData.map((e, i) => <Cell key={i} fill={e.t > 0 ? c.color : "rgba(255,255,255,0.04)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, marginBottom: 6 }}>📡 2026 월간 추적</div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {ALL_MONTHS.map((m, i) => {
                const v = c.m2026?.[m]; const future = i >= 2; const has = v != null;
                return (
                  <div key={m} style={{ flex: "1 0 36px", minWidth: 36, background: future ? "rgba(255,255,255,0.02)" : has ? `${c.color}12` : "rgba(255,255,255,0.04)", border: `1px solid ${has ? c.color + "40" : "rgba(255,255,255,0.06)"}`, borderRadius: 5, padding: "5px 2px", textAlign: "center" }}>
                    <div style={{ fontSize: 8, color: TEXT_MUTE }}>{m}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: future ? TEXT_MUTE : has ? c.color : TEXT_SECONDARY }}>
                      {future ? "—" : has ? `${v}t` : "⏳"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════ MAIN PAGE ═══════════════

export default function GoldMonitorPage() {
  const [tab, setTab] = useState("overview");
  const [time, setTime] = useState(new Date());
  const [expandedCountry, setExpandedCountry] = useState("poland");
  const [sortBy, setSortBy] = useState("y2025");

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 60000); return () => clearInterval(t); }, []);

  const sorted = [...countries].sort((a, b) => {
    if (sortBy === "target") { if (!a.target && !b.target) return 0; if (!a.target) return 1; if (!b.target) return -1; return (b.current / b.target) - (a.current / a.target); }
    if (sortBy === "y2025") { return Object.values(b.m2025).reduce((s, v) => s + (v || 0), 0) - Object.values(a.m2025).reduce((s, v) => s + (v || 0), 0); }
    return b.current - a.current;
  });

  const tabs = [
    { id: "overview", label: "📊 Overview" },
    { id: "purchases", label: "🏦 CB 매입" },
    { id: "countries", label: "🌍 국가별" },
    { id: "forecasts", label: "🔮 IB 전망" },
    { id: "news", label: "📰 뉴스" },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans','Pretendard',-apple-system,sans-serif", background: BG_DARK, color: TEXT_PRIMARY, minHeight: "100vh" }}>
      {/* ─── HEADER ─── */}
      <div style={{ background: `linear-gradient(135deg,${BG_DARK} 0%,#1A1510 50%,${BG_DARK} 100%)`, borderBottom: `1px solid ${BORDER}`, padding: "18px 20px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <a href="/" style={{ fontSize: 10, color: TEXT_MUTE, textDecoration: "none", marginRight: 4 }}>← Control Tower</a>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 26 }}>🐺</span>
              <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, background: `linear-gradient(90deg,${GOLD_COLOR},${GOLD_LIGHT})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.5px" }}>
                Gold Central Bank Monitor
              </h1>
            </div>
            <p style={{ color: TEXT_SECONDARY, fontSize: 11, margin: 0 }}>세계 중앙은행 금 매입 동향 & 글로벌 IB 전망</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: TEXT_SECONDARY }}>XAU/USD</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: GOLD_COLOR, fontVariantNumeric: "tabular-nums" }}>$5,278</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: GREEN, background: "rgba(62,207,142,0.12)", padding: "2px 6px", borderRadius: 4 }}>+1.97%</span>
            </div>
            <p style={{ fontSize: 9, color: TEXT_MUTE, margin: "2px 0 0" }}>{time.toLocaleDateString("ko-KR")} 기준</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 3, marginTop: 12, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "6px 12px", fontSize: 11, fontWeight: 600, border: "none", borderRadius: 6, cursor: "pointer",
              background: tab === t.id ? GOLD_COLOR : "rgba(255,255,255,0.05)",
              color: tab === t.id ? BG_DARK : TEXT_SECONDARY, transition: "all 0.15s"
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ─── CONTENT ─── */}
      <div style={{ padding: "14px 18px", maxWidth: 1100, margin: "0 auto" }}>

        {/* ══════ OVERVIEW ══════ */}
        {tab === "overview" && (<div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginBottom: 14 }}>
            {[
              { label: "2025 CB 순매입", value: "863t", sub: "YoY -17.4%", c: GOLD_COLOR },
              { label: "2025 최대 매입국", value: "폴란드", sub: "102t", c: BLUE },
              { label: "2026E CB 전망", value: "755~850t", sub: "JPM/WGC", c: GREEN },
              { label: "IB 컨센 YE'26", value: "$5,180", sub: "Wall St Avg", c: ORANGE },
            ].map((k, i) => (
              <div key={i} style={{ background: BG_CARD, borderRadius: 10, padding: "12px 14px", border: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: 9, color: TEXT_MUTE, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{k.label}</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: k.c, margin: "0 0 2px" }}>{k.value}</p>
                <p style={{ fontSize: 10, color: TEXT_SECONDARY, margin: 0 }}>{k.sub}</p>
              </div>
            ))}
          </div>
          <div style={{ background: BG_CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}`, marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", color: GOLD_COLOR }}>연간 글로벌 CB 금 순매입 (톤) & YoY</h3>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={annualData} margin={{ top: 5, right: 16, left: -4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="year" tick={{ fill: TEXT_SECONDARY, fontSize: 10 }} />
                <YAxis yAxisId="l" tick={{ fill: TEXT_SECONDARY, fontSize: 9 }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fill: TEXT_SECONDARY, fontSize: 9 }} unit="%" />
                <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                  <div style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 12px", fontSize: 11 }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
                    {payload[0]?.value != null && <div style={{ color: GOLD_COLOR }}>매입: {payload[0].value}t</div>}
                    {payload[1]?.value != null && <div style={{ color: payload[1].value >= 0 ? GREEN : RED }}>YoY: {payload[1].value > 0 ? "+" : ""}{payload[1].value}%</div>}
                  </div>
                ) : null} />
                <Bar yAxisId="l" dataKey="total" radius={[3, 3, 0, 0]}>
                  {annualData.map((e, i) => <Cell key={i} fill={e.year === "2026E" ? "rgba(212,160,23,0.35)" : GOLD_COLOR} stroke={e.year === "2026E" ? GOLD_COLOR : "none"} strokeDasharray={e.year === "2026E" ? "4 2" : "0"} />)}
                </Bar>
                <Line yAxisId="r" type="monotone" dataKey="yoy" stroke={BLUE} strokeWidth={2} dot={{ r: 3, fill: BLUE }} connectNulls />
                <ReferenceLine yAxisId="l" y={473} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" label={{ value: "2010-21 avg 473t", fill: TEXT_MUTE, fontSize: 8 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: BG_CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}`, marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", color: GOLD_COLOR }}>금 가격 추이 ($/oz)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={goldPriceHistory} margin={{ top: 5, right: 16, left: -4, bottom: 0 }}>
                <defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD_COLOR} stopOpacity={0.25} /><stop offset="100%" stopColor={GOLD_COLOR} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" tick={{ fill: TEXT_SECONDARY, fontSize: 9 }} />
                <YAxis tick={{ fill: TEXT_SECONDARY, fontSize: 9 }} domain={[1800, 5800]} tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
                <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                  <div style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 10px", fontSize: 11 }}>
                    {label}: <strong style={{ color: GOLD_COLOR }}>${payload[0].value?.toLocaleString()}</strong>
                  </div>
                ) : null} />
                <Area type="monotone" dataKey="price" stroke="none" fill="url(#gg)" />
                <Line type="monotone" dataKey="price" stroke={GOLD_COLOR} strokeWidth={2.5} dot={{ r: 3.5, fill: GOLD_COLOR }} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap", fontSize: 10 }}>
              {[{ l: "ATH", v: "$5,595", c: RED }, { l: "현재", v: "$5,278", c: GOLD_COLOR }, { l: "YTD", v: "+21.6%", c: GREEN }, { l: "2025", v: "+63.5%", c: GREEN }].map((s, i) => (
                <span key={i}><span style={{ color: TEXT_MUTE }}>{s.l}: </span><strong style={{ color: s.c }}>{s.v}</strong></span>
              ))}
            </div>
          </div>
          <div style={{ background: BG_CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}` }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px", color: GOLD_COLOR }}>📡 Latest</h3>
            {newsItems.slice(0, 5).map((n, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 0", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: n.color, background: `${n.color}18`, padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap", marginTop: 1 }}>{n.tag}</span>
                <div style={{ flex: 1, fontSize: 11, lineHeight: 1.4 }}>{n.title}<div style={{ fontSize: 9, color: TEXT_MUTE, marginTop: 1 }}>{n.date}</div></div>
                <span style={{ fontSize: 13, color: n.impact === "↑" ? GREEN : n.impact === "↓" ? RED : TEXT_SECONDARY }}>{n.impact}</span>
              </div>
            ))}
          </div>
        </div>)}

        {/* ══════ PURCHASES ══════ */}
        {tab === "purchases" && (<div>
          <div style={{ background: BG_CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}`, marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 3px", color: GOLD_COLOR }}>월간 글로벌 CB 금 순매입 비교 (톤)</h3>
            <p style={{ fontSize: 10, color: TEXT_MUTE, margin: "0 0 12px" }}>2024 vs 2025 · YTD Nov</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} margin={{ top: 5, right: 8, left: -4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: TEXT_SECONDARY, fontSize: 9 }} />
                <YAxis tick={{ fill: TEXT_SECONDARY, fontSize: 9 }} />
                <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                  <div style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 10px", fontSize: 11 }}>
                    <div style={{ fontWeight: 600 }}>{label}</div>
                    {payload.map((p, i) => <div key={i} style={{ color: p.color }}>{p.name}: {p.value != null ? `${p.value}t` : "N/A"}</div>)}
                  </div>
                ) : null} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="m2024" name="2024" fill={BLUE} radius={[3, 3, 0, 0]} barSize={14} />
                <Bar dataKey="m2025" name="2025" fill={GOLD_COLOR} radius={[3, 3, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: BG_CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}`, marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", color: GOLD_COLOR }}>2025 주요국 매입 현황</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                  {["국가", "매입(t)", "보유(t)", "비중"].map(h => <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: TEXT_MUTE, fontSize: 9, fontWeight: 600 }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {topBuyers2025.map((b, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "8px", fontWeight: 600 }}>{b.country}</td>
                      <td style={{ padding: "8px", color: GOLD_COLOR, fontWeight: 700 }}>{b.tonnes}t</td>
                      <td style={{ padding: "8px" }}>{b.reserves ? `${b.reserves.toLocaleString()}t` : "-"}</td>
                      <td style={{ padding: "8px" }}>{b.share}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ background: BG_CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}` }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", color: GOLD_COLOR }}>연간 CB 순매입 & YoY</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                  {["연도", "순매입(t)", "YoY", "Bar"].map(h => <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: TEXT_MUTE, fontSize: 9 }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {annualData.map((d, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: d.year === "2025" ? "rgba(212,160,23,0.05)" : "transparent" }}>
                      <td style={{ padding: "7px 8px", fontWeight: d.year === "2025" || d.year === "2026E" ? 700 : 400 }}>{d.year}</td>
                      <td style={{ padding: "7px 8px", fontWeight: 700, color: GOLD_COLOR }}>{d.total}t</td>
                      <td style={{ padding: "7px 8px", fontWeight: 600, color: d.yoy == null ? TEXT_MUTE : d.yoy >= 0 ? GREEN : RED }}>{d.yoy == null ? "-" : `${d.yoy > 0 ? "+" : ""}${d.yoy}%`}</td>
                      <td style={{ padding: "7px 8px" }}><div style={{ height: 8, borderRadius: 3, width: `${Math.min((d.total / 1100) * 100, 100)}%`, background: GOLD_COLOR, opacity: d.year === "2026E" ? 0.45 : 1 }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>)}

        {/* ══════ COUNTRIES ══════ */}
        {tab === "countries" && (<div>
          <div style={{ background: BG_CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}`, marginBottom: 12, overflowX: "auto" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px", color: GOLD_COLOR }}>📋 주요국 중앙은행 금 매입 전략 요약</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, minWidth: 600 }}>
              <thead><tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                {["","보유량(t)","목표(t)","기한","계획(t/yr)","근거"].map((h, i) => (
                  <th key={i} style={{ textAlign: "left", padding: "7px 6px", color: TEXT_MUTE, fontSize: 8, fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {countries.map((c, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "7px 6px", fontWeight: 700, whiteSpace: "nowrap", fontSize: 11 }}>{c.flag} {c.name}</td>
                    <td style={{ padding: "7px 6px", fontWeight: 700, color: GOLD_COLOR }}>{c.current.toLocaleString()}</td>
                    <td style={{ padding: "7px 6px", fontWeight: 600, color: c.target ? c.color : TEXT_MUTE }}>{c.target || "—"}</td>
                    <td style={{ padding: "7px 6px", color: TEXT_SECONDARY }}>{c.targetDate}</td>
                    <td style={{ padding: "7px 6px", fontWeight: 600 }}>{c.annualPlan || "—"}</td>
                    <td style={{ padding: "7px 6px", color: TEXT_SECONDARY }}>{c.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ background: BG_CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}`, marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px", color: GOLD_COLOR }}>🎯 목표 달성 진척도</h3>
            {countries.filter(c => c.target).map((c, i) => {
              const rem = c.target - c.current;
              const dy = c.targetDate.match(/\d{4}/)?.[0];
              const yrsLeft = dy ? parseInt(dy) - 2026 + 1 : 5;
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700 }}>{c.flag} {c.name}</span>
                    <span style={{ color: TEXT_SECONDARY, fontSize: 10 }}>{c.current}t → {c.target}t <span style={{ color: TEXT_MUTE }}>(잔여 {rem}t)</span></span>
                  </div>
                  <ProgressBar current={c.current} target={c.target} color={c.color} />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 8, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: TEXT_MUTE }}>정렬:</span>
            {[{ id: "y2025", l: "2025 매입순" }, { id: "current", l: "보유량순" }, { id: "target", l: "목표달성률" }].map(s => (
              <button key={s.id} onClick={() => setSortBy(s.id)} style={{ padding: "3px 8px", fontSize: 9, fontWeight: 600, border: "none", borderRadius: 4, cursor: "pointer", background: sortBy === s.id ? GOLD_COLOR : "rgba(255,255,255,0.06)", color: sortBy === s.id ? BG_DARK : TEXT_MUTE }}>{s.l}</button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {sorted.map(c => <CountryCard key={c.id} c={c} expanded={expandedCountry === c.id} onToggle={() => setExpandedCountry(expandedCountry === c.id ? null : c.id)} />)}
          </div>
          <div style={{ background: BG_CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}` }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px", color: ORANGE }}>⚠️ 비보고 매입 추정</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ background: BG_CARD_2, borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 9, color: TEXT_MUTE }}>WGC 비보고 비중</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: ORANGE }}>57%</div>
                <div style={{ fontSize: 9, color: TEXT_SECONDARY }}>2025 총 매입의 57% 미보고</div>
              </div>
              <div style={{ background: BG_CARD_2, borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 9, color: TEXT_MUTE }}>Goldman 중국 실제 추정</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: RED }}>~250t/yr</div>
                <div style={{ fontSize: 9, color: TEXT_SECONDARY }}>공식 27t의 약 10배</div>
              </div>
            </div>
          </div>
        </div>)}

        {/* ══════ FORECASTS ══════ */}
        {tab === "forecasts" && (<div>
          <div style={{ background: BG_CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}`, marginBottom: 12, overflowX: "auto" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 3px", color: GOLD_COLOR }}>글로벌 IB 2026 금가격 전망</h3>
            <p style={{ fontSize: 10, color: TEXT_MUTE, margin: "0 0 12px" }}>현재가 $5,278 · Wall St 평균 $5,180</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 500 }}>
              <thead><tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                {["IB", "2026 YE", "CB 매입 전망", "스탠스", "Implied"].map(h => <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: TEXT_MUTE, fontSize: 9, fontWeight: 600 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {ibForecasts.map((f, i) => {
                  const tn = parseFloat(f.target2026.replace(/[$,]/g, ""));
                  const imp = tn ? ((tn - 5278) / 5278 * 100).toFixed(1) : null;
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "8px", fontWeight: 700 }}><span style={{ display: "inline-block", width: 3, height: 12, background: f.color, borderRadius: 2, marginRight: 6, verticalAlign: "middle" }} />{f.bank}</td>
                      <td style={{ padding: "8px", fontWeight: 800, color: f.color, fontSize: 13 }}>{f.target2026}</td>
                      <td style={{ padding: "8px", fontSize: 10, color: TEXT_SECONDARY }}>{f.cbForecast}</td>
                      <td style={{ padding: "8px" }}><span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: f.stance === "Very Bullish" ? "rgba(232,72,85,0.12)" : "rgba(62,207,142,0.12)", color: f.stance === "Very Bullish" ? RED : GREEN }}>{f.stance}</span></td>
                      <td style={{ padding: "8px", fontWeight: 600, fontSize: 11, color: imp && parseFloat(imp) >= 0 ? GREEN : RED }}>{imp ? `${parseFloat(imp) > 0 ? "+" : ""}${imp}%` : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ background: BG_CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}`, marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", color: GOLD_COLOR }}>2026 CB 매입 전망</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
              {[
                { s: "JPMorgan", v: "755t", d: "190t/qtr\n전년比 소폭↓", c: ORANGE },
                { s: "Goldman Sachs", v: "720t", d: "60t/월\nEM CB 구조적 매입", c: "#FFD700" },
                { s: "SSGA", v: "773~1,117t", d: "범위 전망\n상단시 역대급", c: "#E67E22" },
                { s: "WGC", v: "~850t", d: "2025 대비 소폭↓\n95% CB 보유 증가", c: BLUE },
              ].map((f, i) => (
                <div key={i} style={{ background: BG_CARD_2, borderRadius: 8, padding: 12, border: `1px solid ${BORDER}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: f.c }} />
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{f.s}</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: f.c, margin: "0 0 4px" }}>{f.v}</div>
                  <div style={{ fontSize: 9, color: TEXT_SECONDARY, whiteSpace: "pre-line", lineHeight: 1.4 }}>{f.d}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: BG_CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}` }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", color: GOLD_COLOR }}>🔑 핵심 전망 근거</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
              {[
                { i: "🏦", t: "CB 구조적 매입", d: "EM CB 달러 다변화. 폴란드·체코·세르비아 명시적 확대" },
                { i: "💵", t: "화폐가치 하락", d: "미 재정적자, 글로벌 부채 증가, 달러 신뢰 약화" },
                { i: "🌍", t: "지정학 리스크", d: "미-이란, 미중 관세, 러-우. UBS: 급등시 $7,200" },
                { i: "📉", t: "Fed 인하 사이클", d: "2026 2~3회 인하 예상. 실질금리↓ → 금 보유 기회비용↓" },
              ].map((d, i) => (
                <div key={i} style={{ background: BG_CARD_2, borderRadius: 8, padding: 12, border: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{d.i}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: GOLD_COLOR, marginBottom: 4 }}>{d.t}</div>
                  <div style={{ fontSize: 10, color: TEXT_SECONDARY, lineHeight: 1.5 }}>{d.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>)}

        {/* ══════ NEWS ══════ */}
        {tab === "news" && (<div>
          <div style={{ background: BG_CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}`, marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", color: GOLD_COLOR }}>📰 Gold News Flow</h3>
            {newsItems.map((n, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: i < newsItems.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: n.color, background: `${n.color}18`, padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap", marginTop: 1, minWidth: 50, textAlign: "center" }}>{n.tag}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, lineHeight: 1.4, fontWeight: 500 }}>{n.title}</div>
                  <div style={{ fontSize: 9, color: TEXT_MUTE, marginTop: 2 }}>{n.date}</div>
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: n.impact === "↑" ? GREEN : n.impact === "↓" ? RED : TEXT_SECONDARY }}>{n.impact}</span>
              </div>
            ))}
          </div>
          <div style={{ background: BG_CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}`, marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px", color: GOLD_COLOR }}>📅 주요 이벤트</h3>
            {[
              { d: "3/2", e: "ISM 제조업 PMI (2월)", n: "금 변동성 확대 가능" },
              { d: "3/5", e: "Fed Beige Book", n: "경기 둔화 신호 → 금 강세" },
              { d: "3/17-18", e: "FOMC 회의", n: "동결 예상(98%), 성명문 주목" },
              { d: "미정", e: "WGC FY2025 최종 리포트", n: "CB 데이터 확정" },
              { d: "미정", e: "미-이란 긴장 전개", n: "에스컬레이션 시 $5,500+" },
            ].map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: BLUE, minWidth: 58 }}>{e.d}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{e.e}</div>
                  <div style={{ fontSize: 9, color: TEXT_MUTE }}>{e.n}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: BG_CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}` }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px", color: GOLD_COLOR }}>📊 센티먼트 (Kitco 2/28)</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[{ l: "Wall Street", u: 67, n: 22, d: 11 }, { l: "개인 투자자", u: 76, n: 14, d: 10 }].map((s, i) => (
                <div key={i}>
                  <div style={{ fontSize: 10, color: TEXT_SECONDARY, marginBottom: 4 }}>{s.l}</div>
                  <div style={{ display: "flex", gap: 3 }}>
                    <div style={{ flex: s.u, height: 22, background: GREEN, borderRadius: "4px 0 0 4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 }}>상승 {s.u}%</div>
                    <div style={{ flex: s.n, height: 22, background: TEXT_SECONDARY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: BG_DARK }}>{s.n}%</div>
                    <div style={{ flex: s.d, height: 22, background: RED, borderRadius: "0 4px 4px 0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 }}>{s.d}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>)}

        {/* ─── FOOTER ─── */}
        <div style={{ marginTop: 18, padding: "10px 0", borderTop: `1px solid ${BORDER}`, textAlign: "center" }}>
          <p style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", margin: 0, lineHeight: 1.5 }}>
            🐺 늑대무리원정단 | Source: WGC, IMF, JPMorgan, Goldman Sachs, UBS, SSGA, Kitco, Reuters
            <br />Data as of March 1, 2026. 투자 판단의 참고자료이며, 투자 권유가 아닙니다.
          </p>
        </div>
      </div>
    </div>
  );
}
