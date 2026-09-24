import { html, api, state, asOf, setAsOf, onAsOf, isCustomAsOf, toast, destroyCharts, dfull } from "./js/core.js";
import { dashboardView } from "./js/dashboard.js";
import { listView, formView, detailView } from "./js/investments.js";
import { customersView, customerView, companiesView, companyView } from "./js/people.js";
import { calendarView } from "./js/calendar.js";
import { monthlyView, dailyView } from "./js/stats.js";
import { excelView } from "./js/excel.js";
import { settingsView } from "./js/settings.js";

const NAV = [
  ["#/", "▦", "대시보드"],
  ["#/daily", "◷", "날짜별 회수현황"],
  ["#/investments", "☰", "투자 목록"],
  ["#/new", "＋", "투자 등록"],
  ["#/calendar", "▤", "회수 캘린더"],
  ["#/customers", "👤", "고객"],
  ["#/companies", "🏢", "투자처"],
  ["#/monthly", "▥", "월별 통계"],
  ["#/excel", "⇅", "엑셀"],
  ["#/settings", "⚙", "설정·보안"],
];

const ROUTES = [
  [/^\/?$/, dashboardView],
  [/^\/daily$/, dailyView],
  [/^\/investments$/, listView],
  [/^\/new$/, formView],
  [/^\/investments\/(\d+)$/, detailView],
  [/^\/investments\/(\d+)\/edit$/, formView],
  [/^\/customers$/, customersView],
  [/^\/customers\/(\d+)$/, customerView],
  [/^\/companies$/, companiesView],
  [/^\/companies\/(\d+)$/, companyView],
  [/^\/calendar$/, calendarView],
  [/^\/monthly$/, monthlyView],
  [/^\/excel$/, excelView],
  [/^\/settings$/, settingsView],
];

const app = document.getElementById("app");
const LOGO = html`<svg width="26" height="26" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#1c4a7d"/><path d="M7 22l6-7 5 4 7-9" stroke="#34d399" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function parseHash() {
  const h = location.hash.replace(/^#/, "") || "/";
  const [path, qs] = h.split("?");
  return { path, query: new URLSearchParams(qs ?? "") };
}

function shell() {
  app.innerHTML = html`<div class="layout">
    <aside class="sidebar" id="sidebar">
      <div class="brand">${LOGO} 투자수익 장부</div>
      <nav class="nav">${NAV.map(([href, ico, label]) => html`<a href="${href}" data-nav="${href}"><span class="ico">${ico}</span>${label}</a>`)}</nav>
      <div class="foot">
        <div>${state.user.username} (${state.user.role === "admin" ? "관리자" : "직원"})</div>
        <button type="button" id="logout">로그아웃</button>
      </div>
    </aside>
    <div class="main">
      <div class="topbar">
        <button class="menu-btn" id="menu" aria-label="메뉴">☰</button>
        <h1 id="page-title"></h1>
        <div class="asof" title="어느 날짜를 기준으로 계산할지 선택">
          <button type="button" id="asof-today">오늘</button>
          <button type="button" id="asof-pick">특정 날짜</button>
          <input type="date" id="asof-date" />
        </div>
      </div>
      <div id="asof-banner"></div>
      <div class="content" id="content"></div>
    </div>
  </div>`.s;

  const sidebar = document.getElementById("sidebar");
  const closeMenu = () => {
    sidebar.classList.remove("open");
    document.querySelector(".scrim")?.remove();
  };
  document.getElementById("menu").addEventListener("click", () => {
    sidebar.classList.add("open");
    const s = document.createElement("div");
    s.className = "scrim";
    s.addEventListener("click", closeMenu);
    document.body.appendChild(s);
  });
  sidebar.addEventListener("click", (e) => e.target.closest("a") && closeMenu());
  document.getElementById("logout").addEventListener("click", async () => {
    await api("/logout", { method: "POST" });
    state.user = null;
    location.hash = "#/login";
    boot();
  });
  const dateEl = document.getElementById("asof-date");
  document.getElementById("asof-today").addEventListener("click", () => setAsOf(null));
  document.getElementById("asof-pick").addEventListener("click", () => {
    dateEl.showPicker?.();
    dateEl.focus();
  });
  dateEl.addEventListener("change", () => dateEl.value && setAsOf(dateEl.value));
  syncAsOf();
}

function syncAsOf() {
  const custom = isCustomAsOf();
  document.getElementById("asof-today").classList.toggle("on", !custom);
  document.getElementById("asof-pick").classList.toggle("on", custom);
  document.getElementById("asof-date").value = asOf();
  document.getElementById("asof-banner").innerHTML = custom
    ? html`<div class="asof-banner">📅 <b>${dfull(asOf())}</b> 기준으로 계산 중입니다 (${asOf() > state.today ? "미래 예상" : "과거 시점"}). 그 날짜까지의 입금만 반영됩니다.
        <button class="btn sm" id="asof-reset">오늘 기준으로</button></div>`.s
    : "";
  document.getElementById("asof-reset")?.addEventListener("click", () => setAsOf(null));
}

let renderSeq = 0;
async function render() {
  const { path, query } = parseHash();
  if (!state.user) return;
  if (path === "/login") {
    location.hash = "#/";
    return;
  }
  if (!document.getElementById("content")) shell();
  const content = document.getElementById("content");
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const href = a.dataset.nav.slice(1);
    a.classList.toggle("active", href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
  });
  let view, params;
  for (const [re, v] of ROUTES) {
    const m = re.exec(path);
    if (m) {
      view = v;
      params = m.slice(1);
      break;
    }
  }
  if (!view) {
    content.innerHTML = '<div class="empty">페이지를 찾을 수 없습니다.</div>';
    return;
  }
  const seq = ++renderSeq;
  try {
    const r = await view({ params, query, path });
    if (seq !== renderSeq) return;
    destroyCharts();
    document.getElementById("page-title").textContent = r.title;
    document.title = `${r.title} · 투자수익 장부`;
    content.innerHTML = r.html.s ?? r.html;
    r.after?.(content, render);
  } catch (e) {
    if (seq !== renderSeq) return;
    content.innerHTML = html`<div class="empty">⚠ ${e.message}</div>`.s;
  }
}

function loginPage(needsSetup) {
  app.innerHTML = html`<div class="login-page">
    <form class="login-card" id="login-form">
      <div style="margin-bottom:14px">${LOGO}</div>
      <h1>${needsSetup ? "관리자 계정 만들기" : "투자수익 장부"}</h1>
      <p>${needsSetup ? "처음 실행입니다. 관리자 아이디와 비밀번호(8자 이상)를 정하세요." : "로그인하면 오늘 기준으로 자동 계산됩니다."}</p>
      <div class="field"><label>아이디</label><input name="username" autocomplete="username" required /></div>
      <div class="field"><label>비밀번호</label><input name="password" type="password" autocomplete="${needsSetup ? "new-password" : "current-password"}" required /></div>
      ${needsSetup ? html`<div class="field"><label>비밀번호 확인</label><input name="password2" type="password" autocomplete="new-password" required /></div>` : ""}
      <button class="btn primary" type="submit">${needsSetup ? "계정 만들고 시작" : "로그인"}</button>
    </form>
  </div>`.s;
  const form = document.getElementById("login-form");
  form.username.focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = { username: form.username.value, password: form.password.value };
    if (needsSetup && body.password !== form.password2.value) return toast("비밀번호 확인이 일치하지 않습니다.", true);
    try {
      await api(needsSetup ? "/setup" : "/login", { method: "POST", body });
      location.hash = "#/";
      boot();
    } catch (err) {
      toast(err.message, true);
    }
  });
}

async function boot() {
  const s = await api("/session");
  state.today = s.today;
  state.user = s.user;
  if (!s.user) return loginPage(s.needsSetup);
  state.meta = await api("/meta");
  app.innerHTML = "";
  render();
}

window.addEventListener("hashchange", () => (state.user ? render() : null));
onAsOf(() => {
  syncAsOf();
  render();
});
// 자정이 지나면 '오늘'을 자동 갱신
setInterval(async () => {
  if (!state.user) return;
  const s = await api("/session").catch(() => null);
  if (s && s.today !== state.today) {
    state.today = s.today;
    syncAsOf();
    render();
  }
}, 5 * 60e3);

boot();
