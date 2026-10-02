"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FORMULA_LABELS, FORMULA_VARS, mergeCalc } from "@/lib/calcSettings";
import { authorize } from "@/lib/auth";
import { NOTIFICATION_KINDS, OWNER_TYPES, type NotificationKind } from "@/lib/constants";
import { invalidateSync } from "@/lib/data";
import { audit, q, tx } from "@/lib/db";
import { todayKST } from "@/lib/dates";
import { dbError, FormReader } from "@/lib/form";
import { checkFormula } from "@/lib/formula";
import { runDaily } from "@/lib/jobs";
import type { NotifyTarget } from "@/lib/notifications";
import { seedSampleData } from "@/lib/seed";
import type { FormState } from "@/lib/types";

export async function saveCalcAction(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const f = new FormReader(fd);
  const formulas = {} as Record<keyof typeof FORMULA_VARS, string>;
  for (const k of Object.keys(FORMULA_VARS) as (keyof typeof FORMULA_VARS)[]) {
    const v = f.text(`f_${k}`, { required: `${FORMULA_LABELS[k]} 계산식을 입력하세요.` }) ?? "";
    const err = v ? checkFormula(v, FORMULA_VARS[k]) : null;
    if (err) f.errors[`f_${k}`] = err;
    formulas[k] = v;
  }
  const vacancyDayBase = f.number("vacancyDayBase", { required: "입력", min: 1, max: 31 });
  const opexMonths = f.number("opexMonths", { required: "입력", min: 1, max: 36, int: true });
  const depositAlertDays = f.number("depositAlertDays", { required: "입력", min: 1, max: 365, int: true });
  const loanMaturityAlertDays = f.number("loanMaturityAlertDays", { required: "입력", min: 1, max: 730, int: true });
  const expiry = f
    .raw("expiryAlertDays")
    .split(/[,\s]+/)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  if (!expiry.length) f.errors.expiryAlertDays = "예: 90, 60, 30, 7";
  if (!f.ok) return f.fail();
  const value = mergeCalc({
    formulas,
    vacancyDayBase,
    opexMonths,
    depositAlertDays,
    loanMaturityAlertDays,
    expiryAlertDays: expiry,
    interestMethod: f.raw("interestMethod") === "daily" ? "daily" : "monthly",
    maintenanceAsIncome: f.bool("maintenanceAsIncome"),
    vatAsIncome: f.bool("vatAsIncome"),
  });
  await q(
    "insert into settings (key, value, updated_at) values ('calc', $1, now()) on conflict (key) do update set value = excluded.value, updated_at = now()",
    [JSON.stringify(value)],
  );
  await audit(a.user.id, "update", "settings", "calc", value);
  revalidatePath("/", "layout");
  return { ok: "계산 기준을 저장했습니다. 모든 화면의 숫자가 새 기준으로 계산됩니다." };
}

export async function resetCalcAction(): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  await q("delete from settings where key = 'calc'");
  revalidatePath("/", "layout");
  return { ok: "기본 계산식으로 되돌렸습니다." };
}

export async function saveOwnerAction(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const f = new FormReader(fd);
  const id = f.uuid("id");
  const name = f.text("name", { required: "이름(법인명)을 입력하세요." });
  const type = f.choice("owner_type", OWNER_TYPES, "individual");
  if (!f.ok) return f.fail();
  const vals = [name, type, f.text("biz_no"), f.text("representative"), f.text("phone"), f.text("memo")];
  if (id) {
    await q("update owners set name=$1, owner_type=$2, biz_no=$3, representative=$4, phone=$5, memo=$6, is_active=$7 where id=$8", [...vals, !f.bool("inactive"), id]);
  } else {
    await q("insert into owners (name, owner_type, biz_no, representative, phone, memo) values ($1,$2,$3,$4,$5,$6)", vals);
  }
  await audit(a.user.id, id ? "update" : "create", "owner", id, { name, type });
  revalidatePath("/", "layout");
  return { ok: id ? "저장했습니다." : `${name} 을(를) 추가했습니다.` };
}

export async function saveNotifyTargetsAction(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const targets: NotifyTarget[] = [];
  for (let i = 0; i < 6; i++) {
    const recipient = String(fd.get(`recipient_${i}`) ?? "").trim();
    const channel = String(fd.get(`channel_${i}`) ?? "");
    if (!recipient) continue;
    if (!["sms", "kakao", "email", "webhook"].includes(channel)) return { error: `${i + 1}번째 줄의 채널을 선택하세요.` };
    const kinds = (Object.keys(NOTIFICATION_KINDS) as NotificationKind[]).filter((k) => fd.get(`kind_${i}_${k}`) === "on");
    targets.push({ channel: channel as NotifyTarget["channel"], recipient, kinds });
  }
  await q(
    "insert into settings (key, value, updated_at) values ('notify_targets', $1, now()) on conflict (key) do update set value = excluded.value, updated_at = now()",
    [JSON.stringify(targets)],
  );
  await audit(a.user.id, "update", "settings", "notify_targets", { count: targets.length });
  return { ok: `알림 받을 곳 ${targets.length}개를 저장했습니다.` };
}

export async function seedAction(): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  try {
    await tx((c) => seedSampleData(c, todayKST(), a.user.id));
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  invalidateSync();
  await runDaily();
  await audit(a.user.id, "seed", "data", null);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function runDailyAction(): Promise<FormState> {
  const a = await authorize("staff");
  if ("denied" in a) return a.denied;
  const r = await runDaily();
  revalidatePath("/", "layout");
  return { ok: `월세 청구 ${r.charges}건, 새 알림 ${r.notifications}건을 만들었습니다.` };
}

/** 모든 임대 데이터 삭제 (사용자·설정은 남김) */
export async function wipeDataAction(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  if (String(fd.get("confirm") ?? "").trim() !== "전체삭제") return { fieldErrors: { confirm: "'전체삭제' 라고 입력하세요." } };
  try {
    await q(
      `truncate notification_deliveries, notifications, documents, payment_allocations, payments, rent_charges, deposits,
         loan_transactions, expenses, loans, contracts, tenants, units, properties, owners restart identity cascade`,
    );
  } catch (e) {
    return { error: dbError(e) };
  }
  invalidateSync();
  await audit(a.user.id, "wipe", "data", null);
  revalidatePath("/", "layout");
  return { ok: "모든 임대 데이터를 지웠습니다." };
}
