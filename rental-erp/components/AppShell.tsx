"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setScopeAction } from "@/app/actions/scope";

const NAV = [
  { href: "/", label: "대시보드", icon: "🏠" },
  { href: "/properties", label: "부동산", icon: "🏢" },
  { href: "/tenants", label: "임차인", icon: "👤" },
  { href: "/contracts", label: "계약관리", icon: "📄" },
  { href: "/payments", label: "월세/입금", icon: "💰" },
  { href: "/arrears", label: "미납관리", icon: "🔴" },
  { href: "/loans", label: "대출관리", icon: "🏦" },
  { href: "/analysis", label: "수익분석", icon: "📊" },
  { href: "/expenses", label: "비용관리", icon: "💳" },
  { href: "/documents", label: "문서관리", icon: "📁" },
  { href: "/reports", label: "통계/리포트", icon: "📈" },
  { href: "/settings", label: "설정", icon: "⚙️" },
];

type Props = {
  appName: string;
  user: { name: string; email: string; roleLabel: string; isAdmin: boolean };
  owners: { id: string; name: string }[];
  scope: string | null;
  logout: () => Promise<void>;
  children: React.ReactNode;
};

export default function AppShell({ appName, user, owners, scope, logout, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  // 다른 화면으로 이동하면 휴대폰 메뉴 닫기
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  const scopeSelect = owners.length > 0 && (
    <select
      aria-label="보기 범위"
      className="input !w-auto max-w-[11rem] !py-1.5 text-[13px]"
      value={scope ?? ""}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        start(async () => {
          await setScopeAction(v);
          router.refresh();
        });
      }}
    >
      <option value="">전체 통합</option>
      {owners.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] font-medium transition ${
            active(n.href) ? "bg-white/12 text-white" : "text-navy-200 hover:bg-white/6 hover:text-white"
          }`}
        >
          <span className="w-5 text-center text-[15px]" aria-hidden>
            {n.icon}
          </span>
          {n.label}
        </Link>
      ))}
      <Link
        href="/assistant"
        className={`mt-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] font-medium ${
          active("/assistant") ? "bg-white/12 text-white" : "text-navy-200 hover:bg-white/6 hover:text-white"
        }`}
      >
        <span className="w-5 text-center" aria-hidden>
          ✨
        </span>
        AI 질문
      </Link>
    </nav>
  );

  const userBox = (
    <div className="border-t border-white/10 pt-3 text-[13px]">
      <div className="px-3 font-semibold text-white">{user.name}</div>
      <div className="px-3 text-navy-300">
        {user.roleLabel} · {user.email}
      </div>
      <div className="mt-2 flex gap-1 px-1">
        <Link href="/account" className="rounded-md px-2 py-1 text-navy-200 hover:bg-white/10 hover:text-white">
          내 계정
        </Link>
        <form action={logout}>
          <button className="rounded-md px-2 py-1 text-navy-200 hover:bg-white/10 hover:text-white">로그아웃</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-60">
      {/* PC 왼쪽 메뉴 */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col justify-between bg-navy-900 p-3 lg:flex">
        <div>
          <Link href="/" className="mb-5 flex items-center gap-2 px-3 pt-2 text-[17px] font-extrabold tracking-tight text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-sm">R</span>
            {appName}
          </Link>
          {nav}
        </div>
        {userBox}
      </aside>

      {/* 휴대폰 메뉴 */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="메뉴 닫기" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col justify-between overflow-y-auto bg-navy-900 p-3">
            <div>
              <div className="mb-4 px-3 pt-2 text-[17px] font-extrabold text-white">{appName}</div>
              {nav}
            </div>
            {userBox}
          </aside>
        </div>
      )}

      {/* 위쪽 바 */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200/70 bg-white/90 px-3 py-2 backdrop-blur sm:px-5">
        <button aria-label="메뉴" className="rounded-lg p-2 text-xl text-navy-800 lg:hidden" onClick={() => setOpen(true)}>
          ☰
        </button>
        <form action="/search" className="flex min-w-0 flex-1 items-center">
          <input
            name="q"
            className="input max-w-md !rounded-full !bg-slate-50 !py-1.5"
            placeholder="🔍 임차인·전화번호·주소·건물명·호실·계약번호"
            aria-label="검색"
          />
        </form>
        {scopeSelect}
      </header>

      <main className="mx-auto max-w-[1400px] px-3 py-4 pb-16 sm:px-5 sm:py-6">{children}</main>
    </div>
  );
}
