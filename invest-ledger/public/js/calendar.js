import { html, api, asOf, won, short, chip, dfull, state } from "./core.js";

export async function calendarView({ query }) {
  const month = query.get("m") ?? asOf().slice(0, 7);
  const sel = query.get("d");
  const d = await api("/calendar", { query: { month, asOf: asOf() } });
  const [y, mo] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const shift = (n) => {
    const t = new Date(Date.UTC(y, mo - 1 + n, 1));
    return t.toISOString().slice(0, 7);
  };
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let i = 1; i <= days; i++) cells.push(`${month}-${String(i).padStart(2, "0")}`);
  const monthTotal = Object.values(d.days).reduce((a, x) => ({ due: a.due + x.due, paid: a.paid + x.paid, short: a.short + x.shortfall }), { due: 0, paid: 0, short: 0 });
  const selDay = sel ? d.days[sel] : null;

  return {
    title: "회수 캘린더",
    html: html`
      <div class="cal-head">
        <a class="btn" href="#/calendar?m=${shift(-1)}">◀</a>
        <h2>${y}년 ${mo}월</h2>
        <a class="btn" href="#/calendar?m=${shift(1)}">▶</a>
        <a class="btn sm" href="#/calendar">기준월</a>
        <span style="flex:1"></span>
        <div class="legend"><span><i class="dot d-done"></i>완료</span><span><i class="dot d-today"></i>오늘/예정</span><span><i class="dot d-partial"></i>일부입금</span><span><i class="dot d-delay"></i>지연</span><span><i class="dot d-overdue"></i>연체</span></div>
      </div>
      <div class="grid g3" style="margin-bottom:12px">
        <div class="kpi"><div class="label">${mo}월 회수 예정</div><div class="value">${won(monthTotal.due)}</div></div>
        <div class="kpi accent-green"><div class="label">${mo}월 입금 (예정분 충당)</div><div class="value">${won(monthTotal.paid)}</div></div>
        <div class="kpi accent-blue"><div class="label">${mo}월 미수 (예정 포함)</div><div class="value">${won(monthTotal.short)}</div></div>
      </div>
      <div class="cal">
        ${["일", "월", "화", "수", "목", "금", "토"].map((w) => html`<div class="dow">${w}</div>`)}
        ${cells.map((c) => {
          if (!c) return html`<div class="day empty"></div>`;
          const x = d.days[c];
          return html`<div class="day ${c === state.today ? "today" : ""} ${c === sel ? "sel" : ""}" data-day="${c}">
            <div class="dn"><span>${Number(c.slice(8))}</span>${x ? html`<i class="dot d-${x.worst}"></i>` : ""}</div>
            ${x
              ? html`<div class="amt">${short(x.due)}</div>
                  ${x.paid ? html`<div class="amt paid">입금 ${short(x.paid)}</div>` : ""}
                  ${x.shortfall && c <= d.asOf ? html`<div class="amt short">미수 ${short(x.shortfall)}</div>` : ""}
                  <div class="cnt">${x.count}건</div>`
              : ""}
          </div>`;
        })}
      </div>
      <div id="day-panel" style="margin-top:16px">
        ${selDay
          ? html`<div class="card">
              <h3>${dfull(sel)} · 총 회수 예정 ${won(selDay.due)} <span class="muted small">(입금 ${won(selDay.paid)} / 미수 ${won(selDay.shortfall)})</span></h3>
              <div class="table-wrap"><table class="t">
                <thead><tr><th>고객</th><th>투자처</th><th class="num">회차</th><th class="num">예정액</th><th class="num">입금</th><th class="num">미수</th><th>상태</th></tr></thead>
                <tbody>${selDay.items.map(
                  (i) => html`<tr class="clickable r-${i.level}" data-href="#/investments/${i.id}">
                    <td><b>${i.customerName}</b></td><td>${i.companyName}</td><td class="num">${i.seq}</td>
                    <td class="num">${won(i.amount)}</td><td class="num">${won(i.paid)}</td><td class="num">${won(i.shortfall)}</td><td>${chip(i.status, i.level)}</td></tr>`,
                )}</tbody>
              </table></div></div>`
          : sel
            ? html`<div class="card empty">${dfull(sel)} 회수 예정이 없습니다.</div>`
            : html`<div class="card empty">날짜를 누르면 그날 받을 투자건이 표시됩니다.</div>`}
      </div>
    `,
    after(root) {
      root.querySelectorAll("[data-day]").forEach((el) =>
        el.addEventListener("click", () => {
          location.hash = `#/calendar?m=${month}&d=${el.dataset.day}`;
        }),
      );
      root.querySelectorAll("[data-href]").forEach((el) => el.addEventListener("click", () => (location.hash = el.dataset.href)));
      if (sel) setTimeout(() => root.querySelector("#day-panel").scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    },
  };
}
