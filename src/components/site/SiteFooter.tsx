import Link from "next/link";
import { SITE, telHref } from "@/lib/site/config";
import { SERVICES } from "@/lib/site/services";

export function SiteFooter() {
  return (
    <footer className="bg-site-dark pb-24 text-sm text-gray-400 lg:pb-0">
      <div className="site-container grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="text-gray-300">{SITE.tagline} 전문</p>
          <a href={telHref(SITE.phone)} className="mt-2 block text-3xl font-extrabold text-white">{SITE.phone}</a>
          <p className="mt-1">{SITE.hours} · {SITE.accidentHours}</p>
        </div>
        <div>
          <p className="mb-3 font-bold text-white">서비스</p>
          <ul className="space-y-2">
            <li><Link href="/about" className="hover:text-white">브랜드소개</Link></li>
            {SERVICES.map((s) => (
              <li key={s.key}><Link href={s.href} className="hover:text-white">{s.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 font-bold text-white">고객센터</p>
          <ul className="space-y-2">
            <li><Link href="/contact" className="hover:text-white">상담 신청</Link></li>
            <li><Link href="/cars" className="hover:text-white">전체 차량</Link></li>
            <li><Link href="/login" className="hover:text-white">직원 로그인</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="site-container space-y-1 py-6 text-xs leading-relaxed">
          <p>
            상호: {SITE.legalName} <span className="mx-1.5">|</span> 대표: {SITE.ceo} <span className="mx-1.5">|</span> 사업자등록번호: {SITE.brn}
          </p>
          <p>주소: {SITE.address}</p>
          {SITE.privacyOfficer && (
            <p>개인정보관리책임자: {SITE.privacyOfficer}{SITE.email && ` (${SITE.email})`}</p>
          )}
          <p className="pt-2">
            <Link href="/privacy" className="font-bold text-gray-300 hover:text-white">개인정보처리방침</Link>
          </p>
          <p className="pt-2">© {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
