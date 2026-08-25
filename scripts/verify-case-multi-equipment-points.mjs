#!/usr/bin/env node
/**
 * 多筆設備的積分計算：處理方式跨卡片加總；任一設備為增額設備即整案計增額積分。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;
function pass(n, d) { passed++; console.log(`  ✓ ${n}${d ? ` — ${d}` : ''}`); }
function fail(n, d) { failed++; console.error(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
function assertEq(actual, expected, name) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    return;
  }
  pass(name);
}
function loadIife(rel, sandbox) {
  vm.runInContext(readFileSync(join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
}

const sandbox = { console, window: {}, DEFAULT_EQUIPMENT_LEVEL: '一般設備' };
sandbox.window = sandbox;
vm.createContext(sandbox);
// 只有「已處理」計分，狀態判讀沿用 ProcessMethodUtils 的規則
sandbox.ProcessMethodUtils = {
  isCaseRecordDone: function (r) { return !r.status || r.status === '已處理'; }
};
loadIife('src/features/repair/case-service-items.js', sandbox);
loadIife('src/features/repair/case-assignee-utils.js', sandbox);

const CAU = sandbox.CaseAssigneeUtils;

function rec(points, qty, status) {
  return { id: 'R' + points + qty, points: points, qty: qty, status: status || '已處理' };
}

console.log('sumProcessPoints 跨卡片');
const twoCards = {
  serviceItems: [
    { id: 'SI1', equipment: { id: 'E1' }, actualReason: '', processRecords: [rec(2, 1), rec(3, 2)] },
    { id: 'SI2', equipment: { id: 'E2' }, actualReason: '', processRecords: [rec(5, 1)] }
  ]
};
assertEq(CAU.sumProcessPoints(twoCards), 13, '兩張卡片積分加總 (2*1 + 3*2 + 5*1)');

const withPending = {
  serviceItems: [
    { id: 'SI1', equipment: { id: 'E1' }, actualReason: '', processRecords: [rec(2, 1), rec(9, 1, '待處理')] },
    { id: 'SI2', equipment: { id: 'E2' }, actualReason: '', processRecords: [rec(4, 1)] }
  ]
};
assertEq(CAU.sumProcessPoints(withPending), 6, '待處理項目不計分');
assertEq(CAU.sumProcessPoints({ serviceItems: [] }), 0, '無卡片時為 0');
assertEq(CAU.sumProcessPoints(null), 0, 'null 案件為 0');

console.log('\n增額設備判定');
// performance-utils 依賴 EquipmentUtils / ServiceLevelUtils，此處以最小樁載入
const perfSandbox = { console, window: {}, DEFAULT_EQUIPMENT_LEVEL: '一般設備' };
perfSandbox.window = perfSandbox;
vm.createContext(perfSandbox);
perfSandbox.EquipmentUtils = {
  getLevel: function (eq) { return (eq && eq.equipmentLevel) || '一般設備'; }
};
perfSandbox.ServiceLevelUtils = { countsBonusPoints: function () { return false; } };
perfSandbox.ProcessMethodUtils = sandbox.ProcessMethodUtils;
perfSandbox.CaseAssigneeUtils = CAU;
loadIife('src/features/repair/case-service-items.js', perfSandbox);
loadIife('src/features/reports/performance-utils.js', perfSandbox);
const PU = perfSandbox.PerformanceUtils;

const addOnSecond = { serviceItems: [
  { id: 'SI1', equipment: { id: 'E1', equipmentLevel: '一般設備' }, actualReason: '', processRecords: [] },
  { id: 'SI2', equipment: { id: 'E2', equipmentLevel: '增額設備' }, actualReason: '', processRecords: [] }
] };
assertEq(PU.isAddOnEquipmentCase(addOnSecond), true, '第二筆設備為增額設備時整案符合');

const noAddOn = { serviceItems: [
  { id: 'SI1', equipment: { id: 'E1', equipmentLevel: '一般設備' }, actualReason: '', processRecords: [] }
] };
assertEq(PU.isAddOnEquipmentCase(noAddOn), false, '皆非增額設備時不符合');
assertEq(PU.isAddOnEquipmentCase({ serviceItems: [] }), false, '無設備時不符合');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
