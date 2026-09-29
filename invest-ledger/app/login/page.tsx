import { redirect } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import LoginForm from "@/components/LoginForm";
import MigrationNotice from "@/components/MigrationNotice";
import { loginAction } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/auth";
import { setupState } from "@/lib/setupState";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, user, s] = await Promise.all([searchParams, getCurrentUser(), setupState()]);
  if (user) redirect("/");
  if (s.migrated && !s.error && s.userCount === 0) redirect("/setup");

  return (
    <AuthCard title="로그인">
      {s.error ? (
        <p className="text-sm text-red-700">DB 연결 오류: {s.error}</p>
      ) : !s.migrated ? (
        <MigrationNotice />
      ) : (
        <LoginForm action={loginAction} next={next ?? "/"} />
      )}
    </AuthCard>
  );
}
