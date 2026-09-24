import { todayKst } from "@/lib/format";

export type Coupon = {
  id: string;
  title: string;
  description: string | null;
  code: string | null;
  discount_type: "amount" | "percent";
  discount_value: number;
  service: string | null;
  valid_until: string | null;
  issue_on_signup: boolean;
  active: boolean;
};

export type CustomerCoupon = { id: string; issued_at: string; used_at: string | null; coupons: Coupon | null };

export const discountLabel = (c: Pick<Coupon, "discount_type" | "discount_value">) =>
  c.discount_type === "percent" ? `${c.discount_value}% 할인` : `${c.discount_value.toLocaleString("ko-KR")}원 할인`;

export const isExpired = (c: Pick<Coupon, "valid_until">, today = todayKst()) => !!c.valid_until && c.valid_until < today;

/** 사용 가능: 미사용 · 쿠폰 활성 · 기한 내 */
export const isUsable = (cc: CustomerCoupon) => !!cc.coupons && !cc.used_at && cc.coupons.active && !isExpired(cc.coupons);

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "");
