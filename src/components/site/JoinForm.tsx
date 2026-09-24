"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PHONE_RE } from "@/lib/site/validate";

export function JoinForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name")).trim();
    const phone = String(f.get("phone")).trim();
    const email = String(f.get("email")).trim();
    const password = String(f.get("password"));
    if (!name) return setError("이름을 입력해 주세요.");
    if (!PHONE_RE.test(phone)) return setError("연락처를 정확히 입력해 주세요. (예: 010-1234-5678)");
    if (password.length < 8) return setError("비밀번호는 8자 이상이어야 합니다.");
    if (password !== String(f.get("password2"))) return setError("비밀번호가 일치하지 않습니다.");
    if (f.get("privacy") !== "on") return setError("개인정보 수집 및 이용에 동의해 주세요.");

    setLoading(true);
    setError(null);
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/mypage`,
        data: { account_type: "customer", name, phone, marketing_consent: f.get("marketing") === "on" ? "true" : "false" },
      },
    });
    setLoading(false);
    if (error) return setError(error.message.includes("already registered") ? "이미 가입된 이메일입니다." : error.message);
    if (!data.session) return setSentTo(email);
    router.replace("/mypage");
    router.refresh();
  }

  if (sentTo) {
    return (
      <div className="rounded-2xl bg-site-bg px-6 py-12 text-center">
        <p className="text-4xl" aria-hidden>✉️</p>
        <h2 className="mt-3 text-xl font-extrabold">메일을 확인해 주세요</h2>
        <p className="mt-2 text-site-ink-2"><b>{sentTo}</b>로 가입 확인 메일을 보냈습니다. 메일의 링크를 누르면 가입이 완료됩니다.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="site-label" htmlFor="name">이름</label>
        <input id="name" name="name" required maxLength={30} autoComplete="name" className="site-input" />
      </div>
      <div>
        <label className="site-label" htmlFor="phone">휴대폰 번호</label>
        <input id="phone" name="phone" type="tel" required inputMode="tel" placeholder="010-1234-5678" autoComplete="tel" className="site-input" />
      </div>
      <div>
        <label className="site-label" htmlFor="email">이메일 (아이디)</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="site-input" />
      </div>
      <div>
        <label className="site-label" htmlFor="password">비밀번호 (8자 이상)</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="site-input" />
      </div>
      <div>
        <label className="site-label" htmlFor="password2">비밀번호 확인</label>
        <input id="password2" name="password2" type="password" required autoComplete="new-password" className="site-input" />
      </div>
      <div className="space-y-2 rounded-xl bg-site-bg p-4 text-sm">
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" name="privacy" required className="h-4 w-4 accent-brand" /> [필수] 개인정보 수집 및 이용 동의
        </label>
        <p className="pl-6 text-xs leading-relaxed text-site-ink-2">
          수집 항목: 이름, 휴대폰 번호, 이메일 / 목적: 회원 관리, 상담·계약 안내, 쿠폰 발급 / 보유 기간: 회원 탈퇴 시까지.{" "}
          <Link href="/privacy" className="underline">자세히</Link>
        </p>
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" name="marketing" className="h-4 w-4 accent-brand" /> [선택] 이벤트·혜택 안내 수신 동의 (문자·이메일)
        </label>
      </div>
      {error && <p className="text-sm font-semibold text-red-600" role="alert">{error}</p>}
      <button className="site-btn h-14 w-full text-base" disabled={loading}>{loading ? "가입 중..." : "가입하기"}</button>
      <p className="text-center text-sm text-site-ink-2">
        이미 회원이신가요? <Link href="/signin" className="font-bold text-site-ink underline">로그인</Link>
      </p>
    </form>
  );
}
