"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    if (password.length < 8) return setError("비밀번호는 8자 이상이어야 합니다.");
    if (password !== String(f.get("password2"))) return setError("비밀번호가 일치하지 않습니다.");
    setLoading(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    router.replace("/me");
    router.refresh();
  }

  return (
    <div className="site-container max-w-md py-10 sm:py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">비밀번호 변경</h1>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="새 비밀번호 (8자 이상)" className="site-input" aria-label="새 비밀번호" />
        <input name="password2" type="password" required autoComplete="new-password" placeholder="새 비밀번호 확인" className="site-input" aria-label="새 비밀번호 확인" />
        {error && <p className="text-sm font-semibold text-red-600" role="alert">{error}</p>}
        <button className="site-btn h-14 w-full text-base" disabled={loading}>{loading ? "변경 중..." : "변경하기"}</button>
      </form>
    </div>
  );
}
