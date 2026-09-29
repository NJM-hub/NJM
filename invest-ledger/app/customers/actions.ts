"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/supabase";
import type { FormState } from "@/lib/types";
import { normalizePhone } from "@/lib/validate";

/** 고객 정보 수정 (이름·연락처·메모) */
export async function updateCustomerAction(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const name = String(fd.get("name") ?? "").trim();
  const phone = normalizePhone(String(fd.get("phone") ?? ""));
  const memo = String(fd.get("memo") ?? "").trim();
  if (!name) return { fieldErrors: { name: "고객명을 입력하세요." } };
  const a = await authorize("staff");
  if ("denied" in a) return a.denied;

  const { error } = await db(a.user.id).from("customers").update({ name, phone, memo }).eq("id", id);
  if (error) return { error: `저장하지 못했습니다: ${error.message}` };
  revalidatePath("/", "layout");
  redirect(`/customers/${id}?msg=saved`);
}

/** 사용 / 미사용 전환 (삭제 대신). 미사용 고객은 투자 등록 화면의 선택 목록에서 빠진다 */
export async function toggleCustomerStatusAction(id: string, next: "active" | "inactive"): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const { error } = await db(a.user.id).from("customers").update({ status: next }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect(`/customers/${id}?msg=${next}`);
}
