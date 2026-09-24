import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { todayKst } from "@/lib/format";

export default async function AdminHome() {
  const { supabase } = await requireAdmin();
  const today = todayKst();
  const [bookings, vehicles, pendingDrivers, runs] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("service_date", today),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("drivers").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("dispatch_runs").select("id,service_date,status,summary").order("created_at", { ascending: false }).limit(5),
  ]);

  const stats = [
    { label: "오늘 예약", value: bookings.count ?? 0, href: `/admin/dispatch?date=${today}` },
    { label: "운행 가능 차량", value: vehicles.count ?? 0, href: "/admin/vehicles" },
    { label: "승인 대기 기사", value: pendingDrivers.count ?? 0, href: "/admin/drivers" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="page-title">대시보드 <span className="text-base font-normal text-gray-500">{today}</span></h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card hover:border-blue-300">
            <div className="text-sm text-gray-500">{s.label}</div>
            <div className="mt-1 text-3xl font-bold">{s.value}</div>
          </Link>
        ))}
      </div>
      <div className="card">
        <h2 className="mb-3 font-semibold">작업 순서</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
          <li><Link className="text-blue-600" href="/admin/vehicles">차량</Link>을 등록하고 <Link className="text-blue-600" href="/admin/drivers">기사</Link>를 승인·차량 배정합니다.</li>
          <li>KKday에서 받은 일정표를 <Link className="text-blue-600" href="/admin/upload">업로드</Link>합니다.</li>
          <li><Link className="text-blue-600" href="/admin/dispatch">배차</Link>에서 날짜를 골라 자동 배차 → 확인·수정 → 확정합니다.</li>
          <li>월말에 <Link className="text-blue-600" href="/admin/settlement">정산·세무</Link>에서 원천징수·간이지급명세서 자료를 내려받습니다.</li>
        </ol>
      </div>
      <div className="card">
        <h2 className="mb-3 font-semibold">최근 배차</h2>
        {runs.data?.length ? (
          <table className="table">
            <thead><tr><th>날짜</th><th>상태</th><th>배차</th><th>불가</th></tr></thead>
            <tbody>
              {runs.data.map((r) => (
                <tr key={r.id}>
                  <td><Link className="text-blue-600" href={`/admin/dispatch?date=${r.service_date}&run=${r.id}`}>{r.service_date}</Link></td>
                  <td>{r.status === "confirmed" ? "확정" : "초안"}</td>
                  <td>{r.summary?.assigned ?? 0}</td>
                  <td>{r.summary?.unassigned ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-sm text-gray-500">아직 배차 기록이 없습니다.</p>}
      </div>
    </div>
  );
}
