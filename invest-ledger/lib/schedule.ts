import { addDays } from "@/lib/dates";

export type PlannedRow = { seq: number; dueDate: string; amount: number };

/** 날짜에 n개월 더하기 (31일 → 다음 달 말일처럼 없는 날은 말일로 맞춤) */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/**
 * 회수 예정일 목록.
 * 각 회차는 "구간의 마지막 날"에 받는다. 마지막 회차는 항상 만기일.
 *  - 일일: 시작일, 다음날 … 만기일
 *  - 7일/10일: 시작일 + 6일(또는 9일), 그 다음 7일(10일)마다 … 만기일
 *  - 월: 시작일 + 1개월 - 1일, … 만기일
 *  - 만기 일시: 만기일 하루
 */
export function dueDates(startOn: string, maturityOn: string, method: string): string[] {
  if (maturityOn < startOn) return [];
  if (method === "bullet") return [maturityOn];

  const out: string[] = [];
  for (let i = 1; i <= 3700; i++) {
    let d: string;
    if (method === "monthly") d = addDays(addMonths(startOn, i), -1);
    else {
      const step = method === "every7" ? 7 : method === "every10" ? 10 : 1;
      d = addDays(startOn, step * i - 1);
    }
    if (d >= maturityOn) {
      out.push(maturityOn);
      break;
    }
    out.push(d);
  }
  return out;
}

/** 총액을 회차 수로 나눠 원 단위로 배분. 나머지는 마지막 회차에 더한다 */
export function splitAmount(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const rows = Array.from({ length: count }, () => base);
  rows[count - 1] += total - base * count;
  return rows;
}

export function buildSchedule(input: {
  startOn: string;
  maturityOn: string;
  method: string;
  total: number;
}): PlannedRow[] {
  const dates = dueDates(input.startOn, input.maturityOn, input.method);
  const amounts = splitAmount(input.total, dates.length);
  return dates.map((dueDate, i) => ({ seq: i + 1, dueDate, amount: amounts[i] }));
}

export type UnpaidSchedule = { id: string; due_date: string; seq: number; unpaid_amount: number };
export type Allocation = { scheduleId: string | null; amount: number };

/**
 * 입금액 자동 배분: 가장 오래된 미회수 회차부터 채운다.
 * 모든 회차를 채우고도 남으면 회차 없는 입금(scheduleId=null)으로 남긴다.
 */
export function allocatePayment(unpaid: UnpaidSchedule[], amount: number): Allocation[] {
  const sorted = [...unpaid]
    .filter((s) => s.unpaid_amount > 0)
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.seq - b.seq);
  const out: Allocation[] = [];
  let left = amount;
  for (const s of sorted) {
    if (left <= 0) break;
    const take = Math.min(left, s.unpaid_amount);
    out.push({ scheduleId: s.id, amount: take });
    left -= take;
  }
  if (left > 0) out.push({ scheduleId: null, amount: left });
  return out;
}

/** 회차 수 요약 (화면 안내용): "100회 · 1회 1,200,000원" 처럼 */
export function scheduleCount(startOn: string, maturityOn: string, method: string): number {
  return dueDates(startOn, maturityOn, method).length;
}

