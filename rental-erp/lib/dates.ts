// 날짜는 모두 'YYYY-MM-DD' 문자열로 다룬다 (한국 시간 기준). 시간대 때문에 하루씩 밀리는 문제를 막기 위함.

export type ISODate = string;

/** 오늘 (한국 시간) */
export function todayKST(now: Date = new Date()): ISODate {
  const k = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return k.toISOString().slice(0, 10);
}

export function parts(d: ISODate): [number, number, number] {
  const [y, m, dd] = d.split("-").map(Number);
  return [y, m, dd];
}

export function fmtISO(y: number, m: number, d: number): ISODate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function toUTC(d: ISODate): number {
  const [y, m, dd] = parts(d);
  return Date.UTC(y, m - 1, dd);
}

/** b - a (일) */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}

export function addDays(d: ISODate, n: number): ISODate {
  return new Date(toUTC(d) + n * 86400000).toISOString().slice(0, 10);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 그 달 1일 */
export function monthStart(d: ISODate): ISODate {
  const [y, m] = parts(d);
  return fmtISO(y, m, 1);
}

export function monthEnd(d: ISODate): ISODate {
  const [y, m] = parts(d);
  return fmtISO(y, m, daysInMonth(y, m));
}

/** n 개월 뒤 같은 달의 1일 */
export function addMonths(month: ISODate, n: number): ISODate {
  const [y, m] = parts(month);
  const idx = y * 12 + (m - 1) + n;
  return fmtISO(Math.floor(idx / 12), (idx % 12) + 1, 1);
}

/** n 개월 뒤 같은 날 (말일 보정). 계약기간 계산용 */
export function addMonthsKeepDay(d: ISODate, n: number): ISODate {
  const [y, m, dd] = parts(d);
  const first = addMonths(fmtISO(y, m, 1), n);
  const [ny, nm] = parts(first);
  return fmtISO(ny, nm, Math.min(dd, daysInMonth(ny, nm)));
}

/** 'YYYY-MM' */
export function ym(d: ISODate): string {
  return d.slice(0, 7);
}

/** 그 달의 납부일 (31일인데 30일까지 있는 달은 말일) */
export function dueDateOf(month: ISODate, payDay: number): ISODate {
  const [y, m] = parts(month);
  return fmtISO(y, m, Math.min(Math.max(1, payDay), daysInMonth(y, m)));
}

/** 두 날짜 사이의 개월 수 (계약기간 표시용, 대략) */
export function monthsBetween(a: ISODate, b: ISODate): number {
  const [y1, m1, d1] = parts(a);
  const [y2, m2, d2] = parts(addDays(b, 1));
  return (y2 - y1) * 12 + (m2 - m1) + (d2 >= d1 ? 0 : -1);
}

export function isISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = parts(s);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function monthLabel(month: ISODate): string {
  const [y, m] = parts(month);
  return `${y}년 ${m}월`;
}

export function shortMonthLabel(month: ISODate): string {
  return `${parts(month)[1]}월`;
}

export function fmtDate(d: ISODate | null | undefined): string {
  return d ? d.replaceAll("-", ".") : "-";
}
