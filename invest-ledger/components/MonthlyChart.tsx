"use client";

import { useEffect, useRef, useState } from "react";
import { won } from "@/lib/format";
import type { MonthRow } from "@/lib/stats";

// 검증된 색 (색각 이상 구분 통과): 1번 파랑, 2번 주황
const SERIES = [
  { key: "executedAmount", label: "투자 실행금액", color: "#2a78d6" },
  { key: "collectedAmount", label: "회수금액", color: "#eb6834" },
] as const;

/** 축 눈금용 짧은 금액: 150000000 → 1.5억, 30000000 → 3,000만 */
function short(n: number): string {
  if (n >= 1e8) return `${Number((n / 1e8).toFixed(1)).toLocaleString("ko-KR")}억`;
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString("ko-KR")}만`;
  return n.toLocaleString("ko-KR");
}

/** 보기 좋은 눈금 간격 */
function niceStep(max: number, ticks = 4): number {
  if (max <= 0) return 1;
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

/** 위쪽 모서리만 둥근 막대 (바닥은 직각) */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

export default function MonthlyChart({ rows }: { rows: MonthRow[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = 260;
  const pad = { top: 12, right: 8, bottom: 26, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const maxVal = Math.max(0, ...rows.flatMap((r) => SERIES.map((s) => r[s.key])));
  const step = niceStep(maxVal);
  const top = Math.max(step, Math.ceil(maxVal / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const band = plotW / rows.length;
  const barW = Math.min(24, (band - 10) / 2);
  const y = (v: number) => pad.top + plotH - (v / top) * plotH;
  const empty = maxVal === 0;

  const h = hover !== null ? rows[hover] : null;
  const tipLeft = hover !== null ? pad.left + band * hover + band / 2 : 0;

  return (
    <div>
      {/* 범례 */}
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-600">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div ref={box} className="relative w-full select-none" onMouseLeave={() => setHover(null)}>
        <svg width={width} height={height} role="img" aria-label="월별 투자 실행금액과 회수금액 막대 그래프 (아래 표에 같은 숫자가 있습니다)">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
              <text x={pad.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#64748b">
                {short(t)}
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const cx = pad.left + band * i + band / 2;
            return (
              <g key={r.month}>
                {hover === i && <rect x={pad.left + band * i} y={pad.top} width={band} height={plotH} fill="#0f1f3a" opacity={0.05} />}
                {SERIES.map((s, j) => {
                  const v = r[s.key];
                  if (v <= 0) return null;
                  const x = cx - barW - 1 + j * (barW + 2); // 막대 사이 2px 간격
                  return <path key={s.key} d={barPath(x, y(v), barW, y(0) - y(v))} fill={s.color} />;
                })}
                <text x={cx} y={height - 8} textAnchor="middle" fontSize={11} fill="#64748b">
                  {/* 좁은 화면에서는 '월'을 빼서 글자가 겹치지 않게 */}
                  {Number(r.month.slice(5))}{band >= 34 ? "월" : ""}
                </text>
                {/* 마우스·터치 영역 (막대보다 넓게) */}
                <rect x={pad.left + band * i} y={pad.top} width={band} height={plotH + 20} fill="transparent"
                  onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
              </g>
            );
          })}
          <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} stroke="#94a3b8" strokeWidth={1} />
        </svg>

        {empty && (
          <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">이 해에는 아직 데이터가 없습니다</div>
        )}

        {h && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-44 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
            style={{ left: Math.min(Math.max(tipLeft - 88, 0), width - 180) }}
          >
            <div className="mb-1 font-semibold text-slate-900">{h.month.replace("-", "년 ")}월</div>
            {SERIES.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3 text-slate-700">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-sm" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="font-medium tabular-nums">{won(h[s.key])}</span>
              </div>
            ))}
            <div className="mt-1 flex justify-between gap-3 border-t border-slate-100 pt-1 text-slate-500">
              <span>미회수</span>
              <span className="tabular-nums">{won(h.unpaidAmount)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
