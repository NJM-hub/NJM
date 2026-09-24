"use client";
import { useActionState } from "react";
import { registerCoupon, updateProfile, withdraw, type FormState } from "@/app/(site)/mypage/actions";

function Msg({ s }: { s: FormState }) {
  return s.message ? <p className={`mt-2 text-sm font-semibold ${s.ok ? "text-green-700" : "text-red-600"}`} role="status">{s.message}</p> : null;
}

export function CouponCodeForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(registerCoupon, { ok: false });
  return (
    <form action={action} className="mt-4">
      <div className="flex gap-2">
        <input name="code" placeholder="쿠폰 코드 입력" className="site-input uppercase" aria-label="쿠폰 코드" autoComplete="off" />
        <button className="site-btn site-btn--dark h-12 shrink-0" disabled={pending}>{pending ? "등록 중" : "등록"}</button>
      </div>
      <Msg s={state} />
    </form>
  );
}

export function ProfileForm({ name, phone, marketing }: { name: string; phone: string; marketing: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, { ok: false });
  return (
    <form action={action} className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="site-label" htmlFor="name">이름</label>
          <input id="name" name="name" defaultValue={name} required maxLength={30} className="site-input" />
        </div>
        <div>
          <label className="site-label" htmlFor="phone">휴대폰 번호</label>
          <input id="phone" name="phone" type="tel" defaultValue={phone} required className="site-input" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="marketing" defaultChecked={marketing} className="h-4 w-4 accent-brand" /> 이벤트·혜택 안내 받기 (문자·이메일)
      </label>
      <button className="site-btn site-btn--line" disabled={pending}>{pending ? "저장 중..." : "저장"}</button>
      <Msg s={state} />
    </form>
  );
}

export function WithdrawForm() {
  return (
    <details className="mt-10 text-sm">
      <summary className="cursor-pointer text-site-gray">회원 탈퇴</summary>
      <form action={withdraw} className="mt-3 space-y-3 rounded-2xl bg-site-bg p-5">
        <p className="text-site-ink-2">탈퇴하면 회원 정보와 보유 쿠폰이 모두 삭제되며 되돌릴 수 없습니다. 계속하시려면 아래에 <b>탈퇴</b>라고 입력해 주세요.</p>
        <div className="flex gap-2">
          <input name="confirm" required className="site-input" aria-label="확인 문구" />
          <button className="site-btn h-12 shrink-0 bg-red-600 hover:bg-red-700">탈퇴하기</button>
        </div>
      </form>
    </details>
  );
}
