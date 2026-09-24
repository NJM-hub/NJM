import { html, api, asOf, won, pct, chip, dfull, md, chart, downloadUrl, setAsOf, state } from "./core.js";
import { baseOpts, centerText } from "./dashboard.js";

export async function monthlyView({ query }) {
  const year = query.get("y") ?? asOf().slice(0, 4);
  const d = await api("/stats/monthly", { query: { year, asOf: asOf() } });
  const sum = (k) => d.months.reduce((a, m) => a + m[k], 0);
  const t = d.totals;
  return {
    title: "월별 통계",
    html: html`
      <div class="toolbar">
        <div class="filters">${d.years.map((y) => html`<button type="button" data-y="${y}" class="${String(y) === String(d.year) ? "on" : ""}">${y}년</button>`)}</div>
        <span class="spacer"></span>
        <a class="btn" href="${downloadUrl("/export/monthly-exec", { year: d.year })}">⬇ 월별 실행 엑셀</a>
        <a class="btn" href="${downloadUrl("/export/monthly-collect", { year: d.year })}">⬇ 월별 회수 엑셀</a>
      </div>

      <div class="grid charts g2">
        <div class="card">
          <h3>${d.year}년 월별 투자 실행금액</h3>
          <div class="chart-box"><canvas id="m-exec"></canvas></div>
          <div class="table-wrap" style="margin-top:12px"><table class="t">
            <thead><tr><th>월</th><th class="num">실행금액</th><th class="num">투자건수</th></tr></thead>
            <tbody>${d.months.map((m) => html`<tr><td>${Number(m.month.slice(5))}월</td><td class="num">${won(m.executed)}</td><td class="num">${m.executedCount}</td></tr>`)}</tbody>
            <tfoot><tr><td>총 실행금액</td><td class="num">${won(sum("executed"))}</td><td class="num">${sum("executedCount")}건</td></tr></tfoot>
          </table></div>
        </div>
        <div class="card">
          <h3>${d.year}년 월별 회수금액</h3>
          <div class="chart-box"><canvas id="m-col"></canvas></div>
          <div class="table-wrap" style="margin-top:12px"><table class="t">
            <thead><tr><th>월</th><th class="num">예정회수액</th><th class="num">실제회수액</th><th class="num">미회수</th></tr></thead>
            <tbody>${d.months.map(
              (m) => html`<tr><td>${Number(m.month.slice(5))}월</td><td class="num">${won(m.scheduled)}</td><td class="num">${won(m.collected)}</td>
                <td class="num" style="color:${m.unpaid ? "var(--red)" : "inherit"}">${won(m.unpaid)}</td></tr>`,
            )}</tbody>
            <tfoot><tr><td>합계</td><td class="num">${won(sum("scheduled"))}</td><td class="num">${won(sum("collected"))}</td><td class="num">${won(sum("unpaid"))}</td></tr></tfoot>
          </table></div>
          <p class="small muted">예정회수액 = 그 달에 예정일이 있는 회차 합계 · 실제회수액 = 그 달 입금일 합계 · 미회수 = 그 달 예정분 중 ${dfull(d.asOf)}까지 입금되지 않은 금액</p>
        </div>
      </div>

      <div class="grid charts g3" style="margin-top:12px">
        <div class="card"><h3>총 투자금 대비 회수율</h3><div class="chart-box sm"><canvas id="m-pie"></canvas></div></div>
        <div class="kpi"><div class="label">미회수금액</div><div class="value">${won(t.outstanding)}</div><div class="sub">총 회수예정의 ${pct(100 - t.collectionRate)}</div></div>
        <div class="kpi accent-red"><div class="label">연체금액</div><div class="value">${won(t.overdueAmount)}</div><div class="sub">미회수 중 ${pct(t.outstanding ? (t.overdueAmount / t.outstanding) * 100 : 0)}</div></div>
      </div>
    `,
    after(root) {
      root.querySelectorAll("[data-y]").forEach((b) => b.addEventListener("click", () => (location.hash = `#/monthly?y=${b.dataset.y}`)));
      const labels = d.months.map((m) => `${Number(m.month.slice(5))}월`);
      chart("m-exec", { type: "bar", data: { labels, datasets: [{ label: "실행금액", data: d.months.map((m) => m.executed), backgroundColor: "#1c4a7d", borderRadius: 4 }] }, options: baseOpts() });
      chart("m-col", {
        type: "bar",
        data: {
          labels,
          datasets: [
            { label: "예정", data: d.months.map((m) => m.scheduled), backgroundColor: "#c7d7f5", borderRadius: 4 },
            { label: "실제", data: d.months.map((m) => m.collected), backgroundColor: "#16a34a", borderRadius: 4 },
            { label: "미회수", data: d.months.map((m) => m.unpaid), backgroundColor: "#dc2626", borderRadius: 4 },
          ],
        },
        options: baseOpts(true),
      });
      chart("m-pie", {
        type: "doughnut",
        data: { labels: ["회수", "미회수(정상)", "연체"], datasets: [{ data: [t.collected, Math.max(0, t.outstanding - t.overdueAmount), t.overdueAmount], backgroundColor: ["#16a34a", "#c7d7f5", "#dc2626"], borderWidth: 0 }] },
        options: { maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => `${c.label}: ${won(c.raw)}` } } } },
        plugins: [centerText(pct(t.collectionRate), "회수율")],
      });
    },
  };
}

// 날짜별 전체 회수현황
export async function dailyView({ query }) {
  const date = query.get("date") ?? asOf();
  const d = await api("/daily", { query: { date, asOf: date } });
  const t = d.totals;
  const todays = d.list.filter((r) => r.dueDate === date);
  const past = d.list.filter((r) => r.dueDate < date);
  const kpi = (label, v, cls = "", sub = "") => html`<div class="kpi ${cls}"><div class="label">${label}</div><div class="value">${won(v)}</div>${sub ? html`<div class="sub">${sub}</div>` : ""}</div>`;
  const table = (rows) =>
    rows.length
      ? html`<div class="table-wrap"><table class="t">
          <thead><tr><th>고객</th><th>투자처</th><th class="num">회차</th><th>예정일</th><th class="num">예정액</th><th class="num">입금</th><th class="num">미수</th><th>상태</th></tr></thead>
          <tbody>${rows.map(
            (r) => html`<tr class="clickable r-${r.level}" data-href="#/investments/${r.id}">
              <td><b>${r.customerName}</b></td><td>${r.companyName}</td><td class="num">${r.seq}</td><td class="nowrap">${md(r.dueDate)}</td>
              <td class="num">${won(r.amount)}</td><td class="num">${won(r.paid)}</td><td class="num"><b>${won(r.shortfall)}</b></td>
              <td class="nowrap">${chip(r.status, r.level)}${r.delayDays ? html` <span class="small" style="color:var(--red)">${r.delayDays}일</span>` : ""}</td></tr>`,
          )}</tbody>
          <tfoot><tr><td colspan="4">합계 ${rows.length}건</td><td class="num">${won(rows.reduce((a, r) => a + r.amount, 0))}</td><td class="num">${won(rows.reduce((a, r) => a + r.paid, 0))}</td><td class="num">${won(rows.reduce((a, r) => a + r.shortfall, 0))}</td><td></td></tr></tfoot>
        </table></div>`
      : html`<div class="card empty">해당 건이 없습니다.</div>`;

  return {
    title: "날짜별 회수현황",
    html: html`
      <div class="toolbar">
        <a class="btn" href="#/daily?date=${shiftDay(date, -1)}">◀ 전날</a>
        <input type="date" class="input" id="pick" value="${date}" style="width:auto" />
        <a class="btn" href="#/daily?date=${shiftDay(date, 1)}">다음날 ▶</a>
        <a class="btn sm" href="#/daily?date=${state.today}">오늘</a>
        <span class="spacer"></span>
        <button class="btn sm" id="apply-all">이 날짜를 전체 기준일로</button>
      </div>
      <div class="section-title" style="margin-top:6px"><h2>${dfull(date)} 회수현황</h2></div>
      <div class="grid g4">
        ${kpi("회수 예정", t.today.due, "", `${t.today.dueCount}건`)}
        ${kpi("실제 회수 (입금일 기준)", t.today.collected, "accent-green")}
        ${kpi("미회수 (당일 예정분)", t.today.unpaid, t.today.unpaid ? "accent-orange" : "")}
        ${kpi("연체 포함 미수금", t.unpaidInclOverdue, t.unpaidInclOverdue ? "accent-red" : "", `이전 미수 ${won(t.overdueAmount)} 포함`)}
      </div>
      <div class="section-title"><h2>향후 회수 예정</h2></div>
      <div class="grid g4">
        ${kpi("이번 주", t.future.thisWeek, "", "다음날 ~ 일요일")}
        ${kpi("이번 달", t.future.thisMonth, "", "다음날 ~ 월말")}
        ${kpi("다음 달", t.future.nextMonth)}
        ${kpi("전체 미회수 예정금액", t.future.all + t.unpaidInclOverdue, "accent-blue", `미래 예정 ${won(t.future.all)} + 미수 ${won(t.unpaidInclOverdue)}`)}
      </div>
      <div class="section-title"><h2>당일 예정 (${todays.length}건)</h2></div>
      ${table(todays)}
      <div class="section-title"><h2>이전 미수 · 연체 (${past.length}건)</h2><span class="spacer"></span><a href="${downloadUrl("/export/overdue", { asOf: date })}">⬇ 연체 목록 엑셀</a></div>
      ${table(past)}
      <div class="section-title"><h2>당일 입금 기록 (${d.payments.length}건)</h2></div>
      ${d.payments.length
        ? html`<div class="table-wrap"><table class="t"><thead><tr><th>고객</th><th>투자번호</th><th class="num">회차</th><th class="num">금액</th><th>메모</th></tr></thead>
            <tbody>${d.payments.map((p) => html`<tr class="clickable" data-href="#/investments/${p.investmentId}"><td>${p.customerName}</td><td>${p.code}</td><td class="num">${p.seq ?? "일괄"}</td><td class="num">${won(p.amount)}</td><td>${p.memo}</td></tr>`)}</tbody></table></div>`
        : html`<div class="card empty">입금 기록이 없습니다.</div>`}
    `,
    after(root) {
      root.querySelector("#pick").addEventListener("change", (e) => e.target.value && (location.hash = `#/daily?date=${e.target.value}`));
      root.querySelector("#apply-all").addEventListener("click", () => setAsOf(date));
      root.querySelectorAll("[data-href]").forEach((el) => el.addEventListener("click", () => (location.hash = el.dataset.href)));
    },
  };
}

function shiftDay(s, n) {
  const t = new Date(s + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
