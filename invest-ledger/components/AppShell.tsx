"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = { href: string; label: string; ready: boolean };

// ready: false 인 메뉴는 이후 단계에서 열립니다
const NAV: NavItem[] = [
  { href: "/", label: "홈", ready: true },
  { href: "/investments", label: "투자 목록", ready: true },
  { href: "/investments/new", label: "투자 등록", ready: true },
  { href: "/customers", label: "고객 관리", ready: false },
  { href: "/stats", label: "월별 통계", ready: false },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/investments") return pathname.startsWith("/investments") && pathname !== "/investments/new";
  return pathname.startsWith(href);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) =>
        item.ready ? (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive(pathname, item.href) ? "bg-white/15 text-white" : "text-navy-200 hover:bg-white/10 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        ) : (
          <span key={item.href} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-navy-300/60">
            {item.label}
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">준비중</span>
          </span>
        ),
      )}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 text-white">
      <span className="grid size-8 place-items-center rounded-lg bg-white text-sm font-black text-navy-900">₩</span>
      <span className="text-base font-bold tracking-tight">투자 회수 장부</span>
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      {/* PC: 왼쪽 메뉴 */}
      <aside className="hidden w-60 shrink-0 bg-navy-900 px-4 py-6 lg:block">
        <div className="sticky top-6 flex flex-col gap-8">
          <Brand />
          <NavLinks />
        </div>
      </aside>

      {/* 휴대폰: 위쪽 바 + 펼침 메뉴 */}
      <header className="sticky top-0 z-30 bg-navy-900 lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Brand />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white ring-1 ring-white/20"
            aria-expanded={open}
          >
            {open ? "닫기" : "메뉴"}
          </button>
        </div>
        {open && (
          <div className="border-t border-white/10 px-4 pb-4 pt-2">
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
        )}
      </header>

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
