import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { LatLng } from "@/lib/dispatch/geo";

type KakaoDoc = { x: string; y: string };

async function kakao(path: string, query: string, key: string): Promise<LatLng | null> {
  const url = `https://dapi.kakao.com/v2/local/search/${path}.json?query=${encodeURIComponent(query)}&size=1`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { documents?: KakaoDoc[] };
  const d = json.documents?.[0];
  return d ? { lat: Number(d.y), lng: Number(d.x) } : null;
}

/** 주소 → 좌표. 카카오 주소검색 후 실패하면 키워드(호텔명 등) 검색. 결과는 DB 에 캐시 */
export async function geocodeAddresses(
  db: SupabaseClient,
  addresses: string[],
): Promise<Map<string, LatLng | null>> {
  const unique = [...new Set(addresses.map((a) => a.trim()).filter(Boolean))];
  const result = new Map<string, LatLng | null>();
  if (unique.length === 0) return result;

  const { data: cached } = await db.from("geocode_cache").select("address,lat,lng").in("address", unique);
  for (const c of cached ?? []) {
    result.set(c.address, c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : null);
  }

  const key = env.kakaoKey();
  if (!key) return result;

  const missing = unique.filter((a) => !result.has(a));
  const rows: { address: string; lat: number | null; lng: number | null; provider: string }[] = [];
  // 카카오 API 초당 호출 제한을 고려해 5개씩 처리
  for (let i = 0; i < missing.length; i += 5) {
    await Promise.all(
      missing.slice(i, i + 5).map(async (addr) => {
        let pos: LatLng | null = null;
        try {
          pos = (await kakao("address", addr, key)) ?? (await kakao("keyword", addr, key));
        } catch {
          pos = null;
        }
        result.set(addr, pos);
        rows.push({ address: addr, lat: pos?.lat ?? null, lng: pos?.lng ?? null, provider: "kakao" });
      }),
    );
  }
  if (rows.length) await db.from("geocode_cache").upsert(rows);
  return result;
}
