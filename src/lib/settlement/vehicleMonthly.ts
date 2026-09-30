/**
 * 차량별 월정산: 확정된 배차를 차량 → 날짜별로 픽업/샌딩 건수와 금액으로 묶는다.
 * 기존 엑셀 정산(차량별 시트) 방식:
 *   금액 합계 = 건별 금액 합 (외부오더 = 기사 자체 콜은 건당 차감액만큼 마이너스)
 *   차액 = 금액 합계 − 비용(주유·과태료·통행료·엔진오일·기타)
 *   지급액 = 차액 − 원천세(3.3%)
 */
import { computeWithholding, type WithholdingOptions } from "@/lib/tax";

export type VehicleMonthRow = {
  /** dispatch_assignments.id */
  id: string;
  serviceDate: string;
  vehicleId: string;
  plate: string;
  driverName: string | null;
  tripType: string | null;
  source: string | null;
  /** 정산 금액 (자체 콜은 음수) */
  amount: number;
  bookingNo?: string | null;
  flightNo?: string | null;
  pickupAt?: string | null;
  vehicleClass?: string | null;
  pax?: number | null;
  memo?: string | null;
  /** 금액을 손으로 고쳤는지 */
  edited?: boolean;
};

export type DayCount = { pickup: number; sending: number; other: number; own: number; amount: number };

export type VehicleMonth = {
  vehicleId: string;
  plate: string;
  driverName: string | null;
  days: ({ date: string } & DayCount)[];
  total: DayCount & { calls: number; workDays: number };
  rows: VehicleMonthRow[];
};

export type Expenses = { fuel: number; fines: number; tolls: number; engine_oil: number; other: number; memo?: string | null };

export const EXPENSE_LABELS: Record<Exclude<keyof Expenses, "memo">, string> = {
  fuel: "주유",
  fines: "과태료",
  tolls: "통행료",
  engine_oil: "엔진오일",
  other: "기타",
};

export type TripKind = "pickup" | "sending" | "other";

export const OWN_CALL = "driver_own";

export function tripKind(tripType: string | null): TripKind {
  if (/샌딩|sending|drop/i.test(tripType ?? "")) return "sending";
  if (/픽업|pick/i.test(tripType ?? "")) return "pickup";
  return "other";
}

/** 엑셀 정산표의 "인아웃" 표기 */
export function inOutLabel(r: Pick<VehicleMonthRow, "tripType" | "source">): string {
  if (r.source === OWN_CALL) return "외부오더";
  const k = tripKind(r.tripType);
  return k === "pickup" ? "픽업" : k === "sending" ? "샌딩" : r.tripType ?? "기타";
}

const empty = (): DayCount => ({ pickup: 0, sending: 0, other: 0, own: 0, amount: 0 });

/** 차량번호 뒤 4자리 순으로 (예: 9661, 9754, 9755 …) */
const plateKey = (p: string) => p.replace(/\D/g, "").slice(-4).padStart(4, "0") + p;

export function summarizeVehicleMonth(rows: VehicleMonthRow[]): VehicleMonth[] {
  const byVehicle = new Map<string, { info: VehicleMonthRow; days: Map<string, DayCount>; rows: VehicleMonthRow[] }>();
  for (const r of rows) {
    const v = byVehicle.get(r.vehicleId) ?? { info: r, days: new Map<string, DayCount>(), rows: [] as VehicleMonthRow[] };
    byVehicle.set(r.vehicleId, v);
    v.rows.push(r);
    if (!v.info.driverName && r.driverName) v.info = r;
    const d = v.days.get(r.serviceDate) ?? empty();
    v.days.set(r.serviceDate, d);
    if (r.source === OWN_CALL) d.own++;
    else d[tripKind(r.tripType)]++;
    d.amount += r.amount ?? 0;
  }

  return [...byVehicle.values()]
    .map(({ info, days, rows: list }) => {
      const dayList = [...days].sort((a, b) => a[0].localeCompare(b[0])).map(([date, c]) => ({ date, ...c }));
      const total = dayList.reduce(
        (t, d) => ({
          pickup: t.pickup + d.pickup, sending: t.sending + d.sending, other: t.other + d.other,
          own: t.own + d.own, amount: t.amount + d.amount,
          calls: t.calls + d.pickup + d.sending + d.other,
          workDays: t.workDays + 1,
        }),
        { ...empty(), calls: 0, workDays: 0 },
      );
      // 건별 내역: 회사 콜을 날짜·시간순으로, 외부오더는 엑셀처럼 맨 아래에
      const sorted = [...list].sort(
        (a, b) =>
          Number(a.source === OWN_CALL) - Number(b.source === OWN_CALL) ||
          (a.pickupAt ?? a.serviceDate).localeCompare(b.pickupAt ?? b.serviceDate),
      );
      return { vehicleId: info.vehicleId, plate: info.plate, driverName: info.driverName, days: dayList, total, rows: sorted };
    })
    .sort((a, b) => plateKey(a.plate).localeCompare(plateKey(b.plate)));
}

export type Payout = { amount: number; expenses: number; diff: number; tax: number; incomeTax: number; localTax: number; pay: number };

/** 금액 합계 − 비용 = 차액, 차액에서 원천세(소득세+지방소득세)를 떼고 지급 */
export function computePayout(amount: number, ex: Expenses | null, opts: WithholdingOptions): Payout {
  const expenses = ex ? ex.fuel + ex.fines + ex.tolls + ex.engine_oil + ex.other : 0;
  const diff = amount - expenses;
  const w = computeWithholding(Math.max(0, diff), opts);
  return { amount, expenses, diff, tax: w.totalTax, incomeTax: w.incomeTax, localTax: w.localTax, pay: diff - w.totalTax };
}
