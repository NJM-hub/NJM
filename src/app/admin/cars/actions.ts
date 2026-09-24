"use server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { CAR_CATEGORIES } from "@/lib/site/services";

const BUCKET = "car-images";
const RENT_TYPES = ["short", "rent", "long", "accident"];
const intOrNull = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(/[^0-9]/g, ""));
  return String(v ?? "").trim() === "" || !Number.isFinite(n) ? null : Math.round(n);
};

async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 올릴 수 있습니다.");
  if (file.size > 5 * 1024 * 1024) throw new Error("사진은 5MB 이하로 올려 주세요.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${crypto.randomUUID()}.${ext}`;
  const storage = createAdminClient().storage.from(BUCKET);
  const { error } = await storage.upload(path, file, { contentType: file.type });
  if (error) throw new Error(`사진 업로드 실패: ${error.message}`);
  return storage.getPublicUrl(path).data.publicUrl;
}

export async function saveCar(formData: FormData) {
  const { supabase } = await assertAdmin();
  const id = String(formData.get("id") || "") || null;
  const category = String(formData.get("category") || "중형");
  const row: Record<string, unknown> = {
    name: String(formData.get("name") || "").trim(),
    brand: String(formData.get("brand") || "").trim() || null,
    category: (CAR_CATEGORIES as readonly string[]).includes(category) ? category : "중형",
    year: intOrNull(formData.get("year")),
    fuel: String(formData.get("fuel") || "").trim() || null,
    seats: intOrNull(formData.get("seats")),
    rent_types: formData.getAll("rent_types").map(String).filter((t) => RENT_TYPES.includes(t)),
    daily_price: intOrNull(formData.get("daily_price")),
    monthly_price: intOrNull(formData.get("monthly_price")),
    long_price: intOrNull(formData.get("long_price")),
    description: String(formData.get("description") || "").trim() || null,
    published: formData.get("published") === "on",
    sort_order: intOrNull(formData.get("sort_order")) ?? 0,
    updated_at: new Date().toISOString(),
  };
  if (!row.name) throw new Error("차량 이름을 입력하세요.");

  const image = formData.get("image");
  if (image instanceof File && image.size > 0) row.image_url = await uploadImage(image);
  else if (formData.get("remove_image") === "on") row.image_url = null;

  const { error } = id
    ? await supabase.from("rental_cars").update(row).eq("id", id)
    : await supabase.from("rental_cars").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/cars");
  revalidatePath("/", "layout");
}

export async function deleteCar(formData: FormData) {
  const { supabase } = await assertAdmin();
  const { error } = await supabase.from("rental_cars").delete().eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/admin/cars");
  revalidatePath("/", "layout");
}
