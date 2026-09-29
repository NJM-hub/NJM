import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import SimpleForm from "@/components/SimpleForm";
import { resetPasswordAction, updateUserAction } from "@/app/users/actions";
import { requirePage } from "@/lib/auth";
import { ROLES } from "@/lib/permissions";
import { getUser } from "@/lib/users";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  saved: "저장했습니다. 바뀐 권한은 바로 적용됩니다.",
  password: "비밀번호를 바꿨습니다. 그 사용자는 새 비밀번호로 다시 로그인해야 합니다.",
};

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const [{ user: me }, { id }, { msg }] = await Promise.all([requirePage("admin"), params, searchParams]);
  const u = await getUser(id);
  if (!u) notFound();
  const isMe = u.id === me.id;

  return (
    <>
      <div className="mb-3"><Link href="/users" className="text-sm text-navy-600 hover:underline">← 사용자 관리</Link></div>
      <PageHeader title={u.display_name || u.email} description={`${u.email}${isMe ? " · 나" : ""}`} />
      {msg && MESSAGES[msg] && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{MESSAGES[msg]}</div>
      )}

      <section className="card card-body">
        <h2 className="mb-4 text-base font-semibold text-navy-900">이름·권한·사용 여부</h2>
        <SimpleForm
          action={updateUserAction.bind(null, u.id)}
          submitLabel="저장"
          fields={[
            { name: "name", label: "이름", type: "text", initial: u.display_name },
            { name: "role", label: "권한", type: "select", initial: u.role, options: ROLES.map((r) => ({ value: r.value, label: `${r.label} - ${r.desc}` })) },
            { name: "is_active", label: "사용 (끄면 이 사용자는 바로 로그아웃되고 다시 로그인할 수 없습니다)", type: "checkbox", initial: u.is_active },
          ]}
        />
        {isMe && <p className="mt-2 text-xs text-slate-500">자기 자신의 관리자 권한을 빼거나 사용 중지할 수는 없습니다.</p>}
      </section>

      <section className="card card-body mt-5">
        <h2 className="mb-1 text-base font-semibold text-navy-900">비밀번호 재설정</h2>
        <p className="mb-4 text-xs text-slate-500">직원이 비밀번호를 잊었을 때 새로 정해줍니다. 바꾸면 그 직원의 기존 로그인은 모두 끊깁니다.</p>
        <SimpleForm
          action={resetPasswordAction.bind(null, u.id)}
          submitLabel="비밀번호 바꾸기"
          danger
          confirmText="이 사용자의 비밀번호를 새로 정할까요?"
          fields={[
            { name: "password", label: "새 비밀번호 (8자 이상)", type: "password", autoComplete: "new-password" },
            { name: "password2", label: "새 비밀번호 확인", type: "password", autoComplete: "new-password" },
          ]}
        />
      </section>
    </>
  );
}
