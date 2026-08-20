#!/usr/bin/env node
/**
 * 「門市管理：是否保養」驗證腳本。
 * Section 1／2 以 node:vm 載入 IIFE 模組做純函式驗證；
 * Section 3 以後為 headless Chrome + CDP 的 UI 驗證。
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
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
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

const sandbox = { console, SERVICE_LEVEL_OPTIONS: [] };
sandbox.window = sandbox;
vm.createContext(sandbox);
function load(relPath) {
  vm.runInContext(readFileSync(join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath.split('/').pop()
  });
}
load('src/features/customer/customer-utils.js');
load('src/features/permissions/service-level-utils.js');
load('src/features/customer/store-utils.js');
load('src/features/scheduling/schedule-utils.js');
const StoreUtils = sandbox.StoreUtils;
const SU = sandbox.ScheduleUtils;

const SERVICE_LEVELS = [
  { id: 'SL1', name: '有保養等級', maintenanceCount: 2, countsBonusPoints: false },
  { id: 'SL0', name: '無保養等級', maintenanceCount: 0, countsBonusPoints: true }
];

console.log('Section 1｜StoreUtils.getStoreMaintenanceFlag（預設由服務等級的保養次數推導）');
assertEq(StoreUtils.getStoreMaintenanceFlag({ serviceLevel: '有保養等級' }, SERVICE_LEVELS),
  '是', '保養次數 > 0 時預設為「是」');
assertEq(StoreUtils.getStoreMaintenanceFlag({ serviceLevel: '無保養等級' }, SERVICE_LEVELS),
  '否', '保養次數 = 0 時預設為「否」');
assertEq(StoreUtils.getStoreMaintenanceFlag({ serviceLevel: '查無此等級' }, SERVICE_LEVELS),
  '否', '查無服務等級時保養次數視為 0，預設為「否」');
assertEq(StoreUtils.getStoreMaintenanceFlag({ serviceLevel: '' }, SERVICE_LEVELS),
  '否', '門市沒有服務等級時預設為「否」');
assertEq(StoreUtils.getStoreMaintenanceFlag(
  { serviceLevel: '無保養等級', maintenanceFlag: '是' }, SERVICE_LEVELS),
  '是', '門市自己存了「是」時蓋過服務等級的預設');
assertEq(StoreUtils.getStoreMaintenanceFlag(
  { serviceLevel: '有保養等級', maintenanceFlag: '否' }, SERVICE_LEVELS),
  '否', '門市自己存了「否」時蓋過服務等級的預設');
assertEq(StoreUtils.getStoreMaintenanceFlag(
  { serviceLevel: '無保養等級', maintenanceFlag: '亂填' }, SERVICE_LEVELS),
  '否', '非「是／否」的值視為未設定，回到服務等級的預設');
assertEq(StoreUtils.getStoreMaintenanceFlag({ serviceLevel: '無保養等級' }, null),
  '是', '未提供服務等級資料時不套用此規則，一律回「是」');
assertEq(StoreUtils.getStoreMaintenanceFlag({ serviceLevel: '無保養等級' }, []),
  '是', '服務等級清單為空時同樣不套用此規則');
assertEq(StoreUtils.getStoreMaintenanceFlag(null, SERVICE_LEVELS),
  '否', 'store 為 null 時保養次數視為 0');
assertEq(StoreUtils.isStoreMaintenanceEnabled({ serviceLevel: '有保養等級' }, SERVICE_LEVELS),
  true, 'isStoreMaintenanceEnabled 與旗標一致（是）');
assertEq(StoreUtils.isStoreMaintenanceEnabled({ serviceLevel: '無保養等級' }, SERVICE_LEVELS),
  false, 'isStoreMaintenanceEnabled 與旗標一致（否）');

console.log('\nSection 1｜StoreUtils.isMaintainableStore（門市狀態 × 是否保養）');
const S = (status, flag) => ({ storeStatus: status, serviceLevel: '有保養等級', maintenanceFlag: flag });
assertEq(StoreUtils.isMaintainableStore(S('正常營業', '是'), SERVICE_LEVELS), true,
  '正常營業 + 是 → 納入保養計劃');
assertEq(StoreUtils.isMaintainableStore(S('正常營業', '否'), SERVICE_LEVELS), false,
  '正常營業 + 否 → 排除');
assertEq(StoreUtils.isMaintainableStore(S('整裝', '是'), SERVICE_LEVELS), false,
  '整裝 → 排除（不看是否保養）');
assertEq(StoreUtils.isMaintainableStore(S('撤店', '是'), SERVICE_LEVELS), false,
  '撤店 → 排除（不看是否保養）');
assertEq(StoreUtils.isMaintainableStore(
  { storeStatus: '正常營業', serviceLevel: '無保養等級' }, SERVICE_LEVELS), false,
  '未設定是否保養時，由服務等級推導出的「否」同樣排除');
assertEq(StoreUtils.isMaintainableStore(null, SERVICE_LEVELS), false, 'store 為 null → 排除');

console.log('\nSection 2｜generateDueMaintenanceCases 依「是否保養」擋單');
const CUSTOMERS = [
  { id: 'C1', name: '甲客戶', serviceLevel: '有保養等級', enabled: true, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 6 },
      { visitIndex: 2, startMonth: 7, endMonth: 12 }
    ] }
];
const STORES = [
  { id: 'S1', customerName: '甲客戶', storeName: '保養店', serviceLevel: '有保養等級',
    storeStatus: '正常營業', maintenanceFlag: '是', openDate: '2020-01-01' },
  { id: 'S2', customerName: '甲客戶', storeName: '不保養店', serviceLevel: '有保養等級',
    storeStatus: '正常營業', maintenanceFlag: '否', openDate: '2020-01-01' },
  { id: 'S3', customerName: '甲客戶', storeName: '未設定店', serviceLevel: '無保養等級',
    storeStatus: '正常營業', openDate: '2020-01-01' },
  { id: 'S4', customerName: '甲客戶', storeName: '整裝店', serviceLevel: '有保養等級',
    storeStatus: '整裝', maintenanceFlag: '是', openDate: '2020-01-01' }
];
const generated = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, [], '2026-08', SERVICE_LEVELS)
  .map(c => c.storeName);
assertTrue(generated.indexOf('保養店') !== -1, '「是」的門市照常開單', generated.join('／'));
assertTrue(generated.indexOf('不保養店') === -1, '「否」的門市不開單');
assertTrue(generated.indexOf('未設定店') === -1, '未設定但服務等級保養次數為 0 的門市不開單');
assertTrue(generated.indexOf('整裝店') === -1, '整裝的門市不開單（既有規則不變）');
const generatedNoLevels = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, [], '2026-08')
  .map(c => c.storeName);
assertTrue(generatedNoLevels.indexOf('未設定店') !== -1,
  '未傳 serviceLevels 時不套用此規則，未設定的門市照常開單', generatedNoLevels.join('／'));
assertTrue(generatedNoLevels.indexOf('不保養店') === -1,
  '未傳 serviceLevels 時，門市自己存的「否」仍然有效');

// ---------- headless Chrome 區段 ----------
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9351);
if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-store-maintenance-flag-profile',
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
function clickByText(text) {
  return evaluate(`(function () {
    var els = Array.prototype.slice.call(document.querySelectorAll('button, a, div'));
    var target = els.filter(function (el) {
      return el.textContent.trim() === ${JSON.stringify(text)};
    }).pop();
    if (target) target.click();
    return !!target;
  })()`);
}
// 門市管理頁需先以客戶下拉（searchable-select）篩選客戶，選項以 mousedown 觸發。
async function openStoreListFor(customerName) {
  assertTrue(await clickByText('門市管理'), `可導覽到門市管理（${customerName}）`);
  await sleep(1200);
  const picked = await evaluate(`(function () {
    var toggle = document.querySelector('.searchable-select__toggle[aria-label="展開選項"]');
    if (!toggle) return false;
    toggle.click();
    var btns = Array.prototype.slice.call(document.querySelectorAll('.searchable-select__menu li button'));
    var target = btns.filter(function (b) { return b.textContent.trim() === ${JSON.stringify(customerName)}; })[0];
    if (!target) return false;
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    return true;
  })()`);
  assertTrue(picked, `可在門市管理選取客戶「${customerName}」`);
  await sleep(300);
  assertTrue(await clickByText('搜尋'), '可觸發門市搜尋');
  await sleep(1200);
}
function openStoreEdit(storeName) {
  return evaluate(`(function () {
    var rows = Array.prototype.slice.call(document.querySelectorAll('table tbody tr'));
    var row = rows.filter(function (r) { return r.textContent.indexOf(${JSON.stringify(storeName)}) !== -1; })[0];
    if (!row) return false;
    var btn = row.querySelector('button[aria-label="編輯"]');
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
}
function checkedMaintenanceFlag() {
  return evaluate(`(function () {
    var el = document.querySelector('input[name="maintenanceFlag"]:checked');
    return el ? el.value : null;
  })()`);
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
  // Tailwind CDN 與側邊選單掛載完成前，clickByText 會找不到任何目標；
  // 固定 sleep 在冷啟動時不夠，改為輪詢等側邊選單出現。
  let booted = false;
  for (let i = 0; i < 60; i++) {
    booted = await evaluate(`!!document.body && document.body.textContent.indexOf('門市管理') !== -1`);
    if (booted) break;
    await sleep(500);
  }
  assertTrue(booted, '頁面載入完成（側邊選單已出現）');
  await sleep(1500);

  console.log('\nSection 3｜門市表單的「是否保養」radio');
  await openStoreListFor('屈臣氏');
  assertTrue(await openStoreEdit('大安忠孝店'), '可開啟屈臣氏門市的編輯表單');
  await sleep(1000);
  assertEq(await evaluate(
    `document.querySelectorAll('input[name="maintenanceFlag"][type="radio"]').length`), 2,
    '「是否保養」是兩顆 radio');
  assertEq(await evaluate(`(function () {
    var el = document.querySelector('input[name="maintenanceFlag"]');
    var group = el && el.closest('div').parentNode;
    return group ? group.textContent.replace(/\\s+/g, '') : '';
  })()`), '是否保養是否', '欄位標籤與兩個選項文字為「是否保養／是／否」');
  assertEq(await checkedMaintenanceFlag(), '是',
    'A 保修（一年四次）的門市預設為「是」');

  await openStoreListFor('統一超商');
  assertTrue(await openStoreEdit('中山店'), '可開啟統一超商門市的編輯表單');
  await sleep(1000);
  assertEq(await checkedMaintenanceFlag(), '否',
    'D 維修（保養次數 0）的門市預設為「否」');

  console.log('\nSection 4｜改為「是」後存檔會留存');
  assertEq(await evaluate(`(function () {
    var els = Array.prototype.slice.call(document.querySelectorAll('input[name="maintenanceFlag"]'));
    var yes = els.filter(function (e) { return e.value === '是'; })[0];
    if (!yes) return false;
    yes.click();
    return true;
  })()`), true, '可點選「是」');
  await sleep(300);
  assertEq(await checkedMaintenanceFlag(), '是', '點選後選取狀態改為「是」');
  assertTrue(await clickByText('儲存門市資料') || await clickByText('儲存'), '可送出表單');
  await sleep(1200);
  assertTrue(await openStoreEdit('中山店'), '可再次開啟同一門市');
  await sleep(1000);
  assertEq(await checkedMaintenanceFlag(), '是', '重新開啟表單仍為存檔後的「是」');

  console.log('\nSection 5｜改為「否」的門市從保養計劃進度消失');
  await openStoreListFor('屈臣氏');
  assertTrue(await clickByText('保養計劃進度'), '可導覽到保養計劃進度');
  await sleep(1200);
  const beforeText = await evaluate(`(function () {
    var tbody = document.querySelector('table tbody');
    return tbody ? tbody.textContent : '';
  })()`);
  assertTrue(beforeText.indexOf('大安忠孝店') !== -1, '大安忠孝店原本出現在保養計劃進度');

  await openStoreListFor('屈臣氏');
  assertTrue(await openStoreEdit('大安忠孝店'), '可開啟大安忠孝店的編輯表單');
  await sleep(1000);
  assertEq(await evaluate(`(function () {
    var els = Array.prototype.slice.call(document.querySelectorAll('input[name="maintenanceFlag"]'));
    var no = els.filter(function (e) { return e.value === '否'; })[0];
    if (!no) return false;
    no.click();
    return true;
  })()`), true, '可將該門市改為「否」');
  await sleep(300);
  assertTrue(await clickByText('儲存門市資料') || await clickByText('儲存'), '可送出表單');
  await sleep(1200);
  assertTrue(await clickByText('保養計劃進度'), '可再次導覽到保養計劃進度');
  await sleep(1200);
  const afterText = await evaluate(`(function () {
    var tbody = document.querySelector('table tbody');
    return tbody ? tbody.textContent : '';
  })()`);
  assertTrue(afterText.indexOf('大安忠孝店') === -1, '改為「否」後不再出現在保養計劃進度');

  assertEq(consoleErrors.length, 0, '操作後仍無 JS 錯誤');
} catch (err) {
  fail('UI 驗證中斷', err && err.stack ? err.stack : String(err));
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}

console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
