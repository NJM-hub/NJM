import type { Metadata } from "next";
import Link from "next/link";
import { eventPeriod, isEnded, listEvents, type SiteEvent } from "@/lib/site/events";

export const metadata: Metadata = { title: "이벤트", description: "진행 중인 이벤트와 혜택을 확인하세요." };

// 종료일이 지나면 "종료"로 옮겨지도록 한 시간마다 다시 만든다.
export const revalidate = 3600;

function EventCard({ e, ended }: { e: SiteEvent; ended?: boolean }) {
  return (
    <Link href={`/events/${e.id}`} className={`group block overflow-hidden rounded-2xl border border-site-line bg-white transition hover:-translate-y-0.5 hover:shadow-lg ${ended ? "opacity-60" : ""}`}>
      <div className="aspect-[16/9] bg-site-bg">
        {e.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-brand-soft px-6 text-center text-xl font-extrabold text-brand">{e.title}</div>
        )}
      </div>
      <div className="p-5">
        <p className="text-xs font-semibold text-site-gray">{ended ? "종료" : "진행 중"} · {eventPeriod(e)}</p>
        <h3 className="mt-1 text-lg font-bold">{e.title}</h3>
        {e.summary && <p className="mt-1 line-clamp-2 text-sm text-site-ink-2">{e.summary}</p>}
      </div>
    </Link>
  );
}

export default async function EventsPage() {
  const events = await listEvents();
  const ongoing = events.filter((e) => !isEnded(e));
  const ended = events.filter((e) => isEnded(e));

  return (
    <>
      <section className="border-b border-site-line bg-site-bg">
        <div className="site-container py-10 sm:py-14">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">이벤트</h1>
          <p className="mt-2 text-site-ink-2">지금 받을 수 있는 혜택을 모았습니다.</p>
        </div>
      </section>
      <section className="site-container py-10">
        {ongoing.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{ongoing.map((e) => <EventCard key={e.id} e={e} />)}</div>
        ) : (
          <div className="rounded-2xl bg-site-bg px-6 py-16 text-center">
            <p className="font-semibold">진행 중인 이벤트가 없습니다.</p>
            <p className="mt-1 text-sm text-site-ink-2">새 이벤트가 열리면 이곳에서 알려 드리겠습니다.</p>
          </div>
        )}
        {ended.length > 0 && (
          <>
            <h2 className="mt-14 mb-5 text-xl font-bold">종료된 이벤트</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{ended.map((e) => <EventCard key={e.id} e={e} ended />)}</div>
          </>
        )}
      </section>
    </>
  );
}
