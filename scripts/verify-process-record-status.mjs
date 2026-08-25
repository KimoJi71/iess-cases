#!/usr/bin/env node
/**
 * 叫修案件「處理方式」處理狀態（待處理／已處理）：
 * 預設狀態、排序（已處理 → 待處理）、只有已處理計入積分，
 * 以及三個畫面（編輯／明細／案件安排）的狀態欄與兩顆加入按鈕。
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
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass(name, JSON.stringify(actual));
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

function createSandbox() {
  const sandbox = {
    console,
    PROCESS_METHOD_CATEGORIES: {},
    ASSIGNEES: [],
    ASSIGNEE_MEMBER_GROUPS: [],
    ASSIGNEE_MEMBER_LABELS: {},
    ASSIGNEE_GROUP_HINTS: {},
    ACCOUNT_ASSIGNEE_OPTIONS: [],
    SCHEDULE_ASSIGNEE_OPTIONS: [],
    SERVICE_LEVEL_OPTIONS: [],
    StoreUtils: {
      matchesStoreRecord: () => false,
      getStoreArea: () => '',
      getRecordArea: () => ''
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

function load(sandbox, relPath) {
  vm.runInContext(readFileSync(join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath.split('/').pop()
  });
}

const sandbox = createSandbox();
load(sandbox, 'src/features/permissions/process-method-utils.js');
load(sandbox, 'src/features/repair/case-service-items.js');
load(sandbox, 'src/features/repair/case-assignee-utils.js');
load(sandbox, 'src/features/permissions/service-level-utils.js');
load(sandbox, 'src/features/reports/performance-utils.js');

const PMU = sandbox.ProcessMethodUtils;
const CAU = sandbox.CaseAssigneeUtils;
const PU = sandbox.PerformanceUtils;

const PM = {
  id: 'PS0001', category1: '零件類', category2: '商用分離式', category3: '壓縮機',
  specification: '6馬力', unit: '台', points: 9
};

console.log('狀態常數與判斷');
assertEq(PMU.PROCESS_RECORD_STATUS.DONE, '已處理', 'DONE 常數');
assertEq(PMU.PROCESS_RECORD_STATUS.PENDING, '待處理', 'PENDING 常數');
assertEq(PMU.getCaseRecordStatus({ points: 5 }), '已處理', '舊資料無 status 視為已處理');
assertEq(PMU.getCaseRecordStatus({ status: '待處理' }), '待處理', '待處理維持待處理');
assertEq(PMU.getCaseRecordStatus({ status: '亂寫' }), '已處理', '未知狀態退回已處理');
assertEq(PMU.isCaseRecordDone({ status: '待處理' }), false, 'isCaseRecordDone 待處理為 false');
assertEq(PMU.toggleCaseRecordStatus('已處理'), '待處理', '已處理切換為待處理');
assertEq(PMU.toggleCaseRecordStatus('待處理'), '已處理', '待處理切換為已處理');

console.log('\ntoCaseProcessRecord 帶入狀態');
assertEq(PMU.toCaseProcessRecord(PM, 2, 1).status, '已處理', '未指定狀態預設已處理');
assertEq(PMU.toCaseProcessRecord(PM, 2, 1, '待處理').status, '待處理', '指定待處理');
assertEq(PMU.toCaseProcessRecord(PM, 2, 1, '已處理').status, '已處理', '指定已處理');

console.log('\n排序：已處理 → 待處理（同組維持加入順序）');
const records = [
  { id: 1, status: '待處理', points: 3, qty: 1 },
  { id: 2, status: '已處理', points: 5, qty: 2 },
  { id: 3, status: '待處理', points: 7, qty: 1 },
  { id: 4, points: 4, qty: 1 }
];
assertEq(PMU.sortCaseProcessRecords(records).map(r => r.id), [2, 4, 1, 3], '排序結果');
assertEq(records.map(r => r.id), [1, 2, 3, 4], '不改動原陣列');
assertEq(PMU.sortCaseProcessRecords(null), [], 'null 回傳空陣列');

console.log('\n積分只計已處理');
function withRecords(recs) {
  return { serviceItems: [{ id: 'SI1', equipment: null, actualReason: '', processRecords: recs }] };
}
const caseData = withRecords(records);
// 已處理：5*2 + 4*1 = 14；待處理 3、7 不計
assertEq(PU.sumProcessPoints(caseData), 14, 'PerformanceUtils.sumProcessPoints');
assertEq(CAU.sumProcessPoints(caseData), 14, 'CaseAssigneeUtils.sumProcessPoints');
assertEq(PU.sumProcessPoints(withRecords([{ status: '待處理', points: 9, qty: 3 }])), 0,
  '全部待處理時積分為 0');
assertEq(PU.sumProcessPoints(withRecords([{ points: 9, qty: 3 }])), 27,
  '舊資料（無 status）仍計分');

console.log('\n畫面：加入按鈕與狀態欄');
// Task 5 起，編輯案件的處理方式表格已移入 RepairCaseServiceItemCard（每張設備卡各自一份）
const formSrc = readFileSync(join(ROOT, 'src/features/repair/case-form.js'), 'utf8');
const cardSrc = readFileSync(join(ROOT, 'src/features/repair/case-service-item-card.js'), 'utf8');
assertTrue(!/onClick: handleAddRecord\b/.test(formSrc) && !/}, "新增"\)/.test(formSrc)
  && !/onClick: handleAddRecord\b/.test(cardSrc) && !/}, "新增"\)/.test(cardSrc),
  '編輯案件不再有單一「新增」按鈕');
assertTrue(/PROCESS_RECORD_STATUS\.PENDING\);[\s\S]{0,220}'待處理'/.test(cardSrc),
  '「待處理」按鈕以待處理狀態加入');
assertTrue(/PROCESS_RECORD_STATUS\.DONE\);[\s\S]{0,220}'已處理'/.test(cardSrc),
  '「已處理」按鈕以已處理狀態加入');
assertTrue(/onToggleRecordStatus/.test(cardSrc) && /'轉待處理'/.test(cardSrc) && /'轉已處理'/.test(cardSrc),
  '表格內可切換狀態');
assertTrue(/colCount = pmColumns\.length \+ \(readOnly \? 3 : 4\)/.test(cardSrc),
  '編輯案件空列 colspan 已含狀態欄');

const surfaces = [
  ['src/features/repair/case-service-item-card.js', '編輯案件'],
  ['src/features/repair/case-view.js', '案件明細'],
  ['src/features/scheduling/case-arrangement.js', '案件安排']
];
surfaces.forEach(([rel, label]) => {
  const src = readFileSync(join(ROOT, rel), 'utf8');
  assertTrue(/['"]狀態['"]\)/.test(src), `${label}：表頭有狀態欄`);
  assertTrue(/sortCaseProcessRecords\(/.test(src), `${label}：依已處理 → 待處理排序`);
  assertTrue(/getCaseRecordStatusBadgeClass/.test(src), `${label}：狀態以 badge 呈現`);
  assertTrue(/不計分/.test(src), `${label}：待處理積分標註不計分`);
});

const viewSrc = readFileSync(join(ROOT, 'src/features/repair/case-view.js'), 'utf8');
assertTrue(/colspan: String\(pmColumns\.length \+ 3\)/.test(viewSrc), '案件明細空列 colspan 已含狀態欄');
const arrangeSrc = readFileSync(join(ROOT, 'src/features/scheduling/case-arrangement.js'), 'utf8');
assertTrue(/colspan: String\(pmColumns\.length \+ 3\)/.test(arrangeSrc), '案件安排空列 colspan 已含狀態欄');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
