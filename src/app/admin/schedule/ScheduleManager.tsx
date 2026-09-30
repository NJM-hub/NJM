import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DeleteAllSchedules, DeleteDateButton } from "./DeleteControls";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
const dayLabel = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return `${date} (${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
};

/** 날짜별 배차 일정 목록 + 날짜별/전체 삭제 */
export async function ScheduleManager({ supabase }: { supabase: SupabaseClient }) {
  const [{ data: bookings }, { data: runs }] = await Promise.all([
    supabase.from("bookings").select("service_date").limit(20000),
    supabase.from("dispatch_runs").select("service_date,status"),
  ]);
  const counts = new Map<string, number>();
  for (const b of bookings ?? []) if (b.service_date) counts.set(b.service_date, (counts.get(b.service_date) ?? 0) + 1);
  for (const r of runs ?? []) if (!counts.has(r.service_date)) counts.set(r.service_date, 0);
  const confirmed = new Set((runs ?? []).filter((r) => r.status === "confirmed").map((r) => r.service_date as string));
  const dates = [...counts.keys()].sort().reverse();
  const total = bookings?.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="mb-3 font-semibold">배차 일정 ({dates.length}일 · 예약 {total.toLocaleString("ko-KR")}건)</h2>
        {dates.length ? (
          <div className="max-h-96 overflow-y-auto">
            <table className="table">
              <thead><tr><th>이용일</th><th className="text-right">예약</th><th>배차</th><th>삭제</th></tr></thead>
              <tbody>
                {dates.map((d) => (
                  <tr key={d}>
                    <td><Link className="text-blue-600" href={`/admin/dispatch?date=${d}`}>{dayLabel(d)}</Link></td>
                    <td className="text-right">{counts.get(d)}</td>
                    <td>{confirmed.has(d) ? <span className="badge bg-green-100 text-green-800">확정</span> : <span className="text-xs text-gray-500">미확정</span>}</td>
                    <td><DeleteDateButton date={d} count={counts.get(d)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">등록된 배차 일정이 없습니다.</p>
        )}
      </div>
      <DeleteAllSchedules total={total} />
    </div>
  );
}
