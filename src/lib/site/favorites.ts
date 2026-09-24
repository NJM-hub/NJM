"use client";
import { useSyncExternalStore } from "react";

// 찜 목록은 로그인 없이 이 브라우저에만 저장한다.
const KEY = "woojung:favorites";
const EVENT = "woojung:favorites-change";
const EMPTY: string[] = [];
let cachedRaw: string | null = null;
let cachedIds: string[] = EMPTY;

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const parsed = JSON.parse(raw ?? "[]");
      cachedIds = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : EMPTY;
    } catch {
      cachedIds = EMPTY;
    }
  }
  return cachedIds;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useFavorites(): string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function toggleFavorite(id: string) {
  const ids = read();
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids].slice(0, 100);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 무시
  }
  window.dispatchEvent(new Event(EVENT));
}
