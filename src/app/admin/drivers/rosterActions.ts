"use server";
import { revalidatePath } from "next/cache";
import { assertOwner } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { isMonth } from "@/lib/format";
import { isValidRrn, maskAccount, maskRrn, normalizeAccount, normalizeRrn } from "@/lib/pii";

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

/** 소속 기사 저장 (id 가 있으면 수정). 주민번호·계좌는 비워 두면 기존 값을 그대로 둔다 */
export async function saveRosterDriver(formData: FormData) {
  const { supabase } = await assertOwner();
  const id = text(formData.get("id"));
  const name = text(formData.get("name"));
  if (!name) throw new Error("이름을 입력하세요.");
  const row: Record<string, unknown> = {
    name,
    vehicle_id: text(formData.get("vehicle_id")),
    phone: text(formData.get("phone")),
    bank_name: text(formData.get("bank_name")),
    account_holder: text(formData.get("account_holder")),
    memo: text(formData.get("memo")),
    active: formData.get("active") !== "off",
    updated_at: new Date().toISOString(),
  };
  const rrnIn = text(formData.get("rrn"));
  if (rrnIn) {
    const rrn = normalizeRrn(rrnIn);
    if (!rrn || !isValidRrn(rrn)) throw new Error(`${name}: 주민등록번호 형식이 올바르지 않습니다.`);
    row.rrn_enc = encrypt(rrn);
    row.rrn_masked = maskRrn(rrn);
  }
  const accIn = text(formData.get("bank_account"));
  if (accIn) {
    const acc = normalizeAccount(accIn);
    if (!acc) throw new Error(`${name}: 계좌번호 형식이 올바르지 않습니다.`);
    row.bank_account_enc = encrypt(acc);
    row.bank_account_masked = maskAccount(acc);
  }
  const { error } = id ? await supabase.from("driver_roster").update(row).eq("id", id) : await supabase.from("driver_roster").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/drivers");
}

export async function deleteRosterDriver(formData: FormData) {
  const { supabase } = await assertOwner();
  const { error } = await supabase.from("driver_roster").delete().eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/admin/drivers");
}

/** 월별 지급표 비고 저장 */
export async function saveDriverMonthNote(formData: FormData) {
  const { supabase } = await assertOwner();
  const month = String(formData.get("month"));
  if (!isMonth(month)) throw new Error("월이 올바르지 않습니다.");
  const unitKey = String(formData.get("unitKey"));
  const { error } = await supabase
    .from("driver_month_notes")
    .upsert({ month, unit_key: unitKey, note: text(formData.get("note")), updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/drivers/pay");
}
