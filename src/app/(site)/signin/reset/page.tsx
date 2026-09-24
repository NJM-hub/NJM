"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const email = String(new FormData(e.currentTarget).get("email"));
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/mypage/password`,
    });
    setLoading(false);
    if (error) return setError(error.message);
    setSent(true);
  }

  return (
    <div className="site-container max-w-md py-10 sm:py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">비밀번호 찾기</h1>
      {sent ? (
        <p className="mt-6 rounded-2xl bg-site-bg p-6 text-site-ink-2">비밀번호를 다시 설정할 수 있는 링크를 메일로 보냈습니다. 메일이 오지 않으면 스팸함도 확인해 주세요.</p>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <p className="text-site-ink-2">가입하신 이메일을 입력하시면 비밀번호 재설정 링크를 보내 드립니다.</p>
          <input name="email" type="email" required autoComplete="email" placeholder="이메일" className="site-input" aria-label="이메일" />
          {error && <p className="text-sm font-semibold text-red-600" role="alert">{error}</p>}
          <button className="site-btn h-14 w-full text-base" disabled={loading}>{loading ? "보내는 중..." : "재설정 메일 받기"}</button>
        </form>
      )}
    </div>
  );
}
