import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import AuthCard from "@/components/AuthCard";
import LoginForm from "@/components/LoginForm";
import SetupNotice from "@/components/SetupNotice";
import { getCurrentUser } from "@/lib/auth";
import { q1, schemaReady } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const ready = await schemaReady();
  if (!ready.ok) {
    return (
      <AuthCard title="처음 설치">
        <SetupNotice error={ready.error} />
      </AuthCard>
    );
  }
  if (await getCurrentUser()) redirect("/");
  const n = await q1<{ n: number }>("select count(*)::int as n from users");
  if ((n?.n ?? 0) === 0) redirect("/setup");
  return (
    <AuthCard title="로그인">
      <LoginForm action={loginAction} next={next ?? "/"} />
    </AuthCard>
  );
}
