"use client";
import { useState } from "react";

export type InCallDay = { date: string; count: number; amount: number };
export type InCallDriver = { name: string; count: number; amount: number };

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
/** 막대 색 (단일 계열) */
const BAR = "#2a78d6";

/** 눈금: 0, 중간, 최대를 보기 좋은 정수로 */
function ticksOf(max: number): number[] {
  const top = Math.max(1, max);
  const step = top <= 4 ? 1 : Math.ceil(top / 4);
  const out: number[] = [];
  for (let v = 0; v <= top; v += step) out.push(v);
  if (out[out.length - 1] < top) out.push(out[out.length - 1] + step);
  return out;
}

/** 외부에서 받은 콜(기사 자체 콜) 그래프: 날짜별 건수 / 기사별 건수 */
export function InCallChart({ month, days, drivers }: { month: string; days: InCallDay[]; drivers: InCallDriver[] }) {
  const [view, setView] = useState<"day" | "driver">("day");
  const mon = Number(month.slice(5));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold">{mon}월 외부에서 받은 콜 그래프</h3>
        <div className="flex overflow-hidden rounded-lg border border-gray-300 text-sm" role="tablist">
          {([["day", "날짜별"], ["driver", "기사별"]] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={view === k}
              onClick={() => setView(k)}
              className={`px-3 py-1 ${view === k ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-500">막대에 마우스를 올리면 건수와 별도 수금액이 보입니다.</span>
      </div>
      {view === "day" ? <DayChart month={month} days={days} /> : <DriverChart drivers={drivers} />}
    </div>
  );
}

function DayChart({ month, days }: { month: string; days: InCallDay[] }) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDate = new Map(days.map((d) => [d.date, d]));
  const all = Array.from({ length: last }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    return byDate.get(date) ?? { date, count: 0, amount: 0 };
  });
  const ticks = ticksOf(Math.max(0, ...all.map((d) => d.count)));
  const top = ticks[ticks.length - 1];
  const peak = all.reduce((b, d) => (d.count > b.count ? d : b), all[0]);
  const H = 200;

  return (
    <div className="flex gap-2 pt-3">
      {/* y축 눈금 */}
      <div className="relative w-6 shrink-0 text-right text-[11px] text-gray-500" style={{ height: H }}>
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: (t / top) * H - 6 }}>{t}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-x-auto">
        <div className="relative" style={{ height: H, minWidth: last * 18 }}>
          {/* 가는 가로 격자선 */}
          {ticks.map((t) => (
            <div key={t} className={`absolute inset-x-0 border-t ${t === 0 ? "border-gray-400" : "border-gray-100"}`} style={{ bottom: (t / top) * H }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {all.map((d) => {
              const dow = new Date(Date.UTC(y, m - 1, Number(d.date.slice(8)))).getUTCDay();
              return (
                <div key={d.date} className="group relative flex h-full flex-1 items-end justify-center" aria-label={`${Number(d.date.slice(8))}일 ${d.count}건`}>
                  {d.count > 0 && (
                    <div className="w-full max-w-[18px] rounded-t-[4px]" style={{ height: (d.count / top) * H, background: BAR }} />
                  )}
                  {/* 가장 많은 날만 숫자 표시 */}
                  {d === peak && d.count > 0 && (
                    <span className="absolute text-[11px] font-semibold text-gray-700" style={{ bottom: (d.count / top) * H + 2 }}>{d.count}</span>
                  )}
                  {/* 마우스를 올렸을 때 */}
                  <div className="pointer-events-none absolute top-0 z-10 hidden whitespace-nowrap rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 shadow-md group-hover:block">
                    <div className="font-semibold">{m}/{Number(d.date.slice(8))} ({WEEKDAY[dow]})</div>
                    <div>{d.count}건 · 별도 수금 {won(d.amount)}</div>
                  </div>
                  <div className="absolute inset-0 group-hover:bg-gray-900/5" />
                </div>
              );
            })}
          </div>
        </div>
        {/* x축: 날짜 (5일 간격) */}
        <div className="flex gap-[2px] pt-1 text-[11px] text-gray-500" style={{ minWidth: last * 18 }}>
          {all.map((d, i) => (
            <div key={d.date} className="flex-1 text-center">{i === 0 || (i + 1) % 5 === 0 ? i + 1 : ""}</div>
          ))}
        </div>
      </div>
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
