import { Nav } from "@/components/Nav";
import { requireAdmin } from "@/lib/auth";

const links = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/upload", label: "일정표 업로드" },
  { href: "/admin/dispatch", label: "배차" },
  { href: "/admin/vehicles", label: "차량" },
  { href: "/admin/drivers", label: "기사" },
  { href: "/admin/settlement", label: "정산·세무" },
  { href: "/admin/settings", label: "설정" },
  { href: "/admin/inquiries", label: "상담 신청" },
  { href: "/admin/cars", label: "홈페이지 차량" },
  { href: "/admin/events", label: "이벤트" },
  { href: "/admin/customers", label: "회원" },
  { href: "/admin/coupons", label: "쿠폰" },
  { href: "/admin/site", label: "홈페이지 설정" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  return (
    <>
      <Nav links={links} email={user.email ?? ""} title="렌트카 배차" />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </>
  );
}
