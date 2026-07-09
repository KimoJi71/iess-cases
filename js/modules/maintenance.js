window.MaintenanceModule = (function () {
  const store = AppData.createCaseStore(AppData.SEED_CASES);
  let root = null;
  let filterStatus = null;
  let modalMode = null;
  let editingId = null;
  let editDraft = null;
  let today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

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

  function renderOptions(items, selected = "") {
    return items.map((item) => `
      <option value="${escapeHtml(item)}" ${item === selected ? "selected" : ""}>${escapeHtml(item)}</option>
    `).join("");
  }

  function renderPlaceholderOptions(items, placeholder, selected = "") {
    return `
      <option value="">${escapeHtml(placeholder)}</option>
      ${renderOptions(items, selected)}
    `;
  }

  function getCustomer(customerName) {
    return AppData.CUSTOMERS.find((c) => c.name === customerName) || null;
  }

  function getStore(customerName, storeName) {
    return getCustomer(customerName)?.stores.find((s) => s.name === storeName) || null;
  }

  function renderStoreOptions(customerName, selected = "") {
    const stores = getCustomer(customerName)?.stores || [];
    return renderPlaceholderOptions(stores.map((store) => store.name), "請選擇門市", selected);
  }

  function setFieldValue(form, name, value) {
    const field = form.elements[name];
    if (field) field.value = value || "";
  }

  function onCustomerChange(customerName, form) {
    const storeSelect = form.elements.storeName;
    if (storeSelect) storeSelect.innerHTML = renderStoreOptions(customerName);
    setFieldValue(form, "storeAddress", "");
    setFieldValue(form, "serviceLevel", "");
    setFieldValue(form, "region", "");
  }

  function onStoreChange(customerName, storeName, form) {
    const storeData = getStore(customerName, storeName);
    setFieldValue(form, "storeAddress", storeData?.address || "");
    setFieldValue(form, "serviceLevel", storeData?.serviceLevel || "");
    setFieldValue(form, "region", storeData?.region || "");
  }

  function updateRepairReasonRequirement(form) {
    const isOther = form.elements.repairReason?.value === "其他";
    const textarea = form.elements.faultDescription;
    const marker = form.querySelector("[data-required-marker]");
    if (textarea) textarea.required = isOther;
    if (marker) marker.hidden = !isOther;
  }

  function closeModal() {
    modalMode = null;
    editingId = null;
    editDraft = null;
  }

  function cloneForEdit(c) {
    return structuredClone({
      ...c,
      processMethods: c.processMethods || [],
      equipmentScanned: Boolean(c.equipmentScanned),
      equipment: c.equipment || null,
      actualReason: c.actualReason || "",
      remarks: c.remarks || "",
      processStatus: c.processStatus || "尚未完成",
    });
  }

  function openEditModal(id) {
    const c = store.getById(id);
    if (!c) return;
    modalMode = "edit";
    editingId = id;
    editDraft = cloneForEdit(c);
    render();
  }

  function renderCaseInfoFields(values = {}) {
    const hasCustomer = Boolean(values.customerName);
    const storeOptions = hasCustomer
      ? renderStoreOptions(values.customerName, values.storeName)
      : `<option value="">請先選擇客戶</option>`;
    const repairReasonIsOther = values.repairReason === "其他";

    return `
      <div class="form-grid">
        <label>
          <span>工項分類 <strong>*</strong></span>
          <select name="workCategory" required>
            ${renderPlaceholderOptions(AppData.WORK_CATEGORIES, "請選擇工項分類", values.workCategory)}
          </select>
        </label>
        <label>
          <span>客戶名稱 <strong>*</strong></span>
          <select name="customerName" required>
            ${renderPlaceholderOptions(AppData.CUSTOMERS.map((c) => c.name), "請選擇客戶", values.customerName)}
          </select>
        </label>
        <label>
          <span>門市名稱 <strong>*</strong></span>
          <select name="storeName" required>
            ${storeOptions}
          </select>
        </label>
        <label>
          <span>門市地址</span>
          <input type="text" name="storeAddress" value="${escapeHtml(values.storeAddress)}" readonly />
        </label>
        <label>
          <span>服務等級</span>
          <input type="text" name="serviceLevel" value="${escapeHtml(values.serviceLevel)}" readonly />
        </label>
        <label>
          <span>行政區域</span>
          <input type="text" name="region" value="${escapeHtml(values.region)}" readonly />
        </label>
        <label>
          <span>叫修人員</span>
          <select name="requester">
            ${renderPlaceholderOptions(AppData.REQUESTERS, "請選擇叫修人員", values.requester)}
          </select>
        </label>
        <label>
          <span>叫修項目</span>
          <select name="repairItem">
            ${renderPlaceholderOptions(AppData.REPAIR_ITEMS, "請選擇叫修項目", values.repairItem)}
          </select>
        </label>
        <label>
          <span>叫修原因</span>
          <select name="repairReason">
            ${renderPlaceholderOptions(AppData.REPAIR_REASONS, "請選擇叫修原因", values.repairReason)}
          </select>
        </label>
        <label>
          <span>指派人員</span>
          <select name="assignee">
            ${renderPlaceholderOptions(AppData.ASSIGNEES, "請選擇指派人員", values.assignee)}
          </select>
        </label>
        <label>
          <span>預計日期</span>
          <input type="date" name="estimatedDate" value="${escapeHtml(values.estimatedDate)}" />
        </label>
        <label>
          <span>預計時段</span>
          <input type="text" name="estimatedTime" value="${escapeHtml(values.estimatedTime)}" placeholder="09:00-12:00" />
        </label>
        <label class="form-full">
          <span>故障描述 <strong data-required-marker ${repairReasonIsOther ? "" : "hidden"}>*</strong></span>
          <textarea name="faultDescription" rows="4" placeholder="請輸入故障描述">${escapeHtml(values.faultDescription)}</textarea>
        </label>
      </div>
    `;
  }

  function renderCreateModal() {
    return `
      <div class="modal-backdrop" role="presentation">
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="create-case-title">
          <form class="case-form" data-create-case-form novalidate>
            <div class="modal-header">
              <div>
                <h2 id="create-case-title">新增叫修單</h2>
                <p>建立新的維修叫修案件，門市資料會依客戶與門市自動帶入。</p>
              </div>
              <button type="button" class="btn" data-action="dismiss-create" aria-label="關閉">關閉</button>
            </div>

            ${renderCaseInfoFields()}

            <div class="modal-actions">
              <button type="button" class="btn" data-action="dismiss-create">取消</button>
              <button type="submit" class="btn btn-primary">儲存</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  function renderEquipmentInfo(draft) {
    if (!draft.equipmentScanned || !draft.equipment) {
      return `<p class="scan-hint">尚未掃描設備 QR CODE，處理資訊會保持鎖定。</p>`;
    }

    return `
      <dl class="equipment-summary">
        <div><dt>客戶</dt><dd>${escapeHtml(draft.equipment.customer)}</dd></div>
        <div><dt>門市</dt><dd>${escapeHtml(draft.equipment.store)}</dd></div>
        <div><dt>設備區域</dt><dd>${escapeHtml(draft.equipment.area)}</dd></div>
        <div><dt>室內／室外</dt><dd>${escapeHtml(draft.equipment.io)}</dd></div>
        <div><dt>機型</dt><dd>${escapeHtml(draft.equipment.model)}</dd></div>
      </dl>
    `;
  }

  function renderProcessRows(rows = []) {
    if (!rows.length) {
      return `<div class="process-empty">尚未新增處理方式，0 列也可儲存。</div>`;
    }

    return rows.map((row, index) => `
      <div class="process-row" data-process-row>
        <label>
          <span>大分類</span>
          <select name="processLarge">
            ${renderPlaceholderOptions(AppData.PROCESS_LARGE, "請選擇", row.large)}
          </select>
        </label>
        <label>
          <span>中分類</span>
          <select name="processMedium">
            ${renderPlaceholderOptions(AppData.PROCESS_MEDIUM, "請選擇", row.medium)}
          </select>
        </label>
        <label>
          <span>小分類</span>
          <select name="processSmall">
            ${renderPlaceholderOptions(AppData.PROCESS_SMALL, "請選擇", row.small)}
          </select>
        </label>
        <label>
          <span>數量</span>
          <input type="number" name="processQty" min="0" step="1" value="${escapeHtml(row.qty ?? 1)}" />
        </label>
        <button type="button" class="btn btn-danger process-remove" data-action="remove-process-row" data-index="${index}">刪除</button>
      </div>
    `).join("");
  }

  function renderEditModal() {
    if (!editDraft) return "";
    const disabledAttr = editDraft.equipmentScanned ? "" : "disabled";

    return `
      <div class="modal-backdrop" role="presentation">
        <section class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="edit-case-title">
          <form class="case-form" data-edit-case-form novalidate>
            <div class="modal-header">
              <div>
                <h2 id="edit-case-title">編輯案件 ${escapeHtml(editDraft.id)}</h2>
                <p>先掃描設備 QR CODE 後，才可填寫處理資訊。</p>
              </div>
              <button type="button" class="btn" data-action="dismiss-edit" aria-label="關閉">關閉</button>
            </div>

            <section class="form-section">
              <h3>案件資訊</h3>
              ${renderCaseInfoFields(editDraft)}
            </section>

            <section class="form-section equipment-section">
              <div class="section-title-row">
                <h3>設備資訊</h3>
                <button type="button" class="btn btn-primary" data-action="scan-equipment" data-id="${escapeHtml(editDraft.id)}">
                  掃描設備 QR CODE
                </button>
              </div>
              ${renderEquipmentInfo(editDraft)}
            </section>

            <fieldset class="form-section process-section" ${disabledAttr}>
              <legend>處理資訊</legend>
              <div class="form-grid">
                <label class="form-full">
                  <span>實際原因</span>
                  <input type="text" name="actualReason" value="${escapeHtml(editDraft.actualReason)}" placeholder="請輸入實際原因" />
                </label>
                <div class="form-full process-methods">
                  <div class="section-title-row">
                    <span class="field-label">處理方式</span>
                    <button type="button" class="btn" data-action="add-process-row">新增列</button>
                  </div>
                  <div data-process-rows>
                    ${renderProcessRows(editDraft.processMethods)}
                  </div>
                </div>
                <label class="form-full">
                  <span>備註</span>
                  <textarea name="remarks" rows="3" placeholder="請輸入備註">${escapeHtml(editDraft.remarks)}</textarea>
                </label>
                <label>
                  <span>處理狀態</span>
                  <select name="processStatus">
                    ${renderOptions(AppData.PROCESS_STATUSES, editDraft.processStatus)}
                  </select>
                </label>
              </div>
            </fieldset>

            <div class="modal-actions">
              <button type="button" class="btn" data-action="dismiss-edit">取消</button>
              <button type="submit" class="btn btn-primary">儲存編輯</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  function renderRows(cases) {
    if (!cases.length) {
      return `<tr><td colspan="14" class="empty-state">無資料</td></tr>`;
    }

    return cases.map((c) => `
      <tr>
        <td><div class="row-actions">
          <button type="button" class="btn" data-action="edit" data-id="${escapeHtml(c.id)}">編輯</button>
          <button type="button" class="btn" data-action="close" data-id="${escapeHtml(c.id)}">案件結案</button>
          <button type="button" class="btn" data-action="copy" data-id="${escapeHtml(c.id)}">複製 URL</button>
        </div></td>
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
    if (e.target.classList.contains("modal-backdrop") && root.contains(e.target)) {
      closeModal();
      render();
      return;
    }

    const filterBtn = e.target.closest(".filter-btn");
    if (filterBtn && root.contains(filterBtn)) {
      if (modalMode) return;
      const status = filterBtn.dataset.filter;
      filterStatus = filterStatus === status ? null : status;
      render();
      return;
    }

    const actionBtn = e.target.closest("[data-action]");
    if (actionBtn && root.contains(actionBtn)) {
      const { action, id } = actionBtn.dataset;
      if (action === "create") {
        modalMode = "create";
        editingId = null;
        editDraft = null;
        render();
        return;
      }
      if (action === "dismiss-create") {
        closeModal();
        render();
        return;
      }
      if (action === "edit") {
        openEditModal(id);
        return;
      }
      if (action === "dismiss-edit") {
        closeModal();
        render();
        return;
      }
      if (action === "scan-equipment") {
        const form = actionBtn.closest("[data-edit-case-form]");
        if (form) syncEditDraftFromForm(form);
        scanEquipment(id);
        return;
      }
      if (action === "add-process-row") {
        const form = actionBtn.closest("[data-edit-case-form]");
        if (form) syncEditDraftFromForm(form);
        if (editDraft) editDraft.processMethods.push({ large: "", medium: "", small: "", qty: 1 });
        render();
        return;
      }
      if (action === "remove-process-row") {
        const form = actionBtn.closest("[data-edit-case-form]");
        if (form) syncEditDraftFromForm(form);
        if (editDraft) editDraft.processMethods.splice(Number(actionBtn.dataset.index), 1);
        render();
        return;
      }
      if (action === "close" || action === "copy") {
        console.log(action, id);
      }
    }
  }

  function onRootChange(e) {
    const form = e.target.closest("[data-create-case-form], [data-edit-case-form]");
    if (!form || !root.contains(form)) return;

    if (e.target.name === "customerName") {
      onCustomerChange(e.target.value, form);
      return;
    }
    if (e.target.name === "storeName") {
      onStoreChange(form.elements.customerName.value, e.target.value, form);
      return;
    }
    if (e.target.name === "repairReason") {
      updateRepairReasonRequirement(form);
    }
  }

  function getProcessMethods(form) {
    return Array.from(form.querySelectorAll("[data-process-row]")).map((row) => ({
      large: row.querySelector('[name="processLarge"]')?.value || "",
      medium: row.querySelector('[name="processMedium"]')?.value || "",
      small: row.querySelector('[name="processSmall"]')?.value || "",
      qty: Number(row.querySelector('[name="processQty"]')?.value || 0),
    }));
  }

  function syncEditDraftFromForm(form) {
    if (!editDraft) return;
    editDraft = {
      ...editDraft,
      ...getCreateFormData(form),
      actualReason: form.elements.actualReason?.value || "",
      remarks: form.elements.remarks?.value || "",
      processStatus: form.elements.processStatus?.value || editDraft.processStatus,
      processMethods: getProcessMethods(form),
    };
  }

  function getCreateFormData(form) {
    return {
      workCategory: form.elements.workCategory.value,
      customerName: form.elements.customerName.value,
      storeName: form.elements.storeName.value,
      storeAddress: form.elements.storeAddress.value,
      serviceLevel: form.elements.serviceLevel.value,
      region: form.elements.region.value,
      requester: form.elements.requester.value,
      repairItem: form.elements.repairItem.value,
      repairReason: form.elements.repairReason.value,
      faultDescription: form.elements.faultDescription.value,
      assignee: form.elements.assignee.value,
      estimatedDate: form.elements.estimatedDate.value,
      estimatedTime: form.elements.estimatedTime.value,
    };
  }

  function validateCaseBasics(formData) {
    const repairReason = formData.repairReason;
    const faultDescription = formData.faultDescription.trim();
    if (!formData.workCategory || !formData.customerName || !formData.storeName) {
      alert("請至少選擇工項分類、客戶名稱與門市名稱");
      return false;
    }
    if (repairReason === "其他" && !faultDescription) {
      alert("叫修原因為「其他」時，故障描述為必填");
      return false;
    }

    return true;
  }

  function saveNewCase(formData) {
    if (!validateCaseBasics(formData)) return false;

    const repairReason = formData.repairReason;
    const faultDescription = formData.faultDescription.trim();

    const repairDate = today();
    const id = store.nextId(repairDate);
    store.add({
      id,
      repairDate,
      workCategory: formData.workCategory,
      customerName: formData.customerName,
      storeName: formData.storeName,
      storeAddress: formData.storeAddress,
      serviceLevel: formData.serviceLevel,
      region: formData.region,
      requester: formData.requester,
      repairItem: formData.repairItem,
      repairReason,
      faultDescription,
      assignee: formData.assignee,
      estimatedDate: formData.estimatedDate,
      estimatedTime: formData.estimatedTime,
      actualReason: "",
      processMethods: [],
      remarks: "",
      processStatus: "尚未完成",
      equipmentScanned: false,
      equipment: null,
      closed: false,
    });
    closeModal();
    render();
    return true;
  }

  function scanEquipment(caseId) {
    const c = store.getById(caseId);
    if (!c) return;
    const equipment = {
      customer: editDraft?.customerName || c.customerName,
      store: editDraft?.storeName || c.storeName,
      area: "賣場空調區",
      io: "室內",
      model: "AC-DEMO-100",
    };
    store.update(caseId, {
      equipmentScanned: true,
      equipment,
    });
    if (editDraft && editingId === caseId) {
      editDraft = {
        ...editDraft,
        equipmentScanned: true,
        equipment,
      };
    }
    modalMode = "edit";
    editingId = caseId;
    render();
  }

  function saveEditCase(form) {
    if (!editingId || !editDraft) return false;
    syncEditDraftFromForm(form);
    if (!validateCaseBasics(editDraft)) return false;

    if (editDraft.equipmentScanned && editDraft.equipment) {
      editDraft.equipment = {
        ...editDraft.equipment,
        customer: editDraft.customerName,
        store: editDraft.storeName,
      };
    }

    store.update(editingId, {
      workCategory: editDraft.workCategory,
      customerName: editDraft.customerName,
      storeName: editDraft.storeName,
      storeAddress: editDraft.storeAddress,
      serviceLevel: editDraft.serviceLevel,
      region: editDraft.region,
      requester: editDraft.requester,
      repairItem: editDraft.repairItem,
      repairReason: editDraft.repairReason,
      faultDescription: editDraft.faultDescription.trim(),
      assignee: editDraft.assignee,
      estimatedDate: editDraft.estimatedDate,
      estimatedTime: editDraft.estimatedTime,
      processMethods: editDraft.processMethods,
      equipmentScanned: editDraft.equipmentScanned,
      equipment: editDraft.equipment,
      actualReason: editDraft.actualReason.trim(),
      remarks: editDraft.remarks.trim(),
      processStatus: editDraft.processStatus,
    });
    closeModal();
    render();
    return true;
  }

  function onRootSubmit(e) {
    const form = e.target.closest("[data-create-case-form], [data-edit-case-form]");
    if (!form || !root.contains(form)) return;
    e.preventDefault();
    if (form.matches("[data-create-case-form]")) {
      saveNewCase(getCreateFormData(form));
      return;
    }
    saveEditCase(form);
  }

  function mount(container) {
    if (root) root.removeEventListener("click", onRootClick);
    if (root) root.removeEventListener("change", onRootChange);
    if (root) root.removeEventListener("submit", onRootSubmit);
    root = container;
    root.addEventListener("click", onRootClick);
    root.addEventListener("change", onRootChange);
    root.addEventListener("submit", onRootSubmit);
    render();
  }

  function unmount() {
    if (root) root.removeEventListener("click", onRootClick);
    if (root) root.removeEventListener("change", onRootChange);
    if (root) root.removeEventListener("submit", onRootSubmit);
    root = null;
    closeModal();
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
        ${modalMode === "create" ? renderCreateModal() : ""}
        ${modalMode === "edit" ? renderEditModal() : ""}
      </section>
    `;
  }

  return { mount, unmount };
})();
