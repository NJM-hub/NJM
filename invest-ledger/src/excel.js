import ExcelJS from "exceljs";
import { METHODS, buildPlan, UNIT_LABEL } from "./schedule.js";
import { computeMonthly } from "./ledger.js";
import { summaryRow } from "./repo.js";
import { isDate, toStr } from "./dates.js";
import { toWon } from "./money.js";

const WON = '#,##0"원"';
const HEAD_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };

function sheet(wb, name, columns, rows, { totals } = {}) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 14, style: c.money ? { numFmt: WON } : {} }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = HEAD_FILL;
  head.alignment = { vertical: "middle", horizontal: "center" };
  for (const r of rows) ws.addRow(r);
  if (totals) {
    const row = ws.addRow(totals);
    row.font = { bold: true };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF3F8" } };
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

const sumBy = (rows, k) => rows.reduce((a, r) => a + (r[k] ?? 0), 0);

const INV_COLS = [
  { header: "투자번호", key: "code", width: 17 },
  { header: "고객명", key: "customerName" },
  { header: "투자처", key: "companyName" },
  { header: "투자구분", key: "category", width: 10 },
  { header: "실행일", key: "execDate", width: 12 },
  { header: "실행금액", key: "principal", money: true, width: 16 },
  { header: "수익률(%)", key: "rate", width: 10 },
  { header: "약정수익", key: "profit", money: true, width: 14 },
  { header: "총회수예정액", key: "totalExpected", money: true, width: 16 },
  { header: "기간", key: "term", width: 9 },
  { header: "회수주기", key: "cycle", width: 13 },
  { header: "회수방식", key: "method", width: 18 },
  { header: "1회 회수액", key: "perAmount", money: true },
  { header: "만료일", key: "expiryDate", width: 12 },
  { header: "회수액", key: "collected", money: true, width: 16 },
  { header: "잔액", key: "outstanding", money: true, width: 16 },
  { header: "진행률(%)", key: "progressPct", width: 10 },
  { header: "미수(연체)", key: "overdueAmount", money: true },
  { header: "지연일수", key: "maxDelay", width: 9 },
  { header: "경과일", key: "elapsedDays", width: 8 },
  { header: "남은일수", key: "remainingDays", width: 9 },
  { header: "상태", key: "status", width: 9 },
  { header: "만료상태", key: "expiryLabel", width: 9 },
];

function invRows(items) {
  return items.map((it) => {
    const s = summaryRow(it);
    return { ...s, rate: Number(s.rate), expiryLabel: s.expiry.label };
  });
}

function totalsRow(rows, label = "합계") {
  return {
    code: label,
    principal: sumBy(rows, "principal"),
    profit: sumBy(rows, "profit"),
    totalExpected: sumBy(rows, "totalExpected"),
    collected: sumBy(rows, "collected"),
    outstanding: sumBy(rows, "outstanding"),
    overdueAmount: sumBy(rows, "overdueAmount"),
  };
}

export async function buildExport(kind, items, { asOf, year, customerId, investmentId }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "투자수익 장부";
  let name = kind;
  const started = items.filter((it) => it.calc.started);

  if (kind === "investments") {
    const rows = invRows(started);
    sheet(wb, "전체 투자목록", INV_COLS, rows, { totals: totalsRow(rows) });
    name = `전체투자목록_${asOf}`;
  } else if (kind === "customers") {
    const list = customerId ? started.filter((it) => it.inv.customer_id === Number(customerId)) : started;
    const groups = new Map();
    for (const it of list) {
      const k = it.inv.customer_id;
      if (!groups.has(k)) groups.set(k, { name: it.inv.customer_name, items: [] });
      groups.get(k).items.push(it);
    }
    const summary = [...groups.values()].map((g) => {
      const rows = invRows(g.items);
      return {
        customerName: g.name,
        count: rows.length,
        principal: sumBy(rows, "principal"),
        totalExpected: sumBy(rows, "totalExpected"),
        collected: sumBy(rows, "collected"),
        outstanding: sumBy(rows, "outstanding"),
        overdueAmount: sumBy(rows, "overdueAmount"),
      };
    });
    sheet(
      wb,
      "고객별 요약",
      [
        { header: "고객명", key: "customerName", width: 14 },
        { header: "투자건수", key: "count", width: 9 },
        { header: "총 실행금액", key: "principal", money: true, width: 16 },
        { header: "총 회수예정액", key: "totalExpected", money: true, width: 16 },
        { header: "총 회수액", key: "collected", money: true, width: 16 },
        { header: "총 미회수액", key: "outstanding", money: true, width: 16 },
        { header: "연체 미수", key: "overdueAmount", money: true, width: 14 },
      ],
      summary,
      {
        totals: {
          customerName: "합계",
          count: sumBy(summary, "count"),
          principal: sumBy(summary, "principal"),
          totalExpected: sumBy(summary, "totalExpected"),
          collected: sumBy(summary, "collected"),
          outstanding: sumBy(summary, "outstanding"),
          overdueAmount: sumBy(summary, "overdueAmount"),
        },
      },
    );
    const rows = invRows(list).sort((a, b) => a.customerName.localeCompare(b.customerName, "ko"));
    sheet(wb, "고객별 투자내역", [{ header: "고객명", key: "customerName" }, ...INV_COLS.filter((c) => c.key !== "customerName")], rows);
    name = customerId && summary[0] ? `고객_${summary[0].customerName}_${asOf}` : `고객별투자목록_${asOf}`;
  } else if (kind === "monthly-exec" || kind === "monthly-collect") {
    const months = computeMonthly(items, asOf, year);
    if (kind === "monthly-exec") {
      const rows = months.map((m) => ({ month: m.month, executed: m.executed, executedCount: m.executedCount }));
      sheet(
        wb,
        `${year} 월별 실행금액`,
        [
          { header: "월", key: "month", width: 10 },
          { header: "실행금액", key: "executed", money: true, width: 18 },
          { header: "투자건수", key: "executedCount", width: 10 },
        ],
        rows,
        { totals: { month: "합계", executed: sumBy(rows, "executed"), executedCount: sumBy(rows, "executedCount") } },
      );
      name = `월별실행금액_${year}`;
    } else {
      const rows = months.map((m) => ({ month: m.month, scheduled: m.scheduled, collected: m.collected, unpaid: m.unpaid }));
      sheet(
        wb,
        `${year} 월별 회수금액`,
        [
          { header: "월", key: "month", width: 10 },
          { header: "예정회수액", key: "scheduled", money: true, width: 18 },
          { header: "실제회수액", key: "collected", money: true, width: 18 },
          { header: "미회수(기준일까지)", key: "unpaid", money: true, width: 18 },
        ],
        rows,
        {
          totals: {
            month: "합계",
            scheduled: sumBy(rows, "scheduled"),
            collected: sumBy(rows, "collected"),
            unpaid: sumBy(rows, "unpaid"),
          },
        },
      );
      name = `월별회수금액_${year}`;
    }
  } else if (kind === "schedule") {
    const list = investmentId ? items.filter((it) => it.inv.investment_id === Number(investmentId)) : started;
    const rows = [];
    for (const it of list) {
      for (const r of it.calc.rows) {
        rows.push({
          code: it.inv.code,
          customerName: it.inv.customer_name,
          companyName: it.inv.company_name,
          seq: r.seq,
          dueDate: r.dueDate,
          amount: r.amount,
          paid: r.paid,
          lastPaidDate: r.lastPaidDate ?? "",
          shortfall: r.shortfall,
          delayDays: r.delayDays || "",
          status: r.status,
        });
      }
    }
    sheet(
      wb,
      "회수 스케줄",
      [
        { header: "투자번호", key: "code", width: 17 },
        { header: "고객명", key: "customerName" },
        { header: "투자처", key: "companyName" },
        { header: "회차", key: "seq", width: 7 },
        { header: "예정일", key: "dueDate", width: 12 },
        { header: "예정액", key: "amount", money: true },
        { header: "실제입금", key: "paid", money: true },
        { header: "입금일", key: "lastPaidDate", width: 12 },
        { header: "미수금", key: "shortfall", money: true },
        { header: "지연일수", key: "delayDays", width: 9 },
        { header: "상태", key: "status", width: 9 },
      ],
      rows,
      { totals: { code: "합계", amount: sumBy(rows, "amount"), paid: sumBy(rows, "paid"), shortfall: sumBy(rows, "shortfall") } },
    );
    name = investmentId && list[0] ? `회수스케줄_${list[0].inv.code}` : `회수스케줄_전체_${asOf}`;
  } else if (kind === "overdue") {
    const list = started.filter((it) => it.calc.overdueAmount > 0 || it.calc.status === "연체");
    const rows = invRows(list).sort((a, b) => b.maxDelay - a.maxDelay);
    sheet(wb, "연체·미수 투자", INV_COLS, rows, { totals: totalsRow(rows) });
    const detail = [];
    for (const it of list)
      for (const r of it.calc.rows)
        if (r.dueDate < asOf && r.shortfall > 0)
          detail.push({
            code: it.inv.code,
            customerName: it.inv.customer_name,
            companyName: it.inv.company_name,
            seq: r.seq,
            dueDate: r.dueDate,
            amount: r.amount,
            paid: r.paid,
            shortfall: r.shortfall,
            delayDays: r.delayDays,
            status: r.status,
          });
    sheet(
      wb,
      "미수 회차 상세",
      [
        { header: "투자번호", key: "code", width: 17 },
        { header: "고객명", key: "customerName" },
        { header: "투자처", key: "companyName" },
        { header: "회차", key: "seq", width: 7 },
        { header: "예정일", key: "dueDate", width: 12 },
        { header: "예정액", key: "amount", money: true },
        { header: "입금액", key: "paid", money: true },
        { header: "미수금", key: "shortfall", money: true },
        { header: "지연일수", key: "delayDays", width: 9 },
        { header: "상태", key: "status", width: 9 },
      ],
      detail,
      { totals: { code: "합계", shortfall: sumBy(detail, "shortfall") } },
    );
    name = `연체목록_${asOf}`;
  } else if (kind === "template") {
    const ws = sheet(
      wb,
      "투자장부",
      IMPORT_COLS.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 14 })),
      [
        {
          customerName: "홍길동",
          customerPhone: "010-1234-5678",
          companyName: "A투자",
          manager: "김담당",
          contact: "010-0000-0000",
          category: "일수",
          execDate: "2026-09-01",
          principal: 10000000,
          rate: 20,
          totalExpected: "",
          termValue: 100,
          termUnit: "일",
          cycleValue: 1,
          cycleUnit: "일",
          method: "원금+수익 균등회수",
          installmentAmount: "",
          firstDueDate: "",
          expiryDate: "",
          collected: 0,
          memo: "",
        },
        {
          customerName: "김철수",
          companyName: "B투자",
          execDate: "2026-09-01",
          principal: 5000000,
          rate: 15,
          termValue: 12,
          termUnit: "주",
          cycleValue: 1,
          cycleUnit: "주",
          method: "원금+수익 균등회수",
          collected: 1250000,
        },
      ],
    );
    ws.getColumn("principal").numFmt = "#,##0";
    const help = wb.addWorksheet("작성방법");
    help.columns = [{ width: 22 }, { width: 80 }];
    [
      ["항목", "설명"],
      ["* 표시", "필수 입력"],
      ["실행일/첫회수일/만료일", "2026-09-01 형식 또는 엑셀 날짜"],
      ["기간단위 / 주기단위", "일, 주, 개월 중 하나 (예: 기간 12 + 주 = 12주, 주기 1 + 주 = 매주)"],
      ["회수방식", Object.values(METHODS).map((m) => m.label).join(" / ") + " (비우면 원금+수익 균등회수)"],
      ["총회수예정금액", "비우면 실행금액 × (1 + 수익률) 로 자동 계산"],
      ["1회회수금액", "비우면 자동 균등분할 (나머지는 마지막 회차에서 조정)"],
      ["기회수금액", "이미 받은 금액 합계. 앞 회차부터 예정일자로 입금 처리됩니다."],
    ].forEach((r, i) => {
      const row = help.addRow(r);
      if (i === 0) row.font = { bold: true };
    });
    name = "투자장부_업로드양식";
  } else {
    throw new Error("unknown export");
  }
  const buf = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(buf), filename: `${name}.xlsx` };
}

// ---------- 업로드 ----------
export const IMPORT_COLS = [
  { key: "customerName", header: "고객명*", alias: ["고객명", "고객", "성명", "이름"] },
  { key: "customerPhone", header: "고객연락처", alias: ["고객연락처", "연락처", "전화"] },
  { key: "companyName", header: "투자처명*", alias: ["투자처명", "투자처"] },
  { key: "manager", header: "담당자", alias: ["담당자"] },
  { key: "contact", header: "담당자연락처", alias: ["담당자연락처"] },
  { key: "category", header: "투자구분", alias: ["투자구분", "구분"] },
  { key: "execDate", header: "실행일*", alias: ["실행일", "투자실행일", "투자일"] },
  { key: "principal", header: "실행금액*", alias: ["실행금액", "투자금액", "원금"], width: 16 },
  { key: "rate", header: "수익률(%)*", alias: ["수익률(%)", "수익률", "약정수익률", "약정수익률(%)"] },
  { key: "totalExpected", header: "총회수예정금액", alias: ["총회수예정금액", "총회수예정액", "회수예정금액"], width: 16 },
  { key: "termValue", header: "기간*", alias: ["기간", "투자기간", "회수기간"] },
  { key: "termUnit", header: "기간단위(일/주/개월)*", alias: ["기간단위", "기간단위(일/주/개월)"], width: 20 },
  { key: "cycleValue", header: "회수주기*", alias: ["회수주기", "주기"] },
  { key: "cycleUnit", header: "주기단위(일/주/개월)*", alias: ["주기단위", "주기단위(일/주/개월)"], width: 20 },
  { key: "method", header: "회수방식", alias: ["회수방식", "상환방식"], width: 18 },
  { key: "installmentAmount", header: "1회회수금액", alias: ["1회회수금액", "1회회수액", "회당금액"] },
  { key: "firstDueDate", header: "첫회수일", alias: ["첫회수일"] },
  { key: "expiryDate", header: "만료일", alias: ["만료일", "만기일"] },
  { key: "collected", header: "기회수금액", alias: ["기회수금액", "회수금액", "현재까지회수금액", "회수액"] },
  { key: "memo", header: "메모", alias: ["메모", "비고"] },
];

const norm = (s) => String(s ?? "").replace(/[\s*]/g, "").toLowerCase();

function cellValue(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return toStr(Math.round(v.getTime() / 86400000));
  if (typeof v === "object") {
    if ("result" in v) return cellValue(v.result);
    if ("text" in v) return String(v.text);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
  }
  return v;
}

function parseDate(v) {
  if (v === "" || v === null || v === undefined) return "";
  if (typeof v === "number") return toStr(Math.round(v) - 25569); // 엑셀 일련번호
  const s = String(v).trim().replace(/[./]/g, "-");
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (!m) return s;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function parseUnit(v) {
  const s = norm(v);
  if (!s) return "";
  if (/^(일|d|day|days|일간)$/.test(s)) return "day";
  if (/^(주|w|week|weeks|주간|주일)$/.test(s)) return "week";
  if (/^(개월|월|m|month|months|달)$/.test(s)) return "month";
  return s;
}

function parseMethod(v) {
  const s = norm(v);
  if (!s) return "equal_total";
  if (METHODS[s]) return s;
  for (const [k, m] of Object.entries(METHODS)) if (norm(m.label) === s) return k;
  if (s.includes("일시") || s.includes("만기")) return "bullet";
  if (s.includes("원금균등")) return "equal_principal";
  if (s.includes("수익균등") || s.includes("이자")) return "equal_profit";
  if (s.includes("직접")) return "manual";
  return "equal_total";
}

export async function parseImport(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");
  const header = ws.getRow(1).values.map((v) => norm(cellValue(v)));
  const colIdx = {};
  for (const c of IMPORT_COLS) {
    const names = [c.header, ...c.alias].map(norm);
    const i = header.findIndex((h) => names.includes(h));
    if (i > 0) colIdx[c.key] = i;
  }
  const missing = ["customerName", "companyName", "execDate", "principal", "termValue"].filter((k) => !colIdx[k]);
  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const raw = {};
    for (const [k, i] of Object.entries(colIdx)) raw[k] = cellValue(row.getCell(i).value);
    if (!String(raw.customerName ?? "").trim() && !String(raw.principal ?? "").trim()) return;
    const input = {
      customerName: String(raw.customerName ?? "").trim(),
      customerPhone: String(raw.customerPhone ?? "").trim(),
      companyName: String(raw.companyName ?? "").trim(),
      manager: String(raw.manager ?? "").trim(),
      contact: String(raw.contact ?? "").trim(),
      category: String(raw.category ?? "").trim(),
      memo: String(raw.memo ?? "").trim(),
      execDate: parseDate(raw.execDate),
      principal: toWon(raw.principal),
      rate: String(raw.rate ?? "0").replace("%", "").trim() || "0",
      totalExpected: toWon(raw.totalExpected),
      termValue: Number(raw.termValue),
      termUnit: parseUnit(raw.termUnit) || "day",
      cycleValue: Number(raw.cycleValue) || 1,
      cycleUnit: parseUnit(raw.cycleUnit) || "day",
      method: parseMethod(raw.method),
      installmentAmount: toWon(raw.installmentAmount),
      firstDueDate: parseDate(raw.firstDueDate),
      expiryDate: parseDate(raw.expiryDate),
      collected: toWon(raw.collected) || 0,
    };
    const errors = [];
    if (!input.customerName) errors.push("고객명 없음");
    if (!input.companyName) errors.push("투자처명 없음");
    if (!isDate(input.execDate)) errors.push("실행일 형식 오류");
    if (!UNIT_LABEL[input.termUnit]) errors.push("기간단위 오류");
    if (!UNIT_LABEL[input.cycleUnit]) errors.push("주기단위 오류");
    const plan = errors.length ? null : buildPlan(input);
    if (plan && !plan.ok) errors.push(...plan.errors);
    if (plan?.ok && input.collected > plan.totalExpected) errors.push("기회수금액이 총 회수예정금액보다 큽니다");
    rows.push({
      row: n,
      input,
      errors,
      summary: plan?.ok
        ? { totalExpected: plan.totalExpected, count: plan.count, perAmount: plan.perAmount, expiryDate: plan.expiryDate }
        : null,
    });
  });
  return { rows, missingColumns: missing.map((k) => IMPORT_COLS.find((c) => c.key === k).header) };
}
