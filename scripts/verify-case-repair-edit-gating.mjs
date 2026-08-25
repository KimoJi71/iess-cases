#!/usr/bin/env node
/**
 * 案件處理「編輯案件」設備前置條件驗證：
 * 「4. 服務項目」與「5. 維修結果」原則上要先加入設備才可編輯；
 * 但工項分類為「其他」時，「5. 維修結果」不受設備限制，隨時可編輯。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9372);

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
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-case-edit-gating-profile',
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
    window.__mkEq = function () {
      return {
        id: 'E1', customerName: '測試客戶', storeName: '測試門市',
        category: '空調', brand: '大金', deviceName: '室內機',
        specification: '2.2kW', model: 'FTXS', area: '廚房',
        acceptanceDate: '2020-02-01', installer: '王小明',
        assetNumber: 'A-001', serialNumber: 'SN-001', status: '運轉中',
        createdDate: '${todayDate}'
      };
    };
    window.__mkCase = function (overrides) {
      return Object.assign({
        id: 'C1', caseNumber: '20260814001', customerName: '測試客戶', storeName: '測試門市',
        companyCity: '台北市', companyDistrict: '中山區', workCategory: '一般叫修',
        repairItem: '室內機', repairReason: '不冷', faultDesc: '出風不冷',
        actualReason: '', assignees: [], isClosed: false, processStatus: null,
        createdAt: '${todayDate} 09:00:00', repairDate: '${todayDate} 09:00:00',
        expectedDate: '${todayDate}', expectedTimeStart: '09:00', expectedTimeEnd: '11:00',
        processRecords: [], equipment: window.__mkEq()
      }, overrides || {});
    };
    window.__mountEdit = function (overrides) {
      var host = document.getElementById('case-host');
      if (host) host.remove();
      host = document.createElement('div');
      host.id = 'case-host';
      document.body.appendChild(host);
      host.appendChild(EditCaseForm({
        editingCase: window.__mkCase(overrides),
        cases: [window.__mkCase(overrides)],
        setCases: function () {},
        stores: [], customers: [], equipments: [window.__mkEq()],
        vehicles: [], vendors: [], deviceCategories: [], processMethods: [],
        setView: function () {}, showToast: function () {}
      }));
      return true;
    };
    window.__sectionByTitle = function (title) {
      return Array.prototype.slice.call(document.querySelectorAll('#case-host section'))
        .filter(function (s) {
          var h3 = s.querySelector('h3');
          return h3 && h3.textContent.trim() === title;
        })[0] || null;
    };
    /* 區塊是否被鎖住：外層 wrapper 有 pointer-events-none */
    window.__blocked = function (title) {
      var sec = window.__sectionByTitle(title);
      if (!sec) return null;
      return !!sec.querySelector('.pointer-events-none');
    };
    /* 5. 維修結果內個別欄位的 disabled 狀態 */
    window.__resultFields = function () {
      var sec = window.__sectionByTitle('5. 維修結果');
      if (!sec) return null;
      var signBtn = Array.prototype.slice.call(sec.querySelectorAll('button'))
        .filter(function (b) { return /簽收$/.test(b.textContent.trim()); })[0];
      /* 處理狀態的原生 select 會被 SearchableSelect 換成 input[role=combobox] */
      var statusEl = sec.querySelector('[name=processStatus]');
      var remarkEl = sec.querySelector('textarea[name=repairRemark]');
      return {
        status: statusEl.disabled,
        statusPlaceholder: statusEl.getAttribute('placeholder'),
        sign: signBtn ? signBtn.disabled : null,
        remark: remarkEl.disabled,
        remarkPlaceholder: remarkEl.getAttribute('placeholder')
      };
    };
    true;
  `);

  console.log('\nSection 1｜一般工項 × 未加入設備：兩區皆鎖定');
  await evaluate(`window.__mountEdit({ equipment: null })`);
  assertEq(await evaluate('window.__blocked("4. 服務項目")'), true, '服務項目鎖定');
  assertEq(await evaluate('window.__blocked("5. 維修結果")'), true, '維修結果鎖定');
  assertEq(await evaluate('window.__resultFields()'),
    { status: true, statusPlaceholder: '請先加入設備', sign: true,
      remark: true, remarkPlaceholder: '請先加入設備' },
    '維修結果三個欄位皆 disabled 且提示「請先加入設備」');

  console.log('\nSection 2｜一般工項 × 已加入設備：兩區皆可編輯');
  await evaluate(`window.__mountEdit()`);
  assertEq(await evaluate('window.__blocked("4. 服務項目")'), false, '服務項目可編輯');
  assertEq(await evaluate('window.__blocked("5. 維修結果")'), false, '維修結果可編輯');
  assertEq(await evaluate('window.__resultFields()'),
    { status: false, statusPlaceholder: '請選擇', sign: false,
      remark: false, remarkPlaceholder: '請輸入維修備註...' },
    '維修結果三個欄位皆可編輯');

  console.log('\nSection 3｜工項「其他」× 未加入設備：僅維修結果解鎖');
  await evaluate(`window.__mountEdit({ workCategory: '其他', equipment: null })`);
  assertEq(await evaluate('window.__blocked("4. 服務項目")'), true,
    '服務項目仍鎖定（其他不豁免服務項目）');
  assertEq(await evaluate('window.__blocked("5. 維修結果")'), false,
    '維修結果不受設備限制');
  assertEq(await evaluate('window.__resultFields()'),
    { status: false, statusPlaceholder: '請選擇', sign: false,
      remark: false, remarkPlaceholder: '請輸入維修備註...' },
    '其他案件未加設備時維修結果欄位仍可編輯');

  console.log('\nSection 4｜工項「其他」× 已加入設備：兩區皆可編輯');
  await evaluate(`window.__mountEdit({ workCategory: '其他' })`);
  assertEq(await evaluate('window.__blocked("4. 服務項目")'), false, '服務項目可編輯');
  assertEq(await evaluate('window.__blocked("5. 維修結果")'), false, '維修結果可編輯');

  console.log('\nSection 5｜種子資料有一筆未結案的「其他」案件');
  assertTrue(await evaluate(`
    (typeof INITIAL_CASES !== 'undefined' ? INITIAL_CASES : []).some(function (c) {
      return c.workCategory === '其他' && !c.isClosed;
    })
  `), '種子案件含未結案的工項分類「其他」');

  if (consoleErrors.length) console.log('ERRORS', JSON.stringify(consoleErrors));
  assertEq(consoleErrors.length, 0, '操作後仍無 JS 錯誤');
} catch (err) {
  fail('UI 驗證中斷', err && err.stack ? err.stack : String(err));
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}

console.log(`\n通過 ${passed}，失敗 ${failed}`);
process.exit(failed ? 1 : 0);
