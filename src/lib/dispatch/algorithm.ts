import { estimateTravel, type LatLng, type TravelOptions } from "./geo";

export type DispatchBooking = {
  id: string;
  /** 픽업 시각 (epoch ms). null 이면 배차 불가 처리 */
  pickupAt: number | null;
  /** 운행 소요 시간 (분). null 이면 기본값 사용 */
  durationMin: number | null;
  pickup: LatLng | null;
  dropoff: LatLng | null;
  pax: number;
  /** 예약한 차급의 최소 좌석 수 (예: 7인승 예약이면 7) */
  minSeats?: number | null;
  /** 필요한 차량 등급 (예: 컴포트). null 이면 아무 차량 */
  grade?: string | null;
  /** 픽업 장소 도착 후 최대 대기 시간 (분). 차량은 이 시간까지 묶여 있다고 본다 */
  waitMin?: number | null;
};

export type DispatchVehicle = {
  id: string;
  seats: number;
  /** 차고지(출발 위치). 없으면 첫 콜은 이동시간 제약 없음 */
  base: LatLng | null;
  /** 차량 등급 (예: 컴포트). null 이면 기본 등급 */
  grade?: string | null;
};

/** 차량이 예약 조건(인원, 차급 좌석 수, 등급)을 만족하는지 */
export function canServe(v: DispatchVehicle, b: DispatchBooking): boolean {
  if (v.seats < Math.max(b.pax, b.minSeats ?? 0)) return false;
  if (b.grade && (v.grade ?? "").replace(/\s/g, "") !== b.grade.replace(/\s/g, "")) return false;
  return true;
}

export type DispatchOptions = TravelOptions & {
  /** 차량당 최대 콜 수 */
  maxCallsPerVehicle: number;
  /** 콜 사이 최소 여유 시간 (분) */
  bufferMin: number;
  /** 소요 시간이 없을 때 기본 운행 시간 (분) */
  defaultDurationMin: number;
  /** 대기시간 가중치 (공차 이동 1분 대비) */
  idleWeight: number;
  /** 빈 좌석 1석당 비용 (분). 큰 차는 단체 예약에 남겨두기 위함 */
  seatWasteWeight: number;
  /** 여러 순서를 시도하는 데 쓸 최대 계산 시간 (ms). 기본 순서 3가지는 항상 계산 */
  timeBudgetMs: number;
};

export const DEFAULT_OPTIONS: DispatchOptions = {
  maxCallsPerVehicle: 4,
  bufferMin: 15,
  defaultDurationMin: 90,
  avgSpeedKmh: 40,
  roadFactor: 1.3,
  unknownTravelMin: 60,
  idleWeight: 0.05,
  seatWasteWeight: 1,
  timeBudgetMs: 5000,
};

export type UnassignedReason =
  | "MISSING_TIME"
  | "PAX_EXCEEDS_SEATS"
  | "ALL_VEHICLES_FULL"
  | "TIME_CONFLICT";

export const UNASSIGNED_REASON_LABEL: Record<UnassignedReason, string> = {
  MISSING_TIME: "픽업 시간 없음",
  PAX_EXCEEDS_SEATS: "맞는 차량 없음 (인원·차급)",
  ALL_VEHICLES_FULL: "모든 차량 콜 수 초과",
  TIME_CONFLICT: "시간 겹침 또는 이동시간 부족",
};

export type Stop = {
  bookingId: string;
  seq: number;
  /** 이전 위치 → 픽업지 공차 이동 */
  deadheadKm: number | null;
  deadheadMin: number;
  /** 픽업지 도착 가능 시각 (epoch ms) */
  readyAt: number;
  pickupAt: number;
  endAt: number;
};

export type VehicleRoute = { vehicleId: string; stops: Stop[] };

export type Unassigned = {
  bookingId: string;
  reason: UnassignedReason;
};

export type DispatchResult = {
  routes: VehicleRoute[];
  unassigned: Unassigned[];
  summary: {
    totalBookings: number;
    assigned: number;
    unassigned: number;
    vehiclesUsed: number;
    totalDeadheadKm: number;
    byReason: Partial<Record<UnassignedReason, number>>;
    /** 배차 불가 건을 모두 소화하려면 추가로 필요한 최소 차량 수 (추정) */
    extraVehiclesNeeded: number;
  };
};

type Timed = DispatchBooking & { pickupAt: number };

const MIN = 60_000;

/** 운행 종료 시각 = 도착시각 + 최대 대기 + 운행시간(없으면 픽업→하차 이동시간, 그것도 모르면 기본값) */
function endOf(b: Timed, opts: DispatchOptions): number {
  let trip = b.durationMin;
  if (trip == null) trip = b.pickup && b.dropoff ? estimateTravel(b.pickup, b.dropoff, opts).min : opts.defaultDurationMin;
  return b.pickupAt + ((b.waitMin ?? 0) + trip) * MIN;
}

/**
 * 차량 경로(시간순 예약 목록)가 실행 가능한지 확인하고 각 정류 정보를 계산한다.
 * 불가능하면 null.
 */
export function simulateRoute(
  vehicle: DispatchVehicle,
  bookings: Timed[],
  opts: DispatchOptions,
): Stop[] | null {
  if (bookings.length > opts.maxCallsPerVehicle) return null;
  const stops: Stop[] = [];
  let loc: LatLng | null = vehicle.base;
  let freeAt = -Infinity;
  for (const [i, b] of bookings.entries()) {
    if (!canServe(vehicle, b)) return null;
    const isFirst = i === 0;
    // 첫 콜에 차고지가 없으면 이동 제약을 두지 않는다.
    const travel =
      isFirst && !loc
        ? { km: null, min: 0 }
        : estimateTravel(loc, b.pickup, opts);
    const readyAt = isFirst
      ? b.pickupAt - travel.min * MIN // 첫 콜은 제시간에 출발한다고 가정
      : freeAt + (opts.bufferMin + travel.min) * MIN;
    if (readyAt > b.pickupAt) return null;
    const endAt = endOf(b, opts);
    stops.push({
      bookingId: b.id,
      seq: i + 1,
      deadheadKm: travel.km,
      deadheadMin: travel.min,
      readyAt,
      pickupAt: b.pickupAt,
      endAt,
    });
    loc = b.dropoff ?? b.pickup;
    freeAt = endAt;
  }
  return stops;
}

function insertSorted(list: Timed[], b: Timed): Timed[] {
  const out = [...list, b];
  out.sort((x, y) => x.pickupAt - y.pickupAt);
  return out;
}

function routeCost(stops: Stop[], opts: DispatchOptions): number {
  let cost = 0;
  for (const [i, s] of stops.entries()) {
    cost += s.deadheadMin;
    if (i > 0) cost += ((s.pickupAt - s.readyAt) / MIN) * opts.idleWeight;
  }
  return cost;
}

type State = {
  vehicle: DispatchVehicle;
  bookings: Timed[];
  stops: Stop[];
  cost: number;
};

/** 비용 증가가 가장 작은 차량에 예약을 넣는다. 성공 여부 반환. */
function bestInsertion(
  states: State[],
  b: Timed,
  opts: DispatchOptions,
  exclude?: State,
): { state: State; bookings: Timed[]; stops: Stop[]; delta: number } | null {
  let best: { state: State; bookings: Timed[]; stops: Stop[]; delta: number } | null = null;
  for (const st of states) {
    if (st === exclude) continue;
    if (st.bookings.length >= opts.maxCallsPerVehicle) continue;
    const bookings = insertSorted(st.bookings, b);
    const stops = simulateRoute(st.vehicle, bookings, opts);
    if (!stops) continue;
    const cost = routeCost(stops, opts);
    // 이미 운행 중인 차량을 약간 우선해서 동선을 묶는다.
    const openPenalty = st.bookings.length === 0 ? 5 : 0;
    const seatWaste = (st.vehicle.seats - Math.max(b.pax, b.minSeats ?? 0)) * opts.seatWasteWeight;
    const delta = cost - st.cost + openPenalty + seatWaste;
    if (!best || delta < best.delta) best = { state: st, bookings, stops, delta };
  }
  return best;
}

function apply(ins: { state: State; bookings: Timed[]; stops: Stop[] }, opts: DispatchOptions) {
  ins.state.bookings = ins.bookings;
  ins.state.stops = ins.stops;
  ins.state.cost = routeCost(ins.stops, opts);
}

/**
 * 연쇄 이동: 차량 st 에서 예약(victim) 하나를 빼고 u 를 넣은 뒤, victim 을 다른 차량에 넣는다.
 * victim 이 바로 들어갈 곳이 없으면 depth 만큼 같은 방식으로 한 단계 더 밀어낸다.
 * 실패하면 상태를 원래대로 되돌린다.
 */
function tryRelocate(states: State[], u: Timed, opts: DispatchOptions, depth: number, locked: Set<string>): boolean {
  if (depth <= 0) return false;
  for (const st of states) {
    if (!canServe(st.vehicle, u)) continue;
    for (const victim of st.bookings) {
      if (locked.has(victim.id)) continue;
      const withU = insertSorted(st.bookings.filter((x) => x !== victim), u);
      const stops = simulateRoute(st.vehicle, withU, opts);
      if (!stops) continue;
      const saved = { bookings: st.bookings, stops: st.stops, cost: st.cost };
      st.bookings = withU;
      st.stops = stops;
      st.cost = routeCost(stops, opts);
      const moved = bestInsertion(states, victim, opts, st);
      if (moved) {
        apply(moved, opts);
        return true;
      }
      locked.add(u.id);
      if (tryRelocate(states, victim, opts, depth - 1, locked)) return true;
      locked.delete(u.id);
      Object.assign(st, saved);
    }
  }
  return false;
}

function classify(states: State[], u: Timed, opts: DispatchOptions): UnassignedReason {
  const fits = states.filter((s) => canServe(s.vehicle, u));
  if (fits.length === 0) return "PAX_EXCEEDS_SEATS";
  if (fits.every((s) => s.bookings.length >= opts.maxCallsPerVehicle)) return "ALL_VEHICLES_FULL";
  return "TIME_CONFLICT";
}

/** 주어진 순서대로 한 번 배정하고 보정까지 수행 */
function solveOnce(order: Timed[], vehicles: DispatchVehicle[], opts: DispatchOptions) {
  const states: State[] = vehicles.map((v) => ({ vehicle: v, bookings: [], stops: [], cost: 0 }));
  const pending: Timed[] = [];
  for (const b of order) {
    const ins = bestInsertion(states, b, opts);
    if (ins) apply(ins, opts);
    else pending.push(b);
  }
  const rest: Timed[] = [];
  for (const u of pending) {
    const ins = bestInsertion(states, u, opts);
    if (ins) apply(ins, opts);
    else if (!tryRelocate(states, u, opts, 2, new Set())) rest.push(u);
  }
  const cost = states.reduce((n, s) => n + s.cost, 0);
  return { states, rest, cost };
}

/** 재현 가능한 난수 (같은 입력이면 같은 결과) */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 여러 배정 순서를 시도할 횟수 (랜덤 변형 포함) */
const RANDOM_TRIALS = 40;

export function dispatch(
  bookings: DispatchBooking[],
  vehicles: DispatchVehicle[],
  partial: Partial<DispatchOptions> = {},
): DispatchResult {
  const opts = { ...DEFAULT_OPTIONS, ...partial };
  const unassigned: Unassigned[] = [];

  const timed: Timed[] = [];
  for (const b of bookings) {
    if (b.pickupAt == null || Number.isNaN(b.pickupAt)) {
      unassigned.push({ bookingId: b.id, reason: "MISSING_TIME" });
    } else {
      timed.push(b as Timed);
    }
  }

  // 경로는 항상 시간순으로 재구성되므로 처리 순서와 무관하게 동선은 유효하다.
  // 여러 순서로 풀어보고 가장 많이 배차된 결과(동률이면 공차 이동이 적은 결과)를 고른다.
  const fitCount = new Map(timed.map((b) => [b.id, vehicles.filter((v) => canServe(v, b)).length]));
  const dur = (b: Timed) => b.durationMin ?? opts.defaultDurationMin;
  const byTime = [...timed].sort((a, b) => a.pickupAt - b.pickupAt || b.pax - a.pax);
  const orders: Timed[][] = [
    byTime,
    [...timed].sort((a, b) => fitCount.get(a.id)! - fitCount.get(b.id)! || a.pickupAt - b.pickupAt),
    [...timed].sort((a, b) => dur(b) - dur(a) || a.pickupAt - b.pickupAt),
  ];
  const rand = mulberry32(timed.length * 7919 + vehicles.length);
  for (let t = 0; t < RANDOM_TRIALS && timed.length > 1; t++) {
    // 시간순을 기본으로 약간씩 흔든다
    const jitter = new Map(timed.map((b) => [b.id, b.pickupAt + (rand() - 0.5) * 6 * 3_600_000]));
    orders.push([...timed].sort((a, b) => jitter.get(a.id)! - jitter.get(b.id)!));
  }

  const deadline = Date.now() + opts.timeBudgetMs;
  let best = solveOnce(orders[0], vehicles, opts);
  for (const [i, order] of orders.entries()) {
    if (i === 0) continue;
    if (i >= 3 && Date.now() > deadline) break;
    const r = solveOnce(order, vehicles, opts);
    if (r.rest.length < best.rest.length || (r.rest.length === best.rest.length && r.cost < best.cost - 1e-9)) best = r;
  }

  const { states, rest } = best;
  for (const u of rest) unassigned.push({ bookingId: u.id, reason: classify(states, u, opts) });

  const routes = states.map((s) => ({ vehicleId: s.vehicle.id, stops: s.stops }));
  const byReason: Partial<Record<UnassignedReason, number>> = {};
  for (const u of unassigned) byReason[u.reason] = (byReason[u.reason] ?? 0) + 1;
  const assigned = routes.reduce((n, r) => n + r.stops.length, 0);

  return {
    routes,
    unassigned,
    summary: {
      totalBookings: bookings.length,
      assigned,
      unassigned: unassigned.length,
      vehiclesUsed: routes.filter((r) => r.stops.length > 0).length,
      totalDeadheadKm: Math.round(
        routes.reduce((n, r) => n + r.stops.reduce((m, s) => m + (s.deadheadKm ?? 0), 0), 0),
      ),
      byReason,
      extraVehiclesNeeded: estimateExtraVehicles(rest, states, opts),
    },
  };
}

/**
 * 남은 건을 소화하려면 몇 대가 더 필요한지 추정한다.
 * 추가 차량은 남은 건을 모두 태울 수 있는 크기·등급(상위 등급은 하위 예약도 가능)으로 가정한다.
 */
function estimateExtraVehicles(rest: Timed[], states: State[], opts: DispatchOptions): number {
  if (rest.length === 0) return 0;
  const seats = Math.max(0, ...states.map((s) => s.vehicle.seats), ...rest.map((u) => Math.max(u.pax, u.minSeats ?? 0)));
  const grades = [...new Set(rest.map((u) => u.grade).filter((g): g is string => !!g))];
  // 등급이 여러 개면 등급별로 따로 센다 (한 차량이 여러 상위 등급을 겸하지 않음)
  let total = 0;
  for (const grade of grades.length ? grades : [null]) {
    const group = rest.filter((u) => (grades.length ? (u.grade ?? grades[0]) === grade : true));
    const extra: State[] = [];
    for (const u of [...group].sort((a, b) => a.pickupAt - b.pickupAt)) {
      let ins = bestInsertion(extra, u, opts);
      if (!ins) {
        const st: State = { vehicle: { id: `extra-${extra.length}`, seats, base: null, grade }, bookings: [], stops: [], cost: 0 };
        extra.push(st);
        ins = bestInsertion([st], u, opts);
      }
      if (ins) apply(ins, opts);
    }
    total += extra.length;
  }
  return total;
}
