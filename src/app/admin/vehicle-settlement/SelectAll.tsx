"use client";

/** 같은 폼 안의 체크박스(name)를 한꺼번에 켜고 끈다 */
export function SelectAll({ name }: { name: string }) {
  return (
    <input
      type="checkbox"
      aria-label="전체 선택"
      onChange={(e) => {
        const form = e.currentTarget.form;
        form?.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name="${name}"]`).forEach((c) => (c.checked = e.currentTarget.checked));
      }}
    />
  );
}
