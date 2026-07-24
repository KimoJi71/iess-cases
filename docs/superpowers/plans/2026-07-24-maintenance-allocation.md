# 系統權限 — 保養分配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在系統權限下新增「保養分配」：依指派人員顯示客戶 × 月份網格，可編輯／刪除各月分配；並全域將服務等級改為 A／B／C／D 標籤。

**Architecture:** 獨立 `maintenanceAllocations` store + 單頁 `MaintenanceAllocation`（網格＋編輯 Modal）；純邏輯在 `MaintenanceAllocationUtils`。僅透過 sidebar／路由／options／seed 註冊，不改既有帳號／指派人員／設備分類／處理方式 list／form 行為。分配資料不連動保養案件。

**Tech Stack:** Vanilla JS IIFE + `IESS.h` / `stateful` / `useDragScroll`、Tailwind CDN、既有 `app-modal-overlay`、`StoreUtils`。

**驗證方式:** 本專案無自動測試；各 task 以瀏覽器手動驗收。不自動 commit（除非使用者要求）。

## Global Constraints

- 不動既有權限子功能邏輯（帳號／指派人員／設備分類／處理方式）；只做選單註冊與服務等級字串對齊
- 分配為獨立規劃資料，不產生／不修改 `maintenanceCases`
- 資料模型不含 `year`；網格固定月份 1–12
- 驗證僅 toast／提示，不擋存檔
- 客戶帶入：非撤店門市 × 指派人員行政區 × 服務等級 A／B／C

---

## File map

| 檔案 | 職責 |
|------|------|
| `src/features/permissions/maintenance-allocation-utils.js` | 篩選客戶列、門市數、次數選項、格點文字、驗證、upsert／刪除 |
| `src/features/permissions/maintenance-allocation.js` | 頁面 UI：篩選、網格、編輯 Modal、刪除 confirm |
| `src/shell/permissions-sidebar.js` | 追加「保養分配」 |
| `src/app.js` | store、路由、props |
| `index.html` | script 載入 |
| `src/data/options.js` | `SERVICE_LEVEL_OPTIONS`、權限樹、`CUSTOMER_SERVICE_LEVEL_MAP` |
| `src/data/seed.js` | 服務等級字串、`INITIAL_MAINTENANCE_ALLOCATIONS` |
| 表單預設字串檔 | 將硬編碼舊服務等級改為新字串（見 Task 1） |

---

### Task 1: 服務等級全域改名

**Files:**
- Modify: `src/data/options.js`
- Modify: `src/data/seed.js`
- Modify: `src/features/customer/customer-form.js`
- Modify: `src/features/customer/store-repair-form.js`
- Modify: `src/features/customer/store-project-form.js`
- Modify: `src/features/repair/case-form.js`
- Modify: `src/features/project/project-form.js`

**Interfaces:**
- Produces: `SERVICE_LEVEL_OPTIONS` 四個新值；全站 `serviceLevel` 字串與對照表一致

- [x] **Step 1: 更新 `options.js` 常數**

```js
const SERVICE_LEVEL_OPTIONS = [
  'A 保修(一年一次)',
  'B 保修(一年兩次)',
  'C 保養(一年一次)',
  'D 維修(無簽約客戶)'
];

const CUSTOMER_SERVICE_LEVEL_MAP = {
  '屈臣氏': 'A 保修(一年一次)',
  '星巴克': 'B 保修(一年兩次)',
  '萊爾富': 'C 保養(一年一次)',
  '統一超商': 'D 維修(無簽約客戶)',
  '全家便利商店': 'D 維修(無簽約客戶)'
};
```

- [x] **Step 2: 批次替換 seed 與表單預設字串**

在下列檔案做一字不漏的字串替換（先長後短，避免部分匹配問題）：

| 舊 | 新 |
|----|----|
| `保修(一年兩次)` | `B 保修(一年兩次)` |
| `保修(一年一次)` | `A 保修(一年一次)` |
| `保養(一年一次)` | `C 保養(一年一次)` |
| `維修(無簽約客戶)` | `D 維修(無簽約客戶)` |

檔案：`seed.js`、`customer-form.js`、`store-repair-form.js`、`store-project-form.js`、`case-form.js`、`project-form.js`。

確認 `options.js` 的 `SERVICE_LEVEL_OPTIONS`／`CUSTOMER_SERVICE_LEVEL_MAP` 未被重複加前綴（Step 1 已是新值）。

建議指令（於 repo root，確認 diff 後再存）：

```bash
# 先兩次、再一次，避免「保修(一年一次)」誤傷「保修(一年兩次)」殘段
for f in src/data/seed.js \
  src/features/customer/customer-form.js \
  src/features/customer/store-repair-form.js \
  src/features/customer/store-project-form.js \
  src/features/repair/case-form.js \
  src/features/project/project-form.js; do
  perl -i -pe 's/保修\(一年兩次\)/B 保修(一年兩次)/g; s/保修\(一年一次\)/A 保修(一年一次)/g; s/保養\(一年一次\)/C 保養(一年一次)/g; s/維修\(無簽約客戶\)/D 維修(無簽約客戶)/g' "$f"
done
```

- [x] **Step 3: 手動驗收**

開啟 `index.html` → 客戶管理／門市管理下拉應見 `A 保修(一年一次)` 等；既有列表欄位顯示新字串。  
確認無殘留舊字串：

```bash
rg -n 'serviceLevel: .*(保修|保養|維修)\(' src/data src/features --glob '*.js' | rg -v 'A |B |C |D '
```

Expected: 無輸出（或僅註解）。

---

### Task 2: MaintenanceAllocationUtils

**Files:**
- Create: `src/features/permissions/maintenance-allocation-utils.js`

**Interfaces:**
- Consumes: `StoreUtils.getStoreArea`、`StoreUtils.assigneeCoversArea`、`StoreUtils.isActiveStore`；`SERVICE_LEVEL_OPTIONS` 新值
- Produces: `window.MaintenanceAllocationUtils`（下列函式）

- [x] **Step 1: 建立 utils IIFE**

完整實作如下（可微調實作細節，但匯出名稱與行為必須一致）：

```js
/*
 * features/permissions/maintenance-allocation-utils.js — 保養分配：客戶列、驗證、CRUD 輔助
 */
(function () {
  'use strict';

  var ALLOCATABLE_SERVICE_LEVELS = [
    'A 保修(一年一次)',
    'B 保修(一年兩次)',
    'C 保養(一年一次)'
  ];

  function isAllocatableServiceLevel(level) {
    return ALLOCATABLE_SERVICE_LEVELS.indexOf(level) !== -1;
  }

  function getVisitIndexOptions(maintenanceInterval) {
    if (maintenanceInterval === '每季') return [1, 2, 3, 4];
    if (maintenanceInterval === '每半年') return [1, 2];
    return [1]; // 每年或其他
  }

  function formatCellLabel(allocation) {
    if (!allocation) return '';
    return '第' + allocation.visitIndex + '次 ' + allocation.targetCount;
  }

  function getCoveredStoresForAssignee(stores, assignee, customerName) {
    return (stores || []).filter(function (s) {
      if (customerName && s.customerName !== customerName) return false;
      if (!StoreUtils.isActiveStore(s)) return false;
      if (!isAllocatableServiceLevel(s.serviceLevel)) return false;
      var area = StoreUtils.getStoreArea(s);
      return StoreUtils.assigneeCoversArea(assignee, area);
    });
  }

  /**
   * @returns {Array<{ customerName, storeCount, maintenanceInterval }>}
   */
  function getCustomerRows(assignee, customers, stores) {
    if (!assignee) return [];
    var byCustomer = {};
    getCoveredStoresForAssignee(stores, assignee, null).forEach(function (s) {
      if (!byCustomer[s.customerName]) byCustomer[s.customerName] = 0;
      byCustomer[s.customerName] += 1;
    });
    var rows = [];
    Object.keys(byCustomer).forEach(function (name) {
      var cust = (customers || []).find(function (c) { return c.name === name; });
      rows.push({
        customerName: name,
        storeCount: byCustomer[name],
        maintenanceInterval: (cust && cust.maintenanceInterval) || '每年'
      });
    });
    rows.sort(function (a, b) {
      return a.customerName.localeCompare(b.customerName, 'zh-Hant');
    });
    return rows;
  }

  function findAllocation(allocations, assigneeId, customerName, month) {
    return (allocations || []).find(function (a) {
      return a.assigneeId === assigneeId &&
        a.customerName === customerName &&
        Number(a.month) === Number(month);
    }) || null;
  }

  function sumVisitIndexTotal(allocations, assigneeId, customerName, visitIndex, excludeMonth) {
    var sum = 0;
    (allocations || []).forEach(function (a) {
      if (a.assigneeId !== assigneeId) return;
      if (a.customerName !== customerName) return;
      if (Number(a.visitIndex) !== Number(visitIndex)) return;
      if (excludeMonth != null && Number(a.month) === Number(excludeMonth)) return;
      sum += Number(a.targetCount) || 0;
    });
    return sum;
  }

  /**
   * @returns {string[]} 警示／提示文案（可為空）
   */
  function buildSaveWarnings(params) {
    var storeCount = Number(params.storeCount) || 0;
    var targetCount = Number(params.targetCount) || 0;
    var visitIndex = Number(params.visitIndex);
    var month = Number(params.month);
    var warnings = [];

    if (targetCount > storeCount) {
      warnings.push('本月數量超過負責門市數（' + targetCount + '／' + storeCount + '）');
    }

    var otherSum = sumVisitIndexTotal(
      params.allocations, params.assigneeId, params.customerName, visitIndex, month
    );
    var total = otherSum + targetCount;
    if (total !== storeCount) {
      var kind = total < storeCount ? '不足' : '超量';
      warnings.push(
        '第' + visitIndex + '次合計與負責門市數不符（目前 ' + total + '／應為 ' + storeCount + '，' + kind + '）'
      );
    }
    return warnings;
  }

  function upsertAllocation(allocations, record) {
    var list = (allocations || []).slice();
    var idx = list.findIndex(function (a) {
      return a.assigneeId === record.assigneeId &&
        a.customerName === record.customerName &&
        Number(a.month) === Number(record.month);
    });
    if (idx >= 0) {
      list[idx] = Object.assign({}, list[idx], {
        visitIndex: Number(record.visitIndex),
        targetCount: Number(record.targetCount)
      });
    } else {
      list.push({
        id: record.id || ('MA' + Date.now()),
        assigneeId: record.assigneeId,
        customerName: record.customerName,
        month: Number(record.month),
        visitIndex: Number(record.visitIndex),
        targetCount: Number(record.targetCount)
      });
    }
    return list;
  }

  function removeAllocation(allocations, assigneeId, customerName, month) {
    return (allocations || []).filter(function (a) {
      return !(a.assigneeId === assigneeId &&
        a.customerName === customerName &&
        Number(a.month) === Number(month));
    });
  }

  window.MaintenanceAllocationUtils = {
    ALLOCATABLE_SERVICE_LEVELS: ALLOCATABLE_SERVICE_LEVELS,
    isAllocatableServiceLevel: isAllocatableServiceLevel,
    getVisitIndexOptions: getVisitIndexOptions,
    formatCellLabel: formatCellLabel,
    getCoveredStoresForAssignee: getCoveredStoresForAssignee,
    getCustomerRows: getCustomerRows,
    findAllocation: findAllocation,
    sumVisitIndexTotal: sumVisitIndexTotal,
    buildSaveWarnings: buildSaveWarnings,
    upsertAllocation: upsertAllocation,
    removeAllocation: removeAllocation
  };
})();
```

- [x] **Step 2: 在 `index.html` 先掛上 utils script**（頁面檔尚未建時也可先掛）

放在其他 permissions utils 之後、list／form 之前，例如：

```html
<script src="src/features/permissions/maintenance-allocation-utils.js"></script>
```

（緊接在 `assignee-utils.js` 之後。）

- [x] **Step 3: 瀏覽器 Console 煙霧測試**

開啟頁面後於 Console：

```js
MaintenanceAllocationUtils.getVisitIndexOptions('每季'); // [1,2,3,4]
MaintenanceAllocationUtils.formatCellLabel({ visitIndex: 1, targetCount: 5 }); // "第1次 5"
MaintenanceAllocationUtils.buildSaveWarnings({
  storeCount: 5, targetCount: 2, visitIndex: 1, month: 3,
  assigneeId: 'ASG1', customerName: 'X', allocations: []
}); // 應含「不符」提示；不應 throw
```

---

### Task 3: 選單、Store、路由、Seed

**Files:**
- Modify: `src/shell/permissions-sidebar.js`
- Modify: `src/app.js`
- Modify: `src/data/seed.js`
- Modify: `index.html`（若 Task 2 未加頁面 script，此 task 補上）

**Interfaces:**
- Consumes: `MaintenanceAllocation`（Task 4 會建立；此 task 先接路由，頁面可暫用 placeholder 或等 Task 4）
- Produces: `maintenanceAllocations` / `setMaintenanceAllocations`；submenu `保養分配` → view `maintenance-allocation`

- [x] **Step 1: Sidebar**

`MENU_ITEMS` 追加 `'保養分配'`（建議放在「處理方式與積分管理」之後）。

- [x] **Step 2: `options.js` 權限樹**

`PERMISSION_FUNCTIONS` 與 `PERMISSION_TREE`「系統權限」`children` 皆加入 `'保養分配'`。  
（`_buildAllPermissions` 會自動涵蓋 admin。）

- [x] **Step 3: Seed 示範分配（可少量）**

在 `seed.js` 新增（assignee／客戶需與現有 seed 對得上；若對不上可先 `[]`）：

```js
const INITIAL_MAINTENANCE_ALLOCATIONS = [
  // 範例：僅在確認 ASG1 對該客戶有 A/B/C 門市時保留
  // { id: 'MA1', assigneeId: 'ASG1', customerName: '屈臣氏', month: 3, visitIndex: 1, targetCount: 1 }
];
```

若暫時沒有把握對應關係，使用空陣列即可。

- [x] **Step 4: `app.js`**

1. `PERMISSIONS_SUBMENU_DEFAULT_VIEW` 加：`'保養分配': 'maintenance-allocation'`
2. store initial state 加：`maintenanceAllocations: INITIAL_MAINTENANCE_ALLOCATIONS`
3. 透過既有 `makeSetter` 產生 `setMaintenanceAllocations`（或與其他 setter 同模式宣告）
4. `renderPermissionsView` 加 case：

```js
case 'maintenance-allocation':
  return h(MaintenanceAllocation, {
    assignees: s.assignees,
    customers: s.customers,
    stores: s.stores,
    maintenanceAllocations: s.maintenanceAllocations,
    setMaintenanceAllocations: setMaintenanceAllocations,
    showToast: showToast
  });
```

- [x] **Step 5: 手動驗收（路由）**

進入系統權限 → 點「保養分配」。若 Task 4 尚未完成，可能 ReferenceError；完成 Task 4 後應正常進入頁面。帳號管理 → 權限設定樹應可見「保養分配」。

---

### Task 4: MaintenanceAllocation 頁面（網格＋Modal＋刪除）

**Files:**
- Create: `src/features/permissions/maintenance-allocation.js`
- Modify: `index.html` — 在 utils 之後加入：

```html
<script src="src/features/permissions/maintenance-allocation.js"></script>
```

**Interfaces:**
- Consumes: `MaintenanceAllocationUtils.*`；props 見 Task 3
- Produces: `window.MaintenanceAllocation`

- [ ] **Step 1: 實作頁面骨架與篩選**

模式對齊 `assignee-list.js`：`stateful(rerender)`、本地 state。

本地 state：

```js
var selectedAssigneeId = '';
var editModal = null; // { customerName, month, visitIndex, targetCount, storeCount, maintenanceInterval } | null
var deleteModal = null; // { customerName, month, label } | null
var dragProps = useDragScroll();
```

頂部：指派人員 `<select>`（options 來自 `assignees`，value=`id`，顯示 `name`）。

- 未選：顯示「請先選擇指派人員」
- 已選：`var assignee = assignees.find(...)`；`rows = MaintenanceAllocationUtils.getCustomerRows(assignee, customers, stores)`

- [ ] **Step 2: 實作網格**

表格：

- 固定欄：`客戶名稱`、`負責門市數`、`保養區間`
- 月份欄：`1`…`12`（表頭可顯示 `1月`…`12月`）

每個月份儲存格：

```js
var cell = MaintenanceAllocationUtils.findAllocation(
  maintenanceAllocations, selectedAssigneeId, row.customerName, month
);
var label = MaintenanceAllocationUtils.formatCellLabel(cell);
```

- 點擊儲存格（空白或有資料）→ 開啟 `editModal`（有資料則帶入 `visitIndex`／`targetCount`；無則預設 `visitIndex` 為選項第一個、`targetCount` 為 `''` 或 `0`）
- 若有資料：格內另放刪除按鈕（`stopPropagation`），開啟 `deleteModal`

空列：`rows.length === 0` 時顯示「尚無符合條件的客戶」。

- [ ] **Step 3: 編輯 Modal**

使用 `app-modal-overlay`：

- 月份：唯讀文字（`editModal.month + '月'`）
- 保養次數：`<select>`，options = `getVisitIndexOptions(editModal.maintenanceInterval)`，顯示「第N次」
- 目標完成數：`type="number"` min 0
- ［取消］清 `editModal`
- ［儲存］：

```js
var visitIndex = Number(editModal.visitIndex);
var targetCount = Number(editModal.targetCount);
var warnings = MaintenanceAllocationUtils.buildSaveWarnings({
  allocations: maintenanceAllocations,
  assigneeId: selectedAssigneeId,
  customerName: editModal.customerName,
  month: editModal.month,
  visitIndex: visitIndex,
  targetCount: targetCount,
  storeCount: editModal.storeCount
});
warnings.forEach(function (msg) { showToast(msg, 'error'); }); // 或依專案慣用 type；仍繼續存
setMaintenanceAllocations(MaintenanceAllocationUtils.upsertAllocation(maintenanceAllocations, {
  assigneeId: selectedAssigneeId,
  customerName: editModal.customerName,
  month: editModal.month,
  visitIndex: visitIndex,
  targetCount: targetCount
}));
editModal = null;
rerender();
showToast('保養分配已儲存');
```

注意：若多則 warning + success toast，依現有 `showToast` 行為（可能只留最後一則）可接受；至少保證**有警示時使用者能看到一則不符提示**，且資料已寫入。若 toast 會互蓋，改為將 warnings 合併成一則字串再 toast，success 可省略或併入。

- [ ] **Step 4: 刪除 confirm Modal**

對齊設備分類刪除 modal 結構；確認後：

```js
setMaintenanceAllocations(MaintenanceAllocationUtils.removeAllocation(
  maintenanceAllocations, selectedAssigneeId, deleteModal.customerName, deleteModal.month
));
showToast('保養分配已刪除');
```

- [ ] **Step 5: 手動驗收（本頁）**

1. 選「A組」等有行政區的指派人員 → 出現客戶列（僅 A／B／C 門市）
2. 點空白月格 → 填次數與數量 → 儲存 → 格顯示「第N次 X」；若合計不符有提示但仍存成
3. 再點同格可編輯；刪除後變空白
4. 切換指派人員，資料依 `assigneeId` 隔離

---

### Task 5: 端對端驗收（對照規格成功標準）

**Files:** 無新增（僅驗證）

- [ ] **Step 1: 對照規格 §11**

| # | 檢查項 | 預期 |
|---|--------|------|
| 1 | 系統權限 → 保養分配 | 可進入 |
| 2 | 選指派人員 | 客戶 × 1–12 月網格 |
| 3 | 編輯／刪除 | 可存、可清空；驗證不擋存 |
| 4 | 客戶列規則 | 行政區 + 非撤店 + A／B／C；門市數正確 |
| 5 | 服務等級 | 全站下拉／列表為 A／B／C／D |
| 6 | 回歸 | 帳號管理、指派人員管理列表／新增／編輯仍可用 |
| 7 | 保養計劃進度 | 不受分配操作影響（案件數不因存分配而變） |

- [ ] **Step 2: 確認未誤改既有功能檔的行為邏輯**

`git diff` 檢視：除服務等級字串替換外，`account-*.js`／`assignee-*.js`／`device-category-*.js`／`process-method-*.js` 應無邏輯變更。

---

## Spec coverage checklist

| 規格章節 | Task |
|----------|------|
| §2 單頁 + Modal | Task 4 |
| §3 選單／路由／權限樹 | Task 3 |
| §4 資料模型（無 year） | Task 2–3 |
| §5 服務等級改名 | Task 1 |
| §6 客戶帶入／門市數 | Task 2, 4 |
| §7 畫面操作 | Task 4 |
| §8 驗證不擋存 | Task 2, 4 |
| §9 刻意不做 | Task 5 回歸 |
| §11 成功標準 | Task 5 |
