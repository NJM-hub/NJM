"use server";

import { revalidatePath } from "next/cache";
import readXlsxFile from "read-excel-file/node";
import { authorize } from "@/lib/auth";
import { invalidateSync } from "@/lib/data";
import { audit, tx } from "@/lib/db";
import { COLS, IMPORT_KINDS, sheetObjects, type Cell, type ImportKind } from "@/lib/excel";
import { importRows } from "@/lib/importer";
import type { FormState } from "@/lib/types";

/** 엑셀 가져오기 (관리자). 내보낸 엑셀과 같은 머리글이면 그대로 들어온다 */
export async function importExcelAction(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const kind = String(fd.get("kind") ?? "") as ImportKind;
  if (!(kind in IMPORT_KINDS)) return { error: "가져올 항목을 선택하세요." };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "엑셀 파일(.xlsx)을 선택하세요." };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: ".xlsx 파일만 가져올 수 있습니다. (xls 는 엑셀에서 xlsx 로 다시 저장)" };
  let sheets: { sheet: string; data: Cell[][] }[];
  try {
    sheets = (await readXlsxFile(Buffer.from(await file.arrayBuffer()))) as { sheet: string; data: Cell[][] }[];
  } catch (e) {
    return { error: `엑셀을 읽지 못했습니다: ${e instanceof Error ? e.message : String(e)}` };
  }
  const cols = COLS[kind];
  // 머리글이 가장 많이 맞는 시트를 고른다
  const best = sheets.map((s) => sheetObjects(s.data, cols)).sort((x, y) => y.length - x.length)[0] ?? [];
  if (!best.length) return { error: `머리글을 찾지 못했습니다. 첫 줄에 ${cols.slice(0, 5).map((c) => c.title).join(", ")} … 이 있어야 합니다. ('양식 받기'로 형식을 확인하세요)` };
  const r = await tx((c) => importRows(kind, best, c));
  await audit(a.user.id, "import", kind, null, { created: r.created, updated: r.updated, skipped: r.skipped.length });
  invalidateSync();
  revalidatePath("/", "layout");
  const skipped = r.skipped.slice(0, 10).map((s) => `${s.row}행: ${s.reason}`).join(" / ");
  return {
    ok: `${IMPORT_KINDS[kind]} 가져오기 완료: 새로 ${r.created}건, 수정 ${r.updated}건${r.skipped.length ? `, 건너뜀 ${r.skipped.length}건 (${skipped})` : ""}`,
  };
}
