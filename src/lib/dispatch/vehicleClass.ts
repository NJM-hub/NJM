/** "이코노미 7인승" / "컴포트9인승" / "10인승" → 등급과 좌석 수 */
export function parseVehicleClass(s: string | null | undefined): { grade: string | null; seats: number | null } {
  if (!s) return { grade: null, seats: null };
  const seats = s.match(/(\d+)\s*인승/);
  const grade = s.replace(/\d+\s*인승/, "").replace(/\s+/g, "").trim();
  return { grade: grade || null, seats: seats ? Number(seats[1]) : null };
}

/** 하위 등급(이코노미)은 어떤 차로도 가능, 상위 등급(컴포트 등)은 같은 등급 차량만 */
export const BASIC_GRADES = ["이코노미", "economy", "일반", "스탠다드", "standard"];

export function gradeRequired(bookingGrade: string | null): string | null {
  if (!bookingGrade) return null;
  return BASIC_GRADES.includes(bookingGrade.toLowerCase()) ? null : bookingGrade;
}
