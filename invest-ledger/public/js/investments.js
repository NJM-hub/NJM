import {
  html, api, state, won, num, pct, md, dfull, bar, chip, statusChip, expiryChip, toast, modal, confirmBox,
  bindMoneyInputs, moneyVal, formData, downloadUrl,
} from "./core.js";

const FILTERS = [
  ["all", "전체"],
  ["active", "진행중"],
  ["normal", "정상"],
  ["partial", "일부입금"],
  ["unpaid", "미입금"],
  ["overdue", "연체"],
  ["expiring", "만료임박"],
  ["paidoff", "완납"],
];

// ---------- 공통: 투자 목록 테이블 ----------
export function investmentTable(rows, { showCustomer = true, showCompany = true, detailCols = false, totals } = {}) {
  if (!rows.length) return html`<div class="card empty">조건에 맞는 투자건이 없습니다.</div>`;
  const tr = (r) => html`<tr class="clickable r-${r.statusLevel}" data-href="#/investments/${r.id}">
    ${showCustomer ? html`<td><a href="#/customers/${r.customerId}" data-stop><b>${r.customerName}</b></a><div class="muted small">${r.code}</div></td>` : html`<td><b>${r.code}</b></td>`}
    ${showCompany ? html`<td><a href="#/companies/${r.companyId}" data-stop>${r.companyName}</a>${r.category ? html`<div class="muted small">${r.category}</div>` : ""}</td>` : ""}
    ${detailCols ? html`<td class="nowrap">${r.execDate}</td>` : ""}
    <td class="num">${won(r.principal)}</td>
    ${detailCols ? html`<td class="num">${pct(Number(r.rate))}</td>` : ""}
    <td class="num">${won(r.totalExpected)}</td>
    ${detailCols ? html`<td class="nowrap">${r.term}<div class="muted small">${r.cycle}</div></td>` : ""}
    <td class="num">${won(r.collected)}<div style="width:90px;margin-left:auto">${bar(r.progressPct)}</div></td>
    <td class="num"><b>${won(r.outstanding)}</b></td>
    <td class="nowrap">${r.expiryDate}<div>${expiryChip(r.expiry)}</div></td>
    <td class="num">${r.maxDelay ? html`<span style="color:var(--red);font-weight:700">${r.maxDelay}일</span>` : "-"}</td>
    <td>${statusChip(r.status)}</td>
  </tr>`;
  const card = (r) => html`<div class="icard" data-href="#/investments/${r.id}">
    <div class="top"><b>${r.customerName}</b><span class="muted">${r.companyName}</span><span class="spacer"></span>${statusChip(r.status)}</div>
    <div class="rows">
      <div><span>실행금액</span><span>${won(r.principal)}</span></div>
      <div><span>회수예정</span><span>${won(r.totalExpected)}</span></div>
      <div><span>회수액</span><span style="color:var(--green)">${won(r.collected)}</span></div>
      <div><span>잔액</span><span>${won(r.outstanding)}</span></div>
      <div><span>만료일</span><span>${md(r.expiryDate)} ${expiryChip(r.expiry)}</span></div>
      <div><span>지연</span><span>${r.maxDelay ? `${r.maxDelay}일` : "-"}</span></div>
    </div>
    <div style="margin-top:8px">${bar(r.progressPct)}<div class="muted small" style="text-align:right">${pct(r.progressPct)} · ${r.term} ${r.cycle}</div></div>
  </div>`;
  return html`
    <div class="table-wrap responsive"><table class="t">
      <thead><tr>
        <th>${showCustomer ? "고객" : "투자번호"}</th>${showCompany ? html`<th>투자처</th>` : ""}
        ${detailCols ? html`<th>실행일</th>` : ""}<th class="num">실행금액</th>${detailCols ? html`<th class="num">수익률</th>` : ""}
        <th class="num">회수예정액</th>${detailCols ? html`<th>기간·주기</th>` : ""}
        <th class="num">회수액</th><th class="num">잔액</th><th>만료일</th><th class="num">지연일수</th><th>상태</th>
      </tr></thead>
      <tbody>${rows.map(tr)}</tbody>
      ${totals
        ? html`<tfoot><tr><td>합계 ${totals.count}건</td>${showCompany ? html`<td></td>` : ""}${detailCols ? html`<td></td>` : ""}
            <td class="num">${won(totals.principal)}</td>${detailCols ? html`<td></td>` : ""}<td class="num">${won(totals.totalExpected)}</td>
            ${detailCols ? html`<td></td>` : ""}<td class="num">${won(totals.collected)}</td><td class="num">${won(totals.outstanding)}</td><td colspan="3"></td></tr></tfoot>`
        : ""}
    </table></div>
    <div class="cards">${rows.map(card)}</div>`;
}

export function bindRowLinks(root) {
  root.querySelectorAll("[data-stop]").forEach((a) => a.addEventListener("click", (e) => e.stopPropagation()));
  root.querySelectorAll("[data-href]").forEach((el) => el.addEventListener("click", () => (location.hash = el.dataset.href)));
}

// ---------- 목록 ----------
export async function listView({ query }) {
  const q = query.get("q") ?? "";
  const filter = query.get("filter") ?? "all";
  const d = await api("/investments", { query: { q, filter } });
  const nav = (o) => {
    const p = new URLSearchParams({ q, filter, ...o });
    if (!p.get("q")) p.delete("q");
    if (p.get("filter") === "all") p.delete("filter");
    location.hash = `#/investments${p.toString() ? "?" + p : ""}`;
  };
  return {
    title: "투자 목록",
    html: html`
      <div class="toolbar">
        <form class="search" id="search"><input name="q" value="${q}" placeholder="고객명 · 투자처명 · 투자번호 검색" /></form>
        <span class="spacer"></span>
        <a class="btn" href="${downloadUrl("/export/investments")}">⬇ 엑셀</a>
        <a class="btn primary" href="#/new">＋ 투자 등록</a>
      </div>
      <div class="filters" style="margin-bottom:12px">
        ${FILTERS.map(([k, l]) => html`<button type="button" data-filter="${k}" class="${k === filter ? "on" : ""}">${l}</button>`)}
      </div>
      <div class="grid g4" style="margin-bottom:12px">
        <div class="kpi"><div class="label">실행금액</div><div class="value">${won(d.totals.principal)}</div><div class="sub">${d.totals.count}건</div></div>
        <div class="kpi"><div class="label">회수예정액</div><div class="value">${won(d.totals.totalExpected)}</div></div>
        <div class="kpi accent-green"><div class="label">회수액</div><div class="value">${won(d.totals.collected)}</div></div>
        <div class="kpi accent-blue"><div class="label">잔액</div><div class="value">${won(d.totals.outstanding)}</div><div class="sub">연체 미수 ${won(d.totals.overdueAmount)}</div></div>
      </div>
      ${investmentTable(d.rows, { totals: d.totals, detailCols: true })}
    `,
    after(root) {
      root.querySelector("#search").addEventListener("submit", (e) => {
        e.preventDefault();
        nav({ q: e.target.q.value.trim() });
      });
      root.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => nav({ filter: b.dataset.filter })));
      bindRowLinks(root);
    },
  };
}

// ---------- 등록 / 수정 ----------
const TERM_PRESETS = [
  ["일", [[30, "day"], [60, "day"], [100, "day"], [120, "day"], [180, "day"]]],
  ["주", [[1, "week"], [2, "week"], [4, "week"], [8, "week"], [12, "week"], [16, "week"]]],
  ["개월", [[1, "month"], [3, "month"], [6, "month"], [12, "month"]]],
];
const CYCLE_PRESETS = [
  [1, "day", "매일"],
  [7, "day", "7일마다"],
  [10, "day", "10일마다"],
  [15, "day", "15일마다"],
  [1, "week", "매주"],
  [2, "week", "2주마다"],
  [1, "month", "매월"],
];
const U = { day: "일", week: "주", month: "개월" };
const unitSelect = (name, v) => html`<select name="${name}">${Object.entries(U).map(([k, l]) => html`<option value="${k}" ${k === v ? "selected" : ""}>${l}</option>`)}</select>`;

export async function formView({ params, query }) {
  const editId = params[0] ? Number(params[0]) : null;
  const meta = state.meta;
  let v = {
    customerName: "", customerPhone: "", companyName: "", manager: "", contact: "", category: "", memo: "",
    execDate: state.today, principal: "", rate: "20", totalExpected: "", termValue: 100, termUnit: "day",
    cycleValue: 1, cycleUnit: "day", method: "equal_total", firstDueDate: "", installmentAmount: "", expiryDate: "",
  };
  let inv = null;
  const preset = state.meta.customers.find((c) => c.id === Number(query.get("customerId")));
  if (preset) Object.assign(v, { customerName: preset.name, customerPhone: preset.phone });
  if (editId) {
    const d = await api(`/investments/${editId}`);
    inv = d.inv;
    v = {
      ...v,
      ...d.input,
      totalExpected: d.input.totalExpected ?? "",
      installmentAmount: d.input.installmentAmount ?? "",
      expiryDate: d.input.expiryDate ?? "",
      firstDueDate: d.input.firstDueDate === d.input.execDate ? "" : d.input.firstDueDate,
      customerName: inv.customer_name, customerPhone: inv.customer_phone, companyName: inv.company_name,
      manager: inv.manager, contact: inv.contact, category: inv.category, memo: inv.memo,
    };
  }
  const m = (n) => (n === "" || n === null || n === undefined ? "" : num(n));

  return {
    title: editId ? `투자 수정 · ${inv.code}` : "투자 등록",
    html: html`
      <form id="inv-form" class="form-layout" novalidate autocomplete="off">
        <div>
          ${editId ? html`<div class="card" style="margin-bottom:14px;background:#fff8e6;border-color:#f1dc9b">⚠ 실행일·금액·수익률·기간·주기·방식을 바꾸면 <b>회수 스케줄이 다시 생성</b>됩니다. 입금 기록은 그대로 유지되어 새 스케줄에 다시 배분되며, 변경 내용은 수정 이력에 남습니다.</div>` : ""}
          <div class="card form-section">
            <h3><span class="n">1</span>기본정보</h3>
            <div class="fields">
              <div class="field"><label>고객명 <span class="req">*</span></label><input name="customerName" list="dl-customers" value="${v.customerName}" required /></div>
              <div class="field"><label>고객 연락처</label><input name="customerPhone" value="${v.customerPhone}" inputmode="tel" /></div>
              <div class="field"><label>투자처명 <span class="req">*</span></label><input name="companyName" list="dl-companies" value="${v.companyName}" required /></div>
              <div class="field"><label>담당자</label><input name="manager" value="${v.manager}" /></div>
              <div class="field"><label>담당자 연락처</label><input name="contact" value="${v.contact}" inputmode="tel" /></div>
              <div class="field"><label>투자 구분</label><input name="category" list="dl-categories" value="${v.category}" placeholder="예: 일수, 월상환, 주상환" /></div>
              <div class="field wide"><label>메모</label><textarea name="memo" rows="2">${v.memo}</textarea></div>
            </div>
            <datalist id="dl-customers">${meta.customers.map((c) => html`<option value="${c.name}">${c.phone}</option>`)}</datalist>
            <datalist id="dl-companies">${meta.companies.map((c) => html`<option value="${c.name}"></option>`)}</datalist>
            <datalist id="dl-categories">${[...new Set(["일수", "주상환", "월상환", "만기", ...meta.categories])].map((c) => html`<option value="${c}"></option>`)}</datalist>
          </div>

          <div class="card form-section">
            <h3><span class="n">2</span>투자정보</h3>
            <div class="fields">
              <div class="field"><label>투자 실행일 <span class="req">*</span></label><input type="date" name="execDate" value="${v.execDate}" required /></div>
              <div class="field"><label>실행금액 (원) <span class="req">*</span></label><input class="money" name="principal" value="${m(v.principal)}" inputmode="numeric" placeholder="10,000,000" required /></div>
              <div class="field"><label>약정 수익률 (%) <span class="req">*</span></label><input name="rate" value="${v.rate}" inputmode="decimal" /></div>
              <div class="field"><label>총 회수예정금액 (원)</label><input class="money" name="totalExpected" value="${m(v.totalExpected)}" inputmode="numeric" placeholder="자동 계산" /><span class="hint" id="h-total">비워두면 실행금액 × (1 + 수익률)</span></div>
            </div>
          </div>

          <div class="card form-section">
            <h3><span class="n">3</span>회수조건</h3>
            <div class="field" style="margin-bottom:14px">
              <label>투자·회수 기간</label>
              <div class="presets" id="term-presets">
                ${TERM_PRESETS.map(
                  ([g, list]) => html`<span class="group-label">${g} 단위</span>${list.map(([n, u]) => html`<button type="button" data-tv="${n}" data-tu="${u}">${n}${U[u]}</button>`)}`,
                )}
              </div>
              <div class="inline" style="margin-top:8px;max-width:340px"><span class="muted small nowrap" style="flex:none">직접 입력</span><input name="termValue" type="number" min="1" value="${v.termValue}" style="width:90px" />${unitSelect("termUnit", v.termUnit)}</div>
            </div>
            <div class="field" style="margin-bottom:14px">
              <label>회수주기</label>
              <div class="presets" id="cycle-presets">
                ${CYCLE_PRESETS.map(([n, u, l]) => html`<button type="button" data-cv="${n}" data-cu="${u}">${l}</button>`)}
              </div>
              <div class="inline" style="margin-top:8px;max-width:340px"><span class="muted small nowrap" style="flex:none">직접 설정</span><input name="cycleValue" type="number" min="1" value="${v.cycleValue}" style="width:90px" />${unitSelect("cycleUnit", v.cycleUnit)}<span class="muted small nowrap">마다</span></div>
            </div>
            <div class="fields">
              <div class="field"><label>회수방식</label>
                <select name="method">${meta.methods.map((x) => html`<option value="${x.key}" ${x.key === v.method ? "selected" : ""}>${x.label}</option>`)}</select>
              </div>
              <div class="field"><label>첫 회수일</label><input type="date" name="firstDueDate" value="${v.firstDueDate}" /><span class="hint">비워두면 실행일부터</span></div>
              <div class="field"><label>1회 회수금액 (원)</label><input class="money" name="installmentAmount" value="${m(v.installmentAmount)}" inputmode="numeric" placeholder="자동 균등분할" /><span class="hint" id="h-per">직접 입력 시 마지막 회차에서 잔액 조정</span></div>
              <div class="field"><label>만료일</label><input type="date" name="expiryDate" value="${v.expiryDate}" /><span class="hint">비워두면 기간 마지막 날</span></div>
            </div>
          </div>

          <div class="toolbar">
            <span class="spacer"></span>
            <a class="btn" href="${editId ? `#/investments/${editId}` : "#/investments"}">취소</a>
            <button class="btn primary" type="submit" id="save-btn">${editId ? "수정 저장" : "투자 등록"}</button>
          </div>
        </div>

        <div class="preview">
          <div class="card">
            <h3>자동 계산 결과</h3>
            <div id="preview"><div class="muted">금액과 조건을 입력하면 계산됩니다.</div></div>
          </div>
        </div>
      </form>
    `,
    after(root) {
      const form = root.querySelector("#inv-form");
      bindMoneyInputs(form);
      const collect = () => {
        const o = formData(form);
        for (const k of ["principal", "totalExpected", "installmentAmount"]) o[k] = moneyVal(o[k]);
        o.termValue = Number(o.termValue);
        o.cycleValue = Number(o.cycleValue);
        return o;
      };
      const syncPresets = () => {
        root.querySelectorAll("[data-tv]").forEach((b) => b.classList.toggle("on", b.dataset.tv == form.termValue.value && b.dataset.tu === form.termUnit.value));
        root.querySelectorAll("[data-cv]").forEach((b) => b.classList.toggle("on", b.dataset.cv == form.cycleValue.value && b.dataset.cu === form.cycleUnit.value));
        const single = state.meta.methods.find((x) => x.key === form.method.value)?.singlePayment;
        root.querySelector("#cycle-presets").parentElement.style.opacity = single ? 0.4 : 1;
      };
      root.querySelectorAll("[data-tv]").forEach((b) =>
        b.addEventListener("click", () => {
          form.termValue.value = b.dataset.tv;
          form.termUnit.value = b.dataset.tu;
          update();
        }),
      );
      root.querySelectorAll("[data-cv]").forEach((b) =>
        b.addEventListener("click", () => {
          form.cycleValue.value = b.dataset.cv;
          form.cycleUnit.value = b.dataset.cu;
          update();
        }),
      );
      form.customerName.addEventListener("change", () => {
        const c = state.meta.customers.find((x) => x.name === form.customerName.value);
        if (c && !form.customerPhone.value) form.customerPhone.value = c.phone;
      });
      form.companyName.addEventListener("change", () => {
        const c = state.meta.companies.find((x) => x.name === form.companyName.value);
        if (c) {
          if (!form.manager.value) form.manager.value = c.manager;
          if (!form.contact.value) form.contact.value = c.phone;
        }
      });

      let timer;
      let lastPlan = null;
      const update = () => {
        syncPresets();
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const o = collect();
          const el = root.querySelector("#preview");
          if (!o.principal) {
            el.innerHTML = '<div class="muted">실행금액을 입력하세요.</div>';
            return;
          }
          const p = await api("/investments/preview", { method: "POST", body: o }).catch((e) => ({ ok: false, errors: [e.message] }));
          lastPlan = p;
          if (!p.ok) {
            el.innerHTML = html`<div class="errors">${p.errors.map((e) => html`<div>${e}</div>`)}</div>`.s;
            return;
          }
          root.querySelector("#h-total").textContent = `자동 계산: ${won(o.principal + p.profitCalc)}`;
          root.querySelector("#h-per").textContent = `자동 균등분할 시 1회 ${won(Math.floor(p.totalExpected / p.count))}`;
          const diff = p.lastAmount - p.perAmount;
          const rows = p.installments;
          const shown = rows.length > 12 ? [...rows.slice(0, 8), null, ...rows.slice(-3)] : rows;
          el.innerHTML = html`
            <div class="calc-box">
              <div class="calc-line"><span>실행금액</span><b>${won(p.principal)}</b></div>
              <div class="calc-line"><span>약정수익 (${p.rate}%)</span><b>${won(p.profit)}</b></div>
              <div class="calc-line total"><span>총 회수예정금액</span><b>${won(p.totalExpected)}</b></div>
            </div>
            <div class="calc-box" style="margin-top:10px">
              <div class="calc-line"><span>기간</span><b>${p.termLabel} (${p.termDays}일)</b></div>
              <div class="calc-line"><span>회수주기</span><b>${p.methodLabel === "만기 일시상환" ? "만기 1회" : p.cycleLabel}</b></div>
              <div class="calc-line"><span>회수방식</span><b>${p.methodLabel}</b></div>
              <div class="calc-line"><span>회수 횟수</span><b>${num(p.count)}회</b></div>
              <div class="calc-line"><span>1회 회수예정금액</span><b style="color:var(--accent)">${won(p.perAmount)}</b></div>
              ${p.count > 1 && diff !== 0 ? html`<div class="calc-line"><span>마지막 회차 (조정)</span><b>${won(p.lastAmount)}</b></div>` : ""}
              <div class="calc-line"><span>첫 회수일 ~ 만료일</span><b>${md(p.installments[0].dueDate)} ~ ${p.expiryDate}</b></div>
            </div>
            ${p.count > 1 && diff !== 0 && p.methodLabel.includes("균등")
              ? html`<p class="small muted">나누어 떨어지지 않는 ${won(Math.abs(diff))}은 마지막 회차에서 자동 조정되어 합계가 정확히 ${won(p.totalExpected)}이 됩니다.</p>`
              : ""}
            <div class="table-wrap" style="margin-top:10px"><table class="t">
              <thead><tr><th class="num">회차</th><th>예정일</th><th class="num">예정액</th></tr></thead>
              <tbody>${shown.map((r) => (r ? html`<tr><td class="num">${r.seq}</td><td>${dfull(r.dueDate)}</td><td class="num">${won(r.amount)}</td></tr>` : html`<tr><td colspan="3" class="muted" style="text-align:center">⋮</td></tr>`))}</tbody>
              <tfoot><tr><td></td><td>합계</td><td class="num">${won(p.totalExpected)}</td></tr></tfoot>
            </table></div>`.s;
        }, 200);
      };
      form.addEventListener("input", update);
      form.addEventListener("change", update);
      update();

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const o = collect();
        if (!o.customerName || !o.companyName) return toast("고객명과 투자처명을 입력하세요.", true);
        if (lastPlan && !lastPlan.ok) return toast(lastPlan.errors[0], true);
        const btn = form.querySelector("#save-btn");
        btn.disabled = true;
        try {
          if (editId) {
            const r = await api(`/investments/${editId}`, { method: "PUT", body: o });
            toast(r.regenerated ? "저장했습니다. 회수 스케줄을 다시 생성했습니다." : "저장했습니다.");
            state.meta = await api("/meta");
            location.hash = `#/investments/${editId}`;
          } else {
            const r = await api("/investments", { method: "POST", body: o });
            toast("투자를 등록했습니다.");
            state.meta = await api("/meta");
            location.hash = `#/investments/${r.id}`;
          }
        } catch (err) {
          toast(err.message, true);
        } finally {
          btn.disabled = false;
        }
      });
    },
  };
}

// ---------- 상세 (생애주기) ----------
function lifecycle(s, inv) {
  const paidOff = s.status === "완납";
  const overdueCls = s.overdueAmount === 0 ? "good" : s.status === "연체" ? "bad" : "warn";
  const step = (k, v, d, cls = "") => html`<div class="step ${cls}"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d}</div></div>`;
  return html`<div class="flow">
    ${step("① 실행금액", won(s.principal), s.execDate)}
    ${step("② 약정수익", won(s.profit), `수익률 ${pct(Number(s.rate))}`)}
    ${step("③ 총 회수예정", won(s.totalExpected), `원금 + 수익`)}
    ${step("④ 회수 스케줄", `${num(s.installments)}회`, `${s.term} · ${s.cycle} · 1회 ${won(s.perAmount)}`)}
    ${step("⑤ 실제 입금", won(s.collected), `${s.doneCount}/${s.installments}회 완료 · ${pct(s.progressPct)}`, s.collected ? "good" : "")}
    ${step("⑥ 지연·미수", won(s.overdueAmount), s.maxDelay ? `최대 ${s.maxDelay}일 지연` : "지연 없음", overdueCls)}
    ${step("⑦ 현재 잔액", won(s.outstanding), `남은 기간 ${s.remainingDays}일`, paidOff ? "" : "cur")}
    ${step("⑧ 완납", paidOff ? "완납" : pct(s.progressPct), paidOff ? "회수 완료" : `만료 ${inv.expiry_date}`, paidOff ? "done cur" : "")}
  </div>`;
}

export async function detailView({ params, query }) {
  const id = Number(params[0]);
  const d = await api(`/investments/${id}`);
  const s = d.summary;
  const inv = d.inv;
  const rowFilter = query.get("rows") ?? (d.rows.length > 40 ? "near" : "all");
  const today = d.asOf;
  let rows = d.rows;
  if (rowFilter === "unpaid") rows = rows.filter((r) => r.shortfall > 0 && r.dueDate <= today);
  if (rowFilter === "near") {
    const idx = rows.findIndex((r) => r.dueDate >= today);
    const firstUnpaid = rows.findIndex((r) => r.shortfall > 0);
    const from = Math.max(0, Math.min(firstUnpaid < 0 ? rows.length : firstUnpaid, (idx < 0 ? rows.length : idx) - 5));
    rows = rows.slice(from, (idx < 0 ? rows.length : idx) + 10);
  }
  const elapsedPct = (s.elapsedDays / s.totalDays) * 100;
  const asOfIdx = rows.findIndex((r) => r.dueDate > today);

  return {
    title: `투자 상세 · ${inv.code}`,
    html: html`
      <div class="detail-head">
        <div class="title">
          <div class="code">${inv.code} · ${inv.category || "구분 없음"}</div>
          <h2><a href="#/customers/${inv.customer_id}">${inv.customer_name}</a> <span class="muted" style="font-weight:500">/ <a href="#/companies/${inv.company_id}">${inv.company_name}</a></span></h2>
          <div>${statusChip(s.status)} ${expiryChip(s.expiry)} ${s.maxDelay ? html`<span class="chip s-overdue">${s.maxDelay}일 지연</span>` : ""}</div>
        </div>
        <div class="actions">
          <a class="btn" href="${downloadUrl("/export/schedule", { investmentId: id })}">⬇ 스케줄 엑셀</a>
          <a class="btn" href="#/investments/${id}/edit">✎ 수정</a>
          <button class="btn danger" id="del">삭제</button>
        </div>
      </div>

      <div class="card">
        <h3>투자 생애주기 <span class="muted small">(${dfull(today)} 기준)</span></h3>
        ${lifecycle(s, inv)}
        <div class="timeline">
          <div class="track"><div class="elapsed" style="width:${elapsedPct}%"></div><div class="paid" style="width:${s.progressPct}%"></div></div>
          <div class="labels"><span>실행 ${inv.exec_date}</span><span>경과 ${s.elapsedDays}일 / ${s.totalDays}일 · 남은 ${s.remainingDays}일</span><span>만료 ${inv.expiry_date}</span></div>
          <div class="legend" style="margin-top:6px"><span><i style="background:#c7d7f5"></i>기간 경과</span><span><i style="background:var(--green)"></i>회수 진행률 ${pct(s.progressPct)}</span></div>
        </div>
      </div>

      <div class="card" style="margin-top:12px">
        <div class="kv">
          <div><div class="k">실행금액</div><div class="v">${won(s.principal)}</div></div>
          <div><div class="k">약정 수익률</div><div class="v">${pct(Number(s.rate))}</div></div>
          <div><div class="k">약정 수익</div><div class="v">${won(s.profit)}</div></div>
          <div><div class="k">총 회수예정금액</div><div class="v">${won(s.totalExpected)}</div></div>
          <div><div class="k">현재까지 회수금액</div><div class="v" style="color:var(--green)">${won(s.collected)}</div></div>
          <div><div class="k">남은 회수금액</div><div class="v" style="color:var(--blue)">${won(s.outstanding)}</div></div>
          <div><div class="k">회수 진행률</div><div class="v">${pct(s.progressPct)}</div></div>
          <div><div class="k">연체 미수금</div><div class="v" style="color:var(--red)">${won(s.overdueAmount)}</div></div>
          <div><div class="k">기간 / 회수주기</div><div class="v">${s.term} (${s.termDays}일) · ${s.cycle}</div></div>
          <div><div class="k">회수방식</div><div class="v">${s.method}</div></div>
          <div><div class="k">실행일 → 만료일</div><div class="v">${inv.exec_date} → ${inv.expiry_date}</div></div>
          <div><div class="k">회수 경과일 / 남은 기간</div><div class="v">${s.elapsedDays}일 / ${s.remainingDays}일</div></div>
          <div><div class="k">다음 회수</div><div class="v">${s.nextDue ? `${md(s.nextDue.dueDate)} ${won(s.nextDue.amount)}` : "-"}</div></div>
          <div><div class="k">담당자</div><div class="v">${inv.manager || "-"} ${inv.contact ? html`<a href="tel:${inv.contact}">${inv.contact}</a>` : ""}</div></div>
          <div><div class="k">고객 연락처</div><div class="v">${inv.customer_phone ? html`<a href="tel:${inv.customer_phone}">${inv.customer_phone}</a>` : "-"}</div></div>
          <div><div class="k">메모</div><div class="v" style="font-weight:500">${inv.memo || "-"}</div></div>
        </div>
      </div>

      <div class="section-title"><h2>회수 스케줄 · 실제 입금</h2><span class="spacer"></span>
        <button class="btn sm green" id="bulk-full" disabled>선택 회차 전액 입금</button>
      </div>
      <div class="tabs">
        ${[["near", "기준일 전후"], ["all", `전체 ${d.rows.length}회`], ["unpaid", "미수 회차"]].map(
          ([k, l]) => html`<button type="button" data-rows="${k}" class="${k === rowFilter ? "on" : ""}">${l}</button>`,
        )}
      </div>
      <div class="table-wrap t-scroll"><table class="t" id="sched">
        <thead><tr><th><input type="checkbox" id="chk-all" title="미수 회차 전체 선택" /></th><th class="num">회차</th><th>예정일</th><th class="num">예정액</th><th class="num">실제입금</th><th>입금일</th><th class="num">미수금</th><th>상태</th><th class="num">입금 처리</th></tr></thead>
        <tbody>
          ${rows.length ? "" : html`<tr><td colspan="9" class="empty">해당 회차가 없습니다.</td></tr>`}
          ${rows.map(
            (r, i) => html`<tr class="r-${r.level} ${i === asOfIdx && i > 0 ? "asof-line" : ""}">
              <td>${r.shortfall > 0 ? html`<input type="checkbox" class="chk" value="${r.seq}" />` : ""}</td>
              <td class="num">${r.seq}</td>
              <td class="nowrap">${dfull(r.dueDate)}</td>
              <td class="num"><a href="#" data-amount="${r.seq}" title="예정액 수정">${won(r.amount)}</a></td>
              <td class="num">${r.paid ? won(r.paid) : html`<span class="muted">0</span>`}</td>
              <td class="nowrap small">${r.lastPaidDate ? md(r.lastPaidDate) : ""}${r.lateDays ? html` <span class="muted">(${r.lateDays}일 늦음)</span>` : ""}</td>
              <td class="num">${r.shortfall ? html`<b style="color:${r.dueDate <= today ? "var(--red)" : "inherit"}">${won(r.shortfall)}</b>` : "0"}</td>
              <td class="nowrap">${chip(r.status, r.level)}${r.delayDays ? html` <span class="small" style="color:var(--red)">${r.delayDays}일</span>` : ""}</td>
              <td><div class="row-actions">
                ${r.shortfall > 0 ? html`<button class="btn sm" data-full="${r.seq}" title="미수금 전액을 입금 처리">전액</button><button class="btn sm" data-pay="${r.seq}">입금</button>` : ""}
              </div></td>
            </tr>`,
          )}
        </tbody>
        <tfoot><tr><td></td><td></td><td>전체 합계</td><td class="num">${won(s.totalExpected)}</td><td class="num">${won(d.rows.reduce((a, r) => a + r.paid, 0))}</td><td></td><td class="num">${won(d.rows.reduce((a, r) => a + r.shortfall, 0))}</td><td colspan="2"></td></tr></tfoot>
      </table></div>
      <p class="small muted">회차를 지정한 입금은 그 회차에 먼저 충당되고, 회차 미지정(일괄) 입금이나 초과분은 가장 오래된 미수 회차부터 자동 충당됩니다. 점선은 기준일 위치입니다.</p>

      <div class="grid g2" style="margin-top:12px">
        <div class="card">
          <h3>입금 등록 (일괄 · 회차 미지정)</h3>
          <form id="lump" class="fields" style="grid-template-columns:1fr 1fr" novalidate>
            <div class="field"><label>입금액</label><input class="money" name="amount" inputmode="numeric" placeholder="예: 500,000" /></div>
            <div class="field"><label>입금일</label><input type="date" name="paidDate" value="${state.today < today ? state.today : today}" /></div>
            <div class="field wide"><label>메모</label><input name="memo" placeholder="선택" /></div>
            <div class="field wide"><button class="btn primary" type="submit">입금 등록</button></div>
          </form>
        </div>
        <div class="card">
          <h3>입금 기록 (${d.payments.length}건)</h3>
          <div class="t-scroll" style="max-height:300px">
            ${d.payments.length
              ? html`<table class="t"><thead><tr><th>입금일</th><th class="num">회차</th><th class="num">금액</th><th>메모</th><th></th></tr></thead><tbody>
                ${d.payments.map(
                  (p) => html`<tr class="${p.future ? "r-future" : ""}"><td class="nowrap">${p.paid_date}${p.future ? html` <span class="pill-note">기준일 이후</span>` : ""}</td>
                    <td class="num">${p.seq ?? "일괄"}</td><td class="num">${won(p.amount)}</td><td class="small">${p.memo}</td>
                    <td><div class="row-actions"><button class="btn sm" data-edit-pay="${p.id}">수정</button><button class="btn sm danger" data-del-pay="${p.id}">삭제</button></div></td></tr>`,
                )}</tbody></table>`
              : html`<div class="empty">입금 기록이 없습니다.</div>`}
          </div>
        </div>
      </div>

      <div class="section-title"><h2>수정 이력 (${d.audit.length}건)</h2></div>
      <div class="card t-scroll" style="max-height:420px">${d.audit.length ? d.audit.map(auditItem) : html`<div class="empty">이력이 없습니다.</div>`}</div>
    `,
    after(root, rerender) {
      bindMoneyInputs(root);
      const refresh = () => rerender();
      const findRow = (seq) => d.rows.find((r) => r.seq === Number(seq));
      const defaultDate = (r) => (r.dueDate <= state.today ? r.dueDate : state.today);

      root.querySelectorAll("[data-rows]").forEach((b) =>
        b.addEventListener("click", () => (location.hash = `#/investments/${id}?rows=${b.dataset.rows}`)),
      );
      root.querySelector("#del").addEventListener("click", async () => {
        const ok = await confirmBox(
          "투자건 삭제",
          `${inv.code} (${inv.customer_name} / ${won(inv.principal)})\n입금 ${d.payments.length}건이 함께 목록에서 사라집니다.\n삭제 기록은 이력에 남습니다. 정말 삭제할까요?`,
          { confirmLabel: "삭제" },
        );
        if (!ok) return;
        await api(`/investments/${id}`, { method: "DELETE" });
        toast("삭제했습니다.");
        location.hash = "#/investments";
      });

      root.querySelectorAll("[data-full]").forEach((b) =>
        b.addEventListener("click", async () => {
          b.disabled = true;
          try {
            await api(`/investments/${id}/payments/full`, { method: "POST", body: { seqs: [Number(b.dataset.full)] }, query: { asOf: state.today } });
            toast(`${b.dataset.full}회차 전액 입금 처리`);
            refresh();
          } catch (e) {
            toast(e.message, true);
            b.disabled = false;
          }
        }),
      );
      root.querySelectorAll("[data-pay]").forEach((b) =>
        b.addEventListener("click", () => {
          const r = findRow(b.dataset.pay);
          modal({
            title: `${r.seq}회차 입금 (${dfull(r.dueDate)})`,
            body: html`<div class="fields" style="grid-template-columns:1fr 1fr">
              <div class="field"><label>예정액</label><div><b>${won(r.amount)}</b> · 입금 ${won(r.paid)} · 미수 <b style="color:var(--red)">${won(r.shortfall)}</b></div></div>
              <div class="field"></div>
              <div class="field"><label>입금액</label><input class="money" name="amount" value="${num(r.shortfall)}" inputmode="numeric" /></div>
              <div class="field"><label>입금일</label><input type="date" name="paidDate" value="${defaultDate(r)}" /></div>
              <div class="field wide"><label>메모</label><input name="memo" /></div>
            </div><p class="small muted">예정액보다 적게 입력하면 '일부입금'으로 표시되고 차액이 미수금으로 남습니다.</p>`,
            submitLabel: "입금 저장",
            onOpen: bindMoneyInputs,
            onSubmit: async (f) => {
              const o = formData(f);
              await api(`/investments/${id}/payments`, { method: "POST", body: { amount: moneyVal(o.amount), paidDate: o.paidDate, memo: o.memo, seq: r.seq } });
              toast("입금을 저장했습니다.");
              refresh();
            },
          });
        }),
      );
      root.querySelectorAll("[data-amount]").forEach((a) =>
        a.addEventListener("click", (e) => {
          e.preventDefault();
          const r = findRow(a.dataset.amount);
          modal({
            title: `${r.seq}회차 예정액 수정`,
            body: html`<div class="field"><label>예정액 (현재 ${won(r.amount)})</label><input class="money" name="amount" value="${num(r.amount)}" inputmode="numeric" /></div>
              <label style="display:flex;gap:8px;margin-top:12px;align-items:center"><input type="checkbox" name="adjustLast" checked /> 차액을 마지막 회차에서 조정 (총 회수예정금액 유지)</label>
              <p class="small muted">체크를 해제하면 총 회수예정금액이 차액만큼 바뀝니다. 수정 내용은 이력에 남습니다.</p>`,
            onOpen: bindMoneyInputs,
            onSubmit: async (f) => {
              await api(`/investments/${id}/schedules/${r.seq}`, { method: "PUT", body: { amount: moneyVal(f.amount.value), adjustLast: f.adjustLast.checked } });
              toast("예정액을 수정했습니다.");
              refresh();
            },
          });
        }),
      );

      const bulkBtn = root.querySelector("#bulk-full");
      const chks = [...root.querySelectorAll(".chk")];
      const syncBulk = () => {
        const n = chks.filter((c) => c.checked).length;
        bulkBtn.disabled = !n;
        bulkBtn.textContent = n ? `선택 ${n}회차 전액 입금` : "선택 회차 전액 입금";
      };
      chks.forEach((c) => c.addEventListener("change", syncBulk));
      root.querySelector("#chk-all").addEventListener("change", (e) => {
        chks.forEach((c) => (c.checked = e.target.checked && findRow(c.value).dueDate <= today));
        syncBulk();
      });
      bulkBtn.addEventListener("click", async () => {
        const seqs = chks.filter((c) => c.checked).map((c) => Number(c.value));
        const total = seqs.reduce((a, s) => a + findRow(s).shortfall, 0);
        if (!(await confirmBox("선택 회차 전액 입금", `${seqs.length}개 회차, 합계 ${won(total)}을 각 예정일자로 입금 처리합니다.`, { danger: false }))) return;
        const r = await api(`/investments/${id}/payments/full`, { method: "POST", body: { seqs }, query: { asOf: state.today } });
        toast(`${r.count}개 회차 입금 처리`);
        refresh();
      });

      root.querySelector("#lump").addEventListener("submit", async (e) => {
        e.preventDefault();
        const o = formData(e.target);
        try {
          await api(`/investments/${id}/payments`, { method: "POST", body: { amount: moneyVal(o.amount), paidDate: o.paidDate, memo: o.memo } });
          toast("입금을 등록했습니다.");
          refresh();
        } catch (err) {
          toast(err.message, true);
        }
      });

      root.querySelectorAll("[data-del-pay]").forEach((b) =>
        b.addEventListener("click", async () => {
          const p = d.payments.find((x) => x.id === Number(b.dataset.delPay));
          if (!(await confirmBox("입금 기록 삭제", `${p.paid_date} ${won(p.amount)} 입금 기록을 삭제할까요?\n삭제 내용은 수정 이력에 남습니다.`, { confirmLabel: "삭제" }))) return;
          await api(`/payments/${p.id}`, { method: "DELETE" });
          toast("삭제했습니다.");
          refresh();
        }),
      );
      root.querySelectorAll("[data-edit-pay]").forEach((b) =>
        b.addEventListener("click", () => {
          const p = d.payments.find((x) => x.id === Number(b.dataset.editPay));
          modal({
            title: "입금 기록 수정",
            body: html`<div class="fields" style="grid-template-columns:1fr 1fr">
              <div class="field"><label>입금액</label><input class="money" name="amount" value="${num(p.amount)}" inputmode="numeric" /></div>
              <div class="field"><label>입금일</label><input type="date" name="paidDate" value="${p.paid_date}" /></div>
              <div class="field"><label>회차 (비우면 일괄)</label><input name="seq" type="number" min="1" value="${p.seq ?? ""}" /></div>
              <div class="field"><label>메모</label><input name="memo" value="${p.memo}" /></div>
            </div><p class="small muted">변경 전·후 금액이 수정 이력에 기록됩니다.</p>`,
            onOpen: bindMoneyInputs,
            onSubmit: async (f) => {
              const o = formData(f);
              await api(`/payments/${p.id}`, { method: "PUT", body: { amount: moneyVal(o.amount), paidDate: o.paidDate, memo: o.memo, seq: o.seq || null } });
              toast("수정했습니다.");
              refresh();
            },
          });
        }),
      );
    },
  };
}

const FIELD_KO = {
  exec_date: "실행일", principal: "실행금액", rate: "수익률", total_override: "총회수예정(직접)", total_expected: "총회수예정",
  term_value: "기간", term_unit: "기간단위", cycle_value: "주기", cycle_unit: "주기단위", method: "회수방식",
  first_due_date: "첫회수일", installment_amount: "1회금액", expiry_override: "만료일(직접)", manager: "담당자", contact: "연락처",
  category: "구분", memo: "메모", amount: "금액", paid_date: "입금일", seq: "회차", customer_id: "고객", company_id: "투자처",
  name: "이름", phone: "연락처", overdueDays: "연체기준일", paidDate: "입금일", code: "투자번호", totalExpected: "총회수예정",
  term: "기간", cycle: "주기", count: "회차수", username: "아이디", role: "권한", lastSeq: "마지막회차 조정",
};
const ACTION_KO = { create: "등록", update: "수정", "update+reschedule": "수정(스케줄 재생성)", delete: "삭제", amount: "예정액 수정", password: "비밀번호 변경" };
const ENTITY_KO = { investment: "투자", payment: "입금", schedule: "회차", customer: "고객", company: "투자처", user: "계정", settings: "설정" };
const kst = (t) => new Date(t.replace(" ", "T") + "Z").toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false });
const fmtV = (v) => (typeof v === "number" && Math.abs(v) >= 1000 ? num(v) : v ?? "없음");

export function auditItem(a) {
  let detail = {};
  try {
    detail = JSON.parse(a.detail);
  } catch {}
  const parts = Object.entries(detail).map(([k, v]) => {
    if (Array.isArray(v) && v.length === 2) return html`<code>${FIELD_KO[k] ?? k}: ${fmtV(v[0])} → ${fmtV(v[1])}</code> `;
    if (v && typeof v === "object") return html`<code>${k}: ${JSON.stringify(v)}</code> `;
    return html`<code>${FIELD_KO[k] ?? k}: ${fmtV(v)}</code> `;
  });
  return html`<div class="audit-item">
    <div class="when">${kst(a.at)} · ${a.username || "-"}${a.code ? html` · <a href="#/investments/${a.investment_id}">${a.code}</a>` : ""}</div>
    <b>${ENTITY_KO[a.entity] ?? a.entity} ${ACTION_KO[a.action] ?? a.action}</b> ${parts}
  </div>`;
}
