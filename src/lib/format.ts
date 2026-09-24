const TZ = "Asia/Seoul";

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: TZ, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

export function won(n: number | null | undefined): string {
  return `${(n ?? 0).toLocaleString("ko-KR")}원`;
}

/** 오늘 날짜 (KST) YYYY-MM-DD */
export function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function isDate(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function isMonth(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** KKday 여정 유형 → 짧은 표시 (픽업: 공항 → 도심, 샌딩: 도심 → 공항) */
export function tripLabel(tripType: string | null | undefined): { label: string; className: string } | null {
  if (!tripType) return null;
  if (/샌딩|sending|drop/i.test(tripType)) return { label: "샌딩", className: "bg-emerald-100 text-emerald-800" };
  if (/픽업|pick/i.test(tripType)) return { label: "픽업", className: "bg-sky-100 text-sky-800" };
  return { label: tripType, className: "bg-gray-100 text-gray-700" };
}
