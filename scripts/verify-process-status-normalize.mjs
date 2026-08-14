#!/usr/bin/env node
/**
 * 處理狀態正規化：待汰換→轉汰換、其他→null；設備清單依客戶＋門市過濾。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function pass(name, detail) {
  passed += 1;
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail) {
  failed += 1;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}
function assertEq(actual, expected, name) {
  if (actual !== expected) {
    fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    return;
  }
  pass(name);
}

function loadIife(relativePath, sandbox) {
  vm.runInContext(readFileSync(join(ROOT, relativePath), 'utf8'), sandbox, { filename: relativePath });
}

const sandbox = { console, window: {}, DEFAULT_EQUIPMENT_LEVEL: '一般設備' };
sandbox.window = sandbox;
vm.createContext(sandbox);
loadIife('src/features/repair/case-assignee-utils.js', sandbox);
sandbox.EquipmentUtils = {
  formatLevel: function (eq) { return (eq && eq.equipmentLevel) || '一般設備'; }
};
loadIife('src/features/repair/case-equipment.js', sandbox);

const CAU = sandbox.CaseAssigneeUtils;
const RCE = sandbox.RepairCaseEquipment;

console.log('處理狀態正規化');
assertEq(CAU.normalizeProcessStatus('待汰換'), '轉汰換', '待汰換 → 轉汰換');
assertEq(CAU.normalizeProcessStatus('其他'), null, '其他 → null');
assertEq(CAU.normalizeProcessStatus(''), null, '空字串 → null');
assertEq(CAU.normalizeProcessStatus('待料件'), '待料件', '待料件維持不變');
assertEq(CAU.normalizeProcessStatus('轉原廠'), '轉原廠', '轉原廠維持不變');
assertEq(
  CAU.normalizeRepairCase({ processStatus: '待汰換', assignees: [] }).processStatus,
  '轉汰換',
  'normalizeRepairCase 轉換待汰換'
);
assertEq(
  CAU.normalizeRepairCase({ processStatus: '其他', assignees: [] }).processStatus,
  null,
  'normalizeRepairCase 清空其他'
);

console.log('\n設備欄位與門市過濾');
const labels = RCE.FIELD_DEFS.map(function (d) { return d.label; });
assertEq(labels.indexOf('流水序號') > -1, true, '欄位含流水序號');
assertEq(
  labels.indexOf('流水序號'),
  labels.indexOf('資產編號') + 1,
  '流水序號緊接資產編號之後'
);
assertEq(
  labels.indexOf('設備狀態'),
  labels.indexOf('流水序號') + 1,
  '設備狀態緊接流水序號之後'
);

const listed = RCE.listForCase([
  { id: 'E1', customerName: '屈臣氏', storeName: '台北信義店' },
  { id: 'E2', customerName: '屈臣氏', storeName: '站前店' },
  { id: 'E3', customerName: '星巴克', storeName: '台北信義店' }
], { customerName: '屈臣氏', storeName: '台北信義店' });
assertEq(listed.length, 1, '只列出同客戶同門市設備');
assertEq(listed[0].id, 'E1', '列出正確設備');
assertEq(
  RCE.listForCase([{ id: 'E1', customerName: '屈臣氏', storeName: '台北信義店' }], {
    customerName: '', storeName: ''
  }).length,
  0,
  '缺客戶或門市時不列出'
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
