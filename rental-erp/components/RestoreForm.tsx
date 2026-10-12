"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/Form";
import type { FormState } from "@/lib/types";

export default function RestoreForm({ action }: { action: (p: FormState, fd: FormData) => Promise<FormState> }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className="space-y-3"
      onSubmit={(e) => {
        if (!confirm("지금 데이터가 모두 백업 파일 내용으로 바뀝니다. 계속할까요?")) e.preventDefault();
      }}
    >
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
      <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
        <div>
          <label className="label">백업 파일 (.json.gz)</label>
          <input type="file" name="file" accept=".gz,.json,application/gzip,application/json" className="input !py-1.5" required />
        </div>
        <div>
          <label className="label">확인을 위해 &apos;복원&apos; 입력</label>
          <input name="confirm" className="input" autoComplete="off" required />
        </div>
        <SubmitButton pendingText="복원하는 중...">복원하기</SubmitButton>
      </div>
    </form>
  );
}
