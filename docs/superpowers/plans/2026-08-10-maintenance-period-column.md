# 保養計劃進度：保養區間欄位與區間驅動排程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓「保養計劃進度」列表以客戶的保養區間（第N次、起訖月）為單位呈現與篩選，並把保養單的自動產生改為「每個區間一筆、跨區間重建」。

**Architecture:** 在 `ScheduleUtils` 新增三個純函式（`resolveCasePeriod` / `formatPeriodRange` / `periodMonthRange`）作為「案件 → 區間」的唯一解析入口；保養案件新增 `periodYear` / `periodVisitIndex` 兩個欄位當作區間身分；`generateDueMaintenanceCases` 改為以「當月所在區間」驅動並在啟動時回填舊案件的區間；列表與明細頁都改讀這組函式。

**Tech Stack:** 原生 ES5 風格 JavaScript（IIFE + `window.XxxUtils`）、無建置步驟、Tailwind CDN；驗證腳本為 Node ESM + `node:vm` 純函式測試 + headless Chrome CDP 的 UI 測試。

## Global Constraints

- 全部程式碼寫成 ES5 風格：`var`、`function`、不使用箭頭函式／`const`／`let`／樣板字串／可選鏈。`src/` 底下既有檔案一律如此，必須沿用。
- 模組型式：`(function () { 'use strict'; ... window.Xxx = { ... }; })();`，不得改成 ES module。
- 中文用語一律繁體中文。
- 驗證腳本放在 `scripts/`，檔名 `verify-<feature>.mjs`，可用 `node scripts/<name>.mjs` 直接執行，結尾以失敗數決定 exit code。
- headless Chrome 路徑取 `process.env.CHROME_PATH`，預設 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`；CDP port 取 `process.env.CDP_PORT`，本計畫預設 `9344`（避開其他腳本用的 9342）。
- `--user-data-dir` 使用 `/tmp/iess-maintenance-period-profile`。
- 保養區間顯示格式固定為 `第3次 7-9月`；無區間顯示 `—`。
- 「保養日期」未填時顯示空字串（不是 `—`、不是 `未定`）。
- 篩選列 UI（開始月份／結束月份／客戶名稱／公司區域／保養狀態／搜尋鈕）不得改動，只改比對邏輯。

---

### Task 1: `ScheduleUtils` 區間解析函式

**Files:**
- Modify: `src/features/scheduling/schedule-utils.js`（在 `resolveMaintenanceStatus` 之前新增函式；並在檔尾 `window.ScheduleUtils` 匯出區加入三個新鍵）
- Test: `scripts/verify-maintenance-period-column.mjs`（新建）

**Interfaces:**
- Consumes: `CustomerUtils.getPeriods(customers, customerName)`（回傳依 `visitIndex` 排序、且只含起訖月皆為 1–12 的「可用」區間，形如 `{ visitIndex, startMonth, endMonth }`）、`CustomerUtils.findPeriodForMonth(customers, customerName, month)`（回傳單一區間或 `null`）、`ScheduleUtils.resolveMaintenanceReferenceDate(maintenanceCase)`（回傳 `planDate`，否則 `dueMonth + '-01'`，否則 `''`）。
- Produces:
  - `ScheduleUtils.resolveCasePeriod(maintenanceCase, customers)` → `{ year: number, visitIndex: number, startMonth: number, endMonth: number }` 或 `null`
  - `ScheduleUtils.formatPeriodRange(period)` → `string`（`'第3次 7-9月'` 或 `'—'`）
  - `ScheduleUtils.periodMonthRange(period)` → `{ start: 'YYYY-MM', end: 'YYYY-MM' }` 或 `null`

- [ ] **Step 1: 寫失敗的測試**

新建 `scripts/verify-maintenance-period-column.mjs`：

```javascript
#!/usr/bin/env node
/**
 * 「保養計劃進度：保養區間欄位與區間驅動排程」驗證腳本。
 * Section 1 以 node:vm 載入 IIFE 模組做純函式驗證；
 * Section 2 以後為 headless Chrome + CDP 的 UI 驗證。
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
const SU = sandbox.ScheduleUtils;

const CUSTOMERS = [
  { id: 'C1', name: '甲客戶', serviceLevel: 'A 保修(一年四次)', enabled: true, periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 3 },
    { visitIndex: 2, startMonth: 4, endMonth: 6 },
    { visitIndex: 3, startMonth: 7, endMonth: 9 },
    { visitIndex: 4, startMonth: 10, endMonth: 12 }
  ] },
  { id: 'C2', name: '乙客戶', serviceLevel: 'D 維修(無簽約客戶)', enabled: true, periods: [] },
  { id: 'C3', name: '丙客戶', serviceLevel: 'B 保修(一年兩次)', enabled: false, periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 6 },
    { visitIndex: 2, startMonth: 7, endMonth: 12 }
  ] }
];

console.log('Section 1｜ScheduleUtils.resolveCasePeriod');
assertDeep(SU.resolveCasePeriod(
  { customerName: '甲客戶', periodYear: 2026, periodVisitIndex: 3 }, CUSTOMERS),
  { year: 2026, visitIndex: 3, startMonth: 7, endMonth: 9 },
  '有 periodYear/periodVisitIndex 時直接查客戶區間');
assertDeep(SU.resolveCasePeriod(
  { customerName: '甲客戶', planDate: '2026-08-15' }, CUSTOMERS),
  { year: 2026, visitIndex: 3, startMonth: 7, endMonth: 9 },
  '舊案件用 planDate 月份回推區間');
assertDeep(SU.resolveCasePeriod(
  { customerName: '甲客戶', dueMonth: '2026-05' }, CUSTOMERS),
  { year: 2026, visitIndex: 2, startMonth: 4, endMonth: 6 },
  '無 planDate 時用 dueMonth 回推');
assertDeep(SU.resolveCasePeriod(
  { customerName: '甲客戶', planDate: '2026-08-15', periodYear: 2026, periodVisitIndex: 1 }, CUSTOMERS),
  { year: 2026, visitIndex: 1, startMonth: 1, endMonth: 3 },
  '案件自帶區間身分時優先於日期回推');
assertEq(SU.resolveCasePeriod(
  { customerName: '乙客戶', planDate: '2026-08-15' }, CUSTOMERS), null,
  '客戶無區間時回 null');
assertEq(SU.resolveCasePeriod(
  { customerName: '甲客戶' }, CUSTOMERS), null,
  '既無區間身分也無日期時回 null');
assertEq(SU.resolveCasePeriod(
  { customerName: '甲客戶', periodYear: 2026, periodVisitIndex: 9 }, CUSTOMERS), null,
  '區間身分在客戶設定中找不到時回 null');
assertEq(SU.resolveCasePeriod(null, CUSTOMERS), null, '案件為 null 回 null');

console.log('\nSection 1｜ScheduleUtils.formatPeriodRange');
assertEq(SU.formatPeriodRange({ year: 2026, visitIndex: 3, startMonth: 7, endMonth: 9 }),
  '第3次 7-9月', '格式為「第3次 7-9月」');
assertEq(SU.formatPeriodRange({ year: 2026, visitIndex: 1, startMonth: 1, endMonth: 12 }),
  '第1次 1-12月', '整年區間');
assertEq(SU.formatPeriodRange(null), '—', 'null 回破折號');

console.log('\nSection 1｜ScheduleUtils.periodMonthRange');
assertDeep(SU.periodMonthRange({ year: 2026, visitIndex: 3, startMonth: 7, endMonth: 9 }),
  { start: '2026-07', end: '2026-09' }, '起訖月補零成 YYYY-MM');
assertDeep(SU.periodMonthRange({ year: 2026, visitIndex: 4, startMonth: 10, endMonth: 12 }),
  { start: '2026-10', end: '2026-12' }, '兩位數月份不補零');
assertEq(SU.periodMonthRange(null), null, 'null 回 null');

console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node scripts/verify-maintenance-period-column.mjs`
Expected: FAIL — `TypeError: SU.resolveCasePeriod is not a function`

- [ ] **Step 3: 寫最小實作**

在 `src/features/scheduling/schedule-utils.js` 中，於 `function resolveMaintenanceStatus(` 之前插入：

```javascript
  function padMonth(month) {
    return String(month).length < 2 ? '0' + month : String(month);
  }

  /**
   * 解析一筆保養案件所屬的保養區間。
   * 優先用案件自帶的 periodYear / periodVisitIndex（區間身分），
   * 舊案件沒有這兩個欄位時，退回用 planDate（或 dueMonth）的年月回推。
   * 客戶未設定區間、或月份落在所有區間之外時回 null。
   */
  function resolveCasePeriod(maintenanceCase, customers) {
    if (!maintenanceCase) return null;
    var customerName = maintenanceCase.customerName;
    var year = Number(maintenanceCase.periodYear) || 0;
    var visitIndex = Number(maintenanceCase.periodVisitIndex) || 0;

    if (year && visitIndex) {
      var found = CustomerUtils.getPeriods(customers, customerName).find(function (p) {
        return p.visitIndex === visitIndex;
      });
      if (!found) return null;
      return {
        year: year,
        visitIndex: visitIndex,
        startMonth: found.startMonth,
        endMonth: found.endMonth
      };
    }

    var refDate = resolveMaintenanceReferenceDate(maintenanceCase);
    if (!refDate) return null;
    var refYear = parseInt(String(refDate).slice(0, 4), 10);
    var refMonth = parseInt(String(refDate).slice(5, 7), 10);
    if (!refYear || !refMonth) return null;
    var period = CustomerUtils.findPeriodForMonth(customers, customerName, refMonth);
    if (!period) return null;
    return {
      year: refYear,
      visitIndex: period.visitIndex,
      startMonth: period.startMonth,
      endMonth: period.endMonth
    };
  }

  function formatPeriodRange(period) {
    if (!period) return '—';
    return '第' + period.visitIndex + '次 ' + period.startMonth + '-' + period.endMonth + '月';
  }

  function periodMonthRange(period) {
    if (!period) return null;
    return {
      start: period.year + '-' + padMonth(period.startMonth),
      end: period.year + '-' + padMonth(period.endMonth)
    };
  }
```

在檔尾 `window.ScheduleUtils = {` 物件中，`resolveMaintenanceStatus: resolveMaintenanceStatus,` 之後加入：

```javascript
    resolveCasePeriod: resolveCasePeriod,
    formatPeriodRange: formatPeriodRange,
    periodMonthRange: periodMonthRange,
```

- [ ] **Step 4: 執行測試確認通過**

Run: `node scripts/verify-maintenance-period-column.mjs`
Expected: PASS，`通過 14／失敗 0`

- [ ] **Step 5: Commit**

```bash
git add src/features/scheduling/schedule-utils.js scripts/verify-maintenance-period-column.mjs
git commit -m "feat: add maintenance period resolution helpers to ScheduleUtils"
```

---

### Task 2: 保養單改為區間驅動產生

**Files:**
- Modify: `src/features/scheduling/schedule-utils.js`（重寫 `generateDueMaintenanceCases`；新增 `backfillCasePeriods`；刪除 `addMonthsToMonth`）
- Modify: `src/app.js:92`（呼叫端參數調整）
- Test: `scripts/verify-maintenance-period-column.mjs`（在 Section 1 尾端、`console.log(\`\n通過 ...\`)` 之前追加）

**Interfaces:**
- Consumes: Task 1 的 `resolveCasePeriod`；`CustomerUtils.findPeriodForMonth`；`StoreUtils.buildFullAddress(store)`。
- Produces:
  - `ScheduleUtils.generateDueMaintenanceCases(customers, stores, existingCases, referenceMonth)` → 新的保養案件陣列。`referenceMonth` 為選填的 `'YYYY-MM'`，省略時取當月（測試用的注入點）。**簽章不再有 `serviceLevels`。**
  - 產生／回填出來的案件帶有 `periodYear: number`、`periodVisitIndex: number`、`dueMonth: 'YYYY-MM'`（區間起始月）。

- [ ] **Step 1: 寫失敗的測試**

在 `scripts/verify-maintenance-period-column.mjs` 中，`console.log(`\n通過 ${passed}／失敗 ${failed}`);` 這行之前插入：

```javascript
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

function generatedFor(cases, storeName) {
  return cases.filter(function (c) { return c.storeName === storeName; });
}

console.log('\nSection 1｜generateDueMaintenanceCases（區間驅動）');
const gen1 = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, [], '2026-08');
assertEq(generatedFor(gen1, '甲一店').length, 1, '沒有上次保養日期的正常營業門市也會建單');
assertEq(generatedFor(gen1, '甲一店')[0].periodYear, 2026, '帶入 periodYear');
assertEq(generatedFor(gen1, '甲一店')[0].periodVisitIndex, 3, '8 月對到第 3 次區間');
assertEq(generatedFor(gen1, '甲一店')[0].dueMonth, '2026-07', 'dueMonth 為區間起始月');
assertEq(generatedFor(gen1, '甲一店')[0].status, '未保養', '新建單狀態為未保養');
assertEq(generatedFor(gen1, '甲一店')[0].planDate, '', '新建單沒有保養日期');
assertEq(generatedFor(gen1, '甲已撤店').length, 0, '非正常營業門市不建單');
assertEq(generatedFor(gen1, '乙一店').length, 0, '客戶未設定區間時不建單');
assertEq(generatedFor(gen1, '丙一店').length, 0, '停用客戶不建單');

const gen2 = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, gen1, '2026-08');
assertEq(generatedFor(gen2, '甲一店').length, 1, '同一區間重複執行不會重複建單');

const gen3 = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, gen1, '2026-11');
assertEq(generatedFor(gen3, '甲一店').length, 2, '進入第 4 次區間會重新建一筆');
assertEq(generatedFor(gen3, '甲一店')[1].periodVisitIndex, 4, '新建的那筆屬第 4 次');

const doneCase = [{
  id: 'M1', customerName: '甲客戶', storeName: '甲一店', status: '已完成',
  isClosed: true, planDate: '2026-08-05', periodYear: 2026, periodVisitIndex: 3
}];
const gen4 = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, doneCase, '2026-08');
assertEq(generatedFor(gen4, '甲一店').length, 1, '同區間已完成結案時不重複建單');
const gen5 = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, doneCase, '2026-11');
assertEq(generatedFor(gen5, '甲一店').length, 2, '上一區間已完成，下一區間仍重新建一筆');

console.log('\nSection 1｜舊案件區間回填');
const legacy = [{
  id: 'M9', customerName: '甲客戶', storeName: '甲二店', status: '未保養',
  planDate: '', dueMonth: '2026-05'
}];
const gen6 = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, legacy, '2026-08');
const backfilled = gen6.find(function (c) { return c.id === 'M9'; });
assertEq(backfilled.periodYear, 2026, '舊案件回填 periodYear');
assertEq(backfilled.periodVisitIndex, 2, '舊案件依 dueMonth 回填第 2 次');
assertEq(generatedFor(gen6, '甲二店').length, 2, '舊案件屬第 2 次，8 月仍會為第 3 次建一筆');
const legacyNoPeriod = [{
  id: 'M8', customerName: '乙客戶', storeName: '乙一店', status: '未保養',
  planDate: '', dueMonth: '2026-05'
}];
const gen7 = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, legacyNoPeriod, '2026-08');
assertEq(gen7.find(function (c) { return c.id === 'M8'; }).periodVisitIndex, undefined,
  '客戶無區間時舊案件回填不動');

assertEq(typeof SU.addMonthsToMonth, 'undefined', 'addMonthsToMonth 已移除');
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node scripts/verify-maintenance-period-column.mjs`
Expected: FAIL — 甲一店在 `'2026-08'` 下不會建單（現行需要 `lastMaintenanceDate`），且 `periodYear` 為 `undefined`

- [ ] **Step 3: 寫最小實作**

在 `src/features/scheduling/schedule-utils.js` 中，把整個 `function addMonthsToMonth(...)`（含註解）刪除，並把整個 `function generateDueMaintenanceCases(customers, stores, existingCases, serviceLevels) { ... }` 換成：

```javascript
  /**
   * 為既有保養案件補上區間身分（periodYear / periodVisitIndex）。
   * 用 planDate（或 dueMonth）的年月回推客戶區間；查不到就原樣保留，
   * 該筆案件之後不會被以區間為準的月份篩選命中。
   */
  function backfillCasePeriods(existingCases, customers) {
    return (existingCases || []).map(function (c) {
      if (!c) return c;
      if (Number(c.periodYear) && Number(c.periodVisitIndex)) return c;
      var period = resolveCasePeriod(c, customers);
      if (!period) return c;
      return Object.assign({}, c, {
        periodYear: period.year,
        periodVisitIndex: period.visitIndex
      });
    });
  }

  /**
   * 依客戶的保養區間產生保養單：每個門市在「參考月份所在的區間」各一筆。
   * 不論上一個區間是否完成，進入下一個區間都會重新建一筆。
   * referenceMonth 為選填的 'YYYY-MM'，省略時取當月。
   */
  function generateDueMaintenanceCases(customers, stores, existingCases, referenceMonth) {
    var refMonth = referenceMonth || new Date().toISOString().slice(0, 7);
    var refYear = parseInt(String(refMonth).slice(0, 4), 10);
    var monthNumber = parseInt(String(refMonth).slice(5, 7), 10);
    var result = backfillCasePeriods(existingCases, customers);
    if (!refYear || !monthNumber) return result;

    var customerMap = {};
    (customers || []).forEach(function (c) { customerMap[c.name] = c; });

    (stores || []).forEach(function (store) {
      if (store.storeStatus !== '正常營業') return;
      var cust = customerMap[store.customerName];
      if (!cust || cust.enabled === false) return;

      var period = CustomerUtils.findPeriodForMonth(customers, store.customerName, monthNumber);
      if (!period) return;

      var exists = result.some(function (m) {
        return m
          && m.customerName === store.customerName
          && m.storeName === store.storeName
          && Number(m.periodYear) === refYear
          && Number(m.periodVisitIndex) === period.visitIndex;
      });
      if (exists) return;

      result.push({
        id: 'M' + Date.now() + String(Math.floor(Math.random() * 10000)),
        caseNumber: '',
        customerName: store.customerName,
        storeName: store.storeName,
        companyCity: store.companyCity,
        companyDistrict: store.companyDistrict,
        serviceLevel: store.serviceLevel,
        status: '未保養',
        planDate: '',
        planTimeStart: '',
        planTimeEnd: '',
        dueMonth: refYear + '-' + padMonth(period.startMonth),
        periodYear: refYear,
        periodVisitIndex: period.visitIndex,
        workCategory: '保養',
        assignee: '尚未指派',
        isClosed: false,
        storeAddress: StoreUtils.buildFullAddress(store)
      });
    });
    return result;
  }
```

`src/app.js:92` 改為（同時更新上方註解，因為已不再依服務等級的每年保養次數）：

```javascript
    // 僅在 store 建構時執行一次：之後編輯客戶的保養區間不會回頭重新產生保養案件
    // （這是記憶體版 demo 可接受的限制，需重新整理頁面才會依最新設定重算）
    maintenanceCases: ScheduleUtils.generateDueMaintenanceCases(INITIAL_CUSTOMERS, INITIAL_STORES, INITIAL_MAINTENANCE_CASES),
```

- [ ] **Step 4: 執行測試確認通過**

Run: `node scripts/verify-maintenance-period-column.mjs`
Expected: PASS，全部通過、`失敗 0`

- [ ] **Step 5: 確認死碼已清乾淨**

Run: `grep -rn "addMonthsToMonth" src/ && echo FOUND || echo CLEAN`
Expected: 印出 `CLEAN`

Run: `grep -n "generateDueMaintenanceCases" src/app.js`
Expected: 只有一處，且引數為三個（`INITIAL_CUSTOMERS, INITIAL_STORES, INITIAL_MAINTENANCE_CASES`）

- [ ] **Step 6: Commit**

```bash
git add src/features/scheduling/schedule-utils.js src/app.js scripts/verify-maintenance-period-column.mjs
git commit -m "feat: generate maintenance cases per customer maintenance period"
```

---

### Task 3: 列表新增保養區間欄、清空保養日期、改用區間篩選

**Files:**
- Modify: `src/features/repair/maintenance.js`（`MaintenanceList`：`filteredCases` 的月份比對、表頭、`colspan`、資料列）
- Test: `scripts/verify-maintenance-period-column.mjs`（追加 headless Chrome CDP 段）

**Interfaces:**
- Consumes: Task 1 的 `ScheduleUtils.resolveCasePeriod` / `formatPeriodRange` / `periodMonthRange`；`MaintenanceList` 既有的 `props.customers`（已存在，不需新增 prop）。
- Produces: 無新對外介面。

- [ ] **Step 1: 寫失敗的測試**

在 `scripts/verify-maintenance-period-column.mjs` 中，把結尾的

```javascript
console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
```

換成下列 CDP 區段：

```javascript
// ---------- headless Chrome 區段 ----------
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9344);
if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-maintenance-period-profile',
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

  // 導覽到「保養計劃進度」
  await evaluate(`(function () {
    var links = Array.prototype.slice.call(document.querySelectorAll('button, a, div'));
    var target = links.filter(function (el) {
      return el.textContent.trim() === '保養計劃進度';
    }).pop();
    if (target) target.click();
    return !!target;
  })()`);
  await sleep(1200);

  console.log('\nSection 2｜列表欄位');
  assertEq(consoleErrors.length, 0, '載入與導覽時無 JS 錯誤');
  const headers = await evaluate(`Array.prototype.map.call(
    document.querySelectorAll('table thead th'),
    function (th) { return th.textContent.trim(); })`);
  assertTrue(headers.indexOf('保養區間') >= 0, '表頭有「保養區間」欄', JSON.stringify(headers));
  assertEq(headers.indexOf('保養區間'), headers.indexOf('工項類別') + 1,
    '「保養區間」緊接在「工項類別」之後');
  assertEq(headers.indexOf('保養日期'), headers.indexOf('保養區間') + 1,
    '「保養日期」緊接在「保養區間」之後');
  assertEq(await evaluate(`document.querySelectorAll('table thead th').length`), 14,
    '表頭共 14 欄');

  console.log('\nSection 2｜保養區間內容與保養日期留白');
  const rows = await evaluate(`(function () {
    var headerCells = Array.prototype.map.call(
      document.querySelectorAll('table thead th'),
      function (th) { return th.textContent.trim(); });
    var periodIdx = headerCells.indexOf('保養區間');
    var dateIdx = headerCells.indexOf('保養日期');
    var customerIdx = headerCells.indexOf('客戶名稱');
    var storeIdx = headerCells.indexOf('門市名稱');
    return Array.prototype.map.call(
      document.querySelectorAll('table tbody tr'),
      function (tr) {
        var tds = tr.querySelectorAll('td');
        if (tds.length < 14) return null;
        return {
          customer: tds[customerIdx].textContent.trim(),
          store: tds[storeIdx].textContent.trim(),
          period: tds[periodIdx].textContent.trim(),
          planDate: tds[dateIdx].textContent
        };
      }).filter(Boolean);
  })()`);
  assertTrue(rows.length > 0, '列表有資料列', `共 ${rows.length} 列`);
  assertTrue(rows.every(r => /^第\d+次 \d{1,2}-\d{1,2}月$/.test(r.period)),
    '每列保養區間格式皆為「第N次 X-Y月」',
    JSON.stringify(rows.map(r => r.period)));
  assertTrue(rows.every(r => !/未保養/.test(r.planDate)),
    '保養日期欄不再出現「（未保養）」');
  assertTrue(rows.every(r => r.planDate === '' || /^\d{4}-\d{2}-\d{2}$/.test(r.planDate)),
    '保養日期欄若無日期則為空字串',
    JSON.stringify(rows.map(r => r.planDate)));

  console.log('\nSection 2｜當月區間涵蓋的未完成案件會出現');
  // app 的 store 沒有掛在 window 上，改用同一組 seed 重算一份等價結果比對
  const expected = await evaluate(`(function () {
    var month = new Date().getMonth() + 1;
    var year = new Date().getFullYear();
    var period = CustomerUtils.findPeriodForMonth(INITIAL_CUSTOMERS, '屈臣氏', month);
    if (!period) return null;
    var all = ScheduleUtils.generateDueMaintenanceCases(
      INITIAL_CUSTOMERS, INITIAL_STORES, INITIAL_MAINTENANCE_CASES);
    var cases = all.filter(function (c) {
      return !c.isClosed && c.customerName === '屈臣氏'
        && Number(c.periodYear) === year
        && Number(c.periodVisitIndex) === period.visitIndex;
    });
    return {
      label: '第' + period.visitIndex + '次 ' + period.startMonth + '-' + period.endMonth + '月',
      stores: cases.map(function (c) { return c.storeName; })
    };
  })()`);
  assertTrue(expected && expected.stores.length > 0,
    '屈臣氏在當月區間有未結案的保養單', JSON.stringify(expected));
  assertTrue(expected.stores.every(name => rows.some(
    r => r.customer === '屈臣氏' && r.store === name && r.period === expected.label)),
    '這些門市都出現在列表且區間顯示為當月區間', expected.label);

  console.log('\nSection 2｜區間不涵蓋所選月份的案件不出現');
  const hidden = await evaluate(`(function () {
    var month = new Date().getMonth() + 1;
    var periods = CustomerUtils.getPeriods(INITIAL_CUSTOMERS, '屈臣氏');
    return periods.filter(function (p) {
      return p.startMonth > month || p.endMonth < month;
    }).map(function (p) {
      return '第' + p.visitIndex + '次 ' + p.startMonth + '-' + p.endMonth + '月';
    });
  })()`);
  assertTrue(hidden.every(label => !rows.some(r => r.period === label)),
    '其他區間的案件不出現在當月清單', JSON.stringify(hidden));
  assertEq(consoleErrors.length, 0, '操作後仍無 JS 錯誤');
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}

console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node scripts/verify-maintenance-period-column.mjs`
Expected: FAIL — `表頭有「保養區間」欄` 失敗、欄數為 13、保養日期欄仍出現「（未保養）」

- [ ] **Step 3: 寫最小實作**

在 `src/features/repair/maintenance.js` 的 `MaintenanceList` 內：

(a) 在 `return stateful(function (rerender) {` 之後、`function handleSearch()` 之前加入輔助函式：

```javascript
      function getCasePeriod(c) {
        return ScheduleUtils.resolveCasePeriod(c, customers);
      }

      // 案件所屬區間的年月起訖，是否與篩選的月份範圍重疊。
      // 篩選欄位可被清空，空字串視為該側無限制。
      function matchesPeriodMonthFilter(c) {
        var range = ScheduleUtils.periodMonthRange(getCasePeriod(c));
        if (!range) return false;
        if (appliedFilters.start && range.end < appliedFilters.start) return false;
        if (appliedFilters.end && range.start > appliedFilters.end) return false;
        return true;
      }
```

(b) 把 `filteredCases` 中這三行：

```javascript
        var caseMonth = (c.planDate && c.planDate.slice(0, 7)) || c.dueMonth || '';
        if (caseMonth && (caseMonth < appliedFilters.start || caseMonth > appliedFilters.end)) return false;
        if (!caseMonth && c.status !== '未保養') return false;
```

換成：

```javascript
        if (!matchesPeriodMonthFilter(c)) return false;
```

(c) 表頭：在 `}, "工項類別"), h("th", {` 之後的 `className: "p-3 font-semibold"\n      }, "保養日期")` 之前插入一欄，也就是把

```javascript
      }, "工項類別"), h("th", {
        className: "p-3 font-semibold"
      }, "保養日期"), h("th", {
```

改為

```javascript
      }, "工項類別"), h("th", {
        className: "p-3 font-semibold"
      }, "保養區間"), h("th", {
        className: "p-3 font-semibold"
      }, "保養日期"), h("th", {
```

(d) 空列 `colspan`：把 `colspan: "13",` 改為 `colspan: "14",`。

(e) 資料列：把

```javascript
        }, c.workCategory || '保養'), h("td", {
          className: "p-3"
        }, c.planDate || (c.dueMonth ? c.dueMonth + '（未保養）' : '未定')), h("td", {
```

改為

```javascript
        }, c.workCategory || '保養'), h("td", {
          className: "p-3"
        }, ScheduleUtils.formatPeriodRange(getCasePeriod(c))), h("td", {
          className: "p-3"
        }, c.planDate || ''), h("td", {
```

- [ ] **Step 4: 執行測試確認通過**

Run: `node scripts/verify-maintenance-period-column.mjs`
Expected: PASS，Section 1 與 Section 2 全數通過、`失敗 0`

- [ ] **Step 5: Commit**

```bash
git add src/features/repair/maintenance.js scripts/verify-maintenance-period-column.mjs
git commit -m "feat: show maintenance period column and filter by period in progress list"
```

---

### Task 4: 明細頁「目前保養季度」改讀同一份區間資料

**Files:**
- Modify: `src/features/repair/maintenance.js`（`MaintenanceViewEditForm` 的 `getMaintenancePeriodLabel`）
- Test: `scripts/verify-maintenance-period-column.mjs`（在 Section 2 的 `assertEq(consoleErrors.length, 0, '操作後仍無 JS 錯誤');` 之前追加 Section 3）

**Interfaces:**
- Consumes: Task 1 的 `ScheduleUtils.resolveCasePeriod`。
- Produces: 無新對外介面。

- [ ] **Step 1: 寫失敗的測試**

在 `scripts/verify-maintenance-period-column.mjs` 的 `assertEq(consoleErrors.length, 0, '操作後仍無 JS 錯誤');` 之前插入：

```javascript
  console.log('\nSection 3｜明細頁目前保養季度');
  await evaluate(`(function () {
    var btn = document.querySelector('table tbody tr button[title="編輯"]');
    if (btn) btn.click();
    return !!btn;
  })()`);
  await sleep(1000);
  const detail = await evaluate(`(function () {
    var labels = Array.prototype.slice.call(document.querySelectorAll('span'));
    var label = labels.filter(function (el) {
      return el.textContent.trim() === '目前保養季度';
    })[0];
    if (!label) return null;
    return label.parentNode.querySelector('div').textContent.trim();
  })()`);
  assertTrue(detail !== null, '明細頁有「目前保養季度」欄位');
  assertTrue(/^\d{4} 第\d+次（\d{1,2}-\d{1,2}月）$/.test(detail),
    '格式為「2026 第3次（7-9月）」', detail);
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node scripts/verify-maintenance-period-column.mjs`
Expected: FAIL — `格式為「2026 第3次（7-9月）」`，實際值為 `2026 第3次`（缺月份範圍）

- [ ] **Step 3: 寫最小實作**

在 `src/features/repair/maintenance.js` 的 `MaintenanceViewEditForm` 中，把

```javascript
    function getMaintenancePeriodLabel(c) {
      var refDate = ScheduleUtils.resolveMaintenanceReferenceDate(c);
      return ScheduleUtils.formatMaintenancePeriod(refDate, customers, c && c.customerName);
    }
```

換成

```javascript
    // 與列表的「保養區間」同源，避免兩處對不上
    function getMaintenancePeriodLabel(c) {
      var period = ScheduleUtils.resolveCasePeriod(c, customers);
      if (!period) return '';
      return period.year + ' 第' + period.visitIndex + '次（'
        + period.startMonth + '-' + period.endMonth + '月）';
    }
```

- [ ] **Step 4: 執行測試確認通過**

Run: `node scripts/verify-maintenance-period-column.mjs`
Expected: PASS，全部區段通過、`失敗 0`

- [ ] **Step 5: Commit**

```bash
git add src/features/repair/maintenance.js scripts/verify-maintenance-period-column.mjs
git commit -m "feat: show period month range in maintenance detail quarter field"
```

---

### Task 5: 更新 README 檔案結構說明

**Files:**
- Modify: `README.md`（`src/features/repair/` 區塊的 `maintenance.js` 說明行）

**Interfaces:**
- Consumes: 無。
- Produces: 無。

- [ ] **Step 1: 確認現況**

Run: `grep -n "maintenance.js" README.md`
Expected: 出現 `│   │   └── maintenance.js   保養計劃進度（列表 + 檢視／編輯）`

- [ ] **Step 2: 更新說明**

把該行改為：

```
│   │   └── maintenance.js   保養計劃進度（依客戶保養區間列示 + 檢視／編輯）
```

- [ ] **Step 3: 確認改動**

Run: `grep -n "保養區間列示" README.md`
Expected: 命中一行

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: note period-driven maintenance list in README"
```

---

## 備註：與 spec 的差異

`generateDueMaintenanceCases` 除了移除 `serviceLevels` 參數外，另加了選填的第四個參數 `referenceMonth`（`'YYYY-MM'`）。這是為了讓純函式測試能在不改系統時間的情況下驗證「跨區間重建」；省略時行為與 spec 一致（取當月）。`src/app.js` 的呼叫端不傳這個參數。
