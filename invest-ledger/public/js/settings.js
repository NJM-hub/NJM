import { html, api, toast, state, confirmBox, formData, num } from "./core.js";
import { auditItem } from "./investments.js";

export async function settingsView() {
  const d = await api("/settings");
  const isAdmin = state.user.role === "admin";
  return {
    title: "설정 · 보안",
    html: html`
      <div class="grid g2">
        <div class="card">
          <h3>연체 기준</h3>
          <form id="f-settings" class="inline" novalidate>
            <span>예정일이 지나고</span><input class="input" name="overdueDays" type="number" min="0" max="365" value="${d.settings.overdueDays}" style="width:80px" /><span>일 초과 미입금이면 <b style="color:var(--red)">연체</b></span>
            <button class="btn primary sm" type="submit">저장</button>
          </form>
          <p class="small muted">그 이내는 <b style="color:var(--yellow)">지연</b>으로 표시합니다. 만료일 경과 후 잔액이 남으면 항상 연체입니다.<br />만료 표시: 30일 이상 정상 · 15~30일 주의 · 7~15일 임박 · 7일 이내 긴급 · 경과 시 연체</p>
        </div>
        <div class="card">
          <h3>비밀번호 변경</h3>
          <form id="f-pw" class="fields" style="grid-template-columns:1fr 1fr" novalidate>
            <div class="field"><label>현재 비밀번호</label><input type="password" name="current" autocomplete="current-password" /></div>
            <div class="field"><label>새 비밀번호 (8자 이상)</label><input type="password" name="next" autocomplete="new-password" /></div>
            <div class="field"><button class="btn primary" type="submit">변경</button></div>
          </form>
          <p class="small muted">비밀번호는 scrypt로 암호화되어 저장됩니다. 변경하면 다른 기기의 로그인은 모두 종료됩니다.</p>
        </div>

        <div class="card">
          <h3>계정 관리</h3>
          <table class="t"><thead><tr><th>아이디</th><th>권한</th><th>최근 로그인</th><th></th></tr></thead>
            <tbody>${d.users.map(
              (u) => html`<tr><td><b>${u.username}</b></td><td>${u.role === "admin" ? "관리자" : "직원"}</td><td class="small">${u.last_login ?? "-"}</td>
                <td>${isAdmin && u.id !== state.user.id ? html`<button class="btn sm danger" data-del-user="${u.id}" data-name="${u.username}">삭제</button>` : ""}</td></tr>`,
            )}</tbody></table>
          ${isAdmin
            ? html`<form id="f-user" class="fields" style="grid-template-columns:1fr 1fr 110px auto;margin-top:12px;align-items:end" novalidate>
                <div class="field"><label>새 아이디</label><input name="username" autocomplete="off" /></div>
                <div class="field"><label>비밀번호</label><input type="password" name="password" autocomplete="new-password" /></div>
                <div class="field"><label>권한</label><select name="role"><option value="admin">관리자</option><option value="staff">직원</option></select></div>
                <div class="field"><button class="btn" type="submit">추가</button></div>
              </form>`
            : ""}
        </div>

        <div class="card">
          <h3>데이터베이스 백업</h3>
          <p class="small muted" style="margin-top:0">서버 시작 시와 매일 1회 자동 백업되며 최근 30개를 보관합니다 (data/backups). 엑셀 업로드 전에도 자동 백업합니다.</p>
          <div class="toolbar"><button class="btn" id="backup">지금 백업</button><a class="btn primary" href="/api/backup/download">⬇ 백업 파일 내려받기</a></div>
          <div class="t-scroll" style="max-height:180px">
            <table class="t"><tbody>${d.backups.map((b) => html`<tr><td class="small">${b.name}</td><td class="num small">${num(b.size / 1024)} KB</td></tr>`)}</tbody></table>
          </div>
        </div>
      </div>

      <div class="section-title"><h2>최근 수정 이력 (전체)</h2></div>
      <div class="card">${d.audit.length ? d.audit.map(auditItem) : html`<div class="empty">이력이 없습니다.</div>`}</div>
    `,
    after(root, rerender) {
      root.querySelector("#f-settings").addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          await api("/settings", { method: "PUT", body: { overdueDays: Number(e.target.overdueDays.value) } });
          state.meta = await api("/meta");
          toast("저장했습니다. 모든 상태가 새 기준으로 다시 계산됩니다.");
          rerender();
        } catch (err) {
          toast(err.message, true);
        }
      });
      root.querySelector("#f-pw").addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          await api("/password", { method: "POST", body: formData(e.target) });
          toast("비밀번호를 변경했습니다.");
          e.target.reset();
        } catch (err) {
          toast(err.message, true);
        }
      });
      root.querySelector("#f-user")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          await api("/users", { method: "POST", body: formData(e.target) });
          toast("계정을 추가했습니다.");
          rerender();
        } catch (err) {
          toast(err.message, true);
        }
      });
      root.querySelectorAll("[data-del-user]").forEach((b) =>
        b.addEventListener("click", async () => {
          if (!(await confirmBox("계정 삭제", `${b.dataset.name} 계정을 삭제할까요?`, { confirmLabel: "삭제" }))) return;
          await api(`/users/${b.dataset.delUser}`, { method: "DELETE" });
          toast("삭제했습니다.");
          rerender();
        }),
      );
      root.querySelector("#backup").addEventListener("click", async () => {
        const r = await api("/backup", { method: "POST" });
        toast(`백업 완료: ${r.name}`);
        rerender();
      });
    },
  };
}
