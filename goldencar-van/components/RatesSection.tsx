import { priceBasisText } from "@/content/site";
import { rateConditions } from "@/content/policies";
import { formatWon, vehicles } from "@/content/vehicles";

export default function RatesSection() {
  return (
    <section id="rates" className="section bg-white">
      <div className="container-page">
        <p className="eyebrow">Rates</p>
        <h2 className="section-title">렌트 요금</h2>
        <p className="mt-3 text-neutral-600">
          표시 요금은 1일 기준입니다. <strong className="font-semibold text-ink-900">요금 기준: {priceBasisText()}</strong>
        </p>

        <div className="mt-10 overflow-hidden rounded-3xl border border-neutral-200">
          <table className="w-full text-left">
            <caption className="sr-only">차량별 1일 렌트 요금</caption>
            <thead className="bg-ink-900 text-white">
              <tr>
                <th scope="col" className="px-5 py-4 text-sm font-semibold sm:px-8">차량</th>
                <th scope="col" className="px-5 py-4 text-right text-sm font-semibold sm:px-8">1일 렌트 요금</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <th scope="row" className="px-5 py-6 text-base font-semibold sm:px-8 sm:text-lg">{v.shortName}</th>
                  <td className="px-5 py-6 text-right text-2xl font-extrabold text-gold-600 sm:px-8 sm:text-4xl">
                    {formatWon(v.dailyPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-14 text-lg font-bold">대여 조건</h3>
        <p className="mt-1 text-sm text-neutral-500">아직 확정되지 않은 조건은 상담 시 안내해 드립니다.</p>
        <dl className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 sm:grid-cols-2">
          {rateConditions.map((c) => (
            <div key={c.label} className="bg-white px-5 py-4">
              <dt className="text-sm font-medium text-neutral-500">{c.label}</dt>
              <dd className={`mt-1 whitespace-pre-line ${c.value ? "text-ink-900" : "text-neutral-400"}`}>
                {c.value || "상담 문의"}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
