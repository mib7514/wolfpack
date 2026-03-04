"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine, Area, ComposedChart,
} from "recharts";

// ─── DESIGN TOKENS ───
const BG = "#0A0A0F", BGC = "#111118", BGC2 = "#16161F", BD = "#2A2A35";
const T1 = "#E8E4DD", T2 = "#9A9690", T3 = "#5A5650";
const FED = "#4A9EFF", FED_L = "#7CB9FF", FED_D = "#2D6BBF";
const RED = "#E84855", GRN = "#3ECF8E", ORG = "#FF6B35", PUR = "#9B59B6", CYA = "#1ABC9C", GOLD = "#D4A017";

// ─── 2026 FOMC SCHEDULE ───
const FOMC_2026 = [
  { date: "2026-01-28", label: "Jan", done: true, decision: "HOLD", rate: "350-375" },
  { date: "2026-03-18", label: "Mar", done: false },
  { date: "2026-04-29", label: "Apr", done: false },
  { date: "2026-06-17", label: "Jun", done: false, sep: true },
  { date: "2026-07-29", label: "Jul", done: false },
  { date: "2026-09-17", label: "Sep", done: false, sep: true },
  { date: "2026-10-29", label: "Oct", done: false },
  { date: "2026-12-10", label: "Dec", done: false, sep: true },
];

// ─── RATE RANGES ───
const RATE_RANGES = [
  "400-425", "375-400", "350-375", "325-350", "300-325", "275-300", "250-275", "225-250"
];
const rangeToMid = (r) => {
  const [lo, hi] = r.split("-").map(Number);
  return ((lo + hi) / 2) / 100;
};

// ─── SEED DATA (initial probabilities as of ~Mar 1, 2026) ───
const SEED_PROBS = {
  "2026-03-18": { "350-375": 96, "325-350": 4 },
  "2026-04-29": { "350-375": 82.1, "325-350": 17.3, "300-325": 0.6 },
  "2026-06-17": { "350-375": 46.5, "325-350": 46.8, "300-325": 6.4, "275-300": 0.3 },
  "2026-07-29": { "350-375": 33.2, "325-350": 43.1, "300-325": 19.8, "275-300": 3.6, "250-275": 0.3 },
  "2026-09-17": { "350-375": 21.8, "325-350": 36.2, "300-325": 28.4, "275-300": 10.9, "250-275": 2.4, "225-250": 0.3 },
  "2026-10-29": { "350-375": 16.1, "325-350": 30.5, "300-325": 28.9, "275-300": 16.7, "250-275": 5.8, "225-250": 1.7, "200-225": 0.3 },
  "2026-12-10": { "350-375": 5.4, "325-350": 21.1, "300-325": 32.5, "275-300": 25.9, "250-275": 11.7, "225-250": 3.0, "200-225": 0.4 },
};

// Seed time-series snapshots (simulated historical data for richer initial chart)
const SEED_SNAPSHOTS = [
  { date: "2026-01-29", meetings: [
    { date: "2026-03-18", label: "Mar", expected_rate: 3.59, cut_prob: 6 },
    { date: "2026-06-17", label: "Jun", expected_rate: 3.38, cut_prob: 35 },
    { date: "2026-09-17", label: "Sep", expected_rate: 3.18, cut_prob: 55 },
    { date: "2026-12-10", label: "Dec", expected_rate: 3.01, cut_prob: 72 },
  ]},
  { date: "2026-02-05", meetings: [
    { date: "2026-03-18", label: "Mar", expected_rate: 3.60, cut_prob: 5 },
    { date: "2026-06-17", label: "Jun", expected_rate: 3.40, cut_prob: 32 },
    { date: "2026-09-17", label: "Sep", expected_rate: 3.21, cut_prob: 52 },
    { date: "2026-12-10", label: "Dec", expected_rate: 3.05, cut_prob: 68 },
  ]},
  { date: "2026-02-12", meetings: [
    { date: "2026-03-18", label: "Mar", expected_rate: 3.57, cut_prob: 10 },
    { date: "2026-06-17", label: "Jun", expected_rate: 3.34, cut_prob: 41 },
    { date: "2026-09-17", label: "Sep", expected_rate: 3.14, cut_prob: 59 },
    { date: "2026-12-10", label: "Dec", expected_rate: 2.97, cut_prob: 76 },
  ]},
  { date: "2026-02-19", meetings: [
    { date: "2026-03-18", label: "Mar", expected_rate: 3.60, cut_prob: 4.5 },
    { date: "2026-06-17", label: "Jun", expected_rate: 3.37, cut_prob: 38 },
    { date: "2026-09-17", label: "Sep", expected_rate: 3.16, cut_prob: 56 },
    { date: "2026-12-10", label: "Dec", expected_rate: 3.02, cut_prob: 72 },
  ]},
  { date: "2026-02-27", meetings: [
    { date: "2026-03-18", label: "Mar", expected_rate: 3.61, cut_prob: 4 },
    { date: "2026-06-17", label: "Jun", expected_rate: 3.35, cut_prob: 42 },
    { date: "2026-09-17", label: "Sep", expected_rate: 3.14, cut_prob: 58 },
    { date: "2026-12-10", label: "Dec", expected_rate: 3.00, cut_prob: 74 },
  ]},
];

function calcExpectedRate(probs) {
  let sum = 0, totalPct = 0;
  for (const [range, pct] of Object.entries(probs)) {
    sum += rangeToMid(range) * pct;
    totalPct += pct;
  }
  return totalPct > 0 ? sum / totalPct : 3.625;
}

// ─── COMPONENTS ───

function MeetingTab({ m, selected, onClick }) {
  const isPast = m.done;
  const isNext = !m.done && !selected;
  const d = new Date(m.date);
  const dayStr = `${d.getMonth() + 1}/${d.getDate()}`;
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px", borderRadius: 8, border: "none", cursor: isPast ? "default" : "pointer",
        background: selected ? FED : isPast ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
        color: selected ? "#fff" : isPast ? T3 : T2,
        opacity: isPast ? 0.5 : 1,
        fontSize: 11, fontWeight: 700, transition: "all 0.15s",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 54,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 800 }}>{m.label}</span>
      <span style={{ fontSize: 8 }}>{dayStr}</span>
      {isPast && <span style={{ fontSize: 7, color: m.decision === "HOLD" ? T3 : GRN }}>{m.decision}</span>}
      {m.sep && !isPast && <span style={{ fontSize: 6, color: FED_L, marginTop: 1 }}>SEP</span>}
    </button>
  );
}

function ProbBar({ range, pct, isHighest, currentRange }) {
  const isCurrent = range === currentRange;
  const color = isCurrent ? FED : isHighest ? GRN : "rgba(255,255,255,0.15)";
  const lo = parseInt(range.split("-")[0]);
  const hi = parseInt(range.split("-")[1]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 10, color: T2, minWidth: 64, textAlign: "right", fontFamily: "monospace" }}>
        {(lo / 100).toFixed(2)}-{(hi / 100).toFixed(2)}%
      </span>
      <div style={{ flex: 1, height: 20, background: "rgba(255,255,255,0.04)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
        <div style={{
          width: `${Math.max(pct, 0.5)}%`, height: "100%", borderRadius: 4,
          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
          transition: "width 0.5s ease",
        }} />
        {pct > 3 && (
          <span style={{
            position: "absolute", left: `${Math.min(pct, 95)}%`, top: "50%", transform: "translate(-100%, -50%)",
            fontSize: 9, fontWeight: 700, color: "#fff", paddingRight: 6,
          }}>{pct.toFixed(1)}%</span>
        )}
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: pct > 50 ? GRN : pct > 20 ? FED : T3, minWidth: 40, textAlign: "right" }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

// ═══ MAIN ═══
export default function FedWatchPage() {
  const [selectedMeeting, setSelectedMeeting] = useState("2026-06-17");
  const [timeSeriesMeeting, setTimeSeriesMeeting] = useState("2026-12-10");
  const [updating, setUpdating] = useState(false);
  const [updateLog, setUpdateLog] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Live data
  const [probs, setProbs] = useState(SEED_PROBS);
  const [snapshots, setSnapshots] = useState(SEED_SNAPSHOTS);
  const [commentary, setCommentary] = useState({
    fed_ye2026_projection: "3.25-3.50",
    market_ye2026_expected: "3.00-3.25",
    cuts_priced_2026: 2,
    first_cut_expected: "Jun 2026",
    commentary: "Fed는 인플레이션 2% 목표 달성 전까지 신중한 접근 유지. 시장은 6월 첫 인하 기대. 트럼프 관세 영향 불확실성이 핵심 변수.",
    risks: ["관세 인플레이션 재점화", "노동시장 약화 가속", "Powell 임기 만료 (5/15) → 신임 의장 정책 불확실성"],
    recent_fed_speakers: [
      { name: "Powell", date: "2026-01-28", message: "경제 견조, 추가 데이터 관찰 필요" },
      { name: "Waller", date: "2026-02-20", message: "한 달 데이터로 추세 판단 어려워" },
    ],
  });

  // Load saved data
  useEffect(() => {
    async function load() {
      try {
        // Load latest
        const { data: latest } = await supabase
          .from("fedwatch_data")
          .select("data, updated_at")
          .eq("id", "latest")
          .single();
        if (latest?.data) {
          applyUpdate(latest.data);
          setLastUpdate(latest.updated_at);
        }
        // Load snapshots
        const { data: snaps } = await supabase
          .from("fedwatch_snapshots")
          .select("data")
          .order("id", { ascending: true });
        if (snaps?.length > 0) {
          const loaded = snaps.map(s => s.data).filter(Boolean);
          // Merge with seeds (avoid duplicates)
          const existingDates = new Set(loaded.map(s => s.date));
          const merged = [...SEED_SNAPSHOTS.filter(s => !existingDates.has(s.date)), ...loaded];
          merged.sort((a, b) => a.date.localeCompare(b.date));
          setSnapshots(merged);
        }
      } catch (e) {
        console.log("No saved FedWatch data yet");
      }
    }
    load();
  }, []);

  function applyUpdate(result) {
    if (result.probabilities?.meetings) {
      const newProbs = { ...probs };
      result.probabilities.meetings.forEach(m => {
        if (m.probs && m.date) {
          const p = {};
          m.probs.forEach(pr => { p[pr.range] = pr.pct; });
          newProbs[m.date] = p;
        }
      });
      setProbs(newProbs);

      // Add to snapshots
      const today = new Date().toISOString().split("T")[0];
      const snap = {
        date: today,
        meetings: result.probabilities.meetings.map(m => ({
          date: m.date, label: m.label,
          expected_rate: m.expected_rate || calcExpectedRate(
            m.probs ? Object.fromEntries(m.probs.map(p => [p.range, p.pct])) : {}
          ),
          cut_prob: m.cut_prob || 0,
        })),
      };
      setSnapshots(prev => {
        const filtered = prev.filter(s => s.date !== today);
        return [...filtered, snap].sort((a, b) => a.date.localeCompare(b.date));
      });
    }
    if (result.commentary) {
      setCommentary(result.commentary);
    }
  }

  // AI Update
  const handleUpdate = useCallback(async () => {
    setUpdating(true);
    setUpdateLog(["🔍 CME FedWatch 확률 데이터 검색 중..."]);
    try {
      const res = await fetch("/api/fedwatch-update", { method: "POST" });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      setUpdateLog(prev => [...prev, "✅ 데이터 수신 완료"]);
      applyUpdate(result);
      setLastUpdate(result.updated_at);

      const meetingCount = result.probabilities?.meetings?.length || 0;
      setUpdateLog(prev => [...prev,
        result.rate ? `📊 현재 금리: ${result.rate.current_rate_lower/100}%-${result.rate.current_rate_upper/100}%` : "",
        meetingCount > 0 ? `📅 ${meetingCount}개 FOMC 미팅 확률 업데이트` : "⚠️ 확률 데이터 부분 실패",
        "📸 시계열 스냅샷 저장 완료",
        "───────────────",
        "🎉 업데이트 완료!",
      ].filter(Boolean));
    } catch (err) {
      setUpdateLog(prev => [...prev, `❌ 오류: ${err.message}`]);
    } finally {
      setUpdating(false);
    }
  }, [probs]);

  // ─── Derived data ───
  const upcomingMeetings = FOMC_2026.filter(m => !m.done);
  const currentMeetingProbs = probs[selectedMeeting] || {};
  const expectedRate = calcExpectedRate(currentMeetingProbs);
  const currentRate = 3.625; // midpoint of 350-375
  const impliedCuts = Math.round((currentRate - expectedRate) / 0.25);

  // Sort prob bars
  const probBars = RATE_RANGES
    .filter(r => (currentMeetingProbs[r] || 0) > 0.1)
    .map(r => ({ range: r, pct: currentMeetingProbs[r] || 0 }))
    .sort((a, b) => {
      const aLo = parseInt(a.range.split("-")[0]);
      const bLo = parseInt(b.range.split("-")[0]);
      return bLo - aLo;
    });
  const highestRange = probBars.reduce((max, b) => b.pct > (max?.pct || 0) ? b : max, null)?.range;

  // Time series for selected meeting
  const tsData = snapshots
    .map(s => {
      const m = s.meetings?.find(m => m.date === timeSeriesMeeting);
      if (!m) return null;
      return {
        date: s.date,
        dateLabel: s.date.slice(5), // MM-DD
        expected_rate: m.expected_rate,
        cut_prob: m.cut_prob,
      };
    })
    .filter(Boolean);

  const selectedMeetingInfo = FOMC_2026.find(m => m.date === selectedMeeting);
  const tsMeetingInfo = FOMC_2026.find(m => m.date === timeSeriesMeeting);

  // Next meeting
  const nextMeeting = upcomingMeetings[0];
  const daysToNext = nextMeeting ? Math.ceil((new Date(nextMeeting.date) - new Date()) / 86400000) : 0;

  return (
    <div style={{ fontFamily: "'DM Sans','Pretendard',-apple-system,sans-serif", background: BG, color: T1, minHeight: "100vh" }}>
      {/* ─── HEADER ─── */}
      <div style={{ background: `linear-gradient(135deg, ${BG} 0%, #0F1525 50%, ${BG} 100%)`, borderBottom: `1px solid ${BD}`, padding: "18px 20px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ marginBottom: 4 }}><a href="/" style={{ fontSize: 10, color: T3, textDecoration: "none" }}>← Control Tower</a></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 26 }}>🐺</span>
              <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, background: `linear-gradient(90deg, ${FED}, ${FED_L})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Fed Watch Monitor</h1>
            </div>
            <p style={{ color: T2, fontSize: 11, margin: 0 }}>CME FedWatch 기반 FOMC 금리 전망 모니터링</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: T3 }}>현재 기준금리</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: FED }}>3.50-3.75%</div>
            {nextMeeting && <div style={{ fontSize: 9, color: T2, marginTop: 2 }}>
              다음 FOMC: {nextMeeting.label} ({nextMeeting.date.slice(5)}) · <span style={{ color: FED }}>{daysToNext}일 후</span>
            </div>}
          </div>
        </div>

        {/* Update button */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <button
            onClick={handleUpdate}
            disabled={updating}
            style={{
              padding: "6px 14px", fontSize: 11, fontWeight: 700, border: "none", borderRadius: 6,
              cursor: updating ? "not-allowed" : "pointer",
              background: updating ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${FED}, ${FED_D})`,
              color: updating ? T2 : "#fff", opacity: updating ? 0.7 : 1,
              display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s",
            }}
          >
            {updating ? (
              <><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: FED, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> 업데이트 중...</>
            ) : "🤖 AI 업데이트"}
          </button>
        </div>

        {/* Update log */}
        {updateLog.length > 0 && (
          <div style={{ marginTop: 8, background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: "10px 12px", border: `1px solid ${BD}`, maxHeight: 140, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: FED }}>📡 업데이트 로그</span>
              {!updating && <button onClick={() => setUpdateLog([])} style={{ fontSize: 9, color: T3, background: "none", border: "none", cursor: "pointer" }}>닫기 ✕</button>}
            </div>
            {updateLog.map((l, i) => <div key={i} style={{ fontSize: 10, color: T2, lineHeight: 1.6, fontFamily: "monospace" }}>{l}</div>)}
          </div>
        )}
        {lastUpdate && updateLog.length === 0 && (
          <div style={{ marginTop: 4, fontSize: 9, color: T3, textAlign: "right" }}>
            마지막 업데이트: {new Date(lastUpdate).toLocaleString("ko-KR")}
          </div>
        )}
      </div>

      {/* ─── CONTENT ─── */}
      <div style={{ padding: "14px 18px", maxWidth: 1100, margin: "0 auto" }}>

        {/* ══ KEY METRICS ══ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 14 }}>
          {[
            { label: "YE 2026 기대금리", value: `${calcExpectedRate(probs["2026-12-10"] || SEED_PROBS["2026-12-10"]).toFixed(2)}%`, sub: "확률가중 평균", c: FED },
            { label: "Fed Dot 전망", value: commentary.fed_ye2026_projection || "3.25-3.50", sub: "Dec SEP 기준", c: PUR },
            { label: "2026 인하 횟수", value: `${commentary.cuts_priced_2026 || 2}회`, sub: "시장 기대", c: GRN },
            { label: "첫 인하 시점", value: commentary.first_cut_expected || "Jun", sub: "가장 높은 확률", c: ORG },
          ].map((k, i) => (
            <div key={i} style={{ background: BGC, borderRadius: 10, padding: "12px 14px", border: `1px solid ${BD}` }}>
              <p style={{ fontSize: 9, color: T3, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{k.label}</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: k.c, margin: "0 0 2px" }}>{k.value}</p>
              <p style={{ fontSize: 10, color: T2, margin: 0 }}>{k.sub}</p>
            </div>
          ))}
        </div>

        {/* ══ TIME SERIES — EXPECTED RATE EVOLUTION ══ */}
        <div style={{ background: BGC, borderRadius: 12, padding: 16, border: `1px solid ${BD}`, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: FED }}>📈 기대금리 시계열</h3>
              <p style={{ fontSize: 10, color: T3, margin: "2px 0 0" }}>각 FOMC 미팅별 확률가중 기대금리의 시간에 따른 변화</p>
            </div>
          </div>
          {/* Meeting selector for time series */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
            {upcomingMeetings.filter((_, i) => {
              return true;
            }).map(m => (
              <button
                key={m.date}
                onClick={() => setTimeSeriesMeeting(m.date)}
                style={{
                  padding: "5px 12px", fontSize: 10, fontWeight: 700, border: "none", borderRadius: 5, cursor: "pointer",
                  background: timeSeriesMeeting === m.date ? FED : "rgba(255,255,255,0.06)",
                  color: timeSeriesMeeting === m.date ? "#fff" : T2, transition: "all 0.15s",
                }}
              >
                {m.label} ({m.date.slice(5)})
              </button>
            ))}
          </div>
          {tsData.length > 1 ? (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={tsData} margin={{ top: 5, right: 16, left: -4, bottom: 0 }}>
                <defs>
                  <linearGradient id="tsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={FED} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={FED} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="dateLabel" tick={{ fill: T2, fontSize: 9 }} />
                <YAxis
                  tick={{ fill: T2, fontSize: 9 }}
                  domain={['auto', 'auto']}
                  tickFormatter={v => `${v.toFixed(2)}%`}
                />
                <Tooltip
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div style={{ background: BGC, border: `1px solid ${BD}`, borderRadius: 6, padding: "8px 12px", fontSize: 11 }}>
                        <div style={{ fontWeight: 600 }}>{label}</div>
                        <div style={{ color: FED }}>기대금리: {payload[0]?.value?.toFixed(3)}%</div>
                        {payload[1]?.value != null && <div style={{ color: GRN }}>인하확률: {payload[1].value}%</div>}
                      </div>
                    ) : null
                  }
                />
                <ReferenceLine y={3.625} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" label={{ value: "현재 3.625%", fill: T3, fontSize: 8 }} />
                <Area type="monotone" dataKey="expected_rate" stroke="none" fill="url(#tsGrad)" />
                <Line type="monotone" dataKey="expected_rate" stroke={FED} strokeWidth={2.5} dot={{ r: 4, fill: FED, stroke: "#fff", strokeWidth: 1 }} name="기대금리" />

              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: T3, fontSize: 12 }}>
              📊 AI 업데이트를 누르면 데이터가 쌓여 시계열 차트가 생성됩니다
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 9, color: T3 }}>
            <span>FOMC {tsMeetingInfo?.label} ({timeSeriesMeeting.slice(5)}) 기준금리 기대값 추이</span>
            <span>{tsData.length}개 데이터 포인트</span>
          </div>
        </div>

        {/* ══ PROBABILITY DISTRIBUTION ══ */}
        <div style={{ background: BGC, borderRadius: 12, padding: 16, border: `1px solid ${BD}`, marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px", color: FED }}>🎯 FOMC 미팅별 금리 확률 분포</h3>

          {/* Meeting tabs */}
          <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 8, marginBottom: 12 }}>
            {FOMC_2026.map(m => (
              <MeetingTab
                key={m.date}
                m={m}
                selected={selectedMeeting === m.date}
                onClick={() => !m.done && setSelectedMeeting(m.date)}
              />
            ))}
          </div>

          {/* Selected meeting info */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "10px 14px", background: BGC2, borderRadius: 8, border: `1px solid ${BD}` }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700 }}>FOMC {selectedMeetingInfo?.label} · {selectedMeeting.slice(5)}</span>
              {selectedMeetingInfo?.sep && <span style={{ fontSize: 8, color: FED, background: `${FED}18`, padding: "1px 5px", borderRadius: 3, marginLeft: 6 }}>SEP</span>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: T3 }}>기대금리</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: FED }}>{expectedRate.toFixed(3)}%</div>
              {impliedCuts > 0 && <div style={{ fontSize: 9, color: GRN }}>-{impliedCuts * 25}bp ({impliedCuts}회 인하)</div>}
              {impliedCuts === 0 && <div style={{ fontSize: 9, color: T3 }}>동결</div>}
            </div>
          </div>

          {/* Probability bars */}
          <div style={{ marginBottom: 8 }}>
            {probBars.map(b => (
              <ProbBar key={b.range} range={b.range} pct={b.pct} isHighest={b.range === highestRange} currentRange="350-375" />
            ))}
          </div>

          {/* Summary badges */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "인하", pct: Object.entries(currentMeetingProbs).reduce((s, [r, p]) => parseInt(r.split("-")[0]) < 350 ? s + p : s, 0), color: GRN },
              { label: "동결", pct: currentMeetingProbs["350-375"] || 0, color: FED },
              { label: "인상", pct: Object.entries(currentMeetingProbs).reduce((s, [r, p]) => parseInt(r.split("-")[0]) > 350 ? s + p : s, 0), color: RED },
            ].map((b, i) => (
              <div key={i} style={{ background: `${b.color}12`, border: `1px solid ${b.color}30`, borderRadius: 6, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: T2 }}>{b.label}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: b.color }}>{b.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* ══ RATE PATH CHART ══ */}
        <div style={{ background: BGC, borderRadius: 12, padding: 16, border: `1px solid ${BD}`, marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", color: FED }}>📉 예상 금리 경로 (현재 vs Fed Dot)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={upcomingMeetings.map(m => ({
                meeting: m.label,
                market: parseFloat(calcExpectedRate(probs[m.date] || {}).toFixed(3)),
                fed_dot: m.date <= "2026-06-17" ? 3.50 : m.date <= "2026-09-17" ? 3.375 : 3.375,
              }))}
              margin={{ top: 5, right: 16, left: -4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="meeting" tick={{ fill: T2, fontSize: 10 }} />
              <YAxis tick={{ fill: T2, fontSize: 9 }} domain={[2.5, 4.0]} tickFormatter={v => `${v}%`} />
              <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                <div style={{ background: BGC, border: `1px solid ${BD}`, borderRadius: 6, padding: "8px 12px", fontSize: 11 }}>
                  <div style={{ fontWeight: 600 }}>{label} FOMC</div>
                  {payload.map((p, i) => <div key={i} style={{ color: p.stroke }}>{p.name}: {p.value?.toFixed(3)}%</div>)}
                </div>
              ) : null} />
              <ReferenceLine y={3.625} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="market" stroke={FED} strokeWidth={2.5} dot={{ r: 4, fill: FED }} name="시장 기대" />
              <Line type="monotone" dataKey="fed_dot" stroke={PUR} strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: PUR }} name="Fed Dot" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
            <span style={{ fontSize: 10, color: FED }}>● 시장 기대 (FedWatch)</span>
            <span style={{ fontSize: 10, color: PUR }}>◆ Fed Dot Plot (Dec SEP)</span>
          </div>
        </div>

        {/* ══ COMMENTARY ══ */}
        <div style={{ background: BGC, borderRadius: 12, padding: 16, border: `1px solid ${BD}`, marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px", color: FED }}>💬 시장 코멘터리</h3>
          <p style={{ fontSize: 11, color: T2, lineHeight: 1.7, margin: "0 0 12px" }}>{commentary.commentary}</p>

          <div style={{ fontSize: 11, fontWeight: 700, color: ORG, marginBottom: 6 }}>⚠️ 핵심 리스크</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
            {(commentary.risks || []).map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 10, color: T2, lineHeight: 1.5 }}>
                <span style={{ color: ORG, fontWeight: 700, minWidth: 14 }}>{i + 1}.</span> {r}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: PUR, marginBottom: 6 }}>🎤 최근 Fed 발언</div>
          {(commentary.recent_fed_speakers || []).map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: i < (commentary.recent_fed_speakers?.length || 0) - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: PUR, minWidth: 60 }}>{s.name}</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 10, color: T2 }}>{s.message}</span>
                <div style={{ fontSize: 8, color: T3, marginTop: 1 }}>{s.date}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ══ FOMC CALENDAR ══ */}
        <div style={{ background: BGC, borderRadius: 12, padding: 16, border: `1px solid ${BD}`, marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", color: FED }}>📅 2026 FOMC 미팅 캘린더</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 6 }}>
            {FOMC_2026.map((m, i) => {
              const p = probs[m.date];
              const er = p ? calcExpectedRate(p) : null;
              const cutP = p ? Object.entries(p).reduce((s, [r, pct]) => parseInt(r.split("-")[0]) < 350 ? s + pct : s, 0) : 0;
              return (
                <div key={i} style={{
                  background: m.done ? "rgba(255,255,255,0.02)" : BGC2,
                  borderRadius: 8, padding: "10px 12px",
                  border: `1px solid ${m.done ? "rgba(255,255,255,0.04)" : m.date === nextMeeting?.date ? FED + "40" : BD}`,
                  opacity: m.done ? 0.5 : 1,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 800 }}>{m.label}</span>
                    {m.sep && <span style={{ fontSize: 7, color: FED, background: `${FED}18`, padding: "1px 4px", borderRadius: 3 }}>SEP</span>}
                    {m.done && <span style={{ fontSize: 7, color: T3 }}>✓</span>}
                  </div>
                  <div style={{ fontSize: 9, color: T3, marginBottom: 4 }}>{m.date.slice(5)}</div>
                  {m.done ? (
                    <div style={{ fontSize: 10, color: T3 }}>{m.decision} · {m.rate?.replace("-", "~")}</div>
                  ) : er ? (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 800, color: FED }}>{er.toFixed(2)}%</div>
                      <div style={{ fontSize: 8, color: cutP > 50 ? GRN : T3 }}>인하 {cutP.toFixed(0)}%</div>
                    </>
                  ) : <div style={{ fontSize: 10, color: T3 }}>—</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ marginTop: 18, padding: "10px 0", borderTop: `1px solid ${BD}`, textAlign: "center" }}>
          <p style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", margin: 0, lineHeight: 1.5 }}>
            🐺 늑대무리원정단 | Source: CME FedWatch, Federal Reserve, FOMC
            <br />확률 데이터는 30-Day Fed Funds Futures 가격 기반. 투자 판단의 참고자료이며, 투자 권유가 아닙니다.
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
