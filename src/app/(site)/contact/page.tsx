import type { Metadata } from "next";
import { ContactForm } from "@/components/site/ContactForm";
import { SITE, telHref } from "@/lib/site/config";

export const metadata: Metadata = { title: "상담 신청", description: "연락처를 남겨 주시면 담당자가 바로 연락드립니다." };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ service?: string; car?: string }> }) {
  const { service, car } = await searchParams;
  return (
    <div className="site-container max-w-2xl py-10 sm:py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">상담 신청</h1>
      <p className="mt-2 mb-8 text-site-ink-2">
        연락처를 남겨 주시면 담당자가 바로 전화드립니다. 급하시면{" "}
        <a href={telHref(SITE.phone)} className="font-bold text-site-ink">{SITE.phone}</a>
      </p>
      <ContactForm service={service} car={car?.slice(0, 100)} />
    </div>
  );
}
