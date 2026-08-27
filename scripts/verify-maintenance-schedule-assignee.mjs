#!/usr/bin/env node
/**
 * 「從日曆點開保養單時，組別要帶得回來」驗證腳本。
 *
 * 保養單的組別在正規化後只存在 assignees[]（normalizeMaintenanceCase 會刪掉舊的
 * 單值 assignee），日曆的編輯入口若還讀 record.assignee 就會拿到空字串，
 * 彈窗的「組別」變空白、按下儲存還會把原本的組別洗掉。
 * 以 node:vm 載入 IIFE 模組做純函式驗證。
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
load('src/features/customer/vendor-utils.js');
load('src/features/permissions/service-level-utils.js');
load('src/features/repair/case-assignee-utils.js');
load('src/features/scheduling/schedule-utils.js');
const SU = sandbox.ScheduleUtils;
const CAU = sandbox.CaseAssigneeUtils;

console.log('Section 1｜保養單排程讀取以 assignees[] 為準');
const CASE = CAU.normalizeMaintenanceCase({
  id: 'M-1',
  customerName: '星巴克',
  storeName: '中山店',
  assignees: ['A組'],
  assigneeMemberIds: ['ACC2'],
  planDate: '2026-08-26',
  planTimeStart: '09:00',
  planTimeEnd: '11:00',
  workCategory: '保養'
});
assertEq(CASE.assignee, undefined, '正規化後不再有單值 assignee');
const sched = SU.getMaintenanceSchedule(CASE);
assertEq(sched.assignee, 'A組', '排程物件帶回組別');
assertDeep(sched.assignees, ['A組'], '排程物件帶回組別陣列');
assertEq(sched.planDate, '2026-08-26', '排程物件帶回預計日期');
assertEq(sched.planTimeStart, '09:00', '排程物件帶回開始時間');
assertEq(sched.planTimeEnd, '11:00', '排程物件帶回結束時間');
assertEq(sched.workCategory, '保養', '排程物件帶回工項類別');

console.log('\nSection 2｜多組與未指派');
const MULTI = CAU.normalizeMaintenanceCase({ id: 'M-2', assignees: ['A組', 'C組'], planDate: '2026-08-26' });
assertEq(SU.getMaintenanceSchedule(MULTI).assignee, 'A組、C組', '多組以「、」串起');
const NONE = CAU.normalizeMaintenanceCase({ id: 'M-3', assignee: '尚未指派', planDate: '' });
assertEq(SU.getMaintenanceSchedule(NONE).assignee, '', '未指派回空字串');

console.log('\nSection 3｜舊資料（單值 assignee）仍讀得到');
assertEq(SU.getMaintenanceSchedule({ id: 'M-4', assignee: 'B組' }).assignee, 'B組', '舊單值資料相容');

console.log('\nSection 4｜假資料：保養計劃的組別都存成 assignees[]');
const seedSrc = readFileSync(join(ROOT, 'src/data/seed.js'), 'utf8');
const block = seedSrc.slice(
  seedSrc.indexOf('const INITIAL_MAINTENANCE_CASES'),
  seedSrc.indexOf('const INITIAL_PROJECT_CASES')
);
assertEq(/\n\s*assignee:/.test(block), false, '保養假資料不再使用單值 assignee');
assertEq(/assignees:/.test(block), true, '保養假資料使用 assignees[]');
assertEq(/assigneeMemberIds:/.test(block), true, '保養假資料附上指派人員');

console.log(`\n通過 ${passed}，失敗 ${failed}`);
process.exit(failed ? 1 : 0);
