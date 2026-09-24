import type { Metadata } from "next";
import { ContactForm, type ContactCustomer } from "@/components/site/ContactForm";
import { getSession } from "@/lib/auth";
import { discountLabel, isUsable, type CustomerCoupon } from "@/lib/site/coupons";
import { telHref } from "@/lib/site/config";
import { getSiteInfo } from "@/lib/site/info";

export const metadata: Metadata = { title: "상담 신청", description: "연락처를 남겨 주시면 담당자가 바로 연락드립니다." };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ service?: string; car?: string; event?: string; coupon?: string }> }) {
  const [{ service, car, event, coupon }, info, customer] = await Promise.all([searchParams, getSiteInfo(), loadCustomer()]);
  return (
    <div className="site-container max-w-2xl py-10 sm:py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">상담 신청</h1>
      <p className="mt-2 mb-8 text-site-ink-2">
        연락처를 남겨 주시면 담당자가 바로 전화드립니다.
        {info.phone && <> 급하시면 <a href={telHref(info.phone)} className="font-bold text-site-ink">{info.phone}</a></>}
      </p>
      <ContactForm customer={customer} couponId={coupon} service={service} car={car?.slice(0, 100)} message={event ? `[이벤트] ${event.slice(0, 100)} 관련 문의` : undefined} info={info} />
    </div>
  );
}

/** 로그인한 고객이면 이름·연락처와 사용 가능한 쿠폰을 불러온다. */
async function loadCustomer(): Promise<ContactCustomer | null> {
  const session = await getSession().catch(() => null);
  if (!session || session.role !== "customer") return null;
  const { supabase, user } = session;
  const [{ data: me }, { data: coupons }] = await Promise.all([
    supabase.from("customers").select("name,phone").eq("id", user.id).maybeSingle(),
    supabase.from("customer_coupons").select("id,issued_at,used_at,coupons(*)").eq("customer_id", user.id),
  ]);
  const usable = ((coupons ?? []) as unknown as CustomerCoupon[]).filter(isUsable);
  return {
    name: me?.name ?? "",
    phone: me?.phone ?? "",
    coupons: usable.map((cc) => ({ id: cc.id, label: `${cc.coupons!.title} (${discountLabel(cc.coupons!)})` })),
  };
}
