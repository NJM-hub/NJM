import type { Metadata } from "next";
import { CarListPage, type CarSearchParams } from "@/components/site/CarListPage";
import { serviceByKey } from "@/lib/site/services";

const service = serviceByKey("rent")!;

export const metadata: Metadata = { title: service.name, description: service.lead };

export default function Page({ searchParams }: { searchParams: CarSearchParams }) {
  return (
    <CarListPage
      title={service.name}
      lead={service.lead}
      type="rent"
      contactService={service.formValue}
      note="표시 요금은 보험료·정비비가 포함된 월 기준가입니다. 이용 기간과 계약 조건에 따라 달라질 수 있으며 정확한 금액은 상담 시 안내드립니다."
      searchParams={searchParams}
    />
  );
}
