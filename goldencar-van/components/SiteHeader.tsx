"use client";

import { useEffect, useState } from "react";
import { navItems } from "@/components/nav";
import { PhoneIcon } from "@/components/Icons";

export default function SiteHeader({ brand, phoneHref }: { brand: string; phoneHref: string | null }) {
  const [open, setOpen] = useState(false);

  // 메뉴가 열린 채로 화면이 넓어지면 닫기
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const close = () => mq.matches && setOpen(false);
    mq.addEventListener("change", close);
    return () => mq.removeEventListener("change", close);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-ink-900/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <a href="#top" className="flex items-baseline gap-2 text-white" onClick={() => setOpen(false)}>
          <span className="text-xl font-extrabold tracking-wide text-gold-300">{brand.toUpperCase()}</span>
          <span className="hidden text-xs tracking-[0.2em] text-white/60 sm:inline">VAN RENTAL</span>
        </a>

        <nav aria-label="주요 메뉴" className="hidden md:block">
          <ul className="flex items-center gap-7 text-sm font-medium text-white/80">
            {navItems.map((n) => (
              <li key={n.href}>
                <a href={n.href} className="transition hover:text-gold-300">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={phoneHref ?? "#reserve"}
            className="hidden items-center gap-1.5 rounded-full bg-gold-400 px-4 py-2 text-sm font-bold text-ink-900 hover:bg-gold-300 md:inline-flex"
          >
            <PhoneIcon className="h-4 w-4" />
            전화 상담
          </a>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-white md:hidden"
            aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" aria-label="모바일 메뉴" className="border-t border-white/10 bg-ink-900 md:hidden">
          <ul className="container-page py-2">
            {navItems.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  className="block border-b border-white/5 py-3.5 text-base font-medium text-white/90 last:border-0"
                  onClick={() => setOpen(false)}
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
