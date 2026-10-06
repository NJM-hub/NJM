/**
 * 구글 시트로 관리하던 배차표 전용 변환기.
 *
 * KKday 중국어 주문 목록(订单编号, 行程类型, 用车时间, 车型名称 …)에 `driver` 칸을 더한 형식이다.
 * - driver 칸: "金基峰9763" / "Henry 9759" 처럼 기사명 + 차량번호 뒤 4자리 → 해당 차량에 배차
 *              "55000" 처럼 금액만 적혀 있으면 외부(타업체)로 넘긴 콜
 * - 헤더 없는 뒤쪽 칸에 추가 서비스("儿童座椅*0，举牌接机*0"), 성인 수, 어린이 수가 들어 있다.
 * - 표 아래쪽에는 기사별 칸(머리글 "林杰9860" …)이 있고, 그 아래 "9:00 명동 S. T1" 처럼 시간과 내용이 적힌 칸은
 *   기사가 외부에서 직접 받아온 콜(자체 콜)이다. "市内包车80000" 은 전세, "休息" 는 휴무, "입금" 은 입금 확인.
 */
import { airportLocation } from "@/lib/airports";
import { type Cell, type ParsedBooking } from "./parse";
import { kkTime } from "./scm";

export type SheetDriver =
  | { kind: "vehicle"; driverName: string | null; plateSuffix: string | null; label: string }
  | { kind: "external"; fare: number; label: string };

export type SheetBooking = ParsedBooking & { sheetDriver: SheetDriver | null };

/** 기사가 외부에서 직접 받아온 콜 */
export const OWN_CALL_SOURCE = "driver_own";

const clean = (s: Cell) => String(s ?? "").replace(/\s+/g, "").toLowerCase();

const COLUMNS = {
  orderNo: ["订单编号", "訂單編號"],
  driver: ["driver", "기사", "司机"],
  tripType: ["行程类型", "行程類型"],
  useTime: ["用车时间", "用車時間"],
  flight: ["航班编号", "航班編號"],
  vehicleModel: ["车型名称", "車型名稱"],
  airport: ["机场名称", "機場名稱"],
  terminal: ["航站楼", "航站樓"],
  customer: ["订购人", "訂購人"],
  phone: ["订购人电话", "訂購人電話"],
  place: ["位置名称", "位置名稱"],
  address: ["详细地址", "詳細地址"],
  extra: ["附加服务", "附加服務"],
  app: ["app"],
} as const;

type Col = keyof typeof COLUMNS;

function indexes(headers: Cell[]): Record<Col, number> {
  const hs = headers.map(clean);
  const out = {} as Record<Col, number>;
  for (const key of Object.keys(COLUMNS) as Col[]) {
    out[key] = hs.findIndex((h) => COLUMNS[key].some((n) => h === clean(n)));
  }
  return out;
}

export function isDispatchSheet(headers: Cell[]): boolean {
  const c = indexes(headers);
  return c.orderNo >= 0 && c.driver >= 0 && c.tripType >= 0 && c.useTime >= 0;
}

/** 상위 10행 중 배차표 헤더 행 (없으면 -1) */
export function findDispatchSheetHeader(rows: Cell[][]): number {
  return rows.slice(0, 10).findIndex((r) => isDispatchSheet(r ?? []));
}

/** 기사 칸에 "100%取消" 처럼 취소 표시가 있으면 취소된 예약 */
export function isCancelledCell(c: Cell): boolean {
  // 퍼센트 서식 셀(100% → 1, 50% → 0.5)은 취소 수수료 비율 표시
  if (typeof c === "number") return c > 0 && c <= 1;
  const s = String(c ?? "").trim();
  if (/^(0?\.\d+|1(\.0+)?)$/.test(s)) return true;
  // "100%", "50%", "USD 20.38 (50%)" 처럼 비율만 적힌 칸도 취소 (금액만 적힌 외부 콜과 구분)
  return /取消|취소|cancel/i.test(s) || /\d+(\.\d+)?\s*%/.test(s);
}

/** 기사 칸에 차량 대신 적힌 메모 (불만·지각 등) */
export function isDriverNote(c: Cell): boolean {
  const s = String(c ?? "").trim();
  return !!s && !/\d{4}/.test(s) && /投诉|지각|불만|컴플레인|complain|迟到|晚到/i.test(s);
}

/** "金基峰9763" → 차량 배차, "55000" → 외부 콜, 빈칸·메모 → null */
export function parseDriverCell(c: Cell): SheetDriver | null {
  const s = String(c ?? "").trim();
  if (!s || isDriverNote(s)) return null;
  const amount = s.replace(/[,\s원₩]/g, "");
  if (/^\d+$/.test(amount) && Number(amount) >= 1000) return { kind: "external", fare: Number(amount), label: s };
  const m = s.match(/^(.*?)\s*(?<!\d)(\d{4})$/);
  if (m) return { kind: "vehicle", driverName: m[1].trim() || null, plateSuffix: m[2], label: s };
  // "9772 Henry" 처럼 차량번호 뒤 4자리가 앞에 오는 경우
  const f = s.match(/^(\d{4})(?!\d)\s*(.*)$/);
  if (f) return { kind: "vehicle", driverName: f[2].trim() || null, plateSuffix: f[1], label: s };
  return { kind: "vehicle", driverName: s, plateSuffix: null, label: s };
}

/** 送机 → 공항 샌딩, 接机 → 공항 픽업 */
export function tripTypeOf(s: string | null): string | null {
  if (!s) return null;
  if (/送机|送機/.test(s)) return "공항 샌딩";
  if (/接机|接機/.test(s)) return "공항 픽업";
  return s;
}

/** "经济型7座" → "이코노미 7인승", "舒适型10座" → "컴포트 10인승" */
export function vehicleClassOf(s: string | null): string | null {
  if (!s) return null;
  const seats = s.match(/(\d+)\s*[座人]/)?.[1];
  const grade = /经济|經濟/.test(s) ? "이코노미" : /舒适|舒適/.test(s) ? "컴포트" : /豪华|豪華/.test(s) ? "럭셔리" : null;
  if (!seats || !grade) return s;
  return `${grade} ${seats}인승`;
}

/** "仁川国际机场" / "ICN仁川國際機場T1" → 인천국제공항 (T1). 공항이 아니면 null */
function airportOf(name: string | null): { iata: string; label: string; terminal: string | null } | null {
  if (!name) return null;
  const terminal = name.match(/T\s*([12])\s*$/i)?.[1];
  if (/仁川|인천|incheon|icn/i.test(name)) return { iata: "ICN", label: "인천국제공항", terminal: terminal ? `T${terminal}` : null };
  if (/金浦|김포|gimpo|gmp/i.test(name)) return { iata: "GMP", label: "김포국제공항", terminal: null };
  return null;
}

/** 이용 시간 칸: 문자열 "2026-09-28 11:00:00（GMT）+09:00", 엑셀 날짜(초 단위 오차 포함), 또는 날짜 없는 "15点出发" 등 */
function pickupTimeOf(c: Cell, sheetDate: string | null): string | null {
  if (c instanceof Date) return kkTime(new Date(Math.round(c.getTime() / 60000) * 60000));
  if (typeof c === "number") {
    // 엑셀에서 숫자로 바뀐 "17.05" / "8.3"
    const h = Math.floor(c);
    const m = Math.round((c - h) * 100);
    return sheetDate && c < 24 && m < 60 ? `${sheetDate}T${pad(h)}:${pad(m)}:00+09:00` : null;
  }
  const s = text(c);
  if (!s) return null;
  const full = kkTime(s);
  if (full || !sheetDate) return full;
  const t = findTime(s);
  if (!t) return null;
  // "9/8 오전 6:00" 처럼 월/일이 적혀 있으면 그 날짜
  const md = s.match(/(?<!\d)(\d{1,2})\s*[/월]\s*(\d{1,2})(?!\d)/);
  const date = md ? `${sheetDate.slice(0, 4)}-${pad(+md[1])}-${pad(+md[2])}` : sheetDate;
  return `${date}T${t}:00+09:00`;
}

const EXTRA_NAMES: Record<string, string> = {
  儿童座椅: "어린이 좌석",
  兒童座椅: "어린이 좌석",
  举牌接机: "피켓",
  舉牌接機: "피켓",
};

/** "儿童座椅*1，举牌接机*0" → "어린이 좌석 1" (0개는 제외) */
export function sheetExtras(s: string): string | null {
  const items = s
    .split(/[，,]/)
    .map((x) => x.trim().match(/^(.+?)\*(\d+)$/))
    .filter((m): m is RegExpMatchArray => !!m && Number(m[2]) > 0)
    .map((m) => `${EXTRA_NAMES[m[1]] ?? m[1]} ${m[2]}`);
  return items.length ? items.join(", ") : null;
}

function text(c: Cell): string | null {
  if (c == null) return null;
  const s = String(c).trim();
  return s ? s : null;
}

/** 기사 칸 아래의 메모 중 콜이 아닌 것 (휴무, 차량점검 등) */
export type DriverNote = { date: string; driver: string; text: string };

export type SheetParseResult = {
  bookings: SheetBooking[];
  /** 기사 자체 콜 */
  ownCalls: SheetBooking[];
  notes: DriverNote[];
  /** 예약처럼 보이지만 시간을 읽지 못해 빠진 행 (화면에서 확인용) */
  unparsed: { rowIndex: number; text: string }[];
  /** 기사 칸에 취소 표시가 있는 예약 (전산에 있으면 지운다) */
  cancelled: { rowIndex: number; bookingNo: string; text: string }[];
  skipped: number;
};

type Columns = Record<Col, number>;

/** 뒤쪽 헤더 없는 칸: 추가 서비스 → 성인 수 → 어린이 수, 나머지 글자는 요청사항 */
function parseTail(row: Cell[], from: number): { extra: string | null; notes: string[]; pax: number } {
  let extra: string | null = null;
  const counts: number[] = [];
  const notes: string[] = [];
  let people: number | null = null;
  for (const cell of row.slice(from)) {
    const v = text(cell);
    if (!v) continue;
    if (/\*\d/.test(v)) extra = sheetExtras(v);
    else if (/^\d+$/.test(v)) counts.push(Number(v));
    else if (/성인|成人|adult/i.test(v)) {
      // "성인×3, 어린이×0"
      const adult = Number(v.match(/(?:성인|成人|adult)\D*(\d+)/i)?.[1] ?? 0);
      const child = Number(v.match(/(?:어린이|儿童|兒童|child)\D*(\d+)/i)?.[1] ?? 0);
      people = adult + child;
    } else notes.push(v);
  }
  return { extra, notes, pax: people ?? (counts[0] ?? 0) + (counts[1] ?? 0) };
}

/** 예약 목록의 한 행 (이용 시간은 이미 읽은 상태) */
function parseBookingRow(row: Cell[], r: number, pickupAt: string, headers: Cell[], c: Columns, tailFrom: number): SheetBooking {
  const get = (i: number) => (i >= 0 ? text(row[i]) : null);
  const warnings: string[] = [];
  const tripType = tripTypeOf(get(c.tripType));
  const toAirport = tripType === "공항 샌딩";
  // TALIXO 등 다른 출처 행은 칸 배치가 달라 공항 칸에 다른 값이 들어 있을 수 있다 → 인천공항으로 보고 원문은 메모로
  const airportInfo = airportOf(get(c.airport));
  const foreign = !airportInfo;
  const terminal = get(c.terminal) ?? airportInfo?.terminal ?? null;
  const airport = airportLocation(airportInfo?.iata ?? "ICN", terminal);
  const airportLabel = [airportInfo?.label ?? "인천국제공항", terminal].filter(Boolean).join(" ");
  const place = foreign ? null : get(c.place);
  const hotelAddress = foreign ? null : get(c.address) ?? place;
  const orderNo = get(c.orderNo);
  const isKk = /^\d{2}KK\d+/i.test(orderNo ?? "");
  const sourceLabel = orderNo && !isKk ? orderNo : null;
  if (foreign) warnings.push("칸 배치가 달라 장소를 메모로 옮겼습니다");

  const tail = parseTail(row, tailFrom);
  if (tail.pax <= 0) warnings.push("인원을 인식하지 못해 1명으로 처리했습니다");
  const sheetDriver = parseDriverCell(row[c.driver]);
  const driverNote = isDriverNote(row[c.driver]) ? `기사 칸 메모: ${text(row[c.driver])}` : null;
  if (!sheetDriver) warnings.push(driverNote ? `${driverNote} (차량을 알 수 없어 미배정)` : "기사가 비어 있어 미배정으로 둡니다");
  const foreignText = foreign ? row.slice(c.useTime + 1, tailFrom).map(text).filter(Boolean).join(" / ") : null;
  const vehicleClass = foreign ? null : vehicleClassOf(get(c.vehicleModel));

  const raw: Record<string, string> = {};
  headers.forEach((h, i) => {
    const v = text(row[i]);
    if (v != null) raw[text(h) ?? `${i + 1}열`] = v;
  });

  return {
    rowIndex: r + 1,
    bookingNo: isKk || !orderNo ? orderNo : otherSourceNo(orderNo, pickupAt, sheetDriver),
    productName: [sourceLabel, tripType, vehicleClass].filter(Boolean).join(" · ") || null,
    customerName: foreign ? null : get(c.customer),
    customerPhone: foreign ? null : get(c.phone),
    pax: tail.pax > 0 ? tail.pax : 1,
    serviceDate: pickupAt.slice(0, 10),
    pickupAt,
    durationMin: null,
    pickupAddress: toAirport ? hotelAddress : airportLabel,
    dropoffAddress: toAirport ? airportLabel : hotelAddress,
    pickupPlace: toAirport ? place : airportLabel,
    dropoffPlace: toAirport ? airportLabel : place,
    flightNo: get(c.flight),
    memo: [driverNote, sourceLabel, foreignText, tail.extra, ...tail.notes].filter(Boolean).join(" / ") || null,
    fare: null,
    tripType,
    vehicleClass,
    // KKday 기준: 공항 픽업은 도착 후 90분, 샌딩은 30분까지 대기
    waitMin: tripType === "공항 픽업" ? 90 : tripType === "공항 샌딩" ? 30 : null,
    pickupLat: toAirport ? null : airport?.lat ?? null,
    pickupLng: toAirport ? null : airport?.lng ?? null,
    dropoffLat: toAirport ? airport?.lat ?? null : null,
    dropoffLng: toAirport ? airport?.lng ?? null : null,
    raw,
    warnings,
    sheetDriver,
  };
}

/** TALIXO·타사 오더처럼 예약번호가 없는 행: 출처+날짜+시각+차량으로 번호를 만든다 (다시 불러와도 같은 번호) */
function otherSourceNo(label: string, pickupAt: string, d: SheetDriver | null): string {
  const key = d?.kind === "vehicle" ? d.plateSuffix ?? d.driverName : "x";
  return `${label.slice(0, 20)}-${pickupAt.slice(0, 10)}-${pickupAt.slice(11, 16).replace(":", "")}-${key}`;
}

export function parseDispatchSheet(rows: Cell[][], headerRow: number): SheetParseResult {
  const headers = rows[headerRow] ?? [];
  const c = indexes(headers);
  // 추가 서비스·인원·요청사항은 APP / 附加服务 칸부터 끝까지 헤더 없이 섞여 있다
  const tailFrom = Math.min(...[c.extra, c.app].filter((i) => i >= 0), headers.length);

  // 시트의 날짜: 날짜가 온전히 적힌 이용 시간 중 가장 많은 날
  const count = new Map<string, number>();
  for (const row of rows.slice(headerRow + 1)) {
    const d = pickupTimeOf(row?.[c.useTime], null)?.slice(0, 10);
    if (d) count.set(d, (count.get(d) ?? 0) + 1);
  }
  const date = [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  // 표 아래 기사별 칸이 시작되면 예약 목록은 끝
  const gridHeader = findDriverGridHeader(rows, headerRow + 1, c.driver);
  const end = gridHeader >= 0 ? gridHeader : rows.length;

  const bookings: SheetBooking[] = [];
  const unparsed: SheetParseResult["unparsed"] = [];
  const cancelled: SheetParseResult["cancelled"] = [];
  let skipped = 0;
  for (let r = headerRow + 1; r < end; r++) {
    const row = rows[r] ?? [];
    if (!row.some((x) => text(x))) continue;
    const pickupAt = pickupTimeOf(row[c.useTime], date);
    if (pickupAt && isCancelledCell(row[c.driver])) {
      const b = parseBookingRow(row, r, pickupAt, headers, c, tailFrom);
      if (b.bookingNo) cancelled.push({ rowIndex: r + 1, bookingNo: b.bookingNo, text: `${text(row[c.driver])} ${pickupAt.slice(11, 16)} ${b.tripType ?? ""}` });
      continue;
    }
    if (pickupAt) {
      bookings.push(parseBookingRow(row, r, pickupAt, headers, c, tailFrom));
      continue;
    }
    skipped++; // 메모 행 등
    if (/^\d{2}KK\d+/i.test(text(row[c.orderNo]) ?? "") || /送|接/.test(text(row[c.tripType]) ?? "")) {
      unparsed.push({ rowIndex: r + 1, text: row.map(text).filter(Boolean).slice(0, 6).join(" | ") });
    }
  }

  const own = date && gridHeader >= 0 ? parseOwnCalls(rows, gridHeader, date) : { calls: [], notes: [] };
  return { bookings, ownCalls: own.calls, notes: own.notes, unparsed, cancelled, skipped };
}

// ─────────────────────────────────────────────
// 기사 자체 콜 (표 아래 기사별 칸)
// ─────────────────────────────────────────────

const DRIVER_LABEL = /^[^\d\s].{0,20}?\s*(?<!\d)\d{4}$/;
const BOOKING_REF = /^\d{2}KK\d{6,}$/i;

/** 기사 칸 머리글 행: 기사명+차량 뒤 4자리가 두 칸 이상이고, 예약 행과 달리 driver 칸은 비어 있다 */
export function findDriverGridHeader(rows: Cell[][], from: number, driverCol = 1): number {
  for (let r = Math.max(0, from); r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (text(row[driverCol])) continue;
    const labels = row.slice(1).filter((c) => DRIVER_LABEL.test(String(c ?? "").trim()));
    if (labels.length >= 2) return r;
  }
  return -1;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 메모 칸에서 시각을 찾는다: "9:00", "15.30", "1100", "9点", "5点20", "下午4点"
 * 전세 금액(80000) 같은 긴 숫자는 시각으로 보지 않는다.
 */
export function findTime(s: string): string | null {
  return matchTime(s)?.time ?? null;
}

function matchTime(s: string): { time: string; end: number } | null {
  const t = s.replace(/\d{5,}/g, (x) => " ".repeat(x.length));
  const pm = /下午|오후|pm/i.test(t);
  let h: number;
  let m: number;
  let x = t.match(/(?<!\d)(\d{1,2})\s*[:：.。]\s*(\d{2})(?!\d)/);
  if (x) [h, m] = [+x[1], +x[2]];
  else if ((x = t.match(/(?<!\d)(\d{1,2})\s*[点點时時](?:\s*(\d{1,2})(?!\d))?/))) [h, m] = [+x[1], x[2] ? +x[2] : 0];
  else if ((x = t.match(/(?<!\d)([01]\d|2[0-3])([0-5]\d)(?!\d)/))) [h, m] = [+x[1], +x[2]];
  else return null;
  if (pm && h < 12) h += 12;
  if (h > 23 || m > 59) return null;
  return { time: `${pad(h)}:${pad(m)}`, end: x.index! + x[0].length };
}

const AIRPORT_TOKENS = /T\s*[12](?![0-9])|仁川|인천|ICN|金浦|김포|GMP|机场|機場|공항/gi;

/** "9:00 명동 S. T1" → 샌딩 · 명동 → 인천공항 T1 */
export function parseOwnCallText(text: string): {
  time: string | null;
  tripType: string | null;
  place: string | null;
  iata: string | null;
  terminal: string | null;
  charterFare: number | null;
  durationMin: number | null;
} {
  text = text.replace(/(?<!\d)\d{1,2}\s*[/월]\s*\d{1,2}\s*일?(?!\d)/g, " "); // "9/14" 같은 날짜
  const first = matchTime(text);
  const time = first?.time ?? null;
  // "16点大林至弘大 点对点17点结束" → 두 번째 시각을 끝나는 시각으로 보고 소요시간 계산
  const endTime = first && /结束|結束|끝|까지/.test(text) ? findTime(text.slice(first.end)) : null;
  let durationMin: number | null = null;
  if (time && endTime) {
    const toMin = (x: string) => +x.slice(0, 2) * 60 + +x.slice(3);
    durationMin = (toMin(endTime) - toMin(time) + 1440) % 1440 || null;
  }
  const charter = /包车|包車|전세|대절/.test(text);
  const charterFare = charter ? Number(text.match(/\d{4,}/)?.[0] ?? 0) || null : null;
  const terminal = text.match(/T\s*([12])(?![0-9])/i)?.[1];
  const iata = /金浦|김포|GMP/i.test(text) ? "GMP" : /仁川|인천|ICN|机场|機場|공항/i.test(text) || terminal ? "ICN" : null;
  const sending = /送|샌딩|(^|[^A-Za-z])S([^A-Za-z]|$)/.test(text);
  const pickup = /接|픽업|(^|[^A-Za-z])J([^A-Za-z]|$)/.test(text);
  const place =
    text
      .replace(/下午|上午|오전|오후/g, " ")
      .replace(/(?<!\d)\d{1,2}\s*[:：.。]\s*\d{2}(?!\d)|(?<!\d)\d{1,2}\s*[点點时時](\s*\d{1,2}(?!\d))?|(?<!\d)\d{3,}/g, " ")
      .replace(AIRPORT_TOKENS, " ")
      .replace(/点对点|點對點|结束|結束|끝|까지|送机|送機|接机|接機|送|接|샌딩|픽업|市内包车|市外包车|包车|包車|(^|[^A-Za-z])[SJ](?=[^A-Za-z]|$)/g, " ")
      .replace(/[-—–~→。.,，:：\s]+/g, " ")
      .trim() || null;
  let tripType: string | null = null;
  if (charter) tripType = /市外|시외/.test(text) ? "시외 전세" : "시내 전세";
  else if (sending && !pickup) tripType = "공항 샌딩";
  else if (pickup && !sending) tripType = "공항 픽업";
  else if (iata) {
    // "5点20仁川—新林" 처럼 공항이 장소보다 먼저 나오면 픽업
    const a = text.search(AIRPORT_TOKENS);
    const p = place ? text.indexOf(place.split(" ")[0]) : -1;
    tripType = p > a ? "공항 픽업" : "공항 샌딩";
  }
  return { time, tripType, place, iata, terminal: terminal ? `T${terminal}` : null, charterFare, durationMin };
}

/** 표 아래 기사별 칸을 읽어 기사 자체 콜과 메모로 나눈다 */
export function parseOwnCalls(rows: Cell[][], header: number, date: string): { calls: SheetBooking[]; notes: DriverNote[] } {
  if (header < 0) return { calls: [], notes: [] };
  const calls: SheetBooking[] = [];
  const notes: DriverNote[] = [];
  const hdr = rows[header] ?? [];
  for (let j = 1; j < hdr.length; j++) {
    const label = String(hdr[j] ?? "").trim();
    if (!DRIVER_LABEL.test(label)) continue;
    const driver = parseDriverCell(label);
    const cells: { r: number; text: string }[] = [];
    for (let r = header + 1; r < rows.length; r++) {
      const v = text(rows[r]?.[j]);
      if (v) cells.push({ r, text: v });
    }
    const paid = cells.some((c) => /입금/.test(c.text));
    let n = 0;
    for (const { r, text: raw } of cells) {
      const t = raw.replace(/\s+/g, " ").trim();
      if (/입금/.test(t) || BOOKING_REF.test(t)) continue; // 입금 확인, 후기 받은 예약번호 등
      const info = parseOwnCallText(t);
      if (!info.time && info.charterFare == null) {
        notes.push({ date, driver: label, text: t });
        continue;
      }
      n++;
      const toAirport = info.tripType === "공항 샌딩";
      const isAirport = info.tripType === "공항 샌딩" || info.tripType === "공항 픽업";
      const airport = isAirport ? airportLocation(info.iata ?? "ICN", info.terminal) : null;
      const airportLabel = isAirport
        ? [info.iata === "GMP" ? "김포국제공항" : "인천국제공항", info.terminal].filter(Boolean).join(" ")
        : null;
      // 공항이 아닌 콜: "大林至弘大" → 대림 → 홍대
      const [from, to] = isAirport ? [info.place, null] : (info.place ?? "").split(/\s*(?:至|到|→)\s*/).map((x) => x || null);
      // 장소는 동네 이름뿐이라 좌표는 배차 때 지도 검색(못 찾으면 동네 중심)으로 정한다. 공항만 좌표를 넣는다
      const pickupAt = info.time ? `${date}T${info.time}:00+09:00` : null;
      const warnings: string[] = [];
      if (!pickupAt) warnings.push("시간이 없어 동선 계산에서 빠집니다");
      calls.push({
        rowIndex: r + 1,
        bookingNo: `OWN-${date}-${driver && driver.kind === "vehicle" ? driver.plateSuffix ?? driver.driverName : label}-${n}`,
        productName: `기사 자체 콜 · ${t}`,
        customerName: null,
        customerPhone: null,
        pax: 1,
        serviceDate: date,
        pickupAt,
        durationMin: info.durationMin ?? (info.tripType?.includes("전세") ? 480 : null),
        pickupAddress: toAirport ? info.place : airportLabel ?? from ?? null,
        dropoffAddress: toAirport ? airportLabel : isAirport ? info.place : to ?? null,
        pickupPlace: toAirport ? info.place : airportLabel ?? from ?? null,
        dropoffPlace: toAirport ? airportLabel : isAirport ? info.place : to ?? null,
        flightNo: null,
        memo: [t, paid ? "입금 확인" : null].filter(Boolean).join(" / "),
        fare: info.charterFare,
        tripType: info.tripType,
        vehicleClass: null,
        waitMin: null,
        pickupLat: toAirport ? null : airport?.lat ?? null,
        pickupLng: toAirport ? null : airport?.lng ?? null,
        dropoffLat: toAirport ? airport?.lat ?? null : null,
        dropoffLng: toAirport ? airport?.lng ?? null : null,
        raw: { 기사: label, 내용: t, ...(paid ? { 입금: "확인" } : {}) },
        warnings,
        sheetDriver: driver,
        source: OWN_CALL_SOURCE,
      });
    }
  }
  return { calls, notes };
}
