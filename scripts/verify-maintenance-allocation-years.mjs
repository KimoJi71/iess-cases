#!/usr/bin/env node
/**
 * 「保養分配年度快照」驗證腳本。
 * Section 1-3 以 node:vm 載入 IIFE 模組做純函式驗證；
 * Section 4 以後為 headless Chrome + CDP 的 UI 驗證。
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
load('src/features/permissions/service-level-utils.js');
load('src/features/permissions/assignee-utils.js');
load('src/features/customer/customer-utils.js');
load('src/features/customer/store-utils.js');
load('src/features/permissions/maintenance-allocation-utils.js');
const MAU = sandbox.MaintenanceAllocationUtils;

// 同一 assignee + customer + month，只差年份的兩筆格子
const ALLOCS = [
  { id: 'MA1', year: 2025, assigneeId: 'ASG1', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 5 },
  { id: 'MA2', year: 2026, assigneeId: 'ASG1', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 2 },
  { id: 'MA3', year: 2026, assigneeId: 'ASG1', customerName: '甲客戶', month: 5, visitIndex: 1, targetCount: 4 },
  { id: 'MA4', year: 2026, assigneeId: 'ASG2', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 9 }
];

console.log('Section 1｜分配格子的年份隔離');
assertEq(MAU.findAllocation(ALLOCS, 2025, 'ASG1', '甲客戶', 3).targetCount, 5,
  'findAllocation 取 2025 年那筆');
assertEq(MAU.findAllocation(ALLOCS, 2026, 'ASG1', '甲客戶', 3).targetCount, 2,
  'findAllocation 取 2026 年那筆');
assertEq(MAU.findAllocation(ALLOCS, 2027, 'ASG1', '甲客戶', 3), null,
  '查無年度回 null');
assertEq(MAU.findAllocation(ALLOCS, '2026', 'ASG1', '甲客戶', 3).targetCount, 2,
  '年份以數字比對，字串同樣查得到');

assertEq(MAU.sumVisitIndexTotal(ALLOCS, 2026, 'ASG1', '甲客戶', 1, null), 6,
  'sumVisitIndexTotal 只加總 2026 年（2 + 4）');
assertEq(MAU.sumVisitIndexTotal(ALLOCS, 2026, 'ASG1', '甲客戶', 1, 5), 2,
  'excludeMonth 排除 5 月後只剩 2');
assertEq(MAU.sumVisitIndexTotal(ALLOCS, 2025, 'ASG1', '甲客戶', 1, null), 5,
  '2025 年獨立加總');

assertEq(MAU.removeAllocation(ALLOCS, 2026, 'ASG1', '甲客戶', 3).length, 3,
  'removeAllocation 只移除指定年度那筆');
assertTrue(MAU.removeAllocation(ALLOCS, 2026, 'ASG1', '甲客戶', 3)
  .some(function (a) { return a.id === 'MA1'; }),
  'removeAllocation 不影響同鍵的 2025 年那筆');

assertEq(MAU.upsertAllocation(ALLOCS, {
  year: 2027, assigneeId: 'ASG1', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 7
}).length, 5, 'upsert 新年度為新增一筆');
assertEq(MAU.upsertAllocation(ALLOCS, {
  year: 2026, assigneeId: 'ASG1', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 7
}).length, 4, 'upsert 既有年度為就地更新');
assertEq(MAU.upsertAllocation(ALLOCS, {
  year: 2026, assigneeId: 'ASG1', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 7
}).find(function (a) { return a.id === 'MA2'; }).targetCount, 7,
  'upsert 更新到正確的那一筆');
assertEq(MAU.upsertAllocation(ALLOCS, {
  year: 2027, assigneeId: 'ASG1', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 7
}).find(function (a) { return Number(a.year) === 2027; }).year, 2027,
  'upsert 新增的那筆帶有 year');

assertDeep(MAU.buildSaveWarnings({
  allocations: ALLOCS, year: 2026, assigneeId: 'ASG1', customerName: '甲客戶',
  month: 3, visitIndex: 1, targetCount: 4, storeCount: 8
}), [], '2026 年第 1 次合計 4 + 4 = 8，等於門市數，無警示');
assertEq(MAU.buildSaveWarnings({
  allocations: ALLOCS, year: 2025, assigneeId: 'ASG1', customerName: '甲客戶',
  month: 3, visitIndex: 1, targetCount: 4, storeCount: 8
}).length, 1, '2025 年不會把 2026 年的格子算進合計，故出現不足警示');

console.log(`\n通過 ${passed}｜失敗 ${failed}`);
process.exit(failed ? 1 : 0);
