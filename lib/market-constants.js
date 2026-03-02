export const RANGE_PRESETS = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "전체", months: 999 },
];

export const SEED_MARKET = [
  { date: "2024-01", kospi: 2497, kodex: 9850 },
  { date: "2024-02", kospi: 2642, kodex: 10320 },
  { date: "2024-03", kospi: 2746, kodex: 10680 },
  { date: "2024-04", kospi: 2687, kodex: 10410 },
  { date: "2024-05", kospi: 2724, kodex: 10550 },
  { date: "2024-06", kospi: 2804, kodex: 10890 },
  { date: "2024-07", kospi: 2770, kodex: 10750 },
  { date: "2024-08", kospi: 2674, kodex: 10310 },
  { date: "2024-09", kospi: 2593, kodex: 10040 },
  { date: "2024-10", kospi: 2556, kodex: 9880 },
  { date: "2024-11", kospi: 2455, kodex: 9520 },
  { date: "2024-12", kospi: 2399, kodex: 9180 },
  { date: "2025-01", kospi: 2520, kodex: 9640 },
  { date: "2025-02", kospi: 2610, kodex: 9980 },
  { date: "2025-03", kospi: 2745, kodex: 10450 },
  { date: "2025-04", kospi: 2560, kodex: 9720 },
  { date: "2025-05", kospi: 2830, kodex: 10780 },
  { date: "2025-06", kospi: 3120, kodex: 11650 },
  { date: "2025-07", kospi: 3380, kodex: 12480 },
  { date: "2025-08", kospi: 3640, kodex: 13150 },
  { date: "2025-09", kospi: 3920, kodex: 13800 },
  { date: "2025-10", kospi: 4050, kodex: 14200 },
  { date: "2025-11", kospi: 4130, kodex: 14680 },
  { date: "2025-12", kospi: 4214, kodex: 14950 },
  { date: "2026-01", kospi: 5480, kodex: 17200 },
  { date: "2026-02", kospi: 6300, kodex: 18500 },
];

export const SEED_CSI = [
  { date: "2024-01", csi: 101.6 },
  { date: "2024-02", csi: 101.9 },
  { date: "2024-03", csi: 100.7 },
  { date: "2024-04", csi: 98.4 },
  { date: "2024-05", csi: 98.0 },
  { date: "2024-06", csi: 98.4 },
  { date: "2024-07", csi: 97.6 },
  { date: "2024-08", csi: 96.6 },
  { date: "2024-09", csi: 96.9 },
  { date: "2024-10", csi: 96.2 },
  { date: "2024-11", csi: 93.7 },
  { date: "2024-12", csi: 88.4 },
  { date: "2025-01", csi: 89.8 },
  { date: "2025-02", csi: 91.2 },
  { date: "2025-03", csi: 93.4 },
  { date: "2025-04", csi: 92.0 },
  { date: "2025-05", csi: 95.1 },
  { date: "2025-06", csi: 97.8 },
  { date: "2025-07", csi: 99.2 },
  { date: "2025-08", csi: 100.5 },
  { date: "2025-09", csi: 101.8 },
  { date: "2025-10", csi: 102.4 },
  { date: "2025-11", csi: 103.1 },
  { date: "2025-12", csi: 103.8 },
  { date: "2026-01", csi: 105.2 },
  { date: "2026-02", csi: 106.8 },
];

export const AI_UPDATE_PROMPT = `오늘 날짜 기준으로 아래 3가지 최신 데이터를 검색해서 JSON으로만 응답해줘. 다른 텍스트 없이 순수 JSON만:

1. KOSPI 지수 최근 종가 (가장 최근 거래일)
2. KODEX 경기소비재 ETF (종목코드 266410) 최근 종가
3. 한국은행 소비자심리지수(CCSI) 가장 최근 발표 수치

응답 형식:
{
  "kospi": { "value": 숫자, "date": "YYYY-MM-DD", "change_pct": 숫자 },
  "kodex_consumer": { "value": 숫자, "date": "YYYY-MM-DD", "change_pct": 숫자 },
  "consumer_sentiment": { "value": 숫자, "date": "YYYY-MM" },
  "notes": "간단한 시장 코멘트 1줄"
}`;

export function indexData(data, baseIdx, kospiKey, kodexKey) {
  const baseKospi = data[baseIdx]?.[kospiKey];
  const baseKodex = data[baseIdx]?.[kodexKey];
  if (!baseKospi || !baseKodex) return data;
  return data.map((d) => ({
    ...d,
    kospiIdx: +((d[kospiKey] / baseKospi) * 100).toFixed(1),
    kodexIdx: +((d[kodexKey] / baseKodex) * 100).toFixed(1),
    spread: +(((d[kodexKey] / baseKodex) - (d[kospiKey] / baseKospi)) * 100).toFixed(1),
  }));
}

export function formatDateLabel(d) {
  const [y, m] = d.split("-");
  return `${y.slice(2)}.${m}`;
}

export function parseAIResponse(text) {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}
