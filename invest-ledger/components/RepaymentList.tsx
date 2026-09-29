"use client";

import { useActionState, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { won, ymd } from "@/lib/format";
import type { FormState, Repayment } from "@/lib/types";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

function VoidForm({ action, repayment, onClose }: { action: Action; repayment: Repayment; onClose: () => void }) {
  const [state, formAction] = useActionState(action, {} as FormState);
  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2 rounded-lg bg-red-50 p-3 sm:flex-row sm:items-center">
      <input type="hidden" name="repayment_id" value={repayment.id} />
      <input name="void_reason" className="input flex-1" placeholder="취소 사유 (예: 금액 잘못 입력)" autoFocus />
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="btn-secondary">닫기</button>
        <SubmitButton className="btn-danger" pendingText="처리 중...">입금 취소</SubmitButton>
      </div>
      {state.error && <p className="field-error">{state.error}</p>}
    </form>
  );
}

export default function RepaymentList({
  repayments,
  seqById,
  voidAction,
}: {
  repayments: Repayment[];
  seqById: Record<string, number>;
  voidAction?: Action;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showVoid, setShowVoid] = useState(false);
  const rows = repayments.filter((r) => showVoid || r.status === "valid");
  const voidCount = repayments.length - repayments.filter((r) => r.status === "valid").length;

  return (
    <div>
      {voidCount > 0 && (
        <div className="border-b border-slate-100 px-4 py-2 text-right sm:px-5">
          <button type="button" onClick={() => setShowVoid((v) => !v)} className="text-xs text-slate-500 underline">
            {showVoid ? "취소된 입금 숨기기" : `취소된 입금 ${voidCount}건 보기`}
          </button>
        </div>
      )}
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">아직 입금 기록이 없습니다.</p>
      ) : (
        <ul className="max-h-[420px] divide-y divide-slate-100 overflow-auto">
          {rows.map((r) => (
            <li key={r.id} className={`px-4 py-3 sm:px-5 ${r.status === "void" ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900">
                    {ymd(r.paid_on)}
                    <span className="ml-2 text-xs text-slate-500">
                      {r.schedule_id ? `${seqById[r.schedule_id] ?? "?"}회차` : "회차 없음"}
                    </span>
                    {r.status === "void" && <span className="badge ml-2 bg-gray-100 text-gray-500 ring-gray-200">취소됨</span>}
                  </div>
                  {(r.memo || r.void_reason) && (
                    <div className="truncate text-xs text-slate-500">
                      {r.memo}{r.void_reason && ` (취소 사유: ${r.void_reason})`}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`text-sm font-semibold tabular-nums ${r.status === "void" ? "line-through" : ""}`}>{won(r.amount)}</span>
                  {voidAction && r.status === "valid" && openId !== r.id && (
                    <button type="button" onClick={() => setOpenId(r.id)} className="text-xs text-red-600 hover:underline">취소</button>
                  )}
                </div>
              </div>
              {voidAction && openId === r.id && <VoidForm action={voidAction} repayment={r} onClose={() => setOpenId(null)} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
