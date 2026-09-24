import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { fmtTime, isMonth, monthRange, todayKst, won } from "@/lib/format";
import { computeWithholding } from "@/lib/tax";

type Row = {
  id: string;
  seq: number | null;
  fare: number;
  vehicles: { plate_number: string } | null;
  dispatch_runs: { service_date: string };
  bookings: {
    pickup_at: string | null; product_name: string | null; customer_name: string | null; customer_phone: string | null;
    pax: number; pickup_address: string | null; dropoff_address: string | null; flight_no: string | null; memo: string | null;
    booking_no: string | null; pickup_place: string | null; dropoff_place: string | null; wait_min: number | null;
  };
};

export default async function DriverHome({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { supabase, user } = await requireUser();
  const { data: me } = await supabase.from("drivers").select("name,status").eq("id", user.id).maybeSingle();
  if (!me) redirect("/driver/profile");

  const today = todayKst();
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : today.slice(0, 7);
  const { from, to } = monthRange(month);

  // RLS 가 확정된 본인 배차만 돌려준다
  const { data } = await supabase
    .from("dispatch_assignments")
    .select("id,seq,fare,vehicles(plate_number),dispatch_runs!inner(service_date),bookings(pickup_at,product_name,customer_name,customer_phone,pax,pickup_address,dropoff_address,flight_no,memo,booking_no,pickup_place,dropoff_place,wait_min)")
    .eq("driver_id", user.id)
    .gte("dispatch_runs.service_date", from < today ? from : today)
    .not("vehicle_id", "is", null);
  const rows = ((data ?? []) as unknown as Row[]).sort((a, b) => (a.bookings.pickup_at ?? "").localeCompare(b.bookings.pickup_at ?? ""));

  const upcoming = rows.filter((r) => r.dispatch_runs.service_date >= today);
  const monthRows = rows.filter((r) => r.dispatch_runs.service_date >= from && r.dispatch_runs.service_date <= to);
  const tax = computeWithholding(monthRows.reduce((s, r) => s + r.fare, 0));

  const byDate = new Map<string, Row[]>();
  for (const r of upcoming) byDate.set(r.dispatch_runs.service_date, [...(byDate.get(r.dispatch_runs.service_date) ?? []), r]);

  return (
    <div className="space-y-6">
      <h1 className="page-title">{me.name}님의 배차</h1>
      {me.status !== "approved" && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {me.status === "pending" ? "관리자 승인 대기 중입니다. 승인되면 배차가 표시됩니다." : "현재 비활성 상태입니다. 관리자에게 문의하세요."}
        </p>
      )}

      {[...byDate].map(([date, list]) => (
        <div key={date} className="card">
          <h2 className="mb-3 font-semibold">{date} {date === today && <span className="badge bg-blue-100 text-blue-800">오늘</span>} <span className="text-sm font-normal text-gray-500">{list[0].vehicles?.plate_number}</span></h2>
          <ol className="space-y-3">
            {list.map((r, i) => (
              <li key={r.id} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold">{fmtTime(r.bookings.pickup_at)}</span>
                  <span className="text-sm text-gray-500">{i + 1}콜 · {r.bookings.product_name}</span>
                </div>
                <div className="mt-1 text-sm">
                  {r.bookings.customer_name ?? r.bookings.booking_no} ({r.bookings.pax}명)
                  {r.bookings.customer_phone && <a className="ml-2 text-blue-600" href={`tel:${r.bookings.customer_phone}`}>{r.bookings.customer_phone}</a>}
                </div>
                <div className="mt-1 text-sm text-gray-700">
                  {r.bookings.pickup_place ?? r.bookings.pickup_address} → {r.bookings.dropoff_place ?? r.bookings.dropoff_address}
                </div>
                {(r.bookings.pickup_place || r.bookings.dropoff_place) && (
                  <div className="text-xs text-gray-500">{r.bookings.pickup_place ? r.bookings.pickup_address : r.bookings.dropoff_address}</div>
                )}
                {r.bookings.flight_no && <div className="text-sm text-gray-500">✈ {r.bookings.flight_no}</div>}
                {r.bookings.memo && <div className="text-sm text-gray-500">메모: {r.bookings.memo}</div>}
              </li>
            ))}
          </ol>
        </div>
      ))}
      {!upcoming.length && <p className="card text-sm text-gray-500">예정된 확정 배차가 없습니다.</p>}

      <div className="card">
        <form className="mb-3 flex items-center gap-2">
          <h2 className="font-semibold">월 정산</h2>
          <input type="month" name="month" defaultValue={month} className="input !w-40" />
          <button className="btn-secondary">조회</button>
        </form>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          <div><dt className="text-gray-500">운행</dt><dd className="font-bold">{monthRows.length}콜</dd></div>
          <div><dt className="text-gray-500">지급액</dt><dd className="font-bold">{won(tax.gross)}</dd></div>
          <div><dt className="text-gray-500">소득세(3%)</dt><dd>{won(tax.incomeTax)}</dd></div>
          <div><dt className="text-gray-500">지방소득세</dt><dd>{won(tax.localTax)}</dd></div>
          <div><dt className="text-gray-500">실수령액</dt><dd className="font-bold text-blue-700">{won(tax.net)}</dd></div>
        </dl>
        <p className="mt-2 text-xs text-gray-500">확정된 배차 기준 예상 금액이며, 실제 지급액은 관리자 정산에 따릅니다. <Link href="/driver/profile" className="text-blue-600">계좌 정보 확인</Link></p>
      </div>
    </div>
  );
}
