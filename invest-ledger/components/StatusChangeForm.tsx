"use client";

import { useActionState, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { INVESTMENT_STATUSES } from "@/lib/constants";
import type { FormState } from "@/lib/types";

export default function StatusChangeForm({
  action,
  current,
  currentReason,
  allowCancel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  current: string;
  currentReason: string;
  /** 취소(또는 취소 되돌리기)는 관리자만 */
  allowCancel: boolean;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const [status, setStatus] = useState(current);
  const [reason, setReason] = useState(currentReason);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (status === "cancelled" && !confirm("이 투자 건을 '취소' 상태로 바꿀까요?\n데이터는 삭제되지 않고, 목록에서 숨겨집니다. 나중에 다시 되돌릴 수 있습니다.")) {
          e.preventDefault();
        }
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {INVESTMENT_STATUSES.filter((s) => allowCancel || (s.value !== "cancelled" && current !== "cancelled") || s.value === current).map((s) => (
          <label key={s.value}
            className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium ${
              status === s.value ? "border-navy-800 bg-navy-800 text-white" : "border-slate-300 bg-white text-slate-700"
            }`}>
            <input type="radio" name="status" value={s.value} checked={status === s.value}
              onChange={() => setStatus(s.value)} className="sr-only" />
            {s.label}
          </label>
        ))}
      </div>
      <input name="status_reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder={status === "cancelled" ? "취소 사유 (필수)" : "변경 사유 (선택)"} />
      {state.error && <p className="field-error">{state.error}</p>}
      <div className="flex justify-end">
        <SubmitButton className={status === "cancelled" ? "btn-danger" : "btn"}>상태 변경</SubmitButton>
      </div>
    </form>
  );
}
