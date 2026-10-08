import { Nav } from "@/components/Nav";
import { requireAdmin } from "@/lib/auth";

const links = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/upload", label: "일정표 업로드" },
  { href: "/admin/dispatch", label: "배차" },
  { href: "/admin/vehicles", label: "차량" },
  { href: "/admin/drivers", label: "기사" },
  { href: "/admin/vehicle-settlement", label: "차량별 월정산" },
  { href: "/admin/external-calls", label: "외부 콜" },
  { href: "/admin/settlement", label: "정산·세무" },
  { href: "/admin/settings", label: "설정" },
  { href: "/admin/staff", label: "직원" },
];

/** 직원(배차·차량 관리)에게는 보이지 않는 관리자 전용 메뉴 */
const OWNER_ONLY = new Set(["/admin/vehicle-settlement", "/admin/settlement", "/admin/settings", "/admin/staff"]);

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requireAdmin();
  const visible = role === "admin" ? links : links.filter((l) => !OWNER_ONLY.has(l.href));
  return (
    <>
      <Nav links={visible} email={user.email ?? ""} title="(주)우정렌트카 공항 샌딩 픽업" />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </>
  );
}
