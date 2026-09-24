import type { Metadata } from "next";
import Link from "next/link";
import { telHref } from "@/lib/site/config";
import { FAQ_GROUPS } from "@/lib/site/faq";
import { getSiteInfo } from "@/lib/site/info";

export const metadata: Metadata = { title: "자주 묻는 질문", description: "예약, 요금, 보험, 차량 인수·반납에 대해 자주 묻는 질문입니다." };

export default async function FaqPage() {
  const info = await getSiteInfo();
  return (
    <>
      <section className="border-b border-site-line bg-site-bg">
        <div className="site-container py-10 sm:py-14">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">자주 묻는 질문</h1>
          <p className="mt-2 text-site-ink-2">궁금한 점을 먼저 확인해 보세요.</p>
          <nav className="mt-6 flex flex-wrap gap-2">
            {FAQ_GROUPS.map((g, i) => (
              <a key={g.title} href={`#faq-${i}`} className="rounded-full border border-site-line bg-white px-4 py-1.5 text-sm font-semibold hover:border-site-ink">{g.title}</a>
            ))}
          </nav>
        </div>
      </section>
      <div className="site-container max-w-3xl py-10">
        {FAQ_GROUPS.map((g, i) => (
          <section key={g.title} id={`faq-${i}`} className="mb-12 scroll-mt-24">
            <h2 className="mb-3 text-xl font-bold">{g.title}</h2>
            <div className="divide-y divide-site-line border-y border-site-line">
              {g.items.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
                    <span><span className="mr-2 text-brand">Q.</span>{f.q}</span>
                    <span className="text-xl text-site-gray transition group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-site-ink-2">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
        <div className="rounded-2xl bg-site-bg p-6 text-center">
          <p className="font-bold">원하시는 답을 찾지 못하셨나요?</p>
          <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
            <Link href="/contact" className="site-btn">상담 신청</Link>
            {info.phone && <a href={telHref(info.phone)} className="site-btn site-btn--line">전화 {info.phone}</a>}
          </div>
        </div>
      </div>
    </>
  );
}
