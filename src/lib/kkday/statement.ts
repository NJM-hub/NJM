/**
 * KKday 정산내역서(CSV/엑셀) → 예약번호별 최종 정산 금액.
 * 한 예약이 "예약 성립", "취소 환불", "부분 환불" 여러 줄로 나오므로 금액을 모두 더한다.
 * 금액은 부가세 포함 (Amount in Local Currency, 없으면 Transaction Amount).
 */
export type StatementBooking = { bookingNo: string; amount: number; lines: number; serviceDate: string | null; status: string | null };

type Cell = string | number | Date | boolean | null | undefined;

const norm = (c: Cell) => String(c ?? "").replace(/^﻿/, "").trim();

export function parseKkdayStatement(rows: Cell[][]): StatementBooking[] {
  const h = rows.findIndex((r) => r.some((c) => norm(c) === "예약번호") && r.some((c) => /Amount/i.test(norm(c))));
  if (h < 0) throw new Error("KKday 정산내역서 형식이 아닙니다 (예약번호·Amount 열이 없습니다).");
  const head = rows[h].map(norm);
  const col = (...names: string[]) => names.map((n) => head.indexOf(n)).find((i) => i >= 0) ?? -1;
  const no = col("예약번호");
  const amt = col("Amount in Local Currency", "Transaction Amount");
  const date = col("출발날짜");
  const status = col("주문 상태");

  const by = new Map<string, StatementBooking>();
  for (const r of rows.slice(h + 1)) {
    const bookingNo = norm(r[no]);
    const raw = norm(r[amt]).replace(/,/g, "");
    if (!bookingNo || raw === "" || !Number.isFinite(Number(raw))) continue;
    const b = by.get(bookingNo) ?? { bookingNo, amount: 0, lines: 0, serviceDate: null, status: null };
    by.set(bookingNo, b);
    b.amount += Number(raw);
    b.lines++;
    b.serviceDate ??= norm(r[date]).match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
    b.status = norm(r[status]) || b.status;
  }
  return [...by.values()].map((b) => ({ ...b, amount: Math.round(b.amount) }));
}

/** 부가세(10%) 뺀 금액: 60,000 → 54,545 */
export const withoutVat = (amount: number) => Math.round(amount / 1.1);
