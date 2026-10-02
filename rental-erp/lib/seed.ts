import "server-only";
import type pg from "pg";
import { reallocateContract } from "@/lib/data";
import { q, q1 } from "@/lib/db";
import { addDays, addMonths, daysBetween, monthStart, parts } from "@/lib/dates";
import { monthlyInterest, planCharges } from "@/lib/engine";
import type { Contract } from "@/lib/types";

/**
 * 테스트용 가상 데이터 (오늘 날짜 기준으로 만들어서 언제 넣어도 상황이 그대로 재현됨)
 * - 부동산 5개 / 호실 12개 / 임차인 9명 / 소유주 2명(개인·법인)
 * - 정상 입금, 미납(1~30일, 31~60일, 90일 이상), 공실 2개, 계약 예정, 만료 예정(30·60·90일),
 *   중도 종료된 과거 계약, 대출 4건(만기 임박 포함), 12개월 비용
 */
export async function seedSampleData(c: pg.PoolClient, today: string, actorId: string | null) {
  const exists = await q1<{ n: number }>("select count(*)::int as n from properties", [], c);
  if ((exists?.n ?? 0) > 0) throw new Error("이미 부동산 데이터가 있어 샘플 데이터를 넣지 않았습니다.");

  const M = monthStart(today);
  const [, , todayDay] = parts(today);
  const historyFrom = addMonths(M, -11); // 최근 12개월 청구

  const id = async (sql: string, params: unknown[]) => (await q1<{ id: string }>(sql + " returning id", params, c))!.id;

  // 소유주 ----------------------------------------------------------------
  const 개인 = await id("insert into owners (name, owner_type, representative, phone) values ($1,'individual',$1,$2)", ["김대표", "010-1234-5678"]);
  const 법인 = await id(
    "insert into owners (name, owner_type, biz_no, representative, phone) values ($1,'corporation',$2,$3,$4)",
    ["(주)우정에셋", "123-81-45678", "김대표", "02-555-1234"],
  );

  // 부동산 ----------------------------------------------------------------
  const prop = (o: Record<string, unknown>) =>
    id(
      `insert into properties (owner_id, name, address, building_name, property_type, purchase_date, purchase_price, current_value,
        acquisition_cost, remodeling_cost, other_investment, memo) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [o.owner, o.name, o.address, o.building, o.type, o.date, o.price, o.value, o.acq ?? 0, o.remodel ?? 0, o.other ?? 0, o.memo ?? null],
    );
  const 강남 = await prop({ owner: 법인, name: "강남 OO빌딩", address: "서울 강남구 테헤란로 123", building: "OO빌딩", type: "office", date: "2022-03-15", price: 6_500_000_000, value: 7_200_000_000, acq: 310_000_000, remodel: 180_000_000 });
  const 분당 = await prop({ owner: 개인, name: "분당 정자 오피스텔", address: "경기 성남시 분당구 정자일로 95", building: "정자 파크뷰", type: "officetel", date: "2023-05-20", price: 320_000_000, value: 345_000_000, acq: 14_500_000 });
  const 마포 = await prop({ owner: 개인, name: "마포 연남동 다가구", address: "서울 마포구 연남로 45-7", building: "연남하우스", type: "house", date: "2019-08-01", price: 1_200_000_000, value: 1_650_000_000, acq: 52_000_000, remodel: 85_000_000 });
  const 성수 = await prop({ owner: 법인, name: "성수 물류창고", address: "서울 성동구 성수이로 77", building: "성수 로지스", type: "factory", date: "2021-11-10", price: 2_800_000_000, value: 3_300_000_000, acq: 128_000_000 });
  const 판교 = await prop({ owner: 법인, name: "판교 테크원 상가", address: "경기 성남시 분당구 판교역로 166", building: "테크원타워", type: "commercial", date: "2024-02-01", price: 1_500_000_000, value: 1_580_000_000, acq: 69_000_000, remodel: 40_000_000 });

  // 호실 ------------------------------------------------------------------
  const unit = (property: string, unit_no: string, floor: string | null, rent: number, deposit: number, area: number, vacant_since: string | null = null) =>
    id(
      "insert into units (property_id, unit_no, floor, expected_rent, expected_deposit, area_m2, vacant_since) values ($1,$2,$3,$4,$5,$6,$7)",
      [property, unit_no, floor, rent, deposit, area, vacant_since],
    );
  const u강남101 = await unit(강남, "101호", "1층", 8_000_000, 100_000_000, 132);
  const u강남302 = await unit(강남, "302호", "3층", 2_000_000, 50_000_000, 66);
  const u강남501 = await unit(강남, "501호", "5층", 3_500_000, 80_000_000, 99);
  await unit(강남, "502호", "5층", 3_000_000, 70_000_000, 82, addDays(today, -42));
  const u분당 = await unit(분당, "1205호", "12층", 950_000, 20_000_000, 33);
  const u마포1 = await unit(마포, "1층", "1층", 800_000, 30_000_000, 56);
  const u마포2 = await unit(마포, "2층", "2층", 700_000, 50_000_000, 56);
  const u마포3 = await unit(마포, "3층", "3층", 750_000, 30_000_000, 48);
  const u성수 = await unit(성수, "전체", null, 12_000_000, 200_000_000, 1650);
  const u판교103 = await unit(판교, "103호", "1층", 2_800_000, 30_000_000, 45);
  const u판교104 = await unit(판교, "104호", "1층", 2_600_000, 30_000_000, 42, addDays(today, -75));

  // 임차인 ----------------------------------------------------------------
  const tenant = (name: string, phone: string, biz: string | null = null, memo: string | null = null) =>
    id("insert into tenants (name, phone, biz_no, memo) values ($1,$2,$3,$4)", [name, phone, biz, memo]);
  const t카페 = await tenant("(주)카페온 이정훈", "010-2222-1010", "214-86-11223", "1층 카페");
  const t김철수 = await tenant("김철수", "010-3333-3020", "110-12-34567", "세무사 사무실");
  const t박영희 = await tenant("박영희 ((주)디자인랩)", "010-4444-5010", "220-81-98765");
  const t이민수 = await tenant("이민수", "010-5555-1205");
  const t정수진 = await tenant("정수진", "010-6666-0101", null, "독촉 2회 (문자)");
  const t최영호 = await tenant("최영호", "010-7777-0202");
  const t강동원 = await tenant("(주)스피드물류 강동원", "010-8888-7700", "105-87-55555");
  const t한지민 = await tenant("한지민 (네일하우스)", "010-9999-1030", "129-33-77788");
  const t윤서연 = await tenant("윤서연 (플라워샵)", "010-1212-1040", "129-44-12121");
  const t이전 = await tenant("오준호", "010-3434-0303", null, "마포 3층 이전 임차인");

  // 계약 ------------------------------------------------------------------
  let seq = 0;
  const contracts: Contract[] = [];
  const contract = async (o: {
    unit: string;
    tenant: string;
    start: string;
    end: string;
    deposit: number;
    rent: number;
    maint?: number;
    vat?: number;
    payDay: number;
    status?: string;
    terms?: string;
    landlord: string;
  }) => {
    seq++;
    const row = await q1<Contract>(
      `insert into contracts (contract_no, unit_id, tenant_id, landlord_name, contract_date, start_date, end_date, deposit, monthly_rent,
         maintenance_fee, vat_amount, pay_day, billing_from, status, special_terms)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning *`,
      [
        `RC-${parts(today)[0]}-${String(seq).padStart(3, "0")}`,
        o.unit,
        o.tenant,
        o.landlord,
        addDays(o.start, -14),
        o.start,
        o.end,
        o.deposit,
        o.rent,
        o.maint ?? 0,
        o.vat ?? 0,
        o.payDay,
        o.start > historyFrom ? null : historyFrom,
        o.status ?? "active",
        o.terms ?? null,
      ],
      c,
    );
    contracts.push(row!);
    await q(
      "insert into deposits (contract_id, amount, received_amount, received_date, return_due_date) values ($1,$2,$3,$4,$5)",
      [row!.id, o.deposit, o.status === "planned" ? 0 : o.deposit, o.status === "planned" ? null : o.start, o.end],
      c,
    );
    return row!;
  };

  const c카페 = await contract({ unit: u강남101, tenant: t카페, start: addMonths(M, -22), end: addDays(addMonths(M, 14), -1), deposit: 100_000_000, rent: 8_000_000, maint: 300_000, vat: 800_000, payDay: 10, landlord: "(주)우정에셋", terms: "인테리어 원상복구 의무 있음. 권리금 없음." });
  const c김철수 = await contract({ unit: u강남302, tenant: t김철수, start: addDays(addDays(today, 28), -730 + 1), end: addDays(today, 28), deposit: 50_000_000, rent: 2_000_000, maint: 150_000, payDay: 25, landlord: "(주)우정에셋" });
  await contract({ unit: u강남501, tenant: t박영희, start: addDays(addDays(today, 55), -730 + 1), end: addDays(today, 55), deposit: 80_000_000, rent: 3_500_000, maint: 200_000, vat: 350_000, payDay: 5, landlord: "(주)우정에셋" });
  await contract({ unit: u분당, tenant: t이민수, start: addMonths(M, -15), end: addDays(addMonths(M, 9), -1), deposit: 20_000_000, rent: 950_000, maint: 120_000, payDay: Math.min(todayDay, 28), landlord: "김대표" });
  const c정수진 = await contract({ unit: u마포1, tenant: t정수진, start: addMonths(M, -18), end: addDays(addMonths(M, 6), -1), deposit: 30_000_000, rent: 800_000, payDay: 15, landlord: "김대표" });
  await contract({ unit: u마포2, tenant: t최영호, start: addDays(addDays(today, 85), -730 + 1), end: addDays(today, 85), deposit: 50_000_000, rent: 700_000, payDay: 20, landlord: "김대표" });
  const c이전 = await contract({ unit: u마포3, tenant: t이전, start: addDays(today, -16 - 730 + 1), end: addDays(today, -16), deposit: 30_000_000, rent: 720_000, payDay: 1, status: "expired", landlord: "김대표" });
  const c스피드 = await contract({ unit: u성수, tenant: t강동원, start: addMonths(M, -34), end: addDays(addMonths(M, 26), -1), deposit: 200_000_000, rent: 12_000_000, vat: 1_200_000, payDay: 25, landlord: "(주)우정에셋", terms: "매년 3% 인상 (계약 3년차부터)" });
  const c한지민 = await contract({ unit: u판교103, tenant: t한지민, start: addMonths(M, -8), end: addDays(addMonths(M, 16), -1), deposit: 30_000_000, rent: 2_800_000, maint: 180_000, vat: 280_000, payDay: 10, landlord: "(주)우정에셋" });
  await contract({ unit: u판교104, tenant: t윤서연, start: addMonths(M, 1), end: addDays(addMonths(M, 25), -1), deposit: 30_000_000, rent: 2_600_000, vat: 260_000, maint: 170_000, payDay: 10, status: "planned", landlord: "(주)우정에셋" });

  // 이전 임차인 보증금은 반환 완료
  await q("update deposits set returned_amount = amount, returned_date = $2, status = 'returned' where contract_id = $1", [c이전.id, addDays(today, -15)], c);

  // 청구 + 입금 -------------------------------------------------------------
  // 미납 규칙: (계약, 이번 달부터 몇 달 전) → 입금 비율
  const rule = (ct: Contract, monthsAgo: number): number => {
    if (ct.id === c김철수.id && (monthsAgo === 1 || monthsAgo === 2)) return 0; // 31~60일 미납 2개월
    if (ct.id === c정수진.id && monthsAgo >= 1 && monthsAgo <= 4) return monthsAgo === 4 ? 0.5 : 0; // 90일 이상
    if (ct.id === c한지민.id && monthsAgo === 1) return 0.5; // 1~30일 일부 미납
    return 1;
  };
  const payMethod = (ct: Contract) => (ct.id === c스피드.id || ct.id === c카페.id ? "cms" : "transfer");

  for (const ct of contracts) {
    for (const pc of planCharges(ct, today)) {
      const row = await q1<{ id: string }>(
        `insert into rent_charges (contract_id, billing_month, due_date, rent_amount, maintenance_amount, vat_amount, amount)
         values ($1,$2,$3,$4,$5,$6,$7) returning id`,
        [ct.id, pc.billing_month, pc.due_date, pc.rent_amount, pc.maintenance_amount, pc.vat_amount, pc.amount],
        c,
      );
      if (pc.due_date >= today) continue; // 아직 납부일 전 (오늘 납부 예정 포함)
      const monthsAgo = Math.round(daysBetween(pc.billing_month, M) / 30.4);
      const ratio = rule(ct, monthsAgo);
      if (ratio <= 0) continue;
      const late = ct.id === c정수진.id ? 9 : (seq + monthsAgo) % 3; // 며칠 늦게 입금
      const paidDate = addDays(pc.due_date, late) < today ? addDays(pc.due_date, late) : pc.due_date;
      await q(
        "insert into payments (contract_id, charge_id, paid_date, amount, method, created_by) values ($1,$2,$3,$4,$5,$6)",
        [ct.id, row!.id, paidDate, Math.round(pc.amount * ratio), payMethod(ct), actorId],
        c,
      );
    }
  }

  // 대출 ------------------------------------------------------------------
  const loans: { id: string; property: string; balance: number; rate: number; day: number; principalPerMonth: number }[] = [];
  const loan = async (o: {
    property: string; lender: string; product: string; start: string; principal: number; balance: number; rate: number;
    rateType: string; repay: string; day: number; maturity: string; principalPerMonth?: number; monthly?: number;
  }) => {
    const lid = await id(
      `insert into loans (property_id, lender, product, start_date, principal, balance, interest_rate, rate_type, repayment_type,
         monthly_payment, interest_day, maturity_date) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [o.property, o.lender, o.product, o.start, o.principal, o.balance, o.rate, o.rateType, o.repay, o.monthly ?? null, o.day, o.maturity],
    );
    loans.push({ id: lid, property: o.property, balance: o.balance, rate: o.rate, day: o.day, principalPerMonth: o.principalPerMonth ?? 0 });
  };
  await loan({ property: 강남, lender: "KB국민은행", product: "기업 부동산담보대출", start: "2022-03-15", principal: 3_000_000_000, balance: 2_700_000_000, rate: 4.2, rateType: "variable", repay: "bullet", day: 15, maturity: "2027-03-15" });
  await loan({ property: 분당, lender: "신한은행", product: "주택담보대출", start: "2023-05-20", principal: 150_000_000, balance: 150_000_000 - 1_000_000 * Math.max(0, Math.round(daysBetween("2023-05-20", today) / 30.4)), rate: 3.9, rateType: "fixed", repay: "equal_principal", day: 20, maturity: "2038-05-20", principalPerMonth: 1_000_000 });
  await loan({ property: 성수, lender: "하나은행", product: "시설자금대출", start: "2021-11-10", principal: 1_600_000_000, balance: 1_600_000_000, rate: 4.8, rateType: "variable", repay: "bullet", day: 10, maturity: addDays(today, 80) });
  await loan({ property: 판교, lender: "우리은행", product: "상가담보대출", start: "2024-02-01", principal: 600_000_000, balance: 600_000_000, rate: 4.3, rateType: "fixed", repay: "bullet", day: 1, maturity: "2029-02-01" });

  // 최근 12개월 이자·원금 납부 기록 (이자는 비용으로도 기록)
  for (const l of loans) {
    for (let i = 12; i >= 1; i--) {
      const m = addMonths(M, -i);
      const d = addDays(m, Math.min(l.day, 28) - 1);
      // 그때 잔액 = 지금 잔액 + 그 이후 갚은 원금
      const bal = l.balance + l.principalPerMonth * i;
      const interest = monthlyInterest(bal, l.rate);
      const eid = await id(
        "insert into expenses (property_id, expense_date, category, amount, vendor, loan_id, memo) values ($1,$2,'loan_interest',$3,$4,$5,'대출이자 자동 기록')",
        [l.property, d, interest, null, l.id],
      );
      await q("insert into loan_transactions (loan_id, tx_date, tx_type, amount, expense_id) values ($1,$2,'interest',$3,$4)", [l.id, d, interest, eid], c);
      if (l.principalPerMonth) {
        await q("insert into loan_transactions (loan_id, tx_date, tx_type, amount, memo) values ($1,$2,'principal',$3,'월 원금상환')", [l.id, d, l.principalPerMonth], c);
      }
    }
  }
  // 강남 대출 중도상환 기록 (3억)
  await q(
    "insert into loan_transactions (loan_id, tx_date, tx_type, amount, memo) values ($1,$2,'principal',300000000,'중도상환')",
    [loans[0].id, addMonths(M, -5)],
    c,
  );
  await q("insert into loan_transactions (loan_id, tx_date, tx_type, new_rate, memo) values ($1,$2,'rate_change',4.2,'변동금리 조정 4.5% → 4.2%')", [loans[0].id, addMonths(M, -3)], c);

  // 운영 비용 (최근 12개월) ---------------------------------------------------
  const exp = (property: string, date: string, category: string, amount: number, vendor: string | null = null, memo: string | null = null) =>
    q("insert into expenses (property_id, expense_date, category, amount, vendor, memo) values ($1,$2,$3,$4,$5,$6)", [property, date, category, amount, vendor, memo], c);
  for (let i = 12; i >= 1; i--) {
    const m = addMonths(M, -i);
    const mm = parts(m)[1];
    await exp(강남, addDays(m, 24), "maintenance", 680_000, "OO빌딩관리", "공용관리비");
    await exp(강남, addDays(m, 19), "electricity", 240_000 + (mm >= 6 && mm <= 8 ? 160_000 : 0), "한국전력");
    await exp(강남, addDays(m, 27), "cleaning", 300_000, "클린서비스");
    await exp(마포, addDays(m, 19), "water", 85_000, "서울시 수도");
    await exp(마포, addDays(m, 27), "cleaning", 90_000);
    await exp(분당, addDays(m, 24), "maintenance", 120_000, "정자 파크뷰 관리사무소");
    await exp(판교, addDays(m, 24), "maintenance", 180_000, "테크원 관리단");
    await exp(성수, addDays(m, 19), "electricity", 95_000, "한국전력", "공용부");
    if (mm === 7) {
      await exp(강남, addDays(m, 30), "property_tax", 4_200_000, "강남구청", "재산세(건물분)");
      await exp(마포, addDays(m, 30), "property_tax", 820_000, "마포구청");
      await exp(분당, addDays(m, 30), "property_tax", 260_000, "성남시");
      await exp(성수, addDays(m, 30), "property_tax", 2_100_000, "성동구청");
      await exp(판교, addDays(m, 30), "property_tax", 980_000, "성남시");
    }
    if (mm === 9) {
      await exp(강남, addDays(m, 29), "property_tax", 5_100_000, "강남구청", "재산세(토지분)");
      await exp(마포, addDays(m, 29), "property_tax", 610_000, "마포구청");
      await exp(성수, addDays(m, 29), "property_tax", 2_900_000, "성동구청");
    }
    if (mm === 12) await exp(강남, addDays(m, 14), "comprehensive_tax", 3_800_000, "국세청", "종합부동산세");
    if (mm === 3) {
      await exp(강남, addDays(m, 5), "insurance", 1_850_000, "삼성화재", "화재보험 연납");
      await exp(성수, addDays(m, 5), "insurance", 2_400_000, "DB손해보험", "화재·배상책임");
    }
  }
  await exp(강남, addMonths(M, -2), "repair", 3_300_000, "OO설비", "502호 공실 도배·바닥 수리");
  await exp(마포, addDays(today, -10), "repair", 1_200_000, "연남인테리어", "3층 원상복구");
  await exp(성수, addMonths(M, -6), "repair", 4_500_000, "대한방수", "옥상 방수");
  await exp(판교, addMonths(M, -1), "brokerage", 2_808_000, "판교부동산", "104호 임대 중개수수료");
  await exp(분당, addMonths(M, -4), "legal", 330_000, "OO법무사", "전입 확인");

  // 공통 세무 비용 (법인)
  await q("insert into expenses (owner_id, expense_date, category, amount, vendor, memo) values ($1,$2,'etc',550000,'OO세무회계','법인 기장료')", [법인, addMonths(M, -1)], c);

  for (const ct of contracts) await reallocateContract(ct.id, c);
  return { contracts: contracts.length };
}
