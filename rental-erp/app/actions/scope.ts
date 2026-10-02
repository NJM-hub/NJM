"use server";

import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { SCOPE_COOKIE } from "@/lib/data";

/** 보기 범위 (전체 / 소유주별) */
export async function setScopeAction(ownerId: string) {
  await requireUser();
  const jar = await cookies();
  if (ownerId && /^[0-9a-f-]{36}$/.test(ownerId)) {
    jar.set(SCOPE_COOKIE, ownerId, { path: "/", sameSite: "lax", maxAge: 365 * 24 * 3600, httpOnly: true });
  } else {
    jar.delete(SCOPE_COOKIE);
  }
}
