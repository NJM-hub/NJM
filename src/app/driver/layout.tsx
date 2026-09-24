import { Nav } from "@/components/Nav";
import { requireUser } from "@/lib/auth";

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requireUser();
  const links = [
    { href: "/driver", label: "내 배차" },
    { href: "/driver/profile", label: "내 정보" },
    ...(role === "admin" ? [{ href: "/admin", label: "관리자" }] : []),
  ];
  return (
    <>
      <Nav links={links} email={user.email ?? ""} title="렌트카 기사" />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </>
  );
}
