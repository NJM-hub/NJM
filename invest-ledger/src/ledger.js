// 장부 계산 엔진: 기준일(asOf) 시점의 회수현황·상태를 계산한다.
// DB에는 약정과 입금 기록만 저장하고, 잔액·지연일수·상태는 항상 여기서 새로 계산한다.
// → 입금·수정이 생기면 모든 화면 숫자가 즉시 다시 계산됨

import { addDays, diffDays, monthEnd, monthOf, monthStart, weekEnd } from "./dates.js";

export const DEFAULT_SETTINGS = { overdueDays: 7 };

// 입금 배분
// 1) 회차를 지정한 입금은 그 회차에 먼저 충당, 넘치는 금액은 공통 풀로
// 2) 공통 풀(회차 미지정 입금 + 초과분)은 입금일 순으로 가장 오래된 미수 회차부터 충당
function allocate(schedules, payments) {
  const rows = schedules.map((s) => ({
    seq: s.seq,
    dueDate: s.due_date,
    amount: s.amount,
    paid: 0,
    lastPaidDate: null,
    completedDate: null,
  }));
  const bySeq = new Map(rows.map((r) => [r.seq, r]));
  const pays = [...payments].sort((a, b) => (a.paid_date < b.paid_date ? -1 : a.paid_date > b.paid_date ? 1 : a.id - b.id));
  const pool = [];

  const apply = (row, amt, date) => {
    const take = Math.min(amt, row.amount - row.paid);
    if (take <= 0) return amt;
    row.paid += take;
    row.lastPaidDate = date;
    if (row.paid >= row.amount) row.completedDate = date;
    return amt - take;
  };

  for (const p of pays) {
    const row = p.seq != null ? bySeq.get(p.seq) : null;
    if (row && p.amount > 0) {
      const rest = apply(row, p.amount, p.paid_date);
      if (rest > 0) pool.push({ amount: rest, date: p.paid_date });
    } else {
      pool.push({ amount: p.amount, date: p.paid_date });
    }
  }
  let extra = 0;
  for (const p of pool) {
    let amt = p.amount;
    for (const row of rows) {
      if (amt <= 0) break;
      amt = apply(row, amt, p.date);
    }
    extra += amt; // 총 예정액을 넘은 초과 입금
  }
  return { rows, extra };
}

function rowStatus(r, asOf, overdueDays) {
  const shortfall = r.amount - r.paid;
  if (shortfall <= 0) {
    const late = r.completedDate ? Math.max(0, diffDays(r.completedDate, r.dueDate)) : 0;
    return { status: "완료", level: "done", delayDays: 0, lateDays: late };
  }
  const d = diffDays(asOf, r.dueDate);
  if (d < 0) return { status: r.paid > 0 ? "일부선납" : "예정", level: "future", delayDays: 0 };
  if (d === 0) return { status: r.paid > 0 ? "일부입금" : "오늘", level: r.paid > 0 ? "partial" : "today", delayDays: 0 };
  if (r.paid > 0) return { status: "일부입금", level: "partial", delayDays: d };
  if (d > overdueDays) return { status: "연체", level: "overdue", delayDays: d };
  return { status: "지연", level: "delay", delayDays: d };
}

export const STATUS_LEVEL = {
  완납: "paidoff",
  연체: "overdue",
  일부입금: "partial",
  지연: "delay",
  정상: "normal",
  실행전: "future",
};

export function expiryLevel(daysLeft, paidOff) {
  if (paidOff) return { label: "완납", level: "paidoff" };
  if (daysLeft < 0) return { label: "만료경과", level: "overdue" };
  if (daysLeft < 7) return { label: "긴급", level: "urgent" };
  if (daysLeft < 15) return { label: "임박", level: "imminent" };
  if (daysLeft < 30) return { label: "주의", level: "caution" };
  return { label: "정상", level: "normal" };
}

// 투자 1건 계산
export function computeInvestment(inv, schedules, payments, asOf, settings = DEFAULT_SETTINGS) {
  const overdueDays = settings.overdueDays ?? DEFAULT_SETTINGS.overdueDays;
  const effective = payments.filter((p) => p.paid_date <= asOf);
  const { rows, extra } = allocate(schedules, effective);

  let dueToDate = 0; // 기준일까지 받아야 할 금액
  let paidAgainstDue = 0;
  let overdueAmount = 0; // 기준일 이전 예정분 미수 (연체 포함 미수금 중 과거분)
  let maxDelay = 0;
  let hasPartial = false;
  let hasUnpaid = false;
  let hasOverdue = false;
  let hasDelay = false;
  let doneCount = 0;
  let nextDue = null;

  for (const r of rows) {
    Object.assign(r, rowStatus(r, asOf, overdueDays));
    r.shortfall = r.amount - r.paid;
    if (r.dueDate <= asOf) {
      dueToDate += r.amount;
      paidAgainstDue += r.paid;
      if (r.shortfall > 0 && r.dueDate < asOf) {
        overdueAmount += r.shortfall;
        maxDelay = Math.max(maxDelay, r.delayDays);
        if (r.paid > 0) hasPartial = true;
        else hasUnpaid = true;
        if (r.delayDays > overdueDays) hasOverdue = true;
        else hasDelay = true;
      }
      if (r.dueDate === asOf && r.paid > 0 && r.shortfall > 0) hasPartial = true;
    } else if (!nextDue && r.shortfall > 0) {
      nextDue = { seq: r.seq, dueDate: r.dueDate, amount: r.shortfall };
    }
    if (r.shortfall <= 0) doneCount++;
  }

  const total = inv.total_expected;
  const collected = effective.reduce((a, p) => a + p.amount, 0);
  const outstanding = Math.max(0, total - collected);
  const started = inv.exec_date <= asOf;
  const paidOff = outstanding === 0;
  const daysLeft = diffDays(inv.expiry_date, asOf);
  const totalDays = diffDays(inv.expiry_date, inv.exec_date) + 1;
  const elapsed = Math.min(Math.max(diffDays(asOf, inv.exec_date) + 1, 0), totalDays);
  const expired = daysLeft < 0 && !paidOff;

  let status;
  if (!started) status = "실행전";
  else if (paidOff) status = "완납";
  else if (hasOverdue || expired) status = "연체";
  else if (hasPartial) status = "일부입금";
  else if (hasUnpaid) status = "지연";
  else status = "정상";

  const exp = expiryLevel(daysLeft, paidOff);

  return {
    id: inv.id,
    code: inv.code,
    started,
    status,
    statusLevel: STATUS_LEVEL[status],
    expiry: { ...exp, daysLeft },
    principal: inv.principal,
    profit: total - inv.principal,
    totalExpected: total,
    collected,
    extraPaid: extra,
    outstanding,
    progressPct: total > 0 ? Math.min(100, Math.floor((collected * 1000) / total) / 10) : 0,
    dueToDate,
    unpaidToDate: Math.max(0, dueToDate - paidAgainstDue),
    overdueAmount,
    maxDelay,
    elapsedDays: elapsed,
    totalDays,
    remainingDays: totalDays - elapsed,
    installments: rows.length,
    doneCount,
    nextDue,
    flags: {
      partial: hasPartial,
      unpaid: hasUnpaid,
      overdue: hasOverdue || expired,
      delay: hasDelay,
      expiringSoon: started && !paidOff && daysLeft >= 0 && daysLeft < 15,
    },
    rows,
  };
}

// 전체 포트폴리오 집계 (대시보드·날짜별 회수현황)
export function computePortfolio(items, asOf) {
  // items: [{ inv, calc, payments }]
  const mStart = monthStart(asOf);
  const mEnd = monthEnd(asOf);
  const wEnd = weekEnd(asOf);
  const nmStart = addDays(mEnd, 1);
  const nmEnd = monthEnd(nmStart);
  const d7 = addDays(asOf, 7);
  const d30 = addDays(asOf, 30);
  const d60 = addDays(asOf, 60);

  const t = {
    asOf,
    count: 0,
    principal: 0,
    totalExpected: 0,
    collected: 0,
    outstanding: 0,
    expectedProfit: 0,
    overdueAmount: 0,
    today: { executed: 0, executedCount: 0, due: 0, collected: 0, paidAgainstDue: 0, unpaid: 0, dueCount: 0 },
    month: { executed: 0, executedCount: 0, collected: 0, due: 0, paidAgainstDue: 0, unpaid: 0 },
    unpaidInclOverdue: 0,
    future: { thisWeek: 0, thisMonth: 0, nextMonth: 0, d7: 0, d30: 0, d60: 0, all: 0 },
    status: { 연체: 0, 일부입금: 0, 지연: 0, 만료임박: 0, 정상: 0, 완납: 0 },
    statusAmount: { 연체: 0, 일부입금: 0, 지연: 0, 만료임박: 0, 정상: 0, 완납: 0 },
  };

  for (const { inv, calc, payments } of items) {
    if (!calc.started) continue;
    t.count++;
    t.principal += inv.principal;
    t.totalExpected += calc.totalExpected;
    t.collected += calc.collected;
    t.outstanding += calc.outstanding;
    t.expectedProfit += calc.profit;
    t.overdueAmount += calc.overdueAmount;
    t.status[calc.status] = (t.status[calc.status] ?? 0) + 1;
    t.statusAmount[calc.status] = (t.statusAmount[calc.status] ?? 0) + calc.outstanding;
    if (calc.flags.expiringSoon) {
      t.status.만료임박++;
      t.statusAmount.만료임박 += calc.outstanding;
    }

    if (inv.exec_date === asOf) {
      t.today.executed += inv.principal;
      t.today.executedCount++;
    }
    if (inv.exec_date >= mStart && inv.exec_date <= mEnd) {
      t.month.executed += inv.principal;
      t.month.executedCount++;
    }
    for (const p of payments) {
      if (p.paid_date === asOf) t.today.collected += p.amount;
      if (p.paid_date >= mStart && p.paid_date <= asOf) t.month.collected += p.amount;
    }
    for (const r of calc.rows) {
      if (r.dueDate === asOf) {
        t.today.due += r.amount;
        t.today.paidAgainstDue += r.paid;
        t.today.unpaid += r.shortfall;
        t.today.dueCount++;
      }
      if (r.dueDate <= asOf) t.unpaidInclOverdue += r.shortfall;
      if (r.dueDate >= mStart && r.dueDate <= mEnd) {
        t.month.due += r.amount;
        if (r.dueDate <= asOf) {
          t.month.paidAgainstDue += r.paid;
          t.month.unpaid += r.shortfall;
        }
      }
      if (r.dueDate > asOf && r.shortfall > 0) {
        const s = r.shortfall;
        t.future.all += s;
        if (r.dueDate <= wEnd) t.future.thisWeek += s;
        if (r.dueDate <= mEnd) t.future.thisMonth += s;
        if (r.dueDate >= nmStart && r.dueDate <= nmEnd) t.future.nextMonth += s;
        if (r.dueDate <= d7) t.future.d7 += s;
        if (r.dueDate <= d30) t.future.d30 += s;
        if (r.dueDate <= d60) t.future.d60 += s;
      }
    }
  }
  t.collectionRate = t.totalExpected > 0 ? Math.floor((t.collected * 1000) / t.totalExpected) / 10 : 0;
  return t;
}

// 월별 실행/회수 집계
export function computeMonthly(items, asOf, year) {
  const months = {};
  const ensure = (m) =>
    (months[m] ??= { month: m, executed: 0, executedCount: 0, scheduled: 0, collected: 0, unpaid: 0, paidAgainstDue: 0 });
  for (let i = 1; i <= 12; i++) ensure(`${year}-${String(i).padStart(2, "0")}`);
  for (const { inv, calc, payments } of items) {
    if (inv.exec_date <= asOf && inv.exec_date.startsWith(String(year))) {
      const m = ensure(monthOf(inv.exec_date));
      m.executed += inv.principal;
      m.executedCount++;
    }
    for (const p of payments) {
      if (p.paid_date <= asOf && p.paid_date.startsWith(String(year))) ensure(monthOf(p.paid_date)).collected += p.amount;
    }
    for (const r of calc.rows) {
      if (!r.dueDate.startsWith(String(year))) continue;
      const m = ensure(monthOf(r.dueDate));
      m.scheduled += r.amount;
      m.paidAgainstDue += r.paid;
      if (r.dueDate <= asOf) m.unpaid += r.shortfall;
    }
  }
  return Object.values(months).sort((a, b) => (a.month < b.month ? -1 : 1));
}
