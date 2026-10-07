/**
 * 한 달 배차처럼 건수가 많은 조회를 끝까지 받아온다.
 * 한 번에 PAGE(3000)건씩 요청하고, 서버 설정(max-rows)이 더 작아 덜 오면 받은 만큼 넘어가며 이어 받는다.
 * page(from, to) 는 매번 새 쿼리를 만들어 .order("id").range(from, to) 를 붙여 돌려줘야 한다.
 */
export const PAGE = 3000;

export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  size = PAGE,
): Promise<T[]> {
  const out: T[] = [];
  for (;;) {
    const { data, error } = await page(out.length, out.length + size - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) return out;
    out.push(...data);
  }
}
