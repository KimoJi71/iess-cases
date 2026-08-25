#!/usr/bin/env node
/**
 * 案件處理列表操作欄「更多」選單驗證：
 * 下載 PDF 與複製URL 收進三點「更多」按鈕，選單以 fixed 浮動於表格之外不被裁切，
 * 點選項會觸發對應行為並關閉選單，點外面／Esc 也會關閉。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9379);

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
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-case-list-more-menu-profile',
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

  await evaluate(`
    window.__copied = [];
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: function (t) { window.__copied.push(t); return Promise.resolve(); } }
      });
    } catch (e) { /* headless 下 clipboard 不可用時仍以 toast 驗證 */ }
    window.__pdfCalls = [];
    window.__toasts = [];
    window.__origExport = window.exportCasePdf;
    window.exportCasePdf = function (c) {
      window.__pdfCalls.push(c.caseNumber);
      return Promise.resolve();
    };
    window.__mkCase = function (extra) {
      return Object.assign({
        id: 'C1', caseNumber: '20260825001', customerName: '測試客戶', storeName: '測試門市',
        companyCity: '台北市', companyDistrict: '中山區', workCategory: '一般叫修',
        repairItem: '室內機', repairReason: '不冷', faultDesc: '出風不冷',
        actualReason: '冷媒不足', assignees: [], isClosed: false, processStatus: '案件完成',
        createdAt: '${todayDate} 09:00:00', repairDate: '${todayDate} 09:00:00',
        expectedDate: '${todayDate}', expectedTimeStart: '09:00', expectedTimeEnd: '11:00',
        processRecords: [], equipment: null
      }, extra || {});
    };
    window.__mkList = function (cases, filter) {
      document.querySelectorAll('.action-menu__menu').forEach(function (m) { m.remove(); });
      var old = document.getElementById('list-host');
      if (old) old.remove();
      var host = document.createElement('div');
      host.id = 'list-host';
      document.body.appendChild(host);
      host.appendChild(CaseList({
        cases: cases,
        setCases: function () {},
        stores: [], setStores: function () {},
        setEditingCase: function () {}, setView: function () {},
        showToast: function (msg) { window.__toasts.push(msg); },
        statusFilter: filter || '案件完成', setStatusFilter: function () {}
      }));
      return true;
    };
    window.__actionButtons = function () {
      return Array.prototype.map.call(
        document.querySelectorAll('#list-host tbody tr:first-child td:first-child button'),
        function (b) { return { label: b.getAttribute('aria-label'), disabled: b.disabled }; }
      );
    };
    window.__actionLabels = function () {
      return Array.prototype.map.call(
        document.querySelectorAll('#list-host tbody tr:first-child td:first-child button'),
        function (b) { return b.getAttribute('aria-label'); }
      );
    };
    window.__moreBtn = function () {
      return Array.prototype.slice.call(
        document.querySelectorAll('#list-host tbody tr:first-child td:first-child button')
      ).filter(function (b) { return b.getAttribute('aria-label') === '更多'; })[0];
    };
    window.__menuItems = function () {
      return Array.prototype.map.call(
        document.querySelectorAll('.action-menu__menu .action-menu__item'),
        function (b) { return b.textContent.trim(); }
      );
    };
    window.__clickMenuItem = function (label) {
      var btn = Array.prototype.slice.call(
        document.querySelectorAll('.action-menu__menu .action-menu__item')
      ).filter(function (b) { return b.textContent.trim() === label; })[0];
      if (!btn) throw new Error('選單中找不到：' + label);
      btn.click();
      return true;
    };
    'ok'`);

  console.log('\nSection 1｜操作欄按鈕');
  await evaluate('window.__mkList([window.__mkCase()])');
  assertEq(await evaluate('window.__actionLabels()'), ['編輯', '案件結案', '更多'],
    '操作欄只剩編輯／案件結案／更多');
  assertEq(await evaluate(`(function () {
    var host = document.getElementById('list-host');
    return host.querySelectorAll('tbody tr:first-child td:first-child button').length;
  })()`), 3, '操作欄固定三顆按鈕');
  assertEq(await evaluate('window.__menuItems()'), [], '尚未點開時沒有浮動選單');

  await evaluate(`window.__mkList([window.__mkCase({ processStatus: null })], '未處理')`);
  assertEq(await evaluate('window.__actionButtons()'), [
    { label: '編輯', disabled: false },
    { label: '請先於維修結果選擇處理狀態', disabled: true },
    { label: '更多', disabled: false }
  ], '未選處理狀態時結案按鈕仍在，以停用狀態呈現');
  await evaluate('window.__mkList([window.__mkCase()])');
  assertEq(await evaluate('window.__actionButtons()'), [
    { label: '編輯', disabled: false },
    { label: '案件結案', disabled: false },
    { label: '更多', disabled: false }
  ], '選過處理狀態時結案按鈕可用');

  console.log('\nSection 2｜點開更多選單');
  await evaluate('window.__moreBtn().click()');
  await sleep(100);
  assertEq(await evaluate('window.__menuItems()'), ['下載 PDF', '複製URL'],
    '選單含下載 PDF 與複製URL');
  assertEq(await evaluate(`document.querySelector('.action-menu__menu').parentElement === document.body`),
    true, '選單掛在 document.body（不被表格 overflow 裁切）');
  assertEq(await evaluate(`getComputedStyle(document.querySelector('.action-menu__menu')).position`),
    'fixed', '選單使用 fixed 定位');
  assertTrue(await evaluate(`(function () {
    var menu = document.querySelector('.action-menu__menu').getBoundingClientRect();
    var btn = window.__moreBtn().getBoundingClientRect();
    var alignedRight = Math.abs(menu.right - btn.right) <= 1;
    var below = Math.abs(menu.top - (btn.bottom + 4)) <= 1;
    var above = Math.abs(menu.bottom - (btn.top - 4)) <= 1;
    return menu.width > 0 && menu.height > 0 && alignedRight && (below || above);
  })()`), '選單靠右對齊觸發鈕、緊貼其上下方且有尺寸');

  console.log('\nSection 3｜再點一次收合、點外面收合、Esc 收合');
  await evaluate('window.__moreBtn().click()');
  await sleep(100);
  assertEq(await evaluate('window.__menuItems()'), [], '再點更多按鈕即收合');
  await evaluate('window.__moreBtn().click()');
  await sleep(100);
  await evaluate(`document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  await sleep(100);
  assertEq(await evaluate('window.__menuItems()'), [], '點選單外面即收合');
  await evaluate('window.__moreBtn().click()');
  await sleep(100);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await sleep(100);
  assertEq(await evaluate('window.__menuItems()'), [], '按 Esc 即收合');

  console.log('\nSection 4｜選項行為');
  await evaluate('window.__moreBtn().click()');
  await sleep(100);
  await evaluate(`window.__clickMenuItem('下載 PDF')`);
  await sleep(300);
  assertEq(await evaluate('window.__pdfCalls'), ['20260825001'], '點「下載 PDF」呼叫匯出');
  assertEq(await evaluate('window.__menuItems()'), [], '點選項後選單關閉');

  await evaluate('window.__toasts = []; window.__moreBtn().click()');
  await sleep(100);
  await evaluate(`window.__clickMenuItem('複製URL')`);
  await sleep(200);
  assertTrue(await evaluate(`window.__toasts.some(function (t) { return String(t).indexOf('20260825001') !== -1; })`),
    '點「複製URL」提示已複製案件連結', await evaluate('JSON.stringify(window.__toasts)'));
  assertEq(await evaluate('window.__copied'), ['https://system.jinchuan.com/case/20260825001'],
    '複製的是該案件的連結');

  console.log('\nSection 5｜列表被移除時選單一併收掉');
  await evaluate('window.__moreBtn().click()');
  await sleep(100);
  assertEq(await evaluate(`document.querySelectorAll('.action-menu__menu').length`), 1, '選單已開啟');
  await evaluate(`document.getElementById('list-host').remove()`);
  await sleep(400);
  assertEq(await evaluate(`document.querySelectorAll('.action-menu__menu').length`), 0,
    '觸發鈕離開文件後浮動選單自動移除');

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
