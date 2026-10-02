"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth";
import { audit, q } from "@/lib/db";
import type { FormState } from "@/lib/types";

export async function deleteDocumentAction(id: string): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  await q("delete from documents where id = $1", [id]);
  await audit(a.user.id, "delete", "document", id);
  revalidatePath("/", "layout");
  return { ok: "삭제했습니다." };
}
