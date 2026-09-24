"use server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { isDate } from "@/lib/format";
import { normalizeCode } from "@/lib/site/coupons";
import { SERVICES } from "@/lib/site/services";

export async function saveCoupon(formData: FormData) {
  const { supabase } = await assertAdmin();
  const id = String(formData.get("id") || "") || null;
  const type = formData.get("discount_type") === "percent" ? "percent" : "amount";
  const value = Math.round(Number(String(formData.get("discount_value") ?? "").replace(/[^0-9]/g, "")));
  const service = String(formData.get("service") || "");
  const validUntil = String(formData.get("valid_until") || "");
  const code = normalizeCode(String(formData.get("code") || ""));
  const row = {
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || "").trim() || null,
    code: code || null,
    discount_type: type,
    discount_value: value,
    service: SERVICES.some((s) => s.formValue === service) ? service : null,
    valid_until: isDate(validUntil) ? validUntil : null,
    issue_on_signup: formData.get("issue_on_signup") === "on",
    active: formData.get("active") === "on",
  };
  if (!row.title) throw new Error("쿠폰 이름을 입력하세요.");
  if (!(value > 0)) throw new Error("할인 금액(또는 %)을 입력하세요.");
  if (type === "percent" && value > 100) throw new Error("할인율은 100% 이하로 입력하세요.");
  if (code && !/^[A-Z0-9_-]{3,30}$/.test(code)) throw new Error("쿠폰 코드는 영문·숫자 3~30자로 입력하세요.");

  const { error } = id ? await supabase.from("coupons").update(row).eq("id", id) : await supabase.from("coupons").insert(row);
  if (error) throw new Error(error.code === "23505" ? "이미 쓰고 있는 쿠폰 코드입니다." : error.message);
  revalidatePath("/admin/coupons");
}

export async function deleteCoupon(formData: FormData) {
  const { supabase } = await assertAdmin();
  const { error } = await supabase.from("coupons").delete().eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/admin/coupons");
}

/** 고객 쿠폰 사용 처리 / 되돌리기 */
export async function setCouponUsed(formData: FormData) {
  const { supabase } = await assertAdmin();
  const used = formData.get("used") === "1";
  const { error } = await supabase
    .from("customer_coupons")
    .update({ used_at: used ? new Date().toISOString() : null })
    .eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/admin/coupons");
  revalidatePath("/admin/inquiries");
  revalidatePath("/admin/customers");
}

/** 특정 고객에게 쿠폰 직접 발급 */
export async function issueCoupon(formData: FormData) {
  const { supabase } = await assertAdmin();
  const couponId = String(formData.get("coupon_id") || "");
  const customerId = String(formData.get("customer_id") || "");
  if (!couponId || !customerId) throw new Error("쿠폰을 선택하세요.");
  const { error } = await supabase.from("customer_coupons").insert({ coupon_id: couponId, customer_id: customerId });
  if (error) throw new Error(error.code === "23505" ? "이미 받은 쿠폰입니다." : error.message);
  revalidatePath("/admin/customers");
  revalidatePath("/admin/coupons");
}
