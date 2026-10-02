import Link from "next/link";
import { createUserAction, updateUserAction } from "@/app/actions/auth";
import { resetCalcAction, runDailyAction, saveCalcAction, saveNotifyTargetsAction, saveOwnerAction, seedAction, wipeDataAction } from "@/app/actions/settings";
import ActionButton from "@/components/ActionButton";
import SmartForm from "@/components/Form";
import NotifyTargetsForm from "@/components/NotifyTargetsForm";
import { Badge, Card, Notice, PageHeader, Table, Tabs } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { FORMULA_LABELS, FORMULA_VARS } from "@/lib/calcSettings";
import { OWNER_TYPES } from "@/lib/constants";
import { getCalcSettings, getSetting } from "@/lib/data";
import { q } from "@/lib/db";
import type { NotifyTarget } from "@/lib/notifications";
import { ROLES } from "@/lib/permissions";
import type { Owner } from "@/lib/types";

export const dynamic = "force-dynamic";

const roleOptions = Object.entries(ROLES).map(([value, label]) => ({ value, label }));

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; welcome?: string }> }) {
  const { user, can } = await requirePage();
  const { tab = "owners", welcome } = await searchParams;
  const [owners, calc, targets, users, counts] = await Promise.all([
    q<Owner>("select * from owners order by owner_type desc, name"),
    getCalcSettings(),
    getSetting<NotifyTarget[]>("notify_targets", []),
    can.admin ? q<{ id: string; name: string; email: string; role: string; is_active: boolean; last_login_at: string | null }>("select id, name, email, role, is_active, last_login_at::text from users order by created_at") : Promise.resolve([]),
    q<{ properties: number }>("select count(*)::int as properties from properties"),
  ]);
  const empty = counts[0].properties === 0;

  return (
    <div className="space-y-4">
      <PageHeader title="⚙️ 설정" desc="소유주(개인·법인), 계산식, 알림, 사용자 권한, 데이터" />
      {welcome && (
        <Notice tone="green">
          관리자 계정이 만들어졌습니다. 먼저 <b>소유주</b>(개인/법인)를 등록하거나, <Link className="link" href="/settings?tab=data">데이터</Link> 탭에서 샘플 데이터를 넣어 둘러보세요.
        </Notice>
      )}
      <Tabs
        base="/settings"
        active={tab}
        tabs={[
          { key: "owners", label: "소유주 (개인·법인)" },
          { key: "calc", label: "계산식" },
          { key: "notify", label: "알림" },
          ...(can.admin ? [{ key: "users", label: "사용자·권한" }] : []),
          { key: "data", label: "데이터" },
        ]}
      />

      {tab === "owners" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <Card title="소유주 목록" actions={<span className="text-xs text-slate-500">부동산마다 소유주를 지정하면 법인별·개인별 수익을 따로 볼 수 있습니다</span>}>
            <div className="space-y-3">
              {owners.length === 0 && <p className="text-sm text-slate-500">등록된 소유주가 없습니다.</p>}
              {owners.map((o) => (
                <details key={o.id} className="rounded-xl bg-slate-50 p-3">
                  <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                    <Badge tone={o.owner_type === "corporation" ? "blue" : "gray"}>{OWNER_TYPES[o.owner_type]}</Badge>
                    {o.name}
                    {o.biz_no && <span className="text-xs font-normal text-slate-500">{o.biz_no}</span>}
                    {!o.is_active && <Badge>미사용</Badge>}
                  </summary>
                  {can.editAssets && (
                    <div className="mt-3">
                      <SmartForm
                        action={saveOwnerAction}
                        cols={2}
                        initial={{ ...o, inactive: !o.is_active } as never}
                        sections={[{ fields: ownerFields(true) }]}
                      />
                    </div>
                  )}
                </details>
              ))}
            </div>
          </Card>
          {can.editAssets && (
            <Card title="소유주 추가">
              <SmartForm action={saveOwnerAction} cols={2} resetOnSuccess submitLabel="추가" initial={{ owner_type: "corporation" }} sections={[{ fields: ownerFields(false) }]} />
            </Card>
          )}
        </div>
      )}

      {tab === "calc" && (
        <Card title="계산 기준 · 계산식">
          <p className="mb-4 text-sm text-slate-600">
            모든 숫자는 자동 계산됩니다. 아래 계산식을 바꾸면 대시보드·부동산별 손익·수익률이 모두 새 식으로 계산됩니다. 사용할 수 있는 기호: <code>+ - * / ( )</code>, <code>max(a, b)</code>, <code>min(a, b)</code>
          </p>
          {can.admin ? (
            <>
              <SmartForm
                action={saveCalcAction}
                cols={2}
                initial={{
                  ...Object.fromEntries(Object.entries(calc.formulas).map(([k, v]) => [`f_${k}`, v])),
                  vacancyDayBase: String(calc.vacancyDayBase),
                  opexMonths: String(calc.opexMonths),
                  depositAlertDays: String(calc.depositAlertDays),
                  loanMaturityAlertDays: String(calc.loanMaturityAlertDays),
                  expiryAlertDays: calc.expiryAlertDays.join(", "),
                  interestMethod: calc.interestMethod,
                  maintenanceAsIncome: calc.maintenanceAsIncome,
                  vatAsIncome: calc.vatAsIncome,
                }}
                sections={[
                  {
                    title: "계산식",
                    fields: (Object.keys(FORMULA_VARS) as (keyof typeof FORMULA_VARS)[]).map((k) => ({
                      name: `f_${k}`,
                      label: FORMULA_LABELS[k],
                      span: 2 as const,
                      hint: `사용 가능: ${FORMULA_VARS[k].join(", ")}`,
                    })),
                  },
                  {
                    title: "기준값",
                    fields: [
                      { name: "vacancyDayBase", label: "공실손실: 한 달 기준 일수", suffix: "일" },
                      { name: "opexMonths", label: "월 운영비 = 최근 몇 개월 비용 평균", suffix: "개월" },
                      {
                        name: "interestMethod",
                        label: "월 이자 계산",
                        type: "select",
                        required: true,
                        options: [
                          { value: "monthly", label: "잔액 × 금리 ÷ 12" },
                          { value: "daily", label: "잔액 × 금리 ÷ 365 × 그 달 일수" },
                        ],
                      },
                      { name: "maintenanceAsIncome", label: "관리비를 기타 임대수입으로 포함", type: "checkbox" },
                      { name: "vatAsIncome", label: "부가세를 수입에 포함", type: "checkbox" },
                    ],
                  },
                  {
                    title: "알림 기준",
                    fields: [
                      { name: "expiryAlertDays", label: "계약 만료 알림 (일 전)", hint: "쉼표로 구분 예: 90, 60, 30, 7" },
                      { name: "depositAlertDays", label: "보증금 반환 알림 (종료 며칠 전부터)", suffix: "일" },
                      { name: "loanMaturityAlertDays", label: "대출 만기 알림 (며칠 전부터)", suffix: "일" },
                    ],
                  },
                ]}
              />
              <div className="mt-3 border-t border-slate-100 pt-3">
                <ActionButton action={resetCalcAction} confirm="기본 계산식으로 되돌릴까요?">
                  기본값으로 되돌리기
                </ActionButton>
              </div>
            </>
          ) : (
            <ul className="space-y-1 text-sm">
              {(Object.keys(FORMULA_VARS) as (keyof typeof FORMULA_VARS)[]).map((k) => (
                <li key={k}>
                  <b>{FORMULA_LABELS[k]}</b> = {calc.formulas[k]}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "notify" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="알림 받을 곳 (문자·카카오톡·이메일)">
            <p className="mb-3 text-sm text-slate-600">
              앱 안 알림은 항상 만들어집니다. 여기에 연락처를 넣어두면 같은 알림이 <b>발송 대기열</b>에 쌓이고, 문자·카카오 발송 업체를 연동하면(개발자: <code>lib/notifications.ts</code> 의 Provider) 자동 발송됩니다. 웹훅 URL 은 지금 바로 발송됩니다.
            </p>
            {can.admin ? <NotifyTargetsForm action={saveNotifyTargetsAction} initial={targets} /> : <p className="text-sm text-slate-500">관리자만 바꿀 수 있습니다.</p>}
          </Card>
          <Card title="알림 만들기">
            <p className="mb-3 text-sm text-slate-600">
              매일 아침 자동으로 월세 청구를 만들고 알림(월세 납부일·미납·계약 만료·보증금 반환·대출 만기·이자 납부·공실)을 생성합니다. 지금 바로 실행할 수도 있습니다.
            </p>
            <ActionButton action={runDailyAction} className="btn">
              지금 실행
            </ActionButton>
            <p className="mt-3 text-sm">
              <Link href="/notifications" className="link">
                알림 목록 보기 →
              </Link>
            </p>
          </Card>
        </div>
      )}

      {tab === "users" && can.admin && (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <Card title="사용자">
            <Table>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>이메일</th>
                  <th>권한</th>
                  <th>상태</th>
                  <th>최근 로그인</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-semibold">{u.name}</td>
                    <td>{u.email}</td>
                    <td>{ROLES[u.role as keyof typeof ROLES]}</td>
                    <td>{u.is_active ? <Badge tone="green">사용 중</Badge> : <Badge>중지</Badge>}</td>
                    <td className="text-xs text-slate-500">{u.last_login_at?.slice(0, 16) ?? "-"}</td>
                    <td>
                      <details>
                        <summary className="btn-ghost cursor-pointer">수정</summary>
                        <div className="mt-2 w-72 whitespace-normal">
                          <SmartForm
                            action={updateUserAction}
                            cols={2}
                            initial={{ id: u.id, role: u.role, is_active: u.is_active }}
                            sections={[
                              {
                                fields: [
                                  { name: "id", type: "hidden" },
                                  { name: "role", label: "권한", type: "select", required: true, options: roleOptions, span: 2 },
                                  { name: "is_active", label: "사용", type: "checkbox", span: 2 },
                                  { name: "password", label: "비밀번호 재설정 (선택)", type: "password", span: 2 },
                                ],
                              },
                            ]}
                          />
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="mt-4 text-xs text-slate-500">
              <b>관리자</b>: 모든 정보 확인·수정 · <b>직원</b>: 임대료·입금·계약·임차인·문서 관리 · <b>조회자</b>: 조회만 가능
            </div>
          </Card>
          <Card title="사용자 추가">
            <SmartForm
              action={createUserAction}
              cols={2}
              resetOnSuccess
              submitLabel="추가"
              initial={{ role: "staff" }}
              sections={[
                {
                  fields: [
                    { name: "name", label: "이름", required: true, span: 2 },
                    { name: "email", label: "로그인 이메일", type: "email", required: true, span: 2 },
                    { name: "role", label: "권한", type: "select", required: true, options: roleOptions, span: 2 },
                    { name: "password", label: "처음 비밀번호 (8자 이상)", type: "password", required: true, span: 2 },
                  ],
                },
              ]}
            />
          </Card>
        </div>
      )}

      {tab === "data" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="샘플 데이터">
            <p className="mb-3 text-sm text-slate-600">
              실제 데이터를 넣기 전에 기능을 확인할 수 있도록 가상의 부동산 5개·호실 11개·임차인 10명(정상 입금, 미납, 공실, 계약 만료 예정, 계약 예정, 대출 있음/없음, 12개월 비용)을 넣습니다. 오늘 날짜 기준으로 만들어집니다.
            </p>
            {can.admin ? (
              empty ? (
                <ActionButton action={seedAction} className="btn" confirm="샘플 데이터를 넣을까요?">
                  샘플 데이터 넣기
                </ActionButton>
              ) : (
                <p className="text-sm text-slate-500">이미 부동산이 등록되어 있어 샘플 데이터를 넣을 수 없습니다.</p>
              )
            ) : (
              <p className="text-sm text-slate-500">관리자만 실행할 수 있습니다.</p>
            )}
          </Card>
          <Card title="엑셀">
            <p className="text-sm text-slate-600">
              부동산·임차인·계약·입금·미납·대출·비용·월별 손익을 엑셀로 내려받거나, 기존 엑셀 자료를 가져올 수 있습니다.
            </p>
            <Link href="/reports?tab=excel" className="btn-secondary mt-3">
              엑셀 내보내기 / 가져오기 →
            </Link>
          </Card>
          {can.admin && (
            <Card title="⚠️ 모든 임대 데이터 삭제" className="lg:col-span-2">
              <p className="mb-3 text-sm text-slate-600">샘플 데이터를 지우고 실제 데이터를 넣을 때 사용합니다. 부동산·호실·임차인·계약·입금·대출·비용·문서·소유주가 모두 지워집니다 (사용자 계정·설정은 남음). 되돌릴 수 없습니다.</p>
              <SmartForm
                action={wipeDataAction}
                cols={2}
                submitLabel="모두 삭제"
                sections={[{ fields: [{ name: "confirm", label: "확인을 위해 '전체삭제' 입력" }] }]}
              />
            </Card>
          )}
        </div>
      )}
      <p className="text-xs text-slate-400">로그인: {user.email}</p>
    </div>
  );
}

function ownerFields(edit: boolean) {
  return [
    ...(edit ? [{ name: "id", type: "hidden" as const }] : []),
    { name: "name", label: "이름 / 법인명", required: true },
    {
      name: "owner_type",
      label: "구분",
      type: "select" as const,
      required: true,
      options: Object.entries(OWNER_TYPES).map(([value, label]) => ({ value, label })),
    },
    { name: "biz_no", label: "사업자(법인)등록번호" },
    { name: "representative", label: "대표자" },
    { name: "phone", label: "연락처" },
    { name: "memo", label: "메모" },
    ...(edit ? [{ name: "inactive", label: "미사용으로 변경", type: "checkbox" as const }] : []),
  ];
}
