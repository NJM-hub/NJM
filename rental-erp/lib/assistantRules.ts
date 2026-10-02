// AI 키가 없어도 자주 묻는 질문에는 바로 답한다 (규칙 기반). AI 키가 있으면 Claude 가 답한다.
import { daysBetween, fmtDate } from "@/lib/dates";
import { simulate, type Snapshot } from "@/lib/engine";
import { pct, wonShort } from "@/lib/format";
import type { Loan } from "@/lib/types";

export const SAMPLE_QUESTIONS = [
  "현재 임대사업 수익이 가장 좋은 건물이 뭐야?",
  "이번 달 미납금 얼마야?",
  "3개월 안에 계약 끝나는 곳 알려줘.",
  "대출이자를 제외하면 올해 예상 순수익 얼마야?",
  "월세를 5% 올리면 연간 수익이 얼마나 증가해?",
  "공실 손실이 얼마나 돼?",
];

export function answerByRules(question: string, s: Snapshot, loans: Loan[]): string | null {
  const qn = question.replace(/\s+/g, "");
  const t = s.totals;

  if (/수익.*(좋|높|최고|1등)|수익률.*(좋|높)|가장.*좋은/.test(qn)) {
    const ranked = s.properties.filter((p) => p.leveragedYield != null).sort((a, b) => b.leveragedYield! - a.leveragedYield!);
    if (!ranked.length) return "수익률을 계산할 부동산이 없습니다 (매입가격·자기자본을 확인하세요).";
    const top = ranked[0];
    const lines = ranked.slice(0, 5).map((p, i) => `${i + 1}. ${p.property.name}: 자기자본 수익률 ${pct(p.leveragedYield)} (월 순수익 ${wonShort(p.monthlyNet)})`);
    return `현재 ${top.property.name}의 자기자본 수익률이 ${pct(top.leveragedYield)}로 가장 높습니다.\n${lines.join("\n")}`;
  }

  if (/미납|미수|연체/.test(qn)) {
    if (!s.arrears.length) return "현재 미납금이 없습니다. 👍";
    const lines = s.arrears.slice(0, 8).map((a) => `- ${a.tenant?.name} / ${a.property?.name} ${a.unit?.unit_no}: ${wonShort(a.total)} (${a.days}일 경과)`);
    return `현재 총 미납금은 ${wonShort(t.unpaid)}입니다 (${s.arrears.length}건). 이번 달 청구 중 아직 못 받은 금액은 ${wonShort(t.monthOutstanding)}입니다.\n${lines.join("\n")}`;
  }

  if (/(계약|만료|끝나)/.test(qn)) {
    const m = qn.match(/(\d+)\s*(개월|달)/);
    const days = m ? Number(m[1]) * 30 : qn.includes("일") && qn.match(/(\d+)일/) ? Number(qn.match(/(\d+)일/)![1]) : 90;
    const list = s.units
      .filter((u) => u.contract && u.contract.status === "active")
      .map((u) => ({ u, left: daysBetween(s.today, u.contract!.end_date) }))
      .filter((x) => x.left >= 0 && x.left <= days)
      .sort((a, b) => a.left - b.left);
    if (!list.length) return `${days}일 안에 끝나는 계약이 없습니다.`;
    return `${days}일 안에 끝나는 계약은 ${list.length}건입니다.\n${list
      .map((x) => `- ${x.u.tenant?.name} / ${x.u.property.name} ${x.u.unit.unit_no}: ${fmtDate(x.u.contract!.end_date)} (${x.left}일 남음)`)
      .join("\n")}`;
  }

  if (/(이자).*(제외|빼|전)/.test(qn)) {
    return `대출이자를 빼기 전 연간 예상 순수익은 ${wonShort(t.annualNetBeforeInterest)}입니다.\n(이자 반영 후 연 순수익 ${wonShort(t.annualNet)} + 연 이자 ${wonShort(t.monthlyInterest * 12)})`;
  }

  const raise = qn.match(/월세.*?(\d+(?:\.\d+)?)\s*%/);
  if (raise && /(올리|인상|증가|올려)/.test(qn)) {
    const p = Number(raise[1]);
    const r = simulate(s.properties, loans, { rentChangePct: p, rateChangePt: 0, opexChangePct: 0, extraVacancyPct: 0 }, s.settings);
    return `월세를 ${p}% 올리면 월세가 ${wonShort(r.base.monthlyRent)}에서 ${wonShort(r.scenario.monthlyRent)}(으)로 늘어 연간 수익이 ${wonShort(r.delta.annualNet)} 증가합니다.\n연 순수익: ${wonShort(r.base.annualNet)} → ${wonShort(r.scenario.annualNet)}`;
  }

  const rate = qn.match(/금리.*?(\d+(?:\.\d+)?)\s*%?p?/);
  if (rate && /(오르|인상|올라|상승)/.test(qn)) {
    const p = Number(rate[1]);
    const r = simulate(s.properties, loans, { rentChangePct: 0, rateChangePt: p, opexChangePct: 0, extraVacancyPct: 0 }, s.settings);
    return `금리가 ${p}%p 오르면 연간 이자가 ${wonShort(r.delta.annualInterest)} 늘어 연 순수익이 ${wonShort(r.base.annualNet)}에서 ${wonShort(r.scenario.annualNet)}(으)로 줄어듭니다.`;
  }

  if (/공실/.test(qn)) {
    const v = s.units.filter((u) => !u.occupied);
    if (!v.length) return "현재 공실이 없습니다.";
    return `공실 ${v.length}개 (공실률 ${pct(t.vacancyRate)}), 지금까지 예상 손실 합계 ${wonShort(v.reduce((a, x) => a + x.vacancyLoss, 0))}, 매달 ${wonShort(t.vacancyLossMonthly)}씩 손실이 납니다.\n${v
      .map((u) => `- ${u.property.name} ${u.unit.unit_no}: 공실 ${u.vacancyDays}일, 예상 손실 ${wonShort(u.vacancyLoss)}`)
      .join("\n")}`;
  }

  if (/순수익|이번달수익|수익/.test(qn)) {
    return `이번 달 예상 순수익은 ${wonShort(t.monthlyNet)}, 연간 예상 순수익은 ${wonShort(t.annualNet)}입니다.\n(월세 ${wonShort(t.monthlyRent)} + 기타수입 ${wonShort(t.otherIncome)} - 운영비 ${wonShort(t.monthlyOpex)} - 이자 ${wonShort(t.monthlyInterest)})`;
  }

  if (/대출/.test(qn)) {
    return `대출잔액은 ${wonShort(t.loanBalance)}, 이번 달 대출이자는 ${wonShort(t.monthlyInterest)}입니다.${s.loansDue.length ? `\n만기 임박: ${s.loansDue.map((l) => `${l.loan.lender} ${fmtDate(l.loan.maturity_date)}`).join(", ")}` : ""}`;
  }

  return null;
}
