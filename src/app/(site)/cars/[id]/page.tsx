import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CarImage } from "@/components/site/CarCard";
import { won } from "@/lib/format";
import { SITE, telHref } from "@/lib/site/config";
import { getCar } from "@/lib/site/cars";
import { SERVICES, serviceByKey } from "@/lib/site/services";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const car = await getCar((await params).id);
  return { title: car?.name ?? "차량 정보" };
}

export default async function CarDetail({ params, searchParams }: Props) {
  const [{ id }, { type }] = await Promise.all([params, searchParams]);
  const car = await getCar(id);
  if (!car) notFound();

  const service = serviceByKey(type ?? "") ?? SERVICES.find((s) => car.rent_types.includes(s.key));
  const prices = [
    { key: "short", label: "단기렌트 (1일)", value: car.daily_price },
    { key: "rent", label: "월렌트 (월)", value: car.monthly_price },
    { key: "long", label: "장기렌트 (월)", value: car.long_price },
  ].filter((p) => car.rent_types.includes(p.key) && p.value);
  const specs = [
    ["브랜드", car.brand], ["차종", car.category], ["연식", car.year && `${car.year}년식`],
    ["연료", car.fuel], ["승차 인원", car.seats && `${car.seats}인승`],
  ].filter(([, v]) => v) as [string, string][];
  const contactHref = `/contact?${new URLSearchParams({ ...(service ? { service: service.formValue } : {}), car: car.name })}`;

  return (
    <div className="site-container py-8 sm:py-12">
      <Link href={service?.href ?? "/cars"} className="text-sm font-semibold text-site-gray hover:text-site-ink">
        ‹ {service?.name ?? "전체 차량"} 목록
      </Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div className="aspect-[16/10] rounded-2xl bg-site-bg p-6">
          <CarImage car={car} />
        </div>
        <div>
          <p className="text-sm font-semibold text-site-gray">{[car.brand, car.category].filter(Boolean).join(" · ")}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{car.name}</h1>

          <dl className="mt-6 divide-y divide-site-line border-y border-site-line text-[15px]">
            {specs.map(([k, v]) => (
              <div key={k} className="flex justify-between py-3"><dt className="text-site-ink-2">{k}</dt><dd className="font-semibold">{v}</dd></div>
            ))}
          </dl>

          <div className="mt-6 space-y-2 rounded-2xl bg-site-bg p-5">
            {prices.length ? prices.map((p) => (
              <div key={p.key} className="flex items-baseline justify-between">
                <span className="text-sm text-site-ink-2">{p.label}</span>
                <span><b className="text-xl font-extrabold text-brand">{won(p.value)}</b><span className="text-xs text-site-gray">~</span></span>
              </div>
            )) : <p className="font-semibold">요금은 상담 시 안내드립니다.</p>}
            {car.rent_types.includes("accident") && <p className="text-sm text-site-ink-2">사고대차 가능 차량 (보험 처리)</p>}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <Link href={contactHref} className="site-btn">이 차로 상담 신청</Link>
            <a href={telHref(SITE.phone)} className="site-btn site-btn--line">전화 문의</a>
          </div>

          {car.description && <p className="mt-8 leading-relaxed whitespace-pre-line text-site-ink-2">{car.description}</p>}
        </div>
      </div>
    </div>
  );
}
