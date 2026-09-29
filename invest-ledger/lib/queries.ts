import "server-only";
import { db } from "./supabase/server";
import type { Customer, InvestmentSummary } from "./types";

export async function listInvestments(opts: { includeCancelled?: boolean } = {}): Promise<InvestmentSummary[]> {
  let q = db().from("investment_summary").select("*").order("executed_on", { ascending: false }).order("created_at", { ascending: false });
  if (!opts.includeCancelled) q = q.neq("status", "cancelled");
  const { data, error } = await q;
  if (error) throw new Error(`투자 목록을 불러오지 못했습니다: ${error.message}`);
  return (data ?? []) as InvestmentSummary[];
}

export async function getInvestment(id: string): Promise<InvestmentSummary | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await db().from("investment_summary").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`투자 정보를 불러오지 못했습니다: ${error.message}`);
  return data as InvestmentSummary | null;
}

export async function listCustomers(): Promise<Customer[]> {
  const { data, error } = await db()
    .from("customers")
    .select("id, name, phone, memo, status")
    .eq("status", "active")
    .order("name");
  if (error) throw new Error(`고객 목록을 불러오지 못했습니다: ${error.message}`);
  return (data ?? []) as Customer[];
}
