"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Cell } from "@/lib/kkday/parse";
import { findDispatchSheetHeader, parseDispatchSheet } from "@/lib/kkday/sheet";
import { fetchGoogleSheet } from "../upload/actions";
import { importSheetDispatch } from "./actions";

const URL_KEY = "dispatch-sheet-url";

/**
 * 배차 시트(구글 시트) 주소를 넣고 적용하면, 조회 중인 이용일의 탭을 찾아 그날 배차를 시트대로 만든다.
 * 확정하지 않고 초안으로 만들므로 확인한 뒤 배차 확정을 직접 누른다.
 */
export function SheetApply({ date }: { date: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  // 마지막으로 쓴 시트 주소를 기억해 둔다 (이 브라우저에서만)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(URL_KEY);
      if (saved && input.current && !input.current.value) input.current.value = saved;
    } catch {}
  }, []);

  function apply() {
    setMsg(null);
    start(async () => {
      const link = input.current?.value.trim() ?? "";
      if (!link) return setMsg({ ok: false, text: "구글 시트 주소를 넣어주세요." });
      try {
        localStorage.setItem(URL_KEY, link);
      } catch {}
      const res = await fetchGoogleSheet(link, true);
      if (!res.ok) return setMsg({ ok: false, text: res.error });
      let tabs: { name: string; data: Cell[][] }[];
      if ("rows" in res) tabs = [{ name: res.name, data: res.rows }];
      else {
        const { default: readXlsxFile } = await import("read-excel-file/browser");
        const bytes = Uint8Array.from(atob(res.xlsxBase64), (c) => c.charCodeAt(0));
        tabs = (await readXlsxFile(new Blob([bytes]))).map((x) => ({ name: x.sheet, data: x.data as Cell[][] }));
      }
      // 이용일 예약이 가장 많은 탭
      let best: { name: string; parsed: ReturnType<typeof parseDispatchSheet>; n: number } | null = null;
      for (const t of tabs) {
        const h = findDispatchSheetHeader(t.data);
        if (h < 0) continue;
        const parsed = parseDispatchSheet(t.data, h);
        const n = parsed.bookings.filter((b) => b.serviceDate === date).length;
        if (n && (!best || n > best.n)) best = { name: t.name, parsed, n };
      }
      if (!best) return setMsg({ ok: false, text: `시트에서 ${date} 이용일 탭을 찾지 못했습니다.` });
      const rows = [...best.parsed.bookings, ...best.parsed.ownCalls].filter((b) => b.serviceDate === date);
      const r = await importSheetDispatch(`${res.name} [${best.name}]`, rows, best.parsed.cancelled.map((x) => x.bookingNo), {
        confirm: false,
        reviews: best.parsed.reviews.filter((x) => x.date === date),
      });
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      setMsg({
        ok: true,
        text:
          `[${best.name}] 탭으로 초안을 만들었습니다: 예약 ${r.count}건, 차량 배차 ${r.assigned}건(자체 콜 ${r.ownCalls}건 포함) · 외부 ${r.external}건` +
          (r.unassigned ? ` · 미배정 ${r.unassigned}건` : "") +
          (r.unmatchedVehicles.length ? ` (차량 목록에 없는 시트 차량: ${r.unmatchedVehicles.join(", ")})` : "") +
          (r.review.total ? `. 굿리뷰 ${r.review.applied.length}건 +3,000원 적용` : "") +
          (r.review.notFound.length ? ` (예약을 못 찾은 굿리뷰: ${r.review.notFound.join(", ")})` : "") +
          (r.review.otherVehicle.length ? ` (다른 차량이 운행한 굿리뷰: ${r.review.otherVehicle.join(", ")})` : "") +
          ". 확인 후 아래에서 배차 확정을 눌러주세요.",
      });
      const runId = r.runIds[date];
      router.push(`/admin/dispatch?date=${date}${runId ? `&run=${runId}` : ""}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 border-t border-gray-100 pt-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-gray-700">배차 시트 적용</span>
        <input
          ref={input}
          type="url"
          placeholder="구글 시트 주소 (https://docs.google.com/spreadsheets/d/...)"
          className="input !w-[28rem] max-w-full"
        />
        <button type="button" className="btn" onClick={apply} disabled={pending}>
          {pending ? "적용 중..." : "적용"}
        </button>
      </div>
      <p className="text-xs text-gray-500">
        조회 중인 이용일({date})의 탭을 찾아 시트대로 배차 초안을 만듭니다. 확정은 하지 않으니 확인한 뒤 배차 확정을 눌러주세요.
        이미 확정된 배차가 있으면 새 초안을 확정할 때까지 그대로 유지됩니다.
      </p>
      {msg && <div className={msg.ok ? "text-green-700" : "text-red-600"}>{msg.text}</div>}
    </div>
  );
}
