"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/auth";
import { CONTRACT_STATUS, PAYMENT_METHODS } from "@/lib/constants";
import { invalidateSync, pinPayments, reallocateContract, syncBilling } from "@/lib/data";
import { audit, q, q1, tx } from "@/lib/db";
import { addDays, dueDateOf, monthStart, todayKST } from "@/lib/dates";
import { dbError, FormReader } from "@/lib/form";
import { nextContractNo } from "@/lib/importer";
import type { Contract, FormState } from "@/lib/types";

// ---------------------------------------------------------------------------
// 임차인
// ---------------------------------------------------------------------------

export async function saveTenantAction(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("staff");
  if ("denied" in a) return a.denied;
  const f = new FormReader(fd);
  const id = f.uuid("id");
  const vals = [
    f.text("name", { required: "이름(상호)을 입력하세요.", max: 100 }),
    f.text("phone"),
    f.text("biz_no"),
    f.text("email"),
    f.text("memo"),
  ];
  if (!f.ok) return f.fail();
  let tid = id;
  if (id) {
    await q("update tenants set name=$1, phone=$2, biz_no=$3, email=$4, memo=$5 where id=$6", [...vals, id]);
  } else {
    tid = (await q1<{ id: string }>("insert into tenants (name, phone, biz_no, email, memo) values ($1,$2,$3,$4,$5) returning id", vals))!.id;
  }
  await audit(a.user.id, id ? "update" : "create", "tenant", tid, { name: vals[0] });
  revalidatePath("/tenants");
  redirect(`/tenants/${tid}`);
}

export async function deleteTenantAction(id: string): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  try {
    await q("delete from tenants where id = $1", [id]);
  } catch (e) {
    return { error: dbError(e) };
  }
  await audit(a.user.id, "delete", "tenant", id);
  revalidatePath("/tenants");
  redirect("/tenants");
}

// ---------------------------------------------------------------------------
// 계약
// ---------------------------------------------------------------------------

export async function saveContractAction(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("staff");
  if ("denied" in a) return a.denied;
  const f = new FormReader(fd);
  const id = f.uuid("id");
  const unitId = f.uuid("unit_id", { required: "부동산/호실을 선택하세요." });
  let tenantId = f.uuid("tenant_id");
  const newTenant = f.text("new_tenant_name");
  if (!tenantId && !newTenant) f.errors.tenant_id = "임차인을 선택하거나 새 임차인 이름을 입력하세요.";
  const start = f.date("start_date", { required: "시작일을 입력하세요." });
  const end = f.date("end_date", { required: "종료일을 입력하세요." });
  if (start && end && end < start) f.errors.end_date = "종료일이 시작일보다 빠릅니다.";
  const status = f.choice("status", CONTRACT_STATUS, "active");
  const deposit = f.money("deposit", { min: 0 }) ?? 0;
  const rent = f.money("monthly_rent", { required: "월세를 입력하세요. (전세는 0)", min: 0 });
  const payDay = f.number("pay_day", { required: "납부일 (1~31)", min: 1, max: 31, int: true });
  const billingMonth = f.raw("billing_from");
  const billingFrom = /^\d{4}-\d{2}$/.test(billingMonth) ? `${billingMonth}-01` : null;
  const reviewed = f.raw("ocr_reviewed");
  const ocrJson = f.raw("ocr_json");
  if (ocrJson && reviewed !== "on") f.errors.ocr_reviewed = "AI 추출 내용을 확인했다고 체크해 주세요.";
  if (!f.ok) return f.fail();

  // 같은 호실 기간 겹침 확인 (종료·해지·갱신된 계약 제외)
  const overlap = await q1<{ contract_no: string }>(
    `select contract_no from contracts where unit_id = $1 and id <> coalesce($2::uuid, '00000000-0000-0000-0000-000000000000')
       and status in ('planned','active') and start_date <= $4 and coalesce(terminated_on, end_date) >= $3 limit 1`,
    [unitId, id, start, end],
  );
  if (overlap) return { fieldErrors: { start_date: `같은 호실에 기간이 겹치는 계약(${overlap.contract_no})이 있습니다.` }, error: "계약 기간을 확인하세요." };

  const ocrDocId = f.uuid("ocr_document_id");
  const prevId = f.uuid("previous_contract_id");
  let contractId = id;
  try {
    await tx(async (c) => {
      if (!tenantId && newTenant) {
        tenantId = (await q1<{ id: string }>("insert into tenants (name, phone, biz_no) values ($1,$2,$3) returning id", [newTenant, f.text("new_tenant_phone"), f.text("new_tenant_biz_no")], c))!.id;
      }
      const vals = [
        unitId,
        tenantId,
        f.text("landlord_name"),
        f.date("contract_date"),
        start,
        end,
        deposit,
        rent,
        f.money("maintenance_fee", { min: 0 }) ?? 0,
        f.money("vat_amount", { min: 0 }) ?? 0,
        payDay,
        billingFrom,
        status,
        f.bool("is_renewal"),
        f.text("special_terms"),
        f.text("memo"),
      ];
      if (id) {
        await q(
          `update contracts set unit_id=$1, tenant_id=$2, landlord_name=$3, contract_date=$4, start_date=$5, end_date=$6, deposit=$7, monthly_rent=$8,
             maintenance_fee=$9, vat_amount=$10, pay_day=$11, billing_from=$12, status=$13, is_renewal=$14, special_terms=$15, memo=$16, updated_at=now()
           where id=$17`,
          [...vals, id],
          c,
        );
        // 아직 입금이 없는 이번 달 이후 청구는 새 금액으로 다시 만든다
        await q(
          "delete from rent_charges where contract_id = $1 and billing_month >= $2 and paid_amount = 0 and not exists (select 1 from payments p where p.charge_id = rent_charges.id)",
          [id, monthStart(todayKST())],
          c,
        );
        await q("update deposits set amount = $2, return_due_date = coalesce(return_due_date, $3) where contract_id = $1", [id, deposit, end], c);
      } else {
        const no = f.text("contract_no") ?? (await nextContractNo(c));
        contractId = (await q1<{ id: string }>(
          `insert into contracts (unit_id, tenant_id, landlord_name, contract_date, start_date, end_date, deposit, monthly_rent, maintenance_fee,
             vat_amount, pay_day, billing_from, status, is_renewal, special_terms, memo, contract_no, ocr_extracted, previous_contract_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) returning id`,
          [...vals, no, ocrJson || null, prevId],
          c,
        ))!.id;
        await q(
          "insert into deposits (contract_id, amount, received_amount, received_date, return_due_date) values ($1,$2,$3,$4,$5)",
          [contractId, deposit, status === "planned" ? 0 : deposit, status === "planned" ? null : start, end],
          c,
        );
        // 계약이 생기면 호실의 공실 시작일은 비운다
        await q("update units set vacant_since = null where id = $1", [unitId], c);
        // 갱신: 이전 계약은 '갱신' 상태로, 보증금은 새 계약으로 이어짐 (반환 알림 제외)
        if (prevId) await q("update contracts set status = 'renewed', updated_at = now() where id = $1 and status in ('active','expired')", [prevId], c);
        if (ocrDocId) {
          await q(
            "update documents set contract_id = $1, tenant_id = $2, unit_id = $3, property_id = (select property_id from units where id = $3) where id = $4",
            [contractId, tenantId, unitId, ocrDocId],
            c,
          );
        }
      }
    });
  } catch (e) {
    return { error: dbError(e) };
  }
  await audit(a.user.id, id ? "update" : "create", "contract", contractId, { unitId, tenantId, rent, deposit, start, end, ocr: !!ocrJson });
  invalidateSync();
  await syncBilling(todayKST(), [contractId!]);
  revalidatePath("/", "layout");
  redirect(`/contracts/${contractId}?saved=1`);
}

/** 계약 상태 변경: 중도해지 / 만료 처리 */
export async function terminateContractAction(contractId: string, date?: string): Promise<FormState> {
  const a = await authorize("staff");
  if ("denied" in a) return a.denied;
  const d = date?.trim() || todayKST();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: "날짜는 2026-10-31 형식으로 입력하세요." };
  const c = await q1<Contract>("select * from contracts where id = $1", [contractId]);
  if (!c) return { error: "계약을 찾을 수 없습니다." };
  if (d < c.start_date) return { error: "해지일이 시작일보다 빠릅니다." };
  await tx(async (cl) => {
    await q("update contracts set status = 'terminated', terminated_on = $2, updated_at = now() where id = $1", [contractId, d], cl);
    // 해지일 이후 달의, 입금 없는 청구 삭제
    await q(
      "delete from rent_charges where contract_id = $1 and billing_month > $2 and not exists (select 1 from payment_allocations pa where pa.charge_id = rent_charges.id)",
      [contractId, monthStart(d)],
      cl,
    );
    await q("update deposits set return_due_date = $2 where contract_id = $1 and status <> 'returned'", [contractId, d], cl);
    await q("update units set vacant_since = $2 where id = $1", [c.unit_id, addDays(d, 1)], cl);
    await reallocateContract(contractId, cl);
  });
  await audit(a.user.id, "terminate", "contract", contractId, { date: d });
  revalidatePath("/", "layout");
  redirect(`/contracts/${contractId}?tab=deposit&saved=terminated`);
}

export async function setContractStatusAction(contractId: string, status: string): Promise<FormState> {
  const a = await authorize("staff");
  if ("denied" in a) return a.denied;
  if (!(status in CONTRACT_STATUS)) return { error: "잘못된 상태" };
  await q("update contracts set status = $2, updated_at = now() where id = $1", [contractId, status]);
  await audit(a.user.id, "status", "contract", contractId, { status });
  revalidatePath("/", "layout");
  redirect(`/contracts/${contractId}?tab=info&saved=status`);
}

export async function deleteContractAction(contractId: string): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const paid = await q1<{ n: number }>("select count(*)::int as n from payments where contract_id = $1", [contractId]);
  if ((paid?.n ?? 0) > 0) return { error: "입금 기록이 있는 계약은 삭제할 수 없습니다. 중도해지 또는 만료로 바꾸세요." };
  await q("delete from contracts where id = $1", [contractId]);
  await audit(a.user.id, "delete", "contract", contractId);
  revalidatePath("/", "layout");
  redirect("/contracts");
}

// ---------------------------------------------------------------------------
// 입금
// ---------------------------------------------------------------------------

export async function recordPaymentAction(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("staff");
  if ("denied" in a) return a.denied;
  const f = new FormReader(fd);
  const contractId = f.uuid("contract_id", { required: "임차인(계약)을 선택하세요." });
  const chargeId = f.uuid("charge_id");
  const date = f.date("paid_date", { required: "입금일을 입력하세요." });
  const amount = f.money("amount", { required: "입금액을 입력하세요.", min: 1 });
  const method = f.choice("method", PAYMENT_METHODS, "transfer");
  if (!f.ok) return f.fail();
  if (chargeId) {
    const ch = await q1("select 1 from rent_charges where id = $1 and contract_id = $2", [chargeId, contractId]);
    if (!ch) return { fieldErrors: { charge_id: "선택한 청구월이 이 계약의 것이 아닙니다." } };
  }
  const pid = await tx(async (c) => {
    const r = await q1<{ id: string }>(
      "insert into payments (contract_id, charge_id, paid_date, amount, method, memo, created_by) values ($1,$2,$3,$4,$5,$6,$7) returning id",
      [contractId, chargeId, date, amount, method, f.text("memo"), a.user.id],
      c,
    );
    await reallocateContract(contractId!, c);
    return r!.id;
  });
  await audit(a.user.id, "create", "payment", pid, { contractId, amount, date });
  const left = await q1<{ unpaid: number }>(
    "select coalesce(sum(amount - paid_amount), 0)::bigint as unpaid from rent_charges where contract_id = $1 and due_date < $2",
    [contractId, todayKST()],
  );
  revalidatePath("/", "layout");
  return {
    ok: `${Number(amount).toLocaleString()}원 입금 처리했습니다. 미납금에서 자동 차감되었습니다.${left && left.unpaid > 0 ? ` (남은 미납 ${left.unpaid.toLocaleString()}원)` : " (미납 없음)"}`,
  };
}

export async function deletePaymentAction(paymentId: string): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const p = await q1<{ contract_id: string; amount: number; paid_date: string }>("select contract_id, amount, paid_date from payments where id = $1", [paymentId]);
  if (!p) return { error: "입금 기록이 없습니다." };
  await tx(async (c) => {
    await q("delete from payments where id = $1", [paymentId], c);
    await reallocateContract(p.contract_id, c);
  });
  await audit(a.user.id, "delete", "payment", paymentId, p);
  revalidatePath("/", "layout");
  return { ok: "입금 기록을 취소했습니다. 미납금이 다시 계산되었습니다." };
}

/** 청구 금액 조정 (할인·감면). 0 이면 청구 면제 */
export async function adjustChargeAction(chargeId: string, value?: string): Promise<FormState> {
  const a = await authorize("staff");
  if ("denied" in a) return a.denied;
  const amount = Number(String(value ?? "").replace(/[,원\s]/g, ""));
  if (!Number.isFinite(amount) || amount < 0) return { error: "금액을 숫자로 입력하세요." };
  const ch = await q1<{ contract_id: string; amount: number }>("select contract_id, amount from rent_charges where id = $1", [chargeId]);
  if (!ch) return { error: "청구를 찾을 수 없습니다." };
  await tx(async (c) => {
    if (amount > ch.amount) await pinPayments(ch.contract_id, c);
    await q("update rent_charges set amount = $2, memo = concat_ws(' / ', memo, $3::text) where id = $1", [chargeId, Math.round(amount), `금액 조정 ${ch.amount.toLocaleString()} → ${Math.round(amount).toLocaleString()}`], c);
    await reallocateContract(ch.contract_id, c);
  });
  await audit(a.user.id, "adjust", "charge", chargeId, { from: ch.amount, to: amount });
  revalidatePath("/", "layout");
  return { ok: "청구 금액을 바꿨습니다." };
}

/**
 * 미납으로 고정 / 해제.
 * 고정하면 월을 지정하지 않은 입금(여러 달 치를 한 번에 넣은 입금 등)이 이 달을 건너뛰고 다음 달부터 채운다.
 * 이 달을 지정해 둔 입금은 '지정 없음'으로 바꿔 다른 달로 옮긴다 (실제로 이 달은 안 받았으므로).
 */
export async function holdChargeAction(chargeId: string, hold: boolean): Promise<FormState> {
  const a = await authorize("staff");
  if ("denied" in a) return a.denied;
  const ch = await q1<{ contract_id: string; billing_month: string }>("select contract_id, billing_month::text from rent_charges where id = $1", [chargeId]);
  if (!ch) return { error: "청구를 찾을 수 없습니다." };
  await tx(async (c) => {
    if (hold) await q("update payments set charge_id = null where charge_id = $1", [chargeId], c);
    await q("update rent_charges set hold_unpaid = $2 where id = $1", [chargeId, hold], c);
    await reallocateContract(ch.contract_id, c);
  });
  await audit(a.user.id, hold ? "hold_unpaid" : "release_hold", "charge", chargeId, { month: ch.billing_month });
  revalidatePath("/", "layout");
  const m = `${ch.billing_month.slice(0, 4)}년 ${Number(ch.billing_month.slice(5, 7))}월`;
  return {
    ok: hold
      ? `${m}을(를) 미납으로 고정했습니다. 입금은 그 다음 달들부터 다시 채웠습니다.`
      : `${m} 미납 고정을 풀었습니다. 입금이 오래된 달부터 다시 채워집니다.`,
  };
}

/**
 * 빠진 달 청구 추가 (예: 자동 청구 시작 월 이전의 미납, 실수로 면제한 달).
 * 이미 그 달 청구가 있으면 금액만 바꾼다. 기존 입금은 지금 채운 달에 그대로 둔다.
 */
export async function addChargeAction(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("staff");
  if ("denied" in a) return a.denied;
  const f = new FormReader(fd);
  const contractId = f.uuid("contract_id", { required: "잘못된 요청" });
  const ym = f.raw("month");
  if (!/^\d{4}-\d{2}$/.test(ym)) f.errors.month = "청구 월을 선택하세요.";
  const amount = f.money("amount", { required: "청구액을 입력하세요.", min: 1 });
  if (!f.ok) return f.fail();
  const ct = await q1<Contract>("select * from contracts where id = $1", [contractId]);
  if (!ct) return { error: "계약을 찾을 수 없습니다." };
  const month = `${ym}-01`;
  const today = todayKST();
  if (month < monthStart(ct.start_date)) return { fieldErrors: { month: `계약 시작(${ct.start_date.slice(0, 7)}) 이전 달입니다.` } };
  if (month > monthStart(today)) return { fieldErrors: { month: "다음 달 이후 청구는 매월 자동으로 만들어집니다." } };
  const end = ct.status === "terminated" && ct.terminated_on ? ct.terminated_on : ct.end_date;
  if (month > monthStart(end)) return { fieldErrors: { month: `계약 종료(${end.slice(0, 7)}) 이후 달입니다.` } };
  const dueDate = dueDateOf(month, ct.pay_day);
  const rent = Math.min(amount!, ct.monthly_rent);
  const maint = Math.min(amount! - rent, ct.maintenance_fee);
  const vat = amount! - rent - maint;
  let action = "";
  await tx(async (c) => {
    await pinPayments(contractId!, c);
    const existing = await q1<{ id: string; amount: number }>("select id, amount from rent_charges where contract_id = $1 and billing_month = $2", [contractId, month], c);
    if (existing) {
      await q("update rent_charges set amount = $2, memo = concat_ws(' / ', memo, $3::text) where id = $1", [existing.id, amount, `금액 조정 ${existing.amount.toLocaleString()} → ${amount!.toLocaleString()}`], c);
      action = `이미 있던 청구 금액을 ${existing.amount.toLocaleString()}원 → ${amount!.toLocaleString()}원으로 바꿨습니다`;
    } else {
      await q(
        `insert into rent_charges (contract_id, billing_month, due_date, rent_amount, maintenance_amount, vat_amount, amount, memo)
         values ($1,$2,$3,$4,$5,$6,$7,'수동 추가')`,
        [contractId, month, dueDate, rent, maint, vat, amount],
        c,
      );
      action = `청구를 추가했습니다 (${amount!.toLocaleString()}원, 납부일 ${dueDate})`;
    }
    await reallocateContract(contractId!, c);
  });
  await audit(a.user.id, "add_charge", "contract", contractId, { month, amount });
  revalidatePath("/", "layout");
  return { ok: `${ym.slice(0, 4)}년 ${Number(ym.slice(5))}월 ${action}. 입금이 없으면 납부일이 지난 뒤 미납으로 표시됩니다.` };
}

// ---------------------------------------------------------------------------
// 보증금
// ---------------------------------------------------------------------------

export async function saveDepositAction(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("staff");
  if ("denied" in a) return a.denied;
  const f = new FormReader(fd);
  const contractId = f.uuid("contract_id", { required: "잘못된 요청" });
  const amount = f.money("amount", { min: 0 }) ?? 0;
  const received = f.money("received_amount", { min: 0 }) ?? 0;
  const returned = f.money("returned_amount", { min: 0 }) ?? 0;
  const offset = f.money("offset_amount", { min: 0 }) ?? 0;
  const base = received || amount;
  if (returned + offset > base) f.errors.returned_amount = "반환 + 상계 금액이 받은 보증금보다 큽니다.";
  if (!f.ok) return f.fail();
  const status = returned + offset >= base && base > 0 ? "returned" : returned + offset > 0 ? "partial" : "held";
  await q(
    `insert into deposits (contract_id, amount, received_amount, received_date, return_due_date, returned_amount, offset_amount, returned_date, status, memo)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (contract_id) do update set amount=$2, received_amount=$3, received_date=$4, return_due_date=$5, returned_amount=$6,
       offset_amount=$7, returned_date=$8, status=$9, memo=$10`,
    [contractId, amount, received, f.date("received_date"), f.date("return_due_date"), returned, offset, f.date("returned_date"), status, f.text("memo")],
  );
  await audit(a.user.id, "update", "deposit", contractId, { amount, received, returned, offset, status });
  revalidatePath("/", "layout");
  return { ok: `보증금 정보를 저장했습니다. (미반환 ${(base - returned - offset).toLocaleString()}원)` };
}
