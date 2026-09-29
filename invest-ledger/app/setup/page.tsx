import Link from "next/link";
import { redirect } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import MigrationNotice from "@/components/MigrationNotice";
import SetupForm from "@/components/SetupForm";
import { setupAdminAction } from "@/app/login/actions";
import { setupState } from "@/lib/setupState";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const s = await setupState();
  if (s.migrated && s.userCount > 0) redirect("/login");

  return (
    <AuthCard title="처음 설정: 관리자 계정 만들기" subtitle="딱 한 번만 하면 됩니다. 이후에는 이 계정으로 로그인합니다.">
      {s.error ? (
        <p className="text-sm text-red-700">DB 연결 오류: {s.error}</p>
      ) : !s.migrated ? (
        <MigrationNotice />
      ) : (
        <>
          <SetupForm action={setupAdminAction} />
          <p className="mt-4 text-center text-xs text-slate-400">
            이미 계정이 있나요? <Link href="/login" className="underline">로그인</Link>
          </p>
        </>
      )}
    </AuthCard>
  );
}
