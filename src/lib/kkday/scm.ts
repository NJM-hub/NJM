/**
 * KKday 공급사(SCM) "주문 내보내기" 엑셀 전용 변환기.
 *
 * 컬럼 의미 (실제 내보내기 파일 기준):
 * - 이용 시간: 기사가 픽업 장소에 도착해야 하는 시각 (공항 픽업은 항공편 도착 시각)
 * - 최종 픽업 시간: 고객을 기다릴 수 있는 마지막 시각 (공항 픽업 +90분, 샌딩 +30분)
 * - 여정 유형: 공항 픽업(공항 → 숙소) / 공항 샌딩(숙소 → 공항)
 * - 차량 모델명: 고객이 결제한 차급 (예: 이코노미 7인승, 컴포트 9인승)
 */
import { airportLocation } from "@/lib/airports";
import { parseDate, parseTime, type Cell, type ParsedBooking } from "./parse";

const REQUIRED = ["주문 번호", "여정 유형", "이용 시간", "위치 이름"];

const clean = (s: string) => s.replace(/\s+/g, "");

export function isKkdayScm(headers: Cell[]): boolean {
  const hs = headers.map((h) => clean(String(h ?? "")));
  return REQUIRED.every((r) => hs.some((h) => h.startsWith(clean(r))));
}

function colIndex(headers: Cell[], name: string): number {
  const n = clean(name);
  return headers.findIndex((h) => clean(String(h ?? "")).startsWith(n));
}

function text(c: Cell): string | null {
  if (c == null) return null;
  const s = String(c).trim();
  return s ? s : null;
}

/** "2026-09-23 15:35:00（GMT）+09:00" → ISO (+09:00) */
export function kkTime(c: Cell): string | null {
  const d = parseDate(c);
  const t = parseTime(c);
  return d && t ? `${d}T${t}:00+09:00` : null;
}

/** "어린이용 좌석*1，공항에서 픽업*0" → "어린이용 좌석 1" (0개 항목은 제외) */
export function extraServices(c: Cell): string | null {
  const s = text(c);
  if (!s) return null;
  const items = s
    .split(/[，,]/)
    .map((x) => x.trim().match(/^(.+?)\*(\d+)$/))
    .filter((m): m is RegExpMatchArray => !!m && Number(m[2]) > 0)
    .map((m) => `${m[1]} ${m[2]}`);
  return items.length ? items.join(", ") : null;
}

export type ScmParseResult = { bookings: ParsedBooking[]; cancelled: number };

export function parseKkdayScm(rows: Cell[][], headerRow: number): ScmParseResult {
  const headers = rows[headerRow] ?? [];
  const idx = (n: string) => colIndex(headers, n);
  const c = {
    orderNo: idx("주문 번호"),
    supplierNo: idx("공급업체 주문 번호"),
    orderStatus: idx("주문 상태"),
    productName: idx("상품명"),
    vehicleModel: idx("차량 모델명"),
    tripType: idx("여정 유형"),
    iata: idx("공항 IATA 코드"),
    airportName: idx("공항명"),
    terminal: idx("터미널"),
    place: idx("위치 이름"),
    address: idx("상세 주소"),
    flight: idx("항공편 번호"),
    adult: idx("성인 수"),
    child: idx("어린이 수"),
    extra: idx("추가 서비스"),
    lastPickup: idx("최종 픽업 시간"),
    useTime: idx("이용 시간"),
    cancelled: idx("취소 여부"),
  };
  const get = (row: Cell[], i: number): Cell => (i >= 0 ? row[i] : null);

  const bookings: ParsedBooking[] = [];
  let cancelled = 0;
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((x) => x == null || String(x).trim() === "")) continue;
    const cancelFlag = get(row, c.cancelled);
    if (cancelFlag === true || String(cancelFlag).toLowerCase() === "true" || text(get(row, c.orderStatus)) === "취소") {
      cancelled++;
      continue;
    }

    const warnings: string[] = [];
    const pickupAt = kkTime(get(row, c.useTime));
    const lastPickup = kkTime(get(row, c.lastPickup));
    if (!pickupAt) warnings.push("이용 시간을 인식하지 못했습니다");
    const waitMin =
      pickupAt && lastPickup ? Math.max(0, Math.round((Date.parse(lastPickup) - Date.parse(pickupAt)) / 60000)) : null;

    const tripType = text(get(row, c.tripType));
    const toAirport = /샌딩|sending|drop/i.test(tripType ?? "");
    const iata = text(get(row, c.iata));
    const terminal = text(get(row, c.terminal));
    const airport = airportLocation(iata, terminal);
    const airportLabel = [text(get(row, c.airportName)) ?? iata, terminal].filter(Boolean).join(" ");
    const place = text(get(row, c.place));
    const address = text(get(row, c.address));
    // 숙소 쪽은 지도 검색용으로 상세 주소를 쓰고, 화면에는 위치 이름을 함께 보여준다
    const hotelAddress = address ?? place;

    const pax = (Number(get(row, c.adult)) || 0) + (Number(get(row, c.child)) || 0);
    if (pax <= 0) warnings.push("인원을 인식하지 못해 1명으로 처리했습니다");
    const vehicleClass = text(get(row, c.vehicleModel));
    const extra = extraServices(get(row, c.extra));

    const raw: Record<string, string> = {};
    headers.forEach((h, i) => {
      const v = row[i];
      if (h != null && v != null && String(v).trim() !== "") raw[String(h)] = String(v);
    });

    bookings.push({
      rowIndex: r + 1,
      bookingNo: text(get(row, c.orderNo)),
      productName: [tripType, vehicleClass].filter(Boolean).join(" · ") || text(get(row, c.productName)),
      customerName: null,
      customerPhone: null,
      pax: pax > 0 ? pax : 1,
      serviceDate: pickupAt ? pickupAt.slice(0, 10) : null,
      pickupAt,
      durationMin: null, // 좌표로 이동시간을 계산
      pickupAddress: toAirport ? hotelAddress : airportLabel,
      dropoffAddress: toAirport ? airportLabel : hotelAddress,
      pickupPlace: toAirport ? place : airportLabel,
      dropoffPlace: toAirport ? airportLabel : place,
      flightNo: text(get(row, c.flight)),
      memo: extra,
      fare: null,
      tripType,
      vehicleClass,
      waitMin,
      pickupLat: toAirport ? null : airport?.lat ?? null,
      pickupLng: toAirport ? null : airport?.lng ?? null,
      dropoffLat: toAirport ? airport?.lat ?? null : null,
      dropoffLng: toAirport ? airport?.lng ?? null : null,
      raw,
      warnings,
    });
  }
  return { bookings, cancelled };
}
