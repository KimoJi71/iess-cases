#!/usr/bin/env node
/**
 * 「案件排程日曆卡片：組別下方顯示協力廠商；只有協力廠商、沒有組別則整筆不進日曆」驗證腳本。
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
load('src/features/customer/vendor-utils.js');
load('src/features/permissions/service-level-utils.js');
load('src/features/repair/case-assignee-utils.js');
load('src/features/scheduling/schedule-utils.js');
const SU = sandbox.ScheduleUtils;

const RANGE = ['2026-08-10', '2026-08-16'];
const VENDORS = [
  { id: 'V1', name: '大安工程', type: '協力商' },
  { id: 'V2', name: '信義空調', type: '協力商' }
];

// 四種組合：組別＋廠商、只有組別、只有廠商、兩者皆無。
const MAINTENANCE = [
  { id: 'M-both', customerName: '甲客戶', storeName: '甲一店',
    assignees: ['北區一組'], partnerVendorIds: ['V1', 'V2'],
    planDate: '2026-08-12', planTimeStart: '', planTimeEnd: '' },
  { id: 'M-group', customerName: '乙客戶', storeName: '乙一店',
    assignees: ['北區一組'], partnerVendorIds: [],
    planDate: '2026-08-12', planTimeStart: '', planTimeEnd: '' },
  { id: 'M-vendor', customerName: '丙客戶', storeName: '丙一店',
    assignees: [], partnerVendorIds: ['V1'],
    planDate: '2026-08-12', planTimeStart: '', planTimeEnd: '' },
  { id: 'M-none', customerName: '丁客戶', storeName: '丁一店',
    assignees: [], partnerVendorIds: [],
    planDate: '2026-08-12', planTimeStart: '', planTimeEnd: '' }
];
// 維修／工程走各自的排程來源，同樣要吃到規則。
const REPAIRS = [
  { id: 'R-vendor', customerName: '戊客戶', storeName: '戊一店', workCategory: '一般叫修',
    assignees: ['案件待辦'], partnerVendorIds: ['V2'], expectedDate: '2026-08-13' },
  { id: 'R-both', customerName: '己客戶', storeName: '己一店', workCategory: '一般叫修',
    assignees: ['南區二組'], partnerVendorIds: ['V2'], expectedDate: '2026-08-13' }
];
const PROJECTS = [
  { id: 'P-vendor', customerName: '庚客戶', storeName: '庚一店', workCategory: '新開',
    stageAssignee: '尚未指派', partnerVendorIds: ['V1'], planDate: '2026-08-14' }
];

const events = SU.getScheduledEvents(MAINTENANCE, REPAIRS, PROJECTS, RANGE[0], RANGE[1], '全部', VENDORS);
const byId = (id) => events.find(e => e.extendedProps.sourceId === id);

console.log('\n[1] 只有協力廠商、沒有組別 → 整筆不進日曆');
assertEq(!!byId('M-vendor'), false, '保養：只有協力廠商不產生卡片');
assertEq(!!byId('R-vendor'), false, '維修：組別為「案件待辦」且有協力廠商 → 不產生卡片');
assertEq(!!byId('P-vendor'), false, '工程：組別為「尚未指派」且有協力廠商 → 不產生卡片');

console.log('\n[2] 有組別的案件照常顯示');
assertEq(!!byId('M-both'), true, '組別＋協力廠商 → 有卡片');
assertEq(!!byId('M-group'), true, '只有組別 → 有卡片');
assertEq(!!byId('R-both'), true, '維修：組別＋協力廠商 → 有卡片');

console.log('\n[3] 組別、協力廠商皆無 → 仍顯示「未指派」');
const none = byId('M-none');
assertTrue(!!none, '兩者皆無的案件仍進日曆');
assertEq(none.title.split('\n')[1], '未指派', '第二行為「未指派」');
assertEq(none.title.split('\n').length, 4, '沒有協力廠商時不多出空行');

console.log('\n[4] 卡片版面：協力廠商獨立一行，接在組別下方');
assertEq(byId('M-both').title,
  ['[保養]', '北區一組', '大安工程、信義空調', '甲客戶', '甲一店'].join('\n'),
  '多家協力廠商以「、」串在同一行');
assertEq(byId('M-both').extendedProps.partnerVendorName, '大安工程、信義空調',
  'extendedProps 帶協力廠商名稱');
assertEq(byId('M-group').title,
  ['[保養]', '北區一組', '乙客戶', '乙一店'].join('\n'),
  '沒有協力廠商時省略該行');
assertEq(byId('R-both').title.split('\n')[2], '信義空調', '維修卡片同樣帶協力廠商行');

console.log('\n[5] 未帶 vendors 主檔時退回顯示 id，規則不受影響');
const noVendorMaster = SU.getScheduledEvents(MAINTENANCE, [], [], RANGE[0], RANGE[1], '全部');
assertEq(noVendorMaster.find(e => e.extendedProps.sourceId === 'M-both').title.split('\n')[2],
  'V1、V2', '查不到廠商名稱時顯示 id');
assertEq(!!noVendorMaster.find(e => e.extendedProps.sourceId === 'M-vendor'), false,
  '仍不顯示只有協力廠商的卡片');

console.log('\n[6] 人員動向清單不受此規則影響');
const rows = SU.getPersonnelRows(MAINTENANCE, REPAIRS, PROJECTS, RANGE[0], RANGE[1], '全部');
assertTrue(rows.some(r => r.sourceId === 'M-vendor'), '只有協力廠商的案件仍留在排程清單');

console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
