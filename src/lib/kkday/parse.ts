/**
 * KKday 등에서 받은 일정표(엑셀/CSV)를 공통 예약 형식으로 변환한다.
 * 파일마다 컬럼명이 다를 수 있으므로 별칭으로 자동 매핑하고, 화면에서 수정할 수 있게 한다.
 */

export const FIELDS = {
  bookingNo: "예약번호",
  productName: "상품명",
  customerName: "고객명",
  customerPhone: "연락처",
  pax: "인원",
  adult: "성인",
  child: "아동",
  infant: "유아",
  serviceDate: "이용일",
  pickupTime: "픽업시간",
  endTime: "종료시간",
  durationMin: "소요시간(분)",
  pickupAddress: "픽업장소",
  dropoffAddress: "하차장소",
  flightNo: "항공편",
  memo: "메모",
  fare: "기사 지급액",
  pickupLat: "픽업 위도",
  pickupLng: "픽업 경도",
  dropoffLat: "하차 위도",
  dropoffLng: "하차 경도",
} as const;

export type FieldKey = keyof typeof FIELDS;
export type ColumnMapping = Partial<Record<FieldKey, number>>;

const ALIASES: Record<FieldKey, string[]> = {
  bookingNo: ["예약번호", "주문번호", "orderno", "orderid", "order", "bookingno", "bookingid", "booking", "訂單編號", "订单编号"],
  productName: ["상품명", "상품", "productname", "product", "packagename", "package", "옵션", "상품옵션", "商品名稱", "产品名称"],
  customerName: ["고객명", "예약자", "여행자", "대표자", "이름", "성명", "travelername", "leadtraveler", "customername", "name", "contactname", "旅客姓名"],
  customerPhone: ["연락처", "전화번호", "휴대폰", "phone", "mobile", "tel", "contactnumber", "contactphone", "whatsapp", "電話"],
  pax: ["인원", "총인원", "인원수", "pax", "quantity", "qty", "totalpax", "numberofpeople", "人數"],
  adult: ["성인", "adult", "adults", "成人"],
  child: ["아동", "어린이", "소아", "child", "children", "kid", "兒童"],
  infant: ["유아", "infant", "infants", "baby", "嬰兒"],
  serviceDate: ["이용일", "이용일자", "출발일", "날짜", "일자", "투어일", "servicedate", "traveldate", "departuredate", "usedate", "date", "activitydate", "出發日期", "使用日期"],
  pickupTime: ["픽업시간", "출발시간", "시간", "이용시간", "pickuptime", "departuretime", "time", "starttime", "接送時間"],
  endTime: ["종료시간", "도착시간", "endtime", "finishtime", "returntime"],
  durationMin: ["소요시간", "소요시간분", "이용시간분", "duration", "durationmin", "hours"],
  pickupAddress: ["픽업장소", "픽업지", "출발지", "픽업주소", "승차장소", "숙소", "호텔", "pickuplocation", "pickupaddress", "pickup", "pickuppoint", "hotel", "meetingpoint", "from", "上車地點", "接送地點"],
  dropoffAddress: ["하차장소", "하차지", "도착지", "목적지", "하차주소", "dropofflocation", "dropoffaddress", "dropoff", "destination", "to", "下車地點"],
  flightNo: ["항공편", "편명", "flight", "flightno", "flightnumber", "航班"],
  memo: ["메모", "비고", "요청사항", "특이사항", "remark", "remarks", "note", "notes", "specialrequest", "comment", "備註"],
  fare: ["기사단가", "기사지급액", "지급액", "운행단가", "driverfare", "fare"],
  pickupLat: ["픽업위도", "pickuplat", "lat", "latitude"],
  pickupLng: ["픽업경도", "pickuplng", "pickuplon", "lng", "lon", "longitude"],
  dropoffLat: ["하차위도", "dropofflat"],
  dropoffLng: ["하차경도", "dropofflng", "dropofflon"],
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[\s_\-./()[\]:#]/g, "");
}

export type Cell = string | number | boolean | Date | null | undefined;

/** 헤더 행을 찾는다: 별칭과 가장 많이 일치하는 상위 10행 중 하나 */
export function findHeaderRow(rows: Cell[][]): number {
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const score = Object.keys(guessMapping(rows[i].map((c) => String(c ?? "")))).length;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}

export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<number>();
  const normalized = headers.map((h) => norm(h));
  // 1차: 완전 일치, 2차: 포함 일치 (긴 별칭 우선)
  for (const pass of ["exact", "contains"] as const) {
    for (const key of Object.keys(ALIASES) as FieldKey[]) {
      if (mapping[key] !== undefined) continue;
      const aliases = [...ALIASES[key]].sort((a, b) => b.length - a.length);
      for (const alias of aliases) {
        const a = norm(alias);
        const idx = normalized.findIndex(
          (h, i) => !used.has(i) && h.length > 0 && (pass === "exact" ? h === a : a.length >= 3 && h.includes(a)),
        );
        if (idx >= 0) {
          mapping[key] = idx;
          used.add(idx);
          break;
        }
      }
    }
  }
  return mapping;
}

export type ParsedBooking = {
  rowIndex: number;
  bookingNo: string | null;
  productName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  pax: number;
  serviceDate: string | null; // YYYY-MM-DD
  pickupAt: string | null; // ISO (+09:00)
  durationMin: number | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  flightNo: string | null;
  memo: string | null;
  fare: number | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  raw: Record<string, string>;
  warnings: string[];
};

const pad = (n: number) => String(n).padStart(2, "0");

function str(c: Cell): string | null {
  if (c == null) return null;
  if (c instanceof Date) return c.toISOString();
  const s = String(c).trim();
  return s.length ? s : null;
}

function num(c: Cell): number | null {
  if (c == null || c === "") return null;
  if (typeof c === "number") return c;
  const m = String(c).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** "성인 2, 아동 1" 같은 문자열도 합산 */
function paxOf(c: Cell): number | null {
  if (c == null || c === "") return null;
  if (typeof c === "number") return c;
  const nums = String(c).match(/\d+/g);
  return nums ? nums.reduce((s, n) => s + Number(n), 0) : null;
}

/** 엑셀 셀 날짜는 벽시계 시간이 UTC 필드에 들어있다 */
export function parseDate(c: Cell): string | null {
  if (c == null || c === "") return null;
  if (c instanceof Date) {
    if (c.getUTCFullYear() < 1901) return null;
    return `${c.getUTCFullYear()}-${pad(c.getUTCMonth() + 1)}-${pad(c.getUTCDate())}`;
  }
  if (typeof c === "number") {
    // 엑셀 일련번호
    if (c > 20000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(c) * 86_400_000);
      return parseDate(d);
    }
    return null;
  }
  const s = String(c).trim();
  let m = s.match(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/(\d{1,2})[-./](\d{1,2})[-./](\d{4})/); // DD/MM/YYYY 또는 MM/DD/YYYY
  if (m) {
    const [a, b] = [+m[1], +m[2]];
    const [mm, dd] = a > 12 ? [b, a] : [a, b];
    return `${m[3]}-${pad(mm)}-${pad(dd)}`;
  }
  return null;
}

/** "09:30", "9:30 PM", "오후 2:10", 엑셀 시간(0~1 소수), Date → "HH:MM" */
export function parseTime(c: Cell): string | null {
  if (c == null || c === "") return null;
  if (c instanceof Date) return `${pad(c.getUTCHours())}:${pad(c.getUTCMinutes())}`;
  if (typeof c === "number") {
    const frac = c % 1;
    if (c >= 0 && (c < 1 || frac > 0)) {
      const mins = Math.round(frac * 24 * 60) % (24 * 60);
      return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
    }
    if (c >= 0 && c <= 2359 && Number.isInteger(c) && c >= 100) {
      return `${pad(Math.floor(c / 100))}:${pad(c % 100)}`;
    }
    return null;
  }
  const s = String(c).trim();
  // 날짜가 섞여 있으면 날짜 뒤쪽의 시간만 본다
  const afterDate = s.replace(/\d{4}\s*[-./년]\s*\d{1,2}\s*[-./월]\s*\d{1,2}\s*일?/, "");
  const m = afterDate.match(/(\d{1,2})\s*[:시]\s*(\d{2})?/);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  const pm = /pm|오후/i.test(afterDate);
  const am = /am|오전/i.test(afterDate);
  if (pm && h < 12) h += 12;
  if (am && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

/** 상품명에서 "4시간", "8 hours" 등을 찾아 분으로 */
export function durationFromText(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/(\d+(?:\.\d+)?)\s*(시간|hours?|hrs?|h\b)/i);
  return m ? Math.round(Number(m[1]) * 60) : null;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function parseRows(
  rows: Cell[][],
  headerRow: number,
  mapping: ColumnMapping,
  opts: { fallbackDate?: string } = {},
): ParsedBooking[] {
  const headers = rows[headerRow]?.map((c) => String(c ?? "").trim()) ?? [];
  const out: ParsedBooking[] = [];
  const get = (row: Cell[], key: FieldKey): Cell => {
    const i = mapping[key];
    return i === undefined ? null : row[i];
  };

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => c == null || String(c).trim() === "")) continue;
    const warnings: string[] = [];

    const dateCell = get(row, "serviceDate");
    const serviceDate = parseDate(dateCell) ?? parseDate(get(row, "pickupTime")) ?? opts.fallbackDate ?? null;
    const time = parseTime(get(row, "pickupTime")) ?? (typeof dateCell === "string" || dateCell instanceof Date ? parseTime(dateCell) : null);
    // 날짜 셀이 Date 로 들어오고 시간이 00:00 이면 시간 정보가 없는 것으로 본다
    const pickupTime = time === "00:00" && mapping.pickupTime === undefined ? null : time;

    if (!serviceDate) warnings.push("이용일을 인식하지 못했습니다");
    if (!pickupTime) warnings.push("픽업시간을 인식하지 못했습니다");

    let pax = paxOf(get(row, "pax"));
    if (pax == null) {
      const parts = [paxOf(get(row, "adult")), paxOf(get(row, "child")), paxOf(get(row, "infant"))];
      if (parts.some((p) => p != null)) pax = parts.reduce<number>((s, p) => s + (p ?? 0), 0);
    }
    if (pax == null || pax <= 0) {
      warnings.push("인원을 인식하지 못해 1명으로 처리했습니다");
      pax = 1;
    }

    const productName = str(get(row, "productName"));
    let durationMin = num(get(row, "durationMin"));
    if (durationMin != null && durationMin <= 24) durationMin = Math.round(durationMin * 60); // 시간 단위로 적힌 경우
    const endTime = parseTime(get(row, "endTime"));
    if (durationMin == null && endTime && pickupTime) {
      let d = toMinutes(endTime) - toMinutes(pickupTime);
      if (d <= 0) d += 24 * 60;
      durationMin = d;
    }
    durationMin ??= durationFromText(productName);

    const raw: Record<string, string> = {};
    headers.forEach((h, i) => {
      const v = str(row[i]);
      if (h && v != null) raw[h] = v;
    });

    out.push({
      rowIndex: r + 1,
      bookingNo: str(get(row, "bookingNo")),
      productName,
      customerName: str(get(row, "customerName")),
      customerPhone: str(get(row, "customerPhone")),
      pax,
      serviceDate,
      pickupAt: serviceDate && pickupTime ? `${serviceDate}T${pickupTime}:00+09:00` : null,
      durationMin,
      pickupAddress: str(get(row, "pickupAddress")),
      dropoffAddress: str(get(row, "dropoffAddress")),
      flightNo: str(get(row, "flightNo")),
      memo: str(get(row, "memo")),
      fare: num(get(row, "fare")),
      pickupLat: num(get(row, "pickupLat")),
      pickupLng: num(get(row, "pickupLng")),
      dropoffLat: num(get(row, "dropoffLat")),
      dropoffLng: num(get(row, "dropoffLng")),
      raw,
      warnings,
    });
  }
  return out;
}
