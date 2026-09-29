/** 100000000 → "100,000,000원" */
export function won(n: number | string | null | undefined): string {
  return `${Math.round(Number(n ?? 0)).toLocaleString("ko-KR")}원`;
}

/** 100000000 → "100,000,000" (입력칸용) */
export function comma(n: number | string | null | undefined): string {
  const v = String(n ?? "").replace(/[^\d]/g, "");
  return v ? Number(v).toLocaleString("ko-KR") : "";
}

/** "100,000,000" → 100000000 (쉼표·원·₩ 제거). 숫자가 없으면 NaN */
export function parseMoney(s: string | null | undefined): number {
  const v = String(s ?? "").replace(/[,\s원₩]/g, "");
  return /^\d+$/.test(v) ? Number(v) : NaN;
}

/** 58.3333 → "58.33%" */
export function pct(n: number | string | null | undefined): string {
  return `${Number(n ?? 0).toFixed(2)}%`;
}

/** "2026-09-29" → "2026.09.29" */
export function ymd(d: string | null | undefined): string {
  return d ? d.replaceAll("-", ".") : "-";
}

/** 시각 → "2026.09.29 17:18" (한국 시간) */
export function dateTime(ts: string | null | undefined): string {
  if (!ts) return "-";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]),
  );
  return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}`;
}
