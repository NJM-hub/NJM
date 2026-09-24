"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { driverRowFromForm, type DriverFormState } from "@/lib/drivers/save";
import { createAdminClient } from "@/lib/supabase/server";

export async function saveMyProfile(_prev: DriverFormState, formData: FormData): Promise<DriverFormState> {
  const { user, role } = await requireUser();
  if (role === "customer") return { ok: false, message: "홈페이지 고객 계정으로는 기사 등록을 할 수 없습니다." };
  const db = createAdminClient();
  const { data: existing } = await db.from("drivers").select("id,rrn_enc,bank_account_enc").eq("id", user.id).maybeSingle();

  if (!existing && formData.get("privacy_consent") !== "on") {
    return { ok: false, message: "개인정보 수집·이용(고유식별정보 포함)에 동의해야 가입할 수 있습니다." };
  }
  const parsed = driverRowFromForm(formData, !existing?.rrn_enc || !existing?.bank_account_enc);
  if ("error" in parsed) return { ok: false, message: parsed.error };

  // 기사가 바꿀 수 있는 컬럼만 저장 (status, vehicle_id 는 관리자만)
  const { error } = existing
    ? await db.from("drivers").update(parsed.row).eq("id", user.id)
    : await db.from("drivers").insert({
        ...parsed.row,
        id: user.id,
        email: user.email,
        status: "pending",
        privacy_consent_at: new Date().toISOString(),
        third_party_consent_at: formData.get("third_party_consent") === "on" ? new Date().toISOString() : null,
      });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/driver");
  return { ok: true, message: existing ? "저장되었습니다." : "등록되었습니다. 관리자 승인 후 배차를 받을 수 있습니다." };
}
