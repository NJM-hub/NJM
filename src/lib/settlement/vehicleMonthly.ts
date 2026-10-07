/**
 * 차량별 월정산: 확정된 배차를 차량 → 날짜별로 픽업/샌딩 건수와 금액으로 묶는다.
 * 기존 엑셀 정산(차량별 시트) 방식:
 *   금액 합계 = 회사 배차 건별 금액 합 (전부 지급)
 *   외부오더(기사 자체 콜)의 −금액은 지급에서 빼지 않고 "별도 수금"으로 따로 모은다 (나중에 기사에게 받음)
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
  /** 정산에 직접 추가한 항목이면 그 출처 (TALIXO, 기타 등) */
  manualSource?: string | null;
  /** 시트에 적힌 그날 실제 운행 기사 (차량을 빌려 운행한 경우 차량 담당 기사와 다를 수 있음) */
  operator?: string | null;
  /** 따로 정산할 기사 (빈 값 = 차량 담당 기사). 같은 차량이라도 이 값이 다르면 정산을 나눈다 */
  settleOperator?: string;
  /** 예약 id (배차 건만) */
  bookingId?: string | null;
};

export type DayCount = {
  pickup: number; sending: number; other: number; own: number;
  /** 지급 대상 금액 (외부오더 제외) */
  amount: number;
  /** 외부오더 금액 합 (음수, 지급에서 빼지 않고 별도 수금) */
  ownAmount: number;
};

export type VehicleMonth = {
  /** 정산 단위 키: 차량 id, 다른 기사가 운행한 건은 "차량 id~기사" */
  key: string;
  vehicleId: string;
  /** 따로 정산하는 운행 기사 (빈 값 = 차량 담당 기사) */
  operator: string;
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

/** 자체 콜 기본 정산 금액: 시트에 금액(전세 80000 등)이 적혀 있으면 −그 금액, 없으면 −차감액 */
export function ownCallAmount(fare: number | null | undefined, ownCallFee: number): number {
  return fare && fare > 0 ? -fare : -ownCallFee;
}

export function tripKind(tripType: string | null): TripKind {
  if (/샌딩|送机|送機|sending|drop/i.test(tripType ?? "")) return "sending";
  if (/픽업|接机|接機|pick/i.test(tripType ?? "")) return "pickup";
  return "other";
}

/** 엑셀 정산표의 "인아웃" 표기 */
export function inOutLabel(r: Pick<VehicleMonthRow, "tripType" | "source" | "manualSource">): string {
  if (r.source === OWN_CALL) return "외부오더";
  const k = tripKind(r.tripType);
  return k === "pickup" ? "픽업" : k === "sending" ? "샌딩" : r.tripType ?? r.manualSource ?? "기타";
}

const empty = (): DayCount => ({ pickup: 0, sending: 0, other: 0, own: 0, amount: 0, ownAmount: 0 });

/** 차량번호 뒤 4자리 순으로 (예: 9661, 9754, 9755 …) */
const plateKey = (p: string) => p.replace(/\D/g, "").slice(-4).padStart(4, "0") + p;

/**
 * 같은 차량을 여러 기사가 운행했으면 기사별로 정산을 나눈다.
 * 차량 담당 기사(차량에 등록된 기사 이름)의 건과 기사 칸이 없는 건은 기본(빈 값),
 * 그 외 운행 기사는 그 이름으로 따로. 차량에 기사 이름이 없으면 가장 많이 운행한 기사가 기본.
 */
export function assignSettleOperators(rows: VehicleMonthRow[]) {
  const byVehicle = new Map<string, VehicleMonthRow[]>();
  for (const r of rows) byVehicle.set(r.vehicleId, [...(byVehicle.get(r.vehicleId) ?? []), r]);
  for (const list of byVehicle.values()) {
    let main = list.find((r) => r.driverName)?.driverName ?? null;
    if (!main) {
      const counts = new Map<string, number>();
      for (const r of list) if (r.operator) counts.set(r.operator, (counts.get(r.operator) ?? 0) + 1);
      main = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    }
    for (const r of list) {
      const other = r.operator && r.operator !== main;
      r.settleOperator = other ? r.operator! : "";
      r.driverName = other ? r.operator! : main;
    }
  }
}

/** 정산 단위 키 (URL·선택 값에 쓴다) */
export const settleKey = (vehicleId: string, operator = "") => (operator ? `${vehicleId}~${operator}` : vehicleId);

export function summarizeVehicleMonth(rows: VehicleMonthRow[]): VehicleMonth[] {
  const byVehicle = new Map<string, { info: VehicleMonthRow; days: Map<string, DayCount>; rows: VehicleMonthRow[] }>();
  for (const r of rows) {
    const key = settleKey(r.vehicleId, r.settleOperator);
    const v = byVehicle.get(key) ?? { info: r, days: new Map<string, DayCount>(), rows: [] as VehicleMonthRow[] };
    byVehicle.set(key, v);
    v.rows.push(r);
    if (!v.info.driverName && r.driverName) v.info = r;
    const d = v.days.get(r.serviceDate) ?? empty();
    v.days.set(r.serviceDate, d);
    if (r.source === OWN_CALL) {
      d.own++;
      d.ownAmount += r.amount ?? 0;
      continue;
    }
    // 직접 추가한 가감 항목(픽업/샌딩이 아닌 것)은 운행 건수에 넣지 않고 금액만 더한다
    if (!(r.manualSource && tripKind(r.tripType) === "other")) d[tripKind(r.tripType)]++;
    d.amount += r.amount ?? 0;
  }

  return [...byVehicle.values()]
    .map(({ info, days, rows: list }) => {
      const dayList = [...days].sort((a, b) => a[0].localeCompare(b[0])).map(([date, c]) => ({ date, ...c }));
      const total = dayList.reduce(
        (t, d) => ({
          pickup: t.pickup + d.pickup, sending: t.sending + d.sending, other: t.other + d.other,
          own: t.own + d.own, amount: t.amount + d.amount, ownAmount: t.ownAmount + d.ownAmount,
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
      const operator = info.settleOperator ?? "";
      return { key: settleKey(info.vehicleId, operator), vehicleId: info.vehicleId, operator, plate: info.plate, driverName: info.driverName, days: dayList, total, rows: sorted };
    })
    // 차량번호 순, 같은 차량은 담당 기사 먼저
    .sort((a, b) => plateKey(a.plate).localeCompare(plateKey(b.plate)) || Number(!!a.operator) - Number(!!b.operator) || a.operator.localeCompare(b.operator));
}

export type Payout = { amount: number; expenses: number; diff: number; tax: number; incomeTax: number; localTax: number; pay: number };

/** 금액 합계 − 비용 = 차액, 차액에서 원천세(소득세+지방소득세)를 떼고 지급 */
export function computePayout(amount: number, ex: Expenses | null, opts: WithholdingOptions): Payout {
  const expenses = ex ? ex.fuel + ex.fines + ex.tolls + ex.engine_oil + ex.other : 0;
  const diff = amount - expenses;
  const w = computeWithholding(Math.max(0, diff), opts);
  return { amount, expenses, diff, tax: w.totalTax, incomeTax: w.incomeTax, localTax: w.localTax, pay: diff - w.totalTax };
}

export type OperatorSummary = { name: string; calls: number; pickup: number; sending: number; own: number; amount: number; ownAmount: number };

/**
 * 같은 차량번호 안에서 운행 기사별로 나눈다 (차량을 빌려 운행한 기사 구분).
 * 시트에 운행 기사가 없는 건(직접 추가 항목 등)은 차량 담당 기사로 본다.
 */
export function summarizeOperators(rows: VehicleMonthRow[], vehicleDriver: string | null): OperatorSummary[] {
  const by = new Map<string, OperatorSummary>();
  for (const r of rows) {
    const name = r.operator ?? vehicleDriver ?? "(기사 미상)";
    const o = by.get(name) ?? { name, calls: 0, pickup: 0, sending: 0, own: 0, amount: 0, ownAmount: 0 };
    by.set(name, o);
    if (r.source === OWN_CALL) {
      o.own++;
      o.ownAmount += r.amount ?? 0;
      continue;
    }
    const k = tripKind(r.tripType);
    if (k === "pickup") o.pickup++;
    if (k === "sending") o.sending++;
    if (!(r.manualSource && k === "other")) o.calls++;
    o.amount += r.amount ?? 0;
  }
  // 담당 기사 먼저, 나머지는 건수 많은 순
  return [...by.values()].sort(
    (a, b) => Number(b.name === vehicleDriver) - Number(a.name === vehicleDriver) || b.calls + b.own - (a.calls + a.own),
  );
}
