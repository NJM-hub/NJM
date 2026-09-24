import Link from "next/link";
import { SITE, telHref } from "@/lib/site/config";
import { Icon } from "./Icon";

/** 모바일 하단 고정 바: 전화 · 카카오톡 · 상담 신청 */
export function QuickBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-site-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="flex h-16 items-stretch">
        <a href={telHref(SITE.phone)} className="flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-site-ink">
          <Icon name="phone" size={20} />
          전화문의
        </a>
        {SITE.kakaoUrl && (
          <a href={SITE.kakaoUrl} target="_blank" rel="noopener noreferrer" className="flex flex-1 flex-col items-center justify-center gap-0.5 border-l border-site-line text-xs font-semibold text-site-ink">
            <Icon name="chat" size={20} />
            카카오톡
          </a>
        )}
        <Link href="/contact" className="flex flex-[1.4] flex-col items-center justify-center bg-brand text-white">
          <span className="text-[15px] font-bold">빠른 상담 신청</span>
          <span className="text-[11px] opacity-80">1분이면 끝나요</span>
        </Link>
      </div>
    </div>
  );
}
