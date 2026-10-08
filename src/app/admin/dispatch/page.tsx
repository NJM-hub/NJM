import Link from "next/link";
import { splitContact } from "@/lib/contact";
import { requireAdmin } from "@/lib/auth";
import { reasonLabel } from "@/lib/dispatch/reasons";
import { OWN_CALL_SOURCE } from "@/lib/kkday/sheet";
import { ko } from "@/lib/ko";
import { fmtTime, isDate, todayKst, tripLabel, won } from "@/lib/format";
import { SubmitButton } from "@/components/SubmitButton";
import { confirmRun, moveAssignment, moveSelected, runDispatch, setExternalFare, unconfirmRun } from "./actions";
import { CopyBox } from "./CopyBox";
import { deleteBooking } from "../schedule/actions";
import { DeleteDateButton } from "../schedule/DeleteControls";

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
  source: string | null;
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
  fare: number;
  bookings: Booking;
};

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; run?: string; conflict?: string; to?: string; msg?: string }>;
}) {
  const sp = await searchParams;
  const date = isDate(sp.date) ? sp.date : todayKst();
  const { supabase } = await requireAdmin();

  const [{ count: bookingCount }, { count: noCoordCount }, { data: vehiclesRaw }, { data: driversRaw }, { data: runs }] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("service_date", date),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("service_date", date).or("pickup_lat.is.null,dropoff_lat.is.null"),
    supabase.from("vehicles").select("id,plate_number,model,seats,grade,active,driver_name").eq("active", true).order("plate_number"),
    supabase.from("drivers").select("id,name,phone,vehicle_id").eq("status", "approved"),
    supabase.from("dispatch_runs").select("id,status,summary,created_at,options").eq("service_date", date).order("created_at", { ascending: false }),
  ]);

  // 중국어 기사 이름 등은 한국어로 표시
  const vehicles = vehiclesRaw?.map((v) => ({ ...v, driver_name: ko(v.driver_name) }));
  const drivers = driversRaw?.map((d) => ({ ...d, name: ko(d.name) }));
  const run = runs?.find((r) => r.id === sp.run) ?? runs?.find((r) => r.status === "confirmed") ?? runs?.[0];
  const { data: assignmentsRaw } = run
    ? await supabase
        .from("dispatch_assignments")
        .select("id,booking_id,vehicle_id,driver_id,seq,ready_at,deadhead_km,deadhead_min,unassigned_reason,fare,bookings(id,booking_no,product_name,customer_name,customer_phone,pax,pickup_at,duration_min,pickup_address,dropoff_address,flight_no,memo,pickup_lat,pickup_place,dropoff_place,vehicle_class,wait_min,trip_type,dropoff_lat,pickup_geo,dropoff_geo,source)")
        .eq("run_id", run.id)
    : { data: [] };
  const assignments = (assignmentsRaw ?? []) as unknown as Assignment[];
  const byPickup = (a: Assignment, b: Assignment) =>
    (a.bookings.pickup_at ?? "").localeCompare(b.bookings.pickup_at ?? "");

  const vehicleName = new Map((vehicles ?? []).map((v) => [v.id, `${v.plate_number} (${v.grade ?? "이코노미"} ${v.seats}인승${v.model ? ` ${v.model}` : ""})`]));
  const place = (addr: string | null, name: string | null) => name ?? addr ?? "?";
  const tag = (b: Booking) =>
    `${b.source === OWN_CALL_SOURCE ? "[자체] " : ""}${tripLabel(b.trip_type) ? `[${tripLabel(b.trip_type)!.label}] ` : ""}`;
  const driverOfVehicle = new Map((drivers ?? []).map((d) => [d.vehicle_id, d]));
  // 기사 계정이 연결되지 않은 차량은 차량에 적어둔 기사 이름을 보여준다
  const driverNameOfVehicle = new Map((vehicles ?? []).filter((v) => v.driver_name).map((v) => [v.id, v.driver_name as string]));
  const driverLabel = (vid: string) => {
    const d = driverOfVehicle.get(vid);
    return d ? `${d.name} · ${d.phone}` : driverNameOfVehicle.get(vid) ?? null;
  };
  const usedVehicleIds: string[] = run?.options?.vehicleIds ?? (vehicles ?? []).map((v) => v.id);
  const routes = usedVehicleIds.map((vid) => ({
    vehicleId: vid,
    // 기사 자체 콜은 외부 콜 메뉴에서 따로 정리하므로 차량 동선·콜 수에서 뺀다
    items: assignments.filter((a) => a.vehicle_id === vid && a.bookings.source !== OWN_CALL_SOURCE).sort(byPickup),
  }));
  const ownCalls = assignments.filter((a) => a.bookings.source === OWN_CALL_SOURCE).sort(byPickup);
  const external = assignments.filter((a) => !a.vehicle_id && a.unassigned_reason === "EXTERNAL").sort(byPickup);
  const unassigned = assignments.filter((a) => !a.vehicle_id && a.unassigned_reason !== "EXTERNAL").sort(byPickup);
  const maxCalls: number = run?.options?.maxCallsPerVehicle ?? 4;
  const summary = run?.summary ?? {};
  const editable = run?.status === "draft";
  // 예약 옮기기는 초안·확정 모두 가능 (확정본을 고치면 정산에 바로 반영)
  const movable = !!run;
  const countOf = new Map(routes.map((r) => [r.vehicleId, r.items.length]));
  // 차량 선택 목록: 번호 · 기사 · 현재 콜 수
  const vehicleOptions = (vehicles ?? []).map((v) => ({
    id: v.id,
    label: `${v.plate_number.slice(-4)} ${driverNameOfVehicle.get(v.id) ?? driverOfVehicle.get(v.id)?.name ?? ""} (${countOf.get(v.id) ?? 0}콜)`.replace(/\s+/g, " "),
  }));

  const reasonGroups = new Map<string, Assignment[]>();
  for (const u of unassigned) {
    const k = reasonLabel(u.unassigned_reason);
    reasonGroups.set(k, [...(reasonGroups.get(k) ?? []), u]);
  }

  const unassignedText = [
    `[${date} 배차 불가 ${unassigned.length}건]`,
    ...[...reasonGroups].flatMap(([reason, list]) => [
      `■ ${reason} (${list.length}건)`,
      ...list.map((u) => {
        const c = splitContact(u.bookings.customer_phone, u.bookings.memo);
        return `- ${fmtTime(u.bookings.pickup_at)} ${tag(u.bookings)}${u.bookings.booking_no ?? ""} ${u.bookings.customer_name ?? ""} ${u.bookings.pax}명 ${u.bookings.vehicle_class ?? ""} / ${place(u.bookings.pickup_address, u.bookings.pickup_place)} → ${place(u.bookings.dropoff_address, u.bookings.dropoff_place)}${c.contact ? `\n   연락처: ${c.contact}` : ""}`;
      }),
    ]),
    summary.extraVehiclesNeeded ? `※ 모두 소화하려면 차량 약 ${summary.extraVehiclesNeeded}대 추가 필요` : "",
  ].filter(Boolean).join("\n");

  const routeText = routes
    .filter((r) => r.items.length)
    .map((r) => {
      return [
        `[${vehicleName.get(r.vehicleId) ?? "차량"}] ${driverLabel(r.vehicleId)?.replace(" · ", " ") ?? "기사 미지정"}`,
        ...r.items.map((a, i) => {
          // 손님 연락처: 전화번호 + 메모에 적힌 메신저(WHATSAPP·WECHAT·KAKAO 등). 메모에서는 메신저를 뺀다
          const c = splitContact(a.bookings.customer_phone, a.bookings.memo);
          return `${i + 1}. ${fmtTime(a.bookings.pickup_at)} ${tag(a.bookings)}${a.bookings.vehicle_class ?? a.bookings.product_name ?? ""} ${a.bookings.booking_no ?? ""} ${a.bookings.customer_name ?? ""}(${a.bookings.pax}명)\n   ${place(a.bookings.pickup_address, a.bookings.pickup_place)} → ${place(a.bookings.dropoff_address, a.bookings.dropoff_place)}${a.bookings.flight_no ? ` ✈${a.bookings.flight_no}` : ""}${c.contact ? `\n   연락처: ${c.contact}` : ""}${c.memo ? `\n   메모: ${c.memo}` : ""}`;
        }),
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
        {!!bookingCount && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            이 날짜 일정 전체 삭제: <DeleteDateButton date={date} count={bookingCount} />
          </div>
        )}

        <form action={runDispatch} className="space-y-3 border-t border-gray-100 pt-4">
          <input type="hidden" name="date" value={date} />
          <div className="text-sm font-medium text-gray-700">사용할 차량 ({vehicles?.length ?? 0}대 중 선택)</div>
          <div className="flex flex-wrap gap-2">
            {vehicles?.map((v) => (
              <label key={v.id} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm">
                <input type="checkbox" name="vehicle" value={v.id} defaultChecked={usedVehicleIds.includes(v.id)} />
                {v.plate_number} <span className="text-gray-400">{v.grade ?? "이코노미"} {v.seats}인승</span>
                {!driverOfVehicle.get(v.id) && (v.driver_name
                  ? <span className="text-xs text-gray-500">{v.driver_name}</span>
                  : <span className="text-xs text-amber-600">기사없음</span>)}
              </label>
            ))}
            {!vehicles?.length && <Link href="/admin/vehicles" className="text-sm text-blue-600">차량을 먼저 등록하세요 →</Link>}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              차량당 최대 콜
              <input name="maxCalls" type="number" min={1} max={20} defaultValue={maxCalls} className="input !w-20 !py-1" />
            </label>
            <label className="flex items-center gap-2" title="끄면 실제 운영처럼 인원수만 보고 배정합니다 (스타리아 9인승이 컴포트·10인승 예약도 운행)">
              <input type="checkbox" name="strictClass" defaultChecked={run?.options?.strictClass === true} />
              차급(컴포트·인승) 엄격 적용
            </label>
            <label className="flex items-center gap-2" title="첫 콜이 08:00 전인 차량은 20:00 이후 콜을 받지 않음. 불가피하면 11~18시 사이 3시간 이상 비는 경우만 허용">
              <input type="checkbox" name="fatigue" defaultChecked={run?.options?.fatigue !== false} />
              기사 피로 고려 (새벽 시작이면 밤늦은 콜 제외)
            </label>
            <label className="flex items-center gap-2" title="전날 마지막 콜이 끝난 뒤 8시간 이상 쉬고 시작, 전날 콜이 많았던 기사는 덜·적었던 기사는 더 배정, 같은 날 한 차량에 몰리지 않게">
              <input type="checkbox" name="prevDay" defaultChecked={run?.options?.prevDay !== false} />
              전날 근무 반영·공평 배분
            </label>
            <label className="flex items-center gap-2" title="17~19시에는 이동·운행 시간을 1.5배로 보고 콜 사이 여유를 15분 더 둠">
              <input type="checkbox" name="rush" defaultChecked={run?.options?.rush !== false} />
              퇴근 정체(17~19시) 여유
            </label>
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

      {sp.msg && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{sp.msg}</p>}

      {run && (
        <>
          {/* 체크한 예약을 한 번에 옮기기 (각 표의 체크박스가 이 폼에 연결됨) */}
          <form id="bulk-move" action={moveSelected} className="card flex flex-wrap items-center gap-3 text-sm">
            <input type="hidden" name="runId" value={run.id} />
            <input type="hidden" name="date" value={date} />
            <b>예약 재배차</b>
            <span className="text-gray-500">아래 표에서 예약을 체크한 뒤</span>
            <select name="vehicleId" className="input !w-56 !py-1" defaultValue="">
              <option value="">배차 해제 (미배정으로)</option>
              <option value="__external">외부콜 (기본 55,000원)</option>
              {vehicleOptions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
            <SubmitButton className="btn !py-1" pendingText="옮기는 중...">선택한 예약 옮기기</SubmitButton>
            <span className="text-xs text-gray-500">
              한 건은 각 줄의 &quot;차량 변경&quot;으로도 옮길 수 있습니다.{run.status === "confirmed" ? " 확정된 배차를 옮기면 차량별 월정산에 바로 반영됩니다." : ""}
            </span>
          </form>

          <div className="card flex flex-wrap items-center gap-6">
            <div>
              <span className={`badge ${run.status === "confirmed" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
                {run.status === "confirmed" ? "확정" : "초안"}
              </span>
            </div>
            <Stat label="전체" value={summary.totalBookings ?? assignments.length} />
            <Stat label="배차 완료" value={summary.assigned ?? 0} />
            {external.length > 0 && <Stat label="외부 배차" value={external.length} />}
            {ownCalls.length > 0 && <Stat label="기사 자체 콜" value={ownCalls.length} />}
            <Stat label="배차 불가" value={unassigned.length} danger={unassigned.length > 0} />
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
              <AssignmentTable items={unassigned} editable={movable} vehicleOptions={vehicleOptions} showReason />
              <CopyBox title="배차 불가 요약 복사 (카톡 전달용)" text={unassignedText} />
            </div>
          )}

          {external.length > 0 && (
            <div className="card">
              <h2 className="mb-2 font-semibold">
                외부(타업체) 배차 ({external.length}건 · {won(external.reduce((s, a) => s + (a.fare ?? 0), 0))})
              </h2>
              <AssignmentTable items={external} editable={movable} vehicleOptions={vehicleOptions} showReason />
            </div>
          )}

          {ownCalls.length > 0 && (
            <p className="text-sm text-gray-500">
              기사 자체 콜 {ownCalls.length}건은 차량 동선에서 뺐습니다 ·{" "}
              <a className="text-violet-700 underline" href={`/admin/external-calls?month=${date.slice(0, 7)}`}>외부 콜 메뉴에서 보기</a>
            </p>
          )}

          <div className="space-y-4">
            {routes.map((r) => {
              const d = driverLabel(r.vehicleId);
              return (
                <div key={r.vehicleId} className="card">
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="font-semibold">{vehicleName.get(r.vehicleId) ?? "(삭제된 차량)"}</h3>
                    <span className={`badge ${r.items.length >= maxCalls ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"}`}>
                      {r.items.length}/{maxCalls}콜
                    </span>
                    {r.items.length > maxCalls && <span className="badge bg-red-100 text-red-700">콜 수 초과</span>}
                    <span className="ml-auto text-sm text-gray-500">{d ?? "기사 미지정"}</span>
                  </div>
                  {r.items.length ? (
                    <AssignmentTable items={r.items} editable={movable} vehicleOptions={vehicleOptions} />
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
  editable,
  vehicleOptions,
  showReason,
}: {
  items: Assignment[];
  editable: boolean;
  vehicleOptions: { id: string; label: string }[];
  showReason?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            {editable && <th className="w-8" />}
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
                {editable && (
                  <td><input type="checkbox" name="sel" value={a.id} form="bulk-move" aria-label="재배차할 예약 선택" /></td>
                )}
                <td className="whitespace-nowrap">
                  <div className="font-semibold">{fmtTime(b.pickup_at)}</div>
                  <div className="text-xs text-gray-500">{b.wait_min ? `대기 ~${b.wait_min}분` : b.duration_min ? `${b.duration_min}분` : ""}</div>
                </td>
                <td>
                  <div className="font-medium">
                    {b.source === OWN_CALL_SOURCE && <span className="badge mr-1 bg-violet-100 text-violet-800">자체 콜</span>}
                    {trip && <span className={`badge mr-1 ${trip.className}`}>{trip.label}</span>}
                    {b.source === OWN_CALL_SOURCE ? b.memo : <>{b.customer_name ?? b.booking_no} <span className="text-gray-500">{b.pax}명</span></>}
                  </div>
                  <div className="text-xs text-gray-500">{b.customer_name ? b.booking_no : ""} {b.vehicle_class ?? b.product_name}</div>
                  {b.flight_no && <div className="text-xs text-gray-500">✈ {b.flight_no}</div>}
                </td>
                <td className="text-xs">
                  <div title={b.pickup_address ?? ""}>{b.pickup_place ?? b.pickup_address ?? "-"}{geoNote(b.pickup_lat, b.pickup_geo, b.pickup_address)}</div>
                  <div className="text-gray-500" title={b.dropoff_address ?? ""}>→ {b.dropoff_place ?? b.dropoff_address ?? "-"}{geoNote(b.dropoff_lat, b.dropoff_geo, b.dropoff_address)}</div>
                </td>
                <td className="text-xs whitespace-nowrap">
                  {a.unassigned_reason === "EXTERNAL" ? (
                    editable ? (
                      <form action={setExternalFare} className="flex items-center gap-1">
                        <input type="hidden" name="assignmentId" value={a.id} />
                        <input name="fare" type="number" step="1000" min={0} defaultValue={a.fare} className="input !w-24 !py-1 text-right text-xs" aria-label="외부콜 금액" />
                        <SubmitButton className="btn-secondary !px-2 !py-1 text-xs" pendingText="...">금액 저장</SubmitButton>
                      </form>
                    ) : (
                      <span className="text-gray-700">{won(a.fare)}</span>
                    )
                  ) : showReason ? (
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
                      <select name="vehicleId" defaultValue={a.unassigned_reason === "EXTERNAL" ? "__external" : a.vehicle_id ?? ""} className="input !w-44 !py-1 text-xs">
                        <option value="">배차 해제</option>
                        <option value="__external">외부콜 (55,000원)</option>
                        {vehicleOptions.map((v) => (
                          <option key={v.id} value={v.id}>{v.label}</option>
                        ))}
                      </select>
                      <SubmitButton className="btn-secondary !px-2 !py-1 text-xs" pendingText="...">이동</SubmitButton>
                      <input type="hidden" name="bookingId" value={a.booking_id} />
                      <button formAction={deleteBooking} className="px-1 text-xs text-red-600 hover:underline" title="이 예약을 일정에서 삭제">예약삭제</button>
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
