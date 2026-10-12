import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/fetchAll";

/** 백업 대상 테이블 (order: 페이지를 나눠 받을 때 순서가 흔들리지 않도록 기본키) */
export const BACKUP_TABLES = [
  { name: "vehicles", label: "차량", order: ["id"] },
  { name: "drivers", label: "기사", order: ["id"] },
  { name: "profiles", label: "계정", order: ["id"] },
  { name: "schedule_uploads", label: "일정표 업로드", order: ["id"] },
  { name: "bookings", label: "예약", order: ["id"] },
  { name: "dispatch_runs", label: "배차", order: ["id"] },
  { name: "dispatch_assignments", label: "배차 내역", order: ["id"] },
  { name: "vehicle_month_expenses", label: "차량 월정산 비용", order: ["vehicle_id", "month", "operator"] },
  { name: "vehicle_month_items", label: "차량 월정산 추가 항목", order: ["id"] },
  { name: "kkday_statements", label: "KKday 정산내역서", order: ["booking_no"] },
  { name: "monthly_ledger", label: "월별 정산표", order: ["month"] },
  { name: "app_settings", label: "설정", order: ["id"] },
  { name: "geocode_cache", label: "주소 좌표", order: ["address"] },
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number]["name"];

export async function countTables(db: SupabaseClient): Promise<Record<string, number | null>> {
  const entries = await Promise.all(
    BACKUP_TABLES.map(async (t) => {
      const { count, error } = await db.from(t.name).select("*", { count: "exact", head: true });
      return [t.name, error ? null : count] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export async function dumpTable(db: SupabaseClient, name: BackupTable): Promise<Record<string, unknown>[]> {
  const t = BACKUP_TABLES.find((x) => x.name === name)!;
  return fetchAll((a, b) => {
    let q = db.from(t.name).select("*");
    for (const c of t.order) q = q.order(c);
    return q.range(a, b);
  }) as Promise<Record<string, unknown>[]>;
}
