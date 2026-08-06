# 叫修多指派＋協作人員設定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 叫修案件指派改多選、新增協作人員設定（各人積分），並讓列表／排程／績效以 `assignees[]`／`collaborators[]` 為唯一真相計算平分與歸戶。

**Architecture:** 新增 `CaseAssigneeUtils`（正規化、顯示、正式指派判定、本案積分公式）；`AssigneeUtils` 更新績效快照與更名連動；`PerformanceUtils` 改依公式加總增額積分；叫修表單／檢視／審核／列表與排程讀寫陣列。保養／工程維持單一字串 `assignee`／`stageAssignee`。

**Tech Stack:** Vanilla JS IIFE、`IESS.h`／`stateful`、Tailwind CDN、既有 `AssigneeUtils`／`ScheduleUtils`／`PerformanceUtils`。

**驗證方式:** 本專案無自動測試；utils 以 Console assert、頁面以瀏覽器手動驗收。不自動 commit（除非使用者要求）。

**Spec:** `docs/superpowers/specs/2026-08-06-repair-multi-assignee-collaborators-design.md`

## Global Constraints

- 叫修來源真相：`assignees: string[]`、`collaborators: { name, points }[]`；不再以 `assignee` 字串為真相
- 積分：`remainder = Σ(points×qty) − Σ(collaborators.points)`（可負）；`share = remainder / 正式指派人數`；兼任兩邊都算
- 特殊未指派值：`''`、`案件待辦`、`尚未指派`（不參與平分）
- 協作人數唯讀＝`collaborators.length`；協作可超過總分不擋存
- 僅改叫修 `cases`；保養／工程單指派不變
- 新增／編輯可編；檢視／審核顯示（審核唯讀）
- 排程篩選：叫修 `assignees` **包含**篩選值；安排寫回多選 `assignees`

---

## File map

| 檔案 | 職責 |
|------|------|
| `src/features/repair/case-assignee-utils.js` | 正規化、讀取／格式化、正式指派、本案積分、協作 CRUD 輔助 |
| `index.html` | 在 `assignee-utils.js` 之後、`seed.js` 之前載入 utils |
| `src/features/permissions/assignee-utils.js` | 績效快照改多指派；更名連動陣列／協作 |
| `src/features/reports/performance-utils.js` | 增額積分改用公式 |
| `src/features/repair/case-status.js` | `hasValidAssignee` 改讀陣列 |
| `src/data/seed.js` | 叫修 seed 正規化為陣列 |
| `src/features/repair/case-form.js` | 多選指派＋協作區塊（新增／編輯） |
| `src/features/repair/case-view.js` | 唯讀顯示 |
| `src/features/repair/case-review.js` | 列表欄＋快照 |
| `src/features/repair/case-list.js` / `case-record.js` | 顯示合併字串 |
| `src/features/customer/store-repair-form.js` | 門市新增叫修對齊 |
| `src/features/customer/store-history.js` | 歷史顯示（字串可為合併結果） |
| `src/features/scheduling/schedule-utils.js` | 待排／已排／篩選相容陣列 |
| `src/features/scheduling/case-arrangement.js` | 叫修安排指派多選寫回 |
| `src/features/reports/data-retrieval-utils.js` | 篩選／匯出含指派 |

---

### Task 1: CaseAssigneeUtils

**Files:**
- Create: `src/features/repair/case-assignee-utils.js`
- Modify: `index.html`（在 `assignee-utils.js` 後、`seed.js` 前插入 script）

**Interfaces:**
- Produces `window.CaseAssigneeUtils`:
  - `UNASSIGNED_VALUES: string[]` — `['', '案件待辦', '尚未指派']`
  - `isUnassignedValue(name) -> boolean`
  - `getAssignees(record) -> string[]`
  - `getFormalAssignees(record) -> string[]`
  - `hasFormalAssignee(record) -> boolean`
  - `formatAssignees(record) -> string`
  - `getCollaborators(record) -> Array<{ name: string, points: number }>`
  - `formatCollaborators(record) -> string`
  - `includesAssignee(record, name) -> boolean`
  - `normalizeRepairCase(record) -> object` — 回傳合併欄位（含清掉依賴用的正規化結果）；不突變則回新物件欄位 patch
  - `sumProcessPoints(record) -> number`
  - `computeBonusPointsForAssignee(record, assigneeName) -> number`
  - `toggleAssignee(assignees, name) -> string[]`
  - `setCollaboratorPoints(collaborators, name, points) -> collaborators`
  - `toggleCollaborator(collaborators, name) -> collaborators` — 取消則移除；新增則 `{ name, points: 0 }`
  - `getPerformanceAssignees(record) -> string[]` — 報表用名單（見 spec 讀取規則）

- [ ] **Step 1: 建立 `case-assignee-utils.js`**

```js
/*
 * features/repair/case-assignee-utils.js — 叫修多指派／協作／積分
 */
(function () {
  'use strict';

  var UNASSIGNED_VALUES = ['', '案件待辦', '尚未指派'];

  function isUnassignedValue(name) {
    return UNASSIGNED_VALUES.indexOf(name == null ? '' : String(name)) !== -1;
  }

  function asStringArray(value) {
    if (Array.isArray(value)) {
      return value.map(function (v) { return String(v || ''); }).filter(function (v, i, arr) {
        return v && arr.indexOf(v) === i;
      });
    }
    if (value == null || value === '') return [];
    return [String(value)];
  }

  function getAssignees(record) {
    if (!record) return [];
    if (Array.isArray(record.assignees)) return asStringArray(record.assignees);
    return asStringArray(record.assignee);
  }

  function getFormalAssignees(record) {
    return getAssignees(record).filter(function (n) { return !isUnassignedValue(n); });
  }

  function hasFormalAssignee(record) {
    return getFormalAssignees(record).length > 0;
  }

  function formatAssignees(record) {
    var list = getAssignees(record);
    if (!list.length) return '';
    return list.join('、');
  }

  function getCollaborators(record) {
    if (!record || !Array.isArray(record.collaborators)) return [];
    return record.collaborators.map(function (row) {
      return {
        name: String((row && row.name) || ''),
        points: Number(row && row.points) || 0
      };
    }).filter(function (row) { return !!row.name; });
  }

  function formatCollaborators(record) {
    var list = getCollaborators(record);
    if (!list.length) return '—';
    return list.map(function (row) {
      return row.name + '（' + row.points + '）';
    }).join('、');
  }

  function includesAssignee(record, name) {
    if (!name) return false;
    return getAssignees(record).indexOf(name) !== -1;
  }

  function getPerformanceAssignees(record) {
    if (!record) return [];
    var formal = getFormalAssignees(record);
    if (formal.length) return formal;
    if (Array.isArray(record.performanceAssignees)) {
      return asStringArray(record.performanceAssignees).filter(function (n) {
        return !isUnassignedValue(n);
      });
    }
    if (record.performanceAssignee && !isUnassignedValue(record.performanceAssignee)) {
      return [String(record.performanceAssignee)];
    }
    return [];
  }

  function normalizeRepairCase(record) {
    if (!record) return record;
    var assignees = getAssignees(record);
    var collaborators = getCollaborators(record);
    var performanceAssignees = Array.isArray(record.performanceAssignees)
      ? asStringArray(record.performanceAssignees)
      : (record.performanceAssignee ? asStringArray(record.performanceAssignee) : []);
    var next = Object.assign({}, record, {
      assignees: assignees,
      collaborators: collaborators,
      performanceAssignees: performanceAssignees
    });
    delete next.assignee;
    return next;
  }

  function sumProcessPoints(record) {
    var total = 0;
    ((record && record.processRecords) || []).forEach(function (r) {
      var points = Number(r.points) || 0;
      var qty = Number(r.qty) > 0 ? Number(r.qty) : 1;
      total += points * qty;
    });
    return total;
  }

  function computeBonusPointsForAssignee(record, assigneeName) {
    if (!record || !assigneeName) return 0;
    var formal = getPerformanceAssignees(record);
    var collaborators = getCollaborators(record);
    var total = sumProcessPoints(record);
    var collabSum = 0;
    var ownCollab = 0;
    collaborators.forEach(function (row) {
      collabSum += row.points;
      if (row.name === assigneeName) ownCollab += row.points;
    });
    var n = formal.length;
    var share = n > 0 ? (total - collabSum) / n : 0;
    var fromAssign = formal.indexOf(assigneeName) !== -1 ? share : 0;
    return fromAssign + ownCollab;
  }

  function toggleAssignee(assignees, name) {
    var list = asStringArray(assignees);
    var idx = list.indexOf(name);
    if (idx === -1) list.push(name);
    else list.splice(idx, 1);
    return list;
  }

  function toggleCollaborator(collaborators, name) {
    var list = (collaborators || []).map(function (row) {
      return { name: row.name, points: Number(row.points) || 0 };
    });
    var idx = -1;
    list.forEach(function (row, i) { if (row.name === name) idx = i; });
    if (idx === -1) list.push({ name: name, points: 0 });
    else list.splice(idx, 1);
    return list;
  }

  function setCollaboratorPoints(collaborators, name, points) {
    var n = Number(points);
    if (isNaN(n)) n = 0;
    return (collaborators || []).map(function (row) {
      if (row.name !== name) return row;
      return { name: row.name, points: n };
    });
  }

  window.CaseAssigneeUtils = {
    UNASSIGNED_VALUES: UNASSIGNED_VALUES,
    isUnassignedValue: isUnassignedValue,
    getAssignees: getAssignees,
    getFormalAssignees: getFormalAssignees,
    hasFormalAssignee: hasFormalAssignee,
    formatAssignees: formatAssignees,
    getCollaborators: getCollaborators,
    formatCollaborators: formatCollaborators,
    includesAssignee: includesAssignee,
    getPerformanceAssignees: getPerformanceAssignees,
    normalizeRepairCase: normalizeRepairCase,
    sumProcessPoints: sumProcessPoints,
    computeBonusPointsForAssignee: computeBonusPointsForAssignee,
    toggleAssignee: toggleAssignee,
    toggleCollaborator: toggleCollaborator,
    setCollaboratorPoints: setCollaboratorPoints
  };
})();
```

- [ ] **Step 2: 在 `index.html` 插入 script**

於 `src/features/permissions/assignee-utils.js` 下一行加入：

```html
  <script src="src/features/repair/case-assignee-utils.js"></script>
```

- [ ] **Step 3: Console 驗收公式**

開啟 `index.html`，DevTools Console：

```js
var c = {
  assignees: ['A組', 'B組'],
  collaborators: [{ name: 'C組', points: 10 }, { name: 'A組', points: 4 }],
  processRecords: [{ points: 30, qty: 1 }]
};
console.assert(CaseAssigneeUtils.computeBonusPointsForAssignee(c, 'A組') === (30 - 14) / 2 + 4);
console.assert(CaseAssigneeUtils.computeBonusPointsForAssignee(c, 'B組') === (30 - 14) / 2);
console.assert(CaseAssigneeUtils.computeBonusPointsForAssignee(c, 'C組') === 10);
var legacy = CaseAssigneeUtils.normalizeRepairCase({ assignee: 'A組', processRecords: [] });
console.assert(Array.isArray(legacy.assignees) && legacy.assignees[0] === 'A組' && legacy.assignee === undefined);
console.assert(CaseAssigneeUtils.hasFormalAssignee({ assignees: ['案件待辦'] }) === false);
```

Expected: 無 assert 失敗。

---

### Task 2: AssigneeUtils 快照與更名

**Files:**
- Modify: `src/features/permissions/assignee-utils.js`

**Interfaces:**
- Consumes: `CaseAssigneeUtils.getAssignees`, `getFormalAssignees`, `getCollaborators`
- Changes:
  - `buildPerformanceSnapshot(record, assignees)` → 寫入 `performanceAssignees`、`performanceMemberIds` 聯集；相容仍可帶 `performanceAssignee`（第一位正式指派，供舊 UI）
  - `updateAssigneeReferences` 更新叫修 `assignees[]`、`collaborators[].name`、`performanceAssignees[]`
  - `hasOpenCasesForAssignee` 叫修改 `CaseAssigneeUtils.includesAssignee`
  - 新增 `getPerformanceAssignees(record)` 委派 `CaseAssigneeUtils.getPerformanceAssignees`（可選，避免雙入口則直接讓報表用 CaseAssigneeUtils）

- [ ] **Step 1: 改 `buildPerformanceSnapshot`**

```js
  function buildPerformanceSnapshot(record, assignees) {
    var names = (window.CaseAssigneeUtils
      ? CaseAssigneeUtils.getFormalAssignees(record)
      : [(record && record.assignee) || ''].filter(Boolean));
    var memberIds = [];
    (assignees || []).forEach(function (a) {
      if (names.indexOf(a.name) === -1) return;
      getMemberIds(a).forEach(function (id) {
        if (memberIds.indexOf(id) === -1) memberIds.push(id);
      });
    });
    return {
      isPerformanceIncluded: true,
      performanceAssignees: names.slice(),
      performanceAssignee: names[0] || '',
      performanceMemberIds: memberIds
    };
  }
```

- [ ] **Step 2: 改 `hasOpenCasesForAssignee` 叫修判斷**

```js
    if ((cases || []).some(function (c) {
      if (!isRepairCaseOpen(c)) return false;
      if (window.CaseAssigneeUtils) return CaseAssigneeUtils.includesAssignee(c, name);
      return c.assignee === name;
    })) return true;
```

- [ ] **Step 3: 改 `updateAssigneeReferences` 的叫修 map**

```js
    var nextCases = cases.map(function (c) {
      var changed = false;
      var next = Object.assign({}, c);
      if (window.CaseAssigneeUtils) {
        var assignees = CaseAssigneeUtils.getAssignees(c).map(function (n) {
          if (n !== oldName) return n;
          changed = true;
          return newName;
        });
        var collaborators = CaseAssigneeUtils.getCollaborators(c).map(function (row) {
          if (row.name !== oldName) return row;
          changed = true;
          return { name: newName, points: row.points };
        });
        var performanceAssignees = (Array.isArray(c.performanceAssignees)
          ? c.performanceAssignees
          : (c.performanceAssignee ? [c.performanceAssignee] : [])).map(function (n) {
          if (n !== oldName) return n;
          changed = true;
          return newName;
        });
        if (c.assignee === oldName) { next.assignee = newName; changed = true; }
        if (changed) {
          next.assignees = assignees;
          next.collaborators = collaborators;
          next.performanceAssignees = performanceAssignees;
          if (next.performanceAssignee === oldName) next.performanceAssignee = newName;
        }
      } else if (c.assignee === oldName) {
        next.assignee = newName;
        changed = true;
      }
      return changed ? next : c;
    });
```

保養／工程段落維持原樣。

- [ ] **Step 4: Console 快照**

```js
var snap = AssigneeUtils.buildPerformanceSnapshot(
  { assignees: ['A組', 'B組'] },
  [{ id: '1', name: 'A組', memberIds: ['m1'] }, { id: '2', name: 'B組', memberIds: ['m2'] }]
);
console.assert(snap.performanceAssignees.join(',') === 'A組,B組');
console.assert(snap.performanceMemberIds.indexOf('m1') !== -1 && snap.performanceMemberIds.indexOf('m2') !== -1);
```

---

### Task 3: PerformanceUtils 增額積分

**Files:**
- Modify: `src/features/reports/performance-utils.js`

**Interfaces:**
- Consumes: `CaseAssigneeUtils.computeBonusPointsForAssignee`
- Changes: `computeAssigneePerformance` 內叫修 `bonusPoints` 迴圈改呼叫公式（不再 `getPerformanceAssignee === name` 後整案 `sumProcessPoints`）

- [ ] **Step 1: 替換叫修加總區塊**

將：

```js
      var bonusPoints = 0;
      cases.forEach(function (c) {
        if (!c.isPerformanceIncluded) return;
        if (!isServiceLevelCD(c.serviceLevel)) return;
        if (!isDateInRange(getRepairCaseDate(c), quarter.start, quarter.end)) return;
        if (AssigneeUtils.getPerformanceAssignee(c) !== assignee.name) return;
        bonusPoints += sumProcessPoints(c);
      });
```

改為：

```js
      var bonusPoints = 0;
      cases.forEach(function (c) {
        if (!c.isPerformanceIncluded) return;
        if (!isServiceLevelCD(c.serviceLevel)) return;
        if (!isDateInRange(getRepairCaseDate(c), quarter.start, quarter.end)) return;
        bonusPoints += CaseAssigneeUtils.computeBonusPointsForAssignee(c, assignee.name);
      });
```

保養完成店數仍用 `AssigneeUtils.getPerformanceAssignee(c)`（保養維持單字串）。

- [ ] **Step 2: 手動想一組數字**

用 Console 組一筆本季 C／D、已列入績效、雙指派＋協作的 case，呼叫 `PerformanceUtils.computeAssigneePerformance`，確認 A／B／C 的 `bonusPoints` 符合公式。

---

### Task 4: case-status ＋ seed 正規化

**Files:**
- Modify: `src/features/repair/case-status.js`
- Modify: `src/data/seed.js`

- [ ] **Step 1: `hasValidAssignee` 改用 utils**

```js
  function hasValidAssignee(c) {
    if (window.CaseAssigneeUtils) return CaseAssigneeUtils.hasFormalAssignee(c);
    var assignee = c && c.assignee;
    return !!assignee && UNASSIGNED_ASSIGNEES.indexOf(assignee) === -1;
  }
```

（可保留 `UNASSIGNED_ASSIGNEES` 常數作後備，或改讀 `CaseAssigneeUtils.UNASSIGNED_VALUES`。）

- [ ] **Step 2: seed 結尾正規化叫修案**

在 `INITIAL_CASES.forEach` reporter／performance 區塊之後（或整合進既有 forEach）加入：

```js
INITIAL_CASES.forEach(function (c) {
  var normalized = CaseAssigneeUtils.normalizeRepairCase(c);
  Object.keys(c).forEach(function (k) { delete c[k]; });
  Object.assign(c, normalized);
  if (!Array.isArray(c.collaborators)) c.collaborators = [];
  if (c.isPerformanceIncluded && (!c.performanceAssignees || !c.performanceAssignees.length)) {
    c.performanceAssignees = CaseAssigneeUtils.getFormalAssignees(c);
    c.performanceAssignee = c.performanceAssignees[0] || '';
  }
});
```

並刪除或改寫舊的「只補 `performanceAssignee` from `c.assignee`」邏輯，避免與正規化衝突。可另加 1～2 筆示範多指派／協作的 seed（可選）。

- [ ] **Step 3: 重新整理頁面**

Console：`console.assert(Array.isArray(INITIAL_CASES[0].assignees))`

---

### Task 5: 叫修表單（新增／編輯）多選＋協作區塊

**Files:**
- Modify: `src/features/repair/case-form.js`

**Interfaces:**
- Form state: `assignees: []`, `collaborators: []`（無 `assignee`）
- UI helpers（檔內函式即可）:
  - `renderAssigneeMultiSelect(formData, onToggle, className)`
  - `renderCollaboratorSettings(formData, handlers)`

- [ ] **Step 1: AddCaseForm 初始值**

將 `assignee: ''` 改為：

```js
      assignees: [],
      collaborators: [],
```

`handleSubmit` 的 `Object.assign` 改寫：

```js
          isPerformanceIncluded: false,
          performanceAssignees: [],
          performanceAssignee: '',
          performanceMemberIds: [],
```

並確保送出前：

```js
        var payload = CaseAssigneeUtils.normalizeRepairCase(formData);
        var newCase = Object.assign({ /* id, caseNumber... */ }, payload, { /* process defaults */ });
```

- [ ] **Step 2: 指派人員多選 UI（新增＋編輯共用片段）**

以 checkbox 群組取代 `<select name="assignee">`：

```js
function renderAssigneeCheckboxes(formData, rerender, inputClass) {
  var selected = CaseAssigneeUtils.getAssignees(formData);
  return h('div', { className: 'space-y-1 ' + (inputClass || '') },
    ASSIGNEES.map(function (opt) {
      var checked = selected.indexOf(opt) !== -1;
      return h('label', {
        key: opt,
        className: 'flex items-center gap-2 text-sm text-gray-700 cursor-pointer'
      },
        h('input', {
          type: 'checkbox',
          checked: checked,
          onChange: function () {
            formData.assignees = CaseAssigneeUtils.toggleAssignee(selected, opt);
            rerender();
          }
        }),
        opt
      );
    })
  );
}
```

- [ ] **Step 3: 協作人員設定區塊**

放在排程欄位之後（新增表單「排程」區下方；編輯表單案件資料區指派附近或獨立 section）：

```js
function renderCollaboratorSettings(formData, rerender) {
  var selected = CaseAssigneeUtils.getCollaborators(formData);
  var selectedNames = selected.map(function (r) { return r.name; });
  return h('div', { className: 'col-span-full border rounded-md p-3 bg-gray-50 space-y-3' },
    h('div', { className: 'font-semibold text-sm text-blue-800' }, '協作人員設定'),
    h('div', null,
      h('div', { className: 'text-xs text-gray-500 mb-1' }, '協作人員'),
      h('div', { className: 'space-y-1' },
        ASSIGNEES.map(function (opt) {
          var checked = selectedNames.indexOf(opt) !== -1;
          return h('label', {
            key: opt,
            className: 'flex items-center gap-2 text-sm cursor-pointer'
          },
            h('input', {
              type: 'checkbox',
              checked: checked,
              onChange: function () {
                formData.collaborators = CaseAssigneeUtils.toggleCollaborator(selected, opt);
                rerender();
              }
            }),
            opt
          );
        })
      )
    ),
    h('div', null,
      h('div', { className: 'text-xs text-gray-500 mb-1' }, '協作人數'),
      h('div', { className: 'text-sm font-medium' }, String(selected.length))
    ),
    selected.length ? h('div', { className: 'space-y-2' },
      h('div', { className: 'text-xs text-gray-500' }, '協作積分'),
      selected.map(function (row) {
        return h('div', { key: row.name, className: 'flex items-center gap-2' },
          h('span', { className: 'text-sm w-28' }, row.name),
          h('input', {
            type: 'number',
            value: row.points,
            onChange: function (e) {
              formData.collaborators = CaseAssigneeUtils.setCollaboratorPoints(
                selected, row.name, e.target.value
              );
              rerender();
            },
            className: 'w-28 p-2 border rounded-md outline-none'
          })
        );
      })
    ) : null
  );
}
```

- [ ] **Step 4: EditCaseForm 載入時正規化**

```js
    var formData = CaseAssigneeUtils.normalizeRepairCase(
      JSON.parse(JSON.stringify(editingCase))
    );
```

儲存時同樣 `normalizeRepairCase` 後寫回 `setCases`。

- [ ] **Step 5: 瀏覽器驗收**

1. 新增案件：勾兩位指派、兩位協作並填不同積分 → 儲存
2. 編輯同一案：欄位仍在；協作人數正確
3. 協作積分可大於處理總分仍可存

---

### Task 6: 檢視／審核／列表／門市叫修

**Files:**
- Modify: `src/features/repair/case-view.js`
- Modify: `src/features/repair/case-review.js`
- Modify: `src/features/repair/case-list.js`
- Modify: `src/features/repair/case-record.js`
- Modify: `src/features/customer/store-repair-form.js`
- Modify: `src/features/customer/store-history.js`（顯示端：歷史若存合併字串則維持；新寫入用 `formatAssignees`）

- [ ] **Step 1: case-view**

指派欄改：

```js
h(ReadOnlyField, {
  label: '指派人員',
  value: viewingCase && CaseAssigneeUtils.formatAssignees(viewingCase)
}),
```

在案件資料區或獨立 section 加：

```js
h(ReadOnlyField, { label: '協作人數', value: viewingCase ? String(CaseAssigneeUtils.getCollaborators(viewingCase).length) : '0' }),
h(ReadOnlyField, {
  label: '協作人員',
  value: viewingCase && CaseAssigneeUtils.formatCollaborators(viewingCase),
  fullWidth: true
}),
```

- [ ] **Step 2: case-list / case-record / case-review 表格儲存格**

將 `c.assignee` 顯示改 `CaseAssigneeUtils.formatAssignees(c)`。

- [ ] **Step 3: store-repair-form**

與 AddCaseForm 對齊：`assignees`／`collaborators` 多選＋協作區塊；submit 用 `normalizeRepairCase`；歷史紀錄：

```js
assignee: CaseAssigneeUtils.formatAssignees({ assignees: formData.assignees }),
```

- [ ] **Step 4: 瀏覽器驗收**

列表／檢視／審核／門市新增叫修皆顯示多人與協作；審核「列入績效」後 `performanceAssignees` 為陣列。

---

### Task 7: 排程 utils ＋ 案件安排多選

**Files:**
- Modify: `src/features/scheduling/schedule-utils.js`
- Modify: `src/features/scheduling/case-arrangement.js`
- Modify: `src/features/reports/data-retrieval-utils.js`（叫修篩選改 contains）

- [ ] **Step 1: `getRepairSchedule`**

```js
  function getRepairSchedule(c) {
    var assignees = window.CaseAssigneeUtils
      ? CaseAssigneeUtils.getAssignees(c)
      : (c.assignee ? [c.assignee] : []);
    return {
      planDate: c.planDate || c.expectedDate || '',
      planTimeStart: c.planTimeStart || c.expectedTimeStart || '',
      planTimeEnd: c.planTimeEnd || c.expectedTimeEnd || '',
      assignee: window.CaseAssigneeUtils
        ? CaseAssigneeUtils.formatAssignees(c)
        : (c.assignee || ''),
      assignees: assignees,
      workCategory: c.workCategory
    };
  }
```

- [ ] **Step 2: `getPendingCases` 叫修條件**

將「已有指派／非待辦」判斷改為：

```js
      var hasFormal = window.CaseAssigneeUtils
        ? CaseAssigneeUtils.hasFormalAssignee(c)
        : (c.assignee && c.assignee !== '案件待辦');
      if (c.isClosed || hasFormal || sched.planDate) return;
      // push 時 assignee 顯示：
      assignee: window.CaseAssigneeUtils
        ? (CaseAssigneeUtils.formatAssignees(c) || '案件待辦')
        : c.assignee
```

（語意與現況一致：正式指派或已有 planDate 就不在待安排。）

- [ ] **Step 3: `collectScheduledItems` 篩選**

在 `tryPush` 內：

```js
      if (assigneeFilter !== '全部') {
        if (sched.assignees && sched.assignees.length) {
          if (sched.assignees.indexOf(assigneeFilter) === -1) return;
        } else if (sched.assignee !== assigneeFilter) {
          return;
        }
      }
```

（移除舊的單一 `sched.assignee !== assigneeFilter` 行。）

- [ ] **Step 4: case-arrangement 叫修寫回多選**

`scheduleModal` 對 repair：

- 狀態加 `assignees: string[]`（自 record 載入）
- UI：叫修用 checkbox 多選（保養／工程維持單選 `assignee`）
- `confirmScheduleModal`：repair 要求 `assignees.length > 0`；payload：

```js
        var payload = {
          planDate: scheduleModal.planDate,
          planTimeStart: scheduleModal.planTimeStart,
          planTimeEnd: scheduleModal.planTimeEnd,
          assignees: scheduleModal.sourceType === 'repair'
            ? scheduleModal.assignees.slice()
            : undefined,
          assignee: scheduleModal.sourceType === 'repair'
            ? CaseAssigneeUtils.formatAssignees({ assignees: scheduleModal.assignees })
            : scheduleModal.assignee
        };
```

`buildScheduledRecord`：

```js
      if (sourceType === 'repair') {
        merged.assignees = (payload.assignees && payload.assignees.length)
          ? payload.assignees.slice()
          : CaseAssigneeUtils.getAssignees({ assignee: payload.assignee });
        delete merged.assignee;
        // expected* 同步同現況
      } else {
        merged.assignee = payload.assignee;
      }
```

待安排「指派人員」篩選仍單選（用於行政區過濾）；套到叫修時寫入 `assignees: [pendingAssignee]`（可再於 modal 加選）。

- [ ] **Step 5: data-retrieval-utils 叫修篩選**

```js
      if (!isAll(filters.assignee)) {
        var hit = window.CaseAssigneeUtils
          ? CaseAssigneeUtils.includesAssignee(c, filters.assignee)
          : c.assignee === filters.assignee;
        if (!hit) return false;
      }
```

匯出欄「維修人員」改 `CaseAssigneeUtils.formatAssignees(c)`（叫修列）。

- [ ] **Step 6: 瀏覽器驗收排程**

1. 雙指派叫修出現在日曆；篩選其中一人可見
2. 案件安排 modal 可多選指派並寫回
3. 保養安排仍單選、行為不變

---

### Task 8: 端對端手動驗收清單

- [ ] **Step 1: 依序勾選**

| # | 步驟 | 預期 |
|---|------|------|
| 1 | 新增叫修：指派 A+B，協作 C=10、A=4，處理項目合計 30，服務等級 D，完成並列入績效 | 儲存成功 |
| 2 | 案件績效統計（本季） | A≈12、B≈8、C=10（依公式） |
| 3 | 協作合計改為 40（>30）再算 | A／B 剩餘為負且可存；報表反映負值 |
| 4 | 舊 seed 案（原單一字串） | 列表有指派顯示；不爆錯 |
| 5 | 更名指派人員 A組→A組新 | 叫修 assignees／collaborators／performanceAssignees 同步 |
| 6 | 排程篩選 A | 含 A 的多指派案出現 |
| 7 | 保養／工程指派 | 仍單選、無協作區塊 |

- [ ] **Step 2: 若使用者要求再 commit**

建議訊息：

```bash
git add src/features/repair/case-assignee-utils.js index.html \
  src/features/permissions/assignee-utils.js \
  src/features/reports/performance-utils.js \
  src/features/repair/case-status.js src/data/seed.js \
  src/features/repair/case-form.js src/features/repair/case-view.js \
  src/features/repair/case-review.js src/features/repair/case-list.js \
  src/features/repair/case-record.js \
  src/features/customer/store-repair-form.js \
  src/features/customer/store-history.js \
  src/features/scheduling/schedule-utils.js \
  src/features/scheduling/case-arrangement.js \
  src/features/reports/data-retrieval-utils.js
git commit -m "$(cat <<'EOF'
Support multi-assignee and collaborators on repair cases.

EOF
)"
```

---

## Spec coverage (self-review)

| Spec 要求 | Task |
|-----------|------|
| `assignees[]`／`collaborators[]` 真相 | 1, 4, 5 |
| 積分公式與負剩餘 | 1, 3, 8 |
| 協作來源＝完整清單、人數唯讀、各人積分 | 5 |
| 兼任兩邊 | 1, 8 |
| 新增／編輯／檢視／審核 | 5, 6 |
| 列表／歷史／匯出 | 6, 7 |
| 排程篩選包含、安排多選 | 7 |
| 舊資料遷移、seed | 1, 4 |
| 更名連動 | 2 |
| 績效快照 `performanceAssignees` | 2, 6 |
| 保養／工程不改多指派 | 7, 8 |

無 TBD／placeholder；介面名稱前後一致（`CaseAssigneeUtils.*`）。
