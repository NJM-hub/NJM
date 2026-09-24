import Link from "next/link";
import { TAGLINE, telHref, type SiteInfo } from "@/lib/site/config";
import { SERVICES } from "@/lib/site/services";

export function SiteFooter({ info }: { info: SiteInfo }) {
  const biz = [
    info.legalName && `상호: ${info.legalName}`,
    info.ceo && `대표: ${info.ceo}`,
    info.brn && `사업자등록번호: ${info.brn}`,
  ].filter(Boolean) as string[];

  return (
    <footer className="bg-site-dark pb-24 text-sm text-gray-400 lg:pb-0">
      <div className="site-container grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="text-lg font-extrabold text-white">{info.name}</p>
          <p className="mt-1 text-gray-300">{TAGLINE}</p>
          {info.phone && <a href={telHref(info.phone)} className="mt-3 block text-3xl font-extrabold text-white">{info.phone}</a>}
          <p className="mt-1">{info.hours} · {info.accidentHours}</p>
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
            <li><Link href="/faq" className="hover:text-white">자주 묻는 질문</Link></li>
            <li><Link href="/events" className="hover:text-white">이벤트</Link></li>
            <li><Link href="/cars" className="hover:text-white">전체 차량</Link></li>
            <li><Link href="/favorites" className="hover:text-white">찜한 차량</Link></li>
            <li><Link href="/login" className="hover:text-white">직원 로그인</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="site-container space-y-1 py-6 text-xs leading-relaxed">
          {biz.length > 0 && <p>{biz.join("  |  ")}</p>}
          {info.address && <p>주소: {info.address}</p>}
          {info.privacyOfficer && <p>개인정보관리책임자: {info.privacyOfficer}{info.email && ` (${info.email})`}</p>}
          <p className="pt-2">
            <Link href="/privacy" className="font-bold text-gray-300 hover:text-white">개인정보처리방침</Link>
          </p>
          <p className="pt-2">© {new Date().getFullYear()} {info.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
