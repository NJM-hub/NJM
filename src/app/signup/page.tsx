"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    if (password !== String(f.get("password2"))) return setError("비밀번호가 일치하지 않습니다.");
    if (password.length < 8) return setError("비밀번호는 8자 이상이어야 합니다.");
    setLoading(true);
    setError(null);
    const { data, error } = await createClient().auth.signUp({
      email: String(f.get("email")),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/driver/profile` },
    });
    setLoading(false);
    if (error) return setError(error.message);
    if (!data.session) {
      setNotice("가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해서 기사 정보를 입력해주세요.");
      return;
    }
    router.replace("/driver/profile");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold">기사 회원가입</h1>
        <p className="text-sm text-gray-500">가입 후 신상정보(정산·세무신고용)를 입력하면 관리자 승인 뒤 배차를 받을 수 있습니다.</p>
        <div>
          <label className="label" htmlFor="email">이메일</label>
          <input id="email" name="email" type="email" required className="input" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">비밀번호 (8자 이상)</label>
          <input id="password" name="password" type="password" required minLength={8} className="input" autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="password2">비밀번호 확인</label>
          <input id="password2" name="password2" type="password" required className="input" autoComplete="new-password" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{notice}</p>}
        <button className="btn w-full" disabled={loading}>{loading ? "가입 중..." : "가입하기"}</button>
        <p className="text-center text-sm text-gray-500">
          이미 계정이 있나요? <Link href="/login" className="text-blue-600 hover:underline">로그인</Link>
        </p>
      </form>
    </main>
  );
}
