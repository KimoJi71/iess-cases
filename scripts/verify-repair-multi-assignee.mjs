#!/usr/bin/env node
/**
 * Task 8 automated verification for repair multi-assignee / collaborators.
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
      collaborators: [
        { name: 'C組', points: 10 },
        { name: 'A組', points: 4 },
      ],
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
  console.log('\n1. Bonus formula (dual assign + collaborators + dual role A)');
  const c = makeRepairCase();
  // total 30, collab 14, remainder 16, share 8; A: 8+4=12, B: 8, C: 10
  assertApprox(CAU.computeBonusPointsForAssignee(c, 'A組'), 12, 'A組 bonus (share 8 + collab 4)');
  assertApprox(CAU.computeBonusPointsForAssignee(c, 'B組'), 8, 'B組 bonus (share 8)');
  assertApprox(CAU.computeBonusPointsForAssignee(c, 'C組'), 10, 'C組 bonus (collab only)');
  assertApprox(CAU.sumProcessPoints(c), 30, 'process total = 30');
}

function testNegativeRemainder(CAU) {
  console.log('\n2. Collaborator sum exceeds process total (negative assignee share)');
  const c = makeRepairCase({
    collaborators: [
      { name: 'C組', points: 10 },
      { name: 'A組', points: 30 },
    ],
  });
  // total 30, collab 40, remainder -10, share -5 per assignee
  assertApprox(CAU.computeBonusPointsForAssignee(c, 'B組'), -5, 'B組 assignee share negative (-5)');
  assertApprox(CAU.computeBonusPointsForAssignee(c, 'A組'), 25, 'A組 total (-5 share + 30 collab)');
  const remainder = CAU.sumProcessPoints(c) - CAU.getCollaborators(c).reduce((s, r) => s + r.points, 0);
  assertApprox(remainder, -10, 'remainder = total - collabSum = -10');
}

function testLegacyNormalize(CAU) {
  console.log('\n3. Legacy assignee string normalizes to assignees[]');
  const legacy = { assignee: 'A組', collaborators: undefined };
  assertEq(JSON.stringify(CAU.getAssignees(legacy)), JSON.stringify(['A組']), 'getAssignees reads legacy assignee');
  const normalized = CAU.normalizeRepairCase(legacy);
  assertEq(JSON.stringify(normalized.assignees), JSON.stringify(['A組']), 'normalizeRepairCase → assignees[]');
  assertTrue(normalized.assignee === undefined, 'normalizeRepairCase removes assignee field');
  assertEq(JSON.stringify(normalized.collaborators), JSON.stringify([]), 'normalizeRepairCase → empty collaborators');
}

function testRenameReferences(AU) {
  console.log('\n4. AssigneeUtils.updateAssigneeReferences renames arrays');
  const cases = [
    {
      id: 'r1',
      assignees: ['A組', 'B組'],
      collaborators: [
        { name: 'A組', points: 4 },
        { name: 'C組', points: 10 },
      ],
      performanceAssignees: ['A組', 'B組'],
      performanceAssignee: 'A組',
    },
  ];
  const { cases: nextCases } = AU.updateAssigneeReferences('A組', 'A組新', cases, [], []);
  const u = nextCases[0];
  assertEq(JSON.stringify(u.assignees), JSON.stringify(['A組新', 'B組']), 'assignees[] renamed');
  assertEq(u.collaborators[0].name, 'A組新', 'collaborators[].name renamed');
  assertEq(u.collaborators[1].name, 'C組', 'other collaborator unchanged');
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
    workCategory: '全部',
    repairItem: '全部',
    repairReason: '全部',
    customer: '全部',
    store: '全部',
    assignee: 'A組',
    serviceLevel: '全部',
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
  const rows = PU.computeAssigneePerformance({
    cases: [makeRepairCase()],
    maintenanceCases: [],
    assignees,
    allocations: [],
    quarter,
  });
  const byName = Object.fromEntries(rows.map((r) => [r.name, r.bonusPoints]));
  assertApprox(byName['A組'], 12, 'report A組 bonusPoints');
  assertApprox(byName['B組'], 8, 'report B組 bonusPoints');
  assertApprox(byName['C組'], 10, 'report C組 bonusPoints');
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
  testNegativeRemainder(CAU);
  testLegacyNormalize(CAU);
  testRenameReferences(AU);
  testIncludesAssignee(CAU, DRU);
  testPerformanceReport(PU);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
