"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** 헤더의 로그인 / 마이페이지 링크. 페이지를 정적으로 두기 위해 브라우저에서 로그인 여부를 확인한다. */
export function AccountLink({ className, onClick }: { className?: string; onClick?: () => void }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return; // Supabase 환경변수가 없는 로컬 미리보기
    }
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <Link href={signedIn ? "/me" : "/signin"} className={className} onClick={onClick}>
      {signedIn ? "마이페이지" : "로그인"}
    </Link>
  );
}
