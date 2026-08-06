# 現勘表多筆「其他」＋數量 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓現勘表「多選＋數量」群組可用「＋ 新增其他」新增多筆「其他：名稱＋數量」，舊單筆其他自動遷移，PDF 正確輸出。

**Architecture:** 抽出 `SurveyCheckQtyOthersUtils` 負責群組清單、遷移、CRUD、PDF 格式化；`survey-form.js` 改 UI；`survey-pdf.js` 串接 others。固定選項仍用 checkbox 陣列＋qty map，自填項獨立存 `{checkName}Others`。

**Tech Stack:** Vanilla JS IIFE、`IESS.h`／`stateful`、Tailwind CDN、既有 `Icons.Plus`／`Icons.Trash2`。

**驗證方式:** 本專案無自動測試；utils 以 Console assert、表單／PDF 以瀏覽器手動驗收。不自動 commit（除非使用者要求）。

**Spec:** `docs/superpowers/specs/2026-08-05-survey-multi-other-qty-design.md`

## Global Constraints

- 只改「多選＋數量」類型的其他（含零配件）；不改單選／純文字其他
- 不為集風箱／出線型箱「管徑＋孔數＋數量」加其他列
- 預設不顯示其他列；按「＋ 新增其他」才出現
- 新存檔不寫 `'其他'` 進 checkbox、不寫 `{checkName}_other`／`qtyMap['其他']`
- 讀取時遷移舊單筆其他；`{checkName}Others` 已是陣列則不覆蓋內容，仍清殘留舊欄位
- 名稱／數量可不填仍可暫存

---

## File map

| 檔案 | 職責 |
|------|------|
| `src/features/project/survey-check-qty-others-utils.js` | 群組清單、id、migrate、add／update／remove、PDF 格式化 |
| `index.html` | 載入 utils（在 survey-pdf／survey-form 之前） |
| `src/features/project/survey-form.js` | 載入時 migrate；以多筆 others UI 取代 `renderPipingOtherRow` 與零配件其他列 |
| `src/features/project/survey-pdf.js` | `fmtCheckQtyFromMaps`／`fmtVentOutlets`／`fmtParts` 串接 others |

---

### Task 1: SurveyCheckQtyOthersUtils

**Files:**
- Create: `src/features/project/survey-check-qty-others-utils.js`
- Modify: `index.html`（script 順序）

**Interfaces:**
- Produces: `window.SurveyCheckQtyOthersUtils`：
  - `GROUPS`: `[{ checkName, qtyMapName }, ...]`（14 組，見 spec 表）
  - `othersKey(checkName)` → `checkName + 'Others'`
  - `newId()` → 字串 id
  - `migrateSurveyData(sd)` → 原地遷移並回傳 `sd`
  - `getOthers(sd, checkName)` → 陣列
  - `addOther(sd, checkName)` → 新增 `{ id, label: '', qty: '' }` 並回傳該筆
  - `updateOther(sd, checkName, id, patch)` → 更新 `label`／`qty`
  - `removeOther(sd, checkName, id)` → 刪除該筆
  - `formatOtherItem(item, unit)` → 單筆顯示字串
  - `formatOthersList(others, unit)` → 多筆以「、」連接（空則 `''`）

- [ ] **Step 1: 建立 utils 檔**

建立 `src/features/project/survey-check-qty-others-utils.js`：

```js
/*
 * features/project/survey-check-qty-others-utils.js
 * 現勘表「多選＋數量」可多筆其他：遷移／CRUD／PDF 格式化
 * 對外：window.SurveyCheckQtyOthersUtils
 */
(function () {
  'use strict';

  var GROUPS = [
    { checkName: 'copperSizes', qtyMapName: 'copperSizesQty' },
    { checkName: 'copperFittings', qtyMapName: 'copperFittingsQty' },
    { checkName: 'pvcDrain', qtyMapName: 'pvcDrainQty' },
    { checkName: 'drainInsulation', qtyMapName: 'drainInsulationQty' },
    { checkName: 'chilledFittings', qtyMapName: 'chilledFittingsQty' },
    { checkName: 'chilledPipe', qtyMapName: 'chilledPipeQty' },
    { checkName: 'chilledInsulation', qtyMapName: 'chilledInsulationQty' },
    { checkName: 'channelFittings', qtyMapName: 'channelFittingsQty' },
    { checkName: 'controlSignalWire', qtyMapName: 'controlSignalWireQty' },
    { checkName: 'powerCableWire', qtyMapName: 'powerCableWireQty' },
    { checkName: 'insulatedHose', qtyMapName: 'insulatedHoseQty' },
    { checkName: 'uninsulatedHose', qtyMapName: 'uninsulatedHoseQty' },
    { checkName: 'ventOutlets', qtyMapName: 'ventOutletsQty' },
    { checkName: 'parts', qtyMapName: 'partsQty' }
  ];

  var _idSeq = 0;
  function newId() {
    _idSeq += 1;
    return 'o_' + Date.now().toString(36) + '_' + _idSeq;
  }

  function othersKey(checkName) {
    return checkName + 'Others';
  }

  function getOthers(sd, checkName) {
    var key = othersKey(checkName);
    return Array.isArray(sd && sd[key]) ? sd[key] : [];
  }

  function hasLegacyOther(sd, checkName, qtyMapName) {
    var selected = sd[checkName];
    var qtyMap = sd[qtyMapName] || {};
    var otherText = sd[checkName + '_other'];
    return (Array.isArray(selected) && selected.indexOf('其他') !== -1) ||
      (otherText != null && String(otherText) !== '') ||
      (qtyMap['其他'] != null && String(qtyMap['其他']) !== '');
  }

  function clearLegacyOther(sd, checkName, qtyMapName) {
    if (Array.isArray(sd[checkName])) {
      sd[checkName] = sd[checkName].filter(function (v) { return v !== '其他'; });
    }
    delete sd[checkName + '_other'];
    if (sd[qtyMapName] && Object.prototype.hasOwnProperty.call(sd[qtyMapName], '其他')) {
      var m = Object.assign({}, sd[qtyMapName]);
      delete m['其他'];
      sd[qtyMapName] = m;
    }
  }

  function migrateOne(sd, checkName, qtyMapName) {
    var key = othersKey(checkName);
    var existing = sd[key];
    var hasOthersArray = Array.isArray(existing);
    if (!hasOthersArray && hasLegacyOther(sd, checkName, qtyMapName)) {
      var qtyMap = sd[qtyMapName] || {};
      sd[key] = [{
        id: newId(),
        label: sd[checkName + '_other'] != null ? String(sd[checkName + '_other']) : '',
        qty: qtyMap['其他'] != null ? String(qtyMap['其他']) : ''
      }];
    } else if (!hasOthersArray) {
      // leave undefined until user adds
    }
    if (hasLegacyOther(sd, checkName, qtyMapName) || hasOthersArray) {
      clearLegacyOther(sd, checkName, qtyMapName);
    }
  }

  function migrateSurveyData(sd) {
    if (!sd || typeof sd !== 'object') return sd || {};
    GROUPS.forEach(function (g) {
      migrateOne(sd, g.checkName, g.qtyMapName);
    });
    return sd;
  }

  function addOther(sd, checkName) {
    var key = othersKey(checkName);
    var list = (Array.isArray(sd[key]) ? sd[key] : []).slice();
    var row = { id: newId(), label: '', qty: '' };
    list.push(row);
    sd[key] = list;
    return row;
  }

  function updateOther(sd, checkName, id, patch) {
    var key = othersKey(checkName);
    var list = (Array.isArray(sd[key]) ? sd[key] : []).map(function (row) {
      if (row.id !== id) return row;
      return Object.assign({}, row, patch);
    });
    sd[key] = list;
  }

  function removeOther(sd, checkName, id) {
    var key = othersKey(checkName);
    sd[key] = (Array.isArray(sd[key]) ? sd[key] : []).filter(function (row) {
      return row.id !== id;
    });
  }

  function formatOtherItem(item, unit) {
    if (!item) return '其他';
    var label = item.label != null ? String(item.label).trim() : '';
    var qty = item.qty != null ? String(item.qty).trim() : '';
    var u = unit || '';
    if (label && qty) return '其他：' + label + ' ' + qty + u;
    if (label) return '其他：' + label;
    if (qty) return '其他 ' + qty + u;
    return '其他';
  }

  function formatOthersList(others, unit) {
    if (!Array.isArray(others) || !others.length) return '';
    return others.map(function (item) {
      return formatOtherItem(item, unit);
    }).join('、');
  }

  window.SurveyCheckQtyOthersUtils = {
    GROUPS: GROUPS,
    othersKey: othersKey,
    newId: newId,
    migrateSurveyData: migrateSurveyData,
    getOthers: getOthers,
    addOther: addOther,
    updateOther: updateOther,
    removeOther: removeOther,
    formatOtherItem: formatOtherItem,
    formatOthersList: formatOthersList
  };
})();
```

- [ ] **Step 2: 在 `index.html` 載入（於 `survey-pdf.js` 之前）**

找到：

```html
  <script src="src/features/project/survey-pdf.js"></script>
  <script src="src/features/project/survey-list.js"></script>
  <script src="src/features/project/survey-form.js"></script>
```

改為：

```html
  <script src="src/features/project/survey-check-qty-others-utils.js"></script>
  <script src="src/features/project/survey-pdf.js"></script>
  <script src="src/features/project/survey-list.js"></script>
  <script src="src/features/project/survey-form.js"></script>
```

- [ ] **Step 3: Console 驗收 migrate／format**

開啟 `index.html`，DevTools Console 執行：

```js
var U = SurveyCheckQtyOthersUtils;
var sd = {
  copperSizes: ['1/2"', '其他'],
  copperSizes_other: '排水旁通',
  copperSizesQty: { '1/2"': '10', '其他': '12' },
  parts: ['其他'],
  parts_other: '特殊零件',
  partsQty: { '其他': '2' }
};
U.migrateSurveyData(sd);
console.assert(sd.copperSizes.indexOf('其他') === -1, 'copperSizes no 其他');
console.assert(sd.copperSizesOthers.length === 1 && sd.copperSizesOthers[0].label === '排水旁通' && sd.copperSizesOthers[0].qty === '12', 'copper migrate');
console.assert(sd.copperSizes_other === undefined && !('其他' in (sd.copperSizesQty || {})), 'legacy cleared');
console.assert(sd.partsOthers[0].label === '特殊零件' && sd.partsOthers[0].qty === '2', 'parts migrate');
console.assert(U.formatOtherItem({ label: '排水旁通', qty: '12' }, '米') === '其他：排水旁通 12米', 'fmt both');
console.assert(U.formatOtherItem({ label: '排水旁通', qty: '' }, '米') === '其他：排水旁通', 'fmt label');
console.assert(U.formatOtherItem({ label: '', qty: '12' }, '米') === '其他 12米', 'fmt qty');
console.assert(U.formatOtherItem({ label: '', qty: '' }, '米') === '其他', 'fmt empty');
U.addOther(sd, 'copperSizes');
console.assert(sd.copperSizesOthers.length === 2, 'add');
U.updateOther(sd, 'copperSizes', sd.copperSizesOthers[1].id, { label: '額外', qty: '3' });
console.assert(sd.copperSizesOthers[1].label === '額外', 'update');
U.removeOther(sd, 'copperSizes', sd.copperSizesOthers[1].id);
console.assert(sd.copperSizesOthers.length === 1, 'remove');
// 已有 others 陣列時不覆蓋
var sd2 = { copperSizesOthers: [{ id: 'x', label: 'keep', qty: '1' }], copperSizes: ['其他'], copperSizes_other: 'old' };
U.migrateSurveyData(sd2);
console.assert(sd2.copperSizesOthers[0].label === 'keep', 'no overwrite');
console.assert(sd2.copperSizes.indexOf('其他') === -1, 'still clear legacy');
console.log('SurveyCheckQtyOthersUtils OK');
```

Expected: 印出 `SurveyCheckQtyOthersUtils OK`，無 assert 失敗。

---

### Task 2: 表單載入遷移＋多筆其他 UI

**Files:**
- Modify: `src/features/project/survey-form.js`

**Interfaces:**
- Consumes: `SurveyCheckQtyOthersUtils.migrateSurveyData`／`getOthers`／`addOther`／`updateOther`／`removeOther`
- Produces: 表單 UI 不再使用單列 `renderPipingOtherRow`；零配件其他改同模式

- [ ] **Step 1: 載入時 migrate**

在 `SurveyForm` 內、建立完 `formData` 後、進入 `stateful` 之前（約 `fileNameManuallyEdited` 附近），確保 `surveyData` 存在並遷移一次：

```js
if (!formData.surveyData || typeof formData.surveyData !== 'object') {
  formData.surveyData = {};
}
SurveyCheckQtyOthersUtils.migrateSurveyData(formData.surveyData);
```

注意：`SurveyForm` 每次 re-render 會重跑外層函式；`migrateSurveyData` 必須冪等（Task 1 已保證：已是陣列不覆蓋、legacy 清掉後不再觸發建立）。若擔心重複 `newId`，確認 `hasLegacyOther` 在 clear 後為 false。

- [ ] **Step 2: 在 `stateful` 內新增 others handlers**

放在 `handleQtyMapChange` 附近：

```js
function ensureSd() {
  return formData.surveyData || (formData.surveyData = {});
}
function addCheckQtyOther(checkName) {
  SurveyCheckQtyOthersUtils.addOther(ensureSd(), checkName);
  rerender();
}
function updateCheckQtyOther(checkName, id, patch) {
  SurveyCheckQtyOthersUtils.updateOther(ensureSd(), checkName, id, patch);
  rerender();
}
function removeCheckQtyOther(checkName, id) {
  SurveyCheckQtyOthersUtils.removeOther(ensureSd(), checkName, id);
  rerender();
}
```

- [ ] **Step 3: 以 `renderCheckQtyOthersBlock` 取代 `renderPipingOtherRow`**

刪除（或停止使用）`renderPipingOtherRow`。新增：

```js
const renderCheckQtyOthersBlock = (checkName, unit, qtyLabel) => {
  const others = SurveyCheckQtyOthersUtils.getOthers(formData.surveyData, checkName);
  return h("div", { className: "space-y-2 mt-2" },
    others.map(row => h("div", {
      key: row.id,
      className: "flex items-center justify-between bg-white p-3 rounded border border-gray-200"
    },
      h("div", { className: "flex items-center gap-2 flex-1 min-w-0" },
        h("span", { className: "text-sm text-gray-700 font-medium shrink-0" }, "其他："),
        h("input", {
          type: "text",
          value: row.label || '',
          onChange: e => updateCheckQtyOther(checkName, row.id, { label: e.target.value }),
          placeholder: "請註明",
          className: "flex-1 max-w-xs p-1 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent text-sm"
        })
      ),
      h("div", { className: "flex items-center gap-2 shrink-0" },
        h("input", {
          type: "number",
          value: row.qty || '',
          onChange: e => updateCheckQtyOther(checkName, row.id, { qty: e.target.value }),
          placeholder: qtyLabel,
          className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        }),
        h("span", { className: "text-sm text-gray-500 whitespace-nowrap" }, unit),
        h("button", {
          type: "button",
          title: "刪除此其他項目",
          onClick: () => removeCheckQtyOther(checkName, row.id),
          className: "text-red-500 hover:text-red-700 p-1"
        }, Icons.Trash2({ className: "h-4 w-4" }))
      )
    )),
    h("button", {
      type: "button",
      onClick: () => addCheckQtyOther(checkName),
      className: "flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
    }, Icons.Plus({ className: "h-4 w-4" }), "新增其他")
  );
};
```

- [ ] **Step 4: 接到 `renderPipingCheckQtyGroup`**

將：

```js
}, options.map(...), renderPipingOtherRow(checkName, mapName, unit, qtyLabel)));
```

改為：

```js
}, options.map(o => renderPipingQtyRow(checkName, mapName, typeof o === 'string' ? {
  label: o,
  unit,
  qtyLabel
} : o)), renderCheckQtyOthersBlock(checkName, unit, qtyLabel)));
```

（保持與現有 `options.map` 邏輯一致，只替換 other 那段。）

- [ ] **Step 5: 出風口改用同一 block**

在 `renderVentOutletBox` 內，把 `renderPipingOtherRow('ventOutlets', 'ventOutletsQty', '個', '數量')` 換成：

```js
renderCheckQtyOthersBlock('ventOutlets', '個', '數量')
```

- [ ] **Step 6: 零配件其他列改用同一 block**

刪除零配件區塊內「其他 — 自填名稱 + 數量」那整段 checkbox 列（約 `parts_other`／`partsQty['其他']`），改在 `SURVEY_PARTS.map(...)` 之後接：

```js
renderCheckQtyOthersBlock('parts', '組', '數量')
```

注意外層已有 `space-y-3`；`renderCheckQtyOthersBlock` 自帶 `space-y-2 mt-2`，可接受。若版面過鬆，可把 block 的 `mt-2` 視情況拿掉，但勿改固定零件列樣式。

- [ ] **Step 7: 手動驗收 UI**

1. 開新增現勘表 → 配管工程 → 銅管尺寸：底部只有「＋ 新增其他」，無預設其他列。
2. 按兩次「新增其他」→ 兩列可填名稱／長度；刪一列後剩一列；再刪到 0 只剩按鈕。
3. 配電工程線材、風管軟管、出風口、零配件同樣可多筆其他。
4. 集風箱「風管管徑、孔數與數量」仍無「新增其他」。
5. 單選「其他：請註明」（如管路保護顏色）行為不變。
6. 用舊資料模擬：在 Console 對某 case 設 legacy 後重開編輯，應見一筆 others、無 checkbox「其他」。

---

### Task 3: PDF 串接 others

**Files:**
- Modify: `src/features/project/survey-pdf.js`

**Interfaces:**
- Consumes: `SurveyCheckQtyOthersUtils.othersKey`／`formatOthersList`／`getOthers`
- Produces: `fmtCheckQtyFromMaps`／`fmtVentOutlets`／`fmtParts` 輸出含多筆其他

- [ ] **Step 1: 更新 `fmtCheckQtyFromMaps`**

將函式改為（固定選項略過 `'其他'`；再 append others）：

```js
function fmtCheckQtyFromMaps(checkName, qtyMapName, sd, unit) {
  var selected = sd[checkName];
  var qtyMap = sd[qtyMapName];
  var parts = [];
  if (Array.isArray(selected) && selected.length) {
    selected.forEach(function (label) {
      if (label === '其他') return;
      var qty = qtyMap && qtyMap[label];
      parts.push(qty ? label + ' ' + qty + (unit || '') : label);
    });
  }
  // legacy fallback（尚未 migrate 的直接匯出）
  if (Array.isArray(selected) && selected.indexOf('其他') !== -1) {
    var legacyLabel = sd[checkName + '_other'] || '其他';
    var legacyQty = qtyMap && qtyMap['其他'];
    if (legacyLabel && legacyLabel !== '其他') {
      parts.push(legacyQty ? '其他：' + legacyLabel + ' ' + legacyQty + (unit || '') : '其他：' + legacyLabel);
    } else if (legacyQty) {
      parts.push('其他 ' + legacyQty + (unit || ''));
    } else {
      parts.push('其他');
    }
  }
  var othersText = SurveyCheckQtyOthersUtils.formatOthersList(
    SurveyCheckQtyOthersUtils.getOthers(sd, checkName),
    unit || ''
  );
  if (othersText) parts.push(othersText);
  return parts.join('、');
}
```

說明：表單載入會 migrate，但 PDF 可能直接對 store 匯出；legacy fallback 與 `formatOthersList` 並存時，若兩者同時有資料可能重複。為避免重複：**若 `getOthers` 非空，跳過 legacy fallback**。實作時用：

```js
var others = SurveyCheckQtyOthersUtils.getOthers(sd, checkName);
if (!others.length && Array.isArray(selected) && selected.indexOf('其他') !== -1) {
  // legacy fallback only
}
```

完整建議實作：

```js
function fmtCheckQtyFromMaps(checkName, qtyMapName, sd, unit) {
  var selected = sd[checkName];
  var qtyMap = sd[qtyMapName];
  var parts = [];
  if (Array.isArray(selected) && selected.length) {
    selected.forEach(function (label) {
      if (label === '其他') return;
      var qty = qtyMap && qtyMap[label];
      parts.push(qty ? label + ' ' + qty + (unit || '') : label);
    });
  }
  var others = SurveyCheckQtyOthersUtils.getOthers(sd, checkName);
  if (others.length) {
    var othersText = SurveyCheckQtyOthersUtils.formatOthersList(others, unit || '');
    if (othersText) parts.push(othersText);
  } else if (Array.isArray(selected) && selected.indexOf('其他') !== -1) {
    var display = sd[checkName + '_other'] || '其他';
    var lq = qtyMap && qtyMap['其他'];
    if (display !== '其他') {
      parts.push(lq ? '其他：' + display + ' ' + lq + (unit || '') : '其他：' + display);
    } else if (lq) {
      parts.push('其他 ' + lq + (unit || ''));
    } else {
      parts.push('其他');
    }
  }
  return parts.join('、');
}
```

- [ ] **Step 2: 更新 `fmtVentOutlets`**

在既有 `selected.map` 後（map 內遇到 `'其他'` 改 `return null` 再 filter，或先 filter 掉 `'其他'`），再 append：

```js
function fmtVentOutlets(sd) {
  var selected = sd.ventOutlets;
  var qtyMap = sd.ventOutletsQty || {};
  var parts = [];
  if (Array.isArray(selected) && selected.length) {
    selected.forEach(function (label) {
      if (label === '其他') return;
      var qty = qtyMap[label];
      var text = label + (qty ? ' ' + qty + '個' : '');
      if (label.indexOf('線型') >= 0 && (sd.ventLinearWidth || sd.ventLinearHeight)) {
        text += '（' + val(sd.ventLinearWidth) + '×' + val(sd.ventLinearHeight) + ' cm）';
      }
      parts.push(text);
    });
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

- [ ] **Step 3: 更新 `fmtParts`**

```js
function fmtParts(sd) {
  var selected = sd.parts;
  var qtyMap = sd.partsQty || {};
  var parts = [];
  if (Array.isArray(selected) && selected.length) {
    selected.forEach(function (p) {
      if (p === '其他') return;
      var qty = qtyMap[p];
      parts.push(qty ? p + ' ' + qty + '組' : p);
    });
  }
  var others = SurveyCheckQtyOthersUtils.getOthers(sd, 'parts');
  if (others.length) {
    var t = SurveyCheckQtyOthersUtils.formatOthersList(others, '組');
    if (t) parts.push(t);
  } else if (Array.isArray(selected) && selected.indexOf('其他') !== -1) {
    var display = sd.parts_other || '其他';
    var lq = qtyMap['其他'];
    if (display !== '其他') {
      parts.push(lq ? '其他：' + display + ' ' + lq + '組' : '其他：' + display);
    } else if (lq) {
      parts.push('其他 ' + lq + '組');
    } else {
      parts.push('其他');
    }
  }
  return parts.join('、');
}
```

- [ ] **Step 4: 手動驗收 PDF**

1. 新增現勘：銅管勾 `1/2"` 填 10；新增兩筆其他「排水旁通／12」「額外／3」；存檔後匯出 PDF → 銅管列應含 `1/2" 10米、其他：排水旁通 12米、其他：額外 3米`（或同等「、」連接）。
2. 零配件多筆其他單位為「組」。
3. 出風口多筆其他單位為「個」。
4. 未開過新表單的舊 case（若 seed／local 仍有 legacy）：直接匯出仍能顯示單筆其他（legacy fallback）。

---

### Task 4: 端到端驗收對照 spec

**Files:** 無新檔；對照 `docs/superpowers/specs/2026-08-05-survey-multi-other-qty-design.md` 驗收標準。

- [ ] **Step 1: 逐條勾選**

| # | 標準 | 如何確認 |
|---|------|----------|
| 1 | 範圍內群組可多筆其他、可填可刪 | 配管／配電／軟管／出風口／零配件各試一組 |
| 2 | 預設只有「＋ 新增其他」 | 新表單各群組底部 |
| 3 | 舊單筆其他遷移為一筆、無舊 checkbox 其他 | Console 注入 legacy 後開編輯 |
| 4 | PDF 多筆其他＋單位 | Task 3 Step 4 |
| 5 | 集風箱管徑無其他 | 風管工程集風箱區塊 |
| 6 | 單選／純文字其他不變 | 管路保護顏色、特殊施工等 |

- [ ] **Step 2: 確認無殘留單列 other UI**

```bash
rg -n "renderPipingOtherRow|parts_other|copperSizes_other" src/features/project/survey-form.js
```

Expected: `renderPipingOtherRow` 無定義／無呼叫；`parts_other`／`copperSizes_other` 不應再作為表單欄位（migrate 的讀取只在 utils）。若 form 仍出現 `name: "..._other"` 給**單選**其他，那是範圍外，保留。

```bash
rg -n "_other" src/features/project/survey-form.js | rg -v "Material_other|protectColor|customBox|wasteDisposal|specialConstruction|indoorWorkArea|reservedItems|indoorUnitPositioning|outdoorUnitTransport|craneRequirement"
```

預期：多選＋數量群組的 `_other` 輸入已消失；單選類仍在。

---

## Spec coverage (self-review)

| Spec 要求 | Task |
|-----------|------|
| 獨立 `{checkName}Others` 陣列 | Task 1 |
| 14 個群組清單 | Task 1 `GROUPS` |
| ＋新增／刪除／預設不顯示 | Task 2 |
| 載入遷移舊格式 | Task 1＋Task 2 Step 1 |
| 已有 others 不覆蓋、仍清 legacy | Task 1 `migrateOne` |
| PDF 格式四種 label/qty 組合 | Task 1 `formatOtherItem`＋Task 3 |
| 出風口／零配件 | Task 2＋Task 3 |
| 不做孔數其他、不改單選其他 | Task 2／4 驗收排除 |

無 TBD／placeholder；命名在 tasks 間一致（`SurveyCheckQtyOthersUtils`、`{checkName}Others`、`addOther`／`updateOther`／`removeOther`）。
