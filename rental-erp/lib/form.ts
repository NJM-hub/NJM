// 서버 동작에서 폼 값 읽기 + 검사
import { isISODate } from "@/lib/dates";
import { parseMoney } from "@/lib/format";

export class FormReader {
  errors: Record<string, string> = {};
  constructor(private fd: FormData) {}

  raw(k: string): string {
    return String(this.fd.get(k) ?? "").trim();
  }

  text(k: string, opts: { required?: string; max?: number } = {}): string | null {
    const v = this.raw(k);
    if (!v) {
      if (opts.required) this.errors[k] = opts.required;
      return null;
    }
    if (opts.max && v.length > opts.max) this.errors[k] = `${opts.max}자 이내로 입력하세요.`;
    return v;
  }

  money(k: string, opts: { required?: string; min?: number } = {}): number | null {
    const v = this.raw(k);
    if (!v) {
      if (opts.required) this.errors[k] = opts.required;
      return null;
    }
    const n = parseMoney(v);
    if (n == null) {
      this.errors[k] = "금액을 숫자로 입력하세요.";
      return null;
    }
    if (opts.min != null && n < opts.min) this.errors[k] = `${opts.min.toLocaleString()} 이상이어야 합니다.`;
    return n;
  }

  number(k: string, opts: { required?: string; min?: number; max?: number; int?: boolean } = {}): number | null {
    const v = this.raw(k).replace(/,/g, "");
    if (!v) {
      if (opts.required) this.errors[k] = opts.required;
      return null;
    }
    const n = Number(v);
    if (!Number.isFinite(n) || (opts.int && !Number.isInteger(n))) {
      this.errors[k] = "숫자를 입력하세요.";
      return null;
    }
    if (opts.min != null && n < opts.min) this.errors[k] = `${opts.min} 이상이어야 합니다.`;
    if (opts.max != null && n > opts.max) this.errors[k] = `${opts.max} 이하여야 합니다.`;
    return n;
  }

  date(k: string, opts: { required?: string } = {}): string | null {
    const v = this.raw(k);
    if (!v) {
      if (opts.required) this.errors[k] = opts.required;
      return null;
    }
    if (!isISODate(v)) {
      this.errors[k] = "날짜 형식이 올바르지 않습니다.";
      return null;
    }
    return v;
  }

  choice<T extends string>(k: string, allowed: readonly T[] | Record<T, string>, fallback?: NoInfer<T>): T | null {
    const list = (Array.isArray(allowed) ? allowed : Object.keys(allowed)) as T[];
    const v = this.raw(k) as T;
    if (list.includes(v)) return v;
    if (fallback !== undefined) return fallback;
    this.errors[k] = "선택하세요.";
    return null;
  }

  bool(k: string): boolean {
    const v = this.fd.get(k);
    return v === "on" || v === "true" || v === "1";
  }

  uuid(k: string, opts: { required?: string } = {}): string | null {
    const v = this.raw(k);
    if (!v) {
      if (opts.required) this.errors[k] = opts.required;
      return null;
    }
    if (!/^[0-9a-f-]{36}$/i.test(v)) {
      this.errors[k] = "잘못된 값입니다.";
      return null;
    }
    return v;
  }

  get ok() {
    return Object.keys(this.errors).length === 0;
  }

  fail() {
    return { fieldErrors: this.errors, error: "입력 내용을 확인하세요." };
  }
}

export function dbError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("violates foreign key")) return "연결된 다른 자료가 있어 처리할 수 없습니다. (예: 계약이 있는 호실·임차인)";
  if (msg.includes("duplicate key")) return "이미 같은 값이 등록되어 있습니다.";
  return `저장하지 못했습니다: ${msg}`;
}
