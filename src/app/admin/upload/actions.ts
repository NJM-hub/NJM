"use server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import Papa from "papaparse";
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
    source: r.source ?? null,
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

export type SheetFetchResult =
  | { ok: true; name: string; rows: string[][] }
  | { ok: true; name: string; xlsxBase64: string }
  | { ok: false; error: string };

/**
 * 구글 시트 링크의 해당 탭(gid)을 CSV 로 내려받는다. allTabs 면 모든 탭을 xlsx 로 내려받는다.
 * 시트는 "링크가 있는 모든 사용자" 보기 권한이어야 한다.
 */
export async function fetchGoogleSheet(url: string, allTabs = false): Promise<SheetFetchResult> {
  await assertAdmin();
  const id = url.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1];
  if (!id) return { ok: false, error: "구글 시트 링크가 아닙니다. (docs.google.com/spreadsheets/d/... 형식)" };
  const gid = url.match(/[#?&]gid=(\d+)/)?.[1] ?? "0";
  const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?${allTabs ? "format=xlsx" : `format=csv&gid=${gid}`}`;
  let res: Response;
  try {
    res = await fetch(exportUrl, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  } catch (e) {
    return { ok: false, error: `시트를 불러오지 못했습니다: ${e instanceof Error ? e.message : String(e)}` };
  }
  const shareError = "시트를 열 수 없습니다. 공유 설정을 '링크가 있는 모든 사용자(뷰어)'로 바꿔주세요.";
  if (allTabs) {
    if (!res.ok || !/spreadsheetml|octet-stream/.test(res.headers.get("content-type") ?? "")) return { ok: false, error: shareError };
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: true, name: `구글시트 ${id.slice(0, 8)}`, xlsxBase64: buf.toString("base64") };
  }
  const text = await res.text();
  if (!res.ok || /^\s*<(!doctype|html)/i.test(text)) {
    return { ok: false, error: shareError };
  }
  const rows = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { skipEmptyLines: false }).data;
  return { ok: true, name: `구글시트 ${id.slice(0, 8)}#${gid}`, rows };
}
