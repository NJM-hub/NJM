"use server";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { isUsable, type CustomerCoupon } from "@/lib/site/coupons";
import { SERVICES } from "@/lib/site/services";
import { REGIONS } from "@/lib/site/config";
import { getSiteInfo } from "@/lib/site/info";
import { PHONE_RE } from "@/lib/site/validate";

export type InquiryState = { ok: boolean; error?: string };

const text = (f: FormData, k: string, max = 100) => String(f.get(k) ?? "").trim().slice(0, max);

export async function submitInquiry(_prev: InquiryState, formData: FormData): Promise<InquiryState> {
  // 스팸 봇용 숨김 필드: 채워져 있으면 성공한 척 무시한다.
  if (text(formData, "website")) return { ok: true };

  const service = text(formData, "service");
  const name = text(formData, "name", 30);
  const phone = text(formData, "phone", 20).replace(/[^0-9-]/g, "");
  const startDate = text(formData, "start_date", 10);

  if (!SERVICES.some((s) => s.formValue === service)) return { ok: false, error: "희망 서비스를 선택해 주세요." };
  if (!name) return { ok: false, error: "이름을 입력해 주세요." };
  if (!PHONE_RE.test(phone)) return { ok: false, error: "연락처를 정확히 입력해 주세요. (예: 010-1234-5678)" };
  if (formData.get("consent") !== "on") return { ok: false, error: "개인정보 수집 및 이용에 동의해 주세요." };

  // 로그인한 고객이면 상담 내역에 연결하고, 고른 쿠폰이 본인 것이며 쓸 수 있는지 확인한다.
  const session = await getSession().catch(() => null);
  const userId = session?.role === "customer" ? session.user.id : null;
  const db = createAdminClient();
  let customerCouponId: string | null = null;
  const couponId = text(formData, "customer_coupon_id", 40);
  if (userId && couponId) {
    const { data } = await db.from("customer_coupons").select("id,issued_at,used_at,coupons(*)").eq("id", couponId).eq("customer_id", userId).maybeSingle();
    if (!data || !isUsable(data as unknown as CustomerCoupon)) return { ok: false, error: "선택한 쿠폰을 사용할 수 없습니다." };
    customerCouponId = data.id;
  }

  const region = text(formData, "region", 10);
  const { error } = await db.from("inquiries").insert({
    user_id: userId,
    customer_coupon_id: customerCouponId,
    service,
    name,
    phone,
    region: REGIONS.includes(region) ? region : null,
    car: text(formData, "car", 100) || null,
    start_date: /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : null,
    period: text(formData, "period", 20) || null,
    message: text(formData, "message", 2000) || null,
    privacy_consent_at: new Date().toISOString(),
  });
  if (error) {
    console.error("상담 신청 저장 실패", error.message);
    const { phone: tel } = await getSiteInfo();
    return { ok: false, error: `접수 중 문제가 생겼습니다. ${tel ? `전화(${tel})로 문의해 주세요.` : "잠시 후 다시 시도해 주세요."}` };
  }
  return { ok: true };
}
