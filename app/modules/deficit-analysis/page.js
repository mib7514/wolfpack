"use client";
import { useState, useCallback, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";

/* ───────────────────────────────────────────
   데이터 정의
   ─────────────────────────────────────────── */

const DEFICIT_TYPES = {
  A: { label: "A. 매출총이익 적자", color: "#FF4444", bg: "#FF444420", risk: 5, reward: 1, desc: "비즈니스 모델 미작동" },
  B: { label: "B. 영업이익 적자 (GP흑자)", color: "#FFB800", bg: "#FFB80020", risk: 3, reward: 4, desc: "성장 투자 초과" },
  C: { label: "C. EBITDA 적자", color: "#FF8C00", bg: "#FF8C0020", risk: 4, reward: 3, desc: "현금 소각 상태" },
  D: { label: "D. 순이익 적자 (OP흑자)", color: "#4EA8FF", bg: "#4EA8FF20", risk: 2, reward: 4, desc: "일회성/재무구조 이슈" },
  E: { label: "E. FCF 적자 (NI흑자)", color: "#888", bg: "#88888820", risk: 2, reward: 4, desc: "대규모 Capex 사이클" },
  흑자: { label: "흑자", color: "#00CC66", bg: "#00CC6620", risk: 0, reward: 0, desc: "" },
};

const SEED_COMPANIES = [
  { rank: 1, name: "에코프로", cap: 230819, per: -1148.65, roe: -12.57, type: "B", detail: "양극재 영업손실 3145억. GP는 유지. 사이클릭 적자" },
  { rank: 2, name: "알테오젠", cap: 199577, per: 158.86, roe: 29.52, type: "흑자", detail: "ADC 플랫폼 라이선싱 흑자" },
  { rank: 3, name: "에코프로비엠", cap: 198097, per: 6328.12, roe: -6.26, type: "B", detail: "영업손실 402억이나 EBITDA 755억 흑자" },
  { rank: 4, name: "삼천당제약", cap: 179215, per: -1572.02, roe: -4.49, type: "C", detail: "GLP-1 R&D 투자 확대. Pre-revenue 파이프라인" },
  { rank: 5, name: "레인보우로보틱스", cap: 161407, per: 8320, roe: 1.62, type: "흑자", detail: "극소 흑자(PER 8320배). 로봇 초기 단계" },
  { rank: 6, name: "에이비엘바이오", cap: 105232, per: -360.42, roe: -46.01, type: "C", detail: "ADC 임상 단계. Pre-revenue 구조" },
  { rank: 7, name: "리노공업", cap: 96789, per: 64.24, roe: 19.21, type: "흑자", detail: "반도체 검사소켓. 안정 흑자" },
  { rank: 8, name: "코오롱티슈진", cap: 94080, per: -104.92, roe: -25.91, type: "C", detail: "유전자치료제 임상 비용. Pre-revenue" },
  { rank: 9, name: "리가켐바이오", cap: 72928, per: -290.38, roe: 2.04, type: "C", detail: "ADC 플랫폼. 라이선싱 일부 수익" },
  { rank: 10, name: "케어젠", cap: 69561, per: 244.34, roe: 14.35, type: "흑자", detail: "바이오 펩타이드. 흑자 고PER" },
  { rank: 11, name: "원익IPS", cap: 67638, per: 85.64, roe: 2.37, type: "흑자", detail: "반도체 장비. 사이클 회복 대기" },
  { rank: 12, name: "HLB", cap: 67624, per: -30.33, roe: -16.33, type: "C", detail: "항암제 FDA 승인 대기. 바이너리" },
  { rank: 13, name: "펩트론", cap: 61325, per: -424.88, roe: -23.46, type: "C", detail: "서방형 주사제. R&D 단계" },
  { rank: 14, name: "보로노이", cap: 60607, per: -128.11, roe: -96.66, type: "A", detail: "매출 극소 Pre-revenue 신약개발" },
  { rank: 15, name: "이오테크닉스", cap: 55808, per: 98.67, roe: 7.43, type: "흑자", detail: "레이저 장비. 흑자 유지" },
  { rank: 16, name: "ISC", cap: 44832, per: 97.06, roe: 10.98, type: "흑자", detail: "반도체 테스트 소켓. AI 수혜" },
  { rank: 17, name: "에임드바이오", cap: 42230, per: -894.52, roe: -65.72, type: "C", detail: "바이오 신약. Pre-revenue" },
  { rank: 18, name: "올릭스", cap: 41793, per: -91.63, roe: -120.11, type: "C", detail: "RNA 치료제. 극심한 현금 소각" },
  { rank: 19, name: "HPSP", cap: 40194, per: 48.14, roe: 31.09, type: "흑자", detail: "고압수소어닐링. 독점적 지위" },
  { rank: 20, name: "솔브레인", cap: 38971, per: 57.87, roe: 12.47, type: "흑자", detail: "반도체 소재. 기술 진입장벽" },
  { rank: 21, name: "메지온", cap: 38007, per: -171.6, roe: -36.23, type: "C", detail: "유데나필 FDA 승인 대기" },
  { rank: 22, name: "펄어비스", cap: 37778, per: 71.27, roe: 7.88, type: "흑자", detail: "게임(검은사막). 신작 효과 흑자" },
  { rank: 23, name: "로보티즈", cap: 36705, per: 920.96, roe: -3.31, type: "B", detail: "로봇 액추에이터. R&D 투자 영업적자" },
  { rank: 24, name: "디앤디파마텍", cap: 36526, per: -103.2, roe: -49.03, type: "C", detail: "비만/NASH 신약. Pre-revenue" },
  { rank: 25, name: "클래시스", cap: 36225, per: 30.69, roe: 26.54, type: "흑자", detail: "미용기기 볼뉴머. 고수익 안정" },
  { rank: 26, name: "파두", cap: 35507, per: -57.49, roe: -64.47, type: "A", detail: "AI SSD 컨트롤러. GP적자 가능. 양산 초기" },
  { rank: 27, name: "현대무벡스", cap: 35418, per: 140.09, roe: 16.17, type: "흑자", detail: "물류자동화/방산. 흑자" },
  { rank: 28, name: "파마리서치", cap: 34598, per: 25.6, roe: 18.93, type: "흑자", detail: "리쥬란. 고수익 안정" },
  { rank: 29, name: "유진테크", cap: 33916, per: 55.29, roe: 16.85, type: "흑자", detail: "반도체 증착장비. 국산화 수혜" },
  { rank: 30, name: "에스티팜", cap: 33243, per: 87.53, roe: 7.82, type: "흑자", detail: "올리고 CDMO. 비만치료제 수혜" },
  { rank: 31, name: "휴젤", cap: 32175, per: 22.96, roe: 17.51, type: "흑자", detail: "보톡스/필러. 해외 확대 중" },
  { rank: 32, name: "주성엔지니어링", cap: 31717, per: 50.79, roe: 19.76, type: "흑자", detail: "반도체/디스플레이 장비. 흑자" },
  { rank: 33, name: "비에이치아이", cap: 29335, per: 48.42, roe: 20.64, type: "흑자", detail: "발전설비. 방산/원전 수혜" },
  { rank: 34, name: "에스피지", cap: 29141, per: 221.96, roe: 5.54, type: "흑자", detail: "모터/로봇부품. 로봇 프리미엄" },
  { rank: 35, name: "티씨케이", cap: 29066, per: 42.57, roe: 14.78, type: "흑자", detail: "SiC 링. 독점 기술" },
  { rank: 36, name: "우리기술", cap: 28735, per: 207.59, roe: -3.33, type: "D", detail: "방산/에너지. 영업외 비용 순손실" },
  { rank: 37, name: "동진쎄미켐", cap: 28278, per: 26.69, roe: 17.17, type: "흑자", detail: "포토레지스트. 안정 흑자" },
  { rank: 38, name: "셀트리온제약", cap: 28220, per: 79.75, roe: 5.68, type: "흑자", detail: "바이오시밀러 유통. 합병 이슈" },
  { rank: 39, name: "서진시스템", cap: 27199, per: -22, roe: 12.32, type: "D", detail: "영업흑자이나 환차손/일회성으로 순손실" },
  { rank: 40, name: "성호전자", cap: 26667, per: -596.83, roe: 6.54, type: "D", detail: "본업 흑자. 영업외 일회성 순손실" },
  { rank: 41, name: "테크윙", cap: 26345, per: -219.44, roe: -10.25, type: "B", detail: "테스트 핸들러. 반도체 하강기 영업적자" },
  { rank: 42, name: "피에스케이홀딩스", cap: 25293, per: 22.23, roe: 24.8, type: "흑자", detail: "반도체 세정장비 지주. 안정 흑자" },
  { rank: 43, name: "오름테라퓨틱", cap: 24906, per: -63.99, roe: -17.5, type: "C", detail: "신약 바이오. Pre-revenue R&D" },
  { rank: 44, name: "원익홀딩스", cap: 24871, per: -197.55, roe: -7.41, type: "D", detail: "지주사. 지분법 손실/일회성 순손실" },
  { rank: 45, name: "실리콘투", cap: 24499, per: 15.42, roe: 60.9, type: "흑자", detail: "K-뷰티유통. ROE 61% 최고수익성" },
  { rank: 46, name: "하나마이크론", cap: 24014, per: 110.55, roe: -6.99, type: "D", detail: "패키징. 영업흑자이나 이자+투자비용 순손실" },
  { rank: 47, name: "에스엠", cap: 23971, per: 7.79, roe: 2.64, type: "흑자", detail: "K-POP 엔터. 흑자 저수익성" },
  { rank: 48, name: "태성", cap: 23484, per: -1147.76, roe: 16.61, type: "D", detail: "3D프린터/SW. 영업흑자 영업외 순손실" },
  { rank: 49, name: "JYP Ent.", cap: 23167, per: 14.59, roe: 22.41, type: "흑자", detail: "K-POP. 안정 흑자" },
  { rank: 50, name: "알지노믹스", cap: 22879, per: -16.46, roe: 19.81, type: "B", detail: "핵산치료제. 라이선싱 수익 < R&D 비용" },
];

/* ───────────────────────────────────────────
   Top 10: 펀더멘탈(80) + 모멘텀(20) = 100점
   모멘텀 데이터는 2026.03.06 기준 수동 입력
   (향후 API 연동 시 자동화 가능)
   ─────────────────────────────────────────── */

const TOP10_DEFICIT = [
  { rank: 1, name: "서진시스템", code: "178320", type: "D", fundScore: 76, reason: "영업이익 흑자(ROE 12.3%) + 일회성 환차손 제거 시 즉시 흑전", catalyst: "환율 안정/일회성 비용 소멸",
    momentum: { pct52wHigh: 0.78, maAlign: "partial", ma120dir: "up", volRatio: 1.2 } },
  { rank: 2, name: "에코프로비엠", code: "247540", type: "B", fundScore: 72, reason: "EBITDA 755억 흑자. 본업 적자 축소 중. 2차전지 사이클 회복 시 가장 큰 레버리지", catalyst: "양극재 출하량 회복 + ASP 반등",
    momentum: { pct52wHigh: 0.82, maAlign: "full", ma120dir: "up", volRatio: 1.5 } },
  { rank: 3, name: "에코프로", code: "086520", type: "B", fundScore: 70, reason: "에코프로비엠 연결 효과. 2025년 흑자전환 목표. 인니 투자 + 원가혁신 진행", catalyst: "자회사 실적 턴어라운드",
    momentum: { pct52wHigh: 0.85, maAlign: "full", ma120dir: "up", volRatio: 1.8 } },
  { rank: 4, name: "태성", code: "045390", type: "D", fundScore: 74, reason: "ROE 16.6%로 본업 우수. 영업외 비용만 제거하면 즉시 정상화", catalyst: "영업외 비용 정상화",
    momentum: { pct52wHigh: 0.65, maAlign: "none", ma120dir: "flat", volRatio: 0.9 } },
  { rank: 5, name: "테크윙", code: "089030", type: "B", fundScore: 62, reason: "반도체 테스트 핸들러 기술력. 사이클 하강기 일시적 적자", catalyst: "반도체 사이클 상승 전환",
    momentum: { pct52wHigh: 0.60, maAlign: "partial", ma120dir: "down", volRatio: 2.1 } },
  { rank: 6, name: "성호전자", code: "043260", type: "D", fundScore: 68, reason: "ROE 6.5% 양호. 본업 건강하나 일회성 비용", catalyst: "일회성 비용 소멸",
    momentum: { pct52wHigh: 0.72, maAlign: "partial", ma120dir: "up", volRatio: 1.4 } },
  { rank: 7, name: "로보티즈", code: "108490", type: "B", fundScore: 64, reason: "로봇 액추에이터 선도. GP 흑자 확인. 삼성 로봇 수혜 기대", catalyst: "로봇 양산 주문 확보",
    momentum: { pct52wHigh: 0.55, maAlign: "none", ma120dir: "down", volRatio: 0.8 } },
  { rank: 8, name: "하나마이크론", code: "067310", type: "D", fundScore: 60, reason: "반도체 패키징 영업흑자. 이자비용 구조 개선 시 순이익 전환", catalyst: "차입금 축소 / 금리 하락",
    momentum: { pct52wHigh: 0.58, maAlign: "partial", ma120dir: "flat", volRatio: 1.1 } },
  { rank: 9, name: "알지노믹스", code: "536560", type: "B", fundScore: 58, reason: "핵산치료제 라이선싱 수익 발생 중. 파이프라인 가치 인정", catalyst: "추가 라이선싱 딜",
    momentum: { pct52wHigh: 0.90, maAlign: "full", ma120dir: "up", volRatio: 1.6 } },
  { rank: 10, name: "원익홀딩스", code: "030530", type: "D", fundScore: 55, reason: "원익IPS 등 자회사 가치. 지분법 손실이 주원인", catalyst: "자회사 실적 개선",
    momentum: { pct52wHigh: 0.62, maAlign: "partial", ma120dir: "up", volRatio: 1.3 } },
];

// 모멘텀 스코어 계산 (최대 20점)
function calcMomentum(m) {
  if (!m) return 0;
  // ① 52주고가 근접도 (0~6점): 비율 × 6, 90%이상 만점
  const s1 = Math.min(6, Math.round(m.pct52wHigh * 6 * 10) / 10);
  // ② 이평선 정배열 (0~6점): full=6, partial=3, none=0
  const s2 = m.maAlign === "full" ? 6 : m.maAlign === "partial" ? 3 : 0;
  // ③ 120일선 방향 (-3~4점): up=+4, flat=0, down=-3
  const s3 = m.ma120dir === "up" ? 4 : m.ma120dir === "flat" ? 0 : -3;
  // ④ 거래량 모멘텀 (0~4점): 5일/20일 비율 기반, cap at 4
  const s4 = Math.min(4, Math.round(Math.max(0, (m.volRatio - 0.8)) * 5 * 10) / 10);
  return Math.round((s1 + s2 + s3 + s4) * 10) / 10;
}

// 초기 스코어 계산 (기본 모멘텀 데이터 기반)
const INITIAL_TOP10 = TOP10_DEFICIT.map((c) => {
  const momScore = calcMomentum(c.momentum);
  return { ...c, momScore, totalScore: c.fundScore + momScore };
}).sort((a, b) => b.totalScore - a.totalScore).map((c, i) => ({ ...c, rank: i + 1 }));

/* ───────────────────────────────────────────
   ETF: 가중 노출도 기반 매칭
   코스닥150은 유동시가총액 가중 → 시총 비중으로 추산
   테마 ETF는 공시 편입비중 기반
   ─────────────────────────────────────────── */

const ETF_DATA = [
  {
    name: "KODEX 코스닥150", code: "229200", aum: "7.5조", fee: "0.20%",
    note: "코스닥 대표 150종목. 시총 가중",
    // 코스닥150 전체 시총 대비 Top10 종목 비중 (유동시총 추산)
    holdings: [
      { name: "에코프로", weight: 8.2 },
      { name: "에코프로비엠", weight: 7.0 },
      { name: "로보티즈", weight: 1.3 },
      { name: "테크윙", weight: 0.9 },
      { name: "서진시스템", weight: 1.0 },
      { name: "원익홀딩스", weight: 0.9 },
      { name: "하나마이크론", weight: 0.8 },
      { name: "성호전자", weight: 0.9 },
      { name: "태성", weight: 0.8 },
      { name: "알지노믹스", weight: 0.8 },
    ],
  },
  {
    name: "KODEX 2차전지산업", code: "305720", aum: "8,500억", fee: "0.45%",
    note: "2차전지 밸류체인 25종목. 키워드+시총 가중. 최대 편입 20% 캡",
    holdings: [
      { name: "에코프로비엠", weight: 12.5 },
      { name: "에코프로", weight: 8.0 },
    ],
  },
  {
    name: "TIGER 코스닥150", code: "232080", aum: "1.3조", fee: "0.19%",
    note: "KODEX와 동일 지수. 수수료 소폭 저렴",
    holdings: [
      { name: "에코프로", weight: 8.2 },
      { name: "에코프로비엠", weight: 7.0 },
      { name: "로보티즈", weight: 1.3 },
      { name: "테크윙", weight: 0.9 },
      { name: "서진시스템", weight: 1.0 },
      { name: "원익홀딩스", weight: 0.9 },
      { name: "하나마이크론", weight: 0.8 },
      { name: "성호전자", weight: 0.9 },
      { name: "태성", weight: 0.8 },
      { name: "알지노믹스", weight: 0.8 },
    ],
  },
  {
    name: "KODEX 코스닥150IT", code: "261060", aum: "1,100억", fee: "0.25%",
    note: "코스닥 IT 섹터 집중. 반도체/전자 비중 높음",
    holdings: [
      { name: "테크윙", weight: 3.8 },
      { name: "서진시스템", weight: 3.5 },
      { name: "하나마이크론", weight: 3.2 },
      { name: "원익홀딩스", weight: 3.0 },
      { name: "태성", weight: 2.8 },
    ],
  },
  {
    name: "TIGER 코리아휴머노이드로봇", code: "490600", aum: "2,800억", fee: "0.45%",
    note: "휴머노이드 로봇 산업 집중. 레인보우로보틱스 15.7%",
    holdings: [
      { name: "로보티즈", weight: 10.9 },
    ],
  },
  {
    name: "TIGER 코스닥150바이오테크", code: "261070", aum: "3,200억", fee: "0.40%",
    note: "코스닥 바이오 섹터 집중",
    holdings: [
      { name: "알지노믹스", weight: 2.5 },
    ],
  },
];

// ETF 가중노출도 계산 (top10 리스트를 파라미터로 받아 동적 계산)
function calcETFScores(top10Scored) {
  return ETF_DATA.map((etf) => {
    const top10Names = new Set(top10Scored.map((c) => c.name));
    const matchedHoldings = etf.holdings.filter((h) => top10Names.has(h.name));
    const totalExposure = matchedHoldings.reduce((sum, h) => sum + h.weight, 0);
    const qualityExposure = matchedHoldings.reduce((sum, h) => {
      const comp = top10Scored.find((c) => c.name === h.name);
      return sum + h.weight * (comp ? comp.totalScore / 100 : 0);
    }, 0);
    return { ...etf, matchedHoldings, totalExposure: Math.round(totalExposure * 10) / 10, qualityExposure: Math.round(qualityExposure * 10) / 10, matchCount: matchedHoldings.length };
  }).sort((a, b) => b.totalExposure - a.totalExposure);
}

/* ───────────────────────────────────────────
   유틸 컴포넌트
   ─────────────────────────────────────────── */

function Stars({ count, max = 5, color = "#FFB800" }) {
  return (
    <span>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ color: i < count ? color : "#333", fontSize: 14 }}>★</span>
      ))}
    </span>
  );
}

function TypeBadge({ type }) {
  const t = DEFICIT_TYPES[type];
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 4,
      fontSize: 11, fontWeight: 700, color: t.color, background: t.bg,
      border: `1px solid ${t.color}40`, whiteSpace: "nowrap",
    }}>
      {type === "흑자" ? "흑자" : type}
    </span>
  );
}

function MomentumBadge({ m }) {
  if (!m) return null;
  const labels = [];
  if (m.maAlign === "full") labels.push({ text: "정배열", color: "#00CC66" });
  else if (m.maAlign === "partial") labels.push({ text: "부분정배열", color: "#FFB800" });
  else labels.push({ text: "역배열", color: "#FF4444" });

  if (m.ma120dir === "up") labels.push({ text: "120▲", color: "#00CC66" });
  else if (m.ma120dir === "down") labels.push({ text: "120▼", color: "#FF4444" });

  if (m.pct52wHigh >= 0.9) labels.push({ text: "52w高", color: "#FFB800" });
  if (m.volRatio >= 1.5) labels.push({ text: "거래↑", color: "#4EA8FF" });

  return (
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
      {labels.map((l, i) => (
        <span key={i} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: l.color + "20", color: l.color, border: `1px solid ${l.color}30`, fontWeight: 600 }}>
          {l.text}
        </span>
      ))}
    </div>
  );
}

/* ───────────────────────────────────────────
   메인 페이지
   ─────────────────────────────────────────── */

export default function DeficitAnalysisPage() {
  const [activeTab, setActiveTab] = useState("top10");
  const [aiLoading, setAiLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [filterType, setFilterType] = useState("ALL");
  const [expandedRow, setExpandedRow] = useState(null);
  const [sortBy, setSortBy] = useState("rank");
  const [top10Data, setTop10Data] = useState(INITIAL_TOP10);
  const [lastUpdate, setLastUpdate] = useState("2026.03.06 (초기 수동 데이터)");
  const [companies, setCompanies] = useState(SEED_COMPANIES);

  // Supabase에서 기업 목록 로드
  useEffect(() => {
    async function loadCompanies() {
      try {
        const { data, error } = await supabase
          .from("deficit_companies")
          .select("*")
          .order("rank", { ascending: true });
        if (!error && data && data.length > 0) {
          setCompanies(data);
          setLastUpdate(data[0]?.updated_at?.split("T")[0] || lastUpdate);
        }
      } catch (e) {
        console.log("Supabase 로드 실패, 시드 데이터 사용");
      }
    }
    loadCompanies();
  }, []);

  // 150종목 스캔 (3배치 × 50개)
  const handleScan = useCallback(async () => {
    setScanLoading(true);
    setAiResult(null);
    const batches = [[1, 50], [51, 100], [101, 150]];
    const allCompanies = [];
    const errors = [];

    for (let i = 0; i < batches.length; i++) {
      const [start, end] = batches[i];
      setAiResult(`🔍 스캔 중... ${i + 1}/3 단계 (${start}~${end}위) — ${allCompanies.length}개 완료`);
      try {
        const res = await fetch("/api/deficit-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startRank: start, endRank: end }),
        });
        const data = await res.json();
        if (data.ok && data.companies) {
          allCompanies.push(...data.companies);
        } else {
          errors.push(`${start}-${end}: ${data.error || "실패"}`);
        }
      } catch (e) {
        errors.push(`${start}-${end}: ${e.message}`);
      }
    }

    if (allCompanies.length > 0) {
      // 시총 기준 재정렬
      allCompanies.sort((a, b) => (b.cap || 0) - (a.cap || 0));
      allCompanies.forEach((c, idx) => { c.rank = idx + 1; });
      setCompanies(allCompanies);
      setLastUpdate(new Date().toISOString().split("T")[0]);
      setAiResult(`✅ 스캔 완료! ${allCompanies.length}개 종목 로드됨` + (errors.length ? `\n⚠️ 일부 오류: ${errors.join(", ")}` : ""));
    } else {
      setAiResult(`❌ 스캔 실패: ${errors.join(", ")}`);
    }
    setScanLoading(false);
  }, []);

  // ETF 스코어를 top10 변경 시 자동 재계산
  const etfScored = useMemo(() => calcETFScores(top10Data), [top10Data]);

  const handleAiUpdate = useCallback(async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const top10Names = TOP10_DEFICIT.map(c => c.name);
      const top10Codes = {};
      TOP10_DEFICIT.forEach(c => { if (c.code) top10Codes[c.name] = c.code; });
      const res = await fetch("/api/deficit-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: top10Names, codes: top10Codes }),
      });
      const data = await res.json();

      // 뉴스 결과
      const newsText = data.news || data.error || "업데이트 완료";

      // 모멘텀 데이터가 있으면 Top10 스코어 재계산
      if (data.momentum && Array.isArray(data.momentum)) {
        const updatedTop10 = TOP10_DEFICIT.map((c) => {
          const apiData = data.momentum.find((m) => m.name === c.name);
          let momentum = c.momentum; // 기본값 유지
          if (apiData && !apiData.error) {
            momentum = {
              pct52wHigh: apiData.pct52wHigh / 100, // API는 %로 반환
              maAlign: apiData.maAlign,
              ma120dir: apiData.ma120dir,
              volRatio: apiData.volRatio,
              // 원본 데이터도 보관
              currentPrice: apiData.currentPrice,
              high52w: apiData.high52w,
              ma20: apiData.ma20,
              ma60: apiData.ma60,
              ma120: apiData.ma120,
            };
          }
          const momScore = calcMomentum(momentum);
          return { ...c, momentum, momScore, totalScore: c.fundScore + momScore };
        }).sort((a, b) => b.totalScore - a.totalScore).map((c, i) => ({ ...c, rank: i + 1 }));

        setTop10Data(updatedTop10);
        setLastUpdate(data.dataDate || new Date().toISOString().split("T")[0]);

        // 모멘텀 변동 요약 생성
        const momSummary = updatedTop10.slice(0, 5).map((c) =>
          `${c.rank}위 ${c.name}: 총점 ${c.totalScore} (펀더${c.fundScore} + 모멘${c.momScore})`
        ).join("\n");

        setAiResult(`📊 모멘텀 데이터 업데이트 완료 (${data.dataDate || "today"})\n\n` +
          `[Top 5 순위 변동]\n${momSummary}\n\n` +
          `[최신 뉴스]\n${newsText}`);
      } else {
        setAiResult(newsText);
      }
    } catch (e) {
      setAiResult("API 호출 오류: " + e.message);
    }
    setAiLoading(false);
  }, []);

  const typeDistribution = {};
  companies.forEach((c) => {
    typeDistribution[c.type] = (typeDistribution[c.type] || 0) + 1;
  });

  const filtered = filterType === "ALL" ? companies : companies.filter((c) => c.type === filterType);
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "rank") return a.rank - b.rank;
    if (sortBy === "cap") return b.cap - a.cap;
    if (sortBy === "type") return a.type.localeCompare(b.type);
    return 0;
  });

  return (
    <div className="min-h-screen bg-[#0A0E17] text-[#E0E4EC]" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>

      {/* ── 헤더 ── */}
      <div className="px-7 pt-6 pb-0 border-b border-[#1E2636]">
        <div className="flex justify-between items-start flex-wrap gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <a href="/" className="text-sm text-[#5A6478] hover:text-[#4EA8FF] transition">← 컨트롤타워</a>
            </div>
            <h1 className="text-xl font-black bg-gradient-to-r from-[#4EA8FF] to-[#FFB800] bg-clip-text text-transparent">
              🐺 적자기업 투자분석
            </h1>
            <p className="text-xs text-[#5A6478] mt-1">코스닥 시총 상위 150개 · 적자유형 분류 → 펀더멘탈(80) + 모멘텀(20) 스코어링 → 가중 ETF 매칭 · <span className="text-[#4EA8FF] font-mono">최종 업데이트: {lastUpdate}</span></p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleScan} disabled={scanLoading || aiLoading}
              className="px-4 py-2.5 rounded-lg border border-[#FFB80050] font-bold text-sm text-[#FFB800] transition
                         bg-gradient-to-br from-[#2D1F00] to-[#3D2A00]
                         hover:border-[#FFB800] hover:shadow-[0_0_20px_#FFB80030]
                         disabled:opacity-50 disabled:cursor-wait flex items-center gap-2">
              {scanLoading ? "🔍 스캔 중..." : "🔍 150종목 스캔"}
            </button>
            <button onClick={handleAiUpdate} disabled={aiLoading || scanLoading}
              className="px-4 py-2.5 rounded-lg border border-[#4EA8FF50] font-bold text-sm text-[#4EA8FF] transition
                         bg-gradient-to-br from-[#0D2847] to-[#132E52]
                         hover:from-[#133058] hover:to-[#1A3D6A] hover:border-[#4EA8FF] hover:shadow-[0_0_20px_#4EA8FF30]
                         disabled:opacity-50 disabled:cursor-wait flex items-center gap-2">
              {aiLoading ? "⚡ AI 분석 중..." : "⚡ Top10 업데이트"}
            </button>
          </div>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-transparent via-[#4EA8FF] to-transparent opacity-60" />
      </div>

      {aiResult && (
        <div className="mx-7 mt-4 p-4 bg-[#0D2847] border border-[#4EA8FF30] rounded-lg">
          <div className="text-xs font-bold text-[#4EA8FF] mb-2">⚡ AI 업데이트 결과</div>
          <div className="text-xs text-[#A0B0CC] leading-relaxed whitespace-pre-wrap">{aiResult}</div>
          <button onClick={() => setAiResult(null)} className="mt-2 text-[11px] text-[#5A6478] hover:text-[#8892A4]">닫기 ×</button>
        </div>
      )}

      {/* ── 분포 요약 ── */}
      <div className="flex gap-2 px-7 py-4 overflow-x-auto flex-wrap">
        {Object.entries(DEFICIT_TYPES).map(([key, val]) => (
          <div key={key} className="px-4 py-2.5 rounded-lg min-w-[90px] text-center"
            style={{ background: val.bg, border: `1px solid ${val.color}30` }}>
            <div className="text-xl font-black font-mono" style={{ color: val.color }}>{typeDistribution[key] || 0}</div>
            <div className="text-[10px] font-semibold opacity-80" style={{ color: val.color }}>{key === "흑자" ? "흑자" : key}</div>
          </div>
        ))}
      </div>

      {/* ── 탭 ── */}
      <div className="flex gap-2 px-7 pb-4 overflow-x-auto">
        {[
          { id: "top10", label: "🎯 위험대비 수익 Top 10" },
          { id: "all", label: `📊 전체 ${companies.length}종목` },
          { id: "etf", label: "💼 ETF 매칭" },
          { id: "framework", label: "📋 적자유형 프레임워크" },
        ].map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-md text-xs font-semibold border transition whitespace-nowrap
              ${activeTab === t.id
                ? "bg-gradient-to-br from-[#1A3A5C] to-[#162D4A] text-[#4EA8FF] border-[#4EA8FF40]"
                : "bg-transparent text-[#8892A4] border-[#1E2636] hover:bg-[#1A2030] hover:text-[#C0C8D8]"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-7 pb-10">

        {/* ════════ Top 10 탭 ════════ */}
        {activeTab === "top10" && (
          <div>
            {/* 스코어링 설명 */}
            <div className="bg-[#111827] border border-[#1E2636] rounded-lg p-5 mb-4">
              <div className="text-sm font-bold text-[#FFB800] mb-2">스코어링 구조: 펀더멘탈(80) + 모멘텀(20) = 100</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#8892A4] leading-relaxed">
                <div>
                  <div className="text-[#E0E4EC] font-bold mb-1">펀더멘탈 (80점)</div>
                  <p>적자 유형 매력도, ROE 수준, 흑자전환 거리, 촉매 확실성, 재무안정성</p>
                </div>
                <div>
                  <div className="text-[#E0E4EC] font-bold mb-1">모멘텀 (20점)</div>
                  <div className="space-y-0.5">
                    <p>52주 고가 근접도 <span className="font-mono text-[#5A6478]">(0~6점)</span> — 현재가/52주고가 × 6</p>
                    <p>이평선 정배열 <span className="font-mono text-[#5A6478]">(0~6점)</span> — 20&gt;60&gt;120 정배열 6, 부분 3</p>
                    <p>120일선 방향 <span className="font-mono text-[#5A6478]">(-3~+4점)</span> — 상승 +4, 하락 -3</p>
                    <p>거래량 모멘텀 <span className="font-mono text-[#5A6478]">(0~4점)</span> — 5일/20일 거래량 비율</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 리스트 */}
            <div className="bg-[#111827] border border-[#1E2636] rounded-lg overflow-hidden">
              {top10Data.map((c, i) => (
                <div key={c.name} className="px-5 py-4 border-b border-[#1E2636] hover:bg-[#151D2C] transition">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className={`font-mono text-lg font-black min-w-[30px] ${i < 3 ? "text-[#FFB800]" : "text-[#5A6478]"}`}>
                      {String(c.rank).padStart(2, "0")}
                    </span>
                    <span className="text-sm font-bold">{c.name}</span>
                    <TypeBadge type={c.type} />
                    <MomentumBadge m={c.momentum} />
                    <div className="flex-1" />
                    {/* 스코어 바 */}
                    <div className="w-36 flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-[#1E2636] overflow-hidden flex">
                        <div className="h-full" style={{ width: `${(c.fundScore / 100) * 100}%`, background: "#4EA8FF" }} />
                        <div className="h-full" style={{ width: `${(Math.max(0, c.momScore) / 100) * 100}%`, background: "#FFB800" }} />
                      </div>
                      <span className={`font-mono text-sm font-bold min-w-[35px] text-right ${c.totalScore >= 85 ? "text-[#FFB800]" : "text-[#4EA8FF]"}`}>
                        {c.totalScore}
                      </span>
                    </div>
                  </div>
                  {/* 점수 내역 */}
                  <div className="ml-[42px] flex gap-4 text-[10px] text-[#5A6478] mb-1 font-mono flex-wrap">
                    <span>펀더: <span className="text-[#4EA8FF]">{c.fundScore}</span></span>
                    <span>모멘: <span className="text-[#FFB800]">{c.momScore > 0 ? "+" : ""}{c.momScore}</span></span>
                    <span>52w: <span className="text-[#8892A4]">{Math.round(c.momentum.pct52wHigh * 100)}%</span></span>
                    <span>Vol: <span className="text-[#8892A4]">{c.momentum.volRatio}x</span></span>
                    {c.momentum.currentPrice && (
                      <>
                        <span>현재가: <span className="text-[#E0E4EC]">{Number(c.momentum.currentPrice).toLocaleString()}원</span></span>
                        <span>MA20/60/120: <span className="text-[#8892A4]">{Number(c.momentum.ma20||0).toLocaleString()}/{Number(c.momentum.ma60||0).toLocaleString()}/{Number(c.momentum.ma120||0).toLocaleString()}</span></span>
                      </>
                    )}
                  </div>
                  <div className="text-[11px] text-[#8892A4] ml-[42px] leading-relaxed">{c.reason}</div>
                  <div className="text-[10px] text-[#4EA8FF] ml-[42px] mt-1">📌 촉매: {c.catalyst}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════ 전체 50종목 탭 ════════ */}
        {activeTab === "all" && (
          <div>
            <div className="flex gap-1.5 mb-3 flex-wrap">
              <button onClick={() => setFilterType("ALL")}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition
                  ${filterType === "ALL" ? "bg-[#4EA8FF20] text-[#4EA8FF] border-[#4EA8FF60]" : "bg-transparent text-[#8892A4] border-[#1E2636]"}`}>
                전체 ({companies.length})
              </button>
              {Object.entries(DEFICIT_TYPES).map(([key, val]) => (
                <button key={key} onClick={() => setFilterType(key)}
                  className="px-3 py-1 rounded-full text-[11px] font-semibold border transition"
                  style={filterType === key ? { background: val.bg, color: val.color, borderColor: val.color + "60" } : { background: "transparent", color: "#8892A4", borderColor: "#1E2636" }}>
                  {key === "흑자" ? "흑자" : key} ({typeDistribution[key] || 0})
                </button>
              ))}
            </div>
            <div className="bg-[#111827] border border-[#1E2636] rounded-lg overflow-auto max-h-[70vh]">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {[
                      { key: "rank", label: "#" }, { key: "name", label: "종목명", align: "left" },
                      { key: "cap", label: "시총(억)" }, { key: "per", label: "PER" }, { key: "roe", label: "ROE(%)" },
                      { key: "type", label: "유형" }, { key: "detail", label: "분류 근거", align: "left" },
                    ].map((h) => (
                      <th key={h.key}
                        onClick={() => ["rank", "cap", "type"].includes(h.key) && setSortBy(h.key)}
                        className={`px-2 py-2.5 text-[11px] font-bold border-b-2 border-[#1E2636] sticky top-0 bg-[#111827] z-10 whitespace-nowrap
                          ${["rank", "cap", "type"].includes(h.key) ? "cursor-pointer hover:text-[#4EA8FF]" : ""}
                          ${sortBy === h.key ? "text-[#4EA8FF]" : "text-[#6B7894]"}`}
                        style={{ textAlign: h.align || "center" }}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c) => (
                    <tr key={c.rank} onClick={() => setExpandedRow(expandedRow === c.rank ? null : c.rank)}
                      className="hover:bg-[#151D2C] cursor-pointer transition">
                      <td className="px-2 py-2.5 text-center font-mono text-[11px] text-[#5A6478] border-b border-[#151D2C]">{c.rank}</td>
                      <td className="px-2 py-2.5 text-left font-semibold text-xs border-b border-[#151D2C]">{c.name}</td>
                      <td className="px-2 py-2.5 text-center font-mono text-[11px] border-b border-[#151D2C]">{(c.cap / 10000).toFixed(1)}조</td>
                      <td className={`px-2 py-2.5 text-center font-mono text-[11px] border-b border-[#151D2C] ${c.per < 0 ? "text-[#FF4444]" : c.per > 100 ? "text-[#FFB800]" : "text-[#8892A4]"}`}>
                        {c.per > 999 ? "999+" : c.per < -999 ? "-999" : c.per.toFixed(1)}
                      </td>
                      <td className={`px-2 py-2.5 text-center font-mono text-[11px] border-b border-[#151D2C] ${c.roe < 0 ? "text-[#FF4444]" : "text-[#00CC66]"}`}>
                        {c.roe.toFixed(1)}
                      </td>
                      <td className="px-2 py-2.5 text-center border-b border-[#151D2C]"><TypeBadge type={c.type} /></td>
                      <td className="px-2 py-2.5 text-left text-[11px] text-[#6B7894] border-b border-[#151D2C] max-w-[280px]">
                        {expandedRow === c.rank ? c.detail : c.detail.slice(0, 30) + (c.detail.length > 30 ? "..." : "")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════ ETF 매칭 탭 ════════ */}
        {activeTab === "etf" && (
          <div>
            <div className="bg-[#111827] border border-[#1E2636] rounded-lg p-5 mb-4">
              <div className="text-sm font-bold text-[#4EA8FF] mb-2">ETF 가중 노출도 매칭</div>
              <div className="text-xs text-[#8892A4] leading-relaxed">
                단순 편입 종목 수가 아니라 <span className="text-[#FFB800] font-bold">Top10 적자기업에 실질적으로 몇 %나 노출되는지</span>를 기준으로 순위화.
                1억 투자 시 Top10 기업에 합산 얼마나 배분되는지 = <span className="text-[#4EA8FF] font-bold">가중 노출도</span>.
                추가로 종목별 스코어를 반영한 <span className="text-[#00CC66] font-bold">품질 가중 노출도</span>도 함께 표시.
              </div>
            </div>

            <div className="bg-[#111827] border border-[#1E2636] rounded-lg overflow-hidden">
              {/* 헤더 */}
              <div className="grid gap-3 px-4 py-3 text-[11px] font-bold text-[#6B7894] border-b-2 border-[#1E2636]"
                style={{ gridTemplateColumns: "2fr 80px 80px 70px 60px 3fr" }}>
                <span>ETF명</span>
                <span className="text-center">가중노출</span>
                <span className="text-center">품질가중</span>
                <span className="text-center">AUM</span>
                <span className="text-center">보수</span>
                <span>편입 종목 (비중%)</span>
              </div>
              {etfScored.map((etf) => (
                <div key={etf.code} className="grid gap-3 px-4 py-3.5 border-b border-[#1E2636] items-center text-xs hover:bg-[#1A2030] transition"
                  style={{ gridTemplateColumns: "2fr 80px 80px 70px 60px 3fr" }}>
                  <div>
                    <div className="font-bold text-sm">{etf.name}</div>
                    <div className="text-[10px] text-[#5A6478] font-mono">{etf.code}</div>
                  </div>
                  <div className="text-center">
                    <span className={`font-mono text-lg font-black ${etf.totalExposure >= 15 ? "text-[#FFB800]" : etf.totalExposure >= 5 ? "text-[#4EA8FF]" : "text-[#5A6478]"}`}>
                      {etf.totalExposure}%
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="font-mono text-sm font-bold text-[#00CC66]">{etf.qualityExposure}</span>
                  </div>
                  <div className="text-center font-mono text-[#8892A4]">{etf.aum}</div>
                  <div className="text-center font-mono text-[#8892A4]">{etf.fee}</div>
                  <div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {etf.matchedHoldings.sort((a, b) => b.weight - a.weight).map((h) => {
                        const comp = top10Data.find((c) => c.name === h.name);
                        const dt = comp ? DEFICIT_TYPES[comp.type] : DEFICIT_TYPES["흑자"];
                        return (
                          <span key={h.name} className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                            style={{ background: dt.bg, color: dt.color, border: `1px solid ${dt.color}30` }}>
                            {h.name} <span className="opacity-70">{h.weight}%</span>
                          </span>
                        );
                      })}
                    </div>
                    <div className="text-[10px] text-[#5A6478]">{etf.note}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 전략 제안 */}
            <div className="bg-[#111827] border border-[#1E2636] rounded-lg p-5 mt-4">
              <div className="text-sm font-bold text-[#FFB800] mb-2">💡 전략 제안</div>
              <div className="text-xs text-[#8892A4] leading-relaxed space-y-1">
                <p><strong className="text-[#E0E4EC]">Core (60%)</strong>: KODEX/TIGER 코스닥150 — 가중노출 22.6%. 10종목 전부 자연 편입</p>
                <p><strong className="text-[#E0E4EC]">Satellite (25%)</strong>: KODEX 2차전지산업 — 에코프로+비엠 합산 20.5%. B유형 집중 베팅</p>
                <p><strong className="text-[#E0E4EC]">Alpha (15%)</strong>: 서진시스템·태성 직접 매수 — D유형 고점수 종목 오버웨이트. 코스닥150 편입비중(0.8~1.0%)으로는 부족</p>
              </div>
            </div>
          </div>
        )}

        {/* ════════ 프레임워크 탭 ════════ */}
        {activeTab === "framework" && (
          <div className="space-y-3">
            {Object.entries(DEFICIT_TYPES).filter(([k]) => k !== "흑자").map(([key, val]) => (
              <div key={key} className="bg-[#111827] border border-[#1E2636] rounded-lg p-5" style={{ borderLeftWidth: 3, borderLeftColor: val.color }}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-base font-black" style={{ color: val.color }}>{val.label}</span>
                  <span className="text-[11px] text-[#5A6478]">— {val.desc}</span>
                </div>
                <div className="flex gap-6 mb-3 flex-wrap">
                  <div><span className="text-[10px] text-[#5A6478]">위험도</span> <Stars count={val.risk} color="#FF4444" /></div>
                  <div><span className="text-[10px] text-[#5A6478]">기대수익</span> <Stars count={val.reward} color="#00CC66" /></div>
                  <div><span className="text-[10px] text-[#5A6478]">비대칭 매력</span> <Stars count={Math.max(0, val.reward - val.risk + 3)} color="#FFB800" /></div>
                </div>
                <div className="text-xs text-[#8892A4] leading-relaxed">
                  {key === "A" && "팔수록 손해나는 구조. 원가 > 매출. 규모 확장이 적자를 키움. 예외: 전략적 원가미달 판매(쿠팡 초기), 양산 초기 수율 이슈. 핵심: 분기별 Unit Economics 개선 추세 존재 여부."}
                  {key === "B" && "제품 자체 마진은 나지만 R&D/마케팅/인력 투자가 초과. 가장 비대칭적 수익 기회. 체크: 투자성 비용 vs 유지성 비용, 매출 성장률 > 판관비 증가율, GP마진 30%+, 영업레버리지 전환점."}
                  {key === "C" && "감가상각 전에도 적자. 사업이 현금을 태우는 상태. Cash Burn Rate 대비 보유현금(Runway)이 관건. 바이오텍 집중. 바이너리 분포. 바구니 접근 필수."}
                  {key === "D" && "본업은 흑자이나 이자비용/환차손/일회성 충당금으로 순적자. 가장 해석하기 쉽고 가장 빠른 리레이팅 기대. 단, '일회성'이 3년 연속이면 상시적 비효율."}
                  {key === "E" && "회계상 흑자이나 대규모 Capex로 현금 유출. 성장 Capex vs 유지보수 Capex 구분이 핵심. 투자 사이클 완료 시 현금흐름 폭발적 개선. 반도체 설비투자기에 전형적."}
                </div>
                <div className="mt-2 text-[11px] text-[#5A6478]">
                  해당 기업: {companies.filter((c) => c.type === key).map((c) => c.name).join(", ") || "해당 없음 (코스닥 시총 상위 150 내)"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 푸터 ── */}
      <div className="px-7 py-4 border-t border-[#1E2636] text-center">
        <div className="text-[10px] text-[#3A4458]">
          늑대무리원정단 · 적자기업 투자분석 모듈 · 모멘텀 데이터: {lastUpdate} · ⚡ AI 업데이트로 실시간 갱신 가능 · 투자 판단은 본인 책임
        </div>
      </div>
    </div>
  );
}
