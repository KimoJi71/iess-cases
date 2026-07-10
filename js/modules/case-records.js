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
      const form = root.querySelector("[data-records-filter]");
      startDate = form.elements.startDate.value || null;
      endDate = form.elements.endDate.value || null;
      render();
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
    if (root) root.removeEventListener("click", onRootClick);
    root = container;
    startDate = today();
    endDate = today();
    viewingId = null;
    root.addEventListener("click", onRootClick);
    render();
  }

  function unmount() {
    if (root) root.removeEventListener("click", onRootClick);
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
      </section>
    `;
  }

  return { mount, unmount };
})();
