# 保養分配年度快照 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保養分配改為每年一份分配表，切換年份可查看歷年結果；歷史年度的表格骨架凍結成快照，不受日後主檔異動影響。

**Architecture:** 目前分配表的骨架（客戶列、負責門市數、服務等級、保養區間）每次進頁面都用現行主檔即時重算，只有格子是存下來的。本次新增 `maintenanceAllocationYears` 年度快照，把骨架在「建立年度分配表」時凍結；分配格子加上 `year` 欄位。畫面完全改讀快照，客戶身上的 `periods` 退居「現行設定」，只在建立年度或按下「重新同步本年度」時被讀取。實作順序為「先讓舊路徑帶 year → 再加快照層 → 才把畫面切過去」，中途每一步都能開 `index.html` 正常操作。

**Tech Stack:** 原生 HTML / CSS / JavaScript（無 React、無建置步驟）。IIFE 模組掛在 `window`，由 `index.html` 依序 `<script>` 載入。驗證腳本為 Node ESM，用 `node:vm` 跑純函式、用 headless Chrome + CDP 跑 UI。

## Global Constraints

- 全部 ES5 語法：`var`、`function`，不用 `let`／`const`／箭頭函式／樣板字串。現有 `src/` 檔案皆如此，新程式碼必須一致。
- 每個模組都是 IIFE 加 `'use strict';`，最後 `window.XXX = {...}` 匯出。不使用 `import`／`export`。
- **不新增任何檔案到 `src/`。** 本次全部改動落在既有檔案。
- 中文文案一律繁體中文。`showToast(msg, type)` 只支援 `'success'`（預設）與 `'error'` 兩型。
- 年份一律以 `Number()` 比對，不用字串比對。
- 區間物件形狀固定為 `{ visitIndex: <number>, startMonth: <number>, endMonth: <number> }`。快照裡的區間一律已轉為數字（`CustomerUtils.getPeriods` 已濾除半填的區間）。
- 快照的 `periods` 必須是深拷貝，不得與客戶記錄共用參考。
- `buildYearSnapshot`／`resyncYear` 的日期由呼叫端以 `YYYY-MM-DD` 字串傳入，utils 不自行取現在時間（便於驗證腳本斷言）。
- 驗證腳本執行：`node scripts/<name>.mjs`。需要 Chrome，路徑預設 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`，可用 `CHROME_PATH` 覆寫。本腳本的 `CDP_PORT` 預設用 `9347`，`--user-data-dir` 用 `/tmp/iess-allocation-years-profile`，避免與其他腳本衝突。
- Commit 訊息格式：`feat:` / `refactor:` / `test:` / `docs:` 前綴加簡短中文描述。

## File Structure

| 檔案 | 本次責任 |
|---|---|
| `src/features/permissions/maintenance-allocation-utils.js` | CRUD 五函式加 `year`；新增快照建立／查詢／分段／diff／同步／孤兒判定共 12 支函式 |
| `src/data/seed.js` | 分配格子加 `year`；檔尾計算產生 `INITIAL_MAINTENANCE_ALLOCATION_YEARS` |
| `src/app.js` | store 加 `maintenanceAllocationYears` 與 setter；`maintenance-allocation` view 補 props |
| `src/features/permissions/maintenance-allocation.js` | 年份選擇、建立年度 Modal、網格改讀快照、孤兒格子、變動提示條與重新同步 |
| `src/features/reports/performance-utils.js` | `sumAllocationTargets` 加年份過濾，兩處呼叫端由 `quarter` 推年份 |
| `scripts/verify-maintenance-allocation-years.mjs` | **新建**本功能驗證腳本 |

各 Task 逐段擴充同一支驗證腳本，Section 編號與 Task 編號對應。

---

### Task 1: 分配格子加上 year

把 `year` 打進資料與 CRUD，但畫面行為完全不變（暫時固定用當年）。這一步結束時 app 應與改動前逐格一致。

**Files:**
- Modify: `src/features/permissions/maintenance-allocation-utils.js:80-146`（`findAllocation`／`sumVisitIndexTotal`／`buildSaveWarnings`／`upsertAllocation`／`removeAllocation`）
- Modify: `src/data/seed.js:2060-2074`
- Modify: `src/features/permissions/maintenance-allocation.js`（呼叫點：64-69、112-128、143-148、173-178）
- Test: `scripts/verify-maintenance-allocation-years.mjs`（新建）

**Interfaces:**
- Consumes: 無
- Produces:
  - `MaintenanceAllocationUtils.findAllocation(allocations, year, assigneeId, customerName, month)` → 分配物件或 `null`
  - `MaintenanceAllocationUtils.sumVisitIndexTotal(allocations, year, assigneeId, customerName, visitIndex, excludeMonth)` → `number`
  - `MaintenanceAllocationUtils.removeAllocation(allocations, year, assigneeId, customerName, month)` → 新陣列
  - `MaintenanceAllocationUtils.upsertAllocation(allocations, record)`，`record` 為 `{ year, assigneeId, customerName, month, visitIndex, targetCount, id? }` → 新陣列
  - `MaintenanceAllocationUtils.buildSaveWarnings(params)`，`params` 為 `{ allocations, year, assigneeId, customerName, month, visitIndex, targetCount, storeCount }` → `Array<string>`
  - `INITIAL_MAINTENANCE_ALLOCATIONS` 每筆含 `year: SEED_YEAR`（數字）

- [ ] **Step 1: 建立驗證腳本骨架與 Section 1 失敗測試**

Create `scripts/verify-maintenance-allocation-years.mjs`：

```js
#!/usr/bin/env node
/**
 * 「保養分配年度快照」驗證腳本。
 * Section 1-3 以 node:vm 載入 IIFE 模組做純函式驗證；
 * Section 4 以後為 headless Chrome + CDP 的 UI 驗證。
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0, failed = 0;
const pass = (n, d) => { passed++; console.log(`  ✓ ${n}${d ? ` — ${d}` : ''}`); };
const fail = (n, d) => { failed++; console.error(`  ✗ ${n}${d ? ` — ${d}` : ''}`); };
function assertEq(actual, expected, name) {
  if (actual === expected) pass(name, JSON.stringify(actual));
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertDeep(actual, expected, name) {
  assertEq(JSON.stringify(actual), JSON.stringify(expected), name);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

const sandbox = { console, SERVICE_LEVEL_OPTIONS: [] };
sandbox.window = sandbox;
vm.createContext(sandbox);
function load(relPath) {
  vm.runInContext(readFileSync(join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath.split('/').pop()
  });
}
load('src/features/permissions/service-level-utils.js');
load('src/features/permissions/assignee-utils.js');
load('src/features/customer/customer-utils.js');
load('src/features/customer/store-utils.js');
load('src/features/permissions/maintenance-allocation-utils.js');
const MAU = sandbox.MaintenanceAllocationUtils;

// 同一 assignee + customer + month，只差年份的兩筆格子
const ALLOCS = [
  { id: 'MA1', year: 2025, assigneeId: 'ASG1', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 5 },
  { id: 'MA2', year: 2026, assigneeId: 'ASG1', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 2 },
  { id: 'MA3', year: 2026, assigneeId: 'ASG1', customerName: '甲客戶', month: 5, visitIndex: 1, targetCount: 4 },
  { id: 'MA4', year: 2026, assigneeId: 'ASG2', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 9 }
];

console.log('Section 1｜分配格子的年份隔離');
assertEq(MAU.findAllocation(ALLOCS, 2025, 'ASG1', '甲客戶', 3).targetCount, 5,
  'findAllocation 取 2025 年那筆');
assertEq(MAU.findAllocation(ALLOCS, 2026, 'ASG1', '甲客戶', 3).targetCount, 2,
  'findAllocation 取 2026 年那筆');
assertEq(MAU.findAllocation(ALLOCS, 2027, 'ASG1', '甲客戶', 3), null,
  '查無年度回 null');
assertEq(MAU.findAllocation(ALLOCS, '2026', 'ASG1', '甲客戶', 3).targetCount, 2,
  '年份以數字比對，字串同樣查得到');

assertEq(MAU.sumVisitIndexTotal(ALLOCS, 2026, 'ASG1', '甲客戶', 1, null), 6,
  'sumVisitIndexTotal 只加總 2026 年（2 + 4）');
assertEq(MAU.sumVisitIndexTotal(ALLOCS, 2026, 'ASG1', '甲客戶', 1, 5), 2,
  'excludeMonth 排除 5 月後只剩 2');
assertEq(MAU.sumVisitIndexTotal(ALLOCS, 2025, 'ASG1', '甲客戶', 1, null), 5,
  '2025 年獨立加總');

assertEq(MAU.removeAllocation(ALLOCS, 2026, 'ASG1', '甲客戶', 3).length, 3,
  'removeAllocation 只移除指定年度那筆');
assertTrue(MAU.removeAllocation(ALLOCS, 2026, 'ASG1', '甲客戶', 3)
  .some(function (a) { return a.id === 'MA1'; }),
  'removeAllocation 不影響同鍵的 2025 年那筆');

assertEq(MAU.upsertAllocation(ALLOCS, {
  year: 2027, assigneeId: 'ASG1', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 7
}).length, 5, 'upsert 新年度為新增一筆');
assertEq(MAU.upsertAllocation(ALLOCS, {
  year: 2026, assigneeId: 'ASG1', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 7
}).length, 4, 'upsert 既有年度為就地更新');
assertEq(MAU.upsertAllocation(ALLOCS, {
  year: 2026, assigneeId: 'ASG1', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 7
}).find(function (a) { return a.id === 'MA2'; }).targetCount, 7,
  'upsert 更新到正確的那一筆');
assertEq(MAU.upsertAllocation(ALLOCS, {
  year: 2027, assigneeId: 'ASG1', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 7
}).find(function (a) { return Number(a.year) === 2027; }).year, 2027,
  'upsert 新增的那筆帶有 year');

assertDeep(MAU.buildSaveWarnings({
  allocations: ALLOCS, year: 2026, assigneeId: 'ASG1', customerName: '甲客戶',
  month: 3, visitIndex: 1, targetCount: 4, storeCount: 8
}), [], '2026 年第 1 次合計 4 + 4 = 8，等於門市數，無警示');
assertEq(MAU.buildSaveWarnings({
  allocations: ALLOCS, year: 2025, assigneeId: 'ASG1', customerName: '甲客戶',
  month: 3, visitIndex: 1, targetCount: 4, storeCount: 8
}).length, 1, '2025 年不會把 2026 年的格子算進合計，故出現不足警示');

console.log(`\n通過 ${passed}｜失敗 ${failed}`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: 執行驗證腳本，確認失敗**

Run: `node scripts/verify-maintenance-allocation-years.mjs`
Expected: FAIL — `findAllocation` 目前簽章沒有 `year`，`MAU.findAllocation(ALLOCS, 2025, 'ASG1', ...)` 會把 `2025` 當成 `assigneeId`，多數斷言回 `null` 而失敗。

- [ ] **Step 3: 改寫 `maintenance-allocation-utils.js` 的五支 CRUD 函式**

把 `src/features/permissions/maintenance-allocation-utils.js` 中對應的五個函式整段換成：

```js
  function findAllocation(allocations, year, assigneeId, customerName, month) {
    return (allocations || []).find(function (a) {
      return Number(a.year) === Number(year) &&
        a.assigneeId === assigneeId &&
        a.customerName === customerName &&
        Number(a.month) === Number(month);
    }) || null;
  }

  function sumVisitIndexTotal(allocations, year, assigneeId, customerName, visitIndex, excludeMonth) {
    var sum = 0;
    (allocations || []).forEach(function (a) {
      if (Number(a.year) !== Number(year)) return;
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
      params.allocations, params.year, params.assigneeId, params.customerName, visitIndex, month
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
      return Number(a.year) === Number(record.year) &&
        a.assigneeId === record.assigneeId &&
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
        year: Number(record.year),
        assigneeId: record.assigneeId,
        customerName: record.customerName,
        month: Number(record.month),
        visitIndex: Number(record.visitIndex),
        targetCount: Number(record.targetCount)
      });
    }
    return list;
  }

  function removeAllocation(allocations, year, assigneeId, customerName, month) {
    return (allocations || []).filter(function (a) {
      return !(Number(a.year) === Number(year) &&
        a.assigneeId === assigneeId &&
        a.customerName === customerName &&
        Number(a.month) === Number(month));
    });
  }
```

- [ ] **Step 4: seed 的分配格子補上 year**

在 `src/data/seed.js` 的 `INITIAL_MAINTENANCE_ALLOCATIONS` 之前加入年份常數，並替 13 筆補上 `year`：

```js
const SEED_YEAR = new Date().getFullYear();

const INITIAL_MAINTENANCE_ALLOCATIONS = [
  { id: 'MA1', year: SEED_YEAR, assigneeId: 'ASG1', customerName: '屈臣氏', month: 7, visitIndex: 1, targetCount: 3 },
  { id: 'MA2', year: SEED_YEAR, assigneeId: 'ASG1', customerName: '星巴克', month: 7, visitIndex: 1, targetCount: 2 },
  { id: 'MA3', year: SEED_YEAR, assigneeId: 'ASG1', customerName: '屈臣氏', month: 8, visitIndex: 1, targetCount: 1 },
  { id: 'MA4', year: SEED_YEAR, assigneeId: 'ASG2', customerName: '星巴克', month: 7, visitIndex: 1, targetCount: 2 },
  { id: 'MA5', year: SEED_YEAR, assigneeId: 'ASG2', customerName: '屈臣氏', month: 7, visitIndex: 1, targetCount: 2 },
  { id: 'MA6', year: SEED_YEAR, assigneeId: 'ASG2', customerName: '星巴克', month: 8, visitIndex: 1, targetCount: 1 },
  { id: 'MA7', year: SEED_YEAR, assigneeId: 'ASG3', customerName: '萊爾富', month: 7, visitIndex: 1, targetCount: 2 },
  { id: 'MA8', year: SEED_YEAR, assigneeId: 'ASG4', customerName: '屈臣氏', month: 7, visitIndex: 1, targetCount: 2 },
  { id: 'MA9', year: SEED_YEAR, assigneeId: 'ASG5', customerName: '星巴克', month: 7, visitIndex: 1, targetCount: 2 },
  { id: 'MA10', year: SEED_YEAR, assigneeId: 'ASG5', customerName: '萊爾富', month: 8, visitIndex: 1, targetCount: 1 },
  { id: 'MA11', year: SEED_YEAR, assigneeId: 'ASG6', customerName: '萊爾富', month: 7, visitIndex: 1, targetCount: 2 },
  { id: 'MA12', year: SEED_YEAR, assigneeId: 'ASG6', customerName: '屈臣氏', month: 7, visitIndex: 1, targetCount: 1 },
  { id: 'MA13', year: SEED_YEAR, assigneeId: 'ASG6', customerName: '星巴克', month: 9, visitIndex: 1, targetCount: 1 }
];
```

- [ ] **Step 5: 元件呼叫點暫時傳當年**

在 `src/features/permissions/maintenance-allocation.js` 中，`CURRENT_YEAR` 常數（第 11 行）保留，把四處呼叫改為傳入它：

- `openEditModal` 內的 `findAllocation(maintenanceAllocations, selectedAssigneeId, ...)` → `findAllocation(maintenanceAllocations, CURRENT_YEAR, selectedAssigneeId, ...)`
- `handleSave` 內 `buildSaveWarnings({...})` 的物件加一行 `year: CURRENT_YEAR,`（放在 `allocations` 之後）
- `handleSave` 內 `upsertAllocation(maintenanceAllocations, {...})` 的物件加一行 `year: CURRENT_YEAR,`（放在最前）
- `handleDelete` 內的 `removeAllocation(maintenanceAllocations, selectedAssigneeId, deleteModal.customerName, deleteModal.month)` → `removeAllocation(maintenanceAllocations, CURRENT_YEAR, selectedAssigneeId, deleteModal.customerName, deleteModal.month)`
- `renderMonthCell` 內的 `findAllocation(maintenanceAllocations, selectedAssigneeId, ...)` → 同樣補 `CURRENT_YEAR`

- [ ] **Step 6: 執行驗證腳本，確認通過**

Run: `node scripts/verify-maintenance-allocation-years.mjs`
Expected: PASS，`失敗 0`

- [ ] **Step 7: 手動確認 app 行為不變**

開 `index.html` → 系統權限 → 保養分配 → 選 A組。畫面應與改動前一致：屈臣氏 7 月顯示「第1次 3」、8 月「第1次 1」，星巴克 7 月「第1次 2」。點格可編輯、可刪除。Console 無錯誤。

- [ ] **Step 8: Commit**

```bash
git add src/features/permissions/maintenance-allocation-utils.js src/data/seed.js src/features/permissions/maintenance-allocation.js scripts/verify-maintenance-allocation-years.mjs
git commit -m "refactor: 保養分配格子加上年份欄位"
```

---

### Task 2: 年度快照的建立與讀取

新增快照層並接上 store，但畫面還沒改用（本 Task 結束時 app 行為仍不變）。

**Files:**
- Modify: `src/features/permissions/maintenance-allocation-utils.js`（新增函式與 export）
- Modify: `src/data/seed.js`（檔尾新增快照計算）
- Modify: `src/app.js:102`（state）、`src/app.js:181`（setter）、`src/app.js:760-770`（props）
- Test: `scripts/verify-maintenance-allocation-years.mjs`（Section 2）

**Interfaces:**
- Consumes: Task 1 的 `MaintenanceAllocationUtils.*`；既有的 `getCustomerRows(assignee, customers, stores, serviceLevels)`、`CustomerUtils.getPeriods(customers, customerName)`
- Produces:
  - `MaintenanceAllocationUtils.buildYearSnapshot(year, assignees, customers, stores, serviceLevels, today)` → `{ year:number, createdAt:string, syncedAt:'', rows:Array<Row> }`，`Row` 為 `{ assigneeId:string, customerName:string, serviceLevel:string, storeCount:number, periods:Array<{visitIndex:number,startMonth:number,endMonth:number}> }`
  - `MaintenanceAllocationUtils.findYearSnapshot(years, year)` → 快照物件或 `null`
  - `MaintenanceAllocationUtils.listYears(years)` → `Array<number>`，由大到小
  - `MaintenanceAllocationUtils.getSnapshotRows(snapshot, assigneeId)` → `Array<Row>`，依 `customerName` 以 `zh-Hant` 排序
  - `MaintenanceAllocationUtils.buildSegmentMap(row)` → `{ [month:number]: { period, order:number } }`
  - `MaintenanceAllocationUtils.findPeriodInRow(row, month)` → 區間物件或 `null`
  - `INITIAL_MAINTENANCE_ALLOCATION_YEARS` → 含一筆 `SEED_YEAR` 快照的陣列
  - app store 的 `maintenanceAllocationYears` 與 `setMaintenanceAllocationYears`

- [ ] **Step 1: 在驗證腳本加入 Section 2 失敗測試**

在 `scripts/verify-maintenance-allocation-years.mjs` 的 `console.log(\`\n通過 ...\`)` 之前插入：

```js
const SERVICE_LEVELS = [
  { id: 'SL001', name: 'A 保修(一年四次)', maintenanceCount: 4, countsBonusPoints: false },
  { id: 'SL002', name: 'B 保修(一年兩次)', maintenanceCount: 2, countsBonusPoints: false },
  { id: 'SL004', name: 'D 維修(無簽約客戶)', maintenanceCount: 0, countsBonusPoints: true }
];
const SNAP_CUSTOMERS = [
  { id: 'C1', name: '甲客戶', serviceLevel: 'A 保修(一年四次)', periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 3 },
    { visitIndex: 2, startMonth: 4, endMonth: 6 },
    { visitIndex: 3, startMonth: 7, endMonth: 9 },
    { visitIndex: 4, startMonth: 10, endMonth: 12 }
  ] },
  { id: 'C2', name: '乙客戶', serviceLevel: 'B 保修(一年兩次)', periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 6 },
    { visitIndex: 2, startMonth: 7, endMonth: 12 }
  ] },
  { id: 'C3', name: '丙客戶', serviceLevel: 'D 維修(無簽約客戶)', periods: [] }
];
const SNAP_STORES = [
  { id: 'S1', customerName: '甲客戶', name: '甲一店', district: '台北市信義區', serviceLevel: 'A 保修(一年四次)' },
  { id: 'S2', customerName: '甲客戶', name: '甲二店', district: '台北市信義區', serviceLevel: 'A 保修(一年四次)' },
  { id: 'S3', customerName: '乙客戶', name: '乙一店', district: '台北市信義區', serviceLevel: 'B 保修(一年兩次)' },
  { id: 'S4', customerName: '乙客戶', name: '乙二店', district: '台中市西屯區', serviceLevel: 'B 保修(一年兩次)' },
  { id: 'S5', customerName: '丙客戶', name: '丙一店', district: '台北市信義區', serviceLevel: 'D 維修(無簽約客戶)' }
];
const SNAP_ASSIGNEES = [
  { id: 'ASG1', name: 'A組', districts: ['台北市信義區'] },
  { id: 'ASG2', name: 'B組', districts: ['台中市西屯區'] }
];

console.log('\nSection 2｜年度快照的建立與讀取');
const snap = MAU.buildYearSnapshot(
  2026, SNAP_ASSIGNEES, SNAP_CUSTOMERS, SNAP_STORES, SERVICE_LEVELS, '2026-01-05'
);
assertEq(snap.year, 2026, '快照的 year 為數字');
assertEq(snap.createdAt, '2026-01-05', 'createdAt 由呼叫端傳入');
assertEq(snap.syncedAt, '', '新建快照的 syncedAt 為空字串');
assertEq(snap.rows.length, 3, 'A組 2 列（甲、乙）+ B組 1 列（乙）＝ 3 列');
assertTrue(snap.rows.every(function (r) { return r.customerName !== '丙客戶'; }),
  'D 級客戶不入列');
assertEq(MAU.getSnapshotRows(snap, 'ASG1').length, 2, 'A組有 2 列');
assertDeep(MAU.getSnapshotRows(snap, 'ASG1').map(function (r) { return r.customerName; }),
  ['甲客戶', '乙客戶'], 'getSnapshotRows 依客戶名稱以 zh-Hant 排序');
assertEq(MAU.getSnapshotRows(snap, 'ASG1')[0].storeCount, 2, '甲客戶在 A組 轄區有 2 間門市');
assertEq(MAU.getSnapshotRows(snap, 'ASG1')[1].storeCount, 1, '乙客戶在 A組 轄區只有 1 間門市');
assertEq(MAU.getSnapshotRows(snap, 'ASG2')[0].storeCount, 1, '乙客戶在 B組 轄區有 1 間門市');
assertEq(MAU.getSnapshotRows(snap, 'ASG1')[0].serviceLevel, 'A 保修(一年四次)',
  '列上記錄當時的服務等級');
assertEq(MAU.getSnapshotRows(snap, 'ASG1')[0].periods.length, 4, '甲客戶快照有四個區間');
assertDeep(MAU.getSnapshotRows(snap, 'ASG9'), [], '查無指派人員回空陣列');
assertDeep(MAU.getSnapshotRows(null, 'ASG1'), [], 'snapshot 為 null 回空陣列');

// periods 必須是深拷貝
snap.rows[0].periods[0].startMonth = 99;
assertEq(SNAP_CUSTOMERS[0].periods[0].startMonth, 1, '改快照的區間不會動到客戶記錄（深拷貝）');
snap.rows[0].periods[0].startMonth = 1;

const YEARS = [snap, MAU.buildYearSnapshot(2025, SNAP_ASSIGNEES, SNAP_CUSTOMERS, SNAP_STORES, SERVICE_LEVELS, '2025-01-03')];
assertDeep(MAU.listYears(YEARS), [2026, 2025], 'listYears 由大到小');
assertDeep(MAU.listYears([]), [], '無年度回空陣列');
assertDeep(MAU.listYears(null), [], 'null 回空陣列');
assertEq(MAU.findYearSnapshot(YEARS, 2025).year, 2025, 'findYearSnapshot 取得指定年度');
assertEq(MAU.findYearSnapshot(YEARS, '2026').year, 2026, '年份以數字比對');
assertEq(MAU.findYearSnapshot(YEARS, 2030), null, '查無年度回 null');

const rowA = MAU.getSnapshotRows(snap, 'ASG1')[0];
const segMap = MAU.buildSegmentMap(rowA);
assertEq(segMap[1].period.visitIndex, 1, '1 月屬第 1 次');
assertEq(segMap[1].order, 0, '第 1 次的 order 為 0');
assertEq(segMap[12].period.visitIndex, 4, '12 月屬第 4 次');
assertEq(segMap[12].order, 3, '第 4 次的 order 為 3');
assertDeep(MAU.buildSegmentMap({ periods: [] }), {}, '無區間回空物件');
assertDeep(MAU.buildSegmentMap(null), {}, 'row 為 null 回空物件');

assertEq(MAU.findPeriodInRow(rowA, 5).visitIndex, 2, '5 月落在第 2 次');
assertEq(MAU.findPeriodInRow(rowA, 4).visitIndex, 2, '起始月為含界');
assertEq(MAU.findPeriodInRow(rowA, 6).visitIndex, 2, '結束月為含界');
const rowB = MAU.getSnapshotRows(snap, 'ASG1')[1];
assertEq(MAU.findPeriodInRow(rowB, 6).visitIndex, 1, '乙客戶 6 月落在第 1 次');
assertEq(MAU.findPeriodInRow({ periods: [{ visitIndex: 1, startMonth: 2, endMonth: 5 }] }, 1), null,
  '區間外回 null');
assertEq(MAU.findPeriodInRow(null, 1), null, 'row 為 null 回 null');
```

- [ ] **Step 2: 執行驗證腳本，確認 Section 2 失敗**

Run: `node scripts/verify-maintenance-allocation-years.mjs`
Expected: FAIL — `MAU.buildYearSnapshot is not a function`（腳本會拋例外中止）。

- [ ] **Step 3: 在 utils 新增六支快照函式**

在 `src/features/permissions/maintenance-allocation-utils.js` 的 `countCompletedStores` 之後、`findAllocation` 之前插入：

```js
  /**
   * 年度快照：把「哪些客戶入列、負責幾間門市、當時的服務等級與保養區間」凍結下來。
   * 之後客戶改服務等級或區間都不影響已建立的年度，除非明確呼叫 resyncYear。
   * @param {string} today 'YYYY-MM-DD'，由呼叫端傳入（utils 不取現在時間，便於測試）
   */
  function buildYearSnapshot(year, assignees, customers, stores, serviceLevels, today) {
    var rows = [];
    (assignees || []).forEach(function (assignee) {
      getCustomerRows(assignee, customers, stores, serviceLevels).forEach(function (row) {
        rows.push({
          assigneeId: assignee.id,
          customerName: row.customerName,
          serviceLevel: row.serviceLevel,
          storeCount: Number(row.storeCount) || 0,
          periods: CustomerUtils.getPeriods(customers, row.customerName).map(function (p) {
            return {
              visitIndex: Number(p.visitIndex),
              startMonth: Number(p.startMonth),
              endMonth: Number(p.endMonth)
            };
          })
        });
      });
    });
    return { year: Number(year), createdAt: today || '', syncedAt: '', rows: rows };
  }

  function findYearSnapshot(years, year) {
    return (years || []).find(function (y) {
      return Number(y.year) === Number(year);
    }) || null;
  }

  function listYears(years) {
    return (years || []).map(function (y) { return Number(y.year); })
      .sort(function (a, b) { return b - a; });
  }

  function getSnapshotRows(snapshot, assigneeId) {
    if (!snapshot) return [];
    return (snapshot.rows || []).filter(function (r) {
      return r.assigneeId === assigneeId;
    }).sort(function (a, b) {
      return String(a.customerName).localeCompare(String(b.customerName), 'zh-Hant');
    });
  }

  // 月份 → { period, order }；order 供區段底色交替使用
  function buildSegmentMap(row) {
    var map = {};
    ((row && row.periods) || []).forEach(function (p, order) {
      for (var m = Number(p.startMonth); m <= Number(p.endMonth); m++) {
        map[m] = { period: p, order: order };
      }
    });
    return map;
  }

  function findPeriodInRow(row, month) {
    var m = Number(month);
    return ((row && row.periods) || []).find(function (p) {
      return m >= Number(p.startMonth) && m <= Number(p.endMonth);
    }) || null;
  }
```

在檔尾的 `window.MaintenanceAllocationUtils = {...}` 中，於 `countCompletedStores` 之後加入這六個 key：

```js
    buildYearSnapshot: buildYearSnapshot,
    findYearSnapshot: findYearSnapshot,
    listYears: listYears,
    getSnapshotRows: getSnapshotRows,
    buildSegmentMap: buildSegmentMap,
    findPeriodInRow: findPeriodInRow,
```

- [ ] **Step 4: seed 產生當年度快照**

`src/data/seed.js` 檔尾（既有的 `INITIAL_CASES.forEach(...)` 之後）加入：

```js
// 年度快照由現行主檔計算產生，確保 demo 資料與畫面一致。
// maintenance-allocation-utils.js 於 index.html 中先於 seed.js 載入，故此處可直接呼叫。
const INITIAL_MAINTENANCE_ALLOCATION_YEARS = [
  MaintenanceAllocationUtils.buildYearSnapshot(
    SEED_YEAR,
    INITIAL_ASSIGNEES,
    INITIAL_CUSTOMERS,
    INITIAL_STORES,
    INITIAL_SERVICE_LEVELS,
    todayDate
  )
];
```

- [ ] **Step 5: app.js 接上 store 與 props**

- `src/app.js:102` 的 `maintenanceAllocations: INITIAL_MAINTENANCE_ALLOCATIONS,` 下方加一行：
  ```js
    maintenanceAllocationYears: INITIAL_MAINTENANCE_ALLOCATION_YEARS,
  ```
- `src/app.js:181` 的 `var setMaintenanceAllocations = makeSetter('maintenanceAllocations');` 下方加一行：
  ```js
  var setMaintenanceAllocationYears = makeSetter('maintenanceAllocationYears');
  ```
- `maintenance-allocation` view（約 761 行）的 props 物件，在 `setMaintenanceAllocations` 之後加兩行：
  ```js
          maintenanceAllocationYears: s.maintenanceAllocationYears,
          setMaintenanceAllocationYears: setMaintenanceAllocationYears,
  ```

- [ ] **Step 6: 執行驗證腳本，確認通過**

Run: `node scripts/verify-maintenance-allocation-years.mjs`
Expected: PASS，`失敗 0`

- [ ] **Step 7: 手動確認 seed 快照正確**

開 `index.html`，Console 執行：

```js
INITIAL_MAINTENANCE_ALLOCATION_YEARS[0].rows.length
MaintenanceAllocationUtils.getSnapshotRows(INITIAL_MAINTENANCE_ALLOCATION_YEARS[0], 'ASG1')
```

第二行應回傳 A組 的客戶列，`storeCount` 與畫面上「負責門市數」欄一致，`periods` 與該客戶的區間一致。Console 無錯誤。

- [ ] **Step 8: Commit**

```bash
git add src/features/permissions/maintenance-allocation-utils.js src/data/seed.js src/app.js scripts/verify-maintenance-allocation-years.mjs
git commit -m "feat: 保養分配新增年度快照資料層"
```

---

### Task 3: 快照比對、重新同步與孤兒判定

**Files:**
- Modify: `src/features/permissions/maintenance-allocation-utils.js`（新增函式與 export）
- Test: `scripts/verify-maintenance-allocation-years.mjs`（Section 3）

**Interfaces:**
- Consumes: Task 2 的 `buildYearSnapshot`、`findPeriodInRow`
- Produces:
  - `MaintenanceAllocationUtils.diffSnapshot(snapshot, assignees, customers, stores, serviceLevels)` → `{ added:Array<{assigneeId,customerName}>, removed:同, changed:Array<{assigneeId,customerName,from,to}> }`，`from`／`to` 為 `{ storeCount:number, serviceLevel:string, periods:Array }`
  - `MaintenanceAllocationUtils.hasSnapshotDiff(diff)` → `boolean`
  - `MaintenanceAllocationUtils.formatDiffSummary(diff)` → `string`，無差異回 `''`
  - `MaintenanceAllocationUtils.resyncYear(snapshot, assignees, customers, stores, serviceLevels, today)` → 新快照物件（保留 `year`／`createdAt`，`syncedAt` 設為 `today`）；`snapshot` 為 null 時回 `null`
  - `MaintenanceAllocationUtils.isOrphanAllocation(allocation, snapshot)` → `boolean`
  - `MaintenanceAllocationUtils.countOrphans(allocations, snapshot)` → `number`

- [ ] **Step 1: 在驗證腳本加入 Section 3 失敗測試**

在 Section 2 之後、結尾統計之前插入：

```js
console.log('\nSection 3｜快照比對、同步與孤兒判定');

// 情境：甲客戶由 A(4次) 降為 B(2次)，且乙客戶在 A組 轄區多開一間門市
const CHANGED_CUSTOMERS = [
  { id: 'C1', name: '甲客戶', serviceLevel: 'B 保修(一年兩次)', periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 6 },
    { visitIndex: 2, startMonth: 7, endMonth: 12 }
  ] },
  SNAP_CUSTOMERS[1],
  SNAP_CUSTOMERS[2]
];
const CHANGED_STORES = SNAP_STORES.concat([
  { id: 'S6', customerName: '乙客戶', name: '乙三店', district: '台北市信義區', serviceLevel: 'B 保修(一年兩次)' }
]);

const noDiff = MAU.diffSnapshot(snap, SNAP_ASSIGNEES, SNAP_CUSTOMERS, SNAP_STORES, SERVICE_LEVELS);
assertDeep([noDiff.added.length, noDiff.removed.length, noDiff.changed.length], [0, 0, 0],
  '主檔未變動時無差異');
assertEq(MAU.hasSnapshotDiff(noDiff), false, 'hasSnapshotDiff 為 false');
assertEq(MAU.formatDiffSummary(noDiff), '', '無差異時摘要為空字串');

const diff = MAU.diffSnapshot(snap, SNAP_ASSIGNEES, CHANGED_CUSTOMERS, CHANGED_STORES, SERVICE_LEVELS);
assertEq(diff.added.length, 0, '無新增列');
assertEq(diff.removed.length, 0, '無移除列');
assertEq(diff.changed.length, 2, '甲客戶（等級與區間變）與乙客戶在 A組（門市數變）共 2 列變動');
assertEq(MAU.hasSnapshotDiff(diff), true, 'hasSnapshotDiff 為 true');
assertEq(MAU.formatDiffSummary(diff), '2 列設定變動', '摘要只列出有數量的項目');

const changedA = diff.changed.find(function (c) {
  return c.assigneeId === 'ASG1' && c.customerName === '甲客戶';
});
assertEq(changedA.from.serviceLevel, 'A 保修(一年四次)', 'from 為快照裡的舊等級');
assertEq(changedA.to.serviceLevel, 'B 保修(一年兩次)', 'to 為現行主檔的新等級');
assertEq(changedA.from.periods.length, 4, 'from 有四個區間');
assertEq(changedA.to.periods.length, 2, 'to 有兩個區間');
const changedB = diff.changed.find(function (c) {
  return c.assigneeId === 'ASG1' && c.customerName === '乙客戶';
});
assertEq(changedB.from.storeCount, 1, '乙客戶原本 1 間');
assertEq(changedB.to.storeCount, 2, '乙客戶現在 2 間');

// 新增與移除列
const FEWER_ASSIGNEES = [SNAP_ASSIGNEES[0]];
const removeDiff = MAU.diffSnapshot(snap, FEWER_ASSIGNEES, SNAP_CUSTOMERS, SNAP_STORES, SERVICE_LEVELS);
assertEq(removeDiff.removed.length, 1, '移除 B組 後少 1 列');
assertEq(MAU.formatDiffSummary(removeDiff), '移除 1 列', '摘要為「移除 1 列」');
const smallSnap = MAU.buildYearSnapshot(
  2026, FEWER_ASSIGNEES, SNAP_CUSTOMERS, SNAP_STORES, SERVICE_LEVELS, '2026-01-05'
);
const addDiff = MAU.diffSnapshot(smallSnap, SNAP_ASSIGNEES, SNAP_CUSTOMERS, SNAP_STORES, SERVICE_LEVELS);
assertEq(addDiff.added.length, 1, '補回 B組 後多 1 列');
assertEq(MAU.formatDiffSummary(addDiff), '新增 1 列', '摘要為「新增 1 列」');

// resyncYear
const resynced = MAU.resyncYear(
  snap, SNAP_ASSIGNEES, CHANGED_CUSTOMERS, CHANGED_STORES, SERVICE_LEVELS, '2026-06-01'
);
assertEq(resynced.year, 2026, '同步後 year 不變');
assertEq(resynced.createdAt, '2026-01-05', '同步後 createdAt 保留原值');
assertEq(resynced.syncedAt, '2026-06-01', 'syncedAt 更新為傳入日期');
assertEq(MAU.getSnapshotRows(resynced, 'ASG1')[0].periods.length, 2,
  '同步後甲客戶只剩兩個區間');
assertEq(snap.rows.length, 3, '原快照物件未被就地修改');
assertEq(MAU.getSnapshotRows(snap, 'ASG1')[0].periods.length, 4,
  '原快照的甲客戶仍是四個區間');
assertEq(MAU.resyncYear(null, SNAP_ASSIGNEES, SNAP_CUSTOMERS, SNAP_STORES, SERVICE_LEVELS, '2026-06-01'),
  null, 'snapshot 為 null 回 null');

// 孤兒判定
const YEAR_ALLOCS = [
  { id: 'A1', year: 2026, assigneeId: 'ASG1', customerName: '甲客戶', month: 2, visitIndex: 1, targetCount: 1 },
  { id: 'A2', year: 2026, assigneeId: 'ASG1', customerName: '甲客戶', month: 8, visitIndex: 3, targetCount: 1 },
  { id: 'A3', year: 2026, assigneeId: 'ASG1', customerName: '丁客戶', month: 2, visitIndex: 1, targetCount: 1 },
  { id: 'A4', year: 2025, assigneeId: 'ASG1', customerName: '甲客戶', month: 8, visitIndex: 3, targetCount: 1 }
];
assertEq(MAU.isOrphanAllocation(YEAR_ALLOCS[0], snap), false,
  '原快照下 2 月在第 1 次區間內，非孤兒');
assertEq(MAU.isOrphanAllocation(YEAR_ALLOCS[1], snap), false,
  '原快照下 8 月在第 3 次區間內，非孤兒');
assertEq(MAU.isOrphanAllocation(YEAR_ALLOCS[1], resynced), false,
  '同步後 8 月仍落在第 2 次（7-12月）區間內，非孤兒');
assertEq(MAU.isOrphanAllocation(YEAR_ALLOCS[2], snap), true,
  '列已不在快照中（丁客戶）為孤兒');
assertEq(MAU.isOrphanAllocation(YEAR_ALLOCS[3], snap), false,
  '不同年度的格子不被本年度快照判為孤兒');
assertEq(MAU.countOrphans(YEAR_ALLOCS, snap), 1, '本年度共 1 格孤兒');
assertEq(MAU.countOrphans(YEAR_ALLOCS, null), 0, 'snapshot 為 null 回 0');

// 區間縮減後真的產生孤兒：乙客戶由 B(2次) 改為 C(1次，僅 1-6 月)
const SHRUNK_CUSTOMERS = [
  SNAP_CUSTOMERS[0],
  { id: 'C2', name: '乙客戶', serviceLevel: 'B 保修(一年兩次)', periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 3 },
    { visitIndex: 2, startMonth: 4, endMonth: 6 }
  ] },
  SNAP_CUSTOMERS[2]
];
const shrunk = MAU.resyncYear(
  snap, SNAP_ASSIGNEES, SHRUNK_CUSTOMERS, SNAP_STORES, SERVICE_LEVELS, '2026-06-01'
);
const LATE_ALLOC = { id: 'A5', year: 2026, assigneeId: 'ASG1', customerName: '乙客戶', month: 11, visitIndex: 2, targetCount: 1 };
assertEq(MAU.isOrphanAllocation(LATE_ALLOC, snap), false, '同步前 11 月在乙客戶第 2 次區間內');
assertEq(MAU.isOrphanAllocation(LATE_ALLOC, shrunk), true, '同步後 11 月落在所有區間外，成為孤兒');
```

- [ ] **Step 2: 執行驗證腳本，確認 Section 3 失敗**

Run: `node scripts/verify-maintenance-allocation-years.mjs`
Expected: FAIL — `MAU.diffSnapshot is not a function`

- [ ] **Step 3: 在 utils 新增七支函式**

在 `findPeriodInRow` 之後插入：

```js
  function snapshotRowKey(row) {
    return row.assigneeId + ' ' + row.customerName;
  }

  function periodsEqual(a, b) {
    var x = a || [], y = b || [];
    if (x.length !== y.length) return false;
    for (var i = 0; i < x.length; i++) {
      if (Number(x[i].visitIndex) !== Number(y[i].visitIndex)) return false;
      if (Number(x[i].startMonth) !== Number(y[i].startMonth)) return false;
      if (Number(x[i].endMonth) !== Number(y[i].endMonth)) return false;
    }
    return true;
  }

  /**
   * 比對快照與現行主檔，供「主檔已變動」提示與同步前摘要使用。
   * 只比對列的存在與 storeCount／serviceLevel／periods，不比對格子。
   */
  function diffSnapshot(snapshot, assignees, customers, stores, serviceLevels) {
    var currentRows = buildYearSnapshot(
      snapshot ? snapshot.year : 0, assignees, customers, stores, serviceLevels, ''
    ).rows;
    var oldRows = (snapshot && snapshot.rows) || [];
    var oldMap = {}, newMap = {};
    oldRows.forEach(function (r) { oldMap[snapshotRowKey(r)] = r; });
    currentRows.forEach(function (r) { newMap[snapshotRowKey(r)] = r; });

    var added = [], removed = [], changed = [];
    currentRows.forEach(function (r) {
      if (!oldMap[snapshotRowKey(r)]) {
        added.push({ assigneeId: r.assigneeId, customerName: r.customerName });
      }
    });
    oldRows.forEach(function (r) {
      var next = newMap[snapshotRowKey(r)];
      if (!next) {
        removed.push({ assigneeId: r.assigneeId, customerName: r.customerName });
        return;
      }
      if (Number(r.storeCount) !== Number(next.storeCount)
        || r.serviceLevel !== next.serviceLevel
        || !periodsEqual(r.periods, next.periods)) {
        changed.push({
          assigneeId: r.assigneeId,
          customerName: r.customerName,
          from: { storeCount: Number(r.storeCount), serviceLevel: r.serviceLevel, periods: r.periods },
          to: { storeCount: Number(next.storeCount), serviceLevel: next.serviceLevel, periods: next.periods }
        });
      }
    });
    return { added: added, removed: removed, changed: changed };
  }

  function hasSnapshotDiff(diff) {
    if (!diff) return false;
    return !!(diff.added.length || diff.removed.length || diff.changed.length);
  }

  function formatDiffSummary(diff) {
    if (!hasSnapshotDiff(diff)) return '';
    var parts = [];
    if (diff.added.length) parts.push('新增 ' + diff.added.length + ' 列');
    if (diff.removed.length) parts.push('移除 ' + diff.removed.length + ' 列');
    if (diff.changed.length) parts.push(diff.changed.length + ' 列設定變動');
    return parts.join('、');
  }

  /**
   * 以現行主檔重拍該年度的骨架。格子不動，故同步後可能出現孤兒格（見 isOrphanAllocation）。
   */
  function resyncYear(snapshot, assignees, customers, stores, serviceLevels, today) {
    if (!snapshot) return null;
    var next = buildYearSnapshot(snapshot.year, assignees, customers, stores, serviceLevels, today);
    return {
      year: Number(snapshot.year),
      createdAt: snapshot.createdAt || '',
      syncedAt: today || '',
      rows: next.rows
    };
  }

  /** 該格所屬的列已不在快照中，或月份不落在該列任一區間內 */
  function isOrphanAllocation(allocation, snapshot) {
    if (!allocation || !snapshot) return false;
    if (Number(allocation.year) !== Number(snapshot.year)) return false;
    var row = (snapshot.rows || []).find(function (r) {
      return r.assigneeId === allocation.assigneeId && r.customerName === allocation.customerName;
    });
    if (!row) return true;
    return !findPeriodInRow(row, allocation.month);
  }

  function countOrphans(allocations, snapshot) {
    if (!snapshot) return 0;
    var n = 0;
    (allocations || []).forEach(function (a) {
      if (isOrphanAllocation(a, snapshot)) n += 1;
    });
    return n;
  }
```

在 `window.MaintenanceAllocationUtils = {...}` 加入七個 key（`snapshotRowKey`／`periodsEqual` 為內部 helper，不匯出）：

```js
    diffSnapshot: diffSnapshot,
    hasSnapshotDiff: hasSnapshotDiff,
    formatDiffSummary: formatDiffSummary,
    resyncYear: resyncYear,
    isOrphanAllocation: isOrphanAllocation,
    countOrphans: countOrphans,
```

- [ ] **Step 4: 執行驗證腳本，確認通過**

Run: `node scripts/verify-maintenance-allocation-years.mjs`
Expected: PASS，`失敗 0`

- [ ] **Step 5: Commit**

```bash
git add src/features/permissions/maintenance-allocation-utils.js scripts/verify-maintenance-allocation-years.mjs
git commit -m "feat: 保養分配快照比對與重新同步邏輯"
```

---

### Task 4: 畫面改讀快照並加上年份選擇

本 Task 是行為切換點：網格骨架由即時計算改為讀快照，並加上年份下拉與「建立年度分配表」。

**Files:**
- Modify: `src/features/permissions/maintenance-allocation.js`
- Test: `scripts/verify-maintenance-allocation-years.mjs`（Section 4，headless Chrome 區段）

**Interfaces:**
- Consumes: Task 2／3 的全部 `MaintenanceAllocationUtils.*`；props `maintenanceAllocationYears`、`setMaintenanceAllocationYears`
- Produces: 無新對外介面（元件內部改動）

- [ ] **Step 1: 改寫元件頂部的狀態與常數**

`src/features/permissions/maintenance-allocation.js` 第 11-13 行改為：

```js
  var persistedSelectedAssigneeId = '';
  var persistedSelectedYear = 0;
  var persistedScrollLeft = 0;

  function todayString() {
    var d = new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }
```

（刪除 `CURRENT_YEAR` 常數；`SEGMENT_BG`、`MONTHS` 保留不動。）

- [ ] **Step 2: 讀取 props 並解出選定年度**

在 `MaintenanceAllocation(props)` 內，`var showToast = props.showToast;` 之後加入：

```js
    var maintenanceAllocationYears = props.maintenanceAllocationYears || [];
    var setMaintenanceAllocationYears = props.setMaintenanceAllocationYears;

    var availableYears = MaintenanceAllocationUtils.listYears(maintenanceAllocationYears);
    var thisYear = new Date().getFullYear();
    var selectedYear = persistedSelectedYear;
    if (availableYears.indexOf(selectedYear) === -1) {
      selectedYear = availableYears.indexOf(thisYear) !== -1
        ? thisYear
        : (availableYears[0] || 0);
      persistedSelectedYear = selectedYear;
    }

    var createModal = null;
```

- [ ] **Step 3: 改寫 `openEditModal` 改吃快照的列**

把 `openEditModal(row, month)` 整段換成：

```js
    function openEditModal(row, month) {
      var period = MaintenanceAllocationUtils.findPeriodInRow(row, month);
      if (!period) {
        showToast('此月份不在該年度的保養區間內', 'error');
        return false;
      }
      var existing = MaintenanceAllocationUtils.findAllocation(
        maintenanceAllocations,
        selectedYear,
        selectedAssigneeId,
        row.customerName,
        month
      );
      editModal = {
        customerName: row.customerName,
        month: month,
        visitIndex: period.visitIndex,
        period: period,
        targetCount: existing ? existing.targetCount : '',
        storeCount: row.storeCount,
        serviceLevel: row.serviceLevel
      };
      return true;
    }
```

- [ ] **Step 4: 列來源改讀快照**

在 `stateful(function (rerender) {` 內，把

```js
      var rows = assignee
        ? MaintenanceAllocationUtils.getCustomerRows(assignee, customers, stores, serviceLevels)
        : [];
```

換成：

```js
      var snapshot = MaintenanceAllocationUtils.findYearSnapshot(
        maintenanceAllocationYears, selectedYear
      );
      var rows = (assignee && snapshot)
        ? MaintenanceAllocationUtils.getSnapshotRows(snapshot, selectedAssigneeId)
        : [];
```

- [ ] **Step 5: 存檔與刪除帶入年度**

`handleSave` 的 `buildSaveWarnings` 參數物件在 `allocations: maintenanceAllocations,` 之後加 `year: selectedYear,`；`upsertAllocation` 的第二參數物件最前面加 `year: selectedYear,`。

`handleDelete` 的呼叫改為：

```js
        setMaintenanceAllocations(MaintenanceAllocationUtils.removeAllocation(
          maintenanceAllocations,
          selectedYear,
          selectedAssigneeId,
          deleteModal.customerName,
          deleteModal.month
        ));
```

- [ ] **Step 6: 刪除元件內的 `buildSegmentMap`，改用 utils**

刪除元件內第 161-170 行的區域函式 `buildSegmentMap`（含其上方註解）。`renderGrid` 內的 `var segments = buildSegmentMap(row);` 改為：

```js
                    var segments = MaintenanceAllocationUtils.buildSegmentMap(row);
```

- [ ] **Step 7: 儲存格與完成數改用選定年度**

`renderMonthCell` 內：

```js
        var cell = MaintenanceAllocationUtils.findAllocation(
          maintenanceAllocations,
          selectedYear,
          selectedAssigneeId,
          row.customerName,
          month
        );
```

以及區段首格的完成數：

```js
            var done = MaintenanceAllocationUtils.countCompletedStores(
              maintenanceCases, assignee && assignee.name, row.customerName, period, selectedYear
            );
```

- [ ] **Step 8: 加入建立年度 Modal**

在 `renderDeleteDialog` 之後加入：

```js
      function handleCreateYear() {
        if (!createModal) return;
        var year = Number(createModal.year);
        if (!year || year < 2000 || year > 2999) {
          showToast('請輸入 2000–2999 之間的年份', 'error');
          return;
        }
        if (MaintenanceAllocationUtils.findYearSnapshot(maintenanceAllocationYears, year)) {
          showToast('該年度分配表已存在', 'error');
          return;
        }
        var snap = MaintenanceAllocationUtils.buildYearSnapshot(
          year, assignees, customers, stores, serviceLevels, todayString()
        );
        setMaintenanceAllocationYears(maintenanceAllocationYears.concat([snap]));
        persistedSelectedYear = year;
        persistedScrollLeft = 0;
        createModal = null;
        showToast('已建立 ' + year + ' 年度分配表（' + snap.rows.length + ' 列）');
      }

      function renderCreateDialog() {
        if (!createModal) return null;
        return h(
          'div',
          { className: 'app-modal-overlay' },
          h(
            'div',
            { className: 'bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4' },
            h('h3', { className: 'text-lg font-bold text-gray-800 mb-1' }, '建立年度分配表'),
            h(
              'p',
              { className: 'text-sm text-gray-500 mb-6' },
              '將以目前的客戶、門市與服務等級設定，凍結成該年度的分配表骨架。'
            ),
            h(
              'div',
              null,
              h('label', { className: 'block text-sm text-gray-600 mb-1' }, '年份'),
              h('input', {
                type: 'number',
                value: createModal.year,
                onChange: function (e) {
                  createModal.year = e.target.value;
                  rerender();
                },
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h(
              'div',
              { className: 'flex justify-end gap-3 mt-8 pt-6 border-t' },
              h(
                'button',
                {
                  type: 'button',
                  onClick: function () { createModal = null; rerender(); },
                  className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
                },
                '取消'
              ),
              h(
                'button',
                {
                  type: 'button',
                  onClick: function () { handleCreateYear(); rerender(); },
                  className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
                },
                '建立'
              )
            )
          )
        );
      }

      function openCreateModal() {
        var suggested = availableYears.indexOf(thisYear) === -1
          ? thisYear
          : (availableYears[0] + 1);
        createModal = { year: suggested };
        rerender();
      }
```

- [ ] **Step 9: 工具列加入年份下拉與建立鈕，並處理空狀態**

把元件最後 `return h('div', {...}, ...)` 的工具列與內容區換成：

```js
      return h(
        'div',
        { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
        h(
          'div',
          { className: 'flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4' },
          h(
            'div',
            { className: 'flex flex-wrap items-end gap-4' },
            h(
              'div',
              { className: 'w-40' },
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '年度'),
              h(
                'div',
                { className: 'flex items-center gap-2' },
                availableYears.length
                  ? h(
                      'select',
                      {
                        value: String(selectedYear),
                        onChange: function (e) {
                          persistedSelectedYear = Number(e.target.value);
                          persistedScrollLeft = 0;
                          editModal = null;
                          deleteModal = null;
                          rerender();
                        },
                        className: 'flex-1 p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white'
                      },
                      availableYears.map(function (y) {
                        return h('option', { key: y, value: String(y) }, y + ' 年');
                      })
                    )
                  : null,
                h(
                  'button',
                  {
                    type: 'button',
                    title: '建立年度分配表',
                    onClick: openCreateModal,
                    className: 'shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors'
                  },
                  Icons.Plus({ className: 'h-5 w-5' })
                )
              )
            ),
            h(
              'div',
              { className: 'w-full max-w-xs' },
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '指派人員'),
              h(
                'select',
                {
                  value: selectedAssigneeId,
                  onChange: function (e) {
                    var nextId = e.target.value;
                    if (nextId !== selectedAssigneeId) persistedScrollLeft = 0;
                    selectedAssigneeId = nextId;
                    persistedSelectedAssigneeId = nextId;
                    editModal = null;
                    deleteModal = null;
                    rerender();
                  },
                  className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white'
                },
                h('option', { value: '' }, '請選擇指派人員'),
                sortedAssignees.map(function (item) {
                  return h('option', { key: item.id, value: item.id }, item.name);
                })
              )
            )
          ),
          assignee && snapshot
            ? h(
                'div',
                { className: 'text-sm text-gray-500' },
                '共 ',
                h('span', { className: 'font-semibold text-gray-700' }, String(rows.length)),
                ' 位客戶'
              )
            : null
        ),
        !snapshot
          ? renderEmptyYearPrompt()
          : (selectedAssigneeId ? renderGrid() : renderSelectionPrompt()),
        renderEditDialog(),
        renderDeleteDialog(),
        renderCreateDialog()
      );
```

並在 `renderSelectionPrompt` 之後加入：

```js
      function renderEmptyYearPrompt() {
        return h(
          'div',
          { className: 'border border-dashed border-gray-200 rounded-lg p-10 text-center' },
          h('div', { className: 'text-gray-400 text-base mb-4' }, '尚未建立任何年度分配表'),
          h(
            'button',
            {
              type: 'button',
              onClick: openCreateModal,
              className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
            },
            '建立年度分配表'
          )
        );
      }
```

編輯 Modal 的副標題（`renderEditDialog` 內的 `p`）改為：

```js
              selectedYear + ' 年 / ' + editModal.customerName + ' / ' + editModal.month
                + '月 / 負責門市數 ' + editModal.storeCount
```

- [ ] **Step 10: 在驗證腳本加入 headless Chrome 區段與 Section 4**

把 Task 1 腳本結尾的 `console.log(\`\n通過 ...\`); process.exit(...)` 移到檔案最末，並在 Section 3 之後插入 headless Chrome 區段：

```js
// ---------- headless Chrome 區段 ----------
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9347);
if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-allocation-years-profile',
  'about:blank'
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const consoleErrors = [];
function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
  }
  return r.result.value;
}

try {
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); break; }
    catch { await sleep(200); }
  }
  const page = targets.find(t => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(res => { ws.onopen = res; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(m.params.exceptionDetails.exception?.description
        || m.params.exceptionDetails.text);
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: `file://${ROOT}/index.html` });
  await sleep(4000);

  console.log('\nSection 4｜seed 年度快照與畫面接線');
  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');
  assertEq(await evaluate('INITIAL_MAINTENANCE_ALLOCATION_YEARS.length'), 1,
    'seed 有一筆年度快照');
  assertEq(await evaluate('Number(INITIAL_MAINTENANCE_ALLOCATION_YEARS[0].year)'),
    new Date().getFullYear(), 'seed 快照為當年度');
  assertTrue(await evaluate(`INITIAL_MAINTENANCE_ALLOCATIONS.every(function (a) {
    return Number(a.year) === Number(INITIAL_MAINTENANCE_ALLOCATION_YEARS[0].year);
  })`), 'seed 的分配格子全部屬於該年度');
  assertTrue(await evaluate(`INITIAL_MAINTENANCE_ALLOCATION_YEARS[0].rows.every(function (r) {
    return typeof r.assigneeId === 'string' && r.assigneeId
      && typeof r.customerName === 'string'
      && typeof r.storeCount === 'number'
      && Array.isArray(r.periods);
  })`), '快照每列的欄位齊備');
  assertEq(await evaluate(
    'MaintenanceAllocationUtils.countOrphans(INITIAL_MAINTENANCE_ALLOCATIONS, INITIAL_MAINTENANCE_ALLOCATION_YEARS[0])'
  ), 0, 'seed 資料下無孤兒格子');
  assertTrue(await evaluate(
    `/getSnapshotRows/.test(String(MaintenanceAllocation))`
  ), '元件的列來源改用 getSnapshotRows');
  assertTrue(await evaluate(
    `!/CustomerUtils\\.getPeriods/.test(String(MaintenanceAllocation))`
  ), '元件不再直接讀客戶的 periods');
  assertTrue(await evaluate(
    `!/CustomerUtils\\.findPeriodForMonth/.test(String(MaintenanceAllocation))`
  ), '元件不再用 CustomerUtils.findPeriodForMonth 查區間');
  assertTrue(await evaluate(
    `/findPeriodInRow/.test(String(MaintenanceAllocation))`
  ), '元件改用 findPeriodInRow 查區間');

  console.log('\nSection 4｜快照凍結：客戶改等級不影響已建立年度');
  assertDeep(await evaluate(`(function(){
    var years = INITIAL_MAINTENANCE_ALLOCATION_YEARS;
    var year = Number(years[0].year);
    var before = MaintenanceAllocationUtils.getSnapshotRows(years[0], 'ASG1')
      .map(function (r) { return r.customerName + ':' + r.periods.length + ':' + r.storeCount; });
    // 模擬客戶改等級與區間（只改副本，不動 seed）
    var customers = INITIAL_CUSTOMERS.map(function (c) {
      if (c.name !== '屈臣氏') return c;
      return Object.assign({}, c, {
        serviceLevel: 'B 保修(一年兩次)',
        periods: [
          { visitIndex: 1, startMonth: 1, endMonth: 6 },
          { visitIndex: 2, startMonth: 7, endMonth: 12 }
        ]
      });
    });
    var after = MaintenanceAllocationUtils.getSnapshotRows(years[0], 'ASG1')
      .map(function (r) { return r.customerName + ':' + r.periods.length + ':' + r.storeCount; });
    var next = MaintenanceAllocationUtils.buildYearSnapshot(
      year + 1, INITIAL_ASSIGNEES, customers, INITIAL_STORES, INITIAL_SERVICE_LEVELS, '2027-01-02'
    );
    var nextRow = MaintenanceAllocationUtils.getSnapshotRows(next, 'ASG1')
      .find(function (r) { return r.customerName === '屈臣氏'; });
    return [
      JSON.stringify(before) === JSON.stringify(after),
      nextRow ? nextRow.periods.length : -1
    ];
  })()`), [true, 2], '舊年度快照不受客戶異動影響；新年度只有兩個區間');
```

（`try` 區塊的收尾在 Task 6 才補齊；本 Task 先加上暫時的 `finally` 區塊：）

```js
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}

console.log(`\n通過 ${passed}｜失敗 ${failed}`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 11: 執行驗證腳本，確認通過**

Run: `node scripts/verify-maintenance-allocation-years.mjs`
Expected: PASS，`失敗 0`

- [ ] **Step 12: 手動確認畫面**

開 `index.html` → 系統權限 → 保養分配。應看到「年度」下拉（只有當年一筆）與旁邊的圓形＋鈕。選 A組 後網格內容與 Task 1 前完全一致。按＋建立下一年度，切過去後格子全空但區段仍在。Console 無錯誤。

- [ ] **Step 13: Commit**

```bash
git add src/features/permissions/maintenance-allocation.js scripts/verify-maintenance-allocation-years.mjs
git commit -m "feat: 保養分配加上年份選擇與年度快照網格"
```

---

### Task 5: 孤兒格子、主檔變動提示與重新同步

**Files:**
- Modify: `src/features/permissions/maintenance-allocation.js`
- Test: `scripts/verify-maintenance-allocation-years.mjs`（Section 5）

**Interfaces:**
- Consumes: Task 3 的 `diffSnapshot`／`hasSnapshotDiff`／`formatDiffSummary`／`resyncYear`／`isOrphanAllocation`／`countOrphans`
- Produces: 無新對外介面

- [ ] **Step 1: 孤兒格子的呈現與點擊行為**

`renderMonthCell` 內，在取得 `cell` 之後加入：

```js
        var isOrphan = cell && MaintenanceAllocationUtils.isOrphanAllocation(cell, snapshot);
```

儲存格 `div` 的 `className` 三元式改為：

```js
              className: 'min-h-[68px] rounded-md border ' +
                (isOrphan
                  ? 'border-red-300 border-dashed bg-red-50/50 hover:bg-red-100/50'
                  : (label
                      ? 'border-blue-200 bg-blue-50/70 hover:bg-blue-100/70'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/40')) +
                ' px-2 py-2 cursor-pointer transition-colors',
              title: isOrphan ? '此格已不在現行保養區間內' : ''
```

`onClick` 改為：

```js
              onClick: function () {
                syncScrollFromEl();
                if (isOrphan) {
                  deleteModal = {
                    customerName: row.customerName,
                    month: month,
                    label: row.customerName + ' ' + month + '月（' + label + '）'
                  };
                  showToast('此格已不在保養區間內，僅能刪除', 'error');
                  rerender();
                  return;
                }
                openEditModal(row, month);
                rerender();
              },
```

標籤文字加上警示前綴——把 `label || h('span', ...)` 改為：

```js
                (isOrphan && label) ? ('⚠ ' + label) : (label || h('span', { className: 'text-gray-300' }, ''))
```

- [ ] **Step 2: 主檔變動提示條**

在 `stateful` 內、`snapshot` 解出之後加入：

```js
      var snapshotDiff = snapshot
        ? MaintenanceAllocationUtils.diffSnapshot(
            snapshot, assignees, customers, stores, serviceLevels
          )
        : null;
      var hasDiff = MaintenanceAllocationUtils.hasSnapshotDiff(snapshotDiff);
```

在 `renderEmptyYearPrompt` 之後加入：

```js
      function renderDiffBanner() {
        if (!hasDiff) return null;
        return h(
          'div',
          {
            className: 'mb-4 flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'
          },
          Icons.AlertCircle({ className: 'h-4 w-4 shrink-0' }),
          h('span', { className: 'flex-1 min-w-0' },
            '主檔已變動：' + MaintenanceAllocationUtils.formatDiffSummary(snapshotDiff)
              + '。本年度骨架維持建立當時的設定，需要時可重新同步。')
        );
      }
```

並在最後 `return` 的內容區前插入 `renderDiffBanner(),`（放在 `!snapshot ? ... : ...` 那一行之前）。

- [ ] **Step 3: 重新同步按鈕與確認 Modal**

在 `handleCreateYear` 之後加入：

```js
      function handleResync() {
        if (!snapshot) return;
        syncScrollFromEl();
        var next = MaintenanceAllocationUtils.resyncYear(
          snapshot, assignees, customers, stores, serviceLevels, todayString()
        );
        setMaintenanceAllocationYears(maintenanceAllocationYears.map(function (y) {
          return Number(y.year) === Number(selectedYear) ? next : y;
        }));
        var orphans = MaintenanceAllocationUtils.countOrphans(maintenanceAllocations, next);
        var summary = MaintenanceAllocationUtils.formatDiffSummary(resyncModal.diff);
        resyncModal = null;
        showToast('已重新同步 ' + selectedYear + ' 年度；' + summary
          + (orphans ? '，' + orphans + ' 格已不在區間內，請確認' : ''));
      }

      function openResyncModal() {
        if (!snapshot) return;
        if (!hasDiff) {
          showToast('本年度骨架與現行主檔一致，無需同步');
          return;
        }
        var preview = MaintenanceAllocationUtils.resyncYear(
          snapshot, assignees, customers, stores, serviceLevels, todayString()
        );
        resyncModal = {
          diff: snapshotDiff,
          summary: MaintenanceAllocationUtils.formatDiffSummary(snapshotDiff),
          orphanCount: MaintenanceAllocationUtils.countOrphans(maintenanceAllocations, preview)
        };
        rerender();
      }

      function renderResyncDialog() {
        if (!resyncModal) return null;
        return h(
          'div',
          { className: 'app-modal-overlay' },
          h(
            'div',
            { className: 'bg-white rounded-lg shadow-xl p-6 w-[28rem] max-w-full m-4' },
            h(
              'div',
              { className: 'flex items-center space-x-3 text-amber-600 mb-4' },
              Icons.AlertCircle({ className: 'h-6 w-6' }),
              h('h3', { className: 'text-lg font-bold text-gray-800' }, '重新同步本年度')
            ),
            h('p', { className: 'text-gray-600 mb-2' },
              '將以現行的客戶、門市與服務等級重拍 ' + selectedYear + ' 年度的骨架：'),
            h('p', { className: 'text-gray-800 font-medium mb-4' }, resyncModal.summary),
            h('p', { className: 'text-sm text-gray-500 mb-6' },
              resyncModal.orphanCount
                ? ('已填的目標完成數一律保留；同步後將有 ' + resyncModal.orphanCount
                    + ' 格落在保養區間外，會標記為異常，需自行確認是否刪除。')
                : '已填的目標完成數一律保留。'),
            h(
              'div',
              { className: 'flex justify-end space-x-3' },
              h(
                'button',
                {
                  type: 'button',
                  onClick: function () { resyncModal = null; rerender(); },
                  className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
                },
                '取消'
              ),
              h(
                'button',
                {
                  type: 'button',
                  onClick: function () { handleResync(); rerender(); },
                  className: 'px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors'
                },
                '確認同步'
              )
            )
          )
        );
      }
```

在元件的 `var createModal = null;` 下方加 `var resyncModal = null;`。

工具列右側（顯示「共 N 位客戶」的那個位置）改為：

```js
          h(
            'div',
            { className: 'flex items-center gap-4' },
            assignee && snapshot
              ? h(
                  'div',
                  { className: 'text-sm text-gray-500' },
                  '共 ',
                  h('span', { className: 'font-semibold text-gray-700' }, String(rows.length)),
                  ' 位客戶'
                )
              : null,
            snapshot
              ? h(
                  'button',
                  {
                    type: 'button',
                    onClick: openResyncModal,
                    className: 'px-3 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap'
                  },
                  '重新同步本年度'
                )
              : null
          )
```

並在最後 `return` 的 `renderCreateDialog(),` 之後加 `renderResyncDialog()`。

- [ ] **Step 4: 在驗證腳本加入 Section 5**

在 Section 4 之後、`} finally {` 之前插入：

```js
  console.log('\nSection 5｜孤兒格子與重新同步');
  assertTrue(await evaluate(
    `/isOrphanAllocation/.test(String(MaintenanceAllocation))`
  ), '元件會判定孤兒格子');
  assertTrue(await evaluate(
    `/formatDiffSummary/.test(String(MaintenanceAllocation))`
  ), '元件會顯示主檔變動摘要');
  assertTrue(await evaluate(
    `/resyncYear/.test(String(MaintenanceAllocation))`
  ), '元件提供重新同步');

  assertDeep(await evaluate(`(function(){
    var year = Number(INITIAL_MAINTENANCE_ALLOCATION_YEARS[0].year);
    var snap = INITIAL_MAINTENANCE_ALLOCATION_YEARS[0];
    // 把屈臣氏的區間縮成只有上半年，模擬服務等級由 A(4次) 降為 B(2次) 但月份也縮短
    var customers = INITIAL_CUSTOMERS.map(function (c) {
      if (c.name !== '屈臣氏') return c;
      return Object.assign({}, c, {
        serviceLevel: 'B 保修(一年兩次)',
        periods: [
          { visitIndex: 1, startMonth: 1, endMonth: 3 },
          { visitIndex: 2, startMonth: 4, endMonth: 6 }
        ]
      });
    });
    var diff = MaintenanceAllocationUtils.diffSnapshot(
      snap, INITIAL_ASSIGNEES, customers, INITIAL_STORES, INITIAL_SERVICE_LEVELS
    );
    var next = MaintenanceAllocationUtils.resyncYear(
      snap, INITIAL_ASSIGNEES, customers, INITIAL_STORES, INITIAL_SERVICE_LEVELS, '2026-06-01'
    );
    var before = MaintenanceAllocationUtils.countOrphans(INITIAL_MAINTENANCE_ALLOCATIONS, snap);
    var after = MaintenanceAllocationUtils.countOrphans(INITIAL_MAINTENANCE_ALLOCATIONS, next);
    return [
      MaintenanceAllocationUtils.hasSnapshotDiff(diff),
      before,
      after > before,
      next.rows.length === snap.rows.length
    ];
  })()`), [true, 0, true, true],
    '縮短區間後有變動、同步前無孤兒、同步後出現孤兒、列數不變');

  assertTrue(await evaluate(`(function(){
    var snap = INITIAL_MAINTENANCE_ALLOCATION_YEARS[0];
    var next = MaintenanceAllocationUtils.resyncYear(
      snap, INITIAL_ASSIGNEES, INITIAL_CUSTOMERS, INITIAL_STORES, INITIAL_SERVICE_LEVELS, '2026-06-01'
    );
    return next.createdAt === snap.createdAt && next.syncedAt === '2026-06-01';
  })()`), '同步保留 createdAt、更新 syncedAt');
```

- [ ] **Step 5: 執行驗證腳本，確認通過**

Run: `node scripts/verify-maintenance-allocation-years.mjs`
Expected: PASS，`失敗 0`

- [ ] **Step 6: 手動確認同步流程**

開 `index.html` → 客戶管理，把「屈臣氏」的服務等級由 A 改為 B（區間會變成兩列，填 1-6／7-12）並儲存 → 回保養分配。應看到黃色提示條「主檔已變動：N 列設定變動」。按「重新同步本年度」→ Modal 顯示摘要與孤兒預估 → 確認後屈臣氏列變兩段，原本落在區間外的格子顯示紅色虛線框與 ⚠，點擊只跳刪除確認。提示條消失。

- [ ] **Step 7: Commit**

```bash
git add src/features/permissions/maintenance-allocation.js scripts/verify-maintenance-allocation-years.mjs
git commit -m "feat: 保養分配孤兒格標記與年度重新同步"
```

---

### Task 6: 統計頁的年份過濾與回歸

**Files:**
- Modify: `src/features/reports/performance-utils.js:76-88`（`sumAllocationTargets`）、`:137-140`、`:199-202`（兩處呼叫端）
- Test: `scripts/verify-maintenance-allocation-years.mjs`（Section 6）

**Interfaces:**
- Consumes: 分配格子的 `year` 欄位（Task 1）
- Produces: `PerformanceUtils.sumAllocationTargets(allocations, opts)` 的 `opts` 支援 `year`（未給時不過濾，維持既有呼叫相容）

- [ ] **Step 1: 在驗證腳本加入 Section 6**

在 Section 5 之後插入：

```js
  console.log('\nSection 6｜統計頁的年份過濾');
  assertDeep(await evaluate(`(function(){
    var allocs = [
      { id: 'X1', year: 2025, assigneeId: 'ASG1', customerName: '甲客戶', month: 2, visitIndex: 1, targetCount: 10 },
      { id: 'X2', year: 2026, assigneeId: 'ASG1', customerName: '甲客戶', month: 2, visitIndex: 1, targetCount: 3 }
    ];
    return [
      PerformanceUtils.sumAllocationTargets(allocs, { months: [1, 2, 3], assigneeId: 'ASG1' }),
      PerformanceUtils.sumAllocationTargets(allocs, { months: [1, 2, 3], assigneeId: 'ASG1', year: 2026 }),
      PerformanceUtils.sumAllocationTargets(allocs, { months: [1, 2, 3], assigneeId: 'ASG1', year: 2025 }),
      PerformanceUtils.sumAllocationTargets(allocs, { months: [1, 2, 3], customerName: '甲客戶', year: 2026 })
    ];
  })()`), [13, 3, 10, 3],
    '未給 year 不過濾；給了 year 只計該年度');

  assertTrue(await evaluate(
    `/quarter\\.start/.test(String(PerformanceUtils.computeAssigneePerformance))`
  ), 'computeAssigneePerformance 由 quarter 推出年份');
  assertTrue(await evaluate(
    `/quarter\\.start/.test(String(PerformanceUtils.computeRegionPerformance))`
  ), 'computeRegionPerformance 由 quarter 推出年份');

  const targetPair = await evaluate(`(function(){
    var year = Number(INITIAL_MAINTENANCE_ALLOCATION_YEARS[0].year);
    var quarter = PerformanceUtils.getQuarterRange(new Date(year, 6, 15));
    var withOther = INITIAL_MAINTENANCE_ALLOCATIONS.concat([
      { id: 'X9', year: year - 1, assigneeId: 'ASG1', customerName: '屈臣氏', month: 7, visitIndex: 1, targetCount: 99 }
    ]);
    var base = PerformanceUtils.computeAssigneePerformance({
      cases: INITIAL_CASES, maintenanceCases: INITIAL_MAINTENANCE_CASES,
      assignees: INITIAL_ASSIGNEES, allocations: INITIAL_MAINTENANCE_ALLOCATIONS,
      deviceCategories: INITIAL_DEVICE_CATEGORIES, serviceLevels: INITIAL_SERVICE_LEVELS,
      quarter: quarter
    });
    var polluted = PerformanceUtils.computeAssigneePerformance({
      cases: INITIAL_CASES, maintenanceCases: INITIAL_MAINTENANCE_CASES,
      assignees: INITIAL_ASSIGNEES, allocations: withOther,
      deviceCategories: INITIAL_DEVICE_CATEGORIES, serviceLevels: INITIAL_SERVICE_LEVELS,
      quarter: quarter
    });
    return [
      base.map(function (r) { return r.target; }).join(','),
      polluted.map(function (r) { return r.target; }).join(',')
    ];
  })()`);
  assertEq(targetPair[0], targetPair[1], '他年度的格子不計入本季目標');
```

- [ ] **Step 2: 執行驗證腳本，確認 Section 6 失敗**

Run: `node scripts/verify-maintenance-allocation-years.mjs`
Expected: FAIL — 第一組斷言回 `[13, 13, 13, 13]`（尚未過濾年份）。

- [ ] **Step 3: `sumAllocationTargets` 加入年份過濾**

`src/features/reports/performance-utils.js` 的 `sumAllocationTargets` 改為：

```js
  function sumAllocationTargets(allocations, opts) {
    opts = opts || {};
    var months = opts.months || [];
    var monthSet = {};
    months.forEach(function (m) { monthSet[m] = true; });
    var total = 0;
    (allocations || []).forEach(function (row) {
      if (!monthSet[row.month]) return;
      if (opts.year != null && Number(row.year) !== Number(opts.year)) return;
      if (opts.assigneeId && row.assigneeId !== opts.assigneeId) return;
      if (opts.customerName && row.customerName !== opts.customerName) return;
      total += Number(row.targetCount) || 0;
    });
    return total;
  }
```

- [ ] **Step 4: 兩處呼叫端由 quarter 推出年份**

`computeAssigneePerformance` 內（約 137 行）：

```js
      var target = sumAllocationTargets(allocations, {
        months: months,
        year: Number(String(quarter.start).slice(0, 4)),
        assigneeId: assignee.id
      });
```

`computeRegionPerformance` 內（約 199 行）：

```js
        var target = sumAllocationTargets(allocations, {
          months: months,
          year: Number(String(quarter.start).slice(0, 4)),
          customerName: customerName
        });
```

兩處的 `quarter` 皆已在函式內解出（`var quarter = input.quarter`），若該函式尚未把 `quarter` 存成區域變數，改用既有的取值方式即可，不要新增參數。

- [ ] **Step 5: 執行驗證腳本，確認通過**

Run: `node scripts/verify-maintenance-allocation-years.mjs`
Expected: PASS，`失敗 0`

- [ ] **Step 6: 替 `renameServiceLevel` 補上快照排除的註解**

年度快照的 `serviceLevel` 是名稱字串，且**刻意不**隨服務等級改名而更新（當年就是叫那個名字）。在 `src/features/permissions/service-level-utils.js` 的 `renameServiceLevel` 函式上方註解補一行：

```js
   * 註：保養分配的年度快照（maintenanceAllocationYears[].rows[].serviceLevel）刻意不在此同步，
   * 歷史年度應保留建立當時的等級名稱。新增其他集合時才需納入下方同步範圍。
```

若該函式原本沒有 JSDoc 區塊，改為在函式上方新增一段 `/** ... */` 註解，內容為上述兩行加上原有的一句行為描述。

- [ ] **Step 7: 執行回歸驗證**

依序執行，全部必須 `失敗 0`：

```bash
node scripts/verify-service-level-management.mjs
node scripts/verify-customer-maintenance-periods.mjs
node scripts/verify-maintenance-period-column.mjs
node scripts/verify-maintenance-start-months.mjs
node scripts/verify-case-record-points.mjs
```

若 `verify-service-level-management.mjs` 或 `verify-customer-maintenance-periods.mjs` 因為保養分配元件不再呼叫 `CustomerUtils.getPeriods`／`findPeriodForMonth` 而失敗，把那幾條「保養分配的分段來源改用 CustomerUtils.xxx」的斷言改為斷言 `MaintenanceAllocationUtils.buildSegmentMap`／`findPeriodInRow`，並在斷言說明加註「區間查詢已改由年度快照提供」。`CustomerUtils` 本身的純函式斷言不得更動。

- [ ] **Step 8: 手動確認統計頁**

開 `index.html` → 報表 → 案件績效統計。各組達成率的「目標」數字應與改動前一致（seed 的分配格子都屬當年度）。Console 無錯誤。

- [ ] **Step 9: Commit**

```bash
git add src/features/reports/performance-utils.js src/features/permissions/service-level-utils.js scripts/verify-maintenance-allocation-years.mjs scripts/verify-service-level-management.mjs scripts/verify-customer-maintenance-periods.mjs
git commit -m "feat: 案件績效統計依年度過濾保養分配目標"
```

---

## 完成後的檢查

- [ ] `node scripts/verify-maintenance-allocation-years.mjs` 通過
- [ ] 五支回歸腳本全部通過
- [ ] 開 `index.html` 走過：建立新年度 → 切年份 → 填格 → 改客戶等級 → 看到提示條 → 同步 → 孤兒格標記 → 刪除孤兒格，全程 Console 無錯誤
- [ ] 規格的「刻意不做」項目確實沒做：無自動建立年度、無跨年區間、無年度刪除功能、未限制服務等級的修改時機
