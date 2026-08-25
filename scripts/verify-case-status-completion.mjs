#!/usr/bin/env node
/**
 * 案件處理狀態 → 完成時間／案件結案按鈕驗證：
 * 只要變更「處理狀態」（任一狀態）並儲存，系統即押上「完成時間」，
 * 且案件列表出現「案件結案」按鈕；預計／預定排程欄位不因狀態變更被清空。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9377);

if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

let passed = 0, failed = 0;
const pass = (n, d) => { passed++; console.log(`  ✓ ${n}${d ? ` — ${d}` : ''}`); };
const fail = (n, d) => { failed++; console.error(`  ✗ ${n}${d ? ` — ${d}` : ''}`); };
function assertEq(actual, expected, name) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass(name, JSON.stringify(actual));
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-case-status-completion-profile',
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

const STATUSES = ['待料件', '待報價', '轉汰換', '轉原廠', '尚未處理完成', '案件完成'];

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
  assertEq(await evaluate('JSON.stringify(PROCESS_STATUS_OPTIONS)'), JSON.stringify(STATUSES),
    '處理狀態選項未變動');

  console.log('\nSection 1｜每個處理狀態都押上完成時間');
  for (const status of STATUSES) {
    const r = await evaluate(`(function () {
      var fd = { completionDate: '' };
      IESS.caseStatus.applyProcessStatusChange(fd, ${JSON.stringify(status)}, '2026-08-25 14:30:00');
      return fd.completionDate;
    })()`);
    assertEq(r, '2026-08-25 14:30:00', `「${status}」押上完成時間`);
  }
  assertEq(await evaluate(`(function () {
    var fd = { completionDate: '2026-08-25 10:00:00' };
    IESS.caseStatus.applyProcessStatusChange(fd, '待料件', '2026-08-25 15:00:00');
    return fd.completionDate;
  })()`), '2026-08-25 15:00:00', '再次變更狀態以最新一次時間覆蓋');
  assertEq(await evaluate(`(function () {
    var fd = { completionDate: '2026-08-25 10:00:00' };
    IESS.caseStatus.applyProcessStatusChange(fd, null, '2026-08-25 15:00:00');
    return fd.completionDate;
  })()`), '', '清成未選狀態時清空完成時間');

  console.log('\nSection 2｜不清空預計／預定排程欄位');
  assertEq(await evaluate(`(function () {
    var fd = {
      expectedDate: '2026-08-26', expectedTimeStart: '09:00', expectedTimeEnd: '11:00',
      planDate: '2026-08-27', planTimeStart: '13:00', planTimeEnd: '15:00', completionDate: ''
    };
    IESS.caseStatus.applyProcessStatusChange(fd, '待料件', '2026-08-25 14:30:00');
    delete fd.completionDate;
    return fd;
  })()`), {
    expectedDate: '2026-08-26', expectedTimeStart: '09:00', expectedTimeEnd: '11:00',
    planDate: '2026-08-27', planTimeStart: '13:00', planTimeEnd: '15:00'
  }, '「待料件」不清空預計／預定排程欄位');

  console.log('\nSection 3｜列表「案件結案」按鈕顯示條件');
  for (const status of STATUSES) {
    assertEq(await evaluate(
      `IESS.caseStatus.canCloseCase({ processStatus: ${JSON.stringify(status)}, isClosed: false })`),
      true, `「${status}」案件結案按鈕可用`);
  }
  assertEq(await evaluate(`IESS.caseStatus.canCloseCase({ processStatus: null, isClosed: false })`),
    false, '未選處理狀態時案件結案按鈕停用');
  assertEq(await evaluate(`IESS.caseStatus.canCloseCase({ processStatus: '待料件', isClosed: true })`),
    false, '已結案時案件結案按鈕停用');
  assertEq(await evaluate(`[
    IESS.caseStatus.getCaseCloseDisabledReason({ processStatus: null, isClosed: false }),
    IESS.caseStatus.getCaseCloseDisabledReason({ processStatus: '待料件', isClosed: true }),
    IESS.caseStatus.getCaseCloseDisabledReason({ processStatus: '待料件', isClosed: false })
  ]`), ['請先於維修結果選擇處理狀態', '此案件已結案', ''], '停用原因文字');

  console.log('\nSection 4｜待報價／轉汰換／轉原廠結案後留在列表等待後續處理');
  assertEq(await evaluate(`[
    IESS.caseStatus.showsFollowUpButton({ processStatus: '轉汰換', isClosed: true, isListClosed: true }),
    IESS.caseStatus.showsFollowUpButton({ processStatus: '待報價', isClosed: true, isListClosed: true }),
    IESS.caseStatus.showsFollowUpButton({ processStatus: '待料件', isClosed: true, isListClosed: true }),
    IESS.caseStatus.getFollowUpActions({ processStatus: '轉原廠', isClosed: true, isListClosed: true })
      .map(function (a) { return a.label; })
  ]`), [true, true, false, ['轉原廠完成']], '僅待報價／轉汰換／轉原廠結案後留在列表等待後續處理');

  console.log('\nSection 5｜編輯表單選狀態後完成時間欄位有值');
  await evaluate(`(function () {
    var host = document.getElementById('case-status-host');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'case-status-host';
    document.body.appendChild(host);
    var eq = {
      id: 'E1', customerName: '測試客戶', storeName: '測試門市', category: '空調',
      brand: '大金', deviceName: '室內機', status: '運轉中'
    };
    var c = {
      id: 'C1', caseNumber: '20260825001', customerName: '測試客戶', storeName: '測試門市',
      workCategory: '一般叫修', repairItem: '室內機', assignees: [], isClosed: false,
      processStatus: null, completionDate: '', createdAt: '2026-08-25 09:00:00',
      repairDate: '2026-08-25 09:00:00', expectedDate: '2026-08-26',
      expectedTimeStart: '09:00', expectedTimeEnd: '11:00', processRecords: [], equipment: eq
    };
    window.__saved = null;
    host.appendChild(EditCaseForm({
      editingCase: c, cases: [c], setCases: function (next) { window.__saved = next[0]; },
      stores: [], customers: [], equipments: [eq], vehicles: [], vendors: [],
      deviceCategories: [], processMethods: [],
      setView: function () {}, showToast: function () {}
    }));
    return true;
  })()`);
  await sleep(300);
  assertTrue(await evaluate(`(function () {
    var input = document.querySelector('#case-status-host [name=processStatus]');
    if (!input) throw new Error('找不到處理狀態下拉');
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    var opt = Array.prototype.slice.call(
      document.querySelectorAll('.searchable-select__option-label')
    ).filter(function (el) { return el.textContent.trim() === '待料件'; })[0];
    if (!opt) throw new Error('選單中找不到「待料件」');
    opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    opt.click();
    return true;
  })()`), '掛載編輯表單並選擇「待料件」');
  await sleep(300);
  const formState = await evaluate(`(function () {
    var host = document.getElementById('case-status-host');
    function val(n) {
      var el = host.querySelector('[name=' + n + ']');
      return el ? el.value : null;
    }
    return { completionDate: val('completionDate'), expectedDate: val('expectedDate') };
  })()`);
  assertTrue(!!formState.completionDate, '選「待料件」後完成時間欄位已帶入時間', formState.completionDate);
  assertEq(formState.expectedDate, '2026-08-26', '預計日期未被清空');

  await evaluate(`(function () {
    var host = document.getElementById('case-status-host');
    var btn = Array.prototype.slice.call(host.querySelectorAll('button'))
      .filter(function (b) { return b.textContent.trim().indexOf('儲存') !== -1; })[0];
    if (!btn) throw new Error('找不到儲存按鈕');
    btn.click();
    return true;
  })()`);
  await sleep(300);
  const saved = await evaluate('window.__saved && { processStatus: window.__saved.processStatus, completionDate: window.__saved.completionDate, expectedDate: window.__saved.expectedDate }');
  assertEq(saved && saved.processStatus, '待料件', '儲存後處理狀態寫入案件');
  assertTrue(!!(saved && saved.completionDate), '儲存後完成時間寫入案件', saved && saved.completionDate);
  assertEq(saved && saved.expectedDate, '2026-08-26', '儲存後預計日期仍在');
  assertEq(await evaluate('IESS.caseStatus.canCloseCase(window.__saved)'), true,
    '儲存後的案件在列表可按「案件結案」');

  if (consoleErrors.length) console.log('ERRORS', JSON.stringify(consoleErrors));
  assertEq(consoleErrors.length, 0, '操作後仍無 JS 錯誤');
} catch (err) {
  fail('UI 驗證中斷', err && err.stack ? err.stack : String(err));
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}

console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
