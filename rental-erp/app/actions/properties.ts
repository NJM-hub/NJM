"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/auth";
import { PROPERTY_TYPES } from "@/lib/constants";
import { audit, q, q1 } from "@/lib/db";
import { dbError, FormReader } from "@/lib/form";
import type { FormState } from "@/lib/types";

function readProperty(f: FormReader) {
  return {
    owner_id: f.uuid("owner_id"),
    name: f.text("name", { required: "부동산명을 입력하세요.", max: 100 }),
    address: f.text("address"),
    building_name: f.text("building_name"),
    property_type: f.choice("property_type", PROPERTY_TYPES, "etc"),
    purchase_date: f.date("purchase_date"),
    purchase_price: f.money("purchase_price", { min: 0 }) ?? 0,
    current_value: f.money("current_value", { min: 0 }),
    acquisition_cost: f.money("acquisition_cost", { min: 0 }) ?? 0,
    remodeling_cost: f.money("remodeling_cost", { min: 0 }) ?? 0,
    other_investment: f.money("other_investment", { min: 0 }) ?? 0,
    memo: f.text("memo"),
  };
}

export async function createPropertyAction(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const f = new FormReader(fd);
  const v = readProperty(f);
  // 호실을 한 번에: "101호, 102호, 201호" 또는 "101~105"
  const unitsText = f.raw("units");
  const unitNos = expandUnits(unitsText);
  const expectedRent = f.money("unit_rent", { min: 0 }) ?? 0;
  const expectedDeposit = f.money("unit_deposit", { min: 0 }) ?? 0;
  if (!f.ok) return f.fail();
  let id: string;
  try {
    const row = await q1<{ id: string }>(
      `insert into properties (owner_id, name, address, building_name, property_type, purchase_date, purchase_price, current_value,
        acquisition_cost, remodeling_cost, other_investment, memo) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
      Object.values(v),
    );
    id = row!.id;
    const list = unitNos.length ? unitNos : ["전체"];
    for (const u of list) {
      await q("insert into units (property_id, unit_no, floor, expected_rent, expected_deposit, vacant_since) values ($1,$2,$3,$4,$5,current_date)", [
        id,
        u,
        guessFloor(u),
        expectedRent,
        expectedDeposit,
      ]);
    }
    await audit(a.user.id, "create", "property", id, { name: v.name, units: list.length });
  } catch (e) {
    return { error: dbError(e) };
  }
  revalidatePath("/", "layout");
  redirect(`/properties/${id}?saved=1`);
}

export async function updatePropertyAction(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const f = new FormReader(fd);
  const id = f.uuid("id", { required: "잘못된 요청" });
  const v = readProperty(f);
  const active = !f.bool("archived");
  if (!f.ok) return f.fail();
  try {
    await q(
      `update properties set owner_id=$1, name=$2, address=$3, building_name=$4, property_type=$5, purchase_date=$6, purchase_price=$7,
        current_value=$8, acquisition_cost=$9, remodeling_cost=$10, other_investment=$11, memo=$12, is_active=$13, updated_at=now() where id=$14`,
      [...Object.values(v), active, id],
    );
    await audit(a.user.id, "update", "property", id, v);
  } catch (e) {
    return { error: dbError(e) };
  }
  revalidatePath("/", "layout");
  redirect(`/properties/${id}?saved=1`);
}

export async function deletePropertyAction(id: string): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const used = await q1<{ n: number }>(
    "select count(*)::int as n from contracts c join units u on u.id = c.unit_id where u.property_id = $1",
    [id],
  );
  if ((used?.n ?? 0) > 0) return { error: "계약 기록이 있는 부동산은 삭제할 수 없습니다. 수정 화면에서 '매각/정리'로 바꾸세요." };
  await q("delete from properties where id = $1", [id]);
  await audit(a.user.id, "delete", "property", id);
  revalidatePath("/", "layout");
  redirect("/properties");
}

export async function saveUnitAction(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const f = new FormReader(fd);
  const id = f.uuid("id");
  const propertyId = f.uuid("property_id", { required: "잘못된 요청" });
  const vals = [
    f.text("dong"),
    f.text("floor"),
    f.text("unit_no", { required: "호실을 입력하세요." }),
    f.number("area_m2", { min: 0 }),
    f.money("expected_deposit", { min: 0 }) ?? 0,
    f.money("expected_rent", { min: 0 }) ?? 0,
    f.date("vacant_since"),
    f.text("memo"),
  ];
  if (!f.ok) return f.fail();
  try {
    if (id) {
      await q(
        "update units set dong=$1, floor=$2, unit_no=$3, area_m2=$4, expected_deposit=$5, expected_rent=$6, vacant_since=$7, memo=$8, is_active=$9 where id=$10",
        [...vals, !f.bool("inactive"), id],
      );
    } else {
      await q(
        "insert into units (dong, floor, unit_no, area_m2, expected_deposit, expected_rent, vacant_since, memo, property_id) values ($1,$2,$3,$4,$5,$6,coalesce($7, current_date),$8,$9)",
        [...vals, propertyId],
      );
    }
    await audit(a.user.id, id ? "update" : "create", "unit", id, { propertyId, unit_no: vals[2] });
  } catch (e) {
    return { error: dbError(e) };
  }
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/");
  return { ok: id ? "호실 정보를 저장했습니다." : "호실을 추가했습니다." };
}

export async function deleteUnitAction(id: string): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  try {
    const u = await q1<{ property_id: string }>("delete from units where id = $1 returning property_id", [id]);
    await audit(a.user.id, "delete", "unit", id);
    if (u) revalidatePath(`/properties/${u.property_id}`);
  } catch (e) {
    return { error: dbError(e) };
  }
  return { ok: "삭제했습니다." };
}

/** "101~105" → 101호..105호, "101호, B01" → 그대로 */
function expandUnits(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)\s*[~-]\s*(\d+)\s*(호)?$/);
    if (m && Number(m[2]) >= Number(m[1]) && Number(m[2]) - Number(m[1]) < 200) {
      for (let i = Number(m[1]); i <= Number(m[2]); i++) out.push(`${i}호`);
    } else out.push(/^\d+$/.test(part) ? `${part}호` : part);
  }
  return [...new Set(out)];
}

function guessFloor(unitNo: string): string | null {
  const m = unitNo.match(/^(\d+)(\d{2})호$/);
  if (m) return `${m[1]}층`;
  const f = unitNo.match(/^(\d+)층$/);
  return f ? unitNo : null;
}
