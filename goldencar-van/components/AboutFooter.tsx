import Link from "next/link";
import { site } from "@/content/site";

export function AboutSection() {
  return (
    <section id="about" className="section bg-ink-900 text-white">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div>
          <p className="eyebrow">About</p>
          <h2 className="section-title">회사 소개</h2>
          <p className="mt-6 text-lg leading-relaxed text-white/80">{site.about}</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {[
            ["합리적인 가격", "스타리아 하이브리드 하루 8만원, 쏠라티 하루 20만원"],
            ["간편한 예약", "양식·전화·카카오톡 중 편한 방법으로 문의"],
            ["믿을 수 있는 대여", "대여 조건을 미리 안내해 드립니다"],
          ].map(([t, d]) => (
            <li key={t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="font-bold text-gold-300">{t}</p>
              <p className="mt-1 text-sm text-white/70">{d}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function SiteFooter() {
  const b = site.business;
  const c = site.contact;
  const rows: [string, string][] = (
    [
      ["상호", b.name],
      ["대표자", b.ceo],
      ["사업자등록번호", b.registrationNumber],
      ["주소", b.address],
      ["전화", c.phone],
      ["이메일", c.email],
      ["상담 시간", c.hours],
    ] as [string, string][]
  ).filter(([, v]) => v);

  return (
    <footer className="border-t border-white/10 bg-black pt-12 pb-28 text-sm text-white/60 md:pb-12">
      <div className="container-page">
        <p className="text-lg font-extrabold tracking-wide text-gold-300">{site.brand.toUpperCase()}</p>
        {rows.length > 0 && (
          <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5">
            {rows.map(([k, v]) => (
              <div key={k} className="flex gap-1.5">
                <dt className="text-white/40">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <nav aria-label="약관" className="mt-6 flex gap-5">
          <Link href="/privacy" className="font-semibold text-white/80 hover:text-gold-300">개인정보처리방침</Link>
          <Link href="/terms" className="hover:text-gold-300">이용약관</Link>
        </nav>
        <p className="mt-6 text-white/40">© {new Date().getFullYear()} {site.brand}. All rights reserved.</p>
      </div>
    </footer>
  );
}
