"use client";
import { useActionState } from "react";
import { changePassword } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);
  return (
    <form action={action} className="card w-full max-w-sm space-y-4">
      <h1 className="text-xl font-bold">비밀번호 변경</h1>
      <div>
        <label className="label" htmlFor="current">현재 비밀번호</label>
        <input id="current" name="current" type="password" required className="input" autoComplete="current-password" />
      </div>
      <div>
        <label className="label" htmlFor="next">새 비밀번호 (8자 이상)</label>
        <input id="next" name="next" type="password" required minLength={8} className="input" autoComplete="new-password" />
      </div>
      <div>
        <label className="label" htmlFor="confirm">새 비밀번호 확인</label>
        <input id="confirm" name="confirm" type="password" required minLength={8} className="input" autoComplete="new-password" />
      </div>
      {state && <p className={`text-sm ${state.ok ? "text-green-700" : "text-red-600"}`}>{state.message}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? "변경 중..." : "비밀번호 변경"}</button>
    </form>
  );
}
