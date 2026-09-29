"use client";

import { useActionState, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { comma, parseMoney, won, ymd } from "@/lib/format";
import { allocatePayment } from "@/lib/schedule";
import type { FormState, ScheduleRow } from "@/lib/types";

/** 입금 등록 폼. 기본은 '자동 배분'(가장 오래된 미회수 회차부터 채움) */
export default function PaymentForm({
  action,
  schedules,
  today,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  schedules: ScheduleRow[];
  today: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const unpaid = schedules.filter((s) => s.unpaid_amount > 0);
  const first = unpaid[0];

  const [paidOn, setPaidOn] = useState(today);
  const [amount, setAmount] = useState(first ? comma(first.unpaid_amount) : "");
  const [mode, setMode] = useState<"auto" | "schedule">("auto");
  const [scheduleId, setScheduleId] = useState(first?.id ?? "");
  const [memo, setMemo] = useState("");
  const fe = state.fieldErrors ?? {};

  const amountNum = parseMoney(amount);
  const preview = mode === "auto" && amountNum > 0 ? allocatePayment(unpaid, amountNum) : [];
  const seqOf = (id: string | null) => schedules.find((s) => s.id === id)?.seq;

  return (
    <form action={formAction} className="space-y-3">
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="paid_on">입금일</label>
          <input id="paid_on" name="paid_on" type="date" className={`input ${fe.paid_on ? "input-error" : ""}`}
            value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          {fe.paid_on && <p className="field-error">{fe.paid_on}</p>}
        </div>
        <div>
          <label className="label" htmlFor="amount">입금액 (원)</label>
          <input id="amount" name="amount" inputMode="numeric" className={`input text-right tabular-nums ${fe.amount ? "input-error" : ""}`}
            value={amount} onChange={(e) => setAmount(comma(e.target.value))} placeholder="0" />
        </div>
      </div>
      {fe.amount && <p className="field-error">{fe.amount}</p>}

      <input type="hidden" name="mode" value={mode} />
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        {(["auto", "schedule"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`rounded-md py-1.5 font-medium ${mode === m ? "bg-white text-navy-900 shadow-sm" : "text-slate-500"}`}>
            {m === "auto" ? "자동 배분" : "회차 지정"}
          </button>
        ))}
      </div>

      {mode === "schedule" ? (
        <div>
          <select name="schedule_id" className={`input ${fe.schedule_id ? "input-error" : ""}`}
            value={scheduleId} onChange={(e) => setScheduleId(e.target.value)}>
            {unpaid.map((s) => (
              <option key={s.id} value={s.id}>
                {s.seq}회차 · {ymd(s.due_date)} · 미회수 {won(s.unpaid_amount)}
              </option>
            ))}
          </select>
          {fe.schedule_id && <p className="field-error">{fe.schedule_id}</p>}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <p className="mb-1 font-medium">가장 오래된 미회수 회차부터 채워서 기록합니다.</p>
          {preview.length > 0 && (
            <ul className="space-y-0.5">
              {preview.slice(0, 5).map((a, i) => (
                <li key={i} className="flex justify-between tabular-nums">
                  <span>{a.scheduleId ? `${seqOf(a.scheduleId)}회차` : "회차 없음(초과 입금)"}</span>
                  <span>{won(a.amount)}</span>
                </li>
              ))}
              {preview.length > 5 && <li className="text-slate-400">… 외 {preview.length - 5}개 회차</li>}
            </ul>
          )}
        </div>
      )}

      <input name="memo" className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모 (예: 계좌이체, 현금)" />

      <SubmitButton className="btn w-full">입금 등록</SubmitButton>
    </form>
  );
}
