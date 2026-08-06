# 現勘表線型多尺寸＋其他保留勾選 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓線型出風口可多筆「寬×高×數量」，並讓全部「多選＋數量」的「其他」改回 checkbox（勾選後展開多列／＋新增）；舊資料遷移、PDF 正確。

**Architecture:** 修正 `SurveyCheckQtyOthersUtils` 遷移（寫回勾選、不清掉 `'其他'`）；新增 `SurveyVentLinearSizesUtils` 管理 `ventLinearSizes`；表單勾選時若明細為空則補一列空白，取消勾選只隱藏不刪資料；PDF `fmtVentOutlets` 改讀尺寸陣列。

**Tech Stack:** Vanilla JS IIFE、`IESS.h`／`stateful`、Tailwind CDN、既有 `Icons.Plus`／`Icons.Trash2`。

**驗證方式:** 本專案無自動測試；utils 以 Console assert、表單／PDF 以瀏覽器手動驗收。不自動 commit（除非使用者要求）。

**Spec:** `docs/superpowers/specs/2026-08-06-survey-linear-vent-and-other-checkbox-design.md`

## Global Constraints

- 線型：勾選保留在 `ventOutlets`；明細為 `ventLinearSizes: [{ id, width, height, qty }]`；不再寫 `ventLinearWidth`／`ventLinearHeight`／`ventOutletsQty['線型出風口']`
- 其他（14 組）：checkbox 陣列含 `'其他'`；明細為 `{checkName}Others: [{ id, label, qty }]`；不寫 `{checkName}_other`／`qtyMap['其他']`
- 勾選且明細為空 → 自動一列空白；可「＋」加列；可刪到 0 列仍保持勾選
- 取消勾選 → 保留明細陣列，UI 隱藏；再勾選還在（空則再補一列）
- 不改單選／純文字其他、集風箱管徑、回風口
- 名稱／寬高／數量可不填仍可暫存

---

## File map

| 檔案 | 職責 |
|------|------|
| `src/features/project/survey-check-qty-others-utils.js` | 遷移寫回 `'其他'`；`ensureBlankIfChecked`；legacy 只清 `_other`／qty |
| `src/features/project/survey-vent-linear-sizes-utils.js` | `ventLinearSizes` migrate／CRUD／PDF 單筆格式化 |
| `index.html` | 載入 linear utils（在 others utils 之後、survey-pdf／form 之前） |
| `src/features/project/survey-form.js` | 其他 checkbox UI；線型多列 UI；勾選時 ensure blank |
| `src/features/project/survey-pdf.js` | `fmtVentOutlets` 改用 `ventLinearSizes` |

---

### Task 1: 修正 SurveyCheckQtyOthersUtils（勾選語意）

**Files:**
- Modify: `src/features/project/survey-check-qty-others-utils.js`

**Interfaces:**
- Produces（既有 API 行為變更＋新增）:
  - `migrateSurveyData(sd)`：遷移後若 others 非空或剛從 legacy 建立 → checkbox 含 `'其他'`；**不再**從 checkbox 移除 `'其他'`
  - `ensureBlankIfChecked(sd, checkName)`：若 checkbox 含 `'其他'` 且 others 為空 → `addOther`
  - `clearLegacyOtherFields`（內部）：只刪 `_other` 與 `qtyMap['其他']`，不动 checkbox

- [ ] **Step 1: 改寫 legacy 清除與 migrateOne**

將 `clearLegacyOther` 改名／改為只清欄位（勿 filter 掉 `'其他'`）：

```js
function clearLegacyOtherFields(sd, checkName, qtyMapName) {
  delete sd[checkName + '_other'];
  if (sd[qtyMapName] && Object.prototype.hasOwnProperty.call(sd[qtyMapName], '其他')) {
    var m = Object.assign({}, sd[qtyMapName]);
    delete m['其他'];
    sd[qtyMapName] = m;
  }
}

function ensureOtherChecked(sd, checkName) {
  var selected = Array.isArray(sd[checkName]) ? sd[checkName].slice() : [];
  if (selected.indexOf('其他') === -1) {
    selected.push('其他');
    sd[checkName] = selected;
  }
}

function migrateOne(sd, checkName, qtyMapName) {
  var key = othersKey(checkName);
  var existing = sd[key];
  var hasOthersArray = Array.isArray(existing);
  var createdFromLegacy = false;

  if (!hasOthersArray && hasLegacyOther(sd, checkName, qtyMapName)) {
    var qtyMap = sd[qtyMapName] || {};
    sd[key] = [{
      id: newId(),
      label: sd[checkName + '_other'] != null ? String(sd[checkName + '_other']) : '',
      qty: qtyMap['其他'] != null ? String(qtyMap['其他']) : ''
    }];
    createdFromLegacy = true;
    hasOthersArray = true;
  }

  if (hasLegacyOther(sd, checkName, qtyMapName) || hasOthersArray) {
    clearLegacyOtherFields(sd, checkName, qtyMapName);
  }

  var others = getOthers(sd, checkName);
  if (createdFromLegacy || others.length > 0) {
    ensureOtherChecked(sd, checkName);
  }
}
```

- [ ] **Step 2: 新增 ensureBlankIfChecked，並在 migrateSurveyData 結尾呼叫**

```js
function ensureBlankIfChecked(sd, checkName) {
  if (!sd || typeof sd !== 'object') return;
  var selected = sd[checkName];
  if (!Array.isArray(selected) || selected.indexOf('其他') === -1) return;
  if (getOthers(sd, checkName).length === 0) {
    addOther(sd, checkName);
  }
}

function migrateSurveyData(sd) {
  if (!sd || typeof sd !== 'object') return sd || {};
  GROUPS.forEach(function (g) {
    migrateOne(sd, g.checkName, g.qtyMapName);
    ensureBlankIfChecked(sd, g.checkName);
  });
  return sd;
}
```

匯出：

```js
window.SurveyCheckQtyOthersUtils = {
  GROUPS: GROUPS,
  othersKey: othersKey,
  newId: newId,
  migrateSurveyData: migrateSurveyData,
  getOthers: getOthers,
  addOther: addOther,
  updateOther: updateOther,
  removeOther: removeOther,
  ensureBlankIfChecked: ensureBlankIfChecked,
  formatOtherItem: formatOtherItem,
  formatOthersList: formatOthersList
};
```

- [ ] **Step 3: Console 驗收遷移**

在瀏覽器 Console（先載入頁面）：

```js
var U = SurveyCheckQtyOthersUtils;
// A: legacy → others + 勾選
var a = { copperSizes: ['其他'], copperSizes_other: '排水旁通', copperSizesQty: { '其他': '12' } };
U.migrateSurveyData(a);
console.assert(a.copperSizes.indexOf('其他') !== -1, 'checked');
console.assert(a.copperSizesOthers.length === 1 && a.copperSizesOthers[0].label === '排水旁通', 'row');
console.assert(a.copperSizes_other === undefined, 'no _other');
console.assert(!a.copperSizesQty['其他'], 'no qty其他');

// B: 已有 others、無勾選 → 補勾選
var b = { copperSizes: ['1/4"'], copperSizesOthers: [{ id: 'o1', label: 'X', qty: '1' }] };
U.migrateSurveyData(b);
console.assert(b.copperSizes.indexOf('其他') !== -1, 'restore check');

// C: 已勾選、others 空 → 補一列空白
var c = { copperSizes: ['其他'] };
U.migrateSurveyData(c);
console.assert(c.copperSizesOthers.length === 1, 'blank row');
console.assert(c.copperSizesOthers[0].label === '' && c.copperSizesOthers[0].qty === '', 'empty fields');
```

Expected: 三組 assert 皆過。

---

### Task 2: SurveyVentLinearSizesUtils

**Files:**
- Create: `src/features/project/survey-vent-linear-sizes-utils.js`
- Modify: `index.html`（script 順序）

**Interfaces:**
- Produces: `window.SurveyVentLinearSizesUtils`
  - `SIZES_KEY` → `'ventLinearSizes'`
  - `LABEL` → `'線型出風口'`
  - `newId()` → 字串（前綴 `ls_`）
  - `getSizes(sd)` → 陣列
  - `addSize(sd)` → `{ id, width:'', height:'', qty:'' }`
  - `updateSize(sd, id, patch)` → 更新；保留 `id`
  - `removeSize(sd, id)`
  - `ensureBlankIfChecked(sd)` → 勾選且空則 add
  - `migrateSurveyData(sd)` → 遷移舊寬高／數量、清舊欄、ensure blank
  - `formatSizeItem(item)` → 單筆 PDF 字串（如 `線型出風口 3個（120×10 cm）`）
  - `formatSizesList(sizes)` → 多筆以「、」連接

- [ ] **Step 1: 建立 utils 檔**

```js
/*
 * features/project/survey-vent-linear-sizes-utils.js
 * 現勘表線型出風口多筆寬高數量：遷移／CRUD／PDF 格式化
 * 對外：window.SurveyVentLinearSizesUtils
 */
(function () {
  'use strict';

  var SIZES_KEY = 'ventLinearSizes';
  var LABEL = '線型出風口';
  var QTY_MAP = 'ventOutletsQty';

  var _idSeq = 0;
  function newId() {
    _idSeq += 1;
    return 'ls_' + Date.now().toString(36) + '_' + _idSeq;
  }

  function getSizes(sd) {
    return Array.isArray(sd && sd[SIZES_KEY]) ? sd[SIZES_KEY] : [];
  }

  function ensureLinearChecked(sd) {
    var selected = Array.isArray(sd.ventOutlets) ? sd.ventOutlets.slice() : [];
    if (selected.indexOf(LABEL) === -1) {
      selected.push(LABEL);
      sd.ventOutlets = selected;
    }
  }

  function isLinearChecked(sd) {
    return Array.isArray(sd.ventOutlets) && sd.ventOutlets.indexOf(LABEL) !== -1;
  }

  function hasLegacyLinear(sd) {
    var qtyMap = sd[QTY_MAP] || {};
    var hasQty = qtyMap[LABEL] != null && String(qtyMap[LABEL]) !== '';
    var hasW = sd.ventLinearWidth != null && String(sd.ventLinearWidth) !== '';
    var hasH = sd.ventLinearHeight != null && String(sd.ventLinearHeight) !== '';
    return hasQty || hasW || hasH;
  }

  function clearLegacyLinear(sd) {
    delete sd.ventLinearWidth;
    delete sd.ventLinearHeight;
    if (sd[QTY_MAP] && Object.prototype.hasOwnProperty.call(sd[QTY_MAP], LABEL)) {
      var m = Object.assign({}, sd[QTY_MAP]);
      delete m[LABEL];
      sd[QTY_MAP] = m;
    }
  }

  function addSize(sd) {
    var list = getSizes(sd).slice();
    var row = { id: newId(), width: '', height: '', qty: '' };
    list.push(row);
    sd[SIZES_KEY] = list;
    return row;
  }

  function updateSize(sd, id, patch) {
    sd[SIZES_KEY] = getSizes(sd).map(function (row) {
      if (row.id !== id) return row;
      return Object.assign({}, row, patch, { id: row.id });
    });
  }

  function removeSize(sd, id) {
    sd[SIZES_KEY] = getSizes(sd).filter(function (row) {
      return row.id !== id;
    });
  }

  function ensureBlankIfChecked(sd) {
    if (!sd || typeof sd !== 'object') return;
    if (!isLinearChecked(sd)) return;
    if (getSizes(sd).length === 0) addSize(sd);
  }

  function migrateSurveyData(sd) {
    if (!sd || typeof sd !== 'object') return sd || {};
    var hasArray = Array.isArray(sd[SIZES_KEY]);

    if (!hasArray && hasLegacyLinear(sd)) {
      var qtyMap = sd[QTY_MAP] || {};
      sd[SIZES_KEY] = [{
        id: newId(),
        width: sd.ventLinearWidth != null ? String(sd.ventLinearWidth) : '',
        height: sd.ventLinearHeight != null ? String(sd.ventLinearHeight) : '',
        qty: qtyMap[LABEL] != null ? String(qtyMap[LABEL]) : ''
      }];
      ensureLinearChecked(sd);
    }

    clearLegacyLinear(sd);
    ensureBlankIfChecked(sd);
    return sd;
  }

  function formatSizeItem(item) {
    if (!item) return LABEL;
    var w = item.width != null ? String(item.width).trim() : '';
    var h = item.height != null ? String(item.height).trim() : '';
    var qty = item.qty != null ? String(item.qty).trim() : '';
    var text = LABEL + (qty ? ' ' + qty + '個' : '');
    if (w || h) {
      text += '（' + w + '×' + h + ' cm）';
    }
    return text;
  }

  function formatSizesList(sizes) {
    if (!Array.isArray(sizes) || !sizes.length) return '';
    return sizes.map(formatSizeItem).join('、');
  }

  window.SurveyVentLinearSizesUtils = {
    SIZES_KEY: SIZES_KEY,
    LABEL: LABEL,
    newId: newId,
    getSizes: getSizes,
    addSize: addSize,
    updateSize: updateSize,
    removeSize: removeSize,
    ensureBlankIfChecked: ensureBlankIfChecked,
    migrateSurveyData: migrateSurveyData,
    formatSizeItem: formatSizeItem,
    formatSizesList: formatSizesList
  };
})();
```

- [ ] **Step 2: 在 `index.html` 掛 script**

在 `survey-check-qty-others-utils.js` 之後、`survey-pdf.js` 之前插入：

```html
<script src="src/features/project/survey-vent-linear-sizes-utils.js"></script>
```

- [ ] **Step 3: Console 驗收**

```js
var L = SurveyVentLinearSizesUtils;
var sd = {
  ventOutlets: ['線型出風口'],
  ventLinearWidth: '120',
  ventLinearHeight: '10',
  ventOutletsQty: { '線型出風口': '3' }
};
L.migrateSurveyData(sd);
console.assert(sd.ventLinearSizes.length === 1, 'one row');
console.assert(sd.ventLinearSizes[0].width === '120' && sd.ventLinearSizes[0].height === '10' && sd.ventLinearSizes[0].qty === '3', 'fields');
console.assert(sd.ventLinearWidth === undefined && sd.ventLinearHeight === undefined, 'legacy cleared');
console.assert(!sd.ventOutletsQty['線型出風口'], 'qty cleared');
console.assert(L.formatSizeItem(sd.ventLinearSizes[0]) === '線型出風口 3個（120×10 cm）', 'fmt');

var empty = { ventOutlets: ['線型出風口'] };
L.migrateSurveyData(empty);
console.assert(empty.ventLinearSizes.length === 1, 'blank on checked');
```

Expected: assert 皆過。

---

### Task 3: 表單 — 其他 checkbox UI＋勾選補列

**Files:**
- Modify: `src/features/project/survey-form.js`

**Interfaces:**
- Consumes: `SurveyCheckQtyOthersUtils.ensureBlankIfChecked`／`migrateSurveyData`（既有）
- Consumes: `SurveyVentLinearSizesUtils.migrateSurveyData`（載入時一併呼叫）
- Produces: `renderCheckQtyOthersBlock` 改為勾選展開；`handleSurveyChange` 勾選「其他」時 ensure blank

- [ ] **Step 1: 載入時一併 migrate 線型**

找到現有：

```js
SurveyCheckQtyOthersUtils.migrateSurveyData(formData.surveyData);
```

改為：

```js
SurveyCheckQtyOthersUtils.migrateSurveyData(formData.surveyData);
SurveyVentLinearSizesUtils.migrateSurveyData(formData.surveyData);
```

- [ ] **Step 2: handleSurveyChange 勾選後 ensure blank**

在 checkbox 分支更新陣列之後、`rerender()` 之前加入：

```js
if (type === 'checkbox') {
  var currentArr = sd[name] || [];
  sd[name] = checked ? currentArr.concat([value]) : currentArr.filter(function (item) { return item !== value; });
  if (checked && value === '其他') {
    SurveyCheckQtyOthersUtils.ensureBlankIfChecked(sd, name);
  }
  if (checked && name === 'ventOutlets' && value === '線型出風口') {
    SurveyVentLinearSizesUtils.ensureBlankIfChecked(sd);
  }
} else {
  sd[name] = value;
}
rerender();
```

（取消勾選不刪 others／sizes。）

- [ ] **Step 3: 重寫 `renderCheckQtyOthersBlock`**

完整取代現有函式：

```js
const renderCheckQtyOthersBlock = (checkName, unit, qtyLabel) => {
  const selected = formData.surveyData?.[checkName] || [];
  const checked = selected.includes('其他');
  const others = SurveyCheckQtyOthersUtils.getOthers(formData.surveyData, checkName);
  return h("div", {
    className: "space-y-2 mt-2"
  }, h("div", {
    className: "bg-white p-3 rounded border border-gray-200"
  }, h("label", {
    className: "flex items-center gap-2 cursor-pointer"
  }, h("input", {
    type: "checkbox",
    name: checkName,
    value: "其他",
    checked: checked,
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
  }), h("span", {
    className: "text-sm text-gray-700 font-medium"
  }, "其他")), checked && others.map(row => h("div", {
    key: row.id,
    className: "flex items-center justify-between mt-3 ml-6 gap-2"
  }, h("div", {
    className: "flex items-center gap-2 flex-1 min-w-0"
  }, h("span", {
    className: "text-sm text-gray-700 font-medium shrink-0"
  }, "其他："), h("input", {
    type: "text",
    value: row.label || '',
    onChange: e => updateCheckQtyOther(checkName, row.id, { label: e.target.value }),
    placeholder: "請註明",
    className: "flex-1 max-w-xs p-1 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent text-sm"
  })), h("div", {
    className: "flex items-center gap-2 shrink-0"
  }, h("input", {
    type: "number",
    value: row.qty || '',
    onChange: e => updateCheckQtyOther(checkName, row.id, { qty: e.target.value }),
    placeholder: qtyLabel,
    className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
  }), h("span", {
    className: "text-sm text-gray-500 whitespace-nowrap"
  }, unit), h("button", {
    type: "button",
    title: "刪除此其他項目",
    onClick: () => removeCheckQtyOther(checkName, row.id),
    className: "text-red-500 hover:text-red-700 p-1"
  }, Icons.Trash2({ className: "h-4 w-4" })))), checked && h("button", {
    type: "button",
    onClick: () => addCheckQtyOther(checkName),
    className: "flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 mt-3 ml-6"
  }, Icons.Plus({ className: "h-4 w-4" }), "新增其他"));
};
```

說明：`others.map` 在 `checked &&` 之後若 others 為空陣列會得到 `false`／空；用 `checked ? others.map(...) : null` 再與 button 並列較穩。若 hyperscript 對 `checked && array` 不穩，改成：

```js
}, checked ? others.map(row => h("div", { ... })) : null, checked ? h("button", { ... }, ...) : null);
```

外層結構改為 checkbox 容器包住明細（上列完整版已把 map／button 當 sibling）。實作時以「checkbox 一列；勾選後下方 indent 明細＋＋按鈕」為準，必要時微調 class，勿改固定選項列。

- [ ] **Step 4: 手動驗收其他 UI**

1. 銅管尺寸：底部有「其他」checkbox，未勾選時無明細、無「＋」。
2. 勾選 → 自動一列空白「其他：／數量」；可再「＋」第二列；刪到 0 仍勾選。
3. 取消勾選 → 明細消失；再勾選 → 先前填的還在。
4. 出風口、零配件、配電線材同樣行為。
5. 集風箱管徑區仍無「其他」。
6. 單選「其他：請註明」不變。

---

### Task 4: 表單 — 線型出風口多列

**Files:**
- Modify: `src/features/project/survey-form.js`（`renderVentOutletRow` 與 helpers）

**Interfaces:**
- Consumes: `SurveyVentLinearSizesUtils.getSizes`／`addSize`／`updateSize`／`removeSize`
- Produces: 線型列無右側總數量；勾選後多列寬高數量

- [ ] **Step 1: 新增 sizes helpers（放在 `removeCheckQtyOther` 附近）**

```js
function addVentLinearSize() {
  SurveyVentLinearSizesUtils.addSize(ensureSd());
  rerender();
}
function updateVentLinearSize(id, patch) {
  SurveyVentLinearSizesUtils.updateSize(ensureSd(), id, patch);
  rerender();
}
function removeVentLinearSize(id) {
  SurveyVentLinearSizesUtils.removeSize(ensureSd(), id);
  rerender();
}
```

- [ ] **Step 2: 重寫 `renderVentOutletRow`**

完整取代（非 dim 維持右側數量；dim＝線型改多列）：

```js
const renderVentOutletRow = opt => {
  const selected = formData.surveyData?.ventOutlets || [];
  const checked = selected.includes(opt.label);
  const sizes = opt.dim ? SurveyVentLinearSizesUtils.getSizes(formData.surveyData) : [];
  return h("div", {
    key: opt.label,
    className: "bg-white p-3 rounded border border-gray-200"
  }, h("div", {
    className: "flex items-center justify-between"
  }, h("label", {
    className: "flex items-center gap-2 cursor-pointer"
  }, h("input", {
    type: "checkbox",
    name: "ventOutlets",
    value: opt.label,
    checked: checked,
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
  }), h("span", {
    className: "text-sm text-gray-700 font-medium"
  }, opt.label)), !opt.dim && h("div", {
    className: "flex items-center gap-2"
  }, h("input", {
    type: "number",
    value: formData.surveyData?.ventOutletsQty?.[opt.label] || '',
    onChange: e => handleQtyMapChange('ventOutletsQty', opt.label, e.target.value),
    disabled: !checked,
    placeholder: "數量",
    className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:opacity-50"
  }), h("span", {
    className: "text-sm text-gray-500 whitespace-nowrap"
  }, "個"))), opt.dim && checked && sizes.map(row => h("div", {
    key: row.id,
    className: "flex flex-wrap items-center gap-3 mt-3 ml-6"
  }, h("span", {
    className: "text-sm text-gray-700 font-medium"
  }, "寬"), h("input", {
    type: "number",
    value: row.width || '',
    onChange: e => updateVentLinearSize(row.id, { width: e.target.value }),
    placeholder: "寬",
    className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
  }), h("span", {
    className: "text-sm text-gray-500"
  }, "cm"), h("span", {
    className: "text-sm text-gray-700 font-medium ml-2"
  }, "高"), h("input", {
    type: "number",
    value: row.height || '',
    onChange: e => updateVentLinearSize(row.id, { height: e.target.value }),
    placeholder: "高",
    className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
  }), h("span", {
    className: "text-sm text-gray-500"
  }, "cm"), h("input", {
    type: "number",
    value: row.qty || '',
    onChange: e => updateVentLinearSize(row.id, { qty: e.target.value }),
    placeholder: "數量",
    className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 ml-2"
  }), h("span", {
    className: "text-sm text-gray-500 whitespace-nowrap"
  }, "個"), h("button", {
    type: "button",
    title: "刪除此尺寸",
    onClick: () => removeVentLinearSize(row.id),
    className: "text-red-500 hover:text-red-700 p-1"
  }, Icons.Trash2({ className: "h-4 w-4" }))), opt.dim && checked && h("button", {
    type: "button",
    onClick: () => addVentLinearSize(),
    className: "flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 mt-3 ml-6"
  }, Icons.Plus({ className: "h-4 w-4" }), "新增尺寸"));
};
```

- [ ] **Step 3: 更新出風口說明文字（可選但建議）**

`renderVentOutletBox` 內 note 改為：

```js
"請勾選出風口型式並填寫數量（個）；線型出風口可新增多組寬、高（cm）與數量"
```

- [ ] **Step 4: 手動驗收線型 UI**

1. 勾選線型 → 無右側總數量；下方一列寬／高／數量空白。
2. 「＋ 新增尺寸」→ 第二列；兩列可填不同尺寸。
3. 刪到 0 列仍勾選；再「＋」可加。
4. 取消勾選 → 明細隱藏；再勾選資料還在。
5. 其他型式（格柵等）仍為勾選＋右側數量。
6. 舊資料：Console 設 `ventLinearWidth/Height`＋qty 後重開編輯 → 一筆 sizes、勾選為真。

---

### Task 5: PDF — fmtVentOutlets 改讀 ventLinearSizes

**Files:**
- Modify: `src/features/project/survey-pdf.js`

**Interfaces:**
- Consumes: `SurveyVentLinearSizesUtils.getSizes`／`formatSizesList`／`formatSizeItem`
- Produces: `fmtVentOutlets` 輸出多筆線型尺寸；其他仍走 others

- [ ] **Step 1: 改寫 `fmtVentOutlets`**

完整取代現有函式：

```js
function fmtVentOutlets(sd) {
  var selected = sd.ventOutlets;
  var qtyMap = sd.ventOutletsQty || {};
  var parts = [];
  var linearLabel = SurveyVentLinearSizesUtils.LABEL;
  var sizes = SurveyVentLinearSizesUtils.getSizes(sd);
  var sizesText = SurveyVentLinearSizesUtils.formatSizesList(sizes);

  if (Array.isArray(selected) && selected.length) {
    selected.forEach(function (label) {
      if (label === '其他') return;
      if (label === linearLabel || (typeof label === 'string' && label.indexOf('線型') >= 0)) {
        return; // 線型改由 sizes／legacy 輸出
      }
      var qty = qtyMap[label];
      parts.push(label + (qty ? ' ' + qty + '個' : ''));
    });
  }

  if (sizesText) {
    parts.push(sizesText);
  } else if (
    (Array.isArray(selected) && selected.indexOf(linearLabel) !== -1) ||
    sd.ventLinearWidth || sd.ventLinearHeight || (qtyMap && qtyMap[linearLabel])
  ) {
    // 尚未 migrate 的直接匯出 fallback
    var qty = qtyMap[linearLabel];
    var text = linearLabel + (qty ? ' ' + qty + '個' : '');
    if (sd.ventLinearWidth || sd.ventLinearHeight) {
      text += '（' + val(sd.ventLinearWidth) + '×' + val(sd.ventLinearHeight) + ' cm）';
    }
    parts.push(text);
  }

  var others = SurveyCheckQtyOthersUtils.getOthers(sd, 'ventOutlets');
  if (others.length) {
    var t = SurveyCheckQtyOthersUtils.formatOthersList(others, '個');
    if (t) parts.push(t);
  } else if (Array.isArray(selected) && selected.indexOf('其他') !== -1) {
    var display = sd.ventOutlets_other || '其他';
    var lq = qtyMap['其他'];
    if (display !== '其他') {
      parts.push(lq ? '其他：' + display + ' ' + lq + '個' : '其他：' + display);
    } else if (lq) {
      parts.push('其他 ' + lq + '個');
    } else {
      parts.push('其他');
    }
  }
  return parts.join('、');
}
```

- [ ] **Step 2: Console／匯出驗收**

```js
var sd = {
  ventOutlets: ['輕鋼架-格柵出風口(60*60cm)', '線型出風口'],
  ventOutletsQty: { '輕鋼架-格柵出風口(60*60cm)': '2' },
  ventLinearSizes: [
    { id: '1', width: '120', height: '10', qty: '3' },
    { id: '2', width: '90', height: '15', qty: '2' }
  ],
  ventOutletsOthers: [{ id: 'o1', label: '自訂口', qty: '1' }]
};
// 若 fmtVentOutlets 未掛 window，用匯出 PDF 或暫時在 Console 貼上 format 結果比對
console.assert(
  SurveyVentLinearSizesUtils.formatSizesList(sd.ventLinearSizes) ===
    '線型出風口 3個（120×10 cm）、線型出風口 2個（90×15 cm）',
  'sizes list'
);
```

瀏覽器：填好多筆線型＋其他 → 匯出／列印現勘 PDF → 出風口欄應見固定型式、多筆線型、多筆其他，無舊單組寬高殘留。

---

## Plan self-review

| Spec 要求 | Task |
|-----------|------|
| `ventLinearSizes` 資料模型／CRUD | Task 2 |
| 線型勾選＋多列 UI、無右側總數量 | Task 4 |
| 線型遷移與清舊欄、勾選補空白 | Task 2＋Task 3 Step 1–2 |
| 其他保留勾選、勾選後展開／＋ | Task 3 |
| 其他遷移寫回勾選、不清 checkbox | Task 1 |
| 取消勾選保留資料 | Task 3 Step 2（不刪陣列） |
| PDF 多筆線型＋其他 | Task 5 |
| 非目標（集風箱／回風口／單選其他） | 未改那些路徑 |

無 TBD／「similar to Task N」占位；命名與 spec 一致（`ventLinearSizes`、`width`／`height`／`qty`）。
