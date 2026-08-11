# 開始保養時間（開幕 N 個月後）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓客戶可設定「於開幕 N 個月後開始保養」，未滿期的門市不產生保養單、也不出現在保養計劃進度列表。

**Architecture:** 判斷規則以「月」為粒度，集中在 `customer-utils.js`（客戶欄位解讀的既有歸屬），
產生端（`schedule-utils.js` 的 `generateDueMaintenanceCases`）與列表端（`maintenance.js` 的
`MaintenanceList`）各呼叫一次同一份規則，兩邊不會算法漂移。列表端的案件層判斷包成
`schedule-utils.js` 的 `caseMaintenanceStarted`，與既有的 `casePeriodMatchesMonthRange`
放在一起（同樣是「案件是否該出現在保養計劃列表」的謂詞），讓它可以被純函式驗證。

**Tech Stack:** 原生 HTML / CSS / JavaScript（無框架、無建置）；驗證用 Node.js `node:vm`
載入 IIFE 模組做純函式測試，再以 headless Chrome + CDP 做 UI 測試。

## Global Constraints

- 無框架、無建置：所有模組是 IIFE，掛在 `window.*`；不得引入 npm 相依或 import/export 語法。
- 程式風格沿用檔案現況：`var`、`function` 宣告、單引號、2 空白縮排、中文註解。
- 判斷粒度為「月」（`'YYYY-MM'`），不比較日。
- `maintenanceStartMonths` 空白／`null`／`undefined`／非數字 → 一律當 0。負數或非整數 →
  `Math.max(0, Math.floor(n))`。
- 門市無 `openDate` → 視為尚未達標，不產生也不顯示。
- 只影響「保養計劃進度」列表與保養單產生。案件排程待辦、案件銷案審核、叫修案件紀錄不得改變行為。
- `src/data/seed.js` 的日期一律用相對常數（`todayDate` / `oneMonthAgoDate` /
  `threeMonthsAgoDate` 等），不寫死年月日。
- 新增的 script 檔若有，必須在 `index.html` 依序載入；本計劃不新增檔案到 `src/`，故不需改動。

---

### Task 1: `customer-utils.js` 起始保養月判斷

**Files:**
- Modify: `src/features/customer/customer-utils.js`
- Test: `scripts/verify-maintenance-start-months.mjs`（本任務建立）

**Interfaces:**
- Consumes: 既有 `findCustomerByName(customers, name)`（同檔內部函式）
- Produces:
  - `CustomerUtils.getMaintenanceStartMonths(customers, customerName) -> number`
  - `CustomerUtils.getMaintenanceStartMonth(customers, store) -> string`（`'YYYY-MM'` 或 `''`）
  - `CustomerUtils.isMaintenanceStartedForMonth(customers, store, referenceMonth) -> boolean`

- [ ] **Step 1: 建立驗證腳本並寫下失敗的測試**

建立 `scripts/verify-maintenance-start-months.mjs`，內容如下（本任務只有 Section 1，
後續任務會往後追加）：

```js
#!/usr/bin/env node
/**
 * 「開始保養時間：於開幕 N 個月後開始保養」驗證腳本。
 * Section 1 以 node:vm 載入 IIFE 模組做純函式驗證；
 * Section 3 以後為 headless Chrome + CDP 的 UI 驗證。
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
load('src/features/customer/customer-utils.js');
load('src/features/customer/store-utils.js');
load('src/features/permissions/service-level-utils.js');
load('src/features/scheduling/schedule-utils.js');
const CU = sandbox.CustomerUtils;
const SU = sandbox.ScheduleUtils;

// 甲客戶：開幕 6 個月後才保養；乙客戶：未設定（視為 0）；丙客戶：設定為空字串。
const CUSTOMERS = [
  { id: 'C1', name: '甲客戶', serviceLevel: 'A 保修(一年四次)', enabled: true,
    maintenanceStartMonths: 6, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 }
    ] },
  { id: 'C2', name: '乙客戶', serviceLevel: 'A 保修(一年四次)', enabled: true, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 }
    ] },
  { id: 'C3', name: '丙客戶', serviceLevel: 'A 保修(一年四次)', enabled: true,
    maintenanceStartMonths: '', periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 }
    ] },
  { id: 'C4', name: '丁客戶', serviceLevel: 'A 保修(一年四次)', enabled: true,
    maintenanceStartMonths: -3, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 }
    ] },
  { id: 'C5', name: '戊客戶', serviceLevel: 'A 保修(一年四次)', enabled: true,
    maintenanceStartMonths: 2.7, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 }
    ] }
];

console.log('Section 1｜CustomerUtils.getMaintenanceStartMonths');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, '甲客戶'), 6, '讀到設定值');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, '乙客戶'), 0, '未設定欄位視為 0');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, '丙客戶'), 0, '空字串視為 0');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, '丁客戶'), 0, '負數夾成 0');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, '戊客戶'), 2, '非整數無條件捨去');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, '查無此客戶'), 0, '查無客戶視為 0');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, ''), 0, '客戶名稱為空視為 0');
assertEq(CU.getMaintenanceStartMonths(null, '甲客戶'), 0, 'customers 為 null 視為 0');

console.log('\nSection 1｜CustomerUtils.getMaintenanceStartMonth');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '甲客戶', openDate: '2024-03-15' }), '2024-09',
  '2024-03 + 6 個月 = 2024-09（不看日）');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '甲客戶', openDate: '2024-10-01' }), '2025-04',
  '跨年：2024-10 + 6 個月 = 2025-04');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '甲客戶', openDate: '2024-07-31' }), '2025-01',
  '跨年邊界：2024-07 + 6 個月 = 2025-01');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '乙客戶', openDate: '2024-03-15' }), '2024-03',
  '未設定時起始保養月即開幕月');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '甲客戶', openDate: '' }), '', '無開幕日期回空字串');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '甲客戶' }), '', '缺 openDate 欄位回空字串');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '甲客戶', openDate: '不是日期' }), '', '開幕日期格式無效回空字串');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS, null), '', 'store 為 null 回空字串');

console.log('\nSection 1｜CustomerUtils.isMaintenanceStartedForMonth');
const STORE_A = { customerName: '甲客戶', storeName: '甲一店', openDate: '2024-03-15' };
assertTrue(CU.isMaintenanceStartedForMonth(CUSTOMERS, STORE_A, '2024-09'),
  '起始保養月當月即達標');
assertTrue(CU.isMaintenanceStartedForMonth(CUSTOMERS, STORE_A, '2025-01'),
  '起始保養月之後達標');
assertTrue(!CU.isMaintenanceStartedForMonth(CUSTOMERS, STORE_A, '2024-08'),
  '起始保養月前一個月未達標');
assertTrue(!CU.isMaintenanceStartedForMonth(CUSTOMERS, STORE_A, '2024-03'),
  '開幕當月未達標');
assertTrue(!CU.isMaintenanceStartedForMonth(CUSTOMERS,
  { customerName: '甲客戶', storeName: '無開幕日店' }, '2026-08'),
  '門市無開幕日期時視為未達標');
assertTrue(CU.isMaintenanceStartedForMonth(CUSTOMERS,
  { customerName: '乙客戶', storeName: '乙一店', openDate: '2026-08-20' }, '2026-08'),
  '未設定欄位的客戶，開幕當月即達標');
assertTrue(!CU.isMaintenanceStartedForMonth(CUSTOMERS, STORE_A, ''),
  '參考月為空字串時視為未達標');
assertTrue(!CU.isMaintenanceStartedForMonth(CUSTOMERS, STORE_A, '2024'),
  '參考月格式無效時視為未達標');
assertTrue(!CU.isMaintenanceStartedForMonth(CUSTOMERS, null, '2026-08'),
  'store 為 null 時視為未達標');

console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 2: 執行驗證腳本確認它失敗**

Run: `node scripts/verify-maintenance-start-months.mjs`
Expected: FAIL — `TypeError: CU.getMaintenanceStartMonths is not a function`

- [ ] **Step 3: 實作三個函式**

在 `src/features/customer/customer-utils.js` 中，`formatPeriodsLabel` 函式之後、
`validatePeriods` 之前插入：

```js
  /**
   * 客戶的「開始保養時間」：於開幕幾個月後開始保養。
   * 空白／非數字視為 0（開幕即可保養）；負數與非整數夾成 >= 0 的整數。
   */
  function normalizeStartMonths(value) {
    var n = Number(value);
    if (!isFinite(n)) return 0;
    return Math.max(0, Math.floor(n));
  }

  function getMaintenanceStartMonths(customers, customerName) {
    var cust = findCustomerByName(customers, customerName);
    return normalizeStartMonths(cust && cust.maintenanceStartMonths);
  }

  /**
   * 門市的起始保養月（'YYYY-MM'）＝ 開幕年月 + 客戶設定的月數。
   * 以「月」為粒度、不看日，與保養區間同單位。
   * 門市沒有開幕日期（或格式無效）時回空字串，呼叫端據此視為尚未達標。
   */
  function getMaintenanceStartMonth(customers, store) {
    if (!store) return '';
    var openDate = String(store.openDate == null ? '' : store.openDate);
    var year = parseInt(openDate.slice(0, 4), 10);
    var month = parseInt(openDate.slice(5, 7), 10);
    if (!year || !month || month < 1 || month > 12) return '';
    var zeroBased = (year * 12) + (month - 1)
      + getMaintenanceStartMonths(customers, store.customerName);
    var targetYear = Math.floor(zeroBased / 12);
    var targetMonth = (zeroBased % 12) + 1;
    return targetYear + '-' + (targetMonth < 10 ? '0' + targetMonth : String(targetMonth));
  }

  // referenceMonth 為 'YYYY-MM'。無開幕日期或參考月格式無效時一律回 false。
  function isMaintenanceStartedForMonth(customers, store, referenceMonth) {
    var startMonth = getMaintenanceStartMonth(customers, store);
    if (!startMonth) return false;
    var ref = String(referenceMonth == null ? '' : referenceMonth).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ref)) return false;
    return ref >= startMonth;
  }
```

並在檔尾 `window.CustomerUtils = { ... }` 的 `formatPeriodsLabel` 之後加入三行：

```js
    getMaintenanceStartMonths: getMaintenanceStartMonths,
    getMaintenanceStartMonth: getMaintenanceStartMonth,
    isMaintenanceStartedForMonth: isMaintenanceStartedForMonth,
```

- [ ] **Step 4: 執行驗證腳本確認全數通過**

Run: `node scripts/verify-maintenance-start-months.mjs`
Expected: PASS，最後一行的失敗數為 0（`通過 N／失敗 0`）

- [ ] **Step 5: 確認未影響既有純函式驗證**

Run: `node scripts/verify-customer-maintenance-periods.mjs`
Expected: 結尾 `失敗 0`

- [ ] **Step 6: Commit**

```bash
git add src/features/customer/customer-utils.js scripts/verify-maintenance-start-months.mjs
git commit -m "feat: 客戶起始保養月判斷工具（開幕 N 個月後）"
```

---

### Task 2: 產生端擋未滿期門市

**Files:**
- Modify: `src/features/scheduling/schedule-utils.js`（`generateDueMaintenanceCases`，約 157–163 行）
- Modify: `scripts/verify-maintenance-period-column.mjs`（`STORES` fixture，約 137–149 行）
- Test: `scripts/verify-maintenance-start-months.mjs`（追加 Section 2）

**Interfaces:**
- Consumes: `CustomerUtils.isMaintenanceStartedForMonth(customers, store, referenceMonth)`（Task 1）
- Produces: `generateDueMaintenanceCases` 行為改變，簽章不變

- [ ] **Step 1: 寫下失敗的測試**

在 `scripts/verify-maintenance-start-months.mjs` 中，把結尾兩行

```js
console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
```

**暫時往下移**，在它們之前插入 Section 2：

```js
const STORES = [
  // 甲客戶（6 個月）：2024-03 開幕 → 起始保養月 2024-09
  { customerName: '甲客戶', storeName: '甲一店', storeStatus: '正常營業',
    companyCity: '台北市', companyDistrict: '信義區',
    serviceLevel: 'A 保修(一年四次)', openDate: '2024-03-15' },
  // 甲客戶（6 個月）：2026-06 開幕 → 起始保養月 2026-12
  { customerName: '甲客戶', storeName: '甲新店', storeStatus: '正常營業',
    companyCity: '台北市', companyDistrict: '大安區',
    serviceLevel: 'A 保修(一年四次)', openDate: '2026-06-01' },
  // 甲客戶：沒有開幕日期
  { customerName: '甲客戶', storeName: '甲無開幕店', storeStatus: '正常營業',
    companyCity: '台北市', companyDistrict: '中山區',
    serviceLevel: 'A 保修(一年四次)' },
  // 乙客戶（未設定 → 0）：2026-08 開幕，當月即可保養
  { customerName: '乙客戶', storeName: '乙新店', storeStatus: '正常營業',
    companyCity: '台中市', companyDistrict: '西屯區',
    serviceLevel: 'A 保修(一年四次)', openDate: '2026-08-20' }
];

function generatedFor(cases, storeName) {
  return cases.filter(function (c) { return c.storeName === storeName; });
}

console.log('\nSection 2｜generateDueMaintenanceCases 依起始保養月擋單');
const gen = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, [], '2026-08');
assertEq(generatedFor(gen, '甲一店').length, 1, '已滿期門市照常建單');
assertEq(generatedFor(gen, '甲新店').length, 0, '未滿起始保養月的門市不建單');
assertEq(generatedFor(gen, '甲無開幕店').length, 0, '沒有開幕日期的門市不建單');
assertEq(generatedFor(gen, '乙新店').length, 1, '客戶未設定月數時，開幕當月即建單');

const genLater = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, [], '2026-12');
assertEq(generatedFor(genLater, '甲新店').length, 1, '到達起始保養月當月即開始建單');

const genBefore = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, [], '2026-11');
assertEq(generatedFor(genBefore, '甲新店').length, 0, '起始保養月前一個月仍不建單');

// 已存在的案件仍會被回填區間身分，不因新規則被刪除或改寫。
const existing = [{
  id: 'M1', customerName: '甲客戶', storeName: '甲新店', status: '未保養',
  planDate: '', dueMonth: '2026-07', isClosed: false
}];
const genKeep = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, existing, '2026-08');
assertEq(genKeep.filter(function (c) { return c.id === 'M1'; }).length, 1,
  '未滿期門市既有的案件不會被產生端移除');
```

- [ ] **Step 2: 執行驗證腳本確認新測試失敗**

Run: `node scripts/verify-maintenance-start-months.mjs`
Expected: FAIL — `✗ 未滿起始保養月的門市不建單 — expected 0, got 1`（以及「沒有開幕日期的門市不建單」同樣失敗）

- [ ] **Step 3: 在 `generateDueMaintenanceCases` 加一道判斷**

在 `src/features/scheduling/schedule-utils.js` 的 store 迴圈中，把

```js
      var cust = customerMap[store.customerName];
      if (!cust || cust.enabled === false) return;

      var period = CustomerUtils.findPeriodForMonth(customers, store.customerName, monthNumber);
```

改為

```js
      var cust = customerMap[store.customerName];
      if (!cust || cust.enabled === false) return;
      // 客戶設定「於開幕 N 個月後開始保養」時，未滿期的門市這一輪不開單。
      // 門市沒有開幕日期時同樣不開單（開幕日期為門市必填欄位）。
      if (!CustomerUtils.isMaintenanceStartedForMonth(customers, store, refMonth)) return;

      var period = CustomerUtils.findPeriodForMonth(customers, store.customerName, monthNumber);
```

- [ ] **Step 4: 執行驗證腳本確認通過**

Run: `node scripts/verify-maintenance-start-months.mjs`
Expected: 結尾 `失敗 0`

- [ ] **Step 5: 補上既有驗證腳本的 fixture**

`scripts/verify-maintenance-period-column.mjs` 的 `STORES` fixture 沒有 `openDate`，
在新規則下會被整批擋掉。為每一筆加上 `openDate`（該檔的客戶都未設定
`maintenanceStartMonths`，所以任一過去日期都能通過）。把該檔約 137–149 行的

```js
const STORES = [
  { customerName: '甲客戶', storeName: '甲一店', storeStatus: '正常營業',
    companyCity: '台北市', companyDistrict: '信義區', serviceLevel: 'A 保修(一年四次)' },
  { customerName: '甲客戶', storeName: '甲二店', storeStatus: '正常營業',
    companyCity: '台中市', companyDistrict: '西屯區', serviceLevel: 'A 保修(一年四次)',
    lastMaintenanceDate: '2026-05-01' },
  { customerName: '甲客戶', storeName: '甲已撤店', storeStatus: '已撤店',
    companyCity: '台北市', companyDistrict: '中山區', serviceLevel: 'A 保修(一年四次)' },
  { customerName: '乙客戶', storeName: '乙一店', storeStatus: '正常營業',
    companyCity: '台北市', companyDistrict: '大安區', serviceLevel: 'D 維修(無簽約客戶)' },
  { customerName: '丙客戶', storeName: '丙一店', storeStatus: '正常營業',
    companyCity: '桃園市', companyDistrict: '中壢區', serviceLevel: 'B 保修(一年兩次)' }
];
```

改為

```js
// openDate 為必要欄位：客戶的「開始保養時間」以開幕年月起算，
// 沒有開幕日期的門市不會被產生端開單（見 verify-maintenance-start-months.mjs）。
const STORES = [
  { customerName: '甲客戶', storeName: '甲一店', storeStatus: '正常營業',
    companyCity: '台北市', companyDistrict: '信義區', serviceLevel: 'A 保修(一年四次)',
    openDate: '2020-01-01' },
  { customerName: '甲客戶', storeName: '甲二店', storeStatus: '正常營業',
    companyCity: '台中市', companyDistrict: '西屯區', serviceLevel: 'A 保修(一年四次)',
    lastMaintenanceDate: '2026-05-01', openDate: '2020-01-01' },
  { customerName: '甲客戶', storeName: '甲已撤店', storeStatus: '已撤店',
    companyCity: '台北市', companyDistrict: '中山區', serviceLevel: 'A 保修(一年四次)',
    openDate: '2020-01-01' },
  { customerName: '乙客戶', storeName: '乙一店', storeStatus: '正常營業',
    companyCity: '台北市', companyDistrict: '大安區', serviceLevel: 'D 維修(無簽約客戶)',
    openDate: '2020-01-01' },
  { customerName: '丙客戶', storeName: '丙一店', storeStatus: '正常營業',
    companyCity: '桃園市', companyDistrict: '中壢區', serviceLevel: 'B 保修(一年兩次)',
    openDate: '2020-01-01' }
];
```

- [ ] **Step 6: 執行既有驗證腳本確認未回歸**

Run: `node scripts/verify-maintenance-period-column.mjs`
Expected: 結尾 `失敗 0`（此腳本含 headless Chrome 區段，需要 Chrome；若環境缺 Chrome 會以
exit code 2 中止，此時改跑 `node scripts/verify-service-level-management.mjs` 並記錄
Chrome 區段未執行）

- [ ] **Step 7: Commit**

```bash
git add src/features/scheduling/schedule-utils.js scripts/verify-maintenance-start-months.mjs scripts/verify-maintenance-period-column.mjs
git commit -m "feat: 保養單產生時擋下未達開始保養時間的門市"
```

---

### Task 3: 保養計劃列表擋未滿期案件

**Files:**
- Modify: `src/features/scheduling/schedule-utils.js`（新增 `caseMaintenanceStarted` 並匯出）
- Modify: `src/features/repair/maintenance.js`（`MaintenanceList` 的 `filteredCases`，約 116–122 行）
- Test: `scripts/verify-maintenance-start-months.mjs`（追加 Section 3）

**Interfaces:**
- Consumes: `CustomerUtils.isMaintenanceStartedForMonth`（Task 1）、既有
  `resolveCasePeriod` / `resolveMaintenanceReferenceDate` / `resolveStore` / `padMonth`
- Produces: `ScheduleUtils.caseMaintenanceStarted(maintenanceCase, customers, stores) -> boolean`

- [ ] **Step 1: 寫下失敗的測試**

在 `scripts/verify-maintenance-start-months.mjs` 的結尾兩行之前插入 Section 3：

```js
console.log('\nSection 3｜ScheduleUtils.caseMaintenanceStarted');
// 甲新店（2026-06 開幕 + 6 個月 → 起始保養月 2026-12）
assertTrue(!SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '甲新店', periodYear: 2026, periodVisitIndex: 3 },
  CUSTOMERS, STORES),
  '區間起始月（2026-07）早於起始保養月時不列出');
assertTrue(!SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '甲新店', periodYear: 2026, periodVisitIndex: 4 },
  CUSTOMERS, STORES),
  '2026 年第 4 次區間（2026-10）仍早於起始保養月 2026-12，不列出');
assertTrue(SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '甲新店', periodYear: 2027, periodVisitIndex: 1 },
  CUSTOMERS, STORES),
  '2027 年第 1 次區間（2027-01）晚於起始保養月，列出');
assertTrue(SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '甲一店', periodYear: 2026, periodVisitIndex: 3 },
  CUSTOMERS, STORES),
  '已滿期門市的案件照常列出');
assertTrue(!SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '甲無開幕店', periodYear: 2026, periodVisitIndex: 3 },
  CUSTOMERS, STORES),
  '門市沒有開幕日期時不列出');
// 解析不到區間時退回 planDate／dueMonth 的年月
assertTrue(!SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '甲新店', planDate: '2026-08-05' },
  CUSTOMERS, STORES),
  '無區間身分時用 planDate 的年月判斷');
assertTrue(SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '甲新店', planDate: '2027-01-05' },
  CUSTOMERS, STORES),
  'planDate 已在起始保養月之後時列出');
// 資料不全時不套用此規則，避免案件無聲消失
assertTrue(SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '不存在的門市', periodYear: 2026, periodVisitIndex: 3 },
  CUSTOMERS, STORES),
  '查無門市時不套用此規則');
assertTrue(SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '甲新店' },
  CUSTOMERS, STORES),
  '案件既無區間身分也無日期時不套用此規則');
assertTrue(SU.caseMaintenanceStarted(null, CUSTOMERS, STORES),
  '案件為 null 時不套用此規則');
```

- [ ] **Step 2: 執行驗證腳本確認新測試失敗**

Run: `node scripts/verify-maintenance-start-months.mjs`
Expected: FAIL — `TypeError: SU.caseMaintenanceStarted is not a function`

- [ ] **Step 3: 在 `schedule-utils.js` 實作謂詞**

在 `src/features/scheduling/schedule-utils.js` 的 `casePeriodMatchesMonthRange` 之後、
`formatCasePeriodLabel` 之前插入：

```js
  // 案件用於判斷「開始保養時間」的參考年月：優先取所屬區間的起始年月，
  // 解析不到區間時退回 planDate（或 dueMonth）的年月，兩者皆無時回空字串。
  function caseStartReferenceMonth(maintenanceCase, customers) {
    var period = resolveCasePeriod(maintenanceCase, customers);
    if (period) return period.year + '-' + padMonth(period.startMonth);
    var refDate = resolveMaintenanceReferenceDate(maintenanceCase);
    return refDate ? String(refDate).slice(0, 7) : '';
  }

  /**
   * 該筆保養案件是否已達客戶設定的「開始保養時間」（開幕 N 個月後）。
   * 查無門市、或案件既無區間身分也無日期時回 true（不套用此規則）——
   * 資料不全的案件不該因此從保養計劃無聲消失。
   * 門市存在但沒有開幕日期時回 false，與產生端一致。
   */
  function caseMaintenanceStarted(maintenanceCase, customers, stores) {
    if (!maintenanceCase) return true;
    var store = resolveStore(stores, maintenanceCase.customerName, maintenanceCase.storeName);
    if (!store) return true;
    var refMonth = caseStartReferenceMonth(maintenanceCase, customers);
    if (!refMonth) return true;
    return CustomerUtils.isMaintenanceStartedForMonth(customers, store, refMonth);
  }
```

並在檔尾 `window.ScheduleUtils = { ... }` 的 `casePeriodMatchesMonthRange` 之後加入一行：

```js
    caseMaintenanceStarted: caseMaintenanceStarted,
```

- [ ] **Step 4: 執行驗證腳本確認通過**

Run: `node scripts/verify-maintenance-start-months.mjs`
Expected: 結尾 `失敗 0`

- [ ] **Step 5: 在保養計劃列表套用**

在 `src/features/repair/maintenance.js` 的 `MaintenanceList` 中，把

```js
      var filteredCases = cases.filter(function (c) {
        if (c.isClosed) return false;
        if (appliedFilters.customer !== '全部' && c.customerName !== appliedFilters.customer) return false;
        if (appliedFilters.storeArea !== '全部' && !StoreUtils.matchesRecordArea(c, appliedFilters.storeArea)) return false;
        if (appliedFilters.status !== '全部' && c.status !== appliedFilters.status) return false;
        if (!matchesPeriodMonthFilter(c)) return false;
        return true;
      })
```

改為

```js
      var filteredCases = cases.filter(function (c) {
        if (c.isClosed) return false;
        if (appliedFilters.customer !== '全部' && c.customerName !== appliedFilters.customer) return false;
        if (appliedFilters.storeArea !== '全部' && !StoreUtils.matchesRecordArea(c, appliedFilters.storeArea)) return false;
        if (appliedFilters.status !== '全部' && c.status !== appliedFilters.status) return false;
        if (!matchesPeriodMonthFilter(c)) return false;
        // 客戶設定「於開幕 N 個月後開始保養」時，未滿期的門市不出現在保養計劃。
        // 只擋這份列表——案件排程待辦、銷案審核、叫修紀錄不受影響。
        if (!ScheduleUtils.caseMaintenanceStarted(c, customers, stores)) return false;
        return true;
      })
```

- [ ] **Step 6: 手動確認頁面無 JS 錯誤**

Run: `node scripts/verify-maintenance-period-column.mjs`
Expected: 結尾 `失敗 0`，其中包含「操作後仍無 JS 錯誤」一項（此腳本的 UI 區段會開啟
`index.html` 並進入保養計劃進度；`stores` 與 `customers` 皆已是 `MaintenanceList` 的
既有 props，不需改 `app.js`）

- [ ] **Step 7: Commit**

```bash
git add src/features/scheduling/schedule-utils.js src/features/repair/maintenance.js scripts/verify-maintenance-start-months.mjs
git commit -m "feat: 保養計劃列表擋下未達開始保養時間的案件"
```

---

### Task 4: 客戶管理表單新增「開始保養時間」欄位

**Files:**
- Modify: `src/features/customer/customer-form.js`（`formData` 初始值約 36–46 行、
  「服務等級」欄位之後約 237–247 行、`handleSubmit` 約 160–193 行）

**Interfaces:**
- Consumes: 無（純表單欄位）
- Produces: 客戶物件多一個 `maintenanceStartMonths` 欄位（number 或 `''`），
  供 `CustomerUtils.getMaintenanceStartMonths` 讀取

- [ ] **Step 1: 在 `formData` 初始值加入欄位**

把

```js
      serviceLevel: (targetCase && targetCase.serviceLevel) || SERVICE_LEVEL_OPTIONS[0] || '',
```

改為

```js
      serviceLevel: (targetCase && targetCase.serviceLevel) || SERVICE_LEVEL_OPTIONS[0] || '',
      // 開幕幾個月後開始保養。空字串代表未設定，讀取端（CustomerUtils）一律當 0。
      maintenanceStartMonths: (targetCase && targetCase.maintenanceStartMonths !== undefined
        && targetCase.maintenanceStartMonths !== null)
        ? String(targetCase.maintenanceStartMonths)
        : '',
```

（表單內以字串保存，儲存時才轉數字，避免受控 input 在使用者清空欄位時跳值。）

- [ ] **Step 2: 在「服務等級」欄位之後加入輸入框**

在 `customer-form.js` 的「服務等級」`h('div', ...)` 區塊之後、「啟用狀態」區塊之前插入：

```js
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '開始保養時間'),
              h('div', { className: 'flex items-center gap-2' },
                h('span', { className: 'text-sm text-gray-500 whitespace-nowrap' }, '於開幕'),
                h('input', {
                  type: 'number',
                  name: 'maintenanceStartMonths',
                  min: '0',
                  step: '1',
                  value: formData.maintenanceStartMonths,
                  onChange: handleChange,
                  className: 'w-24 p-2.5 border rounded-md outline-none focus:border-blue-500'
                }),
                h('span', { className: 'text-sm text-gray-500 whitespace-nowrap' }, '個月後開始保養')
              )
            ),
```

- [ ] **Step 3: 在 `handleSubmit` 正規化後再存檔**

把

```js
        var savedPeriods = periods.map(function (p) {
          return { visitIndex: p.visitIndex, startMonth: p.startMonth, endMonth: p.endMonth };
        });
        if (isEdit) {
          setCases(cases.map(function (c) {
            return c.id === targetCase.id
              ? Object.assign({}, c, formData, { contacts: contacts, periods: savedPeriods })
              : c;
          }));
          showToast('客戶資料更新成功');
        } else {
          var newCustomer = Object.assign({ id: 'CUST' + Date.now() }, formData, {
            contacts: contacts,
            periods: savedPeriods,
            createdDate: todayDate
          });
```

改為

```js
        var savedPeriods = periods.map(function (p) {
          return { visitIndex: p.visitIndex, startMonth: p.startMonth, endMonth: p.endMonth };
        });
        // 開始保養時間：留白就存空字串（讀取端當 0）；有值就夾成 >= 0 的整數。
        // 這個欄位沒有語意模糊空間，直接夾值比跳警告乾淨。
        var rawStartMonths = String(formData.maintenanceStartMonths || '').trim();
        var savedStartMonths = rawStartMonths === '' || !isFinite(Number(rawStartMonths))
          ? ''
          : Math.max(0, Math.floor(Number(rawStartMonths)));
        if (isEdit) {
          setCases(cases.map(function (c) {
            return c.id === targetCase.id
              ? Object.assign({}, c, formData, {
                  contacts: contacts,
                  periods: savedPeriods,
                  maintenanceStartMonths: savedStartMonths
                })
              : c;
          }));
          showToast('客戶資料更新成功');
        } else {
          var newCustomer = Object.assign({ id: 'CUST' + Date.now() }, formData, {
            contacts: contacts,
            periods: savedPeriods,
            maintenanceStartMonths: savedStartMonths,
            createdDate: todayDate
          });
```

- [ ] **Step 4: 執行既有客戶表單驗證確認未回歸**

Run: `node scripts/verify-customer-maintenance-periods.mjs`
Expected: 結尾 `失敗 0`

- [ ] **Step 5: Commit**

```bash
git add src/features/customer/customer-form.js
git commit -m "feat: 客戶管理新增「開始保養時間」欄位"
```

---

### Task 5: 門市開幕日期改必填、假資料與文件

**Files:**
- Modify: `src/features/customer/store-form.js`（約 272 行）
- Modify: `src/data/seed.js`（`INITIAL_CUSTOMERS` 與 `INITIAL_STORES`）
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1–4 的全部改動
- Produces: 可在瀏覽器直接看到效果的假資料狀態，供 Task 6 的 UI 驗證斷言

- [ ] **Step 1: 開幕日期改必填**

在 `src/features/customer/store-form.js` 把

```js
            field('開幕日期', 'openDate', { type: 'date' }),
```

改為

```js
            field('開幕日期', 'openDate', { type: 'date', required: true }),
```

（`field()` 的 `opts.required` 會同時在 label 後加紅色 `*` 並在 input 上設 `required`，
表單是原生 `<form onSubmit>`，瀏覽器會擋下送出。）

- [ ] **Step 2: 假資料——客戶設定開始保養時間**

在 `src/data/seed.js` 的 `INITIAL_CUSTOMERS` 中：

「屈臣氏」（`id: 'CUST1'`）的 `serviceLevel` 那一行之後加入

```js
  maintenanceStartMonths: 0,
```

「星巴克」（`id: 'CUST2'`）的 `serviceLevel` 那一行之後加入

```js
  maintenanceStartMonths: 6,
```

- [ ] **Step 3: 假資料——讓星巴克「北屯崇德店」落在未滿期**

在 `INITIAL_STORES` 中找到 `storeName: '北屯崇德店'`（`customerName: '星巴克'`）那一筆，
把

```js
  openDate: '2023-08-01',
```

改為

```js
  // 三個月前開幕；星巴克設定「開幕 6 個月後才保養」，故此門市目前不應出現在保養計劃進度。
  openDate: threeMonthsAgoDate,
```

（`threeMonthsAgoDate` 定義在 `src/data/options.js`，在 `seed.js` 載入前已就緒。）

- [ ] **Step 4: 開瀏覽器確認**

Run: `open index.html`（或以 `superpowers` 環境的等效方式開啟）
確認：
- 客戶建檔 → 客戶管理 → 編輯「星巴克」，可見「開始保養時間 於開幕 [6] 個月後開始保養」
- 客戶建檔 → 門市管理 → 編輯任一門市，「開幕日期」label 帶紅色 `*`
- 維修服務 → 保養計劃進度（月份篩選為當月），列表中**沒有**「星巴克／北屯崇德店」
- 維修服務 → 保養計劃進度，列表中**有**其他正常營業門市（例如「屈臣氏／台北信義店」）

- [ ] **Step 5: README 補一句**

在 `README.md` 的「功能說明」段落，於既有的功能列舉之後另起一行加入：

```markdown
保養計劃進度只列出已達客戶「開始保養時間」（於開幕 N 個月後）的門市；門市開幕日期為必填。
```

- [ ] **Step 6: Commit**

```bash
git add src/features/customer/store-form.js src/data/seed.js README.md
git commit -m "feat: 門市開幕日期必填、假資料示範開始保養時間"
```

---

### Task 6: UI 驗證區段

**Files:**
- Modify: `scripts/verify-maintenance-start-months.mjs`（追加 Section 4：headless Chrome）

**Interfaces:**
- Consumes: Task 5 的假資料狀態（星巴克 `maintenanceStartMonths: 6`、
  北屯崇德店 `openDate: threeMonthsAgoDate`）
- Produces: 無（終端任務）

- [ ] **Step 1: 追加 UI 區段**

在 `scripts/verify-maintenance-start-months.mjs` 的結尾兩行

```js
console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
```

之前插入：

```js
// ---------- headless Chrome 區段 ----------
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9346);
if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-maintenance-start-profile',
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
function clickByText(text) {
  return evaluate(`(function () {
    var els = Array.prototype.slice.call(document.querySelectorAll('button, a, div'));
    var target = els.filter(function (el) {
      return el.textContent.trim() === ${JSON.stringify(text)};
    }).pop();
    if (target) target.click();
    return !!target;
  })()`);
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

  console.log('\nSection 4｜保養計劃進度列表');
  assertTrue(await clickByText('保養計劃進度'), '可導覽到保養計劃進度');
  await sleep(1200);
  const listText = await evaluate(`(function () {
    var tbody = document.querySelector('table tbody');
    return tbody ? tbody.textContent : '';
  })()`);
  assertTrue(listText.indexOf('北屯崇德店') === -1,
    '未達開始保養時間的門市不出現在保養計劃進度');
  assertTrue(listText.indexOf('台北信義店') !== -1,
    '已達開始保養時間的門市照常出現');

  console.log('\nSection 4｜客戶管理的「開始保養時間」欄位');
  assertTrue(await clickByText('客戶管理'), '可導覽到客戶管理');
  await sleep(1200);
  const opened = await evaluate(`(function () {
    var rows = Array.prototype.slice.call(document.querySelectorAll('table tbody tr'));
    var row = rows.filter(function (r) {
      return r.textContent.indexOf('星巴克') !== -1;
    })[0];
    if (!row) return false;
    var btn = row.querySelector('button[aria-label="編輯"]');
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  assertTrue(opened, '可開啟星巴克的編輯表單');
  await sleep(1000);
  const startMonthsValue = await evaluate(
    `(function () {
      var el = document.querySelector('input[name="maintenanceStartMonths"]');
      return el ? el.value : null;
    })()`);
  assertEq(startMonthsValue, '6', '編輯表單帶出客戶已設定的開始保養時間');
  const helperText = await evaluate(`(function () {
    var el = document.querySelector('input[name="maintenanceStartMonths"]');
    return el ? el.parentNode.textContent.replace(/\\s+/g, '') : '';
  })()`);
  assertTrue(helperText.indexOf('於開幕') !== -1 && helperText.indexOf('個月後開始保養') !== -1,
    '欄位有「於開幕 N 個月後開始保養」說明文字', helperText);

  console.log('\nSection 4｜門市開幕日期必填');
  assertTrue(await clickByText('門市管理'), '可導覽到門市管理');
  await sleep(1200);
  const openDateRequired = await evaluate(`(function () {
    var rows = Array.prototype.slice.call(document.querySelectorAll('table tbody tr'));
    var btn = rows.length ? rows[0].querySelector('button[aria-label="編輯"]') : null;
    if (!btn) return null;
    btn.click();
    return true;
  })()`);
  assertTrue(openDateRequired === true, '可開啟門市編輯表單');
  await sleep(1000);
  assertEq(await evaluate(
    `(function () {
      var el = document.querySelector('input[name="openDate"]');
      return el ? el.required : null;
    })()`), true, '開幕日期為必填欄位');

  assertEq(consoleErrors.length, 0, '操作後仍無 JS 錯誤');
} catch (err) {
  // 沒有 catch 的話，UI 區段的例外會變成 unhandled rejection，
  // 讓腳本跳過結尾的統計與 process.exit，以難以判讀的方式結束。
  fail('UI 驗證中斷', err && err.stack ? err.stack : String(err));
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}
```

- [ ] **Step 2: 執行完整驗證腳本**

Run: `node scripts/verify-maintenance-start-months.mjs`
Expected: 結尾 `失敗 0`

若某個 UI 斷言因選取器對不上而失敗（例如編輯按鈕的 `aria-label` 與預期不同），
先用 `node -e` 或在腳本內 `console.log` 印出該區塊的 DOM 片段，修正選取器再重跑。
**不要**為了讓斷言通過而放寬斷言本身。

- [ ] **Step 3: 執行全部既有驗證腳本，確認無回歸**

Run:

```bash
for f in scripts/verify-*.mjs; do
  echo "=== $f ==="
  node "$f" 2>&1 | tail -3
done
```

Expected: 每個腳本結尾皆為 `失敗 0`（缺 Chrome 而以 exit 2 中止者需記錄並說明）

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-maintenance-start-months.mjs
git commit -m "test: 開始保養時間的 UI 驗證區段"
```

---

## 完成標準

- `node scripts/verify-maintenance-start-months.mjs` 全數通過
- 所有既有 `scripts/verify-*.mjs` 仍全數通過
- 瀏覽器開啟 `index.html`：客戶管理有「開始保養時間」欄位、門市開幕日期必填、
  保養計劃進度不列出星巴克／北屯崇德店
