import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { UNASSIGNED_REASON_LABEL, type UnassignedReason } from "@/lib/dispatch/algorithm";
import { fmtTime, isDate, todayKst, tripLabel } from "@/lib/format";
import { SubmitButton } from "@/components/SubmitButton";
import { confirmRun, moveAssignment, runDispatch, unconfirmRun } from "./actions";
import { CopyBox } from "./CopyBox";

type Booking = {
  id: string;
  booking_no: string | null;
  product_name: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  pax: number;
  pickup_at: string | null;
  duration_min: number | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  flight_no: string | null;
  memo: string | null;
  pickup_lat: number | null;
  pickup_place: string | null;
  dropoff_place: string | null;
  vehicle_class: string | null;
  wait_min: number | null;
  trip_type: string | null;
  dropoff_lat: number | null;
  pickup_geo: string | null;
  dropoff_geo: string | null;
};

type Assignment = {
  id: string;
  booking_id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  seq: number | null;
  ready_at: string | null;
  deadhead_km: number | null;
  deadhead_min: number | null;
  unassigned_reason: string | null;
  bookings: Booking;
};

const reasonLabel = (r: string | null) =>
  r === "MANUAL" ? "수동으로 배차 해제" : UNASSIGNED_REASON_LABEL[r as UnassignedReason] ?? r ?? "-";

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; run?: string; conflict?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const date = isDate(sp.date) ? sp.date : todayKst();
  const { supabase } = await requireAdmin();

  const [{ count: bookingCount }, { count: noCoordCount }, { data: vehicles }, { data: drivers }, { data: runs }] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("service_date", date),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("service_date", date).or("pickup_lat.is.null,dropoff_lat.is.null"),
    supabase.from("vehicles").select("id,plate_number,model,seats,grade,active").eq("active", true).order("plate_number"),
    supabase.from("drivers").select("id,name,phone,vehicle_id").eq("status", "approved"),
    supabase.from("dispatch_runs").select("id,status,summary,created_at,options").eq("service_date", date).order("created_at", { ascending: false }),
  ]);

  const run = runs?.find((r) => r.id === sp.run) ?? runs?.find((r) => r.status === "confirmed") ?? runs?.[0];
  const { data: assignmentsRaw } = run
    ? await supabase
        .from("dispatch_assignments")
        .select("id,booking_id,vehicle_id,driver_id,seq,ready_at,deadhead_km,deadhead_min,unassigned_reason,bookings(id,booking_no,product_name,customer_name,customer_phone,pax,pickup_at,duration_min,pickup_address,dropoff_address,flight_no,memo,pickup_lat,pickup_place,dropoff_place,vehicle_class,wait_min,trip_type,dropoff_lat,pickup_geo,dropoff_geo)")
        .eq("run_id", run.id)
    : { data: [] };
  const assignments = (assignmentsRaw ?? []) as unknown as Assignment[];
  const byPickup = (a: Assignment, b: Assignment) =>
    (a.bookings.pickup_at ?? "").localeCompare(b.bookings.pickup_at ?? "");

  const vehicleName = new Map((vehicles ?? []).map((v) => [v.id, `${v.plate_number} (${v.grade ?? "이코노미"} ${v.seats}인승${v.model ? ` ${v.model}` : ""})`]));
  const place = (addr: string | null, name: string | null) => name ?? addr ?? "?";
  const tag = (b: Booking) => (tripLabel(b.trip_type) ? `[${tripLabel(b.trip_type)!.label}] ` : "");
  const driverOfVehicle = new Map((drivers ?? []).map((d) => [d.vehicle_id, d]));
  const usedVehicleIds: string[] = run?.options?.vehicleIds ?? (vehicles ?? []).map((v) => v.id);
  const routes = usedVehicleIds.map((vid) => ({
    vehicleId: vid,
    items: assignments.filter((a) => a.vehicle_id === vid).sort(byPickup),
  }));
  const unassigned = assignments.filter((a) => !a.vehicle_id).sort(byPickup);
  const maxCalls: number = run?.options?.maxCallsPerVehicle ?? 4;
  const summary = run?.summary ?? {};
  const editable = run?.status === "draft";

  const reasonGroups = new Map<string, Assignment[]>();
  for (const u of unassigned) {
    const k = reasonLabel(u.unassigned_reason);
    reasonGroups.set(k, [...(reasonGroups.get(k) ?? []), u]);
  }

  const unassignedText = [
    `[${date} 배차 불가 ${unassigned.length}건]`,
    ...[...reasonGroups].flatMap(([reason, list]) => [
      `■ ${reason} (${list.length}건)`,
      ...list.map((u) => `- ${fmtTime(u.bookings.pickup_at)} ${tag(u.bookings)}${u.bookings.booking_no ?? ""} ${u.bookings.customer_name ?? ""} ${u.bookings.pax}명 ${u.bookings.vehicle_class ?? ""} / ${place(u.bookings.pickup_address, u.bookings.pickup_place)} → ${place(u.bookings.dropoff_address, u.bookings.dropoff_place)}`),
    ]),
    summary.extraVehiclesNeeded ? `※ 모두 소화하려면 차량 약 ${summary.extraVehiclesNeeded}대 추가 필요` : "",
  ].filter(Boolean).join("\n");

  const routeText = routes
    .filter((r) => r.items.length)
    .map((r) => {
      const d = driverOfVehicle.get(r.vehicleId);
      return [
        `[${vehicleName.get(r.vehicleId) ?? "차량"}] ${d ? `${d.name} ${d.phone}` : "기사 미지정"}`,
        ...r.items.map((a, i) => `${i + 1}. ${fmtTime(a.bookings.pickup_at)} ${tag(a.bookings)}${a.bookings.vehicle_class ?? a.bookings.product_name ?? ""} ${a.bookings.booking_no ?? ""} ${a.bookings.customer_name ?? ""}(${a.bookings.pax}명) ${a.bookings.customer_phone ?? ""}\n   ${place(a.bookings.pickup_address, a.bookings.pickup_place)} → ${place(a.bookings.dropoff_address, a.bookings.dropoff_place)}${a.bookings.flight_no ? ` ✈${a.bookings.flight_no}` : ""}${a.bookings.memo ? `\n   메모: ${a.bookings.memo}` : ""}`),
      ].join("\n");
    })
    .join("\n\n");

  const conflict = sp.conflict ? assignments.find((a) => a.id === sp.conflict) : null;

  return (
    <div className="space-y-6">
      <h1 className="page-title">배차</h1>

      <div className="card space-y-4">
        <form className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="date">이용일</label>
            <input id="date" name="date" type="date" defaultValue={date} className="input" />
          </div>
          <button className="btn-secondary">조회</button>
          <div className="text-sm text-gray-600">
            예약 <b>{bookingCount ?? 0}</b>건
            {!!noCoordCount && <span className="ml-2 text-amber-700">(위치 미확인 {noCoordCount}건 — 자동 배차 시 주소로 위치를 찾습니다)</span>}
          </div>
        </form>

        <form action={runDispatch} className="space-y-3 border-t border-gray-100 pt-4">
          <input type="hidden" name="date" value={date} />
          <div className="text-sm font-medium text-gray-700">사용할 차량 ({vehicles?.length ?? 0}대 중 선택)</div>
          <div className="flex flex-wrap gap-2">
            {vehicles?.map((v) => (
              <label key={v.id} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm">
                <input type="checkbox" name="vehicle" value={v.id} defaultChecked={usedVehicleIds.includes(v.id)} />
                {v.plate_number} <span className="text-gray-400">{v.grade ?? "이코노미"} {v.seats}인승</span>
                {!driverOfVehicle.get(v.id) && <span className="text-xs text-amber-600">기사없음</span>}
              </label>
            ))}
            {!vehicles?.length && <Link href="/admin/vehicles" className="text-sm text-blue-600">차량을 먼저 등록하세요 →</Link>}
          </div>
          <SubmitButton pendingText="배차 계산 중...">{run ? "다시 자동 배차" : "자동 배차 실행"}</SubmitButton>
          {run?.status === "confirmed" && <span className="ml-3 text-xs text-gray-500">다시 배차하면 새 초안이 만들어지고, 확정본은 새 초안을 확정할 때까지 유지됩니다.</span>}
        </form>
      </div>

      {conflict && sp.to && (
        <div className="card border-amber-300 bg-amber-50">
          <p className="text-sm text-amber-900">
            <b>{fmtTime(conflict.bookings.pickup_at)} {conflict.bookings.customer_name}</b> 예약을 <b>{vehicleName.get(sp.to)}</b>에 넣으면
            시간/동선상 이동이 불가능하거나 인원이 초과됩니다. 그래도 적용할까요?
          </p>
          <form action={moveAssignment} className="mt-3 flex gap-2">
            <input type="hidden" name="assignmentId" value={conflict.id} />
            <input type="hidden" name="vehicleId" value={sp.to} />
            <input type="hidden" name="force" value="1" />
            <SubmitButton className="btn-danger">강제 적용</SubmitButton>
            <Link href={`/admin/dispatch?date=${date}&run=${run?.id}`} className="btn-secondary">취소</Link>
          </form>
        </div>
      )}

      {run && (
        <>
          <div className="card flex flex-wrap items-center gap-6">
            <div>
              <span className={`badge ${run.status === "confirmed" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
                {run.status === "confirmed" ? "확정" : "초안"}
              </span>
            </div>
            <Stat label="전체" value={summary.totalBookings ?? assignments.length} />
            <Stat label="배차 완료" value={summary.assigned ?? 0} />
            <Stat label="배차 불가" value={summary.unassigned ?? 0} danger={(summary.unassigned ?? 0) > 0} />
            <Stat label="사용 차량" value={summary.vehiclesUsed ?? 0} />
            <Stat label="공차 이동(추정)" value={`${summary.totalDeadheadKm ?? 0}km`} />
            <div className="ml-auto flex gap-2">
              <a className="btn-secondary" href={`/admin/dispatch/export?run=${run.id}`}>엑셀(CSV) 다운로드</a>
              {editable ? (
                <form action={confirmRun}>
                  <input type="hidden" name="runId" value={run.id} />
                  <SubmitButton>배차 확정</SubmitButton>
                </form>
              ) : (
                <form action={unconfirmRun}>
                  <input type="hidden" name="runId" value={run.id} />
                  <SubmitButton className="btn-secondary">확정 해제</SubmitButton>
                </form>
              )}
            </div>
          </div>

          {unassigned.length > 0 && (
            <div className="card border-red-200">
              <h2 className="mb-2 font-semibold text-red-700">배차 불가 요약 ({unassigned.length}건)</h2>
              <ul className="mb-3 space-y-1 text-sm">
                {[...reasonGroups].map(([reason, list]) => (
                  <li key={reason}><b>{reason}</b>: {list.length}건</li>
                ))}
                {!!summary.extraVehiclesNeeded && (
                  <li className="text-red-700">→ 모두 소화하려면 차량 약 <b>{summary.extraVehiclesNeeded}대</b>가 더 필요합니다.</li>
                )}
              </ul>
              <AssignmentTable items={unassigned} vehicles={vehicles ?? []} editable={editable} showReason />
              <CopyBox title="배차 불가 요약 복사 (카톡 전달용)" text={unassignedText} />
            </div>
          )}

          <div className="space-y-4">
            {routes.map((r) => {
              const d = driverOfVehicle.get(r.vehicleId);
              return (
                <div key={r.vehicleId} className="card">
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="font-semibold">{vehicleName.get(r.vehicleId) ?? "(삭제된 차량)"}</h3>
                    <span className={`badge ${r.items.length >= maxCalls ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"}`}>
                      {r.items.length}/{maxCalls}콜
                    </span>
                    {r.items.length > maxCalls && <span className="badge bg-red-100 text-red-700">콜 수 초과</span>}
                    <span className="ml-auto text-sm text-gray-500">{d ? `${d.name} · ${d.phone}` : "기사 미지정"}</span>
                  </div>
                  {r.items.length ? (
                    <AssignmentTable items={r.items} vehicles={vehicles ?? []} editable={editable} />
                  ) : (
                    <p className="text-sm text-gray-400">배차 없음</p>
                  )}
                </div>
              );
            })}
          </div>

          {routeText && <CopyBox title="기사별 배차표 복사 (카톡 전달용)" text={routeText} />}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: React.ReactNode; danger?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${danger ? "text-red-600" : ""}`}>{value}</div>
    </div>
  );
}

function AssignmentTable({
  items,
  vehicles,
  editable,
  showReason,
}: {
  items: Assignment[];
  vehicles: { id: string; plate_number: string; seats: number }[];
  editable: boolean;
  showReason?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>픽업</th>
            <th>예약</th>
            <th>동선</th>
            <th>{showReason ? "사유" : "공차이동"}</th>
            {editable && <th>차량 변경</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((a) => {
            const b = a.bookings;
            const trip = tripLabel(b.trip_type);
            const geoNote = (lat: number | null, geo: string | null, addr: string | null) =>
              lat == null && addr ? <span className="ml-1 text-amber-600">(위치 못 찾음)</span>
              : geo === "area" ? <span className="ml-1 text-gray-400">(대략 위치)</span> : null;
            const idle =
              a.ready_at && b.pickup_at ? Math.round((new Date(b.pickup_at).getTime() - new Date(a.ready_at).getTime()) / 60000) : null;
            return (
              <tr key={a.id}>
                <td className="whitespace-nowrap">
                  <div className="font-semibold">{fmtTime(b.pickup_at)}</div>
                  <div className="text-xs text-gray-500">{b.wait_min ? `대기 ~${b.wait_min}분` : b.duration_min ? `${b.duration_min}분` : ""}</div>
                </td>
                <td>
                  <div className="font-medium">
                    {trip && <span className={`badge mr-1 ${trip.className}`}>{trip.label}</span>}
                    {b.customer_name ?? b.booking_no} <span className="text-gray-500">{b.pax}명</span>
                  </div>
                  <div className="text-xs text-gray-500">{b.customer_name ? b.booking_no : ""} {b.vehicle_class ?? b.product_name}</div>
                  {b.flight_no && <div className="text-xs text-gray-500">✈ {b.flight_no}</div>}
                </td>
                <td className="text-xs">
                  <div title={b.pickup_address ?? ""}>{b.pickup_place ?? b.pickup_address ?? "-"}{geoNote(b.pickup_lat, b.pickup_geo, b.pickup_address)}</div>
                  <div className="text-gray-500" title={b.dropoff_address ?? ""}>→ {b.dropoff_place ?? b.dropoff_address ?? "-"}{geoNote(b.dropoff_lat, b.dropoff_geo, b.dropoff_address)}</div>
                </td>
                <td className="text-xs whitespace-nowrap">
                  {showReason ? (
                    <span className="text-red-600">{reasonLabel(a.unassigned_reason)}</span>
                  ) : (
                    <>
                      <div>
                        {a.seq === 1 && a.deadhead_km == null
                          ? "첫 콜"
                          : `${a.deadhead_km != null ? `${a.deadhead_km.toFixed(1)}km` : "거리 미상"} · ${Math.round(a.deadhead_min ?? 0)}분`}
                      </div>
                      {idle != null && a.seq !== 1 && <div className="text-gray-500">여유 {idle}분</div>}
                    </>
                  )}
                </td>
                {editable && (
                  <td>
                    <form action={moveAssignment} className="flex gap-1">
                      <input type="hidden" name="assignmentId" value={a.id} />
                      <select name="vehicleId" defaultValue={a.vehicle_id ?? ""} className="input !w-32 !py-1 text-xs">
                        <option value="">배차 해제</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>{v.plate_number}</option>
                        ))}
                      </select>
                      <SubmitButton className="btn-secondary !px-2 !py-1 text-xs" pendingText="...">이동</SubmitButton>
                    </form>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// 배차 계산 + 주소 좌표 변환에 시간이 걸릴 수 있다 (Vercel 함수 최대 실행 시간)
export const maxDuration = 60;
