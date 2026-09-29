"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { won, ymd } from "@/lib/format";
import { SCHEDULE_STATES } from "@/lib/scheduleState";
import type { FormState, ScheduleRow } from "@/lib/types";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

const FILTERS = [
  { value: "all", label: "전체" },
  { value: "unpaid", label: "미회수" },
  { value: "overdue", label: "연체" },
  { value: "paid", label: "완납" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

function matches(s: ScheduleRow, f: Filter) {
  if (f === "unpaid") return s.unpaid_amount > 0;
  if (f === "overdue") return s.is_overdue;
  if (f === "paid") return s.state === "paid";
  return true;
}

function StateBadge({ state }: { state: ScheduleRow["state"] }) {
  const s = SCHEDULE_STATES[state];
  return <span className={`badge ${s.className}`}>{s.label}</span>;
}

/** 한 회차 완납 버튼 */
function QuickPay({ action, schedule, today }: { action: Action; schedule: ScheduleRow; today: string }) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  if (schedule.unpaid_amount <= 0) return null;
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`${schedule.seq}회차 미회수금액 ${won(schedule.unpaid_amount)}을\n오늘(${ymd(today)}) 입금으로 기록할까요?`)) e.preventDefault();
      }}
      className="inline"
    >
      <input type="hidden" name="schedule_id" value={schedule.id} />
      <input type="hidden" name="paid_on" value={today} />
      <button type="submit" disabled={pending}
        className="rounded-md bg-navy-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50">
        {pending ? "..." : "완납"}
      </button>
      {state.error && <span className="ml-1 text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

export default function ScheduleTable({
  investmentId,
  schedules,
  today,
  quickPay,
}: {
  investmentId: string;
  schedules: ScheduleRow[];
  today: string;
  quickPay: Action;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const rows = schedules.filter((s) => matches(s, filter));
  const count = (f: Filter) => schedules.filter((s) => matches(s, f)).length;
  const editHref = (s: ScheduleRow) => `/investments/${investmentId}/schedules/${s.id}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              filter === f.value ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}>
            {f.label} {count(f.value)}
          </button>
        ))}
        <Link href={`/investments/${investmentId}/schedules/new`} className="ml-auto text-xs font-semibold text-navy-600 hover:underline">
          + 회차 추가
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">해당하는 회차가 없습니다.</p>
      ) : (
        <>
          {/* PC: 표 */}
          <div className="hidden max-h-[560px] overflow-auto md:block">
            <table className="table [&_td]:px-2.5 [&_th]:px-2.5">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th>회차</th>
                  <th>예정일</th>
                  <th className="num">예정금액</th>
                  <th>실제 회수일</th>
                  <th className="num">실제 회수금액</th>
                  <th className="num">미회수</th>
                  <th>상태</th>
                  <th>메모</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className={s.is_overdue ? "bg-red-50/60" : s.state === "due_today" ? "bg-blue-50/60" : ""}>
                    <td className="tabular-nums">{s.seq}</td>
                    <td>{ymd(s.due_date)}</td>
                    <td className="num">{won(s.planned_amount)}</td>
                    <td>{ymd(s.last_paid_on)}</td>
                    <td className="num">{s.paid_amount ? won(s.paid_amount) : "-"}</td>
                    <td className={`num font-semibold ${s.unpaid_amount > 0 ? "text-red-600" : "text-slate-400"}`}>
                      {won(s.unpaid_amount)}
                    </td>
                    <td><StateBadge state={s.state} /></td>
                    <td className="max-w-40 truncate text-xs text-slate-500" title={s.memo}>{s.memo}</td>
                    <td className="space-x-2 text-right">
                      <QuickPay action={quickPay} schedule={s} today={today} />
                      <Link href={editHref(s)} className="text-xs text-navy-600 hover:underline">수정</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 휴대폰: 카드 */}
          <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-auto md:hidden">
            {rows.map((s) => (
              <li key={s.id} className={`px-4 py-3 ${s.is_overdue ? "bg-red-50/60" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-navy-900">
                    {s.seq}회차 · {ymd(s.due_date)}
                  </div>
                  <StateBadge state={s.state} />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-xs">
                  <div><div className="text-slate-500">예정</div><div className="tabular-nums">{won(s.planned_amount)}</div></div>
                  <div><div className="text-slate-500">입금</div><div className="tabular-nums">{won(s.paid_amount)}</div></div>
                  <div><div className="text-slate-500">미회수</div><div className={`font-semibold tabular-nums ${s.unpaid_amount > 0 ? "text-red-600" : ""}`}>{won(s.unpaid_amount)}</div></div>
                </div>
                {(s.memo || s.last_paid_on) && (
                  <div className="mt-1 text-xs text-slate-500">
                    {s.last_paid_on && <>입금일 {ymd(s.last_paid_on)} </>}{s.memo && <>· {s.memo}</>}
                  </div>
                )}
                <div className="mt-2 flex items-center justify-end gap-3">
                  <Link href={editHref(s)} className="text-xs text-navy-600 underline">수정·메모</Link>
                  <QuickPay action={quickPay} schedule={s} today={today} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
