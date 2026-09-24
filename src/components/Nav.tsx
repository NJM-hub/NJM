import Link from "next/link";

export function Nav({ links, email, title }: { links: { href: string; label: string }[]; email: string; title: string }) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-blue-700">{title}</Link>
        <nav className="flex flex-wrap gap-1 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-md px-3 py-1.5 text-gray-700 hover:bg-gray-100">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm text-gray-500">
          <span className="hidden sm:inline">{email}</span>
          <form action="/auth/signout" method="post">
            <button className="btn-secondary !px-3 !py-1.5">로그아웃</button>
          </form>
        </div>
      </div>
    </header>
  );
}
