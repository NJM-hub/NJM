import { site } from "@/content/site";

/** tel: 링크 (전화번호가 없으면 null) */
export function phoneHref(): string | null {
  const digits = site.contact.phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

export function kakaoHref(): string | null {
  return site.contact.kakaoUrl || null;
}
