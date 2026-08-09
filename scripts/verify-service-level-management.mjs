#!/usr/bin/env node
/**
 * 服務等級管理驗證腳本。
 * Section 1-3 以 node:vm 載入 IIFE 模組做純函式驗證；
 * Section 4-7 由後續 Task 追加（headless Chrome + CDP 的 UI 驗證）。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

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
load('src/features/permissions/service-level-utils.js');
const SLU = sandbox.ServiceLevelUtils;

// 與 seed 的 INITIAL_SERVICE_LEVELS 內容一致的 fixture
const LEVELS = [
  { id: 'SL001', name: 'A 保修(一年四次)', maintenanceCount: 4, countsBonusPoints: false,
    periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 }
    ] },
  { id: 'SL002', name: 'B 保修(一年兩次)', maintenanceCount: 2, countsBonusPoints: false,
    periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 6 },
      { visitIndex: 2, startMonth: 7, endMonth: 12 }
    ] },
  { id: 'SL003', name: 'C 保養(一年一次)', maintenanceCount: 1, countsBonusPoints: true,
    periods: [{ visitIndex: 1, startMonth: 1, endMonth: 12 }] },
  { id: 'SL004', name: 'D 維修(無簽約客戶)', maintenanceCount: 0, countsBonusPoints: true,
    periods: [] }
];

console.log('Section 1｜ServiceLevelUtils 查詢函式');
assertEq(SLU.findByName(LEVELS, 'B 保修(一年兩次)').id, 'SL002', 'findByName 命中');
assertEq(SLU.findByName(LEVELS, '  B 保修(一年兩次)  ').id, 'SL002', 'findByName 去頭尾空白');
assertEq(SLU.findByName(LEVELS, '不存在'), null, 'findByName 查無回 null');
assertEq(SLU.findByName(LEVELS, ''), null, 'findByName 空字串回 null');
assertEq(SLU.getMaintenanceCount(LEVELS, 'A 保修(一年四次)'), 4, 'getMaintenanceCount A 為 4');
assertEq(SLU.getMaintenanceCount(LEVELS, '不存在'), 0, 'getMaintenanceCount 查無回 0');
assertEq(SLU.countsBonusPoints(LEVELS, 'C 保養(一年一次)'), true, 'C 計算增額積分');
assertEq(SLU.countsBonusPoints(LEVELS, 'A 保修(一年四次)'), false, 'A 不計算增額積分');
assertEq(SLU.countsBonusPoints(LEVELS, '不存在'), false, 'countsBonusPoints 查無回 false');
assertEq(SLU.getPeriods(LEVELS, 'D 維修(無簽約客戶)').length, 0, 'D 無區間');
assertEq(SLU.getPeriods(LEVELS, '不存在').length, 0, 'getPeriods 查無回空陣列');
assertEq(SLU.getPeriods(
  [{ name: 'X', maintenanceCount: 2, periods: [
    { visitIndex: 2, startMonth: 7, endMonth: 12 },
    { visitIndex: 1, startMonth: 1, endMonth: 6 }] }], 'X'
)[0].visitIndex, 1, 'getPeriods 依 visitIndex 排序');
assertEq(SLU.findPeriodForMonth(LEVELS, 'A 保修(一年四次)', 5).visitIndex, 2, '5 月落在 A 的第 2 次');
assertEq(SLU.findPeriodForMonth(LEVELS, 'A 保修(一年四次)', 1).visitIndex, 1, '起始月為含界');
assertEq(SLU.findPeriodForMonth(LEVELS, 'A 保修(一年四次)', 3).visitIndex, 1, '結束月為含界');
assertEq(SLU.findPeriodForMonth(LEVELS, 'D 維修(無簽約客戶)', 5), null, 'D 任何月份都回 null');
assertEq(SLU.isAllocatable(LEVELS, 'C 保養(一年一次)'), true, 'C 納入保養分配');
assertEq(SLU.isAllocatable(LEVELS, 'D 維修(無簽約客戶)'), false, 'D 不納入保養分配');
assertEq(SLU.isAllocatable(LEVELS, '不存在'), false, '查無等級不納入保養分配');

console.log('\nSection 1｜normalizeRecord / formatPeriodsLabel');
const norm = SLU.normalizeRecord({
  name: '  X 等級 ', maintenanceCount: '2', countsBonusPoints: true,
  periods: [{ visitIndex: 2, startMonth: '7', endMonth: '12' },
            { visitIndex: 1, startMonth: '1', endMonth: '6' }]
});
assertEq(norm.name, 'X 等級', 'normalizeRecord 去頭尾空白');
assertEq(norm.maintenanceCount, 2, 'normalizeRecord maintenanceCount 轉數字');
assertEq(norm.periods[0].visitIndex, 1, 'normalizeRecord periods 依 visitIndex 排序');
assertEq(norm.periods[0].startMonth, 1, 'normalizeRecord 月份轉數字');
assertEq(SLU.formatPeriodsLabel(LEVELS[1]), '第1次 1-6月、第2次 7-12月', 'formatPeriodsLabel 兩區間');
assertEq(SLU.formatPeriodsLabel(LEVELS[3]), '—', 'formatPeriodsLabel 無區間回 —');

console.log('\nSection 1｜validate');
assertDeep(
  SLU.validate({
    name: '有效等級', maintenanceCount: 2, countsBonusPoints: false,
    periods: [{ visitIndex: 1, startMonth: 1, endMonth: 6 }, { visitIndex: 2, startMonth: 7, endMonth: 12 }]
  }, [], undefined),
  [], 'validate 合法紀錄回傳空陣列');

assertDeep(
  SLU.validate({ name: '', maintenanceCount: 0, periods: [] }, [], undefined),
  ['服務等級名稱為必填'], 'validate 空白名稱回必填錯誤');
assertDeep(
  SLU.validate({ name: '   ', maintenanceCount: 0, periods: [] }, [], undefined),
  ['服務等級名稱為必填'], 'validate 純空白名稱回必填錯誤');

assertDeep(
  SLU.validate({
    name: 'B 保修(一年兩次)', maintenanceCount: 2, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 6 }, { visitIndex: 2, startMonth: 7, endMonth: 12 }
    ]
  }, LEVELS, undefined),
  ['服務等級名稱「B 保修(一年兩次)」已存在'], 'validate 名稱與他人重複回重複錯誤');
assertDeep(
  SLU.validate({
    name: 'B 保修(一年兩次)', maintenanceCount: 2, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 6 }, { visitIndex: 2, startMonth: 7, endMonth: 12 }
    ]
  }, LEVELS, 'SL002'),
  [], 'validate excludeId 排除自己時不算重複');

assertDeep(
  SLU.validate({ name: 'X', maintenanceCount: -1, periods: [] }, [], undefined),
  ['每年保養次數需為 0 或正整數'], 'validate 保養次數為負數');
assertDeep(
  SLU.validate({ name: 'X', maintenanceCount: 2.5, periods: [] }, [], undefined),
  ['每年保養次數需為 0 或正整數'], 'validate 保養次數非整數');

assertDeep(
  SLU.validate({
    name: 'X', maintenanceCount: 2, periods: [{ visitIndex: 1, startMonth: 1, endMonth: 6 }]
  }, [], undefined),
  ['保養區間筆數（1）與每年保養次數（2）不符'], 'validate 區間筆數少於保養次數');
assertDeep(
  SLU.validate({
    name: 'X', maintenanceCount: 1, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 6 }, { visitIndex: 2, startMonth: 7, endMonth: 12 }
    ]
  }, [], undefined),
  ['保養區間筆數（2）與每年保養次數（1）不符'], 'validate 區間筆數多於保養次數');

assertDeep(
  SLU.validate({
    name: 'X', maintenanceCount: 1, periods: [{ visitIndex: 1, startMonth: 0, endMonth: 6 }]
  }, [], undefined),
  ['第1次的起始月與結束月需為 1–12 月'], 'validate 起始月為 0 超出範圍');
assertDeep(
  SLU.validate({
    name: 'X', maintenanceCount: 1, periods: [{ visitIndex: 1, startMonth: 1, endMonth: 13 }]
  }, [], undefined),
  ['第1次的起始月與結束月需為 1–12 月'], 'validate 結束月為 13 超出範圍');
assertDeep(
  SLU.validate({
    name: 'X', maintenanceCount: 1, periods: [{ visitIndex: 1, startMonth: '', endMonth: 6 }]
  }, [], undefined),
  ['第1次的起始月與結束月需為 1–12 月'], 'validate 起始月為空字串視為超出範圍');
assertDeep(
  SLU.validate({
    name: 'X', maintenanceCount: 1, periods: [{ visitIndex: 1, startMonth: 8, endMonth: 3 }]
  }, [], undefined),
  ['第1次的起始月不可大於結束月'], 'validate 起始月大於結束月');

assertDeep(
  SLU.validate({
    name: 'X', maintenanceCount: 2, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 6 }, { visitIndex: 2, startMonth: 4, endMonth: 10 }
    ]
  }, [], undefined),
  ['第1次與第2次的保養區間重疊'], 'validate 兩區間重疊');
assertDeep(
  SLU.validate({
    name: 'X', maintenanceCount: 2, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 6 }, { visitIndex: 2, startMonth: 6, endMonth: 12 }
    ]
  }, [], undefined),
  ['第1次與第2次的保養區間重疊'], 'validate 共用邊界月份視為重疊');
assertDeep(
  SLU.validate({
    name: 'X', maintenanceCount: 2, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 6 }, { visitIndex: 2, startMonth: 7, endMonth: 12 }
    ]
  }, [], undefined),
  [], 'validate 相鄰不重疊區間視為合法');

console.log('\nSection 1｜isServiceLevelInUse');
const custs = [{ id: 'C1', name: '甲', serviceLevel: 'A 保修(一年四次)' }];
const strs = [{ id: 'S1', storeName: '甲一店', serviceLevel: 'B 保修(一年兩次)' }];
assertEq(SLU.isServiceLevelInUse('A 保修(一年四次)', custs, strs), true, '客戶使用中');
assertEq(SLU.isServiceLevelInUse('B 保修(一年兩次)', custs, strs), true, '門市使用中');
assertEq(SLU.isServiceLevelInUse('C 保養(一年一次)', custs, strs), false, '未被使用');

console.log('\nSection 1｜syncServiceLevelOptions');
sandbox.SERVICE_LEVEL_OPTIONS.push('殘留舊值');
const optRef = sandbox.SERVICE_LEVEL_OPTIONS;
SLU.syncServiceLevelOptions(LEVELS);
assertTrue(sandbox.SERVICE_LEVEL_OPTIONS === optRef, 'syncServiceLevelOptions 就地改寫，不換參考');
assertDeep(sandbox.SERVICE_LEVEL_OPTIONS,
  ['A 保修(一年四次)', 'B 保修(一年兩次)', 'C 保養(一年一次)', 'D 維修(無簽約客戶)'],
  'syncServiceLevelOptions 內容為四筆名稱且清掉舊值');
SLU.syncServiceLevelOptions([{ id: 'SL001', name: 'A 保修(一年四次)' }]);
assertDeep(sandbox.SERVICE_LEVEL_OPTIONS, ['A 保修(一年四次)'], '刪除後的等級不再出現在選項');
SLU.syncServiceLevelOptions(LEVELS); // 還原給後續 section 用

console.log('\nSection 1｜renameServiceLevel');
const renamed = SLU.renameServiceLevel('A 保修(一年四次)', 'A 全新名稱', {
  customers: [{ id: 'C1', serviceLevel: 'A 保修(一年四次)' }, { id: 'C2', serviceLevel: 'B 保修(一年兩次)' }],
  stores: [{ id: 'S1', serviceLevel: 'A 保修(一年四次)' }],
  cases: [{ id: 'R1', serviceLevel: 'A 保修(一年四次)' }],
  maintenanceCases: [{ id: 'M1', serviceLevel: 'A 保修(一年四次)' }, { id: 'M2', serviceLevel: '' }]
});
assertEq(renamed.customers[0].serviceLevel, 'A 全新名稱', 'customers 改名');
assertEq(renamed.customers[1].serviceLevel, 'B 保修(一年兩次)', '非目標等級不動');
assertEq(renamed.stores[0].serviceLevel, 'A 全新名稱', 'stores 改名');
assertEq(renamed.cases[0].serviceLevel, 'A 全新名稱', 'cases 改名');
assertEq(renamed.maintenanceCases[0].serviceLevel, 'A 全新名稱', 'maintenanceCases 改名');
assertEq(renamed.changedCount, 4, 'changedCount 為 4');
const noop = SLU.renameServiceLevel('A', 'A', { customers: [{ serviceLevel: 'A' }] });
assertEq(noop.changedCount, 0, '新舊同名時 changedCount 為 0');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
