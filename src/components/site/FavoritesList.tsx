"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadFavoriteCars } from "@/app/(site)/favorites/actions";
import type { RentalCar } from "@/lib/site/car-types";
import { useFavorites } from "@/lib/site/favorites";
import { CarCard } from "./CarCard";

export function FavoritesList() {
  const ids = useFavorites();
  const key = ids.join(",");
  const [loaded, setLoaded] = useState<{ key: string; cars: RentalCar[] } | null>(null);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    loadFavoriteCars(key.split(",")).then((cars) => alive && setLoaded({ key, cars }));
    return () => { alive = false; };
  }, [key]);

  if (!ids.length) {
    return (
      <div className="rounded-2xl bg-site-bg px-6 py-16 text-center">
        <p className="font-semibold">아직 찜한 차량이 없습니다.</p>
        <p className="mt-1 text-sm text-site-ink-2">차량 사진의 하트를 누르면 이곳에 모아 볼 수 있습니다.</p>
        <Link href="/cars" className="site-btn mt-5">차량 둘러보기</Link>
      </div>
    );
  }
  if (!loaded || loaded.key !== key) return <p className="py-16 text-center text-site-gray">불러오는 중…</p>;

  // 삭제·비공개된 차량은 목록에서 빠진다.
  const cars = loaded.cars.filter((c) => ids.includes(c.id));
  const names = cars.map((c) => c.name).join(", ");
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cars.map((c) => <CarCard key={c.id} car={c} />)}
      </div>
      {cars.length > 0 && (
        <div className="mt-8 text-center">
          <Link href={`/contact?${new URLSearchParams({ car: names.slice(0, 100) })}`} className="site-btn">찜한 차량으로 상담 신청</Link>
        </div>
      )}
    </>
  );
}
