import "server-only";
import { findVehicle } from "@/content/vehicles";
import { summarizeInquiry, type InquiryInput } from "@/lib/inquiry";

// 예약 문의를 실제로 받는 곳. 환경변수로 하나 이상 연결합니다.
//  - INQUIRY_WEBHOOK_URL : 슬랙·구글 Apps Script·Make·Zapier 등 웹훅 주소 (JSON POST)
//  - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY : Supabase 의 rental_inquiries 테이블에 저장
// 아무것도 연결되지 않았으면 'not_configured' 를 돌려주고, 화면에는 접수되지 않았다고 안내합니다.

export type DeliveryResult = { ok: true } | { ok: false; reason: "not_configured" | "failed" };

export function deliveryConfigured(): boolean {
  return Boolean(process.env.INQUIRY_WEBHOOK_URL || (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY));
}

async function toWebhook(url: string, input: InquiryInput): Promise<void> {
  const text = summarizeInquiry(input);
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // text: 슬랙·디스코드 등에서 바로 보이는 문장 / 나머지: 시트 등에 칸별로 저장할 때
    body: JSON.stringify({
      text,
      content: text,
      ...input,
      vehicleName: findVehicle(input.vehicle)?.name ?? input.vehicle,
      receivedAt: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`webhook ${res.status}`);
}

async function toSupabase(baseUrl: string, key: string, input: InquiryInput): Promise<void> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/rest/v1/rental_inquiries`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: key,
      authorization: `Bearer ${key}`,
      prefer: "return=minimal",
    },
    body: JSON.stringify({
      name: input.name.trim(),
      phone: input.phone.trim(),
      vehicle: input.vehicle,
      start_date: input.startDate,
      end_date: input.endDate,
      purpose: input.purpose,
      notes: input.notes.trim(),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`supabase ${res.status}`);
}

/** 연결된 곳 모두에 보냅니다. 하나라도 성공하면 접수로 봅니다. */
export async function deliverInquiry(input: InquiryInput): Promise<DeliveryResult> {
  const jobs: Promise<void>[] = [];
  const webhook = process.env.INQUIRY_WEBHOOK_URL;
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (webhook) jobs.push(toWebhook(webhook, input));
  if (sbUrl && sbKey) jobs.push(toSupabase(sbUrl, sbKey, input));
  if (jobs.length === 0) return { ok: false, reason: "not_configured" };

  const results = await Promise.allSettled(jobs);
  for (const r of results) if (r.status === "rejected") console.error("[inquiry] delivery failed:", r.reason);
  return results.some((r) => r.status === "fulfilled") ? { ok: true } : { ok: false, reason: "failed" };
}
