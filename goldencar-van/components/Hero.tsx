import Image from "next/image";
import { PhoneButton } from "@/components/ContactButtons";
import { priceBasisText, site } from "@/content/site";
import { formatWon, vehicles } from "@/content/vehicles";

export default function Hero() {
  const [main] = vehicles;
  return (
    <section id="top" className="relative overflow-hidden bg-ink-900 pt-16 text-white">
      {/* 배경 은은한 골드 빛 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(60% 50% at 75% 40%, rgba(207,168,74,0.25), transparent 70%)" }}
        aria-hidden="true"
      />
      <div className="container-page relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:py-24">
        <div>
          <p className="eyebrow">{site.tagline}</p>
          <h1 className="mt-4 text-[2rem] leading-tight font-extrabold tracking-tight sm:text-5xl lg:text-[3.4rem]">
            승합차 렌트,
            <br />
            <span className="text-gold-300">합리적인 가격</span>으로 편리하게
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
            여행부터 출장, 가족 나들이와 단체 이동까지 Golden Car와 함께하세요.
          </p>
          <p className="mt-3 text-sm text-white/60">가족 여행 · 출장 · 단체 이동 · 공항 이동</p>

          {/* 가격 강조 */}
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:max-w-lg">
            {vehicles.map((v) => (
              <li key={v.id} className="rounded-2xl border border-gold-400/30 bg-white/[0.04] p-4 sm:p-5">
                <p className="text-sm text-white/70">{v.shortName}</p>
                <p className="mt-1 text-2xl font-extrabold text-gold-300 sm:text-3xl">{v.headline}</p>
                <p className="mt-1 text-xs text-white/50">{formatWon(v.dailyPrice)} · 1일 기준</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-white/55">※ 요금 기준: {priceBasisText()}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href="#vehicles" className="btn-gold">
              차량 및 요금 보기
            </a>
            <a href="#reserve" className="btn-outline-light">
              렌트 문의하기
            </a>
            <PhoneButton className="btn-outline-light" />
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <Image
            src={main.image}
            alt={main.imageAlt}
            width={1200}
            height={720}
            preload
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="h-auto w-full drop-shadow-[0_30px_40px_rgba(0,0,0,0.6)]"
          />
        </div>
      </div>
    </section>
  );
}
