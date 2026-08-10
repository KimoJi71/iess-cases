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
  // options.js 以頂層 const 宣告全域常數：這類宣告只存在於該 vm context 的
  // 全域語彙作用域（其他一併載入的 script 仍可直接參照），並不會像 var 一樣
  // 成為 sandbox 物件本身的屬性，所以測試斷言要用時得另外撈出來掛上去。
  sandbox.TAIWAN_CITY_OPTIONS = vm.runInContext('TAIWAN_CITY_OPTIONS', sandbox);
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
  // 與 R1 同門市名稱、不同客戶：用來檢驗門市篩選是「客戶+門市」配對而非只比門市名。
  { id: 'R5', repairDate: '2026-08-05', workCategory: '一般叫修', repairItem: '漏水',
    repairReason: '排水堵塞', customerName: '乙客戶', storeName: '甲一店',
    assignees: ['B組'], serviceLevel: 'B 進階' },
];

function ids(list) {
  return list.map((c) => c.id).sort();
}

function testEmptyMeansAll(DRU) {
  console.log('\n1. 空陣列 = 全部');
  const all = DRU.filterRepairCases(REPAIR_CASES, emptyFilters());
  // R4 的 workCategory 為「保養」，filterRepairCases 一律排除，與篩選條件無關。
  assertJson(ids(all), ['R1', 'R2', 'R3', 'R5'], '所有篩選為空時回傳全部非保養案件');
}

function testSingleFieldOr(DRU) {
  console.log('\n2. 單一欄位多值取 OR');
  const a = DRU.filterRepairCases(REPAIR_CASES, emptyFilters({ customer: ['甲客戶'] }));
  const b = DRU.filterRepairCases(REPAIR_CASES, emptyFilters({ customer: ['乙客戶'] }));
  const ab = DRU.filterRepairCases(REPAIR_CASES, emptyFilters({ customer: ['甲客戶', '乙客戶'] }));
  assertJson(ids(a), ['R1'], '單選甲客戶');
  assertJson(ids(b), ['R2', 'R5'], '單選乙客戶');
  assertJson(ids(ab), ['R1', 'R2', 'R5'], '多選 = 各自結果的聯集');
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
    // 與 S1 同行政區名稱、不同縣市：用來檢驗行政區篩選是「縣市+行政區」配對。
    { id: 'S3', customerName: '丙客戶', storeName: '丙一店', companyCity: '基隆市', companyDistrict: '中正區' },
  ];
  const maintenanceCases = [
    { id: 'M1', customerName: '甲客戶', storeName: '甲一店', assignee: 'A組',
      serviceLevel: 'A 尊榮', planDate: '2026-08-01' },
    { id: 'M2', customerName: '乙客戶', storeName: '乙一店', assignee: 'B組',
      serviceLevel: 'B 進階', planDate: '2026-08-02' },
    { id: 'M3', customerName: '丙客戶', storeName: '丙一店', assignee: 'C組',
      serviceLevel: 'C 標準', planDate: '2026-08-03' },
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
  // 此斷言同時鎖定 filterMaintenanceCases 內 matches(filters.district, makeKey(loc.city, loc.district))
  // 而非 matches(filters.district, c.companyDistrict)：後者在 c.companyDistrict 為
  // undefined 時永遠不命中，會讓此案回傳空陣列。
  assertJson(
    ids(DRU.filterMaintenanceCases(maintenanceCases, stores, emptyFilters({
      district: [DRU.makeKey('新北市', '板橋區')]
    }))),
    ['M2'],
    '行政區篩選經由門市地址 fallback 命中（區辨式斷言，鎖定 store 查回的 loc.city + loc.district）'
  );
  assertJson(
    ids(DRU.filterMaintenanceCases(maintenanceCases, stores, emptyFilters({
      district: [DRU.makeKey('台北市', '中正區')]
    }))),
    ['M1'],
    '跨縣市同名行政區互不汙染：台北市中正區不得撈到基隆市中正區的 M3'
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
  // S4 與 S1 同名不同客戶，S5/S6 用來檢驗群組內「營業在前、撤店在後」
  // （'丁一店' < '丙二店'，純 zh-Hant 排序會把撤店的丁一店排到營業的丙二店之前）。
  { id: 'S6', customerName: '丙客戶', storeName: '丙二店', storeStatus: '營業' },
];

function groupNames(groups) {
  return groups.map(function (g) { return g.group; });
}

function labelsOf(groups, name) {
  var g = groups.find(function (x) { return x.group === name; });
  return g ? g.options.map(function (o) { return o.label; }) : null;
}

function testStoreGroups(DRU) {
  console.log('\n6. 門市選項依客戶分組');
  const all = DRU.getStoreGroupsForCustomers(STORES, []);
  assertJson(
    groupNames(all).slice().sort(),
    ['丙客戶', '乙客戶', '甲客戶'].slice().sort(),
    '未選客戶時涵蓋所有客戶（含只有撤店門市以外情形）'
  );
  assertJson(
    groupNames(all),
    ['甲客戶', '乙客戶', '丙客戶'].sort(function (a, b) { return a.localeCompare(b, 'zh-Hant'); }),
    '群組依客戶名稱 zh-Hant 排序'
  );
  assertJson(labelsOf(all, '甲客戶'), ['甲一店', '甲二店'], '甲客戶群組內的門市');
  assertJson(
    labelsOf(all, '乙客戶'), ['乙一店', '甲一店'],
    '乙客戶底下的「甲一店」獨立存在（區辨式斷言：若仍以門市名去重跨客戶合併，此店會被甲客戶的同名門市吃掉）'
  );
  assertJson(
    labelsOf(all, '丙客戶'), ['丙二店', '丁一店'],
    '群組內營業中門市排在撤店門市之前（純 zh-Hant 排序會把撤店的丁一店排到丙二店之前）'
  );

  const one = DRU.getStoreGroupsForCustomers(STORES, ['甲客戶']);
  assertJson(groupNames(one), ['甲客戶'], '選一個客戶時只回傳該客戶群組');

  const optA = all.find(function (g) { return g.group === '甲客戶'; }).options[0];
  assertEq(optA.value, DRU.makeKey('甲客戶', '甲一店'), '選項 value 是「客戶+門市」複合鍵');
  assertEq(optA.chipLabel, '甲客戶 · 甲一店', 'chipLabel 帶出客戶名稱');
  assertJson(DRU.parseKey(optA.value), { parent: '甲客戶', child: '甲一店' }, 'parseKey 還原複合鍵');
}

function testStoreFilterByPair(DRU) {
  console.log('\n7. 門市篩選比對「客戶+門市」配對');
  assertJson(
    ids(DRU.filterRepairCases(REPAIR_CASES, emptyFilters({
      store: [DRU.makeKey('甲客戶', '甲一店')]
    }))),
    ['R1'],
    '甲客戶的甲一店不得撈到乙客戶的同名門市 R5'
  );
  assertJson(
    ids(DRU.filterRepairCases(REPAIR_CASES, emptyFilters({
      store: [DRU.makeKey('乙客戶', '甲一店')]
    }))),
    ['R5'],
    '乙客戶的甲一店只回傳 R5'
  );
  assertJson(
    ids(DRU.filterRepairCases(REPAIR_CASES, emptyFilters({
      store: [DRU.makeKey('甲客戶', '甲一店'), DRU.makeKey('乙客戶', '甲一店')]
    }))),
    ['R1', 'R5'],
    '多選門市取聯集'
  );
  assertJson(
    ids(DRU.filterRepairCases(REPAIR_CASES, emptyFilters({ store: [] }))),
    ['R1', 'R2', 'R3', 'R5'],
    '門市空陣列仍代表不篩選'
  );
}

function testDistrictGroups(DRU, SU, sandbox) {
  console.log('\n8. 行政區選項依縣市分組');
  const cities = sandbox.TAIWAN_CITY_OPTIONS;
  const all = DRU.getDistrictGroupsForCities([]);
  assertEq(groupNames(all).length, cities.length, '未選縣市時涵蓋所有縣市');
  assertJson(groupNames(all), cities, '群組順序沿用 TAIWAN_CITY_OPTIONS');

  const two = DRU.getDistrictGroupsForCities(['台南市', '台中市']);
  assertJson(
    groupNames(two),
    cities.filter(function (c) { return c === '台中市' || c === '台南市'; }),
    '選取縣市的群組順序仍沿用 TAIWAN_CITY_OPTIONS（不隨勾選順序跑掉）'
  );
  const taichung = SU.getDistrictsForCity('台中市');
  assertJson(labelsOf(two, '台中市'), taichung, '群組內行政區沿用 StoreUtils.getDistrictsForCity 的順序');

  const overlap = taichung.filter(function (d) {
    return SU.getDistrictsForCity('台南市').indexOf(d) !== -1;
  });
  assertTrue(overlap.length > 0, '台中市與台南市有同名行政區（測試前提）', overlap.join('、'));
  const values = two.reduce(function (acc, g) {
    return acc.concat(g.options.map(function (o) { return o.value; }));
  }, []);
  assertEq(new Set(values).size, values.length, '同名行政區因帶縣市前綴而不重複');
  assertEq(
    two.find(function (g) { return g.group === '台中市'; }).options[0].value,
    DRU.makeKey('台中市', taichung[0]),
    '選項 value 是「縣市+行政區」複合鍵'
  );
}

function main() {
  const { DRU, SU, sandbox } = loadModules();
  testEmptyMeansAll(DRU);
  testSingleFieldOr(DRU);
  testFieldsAreAnded(DRU);
  testRepairAssigneeMultiValue(DRU);
  testProjectAndMaintenance(DRU);
  testStoreGroups(DRU);
  testStoreFilterByPair(DRU);
  testDistrictGroups(DRU, SU, sandbox);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
