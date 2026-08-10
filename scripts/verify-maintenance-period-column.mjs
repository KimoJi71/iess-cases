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

console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
