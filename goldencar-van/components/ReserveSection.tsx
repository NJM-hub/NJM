import InquiryForm from "@/components/InquiryForm";
import { priceBasisText, site } from "@/content/site";
import { formatWon, vehicles } from "@/content/vehicles";

export default function ReserveSection() {
  return (
    <section id="reserve" className="section bg-white">
      <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="eyebrow">Reservation</p>
          <h2 className="section-title">예약 문의</h2>
          <p className="mt-4 leading-relaxed text-neutral-600">
            원하시는 차량과 날짜를 남겨 주시면 이용 가능 여부와 대여 조건을 안내해 드립니다.
          </p>
          <ul className="mt-8 space-y-3">
            {vehicles.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-2xl bg-ink-900 px-5 py-4 text-white">
                <span className="font-medium">{v.shortName}</span>
                <span className="text-lg font-extrabold text-gold-300">{formatWon(v.dailyPrice)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-neutral-500">1일 기준 · {priceBasisText()}</p>
          {site.contact.hours && <p className="mt-6 text-sm text-neutral-600">상담 시간: {site.contact.hours}</p>}
        </div>
        <InquiryForm />
      </div>
    </section>
  );
}
