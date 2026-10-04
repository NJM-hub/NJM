import "server-only";
import { MAX_UPLOAD_BYTES, UPLOAD_MIME } from "@/lib/constants";

/** 업로드 파일 검사: 형식(파일 앞부분 서명까지 확인)·크기 */
export async function readUpload(file: FormDataEntryValue | null): Promise<{ name: string; mime: string; bytes: Buffer } | { error: string }> {
  if (!(file instanceof File) || file.size === 0) return { error: "파일을 선택하세요." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "파일이 너무 큽니다. 화면을 새로고침한 뒤 다시 올려 주세요 (큰 파일은 자동으로 줄여서 올립니다)." };
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniff(bytes);
  if (!mime || !(UPLOAD_MIME as readonly string[]).includes(mime)) return { error: "PDF, JPG, PNG 파일만 올릴 수 있습니다." };
  return { name: file.name.slice(0, 200) || "file", mime, bytes };
}

function sniff(b: Buffer): string | null {
  if (b.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}
