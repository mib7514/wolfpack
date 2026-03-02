// ──────────────────────────────────────────────
// ✈️ Inbound & Currency — 시드 데이터 & 유틸
// 늑대무리원정단 · 소비주 모니터링 Tab 2
// ──────────────────────────────────────────────

// 국가 코드 → 표시명
export const COUNTRY_LABELS = {
  CN: { name: "중국", flag: "🇨🇳", color: "#ef4444" },
  JP: { name: "일본", flag: "🇯🇵", color: "#f97316" },
  US: { name: "미국", flag: "🇺🇸", color: "#3b82f6" },
  TW: { name: "대만", flag: "🇹🇼", color: "#22c55e" },
  TH: { name: "태국", flag: "🇹🇭", color: "#a855f7" },
  VN: { name: "베트남", flag: "🇻🇳", color: "#eab308" },
  OTHER: { name: "기타", flag: "🌐", color: "#6b7280" },
};

export const CURRENCY_LABELS = {
  USD: { name: "달러", symbol: "USD/KRW", color: "#3b82f6" },
  JPY: { name: "엔(100)", symbol: "JPY100/KRW", color: "#f97316" },
  CNY: { name: "위안", symbol: "CNY/KRW", color: "#ef4444" },
  TWD: { name: "대만달러", symbol: "TWD/KRW", color: "#22c55e" },
};

// 국가별 월간 방한 관광객 (천 명 단위)
export const SEED_INBOUND = [
  // 2024
  { date: "2024-01", country: "CN", visitors: 268 },
  { date: "2024-01", country: "JP", visitors: 231 },
  { date: "2024-01", country: "US", visitors: 98 },
  { date: "2024-01", country: "TW", visitors: 85 },
  { date: "2024-01", country: "TH", visitors: 52 },
  { date: "2024-01", country: "VN", visitors: 41 },
  { date: "2024-01", country: "OTHER", visitors: 390 },

  { date: "2024-02", country: "CN", visitors: 312 },
  { date: "2024-02", country: "JP", visitors: 218 },
  { date: "2024-02", country: "US", visitors: 89 },
  { date: "2024-02", country: "TW", visitors: 92 },
  { date: "2024-02", country: "TH", visitors: 48 },
  { date: "2024-02", country: "VN", visitors: 38 },
  { date: "2024-02", country: "OTHER", visitors: 375 },

  { date: "2024-03", country: "CN", visitors: 345 },
  { date: "2024-03", country: "JP", visitors: 252 },
  { date: "2024-03", country: "US", visitors: 105 },
  { date: "2024-03", country: "TW", visitors: 98 },
  { date: "2024-03", country: "TH", visitors: 55 },
  { date: "2024-03", country: "VN", visitors: 44 },
  { date: "2024-03", country: "OTHER", visitors: 420 },

  { date: "2024-04", country: "CN", visitors: 330 },
  { date: "2024-04", country: "JP", visitors: 245 },
  { date: "2024-04", country: "US", visitors: 112 },
  { date: "2024-04", country: "TW", visitors: 88 },
  { date: "2024-04", country: "TH", visitors: 50 },
  { date: "2024-04", country: "VN", visitors: 42 },
  { date: "2024-04", country: "OTHER", visitors: 408 },

  { date: "2024-05", country: "CN", visitors: 315 },
  { date: "2024-05", country: "JP", visitors: 238 },
  { date: "2024-05", country: "US", visitors: 108 },
  { date: "2024-05", country: "TW", visitors: 82 },
  { date: "2024-05", country: "TH", visitors: 46 },
  { date: "2024-05", country: "VN", visitors: 40 },
  { date: "2024-05", country: "OTHER", visitors: 395 },

  { date: "2024-06", country: "CN", visitors: 340 },
  { date: "2024-06", country: "JP", visitors: 260 },
  { date: "2024-06", country: "US", visitors: 118 },
  { date: "2024-06", country: "TW", visitors: 95 },
  { date: "2024-06", country: "TH", visitors: 58 },
  { date: "2024-06", country: "VN", visitors: 46 },
  { date: "2024-06", country: "OTHER", visitors: 430 },

  { date: "2024-07", country: "CN", visitors: 365 },
  { date: "2024-07", country: "JP", visitors: 275 },
  { date: "2024-07", country: "US", visitors: 125 },
  { date: "2024-07", country: "TW", visitors: 102 },
  { date: "2024-07", country: "TH", visitors: 62 },
  { date: "2024-07", country: "VN", visitors: 48 },
  { date: "2024-07", country: "OTHER", visitors: 448 },

  { date: "2024-08", country: "CN", visitors: 358 },
  { date: "2024-08", country: "JP", visitors: 268 },
  { date: "2024-08", country: "US", visitors: 122 },
  { date: "2024-08", country: "TW", visitors: 98 },
  { date: "2024-08", country: "TH", visitors: 60 },
  { date: "2024-08", country: "VN", visitors: 47 },
  { date: "2024-08", country: "OTHER", visitors: 440 },

  { date: "2024-09", country: "CN", visitors: 320 },
  { date: "2024-09", country: "JP", visitors: 242 },
  { date: "2024-09", country: "US", visitors: 102 },
  { date: "2024-09", country: "TW", visitors: 88 },
  { date: "2024-09", country: "TH", visitors: 54 },
  { date: "2024-09", country: "VN", visitors: 43 },
  { date: "2024-09", country: "OTHER", visitors: 410 },

  { date: "2024-10", country: "CN", visitors: 348 },
  { date: "2024-10", country: "JP", visitors: 258 },
  { date: "2024-10", country: "US", visitors: 115 },
  { date: "2024-10", country: "TW", visitors: 96 },
  { date: "2024-10", country: "TH", visitors: 58 },
  { date: "2024-10", country: "VN", visitors: 46 },
  { date: "2024-10", country: "OTHER", visitors: 435 },

  { date: "2024-11", country: "CN", visitors: 325 },
  { date: "2024-11", country: "JP", visitors: 248 },
  { date: "2024-11", country: "US", visitors: 108 },
  { date: "2024-11", country: "TW", visitors: 90 },
  { date: "2024-11", country: "TH", visitors: 52 },
  { date: "2024-11", country: "VN", visitors: 43 },
  { date: "2024-11", country: "OTHER", visitors: 415 },

  { date: "2024-12", country: "CN", visitors: 310 },
  { date: "2024-12", country: "JP", visitors: 240 },
  { date: "2024-12", country: "US", visitors: 105 },
  { date: "2024-12", country: "TW", visitors: 88 },
  { date: "2024-12", country: "TH", visitors: 50 },
  { date: "2024-12", country: "VN", visitors: 42 },
  { date: "2024-12", country: "OTHER", visitors: 402 },

  // 2025
  { date: "2025-01", country: "CN", visitors: 335 },
  { date: "2025-01", country: "JP", visitors: 255 },
  { date: "2025-01", country: "US", visitors: 110 },
  { date: "2025-01", country: "TW", visitors: 95 },
  { date: "2025-01", country: "TH", visitors: 58 },
  { date: "2025-01", country: "VN", visitors: 46 },
  { date: "2025-01", country: "OTHER", visitors: 425 },

  { date: "2025-02", country: "CN", visitors: 380 },
  { date: "2025-02", country: "JP", visitors: 242 },
  { date: "2025-02", country: "US", visitors: 102 },
  { date: "2025-02", country: "TW", visitors: 105 },
  { date: "2025-02", country: "TH", visitors: 55 },
  { date: "2025-02", country: "VN", visitors: 44 },
  { date: "2025-02", country: "OTHER", visitors: 410 },

  { date: "2025-03", country: "CN", visitors: 398 },
  { date: "2025-03", country: "JP", visitors: 268 },
  { date: "2025-03", country: "US", visitors: 118 },
  { date: "2025-03", country: "TW", visitors: 112 },
  { date: "2025-03", country: "TH", visitors: 62 },
  { date: "2025-03", country: "VN", visitors: 50 },
  { date: "2025-03", country: "OTHER", visitors: 455 },

  { date: "2025-04", country: "CN", visitors: 370 },
  { date: "2025-04", country: "JP", visitors: 258 },
  { date: "2025-04", country: "US", visitors: 115 },
  { date: "2025-04", country: "TW", visitors: 100 },
  { date: "2025-04", country: "TH", visitors: 56 },
  { date: "2025-04", country: "VN", visitors: 45 },
  { date: "2025-04", country: "OTHER", visitors: 438 },

  { date: "2025-05", country: "CN", visitors: 385 },
  { date: "2025-05", country: "JP", visitors: 265 },
  { date: "2025-05", country: "US", visitors: 120 },
  { date: "2025-05", country: "TW", visitors: 108 },
  { date: "2025-05", country: "TH", visitors: 60 },
  { date: "2025-05", country: "VN", visitors: 48 },
  { date: "2025-05", country: "OTHER", visitors: 450 },

  { date: "2025-06", country: "CN", visitors: 410 },
  { date: "2025-06", country: "JP", visitors: 280 },
  { date: "2025-06", country: "US", visitors: 128 },
  { date: "2025-06", country: "TW", visitors: 115 },
  { date: "2025-06", country: "TH", visitors: 65 },
  { date: "2025-06", country: "VN", visitors: 52 },
  { date: "2025-06", country: "OTHER", visitors: 470 },

  { date: "2025-07", country: "CN", visitors: 435 },
  { date: "2025-07", country: "JP", visitors: 295 },
  { date: "2025-07", country: "US", visitors: 135 },
  { date: "2025-07", country: "TW", visitors: 120 },
  { date: "2025-07", country: "TH", visitors: 68 },
  { date: "2025-07", country: "VN", visitors: 55 },
  { date: "2025-07", country: "OTHER", visitors: 490 },

  { date: "2025-08", country: "CN", visitors: 428 },
  { date: "2025-08", country: "JP", visitors: 288 },
  { date: "2025-08", country: "US", visitors: 132 },
  { date: "2025-08", country: "TW", visitors: 118 },
  { date: "2025-08", country: "TH", visitors: 66 },
  { date: "2025-08", country: "VN", visitors: 53 },
  { date: "2025-08", country: "OTHER", visitors: 482 },

  { date: "2025-09", country: "CN", visitors: 390 },
  { date: "2025-09", country: "JP", visitors: 270 },
  { date: "2025-09", country: "US", visitors: 122 },
  { date: "2025-09", country: "TW", visitors: 108 },
  { date: "2025-09", country: "TH", visitors: 60 },
  { date: "2025-09", country: "VN", visitors: 48 },
  { date: "2025-09", country: "OTHER", visitors: 458 },

  { date: "2025-10", country: "CN", visitors: 415 },
  { date: "2025-10", country: "JP", visitors: 282 },
  { date: "2025-10", country: "US", visitors: 128 },
  { date: "2025-10", country: "TW", visitors: 115 },
  { date: "2025-10", country: "TH", visitors: 64 },
  { date: "2025-10", country: "VN", visitors: 52 },
  { date: "2025-10", country: "OTHER", visitors: 475 },

  { date: "2025-11", country: "CN", visitors: 395 },
  { date: "2025-11", country: "JP", visitors: 275 },
  { date: "2025-11", country: "US", visitors: 125 },
  { date: "2025-11", country: "TW", visitors: 110 },
  { date: "2025-11", country: "TH", visitors: 62 },
  { date: "2025-11", country: "VN", visitors: 50 },
  { date: "2025-11", country: "OTHER", visitors: 465 },

  { date: "2025-12", country: "CN", visitors: 380 },
  { date: "2025-12", country: "JP", visitors: 268 },
  { date: "2025-12", country: "US", visitors: 120 },
  { date: "2025-12", country: "TW", visitors: 105 },
  { date: "2025-12", country: "TH", visitors: 58 },
  { date: "2025-12", country: "VN", visitors: 48 },
  { date: "2025-12", country: "OTHER", visitors: 452 },

  // 2026
  { date: "2026-01", country: "CN", visitors: 405 },
  { date: "2026-01", country: "JP", visitors: 278 },
  { date: "2026-01", country: "US", visitors: 125 },
  { date: "2026-01", country: "TW", visitors: 115 },
  { date: "2026-01", country: "TH", visitors: 65 },
  { date: "2026-01", country: "VN", visitors: 52 },
  { date: "2026-01", country: "OTHER", visitors: 468 },

  { date: "2026-02", country: "CN", visitors: 420 },
  { date: "2026-02", country: "JP", visitors: 285 },
  { date: "2026-02", country: "US", visitors: 130 },
  { date: "2026-02", country: "TW", visitors: 120 },
  { date: "2026-02", country: "TH", visitors: 68 },
  { date: "2026-02", country: "VN", visitors: 55 },
  { date: "2026-02", country: "OTHER", visitors: 480 },
];

// 환율 (원화 기준, JPY는 100엔당)
export const SEED_CURRENCY = [
  { date: "2024-01", currency: "USD", rate: 1330 },
  { date: "2024-01", currency: "JPY", rate: 898 },
  { date: "2024-01", currency: "CNY", rate: 186 },
  { date: "2024-01", currency: "TWD", rate: 42.8 },

  { date: "2024-02", currency: "USD", rate: 1335 },
  { date: "2024-02", currency: "JPY", rate: 886 },
  { date: "2024-02", currency: "CNY", rate: 185 },
  { date: "2024-02", currency: "TWD", rate: 42.5 },

  { date: "2024-03", currency: "USD", rate: 1345 },
  { date: "2024-03", currency: "JPY", rate: 882 },
  { date: "2024-03", currency: "CNY", rate: 185 },
  { date: "2024-03", currency: "TWD", rate: 42.0 },

  { date: "2024-04", currency: "USD", rate: 1380 },
  { date: "2024-04", currency: "JPY", rate: 870 },
  { date: "2024-04", currency: "CNY", rate: 189 },
  { date: "2024-04", currency: "TWD", rate: 42.6 },

  { date: "2024-05", currency: "USD", rate: 1375 },
  { date: "2024-05", currency: "JPY", rate: 865 },
  { date: "2024-05", currency: "CNY", rate: 188 },
  { date: "2024-05", currency: "TWD", rate: 42.4 },

  { date: "2024-06", currency: "USD", rate: 1388 },
  { date: "2024-06", currency: "JPY", rate: 858 },
  { date: "2024-06", currency: "CNY", rate: 190 },
  { date: "2024-06", currency: "TWD", rate: 42.8 },

  { date: "2024-07", currency: "USD", rate: 1385 },
  { date: "2024-07", currency: "JPY", rate: 870 },
  { date: "2024-07", currency: "CNY", rate: 190 },
  { date: "2024-07", currency: "TWD", rate: 42.6 },

  { date: "2024-08", currency: "USD", rate: 1360 },
  { date: "2024-08", currency: "JPY", rate: 905 },
  { date: "2024-08", currency: "CNY", rate: 189 },
  { date: "2024-08", currency: "TWD", rate: 42.8 },

  { date: "2024-09", currency: "USD", rate: 1340 },
  { date: "2024-09", currency: "JPY", rate: 920 },
  { date: "2024-09", currency: "CNY", rate: 190 },
  { date: "2024-09", currency: "TWD", rate: 43.0 },

  { date: "2024-10", currency: "USD", rate: 1380 },
  { date: "2024-10", currency: "JPY", rate: 905 },
  { date: "2024-10", currency: "CNY", rate: 192 },
  { date: "2024-10", currency: "TWD", rate: 43.2 },

  { date: "2024-11", currency: "USD", rate: 1420 },
  { date: "2024-11", currency: "JPY", rate: 912 },
  { date: "2024-11", currency: "CNY", rate: 195 },
  { date: "2024-11", currency: "TWD", rate: 43.5 },

  { date: "2024-12", currency: "USD", rate: 1470 },
  { date: "2024-12", currency: "JPY", rate: 940 },
  { date: "2024-12", currency: "CNY", rate: 200 },
  { date: "2024-12", currency: "TWD", rate: 44.8 },

  { date: "2025-01", currency: "USD", rate: 1458 },
  { date: "2025-01", currency: "JPY", rate: 935 },
  { date: "2025-01", currency: "CNY", rate: 198 },
  { date: "2025-01", currency: "TWD", rate: 44.5 },

  { date: "2025-02", currency: "USD", rate: 1450 },
  { date: "2025-02", currency: "JPY", rate: 945 },
  { date: "2025-02", currency: "CNY", rate: 198 },
  { date: "2025-02", currency: "TWD", rate: 44.8 },

  { date: "2025-03", currency: "USD", rate: 1462 },
  { date: "2025-03", currency: "JPY", rate: 960 },
  { date: "2025-03", currency: "CNY", rate: 200 },
  { date: "2025-03", currency: "TWD", rate: 45.0 },

  { date: "2025-04", currency: "USD", rate: 1445 },
  { date: "2025-04", currency: "JPY", rate: 955 },
  { date: "2025-04", currency: "CNY", rate: 199 },
  { date: "2025-04", currency: "TWD", rate: 44.8 },

  { date: "2025-05", currency: "USD", rate: 1438 },
  { date: "2025-05", currency: "JPY", rate: 948 },
  { date: "2025-05", currency: "CNY", rate: 198 },
  { date: "2025-05", currency: "TWD", rate: 44.5 },

  { date: "2025-06", currency: "USD", rate: 1425 },
  { date: "2025-06", currency: "JPY", rate: 940 },
  { date: "2025-06", currency: "CNY", rate: 196 },
  { date: "2025-06", currency: "TWD", rate: 44.2 },

  { date: "2025-07", currency: "USD", rate: 1418 },
  { date: "2025-07", currency: "JPY", rate: 935 },
  { date: "2025-07", currency: "CNY", rate: 195 },
  { date: "2025-07", currency: "TWD", rate: 44.0 },

  { date: "2025-08", currency: "USD", rate: 1430 },
  { date: "2025-08", currency: "JPY", rate: 942 },
  { date: "2025-08", currency: "CNY", rate: 197 },
  { date: "2025-08", currency: "TWD", rate: 44.3 },

  { date: "2025-09", currency: "USD", rate: 1442 },
  { date: "2025-09", currency: "JPY", rate: 950 },
  { date: "2025-09", currency: "CNY", rate: 199 },
  { date: "2025-09", currency: "TWD", rate: 44.6 },

  { date: "2025-10", currency: "USD", rate: 1455 },
  { date: "2025-10", currency: "JPY", rate: 958 },
  { date: "2025-10", currency: "CNY", rate: 200 },
  { date: "2025-10", currency: "TWD", rate: 45.0 },

  { date: "2025-11", currency: "USD", rate: 1468 },
  { date: "2025-11", currency: "JPY", rate: 962 },
  { date: "2025-11", currency: "CNY", rate: 202 },
  { date: "2025-11", currency: "TWD", rate: 45.2 },

  { date: "2025-12", currency: "USD", rate: 1480 },
  { date: "2025-12", currency: "JPY", rate: 968 },
  { date: "2025-12", currency: "CNY", rate: 203 },
  { date: "2025-12", currency: "TWD", rate: 45.5 },

  { date: "2026-01", currency: "USD", rate: 1455 },
  { date: "2026-01", currency: "JPY", rate: 955 },
  { date: "2026-01", currency: "CNY", rate: 200 },
  { date: "2026-01", currency: "TWD", rate: 45.0 },

  { date: "2026-02", currency: "USD", rate: 1437 },
  { date: "2026-02", currency: "JPY", rate: 948 },
  { date: "2026-02", currency: "CNY", rate: 198 },
  { date: "2026-02", currency: "TWD", rate: 44.6 },
];

// Top N 국가 자동 산출 (OTHER 제외)
export function getTopCountries(inboundData, n = 3) {
  const totals = {};
  inboundData.forEach((d) => {
    if (d.country === "OTHER") return;
    totals[d.country] = (totals[d.country] || 0) + Number(d.visitors);
  });
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([code]) => code);
}

// 날짜별로 그룹핑 (차트용)
export function pivotInbound(inboundData) {
  const map = {};
  inboundData.forEach((d) => {
    if (!map[d.date]) map[d.date] = { date: d.date, total: 0 };
    map[d.date][d.country] = Number(d.visitors);
    map[d.date].total += Number(d.visitors);
  });
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

// 날짜별 환율 피벗
export function pivotCurrency(currencyData) {
  const map = {};
  currencyData.forEach((d) => {
    if (!map[d.date]) map[d.date] = { date: d.date };
    map[d.date][d.currency] = Number(d.rate);
  });
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

export function formatDateLabel(d) {
  const [y, m] = d.split("-");
  return `${y.slice(2)}.${m}`;
}

export const INBOUND_AI_PROMPT = `오늘 날짜 기준으로 아래 데이터를 검색해서 JSON으로만 응답해줘. 다른 텍스트 없이 순수 JSON만:

1. 한국관광공사(KTO) 최신 월간 방한 관광객 통계 — 국가별(중국CN, 일본JP, 미국US, 대만TW, 태국TH, 베트남VN, 기타OTHER) 입국자 수 (천명 단위)
2. 최신 환율 — USD/KRW, JPY100/KRW, CNY/KRW, TWD/KRW

응답 형식:
{
  "inbound": {
    "date": "YYYY-MM",
    "CN": 숫자, "JP": 숫자, "US": 숫자, "TW": 숫자, "TH": 숫자, "VN": 숫자, "OTHER": 숫자
  },
  "currency": {
    "date": "YYYY-MM",
    "USD": 숫자, "JPY": 숫자, "CNY": 숫자, "TWD": 숫자
  },
  "notes": "간단한 코멘트 1줄"
}`;

export function parseAIResponse(text) {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}
