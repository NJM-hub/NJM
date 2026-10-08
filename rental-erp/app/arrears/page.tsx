import Link from "next/link";
import { agingTone, where } from "@/components/lists";
import { Badge, Card, Empty, PageHeader, StatCard, Table } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { AGING_BUCKETS } from "@/lib/constants";
import { getSnapshot } from "@/lib/data";
import { fmtDate, monthLabel } from "@/lib/dates";
import { num, won, wonShort } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ArrearsPage({ searchParams }: { searchParams: Promise<{ bucket?: string }> }) {
  await requirePage();
  const { bucket } = await searchParams;
  const { snap: s } = await getSnapshot();
  const sumBucket = (b: string) => s.arrears.filter((a) => a.bucket === b);
  const list = bucket ? s.arrears.filter((a) => a.bucket === bucket) : s.arrears;
  const tones = ["yellow", "orange", "orange", "red"] as const;
  // 미납 개월수 = 납부일이 지났는데 다 못 받은 달 (일부만 받은 달도 1개월)
  const months = (items: typeof s.arrears) => items.reduce((x, a) => x + a.charges.length, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="🔴 미납관리"
        desc="납부일이 지났는데 입금되지 않은 금액 (총 미납액 = 청구액 - 실제 입금액). 미납 기간은 가장 오래된 미납 월 기준."
        actions={
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- 파일 다운로드
          <a href="/api/export/arrears" className="btn-secondary">
            엑셀 다운로드
          </a>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="총 미납" value={wonShort(s.totals.unpaid)} sub={`${s.arrears.length}명 · ${months(s.arrears)}개월`} tone={s.totals.unpaid ? "red" : "green"} href="/arrears" />
        {AGING_BUCKETS.map((b, i) => (
          <StatCard key={b} label={b} value={wonShort(sumBucket(b).reduce((x, a) => x + a.total, 0))} sub={`${sumBucket(b).length}명 · ${months(sumBucket(b))}개월`} tone={sumBucket(b).length ? tones[i] : "gray"} href={`/arrears?bucket=${encodeURIComponent(b)}`} />
        ))}
      </div>
      <Card title={bucket ? `${bucket} 미납` : "미납 목록"} actions={bucket && <Link href="/arrears" className="link">전체 보기</Link>}>
        {list.length === 0 ? (
          <Empty>미납이 없습니다 👍</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>임차인</th>
                <th>부동산 / 호실</th>
                <th>연락처</th>
                <th>미납 월</th>
                <th className="num">미납 개월</th>
                <th className="num">미납기간</th>
                <th>구분</th>
                <th className="num">총 미납액</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.contract.id} className={a.days > 90 ? "bg-red-50" : ""}>
                  <td>
                    <Link href={`/contracts/${a.contract.id}`} className={`link ${a.days > 90 ? "!text-red-700" : ""}`}>
                      {a.tenant?.name}
                    </Link>
                  </td>
                  <td>{where(a.property, a.unit)}</td>
                  <td>{a.tenant?.phone ? <a href={`tel:${a.tenant.phone}`} className="link">{a.tenant.phone}</a> : "-"}</td>
                  <td className="text-xs whitespace-normal">
                    {a.charges.map((c) => (
                      <div key={c.charge.id}>
                        {monthLabel(c.charge.billing_month)} {num(c.unpaid)}원 <span className="text-slate-400">({fmtDate(c.charge.due_date)}, {c.days}일)</span>
                      </div>
                    ))}
                  </td>
                  <td className={`num font-bold ${a.days > 90 ? "text-red-700" : "text-red-600"}`}>{a.charges.length}개월</td>
                  <td className={`num font-semibold ${a.days > 90 ? "text-red-700" : ""}`}>{a.days}일</td>
                  <td>
                    <Badge tone={agingTone(a.days)}>{a.bucket}</Badge>
                  </td>
                  <td className={`num font-bold ${a.days > 90 ? "text-red-700" : "text-red-600"}`}>{won(a.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={4}>합계 ({list.length}명)</td>
                <td className="num text-red-600">{months(list)}개월</td>
                <td colSpan={2} />
                <td className="num text-red-600">{won(list.reduce((x, a) => x + a.total, 0))}</td>
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>
    </div>
  );
}
