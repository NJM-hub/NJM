// 금액·날짜·비율 표시 형식

const wonFormatter = new Intl.NumberFormat("ko-KR");

/** 100000000 → "100,000,000원" */
export function won(value: number | string | null | undefined): string {
  return `${wonFormatter.format(Number(value ?? 0))}원`;
}

/** 100000000 → "100,000,000" (입력칸 표시용) */
export function withComma(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(String(value).replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? wonFormatter.format(n) : "";
}

/** "100,000,000원" → 100000000 (숫자가 아니면 NaN) */
export function parseAmount(text: string | null | undefined): number {
  const digits = String(text ?? "").replace(/[,\s원₩]/g, "");
  if (!/^\d+$/.test(digits)) return NaN;
  return Number(digits);
}

/** 58.3333 → "58.33%" */
export function percent(value: number | string | null | undefined, digits = 2): string {
  return `${Number(value ?? 0).toFixed(digits)}%`;
}

/** 수익률 표시: 20 → "20%", 12.5 → "12.5%" */
export function rate(value: number | string | null | undefined): string {
  return `${Number(value ?? 0).toString()}%`;
}

/** "2026-09-29" → "2026.09.29" */
export function ymd(date: string | null | undefined): string {
  return date ? date.slice(0, 10).replaceAll("-", ".") : "-";
}
