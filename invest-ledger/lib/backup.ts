import "server-only";
import writeXlsxFile from "write-excel-file/node";
import { methodLabel, statusInfo } from "@/lib/constants";
import { dateTime, won } from "@/lib/format";
import { roleLabel } from "@/lib/permissions";
import { fetchAll, listAllCustomers, listAllInvestments } from "@/lib/queries";
import { SCHEDULE_STATES } from "@/lib/scheduleState";
import { db } from "@/lib/supabase";

type Cell = { value?: string | number | null; type?: StringConstructor | NumberConstructor; format?: string; fontWeight?: "bold" };
type Col = { title: string; width: number; money?: boolean; pct?: boolean };

const MONEY = "#,##0";
const EXCEL_TEXT_LIMIT = 32000; // 엑셀 한 칸 글자 수 한도(32,767) 아래로

function sheet(name: string, cols: Col[], rows: (string | number | null | undefined)[][]) {
  const header: Cell[] = cols.map((c) => ({ value: c.title, fontWeight: "bold" }));
  const body: Cell[][] = rows.map((r) =>
    r.map((v, i) => {
      if (v === null || v === undefined || v === "") return { value: null };
      if (typeof v === "number") return { value: v, type: Number, format: cols[i]?.money ? MONEY : cols[i]?.pct ? "0.00" : undefined };
      const s = String(v);
      return { value: s.length > EXCEL_TEXT_LIMIT ? `${s.slice(0, EXCEL_TEXT_LIMIT)}…(잘림)` : s, type: String };
    }),
  );
  return { data: [header, ...body], sheet: name, columns: cols.map((c) => ({ width: c.width })), stickyRowsCount: 1 };
}

const TABLE_LABELS: Record<string, string> = {
  investments: "투자", customers: "고객", repayment_schedules: "회수계획", repayments: "입금", profiles: "사용자",
};

/** 장부 전체를 엑셀 파일(여러 시트)로 만든다 */
export async function buildBackupXlsx(): Promise<Buffer> {
  const supabase = db();
  const [investments, customers, schedules, repayments, audits, profiles] = await Promise.all([
    listAllInvestments(),
    listAllCustomers(),
    fetchAll<Record<string, unknown>>((a, b) => supabase.from("v_schedule_status").select("*").order("id").range(a, b), "회수계획 조회"),
    fetchAll<Record<string, unknown>>((a, b) => supabase.from("repayments").select("*").order("id").range(a, b), "입금 조회"),
    fetchAll<Record<string, unknown>>((a, b) => supabase.from("audit_logs").select("*").order("id").range(a, b), "변경 이력 조회"),
    fetchAll<Record<string, unknown>>(
      (a, b) => supabase.from("profiles").select("id, email, display_name, role, is_active, last_login_at, created_at").order("created_at").range(a, b),
      "사용자 조회",
    ),
  ]);

  const invNo = new Map(investments.map((r) => [r.id, r.investment_no]));
  const seqById = new Map(schedules.map((s) => [String(s.id), Number(s.seq)]));
  const userName = new Map(profiles.map((p) => [String(p.id), String(p.display_name || p.email)]));
  const who = (id: unknown) => (id ? userName.get(String(id)) ?? String(id) : "");

  const sheets = [
    sheet(
      "투자",
      [
        { title: "투자번호", width: 12 }, { title: "고객명", width: 12 }, { title: "연락처", width: 15 }, { title: "투자 대상명", width: 20 },
        { title: "투자 실행일", width: 12 }, { title: "투자 실행금액", width: 16, money: true }, { title: "수익률(%)", width: 10, pct: true },
        { title: "총 회수 예정금액", width: 16, money: true }, { title: "회수금액", width: 16, money: true }, { title: "미회수금액", width: 16, money: true },
        { title: "회수율(%)", width: 10, pct: true }, { title: "연체금액", width: 14, money: true }, { title: "회수방식", width: 12 },
        { title: "회수기간(일)", width: 11 }, { title: "회수 시작일", width: 12 }, { title: "회수 만기일", width: 12 },
        { title: "상태", width: 8 }, { title: "상태 사유", width: 20 }, { title: "메모", width: 30 }, { title: "등록일시", width: 17 },
      ],
      investments.map((r) => [
        r.investment_no, r.customer_name, r.customer_phone, r.target_name, r.executed_on, r.principal, Number(r.return_rate),
        r.expected_total, r.collected_amount, r.remaining_amount, r.recovery_rate, r.overdue_amount, methodLabel(r.repayment_method),
        r.period_days, r.start_on, r.maturity_on, statusInfo(r.status).label, r.status_reason, r.memo, dateTime(r.created_at),
      ]),
    ),
    sheet(
      "고객",
      [{ title: "고객명", width: 12 }, { title: "연락처", width: 15 }, { title: "메모", width: 30 }, { title: "상태", width: 8 }, { title: "등록일시", width: 17 }],
      customers.map((c) => [c.name, c.phone, c.memo, c.status === "active" ? "사용" : "미사용", dateTime(c.created_at)]),
    ),
    sheet(
      "회수계획",
      [
        { title: "투자번호", width: 12 }, { title: "회차", width: 6 }, { title: "예정 회수일", width: 12 }, { title: "예정 회수금액", width: 15, money: true },
        { title: "실제 회수금액", width: 15, money: true }, { title: "최근 입금일", width: 12 }, { title: "미회수금액", width: 15, money: true },
        { title: "상태", width: 10 }, { title: "메모", width: 30 },
      ],
      schedules
        .map((row) => ({ s: row, no: invNo.get(String(row.investment_id)) ?? "" }))
        .sort((a, b) => a.no.localeCompare(b.no) || Number(a.s.seq) - Number(b.s.seq))
        .map(({ s, no }) => [
          no, Number(s.seq), String(s.due_date), Number(s.planned_amount), Number(s.paid_amount), (s.last_paid_on as string | null) ?? "",
          Number(s.unpaid_amount), SCHEDULE_STATES[s.state as keyof typeof SCHEDULE_STATES]?.label ?? String(s.state), String(s.memo ?? ""),
        ]),
    ),
    sheet(
      "실제회수내역",
      [
        { title: "투자번호", width: 12 }, { title: "회차", width: 6 }, { title: "입금일", width: 12 }, { title: "입금액", width: 15, money: true },
        { title: "상태", width: 8 }, { title: "취소 사유", width: 20 }, { title: "메모", width: 25 }, { title: "기록한 사람", width: 12 }, { title: "기록일시", width: 17 },
      ],
      repayments
        .map((row) => ({ r: row, no: invNo.get(String(row.investment_id)) ?? "" }))
        .sort((a, b) => a.no.localeCompare(b.no) || String(a.r.paid_on).localeCompare(String(b.r.paid_on)))
        .map(({ r, no }) => [
          no, r.schedule_id ? seqById.get(String(r.schedule_id)) ?? "" : "", String(r.paid_on), Number(r.amount),
          r.status === "valid" ? "유효" : "취소", String(r.void_reason ?? ""), String(r.memo ?? ""), who(r.created_by), dateTime(String(r.created_at)),
        ]),
    ),
    sheet(
      "변경이력",
      [
        { title: "일시", width: 17 }, { title: "사람", width: 12 }, { title: "대상", width: 10 }, { title: "작업", width: 8 },
        { title: "대상 ID", width: 38 }, { title: "변경 전", width: 60 }, { title: "변경 후", width: 60 },
      ],
      audits
        .sort((a, b) => Number(b.id) - Number(a.id))
        .map((l) => [
          dateTime(String(l.created_at)), who(l.actor) || "시스템", TABLE_LABELS[String(l.table_name)] ?? String(l.table_name),
          l.action === "insert" ? "등록" : l.action === "update" ? "수정" : String(l.action), String(l.row_id ?? ""),
          l.old_data ? JSON.stringify(l.old_data) : "", l.new_data ? JSON.stringify(l.new_data) : "",
        ]),
    ),
    sheet(
      "사용자",
      [{ title: "이름", width: 12 }, { title: "이메일", width: 24 }, { title: "권한", width: 10 }, { title: "사용", width: 8 }, { title: "마지막 로그인", width: 17 }],
      profiles.map((p) => [String(p.display_name), String(p.email), roleLabel(String(p.role)), p.is_active ? "사용" : "중지", dateTime(p.last_login_at as string | null)]),
    ),
  ];

  // 합계 요약 (파일을 열었을 때 맨 앞에서 바로 확인)
  const live = investments.filter((r) => r.status !== "cancelled");
  const sum = (f: (r: (typeof live)[number]) => number) => live.reduce((a, r) => a + f(r), 0);
  const summary = sheet(
    "요약",
    [{ title: "항목", width: 22 }, { title: "값", width: 22 }],
    [
      ["백업 일시", dateTime(new Date().toISOString())],
      ["투자 건수 (취소 제외)", live.length],
      ["총 투자 실행금액", won(sum((r) => r.principal))],
      ["총 회수 예정금액", won(sum((r) => r.expected_total))],
      ["총 회수금액", won(sum((r) => r.collected_amount))],
      ["총 미회수금액", won(sum((r) => r.remaining_amount))],
      ["고객 수", customers.length],
      ["입금 기록 수", repayments.length],
      ["변경 이력 수", audits.length],
    ],
  );

  return writeXlsxFile([summary, ...sheets] as never).toBuffer();
}
