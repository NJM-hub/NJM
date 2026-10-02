import { NextResponse } from "next/server";
import writeXlsxFile from "write-excel-file/node";
import { getCurrentUser } from "@/lib/auth";
import { getSnapshot } from "@/lib/data";
import { buildSheets, EXPORT_KINDS, type ExportKind } from "@/lib/excel";

const MONEY = "#,##0";

/** 엑셀 다운로드 (현재 보기 범위 기준) */
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { kind } = await params;
  if (!(kind in EXPORT_KINDS)) return NextResponse.json({ error: "없는 항목" }, { status: 404 });
  const { ds, snap } = await getSnapshot();
  const sheets = buildSheets(kind as ExportKind, ds, snap).map((s) => ({
    sheet: s.name,
    stickyRowsCount: 1,
    columns: s.cols.map((c) => ({ width: c.width ?? 12 })),
    data: [
      s.cols.map((c) => ({ value: c.title, fontWeight: "bold" as const })),
      ...s.rows.map((r) =>
        r.map((v, i) => {
          if (v === null || v === undefined || v === "") return { value: null };
          const t = s.cols[i]?.type;
          if (typeof v === "number") return { value: v, type: Number, format: t === "money" ? MONEY : t === "pct" ? "0.00" : undefined };
          return { value: String(v), type: String };
        }),
      ),
    ],
  }));
  const buf = await writeXlsxFile(sheets as never).toBuffer();
  const name = `${EXPORT_KINDS[kind as ExportKind]}_${snap.today}.xlsx`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
