"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ══════════════════════════════════════
// CPI INDEX DATA (1999-01 ~ 2026-02, monthly)
// US: CPIAUCSL (SA, 1982-84=100), KR: 2020=100
// ══════════════════════════════════════
const CPI_MONTHS = [];
const US_CPI_INDEX = [];
const KR_CPI_INDEX = [];

// ══════════════════════════════════════
// COMPUTE YoY & MoM FROM INDEX
// ══════════════════════════════════════
function computeRates(months, index) {
  const yoy = [];
  const mom = [];
  for (let i = 0; i < months.length; i++) {
    // MoM
    if (i > 0 && index[i] != null && index[i - 1] != null) {
      mom.push(Math.round(((index[i] / index[i - 1]) - 1) * 10000) / 100);
    } else {
      mom.push(null);
    }
    // YoY
    if (i >= 12 && index[i] != null && index[i - 12] != null) {
      yoy.push(Math.round(((index[i] / index[i - 12]) - 1) * 10000) / 100);
    } else {
      yoy.push(null);
    }
  }
  return { yoy, mom };
}

// ══════════════════════════════════════
// SERIES CONFIG
// ══════════════════════════════════════
const SERIES_DEFS = [
  { id: "US_YoY", label: "🇺🇸 미국 CPI YoY", type: "line", unit: "%", color: "#0046ff", width: 2.5, country: "us", rate: "yoy" },
  { id: "KR_YoY", label: "🇰🇷 한국 CPI YoY", type: "line", unit: "%", color: "#dc2626", width: 2.5, country: "kr", rate: "yoy" },
  { id: "US_MoM", label: "🇺🇸 미국 CPI MoM", type: "bar", unit: "%", color: "#0046ff", country: "us", rate: "mom" },
  { id: "KR_MoM", label: "🇰🇷 한국 CPI MoM", type: "bar", unit: "%", color: "#dc2626", country: "kr", rate: "mom" },
];
const SERIES_MAP = Object.fromEntries(SERIES_DEFS.map(s => [s.id, s]));

// ══════════════════════════════════════
// NICE SCALE (per RA chart spec)
// ══════════════════════════════════════
function niceScale(min, max) {
  const range = max - min;
  if (range <= 0) return { min: -1, max: 5, stepSize: 1 };
  const niceSteps = [0.1, 0.2, 0.25, 0.5, 1.0, 2.0, 5.0];
  for (const step of niceSteps) {
    const nMin = Math.floor(min / step) * step;
    const nMax = Math.ceil(max / step) * step;
    const nTicks = Math.round((nMax - nMin) / step) + 1;
    if (nTicks >= 5 && nTicks <= 12) return { min: nMin, max: nMax, stepSize: step };
  }
  return { min: Math.floor(min), max: Math.ceil(max), stepSize: 1 };
}

// ══════════════════════════════════════
// CHART COMPONENT
// ══════════════════════════════════════
function CPIChart({ months, series, selected, dateRange, fontSize = 13, yDecimals = 1 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !months) return;

    (async () => {
    // CDN load (per RA spec - no npm import)
    if (!window.Chart) {
      await new Promise((resolve, reject) => {
        if (document.querySelector('script[src*="chart.js"]')) {
          const check = setInterval(() => { if (window.Chart) { clearInterval(check); resolve(); } }, 50);
          return;
        }
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    const ChartJS = window.Chart;
    const ctx = canvasRef.current.getContext("2d");
    if (chartRef.current) chartRef.current.destroy();

    const FS = fontSize;
    const FONT_FAMILY = "'Pretendard', 'Apple SD Gothic Neo', sans-serif";
    const [si, ei] = dateRange;
    const slicedMonths = months.slice(si, ei + 1);

    // Build tickMap (per RA spec)
    const spanMonths = slicedMonths.length;
    const spanYears = spanMonths / 12;
    const tickMap = {};
    let prevLabel = "";
    for (let i = 0; i < spanMonths; i++) {
      const m = slicedMonths[i];
      if (!m) continue;
      const mm = m.slice(5, 7);
      if (spanYears > 8) {
        if (mm === "01" && prevLabel !== m.slice(0, 4)) { tickMap[i] = "'" + m.slice(2, 4); prevLabel = m.slice(0, 4); }
      } else if (spanYears > 3) {
        const ym = m.slice(0, 7);
        if ((mm === "01" || mm === "07") && prevLabel !== ym) { tickMap[i] = m.slice(2, 7).replace("-", "/"); prevLabel = ym; }
      } else {
        const ym = m.slice(0, 7);
        if ((mm === "01" || mm === "04" || mm === "07" || mm === "10") && prevLabel !== ym) { tickMap[i] = m.slice(2, 7).replace("-", "/"); prevLabel = ym; }
      }
    }

    // Compute y-axis range from visible data
    let allVals = [];
    selected.forEach(id => {
      const vals = (series[id] || []).slice(si, ei + 1).filter(v => v != null);
      allVals = allVals.concat(vals);
    });
    const dataMin = allVals.length > 0 ? Math.min(...allVals) : -1;
    const dataMax = allVals.length > 0 ? Math.max(...allVals) : 5;
    const pad = (dataMax - dataMin) * 0.1 || 0.5;
    const ns = niceScale(dataMin - pad, dataMax + pad);

    // Build datasets
    const datasets = selected.map(id => {
      const cfg = SERIES_MAP[id];
      if (!cfg) return null;
      const rawData = (series[id] || []).slice(si, ei + 1);

      if (cfg.type === "bar") {
        return {
          type: "bar",
          label: cfg.label,
          data: rawData,
          backgroundColor: cfg.color + "55",
          borderColor: cfg.color,
          borderWidth: 1,
          barPercentage: 0.7,
          categoryPercentage: 0.9,
          yAxisID: "y",
          order: 2,
        };
      } else {
        return {
          type: "line",
          label: cfg.label,
          data: rawData,
          borderColor: cfg.color,
          backgroundColor: "transparent",
          borderWidth: cfg.width || 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.2,
          yAxisID: "y",
          spanGaps: true,
          order: 1,
        };
      }
    }).filter(Boolean);

    // Axis label plugin (per RA spec)
    const axisLabelPlugin = {
      id: "axisLabel",
      afterDraw: (chart) => {
        const c = chart.ctx;
        c.save();
        c.font = "bold " + FS + "px 'Pretendard', sans-serif";
        c.fillStyle = "#000000";
        if (chart.scales.y) {
          const yA = chart.scales.y;
          c.textAlign = "center";
          c.fillText("(%)", yA.left + yA.width / 2, yA.top - Math.max(6, FS * 0.5));
        }
        c.restore();
      }
    };

    chartRef.current = new ChartJS(ctx, {
      data: { labels: slicedMonths, datasets },
      plugins: [axisLabelPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        interaction: { mode: "index", intersect: false },
        layout: { padding: { top: FS + 12, right: 8, bottom: FS + 8, left: 4 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#fff",
            titleColor: "#000",
            bodyColor: "#000",
            borderColor: "#d0d5dd",
            borderWidth: 1,
            titleFont: { size: FS, family: FONT_FAMILY, weight: "700" },
            bodyFont: { size: FS - 1, family: FONT_FAMILY },
            padding: 12,
            boxPadding: 5,
            callbacks: {
              label: function(ctx) {
                const val = ctx.parsed.y;
                return " " + ctx.dataset.label + ": " + (val != null ? val.toFixed(2) + "%" : "-");
              }
            }
          },
        },
        scales: {
          x: {
            type: "category",
            ticks: {
              autoSkip: false,
              maxRotation: 0,
              font: { family: FONT_FAMILY, size: FS },
              color: "#000000",
              callback: function(val, idx) { return tickMap[idx] || null; }
            },
            grid: {
              color: function(ctx) { return tickMap[ctx.tick?.value] ? "#d0d5dd" : "transparent"; },
              drawBorder: false,
              drawTicks: false,
            },
            border: { display: false },
          },
          y: {
            position: "left",
            min: ns.min, max: ns.max,
            title: { display: false },
            ticks: {
              stepSize: ns.stepSize,
              font: { family: FONT_FAMILY, size: FS },
              color: "#000000",
              callback: v => v.toFixed(yDecimals),
            },
            grid: { color: "#e8ecf0", drawBorder: false, drawTicks: false },
            border: { display: false },
            afterFit: function(axis) { axis.paddingTop = FS + 16; },
          },
        },
      },
    });

    })();
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [months, series, selected, dateRange, fontSize, yDecimals]);

  return <canvas ref={canvasRef} />;
}

// ══════════════════════════════════════
// CUSTOM LEGEND (per RA spec)
// ══════════════════════════════════════
function CustomLegend({ selected, fontSize = 13 }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: "6px 16px", padding: "8px 16px",
      justifyContent: "center", alignItems: "center",
      background: "#f8f9fb", borderRadius: 8, border: "1px solid #e2e8f0",
      marginBottom: 6,
    }}>
      {selected.map(id => {
        const cfg = SERIES_MAP[id];
        if (!cfg) return null;
        const isBar = cfg.type === "bar";
        return (
          <div key={id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize }}>
            {isBar ? (
              <span style={{ display: "inline-block", width: 14, height: 10, background: cfg.color + "55", border: `1px solid ${cfg.color}`, borderRadius: 2 }} />
            ) : (
              <span style={{ display: "inline-block", width: 20, height: 3, background: cfg.color, borderRadius: 2 }} />
            )}
            <span style={{ color: "#000", fontWeight: 600 }}>{cfg.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════
// RANGE SLIDER (per RA spec - with month snap)
// ══════════════════════════════════════
function RangeSlider({ min, max, value, onChange, labels, height = 44 }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(null);

  const getPos = useCallback((e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
    return Math.max(min, Math.min(max, Math.round(min + (x / rect.width) * (max - min))));
  }, [min, max]);

  const handleDown = useCallback((e, handle) => { e.preventDefault(); setDragging(handle); }, []);

  useEffect(() => {
    if (dragging === null) return;
    const handleMove = (e) => {
      const pos = getPos(e);
      if (dragging === "left") onChange([Math.min(pos, value[1] - 1), value[1]]);
      else onChange([value[0], Math.max(pos, value[0] + 1)]);
    };
    const handleUp = () => setDragging(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [dragging, value, min, max, getPos, onChange]);

  const leftPct = ((value[0] - min) / (max - min)) * 100;
  const rightPct = ((value[1] - min) / (max - min)) * 100;

  return (
    <div style={{ position: "relative", height, userSelect: "none", padding: "8px 0" }}>
      <div ref={trackRef} style={{ position: "relative", height: 6, background: "#e2e8f0", borderRadius: 3, cursor: "pointer" }}>
        <div style={{ position: "absolute", left: leftPct + "%", width: (rightPct - leftPct) + "%", height: "100%", background: "#0046ff", borderRadius: 3, opacity: 0.25 }} />
        {["left", "right"].map((h, i) => (
          <div key={h}
            onMouseDown={e => handleDown(e, h)} onTouchStart={e => handleDown(e, h)}
            style={{
              position: "absolute", left: `calc(${i === 0 ? leftPct : rightPct}% - 9px)`, top: -6,
              width: 18, height: 18, borderRadius: 9,
              background: "#fff", border: "2.5px solid #0046ff",
              cursor: "ew-resize", zIndex: 2, boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
            }}
          />
        ))}
      </div>
      {labels && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "#000", fontWeight: 500 }}>
          <span>{labels[0]}</span><span>{labels[1]}</span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════
export default function CPIChartPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#fff", fontFamily: "'Pretendard', sans-serif" }}>
        <div style={{ textAlign: "center", color: "#64748b" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🌡️</div>
          <div style={{ fontSize: 13 }}>CPI 데이터 로딩 중...</div>
        </div>
      </div>
    );
  }

  return <CPIChartInner />;
}

function CPIChartInner() {
  // All state
  const [selected, setSelected] = useState(["US_YoY", "KR_YoY"]);
  const [dateRange, setDateRange] = useState(null); // null = not initialized
  const [fontSize, setFontSize] = useState(13);
  const [yDecimals, setYDecimals] = useState(1);
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState("");
  const [updateMsg, setUpdateMsg] = useState("");
  const [error, setError] = useState("");

  // Load API data
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/ra-cpi");
        const json = await res.json();
        if (json.data?.data) setApiData(json.data);
      } catch (e) {
        console.error("CPI API load error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Handle admin update
  const handleUpdate = useCallback(async () => {
    if (!pin) return;
    setUpdating(true);
    setError("");
    setUpdateMsg("📡 FRED + ECOS에서 CPI 데이터 수집 중...");
    try {
      const res = await fetch("/api/ra-cpi", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify({ action: "update" }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
        setUpdateMsg("");
      } else {
        setApiData(json.data);
        setShowPin(false);
        setPin("");
        const d = json.data?.data;
        setUpdateMsg("✅ US: " + (d?.us_count || 0) + "개월, KR: " + (d?.kr_count || 0) + "개월");
        if (d?.errors) setError("일부 오류: " + d.errors.join("; "));
        setTimeout(() => setUpdateMsg(""), 5000);
      }
    } catch (e) {
      setError("업데이트 실패: " + e.message);
      setUpdateMsg("");
    } finally {
      setUpdating(false);
    }
  }, [pin]);

  // Compute everything in one memo block to avoid TDZ
  const computed = useMemo(() => {
    const srcMonths = apiData?.data?.months || CPI_MONTHS;
    const usIdx = apiData?.data?.us_index || US_CPI_INDEX;
    const krIdx = apiData?.data?.kr_index || KR_CPI_INDEX;

    const us = computeRates(srcMonths, usIdx);
    const kr = computeRates(srcMonths, krIdx);

    const dispMonths = srcMonths.slice(12);
    const dispSeries = {
      US_YoY: us.yoy.slice(12),
      KR_YoY: kr.yoy.slice(12),
      US_MoM: us.mom.slice(12),
      KR_MoM: kr.mom.slice(12),
    };

    return { dispMonths, dispSeries };
  }, [apiData]);

  // Initialize dateRange when data is ready
  useEffect(() => {
    if (computed.dispMonths.length > 0 && dateRange === null) {
      const len = computed.dispMonths.length;
      setDateRange([Math.max(0, len - 120), len - 1]);
    }
  }, [computed.dispMonths.length, dateRange]);

  const { dispMonths, dispSeries } = computed;
  const safeDateRange = dateRange || [0, Math.max(0, dispMonths.length - 1)];

  const toggleSeries = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const setQuickRange = (months) => {
    const end = dispMonths.length - 1;
    setDateRange([Math.max(0, end - months), end]);
  };

  const dateLabels = [dispMonths[safeDateRange[0]] || "", dispMonths[safeDateRange[1]] || ""];

  const hasData = dispMonths.length > 12;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#fff", fontFamily: "'Pretendard', sans-serif" }}>
        <div style={{ textAlign: "center", color: "#64748b" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🌡️</div>
          <div style={{ fontSize: 13 }}>CPI 데이터 로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#fff", fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", color: "#0f172a", overflow: "hidden" }}>
      {/* LEFT PANEL */}
      <div style={{ width: 240, minWidth: 240, borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 16px 8px", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0046ff", letterSpacing: -0.3 }}>📊 CPI 차트</div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>미국 · 한국 물가 추이</div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "8px 12px" }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#0046ff", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>시리즈 선택</div>

            <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", marginBottom: 4, marginTop: 8 }}>YoY (전년동월비) — 선차트</div>
            {SERIES_DEFS.filter(s => s.rate === "yoy").map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 0", fontSize: 11 }}>
                <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleSeries(s.id)}
                  style={{ accentColor: s.color, width: 13, height: 13, cursor: "pointer" }} />
                <span style={{ width: 14, height: 3, background: s.color, borderRadius: 2, flexShrink: 0 }} />
                <span style={{ color: selected.includes(s.id) ? "#0f172a" : "#94a3b8", cursor: "pointer" }} onClick={() => toggleSeries(s.id)}>{s.label}</span>
              </div>
            ))}

            <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", marginBottom: 4, marginTop: 10 }}>MoM (전월비) — 막대차트</div>
            {SERIES_DEFS.filter(s => s.rate === "mom").map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 0", fontSize: 11 }}>
                <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleSeries(s.id)}
                  style={{ accentColor: s.color, width: 13, height: 13, cursor: "pointer" }} />
                <span style={{ width: 10, height: 8, background: s.color + "55", border: "1px solid " + s.color, borderRadius: 2, flexShrink: 0 }} />
                <span style={{ color: selected.includes(s.id) ? "#0f172a" : "#94a3b8", cursor: "pointer" }} onClick={() => toggleSeries(s.id)}>{s.label}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 8, padding: "8px 0", borderTop: "1px solid #f1f5f9" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#0046ff", marginBottom: 6 }}>텍스트 크기</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="range" min={9} max={40} value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))}
                style={{ flex: 1, accentColor: "#0046ff" }} />
              <span style={{ fontSize: 11, color: "#000", fontWeight: 700, minWidth: 28, textAlign: "center" }}>{fontSize}px</span>
            </div>
          </div>

          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>소수점</span>
            {[1, 2].map(d => (
              <button key={d} onClick={() => setYDecimals(d)} style={{
                padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: "pointer",
                border: yDecimals === d ? "1px solid #0046ff" : "1px solid #e2e8f0",
                background: yDecimals === d ? "#0046ff10" : "#fff",
                color: yDecimals === d ? "#0046ff" : "#64748b",
              }}>{d}자리</button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN AREA */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "6px 16px", borderBottom: "1px solid #f1f5f9", gap: 8 }}>
          <a href="/modules/ra" style={{ fontSize: 11, color: "#94a3b8", textDecoration: "none" }}>← 금리차트</a>
          <a href="/" style={{ fontSize: 11, color: "#94a3b8", textDecoration: "none", marginLeft: 4 }}>← 컨트롤타워</a>
          <button onClick={() => setShowPin(!showPin)} style={{
            marginLeft: 8, padding: "3px 10px", borderRadius: 6, border: "1px solid #e2e8f0",
            background: showPin ? "#0046ff10" : "#fff", color: "#0046ff", fontSize: 10, fontWeight: 600, cursor: "pointer",
          }}>🔐 업데이트</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#000", marginLeft: 8 }}>
            {dateLabels[0]} ~ {dateLabels[1]}
          </span>
          <span style={{ fontSize: 12, color: "#000", marginLeft: "auto" }}>
            {dispMonths.length}개월 {apiData ? "(API)" : "(내장)"}
            {apiData?.updated_at && (" · " + new Date(apiData.updated_at).toLocaleDateString("ko-KR"))}
          </span>
        </div>

        {showPin && (
          <div style={{ padding: "8px 16px", borderBottom: "1px solid #e2e8f0", background: "#fafbfc" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="password" placeholder="관리자 PIN" value={pin} onChange={e => setPin(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleUpdate()}
                style={{ width: 120, padding: "5px 10px", border: "1px solid #d0d5dd", borderRadius: 6, fontSize: 12, outline: "none" }} />
              <button onClick={handleUpdate} disabled={updating || !pin} style={{
                padding: "5px 16px", borderRadius: 6, border: "none",
                background: updating ? "#e2e8f0" : "#0046ff", color: "#fff",
                fontSize: 12, fontWeight: 600, cursor: updating ? "wait" : "pointer",
                opacity: !pin ? 0.4 : 1,
              }}>{updating ? "수집 중..." : "FRED + ECOS 업데이트"}</button>
              <span style={{ fontSize: 10, color: "#94a3b8" }}>FRED(미국) + ECOS(한국) 최신 데이터</span>
            </div>
            {updateMsg && <div style={{ marginTop: 4, fontSize: 11, color: "#0046ff" }}>{updateMsg}</div>}
            {error && <div style={{ marginTop: 4, fontSize: 11, color: "#dc2626" }}>{error}</div>}
          </div>
        )}

        <div style={{ flex: 1, padding: "8px 16px 0", position: "relative", minHeight: 0 }}>
          {hasData ? (
            <>
              <CustomLegend selected={selected} fontSize={fontSize} />
              <div style={{ height: "calc(100% - 40px)", position: "relative" }}>
                <CPIChart
                  months={dispMonths} series={dispSeries} selected={selected}
                  dateRange={safeDateRange} fontSize={fontSize} yDecimals={yDecimals}
                />
              </div>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 40 }}>📡</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>CPI 데이터가 없습니다</div>
              <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 1.6 }}>
                🔐 업데이트 버튼을 눌러 관리자 PIN 입력 후<br/>
                FRED(미국 CPI) + ECOS(한국 CPI) 데이터를 수집하세요.
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "16px 20px 14px", borderTop: "1px solid #e2e8f0", marginTop: 10, flexShrink: 0 }}>
          <RangeSlider
            min={0} max={dispMonths.length - 1}
            value={safeDateRange} onChange={setDateRange}
            labels={[dispMonths[0], dispMonths[dispMonths.length - 1]]}
          />
          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            {[
              { label: "1Y", m: 12 }, { label: "3Y", m: 36 }, { label: "5Y", m: 60 },
              { label: "10Y", m: 120 }, { label: "전체", m: 99999 },
            ].map(r => (
              <button key={r.label} onClick={() => setQuickRange(r.m)} style={{
                padding: "4px 10px", borderRadius: 4, border: "1px solid #d0d5dd",
                background: "#fff", color: "#000", fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}>{r.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
