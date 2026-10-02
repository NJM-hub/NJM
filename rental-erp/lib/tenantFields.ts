import type { Field } from "@/components/Form";

export const tenantFields = (edit: boolean): Field[] => [
  ...(edit ? [{ name: "id", type: "hidden" } as Field] : []),
  { name: "name", label: "이름 / 상호", required: true },
  { name: "phone", label: "연락처", type: "tel" },
  { name: "biz_no", label: "사업자등록번호" },
  { name: "email", label: "이메일", type: "email" },
  { name: "memo", label: "메모", type: "textarea" },
];
