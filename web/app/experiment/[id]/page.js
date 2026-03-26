"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "../../../lib/supabase";
import { useRouter } from "next/navigation";
import {
  calcCorrMatrix, calcCorrPairs, calcVarStats, calcAxisProbs,
  knnPredict, pearson, mean, std, corrStrength, corrColor,
} from "../../../lib/analysis";
import ScatterCanvas from "../../../components/ScatterCanvas";
import CorrHeatmap from "../../../components/CorrHeatmap";

export default function ExperimentPage({ params }) {
  const { id } = params;
  const router = useRouter();

  const [experiment, setExperiment] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("input");

  // 입력 폼
  const [newName, setNewName] = useState("");
  const [newVals, setNewVals] = useState({});
  const [newResult, setNewResult] = useState("성공");
  const [saving, setSaving] = useState(false);

  // 인라인 편집
  const [editCell, setEditCell] = useState(null); // { caseId, field }
  const [editValue, setEditValue] = useState("");

  // 산점도
  const [scatterX, setScatterX] = useState(0);
  const [scatterY, setScatterY] = useState(1);

  // 예측
  const [predVals, setPredVals] = useState({});
  const [predResult, setPredResult] = useState(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const { data: exp } = await supabase
      .from("experiments").select("*").eq("id", id).single();
    if (!exp) { router.push("/dashboard"); return; }
    setExperiment(exp);

    const { data: c } = await supabase
      .from("cases").select("*").eq("experiment_id", id)
      .order("created_at", { ascending: true });
    setCases(c || []);
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/");
      else fetchData();
    });
  }, [router, fetchData]);

  const vars = experiment?.variables || [];
  const varNames = vars.map((v) => v.name);

  // 분석 (메모이제이션 대신 직접 계산 - 케이스 수가 적으므로 OK)
  const hasEnough = cases.length >= 3;
  const corrMatrix = hasEnough ? calcCorrMatrix(varNames, cases) : [];
  const corrPairs = hasEnough ? calcCorrPairs(varNames, cases) : [];
  const varStats = cases.length >= 1 ? calcVarStats(varNames, cases) : {};
  const axisProbs = hasEnough ? calcAxisProbs(varNames, cases) : {};

  const sCount = cases.filter((c) => c.result === "성공").length;
  const fCount = cases.filter((c) => c.result === "실패").length;
  const baseRate = cases.length ? ((sCount / cases.length) * 100).toFixed(1) : "0";

  // ── 핸들러 ──
  async function addCase(e) {
    e.preventDefault();
    setSaving(true);
    const vals = {};
    for (const v of vars) {
      const raw = newVals[v.name];
      vals[v.name] = raw !== "" && raw != null ? parseFloat(raw) : null;
    }
    const supabase = createClient();
    const { error } = await supabase.from("cases").insert({
      experiment_id: id,
      name: newName.trim() || `#${cases.length + 1}`,
      vals,
      result: newResult,
    });
    if (error) alert(error.message);
    else { setNewName(""); setNewVals({}); setNewResult("성공"); fetchData(); }
    setSaving(false);
  }

  async function deleteCase(caseId) {
    const supabase = createClient();
    await supabase.from("cases").delete().eq("id", caseId);
    fetchData();
  }

  // 인라인 편집
  function startEdit(caseId, field, currentValue) {
    setEditCell({ caseId, field });
    setEditValue(currentValue != null ? String(currentValue) : "");
  }

  async function saveEdit() {
    if (!editCell) return;
    const { caseId, field } = editCell;
    const c = cases.find(cs => cs.id === caseId);
    if (!c) { setEditCell(null); return; }

    const supabase = createClient();
    let updateData;

    if (field === "name") {
      updateData = { name: editValue.trim() || c.name };
    } else if (field === "result") {
      updateData = { result: editValue };
    } else {
      // 변수값 수정
      const newValsObj = { ...c.vals };
      newValsObj[field] = editValue !== "" ? parseFloat(editValue) : null;
      updateData = { vals: newValsObj };
    }

    await supabase.from("cases").update(updateData).eq("id", caseId);
    setEditCell(null);
    fetchData();
  }

  function handleEditKeyDown(e) {
    if (e.key === "Enter") { e.preventDefault(); saveEdit(); }
    else if (e.key === "Escape") setEditCell(null);
  }

  function runPredict() {
    const input = {};
    for (const v of varNames) {
      input[v] = predVals[v] != null && predVals[v] !== "" ? parseFloat(predVals[v]) : null;
    }
    const prob = knnPredict(varNames, cases, input);
    setPredResult(prob);
  }

  function probColor(p) {
    if (p >= 70) return "#22c55e";
    if (p >= 45) return "#fbbf24";
    return "#ef4444";
  }

  if (loading) return <div className="text-center py-20 text-muted text-sm">불러오는 중...</div>;

  // ── 탭 정의 ──
  const tabs = [
    { key: "input", label: "입력" },
    { key: "corr", label: "상관관계", min: 3 },
    { key: "scatter", label: "산점도", min: 3 },
    { key: "predict", label: "예측", min: 3 },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* ── 헤더 ── */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push(experiment.group_id ? `/group/${experiment.group_id}` : "/dashboard")} className="btn-ghost text-xs px-3 py-1.5">
          &larr; 그룹
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-white truncate">{experiment.name}</h1>
          {experiment.description && (
            <p className="text-xs text-muted truncate">{experiment.description}</p>
          )}
        </div>
      </div>

      {/* ── 요약 카드 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="card text-center py-3">
          <div className="mono text-2xl font-bold">{cases.length}</div>
          <div className="text-[10px] text-muted uppercase tracking-wider mt-0.5">전체</div>
        </div>
        <div className="card text-center py-3">
          <div className="mono text-2xl font-bold text-blue-400">{sCount}</div>
          <div className="text-[10px] text-muted uppercase tracking-wider mt-0.5">성공</div>
        </div>
        <div className="card text-center py-3">
          <div className="mono text-2xl font-bold text-red-400">{fCount}</div>
          <div className="text-[10px] text-muted uppercase tracking-wider mt-0.5">실패</div>
        </div>
        <div className="card text-center py-3">
          <div className="mono text-2xl font-bold" style={{ color: sCount > 0 ? "#22c55e" : "#6b7280" }}>
            {baseRate}%
          </div>
          <div className="text-[10px] text-muted uppercase tracking-wider mt-0.5">성공률</div>
        </div>
      </div>

      {/* ── 탭 ── */}
      <div className="flex border-b border-border mb-4 gap-1">
        {tabs.map(({ key, label, min }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            disabled={min && cases.length < min}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
              tab === key
                ? "text-acc border-acc"
                : min && cases.length < min
                ? "text-muted/40 border-transparent cursor-not-allowed"
                : "text-muted border-transparent hover:text-white"
            }`}
          >
            {label}
            {min && cases.length < min && (
              <span className="text-[10px] ml-1 text-muted/40">({min}건+)</span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/*  입력 탭                                       */}
      {/* ══════════════════════════════════════════════ */}
      {tab === "input" && (
        <div>
          {/* 새 케이스 폼 */}
          <form onSubmit={addCase} className="card mb-4">
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              새 케이스 추가
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-3">
              <div>
                <label className="text-[10px] text-muted uppercase block mb-1">이름</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-2.5 py-2 text-sm text-white outline-none focus:border-acc"
                  placeholder={`#${cases.length + 1}`}
                />
              </div>
              {vars.map((v) => (
                <div key={v.name}>
                  <label className="text-[10px] text-muted uppercase block mb-1">
                    {v.name}{v.unit ? ` (${v.unit})` : ""}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newVals[v.name] ?? ""}
                    onChange={(e) => setNewVals({ ...newVals, [v.name]: e.target.value })}
                    className="w-full bg-bg border border-border rounded-lg px-2.5 py-2 text-sm text-white outline-none focus:border-acc mono"
                  />
                </div>
              ))}
              <div>
                <label className="text-[10px] text-muted uppercase block mb-1">결과</label>
                <select
                  value={newResult}
                  onChange={(e) => setNewResult(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-2.5 py-2 text-sm text-white outline-none focus:border-acc"
                >
                  <option value="성공">성공</option>
                  <option value="실패">실패</option>
                </select>
              </div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? "저장 중..." : "추가"}
            </button>
          </form>

          {/* 데이터 테이블 */}
          {cases.length > 0 ? (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2.5 text-[10px] text-muted uppercase tracking-wider bg-card2 whitespace-nowrap">이름</th>
                    {vars.map((v) => (
                      <th key={v.name} className="text-right px-3 py-2.5 text-[10px] text-muted uppercase tracking-wider bg-card2 whitespace-nowrap">
                        {v.name}
                      </th>
                    ))}
                    <th className="text-center px-3 py-2.5 text-[10px] text-muted uppercase tracking-wider bg-card2">결과</th>
                    <th className="w-10 bg-card2"></th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c, ci) => (
                    <tr key={c.id} className={`border-t border-border/30 hover:bg-white/[.02] ${ci % 2 ? "bg-white/[.01]" : ""}`}>
                      <td className="px-3 py-2 text-white font-medium whitespace-nowrap cursor-pointer hover:bg-acc/5"
                        onClick={() => startEdit(c.id, "name", c.name)}>
                        {editCell?.caseId === c.id && editCell?.field === "name" ? (
                          <input value={editValue} onChange={e => setEditValue(e.target.value)}
                            onBlur={saveEdit} onKeyDown={handleEditKeyDown} autoFocus
                            className="w-full bg-bg border border-acc rounded px-1.5 py-0.5 text-sm text-white outline-none" />
                        ) : c.name}
                      </td>
                      {vars.map((v) => (
                        <td key={v.name}
                          className="px-3 py-2 text-right mono text-sm text-slate-300 whitespace-nowrap cursor-pointer hover:bg-acc/5"
                          onClick={() => startEdit(c.id, v.name, c.vals[v.name])}>
                          {editCell?.caseId === c.id && editCell?.field === v.name ? (
                            <input type="number" step="any" value={editValue} onChange={e => setEditValue(e.target.value)}
                              onBlur={saveEdit} onKeyDown={handleEditKeyDown} autoFocus
                              className="w-full bg-bg border border-acc rounded px-1.5 py-0.5 text-sm text-white outline-none text-right mono" />
                          ) : (c.vals[v.name] != null ? c.vals[v.name] : "—")}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center cursor-pointer hover:bg-acc/5"
                        onClick={() => startEdit(c.id, "result", c.result)}>
                        {editCell?.caseId === c.id && editCell?.field === "result" ? (
                          <select value={editValue} onChange={e => { setEditValue(e.target.value); }}
                            onBlur={saveEdit} autoFocus
                            className="bg-bg border border-acc rounded px-1.5 py-0.5 text-sm text-white outline-none">
                            <option value="성공">성공</option>
                            <option value="실패">실패</option>
                          </select>
                        ) : (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            c.result === "성공" ? "bg-blue-500/15 text-blue-400" : "bg-red-500/15 text-red-400"
                          }`}>{c.result}</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => deleteCase(c.id)}
                          className="text-red-400/50 hover:text-red-400 text-xs" title="삭제">&times;</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted text-sm">
              아직 케이스가 없습니다. 위에서 데이터를 입력하세요.
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/*  상관관계 탭                                     */}
      {/* ══════════════════════════════════════════════ */}
      {tab === "corr" && hasEnough && (
        <div>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="card flex-shrink-0">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">상관관계 행렬</div>
              <CorrHeatmap vars={varNames} matrix={corrMatrix}
                size={Math.min(420, Math.max(280, varNames.length * 42 + 80))} />
              <div className="flex justify-between text-[10px] text-muted mt-2 px-1">
                <span className="text-blue-400">-1.0 (음의 상관)</span>
                <span>0</span>
                <span className="text-orange-400">+1.0 (양의 상관)</span>
              </div>
            </div>
            <div className="card flex-1 overflow-x-auto p-0">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider px-4 pt-4 pb-2">
                변수 쌍별 상관계수 (강도 순)
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 text-[10px] text-muted uppercase bg-card2">변수 X</th>
                    <th className="text-left px-3 py-2 text-[10px] text-muted uppercase bg-card2">변수 Y</th>
                    <th className="text-right px-3 py-2 text-[10px] text-muted uppercase bg-card2">r</th>
                    <th className="text-left px-3 py-2 text-[10px] text-muted uppercase bg-card2">강도</th>
                  </tr>
                </thead>
                <tbody>
                  {corrPairs.map((p, i) => (
                    <tr key={i}
                      className="border-t border-border/30 hover:bg-acc/5 cursor-pointer"
                      onClick={() => { setScatterX(varNames.indexOf(p.vx)); setScatterY(varNames.indexOf(p.vy)); setTab("scatter"); }}>
                      <td className="px-3 py-2 text-white font-medium">{p.vx}</td>
                      <td className="px-3 py-2 text-white font-medium">{p.vy}</td>
                      <td className="px-3 py-2 text-right mono font-bold" style={{ color: p.r > 0 ? "#3b82f6" : "#ef4444" }}>
                        {p.r >= 0 ? "+" : ""}{p.r.toFixed(4)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded"
                          style={{ color: corrColor(p.r), background: corrColor(p.r) + "18" }}>
                          {corrStrength(p.r)} {p.r > 0 ? "양" : "음"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 기초통계 */}
          {Object.keys(varStats).length > 0 && (
            <div className="card mt-4 overflow-x-auto p-0">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider px-4 pt-4 pb-2">변수별 기초 통계</div>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 text-[10px] text-muted uppercase bg-card2">변수</th>
                    <th className="text-right px-3 py-2 text-[10px] text-blue-400/70 uppercase bg-card2">성공 평균</th>
                    <th className="text-right px-3 py-2 text-[10px] text-red-400/70 uppercase bg-card2">실패 평균</th>
                    <th className="text-right px-3 py-2 text-[10px] text-blue-400/70 uppercase bg-card2">성공 SD</th>
                    <th className="text-right px-3 py-2 text-[10px] text-red-400/70 uppercase bg-card2">실패 SD</th>
                    <th className="text-right px-3 py-2 text-[10px] text-muted uppercase bg-card2">범위</th>
                  </tr>
                </thead>
                <tbody>
                  {varNames.map((v, i) => {
                    const s = varStats[v];
                    return (
                      <tr key={v} className={`border-t border-border/30 ${i % 2 ? "bg-white/[.01]" : ""}`}>
                        <td className="px-3 py-2 font-medium text-white">{v}</td>
                        <td className="px-3 py-2 text-right mono text-blue-400">{s.sMean.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right mono text-red-400">{s.fMean.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right mono text-blue-400/60">{s.sStd.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right mono text-red-400/60">{s.fStd.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right mono text-slate-400">{s.min.toFixed(1)} ~ {s.max.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/*  산점도 탭                                      */}
      {/* ══════════════════════════════════════════════ */}
      {tab === "scatter" && hasEnough && (
        <div className="flex flex-col md:flex-row gap-4">
          <div className="card flex-shrink-0">
            <div className="flex gap-3 mb-3 flex-wrap">
              <div>
                <label className="text-[10px] text-muted uppercase block mb-1">X축</label>
                <select value={scatterX} onChange={(e) => setScatterX(Number(e.target.value))}
                  className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-white outline-none focus:border-acc">
                  {varNames.map((v, i) => <option key={i} value={i}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted uppercase block mb-1">Y축</label>
                <select value={scatterY} onChange={(e) => setScatterY(Number(e.target.value))}
                  className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-white outline-none focus:border-acc">
                  {varNames.map((v, i) => <option key={i} value={i}>{v}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <div className="text-center">
                  <div className="text-[10px] text-muted uppercase">상관계수</div>
                  <div className="mono text-2xl font-bold"
                    style={{ color: corrColor(corrMatrix[scatterX]?.[scatterY] || 0) }}>
                    {(corrMatrix[scatterX]?.[scatterY] || 0).toFixed(4)}
                  </div>
                </div>
              </div>
            </div>
            <ScatterCanvas xVar={varNames[scatterX]} yVar={varNames[scatterY]}
              cases={cases} width={480} height={360} />
          </div>

          <div className="flex-1 flex flex-col gap-3">
            {(() => {
              const r = corrMatrix[scatterX]?.[scatterY] || 0;
              const xV = varNames[scatterX], yV = varNames[scatterY];
              const sx = varStats[xV], sy = varStats[yV];
              return (
                <>
                  <div className="card">
                    <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">분석</div>
                    <p className="text-sm" style={{ color: corrColor(r) }}>
                      <strong>{corrStrength(r)} {r > 0 ? "양의" : r < 0 ? "음의" : ""} 상관관계</strong>
                    </p>
                    <p className="text-xs text-muted mt-1">
                      {Math.abs(r) > 0.5
                        ? `${xV}와(과) ${yV}는 유의미한 상관관계가 있어 하나를 조절하면 다른 변수에도 영향을 줄 수 있습니다.`
                        : Math.abs(r) > 0.3
                        ? `${xV}와(과) ${yV}는 약간의 상관관계가 있으나, 독립적으로 관리해도 무방합니다.`
                        : `${xV}와(과) ${yV}는 독립적인 변수로, 서로 큰 영향을 주지 않습니다.`}
                    </p>
                  </div>
                  {sx && sy && (
                    <div className="card p-0 overflow-hidden">
                      <div className="text-xs font-semibold text-muted uppercase tracking-wider px-4 pt-3 pb-2">기초 통계</div>
                      <table className="w-full text-xs">
                        <thead><tr>
                          <th className="text-left px-3 py-1.5 text-[10px] text-muted bg-card2"></th>
                          <th className="text-right px-3 py-1.5 text-[10px] text-blue-400/70 bg-card2">성공</th>
                          <th className="text-right px-3 py-1.5 text-[10px] text-red-400/70 bg-card2">실패</th>
                        </tr></thead>
                        <tbody>
                          <tr className="border-t border-border/30">
                            <td className="px-3 py-1.5 text-muted">{xV} 평균</td>
                            <td className="px-3 py-1.5 text-right mono text-blue-400">{sx.sMean.toFixed(2)}</td>
                            <td className="px-3 py-1.5 text-right mono text-red-400">{sx.fMean.toFixed(2)}</td>
                          </tr>
                          <tr className="border-t border-border/30 bg-white/[.01]">
                            <td className="px-3 py-1.5 text-muted">{yV} 평균</td>
                            <td className="px-3 py-1.5 text-right mono text-blue-400">{sy.sMean.toFixed(2)}</td>
                            <td className="px-3 py-1.5 text-right mono text-red-400">{sy.fMean.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="card">
                    <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">주요 변수 쌍</div>
                    <div className="flex flex-col gap-1">
                      {corrPairs.slice(0, 8).map((p, i) => (
                        <button key={i}
                          onClick={() => { setScatterX(varNames.indexOf(p.vx)); setScatterY(varNames.indexOf(p.vy)); }}
                          className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-white/[.03] transition text-left">
                          <span className="text-xs text-white">{p.vx} &harr; {p.vy}</span>
                          <span className="mono text-xs font-bold"
                            style={{ color: p.r > 0 ? "#3b82f6" : "#ef4444" }}>
                            {p.r >= 0 ? "+" : ""}{p.r.toFixed(3)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/*  예측 탭                                        */}
      {/* ══════════════════════════════════════════════ */}
      {tab === "predict" && hasEnough && (
        <div>
          {/* 변수별 성공확률 테이블 */}
          <div className="card mb-4 overflow-x-auto p-0">
            <div className="text-xs font-semibold text-muted uppercase tracking-wider px-4 pt-4 pb-2">
              변수별 성공 확률
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 text-[10px] text-muted uppercase bg-card2">변수</th>
                  <th className="text-right px-3 py-2 text-[10px] text-blue-400/70 uppercase bg-card2">성공 평균</th>
                  <th className="text-right px-3 py-2 text-[10px] text-red-400/70 uppercase bg-card2">실패 평균</th>
                  <th className="text-right px-3 py-2 text-[10px] text-muted uppercase bg-card2">범위</th>
                  <th className="text-left px-3 py-2 text-[10px] text-muted uppercase bg-card2">성공확률</th>
                </tr>
              </thead>
              <tbody>
                {[...varNames]
                  .sort((a, b) => (axisProbs[b] || 0) - (axisProbs[a] || 0))
                  .map((v, i) => {
                    const s = varStats[v];
                    const prob = axisProbs[v] || 0;
                    return (
                      <tr key={v} className={`border-t border-border/30 ${i % 2 ? "bg-white/[.01]" : ""}`}>
                        <td className="px-3 py-2 font-medium text-white">{v}</td>
                        <td className="px-3 py-2 text-right mono text-blue-400">{s.sMean.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right mono text-red-400">{s.fMean.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right mono text-slate-400">{s.min.toFixed(1)}~{s.max.toFixed(1)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-2 rounded-full bg-white/5 flex-1 max-w-[100px]">
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${prob}%`, background: probColor(prob) }} />
                            </div>
                            <span className="mono text-xs font-bold" style={{ color: probColor(prob) }}>{prob}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* KNN 예측 계산기 */}
          <div className="card">
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
              예측 계산기 (KNN k=7)
            </div>
            <p className="text-xs text-muted mb-4">
              각 변수에 값을 입력하면 기존 데이터를 기반으로 성공 확률을 예측합니다.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
              {vars.map((v) => {
                const s = varStats[v.name];
                return (
                  <div key={v.name}>
                    <label className="text-[10px] text-muted uppercase block mb-1">
                      {v.name}{v.unit ? ` (${v.unit})` : ""}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={predVals[v.name] ?? ""}
                      onChange={(e) => setPredVals({ ...predVals, [v.name]: e.target.value })}
                      placeholder={s ? `${s.min.toFixed(0)}~${s.max.toFixed(0)}` : ""}
                      className="w-full bg-bg border border-border rounded-lg px-2.5 py-2 text-sm text-white outline-none focus:border-acc mono"
                    />
                  </div>
                );
              })}
            </div>

            <button onClick={runPredict} className="btn-primary text-sm mb-4">
              예측하기
            </button>

            {predResult !== null && (
              <div className="text-center p-6 rounded-xl"
                style={{ background: `linear-gradient(135deg, ${probColor(predResult)}10, ${probColor(predResult)}05)`,
                         border: `1px solid ${probColor(predResult)}30` }}>
                <div className="text-[10px] text-muted uppercase tracking-wider mb-1">예측 성공 확률</div>
                <div className="mono text-5xl font-bold" style={{ color: probColor(predResult) }}>
                  {predResult}%
                </div>
                <div className="h-3 rounded-full bg-white/5 max-w-xs mx-auto mt-3">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${predResult}%`, background: `linear-gradient(to right, ${probColor(Math.max(0, predResult - 25))}, ${probColor(predResult)})` }} />
                </div>
                <p className="text-xs text-muted mt-3">
                  {predResult >= 70
                    ? "성공 가능성이 높습니다. 유사한 과거 케이스의 대부분이 성공했습니다."
                    : predResult >= 45
                    ? "성공/실패 경계선에 있습니다. 핵심 변수를 개선하면 확률이 올라갑니다."
                    : "성공 가능성이 낮습니다. 유사한 과거 케이스의 대부분이 실패했습니다."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
