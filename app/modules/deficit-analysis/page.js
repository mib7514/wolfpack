"use client";
import { useState, useCallback } from "react";

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

const COMPANIES = [
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

const TOP10_DEFICIT = [
  { rank: 1, name: "서진시스템", type: "D", score: 92, reason: "영업이익 흑자(ROE 12.3%) + 일회성 환차손 제거 시 즉시 흑전. 리레이팅 거리 가장 짧음", catalyst: "환율 안정/일회성 비용 소멸" },
  { rank: 2, name: "태성", type: "D", score: 90, reason: "ROE 16.6%로 본업 우수. 영업외 비용만 제거하면 즉시 정상화. 3D프린팅/시뮬레이션 성장", catalyst: "영업외 비용 정상화" },
  { rank: 3, name: "에코프로비엠", type: "B", score: 87, reason: "EBITDA 755억 흑자. 본업 적자 축소 중. 2차전지 사이클 회복 시 가장 큰 레버리지", catalyst: "양극재 출하량 회복 + ASP 반등" },
  { rank: 4, name: "에코프로", type: "B", score: 85, reason: "에코프로비엠 연결 효과. 2025년 흑자전환 목표. 인니 투자 + 원가혁신 진행", catalyst: "자회사 실적 턴어라운드" },
  { rank: 5, name: "성호전자", type: "D", score: 83, reason: "ROE 6.5% 양호. 본업 건강하나 일회성 비용. 전장부품 성장 구간", catalyst: "일회성 비용 소멸" },
  { rank: 6, name: "테크윙", type: "B", score: 80, reason: "반도체 테스트 핸들러 기술력. 사이클 하강기 일시적 적자. HBM 수혜 기대", catalyst: "반도체 사이클 상승 전환" },
  { rank: 7, name: "로보티즈", type: "B", score: 78, reason: "로봇 액추에이터 선도. GP 흑자 확인. R&D 투자기이나 삼성 로봇 수혜 기대", catalyst: "로봇 양산 주문 확보" },
  { rank: 8, name: "하나마이크론", type: "D", score: 75, reason: "반도체 패키징 영업흑자. 이자비용 구조만 개선되면 순이익 전환. HBM 패키징 수혜", catalyst: "차입금 축소 / 금리 하락" },
  { rank: 9, name: "알지노믹스", type: "B", score: 73, reason: "핵산치료제 라이선싱 수익 발생 중. R&D 비용 초과이나 파이프라인 가치 인정", catalyst: "추가 라이선싱 딜" },
  { rank: 10, name: "원익홀딩스", type: "D", score: 70, reason: "원익IPS 등 자회사 가치. 지분법 손실이 주원인. 반도체 장비 사이클에 연동", catalyst: "자회사 실적 개선" },
];

const ETF_DATA = [
  { name: "KODEX 코스닥150", code: "229200", matches: ["에코프로", "에코프로비엠", "테크윙", "로보티즈", "알지노믹스", "서진시스템", "원익홀딩스", "하나마이크론", "성호전자", "태성"], matchCount: 10, aum: "7.5조", fee: "0.20%", note: "코스닥 시총 상위 150종목. Top10 적자기업 전종목 편입" },
  { name: "TIGER 코스닥150", code: "232080", matches: ["에코프로", "에코프로비엠", "테크윙", "로보티즈", "알지노믹스", "서진시스템", "원익홀딩스", "하나마이크론", "성호전자", "태성"], matchCount: 10, aum: "1.3조", fee: "0.19%", note: "KODEX와 동일 지수. 수수료 약간 저렴" },
  { name: "KODEX 2차전지산업", code: "305720", matches: ["에코프로", "에코프로비엠"], matchCount: 2, aum: "8,500억", fee: "0.45%", note: "2차전지 밸류체인 집중. B유형 적자기업 고비중 편입" },
  { name: "TIGER 코스닥150바이오테크", code: "261070", matches: ["알지노믹스"], matchCount: 1, aum: "3,200억", fee: "0.40%", note: "코스닥 바이오 집중. C유형 바이오 적자기업 다수 편입" },
  { name: "TIGER 코리아휴머노이드로봇산업", code: "490600", matches: ["로보티즈"], matchCount: 1, aum: "2,800억", fee: "0.45%", note: "레인보우로보틱스 15.7%, 로보티즈 10.9% 편입" },
  { name: "KODEX 코스닥150IT", code: "261060", matches: ["테크윙", "서진시스템", "원익홀딩스", "하나마이크론", "태성"], matchCount: 5, aum: "1,100억", fee: "0.25%", note: "코스닥 IT 섹터 집중. D유형 IT기업 다수 편입" },
];

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

/* ───────────────────────────────────────────
   메인 페이지
   ─────────────────────────────────────────── */

export default function DeficitAnalysisPage() {
  const [activeTab, setActiveTab] = useState("top10");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [filterType, setFilterType] = useState("ALL");
  const [expandedRow, setExpandedRow] = useState(null);
  const [sortBy, setSortBy] = useState("rank");

  const handleAiUpdate = useCallback(async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch("/api/deficit-update", { method: "POST" });
      const data = await res.json();
      setAiResult(data.result || data.error || "업데이트 완료");
    } catch (e) {
      setAiResult("API 호출 오류: " + e.message);
    }
    setAiLoading(false);
  }, []);

  const typeDistribution = {};
  COMPANIES.forEach((c) => {
    typeDistribution[c.type] = (typeDistribution[c.type] || 0) + 1;
  });

  const filtered = filterType === "ALL" ? COMPANIES : COMPANIES.filter((c) => c.type === filterType);
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
            <p className="text-xs text-[#5A6478] mt-1">적자의 성격 분류 → 위험 대비 기대수익 Top 10 → ETF 매칭</p>
          </div>
          <button
            onClick={handleAiUpdate}
            disabled={aiLoading}
            className="px-5 py-2.5 rounded-lg border border-[#4EA8FF50] font-bold text-sm text-[#4EA8FF] transition
                       bg-gradient-to-br from-[#0D2847] to-[#132E52]
                       hover:from-[#133058] hover:to-[#1A3D6A] hover:border-[#4EA8FF] hover:shadow-[0_0_20px_#4EA8FF30]
                       disabled:opacity-50 disabled:cursor-wait flex items-center gap-2"
          >
            {aiLoading ? "⚡ AI 분석 중..." : "⚡ AI 업데이트"}
          </button>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-transparent via-[#4EA8FF] to-transparent opacity-60" />
      </div>

      {/* ── AI 결과 ── */}
      {aiResult && (
        <div className="mx-7 mt-4 p-4 bg-[#0D2847] border border-[#4EA8FF30] rounded-lg animate-fade-in">
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
          { id: "all", label: "📊 전체 50종목" },
          { id: "etf", label: "💼 ETF 매칭" },
          { id: "framework", label: "📋 적자유형 프레임워크" },
        ].map((t) => (
          <button key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-md text-xs font-semibold border transition whitespace-nowrap
              ${activeTab === t.id
                ? "bg-gradient-to-br from-[#1A3A5C] to-[#162D4A] text-[#4EA8FF] border-[#4EA8FF40]"
                : "bg-transparent text-[#8892A4] border-[#1E2636] hover:bg-[#1A2030] hover:text-[#C0C8D8]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-7 pb-10">

        {/* ── Top 10 탭 ── */}
        {activeTab === "top10" && (
          <div>
            <div className="bg-[#111827] border border-[#1E2636] rounded-lg p-5 mb-4">
              <div className="text-sm font-bold text-[#FFB800] mb-1">핵심 논리</div>
              <div className="text-xs text-[#8892A4] leading-relaxed">
                코스닥 적자기업 중 <span className="text-[#4EA8FF] font-bold">D유형(본업 흑자+일회성 순손실)</span>이 가장 빠른 리레이팅,
                <span className="text-[#FFB800] font-bold"> B유형(GP흑자+영업적자)</span>이 가장 큰 비대칭 수익 기회.
                A유형(GP적자)과 C유형(바이오 EBITDA적자)은 제외.
              </div>
            </div>
            <div className="bg-[#111827] border border-[#1E2636] rounded-lg overflow-hidden">
              {TOP10_DEFICIT.map((c, i) => (
                <div key={c.name} className="px-5 py-4 border-b border-[#1E2636] hover:bg-[#151D2C] transition">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`font-mono text-lg font-black min-w-[30px] ${i < 3 ? "text-[#FFB800]" : "text-[#5A6478]"}`}>
                      {String(c.rank).padStart(2, "0")}
                    </span>
                    <span className="text-sm font-bold">{c.name}</span>
                    <TypeBadge type={c.type} />
                    <div className="flex-1" />
                    <div className="w-28">
                      <div className="h-1.5 rounded-full bg-[#1E2636] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${c.score}%`,
                            background: c.score >= 85 ? "linear-gradient(90deg,#FFB800,#FF8C00)" : c.score >= 75 ? "linear-gradient(90deg,#4EA8FF,#3D8BD4)" : "#5A6478",
                          }} />
                      </div>
                    </div>
                    <span className={`font-mono text-sm font-bold min-w-[30px] text-right ${c.score >= 85 ? "text-[#FFB800]" : "text-[#4EA8FF]"}`}>
                      {c.score}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#8892A4] ml-[42px] leading-relaxed">{c.reason}</div>
                  <div className="text-[10px] text-[#4EA8FF] ml-[42px] mt-1">📌 촉매: {c.catalyst}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 전체 50종목 탭 ── */}
        {activeTab === "all" && (
          <div>
            <div className="flex gap-1.5 mb-3 flex-wrap">
              <button onClick={() => setFilterType("ALL")}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition
                  ${filterType === "ALL" ? "bg-[#4EA8FF20] text-[#4EA8FF] border-[#4EA8FF60]" : "bg-transparent text-[#8892A4] border-[#1E2636]"}`}>
                전체 ({COMPANIES.length})
              </button>
              {Object.entries(DEFICIT_TYPES).map(([key, val]) => (
                <button key={key} onClick={() => setFilterType(key)}
                  className="px-3 py-1 rounded-full text-[11px] font-semibold border transition"
                  style={filterType === key
                    ? { background: val.bg, color: val.color, borderColor: val.color + "60" }
                    : { background: "transparent", color: "#8892A4", borderColor: "#1E2636" }}>
                  {key === "흑자" ? "흑자" : key} ({typeDistribution[key] || 0})
                </button>
              ))}
            </div>
            <div className="bg-[#111827] border border-[#1E2636] rounded-lg overflow-auto max-h-[70vh]">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {[
                      { key: "rank", label: "#" },
                      { key: "name", label: "종목명", align: "left" },
                      { key: "cap", label: "시총(억)" },
                      { key: "per", label: "PER" },
                      { key: "roe", label: "ROE(%)" },
                      { key: "type", label: "유형" },
                      { key: "detail", label: "분류 근거", align: "left" },
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

        {/* ── ETF 매칭 탭 ── */}
        {activeTab === "etf" && (
          <div>
            <div className="bg-[#111827] border border-[#1E2636] rounded-lg p-5 mb-4">
              <div className="text-sm font-bold text-[#4EA8FF] mb-1">ETF 매칭 로직</div>
              <div className="text-xs text-[#8892A4] leading-relaxed">
                위험 대비 기대수익 Top 10 적자기업을 <span className="text-[#FFB800] font-bold">가장 많이 편입한 국내 ETF</span>를 매칭.
                개별 종목 직접투자 대비 분산효과 확보.
              </div>
            </div>
            <div className="bg-[#111827] border border-[#1E2636] rounded-lg overflow-hidden">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_3fr] gap-3 px-4 py-3 text-[11px] font-bold text-[#6B7894] border-b-2 border-[#1E2636]">
                <span>ETF명</span><span className="text-center">매칭</span><span className="text-center">AUM</span><span className="text-center">보수</span><span>매칭 종목 / 특징</span>
              </div>
              {ETF_DATA.sort((a, b) => b.matchCount - a.matchCount).map((etf) => (
                <div key={etf.code} className="grid grid-cols-[2fr_1fr_1fr_1fr_3fr] gap-3 px-4 py-3.5 border-b border-[#1E2636] items-center text-xs hover:bg-[#1A2030] transition">
                  <div>
                    <div className="font-bold text-sm">{etf.name}</div>
                    <div className="text-[10px] text-[#5A6478] font-mono">{etf.code}</div>
                  </div>
                  <div className="text-center">
                    <span className={`font-mono text-xl font-black ${etf.matchCount >= 8 ? "text-[#FFB800]" : etf.matchCount >= 3 ? "text-[#4EA8FF]" : "text-[#5A6478]"}`}>
                      {etf.matchCount}
                    </span>
                    <span className="text-[10px] text-[#5A6478]">/10</span>
                  </div>
                  <div className="text-center font-mono text-[#8892A4]">{etf.aum}</div>
                  <div className="text-center font-mono text-[#8892A4]">{etf.fee}</div>
                  <div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {etf.matches.map((m) => {
                        const comp = TOP10_DEFICIT.find((c) => c.name === m);
                        return comp ? (
                          <span key={m} className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: DEFICIT_TYPES[comp.type].bg, color: DEFICIT_TYPES[comp.type].color, border: `1px solid ${DEFICIT_TYPES[comp.type].color}30` }}>
                            {m}
                          </span>
                        ) : null;
                      })}
                    </div>
                    <div className="text-[10px] text-[#5A6478]">{etf.note}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-[#111827] border border-[#1E2636] rounded-lg p-5 mt-4">
              <div className="text-sm font-bold text-[#FFB800] mb-2">💡 전략 제안</div>
              <div className="text-xs text-[#8892A4] leading-relaxed space-y-1">
                <p><strong className="text-[#E0E4EC]">Core (60%)</strong>: KODEX/TIGER 코스닥150 — Top 10 전종목 편입</p>
                <p><strong className="text-[#E0E4EC]">Satellite (25%)</strong>: KODEX 코스닥150IT — D유형 IT기업 집중 노출</p>
                <p><strong className="text-[#E0E4EC]">Alpha (15%)</strong>: 서진시스템·태성·에코프로비엠 직접 매수</p>
              </div>
            </div>
          </div>
        )}

        {/* ── 프레임워크 탭 ── */}
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
                  해당 기업: {COMPANIES.filter((c) => c.type === key).map((c) => c.name).join(", ") || "해당 없음 (코스닥 Top50 내)"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 푸터 ── */}
      <div className="px-7 py-4 border-t border-[#1E2636] text-center">
        <div className="text-[10px] text-[#3A4458]">
          늑대무리원정단 · 적자기업 투자분석 모듈 · 데이터 기준: 2026.03.06 · 투자 판단은 본인 책임
        </div>
      </div>
    </div>
  );
}
