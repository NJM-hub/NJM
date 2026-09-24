import type { Metadata } from "next";
import { SITE } from "@/lib/site/config";

export const metadata: Metadata = { title: "개인정보처리방침" };

// TODO: 실제 운영 방식에 맞게 검토 후 게시하세요.
export default function PrivacyPage() {
  const sections: [string, string][] = [
    ["1. 수집하는 개인정보 항목", "상담 신청 시 이름, 연락처(필수)와 희망 지역, 희망 차종, 이용 희망일, 이용 기간, 문의 내용(선택)을 수집합니다."],
    ["2. 수집 및 이용 목적", "렌터카 상담, 견적 및 계약 안내, 사고대차 접수 처리에 이용합니다."],
    ["3. 보유 및 이용 기간", "상담 완료 후 3개월간 보관한 뒤 파기합니다. 다만 관계 법령에 따라 보존할 필요가 있는 경우 해당 기간 동안 보관합니다."],
    ["4. 제3자 제공", "법령에 근거가 있거나 이용자가 동의한 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다. 사고대차의 경우 보험 처리를 위해 필요한 범위에서 보험사에 제공될 수 있으며, 이때는 별도로 동의를 받습니다."],
    ["5. 파기 절차 및 방법", "보유 기간이 지난 개인정보는 지체 없이 복구할 수 없는 방법으로 삭제합니다."],
    ["6. 이용자의 권리", "이용자는 언제든지 자신의 개인정보 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다."],
    ["7. 개인정보 보호책임자", `${SITE.privacyOfficer || "담당자"} / ${SITE.email || SITE.phone}`],
  ];
  return (
    <div className="site-container max-w-3xl py-10 sm:py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">개인정보처리방침</h1>
      <p className="mt-3 text-site-ink-2">{SITE.legalName}(이하 &quot;회사&quot;)는 「개인정보 보호법」에 따라 이용자의 개인정보를 보호하고 관련 고충을 원활하게 처리하기 위해 다음과 같이 처리방침을 둡니다.</p>
      <div className="mt-8 space-y-6">
        {sections.map(([h, b]) => (
          <section key={h}>
            <h2 className="font-bold">{h}</h2>
            <p className="mt-1 leading-relaxed text-site-ink-2">{b}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
