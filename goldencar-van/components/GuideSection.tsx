import { bookingSteps, faqs, guideSections } from "@/content/policies";

function Answer({ text }: { text: string }) {
  return text ? (
    <p className="whitespace-pre-line text-neutral-700">{text}</p>
  ) : (
    <p className="text-neutral-500">자세한 내용은 상담 시 안내해 드립니다.</p>
  );
}

const summaryCls =
  "flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden";

function Chevron() {
  return (
    <svg className="h-5 w-5 shrink-0 text-gold-500 transition group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function GuideSection() {
  return (
    <section id="guide" className="section bg-neutral-50">
      <div className="container-page">
        <p className="eyebrow">Guide</p>
        <h2 className="section-title">이용 안내</h2>

        <h3 className="mt-10 text-lg font-bold">예약 방법</h3>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {bookingSteps.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-neutral-200 bg-white p-5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-sm font-bold text-gold-300">
                {i + 1}
              </span>
              <p className="mt-3 font-bold">{s.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-neutral-600">{s.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          <div>
            <h3 className="text-lg font-bold">렌트 전 확인하세요</h3>
            <div className="mt-5 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              {guideSections.map((g) => (
                <details key={g.label} className="group">
                  <summary className={summaryCls}>
                    {g.label}
                    <Chevron />
                  </summary>
                  <div className="px-5 pb-5 text-sm leading-relaxed">
                    <Answer text={g.value} />
                  </div>
                </details>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold">자주 묻는 질문</h3>
            <div className="mt-5 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              {faqs.map((f) => (
                <details key={f.q} className="group">
                  <summary className={summaryCls}>
                    <span>
                      <span className="mr-2 text-gold-500">Q.</span>
                      {f.q}
                    </span>
                    <Chevron />
                  </summary>
                  <div className="px-5 pb-5 text-sm leading-relaxed">
                    <Answer text={f.a} />
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
