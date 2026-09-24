"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SigninForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email: String(f.get("email")), password: String(f.get("password")) });
    setLoading(false);
    if (error) {
      if (error.message === "Invalid login credentials") return setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      if (error.message === "Email not confirmed") return setError("가입 확인 메일의 링크를 먼저 눌러 주세요.");
      return setError(error.message);
    }
    router.replace("/me");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="site-label" htmlFor="email">이메일</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="site-input" />
      </div>
      <div>
        <label className="site-label" htmlFor="password">비밀번호</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="site-input" />
      </div>
      {error && <p className="text-sm font-semibold text-red-600" role="alert">{error}</p>}
      <button className="site-btn h-14 w-full text-base" disabled={loading}>{loading ? "로그인 중..." : "로그인"}</button>
      <div className="flex justify-between text-sm text-site-ink-2">
        <Link href="/signin/reset" className="hover:text-site-ink">비밀번호 찾기</Link>
        <Link href="/join" className="font-bold text-site-ink">회원가입</Link>
      </div>
    </form>
  );
}
