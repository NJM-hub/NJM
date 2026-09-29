"use client";

import { useTransition } from "react";
import { changeInvestmentStatus } from "@/app/investments/actions";
import type { InvestmentStatus } from "@/lib/constants";

/** 삭제 대신 상태를 바꾸는 버튼들 */
export default function StatusActions({ id, status }: { id: string; status: InvestmentStatus }) {
  const [pending, start] = useTransition();

  function change(next: InvestmentStatus, question: string) {
    if (!confirm(question)) return;
    start(async () => {
      try {
        await changeInvestmentStatus(id, next);
      } catch (e) {
        alert(`상태를 바꾸지 못했습니다: ${(e as Error).message}`);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "active" && (
        <>
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() => change("completed", "이 투자를 '완료' 상태로 바꿀까요?")}
          >
            완료 처리
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={pending}
            onClick={() =>
              change("cancelled", "이 투자를 '취소' 처리할까요?\n데이터는 삭제되지 않고 목록에서만 숨겨지며, 언제든 되돌릴 수 있습니다.")
            }
          >
            취소 처리
          </button>
        </>
      )}
      {status !== "active" && (
        <button
          type="button"
          className="btn-secondary"
          disabled={pending}
          onClick={() => change("active", "이 투자를 다시 '진행중' 상태로 되돌릴까요?")}
        >
          진행중으로 되돌리기
        </button>
      )}
    </div>
  );
}
