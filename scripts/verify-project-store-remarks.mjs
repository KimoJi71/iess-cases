#!/usr/bin/env node
/**
 * 工程立案「新增／編輯」在門市地址後面加上「門市備註」欄位的驗證腳本。
 * 重點：欄位順序（服務等級 → 門市地址 → 門市備註）、資料來自門市主檔的備註，
 * 以及新增頁改選門市時備註會跟著換。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9386);

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
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-project-store-remarks-profile',
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

  // 共用小工具：掛載表單、讀欄位、操作可搜尋下拉。
  await evaluate(`
    window.__mount = function (node) {
      var wrap = document.createElement('div');
      document.body.appendChild(wrap);
      wrap.appendChild(node);
      return wrap;
    };
    // 「1. 案件資料」區塊裡每個欄位的標題，用來看排序。
    window.__caseLabels = function (root) {
      var sec = root.querySelectorAll('section')[0];
      return Array.prototype.map.call(sec.querySelectorAll(':scope > div > div'), function (d) {
        var l = d.querySelector('label, span');
        return l ? l.textContent.trim() : '';
      }).filter(Boolean);
    };
    // 讀某個欄位標題底下那格的文字內容。
    window.__valueOf = function (root, label) {
      var nodes = root.querySelectorAll('label, span');
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].textContent.trim() !== label) continue;
        return nodes[i].parentNode.lastElementChild.textContent.trim();
      }
      return null;
    };
    window.__pick = function (root, name, label) {
      var input = root.querySelector('[name="' + name + '"]');
      input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      var btns = Array.prototype.filter.call(
        document.querySelectorAll('.searchable-select__menu--portal .searchable-select__option'),
        function (b) { return b.textContent.trim() === label; }
      );
      if (!btns.length) throw new Error('找不到選項 ' + label);
      btns[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    };
    window.__addForm = function () {
      return window.__mount(AddProjectForm({
        cases: [], setCases: function () {}, stores: INITIAL_STORES, customers: INITIAL_CUSTOMERS,
        equipments: [], deviceCategories: INITIAL_DEVICE_CATEGORIES,
        setView: function () {}, showToast: function () {}
      }));
    };
    window.__editForm = function (customerName, storeName) {
      var c = JSON.parse(JSON.stringify(INITIAL_PROJECT_CASES[0]));
      c.customerName = customerName;
      c.storeName = storeName;
      return window.__mount(EditProjectForm({
        editingCase: c, cases: INITIAL_PROJECT_CASES, setCases: function () {},
        stores: INITIAL_STORES, customers: INITIAL_CUSTOMERS, accounts: INITIAL_ACCOUNTS,
        equipments: [], deviceCategories: INITIAL_DEVICE_CATEGORIES, repairCases: [],
        setView: function () {}, showToast: function () {}
      }));
    };
  `);

  // 種子門市 STORE1 的備註，拿來當比對基準。
  const seedRemarks = await evaluate(`(function () {
    var s = INITIAL_STORES.find(function (x) {
      return x.customerName === '屈臣氏' && x.storeName === '台北信義店';
    });
    return s.remarks;
  })()`);
  assertEq(!!seedRemarks, true, '種子門市有備註可比對');

  console.log('\n新增立案單');
  const add = await evaluate(`(function () {
    var wrap = window.__addForm();
    var empty = window.__valueOf(wrap, '門市備註');
    window.__pick(wrap, 'customerName', '屈臣氏');
    window.__pick(wrap, 'storeName', '台北信義店');
    return {
      labels: window.__caseLabels(wrap),
      empty: empty,
      remarks: window.__valueOf(wrap, '門市備註'),
      address: window.__valueOf(wrap, '門市地址')
    };
  })()`);
  assertEq(
    add.labels,
    ['工項分類', '客戶名稱 *', '門市名稱 *', '服務等級', '門市地址', '門市備註',
      '施作單位', '進場日期', '負責人員', '其他事項說明'],
    '欄位順序：門市備註緊接在門市地址後面'
  );
  assertEq(add.empty, '—', '尚未選門市時備註顯示破折號');
  assertEq(add.remarks, seedRemarks, '選好門市後帶入門市主檔的備註');
  assertEq(add.address, '台北市信義區松智路X號', '門市地址同時帶入（確認確實換了門市）');

  console.log('\n編輯工程案件');
  const edit = await evaluate(`(function () {
    var wrap = window.__editForm('屈臣氏', '台北信義店');
    return {
      labels: window.__caseLabels(wrap),
      remarks: window.__valueOf(wrap, '門市備註')
    };
  })()`);
  assertEq(
    edit.labels,
    ['工項分類', '客戶名稱 *', '門市名稱 *', '服務等級', '門市地址', '門市備註',
      '施作單位', '進場日期', '負責人員', '其他事項說明'],
    '欄位順序與新增頁一致'
  );
  assertEq(edit.remarks, seedRemarks, '編輯頁帶入門市主檔的備註');

  console.log('\n沒有備註的門市');
  const blank = await evaluate(`(function () {
    var s = INITIAL_STORES.find(function (x) { return !x.remarks; });
    if (!s) return { skipped: true };
    var wrap = window.__editForm(s.customerName, s.storeName);
    return { value: window.__valueOf(wrap, '門市備註') };
  })()`);
  assertEq(blank.skipped ? '—' : blank.value, '—', '門市沒填備註時顯示破折號不留空白');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
