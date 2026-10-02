// 그래프 (SVG, 서버에서 그림). 막대에 마우스를 올리면(휴대폰은 길게 누르면) 값이 보이고, 아래 '표로 보기'로 숫자 확인.
import { axisShort } from "@/lib/format";

export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"] as const;
const GRID = "#e8ecf2";
const AXIS_TEXT = "#64748b";
const INK = "#0f172a";

type Fmt = (n: number) => string;

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}

function Legend({ series }: { series: { name: string; color: string }[] }) {
  if (series.length < 2) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-3 text-xs text-slate-600">
      {series.map((s) => (
        <span key={s.name} className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

function TableView({ labels, series, rows, fmt }: { labels: string[]; series: string[]; rows: number[][]; fmt: Fmt }) {
  return (
    <details className="mt-2 text-xs text-slate-500">
      <summary className="cursor-pointer select-none hover:text-slate-700">표로 보기</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-right tabular-nums">
          <thead>
            <tr className="text-slate-400">
              <th className="py-1 text-left font-medium">구분</th>
              {series.map((s) => (
                <th key={s} className="py-1 pl-3 font-medium">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((l, i) => (
              <tr key={l} className="border-t border-slate-100 text-slate-700">
                <td className="py-1 text-left">{l}</td>
                {rows[i].map((v, j) => (
                  <td key={j} className="py-1 pl-3">
                    {fmt(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** 세로 막대 (월별). 여러 계열이면 묶음 막대 */
export function ColumnChart({
  labels,
  series,
  height = 200,
  fmt,
  labelLast = true,
  wide = false,
}: {
  labels: string[];
  series: { name: string; values: number[]; color?: string }[];
  height?: number;
  fmt: Fmt;
  labelLast?: boolean;
  /** 화면 전체 폭 카드에 넣을 때 (글자가 너무 커지지 않도록) */
  wide?: boolean;
}) {
  const n = labels.length;
  const k = series.length;
  const all = series.flatMap((s) => s.values);
  const maxV = niceMax(Math.max(0, ...all));
  const minRaw = Math.min(0, ...all);
  const minV = minRaw < 0 ? -niceMax(-minRaw) : 0;
  const W = wide ? 1100 : 560;
  const padL = 54;
  const padB = 22;
  const padT = 18;
  const plotH = height - padB - padT;
  const slot = (W - padL) / n;
  const barW = Math.min(20, (slot - 10) / k - 2);
  const y = (v: number) => padT + ((maxV - v) / (maxV - minV)) * plotH;
  const stepV = niceMax((maxV - minV) / 4);
  const ticks: number[] = [];
  for (let v = Math.ceil(minV / stepV) * stepV; v <= maxV + 1e-6; v += stepV) ticks.push(v);
  const colored = series.map((s, i) => ({ ...s, color: s.color ?? SERIES[i] }));
  const peak = k === 1 ? colored[0].values.indexOf(Math.max(...colored[0].values)) : -1;

  return (
    <div>
      <Legend series={colored} />
      <div className="-mx-1 overflow-x-auto px-1"><svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full min-w-[480px]" role="img" aria-label={series.map((s) => s.name).join(", ")}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill={AXIS_TEXT}>
              {axisShort(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) => {
          const cx = padL + slot * i + slot / 2;
          const groupW = k * barW + (k - 1) * 2;
          return (
            <g key={l}>
              {colored.map((s, j) => {
                const v = s.values[i] ?? 0;
                const x = cx - groupW / 2 + j * (barW + 2);
                const top = y(Math.max(v, 0));
                const h = Math.max(v === 0 ? 0 : 1.5, Math.abs(y(v) - y(0)));
                const r = Math.min(4, barW / 2, h);
                // 끝(값 쪽)만 둥글게, 기준선 쪽은 각지게
                const path =
                  v >= 0
                    ? `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`
                    : `M${x},${y(0)} V${y(0) + h - r} Q${x},${y(0) + h} ${x + r},${y(0) + h} H${x + barW - r} Q${x + barW},${y(0) + h} ${x + barW},${y(0) + h - r} V${y(0)} Z`;
                return (
                  <g key={s.name}>
                    <path d={path} fill={s.color}>
                      <title>{`${l} ${s.name}: ${fmt(v)}`}</title>
                    </path>
                    {/* 넓은 투명 영역: 마우스 올리기 쉽게 */}
                    <rect x={x - 1} y={padT} width={barW + 2} height={plotH} fill="transparent">
                      <title>{`${l} ${s.name}: ${fmt(v)}`}</title>
                    </rect>
                  </g>
                );
              })}
              <text x={cx} y={height - 6} textAnchor="middle" fontSize={10.5} fill={AXIS_TEXT}>
                {l}
              </text>
              {k === 1 && ((labelLast && i === n - 1) || i === peak) && colored[0].values[i] !== 0 && (
                <text x={cx} y={y(Math.max(colored[0].values[i], 0)) - 5} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={INK}>
                  {axisShort(colored[0].values[i])}
                </text>
              )}
            </g>
          );
        })}
        {minV < 0 && <line x1={padL} x2={W} y1={y(0)} y2={y(0)} stroke="#94a3b8" strokeWidth={1} />}
      </svg></div>
      <TableView labels={labels} series={colored.map((s) => s.name)} rows={labels.map((_, i) => colored.map((s) => s.values[i] ?? 0))} fmt={fmt} />
    </div>
  );
}

/** 꺾은선 (대출잔액·미수금·공실률 추이) */
export function LineChart({
  labels,
  values,
  name,
  height = 170,
  fmt,
  color = SERIES[0],
  axisFmt = axisShort,
  wide = false,
}: {
  labels: string[];
  values: number[];
  name: string;
  height?: number;
  fmt: Fmt;
  color?: string;
  axisFmt?: Fmt;
  wide?: boolean;
}) {
  const n = labels.length;
  const W = wide ? 1100 : 560;
  const padL = 54;
  const padR = 36;
  const padB = 22;
  const padT = 20;
  const plotH = height - padB - padT;
  const maxV = niceMax(Math.max(...values, 0));
  const step = (W - padL - padR) / Math.max(1, n - 1);
  const x = (i: number) => padL + step * i;
  const y = (v: number) => padT + ((maxV - v) / maxV) * plotH;
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const ticks = [0, 0.5, 1].map((t) => maxV * t);
  const last = values[n - 1] ?? 0;
  return (
    <div>
      <div className="-mx-1 overflow-x-auto px-1"><svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full min-w-[480px]" role="img" aria-label={name}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill={AXIS_TEXT}>
              {axisFmt(t)}
            </text>
          </g>
        ))}
        <polygon points={`${x(0)},${y(0)} ${pts} ${x(n - 1)},${y(0)}`} fill={color} opacity={0.1} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {values.map((v, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(v)} r={i === n - 1 ? 4 : 0} fill={color} stroke="#fff" strokeWidth={2} />
            <rect x={x(i) - step / 2} y={padT} width={step} height={plotH} fill="transparent">
              <title>{`${labels[i]}: ${fmt(v)}`}</title>
            </rect>
            <text x={x(i)} y={height - 6} textAnchor="middle" fontSize={10.5} fill={AXIS_TEXT}>
              {labels[i]}
            </text>
          </g>
        ))}
        <text x={x(n - 1)} y={y(last) - 9} textAnchor="end" fontSize={10.5} fontWeight={700} fill={INK}>
          {axisFmt(last)}
        </text>
      </svg></div>
      <TableView labels={labels} series={[name]} rows={values.map((v) => [v])} fmt={fmt} />
    </div>
  );
}

/** 가로 막대 목록 (부동산별 수익률 등) */
export function BarList({
  items,
  fmt,
  color = SERIES[0],
}: {
  items: { label: string; value: number; sub?: string; href?: string; tone?: "red" }[];
  fmt: Fmt;
  color?: string;
}) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li key={it.label} title={`${it.label}: ${fmt(it.value)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
            <span className="truncate font-medium text-slate-700">
              {it.href ? (
                <a href={it.href} className="hover:underline">
                  {it.label}
                </a>
              ) : (
                it.label
              )}
              {it.sub && <span className="ml-1.5 text-xs font-normal text-slate-400">{it.sub}</span>}
            </span>
            <span className={`shrink-0 font-bold tabular-nums ${it.value < 0 ? "text-red-600" : "text-slate-900"}`}>{fmt(it.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full"
              style={{ width: `${Math.max(2, (Math.abs(it.value) / max) * 100)}%`, background: it.value < 0 || it.tone === "red" ? "#e34948" : color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
