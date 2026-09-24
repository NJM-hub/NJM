// 날짜는 모두 'YYYY-MM-DD' 문자열로 다루고, 계산은 UTC 기준 일수(day number)로 한다.
// (시간대 때문에 하루씩 밀리는 문제를 원천 차단)

const DAY_MS = 86400000;
const RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDate(s) {
  if (typeof s !== "string" || !RE.test(s)) return false;
  return toStr(toNum(s)) === s;
}

export function toNum(s) {
  const m = RE.exec(s);
  if (!m) throw new Error(`잘못된 날짜: ${s}`);
  return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS);
}

export function toStr(n) {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(s, days) {
  return toStr(toNum(s) + days);
}

export function diffDays(a, b) {
  // a - b (일)
  return toNum(a) - toNum(b);
}

function daysInMonth(y, m0) {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

// 월 더하기: 기준일의 '일'을 유지하되 말일을 넘으면 말일로 맞춘다 (1/31 + 1개월 = 2/28)
export function addMonths(s, months) {
  const m = RE.exec(s);
  const y = +m[1];
  const m0 = +m[2] - 1 + months;
  const ny = y + Math.floor(m0 / 12);
  const nm = ((m0 % 12) + 12) % 12;
  const d = Math.min(+m[3], daysInMonth(ny, nm));
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function monthOf(s) {
  return s.slice(0, 7);
}

export function monthStart(s) {
  return s.slice(0, 7) + "-01";
}

export function monthEnd(s) {
  return addDays(addMonths(monthStart(s), 1), -1);
}

// 주의 마지막 날(일요일)
export function weekEnd(s) {
  const dow = new Date(toNum(s) * DAY_MS).getUTCDay(); // 0=일
  return addDays(s, dow === 0 ? 0 : 7 - dow);
}

// 한국 시간 기준 오늘
export function todayKST() {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return f.format(new Date());
}
