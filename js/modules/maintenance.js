window.MaintenanceModule = (function () {
  const store = AppData.createCaseStore(AppData.SEED_CASES);
  let root = null;
  let filterStatus = null;
  let today = () => new Date().toISOString().slice(0, 10);

  const lightTitles = {
    red: "緊急叫修",
    yellow: "逾期未完成",
    green: "案件完成",
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getLight(c) {
    if (c.processStatus === "案件完成") return "green";
    if (c.workCategory === "緊急叫修") return "red";
    if (c.estimatedDate && c.estimatedDate < today() && c.processStatus !== "案件完成") {
      return "yellow";
    }
    return null;
  }

  function getCaseStatus(c) {
    if (c.processStatus === "案件完成") return "已完成";
    const assigned =
      c.assignee && c.assignee !== "案件待辦" && c.estimatedDate && c.estimatedTime;
    return assigned ? "已派工" : "未派工";
  }

  function matchesFilter(c, filter) {
    if (!filter) return true;
    if (filter === "待汰換") return c.processStatus === "轉汰換";
    if (filter === "其他") {
      return !["待料", "待報價", "轉汰換", "轉原廠"].includes(c.processStatus);
    }
    return c.processStatus === filter;
  }

  function getVisibleCases() {
    return store
      .getAll()
      .filter((c) => !c.closed)
      .filter((c) => matchesFilter(c, filterStatus))
      .sort((a, b) => (a.repairDate < b.repairDate ? 1 : a.repairDate > b.repairDate ? -1 : 0));
  }

  function countByFilter(status) {
    return store.getAll().filter((c) => !c.closed && matchesFilter(c, status)).length;
  }

  function renderFilterButtons() {
    return AppData.FILTER_STATUSES.map((status) => {
      const activeClass = filterStatus === status ? " active" : "";
      return `
        <button type="button" class="filter-btn${activeClass}" data-filter="${escapeHtml(status)}">
          ${escapeHtml(status)} (${countByFilter(status)})
        </button>
      `;
    }).join("");
  }

  function renderLight(c) {
    const light = getLight(c);
    if (!light) return "";
    return `<span class="light light-${light}" title="${escapeHtml(lightTitles[light])}"></span>`;
  }

  function renderRows(cases) {
    if (!cases.length) {
      return `<tr><td colspan="14" class="empty-state">無資料</td></tr>`;
    }

    return cases.map((c) => `
      <tr>
        <td>
          <button type="button" class="btn" data-action="edit" data-id="${escapeHtml(c.id)}">編輯</button>
          <button type="button" class="btn" data-action="close" data-id="${escapeHtml(c.id)}">案件結案</button>
          <button type="button" class="btn" data-action="copy" data-id="${escapeHtml(c.id)}">複製 URL</button>
        </td>
        <td>${renderLight(c)}</td>
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
    const filterBtn = e.target.closest(".filter-btn");
    if (filterBtn && root.contains(filterBtn)) {
      const status = filterBtn.dataset.filter;
      filterStatus = filterStatus === status ? null : status;
      render();
      return;
    }

    const actionBtn = e.target.closest("[data-action]");
    if (actionBtn && root.contains(actionBtn)) {
      const { action, id } = actionBtn.dataset;
      if (action === "edit" || action === "close" || action === "copy") {
        console.log(action, id);
        return;
      }
    }

    if (e.target.closest("[data-action='create']")) {
      console.log("create");
    }
  }

  function mount(container) {
    if (root) root.removeEventListener("click", onRootClick);
    root = container;
    root.addEventListener("click", onRootClick);
    render();
  }

  function unmount() {
    if (root) root.removeEventListener("click", onRootClick);
    root = null;
  }

  function render() {
    if (!root) return;
    const cases = getVisibleCases();

    root.innerHTML = `
      <section class="maintenance-module">
        <div class="toolbar">
          <div class="toolbar-left" aria-label="案件篩選">
            ${renderFilterButtons()}
          </div>
          <div class="toolbar-right">
            <button type="button" class="btn btn-primary" data-action="create">新增叫修單</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>操作</th>
                <th>燈號</th>
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
