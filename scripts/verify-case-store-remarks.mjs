#!/usr/bin/env node
/**
 * 案件處理：編輯頁與明細頁的「門市地址」後方顯示「門市備註」，資料取自門市建檔的備註說明。
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

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-case-store-remarks-profile',
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

  await evaluate(`
    window.__stores = [{
      id: 9001, customerName: '測試客戶', storeName: '測試門市',
      companyCity: '台北市', companyDistrict: '信義區', companyAddress: '松智路X號',
      serviceLevel: '一級', storeStatus: '正常營業',
      remarks: '一樓大廳需保持整潔，施工請走後門。'
    }];
    window.__case = {
      id: 'C1', caseNumber: '20260826001', customerName: '測試客戶', storeName: '測試門市',
      storeAddress: '台北市信義區松智路X號', serviceLevel: '一級',
      workCategory: '一般叫修', repairItem: '室內機', repairReason: '不冷', faultDesc: '出風不冷',
      isClosed: false, processStatus: null, assignees: [], serviceItems: [],
      createdAt: '2026-08-26 09:00:00', repairDate: '2026-08-26 09:00:00'
    };
    // 讀出區塊「2. 案件資料」內的欄位標籤順序與指定標籤的值
    window.__fields = function (root, headingText) {
      var section = Array.prototype.find.call(root.querySelectorAll('section'), function (sec) {
        var h3 = sec.querySelector('h3');
        return h3 && h3.textContent.replace(/\\s+/g, ' ').trim().indexOf(headingText) === 0;
      });
      if (!section) return null;
      var grid = section.querySelector('div.grid');
      var out = [];
      Array.prototype.forEach.call(grid.querySelectorAll('span'), function (sp) {
        if (sp.parentNode.querySelector('span') !== sp) return;
        var box = sp.nextElementSibling;
        if (!box) return;
        out.push({ label: sp.textContent.trim(), value: box.textContent.trim() });
      });
      return out;
    };
  `);

  console.log('\n明細頁（ViewCaseForm）');
  const view = await evaluate(`(function () {
    var wrap = document.createElement('div');
    document.body.appendChild(wrap);
    wrap.appendChild(ViewCaseForm({
      viewingCase: window.__case, setView: function () {}, backView: 'list',
      stores: window.__stores,
      processMethods: [], deviceCategories: [], vehicles: [], vendors: [],
      cases: [window.__case], openPrevCase: function () {}, currentView: 'case-view'
    }));
    var fields = window.__fields(wrap, '2. 案件資料');
    var labels = fields.map(function (f) { return f.label; });
    var out = {
      labels: labels,
      afterAddress: labels[labels.indexOf('門市地址') + 1],
      remarksValue: (fields.find(function (f) { return f.label === '門市備註'; }) || {}).value
    };
    wrap.remove();
    return out;
  })()`);
  assertEq(view.afterAddress, '門市備註', '明細頁：門市備註緊接在門市地址後方');
  assertEq(view.remarksValue, '一樓大廳需保持整潔，施工請走後門。', '明細頁：門市備註取自門市建檔');

  console.log('\n編輯頁（EditCaseForm）');
  const edit = await evaluate(`(function () {
    var wrap = document.createElement('div');
    document.body.appendChild(wrap);
    wrap.appendChild(EditCaseForm({
      editingCase: window.__case, cases: [window.__case], setCases: function () {},
      stores: window.__stores, customers: [], equipments: [],
      vehicles: [], vendors: [], deviceCategories: [], processMethods: [],
      setView: function () {}, showToast: function () {}
    }));
    var fields = window.__fields(wrap, '2. 案件資料');
    var labels = fields.map(function (f) { return f.label; });
    var out = {
      afterAddress: labels[labels.indexOf('門市地址') + 1],
      remarksValue: (fields.find(function (f) { return f.label === '門市備註'; }) || {}).value
    };
    wrap.remove();
    return out;
  })()`);
  assertEq(edit.afterAddress, '門市備註', '編輯頁：門市備註緊接在門市地址後方');
  assertEq(edit.remarksValue, '一樓大廳需保持整潔，施工請走後門。', '編輯頁：門市備註取自門市建檔');

  console.log('\n門市備註為空時');
  const empty = await evaluate(`(function () {
    var wrap = document.createElement('div');
    document.body.appendChild(wrap);
    wrap.appendChild(ViewCaseForm({
      viewingCase: window.__case, setView: function () {}, backView: 'list',
      stores: [Object.assign({}, window.__stores[0], { remarks: '' })],
      processMethods: [], deviceCategories: [], vehicles: [], vendors: [],
      cases: [window.__case], openPrevCase: function () {}, currentView: 'case-view'
    }));
    var fields = window.__fields(wrap, '2. 案件資料');
    var out = (fields.find(function (f) { return f.label === '門市備註'; }) || {}).value;
    wrap.remove();
    return out;
  })()`);
  assertEq(empty, '-', '門市無備註時顯示佔位符號');

  console.log('\n門市查無資料時退回案件快照');
  const fallback = await evaluate(`(function () {
    return StoreUtils.resolveStoreRemarks([], Object.assign({}, window.__case, {
      storeRemarks: '歷程快照備註'
    }));
  })()`);
  assertEq(fallback, '歷程快照備註', 'resolveStoreRemarks 退回案件既有快照');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
