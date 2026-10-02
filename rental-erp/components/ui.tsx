// 화면 공통 조각 (서버 컴포넌트)
import Link from "next/link";

export type Tone = "red" | "orange" | "yellow" | "green" | "blue" | "gray";

export function Badge({ tone = "gray", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}

export function PageHeader({ title, desc, actions }: { title: string; desc?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-5">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-tight text-navy-950 sm:text-2xl">{title}</h1>
        {desc && <p className="mt-1 text-sm text-slate-500">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const toneText: Record<Tone, string> = {
  red: "text-red-600",
  orange: "text-orange-600",
  yellow: "text-amber-600",
  green: "text-emerald-600",
  blue: "text-navy-800",
  gray: "text-slate-900",
};

/** 큰 숫자 카드 */
export function StatCard({
  icon,
  label,
  value,
  sub,
  tone = "gray",
  href,
}: {
  icon?: string;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <div className="card card-body h-full transition hover:shadow-md">
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-500">
        {icon && <span aria-hidden>{icon}</span>}
        {label}
      </div>
      <div className={`mt-1.5 text-2xl font-extrabold tracking-tight tabular-nums sm:text-[28px] ${toneText[tone]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Card({ title, actions, children, className = "" }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card card-body ${className}`}>
      {(title || actions) && (
        <div className="card-title">
          <span>{title}</span>
          {actions && <span className="flex items-center gap-2 text-sm font-normal">{actions}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">{children}</p>;
}

/** ?tab= 으로 바뀌는 탭 */
export function Tabs({ tabs, active, base }: { tabs: { key: string; label: string; count?: number }[]; active: string; base: string }) {
  return (
    <div className="-mx-3 mb-4 overflow-x-auto px-3 sm:mx-0 sm:px-0">
      <div className="flex w-max gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`${base}${base.includes("?") ? "&" : "?"}tab=${t.key}`}
            scroll={false}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
              active === t.key ? "bg-white text-navy-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
            {t.count != null && <span className="ml-1 text-xs text-slate-400">{t.count}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** 라벨: 값 목록 */
export function InfoGrid({ items, cols = 3 }: { items: [string, React.ReactNode][]; cols?: 2 | 3 | 4 }) {
  const c = cols === 2 ? "sm:grid-cols-2" : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3";
  return (
    <dl className={`grid grid-cols-2 gap-x-4 gap-y-3 ${c}`}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-slate-500">{k}</dt>
          <dd className="mt-0.5 truncate text-sm font-semibold text-slate-900 tabular-nums">{v ?? "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:-mx-5">
      <table className="table">{children}</table>
    </div>
  );
}

export function Notice({ tone = "blue", children }: { tone?: Tone; children: React.ReactNode }) {
  return <div className={`rounded-xl px-4 py-3 text-sm ring-1 ring-inset tone-${tone}`}>{children}</div>;
}
