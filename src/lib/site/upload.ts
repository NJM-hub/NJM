import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

const BUCKET = "car-images";

/** 홈페이지 이미지(차량·이벤트)를 공개 Storage 버킷에 올리고 공개 URL 을 돌려준다. 관리자 확인 후에만 호출할 것. */
export async function uploadSiteImage(file: File, folder: "cars" | "events"): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 올릴 수 있습니다.");
  if (file.size > 5 * 1024 * 1024) throw new Error("사진은 5MB 이하로 올려 주세요.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const storage = createAdminClient().storage.from(BUCKET);
  const { error } = await storage.upload(path, file, { contentType: file.type });
  if (error) throw new Error(`사진 업로드 실패: ${error.message}`);
  return storage.getPublicUrl(path).data.publicUrl;
}

/** 폼의 image / remove_image 필드를 image_url 변경값으로. 변경이 없으면 undefined. */
export async function imageFieldFrom(formData: FormData, folder: "cars" | "events"): Promise<string | null | undefined> {
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) return uploadSiteImage(image, folder);
  if (formData.get("remove_image") === "on") return null;
  return undefined;
}
