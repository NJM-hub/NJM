/**
 * 지도 검색어 변형. KKday 주소는 한글/영문/한자가 섞여 있고 층·호수가 붙어 있어
 * 그대로 검색하면 실패하는 경우가 많다. 성공 가능성이 높은 순서로 돌려준다.
 */
export function queryVariants(addr: string): string[] {
  const base = addr
    .replace(/[一-鿿぀-ヿ]+/g, " ") // 한자·일본어 (南韓, 中區 등)
    .replace(/\b(South Korea|Republic of Korea|Korea)\b/gi, " ")
    .replace(/대한민국/g, " ")
    .replace(/^\s*no\.?\s*\d+\s*,/i, " ") // "no.402, 65-5 ..."
    .replace(/\s*,\s*(,\s*)*/g, ", ")
    .replace(/(^[\s,]+|[\s,]+$)/g, "")
    .replace(/\s+/g, " ");

  // 층·호수·건물명 꼬리 제거
  const noUnit = base
    .replace(/,?\s*\d+F(\s*-\s*\d+F)?,?/gi, " ")
    .replace(/\s+\d*\s*층.*$/, "")
    .replace(/\s+B?\d+\s*호.*$/, "")
    .replace(/(\d+(?:-\d+)?)\s+[가-힣A-Za-z]*(빌딩|호텔|타워|센터).*$/, "$1")
    .replace(/\s+/g, " ")
    .replace(/(^[\s,]+|[\s,]+$)/g, "");

  // 한글 도로명 주소: "... ○○로/길 12-3" 까지만
  const roadKo = noUnit.match(/^.*?[가-힣0-9]+(?:로|길)\s*\d+(?:-\d+)?/)?.[0];
  // 영문 도로명: "46 Baekjegobun-ro 15-gil" + ", Seoul"
  const roadEn = noUnit.match(/\d+(?:-\d+)?\s+[A-Za-z]+(?:[- ][A-Za-z0-9()]+)*-(?:ro|gil|daero)(?:\s+\d+[a-z]*-gil)?/i)?.[0];

  const out = [noUnit, roadKo, roadEn ? `${roadEn}, Seoul` : null, base, addr.trim()];
  return [...new Set(out.filter((q): q is string => !!q && q.trim().length >= 2))];
}
