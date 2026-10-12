import { gzipSync } from "node:zlib";
import { NextResponse, type NextRequest } from "next/server";
import writeXlsxFile, { type Sheet, type SheetData } from "write-excel-file/node";
import { getSession } from "@/lib/auth";
import { BACKUP_TABLES, dumpTable } from "@/lib/backup";
import { todayKst } from "@/lib/format";

export const maxDuration = 300;

const HEAD = { fontWeight: "bold" as const, backgroundColor: "#E5E7EB" };
/** 엑셀 한 칸 최대 글자 수 */
const MAX_CELL = 32000;

function cell(v: unknown) {
  if (v == null) return null;
  if (typeof v === "number") return { value: v };
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return { value: s.length > MAX_CELL ? s.slice(0, MAX_CELL) : s };
}

function sheetOf(label: string, rows: Record<string, unknown>[]): Sheet<never> {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const data: SheetData = [
    (cols.length ? cols : ["(비어 있음)"]).map((c) => ({ value: c, ...HEAD })),
    ...rows.map((r) => cols.map((c) => cell(r[c]))),
  ];
  return { data, sheet: label.slice(0, 31), columns: cols.map(() => ({ width: 16 })) };
}

export async function GET(request: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "admin") return new NextResponse("권한이 없습니다.", { status: 403 });
  const format = request.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "json";

  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of BACKUP_TABLES) tables[t.name] = await dumpTable(s.supabase, t.name);
  const stamp = todayKst();

  if (format === "json") {
    // 서버 응답 크기 한도(4.5MB)를 넘지 않게 압축해서 보낸다 (브라우저가 풀어서 .json으로 저장)
    const body = gzipSync(JSON.stringify({ app: "njm-rentcar", createdAt: new Date().toISOString(), tables }));
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Encoding": "gzip",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`백업_${stamp}.json`)}`,
        "Cache-Control": "no-store",
      },
    });
  }

  const sheets = BACKUP_TABLES.map((t) => sheetOf(t.label, tables[t.name]));
  const buf = (await writeXlsxFile(sheets).toBuffer()) as Buffer;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`백업_${stamp}.xlsx`)}`,
      "Cache-Control": "no-store",
    },
  });
}
