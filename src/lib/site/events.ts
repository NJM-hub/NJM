import "server-only";
import { todayKst } from "@/lib/format";
import { publicClient } from "./db";

export type SiteEvent = {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  image_url: string | null;
  starts_on: string | null;
  ends_on: string | null;
  published: boolean;
  created_at: string;
};

export const isEnded = (e: SiteEvent, today = todayKst()) => !!e.ends_on && e.ends_on < today;

export function eventPeriod(e: SiteEvent): string {
  if (!e.starts_on && !e.ends_on) return "상시 진행";
  if (!e.ends_on) return `${e.starts_on} ~ 별도 안내 시까지`;
  return `${e.starts_on ?? ""} ~ ${e.ends_on}`;
}

export async function listEvents(): Promise<SiteEvent[]> {
  const db = publicClient();
  if (!db) return [];
  const { data, error } = await db.from("events").select("*").eq("published", true).order("created_at", { ascending: false }).limit(100);
  if (error) console.error("events 조회 실패", error.message);
  return (data ?? []) as SiteEvent[];
}

export async function getEvent(id: string): Promise<SiteEvent | null> {
  const db = publicClient();
  if (!db || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db.from("events").select("*").eq("id", id).eq("published", true).maybeSingle();
  return (data as SiteEvent | null) ?? null;
}
