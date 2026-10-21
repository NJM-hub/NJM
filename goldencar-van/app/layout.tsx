import type { Metadata, Viewport } from "next";
import { site } from "@/content/site";
import { vehicles } from "@/content/vehicles";
import "./globals.css";

const title = `${site.brand} | 승합차 렌트 · 스타리아 하이브리드 하루 8만원 · 쏠라티 하루 20만원`;
const description = `여행부터 출장, 가족 나들이와 단체 이동까지. ${vehicles
  .map((v) => `${v.shortName} ${v.headline}`)
  .join(", ")}. ${site.brand} 승합차 전문 렌트.`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: title, template: `%s | ${site.brand}` },
  description,
  keywords: ["승합차 렌트", "스타리아 렌트", "스타리아 하이브리드 렌트", "쏠라티 렌트", "11인승 렌트카", "단체 렌트", "공항 이동", site.brandKo],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: site.brand,
    title,
    description,
  },
  twitter: { card: "summary_large_image", title, description },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d0d0f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 한글 글꼴 (Pretendard, 필요한 글자만 내려받는 방식) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
