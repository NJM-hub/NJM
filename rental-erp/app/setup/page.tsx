import { redirect } from "next/navigation";
import { setupAdminAction } from "@/app/actions/auth";
import AuthCard from "@/components/AuthCard";
import SmartForm from "@/components/Form";
import SetupNotice from "@/components/SetupNotice";
import { q1, schemaReady } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const ready = await schemaReady();
  if (!ready.ok) {
    return (
      <AuthCard title="처음 설치">
        <SetupNotice error={ready.error} />
      </AuthCard>
    );
  }
  const n = await q1<{ n: number }>("select count(*)::int as n from users");
  if ((n?.n ?? 0) > 0) redirect("/login");
  return (
    <AuthCard title="처음 설정" subtitle="대표자(관리자) 계정을 만듭니다.">
      <SmartForm
        action={setupAdminAction}
        cols={2}
        submitLabel="관리자 계정 만들기"
        sections={[
          {
            fields: [
              { name: "setup_password", label: "설치 비밀번호", type: "password", hint: "Vercel 환경변수 SETUP_PASSWORD 값 (본인 확인용)", span: 2 },
              { name: "name", label: "이름", required: true, span: 2 },
              { name: "email", label: "로그인 이메일", type: "email", required: true, span: 2, hint: "로그인 아이디로만 씁니다" },
              { name: "password", label: "비밀번호 (8자 이상)", type: "password", required: true, span: 2 },
              { name: "password2", label: "비밀번호 확인", type: "password", required: true, span: 2 },
            ],
          },
        ]}
      />
    </AuthCard>
  );
}
