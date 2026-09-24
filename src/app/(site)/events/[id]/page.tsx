import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eventPeriod, getEvent, isEnded } from "@/lib/site/events";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = await getEvent((await params).id);
  return { title: e?.title ?? "이벤트", description: e?.summary ?? undefined };
}

export default async function EventDetail({ params }: Props) {
  const e = await getEvent((await params).id);
  if (!e) notFound();
  const ended = isEnded(e);

  return (
    <article className="site-container max-w-3xl py-8 sm:py-12">
      <Link href="/events" className="text-sm font-semibold text-site-gray hover:text-site-ink">‹ 이벤트 목록</Link>
      <p className="mt-6 text-sm font-semibold text-brand">{ended ? "종료된 이벤트" : "진행 중"} · {eventPeriod(e)}</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{e.title}</h1>
      {e.summary && <p className="mt-3 text-lg text-site-ink-2">{e.summary}</p>}
      {e.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.image_url} alt="" className="mt-8 w-full rounded-2xl" />
      )}
      {e.body && <div className="mt-8 leading-relaxed whitespace-pre-line text-site-ink-2">{e.body}</div>}
      {!ended && (
        <div className="mt-10 rounded-2xl bg-site-bg p-6 text-center">
          <p className="font-bold">이벤트 혜택으로 상담받아 보세요</p>
          <Link href={`/contact?${new URLSearchParams({ event: e.title })}`} className="site-btn mt-4">상담 신청</Link>
        </div>
      )}
    </article>
  );
}
