import type { Metadata } from "next";
import { JoinForm } from "@/components/site/JoinForm";

export const metadata: Metadata = { title: "회원가입", robots: { index: false } };

export default function JoinPage() {
  return (
    <div className="site-container max-w-md py-10 sm:py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">회원가입</h1>
      <p className="mt-2 mb-8 text-site-ink-2">가입하시면 쿠폰을 받고, 상담 내역을 한곳에서 확인할 수 있습니다.</p>
      <JoinForm />
    </div>
  );
}
