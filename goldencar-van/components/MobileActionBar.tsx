import { CalendarIcon, ChatIcon, PhoneIcon } from "@/components/Icons";
import { kakaoHref, phoneHref } from "@/lib/contact";

// 모바일 하단 고정 버튼: 전화 · 카카오톡 · 예약 문의
export default function MobileActionBar() {
  const tel = phoneHref();
  const kakao = kakaoHref();
  const item = "flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-semibold";
  return (
    <nav
      aria-label="빠른 문의"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-ink-900 pb-[env(safe-area-inset-bottom)] text-white md:hidden"
    >
      <a href={tel ?? "#reserve"} className={item}>
        <PhoneIcon />
        전화 상담
      </a>
      <a href={kakao ?? "#reserve"} className={item} {...(kakao ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        <ChatIcon className="h-5 w-5 text-[#FEE500]" />
        카카오톡
      </a>
      <a href="#reserve" className={`${item} bg-gold-400 text-ink-900`}>
        <CalendarIcon />
        예약 문의
      </a>
    </nav>
  );
}
