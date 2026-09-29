/**
 * 구글 시트로 관리하던 배차표 전용 변환기.
 *
 * KKday 중국어 주문 목록(订单编号, 行程类型, 用车时间, 车型名称 …)에 `driver` 칸을 더한 형식이다.
 * - driver 칸: "金基峰9763" / "Henry 9759" 처럼 기사명 + 차량번호 뒤 4자리 → 해당 차량에 배차
 *              "55000" 처럼 금액만 적혀 있으면 외부(타업체)로 넘긴 콜
 * - 헤더 없는 뒤쪽 칸에 추가 서비스("儿童座椅*0，举牌接机*0"), 성인 수, 어린이 수가 들어 있다.
 * - 표 아래쪽의 메모(단가, 기사 목록 등)는 이용 시간이 없으므로 건너뛴다.
 */
import { airportLocation } from "@/lib/airports";
import { type Cell, type ParsedBooking } from "./parse";
import { kkTime } from "./scm";

export type SheetDriver =
  | { kind: "vehicle"; driverName: string | null; plateSuffix: string | null; label: string }
  | { kind: "external"; fare: number; label: string };

export type SheetBooking = ParsedBooking & { sheetDriver: SheetDriver | null };

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

/** "金基峰9763" → 차량 배차, "55000" → 외부 콜, 빈칸 → null */
export function parseDriverCell(c: Cell): SheetDriver | null {
  const s = String(c ?? "").trim();
  if (!s) return null;
  const amount = s.replace(/[,\s원₩]/g, "");
  if (/^\d+$/.test(amount) && Number(amount) >= 1000) return { kind: "external", fare: Number(amount), label: s };
  const m = s.match(/^(.*?)\s*(\d{4})$/);
  if (m) return { kind: "vehicle", driverName: m[1].trim() || null, plateSuffix: m[2], label: s };
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

function airportOf(name: string | null): { iata: string | null; label: string | null } {
  if (!name) return { iata: null, label: null };
  if (/仁川|인천|incheon|icn/i.test(name)) return { iata: "ICN", label: "인천국제공항" };
  if (/金浦|김포|gimpo|gmp/i.test(name)) return { iata: "GMP", label: "김포국제공항" };
  return { iata: null, label: name };
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

export type SheetParseResult = { bookings: SheetBooking[]; skipped: number };

export function parseDispatchSheet(rows: Cell[][], headerRow: number): SheetParseResult {
  const headers = rows[headerRow] ?? [];
  const c = indexes(headers);
  const get = (row: Cell[], i: number) => (i >= 0 ? text(row[i]) : null);
  // 추가 서비스·인원·요청사항은 APP / 附加服务 칸부터 끝까지 헤더 없이 섞여 있다
  const tailFrom = Math.min(...[c.extra, c.app].filter((i) => i >= 0), headers.length);

  const bookings: SheetBooking[] = [];
  let skipped = 0;
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((x) => x == null || String(x).trim() === "")) continue;
    const pickupAt = kkTime(get(row, c.useTime));
    if (!pickupAt) {
      skipped++; // 표 아래 메모 등
      continue;
    }
    const warnings: string[] = [];

    const tripType = tripTypeOf(get(row, c.tripType));
    const toAirport = tripType === "공항 샌딩";
    const { iata, label } = airportOf(get(row, c.airport));
    const terminal = get(row, c.terminal);
    const airport = airportLocation(iata, terminal);
    const airportLabel = [label, terminal].filter(Boolean).join(" ") || null;
    const place = get(row, c.place);
    const hotelAddress = get(row, c.address) ?? place;

    // 뒤쪽 칸: 추가 서비스 → 성인 수 → 어린이 수, 나머지 글자는 요청사항
    let extra: string | null = null;
    const counts: number[] = [];
    const notes: string[] = [];
    let adult: number | null = null;
    let child: number | null = null;
    for (let i = tailFrom; i < row.length; i++) {
      const v = text(row[i]);
      if (!v) continue;
      if (/\*\d/.test(v)) extra = sheetExtras(v);
      else if (/^\d+$/.test(v)) counts.push(Number(v));
      else if (/성인|成人|adult/i.test(v)) {
        adult = Number(v.match(/(?:성인|成人|adult)\D*(\d+)/i)?.[1] ?? 0);
        child = Number(v.match(/(?:어린이|儿童|兒童|child)\D*(\d+)/i)?.[1] ?? 0);
      } else notes.push(v);
    }
    if (adult == null && counts.length) [adult, child] = [counts[0], counts[1] ?? 0];
    const pax = (adult ?? 0) + (child ?? 0);
    if (pax <= 0) warnings.push("인원을 인식하지 못해 1명으로 처리했습니다");

    const vehicleClass = vehicleClassOf(get(row, c.vehicleModel));
    const sheetDriver = parseDriverCell(row[c.driver]);
    if (!sheetDriver) warnings.push("기사가 비어 있어 미배정으로 둡니다");

    const raw: Record<string, string> = {};
    headers.forEach((h, i) => {
      const v = text(row[i]);
      if (v != null) raw[text(h) ?? `${i + 1}열`] = v;
    });

    bookings.push({
      rowIndex: r + 1,
      bookingNo: get(row, c.orderNo),
      productName: [tripType, vehicleClass].filter(Boolean).join(" · ") || null,
      customerName: get(row, c.customer),
      customerPhone: get(row, c.phone),
      pax: pax > 0 ? pax : 1,
      serviceDate: pickupAt.slice(0, 10),
      pickupAt,
      durationMin: null,
      pickupAddress: toAirport ? hotelAddress : airportLabel,
      dropoffAddress: toAirport ? airportLabel : hotelAddress,
      pickupPlace: toAirport ? place : airportLabel,
      dropoffPlace: toAirport ? airportLabel : place,
      flightNo: get(row, c.flight),
      memo: [extra, ...notes].filter(Boolean).join(" / ") || null,
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
    });
  }
  return { bookings, skipped };
}
