import Image from "next/image";
import { CheckIcon } from "@/components/Icons";
import SelectVehicleLink from "@/components/SelectVehicleLink";
import { priceBasisText } from "@/content/site";
import { compareRows, formatWon, vehicles } from "@/content/vehicles";

export default function VehicleSection() {
  return (
    <section id="vehicles" className="section bg-neutral-50">
      <div className="container-page">
        <p className="eyebrow">Vehicles</p>
        <h2 className="section-title">차량 소개</h2>
        <p className="mt-3 text-neutral-600">인원과 짐, 일정에 맞는 승합차를 골라 보세요.</p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {vehicles.map((v) => (
            <article key={v.id} className="flex flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
              <div className="bg-ink-900 px-6 pt-8 pb-4">
                <Image
                  src={v.image}
                  alt={v.imageAlt}
                  width={1200}
                  height={720}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="h-auto w-full"
                />
              </div>
              <div className="flex flex-1 flex-col p-6 sm:p-8">
                <h3 className="text-xl font-bold">{v.name}</h3>
                <p className="mt-3 flex flex-wrap items-baseline gap-x-3">
                  <span className="text-4xl font-extrabold text-gold-600">{v.headline}</span>
                  <span className="text-neutral-500">{formatWon(v.dailyPrice)} / 1일</span>
                </p>
                <p className="mt-1 text-xs text-neutral-500">요금 기준: {priceBasisText()}</p>

                <p className="mt-6 text-sm font-semibold text-neutral-800">이런 분께 추천해요</p>
                <ul className="mt-2 grid grid-cols-2 gap-2 text-sm text-neutral-700">
                  {v.uses.map((u) => (
                    <li key={u} className="flex items-center gap-1.5">
                      <CheckIcon className="h-4 w-4 shrink-0 text-gold-500" />
                      {u}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-8">
                  <SelectVehicleLink vehicleId={v.id} className="btn-dark w-full">
                    {v.ctaLabel}
                  </SelectVehicleLink>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* 비교표 */}
        <div className="mt-14">
          <h3 className="text-lg font-bold">한눈에 비교하기</h3>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full min-w-[480px] text-left text-sm">
              <caption className="sr-only">차량별 요금과 사양 비교</caption>
              <thead className="bg-ink-900 text-white">
                <tr>
                  <th scope="col" className="px-5 py-4 font-semibold">항목</th>
                  {vehicles.map((v) => (
                    <th key={v.id} scope="col" className="px-5 py-4 font-semibold">{v.shortName}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                <tr>
                  <th scope="row" className="px-5 py-4 font-medium text-neutral-600">1일 요금</th>
                  {vehicles.map((v) => (
                    <td key={v.id} className="px-5 py-4 text-base font-bold text-gold-600">{formatWon(v.dailyPrice)}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className="px-5 py-4 font-medium text-neutral-600">추천 용도</th>
                  {vehicles.map((v) => (
                    <td key={v.id} className="px-5 py-4 text-neutral-800">{v.uses.join(", ")}</td>
                  ))}
                </tr>
                {compareRows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" className="px-5 py-4 font-medium text-neutral-600">{row.label}</th>
                    {vehicles.map((v) => (
                      <td key={v.id} className="px-5 py-4 text-neutral-800">
                        {v.specs[row.key] ?? <span className="text-neutral-400">상담 문의</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
