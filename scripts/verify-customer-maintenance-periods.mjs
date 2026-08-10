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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
