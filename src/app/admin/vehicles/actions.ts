"use server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";

const numOrNull = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : Number(v));

export async function saveVehicle(formData: FormData) {
  const { supabase } = await assertAdmin();
  const id = String(formData.get("id") || "") || null;
  const baseAddress = String(formData.get("base_address") || "").trim() || null;
  const row = {
    plate_number: String(formData.get("plate_number") || "").trim(),
    model: String(formData.get("model") || "").trim() || null,
    seats: Number(formData.get("seats") || 4),
    grade: String(formData.get("grade") || "").trim() || null,
    base_address: baseAddress,
    base_lat: numOrNull(formData.get("base_lat")),
    base_lng: numOrNull(formData.get("base_lng")),
    active: formData.get("active") === "on",
    memo: String(formData.get("memo") || "").trim() || null,
  };
  if (!row.plate_number) throw new Error("차량번호를 입력하세요.");
  if (!(row.seats > 0)) throw new Error("좌석 수가 올바르지 않습니다.");
  const { error } = id
    ? await supabase.from("vehicles").update(row).eq("id", id)
    : await supabase.from("vehicles").insert(row);
  if (error) throw new Error(error.code === "23505" ? "이미 등록된 차량번호입니다." : error.message);
  revalidatePath("/admin/vehicles");
}

export async function deleteVehicle(formData: FormData) {
  const { supabase } = await assertAdmin();
  const { error } = await supabase.from("vehicles").delete().eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/admin/vehicles");
}
