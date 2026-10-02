"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/Form";
import type { FormState } from "@/lib/types";

export default function LoginForm({ action, next }: { action: (p: FormState, fd: FormData) => Promise<FormState>; next: string }) {
  const [state, formAction] = useActionState(action, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div>
        <label className="label" htmlFor="email">이메일</label>
        <input id="email" name="email" type="email" autoComplete="username" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="password">비밀번호</label>
        <input id="password" name="password" type="password" autoComplete="current-password" className="input" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" name="keep" className="size-4 accent-navy-800" />
        로그인 상태 유지 (30일)
      </label>
      <SubmitButton className="btn w-full" pendingText="확인 중...">로그인</SubmitButton>
    </form>
  );
}
