#!/usr/bin/env node
/**
 * Verification for ProcessMethodUtils.resolveCaseRecordPoints.
 * Loads the browser IIFE module in Node with minimal stubs.
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

const sandbox = { console, PROCESS_METHOD_CATEGORIES: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  readFileSync(join(ROOT, 'src/features/permissions/process-method-utils.js'), 'utf8'),
  sandbox,
  { filename: 'process-method-utils.js' }
);

const PMU = sandbox.window.ProcessMethodUtils;

const processMethods = [
  { id: 'PS0001', category1: '零件類', category2: '商用分離式', category3: '壓縮機',
    specification: '6馬力', unit: '台', points: 9 },
  { id: 'PS0002', category1: '零件類', category2: '商用分離式', category3: '壓縮機',
    specification: '10馬力', unit: '台', points: 0 }
];

// 快照 5，主檔已被改成 9
const openRecord = { id: 1, processMethodId: 'PS0001', points: 5, qty: 1 };
// 主檔項目已被刪除
const orphanRecord = { id: 2, processMethodId: 'GONE', points: 7, qty: 1 };
// 主檔積分為 0
const zeroRecord = { id: 3, processMethodId: 'PS0002', points: 4, qty: 1 };

console.log('resolveCaseRecordPoints');
assertEq(PMU.resolveCaseRecordPoints(openRecord, processMethods, false), 9,
  '未結案取主檔即時值');
assertEq(PMU.resolveCaseRecordPoints(openRecord, processMethods, true), 5,
  '已結案取案件快照值');
assertEq(PMU.resolveCaseRecordPoints(orphanRecord, processMethods, false), 7,
  '主檔項目已刪除時退回快照值');
assertEq(PMU.resolveCaseRecordPoints(zeroRecord, processMethods, false), 0,
  '主檔積分為 0 時回傳 0 而非退回快照');
assertEq(PMU.resolveCaseRecordPoints({ id: 4, processMethodId: 'GONE' }, processMethods, false), null,
  '快照與主檔皆無積分時回傳 null');
assertEq(PMU.resolveCaseRecordPoints(null, processMethods, false), null,
  'record 為 null 時回傳 null');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
