#!/usr/bin/env node
/**
 * 資料調閱多選篩選：邏輯層驗證。
 * 以 node:vm 載入瀏覽器 IIFE 模組，斷言 DataRetrievalUtils 的陣列篩選語意。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0, failed = 0;
function pass(name, detail) {
  passed += 1;
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail) {
  failed += 1;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}
function assertEq(actual, expected, name) {
  if (actual === expected) pass(name, JSON.stringify(actual));
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertJson(actual, expected, name) {
  assertEq(JSON.stringify(actual), JSON.stringify(expected), name);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

function loadIife(relativePath, sandbox) {
  vm.runInContext(readFileSync(join(ROOT, relativePath), 'utf8'), sandbox, {
    filename: relativePath,
  });
}

function loadModules() {
  const sandbox = { console, window: {} };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  // 載入順序需與 index.html 一致：先 options（TAIWAN_CITY_DISTRICTS 等全域），
  // 再 store-utils，最後才是依賴前兩者的 data-retrieval-utils。
  loadIife('src/data/options.js', sandbox);
  loadIife('src/features/customer/store-utils.js', sandbox);
  loadIife('src/features/repair/case-assignee-utils.js', sandbox);
  loadIife('src/features/reports/data-retrieval-utils.js', sandbox);
  return { DRU: sandbox.DataRetrievalUtils, SU: sandbox.StoreUtils, sandbox };
}

// 一律帶滿的 filters 底稿，個別測試只覆寫關心的欄位。
function emptyFilters(overrides) {
  return Object.assign({
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    workCategory: [],
    repairItem: [],
    repairReason: [],
    customer: [],
    store: [],
    assignee: [],
    serviceLevel: [],
    contactPerson: [],
    city: [],
    district: [],
  }, overrides || {});
}

const REPAIR_CASES = [
  { id: 'R1', repairDate: '2026-08-01', workCategory: '一般叫修', repairItem: '冷氣不冷',
    repairReason: '缺冷媒', customerName: '甲客戶', storeName: '甲一店',
    assignees: ['A組', 'B組'], serviceLevel: 'A 尊榮' },
  { id: 'R2', repairDate: '2026-08-02', workCategory: '一般叫修', repairItem: '漏水',
    repairReason: '排水堵塞', customerName: '乙客戶', storeName: '乙一店',
    assignees: ['B組'], serviceLevel: 'B 進階' },
  { id: 'R3', repairDate: '2026-08-03', workCategory: '緊急叫修', repairItem: '冷氣不冷',
    repairReason: '缺冷媒', customerName: '丙客戶', storeName: '丙一店',
    assignees: ['C組'], serviceLevel: 'C 標準' },
  { id: 'R4', repairDate: '2026-08-04', workCategory: '保養', repairItem: '定保',
    repairReason: '例行', customerName: '甲客戶', storeName: '甲一店',
    assignees: ['A組'], serviceLevel: 'A 尊榮' },
];

function ids(list) {
  return list.map((c) => c.id).sort();
}

function testEmptyMeansAll(DRU) {
  console.log('\n1. 空陣列 = 全部');
  const all = DRU.filterRepairCases(REPAIR_CASES, emptyFilters());
  // R4 的 workCategory 為「保養」，filterRepairCases 一律排除，與篩選條件無關。
  assertJson(ids(all), ['R1', 'R2', 'R3'], '所有篩選為空時回傳全部非保養案件');
}

function testSingleFieldOr(DRU) {
  console.log('\n2. 單一欄位多值取 OR');
  const a = DRU.filterRepairCases(REPAIR_CASES, emptyFilters({ customer: ['甲客戶'] }));
  const b = DRU.filterRepairCases(REPAIR_CASES, emptyFilters({ customer: ['乙客戶'] }));
  const ab = DRU.filterRepairCases(REPAIR_CASES, emptyFilters({ customer: ['甲客戶', '乙客戶'] }));
  assertJson(ids(a), ['R1'], '單選甲客戶');
  assertJson(ids(b), ['R2'], '單選乙客戶');
  assertJson(ids(ab), ['R1', 'R2'], '多選 = 各自結果的聯集');
}

function testFieldsAreAnded(DRU) {
  console.log('\n3. 不同欄位之間取 AND');
  const r = DRU.filterRepairCases(REPAIR_CASES, emptyFilters({
    repairItem: ['冷氣不冷'],
    workCategory: ['緊急叫修'],
  }));
  assertJson(ids(r), ['R3'], '同時滿足叫修項目與工項分類');
}

function testRepairAssigneeMultiValue(DRU) {
  console.log('\n4. 維修人員多選命中多人指派案件');
  const a = DRU.filterRepairCases(REPAIR_CASES, emptyFilters({ assignee: ['A組'] }));
  assertJson(ids(a), ['R1'], 'A組 命中多人指派的 R1');
  const ac = DRU.filterRepairCases(REPAIR_CASES, emptyFilters({ assignee: ['A組', 'C組'] }));
  assertJson(ids(ac), ['R1', 'R3'], 'A組 + C組 取聯集');
  const legacy = DRU.filterRepairCases(
    [{ id: 'L1', repairDate: '2026-08-01', workCategory: '一般叫修', assignee: 'D組' }],
    emptyFilters({ assignee: ['D組'] })
  );
  assertJson(ids(legacy), ['L1'], '舊資料的單一 assignee 欄位仍可命中');
}

function testProjectAndMaintenance(DRU) {
  console.log('\n5. 工程與保養篩選');
  const projectCases = [
    { id: 'P1', creationDate: '2026-08-01', workCategory: '新設工程',
      customerName: '甲客戶', details: { contactPerson: '張三' } },
    { id: 'P2', creationDate: '2026-08-02', workCategory: '汰換工程',
      customerName: '乙客戶', stageAssignee: '李四' },
  ];
  assertJson(
    ids(DRU.filterProjectCases(projectCases, emptyFilters({ contactPerson: ['張三', '李四'] }))),
    ['P1', 'P2'],
    '負責人員多選同時吃 details.contactPerson 與 stageAssignee'
  );
  assertJson(
    ids(DRU.filterProjectCases(projectCases, emptyFilters({ workCategory: ['汰換工程'] }))),
    ['P2'],
    '工程類型單值'
  );

  const stores = [
    { id: 'S1', customerName: '甲客戶', storeName: '甲一店', companyCity: '臺北市', companyDistrict: '中正區' },
    { id: 'S2', customerName: '乙客戶', storeName: '乙一店', companyCity: '新北市', companyDistrict: '板橋區' },
  ];
  const maintenanceCases = [
    { id: 'M1', customerName: '甲客戶', storeName: '甲一店', assignee: 'A組',
      serviceLevel: 'A 尊榮', planDate: '2026-08-01' },
    { id: 'M2', customerName: '乙客戶', storeName: '乙一店', assignee: 'B組',
      serviceLevel: 'B 進階', planDate: '2026-08-02' },
  ];
  assertJson(
    ids(DRU.filterMaintenanceCases(maintenanceCases, stores, emptyFilters({ city: ['臺北市', '新北市'] }))),
    ['M1', 'M2'],
    '縣市多選取聯集'
  );
  assertJson(
    ids(DRU.filterMaintenanceCases(maintenanceCases, stores, emptyFilters({ assignee: ['B組'] }))),
    ['M2'],
    '保養維修人員單值'
  );
}

function main() {
  const { DRU } = loadModules();
  testEmptyMeansAll(DRU);
  testSingleFieldOr(DRU);
  testFieldsAreAnded(DRU);
  testRepairAssigneeMultiValue(DRU);
  testProjectAndMaintenance(DRU);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
