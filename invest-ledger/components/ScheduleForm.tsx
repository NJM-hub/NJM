"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { comma } from "@/lib/format";
import type { FormState } from "@/lib/types";

/** 회차 수정/추가 폼 */
export default function ScheduleForm({
  action,
  initial,
  cancelHref,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial: { dueDate: string; plannedAmount: number | null; memo: string };
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [planned, setPlanned] = useState(initial.plannedAmount == null ? "" : comma(initial.plannedAmount));
  const [memo, setMemo] = useState(initial.memo);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="card card-body space-y-4">
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="due_date">예정 회수일</label>
          <input id="due_date" name="due_date" type="date" className={`input ${fe.due_date ? "input-error" : ""}`}
            value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          {fe.due_date && <p className="field-error">{fe.due_date}</p>}
        </div>
        <div>
          <label className="label" htmlFor="planned_amount">예정 회수금액 (원)</label>
          <input id="planned_amount" name="planned_amount" inputMode="numeric"
            className={`input text-right tabular-nums ${fe.planned_amount ? "input-error" : ""}`}
            value={planned} onChange={(e) => setPlanned(comma(e.target.value))} placeholder="0" />
          {fe.planned_amount && <p className="field-error">{fe.planned_amount}</p>}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="memo">메모</label>
        <textarea id="memo" name="memo" rows={3} className="input" value={memo} onChange={(e) => setMemo(e.target.value)}
          placeholder="예: 고객 요청으로 다음 주로 연기 / 부분 입금 약속" />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="btn-secondary">취소</Link>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
