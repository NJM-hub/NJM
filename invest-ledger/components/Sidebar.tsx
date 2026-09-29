"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = { href: string; label: string; stage?: number };

// stage 가 적힌 메뉴는 아직 개발 전 단계입니다. (해당 단계에서 열림)
const NAV: NavItem[] = [
  { href: "/", label: "대시보드" },
  { href: "/investments", label: "투자 목록" },
  { href: "/investments/new", label: "투자 등록" },
  { href: "/customers", label: "고객 관리", stage: 4 },
  { href: "/stats/monthly", label: "월별 통계", stage: 3 },
  { href: "/stats/overview", label: "전체 현황", stage: 3 },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/investments") return pathname === "/investments" || /^\/investments\/(?!new)/.test(pathname);
  return pathname.startsWith(href);
}

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((item) =>
        item.stage ? (
          <span
            key={item.href}
            className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-navy-300"
            title={`${item.stage}단계에서 추가됩니다`}
          >
            {item.label}
            <span className="rounded bg-navy-800 px-1.5 py-0.5 text-[10px]">준비중</span>
          </span>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              isActive(pathname, item.href) ? "bg-white text-navy-900" : "text-navy-100 hover:bg-navy-800"
            }`}
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );

  return (
    <>
      {/* 휴대폰: 상단 바 + 펼침 메뉴 */}
      <header className="sticky top-0 z-20 bg-navy-900 text-white md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/" className="font-bold tracking-tight">
            투자 장부
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-navy-700 px-3 py-1.5 text-sm"
            aria-expanded={open}
          >
            {open ? "닫기" : "메뉴"}
          </button>
        </div>
        {open && <div className="border-t border-navy-800">{links}</div>}
      </header>

      {/* PC: 왼쪽 고정 메뉴 */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 bg-navy-900 text-white md:block">
        <div className="border-b border-navy-800 px-5 py-5">
          <Link href="/" className="text-lg font-bold tracking-tight">
            투자 장부
          </Link>
          <p className="mt-0.5 text-xs text-navy-300">투자 실행 · 회수 관리</p>
        </div>
        {links}
      </aside>
    </>
  );
}
