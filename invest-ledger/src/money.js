// 모든 금액은 원 단위 정수. 소수점이 끼는 계산은 BigInt로 처리해 오차를 없앤다.

export function toWon(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,\s원₩]/g, ""));
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n);
}

// 수익률(%)을 소수점 4자리까지 정수(× 10000)로 변환: 20.5% -> 205000
export function rateToE4(rate) {
  const s = String(rate).trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`수익률 형식 오류: ${rate}`);
  const [i, f = ""] = s.split(".");
  const frac = (f + "0000").slice(0, 4);
  const rest = f.slice(4);
  let v = BigInt(i) * 10000n + BigInt(frac) * (s.startsWith("-") ? -1n : 1n);
  if (rest && Number(rest[0]) >= 5) v += 1n; // 5자리 이하는 반올림
  return v;
}

// 약정 수익 = 실행금액 × 수익률 / 100, 원 단위 반올림
export function calcProfit(principal, rate) {
  const e4 = rateToE4(rate);
  const num = BigInt(principal) * e4; // principal × rate × 10000
  const den = 1000000n; // 100 × 10000
  const q = num / den;
  const r = num % den;
  return Number(r * 2n >= den ? q + 1n : q);
}

// total 을 n 개로 균등 분할. 나머지는 마지막 회차에서 조정 → 합계가 정확히 total
export function splitEven(total, n) {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const arr = new Array(n).fill(base);
  arr[n - 1] = total - base * (n - 1);
  return arr;
}

// total 을 weights 비율로 분할(내림), 나머지는 마지막 회차에서 조정
export function splitWeighted(total, weights) {
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (sumW <= 0) return splitEven(total, weights.length);
  const arr = weights.map((w) => Number((BigInt(total) * BigInt(w)) / BigInt(sumW)));
  const used = arr.slice(0, -1).reduce((a, b) => a + b, 0);
  arr[arr.length - 1] = total - used;
  return arr;
}

export function sum(arr) {
  let s = 0;
  for (const v of arr) s += v;
  return s;
}
