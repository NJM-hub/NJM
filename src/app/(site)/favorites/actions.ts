"use server";
import { listCarsByIds, type RentalCar } from "@/lib/site/cars";

/** 브라우저에 저장된 찜 id 로 공개 차량 정보를 불러온다. */
export async function loadFavoriteCars(ids: string[]): Promise<RentalCar[]> {
  if (!Array.isArray(ids)) return [];
  const cars = await listCarsByIds(ids.map(String));
  const order = new Map(ids.map((id, i) => [id, i]));
  return cars.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
