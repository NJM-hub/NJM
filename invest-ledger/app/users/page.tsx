import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SimpleForm from "@/components/SimpleForm";
import { createUserAction } from "@/app/users/actions";
import { requirePage } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { ROLES, roleLabel } from "@/lib/permissions";
import { listUsers } from "@/lib/users";

export const dynamic = "force-dynamic";


export default async function UsersPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const [{ user: me }, { msg }] = await Promise.all([requirePage("admin"), searchParams]);
  const users = await listUsers();

  return (
    <>
      <PageHeader title="사용자 관리" description="직원 계정을 만들고 권한을 정합니다. 계정은 지우지 않고 '사용 중지'로 관리합니다." />
      {msg === "created" && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          사용자를 추가했습니다. 정한 이메일과 비밀번호를 직원에게 알려주세요.
        </div>
      )}

      <section className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>이름</th><th>이메일(로그인)</th><th>권한</th><th>상태</th><th>마지막 로그인</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`relative hover:bg-navy-50 ${u.is_active ? "" : "opacity-50"}`}>
                <td className="font-medium text-navy-900">
                  <Link href={`/users/${u.id}`} className="after:absolute after:inset-0">{u.display_name || "-"}</Link>
                  {u.id === me.id && <span className="ml-1 text-xs text-slate-500">(나)</span>}
                </td>
                <td>{u.email}</td>
                <td>{roleLabel(u.role)}</td>
                <td>{u.is_active ? "사용" : "사용 중지"}</td>
                <td className="tabular-nums">{dateTime(u.last_login_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card card-body mt-5">
        <h2 className="mb-1 text-base font-semibold text-navy-900">사용자 추가</h2>
        <p className="mb-4 text-xs text-slate-500">
          이메일은 로그인 아이디로만 쓰이고 실제로 메일이 가지는 않습니다. 비밀번호는 직원이 로그인한 뒤 &lsquo;내 계정&rsquo;에서 바꿀 수 있습니다.
        </p>
        <SimpleForm
          action={createUserAction}
          submitLabel="사용자 추가"
          fields={[
            { name: "name", label: "이름", type: "text" },
            { name: "email", label: "이메일 (로그인 아이디)", type: "email", autoComplete: "off" },
            { name: "role", label: "권한", type: "select", initial: "staff", options: ROLES.map((r) => ({ value: r.value, label: `${r.label} - ${r.desc}` })) },
            { name: "password", label: "처음 비밀번호 (8자 이상)", type: "password", autoComplete: "new-password" },
            { name: "password2", label: "처음 비밀번호 확인", type: "password", autoComplete: "new-password" },
          ]}
        />
      </section>

      <section className="card card-body mt-5 text-sm text-slate-600">
        <h2 className="mb-2 text-base font-semibold text-navy-900">권한 안내</h2>
        <ul className="space-y-1">
          {ROLES.map((r) => (
            <li key={r.value}><b className="text-slate-800">{r.label}</b>: {r.desc}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
