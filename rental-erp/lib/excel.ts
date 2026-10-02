// 엑셀 내보내기 / 가져오기 공통 정의.
// 내보낸 파일의 머리글(열 이름)을 그대로 가져오기에 쓸 수 있도록 같은 정의를 공유한다.
import {
  EXPENSE_CATEGORIES,
  OWNER_TYPES,
  PAYMENT_METHODS,
  PROPERTY_TYPES,
  RATE_TYPES,
  REPAYMENT_TYPES,
  label,
} from "@/lib/constants";
import { fmtISO, isISODate } from "@/lib/dates";
import { effectiveStatus, type Snapshot } from "@/lib/engine";
import { EFFECTIVE_STATUS } from "@/lib/constants";
import { parseMoney } from "@/lib/format";
import type { Dataset } from "@/lib/types";

export type ColType = "text" | "money" | "date" | "number" | "pct";
export type Col = { title: string; type?: ColType; width?: number };
export type SheetDef = { name: string; cols: Col[]; rows: (string | number | null | undefined)[][] };

export const EXPORT_KINDS = {
  properties: "부동산·호실 목록",
  tenants: "임차인 목록",
  contracts: "계약 목록",
  payments: "월세 입금내역",
  charges: "월별 청구내역",
  arrears: "미납내역",
  loans: "대출내역",
  expenses: "비용내역",
  monthly: "월별 손익",
  all: "전체 (모든 시트)",
} as const;
export type ExportKind = keyof typeof EXPORT_KINDS;

export const IMPORT_KINDS = {
  properties: "부동산·호실",
  tenants: "임차인",
  contracts: "계약",
  payments: "입금",
  loans: "대출",
  expenses: "비용",
} as const;
export type ImportKind = keyof typeof IMPORT_KINDS;

// 열 정의 (가져오기에서 같은 이름으로 찾는다) ----------------------------------
export const COLS = {
  properties: [
    { title: "소유주", width: 14 },
    { title: "소유구분", width: 8 },
    { title: "부동산명", width: 20 },
    { title: "주소", width: 30 },
    { title: "건물명", width: 14 },
    { title: "종류", width: 8 },
    { title: "매입일", type: "date", width: 12 },
    { title: "매입가격", type: "money", width: 16 },
    { title: "현재예상가", type: "money", width: 16 },
    { title: "취득비용", type: "money", width: 14 },
    { title: "리모델링비용", type: "money", width: 14 },
    { title: "기타투자금", type: "money", width: 14 },
    { title: "동", width: 6 },
    { title: "층", width: 6 },
    { title: "호실", width: 8 },
    { title: "면적(㎡)", type: "number", width: 9 },
    { title: "예상보증금", type: "money", width: 14 },
    { title: "예상월세", type: "money", width: 12 },
    { title: "공실시작일", type: "date", width: 12 },
    { title: "현재 임차인", width: 14 },
    { title: "현재 월세", type: "money", width: 12 },
  ],
  tenants: [
    { title: "이름", width: 18 },
    { title: "연락처", width: 15 },
    { title: "사업자등록번호", width: 15 },
    { title: "이메일", width: 20 },
    { title: "메모", width: 24 },
    { title: "계약 수", type: "number", width: 8 },
    { title: "미납액", type: "money", width: 12 },
  ],
  contracts: [
    { title: "계약번호", width: 14 },
    { title: "부동산명", width: 18 },
    { title: "동", width: 6 },
    { title: "호실", width: 8 },
    { title: "임차인", width: 16 },
    { title: "연락처", width: 15 },
    { title: "임대인", width: 14 },
    { title: "계약일", type: "date", width: 12 },
    { title: "시작일", type: "date", width: 12 },
    { title: "종료일", type: "date", width: 12 },
    { title: "보증금", type: "money", width: 14 },
    { title: "월세", type: "money", width: 12 },
    { title: "관리비", type: "money", width: 10 },
    { title: "부가세", type: "money", width: 10 },
    { title: "납부일", type: "number", width: 7 },
    { title: "청구시작월", type: "date", width: 12 },
    { title: "상태", width: 10 },
    { title: "특약사항", width: 30 },
  ],
  payments: [
    { title: "입금일", type: "date", width: 12 },
    { title: "계약번호", width: 14 },
    { title: "부동산명", width: 18 },
    { title: "호실", width: 8 },
    { title: "임차인", width: 16 },
    { title: "청구월", width: 9 },
    { title: "입금액", type: "money", width: 14 },
    { title: "입금방법", width: 12 },
    { title: "메모", width: 24 },
  ],
  charges: [
    { title: "청구월", width: 9 },
    { title: "납부일", type: "date", width: 12 },
    { title: "부동산명", width: 18 },
    { title: "호실", width: 8 },
    { title: "임차인", width: 16 },
    { title: "청구액", type: "money", width: 14 },
    { title: "입금액", type: "money", width: 14 },
    { title: "미납", type: "money", width: 14 },
  ],
  arrears: [
    { title: "임차인", width: 16 },
    { title: "연락처", width: 15 },
    { title: "부동산명", width: 18 },
    { title: "호실", width: 8 },
    { title: "청구월", width: 9 },
    { title: "납부일", type: "date", width: 12 },
    { title: "청구액", type: "money", width: 12 },
    { title: "입금액", type: "money", width: 12 },
    { title: "미납액", type: "money", width: 12 },
    { title: "미납일수", type: "number", width: 9 },
  ],
  loans: [
    { title: "부동산명", width: 18 },
    { title: "금융기관", width: 14 },
    { title: "대출상품", width: 16 },
    { title: "실행일", type: "date", width: 12 },
    { title: "대출원금", type: "money", width: 16 },
    { title: "현재잔액", type: "money", width: 16 },
    { title: "금리(%)", type: "pct", width: 8 },
    { title: "금리구분", width: 9 },
    { title: "상환방식", width: 14 },
    { title: "월상환금", type: "money", width: 12 },
    { title: "이자납부일", type: "number", width: 9 },
    { title: "만기일", type: "date", width: 12 },
    { title: "월이자", type: "money", width: 12 },
  ],
  expenses: [
    { title: "일자", type: "date", width: 12 },
    { title: "부동산명", width: 18 },
    { title: "구분", width: 10 },
    { title: "금액", type: "money", width: 14 },
    { title: "거래처", width: 14 },
    { title: "메모", width: 24 },
  ],
  monthly: [
    { title: "월", width: 9 },
    { title: "청구액", type: "money", width: 14 },
    { title: "입금액", type: "money", width: 14 },
    { title: "운영비", type: "money", width: 14 },
    { title: "대출이자", type: "money", width: 14 },
    { title: "순현금흐름", type: "money", width: 14 },
    { title: "월말 미수금", type: "money", width: 14 },
    { title: "대출잔액", type: "money", width: 16 },
    { title: "공실률(%)", type: "pct", width: 9 },
  ],
} satisfies Record<string, Col[]>;

/** 계산 결과 → 시트 */
export function buildSheets(kind: ExportKind, ds: Dataset, s: Snapshot): SheetDef[] {
  const prop = new Map(ds.properties.map((p) => [p.id, p]));
  const unit = new Map(ds.units.map((u) => [u.id, u]));
  const tenant = new Map(ds.tenants.map((t) => [t.id, t]));
  const owner = new Map(ds.owners.map((o) => [o.id, o]));
  const contract = new Map(ds.contracts.map((c) => [c.id, c]));
  const chargeById = new Map(ds.charges.map((c) => [c.id, c]));
  const scopeProps = new Set(s.properties.map((p) => p.property.id));
  const inScopeUnit = (uid: string) => scopeProps.has(unit.get(uid)?.property_id ?? "");
  const where = (cid: string) => {
    const c = contract.get(cid);
    const u = c ? unit.get(c.unit_id) : undefined;
    return { c, u, p: u ? prop.get(u.property_id) : undefined, t: c ? tenant.get(c.tenant_id) : undefined };
  };

  const make = (k: Exclude<ExportKind, "all">): SheetDef => {
    switch (k) {
      case "properties":
        return {
          name: "부동산·호실",
          cols: COLS.properties,
          rows: s.units.map((v) => {
            const p = v.property;
            const o = p.owner_id ? owner.get(p.owner_id) : undefined;
            return [
              o?.name, o ? label(OWNER_TYPES, o.owner_type) : null, p.name, p.address, p.building_name, label(PROPERTY_TYPES, p.property_type),
              p.purchase_date, p.purchase_price, p.current_value, p.acquisition_cost, p.remodeling_cost, p.other_investment,
              v.unit.dong, v.unit.floor, v.unit.unit_no, v.unit.area_m2, v.unit.expected_deposit, v.unit.expected_rent,
              v.unit.vacant_since, v.tenant?.name ?? (v.occupied ? null : "(공실)"), v.contract?.monthly_rent,
            ];
          }),
        };
      case "tenants":
        return {
          name: "임차인",
          cols: COLS.tenants,
          rows: ds.tenants.map((t) => {
            const cs = ds.contracts.filter((c) => c.tenant_id === t.id);
            const unpaid = s.arrears.filter((a) => a.contract.tenant_id === t.id).reduce((x, a) => x + a.total, 0);
            return [t.name, t.phone, t.biz_no, t.email, t.memo, cs.length, unpaid];
          }),
        };
      case "contracts":
        return {
          name: "계약",
          cols: COLS.contracts,
          rows: ds.contracts.filter((c) => inScopeUnit(c.unit_id)).map((c) => {
            const { u, p, t } = where(c.id);
            return [
              c.contract_no, p?.name, u?.dong, u?.unit_no, t?.name, t?.phone, c.landlord_name, c.contract_date, c.start_date, c.end_date,
              c.deposit, c.monthly_rent, c.maintenance_fee, c.vat_amount, c.pay_day, c.billing_from,
              EFFECTIVE_STATUS[effectiveStatus(c, s.today)], c.special_terms,
            ];
          }),
        };
      case "payments":
        return {
          name: "입금내역",
          cols: COLS.payments,
          rows: ds.payments.filter((x) => inScopeUnit(contract.get(x.contract_id)?.unit_id ?? "")).map((x) => {
            const { c, u, p, t } = where(x.contract_id);
            const ch = x.charge_id ? chargeById.get(x.charge_id) : undefined;
            return [x.paid_date, c?.contract_no, p?.name, u?.unit_no, t?.name, ch?.billing_month.slice(0, 7), x.amount, label(PAYMENT_METHODS, x.method), x.memo];
          }),
        };
      case "charges":
        return {
          name: "청구내역",
          cols: COLS.charges,
          rows: ds.charges.filter((x) => inScopeUnit(contract.get(x.contract_id)?.unit_id ?? "")).map((x) => {
            const { u, p, t } = where(x.contract_id);
            return [x.billing_month.slice(0, 7), x.due_date, p?.name, u?.unit_no, t?.name, x.amount, x.paid_amount, x.amount - x.paid_amount];
          }),
        };
      case "arrears":
        return {
          name: "미납내역",
          cols: COLS.arrears,
          rows: s.arrears.flatMap((a) =>
            a.charges.map((x) => [
              a.tenant?.name, a.tenant?.phone, a.property?.name, a.unit?.unit_no, x.charge.billing_month.slice(0, 7), x.charge.due_date,
              x.charge.amount, x.charge.paid_amount, x.unpaid, x.days,
            ]),
          ),
        };
      case "loans":
        return {
          name: "대출",
          cols: COLS.loans,
          rows: ds.loans.filter((l) => scopeProps.has(l.property_id)).map((l) => [
            prop.get(l.property_id)?.name, l.lender, l.product, l.start_date, l.principal, l.balance, l.interest_rate,
            label(RATE_TYPES, l.rate_type), label(REPAYMENT_TYPES, l.repayment_type), l.monthly_payment, l.interest_day, l.maturity_date,
            Math.round((l.balance * l.interest_rate) / 100 / 12),
          ]),
        };
      case "expenses":
        return {
          name: "비용",
          cols: COLS.expenses,
          rows: ds.expenses
            .filter((e) => !e.property_id || scopeProps.has(e.property_id))
            .map((e) => [e.expense_date, e.property_id ? prop.get(e.property_id)?.name : "(공통)", label(EXPENSE_CATEGORIES, e.category), e.amount, e.vendor, e.memo]),
        };
      case "monthly":
        return {
          name: "월별 손익",
          cols: COLS.monthly,
          rows: s.monthly.map((m) => [m.month.slice(0, 7), m.billed, m.collected, m.expenses, m.interest, m.net, m.outstanding, m.loanBalance, Number(m.vacancyRate.toFixed(1))]),
        };
    }
  };
  if (kind === "all") return (Object.keys(EXPORT_KINDS).filter((k) => k !== "all") as Exclude<ExportKind, "all">[]).map(make);
  return [make(kind)];
}

// ---------------------------------------------------------------------------
// 가져오기: 셀 값 정리
// ---------------------------------------------------------------------------

export type Cell = string | number | boolean | Date | null | undefined;

export function cellText(v: Cell): string | null {
  if (v == null) return null;
  if (v instanceof Date) return cellDate(v);
  const s = String(v).trim();
  return s ? s : null;
}

export function cellMoney(v: Cell): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Math.round(v);
  return parseMoney(String(v));
}

export function cellNumber(v: Cell): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** 날짜: Date, 엑셀 일련번호, '2026.01.05' / '2026-1-5' / '2026/01/05' / '2026-01'(월) */
export function cellDate(v: Cell): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
    return null;
  }
  const m = String(v).trim().match(/^(\d{4})[.\-/년\s]+(\d{1,2})(?:[.\-/월\s]+(\d{1,2}))?/);
  if (!m) return null;
  const iso = fmtISO(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : 1);
  return isISODate(iso) ? iso : null;
}

/** '상가' → 'commercial' (한글 이름 또는 영문 코드 모두 허용) */
export function reverseLabel<T extends Record<string, string>>(map: T, v: Cell): keyof T | null {
  const s = cellText(v);
  if (!s) return null;
  if (s in map) return s as keyof T;
  const hit = (Object.entries(map) as [keyof T, string][]).find(([, l]) => l === s || l.replace(/\s/g, "") === s.replace(/\s/g, ""));
  return hit ? hit[0] : null;
}

/** 시트 → 머리글 이름으로 된 객체 목록 (머리글 줄은 처음 10줄 안에서 찾는다) */
export function sheetObjects(data: Cell[][], cols: Col[]): Record<string, Cell>[] {
  const titles = cols.map((c) => c.title);
  let headerRow = -1;
  let best = 0;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const hits = (data[i] ?? []).filter((x) => titles.includes(String(x ?? "").trim())).length;
    if (hits > best) {
      best = hits;
      headerRow = i;
    }
  }
  if (headerRow < 0 || best < 2) return [];
  const header = data[headerRow].map((x) => String(x ?? "").trim());
  return data
    .slice(headerRow + 1)
    .filter((r) => r && r.some((x) => x != null && String(x).trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] as Cell])));
}
