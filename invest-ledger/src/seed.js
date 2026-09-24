// 샘플 데이터: 오늘 날짜 기준으로 상대 날짜를 만들어, 언제 실행해도 각 상태가 재현되게 한다.
// 사용: npm run seed  (기존 투자 데이터를 지우고 새로 넣음. 사용자 계정은 유지)
import { openDb, tx } from "./db.js";
import { createInvestment, addPayment } from "./repo.js";
import { addDays, addMonths, todayKST } from "./dates.js";

export function seed(db, today = todayKST()) {
  const d = (n) => addDays(today, n);
  const U = "sample";

  const make = (o) =>
    createInvestment(
      db,
      { rate: "20", method: "equal_total", cycleValue: 1, cycleUnit: "day", termUnit: "day", category: "일수", ...o },
      U,
    );

  // 예정일까지 도래한 회차를 예정일자로 입금. override: { seq: 금액 } (0 이면 미입금)
  const payUntil = (id, until, override = {}) => {
    const rows = db.prepare("SELECT seq, due_date, amount FROM schedules WHERE investment_id = ? ORDER BY seq").all(id);
    for (const r of rows) {
      if (r.due_date > until) break;
      const amt = r.seq in override ? override[r.seq] : r.amount;
      if (amt > 0) addPayment(db, id, { amount: amt, paidDate: r.due_date, seq: r.seq }, U);
    }
  };

  return tx(db, () => {
    for (const t of ["audit_log", "payments", "schedules", "investments", "customers", "companies"]) db.exec(`DELETE FROM ${t}`);
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('audit_log','payments','schedules','investments','customers','companies')");

    const yesterday = d(-1);

    // 1) 100일 일일상환 — 3회차 일부입금(80,000), 4회차 미입금 → 연체
    let id = make({ customerName: "홍길동", customerPhone: "010-1111-2222", companyName: "ABC투자", manager: "이과장", contact: "02-555-0101", execDate: d(-23), principal: 10000000, termValue: 100, memo: "샘플: 100일 매일 상환, 일부입금/미입금 사례" });
    payUntil(id, yesterday, { 3: 80000, 4: 0 });

    // 2) 60일 일일상환 — 매일 정상 입금 (오늘분은 아직)
    id = make({ customerName: "김철수", customerPhone: "010-2222-3333", companyName: "A투자", manager: "박대리", execDate: d(-30), principal: 5000000, rate: "15", termValue: 60, memo: "샘플: 60일 매일 정상" });
    payUntil(id, yesterday);

    // 3) 120일 10일마다 — 오늘 회차 예정
    id = make({ customerName: "이영희", customerPhone: "010-3333-4444", companyName: "B투자", manager: "최팀장", execDate: d(-50), principal: 20000000, termValue: 120, cycleValue: 10, memo: "샘플: 120일 10일마다" });
    payUntil(id, yesterday);

    // 4) 6개월 매월 상환 — 실행 한 달 뒤부터 매월 회수
    const exec4 = addDays(addMonths(today, -5), 5);
    id = make({ customerName: "박민수", customerPhone: "010-4444-5555", companyName: "C투자", execDate: exec4, firstDueDate: addMonths(exec4, 1), principal: 5000000, termValue: 6, termUnit: "month", cycleUnit: "month", category: "월상환", memo: "샘플: 6개월 매월 상환 (실행 1개월 후 첫 회수)" });
    payUntil(id, yesterday);

    // 4-1) 60일 매일 — 만료 임박 (D-9)
    id = make({ customerName: "김태희", customerPhone: "010-1212-3434", companyName: "D투자", execDate: d(-50), principal: 6000000, rate: "15", termValue: 60, memo: "샘플: 만료 임박" });
    payUntil(id, yesterday);

    // 5) 12주 매주 상환 (주 단위) — 직전 회차 미입금 → 지연
    id = make({ customerName: "최지우", customerPhone: "010-5555-6666", companyName: "A투자", execDate: d(-35), principal: 8000000, rate: "18", termValue: 12, termUnit: "week", cycleUnit: "week", category: "주상환", memo: "샘플: 12주 매주 상환, 지연" });
    payUntil(id, d(-8));

    // 6) 30일 일일상환 — 만료 경과, 잔액 남음 → 연체
    id = make({ customerName: "정우성", customerPhone: "010-6666-7777", companyName: "D투자", execDate: d(-40), principal: 3000000, rate: "10", termValue: 30, memo: "샘플: 만료 경과 연체" });
    payUntil(id, d(-21));

    // 7) 60일 일일상환 — 완납
    id = make({ customerName: "한가인", customerPhone: "010-7777-8888", companyName: "ABC투자", execDate: d(-70), principal: 10000000, termValue: 60 });
    payUntil(id, yesterday);

    // 8) 8주, 2주마다 — 2회차 일부입금
    id = make({ customerName: "송중기", customerPhone: "010-8888-9999", companyName: "B투자", execDate: d(-20), principal: 6000000, rate: "12", termValue: 8, termUnit: "week", cycleValue: 2, cycleUnit: "week", category: "주상환", memo: "샘플: 8주 2주마다, 일부입금" });
    payUntil(id, yesterday, { 2: 1000000 });

    // 9) 180일 매월 수익 균등회수 (원금 만기)
    id = make({ customerName: "윤아", customerPhone: "010-9999-0000", companyName: "C투자", execDate: d(-100), principal: 30000000, rate: "24", termValue: 180, cycleUnit: "month", method: "equal_profit", category: "월이자", memo: "샘플: 수익 균등, 원금 만기" });
    payUntil(id, yesterday);

    // 10) 100일 만기 일시상환 (같은 고객 두 번째 투자)
    make({ customerName: "김철수", customerPhone: "010-2222-3333", companyName: "D투자", execDate: d(-60), principal: 15000000, rate: "10", termValue: 100, method: "bullet", category: "만기", memo: "샘플: 만기 일시상환" });

    // 11) 오늘 실행 — 120일 10일마다 원금 균등
    make({ customerName: "홍길동", customerPhone: "010-1111-2222", companyName: "A투자", execDate: today, principal: 12000000, rate: "20", termValue: 120, cycleValue: 10, method: "equal_principal", memo: "샘플: 오늘 실행, 원금 균등" });

    // 12) 60일 매일, 회차 미지정 일괄입금 사례
    id = make({ customerName: "이영희", customerPhone: "010-3333-4444", companyName: "ABC투자", execDate: d(-10), principal: 4000000, rate: "20", termValue: 60 });
    addPayment(db, id, { amount: 800000, paidDate: d(-5), memo: "일괄입금" }, U);
    addPayment(db, id, { amount: 400000, paidDate: yesterday, memo: "일괄입금" }, U);

    // 과거 완납 건 (월별 통계용)
    const past = [
      { m: -8, name: "강동원", co: "A투자", p: 20000000 },
      { m: -7, name: "김태희", co: "B투자", p: 15000000 },
      { m: -6, name: "홍길동", co: "C투자", p: 25000000 },
      { m: -5, name: "박민수", co: "ABC투자", p: 10000000 },
      { m: -4, name: "최지우", co: "D투자", p: 18000000 },
    ];
    for (const x of past) {
      const exec = addMonths(today, x.m);
      id = make({ customerName: x.name, companyName: x.co, execDate: exec, principal: x.p, termValue: 60, cycleValue: 7 });
      payUntil(id, yesterday);
    }
    // 과거 월상환 진행 중 (주의 단계)
    id = make({ customerName: "강동원", companyName: "B투자", execDate: addMonths(today, -3), principal: 12000000, rate: "18", termValue: 4, termUnit: "month", cycleUnit: "month", category: "월상환" });
    payUntil(id, yesterday);
  });
}

if (process.argv[1] === import.meta.filename) {
  const db = openDb();
  seed(db);
  const n = db.prepare("SELECT COUNT(*) AS n FROM investments").get().n;
  console.log(`샘플 데이터 ${n}건 생성 완료 (기준일 ${todayKST()})`);
}
