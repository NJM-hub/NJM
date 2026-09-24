/**
 * 프리랜서(인적용역) 기사 지급액에 대한 사업소득 원천징수 계산.
 * - 소득세: 지급액의 3%, 10원 미만 절사
 * - 지방소득세: 소득세의 10%, 10원 미만 절사
 * - 소액부징수: 소득세가 1,000원 미만이면 징수하지 않음
 * 세율/코드는 설정에서 바꿀 수 있고, 실제 신고 전 세무사 확인을 권장한다.
 */

export type WithholdingOptions = {
  incomeTaxRate: number; // 0.03
  localTaxRate: number; // 0.1 (소득세 대비)
  minTax: number; // 1000
};

export const DEFAULT_WITHHOLDING: WithholdingOptions = {
  incomeTaxRate: 0.03,
  localTaxRate: 0.1,
  minTax: 1000,
};

const floor10 = (n: number) => Math.floor(n / 10) * 10;

export type Withholding = {
  gross: number;
  incomeTax: number;
  localTax: number;
  totalTax: number;
  net: number;
};

export function computeWithholding(gross: number, opts: WithholdingOptions = DEFAULT_WITHHOLDING): Withholding {
  const g = Math.max(0, Math.round(gross));
  let incomeTax = floor10(g * opts.incomeTaxRate);
  if (incomeTax < opts.minTax) incomeTax = 0;
  const localTax = floor10(incomeTax * opts.localTaxRate);
  return { gross: g, incomeTax, localTax, totalTax: incomeTax + localTax, net: g - incomeTax - localTax };
}

/** YYYY-MM 기준 신고 기한 */
export function filingDeadlines(month: string): { withholdingReturn: string; simplifiedStatement: string } {
  const [y, m] = month.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1)); // 다음달 1일
  const ny = next.getUTCFullYear();
  const nm = next.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    withholdingReturn: `${ny}-${p(nm)}-10`,
    simplifiedStatement: `${ny}-${p(nm)}-${p(lastDay)}`,
  };
}

/** CSV 셀 이스케이프 (엑셀 수식 주입 방지 포함) */
export function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
