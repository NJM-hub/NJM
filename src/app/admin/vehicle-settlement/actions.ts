"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/auth";
import { isMonth, monthRange } from "@/lib/format";
import { dropEmptyRuns } from "@/lib/scheduleCleanup";
import { EXPENSE_LABELS, inOutLabel } from "@/lib/settlement/vehicleMonthly";
import { loadVehicleMonth, MANUAL_PREFIX } from "@/lib/settlement/vehicleMonthlyLoad";

type Db = Awaited<ReturnType<typeof assertAdmin>>["supabase"];

const won = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(/[,\s원]/g, "") || 0);
  if (!Number.isFinite(n) || Math.abs(n) > 1_000_000_000) throw new Error("금액이 올바르지 않습니다.");
  return Math.round(n);
};
const text = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

function target(formData: FormData) {
  const month = String(formData.get("month"));
  const vehicleId = String(formData.get("vehicleId"));
  if (!isMonth(month) || !vehicleId) throw new Error("정산 월/차량이 올바르지 않습니다.");
  return { month, vehicleId };
}

/** 확정된 정산은 수정할 수 없다 */
async function assertUnlocked(db: Db, month: string, vehicleId: string) {
  const { data } = await db.from("vehicle_month_expenses").select("status").eq("month", month).eq("vehicle_id", vehicleId).maybeSingle();
  if (data?.status === "confirmed") throw new Error("확정된 정산입니다. 수정하려면 먼저 확정을 해제하세요.");
}

/** 차량 월 비용 (주유·과태료·통행료·엔진오일·기타) */
export async function saveExpenses(formData: FormData) {
  const { supabase } = await assertAdmin();
  const { month, vehicleId } = target(formData);
  await assertUnlocked(supabase, month, vehicleId);
  const row: Record<string, unknown> = { vehicle_id: vehicleId, month, updated_at: new Date().toISOString() };
  for (const k of Object.keys(EXPENSE_LABELS)) row[k] = won(formData.get(k));
  row.memo = String(formData.get("memo") ?? "").trim() || null;
  const { error } = await supabase.from("vehicle_month_expenses").upsert(row, { onConflict: "vehicle_id,month" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/vehicle-settlement");
}

/**
 * 건별 정산 금액 수정. 폼에는 amount_<id> 와 원래 값 orig_<id> 가 있고, 바뀐 것만 저장한다.
 * 배차 건은 비우면 기본값(콜 금액 규칙, 외부오더는 −차감액)으로 되돌린다. 직접 추가한 항목(m_…)은 그 금액을 고친다.
 */
export async function saveAmounts(formData: FormData) {
  const { supabase } = await assertAdmin();
  const { month, vehicleId } = target(formData);
  await assertUnlocked(supabase, month, vehicleId);
  const updates: { id: string; value: number | null }[] = [];
  for (const [key, v] of formData.entries()) {
    if (!key.startsWith("amount_")) continue;
    const id = key.slice(7);
    const raw = String(v).trim();
    if (raw === String(formData.get(`orig_${id}`) ?? "").trim()) continue;
    updates.push({ id, value: raw === "" ? null : won(raw) });
  }
  const results = await Promise.all(
    updates.map((u) =>
      u.id.startsWith(MANUAL_PREFIX)
        ? supabase.from("vehicle_month_items").update({ amount: u.value ?? 0 }).eq("id", u.id.slice(MANUAL_PREFIX.length)).eq("vehicle_id", vehicleId)
        : supabase.from("dispatch_assignments").update({ settle_amount: u.value }).eq("id", u.id).eq("vehicle_id", vehicleId),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  revalidatePath("/admin/vehicle-settlement");
}

/** 배차에 없는 콜(TALIXO 등)이나 가감 항목을 정산에 직접 추가 */
export async function addManualItem(formData: FormData) {
  const { supabase } = await assertAdmin();
  const { month, vehicleId } = target(formData);
  await assertUnlocked(supabase, month, vehicleId);
  const workDate = String(formData.get("work_date") ?? "");
  if (!workDate.startsWith(month)) throw new Error(`날짜는 ${month} 안이어야 합니다.`);
  const pax = Number(formData.get("pax"));
  const { error } = await supabase.from("vehicle_month_items").insert({
    vehicle_id: vehicleId,
    month,
    work_date: workDate,
    work_time: text(formData.get("work_time")),
    source: text(formData.get("source")) ?? "TALIXO",
    ref_no: text(formData.get("ref_no")),
    trip_type: text(formData.get("trip_type")),
    flight_no: text(formData.get("flight_no")),
    vehicle_class: text(formData.get("vehicle_class")),
    pax: Number.isFinite(pax) && pax > 0 ? Math.round(pax) : null,
    memo: text(formData.get("memo")),
    amount: won(formData.get("amount")),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/vehicle-settlement");
}

export async function deleteManualItem(formData: FormData) {
  const { supabase } = await assertAdmin();
  const { month, vehicleId } = target(formData);
  await assertUnlocked(supabase, month, vehicleId);
  const id = String(formData.get("itemId") ?? "").replace(MANUAL_PREFIX, "");
  const { error } = await supabase.from("vehicle_month_items").delete().eq("id", id).eq("vehicle_id", vehicleId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/vehicle-settlement");
}

/**
 * 정산 확정: 수정 잠금 + 확정 시점의 내역을 저장해 기사 화면에 보여준다.
 * 확정 해제하면 다시 수정할 수 있다.
 */
export async function setSettlementStatus(formData: FormData) {
  const { supabase } = await assertAdmin();
  const { month, vehicleId } = target(formData);
  const confirm = formData.get("status") === "confirmed";

  if (!confirm) {
    const { error } = await supabase
      .from("vehicle_month_expenses")
      .update({ status: "draft", confirmed_at: null, snapshot: null, updated_at: new Date().toISOString() })
      .eq("month", month)
      .eq("vehicle_id", vehicleId);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/vehicle-settlement");
    return;
  }

  const report = await loadVehicleMonth(supabase, month);
  const v = report.vehicles.find((x) => x.vehicleId === vehicleId);
  if (!v) throw new Error("이 달에 정산할 내역이 없습니다.");
  const { data: driver } = await supabase.from("drivers").select("id").eq("vehicle_id", vehicleId).maybeSingle();
  const snapshot = {
    companyName: report.companyName,
    plate: v.plate,
    driverName: v.driverName,
    total: v.total,
    payout: v.payout,
    expenses: v.expenses,
    rows: v.rows.map((r) => ({
      date: r.serviceDate, pickupAt: r.pickupAt ?? null, inOut: inOutLabel(r), ref: r.bookingNo ?? null,
      flight: r.flightNo ?? null, vehicleClass: r.vehicleClass ?? null, pax: r.pax ?? null, amount: r.amount,
    })),
  };
  const row: Record<string, unknown> = {
    vehicle_id: vehicleId,
    month,
    status: "confirmed",
    confirmed_at: new Date().toISOString(),
    driver_id: driver?.id ?? null,
    snapshot,
    updated_at: new Date().toISOString(),
  };
  // 비용을 입력하지 않은 채 확정하면 0원으로 기록
  if (!v.expenses) for (const k of Object.keys(EXPENSE_LABELS)) row[k] = 0;
  const { error } = await supabase.from("vehicle_month_expenses").upsert(row, { onConflict: "vehicle_id,month" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/vehicle-settlement");
}

// ─────────────────────────────────────────────
// 삭제
// ─────────────────────────────────────────────

const backTo = (month: string, vehicleId: string, msg: string) =>
  `/admin/vehicle-settlement?month=${month}&v=${vehicleId}&msg=${encodeURIComponent(msg)}`;

function refreshAll() {
  for (const p of ["/admin", "/admin/upload", "/admin/dispatch", "/admin/vehicle-settlement"]) revalidatePath(p);
}

/** 이 차량·이 달의 확정 배차 (배정 id → 예약 id, 날짜) */
async function confirmedAssignments(db: Db, month: string, vehicleId: string) {
  const { from, to } = monthRange(month);
  const { data, error } = await db
    .from("dispatch_assignments")
    .select("id,booking_id,dispatch_runs!inner(service_date,status)")
    .eq("vehicle_id", vehicleId)
    .eq("dispatch_runs.status", "confirmed")
    .gte("dispatch_runs.service_date", from)
    .lte("dispatch_runs.service_date", to);
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => ({
    id: a.id as string,
    bookingId: a.booking_id as string,
    date: (a.dispatch_runs as unknown as { service_date: string }).service_date,
  }));
}

/**
 * 건별 내역에서 체크한 건 삭제.
 * 배차 건은 예약 자체를 지워 배차에서도 빠지고, 직접 추가한 항목은 그 항목만 지운다.
 */
export async function deleteSelectedRows(formData: FormData) {
  const { supabase } = await assertAdmin();
  const { month, vehicleId } = target(formData);
  await assertUnlocked(supabase, month, vehicleId);
  const selected = formData.getAll("sel").map(String);
  if (!selected.length) redirect(backTo(month, vehicleId, "삭제할 건을 체크하세요."));
  if (formData.get("confirmDelete") !== "on") redirect(backTo(month, vehicleId, "삭제하려면 '삭제 확인'에 체크하세요."));

  const manualIds = selected.filter((id) => id.startsWith(MANUAL_PREFIX)).map((id) => id.slice(MANUAL_PREFIX.length));
  const assignmentIds = new Set(selected.filter((id) => !id.startsWith(MANUAL_PREFIX)));

  if (manualIds.length) {
    const { error } = await supabase.from("vehicle_month_items").delete().in("id", manualIds).eq("vehicle_id", vehicleId);
    if (error) throw new Error(error.message);
  }
  // 이 차량의 이 달 배차인지 확인한 뒤 예약을 지운다 (다른 차량 건이 섞여 들어오지 않게)
  const mine = (await confirmedAssignments(supabase, month, vehicleId)).filter((a) => assignmentIds.has(a.id));
  if (mine.length) {
    const { error } = await supabase.from("bookings").delete().in("id", mine.map((a) => a.bookingId));
    if (error) throw new Error(error.message);
    await dropEmptyRuns(supabase, mine.map((a) => a.date));
  }
  refreshAll();
  redirect(backTo(month, vehicleId, `${manualIds.length + mine.length}건을 삭제했습니다.`));
}

/** 정산 입력 초기화: 비용, 직접 추가 항목, 건별 금액 수정을 지운다 (운행 내역은 그대로) */
export async function resetVehicleSettlement(formData: FormData) {
  const { supabase } = await assertAdmin();
  const { month, vehicleId } = target(formData);
  await assertUnlocked(supabase, month, vehicleId);
  if (formData.get("confirmReset") !== "on") redirect(backTo(month, vehicleId, "초기화하려면 확인에 체크하세요."));
  const ids = (await confirmedAssignments(supabase, month, vehicleId)).map((a) => a.id);
  const results = await Promise.all([
    supabase.from("vehicle_month_expenses").delete().eq("month", month).eq("vehicle_id", vehicleId),
    supabase.from("vehicle_month_items").delete().eq("month", month).eq("vehicle_id", vehicleId),
    ids.length ? supabase.from("dispatch_assignments").update({ settle_amount: null }).in("id", ids) : Promise.resolve({ error: null }),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  revalidatePath("/admin/vehicle-settlement");
  redirect(backTo(month, vehicleId, "정산 입력(비용·직접 추가·금액 수정)을 초기화했습니다."));
}

/** 이 차량의 이 달 운행 내역 전체 삭제 ('삭제' 입력 확인): 예약·배차, 직접 추가 항목, 비용 */
export async function deleteVehicleMonth(formData: FormData) {
  const { supabase } = await assertAdmin();
  const { month, vehicleId } = target(formData);
  await assertUnlocked(supabase, month, vehicleId);
  if (String(formData.get("confirmWord") ?? "").trim() !== "삭제") {
    redirect(backTo(month, vehicleId, "전체 삭제하려면 확인란에 '삭제'라고 입력하세요."));
  }
  const rows = await confirmedAssignments(supabase, month, vehicleId);
  if (rows.length) {
    const { error } = await supabase.from("bookings").delete().in("id", rows.map((a) => a.bookingId));
    if (error) throw new Error(error.message);
    await dropEmptyRuns(supabase, rows.map((a) => a.date));
  }
  await Promise.all([
    supabase.from("vehicle_month_items").delete().eq("month", month).eq("vehicle_id", vehicleId),
    supabase.from("vehicle_month_expenses").delete().eq("month", month).eq("vehicle_id", vehicleId),
  ]);
  refreshAll();
  redirect(`/admin/vehicle-settlement?month=${month}&msg=${encodeURIComponent(`${month} 해당 차량 운행 ${rows.length}건과 정산 입력을 삭제했습니다.`)}`);
}

/** 목록 화면: 차량 한 대의 그 달 운행·정산 입력 삭제 (확인 체크) */
export async function deleteVehicleMonthQuick(formData: FormData) {
  const { supabase } = await assertAdmin();
  const { month, vehicleId } = target(formData);
  const list = `/admin/vehicle-settlement?month=${month}`;
  if (formData.get("confirm") !== "on") redirect(`${list}&msg=${encodeURIComponent("삭제하려면 그 줄의 확인에 체크하세요.")}`);
  await assertUnlocked(supabase, month, vehicleId);
  const rows = await confirmedAssignments(supabase, month, vehicleId);
  if (rows.length) {
    const { error } = await supabase.from("bookings").delete().in("id", rows.map((a) => a.bookingId));
    if (error) throw new Error(error.message);
    await dropEmptyRuns(supabase, rows.map((a) => a.date));
  }
  await Promise.all([
    supabase.from("vehicle_month_items").delete().eq("month", month).eq("vehicle_id", vehicleId),
    supabase.from("vehicle_month_expenses").delete().eq("month", month).eq("vehicle_id", vehicleId),
  ]);
  refreshAll();
  redirect(`${list}&msg=${encodeURIComponent(`차량 운행 ${rows.length}건과 정산 입력을 삭제했습니다.`)}`);
}

/**
 * 목록 화면: 그 달 전체 삭제 ('삭제' 입력 확인).
 * 그 달의 예약·배차(외부 콜 포함), 직접 추가 항목, 비용·확정 정산을 모두 지운다. 차량·기사·설정은 남긴다.
 */
export async function deleteWholeMonth(formData: FormData) {
  const { supabase } = await assertAdmin();
  const month = String(formData.get("month"));
  if (!isMonth(month)) throw new Error("정산 월이 올바르지 않습니다.");
  const list = `/admin/vehicle-settlement?month=${month}`;
  if (String(formData.get("confirmWord") ?? "").trim() !== "삭제") {
    redirect(`${list}&msg=${encodeURIComponent("전체 삭제하려면 확인란에 '삭제'라고 입력하세요.")}`);
  }
  const { from, to } = monthRange(month);
  const { error: e1, count } = await supabase.from("bookings").delete({ count: "exact" }).gte("service_date", from).lte("service_date", to);
  if (e1) throw new Error(e1.message);
  const results = await Promise.all([
    supabase.from("dispatch_runs").delete().gte("service_date", from).lte("service_date", to),
    supabase.from("vehicle_month_items").delete().eq("month", month),
    supabase.from("vehicle_month_expenses").delete().eq("month", month),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  refreshAll();
  redirect(`${list}&msg=${encodeURIComponent(`${month} 예약·배차 ${count ?? 0}건과 정산 입력을 모두 삭제했습니다.`)}`);
}
