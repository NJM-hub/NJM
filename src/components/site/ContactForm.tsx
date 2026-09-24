"use client";
import Link from "next/link";
import { useActionState } from "react";
import { submitInquiry, type InquiryState } from "@/app/(site)/contact/actions";
import { SITE, telHref } from "@/lib/site/config";
import { PERIODS, SERVICES } from "@/lib/site/services";

export function ContactForm({ service, car }: { service?: string; car?: string }) {
  const [state, action, pending] = useActionState<InquiryState, FormData>(submitInquiry, { ok: false });

  if (state.ok) {
    return (
      <div className="rounded-2xl bg-site-bg px-6 py-16 text-center">
        <p className="text-4xl" aria-hidden>✓</p>
        <h2 className="mt-3 text-2xl font-extrabold">상담 신청이 접수되었습니다</h2>
        <p className="mt-2 text-site-ink-2">운영시간({SITE.hours}) 안에 담당자가 바로 연락드리겠습니다.</p>
        <p className="mt-1 text-sm text-site-gray">급하시면 <a href={telHref(SITE.phone)} className="font-bold text-site-ink">{SITE.phone}</a>로 전화 주세요.</p>
        <Link href="/" className="site-btn site-btn--line mt-6">홈으로</Link>
      </div>
    );
  }

  const req = <span className="text-brand"> *</span>;
  return (
    <form action={action} className="space-y-5">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div>
        <label className="site-label" htmlFor="service">희망 서비스{req}</label>
        <select id="service" name="service" required defaultValue={SERVICES.some((s) => s.formValue === service) ? service : ""} className="site-input">
          <option value="" disabled>선택해 주세요</option>
          {SERVICES.map((s) => <option key={s.key} value={s.formValue}>{s.name}</option>)}
        </select>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="site-label" htmlFor="name">이름{req}</label>
          <input id="name" name="name" required maxLength={30} autoComplete="name" className="site-input" />
        </div>
        <div>
          <label className="site-label" htmlFor="phone">연락처{req}</label>
          <input id="phone" name="phone" type="tel" required inputMode="tel" placeholder="010-1234-5678" autoComplete="tel" className="site-input" />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="site-label" htmlFor="region">희망 지역</label>
          <select id="region" name="region" defaultValue="" className="site-input">
            <option value="">선택 안 함</option>
            {SITE.regions.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="site-label" htmlFor="car">희망 차종</label>
          <input id="car" name="car" defaultValue={car} maxLength={100} placeholder="예: 쏘나타, SUV" className="site-input" />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="site-label" htmlFor="start_date">빌릴 날짜</label>
          <input id="start_date" name="start_date" type="date" className="site-input" />
        </div>
        <div>
          <label className="site-label" htmlFor="period">이용 기간</label>
          <select id="period" name="period" defaultValue="" className="site-input">
            <option value="">선택 안 함</option>
            {PERIODS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="site-label" htmlFor="message">문의 내용</label>
        <textarea id="message" name="message" rows={4} maxLength={2000} className="site-input h-auto py-3" placeholder="사고 차량 정보, 원하시는 조건 등을 적어 주세요." />
      </div>

      <div className="rounded-xl bg-site-bg p-4 text-sm">
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" name="consent" required className="h-4 w-4 accent-brand" />
          [필수] 개인정보 수집 및 이용에 동의합니다.
        </label>
        <p className="mt-2 text-xs leading-relaxed text-site-ink-2">
          수집 항목: 이름, 연락처, 문의 내용 / 목적: 렌터카 상담 및 계약 안내 / 보유 기간: 상담 완료 후 3개월.
          동의하지 않으실 수 있으나 이 경우 온라인 상담 신청이 어렵습니다.{" "}
          <Link href="/privacy" className="underline">자세히 보기</Link>
        </p>
      </div>

      {state.error && <p className="text-sm font-semibold text-red-600" role="alert">{state.error}</p>}
      <button className="site-btn h-14 w-full text-base" disabled={pending}>{pending ? "접수 중..." : "상담 신청하기"}</button>
    </form>
  );
}
