import { ChatIcon, PhoneIcon } from "@/components/Icons";
import { kakaoHref, phoneHref } from "@/lib/contact";

// 전화·카카오톡 버튼. 번호/링크가 아직 없으면 예약 문의 양식으로 연결합니다.
// hideIfMissing: 예약 양식 안처럼 양식으로 되돌아가는 게 의미 없는 곳에서는 아예 숨김.

type Props = { className?: string; label?: string; hideIfMissing?: boolean };

export function PhoneButton({ className = "btn-outline-dark", label = "전화 상담하기", hideIfMissing = false }: Props) {
  const href = phoneHref();
  if (!href && hideIfMissing) return null;
  return (
    <a href={href ?? "#reserve"} className={className}>
      <PhoneIcon />
      {label}
    </a>
  );
}

export function KakaoButton({ className = "btn-kakao", label = "카카오톡 문의하기", hideIfMissing = false }: Props) {
  const href = kakaoHref();
  if (!href && hideIfMissing) return null;
  return (
    <a href={href ?? "#reserve"} className={className} {...(href ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      <ChatIcon />
      {label}
    </a>
  );
}
