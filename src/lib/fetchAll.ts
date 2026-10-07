/**
 * Supabase 는 한 번에 최대 1000행만 돌려준다 (서버 max-rows).
 * 한 달 배차처럼 1000행이 넘을 수 있는 조회는 id 순으로 1000행씩 끝까지 받아온다.
 * page(from, to) 는 매번 새 쿼리를 만들어 .order("id").range(from, to) 를 붙여 돌려줘야 한다.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  size = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) return out;
  }
}
