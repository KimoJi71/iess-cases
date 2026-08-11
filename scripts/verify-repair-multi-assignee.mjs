#!/usr/bin/env node
/**
 * Automated verification for repair multi-assignee bonus points.
 * Loads browser IIFE modules in Node with minimal stubs.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const results = [];
let passed = 0;
let failed = 0;

function pass(name, detail) {
  passed += 1;
  results.push({ status: 'PASS', name, detail: detail || '' });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail) {
  failed += 1;
  results.push({ status: 'FAIL', name, detail: detail || '' });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function assertEq(actual, expected, name) {
  if (actual !== expected) {
    fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    return false;
  }
  pass(name);
  return true;
}

function assertApprox(actual, expected, name, epsilon = 0.001) {
  if (Math.abs(actual - expected) > epsilon) {
    fail(name, `expected ~${expected}, got ${actual}`);
    return false;
  }
  pass(name, `${actual}`);
  return true;
}

function assertTrue(cond, name, detail) {
  if (!cond) {
    fail(name, detail);
    return false;
  }
  pass(name, detail);
  return true;
}

function loadIife(relativePath, sandbox) {
  const code = readFileSync(join(ROOT, relativePath), 'utf8');
  vm.runInContext(code, sandbox, { filename: relativePath });
}

function createSandbox() {
  const sandbox = {
    console,
    window: {},
    SERVICE_LEVEL_OPTIONS: [],
    ASSIGNEES: [],
    ACCOUNT_ASSIGNEE_OPTIONS: [],
    SCHEDULE_ASSIGNEE_OPTIONS: [],
    StoreUtils: {
      matchesStoreRecord: () => false,
      getStoreArea: () => '',
      getRecordArea: () => '',
      assigneeCoversArea: () => true,
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

function loadModules() {
  const sandbox = createSandbox();
  loadIife('src/features/repair/case-assignee-utils.js', sandbox);
  loadIife('src/features/permissions/assignee-utils.js', sandbox);
  loadIife('src/features/permissions/service-level-utils.js', sandbox);
  loadIife('src/features/reports/performance-utils.js', sandbox);
  loadIife('src/features/reports/data-retrieval-utils.js', sandbox);
  return {
    CAU: sandbox.CaseAssigneeUtils,
    AU: sandbox.AssigneeUtils,
    PU: sandbox.PerformanceUtils,
    DRU: sandbox.DataRetrievalUtils,
  };
}

function makeRepairCase(overrides) {
  return Object.assign(
    {
      assignees: ['A組', 'B組'],
      processRecords: [{ points: 30, qty: 1 }],
      isPerformanceIncluded: true,
      serviceLevel: 'D 一般',
      completionDate: '2026-08-01',
      repairDate: '2026-08-01',
      workCategory: '一般叫修',
      customerName: '測試客戶',
      storeName: '測試門市',
    },
    overrides || {}
  );
}

function testBonusFormula(CAU) {
  console.log('\n1. Bonus formula (dual assign, even split)');
  const c = makeRepairCase();
  // total 30, n=2, share 15
  assertApprox(CAU.computeBonusPointsForAssignee(c, 'A組'), 15, 'A組 bonus (share 15)');
  assertApprox(CAU.computeBonusPointsForAssignee(c, 'B組'), 15, 'B組 bonus (share 15)');
  assertApprox(CAU.computeBonusPointsForAssignee(c, 'C組'), 0, 'C組 bonus (not assigned → 0)');
  assertApprox(CAU.sumProcessPoints(c), 30, 'process total = 30');
}

function testLegacyCollaboratorsIgnored(CAU) {
  console.log('\n2. Legacy collaborators field is dropped and ignored');
  const legacy = makeRepairCase({
    collaborators: [
      { name: 'C組', count: 2, points: 10 },
      { name: 'A組', count: 1, points: 4 },
    ],
  });
  assertApprox(CAU.computeBonusPointsForAssignee(legacy, 'A組'), 15, 'legacy collab points do not affect A組');
  assertApprox(CAU.computeBonusPointsForAssignee(legacy, 'C組'), 0, 'legacy collaborator gets no points');
  const normalized = CAU.normalizeRepairCase(legacy);
  assertTrue(normalized.collaborators === undefined, 'normalizeRepairCase strips collaborators field');
}

function testLegacyNormalize(CAU) {
  console.log('\n3. Legacy assignee string normalizes to assignees[]');
  const legacy = { assignee: 'A組' };
  assertEq(JSON.stringify(CAU.getAssignees(legacy)), JSON.stringify(['A組']), 'getAssignees reads legacy assignee');
  const normalized = CAU.normalizeRepairCase(legacy);
  assertEq(JSON.stringify(normalized.assignees), JSON.stringify(['A組']), 'normalizeRepairCase → assignees[]');
  assertTrue(normalized.assignee === undefined, 'normalizeRepairCase removes assignee field');
}

function testRenameReferences(AU) {
  console.log('\n4. AssigneeUtils.updateAssigneeReferences renames arrays');
  const cases = [
    {
      id: 'r1',
      assignees: ['A組', 'B組'],
      performanceAssignees: ['A組', 'B組'],
      performanceAssignee: 'A組',
    },
  ];
  const { cases: nextCases } = AU.updateAssigneeReferences('A組', 'A組新', cases, [], []);
  const u = nextCases[0];
  assertEq(JSON.stringify(u.assignees), JSON.stringify(['A組新', 'B組']), 'assignees[] renamed');
  assertEq(JSON.stringify(u.performanceAssignees), JSON.stringify(['A組新', 'B組']), 'performanceAssignees[] renamed');
  assertEq(u.performanceAssignee, 'A組新', 'performanceAssignee string renamed');
}

function testIncludesAssignee(CAU, DRU) {
  console.log('\n5. includesAssignee / filterRepairCases contains check');
  const multi = { assignees: ['A組', 'B組'] };
  assertTrue(CAU.includesAssignee(multi, 'A組'), 'includesAssignee: A in multi-assign');
  assertTrue(CAU.includesAssignee(multi, 'B組'), 'includesAssignee: B in multi-assign');
  assertTrue(!CAU.includesAssignee(multi, 'C組'), 'includesAssignee: C not in multi-assign');
  assertTrue(CAU.includesAssignee({ assignee: 'A組' }, 'A組'), 'includesAssignee: legacy assignee');

  const cases = [
    { assignees: ['A組', 'B組'], repairDate: '2026-08-01', workCategory: '一般叫修' },
    { assignees: ['B組'], repairDate: '2026-08-01', workCategory: '一般叫修' },
    { assignees: ['C組'], repairDate: '2026-08-01', workCategory: '一般叫修' },
  ];
  const filtered = DRU.filterRepairCases(cases, {
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    workCategory: [],
    repairItem: [],
    repairReason: [],
    customer: [],
    store: [],
    assignee: ['A組'],
    serviceLevel: [],
  });
  assertEq(filtered.length, 1, 'filterRepairCases: only case containing A組');
  assertTrue(filtered[0].assignees.indexOf('A組') !== -1, 'filtered case includes A組');
}

function testPerformanceReport(PU) {
  console.log('\n6. PerformanceUtils.computeAssigneePerformance aggregates bonus');
  const quarter = PU.getQuarterRange(new Date('2026-08-01'));
  const assignees = [
    { id: 'a', name: 'A組' },
    { id: 'b', name: 'B組' },
    { id: 'c', name: 'C組' },
  ];
  // makeRepairCase() 的 serviceLevel 為 fixture 用途的 'D 一般'，非 seed 的四筆正式名稱；
  // 沿用舊版 isServiceLevelCD 的 D 前綴一律計分行為，故此處視為勾選計算增額積分。
  const serviceLevels = [
    { id: 'SLX', name: 'D 一般', maintenanceCount: 0, countsBonusPoints: true },
  ];
  const rows = PU.computeAssigneePerformance({
    cases: [makeRepairCase()],
    maintenanceCases: [],
    assignees,
    allocations: [],
    serviceLevels,
    quarter,
  });
  const byName = Object.fromEntries(rows.map((r) => [r.name, r.bonusPoints]));
  assertApprox(byName['A組'], 15, 'report A組 bonusPoints');
  assertApprox(byName['B組'], 15, 'report B組 bonusPoints');
  assertApprox(byName['C組'], 0, 'report C組 bonusPoints (not assigned)');
}

function main() {
  console.log('Repair multi-assignee verification');
  console.log(`Root: ${ROOT}`);

  let modules;
  try {
    modules = loadModules();
    pass('Module load', 'CaseAssigneeUtils, AssigneeUtils, PerformanceUtils, DataRetrievalUtils');
  } catch (err) {
    fail('Module load', err.message);
    process.exit(1);
  }

  const { CAU, AU, PU, DRU } = modules;
  testBonusFormula(CAU);
  testLegacyCollaboratorsIgnored(CAU);
  testLegacyNormalize(CAU);
  testRenameReferences(AU);
  testIncludesAssignee(CAU, DRU);
  testPerformanceReport(PU);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
