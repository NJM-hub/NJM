import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { won } from "@/lib/format";
import { SubmitButton } from "@/components/SubmitButton";
import type { RentalCar } from "@/lib/site/cars";
import { CAR_CATEGORIES, FUELS } from "@/lib/site/services";
import { deleteCar, saveCar } from "./actions";

const TYPE_LABELS: [string, string][] = [["short", "단기"], ["rent", "월렌트"], ["long", "장기"], ["accident", "사고대차"]];

function CarFields({ c }: { c?: RentalCar }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="sm:col-span-2"><label className="label">차량 이름 *</label><input name="name" defaultValue={c?.name} required className="input" placeholder="예: 쏘나타 디 엣지" /></div>
      <div><label className="label">브랜드</label><input name="brand" defaultValue={c?.brand ?? ""} className="input" placeholder="예: 현대" /></div>
      <div>
        <label className="label">차종</label>
        <select name="category" defaultValue={c?.category ?? "중형"} className="input">{CAR_CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select>
      </div>
      <div><label className="label">연식</label><input name="year" type="number" defaultValue={c?.year ?? ""} className="input" placeholder="2025" /></div>
      <div>
        <label className="label">연료</label>
        <select name="fuel" defaultValue={c?.fuel ?? ""} className="input"><option value="">-</option>{FUELS.map((x) => <option key={x}>{x}</option>)}</select>
      </div>
      <div><label className="label">승차 인원</label><input name="seats" type="number" defaultValue={c?.seats ?? ""} className="input" placeholder="5" /></div>
      <div><label className="label">정렬 순서 (작을수록 앞)</label><input name="sort_order" type="number" defaultValue={c?.sort_order ?? 0} className="input" /></div>
      <div><label className="label">단기 1일 요금</label><input name="daily_price" inputMode="numeric" defaultValue={c?.daily_price ?? ""} className="input" /></div>
      <div><label className="label">월렌트 월 요금</label><input name="monthly_price" inputMode="numeric" defaultValue={c?.monthly_price ?? ""} className="input" /></div>
      <div><label className="label">장기렌트 월 요금</label><input name="long_price" inputMode="numeric" defaultValue={c?.long_price ?? ""} className="input" /></div>
      <div>
        <label className="label">사진 {c?.image_url && "(새로 올리면 교체)"}</label>
        <input name="image" type="file" accept="image/*" className="input !py-1.5" />
        {c?.image_url && <label className="mt-1 flex items-center gap-1 text-xs text-gray-500"><input type="checkbox" name="remove_image" /> 사진 삭제</label>}
      </div>
      <div className="sm:col-span-2 lg:col-span-4"><label className="label">설명</label><textarea name="description" rows={2} defaultValue={c?.description ?? ""} className="input" /></div>
      <div className="flex flex-wrap items-center gap-4 text-sm sm:col-span-2 lg:col-span-4">
        <span className="font-medium text-gray-700">노출 메뉴:</span>
        {TYPE_LABELS.map(([v, l]) => (
          <label key={v} className="flex items-center gap-1"><input type="checkbox" name="rent_types" value={v} defaultChecked={c ? c.rent_types.includes(v) : v !== "accident"} /> {l}</label>
        ))}
        <label className="ml-auto flex items-center gap-1 font-medium"><input type="checkbox" name="published" defaultChecked={c?.published ?? true} /> 홈페이지에 공개</label>
      </div>
    </div>
  );
}

export default async function AdminCarsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("rental_cars").select("*").order("sort_order").order("created_at", { ascending: false });
  const cars = (data ?? []) as RentalCar[];

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="page-title">홈페이지 차량</h1>
        <Link href="/cars" target="_blank" className="text-sm text-blue-600 hover:underline">홈페이지에서 보기 ↗</Link>
      </div>
      <details className="card" open={!cars.length}>
        <summary className="cursor-pointer font-semibold">+ 차량 추가</summary>
        <form action={saveCar} className="mt-4 space-y-3">
          <CarFields />
          <SubmitButton>추가</SubmitButton>
        </form>
      </details>
      <div className="space-y-3">
        {cars.map((c) => (
          <details key={c.id} className="card !p-4">
            <summary className="flex cursor-pointer items-center gap-3">
              {c.image_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={c.image_url} alt="" className="h-10 w-16 rounded object-contain" />
                : <span className="h-10 w-16 rounded bg-gray-100" />}
              <span className="font-semibold">{c.name}</span>
              <span className="text-sm text-gray-500">{[c.brand, c.category].filter(Boolean).join(" · ")}</span>
              <span className="ml-auto hidden text-sm text-gray-500 sm:inline">
                {TYPE_LABELS.filter(([v]) => c.rent_types.includes(v)).map(([, l]) => l).join(" · ")}
                {c.monthly_price ? ` · 월 ${won(c.monthly_price)}` : ""}
              </span>
              {!c.published && <span className="badge bg-gray-100 text-gray-600">비공개</span>}
            </summary>
            <form action={saveCar} className="mt-4 space-y-3">
              <CarFields c={c} />
              <SubmitButton className="btn-secondary">저장</SubmitButton>
            </form>
            <form action={deleteCar} className="mt-2 text-right">
              <input type="hidden" name="id" value={c.id} />
              <button className="text-sm text-red-600 hover:underline">삭제</button>
            </form>
          </details>
        ))}
        {!cars.length && <p className="text-sm text-gray-500">등록된 차량이 없습니다. 위에서 차량을 추가하면 홈페이지 단기·월·장기렌트 목록에 바로 나타납니다.</p>}
      </div>
    </div>
  );
}
