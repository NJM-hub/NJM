import Link from "next/link";
import { site } from "@/content/site";

export default function LegalPage({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-screen bg-white">
      <header className="bg-ink-900">
        <div className="container-page flex h-16 items-center">
          <Link href="/" className="text-xl font-extrabold tracking-wide text-gold-300">
            {site.brand.toUpperCase()}
          </Link>
        </div>
      </header>
      <article className="container-page max-w-3xl py-14">
        <h1 className="text-3xl font-bold">{title}</h1>
        {body ? (
          <div className="mt-8 leading-relaxed whitespace-pre-line text-neutral-800">{body}</div>
        ) : (
          <p className="mt-8 rounded-2xl bg-neutral-50 p-6 text-neutral-600">
            {title} 내용을 준비하고 있습니다. 궁금하신 점은 예약 문의나 전화로 연락해 주세요.
          </p>
        )}
        <Link href="/" className="btn-outline-dark mt-10">
          홈으로
        </Link>
      </article>
    </main>
  );
}
