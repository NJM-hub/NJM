"use server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import type { ParsedBooking } from "@/lib/kkday/parse";

export type SaveResult = { ok: true; count: number; dates: string[] } | { ok: false; error: string };

export async function saveBookings(filename: string, rows: ParsedBooking[]): Promise<SaveResult> {
  const { supabase, user } = await assertAdmin();
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "저장할 예약이 없습니다." };
  if (rows.length > 5000) return { ok: false, error: "한 번에 5,000건까지 업로드할 수 있습니다." };

  const valid = rows.filter((r) => r.serviceDate);
  if (valid.length === 0) return { ok: false, error: "이용일이 있는 행이 없습니다. 컬럼 매핑을 확인하세요." };
  const dates = [...new Set(valid.map((r) => r.serviceDate!))].sort();

  const { data: upload, error: upErr } = await supabase
    .from("schedule_uploads")
    .insert({ filename, service_date: dates[0], row_count: valid.length, uploaded_by: user.id })
    .select("id")
    .single();
  if (upErr || !upload) return { ok: false, error: upErr?.message ?? "업로드 기록 실패" };

  const toRow = (r: ParsedBooking) => ({
    upload_id: upload.id,
    service_date: r.serviceDate,
    booking_no: r.bookingNo,
    product_name: r.productName,
    customer_name: r.customerName,
    customer_phone: r.customerPhone,
    pax: Math.max(1, Math.round(r.pax)),
    pickup_at: r.pickupAt,
    duration_min: r.durationMin,
    pickup_address: r.pickupAddress,
    pickup_lat: r.pickupLat,
    pickup_lng: r.pickupLng,
    pickup_geo: r.pickupLat != null ? "exact" : null,
    dropoff_address: r.dropoffAddress,
    dropoff_lat: r.dropoffLat,
    dropoff_lng: r.dropoffLng,
    dropoff_geo: r.dropoffLat != null ? "exact" : null,
    flight_no: r.flightNo,
    memo: r.memo,
    trip_type: r.tripType,
    vehicle_class: r.vehicleClass,
    wait_min: r.waitMin,
    pickup_place: r.pickupPlace,
    dropoff_place: r.dropoffPlace,
    fare: r.fare,
    raw: r.raw,
  });

  // 예약번호가 있는 건은 (예약번호, 이용일) 기준으로 덮어쓰기, 없는 건은 새로 추가
  const withNo = valid.filter((r) => r.bookingNo).map(toRow);
  const withoutNo = valid.filter((r) => !r.bookingNo).map(toRow);
  // 같은 파일 안의 중복 예약번호는 마지막 행 기준
  const dedup = [...new Map(withNo.map((r) => [`${r.booking_no}|${r.service_date}`, r])).values()];

  if (dedup.length) {
    const { error } = await supabase.from("bookings").upsert(dedup, { onConflict: "booking_no,service_date" });
    if (error) return { ok: false, error: error.message };
  }
  if (withoutNo.length) {
    const { error } = await supabase.from("bookings").insert(withoutNo);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/admin");
  return { ok: true, count: dedup.length + withoutNo.length, dates };
}
