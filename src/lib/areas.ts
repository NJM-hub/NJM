import type { LatLng } from "@/lib/dispatch/geo";

/**
 * 정확한 위치를 못 찾았을 때 쓰는 구(區) 중심 좌표.
 * 한글·영문·한자 표기를 모두 인식한다. (서울 25개 구)
 */
const SEOUL: [names: string[], lat: number, lng: number][] = [
  [["종로구", "Jongno", "鍾路區", "钟路区"], 37.5735, 126.979],
  [["중구", "Jung District", "Jung-gu", "中區", "中区"], 37.5641, 126.9979],
  [["용산구", "Yongsan", "龍山區", "龙山区"], 37.5324, 126.9907],
  [["성동구", "Seongdong", "城東區"], 37.5634, 127.0369],
  [["광진구", "Gwangjin", "廣津區"], 37.5385, 127.0823],
  [["동대문구", "Dongdaemun-gu", "東大門區"], 37.5744, 127.0396],
  [["중랑구", "Jungnang", "中浪區"], 37.6066, 127.0927],
  [["성북구", "Seongbuk", "城北區"], 37.5894, 127.0167],
  [["강북구", "Gangbuk", "江北區"], 37.6396, 127.0257],
  [["도봉구", "Dobong", "道峰區"], 37.6688, 127.0471],
  [["노원구", "Nowon", "蘆原區"], 37.6542, 127.0568],
  [["은평구", "Eunpyeong", "恩平區"], 37.6027, 126.9291],
  [["서대문구", "Seodaemun", "西大門區"], 37.5791, 126.9368],
  [["마포구", "Mapo", "麻浦區", "麻浦区"], 37.5663, 126.9019],
  [["양천구", "Yangcheon", "陽川區"], 37.517, 126.8664],
  [["강서구", "Gangseo", "江西區"], 37.5509, 126.8495],
  [["구로구", "Guro", "九老區"], 37.4954, 126.8874],
  [["금천구", "Geumcheon", "衿川區"], 37.4569, 126.8955],
  [["영등포구", "Yeongdeungpo", "永登浦區"], 37.5264, 126.8962],
  [["동작구", "Dongjak", "銅雀區"], 37.5124, 126.9393],
  [["관악구", "Gwanak", "冠岳區"], 37.4784, 126.9516],
  [["서초구", "Seocho", "瑞草區"], 37.4837, 127.0324],
  [["강남구", "Gangnam", "江南區", "江南区"], 37.5172, 127.0473],
  [["송파구", "Songpa", "松坡區", "松坡区"], 37.5145, 127.1059],
  [["강동구", "Gangdong", "江東區"], 37.5301, 127.1238],
];

// "Jung District" 가 "Jungnang" 등과 헷갈리지 않도록 긴 이름부터 비교
const NAMES = SEOUL.flatMap(([names, lat, lng]) => names.map((n) => ({ n: n.toLowerCase(), pos: { lat, lng } }))).sort(
  (a, b) => b.n.length - a.n.length,
);

// 동네 이름만 있는 경우 (예: "명동", "홍대")
const NEIGHBORHOODS: [string[], number, number][] = [
  [["명동", "myeongdong", "明洞"], 37.5637, 126.9838],
  [["홍대", "hongdae", "弘大"], 37.5563, 126.9236],
  [["동대문", "dongdaemun", "東大門"], 37.5711, 127.0095],
  [["인사동", "insadong", "仁寺洞"], 37.5741, 126.9854],
  [["광화문", "gwanghwamun", "光化門"], 37.5759, 126.9768],
  [["서울역", "seoul station"], 37.5547, 126.9707],
  [["잠실", "jamsil"], 37.5133, 127.1001],
  [["이태원", "itaewon"], 37.5345, 126.9946],
  [["남산", "namsan"], 37.5512, 126.9882],
  [["충무로", "chungmuro"], 37.5612, 126.9942],
];

export function areaLocation(...texts: (string | null | undefined)[]): LatLng | null {
  const s = texts.filter(Boolean).join(" ").toLowerCase();
  if (!s) return null;
  for (const { n, pos } of NAMES) if (s.includes(n)) return pos;
  for (const [names, lat, lng] of NEIGHBORHOODS) if (names.some((n) => s.includes(n.toLowerCase()))) return { lat, lng };
  return null;
}
