import "server-only";
import { encrypt } from "@/lib/crypto";
import {
  birthDateFromRrn,
  isValidRrn,
  maskAccount,
  maskRrn,
  normalizeAccount,
  normalizePhone,
  normalizeRrn,
} from "@/lib/pii";

export type DriverFormState = { ok: boolean; message: string } | null;

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/**
 * 폼 데이터를 검증해 drivers 테이블 컬럼으로 변환한다.
 * 주민번호/계좌번호는 비워두면 기존 값 유지 (requireSensitive=false 일 때).
 */
export function driverRowFromForm(f: FormData, requireSensitive: boolean): { row: Record<string, unknown> } | { error: string } {
  const name = s(f, "name");
  const phone = normalizePhone(s(f, "phone"));
  if (!name) return { error: "이름을 입력하세요." };
  if (!phone) return { error: "휴대폰 번호를 확인하세요. (010-0000-0000)" };

  const row: Record<string, unknown> = {
    name,
    phone,
    address: s(f, "address") || null,
    bank_name: s(f, "bank_name") || null,
    account_holder: s(f, "account_holder") || null,
    license_number: s(f, "license_number") || null,
    license_expiry: s(f, "license_expiry") || null,
    updated_at: new Date().toISOString(),
  };

  const rrnInput = s(f, "rrn");
  if (rrnInput) {
    const rrn = normalizeRrn(rrnInput);
    if (!rrn || !isValidRrn(rrn)) return { error: "주민등록번호 형식이 올바르지 않습니다." };
    row.rrn_enc = encrypt(rrn);
    row.rrn_masked = maskRrn(rrn);
    row.birth_date = birthDateFromRrn(rrn);
  } else if (requireSensitive) {
    return { error: "세무신고(원천징수)를 위해 주민등록번호가 필요합니다." };
  }

  const accInput = s(f, "bank_account");
  if (accInput) {
    const acc = normalizeAccount(accInput);
    if (!acc) return { error: "계좌번호를 확인하세요." };
    row.bank_account_enc = encrypt(acc);
    row.bank_account_masked = maskAccount(acc);
  } else if (requireSensitive) {
    return { error: "정산 받을 계좌번호를 입력하세요." };
  }
  if (requireSensitive && (!row.bank_name || !row.account_holder)) return { error: "은행명과 예금주를 입력하세요." };
  return { row };
}
