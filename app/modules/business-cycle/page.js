'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, ComposedChart } from 'recharts';
import { supabase } from '@/lib/supabase';
import {
  MONTHS, QUESTIONS, CATEGORIES, PHASE_ORDER, PHASE_COLORS,
  getWeight, computeTotals, computeCatTotals, DEFAULT_US, DEFAULT_KR
} from '@/lib/cycle-constants';

/* ─── Admin PIN Hook (inline) ─── */
function useAdminPin(moduleKey) {
  const storageKey = `wolfpack_admin_${moduleKey}`;
  const [pin, setPin] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) { setPin(saved); setIsAdmin(true); }
  }, [storageKey]);

  const openModal = useCallback(() => { setPinError(''); setShowModal(true); }, []);
  const closeModal = useCallback(() => { setShowModal(false); setPinError(''); }, []);
  const logout = useCallback(() => {
    setIsAdmin(false); setPin(''); sessionStorage.removeItem(storageKey);
  }, [storageKey]);
  const handleAuthExpired = useCallback(() => {
    setIsAdmin(false); setPin(''); sessionStorage.removeItem(storageKey);
    alert('인증이 만료되었습니다. 다시 PIN을 입력해주세요.');
    setShowModal(true);
  }, [storageKey]);

  const verify = useCallback(async (inputPin) => {
    try {
      const res = await fetch('/api/ai-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': inputPin },
        body: JSON.stringify({ __pin_check: true }),
      });
      if (res.status === 401) { setPinError('PIN이 일치하지 않습니다'); return false; }
      setPin(inputPin); setIsAdmin(true);
      sessionStorage.setItem(storageKey, inputPin);
      setShowModal(false); setPinError('');
      return true;
    } catch { setPinError('서버 연결 오류'); return false; }
  }, [storageKey]);

  return { pin, setPin, isAdmin, showModal, pinError, openModal, closeModal, logout, verify, handleAuthExpired };
}

/* ─── PIN Modal Component ─── */
function PinModal({ admin }) {
  const [inputPin, setInputPin] = useState('');
  if (!admin.showModal) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]" onClick={admin.closeModal}>
      <div className="bg-[#1e293b] border border-gray-700 rounded-2xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-white font-bold text-base mb-1">🔐 관리자 인증</h3>
        <p className="text-gray-400 text-xs mb-4">업데이트 기능은 관리자만 사용할 수 있습니다</p>
        <input type="password" placeholder="PIN 입력" value={inputPin}
          onChange={e => setInputPin(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && admin.verify(inputPin)}
          className="w-full px-4 py-3 bg-[#0d1117] border border-gray-700 rounded-lg text-white text-center text-lg tracking-[0.3em] mb-3 outline-none focus:border-[#38bdf8]" autoFocus />
        {admin.pinError && <p className="text-red-400 text-xs text-center mb-3">{admin.pinError}</p>}
        <div className="flex gap-2">
          <button onClick={admin.closeModal} className="flex-1 py-2.5 rounded-lg border border-gray-700 text-gray-400 text-sm hover:bg-[#151a27] transition">취소</button>
          <button onClick={() => admin.verify(inputPin)} className="flex-1 py-2.5 rounded-lg bg-[#38bdf8] text-white text-sm font-bold hover:bg-[#2da3db] transition">인증</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */
const PhaseGauge = ({ totals, label }) => {
  const max = Math.max(...Object.values(totals));
  const dominant = PHASE_ORDER.find(p => totals[p] === max);
  const total = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  const net = (totals["확장"] + totals["회복"]) - (totals["침체"] + totals["둔화"]);
  return (
    <div style={{ textAlign: "center" }}>
      <div className="text-[11px] text-gray-400 mb-1.5 tracking-widest uppercase">{label}</div>
      <div style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 96, height: 96, borderRadius: "50%",
        background: `conic-gradient(${PHASE_COLORS["침체"].chart} 0% ${totals["침체"]/total*100}%, ${PHASE_COLORS["회복"].chart} ${totals["침체"]/total*100}% ${(totals["침체"]+totals["회복"])/total*100}%, ${PHASE_COLORS["확장"].chart} ${(totals["침체"]+totals["회복"])/total*100}% ${(totals["침체"]+totals["회복"]+totals["확장"])/total*100}%, ${PHASE_COLORS["둔화"].chart} ${(totals["침체"]+totals["회복"]+totals["확장"])/total*100}% 100%)`,
      }}>
        <div className="w-[72px] h-[72px] rounded-full bg-[#0f172a] flex flex-col items-center justify-center">
          <span className="text-lg font-extrabold" style={{ color: PHASE_COLORS[dominant].chart }}>{dominant}</span>
          <span className="text-[11px] text-gray-500">Net {net > 0 ? "+" : ""}{net}</span>
        </div>
      </div>
      <div className="flex gap-1 justify-center mt-2 flex-wrap">
        {PHASE_ORDER.map(p => (
          <span key={p} className="text-[10px] px-1.5 py-0.5 rounded" style={{
            background: PHASE_COLORS[p].bg, color: PHASE_COLORS[p].text,
            fontWeight: totals[p] === max ? 700 : 400
          }}>{p} {totals[p]}</span>
        ))}
      </div>
    </div>
  );
};

const ScoreCell = ({ value, phase, onChange, locked }) => {
  const [editing, setEditing] = useState(false);
  const intensity = value / 5;
  const bg = value > 0
    ? `rgba(${phase === "침체" ? "239,68,68" : phase === "회복" ? "234,179,8" : phase === "확장" ? "34,197,94" : "59,130,246"}, ${intensity * 0.35})`
    : "transparent";

  if (editing && !locked) {
    return (
      <select autoFocus value={value}
        className="w-9 bg-[#1e293b] text-gray-200 border border-gray-600 rounded text-xs text-center"
        onChange={e => { onChange(parseInt(e.target.value)); setEditing(false); }}
        onBlur={() => setEditing(false)}>
        {[0,1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    );
  }
  return (
    <div onClick={() => !locked && setEditing(true)}
      className={`${locked ? 'cursor-default' : 'cursor-pointer'} w-9 h-7 flex items-center justify-center rounded text-xs transition-all`}
      style={{ background: bg, fontWeight: value >= 4 ? 700 : 400, color: value >= 3 ? PHASE_COLORS[phase].text : "#94a3b8" }}>
      {value || "·"}
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1e293b] border border-gray-700 rounded-lg px-3 py-2 text-xs">
      <div className="text-gray-200 font-semibold mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name}</span><span className="font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

/* ─── AI Update Modal ─── */
const AIUpdateModal = ({ country, monthLabel, currentScores, monthIdx, onApply, onClose, adminPin }) => {
  const [status, setStatus] = useState('idle');
  const [aiScores, setAiScores] = useState(null);
  const [rationale, setRationale] = useState({});
  const [progress, setProgress] = useState('');
  const [expandedCat, setExpandedCat] = useState(null);

  const runUpdate = async () => {
    setStatus('running');
    const allScores = {};
    const allRationale = {};
    const catList = Object.entries(CATEGORIES);

    for (let ci = 0; ci < catList.length; ci++) {
      const [cat, qNums] = catList[ci];
      setProgress(`${cat} 분석 중... (${ci + 1}/${catList.length})`);

      try {
        const prevScores = {};
        qNums.forEach(qn => { prevScores[qn] = monthIdx > 0 ? (currentScores[qn]?.[monthIdx - 1] || 0) : 0; });

        const res = await fetch('/api/ai-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-pin': adminPin },
          body: JSON.stringify({ country, monthLabel, category: cat, questionNumbers: qNums, prevScores, monthIdx }),
        });

        if (res.status === 401) {
          allRationale[cat] = '⚠️ 인증 만료';
          qNums.forEach(qn => { allScores[qn] = currentScores[qn]?.[monthIdx] || 0; });
          continue;
        }

        const data = await res.json();
        if (data.scores) {
          Object.entries(data.scores).forEach(([qn, score]) => { allScores[parseInt(qn)] = score; });
          allRationale[cat] = data.rationale;
        } else {
          qNums.forEach(qn => { allScores[qn] = currentScores[qn]?.[monthIdx] || 0; });
          allRationale[cat] = '⚠️ 파싱 실패, 기존 점수 유지';
        }
      } catch {
        qNums.forEach(qn => { allScores[qn] = currentScores[qn]?.[monthIdx] || 0; });
        allRationale[cat] = '⚠️ API 오류, 기존 점수 유지';
      }
    }

    setAiScores(allScores);
    setRationale(allRationale);
    setStatus('done');
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#1e293b] rounded-2xl border border-gray-700 max-w-[700px] w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold"><span className="text-purple-400">⚡</span> AI 업데이트</h2>
            <p className="text-xs text-gray-500 mt-1">{country === 'KR' ? '🇰🇷 한국' : '🇺🇸 미국'} · {monthLabel}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-700 text-gray-400 flex items-center justify-center hover:text-gray-200 transition">✕</button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5">
          {status === 'idle' && (
            <div className="text-center py-10">
              <div className="text-5xl mb-4">🤖</div>
              <p className="text-gray-400 text-sm mb-1">AI가 웹 검색으로 최신 경제 데이터를 수집하고</p>
              <p className="text-gray-400 text-sm mb-6">68개 문항의 스코어를 자동 제안합니다.</p>
              <button onClick={runUpdate} className="bg-gradient-to-r from-purple-600 to-purple-400 text-white px-8 py-3 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-purple-500/20 transition">
                🔍 분석 시작
              </button>
            </div>
          )}

          {status === 'running' && (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-full border-[3px] border-gray-700 border-t-purple-400 animate-spin mx-auto mb-5" />
              <p className="text-gray-200 text-sm font-semibold mb-2">{progress}</p>
              <p className="text-gray-500 text-xs">웹에서 최신 경제 지표를 검색하고 있습니다...</p>
            </div>
          )}

          {status === 'done' && aiScores && (
            <div>
              <div className="bg-[#0f172a] rounded-xl p-4 mb-4 border border-gray-700">
                <div className="text-xs text-purple-400 font-bold mb-2 tracking-wider">AI 분석 요약</div>
                {Object.entries(rationale).map(([cat, text]) => (
                  <div key={cat} className="mb-2">
                    <button onClick={() => setExpandedCat(expandedCat === cat ? null : cat)}
                      className="bg-transparent border-none text-gray-200 cursor-pointer text-[13px] font-semibold p-0 flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-500 transition-transform" style={{ transform: expandedCat === cat ? 'rotate(90deg)' : '' }}>▶</span>
                      {cat}
                    </button>
                    {expandedCat === cat && <p className="text-gray-400 text-xs mt-1.5 ml-4 leading-relaxed">{text}</p>}
                  </div>
                ))}
              </div>

              <div className="text-xs text-gray-500 mb-2 font-semibold">스코어 비교 (기존 → AI 제안)</div>
              <div className="max-h-80 overflow-auto">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-[#0f172a] sticky top-0 z-[2]">
                      <th className="px-2 py-1.5 text-left text-gray-500">#</th>
                      <th className="px-2 py-1.5 text-left text-gray-500">국면</th>
                      <th className="px-2 py-1.5 text-left text-gray-500">지표</th>
                      <th className="px-2 py-1.5 text-center text-gray-500">기존</th>
                      <th className="px-2 py-1.5 text-center text-gray-500">AI</th>
                      <th className="px-2 py-1.5 text-center text-gray-500">변동</th>
                    </tr>
                  </thead>
                  <tbody>
                    {QUESTIONS.map(q => {
                      const oldVal = currentScores[q[0]]?.[monthIdx] || 0;
                      const newVal = aiScores[q[0]] ?? oldVal;
                      const diff = newVal - oldVal;
                      return (
                        <tr key={q[0]} className={`border-t border-[#1e293b] ${diff !== 0 ? 'bg-purple-500/5' : ''}`}>
                          <td className="px-2 py-1 text-gray-500">{q[0]}</td>
                          <td className="px-2 py-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: PHASE_COLORS[q[2]].bg, color: PHASE_COLORS[q[2]].text, fontWeight: 600 }}>{q[2]}</span>
                          </td>
                          <td className="px-2 py-1 text-gray-300">{q[3]}</td>
                          <td className="px-2 py-1 text-center text-gray-500">{oldVal}</td>
                          <td className={`px-2 py-1 text-center ${diff !== 0 ? 'text-gray-200 font-bold' : 'text-gray-500'}`}>{newVal}</td>
                          <td className={`px-2 py-1 text-center font-semibold ${diff > 0 ? 'text-orange-400' : diff < 0 ? 'text-sky-400' : 'text-gray-700'}`}>
                            {diff !== 0 ? (diff > 0 ? `+${diff}` : diff) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-xs text-gray-500">
                변경된 항목: <span className="text-purple-400 font-bold">
                  {QUESTIONS.filter(q => (aiScores[q[0]] ?? (currentScores[q[0]]?.[monthIdx] || 0)) !== (currentScores[q[0]]?.[monthIdx] || 0)).length}
                </span> / 68개
              </div>
            </div>
          )}
        </div>

        {status === 'done' && (
          <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
            <button onClick={onClose} className="bg-gray-700 text-gray-400 px-5 py-2.5 rounded-lg text-[13px] hover:text-gray-200 transition">취소</button>
            <button onClick={() => { onApply(aiScores); }} className="bg-gradient-to-r from-purple-600 to-purple-400 text-white px-6 py-2.5 rounded-lg text-[13px] font-bold hover:shadow-lg hover:shadow-purple-500/20 transition">
              ✓ 적용하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Main Dashboard ─── */
export default function BusinessCyclePage() {
  const [country, setCountry] = useState('KR');
  const [selectedMonth, setSelectedMonth] = useState(13);
  const [data, setData] = useState(null);
  const [view, setView] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [showAI, setShowAI] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // ─── Admin PIN ───
  const admin = useAdminPin('business-cycle');

  useEffect(() => {
    async function load() {
      try {
        const { data: rows, error } = await supabase
          .from('business_cycle_scores')
          .select('*');

        if (!error && rows?.length > 0) {
          const result = {};
          rows.forEach(row => {
            result[row.country] = row.scores;
            if (!lastUpdated || new Date(row.updated_at) > new Date(lastUpdated)) {
              setLastUpdated(row.updated_at);
            }
          });
          setData(result);
        } else {
          setData({ US: DEFAULT_US, KR: DEFAULT_KR });
          await supabase.from('business_cycle_scores').upsert([
            { country: 'KR', scores: DEFAULT_KR, updated_at: new Date().toISOString() },
            { country: 'US', scores: DEFAULT_US, updated_at: new Date().toISOString() },
          ], { onConflict: 'country' });
        }
      } catch {
        setData({ US: DEFAULT_US, KR: DEFAULT_KR });
      }
      setLoading(false);
    }
    load();
  }, []);

  const saveData = useCallback(async (newData) => {
    setData(newData);
    const now = new Date().toISOString();
    setLastUpdated(now);
    try {
      await supabase.from('business_cycle_scores').upsert([
        { country: 'KR', scores: newData.KR, updated_at: now },
        { country: 'US', scores: newData.US, updated_at: now },
      ], { onConflict: 'country' });
    } catch (e) { console.error('Save failed:', e); }
  }, []);

  const handleScoreChange = useCallback((qNum, mIdx, newVal) => {
    if (!admin.isAdmin) { admin.openModal(); return; }
    const key = country;
    const newData = { ...data, [key]: { ...data[key], [qNum]: [...data[key][qNum]] } };
    newData[key][qNum][mIdx] = newVal;
    saveData(newData);
  }, [data, country, saveData, admin]);

  const handleAIApply = useCallback((aiScores) => {
    const newData = { ...data, [country]: { ...data[country] } };
    Object.entries(aiScores).forEach(([qn, score]) => {
      const qNum = parseInt(qn);
      if (newData[country][qNum]) {
        newData[country][qNum] = [...newData[country][qNum]];
        newData[country][qNum][selectedMonth] = score;
      }
    });
    saveData(newData);
    setShowAI(false);
  }, [data, country, selectedMonth, saveData]);

  const scores = useMemo(() => data ? data[country] : null, [data, country]);

  const timeSeriesData = useMemo(() => {
    if (!data) return [];
    return MONTHS.map((m, i) => {
      const kr = computeTotals(data.KR, i);
      const us = computeTotals(data.US, i);
      return {
        month: m.slice(2),
        "🇰🇷 Net": (kr["확장"] + kr["회복"]) - (kr["침체"] + kr["둔화"]),
        "🇺🇸 Net": (us["확장"] + us["회복"]) - (us["침체"] + us["둔화"]),
      };
    });
  }, [data]);

  const catData = useMemo(() => {
    if (!scores) return [];
    return Object.entries(CATEGORIES).map(([cat, qs]) => {
      const t = computeCatTotals(scores, selectedMonth, qs);
      return { cat, ...t };
    });
  }, [scores, selectedMonth]);

  const currentTotals = useMemo(() => scores ? computeTotals(scores, selectedMonth) : null, [scores, selectedMonth]);

  if (loading || !data) {
    return <div className="min-h-screen bg-[#0a0e1a] text-gray-200 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-gray-200 pb-10">
      {/* PIN Modal */}
      <PinModal admin={admin} />

      {showAI && (
        <AIUpdateModal country={country} monthLabel={MONTHS[selectedMonth]}
          currentScores={scores} monthIdx={selectedMonth}
          onApply={handleAIApply} onClose={() => setShowAI(false)}
          adminPin={admin.pin} />
      )}

      {/* Toolbar */}
      <div className="sticky top-[49px] z-40 bg-[#0a0e1a]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[#38bdf8] text-lg">◈</span>
            <div>
              <h1 className="text-base font-extrabold tracking-tight">경기순환 체크리스트</h1>
              <p className="text-[10px] text-gray-500 tracking-wider">
                {lastUpdated ? `Last updated: ${new Date(lastUpdated).toLocaleString('ko-KR')}` : 'Business Cycle Dashboard'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Admin Lock Button */}
            {admin.isAdmin ? (
              <button onClick={admin.logout}
                className="px-2.5 py-1.5 rounded-lg border border-[#22c55e50] text-xs text-[#22c55e] bg-[#22c55e10] hover:bg-[#22c55e20] transition" title="관리자 인증됨">
                🔓
              </button>
            ) : (
              <button onClick={admin.openModal}
                className="px-2.5 py-1.5 rounded-lg border border-[#5A647850] text-xs text-[#5A6478] bg-[#5A647810] hover:bg-[#5A647820] transition" title="관리자 잠금">
                🔒
              </button>
            )}
            {/* AI Update Button */}
            <button onClick={() => { if (!admin.isAdmin) { admin.openModal(); return; } setShowAI(true); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                admin.isAdmin
                  ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-600/20 hover:shadow-purple-600/30'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}>
              ⚡ AI 업데이트
            </button>
            <div className="flex bg-[#1e293b] rounded-lg p-0.5">
              {['KR','US'].map(c => (
                <button key={c} onClick={() => setCountry(c)}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold transition ${country === c ? 'bg-gray-700 text-gray-200' : 'text-gray-500'}`}>
                  {c === 'KR' ? '🇰🇷 한국' : '🇺🇸 미국'}
                </button>
              ))}
            </div>
            <div className="flex bg-[#1e293b] rounded-lg p-0.5">
              {[['overview','개요'],['detail','상세']].map(([v,l]) => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition ${view === v ? 'bg-gray-700 text-gray-200' : 'text-gray-500'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {/* Month selector */}
        <div className="flex gap-1 overflow-x-auto py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          {MONTHS.map((m, i) => {
            const t = computeTotals(scores, i);
            const dominant = PHASE_ORDER.reduce((a, b) => t[a] > t[b] ? a : b);
            return (
              <button key={m} onClick={() => setSelectedMonth(i)}
                className="flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-md min-w-[72px] transition"
                style={{
                  border: selectedMonth === i ? '2px solid #38bdf8' : '1px solid #1e293b',
                  background: selectedMonth === i ? '#1e293b' : 'transparent',
                }}>
                <span className={`text-[11px] ${selectedMonth === i ? 'text-gray-200 font-bold' : 'text-gray-500'}`}>{m.slice(2)}</span>
                <span className="w-2 h-2 rounded-full" style={{ background: PHASE_COLORS[dominant].chart }} />
              </button>
            );
          })}
        </div>

        {view === 'overview' ? (
          <>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-[#1a2035] rounded-xl p-5 border border-white/5">
                <PhaseGauge totals={computeTotals(data.KR, selectedMonth)} label="한국" />
              </div>
              <div className="bg-[#1a2035] rounded-xl p-5 border border-white/5">
                <PhaseGauge totals={computeTotals(data.US, selectedMonth)} label="미국" />
              </div>
            </div>

            <div className="bg-[#1a2035] rounded-xl p-5 border border-white/5 mt-4">
              <h3 className="text-[13px] font-bold text-gray-400 tracking-wider mb-4">NET SCORE 추이</h3>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="🇰🇷 Net" stroke="#f97316" fill="#f97316" fillOpacity={0.15} strokeWidth={2.5} dot={{ r: 3, fill: "#f97316" }} />
                  <Area type="monotone" dataKey="🇺🇸 Net" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.15} strokeWidth={2.5} dot={{ r: 3, fill: "#38bdf8" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-[#1a2035] rounded-xl p-5 border border-white/5 mt-4">
              <h3 className="text-[13px] font-bold text-gray-400 tracking-wider mb-1">
                {country === 'KR' ? '🇰🇷 한국' : '🇺🇸 미국'} 분류별 ({MONTHS[selectedMonth]})
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={catData} layout="vertical" barGap={0} barSize={10}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis dataKey="cat" type="category" tick={{ fontSize: 11, fill: "#94a3b8" }} width={60} />
                  <Tooltip content={<CustomTooltip />} />
                  {PHASE_ORDER.map(p => <Bar key={p} dataKey={p} stackId="a" fill={PHASE_COLORS[p].chart} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-4">
              {currentTotals && PHASE_ORDER.map(p => {
                const total = Object.values(currentTotals).reduce((a,b) => a+b, 0) || 1;
                const pct = Math.round(currentTotals[p] / total * 100);
                return (
                  <div key={p} className="bg-[#1a2035] rounded-xl p-3 text-center" style={{ borderLeft: `3px solid ${PHASE_COLORS[p].chart}` }}>
                    <div className="text-[10px] text-gray-500 tracking-widest uppercase">{p}</div>
                    <div className="text-2xl font-extrabold mt-1" style={{ color: PHASE_COLORS[p].chart }}>{currentTotals[p]}</div>
                    <div className="text-[11px] text-gray-500">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mt-4 bg-[#1a2035] rounded-xl border border-white/5 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-sm font-bold">{country === 'KR' ? '🇰🇷 한국' : '🇺🇸 미국'} 상세 스코어 ({MONTHS[selectedMonth]})</h3>
              <span className="text-[11px] text-gray-500">
                {admin.isAdmin ? '🔓 셀 클릭하여 수정 · 0–5점' : '🔒 수정하려면 관리자 인증 필요'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0f172a]">
                    <th className="px-1.5 py-2 text-left text-gray-500 font-semibold sticky left-0 bg-[#0f172a] z-[5] min-w-[30px]">#</th>
                    <th className="px-1.5 py-2 text-left text-gray-500 font-semibold min-w-[50px]">분류</th>
                    <th className="px-1.5 py-2 text-center text-gray-500 font-semibold min-w-[40px]">국면</th>
                    <th className="px-1.5 py-2 text-left text-gray-500 font-semibold min-w-[80px]">지표</th>
                    <th className="px-1.5 py-2 text-left text-gray-500 font-semibold min-w-[200px]">문항</th>
                    {MONTHS.map((m, i) => (
                      <th key={m} className={`px-0.5 py-2 text-center font-medium text-[10px] min-w-[42px] ${i === selectedMonth ? 'text-sky-400 font-bold bg-[#1e293b]' : 'text-gray-500'}`}>
                        {m.slice(5)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(CATEGORIES).map(([cat, qNums]) =>
                    qNums.map((qn, qi) => {
                      const q = QUESTIONS.find(x => x[0] === qn);
                      return (
                        <tr key={qn} style={{ borderTop: qi === 0 ? '2px solid #334155' : '1px solid #1e293b' }}>
                          <td className="px-1.5 py-1 text-gray-600 text-[10px] sticky left-0 bg-[#1a2035] z-[3]">{qn}</td>
                          <td className="px-1.5 py-1 text-gray-400 text-[10px]">{qi === 0 ? cat : ''}</td>
                          <td className="px-1.5 py-1 text-center">
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: PHASE_COLORS[q[2]].bg, color: PHASE_COLORS[q[2]].text }}>{q[2]}</span>
                          </td>
                          <td className="px-1.5 py-1 text-gray-300 text-[11px] font-medium">{q[3]}</td>
                          <td className="px-1.5 py-1 text-gray-400 text-[10px] max-w-[280px]">{q[4]}</td>
                          {MONTHS.map((m, mi) => (
                            <td key={m} className={`px-0.5 py-0.5 text-center ${mi === selectedMonth ? 'bg-[#1e293b]' : ''}`}>
                              <ScoreCell value={scores[qn]?.[mi] || 0} phase={q[2]}
                                onChange={v => handleScoreChange(qn, mi, v)}
                                locked={!admin.isAdmin} />
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
