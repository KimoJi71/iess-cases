# 案件銷案審核：退回案件 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在「案件銷案審核」列表新增「退回案件」操作，審核人員填寫必填的退回原因後案件回到原本的處理列表，並在該列表顯示退回原因。

**Architecture:** 退回是「反向結案」——把 `isClosed` 設回 `false`，案件因而自動離開審核列表（審核列表的篩選條件就是 `isClosed && !isPerformanceIncluded`），並回到來源列表。退回原因以 `returnReason` / `returnedAt` 兩個欄位存在案件物件上，覆蓋式（只留最新一筆），再次結案時不清除。叫修案件走 `setCases`，保養案件走 `setMaintenanceCases`，以列表既有的 `sourceType` 判斷。

**Tech Stack:** 原生 ES5 瀏覽器 JS，IIFE 模組掛 `window.*`，自製 `IESS.h` / `IESS.stateful` 渲染（React-like createElement API，回傳真實 DOM 節點），Tailwind class 字串。驗證用 headless Chrome + CDP 的 `.mjs` 腳本，無測試框架。

**Spec:** `docs/superpowers/specs/2026-08-07-case-review-return-design.md`

## Global Constraints

- 全部 `src/**/*.js` 用 ES5 語法：`var`、`function`、`Object.assign`。**禁止** `let`/`const`/箭頭函式/樣板字串/展開運算子。（例外：`scripts/*.mjs` 是 Node ESM，可用現代語法。）
- 每個 `src/**/*.js` 都是 `(function () { 'use strict'; ... })();` IIFE，結尾掛 `window.XXX = ...`。
- 新欄位名稱固定為 `returnReason`（string）與 `returnedAt`（string，值來自 `IESS.caseDateTime.now()`），**不得**改名。
- 退回原因採覆蓋式：再次退回直接覆寫，再次結案時**不清除**。
- seed 資料**不**預設這兩個欄位；未退回過的案件為 `undefined`，顯示時 fallback 為 `'—'`。
- UI 文案一律繁體中文。toast 文字固定為 `'案件已退回'`。
- 本計畫不新增 `src/` 檔案，因此不需要動 `index.html`。
- 每個 Task 結束都要 commit，commit message 用英文祈使句。

## File Structure

| 檔案 | 責任 | 動作 |
|---|---|---|
| `src/core/icons.js` | 內嵌 SVG 圖示 | 新增 `Undo` |
| `src/features/repair/case-review.js` | 銷案審核列表 | 新增退回按鈕、退回 Modal、退回寫入邏輯 |
| `src/features/repair/case-list.js` | 案件處理列表（叫修） | 新增「退回原因」欄、修正 colspan |
| `src/features/repair/maintenance.js` | 保養計劃進度列表 | 新增「退回原因」欄、更新 colspan |
| `scripts/verify-case-return.mjs` | headless 驗證腳本 | 新建，三個 Task 逐步擴充 |

---

### Task 1: 新增 `Undo` 圖示與驗證腳本骨架

這個 Task 建立後續兩個 Task 共用的 headless 驗證腳本，並補上退回按鈕需要的圖示。專案沒有測試框架，`scripts/*.mjs` 就是唯一的驗證手段：啟動 headless Chrome、載入 `index.html`（所有模組以 `<script>` 依序掛上 `window`），再用 CDP `Runtime.evaluate` 直接呼叫元件函式、對回傳的真實 DOM 節點做斷言。

**Files:**
- Modify: `src/core/icons.js:41`（`Menu` 那行之後，`};` 之前）
- Test: `scripts/verify-case-return.mjs`（新建）

**Interfaces:**
- Produces: `IESS.Icons.Undo(props)` → `<svg>` 節點，用法同其他圖示（`Icons.Undo({ className: 'h-4 w-4' })`）

- [ ] **Step 1: 建立驗證腳本骨架與第一個斷言**

建立 `scripts/verify-case-return.mjs`。前半段的 CDP driver 直接照抄 `scripts/verify-equipment-level-ui.mjs` 第 1–90 行的模式（`spawn` Chrome、輪詢 `/json/list`、開 WebSocket、`send()` / `evaluate()` 兩個 helper、蒐集 `consoleErrors`）。完整內容如下：

```js
#!/usr/bin/env node
/**
 * Executed UI verification for the 退回案件 feature.
 * Launches headless Chrome, loads index.html, renders the real components
 * (IESS.h returns real DOM nodes), then asserts on the rendered output.
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
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-return-check-profile',
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

  console.log('page load');
  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');

  console.log('\nIcons.Undo');
  assertEq(await evaluate('typeof IESS.Icons.Undo'), 'function', 'Icons.Undo 已定義');
  assertEq(
    await evaluate(`IESS.Icons.Undo({ className: 'h-4 w-4' }).tagName`),
    'svg', 'Icons.Undo 回傳 svg 節點'
  );
  assertTrue(
    await evaluate(`IESS.Icons.Undo({ className: 'h-4 w-4' }).querySelectorAll('path').length > 0`),
    'Icons.Undo 含 path'
  );

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

- [ ] **Step 2: 執行驗證腳本，確認失敗**

Run: `node scripts/verify-case-return.mjs`
Expected: FAIL — `Icons.Undo 已定義 — expected "function", got "undefined"`

（若出現「找不到 Chrome」而 exit code 2，請用 `CHROME_PATH=<你的 Chrome 路徑> node scripts/verify-case-return.mjs`。）

- [ ] **Step 3: 新增圖示**

在 `src/core/icons.js` 的圖示字典中，`Menu` 那一行之後加入（注意前一行結尾要補逗號）：

```js
    Undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>'
```

- [ ] **Step 4: 執行驗證腳本，確認通過**

Run: `node scripts/verify-case-return.mjs`
Expected: PASS — 全部斷言通過，`0 failed`

- [ ] **Step 5: Commit**

```bash
git add src/core/icons.js scripts/verify-case-return.mjs
git commit -m "Add Undo icon and verification harness for case return."
```

---

### Task 2: 銷案審核列表的退回按鈕與 Modal

`CaseReviewList` 已經把叫修案件與保養案件合併成一份 `allReviewCases`，保養案件被標上 `sourceType: 'maintenance'`（見 `case-review.js:52-54`）。退回時就用這個標記決定要呼叫 `setMaintenanceCases` 還是 `setCases`。

**Files:**
- Modify: `src/features/repair/case-review.js:41`（`includeConfirmModal` 宣告處）、`:66-80`（`handleIncludePerformance` 之後）、`:142-150`（列入績效按鈕之後）、`:170-196`（`includeConfirmModal` Modal 之後）
- Test: `scripts/verify-case-return.mjs`（擴充）

**Interfaces:**
- Consumes: `IESS.Icons.Undo`（Task 1）、既有的 `IESS.iconActionBtn({ label, icon, onClick, className })`、`IESS.caseDateTime.now()`
- Produces: 退回後寫入案件物件的欄位組合——叫修為 `{ isClosed:false, isListClosed:false, closeDate:'', returnReason, returnedAt }`，保養為 `{ isClosed:false, closeDate:'', returnReason, returnedAt }`。Task 3 的列表欄位讀 `returnReason` / `returnedAt`。

- [ ] **Step 1: 加入失敗的驗證斷言**

在 `scripts/verify-case-return.mjs` 的 `assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');` **之前**插入下列區塊。它把 `CaseReviewList` 渲染出來、用假的 `setCases` / `setMaintenanceCases` 捕捉寫回的資料，再模擬點擊：

```js
  console.log('\n銷案審核 — 退回按鈕與 Modal');
  await evaluate(`
    window.__mkReview = function (extra) {
      var repairCase = { id: 'R1', caseNumber: '20260807001', customerName: '測試客戶',
        storeName: '測試門市', serviceLevel: 'A', workCategory: '一般叫修', repairItem: '冷氣',
        repairReason: '不冷', actualReason: '缺冷媒', isClosed: true, isListClosed: true,
        processStatus: '轉原廠', closeDate: '2026-08-07 10:00', repairDate: '2026-08-07' };
      var maintCase = { id: 'M1', caseNumber: '20260807002', customerName: '保養客戶',
        storeName: '保養門市', serviceLevel: 'B', status: '已完成', isClosed: true,
        closeDate: '2026-08-07 11:00', repairDate: '2026-08-07', planDate: '2026-08-07' };
      window.__written = { cases: null, maintenanceCases: null, toast: null };
      var node = CaseReviewList(Object.assign({
        cases: [repairCase],
        setCases: function (next) { window.__written.cases = next; },
        maintenanceCases: [maintCase],
        setMaintenanceCases: function (next) { window.__written.maintenanceCases = next; },
        assignees: [],
        setViewingCase: function () {},
        setView: function () {},
        showToast: function (msg) { window.__written.toast = msg; }
      }, extra || {}));
      document.body.appendChild(node);
      return node;
    };
    window.__findReturnBtn = function (node, caseNumber) {
      var rows = Array.prototype.slice.call(node.querySelectorAll('tbody tr'));
      var row = rows.filter(function (tr) { return tr.textContent.indexOf(caseNumber) !== -1; })[0];
      if (!row) return null;
      return row.querySelector('button[aria-label="退回案件"]');
    };
    'ok'`);

  const btnCheck = await evaluate(`(function(){
    var node = window.__mkReview();
    var btn = window.__findReturnBtn(node, '20260807001');
    var maintBtn = window.__findReturnBtn(node, '20260807002');
    var result = { hasRepairBtn: !!btn, hasMaintBtn: !!maintBtn,
      modalBefore: !!node.querySelector('textarea[name="returnReason"]') };
    node.remove();
    return result;
  })()`);
  assertTrue(btnCheck.hasRepairBtn, '叫修案件列有「退回案件」按鈕');
  assertTrue(btnCheck.hasMaintBtn, '保養案件列有「退回案件」按鈕');
  assertEq(btnCheck.modalBefore, false, '未點擊時不顯示退回 Modal');

  const modalCheck = await evaluate(`(function(){
    var node = window.__mkReview();
    window.__findReturnBtn(node, '20260807001').click();
    var ta = document.body.querySelector('textarea[name="returnReason"]');
    var confirmBtn = Array.prototype.slice.call(document.body.querySelectorAll('button'))
      .filter(function (b) { return b.textContent.trim() === '確認退回'; })[0];
    var result = {
      hasTextarea: !!ta,
      disabledWhenEmpty: !!(confirmBtn && confirmBtn.disabled),
      wrote: !!window.__written.cases
    };
    if (confirmBtn) confirmBtn.click();
    result.wroteAfterEmptyClick = !!window.__written.cases;
    document.body.innerHTML = '';
    return result;
  })()`);
  assertTrue(modalCheck.hasTextarea, '點擊後出現退回原因 textarea');
  assertTrue(modalCheck.disabledWhenEmpty, '原因空白時「確認退回」為 disabled');
  assertEq(modalCheck.wroteAfterEmptyClick, false, '空白原因不會寫入資料');

  console.log('\n銷案審核 — 退回叫修案件');
  const repairReturn = await evaluate(`(function(){
    var node = window.__mkReview();
    window.__findReturnBtn(node, '20260807001').click();
    var ta = document.body.querySelector('textarea[name="returnReason"]');
    ta.value = '  金額有誤，請重填  ';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    var confirmBtn = Array.prototype.slice.call(document.body.querySelectorAll('button'))
      .filter(function (b) { return b.textContent.trim() === '確認退回'; })[0];
    var wasDisabled = confirmBtn.disabled;
    confirmBtn.click();
    var written = window.__written.cases && window.__written.cases[0];
    var result = {
      enabledWhenFilled: !wasDisabled,
      isClosed: written && written.isClosed,
      isListClosed: written && written.isListClosed,
      closeDate: written && written.closeDate,
      reason: written && written.returnReason,
      hasReturnedAt: !!(written && written.returnedAt),
      processStatus: written && written.processStatus,
      maintenanceUntouched: window.__written.maintenanceCases === null,
      toast: window.__written.toast
    };
    document.body.innerHTML = '';
    return result;
  })()`);
  assertTrue(repairReturn.enabledWhenFilled, '填入原因後「確認退回」可點擊');
  assertEq(repairReturn.isClosed, false, '叫修案件 isClosed 設回 false');
  assertEq(repairReturn.isListClosed, false, '叫修案件 isListClosed 設回 false');
  assertEq(repairReturn.closeDate, '', '叫修案件 closeDate 清空');
  assertEq(repairReturn.reason, '金額有誤，請重填', '退回原因已 trim 並寫入');
  assertTrue(repairReturn.hasReturnedAt, 'returnedAt 已寫入', repairReturn.hasReturnedAt);
  assertEq(repairReturn.processStatus, '轉原廠', 'processStatus 不變');
  assertTrue(repairReturn.maintenanceUntouched, '未誤動保養案件集');
  assertEq(repairReturn.toast, '案件已退回', 'toast 文字正確');

  console.log('\n銷案審核 — 退回保養案件');
  const maintReturn = await evaluate(`(function(){
    var node = window.__mkReview();
    window.__findReturnBtn(node, '20260807002').click();
    var ta = document.body.querySelector('textarea[name="returnReason"]');
    ta.value = '保養照片未附';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    Array.prototype.slice.call(document.body.querySelectorAll('button'))
      .filter(function (b) { return b.textContent.trim() === '確認退回'; })[0].click();
    var written = window.__written.maintenanceCases && window.__written.maintenanceCases[0];
    var result = {
      isClosed: written && written.isClosed,
      closeDate: written && written.closeDate,
      reason: written && written.returnReason,
      status: written && written.status,
      repairUntouched: window.__written.cases === null
    };
    document.body.innerHTML = '';
    return result;
  })()`);
  assertEq(maintReturn.isClosed, false, '保養案件 isClosed 設回 false');
  assertEq(maintReturn.closeDate, '', '保養案件 closeDate 清空');
  assertEq(maintReturn.reason, '保養照片未附', '保養退回原因已寫入');
  assertEq(maintReturn.status, '已完成', '保養狀態維持「已完成」，可再次結案');
  assertTrue(maintReturn.repairUntouched, '未誤動叫修案件集');
```

- [ ] **Step 2: 執行驗證腳本，確認失敗**

Run: `node scripts/verify-case-return.mjs`
Expected: FAIL — `叫修案件列有「退回案件」按鈕`（`__findReturnBtn` 回傳 null）等多項失敗

- [ ] **Step 3: 新增 Modal 狀態變數**

在 `src/features/repair/case-review.js` 的 `includeConfirmModal` 宣告（第 41 行）之後加入：

```js
    var returnModal = { show: false, caseId: null, sourceType: 'repair', reason: '' };
```

- [ ] **Step 4: 新增退回處理函式**

在 `handleIncludePerformance` 函式（結束於第 80 行）之後、`return h('div', ...)` 之前加入：

```js
      function resetReturnModal() {
        returnModal = { show: false, caseId: null, sourceType: 'repair', reason: '' };
      }

      function handleReturnCase() {
        var reason = String(returnModal.reason || '').trim();
        if (!reason) return;
        var caseId = returnModal.caseId;
        var stamp = IESS.caseDateTime.now();

        if (returnModal.sourceType === 'maintenance') {
          setMaintenanceCases(maintenanceCases.map(function (c) {
            if (c.id !== caseId) return c;
            return Object.assign({}, c, {
              isClosed: false,
              closeDate: '',
              returnReason: reason,
              returnedAt: stamp
            });
          }));
        } else {
          setCases(cases.map(function (c) {
            if (c.id !== caseId) return c;
            return Object.assign({}, c, {
              isClosed: false,
              isListClosed: false,
              closeDate: '',
              returnReason: reason,
              returnedAt: stamp
            });
          }));
        }

        resetReturnModal();
        showToast('案件已退回');
      }
```

（不必在最後呼叫 `rerender()`——`setCases` / `setMaintenanceCases` 會觸發全域重繪，這與既有的 `handleIncludePerformance` 一致。）

- [ ] **Step 5: 新增退回按鈕**

在「列入案件績效」的 `iconActionBtn(...)`（結束於第 150 行）之後、包住它們的 `h('div', ...)` 收尾之前加入（記得前一個 `iconActionBtn` 後要補逗號）：

```js
                      iconActionBtn({ label: '退回案件', onClick: function () {
                          returnModal = {
                            show: true,
                            caseId: c.id,
                            sourceType: isMaintenance ? 'maintenance' : 'repair',
                            reason: ''
                          };
                          rerender();
                        },
                        className: 'p-1.5 text-red-600 hover:bg-red-100 rounded', icon: Icons.Undo({ className: 'h-4 w-4' }) })
```

- [ ] **Step 6: 新增退回 Modal**

在 `includeConfirmModal.show && h('div', ...)` 整段（結束於第 196 行）之後加入，作為最外層 `h('div', ...)` 的另一個 child（前面要補逗號）：

```js
        returnModal.show && h('div', {
          className: 'app-modal-overlay'
        },
          h('div', { className: 'bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4' },
            h('div', { className: 'flex items-center space-x-3 text-red-600 mb-4' },
              Icons.Undo({ className: 'h-6 w-6' }),
              h('h3', { className: 'text-lg font-bold text-gray-800' }, '退回案件')
            ),
            h('p', { className: 'text-gray-600 mb-4' },
              '退回後案件將回到原處理列表，請填寫退回原因。'),
            h('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, '退回原因'),
            h('textarea', {
              name: 'returnReason',
              value: returnModal.reason,
              onChange: function (e) { returnModal.reason = e.target.value; rerender(); },
              rows: 4,
              placeholder: '請說明退回原因…',
              className: 'w-full p-2 border rounded-md outline-none mb-6'
            }),
            h('div', { className: 'flex justify-end space-x-3' },
              h('button', {
                type: 'button',
                onClick: function () {
                  resetReturnModal();
                  rerender();
                },
                className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
              }, '取消'),
              h('button', {
                type: 'button',
                disabled: !String(returnModal.reason || '').trim(),
                onClick: handleReturnCase,
                className: 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors ' +
                  'disabled:bg-gray-300 disabled:cursor-not-allowed'
              }, '確認退回')
            )
          )
        )
```

- [ ] **Step 7: 執行驗證腳本，確認通過**

Run: `node scripts/verify-case-return.mjs`
Expected: PASS — 全部斷言通過，`0 failed`

- [ ] **Step 8: Commit**

```bash
git add src/features/repair/case-review.js scripts/verify-case-return.mjs
git commit -m "Add return-case action with required reason to review list."
```

---

### Task 3: 兩個目的地列表顯示「退回原因」

退回後叫修案件回到 `CaseList`（`isClosed=false` 即符合 `isActiveInList`），保養案件回到 `MaintenanceList`（篩選條件 `if (c.isClosed) return false;`）。兩處都在表格最後加一欄顯示原因。`case-list.js` 的空資料列 `colspan` 目前是 10，但表頭實際有 11 欄——這是既有的少算，加欄後一併修正為 12。

**Files:**
- Modify: `src/features/repair/case-list.js:208`（表頭「案件狀態」那行之後）、`:213`（colspan）、`:243-251`（列尾 `<td>` 之後）
- Modify: `src/features/repair/maintenance.js:208-210`（表頭「保養人員」之後）、`:214`（colspan）、`:271`（列尾 `c.assignee` 那個 `<td>` 之後）
- Test: `scripts/verify-case-return.mjs`（擴充）

**Interfaces:**
- Consumes: Task 2 寫入的 `returnReason` / `returnedAt`
- Produces: 無（終端顯示）

- [ ] **Step 1: 加入失敗的驗證斷言**

在 `scripts/verify-case-return.mjs` 的 `assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');` **之前**插入：

```js
  console.log('\n案件處理列表 — 退回原因欄');
  const caseListCheck = await evaluate(`(function(){
    var node = CaseList({
      cases: [
        { id: 'R1', caseNumber: '20260807001', customerName: '測試客戶', storeName: '測試門市',
          workCategory: '一般叫修', repairItem: '冷氣', repairReason: '不冷', faultDesc: '不冷',
          isClosed: false, createdAt: '2026-08-07 09:00',
          returnReason: '金額有誤，請重填', returnedAt: '2026-08-07 12:00' },
        { id: 'R2', caseNumber: '20260807003', customerName: '測試客戶', storeName: '測試門市',
          workCategory: '一般叫修', repairItem: '冷氣', repairReason: '不冷', faultDesc: '漏水',
          isClosed: false, createdAt: '2026-08-07 08:00' }
      ],
      setCases: function () {}, stores: [], setStores: function () {},
      setEditingCase: function () {}, setView: function () {}, showToast: function () {},
      statusFilter: '未處理', setStatusFilter: function () {}
    });
    var ths = Array.prototype.map.call(node.querySelectorAll('thead th'), function (t) { return t.textContent.trim(); });
    var rows = Array.prototype.map.call(node.querySelectorAll('tbody tr'), function (tr) {
      var tds = tr.querySelectorAll('td');
      var last = tds[tds.length - 1];
      return { text: tr.textContent, last: last.textContent.trim(), title: last.getAttribute('title') || '' };
    });
    return { ths: ths, rows: rows };
  })()`);
  assertEq(caseListCheck.ths[caseListCheck.ths.length - 1], '退回原因', '案件處理列表最後一欄為「退回原因」');
  const returnedRow = caseListCheck.rows.filter(r => r.text.indexOf('20260807001') !== -1)[0];
  const cleanRow = caseListCheck.rows.filter(r => r.text.indexOf('20260807003') !== -1)[0];
  assertEq(returnedRow.last, '金額有誤，請重填', '已退回案件顯示退回原因');
  assertEq(returnedRow.title, '2026-08-07 12:00 金額有誤，請重填', 'title 含退回時間與原因');
  assertEq(cleanRow.last, '—', '未退回案件顯示破折號');

  console.log('\n保養計劃進度 — 退回原因欄');
  const maintListCheck = await evaluate(`(function(){
    var node = MaintenanceList({
      cases: [
        { id: 'M1', caseNumber: '20260807002', customerName: '保養客戶', storeName: '保養門市',
          serviceLevel: 'B', status: '已完成', workCategory: '保養', assignee: '王小明',
          isClosed: false, planDate: '2026-08-07', dueMonth: '2026-08',
          returnReason: '保養照片未附', returnedAt: '2026-08-07 13:00' },
        { id: 'M2', caseNumber: '20260807004', customerName: '保養客戶', storeName: '保養門市',
          serviceLevel: 'B', status: '未保養', workCategory: '保養', assignee: '王小明',
          isClosed: false, planDate: '2026-08-07', dueMonth: '2026-08' }
      ],
      setCases: function () {}, stores: [], setStores: function () {}, customers: [],
      setViewingCase: function () {}, setEditingCase: function () {},
      setView: function () {}, showToast: function () {}
    });
    var ths = Array.prototype.map.call(node.querySelectorAll('thead th'), function (t) { return t.textContent.trim(); });
    var rows = Array.prototype.map.call(node.querySelectorAll('tbody tr'), function (tr) {
      var tds = tr.querySelectorAll('td');
      var last = tds[tds.length - 1];
      return { text: tr.textContent, last: last.textContent.trim(), title: last.getAttribute('title') || '' };
    });
    return { ths: ths, rows: rows };
  })()`);
  assertEq(maintListCheck.ths[maintListCheck.ths.length - 1], '退回原因', '保養列表最後一欄為「退回原因」');
  const maintReturnedRow = maintListCheck.rows.filter(r => r.text.indexOf('20260807002') !== -1)[0];
  const maintCleanRow = maintListCheck.rows.filter(r => r.text.indexOf('20260807004') !== -1)[0];
  assertEq(maintReturnedRow.last, '保養照片未附', '已退回保養單顯示退回原因');
  assertEq(maintReturnedRow.title, '2026-08-07 13:00 保養照片未附', 'title 含退回時間與原因');
  assertEq(maintCleanRow.last, '—', '未退回保養單顯示破折號');
```

- [ ] **Step 2: 執行驗證腳本，確認失敗**

Run: `node scripts/verify-case-return.mjs`
Expected: FAIL — `案件處理列表最後一欄為「退回原因」— expected "退回原因", got "案件狀態"`

- [ ] **Step 3: `case-list.js` 加欄**

在 `src/features/repair/case-list.js` 表頭「案件狀態」那行（第 208 行）之後補逗號並加入：

```js
                h('th', { className: 'p-3 font-semibold' }, '退回原因')
```

在列尾「案件狀態」的 `<td>`（結束於第 251 行）之後補逗號並加入：

```js
                  h('td', {
                    className: 'p-3 max-w-[150px] truncate',
                    title: c.returnReason ? ((c.returnedAt ? c.returnedAt + ' ' : '') + c.returnReason) : ''
                  }, c.returnReason || '—')
```

同時把第 213 行的 `colspan: 10` 改成 `colspan: 12`。

- [ ] **Step 4: `maintenance.js` 加欄**

在 `src/features/repair/maintenance.js` 表頭「保養人員」那個 `<th>`（第 208-210 行）之後加入（沿用該檔案的排版風格）：

```js
      }, "保養人員"), h("th", {
        className: "p-3 font-semibold"
      }, "退回原因"))), h("tbody", {
```

即把原本的 `}, "保養人員"))), h("tbody", {` 換成上面三行。

在列尾 `c.assignee` 的 `<td>`（第 271 行）之後加入，把 `}, c.assignee));` 換成：

```js
        }, c.assignee), h("td", {
          className: "p-3 max-w-[150px] truncate",
          title: c.returnReason ? ((c.returnedAt ? c.returnedAt + ' ' : '') + c.returnReason) : ''
        }, c.returnReason || '—'));
```

同時把第 214 行的 `colspan: "12"` 改成 `colspan: "13"`。

- [ ] **Step 5: 執行驗證腳本，確認通過**

Run: `node scripts/verify-case-return.mjs`
Expected: PASS — 全部斷言通過，`0 failed`

- [ ] **Step 6: 加入「再次結案後原因保留」的斷言**

案件被退回後承辦人再次結案，`returnReason` 必須留著。在同一個位置（`assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');` 之前）加入：

```js
  console.log('\n再次結案後退回原因保留');
  const recloseCheck = await evaluate(`(function(){
    var written = null;
    var node = CaseList({
      cases: [{ id: 'R1', caseNumber: '20260807001', customerName: '測試客戶',
        storeName: '測試門市', workCategory: '一般叫修', repairItem: '冷氣',
        repairReason: '不冷', faultDesc: '不冷', isClosed: false, processStatus: '案件完成',
        createdAt: '2026-08-07 09:00',
        returnReason: '金額有誤，請重填', returnedAt: '2026-08-07 12:00' }],
      setCases: function (next) { written = next; },
      stores: [], setStores: function () {},
      setEditingCase: function () {}, setView: function () {}, showToast: function () {},
      statusFilter: '案件完成', setStatusFilter: function () {}
    });
    document.body.appendChild(node);
    var closeBtn = node.querySelector('button[aria-label="案件結案"]');
    if (!closeBtn) { node.remove(); return { found: false }; }
    closeBtn.click();
    var confirmBtn = Array.prototype.slice.call(document.body.querySelectorAll('button'))
      .filter(function (b) { return b.textContent.trim() === '確認'; })[0];
    confirmBtn.click();
    var result = { found: true, isClosed: written && written[0].isClosed,
      reason: written && written[0].returnReason };
    document.body.innerHTML = '';
    return result;
  })()`);
  assertTrue(recloseCheck.found, '「案件完成」狀態的案件有「案件結案」按鈕');
  assertEq(recloseCheck.isClosed, true, '再次結案成功');
  assertEq(recloseCheck.reason, '金額有誤，請重填', '再次結案後 returnReason 仍保留');
```

- [ ] **Step 7: 執行驗證腳本，確認通過**

Run: `node scripts/verify-case-return.mjs`
Expected: PASS — 全部斷言通過，`0 failed`。這段不需要改任何 `src/` 程式碼（`handleCloseCase` 用 `Object.assign` 複製既有欄位，本來就會保留）；若失敗代表結案邏輯把欄位清掉了，需回頭檢查 `case-list.js:74-99`。

- [ ] **Step 8: Commit**

```bash
git add src/features/repair/case-list.js src/features/repair/maintenance.js scripts/verify-case-return.mjs
git commit -m "Show return reason in case and maintenance lists."
```

---

## 完成後的驗證

Run: `node scripts/verify-case-return.mjs`
Expected: 全部斷言通過，`0 failed`

另外手動確認一次（雙擊 `index.html`）：戰情室 → 維修服務 → 案件銷案審核 → 對任一案件按紅色退回圖示 → 空白時按鈕不可點 → 填原因確認 → 案件離開審核列表 → 到「案件處理」或「保養計劃進度」看到該案件與退回原因。
