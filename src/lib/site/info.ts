import "server-only";
import { cache } from "react";
import { DEFAULT_SITE, type SiteInfo } from "./config";
import { publicClient } from "./db";

type SiteInfoRow = {
  name: string | null; legal_name: string | null; phone: string | null; hours: string | null; accident_hours: string | null;
  kakao_url: string | null; ceo: string | null; brn: string | null; address: string | null; email: string | null; privacy_officer: string | null;
};

export function siteInfoFromRow(r: Partial<SiteInfoRow> | null): SiteInfo {
  const v = (x: string | null | undefined, d: string) => x?.trim() || d;
  const d = DEFAULT_SITE;
  return {
    name: v(r?.name, d.name),
    legalName: v(r?.legal_name, d.legalName),
    phone: v(r?.phone, d.phone),
    hours: v(r?.hours, d.hours),
    accidentHours: v(r?.accident_hours, d.accidentHours),
    kakaoUrl: v(r?.kakao_url, d.kakaoUrl),
    ceo: v(r?.ceo, d.ceo),
    brn: v(r?.brn, d.brn),
    address: v(r?.address, d.address),
    email: v(r?.email, d.email),
    privacyOfficer: v(r?.privacy_officer, d.privacyOfficer),
  };
}

/** 회사 정보 (요청당 한 번만 조회). DB 가 없거나 아직 입력 전이면 기본값. */
export const getSiteInfo = cache(async (): Promise<SiteInfo> => {
  const db = publicClient();
  if (!db) return DEFAULT_SITE;
  const { data, error } = await db.from("site_info").select("*").eq("id", 1).maybeSingle();
  if (error) console.error("site_info 조회 실패", error.message);
  return siteInfoFromRow(data);
});
