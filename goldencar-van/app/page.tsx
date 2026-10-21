import { AboutSection, SiteFooter } from "@/components/AboutFooter";
import GuideSection from "@/components/GuideSection";
import Hero from "@/components/Hero";
import MobileActionBar from "@/components/MobileActionBar";
import RatesSection from "@/components/RatesSection";
import ReserveSection from "@/components/ReserveSection";
import SiteHeader from "@/components/SiteHeader";
import VehicleSection from "@/components/VehicleSection";
import { site } from "@/content/site";
import { vehicles } from "@/content/vehicles";
import { phoneHref } from "@/lib/contact";

function jsonLd() {
  // 검색엔진용 구조화 데이터 — 입력된 정보만 넣습니다.
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "AutoRental",
    name: site.brand,
    alternateName: site.brandKo,
    url: site.url,
    description: site.about,
    priceRange: vehicles.map((v) => `₩${v.dailyPrice.toLocaleString("ko-KR")}`).join(" ~ "),
    makesOffer: vehicles.map((v) => ({
      "@type": "Offer",
      name: `${v.name} 1일 렌트`,
      price: v.dailyPrice,
      priceCurrency: "KRW",
    })),
  };
  if (site.contact.phone) data.telephone = site.contact.phone;
  if (site.contact.email) data.email = site.contact.email;
  if (site.business.address) data.address = site.business.address;
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd() }} />
      <SiteHeader brand={site.brand} phoneHref={phoneHref()} />
      <main>
        <Hero />
        <VehicleSection />
        <RatesSection />
        <GuideSection />
        <ReserveSection />
        <AboutSection />
      </main>
      <SiteFooter />
      <MobileActionBar />
    </>
  );
}
