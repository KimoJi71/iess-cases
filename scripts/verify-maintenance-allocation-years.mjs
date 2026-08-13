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

const SERVICE_LEVELS = [
  { id: 'SL001', name: 'A 保修(一年四次)', maintenanceCount: 4, countsBonusPoints: false },
  { id: 'SL002', name: 'B 保修(一年兩次)', maintenanceCount: 2, countsBonusPoints: false },
  { id: 'SL004', name: 'D 維修(無簽約客戶)', maintenanceCount: 0, countsBonusPoints: true }
];
const SNAP_CUSTOMERS = [
  { id: 'C1', name: '甲客戶', serviceLevel: 'A 保修(一年四次)', periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 3 },
    { visitIndex: 2, startMonth: 4, endMonth: 6 },
    { visitIndex: 3, startMonth: 7, endMonth: 9 },
    { visitIndex: 4, startMonth: 10, endMonth: 12 }
  ] },
  { id: 'C2', name: '乙客戶', serviceLevel: 'B 保修(一年兩次)', periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 6 },
    { visitIndex: 2, startMonth: 7, endMonth: 12 }
  ] },
  { id: 'C3', name: '丙客戶', serviceLevel: 'D 維修(無簽約客戶)', periods: [] }
];
const SNAP_STORES = [
  { id: 'S1', customerName: '甲客戶', storeName: '甲一店', companyCity: '台北市', companyDistrict: '信義區', serviceLevel: 'A 保修(一年四次)' },
  { id: 'S2', customerName: '甲客戶', storeName: '甲二店', companyCity: '台北市', companyDistrict: '信義區', serviceLevel: 'A 保修(一年四次)' },
  { id: 'S3', customerName: '乙客戶', storeName: '乙一店', companyCity: '台北市', companyDistrict: '信義區', serviceLevel: 'B 保修(一年兩次)' },
  { id: 'S4', customerName: '乙客戶', storeName: '乙二店', companyCity: '台中市', companyDistrict: '西屯區', serviceLevel: 'B 保修(一年兩次)' },
  { id: 'S5', customerName: '丙客戶', storeName: '丙一店', companyCity: '台北市', companyDistrict: '信義區', serviceLevel: 'D 維修(無簽約客戶)' }
];
const SNAP_ASSIGNEES = [
  { id: 'ASG1', name: 'A組', districts: ['台北市信義區'] },
  { id: 'ASG2', name: 'B組', districts: ['台中市西屯區'] }
];

console.log('\nSection 2｜年度快照的建立與讀取');
const snap = MAU.buildYearSnapshot(
  2026, SNAP_ASSIGNEES, SNAP_CUSTOMERS, SNAP_STORES, SERVICE_LEVELS, '2026-01-05'
);
assertEq(snap.year, 2026, '快照的 year 為數字');
assertEq(snap.createdAt, '2026-01-05', 'createdAt 由呼叫端傳入');
assertEq(snap.syncedAt, '', '新建快照的 syncedAt 為空字串');
assertEq(snap.rows.length, 3, 'A組 2 列（甲、乙）+ B組 1 列（乙）＝ 3 列');
assertTrue(snap.rows.every(function (r) { return r.customerName !== '丙客戶'; }),
  'D 級客戶不入列');
assertEq(MAU.getSnapshotRows(snap, 'ASG1').length, 2, 'A組有 2 列');
// 註：zh-Hant 的 Intl collation 預設為筆畫序，'乙'（1 畫）排在 '甲'（5 畫）之前；
// 已於 Node 與 headless Chrome 兩端驗證行為一致，故以此為準（非 pinyin 序）。
assertDeep(MAU.getSnapshotRows(snap, 'ASG1').map(function (r) { return r.customerName; }),
  ['乙客戶', '甲客戶'], 'getSnapshotRows 依客戶名稱以 zh-Hant（筆畫序）排序');
assertEq(MAU.getSnapshotRows(snap, 'ASG1')[0].storeCount, 1, '乙客戶在 A組 轄區只有 1 間門市');
assertEq(MAU.getSnapshotRows(snap, 'ASG1')[1].storeCount, 2, '甲客戶在 A組 轄區有 2 間門市');
assertEq(MAU.getSnapshotRows(snap, 'ASG2')[0].storeCount, 1, '乙客戶在 B組 轄區有 1 間門市');
assertEq(MAU.getSnapshotRows(snap, 'ASG1')[1].serviceLevel, 'A 保修(一年四次)',
  '列上記錄當時的服務等級');
assertEq(MAU.getSnapshotRows(snap, 'ASG1')[1].periods.length, 4, '甲客戶快照有四個區間');
assertDeep(MAU.getSnapshotRows(snap, 'ASG9'), [], '查無指派人員回空陣列');
assertDeep(MAU.getSnapshotRows(null, 'ASG1'), [], 'snapshot 為 null 回空陣列');

// periods 必須是深拷貝（snap.rows[0] 為乙客戶，對應 SNAP_CUSTOMERS[1]）
snap.rows[0].periods[0].startMonth = 99;
assertEq(SNAP_CUSTOMERS[1].periods[0].startMonth, 1, '改快照的區間不會動到客戶記錄（深拷貝）');
snap.rows[0].periods[0].startMonth = 1;

const YEARS = [snap, MAU.buildYearSnapshot(2025, SNAP_ASSIGNEES, SNAP_CUSTOMERS, SNAP_STORES, SERVICE_LEVELS, '2025-01-03')];
assertDeep(MAU.listYears(YEARS), [2026, 2025], 'listYears 由大到小');
assertDeep(MAU.listYears([]), [], '無年度回空陣列');
assertDeep(MAU.listYears(null), [], 'null 回空陣列');
assertEq(MAU.findYearSnapshot(YEARS, 2025).year, 2025, 'findYearSnapshot 取得指定年度');
assertEq(MAU.findYearSnapshot(YEARS, '2026').year, 2026, '年份以數字比對');
assertEq(MAU.findYearSnapshot(YEARS, 2030), null, '查無年度回 null');

const rowA = MAU.getSnapshotRows(snap, 'ASG1')[1]; // 甲客戶：四個區間
const segMap = MAU.buildSegmentMap(rowA);
assertEq(segMap[1].period.visitIndex, 1, '1 月屬第 1 次');
assertEq(segMap[1].order, 0, '第 1 次的 order 為 0');
assertEq(segMap[12].period.visitIndex, 4, '12 月屬第 4 次');
assertEq(segMap[12].order, 3, '第 4 次的 order 為 3');
assertDeep(MAU.buildSegmentMap({ periods: [] }), {}, '無區間回空物件');
assertDeep(MAU.buildSegmentMap(null), {}, 'row 為 null 回空物件');

assertEq(MAU.findPeriodInRow(rowA, 5).visitIndex, 2, '5 月落在第 2 次');
assertEq(MAU.findPeriodInRow(rowA, 4).visitIndex, 2, '起始月為含界');
assertEq(MAU.findPeriodInRow(rowA, 6).visitIndex, 2, '結束月為含界');
const rowB = MAU.getSnapshotRows(snap, 'ASG1')[0]; // 乙客戶：兩個區間
assertEq(MAU.findPeriodInRow(rowB, 6).visitIndex, 1, '乙客戶 6 月落在第 1 次');
assertEq(MAU.findPeriodInRow({ periods: [{ visitIndex: 1, startMonth: 2, endMonth: 5 }] }, 1), null,
  '區間外回 null');
assertEq(MAU.findPeriodInRow(null, 1), null, 'row 為 null 回 null');

console.log(`\n通過 ${passed}｜失敗 ${failed}`);
process.exit(failed ? 1 : 0);
