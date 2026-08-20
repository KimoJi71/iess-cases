#!/usr/bin/env node
/**
 * Executed UI verification: 門市管理的匯入選單（下載匯入範例／匯入門市）與匯出門市按鈕。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9351);

if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

let passed = 0, failed = 0;
const pass = (n, d) => { passed++; console.log(`  ✓ ${n}${d ? ` — ${d}` : ''}`); };
const fail = (n, d) => { failed++; console.error(`  ✗ ${n}${d ? ` — ${d}` : ''}`); };
function assertEq(actual, expected, name) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass(name, a); else fail(name, `expected ${e}, got ${a}`);
}
function assertTrue(cond, name, detail) { if (cond) pass(name, detail); else fail(name, detail); }

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-store-import-profile',
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
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
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
      consoleErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
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

  await evaluate(`
    window.__st = { stores: [], toasts: [] };
    window.__node = StoreList({
      stores: [{
        id: 'S1', customerName: '屈臣氏', storeCode: 'WT-001', storeName: '台北信義店',
        serviceLevel: 'A 保修(一年四次)', companyPhone: '02-1', storeStatus: '正常營業',
        createdDate: todayDate
      }],
      setStores: function (next) { window.__st.stores = next; },
      customers: [{ id: 'C1', name: '屈臣氏', serviceLevel: 'A 保修(一年四次)' }],
      storeCustomer: '屈臣氏', setStoreCustomer: function () {},
      setEditingCase: function () {}, openStoreEdit: function () {},
      openStoreHistory: function () {}, setView: function () {},
      showToast: function (msg, type) { window.__st.toasts.push([msg, type || 'success']); }
    });
    window.__root = document.createElement('div');
    document.body.appendChild(window.__root);
    window.__root.appendChild(window.__node);
    window.__titles = function () {
      return Array.prototype.map.call(window.__root.querySelectorAll('button'), function (b) {
        return (b.getAttribute('title') || b.getAttribute('aria-label') || b.textContent).replace(/\\s+/g, ' ').trim();
      });
    };
  `);

  console.log('\\n按鈕與順序');
  const titles = await evaluate('__titles()');
  const idxImport = titles.indexOf('匯入');
  const idxExport = titles.indexOf('匯出門市');
  const idxAdd = titles.indexOf('新增門市');
  assertTrue(idxImport >= 0, '有「匯入」按鈕');
  assertTrue(idxExport >= 0, '有「匯出門市」按鈕');
  assertTrue(idxImport < idxExport && idxExport < idxAdd, '匯入／匯出在新增門市左邊',
    `匯入=${idxImport} 匯出=${idxExport} 新增=${idxAdd}`);

  console.log('\\n匯入選單');
  const menuItems = await evaluate(`(function () {
    var btns = Array.prototype.slice.call(window.__root.querySelectorAll('button'));
    var imp = btns.filter(function (b) { return (b.getAttribute('title') || b.getAttribute('aria-label')) === '匯入'; })[0];
    imp.click();
    return Array.prototype.map.call(window.__root.querySelectorAll('.absolute button'), function (b) {
      return b.textContent.trim();
    });
  })()`);
  assertEq(menuItems, ['下載匯入範例', '匯入門市'], '選單兩個項目');

  const tplToast = await evaluate(`(function () {
    window.__st.toasts = [];
    Array.prototype.filter.call(window.__root.querySelectorAll('.absolute button'), function (b) {
      return b.textContent.trim() === '下載匯入範例';
    })[0].click();
    return window.__st.toasts;
  })()`);
  assertEq(tplToast, [['匯入範例檔案下載成功（demo）', 'success']], '下載匯入範例提示');

  console.log('\\n匯入門市');
  const importResult = await evaluate(`(function () {
    window.__st.toasts = [];
    var btns = Array.prototype.slice.call(window.__root.querySelectorAll('button'));
    var imp = btns.filter(function (b) { return (b.getAttribute('title') || b.getAttribute('aria-label')) === '匯入'; })[0];
    imp.click();
    Array.prototype.filter.call(window.__root.querySelectorAll('.absolute button'), function (b) {
      return b.textContent.trim() === '匯入門市';
    })[0].click();
    return {
      toasts: window.__st.toasts,
      total: window.__st.stores.length,
      added: window.__st.stores.slice(0, 3).map(function (s) {
        return [s.storeName, s.customerName, s.serviceLevel, s.createdDate === todayDate];
      })
    };
  })()`);
  assertEq(importResult.toasts, [['已匯入 3 筆門市', 'success']], '匯入提示');
  assertEq(importResult.total, 4, '原有 1 筆 + 匯入 3 筆');
  assertEq(importResult.added, [
    ['匯入示範一店', '屈臣氏', 'A 保修(一年四次)', true],
    ['匯入示範二店', '屈臣氏', 'A 保修(一年四次)', true],
    ['匯入示範三店', '屈臣氏', 'A 保修(一年四次)', true]
  ], '匯入資料帶入客戶／服務等級／建立日期');

  console.log('\\n匯出門市');
  const exportToast = await evaluate(`(function () {
    window.__st.toasts = [];
    var btns = Array.prototype.slice.call(window.__root.querySelectorAll('button'));
    btns.filter(function (b) { return (b.getAttribute('title') || b.getAttribute('aria-label')) === '匯出門市'; })[0].click();
    return window.__st.toasts;
  })()`);
  assertEq(exportToast, [['已匯出 1 筆門市（demo）', 'success']], '匯出提示');

  console.log('\\n未選客戶時停用');
  const disabled = await evaluate(`(function () {
    var wrap = document.createElement('div');
    var node = StoreList({
      stores: [], setStores: function () {}, customers: [],
      storeCustomer: '', setStoreCustomer: function () {},
      setEditingCase: function () {}, openStoreEdit: function () {},
      openStoreHistory: function () {}, setView: function () {},
      showToast: function () {}
    });
    document.body.appendChild(wrap);
    wrap.appendChild(node);
    var btns = Array.prototype.slice.call(wrap.querySelectorAll('button'));
    function dis(label) {
      var b = btns.filter(function (x) { return (x.getAttribute('title') || x.getAttribute('aria-label')) === label; })[0];
      return !!(b && b.disabled);
    }
    return [dis('匯入'), dis('匯出門市')];
  })()`);
  assertEq(disabled, [true, true], '未選客戶時匯入／匯出停用');

  assertEq(consoleErrors.length, 0, '操作後無 JS 錯誤');
} catch (err) {
  fail('執行失敗', err.message);
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}

console.log(`\n通過 ${passed}，失敗 ${failed}`);
process.exit(failed ? 1 : 0);
