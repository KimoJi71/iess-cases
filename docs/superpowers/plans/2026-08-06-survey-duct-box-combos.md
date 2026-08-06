# 現勘表風箱多組合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓集風箱／出線型箱／回風箱／強制回風箱／三通風箱改為多筆「一列一組」答案（材質＋法蘭＋管徑＋孔數＋數量；三通無法蘭／孔數），並遷移舊資料、PDF 正確輸出。

**Architecture:** 新建 `SurveyDuctBoxCombosUtils` 管理五個 `{prefix}Combos` 陣列的 migrate／CRUD／PDF 格式化；表單以分區卡片列取代舊的共用材質／法蘭＋勾選管徑；PDF `fmtDuctBox` 改讀 Combos（匯出前 migrate）。

**Tech Stack:** Vanilla JS IIFE、`IESS.h`／`stateful`、Tailwind CDN、既有 `Icons.Plus`／`Icons.Trash2`、`DUCT_BOX_MATERIALS`／`DUCT_BOX_PIPES`／`DUCT_TEE_PIPES`。

**驗證方式:** 本專案無自動測試；utils 以 Console assert、表單／PDF 以瀏覽器手動驗收。不自動 commit（除非使用者要求）。

**Spec:** `docs/superpowers/specs/2026-08-06-survey-duct-box-combos-design.md`

## Global Constraints

- 一般風箱列：`{ id, material, materialOther, flangeWidth, flangeHeight, pipe, holes, qty }`
- 三通列：`{ id, material, materialOther, pipe, qty }`（無 flange／holes）
- 只寫 `{prefix}Combos`；清除 `Material`／`Material_other`／`FlangeWidth`／`FlangeHeight`／`Pipes`／`PipesHoles`／`PipesQty`
- 載入後陣列空 → 補一列空白；可「＋」；可刪到 0
- 欄位可空字串暫存
- 不改出風口／回風口／特製風箱／軟管

---

## File map

| 檔案 | 職責 |
|------|------|
| `src/features/project/survey-duct-box-combos-utils.js` | PREFIXES、migrate／CRUD／ensureBlank／PDF 格式化 |
| `index.html` | 載入 utils（vent-linear 之後、survey-pdf 之前） |
| `src/features/project/survey-form.js` | 多組合列 UI；載入時 migrate |
| `src/features/project/survey-pdf.js` | `fmtDuctBox` 改讀 Combos；匯出前 migrate |

---

### Task 1: SurveyDuctBoxCombosUtils + script 載入

**Files:**
- Create: `src/features/project/survey-duct-box-combos-utils.js`
- Modify: `index.html`

**Interfaces:**
- Produces: `window.SurveyDuctBoxCombosUtils`
  - `PREFIXES` → `[{ prefix, hasFlangeHoles }, …]`（五項）
  - `combosKey(prefix)` → `prefix + 'Combos'`
  - `newId()` → `db_` 前綴字串
  - `getCombos(sd, prefix)` → 陣列
  - `addCombo(sd, prefix)` → 新列物件
  - `updateCombo(sd, prefix, id, patch)`
  - `removeCombo(sd, prefix, id)`
  - `ensureBlank(sd, prefix)` → 空則 add
  - `migrateSurveyData(sd)` → 五 prefix 遷移、清舊鍵、ensureBlank
  - `formatCombo(item, opts)` → 單列 PDF 字串；`opts.hasFlangeHoles`
  - `formatCombosList(sd, prefix)` → 多列以「；」連接

- [ ] **Step 1: 建立 utils 檔**

```js
/*
 * features/project/survey-duct-box-combos-utils.js
 * 現勘表風箱多組合：遷移／CRUD／PDF 格式化
 * 對外：window.SurveyDuctBoxCombosUtils
 */
(function () {
  'use strict';

  var PREFIXES = [
    { prefix: 'collectBox', hasFlangeHoles: true },
    { prefix: 'outletBox', hasFlangeHoles: true },
    { prefix: 'returnBox', hasFlangeHoles: true },
    { prefix: 'forcedReturnBox', hasFlangeHoles: true },
    { prefix: 'teeBox', hasFlangeHoles: false }
  ];

  var _idSeq = 0;
  function newId() {
    _idSeq += 1;
    return 'db_' + Date.now().toString(36) + '_' + _idSeq;
  }

  function combosKey(prefix) {
    return prefix + 'Combos';
  }

  function findMeta(prefix) {
    for (var i = 0; i < PREFIXES.length; i++) {
      if (PREFIXES[i].prefix === prefix) return PREFIXES[i];
    }
    return { prefix: prefix, hasFlangeHoles: true };
  }

  function blankRow(hasFlangeHoles) {
    var row = {
      id: newId(),
      material: '',
      materialOther: '',
      pipe: '',
      qty: ''
    };
    if (hasFlangeHoles) {
      row.flangeWidth = '';
      row.flangeHeight = '';
      row.holes = '';
    }
    return row;
  }

  function getCombos(sd, prefix) {
    var key = combosKey(prefix);
    return Array.isArray(sd && sd[key]) ? sd[key] : [];
  }

  function addCombo(sd, prefix) {
    var meta = findMeta(prefix);
    var list = getCombos(sd, prefix).slice();
    var row = blankRow(meta.hasFlangeHoles);
    list.push(row);
    sd[combosKey(prefix)] = list;
    return row;
  }

  function updateCombo(sd, prefix, id, patch) {
    var key = combosKey(prefix);
    sd[key] = getCombos(sd, prefix).map(function (row) {
      if (row.id !== id) return row;
      return Object.assign({}, row, patch, { id: row.id });
    });
  }

  function removeCombo(sd, prefix, id) {
    var key = combosKey(prefix);
    sd[key] = getCombos(sd, prefix).filter(function (row) {
      return row.id !== id;
    });
  }

  function ensureBlank(sd, prefix) {
    if (!sd || typeof sd !== 'object') return;
    if (getCombos(sd, prefix).length === 0) addCombo(sd, prefix);
  }

  function str(v) {
    return v != null ? String(v) : '';
  }

  function hasLegacy(sd, prefix) {
    if (sd[prefix + 'Material'] != null && str(sd[prefix + 'Material']) !== '') return true;
    if (sd[prefix + 'Material_other'] != null && str(sd[prefix + 'Material_other']) !== '') return true;
    if (sd[prefix + 'FlangeWidth'] != null && str(sd[prefix + 'FlangeWidth']) !== '') return true;
    if (sd[prefix + 'FlangeHeight'] != null && str(sd[prefix + 'FlangeHeight']) !== '') return true;
    if (Array.isArray(sd[prefix + 'Pipes']) && sd[prefix + 'Pipes'].length) return true;
    var holes = sd[prefix + 'PipesHoles'];
    if (holes && typeof holes === 'object' && Object.keys(holes).length) return true;
    var qty = sd[prefix + 'PipesQty'];
    if (qty && typeof qty === 'object' && Object.keys(qty).length) return true;
    return false;
  }

  function clearLegacy(sd, prefix) {
    delete sd[prefix + 'Material'];
    delete sd[prefix + 'Material_other'];
    delete sd[prefix + 'FlangeWidth'];
    delete sd[prefix + 'FlangeHeight'];
    delete sd[prefix + 'Pipes'];
    delete sd[prefix + 'PipesHoles'];
    delete sd[prefix + 'PipesQty'];
  }

  function migrateOne(sd, prefix, hasFlangeHoles) {
    var key = combosKey(prefix);
    var hasArray = Array.isArray(sd[key]);

    if (!hasArray && hasLegacy(sd, prefix)) {
      var material = str(sd[prefix + 'Material']);
      var materialOther = str(sd[prefix + 'Material_other']);
      var fw = str(sd[prefix + 'FlangeWidth']);
      var fh = str(sd[prefix + 'FlangeHeight']);
      var pipes = Array.isArray(sd[prefix + 'Pipes']) ? sd[prefix + 'Pipes'] : [];
      var holesMap = sd[prefix + 'PipesHoles'] || {};
      var qtyMap = sd[prefix + 'PipesQty'] || {};
      var rows = [];

      if (pipes.length) {
        pipes.forEach(function (p) {
          var row = {
            id: newId(),
            material: material,
            materialOther: materialOther,
            pipe: str(p),
            qty: qtyMap[p] != null ? str(qtyMap[p]) : ''
          };
          if (hasFlangeHoles) {
            row.flangeWidth = fw;
            row.flangeHeight = fh;
            row.holes = holesMap[p] != null ? str(holesMap[p]) : '';
          }
          rows.push(row);
        });
      } else {
        var empty = {
          id: newId(),
          material: material,
          materialOther: materialOther,
          pipe: '',
          qty: ''
        };
        if (hasFlangeHoles) {
          empty.flangeWidth = fw;
          empty.flangeHeight = fh;
          empty.holes = '';
        }
        rows.push(empty);
      }
      sd[key] = rows;
    }

    clearLegacy(sd, prefix);
    ensureBlank(sd, prefix);
  }

  function migrateSurveyData(sd) {
    if (!sd || typeof sd !== 'object') return sd || {};
    PREFIXES.forEach(function (meta) {
      migrateOne(sd, meta.prefix, meta.hasFlangeHoles);
    });
    return sd;
  }

  function formatCombo(item, opts) {
    if (!item) return '';
    var hasFlangeHoles = !opts || opts.hasFlangeHoles !== false;
    var parts = [];
    var material = item.material != null ? String(item.material).trim() : '';
    if (material) {
      var matDisplay = material;
      if (material === '其他') {
        var other = item.materialOther != null ? String(item.materialOther).trim() : '';
        matDisplay = other || '其他';
      }
      parts.push('材質：' + matDisplay);
    }
    if (hasFlangeHoles) {
      var fw = item.flangeWidth != null ? String(item.flangeWidth).trim() : '';
      var fh = item.flangeHeight != null ? String(item.flangeHeight).trim() : '';
      if (fw || fh) parts.push('法蘭內徑 ' + fw + '×' + fh + ' cm');
    }
    var pipe = item.pipe != null ? String(item.pipe).trim() : '';
    var pipePart = pipe;
    if (hasFlangeHoles) {
      var holes = item.holes != null ? String(item.holes).trim() : '';
      if (holes) pipePart += (pipePart ? ' ' : '') + holes + '孔';
    }
    var qty = item.qty != null ? String(item.qty).trim() : '';
    if (qty) pipePart += (pipePart ? ' ' : '') + qty + '個';
    if (pipePart) parts.push(pipePart);
    return parts.join('；');
  }

  function formatCombosList(sd, prefix) {
    var meta = findMeta(prefix);
    var list = getCombos(sd, prefix);
    if (!list.length) return '';
    return list
      .map(function (item) {
        return formatCombo(item, { hasFlangeHoles: meta.hasFlangeHoles });
      })
      .filter(function (t) {
        return t;
      })
      .join('；');
  }

  window.SurveyDuctBoxCombosUtils = {
    PREFIXES: PREFIXES,
    combosKey: combosKey,
    newId: newId,
    getCombos: getCombos,
    addCombo: addCombo,
    updateCombo: updateCombo,
    removeCombo: removeCombo,
    ensureBlank: ensureBlank,
    migrateSurveyData: migrateSurveyData,
    formatCombo: formatCombo,
    formatCombosList: formatCombosList
  };
})();
```

- [ ] **Step 2: 在 `index.html` 掛 script**

在 `survey-vent-linear-sizes-utils.js` 之後、`survey-pdf.js` 之前插入：

```html
<script src="src/features/project/survey-duct-box-combos-utils.js"></script>
```

- [ ] **Step 3: Console 驗收**

重新整理頁面後於 Console：

```js
var U = SurveyDuctBoxCombosUtils;

// A: 多管徑 legacy → 多列 + 清舊鍵
var a = {
  collectBoxMaterial: '鐵製',
  collectBoxFlangeWidth: '30',
  collectBoxFlangeHeight: '20',
  collectBoxPipes: ['4"風管', '6"風管'],
  collectBoxPipesHoles: { '4"風管': '1', '6"風管': '2' },
  collectBoxPipesQty: { '4"風管': '1', '6"風管': '3' }
};
U.migrateSurveyData(a);
console.assert(a.collectBoxCombos.length === 2, 'two rows');
console.assert(a.collectBoxCombos[0].material === '鐵製' && a.collectBoxCombos[0].pipe === '4"風管' && a.collectBoxCombos[0].holes === '1', 'row0');
console.assert(a.collectBoxMaterial === undefined && a.collectBoxPipes === undefined, 'legacy cleared');
console.assert(U.formatCombosList(a, 'collectBox').indexOf('6"風管 2孔 3個') !== -1, 'fmt');

// B: 僅材質／法蘭、無管徑 → 一列空管徑
var b = { outletBoxMaterial: '其他', outletBoxMaterial_other: '不鏽鋼', outletBoxFlangeWidth: '10' };
U.migrateSurveyData(b);
console.assert(b.outletBoxCombos.length === 1, 'one');
console.assert(b.outletBoxCombos[0].material === '其他' && b.outletBoxCombos[0].materialOther === '不鏽鋼' && b.outletBoxCombos[0].pipe === '', 'fields');
console.assert(U.formatCombo(b.outletBoxCombos[0], { hasFlangeHoles: true }) === '材質：不鏽鋼；法蘭內徑 10× cm', 'other+flange');

// C: 三通無 flange/holes
var c = { teeBoxMaterial: 'PU貼鋁皮', teeBoxPipes: ['8"'], teeBoxPipesQty: { '8"': '2' } };
U.migrateSurveyData(c);
console.assert(c.teeBoxCombos.length === 1 && c.teeBoxCombos[0].holes === undefined, 'no holes key');
console.assert(U.formatCombosList(c, 'teeBox') === '材質：PU貼鋁皮；8" 2個', 'tee fmt');

// D: 全新 → 五個 prefix 各一空白列
var d = {};
U.migrateSurveyData(d);
console.assert(d.collectBoxCombos.length === 1 && d.teeBoxCombos.length === 1, 'blanks');
console.assert(U.formatCombosList(d, 'collectBox') === '', 'blank fmt empty');
```

Expected: 全部 assert 通過。

---

### Task 2: 表單 UI（多組合列）

**Files:**
- Modify: `src/features/project/survey-form.js`

**Interfaces:**
- Consumes: `SurveyDuctBoxCombosUtils`（Task 1 全部 API）
- Produces: `renderDuctBox`／`renderDuctTeeBox` 改為 Combos UI；載入 migrate

- [ ] **Step 1: 載入時 migrate**

在既有 `SurveyVentLinearSizesUtils.migrateSurveyData(formData.surveyData);` 之後加：

```js
SurveyDuctBoxCombosUtils.migrateSurveyData(formData.surveyData);
```

- [ ] **Step 2: 新增 CRUD helpers（放在 `removeVentLinearSize` 附近）**

```js
function addDuctBoxCombo(prefix) {
  SurveyDuctBoxCombosUtils.addCombo(ensureSd(), prefix);
  rerender();
}
function updateDuctBoxCombo(prefix, id, patch) {
  SurveyDuctBoxCombosUtils.updateCombo(ensureSd(), prefix, id, patch);
  rerender();
}
function removeDuctBoxCombo(prefix, id) {
  SurveyDuctBoxCombosUtils.removeCombo(ensureSd(), prefix, id);
  rerender();
}
```

- [ ] **Step 3: 以新 UI 取代 `renderDuctPipeRow`／`renderDuctBox`／`renderDuctTeeBox`**

刪除（或不再使用）舊的 `renderDuctPipeRow`、舊 `renderDuctBox`、舊 `renderDuctTeeBox`。改為：

```js
const renderDuctBoxComboRow = (prefix, pipes, hasFlangeHoles, row) => {
  const mat = row.material || '';
  const matRadios = ['PU貼鋁皮', '鐵製', '其他'].map(opt => h("label", {
    key: opt,
    className: "flex items-center gap-2 cursor-pointer"
  }, h("input", {
    type: "radio",
    name: prefix + '_mat_' + row.id,
    value: opt,
    checked: mat === opt,
    onChange: () => updateDuctBoxCombo(prefix, row.id, { material: opt }),
    onClick: e => {
      if (mat === opt) {
        e.preventDefault();
        updateDuctBoxCombo(prefix, row.id, { material: '' });
      }
    },
    className: "w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
  }), h("span", {
    className: "text-sm text-gray-700 font-medium"
  }, opt)));
  const matOther = h("input", {
    type: "text",
    value: row.materialOther || '',
    onChange: e => updateDuctBoxCombo(prefix, row.id, { materialOther: e.target.value }),
    disabled: mat !== '其他',
    placeholder: "請註明",
    className: "w-32 p-1 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent text-sm disabled:opacity-50"
  });
  const flange = hasFlangeHoles ? h("div", {
    className: "flex flex-wrap items-center gap-3 mt-3"
  }, h("span", {
    className: "text-sm font-medium text-indigo-700"
  }, "法蘭內徑"), h("span", {
    className: "text-sm text-gray-700 font-medium"
  }, "寬"), h("input", {
    type: "number",
    value: row.flangeWidth || '',
    onChange: e => updateDuctBoxCombo(prefix, row.id, { flangeWidth: e.target.value }),
    placeholder: "寬",
    className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
  }), h("span", {
    className: "text-sm text-gray-500"
  }, "cm"), h("span", {
    className: "text-sm text-gray-700 font-medium ml-2"
  }, "高"), h("input", {
    type: "number",
    value: row.flangeHeight || '',
    onChange: e => updateDuctBoxCombo(prefix, row.id, { flangeHeight: e.target.value }),
    placeholder: "高",
    className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
  }), h("span", {
    className: "text-sm text-gray-500"
  }, "cm")) : null;
  const pipeSelect = h("select", {
    value: row.pipe || '',
    onChange: e => updateDuctBoxCombo(prefix, row.id, { pipe: e.target.value }),
    className: "p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
  }, h("option", {
    value: ""
  }, "選擇管徑"), pipes.map(p => h("option", {
    key: p,
    value: p
  }, p)));
  const pipeRow = h("div", {
    className: "flex flex-wrap items-center gap-3 mt-3"
  }, h("span", {
    className: "text-sm font-medium text-indigo-700"
  }, "管徑"), pipeSelect, hasFlangeHoles ? h("input", {
    type: "number",
    value: row.holes || '',
    onChange: e => updateDuctBoxCombo(prefix, row.id, { holes: e.target.value }),
    placeholder: "孔數",
    className: "w-20 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
  }) : null, hasFlangeHoles ? h("span", {
    className: "text-sm text-gray-500 whitespace-nowrap"
  }, "孔") : null, h("input", {
    type: "number",
    value: row.qty || '',
    onChange: e => updateDuctBoxCombo(prefix, row.id, { qty: e.target.value }),
    placeholder: "數量",
    className: "w-20 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
  }), h("span", {
    className: "text-sm text-gray-500 whitespace-nowrap"
  }, "個"));
  return h("div", {
    key: row.id,
    className: "bg-white p-4 rounded-lg border border-gray-200"
  }, h("div", {
    className: "flex flex-wrap items-center gap-x-6 gap-y-2"
  }, h("span", {
    className: "text-sm font-medium text-indigo-700"
  }, "材質"), matRadios, matOther, h("button", {
    type: "button",
    title: "刪除此組合",
    onClick: () => removeDuctBoxCombo(prefix, row.id),
    className: "text-red-500 hover:text-red-700 p-1 ml-auto"
  }, Icons.Trash2({
    className: "h-4 w-4"
  }))), flange, pipeRow);
};

const renderDuctBoxCard = (title, prefix, pipes, hasFlangeHoles) => {
  const combos = SurveyDuctBoxCombosUtils.getCombos(formData.surveyData, prefix);
  return h("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, h("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, Icons.Wrench({
    className: "h-6 w-6"
  }), " " + title), h("div", {
    className: "space-y-3"
  }, combos.map(row => renderDuctBoxComboRow(prefix, pipes, hasFlangeHoles, row)), h("button", {
    type: "button",
    onClick: () => addDuctBoxCombo(prefix),
    className: "flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 mt-2"
  }, Icons.Plus({
    className: "h-4 w-4"
  }), "新增組合")));
};

const renderDuctBox = (title, prefix) => renderDuctBoxCard(title, prefix, DUCT_BOX_PIPES, true);
const renderDuctTeeBox = (title, prefix) => renderDuctBoxCard(title, prefix, DUCT_TEE_PIPES, false);
```

呼叫處維持不變：

```js
renderDuctBox('集風箱（管徑、數量）', 'collectBox'),
renderDuctBox('出／線型箱', 'outletBox'),
renderDuctBox('回風箱', 'returnBox'),
renderDuctBox('強制回風箱', 'forcedReturnBox'),
renderDuctTeeBox('三通風箱', 'teeBox'),
```

- [ ] **Step 4: 瀏覽器手動驗收表單**

1. 開新現勘表 → 風管工程五種風箱各見一列空白＋「新增組合」。
2. 集風箱填兩組不同材質／法蘭／管徑／孔數／數量；可刪到 0 再＋。
3. 三通無法蘭／孔數欄。
4. 材質「其他」可註明；改選鐵製後註明欄禁用但字還在。
5. 編輯含舊格式的案例 → 多管徑拆成多列，舊鍵不應再出現於存檔 JSON。

---

### Task 3: PDF `fmtDuctBox`

**Files:**
- Modify: `src/features/project/survey-pdf.js`

**Interfaces:**
- Consumes: `SurveyDuctBoxCombosUtils.migrateSurveyData`、`formatCombosList`
- Produces: `fmtDuctBox(prefix, sd)` 回傳 Combos 格式化字串

- [ ] **Step 1: 匯出前 migrate**

在 `buildSurveyPdfHtml` 內取得 `sd` 後、組表前呼叫：

```js
if (sd && typeof sd === 'object' && window.SurveyDuctBoxCombosUtils) {
  SurveyDuctBoxCombosUtils.migrateSurveyData(sd);
}
```

（若檔案開頭已有 `var sd = surveyCase.surveyData || {}`，緊接其後即可。同時可一併確保 others／linear 已 migrate——若尚未，僅加 duct 即可。）

- [ ] **Step 2: 改寫 `fmtDuctBox`**

以以下取代整個 `fmtDuctBox`：

```js
function fmtDuctBox(prefix, sd) {
  if (window.SurveyDuctBoxCombosUtils) {
    return SurveyDuctBoxCombosUtils.formatCombosList(sd, prefix) || '';
  }
  return '';
}
```

- [ ] **Step 3: 瀏覽器 PDF 驗收**

1. 新表填兩組集風箱組合 → 匯出 PDF，「集風箱管徑、數量」格應以「；」列出兩組（含材質、法蘭、管徑孔數個數）。
2. 三通僅材質＋管徑＋個數，無法蘭／孔。
3. 舊資料案例未先開表單直接匯 PDF → 仍正確（因 migrate）。
4. 出風口線型／其他 PDF 行為不變。

---

## Spec coverage checklist

| Spec 條款 | Task |
|-----------|------|
| `{prefix}Combos` 資料形狀（一般／三通） | Task 1 |
| 清除舊鍵、遷移多管徑／僅材質法蘭 | Task 1 |
| 空陣列補空白列、CRUD | Task 1–2 |
| 分區卡片 UI、材質其他、管徑 select | Task 2 |
| PDF 格式與 migrate | Task 1 format + Task 3 |
| 不改出風口等 | 未觸及 |

## Placeholder / consistency self-review

- 無 TBD；API 名稱全程一致（`addCombo`／`updateCombo`／`removeCombo`／`ensureBlank`／`formatCombosList`）。
- 三通 `hasFlangeHoles: false` 於 migrate blankRow、format、UI 三處一致。
- PDF 與表單皆呼叫同一 `migrateSurveyData`。
