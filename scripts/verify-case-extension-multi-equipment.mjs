#!/usr/bin/env node
/**
 * 延伸案件承接多筆設備：帶全部設備卡片，每張只保留「待處理」的處理方式。
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
function assertTrue(cond, name, detail) { if (cond) pass(name, detail); else fail(name, detail); }
function loadIife(rel, sandbox) {
  vm.runInContext(readFileSync(join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
}

const sandbox = { console, window: {}, global: null };
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
sandbox.ProcessMethodUtils = {
  getCaseRecordStatus: function (r) { return (r && r.status) || '已處理'; },
  isCaseRecordDone: function (r) { return !r.status || r.status === '已處理'; }
};
// buildExtensionCase 需要 IESS.caseDateTime.now()，補一個最小 stub。
sandbox.IESS = { caseDateTime: { now: function () { return '2026-08-25 09:00:00'; } } };
loadIife('src/features/repair/case-service-items.js', sandbox);
loadIife('src/features/repair/case-extension.js', sandbox);

const CE = sandbox.CaseExtensionUtils;
const SI = sandbox.RepairCaseServiceItems;

function rec(id, status) { return { id: id, points: 1, qty: 1, status: status }; }

const original = {
  id: 'C1', caseNumber: '20260825001', customerName: '測試客戶', storeName: '測試門市',
  serviceItems: [
    { id: 'SI1', equipment: { id: 'E1', deviceName: '分離式冷氣' }, actualReason: '不冷',
      processRecords: [rec(1, '已處理'), rec(2, '待處理')] },
    { id: 'SI2', equipment: { id: 'E2', deviceName: '冰水主機' }, actualReason: '異音',
      processRecords: [rec(3, '已處理')] }
  ]
};

console.log('延伸案件');
const ext = CE.buildExtensionCase(original, [original]);
assertEq(SI.getItems(ext).length, 2, '帶全部兩張設備卡片');
assertEq(SI.getEquipments(ext).map(function (e) { return e.id; }), ['E1', 'E2'], '設備依原順序');
assertEq(SI.getItems(ext)[0].processRecords.map(function (r) { return r.status; }), ['待處理'],
  '第一張只留待處理項目');
assertEq(SI.getItems(ext)[1].processRecords, [], '第二張已全部完成，服務項目為空');
assertEq(SI.getItems(ext)[0].actualReason, '不冷', '維修原因隨各自卡片帶過去');
assertEq(SI.getItems(ext)[1].actualReason, '異音', '第二張卡片的維修原因也帶過去');
assertTrue(!('equipment' in ext), '延伸案件不含舊 equipment 欄位');
assertTrue(!('processRecords' in ext), '延伸案件不含舊 processRecords 欄位');
assertTrue(!('actualReason' in ext), '延伸案件不含舊 actualReason 欄位');
assertTrue(SI.getItems(ext)[0].id !== 'SI1', '卡片 id 重新產生，避免與原案共用', SI.getItems(ext)[0].id);
assertTrue(SI.getItems(ext)[0].processRecords[0].id !== 2, '處理方式 id 重新產生',
  String(SI.getItems(ext)[0].processRecords[0].id));
assertEq(SI.getItems(original)[0].processRecords.length, 2, '原案件不被更動');

console.log('\nhasProcessData');
const csSandbox = { console, window: {} };
csSandbox.window = csSandbox;
csSandbox.global = csSandbox;
csSandbox.globalThis = csSandbox;
csSandbox.IESS = { caseDateTime: { now: function () { return '2026-08-25 09:00:00'; } } };
vm.createContext(csSandbox);
csSandbox.ProcessMethodUtils = sandbox.ProcessMethodUtils;
csSandbox.CaseExtensionUtils = CE;
loadIife('src/features/repair/case-service-items.js', csSandbox);
loadIife('src/features/repair/case-status.js', csSandbox);
const CS = csSandbox.IESS.caseStatus;

assertEq(CS.hasProcessData(original), true, '有處理方式時為 true');
assertEq(CS.hasProcessData({ serviceItems: [
  { id: 'SI1', equipment: { id: 'E1' }, actualReason: '', processRecords: [] }
] }), false, '只有設備、無服務內容時為 false');
assertEq(CS.hasProcessData({ serviceItems: [
  { id: 'SI1', equipment: { id: 'E1' }, actualReason: '待料', processRecords: [] }
] }), true, '第二張卡片有維修原因也算 true');
assertEq(CS.hasProcessData({ serviceItems: [], processStatus: '已完成' }), true,
  '處理狀態仍然算 process data');
assertEq(CS.hasProcessData({ serviceItems: [] }), false, '完全空白時為 false');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
