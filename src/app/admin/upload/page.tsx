import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { UploadClient } from "./UploadClient";

export default async function UploadPage() {
  const { supabase } = await requireAdmin();
  const { data: uploads } = await supabase
    .from("schedule_uploads")
    .select("id,filename,service_date,row_count,created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6">
      <h1 className="page-title">일정표 업로드</h1>
      <UploadClient />
      <div className="card">
        <h2 className="mb-3 font-semibold">최근 업로드</h2>
        <table className="table">
          <thead><tr><th>파일</th><th>이용일(첫날)</th><th>건수</th><th>업로드 시각</th></tr></thead>
          <tbody>
            {uploads?.map((u) => (
              <tr key={u.id}>
                <td>{u.filename}</td>
                <td>{u.service_date ? <Link className="text-blue-600" href={`/admin/dispatch?date=${u.service_date}`}>{u.service_date}</Link> : "-"}</td>
                <td>{u.row_count}</td>
                <td>{fmtDateTime(u.created_at)}</td>
              </tr>
            ))}
            {!uploads?.length && <tr><td colSpan={4} className="text-gray-500">업로드 기록이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
