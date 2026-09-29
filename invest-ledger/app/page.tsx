import Link from "next/link";
import EnvNotice from "@/components/EnvNotice";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { won, ymd } from "@/lib/format";
import { missingEnv } from "@/lib/env";
import { listInvestments } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const missing = missingEnv();
  if (missing.length) return <EnvNotice missing={missing} />;

  const rows = await listInvestments();
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((acc, r) => acc + Number(f(r)), 0);
  const active = rows.filter((r) => r.status === "active");
  const completed = rows.filter((r) => r.status === "completed");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">대시보드</h1>
        <Link href="/investments/new" className="btn">
          + 투자 등록
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="총 투자 실행금액" value={won(sum((r) => r.principal))} tone="navy" />
        <StatCard label="총 회수 예정금액" value={won(sum((r) => r.expected_total))} />
        <StatCard label="총 회수 완료금액" value={won(sum((r) => r.paid_total))} tone="green" />
        <StatCard label="총 미회수금액" value={won(sum((r) => r.remaining_amount))} />
        <StatCard label="진행 중인 투자" value={`${active.length.toLocaleString("ko-KR")}건`} sub={won(sum((r) => (r.status === "active" ? r.principal : 0)))} />
        <StatCard label="종료된 투자" value={`${completed.length.toLocaleString("ko-KR")}건`} />
      </div>

      <div className="card border-dashed text-sm text-slate-500">
        오늘/내일/7일 이내 받을 금액, 연체 현황, 만기 알림은 <b>3단계</b>에서 이 화면에 추가됩니다.
      </div>

      <div className="card p-0">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="card-title mb-0">최근 등록한 투자</h2>
          <Link href="/investments" className="text-sm text-navy-600 hover:underline">
            전체 보기 →
          </Link>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 pb-8 text-sm text-slate-500">아직 등록된 투자가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.slice(0, 5).map((r) => (
              <li key={r.id}>
                <Link href={`/investments/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-navy-50/50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy-900">{r.target_name}</p>
                    <p className="text-xs text-slate-500">
                      {ymd(r.executed_on)} · {r.customer_name}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm tabular-nums">{won(r.principal)}</span>
                    <StatusBadge status={r.status} overdue={r.overdue_amount > 0} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
