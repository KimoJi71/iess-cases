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

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
