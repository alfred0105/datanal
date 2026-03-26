"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const supabase = createClient();
  const router = useRouter();
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // 새 실험 폼
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [varRows, setVarRows] = useState([
    { name: "", unit: "" },
    { name: "", unit: "" },
    { name: "", unit: "" },
  ]);

  const fetchExperiments = useCallback(async () => {
    const { data } = await supabase
      .from("experiments")
      .select("*, cases(id)")
      .order("created_at", { ascending: false });
    setExperiments(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // 인증 체크
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/");
      else fetchExperiments();
    });
  }, [supabase, router, fetchExperiments]);

  function addVarRow() {
    setVarRows([...varRows, { name: "", unit: "" }]);
  }

  function removeVarRow(i) {
    if (varRows.length <= 2) return;
    setVarRows(varRows.filter((_, idx) => idx !== i));
  }

  function updateVar(i, field, val) {
    const next = [...varRows];
    next[i] = { ...next[i], [field]: val };
    setVarRows(next);
  }

  async function handleCreate(e) {
    e.preventDefault();
    const variables = varRows
      .filter((v) => v.name.trim())
      .map((v) => ({ name: v.name.trim(), unit: v.unit.trim() }));
    if (variables.length < 2) return alert("변수 2개 이상 필요합니다");

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("experiments").insert({
      user_id: user.id,
      name: newName.trim() || "새 실험",
      description: newDesc.trim(),
      variables,
    });
    if (error) return alert(error.message);

    setShowCreate(false);
    setNewName("");
    setNewDesc("");
    setVarRows([{ name: "", unit: "" }, { name: "", unit: "" }, { name: "", unit: "" }]);
    fetchExperiments();
  }

  async function deleteExperiment(id) {
    if (!confirm("이 실험을 삭제하시겠습니까? 모든 케이스도 함께 삭제됩니다.")) return;
    await supabase.from("experiments").delete().eq("id", id);
    fetchExperiments();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-xl font-bold bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg,#4f8ef7,#a78bfa)" }}
          >
            Radar Analysis
          </h1>
          <p className="text-xs text-muted mt-0.5">내 실험 목록</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
            + 새 실험
          </button>
          <button onClick={handleLogout} className="btn-ghost text-xs">
            로그아웃
          </button>
        </div>
      </div>

      {/* 새 실험 생성 모달 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
             onClick={() => setShowCreate(false)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreate}
            className="card w-full max-w-lg max-h-[85vh] overflow-y-auto"
          >
            <h2 className="text-lg font-bold text-white mb-4">새 실험 만들기</h2>

            <label className="text-xs font-medium text-muted uppercase tracking-wider">실험 이름</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-acc mb-3 mt-1"
              placeholder="예: 합성반응 실험 A"
              required
            />

            <label className="text-xs font-medium text-muted uppercase tracking-wider">설명 (선택)</label>
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-acc mb-4 mt-1"
              placeholder="예: 촉매 농도 조건 변화 실험"
            />

            <label className="text-xs font-medium text-muted uppercase tracking-wider mb-2 block">
              변수 정의 (최소 2개)
            </label>
            <div className="flex flex-col gap-2 mb-3">
              {varRows.map((v, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={v.name}
                    onChange={(e) => updateVar(i, "name", e.target.value)}
                    className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-acc"
                    placeholder={`변수${i + 1} 이름`}
                  />
                  <input
                    value={v.unit}
                    onChange={(e) => updateVar(i, "unit", e.target.value)}
                    className="w-20 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-acc"
                    placeholder="단위"
                  />
                  <button
                    type="button"
                    onClick={() => removeVarRow(i)}
                    className="text-red-400 hover:text-red-300 text-lg px-1"
                    title="삭제"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addVarRow} className="btn-ghost text-xs mb-4">
              + 변수 추가
            </button>

            <div className="flex gap-2 mt-2">
              <button type="submit" className="btn-primary flex-1">만들기</button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost flex-1">
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 실험 목록 */}
      {loading ? (
        <p className="text-muted text-sm text-center py-12">불러오는 중...</p>
      ) : experiments.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted text-sm mb-4">아직 실험이 없습니다</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            첫 번째 실험 만들기
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {experiments.map((exp) => (
            <div
              key={exp.id}
              className="card flex items-center justify-between hover:border-acc/30 transition cursor-pointer group"
              onClick={() => router.push(`/experiment/${exp.id}`)}
            >
              <div className="min-w-0">
                <h3 className="font-semibold text-white text-sm truncate group-hover:text-acc transition">
                  {exp.name}
                </h3>
                <div className="flex gap-3 mt-1 text-xs text-muted">
                  <span>변수 {exp.variables?.length || 0}개</span>
                  <span>케이스 {exp.cases?.length || 0}건</span>
                  <span>{new Date(exp.created_at).toLocaleDateString("ko")}</span>
                </div>
                {exp.description && (
                  <p className="text-xs text-muted/70 mt-1 truncate">{exp.description}</p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteExperiment(exp.id); }}
                className="btn-danger text-xs opacity-0 group-hover:opacity-100 transition shrink-0 ml-3"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
