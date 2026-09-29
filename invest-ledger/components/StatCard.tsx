type Props = {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "navy" | "red" | "green";
};

const TONES = {
  default: "bg-white border-slate-200 text-navy-900",
  navy: "bg-navy-900 border-navy-900 text-white",
  red: "bg-white border-red-200 text-red-700",
  green: "bg-white border-emerald-200 text-emerald-700",
};

export default function StatCard({ label, value, sub, tone = "default" }: Props) {
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${TONES[tone]}`}>
      <p className={`text-xs font-medium ${tone === "navy" ? "text-navy-200" : "text-slate-500"}`}>{label}</p>
      <p className="mt-1.5 text-lg font-bold tracking-tight break-all md:text-xl">{value}</p>
      {sub && <p className={`mt-1 text-xs ${tone === "navy" ? "text-navy-200" : "text-slate-500"}`}>{sub}</p>}
    </div>
  );
}
