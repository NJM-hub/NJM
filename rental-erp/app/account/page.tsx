import { changePasswordAction } from "@/app/actions/auth";
import SmartForm from "@/components/Form";
import { Card, InfoGrid, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { roleLabel } from "@/lib/permissions";

export default async function AccountPage() {
  const { user } = await requirePage();
  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="내 계정" />
      <Card>
        <InfoGrid items={[["이름", user.name], ["이메일", user.email], ["권한", roleLabel(user.role)]]} />
      </Card>
      <Card title="비밀번호 변경">
        <SmartForm
          action={changePasswordAction}
          cols={2}
          resetOnSuccess
          submitLabel="비밀번호 변경"
          sections={[
            {
              fields: [
                { name: "current", label: "현재 비밀번호", type: "password", span: 2 },
                { name: "password", label: "새 비밀번호 (8자 이상)", type: "password" },
                { name: "password2", label: "새 비밀번호 확인", type: "password" },
              ],
            },
          ]}
        />
      </Card>
    </div>
  );
}
