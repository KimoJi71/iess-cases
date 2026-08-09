# 系統權限 — 服務等級管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在「系統權限」新增可 CRUD 的「服務等級管理」，並讓服務等級成為增額積分判定、保養次數／保養區間、客戶服務等級下拉的唯一資料來源。

**Architecture:** 沿用本專案的 classic-script + IIFE + `window.XxxUtils` 模式。新增 `ServiceLevelUtils`（純函式）、`ServiceLevelList`／`ServiceLevelForm`（UI），資料放 `INITIAL_SERVICE_LEVELS`（seed）並掛入 app store 的 `serviceLevels`。所有消費端（績效、銷案審核、保養分配、客戶／叫修／立案／排程表單、保養到期產生）改由 props 取得 `serviceLevels` 後查表，不再依賴寫死常數。

**Tech Stack:** 原生 JS（ES5 風格 IIFE，無打包器）、自製 `IESS.h` 虛擬 DOM、Tailwind CDN、Node `node:vm` 與 headless Chrome + CDP 驗證腳本（`scripts/verify-*.mjs`）。

## Global Constraints

- 無建置步驟、無 npm、無測試框架。「測試」＝ `scripts/verify-*.mjs`，用 `node scripts/xxx.mjs` 執行，全綠才算通過。
- 所有原始碼檔案為 classic script，寫成 `(function () { 'use strict'; … })();` 並把公開介面掛到 `window.X`。**不可**使用 `import`／`export`／ES module 語法。
- 新增的 `src/**.js` 檔案必須在 `index.html` 加入 `<script src>`，且順序要在依賴之後。
- 程式碼註解與 UI 文案一律繁體中文。
- 服務等級名稱字串（精確值，全專案一致）：
  - `A 保修(一年四次)`
  - `B 保修(一年兩次)`
  - `C 保養(一年一次)`
  - `D 維修(無簽約客戶)`
- `A 保修(一年一次)` 這個舊字串在完成後**不得**出現在 `src/` 或 `scripts/` 任何位置。
- `serviceLevels` 一律由 app store 經 props 傳入，元件不從全域直接讀取（與 `deviceCategories` 現行作法一致）。
- 顯示「無資料」的欄位用 `'—'`（em dash），與現有列表一致。

## 與 spec 的差異（實作時採用本計劃的裁決）

1. spec 提到 `PERMISSION_PAGES`，實際檔案裡沒有這個常數。實際要改的是 `src/data/options.js` 的 `PERMISSION_FUNCTIONS` 與 `PERMISSION_TREE`。
2. spec 說「移除客戶的 `maintenanceInterval`」，但除了 `customer-form.js` 外還有 **3 個** spec 未提及的消費端會壞掉：
   - `src/features/scheduling/schedule-utils.js:132` `generateDueMaintenanceCases()` — 用 `INTERVAL_MONTHS[cust.maintenanceInterval]` 算保養到期月。
   - `src/features/scheduling/schedule-utils.js:236` `formatMaintenancePeriod(dateStr, maintenanceInterval)` — 產生「目前保養季度」文字。
   - 上者的兩個呼叫端：`src/features/repair/maintenance.js:339`、`src/features/scheduling/case-arrangement.js:721`。

   本計劃 Task 6 明確處理：到期間隔改為 `Math.round(12 / 每年保養次數)`（次數 0 則不產生保養案件）；保養季度標籤改為服務等級區間的 `YYYY 第N次`。

---

## File Structure

### 新增

| 檔案 | 職責 |
|---|---|
| `src/features/permissions/service-level-utils.js` | `window.ServiceLevelUtils` — 服務等級的查詢／驗證／選項同步／改名同步。純函式，無 DOM。 |
| `src/features/permissions/service-level-list.js` | `window.ServiceLevelList` — 列表頁（搜尋／分頁／編輯／刪除確認）。 |
| `src/features/permissions/service-level-form.js` | `window.ServiceLevelForm` — 新增／編輯表單（含動態保養區間列）。 |
| `scripts/verify-service-level-management.mjs` | 本功能的驗證腳本，分 7 個 section，隨 Task 逐段長出來。 |

### 修改

| 檔案 | 變更摘要 |
|---|---|
| `src/data/seed.js` | 新增 `INITIAL_SERVICE_LEVELS`；`A 保修(一年一次)` → `A 保修(一年四次)`；customers 移除 `maintenanceInterval`。 |
| `src/data/options.js` | `SERVICE_LEVEL_OPTIONS` 改空陣列；刪 `MAINTENANCE_INTERVAL_OPTIONS`、`CUSTOMER_SERVICE_LEVEL_MAP`；`PERMISSION_FUNCTIONS`／`PERMISSION_TREE` 加「服務等級管理」。 |
| `src/app.js` | store 加 `serviceLevels`／`setServiceLevels`；啟動時 sync 選項；選單映射與 3 條 view 路由；往下傳 `serviceLevels`。 |
| `index.html` | 3 支新 script。 |
| `src/shell/permissions-sidebar.js` | 選單加「服務等級管理」。 |
| `src/features/reports/performance-utils.js` | 刪 `isServiceLevelCD`；`isBonusEligible` 改吃 `serviceLevels`。 |
| `src/features/repair/case-review.js` | `resolveReviewCaseBonusPoints` 補參數、props 加 `serviceLevels`。 |
| `src/features/customer/customer-utils.js` | 新增 `getServiceLevelByCustomerName`。 |
| `src/features/repair/case-form.js`、`src/features/project/project-form.js`、`src/features/scheduling/case-arrangement.js` | 5 處 `CUSTOMER_SERVICE_LEVEL_MAP` 改查 customers。 |
| `src/features/customer/customer-form.js` | 移除「保養區間」欄位；服務等級預設值改 `SERVICE_LEVEL_OPTIONS[0]`。 |
| `src/features/scheduling/schedule-utils.js` | `generateDueMaintenanceCases` 與 `formatMaintenancePeriod` 改吃 `serviceLevels`。 |
| `src/features/repair/maintenance.js` | 保養季度標籤改新簽章。 |
| `src/features/permissions/maintenance-allocation-utils.js` | 刪 `ALLOCATABLE_SERVICE_LEVELS`／`getVisitIndexOptions`；加 `countCompletedStores`；`getCustomerRows` 回 `serviceLevel`。 |
| `src/features/permissions/maintenance-allocation.js` | 區間上色與「已完成/負責」小字；Modal 唯讀次數。 |
| `scripts/verify-equipment-level-points.mjs` 等 4 支 | fixture 字串與 `isBonusEligible` 簽章更新。 |

---

## Task 1: 服務等級資料模型與工具函式

**Files:**
- Create: `src/features/permissions/service-level-utils.js`
- Create: `scripts/verify-service-level-management.mjs`
- Modify: `src/data/seed.js`（新增 `INITIAL_SERVICE_LEVELS`；`A 保修(一年一次)` 字串全換）
- Modify: `src/data/options.js:54-59`（`SERVICE_LEVEL_OPTIONS` 改空陣列）
- Modify: `index.html`（在 `device-category-utils.js` 之後、`seed.js` 之前加入 script）
- Modify: `src/app.js`（store 加 `serviceLevels`、`setServiceLevels`、啟動 sync）
- Modify: `scripts/verify-equipment-level-points.mjs`、`scripts/verify-equipment-level-ui.mjs`、`scripts/verify-equipment-level-surfaces.mjs`、`scripts/verify-case-review-bonus-points.mjs`（僅換 `A 保修(一年一次)` 字串）

**Interfaces:**
- Consumes: 全域 `SERVICE_LEVEL_OPTIONS`（`src/data/options.js`）。
- Produces:
  - `INITIAL_SERVICE_LEVELS: Array<{id, name, maintenanceCount, countsBonusPoints, periods: Array<{visitIndex, startMonth, endMonth}>}>`
  - `window.ServiceLevelUtils.normalizeRecord(record) -> {name, maintenanceCount, countsBonusPoints, periods}`
  - `.findByName(serviceLevels, name) -> record|null`
  - `.getMaintenanceCount(serviceLevels, name) -> number`
  - `.countsBonusPoints(serviceLevels, name) -> boolean`
  - `.getPeriods(serviceLevels, name) -> period[]`
  - `.findPeriodForMonth(serviceLevels, name, month) -> period|null`
  - `.isAllocatable(serviceLevels, name) -> boolean`
  - `.validate(record, serviceLevels, excludeId) -> string[]`
  - `.isServiceLevelInUse(name, customers, stores) -> boolean`
  - `.syncServiceLevelOptions(serviceLevels) -> void`
  - `.renameServiceLevel(oldName, newName, collections) -> {customers, stores, cases, maintenanceCases, changedCount}`
  - `.formatPeriodsLabel(record) -> string`
  - app store 欄位 `serviceLevels`，setter `setServiceLevels(v)`（v 可為值或 updater 函式）

- [ ] **Step 1: 寫失敗的測試 — 建立 `scripts/verify-service-level-management.mjs`（Section 1：純函式）**

建立檔案，內容如下（後續 Task 會往檔尾追加 section）：

```js
#!/usr/bin/env node
/**
 * 服務等級管理驗證腳本。
 * Section 1-3 以 node:vm 載入 IIFE 模組做純函式驗證；
 * Section 4-7 由後續 Task 追加（headless Chrome + CDP 的 UI 驗證）。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

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
const SLU = sandbox.ServiceLevelUtils;

// 與 seed 的 INITIAL_SERVICE_LEVELS 內容一致的 fixture
const LEVELS = [
  { id: 'SL001', name: 'A 保修(一年四次)', maintenanceCount: 4, countsBonusPoints: false,
    periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 }
    ] },
  { id: 'SL002', name: 'B 保修(一年兩次)', maintenanceCount: 2, countsBonusPoints: false,
    periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 6 },
      { visitIndex: 2, startMonth: 7, endMonth: 12 }
    ] },
  { id: 'SL003', name: 'C 保養(一年一次)', maintenanceCount: 1, countsBonusPoints: true,
    periods: [{ visitIndex: 1, startMonth: 1, endMonth: 12 }] },
  { id: 'SL004', name: 'D 維修(無簽約客戶)', maintenanceCount: 0, countsBonusPoints: true,
    periods: [] }
];

console.log('Section 1｜ServiceLevelUtils 查詢函式');
assertEq(SLU.findByName(LEVELS, 'B 保修(一年兩次)').id, 'SL002', 'findByName 命中');
assertEq(SLU.findByName(LEVELS, '  B 保修(一年兩次)  ').id, 'SL002', 'findByName 去頭尾空白');
assertEq(SLU.findByName(LEVELS, '不存在'), null, 'findByName 查無回 null');
assertEq(SLU.findByName(LEVELS, ''), null, 'findByName 空字串回 null');
assertEq(SLU.getMaintenanceCount(LEVELS, 'A 保修(一年四次)'), 4, 'getMaintenanceCount A 為 4');
assertEq(SLU.getMaintenanceCount(LEVELS, '不存在'), 0, 'getMaintenanceCount 查無回 0');
assertEq(SLU.countsBonusPoints(LEVELS, 'C 保養(一年一次)'), true, 'C 計算增額積分');
assertEq(SLU.countsBonusPoints(LEVELS, 'A 保修(一年四次)'), false, 'A 不計算增額積分');
assertEq(SLU.countsBonusPoints(LEVELS, '不存在'), false, 'countsBonusPoints 查無回 false');
assertEq(SLU.getPeriods(LEVELS, 'D 維修(無簽約客戶)').length, 0, 'D 無區間');
assertEq(SLU.getPeriods(LEVELS, '不存在').length, 0, 'getPeriods 查無回空陣列');
assertEq(SLU.getPeriods(
  [{ name: 'X', maintenanceCount: 2, periods: [
    { visitIndex: 2, startMonth: 7, endMonth: 12 },
    { visitIndex: 1, startMonth: 1, endMonth: 6 }] }], 'X'
)[0].visitIndex, 1, 'getPeriods 依 visitIndex 排序');
assertEq(SLU.findPeriodForMonth(LEVELS, 'A 保修(一年四次)', 5).visitIndex, 2, '5 月落在 A 的第 2 次');
assertEq(SLU.findPeriodForMonth(LEVELS, 'A 保修(一年四次)', 1).visitIndex, 1, '起始月為含界');
assertEq(SLU.findPeriodForMonth(LEVELS, 'A 保修(一年四次)', 3).visitIndex, 1, '結束月為含界');
assertEq(SLU.findPeriodForMonth(LEVELS, 'D 維修(無簽約客戶)', 5), null, 'D 任何月份都回 null');
assertEq(SLU.isAllocatable(LEVELS, 'C 保養(一年一次)'), true, 'C 納入保養分配');
assertEq(SLU.isAllocatable(LEVELS, 'D 維修(無簽約客戶)'), false, 'D 不納入保養分配');
assertEq(SLU.isAllocatable(LEVELS, '不存在'), false, '查無等級不納入保養分配');

console.log('\nSection 1｜normalizeRecord / formatPeriodsLabel');
const norm = SLU.normalizeRecord({
  name: '  X 等級 ', maintenanceCount: '2', countsBonusPoints: true,
  periods: [{ visitIndex: 2, startMonth: '7', endMonth: '12' },
            { visitIndex: 1, startMonth: '1', endMonth: '6' }]
});
assertEq(norm.name, 'X 等級', 'normalizeRecord 去頭尾空白');
assertEq(norm.maintenanceCount, 2, 'normalizeRecord maintenanceCount 轉數字');
assertEq(norm.periods[0].visitIndex, 1, 'normalizeRecord periods 依 visitIndex 排序');
assertEq(norm.periods[0].startMonth, 1, 'normalizeRecord 月份轉數字');
assertEq(SLU.formatPeriodsLabel(LEVELS[1]), '第1次 1-6月、第2次 7-12月', 'formatPeriodsLabel 兩區間');
assertEq(SLU.formatPeriodsLabel(LEVELS[3]), '—', 'formatPeriodsLabel 無區間回 —');

console.log('\nSection 1｜isServiceLevelInUse');
const custs = [{ id: 'C1', name: '甲', serviceLevel: 'A 保修(一年四次)' }];
const strs = [{ id: 'S1', storeName: '甲一店', serviceLevel: 'B 保修(一年兩次)' }];
assertEq(SLU.isServiceLevelInUse('A 保修(一年四次)', custs, strs), true, '客戶使用中');
assertEq(SLU.isServiceLevelInUse('B 保修(一年兩次)', custs, strs), true, '門市使用中');
assertEq(SLU.isServiceLevelInUse('C 保養(一年一次)', custs, strs), false, '未被使用');

console.log('\nSection 1｜syncServiceLevelOptions');
sandbox.SERVICE_LEVEL_OPTIONS.push('殘留舊值');
const optRef = sandbox.SERVICE_LEVEL_OPTIONS;
SLU.syncServiceLevelOptions(LEVELS);
assertTrue(sandbox.SERVICE_LEVEL_OPTIONS === optRef, 'syncServiceLevelOptions 就地改寫，不換參考');
assertDeep(sandbox.SERVICE_LEVEL_OPTIONS,
  ['A 保修(一年四次)', 'B 保修(一年兩次)', 'C 保養(一年一次)', 'D 維修(無簽約客戶)'],
  'syncServiceLevelOptions 內容為四筆名稱且清掉舊值');
SLU.syncServiceLevelOptions([{ id: 'SL001', name: 'A 保修(一年四次)' }]);
assertDeep(sandbox.SERVICE_LEVEL_OPTIONS, ['A 保修(一年四次)'], '刪除後的等級不再出現在選項');
SLU.syncServiceLevelOptions(LEVELS); // 還原給後續 section 用

console.log('\nSection 1｜renameServiceLevel');
const renamed = SLU.renameServiceLevel('A 保修(一年四次)', 'A 全新名稱', {
  customers: [{ id: 'C1', serviceLevel: 'A 保修(一年四次)' }, { id: 'C2', serviceLevel: 'B 保修(一年兩次)' }],
  stores: [{ id: 'S1', serviceLevel: 'A 保修(一年四次)' }],
  cases: [{ id: 'R1', serviceLevel: 'A 保修(一年四次)' }],
  maintenanceCases: [{ id: 'M1', serviceLevel: 'A 保修(一年四次)' }, { id: 'M2', serviceLevel: '' }]
});
assertEq(renamed.customers[0].serviceLevel, 'A 全新名稱', 'customers 改名');
assertEq(renamed.customers[1].serviceLevel, 'B 保修(一年兩次)', '非目標等級不動');
assertEq(renamed.stores[0].serviceLevel, 'A 全新名稱', 'stores 改名');
assertEq(renamed.cases[0].serviceLevel, 'A 全新名稱', 'cases 改名');
assertEq(renamed.maintenanceCases[0].serviceLevel, 'A 全新名稱', 'maintenanceCases 改名');
assertEq(renamed.changedCount, 4, 'changedCount 為 4');
const noop = SLU.renameServiceLevel('A', 'A', { customers: [{ serviceLevel: 'A' }] });
assertEq(noop.changedCount, 0, '新舊同名時 changedCount 為 0');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node scripts/verify-service-level-management.mjs`
Expected: FAIL — `ENOENT ... service-level-utils.js`（檔案還不存在）

- [ ] **Step 3: 建立 `src/features/permissions/service-level-utils.js`**

```js
/*
 * features/permissions/service-level-utils.js — 服務等級工具函式
 *
 * 服務等級是「每年保養次數」「保養區間」「是否計算增額積分」的唯一資料來源。
 * 客戶／門市／案件存的是服務等級「名稱字串」，故改名時需以 renameServiceLevel 連帶同步。
 */
(function () {
  'use strict';

  function toName(value) {
    return String(value == null ? '' : value).trim();
  }

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

  function normalizeRecord(record) {
    return {
      name: toName(record && record.name),
      maintenanceCount: Number((record && record.maintenanceCount) || 0),
      countsBonusPoints: !!(record && record.countsBonusPoints),
      periods: normalizePeriods(record && record.periods)
    };
  }

  function findByName(serviceLevels, name) {
    var target = toName(name);
    if (!target) return null;
    var found = (serviceLevels || []).find(function (sl) {
      return toName(sl && sl.name) === target;
    });
    return found || null;
  }

  function getMaintenanceCount(serviceLevels, name) {
    var rec = findByName(serviceLevels, name);
    return rec ? (Number(rec.maintenanceCount) || 0) : 0;
  }

  function countsBonusPoints(serviceLevels, name) {
    var rec = findByName(serviceLevels, name);
    return !!(rec && rec.countsBonusPoints);
  }

  function getPeriods(serviceLevels, name) {
    var rec = findByName(serviceLevels, name);
    return rec ? normalizePeriods(rec.periods) : [];
  }

  function findPeriodForMonth(serviceLevels, name, month) {
    var m = Number(month);
    var found = getPeriods(serviceLevels, name).find(function (p) {
      return Number(p.startMonth) <= m && m <= Number(p.endMonth);
    });
    return found || null;
  }

  function isAllocatable(serviceLevels, name) {
    return getMaintenanceCount(serviceLevels, name) > 0;
  }

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
    } else if (n.periods.length !== count) {
      errors.push('保養區間筆數（' + n.periods.length + '）與每年保養次數（' + count + '）不符');
    }

    var monthsValid = true;
    n.periods.forEach(function (p) {
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
      for (var i = 0; i < n.periods.length; i++) {
        for (var j = i + 1; j < n.periods.length; j++) {
          var a = n.periods[i];
          var b = n.periods[j];
          if (a.startMonth <= b.endMonth && b.startMonth <= a.endMonth) {
            errors.push('第' + a.visitIndex + '次與第' + b.visitIndex + '次的保養區間重疊');
          }
        }
      }
    }

    return errors;
  }

  function isServiceLevelInUse(name, customers, stores) {
    var target = toName(name);
    if (!target) return false;
    var hit = function (item) { return toName(item && item.serviceLevel) === target; };
    return (customers || []).some(hit) || (stores || []).some(hit);
  }

  // 就地改寫 SERVICE_LEVEL_OPTIONS 的內容（其他模組持有同一參考，不可整個重新指派）
  function syncServiceLevelOptions(serviceLevels) {
    var seen = {};
    var names = [];
    (serviceLevels || []).forEach(function (sl) {
      var n = toName(sl && sl.name);
      if (!n || seen[n]) return;
      seen[n] = true;
      names.push(n);
    });
    SERVICE_LEVEL_OPTIONS.length = 0;
    names.forEach(function (n) { SERVICE_LEVEL_OPTIONS.push(n); });
  }

  /**
   * 服務等級改名時，同步既有資料存的名稱字串。
   * @returns {{ customers, stores, cases, maintenanceCases, changedCount }}
   */
  function renameServiceLevel(oldName, newName, collections) {
    var from = toName(oldName);
    var to = toName(newName);
    var changedCount = 0;
    var src = collections || {};

    function mapList(list) {
      return (list || []).map(function (item) {
        if (!item || toName(item.serviceLevel) !== from) return item;
        if (from === to) return item;
        changedCount++;
        return Object.assign({}, item, { serviceLevel: to });
      });
    }

    return {
      customers: mapList(src.customers),
      stores: mapList(src.stores),
      cases: mapList(src.cases),
      maintenanceCases: mapList(src.maintenanceCases),
      changedCount: changedCount
    };
  }

  function formatPeriodsLabel(record) {
    var periods = normalizePeriods(record && record.periods);
    if (!periods.length) return '—';
    return periods.map(function (p) {
      return '第' + p.visitIndex + '次 ' + p.startMonth + '-' + p.endMonth + '月';
    }).join('、');
  }

  window.ServiceLevelUtils = {
    normalizeRecord: normalizeRecord,
    findByName: findByName,
    getMaintenanceCount: getMaintenanceCount,
    countsBonusPoints: countsBonusPoints,
    getPeriods: getPeriods,
    findPeriodForMonth: findPeriodForMonth,
    isAllocatable: isAllocatable,
    validate: validate,
    isServiceLevelInUse: isServiceLevelInUse,
    syncServiceLevelOptions: syncServiceLevelOptions,
    renameServiceLevel: renameServiceLevel,
    formatPeriodsLabel: formatPeriodsLabel
  };
})();
```

- [ ] **Step 4: 執行測試確認通過**

Run: `node scripts/verify-service-level-management.mjs`
Expected: PASS（`0 failed`）

- [ ] **Step 5: `src/data/options.js` 把 `SERVICE_LEVEL_OPTIONS` 改成空陣列**

把 `src/data/options.js:54-59` 的：

```js
const SERVICE_LEVEL_OPTIONS = [
  'A 保修(一年一次)',
  'B 保修(一年兩次)',
  'C 保養(一年一次)',
  'D 維修(無簽約客戶)'
];
```

換成：

```js
// 服務等級選項：由 ServiceLevelUtils.syncServiceLevelOptions() 於啟動與每次異動時就地填入。
// 保留常數本身，因為 customer-form.js 與 data-retrieval.js 直接引用此參考。
const SERVICE_LEVEL_OPTIONS = [];
```

- [ ] **Step 6: `src/data/seed.js` 新增 `INITIAL_SERVICE_LEVELS`**

在 `src/data/seed.js` 檔案最上方的 `// --- 初始模擬客戶列表 (客戶建檔) ---` 註解之前插入：

```js
// --- 初始服務等級 (系統權限 - 服務等級管理) ---
// countsBonusPoints 的值刻意對應原本寫死的 C/D 前綴判定，確保既有績效數字不變。
const INITIAL_SERVICE_LEVELS = [{
  id: 'SL001',
  name: 'A 保修(一年四次)',
  maintenanceCount: 4,
  countsBonusPoints: false,
  periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 3 },
    { visitIndex: 2, startMonth: 4, endMonth: 6 },
    { visitIndex: 3, startMonth: 7, endMonth: 9 },
    { visitIndex: 4, startMonth: 10, endMonth: 12 }
  ]
}, {
  id: 'SL002',
  name: 'B 保修(一年兩次)',
  maintenanceCount: 2,
  countsBonusPoints: false,
  periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 6 },
    { visitIndex: 2, startMonth: 7, endMonth: 12 }
  ]
}, {
  id: 'SL003',
  name: 'C 保養(一年一次)',
  maintenanceCount: 1,
  countsBonusPoints: true,
  periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 12 }
  ]
}, {
  id: 'SL004',
  name: 'D 維修(無簽約客戶)',
  maintenanceCount: 0,
  countsBonusPoints: true,
  periods: []
}];
```

- [ ] **Step 7: 全專案把 `A 保修(一年一次)` 換成 `A 保修(一年四次)`**

```bash
cd /Users/kimoji/workspace/projects/iess-cases
grep -rl 'A 保修(一年一次)' src scripts | xargs sed -i '' 's/A 保修(一年一次)/A 保修(一年四次)/g'
grep -rn 'A 保修(一年一次)' src scripts index.html || echo '舊字串已清空'
```

Expected: 印出「舊字串已清空」。

- [ ] **Step 8: `index.html` 加入 script**

在 `index.html` 的 `<script src="src/features/permissions/device-category-utils.js"></script>` 那一行之後插入：

```html
  <script src="src/features/permissions/service-level-utils.js"></script>
```

（此位置在 `maintenance-allocation-utils.js`、`seed.js`、`performance-utils.js` 之前，符合依賴順序。）

- [ ] **Step 9: `src/app.js` 加入 store 欄位、setter、啟動 sync**

在 `src/app.js:100`（`deviceCategories: INITIAL_DEVICE_CATEGORIES,`）之後插入一行：

```js
    serviceLevels: INITIAL_SERVICE_LEVELS,
```

在 `setDeviceCategories` 函式（約 `src/app.js:192-197`）之後插入：

```js
  function setServiceLevels(v) {
    store.set(function (s) {
      var next = typeof v === 'function' ? v(s.serviceLevels) : v;
      ServiceLevelUtils.syncServiceLevelOptions(next);
      return { serviceLevels: next };
    });
  }
```

在檔尾 `DeviceCategoryUtils.syncDeviceCategoryOptions(INITIAL_DEVICE_CATEGORIES);`（約 `src/app.js:842`）**之前**插入：

```js
  ServiceLevelUtils.syncServiceLevelOptions(INITIAL_SERVICE_LEVELS);
```

- [ ] **Step 10: 手動確認頁面仍可運作**

Run: `open index.html`（或 `python3 -m http.server` 後開瀏覽器）
Expected: 首頁正常渲染、Console 無錯誤；進入「戰情室 → 客戶管理 → 編輯任一客戶」，「服務等級」下拉仍有四個選項，且 A 顯示為 `A 保修(一年四次)`。

- [ ] **Step 11: 跑既有回歸腳本**

Run:
```bash
node scripts/verify-equipment-level-points.mjs
node scripts/verify-equipment-level-ui.mjs
node scripts/verify-equipment-level-surfaces.mjs
node scripts/verify-case-review-bonus-points.mjs
node scripts/verify-case-record-points.mjs
node scripts/verify-case-return.mjs
node scripts/verify-repair-multi-assignee.mjs
```
Expected: 全部 `0 failed`（此時 `isBonusEligible` 尚未改簽章，所以應全綠）

- [ ] **Step 12: Commit**

```bash
git add src/features/permissions/service-level-utils.js scripts/verify-service-level-management.mjs \
  src/data/seed.js src/data/options.js src/app.js index.html scripts/verify-*.mjs
git commit -m "feat: add service level data model and ServiceLevelUtils"
```

---

## Task 2: 服務等級管理列表頁與選單／路由

**Files:**
- Create: `src/features/permissions/service-level-list.js`
- Modify: `src/data/options.js`（`PERMISSION_FUNCTIONS`、`PERMISSION_TREE`）
- Modify: `src/shell/permissions-sidebar.js`
- Modify: `src/app.js`（`PERMISSIONS_SUBMENU_DEFAULT_VIEW`、`service-level-list` 路由）
- Modify: `index.html`
- Modify: `scripts/verify-service-level-management.mjs`（追加 Section 2）

**Interfaces:**
- Consumes: Task 1 的 `ServiceLevelUtils.formatPeriodsLabel`、`.isServiceLevelInUse`、`INITIAL_SERVICE_LEVELS`、app store `serviceLevels`／`setServiceLevels`。
- Produces: `window.ServiceLevelList(props)`，props ＝ `{ serviceLevels, setServiceLevels, customers, stores, setEditingCase, setView, showToast }`，回傳 DOM 節點。view id：`service-level-list`。

- [ ] **Step 1: 寫失敗的測試 — 在 `scripts/verify-service-level-management.mjs` 追加 Section 2**

把檔尾這兩行：

```js
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

改成（後續 Task 會繼續在 `// === UI sections 由後續 Task 追加 ===` 之前插入）：

```js
// ---------- headless Chrome 區段 ----------
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { existsSync } from 'node:fs';

const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9341);
if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-service-level-check-profile',
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

  console.log('\nSection 2｜頁面載入與預設資料');
  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');
  assertEq(await evaluate('INITIAL_SERVICE_LEVELS.length'), 4, 'INITIAL_SERVICE_LEVELS 有四筆');
  assertDeep(await evaluate('SERVICE_LEVEL_OPTIONS'),
    ['A 保修(一年四次)', 'B 保修(一年兩次)', 'C 保養(一年一次)', 'D 維修(無簽約客戶)'],
    '啟動時 SERVICE_LEVEL_OPTIONS 已被填入');
  assertTrue(await evaluate('PERMISSION_FUNCTIONS.indexOf("服務等級管理") !== -1'),
    'PERMISSION_FUNCTIONS 含服務等級管理');
  assertTrue(await evaluate(`(function(){
    var node = PERMISSION_TREE.find(function (n) { return n.id === '系統權限'; });
    return node.children.indexOf('服務等級管理') === node.children.indexOf('設備分類管理') + 1;
  })()`), 'PERMISSION_TREE 系統權限的服務等級管理緊接設備分類管理之後');

  console.log('\nSection 2｜列表渲染');
  await evaluate(`
    window.__levels = JSON.parse(JSON.stringify(INITIAL_SERVICE_LEVELS));
    window.__toasts = [];
    window.__renderList = function (customers, stores) {
      return ServiceLevelList({
        serviceLevels: window.__levels,
        setServiceLevels: function (v) {
          window.__levels = typeof v === 'function' ? v(window.__levels) : v;
        },
        customers: customers || [],
        stores: stores || [],
        setEditingCase: function (v) { window.__editing = v; },
        setView: function (v) { window.__view = v; },
        showToast: function (msg, kind) { window.__toasts.push([msg, kind || 'success']); }
      });
    };
    'ok'`);

  const listHeaders = await evaluate(`(function(){
    var node = window.__renderList();
    var ths = Array.prototype.map.call(node.querySelectorAll('thead th'),
      function (t) { return t.textContent.trim(); });
    node.remove();
    return ths;
  })()`);
  assertDeep(listHeaders,
    ['操作', '服務等級名稱', '每年保養次數', '是否計算增額積分', '保養區間'],
    '列表表頭五欄');

  const rowTexts = await evaluate(`(function(){
    var node = window.__renderList();
    var out = Array.prototype.map.call(node.querySelectorAll('tbody tr'), function (tr) {
      return Array.prototype.map.call(tr.querySelectorAll('td'), function (td) {
        return td.textContent.trim();
      }).slice(1);
    });
    node.remove();
    return out;
  })()`);
  assertEq(rowTexts.length, 4, '列表渲染四筆');
  assertDeep(rowTexts[0],
    ['A 保修(一年四次)', '4', '否', '第1次 1-3月、第2次 4-6月、第3次 7-9月、第4次 10-12月'],
    'A 列內容正確');
  assertDeep(rowTexts[3], ['D 維修(無簽約客戶)', '0', '是', '—'], 'D 列內容正確');

  console.log('\nSection 2｜刪除保護');
  const blocked = await evaluate(`(function(){
    window.__toasts = [];
    var custs = [{ id: 'C1', name: '甲', serviceLevel: 'A 保修(一年四次)' }];
    var node = window.__renderList(custs, []);
    var rows = node.querySelectorAll('tbody tr');
    rows[0].querySelectorAll('td')[0].querySelectorAll('button')[1].click();
    document.body.appendChild(node);
    var btns = Array.prototype.filter.call(node.querySelectorAll('button'), function (b) {
      return b.textContent.trim() === '確認刪除';
    });
    btns[0].click();
    var count = window.__levels.length;
    node.remove();
    return { count: count, toasts: window.__toasts };
  })()`);
  assertEq(blocked.count, 4, '使用中的等級未被刪除');
  assertDeep(blocked.toasts, [['此服務等級已被客戶或門市使用，無法刪除', 'error']], '跳出擋刪 toast');

  const removed = await evaluate(`(function(){
    window.__levels = JSON.parse(JSON.stringify(INITIAL_SERVICE_LEVELS));
    window.__toasts = [];
    var node = window.__renderList([], []);
    node.querySelectorAll('tbody tr')[0].querySelectorAll('td')[0].querySelectorAll('button')[1].click();
    document.body.appendChild(node);
    Array.prototype.filter.call(node.querySelectorAll('button'), function (b) {
      return b.textContent.trim() === '確認刪除';
    })[0].click();
    var names = window.__levels.map(function (s) { return s.name; });
    node.remove();
    return { names: names, toasts: window.__toasts };
  })()`);
  assertEq(removed.names.indexOf('A 保修(一年四次)'), -1, '未使用的等級刪除成功');
  assertEq(removed.names.length, 3, '刪除後剩三筆');
  assertDeep(removed.toasts, [['服務等級已刪除', 'success']], '跳出刪除成功 toast');

  console.log('\nSection 2｜app.js 路由與選單');
  const appSrc = readFileSync(join(ROOT, 'src/app.js'), 'utf8');
  assertTrue(appSrc.includes(`'服務等級管理': 'service-level-list'`), 'app.js 有選單映射');
  assertTrue(appSrc.includes(`case 'service-level-list':`), 'app.js 有 service-level-list 路由');
  const sidebarSrc = readFileSync(join(ROOT, 'src/shell/permissions-sidebar.js'), 'utf8');
  assertTrue(sidebarSrc.includes('服務等級管理'), 'permissions-sidebar 有選單項目');

  // === UI sections 由後續 Task 追加 ===

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

注意：`import` 語句必須移到檔案最上方（ESM 規定），所以把新增的 `import { spawn } …`、`import { setTimeout as sleep } …`、`import { existsSync } …` 三行搬到檔首與現有 import 併列，並在原位置只留 headless 區段的程式碼。同時把檔首既有的 `import { readFileSync }` 保留（Section 2 會用到）。

- [ ] **Step 2: 執行測試確認失敗**

Run: `node scripts/verify-service-level-management.mjs`
Expected: Section 1 全綠，Section 2 出現 `✗ driver — ServiceLevelList is not defined`

- [ ] **Step 3: 建立 `src/features/permissions/service-level-list.js`**

```js
/*
 * features/permissions/service-level-list.js — 服務等級管理：列表
 * props: { serviceLevels, setServiceLevels, customers, stores, setEditingCase, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, useDragScroll = IESS.useDragScroll;
  var iconActionBtn = IESS.iconActionBtn;

  var COLUMNS = [
    { key: 'name', label: '服務等級名稱' },
    { key: 'maintenanceCount', label: '每年保養次數' },
    { key: 'countsBonusPoints', label: '是否計算增額積分' },
    { key: 'periods', label: '保養區間' }
  ];

  function renderCellText(record, key) {
    if (key === 'countsBonusPoints') return record.countsBonusPoints ? '是' : '否';
    if (key === 'maintenanceCount') return String(Number(record.maintenanceCount) || 0);
    if (key === 'periods') return ServiceLevelUtils.formatPeriodsLabel(record);
    return record.name || '—';
  }

  function ServiceLevelList(props) {
    var serviceLevels = props.serviceLevels || [];
    var setServiceLevels = props.setServiceLevels;
    var customers = props.customers || [];
    var stores = props.stores || [];
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;

    var keyword = '';
    var appliedKeyword = '';
    var deleteModal = { show: false, id: null, label: '' };
    var dragProps = useDragScroll();
    var listPagination = IESS.createListPagination();

    function getFilteredLevels() {
      var kw = appliedKeyword.trim().toLowerCase();
      if (!kw) return serviceLevels.slice();
      return serviceLevels.filter(function (sl) {
        return String(sl.name || '').toLowerCase().includes(kw);
      });
    }

    return stateful(function (rerender) {
      var filteredLevels = getFilteredLevels();
      var pageResult = listPagination.slice(filteredLevels);

      function handleSearch() { appliedKeyword = keyword; listPagination.resetPage(); rerender(); }
      function handleKeyDown(e) { if (e.key === 'Enter') handleSearch(); }

      function handleDelete(id) {
        var target = serviceLevels.find(function (sl) { return sl.id === id; });
        if (!target) {
          deleteModal = { show: false, id: null, label: '' };
          rerender();
          return;
        }
        if (ServiceLevelUtils.isServiceLevelInUse(target.name, customers, stores)) {
          showToast('此服務等級已被客戶或門市使用，無法刪除', 'error');
          deleteModal = { show: false, id: null, label: '' };
          rerender();
          return;
        }
        setServiceLevels(serviceLevels.filter(function (sl) { return sl.id !== id; }));
        deleteModal = { show: false, id: null, label: '' };
        showToast('服務等級已刪除');
      }

      return h('div', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
        h('div', { className: 'flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4' },
          h('div', { className: 'flex flex-wrap items-end gap-3' },
            h('div', null,
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '關鍵字'),
              h('input', {
                type: 'text',
                value: keyword,
                onChange: function (e) { keyword = e.target.value; rerender(); },
                onKeyDown: handleKeyDown,
                placeholder: '服務等級名稱…',
                className: 'w-64 p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('button', {
              onClick: handleSearch,
              className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md shadow-sm transition-colors'
            }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋')
          ),
          iconActionBtn({
            label: '新增服務等級',
            className: 'flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors shrink-0',
            onClick: function () { setEditingCase(null); setView('service-level-add'); },
            icon: Icons.Plus({ className: 'h-5 w-5' })
          })
        ),
        h('div', Object.assign({}, dragProps, {
          className: 'overflow-x-auto border rounded-lg cursor-grab active:cursor-grabbing'
        }),
          h('table', { className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap select-none' },
            h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
              h('tr', null,
                h('th', { className: 'p-3 font-semibold text-center w-36' }, '操作'),
                COLUMNS.map(function (col) {
                  return h('th', { key: col.key, className: 'p-3 font-semibold' }, col.label);
                })
              )
            ),
            h('tbody', { className: 'divide-y divide-gray-100' },
              filteredLevels.length === 0
                ? h('tr', null, h('td', { colspan: COLUMNS.length + 1, className: 'p-10 text-center text-gray-400 text-base' }, '無資料'))
                : pageResult.items.map(function (sl) {
                    return h('tr', { key: sl.id, className: 'hover:bg-blue-50/50 transition-colors' },
                      h('td', { className: 'p-3' },
                        h('div', { className: 'flex items-center justify-center space-x-2' },
                          h('button', {
                            onClick: function () { setEditingCase(sl); setView('service-level-edit'); },
                            className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                            title: '編輯'
                          }, Icons.Edit({ className: 'h-4 w-4' })),
                          iconActionBtn({
                            label: '刪除',
                            onClick: function () {
                              deleteModal = { show: true, id: sl.id, label: sl.name };
                              rerender();
                            },
                            className: 'p-1.5 text-red-600 hover:bg-red-100 rounded',
                            icon: Icons.Trash2({ className: 'h-4 w-4' })
                          })
                        )
                      ),
                      COLUMNS.map(function (col) {
                        return h('td', { key: col.key, className: 'p-3 font-medium text-gray-800' },
                          renderCellText(sl, col.key));
                      })
                    );
                  })
            )
          )
        ),
        listPagination.renderBar(pageResult, rerender),
        deleteModal.show && h('div', { className: 'app-modal-overlay' },
          h('div', { className: 'bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4' },
            h('div', { className: 'flex items-center space-x-3 text-red-600 mb-4' },
              Icons.AlertCircle({ className: 'h-6 w-6' }),
              h('h3', { className: 'text-lg font-bold text-gray-800' }, '確認刪除')
            ),
            h('p', { className: 'text-gray-600 mb-6' },
              '確定要刪除服務等級「' + deleteModal.label + '」嗎？若已被客戶或門市使用則無法刪除。'),
            h('div', { className: 'flex justify-end space-x-3' },
              h('button', {
                onClick: function () { deleteModal = { show: false, id: null, label: '' }; rerender(); },
                className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
              }, '取消'),
              h('button', {
                onClick: function () { handleDelete(deleteModal.id); },
                className: 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors'
              }, '確認刪除')
            )
          )
        )
      );
    });
  }

  window.ServiceLevelList = ServiceLevelList;
})();
```

- [ ] **Step 4: `index.html` 加入列表 script**

在 `<script src="src/features/permissions/device-category-form.js"></script>` 之後插入：

```html
  <script src="src/features/permissions/service-level-list.js"></script>
```

- [ ] **Step 5: `src/data/options.js` 加入權限項目**

`PERMISSION_FUNCTIONS`（約 `src/data/options.js:198`）把：

```js
  '設備分類管理',
  '處理方式與積分管理',
```

改成：

```js
  '設備分類管理',
  '服務等級管理',
  '處理方式與積分管理',
```

`PERMISSION_TREE` 的 `'系統權限'`（約 `src/data/options.js:231`）把：

```js
    children: ['帳號管理', '指派人員管理', '設備分類管理', '處理方式與積分管理', '保養分配', '績效區域管理']
```

改成：

```js
    children: ['帳號管理', '指派人員管理', '設備分類管理', '服務等級管理', '處理方式與積分管理', '保養分配', '績效區域管理']
```

- [ ] **Step 6: `src/shell/permissions-sidebar.js` 加入選單項目**

把 `MENU_ITEMS` 的 `'設備分類管理',` 之後插入 `'服務等級管理',`：

```js
  var MENU_ITEMS = [
    '帳號管理',
    '指派人員管理',
    '設備分類管理',
    '服務等級管理',
    '處理方式與積分管理',
    '保養分配',
    '績效區域管理'
  ];
```

- [ ] **Step 7: `src/app.js` 加入選單映射與列表路由**

`PERMISSIONS_SUBMENU_DEFAULT_VIEW`（約 `src/app.js:43-50`）在 `'設備分類管理': 'device-category-list',` 之後插入：

```js
    '服務等級管理': 'service-level-list',
```

在 `case 'device-category-edit':` 那一段的 `});` 之後（約 `src/app.js:679`）、`case 'process-method-list':` 之前插入：

```js
      case 'service-level-list':
        return h(ServiceLevelList, {
          serviceLevels: s.serviceLevels,
          setServiceLevels: setServiceLevels,
          customers: s.customers,
          stores: s.stores,
          setEditingCase: setEditingCase,
          setView: setView,
          showToast: showToast
        });
```

- [ ] **Step 8: 執行測試確認通過**

Run: `node scripts/verify-service-level-management.mjs`
Expected: PASS（`0 failed`）

- [ ] **Step 9: Commit**

```bash
git add src/features/permissions/service-level-list.js src/data/options.js \
  src/shell/permissions-sidebar.js src/app.js index.html scripts/verify-service-level-management.mjs
git commit -m "feat: add service level management list page and menu entry"
```

---

## Task 3: 服務等級新增／編輯表單

**Files:**
- Create: `src/features/permissions/service-level-form.js`
- Modify: `src/app.js`（`service-level-add`／`service-level-edit` 路由）
- Modify: `index.html`
- Modify: `scripts/verify-service-level-management.mjs`（追加 Section 3）

**Interfaces:**
- Consumes: `ServiceLevelUtils.normalizeRecord`／`.validate`／`.renameServiceLevel`、app store 的 `serviceLevels`、`cases`、`maintenanceCases`、`customers`、`stores` 與對應 setters。
- Produces: `window.ServiceLevelForm(props)`，props ＝ `{ serviceLevels, setServiceLevels, customers, setCustomers, stores, setStores, cases, setCases, maintenanceCases, setMaintenanceCases, targetCase, setView, showToast }`。view id：`service-level-add`、`service-level-edit`。

- [ ] **Step 1: 寫失敗的測試 — 追加 Section 3**

在 `scripts/verify-service-level-management.mjs` 的 `// === UI sections 由後續 Task 追加 ===` 之前插入：

```js
  console.log('\nSection 3｜表單 validate 擋關');
  await evaluate(`
    window.__renderForm = function (target, levels) {
      window.__formLevels = levels || JSON.parse(JSON.stringify(INITIAL_SERVICE_LEVELS));
      window.__formCustomers = [{ id: 'C1', name: '甲', serviceLevel: 'A 保修(一年四次)' }];
      window.__formStores = [{ id: 'S1', storeName: '甲一店', serviceLevel: 'A 保修(一年四次)' }];
      window.__formCases = [{ id: 'R1', serviceLevel: 'A 保修(一年四次)' }];
      window.__formMaint = [{ id: 'M1', serviceLevel: 'A 保修(一年四次)' }];
      window.__toasts = [];
      window.__view = '';
      return ServiceLevelForm({
        serviceLevels: window.__formLevels,
        setServiceLevels: function (v) { window.__formLevels = v; },
        customers: window.__formCustomers,
        setCustomers: function (v) { window.__formCustomers = v; },
        stores: window.__formStores,
        setStores: function (v) { window.__formStores = v; },
        cases: window.__formCases,
        setCases: function (v) { window.__formCases = v; },
        maintenanceCases: window.__formMaint,
        setMaintenanceCases: function (v) { window.__formMaint = v; },
        targetCase: target,
        setView: function (v) { window.__view = v; },
        showToast: function (msg, kind) { window.__toasts.push([msg, kind || 'success']); }
      });
    };
    window.__fill = function (node, values) {
      var name = node.querySelector('input[name="name"]');
      if (values.name !== undefined) {
        name.value = values.name;
        name.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (values.maintenanceCount !== undefined) {
        var cnt = node.querySelector('input[name="maintenanceCount"]');
        cnt.value = String(values.maintenanceCount);
        cnt.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (values.countsBonusPoints !== undefined) {
        var sel = node.querySelector('select[name="countsBonusPoints"]');
        sel.value = values.countsBonusPoints ? '是' : '否';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      (values.periods || []).forEach(function (p, i) {
        var s = node.querySelector('select[name="startMonth-' + (i + 1) + '"]');
        var e = node.querySelector('select[name="endMonth-' + (i + 1) + '"]');
        s.value = String(p[0]); s.dispatchEvent(new Event('change', { bubbles: true }));
        e.value = String(p[1]); e.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };
    window.__submit = function (node) {
      node.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    };
    'ok'`);

  async function submitCase(script) {
    return await evaluate(`(function(){
      var node = window.__renderForm(null);
      document.body.appendChild(node);
      ${script}
      var out = { toasts: window.__toasts, view: window.__view, count: window.__formLevels.length };
      node.remove();
      return out;
    })()`);
  }

  const emptyName = await submitCase(`
    window.__fill(node, { name: '   ', maintenanceCount: 0 });
    window.__submit(node);`);
  assertEq(emptyName.toasts[0][0], '服務等級名稱為必填', '名稱空白被擋');
  assertEq(emptyName.toasts[0][1], 'error', '以 error toast 顯示');
  assertEq(emptyName.view, '', '不關閉表單');
  assertEq(emptyName.count, 4, '未新增任何資料');

  const dupName = await submitCase(`
    window.__fill(node, { name: 'C 保養(一年一次)', maintenanceCount: 0 });
    window.__submit(node);`);
  assertEq(dupName.toasts[0][0], '服務等級名稱「C 保養(一年一次)」已存在', '名稱重複被擋');

  const badRange = await submitCase(`
    window.__fill(node, { name: '新等級', maintenanceCount: 1, periods: [[6, 3]] });
    window.__submit(node);`);
  assertEq(badRange.toasts[0][0], '第1次的起始月不可大於結束月', '起訖月顛倒被擋');

  const overlap = await submitCase(`
    window.__fill(node, { name: '新等級', maintenanceCount: 2, periods: [[1, 6], [5, 12]] });
    window.__submit(node);`);
  assertEq(overlap.toasts[0][0], '第1次與第2次的保養區間重疊', '區間重疊被擋');

  const blankMonth = await submitCase(`
    window.__fill(node, { name: '新等級', maintenanceCount: 1 });
    window.__submit(node);`);
  assertEq(blankMonth.toasts[0][0], '第1次的起始月與結束月需為 1–12 月', '未選月份被擋');

  console.log('\nSection 3｜次數變更時區間列的增減');
  const rowCounts = await evaluate(`(function(){
    var node = window.__renderForm(null);
    document.body.appendChild(node);
    var out = {};
    out.zero = node.querySelectorAll('select[name^="startMonth-"]').length;
    out.zeroHint = node.textContent.indexOf('此服務等級不納入保養分配') !== -1;
    window.__fill(node, { maintenanceCount: 3 });
    out.three = node.querySelectorAll('select[name^="startMonth-"]').length;
    window.__fill(node, { periods: [[1, 4], [5, 8], [9, 12]] });
    window.__fill(node, { maintenanceCount: 2 });
    out.two = node.querySelectorAll('select[name^="startMonth-"]').length;
    out.keptFirst = node.querySelector('select[name="startMonth-1"]').value;
    out.keptSecond = node.querySelector('select[name="endMonth-2"]').value;
    node.remove();
    return out;
  })()`);
  assertEq(rowCounts.zero, 0, '次數 0 時不顯示區間列');
  assertEq(rowCounts.zeroHint, true, '次數 0 時顯示「此服務等級不納入保養分配」');
  assertEq(rowCounts.three, 3, '次數改 3 產生 3 列');
  assertEq(rowCounts.two, 2, '次數改 2 砍到 2 列');
  assertEq(rowCounts.keptFirst, '1', '減少列數時保留第 1 列已填值');
  assertEq(rowCounts.keptSecond, '8', '減少列數時保留第 2 列已填值');

  console.log('\nSection 3｜新增成功');
  const added = await evaluate(`(function(){
    var node = window.__renderForm(null);
    document.body.appendChild(node);
    window.__fill(node, { name: 'E 特約(一年三次)', maintenanceCount: 3, countsBonusPoints: true,
      periods: [[1, 4], [5, 8], [9, 12]] });
    window.__submit(node);
    var created = window.__formLevels[0];
    var out = {
      count: window.__formLevels.length,
      name: created.name,
      maintenanceCount: created.maintenanceCount,
      countsBonusPoints: created.countsBonusPoints,
      periods: created.periods,
      hasId: !!created.id,
      view: window.__view,
      toasts: window.__toasts
    };
    node.remove();
    return out;
  })()`);
  assertEq(added.count, 5, '新增後共五筆');
  assertEq(added.name, 'E 特約(一年三次)', '名稱正確');
  assertEq(added.maintenanceCount, 3, '次數為數字 3');
  assertEq(added.countsBonusPoints, true, 'countsBonusPoints 為 true');
  assertDeep(added.periods, [
    { visitIndex: 1, startMonth: 1, endMonth: 4 },
    { visitIndex: 2, startMonth: 5, endMonth: 8 },
    { visitIndex: 3, startMonth: 9, endMonth: 12 }
  ], '區間正確');
  assertEq(added.hasId, true, '有產生 id');
  assertEq(added.view, 'service-level-list', '儲存後回列表');
  assertDeep(added.toasts, [['服務等級新增成功', 'success']], '跳出新增成功 toast');

  console.log('\nSection 3｜編輯改名時同步既有資料');
  const editRenamed = await evaluate(`(function(){
    var target = JSON.parse(JSON.stringify(INITIAL_SERVICE_LEVELS))[0];
    var node = window.__renderForm(target);
    document.body.appendChild(node);
    var out = { initialName: node.querySelector('input[name="name"]').value };
    window.__fill(node, { name: 'A 保修(季保)' });
    window.__submit(node);
    out.levelName = window.__formLevels[0].name;
    out.levelCount = window.__formLevels.length;
    out.customer = window.__formCustomers[0].serviceLevel;
    out.store = window.__formStores[0].serviceLevel;
    out.case = window.__formCases[0].serviceLevel;
    out.maint = window.__formMaint[0].serviceLevel;
    out.toasts = window.__toasts;
    node.remove();
    return out;
  })()`);
  assertEq(editRenamed.initialName, 'A 保修(一年四次)', '編輯時帶入原名稱');
  assertEq(editRenamed.levelCount, 4, '編輯不會多出資料');
  assertEq(editRenamed.levelName, 'A 保修(季保)', '服務等級本身已改名');
  assertEq(editRenamed.customer, 'A 保修(季保)', 'customers 已同步');
  assertEq(editRenamed.store, 'A 保修(季保)', 'stores 已同步');
  assertEq(editRenamed.case, 'A 保修(季保)', 'cases 已同步');
  assertEq(editRenamed.maint, 'A 保修(季保)', 'maintenanceCases 已同步');
  assertDeep(editRenamed.toasts, [['服務等級更新成功，已同步 4 筆既有資料', 'success']],
    'toast 註明同步筆數');

  const editNoRename = await evaluate(`(function(){
    var target = JSON.parse(JSON.stringify(INITIAL_SERVICE_LEVELS))[1];
    var node = window.__renderForm(target);
    document.body.appendChild(node);
    window.__fill(node, { countsBonusPoints: true });
    window.__submit(node);
    var out = { name: window.__formLevels[1].name, bonus: window.__formLevels[1].countsBonusPoints,
      toasts: window.__toasts };
    node.remove();
    return out;
  })()`);
  assertEq(editNoRename.name, 'B 保修(一年兩次)', '未改名時名稱不變');
  assertEq(editNoRename.bonus, true, '其他欄位更新成功');
  assertDeep(editNoRename.toasts, [['服務等級更新成功', 'success']], '未改名時 toast 不提同步筆數');
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node scripts/verify-service-level-management.mjs`
Expected: Section 3 出現 `✗ driver — ServiceLevelForm is not defined`

- [ ] **Step 3: 建立 `src/features/permissions/service-level-form.js`**

```js
/*
 * features/permissions/service-level-form.js — 服務等級管理：新增/編輯表單
 * props: { serviceLevels, setServiceLevels, customers, setCustomers, stores, setStores,
 *          cases, setCases, maintenanceCases, setMaintenanceCases,
 *          targetCase, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  var MONTH_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // 依「每年保養次數」增減區間列：增加補空白列，減少砍尾端，已填的前段保留
  function resizePeriods(periods, count) {
    var next = periods.slice(0, count);
    for (var i = next.length; i < count; i++) {
      next.push({ visitIndex: i + 1, startMonth: '', endMonth: '' });
    }
    return next.map(function (p, i) {
      return { visitIndex: i + 1, startMonth: p.startMonth, endMonth: p.endMonth };
    });
  }

  function ServiceLevelForm(props) {
    var serviceLevels = props.serviceLevels || [];
    var setServiceLevels = props.setServiceLevels;
    var targetCase = props.targetCase;
    var setView = props.setView;
    var showToast = props.showToast;
    var isEdit = !!targetCase;
    var originalName = isEdit ? String(targetCase.name || '').trim() : '';

    var formData = {
      name: (targetCase && targetCase.name) || '',
      maintenanceCount: targetCase ? String(Number(targetCase.maintenanceCount) || 0) : '0',
      countsBonusPoints: !!(targetCase && targetCase.countsBonusPoints)
    };
    var periods = resizePeriods(
      ((targetCase && targetCase.periods) || []).map(function (p) {
        return { visitIndex: p.visitIndex, startMonth: p.startMonth, endMonth: p.endMonth };
      }),
      Number(formData.maintenanceCount) || 0
    );

    function buildRecord() {
      return {
        name: formData.name,
        maintenanceCount: formData.maintenanceCount === '' ? '' : Number(formData.maintenanceCount),
        countsBonusPoints: formData.countsBonusPoints,
        periods: periods
      };
    }

    function syncRenamedCollections(newName) {
      var result = ServiceLevelUtils.renameServiceLevel(originalName, newName, {
        customers: props.customers,
        stores: props.stores,
        cases: props.cases,
        maintenanceCases: props.maintenanceCases
      });
      props.setCustomers(result.customers);
      props.setStores(result.stores);
      props.setCases(result.cases);
      props.setMaintenanceCases(result.maintenanceCases);
      return result.changedCount;
    }

    return stateful(function (rerender) {
      function handleNameChange(e) { formData.name = e.target.value; rerender(); }

      function handleCountChange(e) {
        formData.maintenanceCount = e.target.value;
        var count = Number(e.target.value);
        periods = resizePeriods(periods, isFinite(count) && count > 0 ? Math.floor(count) : 0);
        rerender();
      }

      function handleBonusChange(e) {
        formData.countsBonusPoints = e.target.value === '是';
        rerender();
      }

      function handleMonthChange(index, key, value) {
        periods[index][key] = value === '' ? '' : Number(value);
        rerender();
      }

      function handleSubmit(e) {
        e.preventDefault();
        var record = buildRecord();
        var errors = ServiceLevelUtils.validate(
          record, serviceLevels, isEdit ? targetCase.id : null
        );
        if (errors.length) {
          showToast(errors[0], 'error');
          return;
        }

        var normalized = ServiceLevelUtils.normalizeRecord(record);

        if (isEdit) {
          setServiceLevels(serviceLevels.map(function (sl) {
            return sl.id === targetCase.id ? Object.assign({}, sl, normalized) : sl;
          }));
          if (normalized.name !== originalName) {
            var changed = syncRenamedCollections(normalized.name);
            showToast('服務等級更新成功，已同步 ' + changed + ' 筆既有資料');
          } else {
            showToast('服務等級更新成功');
          }
        } else {
          var newRecord = Object.assign({
            id: 'SL' + Date.now(),
            createdDate: todayDate
          }, normalized);
          setServiceLevels([newRecord].concat(serviceLevels));
          showToast('服務等級新增成功');
        }
        setView('service-level-list');
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

      return h('div', {
        className: 'max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative'
      },
        PageHeader({
          title: isEdit ? '編輯服務等級' : '新增服務等級',
          badge: isEdit ? originalName : null,
          onClose: function () { setView('service-level-list'); },
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
        }),
        h('form', { onSubmit: handleSubmit, className: 'p-6' },
          h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
            h('div', null,
              h('label', { className: 'block text-sm mb-1' },
                '服務等級名稱 ', h('span', { className: 'text-red-500' }, '*')),
              h('input', {
                type: 'text',
                name: 'name',
                value: formData.name,
                onChange: handleNameChange,
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '每年保養次數'),
              h('input', {
                type: 'number',
                min: '0',
                name: 'maintenanceCount',
                value: formData.maintenanceCount,
                onChange: handleCountChange,
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '是否計算增額積分'),
              h('select', {
                name: 'countsBonusPoints',
                value: formData.countsBonusPoints ? '是' : '否',
                onChange: handleBonusChange,
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white'
              },
                h('option', { value: '否' }, '否'),
                h('option', { value: '是' }, '是')
              )
            )
          ),
          h('div', { className: 'mt-8' },
            h('h3', { className: 'text-sm font-bold text-gray-700 border-b pb-2 mb-4' }, '保養區間'),
            renderPeriodRows()
          ),
          h('div', { className: 'flex justify-end gap-3 mt-8 pt-6 border-t' },
            h('button', {
              type: 'button',
              onClick: function () { setView('service-level-list'); },
              className: 'px-5 py-2.5 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
            }, '取消'),
            h('button', {
              type: 'submit',
              className: 'flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
            }, Icons.Save({ className: 'h-4 w-4' }), ' 儲存')
          )
        )
      );
    });
  }

  window.ServiceLevelForm = ServiceLevelForm;
})();
```

- [ ] **Step 4: `index.html` 加入表單 script**

在 `<script src="src/features/permissions/service-level-list.js"></script>` 之後插入：

```html
  <script src="src/features/permissions/service-level-form.js"></script>
```

- [ ] **Step 5: `src/app.js` 加入 add／edit 路由**

在 Task 2 加入的 `case 'service-level-list':` 那一段之後插入：

```js
      case 'service-level-add':
        return h(ServiceLevelForm, {
          serviceLevels: s.serviceLevels,
          setServiceLevels: setServiceLevels,
          customers: s.customers, setCustomers: setCustomers,
          stores: s.stores, setStores: setStores,
          cases: s.cases, setCases: setCasesData,
          maintenanceCases: s.maintenanceCases, setMaintenanceCases: setMaintenanceCases,
          setView: setView,
          showToast: showToast
        });
      case 'service-level-edit':
        return h(ServiceLevelForm, {
          serviceLevels: s.serviceLevels,
          setServiceLevels: setServiceLevels,
          customers: s.customers, setCustomers: setCustomers,
          stores: s.stores, setStores: setStores,
          cases: s.cases, setCases: setCasesData,
          maintenanceCases: s.maintenanceCases, setMaintenanceCases: setMaintenanceCases,
          targetCase: s.editingCase,
          setView: setView,
          showToast: showToast
        });
```

- [ ] **Step 6: 執行測試確認通過**

Run: `node scripts/verify-service-level-management.mjs`
Expected: PASS（`0 failed`）

- [ ] **Step 7: 手動確認新增後客戶下拉多出選項**

Run: `open index.html`
Expected: 系統權限 → 服務等級管理 → 新增一筆「E 特約(一年三次)」→ 回列表可見；切到客戶管理 → 編輯客戶，「服務等級」下拉出現「E 特約(一年三次)」。

- [ ] **Step 8: Commit**

```bash
git add src/features/permissions/service-level-form.js src/app.js index.html \
  scripts/verify-service-level-management.mjs
git commit -m "feat: add service level add/edit form with validation and rename sync"
```

---

## Task 4: 增額積分改由服務等級旗標判定

**Files:**
- Modify: `src/features/reports/performance-utils.js:50-52`（刪 `isServiceLevelCD`）、`:64-67`（`isBonusEligible`）、`:114-138`（`computeAssigneePerformance`）、`:233-249`（export）
- Modify: `src/features/repair/case-review.js:2-3, 13-19, 224`
- Modify: `src/app.js`（`CaseReviewList` 與 `CasePerformanceStats` 的 props）
- Modify: `scripts/verify-equipment-level-points.mjs`
- Modify: `scripts/verify-case-review-bonus-points.mjs`
- Modify: `scripts/verify-service-level-management.mjs`（追加 Section 4）

**Interfaces:**
- Consumes: `ServiceLevelUtils.countsBonusPoints(serviceLevels, name)`（Task 1）。
- Produces:
  - `PerformanceUtils.isBonusEligible(c, deviceCategories, serviceLevels) -> boolean`
  - `PerformanceUtils.computeAssigneePerformance(input)`，`input` 新增鍵 `serviceLevels`
  - `PerformanceUtils` 不再 export `isServiceLevelCD`
  - `CaseReviewList` props 新增 `serviceLevels`

- [ ] **Step 1: 寫失敗的測試 — 追加 Section 4**

在 `scripts/verify-service-level-management.mjs` 的 `// === UI sections 由後續 Task 追加 ===` 之前插入：

```js
  console.log('\nSection 4｜isBonusEligible 改吃 serviceLevels');
  await evaluate(`
    window.__cats = [
      { id: 'DC1', category: '室內機', brand: '大金', deviceName: '分離式',
        specification: '2噸', model: 'ADD-1', equipmentLevel: '增額設備' },
      { id: 'DC2', category: '室內機', brand: '大金', deviceName: '分離式',
        specification: '3噸', model: 'BASE-1', equipmentLevel: '基礎設備' }
    ];
    window.__case = function (level, model) {
      return { id: 'X', serviceLevel: level, equipment: model ? { model: model } : null };
    };
    'ok'`);
  const SLS = 'INITIAL_SERVICE_LEVELS';
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('C 保養(一年一次)', 'BASE-1'), window.__cats, ${SLS})`),
    true, 'C（勾選計分）+ 基礎設備 計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('D 維修(無簽約客戶)', null), window.__cats, ${SLS})`),
    true, 'D（勾選計分）無設備仍計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('A 保修(一年四次)', 'BASE-1'), window.__cats, ${SLS})`),
    false, 'A（未勾選）+ 基礎設備 不計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('A 保修(一年四次)', 'ADD-1'), window.__cats, ${SLS})`),
    true, 'A（未勾選）+ 增額設備 計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('B 保修(一年兩次)', 'ADD-1'), window.__cats, ${SLS})`),
    true, 'B（未勾選）+ 增額設備 計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('查無此等級', 'BASE-1'), window.__cats, ${SLS})`),
    false, '查無等級 + 基礎設備 不計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('', 'ADD-1'), window.__cats, ${SLS})`),
    true, '等級空字串 + 增額設備 計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('C 保養(一年一次)', 'BASE-1'), window.__cats, [])`),
    false, 'serviceLevels 為空陣列時只看設備等級');
  assertEq(await evaluate('typeof PerformanceUtils.isServiceLevelCD'), 'undefined',
    'isServiceLevelCD 已自 export 移除');

  console.log('\nSection 4｜銷案審核總積分欄改由服務等級旗標決定');
  const reviewCells = await evaluate(`(function(){
    var levels = [
      { id: 'SL001', name: 'A 保修(一年四次)', maintenanceCount: 4, countsBonusPoints: true, periods: [] },
      { id: 'SL003', name: 'C 保養(一年一次)', maintenanceCount: 1, countsBonusPoints: false, periods: [] }
    ];
    var cases = [
      { id: 'R1', caseNumber: 'SL001', customerName: '甲', storeName: '甲一', serviceLevel: 'A 保修(一年四次)',
        workCategory: '一般叫修', isClosed: true, closeDate: todayDate + ' 10:00',
        processRecords: [{ points: 5, qty: 2 }] },
      { id: 'R2', caseNumber: 'SL002', customerName: '乙', storeName: '乙一', serviceLevel: 'C 保養(一年一次)',
        workCategory: '一般叫修', isClosed: true, closeDate: todayDate + ' 10:00',
        processRecords: [{ points: 7, qty: 1 }] }
    ];
    var node = CaseReviewList({
      cases: cases, setCases: function () {},
      maintenanceCases: [], setMaintenanceCases: function () {},
      assignees: [], deviceCategories: window.__cats, serviceLevels: levels,
      setViewingCase: function () {}, setView: function () {}, showToast: function () {}
    });
    var headers = Array.prototype.map.call(node.querySelectorAll('thead th'),
      function (t) { return t.textContent.trim(); });
    var idx = headers.indexOf('總積分');
    var out = {};
    Array.prototype.forEach.call(node.querySelectorAll('tbody tr'), function (tr) {
      var tds = tr.querySelectorAll('td');
      if (!tds.length) return;
      out[tds[2].textContent.trim()] = tds[idx].textContent.trim();
    });
    node.remove();
    return out;
  })()`);
  assertEq(reviewCells.SL001, '10', '勾選計分的 A 顯示 5×2 = 10');
  assertEq(reviewCells.SL002, '', '未勾選計分且非增額設備的 C 留空');

  console.log('\nSection 4｜app.js 已往下傳 serviceLevels');
  const appSrc4 = readFileSync(join(ROOT, 'src/app.js'), 'utf8');
  const reviewIdx = appSrc4.indexOf('CaseReviewList');
  assertTrue(appSrc4.slice(reviewIdx, reviewIdx + 400).includes('serviceLevels'),
    'app.js 的 CaseReviewList 呼叫含 serviceLevels');
  const statsIdx = appSrc4.indexOf('CasePerformanceStats');
  assertTrue(appSrc4.slice(statsIdx, statsIdx + 500).includes('serviceLevels'),
    'app.js 的 CasePerformanceStats 呼叫含 serviceLevels');
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node scripts/verify-service-level-management.mjs`
Expected: Section 4 多項失敗（`isBonusEligible` 忽略第三參數、`isServiceLevelCD` 仍存在）

- [ ] **Step 3: 改 `src/features/reports/performance-utils.js`**

刪除 `src/features/reports/performance-utils.js:50-53` 的：

```js
  function isServiceLevelCD(serviceLevel) {
    var s = String(serviceLevel || '');
    return s.indexOf('C ') === 0 || s.indexOf('D ') === 0;
  }
```

把 `:64-67` 的：

```js
  // C/D 服務等級一律計分；A/B 僅在設備為增額設備時計分
  function isBonusEligible(c, deviceCategories) {
    return isServiceLevelCD(c && c.serviceLevel) || isAddOnEquipmentCase(c, deviceCategories);
  }
```

改成：

```js
  // 服務等級勾選「計算增額積分」者一律計分；未勾選者僅在設備為增額設備時計分
  function isBonusEligible(c, deviceCategories, serviceLevels) {
    return ServiceLevelUtils.countsBonusPoints(serviceLevels, c && c.serviceLevel)
      || isAddOnEquipmentCase(c, deviceCategories);
  }
```

`computeAssigneePerformance` 內，在 `:119` 的 `var deviceCategories = input.deviceCategories || [];` 之後加一行：

```js
    var serviceLevels = input.serviceLevels || [];
```

並把 `:136` 的：

```js
        if (!isBonusEligible(c, deviceCategories)) return;
```

改成：

```js
        if (!isBonusEligible(c, deviceCategories, serviceLevels)) return;
```

在 export 物件（`:233-249`）刪掉 `isServiceLevelCD: isServiceLevelCD,` 這一行。

- [ ] **Step 4: 改 `src/features/repair/case-review.js`**

檔頭 props 註解（`:3`）改為：

```js
 * props: { cases, setCases, maintenanceCases, setMaintenanceCases, assignees, deviceCategories, serviceLevels, setViewingCase, setView, showToast }
```

`:14-19` 改為：

```js
  // 增額任務：服務等級設定為計算增額積分的叫修案件，或雖未設定但設備為增額設備的叫修案件。
  // 保養計劃案件不列入增額積分（與 performance-utils 的統計口徑一致），一律回 null。
  function resolveReviewCaseBonusPoints(c, deviceCategories, serviceLevels) {
    if (!c || isMaintenancePlanCase(c)) return null;
    if (!PerformanceUtils.isBonusEligible(c, deviceCategories, serviceLevels)) return null;
    return PerformanceUtils.sumProcessPoints(c);
  }
```

在元件內解構 props 的區塊（`deviceCategories` 那一行附近）加上：

```js
    var serviceLevels = props.serviceLevels || [];
```

把 `:224` 的：

```js
                  h('td', { className: 'p-3' }, formatBonusPoints(resolveReviewCaseBonusPoints(c, deviceCategories))),
```

改成：

```js
                  h('td', { className: 'p-3' }, formatBonusPoints(resolveReviewCaseBonusPoints(c, deviceCategories, serviceLevels))),
```

- [ ] **Step 5: 改 `src/app.js` 往下傳 `serviceLevels`**

`case 'review-list':`（約 `src/app.js:345-350`）改為：

```js
        return h(CaseReviewList, {
          cases: s.cases, setCases: setCasesData,
          maintenanceCases: s.maintenanceCases, setMaintenanceCases: setMaintenanceCases,
          assignees: s.assignees, deviceCategories: s.deviceCategories,
          serviceLevels: s.serviceLevels,
          setViewingCase: setViewingCase, setView: setView, showToast: showToast
        });
```

`case 'case-performance':`（約 `src/app.js:562-570`）在 `deviceCategories: s.deviceCategories` 之後補一行 `serviceLevels: s.serviceLevels`（記得前一行補逗號）。

- [ ] **Step 6: 讓 `CasePerformanceStats` 把 `serviceLevels` 傳進 `computeAssigneePerformance`**

Run: `grep -n "computeAssigneePerformance\|deviceCategories" src/features/reports/case-performance-stats.js`

在該檔取 props 的位置加上 `var serviceLevels = props.serviceLevels || [];`，並在呼叫 `PerformanceUtils.computeAssigneePerformance({ … })` 的物件字面值中補上 `serviceLevels: serviceLevels,`。

- [ ] **Step 7: 更新 `scripts/verify-equipment-level-points.mjs`**

在 sandbox 物件（約 `:35-47`）加入一行：

```js
  SERVICE_LEVEL_OPTIONS: [],
```

在 `load('src/features/reports/performance-utils.js')` 之前（找 `load(` 呼叫的區塊）加入：

```js
load('src/features/permissions/service-level-utils.js');
```

在 `const PU = sandbox.window.PerformanceUtils;` 之後加入 fixture：

```js
// 與 seed 的 INITIAL_SERVICE_LEVELS 一致：A/B 不計增額積分，C/D 計增額積分
const sls = [
  { id: 'SL001', name: 'A 保修(一年四次)', maintenanceCount: 4, countsBonusPoints: false, periods: [] },
  { id: 'SL002', name: 'B 保修(一年兩次)', maintenanceCount: 2, countsBonusPoints: false, periods: [] },
  { id: 'SL003', name: 'C 保養(一年一次)', maintenanceCount: 1, countsBonusPoints: true, periods: [] },
  { id: 'SL004', name: 'D 維修(無簽約客戶)', maintenanceCount: 0, countsBonusPoints: true, periods: [] }
];
```

把該檔 12 處 `PU.isBonusEligible(caseWith(…), cats)` 全部改成 `PU.isBonusEligible(caseWith(…), cats, sls)`：

```bash
sed -i '' 's/PU\.isBonusEligible(\(caseWith([^)]*)\), cats)/PU.isBonusEligible(\1, cats, sls)/g' \
  scripts/verify-equipment-level-points.mjs
grep -c 'cats, sls' scripts/verify-equipment-level-points.mjs   # 應為 12
```

- [ ] **Step 8: 更新 `scripts/verify-case-review-bonus-points.mjs`**

在 `window.__renderReview` 的 `CaseReviewList({…})` 參數中，`deviceCategories: window.__deviceCategories,` 之後加一行：

```js
        serviceLevels: INITIAL_SERVICE_LEVELS,
```

在檔尾「app.js 已傳入 deviceCategories」那段之後追加：

```js
  const reviewIdx2 = appSrc.indexOf('CaseReviewList');
  assertTrue(appSrc.slice(reviewIdx2, reviewIdx2 + 400).includes('serviceLevels'),
    'app.js 的 CaseReviewList 呼叫含 serviceLevels');
```

- [ ] **Step 9: 執行所有相關測試確認通過**

Run:
```bash
node scripts/verify-service-level-management.mjs
node scripts/verify-equipment-level-points.mjs
node scripts/verify-case-review-bonus-points.mjs
node scripts/verify-equipment-level-ui.mjs
node scripts/verify-equipment-level-surfaces.mjs
```
Expected: 全部 `0 failed`

- [ ] **Step 10: Commit**

```bash
git add src/features/reports/performance-utils.js src/features/reports/case-performance-stats.js \
  src/features/repair/case-review.js src/app.js scripts/
git commit -m "feat: drive bonus point eligibility from service level flag"
```

---

## Task 5: 客戶名稱 → 服務等級改查 customers

**Files:**
- Modify: `src/features/customer/customer-utils.js`
- Modify: `src/data/options.js`（刪 `CUSTOMER_SERVICE_LEVEL_MAP`）
- Modify: `src/features/repair/case-form.js:98, 385`
- Modify: `src/features/project/project-form.js:304, 645`
- Modify: `src/features/scheduling/case-arrangement.js:438`
- Modify: `scripts/verify-service-level-management.mjs`（追加 Section 5）

**Interfaces:**
- Consumes: 各表單既有的 `customers` prop（已確認 5 處呼叫點皆有 `customers` 在作用域內：`case-form.js:64`／`:310`、`project-form.js:267`／`:582`、`case-arrangement.js:53`）。
- Produces: `CustomerUtils.getServiceLevelByCustomerName(customers, name) -> string`（查無回 `''`）。

- [ ] **Step 1: 寫失敗的測試 — 追加 Section 5**

在 `// === UI sections 由後續 Task 追加 ===` 之前插入：

```js
  console.log('\nSection 5｜getServiceLevelByCustomerName');
  await evaluate(`
    window.__custs = [
      { id: 'C1', name: '屈臣氏', serviceLevel: 'A 保修(一年四次)' },
      { id: 'C2', name: '統一超商', serviceLevel: '' }
    ];
    'ok'`);
  assertEq(await evaluate(`CustomerUtils.getServiceLevelByCustomerName(window.__custs, '屈臣氏')`),
    'A 保修(一年四次)', '命中客戶回其服務等級');
  assertEq(await evaluate(`CustomerUtils.getServiceLevelByCustomerName(window.__custs, '統一超商')`),
    '', '客戶服務等級為空字串時回空字串');
  assertEq(await evaluate(`CustomerUtils.getServiceLevelByCustomerName(window.__custs, '不存在')`),
    '', '查無客戶回空字串');
  assertEq(await evaluate(`CustomerUtils.getServiceLevelByCustomerName(null, '屈臣氏')`),
    '', 'customers 為 null 回空字串');
  assertEq(await evaluate(`typeof window.CUSTOMER_SERVICE_LEVEL_MAP`), 'undefined',
    'CUSTOMER_SERVICE_LEVEL_MAP 已刪除');

  console.log('\nSection 5｜五處呼叫點已改寫');
  const callSites = [
    ['src/features/repair/case-form.js', 2],
    ['src/features/project/project-form.js', 2],
    ['src/features/scheduling/case-arrangement.js', 1]
  ];
  for (const [rel, expectedCount] of callSites) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    assertEq((src.match(/CUSTOMER_SERVICE_LEVEL_MAP/g) || []).length, 0,
      `${rel} 不再引用 CUSTOMER_SERVICE_LEVEL_MAP`);
    assertEq((src.match(/getServiceLevelByCustomerName/g) || []).length, expectedCount,
      `${rel} 有 ${expectedCount} 處改用 getServiceLevelByCustomerName`);
    assertEq((src.match(/'D 維修\(無簽約客戶\)'/g) || []).length, 0,
      `${rel} 不再硬塞 D 維修(無簽約客戶) 作為 fallback`);
  }
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node scripts/verify-service-level-management.mjs`
Expected: Section 5 失敗（`CustomerUtils.getServiceLevelByCustomerName is not a function`）

- [ ] **Step 3: 在 `src/features/customer/customer-utils.js` 新增函式**

在 `getCustomerNameOptions` 之後、`window.CustomerUtils = {` 之前插入：

```js
  // 由客戶名稱查其服務等級；查無客戶或客戶未設定時回空字串
  function getServiceLevelByCustomerName(customers, name) {
    if (!name) return '';
    var customer = (customers || []).find(function (c) { return c && c.name === name; });
    return (customer && customer.serviceLevel) || '';
  }
```

並在 export 物件補上：

```js
    getServiceLevelByCustomerName: getServiceLevelByCustomerName,
```

- [ ] **Step 4: 改寫 5 處呼叫點**

`src/features/repair/case-form.js:98` 與 `:385`（兩處內容相同）：

```js
          formData.serviceLevel = CUSTOMER_SERVICE_LEVEL_MAP[value] || 'D 維修(無簽約客戶)';
```
→
```js
          formData.serviceLevel = CustomerUtils.getServiceLevelByCustomerName(customers, value);
```

`src/features/project/project-form.js:304`：

```js
          formData.serviceLevel = CUSTOMER_SERVICE_LEVEL_MAP[value] || 'D 維修(無簽約客戶)';
```
→
```js
          formData.serviceLevel = CustomerUtils.getServiceLevelByCustomerName(customers, value);
```

`src/features/project/project-form.js:645`：

```js
            detailsData.serviceLevel = CUSTOMER_SERVICE_LEVEL_MAP[value] || 'D 維修(無簽約客戶)';
```
→
```js
            detailsData.serviceLevel = CustomerUtils.getServiceLevelByCustomerName(customers, value);
```

`src/features/scheduling/case-arrangement.js:438`（保留「查無則沿用原值」的既有行為）：

```js
          scheduleModal.formData.serviceLevel = CUSTOMER_SERVICE_LEVEL_MAP[value] || scheduleModal.formData.serviceLevel;
```
→
```js
          scheduleModal.formData.serviceLevel =
            CustomerUtils.getServiceLevelByCustomerName(customers, value)
            || scheduleModal.formData.serviceLevel;
```

- [ ] **Step 5: 刪除 `CUSTOMER_SERVICE_LEVEL_MAP`**

刪除 `src/data/options.js:141-148` 整段：

```js
// 客戶名稱對應服務等級的映射表
const CUSTOMER_SERVICE_LEVEL_MAP = {
  '屈臣氏': 'A 保修(一年四次)',
  '星巴克': 'B 保修(一年兩次)',
  '萊爾富': 'C 保養(一年一次)',
  '統一超商': 'D 維修(無簽約客戶)',
  '全家便利商店': 'D 維修(無簽約客戶)'
};
```

- [ ] **Step 6: 執行測試確認通過**

Run:
```bash
node scripts/verify-service-level-management.mjs
node scripts/verify-case-return.mjs
node scripts/verify-repair-multi-assignee.mjs
```
Expected: 全部 `0 failed`

- [ ] **Step 7: 手動確認自動帶入**

Run: `open index.html`
Expected: 戰情室 → 案件處理 → 新增叫修單，選「星巴克」時「服務等級」自動變 `B 保修(一年兩次)`；選一個沒有對應客戶記錄的名稱時留空（不再硬塞 D）。

- [ ] **Step 8: Commit**

```bash
git add src/features/customer/customer-utils.js src/data/options.js \
  src/features/repair/case-form.js src/features/project/project-form.js \
  src/features/scheduling/case-arrangement.js scripts/verify-service-level-management.mjs
git commit -m "refactor: resolve service level from customers instead of hardcoded map"
```

---

## Task 6: 移除客戶的「保養區間」並改由服務等級驅動排程

**Files:**
- Modify: `src/features/customer/customer-form.js:23-24, 156-167`
- Modify: `src/data/options.js:60`（刪 `MAINTENANCE_INTERVAL_OPTIONS`）
- Modify: `src/data/seed.js`（customers 刪 `maintenanceInterval`）
- Modify: `src/features/scheduling/schedule-utils.js:7, 132-146, 236-251`
- Modify: `src/features/repair/maintenance.js:333-342`
- Modify: `src/features/scheduling/case-arrangement.js:716-722`
- Modify: `src/app.js:89`（`generateDueMaintenanceCases` 呼叫、`MaintenanceList`／`MaintenanceViewEditForm`／`CaseArrangement` 的 props）
- Modify: `scripts/verify-service-level-management.mjs`（追加 Section 6）

**Interfaces:**
- Consumes: `ServiceLevelUtils.getMaintenanceCount`、`.findPeriodForMonth`（Task 1）。
- Produces:
  - `ScheduleUtils.generateDueMaintenanceCases(customers, stores, existingCases, serviceLevels)` — 到期間隔＝`Math.round(12 / 每年保養次數)`，次數 0 或查無等級則不產生。
  - `ScheduleUtils.formatMaintenancePeriod(dateStr, serviceLevels, serviceLevelName) -> string` — 落在區間回 `YYYY 第N次`，否則回 `YYYY`，`dateStr` 為空回 `''`。
  - `MaintenanceList`／`MaintenanceViewEditForm`／`CaseArrangement` props 新增 `serviceLevels`。
  - customers 記錄不再有 `maintenanceInterval` 欄位。

- [ ] **Step 1: 寫失敗的測試 — 追加 Section 6**

在 `// === UI sections 由後續 Task 追加 ===` 之前插入：

```js
  console.log('\nSection 6｜客戶不再有 maintenanceInterval');
  assertEq(await evaluate(`INITIAL_CUSTOMERS.some(function (c) { return 'maintenanceInterval' in c; })`),
    false, 'seed 客戶已移除 maintenanceInterval');
  assertEq(await evaluate('typeof window.MAINTENANCE_INTERVAL_OPTIONS'), 'undefined',
    'MAINTENANCE_INTERVAL_OPTIONS 已刪除');
  const custFormSrc = readFileSync(join(ROOT, 'src/features/customer/customer-form.js'), 'utf8');
  assertEq((custFormSrc.match(/maintenanceInterval/g) || []).length, 0,
    'customer-form.js 已移除保養區間欄位');
  assertTrue(custFormSrc.includes("SERVICE_LEVEL_OPTIONS[0] || ''"),
    'customer-form.js 服務等級預設值改為 SERVICE_LEVEL_OPTIONS[0]');

  console.log('\nSection 6｜formatMaintenancePeriod 改吃服務等級');
  assertEq(await evaluate(`ScheduleUtils.formatMaintenancePeriod('2026-05-10', INITIAL_SERVICE_LEVELS, 'A 保修(一年四次)')`),
    '2026 第2次', 'A 的 5 月落在第 2 次');
  assertEq(await evaluate(`ScheduleUtils.formatMaintenancePeriod('2026-08-01', INITIAL_SERVICE_LEVELS, 'B 保修(一年兩次)')`),
    '2026 第2次', 'B 的 8 月落在第 2 次');
  assertEq(await evaluate(`ScheduleUtils.formatMaintenancePeriod('2026-08-01', INITIAL_SERVICE_LEVELS, 'D 維修(無簽約客戶)')`),
    '2026', 'D 無區間時只顯示年份');
  assertEq(await evaluate(`ScheduleUtils.formatMaintenancePeriod('', INITIAL_SERVICE_LEVELS, 'A 保修(一年四次)')`),
    '', '日期為空回空字串');
  assertEq(await evaluate(`ScheduleUtils.formatMaintenancePeriod('2026-05-10', INITIAL_SERVICE_LEVELS, '查無此等級')`),
    '2026', '查無等級只顯示年份');

  console.log('\nSection 6｜generateDueMaintenanceCases 改吃服務等級');
  const dueResult = await evaluate(`(function(){
    var levels = INITIAL_SERVICE_LEVELS;
    var customers = [
      { id: 'C1', name: '四次客', serviceLevel: 'A 保修(一年四次)', enabled: true },
      { id: 'C2', name: '零次客', serviceLevel: 'D 維修(無簽約客戶)', enabled: true },
      { id: 'C3', name: '停用客', serviceLevel: 'A 保修(一年四次)', enabled: false }
    ];
    var stores = [
      { id: 'S1', customerName: '四次客', storeName: '四次一店', storeStatus: '正常營業',
        lastMaintenanceDate: '2000-01', serviceLevel: 'A 保修(一年四次)' },
      { id: 'S2', customerName: '零次客', storeName: '零次一店', storeStatus: '正常營業',
        lastMaintenanceDate: '2000-01', serviceLevel: 'D 維修(無簽約客戶)' },
      { id: 'S3', customerName: '停用客', storeName: '停用一店', storeStatus: '正常營業',
        lastMaintenanceDate: '2000-01', serviceLevel: 'A 保修(一年四次)' }
    ];
    var out = ScheduleUtils.generateDueMaintenanceCases(customers, stores, [], levels);
    return out.map(function (c) { return c.storeName; });
  })()`);
  assertDeep(dueResult, ['四次一店'], '只為有保養次數且啟用的客戶產生到期保養案件');

  console.log('\nSection 6｜app.js 已往下傳 serviceLevels');
  const appSrc6 = readFileSync(join(ROOT, 'src/app.js'), 'utf8');
  assertTrue(appSrc6.includes('generateDueMaintenanceCases(INITIAL_CUSTOMERS, INITIAL_STORES, INITIAL_MAINTENANCE_CASES, INITIAL_SERVICE_LEVELS)'),
    'app.js 的 generateDueMaintenanceCases 已補傳 INITIAL_SERVICE_LEVELS');
  for (const comp of ['MaintenanceList', 'MaintenanceViewEditForm', 'CaseArrangement']) {
    const i = appSrc6.indexOf(comp + ', {');
    assertTrue(i !== -1 && appSrc6.slice(i, i + 500).includes('serviceLevels'),
      `app.js 的 ${comp} 呼叫含 serviceLevels`);
  }
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node scripts/verify-service-level-management.mjs`
Expected: Section 6 多項失敗

- [ ] **Step 3: `src/features/customer/customer-form.js` 移除保養區間**

`:23-24` 兩行：

```js
      serviceLevel: (targetCase && targetCase.serviceLevel) || 'A 保修(一年四次)',
      maintenanceInterval: (targetCase && targetCase.maintenanceInterval) || '每半年',
```

改成：

```js
      serviceLevel: (targetCase && targetCase.serviceLevel) || SERVICE_LEVEL_OPTIONS[0] || '',
```

刪除 `:156-167` 的整個「保養區間」欄位區塊：

```js
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '保養區間'),
              h('select', {
                name: 'maintenanceInterval',
                value: formData.maintenanceInterval,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none'
              }, MAINTENANCE_INTERVAL_OPTIONS.map(function (opt) {
                return h('option', { key: opt, value: opt }, opt);
              }))
            ),
```

- [ ] **Step 4: `src/data/options.js` 刪除 `MAINTENANCE_INTERVAL_OPTIONS`**

刪除 `:60` 這一行：

```js
const MAINTENANCE_INTERVAL_OPTIONS = ['每季', '每半年', '每年'];
```

- [ ] **Step 5: `src/data/seed.js` 移除 customers 的 `maintenanceInterval`**

```bash
cd /Users/kimoji/workspace/projects/iess-cases
sed -i '' "/^  maintenanceInterval: '/d" src/data/seed.js
grep -n 'maintenanceInterval' src/data/seed.js || echo 'seed 已清空'
```

Expected: 印出「seed 已清空」。

- [ ] **Step 6: `src/features/scheduling/schedule-utils.js` 改寫兩個函式**

刪除 `:7` 的：

```js
  var INTERVAL_MONTHS = { '每季': 3, '每半年': 6, '每年': 12 };
```

`:132` 的簽章與 `:141-143` 的間隔計算改成：

```js
  function generateDueMaintenanceCases(customers, stores, existingCases, serviceLevels) {
```

```js
      var cust = customerMap[store.customerName];
      if (!cust || cust.enabled === false) return;
      // 每年保養次數換算到期間隔月數；次數 0（或查無等級）代表不納入保養排程
      var visitsPerYear = ServiceLevelUtils.getMaintenanceCount(serviceLevels, cust.serviceLevel);
      if (!visitsPerYear) return;
      var months = Math.max(1, Math.round(12 / visitsPerYear));
```

`:236-251` 的 `formatMaintenancePeriod` 整個換成：

```js
  // 目前保養季度：依服務等級的保養區間，回傳「YYYY 第N次」；無區間或查無等級時只回年份
  function formatMaintenancePeriod(dateStr, serviceLevels, serviceLevelName) {
    if (!dateStr) return '';
    var year = parseInt(String(dateStr).slice(0, 4), 10);
    var month = parseInt(String(dateStr).slice(5, 7), 10);
    if (!year || !month) return '';
    var period = ServiceLevelUtils.findPeriodForMonth(serviceLevels, serviceLevelName, month);
    if (!period) return String(year);
    return year + ' 第' + period.visitIndex + '次';
  }
```

- [ ] **Step 7: `src/features/repair/maintenance.js` 改呼叫端**

`:333-342` 的：

```js
    function getMaintenanceInterval(c) {
      if (!customers || !c) return '';
      var customer = customers.find(function (cust) { return cust.name === c.customerName; });
      return customer ? customer.maintenanceInterval : '';
    }

    function getMaintenancePeriodLabel(c) {
      var refDate = ScheduleUtils.resolveMaintenanceReferenceDate(c);
      return ScheduleUtils.formatMaintenancePeriod(refDate, getMaintenanceInterval(c));
    }
```

改成：

```js
    function getMaintenancePeriodLabel(c) {
      var refDate = ScheduleUtils.resolveMaintenanceReferenceDate(c);
      var level = (c && c.serviceLevel)
        || CustomerUtils.getServiceLevelByCustomerName(customers, c && c.customerName);
      return ScheduleUtils.formatMaintenancePeriod(refDate, serviceLevels, level);
    }
```

並在 `MaintenanceViewEditForm` 取 props 的區塊（`:325` 的 `var customers = props.customers;` 附近）加上：

```js
    var serviceLevels = props.serviceLevels || [];
```

同樣在 `MaintenanceList`（`:65` 的 `var customers = props.customers;` 附近）加上：

```js
    var serviceLevels = props.serviceLevels || [];
```

（`MaintenanceList` 目前不直接用到，但 app.js 統一往下傳，保留解構以免日後遺漏。若 lint 無此需求可省略 `MaintenanceList` 這一行。）

- [ ] **Step 8: `src/features/scheduling/case-arrangement.js` 改呼叫端**

`:716-722` 的：

```js
        var customer = customers.find(function (c) { return c.name === formData.customerName; });
        var maintenanceInterval = customer ? customer.maintenanceInterval : '';
        var refDate = ScheduleUtils.resolveMaintenanceReferenceDate(formData);
        var periodLabel = ScheduleUtils.formatMaintenancePeriod(refDate, maintenanceInterval);
```

改成：

```js
        var levelName = formData.serviceLevel
          || CustomerUtils.getServiceLevelByCustomerName(customers, formData.customerName);
        var refDate = ScheduleUtils.resolveMaintenanceReferenceDate(formData);
        var periodLabel = ScheduleUtils.formatMaintenancePeriod(refDate, serviceLevels, levelName);
```

並在 `:57`（`var deviceCategories = props.deviceCategories || [];`）之後加上：

```js
    var serviceLevels = props.serviceLevels || [];
```

若 `var customer = …` 在同一函式的其他地方仍被使用，保留該行；否則一併刪除（先 `grep -n "var customer " src/features/scheduling/case-arrangement.js` 確認）。

- [ ] **Step 9: `src/app.js` 補傳 `serviceLevels`**

`:89`：

```js
    maintenanceCases: ScheduleUtils.generateDueMaintenanceCases(INITIAL_CUSTOMERS, INITIAL_STORES, INITIAL_MAINTENANCE_CASES),
```
→
```js
    maintenanceCases: ScheduleUtils.generateDueMaintenanceCases(INITIAL_CUSTOMERS, INITIAL_STORES, INITIAL_MAINTENANCE_CASES, INITIAL_SERVICE_LEVELS),
```

`case 'maintenance-list':`（`:357-362`）在 `customers: s.customers,` 之後加 `serviceLevels: s.serviceLevels,`。

**四處** `h(MaintenanceViewEditForm, {`（`:364`、`:369`、`:374`、`:456`）都在 `customers: s.customers,` 之後加 `serviceLevels: s.serviceLevels,`。

`case 'arrangement':` 的 `h(CaseArrangement, {`（`:530`）在 `deviceCategories: s.deviceCategories,` 之後加 `serviceLevels: s.serviceLevels,`。

- [ ] **Step 10: 執行測試確認通過**

Run:
```bash
node scripts/verify-service-level-management.mjs
node scripts/verify-case-return.mjs
node scripts/verify-case-record-points.mjs
node scripts/verify-repair-multi-assignee.mjs
```
Expected: 全部 `0 failed`

- [ ] **Step 11: 手動確認**

Run: `open index.html`
Expected: 客戶編輯表單不再有「保養區間」；戰情室 → 保養計劃進度 → 檢視任一案件，「目前保養季度」顯示 `2026 第N次`；Console 無錯誤。

- [ ] **Step 12: Commit**

```bash
git add src/features/customer/customer-form.js src/data/options.js src/data/seed.js \
  src/features/scheduling/schedule-utils.js src/features/repair/maintenance.js \
  src/features/scheduling/case-arrangement.js src/app.js scripts/verify-service-level-management.mjs
git commit -m "refactor: drive maintenance scheduling from service level periods"
```

---

## Task 7: 保養分配改用服務等級區間

**Files:**
- Modify: `src/features/permissions/maintenance-allocation-utils.js:7-21, 28-61, 143-155`
- Modify: `src/features/permissions/maintenance-allocation.js:2-3, 13-18, 72-88, 169-227, 260-281, 287-329`
- Modify: `src/app.js`（`MaintenanceAllocation` props）
- Modify: `scripts/verify-service-level-management.mjs`（追加 Section 7）

**Interfaces:**
- Consumes: `ServiceLevelUtils.isAllocatable`、`.getPeriods`、`.findPeriodForMonth`（Task 1）；`AssigneeUtils.getPerformanceAssignee`（既有）。
- Produces:
  - `MaintenanceAllocationUtils.isAllocatableServiceLevel(level, serviceLevels) -> boolean`
  - `.getCoveredStoresForAssignee(stores, assignee, customerName, serviceLevels) -> store[]`
  - `.getCustomerRows(assignee, customers, stores, serviceLevels) -> Array<{customerName, storeCount, serviceLevel}>`
  - `.countCompletedStores(maintenanceCases, assigneeName, customerName, period, year) -> number`
  - 不再 export `ALLOCATABLE_SERVICE_LEVELS`、`getVisitIndexOptions`
  - `MaintenanceAllocation` props 新增 `maintenanceCases`、`serviceLevels`

- [ ] **Step 1: 寫失敗的測試 — 追加 Section 7**

在 `// === UI sections 由後續 Task 追加 ===` 之前插入：

```js
  console.log('\nSection 7｜allocation utils');
  assertEq(await evaluate('typeof MaintenanceAllocationUtils.ALLOCATABLE_SERVICE_LEVELS'), 'undefined',
    'ALLOCATABLE_SERVICE_LEVELS 已移除');
  assertEq(await evaluate('typeof MaintenanceAllocationUtils.getVisitIndexOptions'), 'undefined',
    'getVisitIndexOptions 已移除');
  assertEq(await evaluate(`MaintenanceAllocationUtils.isAllocatableServiceLevel('C 保養(一年一次)', INITIAL_SERVICE_LEVELS)`),
    true, 'C 納入保養分配');
  assertEq(await evaluate(`MaintenanceAllocationUtils.isAllocatableServiceLevel('D 維修(無簽約客戶)', INITIAL_SERVICE_LEVELS)`),
    false, 'D 不納入保養分配');

  const rowShape = await evaluate(`(function(){
    var assignee = { id: 'A1', name: 'A組', districts: ['信義區'] };
    var customers = [{ id: 'C1', name: '甲', serviceLevel: 'B 保修(一年兩次)' }];
    var stores = [
      { id: 'S1', customerName: '甲', storeName: '甲一', serviceLevel: 'B 保修(一年兩次)',
        storeStatus: '正常營業', companyCity: '台北市', companyDistrict: '信義區' },
      { id: 'S2', customerName: '甲', storeName: '甲二', serviceLevel: 'B 保修(一年兩次)',
        storeStatus: '正常營業', companyCity: '台北市', companyDistrict: '信義區' },
      { id: 'S3', customerName: '甲', storeName: '甲三', serviceLevel: 'D 維修(無簽約客戶)',
        storeStatus: '正常營業', companyCity: '台北市', companyDistrict: '信義區' }
    ];
    return MaintenanceAllocationUtils.getCustomerRows(assignee, customers, stores, INITIAL_SERVICE_LEVELS);
  })()`);
  assertDeep(rowShape, [{ customerName: '甲', storeCount: 2, serviceLevel: 'B 保修(一年兩次)' }],
    'getCustomerRows 回傳 serviceLevel 且濾掉 D 等級門市');

  const completed = await evaluate(`(function(){
    var year = new Date().getFullYear();
    var cases = [
      { id: 'M1', customerName: '甲', storeName: '甲一', isClosed: true,
        completionDate: year + '-02-10', performanceAssignees: ['A組'] },
      { id: 'M2', customerName: '甲', storeName: '甲一', isClosed: true,
        completionDate: year + '-03-01', performanceAssignees: ['A組'] },
      { id: 'M3', customerName: '甲', storeName: '甲二', isClosed: true,
        planDate: year + '-01-15', performanceAssignees: ['A組'] },
      { id: 'M4', customerName: '甲', storeName: '甲三', isClosed: false,
        completionDate: year + '-02-10', performanceAssignees: ['A組'] },
      { id: 'M5', customerName: '甲', storeName: '甲四', isClosed: true,
        completionDate: year + '-05-10', performanceAssignees: ['A組'] },
      { id: 'M6', customerName: '乙', storeName: '乙一', isClosed: true,
        completionDate: year + '-02-10', performanceAssignees: ['A組'] },
      { id: 'M7', customerName: '甲', storeName: '甲五', isClosed: true,
        completionDate: year + '-02-10', performanceAssignees: ['B組'] },
      { id: 'M8', customerName: '甲', storeName: '甲六', isClosed: true,
        completionDate: (year - 1) + '-02-10', performanceAssignees: ['A組'] }
    ];
    var period = { visitIndex: 1, startMonth: 1, endMonth: 3 };
    return MaintenanceAllocationUtils.countCompletedStores(cases, 'A組', '甲', period, year);
  })()`);
  assertEq(completed, 2, 'countCompletedStores 計不重複門市（甲一、甲二），排除未結案／他客戶／他人員／跨年／區間外');

  console.log('\nSection 7｜保養分配表格');
  const grid = await evaluate(`(function(){
    var assignees = [{ id: 'A1', name: 'A組', districts: ['信義區'] }];
    var customers = [{ id: 'C1', name: '甲', serviceLevel: 'B 保修(一年兩次)' }];
    var stores = [
      { id: 'S1', customerName: '甲', storeName: '甲一', serviceLevel: 'B 保修(一年兩次)',
        storeStatus: '正常營業', companyCity: '台北市', companyDistrict: '信義區' },
      { id: 'S2', customerName: '甲', storeName: '甲二', serviceLevel: 'B 保修(一年兩次)',
        storeStatus: '正常營業', companyCity: '台北市', companyDistrict: '信義區' }
    ];
    var year = new Date().getFullYear();
    var maint = [{ id: 'M1', customerName: '甲', storeName: '甲一', isClosed: true,
      completionDate: year + '-02-10', performanceAssignees: ['A組'] }];
    window.__allocToasts = [];
    var node = MaintenanceAllocation({
      assignees: assignees, customers: customers, stores: stores,
      maintenanceCases: maint, serviceLevels: INITIAL_SERVICE_LEVELS,
      maintenanceAllocations: [], setMaintenanceAllocations: function () {},
      showToast: function (m, k) { window.__allocToasts.push([m, k || 'success']); }
    });
    document.body.appendChild(node);
    node.querySelector('select').value = 'A1';
    node.querySelector('select').dispatchEvent(new Event('change', { bubbles: true }));
    var row = node.querySelector('tbody tr');
    var badge = row.querySelector('span').textContent.trim();
    var tds = row.querySelectorAll('td');
    var monthCells = Array.prototype.slice.call(tds, 2);
    var out = {
      badge: badge,
      firstPeriodHeader: monthCells[0].textContent.trim(),
      secondPeriodHeader: monthCells[6].textContent.trim(),
      midCellHasHeader: monthCells[1].textContent.indexOf('第') !== -1
    };
    // 點第 2 月（在區間內）應開啟 Modal
    monthCells[1].querySelector('div').click();
    out.modalOpened = document.body.textContent.indexOf('編輯保養分配') !== -1
      || node.textContent.indexOf('編輯保養分配') !== -1;
    out.visitReadOnly = node.querySelectorAll('select').length;
    node.remove();
    return out;
  })()`);
  assertTrue(grid.badge === 'B 保修(一年兩次)', '列首 badge 顯示服務等級', grid.badge);
  assertTrue(grid.firstPeriodHeader.indexOf('第1次 1/2') === 0,
    '第 1 區間首欄顯示「第1次 1/2」', grid.firstPeriodHeader);
  assertTrue(grid.secondPeriodHeader.indexOf('第2次 0/2') === 0,
    '第 2 區間首欄顯示「第2次 0/2」', grid.secondPeriodHeader);
  assertEq(grid.midCellHasHeader, false, '非區間首欄不顯示小字標頭');
  assertEq(grid.modalOpened, true, '點區間內月份會開啟編輯 Modal');
  assertEq(grid.visitReadOnly, 1, 'Modal 內沒有保養次數下拉（僅剩指派人員下拉）');

  const outsideClick = await evaluate(`(function(){
    var assignees = [{ id: 'A1', name: 'A組', districts: ['信義區'] }];
    var customers = [{ id: 'C1', name: '甲', serviceLevel: 'E 半年檔' }];
    var levels = [{ id: 'SLE', name: 'E 半年檔', maintenanceCount: 1, countsBonusPoints: false,
      periods: [{ visitIndex: 1, startMonth: 1, endMonth: 6 }] }];
    var stores = [{ id: 'S1', customerName: '甲', storeName: '甲一', serviceLevel: 'E 半年檔',
      storeStatus: '正常營業', companyCity: '台北市', companyDistrict: '信義區' }];
    window.__allocToasts = [];
    var node = MaintenanceAllocation({
      assignees: assignees, customers: customers, stores: stores,
      maintenanceCases: [], serviceLevels: levels,
      maintenanceAllocations: [], setMaintenanceAllocations: function () {},
      showToast: function (m, k) { window.__allocToasts.push([m, k || 'success']); }
    });
    document.body.appendChild(node);
    node.querySelector('select').value = 'A1';
    node.querySelector('select').dispatchEvent(new Event('change', { bubbles: true }));
    var tds = node.querySelector('tbody tr').querySelectorAll('td');
    Array.prototype.slice.call(tds, 2)[11].querySelector('div').click();
    var out = { toasts: window.__allocToasts,
      modalOpened: node.textContent.indexOf('編輯保養分配') !== -1 };
    node.remove();
    return out;
  })()`);
  assertEq(outsideClick.modalOpened, false, '點區間外月份不開 Modal');
  assertDeep(outsideClick.toasts, [['此月份不在該服務等級的保養區間內', 'error']],
    '點區間外月份跳出提示 toast');

  console.log('\nSection 7｜app.js 已往下傳 maintenanceCases / serviceLevels');
  const appSrc7 = readFileSync(join(ROOT, 'src/app.js'), 'utf8');
  const allocIdx = appSrc7.indexOf('MaintenanceAllocation, {');
  assertTrue(appSrc7.slice(allocIdx, allocIdx + 500).includes('maintenanceCases'),
    'app.js 的 MaintenanceAllocation 呼叫含 maintenanceCases');
  assertTrue(appSrc7.slice(allocIdx, allocIdx + 500).includes('serviceLevels'),
    'app.js 的 MaintenanceAllocation 呼叫含 serviceLevels');
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node scripts/verify-service-level-management.mjs`
Expected: Section 7 多項失敗

- [ ] **Step 3: 改寫 `src/features/permissions/maintenance-allocation-utils.js`**

刪除 `:7-21`（`ALLOCATABLE_SERVICE_LEVELS`、`isAllocatableServiceLevel`、`getVisitIndexOptions`），改成：

```js
  function isAllocatableServiceLevel(level, serviceLevels) {
    return ServiceLevelUtils.isAllocatable(serviceLevels, level);
  }
```

`:28-36` 的 `getCoveredStoresForAssignee` 改成：

```js
  function getCoveredStoresForAssignee(stores, assignee, customerName, serviceLevels) {
    return (stores || []).filter(function (s) {
      if (customerName && s.customerName !== customerName) return false;
      if (!StoreUtils.isActiveStore(s)) return false;
      if (!isAllocatableServiceLevel(s.serviceLevel, serviceLevels)) return false;
      var area = StoreUtils.getStoreArea(s);
      return StoreUtils.assigneeCoversArea(assignee, area);
    });
  }
```

`:38-61` 的 `getCustomerRows` 改成：

```js
  /**
   * @returns {Array<{ customerName, storeCount, serviceLevel }>}
   */
  function getCustomerRows(assignee, customers, stores, serviceLevels) {
    if (!assignee) return [];
    var byCustomer = {};
    getCoveredStoresForAssignee(stores, assignee, null, serviceLevels).forEach(function (s) {
      if (!byCustomer[s.customerName]) byCustomer[s.customerName] = 0;
      byCustomer[s.customerName] += 1;
    });
    var rows = [];
    Object.keys(byCustomer).forEach(function (name) {
      var cust = (customers || []).find(function (c) { return c.name === name; });
      rows.push({
        customerName: name,
        storeCount: byCustomer[name],
        serviceLevel: (cust && cust.serviceLevel) || ''
      });
    });
    rows.sort(function (a, b) {
      return a.customerName.localeCompare(b.customerName, 'zh-Hant');
    });
    return rows;
  }

  /**
   * 該區間月份內、該指派人員 × 該客戶、已結案保養案件的不重複門市數。
   * 日期取 completionDate，無則取 planDate；年份限定為傳入的 year。
   */
  function countCompletedStores(maintenanceCases, assignee, customerName, period, year) {
    if (!period) return 0;
    var yearPrefix = String(year);
    var start = Number(period.startMonth);
    var end = Number(period.endMonth);
    var seen = {};
    (maintenanceCases || []).forEach(function (c) {
      if (!c || !c.isClosed) return;
      if (c.customerName !== customerName) return;
      if (AssigneeUtils.getPerformanceAssignee(c) !== assignee) return;
      var dateStr = String(c.completionDate || c.planDate || '');
      if (dateStr.slice(0, 4) !== yearPrefix) return;
      var month = Number(dateStr.slice(5, 7));
      if (!(month >= start && month <= end)) return;
      if (c.storeName) seen[c.storeName] = true;
    });
    return Object.keys(seen).length;
  }
```

export 物件（`:143-155`）刪掉 `ALLOCATABLE_SERVICE_LEVELS` 與 `getVisitIndexOptions` 兩行，加上：

```js
    countCompletedStores: countCompletedStores,
```

- [ ] **Step 4: 改寫 `src/features/permissions/maintenance-allocation.js`**

檔頭 props 註解（`:3`）改為：

```js
 * props: { assignees, customers, stores, maintenanceCases, serviceLevels, maintenanceAllocations, setMaintenanceAllocations, showToast }
```

在 `:17`（`var maintenanceAllocations = props.maintenanceAllocations || [];`）之前加入：

```js
    var maintenanceCases = props.maintenanceCases || [];
    var serviceLevels = props.serviceLevels || [];
```

在 `var MONTHS = …`（`:9`）之後加入區段底色常數：

```js
  var SEGMENT_BG = ['bg-sky-50/70', 'bg-amber-50/70'];
  var CURRENT_YEAR = new Date().getFullYear();
```

`:72-88` 的 `openEditModal` 改成：

```js
    function openEditModal(row, month) {
      var period = ServiceLevelUtils.findPeriodForMonth(serviceLevels, row.serviceLevel, month);
      if (!period) {
        showToast('此月份不在該服務等級的保養區間內', 'error');
        return false;
      }
      var existing = MaintenanceAllocationUtils.findAllocation(
        maintenanceAllocations,
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

在 `stateful(function (rerender) {` 內，`var rows = …`（`:95-97`）改成：

```js
      var rows = assignee
        ? MaintenanceAllocationUtils.getCustomerRows(assignee, customers, stores, serviceLevels)
        : [];
```

在 `renderMonthCell` 之前加入區段輔助函式：

```js
      // 依該列服務等級的保養區間，建出「月份 → { period, order }」的對照
      function buildSegmentMap(row) {
        var map = {};
        ServiceLevelUtils.getPeriods(serviceLevels, row.serviceLevel).forEach(function (p, order) {
          for (var m = Number(p.startMonth); m <= Number(p.endMonth); m++) {
            map[m] = { period: p, order: order };
          }
        });
        return map;
      }
```

`renderMonthCell` 改成收第三個參數 `segment`，並改 `<td>` 的樣式與小字標頭：

```js
      function renderMonthCell(row, month, segment) {
        var cell = MaintenanceAllocationUtils.findAllocation(
          maintenanceAllocations,
          selectedAssigneeId,
          row.customerName,
          month
        );
        var label = MaintenanceAllocationUtils.formatCellLabel(cell);

        var tdClass = 'p-2 align-top';
        var header = null;
        if (segment) {
          var period = segment.period;
          tdClass += ' ' + SEGMENT_BG[segment.order % SEGMENT_BG.length];
          if (Number(period.startMonth) === month) tdClass += ' border-l-2 border-l-blue-300';
          if (Number(period.endMonth) === month) tdClass += ' border-r-2 border-r-blue-300';
          if (Number(period.startMonth) === month) {
            var done = MaintenanceAllocationUtils.countCompletedStores(
              maintenanceCases, assignee && assignee.name, row.customerName, period, CURRENT_YEAR
            );
            header = h('div', { className: 'text-[11px] text-gray-500 mb-1 whitespace-nowrap' },
              '第' + period.visitIndex + '次 ' + done + '/' + row.storeCount);
          }
        }

        return h(
          'td',
          { key: month, className: tdClass },
          header,
          h(
            'div',
            {
              onClick: function () {
                syncScrollFromEl();
                openEditModal(row, month);
                rerender();
              },
              className: 'min-h-[68px] rounded-md border ' +
                (label
                  ? 'border-blue-200 bg-blue-50/70 hover:bg-blue-100/70'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/40') +
                ' px-2 py-2 cursor-pointer transition-colors'
            },
            h(
              'div',
              { className: 'flex items-start justify-between gap-2' },
              h(
                'div',
                { className: 'flex-1 min-w-0 text-xs leading-5 text-gray-700 break-words' },
                label || h('span', { className: 'text-gray-300' }, '')
              ),
              cell
                ? h(
                    'button',
                    {
                      type: 'button',
                      title: '刪除',
                      onClick: function (e) {
                        e.stopPropagation();
                        syncScrollFromEl();
                        deleteModal = {
                          customerName: row.customerName,
                          month: month,
                          label: row.customerName + ' ' + month + '月（' + label + '）'
                        };
                        rerender();
                      },
                      className: 'p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded transition-colors shrink-0'
                    },
                    Icons.Trash2({ className: 'h-3.5 w-3.5' })
                  )
                : null
            )
          )
        );
      }
```

`renderGrid` 的列渲染（`:260-281`）改成：

```js
                : rows.map(function (row) {
                    var segments = buildSegmentMap(row);
                    return h(
                      'tr',
                      { key: row.customerName, className: 'hover:bg-blue-50/40 transition-colors' },
                      h(
                        'td',
                        { className: 'p-3' },
                        h('div', { className: 'font-medium text-gray-800' }, row.customerName),
                        h(
                          'span',
                          {
                            className: 'inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium border border-gray-200 bg-gray-50 text-gray-600'
                          },
                          row.serviceLevel || '—'
                        )
                      ),
                      h('td', { className: 'p-3 text-center' }, String(row.storeCount)),
                      MONTHS.map(function (month) {
                        return renderMonthCell(row, month, segments[month] || null);
                      })
                    );
                  })
```

編輯 Modal 的「保養次數」下拉（`:311-329`）改成唯讀顯示：

```js
              h(
                'div',
                null,
                h('label', { className: 'block text-sm text-gray-600 mb-1' }, '保養次數'),
                h('div', { className: 'w-full p-2.5 border rounded-md bg-gray-50 text-gray-700' },
                  '第 ' + editModal.visitIndex + ' 次（'
                    + editModal.period.startMonth + '-' + editModal.period.endMonth + '月）')
              ),
```

- [ ] **Step 5: `src/app.js` 補傳 props**

`case 'maintenance-allocation':`（約 `src/app.js:708-715`）改成：

```js
      case 'maintenance-allocation':
        return h(MaintenanceAllocation, {
          assignees: s.assignees,
          customers: s.customers,
          stores: s.stores,
          maintenanceCases: s.maintenanceCases,
          serviceLevels: s.serviceLevels,
          maintenanceAllocations: s.maintenanceAllocations,
          setMaintenanceAllocations: setMaintenanceAllocations,
          showToast: showToast
        });
```

- [ ] **Step 6: 執行測試確認通過**

Run: `node scripts/verify-service-level-management.mjs`
Expected: PASS（`0 failed`）

- [ ] **Step 7: 手動確認保養分配畫面**

Run: `open index.html`
Expected: 系統權限 → 保養分配 → 選 A組：列首 badge 顯示服務等級名稱；月份儲存格依區間交替底色、區間首末有左右邊框；區間首欄上方有「第N次 x/y」；點區間外月份跳 toast 不開 Modal；開啟的 Modal 保養次數為唯讀「第 N 次（x-y月）」。

- [ ] **Step 8: Commit**

```bash
git add src/features/permissions/maintenance-allocation-utils.js \
  src/features/permissions/maintenance-allocation.js src/app.js \
  scripts/verify-service-level-management.mjs
git commit -m "feat: render maintenance allocation by service level periods"
```

---

## Task 8: 全量回歸與文件

**Files:**
- Modify: `README.md`（若其中有功能清單／模組說明）
- Verify: 全部 `scripts/verify-*.mjs`

- [ ] **Step 1: 確認舊符號已完全清除**

Run:
```bash
cd /Users/kimoji/workspace/projects/iess-cases
grep -rn 'CUSTOMER_SERVICE_LEVEL_MAP\|MAINTENANCE_INTERVAL_OPTIONS\|maintenanceInterval\|isServiceLevelCD\|ALLOCATABLE_SERVICE_LEVELS\|getVisitIndexOptions\|A 保修(一年一次)\|INTERVAL_MONTHS' src scripts index.html \
  || echo '所有舊符號已清除'
```
Expected: 印出「所有舊符號已清除」

- [ ] **Step 2: 跑全部驗證腳本**

Run:
```bash
for f in scripts/verify-*.mjs; do echo "=== $f"; node "$f" || exit 1; done
```
Expected: 每支皆 `0 failed`，迴圈跑完不中斷

- [ ] **Step 3: 手動巡一輪主要畫面**

Run: `open index.html`
Expected（每項都要親眼確認，Console 全程無錯誤）：
1. 系統權限 → 服務等級管理：列出四筆、可新增／編輯／刪除。
2. 客戶管理 → 編輯：服務等級下拉來自服務等級管理，無「保養區間」欄位。
3. 案件處理 → 新增叫修單：選客戶自動帶服務等級。
4. 案件銷案審核：總積分欄位有值。
5. 報表統計 → 案件績效統計：增額積分欄位有值。
6. 系統權限 → 保養分配：區間分段與「已完成/負責」顯示正確。
7. 系統權限 → 帳號管理 → 編輯帳號：權限樹中「系統權限」下有「服務等級管理」列。

- [ ] **Step 4: 更新 README（若有功能清單）**

Run: `grep -n '設備分類管理\|系統權限' README.md`

若 README 列有系統權限的子功能清單，在「設備分類管理」之後加入「服務等級管理」，並補一句說明：服務等級決定每年保養次數、保養區間與是否計算增額積分。若 README 無此清單則跳過本步驟。

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document service level management" || echo '無 README 變更，略過'
```

---

## Self-Review 記錄

**Spec 覆蓋檢查**

| Spec 段落 | 對應 Task |
|---|---|
| 目標 1（CRUD） | Task 2、Task 3 |
| 目標 2（四筆預設假資料） | Task 1 Step 6 |
| 目標 3（下拉供給＋自動帶入） | Task 1 Step 9（sync）、Task 5 |
| 目標 4（增額積分旗標） | Task 4 |
| 目標 5（次數與區間取代 A/B/C 清單與客戶保養區間） | Task 6、Task 7 |
| 目標 6（區間分段＋已完成/負責） | Task 7 |
| 資料模型 / seed 字串更新 | Task 1 Step 6-7 |
| 移除的常數 | Task 1 Step 5、Task 5 Step 5、Task 6 Step 4 |
| service-level-utils.js 全部 12 個函式 | Task 1 Step 3（含 Section 1 逐一測試） |
| validate 六條規則 | Task 1 Step 3、Task 3 Section 3 |
| service-level-list.js | Task 2 |
| service-level-form.js | Task 3 |
| 增額積分邏輯（含 case-review 註解與 props） | Task 4 |
| maintenance-allocation-utils.js | Task 7 Step 3 |
| maintenance-allocation.js | Task 7 Step 4 |
| 客戶端接線（下拉／預設值／5 處呼叫點） | Task 1 Step 9、Task 5、Task 6 Step 3 |
| 移除客戶的保養區間 | Task 6 |
| 選單與路由（options／sidebar／app／index.html） | Task 2、Task 3 |
| 驗證腳本 7 項涵蓋 | Section 1-7 對應 Task 1-7 |
| 回歸 7 支腳本 | Task 1 Step 11、Task 4 Step 9、Task 8 Step 2 |

**Spec 未涵蓋、本計劃補上的**：`schedule-utils.js` 的 `generateDueMaintenanceCases` 與 `formatMaintenancePeriod`，以及其在 `maintenance.js`／`case-arrangement.js` 的兩個呼叫端（Task 6）。spec 的 `PERMISSION_PAGES` 更正為 `PERMISSION_FUNCTIONS` + `PERMISSION_TREE`（Task 2 Step 5）。
