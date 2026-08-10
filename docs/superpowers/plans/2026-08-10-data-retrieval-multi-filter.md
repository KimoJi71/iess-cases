# 資料調閱多選篩選 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「報表 → 資料調閱」的全部篩選下拉選單改為多選，未選任何項目等同「全部」。

**Architecture:** 篩選狀態由字串（`'全部'` 或單值）改為字串陣列。`data-retrieval-utils.js` 的比對由 `===` 改為「陣列包含」，並新增兩支選項聯集 helper 供連動欄位使用。`data-retrieval.js` 的 `FilterSelect` 換成包裝 `IESS.MultiSelect` 的 `FilterMultiSelect`。

**Tech Stack:** 純瀏覽器端 ES5 IIFE 模組（無打包工具），`IESS.h` 自製渲染層，Tailwind CDN。驗證腳本為 Node `.mjs`：邏輯層用 `node:vm` 載入 IIFE，UI 層用 headless Chrome + CDP。

## Global Constraints

- 專案為 ES5 風格 IIFE，**不使用** `let`/`const`/箭頭函式/樣板字串於 `src/` 底下（`src/data/options.js` 的 `const` 為既有例外，不要跟進）。新程式碼一律 `var` + `function`。
- 每個模組以 `window.XxxUtils = {...}` 或 `window.Xxx = Xxx` 掛在全域，並在 `index.html` 以 `<script>` 依序載入。本計畫**不新增** `src/` 檔案，故 `index.html` 不需修改。
- `IESS.MultiSelect` 的 `props.id` 為必填字串，缺少會 `console.warn` 且選單無法跨 rerender 維持展開。
- 未選任何項目 = 全部。MultiSelect 的選項清單中**不得**出現「全部」這個選項；以 `placeholder: '全部'` 呈現。
- 同一欄位的多個選值取 OR，不同欄位之間取 AND。
- `src/core/searchable-select.js` 會把所有 `h('select', ...)` 升級成 combobox 元件，渲染後的 DOM 沒有原生 `<select>`。撰寫 UI 斷言時要以 `.multi-select` / `[role="combobox"]` 為準。
- 驗證腳本以 `node scripts/<name>.mjs` 執行，失敗時 `process.exit(1)`。

## File Structure

| 檔案 | 動作 | 責任 |
| --- | --- | --- |
| `src/features/reports/data-retrieval-utils.js` | 修改 | 篩選比對改陣列語意；新增連動欄位的選項聯集 helper |
| `src/features/reports/data-retrieval.js` | 修改 | `FilterMultiSelect` 元件、陣列狀態、連動清空、串接 helper |
| `scripts/verify-repair-multi-assignee.mjs` | 修改 | 既有測試呼叫 `filterRepairCases` 時的 filters 改成陣列 |
| `scripts/verify-data-retrieval-multi-filter.mjs` | 新增 | 邏輯層驗證（篩選語意 + 選項聯集） |
| `scripts/verify-data-retrieval-multi-filter-ui.mjs` | 新增 | headless Chrome 驗證（渲染成 MultiSelect、連動清空） |

---

### Task 1: 篩選比對改為陣列語意

**Files:**
- Modify: `src/features/reports/data-retrieval-utils.js`（`isAll` 與三支 filter 函式，約 9-100 行）
- Modify: `scripts/verify-repair-multi-assignee.mjs:192-202`
- Test: `scripts/verify-data-retrieval-multi-filter.mjs`（新增，本任務只寫第 1 部分）

**Interfaces:**
- Consumes: 無（第一個任務）
- Produces:
  - `DataRetrievalUtils.filterProjectCases(cases, filters)`
  - `DataRetrievalUtils.filterRepairCases(cases, filters)`
  - `DataRetrievalUtils.filterMaintenanceCases(cases, stores, filters)`
  - 三者的 `filters` 物件形狀不變，但 `workCategory` / `repairItem` / `repairReason` / `customer` / `store` / `assignee` / `serviceLevel` / `contactPerson` / `city` / `district` 全部改收 `string[]`；`startDate` / `endDate` 仍為 `'YYYY-MM-DD'` 字串。空陣列 = 不篩選。

- [ ] **Step 1: 寫失敗測試 —— 建立 `scripts/verify-data-retrieval-multi-filter.mjs`**

```js
#!/usr/bin/env node
/**
 * 資料調閱多選篩選：邏輯層驗證。
 * 以 node:vm 載入瀏覽器 IIFE 模組，斷言 DataRetrievalUtils 的陣列篩選語意。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0, failed = 0;
function pass(name, detail) {
  passed += 1;
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail) {
  failed += 1;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}
function assertEq(actual, expected, name) {
  if (actual === expected) pass(name, JSON.stringify(actual));
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertJson(actual, expected, name) {
  assertEq(JSON.stringify(actual), JSON.stringify(expected), name);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

function loadIife(relativePath, sandbox) {
  vm.runInContext(readFileSync(join(ROOT, relativePath), 'utf8'), sandbox, {
    filename: relativePath,
  });
}

function loadModules() {
  const sandbox = { console, window: {} };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  // 載入順序需與 index.html 一致：先 options（TAIWAN_CITY_DISTRICTS 等全域），
  // 再 store-utils，最後才是依賴前兩者的 data-retrieval-utils。
  loadIife('src/data/options.js', sandbox);
  loadIife('src/features/customer/store-utils.js', sandbox);
  loadIife('src/features/repair/case-assignee-utils.js', sandbox);
  loadIife('src/features/reports/data-retrieval-utils.js', sandbox);
  return { DRU: sandbox.DataRetrievalUtils, SU: sandbox.StoreUtils, sandbox };
}

// 一律帶滿的 filters 底稿，個別測試只覆寫關心的欄位。
function emptyFilters(overrides) {
  return Object.assign({
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    workCategory: [],
    repairItem: [],
    repairReason: [],
    customer: [],
    store: [],
    assignee: [],
    serviceLevel: [],
    contactPerson: [],
    city: [],
    district: [],
  }, overrides || {});
}

const REPAIR_CASES = [
  { id: 'R1', repairDate: '2026-08-01', workCategory: '一般叫修', repairItem: '冷氣不冷',
    repairReason: '缺冷媒', customerName: '甲客戶', storeName: '甲一店',
    assignees: ['A組', 'B組'], serviceLevel: 'A 尊榮' },
  { id: 'R2', repairDate: '2026-08-02', workCategory: '一般叫修', repairItem: '漏水',
    repairReason: '排水堵塞', customerName: '乙客戶', storeName: '乙一店',
    assignees: ['B組'], serviceLevel: 'B 進階' },
  { id: 'R3', repairDate: '2026-08-03', workCategory: '緊急叫修', repairItem: '冷氣不冷',
    repairReason: '缺冷媒', customerName: '丙客戶', storeName: '丙一店',
    assignees: ['C組'], serviceLevel: 'C 標準' },
  { id: 'R4', repairDate: '2026-08-04', workCategory: '保養', repairItem: '定保',
    repairReason: '例行', customerName: '甲客戶', storeName: '甲一店',
    assignees: ['A組'], serviceLevel: 'A 尊榮' },
];

function ids(list) {
  return list.map((c) => c.id).sort();
}

function testEmptyMeansAll(DRU) {
  console.log('\n1. 空陣列 = 全部');
  const all = DRU.filterRepairCases(REPAIR_CASES, emptyFilters());
  // R4 的 workCategory 為「保養」，filterRepairCases 一律排除，與篩選條件無關。
  assertJson(ids(all), ['R1', 'R2', 'R3'], '所有篩選為空時回傳全部非保養案件');
}

function testSingleFieldOr(DRU) {
  console.log('\n2. 單一欄位多值取 OR');
  const a = DRU.filterRepairCases(REPAIR_CASES, emptyFilters({ customer: ['甲客戶'] }));
  const b = DRU.filterRepairCases(REPAIR_CASES, emptyFilters({ customer: ['乙客戶'] }));
  const ab = DRU.filterRepairCases(REPAIR_CASES, emptyFilters({ customer: ['甲客戶', '乙客戶'] }));
  assertJson(ids(a), ['R1'], '單選甲客戶');
  assertJson(ids(b), ['R2'], '單選乙客戶');
  assertJson(ids(ab), ['R1', 'R2'], '多選 = 各自結果的聯集');
}

function testFieldsAreAnded(DRU) {
  console.log('\n3. 不同欄位之間取 AND');
  const r = DRU.filterRepairCases(REPAIR_CASES, emptyFilters({
    repairItem: ['冷氣不冷'],
    workCategory: ['緊急叫修'],
  }));
  assertJson(ids(r), ['R3'], '同時滿足叫修項目與工項分類');
}

function testRepairAssigneeMultiValue(DRU) {
  console.log('\n4. 維修人員多選命中多人指派案件');
  const a = DRU.filterRepairCases(REPAIR_CASES, emptyFilters({ assignee: ['A組'] }));
  assertJson(ids(a), ['R1'], 'A組 命中多人指派的 R1');
  const ac = DRU.filterRepairCases(REPAIR_CASES, emptyFilters({ assignee: ['A組', 'C組'] }));
  assertJson(ids(ac), ['R1', 'R3'], 'A組 + C組 取聯集');
  const legacy = DRU.filterRepairCases(
    [{ id: 'L1', repairDate: '2026-08-01', workCategory: '一般叫修', assignee: 'D組' }],
    emptyFilters({ assignee: ['D組'] })
  );
  assertJson(ids(legacy), ['L1'], '舊資料的單一 assignee 欄位仍可命中');
}

function testProjectAndMaintenance(DRU) {
  console.log('\n5. 工程與保養篩選');
  const projectCases = [
    { id: 'P1', creationDate: '2026-08-01', workCategory: '新設工程',
      customerName: '甲客戶', details: { contactPerson: '張三' } },
    { id: 'P2', creationDate: '2026-08-02', workCategory: '汰換工程',
      customerName: '乙客戶', stageAssignee: '李四' },
  ];
  assertJson(
    ids(DRU.filterProjectCases(projectCases, emptyFilters({ contactPerson: ['張三', '李四'] }))),
    ['P1', 'P2'],
    '負責人員多選同時吃 details.contactPerson 與 stageAssignee'
  );
  assertJson(
    ids(DRU.filterProjectCases(projectCases, emptyFilters({ workCategory: ['汰換工程'] }))),
    ['P2'],
    '工程類型單值'
  );

  const stores = [
    { id: 'S1', customerName: '甲客戶', storeName: '甲一店', companyCity: '臺北市', companyDistrict: '中正區' },
    { id: 'S2', customerName: '乙客戶', storeName: '乙一店', companyCity: '新北市', companyDistrict: '板橋區' },
  ];
  const maintenanceCases = [
    { id: 'M1', customerName: '甲客戶', storeName: '甲一店', assignee: 'A組',
      serviceLevel: 'A 尊榮', planDate: '2026-08-01' },
    { id: 'M2', customerName: '乙客戶', storeName: '乙一店', assignee: 'B組',
      serviceLevel: 'B 進階', planDate: '2026-08-02' },
  ];
  assertJson(
    ids(DRU.filterMaintenanceCases(maintenanceCases, stores, emptyFilters({ city: ['臺北市', '新北市'] }))),
    ['M1', 'M2'],
    '縣市多選取聯集'
  );
  assertJson(
    ids(DRU.filterMaintenanceCases(maintenanceCases, stores, emptyFilters({ assignee: ['B組'] }))),
    ['M2'],
    '保養維修人員單值'
  );
}

function main() {
  const { DRU } = loadModules();
  testEmptyMeansAll(DRU);
  testSingleFieldOr(DRU);
  testFieldsAreAnded(DRU);
  testRepairAssigneeMultiValue(DRU);
  testProjectAndMaintenance(DRU);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node scripts/verify-data-retrieval-multi-filter.mjs`
Expected: FAIL —— 目前 `isAll([])` 對空陣列回傳 `false`（空陣列是 truthy 且不等於 `'全部'`），於是每個欄位都被當成有值在篩，`c.workCategory !== []` 恆真，結果為 0 筆。第 1 組斷言會出現 `expected ["R1","R2","R3"], got []`。

- [ ] **Step 3: 改 `data-retrieval-utils.js` 的比對邏輯**

把 `isAll` 換成 `isAny`（`src/features/reports/data-retrieval-utils.js:9-11`）：

```js
  // 篩選值為 string[]；空陣列代表「全部」，不做篩選。
  function isAny(list) {
    return !list || !list.length;
  }

  function matches(list, value) {
    return isAny(list) || list.indexOf(value) !== -1;
  }
```

`filterProjectCases` 改為：

```js
  function filterProjectCases(cases, filters) {
    return (cases || []).filter(function (c) {
      if (!inDateRange(c.creationDate, filters.startDate, filters.endDate)) return false;
      if (!matches(filters.workCategory, c.workCategory)) return false;
      if (!matches(filters.customer, c.customerName)) return false;
      if (!isAny(filters.contactPerson)) {
        var person = (c.details && c.details.contactPerson) || c.stageAssignee || '';
        if (filters.contactPerson.indexOf(person) === -1) return false;
      }
      return true;
    }).sort(function (a, b) {
      return (b.creationDate || '').localeCompare(a.creationDate || '');
    });
  }
```

`filterRepairCases` 改為：

```js
  function filterRepairCases(cases, filters) {
    return (cases || []).filter(function (c) {
      if (c.workCategory === '保養') return false;
      if (!inDateRange(c.repairDate, filters.startDate, filters.endDate)) return false;
      if (!matches(filters.workCategory, c.workCategory)) return false;
      if (!matches(filters.repairItem, c.repairItem)) return false;
      if (!matches(filters.repairReason, c.repairReason)) return false;
      if (!matches(filters.customer, c.customerName)) return false;
      if (!matches(filters.store, c.storeName)) return false;
      if (!isAny(filters.assignee)) {
        // 任一已選人員命中即通過（案件可能多人指派）
        var hit = filters.assignee.some(function (name) {
          return window.CaseAssigneeUtils
            ? CaseAssigneeUtils.includesAssignee(c, name)
            : c.assignee === name;
        });
        if (!hit) return false;
      }
      if (!matches(filters.serviceLevel, c.serviceLevel)) return false;
      return true;
    }).sort(function (a, b) {
      return (b.repairDate || '').localeCompare(a.repairDate || '');
    });
  }
```

`filterMaintenanceCases` 改為：

```js
  function filterMaintenanceCases(cases, stores, filters) {
    return (cases || []).filter(function (c) {
      var loc = resolveMaintenanceLocation(c, stores);
      if (!matches(filters.city, loc.city)) return false;
      if (!matches(filters.district, loc.district)) return false;
      if (!matches(filters.customer, c.customerName)) return false;
      if (!matches(filters.assignee, c.assignee)) return false;
      if (!matches(filters.serviceLevel, c.serviceLevel)) return false;
      var date = getMaintenanceDate(c);
      if (!inDateRange(date, filters.startDate, filters.endDate)) return false;
      return true;
    }).sort(function (a, b) {
      return getMaintenanceDate(b).localeCompare(getMaintenanceDate(a));
    });
  }
```

- [ ] **Step 4: 修既有驗證腳本的呼叫端**

`scripts/verify-repair-multi-assignee.mjs:192-202` 的 filters 由字串改陣列：

```js
  const filtered = DRU.filterRepairCases(cases, {
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    workCategory: [],
    repairItem: [],
    repairReason: [],
    customer: [],
    store: [],
    assignee: ['A組'],
    serviceLevel: [],
  });
```

- [ ] **Step 5: 跑兩支測試確認通過**

Run: `node scripts/verify-data-retrieval-multi-filter.mjs && node scripts/verify-repair-multi-assignee.mjs`
Expected: 兩支都印出 `0 failed`，exit code 0。

- [ ] **Step 6: Commit**

```bash
git add src/features/reports/data-retrieval-utils.js scripts/verify-data-retrieval-multi-filter.mjs scripts/verify-repair-multi-assignee.mjs
git commit -m "feat: data retrieval filters accept multi-value arrays"
```

---

### Task 2: 連動欄位的選項聯集 helper

**Files:**
- Modify: `src/features/reports/data-retrieval-utils.js`（新增兩支 helper 與 export）
- Test: `scripts/verify-data-retrieval-multi-filter.mjs`（追加第 6 組測試）

**Interfaces:**
- Consumes: Task 1 的 `DataRetrievalUtils` 模組與其 export 區塊；`StoreUtils.getActiveStores(stores)`、`StoreUtils.getStoreNameOptions(stores, customerName, selectedStoreName, includeClosed)`、`StoreUtils.getDistrictsForCity(city)`（皆為既有，不修改）
- Produces:
  - `DataRetrievalUtils.getStoreOptionsForCustomers(stores, customerNames) -> string[]`
  - `DataRetrievalUtils.getDistrictOptionsForCities(cityNames) -> string[]`

- [ ] **Step 1: 寫失敗測試 —— 在 `scripts/verify-data-retrieval-multi-filter.mjs` 追加**

在 `main()` 之前加入：

```js
const STORES = [
  { id: 'S1', customerName: '甲客戶', storeName: '甲一店', storeStatus: '營業' },
  { id: 'S2', customerName: '甲客戶', storeName: '甲二店', storeStatus: '營業' },
  { id: 'S3', customerName: '乙客戶', storeName: '乙一店', storeStatus: '營業' },
  { id: 'S4', customerName: '乙客戶', storeName: '甲一店', storeStatus: '營業' },
  { id: 'S5', customerName: '丙客戶', storeName: '丙一店', storeStatus: '撤店' },
];

function testCascadeOptions(DRU, SU) {
  console.log('\n6. 連動欄位的選項聯集');
  assertJson(
    DRU.getStoreOptionsForCustomers(STORES, []),
    ['乙一店', '甲一店', '甲二店'],
    '未選客戶時列出所有營業中門市（去重排序，撤店不列）'
  );
  assertJson(
    DRU.getStoreOptionsForCustomers(STORES, ['甲客戶']),
    ['甲一店', '甲二店'],
    '單選客戶'
  );
  assertJson(
    DRU.getStoreOptionsForCustomers(STORES, ['甲客戶', '乙客戶']),
    ['乙一店', '甲一店', '甲二店'],
    '多客戶取聯集，同名門市只出現一次'
  );

  assertJson(DRU.getDistrictOptionsForCities([]), [], '未選縣市時行政區為空');
  const taipei = SU.getDistrictsForCity('臺北市');
  const newTaipei = SU.getDistrictsForCity('新北市');
  const union = DRU.getDistrictOptionsForCities(['臺北市', '新北市']);
  assertEq(union.length, taipei.length + newTaipei.length, '兩縣市行政區數量相加');
  assertTrue(
    taipei.every((d) => union.indexOf(d) !== -1) && newTaipei.every((d) => union.indexOf(d) !== -1),
    '聯集包含兩個縣市的全部行政區'
  );
  assertEq(new Set(union).size, union.length, '行政區聯集無重複');
}
```

並在 `main()` 內接上（同時把 `SU` 解構出來）：

```js
function main() {
  const { DRU, SU } = loadModules();
  testEmptyMeansAll(DRU);
  testSingleFieldOr(DRU);
  testFieldsAreAnded(DRU);
  testRepairAssigneeMultiValue(DRU);
  testProjectAndMaintenance(DRU);
  testCascadeOptions(DRU, SU);
  ...
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node scripts/verify-data-retrieval-multi-filter.mjs`
Expected: FAIL —— `TypeError: DRU.getStoreOptionsForCustomers is not a function`

- [ ] **Step 3: 在 `data-retrieval-utils.js` 實作 helper**

放在 `filterMaintenanceCases` 之後：

```js
  function sortZhHant(names) {
    return names.sort(function (a, b) { return a.localeCompare(b, 'zh-Hant'); });
  }

  // 客戶名稱為多選：門市選項取所有已選客戶的門市聯集。
  // 未選客戶時沿用「所有營業中門市」。
  function getStoreOptionsForCustomers(stores, customerNames) {
    var names = [];
    var seen = {};
    function push(name) {
      if (name && !seen[name]) {
        seen[name] = true;
        names.push(name);
      }
    }
    if (!customerNames || !customerNames.length) {
      StoreUtils.getActiveStores(stores).forEach(function (s) { push(s.storeName); });
      return sortZhHant(names);
    }
    customerNames.forEach(function (customerName) {
      StoreUtils.getStoreNameOptions(stores, customerName, null, true).forEach(push);
    });
    return sortZhHant(names);
  }

  // 縣市為多選：行政區選項取所有已選縣市的聯集，未選縣市時為空。
  function getDistrictOptionsForCities(cityNames) {
    var districts = [];
    var seen = {};
    (cityNames || []).forEach(function (city) {
      StoreUtils.getDistrictsForCity(city).forEach(function (d) {
        if (d && !seen[d]) {
          seen[d] = true;
          districts.push(d);
        }
      });
    });
    return districts;
  }
```

並加進檔尾的 export 物件：

```js
    getStoreOptionsForCustomers: getStoreOptionsForCustomers,
    getDistrictOptionsForCities: getDistrictOptionsForCities,
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node scripts/verify-data-retrieval-multi-filter.mjs`
Expected: PASS，`0 failed`。

若「多客戶取聯集」失敗且實際值含重複的「甲一店」，代表 `push` 的去重沒生效——確認 `seen` 是在函式內宣告而非每次呼叫都重建成 `{}` 以外的東西。

- [ ] **Step 5: Commit**

```bash
git add src/features/reports/data-retrieval-utils.js scripts/verify-data-retrieval-multi-filter.mjs
git commit -m "feat: add cascade option union helpers for data retrieval"
```

---

### Task 3: UI 改為 MultiSelect

**Files:**
- Modify: `src/features/reports/data-retrieval.js`（`FilterSelect` → `FilterMultiSelect`、狀態、三支 render 函式）
- Test: 本任務以 Task 4 的 headless Chrome 腳本驗證；本任務結束時先做一次人工檢查。

**Interfaces:**
- Consumes: Task 1 的 `filters` 陣列形狀；Task 2 的 `DataRetrievalUtils.getStoreOptionsForCustomers` / `getDistrictOptionsForCities`；`IESS.MultiSelect({ id, options, value, onChange, placeholder, disabled, className })`
- Produces: `window.DataRetrieval`（props 不變：`{ cases, maintenanceCases, projectCases, customers, stores, showToast }`）

- [ ] **Step 1: 用 `FilterMultiSelect` 取代 `FilterSelect`**

`src/features/reports/data-retrieval.js:12-26` 整段換成：

```js
  function FilterMultiSelect(props) {
    return h('div', { className: props.className || 'min-w-0' },
      h('label', { className: labelCls }, props.label),
      IESS.MultiSelect({
        id: props.id,
        options: props.options || [],
        value: props.value || [],
        onChange: props.onChange,
        placeholder: '全部'
      })
    );
  }
```

`FilterDateRange` 不動。

- [ ] **Step 2: 狀態初始值改為空陣列**

`data-retrieval.js:60-69` 的 11 個變數初始值由 `'全部'` 改為 `[]`：

```js
    var filterWorkCategory = [];
    var filterRepairItem = [];
    var filterRepairReason = [];
    var filterCustomer = [];
    var filterStore = [];
    var filterAssignee = [];
    var filterServiceLevel = [];
    var filterContactPerson = [];
    var filterCity = [];
    var filterDistrict = [];
```

`handleCaseTypeChange`（`data-retrieval.js:79-93`）內同樣 10 行由 `'全部'` 改為 `[]`。`getCurrentFilters()` 不需修改。

- [ ] **Step 3: 選項來源改用 Task 2 的 helper**

`data-retrieval.js:124-136` 換成：

```js
      var customerOptions = CustomerUtils.getCustomerNameOptions(customers, null, true);
      var storeOptions = DataRetrievalUtils.getStoreOptionsForCustomers(stores, filterCustomer);
      var districtOptions = DataRetrievalUtils.getDistrictOptionsForCities(filterCity);
```

（`getCustomerNameOptions` 的第二個參數原本用來保留「已選但已不在清單」的舊值；多選後選值一律出自當下清單，傳 `null`。）

- [ ] **Step 4: 三支 render 函式改用 FilterMultiSelect**

`renderProjectFilters`（`data-retrieval.js:174-203`）：

```js
      function renderProjectFilters() {
        return h('div', {
          className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end'
        },
          FilterMultiSelect({
            id: 'dr-workCategory',
            label: '工程類型',
            value: filterWorkCategory,
            onChange: function (next) { filterWorkCategory = next; rerender(); },
            options: PROJECT_WORK_CATEGORIES
          }),
          FilterMultiSelect({
            id: 'dr-contactPerson',
            label: '負責人員',
            value: filterContactPerson,
            onChange: function (next) { filterContactPerson = next; rerender(); },
            options: PROJECT_ASSIGNEES.slice()
          }),
          FilterMultiSelect({
            id: 'dr-customer',
            label: '客戶名稱',
            value: filterCustomer,
            onChange: function (next) { filterCustomer = next; rerender(); },
            options: customerOptions
          }),
          FilterDateRange({
            startValue: startDate,
            endValue: endDate,
            onStartChange: function (e) { startDate = e.target.value; rerender(); },
            onEndChange: function (e) { endDate = e.target.value; rerender(); }
          })
        );
      }
```

`renderRepairFilters`（`data-retrieval.js:205-262`）：

```js
      function renderRepairFilters() {
        return h('div', {
          className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end'
        },
          FilterMultiSelect({
            id: 'dr-workCategory',
            label: '工項分類',
            value: filterWorkCategory,
            onChange: function (next) { filterWorkCategory = next; rerender(); },
            options: repairWorkCategories
          }),
          FilterMultiSelect({
            id: 'dr-repairItem',
            label: '叫修項目',
            value: filterRepairItem,
            onChange: function (next) { filterRepairItem = next; rerender(); },
            options: REPAIR_ITEMS
          }),
          FilterMultiSelect({
            id: 'dr-repairReason',
            label: '叫修原因',
            value: filterRepairReason,
            onChange: function (next) { filterRepairReason = next; rerender(); },
            options: REPAIR_REASONS
          }),
          FilterMultiSelect({
            id: 'dr-customer',
            label: '客戶名稱',
            value: filterCustomer,
            onChange: function (next) {
              filterCustomer = next;
              filterStore = [];
              rerender();
            },
            options: customerOptions
          }),
          FilterMultiSelect({
            id: 'dr-store',
            label: '門市名稱',
            value: filterStore,
            onChange: function (next) { filterStore = next; rerender(); },
            options: storeOptions
          }),
          FilterMultiSelect({
            id: 'dr-assignee',
            label: '維修人員',
            value: filterAssignee,
            onChange: function (next) { filterAssignee = next; rerender(); },
            options: assigneeOptions
          }),
          FilterMultiSelect({
            id: 'dr-serviceLevel',
            label: '服務等級',
            value: filterServiceLevel,
            onChange: function (next) { filterServiceLevel = next; rerender(); },
            options: SERVICE_LEVEL_OPTIONS
          }),
          FilterDateRange({
            startValue: startDate,
            endValue: endDate,
            onStartChange: function (e) { startDate = e.target.value; rerender(); },
            onEndChange: function (e) { endDate = e.target.value; rerender(); }
          })
        );
      }
```

`renderMaintenanceFilters`（`data-retrieval.js:264-309`）：

```js
      function renderMaintenanceFilters() {
        return h('div', {
          className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end'
        },
          FilterMultiSelect({
            id: 'dr-city',
            label: '縣市',
            value: filterCity,
            onChange: function (next) {
              filterCity = next;
              filterDistrict = [];
              rerender();
            },
            options: TAIWAN_CITY_OPTIONS
          }),
          FilterMultiSelect({
            id: 'dr-district',
            label: '行政區',
            value: filterDistrict,
            onChange: function (next) { filterDistrict = next; rerender(); },
            options: districtOptions
          }),
          FilterMultiSelect({
            id: 'dr-customer',
            label: '客戶名稱',
            value: filterCustomer,
            onChange: function (next) { filterCustomer = next; rerender(); },
            options: customerOptions
          }),
          FilterMultiSelect({
            id: 'dr-assignee',
            label: '維修人員',
            value: filterAssignee,
            onChange: function (next) { filterAssignee = next; rerender(); },
            options: assigneeOptions
          }),
          FilterMultiSelect({
            id: 'dr-serviceLevel',
            label: '服務等級',
            value: filterServiceLevel,
            onChange: function (next) { filterServiceLevel = next; rerender(); },
            options: SERVICE_LEVEL_OPTIONS
          }),
          FilterDateRange({
            startValue: startDate,
            endValue: endDate,
            onStartChange: function (e) { startDate = e.target.value; rerender(); },
            onEndChange: function (e) { endDate = e.target.value; rerender(); }
          })
        );
      }
```

- [ ] **Step 5: 確認檔案裡沒有殘留的 `'全部'` 與 `FilterSelect`**

Run: `grep -n "'全部'\|FilterSelect" src/features/reports/data-retrieval.js`
Expected: 無輸出。

- [ ] **Step 6: 邏輯層測試仍需通過**

Run: `node scripts/verify-data-retrieval-multi-filter.mjs && node scripts/verify-repair-multi-assignee.mjs`
Expected: 兩支都 `0 failed`。

- [ ] **Step 7: Commit**

```bash
git add src/features/reports/data-retrieval.js
git commit -m "feat: render data retrieval filters as multi-selects"
```

---

### Task 4: UI 驗證（headless Chrome）

**Files:**
- Create: `scripts/verify-data-retrieval-multi-filter-ui.mjs`

**Interfaces:**
- Consumes: Task 3 完成後的 `window.DataRetrieval`；`index.html` 已載入的全域（`IESS`、`DataRetrievalUtils`、`CustomerUtils`、`StoreUtils`、`TAIWAN_CITY_OPTIONS`、`ASSIGNEES`）
- Produces: 無（僅驗證）

- [ ] **Step 1: 建立 `scripts/verify-data-retrieval-multi-filter-ui.mjs`**

```js
#!/usr/bin/env node
/**
 * 資料調閱多選篩選：UI 驗證。
 * 啟動 headless Chrome 載入 index.html，渲染真實的 DataRetrieval 元件後斷言 DOM。
 * 參考 scripts/verify-equipment-level-ui.mjs 的 CDP 連線流程。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9334);

if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

let passed = 0, failed = 0;
const pass = (n, d) => { passed++; console.log(`  ✓ ${n}${d ? ` — ${d}` : ''}`); };
const fail = (n, d) => { failed++; console.error(`  ✗ ${n}${d ? ` — ${d}` : ''}`); };
function assertEq(actual, expected, name) {
  if (actual === expected) pass(name, JSON.stringify(actual));
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-dr-ui-profile',
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

// 在頁面裡渲染 DataRetrieval 並掛到 document.body，回傳一段可重複使用的前置程式碼。
const MOUNT = `
  window.__stores = [
    { id:'S1', customerName:'甲客戶', storeName:'甲一店', storeStatus:'營業',
      companyCity:'臺北市', companyDistrict:'中正區' },
    { id:'S2', customerName:'甲客戶', storeName:'甲二店', storeStatus:'營業',
      companyCity:'臺北市', companyDistrict:'大安區' },
    { id:'S3', customerName:'乙客戶', storeName:'乙一店', storeStatus:'營業',
      companyCity:'新北市', companyDistrict:'板橋區' }
  ];
  window.__mount = function () {
    var host = document.getElementById('dr-host');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'dr-host';
    document.body.appendChild(host);
    host.appendChild(DataRetrieval({
      cases: [], maintenanceCases: [], projectCases: [],
      customers: [{ id:'C1', name:'甲客戶' }, { id:'C2', name:'乙客戶' }],
      stores: window.__stores,
      showToast: function () {}
    }));
    return host;
  };
`;

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
  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');
  await evaluate(MOUNT + "'ok'");
  const assigneeFirst = await evaluate('ASSIGNEES[0]');

  console.log('\n1. 篩選欄位渲染為 MultiSelect');
  const rendered = await evaluate(`(function () {
    var host = window.__mount();
    var labels = Array.prototype.map.call(
      host.querySelectorAll('label'), function (l) { return l.textContent.trim(); });
    var multi = host.querySelectorAll('.multi-select').length;
    var placeholders = Array.prototype.map.call(
      host.querySelectorAll('.multi-select__placeholder'),
      function (p) { return p.textContent.trim(); });
    return { labels: labels, multi: multi, placeholders: placeholders };
  })()`);
  // 預設案件類型為「維修」：工項分類/叫修項目/叫修原因/客戶名稱/門市名稱/維修人員/服務等級 = 7 個
  assertEq(rendered.multi, 7, '維修篩選區有 7 個 MultiSelect');
  assertTrue(rendered.labels.includes('維修人員'), '有「維修人員」欄位', rendered.labels.join(' | '));
  assertTrue(
    rendered.placeholders.length === 7 && rendered.placeholders.every(p => p === '全部'),
    '未選時全部顯示 placeholder「全部」',
    JSON.stringify(rendered.placeholders)
  );

  console.log('\n2. 選取後以 chip 呈現，且可多選');
  const chips = await evaluate(`(function () {
    var host = window.__mount();
    var roots = host.querySelectorAll('.multi-select');
    // 第 6 個（index 5）為「維修人員」
    var control = roots[5].querySelector('.multi-select__control');
    control.click();
    return new Promise(function (resolve) {
      setTimeout(function () {
        var opts = document.querySelectorAll('.multi-select__menu .multi-select__option');
        opts[0].click();
        setTimeout(function () {
          var control2 = host.querySelectorAll('.multi-select')[5]
            .querySelector('.multi-select__control');
          control2.click();
          setTimeout(function () {
            var opts2 = document.querySelectorAll('.multi-select__menu .multi-select__option');
            opts2[1].click();
            setTimeout(function () {
              var texts = Array.prototype.map.call(
                host.querySelectorAll('.multi-select')[5].querySelectorAll('.multi-select__chip'),
                function (c) { return c.textContent.replace('×', '').trim(); });
              resolve(texts);
            }, 50);
          }, 50);
        }, 50);
      }, 50);
    });
  })()`);
  assertEq(chips.length, 2, '維修人員可同時選兩位', JSON.stringify(chips));
  assertEq(chips[0], assigneeFirst, '第一個 chip 為選單第一項');

  console.log('\n3. 客戶改變時清空門市，且門市選項為聯集');
  const cascade = await evaluate(`(function () {
    var host = window.__mount();
    function ms(i) { return host.querySelectorAll('.multi-select')[i]; }
    function openAndClick(index, optionIndex) {
      ms(index).querySelector('.multi-select__control').click();
      return new Promise(function (resolve) {
        setTimeout(function () {
          var opts = document.querySelectorAll('.multi-select__menu .multi-select__option');
          opts[optionIndex].click();
          setTimeout(resolve, 50);
        }, 50);
      });
    }
    // index 3 = 客戶名稱, index 4 = 門市名稱
    return openAndClick(3, 0)                       // 選甲客戶
      .then(function () { return openAndClick(4, 0); })  // 選甲客戶底下第一間門市
      .then(function () {
        var storeChips = ms(4).querySelectorAll('.multi-select__chip').length;
        return openAndClick(3, 1).then(function () {  // 再加選乙客戶 -> 應清空門市
          ms(4).querySelector('.multi-select__control').click();
          return new Promise(function (resolve) {
            setTimeout(function () {
              var opts = Array.prototype.map.call(
                document.querySelectorAll('.multi-select__menu .multi-select__option'),
                function (o) { return o.textContent.trim(); });
              resolve({
                storeChipsBefore: storeChips,
                storeChipsAfter: ms(4).querySelectorAll('.multi-select__chip').length,
                storeOptions: opts
              });
            }, 50);
          });
        });
      });
  })()`);
  assertEq(cascade.storeChipsBefore, 1, '選客戶後可選到門市');
  assertEq(cascade.storeChipsAfter, 0, '客戶變動後門市被清空');
  assertTrue(
    cascade.storeOptions.includes('甲一店')
      && cascade.storeOptions.includes('甲二店')
      && cascade.storeOptions.includes('乙一店'),
    '門市選項為兩客戶的聯集',
    JSON.stringify(cascade.storeOptions)
  );

  assertEq(consoleErrors.length, 0, '互動過程無 JS 錯誤');
} catch (err) {
  fail('腳本執行例外', err.message);
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: 跑 UI 驗證**

Run: `node scripts/verify-data-retrieval-multi-filter-ui.mjs`
Expected: 全部 PASS，`0 failed`。

若 `.multi-select` 數量對不上，先確認預設案件類型仍是「維修」（`data-retrieval.js` 的 `var caseType = '維修';`）。
若選單抓不到 `.multi-select__menu`，記得選單是 portal 掛在 `document.body` 上，不在 `host` 裡面 —— 查詢時要用 `document.querySelectorAll` 而非 `host.querySelectorAll`。

- [ ] **Step 3: 跑全部驗證腳本**

Run: `node scripts/verify-data-retrieval-multi-filter.mjs && node scripts/verify-repair-multi-assignee.mjs && node scripts/verify-data-retrieval-multi-filter-ui.mjs`
Expected: 三支都 `0 failed`。

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-data-retrieval-multi-filter-ui.mjs
git commit -m "test: UI verification for data retrieval multi-select filters"
```

---

## 人工驗收清單

在瀏覽器開啟 `index.html` → 報表 → 資料調閱：

- [ ] 三種案件類型（維修／保養／工程）的每個篩選欄位都是多選，未選時顯示「全部」。
- [ ] 選單中沒有「全部」這個選項。
- [ ] 選多個維修人員後查詢，結果包含任一人參與的案件。
- [ ] 客戶名稱選兩家後，門市下拉列出兩家的門市聯集。
- [ ] 客戶名稱一改動，已選的門市 chips 被清空。
- [ ] 縣市未選時行政區為空清單；選兩個縣市後為聯集。
- [ ] 查詢結果筆數與匯出的 CSV 內容一致。
