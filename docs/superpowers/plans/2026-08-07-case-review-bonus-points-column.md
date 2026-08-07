# 案件銷案審核「總積分」欄位 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在「案件銷案審核」列表加一個「總積分」欄，只對增額任務顯示整案總積分，其餘留空。

**Architecture:** 不新增判定或計算邏輯。判定沿用 `PerformanceUtils.isBonusEligible()`，加總沿用 `PerformanceUtils.sumProcessPoints()`；在 `case-review.js` 加一個區域函式把兩者串起來，並在表格插入一欄。`CaseReviewList` 需補 `deviceCategories` prop 才能判定設備等級。

**Tech Stack:** 純瀏覽器端 ES5 風格 JavaScript，無建置工具、無框架（`IESS.h` 直接回傳真實 DOM 節點）、無測試框架。驗證以 `scripts/` 既有的 headless Chrome CDP 腳本模式進行。

## Global Constraints

- 檔案一律 ES5 風格（`var`、`function`），包在 IIFE 內，與周邊程式碼一致。不使用 `let`/`const`/箭頭函式/樣板字串於 `src/` 下。
- 不改動案件存檔結構，不新增持久化欄位。
- 不改動 `performance-utils.js`、`case-assignee-utils.js`、`buildPerformanceSnapshot`，以及退回案件／列入績效的既有行為。
- 欄位名稱固定為 `總積分`。
- 「非增額任務」顯示空字串 `''`；「是增額任務但總分為 0」顯示 `'0'`。兩者必須可區分。
- 保養計劃案件（`sourceType === 'maintenance'`）一律留空，不論服務等級。
- 規格文件：`docs/superpowers/specs/2026-08-07-case-review-bonus-points-column-design.md`

---

## File Structure

| 檔案 | 動作 | 責任 |
|---|---|---|
| `src/features/repair/case-review.js` | 修改 | 新增 `resolveReviewCaseBonusPoints()` 區域函式；表頭／儲存格新增一欄；空列 colspan 12 → 13 |
| `src/app.js` | 修改（第 345 行附近） | 傳入 `deviceCategories: s.deviceCategories` |
| `scripts/verify-case-review-bonus-points.mjs` | 新增 | headless 驗證腳本，涵蓋五種案件組合與空列 colspan |

只有一個可獨立測試的交付物，因此為單一任務。

---

### Task 1: 銷案審核列表「總積分」欄

**Files:**
- Create: `scripts/verify-case-review-bonus-points.mjs`
- Modify: `src/features/repair/case-review.js`（`isMaintenancePlanCase` 之後新增函式；表頭約 158 行、儲存格約 207 行、空列 colspan 約 168 行）
- Modify: `src/app.js:345-350`

**Interfaces:**
- Consumes:
  - `PerformanceUtils.isBonusEligible(c, deviceCategories)` → `boolean`。C/D 服務等級（`serviceLevel` 以 `'C '` 或 `'D '` 開頭）回 `true`；否則查設備等級是否為 `'增額設備'`。
  - `PerformanceUtils.sumProcessPoints(c)` → `number`。`Σ(Number(r.points)||0) × (Number(r.qty)>0 ? r.qty : 1)`，取自 `c.processRecords`。
  - `DeviceCategoryUtils.getEquipmentLevelByEquip(deviceCategories, equip)` — 由 `isBonusEligible` 內部呼叫；先比對「分類＋品牌＋設備名稱＋規格＋型號」五欄全等，未命中則退回只比對 `model`，再未命中回預設值 `'基礎設備'`。因此測試資料只要給 `equipment: { model: 'ADD-1' }` 搭配 `deviceCategories: [{ model: 'ADD-1', equipmentLevel: '增額設備' }]` 即可命中。
  - `isMaintenancePlanCase(c)` — `case-review.js` 內既有區域函式，判斷 `c.sourceType === 'maintenance'`。
- Produces:
  - `resolveReviewCaseBonusPoints(record, deviceCategories)` → `number | null`。`null` 代表非增額任務（畫面留空）。僅在 `case-review.js` 內部使用，**不**掛到 `window`。

---

- [ ] **Step 1: 寫驗證腳本（此時應失敗）**

建立 `scripts/verify-case-review-bonus-points.mjs`，內容如下（CDP driver 部分沿用 `scripts/verify-case-return.mjs` 的既有模式）：

```javascript
#!/usr/bin/env node
/**
 * Executed UI verification for the 銷案審核「總積分」欄.
 * Launches headless Chrome, loads index.html, renders CaseReviewList with
 * fixture cases, then asserts on the rendered table.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9336);

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
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-bonus-points-check-profile',
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

  const todayDate = await evaluate('todayDate');
  assertTrue(!!todayDate, '成功取得頁面 todayDate', todayDate);

  // 所有 fixture 的 closeDate 都綁在頁面自身的 todayDate，
  // 避免依賴腳本執行當日的系統日期。
  await evaluate(`
    window.__deviceCategories = [
      { id: 'DC1', category: '室內機', brand: '大金', deviceName: '分離式',
        specification: '2噸', model: 'ADD-1', equipmentLevel: '增額設備' },
      { id: 'DC2', category: '室內機', brand: '大金', deviceName: '分離式',
        specification: '3噸', model: 'BASE-1', equipmentLevel: '基礎設備' }
    ];
    window.__fixtureCases = [
      { id: 'R1', caseNumber: 'BP001', customerName: 'C級客戶', storeName: '門市一',
        serviceLevel: 'C 保養(一年一次)', workCategory: '一般叫修', repairItem: '冷氣',
        repairReason: '不冷', actualReason: '缺冷媒', isClosed: true,
        closeDate: '${todayDate} 10:00',
        processRecords: [{ points: 5, qty: 2 }, { points: 3, qty: 1 }] },
      { id: 'R2', caseNumber: 'BP002', customerName: 'A級客戶', storeName: '門市二',
        serviceLevel: 'A 保修(一年一次)', workCategory: '一般叫修', repairItem: '冷氣',
        repairReason: '異音', actualReason: '軸承', isClosed: true,
        closeDate: '${todayDate} 10:00',
        equipment: { model: 'ADD-1' },
        processRecords: [{ points: 4, qty: 1 }] },
      { id: 'R3', caseNumber: 'BP003', customerName: 'B級客戶', storeName: '門市三',
        serviceLevel: 'B 保修(一年兩次)', workCategory: '一般叫修', repairItem: '冷氣',
        repairReason: '漏水', actualReason: '排水管', isClosed: true,
        closeDate: '${todayDate} 10:00',
        equipment: { model: 'BASE-1' },
        processRecords: [{ points: 9, qty: 1 }] },
      { id: 'R4', caseNumber: 'BP004', customerName: 'D級客戶', storeName: '門市四',
        serviceLevel: 'D 維修(無簽約客戶)', workCategory: '一般叫修', repairItem: '冷氣',
        repairReason: '不運轉', actualReason: '電容', isClosed: true,
        closeDate: '${todayDate} 10:00',
        processRecords: [] }
    ];
    window.__fixtureMaintenance = [
      { id: 'M1', caseNumber: 'BP005', customerName: 'C級客戶', storeName: '門市五',
        serviceLevel: 'C 保養(一年一次)', status: '已完成', isClosed: true,
        closeDate: '${todayDate} 11:00', planDate: '${todayDate}',
        processRecords: [{ points: 7, qty: 1 }] }
    ];
    window.__renderReview = function (cases, maintenanceCases) {
      return CaseReviewList({
        cases: cases,
        setCases: function () {},
        maintenanceCases: maintenanceCases,
        setMaintenanceCases: function () {},
        assignees: [],
        deviceCategories: window.__deviceCategories,
        setViewingCase: function () {},
        setView: function () {},
        showToast: function () {}
      });
    };
    'ok'`);

  console.log('\n表頭欄位');
  const headers = await evaluate(`(function(){
    var node = window.__renderReview(window.__fixtureCases, window.__fixtureMaintenance);
    var ths = Array.prototype.map.call(node.querySelectorAll('thead th'),
      function (t) { return t.textContent.trim(); });
    node.remove();
    return ths;
  })()`);
  const bonusIdx = headers.indexOf('總積分');
  assertTrue(bonusIdx !== -1, '表頭出現「總積分」欄', headers.join(' | '));
  assertEq(headers[bonusIdx - 1], '服務等級', '「總積分」緊接在「服務等級」之後');
  assertEq(headers[bonusIdx + 1], '工項分類', '「總積分」之後為「工項分類」');
  assertEq(headers.length, 13, '表頭共 13 欄');

  console.log('\n各案件的總積分儲存格');
  const cells = await evaluate(`(function(){
    var node = window.__renderReview(window.__fixtureCases, window.__fixtureMaintenance);
    var idx = ${bonusIdx};
    var out = {};
    Array.prototype.forEach.call(node.querySelectorAll('tbody tr'), function (tr) {
      var tds = tr.querySelectorAll('td');
      if (!tds.length) return;
      var num = tds[2].textContent.trim();
      out[num] = tds[idx].textContent.trim();
    });
    node.remove();
    return out;
  })()`);
  assertEq(cells.BP001, '13', 'C 級叫修案件顯示總積分 5×2 + 3×1 = 13');
  assertEq(cells.BP002, '4', 'A 級 + 增額設備顯示總積分 4');
  assertEq(cells.BP003, '', 'B 級 + 基礎設備留空');
  assertEq(cells.BP004, '0', 'D 級但無處理方式顯示 0（非空白）');
  assertEq(cells.BP005, '', 'C 級保養計劃案件留空');

  console.log('\n空資料列');
  const emptyColspan = await evaluate(`(function(){
    var node = window.__renderReview([], []);
    var td = node.querySelector('tbody td');
    var result = { text: td.textContent.trim(), colspan: td.getAttribute('colspan') };
    node.remove();
    return result;
  })()`);
  assertEq(emptyColspan.colspan, '13', '空資料列 colspan 為 13');
  assertEq(emptyColspan.text, '無資料符合目前搜尋區間', '空資料列文字不變');

  console.log('\napp.js 已傳入 deviceCategories');
  const appWired = await evaluate(`(function(){
    return fetch('file://${ROOT}/src/app.js').then(function (r) { return r.text(); })
      .then(function (src) {
        var i = src.indexOf('CaseReviewList');
        return src.slice(i, i + 400).indexOf('deviceCategories') !== -1;
      });
  })()`);
  assertTrue(appWired, 'app.js 的 CaseReviewList 呼叫含 deviceCategories');

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

- [ ] **Step 2: 執行腳本確認失敗**

Run: `node scripts/verify-case-review-bonus-points.mjs`

Expected: FAIL。`表頭出現「總積分」欄` 失敗（`bonusIdx` 為 `-1`），連帶 `headers.length` 為 `12`、各儲存格值錯位、`colspan` 為 `'12'`、`app.js 的 CaseReviewList 呼叫含 deviceCategories` 失敗。

若 `file://` 的 `fetch` 在此環境被 CORS 擋下而讓最後一項驗證丟出例外，改以 Node 端直接讀檔判斷：把該區塊換成

```javascript
  const appSrc = await import('node:fs').then(fs => fs.readFileSync(join(ROOT, 'src/app.js'), 'utf8'));
  const callIdx = appSrc.indexOf('CaseReviewList');
  assertTrue(appSrc.slice(callIdx, callIdx + 400).includes('deviceCategories'),
    'app.js 的 CaseReviewList 呼叫含 deviceCategories');
```

- [ ] **Step 3: 在 `case-review.js` 新增判定函式**

在 `src/features/repair/case-review.js` 的 `isMaintenancePlanCase()` 之後、`getReviewCaseDate()` 之前插入：

```javascript
  // 增額任務：C/D 服務等級的叫修案件，或 A/B 但設備為增額設備的叫修案件。
  // 保養計劃案件不列入增額積分（與 performance-utils 的統計口徑一致），一律回 null。
  function resolveReviewCaseBonusPoints(c, deviceCategories) {
    if (!c || isMaintenancePlanCase(c)) return null;
    if (!PerformanceUtils.isBonusEligible(c, deviceCategories || [])) return null;
    return PerformanceUtils.sumProcessPoints(c);
  }
```

- [ ] **Step 4: 讀取 `deviceCategories` prop**

在 `CaseReviewList` 的 props 解構區（`var assignees = props.assignees || [];` 之後）加入：

```javascript
    var deviceCategories = props.deviceCategories || [];
```

- [ ] **Step 5: 新增表頭欄位**

在 `thead` 中「服務等級」與「工項分類」之間插入一行：

```javascript
                h('th', { className: 'p-3 font-semibold' }, '服務等級'),
                h('th', { className: 'p-3 font-semibold' }, '總積分'),
                h('th', { className: 'p-3 font-semibold' }, '工項分類'),
```

- [ ] **Step 6: 更新空資料列 colspan**

```javascript
                h('td', { colspan: '13', className: 'text-center p-8 text-gray-400' }, '無資料符合目前搜尋區間')
```

- [ ] **Step 7: 新增儲存格**

在資料列中 `c.serviceLevel` 那格與工項分類那格之間插入。把整段改成：

```javascript
                  h('td', { className: 'p-3' }, c.serviceLevel),
                  h('td', { className: 'p-3' }, formatBonusPoints(resolveReviewCaseBonusPoints(c, deviceCategories))),
                  h('td', { className: 'p-3' }, isMaintenance ? '例行保養' : c.workCategory),
```

並在 `resolveReviewCaseBonusPoints()` 之後新增格式化函式（`null` → 空字串，數字 → 字串，`0` 保留為 `'0'`）：

```javascript
  function formatBonusPoints(points) {
    return points === null ? '' : String(points);
  }
```

- [ ] **Step 8: 在 `app.js` 傳入 `deviceCategories`**

`src/app.js:345` 的 `CaseReviewList` 呼叫改為：

```javascript
        return h(CaseReviewList, {
          cases: s.cases, setCases: setCasesData,
          maintenanceCases: s.maintenanceCases, setMaintenanceCases: setMaintenanceCases,
          assignees: s.assignees, deviceCategories: s.deviceCategories,
          setViewingCase: setViewingCase, setView: setView, showToast: showToast
        });
```

- [ ] **Step 9: 執行腳本確認全數通過**

Run: `node scripts/verify-case-review-bonus-points.mjs`

Expected: PASS，`0 failed`。

若有失敗，先確認 `index.html` 是否已載入 `performance-utils.js`（`grep -n "performance-utils" index.html`）—— `case-review.js` 現在依賴 `PerformanceUtils`。若載入順序在 `case-review.js` 之後仍無妨，因為呼叫發生在 render 時而非載入時；但若整份未被載入，需在 `index.html` 補上 script 標籤。

- [ ] **Step 10: 回歸 — 執行既有的退回案件驗證腳本**

Run: `node scripts/verify-case-return.mjs`

Expected: PASS，`0 failed`。此腳本渲染同一個 `CaseReviewList` 但未傳 `deviceCategories`，可確認 `|| []` 保底有效、既有行為未被破壞。

- [ ] **Step 11: Commit**

```bash
git add src/features/repair/case-review.js src/app.js scripts/verify-case-review-bonus-points.mjs
git commit -m "Add 總積分 column to case review list"
```

---

## Self-Review 紀錄

- **規格涵蓋**：判定規則（Step 3）、整案而非分攤（Step 3 用 `sumProcessPoints`）、欄位位置（Step 5、7）、`0` 與空白的區分（Step 7 `formatBonusPoints`）、colspan（Step 6）、`app.js` prop（Step 4、8）、七項驗證（Step 1 腳本，其中「表頭位置」對應第 1 項、BP001–BP005 對應第 2–6 項、colspan 對應第 7 項）。無遺漏。
- **命名一致性**：`resolveReviewCaseBonusPoints` 與 `formatBonusPoints` 在 Step 3、7 定義與使用一致；`deviceCategories` 變數名在 Step 4、7、8 一致。
- **無佔位符**：所有步驟均含可直接貼上的實際程式碼。
