"use client";
import Link from "next/link";
import { useState } from "react";
import { signUpStaff } from "../actions";

export default function StaffSignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    if (password !== String(f.get("password2"))) return setError("비밀번호가 일치하지 않습니다.");
    if (password.length < 8) return setError("비밀번호는 8자 이상이어야 합니다.");
    setLoading(true);
    setError(null);
    const res = await signUpStaff({ name: String(f.get("name")), phone: String(f.get("phone")), email: String(f.get("email")), password });
    setLoading(false);
    if (!res.ok) return setError(res.error);
    setDone(true);
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="card w-full max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-bold">가입 신청 완료</h1>
          <p className="text-sm text-gray-600">관리자가 승인하면 로그인해서 사용할 수 있습니다.</p>
          <Link href="/login" className="btn inline-block">로그인 화면으로</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold">직원 회원가입</h1>
        <p className="text-sm text-gray-500">배차·차량 관리 직원용입니다. 가입 후 관리자가 승인하면 로그인할 수 있습니다.</p>
        <div>
          <label className="label" htmlFor="name">이름</label>
          <input id="name" name="name" required className="input" autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="phone">연락처</label>
          <input id="phone" name="phone" required className="input" autoComplete="tel" placeholder="010-0000-0000" />
        </div>
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
        <button className="btn w-full" disabled={loading}>{loading ? "가입 중..." : "가입 신청"}</button>
        <p className="text-center text-sm text-gray-500">
          이미 계정이 있나요? <Link href="/login" className="text-blue-600 hover:underline">로그인</Link>
        </p>
      </form>
    </main>
  );
}
