import { UNASSIGNED_REASON_LABEL, type UnassignedReason } from "./algorithm";

/** 자동 배차 사유 외에 수동·시트 가져오기에서 쓰는 사유 */
export const EXTRA_REASON_LABEL: Record<string, string> = {
  MANUAL: "수동으로 배차 해제",
  EXTERNAL: "외부(타업체) 배차",
  SHEET_EMPTY: "시트에 기사 없음",
  NOT_IN_SHEET: "시트에 없는 예약",
};

export function reasonLabel(r: string | null): string {
  if (!r) return "-";
  return UNASSIGNED_REASON_LABEL[r as UnassignedReason] ?? EXTRA_REASON_LABEL[r] ?? r;
}
