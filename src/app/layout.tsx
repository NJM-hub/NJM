import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "렌트카 배차 관리",
  description: "KKday 일정표 기반 자동 배차 · 기사 관리 · 원천징수 신고 자료",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
