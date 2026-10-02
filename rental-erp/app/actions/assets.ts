"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/auth";
import { EXPENSE_CATEGORIES, RATE_TYPES, REPAYMENT_TYPES } from "@/lib/constants";
import { getCalcSettings } from "@/lib/data";
import { audit, q, q1, tx } from "@/lib/db";
import { todayKST } from "@/lib/dates";
import { monthlyInterest } from "@/lib/engine";
import { dbError, FormReader } from "@/lib/form";
import type { FormState, Loan } from "@/lib/types";

// ---------------------------------------------------------------------------
// 대출
// ---------------------------------------------------------------------------

export async function saveLoanAction(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const f = new FormReader(fd);
  const id = f.uuid("id");
  const principal = f.money("principal", { required: "대출원금을 입력하세요.", min: 0 });
  const balance = f.money("balance", { min: 0 });
  const vals = [
    f.uuid("property_id", { required: "부동산을 선택하세요." }),
    f.text("lender", { required: "금융기관을 입력하세요." }),
    f.text("product"),
    f.date("start_date"),
    principal,
    balance ?? principal,
    f.number("interest_rate", { required: "금리를 입력하세요.", min: 0, max: 30 }),
    f.choice("rate_type", RATE_TYPES, "variable"),
    f.choice("repayment_type", REPAYMENT_TYPES, "bullet"),
    f.money("monthly_payment", { min: 0 }),
    f.number("interest_day", { min: 1, max: 31, int: true }),
    f.date("maturity_date"),
    f.text("memo"),
  ];
  if (!f.ok) return f.fail();
  let lid = id;
  try {
    if (id) {
      await q(
        `update loans set property_id=$1, lender=$2, product=$3, start_date=$4, principal=$5, balance=$6, interest_rate=$7, rate_type=$8,
           repayment_type=$9, monthly_payment=$10, interest_day=$11, maturity_date=$12, memo=$13, is_closed=$14 where id=$15`,
        [...vals, f.bool("is_closed"), id],
      );
    } else {
      lid = (await q1<{ id: string }>(
        `insert into loans (property_id, lender, product, start_date, principal, balance, interest_rate, rate_type, repayment_type, monthly_payment,
           interest_day, maturity_date, memo) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
        vals,
      ))!.id;
    }
    await audit(a.user.id, id ? "update" : "create", "loan", lid, { lender: vals[1], principal, rate: vals[6] });
  } catch (e) {
    return { error: dbError(e) };
  }
  revalidatePath("/", "layout");
  redirect(`/loans/${lid}?saved=1`);
}

/** 원금 상환 / 이자 납부 / 금리 변경 */
export async function loanTxAction(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const f = new FormReader(fd);
  const loanId = f.uuid("loan_id", { required: "잘못된 요청" });
  const type = f.choice("tx_type", ["principal", "interest", "rate_change"] as const, "principal");
  const date = f.date("tx_date", { required: "날짜를 입력하세요." });
  const amount = type === "rate_change" ? 0 : f.money("amount", { required: "금액을 입력하세요.", min: 1 });
  const newRate = type === "rate_change" ? f.number("new_rate", { required: "새 금리를 입력하세요.", min: 0, max: 30 }) : null;
  if (!f.ok) return f.fail();
  const loan = await q1<Loan>("select * from loans where id = $1", [loanId]);
  if (!loan) return { error: "대출을 찾을 수 없습니다." };
  if (type === "principal" && amount! > loan.balance) return { fieldErrors: { amount: `잔액(${loan.balance.toLocaleString()}원)보다 많습니다.` } };

  let msg = "";
  await tx(async (c) => {
    let expenseId: string | null = null;
    if (type === "principal") {
      await q("update loans set balance = balance - $2, is_closed = (balance - $2 <= 0) where id = $1", [loanId, amount], c);
      msg = `원금 ${amount!.toLocaleString()}원 상환 → 잔액 ${(loan.balance - amount!).toLocaleString()}원`;
    } else if (type === "interest") {
      expenseId = (await q1<{ id: string }>(
        "insert into expenses (property_id, expense_date, category, amount, vendor, loan_id, memo) values ($1,$2,'loan_interest',$3,$4,$5,$6) returning id",
        [loan.property_id, date, amount, loan.lender, loanId, f.text("memo") ?? "대출이자"],
        c,
      ))!.id;
      msg = `이자 ${amount!.toLocaleString()}원 납부 기록 (비용관리에 대출이자로 자동 등록)`;
    } else {
      await q("update loans set interest_rate = $2 where id = $1", [loanId, newRate], c);
      msg = `금리 ${loan.interest_rate}% → ${newRate}% 변경 (월 이자 ${monthlyInterest(loan.balance, newRate!).toLocaleString()}원)`;
    }
    await q(
      "insert into loan_transactions (loan_id, tx_date, tx_type, amount, new_rate, expense_id, memo) values ($1,$2,$3,$4,$5,$6,$7)",
      [loanId, date, type, amount ?? 0, newRate, expenseId, f.text("memo") ?? (type === "rate_change" ? `${loan.interest_rate}% → ${newRate}%` : null)],
      c,
    );
  });
  await audit(a.user.id, type ?? "loan_tx", "loan", loanId, { amount, newRate, date });
  revalidatePath("/", "layout");
  return { ok: msg };
}

export async function deleteLoanTxAction(txId: string): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const t = await q1<{ loan_id: string; tx_type: string; amount: number; expense_id: string | null }>("select * from loan_transactions where id = $1", [txId]);
  if (!t) return { error: "기록이 없습니다." };
  await tx(async (c) => {
    if (t.tx_type === "principal") await q("update loans set balance = balance + $2, is_closed = false where id = $1", [t.loan_id, t.amount], c);
    if (t.expense_id) await q("delete from expenses where id = $1", [t.expense_id], c);
    await q("delete from loan_transactions where id = $1", [txId], c);
  });
  await audit(a.user.id, "delete", "loan_tx", txId, t);
  revalidatePath("/", "layout");
  return { ok: t.tx_type === "principal" ? "취소했습니다. 잔액이 다시 늘었습니다." : "취소했습니다." };
}

export async function deleteLoanAction(id: string): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  await q("delete from loans where id = $1", [id]);
  await audit(a.user.id, "delete", "loan", id);
  revalidatePath("/", "layout");
  redirect("/loans");
}

/** 이번 달 이자를 한 번에 비용으로 기록 (이자 납부일 기준) */
export async function recordMonthInterestAction(): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const today = todayKST();
  const month = today.slice(0, 7);
  const settings = await getCalcSettings();
  const loans = await q<Loan>(
    `select * from loans l where not is_closed and not exists (
       select 1 from loan_transactions t where t.loan_id = l.id and t.tx_type = 'interest' and to_char(t.tx_date, 'YYYY-MM') = $1)`,
    [month],
  );
  let n = 0;
  for (const l of loans) {
    const interest = monthlyInterest(l.balance, l.interest_rate, settings.interestMethod, `${month}-01`);
    if (interest <= 0) continue;
    const day = String(Math.min(l.interest_day ?? 1, 28)).padStart(2, "0");
    await tx(async (c) => {
      const e = await q1<{ id: string }>(
        "insert into expenses (property_id, expense_date, category, amount, vendor, loan_id, memo) values ($1,$2,'loan_interest',$3,$4,$5,'대출이자 (자동 계산)') returning id",
        [l.property_id, `${month}-${day}`, interest, l.lender, l.id],
        c,
      );
      await q("insert into loan_transactions (loan_id, tx_date, tx_type, amount, expense_id, memo) values ($1,$2,'interest',$3,$4,'자동 계산')", [l.id, `${month}-${day}`, interest, e!.id], c);
    });
    n++;
  }
  await audit(a.user.id, "interest_batch", "loan", null, { month, count: n });
  revalidatePath("/", "layout");
  return { ok: n ? `${month} 대출이자 ${n}건을 비용으로 기록했습니다.` : "이번 달 이자는 이미 모두 기록되어 있습니다." };
}

// ---------------------------------------------------------------------------
// 비용
// ---------------------------------------------------------------------------

export async function saveExpenseAction(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const f = new FormReader(fd);
  const id = f.uuid("id");
  const propertyId = f.uuid("property_id");
  const vals = [
    propertyId,
    propertyId ? null : f.uuid("owner_id"),
    f.date("expense_date", { required: "날짜를 입력하세요." }),
    f.choice("category", EXPENSE_CATEGORIES, "etc"),
    f.money("amount", { required: "금액을 입력하세요.", min: 0 }),
    f.text("vendor"),
    f.text("memo"),
  ];
  if (!f.ok) return f.fail();
  if (id) {
    await q("update expenses set property_id=$1, owner_id=$2, expense_date=$3, category=$4, amount=$5, vendor=$6, memo=$7 where id=$8", [...vals, id]);
  } else {
    // 매월 반복: 같은 비용을 n개월치 만들기
    const repeat = Math.min(24, Math.max(1, Number(f.raw("repeat_months") || 1)));
    for (let i = 0; i < repeat; i++) {
      const d = String(vals[2]);
      const [y, m, dd] = d.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1 + i, 1));
      const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
      const day = `${dt.toISOString().slice(0, 8)}${String(Math.min(dd, last)).padStart(2, "0")}`;
      await q("insert into expenses (property_id, owner_id, expense_date, category, amount, vendor, memo) values ($1,$2,$3,$4,$5,$6,$7)", [vals[0], vals[1], day, ...vals.slice(3)]);
    }
  }
  await audit(a.user.id, id ? "update" : "create", "expense", id, { category: vals[3], amount: vals[4] });
  revalidatePath("/", "layout");
  return { ok: id ? "저장했습니다." : "비용을 등록했습니다." };
}

export async function deleteExpenseAction(id: string): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const linked = await q1("select 1 from loan_transactions where expense_id = $1", [id]);
  if (linked) return { error: "대출 이자 납부 기록과 연결된 비용입니다. 대출 화면에서 취소하세요." };
  await q("delete from expenses where id = $1", [id]);
  await audit(a.user.id, "delete", "expense", id);
  revalidatePath("/", "layout");
  return { ok: "삭제했습니다." };
}
