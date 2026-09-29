import PageHeader from "@/components/PageHeader";
import SimpleForm from "@/components/SimpleForm";
import { changeOwnPasswordAction, updateOwnNameAction } from "@/app/users/actions";
import { requirePage } from "@/lib/auth";
import { roleLabel } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  saved: "저장했습니다.",
  password: "비밀번호를 바꿨습니다. 다른 기기에서의 로그인은 모두 끊겼습니다.",
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const [{ user }, { msg }] = await Promise.all([requirePage(), searchParams]);
  return (
    <>
      <PageHeader title="내 계정" description={`${user.email} · ${roleLabel(user.role)}`} />
      {msg && MESSAGES[msg] && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{MESSAGES[msg]}</div>
      )}
      <section className="card card-body">
        <h2 className="mb-4 text-base font-semibold text-navy-900">이름</h2>
        <SimpleForm action={updateOwnNameAction} submitLabel="저장" fields={[{ name: "name", label: "이름", type: "text", initial: user.name }]} />
      </section>
      <section className="card card-body mt-5">
        <h2 className="mb-4 text-base font-semibold text-navy-900">비밀번호 변경</h2>
        <SimpleForm
          action={changeOwnPasswordAction}
          submitLabel="비밀번호 변경"
          fields={[
            { name: "current", label: "현재 비밀번호", type: "password", autoComplete: "current-password" },
            { name: "password", label: "새 비밀번호 (8자 이상)", type: "password", autoComplete: "new-password" },
            { name: "password2", label: "새 비밀번호 확인", type: "password", autoComplete: "new-password" },
          ]}
        />
      </section>
    </>
  );
}
