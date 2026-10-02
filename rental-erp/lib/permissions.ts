// 권한: 관리자 > 직원 > 조회자

export const ROLES = { admin: "관리자", staff: "직원", viewer: "조회자" } as const;
export type Role = keyof typeof ROLES;

const RANK: Record<Role, number> = { viewer: 0, staff: 1, admin: 2 };

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && v in RANK;
}

export function atLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

export function roleLabel(r: Role): string {
  return ROLES[r];
}

/**
 * 관리자: 모든 정보 확인·수정 (부동산·대출·비용·사용자·설정·삭제)
 * 직원: 임대료·입금·계약·임차인·문서 업로드
 * 조회자: 보기만
 */
export function permissionsOf(role: Role) {
  return {
    editLeasing: atLeast(role, "staff"), // 계약·임차인·입금·청구·보증금·문서
    editAssets: atLeast(role, "admin"), // 부동산·호실·대출·비용·소유주
    admin: role === "admin", // 사용자·설정·삭제·엑셀 가져오기
  };
}
export type Permissions = ReturnType<typeof permissionsOf>;
