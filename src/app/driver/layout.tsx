import { Nav } from "@/components/Nav";
import { redirect } from "next/navigation";
import { isManager, requireUser } from "@/lib/auth";

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requireUser();
  if (role === "staff_pending") redirect("/pending");
  const links = [
    { href: "/driver", label: "내 배차" },
    { href: "/driver/profile", label: "내 정보" },
    ...(isManager(role) ? [{ href: "/admin", label: "관리자" }] : []),
  ];
  return (
    <>
      <Nav links={links} email={user.email ?? ""} title="(주)우정렌트카 공항 샌딩 픽업" />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </>
  );
}
