import { html, api, won, pct, bar, statusChip, expiryChip, chart, moneyTick, dfull, md, chip, isCustomAsOf } from "./core.js";

const kpi = (label, value, { sub, cls = "", href } = {}) =>
  html`<div class="kpi ${cls} ${href ? "click" : ""}" ${href ? html`data-href="${href}"` : ""}>
    <div class="label">${label}</div>
    <div class="value">${value}</div>
    ${sub ? html`<div class="sub">${sub}</div>` : ""}
  </div>`;

export async function dashboardView() {
  const d = await api("/dashboard");
  const t = d.totals;
  const custom = isCustomAsOf();
  const dayLabel = custom ? "기준일" : "오늘";

  return {
    title: "투자수익 관리 Dashboard",
    html: html`
      <div class="grid g5">
        ${kpi("총 실행금액", won(t.principal), { cls: "hero", sub: `${t.count}건 · ${dfull(d.asOf)} 기준` })}
        ${kpi("총 회수예정금액", won(t.totalExpected), { sub: `원금 + 약정수익` })}
        ${kpi("현재까지 회수금액", won(t.collected), { cls: "accent-green", sub: html`회수율 ${pct(t.collectionRate)} ${bar(t.collectionRate)}` })}
        ${kpi("현재 미회수금액", won(t.outstanding), { cls: "accent-blue", sub: `예정액의 ${pct(100 - t.collectionRate)}` })}
        ${kpi("예상 총수익", won(t.expectedProfit), { sub: t.principal ? `평균 수익률 ${pct((t.expectedProfit / t.principal) * 100)}` : "" })}
      </div>

      <div class="section-title"><h2>${dayLabel} (${dfull(d.asOf)})</h2><span class="spacer"></span><a href="#/daily">날짜별 회수현황 →</a></div>
      <div class="grid g3">
        ${kpi(`${dayLabel} 실행`, won(t.today.executed), { sub: `${t.today.executedCount}건` })}
        ${kpi(`${dayLabel} 회수 예정`, won(t.today.due), { sub: `${t.today.dueCount}건`, href: "#/daily" })}
        ${kpi(`${dayLabel} 실제 회수`, won(t.today.collected), { cls: "accent-green", sub: "입금일 기준 합계" })}
        ${kpi(`${dayLabel} 미회수`, won(t.today.unpaid), { cls: t.today.unpaid ? "accent-orange" : "", sub: "오늘 예정분 중 미입금" })}
        ${kpi("연체 포함 미수금", won(t.unpaidInclOverdue), { cls: t.unpaidInclOverdue ? "accent-red" : "", sub: `${dayLabel}까지 받아야 했던 금액 중 미입금`, href: "#/daily" })}
        ${kpi("연체금액", won(t.overdueAmount), { cls: t.overdueAmount ? "accent-red" : "", sub: "예정일이 지난 미수금", href: "#/investments?filter=overdue" })}
      </div>

      <div class="section-title"><h2>이번 달 (${d.asOf.slice(0, 7)})</h2></div>
      <div class="grid g4">
        ${kpi("월 실행금액", won(t.month.executed), { sub: `${t.month.executedCount}건` })}
        ${kpi("월 회수 예정액", won(t.month.due), { sub: "이번 달 전체 예정" })}
        ${kpi("월 회수금액", won(t.month.collected), { cls: "accent-green", sub: `${dayLabel}까지 실제 입금` })}
        ${kpi("월 미회수금액", won(t.month.unpaid), { cls: t.month.unpaid ? "accent-orange" : "", sub: `${dayLabel}까지 도래분 중 미입금` })}
      </div>

      <div class="section-title"><h2>주의가 필요한 투자</h2><span class="spacer"></span><a href="#/investments?filter=active">전체 보기 →</a></div>
      <div class="attn">
        ${kpi("🔴 연체", `${t.status.연체}건`, { cls: "k-overdue", sub: `잔액 ${won(t.statusAmount.연체)}`, href: "#/investments?filter=overdue" })}
        ${kpi("🟠 일부입금", `${t.status.일부입금}건`, { cls: "k-partial", sub: `잔액 ${won(t.statusAmount.일부입금)}`, href: "#/investments?filter=partial" })}
        ${kpi("🟡 지연", `${t.status.지연}건`, { cls: "k-delay", sub: `잔액 ${won(t.statusAmount.지연)}`, href: "#/investments?filter=unpaid" })}
        ${kpi("🟡 만료임박", `${t.status.만료임박}건`, { cls: "k-imminent", sub: `15일 이내 · ${won(t.statusAmount.만료임박)}`, href: "#/investments?filter=expiring" })}
        ${kpi("🟢 정상", `${t.status.정상}건`, { cls: "k-normal", sub: `완납 ${t.status.완납}건`, href: "#/investments?filter=normal" })}
      </div>
      ${d.attention.length
        ? html`<div class="table-wrap" style="margin-top:12px">
            <table class="t">
              <thead><tr><th>고객</th><th>투자처</th><th class="num">잔액</th><th class="num">미수(연체)</th><th class="num">지연</th><th>만료</th><th>상태</th></tr></thead>
              <tbody>
                ${d.attention.map(
                  (r) => html`<tr class="clickable" data-href="#/investments/${r.id}">
                    <td><b>${r.customerName}</b> <span class="muted small">${r.code}</span></td>
                    <td>${r.companyName}</td>
                    <td class="num">${won(r.outstanding)}</td>
                    <td class="num" style="color:var(--red)">${r.overdueAmount ? won(r.overdueAmount) : "-"}</td>
                    <td class="num">${r.maxDelay ? `${r.maxDelay}일` : "-"}</td>
                    <td class="nowrap">${md(r.expiryDate)} ${expiryChip(r.expiry)}</td>
                    <td>${statusChip(r.status)}</td>
                  </tr>`,
                )}
              </tbody>
            </table>
          </div>`
        : ""}

      <div class="section-title"><h2>앞으로 받을 돈</h2></div>
      <div class="grid g4">
        ${kpi("7일 이내", won(t.future.d7))}
        ${kpi("30일 이내", won(t.future.d30))}
        ${kpi("60일 이내", won(t.future.d60))}
        ${kpi("전체 (미래 예정분)", won(t.future.all), { cls: "accent-blue", sub: `+ 이미 지난 미수 ${won(t.unpaidInclOverdue)}` })}
      </div>
      <div class="grid g3" style="margin-top:12px">
        ${kpi("이번 주 (일요일까지)", won(t.future.thisWeek))}
        ${kpi("이번 달 남은 기간", won(t.future.thisMonth))}
        ${kpi("다음 달", won(t.future.nextMonth))}
      </div>

      <div class="section-title"><h2>통계</h2><span class="spacer"></span><a href="#/monthly">월별 통계 →</a></div>
      <div class="grid charts g3">
        <div class="card"><h3>${d.asOf.slice(0, 4)}년 월별 투자 실행금액</h3><div class="chart-box"><canvas id="c-exec"></canvas></div></div>
        <div class="card"><h3>월별 회수금액 (예정 vs 실제)</h3><div class="chart-box"><canvas id="c-col"></canvas></div></div>
        <div class="card"><h3>총 회수예정 대비 회수율</h3><div class="chart-box"><canvas id="c-pie"></canvas></div>
          <div class="legend" style="justify-content:center;margin-top:6px">
            <span>회수 <b>${won(t.collected)}</b></span><span>미회수 <b>${won(t.outstanding - t.overdueAmount)}</b></span><span style="color:var(--red)">연체 <b>${won(t.overdueAmount)}</b></span>
          </div>
        </div>
      </div>

      <div class="section-title"><h2>${dayLabel} 회수 예정 (${d.todayDue.length}건)</h2></div>
      ${d.todayDue.length
        ? html`<div class="table-wrap"><table class="t">
            <thead><tr><th>고객</th><th>투자처</th><th class="num">회차</th><th class="num">예정액</th><th class="num">입금</th><th class="num">미수</th><th>상태</th></tr></thead>
            <tbody>${d.todayDue.map(
              (r) => html`<tr class="clickable r-${r.level}" data-href="#/investments/${r.id}">
                <td><b>${r.customerName}</b></td><td>${r.companyName}</td><td class="num">${r.seq}</td>
                <td class="num">${won(r.amount)}</td><td class="num">${won(r.paid)}</td><td class="num">${won(r.shortfall)}</td><td>${chip(r.status, r.level)}</td></tr>`,
            )}</tbody></table></div>`
        : html`<div class="card empty">${dayLabel} 회수 예정 건이 없습니다.</div>`}
    `,
    after(root) {
      root.querySelectorAll("[data-href]").forEach((el) => el.addEventListener("click", () => (location.hash = el.dataset.href)));
      const labels = d.monthly.map((m) => `${Number(m.month.slice(5))}월`);
      chart("c-exec", {
        type: "bar",
        data: { labels, datasets: [{ label: "실행금액", data: d.monthly.map((m) => m.executed), backgroundColor: "#1c4a7d", borderRadius: 4 }] },
        options: baseOpts(),
      });
      chart("c-col", {
        type: "bar",
        data: {
          labels,
          datasets: [
            { label: "예정", data: d.monthly.map((m) => m.scheduled), backgroundColor: "#c7d7f5", borderRadius: 4 },
            { label: "실제", data: d.monthly.map((m) => m.collected), backgroundColor: "#16a34a", borderRadius: 4 },
          ],
        },
        options: baseOpts(true),
      });
      chart("c-pie", {
        type: "doughnut",
        data: {
          labels: ["회수", "미회수(정상)", "연체"],
          datasets: [{ data: [t.collected, Math.max(0, t.outstanding - t.overdueAmount), t.overdueAmount], backgroundColor: ["#16a34a", "#c7d7f5", "#dc2626"], borderWidth: 0 }],
        },
        options: {
          maintainAspectRatio: false,
          cutout: "62%",
          plugins: {
            legend: { position: "bottom" },
            tooltip: { callbacks: { label: (c) => `${c.label}: ${won(c.raw)} (${pct((c.raw / (t.totalExpected || 1)) * 100)})` } },
          },
        },
        plugins: [centerText(`${pct(t.collectionRate)}`, "회수율")],
      });
    },
  };
}

export function baseOpts(legend = false) {
  return {
    maintainAspectRatio: false,
    plugins: {
      legend: { display: legend, position: "bottom" },
      tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${won(c.raw)}` } },
    },
    scales: {
      y: { ticks: { callback: moneyTick }, grid: { color: "#eef1f6" } },
      x: { grid: { display: false } },
    },
  };
}

export function centerText(big, small) {
  return {
    id: "center",
    afterDraw(c) {
      const { ctx, chartArea: a } = c;
      if (!a) return;
      const x = (a.left + a.right) / 2;
      const y = (a.top + a.bottom) / 2;
      ctx.save();
      ctx.textAlign = "center";
      ctx.fillStyle = "#16202e";
      ctx.font = "800 22px sans-serif";
      ctx.fillText(big, x, y + 4);
      ctx.fillStyle = "#637083";
      ctx.font = "600 12px sans-serif";
      ctx.fillText(small, x, y + 22);
      ctx.restore();
    },
  };
}
