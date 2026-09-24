import type { Metadata } from "next";
import { FavoritesList } from "@/components/site/FavoritesList";

export const metadata: Metadata = { title: "찜한 차량", robots: { index: false } };

export default function FavoritesPage() {
  return (
    <>
      <section className="border-b border-site-line bg-site-bg">
        <div className="site-container py-10 sm:py-14">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">찜한 차량</h1>
          <p className="mt-2 text-site-ink-2">이 기기에서 찜한 차량입니다. 로그인하지 않아도 됩니다.</p>
        </div>
      </section>
      <section className="site-container py-10">
        <FavoritesList />
      </section>
    </>
  );
}
