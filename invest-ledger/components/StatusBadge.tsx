import { statusInfo } from "@/lib/constants";

export default function StatusBadge({ status, overdue }: { status: string; overdue?: boolean }) {
  const s = statusInfo(status);
  return (
    <span className="inline-flex gap-1">
      <span className={`badge ${s.className}`}>{s.label}</span>
      {overdue && status === "active" && <span className="badge bg-red-50 text-red-700 ring-red-200">연체</span>}
    </span>
  );
}
