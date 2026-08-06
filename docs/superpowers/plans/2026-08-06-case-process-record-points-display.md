# 叫修案件處理方式「積分數」顯示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在叫修案件的三個「處理方式」畫面加上唯讀的「積分數」顯示，值由處理方式主檔帶入（未結案取即時值、已結案取快照值）。

**Architecture:** 新增單一解析函式 `ProcessMethodUtils.resolveCaseRecordPoints()` 封裝「未結案取主檔／已結案取快照」規則，三個渲染畫面共用。表格各自顯式加一欄，不擴充 `CASE_DISPLAY_COLUMNS`。`app.js` 補傳 `processMethods` 給原本拿不到主檔的兩個元件。

**Tech Stack:** 原生 HTML / CSS / JavaScript，無建置步驟。全域 IIFE 模組掛在 `window` 上，由 `index.html` 依序載入。驗證用 Node `node:vm` 腳本（比照 `scripts/verify-repair-multi-assignee.mjs`）。

## Global Constraints

- 純顯示變更：不新增可編輯欄位、不改案件存檔結構、不改 `toCaseProcessRecord()` 的快照行為。
- 不修改 `src/features/reports/performance-utils.js`，績效計算維持使用快照值。
- 不擴充 `ProcessMethodUtils.CASE_DISPLAY_COLUMNS`。
- 欄位標題文字一律為 `積分數`，插入位置為「規格」與「數量」之間。
- 積分為 `0` 時顯示 `0`，無值時顯示 `—`（U+2014 em dash，與既有儲存格 fallback 一致）。
- 程式風格比照現有檔案：ES5 語法（`var`、`function`）、`'use strict'`、IIFE。

---

### Task 1: 積分解析函式 `resolveCaseRecordPoints`

**Files:**
- Modify: `src/features/permissions/process-method-utils.js`（在 `formatCaseProcessRecordLabel` 之後新增函式；並在檔尾 `window.ProcessMethodUtils` 匯出物件加上一筆）
- Test: `scripts/verify-case-record-points.mjs`（新建）

**Interfaces:**
- Consumes: 既有的 `findProcessMethodById(processMethods, id)`
- Produces: `ProcessMethodUtils.resolveCaseRecordPoints(record, processMethods, isClosed) -> number | null`
  - `isClosed` 為 truthy → 回傳 `Number(record.points)`，非數字則 `null`
  - 否則 → 以 `record.processMethodId` 查 `processMethods`；命中且其 `points` 為數字則回傳主檔值；否則退回 `record.points`（非數字則 `null`）
  - `record` 為 null/undefined → 回傳 `null`

- [ ] **Step 1: 寫失敗的測試**

建立 `scripts/verify-case-record-points.mjs`：

```javascript
#!/usr/bin/env node
/**
 * Verification for ProcessMethodUtils.resolveCaseRecordPoints.
 * Loads the browser IIFE module in Node with minimal stubs.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

let passed = 0;
let failed = 0;

function pass(name, detail) {
  passed += 1;
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail) {
  failed += 1;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function assertEq(actual, expected, name) {
  if (actual !== expected) {
    fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    return false;
  }
  pass(name, JSON.stringify(actual));
  return true;
}

const sandbox = { console, PROCESS_METHOD_CATEGORIES: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  readFileSync(join(ROOT, 'src/features/permissions/process-method-utils.js'), 'utf8'),
  sandbox,
  { filename: 'process-method-utils.js' }
);

const PMU = sandbox.window.ProcessMethodUtils;

const processMethods = [
  { id: 'PS0001', category1: '零件類', category2: '商用分離式', category3: '壓縮機',
    specification: '6馬力', unit: '台', points: 9 },
  { id: 'PS0002', category1: '零件類', category2: '商用分離式', category3: '壓縮機',
    specification: '10馬力', unit: '台', points: 0 }
];

// 快照 5，主檔已被改成 9
const openRecord = { id: 1, processMethodId: 'PS0001', points: 5, qty: 1 };
// 主檔項目已被刪除
const orphanRecord = { id: 2, processMethodId: 'GONE', points: 7, qty: 1 };
// 主檔積分為 0
const zeroRecord = { id: 3, processMethodId: 'PS0002', points: 4, qty: 1 };

console.log('resolveCaseRecordPoints');
assertEq(PMU.resolveCaseRecordPoints(openRecord, processMethods, false), 9,
  '未結案取主檔即時值');
assertEq(PMU.resolveCaseRecordPoints(openRecord, processMethods, true), 5,
  '已結案取案件快照值');
assertEq(PMU.resolveCaseRecordPoints(orphanRecord, processMethods, false), 7,
  '主檔項目已刪除時退回快照值');
assertEq(PMU.resolveCaseRecordPoints(zeroRecord, processMethods, false), 0,
  '主檔積分為 0 時回傳 0 而非退回快照');
assertEq(PMU.resolveCaseRecordPoints({ id: 4, processMethodId: 'GONE' }, processMethods, false), null,
  '快照與主檔皆無積分時回傳 null');
assertEq(PMU.resolveCaseRecordPoints(null, processMethods, false), null,
  'record 為 null 時回傳 null');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node scripts/verify-case-record-points.mjs`
Expected: FAIL — `TypeError: PMU.resolveCaseRecordPoints is not a function`

- [ ] **Step 3: 實作函式**

在 `src/features/permissions/process-method-utils.js` 中，`formatCaseProcessRecordLabel` 函式之後插入：

```javascript
  function toPointsNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    var n = Number(value);
    return isNaN(n) ? null : n;
  }

  function resolveCaseRecordPoints(record, processMethods, isClosed) {
    if (!record) return null;
    var snapshot = toPointsNumber(record.points);
    if (isClosed) return snapshot;
    var pm = findProcessMethodById(processMethods, record.processMethodId);
    if (pm) {
      var live = toPointsNumber(pm.points);
      if (live !== null) return live;
    }
    return snapshot;
  }
```

- [ ] **Step 4: 加入匯出**

在檔尾 `window.ProcessMethodUtils = { ... }` 物件中，`formatCaseProcessRecordLabel: formatCaseProcessRecordLabel,` 那一行之後加入：

```javascript
    resolveCaseRecordPoints: resolveCaseRecordPoints,
```

- [ ] **Step 5: 執行測試確認通過**

Run: `node scripts/verify-case-record-points.mjs`
Expected: PASS — `6 passed, 0 failed`

- [ ] **Step 6: Commit**

```bash
git add src/features/permissions/process-method-utils.js scripts/verify-case-record-points.mjs
git commit -m "Add resolveCaseRecordPoints for case process-method points display."
```

---

### Task 2: `app.js` 補傳 `processMethods`

**Files:**
- Modify: `src/app.js`（4 個呼叫點：`record-view`、`review-view`、`store-history-repair-view`、`arrangement`）

**Interfaces:**
- Consumes: 既有的 `s.processMethods` 全域狀態
- Produces: `ViewCaseForm` 與 `CaseArrangement` 兩個元件的 `props.processMethods`（陣列），供 Task 3–5 使用

此任務單獨可驗：只是多傳一個 prop，畫面行為不變，先確保狀態串接正確再改渲染。

- [ ] **Step 1: 修改 `record-view`**

將 `src/app.js` 的：

```javascript
      case 'record-view':
        return h(ViewCaseForm, { viewingCase: s.viewingCase, setView: setView, backView: 'record-list' });
```

改為：

```javascript
      case 'record-view':
        return h(ViewCaseForm, {
          viewingCase: s.viewingCase, setView: setView, backView: 'record-list',
          processMethods: s.processMethods
        });
```

- [ ] **Step 2: 修改 `review-view`**

將：

```javascript
      case 'review-view':
        return h(ViewCaseForm, { viewingCase: s.viewingCase, setView: setView, backView: 'review-list' });
```

改為：

```javascript
      case 'review-view':
        return h(ViewCaseForm, {
          viewingCase: s.viewingCase, setView: setView, backView: 'review-list',
          processMethods: s.processMethods
        });
```

- [ ] **Step 3: 修改 `store-history-repair-view`**

將：

```javascript
      case 'store-history-repair-view':
        return h(ViewCaseForm, {
          viewingCase: StoreUtils.withStoreHistoryContext(s.viewingCase, s.historyStore),
          setView: setView, backView: 'store-history'
        });
```

改為：

```javascript
      case 'store-history-repair-view':
        return h(ViewCaseForm, {
          viewingCase: StoreUtils.withStoreHistoryContext(s.viewingCase, s.historyStore),
          setView: setView, backView: 'store-history',
          processMethods: s.processMethods
        });
```

- [ ] **Step 4: 修改 `arrangement`**

在 `h(CaseArrangement, { ... })` 的 props 中，`assignees: s.assignees,` 那一行之後加入：

```javascript
          processMethods: s.processMethods,
```

- [ ] **Step 5: 驗證語法與畫面未壞**

Run: `node --check src/app.js`
Expected: 無輸出（通過）

接著在瀏覽器開啟 `index.html`，依序進入「叫修紀錄 → 查看明細」、「銷案審核 → 查看明細」、「排程派工 → 展開叫修案件」，確認三個畫面仍正常渲染、Console 無錯誤。

- [ ] **Step 6: Commit**

```bash
git add src/app.js
git commit -m "Pass processMethods to case view and arrangement components."
```

---

### Task 3: 編輯叫修案件表單顯示積分數

**Files:**
- Modify: `src/features/repair/case-form.js`（`EditCaseForm`：選擇列預覽 + 清單表格欄位）

**Interfaces:**
- Consumes: `ProcessMethodUtils.resolveCaseRecordPoints(record, processMethods, isClosed)`（Task 1）；元件內既有的 `processMethods`、`selectedPm`、`formData`
- Produces: 無（畫面層）

`EditCaseForm` 已有 `var processMethods = props.processMethods || [];`（約 `case-form.js:312`）與 `var selectedPm = ...`、`var selectedUnit = selectedPm ? selectedPm.unit : '';`（約 `case-form.js:337-338`），不需新增資料來源。

- [ ] **Step 1: 選擇列加入積分數預覽**

在 `case-form.js` 中找到「規格」下拉之後、`h("div", { className: "flex items-end gap-2" }` 開頭的數量區塊之前，插入一個唯讀顯示區塊。將：

```javascript
      }, specOptions.map(function (c) { return h("option", {
        key: c,
        value: c
      }, c); }))), h("div", {
        className: "flex items-end gap-2"
      }, h("div", {
        className: "w-20"
      }, h("span", {
```

改為：

```javascript
      }, specOptions.map(function (c) { return h("option", {
        key: c,
        value: c
      }, c); }))), h("div", {
        className: "w-20"
      }, h("span", {
        className: "text-xs text-gray-500 block mb-1"
      }, "積分數"), h("div", {
        className: "p-2 text-sm text-gray-700 text-center"
      }, selectedPm && selectedPm.points != null ? String(selectedPm.points) : "—")), h("div", {
        className: "flex items-end gap-2"
      }, h("div", {
        className: "w-20"
      }, h("span", {
```

- [ ] **Step 2: 表格 `thead` 加入「積分數」欄**

將（約 `case-form.js:727-733`）：

```javascript
      }, h("tr", null, pmColumns.map(function (col) { return h("th", {
        key: col.key,
        className: "p-2 pl-4 first:pl-4"
      }, col.label); }), h("th", {
        className: "p-2"
      }, "數量"), h("th", {
```

改為：

```javascript
      }, h("tr", null, pmColumns.map(function (col) { return h("th", {
        key: col.key,
        className: "p-2 pl-4 first:pl-4"
      }, col.label); }), h("th", {
        className: "p-2"
      }, "積分數"), h("th", {
        className: "p-2"
      }, "數量"), h("th", {
```

- [ ] **Step 3: 空清單列 `colspan` +1**

將（約 `case-form.js:737`）：

```javascript
        colspan: String(pmColumns.length + 2),
```

改為：

```javascript
        colspan: String(pmColumns.length + 3),
```

- [ ] **Step 4: 表格 `tbody` 加入積分數儲存格**

將（約 `case-form.js:741-748`）：

```javascript
      }, pmColumns.map(function (col) { return h("td", {
        key: col.key,
        className: "p-2 pl-4 first:pl-4"
      }, r[col.key] || "—"); }), h("td", {
        className: "p-2"
      }, r.qty, r.unit ? h("span", {
        className: "text-gray-500 ml-1"
      }, r.unit) : null), h("td", {
```

改為：

```javascript
      }, pmColumns.map(function (col) { return h("td", {
        key: col.key,
        className: "p-2 pl-4 first:pl-4"
      }, r[col.key] || "—"); }), h("td", {
        className: "p-2"
      }, formatRecordPoints(r)), h("td", {
        className: "p-2"
      }, r.qty, r.unit ? h("span", {
        className: "text-gray-500 ml-1"
      }, r.unit) : null), h("td", {
```

- [ ] **Step 5: 新增 `formatRecordPoints` 區域函式**

在 `EditCaseForm` 的 `stateful(function (rerender) { ... })` 內、其他 handler 函式旁（例如 `handleAddRecord` 之前）加入：

```javascript
      function formatRecordPoints(r) {
        var pts = ProcessMethodUtils.resolveCaseRecordPoints(r, processMethods, formData.isClosed);
        return pts === null ? "—" : String(pts);
      }
```

- [ ] **Step 6: 驗證**

Run: `node --check src/features/repair/case-form.js`
Expected: 無輸出（通過）

瀏覽器開啟 `index.html` → 「案件處理」→ 挑一筆未結案案件按編輯 → 捲到「處理方式清單」：
- 規格下拉右側出現「積分數」唯讀值，切換大／中／小類與規格時數字跟著變
- 表格標頭順序為：大類 / 中類 / 小類 / 規格 / 積分數 / 數量 / 操作
- 按「新增」後，新列的積分數顯示對應數字
- 清空所有處理項目時，「尚未加入處理項目」列橫跨全部 7 欄

- [ ] **Step 7: Commit**

```bash
git add src/features/repair/case-form.js
git commit -m "Show process-method points in repair case edit form."
```

---

### Task 4: 查看案件明細顯示積分數

**Files:**
- Modify: `src/features/repair/case-view.js`（`ViewCaseForm`：讀取 `processMethods` prop + 表格欄位）

**Interfaces:**
- Consumes: `ProcessMethodUtils.resolveCaseRecordPoints()`（Task 1）；`props.processMethods`（Task 2 已補傳）
- Produces: 無（畫面層）

- [ ] **Step 1: 讀取 `processMethods` prop**

在 `case-view.js` 的 `ViewCaseForm` 中，將：

```javascript
    var backView = props.backView === undefined ? 'record-list' : props.backView;
```

之後加入一行：

```javascript
    var processMethods = props.processMethods || [];
```

- [ ] **Step 2: 新增 `formatRecordPoints` 區域函式**

在同一元件內、`formatTimeRange` 函式之後加入：

```javascript
    function formatRecordPoints(r) {
      var isClosed = !!(viewingCase && viewingCase.isClosed);
      var pts = ProcessMethodUtils.resolveCaseRecordPoints(r, processMethods, isClosed);
      return pts === null ? '—' : String(pts);
    }
```

- [ ] **Step 3: 表格 `thead` 加入「積分數」欄**

將（約 `case-view.js:109-112`）：

```javascript
                      pmColumns.map(function (col) {
                        return h('th', { key: col.key, className: 'p-2 pl-4' }, col.label);
                      }),
                      h('th', { className: 'p-2' }, '數量')
```

改為：

```javascript
                      pmColumns.map(function (col) {
                        return h('th', { key: col.key, className: 'p-2 pl-4' }, col.label);
                      }),
                      h('th', { className: 'p-2' }, '積分數'),
                      h('th', { className: 'p-2' }, '數量')
```

- [ ] **Step 4: 空清單列 `colspan` +1**

將（約 `case-view.js:117`）：

```javascript
                      h('td', { colspan: String(pmColumns.length + 1), className: 'p-4 text-center text-gray-400' }, '無處理方式紀錄')
```

改為：

```javascript
                      h('td', { colspan: String(pmColumns.length + 2), className: 'p-4 text-center text-gray-400' }, '無處理方式紀錄')
```

- [ ] **Step 5: 表格 `tbody` 加入積分數儲存格**

將（約 `case-view.js:120-127`）：

```javascript
                        pmColumns.map(function (col) {
                          return h('td', { key: col.key, className: 'p-2 pl-4' }, r[col.key] || '—');
                        }),
                        h('td', { className: 'p-2' },
                          r.qty,
                          r.unit ? h('span', { className: 'text-gray-500 ml-1' }, r.unit) : null
                        )
```

改為：

```javascript
                        pmColumns.map(function (col) {
                          return h('td', { key: col.key, className: 'p-2 pl-4' }, r[col.key] || '—');
                        }),
                        h('td', { className: 'p-2' }, formatRecordPoints(r)),
                        h('td', { className: 'p-2' },
                          r.qty,
                          r.unit ? h('span', { className: 'text-gray-500 ml-1' }, r.unit) : null
                        )
```

- [ ] **Step 6: 驗證**

Run: `node --check src/features/repair/case-view.js`
Expected: 無輸出（通過）

瀏覽器開啟 `index.html`：
- 「叫修紀錄」→ 查看一筆有處理方式的案件明細 → 表格出現「積分數」欄，位於「規格」與「數量」之間
- 「銷案審核」→ 查看明細 → 同樣有積分數欄
- 「門市管理 → 歷史紀錄 → 叫修案件」→ 查看明細 → 同樣有積分數欄
- 無處理方式紀錄的案件，「無處理方式紀錄」列橫跨全部 6 欄

- [ ] **Step 7: Commit**

```bash
git add src/features/repair/case-view.js
git commit -m "Show process-method points in case detail view."
```

---

### Task 5: 排程派工畫面顯示積分數

**Files:**
- Modify: `src/features/scheduling/case-arrangement.js`（`CaseArrangement` props + `renderRepairScheduleDetails` 表格）

**Interfaces:**
- Consumes: `ProcessMethodUtils.resolveCaseRecordPoints()`（Task 1）；`props.processMethods`（Task 2 已補傳）
- Produces: 無（畫面層）

- [ ] **Step 1: 讀取 `processMethods` prop**

在 `case-arrangement.js` 的 `CaseArrangement(props)` 開頭，將：

```javascript
    var assignees = props.assignees || [];
```

之後加入一行：

```javascript
    var processMethods = props.processMethods || [];
```

- [ ] **Step 2: 新增 `formatRecordPoints` 區域函式**

在 `renderRepairScheduleDetails(formData)` 內、`function ReadOnlyField(p) { ... }` 之後加入：

```javascript
        function formatRecordPoints(r) {
          var pts = ProcessMethodUtils.resolveCaseRecordPoints(r, processMethods, formData.isClosed);
          return pts === null ? '—' : String(pts);
        }
```

- [ ] **Step 3: 表格 `thead` 加入「積分數」欄**

將（約 `case-arrangement.js:675-678`）：

```javascript
                            pmColumns.map(function (col) {
                              return h('th', { key: col.key, className: 'p-2 pl-4' }, col.label);
                            }),
                            h('th', { className: 'p-2' }, '數量')
```

改為：

```javascript
                            pmColumns.map(function (col) {
                              return h('th', { key: col.key, className: 'p-2 pl-4' }, col.label);
                            }),
                            h('th', { className: 'p-2' }, '積分數'),
                            h('th', { className: 'p-2' }, '數量')
```

- [ ] **Step 4: 空清單列 `colspan` +1**

將（約 `case-arrangement.js:684`）：

```javascript
                                h('td', { colspan: String(pmColumns.length + 1), className: 'p-4 text-center text-gray-400' }, '無處理方式紀錄')
```

改為：

```javascript
                                h('td', { colspan: String(pmColumns.length + 2), className: 'p-4 text-center text-gray-400' }, '無處理方式紀錄')
```

- [ ] **Step 5: 表格 `tbody` 加入積分數儲存格**

將（約 `case-arrangement.js:688-695`）：

```javascript
                                pmColumns.map(function (col) {
                                  return h('td', { key: col.key, className: 'p-2 pl-4' }, r[col.key] || '—');
                                }),
                                h('td', { className: 'p-2' },
                                  r.qty,
                                  r.unit ? h('span', { className: 'text-gray-500 ml-1' }, r.unit) : null
                                )
```

改為：

```javascript
                                pmColumns.map(function (col) {
                                  return h('td', { key: col.key, className: 'p-2 pl-4' }, r[col.key] || '—');
                                }),
                                h('td', { className: 'p-2' }, formatRecordPoints(r)),
                                h('td', { className: 'p-2' },
                                  r.qty,
                                  r.unit ? h('span', { className: 'text-gray-500 ml-1' }, r.unit) : null
                                )
```

- [ ] **Step 6: 驗證**

Run: `node --check src/features/scheduling/case-arrangement.js`
Expected: 無輸出（通過）

瀏覽器開啟 `index.html` → 「排程派工」→ 展開一筆有處理方式的叫修案件 → 「處理方式清單」表格出現「積分數」欄，位於「規格」與「數量」之間。

- [ ] **Step 7: Commit**

```bash
git add src/features/scheduling/case-arrangement.js
git commit -m "Show process-method points in scheduling arrangement view."
```

---

### Task 6: 端到端驗收（未結案即時、已結案照舊）

**Files:**
- 無程式碼變更；純手動驗收 + 更新 README 檔案結構說明（若需要）

**Interfaces:**
- Consumes: Task 1–5 的全部成果
- Produces: 無

- [ ] **Step 1: 執行單元驗證腳本**

Run: `node scripts/verify-case-record-points.mjs`
Expected: PASS — `6 passed, 0 failed`

- [ ] **Step 2: 執行全部檔案語法檢查**

```bash
node --check src/app.js
node --check src/features/permissions/process-method-utils.js
node --check src/features/repair/case-form.js
node --check src/features/repair/case-view.js
node --check src/features/scheduling/case-arrangement.js
```

Expected: 全部無輸出

- [ ] **Step 3: 驗收「未結案跟著變」**

瀏覽器開啟 `index.html`（注意：資料為記憶體假資料，重整即重置，以下操作請勿中途重整）：

1. 「案件處理」→ 編輯一筆**未結案**且已有處理方式的案件，記下某列的積分數（例如 `5`）
2. 不重整，切到「系統權限 → 處理方式與積分管理」，找到同一筆處理方式，把積分改成 `99`，儲存
3. 回到該案件的編輯畫面 → 該列積分數應顯示 `99`
4. 到「排程派工」展開同一案件 → 積分數同樣顯示 `99`

- [ ] **Step 4: 驗收「已結案照舊」**

1. 承上，到「銷案審核」找一筆**已結案**（`isClosed`）且處理方式含剛改過項目的案件，查看明細
2. 該列積分數應維持**原本的快照值**，不是 `99`

- [ ] **Step 5: 驗收邊界情況**

1. 找一筆積分為 `0` 的處理方式加入案件 → 表格顯示 `0`，不是 `—`
2. 在「處理方式與積分管理」刪除某個已被案件使用的項目 → 該案件仍顯示原快照值，不是 `—`
3. 開啟一筆沒有處理方式的案件明細 → 「無處理方式紀錄」列橫跨整個表格寬度，沒有錯位

- [ ] **Step 6: 更新 README（若檔案結構說明需要）**

檢查 `README.md` 的檔案結構區塊是否列出 `scripts/`。若沒有列出，不需變更；若有列出且需補上新腳本，補一行說明 `verify-case-record-points.mjs　積分解析函式驗證`。

- [ ] **Step 7: Commit**

若 Step 6 有變更：

```bash
git add README.md
git commit -m "Note case record points verification script in README."
```

若無變更則跳過此步。
