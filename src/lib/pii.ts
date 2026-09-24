/** 주민등록번호/계좌번호 형식 검증과 마스킹 (클라이언트·서버 공용) */

export function normalizeRrn(input: string): string | null {
  const d = input.replace(/\D/g, "");
  return d.length === 13 ? d : null;
}

/** 주민등록번호 검증: 생년월일·성별자리 확인 (2020년 10월 이후 발급번호는 체크섬이 없어 검사하지 않음) */
export function isValidRrn(rrn: string): boolean {
  const d = normalizeRrn(rrn);
  if (!d) return false;
  const mm = Number(d.slice(2, 4));
  const dd = Number(d.slice(4, 6));
  const g = Number(d[6]);
  return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && g >= 1 && g <= 8;
}

export function formatRrn(d: string): string {
  return `${d.slice(0, 6)}-${d.slice(6)}`;
}

export function maskRrn(d: string): string {
  return `${d.slice(0, 6)}-${d[6]}******`;
}

export function birthDateFromRrn(d: string): string {
  const g = Number(d[6]);
  const century = g === 1 || g === 2 || g === 5 || g === 6 ? 1900 : g === 9 || g === 0 ? 1800 : 2000;
  return `${century + Number(d.slice(0, 2))}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
}

export function normalizeAccount(input: string): string | null {
  const d = input.replace(/[^\d-]/g, "");
  return d.replace(/-/g, "").length >= 8 ? d : null;
}

export function maskAccount(acc: string): string {
  const digits = acc.replace(/\D/g, "");
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function normalizePhone(input: string): string | null {
  const d = input.replace(/\D/g, "");
  if (!/^01\d{8,9}$/.test(d)) return null;
  return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}
