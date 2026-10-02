import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { audit, q1 } from "@/lib/db";
import { readUpload } from "@/lib/upload";

const uuid = (v: FormDataEntryValue | null) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

/** 문서 올리기 (직원 이상) */
export async function POST(req: Request) {
  const a = await authorize("staff");
  if ("denied" in a) return NextResponse.json({ error: a.denied.error }, { status: 403 });
  const fd = await req.formData();
  const up = await readUpload(fd.get("file"));
  if ("error" in up) return NextResponse.json(up, { status: 400 });
  const category = String(fd.get("category") ?? "etc");
  let propertyId = uuid(fd.get("property_id"));
  const contractId = uuid(fd.get("contract_id"));
  // 계약 문서는 그 계약의 부동산에도 함께 보이도록
  if (!propertyId && contractId) {
    const r = await q1<{ property_id: string }>("select u.property_id from contracts c join units u on u.id = c.unit_id where c.id = $1", [contractId]);
    propertyId = r?.property_id ?? null;
  }
  const row = await q1<{ id: string }>(
    `insert into documents (property_id, unit_id, contract_id, tenant_id, loan_id, category, title, file_name, mime_type, size_bytes, data, uploaded_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
    [
      propertyId,
      uuid(fd.get("unit_id")),
      contractId,
      uuid(fd.get("tenant_id")),
      uuid(fd.get("loan_id")),
      category in DOCUMENT_CATEGORIES ? category : "etc",
      String(fd.get("title") ?? "").trim().slice(0, 200) || null,
      up.name,
      up.mime,
      up.bytes.length,
      up.bytes,
      a.user.id,
    ],
  );
  await audit(a.user.id, "upload", "document", row!.id, { name: up.name, category });
  return NextResponse.json({ id: row!.id });
}
