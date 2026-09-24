import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { ServiceKey } from "./services";

export type RentalCar = {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  year: number | null;
  fuel: string | null;
  seats: number | null;
  rent_types: string[];
  daily_price: number | null;
  monthly_price: number | null;
  long_price: number | null;
  image_url: string | null;
  description: string | null;
  published: boolean;
  sort_order: number;
};

export type CarQuery = { type?: ServiceKey; q?: string; category?: string; brand?: string; max?: number; sort?: string };

/** 비로그인 방문자용 읽기 전용 클라이언트 (RLS: 공개 차량만) */
function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** 서비스별로 보여 줄 요금 컬럼 */
export function priceOf(car: RentalCar, type?: ServiceKey): { label: string; value: number | null } {
  if (type === "short") return { label: "1일", value: car.daily_price };
  if (type === "long") return { label: "월", value: car.long_price };
  if (type === "rent") return { label: "월", value: car.monthly_price };
  if (car.monthly_price) return { label: "월", value: car.monthly_price };
  if (car.daily_price) return { label: "1일", value: car.daily_price };
  return { label: "월", value: car.long_price };
}

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
