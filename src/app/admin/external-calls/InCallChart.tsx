export type InCallDriver = { name: string; count: number; amount: number };

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
/** 막대 색 (단일 계열) */
const BAR = "#2a78d6";

/** 외부에서 받은 콜(기사 자체 콜) 그래프: 기사별 건수 */
export function InCallChart({ month, drivers }: { month: string; drivers: InCallDriver[] }) {
  const mon = Number(month.slice(5));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold">{mon}월 외부에서 받은 콜 · 기사별 건수</h3>
        <span className="text-xs text-gray-500">막대에 마우스를 올리면 별도 수금액이 보입니다.</span>
      </div>
      <DriverChart drivers={drivers} />
    </div>
  );
}

function DriverChart({ drivers }: { drivers: InCallDriver[] }) {
  const list = [...drivers].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"));
  const max = Math.max(1, ...list.map((d) => d.count));
  if (!list.length) return <p className="text-sm text-gray-500">외부에서 받은 콜이 없습니다.</p>;
  return (
    <div className="space-y-[2px]">
      {list.map((d) => (
        <div key={d.name} className="group relative flex items-center gap-2 rounded py-1 hover:bg-gray-50">
          <div className="w-36 shrink-0 truncate text-right text-xs text-gray-700" title={d.name}>{d.name}</div>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="h-4 rounded-r-[4px]" style={{ width: `${(d.count / max) * 100}%`, minWidth: 4, background: BAR }} />
            <span className="shrink-0 text-xs font-medium text-gray-700">{d.count}건</span>
          </div>
          <div className="pointer-events-none absolute left-40 top-full z-10 mt-0.5 hidden whitespace-nowrap rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 shadow-md group-hover:block">
            <div className="font-semibold">{d.name}</div>
            <div>{d.count}건 · 별도 수금 {won(d.amount)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
