"use server";
import { revalidatePath } from "next/cache";
import { assertOwner } from "@/lib/auth";
import { isMonth } from "@/lib/format";
import { LEDGER_CATEGORIES } from "@/lib/settlement/monthlyLedger";

const won = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(/[,\s원]/g, "") || 0);
  if (!Number.isFinite(n) || Math.abs(n) > 2_000_000_000) throw new Error("금액이 올바르지 않습니다.");
  return Math.round(n);
};
const text = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

function monthOf(formData: FormData) {
  const month = String(formData.get("month"));
  if (!isMonth(month)) throw new Error("정산 월이 올바르지 않습니다.");
  return month;
}

function refresh(month: string) {
  revalidatePath("/admin/settlement");
  revalidatePath(`/admin/settlement/${month}`);
}

/** 월별 정산표의 직접 입력 지출 저장 (상세 내역이 있는 항목은 칸이 없으니 건드리지 않는다) */
export async function saveMonthLedger(formData: FormData) {
  const { supabase } = await assertOwner();
  const month = monthOf(formData);
  const row: Record<string, unknown> = { month, updated_at: new Date().toISOString() };
  for (const c of LEDGER_CATEGORIES) if (formData.has(c.column)) row[c.column] = won(formData.get(c.column));
  // 비용·기사 지급: 비워 두면 자동 계산(null), 숫자를 적으면 그 값
  for (const k of ["cost_override", "driver_pay_override"]) {
    if (!formData.has(k)) continue;
    const v = String(formData.get(k) ?? "").trim();
    row[k] = v === "" ? null : won(v);
  }
  const { error } = await supabase.from("monthly_ledger").upsert(row);
  if (error) throw new Error(error.message);
  refresh(month);
}

function itemFields(formData: FormData) {
  const category = String(formData.get("category"));
  if (!LEDGER_CATEGORIES.some((c) => c.key === category)) throw new Error("지출 항목이 올바르지 않습니다.");
  const spentOn = text(formData.get("spent_on"));
  if (spentOn && !/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) throw new Error("날짜가 올바르지 않습니다.");
  return { category, spent_on: spentOn, description: text(formData.get("description")) ?? "", amount: won(formData.get("amount")), memo: text(formData.get("memo")) };
}

export async function addLedgerItem(formData: FormData) {
  const { supabase } = await assertOwner();
  const month = monthOf(formData);
  const { error } = await supabase.from("monthly_ledger_items").insert({ month, ...itemFields(formData) });
  if (error) throw new Error(error.message);
  refresh(month);
}

export async function updateLedgerItem(formData: FormData) {
  const { supabase } = await assertOwner();
  const month = monthOf(formData);
  const id = String(formData.get("id"));
  const { error } = await supabase.from("monthly_ledger_items").update(itemFields(formData)).eq("id", id).eq("month", month);
  if (error) throw new Error(error.message);
  refresh(month);
}

export async function deleteLedgerItem(formData: FormData) {
  const { supabase } = await assertOwner();
  const month = monthOf(formData);
  const { error } = await supabase.from("monthly_ledger_items").delete().eq("id", String(formData.get("id"))).eq("month", month);
  if (error) throw new Error(error.message);
  refresh(month);
}
