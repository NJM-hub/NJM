import type { Metadata } from "next";
import Link from "next/link";
import { requireCustomer } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { discountLabel, isExpired, isUsable, type CustomerCoupon } from "@/lib/site/coupons";
import { CouponCodeForm, ProfileForm, WithdrawForm } from "@/components/site/MypageForms";

export const metadata: Metadata = { title: "마이페이지", robots: { index: false } };

const STATUS: Record<string, string> = { new: "접수", contacted: "상담 중", done: "완료", canceled: "취소" };

export default async function MyPage() {
  const { supabase, user } = await requireCustomer();
  const [{ data: me }, { data: coupons }, { data: inquiries }] = await Promise.all([
    supabase.from("customers").select("name,phone,email,marketing_consent_at").eq("id", user.id).maybeSingle(),
    supabase.from("customer_coupons").select("id,issued_at,used_at,coupons(*)").eq("customer_id", user.id).order("issued_at", { ascending: false }),
    supabase.from("inquiries").select("id,service,car,period,status,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
  ]);
  const list = (coupons ?? []) as unknown as CustomerCoupon[];
  const usable = list.filter(isUsable);
  const past = list.filter((c) => !isUsable(c));

  return (
    <div className="site-container max-w-3xl py-10 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-site-ink-2">안녕하세요</p>
          <h1 className="text-3xl font-extrabold tracking-tight">{me?.name ?? "고객"}님</h1>
        </div>
        <form action="/auth/signout?next=/" method="post">
          <button className="text-sm font-semibold text-site-gray hover:text-site-ink">로그아웃</button>
        </form>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2 text-center">
        <a href="#coupons" className="rounded-2xl bg-site-bg p-4"><p className="text-2xl font-extrabold text-brand">{usable.length}</p><p className="text-sm text-site-ink-2">쿠폰</p></a>
        <a href="#inquiries" className="rounded-2xl bg-site-bg p-4"><p className="text-2xl font-extrabold">{inquiries?.length ?? 0}</p><p className="text-sm text-site-ink-2">상담 내역</p></a>
        <Link href="/favorites" className="rounded-2xl bg-site-bg p-4"><p className="text-2xl font-extrabold">♥</p><p className="text-sm text-site-ink-2">찜한 차량</p></Link>
      </div>

      <section id="coupons" className="mt-12 scroll-mt-24">
        <h2 className="text-xl font-bold">내 쿠폰</h2>
        <CouponCodeForm />
        <div className="mt-4 space-y-3">
          {usable.map((cc) => cc.coupons && (
            <div key={cc.id} className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-brand/40 bg-brand-soft/40 p-5">
              <div className="flex-1">
                <p className="text-lg font-extrabold text-brand">{discountLabel(cc.coupons)}</p>
                <p className="font-bold">{cc.coupons.title}</p>
                <p className="mt-1 text-xs text-site-ink-2">
                  {cc.coupons.service ? `${cc.coupons.service} 전용` : "전 서비스"} · {cc.coupons.valid_until ? `${cc.coupons.valid_until}까지` : "기한 없음"}
                </p>
                {cc.coupons.description && <p className="mt-1 text-xs text-site-gray">{cc.coupons.description}</p>}
              </div>
              <Link href={`/contact?${new URLSearchParams({ coupon: cc.id, ...(cc.coupons.service ? { service: cc.coupons.service } : {}) })}`} className="site-btn site-btn--sm shrink-0">사용하기</Link>
            </div>
          ))}
          {!usable.length && <p className="rounded-2xl bg-site-bg p-6 text-center text-sm text-site-ink-2">사용할 수 있는 쿠폰이 없습니다.</p>}
          {past.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-site-gray">사용했거나 기한이 지난 쿠폰 {past.length}장</summary>
              <ul className="mt-2 space-y-1 text-site-gray">
                {past.map((cc) => cc.coupons && (
                  <li key={cc.id}>{cc.coupons.title} · {cc.used_at ? "사용 완료" : isExpired(cc.coupons) ? "기한 만료" : "사용 불가"}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </section>

      <section id="inquiries" className="mt-12 scroll-mt-24">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold">상담 내역</h2>
          <Link href="/contact" className="text-sm font-bold text-brand">새 상담 신청 ›</Link>
        </div>
        <div className="mt-4 divide-y divide-site-line border-y border-site-line">
          {inquiries?.map((q) => (
            <div key={q.id} className="flex items-center gap-3 py-4">
              <div className="flex-1">
                <p className="font-semibold">{q.service}{q.car && ` · ${q.car}`}</p>
                <p className="text-xs text-site-gray">{fmtDateTime(q.created_at)}{q.period && ` · ${q.period}`}</p>
              </div>
              <span className="rounded-full bg-site-bg px-3 py-1 text-xs font-bold">{STATUS[q.status] ?? q.status}</span>
            </div>
          ))}
          {!inquiries?.length && <p className="py-6 text-center text-sm text-site-ink-2">로그인한 상태로 상담을 신청하시면 이곳에 표시됩니다.</p>}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold">내 정보</h2>
        <p className="mt-1 text-sm text-site-gray">{me?.email ?? user.email}</p>
        <ProfileForm name={me?.name ?? ""} phone={me?.phone ?? ""} marketing={!!me?.marketing_consent_at} />
        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          <Link href="/mypage/password" className="font-semibold text-site-ink-2 hover:text-site-ink">비밀번호 변경</Link>
        </div>
        <WithdrawForm />
      </section>
    </div>
  );
}
