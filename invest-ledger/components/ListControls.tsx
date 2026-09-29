"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/** 검색어 + 정렬 선택. 주소(URL)에 저장되므로 새로고침·뒤로가기에도 유지된다 */
export default function ListControls({
  placeholder,
  sorts,
}: {
  placeholder: string;
  sorts?: readonly { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // 입력을 멈추고 0.3초 뒤 검색
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => update({ q: q.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const sort = params.get("sort") ?? sorts?.[0]?.value ?? "";
  const dir = params.get("dir") === "asc" ? "asc" : "desc";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">⌕</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="input pl-8"
          aria-label="검색"
        />
        {pending && <span className="absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">검색 중…</span>}
      </div>
      {sorts && (
        <div className="flex gap-2">
          <select value={sort} onChange={(e) => update({ sort: e.target.value })} className="input sm:w-40" aria-label="정렬 기준">
            {sorts.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button type="button" onClick={() => update({ dir: dir === "asc" ? "desc" : "asc" })}
            className="btn-secondary whitespace-nowrap" aria-label="정렬 방향 바꾸기">
            {dir === "asc" ? "↑ 오름차순" : "↓ 내림차순"}
          </button>
        </div>
      )}
    </div>
  );
}
