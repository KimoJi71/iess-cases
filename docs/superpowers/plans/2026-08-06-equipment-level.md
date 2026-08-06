# 設備等級（基礎／增額） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在設備分類管理新增「設備等級」（基礎設備／增額設備），讓客戶設備依型號唯讀帶入並在兩處列表顯示，且 A/B 服務等級客戶的叫修單選到增額設備時也計入績效積分。

**Architecture:** 設備等級是設備分類（DeviceCategory）的屬性，以「型號」為鍵。客戶設備記錄與叫修案件都**不儲存**這個欄位，一律在顯示與計算時用 `model` 反查設備分類，因此改分類設定後所有下游自動同步。積分只放寬「哪些案件納入」的閘門，分攤公式完全不動。

**Tech Stack:** 原生 ES5 瀏覽器 JS，IIFE 模組掛 `window.*`，自製 `IESS.h` / `IESS.stateful` 渲染（React-like createElement API），Tailwind class 字串。驗證用 Node `node:vm` sandbox 腳本（`.mjs`），無測試框架。

## Global Constraints

- 全部程式碼用 ES5 語法：`var`、`function`、`Object.assign`。**禁止** `let`/`const`/箭頭函式/樣板字串/展開運算子。（例外：`scripts/*.mjs` 驗證腳本是 Node ESM，可用現代語法。）
- 每個 `src/**/*.js` 都是 `(function () { 'use strict'; ... })();` IIFE，結尾掛 `window.XXX = ...`。
- 設備等級選項值固定為字串 `'基礎設備'` 與 `'增額設備'`，**不得**改字或加空白。
- 空值／查無資料一律視為 `'基礎設備'`，絕不回傳空字串或 `undefined`。
- 設備等級**不參與**設備分類的重複性判定（`recordKey` 只用 `FIELD_KEYS` 七欄）。
- 客戶設備記錄（equipments）與叫修案件快照**不新增** `equipmentLevel` 欄位。
- 積分分攤公式 `CaseAssigneeUtils.computeBonusPointsForAssignee` 不得修改。
- UI 文案一律繁體中文。
- 新檔案必須加進 `index.html` 的 script 標籤（本計畫不新增 `src/` 檔案，故不需要）。
- 每個 Task 結束都要 commit，commit message 用英文祈使句。

## File Structure

| 檔案 | 責任 | 動作 |
|---|---|---|
| `src/data/options.js` | 全域選項常數 | 新增 `EQUIPMENT_LEVEL_OPTIONS` |
| `src/data/seed.js` | 種子資料 | 6 筆 `INITIAL_DEVICE_CATEGORIES` 補 `equipmentLevel` |
| `src/features/permissions/device-category-utils.js` | 設備分類正規化／查詢的唯一來源 | 加 `ATTR_KEYS`、`getEquipmentLevel`、`getEquipmentLevelByModel` |
| `src/features/permissions/device-category-form.js` | 設備分類新增/編輯表單 | `FIELDS` 支援 select，加設備等級欄位 |
| `src/features/permissions/device-category-list.js` | 設備分類列表 | 加設備等級欄 |
| `src/features/customer/equipment-form.js` | 客戶設備表單 | 型號下方加唯讀設備等級 |
| `src/features/customer/equipment-list.js` | 客戶設備列表 | 加設備等級 badge 欄 |
| `src/features/reports/performance-utils.js` | 績效計算 | 加積分資格判定，放寬閘門 |
| `src/features/reports/case-performance-stats.js` | 績效統計畫面 | 轉傳 `deviceCategories` |
| `src/app.js` | 路由與 props 串接 | 兩處補 `deviceCategories` prop |
| `scripts/verify-equipment-level-points.mjs` | 驗證腳本 | 新建 |

---

### Task 1: 選項常數、種子資料與 utils 查詢函式

這是全部下游的基礎。設備等級的「空值視為基礎設備」語意只在這裡定義一次，UI 與積分計算都呼叫同一組函式。

**Files:**
- Modify: `src/data/options.js:86`（`EQUIP_STATUS_OPTIONS` 那行之後）
- Modify: `src/data/seed.js:1893-1953`（`INITIAL_DEVICE_CATEGORIES` 全部 6 筆）
- Modify: `src/features/permissions/device-category-utils.js:7`（`FIELD_KEYS` 宣告處）、`:9-15`（`normalizeRecord`）、`:109-118`（`findRecordByModel` 之後）、`:258-274`（export 區）
- Test: `scripts/verify-equipment-level-points.mjs`（本任務建立，後續 Task 5 擴充）

**Interfaces:**
- Consumes: 既有 `DeviceCategoryUtils.findRecordByModel(deviceCategories, model)`
- Produces:
  - 全域 `EQUIPMENT_LEVEL_OPTIONS: string[]` = `['基礎設備', '增額設備']`
  - `DeviceCategoryUtils.ATTR_KEYS: string[]` = `['equipmentLevel']`
  - `DeviceCategoryUtils.getEquipmentLevel(record): string` — 永遠回傳 `'基礎設備'` 或 `'增額設備'`
  - `DeviceCategoryUtils.getEquipmentLevelByModel(deviceCategories, model): string` — 同上
  - `DeviceCategoryUtils.normalizeRecord(record)` 回傳物件多含 `equipmentLevel` 鍵
  - `DeviceCategoryUtils.recordKey(record)` 行為**不變**（仍只用七欄）

- [ ] **Step 1: 寫失敗的驗證腳本**

建立 `scripts/verify-equipment-level-points.mjs`：

```js
#!/usr/bin/env node
/**
 * Verification for equipment level (設備等級) lookup and bonus eligibility.
 * Loads the browser IIFE modules in Node with minimal stubs.
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

const sandbox = {
  console,
  // 必須與 src/data/options.js 的 EQUIPMENT_LEVEL_OPTIONS 一致
  EQUIPMENT_LEVEL_OPTIONS: ['基礎設備', '增額設備'],
  EQUIP_MODEL_CATALOG: {},
  EQUIP_MODEL_OPTIONS: [],
  EQUIP_CATEGORY_OPTIONS: [],
  EQUIP_BRAND_OPTIONS: [],
  EQUIP_NAME_OPTIONS: [],
  EQUIP_STATUS_OPTIONS: ['運轉', '轉汰換', '已汰換']
};
sandbox.window = sandbox;
vm.createContext(sandbox);

function load(relPath) {
  vm.runInContext(readFileSync(join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath.split('/').pop()
  });
}

load('src/features/permissions/device-category-utils.js');

const DCU = sandbox.window.DeviceCategoryUtils;

const cats = [
  { id: 'DCAT1', category: '分離式', brand: '日立', deviceName: '分離式冷氣',
    specification: '3.5匹', model: 'RAS-100', refrigerant: 'R410A',
    powerSource: '220V', equipmentLevel: '基礎設備' },
  { id: 'DCAT2', category: '分離式', brand: '大金', deviceName: '吊隱式冷氣',
    specification: '4.0匹', model: 'FXYP100', refrigerant: 'R32',
    powerSource: '220V', equipmentLevel: '增額設備' },
  // 舊資料：完全沒有 equipmentLevel 鍵
  { id: 'DCAT3', category: '冰水', brand: '三菱重工', deviceName: '冰水主機',
    specification: '5.0匹', model: 'PA-063', refrigerant: 'R134a',
    powerSource: '380V' }
];

console.log('getEquipmentLevel');
assertEq(DCU.getEquipmentLevel(cats[0]), '基礎設備', '明確為基礎設備');
assertEq(DCU.getEquipmentLevel(cats[1]), '增額設備', '明確為增額設備');
assertEq(DCU.getEquipmentLevel(cats[2]), '基礎設備', '舊資料無欄位視為基礎設備');
assertEq(DCU.getEquipmentLevel({ equipmentLevel: '' }), '基礎設備', '空字串視為基礎設備');
assertEq(DCU.getEquipmentLevel({ equipmentLevel: '  ' }), '基礎設備', '空白字串視為基礎設備');
assertEq(DCU.getEquipmentLevel(null), '基礎設備', 'null 視為基礎設備');

console.log('\ngetEquipmentLevelByModel');
assertEq(DCU.getEquipmentLevelByModel(cats, 'FXYP100'), '增額設備', '依型號查到增額設備');
assertEq(DCU.getEquipmentLevelByModel(cats, 'RAS-100'), '基礎設備', '依型號查到基礎設備');
assertEq(DCU.getEquipmentLevelByModel(cats, 'PA-063'), '基礎設備', '舊資料型號視為基礎設備');
assertEq(DCU.getEquipmentLevelByModel(cats, '不存在的型號'), '基礎設備', '查無型號視為基礎設備');
assertEq(DCU.getEquipmentLevelByModel(cats, ''), '基礎設備', '型號為空視為基礎設備');
assertEq(DCU.getEquipmentLevelByModel([], 'FXYP100'), '基礎設備', '分類清單為空視為基礎設備');

console.log('\nnormalizeRecord / recordKey');
const normalized = DCU.normalizeRecord(cats[1]);
assertEq(normalized.equipmentLevel, '增額設備', 'normalizeRecord 保留 equipmentLevel');
assertEq(normalized.model, 'FXYP100', 'normalizeRecord 保留七欄');
assertEq(DCU.normalizeRecord(cats[2]).equipmentLevel, '', 'normalizeRecord 對缺欄位輸出空字串');

const baseRec = Object.assign({}, cats[0]);
const sameButAddOn = Object.assign({}, cats[0], { equipmentLevel: '增額設備' });
assertEq(
  DCU.findDuplicate([baseRec], sameButAddOn, null), true,
  '七欄相同、等級不同仍判定為重複'
);
const diffModel = Object.assign({}, cats[0], { model: 'OTHER-1' });
assertEq(
  DCU.findDuplicate([baseRec], diffModel, null), false,
  '型號不同不算重複'
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: 執行腳本確認失敗**

Run: `node scripts/verify-equipment-level-points.mjs`
Expected: FAIL — `TypeError: DCU.getEquipmentLevel is not a function`

- [ ] **Step 3: 在 options.js 新增選項常數**

在 `src/data/options.js` 的 `const EQUIP_STATUS_OPTIONS = ['運轉', '轉汰換', '已汰換'];` 這一行**之後**插入：

```js
// 設備等級：影響 A/B 服務等級叫修單是否計入績效積分
const EQUIPMENT_LEVEL_OPTIONS = ['基礎設備', '增額設備'];
```

- [ ] **Step 4: 在 device-category-utils.js 新增 ATTR_KEYS 與正規化**

把第 7 行的 `FIELD_KEYS` 宣告改成兩行：

```js
  var FIELD_KEYS = ['category', 'brand', 'deviceName', 'specification', 'model', 'refrigerant', 'powerSource'];
  // 屬性欄位：參與正規化與儲存，但不參與重複性判定
  var ATTR_KEYS = ['equipmentLevel'];
```

把 `normalizeRecord` 改成同時處理兩組鍵：

```js
  function normalizeRecord(record) {
    var out = {};
    FIELD_KEYS.concat(ATTR_KEYS).forEach(function (key) {
      out[key] = String((record && record[key]) || '').trim();
    });
    return out;
  }
```

`recordKey` **完全不動** —— 它仍然只 map `FIELD_KEYS`，所以改設備等級不會被判定成重複紀錄。

- [ ] **Step 5: 新增等級查詢函式**

在 `findRecordByModel` 函式定義**之後**（`findBestMatchingRecord` 之前）插入：

```js
  function getEquipmentLevel(record) {
    var level = String((record && record.equipmentLevel) || '').trim();
    return level || EQUIPMENT_LEVEL_OPTIONS[0];
  }

  function getEquipmentLevelByModel(deviceCategories, model) {
    return getEquipmentLevel(findRecordByModel(deviceCategories, model));
  }
```

註：`EQUIPMENT_LEVEL_OPTIONS[0]` 就是 `'基礎設備'`。`options.js` 在 `index.html` 中先於本檔載入，函式又是呼叫時才求值，所以全域可見。

- [ ] **Step 6: 加入 export**

在 `window.DeviceCategoryUtils = {` 物件中，`FIELD_KEYS: FIELD_KEYS,` 之後加 `ATTR_KEYS: ATTR_KEYS,`；在 `findRecordByModel: findRecordByModel,` 之後加：

```js
    getEquipmentLevel: getEquipmentLevel,
    getEquipmentLevelByModel: getEquipmentLevelByModel,
```

同時確認 `findDuplicate` 已在 export 清單中（它已存在，驗證腳本會用到）。

- [ ] **Step 7: 補齊 seed 資料**

在 `src/data/seed.js` 的 `INITIAL_DEVICE_CATEGORIES` 中，**每一筆**（DCAT1 到 DCAT6，共 6 筆）的 `powerSource` 那行之後、`createdDate` 那行之前插入一行：

```js
  equipmentLevel: '基礎設備',
```

例如 DCAT1 改完後長這樣：

```js
const INITIAL_DEVICE_CATEGORIES = [{
  id: 'DCAT1',
  category: '分離式',
  brand: '日立',
  deviceName: '分離式冷氣',
  specification: '3.5匹',
  model: 'RAS-100',
  refrigerant: 'R410A',
  powerSource: '220V',
  equipmentLevel: '基礎設備',
  createdDate: todayDate
}, {
```

- [ ] **Step 8: 執行腳本確認通過**

Run: `node scripts/verify-equipment-level-points.mjs`
Expected: PASS — `17 passed, 0 failed`

- [ ] **Step 9: 確認 seed 補齊**

Run: `grep -c "equipmentLevel: '基礎設備'" src/data/seed.js`
Expected: `6`

- [ ] **Step 10: Commit**

```bash
git add src/data/options.js src/data/seed.js \
  src/features/permissions/device-category-utils.js \
  scripts/verify-equipment-level-points.mjs
git commit -m "Add equipment level field to device category data model."
```

---

### Task 2: 設備分類管理 UI

表單目前把 `FIELDS` 一律當 text input 渲染，需要先加 select 支援才能塞下拉。

**Files:**
- Modify: `src/features/permissions/device-category-form.js:9-17`（`FIELDS`）、`:27-30`（初值）、`:82-96`（渲染迴圈）
- Modify: `src/features/permissions/device-category-list.js:10-18`（`COLUMNS`）、`:137-139`（儲存格）

**Interfaces:**
- Consumes: `EQUIPMENT_LEVEL_OPTIONS`、`DeviceCategoryUtils.getEquipmentLevel`（Task 1）
- Produces: 無新的程式介面；設備分類記錄存檔後必定帶有非空 `equipmentLevel`

- [ ] **Step 1: 在表單 FIELDS 加入設備等級**

`src/features/permissions/device-category-form.js` 的 `FIELDS` 改成（在 `model` 之後插入一筆，其餘不動）：

```js
  var FIELDS = [
    { name: 'category', label: '設備分類', required: true },
    { name: 'brand', label: '品牌', required: true },
    { name: 'deviceName', label: '設備名稱', required: true },
    { name: 'specification', label: '設備規格', required: true },
    { name: 'model', label: '型號', required: true },
    { name: 'equipmentLevel', label: '設備等級', required: true, type: 'select', options: EQUIPMENT_LEVEL_OPTIONS },
    { name: 'refrigerant', label: '冷媒', required: false },
    { name: 'powerSource', label: '電源', required: false }
  ];
```

註：`FIELDS` 是模組載入時求值的模組層常數，而 `EQUIPMENT_LEVEL_OPTIONS` 在 `index.html` 中由 `src/data/options.js` 先載入（第 33 行的 device-category-utils 之前就已載入 data 層），所以此處直接引用安全。

- [ ] **Step 2: 修正表單初值**

把第 27-30 行的初值設定改成——新增模式下設備等級預設第一個選項，編輯模式下用 `getEquipmentLevel` 正規化舊資料：

```js
    var formData = {};
    FIELDS.forEach(function (field) {
      formData[field.name] = (targetCase && targetCase[field.name]) || '';
    });
    formData.equipmentLevel = DeviceCategoryUtils.getEquipmentLevel(targetCase);
```

這樣新增時是 `'基礎設備'`、編輯舊資料時也會被補成 `'基礎設備'`，不會出現空值卡在必填檢查。

- [ ] **Step 3: 讓渲染迴圈支援 select**

把第 82-96 行的 `FIELDS.map(...)` 整段換成：

```js
            FIELDS.map(function (field) {
              var labelNode = h('label', { className: 'block text-sm mb-1' },
                field.label,
                field.required && ' ',
                field.required && h('span', { className: 'text-red-500' }, '*'));
              if (field.type === 'select') {
                return h('div', { key: field.name },
                  labelNode,
                  h('select', {
                    name: field.name,
                    value: formData[field.name],
                    onChange: handleChange,
                    className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white'
                  },
                    field.options.map(function (opt) {
                      return h('option', { key: opt, value: opt }, opt);
                    })
                  )
                );
              }
              return h('div', { key: field.name },
                labelNode,
                h('input', {
                  type: 'text',
                  name: field.name,
                  value: formData[field.name],
                  onChange: handleChange,
                  className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
                })
              );
            })
```

`handleSubmit`、`normalizeRecord`、必填檢查、重複檢查全部不動 —— Task 1 已讓 `normalizeRecord` 保留 `equipmentLevel`，既有的 `FIELDS.find(field => field.required && !normalized[field.name])` 自動涵蓋新欄位。

- [ ] **Step 4: 在列表 COLUMNS 加欄**

`src/features/permissions/device-category-list.js` 的 `COLUMNS` 改成（`model` 之後插入）：

```js
  var COLUMNS = [
    { key: 'category', label: '設備分類' },
    { key: 'brand', label: '品牌' },
    { key: 'deviceName', label: '設備名稱' },
    { key: 'specification', label: '設備規格' },
    { key: 'model', label: '型號' },
    { key: 'equipmentLevel', label: '設備等級' },
    { key: 'refrigerant', label: '冷媒' },
    { key: 'powerSource', label: '電源' }
  ];
```

關鍵字搜尋掃的就是 `COLUMNS`，所以設備等級自動變成可搜尋欄位。

- [ ] **Step 5: 列表儲存格對空值顯示基礎設備**

把第 137-139 行的儲存格 map 改成：

```js
                      COLUMNS.map(function (col) {
                        var text = col.key === 'equipmentLevel'
                          ? DeviceCategoryUtils.getEquipmentLevel(dc)
                          : (dc[col.key] || '—');
                        return h('td', { key: col.key, className: 'p-3 font-medium text-gray-800' }, text);
                      })
```

- [ ] **Step 6: 語法檢查**

Run: `node --check src/features/permissions/device-category-form.js && node --check src/features/permissions/device-category-list.js`
Expected: 無輸出（通過）

- [ ] **Step 7: 瀏覽器手動驗證**

開啟 `index.html`，進入「系統權限設定 → 設備分類管理」，確認：

1. 列表有「設備等級」欄，位於「型號」與「冷媒」之間，6 筆種子資料都顯示`基礎設備`。
2. 點「新增設備分類」，表單有「設備等級」下拉（帶紅色 `*`），預設選`基礎設備`，可切換到`增額設備`。
3. 填完七欄後存檔成功，回到列表看到新紀錄顯示所選等級。
4. 編輯任一筆，把等級改成`增額設備`存檔——**不應**跳出「此七項欄位組合已存在」錯誤，列表要更新成`增額設備`。
5. 關鍵字搜尋輸入`增額`按搜尋，只列出增額設備的紀錄。

- [ ] **Step 8: Commit**

```bash
git add src/features/permissions/device-category-form.js \
  src/features/permissions/device-category-list.js
git commit -m "Show equipment level in device category form and list."
```

---

### Task 3: 客戶建檔-設備管理 UI

設備等級在這裡是唯讀衍生值，選完型號即時反查顯示。存檔 payload 不含此欄位。

**Files:**
- Modify: `src/features/customer/equipment-form.js:171-175`（型號 select 之後）
- Modify: `src/features/customer/equipment-list.js:15-31`（props）、`:70-80`（badge 函式旁）、`:232-233`（表頭）、`:244`（colspan）、`:264-265`（儲存格）
- Modify: `src/app.js:496-504`（`EquipmentList` props）

**Interfaces:**
- Consumes: `DeviceCategoryUtils.getEquipmentLevelByModel(deviceCategories, model)`（Task 1）
- Produces: 無新的程式介面。設備記錄（equipments）**維持不含** `equipmentLevel`

- [ ] **Step 1: 表單加唯讀設備等級欄**

`src/features/customer/equipment-form.js`，在型號的 `renderEquipSelect(...)` 呼叫之後、`field('設備區域', 'area', ...)` 之前插入：

```js
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '設備等級'),
                h('input', {
                  type: 'text',
                  value: formData.model
                    ? DeviceCategoryUtils.getEquipmentLevelByModel(deviceCategories, formData.model)
                    : '',
                  placeholder: '請先選擇型號',
                  disabled: true,
                  className: disabledCls
                })
              ),
```

`handleSubmit` 的 `payload` **不要**加 `equipmentLevel`。因為 `handleChange` 在改 `model` 以上的欄位時會經 `applyEquipFieldChange` 清空 `model`，此欄位會自動跟著清空，無需額外處理。

- [ ] **Step 2: 列表接收 deviceCategories prop**

`src/features/customer/equipment-list.js`，在 `var equipments = props.equipments;` 之後（`var setEquipments` 之前或之後皆可，放在 props 解構區塊內）插入：

```js
    var deviceCategories = props.deviceCategories || [];
```

- [ ] **Step 3: 新增等級 badge 函式**

在 `equipmentStatusBadge` 函式定義之後插入：

```js
    function equipmentLevelBadge(model) {
      var level = DeviceCategoryUtils.getEquipmentLevelByModel(deviceCategories, model);
      var cls = level === '增額設備'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-gray-100 text-gray-600';
      return h('span', {
        className: 'px-2 py-0.5 rounded-full text-xs font-medium ' + cls
      }, level);
    }
```

- [ ] **Step 4: 表頭加欄**

在 `h('th', { className: 'p-3 font-semibold' }, '型號'),` 這一行**之後**插入：

```js
                  h('th', { className: 'p-3 font-semibold' }, '設備等級'),
```

- [ ] **Step 5: 儲存格加欄**

在 `h('td', { className: 'p-3' }, eq.model || '—'),` 這一行**之後**插入：

```js
                        h('td', { className: 'p-3' }, equipmentLevelBadge(eq.model)),
```

- [ ] **Step 6: 修正無資料列的 colspan**

把 `colspan: 12,` 改成 `colspan: 13,`（欄數從 12 變 13）。

- [ ] **Step 7: 在 app.js 傳入 deviceCategories**

`src/app.js` 的 `case 'equipment-list':` 分支，把 `h(EquipmentList, {...})` 的 props 補一行（放在 `customers: s.customers, stores: s.stores,` 之後）：

```js
          deviceCategories: s.deviceCategories,
```

改完整段長這樣：

```js
        return h(EquipmentList, {
          equipments: s.equipments, setEquipments: setEquipments,
          customers: s.customers, stores: s.stores,
          deviceCategories: s.deviceCategories,
          repairCases: s.cases, projectCases: s.projectCases, setProjectCases: setProjectCases,
          equipmentCustomer: s.equipmentCustomer, setEquipmentCustomer: setEquipmentCustomer,
          equipmentStore: s.equipmentStore, setEquipmentStore: setEquipmentStore,
          openStoreEdit: openStoreEdit, openStoreHistory: openStoreHistory,
          setEditingCase: setEditingCase, setView: setView, showToast: showToast
        });
```

`equipment-add` / `equipment-edit` 兩個分支已經有傳 `deviceCategories`，不用動。

- [ ] **Step 8: 語法檢查**

Run: `node --check src/features/customer/equipment-form.js && node --check src/features/customer/equipment-list.js && node --check src/app.js`
Expected: 無輸出（通過）

- [ ] **Step 9: 確認欄數一致**

表頭 `th` 數量必須等於 13（含「操作」欄）。

Run: `grep -c "p-3 font-semibold" src/features/customer/equipment-list.js`
Expected: `13`

- [ ] **Step 10: 瀏覽器手動驗證**

先在「設備分類管理」把型號 `FXYP100`（大金／吊隱式冷氣／4.0匹）改成`增額設備`並存檔。接著進入「客戶建檔 → 設備管理」：

1. 選一組客戶／門市，列表出現「設備等級」欄在「型號」之後，badge 顯示對應等級；`FXYP100` 的設備顯示琥珀色`增額設備`，其餘顯示灰色`基礎設備`。
2. 無資料時的「無資料」列橫跨整個表格寬度（colspan 正確）。
3. 點「新增設備」，設備等級欄是灰底唯讀，未選型號時顯示 placeholder`請先選擇型號`。
4. 逐層選到型號 `FXYP100`，設備等級即時變成`增額設備`；改選其他型號會跟著變；把「設備分類」改掉導致型號被清空時，等級欄回到空白。
5. 存檔後回列表，該筆顯示`增額設備`。
6. 編輯剛存的設備，設備等級正確帶入。

- [ ] **Step 11: Commit**

```bash
git add src/features/customer/equipment-form.js \
  src/features/customer/equipment-list.js src/app.js
git commit -m "Show equipment level in customer equipment form and list."
```

---

### Task 4: 積分資格放寬

**Files:**
- Modify: `src/features/reports/performance-utils.js:50-53`（`isServiceLevelCD` 之後）、`:100-123`（`computeAssigneePerformance`）、`:218-231`（export）
- Modify: `src/features/reports/case-performance-stats.js:114-132`
- Modify: `src/app.js:560-567`（`CasePerformanceStats` props）
- Test: `scripts/verify-equipment-level-points.mjs`（Task 5 補測試）

**Interfaces:**
- Consumes: `DeviceCategoryUtils.getEquipmentLevelByModel`（Task 1）、既有 `CaseAssigneeUtils.computeBonusPointsForAssignee`
- Produces:
  - `PerformanceUtils.getCaseEquipmentLevel(c, deviceCategories): string`
  - `PerformanceUtils.isAddOnEquipmentCase(c, deviceCategories): boolean`
  - `PerformanceUtils.isBonusEligible(c, deviceCategories): boolean`
  - `PerformanceUtils.computeAssigneePerformance(input)` 新增讀取 `input.deviceCategories`（陣列，可省略）

- [ ] **Step 1: 新增三個判定函式**

`src/features/reports/performance-utils.js`，在 `isServiceLevelCD` 函式定義**之後**插入：

```js
  function getCaseEquipmentLevel(c, deviceCategories) {
    var model = (c && c.equipment && c.equipment.model) || '';
    return DeviceCategoryUtils.getEquipmentLevelByModel(deviceCategories || [], model);
  }

  function isAddOnEquipmentCase(c, deviceCategories) {
    return getCaseEquipmentLevel(c, deviceCategories) === '增額設備';
  }

  // C/D 服務等級一律計分；A/B 僅在設備為增額設備時計分
  function isBonusEligible(c, deviceCategories) {
    return isServiceLevelCD(c && c.serviceLevel) || isAddOnEquipmentCase(c, deviceCategories);
  }
```

`isServiceLevelCD` 本身不要動（已對外 export）。

- [ ] **Step 2: 放寬 computeAssigneePerformance 的閘門**

在 `computeAssigneePerformance` 開頭的變數宣告區，`var allocations = input.allocations || [];` 之後插入：

```js
    var deviceCategories = input.deviceCategories || [];
```

然後把 `cases.forEach` 迴圈裡的

```js
        if (!isServiceLevelCD(c.serviceLevel)) return;
```

改成

```js
        if (!isBonusEligible(c, deviceCategories)) return;
```

`isPerformanceIncluded` 與日期範圍兩個既有條件維持原位不動，且仍在此判定**之前**。

- [ ] **Step 3: 加入 export**

在 `window.PerformanceUtils = {` 物件中，`isServiceLevelCD: isServiceLevelCD,` 之後插入：

```js
    getCaseEquipmentLevel: getCaseEquipmentLevel,
    isAddOnEquipmentCase: isAddOnEquipmentCase,
    isBonusEligible: isBonusEligible,
```

- [ ] **Step 4: case-performance-stats.js 轉傳**

`src/features/reports/case-performance-stats.js`，在 `var performanceAreas = props.performanceAreas || [];` 之後插入：

```js
    var deviceCategories = props.deviceCategories || [];
```

並在 `computeAssigneePerformance({...})` 的參數物件中，`allocations: allocations,` 之後插入：

```js
      deviceCategories: deviceCategories,
```

`computeRegionPerformance` 的呼叫不要動（區域統計只算保養案件件數，不含積分）。

- [ ] **Step 5: app.js 傳入 deviceCategories**

`src/app.js` 的 `case 'case-performance':` 分支，在 `performanceAreas: s.performanceAreas` 之後補一項（記得前一行要加逗號）：

```js
        return h(CasePerformanceStats, {
          cases: s.cases,
          maintenanceCases: s.maintenanceCases,
          assignees: s.assignees,
          maintenanceAllocations: s.maintenanceAllocations,
          stores: s.stores,
          performanceAreas: s.performanceAreas,
          deviceCategories: s.deviceCategories
        });
```

- [ ] **Step 6: 語法檢查**

Run: `node --check src/features/reports/performance-utils.js && node --check src/features/reports/case-performance-stats.js && node --check src/app.js`
Expected: 無輸出（通過）

- [ ] **Step 7: 確認載入順序**

`performance-utils.js` 呼叫 `DeviceCategoryUtils`。因為是函式內呼叫（執行期求值），只要兩個檔案都在 `index.html` 中載入即可，順序不影響。

Run: `grep -n "device-category-utils.js\|performance-utils.js" index.html`
Expected: 兩行都有（分別在第 33 行與第 95 行附近）

- [ ] **Step 8: Commit**

```bash
git add src/features/reports/performance-utils.js \
  src/features/reports/case-performance-stats.js src/app.js
git commit -m "Count add-on equipment cases toward bonus points for A/B service levels."
```

---

### Task 5: 積分驗證測試

Task 4 的邏輯目前只有語法檢查護著。這個 Task 把 `computeAssigneePerformance` 的實際行為釘死。

**Files:**
- Modify: `scripts/verify-equipment-level-points.mjs`（Task 1 建立）

**Interfaces:**
- Consumes: Task 1 的 `DeviceCategoryUtils.*`、Task 4 的 `PerformanceUtils.isBonusEligible` 與 `computeAssigneePerformance`

- [ ] **Step 1: 擴充驗證腳本**

把 `scripts/verify-equipment-level-points.mjs` 結尾的

```js
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

**之前**插入以下內容（`load(...)` 呼叫要放在檔案上半部既有 `load('src/features/permissions/device-category-utils.js');` 之後，見 Step 2）：

```js
console.log('\nisBonusEligible');

function caseWith(serviceLevel, model) {
  return {
    id: 'C-' + serviceLevel + '-' + model,
    serviceLevel: serviceLevel,
    isPerformanceIncluded: true,
    completionDate: '2026-08-05',
    performanceAssignees: ['王小明'],
    collaborators: [],
    equipment: model === null ? null : { model: model },
    processRecords: [{ processMethodId: 'PS1', points: 10, qty: 1 }]
  };
}

const PU = sandbox.window.PerformanceUtils;

assertEq(PU.isBonusEligible(caseWith('A 保修(一年一次)', 'RAS-100'), cats), false,
  'A + 基礎設備 不計分');
assertEq(PU.isBonusEligible(caseWith('A 保修(一年一次)', 'FXYP100'), cats), true,
  'A + 增額設備 計分');
assertEq(PU.isBonusEligible(caseWith('B 保修(一年兩次)', 'FXYP100'), cats), true,
  'B + 增額設備 計分');
assertEq(PU.isBonusEligible(caseWith('B 保修(一年兩次)', 'RAS-100'), cats), false,
  'B + 基礎設備 不計分');
assertEq(PU.isBonusEligible(caseWith('C 保養(一年一次)', 'RAS-100'), cats), true,
  'C + 基礎設備 仍計分（回歸）');
assertEq(PU.isBonusEligible(caseWith('D 維修(無簽約客戶)', 'RAS-100'), cats), true,
  'D + 基礎設備 仍計分（回歸）');
assertEq(PU.isBonusEligible(caseWith('A 保修(一年一次)', '查無此型號'), cats), false,
  'A + 型號查無分類 不計分');
assertEq(PU.isBonusEligible(caseWith('A 保修(一年一次)', null), cats), false,
  'A + 案件無設備 不計分');
assertEq(PU.isBonusEligible(caseWith('A 保修(一年一次)', 'PA-063'), cats), false,
  'A + 分類無 equipmentLevel 欄位 不計分');
assertEq(PU.isBonusEligible(caseWith('', 'FXYP100'), cats), true,
  '服務等級為空 + 增額設備 計分');

console.log('\ncomputeAssigneePerformance');

const quarter = { start: '2026-07-01', end: '2026-09-30', label: '2026 年第 3 季' };
const assignees = [{ id: 'ASG1', name: '王小明' }];

function bonusOf(cases) {
  return PU.computeAssigneePerformance({
    cases: cases,
    maintenanceCases: [],
    assignees: assignees,
    allocations: [],
    deviceCategories: cats,
    quarter: quarter
  })[0].bonusPoints;
}

assertEq(bonusOf([caseWith('A 保修(一年一次)', 'RAS-100')]), 0,
  'A + 基礎設備 積分為 0');
assertEq(bonusOf([caseWith('A 保修(一年一次)', 'FXYP100')]), 10,
  'A + 增額設備 取得全額 10 分');
assertEq(bonusOf([caseWith('C 保養(一年一次)', 'RAS-100')]), 10,
  'C + 基礎設備 取得全額 10 分（回歸）');

const excluded = caseWith('A 保修(一年一次)', 'FXYP100');
excluded.isPerformanceIncluded = false;
assertEq(bonusOf([excluded]), 0,
  'isPerformanceIncluded 為 false 時不計分');

const outOfRange = caseWith('A 保修(一年一次)', 'FXYP100');
outOfRange.completionDate = '2026-06-30';
assertEq(bonusOf([outOfRange]), 0,
  '季度範圍外不計分');

// A/增額 的分攤公式必須與同條件 C/D 完全相同
function multiAssigneeCase(serviceLevel, model) {
  const c = caseWith(serviceLevel, model);
  c.performanceAssignees = ['王小明', '李大華'];
  c.collaborators = [{ name: '陳美玲', count: 1, points: 4 }];
  // 總分 10、協作 4 → (10 - 4) / 2 = 3 分給王小明
  return c;
}

function bonusForMulti(serviceLevel, model) {
  return PU.computeAssigneePerformance({
    cases: [multiAssigneeCase(serviceLevel, model)],
    maintenanceCases: [],
    assignees: assignees,
    allocations: [],
    deviceCategories: cats,
    quarter: quarter
  })[0].bonusPoints;
}

assertEq(bonusForMulti('A 保修(一年一次)', 'FXYP100'), 3,
  'A + 增額 多人指派含協作，分攤得 3 分');
assertEq(
  bonusForMulti('A 保修(一年一次)', 'FXYP100'),
  bonusForMulti('C 保養(一年一次)', 'RAS-100'),
  'A/增額 與 C/基礎 的分攤結果一致'
);

assertEq(bonusOf([caseWith('A 保修(一年一次)', 'FXYP100')]), 10,
  'deviceCategories 有傳時正常運作');
assertEq(
  PU.computeAssigneePerformance({
    cases: [caseWith('A 保修(一年一次)', 'FXYP100')],
    maintenanceCases: [],
    assignees: assignees,
    allocations: [],
    quarter: quarter
  })[0].bonusPoints,
  0,
  '未傳 deviceCategories 時退回原本的 C/D 行為'
);
```

- [ ] **Step 2: 補上模組載入與 stub**

把檔案上半部的

```js
load('src/features/permissions/device-category-utils.js');

const DCU = sandbox.window.DeviceCategoryUtils;
```

改成（`performance-utils.js` 的 `computeRegionPerformance` 會參照 `StoreUtils`、`getMaintenanceCaseDate` 路徑會參照 `AssigneeUtils`，雖然本測試不觸及，模組載入期不需要它們，但保險起見補上最小 stub）：

```js
sandbox.StoreUtils = {
  matchesStoreRecord: function () { return false; },
  getStoreArea: function () { return ''; },
  getRecordArea: function () { return ''; }
};
sandbox.AssigneeUtils = {
  getPerformanceAssignee: function () { return ''; }
};

load('src/features/permissions/device-category-utils.js');
load('src/features/repair/case-assignee-utils.js');
load('src/features/reports/performance-utils.js');

const DCU = sandbox.window.DeviceCategoryUtils;
```

- [ ] **Step 3: 執行驗證**

Run: `node scripts/verify-equipment-level-points.mjs`
Expected: PASS — `36 passed, 0 failed`（17 + 19）

若某項失敗，先確認 Task 4 的閘門確實改成 `isBonusEligible(c, deviceCategories)`，以及 `computeAssigneePerformance` 有讀 `input.deviceCategories`。

- [ ] **Step 4: 執行既有驗證腳本確認無回歸**

Run: `node scripts/verify-case-record-points.mjs && node scripts/verify-repair-multi-assignee.mjs`
Expected: 兩支都 `0 failed`

- [ ] **Step 5: 瀏覽器端對端驗證**

開啟 `index.html`：

1. 在「設備分類管理」把某個型號設為`增額設備`。
2. 在「客戶建檔 → 設備管理」確認該型號的設備顯示`增額設備`。
3. 找一張（或新建一張）服務等級為 `A 保修(一年一次)` 的叫修單，設備選到該增額型號，填入有積分的處理方式並結案、指派人員、勾選納入績效、完成日期落在本季。
4. 進「報表 → 案件績效統計」，確認該指派人員的積分卡有把這張單的分數加進去。
5. 回設備分類管理把該型號改回`基礎設備`，重新看績效統計——積分應該降回去（驗證即時反查而非快照）。

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-equipment-level-points.mjs
git commit -m "Verify bonus point eligibility for add-on equipment cases."
```

---

## Self-Review

**Spec 覆蓋檢查：**

| Spec 章節 | 對應 Task |
|---|---|
| 資料模型（`EQUIPMENT_LEVEL_OPTIONS`、seed 補值、設備記錄不加欄位） | Task 1 Step 3, 7 |
| device-category-utils（`ATTR_KEYS`、`normalizeRecord`、`recordKey` 不變、兩個查詢函式） | Task 1 Step 4-6 |
| 設備分類管理 — 表單 | Task 2 Step 1-3 |
| 設備分類管理 — 列表 | Task 2 Step 4-5 |
| 客戶設備 — 表單唯讀帶入 | Task 3 Step 1 |
| 客戶設備 — 列表 badge、colspan、app.js prop | Task 3 Step 2-7 |
| 積分規則（三個函式、閘門、公式不動） | Task 4 Step 1-3 |
| 積分資料串接（三層 props） | Task 4 Step 4-5 |
| 驗證腳本全部測試案例 | Task 1 Step 1、Task 5 Step 1 |
| 不在範圍內的項目 | 無 Task 觸及（正確） |

**Placeholder 掃描：** 無 TBD／TODO；所有程式步驟都附完整程式碼；所有測試步驟都附實際斷言。

**型別一致性：** `getEquipmentLevel` / `getEquipmentLevelByModel` / `getCaseEquipmentLevel` / `isAddOnEquipmentCase` / `isBonusEligible` 在 Task 1、4、5 中命名與參數順序一致；`ATTR_KEYS` 在 Task 1 定義後未被他處改名；`deviceCategories` 這個 prop／參數名在 app.js、equipment-list、case-performance-stats、performance-utils 中一致。
