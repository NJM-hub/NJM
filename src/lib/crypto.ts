import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/** PII_ENCRYPTION_KEY: base64 로 인코딩된 32바이트 키 (openssl rand -base64 32) */
function key(): Buffer {
  const k = Buffer.from(env.piiKey(), "base64");
  if (k.length !== 32) throw new Error("PII_ENCRYPTION_KEY 는 base64 32바이트여야 합니다.");
  return k;
}

/** AES-256-GCM. 결과: v1:iv:tag:ciphertext (base64) */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decrypt(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const [v, iv, tag, ct] = payload.split(":");
  if (v !== "v1") throw new Error("알 수 없는 암호화 형식");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}
