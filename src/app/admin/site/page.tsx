import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { siteInfoFromRow } from "@/lib/site/info";
import { saveSiteInfo } from "./actions";

export default async function SiteSettingsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("site_info").select("*").eq("id", 1).maybeSingle();
  const s = siteInfoFromRow(data);

  return (
    <form action={saveSiteInfo} className="max-w-3xl space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="page-title">홈페이지 설정</h1>
        <Link href="/" target="_blank" className="text-sm text-blue-600 hover:underline">홈페이지 보기 ↗</Link>
      </div>
      <p className="text-sm text-gray-500">
        비워 둔 항목은 홈페이지에 표시되지 않습니다. 대표번호를 넣으면 전화 버튼이, 카카오톡 주소를 넣으면 카카오톡 버튼이 나타납니다.
      </p>
      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">고객 안내</h2>
        <F name="name" label="회사 이름 (홈페이지 로고)" value={s.name} />
        <F name="phone" label="대표번호" value={s.phone} placeholder="예: 1600-0000" />
        <F name="hours" label="운영시간" value={s.hours} />
        <F name="accident_hours" label="사고 접수 안내" value={s.accidentHours} />
        <F name="kakao_url" label="카카오톡 채널 채팅 주소" value={s.kakaoUrl} placeholder="https://pf.kakao.com/_xxxx/chat" wide />
      </section>
      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">사업자 정보 (푸터 · 브랜드소개 · 개인정보처리방침)</h2>
        <F name="legal_name" label="상호" value={s.legalName} placeholder="예: (주)우정렌트카" />
        <F name="ceo" label="대표자" value={s.ceo} />
        <F name="brn" label="사업자등록번호" value={s.brn} placeholder="000-00-00000" />
        <F name="address" label="주소" value={s.address} />
        <F name="privacy_officer" label="개인정보관리책임자" value={s.privacyOfficer} />
        <F name="email" label="개인정보 문의 이메일" value={s.email} />
      </section>
      <SubmitButton>저장</SubmitButton>
    </form>
  );
}

function F({ name, label, value, placeholder, wide }: { name: string; label: string; value: string; placeholder?: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={value} placeholder={placeholder} className="input" />
    </div>
  );
}
