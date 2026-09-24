"use server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { isDate } from "@/lib/format";
import { imageFieldFrom } from "@/lib/site/upload";

export async function saveEvent(formData: FormData) {
  const { supabase } = await assertAdmin();
  const id = String(formData.get("id") || "") || null;
  const date = (k: string) => {
    const v = String(formData.get(k) || "");
    return isDate(v) ? v : null;
  };
  const row: Record<string, unknown> = {
    title: String(formData.get("title") || "").trim(),
    summary: String(formData.get("summary") || "").trim() || null,
    body: String(formData.get("body") || "").trim() || null,
    starts_on: date("starts_on"),
    ends_on: date("ends_on"),
    published: formData.get("published") === "on",
    updated_at: new Date().toISOString(),
  };
  if (!row.title) throw new Error("이벤트 제목을 입력하세요.");
  const imageUrl = await imageFieldFrom(formData, "events");
  if (imageUrl !== undefined) row.image_url = imageUrl;

  const { error } = id ? await supabase.from("events").update(row).eq("id", id) : await supabase.from("events").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/events");
  revalidatePath("/events", "layout");
}

export async function deleteEvent(formData: FormData) {
  const { supabase } = await assertAdmin();
  const { error } = await supabase.from("events").delete().eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/admin/events");
  revalidatePath("/events", "layout");
}
