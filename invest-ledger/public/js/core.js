// 공통 유틸: 안전한 HTML 템플릿, API, 기준일 상태, 모달, 토스트, 포맷

class Raw {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}
export const raw = (s) => new Raw(s);
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
const val = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(val).join("") : v === null || v === undefined || v === false ? "" : esc(v));
export function html(strings, ...vals) {
  let out = "";
  strings.forEach((s, i) => {
    out += s + (i < vals.length ? val(vals[i]) : "");
  });
  return new Raw(out);
}

// ---------- 포맷 ----------
const nf = new Intl.NumberFormat("ko-KR");
export const num = (n) => nf.format(Math.round(n ?? 0));
export const won = (n) => `₩${nf.format(Math.round(n ?? 0))}`;
export const wonK = (n) => `${nf.format(Math.round(n ?? 0))}원`;
export function short(n) {
  const a = Math.abs(n);
  if (a >= 1e8) return `${+(n / 1e8).toFixed(2)}억`;
  if (a >= 1e4) return `${nf.format(Math.round(n / 1e4))}만`;
  return nf.format(n);
}
export const pct = (n) => `${(n ?? 0).toFixed(1).replace(/\.0$/, "")}%`;
export const md = (d) => (d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : "");
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
export const dow = (d) => DOW[new Date(d + "T00:00:00Z").getUTCDay()];
export const dfull = (d) => (d ? `${d} (${dow(d)})` : "");

export function addDays(s, n) {
  const t = new Date(s + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export const STATUS_LEVEL = { 완납: "paidoff", 연체: "overdue", 일부입금: "partial", 지연: "delay", 정상: "normal", 실행전: "future", "-": "future" };
export const chip = (label, level) => html`<span class="chip s-${level ?? STATUS_LEVEL[label] ?? "future"}">${label}</span>`;
export const statusChip = (s) => chip(s, STATUS_LEVEL[s]);
export const expiryChip = (e) =>
  html`<span class="chip s-${e.level}" title="만료까지 ${e.daysLeft}일">${e.label}${e.level !== "paidoff" ? html` ${e.daysLeft >= 0 ? `D-${e.daysLeft}` : `D+${-e.daysLeft}`}` : ""}</span>`;
export const bar = (p, cls = "") => html`<div class="bar ${cls}"><span style="width:${Math.max(0, Math.min(100, p))}%"></span></div>`;

// ---------- 기준일 ----------
const listeners = new Set();
export const state = { today: null, asOf: null, user: null, meta: null };
try {
  const saved = sessionStorage.getItem("asOf");
  if (saved) state.asOf = saved;
} catch {}
export const asOf = () => state.asOf || state.today;
export const isCustomAsOf = () => !!state.asOf && state.asOf !== state.today;
export function setAsOf(d) {
  state.asOf = d && d !== state.today ? d : null;
  try {
    if (state.asOf) sessionStorage.setItem("asOf", state.asOf);
    else sessionStorage.removeItem("asOf");
  } catch {}
  listeners.forEach((f) => f());
}
export const onAsOf = (f) => listeners.add(f);

// ---------- API ----------
export class ApiError extends Error {}
export async function api(path, { method = "GET", body, query, raw: rawBody } = {}) {
  const q = new URLSearchParams(query ?? {});
  if (method === "GET" && !q.has("asOf") && state.today) q.set("asOf", asOf());
  const url = `/api${path}${q.toString() ? `?${q}` : ""}`;
  const headers = { "x-ledger": "1" };
  let payload;
  if (rawBody) {
    headers["content-type"] = "application/octet-stream";
    payload = rawBody;
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method, headers, body: payload, credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/login" && path !== "/session") {
    location.hash = "#/login";
    throw new ApiError("로그인이 필요합니다.");
  }
  if (!res.ok) throw new ApiError(data.error || `오류 (${res.status})`);
  return data;
}
export function downloadUrl(path, query = {}) {
  const q = new URLSearchParams({ asOf: asOf(), ...query });
  return `/api${path}?${q}`;
}

// ---------- 토스트 / 모달 ----------
export function toast(msg, isErr = false) {
  const root = document.getElementById("toast-root");
  if (!root.firstChild) root.innerHTML = '<div class="toast-wrap"></div>';
  const el = document.createElement("div");
  el.className = `toast${isErr ? " err" : ""}`;
  el.textContent = msg;
  root.firstChild.appendChild(el);
  setTimeout(() => el.remove(), isErr ? 4500 : 2500);
}

// 모달: onSubmit(form) 이 true/undefined 를 반환하면 닫힘
export function modal({ title, body, submitLabel = "저장", danger = false, wide = false, onSubmit, onOpen, cancelLabel = "취소" }) {
  const root = document.getElementById("modal-root");
  root.innerHTML = html`<div class="modal-back">
    <form class="modal ${wide ? "wide" : ""}" novalidate>
      <header>${title}</header>
      <div class="body">${body}</div>
      <footer>
        <button type="button" class="btn" data-close>${cancelLabel}</button>
        ${onSubmit ? html`<button type="submit" class="btn ${danger ? "danger" : "primary"}">${submitLabel}</button>` : ""}
      </footer>
    </form>
  </div>`.s;
  const back = root.firstChild;
  const form = back.querySelector("form");
  const close = () => (root.innerHTML = "");
  back.addEventListener("mousedown", (e) => e.target === back && close());
  form.querySelector("[data-close]").addEventListener("click", close);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const r = await onSubmit(form);
      if (r !== false) close();
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });
  const first = form.querySelector("input:not([type=hidden]),select,textarea");
  first?.focus();
  onOpen?.(form);
  return { close, form };
}

export function confirmBox(title, message, { danger = true, confirmLabel = "확인" } = {}) {
  return new Promise((resolve) => {
    let ok = false;
    const m = modal({
      title,
      body: html`<p style="white-space:pre-line;margin:4px 0 8px">${message}</p>`,
      submitLabel: confirmLabel,
      danger,
      onSubmit: () => {
        ok = true;
      },
    });
    const obs = new MutationObserver(() => {
      if (!document.body.contains(m.form)) {
        obs.disconnect();
        resolve(ok);
      }
    });
    obs.observe(document.getElementById("modal-root"), { childList: true });
  });
}

// 금액 입력칸: 입력 중 천 단위 콤마
export function bindMoneyInputs(root) {
  root.querySelectorAll("input.money").forEach((el) => {
    el.addEventListener("input", () => {
      const pos = el.value.length - el.selectionStart;
      const digits = el.value.replace(/[^\d]/g, "");
      el.value = digits ? nf.format(Number(digits)) : "";
      const p = Math.max(0, el.value.length - pos);
      el.setSelectionRange(p, p);
    });
  });
}
export const moneyVal = (s) => {
  const d = String(s ?? "").replace(/[^\d]/g, "");
  return d ? Number(d) : null;
};

export function formData(form) {
  const o = {};
  for (const [k, v] of new FormData(form).entries()) o[k] = typeof v === "string" ? v.trim() : v;
  return o;
}

// ---------- 차트 ----------
const charts = new Map();
export function chart(id, config) {
  const el = document.getElementById(id);
  if (!el || !window.Chart) return;
  charts.get(id)?.destroy();
  charts.set(id, new window.Chart(el, config));
}
export function destroyCharts() {
  for (const c of charts.values()) c.destroy();
  charts.clear();
}
export const moneyTick = (v) => short(v);
