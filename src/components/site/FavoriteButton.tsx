"use client";
import { toggleFavorite, useFavorites } from "@/lib/site/favorites";

export function HeartIcon({ filled, size = 20 }: { filled?: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

export function FavoriteButton({ id, name, className = "", withLabel }: { id: string; name: string; className?: string; withLabel?: boolean }) {
  const on = useFavorites().includes(id);
  return (
    <button
      type="button"
      onClick={() => toggleFavorite(id)}
      aria-pressed={on}
      aria-label={on ? `${name} 찜 해제` : `${name} 찜하기`}
      className={`inline-flex items-center justify-center gap-1.5 ${on ? "text-red-500" : "text-site-gray hover:text-site-ink"} ${className}`}
    >
      <HeartIcon filled={on} />
      {withLabel && <span className="text-sm font-semibold">{on ? "찜했어요" : "찜하기"}</span>}
    </button>
  );
}

export function FavoriteCount() {
  const n = useFavorites().length;
  return n ? <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{n}</span> : null;
}
