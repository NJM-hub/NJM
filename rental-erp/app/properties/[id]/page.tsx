import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteDocumentAction } from "@/app/actions/documents";
import { recordPaymentAction } from "@/app/actions/leasing";
import { deleteUnitAction, saveUnitAction } from "@/app/actions/properties";
import ActionButton from "@/components/ActionButton";
import { ColumnChart } from "@/components/charts";
import DocumentUpload from "@/components/DocumentUpload";
import SmartForm from "@/components/Form";
import { ArrearsList } from "@/components/lists";
import { ChargesTable, DocumentsTable, LoansTable, PaymentsTable, ProfitStatement, StatusBadge } from "@/components/panels";
import PaymentForm from "@/components/PaymentForm";
import { Badge, Card, Empty, InfoGrid, Notice, PageHeader, StatCard, Table, Tabs } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { OWNER_TYPES, PROPERTY_TYPES, label } from "@/lib/constants";
import { getCalcSettings, getSnapshot } from "@/lib/data";
import { q } from "@/lib/db";
import { fmtDate, shortMonthLabel } from "@/lib/dates";
import { buildSnapshot, effectiveStatus } from "@/lib/engine";
import { unitFields } from "@/lib/fieldsets";
import { pct, won, wonShort } from "@/lib/format";
import type { DocumentMeta } from "@/lib/types";
import { compareUnits, payOptions } from "@/lib/views";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "info", label: "기본정보" },
  { key: "units", label: "임대현황" },
  { key: "contracts", label: "계약정보" },
  { key: "payments", label: "입금현황" },
  { key: "arrears", label: "미납현황" },
  { key: "loans", label: "대출정보" },
  { key: "profit", label: "수익분석" },
  { key: "docs", label: "계약서/서류" },
];

export default async function PropertyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; saved?: string }> }) {
  const { can } = await requirePage();
  const { id } = await params;
  const { tab = "units", saved } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ ds, snap: all }, settings] = await Promise.all([getSnapshot(true), getCalcSettings()]);
  const prop = ds.properties.find((p) => p.id === id);
  if (!prop) notFound();
  const s = buildSnapshot(ds, settings, all.today, { propertyId: id });
  const pm = s.properties[0];
  const today = s.today;
  const allUnits = ds.units.filter((u) => u.property_id === id).sort((a, b) => compareUnits(ds, a, b));
  const contracts = ds.contracts.filter((c) => allUnits.some((u) => u.id === c.unit_id)).sort((a, b) => b.start_date.localeCompare(a.start_date));
  const cIds = new Set(contracts.map((c) => c.id));
  const charges = ds.charges.filter((c) => cIds.has(c.contract_id));
  const chargeMap = new Map(charges.map((c) => [c.id, c]));
  const payments = ds.payments.filter((p) => cIds.has(p.contract_id));
  const loans = ds.loans.filter((l) => l.property_id === id);
  const tenant = new Map(ds.tenants.map((t) => [t.id, t]));
  const unitNo = new Map(ds.units.map((u) => [u.id, u.unit_no]));
  const contractById = new Map(contracts.map((c) => [c.id, c]));
  const who = (contractId: string) => {
    const c = contractById.get(contractId);
    return c ? `${tenant.get(c.tenant_id)?.name ?? ""} / ${unitNo.get(c.unit_id) ?? ""}` : "";
  };
  const docs = tab === "docs"
    ? await q<DocumentMeta>("select id, property_id, unit_id, contract_id, tenant_id, loan_id, category, title, file_name, mime_type, size_bytes, created_at::text from documents where property_id = $1 order by created_at desc", [id])
    : [];
  const owner = ds.owners.find((o) => o.id === prop.owner_id);

  return (
    <div className="space-y-4">
      <PageHeader
        title={prop.name}
        desc={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">{label(PROPERTY_TYPES, prop.property_type)}</Badge>
            {owner && <Badge tone="gray">{owner.name} · {OWNER_TYPES[owner.owner_type]}</Badge>}
            {!prop.is_active && <Badge tone="red">매각/정리</Badge>}
            <span>{prop.address}</span>
          </span>
        }
        actions={
          <>
            {can.editLeasing && <Link href={`/contracts/new?property=${id}`} className="btn-secondary">+ 계약 등록</Link>}
            {can.editAssets && <Link href={`/properties/${id}/edit`} className="btn-secondary">정보 수정</Link>}
          </>
        }
      />
      {saved && <Notice tone="green">저장되었습니다.</Notice>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <StatCard label="호실" value={`${pm.unitCount}개`} sub={`임대 ${pm.occupiedCount} · 공실 ${pm.vacantCount}`} tone={pm.vacantCount ? "orange" : "green"} />
        <StatCard label="월세" value={wonShort(pm.monthlyRent)} sub={`보증금 ${wonShort(pm.deposits)}`} />
        <StatCard label="미납" value={wonShort(pm.unpaid)} tone={pm.unpaid ? "red" : "green"} />
        <StatCard label="월 대출이자" value={wonShort(pm.monthlyInterest)} sub={`잔액 ${wonShort(pm.loanBalance)}`} />
        <StatCard label="월 순수익" value={wonShort(pm.monthlyNet)} sub={`연 ${wonShort(pm.annualNet)}`} tone={pm.monthlyNet >= 0 ? "green" : "red"} />
        <StatCard label="자기자본 수익률" value={pct(pm.leveragedYield)} sub={`임대수익률 ${pct(pm.simpleYield)}`} />
      </div>

      <Tabs base={`/properties/${id}`} active={tab} tabs={TABS.map((t) => ({ ...t, count: t.key === "arrears" ? s.arrears.length || undefined : undefined }))} />

      {tab === "info" && (
        <Card title="부동산 기본정보">
          <InfoGrid
            cols={4}
            items={[
              ["부동산명", prop.name],
              ["건물명", prop.building_name],
              ["주소", prop.address],
              ["종류", label(PROPERTY_TYPES, prop.property_type)],
              ["소유주", owner ? `${owner.name} (${OWNER_TYPES[owner.owner_type]})` : "-"],
              ["매입일", fmtDate(prop.purchase_date)],
              ["매입가격", won(prop.purchase_price)],
              ["현재 예상가", won(prop.current_value)],
              ["취득 관련 비용", won(prop.acquisition_cost)],
              ["리모델링 비용", won(prop.remodeling_cost)],
              ["기타 투자금", won(prop.other_investment)],
              ["평가차익", prop.current_value ? won(prop.current_value - pm.investedTotal) : "-"],
            ]}
          />
          {prop.memo && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap">{prop.memo}</p>}
        </Card>
      )}

      {tab === "units" && (
        <Card title="현재 임대현황 (호실별)">
          <Table>
            <thead>
              <tr>
                <th>호실</th>
                <th>상태</th>
                <th>임차인</th>
                <th className="num">보증금</th>
                <th className="num">월세</th>
                <th>계약기간</th>
                <th className="num">미납</th>
                {can.editAssets && <th />}
              </tr>
            </thead>
            <tbody>
              {allUnits.map((u) => {
                const v = pm.units.find((x) => x.unit.id === u.id);
                const c = v?.contract;
                return (
                  <tr key={u.id} className={!u.is_active ? "opacity-50" : ""}>
                    <td className="font-semibold">
                      {[u.dong && `${u.dong}동`, u.unit_no].filter(Boolean).join(" ")}
                      <div className="text-xs font-normal text-slate-500">{[u.floor, u.area_m2 && `${u.area_m2}㎡`].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td>
                      {!u.is_active ? (
                        <Badge>사용 안 함</Badge>
                      ) : c ? (
                        <StatusBadge s={effectiveStatus(c, today)} />
                      ) : (
                        <Badge tone="orange">공실 {v?.vacancyDays}일</Badge>
                      )}
                    </td>
                    <td>
                      {c ? (
                        <Link href={`/contracts/${c.id}`} className="link">
                          {v?.tenant?.name}
                        </Link>
                      ) : v?.upcoming ? (
                        <span className="text-xs text-navy-600">{fmtDate(v.upcoming.start_date)} 입주 예정</span>
                      ) : (
                        <span className="text-xs text-slate-500">예상 손실 {won(v?.vacancyLoss ?? 0)}</span>
                      )}
                    </td>
                    <td className="num">{c ? wonShort(c.deposit) : <span className="text-slate-400">{wonShort(u.expected_deposit)}</span>}</td>
                    <td className="num">{c ? won(c.monthly_rent) : <span className="text-slate-400">{won(u.expected_rent)}</span>}</td>
                    <td className="text-xs">{c ? `${fmtDate(c.start_date)} ~ ${fmtDate(c.end_date)}` : "-"}</td>
                    <td className={`num ${v?.unpaid ? "font-bold text-red-600" : "text-slate-400"}`}>{v?.unpaid ? won(v.unpaid) : "-"}</td>
                    {can.editAssets && (
                      <td>
                        <details>
                          <summary className="btn-ghost cursor-pointer">수정</summary>
                          <div className="mt-2 w-[min(90vw,560px)] whitespace-normal">
                            <SmartForm action={saveUnitAction} cols={2} initial={{ ...(u as unknown as Record<string, string>), inactive: !u.is_active }} sections={[{ fields: unitFields(true) }]} />
                            <div className="mt-2">
                              <ActionButton action={deleteUnitAction.bind(null, u.id)} className="btn-ghost !text-red-600" confirm="이 호실을 삭제할까요? (계약이 있으면 삭제되지 않습니다)">
                                호실 삭제
                              </ActionButton>
                            </div>
                          </div>
                        </details>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
          {can.editAssets && (
            <details className="mt-4">
              <summary className="btn-secondary cursor-pointer">+ 호실 추가</summary>
              <div className="mt-3 rounded-xl bg-slate-50 p-4">
                <SmartForm action={saveUnitAction} cols={4} resetOnSuccess submitLabel="호실 추가" initial={{ property_id: id }} sections={[{ fields: unitFields(false) }]} />
              </div>
            </details>
          )}
        </Card>
      )}

      {tab === "contracts" && (
        <Card title="계약정보" actions={can.editLeasing && <Link href={`/contracts/new?property=${id}`} className="link">+ 계약 등록</Link>}>
          {contracts.length === 0 ? (
            <Empty>계약이 없습니다.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>계약번호</th>
                  <th>호실</th>
                  <th>임차인</th>
                  <th>상태</th>
                  <th>기간</th>
                  <th className="num">보증금</th>
                  <th className="num">월세</th>
                  <th className="num">납부일</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/contracts/${c.id}`} className="link">
                        {c.contract_no}
                      </Link>
                    </td>
                    <td>{unitNo.get(c.unit_id)}</td>
                    <td>{tenant.get(c.tenant_id)?.name}</td>
                    <td>
                      <StatusBadge s={effectiveStatus(c, today)} />
                    </td>
                    <td className="text-xs">
                      {fmtDate(c.start_date)} ~ {fmtDate(c.end_date)}
                    </td>
                    <td className="num">{wonShort(c.deposit)}</td>
                    <td className="num">{won(c.monthly_rent)}</td>
                    <td className="num">매월 {c.pay_day}일</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === "payments" && (
        <>
          {can.editLeasing && (
            <Card title="💰 입금 등록">
              <PaymentForm action={recordPaymentAction} contracts={payOptions(ds, today, (c) => cIds.has(c.id))} today={today} />
            </Card>
          )}
          <Card title="월별 청구 · 입금">
            <ChargesTable charges={charges} today={today} who={(c) => who(c.contract_id)} />
          </Card>
          <Card title="입금 내역">
            <PaymentsTable payments={payments} charges={chargeMap} who={(p) => who(p.contract_id)} />
          </Card>
        </>
      )}

      {tab === "arrears" && (
        <Card title="🔴 미납현황">
          <ArrearsList items={s.arrears} />
        </Card>
      )}

      {tab === "loans" && (
        <Card title="대출정보" actions={can.editAssets && <Link href={`/loans/new?property=${id}`} className="link">+ 대출 등록</Link>}>
          <LoansTable loans={loans} />
          {loans.length > 0 && (
            <p className="mt-3 text-sm text-slate-600">
              대출잔액 합계 <b>{won(pm.loanBalance)}</b> · 월 이자 <b>{won(pm.monthlyInterest)}</b> · 연 이자 <b>{won(pm.monthlyInterest * 12)}</b>
            </p>
          )}
        </Card>
      )}

      {tab === "profit" && (
        <>
          <Card title={`${prop.name} 손익계산`}>
            <ProfitStatement p={pm} equityFormula={settings.formulas.equity} />
          </Card>
          <Card title="월별 현금흐름 (최근 12개월)">
            <ColumnChart
              labels={s.monthly.map((m) => shortMonthLabel(m.month))}
              series={[
                { name: "입금", values: s.monthly.map((m) => m.collected) },
                { name: "비용+이자", values: s.monthly.map((m) => m.expenses + m.interest) },
              ]}
              fmt={won}
              wide
            />
          </Card>
        </>
      )}

      {tab === "docs" && (
        <Card title="계약서 / 서류">
          {can.editLeasing && (
            <div className="mb-4">
              <DocumentUpload context={{ property_id: id }} defaultCategory="registry" />
            </div>
          )}
          <DocumentsTable
            docs={docs}
            canDelete={can.admin}
            remove={(d) => (
              <ActionButton action={deleteDocumentAction.bind(null, d.id)} className="btn-ghost !text-red-600" confirm={`'${d.file_name}' 을(를) 삭제할까요?`}>
                삭제
              </ActionButton>
            )}
          />
        </Card>
      )}
    </div>
  );
}
