import "server-only";
import { getCalcSettings, loadDataset, syncBilling } from "@/lib/data";
import { todayKST } from "@/lib/dates";
import { buildSnapshot } from "@/lib/engine";
import { draftLoanInterest, draftNotifications, saveNotifications } from "@/lib/notifications";

/** 매일 한 번: 월세 자동 청구 → 알림 생성 (Vercel Cron 또는 설정 화면 버튼) */
export async function runDaily(today = todayKST()) {
  const charges = await syncBilling(today);
  const [ds, settings] = await Promise.all([loadDataset(), getCalcSettings()]);
  const snap = buildSnapshot(ds, settings, today);
  const notifications = await saveNotifications([...draftNotifications(snap), ...draftLoanInterest(snap, ds.loans)]);
  return { charges, notifications };
}
