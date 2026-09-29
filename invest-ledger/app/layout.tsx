import type { Metadata, Viewport } from "next";
import { logoutAction } from "@/app/login/actions";
import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { roleLabel } from "@/lib/permissions";
import "./globals.css";

export const metadata: Metadata = {
  title: "투자 회수 장부",
  description: "투자 실행 및 회수 관리 장부",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f1f3a",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="ko">
      <head>
        {/* 한글 글꼴 (Pretendard) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        {user ? (
          <AppShell user={{ name: user.name, email: user.email, roleLabel: roleLabel(user.role), isAdmin: user.role === "admin" }} logout={logoutAction}>
            {children}
          </AppShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
