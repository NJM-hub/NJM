// 권한: 관리자(admin) > 직원(staff) > 조회전용(viewer)

export const ROLES = [
  { value: "admin", label: "관리자", desc: "모든 기능 + 사용자 관리 + 취소·무효 처리" },
  { value: "staff", label: "직원", desc: "투자 등록·수정, 입금 기록, 고객 수정 (취소·무효·사용자 관리는 불가)" },
  { value: "viewer", label: "조회전용", desc: "보기만 가능" },
] as const;
export type Role = (typeof ROLES)[number]["value"];

const RANK: Record<Role, number> = { viewer: 0, staff: 1, admin: 2 };

export function isRole(v: string): v is Role {
  return v in RANK;
}

export function roleLabel(r: string): string {
  return ROLES.find((x) => x.value === r)?.label ?? r;
}

export function atLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

/** 화면에서 버튼을 보여줄지 정할 때 쓰는 권한 묶음 */
export function permissionsOf(role: Role) {
  return {
    /** 등록·수정·입금 기록 */
    edit: atLeast(role, "staff"),
    /** 취소·무효·계획 재생성·고객 미사용 */
    cancel: role === "admin",
    /** 사용자 관리 */
    manageUsers: role === "admin",
  };
}
export type Permissions = ReturnType<typeof permissionsOf>;
