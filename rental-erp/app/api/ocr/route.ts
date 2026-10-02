import { NextResponse } from "next/server";
import { aiEnabled, extractContract } from "@/lib/ai";
import { authorize } from "@/lib/auth";
import { audit, q, q1 } from "@/lib/db";
import { phoneDigits } from "@/lib/format";
import { readUpload } from "@/lib/upload";

export const maxDuration = 120;

/** 임대차계약서 업로드 → 원본은 문서로 저장 → AI 로 계약 정보 추출 → 기존 호실·임차인 자동 매칭 */
export async function POST(req: Request) {
  const a = await authorize("staff");
  if ("denied" in a) return NextResponse.json({ error: a.denied.error }, { status: 403 });
  const fd = await req.formData();
  const up = await readUpload(fd.get("file"));
  if ("error" in up) return NextResponse.json(up, { status: 400 });

  const doc = await q1<{ id: string }>(
    "insert into documents (category, title, file_name, mime_type, size_bytes, data, uploaded_by) values ('lease', '임대차계약서', $1, $2, $3, $4, $5) returning id",
    [up.name, up.mime, up.bytes.length, up.bytes, a.user.id],
  );
  if (!aiEnabled()) {
    return NextResponse.json(
      { documentId: doc!.id, error: "AI 키(ANTHROPIC_API_KEY)가 설정되지 않아 자동 추출을 건너뛰었습니다. 계약서는 저장되었으니 아래에 직접 입력해 주세요." },
      { status: 200 },
    );
  }
  try {
    const x = await extractContract({ mime: up.mime, base64: up.bytes.toString("base64") });
    // 기존 임차인 찾기 (이름 또는 연락처)
    const digits = phoneDigits(x.tenant_phone);
    const tenant = x.tenant_name
      ? await q1<{ id: string }>(
          "select id from tenants where name = $1 or ($2 <> '' and regexp_replace(coalesce(phone,''), '\\D', '', 'g') = $2) order by (name = $1) desc limit 1",
          [x.tenant_name.trim(), digits],
        )
      : null;
    // 호실 찾기: 호실 번호가 같고 주소/건물명이 겹치는 것
    let unitId: string | null = null;
    if (x.unit_no) {
      const no = x.unit_no.replace(/\s/g, "");
      const cands = await q<{ id: string; address: string | null; building_name: string | null; name: string }>(
        `select u.id, p.address, p.building_name, p.name from units u join properties p on p.id = u.property_id
         where u.is_active and replace(u.unit_no, ' ', '') in ($1, $2)`,
        [no, no.endsWith("호") ? no.slice(0, -1) : `${no}호`],
      );
      const hay = `${x.address ?? ""} ${x.property_description ?? ""}`;
      const score = (c: { address: string | null; building_name: string | null; name: string }) =>
        [c.building_name, c.name, ...(c.address ?? "").split(/\s+/).slice(1, 4)].filter((t) => t && t.length > 1 && hay.includes(t)).length;
      const best = cands.sort((p1, p2) => score(p2) - score(p1))[0];
      if (best && (cands.length === 1 || score(best) > 0)) unitId = best.id;
    }
    await q("update documents set tenant_id = $2 where id = $1", [doc!.id, tenant?.id ?? null]);
    await audit(a.user.id, "ocr", "document", doc!.id, { tenant: x.tenant_name, unit: x.unit_no });
    return NextResponse.json({ documentId: doc!.id, extraction: x, match: { tenant_id: tenant?.id ?? null, unit_id: unitId } });
  } catch (e) {
    return NextResponse.json({ documentId: doc!.id, error: `AI 추출 실패: ${e instanceof Error ? e.message : String(e)} — 계약서는 저장되었으니 직접 입력해 주세요.` });
  }
}
