#!/usr/bin/env node
/**
 * 「維修案件編輯頁 — 四段式版面」驗證腳本。
 * 以 headless Chrome + CDP 直接呼叫 EditCaseForm 元件，
 * 驗證區塊順序、案件資料唯讀、設備加入後解鎖維修結果等規則。
 * 這是特徵測試：在把區塊搬進 RepairCaseDetailSections 之前先建立，
 * 用來證明重構前後行為一致。
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0, failed = 0;
const pass = (n, d) => { passed++; console.log(`  ✓ ${n}${d ? ` — ${d}` : ''}`); };
const fail = (n, d) => { failed++; console.error(`  ✗ ${n}${d ? ` — ${d}` : ''}`); };
function assertEq(actual, expected, name) {
  if (actual === expected) pass(name, JSON.stringify(actual));
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertDeep(actual, expected, name) {
  assertEq(JSON.stringify(actual), JSON.stringify(expected), name);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9371);
if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-repair-detail-profile',
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

// 測試用的維修案件／設備／車輛／協力廠商，全部在頁面內組出來，不依賴種子資料
const SETUP = `(function () {
  window.__written = { cases: null, toasts: [] };
  window.__equipments = [
    { id: 'E1', customerName: '維修客戶', storeName: '維修門市', category: '分離式冷氣',
      brand: '大金', deviceName: '一樓內機', specification: '3噸', model: 'DK-100',
      area: '一樓', acceptanceDate: '2024-01-10', installer: '王工',
      assetNumber: 'A-001', serialNumber: 'S-001', status: '運轉中' },
    { id: 'E2', customerName: '維修客戶', storeName: '維修門市', category: '分離式冷氣',
      brand: '日立', deviceName: '二樓內機', specification: '5噸', model: 'HT-200',
      area: '二樓', acceptanceDate: '2024-02-10', installer: '李工',
      assetNumber: 'A-002', serialNumber: 'S-002', status: '運轉中' }
  ];
  window.__mountEdit = function (overrides) {
    var host = document.getElementById('edit-host');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'edit-host';
    document.body.appendChild(host);
    var target = Object.assign({
      id: 'C-T1', caseNumber: 'R20260826001', customerName: '維修客戶',
      storeName: '維修門市', reporter: '陳小姐', serviceLevel: 'A 全約',
      storeAddress: '台北市大安區忠孝東路X號', workCategory: '維修',
      repairItem: '冷氣', repairReason: '不冷', faultDesc: '出風不冷',
      expectedDate: '2026-08-26', expectedTimeStart: '09:00', expectedTimeEnd: '11:00',
      assignees: [], assigneeMemberIds: [], partnerVendorIds: [],
      serviceItems: [], isClosed: false, processStatus: null, repairRemark: ''
    }, overrides || {});
    host.appendChild(EditCaseForm({
      editingCase: target,
      cases: [target],
      setCases: function (next) { window.__written.cases = next; },
      stores: [{ customerName: '維修客戶', storeName: '維修門市', companyCity: '台北市',
        companyDistrict: '大安區', companyAddress: '忠孝東路X號' }],
      customers: [{ name: '維修客戶', enabled: true }],
      vehicles: [{ id: 'CAR1', plate: 'ABC-1234', enabled: true }],
      vendors: [{ id: 'V1', name: '大同協力', type: '協力商' }],
      equipments: window.__equipments,
      deviceCategories: [],
      processMethods: (typeof INITIAL_PROCESS_METHODS !== 'undefined' ? INITIAL_PROCESS_METHODS : []),
      setView: function () {},
      showToast: function (msg) { window.__written.toasts.push(msg); }
    }));
    return true;
  };
  window.__sectionTitles = function (scope) {
    return Array.prototype.map.call(
      document.querySelectorAll(scope + ' section h3'),
      function (el) { return el.textContent.trim(); });
  };
  window.__sectionByTitle = function (scope, title) {
    return Array.prototype.slice.call(document.querySelectorAll(scope + ' section'))
      .filter(function (s) {
        var h3 = s.querySelector('h3');
        return h3 && h3.textContent.trim() === title;
      })[0] || null;
  };
  window.__editableCount = function (scope, title) {
    var section = window.__sectionByTitle(scope, title);
    if (!section) return -1;
    return section.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])').length;
  };
  window.__clickText = function (text, scope) {
    var root = scope ? document.querySelector(scope) : document;
    var el = Array.prototype.slice.call(root.querySelectorAll('button'))
      .filter(function (b) { return b.textContent.trim() === text; })[0];
    if (!el) throw new Error('找不到按鈕：' + text);
    el.click();
    return true;
  };
  return true;
})()`;

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
  await evaluate(SETUP);
  await evaluate('window.__mountEdit({})');

  console.log('Section 1｜編輯頁四段式版面');
  assertEq(consoleErrors.length, 0, '載入與掛載編輯頁時無 JS 錯誤');
  assertDeep(await evaluate(`window.__sectionTitles('#edit-host')`),
    ['1. 排程資料', '2. 案件資料', '3. 設備與服務項目', '4. 維修結果'],
    '區塊依序為 排程資料／案件資料／設備與服務項目／維修結果');

  console.log('\nSection 2｜案件資料全唯讀');
  assertEq(await evaluate(`window.__editableCount('#edit-host', '2. 案件資料')`), 0,
    '案件資料沒有任何可編輯欄位');

  console.log('\nSection 3｜未加入設備時維修結果鎖住');
  assertEq(await evaluate(`(function () {
    var s = window.__sectionByTitle('#edit-host', '4. 維修結果');
    return s.querySelector('[name="processStatus"]').disabled;
  })()`), true, '未加入設備時處理狀態為 disabled');

  console.log('\nSection 4｜加入設備後解除鎖定並顯示卡片');
  await evaluate(`window.__clickText('加入設備', '#edit-host')`);
  await sleep(200);
  await evaluate(`window.__clickText('手動選擇', '#edit-host')`);
  await sleep(200);
  assertEq(await evaluate(`(function () {
    var rows = Array.prototype.slice.call(document.querySelectorAll('tr'))
      .filter(function (tr) { return tr.textContent.indexOf('一樓內機') !== -1; });
    if (!rows.length) return 'picker-not-open';
    var btn = rows[0].querySelector('button');
    if (!btn) return 'no-select-button';
    btn.click();
    return 'clicked';
  })()`), 'clicked', '設備挑選器開啟並可選到門市設備');
  assertEq(await evaluate(`(function () {
    var s = window.__sectionByTitle('#edit-host', '4. 維修結果');
    return s.querySelector('[name="processStatus"]').disabled;
  })()`), false, '加入設備後處理狀態解除鎖定');

  console.log('\nSection 5｜工項分類為「其他」時維修結果不受設備限制');
  await evaluate(`window.__mountEdit({ workCategory: '其他' })`);
  assertEq(await evaluate(`(function () {
    var s = window.__sectionByTitle('#edit-host', '4. 維修結果');
    return s.querySelector('[name="processStatus"]').disabled;
  })()`), false, '工項分類為「其他」時未加設備也可編輯維修結果');
  assertDeep(await evaluate(`window.__sectionTitles('#edit-host')`),
    ['1. 排程資料', '2. 案件資料', '3. 設備與服務項目', '4. 維修結果'],
    '「其他」分類仍為四段式版面');

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
