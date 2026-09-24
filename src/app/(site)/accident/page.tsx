import type { Metadata } from "next";
import Link from "next/link";
import { CarCard } from "@/components/site/CarCard";
import { SITE, telHref } from "@/lib/site/config";
import { listCars } from "@/lib/site/cars";

export const metadata: Metadata = {
  title: "사고대차",
  description: "사고로 차를 수리하는 동안 타실 차를 보험 처리로 가져다 드립니다. 24시간 사고 접수.",
};

const HIGHLIGHTS = [
  { big: "0원", title: "고객 부담", body: "상대 과실 사고라면 대차료는 상대 보험사에서 처리합니다." },
  { big: "동급 이상", title: "배차 기준", body: "타시던 차보다 작은 차를 드리지 않습니다." },
  { big: "배송·회수", title: "원하는 곳으로", body: "집, 직장, 공업사 어디든 가져다 드리고 가지러 갑니다." },
];

const STEPS = [
  { title: "사고 접수", body: "전화 한 통이면 됩니다. 보험사 연락과 접수 번호 확인까지 저희가 도와드립니다." },
  { title: "차량 입고", body: "공업사 입고와 수리 진행 상황을 함께 챙깁니다. 공업사가 없으시면 연결해 드립니다." },
  { title: "대차 배송", body: "계신 곳으로 차를 가져다 드립니다. 수리가 끝나면 저희가 회수합니다." },
];

const FAQ = [
  { q: "정말 제가 낼 돈이 없나요?", a: "상대방 과실이 100%인 사고라면 대차료는 상대 보험사가 부담합니다. 쌍방 과실인 경우에는 과실 비율에 따라 달라질 수 있어 접수하실 때 미리 안내드립니다." },
  { q: "차는 언제 받을 수 있나요?", a: "지역과 시간대에 따라 다르지만 보통 접수 당일이나 다음 날 오전에 원하시는 곳으로 가져다 드립니다." },
  { q: "공업사를 아직 못 정했어요.", a: "괜찮습니다. 가까운 곳이나 차종에 맞는 공업사를 함께 찾아 드립니다." },
  { q: "제 보험(자차)으로도 되나요?", a: "가입하신 보험의 대차 특약 여부에 따라 다릅니다. 보험 증권 내용을 알려 주시면 확인해 드립니다." },
  { q: "대차 기간은 얼마나 되나요?", a: "원칙적으로 수리가 끝날 때까지입니다. 보험사가 인정하는 수리 기간 기준으로 안내드립니다." },
];

export default async function AccidentPage() {
  const cars = (await listCars({ type: "accident" })).slice(0, 8);

  return (
    <>
      <section className="bg-site-dark text-white">
        <div className="site-container py-16 sm:py-24">
          <p className="inline-block rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">24시간 사고 접수 · {SITE.phone}</p>
          <h1 className="mt-5 text-4xl leading-tight font-extrabold tracking-tight sm:text-6xl">
            사고 수습은<br />저희가 하겠습니다
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/75">
            수리하시는 동안 타실 차를 보험 처리로 가져다 드립니다. 고객님은 연락만 주세요.
          </p>
          <div className="mt-8 flex flex-col gap-2 sm:flex-row">
            <a href={telHref(SITE.phone)} className="site-btn h-14 px-8 text-base">전화로 접수 {SITE.phone}</a>
            <Link href="/contact?service=사고대차" className="site-btn site-btn--line h-14 border-white/30 bg-transparent px-8 text-base text-white hover:border-white hover:bg-transparent">온라인 접수</Link>
          </div>
        </div>
      </section>

      <section className="site-container grid gap-4 py-14 sm:grid-cols-3">
        {HIGHLIGHTS.map((h) => (
          <div key={h.title} className="rounded-2xl bg-site-bg p-6">
            <p className="text-3xl font-extrabold text-brand">{h.big}</p>
            <p className="mt-1 font-bold">{h.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-site-ink-2">{h.body}</p>
          </div>
        ))}
      </section>

      <section className="bg-site-bg">
        <div className="site-container py-16 sm:py-20">
          <p className="site-eyebrow">PROCESS</p>
          <h2 className="site-h2 mt-2">접수부터 반납까지<br />한 곳에서 끝납니다</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl bg-white p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand font-extrabold text-white">{i + 1}</span>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-site-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="site-container grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-2">
        <div>
          <p className="site-eyebrow">UPGRADE</p>
          <h2 className="site-h2 mt-2">타시던 차보다<br />작은 차는 드리지 않습니다</h2>
          <ul className="mt-6 space-y-2 text-site-ink-2">
            <li>✓ 배기량·차급 기준 동급 이상으로 배차</li>
            <li>✓ SUV·승합·전기차도 같은 형태로 배차</li>
            <li>✓ 상위 급으로 배차돼도 추가 비용 없음</li>
          </ul>
          <p className="mt-6 text-sm text-site-gray">제조사·모델·연식을 알려 주시면 맞는 차량을 바로 확인해 드립니다.</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-site-line p-6">
          <div className="flex-1 rounded-xl bg-site-bg p-5 text-center">
            <p className="text-xs text-site-gray">타시던 차</p>
            <p className="mt-1 text-lg font-bold">중형 세단</p>
          </div>
          <span className="text-2xl text-brand" aria-hidden>→</span>
          <div className="flex-1 rounded-xl bg-brand-soft p-5 text-center">
            <p className="text-xs text-brand">배차 차량</p>
            <p className="mt-1 text-lg font-bold text-brand">중형 이상</p>
          </div>
        </div>
      </section>

      {cars.length > 0 && (
        <section className="bg-site-bg">
          <div className="site-container py-16 sm:py-20">
            <p className="site-eyebrow">CARS</p>
            <h2 className="site-h2 mt-2">사고대차로 나가는 차량</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cars.map((c) => <CarCard key={c.id} car={c} type="accident" hidePrice />)}
            </div>
          </div>
        </section>
      )}

      <section className="site-container max-w-3xl py-16 sm:py-20">
        <p className="site-eyebrow">FAQ</p>
        <h2 className="site-h2 mt-2">자주 묻는 질문</h2>
        <div className="mt-8 divide-y divide-site-line border-y border-site-line">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
                {f.q}
                <span className="text-xl text-site-gray transition group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-site-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-brand text-white">
        <div className="site-container flex flex-col items-start justify-between gap-6 py-12 sm:flex-row sm:items-center">
          <div>
            <p className="text-2xl font-extrabold">지금 바로 접수하세요</p>
            <p className="mt-1 text-white/80">{SITE.accidentHours}</p>
          </div>
          <a href={telHref(SITE.phone)} className="site-btn h-14 bg-white px-8 text-base text-brand hover:bg-white/90">{SITE.phone}</a>
        </div>
      </section>
    </>
  );
}
