import { html, api, won, statusChip, toast, modal, formData, downloadUrl, state } from "./core.js";
import { investmentTable, bindRowLinks } from "./investments.js";

function groupList({ title, rows, base, q, kind }) {
  return html`
    <div class="toolbar">
      <form class="search" id="search"><input name="q" value="${q}" placeholder="${kind} 이름 · 연락처 검색" /></form>
      <span class="spacer"></span>
      ${kind === "고객" ? html`<a class="btn" href="${downloadUrl("/export/customers")}">⬇ 고객별 엑셀</a>` : ""}
    </div>
    <div class="table-wrap responsive"><table class="t">
      <thead><tr><th>${title}</th><th>연락처</th><th class="num">투자건수</th><th class="num">총 실행금액</th><th class="num">총 회수예정</th><th class="num">총 회수액</th><th class="num">미회수</th><th class="num">연체 미수</th><th>상태</th></tr></thead>
      <tbody>${rows.map(
        (c) => html`<tr class="clickable" data-href="#/${base}/${c.id}">
          <td><b>${c.name}</b>${c.manager ? html` <span class="muted small">${c.manager}</span>` : ""}</td><td>${c.phone}</td>
          <td class="num">${c.count}</td><td class="num">${won(c.principal)}</td><td class="num">${won(c.totalExpected)}</td>
          <td class="num">${won(c.collected)}</td><td class="num"><b>${won(c.outstanding)}</b></td>
          <td class="num" style="color:var(--red)">${c.overdueAmount ? won(c.overdueAmount) : "-"}</td><td>${statusChip(c.worst)}</td></tr>`,
      )}</tbody>
    </table></div>
    <div class="cards">${rows.map(
      (c) => html`<div class="icard" data-href="#/${base}/${c.id}">
        <div class="top"><b>${c.name}</b><span class="muted">${c.count}건</span><span class="spacer"></span>${statusChip(c.worst)}</div>
        <div class="rows"><div><span>실행</span><span>${won(c.principal)}</span></div><div><span>회수</span><span>${won(c.collected)}</span></div>
        <div><span>미회수</span><span>${won(c.outstanding)}</span></div><div><span>연체</span><span>${won(c.overdueAmount)}</span></div></div></div>`,
    )}</div>`;
}

function listPage(kind, base, apiPath) {
  return async ({ query }) => {
    const q = query.get("q") ?? "";
    const d = await api(apiPath, { query: q ? { q } : {} });
    const rows = q && base === "companies" ? d.rows.filter((c) => c.name.includes(q) || c.phone.includes(q)) : d.rows;
    return {
      title: kind === "고객" ? "고객" : "투자처",
      html: groupList({ title: kind === "고객" ? "고객명" : "투자처명", rows, base, q, kind }),
      after(root) {
        root.querySelector("#search").addEventListener("submit", (e) => {
          e.preventDefault();
          const v = e.target.q.value.trim();
          location.hash = `#/${base}${v ? `?q=${encodeURIComponent(v)}` : ""}`;
        });
        bindRowLinks(root);
      },
    };
  };
}

export const customersView = listPage("고객", "customers", "/customers");
export const companiesView = listPage("투자처", "companies", "/companies");

function summaryCards(s) {
  return html`<div class="grid g5" style="margin-bottom:14px">
    <div class="kpi"><div class="label">총 투자건수</div><div class="value">${s.count}건</div></div>
    <div class="kpi"><div class="label">총 실행금액</div><div class="value">${won(s.principal)}</div></div>
    <div class="kpi"><div class="label">총 회수예정금액</div><div class="value">${won(s.totalExpected)}</div><div class="sub">수익 ${won(s.profit)}</div></div>
    <div class="kpi accent-green"><div class="label">총 회수금액</div><div class="value">${won(s.collected)}</div></div>
    <div class="kpi accent-blue"><div class="label">총 미회수금액</div><div class="value">${won(s.outstanding)}</div><div class="sub" style="color:var(--red)">연체 ${won(s.overdueAmount)}</div></div>
  </div>`;
}

export async function customerView({ params }) {
  const id = Number(params[0]);
  const d = await api(`/customers/${id}`);
  const c = d.customer;
  return {
    title: `고객 · ${c.name}`,
    html: html`
      <div class="detail-head">
        <div class="title"><div class="code">고객</div><h2>${c.name}</h2>
          <div class="muted">${c.phone ? html`<a href="tel:${c.phone}">${c.phone}</a>` : "연락처 없음"}${c.memo ? ` · ${c.memo}` : ""}</div></div>
        <div class="actions">
          <a class="btn" href="${downloadUrl("/export/customers", { customerId: id })}">⬇ 엑셀</a>
          <button class="btn" id="edit">✎ 고객정보 수정</button>
          <a class="btn primary" href="#/new?customerId=${id}">＋ 이 고객 투자 등록</a>
        </div>
      </div>
      ${summaryCards(d.summary)}
      ${investmentTable(d.rows, { showCustomer: false, detailCols: true })}
    `,
    after(root, rerender) {
      bindRowLinks(root);
      root.querySelector("#edit").addEventListener("click", () =>
        modal({
          title: "고객정보 수정",
          body: html`<div class="fields" style="grid-template-columns:1fr 1fr">
            <div class="field"><label>고객명</label><input name="name" value="${c.name}" /></div>
            <div class="field"><label>연락처</label><input name="phone" value="${c.phone}" /></div>
            <div class="field wide"><label>메모</label><textarea name="memo" rows="3">${c.memo}</textarea></div></div>`,
          onSubmit: async (f) => {
            await api(`/customers/${id}`, { method: "PUT", body: formData(f) });
            state.meta = await api("/meta");
            toast("저장했습니다.");
            rerender();
          },
        }),
      );
    },
  };
}

export async function companyView({ params }) {
  const id = Number(params[0]);
  const d = await api(`/companies/${id}`);
  const c = d.company;
  return {
    title: `투자처 · ${c.name}`,
    html: html`
      <div class="detail-head">
        <div class="title"><div class="code">투자처</div><h2>${c.name}</h2>
          <div class="muted">담당 ${c.manager || "-"} · ${c.phone ? html`<a href="tel:${c.phone}">${c.phone}</a>` : "연락처 없음"}${c.memo ? ` · ${c.memo}` : ""}</div></div>
        <div class="actions"><button class="btn" id="edit">✎ 투자처 정보 수정</button></div>
      </div>
      ${summaryCards(d.summary)}
      ${investmentTable(d.rows, { showCompany: false, detailCols: true })}
    `,
    after(root, rerender) {
      bindRowLinks(root);
      root.querySelector("#edit").addEventListener("click", () =>
        modal({
          title: "투자처 정보 수정",
          body: html`<div class="fields" style="grid-template-columns:1fr 1fr">
            <div class="field"><label>투자처명</label><input name="name" value="${c.name}" /></div>
            <div class="field"><label>담당자</label><input name="manager" value="${c.manager}" /></div>
            <div class="field"><label>연락처</label><input name="phone" value="${c.phone}" /></div>
            <div class="field wide"><label>메모</label><textarea name="memo" rows="3">${c.memo}</textarea></div></div>`,
          onSubmit: async (f) => {
            await api(`/companies/${id}`, { method: "PUT", body: formData(f) });
            state.meta = await api("/meta");
            toast("저장했습니다.");
            rerender();
          },
        }),
      );
    },
  };
}
