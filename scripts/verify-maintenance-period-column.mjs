#!/usr/bin/env node
/**
 * 「保養計劃進度：保養區間欄位與區間驅動排程」驗證腳本。
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
load('src/features/customer/store-utils.js');
load('src/features/permissions/service-level-utils.js');
load('src/features/scheduling/schedule-utils.js');
const SU = sandbox.ScheduleUtils;

const CUSTOMERS = [
  { id: 'C1', name: '甲客戶', serviceLevel: 'A 保修(一年四次)', enabled: true, periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 3 },
    { visitIndex: 2, startMonth: 4, endMonth: 6 },
    { visitIndex: 3, startMonth: 7, endMonth: 9 },
    { visitIndex: 4, startMonth: 10, endMonth: 12 }
  ] },
  { id: 'C2', name: '乙客戶', serviceLevel: 'D 維修(無簽約客戶)', enabled: true, periods: [] },
  { id: 'C3', name: '丙客戶', serviceLevel: 'B 保修(一年兩次)', enabled: false, periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 6 },
    { visitIndex: 2, startMonth: 7, endMonth: 12 }
  ] }
];

console.log('Section 1｜ScheduleUtils.resolveCasePeriod');
assertDeep(SU.resolveCasePeriod(
  { customerName: '甲客戶', periodYear: 2026, periodVisitIndex: 3 }, CUSTOMERS),
  { year: 2026, visitIndex: 3, startMonth: 7, endMonth: 9 },
  '有 periodYear/periodVisitIndex 時直接查客戶區間');
assertDeep(SU.resolveCasePeriod(
  { customerName: '甲客戶', planDate: '2026-08-15' }, CUSTOMERS),
  { year: 2026, visitIndex: 3, startMonth: 7, endMonth: 9 },
  '舊案件用 planDate 月份回推區間');
assertDeep(SU.resolveCasePeriod(
  { customerName: '甲客戶', dueMonth: '2026-05' }, CUSTOMERS),
  { year: 2026, visitIndex: 2, startMonth: 4, endMonth: 6 },
  '無 planDate 時用 dueMonth 回推');
assertDeep(SU.resolveCasePeriod(
  { customerName: '甲客戶', planDate: '2026-08-15', periodYear: 2026, periodVisitIndex: 1 }, CUSTOMERS),
  { year: 2026, visitIndex: 1, startMonth: 1, endMonth: 3 },
  '案件自帶區間身分時優先於日期回推');
assertEq(SU.resolveCasePeriod(
  { customerName: '乙客戶', planDate: '2026-08-15' }, CUSTOMERS), null,
  '客戶無區間時回 null');
assertEq(SU.resolveCasePeriod(
  { customerName: '甲客戶' }, CUSTOMERS), null,
  '既無區間身分也無日期時回 null');
assertEq(SU.resolveCasePeriod(
  { customerName: '甲客戶', periodYear: 2026, periodVisitIndex: 9 }, CUSTOMERS), null,
  '區間身分在客戶設定中找不到時回 null');
assertEq(SU.resolveCasePeriod(null, CUSTOMERS), null, '案件為 null 回 null');

console.log('\nSection 1｜ScheduleUtils.formatPeriodRange');
assertEq(SU.formatPeriodRange({ year: 2026, visitIndex: 3, startMonth: 7, endMonth: 9 }),
  '第3次 7-9月', '格式為「第3次 7-9月」');
assertEq(SU.formatPeriodRange({ year: 2026, visitIndex: 1, startMonth: 1, endMonth: 12 }),
  '第1次 1-12月', '整年區間');
assertEq(SU.formatPeriodRange(null), '—', 'null 回破折號');

console.log('\nSection 1｜ScheduleUtils.periodMonthRange');
assertDeep(SU.periodMonthRange({ year: 2026, visitIndex: 3, startMonth: 7, endMonth: 9 }),
  { start: '2026-07', end: '2026-09' }, '起訖月補零成 YYYY-MM');
assertDeep(SU.periodMonthRange({ year: 2026, visitIndex: 4, startMonth: 10, endMonth: 12 }),
  { start: '2026-10', end: '2026-12' }, '兩位數月份不補零');
assertEq(SU.periodMonthRange(null), null, 'null 回 null');

const STORES = [
  { customerName: '甲客戶', storeName: '甲一店', storeStatus: '正常營業',
    companyCity: '台北市', companyDistrict: '信義區', serviceLevel: 'A 保修(一年四次)' },
  { customerName: '甲客戶', storeName: '甲二店', storeStatus: '正常營業',
    companyCity: '台中市', companyDistrict: '西屯區', serviceLevel: 'A 保修(一年四次)',
    lastMaintenanceDate: '2026-05-01' },
  { customerName: '甲客戶', storeName: '甲已撤店', storeStatus: '已撤店',
    companyCity: '台北市', companyDistrict: '中山區', serviceLevel: 'A 保修(一年四次)' },
  { customerName: '乙客戶', storeName: '乙一店', storeStatus: '正常營業',
    companyCity: '台北市', companyDistrict: '大安區', serviceLevel: 'D 維修(無簽約客戶)' },
  { customerName: '丙客戶', storeName: '丙一店', storeStatus: '正常營業',
    companyCity: '桃園市', companyDistrict: '中壢區', serviceLevel: 'B 保修(一年兩次)' }
];

function generatedFor(cases, storeName) {
  return cases.filter(function (c) { return c.storeName === storeName; });
}

console.log('\nSection 1｜generateDueMaintenanceCases（區間驅動）');
const gen1 = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, [], '2026-08');
assertEq(generatedFor(gen1, '甲一店').length, 1, '沒有上次保養日期的正常營業門市也會建單');
assertEq(generatedFor(gen1, '甲一店')[0].periodYear, 2026, '帶入 periodYear');
assertEq(generatedFor(gen1, '甲一店')[0].periodVisitIndex, 3, '8 月對到第 3 次區間');
assertEq(generatedFor(gen1, '甲一店')[0].dueMonth, '2026-07', 'dueMonth 為區間起始月');
assertEq(generatedFor(gen1, '甲一店')[0].status, '未保養', '新建單狀態為未保養');
assertEq(generatedFor(gen1, '甲一店')[0].planDate, '', '新建單沒有保養日期');
assertEq(generatedFor(gen1, '甲已撤店').length, 0, '非正常營業門市不建單');
assertEq(generatedFor(gen1, '乙一店').length, 0, '客戶未設定區間時不建單');
assertEq(generatedFor(gen1, '丙一店').length, 0, '停用客戶不建單');

const gen2 = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, gen1, '2026-08');
assertEq(generatedFor(gen2, '甲一店').length, 1, '同一區間重複執行不會重複建單');

const gen3 = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, gen1, '2026-11');
assertEq(generatedFor(gen3, '甲一店').length, 2, '進入第 4 次區間會重新建一筆');
assertEq(generatedFor(gen3, '甲一店')[1].periodVisitIndex, 4, '新建的那筆屬第 4 次');

const doneCase = [{
  id: 'M1', customerName: '甲客戶', storeName: '甲一店', status: '已完成',
  isClosed: true, planDate: '2026-08-05', periodYear: 2026, periodVisitIndex: 3
}];
const gen4 = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, doneCase, '2026-08');
assertEq(generatedFor(gen4, '甲一店').length, 1, '同區間已完成結案時不重複建單');
const gen5 = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, doneCase, '2026-11');
assertEq(generatedFor(gen5, '甲一店').length, 2, '上一區間已完成，下一區間仍重新建一筆');

console.log('\nSection 1｜舊案件區間回填');
const legacy = [{
  id: 'M9', customerName: '甲客戶', storeName: '甲二店', status: '未保養',
  planDate: '', dueMonth: '2026-05'
}];
const gen6 = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, legacy, '2026-08');
const backfilled = gen6.find(function (c) { return c.id === 'M9'; });
assertEq(backfilled.periodYear, 2026, '舊案件回填 periodYear');
assertEq(backfilled.periodVisitIndex, 2, '舊案件依 dueMonth 回填第 2 次');
assertEq(generatedFor(gen6, '甲二店').length, 2, '舊案件屬第 2 次，8 月仍會為第 3 次建一筆');
const legacyNoPeriod = [{
  id: 'M8', customerName: '乙客戶', storeName: '乙一店', status: '未保養',
  planDate: '', dueMonth: '2026-05'
}];
const gen7 = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, legacyNoPeriod, '2026-08');
assertEq(gen7.find(function (c) { return c.id === 'M8'; }).periodVisitIndex, undefined,
  '客戶無區間時舊案件回填不動');

assertEq(typeof SU.addMonthsToMonth, 'undefined', 'addMonthsToMonth 已移除');

// ---------- headless Chrome 區段 ----------
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9344);
if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-maintenance-period-profile',
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

  // 導覽到「保養計劃進度」
  await evaluate(`(function () {
    var links = Array.prototype.slice.call(document.querySelectorAll('button, a, div'));
    var target = links.filter(function (el) {
      return el.textContent.trim() === '保養計劃進度';
    }).pop();
    if (target) target.click();
    return !!target;
  })()`);
  await sleep(1200);

  console.log('\nSection 2｜列表欄位');
  assertEq(consoleErrors.length, 0, '載入與導覽時無 JS 錯誤');
  const headers = await evaluate(`Array.prototype.map.call(
    document.querySelectorAll('table thead th'),
    function (th) { return th.textContent.trim(); })`);
  assertTrue(headers.indexOf('保養區間') >= 0, '表頭有「保養區間」欄', JSON.stringify(headers));
  assertEq(headers.indexOf('保養區間'), headers.indexOf('工項類別') + 1,
    '「保養區間」緊接在「工項類別」之後');
  assertEq(headers.indexOf('保養日期'), headers.indexOf('保養區間') + 1,
    '「保養日期」緊接在「保養區間」之後');
  assertEq(await evaluate(`document.querySelectorAll('table thead th').length`), 14,
    '表頭共 14 欄');

  console.log('\nSection 2｜保養區間內容與保養日期留白');
  const rows = await evaluate(`(function () {
    var headerCells = Array.prototype.map.call(
      document.querySelectorAll('table thead th'),
      function (th) { return th.textContent.trim(); });
    var periodIdx = headerCells.indexOf('保養區間');
    var dateIdx = headerCells.indexOf('保養日期');
    var customerIdx = headerCells.indexOf('客戶名稱');
    var storeIdx = headerCells.indexOf('門市名稱');
    return Array.prototype.map.call(
      document.querySelectorAll('table tbody tr'),
      function (tr) {
        var tds = tr.querySelectorAll('td');
        if (tds.length < 14) return null;
        return {
          customer: tds[customerIdx].textContent.trim(),
          store: tds[storeIdx].textContent.trim(),
          period: tds[periodIdx].textContent.trim(),
          planDate: tds[dateIdx].textContent
        };
      }).filter(Boolean);
  })()`);
  assertTrue(rows.length > 0, '列表有資料列', `共 ${rows.length} 列`);
  assertTrue(rows.every(r => /^第\d+次 \d{1,2}-\d{1,2}月$/.test(r.period)),
    '每列保養區間格式皆為「第N次 X-Y月」',
    JSON.stringify(rows.map(r => r.period)));
  assertTrue(rows.every(r => !/未保養/.test(r.planDate)),
    '保養日期欄不再出現「（未保養）」');
  assertTrue(rows.every(r => r.planDate === '' || /^\d{4}-\d{2}-\d{2}$/.test(r.planDate)),
    '保養日期欄若無日期則為空字串',
    JSON.stringify(rows.map(r => r.planDate)));

  console.log('\nSection 2｜當月區間涵蓋的未完成案件會出現');
  // app 的 store 沒有掛在 window 上，改用同一組 seed 重算一份等價結果比對
  const expected = await evaluate(`(function () {
    var month = new Date().getMonth() + 1;
    var year = new Date().getFullYear();
    var period = CustomerUtils.findPeriodForMonth(INITIAL_CUSTOMERS, '屈臣氏', month);
    if (!period) return null;
    var all = ScheduleUtils.generateDueMaintenanceCases(
      INITIAL_CUSTOMERS, INITIAL_STORES, INITIAL_MAINTENANCE_CASES);
    var cases = all.filter(function (c) {
      return !c.isClosed && c.customerName === '屈臣氏'
        && Number(c.periodYear) === year
        && Number(c.periodVisitIndex) === period.visitIndex;
    });
    return {
      label: '第' + period.visitIndex + '次 ' + period.startMonth + '-' + period.endMonth + '月',
      stores: cases.map(function (c) { return c.storeName; })
    };
  })()`);
  assertTrue(expected && expected.stores.length > 0,
    '屈臣氏在當月區間有未結案的保養單', JSON.stringify(expected));
  assertTrue(expected.stores.every(name => rows.some(
    r => r.customer === '屈臣氏' && r.store === name && r.period === expected.label)),
    '這些門市都出現在列表且區間顯示為當月區間', expected.label);

  console.log('\nSection 2｜區間不涵蓋所選月份的案件不出現');
  const hidden = await evaluate(`(function () {
    var month = new Date().getMonth() + 1;
    var periods = CustomerUtils.getPeriods(INITIAL_CUSTOMERS, '屈臣氏');
    return periods.filter(function (p) {
      return p.startMonth > month || p.endMonth < month;
    }).map(function (p) {
      return '第' + p.visitIndex + '次 ' + p.startMonth + '-' + p.endMonth + '月';
    });
  })()`);
  assertTrue(hidden.every(label => !rows.some(r => r.period === label)),
    '其他區間的案件不出現在當月清單', JSON.stringify(hidden));

  console.log('\nSection 3｜明細頁目前保養季度');
  await evaluate(`(function () {
    // 框架的 title prop 會轉成 aria-label（並加上 data-no-tooltip），故以 aria-label 選取
    var btn = document.querySelector('table tbody tr button[aria-label="編輯"]');
    if (btn) btn.click();
    return !!btn;
  })()`);
  await sleep(1000);
  const detail = await evaluate(`(function () {
    var labels = Array.prototype.slice.call(document.querySelectorAll('span'));
    var label = labels.filter(function (el) {
      return el.textContent.trim() === '目前保養季度';
    })[0];
    if (!label) return null;
    return label.parentNode.querySelector('div').textContent.trim();
  })()`);
  assertTrue(detail !== null, '明細頁有「目前保養季度」欄位');
  assertTrue(/^\d{4} 第\d+次（\d{1,2}-\d{1,2}月）$/.test(detail),
    '格式為「2026 第3次（7-9月）」', detail);

  assertEq(consoleErrors.length, 0, '操作後仍無 JS 錯誤');
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}

console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
