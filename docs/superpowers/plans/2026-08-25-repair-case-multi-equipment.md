# 叫修案件多筆設備資料 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓一張叫修案件可加入多筆設備，每筆設備各自帶一份服務項目（實際維修原因＋處理方式清單）。

**Architecture:** 案件的 `equipment` / `actualReason` / `processRecords` 三個單一欄位改由
`serviceItems[]` 陣列承載。遷移邏輯集中在 `CaseAssigneeUtils.normalizeRepairCase()`
（全站唯一鎖點，seed 與所有表單存檔都會經過），舊資料自動摺成單筆卡片，seed.js 不需改寫。
讀取端改用新的 `window.RepairCaseServiceItems` 聚合 helper。

**Tech Stack:** 原生 ES5 風格 JavaScript（無框架、無建置），以 IIFE 掛 `window.*`；
`IESS.h()` 建 DOM、`stateful()` 管元件狀態；Tailwind CDN。
測試分兩種：純 Node `vm` 沙箱（utils）與 headless Chrome CDP（UI），皆為 `scripts/verify-*.mjs`。

**Spec:** `docs/superpowers/specs/2026-08-25-repair-case-multi-equipment-design.md`

## Global Constraints

- 語言：**ES5 風格**。不可用 `let`／`const`／箭頭函式／樣板字串／`class`／解構。
  既有檔案一律 `var` + `function`，新檔案必須一致。
- 檔案格式：IIFE `(function () { 'use strict'; ... })();`，最後掛到 `window.<Name>`。
- 註解：繁體中文，只寫「為什麼」，不複述程式碼。
- **無建置步驟**：新檔案必須手動加進 `index.html` 的 `<script>` 載入順序。
- 案件物件上 **不保留** `equipment`／`actualReason`／`processRecords`；不做雙寫。
- 處理方式單筆（process record）的格式**完全不變**，仍由 `ProcessMethodUtils` 產生與判讀。
- 執行驗證腳本：`node scripts/verify-xxx.mjs`。CDP 腳本需要 Chrome，
  路徑可用 `CHROME_PATH` 覆寫；每支腳本的 `CDP_PORT` 必須與其他腳本不同。
- 每個 Task 結束一定要 commit。

---

### Task 1: `RepairCaseServiceItems` helper 與資料遷移

**Files:**
- Create: `src/features/repair/case-service-items.js`
- Modify: `src/features/repair/case-assignee-utils.js`（`normalizeRepairCase`，約 line 94-115）
- Modify: `index.html`（在 `src/features/repair/case-assignee-utils.js` 之前插入新檔）
- Test: `scripts/verify-case-service-items.mjs`

**Interfaces:**
- Consumes: 無（本任務是地基）
- Produces: `window.RepairCaseServiceItems`
  - `createItem(equipment) -> {id, equipment, actualReason, processRecords}`
  - `normalizeItem(item) -> item`（補齊欄位）
  - `normalizeServiceItems(record) -> item[]`（含舊資料摺疊）
  - `getItems(caseObj) -> item[]`
  - `getEquipments(caseObj) -> equipment[]`（略過 `equipment` 為 null 的卡片）
  - `getAllProcessRecords(caseObj) -> processRecord[]`
  - `hasAnyProcessData(caseObj) -> boolean`
  - `removeItem(caseObj, id) -> item[]`（回傳新陣列，不改原物件）
  - `updateItem(caseObj, id, patch) -> item[]`（回傳新陣列）
  - `CaseAssigneeUtils.normalizeRepairCase(record)` 現在會產出 `record.serviceItems`
    並移除 `equipment` / `actualReason` / `processRecords`

- [ ] **Step 1: Write the failing test**

Create `scripts/verify-case-service-items.mjs`:

```javascript
#!/usr/bin/env node
/**
 * 叫修案件「設備＋服務項目」卡片集合：helper 行為與舊資料遷移。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
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
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    return;
  }
  pass(name);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

function loadIife(relativePath, sandbox) {
  vm.runInContext(readFileSync(join(ROOT, relativePath), 'utf8'), sandbox, { filename: relativePath });
}

const sandbox = { console, window: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
loadIife('src/features/repair/case-service-items.js', sandbox);
loadIife('src/features/repair/case-assignee-utils.js', sandbox);

const SI = sandbox.RepairCaseServiceItems;
const CAU = sandbox.CaseAssigneeUtils;

function mkEq(id) {
  return { id: id, deviceName: '分離式冷氣', model: 'RAS-' + id, equipmentLevel: '一般設備' };
}
function mkRec(id, status) {
  return { id: id, category1: '維修', category2: '冷氣', category3: '清洗',
    specification: '標準', qty: 1, unit: '台', points: 2, status: status || '已處理' };
}

console.log('createItem');
const created = SI.createItem(mkEq('E1'));
assertTrue(!!created.id, 'createItem 產生 id', created.id);
assertEq(created.equipment.model, 'RAS-E1', 'createItem 帶入設備快照');
assertEq(created.actualReason, '', 'createItem 維修原因預設空字串');
assertEq(created.processRecords, [], 'createItem 處理方式預設空陣列');
created.equipment.model = 'MUTATED';
assertEq(mkEq('E1').model, 'RAS-E1', 'createItem 對設備做深拷貝，改動不回寫來源');

console.log('\nid 唯一');
assertTrue(SI.createItem(null).id !== SI.createItem(null).id, '連續建立的卡片 id 不重複');

console.log('\n聚合 helper');
const multi = { serviceItems: [
  { id: 'SI1', equipment: mkEq('E1'), actualReason: '壓縮機異音', processRecords: [mkRec(1), mkRec(2, '待處理')] },
  { id: 'SI2', equipment: mkEq('E2'), actualReason: '', processRecords: [mkRec(3)] }
] };
assertEq(SI.getItems(multi).length, 2, 'getItems 回傳兩張卡片');
assertEq(SI.getEquipments(multi).map(function (e) { return e.id; }), ['E1', 'E2'], 'getEquipments 依序回傳設備');
assertEq(SI.getAllProcessRecords(multi).map(function (r) { return r.id; }), [1, 2, 3], 'getAllProcessRecords 攤平所有處理方式');
assertTrue(SI.hasAnyProcessData(multi), 'hasAnyProcessData 有資料時為 true');
assertEq(SI.getItems(null), [], 'getItems 對 null 回傳空陣列');
assertEq(SI.getAllProcessRecords({}), [], 'getAllProcessRecords 對無 serviceItems 回傳空陣列');
assertTrue(!SI.hasAnyProcessData({ serviceItems: [{ id: 'SI9', equipment: mkEq('E9'), actualReason: '', processRecords: [] }] }),
  '只有設備、沒有服務內容時 hasAnyProcessData 為 false');
assertEq(SI.getEquipments({ serviceItems: [{ id: 'SI9', equipment: null, actualReason: '', processRecords: [] }] }), [],
  'getEquipments 略過沒有設備的卡片');

console.log('\nremoveItem / updateItem');
assertEq(SI.removeItem(multi, 'SI1').map(function (it) { return it.id; }), ['SI2'], 'removeItem 移除指定卡片');
assertEq(SI.getItems(multi).length, 2, 'removeItem 不改動原案件');
assertEq(SI.updateItem(multi, 'SI2', { actualReason: '濾網堵塞' })[1].actualReason, '濾網堵塞', 'updateItem 套用 patch');
assertEq(SI.getItems(multi)[1].actualReason, '', 'updateItem 不改動原案件');

console.log('\n舊資料遷移');
const legacy = CAU.normalizeRepairCase({
  id: 'C1', equipment: mkEq('E1'), actualReason: '不冷', processRecords: [mkRec(1)]
});
assertEq(legacy.serviceItems.length, 1, '舊案件摺成單筆卡片');
assertEq(legacy.serviceItems[0].equipment.id, 'E1', '卡片帶原設備');
assertEq(legacy.serviceItems[0].actualReason, '不冷', '卡片帶原維修原因');
assertEq(legacy.serviceItems[0].processRecords.length, 1, '卡片帶原處理方式');
assertTrue(!('equipment' in legacy), '遷移後移除 equipment 欄位');
assertTrue(!('actualReason' in legacy), '遷移後移除 actualReason 欄位');
assertTrue(!('processRecords' in legacy), '遷移後移除 processRecords 欄位');

const emptyLegacy = CAU.normalizeRepairCase({ id: 'C2', equipment: null, actualReason: '', processRecords: [] });
assertEq(emptyLegacy.serviceItems, [], '三者皆空時 serviceItems 為空陣列');

const reasonOnly = CAU.normalizeRepairCase({ id: 'C3', equipment: null, actualReason: '待料', processRecords: [] });
assertEq(reasonOnly.serviceItems.length, 1, '只有維修原因也會建立一張卡片');
assertEq(reasonOnly.serviceItems[0].equipment, null, '該卡片設備為 null');

const already = CAU.normalizeRepairCase({ id: 'C4', serviceItems: [
  { equipment: mkEq('E1') },
  { id: 'SI2', equipment: mkEq('E2'), actualReason: '異音', processRecords: [mkRec(5)] }
] });
assertEq(already.serviceItems.length, 2, '已是新結構時保留兩張卡片');
assertTrue(!!already.serviceItems[0].id, '缺 id 的卡片會補上 id', already.serviceItems[0].id);
assertEq(already.serviceItems[0].actualReason, '', '缺 actualReason 的卡片補空字串');
assertEq(already.serviceItems[0].processRecords, [], '缺 processRecords 的卡片補空陣列');

const twice = CAU.normalizeRepairCase(CAU.normalizeRepairCase({
  id: 'C5', equipment: mkEq('E1'), actualReason: '不冷', processRecords: [mkRec(1)]
}));
assertEq(twice.serviceItems.length, 1, '重複 normalize 不會重複產生卡片');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-case-service-items.mjs`
Expected: FAIL — `ENOENT: no such file ... src/features/repair/case-service-items.js`

- [ ] **Step 3: Write minimal implementation**

Create `src/features/repair/case-service-items.js`:

```javascript
/*
 * features/repair/case-service-items.js — 叫修案件「設備＋服務項目」卡片集合
 * 一筆設備對應一份服務項目（實際維修原因＋處理方式清單）。
 */
(function () {
  'use strict';

  // 同一毫秒內連續加入多張卡片也要有不同 id，故補一個遞增序號
  var seq = 0;
  function nextId() {
    seq += 1;
    return 'SI' + Date.now() + '-' + seq;
  }

  function deepCopy(value) {
    return value ? JSON.parse(JSON.stringify(value)) : null;
  }

  function createItem(equipment) {
    return {
      id: nextId(),
      equipment: deepCopy(equipment),
      actualReason: '',
      processRecords: []
    };
  }

  function normalizeItem(item) {
    item = item || {};
    return {
      id: item.id || nextId(),
      equipment: item.equipment || null,
      actualReason: item.actualReason || '',
      processRecords: Array.isArray(item.processRecords) ? item.processRecords.slice() : []
    };
  }

  // 舊案件把設備與服務項目攤在案件層級，摺成單筆卡片；三者皆空視為尚未加入設備。
  function normalizeServiceItems(record) {
    if (!record) return [];
    if (Array.isArray(record.serviceItems)) return record.serviceItems.map(normalizeItem);
    var hasLegacy = !!record.equipment
      || !!(record.actualReason && String(record.actualReason).trim())
      || !!(Array.isArray(record.processRecords) && record.processRecords.length);
    if (!hasLegacy) return [];
    return [normalizeItem({
      equipment: record.equipment || null,
      actualReason: record.actualReason || '',
      processRecords: record.processRecords || []
    })];
  }

  function getItems(c) {
    return (c && Array.isArray(c.serviceItems)) ? c.serviceItems : [];
  }

  function getEquipments(c) {
    return getItems(c).map(function (it) {
      return it.equipment;
    }).filter(function (eq) {
      return !!eq;
    });
  }

  function getAllProcessRecords(c) {
    return getItems(c).reduce(function (acc, it) {
      return acc.concat(it.processRecords || []);
    }, []);
  }

  function hasAnyProcessData(c) {
    return getItems(c).some(function (it) {
      return !!(it.actualReason && String(it.actualReason).trim())
        || !!(it.processRecords && it.processRecords.length > 0);
    });
  }

  function removeItem(c, id) {
    return getItems(c).filter(function (it) {
      return it.id !== id;
    });
  }

  function updateItem(c, id, patch) {
    return getItems(c).map(function (it) {
      return it.id === id ? Object.assign({}, it, patch) : it;
    });
  }

  window.RepairCaseServiceItems = {
    createItem: createItem,
    normalizeItem: normalizeItem,
    normalizeServiceItems: normalizeServiceItems,
    getItems: getItems,
    getEquipments: getEquipments,
    getAllProcessRecords: getAllProcessRecords,
    hasAnyProcessData: hasAnyProcessData,
    removeItem: removeItem,
    updateItem: updateItem
  };
})();
```

In `src/features/repair/case-assignee-utils.js`, inside `normalizeRepairCase`, add
`serviceItems` to the `Object.assign` and delete the three legacy fields. The
existing tail of that function is:

```javascript
    delete next.assignee;
    delete next.collaborators;
    return next;
```

Change the `Object.assign` block and tail to:

```javascript
    var next = Object.assign({}, record, {
      assignees: assignees,
      assigneeMemberIds: getAssigneeMemberIds(record),
      performanceAssignees: performanceAssignees,
      vehicleId: record.vehicleId || '',
      partnerVendorIds: asStringArray(record.partnerVendorIds),
      // 設備與服務項目改以卡片陣列承載；舊案件的三個單一欄位在此摺疊後移除
      serviceItems: RepairCaseServiceItems.normalizeServiceItems(record),
      processStatus: Object.prototype.hasOwnProperty.call(record, 'processStatus')
        ? normalizeProcessStatus(record.processStatus)
        : record.processStatus
    });
    delete next.assignee;
    delete next.collaborators;
    delete next.equipment;
    delete next.actualReason;
    delete next.processRecords;
    return next;
```

In `index.html`, insert the new script **before** `case-assignee-utils.js`
(currently line 40) so the helper exists when normalize runs:

```html
  <script src="src/features/repair/case-service-items.js"></script>
  <script src="src/features/repair/case-assignee-utils.js"></script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-case-service-items.mjs`
Expected: PASS，`0 failed`

- [ ] **Step 5: Commit**

```bash
git add src/features/repair/case-service-items.js src/features/repair/case-assignee-utils.js index.html scripts/verify-case-service-items.mjs
git commit -m "feat: 叫修案件以 serviceItems 承載多筆設備與服務項目"
```

---

### Task 2: 計分改讀所有卡片

**Files:**
- Modify: `src/features/repair/case-assignee-utils.js`（`sumProcessPoints`，約 line 139-147）
- Modify: `src/features/reports/performance-utils.js`（`getCaseEquipmentLevel` / `isAddOnEquipmentCase`，約 line 50-57；`processRecords` 用處約 line 110）
- Test: `scripts/verify-case-multi-equipment-points.mjs`

**Interfaces:**
- Consumes: Task 1 的 `RepairCaseServiceItems.getAllProcessRecords(c)`、`getEquipments(c)`
- Produces:
  - `CaseAssigneeUtils.sumProcessPoints(c)` 對所有卡片的處理方式加總
  - `PerformanceUtils.isAddOnEquipmentCase(c)`：**任一**設備等級為「增額設備」即為 true

- [ ] **Step 1: Write the failing test**

Create `scripts/verify-case-multi-equipment-points.mjs`:

```javascript
#!/usr/bin/env node
/**
 * 多筆設備的積分計算：處理方式跨卡片加總；任一設備為增額設備即整案計增額積分。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;
function pass(n, d) { passed++; console.log(`  ✓ ${n}${d ? ` — ${d}` : ''}`); }
function fail(n, d) { failed++; console.error(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
function assertEq(actual, expected, name) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    return;
  }
  pass(name);
}
function loadIife(rel, sandbox) {
  vm.runInContext(readFileSync(join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
}

const sandbox = { console, window: {}, DEFAULT_EQUIPMENT_LEVEL: '一般設備' };
sandbox.window = sandbox;
vm.createContext(sandbox);
// 只有「已處理」計分，狀態判讀沿用 ProcessMethodUtils 的規則
sandbox.ProcessMethodUtils = {
  isCaseRecordDone: function (r) { return !r.status || r.status === '已處理'; }
};
loadIife('src/features/repair/case-service-items.js', sandbox);
loadIife('src/features/repair/case-assignee-utils.js', sandbox);

const CAU = sandbox.CaseAssigneeUtils;

function rec(points, qty, status) {
  return { id: 'R' + points + qty, points: points, qty: qty, status: status || '已處理' };
}

console.log('sumProcessPoints 跨卡片');
const twoCards = {
  serviceItems: [
    { id: 'SI1', equipment: { id: 'E1' }, actualReason: '', processRecords: [rec(2, 1), rec(3, 2)] },
    { id: 'SI2', equipment: { id: 'E2' }, actualReason: '', processRecords: [rec(5, 1)] }
  ]
};
assertEq(CAU.sumProcessPoints(twoCards), 13, '兩張卡片積分加總 (2*1 + 3*2 + 5*1)');

const withPending = {
  serviceItems: [
    { id: 'SI1', equipment: { id: 'E1' }, actualReason: '', processRecords: [rec(2, 1), rec(9, 1, '待處理')] },
    { id: 'SI2', equipment: { id: 'E2' }, actualReason: '', processRecords: [rec(4, 1)] }
  ]
};
assertEq(CAU.sumProcessPoints(withPending), 6, '待處理項目不計分');
assertEq(CAU.sumProcessPoints({ serviceItems: [] }), 0, '無卡片時為 0');
assertEq(CAU.sumProcessPoints(null), 0, 'null 案件為 0');

console.log('\n增額設備判定');
// performance-utils 依賴 EquipmentUtils / ServiceLevelUtils，此處以最小樁載入
const perfSandbox = { console, window: {}, DEFAULT_EQUIPMENT_LEVEL: '一般設備' };
perfSandbox.window = perfSandbox;
vm.createContext(perfSandbox);
perfSandbox.EquipmentUtils = {
  getLevel: function (eq) { return (eq && eq.equipmentLevel) || '一般設備'; }
};
perfSandbox.ServiceLevelUtils = { countsBonusPoints: function () { return false; } };
perfSandbox.ProcessMethodUtils = sandbox.ProcessMethodUtils;
perfSandbox.CaseAssigneeUtils = CAU;
loadIife('src/features/repair/case-service-items.js', perfSandbox);
loadIife('src/features/reports/performance-utils.js', perfSandbox);
const PU = perfSandbox.PerformanceUtils;

const addOnSecond = { serviceItems: [
  { id: 'SI1', equipment: { id: 'E1', equipmentLevel: '一般設備' }, actualReason: '', processRecords: [] },
  { id: 'SI2', equipment: { id: 'E2', equipmentLevel: '增額設備' }, actualReason: '', processRecords: [] }
] };
assertEq(PU.isAddOnEquipmentCase(addOnSecond), true, '第二筆設備為增額設備時整案符合');

const noAddOn = { serviceItems: [
  { id: 'SI1', equipment: { id: 'E1', equipmentLevel: '一般設備' }, actualReason: '', processRecords: [] }
] };
assertEq(PU.isAddOnEquipmentCase(noAddOn), false, '皆非增額設備時不符合');
assertEq(PU.isAddOnEquipmentCase({ serviceItems: [] }), false, '無設備時不符合');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-case-multi-equipment-points.mjs`
Expected: FAIL — `sumProcessPoints` 回傳 0（仍讀已不存在的 `record.processRecords`）

- [ ] **Step 3: Write minimal implementation**

In `src/features/repair/case-assignee-utils.js`, change `sumProcessPoints`:

```javascript
  // 只有「已處理」的處理方式計入積分（舊資料無 status 視為已處理）；跨所有設備卡片加總。
  function sumProcessPoints(record) {
    var total = 0;
    RepairCaseServiceItems.getAllProcessRecords(record).forEach(function (r) {
      if (!ProcessMethodUtils.isCaseRecordDone(r)) return;
      var points = Number(r.points) || 0;
      var qty = Number(r.qty) > 0 ? Number(r.qty) : 1;
      total += points * qty;
    });
    return total;
  }
```

In `src/features/reports/performance-utils.js`, replace `getCaseEquipmentLevel` /
`isAddOnEquipmentCase`:

```javascript
  // 案件的設備等級來自建案當下的設備快照（設備管理設定），不再反查設備分類
  function getCaseEquipmentLevels(c) {
    return RepairCaseServiceItems.getEquipments(c).map(function (eq) {
      return EquipmentUtils.getLevel(eq);
    });
  }

  // 積分是案件層級的加總，故任一設備為增額設備即整案適用
  function isAddOnEquipmentCase(c) {
    return getCaseEquipmentLevels(c).some(function (level) {
      return level === '增額設備';
    });
  }
```

Export `getCaseEquipmentLevels` in place of `getCaseEquipmentLevel` in the
`window.PerformanceUtils` object, and update the other `processRecords` read in
this file (around line 110) to `RepairCaseServiceItems.getAllProcessRecords(c).forEach(...)`.

Then check for other callers:

```bash
grep -rn "getCaseEquipmentLevel\b" src/ scripts/
```

Update each hit to `getCaseEquipmentLevels(...)` semantics (a level array). If a
caller needs a single display level, use `getCaseEquipmentLevels(c)[0] || ''`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-case-multi-equipment-points.mjs`
Expected: PASS，`0 failed`

Run the existing points regression too:

Run: `node scripts/verify-equipment-level-points.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/repair/case-assignee-utils.js src/features/reports/performance-utils.js scripts/verify-case-multi-equipment-points.mjs
git commit -m "feat: 積分計算跨所有設備卡片加總"
```

---

### Task 3: `hasProcessData` 與延伸案件承接

**Files:**
- Modify: `src/features/repair/case-status.js`（`hasProcessData`，約 line 265-274）
- Modify: `src/features/repair/case-extension.js`（`copyPendingRecords` / `copyEquipment` 約 line 35-49；`buildExtensionCase` 約 line 53-100）
- Test: `scripts/verify-case-extension-multi-equipment.mjs`

**Interfaces:**
- Consumes: Task 1 的 `RepairCaseServiceItems.getItems`、`hasAnyProcessData`、`normalizeItem`
- Produces:
  - `IESS.caseStatus.hasProcessData(c)` 依卡片判斷
  - `CaseExtensionUtils.buildExtensionCase(original, cases)` 產出的新案帶
    `serviceItems`（全部設備、每張只留「待處理」項目），不再有 `equipment` /
    `actualReason` / `processRecords`

- [ ] **Step 1: Write the failing test**

Create `scripts/verify-case-extension-multi-equipment.mjs`:

```javascript
#!/usr/bin/env node
/**
 * 延伸案件承接多筆設備：帶全部設備卡片，每張只保留「待處理」的處理方式。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;
function pass(n, d) { passed++; console.log(`  ✓ ${n}${d ? ` — ${d}` : ''}`); }
function fail(n, d) { failed++; console.error(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
function assertEq(actual, expected, name) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    return;
  }
  pass(name);
}
function assertTrue(cond, name, detail) { if (cond) pass(name, detail); else fail(name, detail); }
function loadIife(rel, sandbox) {
  vm.runInContext(readFileSync(join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
}

const sandbox = { console, window: {}, global: null };
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
sandbox.ProcessMethodUtils = {
  getCaseRecordStatus: function (r) { return (r && r.status) || '已處理'; },
  isCaseRecordDone: function (r) { return !r.status || r.status === '已處理'; }
};
loadIife('src/features/repair/case-service-items.js', sandbox);
loadIife('src/features/repair/case-extension.js', sandbox);

const CE = sandbox.CaseExtensionUtils;
const SI = sandbox.RepairCaseServiceItems;

function rec(id, status) { return { id: id, points: 1, qty: 1, status: status }; }

const original = {
  id: 'C1', caseNumber: '20260825001', customerName: '測試客戶', storeName: '測試門市',
  serviceItems: [
    { id: 'SI1', equipment: { id: 'E1', deviceName: '分離式冷氣' }, actualReason: '不冷',
      processRecords: [rec(1, '已處理'), rec(2, '待處理')] },
    { id: 'SI2', equipment: { id: 'E2', deviceName: '冰水主機' }, actualReason: '異音',
      processRecords: [rec(3, '已處理')] }
  ]
};

console.log('延伸案件');
const ext = CE.buildExtensionCase(original, [original]);
assertEq(SI.getItems(ext).length, 2, '帶全部兩張設備卡片');
assertEq(SI.getEquipments(ext).map(function (e) { return e.id; }), ['E1', 'E2'], '設備依原順序');
assertEq(SI.getItems(ext)[0].processRecords.map(function (r) { return r.status; }), ['待處理'],
  '第一張只留待處理項目');
assertEq(SI.getItems(ext)[1].processRecords, [], '第二張已全部完成，服務項目為空');
assertEq(SI.getItems(ext)[0].actualReason, '不冷', '維修原因隨各自卡片帶過去');
assertEq(SI.getItems(ext)[1].actualReason, '異音', '第二張卡片的維修原因也帶過去');
assertTrue(!('equipment' in ext), '延伸案件不含舊 equipment 欄位');
assertTrue(!('processRecords' in ext), '延伸案件不含舊 processRecords 欄位');
assertTrue(!('actualReason' in ext), '延伸案件不含舊 actualReason 欄位');
assertTrue(SI.getItems(ext)[0].id !== 'SI1', '卡片 id 重新產生，避免與原案共用', SI.getItems(ext)[0].id);
assertTrue(SI.getItems(ext)[0].processRecords[0].id !== 2, '處理方式 id 重新產生',
  String(SI.getItems(ext)[0].processRecords[0].id));
assertEq(SI.getItems(original)[0].processRecords.length, 2, '原案件不被更動');

console.log('\nhasProcessData');
const csSandbox = { console, window: {} };
csSandbox.window = csSandbox;
csSandbox.global = csSandbox;
csSandbox.globalThis = csSandbox;
csSandbox.IESS = { caseDateTime: { now: function () { return '2026-08-25 09:00:00'; } } };
vm.createContext(csSandbox);
csSandbox.ProcessMethodUtils = sandbox.ProcessMethodUtils;
csSandbox.CaseExtensionUtils = CE;
loadIife('src/features/repair/case-service-items.js', csSandbox);
loadIife('src/features/repair/case-status.js', csSandbox);
const CS = csSandbox.IESS.caseStatus;

assertEq(CS.hasProcessData(original), true, '有處理方式時為 true');
assertEq(CS.hasProcessData({ serviceItems: [
  { id: 'SI1', equipment: { id: 'E1' }, actualReason: '', processRecords: [] }
] }), false, '只有設備、無服務內容時為 false');
assertEq(CS.hasProcessData({ serviceItems: [
  { id: 'SI1', equipment: { id: 'E1' }, actualReason: '待料', processRecords: [] }
] }), true, '第二張卡片有維修原因也算 true');
assertEq(CS.hasProcessData({ serviceItems: [], processStatus: '已完成' }), true,
  '處理狀態仍然算 process data');
assertEq(CS.hasProcessData({ serviceItems: [] }), false, '完全空白時為 false');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-case-extension-multi-equipment.mjs`
Expected: FAIL — `帶全部兩張設備卡片 expected 2, got 0`

- [ ] **Step 3: Write minimal implementation**

In `src/features/repair/case-extension.js`, replace `copyPendingRecords` and
`copyEquipment` with a single card-level copier:

```javascript
  // 只承接「待處理」的服務項目；原案件的那份保留不動（歷史紀錄）。
  // 設備卡片全部帶過去，已全部完成的卡片會變成「有設備、無服務項目」，是預期行為。
  function copyPendingServiceItems(original) {
    var stamp = Date.now();
    var recSeq = 0;
    return RepairCaseServiceItems.getItems(original).map(function (item, idx) {
      var pending = (item.processRecords || []).filter(function (r) {
        return ProcessMethodUtils.getCaseRecordStatus(r) === '待處理';
      }).map(function (r) {
        recSeq += 1;
        return Object.assign({}, r, { id: stamp + recSeq });
      });
      return {
        id: 'SI' + stamp + '-' + (idx + 1),
        equipment: item.equipment ? JSON.parse(JSON.stringify(item.equipment)) : null,
        actualReason: item.actualReason || '',
        processRecords: pending
      };
    });
  }
```

In `buildExtensionCase`, delete the `actualReason: original.actualReason || '',`
line and replace the `equipment` / `processRecords` pair:

```javascript
      serviceItems: copyPendingServiceItems(original),
```

Update the function's doc comment above `buildExtensionCase`:

```javascript
  /*
   * 帶入：案件資料、全部設備卡片（每張只留待處理的服務項目）、
   *       組別／人員／協力廠商／車輛。
   * 清空：處理狀態、時間紀錄、預計日期時間（需重新排程）、結案／績效／退回欄位。
   */
```

In `src/features/repair/case-status.js`, change `hasProcessData`:

```javascript
  function hasProcessData(c) {
    if (!c) return false;
    if (RepairCaseServiceItems.hasAnyProcessData(c)) return true;
    if (c.processStatus) return true;
    if (c.reRepairDate) return true;
    if (c.completionDate) return true;
    return false;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-case-extension-multi-equipment.mjs`
Expected: PASS，`0 failed`

Run: `node scripts/verify-case-extension.mjs`
Expected: PASS（若此腳本仍以 `equipment` / `processRecords` 建構測資，改成
`serviceItems` 後再跑；斷言語意不變）

- [ ] **Step 5: Commit**

```bash
git add src/features/repair/case-status.js src/features/repair/case-extension.js scripts/verify-case-extension-multi-equipment.mjs scripts/verify-case-extension.mjs
git commit -m "feat: 延伸案件承接全部設備卡片的待處理項目"
```

---

### Task 4: 設備＋服務項目卡片元件

**Files:**
- Create: `src/features/repair/case-service-item-card.js`
- Modify: `index.html`（在 `src/features/repair/case-form.js` 之前插入新檔）
- Test: `scripts/verify-case-service-item-card.mjs`

**Interfaces:**
- Consumes: Task 1 的 `RepairCaseServiceItems`；既有 `RepairCaseEquipment.Panel`、
  `ProcessMethodUtils`、`IESS.h`、`IESS.Icons`
- Produces: `window.RepairCaseServiceItemCard(props)` → DOM node
  - props: `{ h, index, item, caseContext, deviceCategories, processMethods,
    newRecord, isOther, readOnly, isClosed, onNewRecordChange(selection),
    onReasonChange(text), onAddRecord(processMethod, qty, status),
    onToggleRecordStatus(recordId), onRemoveRecord(recordId), onRemoveItem() }`
  - `readOnly: true` 時不渲染任何 `button`／輸入控制項，供唯讀明細重用
  - 卡片標題格式：`設備 N　<設備名稱> <型號>`

- [ ] **Step 1: Write the failing test**

Create `scripts/verify-case-service-item-card.mjs` (CDP, `CDP_PORT` default `9361`):

```javascript
#!/usr/bin/env node
/**
 * 設備＋服務項目卡片元件：標題、設備欄位、維修原因、處理方式表、移除鈕、唯讀模式。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9361);

if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

let passed = 0, failed = 0;
const pass = (n, d) => { passed++; console.log(`  ✓ ${n}${d ? ` — ${d}` : ''}`); };
const fail = (n, d) => { failed++; console.error(`  ✗ ${n}${d ? ` — ${d}` : ''}`); };
function assertEq(actual, expected, name) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass(name, JSON.stringify(actual));
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertTrue(cond, name, detail) { if (cond) pass(name, detail); else fail(name, detail); }

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-si-card-profile',
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
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
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

  console.log('page load');
  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');

  await evaluate(`
    window.__item = {
      id: 'SI1',
      equipment: {
        id: 'E1', customerName: '測試客戶', storeName: '測試門市',
        category: '空調', brand: '大金', deviceName: '室內機', specification: '2.2kW',
        model: 'FTXS', equipmentLevel: '一般設備', area: '廚房',
        acceptanceDate: '2020-02-01', installer: '王小明',
        assetNumber: 'A-001', serialNumber: 'SN-001', status: '運轉中'
      },
      actualReason: '濾網堵塞',
      processRecords: [{
        id: 11, category1: '維修', category2: '空調', category3: '清洗',
        specification: '標準', qty: 2, unit: '台', points: 3, status: '已處理'
      }]
    };
    window.__text = function (node) { return node.textContent.replace(/\\s+/g, ' ').trim(); };
    window.__render = function (extra) {
      var wrap = document.createElement('div');
      document.body.appendChild(wrap);
      var props = {
        h: IESS.h, index: 0, item: window.__item,
        caseContext: { customerName: '測試客戶', storeName: '測試門市' },
        deviceCategories: [], processMethods: [],
        newRecord: ProcessMethodUtils.normalizeProcessMethodSelection([], null),
        isOther: false, readOnly: false, isClosed: false,
        onNewRecordChange: function () {}, onReasonChange: function () {},
        onAddRecord: function () {}, onToggleRecordStatus: function () {},
        onRemoveRecord: function () {}, onRemoveItem: function () {}
      };
      Object.keys(extra || {}).forEach(function (k) { props[k] = extra[k]; });
      wrap.appendChild(RepairCaseServiceItemCard(props));
      return wrap;
    };
  `);

  console.log('\n編輯模式');
  const edit = await evaluate(`(function () {
    var wrap = window.__render({});
    var text = window.__text(wrap);
    var buttons = Array.prototype.map.call(wrap.querySelectorAll('button'), function (b) {
      return b.textContent.replace(/\\s+/g, ' ').trim();
    });
    var reason = wrap.querySelector('textarea');
    var out = {
      text: text,
      buttons: buttons,
      reasonValue: reason ? reason.value : null,
      rowCount: wrap.querySelectorAll('tbody tr').length
    };
    wrap.remove();
    return out;
  })()`);
  assertTrue(edit.text.indexOf('設備 1') !== -1, '卡片標題含序號', edit.text.slice(0, 60));
  assertTrue(edit.text.indexOf('室內機') !== -1, '標題含設備名稱');
  assertTrue(edit.text.indexOf('FTXS') !== -1, '標題含型號');
  assertTrue(edit.text.indexOf('大金') !== -1, '卡片含設備欄位（品牌）');
  assertEq(edit.reasonValue, '濾網堵塞', '維修原因帶入 textarea');
  assertTrue(edit.buttons.some(b => b === '移除'), '有移除卡片按鈕', edit.buttons.join(' | '));
  assertTrue(edit.buttons.some(b => b === '待處理'), '有「待處理」加入鈕');
  assertTrue(edit.buttons.some(b => b === '已處理'), '有「已處理」加入鈕');
  assertEq(edit.rowCount, 1, '處理方式表有一列');

  console.log('\n移除卡片回呼');
  const removed = await evaluate(`(function () {
    var called = 0;
    var wrap = window.__render({ onRemoveItem: function () { called += 1; } });
    var btn = Array.prototype.find.call(wrap.querySelectorAll('button'), function (b) {
      return b.textContent.replace(/\\s+/g, ' ').trim() === '移除';
    });
    if (btn) btn.click();
    wrap.remove();
    return called;
  })()`);
  assertEq(removed, 1, '點「移除」觸發 onRemoveItem 一次');

  console.log('\n工項分類為「其他」');
  const other = await evaluate(`(function () {
    var wrap = window.__render({ isOther: true });
    var out = window.__text(wrap).indexOf('實際維修原因') === -1;
    wrap.remove();
    return out;
  })()`);
  assertEq(other, true, 'isOther 時不顯示實際維修原因');

  console.log('\n唯讀模式');
  const readOnly = await evaluate(`(function () {
    var wrap = window.__render({ readOnly: true });
    var out = {
      buttons: wrap.querySelectorAll('button').length,
      inputs: wrap.querySelectorAll('input, textarea, select').length,
      hasReason: window.__text(wrap).indexOf('濾網堵塞') !== -1,
      rowCount: wrap.querySelectorAll('tbody tr').length
    };
    wrap.remove();
    return out;
  })()`);
  assertEq(readOnly.buttons, 0, '唯讀模式無按鈕');
  assertEq(readOnly.inputs, 0, '唯讀模式無輸入控制項');
  assertEq(readOnly.hasReason, true, '唯讀模式仍顯示維修原因文字');
  assertEq(readOnly.rowCount, 1, '唯讀模式仍顯示處理方式列');

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

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-case-service-item-card.mjs`
Expected: FAIL — `RepairCaseServiceItemCard is not defined`

- [ ] **Step 3: Write minimal implementation**

Create `src/features/repair/case-service-item-card.js`. Move the「處理方式」挑選列與
明細表的既有標記自 `case-form.js:688-845` 進來，改成吃 props 而非閉包變數；
設備欄位沿用 `RepairCaseEquipment.Panel`。

```javascript
/*
 * features/repair/case-service-item-card.js — 一筆設備＋其服務項目的卡片
 * readOnly 供案件唯讀明細重用，避免編輯／檢視兩份版面走樣。
 */
(function () {
  'use strict';

  function cardTitle(index, item) {
    var eq = item.equipment || {};
    var name = eq.deviceName || eq.name || '未指定設備';
    return '設備 ' + (index + 1) + '　' + name + (eq.model ? ' ' + eq.model : '');
  }

  function RepairCaseServiceItemCard(props) {
    var h = props.h || IESS.h;
    var Icons = IESS.Icons;
    var item = props.item;
    var readOnly = !!props.readOnly;
    var processMethods = props.processMethods || [];
    var pmColumns = ProcessMethodUtils.CASE_DISPLAY_COLUMNS;
    var newRecord = props.newRecord;
    var selectedPm = readOnly
      ? null
      : ProcessMethodUtils.findProcessMethodForSelection(processMethods, newRecord);
    var selectedUnit = selectedPm ? selectedPm.unit : '';

    function formatPoints(r) {
      var pts = ProcessMethodUtils.resolveCaseRecordPoints(r, processMethods, props.isClosed);
      return pts === null ? '—' : String(pts);
    }

    function patchNewRecord(patch) {
      props.onNewRecordChange(ProcessMethodUtils.normalizeProcessMethodSelection(
        processMethods, Object.assign({}, newRecord, patch)
      ));
    }

    function selectField(label, value, options, patch, widthCls) {
      return h('div', { className: widthCls },
        h('span', { className: 'text-xs text-gray-500 block mb-1' }, label),
        h('select', {
          value: value,
          onChange: function (e) { patch(e.target.value); },
          disabled: !processMethods.length,
          className: 'w-full p-2 border rounded outline-none text-sm'
        }, options.map(function (c) { return h('option', { key: c, value: c }, c); }))
      );
    }

    function renderPicker() {
      var cat1 = ProcessMethodUtils.getCat1OptionsFromMethods(processMethods);
      var cat2 = ProcessMethodUtils.getCat2OptionsFromMethods(processMethods, newRecord.category1);
      var cat3 = ProcessMethodUtils.getCat3OptionsFromMethods(
        processMethods, newRecord.category1, newRecord.category2
      );
      var specs = ProcessMethodUtils.getSpecOptionsFromMethods(
        processMethods, newRecord.category1, newRecord.category2, newRecord.category3
      );
      return h('div', {
        className: 'flex flex-wrap gap-3 items-end bg-gray-50 p-4 rounded-md border border-gray-200 mb-4'
      },
        selectField('大類', newRecord.category1, cat1, function (v) {
          patchNewRecord({ category1: v, category2: '', category3: '', specification: '' });
        }, 'flex-1 min-w-[100px]'),
        selectField('中類', newRecord.category2, cat2, function (v) {
          patchNewRecord({ category2: v, category3: '', specification: '' });
        }, 'flex-1 min-w-[100px]'),
        selectField('小類', newRecord.category3, cat3, function (v) {
          patchNewRecord({ category3: v, specification: '' });
        }, 'flex-1 min-w-[120px]'),
        selectField('規格', newRecord.specification, specs, function (v) {
          patchNewRecord({ specification: v });
        }, 'flex-1 min-w-[120px]'),
        h('div', { className: 'w-20' },
          h('span', { className: 'text-xs text-gray-500 block mb-1' }, '積分數'),
          h('div', { className: 'p-2 text-sm text-gray-700 text-center' },
            selectedPm && selectedPm.points != null ? String(selectedPm.points) : '—')
        ),
        h('div', { className: 'flex items-end gap-2' },
          h('div', { className: 'w-20' },
            h('span', { className: 'text-xs text-gray-500 block mb-1' }, '數量'),
            h('input', {
              type: 'number',
              min: '1',
              value: newRecord.qty,
              onChange: function (e) { patchNewRecord({ qty: e.target.value }); },
              className: 'w-full p-2 border rounded outline-none text-sm text-center'
            })
          ),
          h('span', { className: 'text-sm text-gray-600 pb-2 min-w-[2rem]' }, selectedUnit || '—')
        ),
        h('div', { className: 'flex items-end gap-2' },
          h('button', {
            type: 'button',
            onClick: function () {
              props.onAddRecord(selectedPm, newRecord.qty, ProcessMethodUtils.PROCESS_RECORD_STATUS.PENDING);
            },
            className: 'bg-white text-amber-700 border border-amber-400 px-4 py-2 rounded text-sm hover:bg-amber-50 h-[38px]'
          }, '待處理'),
          h('button', {
            type: 'button',
            onClick: function () {
              props.onAddRecord(selectedPm, newRecord.qty, ProcessMethodUtils.PROCESS_RECORD_STATUS.DONE);
            },
            className: 'bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 h-[38px]'
          }, '已處理')
        )
      );
    }

    function renderRows() {
      var records = item.processRecords || [];
      var colCount = pmColumns.length + (readOnly ? 3 : 4);
      if (!records.length) {
        return h('tr', null, h('td', {
          colspan: String(colCount),
          className: 'p-4 text-center text-gray-400'
        }, readOnly
          ? '無處理方式紀錄'
          : (processMethods.length ? '尚未加入處理項目' : '請至系統權限建立處理方式')));
      }
      return ProcessMethodUtils.sortCaseProcessRecords(records).map(function (r, idx) {
        var isDone = ProcessMethodUtils.isCaseRecordDone(r);
        return h('tr', { key: r.id || idx },
          pmColumns.map(function (col) {
            return h('td', { key: col.key, className: 'p-2 pl-4 first:pl-4' }, r[col.key] || '—');
          }),
          h('td', { className: 'p-2' },
            h('span', { className: ProcessMethodUtils.getCaseRecordStatusBadgeClass(r) },
              ProcessMethodUtils.getCaseRecordStatus(r))
          ),
          h('td', { className: 'p-2 ' + (isDone ? '' : 'text-gray-400') },
            formatPoints(r),
            isDone ? null : h('span', { className: 'text-xs text-gray-400 ml-1' }, '不計分')
          ),
          h('td', { className: 'p-2' },
            r.qty,
            r.unit ? h('span', { className: 'text-gray-500 ml-1' }, r.unit) : null
          ),
          readOnly ? null : h('td', { className: 'p-2 text-right pr-4' },
            h('div', { className: 'flex items-center justify-end gap-2' },
              h('button', {
                type: 'button',
                onClick: function () { props.onToggleRecordStatus(r.id); },
                title: isDone ? '轉為待處理' : '轉為已處理',
                className: 'px-2 py-1 rounded border text-xs ' + (isDone
                  ? 'border-amber-400 text-amber-700 hover:bg-amber-50'
                  : 'border-blue-500 text-blue-600 hover:bg-blue-50')
              }, isDone ? '轉待處理' : '轉已處理'),
              h('button', {
                type: 'button',
                onClick: function () { props.onRemoveRecord(r.id); },
                title: '移除此處理方式',
                className: 'text-red-500'
              }, Icons.X({ className: 'h-4 w-4' }))
            )
          )
        );
      });
    }

    function renderReason() {
      if (props.isOther) return null;
      if (readOnly) {
        return h('div', null,
          h('span', { className: 'text-gray-500 block mb-1 text-xs' }, '實際維修原因'),
          h('div', {
            className: 'font-medium p-2.5 rounded-md border bg-gray-50 border-gray-100 min-h-[42px]'
          }, item.actualReason || '-')
        );
      }
      return h('div', null,
        h('label', { className: 'block text-sm mb-1' }, '實際維修原因'),
        h('textarea', {
          value: item.actualReason || '',
          onChange: function (e) { props.onReasonChange(e.target.value); },
          rows: '2',
          className: 'w-full p-2.5 border rounded-md outline-none'
        })
      );
    }

    return h('div', { className: 'border border-gray-200 rounded-lg overflow-hidden mb-4' },
      h('div', { className: 'flex justify-between items-center bg-gray-50 border-b px-4 py-2' },
        h('span', { className: 'font-semibold text-gray-700 text-sm' }, cardTitle(props.index, item)),
        readOnly ? null : h('button', {
          type: 'button',
          onClick: function () { props.onRemoveItem(); },
          className: 'text-red-600 border border-red-200 px-3 py-1 rounded text-sm hover:bg-red-50'
        }, '移除')
      ),
      h('div', { className: 'p-4 space-y-4' },
        h(RepairCaseEquipment.Panel, {
          h: h,
          equipment: item.equipment,
          caseContext: props.caseContext || {},
          deviceCategories: props.deviceCategories,
          emptyText: '此卡片尚未指定設備'
        }),
        renderReason(),
        h('div', null,
          h('span', { className: 'block text-sm font-medium text-gray-700 mb-2' }, '處理方式'),
          readOnly ? null : renderPicker(),
          h('div', { className: 'border rounded-md overflow-x-auto table-scroll-hint' },
            h('table', { className: 'w-full text-left text-sm whitespace-nowrap' },
              h('thead', { className: 'bg-gray-100' },
                h('tr', null,
                  pmColumns.map(function (col) {
                    return h('th', { key: col.key, className: 'p-2 pl-4 first:pl-4' }, col.label);
                  }),
                  h('th', { className: 'p-2' }, '狀態'),
                  h('th', { className: 'p-2' }, '積分數'),
                  h('th', { className: 'p-2' }, '數量'),
                  readOnly ? null : h('th', { className: 'p-2 text-right pr-4' }, '操作')
                )
              ),
              h('tbody', { className: 'divide-y' }, renderRows())
            )
          )
        )
      )
    );
  }

  window.RepairCaseServiceItemCard = RepairCaseServiceItemCard;
})();
```

In `index.html`, add before `case-form.js`:

```html
  <script src="src/features/repair/case-service-item-card.js"></script>
  <script src="src/features/repair/case-form.js"></script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-case-service-item-card.mjs`
Expected: PASS，`0 failed`

- [ ] **Step 5: Commit**

```bash
git add src/features/repair/case-service-item-card.js index.html scripts/verify-case-service-item-card.mjs
git commit -m "feat: 新增設備與服務項目卡片元件"
```

---

### Task 5: 編輯案件表單合併區塊、支援多卡片

**Files:**
- Modify: `src/features/repair/case-form.js`
  - `NewCaseForm` 的新案初值（約 line 185-195）
  - `EditCaseForm` 的閉包狀態與 handler（約 line 380-545）
  - 「3. 設備資料」與「4. 服務項目」兩個 section（約 line 628-855）
  - 「5. 維修結果」標題（約 line 858）
- Test: `scripts/verify-case-multi-equipment.mjs`

**Interfaces:**
- Consumes: Task 1 的 `RepairCaseServiceItems`、Task 4 的 `RepairCaseServiceItemCard`
- Produces: 編輯表單的 `formData.serviceItems` 可為多筆；
  區塊標題改為 `3. 設備與服務項目`、`4. 維修結果`

- [ ] **Step 1: Write the failing test**

Create `scripts/verify-case-multi-equipment.mjs` (CDP, `CDP_PORT` default `9362`).
Reuse the CDP boilerplate from `scripts/verify-case-service-item-card.mjs`
(`--user-data-dir=/tmp/iess-multi-equip-profile`), then after page load:

```javascript
  await evaluate(`
    window.__mkEq = function (id, name, model) {
      return {
        id: id, customerName: '測試客戶', storeName: '測試門市',
        category: '空調', brand: '大金', deviceName: name, specification: '2.2kW',
        model: model, equipmentLevel: '一般設備', area: '廚房',
        acceptanceDate: '2020-02-01', installer: '王小明',
        assetNumber: 'A-' + id, serialNumber: 'SN-' + id, status: '運轉中',
        createdDate: '2026-08-01'
      };
    };
    window.__saved = null;
    window.__mountEdit = function (editingCase) {
      var wrap = document.createElement('div');
      document.body.appendChild(wrap);
      wrap.appendChild(EditCaseForm({
        editingCase: editingCase,
        cases: [editingCase],
        setCases: function (next) { window.__saved = next; },
        stores: [], customers: [],
        equipments: [window.__mkEq('E1', '室內機', 'FTXS'), window.__mkEq('E2', '冰水主機', 'CH-200')],
        deviceCategories: [], processMethods: [],
        setView: function () {}, showToast: function () {}
      }));
      return wrap;
    };
    window.__baseCase = {
      id: 'C1', caseNumber: '20260825001', customerName: '測試客戶', storeName: '測試門市',
      companyCity: '台北市', companyDistrict: '中山區', workCategory: '一般叫修',
      repairItem: '室內機', repairReason: '不冷', faultDesc: '出風不冷',
      assignees: [], isClosed: false, processStatus: null,
      createdAt: '2026-08-25 09:00:00', repairDate: '2026-08-25 09:00:00',
      expectedDate: '2026-08-25', expectedTimeStart: '09:00', expectedTimeEnd: '11:00',
      serviceItems: []
    };
    window.__clickAdd = function (wrap, equipIndex) {
      var addBtn = Array.prototype.find.call(wrap.querySelectorAll('button'), function (b) {
        return b.textContent.indexOf('加入設備') !== -1;
      });
      addBtn.click();
      var pickBtn = Array.prototype.find.call(wrap.querySelectorAll('button'), function (b) {
        return b.textContent.replace(/\\s+/g, ' ').trim() === '手動選擇';
      });
      pickBtn.click();
      var rows = wrap.querySelectorAll('.app-modal-overlay tbody tr');
      rows[equipIndex].querySelector('button').click();
    };
    window.__cardTitles = function (wrap) {
      return Array.prototype.map.call(wrap.querySelectorAll('div.border.border-gray-200.rounded-lg > div:first-child span'),
        function (s) { return s.textContent.replace(/\\s+/g, ' ').trim(); });
    };
  `);

  console.log('\n合併區塊標題');
  const headings = await evaluate(`(function () {
    var wrap = window.__mountEdit(JSON.parse(JSON.stringify(window.__baseCase)));
    var hs = Array.prototype.map.call(wrap.querySelectorAll('h3'), function (n) {
      return n.textContent.replace(/\\s+/g, ' ').trim();
    });
    wrap.remove();
    return hs;
  })()`);
  assertTrue(headings.some(t => t.indexOf('3. 設備與服務項目') === 0), '區塊 3 已合併命名', headings.join(' | '));
  assertTrue(headings.some(t => t === '4. 維修結果'), '維修結果遞補為 4', headings.join(' | '));
  assertTrue(!headings.some(t => t === '4. 服務項目'), '不再有獨立的 4. 服務項目', headings.join(' | '));

  console.log('\n加入兩台設備');
  const twoCards = await evaluate(`(function () {
    var wrap = window.__mountEdit(JSON.parse(JSON.stringify(window.__baseCase)));
    window.__clickAdd(wrap, 0);
    window.__clickAdd(wrap, 1);
    var titles = window.__cardTitles(wrap);
    var reasons = wrap.querySelectorAll('textarea').length;
    wrap.remove();
    return { titles: titles, reasons: reasons };
  })()`);
  assertEq(twoCards.titles.length, 2, '加入兩台設備後有兩張卡片');
  assertTrue(twoCards.titles[0].indexOf('設備 1') === 0, '第一張標題為設備 1', twoCards.titles[0]);
  assertTrue(twoCards.titles[1].indexOf('設備 2') === 0, '第二張標題為設備 2', twoCards.titles[1]);
  assertTrue(twoCards.titles[0].indexOf('FTXS') !== -1, '第一張是先選的設備');
  assertTrue(twoCards.titles[1].indexOf('CH-200') !== -1, '第二張是後選的設備');

  console.log('\n維修原因互不干擾');
  const reasons = await evaluate(`(function () {
    var wrap = window.__mountEdit(JSON.parse(JSON.stringify(window.__baseCase)));
    window.__clickAdd(wrap, 0);
    window.__clickAdd(wrap, 1);
    function reasonBoxes() {
      return Array.prototype.filter.call(wrap.querySelectorAll('textarea'), function (t) {
        return t.previousSibling && t.previousSibling.textContent === '實際維修原因';
      });
    }
    var boxes = reasonBoxes();
    boxes[0].value = '第一台濾網堵塞';
    boxes[0].dispatchEvent(new Event('change', { bubbles: true }));
    var after = reasonBoxes();
    var out = [after[0].value, after[1].value];
    wrap.remove();
    return out;
  })()`);
  assertEq(reasons, ['第一台濾網堵塞', ''], '只有第一張卡片的維修原因被改動');

  console.log('\n移除中間卡片');
  const afterRemove = await evaluate(`(function () {
    var base = JSON.parse(JSON.stringify(window.__baseCase));
    base.serviceItems = [
      { id: 'SIa', equipment: window.__mkEq('E1', '室內機', 'FTXS'), actualReason: 'A', processRecords: [] },
      { id: 'SIb', equipment: window.__mkEq('E2', '冰水主機', 'CH-200'), actualReason: 'B', processRecords: [] },
      { id: 'SIc', equipment: window.__mkEq('E3', '排風機', 'VF-10'), actualReason: 'C', processRecords: [] }
    ];
    var wrap = window.__mountEdit(base);
    var removeBtns = Array.prototype.filter.call(wrap.querySelectorAll('button'), function (b) {
      return b.textContent.replace(/\\s+/g, ' ').trim() === '移除';
    });
    removeBtns[1].click();
    var titles = window.__cardTitles(wrap);
    wrap.remove();
    return titles;
  })()`);
  assertEq(afterRemove.length, 2, '移除後剩兩張卡片');
  assertTrue(afterRemove[0].indexOf('FTXS') !== -1, '第一張保留', afterRemove[0]);
  assertTrue(afterRemove[1].indexOf('VF-10') !== -1, '第三張遞補為設備 2', afterRemove[1]);
  assertTrue(afterRemove[1].indexOf('設備 2') === 0, '序號重新編號', afterRemove[1]);

  console.log('\n存檔保留多筆設備');
  const saved = await evaluate(`(function () {
    var base = JSON.parse(JSON.stringify(window.__baseCase));
    base.serviceItems = [
      { id: 'SIa', equipment: window.__mkEq('E1', '室內機', 'FTXS'), actualReason: 'A', processRecords: [] },
      { id: 'SIb', equipment: window.__mkEq('E2', '冰水主機', 'CH-200'), actualReason: 'B', processRecords: [] }
    ];
    window.__saved = null;
    var wrap = window.__mountEdit(base);
    var saveBtn = Array.prototype.find.call(wrap.querySelectorAll('button'), function (b) {
      return b.textContent.replace(/\\s+/g, ' ').trim().indexOf('儲存') !== -1;
    });
    saveBtn.click();
    var out = window.__saved
      ? window.__saved[0].serviceItems.map(function (it) {
          return [it.equipment.model, it.actualReason].join(':');
        })
      : null;
    wrap.remove();
    return out;
  })()`);
  assertEq(saved, ['FTXS:A', 'CH-200:B'], '存檔後兩張卡片與各自維修原因都保留');

  console.log('\n舊案自動遷移');
  const migrated = await evaluate(`(function () {
    var legacy = JSON.parse(JSON.stringify(window.__baseCase));
    delete legacy.serviceItems;
    legacy.equipment = window.__mkEq('E1', '室內機', 'FTXS');
    legacy.actualReason = '舊資料原因';
    legacy.processRecords = [];
    var wrap = window.__mountEdit(legacy);
    var titles = window.__cardTitles(wrap);
    var text = wrap.textContent.replace(/\\s+/g, ' ');
    wrap.remove();
    return { titles: titles, hasReason: text.indexOf('舊資料原因') !== -1 };
  })()`);
  assertEq(migrated.titles.length, 1, '舊案顯示為單張卡片');
  assertEq(migrated.hasReason, true, '舊案的維修原因仍在');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-case-multi-equipment.mjs`
Expected: FAIL — `區塊 3 已合併命名`（仍是「3. 設備資料」）

- [ ] **Step 3: Write minimal implementation**

In `NewCaseForm`'s `handleSubmit` (around line 185-195), replace the three legacy
keys with the new one:

```javascript
          processStatus: null,
          indicator: payload.workCategory === '緊急叫修' ? 'urgent' : 'completed',
          isClosed: false,
          serviceItems: [],
          reRepairDate: '',
```

(remove the `actualReason: '',`, `processRecords: [],` and `equipment: null,` lines —
`normalizeRepairCase` would otherwise re-delete them and the value is already `[]`.)

In `EditCaseForm`, replace the single `newRecord` closure variable with a per-card map:

```javascript
    // 每張卡片各自暫存「新增處理方式」的挑選，切換卡片不互相干擾
    var newRecordByItemId = {};
    function getNewRecord(itemId) {
      if (!newRecordByItemId[itemId]) {
        newRecordByItemId[itemId] = ProcessMethodUtils.normalizeProcessMethodSelection(processMethods, null);
      }
      return newRecordByItemId[itemId];
    }
```

Delete `handleCat1Change` / `handleCat2Change` / `handleCat3Change` / `handleSpecChange`
and the `cat1Options` … `selectedUnit` locals (the card owns them now). Replace
`assignEquipment` / record handlers with card-aware versions:

```javascript
      function assignEquipment(eq) {
        // 已汰換的設備不可加入案件
        if (EquipmentUtils.isRetired(eq)) {
          showToast('已汰換的設備無法加入設備資料', 'error');
          pickerOpen = false;
          addEquipMenuOpen = false;
          rerender();
          return false;
        }
        formData.serviceItems = RepairCaseServiceItems.getItems(formData)
          .concat([RepairCaseServiceItems.createItem(eq)]);
        pickerOpen = false;
        addEquipMenuOpen = false;
        rerender();
        return true;
      }
      function handleRemoveItem(itemId) {
        formData.serviceItems = RepairCaseServiceItems.removeItem(formData, itemId);
        delete newRecordByItemId[itemId];
        rerender();
      }
      function handleReasonChange(itemId, value) {
        formData.serviceItems = RepairCaseServiceItems.updateItem(formData, itemId, { actualReason: value });
        rerender();
      }
      function handleAddRecord(itemId, pm, qty, status) {
        if (!pm) {
          showToast('請選擇處理方式', 'error');
          return;
        }
        var item = RepairCaseServiceItems.getItems(formData).filter(function (it) {
          return it.id === itemId;
        })[0];
        formData.serviceItems = RepairCaseServiceItems.updateItem(formData, itemId, {
          processRecords: (item.processRecords || []).concat([
            ProcessMethodUtils.toCaseProcessRecord(pm, qty, null, status)
          ])
        });
        rerender();
      }
      function handleRemoveRecord(itemId, recordId) {
        var item = RepairCaseServiceItems.getItems(formData).filter(function (it) {
          return it.id === itemId;
        })[0];
        formData.serviceItems = RepairCaseServiceItems.updateItem(formData, itemId, {
          processRecords: (item.processRecords || []).filter(function (r) { return r.id !== recordId; })
        });
        rerender();
      }
      function handleToggleRecordStatus(itemId, recordId) {
        var item = RepairCaseServiceItems.getItems(formData).filter(function (it) {
          return it.id === itemId;
        })[0];
        formData.serviceItems = RepairCaseServiceItems.updateItem(formData, itemId, {
          processRecords: (item.processRecords || []).map(function (r) {
            if (r.id !== recordId) return r;
            return Object.assign({}, r, {
              status: ProcessMethodUtils.toggleCaseRecordStatus(ProcessMethodUtils.getCaseRecordStatus(r))
            });
          })
        });
        rerender();
      }
```

In `handleSubmit`, the old guard is gone; replace it with a card-integrity check:

```javascript
      function handleSubmit() {
        var missingEquipment = RepairCaseServiceItems.getItems(formData).some(function (it) {
          return !it.equipment;
        });
        if (missingEquipment) {
          showToast('每份服務項目都必須對應一筆設備', 'error');
          return;
        }
        formData.planDate = formData.expectedDate || formData.planDate || '';
        ...unchanged...
      }
```

Change the result-lock condition:

```javascript
      var hasServiceItems = RepairCaseServiceItems.getItems(formData).length > 0;
      /* 維修結果原則上要先加入設備才可編輯；工項分類為「其他」時不受此限 */
      var resultLocked = !hasServiceItems && !isOther;
```

Replace the two sections (the `3. 設備資料` section and the whole `4. 服務項目`
section) with one section. The 加入設備 dropdown markup is unchanged — only the
heading text and the body below it change:

```javascript
        h("section", {
          className: "bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100"
        },
          h("div", { className: "flex flex-wrap justify-between items-center gap-3 border-b pb-2 mb-4" },
            h("h3", { className: "text-lg font-bold text-blue-800" }, "3. 設備與服務項目"),
            /* ...既有的「加入設備 ▾」按鈕與選單原樣保留... */
          ),
          hasServiceItems
            ? RepairCaseServiceItems.getItems(formData).map(function (item, idx) {
                return h(RepairCaseServiceItemCard, {
                  key: item.id,
                  h: h,
                  index: idx,
                  item: item,
                  caseContext: formData,
                  deviceCategories: deviceCategories,
                  processMethods: processMethods,
                  newRecord: getNewRecord(item.id),
                  isOther: isOther,
                  isClosed: formData.isClosed,
                  onNewRecordChange: function (sel) { newRecordByItemId[item.id] = sel; rerender(); },
                  onReasonChange: function (v) { handleReasonChange(item.id, v); },
                  onAddRecord: function (pm, qty, status) { handleAddRecord(item.id, pm, qty, status); },
                  onToggleRecordStatus: function (rid) { handleToggleRecordStatus(item.id, rid); },
                  onRemoveRecord: function (rid) { handleRemoveRecord(item.id, rid); },
                  onRemoveItem: function () { handleRemoveItem(item.id); }
                });
              })
            : h("div", {
                className: "text-center py-8 text-gray-400 bg-gray-50 rounded-md border border-dashed"
              }, "請點擊「加入設備」手動選擇或掃描 QR Code"),
          h("div", { className: "mt-4" },
            h("label", { className: "block text-sm mb-1" }, "備註"),
            h("textarea", {
              name: "remarks",
              value: formData.remarks || '',
              onChange: handleChange,
              disabled: !hasServiceItems,
              rows: "4",
              className: "w-full p-2.5 border rounded-md outline-none disabled:bg-gray-100 disabled:cursor-not-allowed",
              placeholder: hasServiceItems ? "請輸入備註..." : "請先加入設備"
            })
          ),
          pickerOpen && h(RepairCaseEquipment.PickerModal, {
            h: h,
            items: storeEquipments,
            onSelect: handleSelectEquipment,
            onClose: function () { pickerOpen = false; rerender(); }
          })
        ),
```

Note 備註 stays case-level, placed below all cards.

Finally change the next section's heading from `"5. 維修結果"` to `"4. 維修結果"`.

`handleSimulateScan` needs no change — it still calls `assignEquipment`, which now
appends instead of replacing.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-case-multi-equipment.mjs`
Expected: PASS，`0 failed`

Run the form regressions:

```bash
node scripts/verify-case-add-equipment-menu.mjs
node scripts/verify-case-repair-edit-gating.mjs
node scripts/verify-process-record-status.mjs
node scripts/verify-case-record-points.mjs
```
Expected: all PASS. If a script builds fixtures with `equipment:` / `processRecords:`,
update those fixtures to `serviceItems:` — assertions stay the same.

- [ ] **Step 5: Commit**

```bash
git add src/features/repair/case-form.js scripts/
git commit -m "feat: 編輯案件可加入多筆設備，各自對應一份服務項目"
```

---

### Task 6: 唯讀明細與 PDF

**Files:**
- Modify: `src/features/repair/case-view.js`（sections at line 130-190；heading at 190）
- Modify: `src/features/repair/case-pdf.js`（`equipment` / `service` 組裝，line 148-170；`section(...)` 呼叫，line 195-199）
- Test: `scripts/verify-case-multi-equipment-view.mjs`

**Interfaces:**
- Consumes: Task 1 的 `RepairCaseServiceItems`、Task 4 的 `RepairCaseServiceItemCard`（`readOnly: true`）
- Produces: 唯讀明細與 PDF 皆以「3. 設備與服務項目」逐設備輸出，「4. 維修結果」遞補

- [ ] **Step 1: Write the failing test**

Create `scripts/verify-case-multi-equipment-view.mjs` (CDP, `CDP_PORT` default `9363`,
`--user-data-dir=/tmp/iess-multi-equip-view-profile`), reusing the same boilerplate.
After page load:

```javascript
  await evaluate(`
    window.__eq = function (id, name, model) {
      return {
        id: id, customerName: '測試客戶', storeName: '測試門市', category: '空調',
        brand: '大金', deviceName: name, specification: '2.2kW', model: model,
        equipmentLevel: '一般設備', area: '廚房', acceptanceDate: '2020-02-01',
        installer: '王小明', assetNumber: 'A-' + id, serialNumber: 'SN-' + id, status: '運轉中'
      };
    };
    window.__rec = function (id, cat3) {
      return { id: id, category1: '維修', category2: '空調', category3: cat3,
        specification: '標準', qty: 1, unit: '台', points: 2, status: '已處理' };
    };
    window.__case = {
      id: 'C1', caseNumber: '20260825001', customerName: '測試客戶', storeName: '測試門市',
      workCategory: '一般叫修', repairItem: '室內機', repairReason: '不冷', faultDesc: '出風不冷',
      isClosed: false, processStatus: null, remarks: '案件備註',
      createdAt: '2026-08-25 09:00:00', repairDate: '2026-08-25 09:00:00',
      assignees: [],
      serviceItems: [
        { id: 'SI1', equipment: window.__eq('E1', '室內機', 'FTXS'),
          actualReason: '第一台濾網堵塞', processRecords: [window.__rec(1, '清洗')] },
        { id: 'SI2', equipment: window.__eq('E2', '冰水主機', 'CH-200'),
          actualReason: '第二台軸承磨損', processRecords: [window.__rec(2, '更換')] }
      ]
    };
  `);

  console.log('\n唯讀明細');
  const view = await evaluate(`(function () {
    var wrap = document.createElement('div');
    document.body.appendChild(wrap);
    wrap.appendChild(ViewCaseForm({
      viewingCase: window.__case, setView: function () {}, backView: 'list',
      processMethods: [], deviceCategories: [], vehicles: [], vendors: [],
      cases: [window.__case], openPrevCase: function () {}, currentView: 'case-view'
    }));
    var hs = Array.prototype.map.call(wrap.querySelectorAll('h3'), function (n) {
      return n.textContent.replace(/\\s+/g, ' ').trim();
    });
    var text = wrap.textContent.replace(/\\s+/g, ' ');
    var out = {
      headings: hs,
      buttonsInCards: wrap.querySelectorAll('table button').length,
      hasFirst: text.indexOf('第一台濾網堵塞') !== -1,
      hasSecond: text.indexOf('第二台軸承磨損') !== -1,
      hasFtxs: text.indexOf('FTXS') !== -1,
      hasCh200: text.indexOf('CH-200') !== -1
    };
    wrap.remove();
    return out;
  })()`);
  assertTrue(view.headings.some(t => t.indexOf('3. 設備與服務項目') === 0), '明細區塊 3 已合併', view.headings.join(' | '));
  assertTrue(view.headings.some(t => t === '4. 維修結果'), '明細維修結果遞補為 4', view.headings.join(' | '));
  assertEq(view.hasFirst, true, '明細含第一台維修原因');
  assertEq(view.hasSecond, true, '明細含第二台維修原因');
  assertEq(view.hasFtxs, true, '明細含第一台型號');
  assertEq(view.hasCh200, true, '明細含第二台型號');
  assertEq(view.buttonsInCards, 0, '唯讀明細的處理方式表無操作按鈕');

  console.log('\nPDF HTML');
  const pdf = await evaluate(`(function () {
    var html = buildCasePdfHtml(window.__case, {
      deviceCategories: [], processMethods: []
    });
    return {
      hasMerged: html.indexOf('3. 設備與服務項目') !== -1,
      hasResult4: html.indexOf('4. 維修結果') !== -1,
      hasOldService: html.indexOf('4. 服務項目') !== -1,
      hasFirst: html.indexOf('第一台濾網堵塞') !== -1,
      hasSecond: html.indexOf('第二台軸承磨損') !== -1,
      hasFtxs: html.indexOf('FTXS') !== -1,
      hasCh200: html.indexOf('CH-200') !== -1,
      hasRemarks: html.indexOf('案件備註') !== -1
    };
  })()`);
  assertEq(pdf.hasMerged, true, 'PDF 有合併後的區塊標題');
  assertEq(pdf.hasResult4, true, 'PDF 維修結果為 4');
  assertEq(pdf.hasOldService, false, 'PDF 不再有獨立的 4. 服務項目');
  assertEq(pdf.hasFirst, true, 'PDF 含第一台維修原因');
  assertEq(pdf.hasSecond, true, 'PDF 含第二台維修原因');
  assertEq(pdf.hasFtxs, true, 'PDF 含第一台型號');
  assertEq(pdf.hasCh200, true, 'PDF 含第二台型號');
  assertEq(pdf.hasRemarks, true, 'PDF 保留案件備註');
```

The exported names are `ViewCaseForm` (case-view.js) and `buildCasePdfHtml` (case-pdf.js).
Confirm they are still current before writing the test:

```bash
grep -n "window.ViewCaseForm\|window.buildCasePdfHtml" src/features/repair/case-view.js src/features/repair/case-pdf.js
```

Use whatever names those greps report in the test above.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-case-multi-equipment-view.mjs`
Expected: FAIL — `明細區塊 3 已合併`（仍是「3. 設備資料」）

- [ ] **Step 3: Write minimal implementation**

In `src/features/repair/case-view.js`, replace the `3. 設備資料` and `4. 服務項目`
sections with one merged section:

```javascript
        h('section', { className: 'bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100' },
          h('h3', { className: 'text-lg font-bold text-blue-800 border-b pb-2 mb-4' }, '3. 設備與服務項目'),
          RepairCaseServiceItems.getItems(viewingCase).length
            ? RepairCaseServiceItems.getItems(viewingCase).map(function (item, idx) {
                return h(RepairCaseServiceItemCard, {
                  key: item.id,
                  h: h,
                  index: idx,
                  item: item,
                  caseContext: viewingCase,
                  deviceCategories: deviceCategories,
                  processMethods: processMethods,
                  isOther: isOther,
                  isClosed: viewingCase && viewingCase.isClosed,
                  readOnly: true
                });
              })
            : h('div', {
                className: 'text-center py-4 text-gray-400 bg-gray-50 rounded-md border border-dashed'
              }, '無設備資料'),
          h(ReadOnlyField, { label: '備註', value: viewingCase && viewingCase.remarks, fullWidth: true })
        ),
```

Change the next heading from `'5. 維修結果'` to `'4. 維修結果'`.
The `formatRecordPoints` local and `pmColumns` local in this file become unused —
delete them if no other code in the file references them (check with
`grep -n "formatRecordPoints\|pmColumns" src/features/repair/case-view.js`).

In `src/features/repair/case-pdf.js`, replace the `equipment` and `service`
variables with one per-card builder:

```javascript
    var pmColumns = ProcessMethodUtils.CASE_DISPLAY_COLUMNS;
    var items = RepairCaseServiceItems.getItems(c);
    // 一台設備一個小節：設備欄位 → 實際維修原因 → 處理方式表
    var serviceItems = items.length
      ? items.map(function (item, idx) {
          var eq = item.equipment || {};
          var title = '設備 ' + (idx + 1) + '　'
            + (eq.deviceName || eq.name || '未指定設備')
            + (eq.model ? ' ' + eq.model : '');
          var records = ProcessMethodUtils.sortCaseProcessRecords(item.processRecords || []);
          var pmRows = records.map(function (r) {
            var isDone = ProcessMethodUtils.isCaseRecordDone(r);
            var pts = ProcessMethodUtils.resolveCaseRecordPoints(r, processMethods, !!c.isClosed);
            return pmColumns.map(function (col) { return r[col.key]; }).concat([
              ProcessMethodUtils.getCaseRecordStatus(r),
              (pts === null ? '—' : String(pts)) + (isDone ? '' : '（不計分）'),
              [r.qty, r.unit].filter(function (v) { return v != null && v !== ''; }).join(' ')
            ]);
          });
          return '<div class="sub-title">' + esc(title) + '</div>'
            + (item.equipment
              ? fieldTable(RepairCaseEquipment.getDisplayFields(item.equipment, c, opts.deviceCategories))
              : '<div class="empty">無設備資料</div>')
            + (isOther ? '' : fieldTable([{ label: '實際維修原因', value: item.actualReason, full: true }]))
            + dataTable(
                pmColumns.map(function (col) { return col.label; }).concat(['狀態', '積分數', '數量']),
                pmRows,
                '無處理方式紀錄'
              );
        }).join('')
      : '<div class="empty">無設備資料</div>';
    var service = serviceItems + fieldTable([{ label: '備註', value: c.remarks, full: true }]);
```

And the section list:

```javascript
    return wrap(
      docHead('案件明細', c.caseNumber) +
      section('1. 排程資料', schedule) +
      section('2. 案件資料', info) +
      section('3. 設備與服務項目', service) +
      section('4. 維修結果', result)
    );
```

Leave the maintenance PDF builder (its `equipmentList` and `4. 保養結果`) untouched.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-case-multi-equipment-view.mjs`
Expected: PASS，`0 failed`

Run: `node scripts/verify-maintenance-detail-sections.mjs`
Expected: PASS（確認保養 PDF 未被波及）

- [ ] **Step 5: Commit**

```bash
git add src/features/repair/case-view.js src/features/repair/case-pdf.js scripts/verify-case-multi-equipment-view.mjs
git commit -m "feat: 案件明細與 PDF 逐設備呈現服務項目"
```

---

### Task 7: 派工明細、門市叫修單、seed 多設備樣本

**Files:**
- Modify: `src/features/scheduling/case-arrangement.js`（設備／服務項目區塊，約 line 666-755；新增 `updateScheduleServiceItemField`，接在 `updateScheduleFormField` 之後約 line 465）
- Modify: `src/features/customer/store-repair-form.js`（新案初值，約 line 70-78）
- Modify: `src/data/seed.js`（新增多設備案例）
- Test: `scripts/verify-case-multi-equipment-arrangement.mjs`

**Interfaces:**
- Consumes: Task 1 的 `RepairCaseServiceItems`、Task 4 的 `RepairCaseServiceItemCard`
- Produces:
  - 派工明細 modal 逐設備列出，實際維修原因可逐卡編輯
  - `updateScheduleServiceItemField(itemId, name, value)`
  - seed 中至少一筆案件的 `serviceItems.length >= 2`

- [ ] **Step 1: Write the failing test**

Create `scripts/verify-case-multi-equipment-arrangement.mjs` (CDP, `CDP_PORT`
default `9364`, `--user-data-dir=/tmp/iess-multi-equip-arr-profile`). After page load:

```javascript
  console.log('\nseed 有多設備案例');
  const seedCheck = await evaluate(`(function () {
    var multi = (INITIAL_CASES || []).filter(function (c) {
      return RepairCaseServiceItems.getItems(c).length >= 2;
    });
    return {
      count: multi.length,
      itemCount: multi.length ? RepairCaseServiceItems.getItems(multi[0]).length : 0,
      allMigrated: (INITIAL_CASES || []).every(function (c) {
        return !('equipment' in c) && !('processRecords' in c) && !('actualReason' in c);
      })
    };
  })()`);
  assertTrue(seedCheck.count >= 1, 'seed 至少有一筆多設備案件', String(seedCheck.count));
  assertTrue(seedCheck.itemCount >= 2, '該案件至少兩張卡片', String(seedCheck.itemCount));
  assertEq(seedCheck.allMigrated, true, 'seed 全部案件已遷移，無殘留舊欄位');

  console.log('\n派工明細逐設備列出');
  const arrangement = await evaluate(`(function () {
    var c = (INITIAL_CASES || []).filter(function (x) {
      return RepairCaseServiceItems.getItems(x).length >= 2;
    })[0];
    var items = RepairCaseServiceItems.getItems(c);
    var html = CaseArrangement.renderRepairScheduleDetailsForTest
      ? CaseArrangement.renderRepairScheduleDetailsForTest(c)
      : null;
    return {
      models: items.map(function (it) { return (it.equipment || {}).model || ''; }),
      reasons: items.map(function (it) { return it.actualReason || ''; }),
      rendered: html ? html.textContent.replace(/\\s+/g, ' ') : null
    };
  })()`);
  assertTrue(arrangement.models.length >= 2, '取得多設備案件', arrangement.models.join(' | '));
  assertTrue(
    arrangement.rendered === null
      || arrangement.models.every(function (m) { return !m || arrangement.rendered.indexOf(m) !== -1; }),
    '派工明細列出每一台設備',
    String(arrangement.rendered).slice(0, 200)
  );
```

Note: `case-arrangement.js` renders inside a modal closure. Before writing this
test, check whether a render helper is reachable from the page:

```bash
grep -n "window.CaseArrangement\|renderRepairScheduleDetails" src/features/scheduling/case-arrangement.js
```

If no test seam exists, export one at the bottom of the IIFE:
`CaseArrangement.renderRepairScheduleDetailsForTest = renderRepairScheduleDetails;`
and keep the assertion above as written.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-case-multi-equipment-arrangement.mjs`
Expected: FAIL — `seed 至少有一筆多設備案件 — 0`

- [ ] **Step 3: Write minimal implementation**

In `src/features/scheduling/case-arrangement.js`, add next to `updateScheduleFormField`:

```javascript
      // 服務項目掛在各自的設備卡片下，故派工明細也逐卡片寫回
      function updateScheduleServiceItemField(itemId, name, value) {
        if (!scheduleModal) return;
        var patch = {};
        patch[name] = value;
        scheduleModal = Object.assign({}, scheduleModal, {
          formData: Object.assign({}, scheduleModal.formData, {
            serviceItems: RepairCaseServiceItems.updateItem(scheduleModal.formData, itemId, patch)
          })
        });
        rerender();
      }
```

Replace the `2. 設備資料` and `3. 服務項目` sections with one section. `isOther`
still swaps in the plain 備註 textarea:

```javascript
          h('section', { className: 'bg-gray-50 border border-gray-200 rounded-md p-4' },
            h('h4', { className: 'text-sm font-bold text-blue-800 border-b pb-2 mb-3' },
              isOther ? '2. 備註' : '2. 設備與服務項目'),
            isOther
              ? h('div', null,
                  renderScheduleFieldLabel('備註'),
                  h('textarea', {
                    value: formData.remarks || '',
                    onChange: function (e) { updateScheduleFormField('remarks', e.target.value); },
                    rows: 3,
                    className: inputCls
                  })
                )
              : h('div', { className: 'space-y-4' },
                  RepairCaseServiceItems.getItems(formData).length
                    ? RepairCaseServiceItems.getItems(formData).map(function (item, idx) {
                        return h('div', { key: item.id, className: 'bg-white border rounded-md p-3' },
                          h('div', { className: 'font-semibold text-sm text-gray-700 mb-2' },
                            '設備 ' + (idx + 1) + '　'
                              + ((item.equipment || {}).deviceName || (item.equipment || {}).name || '未指定設備')),
                          h(RepairCaseEquipment.Panel, {
                            h: h,
                            equipment: item.equipment,
                            caseContext: formData,
                            deviceCategories: deviceCategories,
                            FieldComponent: ReadOnlyField,
                            emptyText: '無設備資料'
                          }),
                          h('div', { className: 'mt-3' },
                            renderScheduleFieldLabel('實際維修原因'),
                            h('textarea', {
                              value: item.actualReason || '',
                              onChange: function (e) {
                                updateScheduleServiceItemField(item.id, 'actualReason', e.target.value);
                              },
                              rows: 2,
                              className: inputCls
                            })
                          ),
                          h('div', { className: 'mt-3' },
                            renderScheduleFieldLabel('處理方式'),
                            /* 既有的處理方式唯讀表格原樣保留，只把
                               formData.processRecords 換成 item.processRecords */
                          )
                        );
                      })
                    : h('div', {
                        className: 'text-center py-4 text-gray-400 bg-white rounded-md border border-dashed'
                      }, '無設備資料'),
                  h('div', null,
                    renderScheduleFieldLabel('備註'),
                    h('textarea', {
                      value: formData.remarks || '',
                      onChange: function (e) { updateScheduleFormField('remarks', e.target.value); },
                      rows: 3,
                      className: inputCls
                    })
                  )
                )
          ),
```

Renumber the subsequent `h4` headings in this modal so numbering stays contiguous
(check with `grep -n "'[0-9]\. " src/features/scheduling/case-arrangement.js`).

In `src/features/customer/store-repair-form.js`, replace in the new-case object:

```javascript
          isClosed: false,
          serviceItems: [],
          reRepairDate: '',
```

(delete the `actualReason: '',`, `processRecords: [],`, `equipment: null,` lines.)

In `src/data/seed.js`, add a multi-equipment case. Find an existing case object
that has `processRecords: [ caseProcessRecordFromPm(...) ]` and add **one new
case** alongside it (do not rewrite the existing ones — they migrate automatically):

```javascript
  {
    id: 'C-MULTI-1',
    caseNumber: '20260825900',
    workCategory: '一般叫修',
    customerName: <copy from a neighbouring case>,
    storeName: <copy from the same neighbouring case>,
    /* ...copy the same scaffolding fields the neighbouring case uses... */
    // 展示一案多設備：兩台設備各自帶一份服務項目
    serviceItems: [
      {
        id: 'SI-MULTI-1',
        equipment: <copy an equipment snapshot shape used elsewhere in seed.js>,
        actualReason: '室內機濾網堵塞導致風量不足',
        processRecords: [caseProcessRecordFromPm('MS0001', 1, 1)]
      },
      {
        id: 'SI-MULTI-2',
        equipment: <a second, different equipment snapshot>,
        actualReason: '冷媒管保溫破損',
        processRecords: [caseProcessRecordFromPm('MC0012', 1, 2, '待處理')]
      }
    ]
  },
```

Confirm the process-method ids exist first:

```bash
grep -n "MS0001\|MC0012" src/data/process-methods-seed-data.js
```

Use whatever ids that grep confirms.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-case-multi-equipment-arrangement.mjs`
Expected: PASS，`0 failed`

- [ ] **Step 5: Commit**

```bash
git add src/features/scheduling/case-arrangement.js src/features/customer/store-repair-form.js src/data/seed.js scripts/verify-case-multi-equipment-arrangement.mjs
git commit -m "feat: 派工明細與門市叫修單支援多筆設備"
```

---

### Task 8: 全域清查與回歸

**Files:**
- Modify: 任何仍讀取 `c.equipment` / `c.processRecords` / `c.actualReason` 的檔案
- Modify: `README.md`（檔案結構表補上兩個新檔）
- Test: 既有全部 `scripts/verify-*.mjs`

**Interfaces:**
- Consumes: Task 1-7 的全部成果
- Produces: 全站無殘留的舊欄位讀取；README 與實際檔案一致

- [ ] **Step 1: Find every remaining legacy read**

Run:

```bash
grep -rn "\.processRecords\|\.actualReason\|\.equipment\b" src/ \
  | grep -v "src/features/repair/case-service-items.js" \
  | grep -v "src/features/repair/case-assignee-utils.js" \
  | grep -v "item.processRecords\|it.processRecords\|item.actualReason\|it.actualReason\|item.equipment\|it.equipment"
```

Expected after Tasks 1-7: only `equipmentList` / maintenance hits and
`RepairCaseEquipment` internals (which take an equipment object, not a case).
Each remaining case-level hit is a bug — fix it to use
`RepairCaseServiceItems.getItems / getAllProcessRecords / getEquipments`.

- [ ] **Step 2: Run the full verification suite**

```bash
for f in scripts/verify-*.mjs; do
  echo "=== $f"
  node "$f" || echo "FAILED: $f"
done
```

Expected: every script reports `0 failed`. Record any failure and fix it before
continuing — a fixture built with the old `equipment:` / `processRecords:` shape
should be rewritten to `serviceItems:` with the same assertions.

- [ ] **Step 3: Smoke-test the app by hand**

Open `index.html` in a browser and walk: 案件處理 → 編輯一筆案件 → 加入兩台設備 →
各填維修原因與處理方式 → 儲存 → 檢視明細 → 下載 PDF → 排程派工明細 → 銷案審核。
Confirm no console errors and both 設備 appear everywhere.

- [ ] **Step 4: Update README**

In `README.md`'s file-structure block, add under `repair/`:

```
│   │   ├── case-service-items.js      案件設備＋服務項目卡片集合（含舊資料遷移）
│   │   ├── case-service-item-card.js  單張「設備＋服務項目」卡片元件
```

And in 功能說明, add one line:

```
叫修案件可加入多筆設備，一筆設備對應一份服務項目（實際維修原因＋處理方式）；
舊案件的單一設備會自動遷移為一張卡片。
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: 多筆設備資料全域清查與文件更新"
```

---

## Self-Review Notes

- Spec 的每個小節都有對應 Task：資料模型/遷移 → T1；聚合 helper → T1；
  版面 → T4+T5；驗證與鎖定 → T5；下游改動表 → T2/T3/T6/T7/T8；
  延伸案件 → T3；增額積分 → T2；驗證 → 各 Task 的測試 + T8。
- 命名一致性：全程使用 `serviceItems`、`RepairCaseServiceItems`、
  `RepairCaseServiceItemCard`、`normalizeServiceItems`、`hasAnyProcessData`、
  `getAllProcessRecords`、`getEquipments`、`getCaseEquipmentLevels`。
