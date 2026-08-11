#!/usr/bin/env node
/**
 * 「開始保養時間：於開幕 N 個月後開始保養」驗證腳本。
 * Section 1 以 node:vm 載入 IIFE 模組做純函式驗證；
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
function assertDeep(actual, expected, name) {
  assertEq(JSON.stringify(actual), JSON.stringify(expected), name);
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
load('src/features/customer/store-utils.js');
load('src/features/permissions/service-level-utils.js');
load('src/features/scheduling/schedule-utils.js');
const CU = sandbox.CustomerUtils;
const SU = sandbox.ScheduleUtils;

// 甲客戶：開幕 6 個月後才保養；乙客戶：未設定（視為 0）；丙客戶：設定為空字串。
const CUSTOMERS = [
  { id: 'C1', name: '甲客戶', serviceLevel: 'A 保修(一年四次)', enabled: true,
    maintenanceStartMonths: 6, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 }
    ] },
  { id: 'C2', name: '乙客戶', serviceLevel: 'A 保修(一年四次)', enabled: true, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 }
    ] },
  { id: 'C3', name: '丙客戶', serviceLevel: 'A 保修(一年四次)', enabled: true,
    maintenanceStartMonths: '', periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 }
    ] },
  { id: 'C4', name: '丁客戶', serviceLevel: 'A 保修(一年四次)', enabled: true,
    maintenanceStartMonths: -3, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 }
    ] },
  { id: 'C5', name: '戊客戶', serviceLevel: 'A 保修(一年四次)', enabled: true,
    maintenanceStartMonths: 2.7, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 }
    ] },
  // 己客戶：半年一次的區間（1-6／7-12），用來驗「門市在區間中段開幕」的情境。
  { id: 'C6', name: '己客戶', serviceLevel: 'B 保修(一年兩次)', enabled: true,
    maintenanceStartMonths: 6, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 6 },
      { visitIndex: 2, startMonth: 7, endMonth: 12 }
    ] },
  // 庚客戶：完全沒有設定保養區間，用來驗列表端退回 planDate／dueMonth 的分支。
  { id: 'C7', name: '庚客戶', serviceLevel: 'B 保修(一年兩次)', enabled: true,
    maintenanceStartMonths: 6, periods: [] }
];

console.log('Section 1｜CustomerUtils.getMaintenanceStartMonths');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, '甲客戶'), 6, '讀到設定值');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, '乙客戶'), 0, '未設定欄位視為 0');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, '丙客戶'), 0, '空字串視為 0');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, '丁客戶'), 0, '負數夾成 0');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, '戊客戶'), 2, '非整數無條件捨去');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, '查無此客戶'), 0, '查無客戶視為 0');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, ''), 0, '客戶名稱為空視為 0');
assertEq(CU.getMaintenanceStartMonths(null, '甲客戶'), 0, 'customers 為 null 視為 0');

console.log('\nSection 1｜CustomerUtils.getMaintenanceStartMonth');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '甲客戶', openDate: '2024-03-15' }), '2024-09',
  '2024-03 + 6 個月 = 2024-09（不看日）');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '甲客戶', openDate: '2024-10-01' }), '2025-04',
  '跨年：2024-10 + 6 個月 = 2025-04');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '甲客戶', openDate: '2024-07-31' }), '2025-01',
  '跨年邊界：2024-07 + 6 個月 = 2025-01');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '乙客戶', openDate: '2024-03-15' }), '2024-03',
  '未設定時起始保養月即開幕月');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '甲客戶', openDate: '' }), '', '無開幕日期回空字串');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '甲客戶' }), '', '缺 openDate 欄位回空字串');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '甲客戶', openDate: '不是日期' }), '', '開幕日期格式無效回空字串');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS, null), '', 'store 為 null 回空字串');

console.log('\nSection 1｜CustomerUtils.isMaintenanceStartedForMonth');
const STORE_A = { customerName: '甲客戶', storeName: '甲一店', openDate: '2024-03-15' };
assertTrue(CU.isMaintenanceStartedForMonth(CUSTOMERS, STORE_A, '2024-09'),
  '起始保養月當月即達標');
assertTrue(CU.isMaintenanceStartedForMonth(CUSTOMERS, STORE_A, '2025-01'),
  '起始保養月之後達標');
assertTrue(!CU.isMaintenanceStartedForMonth(CUSTOMERS, STORE_A, '2024-08'),
  '起始保養月前一個月未達標');
assertTrue(!CU.isMaintenanceStartedForMonth(CUSTOMERS, STORE_A, '2024-03'),
  '開幕當月未達標');
assertTrue(!CU.isMaintenanceStartedForMonth(CUSTOMERS,
  { customerName: '甲客戶', storeName: '無開幕日店' }, '2026-08'),
  '門市無開幕日期時視為未達標');
assertTrue(CU.isMaintenanceStartedForMonth(CUSTOMERS,
  { customerName: '乙客戶', storeName: '乙一店', openDate: '2026-08-20' }, '2026-08'),
  '未設定欄位的客戶，開幕當月即達標');
assertTrue(!CU.isMaintenanceStartedForMonth(CUSTOMERS, STORE_A, ''),
  '參考月為空字串時視為未達標');
assertTrue(!CU.isMaintenanceStartedForMonth(CUSTOMERS, STORE_A, '2024'),
  '參考月格式無效時視為未達標');
assertTrue(!CU.isMaintenanceStartedForMonth(CUSTOMERS, null, '2026-08'),
  'store 為 null 時視為未達標');

const STORES = [
  // 甲客戶（6 個月）：2024-03 開幕 → 起始保養月 2024-09
  { customerName: '甲客戶', storeName: '甲一店', storeStatus: '正常營業',
    companyCity: '台北市', companyDistrict: '信義區',
    serviceLevel: 'A 保修(一年四次)', openDate: '2024-03-15' },
  // 甲客戶（6 個月）：2026-06 開幕 → 起始保養月 2026-12
  { customerName: '甲客戶', storeName: '甲新店', storeStatus: '正常營業',
    companyCity: '台北市', companyDistrict: '大安區',
    serviceLevel: 'A 保修(一年四次)', openDate: '2026-06-01' },
  // 甲客戶：沒有開幕日期
  { customerName: '甲客戶', storeName: '甲無開幕店', storeStatus: '正常營業',
    companyCity: '台北市', companyDistrict: '中山區',
    serviceLevel: 'A 保修(一年四次)' },
  // 乙客戶（未設定 → 0）：2026-08 開幕，當月即可保養
  { customerName: '乙客戶', storeName: '乙新店', storeStatus: '正常營業',
    companyCity: '台中市', companyDistrict: '西屯區',
    serviceLevel: 'A 保修(一年四次)', openDate: '2026-08-20' },
  // 己客戶（6 個月）：2026-02 開幕 → 起始保養月 2026-08，落在第 2 次區間（7-12）中段
  { customerName: '己客戶', storeName: '己中段店', storeStatus: '正常營業',
    companyCity: '台南市', companyDistrict: '東區',
    serviceLevel: 'B 保修(一年兩次)', openDate: '2026-02-10' },
  // 庚客戶（6 個月、無區間）：2026-06 開幕 → 起始保養月 2026-12
  { customerName: '庚客戶', storeName: '庚無區間店', storeStatus: '正常營業',
    companyCity: '桃園市', companyDistrict: '中壢區',
    serviceLevel: 'B 保修(一年兩次)', openDate: '2026-06-01' }
];

function generatedFor(cases, storeName) {
  return cases.filter(function (c) { return c.storeName === storeName; });
}

console.log('\nSection 2｜generateDueMaintenanceCases 依起始保養月擋單');
const gen = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, [], '2026-08');
assertEq(generatedFor(gen, '甲一店').length, 1, '已滿期門市照常建單');
assertEq(generatedFor(gen, '甲新店').length, 0, '未滿起始保養月的門市不建單');
assertEq(generatedFor(gen, '甲無開幕店').length, 0, '沒有開幕日期的門市不建單');
assertEq(generatedFor(gen, '乙新店').length, 1, '客戶未設定月數時，開幕當月即建單');

const genLater = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, [], '2026-12');
assertEq(generatedFor(genLater, '甲新店').length, 1, '到達起始保養月當月即開始建單');

const genBefore = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, [], '2026-11');
assertEq(generatedFor(genBefore, '甲新店').length, 0, '起始保養月前一個月仍不建單');

// 已存在的案件仍會被回填區間身分，不因新規則被刪除或改寫。
const existing = [{
  id: 'M1', customerName: '甲客戶', storeName: '甲新店', status: '未保養',
  planDate: '', dueMonth: '2026-07', isClosed: false
}];
const genKeep = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, existing, '2026-08');
assertEq(genKeep.filter(function (c) { return c.id === 'M1'; }).length, 1,
  '未滿期門市既有的案件不會被產生端移除');

console.log('\nSection 3｜ScheduleUtils.caseMaintenanceStarted');
// 語意：一滿 N 個月，當期的保養單就要出現 —— 列表端看區間的「結束月」，
// 只要區間內有任何一個月已達起始保養月就列出，與產生端（看當月）對齊。
// 甲新店（2026-06 開幕 + 6 個月 → 起始保養月 2026-12）
assertTrue(!SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '甲新店', periodYear: 2026, periodVisitIndex: 3 },
  CUSTOMERS, STORES),
  '2026 年第 3 次區間（結束月 2026-09）整段都早於起始保養月 2026-12，不列出');
assertTrue(SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '甲新店', periodYear: 2026, periodVisitIndex: 4 },
  CUSTOMERS, STORES),
  '2026 年第 4 次區間（10-12 月）內含起始保養月 2026-12，列出');
assertTrue(SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '甲新店', periodYear: 2027, periodVisitIndex: 1 },
  CUSTOMERS, STORES),
  '2027 年第 1 次區間（結束月 2027-03）晚於起始保養月，列出');
assertTrue(SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '甲一店', periodYear: 2026, periodVisitIndex: 3 },
  CUSTOMERS, STORES),
  '已滿期門市的案件照常列出');
assertTrue(!SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '甲無開幕店', periodYear: 2026, periodVisitIndex: 3 },
  CUSTOMERS, STORES),
  '門市沒有開幕日期時不列出');
// 己中段店（2026-02 開幕 + 6 個月 → 起始保養月 2026-08，落在 7-12 月區間中段）
assertTrue(SU.caseMaintenanceStarted(
  { customerName: '己客戶', storeName: '己中段店', periodYear: 2026, periodVisitIndex: 2,
    status: '未保養' },
  CUSTOMERS, STORES),
  '起始保養月落在區間中段（2026-08 於 7-12 月內）時，當期案件就要列出');
assertTrue(!SU.caseMaintenanceStarted(
  { customerName: '己客戶', storeName: '己中段店', periodYear: 2026, periodVisitIndex: 1,
    status: '未保養' },
  CUSTOMERS, STORES),
  '同門市 2026 年第 1 次區間（結束月 2026-06）仍早於起始保養月，不列出');

console.log('\nSection 3｜已進入作業流程的案件豁免此規則');
assertTrue(SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '甲新店', periodYear: 2026, periodVisitIndex: 3,
    status: '未保養', planDate: '2026-08-05' },
  CUSTOMERS, STORES),
  '未達起始保養月但已排定日期（有 planDate）時仍列出');
assertTrue(SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '甲新店', periodYear: 2026, periodVisitIndex: 3,
    status: '已預約' },
  CUSTOMERS, STORES),
  '未達起始保養月但狀態已非「未保養」（已預約）時仍列出');
assertTrue(!SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '甲新店', periodYear: 2026, periodVisitIndex: 3,
    status: '未保養', planDate: '' },
  CUSTOMERS, STORES),
  '狀態為「未保養」且無 planDate 時不豁免，照規則擋下');

console.log('\nSection 3｜解析不到區間時退回 planDate／dueMonth 的年月');
// 庚客戶完全沒有設定保養區間，resolveCasePeriod 一定回 null，
// 因此走的是 resolveMaintenanceReferenceDate 的 fallback 分支。
assertTrue(!SU.caseMaintenanceStarted(
  { customerName: '庚客戶', storeName: '庚無區間店', status: '未保養', dueMonth: '2026-08' },
  CUSTOMERS, STORES),
  '客戶未設定區間時用 dueMonth 的年月判斷（2026-08 早於起始保養月 2026-12）');
assertTrue(SU.caseMaintenanceStarted(
  { customerName: '庚客戶', storeName: '庚無區間店', status: '未保養', dueMonth: '2027-01' },
  CUSTOMERS, STORES),
  '客戶未設定區間時用 dueMonth 的年月判斷（2027-01 已達起始保養月）');
assertTrue(SU.caseMaintenanceStarted(
  { customerName: '庚客戶', storeName: '庚無區間店', status: '未保養', planDate: '2026-08-05' },
  CUSTOMERS, STORES),
  '客戶未設定區間但案件已排定日期時，由豁免條件先行放過');
// 甲新店 + planDate 2026-08-05 會被 resolveCasePeriod 用 planDate 月份回推成第 3 次區間，
// 走的是區間分支而非 planDate 分支（現已先被 planDate 豁免攔下）。
assertTrue(SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '甲新店', status: '未保養', planDate: '2027-01-05' },
  CUSTOMERS, STORES),
  'planDate 已在起始保養月之後時列出');
// 資料不全時不套用此規則，避免案件無聲消失
assertTrue(SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '不存在的門市', periodYear: 2026, periodVisitIndex: 3 },
  CUSTOMERS, STORES),
  '查無門市時不套用此規則');
assertTrue(SU.caseMaintenanceStarted(
  { customerName: '甲客戶', storeName: '甲新店', status: '未保養' },
  CUSTOMERS, STORES),
  '案件既無區間身分也無日期時不套用此規則');
assertTrue(SU.caseMaintenanceStarted(null, CUSTOMERS, STORES),
  '案件為 null 時不套用此規則');

console.log('\nSection 3｜不變式：產生端開的單，列表端一定看得到');
// 逐月跑產生端，斷言每一筆新產生的案件在列表端都不會被擋下。
// 這條不變式比任何個案斷言都重要：違反時就會出現「開了單卻永遠不顯示」的
// 孤兒案件——它卡在案件排程待辦、可派工，卻因為進不了保養計劃進度而無法結案。
const invariantViolations = [];
let invariantGenerated = 0;
for (let y = 2024; y <= 2028; y++) {
  for (let m = 1; m <= 12; m++) {
    const month = y + '-' + String(m).padStart(2, '0');
    SU.generateDueMaintenanceCases(CUSTOMERS, STORES, [], month).forEach(function (c) {
      invariantGenerated++;
      if (!SU.caseMaintenanceStarted(c, CUSTOMERS, STORES)) {
        invariantViolations.push(month + ' ' + c.storeName
          + ' 第' + c.periodVisitIndex + '次/' + c.periodYear);
      }
    });
  }
}
assertTrue(invariantGenerated > 0, '不變式測試確實有產生案件', `共 ${invariantGenerated} 筆`);
assertTrue(invariantViolations.length === 0,
  '2024-01～2028-12 逐月產生的每一筆案件，caseMaintenanceStarted 皆為 true',
  invariantViolations.length ? invariantViolations.slice(0, 5).join('、') : '無違反');
// 中段開幕的門市（己中段店：2026-02 開幕 + 6 個月）必須實際被涵蓋到，
// 否則這條不變式可能只是因為沒踩到該情境而通過。
const invariantMidStore = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, [], '2026-08')
  .filter(function (c) { return c.storeName === '己中段店'; });
assertEq(invariantMidStore.length, 1, '中段開幕門市在起始保養月當月確實會開單');
assertTrue(SU.caseMaintenanceStarted(invariantMidStore[0], CUSTOMERS, STORES),
  '該筆中段開幕門市的案件在列表端看得到');

// ---------- headless Chrome 區段 ----------
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9346);
if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-maintenance-start-profile',
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

  console.log('\nSection 4｜保養計劃進度列表');
  assertTrue(await clickByText('保養計劃進度'), '可導覽到保養計劃進度');
  await sleep(1200);
  const listText = await evaluate(`(function () {
    var tbody = document.querySelector('table tbody');
    return tbody ? tbody.textContent : '';
  })()`);
  assertTrue(listText.indexOf('北屯崇德店') === -1,
    '未達開始保養時間的門市不出現在保養計劃進度');
  assertTrue(listText.indexOf('大安忠孝店') !== -1,
    '已達開始保養時間的門市照常出現');

  console.log('\nSection 4｜客戶管理的「開始保養時間」欄位');
  assertTrue(await clickByText('客戶管理'), '可導覽到客戶管理');
  await sleep(1200);
  const opened = await evaluate(`(function () {
    var rows = Array.prototype.slice.call(document.querySelectorAll('table tbody tr'));
    var row = rows.filter(function (r) {
      return r.textContent.indexOf('星巴克') !== -1;
    })[0];
    if (!row) return false;
    var btn = row.querySelector('button[aria-label="編輯"]');
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  assertTrue(opened, '可開啟星巴克的編輯表單');
  await sleep(1000);
  const startMonthsValue = await evaluate(
    `(function () {
      var el = document.querySelector('input[name="maintenanceStartMonths"]');
      return el ? el.value : null;
    })()`);
  assertEq(startMonthsValue, '6', '編輯表單帶出客戶已設定的開始保養時間');
  const helperText = await evaluate(`(function () {
    var el = document.querySelector('input[name="maintenanceStartMonths"]');
    return el ? el.parentNode.textContent.replace(/\\s+/g, '') : '';
  })()`);
  assertTrue(helperText.indexOf('於開幕') !== -1 && helperText.indexOf('個月後開始保養') !== -1,
    '欄位有「於開幕 N 個月後開始保養」說明文字', helperText);

  console.log('\nSection 4｜門市開幕日期必填');
  assertTrue(await clickByText('門市管理'), '可導覽到門市管理');
  await sleep(1200);
  // 門市管理頁需先透過客戶下拉（searchable-select 元件）篩選客戶才會顯示門市列表。
  // 該元件的選項是以 mousedown（而非 click）觸發選取，且清單以 portal 掛在 document.body 下。
  const pickedCustomer = await evaluate(`(function () {
    var toggle = document.querySelector('.searchable-select__toggle[aria-label="展開選項"]');
    if (!toggle) return false;
    toggle.click();
    var btns = Array.prototype.slice.call(document.querySelectorAll('.searchable-select__menu li button'));
    var target = btns.filter(function (b) { return b.textContent.trim() === '屈臣氏'; })[0];
    if (!target) return false;
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    return true;
  })()`);
  assertTrue(pickedCustomer, '可在門市管理選取客戶');
  await sleep(300);
  assertTrue(await clickByText('搜尋'), '可觸發門市搜尋');
  await sleep(1200);
  const openDateRequired = await evaluate(`(function () {
    var rows = Array.prototype.slice.call(document.querySelectorAll('table tbody tr'));
    var btn = rows.length ? rows[0].querySelector('button[aria-label="編輯"]') : null;
    if (!btn) return null;
    btn.click();
    return true;
  })()`);
  assertTrue(openDateRequired === true, '可開啟門市編輯表單');
  await sleep(1000);
  assertEq(await evaluate(
    `(function () {
      var el = document.querySelector('input[name="openDate"]');
      return el ? el.required : null;
    })()`), true, '開幕日期為必填欄位');

  assertEq(consoleErrors.length, 0, '操作後仍無 JS 錯誤');
} catch (err) {
  // 沒有 catch 的話，UI 區段的例外會變成 unhandled rejection，
  // 讓腳本跳過結尾的統計與 process.exit，以難以判讀的方式結束。
  fail('UI 驗證中斷', err && err.stack ? err.stack : String(err));
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}

console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
