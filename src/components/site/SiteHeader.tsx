"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { telHref, type SiteInfo } from "@/lib/site/config";
import { SERVICES } from "@/lib/site/services";
import { AccountLink } from "./AccountLink";
import { FavoriteCount, HeartIcon } from "./FavoriteButton";

const LINKS = [
  { href: "/events", label: "이벤트" },
  ...SERVICES.map((s) => ({ href: s.href, label: s.name })),
  { href: "/about", label: "브랜드소개" },
];

export function SiteHeader({ info }: { info: SiteInfo }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => path === href || path.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-30 border-b border-site-line bg-white/95 backdrop-blur">
      <div className="site-container flex h-16 items-center gap-6 lg:h-[72px]">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-site-ink" onClick={() => setOpen(false)}>
          {info.name}
        </Link>
        <nav className="hidden flex-1 items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 text-[15px] font-semibold hover:text-brand ${active(l.href) ? "text-brand" : "text-site-ink"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/favorites" className="relative p-2 text-site-ink hover:text-brand" aria-label="찜한 차량" onClick={() => setOpen(false)}>
            <HeartIcon size={22} />
            <FavoriteCount />
          </Link>
          <AccountLink className="hidden text-sm font-semibold text-site-ink-2 hover:text-site-ink lg:inline" />
          {info.phone && <a href={telHref(info.phone)} className="hidden text-[15px] font-bold text-site-ink lg:inline">{info.phone}</a>}
          <Link href="/contact" className="site-btn site-btn--sm hidden lg:inline-flex">상담 신청</Link>
          <button
            type="button"
            className="-mr-2 p-2 lg:hidden"
            aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-site-line bg-white lg:hidden">
          <div className="site-container flex flex-col py-2">
            {[...LINKS, { href: "/faq", label: "자주 묻는 질문" }].map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="border-b border-site-line py-3.5 text-base font-semibold last:border-0">
                {l.label}
              </Link>
            ))}
            <div className="my-3 grid grid-cols-2 gap-2">
              <AccountLink onClick={() => setOpen(false)} className="site-btn site-btn--line" />
              <Link href="/contact" onClick={() => setOpen(false)} className="site-btn">상담 신청</Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
