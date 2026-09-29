import "server-only";
import { won, ymd } from "@/lib/format";
import { db } from "@/lib/supabase";

const FIELD_LABELS: Record<string, string> = {
  investment_no: "투자번호", customer_id: "고객", target_name: "투자 대상명", executed_on: "실행일",
  principal: "투자금액", return_rate: "수익률", repayment_method: "회수방식", period_days: "회수기간",
  start_on: "회수 시작일", maturity_on: "만기일", status: "상태", status_reason: "상태 사유", memo: "메모",
};

type Log = {
  id: number;
  table_name: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  actor: string | null;
  created_at: string;
};

export type HistoryItem = { id: number; at: string; actor: string | null; text: string };

function describe(l: Log): string | null {
  const n = l.new_data ?? {};
  const o = l.old_data ?? {};
  if (l.table_name === "investments") {
    if (l.action === "insert") return "투자 등록";
    const changed = Object.keys(FIELD_LABELS).filter((k) => JSON.stringify(n[k]) !== JSON.stringify(o[k]));
    return changed.length ? `수정: ${changed.map((k) => FIELD_LABELS[k]).join(", ")}` : null;
  }
  if (l.table_name === "repayments") {
    if (l.action === "insert") return `입금 기록 ${won(Number(n.amount))} (${ymd(String(n.paid_on))})`;
    if (o.status === "valid" && n.status === "void") return `입금 취소 ${won(Number(n.amount))} · 사유: ${n.void_reason}`;
    return null;
  }
  return null;
}

/** 투자 건과 그 입금 기록의 변경 이력 (최근 순) */
export async function investmentHistory(investmentId: string, repaymentIds: string[], limit = 30): Promise<HistoryItem[]> {
  const ids = [investmentId, ...repaymentIds.slice(0, 150)];
  const { data, error } = await db()
    .from("audit_logs")
    .select("id, table_name, action, old_data, new_data, actor, created_at")
    .in("row_id", ids)
    .order("id", { ascending: false })
    .limit(limit * 2);
  if (error) return [];
  return (data as Log[])
    .map((l) => ({ id: l.id, at: l.created_at, actor: l.actor, text: describe(l) }))
    .filter((h): h is HistoryItem => h.text !== null)
    .slice(0, limit);
}
