# 保養區間改由客戶自訂 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「保養區間」從服務等級搬到客戶，讓每間客戶自訂各次保養落在哪幾個月。

**Architecture:** 服務等級只留 `name` / `maintenanceCount` / `countsBonusPoints`，回答「一年幾次、是否納入保養分配、是否計增額積分」；客戶新增 `periods`，回答「這幾次分別在哪幾個月」。區間查詢函式從 `ServiceLevelUtils` 搬到 `CustomerUtils`，改以客戶名稱查詢。搬遷順序為「先建新路徑 → 切換消費端 → 才拆舊路徑」，中途每一步都能開 `index.html` 正常操作。

**Tech Stack:** 原生 HTML / CSS / JavaScript（無 React、無建置步驟）。IIFE 模組掛在 `window`，由 `index.html` 依序 `<script>` 載入。驗證腳本為 Node ESM，用 `node:vm` 跑純函式、用 headless Chrome + CDP 跑 UI。

## Global Constraints

- 全部 ES5 語法：`var`、`function`，不用 `let`／`const`／箭頭函式／樣板字串。現有 `src/` 檔案皆如此，新程式碼必須一致。
- 每個模組都是 IIFE 加 `'use strict';`，最後 `window.XXX = {...}` 匯出。不使用 `import`／`export`。
- 不新增任何檔案到 `src/`。本次全部改動落在既有檔案。
- 中文文案一律繁體中文。`showToast(msg, type)` 只支援 `'success'`（預設）與 `'error'` 兩型。
- 區間物件形狀固定為 `{ visitIndex: <number>, startMonth: <number|''>, endMonth: <number|''> }`，`visitIndex` 從 1 起算。
- 不支援跨年區間（`startMonth <= endMonth`），與搬遷前一致。
- 錯誤訊息措辭沿用搬遷前：
  - `'第' + n + '次的起始月與結束月需為 1–12 月'`（注意是 U+2013 EN DASH `–`，不是 hyphen）
  - `'第' + n + '次的起始月不可大於結束月'`
  - `'第' + a + '次與第' + b + '次的保養區間重疊'`
  - `'保養區間筆數（' + x + '）與每年保養次數（' + y + '）不符'`
- 驗證腳本執行：`node scripts/<name>.mjs`。需要 Chrome，路徑預設 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`，可用 `CHROME_PATH` 覆寫。
- Commit 訊息格式：`feat:` / `refactor:` / `test:` / `docs:` 前綴加簡短英文描述。

## File Structure

| 檔案 | 本次責任 |
|---|---|
| `src/features/customer/customer-utils.js` | **新增**四支區間函式（`getPeriods`／`findPeriodForMonth`／`formatPeriodsLabel`／`validatePeriods`）與內部 `normalizePeriods` |
| `src/data/seed.js` | 客戶補 `periods`；服務等級移除 `periods` |
| `src/features/permissions/maintenance-allocation.js` | 區間查詢改吃 `customers` + `row.customerName` |
| `src/features/scheduling/schedule-utils.js` | `formatMaintenancePeriod` 換簽章 |
| `src/features/repair/maintenance.js` | `formatMaintenancePeriod` 呼叫點 |
| `src/features/scheduling/case-arrangement.js` | `formatMaintenancePeriod` 呼叫點 |
| `src/features/permissions/service-level-utils.js` | **移除** periods 相關函式與驗證規則 |
| `src/features/permissions/service-level-form.js` | **移除**保養區間區塊 |
| `src/features/permissions/service-level-list.js` | **移除**保養區間欄 |
| `src/features/customer/customer-form.js` | **新增**保養區間編輯區塊 |
| `src/features/customer/customer-list.js` | **新增**保養區間欄 |
| `src/app.js` | 客戶列表／表單三處 props 補 `serviceLevels` |
| `scripts/verify-customer-maintenance-periods.mjs` | **新建**本功能驗證腳本 |
| `scripts/verify-service-level-management.mjs` | 移除已搬走的 periods 斷言、fixture 補 `periods` |

---

### Task 1: CustomerUtils 區間函式

**Files:**
- Modify: `src/features/customer/customer-utils.js`
- Test: `scripts/verify-customer-maintenance-periods.mjs`（新建）

**Interfaces:**
- Consumes: 無
- Produces:
  - `CustomerUtils.getPeriods(customers, customerName)` → `Array<{visitIndex:number, startMonth:number|'', endMonth:number|''}>`，依 `visitIndex` 升冪；查無客戶或無 `periods` 回 `[]`
  - `CustomerUtils.findPeriodForMonth(customers, customerName, month)` → 區間物件或 `null`
  - `CustomerUtils.formatPeriodsLabel(customer)` → `string`，例 `'第1次 1-3月、第2次 4-6月'`；無區間回 `'—'`
  - `CustomerUtils.validatePeriods(periods, expectedCount)` → `Array<string>`，空陣列代表通過

- [ ] **Step 1: 建立驗證腳本骨架與失敗測試**

Create `scripts/verify-customer-maintenance-periods.mjs`：

```js
#!/usr/bin/env node
/**
 * 「保養區間改由客戶自訂」驗證腳本。
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
const CU = sandbox.CustomerUtils;

const CUSTOMERS = [
  { id: 'C1', name: '甲客戶', serviceLevel: 'A 保修(一年四次)', periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 3 },
    { visitIndex: 2, startMonth: 4, endMonth: 6 },
    { visitIndex: 3, startMonth: 7, endMonth: 9 },
    { visitIndex: 4, startMonth: 10, endMonth: 12 }
  ] },
  { id: 'C2', name: '乙客戶', serviceLevel: 'B 保修(一年兩次)', periods: [
    { visitIndex: 2, startMonth: 9, endMonth: 12 },
    { visitIndex: 1, startMonth: 3, endMonth: 8 }
  ] },
  { id: 'C3', name: '丙客戶', serviceLevel: 'D 維修(無簽約客戶)', periods: [] },
  { id: 'C4', name: '丁客戶', serviceLevel: 'B 保修(一年兩次)' }
];

console.log('Section 1｜CustomerUtils.getPeriods');
assertEq(CU.getPeriods(CUSTOMERS, '甲客戶').length, 4, '甲客戶有四個區間');
assertEq(CU.getPeriods(CUSTOMERS, '乙客戶')[0].visitIndex, 1, 'getPeriods 依 visitIndex 排序');
assertEq(CU.getPeriods(CUSTOMERS, '乙客戶')[0].startMonth, 3, '排序後第一筆為 3-8 月');
assertDeep(CU.getPeriods(CUSTOMERS, '丙客戶'), [], '無區間客戶回空陣列');
assertDeep(CU.getPeriods(CUSTOMERS, '丁客戶'), [], '缺 periods 欄位回空陣列');
assertDeep(CU.getPeriods(CUSTOMERS, '查無此客戶'), [], '查無客戶回空陣列');
assertDeep(CU.getPeriods(CUSTOMERS, ''), [], '空名稱回空陣列');
assertDeep(CU.getPeriods(null, '甲客戶'), [], 'customers 為 null 回空陣列');

console.log('\nSection 1｜CustomerUtils.findPeriodForMonth');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '甲客戶', 5).visitIndex, 2, '5 月落在甲的第 2 次');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '甲客戶', 4).visitIndex, 2, '起始月為含界');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '甲客戶', 6).visitIndex, 2, '結束月為含界');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '乙客戶', 1), null, '乙客戶 1 月不在任何區間');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '丙客戶', 5), null, '無區間客戶任何月份回 null');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '查無此客戶', 5), null, '查無客戶回 null');

console.log('\nSection 1｜CustomerUtils.formatPeriodsLabel');
assertEq(CU.formatPeriodsLabel(CUSTOMERS[1]), '第1次 3-8月、第2次 9-12月',
  'formatPeriodsLabel 依 visitIndex 排序輸出');
assertEq(CU.formatPeriodsLabel(CUSTOMERS[2]), '—', '無區間回 —');
assertEq(CU.formatPeriodsLabel(null), '—', 'null 客戶回 —');

console.log('\nSection 1｜CustomerUtils.validatePeriods');
assertDeep(CU.validatePeriods(CUSTOMERS[0].periods, 4), [], '完整四區間通過');
assertDeep(CU.validatePeriods([], 0), [], '次數 0 且無區間通過');
assertDeep(CU.validatePeriods([{ visitIndex: 1, startMonth: 1, endMonth: 6 }], 2),
  ['保養區間筆數（1）與每年保養次數（2）不符'], '筆數不符');
assertDeep(CU.validatePeriods([{ visitIndex: 1, startMonth: '', endMonth: 6 }], 1),
  ['第1次的起始月與結束月需為 1–12 月'], '起始月留空');
assertDeep(CU.validatePeriods([{ visitIndex: 1, startMonth: 0, endMonth: 6 }], 1),
  ['第1次的起始月與結束月需為 1–12 月'], '起始月 0 超出範圍');
assertDeep(CU.validatePeriods([{ visitIndex: 1, startMonth: 1, endMonth: 13 }], 1),
  ['第1次的起始月與結束月需為 1–12 月'], '結束月 13 超出範圍');
assertDeep(CU.validatePeriods([{ visitIndex: 1, startMonth: 8, endMonth: 3 }], 1),
  ['第1次的起始月不可大於結束月'], '起始月大於結束月');
assertDeep(CU.validatePeriods([
  { visitIndex: 1, startMonth: 1, endMonth: 6 },
  { visitIndex: 2, startMonth: 4, endMonth: 10 }
], 2), ['第1次與第2次的保養區間重疊'], '兩區間重疊');
assertDeep(CU.validatePeriods([
  { visitIndex: 1, startMonth: 1, endMonth: 6 },
  { visitIndex: 2, startMonth: 6, endMonth: 12 }
], 2), ['第1次與第2次的保養區間重疊'], '共用邊界月份視為重疊');
assertDeep(CU.validatePeriods([
  { visitIndex: 1, startMonth: 1, endMonth: 6 },
  { visitIndex: 2, startMonth: 7, endMonth: 12 }
], 2), [], '相鄰不重疊區間合法');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: 執行驗證腳本，確認失敗**

Run: `node scripts/verify-customer-maintenance-periods.mjs`
Expected: 大量 `✗`，因為 `CustomerUtils.getPeriods` 等尚未存在（`TypeError: CU.getPeriods is not a function`）。

- [ ] **Step 3: 實作四支函式**

在 `src/features/customer/customer-utils.js` 的 `window.CustomerUtils = {` 之前插入：

```js
  function toMonth(value) {
    if (value === '' || value === null || value === undefined) return '';
    var n = Number(value);
    return isNaN(n) ? '' : n;
  }

  function normalizePeriods(periods) {
    return (periods || []).map(function (p) {
      return {
        visitIndex: Number((p && p.visitIndex) || 0),
        startMonth: toMonth(p && p.startMonth),
        endMonth: toMonth(p && p.endMonth)
      };
    }).sort(function (a, b) { return a.visitIndex - b.visitIndex; });
  }

  function findCustomerByName(customers, name) {
    var target = String(name == null ? '' : name).trim();
    if (!target) return null;
    var found = (customers || []).find(function (c) {
      return c && String(c.name == null ? '' : c.name).trim() === target;
    });
    return found || null;
  }

  function getPeriods(customers, customerName) {
    var cust = findCustomerByName(customers, customerName);
    return cust ? normalizePeriods(cust.periods) : [];
  }

  function findPeriodForMonth(customers, customerName, month) {
    var m = Number(month);
    var found = getPeriods(customers, customerName).find(function (p) {
      return Number(p.startMonth) <= m && m <= Number(p.endMonth);
    });
    return found || null;
  }

  function formatPeriodsLabel(customer) {
    var periods = normalizePeriods(customer && customer.periods);
    if (!periods.length) return '—';
    return periods.map(function (p) {
      return '第' + p.visitIndex + '次 ' + p.startMonth + '-' + p.endMonth + '月';
    }).join('、');
  }

  /**
   * 客戶保養區間驗證。expectedCount 為該客戶服務等級的「每年保養次數」。
   * 回傳錯誤訊息陣列，空陣列代表通過。呼叫端只提醒、不擋下儲存。
   */
  function validatePeriods(periods, expectedCount) {
    var list = normalizePeriods(periods);
    var count = Number(expectedCount) || 0;
    var errors = [];

    if (list.length !== count) {
      errors.push('保養區間筆數（' + list.length + '）與每年保養次數（' + count + '）不符');
    }

    var monthsValid = true;
    list.forEach(function (p) {
      var s = p.startMonth;
      var e = p.endMonth;
      var sOk = typeof s === 'number' && Math.floor(s) === s && s >= 1 && s <= 12;
      var eOk = typeof e === 'number' && Math.floor(e) === e && e >= 1 && e <= 12;
      if (!sOk || !eOk) {
        monthsValid = false;
        errors.push('第' + p.visitIndex + '次的起始月與結束月需為 1–12 月');
      } else if (s > e) {
        monthsValid = false;
        errors.push('第' + p.visitIndex + '次的起始月不可大於結束月');
      }
    });

    if (monthsValid) {
      for (var i = 0; i < list.length; i++) {
        for (var j = i + 1; j < list.length; j++) {
          var a = list[i];
          var b = list[j];
          if (a.startMonth <= b.endMonth && b.startMonth <= a.endMonth) {
            errors.push('第' + a.visitIndex + '次與第' + b.visitIndex + '次的保養區間重疊');
          }
        }
      }
    }

    return errors;
  }
```

並把匯出改為：

```js
  window.CustomerUtils = {
    isEnabled: isEnabled,
    getEnabledCustomers: getEnabledCustomers,
    getCustomerNameOptions: getCustomerNameOptions,
    getServiceLevelByCustomerName: getServiceLevelByCustomerName,
    getPeriods: getPeriods,
    findPeriodForMonth: findPeriodForMonth,
    formatPeriodsLabel: formatPeriodsLabel,
    validatePeriods: validatePeriods
  };
```

檔頭註解由「客戶啟用狀態與下拉選單工具」改為「客戶啟用狀態、下拉選單與保養區間工具」。

- [ ] **Step 4: 執行驗證腳本，確認全過**

Run: `node scripts/verify-customer-maintenance-periods.mjs`
Expected: `36 passed, 0 failed`（數字以實際為準，重點是 `0 failed`）。

- [ ] **Step 5: Commit**

```bash
git add src/features/customer/customer-utils.js scripts/verify-customer-maintenance-periods.mjs
git commit -m "feat: add customer maintenance period helpers to CustomerUtils"
```

---

### Task 2: seed 客戶補上 periods

**Files:**
- Modify: `src/data/seed.js`
- Test: `scripts/verify-customer-maintenance-periods.mjs`

**Interfaces:**
- Consumes: `CustomerUtils.getPeriods`、`CustomerUtils.validatePeriods`（Task 1）
- Produces: `INITIAL_CUSTOMERS` 每筆都有 `periods`，內容對應其 `serviceLevel`

- [ ] **Step 1: 加上 headless Chrome 區段與失敗測試**

在 `scripts/verify-customer-maintenance-periods.mjs` 的最後兩行（`console.log(...passed...)` 與 `process.exit(...)`）**之前**插入：

```js
// ---------- headless Chrome 區段 ----------
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9342);
if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-customer-periods-profile',
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

  console.log('\nSection 2｜seed 客戶區間');
  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');
  assertTrue(await evaluate(`INITIAL_CUSTOMERS.every(function (c) {
    return Array.isArray(c.periods);
  })`), '每筆 seed 客戶都有 periods 陣列');
  assertTrue(await evaluate(`INITIAL_CUSTOMERS.every(function (c) {
    var count = ServiceLevelUtils.getMaintenanceCount(INITIAL_SERVICE_LEVELS, c.serviceLevel);
    return CustomerUtils.validatePeriods(c.periods, count).length === 0;
  })`), '每筆 seed 客戶的區間都通過驗證');
  assertDeep(await evaluate(`CustomerUtils.getPeriods(INITIAL_CUSTOMERS, '屈臣氏')`), [
    { visitIndex: 1, startMonth: 1, endMonth: 3 },
    { visitIndex: 2, startMonth: 4, endMonth: 6 },
    { visitIndex: 3, startMonth: 7, endMonth: 9 },
    { visitIndex: 4, startMonth: 10, endMonth: 12 }
  ], 'A 級客戶「屈臣氏」為四季區間');
  assertTrue(await evaluate(`(function(){
    return INITIAL_CUSTOMERS.filter(function (c) {
      return c.serviceLevel === 'B 保修(一年兩次)';
    }).every(function (c) {
      return c.periods.length === 2
        && c.periods[0].startMonth === 1 && c.periods[0].endMonth === 6
        && c.periods[1].startMonth === 7 && c.periods[1].endMonth === 12;
    });
  })()`), 'B 級客戶皆為 1-6／7-12 月');
  assertTrue(await evaluate(`(function(){
    return INITIAL_CUSTOMERS.filter(function (c) {
      return c.serviceLevel === 'C 保養(一年一次)';
    }).every(function (c) {
      return c.periods.length === 1
        && c.periods[0].startMonth === 1 && c.periods[0].endMonth === 12;
    });
  })()`), 'C 級客戶皆為 1-12 月單一區間');
  assertTrue(await evaluate(`(function(){
    return INITIAL_CUSTOMERS.filter(function (c) {
      return c.serviceLevel === 'D 維修(無簽約客戶)';
    }).every(function (c) { return c.periods.length === 0; });
  })()`), 'D 級客戶皆無區間');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}
```

- [ ] **Step 2: 執行，確認 Section 2 失敗**

Run: `node scripts/verify-customer-maintenance-periods.mjs`
Expected: Section 1 全過，Section 2 的「每筆 seed 客戶都有 periods 陣列」等為 `✗`。

- [ ] **Step 3: 在 seed 每筆客戶加上 periods**

在 `src/data/seed.js` 的 `INITIAL_CUSTOMERS` 中，為**每一筆**客戶物件加入 `periods` 欄位，放在 `serviceLevel` 之後。依該筆的 `serviceLevel` 選用下列四種之一：

```js
  // A 保修(一年四次)
  periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 3 },
    { visitIndex: 2, startMonth: 4, endMonth: 6 },
    { visitIndex: 3, startMonth: 7, endMonth: 9 },
    { visitIndex: 4, startMonth: 10, endMonth: 12 }
  ],
```

```js
  // B 保修(一年兩次)
  periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 6 },
    { visitIndex: 2, startMonth: 7, endMonth: 12 }
  ],
```

```js
  // C 保養(一年一次)
  periods: [{ visitIndex: 1, startMonth: 1, endMonth: 12 }],
```

```js
  // D 維修(無簽約客戶)
  periods: [],
```

用 `grep -n "serviceLevel" src/data/seed.js` 找出 `INITIAL_CUSTOMERS` 範圍內的每一行，逐筆對照加入。注意 `INITIAL_STORES`、案件、排程等其他集合的 `serviceLevel` **不要動**——只有 `INITIAL_CUSTOMERS` 需要 `periods`。

- [ ] **Step 4: 執行，確認全過**

Run: `node scripts/verify-customer-maintenance-periods.mjs`
Expected: `0 failed`。

- [ ] **Step 5: Commit**

```bash
git add src/data/seed.js scripts/verify-customer-maintenance-periods.mjs
git commit -m "feat: seed per-customer maintenance periods"
```

---

### Task 3: 保養分配改吃客戶區間

**Files:**
- Modify: `src/features/permissions/maintenance-allocation.js:76-78`、`:180-188`
- Test: `scripts/verify-customer-maintenance-periods.mjs`

**Interfaces:**
- Consumes: `CustomerUtils.findPeriodForMonth`、`CustomerUtils.getPeriods`（Task 1）；`INITIAL_CUSTOMERS[].periods`（Task 2）
- Produces: 無新介面。`getCustomerRows` 回傳的列結構不變（`{ customerName, storeCount, serviceLevel }`）

- [ ] **Step 1: 寫失敗測試**

在 `scripts/verify-customer-maintenance-periods.mjs` 的 `assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');` **之前**插入：

```js
  console.log('\nSection 3｜保養分配改吃客戶區間');
  // 保養分配的月份分段來源改為客戶：把某 B 級客戶的區間改成 3-8／9-2 之外的值後，
  // 該列的分段必須跟著變，而不是沿用服務等級。
  assertDeep(await evaluate(`(function(){
    var customers = [{ id: 'C1', name: '甲客戶', serviceLevel: 'B 保修(一年兩次)', periods: [
      { visitIndex: 1, startMonth: 2, endMonth: 5 },
      { visitIndex: 2, startMonth: 8, endMonth: 11 }
    ] }];
    return [
      CustomerUtils.findPeriodForMonth(customers, '甲客戶', 3).visitIndex,
      CustomerUtils.findPeriodForMonth(customers, '甲客戶', 9).visitIndex,
      CustomerUtils.findPeriodForMonth(customers, '甲客戶', 1),
      CustomerUtils.findPeriodForMonth(customers, '甲客戶', 12)
    ];
  })()`), [1, 2, null, null], '客戶自訂區間決定月份歸屬，區間外回 null');
  assertTrue(await evaluate(
    `/CustomerUtils\\.getPeriods/.test(String(MaintenanceAllocation))`
  ), '保養分配的分段來源改用 CustomerUtils.getPeriods');
  assertTrue(await evaluate(
    `/CustomerUtils\\.findPeriodForMonth/.test(String(MaintenanceAllocation))`
  ), '保養分配的月份查詢改用 CustomerUtils.findPeriodForMonth');
  assertTrue(await evaluate(
    `!/ServiceLevelUtils\\.(getPeriods|findPeriodForMonth)/.test(String(MaintenanceAllocation))`
  ), '保養分配不再呼叫 ServiceLevelUtils 的區間函式');
```

- [ ] **Step 2: 執行，確認失敗**

Run: `node scripts/verify-customer-maintenance-periods.mjs`
Expected: Section 3 的後三條為 `✗`（保養分配仍呼叫 `ServiceLevelUtils`）。

- [ ] **Step 3: 改寫保養分配**

`src/features/permissions/maintenance-allocation.js`，`openEditModal` 內：

```js
    function openEditModal(row, month) {
      var period = CustomerUtils.findPeriodForMonth(customers, row.customerName, month);
      if (!period) {
        showToast('此月份不在該客戶的保養區間內', 'error');
        return false;
      }
```

`buildSegmentMap` 內：

```js
      // 依該列客戶的保養區間，建出「月份 → { period, order }」的對照
      function buildSegmentMap(row) {
        var map = {};
        CustomerUtils.getPeriods(customers, row.customerName).forEach(function (p, order) {
          for (var m = Number(p.startMonth); m <= Number(p.endMonth); m++) {
            map[m] = { period: p, order: order };
          }
        });
        return map;
      }
```

確認檔案開頭已有 `var customers = props.customers;`（保養分配已用 customers 呼叫 `getCustomerRows`）；若沒有就補上。

- [ ] **Step 4: 執行，確認全過**

Run: `node scripts/verify-customer-maintenance-periods.mjs`
Expected: `0 failed`。

- [ ] **Step 5: 人工確認畫面未變**

開啟 `index.html` → 系統權限 → 保養分配，選任一指派人員。區段底色、左右邊框、`第N次 已完成/負責` 標記應與改動前一致。點非區間月份應跳「此月份不在該客戶的保養區間內」。

- [ ] **Step 6: Commit**

```bash
git add src/features/permissions/maintenance-allocation.js scripts/verify-customer-maintenance-periods.mjs
git commit -m "refactor: drive maintenance allocation segments from customer periods"
```

---

### Task 4: formatMaintenancePeriod 換簽章

**Files:**
- Modify: `src/features/scheduling/schedule-utils.js:230-247`
- Modify: `src/features/repair/maintenance.js:334-339`
- Modify: `src/features/scheduling/case-arrangement.js:723-727`
- Test: `scripts/verify-customer-maintenance-periods.mjs`

**Interfaces:**
- Consumes: `CustomerUtils.findPeriodForMonth`（Task 1）
- Produces: `ScheduleUtils.formatMaintenancePeriod(dateStr, customers, customerName)` → `string`，例 `'2026 第2次'`；查無區間回 `'2026'`；`dateStr` 為空回 `''`

- [ ] **Step 1: 寫失敗測試**

在 `scripts/verify-customer-maintenance-periods.mjs` 的 `assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');` **之前**插入：

```js
  console.log('\nSection 4｜formatMaintenancePeriod 改吃客戶區間');
  await evaluate(`window.__PERIOD_CUSTOMERS = [
    { id: 'C1', name: '甲客戶', periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 } ] },
    { id: 'C2', name: '丙客戶', periods: [] }
  ];`);
  assertEq(await evaluate(
    `ScheduleUtils.formatMaintenancePeriod('2026-05-10', window.__PERIOD_CUSTOMERS, '甲客戶')`),
    '2026 第2次', '5 月為甲客戶的第 2 次');
  assertEq(await evaluate(
    `ScheduleUtils.formatMaintenancePeriod('2026-11-01', window.__PERIOD_CUSTOMERS, '甲客戶')`),
    '2026 第4次', '11 月為甲客戶的第 4 次');
  assertEq(await evaluate(
    `ScheduleUtils.formatMaintenancePeriod('2026-08-01', window.__PERIOD_CUSTOMERS, '丙客戶')`),
    '2026', '無區間客戶只回年份');
  assertEq(await evaluate(
    `ScheduleUtils.formatMaintenancePeriod('2026-05-10', window.__PERIOD_CUSTOMERS, '查無此客戶')`),
    '2026', '查無客戶只回年份');
  assertEq(await evaluate(
    `ScheduleUtils.formatMaintenancePeriod('', window.__PERIOD_CUSTOMERS, '甲客戶')`),
    '', '無日期回空字串');
  assertTrue(await evaluate(
    `!/ServiceLevelUtils\\.findPeriodForMonth/.test(String(ScheduleUtils.formatMaintenancePeriod))`
  ), 'formatMaintenancePeriod 不再呼叫 ServiceLevelUtils.findPeriodForMonth');
```

- [ ] **Step 2: 執行，確認失敗**

Run: `node scripts/verify-customer-maintenance-periods.mjs`
Expected: Section 4 為 `✗`（舊簽章第二參數是 `serviceLevels`，傳客戶陣列查不到，會回純年份或錯值）。

- [ ] **Step 3: 改寫 schedule-utils.js**

```js
  // 目前保養季度：依客戶的保養區間，回傳「YYYY 第N次」；客戶無區間或查無客戶時只回年份
  function formatMaintenancePeriod(dateStr, customers, customerName) {
    if (!dateStr) return '';
    var year = parseInt(String(dateStr).slice(0, 4), 10);
    var month = parseInt(String(dateStr).slice(5, 7), 10);
    if (!year || !month) return '';
    var period = CustomerUtils.findPeriodForMonth(customers, customerName, month);
    if (!period) return String(year);
    return year + ' 第' + period.visitIndex + '次';
  }
```

- [ ] **Step 4: 改寫 maintenance.js 呼叫點**

`src/features/repair/maintenance.js` 的 `getMaintenancePeriodLabel`：

```js
    function getMaintenancePeriodLabel(c) {
      var refDate = ScheduleUtils.resolveMaintenanceReferenceDate(c);
      return ScheduleUtils.formatMaintenancePeriod(refDate, customers, c && c.customerName);
    }
```

若該函式所在作用域上方已宣告的 `var level = ...`／`var serviceLevels = ...` 只服務於此處而變成未使用，一併刪除；若 `serviceLevels` 仍被同檔其他地方使用則保留。

- [ ] **Step 5: 改寫 case-arrangement.js 呼叫點**

`src/features/scheduling/case-arrangement.js` 的 `renderMaintenanceScheduleDetails`：

```js
        var periodLabel = ScheduleUtils.formatMaintenancePeriod(
          refDate, customers, formData.customerName);
```

同樣清掉因此不再使用的 `var levelName = ...`；若 `levelName` 在同函式其他地方仍被使用（例如顯示服務等級欄位）則保留。

- [ ] **Step 6: 執行，確認全過**

Run: `node scripts/verify-customer-maintenance-periods.mjs`
Expected: `0 failed`。

- [ ] **Step 7: 人工確認**

開啟 `index.html` → 維修服務 → 保養進度，開任一保養案件的檢視，「目前保養季度」欄位應顯示 `YYYY 第N次`。再到案件排程開保養案件，同欄位同樣正常。

- [ ] **Step 8: Commit**

```bash
git add src/features/scheduling/schedule-utils.js src/features/repair/maintenance.js src/features/scheduling/case-arrangement.js scripts/verify-customer-maintenance-periods.mjs
git commit -m "refactor: resolve maintenance period label from customer periods"
```

---

### Task 5: 移除服務等級的 periods

**Files:**
- Modify: `src/features/permissions/service-level-utils.js`
- Modify: `src/features/permissions/service-level-form.js`
- Modify: `src/features/permissions/service-level-list.js`
- Modify: `src/data/seed.js`（`INITIAL_SERVICE_LEVELS`）
- Test: `scripts/verify-customer-maintenance-periods.mjs`、`scripts/verify-service-level-management.mjs`

**Interfaces:**
- Consumes: 無
- Produces: `ServiceLevelUtils.normalizeRecord(record)` → `{ name, maintenanceCount, countsBonusPoints }`（不再有 `periods`）；`ServiceLevelUtils` 不再匯出 `getPeriods`／`findPeriodForMonth`／`formatPeriodsLabel`

- [ ] **Step 1: 寫失敗測試**

在 `scripts/verify-customer-maintenance-periods.mjs` 的 `assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');` **之前**插入：

```js
  console.log('\nSection 5｜服務等級不再持有區間');
  assertTrue(await evaluate(`INITIAL_SERVICE_LEVELS.every(function (sl) {
    return !('periods' in sl);
  })`), 'INITIAL_SERVICE_LEVELS 已無 periods 欄位');
  assertEq(await evaluate(`typeof ServiceLevelUtils.getPeriods`), 'undefined',
    'ServiceLevelUtils.getPeriods 已移除');
  assertEq(await evaluate(`typeof ServiceLevelUtils.findPeriodForMonth`), 'undefined',
    'ServiceLevelUtils.findPeriodForMonth 已移除');
  assertEq(await evaluate(`typeof ServiceLevelUtils.formatPeriodsLabel`), 'undefined',
    'ServiceLevelUtils.formatPeriodsLabel 已移除');
  assertDeep(await evaluate(
    `Object.keys(ServiceLevelUtils.normalizeRecord({ name: ' X ', maintenanceCount: '2' }))`),
    ['name', 'maintenanceCount', 'countsBonusPoints'], 'normalizeRecord 不再回 periods');
  assertDeep(await evaluate(
    `ServiceLevelUtils.validate({ name: 'X', maintenanceCount: 2 }, [], undefined)`),
    [], 'validate 不再要求區間筆數');
  assertDeep(await evaluate(
    `ServiceLevelUtils.validate({ name: '', maintenanceCount: 1 }, [], undefined)`),
    ['服務等級名稱為必填'], 'validate 仍檢查名稱必填');
  assertDeep(await evaluate(
    `ServiceLevelUtils.validate({ name: 'X', maintenanceCount: -1 }, [], undefined)`),
    ['每年保養次數需為 0 或正整數'], 'validate 仍檢查次數');
  assertTrue(await evaluate(`String(ServiceLevelForm).indexOf('保養區間') === -1`),
    '服務等級表單已無「保養區間」區塊');
  // COLUMNS 宣告在 ServiceLevelList 之外，故改以實際渲染出的表頭判斷
  assertTrue(await evaluate(`(function(){
    var container = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(ServiceLevelList({
      serviceLevels: INITIAL_SERVICE_LEVELS,
      setServiceLevels: function () {},
      customers: [], stores: [], cases: [], maintenanceCases: [],
      projectCases: [], surveyCases: [], personnelStatus: [],
      setEditingCase: function () {}, setView: function () {}, showToast: function () {}
    }));
    var headers = Array.prototype.map.call(container.querySelectorAll('thead th'),
      function (th) { return th.textContent.trim(); });
    container.remove();
    return headers.indexOf('保養區間') === -1;
  })()`), '服務等級列表已無「保養區間」欄');
```

- [ ] **Step 2: 執行，確認失敗**

Run: `node scripts/verify-customer-maintenance-periods.mjs`
Expected: Section 5 全為 `✗`。

- [ ] **Step 3: 精簡 service-level-utils.js**

- 刪除 `toMonth`、`normalizePeriods`、`getPeriods`、`findPeriodForMonth`、`formatPeriodsLabel` 五個函式。
- `normalizeRecord` 改為：

```js
  function normalizeRecord(record) {
    return {
      name: toName(record && record.name),
      maintenanceCount: Number((record && record.maintenanceCount) || 0),
      countsBonusPoints: !!(record && record.countsBonusPoints)
    };
  }
```

- `validate` 改為（刪掉筆數／月份／重疊三段）：

```js
  function validate(record, serviceLevels, excludeId) {
    var n = normalizeRecord(record);
    var errors = [];

    if (!n.name) errors.push('服務等級名稱為必填');

    var duplicated = (serviceLevels || []).some(function (sl) {
      return sl.id !== excludeId && toName(sl.name) === n.name;
    });
    if (n.name && duplicated) errors.push('服務等級名稱「' + n.name + '」已存在');

    var count = n.maintenanceCount;
    if (!isFinite(count) || Math.floor(count) !== count || count < 0) {
      errors.push('每年保養次數需為 0 或正整數');
    }

    return errors;
  }
```

- 匯出移除 `getPeriods`、`findPeriodForMonth`、`formatPeriodsLabel` 三行。
- 檔頭註解改為：

```js
/*
 * features/permissions/service-level-utils.js — 服務等級工具函式
 *
 * 服務等級是「每年保養次數」與「是否計算增額積分」的唯一資料來源；
 * 保養區間改由各客戶自行設定（見 features/customer/customer-utils.js）。
 * 客戶／門市／案件存的是服務等級「名稱字串」，故改名時需以 renameServiceLevel 連帶同步。
 */
```

- [ ] **Step 4: 精簡 service-level-form.js**

- 刪除 `MONTH_OPTIONS` 常數、`resizePeriods` 函式、`var periods = resizePeriods(...)` 宣告、`renderPeriodRows` 函式、`handleMonthChange` 函式。
- `buildRecord` 移除 `periods: periods` 一行。
- `handleCountChange` 移除呼叫 `resizePeriods` 的那一行，只留 `formData.maintenanceCount = e.target.value;` 與 `rerender();`。
- 刪除 render 中的整塊：

```js
          h('div', { className: 'mt-8' },
            h('h3', { className: 'text-sm font-bold text-gray-700 border-b pb-2 mb-4' }, '保養區間'),
            renderPeriodRows()
          ),
```

- 在「每年保養次數」欄位的 `h('div', null, ...)` 內、`h('input', {...})` 之後補一行說明，取代原本次數為 0 時的區塊提示：

```js
              h('p', { className: 'text-xs text-gray-500 mt-1' },
                Number(formData.maintenanceCount) > 0
                  ? '各次的月份區間由各客戶在「客戶管理」自行設定'
                  : '此服務等級不納入保養分配')
```

- [ ] **Step 5: 精簡 service-level-list.js**

- `COLUMNS` 陣列刪除 `{ key: 'periods', label: '保養區間' }` 一項（表頭、資料格、「無資料」列的 `colspan` 皆由 `COLUMNS` 推導，不需另外改）。
- `renderCellText` 刪除 `if (key === 'periods') return ServiceLevelUtils.formatPeriodsLabel(record);` 一行。

- [ ] **Step 6: 從 seed 移除服務等級的 periods**

`src/data/seed.js` 的 `INITIAL_SERVICE_LEVELS` 四筆各刪除 `periods` 欄位（含 SL004 的 `periods: []`）。其餘欄位不變。

- [ ] **Step 7: 修既有驗證腳本**

`scripts/verify-service-level-management.mjs`：

- `LEVELS` fixture 四筆刪除 `periods` 欄位。
- 刪除 `Section 1｜ServiceLevelUtils 查詢函式` 中的 `getPeriods`（3 條）與 `findPeriodForMonth`（4 條）斷言。`isAllocatable` 三條保留。
- 刪除 `Section 1｜normalizeRecord / formatPeriodsLabel` 中的 `normalizeRecord periods 依 visitIndex 排序`、`normalizeRecord 月份轉數字`、兩條 `formatPeriodsLabel`，並把該 `console.log` 標題改為 `'\nSection 1｜normalizeRecord'`。`normalizeRecord` 的 fixture 移除 `periods`。
- 刪除 `Section 1｜validate` 中所有帶 `periods` 的斷言（筆數不符、月份範圍、起大於訖、重疊、共用邊界、相鄰合法共 8 條左右），保留名稱與次數相關的斷言。
- `Section 6｜formatMaintenancePeriod 改吃服務等級` 整段刪除（該行為已移到新腳本的 Section 4 驗證）。
- 其他 Section 若有以 `INITIAL_SERVICE_LEVELS` 的 `periods` 為前提的斷言（用 `grep -n "periods" scripts/verify-service-level-management.mjs` 掃一遍），改為引用 `INITIAL_CUSTOMERS` 的區間或刪除。

- [ ] **Step 8: 兩支腳本都跑，確認全過**

Run:
```bash
node scripts/verify-customer-maintenance-periods.mjs && node scripts/verify-service-level-management.mjs
```
Expected: 兩支皆 `0 failed`。

- [ ] **Step 9: 人工確認**

開啟 `index.html` → 系統權限 → 服務等級管理。列表無「保養區間」欄；點編輯，表單只剩名稱／每年保養次數／是否計算增額積分，次數欄下方有說明文字；儲存正常。

- [ ] **Step 10: Commit**

```bash
git add src/features/permissions/service-level-utils.js src/features/permissions/service-level-form.js src/features/permissions/service-level-list.js src/data/seed.js scripts/verify-customer-maintenance-periods.mjs scripts/verify-service-level-management.mjs
git commit -m "refactor: drop maintenance periods from service level"
```

---

### Task 6: 客戶表單的保養區間編輯

**Files:**
- Modify: `src/features/customer/customer-form.js`
- Modify: `src/app.js:436-443`（`customer-add`／`customer-edit` 兩處 props）
- Test: `scripts/verify-customer-maintenance-periods.mjs`

**Interfaces:**
- Consumes: `CustomerUtils.validatePeriods`（Task 1）、`ServiceLevelUtils.getMaintenanceCount`
- Produces: 客戶記錄新增 `periods` 欄位，由表單寫入

- [ ] **Step 1: 寫失敗測試**

在 `scripts/verify-customer-maintenance-periods.mjs` 的 `assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');` **之前**插入：

```js
  console.log('\nSection 6｜客戶表單保養區間');
  // 直接掛載 CustomerForm 到暫時容器，避開主畫面導覽
  const formProbe = await evaluate(`(function(){
    var container = document.createElement('div');
    document.body.appendChild(container);
    window.__customerSaved = null;
    window.__toasts = [];
    var node = CustomerForm({
      cases: INITIAL_CUSTOMERS,
      setCases: function (next) { window.__customerSaved = next[0] || null; },
      targetCase: null,
      serviceLevels: INITIAL_SERVICE_LEVELS,
      setView: function () {},
      showToast: function (msg, type) { window.__toasts.push({ msg: msg, type: type }); }
    });
    container.appendChild(node);
    window.__formContainer = container;
    var selects = container.querySelectorAll('select[name^="startMonth-"]');
    return {
      hasSection: container.textContent.indexOf('保養區間') !== -1,
      startCount: selects.length,
      endCount: container.querySelectorAll('select[name^="endMonth-"]').length
    };
  })()`);
  assertTrue(formProbe.hasSection, '客戶表單有「保養區間」區塊');
  assertEq(formProbe.startCount, 4, '預設服務等級（A，4 次）渲染 4 列起始月');
  assertEq(formProbe.endCount, 4, '同樣渲染 4 列結束月');

  const afterSwitch = await evaluate(`(function(){
    var container = window.__formContainer;
    var levelSelect = container.querySelector('select[name="serviceLevel"]');
    levelSelect.value = 'B 保修(一年兩次)';
    levelSelect.dispatchEvent(new Event('change', { bubbles: true }));
    return container.querySelectorAll('select[name^="startMonth-"]').length;
  })()`);
  assertEq(afterSwitch, 2, '切換到 B（2 次）後只剩 2 列');

  const afterZero = await evaluate(`(function(){
    var container = window.__formContainer;
    var levelSelect = container.querySelector('select[name="serviceLevel"]');
    levelSelect.value = 'D 維修(無簽約客戶)';
    levelSelect.dispatchEvent(new Event('change', { bubbles: true }));
    return {
      rows: container.querySelectorAll('select[name^="startMonth-"]').length,
      hint: container.textContent.indexOf('此服務等級不納入保養分配') !== -1
    };
  })()`);
  assertEq(afterZero.rows, 0, '次數 0 時不渲染區間列');
  assertTrue(afterZero.hint, '次數 0 時顯示「此服務等級不納入保養分配」');

  const saveResult = await evaluate(`(function(){
    var container = window.__formContainer;
    var levelSelect = container.querySelector('select[name="serviceLevel"]');
    levelSelect.value = 'B 保修(一年兩次)';
    levelSelect.dispatchEvent(new Event('change', { bubbles: true }));
    var nameInput = container.querySelector('input[name="name"]');
    nameInput.value = '測試客戶';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    nameInput.dispatchEvent(new Event('change', { bubbles: true }));
    window.__toasts = [];
    container.querySelector('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }));
    return {
      saved: !!window.__customerSaved,
      periods: window.__customerSaved && window.__customerSaved.periods,
      toasts: window.__toasts.slice()
    };
  })()`);
  assertTrue(saveResult.saved, '區間留空仍可儲存（不擋下）');
  assertEq(saveResult.periods.length, 2, '儲存的客戶帶有 2 筆區間');
  assertTrue(saveResult.toasts.some(t => t.type === 'error'
    && t.msg.indexOf('1–12 月') !== -1), '區間未填完整時跳提醒 toast');

  const saveValid = await evaluate(`(function(){
    var container = window.__formContainer;
    // 每次 change 都會觸發重繪換掉節點，故每步都重新查詢
    function setSel(selector, index, v) {
      var el = container.querySelectorAll(selector)[index];
      el.value = String(v);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setSel('select[name^="startMonth-"]', 0, 1);
    setSel('select[name^="endMonth-"]', 0, 6);
    setSel('select[name^="startMonth-"]', 1, 7);
    setSel('select[name^="endMonth-"]', 1, 12);
    window.__toasts = [];
    container.querySelector('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }));
    return {
      periods: window.__customerSaved && window.__customerSaved.periods,
      hasError: window.__toasts.some(function (t) { return t.type === 'error'; })
    };
  })()`);
  assertDeep(saveValid.periods, [
    { visitIndex: 1, startMonth: 1, endMonth: 6 },
    { visitIndex: 2, startMonth: 7, endMonth: 12 }
  ], '填完整後儲存的區間為數字月份');
  assertTrue(!saveValid.hasError, '區間合法時不跳錯誤 toast');

  await evaluate(`(function(){
    window.__formContainer.remove();
    window.__formContainer = null;
    return true;
  })()`);
```

- [ ] **Step 2: 執行，確認失敗**

Run: `node scripts/verify-customer-maintenance-periods.mjs`
Expected: Section 6 為 `✗`（客戶表單尚無保養區間區塊）。

- [ ] **Step 3: 實作客戶表單區間編輯**

`src/features/customer/customer-form.js`：

檔頭 props 註解改為：

```js
/*
 * features/customer/customer-form.js — 客戶建檔：新增/編輯客戶表單
 * props: { cases, setCases, serviceLevels, setView, showToast, targetCase }
 */
```

在 IIFE 頂層（`function CustomerForm(props) {` 之前）加入：

```js
  var MONTH_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // 依服務等級的「每年保養次數」增減區間列：增加補空白列，減少砍尾端，已填的前段保留
  function resizePeriods(periods, count) {
    var next = periods.slice(0, count);
    for (var i = next.length; i < count; i++) {
      next.push({ visitIndex: i + 1, startMonth: '', endMonth: '' });
    }
    return next.map(function (p, i) {
      return { visitIndex: i + 1, startMonth: p.startMonth, endMonth: p.endMonth };
    });
  }
```

在 `CustomerForm` 內、`var contacts = ...` 之後加入：

```js
    var serviceLevels = props.serviceLevels || [];

    function expectedPeriodCount(levelName) {
      return ServiceLevelUtils.getMaintenanceCount(serviceLevels, levelName);
    }

    var periods = resizePeriods(
      ((targetCase && targetCase.periods) || []).map(function (p) {
        return { visitIndex: p.visitIndex, startMonth: p.startMonth, endMonth: p.endMonth };
      }),
      expectedPeriodCount(formData.serviceLevel)
    );
```

在 `stateful(function (rerender) {` 內、`handleChange` 之後加入：

```js
      function handleServiceLevelChange(e) {
        formData.serviceLevel = e.target.value;
        periods = resizePeriods(periods, expectedPeriodCount(formData.serviceLevel));
        rerender();
      }
      function handleMonthChange(index, key, value) {
        periods[index][key] = value === '' ? '' : Number(value);
        rerender();
      }
      function renderPeriodRows() {
        if (!periods.length) {
          return h('p', { className: 'text-sm text-gray-500 bg-gray-50 border rounded-md p-4' },
            '此服務等級不納入保養分配');
        }
        return h('div', { className: 'space-y-3' },
          periods.map(function (p, index) {
            var n = index + 1;
            return h('div', { key: n, className: 'flex flex-wrap items-center gap-3' },
              h('span', { className: 'w-16 text-sm text-gray-700' }, '第 ' + n + ' 次'),
              h('select', {
                name: 'startMonth-' + n,
                value: p.startMonth === '' ? '' : String(p.startMonth),
                onChange: function (e) { handleMonthChange(index, 'startMonth', e.target.value); },
                className: 'w-28 p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white'
              },
                h('option', { value: '' }, '起始月'),
                MONTH_OPTIONS.map(function (m) {
                  return h('option', { key: m, value: String(m) }, m + '月');
                })
              ),
              h('span', { className: 'text-gray-400' }, '～'),
              h('select', {
                name: 'endMonth-' + n,
                value: p.endMonth === '' ? '' : String(p.endMonth),
                onChange: function (e) { handleMonthChange(index, 'endMonth', e.target.value); },
                className: 'w-28 p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white'
              },
                h('option', { value: '' }, '結束月'),
                MONTH_OPTIONS.map(function (m) {
                  return h('option', { key: m, value: String(m) }, m + '月');
                })
              )
            );
          })
        );
      }
```

`handleSubmit` 改為（區間錯誤只提醒、不擋下；名稱必填仍擋）：

```js
      function handleSubmit(e) {
        e.preventDefault();
        if (!formData.name.trim()) {
          showToast('客戶名稱為必填', 'error');
          return;
        }
        var periodErrors = CustomerUtils.validatePeriods(
          periods, expectedPeriodCount(formData.serviceLevel));
        if (isEdit) {
          setCases(cases.map(function (c) {
            return c.id === targetCase.id
              ? Object.assign({}, c, formData, { contacts: contacts, periods: periods })
              : c;
          }));
          showToast('客戶資料更新成功');
        } else {
          var newCustomer = Object.assign({ id: 'CUST' + Date.now() }, formData, {
            contacts: contacts,
            periods: periods,
            createdDate: todayDate
          });
          setCases([newCustomer].concat(cases));
          showToast('客戶新增成功');
        }
        if (periodErrors.length) {
          showToast(periodErrors[0], 'error');
        }
        setView('customer-list');
      }
```

服務等級下拉的 `onChange` 由 `handleChange` 改為 `handleServiceLevelChange`。

在「基本資料」那個 `grid` 區塊**之後**、承辦人區塊之前，插入保養區間區塊：

```js
          h('div', null,
            h('h3', { className: 'font-semibold text-lg text-blue-800 border-b pb-2 mb-4' }, '保養區間'),
            renderPeriodRows()
          ),
```

（放在 `h('div', { className: 'space-y-6' },` 的直接子層，與基本資料 grid 同層。）

- [ ] **Step 4: app.js 傳入 serviceLevels**

`src/app.js`：

```js
      case 'customer-add':
        return h(CustomerForm, {
          cases: s.customers, setCases: setCustomers, serviceLevels: s.serviceLevels,
          setView: setView, showToast: showToast
        });
      case 'customer-edit':
        return h(CustomerForm, {
          cases: s.customers, setCases: setCustomers, targetCase: s.editingCase,
          serviceLevels: s.serviceLevels, setView: setView, showToast: showToast
        });
```

- [ ] **Step 5: 執行，確認全過**

Run: `node scripts/verify-customer-maintenance-periods.mjs`
Expected: `0 failed`。

- [ ] **Step 6: 人工確認**

開啟 `index.html` → 客戶建檔 → 客戶管理 → 編輯「屈臣氏」。應看到「保養區間」四列且已帶入 1-3／4-6／7-9／10-12。把服務等級改成 B，列數變 2；改成 D，區塊變成「此服務等級不納入保養分配」。清掉一個月份後儲存，應存得下去並跳紅色提醒。

- [ ] **Step 7: Commit**

```bash
git add src/features/customer/customer-form.js src/app.js scripts/verify-customer-maintenance-periods.mjs
git commit -m "feat: edit maintenance periods per customer in customer form"
```

---

### Task 7: 客戶列表的保養區間欄

**Files:**
- Modify: `src/features/customer/customer-list.js`
- Modify: `src/app.js:431-435`（`customer-list` props）
- Test: `scripts/verify-customer-maintenance-periods.mjs`

**Interfaces:**
- Consumes: `CustomerUtils.formatPeriodsLabel`、`CustomerUtils.validatePeriods`（Task 1）、`ServiceLevelUtils.getMaintenanceCount`
- Produces: 無新介面

- [ ] **Step 1: 寫失敗測試**

在 `scripts/verify-customer-maintenance-periods.mjs` 的 `assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');` **之前**插入：

```js
  console.log('\nSection 7｜客戶列表保養區間欄');
  const listProbe = await evaluate(`(function(){
    var container = document.createElement('div');
    document.body.appendChild(container);
    var customers = [
      { id: 'C1', name: '完整客戶', serviceLevel: 'B 保修(一年兩次)', enabled: true,
        createdDate: '2026-01-01', periods: [
          { visitIndex: 1, startMonth: 1, endMonth: 6 },
          { visitIndex: 2, startMonth: 7, endMonth: 12 } ] },
      { id: 'C2', name: '缺漏客戶', serviceLevel: 'B 保修(一年兩次)', enabled: true,
        createdDate: '2026-01-02', periods: [
          { visitIndex: 1, startMonth: 1, endMonth: 6 } ] },
      { id: 'C3', name: '免區間客戶', serviceLevel: 'D 維修(無簽約客戶)', enabled: true,
        createdDate: '2026-01-03', periods: [] }
    ];
    container.appendChild(CustomerList({
      cases: customers,
      setCases: function () {},
      serviceLevels: INITIAL_SERVICE_LEVELS,
      setEditingCase: function () {},
      setView: function () {},
      showToast: function () {}
    }));
    var headers = Array.prototype.map.call(
      container.querySelectorAll('thead th'), function (th) { return th.textContent.trim(); });
    var byName = {};
    Array.prototype.forEach.call(container.querySelectorAll('tbody tr'), function (tr) {
      var tds = tr.querySelectorAll('td');
      byName[tds[1].textContent.trim()] = tds[2].textContent.trim();
    });
    container.remove();
    return { headers: headers, byName: byName };
  })()`);
  assertTrue(listProbe.headers.indexOf('保養區間') !== -1, '客戶列表有「保養區間」欄');
  assertEq(listProbe.byName['完整客戶'], '第1次 1-6月、第2次 7-12月', '完整客戶顯示區間標籤');
  assertEq(listProbe.byName['缺漏客戶'], '區間未設完整', '筆數不符的客戶顯示提示');
  assertEq(listProbe.byName['免區間客戶'], '—', '次數 0 的客戶顯示破折號');
```

- [ ] **Step 2: 執行，確認失敗**

Run: `node scripts/verify-customer-maintenance-periods.mjs`
Expected: Section 7 為 `✗`。

- [ ] **Step 3: 實作列表欄位**

`src/features/customer/customer-list.js`：

檔頭 props 註解改為：

```js
/*
 * features/customer/customer-list.js — 客戶建檔：客戶列表
 * props: { cases, setCases, serviceLevels, setEditingCase, setView, showToast }
 */
```

在 `enabledBadge` 之後加入：

```js
  // 區間欄：驗證不過只標示、不阻擋（設定本身允許先存後補）
  function periodsCell(customer, serviceLevels) {
    var count = ServiceLevelUtils.getMaintenanceCount(serviceLevels, customer && customer.serviceLevel);
    var errors = CustomerUtils.validatePeriods(customer && customer.periods, count);
    if (errors.length) {
      return h('span', { className: 'text-red-600', title: errors[0] }, '區間未設完整');
    }
    return CustomerUtils.formatPeriodsLabel(customer);
  }
```

在 `var showToast = props.showToast;` 之後加入：

```js
    var serviceLevels = props.serviceLevels || [];
```

表頭在「客戶名稱」與「啟用狀態」之間插入一欄：

```js
                h('th', { className: 'p-3 font-semibold' }, '保養區間'),
```

資料列在客戶名稱格之後插入：

```js
                      h('td', { className: 'p-3' }, periodsCell(c, serviceLevels)),
```

「無資料」列的 `colspan: 3` 改為 `colspan: 4`。

- [ ] **Step 4: app.js 傳入 serviceLevels**

```js
      case 'customer-list':
        return h(CustomerList, {
          cases: s.customers, setCases: setCustomers, serviceLevels: s.serviceLevels,
          setEditingCase: setEditingCase, setView: setView, showToast: showToast
        });
```

- [ ] **Step 5: 執行，確認全過**

Run: `node scripts/verify-customer-maintenance-periods.mjs`
Expected: `0 failed`。

- [ ] **Step 6: 人工確認**

開啟 `index.html` → 客戶建檔 → 客戶管理。列表多出「保養區間」欄，A 級客戶顯示四段、D 級顯示 `—`。

- [ ] **Step 7: Commit**

```bash
git add src/features/customer/customer-list.js src/app.js scripts/verify-customer-maintenance-periods.mjs
git commit -m "feat: show maintenance periods column in customer list"
```

---

### Task 8: 全套驗證與文件收尾

**Files:**
- Modify: `README.md`（若有描述服務等級持有保養區間之處）
- Test: `scripts/` 下全部驗證腳本

**Interfaces:**
- Consumes: 前面所有 Task
- Produces: 無

- [ ] **Step 1: 掃出殘留引用**

Run:
```bash
grep -rn "ServiceLevelUtils.getPeriods\|ServiceLevelUtils.findPeriodForMonth\|ServiceLevelUtils.formatPeriodsLabel" src scripts
grep -rn "periods" src/features/permissions src/data/seed.js | grep -v INITIAL_CUSTOMERS
```
Expected: 第一條無輸出。第二條只應出現在 `INITIAL_CUSTOMERS` 相關處；若 `src/features/permissions` 仍有 `periods` 字樣，逐一確認是否為漏刪。

- [ ] **Step 2: 跑全部驗證腳本**

Run:
```bash
for f in scripts/verify-*.mjs; do echo "=== $f ==="; node "$f" || echo "FAILED: $f"; done
```
Expected: 每支都以 `0 failed` 收尾，無 `FAILED:` 行。若 `verify-equipment-level-*.mjs`、`verify-case-review-bonus-points.mjs` 等因客戶 fixture 缺 `periods` 而失敗，於該腳本的客戶 fixture 補上對應 `periods` 後重跑。

- [ ] **Step 3: 更新 README**

Run: `grep -n "保養區間\|服務等級" README.md`

若 README 的檔案結構說明提到服務等級管理包含保養區間，改述為「服務等級管理：每年保養次數／增額積分」，並在客戶管理的說明補上「含各次保養的月份區間」。若 README 沒提到，跳過本步。

- [ ] **Step 4: 人工全流程確認**

開啟 `index.html` 依序確認：

1. 系統權限 → 保養分配：選指派人員，各列分段與 `第N次 已完成/負責` 標記正常，點非區間月份跳提醒。
2. 客戶管理 → 編輯某 B 級客戶，把區間改成 3-8／9-12 並儲存；回保養分配，該列分段跟著變成 3-8／9-12。
3. 系統權限 → 服務等級管理：把 B 的每年保養次數改成 3 並儲存；回保養分配，既有 B 級客戶仍照自己的兩段顯示（不自動遷移）；進該客戶編輯頁，看到補出的第 3 列空白，儲存時跳提醒。
4. 維修服務 → 保養進度：案件檢視的「目前保養季度」顯示正常。
5. 全程瀏覽器 console 無錯誤。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: update references after moving maintenance periods to customers"
```
