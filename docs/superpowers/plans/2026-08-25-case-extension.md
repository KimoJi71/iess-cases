# 案件延伸（待料件／尚未處理完成結案）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 處理狀態為「待料件」或「尚未處理完成」的案件結案時，原案件照常進入「案件銷案審核」，同時自動複製出一筆「延伸案件」回到「案件處理」列表，承接尚未完成的服務項目，並可從延伸案件逐層回溯先前案件。

**Architecture:** 延伸案件就是一筆全新的叫修案件，靠 `rootCaseNumber` / `extensionSeq` / `prevCaseId` 三個欄位與來源案件連結。建立邏輯抽成純函式模組 `src/features/repair/case-extension.js`（不碰 DOM、不碰 store），`case-list.js` 的 `handleCloseCase` 只多一個分支呼叫它，並在同一次 `setCases` 內一起寫入「已結案的原案」與「新增的延伸案」。回溯 UI 走既有的唯讀元件 `ViewCaseForm`，以新 view route `prev-case-view` + state `prevCaseBackView` 支援逐層進出。

**Tech Stack:** 原生 ES5 瀏覽器 JS，IIFE 模組掛 `window.*`，自製 `IESS.h` / `IESS.stateful` 渲染（React-like createElement API，回傳真實 DOM 節點），Tailwind class 字串。驗證用 headless Chrome + CDP 的 `.mjs` 腳本，無測試框架。

**Spec:** `docs/superpowers/specs/2026-08-25-case-extension-design.md`

## Global Constraints

- 全部 `src/**/*.js` 用 ES5 語法：`var`、`function`、`Object.assign`。**禁止** `let`/`const`/箭頭函式/樣板字串/展開運算子。（例外：`scripts/*.mjs` 是 Node ESM，可用現代語法。）
- 每個 `src/**/*.js` 都是 `(function () { 'use strict'; ... })();` IIFE，結尾掛 `window.XXX = ...`（`IESS.*` 子模組則掛在 `global.IESS`）。
- 新欄位名稱固定為 `rootCaseNumber`（string）、`extensionSeq`（number）、`prevCaseId`（string），**不得**改名。
- 延伸狀態固定為 `['待料件', '尚未處理完成']` 兩種，與 `src/data/options.js` 的 `PROCESS_STATUS_OPTIONS` 字串完全一致。
- 延伸編號格式固定為 `rootCaseNumber + '-' + extensionSeq`，序號從 1 起算、沿用原始案件遞增（`20260825001-1` → `20260825001-2`），**不得**逐層疊加成 `-1-1`。
- seed 資料**不**預設這三個欄位；非延伸案件為 `undefined`。
- UI 文案一律繁體中文。列表**不**加延伸標記。
- 新增 `src/` 檔案時必須同步在 `index.html` 加 `<script>`，且順序要在其依賴之後。
- 每個 Task 結束都要 commit，commit message 用英文祈使句。

## File Structure

| 檔案 | 責任 | 動作 |
|---|---|---|
| `src/features/repair/case-status.js` | 案件處理狀態邏輯 | 新增 `isExtensionStatus` |
| `src/features/repair/case-extension.js` | 延伸案件的編號計算與物件建構（純函式） | **新建** |
| `src/features/repair/case-list.js` | 案件處理列表 | `handleCloseCase` 新增延伸分支、確認視窗文案 |
| `src/shell/page-header.js` | 頁面統一頁首 | 新增可選 `actions` |
| `src/core/icons.js` | 內嵌 SVG 圖示 | 新增 `History` |
| `src/features/repair/case-view.js` | 查看案件明細（唯讀） | 「先前案件」按鈕 |
| `src/features/repair/case-form.js` | 編輯叫修案件 | `EditCaseForm` 的「先前案件」按鈕 |
| `src/app.js` | 進入點與 view 路由 | `prevCaseBackView` state、`prev-case-view` route、傳新 props |
| `index.html` | 載入順序 | 掛上 `case-extension.js` |
| `README.md` | 專案說明 | 檔案結構與功能說明 |
| `scripts/verify-case-extension.mjs` | headless 驗證腳本 | **新建**，四個 Task 逐步擴充 |

---

### Task 1: 延伸狀態判定與 `case-extension.js` 純函式模組

這個 Task 只做純資料層：判斷哪些處理狀態要產生延伸案件、算出延伸編號、把來源案件複製成一筆新案件物件。完全不碰 UI，因此可以單獨用驗證腳本直接呼叫函式驗證。

專案沒有測試框架，`scripts/*.mjs` 就是唯一的驗證手段：啟動 headless Chrome、以 `file://` 載入 `index.html`（所有模組以 `<script>` 依序掛上 `window`），再用 CDP `Runtime.evaluate` 直接呼叫函式並斷言回傳值。

**Files:**
- Modify: `src/features/repair/case-status.js`（`TRANSFER_STATUSES` 宣告處與檔尾 `global.IESS.caseStatus` 匯出物件）
- Create: `src/features/repair/case-extension.js`
- Modify: `index.html:60`（`case-status.js` 之後、`case-equipment.js` 之前插入一行）
- Modify: `README.md`（`features/repair/` 檔案樹）
- Test: `scripts/verify-case-extension.mjs`（新建）

**Interfaces:**
- Consumes: `ProcessMethodUtils.getCaseRecordStatus(record)` → `'已處理' | '待處理'`（已存在於 `src/features/permissions/process-method-utils.js`）；`IESS.caseDateTime.now()` → `'YYYY-MM-DD HH:mm'` 字串
- Produces:
  - `IESS.caseStatus.isExtensionStatus(status)` → boolean
  - `CaseExtensionUtils.getRootCaseNumber(c)` → string
  - `CaseExtensionUtils.getNextExtensionSeq(cases, rootCaseNumber)` → number
  - `CaseExtensionUtils.getNextExtensionCaseNumber(original, cases)` → string
  - `CaseExtensionUtils.buildExtensionCase(original, cases)` → 新案件物件

- [ ] **Step 1: 建立驗證腳本骨架與第一批斷言**

建立 `scripts/verify-case-extension.mjs`。CDP driver 部分直接照抄 `scripts/verify-case-return.mjs` 第 1–90 行的模式。完整內容如下：

```js
#!/usr/bin/env node
/**
 * Executed verification for the 延伸案件 feature.
 * Launches headless Chrome, loads index.html, then asserts on the real
 * modules attached to window (pure functions + rendered DOM nodes).
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9337);

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
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-extension-check-profile',
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

  console.log('\n延伸狀態判定');
  assertEq(await evaluate(`IESS.caseStatus.isExtensionStatus('待料件')`), true, '待料件為延伸狀態');
  assertEq(await evaluate(`IESS.caseStatus.isExtensionStatus('尚未處理完成')`), true, '尚未處理完成為延伸狀態');
  assertEq(await evaluate(`IESS.caseStatus.isExtensionStatus('案件完成')`), false, '案件完成不是延伸狀態');
  assertEq(await evaluate(`IESS.caseStatus.isExtensionStatus('轉汰換')`), false, '轉汰換不是延伸狀態');
  assertEq(await evaluate(`IESS.caseStatus.isExtensionStatus(null)`), false, 'null 不是延伸狀態');

  console.log('\n延伸編號');
  await evaluate(`
    window.__origCase = {
      id: 'C1', caseNumber: '20260825001', workCategory: '一般叫修',
      customerName: '測試客戶', storeName: '測試門市',
      companyCity: '台北市', companyDistrict: '中山區', storeAddress: '中山北路一段1號',
      serviceLevel: 'A', repairItem: '室內機', repairReason: '不冷',
      faultDesc: '出風不冷', reporter: '王小明', actualReason: '缺冷媒',
      assignees: ['北區一組'], assigneeMemberIds: ['M1'], partnerVendorIds: ['V1'],
      vehicleId: 'VH1',
      equipment: { id: 'E1', category: '分離式', brand: '日立', specification: '3.5匹' },
      processRecords: [
        { id: 1, processMethodId: 'PM1', category1: '冷氣', category2: '維修',
          category3: '加冷媒', specification: 'R410', unit: '式', points: 3, qty: 1, status: '已處理' },
        { id: 2, processMethodId: 'PM2', category1: '冷氣', category2: '更換',
          category3: '壓縮機', specification: '3.5匹', unit: '台', points: 8, qty: 2, status: '待處理' }
      ],
      processStatus: '待料件', completionDate: '2026-08-25 15:00', reRepairDate: '2026-08-25 13:00',
      expectedDate: '2026-08-25', expectedTimeStart: '13:00', expectedTimeEnd: '15:00',
      planDate: '2026-08-25', planTimeStart: '13:00', planTimeEnd: '15:00',
      isClosed: true, isListClosed: false, closeDate: '2026-08-25 16:00',
      isPerformanceIncluded: false, performanceAssignees: [], performanceAssignee: '',
      performanceMemberIds: [], returnReason: '格式有誤', returnedAt: '2026-08-24 10:00',
      indicator: 'completed', createdAt: '2026-08-20T01:00:00.000Z', repairDate: '2026-08-20 09:00'
    };
    'ok'`);

  assertEq(await evaluate(`CaseExtensionUtils.getRootCaseNumber(window.__origCase)`),
    '20260825001', '原始案件的 root 為自身編號');
  assertEq(await evaluate(`CaseExtensionUtils.getRootCaseNumber({ caseNumber: '20260825001-1', rootCaseNumber: '20260825001' })`),
    '20260825001', '延伸案件的 root 為原始編號');
  assertEq(await evaluate(`CaseExtensionUtils.getNextExtensionSeq([window.__origCase], '20260825001')`),
    1, '尚無延伸時序號為 1');
  assertEq(await evaluate(`CaseExtensionUtils.getNextExtensionSeq(
      [window.__origCase, { rootCaseNumber: '20260825001', extensionSeq: 1 }], '20260825001')`),
    2, '已有 -1 時序號為 2');
  assertEq(await evaluate(`CaseExtensionUtils.getNextExtensionCaseNumber(window.__origCase, [window.__origCase])`),
    '20260825001-1', '第一筆延伸編號為 -1');
} catch (err) {
  console.error(err);
  failed++;
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: 執行腳本確認失敗**

Run: `node scripts/verify-case-extension.mjs`
Expected: FAIL — `isExtensionStatus is not a function` 之類的例外，或斷言 `✗`。（若 Chrome 路徑不同，用 `CHROME_PATH=... node scripts/verify-case-extension.mjs`。）

- [ ] **Step 3: 在 `case-status.js` 加入 `isExtensionStatus`**

在 `src/features/repair/case-status.js` 的 `var TRANSFER_STATUSES = ['轉汰換', '轉原廠'];` 下一行加入：

```js
  var EXTENSION_STATUSES = ['待料件', '尚未處理完成'];
```

在既有的 `function isTransferStatus(status) {...}` 之後加入：

```js
  // 延伸狀態：結案時要複製出一筆延伸案件，承接尚未完成的服務項目。
  function isExtensionStatus(status) {
    return EXTENSION_STATUSES.indexOf(status) !== -1;
  }
```

在檔尾 `global.IESS.caseStatus = {` 物件內、`isTransferStatus: isTransferStatus,` 的下一行加入：

```js
    isExtensionStatus: isExtensionStatus,
```

- [ ] **Step 4: 建立 `src/features/repair/case-extension.js`**

```js
/*
 * features/repair/case-extension.js — 延伸案件（待料件／尚未處理完成結案）
 *
 * 處理狀態為「待料件」「尚未處理完成」的案件結案時，複製一筆新案件回到
 * 「案件處理」列表，承接原案尚未完成（待處理）的服務項目。
 *
 * 編號沿用原始案件遞增：20260825001 → -1 → -2 → -3（不逐層疊加）。
 * 三個關聯欄位：rootCaseNumber（原始編號）、extensionSeq（序號）、prevCaseId（上一筆的 id）。
 */
(function () {
  'use strict';

  // 來源案件若已是延伸案件就沿用它的 root，否則它自己就是 root。
  function getRootCaseNumber(c) {
    if (!c) return '';
    return c.rootCaseNumber || c.caseNumber || '';
  }

  // 同一條延伸鏈中最大的序號 + 1；中間有案件被刪除也不會撞號。
  function getNextExtensionSeq(cases, rootCaseNumber) {
    var max = 0;
    (cases || []).forEach(function (c) {
      if (!c || c.rootCaseNumber !== rootCaseNumber) return;
      var seq = Number(c.extensionSeq) || 0;
      if (seq > max) max = seq;
    });
    return max + 1;
  }

  function getNextExtensionCaseNumber(original, cases) {
    var root = getRootCaseNumber(original);
    return root + '-' + getNextExtensionSeq(cases, root);
  }

  // 只承接「待處理」的服務項目；原案件的那份保留不動（歷史紀錄）。
  function copyPendingRecords(original) {
    var records = (original && original.processRecords) || [];
    var stamp = Date.now();
    return records.filter(function (r) {
      return ProcessMethodUtils.getCaseRecordStatus(r) === '待處理';
    }).map(function (r, idx) {
      return Object.assign({}, r, { id: stamp + idx });
    });
  }

  function copyEquipment(original) {
    var eq = original && original.equipment;
    return eq ? JSON.parse(JSON.stringify(eq)) : null;
  }

  /*
   * 帶入：案件資料、設備、組別／人員／協力廠商／車輛、實際維修原因、待處理服務項目。
   * 清空：處理狀態、時間紀錄、預計日期時間（需重新排程）、結案／績效／退回欄位。
   */
  function buildExtensionCase(original, cases) {
    return {
      id: 'C' + Date.now(),
      caseNumber: getNextExtensionCaseNumber(original, cases),
      rootCaseNumber: getRootCaseNumber(original),
      extensionSeq: getNextExtensionSeq(cases, getRootCaseNumber(original)),
      prevCaseId: original.id,

      workCategory: original.workCategory,
      customerName: original.customerName,
      storeName: original.storeName,
      companyCity: original.companyCity || '',
      companyDistrict: original.companyDistrict || '',
      storeAddress: original.storeAddress || '',
      serviceLevel: original.serviceLevel || '',
      repairItem: original.repairItem || '',
      repairReason: original.repairReason || '',
      faultDesc: original.faultDesc || '',
      reporter: original.reporter || '',
      actualReason: original.actualReason || '',

      assignees: (original.assignees || []).slice(),
      assigneeMemberIds: (original.assigneeMemberIds || []).slice(),
      partnerVendorIds: (original.partnerVendorIds || []).slice(),
      vehicleId: original.vehicleId || '',

      equipment: copyEquipment(original),
      processRecords: copyPendingRecords(original),

      processStatus: null,
      completionDate: '',
      reRepairDate: '',
      expectedDate: '',
      expectedTimeStart: '',
      expectedTimeEnd: '',
      planDate: '',
      planTimeStart: '',
      planTimeEnd: '',

      isClosed: false,
      isListClosed: false,
      closeDate: '',
      isPerformanceIncluded: false,
      performanceAssignees: [],
      performanceAssignee: '',
      performanceMemberIds: [],

      indicator: original.workCategory === '緊急叫修' ? 'urgent' : 'completed',
      repairDate: IESS.caseDateTime.now(),
      createdAt: new Date().toISOString()
    };
  }

  window.CaseExtensionUtils = {
    getRootCaseNumber: getRootCaseNumber,
    getNextExtensionSeq: getNextExtensionSeq,
    getNextExtensionCaseNumber: getNextExtensionCaseNumber,
    buildExtensionCase: buildExtensionCase
  };
})();
```

- [ ] **Step 5: 在 `index.html` 掛上新檔案**

在 `index.html:60`（`<script src="src/features/repair/case-status.js"></script>`）的下一行插入：

```html
  <script src="src/features/repair/case-extension.js"></script>
```

（必須在 `case-status.js` 之後、`case-list.js` 之前；`ProcessMethodUtils` 與 `IESS.caseDateTime` 只在函式被呼叫時才用到，載入順序無虞。）

- [ ] **Step 6: 執行腳本確認通過**

Run: `node scripts/verify-case-extension.mjs`
Expected: PASS — 所有斷言 `✓`，結尾 `0 failed`。

- [ ] **Step 7: 擴充腳本驗證 `buildExtensionCase` 的欄位**

在 `scripts/verify-case-extension.mjs` 的 `getNextExtensionCaseNumber` 斷言之後、`} catch (err) {` 之前插入：

```js
  console.log('\nbuildExtensionCase — 欄位');
  const built = await evaluate(`(function(){
    var ext = CaseExtensionUtils.buildExtensionCase(window.__origCase, [window.__origCase]);
    return {
      caseNumber: ext.caseNumber,
      rootCaseNumber: ext.rootCaseNumber,
      extensionSeq: ext.extensionSeq,
      prevCaseId: ext.prevCaseId,
      differentId: ext.id !== window.__origCase.id,
      customerName: ext.customerName,
      storeName: ext.storeName,
      storeAddress: ext.storeAddress,
      faultDesc: ext.faultDesc,
      actualReason: ext.actualReason,
      assignees: ext.assignees.join(','),
      memberIds: ext.assigneeMemberIds.join(','),
      vendorIds: ext.partnerVendorIds.join(','),
      vehicleId: ext.vehicleId,
      equipmentId: ext.equipment && ext.equipment.id,
      equipmentIsCopy: ext.equipment !== window.__origCase.equipment,
      recordCount: ext.processRecords.length,
      recordCategory3: ext.processRecords[0] && ext.processRecords[0].category3,
      recordStatus: ext.processRecords[0] && ext.processRecords[0].status,
      recordQty: ext.processRecords[0] && ext.processRecords[0].qty,
      recordIdIsNew: ext.processRecords[0] && ext.processRecords[0].id !== 2,
      processStatus: ext.processStatus,
      completionDate: ext.completionDate,
      reRepairDate: ext.reRepairDate,
      expectedDate: ext.expectedDate,
      expectedTimeStart: ext.expectedTimeStart,
      planDate: ext.planDate,
      isClosed: ext.isClosed,
      isListClosed: ext.isListClosed,
      closeDate: ext.closeDate,
      isPerformanceIncluded: ext.isPerformanceIncluded,
      hasReturnReason: Object.prototype.hasOwnProperty.call(ext, 'returnReason'),
      originRecordsUntouched: window.__origCase.processRecords.length === 2
    };
  })()`);
  assertEq(built.caseNumber, '20260825001-1', '延伸案件編號');
  assertEq(built.rootCaseNumber, '20260825001', 'rootCaseNumber');
  assertEq(built.extensionSeq, 1, 'extensionSeq');
  assertEq(built.prevCaseId, 'C1', 'prevCaseId 指向原案件');
  assertTrue(built.differentId, '延伸案件有自己的 id');
  assertEq(built.customerName, '測試客戶', '客戶名稱帶入');
  assertEq(built.storeName, '測試門市', '門市名稱帶入');
  assertEq(built.storeAddress, '中山北路一段1號', '門市地址帶入');
  assertEq(built.faultDesc, '出風不冷', '故障描述帶入');
  assertEq(built.actualReason, '缺冷媒', '實際維修原因帶入');
  assertEq(built.assignees, '北區一組', '組別帶入');
  assertEq(built.memberIds, 'M1', '指派人員帶入');
  assertEq(built.vendorIds, 'V1', '協力廠商帶入');
  assertEq(built.vehicleId, 'VH1', '車輛帶入');
  assertEq(built.equipmentId, 'E1', '設備資料帶入');
  assertTrue(built.equipmentIsCopy, '設備為深拷貝，非同一物件');
  assertEq(built.recordCount, 1, '只帶一筆待處理服務項目');
  assertEq(built.recordCategory3, '壓縮機', '帶入的是待處理那筆');
  assertEq(built.recordStatus, '待處理', '服務項目維持待處理');
  assertEq(built.recordQty, 2, '服務項目數量保留');
  assertTrue(built.recordIdIsNew, '服務項目取得新 id');
  assertEq(built.processStatus, null, '處理狀態清空');
  assertEq(built.completionDate, '', '完成時間清空');
  assertEq(built.reRepairDate, '', '到店時間清空');
  assertEq(built.expectedDate, '', '預計日期清空');
  assertEq(built.expectedTimeStart, '', '預計時間清空');
  assertEq(built.planDate, '', 'planDate 清空');
  assertEq(built.isClosed, false, 'isClosed 為 false');
  assertEq(built.isListClosed, false, 'isListClosed 為 false');
  assertEq(built.closeDate, '', '結案日期清空');
  assertEq(built.isPerformanceIncluded, false, '未列入績效');
  assertEq(built.hasReturnReason, false, '不帶入退回原因');
  assertTrue(built.originRecordsUntouched, '原案件服務項目未被更動');

  console.log('\nbuildExtensionCase — 連續延伸與空項目');
  const chain = await evaluate(`(function(){
    var ext1 = CaseExtensionUtils.buildExtensionCase(window.__origCase, [window.__origCase]);
    var closed1 = Object.assign({}, ext1, { processStatus: '尚未處理完成', isClosed: true });
    var ext2 = CaseExtensionUtils.buildExtensionCase(closed1, [window.__origCase, closed1]);
    var noPending = Object.assign({}, window.__origCase, {
      id: 'C9', caseNumber: '20260825009',
      processRecords: [{ id: 7, category3: '加冷媒', status: '已處理', qty: 1 }]
    });
    var ext3 = CaseExtensionUtils.buildExtensionCase(noPending, [noPending]);
    return {
      seq2Number: ext2.caseNumber,
      seq2Root: ext2.rootCaseNumber,
      seq2Prev: ext2.prevCaseId,
      seq2Seq: ext2.extensionSeq,
      emptyNumber: ext3.caseNumber,
      emptyRecords: ext3.processRecords.length
    };
  })()`);
  assertEq(chain.seq2Number, '20260825001-2', '第二次延伸為 -2（非 -1-1）');
  assertEq(chain.seq2Root, '20260825001', '第二次延伸沿用原始 root');
  assertEq(chain.seq2Prev, 'C1', 'prevCaseId 指向上一筆案件');
  assertEq(chain.seq2Seq, 2, '第二次延伸序號為 2');
  assertEq(chain.emptyNumber, '20260825009-1', '無待處理項目仍建立延伸案件');
  assertEq(chain.emptyRecords, 0, '無待處理項目時服務項目為空');
```

註：`ext2` 的 `prevCaseId` 為 `'C1'` 是因為 `closed1` 沿用 `ext1` 的 `id`，而 `ext1.prevCaseId` 為 `'C1'`——此處驗證的是 `buildExtensionCase` 讀的是 `original.id`；因 `ext1` 與 `ext2` 在同一毫秒內建立，兩者 `id` 可能相同，故不對 `ext2.id` 做斷言。

- [ ] **Step 8: 執行腳本確認通過**

Run: `node scripts/verify-case-extension.mjs`
Expected: PASS — `0 failed`。

- [ ] **Step 9: 更新 README 檔案樹**

在 `README.md` 的 `features/repair/` 區塊中，`│   │   ├── case-form.js     新增／編輯叫修案件` 之後插入一行（對齊既有欄寬）：

```
│   │   ├── case-extension.js 延伸案件（待料件／尚未處理完成結案時複製新案）
```

- [ ] **Step 10: Commit**

```bash
git add src/features/repair/case-status.js src/features/repair/case-extension.js index.html README.md scripts/verify-case-extension.mjs
git commit -m "feat: add case extension utils for pending process statuses"
```

---

### Task 2: 結案時建立延伸案件（case-list.js）

把 Task 1 的純函式接到「案件處理」列表的結案流程：`handleCloseCase` 由兩分支變三分支，確認視窗在延伸狀態時改文案並預告新編號。

**Files:**
- Modify: `src/features/repair/case-list.js:118-150`（`handleCloseCase`）、`:405-425`（確認視窗）
- Test: `scripts/verify-case-extension.mjs`（擴充）

**Interfaces:**
- Consumes: `IESS.caseStatus.isExtensionStatus(status)`、`CaseExtensionUtils.buildExtensionCase(original, cases)`、`CaseExtensionUtils.getNextExtensionCaseNumber(original, cases)`（皆來自 Task 1）
- Produces: 無新公開介面（`CaseList` 的行為變更）

- [ ] **Step 1: 擴充腳本，加入結案流程斷言**

在 `scripts/verify-case-extension.mjs` 的 `chain` 斷言之後、`} catch (err) {` 之前插入：

```js
  console.log('\n案件處理列表 — 延伸結案');
  await evaluate(`
    window.__mkList = function () {
      var target = Object.assign({}, window.__origCase, {
        isClosed: false, isListClosed: false, closeDate: '',
        returnReason: undefined, returnedAt: undefined
      });
      window.__written = { cases: null, stores: null, toast: null };
      var node = CaseList({
        cases: [target],
        setCases: function (next) { window.__written.cases = next; },
        stores: [], setStores: function (next) { window.__written.stores = next; },
        customers: [],
        setEditingCase: function () {}, setView: function () {},
        showToast: function (msg) { window.__written.toast = msg; },
        statusFilter: '全部', setStatusFilter: function () {},
        processMethods: [], deviceCategories: [], vehicles: [], vendors: []
      });
      document.body.appendChild(node);
      return node;
    };
    window.__findCloseBtn = function (node, caseNumber) {
      var rows = Array.prototype.slice.call(node.querySelectorAll('tbody tr'));
      var row = rows.filter(function (tr) { return tr.textContent.indexOf(caseNumber) !== -1; })[0];
      if (!row) return null;
      return row.querySelector('button[aria-label="案件結案"]');
    };
    window.__findBtnByText = function (text) {
      return Array.prototype.slice.call(document.body.querySelectorAll('button'))
        .filter(function (b) { return b.textContent.trim() === text; })[0];
    };
    'ok'`);

  const modalCheck = await evaluate(`(function(){
    var node = window.__mkList();
    window.__findCloseBtn(node, '20260825001').click();
    var text = document.body.textContent;
    var result = {
      mentionsExtension: text.indexOf('延伸案件') !== -1,
      mentionsNumber: text.indexOf('20260825001-1') !== -1
    };
    document.body.innerHTML = '';
    return result;
  })()`);
  assertTrue(modalCheck.mentionsExtension, '確認視窗文案提到延伸案件');
  assertTrue(modalCheck.mentionsNumber, '確認視窗預告延伸編號 20260825001-1');

  const closeResult = await evaluate(`(function(){
    var node = window.__mkList();
    window.__findCloseBtn(node, '20260825001').click();
    window.__findBtnByText('確認').click();
    var written = window.__written.cases || [];
    var origin = written.filter(function (c) { return c.id === 'C1'; })[0];
    var ext = written.filter(function (c) { return c.caseNumber === '20260825001-1'; })[0];
    var result = {
      total: written.length,
      originClosed: origin && origin.isClosed,
      originIsListClosed: origin && !!origin.isListClosed,
      originHasCloseDate: !!(origin && origin.closeDate),
      originRecords: origin && origin.processRecords.length,
      hasExtension: !!ext,
      extPrev: ext && ext.prevCaseId,
      extStatus: ext && ext.processStatus,
      extRecords: ext && ext.processRecords.length,
      toast: window.__written.toast
    };
    document.body.innerHTML = '';
    return result;
  })()`);
  assertEq(closeResult.total, 2, '結案後案件集共 2 筆（原案 + 延伸案）');
  assertEq(closeResult.originClosed, true, '原案件已結案');
  assertEq(closeResult.originIsListClosed, false, '原案件不留在處理列表');
  assertTrue(closeResult.originHasCloseDate, '原案件寫入結案時間');
  assertEq(closeResult.originRecords, 2, '原案件服務項目保留原樣');
  assertTrue(closeResult.hasExtension, '建立延伸案件 20260825001-1');
  assertEq(closeResult.extPrev, 'C1', '延伸案件連結原案件');
  assertEq(closeResult.extStatus, null, '延伸案件為未處理');
  assertEq(closeResult.extRecords, 1, '延伸案件只帶待處理項目');
  assertTrue(String(closeResult.toast).indexOf('20260825001-1') !== -1,
    'toast 提示延伸案件編號', closeResult.toast);

  const plainClose = await evaluate(`(function(){
    window.__written = { cases: null, stores: null, toast: null };
    var target = Object.assign({}, window.__origCase, {
      id: 'C2', caseNumber: '20260825002', processStatus: '案件完成',
      isClosed: false, isListClosed: false, closeDate: ''
    });
    var node = CaseList({
      cases: [target],
      setCases: function (next) { window.__written.cases = next; },
      stores: [], setStores: function () {}, customers: [],
      setEditingCase: function () {}, setView: function () {},
      showToast: function (msg) { window.__written.toast = msg; },
      statusFilter: '全部', setStatusFilter: function () {},
      processMethods: [], deviceCategories: [], vehicles: [], vendors: []
    });
    document.body.appendChild(node);
    window.__findCloseBtn(node, '20260825002').click();
    var modalText = document.body.textContent;
    window.__findBtnByText('確認').click();
    var result = {
      mentionsExtension: modalText.indexOf('延伸案件') !== -1,
      total: (window.__written.cases || []).length,
      toast: window.__written.toast
    };
    document.body.innerHTML = '';
    return result;
  })()`);
  assertEq(plainClose.mentionsExtension, false, '案件完成的確認視窗不提延伸案件');
  assertEq(plainClose.total, 1, '案件完成結案不產生延伸案件');
  assertTrue(String(plainClose.toast).indexOf('延伸') === -1,
    '案件完成的 toast 不提延伸', plainClose.toast);
```

- [ ] **Step 2: 執行腳本確認新斷言失敗**

Run: `node scripts/verify-case-extension.mjs`
Expected: FAIL — `確認視窗文案提到延伸案件`、`結案後案件集共 2 筆` 等新斷言 `✗`（Task 1 的斷言仍 `✓`）。

- [ ] **Step 3: 在 `handleCloseCase` 加入延伸分支**

`src/features/repair/case-list.js` 的 `handleCloseCase` 中，transfer 分支的 `return;` 之後、最後一段一般結案之前，插入延伸分支：

```js
      if (caseStatus.isExtensionStatus(target.processStatus)) {
        var extensionCase = CaseExtensionUtils.buildExtensionCase(target, cases);
        // 原案件與延伸案件在同一次 setCases 寫入，避免兩次重繪讓序號重算。
        setCases(cases.map(function (c) {
          if (c.id !== caseId) return c;
          return Object.assign({}, c, {
            isClosed: true,
            closeDate: stamp
          });
        }).concat([extensionCase]));
        showToast('案件已結案並移至「案件銷案審核」列表，已建立延伸案件 ' + extensionCase.caseNumber);
        return;
      }
```

- [ ] **Step 4: 確認視窗文案加入延伸說明**

在 `src/features/repair/case-list.js` 的 `closeConfirmModal.show && ...` 區塊中，找到訊息段落：

```js
            h('p', { className: 'text-gray-600 mb-6' },
              closeConfirmModal.mode === 'complete'
                ? '確定要標記為已完成嗎？完成後將自案件處理列表移除（仍保留於案件銷案審核）。'
                : modalCase && caseStatus.isTransferStatus(modalCase.processStatus)
                  ? '確定要將此案件結案嗎？結案後將同步移至「案件銷案審核」列表，並保留於本列表，待完成後請點選對應完成按鈕。'
                  : '確定要將此案件結案嗎？結案後將移至「案件銷案審核」列表。'
            ),
```

改為（在 transfer 判斷之後多一層延伸判斷）：

```js
            h('p', { className: 'text-gray-600 mb-6' },
              closeConfirmModal.mode === 'complete'
                ? '確定要標記為已完成嗎？完成後將自案件處理列表移除（仍保留於案件銷案審核）。'
                : modalCase && caseStatus.isTransferStatus(modalCase.processStatus)
                  ? '確定要將此案件結案嗎？結案後將同步移至「案件銷案審核」列表，並保留於本列表，待完成後請點選對應完成按鈕。'
                  : modalCase && caseStatus.isExtensionStatus(modalCase.processStatus)
                    ? '確定要將此案件結案嗎？結案後將移至「案件銷案審核」列表，並自動建立一筆延伸案件（編號 ' +
                      CaseExtensionUtils.getNextExtensionCaseNumber(modalCase, cases) +
                      '）於案件處理列表。'
                    : '確定要將此案件結案嗎？結案後將移至「案件銷案審核」列表。'
            ),
```

（`modalCase` 已定義於 `src/features/repair/case-list.js:242`，在此段之前，直接使用即可。）

- [ ] **Step 5: 執行腳本確認通過**

Run: `node scripts/verify-case-extension.mjs`
Expected: PASS — `0 failed`，含 Task 1 與 Task 2 的全部斷言。

- [ ] **Step 6: Commit**

```bash
git add src/features/repair/case-list.js scripts/verify-case-extension.mjs
git commit -m "feat: create extension case when closing pending-status cases"
```

---

### Task 3: PageHeader 支援額外操作鈕與 `History` 圖示

Task 4 的「先前案件」按鈕要放在頁首，但 `PageHeader` 右側目前寫死只有關閉鈕。這個 Task 先把承載位置與圖示準備好，且不改變任何現有頁面的輸出。

**Files:**
- Modify: `src/shell/page-header.js`
- Modify: `src/core/icons.js:44`（`RefreshCw` 那行之後、`};` 之前）
- Test: `scripts/verify-case-extension.mjs`（擴充）

**Interfaces:**
- Produces:
  - `PageHeader({ title, badge, onClose, wrapperClass, actions })` — `actions` 為節點陣列（可選），渲染於關閉鈕左側
  - `IESS.Icons.History(props)` → `<svg>` 節點

- [ ] **Step 1: 擴充腳本，加入 PageHeader 與圖示斷言**

在 `scripts/verify-case-extension.mjs` 的 `plainClose` 斷言之後、`} catch (err) {` 之前插入：

```js
  console.log('\nPageHeader actions 與 Icons.History');
  assertEq(await evaluate('typeof IESS.Icons.History'), 'function', 'Icons.History 已定義');
  assertEq(await evaluate(`IESS.Icons.History({ className: 'h-4 w-4' }).tagName`),
    'svg', 'Icons.History 回傳 svg 節點');
  assertTrue(await evaluate(`IESS.Icons.History({ className: 'h-4 w-4' }).querySelectorAll('path').length > 0`),
    'Icons.History 含 path');

  const headerCheck = await evaluate(`(function(){
    var plain = PageHeader({ title: '測試', badge: 'X1', onClose: function () {} });
    var withActions = PageHeader({
      title: '測試', badge: 'X1', onClose: function () {},
      actions: [IESS.h('button', { type: 'button' }, '先前案件')]
    });
    var actionBtn = Array.prototype.slice.call(withActions.querySelectorAll('button'))
      .filter(function (b) { return b.textContent.trim() === '先前案件'; })[0];
    var closeBtn = withActions.querySelector('button[aria-label="關閉並返回列表"]');
    var buttons = Array.prototype.slice.call(withActions.querySelectorAll('button'));
    return {
      plainButtons: plain.querySelectorAll('button').length,
      plainHasClose: !!plain.querySelector('button[aria-label="關閉並返回列表"]'),
      hasActionBtn: !!actionBtn,
      hasCloseBtn: !!closeBtn,
      actionBeforeClose: buttons.indexOf(actionBtn) < buttons.indexOf(closeBtn)
    };
  })()`);
  assertEq(headerCheck.plainButtons, 1, '未傳 actions 時仍只有關閉鈕');
  assertTrue(headerCheck.plainHasClose, '未傳 actions 時關閉鈕不變');
  assertTrue(headerCheck.hasActionBtn, '傳入 actions 後出現該按鈕');
  assertTrue(headerCheck.hasCloseBtn, '傳入 actions 後關閉鈕仍在');
  assertTrue(headerCheck.actionBeforeClose, 'actions 渲染於關閉鈕左側');
```

- [ ] **Step 2: 執行腳本確認新斷言失敗**

Run: `node scripts/verify-case-extension.mjs`
Expected: FAIL — `Icons.History 已定義`、`傳入 actions 後出現該按鈕` 等 `✗`。

- [ ] **Step 3: 新增 `History` 圖示**

在 `src/core/icons.js` 的 `RefreshCw: '...'` 那一行之後、`};` 之前加入（記得為前一行補上結尾逗號）：

```js
    History: '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/>'
```

- [ ] **Step 4: 讓 `PageHeader` 支援 `actions`**

把 `src/shell/page-header.js` 的 `PageHeader` 改為：

```js
  function PageHeader(opts) {
    var wrapperClass = opts.wrapperClass ||
      'flex justify-between items-center mb-6 pb-4 border-b border-gray-200';
    var closeBtn = iconActionBtn({ label: '關閉並返回列表', onClick: opts.onClose,
      className: 'shrink-0 p-2.5 sm:p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors', icon: Icons.X({ className: 'h-6 w-6' }) });
    var actions = opts.actions || [];

    return h('div', { className: wrapperClass },
      h('div', { className: 'flex items-center gap-2 sm:gap-3 min-w-0 flex-1' },
        h('h2', { className: 'text-xl sm:text-2xl font-bold text-gray-800' }, opts.title),
        opts.badge
          ? h('span', {
              className: 'text-sm sm:text-base font-medium text-blue-700 bg-blue-50 px-2.5 sm:px-3 py-1 rounded-full shrink-0'
            }, opts.badge)
          : null
      ),
      actions.length
        ? h('div', { className: 'flex items-center gap-2 shrink-0' }, actions.concat([closeBtn]))
        : closeBtn
    );
  }
```

同時把檔頭註解的 `opts` 說明補上一行：

```js
 *   actions? 額外操作節點陣列，渲染於關閉鈕左側（如「先前案件」）。
```

- [ ] **Step 5: 執行腳本確認通過**

Run: `node scripts/verify-case-extension.mjs`
Expected: PASS — `0 failed`。

- [ ] **Step 6: 手動檢查現有頁面未走樣**

開啟 `index.html`，進入「維修服務 → 案件處理 → 任一案件的編輯」與「案件銷案審核 → 查看明細」，確認頁首標題／案號／關閉鈕排版與改動前一致。

- [ ] **Step 7: Commit**

```bash
git add src/core/icons.js src/shell/page-header.js scripts/verify-case-extension.mjs
git commit -m "feat: allow extra header actions and add history icon"
```

---

### Task 4: 「先前案件」按鈕與回溯路由

延伸案件的明細頁與編輯頁加上「先前案件」按鈕，點擊以唯讀方式檢視上一筆案件，並可逐層往前、逐層退回。

**Files:**
- Modify: `src/features/repair/case-view.js`（props 與 PageHeader）
- Modify: `src/features/repair/case-form.js:369-379`（`EditCaseForm` props）、`:543-547`（PageHeader）
- Modify: `src/app.js:116`（state）、`:140-145`（setter）、`:355-390`（route）
- Modify: `README.md`（功能說明）
- Test: `scripts/verify-case-extension.mjs`（擴充）

**Interfaces:**
- Consumes: `PageHeader({ ..., actions })`、`IESS.Icons.History`（Task 3）；案件的 `prevCaseId`（Task 1）
- Produces:
  - `ViewCaseForm` 新增 props：`cases`（陣列）、`setViewingCase`（function）、`setPrevCaseBackView`（function）、`currentView`（字串，此頁自身的 view 名稱，用於回溯時記錄來源）
  - `EditCaseForm` 新增 props：`setViewingCase`、`setPrevCaseBackView`
  - `app.js` state `prevCaseBackView`（string，預設 `'list'`）與 view route `'prev-case-view'`

- [ ] **Step 1: 擴充腳本，加入先前案件按鈕斷言**

在 `scripts/verify-case-extension.mjs` 的 `headerCheck` 斷言之後、`} catch (err) {` 之前插入：

```js
  console.log('\n先前案件按鈕');
  await evaluate(`
    window.__extCase = CaseExtensionUtils.buildExtensionCase(window.__origCase, [window.__origCase]);
    window.__nav = { viewingCase: null, view: null, backView: null };
    window.__mkView = function (target, currentView) {
      var node = ViewCaseForm({
        viewingCase: target, setView: function (v) { window.__nav.view = v; },
        backView: 'record-list', currentView: currentView || 'record-view',
        cases: [window.__origCase, window.__extCase],
        setViewingCase: function (c) { window.__nav.viewingCase = c; },
        setPrevCaseBackView: function (v) { window.__nav.backView = v; },
        processMethods: [], deviceCategories: [], vehicles: [], vendors: []
      });
      document.body.appendChild(node);
      return node;
    };
    window.__findPrevBtn = function (node) {
      return Array.prototype.slice.call(node.querySelectorAll('button'))
        .filter(function (b) { return b.textContent.trim().indexOf('先前案件') !== -1; })[0];
    };
    'ok'`);

  const viewBtn = await evaluate(`(function(){
    var extNode = window.__mkView(window.__extCase);
    var hasBtnOnExt = !!window.__findPrevBtn(extNode);
    extNode.remove();
    var origNode = window.__mkView(window.__origCase);
    var hasBtnOnOrig = !!window.__findPrevBtn(origNode);
    origNode.remove();
    document.body.innerHTML = '';
    return { hasBtnOnExt: hasBtnOnExt, hasBtnOnOrig: hasBtnOnOrig };
  })()`);
  assertTrue(viewBtn.hasBtnOnExt, '延伸案件明細頁有「先前案件」按鈕');
  assertEq(viewBtn.hasBtnOnOrig, false, '原始案件明細頁沒有「先前案件」按鈕');

  const viewNav = await evaluate(`(function(){
    window.__nav = { viewingCase: null, view: null, backView: null };
    var node = window.__mkView(window.__extCase, 'record-view');
    window.__findPrevBtn(node).click();
    var result = {
      viewingId: window.__nav.viewingCase && window.__nav.viewingCase.id,
      view: window.__nav.view,
      backView: window.__nav.backView
    };
    document.body.innerHTML = '';
    return result;
  })()`);
  assertEq(viewNav.viewingId, 'C1', '點擊後切換到前一筆案件');
  assertEq(viewNav.view, 'prev-case-view', '切換到 prev-case-view');
  assertEq(viewNav.backView, 'record-view', '記錄來源 view 供返回');

  const editBtn = await evaluate(`(function(){
    window.__nav = { viewingCase: null, view: null, backView: null };
    var node = EditCaseForm({
      editingCase: window.__extCase,
      cases: [window.__origCase, window.__extCase],
      setCases: function () {},
      stores: [], customers: [], equipments: [], vehicles: [], vendors: [],
      deviceCategories: [], processMethods: [],
      setView: function (v) { window.__nav.view = v; },
      showToast: function () {},
      setViewingCase: function (c) { window.__nav.viewingCase = c; },
      setPrevCaseBackView: function (v) { window.__nav.backView = v; }
    });
    document.body.appendChild(node);
    var btn = Array.prototype.slice.call(node.querySelectorAll('button'))
      .filter(function (b) { return b.textContent.trim().indexOf('先前案件') !== -1; })[0];
    var hasBtn = !!btn;
    if (btn) btn.click();
    var result = {
      hasBtn: hasBtn,
      viewingId: window.__nav.viewingCase && window.__nav.viewingCase.id,
      view: window.__nav.view,
      backView: window.__nav.backView
    };
    document.body.innerHTML = '';
    return result;
  })()`);
  assertTrue(editBtn.hasBtn, '延伸案件編輯頁有「先前案件」按鈕');
  assertEq(editBtn.viewingId, 'C1', '編輯頁點擊後切換到前一筆案件');
  assertEq(editBtn.view, 'prev-case-view', '編輯頁切換到 prev-case-view');
  assertEq(editBtn.backView, 'edit', '編輯頁記錄來源為 edit');

  const missingPrev = await evaluate(`(function(){
    var orphan = Object.assign({}, window.__extCase, { prevCaseId: 'C-NOT-EXIST' });
    var node = window.__mkView(orphan);
    var hasBtn = !!window.__findPrevBtn(node);
    document.body.innerHTML = '';
    return hasBtn;
  })()`);
  assertEq(missingPrev, false, '找不到前一筆案件時不顯示按鈕');
```

- [ ] **Step 2: 執行腳本確認新斷言失敗**

Run: `node scripts/verify-case-extension.mjs`
Expected: FAIL — `延伸案件明細頁有「先前案件」按鈕` 等 `✗`。

- [ ] **Step 3: `case-view.js` 加上按鈕**

在 `src/features/repair/case-view.js` 的 props 取值區（`var vendors = props.vendors || [];` 之後）加入：

```js
    var cases = props.cases || [];
    var setViewingCase = props.setViewingCase;
    var setPrevCaseBackView = props.setPrevCaseBackView;
    var currentView = props.currentView || backView;
```

在 `var isOther = ...` 之前加入按鈕的建構：

```js
    function findPrevCase() {
      if (!viewingCase || !viewingCase.prevCaseId || !setViewingCase) return null;
      return cases.filter(function (c) { return c.id === viewingCase.prevCaseId; })[0] || null;
    }

    function buildPrevCaseAction() {
      var prev = findPrevCase();
      if (!prev) return [];
      return [h('button', {
        type: 'button',
        className: 'px-3 py-1.5 text-sm border rounded-md text-blue-600 hover:bg-blue-50 ' +
          'flex items-center gap-1.5 shrink-0',
        title: '檢視先前案件 ' + prev.caseNumber,
        onClick: function () {
          if (setPrevCaseBackView) setPrevCaseBackView(currentView);
          setViewingCase(prev);
          setView('prev-case-view');
        }
      }, IESS.Icons.History({ className: 'h-4 w-4' }), '先前案件')];
    }
```

把 `PageHeader({ ... })` 呼叫改為多帶 `actions`：

```js
      PageHeader({
        title: '查看案件明細',
        badge: viewingCase && viewingCase.caseNumber,
        onClose: function () { setView(backView); },
        actions: buildPrevCaseAction(),
        wrapperClass: 'page-header-sticky flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
      }),
```

- [ ] **Step 4: `case-form.js` 的 `EditCaseForm` 加上按鈕**

在 `EditCaseForm` 的 props 取值區（`var showToast = props.showToast;` 之後）加入：

```js
    var setViewingCase = props.setViewingCase;
    var setPrevCaseBackView = props.setPrevCaseBackView;
```

在 `return stateful(function (rerender) {` 內、`return h("div", {` 之前加入：

```js
      function buildPrevCaseAction() {
        if (!formData.prevCaseId || !setViewingCase) return [];
        var prev = cases.filter(function (c) { return c.id === formData.prevCaseId; })[0];
        if (!prev) return [];
        return [h('button', {
          type: 'button',
          className: 'px-3 py-1.5 text-sm border rounded-md text-blue-600 hover:bg-blue-50 ' +
            'flex items-center gap-1.5 shrink-0',
          title: '檢視先前案件 ' + prev.caseNumber,
          onClick: function () {
            if (setPrevCaseBackView) setPrevCaseBackView('edit');
            setViewingCase(prev);
            setView('prev-case-view');
          }
        }, Icons.History({ className: 'h-4 w-4' }), '先前案件')];
      }
```

把 `EditCaseForm` 的 `PageHeader({ ... })`（`title: '編輯案件'` 那一組）改為多帶 `actions`：

```js
      }, PageHeader({
        title: '編輯案件',
        badge: formData.caseNumber,
        onClose: function () { setView('list'); },
        actions: buildPrevCaseAction(),
        wrapperClass: 'page-header-sticky flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
      }), h("div", {
```

- [ ] **Step 5: `app.js` 加上 state、setter 與 route**

在 `src/app.js` 的 store 初始值中，`customerBackView: '',` 之後加入：

```js
    prevCaseBackView: 'list',
```

在 `var setCustomerBackView = makeSetter('customerBackView');` 之後加入：

```js
  var setPrevCaseBackView = makeSetter('prevCaseBackView');
```

`case 'edit':` 的 `h(EditCaseForm, { ... })` props 中，`showToast: showToast,` 之後加入：

```js
          setViewingCase: setViewingCase,
          setPrevCaseBackView: setPrevCaseBackView,
```

`case 'record-view':` 與 `case 'review-view':` 兩個 `h(ViewCaseForm, { ... })` 的 props 中，各自在 `vehicles: s.vehicles, vendors: s.vendors` 之後加入（`currentView` 各自對應自己的 view 名稱）：

```js
          cases: s.cases, setViewingCase: setViewingCase,
          setPrevCaseBackView: setPrevCaseBackView, currentView: 'record-view'
```

```js
          cases: s.cases, setViewingCase: setViewingCase,
          setPrevCaseBackView: setPrevCaseBackView, currentView: 'review-view'
```

在 `case 'review-view':` 區塊之後加入新 route：

```js
      case 'prev-case-view':
        return h(ViewCaseForm, {
          viewingCase: s.viewingCase, setView: setView,
          backView: s.prevCaseBackView || 'list',
          currentView: 'prev-case-view',
          cases: s.cases, setViewingCase: setViewingCase,
          setPrevCaseBackView: setPrevCaseBackView,
          processMethods: s.processMethods, deviceCategories: s.deviceCategories,
          vehicles: s.vehicles, vendors: s.vendors
        });
```

- [ ] **Step 6: 執行腳本確認通過**

Run: `node scripts/verify-case-extension.mjs`
Expected: PASS — `0 failed`，四個 Task 的斷言全通過。

- [ ] **Step 7: 手動走查完整流程**

開啟 `index.html`：

1. 維修服務 → 案件處理，挑一筆有設備與服務項目的案件，編輯 → 維修結果的處理狀態選「待料件」→ 儲存
2. 回列表點該案件的「案件結案」→ 確認視窗應提到「延伸案件（編號 xxx-1）」→ 確認
3. 列表出現 `xxx-1`，狀態篩選「未處理」可見；原案件消失，於「案件銷案審核」可見
4. 編輯 `xxx-1`：設備、組別、車輛、實際維修原因都在；服務項目只剩原本的待處理項目；預計日期／時間為空
5. `xxx-1` 的編輯頁點「先前案件」→ 看到原案件唯讀明細 → 關閉回到編輯頁
6. 把 `xxx-1` 的處理狀態設為「尚未處理完成」並結案 → 出現 `xxx-2`（不是 `xxx-1-1`）
7. `xxx-2` 明細頁點「先前案件」→ 看到 `xxx-1` → 再點一次「先前案件」→ 看到原案件 → 連按兩次關閉逐層退回

- [ ] **Step 8: 更新 README 功能說明**

在 `README.md` 的「功能說明」段落最後加入一行：

```
案件處理狀態為「待料件」「尚未處理完成」時結案，原案件移入銷案審核，並自動建立一筆延伸案件（編號為原編號加 -1、-2…）回到案件處理列表，承接原案尚未完成的服務項目；延伸案件的明細頁與編輯頁可由「先前案件」逐層回溯。
```

- [ ] **Step 9: Commit**

```bash
git add src/features/repair/case-view.js src/features/repair/case-form.js src/app.js README.md scripts/verify-case-extension.mjs
git commit -m "feat: add previous-case navigation for extension cases"
```
