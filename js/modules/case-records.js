window.CaseRecordsModule = (function () {
  const store = AppData.createCaseStore(AppData.SEED_CASES);
  let root = null;
  let startDate = null;
  let endDate = null;
  let viewingId = null;

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getCaseStatus(c) {
    return c.closed ? "結案" : "未結案";
  }

  function getVisibleCases() {
    return store
      .getAll()
      .filter((c) => !startDate || c.repairDate >= startDate)
      .filter((c) => !endDate || c.repairDate <= endDate)
      .sort((a, b) => (a.repairDate < b.repairDate ? 1 : a.repairDate > b.repairDate ? -1 : 0));
  }

  function renderRows(cases) {
    if (!cases.length) {
      return `<tr><td colspan="13" class="empty-state">無資料</td></tr>`;
    }

    return cases.map((c) => `
      <tr>
        <td><button type="button" class="btn" data-action="view" data-id="${escapeHtml(c.id)}">查看</button></td>
        <td>${escapeHtml(c.repairDate)}</td>
        <td>${escapeHtml(c.id)}</td>
        <td>${escapeHtml(c.customerName)}</td>
        <td>${escapeHtml(c.storeName)}</td>
        <td>${escapeHtml(c.region)}</td>
        <td>${escapeHtml(c.workCategory)}</td>
        <td>${escapeHtml(c.repairItem)}</td>
        <td>${escapeHtml(c.repairReason)}</td>
        <td>${escapeHtml(c.faultDescription)}</td>
        <td>${escapeHtml(c.actualReason)}</td>
        <td>${escapeHtml(c.assignee)}</td>
        <td>${escapeHtml(getCaseStatus(c))}</td>
      </tr>
    `).join("");
  }

  function detailItem(label, value, full = false) {
    return `
      <div class="detail-item${full ? " detail-full" : ""}">
        <span class="detail-label">${escapeHtml(label)}</span>
        <span class="detail-value">${escapeHtml(value || "—")}</span>
      </div>
    `;
  }

  function renderEquipmentSection(c) {
    if (!c.equipment) {
      return `<p class="detail-empty">尚無設備資料</p>`;
    }
    const eq = c.equipment;
    return `
      <div class="detail-grid">
        ${detailItem("客戶名稱", eq.customer)}
        ${detailItem("門市名稱", eq.store)}
        ${detailItem("設備區域", eq.area)}
        ${detailItem("內／外", eq.io)}
        ${detailItem("型號", eq.model)}
      </div>
    `;
  }

  function renderProcessSection(c) {
    const methods = c.processMethods || [];
    const methodsHtml = methods.length
      ? `
        <div class="detail-full">
          <span class="detail-label">處理方式</span>
          <table class="data-table detail-table">
            <thead>
              <tr><th>大分類</th><th>中分類</th><th>小分類</th><th>數量</th></tr>
            </thead>
            <tbody>
              ${methods.map((m) => `
                <tr>
                  <td>${escapeHtml(m.large)}</td>
                  <td>${escapeHtml(m.medium)}</td>
                  <td>${escapeHtml(m.small)}</td>
                  <td>${escapeHtml(m.qty)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `
      : `
        <div class="detail-full">
          <span class="detail-label">處理方式</span>
          <p class="detail-empty">無處理方式</p>
        </div>
      `;

    return `
      <div class="detail-grid">
        ${detailItem("實際維修原因", c.actualReason, true)}
        ${methodsHtml}
        ${detailItem("備註", c.remarks, true)}
        ${detailItem("處理狀態", c.processStatus)}
      </div>
    `;
  }

  function renderDetailModal(c) {
    if (!c) return "";
    return `
      <div class="modal-backdrop" role="presentation">
        <section class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="detail-title">
          <div class="modal-header">
            <div>
              <h2 id="detail-title">案件明細 ${escapeHtml(c.id)}</h2>
              <p>檢視案件內容（唯讀，不可編輯）。</p>
            </div>
            <button type="button" class="btn" data-action="dismiss-detail" aria-label="關閉">關閉</button>
          </div>

          <section class="form-section">
            <h3>案件資料</h3>
            <div class="detail-grid">
              ${detailItem("案件編號", c.id)}
              ${detailItem("叫修日期", c.repairDate)}
              ${detailItem("再次叫修日期", c.reRepairDate)}
              ${detailItem("完工日期", c.completionDate)}
              ${detailItem("工項分類", c.workCategory)}
              ${detailItem("叫修人員", c.requester)}
              ${detailItem("客戶名稱", c.customerName)}
              ${detailItem("門市名稱", c.storeName)}
              ${detailItem("服務等級", c.serviceLevel)}
              ${detailItem("門市地址", c.storeAddress, true)}
              ${detailItem("叫修項目", c.repairItem)}
              ${detailItem("叫修原因", c.repairReason)}
              ${detailItem("故障描述", c.faultDescription, true)}
            </div>
          </section>

          <section class="form-section">
            <h3>設備資料</h3>
            ${renderEquipmentSection(c)}
          </section>

          <section class="form-section">
            <h3>處理資料</h3>
            ${renderProcessSection(c)}
          </section>

          <div class="modal-actions">
            <button type="button" class="btn btn-primary" data-action="dismiss-detail">關閉</button>
          </div>
        </section>
      </div>
    `;
  }

  function applyDateRange() {
    const form = root.querySelector("[data-records-filter]");
    if (!form) return;
    let start = form.elements.startDate.value || null;
    let end = form.elements.endDate.value || null;
    // 若使用者把結束日期選在開始日期之前，自動對調避免查不到資料
    if (start && end && start > end) {
      [start, end] = [end, start];
    }
    startDate = start;
    endDate = end;
    render();
  }

  function onRootChange(e) {
    if (!root.contains(e.target)) return;
    if (e.target.name === "startDate" || e.target.name === "endDate") {
      applyDateRange();
    }
  }

  function onRootClick(e) {
    if (e.target.classList.contains("modal-backdrop") && root.contains(e.target)) {
      viewingId = null;
      render();
      return;
    }

    const actionBtn = e.target.closest("[data-action]");
    if (!actionBtn || !root.contains(actionBtn)) return;
    const { action, id } = actionBtn.dataset;

    if (action === "search") {
      applyDateRange();
      return;
    }
    if (action === "view") {
      viewingId = id;
      render();
      return;
    }
    if (action === "dismiss-detail") {
      viewingId = null;
      render();
    }
  }

  function mount(container) {
    if (root) {
      root.removeEventListener("click", onRootClick);
      root.removeEventListener("change", onRootChange);
    }
    root = container;
    startDate = today();
    endDate = today();
    viewingId = null;
    root.addEventListener("click", onRootClick);
    root.addEventListener("change", onRootChange);
    render();
  }

  function unmount() {
    if (root) {
      root.removeEventListener("click", onRootClick);
      root.removeEventListener("change", onRootChange);
    }
    root = null;
    viewingId = null;
  }

  function render() {
    if (!root) return;
    const cases = getVisibleCases();

    root.innerHTML = `
      <section class="case-records-module">
        <div class="toolbar">
          <form class="filter-fields" data-records-filter onsubmit="return false">
            <label>
              <span>開始日期</span>
              <input type="date" name="startDate" value="${escapeHtml(startDate)}" />
            </label>
            <label>
              <span>結束日期</span>
              <input type="date" name="endDate" value="${escapeHtml(endDate)}" />
            </label>
            <button type="button" class="btn btn-primary" data-action="search">搜尋</button>
          </form>
          <span class="result-count">共 ${cases.length} 筆</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>操作</th>
                <th>叫修日期</th>
                <th>案件編號</th>
                <th>客戶名稱</th>
                <th>門市名稱</th>
                <th>行政區域</th>
                <th>工項分類</th>
                <th>叫修項目</th>
                <th>叫修原因</th>
                <th>故障描述</th>
                <th>實際原因</th>
                <th>指派人員</th>
                <th>案件狀態</th>
              </tr>
            </thead>
            <tbody>
              ${renderRows(cases)}
            </tbody>
          </table>
        </div>
        ${viewingId ? renderDetailModal(store.getById(viewingId)) : ""}
      </section>
    `;
  }

  return { mount, unmount };
})();
