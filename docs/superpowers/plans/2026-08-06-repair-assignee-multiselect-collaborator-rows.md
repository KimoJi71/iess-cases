# 叫修指派下拉複選 ＋ 協作列 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把叫修的「指派人員」從 checkbox 清單改成下拉式複選 selector（收合顯示 chips），並把「協作人員設定」改成可多筆的（協作人員／協作人數／協作積分）組合列。

**Architecture:** 新增一個受控的 `IESS.MultiSelect` 核心元件（比照既有 `src/core/searchable-select.js`：IIFE、`IESS.h`／`IESS.stateful`、選單以 portal 掛在 `document.body` 並 fixed 定位）。協作資料由 `{name, points}` 擴充為 `{name, count, points}`，`count` 只是紀錄、不進積分公式。指派與協作兩個表單欄位抽成共用模組 `src/features/repair/case-assignee-fields.js`，供叫修表單與門市叫修表單共用，避免現有的複製貼上。

**Tech Stack:** 無建置工具的瀏覽器端 ES5 風格 JavaScript（IIFE ＋ 全域 `window.*`）、自製 `IESS.h` 真實 DOM 建構器、Tailwind CDN ＋ `styles.css` 自訂類別、Node 腳本 `scripts/verify-repair-multi-assignee.mjs` 以 `node:vm` 載入 IIFE 做自動驗證。

## Global Constraints

- 規格文件：`docs/superpowers/specs/2026-08-06-repair-assignee-multiselect-collaborator-rows-design.md`。
- 全部程式碼維持 ES5 風格（`var`、`function`，不要 `let`/`const`/箭頭函式/樣板字串），與周圍檔案一致。`scripts/*.mjs` 例外，該檔本來就是現代 Node ESM。
- 新的核心元件必須用 IIFE 包起來並掛在 `window.IESS.*`，不得使用 `import`/`export`。
- 新檔案要加進 `index.html` 的 `<script>` 清單，且順序必須在其相依檔案之後。
- 積分公式不得改動：`share = (Σ processRecords.points × qty − Σ collaborators.points) ÷ 正式指派人數`；`count` 不進公式。
- 協作人數預設值為 `1`；非正整數（缺值、0、負數、NaN）於讀取時一律正規化為 `1`。
- 同一位協作人員不可同時出現在兩列（UI 端阻擋），但讀取舊資料時不強制合併同名列。
- 驗證指令一律為：`node scripts/verify-repair-multi-assignee.mjs`（於 repo 根目錄執行）。
- 每個 Task 結束都要 commit，commit message 用英文祈使句，結尾附上：
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```

## File Structure

| 檔案 | 職責 | 動作 |
|------|------|------|
| `src/features/repair/case-assignee-utils.js` | 叫修指派／協作的資料正規化、列操作、積分計算 | 修改 |
| `src/features/permissions/assignee-utils.js` | 指派人員更名時同步各案件的參考 | 修改（保留 `count`） |
| `src/core/multi-select.js` | 通用受控下拉複選元件 `IESS.MultiSelect` | 新增 |
| `styles.css` | `.multi-select*` 樣式 | 修改 |
| `index.html` | 載入新的 script | 修改 |
| `src/features/repair/case-assignee-fields.js` | 共用表單欄位：指派複選、協作列 → `window.CaseAssigneeFields` | 新增 |
| `src/features/repair/case-form.js` | 叫修新增／編輯表單改用共用欄位 | 修改 |
| `src/features/customer/store-repair-form.js` | 門市叫修表單改用共用欄位（刪除本地複本） | 修改 |
| `src/features/scheduling/case-arrangement.js` | 排程 Modal 的叫修指派改用 `IESS.MultiSelect` | 修改 |
| `scripts/verify-repair-multi-assignee.mjs` | 自動驗證 | 修改（新增測試） |

---

### Task 1: 協作列資料模型（`count` ＋ 列操作 helper）

**Files:**
- Modify: `src/features/repair/case-assignee-utils.js:46-62`（`getCollaborators`、`formatCollaborators`）與 `:150-176`（新 helper ＋ export）
- Test: `scripts/verify-repair-multi-assignee.mjs`

**Interfaces:**
- Consumes: 無（第一個 Task）
- Produces（掛在 `window.CaseAssigneeUtils`）:
  - `getCollaborators(record) → Array<{ name: string, count: number, points: number }>`（過濾掉 `name` 為空的列；`count` 正規化為正整數，預設 1）
  - `formatCollaborators(record) → string`（例：`'B組（2人／10分）、C組（1人／5分）'`；無資料回 `'—'`）
  - `addCollaboratorRow(collaborators) → Array`（附加 `{ name: '', count: 1, points: 0 }`，不變動輸入）
  - `updateCollaboratorRow(collaborators, index, patch) → Array`（不變動輸入）
  - `removeCollaboratorRow(collaborators, index) → Array`（不變動輸入）
  - `getAvailableCollaboratorNames(collaborators, index, allNames) → string[]`（排除其他列已選的名稱，保留本列現值）

- [ ] **Step 1: 寫失敗的測試**

在 `scripts/verify-repair-multi-assignee.mjs` 中，於 `testPerformanceReport` 函式**之後**、`function main()` **之前**，加入這個函式：

```js
function testCollaboratorRows(CAU) {
  console.log('\n7. Collaborator rows (name / count / points)');

  const c = makeRepairCase({
    collaborators: [
      { name: 'C組', count: 2, points: 10 },
      { name: 'A組', count: 3, points: 4 },
    ],
  });
  assertApprox(CAU.computeBonusPointsForAssignee(c, 'A組'), 12, 'count does not change A組 bonus');
  assertApprox(CAU.computeBonusPointsForAssignee(c, 'B組'), 8, 'count does not change B組 bonus');
  assertApprox(CAU.computeBonusPointsForAssignee(c, 'C組'), 10, 'count does not change C組 bonus');

  assertEq(CAU.getCollaborators({ collaborators: [{ name: 'C組', points: 10 }] })[0].count, 1, 'legacy row without count → 1');
  assertEq(CAU.getCollaborators({ collaborators: [{ name: 'C組', count: 0, points: 1 }] })[0].count, 1, 'count 0 → 1');
  assertEq(CAU.getCollaborators({ collaborators: [{ name: 'C組', count: 2.7, points: 1 }] })[0].count, 2, 'count 2.7 → 2');
  assertEq(CAU.getCollaborators({ collaborators: [{ name: '', count: 2, points: 5 }] }).length, 0, 'blank name row filtered out');

  assertEq(
    CAU.formatCollaborators({
      collaborators: [
        { name: 'B組', count: 2, points: 10 },
        { name: 'C組', points: 5 },
      ],
    }),
    'B組（2人／10分）、C組（1人／5分）',
    'formatCollaborators output'
  );
  assertEq(CAU.formatCollaborators({ collaborators: [] }), '—', 'formatCollaborators empty → —');

  const base = [{ name: 'B組', count: 2, points: 10 }];
  const added = CAU.addCollaboratorRow(base);
  assertEq(added.length, 2, 'addCollaboratorRow appends a row');
  assertEq(added[1].name, '', 'new row has blank name');
  assertEq(added[1].count, 1, 'new row count defaults to 1');
  assertEq(added[1].points, 0, 'new row points defaults to 0');
  assertEq(base.length, 1, 'addCollaboratorRow does not mutate input');

  const updated = CAU.updateCollaboratorRow(added, 1, { name: 'C組', points: 5 });
  assertEq(updated[1].name, 'C組', 'updateCollaboratorRow sets name');
  assertEq(updated[1].points, 5, 'updateCollaboratorRow sets points');
  assertEq(updated[1].count, 1, 'updateCollaboratorRow keeps untouched count');
  assertEq(updated[0].name, 'B組', 'updateCollaboratorRow leaves other rows');
  assertEq(added[1].name, '', 'updateCollaboratorRow does not mutate input');

  const removed = CAU.removeCollaboratorRow(updated, 0);
  assertEq(removed.length, 1, 'removeCollaboratorRow drops the row');
  assertEq(removed[0].name, 'C組', 'removeCollaboratorRow keeps the rest');
  assertEq(updated.length, 2, 'removeCollaboratorRow does not mutate input');

  const all = ['A組', 'B組', 'C組'];
  assertEq(
    JSON.stringify(CAU.getAvailableCollaboratorNames(updated, 0, all)),
    JSON.stringify(['A組', 'B組']),
    'row 0 options exclude other rows picks, keep own'
  );
  assertEq(
    JSON.stringify(CAU.getAvailableCollaboratorNames(updated, 1, all)),
    JSON.stringify(['A組', 'C組']),
    'row 1 options exclude B組'
  );
}
```

並在 `main()` 內 `testPerformanceReport(PU);` 那一行的**下一行**加入：

```js
  testCollaboratorRows(CAU);
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node scripts/verify-repair-multi-assignee.mjs`
Expected: FAIL — 出現 `TypeError: CAU.addCollaboratorRow is not a function`（腳本會直接拋錯中止，這是預期的）。

- [ ] **Step 3: 實作**

在 `src/features/repair/case-assignee-utils.js`，把現有的 `getCollaborators` 與 `formatCollaborators`（第 46–62 行）整段換成：

```js
  function normalizeCollaboratorCount(value) {
    var n = Math.floor(Number(value));
    return n > 0 ? n : 1;
  }

  function getCollaborators(record) {
    if (!record || !Array.isArray(record.collaborators)) return [];
    return record.collaborators.map(function (row) {
      return {
        name: String((row && row.name) || ''),
        count: normalizeCollaboratorCount(row && row.count),
        points: Number(row && row.points) || 0
      };
    }).filter(function (row) { return !!row.name; });
  }

  function formatCollaborators(record) {
    var list = getCollaborators(record);
    if (!list.length) return '—';
    return list.map(function (row) {
      return row.name + '（' + row.count + '人／' + row.points + '分）';
    }).join('、');
  }
```

接著在 `setCollaboratorPoints` 函式（現第 150–157 行）之後、`window.CaseAssigneeUtils = {` 之前，加入：

```js
  function addCollaboratorRow(collaborators) {
    return (collaborators || []).slice().concat([{ name: '', count: 1, points: 0 }]);
  }

  function updateCollaboratorRow(collaborators, index, patch) {
    return (collaborators || []).map(function (row, i) {
      if (i !== index) return row;
      return Object.assign({ name: '', count: 1, points: 0 }, row, patch || {});
    });
  }

  function removeCollaboratorRow(collaborators, index) {
    return (collaborators || []).filter(function (row, i) { return i !== index; });
  }

  function getAvailableCollaboratorNames(collaborators, index, allNames) {
    var taken = (collaborators || []).map(function (row, i) {
      return i === index ? '' : String((row && row.name) || '');
    });
    return (allNames || []).filter(function (name) {
      return taken.indexOf(name) === -1;
    });
  }
```

最後在 `window.CaseAssigneeUtils = { ... }` 物件中，於 `setCollaboratorPoints: setCollaboratorPoints` 那一行後面補上（記得前一行要有逗號）：

```js
    addCollaboratorRow: addCollaboratorRow,
    updateCollaboratorRow: updateCollaboratorRow,
    removeCollaboratorRow: removeCollaboratorRow,
    getAvailableCollaboratorNames: getAvailableCollaboratorNames,
```

- [ ] **Step 4: 執行測試確認通過**

Run: `node scripts/verify-repair-multi-assignee.mjs`
Expected: PASS — 最後一行為 `Results: N passed, 0 failed`，且輸出包含 `7. Collaborator rows (name / count / points)` 區段全數 `✓`。

- [ ] **Step 5: Commit**

```bash
git add src/features/repair/case-assignee-utils.js scripts/verify-repair-multi-assignee.mjs
git commit -m "$(cat <<'EOF'
Add collaborator count field and row helpers.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 指派人員更名時保留協作人數

**Files:**
- Modify: `src/features/permissions/assignee-utils.js:141-145`
- Test: `scripts/verify-repair-multi-assignee.mjs`（既有的 `testRenameReferences`）

**Interfaces:**
- Consumes: Task 1 的 `CaseAssigneeUtils.getCollaborators(record)`（回傳含 `count` 的列）
- Produces: `AssigneeUtils.updateAssigneeReferences(oldName, newName, cases, maintenanceCases, projectCases)` 更名後的 `collaborators[]` 保留原本的 `count`

- [ ] **Step 1: 寫失敗的測試**

在 `scripts/verify-repair-multi-assignee.mjs` 的 `testRenameReferences` 中，把 `cases` 裡的 collaborators 改成帶 `count`：

```js
      collaborators: [
        { name: 'A組', count: 3, points: 4 },
        { name: 'C組', count: 2, points: 10 },
      ],
```

並在 `assertEq(u.collaborators[1].name, 'C組', 'other collaborator unchanged');` 之後加入：

```js
  assertEq(u.collaborators[0].count, 3, 'renamed collaborator keeps count');
  assertEq(u.collaborators[0].points, 4, 'renamed collaborator keeps points');
  assertEq(u.collaborators[1].count, 2, 'untouched collaborator keeps count');
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node scripts/verify-repair-multi-assignee.mjs`
Expected: FAIL — `✗ renamed collaborator keeps count — expected 3, got undefined`，結尾 `Results: N passed, 1 failed` 且 exit code 為 1。

- [ ] **Step 3: 實作**

在 `src/features/permissions/assignee-utils.js`，把：

```js
          return { name: newName, points: row.points };
```

改為：

```js
          return { name: newName, count: row.count, points: row.points };
```

- [ ] **Step 4: 執行測試確認通過**

Run: `node scripts/verify-repair-multi-assignee.mjs`
Expected: PASS — `Results: N passed, 0 failed`。

- [ ] **Step 5: Commit**

```bash
git add src/features/permissions/assignee-utils.js scripts/verify-repair-multi-assignee.mjs
git commit -m "$(cat <<'EOF'
Preserve collaborator count when renaming assignees.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `IESS.MultiSelect` 下拉複選元件

**Files:**
- Create: `src/core/multi-select.js`
- Modify: `styles.css`（檔尾附加樣式）
- Modify: `index.html:20`（在 `searchable-select.js` 之後加入 script）

**Interfaces:**
- Consumes: `IESS.h`、`IESS.stateful`、`IESS.Icons.ChevronDown`（皆已存在於 `src/core/dom.js`、`src/core/icons.js`）
- Produces: `window.IESS.MultiSelect(props) → DOM node`
  - `props.id: string` — 全域唯一的欄位識別字串。**必填**：父層 rerender 會重建元件實例，元件靠這個 id 判斷「我剛剛是展開的」而保持展開。
  - `props.options: string[]` — 可選項目
  - `props.value: string[]` — 已選項目（受控）
  - `props.onChange: function (nextValues: string[])` — 每次勾選／取消／移除 chip 都以完整新陣列呼叫
  - `props.placeholder?: string` — 預設 `'請選擇'`
  - `props.disabled?: boolean`
  - `props.className?: string` — 附加在最外層 `.multi-select` 上

**背景說明（實作者必讀）：** 本專案的 `IESS.h` 直接建立真實 DOM，`IESS.stateful(build)` 的 `rerender()` 會整段重建子樹。三個呼叫端的 `onChange` 都會觸發**父層**的 `rerender()`，也就是說每選一項，`MultiSelect` 實例就會被丟棄並重建。因此「是否展開」不能存在實例變數裡，必須存在模組層級並以 `props.id` 比對；展開中的選單也做成模組層級的單一 portal 元素，避免舊實例留下孤兒節點。

- [ ] **Step 1: 建立元件**

建立 `src/core/multi-select.js`：

```js
/*
 * core/multi-select.js — 下拉式複選選單（收合時於欄位內以 chips 顯示已選項目）
 *
 * MultiSelect({ id, options, value, onChange, placeholder, disabled, className })
 *   id       全域唯一字串；父層 rerender 重建元件後仍能維持展開狀態
 *   options  string[] 可選項目
 *   value    string[] 已選項目（受控，元件不保存資料）
 *   onChange function (nextValues)
 *
 * 選單以 portal 掛在 document.body 並 fixed 定位，避免被外層 overflow 裁切
 * （與 core/searchable-select.js 相同策略）。同一時間只會有一個選單展開。
 */
(function (global) {
  'use strict';

  var h = global.IESS.h;
  var stateful = global.IESS.stateful;

  var openId = null;
  var menuEl = null;
  var listeners = null;
  var autoIdSeq = 0;

  function renderChevron(className) {
    var Icons = global.IESS.Icons;
    if (Icons && Icons.ChevronDown) return Icons.ChevronDown({ className: className });
    return null;
  }

  function destroyMenu() {
    if (listeners) {
      window.removeEventListener('scroll', listeners.reposition, true);
      window.removeEventListener('resize', listeners.reposition);
      document.removeEventListener('mousedown', listeners.outside, true);
      document.removeEventListener('keydown', listeners.key, true);
      listeners = null;
    }
    if (menuEl && menuEl.parentNode) menuEl.parentNode.removeChild(menuEl);
    menuEl = null;
  }

  function MultiSelect(props) {
    autoIdSeq += 1;
    var id = props.id || ('multi-select-' + autoIdSeq);
    var rootEl = null;
    var controlEl = null;

    return stateful(function (rerender) {
      var options = props.options || [];
      var value = (props.value || []).map(String);
      var disabled = !!props.disabled;
      var placeholder = props.placeholder || '請選擇';
      var className = props.className || '';
      var onChange = props.onChange;

      function isOpen() {
        return openId === id;
      }

      function emit(next) {
        if (disabled || !onChange) return;
        onChange(next);
      }

      function toggleOption(opt) {
        var next = value.slice();
        var idx = next.indexOf(opt);
        if (idx === -1) next.push(opt);
        else next.splice(idx, 1);
        emit(next);
      }

      function removeOption(opt) {
        emit(value.filter(function (v) { return v !== opt; }));
      }

      function positionMenu() {
        if (!menuEl || !controlEl) return;
        var rect = controlEl.getBoundingClientRect();
        menuEl.style.top = (rect.bottom + 2) + 'px';
        menuEl.style.left = rect.left + 'px';
        menuEl.style.width = rect.width + 'px';
      }

      function closeMenu() {
        openId = null;
        destroyMenu();
        rerender();
      }

      function buildMenu() {
        menuEl = document.createElement('ul');
        menuEl.className = 'multi-select__menu';
        menuEl.setAttribute('role', 'listbox');
        menuEl.setAttribute('aria-multiselectable', 'true');
        document.body.appendChild(menuEl);

        listeners = {
          reposition: function () { if (isOpen()) positionMenu(); },
          outside: function (e) {
            if (menuEl && menuEl.contains(e.target)) return;
            if (rootEl && rootEl.contains(e.target)) return;
            closeMenu();
          },
          key: function (e) {
            if (e.key === 'Escape') closeMenu();
          }
        };
        window.addEventListener('scroll', listeners.reposition, true);
        window.addEventListener('resize', listeners.reposition);
        document.addEventListener('mousedown', listeners.outside, true);
        document.addEventListener('keydown', listeners.key, true);

        positionMenu();

        if (!options.length) {
          var empty = document.createElement('li');
          empty.className = 'multi-select__empty';
          empty.textContent = '無可選項目';
          menuEl.appendChild(empty);
          return;
        }

        options.forEach(function (opt) {
          var checked = value.indexOf(opt) !== -1;
          var item = document.createElement('li');
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.setAttribute('role', 'option');
          btn.setAttribute('aria-selected', checked ? 'true' : 'false');
          btn.className = 'multi-select__option' + (checked ? ' multi-select__option--selected' : '');

          var box = document.createElement('span');
          box.className = 'multi-select__checkbox' + (checked ? ' multi-select__checkbox--checked' : '');
          box.textContent = checked ? '✓' : '';
          btn.appendChild(box);
          btn.appendChild(document.createTextNode(opt));

          btn.addEventListener('mousedown', function (e) {
            e.preventDefault();
            e.stopPropagation();
            toggleOption(opt);
          });

          item.appendChild(btn);
          menuEl.appendChild(item);
        });
      }

      // 只有「目前展開且已掛載到文件」的實例才重建選單，
      // 避免被丟棄的舊實例把新實例的選單關掉或定位到已卸載的節點。
      function syncMenu() {
        if (!isOpen()) return;
        if (!controlEl || !document.body.contains(controlEl)) return;
        if (disabled) { closeMenu(); return; }
        destroyMenu();
        buildMenu();
      }

      function handleControlClick(e) {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        if (isOpen()) {
          closeMenu();
          return;
        }
        destroyMenu();
        openId = id;
        rerender();
      }

      var node = h('div', {
        className: 'multi-select ' + className,
        ref: function (el) { rootEl = el; }
      },
        h('div', {
          className: 'multi-select__control' + (disabled ? ' multi-select__control--disabled' : ''),
          role: 'combobox',
          'aria-expanded': isOpen() ? 'true' : 'false',
          tabIndex: disabled ? -1 : 0,
          ref: function (el) { controlEl = el; },
          onClick: handleControlClick,
          onKeyDown: function (e) {
            if (e.key === 'Enter' || e.key === ' ') handleControlClick(e);
          }
        },
          h('div', { className: 'multi-select__chips' },
            value.length
              ? value.map(function (opt) {
                  return h('span', { className: 'multi-select__chip' },
                    opt,
                    disabled ? null : h('button', {
                      type: 'button',
                      className: 'multi-select__chip-remove',
                      'aria-label': '移除 ' + opt,
                      'data-no-tooltip': true,
                      onMouseDown: function (e) { e.preventDefault(); e.stopPropagation(); },
                      onClick: function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        removeOption(opt);
                      }
                    }, '×')
                  );
                })
              : h('span', { className: 'multi-select__placeholder' }, placeholder)
          ),
          renderChevron('multi-select__chevron' + (isOpen() ? ' multi-select__chevron--open' : ''))
        )
      );

      // 節點要等父層插入 DOM 後才量得到位置，故延到下一個 tick 再同步選單
      setTimeout(syncMenu, 0);

      return node;
    });
  }

  global.IESS = global.IESS || {};
  global.IESS.MultiSelect = MultiSelect;
})(window);
```

- [ ] **Step 2: 加入樣式**

在 `styles.css` 檔案**最後**附加：

```css
/* ===== Multi Select ===== */
.multi-select {
  position: relative;
  width: 100%;
}

.multi-select__control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 2.625rem;
  padding: 0.375rem 0.625rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: #fff;
  cursor: pointer;
}

.multi-select__control:focus {
  outline: none;
  border-color: #3b82f6;
}

.multi-select__control--disabled {
  background: #f9fafb;
  cursor: not-allowed;
}

.multi-select__chips {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: 0.25rem;
  min-width: 0;
}

.multi-select__placeholder {
  color: #9ca3af;
  font-size: 0.875rem;
}

.multi-select__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 0.8125rem;
}

.multi-select__chip-remove {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 0.9375rem;
  line-height: 1;
  cursor: pointer;
}

.multi-select__chevron {
  flex: 0 0 auto;
  width: 1rem;
  height: 1rem;
  color: #6b7280;
  transition: transform 0.15s ease;
}

.multi-select__chevron--open {
  transform: rotate(180deg);
}

.multi-select__menu {
  position: fixed;
  z-index: 100;
  max-height: 16rem;
  overflow-y: auto;
  margin: 0;
  padding: 0.25rem 0;
  list-style: none;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
}

.multi-select__option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 0;
  background: transparent;
  color: #374151;
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.multi-select__option:hover {
  background: #eff6ff;
  color: #1d4ed8;
}

.multi-select__option--selected {
  font-weight: 600;
}

.multi-select__checkbox {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  border: 1px solid #9ca3af;
  border-radius: 0.1875rem;
  font-size: 0.75rem;
  line-height: 1;
}

.multi-select__checkbox--checked {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.multi-select__empty {
  padding: 0.75rem;
  color: #9ca3af;
  text-align: center;
  font-size: 0.875rem;
}
```

- [ ] **Step 3: 載入 script**

在 `index.html` 第 20 行 `<script src="src/core/searchable-select.js"></script>` 的**下一行**插入：

```html
  <script src="src/core/multi-select.js"></script>
```

- [ ] **Step 4: 語法檢查**

Run: `node --check src/core/multi-select.js`
Expected: 無輸出（exit code 0）。

- [ ] **Step 5: Commit**

```bash
git add src/core/multi-select.js styles.css index.html
git commit -m "$(cat <<'EOF'
Add IESS.MultiSelect dropdown multi-select component.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 共用欄位模組 ＋ 叫修新增／編輯表單

**Files:**
- Create: `src/features/repair/case-assignee-fields.js`
- Modify: `index.html`（在 `src/features/repair/case-assignee-utils.js` 那一行之後加入 script）
- Modify: `src/features/repair/case-form.js:57-126`（刪除本地的 `renderAssigneeMultiSelect` 與 `renderCollaboratorSettings`）、`:318-354`（新增表單呼叫端）、`:613-650` 一帶（編輯表單呼叫端）

**Interfaces:**
- Consumes:
  - Task 1 的 `CaseAssigneeUtils.getAssignees / getCollaborators / addCollaboratorRow / updateCollaboratorRow / removeCollaboratorRow / getAvailableCollaboratorNames`
  - Task 3 的 `IESS.MultiSelect({ id, options, value, onChange, placeholder, disabled, className })`
  - 全域 `ASSIGNEES: string[]`（`src/data/options.js`）
- Produces: `window.CaseAssigneeFields`
  - `renderAssigneeMultiSelect(formData, onChange, options) → DOM node`
    - `onChange: function (nextAssignees: string[])`
    - `options: { id: string, className?: string, disabled?: boolean }`
  - `renderCollaboratorSettings(formData, handlers) → DOM node`
    - `handlers.onAddRow: function ()`
    - `handlers.onUpdateRow: function (index: number, patch: object)`
    - `handlers.onRemoveRow: function (index: number)`

- [ ] **Step 1: 建立共用欄位模組**

建立 `src/features/repair/case-assignee-fields.js`：

```js
/*
 * features/repair/case-assignee-fields.js — 叫修表單共用欄位
 *
 * 指派人員：下拉複選（IESS.MultiSelect）
 * 協作人員設定：可多筆的（協作人員／協作人數／協作積分）組合列
 *
 * 由 case-form.js（新增／編輯）與 store-repair-form.js（門市叫修）共用。
 */
(function () {
  'use strict';
  var h = IESS.h;

  function renderAssigneeMultiSelect(formData, onChange, options) {
    var opts = options || {};
    return IESS.MultiSelect({
      id: opts.id,
      options: ASSIGNEES,
      value: CaseAssigneeUtils.getAssignees(formData),
      onChange: onChange,
      placeholder: '請選擇指派人員',
      disabled: !!opts.disabled,
      className: opts.className || ''
    });
  }

  function renderCollaboratorRow(rows, row, index, handlers) {
    var nameOptions = CaseAssigneeUtils.getAvailableCollaboratorNames(rows, index, ASSIGNEES);
    return h('div', {
      className: 'grid grid-cols-1 sm:grid-cols-[1fr_6rem_6rem_2.5rem] gap-2 items-center'
    },
      h('select', {
        value: row.name || '',
        onChange: function (e) { handlers.onUpdateRow(index, { name: e.target.value }); },
        className: 'w-full p-2 border rounded-md outline-none bg-white'
      },
        h('option', { value: '' }, '請選擇'),
        nameOptions.map(function (opt) {
          return h('option', { key: opt, value: opt }, opt);
        })
      ),
      h('input', {
        type: 'number',
        min: '1',
        value: row.count == null ? 1 : row.count,
        onChange: function (e) { handlers.onUpdateRow(index, { count: e.target.value }); },
        className: 'w-full p-2 border rounded-md outline-none'
      }),
      h('input', {
        type: 'number',
        value: row.points == null ? 0 : row.points,
        onChange: function (e) { handlers.onUpdateRow(index, { points: e.target.value }); },
        className: 'w-full p-2 border rounded-md outline-none'
      }),
      h('button', {
        type: 'button',
        'aria-label': '刪除此協作',
        onClick: function () { handlers.onRemoveRow(index); },
        className: 'p-2 text-red-500 hover:bg-red-50 rounded-md'
      }, '×')
    );
  }

  function renderCollaboratorSettings(formData, handlers) {
    var rows = Array.isArray(formData.collaborators) ? formData.collaborators : [];
    var isFull = rows.length >= ASSIGNEES.length;
    return h('div', { className: 'col-span-full border rounded-md p-3 bg-gray-50 space-y-3' },
      h('div', { className: 'font-semibold text-sm text-blue-800' }, '協作人員設定'),
      rows.length
        ? h('div', { className: 'space-y-2' },
            h('div', {
              className: 'hidden sm:grid sm:grid-cols-[1fr_6rem_6rem_2.5rem] gap-2 text-xs text-gray-500'
            },
              h('div', null, '協作人員'),
              h('div', null, '協作人數'),
              h('div', null, '協作積分'),
              h('div', null, '')
            ),
            rows.map(function (row, index) {
              return renderCollaboratorRow(rows, row, index, handlers);
            })
          )
        : h('div', { className: 'text-xs text-gray-400' }, '尚未新增協作'),
      h('button', {
        type: 'button',
        disabled: isFull,
        onClick: function () { handlers.onAddRow(); },
        className: 'px-3 py-1.5 text-sm border rounded-md ' + (isFull
          ? 'text-gray-400 border-gray-200 cursor-not-allowed'
          : 'text-blue-600 border-blue-300 hover:bg-blue-50')
      }, '＋ 新增協作')
    );
  }

  window.CaseAssigneeFields = {
    renderAssigneeMultiSelect: renderAssigneeMultiSelect,
    renderCollaboratorSettings: renderCollaboratorSettings
  };
})();
```

- [ ] **Step 2: 載入 script**

在 `index.html` 的 `<script src="src/features/repair/case-assignee-utils.js"></script>`（約第 35 行）**下一行**插入：

```html
  <script src="src/features/repair/case-assignee-fields.js"></script>
```

- [ ] **Step 3: 移除 case-form.js 的本地欄位實作**

在 `src/features/repair/case-form.js` 中，把第 57–126 行的 `function renderAssigneeMultiSelect(...) { ... }` 與 `function renderCollaboratorSettings(...) { ... }` **整段刪除**，改為：

```js
  var renderAssigneeMultiSelect = CaseAssigneeFields.renderAssigneeMultiSelect;
  var renderCollaboratorSettings = CaseAssigneeFields.renderCollaboratorSettings;
```

- [ ] **Step 4: 改寫新增表單的呼叫端**

在 `src/features/repair/case-form.js` 的 `AddCaseForm` 中，把指派人員那段（原第 320–322 行）：

```js
      }, "指派人員"), renderAssigneeMultiSelect(formData, function (selected, opt) {
        formData.assignees = CaseAssigneeUtils.toggleAssignee(selected, opt);
        rerender();
      })), h("div", null, h("label", {
```

改為：

```js
      }, "指派人員"), renderAssigneeMultiSelect(formData, function (next) {
        formData.assignees = next;
        rerender();
      }, { id: 'add-case-assignees' })), h("div", null, h("label", {
```

再把協作那段（原第 345–354 行）：

```js
      })), renderCollaboratorSettings(formData, {
        onToggle: function (selected, opt) {
          formData.collaborators = CaseAssigneeUtils.toggleCollaborator(selected, opt);
          rerender();
        },
        onPointsChange: function (selected, name, points) {
          formData.collaborators = CaseAssigneeUtils.setCollaboratorPoints(selected, name, points);
          rerender();
        }
      }))), h("div", {
```

改為：

```js
      })), renderCollaboratorSettings(formData, {
        onAddRow: function () {
          formData.collaborators = CaseAssigneeUtils.addCollaboratorRow(formData.collaborators);
          rerender();
        },
        onUpdateRow: function (index, patch) {
          formData.collaborators = CaseAssigneeUtils.updateCollaboratorRow(formData.collaborators, index, patch);
          rerender();
        },
        onRemoveRow: function (index) {
          formData.collaborators = CaseAssigneeUtils.removeCollaboratorRow(formData.collaborators, index);
          rerender();
        }
      }))), h("div", {
```

- [ ] **Step 5: 改寫編輯表單的呼叫端**

`EditCaseForm` 的結構與 `AddCaseForm` 略有不同（label 用 `h("span")`、括號層數也不同），請照下面的原文替換。

把原第 614–617 行：

```js
      }, "指派人員"), renderAssigneeMultiSelect(formData, function (selected, opt) {
        formData.assignees = CaseAssigneeUtils.toggleAssignee(selected, opt);
        rerender();
      })), h("div", null, h("span", {
```

改為：

```js
      }, "指派人員"), renderAssigneeMultiSelect(formData, function (next) {
        formData.assignees = next;
        rerender();
      }, { id: 'edit-case-assignees' })), h("div", null, h("span", {
```

把原第 639–648 行：

```js
      })), renderCollaboratorSettings(formData, {
        onToggle: function (selected, opt) {
          formData.collaborators = CaseAssigneeUtils.toggleCollaborator(selected, opt);
          rerender();
        },
        onPointsChange: function (selected, name, points) {
          formData.collaborators = CaseAssigneeUtils.setCollaboratorPoints(selected, name, points);
          rerender();
        }
      })), h("div", {
```

改為：

```js
      })), renderCollaboratorSettings(formData, {
        onAddRow: function () {
          formData.collaborators = CaseAssigneeUtils.addCollaboratorRow(formData.collaborators);
          rerender();
        },
        onUpdateRow: function (index, patch) {
          formData.collaborators = CaseAssigneeUtils.updateCollaboratorRow(formData.collaborators, index, patch);
          rerender();
        },
        onRemoveRow: function (index) {
          formData.collaborators = CaseAssigneeUtils.removeCollaboratorRow(formData.collaborators, index);
          rerender();
        }
      })), h("div", {
```

- [ ] **Step 6: 語法檢查與回歸測試**

Run: `node --check src/features/repair/case-assignee-fields.js && node --check src/features/repair/case-form.js && node scripts/verify-repair-multi-assignee.mjs`
Expected: 兩個 `--check` 無輸出，驗證腳本結尾 `Results: N passed, 0 failed`。

- [ ] **Step 7: 手動驗證**

以瀏覽器開啟 `index.html`（例如 `python3 -m http.server` 後開 `http://localhost:8000/`），進入「案件處理 → 新增叫修」，確認：

1. 「指派人員」是一個收合的欄位，點一下展開清單，項目左側有勾選方塊。
2. 勾選 2 位人員後**選單仍保持展開**（不會選一個就關閉）；欄位內出現 2 個 chips。
3. 點選單外部或按 Esc 可關閉；chip 上的 `×` 可單獨移除該人員。
4. 「協作人員設定」預設顯示「尚未新增協作」與「＋ 新增協作」。
5. 按「＋ 新增協作」出現一列，人數預設 1、積分預設 0；選了 B組 之後，再新增一列時該列的人員下拉**不再出現 B組**。
6. `×` 可刪除該列；人員數量選滿時「＋ 新增協作」變灰不可按。
7. 儲存後回列表，開啟「檢視」，協作欄顯示如 `B組（2人／10分）`。
8. 對同一筆按「編輯」，指派 chips 與協作列都正確帶回。

- [ ] **Step 8: Commit**

```bash
git add src/features/repair/case-assignee-fields.js src/features/repair/case-form.js index.html
git commit -m "$(cat <<'EOF'
Use multi-select and collaborator rows in repair case form.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 門市叫修表單改用共用欄位

**Files:**
- Modify: `src/features/customer/store-repair-form.js:12-81`（刪除本地複本）、`:246-266`（呼叫端）

**Interfaces:**
- Consumes: Task 4 的 `CaseAssigneeFields.renderAssigneeMultiSelect / renderCollaboratorSettings`、Task 1 的列操作 helper
- Produces: 無新介面

- [ ] **Step 1: 移除本地欄位實作**

在 `src/features/customer/store-repair-form.js` 中，把第 12–81 行的 `function renderAssigneeMultiSelect(...) { ... }` 與 `function renderCollaboratorSettings(...) { ... }` **整段刪除**，改為：

```js
  var renderAssigneeMultiSelect = CaseAssigneeFields.renderAssigneeMultiSelect;
  var renderCollaboratorSettings = CaseAssigneeFields.renderCollaboratorSettings;
```

- [ ] **Step 2: 改寫呼叫端**

把原第 246–249 行的指派人員呼叫：

```js
                renderAssigneeMultiSelect(formData, function (selected, opt) {
                  formData.assignees = CaseAssigneeUtils.toggleAssignee(selected, opt);
                  rerender();
                })
```

改為：

```js
                renderAssigneeMultiSelect(formData, function (next) {
                  formData.assignees = next;
                  rerender();
                }, { id: 'store-repair-assignees' })
```

把原第 260–266 行的協作 handlers：

```js
                onToggle: function (selected, opt) {
                  formData.collaborators = CaseAssigneeUtils.toggleCollaborator(selected, opt);
                  rerender();
                },
                onPointsChange: function (selected, name, points) {
                  formData.collaborators = CaseAssigneeUtils.setCollaboratorPoints(selected, name, points);
                  rerender();
                }
```

改為：

```js
                onAddRow: function () {
                  formData.collaborators = CaseAssigneeUtils.addCollaboratorRow(formData.collaborators);
                  rerender();
                },
                onUpdateRow: function (index, patch) {
                  formData.collaborators = CaseAssigneeUtils.updateCollaboratorRow(formData.collaborators, index, patch);
                  rerender();
                },
                onRemoveRow: function (index) {
                  formData.collaborators = CaseAssigneeUtils.removeCollaboratorRow(formData.collaborators, index);
                  rerender();
                }
```

- [ ] **Step 3: 語法檢查與回歸測試**

Run: `node --check src/features/customer/store-repair-form.js && node scripts/verify-repair-multi-assignee.mjs`
Expected: `--check` 無輸出，驗證腳本 `Results: N passed, 0 failed`。

- [ ] **Step 4: 手動驗證**

瀏覽器開啟 `index.html` → 客戶管理 → 門市管理 → 編輯任一門市 → 右上「新增叫修單」，確認：

1. 「指派人員」為下拉複選，展開後可連續勾選多位，chips 正常顯示與移除。
2. 「協作人員設定」可新增／刪除多列，人員不重複，人數與積分可輸入。
3. 填必要欄位後儲存成功，回到案件列表可看到該筆，指派人員欄以「、」串接多位。

- [ ] **Step 5: Commit**

```bash
git add src/features/customer/store-repair-form.js
git commit -m "$(cat <<'EOF'
Reuse shared assignee fields in store repair form.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 案件安排排程 Modal 的指派複選

**Files:**
- Modify: `src/features/scheduling/case-arrangement.js:412-429`（新增 `setScheduleModalAssignees`）、`:507-534`（`renderScheduleAssigneeEditor` 的叫修分支）

**Interfaces:**
- Consumes: Task 3 的 `IESS.MultiSelect`
- Produces: 無新對外介面（僅頁面內部函式 `setScheduleModalAssignees(next: string[])`）

- [ ] **Step 1: 新增 setter**

在 `src/features/scheduling/case-arrangement.js` 的 `toggleScheduleModalAssignee` 函式（第 412–429 行）**之後**加入：

```js
      function setScheduleModalAssignees(next) {
        if (!scheduleModal) return;
        var list = (next || []).slice();
        scheduleModal = Object.assign({}, scheduleModal, {
          assignee: list[0] || '',
          assignees: list
        });
        rerender();
      }
```

（保留 `toggleScheduleModalAssignee`：日曆其他流程仍在使用。若實作後 `node --check` 通過但你確認整份檔案已無任何呼叫端，可一併刪除該函式。）

- [ ] **Step 2: 換掉 checkbox 群組**

在 `renderScheduleAssigneeEditor` 的叫修分支中，把原第 517–531 行：

```js
              h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-2' },
                ASSIGNEES.map(function (opt) {
                  return h('label', {
                    key: opt,
                    className: 'flex items-center gap-2 text-sm text-gray-700 cursor-pointer'
                  },
                    h('input', {
                      type: 'checkbox',
                      checked: selected.indexOf(opt) !== -1,
                      onChange: function () { toggleScheduleModalAssignee(opt); }
                    }),
                    opt
                  );
                })
              )
```

改為：

```js
              IESS.MultiSelect({
                id: 'schedule-modal-assignees',
                options: ASSIGNEES,
                value: selected,
                onChange: setScheduleModalAssignees,
                placeholder: '請選擇指派人員'
              })
```

- [ ] **Step 3: 語法檢查與回歸測試**

Run: `node --check src/features/scheduling/case-arrangement.js && node scripts/verify-repair-multi-assignee.mjs`
Expected: `--check` 無輸出，驗證腳本 `Results: N passed, 0 failed`。

- [ ] **Step 4: 手動驗證**

瀏覽器開啟 `index.html` → 排程管理 → 案件安排，確認：

1. 左側查詢出待安排的叫修案件，點一筆開啟排程 Modal。
2. 「指派人員」為下拉複選，展開後連續勾選 2 位不會自動收合；上方摘要文字同步更新。
3. Modal 內容區可捲動時，選單仍跟著欄位定位、不被裁切。
4. 儲存排程後，日曆事件標題顯示 2 位人員以「、」串接。
5. 對已排程的叫修事件再次開啟編輯，指派 chips 正確帶回。

- [ ] **Step 5: Commit**

```bash
git add src/features/scheduling/case-arrangement.js
git commit -m "$(cat <<'EOF'
Use multi-select for repair assignees in schedule modal.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## 完成後的整體驗收

- `node scripts/verify-repair-multi-assignee.mjs` 全綠。
- 三處指派人員皆為下拉複選並可保持展開連選。
- 協作可多筆（人員／人數／積分），人員不重複，人數不影響積分。
- 舊資料（協作列無 `count`）讀取後顯示為 1 人，績效報表數字與改版前一致。
