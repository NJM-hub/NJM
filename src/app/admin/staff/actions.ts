"use server";
import { revalidatePath } from "next/cache";
import { assertOwner } from "@/lib/auth";

/** 직원 승인 / 승인 취소 (관리자 전용). 관리자·기사 계정은 바꾸지 않는다 */
export async function setStaffApproval(formData: FormData) {
  const { supabase, user } = await assertOwner();
  const id = String(formData.get("id") ?? "");
  const approve = formData.get("approve") === "1";
  if (!id || id === user.id) throw new Error("대상이 올바르지 않습니다.");
  const { error } = await supabase
    .from("profiles")
    .update({ role: approve ? "staff" : "staff_pending" })
    .eq("id", id)
    .in("role", ["staff", "staff_pending"]);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/staff");
}
