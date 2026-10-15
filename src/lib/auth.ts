import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * admin: 관리자, staff: 승인된 배차·차량 관리 직원, manager: 승인된 관리자 회원(정산은 보기만),
 * staff_pending / manager_pending: 승인 대기, driver: 기사
 */
export type Role = "admin" | "staff" | "staff_pending" | "manager" | "manager_pending" | "driver";

/** 관리 화면(일정·배차·차량·기사·외부 콜)을 쓸 수 있는 역할 */
export const isManager = (role: Role) => role === "admin" || role === "staff" || role === "manager";
/** 정산 화면(기사 지급표·차량별 월정산·정산·세무)을 볼 수 있는 역할. 수정은 admin 만 */
export const canViewSettlement = (role: Role) => role === "admin" || role === "manager";

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return { supabase, user, role: (profile?.role ?? "driver") as Role };
}

export async function requireUser() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/** 역할별 첫 화면 */
export function homeOf(role: Role): string {
  return isManager(role) ? "/admin" : role === "staff_pending" || role === "manager_pending" ? "/pending" : "/driver";
}

/** 관리 화면: 관리자 또는 승인된 직원 */
export async function requireAdmin() {
  const s = await requireUser();
  if (!isManager(s.role)) redirect(homeOf(s.role));
  return s;
}

/** 관리자 전용 화면 (차량별 월정산·정산·세무·설정·직원 승인) */
export async function requireOwner() {
  const s = await requireUser();
  if (s.role !== "admin") redirect(homeOf(s.role));
  return s;
}

/** 정산 화면 보기: 관리자 또는 관리자 회원 (readOnly 면 수정 화면 대신 보기만) */
export async function requireViewer() {
  const s = await requireUser();
  if (!canViewSettlement(s.role)) redirect(homeOf(s.role));
  return { ...s, readOnly: s.role !== "admin" };
}

/** 서버 액션용 (기사 명단·지급표 비고·기사 주민번호 열람): 관리자 + 관리자 회원 */
export async function assertDriverManager() {
  const s = await getSession();
  if (!s || !canViewSettlement(s.role)) throw new Error("관리자 권한이 필요합니다.");
  return s;
}

/** 서버 액션용 (관리 화면): 리다이렉트 대신 에러 */
export async function assertAdmin() {
  const s = await getSession();
  if (!s || !isManager(s.role)) throw new Error("관리자 또는 직원 권한이 필요합니다.");
  return s;
}

/** 서버 액션용 (관리자 전용) */
export async function assertOwner() {
  const s = await getSession();
  if (!s || s.role !== "admin") throw new Error("관리자 권한이 필요합니다.");
  return s;
}
