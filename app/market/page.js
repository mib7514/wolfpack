"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceLine } from "recharts";

const API = "https://api.anthropic.com/v1/messages";
const SK = "wolfpack-mkt-v3";

// ─── Storage ───
async function sv(d) { try { await window.storage.set(SK, JSON.stringify(d)); } catch(e) { console.warn(e); } }
async function ld() { try { const r = await window.storage.get(SK); return r ? JSON.parse(r.value) : null; } catch { return null; } }

// ─── API ───
async function callVision(images, prompt) {
  const content = [];
  for (const img of images) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: img.type, data: img.data },
    });
  }
  content.push({ type: "text", text: prompt });

  const r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content }],
    }),
  });
  const d = await r.json();
  return d.content.filter(b => b.type === "text").map(b => b.text).join("\n");
}

async function callText(prompt, search = false) {
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  };
  if (search) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  const r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  return d.content.filter(b => b.type === "text").map(b => b.text).join("\n");
}

function pj(raw) {
  try { return JSON.parse(raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()); }
  catch { const m = raw.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error("JSON 파싱 실패"); }
}

// ─── Prompts ───
const EXTRACT_PROMPT = `You are a financial data extraction assistant. Analyze the uploaded chart screenshot(s) from TradingView or similar platforms.

For EACH distinct asset/instrument visible in the charts, extract:
- "id": a short lowercase key (use: sp500, nasdaq100, russell2000, kospi, kosdaq, nikkei225, shanghai, gold, silver, copper, wti, bitcoin, ethereum, us3m, us2y, us5y, us10y, us30y, or a descriptive key)
- "name": the full display name shown on the chart
- "price": the current/last price shown
- "open": opening price if visible (null if not)
- "high": high price if visible (null if not)
- "low": low price if visible (null if not)
- "change": the price change shown (e.g., -29.99)
- "changePct": the percentage change shown (e.g., -0.43)
- "source": the platform name (e.g., "TradingView")
- "category": one of "index", "bond", "commodity", "crypto", "fx", "other"
- "unit": "$", "%", "pt", "₩", or ""

Read the EXACT numbers displayed on the chart header/ticker area. Do NOT estimate or calculate - use only what's visible.

Respond ONLY in valid JSON (no markdown, no backticks):
{
  "assets": [
    {
      "id": "sp500",
      "name": "US S&P 500",
      "price": 6878.88,
      "open": 6856.54,
      "high": 6882.96,
      "low": 6831.74,
      "change": -29.99,
      "changePct": -0.43,
      "source": "TradingView",
      "category": "index",
      "unit": "pt"
    }
  ],
  "chartPeriod": "1D",
  "timestamp": "2026-03-01"
}`;

function makeCommentaryPrompt(assets) {
  return `You are a senior macro strategist writing for a Korean institutional bond portfolio manager (신한자산운용 채권팀).

The following REAL market data was extracted from live charts:
${JSON.stringify(assets, null, 2)}

Write a sharp, insightful market commentary in Korean. Be specific with numbers. This is for a professional PM, not retail.

JSON only (no markdown):
{
  "headline": "한 줄 핵심 헤드라인 (20자 이내)",
  "overview": "전반적 시장 상황 요약 (3-4문장). 구체적 수치 인용.",
  "sections": [
    {"title": "주식/지수", "emoji": "📊", "content": "차트에 보이는 지수 동향 분석 (3-4문장)."},
    {"title": "채권/금리", "emoji": "🏛️", "content": "금리 수준과 방향성 분석 (3-4문장). 커브, 통화정책 시사점."},
    {"title": "원자재/크립토", "emoji": "🪙", "content": "해당 자산 동향 분석 (2-3문장)."},
    {"title": "크로스에셋 시사점", "emoji": "🔗", "content": "자산간 상관관계, 듀레이션/크레딧 전략 제언 (3-4문장). 채권 PM 관점."}
  ]
}
Include ONLY sections relevant to the data provided. If no bond data, skip that section.`;
}

// ─── Helpers ───
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ data: r.result.split(",")[1], type: file.type, name: file.name });
    r.onerror = () => reject(new Error("파일 읽기 실패"));
    r.readAsDataURL(file);
  });
}

const catIcons = { index: "📊", bond: "🏛️", commodity: "🪙", crypto: "₿", fx: "💱", other: "📈" };
const catLabels = { index: "지수", bond: "채권/금리", commodity: "원자재", crypto: "크립토", fx: "외환", other: "기타" };

// ─── UI Components ───
const PriceBadge = ({ change, changePct }) => {
  if (change == null && changePct == null) return null;
  const up = (changePct ?? change ?? 0) > 0;
  const dn = (changePct ?? change ?? 0) < 0;
  const c = up ? "#4FC3F7" : dn ? "#EF5350" : "#777";
  const arrow = up ? "▲" : dn ? "▼" : "─";
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {change != null && (
        <span style={{ color: c, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600 }}>
          {arrow} {change > 0 ? "+" : ""}{change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )}
      {changePct != null && (
        <span style={{ color: c, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 500, opacity: 0.8 }}>
          ({changePct > 0 ? "+" : ""}{changePct.toFixed(2)}%)
        </span>
      )}
    </div>
  );
};

const OHLCBar = ({ o, h, l, c: close }) => {
  if ([o, h, l, close].every(v => v == null)) return null;
  const items = [["O", o], ["H", h], ["L", l], ["C", close]].filter(([, v]) => v != null);
  return (
    <div style={{ display: "flex", gap: 10, fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono',monospace", marginTop: 4 }}>
      {items.map(([label, val]) => (
        <span key={label}><span style={{ color: "#444" }}>{label}</span> {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      ))}
    </div>
  );
};

// ═══════════════════════════════════
export default function MarketMonitorPage() {
  const [assets, setAssets] = useState([]);
  const [images, setImages] = useState([]);
  const [thumbs, setThumbs] = useState([]);
  const [comm, setComm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [commLoading, setCommLoading] = useState(false);
  const [step, setStep] = useState("");
  const [err, setErr] = useState(null);
  const [mode, setMode] = useState(null);
  const [updated, setUpdated] = useState(null);
  const [sec, setSec] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [selectedCat, setSelectedCat] = useState(null);
  const fileRef = useRef(null);
  const tmr = useRef(null);

  const go = () => { setSec(0); tmr.current = setInterval(() => setSec(p => p + 1), 1000); };
  const stop = () => { clearInterval(tmr.current); tmr.current = null; };

  // Load cache from localStorage (Next.js compatible)
  useEffect(() => {
    try {
      const cached = localStorage.getItem(SK);
      if (cached) {
        const c = JSON.parse(cached);
        if (c?.assets?.length) {
          setAssets(c.assets);
          setComm(c.comm || null);
          setUpdated(c.at || null);
          setThumbs(c.thumbs || []);
          setMode("cached");
        }
      }
    } catch {}
  }, []);

  // Save to localStorage
  const saveLocal = (data) => {
    try { localStorage.setItem(SK, JSON.stringify(data)); } catch {}
  };

  // Process uploaded images
  const processImages = useCallback(async (files) => {
    if (!files?.length) return;
    setLoading(true); setErr(null); setComm(null); setCommLoading(true);
    setStep("📷 이미지 읽는 중..."); go();

    try {
      const imgs = [];
      const previews = [];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) continue;
        const b = await toBase64(f);
        imgs.push(b);
        previews.push(URL.createObjectURL(f));
      }
      if (!imgs.length) throw new Error("이미지 파일이 없습니다");

      setImages(imgs);
      setThumbs(previews);
      setStep(`🐺 AI가 차트 ${imgs.length}장 분석 중...`);

      const raw = await callVision(imgs, EXTRACT_PROMPT);
      const parsed = pj(raw);
      const extracted = parsed.assets || [];

      if (!extracted.length) throw new Error("차트에서 데이터를 추출하지 못했습니다");

      const now = new Date().toLocaleString("ko-KR");
      setAssets(extracted);
      setUpdated(now);
      setMode("live");
      setLoading(false);
      setStep("✅ 데이터 추출 완료 → 🐺 코멘터리 생성 중...");

      try {
        const cr = pj(await callText(makeCommentaryPrompt(extracted)));
        setComm(cr);
        saveLocal({ assets: extracted, comm: cr, at: now, thumbs: [] });
      } catch (e) {
        console.error(e);
        setComm({ headline: "", overview: "코멘터리 생성 실패", sections: [] });
        saveLocal({ assets: extracted, comm: null, at: now });
      }
      setCommLoading(false); setStep(""); stop();
    } catch (e) {
      setErr(e.message);
      setLoading(false); setCommLoading(false); setStep(""); stop();
    }
  }, []);

  const regenComm = useCallback(async () => {
    if (!assets.length) return;
    setCommLoading(true); setComm(null);
    try {
      const cr = pj(await callText(makeCommentaryPrompt(assets)));
      setComm(cr);
      saveLocal({ assets, comm: cr, at: updated });
    } catch {
      setComm({ headline: "", overview: "코멘터리 생성 실패", sections: [] });
    }
    setCommLoading(false);
  }, [assets, updated]);

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); processImages(e.dataTransfer.files); };
  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);
  const onFileSelect = (e) => processImages(e.target.files);

  const reset = () => {
    try { localStorage.removeItem(SK); } catch {}
    setAssets([]); setImages([]); setThumbs([]); setComm(null);
    setMode(null); setUpdated(null); setErr(null);
  };

  const grouped = {};
  assets.forEach(a => {
    const cat = a.category || "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(a);
  });
  const catKeys = Object.keys(grouped);
  const visibleCats = selectedCat ? [selectedCat] : catKeys;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#0a0a14,#0d0d1a,#0a0a14)", color: "#e0e0e0", fontFamily: "'Noto Sans KR','SF Pro Display',sans-serif", padding: 20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .shim{background:linear-gradient(90deg,#1a1a2e 25%,#222244 50%,#1a1a2e 75%);background-size:200% 100%;animation:shimmer 1.5s infinite}
        .card{border:1px solid #1a1a2e;background:#0f0f1e;border-radius:12px;padding:16px 18px;transition:all .2s}
        .card:hover{border-color:#2a2a4e;box-shadow:0 4px 20px rgba(0,0,0,.3)}
        .tab{padding:7px 14px;border-radius:7px;cursor:pointer;transition:all .2s;border:1px solid transparent;font-size:12px;font-weight:500;background:transparent;color:#666}
        .tab:hover{color:#aaa;background:rgba(255,255,255,.03)}
        .tab.on{background:rgba(79,195,247,.08);color:#4FC3F7;border-color:rgba(79,195,247,.2)}
        .btn{padding:9px 16px;border-radius:8px;border:none;cursor:pointer;font-size:12px;font-weight:600;font-family:'Space Grotesk',sans-serif;transition:all .2s}
        .btn:disabled{cursor:wait;opacity:.5}
        .dropzone{border:2px dashed #2a2a4e;border-radius:16px;padding:40px 20px;text-align:center;cursor:pointer;transition:all .3s}
        .dropzone.over{border-color:#4FC3F7;background:rgba(79,195,247,.04)}
        .dropzone:hover{border-color:#3a3a5e}
        .back-link{color:#555;text-decoration:none;font-size:13px;display:inline-flex;align-items:center;gap:6px;margin-bottom:16px;transition:color .2s}
        .back-link:hover{color:#4FC3F7}
      `}</style>

      {/* Back to Control Tower */}
      <a href="/" className="back-link">← 컨트롤타워</a>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: "linear-gradient(135deg,#1a237e,#4FC3F7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 0 20px rgba(79,195,247,.2)" }}>🐺</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-.5px", fontFamily: "'Space Grotesk',sans-serif", background: "linear-gradient(135deg,#4FC3F7,#AB47BC)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              WOLF PACK — Market Monitor
            </h1>
            <div style={{ fontSize: 11, color: "#555", fontFamily: "'JetBrains Mono',monospace", display: "flex", alignItems: "center", gap: 8 }}>
              <span>늑대무리원정단 · Market Layer v1.0</span>
              <span style={{ background: "#00968820", color: "#009688", padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>Chart Vision</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {mode && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", background: mode === "live" ? "#4FC3F715" : "#FF704315", border: `1px solid ${mode === "live" ? "#4FC3F730" : "#FF704330"}`, color: mode === "live" ? "#4FC3F7" : "#FF7043" }}>
              {mode === "live" ? "📷 LIVE" : "💾 CACHED"} {updated && <span style={{ color: "#555" }}>· {updated}</span>}
            </div>
          )}
          {assets.length > 0 && (
            <>
              <button className="btn" onClick={() => fileRef.current?.click()} disabled={loading} style={{ background: "linear-gradient(135deg,#1a237e,#283593)", color: "#4FC3F7" }}>
                📷 새 차트 업로드
              </button>
              <button className="btn" onClick={regenComm} disabled={commLoading} style={{ background: "linear-gradient(135deg,#4a148c,#6a1b9a)", color: "#AB47BC" }}>
                🐺 코멘터리 재생성
              </button>
              <button className="btn" onClick={reset} style={{ background: "transparent", color: "#444", border: "1px solid #222", fontSize: 11 }}>🗑</button>
            </>
          )}
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFileSelect} style={{ display: "none" }} />

      {step && (
        <div style={{ padding: "8px 14px", background: "rgba(79,195,247,.06)", border: "1px solid rgba(79,195,247,.15)", borderRadius: 8, marginBottom: 14, display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#4FC3F7" }}>
          <span style={{ animation: "pulse 1.5s infinite" }}>⏳</span><span>{step}</span>
          <span style={{ color: "#555", marginLeft: "auto", fontFamily: "'JetBrains Mono',monospace" }}>{sec}s</span>
        </div>
      )}
      {err && <div style={{ padding: "12px 16px", background: "rgba(239,83,80,.1)", border: "1px solid rgba(239,83,80,.3)", borderRadius: 8, color: "#EF5350", fontSize: 13, marginBottom: 14 }}>⚠️ {err}</div>}

      {/* ═══ UPLOAD ZONE ═══ */}
      {!assets.length && !loading && (
        <div style={{ animation: "fadeIn .5s" }}>
          <div className={`dropzone ${dragOver ? "over" : ""}`} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} onClick={() => fileRef.current?.click()}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📊</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: "#999", marginBottom: 8 }}>차트 스크린샷을 여기에 드래그하세요</div>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>또는 클릭하여 파일 선택 · 여러 장 동시 업로드 가능</div>
            <div style={{ fontSize: 11, color: "#444", lineHeight: 1.8, maxWidth: 450, margin: "0 auto" }}>
              TradingView, 증권사 HTS/MTS, Bloomberg 등<br />
              OHLC 데이터가 보이는 차트 캡처를 올려주세요<br />
              AI가 자동으로 종목명, 가격, 변동률을 읽어냅니다
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
            {["S&P 500", "US 10Y", "Gold", "BTC", "KOSPI", "WTI"].map(ex => (
              <div key={ex} style={{ padding: "6px 14px", background: "#0f0f1e", border: "1px solid #1a1a2e", borderRadius: 20, fontSize: 11, color: "#555" }}>{ex}</div>
            ))}
          </div>
        </div>
      )}

      {loading && !assets.length && (
        <div style={{ textAlign: "center", padding: "40px 20px", animation: "fadeIn .3s" }}>
          <div style={{ fontSize: 40, animation: "pulse 1.5s infinite", marginBottom: 16 }}>🐺</div>
          <div style={{ color: "#4FC3F7", fontSize: 14, fontWeight: 500 }}>{step}</div>
          <div style={{ color: "#555", fontSize: 12, marginTop: 6 }}>⏱ {sec}초 경과</div>
        </div>
      )}

      {/* ═══ DASHBOARD ═══ */}
      {assets.length > 0 && (
        <div style={{ animation: "fadeIn .4s" }}>
          {thumbs.length > 0 && (
            <div style={{ marginBottom: 16, display: "flex", gap: 8, overflowX: "auto", padding: "4px 0" }}>
              {thumbs.map((t, i) => (<img key={i} src={t} alt="" style={{ height: 60, borderRadius: 8, border: "1px solid #1a1a2e", flexShrink: 0 }} />))}
              <div style={{ display: "flex", alignItems: "center", paddingLeft: 8, fontSize: 10, color: "#444", fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap" }}>{assets.length}개 자산 추출됨</div>
            </div>
          )}

          {catKeys.length > 1 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
              <button className={`tab ${!selectedCat ? "on" : ""}`} onClick={() => setSelectedCat(null)}>전체</button>
              {catKeys.map(k => (
                <button key={k} className={`tab ${selectedCat === k ? "on" : ""}`} onClick={() => setSelectedCat(k)}>
                  {catIcons[k] || "📈"} {catLabels[k] || k} ({grouped[k].length})
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12, marginBottom: 24 }}>
            {visibleCats.map(cat =>
              (grouped[cat] || []).map((a, i) => {
                const up = (a.changePct ?? a.change ?? 0) > 0;
                const dn = (a.changePct ?? a.change ?? 0) < 0;
                const accentColor = up ? "#4FC3F7" : dn ? "#EF5350" : "#777";
                return (
                  <div key={`${a.id}-${i}`} className="card" style={{ animation: `fadeIn ${0.2 + i * 0.05}s ease` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 14 }}>{catIcons[a.category] || "📈"}</span>
                          <span style={{ fontSize: 13, color: "#999", fontWeight: 600 }}>{a.name}</span>
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: "#eee", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "-0.5px" }}>
                          {a.unit === "$" ? "$" : ""}{a.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{a.unit === "%" ? "%" : ""}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", marginTop: 4 }}><PriceBadge change={a.change} changePct={a.changePct} /></div>
                    </div>
                    <OHLCBar o={a.open} h={a.high} l={a.low} c={a.price} />
                    <div style={{ height: 3, borderRadius: 2, marginTop: 12, background: `linear-gradient(90deg, ${accentColor}40, transparent)` }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                      <span style={{ fontSize: 9, color: "#333", fontFamily: "'JetBrains Mono',monospace" }}>{a.source || "Chart"}</span>
                      <span style={{ fontSize: 9, color: "#333", fontFamily: "'JetBrains Mono',monospace" }}>{a.category}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className={`dropzone ${dragOver ? "over" : ""}`} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} onClick={() => fileRef.current?.click()} style={{ padding: "20px", marginBottom: 24, borderStyle: "dashed" }}>
            <span style={{ fontSize: 13, color: "#555" }}>📷 추가 차트 드래그 또는 클릭하여 업로드</span>
          </div>

          {/* Commentary */}
          <div style={{ background: "#0f0f1e", borderRadius: 12, padding: 20, border: "1px solid #1a1a2e" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 18 }}>🐺</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#4FC3F7" }}>AI Market Commentary</span>
              {commLoading && <span style={{ fontSize: 11, color: "#555", animation: "pulse 1.5s infinite" }}>분석 중...</span>}
            </div>
            {comm ? (
              <div style={{ animation: "fadeIn .5s" }}>
                {comm.headline && <div style={{ fontSize: 18, fontWeight: 700, color: "#eee", marginBottom: 12, fontFamily: "'Space Grotesk',sans-serif" }}>{comm.headline}</div>}
                <div style={{ padding: "14px 18px", background: "rgba(79,195,247,.04)", borderRadius: 10, border: "1px solid rgba(79,195,247,.1)", marginBottom: 16, fontSize: 14, lineHeight: 1.8, color: "#ccc" }}>{comm.overview}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
                  {comm.sections?.map((s, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,.015)", borderRadius: 10, padding: "14px 16px", border: "1px solid #1a1a2e", animation: `fadeIn ${0.3 + i * 0.1}s` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><span style={{ fontSize: 16 }}>{s.emoji}</span><span style={{ fontSize: 13, fontWeight: 600, color: "#aaa" }}>{s.title}</span></div>
                      <div style={{ fontSize: 13, lineHeight: 1.8, color: "#999" }}>{s.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : !commLoading ? (
              <div style={{ color: "#555", fontSize: 13, textAlign: "center", padding: 20 }}>차트를 업로드하면 AI 코멘터리가 자동 생성됩니다</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>{[0, 1, 2, 3].map(i => <div key={i} className="shim" style={{ height: 120, borderRadius: 10 }} />)}</div>
            )}
          </div>

          <div style={{ textAlign: "center", marginTop: 20, padding: "12px 0", fontSize: 10, color: "#333", fontFamily: "'JetBrains Mono',monospace", lineHeight: 1.8 }}>
            DATA SOURCE: USER-PROVIDED CHARTS · AI ANALYSIS BY CLAUDE<br />
            WOLF PACK EXPEDITION · MARKET LAYER v1.0
          </div>
        </div>
      )}
    </div>
  );
}
