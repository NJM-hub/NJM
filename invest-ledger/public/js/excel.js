import { html, api, won, toast, downloadUrl, asOf, state, dfull, confirmBox } from "./core.js";

export async function excelView() {
  const year = asOf().slice(0, 4);
  const dl = (label, path, q = {}, desc = "") =>
    html`<a class="btn" style="justify-content:flex-start;flex-direction:column;align-items:flex-start;padding:12px 14px;white-space:normal" href="${downloadUrl(path, q)}">
      <b>⬇ ${label}</b><span class="muted small" style="font-weight:500">${desc}</span></a>`;
  return {
    title: "엑셀 다운로드 · 업로드",
    html: html`
      <div class="section-title" style="margin-top:0"><h2>Excel 다운로드</h2><span class="muted small">${dfull(asOf())} 기준 계산</span></div>
      <div class="grid g3">
        ${dl("전체 투자목록", "/export/investments", {}, "투자건별 실행·회수·잔액·상태, 합계 포함")}
        ${dl("고객별 투자목록", "/export/customers", {}, "고객별 요약 + 투자내역 시트")}
        ${dl(`월별 실행금액 (${year})`, "/export/monthly-exec", { year }, "월·실행금액·투자건수, 총 실행금액")}
        ${dl(`월별 회수금액 (${year})`, "/export/monthly-collect", { year }, "예정회수액·실제회수액·미회수")}
        ${dl("회수 스케줄 (전체)", "/export/schedule", {}, "모든 투자건의 회차별 예정/입금/미수")}
        ${dl("연체 목록", "/export/overdue", {}, "연체·미수 투자건 + 미수 회차 상세")}
      </div>

      <div class="section-title"><h2>Excel 업로드 (기존 장부 가져오기)</h2></div>
      <div class="card">
        <p style="margin-top:0">기존 투자장부를 양식에 맞춰 올리면 투자건·고객·투자처·회수 스케줄이 자동으로 만들어집니다. <b>기회수금액</b>을 넣으면 앞 회차부터 예정일자로 입금 처리됩니다. 업로드 전에 DB가 자동 백업됩니다.</p>
        <div class="toolbar">
          <a class="btn" href="${downloadUrl("/export/template")}">⬇ 업로드 양식 받기</a>
          <label class="btn primary">📂 엑셀 파일 선택 (.xlsx)<input type="file" id="file" accept=".xlsx" hidden /></label>
        </div>
        <div id="preview"></div>
      </div>
    `,
    after(root) {
      const box = root.querySelector("#preview");
      root.querySelector("#file").addEventListener("change", async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        box.innerHTML = '<div class="muted">읽는 중…</div>';
        try {
          const d = await api("/import/preview", { method: "POST", raw: await f.arrayBuffer() });
          const ok = d.rows.filter((r) => !r.errors.length);
          box.innerHTML = html`
            ${d.missingColumns.length ? html`<div class="errors" style="margin-bottom:10px">필수 열을 찾지 못했습니다: ${d.missingColumns.join(", ")}</div>` : ""}
            <p><b>${d.rows.length}</b>행 중 <b style="color:var(--green)">${ok.length}</b>행 가져오기 가능${d.rows.length - ok.length ? html`, <b style="color:var(--red)">${d.rows.length - ok.length}</b>행 오류 (제외됨)` : ""}</p>
            <div class="table-wrap t-scroll" style="max-height:420px"><table class="t">
              <thead><tr><th>행</th><th>고객</th><th>투자처</th><th>실행일</th><th class="num">실행금액</th><th class="num">수익률</th><th>기간</th><th>주기</th><th class="num">총회수예정</th><th class="num">회차</th><th class="num">1회금액</th><th class="num">기회수</th><th>확인</th></tr></thead>
              <tbody>${d.rows.map((r) => {
                const i = r.input;
                const U = { day: "일", week: "주", month: "개월" };
                return html`<tr class="${r.errors.length ? "r-overdue" : ""}">
                  <td>${r.row}</td><td>${i.customerName}</td><td>${i.companyName}</td><td>${i.execDate}</td><td class="num">${won(i.principal)}</td><td class="num">${i.rate}%</td>
                  <td>${i.termValue}${U[i.termUnit] ?? i.termUnit}</td><td>${i.cycleValue}${U[i.cycleUnit] ?? i.cycleUnit}마다</td>
                  <td class="num">${r.summary ? won(r.summary.totalExpected) : ""}</td><td class="num">${r.summary?.count ?? ""}</td><td class="num">${r.summary ? won(r.summary.perAmount) : ""}</td>
                  <td class="num">${won(i.collected)}</td>
                  <td>${r.errors.length ? html`<span style="color:var(--red)">${r.errors.join(", ")}</span>` : html`<span class="chip s-normal">OK</span>`}</td></tr>`;
              })}</tbody></table></div>
            <div class="toolbar" style="margin-top:12px"><span class="spacer"></span><button class="btn primary" id="commit" ${ok.length ? "" : "disabled"}>${ok.length}건 가져오기</button></div>`.s;
          box.querySelector("#commit")?.addEventListener("click", async (ev) => {
            if (!(await confirmBox("엑셀 가져오기", `${ok.length}건의 투자를 등록합니다. 계속할까요?`, { danger: false }))) return;
            ev.target.disabled = true;
            try {
              const r = await api("/import/commit", { method: "POST", body: { rows: ok.map((x) => x.input) } });
              state.meta = await api("/meta");
              toast(`${r.count}건을 가져왔습니다.`);
              location.hash = "#/investments";
            } catch (err) {
              toast(err.message, true);
              ev.target.disabled = false;
            }
          });
        } catch (err) {
          box.innerHTML = html`<div class="errors">${err.message}</div>`.s;
        }
        e.target.value = "";
      });
    },
  };
}
