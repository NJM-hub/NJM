"use server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { driverRowFromForm, type DriverFormState } from "@/lib/drivers/save";
import { formatRrn } from "@/lib/pii";

export async function updateDriverStatus(formData: FormData) {
  const { supabase } = await assertAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["pending", "approved", "inactive"].includes(status)) throw new Error("잘못된 상태");
  const vehicleId = String(formData.get("vehicle_id") ?? "") || null;

  // 다른 기사에게 연결된 차량이면 먼저 해제
  if (vehicleId) await supabase.from("drivers").update({ vehicle_id: null }).eq("vehicle_id", vehicleId).neq("id", id);
  const { error } = await supabase
    .from("drivers")
    .update({ status, vehicle_id: status === "inactive" ? null : vehicleId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/drivers");
}

export async function adminUpdateDriver(id: string, _prev: DriverFormState, formData: FormData): Promise<DriverFormState> {
  const { supabase } = await assertAdmin();
  const parsed = driverRowFromForm(formData, false);
  if ("error" in parsed) return { ok: false, message: parsed.error };
  const { error } = await supabase.from("drivers").update(parsed.row).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/admin/drivers/${id}`);
  return { ok: true, message: "저장되었습니다." };
}

/** 민감정보 원문 조회 (관리자) */
export async function revealDriverPii(id: string): Promise<{ rrn: string | null; account: string | null }> {
  const { supabase } = await assertAdmin();
  const { data } = await supabase.from("drivers").select("rrn_enc,bank_account_enc").eq("id", id).single();
  const rrn = decrypt(data?.rrn_enc);
  return { rrn: rrn ? formatRrn(rrn) : null, account: decrypt(data?.bank_account_enc) };
}
