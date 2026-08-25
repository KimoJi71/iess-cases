#!/usr/bin/env node
/**
 * 案件處理列表「刪除」驗證：
 * 未結案案件的「更多」選單含刪除項，點選顯示確認視窗，確認後案件自列表消失；
 * 取消則不刪除；已結案（滯留列表待後續處理）案件不提供刪除。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9381);

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
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-case-list-delete-profile',
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
    window.__toasts = [];
    window.__cases = [];
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
    // setCases 會把新資料回寫並重新掛載列表，模擬 app 的重繪流程。
    window.__mkList = function (cases, filter) {
      window.__cases = cases;
      window.__filter = filter || '全部';
      window.__render();
      return true;
    };
    window.__render = function () {
      document.querySelectorAll('.action-menu__menu').forEach(function (m) { m.remove(); });
      var old = document.getElementById('list-host');
      if (old) old.remove();
      var host = document.createElement('div');
      host.id = 'list-host';
      document.body.appendChild(host);
      host.appendChild(CaseList({
        cases: window.__cases,
        setCases: function (next) { window.__cases = next; window.__render(); },
        stores: [], setStores: function () {},
        customers: [],
        setEditingCase: function () {}, setViewingCase: function () {}, setView: function () {},
        showToast: function (msg) { window.__toasts.push(msg); },
        statusFilter: window.__filter, setStatusFilter: function () {}
      }));
    };
    window.__rowNumbers = function () {
      return Array.prototype.map.call(
        document.querySelectorAll('#list-host tbody tr'),
        function (tr) { return tr.children[6] ? tr.children[6].textContent.trim() : tr.textContent.trim(); }
      );
    };
    window.__moreBtnAt = function (rowIndex) {
      var row = document.querySelectorAll('#list-host tbody tr')[rowIndex];
      return Array.prototype.slice.call(row.querySelectorAll('td:first-child button'))
        .filter(function (b) { return b.getAttribute('aria-label') === '更多'; })[0];
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
    window.__modal = function () {
      var overlay = document.querySelector('#list-host .app-modal-overlay');
      if (!overlay) return null;
      return {
        title: overlay.querySelector('h3').textContent.trim(),
        message: overlay.querySelector('p').textContent.trim(),
        buttons: Array.prototype.map.call(overlay.querySelectorAll('button'),
          function (b) { return b.textContent.trim(); })
      };
    };
    window.__clickModalBtn = function (label) {
      var overlay = document.querySelector('#list-host .app-modal-overlay');
      var btn = Array.prototype.slice.call(overlay.querySelectorAll('button'))
        .filter(function (b) { return b.textContent.trim() === label; })[0];
      if (!btn) throw new Error('視窗中找不到按鈕：' + label);
      btn.click();
      return true;
    };
    'ok'`);

  console.log('\nSection 1｜未結案案件的更多選單含刪除');
  await evaluate(`window.__mkList([
    window.__mkCase(),
    window.__mkCase({ id: 'C2', caseNumber: '20260825002' })
  ])`);
  assertEq(await evaluate('window.__rowNumbers().length'), 2, '列表兩筆未結案案件');
  await evaluate('window.__moreBtnAt(0).click()');
  await sleep(100);
  assertEq(await evaluate('window.__menuItems()'), ['下載 PDF', '複製URL', '刪除'],
    '更多選單最後一項為刪除');
  assertEq(await evaluate(`(function () {
    var btn = Array.prototype.slice.call(
      document.querySelectorAll('.action-menu__menu .action-menu__item')
    ).filter(function (b) { return b.textContent.trim() === '刪除'; })[0];
    var icon = btn.querySelector('.action-menu__item-icon');
    return {
      text: getComputedStyle(btn).color,
      icon: getComputedStyle(icon).color,
      iconStroke: getComputedStyle(icon.querySelector('svg')).stroke
    };
  })()`), { text: 'rgb(220, 38, 38)', icon: 'rgb(220, 38, 38)', iconStroke: 'rgb(220, 38, 38)' },
    '刪除項文字與圖示皆為紅色');
  assertEq(await evaluate(`(function () {
    var btn = Array.prototype.slice.call(
      document.querySelectorAll('.action-menu__menu .action-menu__item')
    ).filter(function (b) { return b.textContent.trim() === '複製URL'; })[0];
    return getComputedStyle(btn.querySelector('.action-menu__item-icon')).color;
  })()`), 'rgb(107, 114, 128)', '其他選項圖示維持灰色');

  console.log('\nSection 2｜點刪除顯示確認視窗');
  assertEq(await evaluate('window.__modal()'), null, '未點刪除前無確認視窗');
  await evaluate(`window.__clickMenuItem('刪除')`);
  await sleep(150);
  const modal = await evaluate('window.__modal()');
  assertEq(modal && modal.title, '確認刪除', '確認視窗標題為「確認刪除」');
  assertTrue(modal && modal.message.indexOf('20260825001') !== -1,
    '確認訊息帶出案件編號', modal && modal.message);
  assertEq(modal && modal.buttons, ['取消', '確認刪除'], '視窗提供取消與確認刪除');
  assertEq(await evaluate('window.__menuItems()'), [], '點刪除後選單關閉');

  console.log('\nSection 3｜取消不刪除');
  await evaluate(`window.__clickModalBtn('取消')`);
  await sleep(150);
  assertEq(await evaluate('window.__modal()'), null, '取消後視窗關閉');
  assertEq(await evaluate('window.__cases.map(function (c) { return c.caseNumber; })'),
    ['20260825001', '20260825002'], '取消後案件仍在');
  assertEq(await evaluate('window.__rowNumbers()'), ['20260825001', '20260825002'],
    '取消後列表未變');

  console.log('\nSection 4｜確認刪除後自列表消失');
  await evaluate('window.__toasts = []; window.__moreBtnAt(0).click()');
  await sleep(100);
  await evaluate(`window.__clickMenuItem('刪除')`);
  await sleep(150);
  await evaluate(`window.__clickModalBtn('確認刪除')`);
  await sleep(200);
  assertEq(await evaluate('window.__cases.map(function (c) { return c.caseNumber; })'),
    ['20260825002'], '資料中僅刪除該筆案件');
  assertEq(await evaluate('window.__rowNumbers()'), ['20260825002'], '該案件自列表消失');
  assertEq(await evaluate('window.__modal()'), null, '刪除後視窗關閉');
  assertTrue(await evaluate(`window.__toasts.some(function (t) { return String(t).indexOf('20260825001') !== -1 && String(t).indexOf('已刪除') !== -1; })`),
    '提示已刪除該案件', await evaluate('JSON.stringify(window.__toasts)'));

  console.log('\nSection 5｜已結案（滯留列表）案件不可刪除');
  await evaluate(`window.__mkList([
    window.__mkCase({ id: 'C3', caseNumber: '20260825003', processStatus: '待報價',
      isClosed: true, isListClosed: true, closeDate: '${todayDate} 10:00:00' })
  ], '待報價')`);
  assertEq(await evaluate('window.__rowNumbers()'), ['20260825003'], '滯留列表的已結案案件仍顯示');
  await evaluate('window.__moreBtnAt(0).click()');
  await sleep(100);
  assertEq(await evaluate('window.__menuItems()'), ['下載 PDF', '複製URL'],
    '已結案案件的更多選單沒有刪除');
  await evaluate(`document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  await sleep(100);

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
