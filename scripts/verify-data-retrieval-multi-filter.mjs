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
    { id: 'S1', customerName: '甲客戶', storeName: '甲一店', companyCity: '台北市', companyDistrict: '中正區' },
    { id: 'S2', customerName: '乙客戶', storeName: '乙一店', companyCity: '新北市', companyDistrict: '板橋區' },
  ];
  const maintenanceCases = [
    { id: 'M1', customerName: '甲客戶', storeName: '甲一店', assignee: 'A組',
      serviceLevel: 'A 尊榮', planDate: '2026-08-01' },
    { id: 'M2', customerName: '乙客戶', storeName: '乙一店', assignee: 'B組',
      serviceLevel: 'B 進階', planDate: '2026-08-02' },
  ];
  assertJson(
    ids(DRU.filterMaintenanceCases(maintenanceCases, stores, emptyFilters({ city: ['台北市', '新北市'] }))),
    ['M1', 'M2'],
    '縣市多選取聯集'
  );
  assertJson(
    ids(DRU.filterMaintenanceCases(maintenanceCases, stores, emptyFilters({ city: ['台北市'] }))),
    ['M1'],
    '單選縣市只回傳對應門市所在的案件（區辨式斷言：若縣市判斷被誤刪，此案將命中 M1+M2 而失敗）'
  );
  // M1/M2 案件本身沒有 companyCity/companyDistrict，district 判斷完全依賴
  // resolveMaintenanceLocation 從 stores 查回門市地址的 fallback 路徑（常見情形）。
  // 此斷言同時鎖定 filterMaintenanceCases 內 matches(filters.district, loc.district)
  // 而非 matches(filters.district, c.companyDistrict)：後者在 c.companyDistrict 為
  // undefined 時永遠不命中，會讓此案回傳空陣列。
  assertJson(
    ids(DRU.filterMaintenanceCases(maintenanceCases, stores, emptyFilters({ district: ['板橋區'] }))),
    ['M2'],
    '行政區篩選經由門市地址 fallback 命中（區辨式斷言，鎖定 store 查回的 loc.district）'
  );
  assertJson(
    ids(DRU.filterMaintenanceCases(maintenanceCases, stores, emptyFilters({ assignee: ['B組'] }))),
    ['M2'],
    '保養維修人員單值'
  );
}

const STORES = [
  { id: 'S1', customerName: '甲客戶', storeName: '甲一店', storeStatus: '營業' },
  { id: 'S2', customerName: '甲客戶', storeName: '甲二店', storeStatus: '營業' },
  { id: 'S3', customerName: '乙客戶', storeName: '乙一店', storeStatus: '營業' },
  { id: 'S4', customerName: '乙客戶', storeName: '甲一店', storeStatus: '營業' },
  { id: 'S5', customerName: '丙客戶', storeName: '丁一店', storeStatus: '撤店' },
  // 丙客戶另有一間營業中門市，名稱依 zh-Hant 排序落在撤店門市「之前」（'丁一店' < '丙二店'）。
  // 用來檢驗「營業在前、撤店在後」的分組是否在跨客戶合併聯集後仍然保留：
  // 若合併時只用單純的 localeCompare 重排（不分組），撤店的丁一店會排到營業中的丙二店之前，
  // 與 StoreUtils.getStoreNameOptions 對單一客戶的既有慣例不一致。
  { id: 'S6', customerName: '丙客戶', storeName: '丙二店', storeStatus: '營業' },
];

function testCascadeOptions(DRU, SU) {
  console.log('\n6. 連動欄位的選項聯集');
  assertJson(
    DRU.getStoreOptionsForCustomers(STORES, []),
    ['乙一店', '丙二店', '甲一店', '甲二店'],
    '未選客戶時列出所有營業中門市（去重排序，撤店不列）'
  );
  assertJson(
    DRU.getStoreOptionsForCustomers(STORES, ['甲客戶']),
    ['甲一店', '甲二店'],
    '單選客戶'
  );
  assertJson(
    DRU.getStoreOptionsForCustomers(STORES, ['甲客戶', '乙客戶']),
    ['乙一店', '甲一店', '甲二店'],
    '多客戶取聯集，同名門市只出現一次'
  );
  assertJson(
    DRU.getStoreOptionsForCustomers(STORES, ['丙客戶']),
    ['丙二店', '丁一店'],
    '撤店門市排在營業門市之後（保留 StoreUtils.getStoreNameOptions 的 active-before-closed 分組，' +
      '不因合併聯集重排而被單純的 localeCompare 蓋過；純字母排序會把撤店的丁一店排到營業的丙二店之前）'
  );

  assertJson(DRU.getDistrictOptionsForCities([]), [], '未選縣市時行政區為空');
  // 台中市/台南市都有 東區/南區/北區：這組城市能真正檢驗聯集去重，
  // 不像單一縣市或彼此無交集的縣市組合那樣，即使拿掉 dedup guard 斷言也會巧合通過。
  const taichung = SU.getDistrictsForCity('台中市');
  const tainan = SU.getDistrictsForCity('台南市');
  assertTrue(taichung.length > 0 && tainan.length > 0, '台中市/台南市行政區資料存在（測試前提）');
  const overlap = taichung.filter((d) => tainan.indexOf(d) !== -1);
  assertTrue(overlap.length > 0, '台中市與台南市的行政區名稱有重疊（測試前提，證明去重有東西可測）', overlap.join('、'));
  const union = DRU.getDistrictOptionsForCities(['台中市', '台南市']);
  assertTrue(
    union.length < taichung.length + tainan.length,
    '聯集數量少於兩縣市行政區數量相加（因重疊行政區被去重）',
    `union=${union.length}, sum=${taichung.length + tainan.length}`
  );
  assertTrue(
    taichung.every((d) => union.indexOf(d) !== -1) && tainan.every((d) => union.indexOf(d) !== -1),
    '聯集包含兩個縣市的全部行政區'
  );
  assertEq(new Set(union).size, union.length, '行政區聯集無重複');
}

function main() {
  const { DRU, SU } = loadModules();
  testEmptyMeansAll(DRU);
  testSingleFieldOr(DRU);
  testFieldsAreAnded(DRU);
  testRepairAssigneeMultiValue(DRU);
  testProjectAndMaintenance(DRU);
  testCascadeOptions(DRU, SU);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
