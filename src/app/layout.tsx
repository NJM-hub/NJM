import type { Metadata } from "next";
import { DEFAULT_SITE, DESCRIPTION, TAGLINE } from "@/lib/site/config";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${DEFAULT_SITE.name} | ${TAGLINE}`, template: `%s | ${DEFAULT_SITE.name}` },
  description: DESCRIPTION,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
