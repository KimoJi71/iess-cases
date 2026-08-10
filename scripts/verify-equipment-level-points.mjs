#!/usr/bin/env node
/**
 * Verification for equipment level (設備等級) lookup and bonus eligibility.
 * Loads the browser IIFE modules in Node with minimal stubs.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

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
    return false;
  }
  pass(name, JSON.stringify(actual));
  return true;
}

const sandbox = {
  console,
  SERVICE_LEVEL_OPTIONS: [],
  // 必須與 src/data/options.js 的 EQUIPMENT_LEVEL_OPTIONS 一致
  EQUIPMENT_LEVEL_OPTIONS: ['基礎設備', '增額設備'],
  // 必須與 src/data/options.js 的 DEFAULT_EQUIPMENT_LEVEL 一致
  DEFAULT_EQUIPMENT_LEVEL: '基礎設備',
  EQUIP_MODEL_CATALOG: {},
  EQUIP_MODEL_OPTIONS: [],
  EQUIP_CATEGORY_OPTIONS: [],
  EQUIP_BRAND_OPTIONS: [],
  EQUIP_NAME_OPTIONS: [],
  EQUIP_STATUS_OPTIONS: ['運轉', '轉汰換', '已汰換']
};
sandbox.window = sandbox;
vm.createContext(sandbox);

function load(relPath) {
  vm.runInContext(readFileSync(join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath.split('/').pop()
  });
}

sandbox.StoreUtils = {
  matchesStoreRecord: function () { return false; },
  getStoreArea: function () { return ''; },
  getRecordArea: function () { return ''; }
};
sandbox.AssigneeUtils = {
  getPerformanceAssignee: function () { return ''; }
};

load('src/features/permissions/device-category-utils.js');
load('src/features/permissions/service-level-utils.js');
load('src/features/repair/case-assignee-utils.js');
load('src/features/reports/performance-utils.js');

const DCU = sandbox.window.DeviceCategoryUtils;

const cats = [
  { id: 'DCAT1', category: '分離式', brand: '日立', deviceName: '分離式冷氣',
    specification: '3.5匹', model: 'RAS-100', refrigerant: 'R410A',
    powerSource: '220V', equipmentLevel: '基礎設備' },
  { id: 'DCAT2', category: '分離式', brand: '大金', deviceName: '吊隱式冷氣',
    specification: '4.0匹', model: 'FXYP100', refrigerant: 'R32',
    powerSource: '220V', equipmentLevel: '增額設備' },
  // 舊資料：完全沒有 equipmentLevel 鍵
  { id: 'DCAT3', category: '冰水', brand: '三菱重工', deviceName: '冰水主機',
    specification: '5.0匹', model: 'PA-063', refrigerant: 'R134a',
    powerSource: '380V' },
  // 同型號、不同品牌／等級的兩筆紀錄 — 型號查找必須依五欄組合而非型號單獨判定
  { id: 'DCAT4', category: '分離式', brand: '日立', deviceName: '分離式冷氣',
    specification: '2.0匹', model: 'RAS-SHARED', refrigerant: 'R410A',
    powerSource: '110V', equipmentLevel: '基礎設備' },
  { id: 'DCAT5', category: '分離式', brand: '大金', deviceName: '分離式冷氣',
    specification: '2.0匹', model: 'RAS-SHARED', refrigerant: 'R32',
    powerSource: '110V', equipmentLevel: '增額設備' },
  // 舊資料：使用 name 而非 deviceName
  { id: 'DCAT6', category: '分離式', brand: '國際牌', name: '分離式冷氣',
    specification: '2.5匹', model: 'LEGACY-NAME', refrigerant: 'R410A',
    powerSource: '220V', equipmentLevel: '增額設備' }
];

console.log('getEquipmentLevel');
assertEq(DCU.getEquipmentLevel(cats[0]), '基礎設備', '明確為基礎設備');
assertEq(DCU.getEquipmentLevel(cats[1]), '增額設備', '明確為增額設備');
assertEq(DCU.getEquipmentLevel(cats[2]), '基礎設備', '舊資料無欄位視為基礎設備');
assertEq(DCU.getEquipmentLevel({ equipmentLevel: '' }), '基礎設備', '空字串視為基礎設備');
assertEq(DCU.getEquipmentLevel({ equipmentLevel: '  ' }), '基礎設備', '空白字串視為基礎設備');
assertEq(DCU.getEquipmentLevel(null), '基礎設備', 'null 視為基礎設備');

console.log('\ngetEquipmentLevelByModel');
assertEq(DCU.getEquipmentLevelByModel(cats, 'FXYP100'), '增額設備', '依型號查到增額設備');
assertEq(DCU.getEquipmentLevelByModel(cats, 'RAS-100'), '基礎設備', '依型號查到基礎設備');
assertEq(DCU.getEquipmentLevelByModel(cats, 'PA-063'), '基礎設備', '舊資料型號視為基礎設備');
assertEq(DCU.getEquipmentLevelByModel(cats, '不存在的型號'), '基礎設備', '查無型號視為基礎設備');
assertEq(DCU.getEquipmentLevelByModel(cats, ''), '基礎設備', '型號為空視為基礎設備');
assertEq(DCU.getEquipmentLevelByModel([], 'FXYP100'), '基礎設備', '分類清單為空視為基礎設備');

console.log('\ngetEquipmentLevelByEquip');
assertEq(
  DCU.getEquipmentLevelByEquip(cats, {
    category: '分離式', brand: '日立', deviceName: '分離式冷氣',
    specification: '2.0匹', model: 'RAS-SHARED'
  }),
  '基礎設備',
  '五欄完全相符（日立）命中基礎設備，而非同型號的大金增額設備紀錄'
);
assertEq(
  DCU.getEquipmentLevelByEquip(cats, {
    category: '分離式', brand: '大金', deviceName: '分離式冷氣',
    specification: '2.0匹', model: 'RAS-SHARED'
  }),
  '增額設備',
  '五欄完全相符（大金）命中增額設備，而非同型號的日立基礎設備紀錄'
);
assertEq(
  DCU.getEquipmentLevelByEquip(cats, { model: 'FXYP100' }),
  '增額設備',
  '僅有型號、缺上層欄位時退回型號查找'
);
assertEq(
  DCU.getEquipmentLevelByEquip(cats, {
    category: '分離式', brand: '國際牌', deviceName: '分離式冷氣',
    specification: '2.5匹', model: 'LEGACY-NAME'
  }),
  '增額設備',
  '舊資料以 name 而非 deviceName 儲存，仍能以五欄組合命中'
);
assertEq(DCU.getEquipmentLevelByEquip(cats, null), '基礎設備', '設備為 null 視為基礎設備');
assertEq(DCU.getEquipmentLevelByEquip(cats, {}), '基礎設備', '設備為空物件視為基礎設備');
assertEq(DCU.getEquipmentLevelByEquip([], { model: 'RAS-SHARED' }), '基礎設備', '分類清單為空視為基礎設備');

console.log('\nnormalizeRecord / recordKey');
const normalized = DCU.normalizeRecord(cats[1]);
assertEq(normalized.equipmentLevel, '增額設備', 'normalizeRecord 保留 equipmentLevel');
assertEq(normalized.model, 'FXYP100', 'normalizeRecord 保留七欄');
assertEq(DCU.normalizeRecord(cats[2]).equipmentLevel, '', 'normalizeRecord 對缺欄位輸出空字串');

const baseRec = Object.assign({}, cats[0]);
const sameButAddOn = Object.assign({}, cats[0], { equipmentLevel: '增額設備' });
assertEq(
  DCU.findDuplicate([baseRec], sameButAddOn, null), true,
  '七欄相同、等級不同仍判定為重複'
);
const diffModel = Object.assign({}, cats[0], { model: 'OTHER-1' });
assertEq(
  DCU.findDuplicate([baseRec], diffModel, null), false,
  '型號不同不算重複'
);

console.log('\nisBonusEligible');

function caseWith(serviceLevel, model) {
  return {
    id: 'C-' + serviceLevel + '-' + model,
    serviceLevel: serviceLevel,
    isPerformanceIncluded: true,
    completionDate: '2026-08-05',
    performanceAssignees: ['王小明'],
    collaborators: [],
    equipment: model === null ? null : { model: model },
    processRecords: [{ processMethodId: 'PS1', points: 10, qty: 1 }]
  };
}

const PU = sandbox.window.PerformanceUtils;

// 與 seed 的 INITIAL_SERVICE_LEVELS 一致：A/B 不計增額積分，C/D 計增額積分
const sls = [
  { id: 'SL001', name: 'A 保修(一年四次)', maintenanceCount: 4, countsBonusPoints: false },
  { id: 'SL002', name: 'B 保修(一年兩次)', maintenanceCount: 2, countsBonusPoints: false },
  { id: 'SL003', name: 'C 保養(一年一次)', maintenanceCount: 1, countsBonusPoints: true },
  { id: 'SL004', name: 'D 維修(無簽約客戶)', maintenanceCount: 0, countsBonusPoints: true }
];

assertEq(PU.isBonusEligible(caseWith('A 保修(一年四次)', 'RAS-100'), cats, sls), false,
  'A + 基礎設備 不計分');
assertEq(PU.isBonusEligible(caseWith('A 保修(一年四次)', 'FXYP100'), cats, sls), true,
  'A + 增額設備 計分');
assertEq(PU.isBonusEligible(caseWith('B 保修(一年兩次)', 'FXYP100'), cats, sls), true,
  'B + 增額設備 計分');
assertEq(PU.isBonusEligible(caseWith('B 保修(一年兩次)', 'RAS-100'), cats, sls), false,
  'B + 基礎設備 不計分');
assertEq(PU.isBonusEligible(caseWith('C 保養(一年一次)', 'RAS-100'), cats, sls), true,
  'C + 基礎設備 仍計分（回歸）');
assertEq(PU.isBonusEligible(caseWith('D 維修(無簽約客戶)', 'RAS-100'), cats, sls), true,
  'D + 基礎設備 仍計分（回歸）');
assertEq(PU.isBonusEligible(caseWith('A 保修(一年四次)', '查無此型號'), cats, sls), false,
  'A + 型號查無分類 不計分');
assertEq(PU.isBonusEligible(caseWith('A 保修(一年四次)', null), cats, sls), false,
  'A + 案件無設備 不計分');
assertEq(PU.isBonusEligible(caseWith('A 保修(一年四次)', 'PA-063'), cats, sls), false,
  'A + 分類無 equipmentLevel 欄位 不計分');
assertEq(PU.isBonusEligible(caseWith('', 'FXYP100'), cats, sls), true,
  '服務等級為空 + 增額設備 計分');

console.log('\ngetCaseEquipmentLevel null-safety');
assertEq(PU.getCaseEquipmentLevel({ equipment: null }, cats), '基礎設備',
  'equipment 為 null 不拋錯，視為基礎設備');
assertEq(PU.getCaseEquipmentLevel({}, cats), '基礎設備',
  '案件完全沒有 equipment 鍵不拋錯，視為基礎設備');
assertEq(PU.getCaseEquipmentLevel(null, cats), '基礎設備',
  'c 本身為 null 不拋錯，視為基礎設備');

console.log('\ncomputeAssigneePerformance');

const quarter = { start: '2026-07-01', end: '2026-09-30', label: '2026 年第 3 季' };
const assignees = [{ id: 'ASG1', name: '王小明' }];

function bonusOf(cases) {
  return PU.computeAssigneePerformance({
    cases: cases,
    maintenanceCases: [],
    assignees: assignees,
    allocations: [],
    deviceCategories: cats,
    serviceLevels: sls,
    quarter: quarter
  })[0].bonusPoints;
}

assertEq(bonusOf([caseWith('A 保修(一年四次)', 'RAS-100')]), 0,
  'A + 基礎設備 積分為 0');
assertEq(bonusOf([caseWith('A 保修(一年四次)', 'FXYP100')]), 10,
  'A + 增額設備 取得全額 10 分');
assertEq(bonusOf([caseWith('C 保養(一年一次)', 'RAS-100')]), 10,
  'C + 基礎設備 取得全額 10 分（回歸）');

const excluded = caseWith('A 保修(一年四次)', 'FXYP100');
excluded.isPerformanceIncluded = false;
assertEq(bonusOf([excluded]), 0,
  'isPerformanceIncluded 為 false 時不計分');

const outOfRange = caseWith('A 保修(一年四次)', 'FXYP100');
outOfRange.completionDate = '2026-06-30';
assertEq(bonusOf([outOfRange]), 0,
  '季度範圍外不計分');

// A/增額 的分攤公式必須與同條件 C/D 完全相同
function multiAssigneeCase(serviceLevel, model) {
  const c = caseWith(serviceLevel, model);
  c.performanceAssignees = ['王小明', '李大華'];
  c.collaborators = [{ name: '陳美玲', count: 1, points: 4 }];
  // 總分 10、協作 4 → (10 - 4) / 2 = 3 分給王小明
  return c;
}

function bonusForMulti(serviceLevel, model) {
  return PU.computeAssigneePerformance({
    cases: [multiAssigneeCase(serviceLevel, model)],
    maintenanceCases: [],
    assignees: assignees,
    allocations: [],
    deviceCategories: cats,
    serviceLevels: sls,
    quarter: quarter
  })[0].bonusPoints;
}

assertEq(bonusForMulti('A 保修(一年四次)', 'FXYP100'), 3,
  'A + 增額 多人指派含協作，分攤得 3 分');
assertEq(
  bonusForMulti('A 保修(一年四次)', 'FXYP100'),
  bonusForMulti('C 保養(一年一次)', 'RAS-100'),
  'A/增額 與 C/基礎 的分攤結果一致'
);

assertEq(
  PU.computeAssigneePerformance({
    cases: [caseWith('A 保修(一年四次)', 'FXYP100')],
    maintenanceCases: [],
    assignees: assignees,
    allocations: [],
    quarter: quarter
  })[0].bonusPoints,
  0,
  '未傳 deviceCategories 時退回原本的 C/D 行為（|| [] 預設值）'
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
