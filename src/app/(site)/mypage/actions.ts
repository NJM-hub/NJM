"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isExpired, normalizeCode, type Coupon } from "@/lib/site/coupons";
import { PHONE_RE } from "@/lib/site/validate";

export type FormState = { ok: boolean; message?: string };

async function customerId() {
  const s = await getSession();
  if (!s || s.role !== "customer") throw new Error("로그인이 필요합니다.");
  return s.user.id;
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = await customerId();
  const name = String(formData.get("name") ?? "").trim().slice(0, 30);
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name) return { ok: false, message: "이름을 입력해 주세요." };
  if (!PHONE_RE.test(phone)) return { ok: false, message: "휴대폰 번호를 정확히 입력해 주세요." };

  const db = createAdminClient();
  const { data: cur } = await db.from("customers").select("marketing_consent_at").eq("id", id).single();
  const marketing = formData.get("marketing") === "on";
  const { error } = await db
    .from("customers")
    .update({
      name,
      phone,
      marketing_consent_at: marketing ? cur?.marketing_consent_at ?? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/mypage");
  return { ok: true, message: "저장했습니다." };
}

export async function registerCoupon(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = await customerId();
  const code = normalizeCode(String(formData.get("code") ?? ""));
  if (!code) return { ok: false, message: "쿠폰 코드를 입력해 주세요." };

  const db = createAdminClient();
  const { data: coupon } = await db.from("coupons").select("*").eq("code", code).eq("active", true).maybeSingle();
  if (!coupon || isExpired(coupon as Coupon)) return { ok: false, message: "사용할 수 없는 쿠폰 코드입니다." };

  const { error } = await db.from("customer_coupons").insert({ coupon_id: coupon.id, customer_id: id });
  if (error) return { ok: false, message: error.code === "23505" ? "이미 받은 쿠폰입니다." : error.message };
  revalidatePath("/mypage");
  return { ok: true, message: `'${coupon.title}' 쿠폰을 받았습니다.` };
}

export async function withdraw(formData: FormData) {
  const id = await customerId();
  if (formData.get("confirm") !== "탈퇴") throw new Error("확인 문구를 정확히 입력해 주세요.");
  // 먼저 로그아웃해 세션 쿠키를 지운 뒤 계정을 삭제한다.
  // auth.users 삭제 → profiles · customers · customer_coupons 는 함께 삭제되고, 상담 신청의 회원 연결은 해제된다.
  await (await createClient()).auth.signOut();
  const { error } = await createAdminClient().auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
  redirect("/");
}
