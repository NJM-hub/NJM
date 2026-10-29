"use server";
import { revalidatePath } from "next/cache";
import { assertDriverManager } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { isMonth } from "@/lib/format";
import { isValidRrn, maskAccount, maskRrn, normalizeAccount, normalizeRrn } from "@/lib/pii";

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

/** 소속 기사 저장 (id 가 있으면 수정). 주민번호·계좌는 비워 두면 기존 값을 그대로 둔다 */
export async function saveRosterDriver(formData: FormData) {
  const { supabase } = await assertDriverManager();
  const id = text(formData.get("id"));
  const name = text(formData.get("name"));
  if (!name) throw new Error("이름을 입력하세요.");
  const row: Record<string, unknown> = {
    name,
    vehicle_id: text(formData.get("vehicle_id")),
    phone: text(formData.get("phone")),
    name_zh: text(formData.get("name_zh")),
    bank_name: text(formData.get("bank_name")),
    account_holder: text(formData.get("account_holder")),
    // 지입 기사 명단에서 추가하면 메모에 "지입"이 꼭 들어가게
    memo: formData.get("jiip") === "1" && !/지입/.test(text(formData.get("memo")) ?? "")
      ? ["지입", text(formData.get("memo"))].filter(Boolean).join(" ")
      : text(formData.get("memo")),
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
  const { supabase } = await assertDriverManager();
  const { error } = await supabase.from("driver_roster").delete().eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/admin/drivers");
}

/** 월별 지급표 비고·지급 상태(미지급/지급완료) 저장 */
export async function saveDriverMonthNote(formData: FormData) {
  const { supabase } = await assertDriverManager();
  const month = String(formData.get("month"));
  if (!isMonth(month)) throw new Error("월이 올바르지 않습니다.");
  const unitKey = String(formData.get("unitKey"));
  const paid = formData.get("paid") === "1";
  const { data: prev } = await supabase.from("driver_month_notes").select("paid,paid_at").eq("month", month).eq("unit_key", unitKey).maybeSingle();
  const now = new Date().toISOString();
  const { error } = await supabase.from("driver_month_notes").upsert({
    month, unit_key: unitKey, note: text(formData.get("note")), paid,
    // 지급완료로 바꾼 시각 (계속 지급완료면 처음 시각 유지)
    paid_at: paid ? (prev?.paid ? prev.paid_at : now) : null,
    updated_at: now,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/drivers/pay");
}
