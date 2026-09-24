import "server-only";
import type { RentalCar } from "./car-types";
import { publicClient } from "./db";

export { priceOf, type RentalCar } from "./car-types";
import type { ServiceKey } from "./services";

export type CarQuery = { type?: ServiceKey; q?: string; category?: string; brand?: string; max?: number; sort?: string };

const PRICE_COLUMN = { short: "daily_price", rent: "monthly_price", long: "long_price", accident: "monthly_price" } as const;

export async function listCars(query: CarQuery = {}): Promise<RentalCar[]> {
  const supabase = publicClient();
  if (!supabase) return [];
  let req = supabase.from("rental_cars").select("*").eq("published", true);
  if (query.type) req = req.contains("rent_types", [query.type]);
  if (query.category) req = req.eq("category", query.category);
  if (query.brand) req = req.eq("brand", query.brand);
  if (query.q) req = req.ilike("name", `%${query.q.replace(/[%_,()]/g, "")}%`);
  const priceCol = PRICE_COLUMN[query.type ?? "rent"];
  if (query.max) req = req.lte(priceCol, query.max);

  if (query.sort === "price_asc" || query.sort === "price_desc") {
    req = req.order(priceCol, { ascending: query.sort === "price_asc", nullsFirst: false });
  } else if (query.sort === "name") {
    req = req.order("name");
  } else {
    req = req.order("sort_order").order("created_at", { ascending: false });
  }
  const { data, error } = await req.limit(200);
  if (error) {
    console.error("rental_cars 조회 실패", error.message);
    return [];
  }
  return data as RentalCar[];
}

export async function getCar(id: string): Promise<RentalCar | null> {
  const supabase = publicClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabase.from("rental_cars").select("*").eq("id", id).eq("published", true).maybeSingle();
  return (data as RentalCar | null) ?? null;
}

/** 필터 선택지용 브랜드 목록 */
export async function listBrands(type?: ServiceKey): Promise<string[]> {
  const supabase = publicClient();
  if (!supabase) return [];
  let req = supabase.from("rental_cars").select("brand").eq("published", true).not("brand", "is", null);
  if (type) req = req.contains("rent_types", [type]);
  const { data } = await req;
  return [...new Set((data ?? []).map((r) => r.brand as string))].sort((a, b) => a.localeCompare(b, "ko"));
}

/** 찜 목록용: id 로 공개 차량 조회 */
export async function listCarsByIds(ids: string[]): Promise<RentalCar[]> {
  const valid = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100);
  const supabase = publicClient();
  if (!supabase || !valid.length) return [];
  const { data } = await supabase.from("rental_cars").select("*").eq("published", true).in("id", valid);
  return (data ?? []) as RentalCar[];
}
