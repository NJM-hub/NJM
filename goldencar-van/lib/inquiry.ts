import { findVehicle, vehicles } from "@/content/vehicles";

// 예약 문의 양식 — 브라우저와 서버가 같은 규칙으로 검사합니다.

export const purposes = ["가족 여행", "출장", "단체 여행", "행사 이동", "공항 이동", "기타"] as const;

export type InquiryInput = {
  name: string;
  phone: string;
  vehicle: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  purpose: string;
  notes: string;
  consent: boolean;
};

export type InquiryField = Exclude<keyof InquiryInput, never>;
export type InquiryErrors = Partial<Record<InquiryField, string>>;

export const emptyInquiry: InquiryInput = {
  name: "",
  phone: "",
  vehicle: "",
  startDate: "",
  endDate: "",
  purpose: "",
  notes: "",
  consent: false,
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 한국 시간 기준 오늘 (YYYY-MM-DD) */
export function todayKst(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

function isRealDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** 숫자만 남긴 전화번호 */
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** 대여 일수 = 반납일 - 시작일 (같은 날 반납은 1일) */
export function rentalDays(startDate: string, endDate: string): number | null {
  if (!isRealDate(startDate) || !isRealDate(endDate)) return null;
  const diff = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000;
  if (diff < 0) return null;
  return Math.max(1, diff);
}

export function validateInquiry(input: InquiryInput, now: Date = new Date()): InquiryErrors {
  const e: InquiryErrors = {};
  const name = input.name.trim();
  if (!name) e.name = "이름을 입력해 주세요.";
  else if (name.length > 30) e.name = "이름은 30자 이내로 입력해 주세요.";

  const phone = input.phone.trim();
  const digits = phoneDigits(phone);
  if (!phone) e.phone = "연락처를 입력해 주세요.";
  else if (!/^[\d\s()+-]+$/.test(phone) || digits.length < 9 || digits.length > 15)
    e.phone = "연락받을 수 있는 전화번호를 정확히 입력해 주세요. (예: 010-1234-5678)";

  if (!findVehicle(input.vehicle)) e.vehicle = "렌트 희망 차량을 선택해 주세요.";

  const today = todayKst(now);
  if (!input.startDate) e.startDate = "대여 시작일을 선택해 주세요.";
  else if (!isRealDate(input.startDate)) e.startDate = "날짜 형식이 올바르지 않습니다.";
  else if (input.startDate < today) e.startDate = "대여 시작일은 오늘 이후로 선택해 주세요.";

  if (!input.endDate) e.endDate = "반납 예정일을 선택해 주세요.";
  else if (!isRealDate(input.endDate)) e.endDate = "날짜 형식이 올바르지 않습니다.";
  else if (isRealDate(input.startDate) && input.endDate < input.startDate)
    e.endDate = "반납 예정일은 대여 시작일과 같거나 이후여야 합니다.";

  if (!(purposes as readonly string[]).includes(input.purpose)) e.purpose = "이용 목적을 선택해 주세요.";

  if (input.notes.length > 1000) e.notes = "추가 요청사항은 1000자 이내로 입력해 주세요.";

  if (!input.consent) e.consent = "개인정보 수집·이용에 동의해 주셔야 문의를 보낼 수 있습니다.";
  return e;
}

/** 서버에서 받은 JSON 을 안전하게 InquiryInput 으로 */
export function parseInquiry(body: unknown): InquiryInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : "");
  return {
    name: str("name"),
    phone: str("phone"),
    vehicle: str("vehicle"),
    startDate: str("startDate"),
    endDate: str("endDate"),
    purpose: str("purpose"),
    notes: str("notes"),
    consent: b.consent === true,
  };
}

/** 사람이 읽기 좋은 요약 (확인 화면·전달 메시지·복사용) */
export function summarizeInquiry(input: InquiryInput): string {
  const v = findVehicle(input.vehicle);
  const days = rentalDays(input.startDate, input.endDate);
  return [
    "[Golden Car 렌트 문의]",
    `이름: ${input.name.trim()}`,
    `연락처: ${input.phone.trim()}`,
    `차량: ${v?.name ?? input.vehicle}`,
    `기간: ${input.startDate} ~ ${input.endDate}${days ? ` (${days}일)` : ""}`,
    `이용 목적: ${input.purpose}`,
    `요청사항: ${input.notes.trim() || "없음"}`,
  ].join("\n");
}

export const vehicleOptions = vehicles.map((v) => ({ id: v.id, label: v.shortName }));
