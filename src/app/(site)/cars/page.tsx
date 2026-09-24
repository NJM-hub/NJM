import type { Metadata } from "next";
import { CarListPage, type CarSearchParams } from "@/components/site/CarListPage";

export const metadata: Metadata = { title: "전체 차량", description: "보유 차량과 요금을 한눈에 확인하세요." };

export default function Page({ searchParams }: { searchParams: CarSearchParams }) {
  return (
    <CarListPage
      title="전체 차량"
      lead="보유 중인 차량을 모두 보여 드립니다."
      note="표시 요금은 기준가입니다. 이용 기간과 계약 조건에 따라 달라질 수 있으며 정확한 금액은 상담 시 안내드립니다."
      searchParams={searchParams}
    />
  );
}
