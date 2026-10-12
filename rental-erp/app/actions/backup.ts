"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth";
import { BACKUP_LABELS, BACKUP_TABLES, parseBackup, restoreBackup } from "@/lib/backup";
import { invalidateSync } from "@/lib/data";
import { audit, tx } from "@/lib/db";
import { dbError } from "@/lib/form";
import type { FormState } from "@/lib/types";

/** 백업 파일로 되돌리기 (관리자). 지금 임대 데이터는 모두 백업 내용으로 바뀐다 */
export async function restoreBackupAction(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  if (String(fd.get("confirm") ?? "").trim() !== "복원") return { error: "확인을 위해 '복원' 이라고 입력하세요." };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "백업 파일(.json.gz)을 선택하세요." };

  let backup;
  try {
    backup = parseBackup(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  let counts: Record<string, number>;
  try {
    counts = await tx((c) => restoreBackup(backup, c));
  } catch (e) {
    return { error: `복원하지 못했습니다. 지금 데이터는 바뀌지 않았습니다. (${dbError(e)})` };
  }
  await audit(a.user.id, "restore", "backup", null, { created_at: backup.created_at, counts });
  invalidateSync();
  revalidatePath("/", "layout");
  const summary = BACKUP_TABLES.filter((t) => t !== "settings" && t !== "payment_allocations")
    .map((t) => `${BACKUP_LABELS[t]} ${counts[t]}`)
    .join(" · ");
  return { ok: `${backup.created_at.slice(0, 10)} 백업으로 복원했습니다. (${summary})` };
}
