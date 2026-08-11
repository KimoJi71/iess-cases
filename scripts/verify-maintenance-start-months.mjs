#!/usr/bin/env node
/**
 * 「開始保養時間：於開幕 N 個月後開始保養」驗證腳本。
 * Section 1 以 node:vm 載入 IIFE 模組做純函式驗證；
 * Section 3 以後為 headless Chrome + CDP 的 UI 驗證。
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
const CU = sandbox.CustomerUtils;
const SU = sandbox.ScheduleUtils;

// 甲客戶：開幕 6 個月後才保養；乙客戶：未設定（視為 0）；丙客戶：設定為空字串。
const CUSTOMERS = [
  { id: 'C1', name: '甲客戶', serviceLevel: 'A 保修(一年四次)', enabled: true,
    maintenanceStartMonths: 6, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 }
    ] },
  { id: 'C2', name: '乙客戶', serviceLevel: 'A 保修(一年四次)', enabled: true, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 }
    ] },
  { id: 'C3', name: '丙客戶', serviceLevel: 'A 保修(一年四次)', enabled: true,
    maintenanceStartMonths: '', periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 }
    ] },
  { id: 'C4', name: '丁客戶', serviceLevel: 'A 保修(一年四次)', enabled: true,
    maintenanceStartMonths: -3, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 }
    ] },
  { id: 'C5', name: '戊客戶', serviceLevel: 'A 保修(一年四次)', enabled: true,
    maintenanceStartMonths: 2.7, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 }
    ] }
];

console.log('Section 1｜CustomerUtils.getMaintenanceStartMonths');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, '甲客戶'), 6, '讀到設定值');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, '乙客戶'), 0, '未設定欄位視為 0');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, '丙客戶'), 0, '空字串視為 0');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, '丁客戶'), 0, '負數夾成 0');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, '戊客戶'), 2, '非整數無條件捨去');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, '查無此客戶'), 0, '查無客戶視為 0');
assertEq(CU.getMaintenanceStartMonths(CUSTOMERS, ''), 0, '客戶名稱為空視為 0');
assertEq(CU.getMaintenanceStartMonths(null, '甲客戶'), 0, 'customers 為 null 視為 0');

console.log('\nSection 1｜CustomerUtils.getMaintenanceStartMonth');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '甲客戶', openDate: '2024-03-15' }), '2024-09',
  '2024-03 + 6 個月 = 2024-09（不看日）');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '甲客戶', openDate: '2024-10-01' }), '2025-04',
  '跨年：2024-10 + 6 個月 = 2025-04');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '甲客戶', openDate: '2024-07-31' }), '2025-01',
  '跨年邊界：2024-07 + 6 個月 = 2025-01');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '乙客戶', openDate: '2024-03-15' }), '2024-03',
  '未設定時起始保養月即開幕月');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '甲客戶', openDate: '' }), '', '無開幕日期回空字串');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '甲客戶' }), '', '缺 openDate 欄位回空字串');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS,
  { customerName: '甲客戶', openDate: '不是日期' }), '', '開幕日期格式無效回空字串');
assertEq(CU.getMaintenanceStartMonth(CUSTOMERS, null), '', 'store 為 null 回空字串');

console.log('\nSection 1｜CustomerUtils.isMaintenanceStartedForMonth');
const STORE_A = { customerName: '甲客戶', storeName: '甲一店', openDate: '2024-03-15' };
assertTrue(CU.isMaintenanceStartedForMonth(CUSTOMERS, STORE_A, '2024-09'),
  '起始保養月當月即達標');
assertTrue(CU.isMaintenanceStartedForMonth(CUSTOMERS, STORE_A, '2025-01'),
  '起始保養月之後達標');
assertTrue(!CU.isMaintenanceStartedForMonth(CUSTOMERS, STORE_A, '2024-08'),
  '起始保養月前一個月未達標');
assertTrue(!CU.isMaintenanceStartedForMonth(CUSTOMERS, STORE_A, '2024-03'),
  '開幕當月未達標');
assertTrue(!CU.isMaintenanceStartedForMonth(CUSTOMERS,
  { customerName: '甲客戶', storeName: '無開幕日店' }, '2026-08'),
  '門市無開幕日期時視為未達標');
assertTrue(CU.isMaintenanceStartedForMonth(CUSTOMERS,
  { customerName: '乙客戶', storeName: '乙一店', openDate: '2026-08-20' }, '2026-08'),
  '未設定欄位的客戶，開幕當月即達標');
assertTrue(!CU.isMaintenanceStartedForMonth(CUSTOMERS, STORE_A, ''),
  '參考月為空字串時視為未達標');
assertTrue(!CU.isMaintenanceStartedForMonth(CUSTOMERS, STORE_A, '2024'),
  '參考月格式無效時視為未達標');
assertTrue(!CU.isMaintenanceStartedForMonth(CUSTOMERS, null, '2026-08'),
  'store 為 null 時視為未達標');

console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
