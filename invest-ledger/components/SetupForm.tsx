"use client";

import { useActionState, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import type { FormState } from "@/lib/types";

const FIELDS = [
  { name: "setup_password", label: "지금 쓰는 접속 비밀번호", type: "password", hint: "Vercel 의 BASIC_AUTH_PASSWORD 값 (본인 확인용)", auto: "off" },
  { name: "name", label: "관리자 이름", type: "text", hint: "", auto: "name" },
  { name: "email", label: "로그인 이메일", type: "email", hint: "로그인 아이디로 씁니다. 실제로 메일이 가지는 않습니다.", auto: "username" },
  { name: "password", label: "새 비밀번호 (8자 이상)", type: "password", hint: "", auto: "new-password" },
  { name: "password2", label: "새 비밀번호 확인", type: "password", hint: "", auto: "new-password" },
] as const;

export default function SetupForm({ action }: { action: (p: FormState, fd: FormData) => Promise<FormState> }) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const [v, setV] = useState<Record<string, string>>({});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {FIELDS.map((f) => (
        <div key={f.name}>
          <label className="label" htmlFor={f.name}>{f.label}</label>
          <input id={f.name} name={f.name} type={f.type} autoComplete={f.auto} className={`input ${fe[f.name] ? "input-error" : ""}`}
            value={v[f.name] ?? ""} onChange={(e) => setV((p) => ({ ...p, [f.name]: e.target.value }))} />
          {f.hint && !fe[f.name] && <p className="hint">{f.hint}</p>}
          {fe[f.name] && <p className="field-error">{fe[f.name]}</p>}
        </div>
      ))}
      <SubmitButton className="btn w-full" pendingText="만드는 중...">관리자 계정 만들기</SubmitButton>
    </form>
  );
}
