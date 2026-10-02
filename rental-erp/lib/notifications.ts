import "server-only";
import { q } from "@/lib/db";
import { daysBetween, fmtDate } from "@/lib/dates";
import type { Snapshot } from "@/lib/engine";
import { won } from "@/lib/format";
import type { NotificationKind } from "@/lib/constants";

// ---------------------------------------------------------------------------
// 알림 만들기: 대시보드 계산 결과(Snapshot)에서 알림 대상을 뽑아 notifications 표에 쌓는다.
// dedupe_key 로 같은 알림은 한 번만 생긴다 (예: 계약 만료 30일 전 알림은 계약당 1번).
// ---------------------------------------------------------------------------

type Draft = {
  kind: NotificationKind;
  severity: "critical" | "warning" | "caution" | "info";
  title: string;
  body: string;
  ref_type: string;
  ref_id: string;
  property_id: string | null;
  due_date: string | null;
  dedupe_key: string;
};

const unitName = (p: { name: string } | null, u: { unit_no: string } | null) => [p?.name, u?.unit_no].filter(Boolean).join(" ");

export function draftNotifications(s: Snapshot): Draft[] {
  const out: Draft[] = [];

  for (const d of s.today_.dueCharges) {
    out.push({
      kind: "rent_due",
      severity: "info",
      title: `오늘 월세 납부일: ${d.tenant?.name ?? ""} / ${unitName(d.property, d.unit)}`,
      body: `${won(d.unpaid)} 입금 예정`,
      ref_type: "charge",
      ref_id: d.charge.id,
      property_id: d.property?.id ?? null,
      due_date: d.charge.due_date,
      dedupe_key: `rent_due:${d.charge.id}`,
    });
  }

  for (const a of s.arrears) {
    // 미납 단계가 바뀔 때마다 1번 (1~30 / 31~60 / 61~90 / 90+)
    out.push({
      kind: "rent_overdue",
      severity: a.days > 90 ? "critical" : a.days > 30 ? "warning" : "caution",
      title: `월세 미납 ${a.days}일: ${a.tenant?.name ?? ""} / ${unitName(a.property, a.unit)}`,
      body: `총 미납액 ${won(a.total)} (${a.charges.length}개월)`,
      ref_type: "contract",
      ref_id: a.contract.id,
      property_id: a.property?.id ?? null,
      due_date: a.oldestDue,
      dedupe_key: `rent_overdue:${a.contract.id}:${a.oldestDue}:${a.bucket}`,
    });
  }

  const steps = [...s.settings.expiryAlertDays].sort((a, b) => a - b);
  for (const e of s.expiring) {
    const step = steps.find((d) => e.daysLeft <= d);
    if (step == null) continue;
    out.push({
      kind: "contract_expiry",
      severity: e.level === "red" ? "critical" : e.level === "orange" ? "warning" : "caution",
      title: `계약 만료 ${e.daysLeft}일 전: ${e.tenant?.name ?? ""} / ${unitName(e.property, e.unit)}`,
      body: `${fmtDate(e.contract.end_date)} 만료 (${step}일 전 알림)`,
      ref_type: "contract",
      ref_id: e.contract.id,
      property_id: e.property?.id ?? null,
      due_date: e.contract.end_date,
      dedupe_key: `contract_expiry:${e.contract.id}:${step}`,
    });
  }

  for (const d of s.depositsDue) {
    out.push({
      kind: "deposit_return",
      severity: d.daysLeft <= 7 ? "critical" : "warning",
      title: `보증금 반환 예정: ${d.tenant?.name ?? ""} / ${unitName(d.property, d.unit)}`,
      body: `${fmtDate(d.dueDate)} 반환 예정, ${won(d.outstanding)}`,
      ref_type: "contract",
      ref_id: d.contract.id,
      property_id: d.property?.id ?? null,
      due_date: d.dueDate,
      dedupe_key: `deposit_return:${d.contract.id}:${d.daysLeft <= 7 ? 7 : 60}`,
    });
  }

  for (const l of s.loansDue) {
    out.push({
      kind: "loan_maturity",
      severity: l.daysLeft <= 30 ? "critical" : "warning",
      title: `대출 만기 ${l.daysLeft < 0 ? "지남" : `${l.daysLeft}일 전`}: ${l.loan.lender} / ${l.property?.name ?? ""}`,
      body: `${fmtDate(l.loan.maturity_date)} 만기, 잔액 ${won(l.loan.balance)}`,
      ref_type: "loan",
      ref_id: l.loan.id,
      property_id: l.property?.id ?? null,
      due_date: l.loan.maturity_date,
      dedupe_key: `loan_maturity:${l.loan.id}:${l.daysLeft <= 30 ? 30 : 90}`,
    });
  }

  for (const u of s.units) {
    if (u.occupied || !u.vacancyStart) continue;
    out.push({
      kind: "vacancy",
      severity: u.vacancyDays > 60 ? "warning" : "caution",
      title: `공실: ${unitName(u.property, u.unit)}`,
      body: `공실 ${u.vacancyDays}일, 예상 손실 ${won(u.vacancyLoss)}`,
      ref_type: "unit",
      ref_id: u.unit.id,
      property_id: u.property.id,
      due_date: u.vacancyStart,
      dedupe_key: `vacancy:${u.unit.id}:${u.vacancyStart}`,
    });
  }

  return out;
}

/** 대출이자 납부일 알림 (3일 이내) */
export function draftLoanInterest(
  s: Snapshot,
  loans: { id: string; property_id: string; lender: string; balance: number; interest_rate: number; interest_day: number | null; is_closed: boolean }[],
): Draft[] {
  const out: Draft[] = [];
  const props = new Map(s.properties.map((p) => [p.property.id, p]));
  for (const l of loans) {
    if (l.is_closed || !l.interest_day || !props.has(l.property_id)) continue;
    const [y, m] = s.today.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const due = `${s.today.slice(0, 8)}${String(Math.min(l.interest_day, last)).padStart(2, "0")}`;
    const left = daysBetween(s.today, due);
    if (left < 0 || left > 3) continue;
    const p = props.get(l.property_id)!;
    const interest = p.monthlyInterest; // 부동산 기준
    out.push({
      kind: "loan_interest",
      severity: "info",
      title: `대출이자 납부 ${left === 0 ? "오늘" : `${left}일 전`}: ${l.lender} / ${p.property.name}`,
      body: `예상 이자 약 ${won(Math.round((l.balance * l.interest_rate) / 100 / 12))} (부동산 전체 월 이자 ${won(interest)})`,
      ref_type: "loan",
      ref_id: l.id,
      property_id: l.property_id,
      due_date: due,
      dedupe_key: `loan_interest:${l.id}:${due}`,
    });
  }
  return out;
}

export async function saveNotifications(drafts: Draft[]): Promise<number> {
  let created = 0;
  for (const d of drafts) {
    const r = await q<{ id: string }>(
      `insert into notifications (kind, severity, title, body, ref_type, ref_id, property_id, due_date, dedupe_key)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (dedupe_key) do nothing returning id`,
      [d.kind, d.severity, d.title, d.body, d.ref_type, d.ref_id, d.property_id, d.due_date, d.dedupe_key],
    );
    if (r.length) {
      created++;
      await enqueueDeliveries(r[0].id, d);
    }
  }
  return created;
}

// ---------------------------------------------------------------------------
// 외부 발송 (문자 / 카카오 알림톡 / 이메일 / 웹훅)
// 설정 화면의 '알림 받을 곳'에 연락처를 넣으면 발송 대기열(notification_deliveries)에 쌓인다.
// 실제 발송 업체 연동은 아래 Provider 를 구현해서 PROVIDERS 에 넣으면 된다.
// 지금은 웹훅(URL 로 JSON 전송)만 바로 동작하고, 나머지는 '대기' 상태로 기록만 남긴다.
// ---------------------------------------------------------------------------

export type Channel = "sms" | "kakao" | "email" | "webhook";
export type NotifyTarget = { channel: Channel; recipient: string; kinds: NotificationKind[] };

export interface Provider {
  send(recipient: string, n: { title: string; body: string; kind: string }): Promise<void>;
}

const PROVIDERS: Partial<Record<Channel, Provider>> = {
  webhook: {
    async send(url, n) {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(n) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    },
  },
  // sms: { send: ... 알리고 / NHN Cloud / 솔라피 등 },
  // kakao: { send: ... 카카오 비즈메시지 알림톡 },
  // email: { send: ... Resend / SES 등 },
};

async function targets(): Promise<NotifyTarget[]> {
  const rows = await q<{ value: NotifyTarget[] }>("select value from settings where key = 'notify_targets'");
  return Array.isArray(rows[0]?.value) ? rows[0].value : [];
}

async function enqueueDeliveries(notificationId: string, d: Draft) {
  for (const t of await targets()) {
    if (t.kinds.length && !t.kinds.includes(d.kind)) continue;
    const provider = PROVIDERS[t.channel];
    let status = "pending";
    let error: string | null = null;
    if (provider) {
      try {
        await provider.send(t.recipient, { title: d.title, body: d.body, kind: d.kind });
        status = "sent";
      } catch (e) {
        status = "failed";
        error = e instanceof Error ? e.message : String(e);
      }
    }
    await q(
      `insert into notification_deliveries (notification_id, channel, recipient, status, error, sent_at)
       values ($1,$2,$3,$4,$5, case when $4 = 'sent' then now() end)`,
      [notificationId, t.channel, t.recipient, status, error],
    );
  }
}
