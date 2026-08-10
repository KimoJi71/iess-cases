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

console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
