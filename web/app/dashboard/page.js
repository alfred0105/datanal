"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [userId, setUserId] = useState(null);

  const fetchGroups = useCallback(async () => {
    const supabase = createClient();
    // 내가 속한 그룹 + 멤버수 + 실험수
    const { data } = await supabase
      .from("group_members")
      .select("group_id, role, groups(id, name, owner_id, created_at)")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    // 그룹별 멤버수, 실험수 조회
    const gIds = data.map(d => d.groups.id);
    const [{ data: memberCounts }, { data: expCounts }] = await Promise.all([
      supabase.from("group_members").select("group_id").in("group_id", gIds),
      supabase.from("experiments").select("group_id").in("group_id", gIds),
    ]);

    const mCount = {}, eCount = {};
    (memberCounts || []).forEach(m => { mCount[m.group_id] = (mCount[m.group_id] || 0) + 1; });
    (expCounts || []).forEach(e => { eCount[e.group_id] = (eCount[e.group_id] || 0) + 1; });

    setGroups(data.map(d => ({
      ...d.groups,
      role: d.role,
      memberCount: mCount[d.groups.id] || 0,
      expCount: eCount[d.groups.id] || 0,
    })));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/");
      else { setUserId(user.id); }
    });
  }, [router]);

  useEffect(() => {
    if (userId) fetchGroups();
  }, [userId, fetchGroups]);

  async function handleCreate(e) {
    e.preventDefault();
    const supabase = createClient();
    const name = newName.trim();
    if (!name) return;

    // 그룹 생성
    const { data: grp, error } = await supabase
      .from("groups").insert({ name, owner_id: userId }).select().single();
    if (error) { alert(error.message); return; }

    // 본인을 owner 멤버로 추가
    await supabase.from("group_members").insert({
      group_id: grp.id, user_id: userId, role: "owner"
    });

    setNewName("");
    setShowCreate(false);
    fetchGroups();
  }

  async function deleteGroup(gid) {
    if (!confirm("이 그룹을 삭제하시겠습니까? 모든 실험과 데이터가 삭제됩니다.")) return;
    const supabase = createClient();
    await supabase.from("groups").delete().eq("id", gid);
    fetchGroups();
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg,#4f8ef7,#a78bfa)" }}>
            Radar Analysis
          </h1>
          <p className="text-xs text-muted mt-0.5">내 그룹</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">+ 새 그룹</button>
          <button onClick={handleLogout} className="btn-ghost text-xs">로그아웃</button>
        </div>
      </div>

      {/* 그룹 생성 모달 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreate(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={handleCreate}
            className="card w-full max-w-sm">
            <h2 className="text-lg font-bold text-white mb-4">새 그룹 만들기</h2>
            <label className="text-xs font-medium text-muted uppercase tracking-wider">그룹 이름</label>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-acc mb-4 mt-1"
              placeholder="예: 합성반응 연구팀" required autoFocus />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">만들기</button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost flex-1">취소</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-muted text-sm text-center py-12">불러오는 중...</p>
      ) : groups.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted text-sm mb-4">아직 그룹이 없습니다</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">첫 그룹 만들기</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(g => (
            <div key={g.id}
              className="card flex items-center justify-between hover:border-acc/30 transition cursor-pointer group"
              onClick={() => router.push(`/group/${g.id}`)}>
              <div className="min-w-0">
                <h3 className="font-semibold text-white text-sm truncate group-hover:text-acc transition">
                  {g.name}
                </h3>
                <div className="flex gap-3 mt-1 text-xs text-muted">
                  <span>{g.role === "owner" ? "그룹장" : "멤버"}</span>
                  <span>멤버 {g.memberCount}명</span>
                  <span>실험 {g.expCount}개</span>
                </div>
              </div>
              {g.role === "owner" && (
                <button onClick={e => { e.stopPropagation(); deleteGroup(g.id); }}
                  className="btn-danger text-xs opacity-0 group-hover:opacity-100 transition shrink-0 ml-3">
                  삭제
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
