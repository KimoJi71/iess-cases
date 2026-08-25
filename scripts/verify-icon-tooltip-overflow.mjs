#!/usr/bin/env node
/**
 * 圖示按鈕 tooltip 不被表格裁切驗證：
 * 列表操作欄在 overflow-x-auto 容器內，tooltip 於 hover／focus 時改以 fixed 定位，
 * 可超出表格範圍完整顯示；上方空間不足時往按鈕下方翻，並靠齊視窗邊界。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9382);

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
  '--window-size=1400,1000',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-icon-tooltip-profile',
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
    window.__mkCase = function (extra) {
      return Object.assign({
        id: 'C1', caseNumber: '20260825001', customerName: '測試客戶', storeName: '測試門市',
        companyCity: '台北市', companyDistrict: '中山區', workCategory: '一般叫修',
        repairItem: '室內機', repairReason: '不冷', faultDesc: '出風不冷',
        actualReason: '冷媒不足', assignees: [], isClosed: false, processStatus: null,
        createdAt: '${todayDate} 09:00:00', repairDate: '${todayDate} 09:00:00',
        expectedDate: '${todayDate}', processRecords: [], equipment: null
      }, extra || {});
    };
    window.__mkList = function () {
      var old = document.getElementById('tip-host');
      if (old) old.remove();
      var host = document.createElement('div');
      host.id = 'tip-host';
      document.body.appendChild(host);
      host.appendChild(CaseList({
        cases: [window.__mkCase()],
        setCases: function () {},
        stores: [], setStores: function () {},
        setEditingCase: function () {}, setView: function () {}, showToast: function () {},
        statusFilter: '未處理', setStatusFilter: function () {}
      }));
      host.scrollIntoView({ block: 'center' });
      return true;
    };
    // 操作欄第 2 顆（結案鈕，停用時 tooltip 文字最長）
    window.__wrap = function () {
      return document.querySelectorAll('#tip-host tbody tr:first-child td:first-child .icon-tooltip')[1];
    };
    window.__tip = function () { return window.__wrap().querySelector('.icon-tooltip__tip'); };
    window.__hover = function () {
      window.__wrap().dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
      return true;
    };
    window.__unhover = function () {
      window.__wrap().dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
      return true;
    };
    window.__rects = function () {
      var tip = window.__tip();
      var btn = window.__wrap().querySelector('button');
      var scroller = window.__wrap().closest('.overflow-x-auto');
      return {
        tip: tip.getBoundingClientRect().toJSON(),
        btn: btn.getBoundingClientRect().toJSON(),
        scroller: scroller.getBoundingClientRect().toJSON(),
        position: getComputedStyle(tip).position,
        zIndex: getComputedStyle(tip).zIndex,
        text: tip.textContent,
        clientW: tip.clientWidth,
        scrollW: tip.scrollWidth,
        innerWidth: window.innerWidth
      };
    };
    'ok'`);

  console.log('\nSection 1｜hover 時改用 fixed 浮出表格');
  await evaluate('window.__mkList()');
  assertEq(await evaluate(`getComputedStyle(window.__tip()).position`), 'absolute',
    '未 hover 時維持 CSS 預設定位');
  await evaluate('window.__hover()');
  await sleep(100);
  const r = await evaluate('window.__rects()');
  assertEq(r.text, '請先於維修結果選擇處理狀態', '取到的是結案鈕的停用提示');
  assertEq(r.position, 'fixed', 'hover 時 tooltip 改為 fixed 定位');
  assertTrue(r.tip.left < r.scroller.left,
    'tooltip 超出表格左緣（證明已脫離 overflow 容器）',
    `tip.left=${r.tip.left} scroller.left=${r.scroller.left}`);
  assertEq(r.scrollW, r.clientW, 'tooltip 文字未被截斷（scrollWidth 等於 clientWidth）');
  assertTrue(r.tip.left >= 8 && r.tip.right <= r.innerWidth - 8,
    'tooltip 完整落在視窗內', `left=${r.tip.left} right=${r.tip.right} innerWidth=${r.innerWidth}`);
  assertTrue(Math.abs(r.tip.bottom - (r.btn.top - 6)) <= 1,
    'tooltip 貼在按鈕上方 6px', `tip.bottom=${r.tip.bottom} btn.top=${r.btn.top}`);

  console.log('\nSection 2｜捲動時跟著按鈕重新定位');
  await evaluate(`(function () {
    var spacer = document.getElementById('tip-spacer');
    if (!spacer) {
      spacer = document.createElement('div');
      spacer.id = 'tip-spacer';
      spacer.style.height = '2000px';
      document.body.appendChild(spacer);
    }
    window.scrollTo(0, 0);
    return true;
  })()`);
  await evaluate('window.__unhover(); window.__hover()');
  await sleep(100);
  const before = await evaluate('window.__rects()');
  await evaluate('window.scrollBy(0, 120)');
  await sleep(150);
  const after = await evaluate('window.__rects()');
  assertTrue(Math.abs(after.btn.top - before.btn.top) > 50, '頁面確實捲動了',
    `btn.top ${before.btn.top} → ${after.btn.top}`);
  assertTrue(Math.abs(after.tip.bottom - (after.btn.top - 6)) <= 1,
    '捲動後 tooltip 仍貼齊按鈕', `tip.bottom=${after.tip.bottom} btn.top=${after.btn.top}`);
  await evaluate('window.__unhover()');

  console.log('\nSection 3｜上方空間不足時往下翻');
  const flipped = await evaluate(`(function () {
    var host = document.getElementById('flip-host');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'flip-host';
    host.style.position = 'fixed';
    host.style.top = '0px';
    host.style.left = '0px';
    host.style.zIndex = '1';
    document.body.appendChild(host);
    host.appendChild(IESS.iconActionBtn({
      label: '請先於維修結果選擇處理狀態',
      className: 'p-1.5',
      icon: IESS.Icons.CheckCircle({ className: 'h-4 w-4' })
    }));
    var wrap = host.querySelector('.icon-tooltip');
    wrap.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    var tip = wrap.querySelector('.icon-tooltip__tip');
    var btn = wrap.querySelector('button');
    return {
      tip: tip.getBoundingClientRect().toJSON(),
      btn: btn.getBoundingClientRect().toJSON(),
      position: getComputedStyle(tip).position
    };
  })()`);
  assertEq(flipped.position, 'fixed', '視窗頂端的按鈕 tooltip 同樣改為 fixed');
  assertTrue(Math.abs(flipped.tip.top - (flipped.btn.bottom + 6)) <= 1,
    '上方空間不足時 tooltip 翻到按鈕下方',
    `tip.top=${flipped.tip.top} btn.bottom=${flipped.btn.bottom}`);
  assertTrue(flipped.tip.left >= 8, 'tooltip 靠齊視窗左緣不外溢', `left=${flipped.tip.left}`);
  await evaluate(`(function () {
    var host = document.getElementById('flip-host');
    host.querySelector('.icon-tooltip').dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
    host.remove();
    return true;
  })()`);

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
