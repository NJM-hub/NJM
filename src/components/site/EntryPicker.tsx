"use client";
import Link from "next/link";
import { useState } from "react";
import { telHref, type SiteInfo } from "@/lib/site/config";
import { SERVICES, type Service, type IconName } from "@/lib/site/services";
import { Icon } from "./Icon";

function Option({ href, icon, title, desc, onClick, tone }: {
  href?: string; icon: IconName; title: string; desc: string; onClick?: () => void; tone?: "brand" | "muted";
}) {
  const cls = `group flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
    tone === "brand" ? "border-brand bg-brand text-white" : tone === "muted" ? "border-transparent bg-site-bg" : "border-site-line bg-white hover:border-site-ink"
  }`;
  const body = (
    <>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone === "brand" ? "bg-white/15" : "bg-brand-soft text-brand"}`}>
        <Icon name={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[17px] font-bold">{title}</b>
        <span className={`block text-sm ${tone === "brand" ? "text-white/80" : "text-site-ink-2"}`}>{desc}</span>
      </span>
      <span className="text-2xl opacity-40 transition group-hover:translate-x-1 group-hover:opacity-100" aria-hidden>›</span>
    </>
  );
  return href ? <Link href={href} className={cls}>{body}</Link> : <button type="button" onClick={onClick} className={cls}>{body}</button>;
}

export function EntryPicker({ info }: { info: SiteInfo }) {
  const [picked, setPicked] = useState<Service | null>(null);

  return (
    <div className="w-full max-w-[480px]">
      <p className="mb-10 text-center text-3xl font-extrabold tracking-tight">{info.name}</p>

      {!picked ? (
        <section>
          <h1 className="mb-5 text-center text-2xl font-extrabold tracking-tight">어떤 사유로 찾아오셨나요?</h1>
          <div className="space-y-3">
            {SERVICES.map((s) => (
              <Option
                key={s.key}
                icon={s.icon}
                title={s.name}
                desc={s.pick}
                // 사고대차는 안내 페이지로 바로 이동
                {...(s.key === "accident" ? { href: s.href } : { onClick: () => setPicked(s) })}
              />
            ))}
            <Option href="/about" icon="building" title={`${info.name}는 어떤 곳인가요?`} desc="저희가 일하는 방식을 소개합니다" tone="muted" />
          </div>
        </section>
      ) : (
        <section>
          <button type="button" onClick={() => setPicked(null)} className="mb-4 text-sm font-semibold text-site-gray hover:text-site-ink">
            ‹ 뒤로
          </button>
          <p className="mb-1 text-center text-sm font-bold text-brand">{picked.name}</p>
          <h1 className="mb-5 text-center text-2xl font-extrabold tracking-tight">무엇을 도와드릴까요?</h1>
          <div className="space-y-3">
            <Option href={`/contact?service=${encodeURIComponent(picked.formValue)}`} icon="chat" title="상담 신청하기" desc="연락처를 남겨 주시면 바로 전화드립니다" tone="brand" />
            <Option href={picked.href} icon="car" title="차량 둘러보기" desc="보유 차량과 요금부터 볼게요" />
          </div>
        </section>
      )}

      {info.phone && (
        <p className="mt-10 text-center text-sm text-site-ink-2">
          바로 통화를 원하시면{" "}
          <a href={telHref(info.phone)} className="font-bold text-site-ink underline underline-offset-4">{info.phone}</a>
        </p>
      )}
    </div>
  );
}
