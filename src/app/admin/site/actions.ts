"use server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";

const FIELDS = ["name", "legal_name", "phone", "hours", "accident_hours", "kakao_url", "ceo", "brn", "address", "email", "privacy_officer"] as const;

export async function saveSiteInfo(formData: FormData) {
  const { supabase } = await assertAdmin();
  const row: Record<string, string | null> = {};
  for (const f of FIELDS) row[f] = String(formData.get(f) ?? "").trim().slice(0, 200) || null;
  if (row.kakao_url && !/^https:\/\//.test(row.kakao_url)) throw new Error("카카오톡 주소는 https:// 로 시작해야 합니다.");
  if (row.phone && !/^[0-9+\-\s()]{4,20}$/.test(row.phone)) throw new Error("대표번호 형식이 올바르지 않습니다.");

  const { error } = await supabase
    .from("site_info")
    .update({ ...row, name: row.name ?? "우정렌트카", hours: row.hours ?? "08:00 ~ 21:00", accident_hours: row.accident_hours ?? "사고 접수는 24시간 받습니다", updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
