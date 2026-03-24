"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ══════════════════════════════════════
// CPI INDEX DATA (1999-01 ~ 2026-02, monthly)
// US: CPIAUCSL (SA, 1982-84=100), KR: 2020=100
// ══════════════════════════════════════
const CPI_MONTHS = ["1999-01", "1999-02", "1999-03", "1999-04", "1999-05", "1999-06", "1999-07", "1999-08", "1999-09", "1999-10", "1999-11", "1999-12", "2000-01", "2000-02", "2000-03", "2000-04", "2000-05", "2000-06", "2000-07", "2000-08", "2000-09", "2000-10", "2000-11", "2000-12", "2001-01", "2001-02", "2001-03", "2001-04", "2001-05", "2001-06", "2001-07", "2001-08", "2001-09", "2001-10", "2001-11", "2001-12", "2002-01", "2002-02", "2002-03", "2002-04", "2002-05", "2002-06", "2002-07", "2002-08", "2002-09", "2002-10", "2002-11", "2002-12", "2003-01", "2003-02", "2003-03", "2003-04", "2003-05", "2003-06", "2003-07", "2003-08", "2003-09", "2003-10", "2003-11", "2003-12", "2004-01", "2004-02", "2004-03", "2004-04", "2004-05", "2004-06", "2004-07", "2004-08", "2004-09", "2004-10", "2004-11", "2004-12", "2005-01", "2005-02", "2005-03", "2005-04", "2005-05", "2005-06", "2005-07", "2005-08", "2005-09", "2005-10", "2005-11", "2005-12", "2006-01", "2006-02", "2006-03", "2006-04", "2006-05", "2006-06", "2006-07", "2006-08", "2006-09", "2006-10", "2006-11", "2006-12", "2007-01", "2007-02", "2007-03", "2007-04", "2007-05", "2007-06", "2007-07", "2007-08", "2007-09", "2007-10", "2007-11", "2007-12", "2008-01", "2008-02", "2008-03", "2008-04", "2008-05", "2008-06", "2008-07", "2008-08", "2008-09", "2008-10", "2008-11", "2008-12", "2009-01", "2009-02", "2009-03", "2009-04", "2009-05", "2009-06", "2009-07", "2009-08", "2009-09", "2009-10", "2009-11", "2009-12", "2010-01", "2010-02", "2010-03", "2010-04", "2010-05", "2010-06", "2010-07", "2010-08", "2010-09", "2010-10", "2010-11", "2010-12", "2011-01", "2011-02", "2011-03", "2011-04", "2011-05", "2011-06", "2011-07", "2011-08", "2011-09", "2011-10", "2011-11", "2011-12", "2012-01", "2012-02", "2012-03", "2012-04", "2012-05", "2012-06", "2012-07", "2012-08", "2012-09", "2012-10", "2012-11", "2012-12", "2013-01", "2013-02", "2013-03", "2013-04", "2013-05", "2013-06", "2013-07", "2013-08", "2013-09", "2013-10", "2013-11", "2013-12", "2014-01", "2014-02", "2014-03", "2014-04", "2014-05", "2014-06", "2014-07", "2014-08", "2014-09", "2014-10", "2014-11", "2014-12", "2015-01", "2015-02", "2015-03", "2015-04", "2015-05", "2015-06", "2015-07", "2015-08", "2015-09", "2015-10", "2015-11", "2015-12", "2016-01", "2016-02", "2016-03", "2016-04", "2016-05", "2016-06", "2016-07", "2016-08", "2016-09", "2016-10", "2016-11", "2016-12", "2017-01", "2017-02", "2017-03", "2017-04", "2017-05", "2017-06", "2017-07", "2017-08", "2017-09", "2017-10", "2017-11", "2017-12", "2018-01", "2018-02", "2018-03", "2018-04", "2018-05", "2018-06", "2018-07", "2018-08", "2018-09", "2018-10", "2018-11", "2018-12", "2019-01", "2019-02", "2019-03", "2019-04", "2019-05", "2019-06", "2019-07", "2019-08", "2019-09", "2019-10", "2019-11", "2019-12", "2020-01", "2020-02", "2020-03", "2020-04", "2020-05", "2020-06", "2020-07", "2020-08", "2020-09", "2020-10", "2020-11", "2020-12", "2021-01", "2021-02", "2021-03", "2021-04", "2021-05", "2021-06", "2021-07", "2021-08", "2021-09", "2021-10", "2021-11", "2021-12", "2022-01", "2022-02", "2022-03", "2022-04", "2022-05", "2022-06", "2022-07", "2022-08", "2022-09", "2022-10", "2022-11", "2022-12", "2023-01", "2023-02", "2023-03", "2023-04", "2023-05", "2023-06", "2023-07", "2023-08", "2023-09", "2023-10", "2023-11", "2023-12", "2024-01", "2024-02", "2024-03", "2024-04", "2024-05", "2024-06", "2024-07", "2024-08", "2024-09", "2024-10", "2024-11", "2024-12", "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"];
const US_CPI_INDEX = [164.691, 165.038, 165.385, 165.732, 166.079, 166.426, 166.833, 167.3, 167.767, 168.233, 168.7, 169.167, 169.633, 170.1, 170.567, 171.033, 171.5, 171.967, 172.404, 172.812, 173.221, 173.629, 174.037, 174.446, 174.854, 175.262, 175.671, 176.079, 176.487, 176.896, 177.217, 177.45, 177.683, 177.917, 178.15, 178.383, 178.617, 178.85, 179.083, 179.317, 179.55, 179.783, 180.071, 180.412, 180.754, 181.096, 181.438, 181.779, 182.121, 182.463, 182.804, 183.146, 183.488, 183.829, 184.204, 184.613, 185.021, 185.429, 185.838, 186.246, 186.654, 187.062, 187.471, 187.879, 188.287, 188.696, 189.167, 189.7, 190.233, 190.767, 191.3, 191.833, 192.367, 192.9, 193.433, 193.967, 194.5, 195.033, 195.562, 196.088, 196.613, 197.138, 197.662, 198.188, 198.713, 199.238, 199.762, 200.287, 200.812, 201.338, 201.838, 202.312, 202.787, 203.262, 203.738, 204.213, 204.688, 205.162, 205.638, 206.113, 206.588, 207.062, 207.633, 208.3, 208.967, 209.633, 210.3, 210.967, 211.633, 212.3, 212.967, 213.633, 214.3, 214.967, 215.267, 215.2, 215.133, 215.067, 215.0, 214.933, 214.867, 214.8, 214.733, 214.667, 214.6, 214.533, 214.65, 214.95, 215.25, 215.55, 215.85, 216.15, 216.45, 216.75, 217.05, 217.35, 217.65, 217.95, 218.383, 218.95, 219.517, 220.083, 220.65, 221.217, 221.783, 222.35, 222.917, 223.483, 224.05, 224.617, 225.096, 225.488, 225.879, 226.271, 226.662, 227.054, 227.446, 227.838, 228.229, 228.621, 229.012, 229.404, 229.742, 230.025, 230.308, 230.592, 230.875, 231.158, 231.442, 231.725, 232.008, 232.292, 232.575, 232.858, 233.154, 233.463, 233.771, 234.079, 234.387, 234.696, 235.004, 235.312, 235.621, 235.929, 236.237, 236.546, 236.712, 236.737, 236.762, 236.787, 236.812, 236.838, 236.862, 236.887, 236.912, 236.938, 236.963, 236.988, 237.125, 237.375, 237.625, 237.875, 238.125, 238.375, 238.625, 238.875, 239.125, 239.375, 239.625, 239.875, 240.213, 240.637, 241.062, 241.488, 241.912, 242.338, 242.762, 243.188, 243.612, 244.037, 244.463, 244.887, 245.35, 245.85, 246.35, 246.85, 247.35, 247.85, 248.35, 248.85, 249.35, 249.85, 250.35, 250.85, 251.292, 251.675, 252.058, 252.442, 252.825, 253.208, 253.592, 253.975, 254.358, 254.742, 255.125, 255.508, 255.829, 256.087, 256.346, 256.604, 256.863, 257.121, 258.687, 258.678, 257.971, 256.389, 256.394, 257.797, 259.101, 259.918, 260.28, 260.388, 260.229, 260.474, 261.582, 263.014, 264.877, 267.054, 269.195, 271.696, 273.003, 273.567, 274.31, 276.59, 277.948, 278.802, 281.148, 283.716, 287.504, 289.109, 292.296, 296.311, 296.276, 295.62, 296.808, 298.012, 297.711, 296.797, 299.17, 300.84, 301.836, 303.363, 304.127, 305.109, 305.691, 307.026, 307.789, 307.671, 307.051, 306.746, 308.417, 310.326, 312.332, 313.207, 314.069, 314.175, 314.54, 314.796, 315.301, 315.664, 316.437, 317.368, 317.671, 318.208, 319.085, 319.621, 320.119, 320.417, 320.829, 321.353, 321.918, 323.139, 323.118, 323.834, 325.25, 326.79];
const KR_CPI_INDEX = [61.27, 61.38, 61.48, 61.58, 61.69, 61.79, 61.9, 62.01, 62.13, 62.24, 62.35, 62.47, 62.58, 62.7, 62.81, 62.92, 63.04, 63.15, 63.32, 63.53, 63.75, 63.96, 64.18, 64.39, 64.61, 64.82, 65.04, 65.25, 65.47, 65.68, 65.86, 66.01, 66.15, 66.3, 66.44, 66.59, 66.73, 66.88, 67.02, 67.17, 67.31, 67.46, 67.63, 67.83, 68.02, 68.22, 68.42, 68.62, 68.81, 69.01, 69.21, 69.41, 69.6, 69.8, 70.0, 70.21, 70.41, 70.62, 70.83, 71.03, 71.24, 71.44, 71.65, 71.86, 72.06, 72.27, 72.45, 72.62, 72.78, 72.94, 73.11, 73.27, 73.44, 73.6, 73.77, 73.93, 74.09, 74.26, 74.41, 74.56, 74.7, 74.85, 74.99, 75.14, 75.28, 75.43, 75.57, 75.72, 75.86, 76.01, 76.16, 76.32, 76.48, 76.64, 76.8, 76.96, 77.12, 77.28, 77.44, 77.6, 77.76, 77.92, 78.15, 78.46, 78.77, 79.07, 79.38, 79.69, 79.99, 80.3, 80.61, 80.91, 81.22, 81.53, 81.77, 81.96, 82.15, 82.33, 82.52, 82.71, 82.89, 83.08, 83.27, 83.45, 83.64, 83.83, 84.02, 84.23, 84.43, 84.64, 84.84, 85.05, 85.25, 85.46, 85.66, 85.87, 86.07, 86.28, 86.53, 86.82, 87.11, 87.4, 87.69, 87.98, 88.27, 88.56, 88.85, 89.14, 89.43, 89.72, 89.96, 90.13, 90.3, 90.47, 90.64, 90.81, 90.99, 91.16, 91.33, 91.5, 91.67, 91.84, 91.98, 92.08, 92.17, 92.27, 92.37, 92.46, 92.56, 92.66, 92.75, 92.85, 92.95, 93.04, 93.14, 93.23, 93.33, 93.42, 93.51, 93.61, 93.7, 93.8, 93.89, 93.98, 94.08, 94.17, 94.25, 94.31, 94.36, 94.42, 94.47, 94.53, 94.59, 94.65, 94.7, 94.76, 94.81, 94.87, 94.94, 95.02, 95.1, 95.18, 95.26, 95.34, 95.42, 95.5, 95.58, 95.66, 95.74, 95.82, 95.94, 96.09, 96.24, 96.39, 96.55, 96.7, 96.85, 97.0, 97.16, 97.31, 97.46, 97.61, 97.75, 97.86, 97.97, 98.08, 98.2, 98.31, 98.42, 98.53, 98.65, 98.76, 98.87, 98.98, 99.06, 99.09, 99.12, 99.16, 99.19, 99.22, 99.26, 99.29, 99.32, 99.36, 99.39, 99.42, 99.46, 99.51, 99.56, 99.6, 99.65, 99.7, 99.74, 99.79, 99.84, 99.88, 99.93, 99.98, 100.1, 100.31, 100.52, 100.73, 100.94, 101.15, 101.35, 101.56, 101.77, 101.98, 102.19, 102.4, 102.72, 103.15, 103.59, 104.02, 104.45, 104.89, 104.22, 105.76, 106.19, 106.62, 107.06, 108.22, 108.74, 108.19, 108.51, 108.82, 109.14, 108.41, 109.53, 110.1, 110.42, 110.73, 111.05, 111.15, 111.64, 111.87, 112.1, 112.33, 112.56, 112.8, 113.18, 113.24, 113.47, 113.7, 113.93, 114.21, 114.38, 114.59, 114.8, 115.01, 115.22, 115.85, 115.34, 116.02, 116.06, 116.27, 116.48, 116.51, 116.9, 117.09, 117.29, 117.48, 117.68, 117.57, 118.03, 118.4];


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
          <CustomLegend selected={selected} fontSize={fontSize} />
          <div style={{ height: "calc(100% - 40px)", position: "relative" }}>
            <CPIChart
              months={dispMonths} series={dispSeries} selected={selected}
              dateRange={safeDateRange} fontSize={fontSize} yDecimals={yDecimals}
            />
          </div>
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
