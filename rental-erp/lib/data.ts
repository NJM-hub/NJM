import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { mergeCalc, type CalcSettings } from "@/lib/calcSettings";
import { q, tx, type Queryable } from "@/lib/db";
import { todayKST } from "@/lib/dates";
import { allocate, buildSnapshot, planCharges, type Snapshot } from "@/lib/engine";
import type {
  Allocation,
  Charge,
  Contract,
  Dataset,
  Deposit,
  Expense,
  Loan,
  LoanTx,
  Owner,
  Payment,
  Property,
  Tenant,
  Unit,
} from "@/lib/types";

export const SCOPE_COOKIE = "rental_scope";

/** 보기 범위: 전체 또는 특정 소유주(개인/법인) */
export async function getScope(): Promise<string | null> {
  const v = (await cookies()).get(SCOPE_COOKIE)?.value;
  return v && /^[0-9a-f-]{36}$/.test(v) ? v : null;
}

export async function getCalcSettings(c?: Queryable): Promise<CalcSettings> {
  const rows = await q<{ value: unknown }>("select value from settings where key = 'calc'", [], c);
  return mergeCalc(rows[0]?.value);
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const rows = await q<{ value: T }>("select value from settings where key = $1", [key]);
  return rows[0]?.value ?? fallback;
}

export async function loadDataset(c?: Queryable): Promise<Dataset> {
  const [owners, properties, units, tenants, contracts, deposits, charges, payments, allocations, loans, loanTxs, expenses] =
    await Promise.all([
      q<Owner>("select * from owners order by owner_type desc, name", [], c),
      q<Property>("select * from properties order by name", [], c),
      q<Unit>("select * from units order by dong nulls first, floor, unit_no", [], c),
      q<Tenant>("select * from tenants order by name", [], c),
      q<Contract>("select * from contracts order by start_date", [], c),
      q<Deposit>("select * from deposits", [], c),
      q<Charge>("select * from rent_charges order by billing_month", [], c),
      q<Payment>("select id, contract_id, charge_id, paid_date, amount, method, memo, created_at::text as created_at from payments order by paid_date", [], c),
      q<Allocation>("select payment_id, charge_id, amount from payment_allocations", [], c),
      q<Loan>("select * from loans order by start_date", [], c),
      q<LoanTx>("select * from loan_transactions order by tx_date", [], c),
      q<Expense>("select * from expenses order by expense_date", [], c),
    ]);
  return { owners, properties, units, tenants, contracts, deposits, charges, payments, allocations, loans, loanTxs, expenses };
}

// ---------------------------------------------------------------------------
// 자동 청구 + 입금 배분
// ---------------------------------------------------------------------------

/** 한 계약의 입금 배분을 다시 계산해 저장 (입금 등록·취소·청구 변경 후 호출) */
export async function reallocateContract(contractId: string, c: Queryable) {
  const charges = await q<Charge>("select * from rent_charges where contract_id = $1", [contractId], c);
  const payments = await q<Payment>(
    "select id, contract_id, charge_id, paid_date, amount, method, memo, created_at::text as created_at from payments where contract_id = $1",
    [contractId],
    c,
  );
  const r = allocate(payments, charges);
  await q("delete from payment_allocations where payment_id in (select id from payments where contract_id = $1)", [contractId], c);
  for (const a of r.allocations) {
    await q("insert into payment_allocations (payment_id, charge_id, amount) values ($1, $2, $3)", [a.payment_id, a.charge_id, a.amount], c);
  }
  for (const ch of charges) {
    const paid = r.paid.get(ch.id) ?? 0;
    if (paid !== ch.paid_amount) await q("update rent_charges set paid_amount = $2 where id = $1", [ch.id, paid], c);
  }
}

/**
 * 매월 월세 청구를 자동 생성한다 (이미 있는 달은 건너뜀).
 * 새 청구가 생긴 계약은 선납금이 있을 수 있으므로 배분을 다시 계산한다.
 */
export async function syncBilling(today = todayKST(), contractIds?: string[]): Promise<number> {
  return tx(async (c) => {
    await c.query("select pg_advisory_xact_lock(727277)");
    const contracts = await q<Contract>(
      contractIds ? "select * from contracts where id = any($1)" : "select * from contracts where status <> 'planned' or start_date <= $1",
      [contractIds ?? today],
      c,
    );
    const existing = await q<{ contract_id: string; billing_month: string }>(
      "select contract_id, billing_month from rent_charges" + (contractIds ? " where contract_id = any($1)" : ""),
      contractIds ? [contractIds] : [],
      c,
    );
    const have = new Set(existing.map((e) => `${e.contract_id}|${e.billing_month}`));
    let created = 0;
    const touched = new Set<string>();
    for (const ct of contracts) {
      for (const pc of planCharges(ct, today)) {
        if (have.has(`${pc.contract_id}|${pc.billing_month}`)) continue;
        await q(
          `insert into rent_charges (contract_id, billing_month, due_date, rent_amount, maintenance_amount, vat_amount, amount)
           values ($1, $2, $3, $4, $5, $6, $7) on conflict (contract_id, billing_month) do nothing`,
          [pc.contract_id, pc.billing_month, pc.due_date, pc.rent_amount, pc.maintenance_amount, pc.vat_amount, pc.amount],
          c,
        );
        created++;
        touched.add(ct.id);
      }
    }
    for (const id of touched) await reallocateContract(id, c);
    return created;
  });
}

let lastSync = { day: "", at: 0 };

/** 화면을 열 때 가볍게 자동 청구 (같은 서버에서는 10분에 한 번) */
async function syncIfStale() {
  const day = todayKST();
  if (lastSync.day === day && Date.now() - lastSync.at < 10 * 60 * 1000) return;
  lastSync = { day, at: Date.now() };
  await syncBilling(day).catch((e) => console.error("[syncBilling]", e));
}

/** 데이터를 바꾼 뒤 다음 화면에서 바로 자동 청구가 돌도록 */
export function invalidateSync() {
  lastSync = { day: "", at: 0 };
}

/** 대시보드 등에서 쓰는 전체 계산 결과 (한 요청 안에서 한 번만) */
export const getSnapshot = cache(async (allOwners: boolean = false): Promise<{ snap: Snapshot; ds: Dataset }> => {
  await syncIfStale();
  const [ds, settings, scope] = await Promise.all([loadDataset(), getCalcSettings(), getScope()]);
  const snap = buildSnapshot(ds, settings, todayKST(), { ownerId: allOwners ? null : scope });
  return { snap, ds };
});
