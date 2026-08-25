#!/usr/bin/env node
/**
 * Verification for equipment level (設備等級) lookup and bonus eligibility.
 * 設備等級的唯一來源是設備紀錄本身（設備管理設定），不再反查設備分類。
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
  PROCESS_METHOD_CATEGORIES: {},
  SERVICE_LEVEL_OPTIONS: [],
  // 必須與 src/data/options.js 的 EQUIPMENT_LEVEL_OPTIONS 一致
  EQUIPMENT_LEVEL_OPTIONS: ['一般設備', '增額設備'],
  // 必須與 src/data/options.js 的 DEFAULT_EQUIPMENT_LEVEL 一致
  DEFAULT_EQUIPMENT_LEVEL: '一般設備',
  EQUIP_MODEL_CATALOG: {},
  EQUIP_MODEL_OPTIONS: [],
  EQUIP_CATEGORY_OPTIONS: [],
  EQUIP_BRAND_OPTIONS: [],
  EQUIP_NAME_OPTIONS: [],
  EQUIP_STATUS_OPTIONS: ['運轉中', '達年限', '已汰換']
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

load('src/features/customer/equipment-utils.js');
load('src/features/permissions/device-category-utils.js');
load('src/features/permissions/service-level-utils.js');
load('src/features/permissions/process-method-utils.js');
load('src/features/repair/case-service-items.js');
load('src/features/repair/case-assignee-utils.js');
load('src/features/reports/performance-utils.js');

const EU = sandbox.window.EquipmentUtils;
const DCU = sandbox.window.DeviceCategoryUtils;

console.log('EquipmentUtils.getLevel');
assertEq(EU.getLevel({ model: 'RAS-100', equipmentLevel: '一般設備' }), '一般設備', '明確為一般設備');
assertEq(EU.getLevel({ model: 'FXYP100', equipmentLevel: '增額設備' }), '增額設備', '明確為增額設備');
assertEq(EU.getLevel({ model: 'PA-063' }), '一般設備', '舊資料無欄位視為一般設備');
assertEq(EU.getLevel({ equipmentLevel: '' }), '一般設備', '空字串視為一般設備');
assertEq(EU.getLevel({ equipmentLevel: '  ' }), '一般設備', '空白字串視為一般設備');
assertEq(EU.getLevel(null), '一般設備', 'null 視為一般設備');

console.log('\nEquipmentUtils.formatLevel');
assertEq(EU.formatLevel({ model: 'FXYP100', equipmentLevel: '增額設備' }), '增額設備', '有型號時顯示等級');
assertEq(EU.formatLevel({ model: 'RAS-100' }), '一般設備', '有型號、無等級退回預設');
assertEq(EU.formatLevel({ equipmentLevel: '增額設備' }), '', '未選型號一律顯示空字串');
assertEq(EU.formatLevel({}), '', '空物件顯示空字串');
assertEq(EU.formatLevel(null), '', 'null 顯示空字串');

console.log('\n設備等級已與設備分類脫鉤');
assertEq(typeof DCU.getEquipmentLevel, 'undefined', 'DeviceCategoryUtils 不再提供 getEquipmentLevel');
assertEq(typeof DCU.getEquipmentLevelByModel, 'undefined', 'DeviceCategoryUtils 不再提供 getEquipmentLevelByModel');
assertEq(typeof DCU.getEquipmentLevelByEquip, 'undefined', 'DeviceCategoryUtils 不再提供 getEquipmentLevelByEquip');
assertEq(typeof DCU.formatEquipmentLevel, 'undefined', 'DeviceCategoryUtils 不再提供 formatEquipmentLevel');

console.log('\nnormalizeRecord / findDuplicate');
const catRec = {
  id: 'DCAT1', category: '分離式', brand: '日立', deviceName: '分離式冷氣',
  specification: '3.5匹', model: 'RAS-100', refrigerant: 'R410A', powerSource: '220V'
};
const normalized = DCU.normalizeRecord(catRec);
assertEq(normalized.model, 'RAS-100', 'normalizeRecord 保留七欄');
assertEq('equipmentLevel' in normalized, false, 'normalizeRecord 不再輸出 equipmentLevel');
assertEq(
  DCU.findDuplicate([catRec], Object.assign({}, catRec, { equipmentLevel: '增額設備' }), null), true,
  '殘留的 equipmentLevel 鍵不影響重複判定'
);
assertEq(
  DCU.findDuplicate([catRec], Object.assign({}, catRec, { model: 'OTHER-1' }), null), false,
  '型號不同不算重複'
);

console.log('\n設備表單存檔欄位');
assertEq(DCU.defaultEquipRecord().equipmentLevel, '一般設備', '新設備預設一般設備');
assertEq(
  DCU.resolveProjectEquip({ model: 'FXYP100', equipmentLevel: '增額設備' }, []).equipmentLevel,
  '增額設備',
  '編輯既有設備時保留原本等級（不被欄位過濾掉）'
);
assertEq(
  DCU.resolveProjectEquip({ model: 'RAS-100' }, []).equipmentLevel,
  '一般設備',
  '舊設備無等級時退回預設'
);

console.log('\nisBonusEligible');

function caseWith(serviceLevel, level) {
  return {
    id: 'C-' + serviceLevel + '-' + level,
    serviceLevel: serviceLevel,
    isPerformanceIncluded: true,
    completionDate: '2026-08-05',
    performanceAssignees: ['王小明'],
    serviceItems: [{
      id: 'SI1',
      equipment: level === null ? null : { model: 'RAS-100', equipmentLevel: level },
      actualReason: '',
      processRecords: [{ processMethodId: 'PS1', points: 10, qty: 1 }]
    }]
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

assertEq(PU.isBonusEligible(caseWith('A 保修(一年四次)', '一般設備'), sls), false,
  'A + 一般設備 不計分');
assertEq(PU.isBonusEligible(caseWith('A 保修(一年四次)', '增額設備'), sls), true,
  'A + 增額設備 計分');
assertEq(PU.isBonusEligible(caseWith('B 保修(一年兩次)', '增額設備'), sls), true,
  'B + 增額設備 計分');
assertEq(PU.isBonusEligible(caseWith('B 保修(一年兩次)', '一般設備'), sls), false,
  'B + 一般設備 不計分');
assertEq(PU.isBonusEligible(caseWith('C 保養(一年一次)', '一般設備'), sls), true,
  'C + 一般設備 仍計分（回歸）');
assertEq(PU.isBonusEligible(caseWith('D 維修(無簽約客戶)', '一般設備'), sls), true,
  'D + 一般設備 仍計分（回歸）');
assertEq(PU.isBonusEligible(caseWith('A 保修(一年四次)', ''), sls), false,
  'A + 設備未存等級 不計分');
assertEq(PU.isBonusEligible(caseWith('A 保修(一年四次)', null), sls), false,
  'A + 案件無設備 不計分');
assertEq(PU.isBonusEligible(caseWith('', '增額設備'), sls), true,
  '服務等級為空 + 增額設備 計分');

console.log('\ngetCaseEquipmentLevels null-safety');
assertEq(PU.getCaseEquipmentLevels({ serviceItems: [{ id: 'SI1', equipment: null, actualReason: '', processRecords: [] }] }).length, 0,
  'equipment 為 null 的卡片不拋錯，且不列入等級');
assertEq(PU.getCaseEquipmentLevels({}).length, 0,
  '案件完全沒有 serviceItems 鍵不拋錯，視為無設備');
assertEq(PU.getCaseEquipmentLevels(null).length, 0,
  'c 本身為 null 不拋錯，視為無設備');

console.log('\ncomputeAssigneePerformance');

const quarter = { start: '2026-07-01', end: '2026-09-30', label: '2026 年第 3 季' };
const assignees = [{ id: 'ASG1', name: '王小明' }];

function bonusOf(cases) {
  return PU.computeAssigneePerformance({
    cases: cases,
    maintenanceCases: [],
    assignees: assignees,
    allocations: [],
    serviceLevels: sls,
    quarter: quarter
  })[0].bonusPoints;
}

assertEq(bonusOf([caseWith('A 保修(一年四次)', '一般設備')]), 0,
  'A + 一般設備 積分為 0');
assertEq(bonusOf([caseWith('A 保修(一年四次)', '增額設備')]), 10,
  'A + 增額設備 取得全額 10 分');
assertEq(bonusOf([caseWith('C 保養(一年一次)', '一般設備')]), 10,
  'C + 一般設備 取得全額 10 分（回歸）');

const excluded = caseWith('A 保修(一年四次)', '增額設備');
excluded.isPerformanceIncluded = false;
assertEq(bonusOf([excluded]), 0,
  'isPerformanceIncluded 為 false 時不計分');

const outOfRange = caseWith('A 保修(一年四次)', '增額設備');
outOfRange.completionDate = '2026-06-30';
assertEq(bonusOf([outOfRange]), 0,
  '季度範圍外不計分');

// A/增額 的分攤公式必須與同條件 C/D 完全相同
function bonusForMulti(serviceLevel, level) {
  const c = caseWith(serviceLevel, level);
  // 總分 10 → 10 / 2 = 5 分給王小明
  c.performanceAssignees = ['王小明', '李大華'];
  return PU.computeAssigneePerformance({
    cases: [c],
    maintenanceCases: [],
    assignees: assignees,
    allocations: [],
    serviceLevels: sls,
    quarter: quarter
  })[0].bonusPoints;
}

assertEq(bonusForMulti('A 保修(一年四次)', '增額設備'), 5,
  'A + 增額 多人指派，分攤得 5 分');
assertEq(
  bonusForMulti('A 保修(一年四次)', '增額設備'),
  bonusForMulti('C 保養(一年一次)', '一般設備'),
  'A/增額 與 C/一般 的分攤結果一致'
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
