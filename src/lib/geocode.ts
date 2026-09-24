import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { LatLng } from "@/lib/dispatch/geo";
import { queryVariants } from "@/lib/geocodeQuery";

export { queryVariants };

type KakaoDoc = { x: string; y: string };

async function kakao(path: string, query: string, key: string): Promise<LatLng | null> {
  const url = `https://dapi.kakao.com/v2/local/search/${path}.json?query=${encodeURIComponent(query)}&size=1`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`kakao ${res.status}`);
  const json = (await res.json()) as { documents?: KakaoDoc[] };
  const d = json.documents?.[0];
  return d ? { lat: Number(d.y), lng: Number(d.x) } : null;
}

const NOMINATIM_INTERVAL_MS = 1100; // OpenStreetMap 이용 정책: 초당 1회 이하
let lastNominatim = 0;

/** OpenStreetMap(Nominatim) 무료 지오코딩. 키가 필요 없지만 초당 1회로 제한된다 */
async function nominatim(query: string): Promise<LatLng | null> {
  const wait = lastNominatim + NOMINATIM_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
    countrycodes: "kr",
    "accept-language": "ko",
  })}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "njm-rentcar-dispatch/1.0 (https://njm-rentcar.vercel.app)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const json = (await res.json()) as { lat: string; lon: string }[];
  return json[0] ? { lat: Number(json[0].lat), lng: Number(json[0].lon) } : null;
}

/**
 * 주소/장소명 → 정확한 좌표. 결과는 DB 에 캐시한다.
 * 카카오 키가 있으면 카카오(주소 → 키워드 검색), 없으면 OpenStreetMap 을 쓴다.
 * deadline 이 지나면 남은 주소는 건너뛴다 (다음 배차 때 다시 시도).
 */
export async function geocodeAddresses(
  db: SupabaseClient,
  addresses: string[],
  deadline = Date.now() + 40_000,
): Promise<Map<string, LatLng | null>> {
  const unique = [...new Set(addresses.map((a) => a.trim()).filter(Boolean))];
  const result = new Map<string, LatLng | null>();
  if (unique.length === 0) return result;

  for (let i = 0; i < unique.length; i += 200) {
    const { data: cached } = await db.from("geocode_cache").select("address,lat,lng").in("address", unique.slice(i, i + 200));
    for (const c of cached ?? []) {
      result.set(c.address, c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : null);
    }
  }

  const key = env.kakaoKey();
  const provider = key ? "kakao" : "osm";
  const search = key
    ? async (q: string) => (await kakao("address", q, key)) ?? (await kakao("keyword", q, key))
    : nominatim;

  const missing = unique.filter((a) => !result.has(a));
  const rows: { address: string; lat: number | null; lng: number | null; provider: string }[] = [];
  for (const addr of missing) {
    if (Date.now() > deadline) break;
    let pos: LatLng | null = null;
    let failed = false;
    for (const q of queryVariants(addr)) {
      if (Date.now() > deadline) {
        failed = true;
        break;
      }
      try {
        pos = await search(q);
      } catch {
        failed = true; // 일시 오류(속도 제한 등)는 캐시하지 않고 다음에 다시 시도
        break;
      }
      if (pos) break;
    }
    if (failed && !pos) continue;
    result.set(addr, pos);
    rows.push({ address: addr, lat: pos?.lat ?? null, lng: pos?.lng ?? null, provider });
  }
  if (rows.length) await db.from("geocode_cache").upsert(rows);
  return result;
}
