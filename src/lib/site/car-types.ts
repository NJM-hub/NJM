// 서버·클라이언트 공용 (server-only 아님)
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

/** 서비스별로 보여 줄 요금 컬럼 */
export function priceOf(car: RentalCar, type?: ServiceKey): { label: string; value: number | null } {
  if (type === "short") return { label: "1일", value: car.daily_price };
  if (type === "long") return { label: "월", value: car.long_price };
  if (type === "rent") return { label: "월", value: car.monthly_price };
  if (car.monthly_price) return { label: "월", value: car.monthly_price };
  if (car.daily_price) return { label: "1일", value: car.daily_price };
  return { label: "월", value: car.long_price };
}
