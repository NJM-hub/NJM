"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { APP_NAME } from "@/lib/brand";

type NavItem = { href: string; label: string; ready: boolean; admin?: boolean };

export type ShellUser = { name: string; email: string; roleLabel: string; isAdmin: boolean };

// ready: false 인 메뉴는 이후 단계에서 열립니다
const NAV: NavItem[] = [
  { href: "/", label: "대시보드", ready: true },
  { href: "/investments", label: "투자 목록", ready: true },
  { href: "/investments/new", label: "투자 등록", ready: true },
  { href: "/overview", label: "전체 현황", ready: true },
  { href: "/stats", label: "월별 통계", ready: true },
  { href: "/customers", label: "고객 관리", ready: true },
  { href: "/users", label: "사용자 관리", ready: true, admin: true },
  { href: "/backup", label: "백업", ready: true, admin: true },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/investments") return pathname.startsWith("/investments") && pathname !== "/investments/new";
  return pathname.startsWith(href);
}

function NavLinks({ onNavigate, isAdmin }: { onNavigate?: () => void; isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.filter((item) => !item.admin || isAdmin).map((item) =>
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
      <span className="text-base font-bold tracking-tight">{APP_NAME}</span>
    </Link>
  );
}

function UserBox({ user, logout, onNavigate }: { user: ShellUser; logout: () => Promise<void>; onNavigate?: () => void }) {
  return (
    <div className="rounded-lg bg-white/5 p-3 text-sm">
      <div className="truncate font-semibold text-white">{user.name || user.email}</div>
      <div className="truncate text-xs text-navy-200">{user.roleLabel} · {user.email}</div>
      <div className="mt-2 flex gap-2 text-xs">
        <Link href="/account" onClick={onNavigate} className="rounded-md px-2 py-1 text-navy-100 ring-1 ring-white/20 hover:bg-white/10">내 계정</Link>
        <form action={logout}>
          <button type="submit" className="rounded-md px-2 py-1 text-navy-100 ring-1 ring-white/20 hover:bg-white/10">로그아웃</button>
        </form>
      </div>
    </div>
  );
}

export default function AppShell({
  children,
  user,
  logout,
}: {
  children: React.ReactNode;
  user: ShellUser;
  logout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      {/* PC: 왼쪽 메뉴 */}
      <aside className="hidden w-60 shrink-0 bg-navy-900 px-4 py-6 lg:block">
        <div className="sticky top-6 flex h-[calc(100vh-3rem)] flex-col gap-8">
          <Brand />
          <NavLinks isAdmin={user.isAdmin} />
          <div className="mt-auto">
            <UserBox user={user} logout={logout} />
          </div>
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
          <div className="space-y-3 border-t border-white/10 px-4 pb-4 pt-2">
            <NavLinks onNavigate={() => setOpen(false)} isAdmin={user.isAdmin} />
            <UserBox user={user} logout={logout} onNavigate={() => setOpen(false)} />
          </div>
        )}
      </header>

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
