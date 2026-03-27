'use client';

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";

// ═══════════════════════════════════════════════════════
// CONSTANTS & REGIME DEFINITIONS
// ═══════════════════════════════════════════════════════

const TENORS = ["3M","6M","9M","1Y","1.5Y","2Y","2.5Y","3Y","4Y","5Y","7Y","10Y","15Y","20Y","30Y"];
const KEY_TENORS = ["3M","6M","1Y","1.5Y","2Y","3Y","5Y"];

const CATEGORIES = [
  { key: "govt", label: "국고채", matchCol4: "국고채 양곡,외평,재정", matchCol5: "국고채 양곡,외평,재정", isRow4: true },
  { key: "bankAAA", label: "은행채 AAA", matchCol4: "은행채 AAA", matchCol5: "은행채 AAA" },
  { key: "bankAA-", label: "은행채 AA-", matchCol4: "은행채 AA-", matchCol5: "은행채 AA-" },
  { key: "cardAA+", label: "카드채 AA+", matchCol4: "카드채 AA+", matchCol5: "카드채 AA+" },
  { key: "cardAA-", label: "카드채 AA-", matchCol4: "카드채 AA-", matchCol5: "카드채 AA-" },
  { key: "capAA-", label: "기타금융채 AA-", matchCol4: "기타금융채 AA-", matchCol5: "기타금융채 AA-" },
  { key: "corpAA-", label: "공모/무보증 AA-", matchCol4: "공모/무보증 AA-", matchCol5: "공모/무보증 AA-" },
  { key: "corpA+", label: "공모/무보증 A+", matchCol4: "공모/무보증 A+", matchCol5: "공모/무보증 A+" },
  { key: "corpBBB+", label: "공모/무보증 BBB+", matchCol4: "공모/무보증 BBB+", matchCol5: "공모/무보증 BBB+" },
];

const SPREAD_KEY = "corpAA-";
const RATE_THRESHOLD = 5;
const SPREAD_THRESHOLD = 3;

const RATE_LABELS = ["금리 하락", "금리 보합", "금리 상승"];
const SPREAD_LABELS = ["스프레드 축소", "스프레드 보합", "스프레드 확대"];

const REGIME_NAMES = [
  ["골디락스", "듀레이션 랠리", "Flight to Quality"],
  ["캐리 천국", "정상 상태", "크레딧 스트레스"],
  ["리플레이션", "베어 스티프닝", "스태그플레이션"],
];

const REGIME_COLORS = [
  ["#22c55e", "#3b82f6", "#06b6d4"],
  ["#a3e635", "#6b7280", "#f59e0b"],
  ["#f97316", "#ef4444", "#dc2626"],
];

const REGIME_ENGINES = [
  [["①","②","④"], ["①","⑤"], ["①"]],
  [["②","③","④","⑥"], ["⑤","⑥"], ["④","⑤"]],
  [["②","⑥"], ["③"], ["⑤"]],
];

const ENGINE_COLORS = {
  "①": "#f59e0b", "②": "#3b82f6", "③": "#8b5cf6",
  "④": "#ec4899", "⑤": "#14b8a6", "⑥": "#f97316",
};

const REGIME_DESCRIPTIONS = {
  "골디락스": {
    title: "골디락스 (Goldilocks)",
    summary: "금리 하락 + 스프레드 축소 — 채권 투자자에게 가장 이상적인 환경",
    description: "경기가 적당히 둔화되면서 금리 인하 기대가 형성되고, 동시에 크레딧 리스크는 여전히 낮아 스프레드가 축소되는 국면. 듀레이션 롱 포지션에서 자본이득이 발생하고, 크레딧 포지션에서도 스프레드 축소 수익이 동시에 발생한다.",
    strategy: "듀레이션 오버웨이트 + 크레딧 적극 비중확대. 등급 경계 종목(A+→AA-)에서 업그레이드 베팅 유효. 래더 전 구간에서 수익 발생.",
    risk: "골디락스는 오래 지속되지 않는다. 경기 둔화가 심화되면 Flight to Quality로, 금리 반등 시 리플레이션으로 전환될 수 있다.",
    historical: "2019년 하반기, 2024년 3-4월",
    engines: "① Duration & Curve: 금리 하락에서 듀레이션 롱 수익 극대화\n② Credit Selection: 스프레드 축소 환경에서 종목 선정 알파 확대\n④ Rating Boundary: 업그레이드 기대 종목의 가격 점프 선제 포착",
  },
  "듀레이션 랠리": {
    title: "듀레이션 랠리 (Duration Rally)",
    summary: "금리 하락 + 스프레드 보합 — 순수 금리 하락 수혜",
    description: "금리가 하락하지만 크레딧 시장은 아직 반응하지 않는 초기 국면. 국고채 중심의 듀레이션 포지션이 가장 효율적이며, 크레딧 스프레드는 아직 움직이지 않아 캐리 수익이 안정적으로 유지된다.",
    strategy: "듀레이션 적극 오버웨이트. 크레딧은 현 포지션 유지. 유동성 좋은 국고채/우량 공사채 중심. 향후 골디락스 전환 대비 크레딧 매수 준비.",
    risk: "금리 하락이 경기 침체 시그널인 경우, 곧 스프레드 확대로 전환될 수 있다 (→ Flight to Quality).",
    historical: "금통위 인하 직후, Fed 비둘기 선회 초기",
    engines: "① Duration & Curve: 핵심 알파 엔진, Kelly 풀 포지션\n⑤ Liquidity Premium: 유동성 좋은 종목 중심이므로 프리미엄 수확 기회 제한적이나, 금리 하락기 매도 유동성은 개선",
  },
  "Flight to Quality": {
    title: "Flight to Quality",
    summary: "금리 하락 + 스프레드 확대 — 안전자산 선호, 크레딧 기피",
    description: "경기 침체 공포 또는 금융시장 스트레스로 인해 국고채로 자금이 몰리면서 금리는 하락하지만, 크레딧 채권에서는 자금이 이탈하며 스프레드가 확대되는 국면. 듀레이션 수익과 크레딧 손실이 상충한다.",
    strategy: "듀레이션 오버웨이트하되 크레딧 익스포저는 최소화. 국고채/정부보증채 중심 포트폴리오. 크레딧 비중 축소 또는 방어적 세그먼트(은행채 AAA)로 이동. 스프레드 확대 후반부에 매수 기회 탐색.",
    risk: "스프레드 확대가 가속화되면 펀드 전체 성과가 악화될 수 있다. 환매 압력에 대비한 Z 버킷 확충 필요.",
    historical: "2020년 3월 코로나 초기, 2022년 레고랜드 사태 초기",
    engines: "① Duration & Curve: 금리 하락에서 방어적 수익 확보가 핵심",
  },
  "캐리 천국": {
    title: "캐리 천국 (Carry Paradise)",
    summary: "금리 보합 + 스프레드 축소 — 안정적 캐리 수익 + 스프레드 축소 보너스",
    description: "금리가 안정적으로 유지되면서 크레딧 스프레드가 서서히 축소되는 가장 안정적인 수익 환경. 듀레이션 리스크 없이 캐리와 스프레드 축소 수익을 동시에 수확할 수 있다. 보통 경기 확장 중기에 나타난다.",
    strategy: "크레딧 적극 비중확대. 캐리가 높은 종목 중심. 등급 경계 매수 + 신규 발행 적극 참여. 래더 C/L 버킷 적극 활용. 유동성 프리미엄 수확 환경 최적.",
    risk: "캐리 천국이 과도하게 지속되면 스프레드가 역사적 최저로 압축되어 향후 확대 리스크가 누적된다.",
    historical: "2021년 하반기, 2024년 11-12월",
    engines: "② Credit Selection: 종목 선정 알파 극대화 환경\n③ Segment Allocation: 스프레드 축소 수혜 세그먼트 오버웨이트\n④ Rating Boundary: 업그레이드 선제 매수 최적기\n⑥ New Issue Premium: 발행 시장 활황으로 프리미엄 수확 기회 풍부",
  },
  "정상 상태": {
    title: "정상 상태 (Steady State)",
    summary: "금리 보합 + 스프레드 보합 — 시장이 쉬어가는 구간",
    description: "금리도, 스프레드도 큰 변화가 없는 정적인 시장. 방향성 베팅보다는 캐리 수익과 미시적 상대가치(relative value) 기회에 집중해야 하는 구간. 시장 변동성이 낮아 거래 기회가 제한적이다.",
    strategy: "방향성 베팅 축소. 캐리 수확에 집중. 유동성 프리미엄과 신규 발행 프리미엄 수확이 주요 알파 원천. 다음 레짐 전환을 준비하는 시간으로 활용.",
    risk: "정상 상태는 폭풍 전 고요일 수 있다. 시장이 오래 조용하면 갑작스러운 변동성 확대에 대비해야 한다.",
    historical: "대부분의 비이벤트 기간",
    engines: "⑤ Liquidity Premium: 시장이 조용할 때 유동성 할인 종목 수확 최적\n⑥ New Issue Premium: 안정적 시장에서 신규 발행 프리미엄이 예측 가능",
  },
  "크레딧 스트레스": {
    title: "크레딧 스트레스 (Credit Stress)",
    summary: "금리 보합 + 스프레드 확대 — 크레딧 리스크만 부각",
    description: "금리는 움직이지 않는데 크레딧 스프레드만 확대되는 국면. 특정 섹터 이벤트(부동산 PF, 건설사 부도 등) 또는 신용등급 하향이 촉발하는 경우가 많다. 전반적 경기보다 크레딧 고유 리스크가 주도한다.",
    strategy: "크레딧 방어 모드. 우량 세그먼트(은행채, 공사채 AAA)로 비중 이동. 스프레드 확대 종목 중 과매도 판단되는 것은 등급 경계 차익 기회. Z 버킷 확충.",
    risk: "스프레드 확대가 시스템 리스크로 확산될 경우 Flight to Quality로 전환.",
    historical: "2022년 10월 레고랜드 본격화, 섹터 이벤트 발생 시",
    engines: "④ Rating Boundary: 과매도 종목의 등급 경계 차익 기회\n⑤ Liquidity Premium: 유동성 경색 시 프리미엄 급등 → 역발상 매수 기회 (단, 환매 리스크 고려)",
  },
  "리플레이션": {
    title: "리플레이션 (Reflation)",
    summary: "금리 상승 + 스프레드 축소 — 경기 회복기, 금리는 오르지만 크레딧은 개선",
    description: "경기 회복에 대한 기대로 금리가 상승하지만, 동시에 기업 실적 개선 기대로 크레딧 스프레드는 축소되는 국면. 듀레이션 손실과 크레딧 수익이 상충하며, 듀레이션 숏 + 크레딧 롱의 바벨이 유효하다.",
    strategy: "듀레이션 언더웨이트 + 크레딧 오버웨이트. 단기물 중심으로 듀레이션 축소하면서 크레딧 캐리를 극대화하는 전략. 신규 발행 적극 참여. 래더 S/C 버킷 중심.",
    risk: "금리 상승 속도가 스프레드 축소 속도를 초과하면 전체 포트폴리오 손실 발생.",
    historical: "2021년 상반기, 경기 회복 초기",
    engines: "② Credit Selection: 크레딧 개선 종목 선정이 핵심\n⑥ New Issue Premium: 발행 시장 활성화로 프리미엄 수확",
  },
  "베어 스티프닝": {
    title: "베어 스티프닝 (Bear Steepening)",
    summary: "금리 상승 + 스프레드 보합 — 금리만 오르는 고통스러운 구간",
    description: "경기 과열이나 공급 부담(국채 대량 발행 등)으로 금리가 상승하지만, 크레딧 시장은 아직 반응하지 않는 국면. 듀레이션 손실이 직접적이며, 크레딧 캐리만으로는 상쇄가 어렵다.",
    strategy: "듀레이션 적극 언더웨이트. 초단기물 중심으로 방어. 래더 Z/S 버킷 비중 확대. 금리 안정화 시그널을 기다리며 현금 비중 확대.",
    risk: "금리 상승이 지속되면 스프레드 확대로 이어질 수 있다 (→ 스태그플레이션).",
    historical: "2022년 상반기, 국채 발행 급증 시",
    engines: "③ Segment Allocation: 금리 민감도가 낮은 세그먼트 선택이 핵심",
  },
  "스태그플레이션": {
    title: "스태그플레이션 (Stagflation)",
    summary: "금리 상승 + 스프레드 확대 — 최악의 환경",
    description: "인플레이션 압력으로 금리가 상승하면서 동시에 경기 둔화로 크레딧 스프레드도 확대되는 최악의 국면. 듀레이션 손실과 크레딧 손실이 동시에 발생한다. 펀드 운용에서 가장 어려운 환경.",
    strategy: "전면 방어 모드. 듀레이션 최소화 + 크레딧 최소화. Z 버킷 비중 극대화 (20%까지). 국고채/정부보증 초단기물 중심. 현금성 자산 확보. 손실 최소화가 최우선.",
    risk: "이 레짐에서는 알파를 만들기보다 손실을 줄이는 것이 목표. 벤치마크 대비 언더퍼폼이 불가피할 수 있다.",
    historical: "2022년 9-10월, 금리 급등 + 레고랜드 동시 발생",
    engines: "⑤ Liquidity Premium: 역설적으로 이 시기에 유동성 프리미엄이 극대화되므로, 환매 리스크를 감당할 수 있다면 장기적 알파 원천이 될 수 있다",
  },
};

// ═══════════════════════════════════════════════════════
// FILE PARSER (CP949 Tab-separated)
// ═══════════════════════════════════════════════════════

function extractDateFromFilename(filename) {
  const m = filename.match(/(\d{6})/);
  if (!m) return null;
  const yy = m[1].substring(0, 2);
  const mm = m[1].substring(2, 4);
  const dd = m[1].substring(4, 6);
  return `20${yy}-${mm}-${dd}`;
}

async function parseFile(file) {
  const buffer = await file.arrayBuffer();
  let text;
  try {
    const decoder = new TextDecoder("euc-kr");
    text = decoder.decode(buffer);
  } catch {
    text = new TextDecoder("utf-8").decode(buffer);
  }

  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const date = extractDateFromFilename(file.name);
  const result = { date, filename: file.name, rates: {} };

  for (const cat of CATEGORIES) {
    if (cat.isRow4) {
      const cols = lines[3]?.split("\t") || [];
      result.rates[cat.key] = extractRates(cols);
    } else {
      for (const line of lines) {
        const cols = line.split("\t");
        if (cols[3]?.trim() === cat.matchCol4 && cols[4]?.trim() === cat.matchCol5) {
          result.rates[cat.key] = extractRates(cols);
          break;
        }
      }
    }
  }

  return result;
}

function extractRates(cols) {
  const map = {};
  TENORS.forEach((t, i) => {
    const val = parseFloat(cols[6 + i]);
    if (!isNaN(val)) map[t] = val;
  });
  return map;
}

// ═══════════════════════════════════════════════════════
// REGIME CALCULATION
// ═══════════════════════════════════════════════════════

function calcRegime(weeks) {
  if (!weeks || weeks.length < 2) return null;
  const latest = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  if (!latest?.rates?.govt || !prev?.rates?.govt) return null;
  if (!latest?.rates?.[SPREAD_KEY] || !prev?.rates?.[SPREAD_KEY]) return null;

  const rateNow = latest.rates.govt["3Y"];
  const ratePrev = prev.rates.govt["3Y"];
  if (rateNow == null || ratePrev == null) return null;
  const rateDelta = (rateNow - ratePrev) * 100;

  const spreadNow = (latest.rates[SPREAD_KEY]["3Y"] || 0) - rateNow;
  const spreadPrev = (prev.rates[SPREAD_KEY]["3Y"] || 0) - ratePrev;
  const spreadDelta = (spreadNow - spreadPrev) * 100;

  let rateDir;
  if (rateDelta < -RATE_THRESHOLD) rateDir = 0;
  else if (rateDelta > RATE_THRESHOLD) rateDir = 2;
  else rateDir = 1;

  let spreadDir;
  if (spreadDelta < -SPREAD_THRESHOLD) spreadDir = 0;
  else if (spreadDelta > SPREAD_THRESHOLD) spreadDir = 2;
  else spreadDir = 1;

  return {
    rateDir, spreadDir, rateDelta, spreadDelta, rateNow, ratePrev,
    spreadNow: spreadNow * 100, spreadPrev: spreadPrev * 100,
    regimeName: REGIME_NAMES[rateDir][spreadDir],
    regimeColor: REGIME_COLORS[rateDir][spreadDir],
    engines: REGIME_ENGINES[rateDir][spreadDir],
  };
}

function calc4WeekTrend(weeks) {
  if (!weeks || weeks.length < 4) return null;
  const latest = weeks[weeks.length - 1];
  const oldest = weeks[0];
  if (!latest?.rates?.govt || !oldest?.rates?.govt) return null;
  if (!latest?.rates?.[SPREAD_KEY] || !oldest?.rates?.[SPREAD_KEY]) return null;

  const rateNow = latest.rates.govt["3Y"];
  const rateOld = oldest.rates.govt["3Y"];
  const rateDelta = (rateNow - rateOld) * 100;
  const spreadNow = ((latest.rates[SPREAD_KEY]["3Y"] || 0) - rateNow) * 100;
  const spreadOld = ((oldest.rates[SPREAD_KEY]["3Y"] || 0) - rateOld) * 100;
  const spreadDelta = spreadNow - spreadOld;

  return { rateDelta, spreadDelta };
}

// ═══════════════════════════════════════════════════════
// SUPABASE HELPERS
// ═══════════════════════════════════════════════════════

async function loadSavedWeeks() {
  try {
    const res = await fetch("/api/regime");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    return data.weeks || [];
  } catch (err) {
    console.error("Load failed:", err);
    return [];
  }
}

async function saveWeek(pin, weekData, regime, trend4w) {
  try {
    const res = await fetch("/api/regime", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-pin": pin },
      body: JSON.stringify({
        week: { week_date: weekData.date, filename: weekData.filename, rates: weekData.rates },
        regime: regime || null,
        trend_4w: trend4w || null,
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    return { ok: true, msg: data.msg };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════

function PinModal({ onSubmit, onClose, error }) {
  const [pin, setPin] = useState("");
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#111827] border border-gray-700 rounded-xl p-6 w-80" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-white mb-1">관리자 인증</h3>
        <p className="text-[11px] text-gray-500 mb-4">데이터 업로드에는 PIN이 필요합니다</p>
        <input
          type="password"
          value={pin}
          onChange={e => setPin(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onSubmit(pin)}
          placeholder="PIN 입력"
          className="w-full px-3 py-2 rounded-lg bg-[#0a0e17] border border-gray-700 text-white text-sm mb-3 outline-none focus:border-amber-500"
          autoFocus
        />
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-3 py-2 rounded-lg border border-gray-700 text-gray-400 text-xs hover:bg-gray-800">취소</button>
          <button onClick={() => onSubmit(pin)} className="flex-1 px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-500">확인</button>
        </div>
      </div>
    </div>
  );
}

function FileUploadSlots({ files, onFileChange, isAdmin }) {
  const labels = ["W-3 (가장 오래된)", "W-2", "W-1", "W-0 (최신)"];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => {
        const file = files[i];
        const date = file?.date || file?.parsedDate;
        return (
          <label
            key={i}
            className={`
              relative flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed
              transition-all duration-200 min-h-[100px]
              ${!isAdmin ? "cursor-default" : "cursor-pointer"}
              ${file
                ? "border-emerald-500/30 bg-emerald-500/5"
                : i === 3
                  ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
                  : "border-gray-700 bg-[#0d1117] hover:border-gray-600"
              }
            `}
          >
            {isAdmin && (
              <input
                type="file"
                accept=".txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) onFileChange(i, e.target.files[0]);
                }}
              />
            )}
            <span className="text-[10px] font-bold tracking-wider uppercase text-gray-500 mb-1">
              {labels[i]}
            </span>
            {file ? (
              <>
                <span className="text-sm font-bold text-white">{date}</span>
                <span className="text-[10px] text-gray-500 mt-0.5 max-w-full truncate">
                  {file.filename || ""}
                </span>
              </>
            ) : (
              <>
                <span className="text-xl opacity-30 mb-1">📄</span>
                <span className="text-[11px] text-gray-600">
                  {isAdmin ? (i === 3 ? "최신 데이터 업로드" : "클릭하여 업로드") : "데이터 없음"}
                </span>
              </>
            )}
            {file && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-400 rounded-full" />
            )}
          </label>
        );
      })}
    </div>
  );
}

function RegimeMatrix({ regime, onCellClick, selectedCell }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-2 w-24" />
            {SPREAD_LABELS.map((s, i) => (
              <th key={i} className="p-2 text-center text-[11px] font-mono text-gray-400 font-normal">{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RATE_LABELS.map((r, ri) => (
            <tr key={ri}>
              <td className="p-2 text-right text-[11px] font-mono text-gray-400 whitespace-nowrap pr-3">{r}</td>
              {SPREAD_LABELS.map((_, ci) => {
                const name = REGIME_NAMES[ri][ci];
                const color = REGIME_COLORS[ri][ci];
                const isActive = regime && regime.rateDir === ri && regime.spreadDir === ci;
                const isSelected = selectedCell && selectedCell[0] === ri && selectedCell[1] === ci;
                const engines = REGIME_ENGINES[ri][ci];
                return (
                  <td key={ci} className="p-0" onClick={() => onCellClick([ri, ci])}>
                    <div
                      className={`m-1 p-3 rounded-lg cursor-pointer transition-all duration-200 text-center ${isActive ? "ring-2 ring-offset-1 ring-offset-[#0a0e17]" : isSelected ? "ring-1 ring-offset-1 ring-offset-[#0a0e17]" : "hover:brightness-125"}`}
                      style={{
                        backgroundColor: isActive ? `${color}25` : `${color}10`,
                        borderColor: color,
                        ...(isActive ? { boxShadow: `0 0 20px ${color}20`, outline: `2px solid ${color}` } : {}),
                        ...(isSelected && !isActive ? { outline: `1px solid ${color}60` } : {}),
                      }}
                    >
                      <div className="text-sm font-bold mb-1.5" style={{ color: isActive ? color : `${color}cc` }}>{name}</div>
                      {isActive && (
                        <div className="text-[10px] font-bold tracking-wider uppercase mb-1.5" style={{ color }}>● CURRENT</div>
                      )}
                      <div className="flex gap-1 justify-center flex-wrap">
                        {engines.map((e) => (
                          <span key={e} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
                            style={{ backgroundColor: `${ENGINE_COLORS[e]}20`, color: ENGINE_COLORS[e] }}>{e}</span>
                        ))}
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegimeDetail({ cell }) {
  if (!cell) return null;
  const name = REGIME_NAMES[cell[0]][cell[1]];
  const color = REGIME_COLORS[cell[0]][cell[1]];
  const info = REGIME_DESCRIPTIONS[name];
  if (!info) return null;
  return (
    <div className="rounded-xl border p-5 transition-all duration-300" style={{ borderColor: `${color}30`, backgroundColor: `${color}06` }}>
      <h3 className="text-lg font-extrabold mb-1" style={{ color }}>{info.title}</h3>
      <p className="text-xs text-gray-400 mb-4">{info.summary}</p>
      <div className="space-y-4">
        {[["시장 환경", info.description], ["운용 전략", info.strategy], ["리스크 & 전환 시그널", info.risk], ["유효 엔진", info.engines], ["과거 사례", info.historical]].map(([label, text]) => (
          <div key={label}>
            <h4 className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-1">{label}</h4>
            <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value, delta, unit, suffix, hideValue }) {
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  return (
    <div className="rounded-xl border border-gray-800 bg-[#111827] p-3.5">
      <div className="text-[10px] text-gray-500 font-mono mb-1">{label}</div>
      {!hideValue && <div className="text-lg font-extrabold text-white">{value}</div>}
      <div className={`text-sm font-bold ${isPositive ? "text-red-400" : isNegative ? "text-blue-400" : "text-gray-500"}`}>
        {isPositive ? "▲" : isNegative ? "▼" : "─"}{" "}
        {Math.abs(delta).toFixed(1)}{unit}
        <span className="text-[10px] text-gray-600 ml-1">{suffix}</span>
      </div>
    </div>
  );
}

function DataSummary({ weeks, regime, trend4w }) {
  if (!weeks || weeks.length < 2 || !regime) return null;
  const latest = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  const categories = CATEGORIES.filter(c => latest.rates[c.key] && prev.rates[c.key]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="국고 3Y" value={`${regime.rateNow.toFixed(3)}%`} delta={regime.rateDelta} unit="bp" suffix="WoW" />
        <MetricCard label="AA- 스프레드 3Y" value={`${regime.spreadNow.toFixed(1)}bp`} delta={regime.spreadDelta} unit="bp" suffix="WoW" />
        {trend4w && (
          <>
            <MetricCard label="국고 3Y (4주)" delta={trend4w.rateDelta} unit="bp" suffix="4W" hideValue />
            <MetricCard label="AA- 스프레드 (4주)" delta={trend4w.spreadDelta} unit="bp" suffix="4W" hideValue />
          </>
        )}
      </div>
      <div className="rounded-xl border border-gray-800 bg-[#111827] overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left p-2.5 text-gray-500 font-mono font-normal">구분</th>
              {KEY_TENORS.map(t => (<th key={t} className="text-center p-2.5 text-gray-500 font-mono font-normal">{t}</th>))}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const now = latest.rates[cat.key];
              const prv = prev.rates[cat.key];
              return (
                <tr key={cat.key} className="border-b border-gray-800/50">
                  <td className="p-2.5 text-gray-300 font-semibold whitespace-nowrap">{cat.label}</td>
                  {KEY_TENORS.map(t => {
                    const val = now?.[t]; const pVal = prv?.[t];
                    const delta = (val != null && pVal != null) ? ((val - pVal) * 100) : null;
                    return (
                      <td key={t} className="text-center p-2.5">
                        {val != null ? (
                          <div>
                            <div className="text-gray-200">{val.toFixed(3)}</div>
                            {delta != null && (
                              <div className={`text-[10px] ${delta > 0 ? "text-red-400" : delta < 0 ? "text-blue-400" : "text-gray-600"}`}>
                                {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                              </div>
                            )}
                          </div>
                        ) : <span className="text-gray-700">-</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="bg-[#0d1117]/60">
              <td className="p-2.5 text-amber-400 font-bold whitespace-nowrap">AA- 스프레드</td>
              {KEY_TENORS.map(t => {
                const gN = latest.rates.govt?.[t]; const cN = latest.rates[SPREAD_KEY]?.[t];
                const gP = prev.rates.govt?.[t]; const cP = prev.rates[SPREAD_KEY]?.[t];
                const sN = (gN != null && cN != null) ? ((cN - gN) * 100) : null;
                const sP = (gP != null && cP != null) ? ((cP - gP) * 100) : null;
                const d = (sN != null && sP != null) ? (sN - sP) : null;
                return (
                  <td key={t} className="text-center p-2.5">
                    {sN != null ? (
                      <div>
                        <div className="text-amber-300 font-semibold">{sN.toFixed(1)}</div>
                        {d != null && (
                          <div className={`text-[10px] ${d > 0 ? "text-red-400" : d < 0 ? "text-blue-400" : "text-gray-600"}`}>
                            {d > 0 ? "+" : ""}{d.toFixed(1)}
                          </div>
                        )}
                      </div>
                    ) : <span className="text-gray-700">-</span>}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WeeklyTimeline({ weeks, regimes }) {
  if (!weeks || weeks.length < 2) return null;
  return (
    <div className="rounded-xl border border-gray-800 bg-[#111827] p-5">
      <h4 className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-4">Weekly Regime Timeline</h4>
      <div className="flex items-center gap-2 flex-wrap">
        {regimes.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            {i > 0 && <span className="text-gray-700">→</span>}
            <div className="px-3 py-2 rounded-lg text-center" style={{ backgroundColor: r ? `${r.regimeColor}15` : "#111827", border: `1px solid ${r ? `${r.regimeColor}40` : "#333"}` }}>
              <div className="text-[10px] text-gray-500 font-mono mb-0.5">{weeks[i + 1]?.date || "?"}</div>
              <div className="text-xs font-bold" style={{ color: r?.regimeColor || "#666" }}>{r?.regimeName || "-"}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                {r ? `${r.rateDelta > 0 ? "+" : ""}${r.rateDelta.toFixed(1)}bp / ${r.spreadDelta > 0 ? "+" : ""}${r.spreadDelta.toFixed(1)}bp` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════

export default function MarketRegimeDetector() {
  const [weeks, setWeeks] = useState([null, null, null, null]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [parseError, setParseError] = useState(null);

  // Admin / PIN state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinError, setPinError] = useState("");
  const [saveStatus, setSaveStatus] = useState(null); // { ok, msg } or null

  // Loading state
  const [loading, setLoading] = useState(true);

  // Check sessionStorage for admin
  useEffect(() => {
    const stored = sessionStorage.getItem("wolfpack_regime_pin");
    if (stored) { setAdminPin(stored); setIsAdmin(true); }
  }, []);

  // Load saved data from Supabase on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      const saved = await loadSavedWeeks();
      if (saved.length > 0) {
        // Map saved weeks into slots (up to 4, oldest first)
        const slots = [null, null, null, null];
        const sorted = saved.sort((a, b) => a.week_date.localeCompare(b.week_date));
        // Fill from the end: most recent = slot 3
        for (let i = 0; i < Math.min(sorted.length, 4); i++) {
          const offset = 4 - Math.min(sorted.length, 4) + i;
          slots[offset] = {
            date: sorted[i].week_date,
            filename: sorted[i].filename || "",
            rates: sorted[i].rates || {},
          };
        }
        setWeeks(slots);
      }
      setLoading(false);
    })();
  }, []);

  const handlePinSubmit = useCallback((pin) => {
    // Verify against server by doing a test save? No, just store and let actual save verify.
    // For UX: accept any non-empty PIN, actual verification happens on save.
    if (!pin || pin.length < 2) {
      setPinError("PIN을 입력해주세요");
      return;
    }
    setAdminPin(pin);
    setIsAdmin(true);
    setShowPinModal(false);
    setPinError("");
    sessionStorage.setItem("wolfpack_regime_pin", pin);
  }, []);

  const handleFileChange = useCallback(async (slotIndex, file) => {
    if (!isAdmin) {
      setShowPinModal(true);
      return;
    }
    try {
      setParseError(null);
      setSaveStatus(null);
      const parsed = await parseFile(file);

      setWeeks(prev => {
        const next = [...prev];

        // Auto-shift logic
        if (slotIndex === 3 && next[0] && next[1] && next[2]) {
          const prevSlot3 = prev[3];
          if (prevSlot3 && parsed.date !== prevSlot3.date) {
            next[0] = prev[1];
            next[1] = prev[2];
            next[2] = prevSlot3;
            next[3] = parsed;
          } else {
            next[slotIndex] = parsed;
          }
        } else {
          next[slotIndex] = parsed;
        }

        // Save to Supabase (async, fire-and-forget with status)
        const validNext = next.filter(Boolean);
        const sortedNext = [...validNext].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        let newRegime = null;
        let newTrend = null;
        if (sortedNext.length >= 2) {
          newRegime = calcRegime([sortedNext[sortedNext.length - 2], sortedNext[sortedNext.length - 1]]);
          newTrend = calc4WeekTrend(sortedNext);
        }

        saveWeek(adminPin, parsed, newRegime, newTrend).then(result => {
          if (result.ok) {
            setSaveStatus({ ok: true, msg: result.msg });
          } else {
            setSaveStatus({ ok: false, msg: result.error });
            // PIN이 틀린 경우
            if (result.error?.includes("PIN")) {
              setIsAdmin(false);
              setAdminPin("");
              sessionStorage.removeItem("wolfpack_regime_pin");
            }
          }
        });

        return next;
      });
    } catch (err) {
      setParseError(`파일 파싱 오류: ${err.message}`);
    }
  }, [isAdmin, adminPin]);

  const validWeeks = weeks.filter(Boolean);
  const sortedWeeks = useMemo(() => {
    return [...validWeeks].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }, [validWeeks]);

  const weeklyRegimes = useMemo(() => {
    if (sortedWeeks.length < 2) return [];
    const regimes = [];
    for (let i = 1; i < sortedWeeks.length; i++) {
      regimes.push(calcRegime([sortedWeeks[i - 1], sortedWeeks[i]]));
    }
    return regimes;
  }, [sortedWeeks]);

  const currentRegime = weeklyRegimes.length > 0 ? weeklyRegimes[weeklyRegimes.length - 1] : null;
  const trend4w = useMemo(() => calc4WeekTrend(sortedWeeks), [sortedWeeks]);

  return (
    <div className="min-h-screen bg-[#0a0e17] text-gray-200">
      {/* PIN Modal */}
      {showPinModal && (
        <PinModal
          onSubmit={handlePinSubmit}
          onClose={() => { setShowPinModal(false); setPinError(""); }}
          error={pinError}
        />
      )}

      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-6">
        <div className="max-w-5xl mx-auto">
          <Link href="/modules/alpha-cockpit" className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors mb-4">
            ← Alpha Cockpit
          </Link>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[10px] font-bold tracking-[0.3em] text-amber-500/80 uppercase">Detection Layer</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Market Regime Detector</h1>
              <p className="text-xs text-gray-500 mt-1">9-Regime Matrix · 금리 방향 × 스프레드 방향 · 국고3Y + AA- 스프레드 기준</p>
            </div>
            {/* Admin toggle */}
            <button
              onClick={() => {
                if (isAdmin) {
                  setIsAdmin(false);
                  setAdminPin("");
                  sessionStorage.removeItem("wolfpack_regime_pin");
                } else {
                  setShowPinModal(true);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                isAdmin
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  : "border-gray-700 bg-[#111827] text-gray-500 hover:border-gray-600"
              }`}
            >
              {isAdmin ? "🔓 Admin" : "🔒 로그인"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="text-2xl mb-2 animate-pulse">📡</div>
            <p className="text-sm text-gray-500">저장된 데이터 불러오는 중...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* File Upload */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold tracking-widest uppercase text-gray-500">
                  Data Upload · 4주 데이터
                </h2>
                <div className="flex items-center gap-3">
                  {saveStatus && (
                    <span className={`text-[10px] font-mono ${saveStatus.ok ? "text-emerald-400" : "text-red-400"}`}>
                      {saveStatus.ok ? `✓ ${saveStatus.msg}` : `✗ ${saveStatus.msg}`}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-600 font-mono">
                    {validWeeks.length}/4 loaded
                  </span>
                </div>
              </div>
              <FileUploadSlots files={weeks} onFileChange={handleFileChange} isAdmin={isAdmin} />
              {parseError && <p className="text-xs text-red-400 mt-2">{parseError}</p>}
              <p className="text-[10px] text-gray-600 mt-2">
                {isAdmin
                  ? "다음 주부터는 W-0(최신)만 업로드하면 기존 데이터가 자동으로 한 칸씩 밀립니다. 저장은 Supabase에 자동으로 됩니다."
                  : "데이터 업로드는 관리자 로그인 후 가능합니다. 저장된 데이터는 자동으로 표시됩니다."
                }
              </p>
            </section>

            {/* Current Regime Banner */}
            {currentRegime && (
              <section className="rounded-xl border p-6 text-center" style={{ borderColor: `${currentRegime.regimeColor}40`, backgroundColor: `${currentRegime.regimeColor}08`, boxShadow: `0 0 40px ${currentRegime.regimeColor}10` }}>
                <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-2">Current Regime</div>
                <div className="text-3xl font-black mb-2" style={{ color: currentRegime.regimeColor }}>{currentRegime.regimeName}</div>
                <div className="flex items-center justify-center gap-6 text-sm">
                  <span className={currentRegime.rateDelta > 0 ? "text-red-400" : currentRegime.rateDelta < 0 ? "text-blue-400" : "text-gray-400"}>
                    금리 {currentRegime.rateDelta > 0 ? "▲" : currentRegime.rateDelta < 0 ? "▼" : "─"} {Math.abs(currentRegime.rateDelta).toFixed(1)}bp
                  </span>
                  <span className="text-gray-700">|</span>
                  <span className={currentRegime.spreadDelta > 0 ? "text-red-400" : currentRegime.spreadDelta < 0 ? "text-blue-400" : "text-gray-400"}>
                    스프레드 {currentRegime.spreadDelta > 0 ? "▲" : currentRegime.spreadDelta < 0 ? "▼" : "─"} {Math.abs(currentRegime.spreadDelta).toFixed(1)}bp
                  </span>
                </div>
                <div className="flex gap-1.5 justify-center mt-3">
                  {currentRegime.engines.map((e) => (
                    <span key={e} className="inline-block px-2 py-0.5 rounded text-[11px] font-bold"
                      style={{ backgroundColor: `${ENGINE_COLORS[e]}20`, color: ENGINE_COLORS[e] }}>Engine {e}</span>
                  ))}
                </div>
              </section>
            )}

            {/* 9-Regime Matrix */}
            <section>
              <h2 className="text-xs font-bold tracking-widest uppercase text-gray-500 mb-3">9-Regime Matrix</h2>
              <RegimeMatrix regime={currentRegime} onCellClick={setSelectedCell} selectedCell={selectedCell} />
              <p className="text-[10px] text-gray-600 mt-2">
                각 셀을 클릭하면 해당 레짐의 상세 설명을 볼 수 있습니다 · 임계값: 금리 ±{RATE_THRESHOLD}bp, 스프레드 ±{SPREAD_THRESHOLD}bp
              </p>
            </section>

            {/* Regime Detail */}
            {selectedCell && (
              <section><RegimeDetail cell={selectedCell} /></section>
            )}

            {/* Weekly Timeline */}
            {weeklyRegimes.length > 0 && (
              <section>
                <h2 className="text-xs font-bold tracking-widest uppercase text-gray-500 mb-3">Regime Timeline</h2>
                <WeeklyTimeline weeks={sortedWeeks} regimes={weeklyRegimes} />
              </section>
            )}

            {/* Data Summary */}
            {sortedWeeks.length >= 2 && currentRegime && (
              <section>
                <h2 className="text-xs font-bold tracking-widest uppercase text-gray-500 mb-3">Rate & Spread Table</h2>
                <DataSummary weeks={sortedWeeks} regime={currentRegime} trend4w={trend4w} />
              </section>
            )}

            {/* Empty State */}
            {validWeeks.length < 2 && !loading && (
              <section className="text-center py-16">
                <div className="text-4xl mb-4 opacity-30">📊</div>
                <p className="text-gray-500 text-sm">최소 2주 데이터를 업로드하면 레짐 판단이 시작됩니다</p>
                <p className="text-gray-600 text-xs mt-1">4주 데이터를 모두 업로드하면 추세 분석도 가능합니다</p>
              </section>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-6 text-center">
        <p className="text-xs text-gray-600 font-mono">
          Market Regime Detector v2.0
          <span className="text-gray-700 mx-1">·</span>
          3×3 Matrix · 국고3Y · AA- 스프레드 · WoW 변화 기준
          <span className="text-gray-700 mx-1">·</span>
          Supabase 연동
        </p>
      </footer>
    </div>
  );
}
