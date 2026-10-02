// 금액 표시

/** 1,850,000원 */
export function won(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

/** 쉼표만 */
export function num(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return Math.round(n).toLocaleString("ko-KR");
}

/**
 * 큰 금액을 읽기 쉽게: 850,000,000 → "8.5억원", 18,500,000 → "1,850만원", 3,200,000,000 → "32억원"
 * 1만원 미만은 원 단위 그대로.
 */
export function wonShort(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e8) {
    const v = a / 1e8;
    const s = v >= 100 ? Math.round(v).toLocaleString("ko-KR") : trim(v.toFixed(2));
    return `${sign}${s}억원`;
  }
  if (a >= 1e4) return `${sign}${Math.round(a / 1e4).toLocaleString("ko-KR")}만원`;
  return `${sign}${Math.round(a).toLocaleString("ko-KR")}원`;
}

function trim(s: string): string {
  return s.replace(/\.?0+$/, "");
}

/** 7.2% */
export function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${n.toFixed(digits)}%`;
}

/** 그래프 축용 짧은 표기: 18M 대신 한국식 1,800만 */
export function axisShort(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e8) return `${trim((n / 1e8).toFixed(1))}억`;
  if (a >= 1e4) return `${Math.round(n / 1e4).toLocaleString("ko-KR")}만`;
  return String(Math.round(n));
}

/** 입력값의 쉼표·원·공백 제거 후 정수 */
export function parseMoney(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).replace(/[,\s원₩]/g, "").trim();
  if (!s) return null;
  // "8.5억", "1850만" 같은 입력도 허용
  const m = s.match(/^(-?\d+(?:\.\d+)?)(억|만|천)?$/);
  if (!m) return null;
  const base = Number(m[1]);
  const mult = m[2] === "억" ? 1e8 : m[2] === "만" ? 1e4 : m[2] === "천" ? 1e3 : 1;
  return Math.round(base * mult);
}

export function phoneDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}
