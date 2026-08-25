#!/usr/bin/env node
/**
 * 叫修案件「設備＋服務項目」卡片集合：helper 行為與舊資料遷移。
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
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    return;
  }
  pass(name);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

function loadIife(relativePath, sandbox) {
  vm.runInContext(readFileSync(join(ROOT, relativePath), 'utf8'), sandbox, { filename: relativePath });
}

const sandbox = { console, window: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
loadIife('src/features/repair/case-service-items.js', sandbox);
loadIife('src/features/repair/case-assignee-utils.js', sandbox);

const SI = sandbox.RepairCaseServiceItems;
const CAU = sandbox.CaseAssigneeUtils;

function mkEq(id) {
  return { id: id, deviceName: '分離式冷氣', model: 'RAS-' + id, equipmentLevel: '一般設備' };
}
function mkRec(id, status) {
  return { id: id, category1: '維修', category2: '冷氣', category3: '清洗',
    specification: '標準', qty: 1, unit: '台', points: 2, status: status || '已處理' };
}

console.log('createItem');
const created = SI.createItem(mkEq('E1'));
assertTrue(!!created.id, 'createItem 產生 id', created.id);
assertEq(created.equipment.model, 'RAS-E1', 'createItem 帶入設備快照');
assertEq(created.actualReason, '', 'createItem 維修原因預設空字串');
assertEq(created.processRecords, [], 'createItem 處理方式預設空陣列');
created.equipment.model = 'MUTATED';
assertEq(mkEq('E1').model, 'RAS-E1', 'createItem 對設備做深拷貝，改動不回寫來源');

console.log('\nid 唯一');
assertTrue(SI.createItem(null).id !== SI.createItem(null).id, '連續建立的卡片 id 不重複');

console.log('\n聚合 helper');
const multi = { serviceItems: [
  { id: 'SI1', equipment: mkEq('E1'), actualReason: '壓縮機異音', processRecords: [mkRec(1), mkRec(2, '待處理')] },
  { id: 'SI2', equipment: mkEq('E2'), actualReason: '', processRecords: [mkRec(3)] }
] };
assertEq(SI.getItems(multi).length, 2, 'getItems 回傳兩張卡片');
assertEq(SI.getEquipments(multi).map(function (e) { return e.id; }), ['E1', 'E2'], 'getEquipments 依序回傳設備');
assertEq(SI.getAllProcessRecords(multi).map(function (r) { return r.id; }), [1, 2, 3], 'getAllProcessRecords 攤平所有處理方式');
assertTrue(SI.hasAnyProcessData(multi), 'hasAnyProcessData 有資料時為 true');
assertEq(SI.getItems(null), [], 'getItems 對 null 回傳空陣列');
assertEq(SI.getAllProcessRecords({}), [], 'getAllProcessRecords 對無 serviceItems 回傳空陣列');
assertTrue(!SI.hasAnyProcessData({ serviceItems: [{ id: 'SI9', equipment: mkEq('E9'), actualReason: '', processRecords: [] }] }),
  '只有設備、沒有服務內容時 hasAnyProcessData 為 false');
assertEq(SI.getEquipments({ serviceItems: [{ id: 'SI9', equipment: null, actualReason: '', processRecords: [] }] }), [],
  'getEquipments 略過沒有設備的卡片');

console.log('\nformatActualReasonSummary（案件列表／紀錄／銷案審核／資料調閱四處共用）');
// 三張卡片、含一張空 actualReason，驗證真的是把多張卡片的原因用「、」串起來——
// 不是拿現成的手打字串比對，是真的呼叫 join 邏輯。
const threeCard = { serviceItems: [
  { id: 'SI1', equipment: mkEq('E1'), actualReason: '壓縮機異音', processRecords: [] },
  { id: 'SI2', equipment: mkEq('E2'), actualReason: '', processRecords: [] },
  { id: 'SI3', equipment: mkEq('E3'), actualReason: '濾網堵塞', processRecords: [] }
] };
assertEq(SI.formatActualReasonSummary(threeCard), '壓縮機異音、濾網堵塞',
  '多張卡片依序串接，空原因的卡片跳過');
assertEq(SI.formatActualReasonSummary(multi), '壓縮機異音', '單張有原因、單張空時只留有內容的那張');
assertEq(SI.formatActualReasonSummary({ serviceItems: [] }), '', '沒有卡片時回空字串');
assertEq(SI.formatActualReasonSummary(null), '', '案件為 null 時回空字串');

console.log('\nremoveItem / updateItem');
assertEq(SI.removeItem(multi, 'SI1').map(function (it) { return it.id; }), ['SI2'], 'removeItem 移除指定卡片');
assertEq(SI.getItems(multi).length, 2, 'removeItem 不改動原案件');
assertEq(SI.updateItem(multi, 'SI2', { actualReason: '濾網堵塞' })[1].actualReason, '濾網堵塞', 'updateItem 套用 patch');
assertEq(SI.getItems(multi)[1].actualReason, '', 'updateItem 不改動原案件');

console.log('\n舊資料遷移');
const legacy = CAU.normalizeRepairCase({
  id: 'C1', equipment: mkEq('E1'), actualReason: '不冷', processRecords: [mkRec(1)]
});
assertEq(legacy.serviceItems.length, 1, '舊案件摺成單筆卡片');
assertEq(legacy.serviceItems[0].equipment.id, 'E1', '卡片帶原設備');
assertEq(legacy.serviceItems[0].actualReason, '不冷', '卡片帶原維修原因');
assertEq(legacy.serviceItems[0].processRecords.length, 1, '卡片帶原處理方式');
assertTrue(!('equipment' in legacy), '遷移後移除 equipment 欄位');
assertTrue(!('actualReason' in legacy), '遷移後移除 actualReason 欄位');
assertTrue(!('processRecords' in legacy), '遷移後移除 processRecords 欄位');

const emptyLegacy = CAU.normalizeRepairCase({ id: 'C2', equipment: null, actualReason: '', processRecords: [] });
assertEq(emptyLegacy.serviceItems, [], '三者皆空時 serviceItems 為空陣列');

const reasonOnly = CAU.normalizeRepairCase({ id: 'C3', equipment: null, actualReason: '待料', processRecords: [] });
assertEq(reasonOnly.serviceItems.length, 1, '只有維修原因也會建立一張卡片');
assertEq(reasonOnly.serviceItems[0].equipment, null, '該卡片設備為 null');

const already = CAU.normalizeRepairCase({ id: 'C4', serviceItems: [
  { equipment: mkEq('E1') },
  { id: 'SI2', equipment: mkEq('E2'), actualReason: '異音', processRecords: [mkRec(5)] }
] });
assertEq(already.serviceItems.length, 2, '已是新結構時保留兩張卡片');
assertTrue(!!already.serviceItems[0].id, '缺 id 的卡片會補上 id', already.serviceItems[0].id);
assertEq(already.serviceItems[0].actualReason, '', '缺 actualReason 的卡片補空字串');
assertEq(already.serviceItems[0].processRecords, [], '缺 processRecords 的卡片補空陣列');

const twice = CAU.normalizeRepairCase(CAU.normalizeRepairCase({
  id: 'C5', equipment: mkEq('E1'), actualReason: '不冷', processRecords: [mkRec(1)]
}));
assertEq(twice.serviceItems.length, 1, '重複 normalize 不會重複產生卡片');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
