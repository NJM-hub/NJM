import type { Metadata } from "next";
import { SigninForm } from "@/components/site/SigninForm";

export const metadata: Metadata = { title: "로그인", robots: { index: false } };

export default function SigninPage() {
  return (
    <div className="site-container max-w-md py-10 sm:py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">로그인</h1>
      <p className="mt-2 mb-8 text-site-ink-2">쿠폰과 상담 내역을 확인하세요.</p>
      <SigninForm />
    </div>
  );
}
