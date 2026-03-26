"use client";
import { useState, useEffect, useCallback, use } from "react";
import { createClient } from "../../../lib/supabase";
import { useRouter } from "next/navigation";

export default function GroupPage({ params }) {
  const { id } = use(params);
  const router = useRouter();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [tab, setTab] = useState("experiments"); // experiments | members

  // 실험 생성
  const [showNewExp, setShowNewExp] = useState(false);
  const [expName, setExpName] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [varRows, setVarRows] = useState([{ name: "", unit: "" }, { name: "", unit: "" }, { name: "", unit: "" }]);

  // 초대
  const [showInvite, setShowInvite] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [searchQ, setSearchQ] = useState("");

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: grp }, { data: mems }, { data: exps }] = await Promise.all([
      supabase.from("groups").select("*").eq("id", id).single(),
      supabase.from("group_members").select("*, profiles(id, email, display_name)")
        .eq("group_id", id).order("joined_at"),
      supabase.from("experiments").select("*, cases(id)")
        .eq("group_id", id).order("created_at", { ascending: false }),
    ]);
    if (!grp) { router.push("/dashboard"); return; }
    setGroup(grp);
    setMembers(mems || []);
    setExperiments(exps || []);
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/");
      else { setUserId(user.id); fetchData(); }
    });
  }, [router, fetchData]);

  const isOwner = group?.owner_id === userId;
  const memberIds = members.map(m => m.user_id);

  // 실험 생성
  async function createExperiment(e) {
    e.preventDefault();
    const variables = varRows.filter(v => v.name.trim()).map(v => ({ name: v.name.trim(), unit: v.unit.trim() }));
    if (variables.length < 2) return alert("변수 2개 이상 필요합니다");
    const supabase = createClient();
    const { error } = await supabase.from("experiments").insert({
      group_id: id, created_by: userId,
      name: expName.trim() || "새 실험",
      description: expDesc.trim(), variables,
    });
    if (error) { alert(error.message); return; }
    setShowNewExp(false); setExpName(""); setExpDesc("");
    setVarRows([{ name: "", unit: "" }, { name: "", unit: "" }, { name: "", unit: "" }]);
    fetchData();
  }

  async function deleteExperiment(eid) {
    if (!confirm("이 실험을 삭제하시겠습니까?")) return;
    const supabase = createClient();
    await supabase.from("experiments").delete().eq("id", eid);
    fetchData();
  }

  // 초대: 전체 유저 불러오기
  async function openInvite() {
    const supabase = createClient();
    const { data } = await supabase.from("profiles").select("*").order("email");
    setAllUsers(data || []);
    setShowInvite(true);
    setSearchQ("");
  }

  async function inviteUser(uid) {
    const supabase = createClient();
    const { error } = await supabase.from("group_members").insert({
      group_id: id, user_id: uid, role: "member"
    });
    if (error) { alert(error.message); return; }
    fetchData();
    // 목록 갱신
    setAllUsers(prev => prev);
  }

  async function removeMember(uid) {
    if (uid === userId) return;
    if (!confirm("이 멤버를 내보내시겠습니까?")) return;
    const supabase = createClient();
    await supabase.from("group_members").delete()
      .eq("group_id", id).eq("user_id", uid);
    fetchData();
  }

  const filteredUsers = allUsers.filter(u =>
    !memberIds.includes(u.id) &&
    (u.email.toLowerCase().includes(searchQ.toLowerCase()) ||
     (u.display_name || "").toLowerCase().includes(searchQ.toLowerCase()))
  );

  if (loading) return <div className="text-center py-20 text-muted text-sm">불러오는 중...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/dashboard")} className="btn-ghost text-xs px-3 py-1.5">&larr; 목록</button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-white truncate">{group.name}</h1>
          <p className="text-xs text-muted">멤버 {members.length}명 · 실험 {experiments.length}개</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-border mb-4 gap-1">
        {[{ key: "experiments", label: "실험" }, { key: "members", label: "멤버" }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
              tab === t.key ? "text-acc border-acc" : "text-muted border-transparent hover:text-white"
            }`}>{t.label}</button>
        ))}
      </div>

      {/* ═══ 실험 탭 ═══ */}
      {tab === "experiments" && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowNewExp(true)} className="btn-primary text-sm">+ 새 실험</button>
          </div>

          {/* 실험 생성 모달 */}
          {showNewExp && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
              onClick={() => setShowNewExp(false)}>
              <form onClick={e => e.stopPropagation()} onSubmit={createExperiment}
                className="card w-full max-w-lg max-h-[85vh] overflow-y-auto">
                <h2 className="text-lg font-bold text-white mb-4">새 실험 만들기</h2>
                <label className="text-xs font-medium text-muted uppercase tracking-wider">실험 이름</label>
                <input value={expName} onChange={e => setExpName(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-acc mb-3 mt-1"
                  placeholder="예: 합성반응 조건 탐색" required />
                <label className="text-xs font-medium text-muted uppercase tracking-wider">설명 (선택)</label>
                <input value={expDesc} onChange={e => setExpDesc(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-acc mb-4 mt-1" />
                <label className="text-xs font-medium text-muted uppercase tracking-wider mb-2 block">변수 (최소 2개)</label>
                <div className="flex flex-col gap-2 mb-3">
                  {varRows.map((v, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={v.name} onChange={e => { const n=[...varRows]; n[i]={...n[i],name:e.target.value}; setVarRows(n); }}
                        className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-acc"
                        placeholder={`변수${i+1}`} />
                      <input value={v.unit} onChange={e => { const n=[...varRows]; n[i]={...n[i],unit:e.target.value}; setVarRows(n); }}
                        className="w-20 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-acc"
                        placeholder="단위" />
                      <button type="button" onClick={() => varRows.length > 2 && setVarRows(varRows.filter((_,idx)=>idx!==i))}
                        className="text-red-400 hover:text-red-300 text-lg px-1">&times;</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setVarRows([...varRows, {name:"",unit:""}])}
                  className="btn-ghost text-xs mb-4">+ 변수 추가</button>
                <div className="flex gap-2 mt-2">
                  <button type="submit" className="btn-primary flex-1">만들기</button>
                  <button type="button" onClick={() => setShowNewExp(false)} className="btn-ghost flex-1">취소</button>
                </div>
              </form>
            </div>
          )}

          {experiments.length === 0 ? (
            <div className="text-center py-12 text-muted text-sm">아직 실험이 없습니다</div>
          ) : (
            <div className="flex flex-col gap-3">
              {experiments.map(exp => (
                <div key={exp.id}
                  className="card flex items-center justify-between hover:border-acc/30 transition cursor-pointer group/item"
                  onClick={() => router.push(`/experiment/${exp.id}`)}>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white text-sm truncate group-hover/item:text-acc transition">{exp.name}</h3>
                    <div className="flex gap-3 mt-1 text-xs text-muted">
                      <span>변수 {exp.variables?.length || 0}개</span>
                      <span>케이스 {exp.cases?.length || 0}건</span>
                      <span>{new Date(exp.created_at).toLocaleDateString("ko")}</span>
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteExperiment(exp.id); }}
                    className="btn-danger text-xs opacity-0 group-hover/item:opacity-100 transition shrink-0 ml-3">삭제</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ 멤버 탭 ═══ */}
      {tab === "members" && (
        <div>
          {isOwner && (
            <div className="flex justify-end mb-3">
              <button onClick={openInvite} className="btn-primary text-sm">+ 멤버 초대</button>
            </div>
          )}

          {/* 초대 모달 */}
          {showInvite && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
              onClick={() => setShowInvite(false)}>
              <div onClick={e => e.stopPropagation()}
                className="card w-full max-w-md max-h-[80vh] flex flex-col">
                <h2 className="text-lg font-bold text-white mb-3">멤버 초대</h2>
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-acc mb-3"
                  placeholder="이메일 또는 이름으로 검색..." autoFocus />
                <div className="flex-1 overflow-y-auto flex flex-col gap-1 min-h-0">
                  {filteredUsers.length === 0 ? (
                    <p className="text-center text-muted text-xs py-6">
                      {searchQ ? "검색 결과 없음" : "초대 가능한 사용자 없음"}
                    </p>
                  ) : filteredUsers.map(u => (
                    <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[.03]">
                      <div className="min-w-0">
                        <div className="text-sm text-white truncate">{u.display_name || u.email}</div>
                        <div className="text-xs text-muted truncate">{u.email}</div>
                      </div>
                      <button onClick={() => inviteUser(u.id)}
                        className="btn-primary text-xs px-3 py-1 shrink-0 ml-2">초대</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowInvite(false)} className="btn-ghost text-sm mt-3 w-full">닫기</button>
              </div>
            </div>
          )}

          {/* 멤버 리스트 */}
          <div className="flex flex-col gap-2">
            {members.map(m => (
              <div key={m.id} className="card flex items-center justify-between py-3">
                <div className="min-w-0">
                  <div className="text-sm text-white font-medium truncate">
                    {m.profiles?.display_name || m.profiles?.email || "—"}
                  </div>
                  <div className="text-xs text-muted truncate">{m.profiles?.email}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    m.role === "owner" ? "bg-acc/15 text-acc" : "bg-white/5 text-muted"
                  }`}>{m.role === "owner" ? "그룹장" : "멤버"}</span>
                  {isOwner && m.user_id !== userId && (
                    <button onClick={() => removeMember(m.user_id)}
                      className="text-red-400/50 hover:text-red-400 text-xs">&times;</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
