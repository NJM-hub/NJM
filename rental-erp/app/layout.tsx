import type { Metadata, Viewport } from "next";
import { logoutAction } from "@/app/actions/auth";
import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";
import { getScope } from "@/lib/data";
import { q } from "@/lib/db";
import { roleLabel } from "@/lib/permissions";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "임대사업 ERP + 수익분석 시스템",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f1f40",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const owners = user
    ? await q<{ id: string; name: string; owner_type: string }>("select id, name, owner_type from owners where is_active order by owner_type desc, name").catch(() => [])
    : [];
  const scope = user ? await getScope() : null;
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        {user ? (
          <AppShell
            appName={APP_NAME}
            user={{ name: user.name, email: user.email, roleLabel: roleLabel(user.role), isAdmin: user.role === "admin" }}
            owners={owners.map((o) => ({ id: o.id, name: `${o.name} (${o.owner_type === "corporation" ? "법인" : "개인"})` }))}
            scope={scope}
            logout={logoutAction}
          >
            {children}
          </AppShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
