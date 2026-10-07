import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { fmtTime, isMonth, todayKst, tripLabel, won } from "@/lib/format";
import { loadExternalCalls, type InCall, type OutCall } from "@/lib/settlement/externalCalls";
import { StatementUpload } from "./StatementUpload";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
const dayLabel = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return `${m}/${d} (${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
};

function TripBadge({ t }: { t: string | null }) {
  const l = tripLabel(t);
  return l ? <span className={`badge ${l.className}`}>{l.label}</span> : null;
}

const amountColor = (n: number) => (n < 0 ? "text-red-600" : "text-gray-900");

export default async function ExternalCallsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : todayKst().slice(0, 7);
  const { supabase } = await requireAdmin();
  const { out, inCalls, ownCallFee } = await loadExternalCalls(supabase, month);
  const mon = Number(month.slice(5));

  // 외부로 준 콜: 날짜별 합계
  const outByDate = new Map<string, OutCall[]>();
  for (const c of out) outByDate.set(c.date, [...(outByDate.get(c.date) ?? []), c]);
  const outTotal = out.reduce((s, c) => s + c.fare, 0);
  const diffTotal = out.reduce((s, c) => s + (c.diff ?? 0), 0);
  const kkdayTotal = out.reduce((s, c) => s + (c.kkdayAmount ?? 0), 0);
  const netTotal = out.reduce((s, c) => s + (c.kkdayNet ?? 0), 0);
  const inTotal = inCalls.reduce((s, c) => s + c.settleAmount, 0);
  // 금액 칸: 정산내역서에 없으면 "-", 마이너스는 -로
  const money = (n: number | null) => (n == null ? <span className="text-gray-400">-</span> : <span className={amountColor(n)}>{won(n)}</span>);

  // 외부에서 받은 콜: 차량별 합계
  const inByVehicle = new Map<string, InCall[]>();
  for (const c of [...inCalls].sort((a, b) => (a.plate ?? "").localeCompare(b.plate ?? ""))) {
    const k = [c.plate, c.driverName].filter(Boolean).join(" ") || "(차량 없음)";
    inByVehicle.set(k, [...(inByVehicle.get(k) ?? []), c]);
  }

  return (
    <div className="space-y-6">
      <h1 className="page-title">외부 콜 정리</h1>
      <form className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="month">월</label>
          <input id="month" type="month" name="month" defaultValue={month} className="input" />
        </div>
        <button className="btn-secondary">조회</button>
        <div className="ml-auto flex flex-wrap gap-2">
          <a className="btn-secondary" href={`/admin/external-calls/export?month=${month}&type=out`}>외부로 준 콜 CSV</a>
          <a className="btn-secondary" href={`/admin/external-calls/export?month=${month}&type=in`}>외부에서 받은 콜 CSV</a>
        </div>
      </form>
      <p className="text-sm text-gray-500">
        확정된 배차 기준입니다. <b>외부로 준 콜</b>은 배차 시트 기사 칸에 금액(숫자)만 적힌 건,
        <b> 외부에서 받은 콜</b>은 시트 표 아래 기사별 칸에 적힌 기사 자체 콜입니다 (건당 −{won(ownCallFee)}, 80000·100000 처럼 금액이 적힌 콜은 −그 금액. 배차 지급액에서 빼지 않고 별도로 받는 금액입니다).
      </p>

      {/* 외부로 준 콜 */}
      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">
          {mon}월 외부로 준 콜 <span className="text-base font-normal text-gray-600">{out.length}건 · {won(outTotal)}</span>
        </h2>
        <StatementUpload />
        <p className="text-xs text-gray-500">
          건별 차액 = KKday 정산내역서의 그 예약 금액(부가세 포함)에서 부가세를 뺀 금액(÷1.1) − 외부 업체에 준 금액. 예: 60,000원 → 54,545원 − 50,000원 = 4,545원.
          정산내역서에 없는 건은 &quot;-&quot;로 표시됩니다.
        </p>
        {out.length ? (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              {[...outByDate].map(([d, list]) => (
                <span key={d} className="rounded-lg bg-gray-100 px-2 py-1">
                  {dayLabel(d)} {list.length}건 · {won(list.reduce((s, c) => s + c.fare, 0))}
                </span>
              ))}
            </div>
            <div className="max-h-[32rem] overflow-auto">
              <table className="table">
                <thead><tr><th>날짜</th><th>시간</th><th>구분</th><th>예약번호</th><th className="text-right">KKday 정산(부가세 포함)</th><th className="text-right">부가세 제외</th><th className="text-right">준 금액</th><th className="text-right">차액</th></tr></thead>
                <tbody>
                  {out.map((c) => (
                    <tr key={c.id}>
                      <td className="whitespace-nowrap"><Link className="text-blue-600" href={`/admin/dispatch?date=${c.date}`}>{dayLabel(c.date)}</Link></td>
                      <td>{c.pickupAt ? fmtTime(c.pickupAt) : ""}</td>
                      <td><TripBadge t={c.tripType} /></td>
                      <td className="text-xs">{c.bookingNo}{c.flightNo ? ` ✈${c.flightNo}` : ""}</td>
                      <td className="whitespace-nowrap text-right">{money(c.kkdayAmount)}</td>
                      <td className="whitespace-nowrap text-right">{money(c.kkdayNet)}</td>
                      <td className="whitespace-nowrap text-right">{won(c.fare)}</td>
                      <td className="whitespace-nowrap text-right font-semibold">{money(c.diff)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="font-semibold"><td colSpan={4} className="px-3 py-2">{out.length}건</td><td className="whitespace-nowrap px-3 py-2 text-right">{won(kkdayTotal)}</td><td className="whitespace-nowrap px-3 py-2 text-right">{won(netTotal)}</td><td className="whitespace-nowrap px-3 py-2 text-right">{won(outTotal)}</td><td className="whitespace-nowrap px-3 py-2 text-right">{money(diffTotal)}</td></tr></tfoot>
              </table>
            </div>
          </>
        ) : <p className="text-sm text-gray-500">{mon}월에 외부로 준 콜이 없습니다.</p>}
      </section>

      {/* 외부에서 받은 콜 */}
      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">
          {mon}월 외부에서 받은 콜 (기사 자체 콜) <span className="text-base font-normal text-gray-600">{inCalls.length}건 · <span className={amountColor(inTotal)}>{won(inTotal)}</span></span>
        </h2>
        {inCalls.length ? (
          <>
            <table className="table">
              <thead><tr><th>차량 · 기사</th><th className="text-right">건수</th><th className="text-right">시트 요금 합계</th><th className="text-right">별도 수금 합계</th></tr></thead>
              <tbody>
                {[...inByVehicle].map(([k, list]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td className="text-right">{list.length}</td>
                    <td className="text-right">{won(list.reduce((s, c) => s + (c.charterFare ?? 0), 0))}</td>
                    <td className={`text-right ${amountColor(list.reduce((s, c) => s + c.settleAmount, 0))}`}>{won(list.reduce((s, c) => s + c.settleAmount, 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="max-h-[32rem] overflow-auto">
              <table className="table">
                <thead><tr><th>날짜</th><th>시간</th><th>차량 · 기사</th><th>구분</th><th>내용 (시트 그대로)</th><th className="text-right">시트 요금</th><th className="text-right">별도 수금</th></tr></thead>
                <tbody>
                  {inCalls.map((c) => (
                    <tr key={c.id} className="bg-violet-50/40">
                      <td className="whitespace-nowrap">{dayLabel(c.date)}</td>
                      <td>{c.pickupAt ? fmtTime(c.pickupAt) : ""}</td>
                      <td className="whitespace-nowrap text-xs">{[c.plate, c.driverName].filter(Boolean).join(" ")}</td>
                      <td><TripBadge t={c.tripType} /></td>
                      <td className="text-xs">{c.content}{c.paid && <span className="badge ml-1 bg-green-100 text-green-800">입금 확인</span>}</td>
                      <td className="text-right">{c.charterFare != null ? won(c.charterFare) : ""}</td>
                      <td className={`text-right ${amountColor(c.settleAmount)}`}>{won(c.settleAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <p className="text-sm text-gray-500">{mon}월에 외부에서 받은 콜이 없습니다.</p>}
      </section>
    </div>
  );
}
