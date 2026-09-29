export const SCHEDULE_STATES = {
  paid: { label: "완납", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  partial: { label: "일부 입금", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  overdue: { label: "연체", className: "bg-red-50 text-red-700 ring-red-200" },
  due_today: { label: "오늘 예정", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  scheduled: { label: "예정", className: "bg-slate-50 text-slate-600 ring-slate-200" },
} as const;
