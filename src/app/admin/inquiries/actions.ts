"use server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";

const STATUSES = ["new", "contacted", "done", "canceled"];

export async function updateInquiry(formData: FormData) {
  const { supabase } = await assertAdmin();
  const status = String(formData.get("status"));
  if (!STATUSES.includes(status)) throw new Error("상태 값이 올바르지 않습니다.");
  const { error } = await supabase
    .from("inquiries")
    .update({ status, admin_memo: String(formData.get("admin_memo") || "").trim() || null })
    .eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/admin/inquiries");
  revalidatePath("/admin");
}
