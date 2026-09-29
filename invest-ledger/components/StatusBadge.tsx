import { INVESTMENT_STATUSES, type InvestmentStatus } from "@/lib/constants";

const COLORS: Record<InvestmentStatus, string> = {
  active: "bg-navy-100 text-navy-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-200 text-slate-600",
};

export default function StatusBadge({ status, overdue }: { status: InvestmentStatus; overdue?: boolean }) {
  return (
    <span className="inline-flex gap-1">
      <span className={`badge ${COLORS[status]}`}>{INVESTMENT_STATUSES[status]}</span>
      {overdue && <span className="badge bg-red-100 text-red-700">연체</span>}
    </span>
  );
}
