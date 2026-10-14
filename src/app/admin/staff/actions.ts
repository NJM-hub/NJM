"use server";
import { revalidatePath } from "next/cache";
import { assertOwner } from "@/lib/auth";

/** 직원 승인 / 승인 취소 (관리자 전용). 관리자·기사 계정은 바꾸지 않는다 */
export async function setStaffApproval(formData: FormData) {
  const { supabase, user } = await assertOwner();
  const id = String(formData.get("id") ?? "");
  const approve = formData.get("approve") === "1";
  if (!id || id === user.id) throw new Error("대상이 올바르지 않습니다.");
  const { data: p } = await supabase.from("profiles").select("role").eq("id", id).single();
  const kind = p?.role?.startsWith("manager") ? "manager" : p?.role?.startsWith("staff") ? "staff" : null;
  if (!kind) throw new Error("직원·관리자 회원만 승인할 수 있습니다.");
  const { error } = await supabase
    .from("profiles")
    .update({ role: approve ? kind : `${kind}_pending` })
    .eq("id", id)
    .in("role", [kind, `${kind}_pending`]);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/staff");
}
