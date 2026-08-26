# 案件安排彈窗沿用編輯頁區塊 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓「案件安排」日曆點開維修／保養案件時，案件內容區塊的版面、欄位、可編性與互動功能，與各自的編輯頁完全一致——同一份實作被兩處使用。

**Architecture:** 把 `EditCaseForm` 與 `MaintenanceViewEditForm` 的區塊 DOM 與 handler 抽成兩支無狀態的共用渲染模組（`RepairCaseDetailSections`、`MaintenanceDetailSections`），介面比照既有的 `window.ProjectDetailView`。編輯頁與排程彈窗各自保管 `formData` 與 UI 暫存狀態，呼叫同一支 `renderSections(ctx)`。彈窗以 `include` 省略「排程資料」段，因為頂端已有排程主控。

**Tech Stack:** 原生 HTML / CSS / JavaScript（無框架、無建置）。全域命名空間 `window.IESS` 與 `window.*` 元件，以 `index.html` 內多個 `<script>` 依序載入。驗證用 `scripts/verify-*.mjs`：Node 直接跑，以 headless Chrome + CDP 驅動真實頁面。

**Spec:** `docs/superpowers/specs/2026-08-26-arrangement-detail-sections-design.md`

## Global Constraints

- 無建置步驟。新檔一律是 IIFE，開頭 `'use strict';`，結尾掛上 `window.<Name> = ...`，並在 `index.html` 加 `<script>`。
- 不使用 ES module 語法、不使用箭頭函式與 `const`/`let` 以外的新語法——比照既有檔案，一律 `var` + `function`。
- 註解用繁體中文，只寫「為什麼」，不複述程式碼在做什麼。
- 工程立案（`sourceType === 'project'`）的彈窗分支一律不動。
- 彈窗儲存只驗證排程三條規則：組別至少一個、預計日期與時間區間必填、結束時間須晚於開始時間。不加入編輯頁的「每份服務項目都必須對應一筆設備」。
- 每個 verify script 執行方式一律 `node scripts/<name>.mjs`；退出碼 0 為通過。需要 Chrome，路徑可用 `CHROME_PATH` 環境變數覆寫。每支 script 的 `--remote-debugging-port` 與 `--user-data-dir` 都必須是獨一無二的值，否則同時執行會互相干擾。

---

### Task 1: 抽出 RepairCaseDetailSections

把 `EditCaseForm` 的四段區塊與其 handler 移到新模組，`EditCaseForm` 改為呼叫它。**這是純重構，對使用者可見的行為必須零變化。**

**Files:**
- Create: `src/features/repair/case-detail-sections.js`
- Create: `scripts/verify-repair-detail-sections.mjs`
- Modify: `src/features/repair/case-form.js`（`EditCaseForm`：367-833）
- Modify: `index.html`（第 70 行 `case-form.js` 之前插入新 script）

**Interfaces:**
- Consumes: 既有全域 `IESS.h`、`IESS.Icons`、`IESS.TimeInput24`、`IESS.MultiSelect`、`IESS.SignaturePadModal`、`IESS.caseDateTime`、`IESS.caseStatus`、`RepairCaseServiceItems`、`RepairCaseServiceItemCard`、`RepairCaseServiceItemPager`、`RepairCaseEquipment`、`ProcessMethodUtils`、`EquipmentUtils`、`VehicleUtils`、`VendorUtils`、`CaseAssigneeFields`、`ScheduleUtils`
- Produces:
  - `window.RepairCaseDetailSections.createUiState()` → `{ activeItemIndex: 0, pickerOpen: false, addEquipMenuOpen: false, signaturePad: { show: false }, newRecordByItemId: {} }`
  - `window.RepairCaseDetailSections.renderSections(ctx)` → `Array<VNode>`
  - `window.RepairCaseDetailSections.renderOverlays(ctx)` → `Array<VNode|false>`
  - `window.RepairCaseDetailSections.SECTION_KEYS` → `['schedule', 'case', 'equipment', 'result']`
  - `window.RepairCaseDetailSections.ReporterField`、`.CaseReadOnlyField`、`.TimeRecordField`、`.renderVehicleSelect`、`.renderPartnerVendorMultiSelect`、`.isOtherWorkCategory` — 供 `AddCaseForm` 沿用同一組欄位元件
  - `ctx` 形狀：`{ formData, ui, data: { equipments, deviceCategories, processMethods, vehicles, vendors, stores }, rerender, showToast, include, idPrefix }`
  - `idPrefix` 為多選欄位的 id 前綴，預設 `'edit-case'`；排程彈窗傳 `'schedule-modal'`
  - `window.ExpectedTimeRangeFields` 必須維持存在（`src/features/customer/store-repair-form.js:175` 在用）

- [ ] **Step 1: 寫特徵測試（characterization test）**

這是重構，測試的用途是「證明改動前後行為一致」，所以**先寫、先讓它對現行程式碼通過**，再動刀。

建立 `scripts/verify-repair-detail-sections.mjs`。CDP 骨架整段從 `scripts/verify-maintenance-detail-sections.mjs` 的第 1-56 行與第 125-150 行複製，只改三處：`PORT` 改成 `9371`、`--user-data-dir` 改成 `/tmp/iess-repair-detail-profile`、檔頭註解改寫。接著填入下列內容：

```js
// 測試用的維修案件／設備／車輛／協力廠商，全部在頁面內組出來，不依賴種子資料
const SETUP = `(function () {
  window.__written = { cases: null, toasts: [] };
  window.__equipments = [
    { id: 'E1', customerName: '維修客戶', storeName: '維修門市', category: '分離式冷氣',
      brand: '大金', deviceName: '一樓內機', specification: '3噸', model: 'DK-100',
      area: '一樓', acceptanceDate: '2024-01-10', installer: '王工',
      assetNumber: 'A-001', serialNumber: 'S-001', status: '運轉中' },
    { id: 'E2', customerName: '維修客戶', storeName: '維修門市', category: '分離式冷氣',
      brand: '日立', deviceName: '二樓內機', specification: '5噸', model: 'HT-200',
      area: '二樓', acceptanceDate: '2024-02-10', installer: '李工',
      assetNumber: 'A-002', serialNumber: 'S-002', status: '運轉中' }
  ];
  window.__mountEdit = function (overrides) {
    var host = document.getElementById('edit-host');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'edit-host';
    document.body.appendChild(host);
    var target = Object.assign({
      id: 'C-T1', caseNumber: 'R20260826001', customerName: '維修客戶',
      storeName: '維修門市', reporter: '陳小姐', serviceLevel: 'A 全約',
      storeAddress: '台北市大安區忠孝東路X號', workCategory: '維修',
      repairItem: '冷氣', repairReason: '不冷', faultDesc: '出風不冷',
      expectedDate: '2026-08-26', expectedTimeStart: '09:00', expectedTimeEnd: '11:00',
      assignees: [], assigneeMemberIds: [], partnerVendorIds: [],
      serviceItems: [], isClosed: false, processStatus: null, repairRemark: ''
    }, overrides || {});
    host.appendChild(EditCaseForm({
      editingCase: target,
      cases: [target],
      setCases: function (next) { window.__written.cases = next; },
      stores: [{ customerName: '維修客戶', storeName: '維修門市', companyCity: '台北市',
        companyDistrict: '大安區', companyAddress: '忠孝東路X號' }],
      customers: [{ name: '維修客戶', enabled: true }],
      vehicles: [{ id: 'CAR1', plate: 'ABC-1234', enabled: true }],
      vendors: [{ id: 'V1', name: '大同協力', type: '協力商' }],
      equipments: window.__equipments,
      deviceCategories: [],
      processMethods: (typeof INITIAL_PROCESS_METHODS !== 'undefined' ? INITIAL_PROCESS_METHODS : []),
      setView: function () {},
      showToast: function (msg) { window.__written.toasts.push(msg); }
    }));
    return true;
  };
  window.__sectionTitles = function (scope) {
    return Array.prototype.map.call(
      document.querySelectorAll(scope + ' section h3'),
      function (el) { return el.textContent.trim(); });
  };
  window.__sectionByTitle = function (scope, title) {
    return Array.prototype.slice.call(document.querySelectorAll(scope + ' section'))
      .filter(function (s) {
        var h3 = s.querySelector('h3');
        return h3 && h3.textContent.trim() === title;
      })[0] || null;
  };
  window.__editableCount = function (scope, title) {
    var section = window.__sectionByTitle(scope, title);
    if (!section) return -1;
    return section.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])').length;
  };
  window.__clickText = function (text, scope) {
    var root = scope ? document.querySelector(scope) : document;
    var el = Array.prototype.slice.call(root.querySelectorAll('button'))
      .filter(function (b) { return b.textContent.trim() === text; })[0];
    if (!el) throw new Error('找不到按鈕：' + text);
    el.click();
    return true;
  };
  return true;
})()`;
```

主體斷言：

```js
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: `file://${ROOT}/index.html` });
  await sleep(4000);
  await evaluate(SETUP);
  await evaluate('window.__mountEdit({})');

  console.log('Section 1｜編輯頁四段式版面');
  assertEq(consoleErrors.length, 0, '載入與掛載編輯頁時無 JS 錯誤');
  assertDeep(await evaluate(`window.__sectionTitles('#edit-host')`),
    ['1. 排程資料', '2. 案件資料', '3. 設備與服務項目', '4. 維修結果'],
    '區塊依序為 排程資料／案件資料／設備與服務項目／維修結果');

  console.log('\nSection 2｜案件資料全唯讀');
  assertEq(await evaluate(`window.__editableCount('#edit-host', '2. 案件資料')`), 0,
    '案件資料沒有任何可編輯欄位');

  console.log('\nSection 3｜未加入設備時維修結果鎖住');
  assertEq(await evaluate(`(function () {
    var s = window.__sectionByTitle('#edit-host', '4. 維修結果');
    return s.querySelector('select[name="processStatus"]').disabled;
  })()`), true, '未加入設備時處理狀態為 disabled');

  console.log('\nSection 4｜加入設備後解除鎖定並顯示卡片');
  await evaluate(`window.__clickText('加入設備', '#edit-host')`);
  await evaluate(`window.__clickText('手動選擇', '#edit-host')`);
  assertEq(await evaluate(`(function () {
    var btns = Array.prototype.slice.call(document.querySelectorAll('button'))
      .filter(function (b) { return b.textContent.indexOf('一樓內機') !== -1; });
    if (!btns.length) return 'picker-not-open';
    btns[0].click();
    return 'clicked';
  })()`), 'clicked', '設備挑選器開啟並可選到門市設備');
  assertEq(await evaluate(`(function () {
    var s = window.__sectionByTitle('#edit-host', '4. 維修結果');
    return s.querySelector('select[name="processStatus"]').disabled;
  })()`), false, '加入設備後處理狀態解除鎖定');

  console.log('\nSection 5｜工項分類為「其他」時維修結果不受設備限制');
  await evaluate(`window.__mountEdit({ workCategory: '其他' })`);
  assertEq(await evaluate(`(function () {
    var s = window.__sectionByTitle('#edit-host', '4. 維修結果');
    return s.querySelector('select[name="processStatus"]').disabled;
  })()`), false, '工項分類為「其他」時未加設備也可編輯維修結果');
  assertDeep(await evaluate(`window.__sectionTitles('#edit-host')`),
    ['1. 排程資料', '2. 案件資料', '3. 設備與服務項目', '4. 維修結果'],
    '「其他」分類仍為四段式版面');

  if (consoleErrors.length) console.log('ERRORS', JSON.stringify(consoleErrors));
  assertEq(consoleErrors.length, 0, '操作後仍無 JS 錯誤');
```

- [ ] **Step 2: 跑測試，確認它對「現行」程式碼就是通過的**

Run: `node scripts/verify-repair-detail-sections.mjs`
Expected: PASS（`通過 N／失敗 0`，退出碼 0）

若失敗，代表測試本身寫錯——先修測試到通過，再進 Step 3。**不要**在這步改動 `case-form.js`。

- [ ] **Step 3: 建立新模組骨架**

建立 `src/features/repair/case-detail-sections.js`：

```js
/*
 * features/repair/case-detail-sections.js — 維修案件的可編輯區塊渲染器
 *
 * 「編輯案件」頁與「案件安排」排程彈窗共用同一份區塊實作，兩處的版面、欄位
 * 與互動功能才不會各自漂移。模組本身無狀態：formData 與 UI 暫存狀態都由
 * 呼叫端保管，模組只負責把它們畫出來。
 *
 * ctx = {
 *   formData,   // 直接 mutate，沿用 EditCaseForm 現行寫法
 *   ui,         // createUiState() 的產出，由呼叫端保管
 *   data: { equipments, deviceCategories, processMethods, vehicles, vendors, stores },
 *   rerender, showToast,
 *   include     // SECTION_KEYS 的子集，決定畫哪幾段與編號
 * }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, TimeInput24 = IESS.TimeInput24;
  var caseDT = IESS.caseDateTime;
  var caseStatus = IESS.caseStatus;

  var SECTION_KEYS = ['schedule', 'case', 'equipment', 'result'];
  var SECTION_TITLES = {
    schedule: '排程資料',
    case: '案件資料',
    equipment: '設備與服務項目',
    result: '維修結果'
  };

  // 編號依 include 的實際內容產生：彈窗略過「排程資料」時，案件資料就是 1.
  function sectionTitle(include, key) {
    return (include.indexOf(key) + 1) + '. ' + SECTION_TITLES[key];
  }

  function createUiState() {
    return {
      activeItemIndex: 0,
      pickerOpen: false,
      addEquipMenuOpen: false,
      signaturePad: { show: false },
      newRecordByItemId: {}
    };
  }

  function renderSections(ctx) {
    var include = ctx.include || SECTION_KEYS;
    return include.map(function (key) {
      if (key === 'schedule') return renderScheduleSection(ctx, include);
      if (key === 'case') return renderCaseSection(ctx, include);
      if (key === 'equipment') return renderEquipmentSection(ctx, include);
      if (key === 'result') return renderResultSection(ctx, include);
      return null;
    }).filter(Boolean);
  }

  function renderOverlays(ctx) {
    return [
      ctx.ui.pickerOpen && h(RepairCaseEquipment.PickerModal, {
        h: h,
        items: RepairCaseEquipment.listForCase(ctx.data.equipments, ctx.formData),
        addedIds: getAddedEquipmentIds(ctx),
        onSelect: function (eq) { handleSelectEquipment(ctx, eq); },
        onClose: function () { ctx.ui.pickerOpen = false; ctx.rerender(); }
      }),
      ctx.ui.signaturePad.show && IESS.SignaturePadModal({
        title: '客戶簽收',
        value: ctx.formData.customerSignature,
        onConfirm: function (dataUrl) {
          ctx.formData.customerSignature = dataUrl;
          ctx.ui.signaturePad = { show: false };
          ctx.showToast(dataUrl ? '客戶簽收已暫存，請記得儲存' : '已清除客戶簽名');
          ctx.rerender();
        },
        onClose: function () { ctx.ui.signaturePad = { show: false }; ctx.rerender(); }
      })
    ];
  }

  window.RepairCaseDetailSections = {
    SECTION_KEYS: SECTION_KEYS,
    createUiState: createUiState,
    renderSections: renderSections,
    renderOverlays: renderOverlays
  };
})();
```

- [ ] **Step 4: 把 helper 與 handler 搬進新模組**

從 `src/features/repair/case-form.js` **剪下**（不是複製）以下 helper，貼進新模組的 IIFE 內、`renderSections` 之前：

| 來源行號 | 名稱 |
|---|---|
| 14-16 | `isOtherWorkCategory` |
| 18-33 | `TimeRecordField` |
| 44-56 | `ReporterField` |
| 58-65 | `CaseReadOnlyField` |
| 67-91 | `ExpectedTimeRangeFields` |
| 97-107 | `renderVehicleSelect` |
| 109-117 | `renderPartnerVendorMultiSelect` |

`ExpectedTimeRangeFields` 在新模組結尾仍要 `window.ExpectedTimeRangeFields = ExpectedTimeRangeFields;`，因為 `src/features/customer/store-repair-form.js:175` 在用它。`case-form.js` 結尾原本的那行匯出要刪掉。

`case-form.js` 的 `AddCaseForm`（119-365）也用到 `ReporterField`、`ExpectedTimeRangeFields`、`renderVehicleSelect`、`renderPartnerVendorMultiSelect`、`isOtherWorkCategory`、`syncFormStoreFields`。因為它們都會變成全域可及的模組內函式，`AddCaseForm` 需改為透過 `RepairCaseDetailSections` 取用——在 `case-form.js` 頂端加一層別名即可，不必改 `AddCaseForm` 內文：

```js
  var Sections = window.RepairCaseDetailSections;
  var ExpectedTimeRangeFields = window.ExpectedTimeRangeFields;
  var ReporterField = Sections.ReporterField;
  var CaseReadOnlyField = Sections.CaseReadOnlyField;
  var renderVehicleSelect = Sections.renderVehicleSelect;
  var renderPartnerVendorMultiSelect = Sections.renderPartnerVendorMultiSelect;
  var isOtherWorkCategory = Sections.isOtherWorkCategory;
```

因此新模組的匯出要一併帶上這幾個 helper：

```js
  window.RepairCaseDetailSections = {
    SECTION_KEYS: SECTION_KEYS,
    createUiState: createUiState,
    renderSections: renderSections,
    renderOverlays: renderOverlays,
    // 「新增案件」表單沿用同一組欄位元件，一併匯出避免兩份實作
    ReporterField: ReporterField,
    CaseReadOnlyField: CaseReadOnlyField,
    TimeRecordField: TimeRecordField,
    renderVehicleSelect: renderVehicleSelect,
    renderPartnerVendorMultiSelect: renderPartnerVendorMultiSelect,
    isOtherWorkCategory: isOtherWorkCategory
  };
```

`syncFormStoreFields`（36-42）只有 `AddCaseForm` 在用，留在 `case-form.js` 不動。

接著把 `EditCaseForm` 內的 handler 搬進新模組，改成吃 `ctx` 的形式。逐一對照：

| `case-form.js` 原行號 | 新模組函式簽章 | 改寫要點 |
|---|---|---|
| 404-416 | `handleChange(ctx, e)` | `formData` → `ctx.formData`；`rerender()` → `ctx.rerender()` |
| 417-421 | `getAddedEquipmentIds(ctx)` | 同上 |
| 422-447 | `assignEquipment(ctx, eq)` | `showToast` → `ctx.showToast`；`pickerOpen`/`addEquipMenuOpen`/`activeItemIndex` → `ctx.ui.*` |
| 448-452 | `handleRemoveItem(ctx, itemId)` | `newRecordByItemId` → `ctx.ui.newRecordByItemId` |
| 453-456 | `handleReasonChange(ctx, itemId, value)` | |
| 457-460 | `handleRemarksChange(ctx, itemId, value)` | |
| 461-475 | `handleAddRecord(ctx, itemId, pm, qty, status)` | |
| 476-484 | `handleRemoveRecord(ctx, itemId, recordId)` | |
| 485-498 | `handleToggleRecordStatus(ctx, itemId, recordId)` | |
| 499-532 | `handleSimulateScan(ctx, e)` | `storeEquipments` 改在函式內以 `RepairCaseEquipment.listForCase(ctx.data.equipments, ctx.formData)` 現算 |
| 533-535 | `handleSelectEquipment(ctx, eq)` | |
| 389-400 | `getNewRecord(ctx, itemId)` | `processMethods` → `ctx.data.processMethods` |

`handleSubmit`（536-561）**不搬**——它是編輯頁專屬的儲存流程，留在 `case-form.js`。

- [ ] **Step 5: 把四段區塊 DOM 搬進新模組**

從 `case-form.js` 剪下區塊 DOM，包成新模組的四個 render 函式。每個函式簽章為 `render<X>Section(ctx, include)`，回傳單一 `h('section', ...)`：

| 來源行號 | 新函式 | 邊界說明 |
|---|---|---|
| 583-629 | `renderScheduleSection` | 完整一段，直接搬 |
| 631-649 | `renderCaseSection` | 完整一段，直接搬 |
| 650-738 | `renderEquipmentSection` | **排除 731-737**：`pickerOpen && h(RepairCaseEquipment.PickerModal, ...)` 已在 `renderOverlays` 實作，這裡刪掉 |
| 739-805 | `renderResultSection` | **排除 806-815**：`mt-8 pt-6 border-t flex justify-end gap-4` 的「取消／儲存」按鈕是編輯頁專屬，留在 `case-form.js` 且需移到 section 之外 |

搬移時的機械式替換：
- 硬編碼的標題字串 `"1. 排程資料"` 等，改為 `sectionTitle(include, 'schedule')` 等。
- `formData` → `ctx.formData`；`rerender` → `ctx.rerender`；`showToast` → `ctx.showToast`。
- `vehicles` / `vendors` / `equipments` / `deviceCategories` / `processMethods` → `ctx.data.*`。
- `activeItemIndex` / `pickerOpen` / `addEquipMenuOpen` / `signaturePad` / `newRecordByItemId` → `ctx.ui.*`。
- 呼叫 handler 時補第一個 `ctx` 參數。
- 三個在 render 前算出來的區域值改在各自函式內現算：

```js
  function derive(ctx) {
    var isOther = isOtherWorkCategory(ctx.formData.workCategory);
    var serviceItems = RepairCaseServiceItems.getItems(ctx.formData);
    var hasServiceItems = serviceItems.length > 0;
    // 卡片增減後 index 可能落在範圍外（例如移除最後一張），統一在此夾回來
    var activeIndex = Math.min(Math.max(ctx.ui.activeItemIndex, 0),
      Math.max(serviceItems.length - 1, 0));
    ctx.ui.activeItemIndex = activeIndex;
    return {
      isOther: isOther,
      serviceItems: serviceItems,
      hasServiceItems: hasServiceItems,
      activeIndex: activeIndex,
      activeItem: serviceItems[activeIndex],
      /* 維修結果原則上要先加入設備才可編輯；工項分類為「其他」時不受此限 */
      resultLocked: !hasServiceItems && !isOther
    };
  }
```

`renderEquipmentSection` 與 `renderResultSection` 開頭各呼叫一次 `derive(ctx)`。

`EditCaseForm` 的 `edit-case-assignees` / `edit-case-assignee-members` / `edit-case-partner-vendors` 這三個 `id` 會被彈窗共用，改為由 `ctx` 帶入前綴，避免同頁出現重複 id：

```js
  function fieldId(ctx, suffix) {
    return (ctx.idPrefix || 'edit-case') + '-' + suffix;
  }
```

`ctx.idPrefix` 加進 ctx 形狀；編輯頁不傳（用預設 `'edit-case'`），彈窗傳 `'schedule-modal'`。

- [ ] **Step 6: `EditCaseForm` 改為呼叫新模組**

`case-form.js:401-833` 的 `stateful` 回呼改成：

```js
    var ui = RepairCaseDetailSections.createUiState();

    return stateful(function (rerender) {
      var ctx = {
        formData: formData,
        ui: ui,
        data: {
          equipments: equipments,
          deviceCategories: deviceCategories,
          processMethods: processMethods,
          vehicles: vehicles,
          vendors: vendors,
          stores: props.stores || []
        },
        rerender: rerender,
        showToast: showToast,
        include: RepairCaseDetailSections.SECTION_KEYS
      };

      function handleSubmit() { /* 原 536-561 不動 */ }
      function buildPrevCaseAction() { /* 原 563-575 不動 */ }

      return h("div", {
        className: "max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100"
      }, PageHeader({ /* 原 575-581 不動 */ }),
        h("div", { className: "p-4 sm:p-6 space-y-6 sm:space-y-8 bg-gray-50" },
          RepairCaseDetailSections.renderSections(ctx),
          h("div", { className: "mt-8 pt-6 border-t flex justify-end gap-4" },
            h("button", {
              onClick: function () { setView('list'); },
              className: "px-6 py-2.5 border rounded-md"
            }, "取消"),
            h("button", {
              onClick: handleSubmit,
              className: "px-8 py-2.5 bg-blue-600 text-white rounded-md flex items-center gap-2"
            }, Icons.Save({ className: "h-5 w-5" }), " 儲存")
          )
        ),
        RepairCaseDetailSections.renderOverlays(ctx)
      );
    });
```

注意 `ui` 宣告在 `stateful` 之外，與原本 `pickerOpen` / `activeItemIndex` 等變數的位置一致，才撐得過重繪。

原本 `EditCaseForm` 內的 `newRecordByItemId`、`getNewRecord`、`pickerOpen`、`addEquipMenuOpen`、`activeItemIndex`、`signaturePad`（386-400）全部刪除，由 `ui` 取代。

- [ ] **Step 7: `index.html` 加入新 script**

在第 70 行 `<script src="src/features/repair/case-form.js"></script>` **之前**插入：

```html
  <script src="src/features/repair/case-detail-sections.js"></script>
```

- [ ] **Step 8: 跑特徵測試，確認行為未變**

Run: `node scripts/verify-repair-detail-sections.mjs`
Expected: PASS，且與 Step 2 的通過數相同。

- [ ] **Step 9: 跑相關回歸**

Run:
```bash
node scripts/verify-case-repair-edit-gating.mjs
node scripts/verify-case-status-completion.mjs
node scripts/verify-case-multi-equipment.mjs
node scripts/verify-case-add-equipment-menu.mjs
node scripts/verify-case-service-item-pager.mjs
```
Expected: 全部 PASS

- [ ] **Step 10: Commit**

```bash
git add src/features/repair/case-detail-sections.js src/features/repair/case-form.js index.html scripts/verify-repair-detail-sections.mjs
git commit -m "refactor: 維修案件編輯區塊抽成 RepairCaseDetailSections"
```

---

### Task 2: 抽出 MaintenanceDetailSections

同樣的手法套在保養明細，並一併處理 `equipmentList` 的存放位置與兩個函式的匯出。

**Files:**
- Create: `src/features/repair/maintenance-detail-sections.js`
- Modify: `src/features/repair/maintenance.js`（`MaintenanceViewEditForm`：363-665，以及檔尾匯出）
- Modify: `index.html`（第 74 行 `maintenance.js` 之前插入新 script）
- Test: `scripts/verify-maintenance-detail-sections.mjs`（既有，作為安全網，內容不改）

**Interfaces:**
- Consumes: Task 1 建立的 `window.RepairCaseDetailSections`（不直接使用，僅確認載入順序）；既有全域 `IESS.*`、`ProjectEquipPicker`、`EquipmentUtils`、`VendorUtils`、`StoreUtils`、`ScheduleUtils`、`CaseAssigneeFields`、`CaseAssigneeUtils`
- Produces:
  - `window.MaintenanceDetailSections.createUiState()` → `{ equipPicker: { show: false }, signaturePad: { show: false } }`
  - `window.MaintenanceDetailSections.renderSections(ctx)` → `Array<VNode>`
  - `window.MaintenanceDetailSections.renderOverlays(ctx)` → `Array<VNode|false>`
  - `window.MaintenanceDetailSections.SECTION_KEYS` → `['schedule', 'case', 'equipment', 'result']`
  - `window.MaintenanceDetailSections.resolveProgressStatus(formData)` → `string`
  - `window.MaintenanceDetailSections.updateStoreLastMaintenanceDate(stores, setStores, maintenanceCase)` → `void`
  - `ctx` 形狀：`{ formData, ui, data: { equipments, vendors, stores, customers }, rerender, showToast, include, mode, idPrefix }`
  - `mode` 為 `'view'` 時全區塊唯讀；排程彈窗一律傳 `'edit'`

- [ ] **Step 1: 先跑既有測試，記下基準通過數**

Run: `node scripts/verify-maintenance-detail-sections.mjs`
Expected: PASS。把輸出最後一行的「通過 N」記下來，Step 6 要比對同一個數字。

- [ ] **Step 2: 建立新模組骨架**

建立 `src/features/repair/maintenance-detail-sections.js`：

```js
/*
 * features/repair/maintenance-detail-sections.js — 保養案件的可編輯區塊渲染器
 *
 * 「保養明細」頁與「案件安排」排程彈窗共用同一份區塊實作。模組本身無狀態：
 * formData 與 UI 暫存狀態都由呼叫端保管。
 *
 * ctx = {
 *   formData, ui,
 *   data: { equipments, vendors, stores, customers },
 *   rerender, showToast,
 *   include,          // SECTION_KEYS 的子集，決定畫哪幾段與編號
 *   mode,             // 'edit' | 'view'；'view' 時全區塊唯讀
 *   idPrefix          // 多選欄位的 id 前綴，避免同頁重複
 * }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, TimeInput24 = IESS.TimeInput24;

  var SECTION_KEYS = ['schedule', 'case', 'equipment', 'result'];
  var SECTION_TITLES = {
    schedule: '排程資料',
    case: '案件資料',
    equipment: '設備資料',
    result: '保養結果'
  };

  function sectionTitle(include, key) {
    return (include.indexOf(key) + 1) + '. ' + SECTION_TITLES[key];
  }

  function createUiState() {
    return { equipPicker: { show: false }, signaturePad: { show: false } };
  }

  function fieldId(ctx, suffix) {
    return (ctx.idPrefix || 'maintenance') + '-' + suffix;
  }

  function getEquipmentList(ctx) {
    return ctx.formData.equipmentList || [];
  }

  function renderSections(ctx) {
    var include = ctx.include || SECTION_KEYS;
    return include.map(function (key) {
      if (key === 'schedule') return renderScheduleSection(ctx, include);
      if (key === 'case') return renderCaseSection(ctx, include);
      if (key === 'equipment') return renderEquipmentSection(ctx, include);
      if (key === 'result') return renderResultSection(ctx, include);
      return null;
    }).filter(Boolean);
  }

  window.MaintenanceDetailSections = {
    SECTION_KEYS: SECTION_KEYS,
    createUiState: createUiState,
    renderSections: renderSections,
    renderOverlays: renderOverlays,
    resolveProgressStatus: resolveProgressStatus,
    updateStoreLastMaintenanceDate: updateStoreLastMaintenanceDate
  };
})();
```

- [ ] **Step 3: 搬移 helper、handler 與兩個共用函式**

從 `maintenance.js` 剪下並改寫：

| 來源行號 | 新模組 | 改寫要點 |
|---|---|---|
| 24-26 | `resolveMaintenanceCompletionDate` | 直接搬，簽章不變 |
| 28-36 | `updateStoreLastMaintenanceDate(stores, setStores, maintenanceCase)` | 直接搬，簽章不變，並匯出 |
| 356-361 | `resolveProgressStatus(formData)`（原 `resolveMaintenanceProgressStatus`） | 直接搬，改名並匯出 |
| 394-402 | `ReadOnlyField` | 直接搬 |
| 404-412 | `sectionCard` | 直接搬 |
| 414-416 | `fieldLabel` | 直接搬 |
| 385-388 | `getStoreForCase(ctx, c)` | `stores` → `ctx.data.stores` |
| 390-392 | `getMaintenancePeriodLabel(ctx, c)` | `customers` → `ctx.data.customers` |
| 419-424 | `applyChange(ctx, patch)` | `formData` 改為就地 mutate `ctx.formData`（見下） |
| 426-436 | `handleStatusChange(ctx, value)` | 同上 |
| 439-447 | `handlePickerConfirm(ctx, picked)` | 寫回 `ctx.formData.equipmentList` |
| 449-452 | `handleRemoveEquipment(ctx, id)` | 寫回 `ctx.formData.equipmentList` |

`applyChange` 原本用 `formData = Object.assign({}, formData, patch)` 重新指派區域變數。搬到模組後無法重新指派呼叫端的變數，改為就地寫入：

```js
  function applyChange(ctx, patch) {
    Object.keys(patch).forEach(function (k) { ctx.formData[k] = patch[k]; });
    // 排程資料一有異動就重算保養狀態（「已完成」維持手動）
    ctx.formData.status = resolveProgressStatus(ctx.formData);
    ctx.rerender();
  }
```

`handleStatusChange` 同樣改為就地寫入：

```js
  function handleStatusChange(ctx, value) {
    var f = ctx.formData;
    f.status = value;
    if (value === '已完成') {
      // 手動改為已完成時就押上完成時間
      if (!f.completionDate) f.completionDate = IESS.caseDateTime.now();
    } else {
      f.completionDate = '';
      f.status = resolveProgressStatus(f);
    }
    ctx.rerender();
  }
```

設備清單改為存在 `formData` 上，整筆 merge 才帶得走：

```js
  function handlePickerConfirm(ctx, picked) {
    var stamp = Date.now();
    ctx.formData.equipmentList = getEquipmentList(ctx).concat(
      picked.map(function (eq, idx) {
        return Object.assign({}, eq, { id: stamp + idx });
      }));
    ctx.ui.equipPicker = { show: false };
    ctx.showToast('已加入 ' + picked.length + ' 筆設備');
    ctx.rerender();
  }

  function handleRemoveEquipment(ctx, id) {
    ctx.formData.equipmentList = getEquipmentList(ctx).filter(function (eq) {
      return eq.id !== id;
    });
    ctx.rerender();
  }
```

`renderOverlays`：

```js
  function renderOverlays(ctx) {
    var isEdit = ctx.mode !== 'view';
    return [
      isEdit && ctx.ui.equipPicker.show && h(ProjectEquipPicker, {
        equipments: ctx.data.equipments,
        customerName: ctx.formData.customerName,
        storeName: ctx.formData.storeName,
        addedIds: getEquipmentList(ctx).map(function (eq) {
          return eq.sourceEquipmentId;
        }).filter(Boolean),
        onConfirm: function (picked) { handlePickerConfirm(ctx, picked); },
        onClose: function () { ctx.ui.equipPicker = { show: false }; ctx.rerender(); }
      }),
      isEdit && ctx.ui.signaturePad.show && IESS.SignaturePadModal({
        title: '客戶簽收',
        value: ctx.formData.customerSignature,
        onConfirm: function (dataUrl) {
          ctx.formData.customerSignature = dataUrl;
          ctx.ui.signaturePad = { show: false };
          ctx.showToast(dataUrl ? '客戶簽收已暫存，請記得儲存' : '已清除客戶簽名');
          ctx.rerender();
        },
        onClose: function () { ctx.ui.signaturePad = { show: false }; ctx.rerender(); }
      })
    ];
  }
```

- [ ] **Step 4: 搬移四段區塊 DOM**

從 `maintenance.js` 剪下，包成 `render<X>Section(ctx, include)`：

| 來源行號 | 新函式 | 邊界說明 |
|---|---|---|
| 488-529 | `renderScheduleSection` | `sectionCard('1. 排程資料', ...)` → `sectionCard(sectionTitle(include, 'schedule'), ...)` |
| 530-557 | `renderCaseSection` | 同上，key 為 `'case'` |
| 558-587 | `renderEquipmentSection` | 同上，key 為 `'equipment'`；`equipmentList` → `getEquipmentList(ctx)` |
| 588-625 | `renderResultSection` | 同上，key 為 `'result'` |

機械式替換：`isEdit` → `ctx.mode !== 'view'`；`formData` → `ctx.formData`；`rerender` → `ctx.rerender`；`equipPicker` / `signaturePad` → `ctx.ui.*`；`vendors` / `equipments` → `ctx.data.*`；`'maintenance-assignees'` 等 id → `fieldId(ctx, 'assignees')`、`fieldId(ctx, 'assignee-members')`、`fieldId(ctx, 'partner-vendors')`；handler 呼叫補第一個 `ctx` 參數。

保養結果段的備註 textarea（原 620-624）原本用 `formData = Object.assign({}, formData, {...})` 重新指派且**不觸發重繪**，改為就地寫入並保持不重繪（重繪會讓游標跳掉，且 `stateful` 的還原機制只在有 rerender 時作用）：

```js
            onChange: function (e) { ctx.formData.remark = e.target.value; },
```

- [ ] **Step 5: `MaintenanceViewEditForm` 改為呼叫新模組**

`maintenance.js:363-665` 改成：

```js
  function MaintenanceViewEditForm(props) {
    var targetCase = props.targetCase;
    var cases = props.cases;
    var setCases = props.setCases;
    var stores = props.stores;
    var setStores = props.setStores;
    var setView = props.setView;
    var mode = props.mode;
    var showToast = props.showToast;
    var backView = props.backView === undefined ? 'maintenance-list' : props.backView;
    var customers = props.customers;
    var vendors = props.vendors || [];
    var equipments = props.equipments || [];

    var formData = CaseAssigneeUtils.normalizeMaintenanceCase(targetCase);
    // 進頁時先依排程資料校正一次保養狀態，避免顯示與判斷規則對不上
    formData.status = MaintenanceDetailSections.resolveProgressStatus(formData);
    // 設備清單改存在 formData 上，排程彈窗的整筆 merge 才帶得走
    formData.equipmentList = (formData.equipmentList || []).slice();
    var isEdit = mode === 'edit';
    var ui = MaintenanceDetailSections.createUiState();

    return stateful(function (rerender) {
      var ctx = {
        formData: formData,
        ui: ui,
        data: { equipments: equipments, vendors: vendors, stores: stores, customers: customers },
        rerender: rerender,
        showToast: showToast,
        include: MaintenanceDetailSections.SECTION_KEYS,
        mode: mode,
        idPrefix: 'maintenance'
      };

      function handleSubmit() {
        var updatedData = Object.assign({}, formData);
        updatedData.status = MaintenanceDetailSections.resolveProgressStatus(updatedData);
        if (updatedData.status === '已完成' && !updatedData.completionDate) {
          updatedData.completionDate = IESS.caseDateTime.now();
        }
        // 保養計劃進度不顯示案件編號，但銷案審核仍需要，故沿用保養日期在背景補上編號
        if (!updatedData.caseNumber && updatedData.planDate) {
          updatedData.caseNumber = updatedData.planDate.replace(/-/g, '')
            + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        }
        showToast('保養狀態已更新');
        // 保養完成同時押上門市的「上次保養日期」
        if (updatedData.status === '已完成') {
          MaintenanceDetailSections.updateStoreLastMaintenanceDate(stores, setStores, updatedData);
        }
        setCases(cases.map(function (c) {
          return c.id === updatedData.id ? updatedData : c;
        }));
        setView(backView);
      }

      return h("div", { className: "max-w-6xl mx-auto space-y-6" },
        PageHeader({
          title: isEdit ? '編輯保養明細' : '查看保養明細',
          onClose: function () { setView(backView); },
          wrapperClass: 'flex justify-between items-center p-6 bg-white rounded-lg shadow-sm border border-gray-100'
        }),
        MaintenanceDetailSections.renderSections(ctx),
        isEdit && h("div", { className: "flex justify-end gap-3 pb-2" },
          h("button", {
            type: "button",
            onClick: function () { setView(backView); },
            className: "px-6 py-2.5 border rounded-md bg-white"
          }, "取消"),
          h("button", {
            type: "button",
            onClick: handleSubmit,
            className: "px-8 py-2.5 bg-blue-600 text-white rounded-md"
          }, Icons.Save({ className: "inline h-4 w-4 mr-2" }), "儲存")
        ),
        MaintenanceDetailSections.renderOverlays(ctx)
      );
    });
  }
```

注意原本的 `formData = CaseAssigneeUtils.normalizeMaintenanceCase(targetCase)` **沒有** deep copy，`normalizeMaintenanceCase` 是否回傳新物件須確認；若它回傳同一參照，改為 `CaseAssigneeUtils.normalizeMaintenanceCase(JSON.parse(JSON.stringify(targetCase)))`，否則就地 mutate 會直接改到 store 裡的案件。

`maintenance.js` 內其他使用 `resolveMaintenanceProgressStatus` 的地方（`MaintenanceList` 等）改為 `MaintenanceDetailSections.resolveProgressStatus`。`closeMaintenanceCase`（38-59）若用到 `updateStoreLastMaintenanceDate`，改為 `MaintenanceDetailSections.updateStoreLastMaintenanceDate`。

- [ ] **Step 6: `index.html` 加入新 script**

在第 74 行 `<script src="src/features/repair/maintenance.js"></script>` **之前**插入：

```html
  <script src="src/features/repair/maintenance-detail-sections.js"></script>
```

- [ ] **Step 7: 跑安全網測試，確認行為未變**

Run: `node scripts/verify-maintenance-detail-sections.mjs`
Expected: PASS，通過數與 Step 1 記下的相同。

特別注意這支測試的最後兩段：「已完成同時押上完成時間」「門市的上次保養日期同步為保養日期」「檢視模式沒有任何可編輯欄位」——它們正是 `mode` 與 `equipmentList` 改動的把關點。

- [ ] **Step 8: 跑相關回歸**

Run:
```bash
node scripts/verify-customer-maintenance-periods.mjs
node scripts/verify-maintenance-period-column.mjs
node scripts/verify-maintenance-start-months.mjs
node scripts/verify-maintenance-default-assignee.mjs
node scripts/verify-store-maintenance-flag.mjs
```
Expected: 全部 PASS

- [ ] **Step 9: Commit**

```bash
git add src/features/repair/maintenance-detail-sections.js src/features/repair/maintenance.js index.html
git commit -m "refactor: 保養明細區塊抽成 MaintenanceDetailSections"
```

---

### Task 3: 排程彈窗維修分支改用共用模組

**Files:**
- Modify: `src/features/scheduling/case-arrangement.js`
- Modify: `src/app.js:664-678`（`CaseArrangement` 補 props）
- Modify: `scripts/verify-case-service-item-remarks.mjs:328`
- Modify: `scripts/verify-case-multi-equipment-arrangement.mjs:99-130`
- Modify: `scripts/verify-case-service-item-pager.mjs:354`
- Test: `scripts/verify-arrangement-detail-sections.mjs`（新建，本任務只放維修的斷言）

**Interfaces:**
- Consumes: `RepairCaseDetailSections.createUiState()`、`.renderSections(ctx)`、`.renderOverlays(ctx)`、`.SECTION_KEYS`（Task 1）
- Produces: `scheduleModal` 物件新增 `ui` 欄位；`CaseArrangement.renderScheduleServiceItems` 自 `window` 移除

- [ ] **Step 1: 寫失敗的測試**

建立 `scripts/verify-arrangement-detail-sections.mjs`。CDP 骨架同樣從 `verify-maintenance-detail-sections.mjs` 第 1-56 行與第 125-150 行複製，`PORT` 改 `9372`、`--user-data-dir` 改 `/tmp/iess-arrangement-detail-profile`。

彈窗不像元件可以直接掛載，必須走真實 UI 路徑開啟。SETUP 提供操作 helper：

```js
const SETUP = `(function () {
  window.__openArrangement = function () {
    // 走真實選單路徑進入「案件安排」，避免測試綁死內部 view 名稱
    var el = Array.prototype.slice.call(document.querySelectorAll('button, a'))
      .filter(function (b) { return b.textContent.trim() === '案件安排'; })[0];
    if (!el) throw new Error('找不到「案件安排」選單');
    el.click();
    return true;
  };
  window.__modal = function () {
    return document.querySelector('.app-modal-overlay');
  };
  window.__modalSectionTitles = function () {
    var m = window.__modal();
    if (!m) return null;
    return Array.prototype.map.call(m.querySelectorAll('section h3, section h4'),
      function (el) { return el.textContent.trim(); });
  };
  window.__modalSectionByTitle = function (title) {
    var m = window.__modal();
    if (!m) return null;
    return Array.prototype.slice.call(m.querySelectorAll('section')).filter(function (s) {
      var t = s.querySelector('h3, h4');
      return t && t.textContent.trim() === title;
    })[0] || null;
  };
  window.__modalEditableCount = function (title) {
    var s = window.__modalSectionByTitle(title);
    if (!s) return -1;
    return s.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])').length;
  };
  window.__clickText = function (text, scope) {
    var root = scope ? document.querySelector(scope) : document;
    var el = Array.prototype.slice.call(root.querySelectorAll('button'))
      .filter(function (b) { return b.textContent.trim() === text; })[0];
    if (!el) throw new Error('找不到按鈕：' + text);
    el.click();
    return true;
  };
  // 待安排面板的三個下拉依序是 工項分類／客戶名稱／組別，之後是公司區域
  // 核取清單與「查詢」按鈕；查詢後每筆待安排案件是一個可點的 div。
  window.__setSelect = function (el, value) {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  window.__queryPending = function (workCategory) {
    var panel = document.querySelector('aside, .md\\:w-72') || document;
    var selects = panel.querySelectorAll('select');
    window.__setSelect(selects[0], workCategory);
    // 組別為必填，挑第一個非空選項
    var groupSel = selects[2];
    var firstGroup = Array.prototype.slice.call(groupSel.options)
      .filter(function (o) { return o.value; })[0];
    if (!firstGroup) throw new Error('組別下拉沒有可選項');
    window.__setSelect(groupSel, firstGroup.value);
    // 公司區域勾「全部」
    var allBox = Array.prototype.slice.call(panel.querySelectorAll('label'))
      .filter(function (l) { return l.textContent.trim() === '全部'; })[0];
    if (allBox) {
      var cb = allBox.querySelector('input[type=checkbox]');
      if (cb && !cb.checked) cb.click();
    }
    window.__clickText('查詢');
    return true;
  };
  window.__openFirstPending = function () {
    var items = document.querySelectorAll('div.cursor-pointer.hover\\:bg-blue-50');
    if (!items.length) throw new Error('待安排清單為空');
    items[0].click();
    return true;
  };
  return true;
})()`;
```

選擇器若與實際 DOM 對不上，以 `case-arrangement.js:1064-1168` 的待安排面板實作為準調整，不要為了測試而把內部函式匯出到 `window`。

維修的斷言：

```js
  console.log('Section 1｜維修排程彈窗沿用編輯頁區塊');
  assertDeep(await evaluate('window.__modalSectionTitles()'),
    ['1. 案件資料', '2. 設備與服務項目', '3. 維修結果'],
    '彈窗為三段式，編號自 1 起算（頂端已有排程主控）');

  console.log('\nSection 2｜案件資料改為唯讀');
  assertEq(await evaluate(`window.__modalEditableCount('1. 案件資料')`), 0,
    '客戶／門市／工項分類／叫修項目／叫修原因／故障描述皆為唯讀');

  console.log('\nSection 3｜維修結果區塊存在且欄位齊全');
  assertEq(await evaluate(`(function () {
    var s = window.__modalSectionByTitle('3. 維修結果');
    return {
      processStatus: !!s.querySelector('select[name="processStatus"]'),
      repairRemark: !!s.querySelector('textarea[name="repairRemark"]'),
      signButton: Array.prototype.slice.call(s.querySelectorAll('button'))
        .some(function (b) { return b.textContent.trim().indexOf('客戶簽收') !== -1; }),
      timeInputs: s.querySelectorAll('input[type="datetime-local"]').length
    };
  })()`), { processStatus: true, repairRemark: true, signButton: true, timeInputs: 2 },
    '處理狀態、維修備註、客戶簽收、到店與完成時間皆在');

  console.log('\nSection 4｜設備區可加入設備並解除維修結果鎖定');
  assertEq(await evaluate(`(function () {
    var s = window.__modalSectionByTitle('3. 維修結果');
    return s.querySelector('select[name="processStatus"]').disabled;
  })()`), true, '未加入設備時處理狀態鎖住');
  await evaluate(`window.__clickText('加入設備', '.app-modal-overlay')`);
  assertTrue(await evaluate(`(function () {
    var m = window.__modal();
    return Array.prototype.slice.call(m.querySelectorAll('button'))
      .some(function (b) { return b.textContent.trim() === '手動選擇'; });
  })()`), '「加入設備」下拉出現「手動選擇」與「掃描 QR Code」');

  console.log('\nSection 5｜設備挑選器不被彈窗捲動容器裁掉');
  await evaluate(`window.__clickText('手動選擇', '.app-modal-overlay')`);
  assertTrue(await evaluate(`(function () {
    var pickers = document.querySelectorAll('.app-modal-overlay');
    // renderOverlays 掛在排程彈窗之外，故頁面上會有兩層 overlay
    return pickers.length >= 2;
  })()`), '設備挑選器渲染在排程彈窗容器之外');
```

- [ ] **Step 2: 跑測試，確認它失敗**

Run: `node scripts/verify-arrangement-detail-sections.mjs`
Expected: FAIL。目前彈窗是「1. 案件資料 / 2. 設備與服務項目」兩段、案件資料可編輯、沒有維修結果段。

- [ ] **Step 3: `app.js` 補上缺少的 props**

`src/app.js:664-678` 的 `h(CaseArrangement, {...})` 加入四個 props：

```js
          stores: s.stores,
          setStores: setStores,
          vehicles: s.vehicles,
          vendors: s.vendors,
          equipments: s.equipments,
```

`setStores` 已定義於 `src/app.js:225`。`s.vehicles` / `s.vendors` / `s.equipments` 的鍵名須與 `src/app.js` 其他 view 的傳法一致——參照 `src/app.js:376`、`449`、`546` 的寫法確認。

`case-arrangement.js:161-175` 的 props 解構補上：

```js
    var setStores = props.setStores;
    var vehicles = props.vehicles || [];
    var vendors = props.vendors || [];
    var equipments = props.equipments || [];
```

- [ ] **Step 4: 建立彈窗的 ctx 與 ui**

`case-arrangement.js` 內新增一個 helper（放在 `renderScheduleModal` 之前）：

```js
      // 排程彈窗與編輯頁共用同一份區塊實作；彈窗略過「排程資料」段，
      // 因為頂端已有預計日期／時間／組別的主控欄位。
      function buildDetailCtx(sourceType) {
        if (sourceType === 'repair') {
          return {
            formData: scheduleModal.formData,
            ui: scheduleModal.ui,
            data: {
              equipments: equipments,
              deviceCategories: deviceCategories,
              processMethods: processMethods,
              vehicles: vehicles,
              vendors: vendors,
              stores: stores
            },
            rerender: rerender,
            showToast: showToast,
            include: ['case', 'equipment', 'result'],
            idPrefix: 'schedule-modal'
          };
        }
        return null;
      }
```

`buildScheduleModalState`（449-476）與 `openEditScheduleModal`（495-542）建立 `scheduleModal` 時，各補上一行：

```js
          ui: sourceType === 'repair'
            ? RepairCaseDetailSections.createUiState()
            : null,
```

（保養的分支在 Task 4 補。）

- [ ] **Step 5: 改寫 `renderScheduleModalDetails` 的維修分支**

`case-arrangement.js:933-943` 的 `renderScheduleModalDetails` 改為：

```js
      function renderScheduleModalDetails(item) {
        if (!scheduleModal || !scheduleModal.formData) return null;
        var formData = scheduleModal.formData;
        if (item.sourceType === 'repair') {
          return h('div', { className: 'space-y-6' },
            RepairCaseDetailSections.renderSections(buildDetailCtx('repair')));
        }
        if (item.sourceType === 'maintenance') return renderMaintenanceScheduleDetails(formData);
        if (item.sourceType === 'project') return renderProjectScheduleDetails(formData, item);
        return h('div', { className: 'space-y-2 bg-gray-50 border border-gray-200 rounded-md p-4 text-sm text-gray-500' },
          '此案件類型暫不支援詳細編輯'
        );
      }
```

- [ ] **Step 6: 把 overlays 掛在彈窗容器之外**

`renderScheduleModal`（945 起）的最外層改為陣列，讓浮層成為 `.app-modal-overlay` 的兄弟節點，否則設備挑選器與簽名板會被中段的 `overflow-y-auto` 裁掉：

```js
      function renderScheduleModal() {
        if (!scheduleModal) return null;
        var isEdit = scheduleModal.mode === 'edit';
        var detailCtx = buildDetailCtx(scheduleModal.item.sourceType);
        return [
          h('div', { className: 'app-modal-overlay p-2 sm:p-4' },
            /* 原有彈窗內容不動 */
          ),
          detailCtx && RepairCaseDetailSections.renderOverlays(detailCtx)
        ];
      }
```

- [ ] **Step 7: 刪除死碼**

刪除下列內容：

- `case-arrangement.js:48-159` 的 `renderScheduleServiceItems` 整個函式
- `case-arrangement.js:1182` 的 `CaseArrangement.renderScheduleServiceItems = renderScheduleServiceItems;`
- `case-arrangement.js:708-843` 的 `renderRepairScheduleDetails` 整個函式
- `case-arrangement.js` 的 `updateScheduleServiceItemField`（612-623）與 `setScheduleActiveItemIndex`（604-610）——已由共用模組的 handler 取代
- `updateScheduleFormField`（571-602）中 `customerName` 與 `storeName` 的連動分支（含「查無則保留原值」的註解）。若刪完整個函式無人呼叫，整個函式一併刪除。

刪除後 `grep -n "renderScheduleServiceItems\|renderRepairScheduleDetails\|updateScheduleServiceItemField\|setScheduleActiveItemIndex" src/features/scheduling/case-arrangement.js` 應無輸出。

- [ ] **Step 8: 跑新測試，確認通過**

Run: `node scripts/verify-arrangement-detail-sections.mjs`
Expected: PASS

- [ ] **Step 9: 更新依賴已刪除函式的三支既有 script**

以下三支直接呼叫 `CaseArrangement.renderScheduleServiceItems`，該函式已刪除：

- `scripts/verify-case-service-item-remarks.mjs:328`
- `scripts/verify-case-multi-equipment-arrangement.mjs:99-130`
- `scripts/verify-case-service-item-pager.mjs:354`

三支都是在驗「排程彈窗逐設備列出、卡片可獨立編輯、分頁器可切換」。改法：把該段呼叫替換為透過 `RepairCaseDetailSections.renderSections` 渲染設備段，再對產出的 DOM 下同樣的斷言。以 `verify-case-multi-equipment-arrangement.mjs` 為例：

```js
  const arrangement = await evaluate(`(function () {
    var c = (INITIAL_CASES || []).filter(function (x) {
      return RepairCaseServiceItems.getItems(x).length >= 2;
    })[0];
    var items = RepairCaseServiceItems.getItems(c);
    var calls = [];
    var ui = RepairCaseDetailSections.createUiState();
    function render(activeIndex) {
      ui.activeItemIndex = activeIndex;
      var host = document.createElement('div');
      var nodes = RepairCaseDetailSections.renderSections({
        formData: c,
        ui: ui,
        data: {
          equipments: [], deviceCategories: [],
          processMethods: (typeof INITIAL_PROCESS_METHODS !== 'undefined' ? INITIAL_PROCESS_METHODS : []),
          vehicles: [], vendors: [], stores: []
        },
        rerender: function () {},
        showToast: function () {},
        include: ['equipment'],
        idPrefix: 'test'
      });
      nodes.forEach(function (n) { host.appendChild(n); });
      return host;
    }
    // 以下維持原有的 reasonBoxes / textContent 蒐集與斷言邏輯
    ...
  })()`);
```

原有的 `onReasonChange` 回呼斷言改為驗「輸入後 `c.serviceItems` 內對應項目的 `actualReason` 已更新」——共用模組是直接寫回 `formData`，不再透過回呼。

`RepairCaseServiceItemCard` 沒變，所以 `querySelectorAll('textarea[name="serviceItemActualReason"]')` 這類選擇器可原樣沿用。

- [ ] **Step 10: 跑更新過的三支 script**

Run:
```bash
node scripts/verify-case-service-item-remarks.mjs
node scripts/verify-case-multi-equipment-arrangement.mjs
node scripts/verify-case-service-item-pager.mjs
```
Expected: 全部 PASS

- [ ] **Step 11: Commit**

```bash
git add src/features/scheduling/case-arrangement.js src/app.js scripts/verify-arrangement-detail-sections.mjs scripts/verify-case-service-item-remarks.mjs scripts/verify-case-multi-equipment-arrangement.mjs scripts/verify-case-service-item-pager.mjs
git commit -m "feat: 案件安排維修彈窗沿用編輯頁區塊與功能"
```

---

### Task 4: 排程彈窗保養分支改用共用模組

含 `buildScheduledRecord` 的保養狀態修正與門市「上次保養日期」同步。

**Files:**
- Modify: `src/features/scheduling/case-arrangement.js`
- Modify: `scripts/verify-arrangement-detail-sections.mjs`（追加保養的斷言）

**Interfaces:**
- Consumes: `MaintenanceDetailSections.createUiState()`、`.renderSections(ctx)`、`.renderOverlays(ctx)`、`.resolveProgressStatus(formData)`、`.updateStoreLastMaintenanceDate(stores, setStores, maintenanceCase)`（Task 2）；Task 3 建立的 `buildDetailCtx(sourceType)`
- Produces: 無新介面

- [ ] **Step 1: 追加失敗的測試**

在 `scripts/verify-arrangement-detail-sections.mjs` 的維修斷言之後追加：

```js
  console.log('\nSection 6｜保養排程彈窗沿用保養明細區塊');
  // 開啟一筆保養案件的排程彈窗（操作路徑同維修，工項分類選「保養」）
  assertDeep(await evaluate('window.__modalSectionTitles()'),
    ['1. 案件資料', '2. 設備資料', '3. 保養結果'],
    '保養彈窗為三段式，編號自 1 起算');

  console.log('\nSection 7｜保養案件資料改為唯讀');
  assertEq(await evaluate(`window.__modalEditableCount('1. 案件資料')`), 0,
    '客戶／門市／門市地址／服務等級皆為唯讀');

  console.log('\nSection 8｜保養結果可編輯');
  assertEq(await evaluate(`(function () {
    var s = window.__modalSectionByTitle('3. 保養結果');
    return {
      status: !!s.querySelector('select'),
      remark: !!s.querySelector('textarea'),
      signButton: Array.prototype.slice.call(s.querySelectorAll('button'))
        .some(function (b) { return b.textContent.trim().indexOf('客戶簽收') !== -1; })
    };
  })()`), { status: true, remark: true, signButton: true },
    '保養狀態、備註、客戶簽收皆可操作');

  console.log('\nSection 9｜手選「已完成」不被 planDate 推算覆寫');
  assertEq(await evaluate(`(function () {
    var s = window.__modalSectionByTitle('3. 保養結果');
    var sel = s.querySelector('select');
    sel.value = '已完成';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`), true, '將保養狀態手動改為「已完成」');
  await evaluate(`window.__clickText('儲存', '.app-modal-overlay')`);
  await sleep(300);
  // app.js 的 store 是 IIFE 內的區域變數，測試讀不到；改以「重新點開同一筆案件」
  // 從 UI 讀回儲存結果，這也更貼近使用者實際會看到的東西。
  await evaluate(`window.__openCalendarEventByText('保養')`);
  assertEq(await evaluate(`(function () {
    var s = window.__modalSectionByTitle('3. 保養結果');
    return s.querySelector('select').value;
  })()`), '已完成', '重新開啟後狀態仍為「已完成」，未被 planDate 推算覆寫');
  assertTrue(await evaluate(`(function () {
    var s = window.__modalSectionByTitle('3. 保養結果');
    return s.textContent.indexOf('完成時間') !== -1
      && !/完成時間[\s\S]{0,40}—/.test(s.textContent);
  })()`), '已完成同時押上完成時間');
```

`__openCalendarEventByText` 需在 SETUP 中補上——點日曆上事件標題含指定文字的元素：

```js
  window.__openCalendarEventByText = function (text) {
    var el = Array.prototype.slice.call(document.querySelectorAll('.fc-event, .fc-event-title'))
      .filter(function (e) { return e.textContent.indexOf(text) !== -1; })[0];
    if (!el) throw new Error('日曆上找不到事件：' + text);
    el.click();
    return true;
  };
```

門市「上次保養日期」同樣從 UI 讀回——切到「客戶建檔 → 門市管理」看該門市的欄位：

```js
  console.log('\nSection 10｜門市「上次保養日期」同步更新');
  assertEq(await evaluate(`(function () {
    window.__clickText('關閉') || (window.__modal() && window.__modal().remove());
    return true;
  })()`), true, '關閉排程彈窗');
  await evaluate(`window.__gotoStoreList()`);
  await sleep(500);
  assertTrue(await evaluate(`(function () {
    var row = Array.prototype.slice.call(document.querySelectorAll('tbody tr'))
      .filter(function (tr) { return tr.textContent.indexOf(window.__savedStoreName) !== -1; })[0];
    if (!row) throw new Error('門市列表找不到該門市：' + window.__savedStoreName);
    return row.textContent.indexOf(window.__savedPlanDate) !== -1;
  })()`), '門市列表的上次保養日期等於本次保養日期');
```

`__gotoStoreList` 與兩個記錄值需在 SETUP 中補上：

```js
  window.__savedStoreName = '';
  window.__savedPlanDate = '';
  window.__gotoStoreList = function () {
    // 走真實選單路徑，避免綁死內部 view 名稱
    ['客戶建檔', '門市管理'].forEach(function (label) {
      var el = Array.prototype.slice.call(document.querySelectorAll('button, a'))
        .filter(function (b) { return b.textContent.trim() === label; })[0];
      if (!el) throw new Error('找不到選單：' + label);
      el.click();
    });
    return true;
  };
```

`__savedStoreName` 與 `__savedPlanDate` 在開啟保養彈窗、按儲存之前，從彈窗的「門市名稱」欄位與頂端「預計日期」輸入框讀出並記下。若門市列表沒有「上次保養日期」欄，改開該門市的編輯頁確認該欄位——先以 `grep -n "lastMaintenanceDate" src/features/customer/store-list.js src/features/customer/store-form.js` 確認它出現在哪裡，再挑對應路徑。

- [ ] **Step 2: 跑測試，確認新增的保養斷言失敗**

Run: `node scripts/verify-arrangement-detail-sections.mjs`
Expected: 維修的斷言 PASS，保養的斷言 FAIL

- [ ] **Step 3: `buildDetailCtx` 加上保養分支**

`case-arrangement.js` 的 `buildDetailCtx` 補上：

```js
        if (sourceType === 'maintenance') {
          return {
            formData: scheduleModal.formData,
            ui: scheduleModal.ui,
            data: {
              equipments: equipments,
              vendors: vendors,
              stores: stores,
              customers: customers
            },
            rerender: rerender,
            showToast: showToast,
            include: ['case', 'equipment', 'result'],
            mode: 'edit',
            idPrefix: 'schedule-modal'
          };
        }
```

`buildScheduleModalState` 與 `openEditScheduleModal` 建立 `scheduleModal` 時的 `ui` 改為：

```js
          ui: sourceType === 'repair'
            ? RepairCaseDetailSections.createUiState()
            : sourceType === 'maintenance'
            ? MaintenanceDetailSections.createUiState()
            : null,
```

- [ ] **Step 4: 改寫 `renderScheduleModalDetails` 的保養分支與 overlays**

```js
        if (item.sourceType === 'maintenance') {
          return h('div', { className: 'space-y-6' },
            MaintenanceDetailSections.renderSections(buildDetailCtx('maintenance')));
        }
```

`renderScheduleModal` 的 overlays 那行改為依 `sourceType` 分派：

```js
          detailCtx && (scheduleModal.item.sourceType === 'repair'
            ? RepairCaseDetailSections.renderOverlays(detailCtx)
            : MaintenanceDetailSections.renderOverlays(detailCtx))
```

- [ ] **Step 5: 修正 `buildScheduledRecord` 的保養狀態**

`case-arrangement.js:298-305` 目前無條件推算保養狀態，會把使用者手選的「已完成」覆蓋掉。改為：

```js
      if (sourceType === 'maintenance') {
        // 「已完成」是使用者手動決定的終態，不因 planDate 而被推算回去；
        // 其餘狀態仍依排程日期校正，與保養明細頁同一套規則。
        merged.status = MaintenanceDetailSections.resolveProgressStatus(merged);
        if (merged.status === '已完成' && !merged.completionDate) {
          merged.completionDate = IESS.caseDateTime.now();
        }
        if (!merged.caseNumber && merged.planDate) {
          merged.caseNumber = merged.planDate.replace(/-/g, '') +
            String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        }
      }
```

確認 `MaintenanceDetailSections.resolveProgressStatus` 的實作確實讓「已完成」維持不變；若不是，這裡改用顯式判斷：

```js
        if (merged.status !== '已完成') {
          merged.status = MaintenanceDetailSections.resolveProgressStatus(merged);
        }
```

同時把 `ScheduleUtils.resolveMaintenanceStatus` 的呼叫移除。若 `schedule-utils.js` 內已無其他使用者（`grep -rn "resolveMaintenanceStatus" src`），一併刪除該函式。

- [ ] **Step 6: `applySchedule` 同步門市「上次保養日期」**

`case-arrangement.js:350-368` 的 `applySchedule`，在 `patchLocalCaseRecord` 之後補上：

```js
      // 保養結案時門市的「上次保養日期」要跟著走，否則此入口與保養明細頁寫出的資料不一致
      if (sourceType === 'maintenance' && merged.status === '已完成') {
        MaintenanceDetailSections.updateStoreLastMaintenanceDate(stores, setStores, merged);
      }
```

- [ ] **Step 7: 刪除 `renderMaintenanceScheduleDetails`**

刪除 `case-arrangement.js:844-910` 的 `renderMaintenanceScheduleDetails` 整個函式。刪除後 `grep -n "renderMaintenanceScheduleDetails" src/features/scheduling/case-arrangement.js` 應無輸出。

- [ ] **Step 8: 跑測試，確認全數通過**

Run: `node scripts/verify-arrangement-detail-sections.mjs`
Expected: PASS（維修與保養斷言皆通過）

- [ ] **Step 9: Commit**

```bash
git add src/features/scheduling/case-arrangement.js scripts/verify-arrangement-detail-sections.mjs
git commit -m "feat: 案件安排保養彈窗沿用保養明細區塊與功能"
```

---

### Task 5: 全套回歸與死碼清查

**Files:**
- Modify: 依回歸結果修正（預期無）
- Modify: `README.md`（檔案結構樹補上兩支新模組）

**Interfaces:**
- Consumes: Task 1-4 的全部產出
- Produces: 無

- [ ] **Step 1: 跑全部 verify script**

Run:
```bash
for f in scripts/verify-*.mjs; do
  echo "=== $f ==="
  node "$f" || echo "FAILED: $f"
done
```
Expected: 無任何 `FAILED:` 輸出。

有些 script 會同時搶 Chrome debugging port；若出現連線失敗，逐支重跑確認，不要以「偶發」帶過。

- [ ] **Step 2: 死碼清查**

Run:
```bash
grep -rn "renderScheduleServiceItems\|renderRepairScheduleDetails\|renderMaintenanceScheduleDetails\|updateScheduleServiceItemField\|setScheduleActiveItemIndex\|resolveMaintenanceProgressStatus" src scripts
```
Expected: 無輸出。若 `resolveMaintenanceProgressStatus` 仍有出現，確認是否已全數改為 `MaintenanceDetailSections.resolveProgressStatus`。

Run:
```bash
grep -c "" src/features/repair/case-form.js src/features/repair/maintenance.js src/features/scheduling/case-arrangement.js
```
Expected: 三個檔案的行數都應明顯低於改動前（`case-form.js` 833、`maintenance.js` 665、`case-arrangement.js` 1185）。若沒有變短，代表區塊是被複製而非搬移，回頭刪掉重複的那一份。

- [ ] **Step 3: 更新 README 檔案結構樹**

`README.md` 的 `src/features/repair/` 區塊補上兩行，位置依字母／功能順序插入：

```
│   │   ├── case-detail-sections.js        案件區塊渲染器（編輯頁與排程彈窗共用）
│   │   ├── maintenance-detail-sections.js 保養區塊渲染器（保養明細與排程彈窗共用）
```

同時在「架構說明」補一句：

```
- **區塊共用**：維修／保養／工程的案件內容區塊各有一支渲染器（`*-detail-sections.js`、
  `ProjectDetailView`），編輯頁與「案件安排」排程彈窗呼叫同一份實作，版面與功能不會各自漂移。
```

- [ ] **Step 4: 手動確認彈窗實際操作**

以瀏覽器開啟 `index.html`，走一次完整流程：

1. 戰情室 → 案件安排 → 待安排面板選條件查詢 → 點一筆維修案件
2. 確認彈窗為「1. 案件資料 / 2. 設備與服務項目 / 3. 維修結果」三段
3. 案件資料全部無法編輯
4. 「加入設備」→「手動選擇」→ 挑一台設備 → 挑選器浮在彈窗之上、未被裁切
5. 新增一筆處理紀錄、切換其狀態、再刪除
6. 處理狀態改為任一值、按「客戶簽收」簽名、填維修備註、填到店與完成時間
7. 儲存 → 回到日曆，重新點開該案件，確認上述內容都在
8. 對一筆保養案件重複 1-7（保養結果段改為保養狀態／備註／客戶簽收）
9. 保養案件存成「已完成」後，到「客戶建檔 → 門市管理」確認該門市的上次保養日期已同步
10. 點一筆工程立案，確認彈窗仍是原本的唯讀三段式，未受影響

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: README 補上區塊共用渲染器"
```
