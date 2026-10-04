import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteDocumentAction } from "@/app/actions/documents";
import {
  addChargeAction,
  holdChargeAction,
  deleteContractAction,
  deletePaymentAction,
  recordPaymentAction,
  saveDepositAction,
  setContractStatusAction,
  terminateContractAction,
} from "@/app/actions/leasing";
import ActionButton from "@/components/ActionButton";
import DocumentUpload from "@/components/DocumentUpload";
import SmartForm from "@/components/Form";
import { ChargeBadge, DocumentsTable, PaymentsTable, StatusBadge } from "@/components/panels";
import PaymentForm from "@/components/PaymentForm";
import { Badge, Card, InfoGrid, Notice, PageHeader, StatCard, Table, Tabs } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { DEPOSIT_STATUS } from "@/lib/constants";
import { getSnapshot } from "@/lib/data";
import { q } from "@/lib/db";
import { daysBetween, fmtDate, monthLabel, monthsBetween } from "@/lib/dates";
import { effectiveEnd, effectiveStatus, expiryLevel } from "@/lib/engine";
import { num, won, wonShort } from "@/lib/format";
import type { DocumentMeta } from "@/lib/types";
import { payOptions, unitLabel } from "@/lib/views";

export const dynamic = "force-dynamic";

export default async function ContractPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; saved?: string }> }) {
  const { can } = await requirePage();
  const { id } = await params;
  const { tab = "rent", saved } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { ds, snap: s } = await getSnapshot(true);
  const c = ds.contracts.find((x) => x.id === id);
  if (!c) notFound();
  const today = s.today;
  const t = ds.tenants.find((x) => x.id === c.tenant_id);
  const unit = ds.units.find((u) => u.id === c.unit_id);
  const charges = ds.charges.filter((x) => x.contract_id === id).sort((a, b) => b.billing_month.localeCompare(a.billing_month));
  const chargeMap = new Map(charges.map((x) => [x.id, x]));
  const payments = ds.payments.filter((x) => x.contract_id === id);
  const deposit = ds.deposits.find((d) => d.contract_id === id);
  const st = effectiveStatus(c, today);
  const left = daysBetween(today, c.end_date);
  const lvl = st === "expiring" ? expiryLevel(left) : null;
  const unpaid = charges.filter((x) => x.due_date < today).reduce((a, x) => a + x.amount - x.paid_amount, 0);
  const totalBilled = charges.reduce((a, x) => a + x.amount, 0);
  const totalPaid = payments.reduce((a, x) => a + x.amount, 0);
  const arrear = s.arrears.find((a) => a.contract.id === id);
  const docs =
    tab === "docs"
      ? await q<DocumentMeta>(
          "select id, property_id, unit_id, contract_id, tenant_id, loan_id, category, title, file_name, mime_type, size_bytes, created_at::text from documents where contract_id = $1 or (tenant_id = $2 and contract_id is null) order by created_at desc",
          [id, c.tenant_id],
        )
      : [];
  const history =
    tab === "history"
      ? await q<{ action: string; entity: string; detail: unknown; created_at: string; name: string | null }>(
          `select a.action, a.entity, a.detail, a.created_at::text, u.name from audit_logs a left join users u on u.id = a.actor_id
           where a.entity_id = $1 or a.entity_id in (select id::text from payments where contract_id = $1::uuid) order by a.id desc limit 100`,
          [id],
        )
      : [];
  const depBase = deposit ? deposit.received_amount || deposit.amount : c.deposit;
  const depLeft = depBase - (deposit?.returned_amount ?? 0) - (deposit?.offset_amount ?? 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${t?.name ?? "?"} · ${unitLabel(ds, c.unit_id)}`}
        desc={
          <span className="flex flex-wrap items-center gap-2">
            <span>{c.contract_no}</span>
            <StatusBadge s={st} />
            {c.is_renewal && <Badge tone="blue">갱신 계약</Badge>}
            {lvl && <span className={lvl === "red" ? "font-semibold text-red-600" : lvl === "orange" ? "text-orange-600" : "text-amber-600"}>{fmtDate(c.end_date)} 만료 (D-{left})</span>}
          </span>
        }
        actions={
          can.editLeasing && (
            <>
              <Link href={`/contracts/${id}/edit`} className="btn-secondary">
                수정
              </Link>
              {["active", "expiring", "expired"].includes(st) && (
                <Link href={`/contracts/new?renew=${id}`} className="btn-secondary">
                  계약 갱신
                </Link>
              )}
              {can.admin && (
                <ActionButton
                  action={deleteContractAction.bind(null, id)}
                  className="btn-secondary !text-red-600"
                  prompt={`계약 ${c.contract_no} (${t?.name ?? ""})을 완전히 삭제합니다.\n\n이 계약의 월 청구 ${charges.length}건, 입금 ${payments.length}건(${totalPaid.toLocaleString()}원), 보증금 기록이 모두 지워지고 되돌릴 수 없습니다. (임차인·호실·서류 파일은 남습니다)\n\n계속하려면 '삭제'라고 입력하세요.`}
                >
                  계약 삭제
                </ActionButton>
              )}
            </>
          )
        }
      />
      {saved && (
        <Notice tone="green">
          {saved === "terminated"
            ? `${fmtDate(c.terminated_on)} 자로 중도해지 처리했습니다. 이후 달의 청구는 지웠고, 보증금 반환 예정일이 해지일로 바뀌었습니다.`
            : saved === "status"
              ? "계약 상태를 바꿨습니다."
              : "저장되었습니다. 월세 청구가 자동으로 만들어졌습니다."}
        </Notice>
      )}
      {arrear && (
        <Notice tone={arrear.days > 90 ? "red" : "orange"}>
          🔴 미납 {arrear.charges.length}개월 · 총 {won(arrear.total)} · 가장 오래된 미납 {arrear.days}일 경과 ({arrear.bucket})
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="월세" value={won(c.monthly_rent)} sub={`관리비 ${num(c.maintenance_fee)} · 부가세 ${num(c.vat_amount)} · 매월 ${c.pay_day}일`} />
        <StatCard label="보증금" value={wonShort(c.deposit)} sub={`미반환 ${wonShort(depLeft)}`} />
        <StatCard label="미납" value={won(unpaid)} tone={unpaid > 0 ? "red" : "green"} sub={`누적 청구 ${wonShort(totalBilled)} · 입금 ${wonShort(totalPaid)}`} />
        <StatCard
          label="계약기간"
          value={`${monthsBetween(c.start_date, c.end_date)}개월`}
          sub={`${fmtDate(c.start_date)} ~ ${fmtDate(effectiveEnd(c))}${c.status === "terminated" ? " (중도해지)" : ""}`}
          tone={lvl === "red" ? "red" : lvl ? "orange" : "gray"}
        />
      </div>

      <Tabs
        base={`/contracts/${id}`}
        active={tab}
        tabs={[
          { key: "rent", label: "월세 · 입금" },
          { key: "info", label: "계약 내용" },
          { key: "deposit", label: "보증금" },
          { key: "docs", label: "계약서/서류" },
          { key: "history", label: "변경 이력" },
        ]}
      />

      {tab === "rent" && (
        <>
          {can.editLeasing && (
            <Card title="💰 입금 등록">
              <PaymentForm action={recordPaymentAction} contracts={payOptions(ds, today, (x) => x.id === id)} today={today} fixedContractId={id} />
            </Card>
          )}
          <Card title="월별 청구 · 입금 · 미납">
            <Table>
              <thead>
                <tr>
                  <th>월</th>
                  <th>납부일</th>
                  <th className="num">청구액</th>
                  <th className="num">입금액</th>
                  <th className="num">미납</th>
                  <th>상태</th>
                  {can.editLeasing && <th className="w-full" />}
                </tr>
              </thead>
              <tbody>
                {charges.map((x) => {
                  const un = x.amount - x.paid_amount;
                  return (
                    <tr key={x.id} className={un > 0 && x.due_date < today ? "bg-red-50/40" : ""}>
                      <td className="font-medium">{monthLabel(x.billing_month)}</td>
                      <td>{fmtDate(x.due_date)}</td>
                      <td className="num">{num(x.amount)}</td>
                      <td className="num">{num(x.paid_amount)}</td>
                      <td className={`num font-semibold ${un > 0 && x.due_date < today ? "text-red-600" : "text-slate-400"}`}>{num(un)}</td>
                      <td>
                        <ChargeBadge c={x} today={today} />
                        {x.hold_unpaid && (
                          <span className="ml-1">
                            <Badge tone="red">미납 고정</Badge>
                          </span>
                        )}
                      </td>
                      {can.editLeasing && (
                        <td className="whitespace-nowrap">
                          {x.hold_unpaid ? (
                            <ActionButton action={holdChargeAction.bind(null, x.id, false)} className="btn-ghost text-xs" confirm={`${monthLabel(x.billing_month)} 미납 고정을 풀까요? 입금이 오래된 달부터 다시 채워집니다.`}>
                              고정 해제
                            </ActionButton>
                          ) : (
                            x.amount > 0 && (
                              <ActionButton
                                action={holdChargeAction.bind(null, x.id, true)}
                                className="btn-ghost text-xs !text-red-600"
                                confirm={`${monthLabel(x.billing_month)}을(를) 미납으로 고정할까요?\n이 달에 들어간 입금은 그 다음 달들로 옮겨집니다. (여러 달 치를 한 번에 입금했는데 이 달만 실제로 미납인 경우)`}
                              >
                                미납으로 표시
                              </ActionButton>
                            )
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={2}>합계 (총 미납 = 청구액 - 입금액)</td>
                  <td className="num">{num(totalBilled)}</td>
                  <td className="num">{num(charges.reduce((a, x) => a + x.paid_amount, 0))}</td>
                  <td className="num text-red-600">{num(unpaid)}</td>
                  <td colSpan={can.editLeasing ? 2 : 1} className="text-xs font-normal text-slate-500">
                    {totalPaid > charges.reduce((a, x) => a + x.paid_amount, 0) && `선납 ${num(totalPaid - charges.reduce((a, x) => a + x.paid_amount, 0))}원`}
                  </td>
                </tr>
              </tfoot>
            </Table>
            {can.editLeasing && (
              <details className="mt-4">
                <summary className="btn-secondary cursor-pointer">+ 빠진 달 청구 추가 (지난 미납 등록)</summary>
                <div className="mt-3 rounded-xl bg-slate-50 p-4">
                  <p className="mb-3 text-xs text-slate-600">
                    표에 없는 지난 달(자동 청구 시작 전 미납 등)이나 0원으로 바꾼 달을 다시 청구합니다. 이미 있는 달이면 금액만 바뀌고, 기존 입금은 지금 채워진 달에 그대로 남습니다.
                  </p>
                  <SmartForm
                    action={addChargeAction}
                    cols={3}
                    resetOnSuccess
                    submitLabel="청구 추가"
                    initial={{ contract_id: id, amount: String(c.monthly_rent + c.maintenance_fee + c.vat_amount) }}
                    sections={[
                      {
                        fields: [
                          { name: "contract_id", type: "hidden" },
                          { name: "month", label: "청구 월", type: "month", required: true },
                          { name: "amount", label: "청구액 (월세+관리비+부가세)", type: "money", required: true },
                        ],
                      },
                    ]}
                  />
                </div>
              </details>
            )}
          </Card>
          <Card title="입금 내역">
            <PaymentsTable
              payments={payments}
              charges={chargeMap}
              cancel={
                can.admin
                  ? (p) => (
                      <ActionButton action={deletePaymentAction.bind(null, p.id)} className="btn-ghost !text-red-600 text-xs" confirm={`${fmtDate(p.paid_date)} ${num(p.amount)}원 입금을 취소할까요?`}>
                        취소
                      </ActionButton>
                    )
                  : undefined
              }
            />
          </Card>
        </>
      )}

      {tab === "info" && (
        <Card title="계약 내용">
          <InfoGrid
            cols={4}
            items={[
              ["계약번호", c.contract_no],
              ["임대인", c.landlord_name],
              ["임차인", t ? <Link key="t" href={`/tenants/${t.id}`} className="link">{t.name}</Link> : "-"],
              ["연락처", t?.phone ? <a key="p" href={`tel:${t.phone}`} className="link">{t.phone}</a> : "-"],
              ["사업자등록번호", t?.biz_no],
              ["목적물", unitLabel(ds, c.unit_id)],
              ["주소", ds.properties.find((p) => p.id === unit?.property_id)?.address],
              ["계약일", fmtDate(c.contract_date)],
              ["시작일", fmtDate(c.start_date)],
              ["종료일", fmtDate(c.end_date)],
              ["중도해지일", fmtDate(c.terminated_on)],
              ["갱신 여부", c.is_renewal ? "갱신 계약" : "신규"],
              ["보증금", won(c.deposit)],
              ["월세", won(c.monthly_rent)],
              ["관리비", won(c.maintenance_fee)],
              ["부가세", won(c.vat_amount)],
              ["월 납부일", `매월 ${c.pay_day}일`],
              ["자동 청구 시작", c.billing_from ? monthLabel(c.billing_from) : "계약 시작 월"],
            ]}
          />
          {c.special_terms && (
            <div className="mt-4">
              <div className="mb-1 text-xs text-slate-500">특약사항</div>
              <p className="rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap">{c.special_terms}</p>
            </div>
          )}
          {c.memo && <p className="mt-3 text-sm whitespace-pre-wrap text-slate-600">메모: {c.memo}</p>}
          {can.editLeasing && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {c.status !== "terminated" && (
                <ActionButton action={terminateContractAction.bind(null, id)} className="btn-secondary" prompt="중도해지일을 입력하세요 (예: 2026-10-31, 비우면 오늘)">
                  중도해지
                </ActionButton>
              )}
              {st === "expired" && c.status !== "expired" && (
                <ActionButton action={setContractStatusAction.bind(null, id, "expired")} confirm="만료 처리할까요?">
                  만료 처리
                </ActionButton>
              )}
              {c.status === "planned" && (
                <ActionButton action={setContractStatusAction.bind(null, id, "active")}>정상 계약으로 변경</ActionButton>
              )}
            </div>
          )}
        </Card>
      )}

      {tab === "deposit" && (
        <Card title="보증금 관리">
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="약정 보증금" value={won(deposit?.amount ?? c.deposit)} />
            <StatCard label="반환 금액" value={won(deposit?.returned_amount ?? 0)} />
            <StatCard label="상계 금액" value={won(deposit?.offset_amount ?? 0)} sub="미납 월세·원상복구비 등" />
            <StatCard label="미반환 금액" value={won(depLeft)} tone={depLeft > 0 ? "blue" : "green"} sub={DEPOSIT_STATUS[deposit?.status ?? "held"]} />
          </div>
          {unpaid > 0 && depLeft > 0 && (
            <Notice tone="orange">
              미납 월세 {won(unpaid)}이 있습니다. 보증금에서 상계하려면 &apos;상계 금액&apos;에 입력하고, 입금 등록에서 방법을 &apos;보증금 상계&apos;로 기록하세요.
            </Notice>
          )}
          {can.editLeasing ? (
            <div className="mt-4">
              <SmartForm
                action={saveDepositAction}
                cols={4}
                initial={{
                  contract_id: id,
                  amount: String(deposit?.amount ?? c.deposit),
                  received_amount: String(deposit?.received_amount ?? c.deposit),
                  received_date: deposit?.received_date ?? c.start_date,
                  return_due_date: deposit?.return_due_date ?? effectiveEnd(c),
                  returned_amount: String(deposit?.returned_amount ?? 0),
                  offset_amount: String(deposit?.offset_amount ?? 0),
                  returned_date: deposit?.returned_date ?? "",
                  memo: deposit?.memo ?? "",
                }}
                sections={[
                  {
                    fields: [
                      { name: "contract_id", type: "hidden" },
                      { name: "amount", label: "약정 보증금", type: "money" },
                      { name: "received_amount", label: "실제 받은 보증금", type: "money" },
                      { name: "received_date", label: "받은 날", type: "date" },
                      { name: "return_due_date", label: "반환 예정일", type: "date" },
                      { name: "returned_amount", label: "반환한 금액 (일부 반환 포함)", type: "money" },
                      { name: "offset_amount", label: "상계 금액", type: "money" },
                      { name: "returned_date", label: "반환일", type: "date" },
                      { name: "memo", label: "메모" },
                    ],
                  },
                ]}
              />
            </div>
          ) : null}
        </Card>
      )}

      {tab === "docs" && (
        <Card title="계약서 / 임차인 서류">
          {can.editLeasing && (
            <div className="mb-4">
              <DocumentUpload context={{ contract_id: id, tenant_id: c.tenant_id, unit_id: c.unit_id, property_id: unit?.property_id }} defaultCategory="lease" />
            </div>
          )}
          <DocumentsTable
            docs={docs}
            canDelete={can.admin}
            remove={(d) => (
              <ActionButton action={deleteDocumentAction.bind(null, d.id)} className="btn-ghost !text-red-600" confirm="삭제할까요?">
                삭제
              </ActionButton>
            )}
          />
        </Card>
      )}

      {tab === "history" && (
        <Card title="변경 이력">
          <ul className="divide-y divide-slate-100 text-sm">
            {history.length === 0 && <li className="py-3 text-slate-500">기록이 없습니다.</li>}
            {history.map((h, i) => (
              <li key={i} className="flex justify-between gap-3 py-2">
                <span>
                  <b>{h.name ?? "시스템"}</b> · {h.entity} {h.action}
                  <span className="ml-2 text-xs break-all text-slate-400">{JSON.stringify(h.detail)?.slice(0, 160)}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-500">{h.created_at.slice(0, 16)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
