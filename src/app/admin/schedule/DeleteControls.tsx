"use client";
import { useActionState } from "react";
import { DELETE_ALL_WORD } from "./constants";
import { deleteAllSchedules, deleteDate, deleteUpload, type DeleteResult } from "./actions";

function Msg({ state }: { state: DeleteResult }) {
  if (!state) return null;
  return <span className={`text-xs ${state.ok ? "text-green-700" : "text-red-600"}`}>{state.message}</span>;
}

/** 날짜 하나의 일정 삭제 버튼 */
export function DeleteDateButton({ date, count }: { date: string; count?: number }) {
  const [state, action, pending] = useActionState(deleteDate, null);
  if (state?.ok) return <Msg state={state} />;
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="date" value={date} />
      <label className="flex items-center gap-1 text-xs text-gray-500">
        <input type="checkbox" required /> 확인
      </label>
      <button className="btn-danger !px-2 !py-1 text-xs" disabled={pending}>
        {pending ? "삭제 중..." : `삭제${count != null ? ` (${count}건)` : ""}`}
      </button>
      <Msg state={state} />
    </form>
  );
}

/** 업로드 파일 하나로 들어온 예약 삭제 버튼 */
export function DeleteUploadButton({ uploadId }: { uploadId: string }) {
  const [state, action, pending] = useActionState(deleteUpload, null);
  if (state?.ok) return <Msg state={state} />;
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="uploadId" value={uploadId} />
      <label className="flex items-center gap-1 text-xs text-gray-500">
        <input type="checkbox" required /> 확인
      </label>
      <button className="btn-danger !px-2 !py-1 text-xs" disabled={pending}>{pending ? "삭제 중..." : "삭제"}</button>
      <Msg state={state} />
    </form>
  );
}

/** 모든 배차 일정 삭제 (확인 단어 입력 필요) */
export function DeleteAllSchedules({ total }: { total: number }) {
  const [state, action, pending] = useActionState(deleteAllSchedules, null);
  return (
    <form action={action} className="card space-y-3 border-red-200">
      <h2 className="font-semibold text-red-700">모든 배차 일정 삭제</h2>
      <p className="text-sm text-gray-600">
        업로드 기록, 예약 {total.toLocaleString("ko-KR")}건, 배차(초안·확정)를 모두 지웁니다. 차량·기사·설정과 월정산 비용 입력값은 남습니다.
        <b className="text-red-700"> 되돌릴 수 없습니다.</b>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input name="confirm" placeholder={`"${DELETE_ALL_WORD}" 입력`} className="input !w-44" autoComplete="off" />
        <button className="btn-danger" disabled={pending || total === 0}>{pending ? "삭제 중..." : "전체 삭제"}</button>
        <Msg state={state} />
      </div>
    </form>
  );
}
