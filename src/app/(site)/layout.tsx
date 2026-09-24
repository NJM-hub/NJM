import { QuickBar } from "@/components/site/QuickBar";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getSiteInfo } from "@/lib/site/info";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const info = await getSiteInfo();
  return (
    <div className="site flex min-h-screen flex-col">
      <SiteHeader info={info} />
      <main className="flex-1">{children}</main>
      <SiteFooter info={info} />
      <QuickBar info={info} />
    </div>
  );
}
