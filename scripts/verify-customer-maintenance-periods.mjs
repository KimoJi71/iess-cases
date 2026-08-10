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
  { id: 'C4', name: '丁客戶', serviceLevel: 'B 保修(一年兩次)' }
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

console.log('\nSection 1｜CustomerUtils.findPeriodForMonth');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '甲客戶', 5).visitIndex, 2, '5 月落在甲的第 2 次');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '甲客戶', 4).visitIndex, 2, '起始月為含界');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '甲客戶', 6).visitIndex, 2, '結束月為含界');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '乙客戶', 1), null, '乙客戶 1 月不在任何區間');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '丙客戶', 5), null, '無區間客戶任何月份回 null');
assertEq(CU.findPeriodForMonth(CUSTOMERS, '查無此客戶', 5), null, '查無客戶回 null');

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

  console.log('\nSection 4｜formatMaintenancePeriod 改吃客戶區間');
  await evaluate(`window.__PERIOD_CUSTOMERS = [
    { id: 'C1', name: '甲客戶', periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 } ] },
    { id: 'C2', name: '丙客戶', periods: [] }
  ];`);
  assertEq(await evaluate(
    `ScheduleUtils.formatMaintenancePeriod('2026-05-10', window.__PERIOD_CUSTOMERS, '甲客戶')`),
    '2026 第2次', '5 月為甲客戶的第 2 次');
  assertEq(await evaluate(
    `ScheduleUtils.formatMaintenancePeriod('2026-11-01', window.__PERIOD_CUSTOMERS, '甲客戶')`),
    '2026 第4次', '11 月為甲客戶的第 4 次');
  assertEq(await evaluate(
    `ScheduleUtils.formatMaintenancePeriod('2026-08-01', window.__PERIOD_CUSTOMERS, '丙客戶')`),
    '2026', '無區間客戶只回年份');
  assertEq(await evaluate(
    `ScheduleUtils.formatMaintenancePeriod('2026-05-10', window.__PERIOD_CUSTOMERS, '查無此客戶')`),
    '2026', '查無客戶只回年份');
  assertEq(await evaluate(
    `ScheduleUtils.formatMaintenancePeriod('', window.__PERIOD_CUSTOMERS, '甲客戶')`),
    '', '無日期回空字串');
  assertTrue(await evaluate(
    `/CustomerUtils\\.findPeriodForMonth/.test(String(ScheduleUtils.formatMaintenancePeriod))`
  ), 'formatMaintenancePeriod 改用 CustomerUtils.findPeriodForMonth');
  assertTrue(await evaluate(
    `!/ServiceLevelUtils\\.findPeriodForMonth/.test(String(ScheduleUtils.formatMaintenancePeriod))`
  ), 'formatMaintenancePeriod 不再呼叫 ServiceLevelUtils.findPeriodForMonth');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
