"use client";
import { useState, useEffect } from "react";
import { createClient } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => { setReady(true); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setError("가입 완료! 이메일을 확인하거나 바로 로그인하세요.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="card w-full max-w-sm">
        <h1
          className="text-2xl font-bold mb-1 bg-clip-text text-transparent"
          style={{ backgroundImage: "linear-gradient(135deg,#4f8ef7,#a78bfa)" }}
        >
          Radar Analysis
        </h1>
        <p className="text-sm text-muted mb-6">실험 데이터 상관관계 분석</p>

        {/* 탭 */}
        <div className="flex mb-5 border-b border-border">
          {["login", "signup"].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              className={`flex-1 pb-2 text-sm font-semibold transition-colors border-b-2 ${
                mode === m
                  ? "text-acc border-acc"
                  : "text-muted border-transparent hover:text-white"
              }`}
            >
              {m === "login" ? "로그인" : "회원가입"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="text-xs font-medium text-muted uppercase tracking-wider">이메일</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-acc transition"
            placeholder="you@example.com"
          />
          <label className="text-xs font-medium text-muted uppercase tracking-wider mt-1">비밀번호</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-acc transition"
            placeholder="6자 이상"
          />

          {error && (
            <p className={`text-xs mt-1 ${error.includes("완료") ? "text-green-400" : "text-red-400"}`}>
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary mt-2 w-full py-3">
            {loading ? "처리 중..." : mode === "login" ? "로그인" : "가입하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
