export default function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "navy" | "danger" | "success";
}) {
  const tones = {
    default: "bg-white border-slate-200 text-navy-900",
    navy: "bg-navy-900 border-navy-900 text-white",
    danger: "bg-red-50 border-red-200 text-red-700",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  } as const;
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className={`text-xs font-medium ${tone === "navy" ? "text-navy-200" : "text-slate-500"}`}>{label}</div>
      <div className="mt-1 whitespace-nowrap text-[15px] font-bold tabular-nums sm:text-lg xl:text-xl">{value}</div>
      {sub && <div className={`mt-0.5 text-xs ${tone === "navy" ? "text-navy-200" : "text-slate-500"}`}>{sub}</div>}
    </div>
  );
}
