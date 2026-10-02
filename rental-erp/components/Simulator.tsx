"use client";

import { useMemo, useState } from "react";
import type { CalcSettings } from "@/lib/calcSettings";
import { analyzeInvestment, simulate, type InvestInput, type PropertyMetrics } from "@/lib/engine";
import { parseMoney, pct, won, wonShort } from "@/lib/format";
import type { Loan } from "@/lib/types";

type SimProp = Pick<PropertyMetrics, "monthlyRent" | "otherIncome" | "monthlyOpex" | "equity"> & { property: { id: string; name: string } };

function Slider({ label, value, onChange, min, max, step, unit }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; unit: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="label !mb-0">{label}</span>
        <span className="flex items-center gap-1">
          <input
            type="number"
            className="input !w-20 !py-1 text-right"
            value={value}
            step={step}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
          />
          <span className="text-sm text-slate-500">{unit}</span>
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-navy-700" />
    </div>
  );
}

/** 시뮬레이션: 월세 인상·금리 변경·비용·공실 → 즉시 결과 */
export function Simulator({ props, loans, settings }: { props: SimProp[]; loans: Loan[]; settings: CalcSettings }) {
  const [target, setTarget] = useState("all");
  const [rent, setRent] = useState(5);
  const [rate, setRate] = useState(0);
  const [opex, setOpex] = useState(0);
  const [vac, setVac] = useState(0);
  const chosen = useMemo(() => (target === "all" ? props : props.filter((p) => p.property.id === target)), [props, target]);
  const r = simulate(chosen as PropertyMetrics[], loans, { rentChangePct: rent, rateChangePt: rate, opexChangePct: opex, extraVacancyPct: vac }, settings);
  const rows: [string, number, number, number][] = [
    ["월 임대료", r.base.monthlyRent, r.scenario.monthlyRent, r.delta.monthlyRent],
    ["연간 임대수입", r.base.annualRent, r.scenario.annualRent, r.delta.annualRent],
    ["연간 대출이자", r.base.annualInterest, r.scenario.annualInterest, r.delta.annualInterest],
    ["연간 운영비", r.base.annualOpex, r.scenario.annualOpex, r.delta.annualOpex],
    ["연 순수익", r.base.annualNet, r.scenario.annualNet, r.delta.annualNet],
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <div className="space-y-4">
        <div>
          <label className="label">대상</label>
          <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="all">전체 (현재 보기 범위)</option>
            {props.map((p) => (
              <option key={p.property.id} value={p.property.id}>
                {p.property.name}
              </option>
            ))}
          </select>
        </div>
        <Slider label="월세 변경" value={rent} onChange={setRent} min={-20} max={30} step={0.5} unit="%" />
        <Slider label="대출금리 변경" value={rate} onChange={setRate} min={-3} max={5} step={0.25} unit="%p" />
        <Slider label="운영비 변경" value={opex} onChange={setOpex} min={-50} max={100} step={5} unit="%" />
        <Slider label="추가 공실 (임대수입 감소)" value={vac} onChange={setVac} min={0} max={50} step={5} unit="%" />
        <button type="button" className="btn-ghost" onClick={() => (setRent(0), setRate(0), setOpex(0), setVac(0))}>
          초기화
        </button>
      </div>
      <div>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-navy-900 p-4 text-white">
            <div className="text-xs text-navy-200">연 순수익 변화</div>
            <div className={`mt-1 text-3xl font-extrabold tabular-nums ${r.delta.annualNet < 0 ? "text-red-300" : "text-emerald-300"}`}>
              {r.delta.annualNet >= 0 ? "+" : ""}
              {wonShort(r.delta.annualNet)}
            </div>
            <div className="mt-1 text-xs text-navy-200">
              {wonShort(r.base.annualNet)} → {wonShort(r.scenario.annualNet)}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-100 p-4">
            <div className="text-xs text-slate-500">자기자본 수익률</div>
            <div className="mt-1 text-3xl font-extrabold tabular-nums text-navy-950">{pct(r.scenario.leveragedYield, 2)}</div>
            <div className="mt-1 text-xs text-slate-500">
              현재 {pct(r.base.leveragedYield, 2)} ({r.delta.leveragedYield != null ? `${r.delta.leveragedYield >= 0 ? "+" : ""}${r.delta.leveragedYield.toFixed(2)}%p` : "-"})
            </div>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th />
              <th className="num">현재</th>
              <th className="num">시뮬레이션</th>
              <th className="num">차이</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, a, b, d]) => (
              <tr key={k} className={k === "연 순수익" ? "font-bold" : ""}>
                <td>{k}</td>
                <td className="num">{won(a)}</td>
                <td className="num">{won(b)}</td>
                <td className={`num font-semibold ${d === 0 ? "text-slate-400" : (k.includes("이자") || k.includes("운영비") ? d > 0 : d < 0) ? "text-red-600" : "text-emerald-700"}`}>
                  {d > 0 ? "+" : ""}
                  {won(d)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-slate-500">
          예) 월세 1,800만원을 5% 올리면 1,890만원 → 연 1,080만원 증가 / 금리 5% → 6%: 대출 10억이면 연 이자 1,000만원 증가
        </p>
      </div>
    </div>
  );
}

const INVEST_FIELDS: { key: keyof InvestInput; label: string; money?: boolean; unit?: string; hint?: string }[] = [
  { key: "price", label: "매입가격", money: true },
  { key: "deposit", label: "예상 보증금", money: true },
  { key: "monthlyRent", label: "예상 월세", money: true },
  { key: "loanAmount", label: "대출금액", money: true },
  { key: "loanRate", label: "대출금리", unit: "%" },
  { key: "acquisitionCost", label: "취득비용", money: true, hint: "취득세·중개·법무 (보통 매입가의 4.6%~)" },
  { key: "monthlyMaintenance", label: "예상 관리비 (월, 비용)", money: true },
  { key: "annualTax", label: "예상 세금 (연)", money: true, hint: "재산세·종부세" },
  { key: "vacancyPct", label: "예상 공실률", unit: "%" },
];

/** 투자 의사결정: 새 부동산 매입 검토 */
export function InvestCalc() {
  const [v, setV] = useState<Record<string, string>>({
    price: "1,000,000,000",
    deposit: "100,000,000",
    monthlyRent: "5,000,000",
    loanAmount: "500,000,000",
    loanRate: "5",
    acquisitionCost: "46,000,000",
    monthlyMaintenance: "300,000",
    annualTax: "2,400,000",
    vacancyPct: "0",
  });
  const input = Object.fromEntries(INVEST_FIELDS.map((f) => [f.key, f.money ? (parseMoney(v[f.key]) ?? 0) : Number(v[f.key]) || 0])) as InvestInput;
  const r = analyzeInvestment(input);
  const verdict =
    r.monthlyCashflow < 0 ? { t: "❌ 월 현금흐름이 마이너스입니다", c: "bg-red-50 text-red-800 ring-red-200" } : (r.equityYield ?? 0) < input.loanRate ? { t: "⚠️ 자기자본 수익률이 대출금리보다 낮습니다", c: "bg-orange-50 text-orange-800 ring-orange-200" } : { t: "✅ 수익 구조 양호", c: "bg-emerald-50 text-emerald-800 ring-emerald-200" };
  const cards: [string, string, string?][] = [
    ["필요한 자기자본", won(r.equityRequired), "매입가 + 취득비 - 대출 - 보증금"],
    ["월 현금흐름", won(r.monthlyCashflow), `월세 - 이자 ${wonShort(r.monthlyInterest)} - 관리비·세금 ${wonShort(r.monthlyCost)}`],
    ["연 순수익", won(r.annualNet)],
    ["임대수익률", pct(r.grossYield, 2), "연 월세 ÷ 매입가"],
    ["자기자본 수익률", pct(r.equityYield, 2), "연 순수익 ÷ 자기자본"],
    ["대출이자 부담률", pct(r.interestBurden, 1), "월 이자 ÷ 월세"],
    ["손익분기 월세", won(r.breakEvenRent), r.breakEvenOccupancy != null ? `임대율 ${r.breakEvenOccupancy.toFixed(0)}% 이상이면 흑자` : undefined],
    ["예상 회수기간", r.paybackYears ? `${r.paybackYears.toFixed(1)}년` : "회수 불가", "자기자본 ÷ 연 순수익"],
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {INVEST_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label">{f.label}</label>
            <div className="relative">
              <input
                className="input pr-8 text-right tabular-nums"
                inputMode="decimal"
                value={v[f.key]}
                onChange={(e) => {
                  const raw = e.target.value;
                  setV((p) => ({ ...p, [f.key]: f.money ? (raw.replace(/[^\d]/g, "") ? Number(raw.replace(/[^\d]/g, "")).toLocaleString("ko-KR") : "") : raw }));
                }}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-400">{f.unit ?? "원"}</span>
            </div>
            <p className="hint">{[f.money && parseMoney(v[f.key]) ? wonShort(parseMoney(v[f.key])) : null, f.hint].filter(Boolean).join(" · ")}</p>
          </div>
        ))}
      </div>
      <div>
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ring-1 ring-inset ${verdict.c}`}>{verdict.t}</div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {cards.map(([k, val, hint]) => (
            <div key={k} className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs text-slate-500">{k}</div>
              <div className={`mt-1 text-xl font-extrabold tabular-nums ${val.startsWith("-") ? "text-red-600" : "text-navy-950"}`}>{val}</div>
              {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
