#!/usr/bin/env node
/**
 * 「保養區間改由客戶自訂」驗證腳本。
 * Section 1 以 node:vm 載入 IIFE 模組做純函式驗證；
 * Section 2 以後為 headless Chrome + CDP 的 UI 驗證。
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
const CU = sandbox.CustomerUtils;

const CUSTOMERS = [
  { id: 'C1', name: '甲客戶', serviceLevel: 'A 保修(一年四次)', periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 3 },
    { visitIndex: 2, startMonth: 4, endMonth: 6 },
    { visitIndex: 3, startMonth: 7, endMonth: 9 },
    { visitIndex: 4, startMonth: 10, endMonth: 12 }
  ] },
  { id: 'C2', name: '乙客戶', serviceLevel: 'B 保修(一年兩次)', periods: [
    { visitIndex: 2, startMonth: 9, endMonth: 12 },
    { visitIndex: 1, startMonth: 3, endMonth: 8 }
  ] },
  { id: 'C3', name: '丙客戶', serviceLevel: 'D 維修(無簽約客戶)', periods: [] },
  { id: 'C4', name: '丁客戶', serviceLevel: 'B 保修(一年兩次)' },
  { id: 'C5', name: '半填客戶', serviceLevel: 'B 保修(一年兩次)', periods: [
    { visitIndex: 1, startMonth: '', endMonth: 6 },
    { visitIndex: 2, startMonth: 7, endMonth: 12 }
  ] }
];

console.log('Section 1｜CustomerUtils.getPeriods');
assertEq(CU.getPeriods(CUSTOMERS, '甲客戶').length, 4, '甲客戶有四個區間');
assertEq(CU.getPeriods(CUSTOMERS, '乙客戶')[0].visitIndex, 1, 'getPeriods 依 visitIndex 排序');
assertEq(CU.getPeriods(CUSTOMERS, '乙客戶')[0].startMonth, 3, '排序後第一筆為 3-8 月');
assertDeep(CU.getPeriods(CUSTOMERS, '丙客戶'), [], '無區間客戶回空陣列');
assertDeep(CU.getPeriods(CUSTOMERS, '丁客戶'), [], '缺 periods 欄位回空陣列');
assertDeep(CU.getPeriods(CUSTOMERS, '查無此客戶'), [], '查無客戶回空陣列');
assertDeep(CU.getPeriods(CUSTOMERS, ''), [], '空名稱回空陣列');
assertDeep(CU.getPeriods(null, '甲客戶'), [], 'customers 為 null 回空陣列');
assertDeep(CU.getPeriods(CUSTOMERS, '半填客戶').map(function (p) { return p.visitIndex; }), [2],
  'getPeriods 濾除半填（起始月留空）的區間，只留完整的第 2 次');

console.log('\nSection 1｜CustomerUtils.findPeriodForMonth');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '甲客戶', 5).visitIndex, 2, '5 月落在甲的第 2 次');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '甲客戶', 4).visitIndex, 2, '起始月為含界');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '甲客戶', 6).visitIndex, 2, '結束月為含界');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '乙客戶', 1), null, '乙客戶 1 月不在任何區間');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '丙客戶', 5), null, '無區間客戶任何月份回 null');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '查無此客戶', 5), null, '查無客戶回 null');
// Finding 1：半填區間（起始月留空）不應被 Number('') === 0 誤判為 0..6 的活區間。
assertEq(CU.findPeriodForMonth(CUSTOMERS, '半填客戶', 1), null,
  '半填區間視為未設定，1 月查無區間（不會誤配到 0..6）');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '半填客戶', 3), null,
  '半填區間視為未設定，3 月查無區間');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '半填客戶', 6), null,
  '半填區間本身的結束月也查無區間（該區間整個不可用）');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '半填客戶', 9).visitIndex, 2,
  '同一客戶另一筆完整填寫的第 2 次仍正常查得到');

console.log('\nSection 1｜CustomerUtils.formatPeriodsLabel');
assertEq(CU.formatPeriodsLabel(CUSTOMERS[1]), '第1次 3-8月、第2次 9-12月',
  'formatPeriodsLabel 依 visitIndex 排序輸出');
assertEq(CU.formatPeriodsLabel(CUSTOMERS[2]), '—', '無區間回 —');
assertEq(CU.formatPeriodsLabel(null), '—', 'null 客戶回 —');

console.log('\nSection 1｜CustomerUtils.validatePeriods');
assertDeep(CU.validatePeriods(CUSTOMERS[0].periods, 4), [], '完整四區間通過');
assertDeep(CU.validatePeriods([], 0), [], '次數 0 且無區間通過');
assertDeep(CU.validatePeriods([{ visitIndex: 1, startMonth: 1, endMonth: 6 }], 2),
  ['保養區間筆數（1）與每年保養次數（2）不符'], '筆數不符');
assertDeep(CU.validatePeriods([{ visitIndex: 1, startMonth: '', endMonth: 6 }], 1),
  ['第1次的起始月與結束月需為 1–12 月'], '起始月留空');
assertDeep(CU.validatePeriods([{ visitIndex: 1, startMonth: 0, endMonth: 6 }], 1),
  ['第1次的起始月與結束月需為 1–12 月'], '起始月 0 超出範圍');
assertDeep(CU.validatePeriods([{ visitIndex: 1, startMonth: 1, endMonth: 13 }], 1),
  ['第1次的起始月與結束月需為 1–12 月'], '結束月 13 超出範圍');
assertDeep(CU.validatePeriods([{ visitIndex: 1, startMonth: 8, endMonth: 3 }], 1),
  ['第1次的起始月不可大於結束月'], '起始月大於結束月');
assertDeep(CU.validatePeriods([
  { visitIndex: 1, startMonth: 1, endMonth: 6 },
  { visitIndex: 2, startMonth: 4, endMonth: 10 }
], 2), ['第1次與第2次的保養區間重疊'], '兩區間重疊');
assertDeep(CU.validatePeriods([
  { visitIndex: 1, startMonth: 1, endMonth: 6 },
  { visitIndex: 2, startMonth: 6, endMonth: 12 }
], 2), ['第1次與第2次的保養區間重疊'], '共用邊界月份視為重疊');
assertDeep(CU.validatePeriods([
  { visitIndex: 1, startMonth: 1, endMonth: 6 },
  { visitIndex: 2, startMonth: 7, endMonth: 12 }
], 2), [], '相鄰不重疊區間合法');

// ---------- headless Chrome 區段 ----------
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9342);
if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-customer-periods-profile',
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

  console.log('\nSection 2｜seed 客戶區間');
  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');
  assertTrue(await evaluate(`INITIAL_CUSTOMERS.every(function (c) {
    return Array.isArray(c.periods);
  })`), '每筆 seed 客戶都有 periods 陣列');
  assertTrue(await evaluate(`INITIAL_CUSTOMERS.every(function (c) {
    var count = ServiceLevelUtils.getMaintenanceCount(INITIAL_SERVICE_LEVELS, c.serviceLevel);
    return CustomerUtils.validatePeriods(c.periods, count).length === 0;
  })`), '每筆 seed 客戶的區間都通過驗證');
  assertDeep(await evaluate(`CustomerUtils.getPeriods(INITIAL_CUSTOMERS, '屈臣氏')`), [
    { visitIndex: 1, startMonth: 1, endMonth: 3 },
    { visitIndex: 2, startMonth: 4, endMonth: 6 },
    { visitIndex: 3, startMonth: 7, endMonth: 9 },
    { visitIndex: 4, startMonth: 10, endMonth: 12 }
  ], 'A 級客戶「屈臣氏」為四季區間');
  assertTrue(await evaluate(`(function(){
    return INITIAL_CUSTOMERS.filter(function (c) {
      return c.serviceLevel === 'B 保修(一年兩次)';
    }).every(function (c) {
      return c.periods.length === 2
        && c.periods[0].startMonth === 1 && c.periods[0].endMonth === 6
        && c.periods[1].startMonth === 7 && c.periods[1].endMonth === 12;
    });
  })()`), 'B 級客戶皆為 1-6／7-12 月');
  assertTrue(await evaluate(`(function(){
    return INITIAL_CUSTOMERS.filter(function (c) {
      return c.serviceLevel === 'C 保養(一年一次)';
    }).every(function (c) {
      return c.periods.length === 1
        && c.periods[0].startMonth === 1 && c.periods[0].endMonth === 12;
    });
  })()`), 'C 級客戶皆為 1-12 月單一區間');
  assertTrue(await evaluate(`(function(){
    return INITIAL_CUSTOMERS.filter(function (c) {
      return c.serviceLevel === 'D 維修(無簽約客戶)';
    }).every(function (c) { return c.periods.length === 0; });
  })()`), 'D 級客戶皆無區間');

  console.log('\nSection 3｜保養分配改吃客戶區間');
  // 保養分配的月份分段來源改為客戶：把某 B 級客戶的區間改成 3-8／9-2 之外的值後，
  // 該列的分段必須跟著變，而不是沿用服務等級。
  assertDeep(await evaluate(`(function(){
    var customers = [{ id: 'C1', name: '甲客戶', serviceLevel: 'B 保修(一年兩次)', periods: [
      { visitIndex: 1, startMonth: 2, endMonth: 5 },
      { visitIndex: 2, startMonth: 8, endMonth: 11 }
    ] }];
    return [
      CustomerUtils.findPeriodForMonth(customers, '甲客戶', 3).visitIndex,
      CustomerUtils.findPeriodForMonth(customers, '甲客戶', 9).visitIndex,
      CustomerUtils.findPeriodForMonth(customers, '甲客戶', 1),
      CustomerUtils.findPeriodForMonth(customers, '甲客戶', 12)
    ];
  })()`), [1, 2, null, null], '客戶自訂區間決定月份歸屬，區間外回 null');
  assertTrue(await evaluate(
    `/CustomerUtils\\.getPeriods/.test(String(MaintenanceAllocation))`
  ), '保養分配的分段來源改用 CustomerUtils.getPeriods');
  assertTrue(await evaluate(
    `/CustomerUtils\\.findPeriodForMonth/.test(String(MaintenanceAllocation))`
  ), '保養分配的月份查詢改用 CustomerUtils.findPeriodForMonth');
  assertTrue(await evaluate(
    `!/ServiceLevelUtils\\.(getPeriods|findPeriodForMonth)/.test(String(MaintenanceAllocation))`
  ), '保養分配不再呼叫 ServiceLevelUtils 的區間函式');

  console.log('\nSection 3｜保養分配網格：DOM 斷言（Finding 2）');
  // 掛載真正的 MaintenanceAllocation 元件，檢查渲染出的月份格是否照客戶各自的
  // 保養區間分段：左／右邊界 class、「第N次 x/y」標頭、區間外全白、
  // 同等級但不同區間的客戶各自獨立分段，以及半填區間（Finding 1）不可編輯。
  await evaluate(`
    window.__chooseAllocAssignee2 = function (container, label) {
      var input = container.querySelector('input[role="combobox"]');
      input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      var btns = Array.prototype.filter.call(
        document.querySelectorAll('.searchable-select__menu--portal .searchable-select__option'),
        function (b) { return b.textContent.trim() === label; }
      );
      if (!btns.length) throw new Error('__chooseAllocAssignee2: 找不到選項 ' + label);
      btns[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    };
    'ok'`);

  const allocGrid = await evaluate(`(function(){
    var assignees = [{ id: 'A1', name: 'A組', districts: ['台北市信義區'] }];
    var customers = [
      { id: 'C1', name: '甲客戶', serviceLevel: 'B 保修(一年兩次)', periods: [
        { visitIndex: 1, startMonth: 1, endMonth: 6 },
        { visitIndex: 2, startMonth: 7, endMonth: 12 } ] },
      { id: 'C2', name: '乙客戶', serviceLevel: 'B 保修(一年兩次)', periods: [
        { visitIndex: 1, startMonth: 3, endMonth: 5 },
        { visitIndex: 2, startMonth: 9, endMonth: 11 } ] },
      { id: 'C3', name: '丙客戶', serviceLevel: 'B 保修(一年兩次)', periods: [
        { visitIndex: 1, startMonth: '', endMonth: 6 },
        { visitIndex: 2, startMonth: 7, endMonth: 12 } ] }
    ];
    var stores = [
      { id: 'S1', customerName: '甲客戶', storeName: '甲一', serviceLevel: 'B 保修(一年兩次)',
        storeStatus: '正常營業', companyCity: '台北市', companyDistrict: '信義區' },
      { id: 'S2', customerName: '乙客戶', storeName: '乙一', serviceLevel: 'B 保修(一年兩次)',
        storeStatus: '正常營業', companyCity: '台北市', companyDistrict: '信義區' },
      { id: 'S3', customerName: '丙客戶', storeName: '丙一', serviceLevel: 'B 保修(一年兩次)',
        storeStatus: '正常營業', companyCity: '台北市', companyDistrict: '信義區' }
    ];
    window.__allocToasts2 = [];
    var container = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(MaintenanceAllocation({
      assignees: assignees, customers: customers, stores: stores,
      maintenanceCases: [], serviceLevels: INITIAL_SERVICE_LEVELS,
      maintenanceAllocations: [], setMaintenanceAllocations: function () {},
      showToast: function (m, k) { window.__allocToasts2.push([m, k || 'success']); }
    }));
    window.__chooseAllocAssignee2(container, 'A組');
    var rows = container.querySelectorAll('tbody tr');
    function rowByName(name) {
      return Array.prototype.filter.call(rows, function (r) {
        return r.querySelector('td').textContent.indexOf(name) === 0;
      })[0];
    }
    function monthCells(row) {
      return Array.prototype.slice.call(row.querySelectorAll('td'), 2);
    }
    var hasSegmentBg = function (td) { return /bg-sky-50|bg-amber-50/.test(td.className); };

    var out = {};

    // 甲客戶：1-6 / 7-12 兩段各自的首末月邊界與標頭
    var r1 = monthCells(rowByName('甲客戶'));
    out.r1FirstClass = r1[0].className;
    out.r1FirstHeader = r1[0].textContent.trim();
    out.r1SixthClass = r1[5].className;
    out.r1SeventhClass = r1[6].className;
    out.r1SeventhHeader = r1[6].textContent.trim();
    out.r1TwelfthClass = r1[11].className;

    // 乙客戶：與甲客戶同一服務等級，但區間為 3-5 / 9-11——分段必須依「自己」的區間，
    // 而非同等級的甲客戶或服務等級本身。
    var r2 = monthCells(rowByName('乙客戶'));
    out.r2JanHasBg = hasSegmentBg(r2[0]);
    out.r2ThirdClass = r2[2].className;
    out.r2ThirdHeader = r2[2].textContent.trim();
    out.r2FifthClass = r2[4].className;
    out.r2SixthHasBg = hasSegmentBg(r2[5]);
    out.r2SixthHeader = r2[5].textContent.trim();
    out.r2NinthHeader = r2[8].textContent.trim();
    out.r2EleventhClass = r2[10].className;
    out.r2TwelfthHasBg = hasSegmentBg(r2[11]);

    // 丙客戶：第1次半填（起始月留空，Finding 1），應視為未設定：全白、無標頭；
    // 第2次（7-12）完整填寫，仍正常分段。
    var r3 = monthCells(rowByName('丙客戶'));
    out.r3JanHasBg = hasSegmentBg(r3[0]);
    out.r3JanHeader = r3[0].textContent.trim();
    out.r3JuneHasBg = hasSegmentBg(r3[5]);
    out.r3SeventhClass = r3[6].className;
    out.r3SeventhHeader = r3[6].textContent.trim();

    // 點半填區間覆蓋範圍內的月份（3月）應無法開啟編輯 Modal，並跳出提示 toast。
    window.__allocToasts2 = [];
    r3[2].querySelector('div').click();
    out.r3ClickOpenedModal = container.textContent.indexOf('編輯保養分配') !== -1;
    out.r3Toasts = window.__allocToasts2.slice();

    container.remove();
    return out;
  })()`);

  assertTrue(allocGrid.r1FirstClass.indexOf('border-l-2') !== -1, '甲客戶第1段首月（1月）有左邊界 class');
  assertTrue(allocGrid.r1FirstHeader.indexOf('第1次') === 0, '甲客戶第1段首月顯示「第N次 x/y」標頭', allocGrid.r1FirstHeader);
  assertTrue(allocGrid.r1SixthClass.indexOf('border-r-2') !== -1, '甲客戶第1段末月（6月）有右邊界 class');
  assertTrue(allocGrid.r1SeventhClass.indexOf('border-l-2') !== -1, '甲客戶第2段首月（7月）有左邊界 class');
  assertTrue(allocGrid.r1SeventhHeader.indexOf('第2次') === 0, '甲客戶第2段首月顯示「第2次」標頭', allocGrid.r1SeventhHeader);
  assertTrue(allocGrid.r1TwelfthClass.indexOf('border-r-2') !== -1, '甲客戶第2段末月（12月）有右邊界 class');

  assertEq(allocGrid.r2JanHasBg, false, '乙客戶 1 月不在其任何區間內，無區段底色');
  assertTrue(allocGrid.r2ThirdClass.indexOf('border-l-2') !== -1, '乙客戶第1段首月（3月）有左邊界（與甲客戶不同月份）');
  assertTrue(allocGrid.r2ThirdHeader.indexOf('第1次') === 0, '乙客戶第1段首月顯示標頭', allocGrid.r2ThirdHeader);
  assertTrue(allocGrid.r2FifthClass.indexOf('border-r-2') !== -1, '乙客戶第1段末月（5月）有右邊界');
  assertEq(allocGrid.r2SixthHasBg, false, '乙客戶 6 月不在其任何區間（甲客戶的 1-6 段不影響乙客戶），無底色');
  assertEq(allocGrid.r2SixthHeader, '', '乙客戶區間外月份無標頭文字');
  assertTrue(allocGrid.r2NinthHeader.indexOf('第2次') === 0, '乙客戶第2段首月（9月）顯示標頭', allocGrid.r2NinthHeader);
  assertTrue(allocGrid.r2EleventhClass.indexOf('border-r-2') !== -1, '乙客戶第2段末月（11月）有右邊界');
  assertEq(allocGrid.r2TwelfthHasBg, false, '乙客戶 12 月不在其任何區間，無底色');

  assertEq(allocGrid.r3JanHasBg, false, '丙客戶半填的第1次不參與分段，1 月無底色（Finding 1）');
  assertEq(allocGrid.r3JanHeader, '', '丙客戶半填的第1次月份無標頭文字');
  assertEq(allocGrid.r3JuneHasBg, false, '丙客戶半填的第1次，結束月（6月）本身也無底色');
  assertTrue(allocGrid.r3SeventhClass.indexOf('border-l-2') !== -1, '丙客戶完整的第2次（7-12月）仍正常有左邊界');
  assertTrue(allocGrid.r3SeventhHeader.indexOf('第2次') === 0, '丙客戶完整的第2次仍正常顯示標頭', allocGrid.r3SeventhHeader);
  assertEq(allocGrid.r3ClickOpenedModal, false, '點半填區間覆蓋的月份不開啟編輯 Modal（openEditModal 拒絕）');
  assertDeep(allocGrid.r3Toasts, [['此月份不在該客戶的保養區間內', 'error']],
    '點半填區間覆蓋的月份跳出「此月份不在該客戶的保養區間內」提示');

  console.log('\nSection 4｜保養次數標籤改吃客戶區間');
  await evaluate(`window.__PERIOD_CUSTOMERS = [
    { id: 'C1', name: '甲客戶', periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 } ] },
    { id: 'C2', name: '丙客戶', periods: [] }
  ];`);
  assertEq(await evaluate(
    `ScheduleUtils.formatCasePeriodLabel(
      { customerName: '甲客戶', planDate: '2026-05-10' }, window.__PERIOD_CUSTOMERS)`),
    '2026 第2次（4-6月）', '5 月為甲客戶的第 2 次');
  assertEq(await evaluate(
    `ScheduleUtils.formatCasePeriodLabel(
      { customerName: '甲客戶', planDate: '2026-11-01' }, window.__PERIOD_CUSTOMERS)`),
    '2026 第4次（10-12月）', '11 月為甲客戶的第 4 次');
  assertEq(await evaluate(
    `ScheduleUtils.formatCasePeriodLabel(
      { customerName: '丙客戶', planDate: '2026-08-01' }, window.__PERIOD_CUSTOMERS)`),
    '', '無區間客戶回空字串');
  assertEq(await evaluate(
    `ScheduleUtils.formatCasePeriodLabel(
      { customerName: '查無此客戶', planDate: '2026-05-10' }, window.__PERIOD_CUSTOMERS)`),
    '', '查無客戶回空字串');
  assertEq(await evaluate(
    `ScheduleUtils.formatCasePeriodLabel({ customerName: '甲客戶' }, window.__PERIOD_CUSTOMERS)`),
    '', '無日期也無區間身分時回空字串');
  assertTrue(await evaluate(
    `/CustomerUtils\\.findPeriodForMonth/.test(String(ScheduleUtils.resolveCasePeriod))`
  ), 'resolveCasePeriod 用 CustomerUtils.findPeriodForMonth');
  assertTrue(await evaluate(
    `!/ServiceLevelUtils\\.findPeriodForMonth/.test(String(ScheduleUtils.resolveCasePeriod))`
  ), 'resolveCasePeriod 不呼叫 ServiceLevelUtils.findPeriodForMonth');
  assertEq(await evaluate(`typeof ScheduleUtils.formatMaintenancePeriod`), 'undefined',
    '日期回推版的 formatMaintenancePeriod 已移除（案件排程改與保養明細同源）');

  console.log('\nSection 5｜服務等級不再持有區間');
  assertTrue(await evaluate(`INITIAL_SERVICE_LEVELS.every(function (sl) {
    return !('periods' in sl);
  })`), 'INITIAL_SERVICE_LEVELS 已無 periods 欄位');
  assertEq(await evaluate(`typeof ServiceLevelUtils.getPeriods`), 'undefined',
    'ServiceLevelUtils.getPeriods 已移除');
  assertEq(await evaluate(`typeof ServiceLevelUtils.findPeriodForMonth`), 'undefined',
    'ServiceLevelUtils.findPeriodForMonth 已移除');
  assertEq(await evaluate(`typeof ServiceLevelUtils.formatPeriodsLabel`), 'undefined',
    'ServiceLevelUtils.formatPeriodsLabel 已移除');
  assertDeep(await evaluate(
    `Object.keys(ServiceLevelUtils.normalizeRecord({ name: ' X ', maintenanceCount: '2' }))`),
    ['name', 'maintenanceCount', 'countsBonusPoints'], 'normalizeRecord 不再回 periods');
  assertDeep(await evaluate(
    `ServiceLevelUtils.validate({ name: 'X', maintenanceCount: 2 }, [], undefined)`),
    [], 'validate 不再要求區間筆數');
  assertDeep(await evaluate(
    `ServiceLevelUtils.validate({ name: '', maintenanceCount: 1 }, [], undefined)`),
    ['服務等級名稱為必填'], 'validate 仍檢查名稱必填');
  assertDeep(await evaluate(
    `ServiceLevelUtils.validate({ name: 'X', maintenanceCount: -1 }, [], undefined)`),
    ['每年保養次數需為 0 或正整數'], 'validate 仍檢查次數');
  assertTrue(await evaluate(`String(ServiceLevelForm).indexOf('保養區間') === -1`),
    '服務等級表單已無「保養區間」區塊');
  // COLUMNS 宣告在 ServiceLevelList 之外，故改以實際渲染出的表頭判斷
  assertTrue(await evaluate(`(function(){
    var container = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(ServiceLevelList({
      serviceLevels: INITIAL_SERVICE_LEVELS,
      setServiceLevels: function () {},
      customers: [], stores: [], cases: [], maintenanceCases: [],
      projectCases: [], surveyCases: [], personnelStatus: [],
      setEditingCase: function () {}, setView: function () {}, showToast: function () {}
    }));
    var headers = Array.prototype.map.call(container.querySelectorAll('thead th'),
      function (th) { return th.textContent.trim(); });
    container.remove();
    return headers.indexOf('保養區間') === -1;
  })()`), '服務等級列表已無「保養區間」欄');

  console.log('\nSection 6｜客戶表單保養區間');
  // 直接掛載 CustomerForm 到暫時容器，避開主畫面導覽。
  // 注意：src/core/searchable-select.js 全域攔截了 h('select', ...)，頁面上完全沒有
  // 原生 <select>（見 verify-service-level-management.mjs 的同一說明），服務等級與
  // 起訖月欄位都是 searchable-select（<input name="..."> + portal 選單），故一律改用
  // mousedown 開啟選單、點選項按鈕（.searchable-select__option）來選值，而非對
  // <select> 直接賦值＋dispatch('change')。
  const formProbe = await evaluate(`(function(){
    var container = document.createElement('div');
    document.body.appendChild(container);
    window.__customerSaved = null;
    window.__toasts = [];
    window.__chooseOption = function (container, name, label) {
      var input = container.querySelector('[name="' + name + '"]');
      if (!input) throw new Error('__chooseOption: 找不到欄位 ' + name);
      input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      var btns = Array.prototype.filter.call(
        document.querySelectorAll('.searchable-select__menu--portal .searchable-select__option'),
        function (b) { return b.textContent.trim() === label; }
      );
      if (!btns.length) throw new Error('__chooseOption: 欄位 ' + name + ' 找不到選項 ' + label);
      btns[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    };
    var node = CustomerForm({
      cases: INITIAL_CUSTOMERS,
      setCases: function (next) { window.__customerSaved = next[0] || null; },
      targetCase: null,
      serviceLevels: INITIAL_SERVICE_LEVELS,
      setView: function () {},
      showToast: function (msg, type) { window.__toasts.push({ msg: msg, type: type }); }
    });
    container.appendChild(node);
    window.__formContainer = container;
    var selects = container.querySelectorAll('[name^="startMonth-"]');
    return {
      hasSection: container.textContent.indexOf('保養區間') !== -1,
      startCount: selects.length,
      endCount: container.querySelectorAll('[name^="endMonth-"]').length
    };
  })()`);
  assertTrue(formProbe.hasSection, '客戶表單有「保養區間」區塊');
  assertEq(formProbe.startCount, 4, '預設服務等級（A，4 次）渲染 4 列起始月');
  assertEq(formProbe.endCount, 4, '同樣渲染 4 列結束月');

  const afterSwitch = await evaluate(`(function(){
    var container = window.__formContainer;
    window.__chooseOption(container, 'serviceLevel', 'B 保修(一年兩次)');
    return container.querySelectorAll('[name^="startMonth-"]').length;
  })()`);
  assertEq(afterSwitch, 2, '切換到 B（2 次）後只剩 2 列');

  const afterZero = await evaluate(`(function(){
    var container = window.__formContainer;
    window.__chooseOption(container, 'serviceLevel', 'D 維修(無簽約客戶)');
    return {
      rows: container.querySelectorAll('[name^="startMonth-"]').length,
      hint: container.textContent.indexOf('此服務等級不納入保養分配') !== -1
    };
  })()`);
  assertEq(afterZero.rows, 0, '次數 0 時不渲染區間列');
  assertTrue(afterZero.hint, '次數 0 時顯示「此服務等級不納入保養分配」');

  const saveResult = await evaluate(`(function(){
    var container = window.__formContainer;
    window.__chooseOption(container, 'serviceLevel', 'B 保修(一年兩次)');
    var nameInput = container.querySelector('input[name="name"]');
    nameInput.value = '測試客戶';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    nameInput.dispatchEvent(new Event('change', { bubbles: true }));
    window.__toasts = [];
    container.querySelector('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }));
    return {
      saved: !!window.__customerSaved,
      periods: window.__customerSaved && window.__customerSaved.periods,
      toasts: window.__toasts.slice()
    };
  })()`);
  assertTrue(saveResult.saved, '區間留空仍可儲存（不擋下）');
  assertEq(saveResult.periods.length, 2, '儲存的客戶帶有 2 筆區間');
  assertTrue(saveResult.toasts.some(t => t.type === 'error'
    && t.msg.indexOf('1–12 月') !== -1), '區間未填完整時跳提醒 toast');

  const saveValid = await evaluate(`(function(){
    var container = window.__formContainer;
    // 每次選擇都會觸發重繪換掉節點，故每步都重新以 index 定位欄位名稱
    function chooseMonth(prefix, index, month) {
      var name = prefix + (index + 1);
      window.__chooseOption(container, name, month + '月');
    }
    chooseMonth('startMonth-', 0, 1);
    chooseMonth('endMonth-', 0, 6);
    chooseMonth('startMonth-', 1, 7);
    chooseMonth('endMonth-', 1, 12);
    window.__toasts = [];
    container.querySelector('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }));
    return {
      periods: window.__customerSaved && window.__customerSaved.periods,
      hasError: window.__toasts.some(function (t) { return t.type === 'error'; })
    };
  })()`);
  assertDeep(saveValid.periods, [
    { visitIndex: 1, startMonth: 1, endMonth: 6 },
    { visitIndex: 2, startMonth: 7, endMonth: 12 }
  ], '填完整後儲存的區間為數字月份');
  assertTrue(!saveValid.hasError, '區間合法時不跳錯誤 toast');

  // Finding 4：儲存後表單若仍開著繼續編輯，不應改到已存檔紀錄的 periods
  // （儲存時需複製陣列，而非共用表單的即時陣列參考）。
  const aliasCheck = await evaluate(`(function(){
    var container = window.__formContainer;
    var savedBefore = JSON.parse(JSON.stringify(window.__customerSaved.periods));
    window.__chooseOption(container, 'startMonth-1', '2月');
    return {
      savedBefore: savedBefore,
      savedAfterFurtherEdit: window.__customerSaved.periods
    };
  })()`);
  assertDeep(aliasCheck.savedAfterFurtherEdit, aliasCheck.savedBefore,
    '儲存後表單仍開著繼續編輯，不會回頭改到已存檔的 periods（不再共用參考）');

  await evaluate(`(function(){
    window.__formContainer.remove();
    window.__formContainer = null;
    return true;
  })()`);

  console.log('\nSection 6｜resizePeriods 保留已填的前段（Finding 3）');

  const shrinkPreserve = await evaluate(`(function(){
    var container = document.createElement('div');
    document.body.appendChild(container);
    var node = CustomerForm({
      cases: [], setCases: function(){}, targetCase: null,
      serviceLevels: INITIAL_SERVICE_LEVELS, setView: function(){}, showToast: function(){}
    });
    container.appendChild(node);
    // 預設服務等級為 A（4 次），先填第1次的真實月份，再切到次數較少的 B（2 次）。
    window.__chooseOption(container, 'startMonth-1', '2月');
    window.__chooseOption(container, 'endMonth-1', '3月');
    window.__chooseOption(container, 'serviceLevel', 'B 保修(一年兩次)');
    var starts = Array.prototype.map.call(
      container.querySelectorAll('[name^="startMonth-"]'), function (el) { return el.value; });
    var ends = Array.prototype.map.call(
      container.querySelectorAll('[name^="endMonth-"]'), function (el) { return el.value; });
    container.remove();
    return { starts: starts, ends: ends };
  })()`);
  assertEq(shrinkPreserve.starts.length, 2, '切到次數較少（B，2 次）的等級後只剩 2 列');
  assertEq(shrinkPreserve.starts[0], '2月', '切換後第1次已填的起始月保留（未被清空）');
  assertEq(shrinkPreserve.ends[0], '3月', '切換後第1次已填的結束月保留（未被清空）');

  const mismatchPad = await evaluate(`(function(){
    var container = document.createElement('div');
    document.body.appendChild(container);
    var targetCase = { id: 'CX1', name: '次數不符客戶(少)', serviceLevel: 'A 保修(一年四次)',
      periods: [{ visitIndex: 1, startMonth: 2, endMonth: 3 }] };
    var node = CustomerForm({
      cases: [targetCase], setCases: function(){}, targetCase: targetCase,
      serviceLevels: INITIAL_SERVICE_LEVELS, setView: function(){}, showToast: function(){}
    });
    container.appendChild(node);
    var starts = Array.prototype.map.call(
      container.querySelectorAll('[name^="startMonth-"]'), function (el) { return el.value; });
    var ends = Array.prototype.map.call(
      container.querySelectorAll('[name^="endMonth-"]'), function (el) { return el.value; });
    container.remove();
    return { starts: starts, ends: ends };
  })()`);
  assertEq(mismatchPad.starts.length, 4,
    '既有客戶只存 1 筆區間、但等級（A）目前要求 4 次：開編輯頁時補齊到 4 列');
  assertEq(mismatchPad.starts[0], '2月', '既有的第1次起始月保留');
  assertEq(mismatchPad.ends[0], '3月', '既有的第1次結束月保留');
  assertEq(mismatchPad.starts[1], '起始月', '補出的第2列起始月為空白（尚未選擇）');
  assertEq(mismatchPad.starts[2], '起始月', '補出的第3列起始月為空白');
  assertEq(mismatchPad.starts[3], '起始月', '補出的第4列起始月為空白');

  const mismatchTrunc = await evaluate(`(function(){
    var container = document.createElement('div');
    document.body.appendChild(container);
    var targetCase = { id: 'CX2', name: '次數不符客戶(多)', serviceLevel: 'B 保修(一年兩次)',
      periods: [
        { visitIndex: 1, startMonth: 1, endMonth: 3 },
        { visitIndex: 2, startMonth: 4, endMonth: 6 },
        { visitIndex: 3, startMonth: 7, endMonth: 9 },
        { visitIndex: 4, startMonth: 10, endMonth: 12 }
      ] };
    var node = CustomerForm({
      cases: [targetCase], setCases: function(){}, targetCase: targetCase,
      serviceLevels: INITIAL_SERVICE_LEVELS, setView: function(){}, showToast: function(){}
    });
    container.appendChild(node);
    var starts = Array.prototype.map.call(
      container.querySelectorAll('[name^="startMonth-"]'), function (el) { return el.value; });
    var ends = Array.prototype.map.call(
      container.querySelectorAll('[name^="endMonth-"]'), function (el) { return el.value; });
    container.remove();
    return { starts: starts, ends: ends };
  })()`);
  assertEq(mismatchTrunc.starts.length, 2,
    '既有客戶存 4 筆區間、但等級（B）目前只要求 2 次：開編輯頁時砍到剩 2 列');
  assertEq(mismatchTrunc.starts[0], '1月', '截斷後仍保留原本第1次起始月（前段存活）');
  assertEq(mismatchTrunc.ends[0], '3月', '截斷後仍保留原本第1次結束月');
  assertEq(mismatchTrunc.starts[1], '4月', '截斷後仍保留原本第2次起始月');
  assertEq(mismatchTrunc.ends[1], '6月', '截斷後仍保留原本第2次結束月（第3、4次的尾端被砍掉）');

  // Finding 7：resizePeriods 重新編號前應先依原本存的 visitIndex 排序，
  // 避免資料本身順序錯亂（例如 visitIndex 2 存在陣列前面）時被誤植新序號。
  const outOfOrder = await evaluate(`(function(){
    var container = document.createElement('div');
    document.body.appendChild(container);
    var targetCase = { id: 'CX3', name: '順序錯亂客戶', serviceLevel: 'B 保修(一年兩次)',
      periods: [
        { visitIndex: 2, startMonth: 9, endMonth: 12 },
        { visitIndex: 1, startMonth: 1, endMonth: 4 }
      ] };
    var node = CustomerForm({
      cases: [targetCase], setCases: function(){}, targetCase: targetCase,
      serviceLevels: INITIAL_SERVICE_LEVELS, setView: function(){}, showToast: function(){}
    });
    container.appendChild(node);
    var starts = Array.prototype.map.call(
      container.querySelectorAll('[name^="startMonth-"]'), function (el) { return el.value; });
    container.remove();
    return starts;
  })()`);
  assertEq(outOfOrder[0], '1月', '重新編號前先依原本 visitIndex 排序：第1列顯示原本 visitIndex 1（1月起）');
  assertEq(outOfOrder[1], '9月', '第2列顯示原本 visitIndex 2（9月起），未被陣列原始順序誤植');

  // Finding 8：服務等級字串查無資料時（例如已被刪除／改名），初始載入不應把既有
  // 區間清空——只有使用者主動切到一個「確實存在、次數為 0」的等級才會清空。
  const unresolvedLevel = await evaluate(`(function(){
    var container = document.createElement('div');
    document.body.appendChild(container);
    var targetCase = { id: 'CX4', name: '等級查無客戶', serviceLevel: '已刪除的等級',
      periods: [
        { visitIndex: 1, startMonth: 1, endMonth: 6 },
        { visitIndex: 2, startMonth: 7, endMonth: 12 }
      ] };
    var node = CustomerForm({
      cases: [targetCase], setCases: function(){}, targetCase: targetCase,
      serviceLevels: INITIAL_SERVICE_LEVELS, setView: function(){}, showToast: function(){}
    });
    container.appendChild(node);
    var starts = Array.prototype.map.call(
      container.querySelectorAll('[name^="startMonth-"]'), function (el) { return el.value; });
    container.remove();
    return starts;
  })()`);
  assertEq(unresolvedLevel.length, 2,
    '服務等級字串查無資料時，保留既有的 2 筆區間列，不因次數判成 0 而清空');
  assertEq(unresolvedLevel[0], '1月', '保留的第1次起始月與原始資料一致');
  assertEq(unresolvedLevel[1], '7月', '保留的第2次起始月與原始資料一致');

  console.log('\nSection 7｜客戶列表保養區間欄');
  const listProbe = await evaluate(`(function(){
    var container = document.createElement('div');
    document.body.appendChild(container);
    var customers = [
      { id: 'C1', name: '完整客戶', serviceLevel: 'B 保修(一年兩次)', enabled: true,
        createdDate: '2026-01-01', periods: [
          { visitIndex: 1, startMonth: 1, endMonth: 6 },
          { visitIndex: 2, startMonth: 7, endMonth: 12 } ] },
      { id: 'C2', name: '缺漏客戶', serviceLevel: 'B 保修(一年兩次)', enabled: true,
        createdDate: '2026-01-02', periods: [
          { visitIndex: 1, startMonth: 1, endMonth: 6 } ] },
      { id: 'C3', name: '免區間客戶', serviceLevel: 'D 維修(無簽約客戶)', enabled: true,
        createdDate: '2026-01-03', periods: [] }
    ];
    container.appendChild(CustomerList({
      cases: customers,
      setCases: function () {},
      serviceLevels: INITIAL_SERVICE_LEVELS,
      setEditingCase: function () {},
      setView: function () {},
      showToast: function () {}
    }));
    var headers = Array.prototype.map.call(
      container.querySelectorAll('thead th'), function (th) { return th.textContent.trim(); });
    var byName = {};
    Array.prototype.forEach.call(container.querySelectorAll('tbody tr'), function (tr) {
      var tds = tr.querySelectorAll('td');
      byName[tds[1].textContent.trim()] = tds[2].textContent.trim();
    });
    container.remove();
    return { headers: headers, byName: byName };
  })()`);
  assertTrue(listProbe.headers.indexOf('保養區間') !== -1, '客戶列表有「保養區間」欄');
  assertEq(listProbe.byName['完整客戶'], '第1次 1-6月、第2次 7-12月', '完整客戶顯示區間標籤');
  assertEq(listProbe.byName['缺漏客戶'], '區間未設完整', '筆數不符的客戶顯示提示');
  assertEq(listProbe.byName['免區間客戶'], '—', '次數 0 的客戶顯示破折號');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
