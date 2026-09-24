"use server";
import { createAdminClient } from "@/lib/supabase/server";
import { SERVICES } from "@/lib/site/services";
import { SITE } from "@/lib/site/config";

export type InquiryState = { ok: boolean; error?: string };

const text = (f: FormData, k: string, max = 100) => String(f.get(k) ?? "").trim().slice(0, max);

export async function submitInquiry(_prev: InquiryState, formData: FormData): Promise<InquiryState> {
  // 스팸 봇용 숨김 필드: 채워져 있으면 성공한 척 무시한다.
  if (text(formData, "website")) return { ok: true };

  const service = text(formData, "service");
  const name = text(formData, "name", 30);
  const phone = text(formData, "phone", 20).replace(/[^0-9-]/g, "");
  const startDate = text(formData, "start_date", 10);

  if (!SERVICES.some((s) => s.formValue === service)) return { ok: false, error: "희망 서비스를 선택해 주세요." };
  if (!name) return { ok: false, error: "이름을 입력해 주세요." };
  if (!/^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(phone)) return { ok: false, error: "연락처를 정확히 입력해 주세요. (예: 010-1234-5678)" };
  if (formData.get("consent") !== "on") return { ok: false, error: "개인정보 수집 및 이용에 동의해 주세요." };

  const region = text(formData, "region", 10);
  const { error } = await createAdminClient().from("inquiries").insert({
    service,
    name,
    phone,
    region: SITE.regions.includes(region) ? region : null,
    car: text(formData, "car", 100) || null,
    start_date: /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : null,
    period: text(formData, "period", 20) || null,
    message: text(formData, "message", 2000) || null,
    privacy_consent_at: new Date().toISOString(),
  });
  if (error) {
    console.error("상담 신청 저장 실패", error.message);
    return { ok: false, error: `접수 중 문제가 생겼습니다. 전화(${SITE.phone})로 문의해 주세요.` };
  }
  return { ok: true };
}
