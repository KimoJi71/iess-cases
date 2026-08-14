#!/usr/bin/env node
/**
 * 「案件處理列表：燈號欄可排序」驗證。
 * Section 1：node:vm 驗證燈號 rank（紅 0 → 黃 1 → 灰 2 → 綠 3）。
 * Section 2：headless Chrome 驗證點表頭後列順序。
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9348);

let passed = 0, failed = 0;
const pass = (n, d) => { passed++; console.log(`  ✓ ${n}${d ? ` — ${d}` : ''}`); };
const fail = (n, d) => { failed++; console.error(`  ✗ ${n}${d ? ` — ${d}` : ''}`); };
function assertEq(actual, expected, name) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) pass(name, a);
  else fail(name, `expected ${b}, got ${a}`);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

const sandbox = { console };
sandbox.window = sandbox;
sandbox.IESS = {};
vm.createContext(sandbox);
function load(relPath) {
  vm.runInContext(readFileSync(join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath.split('/').pop()
  });
}
load('src/features/repair/case-datetime.js');
load('src/features/customer/customer-utils.js');
load('src/features/repair/case-status.js');
const CS = sandbox.IESS.caseStatus;

const NOW = new Date('2026-08-14T12:00:00');
const CUSTOMERS = [{ name: '測試客戶', overtimeHours: 8 }];

function mkCase(id, createdAt, extra) {
  return Object.assign({
    id: id,
    caseNumber: id,
    customerName: '測試客戶',
    createdAt: createdAt,
    repairDate: createdAt,
    processStatus: '',
    isClosed: false
  }, extra || {});
}

const overdue = mkCase('RED', '2026-08-14 03:00:00');
const warning = mkCase('YEL', '2026-08-14 05:00:00');
const none = mkCase('GRY', '2026-08-14 10:30:00');
const complete = mkCase('GRN', '2026-08-14 01:00:00', { processStatus: '案件完成' });

console.log('\n[1] 燈號 rank：紅 0 → 黃 1 → 灰 2 → 綠 3');
assertTrue(typeof CS.getCaseListIndicatorRank === 'function', 'exports getCaseListIndicatorRank');
if (typeof CS.getCaseListIndicatorRank === 'function') {
  assertEq(CS.getCaseListIndicatorRank(overdue, CUSTOMERS, NOW), 0, '逾時紅燈 rank 0');
  assertEq(CS.getCaseListIndicatorRank(warning, CUSTOMERS, NOW), 1, '即將逾時黃燈 rank 1');
  assertEq(CS.getCaseListIndicatorRank(none, CUSTOMERS, NOW), 2, '未近期限灰燈 rank 2');
  assertEq(CS.getCaseListIndicatorRank(complete, CUSTOMERS, NOW), 3, '案件完成綠燈 rank 3');
}

if (!existsSync(CHROME)) {
  fail('chrome', `找不到 Chrome：${CHROME}`);
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=/tmp/iess-indicator-sort-check-profile-${process.pid}`,
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
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try {
      ready = await evaluate('typeof CaseList === "function"');
      if (ready) break;
    } catch { /* 頁面尚未就緒 */ }
    await sleep(200);
  }
  assertTrue(ready, '頁面已載入 CaseList');

  console.log('\n[2] 點燈號表頭可依緊急程度排序');
  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');

  await evaluate(`
    window.__stamp = function (d) {
      return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0') + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0') + ':' +
        String(d.getSeconds()).padStart(2, '0');
    };
    window.__hoursAgo = function (h) {
      return window.__stamp(new Date(Date.now() - h * 3600000));
    };
    window.__mkCase = function (id, hoursAgo, extra) {
      var at = window.__hoursAgo(hoursAgo);
      return Object.assign({
        id: id, caseNumber: id, customerName: '測試客戶', storeName: '測試門市',
        companyCity: '台北市', companyDistrict: '中山區', workCategory: '一般叫修',
        repairItem: '室內機', repairReason: '不冷', faultDesc: '', actualReason: '',
        assignees: [], isClosed: false, processStatus: '',
        createdAt: at, repairDate: at, processRecords: [], equipment: null
      }, extra || {});
    };
    window.__customers = [{ name: '測試客戶', overtimeHours: 8 }];
    window.__mountList = function () {
      var wrap = document.createElement('div');
      wrap.appendChild(CaseList({
        cases: [
          window.__mkCase('GRY', 1),
          window.__mkCase('YEL', 3),
          window.__mkCase('RED', 10),
          window.__mkCase('GRN', 20, { processStatus: '案件完成' })
        ],
        customers: window.__customers,
        setCases: function () {},
        stores: [], setStores: function () {},
        setEditingCase: function () {}, setView: function () {}, showToast: function () {},
        statusFilter: '全部', setStatusFilter: function () {}
      }));
      document.body.appendChild(wrap);
      return wrap;
    };
    window.__rowIds = function (wrap) {
      return Array.prototype.slice.call(wrap.querySelectorAll('tbody tr')).map(function (tr) {
        return tr.getAttribute('key');
      });
    };
    window.__clickIndicatorHeader = function (wrap) {
      var ths = wrap.querySelectorAll('thead th');
      for (var i = 0; i < ths.length; i++) {
        if (ths[i].textContent.indexOf('燈號') !== -1) {
          ths[i].click();
          return true;
        }
      }
      return false;
    };
    'ok'`);

  const wrapId = await evaluate(`
    (function () {
      window.__wrap = window.__mountList();
      return 'ok';
    })()
  `);
  assertEq(wrapId, 'ok', '掛上案件列表');

  const defaultOrder = await evaluate('window.__rowIds(window.__wrap)');
  assertEq(defaultOrder, ['GRY', 'YEL', 'RED', 'GRN'], '未點表頭時仍依叫修日期新到舊');

  const clicked = await evaluate('window.__clickIndicatorHeader(window.__wrap)');
  assertEq(clicked, true, '找得到燈號表頭並可點擊');

  const urgencyOrder = await evaluate('window.__rowIds(window.__wrap)');
  assertEq(urgencyOrder, ['RED', 'YEL', 'GRY', 'GRN'], '第一次點：紅 → 黃 → 灰 → 綠');

  await evaluate('window.__clickIndicatorHeader(window.__wrap)');
  const reverseOrder = await evaluate('window.__rowIds(window.__wrap)');
  assertEq(reverseOrder, ['GRN', 'GRY', 'YEL', 'RED'], '第二次點：綠 → 灰 → 黃 → 紅');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
