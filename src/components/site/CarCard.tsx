import Link from "next/link";
import { won } from "@/lib/format";
import { priceOf, type RentalCar } from "@/lib/site/cars";
import type { ServiceKey } from "@/lib/site/services";

export function CarImage({ car, className = "" }: { car: RentalCar; className?: string }) {
  return car.image_url ? (
    // 관리자가 올린 Supabase Storage 이미지 (도메인이 프로젝트마다 달라 next/image 대신 img 사용)
    // eslint-disable-next-line @next/next/no-img-element
    <img src={car.image_url} alt={car.name} loading="lazy" className={`h-full w-full object-contain ${className}`} />
  ) : (
    <div className={`flex h-full w-full items-center justify-center text-sm text-site-gray ${className}`}>사진 준비 중</div>
  );
}

export function CarCard({ car, type, hidePrice }: { car: RentalCar; type?: ServiceKey; hidePrice?: boolean }) {
  const price = priceOf(car, type);
  const spec = [car.year && `${car.year}년식`, car.fuel, car.seats && `${car.seats}인승`].filter(Boolean).join(" · ");
  return (
    <Link href={`/cars/${car.id}${type ? `?type=${type}` : ""}`} className="group block overflow-hidden rounded-2xl border border-site-line bg-white transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="aspect-[16/10] bg-site-bg p-3">
        <CarImage car={car} className="transition group-hover:scale-[1.03]" />
      </div>
      <div className="p-4">
        <p className="text-xs font-semibold text-site-gray">{[car.brand, car.category].filter(Boolean).join(" · ")}</p>
        <h3 className="mt-0.5 truncate text-[17px] font-bold">{car.name}</h3>
        {spec && <p className="mt-0.5 text-xs text-site-ink-2">{spec}</p>}
        {!hidePrice && (
          <p className="mt-3 text-right">
            {price.value ? (
              <>
                <span className="mr-1 text-xs text-site-gray">{price.label}</span>
                <b className="text-xl font-extrabold text-brand">{won(price.value)}</b>
                <span className="text-xs text-site-gray">~</span>
              </>
            ) : (
              <b className="text-base font-bold text-site-ink-2">상담 시 안내</b>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}
