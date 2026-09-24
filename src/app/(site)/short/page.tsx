import type { Metadata } from "next";
import { CarListPage, type CarSearchParams } from "@/components/site/CarListPage";
import { serviceByKey } from "@/lib/site/services";

const service = serviceByKey("short")!;

export const metadata: Metadata = { title: service.name, description: service.lead };

export default function Page({ searchParams }: { searchParams: CarSearchParams }) {
  return (
    <CarListPage
      title={service.name}
      lead={service.lead}
      type="short"
      contactService={service.formValue}
      note="표시 요금은 보험료가 포함된 1일 기준가입니다. 대여 기간·보험 조건·연령에 따라 달라질 수 있으며 정확한 금액은 상담 시 안내드립니다."
      searchParams={searchParams}
    />
  );
}
