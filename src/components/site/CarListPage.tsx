import Link from "next/link";
import { listBrands, listCars } from "@/lib/site/cars";
import { CAR_CATEGORIES, type ServiceKey } from "@/lib/site/services";
import { CarCard } from "./CarCard";

export type CarSearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

const SORTS = [
  { value: "", label: "추천순" },
  { value: "price_asc", label: "낮은 요금순" },
  { value: "price_desc", label: "높은 요금순" },
  { value: "name", label: "이름순" },
];

export async function CarListPage({ title, lead, type, note, searchParams, contactService }: {
  title: string; lead: string; type?: ServiceKey; note: string; searchParams: CarSearchParams; contactService?: string;
}) {
  const sp = await searchParams;
  const q = one(sp.q);
  const category = one(sp.category);
  const brand = one(sp.brand);
  const sort = one(sp.sort) ?? "";
  const maxNum = Number(one(sp.max));
  const max = Number.isFinite(maxNum) && maxNum > 0 ? maxNum : undefined;

  const [cars, brands] = await Promise.all([listCars({ type, q, category, brand, max, sort }), listBrands(type)]);
  const filtered = !!(q || category || brand || max || sort);

  return (
    <>
      <section className="border-b border-site-line bg-site-bg">
        <div className="site-container py-10 sm:py-14">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 text-site-ink-2">{lead}</p>
        </div>
      </section>

      <section className="site-container py-8">
        <form method="get" className="grid gap-2 rounded-2xl border border-site-line p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
          <input name="q" defaultValue={q} placeholder="차량 이름으로 찾기" className="site-input" aria-label="차량 이름" />
          <select name="category" defaultValue={category ?? ""} className="site-input" aria-label="차종">
            <option value="">차종 전체</option>
            {CAR_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select name="brand" defaultValue={brand ?? ""} className="site-input" aria-label="브랜드">
            <option value="">브랜드 전체</option>
            {brands.map((b) => <option key={b}>{b}</option>)}
          </select>
          <input name="max" type="number" min={0} step={10000} defaultValue={max} placeholder="최대 요금(원)" className="site-input" aria-label="최대 요금" />
          <select name="sort" defaultValue={sort} className="site-input" aria-label="정렬">
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <div className="flex gap-2">
            <button className="site-btn site-btn--dark h-12 flex-1">찾기</button>
            {filtered && <Link href="?" className="site-btn site-btn--line h-12">초기화</Link>}
          </div>
        </form>

        <p className="mt-6 mb-3 text-sm text-site-ink-2">
          차량 <b className="text-site-ink">{cars.length}</b>대
        </p>

        {cars.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cars.map((c) => <CarCard key={c.id} car={c} type={type} />)}
          </div>
        ) : (
          <div className="rounded-2xl bg-site-bg px-6 py-16 text-center">
            <p className="font-semibold">{filtered ? "조건에 맞는 차량이 없습니다." : "등록된 차량을 준비 중입니다."}</p>
            <p className="mt-1 text-sm text-site-ink-2">원하시는 차종을 알려 주시면 바로 확인해 드립니다.</p>
            <Link href={`/contact${contactService ? `?service=${encodeURIComponent(contactService)}` : ""}`} className="site-btn mt-5">상담 신청</Link>
          </div>
        )}

        <p className="mt-6 text-xs leading-relaxed text-site-gray">※ {note}</p>
      </section>
    </>
  );
}
