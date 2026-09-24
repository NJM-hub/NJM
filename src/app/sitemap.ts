import type { MetadataRoute } from "next";
import { listCars } from "@/lib/site/cars";
import { listEvents } from "@/lib/site/events";
import { siteUrl } from "@/lib/site/url";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages = ["", "/accident", "/short", "/rent", "/long", "/cars", "/about", "/events", "/faq", "/contact", "/privacy"];
  const [cars, events] = await Promise.all([listCars(), listEvents()]);
  return [
    ...pages.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...cars.map((c) => ({ url: `${base}/cars/${c.id}`, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...events.map((e) => ({ url: `${base}/events/${e.id}`, changeFrequency: "monthly" as const, priority: 0.4 })),
  ];
}
