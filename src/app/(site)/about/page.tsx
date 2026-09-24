import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/site/Icon";
import { SITE, telHref } from "@/lib/site/config";
import { SERVICES } from "@/lib/site/services";

export const metadata: Metadata = { title: "브랜드소개", description: `${SITE.name}가 일하는 방식을 소개합니다.` };

// TODO: 회사에 맞게 문구를 다듬어 주세요.
const PROMISES = [
  { title: "안내한 금액 그대로", body: "상담 때 말씀드린 금액이 계약서와 결제 금액이 됩니다. 나중에 항목을 붙여 더 받지 않습니다." },
  { title: "깨끗하게 관리한 차", body: "출고 전마다 실내·외 세차와 기본 점검을 마친 차만 내보냅니다." },
  { title: "끝까지 책임지는 담당자", body: "계약부터 반납, 사고 처리까지 한 담당자가 연락을 맡습니다. 여러 곳에 전화하실 필요가 없습니다." },
];

export default function AboutPage() {
  const info = [
    ["상호", SITE.legalName], ["대표", SITE.ceo], ["사업자등록번호", SITE.brn], ["주소", SITE.address],
    ["운영시간", `${SITE.hours} (${SITE.accidentHours})`], ["대표번호", SITE.phone],
  ];
  return (
    <>
      <section className="bg-site-bg">
        <div className="site-container py-16 sm:py-24">
          <p className="site-eyebrow">BRAND</p>
          <h1 className="mt-3 text-4xl leading-tight font-extrabold tracking-tight sm:text-6xl">
            오래 타도<br />편한 렌터카
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-site-ink-2">
            {SITE.name}는 이름처럼 한 번 맺은 인연을 오래 이어 가는 것을 가장 중요하게 생각합니다.
            처음 전화를 받는 순간부터 차를 돌려받는 날까지, 다시 찾고 싶은 렌터카가 되겠습니다.
          </p>
          <Link href="/contact" className="site-btn mt-8">상담 신청</Link>
        </div>
      </section>

      <section className="site-container py-16 sm:py-20">
        <p className="site-eyebrow">OUR PROMISE</p>
        <h2 className="site-h2 mt-2">저희가 지키는 세 가지</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PROMISES.map((p, i) => (
            <div key={p.title} className="rounded-2xl border border-site-line p-7">
              <p className="text-4xl font-extrabold text-brand/25">0{i + 1}</p>
              <h3 className="mt-3 text-xl font-bold">{p.title}</h3>
              <p className="mt-3 leading-relaxed text-site-ink-2">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-site-bg">
        <div className="site-container py-16 sm:py-20">
          <p className="site-eyebrow">SERVICE</p>
          <h2 className="site-h2 mt-2">이런 일을 합니다</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s) => (
              <Link key={s.key} href={s.href} className="group rounded-2xl bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon name={s.icon} /></span>
                <h3 className="mt-4 text-lg font-bold">{s.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-site-ink-2">{s.lead}</p>
                <p className="mt-4 text-sm font-bold text-brand">자세히 보기 ›</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="site-container py-16 sm:py-20">
        <p className="site-eyebrow">COMPANY</p>
        <h2 className="site-h2 mt-2">{SITE.name}</h2>
        <dl className="mt-8 divide-y divide-site-line border-y border-site-line">
          {info.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[120px_1fr] gap-4 py-4 sm:grid-cols-[180px_1fr]">
              <dt className="text-site-ink-2">{k}</dt>
              <dd className="font-semibold">{k === "대표번호" ? <a href={telHref(v)}>{v}</a> : v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
