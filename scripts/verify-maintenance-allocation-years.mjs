#!/usr/bin/env node
/**
 * 「保養分配年度快照」驗證腳本。
 * Section 1-3 以 node:vm 載入 IIFE 模組做純函式驗證；
 * Section 4 以後為 headless Chrome + CDP 的 UI 驗證。
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0, failed = 0;
const pass = (n, d) => { passed++; console.log(`  ✓ ${n}${d ? ` — ${d}` : ''}`); };
const fail = (n, d) => { failed++; console.error(`  ✗ ${n}${d ? ` — ${d}` : ''}`); };
function assertEq(actual, expected, name) {
  if (actual === expected) pass(name, JSON.stringify(actual));
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertDeep(actual, expected, name) {
  assertEq(JSON.stringify(actual), JSON.stringify(expected), name);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

const sandbox = { console, SERVICE_LEVEL_OPTIONS: [] };
sandbox.window = sandbox;
vm.createContext(sandbox);
function load(relPath) {
  vm.runInContext(readFileSync(join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath.split('/').pop()
  });
}
load('src/features/permissions/service-level-utils.js');
load('src/features/permissions/assignee-utils.js');
load('src/features/customer/customer-utils.js');
load('src/features/customer/store-utils.js');
load('src/features/permissions/maintenance-allocation-utils.js');
const MAU = sandbox.MaintenanceAllocationUtils;

// 同一 assignee + customer + month，只差年份的兩筆格子
const ALLOCS = [
  { id: 'MA1', year: 2025, assigneeId: 'ASG1', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 5 },
  { id: 'MA2', year: 2026, assigneeId: 'ASG1', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 2 },
  { id: 'MA3', year: 2026, assigneeId: 'ASG1', customerName: '甲客戶', month: 5, visitIndex: 1, targetCount: 4 },
  { id: 'MA4', year: 2026, assigneeId: 'ASG2', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 9 }
];

console.log('Section 1｜分配格子的年份隔離');
assertEq(MAU.findAllocation(ALLOCS, 2025, 'ASG1', '甲客戶', 3).targetCount, 5,
  'findAllocation 取 2025 年那筆');
assertEq(MAU.findAllocation(ALLOCS, 2026, 'ASG1', '甲客戶', 3).targetCount, 2,
  'findAllocation 取 2026 年那筆');
assertEq(MAU.findAllocation(ALLOCS, 2027, 'ASG1', '甲客戶', 3), null,
  '查無年度回 null');
assertEq(MAU.findAllocation(ALLOCS, '2026', 'ASG1', '甲客戶', 3).targetCount, 2,
  '年份以數字比對，字串同樣查得到');

assertEq(MAU.sumVisitIndexTotal(ALLOCS, 2026, 'ASG1', '甲客戶', 1, null), 6,
  'sumVisitIndexTotal 只加總 2026 年（2 + 4）');
assertEq(MAU.sumVisitIndexTotal(ALLOCS, 2026, 'ASG1', '甲客戶', 1, 5), 2,
  'excludeMonth 排除 5 月後只剩 2');
assertEq(MAU.sumVisitIndexTotal(ALLOCS, 2025, 'ASG1', '甲客戶', 1, null), 5,
  '2025 年獨立加總');

assertEq(MAU.removeAllocation(ALLOCS, 2026, 'ASG1', '甲客戶', 3).length, 3,
  'removeAllocation 只移除指定年度那筆');
assertTrue(MAU.removeAllocation(ALLOCS, 2026, 'ASG1', '甲客戶', 3)
  .some(function (a) { return a.id === 'MA1'; }),
  'removeAllocation 不影響同鍵的 2025 年那筆');

assertEq(MAU.upsertAllocation(ALLOCS, {
  year: 2027, assigneeId: 'ASG1', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 7
}).length, 5, 'upsert 新年度為新增一筆');
assertEq(MAU.upsertAllocation(ALLOCS, {
  year: 2026, assigneeId: 'ASG1', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 7
}).length, 4, 'upsert 既有年度為就地更新');
assertEq(MAU.upsertAllocation(ALLOCS, {
  year: 2026, assigneeId: 'ASG1', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 7
}).find(function (a) { return a.id === 'MA2'; }).targetCount, 7,
  'upsert 更新到正確的那一筆');
assertEq(MAU.upsertAllocation(ALLOCS, {
  year: 2027, assigneeId: 'ASG1', customerName: '甲客戶', month: 3, visitIndex: 1, targetCount: 7
}).find(function (a) { return Number(a.year) === 2027; }).year, 2027,
  'upsert 新增的那筆帶有 year');

assertDeep(MAU.buildSaveWarnings({
  allocations: ALLOCS, year: 2026, assigneeId: 'ASG1', customerName: '甲客戶',
  month: 3, visitIndex: 1, targetCount: 4, storeCount: 8
}), [], '2026 年第 1 次合計 4 + 4 = 8，等於門市數，無警示');
assertEq(MAU.buildSaveWarnings({
  allocations: ALLOCS, year: 2025, assigneeId: 'ASG1', customerName: '甲客戶',
  month: 3, visitIndex: 1, targetCount: 4, storeCount: 8
}).length, 1, '2025 年不會把 2026 年的格子算進合計，故出現不足警示');

const SERVICE_LEVELS = [
  { id: 'SL001', name: 'A 保修(一年四次)', maintenanceCount: 4, countsBonusPoints: false },
  { id: 'SL002', name: 'B 保修(一年兩次)', maintenanceCount: 2, countsBonusPoints: false },
  { id: 'SL004', name: 'D 維修(無簽約客戶)', maintenanceCount: 0, countsBonusPoints: true }
];
const SNAP_CUSTOMERS = [
  { id: 'C1', name: '甲客戶', serviceLevel: 'A 保修(一年四次)', periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 3 },
    { visitIndex: 2, startMonth: 4, endMonth: 6 },
    { visitIndex: 3, startMonth: 7, endMonth: 9 },
    { visitIndex: 4, startMonth: 10, endMonth: 12 }
  ] },
  { id: 'C2', name: '乙客戶', serviceLevel: 'B 保修(一年兩次)', periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 6 },
    { visitIndex: 2, startMonth: 7, endMonth: 12 }
  ] },
  { id: 'C3', name: '丙客戶', serviceLevel: 'D 維修(無簽約客戶)', periods: [] }
];
const SNAP_STORES = [
  { id: 'S1', customerName: '甲客戶', storeName: '甲一店', companyCity: '台北市', companyDistrict: '信義區', serviceLevel: 'A 保修(一年四次)' },
  { id: 'S2', customerName: '甲客戶', storeName: '甲二店', companyCity: '台北市', companyDistrict: '信義區', serviceLevel: 'A 保修(一年四次)' },
  { id: 'S3', customerName: '乙客戶', storeName: '乙一店', companyCity: '台北市', companyDistrict: '信義區', serviceLevel: 'B 保修(一年兩次)' },
  { id: 'S4', customerName: '乙客戶', storeName: '乙二店', companyCity: '台中市', companyDistrict: '西屯區', serviceLevel: 'B 保修(一年兩次)' },
  { id: 'S5', customerName: '丙客戶', storeName: '丙一店', companyCity: '台北市', companyDistrict: '信義區', serviceLevel: 'D 維修(無簽約客戶)' }
];
const SNAP_ASSIGNEES = [
  { id: 'ASG1', name: 'A組', districts: ['台北市信義區'] },
  { id: 'ASG2', name: 'B組', districts: ['台中市西屯區'] }
];

console.log('\nSection 2｜年度快照的建立與讀取');
const snap = MAU.buildYearSnapshot(
  2026, SNAP_ASSIGNEES, SNAP_CUSTOMERS, SNAP_STORES, SERVICE_LEVELS, '2026-01-05'
);
assertEq(snap.year, 2026, '快照的 year 為數字');
assertEq(snap.createdAt, '2026-01-05', 'createdAt 由呼叫端傳入');
assertEq(snap.syncedAt, '', '新建快照的 syncedAt 為空字串');
assertEq(snap.rows.length, 3, 'A組 2 列（甲、乙）+ B組 1 列（乙）＝ 3 列');
assertTrue(snap.rows.every(function (r) { return r.customerName !== '丙客戶'; }),
  'D 級客戶不入列');
assertEq(MAU.getSnapshotRows(snap, 'ASG1').length, 2, 'A組有 2 列');
// 註：zh-Hant 的 Intl collation 預設為筆畫序，'乙'（1 畫）排在 '甲'（5 畫）之前；
// 已於 Node 與 headless Chrome 兩端驗證行為一致，故以此為準（非 pinyin 序）。
assertDeep(MAU.getSnapshotRows(snap, 'ASG1').map(function (r) { return r.customerName; }),
  ['乙客戶', '甲客戶'], 'getSnapshotRows 依客戶名稱以 zh-Hant（筆畫序）排序');
assertEq(MAU.getSnapshotRows(snap, 'ASG1')[0].storeCount, 1, '乙客戶在 A組 轄區只有 1 間門市');
assertEq(MAU.getSnapshotRows(snap, 'ASG1')[1].storeCount, 2, '甲客戶在 A組 轄區有 2 間門市');
assertEq(MAU.getSnapshotRows(snap, 'ASG2')[0].storeCount, 1, '乙客戶在 B組 轄區有 1 間門市');
assertEq(MAU.getSnapshotRows(snap, 'ASG1')[1].serviceLevel, 'A 保修(一年四次)',
  '列上記錄當時的服務等級');
assertEq(MAU.getSnapshotRows(snap, 'ASG1')[1].periods.length, 4, '甲客戶快照有四個區間');
assertDeep(MAU.getSnapshotRows(snap, 'ASG9'), [], '查無指派人員回空陣列');
assertDeep(MAU.getSnapshotRows(null, 'ASG1'), [], 'snapshot 為 null 回空陣列');

// periods 必須是深拷貝（snap.rows[0] 為乙客戶，對應 SNAP_CUSTOMERS[1]）
snap.rows[0].periods[0].startMonth = 99;
assertEq(SNAP_CUSTOMERS[1].periods[0].startMonth, 1, '改快照的區間不會動到客戶記錄（深拷貝）');
snap.rows[0].periods[0].startMonth = 1;

const YEARS = [snap, MAU.buildYearSnapshot(2025, SNAP_ASSIGNEES, SNAP_CUSTOMERS, SNAP_STORES, SERVICE_LEVELS, '2025-01-03')];
assertDeep(MAU.listYears(YEARS), [2026, 2025], 'listYears 由大到小');
assertDeep(MAU.listYears([]), [], '無年度回空陣列');
assertDeep(MAU.listYears(null), [], 'null 回空陣列');
assertEq(MAU.findYearSnapshot(YEARS, 2025).year, 2025, 'findYearSnapshot 取得指定年度');
assertEq(MAU.findYearSnapshot(YEARS, '2026').year, 2026, '年份以數字比對');
assertEq(MAU.findYearSnapshot(YEARS, 2030), null, '查無年度回 null');

const rowA = MAU.getSnapshotRows(snap, 'ASG1')[1]; // 甲客戶：四個區間
const segMap = MAU.buildSegmentMap(rowA);
assertEq(segMap[1].period.visitIndex, 1, '1 月屬第 1 次');
assertEq(segMap[1].order, 0, '第 1 次的 order 為 0');
assertEq(segMap[12].period.visitIndex, 4, '12 月屬第 4 次');
assertEq(segMap[12].order, 3, '第 4 次的 order 為 3');
assertDeep(MAU.buildSegmentMap({ periods: [] }), {}, '無區間回空物件');
assertDeep(MAU.buildSegmentMap(null), {}, 'row 為 null 回空物件');

assertEq(MAU.findPeriodInRow(rowA, 5).visitIndex, 2, '5 月落在第 2 次');
assertEq(MAU.findPeriodInRow(rowA, 4).visitIndex, 2, '起始月為含界');
assertEq(MAU.findPeriodInRow(rowA, 6).visitIndex, 2, '結束月為含界');
const rowB = MAU.getSnapshotRows(snap, 'ASG1')[0]; // 乙客戶：兩個區間
assertEq(MAU.findPeriodInRow(rowB, 6).visitIndex, 1, '乙客戶 6 月落在第 1 次');
assertEq(MAU.findPeriodInRow({ periods: [{ visitIndex: 1, startMonth: 2, endMonth: 5 }] }, 1), null,
  '區間外回 null');
assertEq(MAU.findPeriodInRow(null, 1), null, 'row 為 null 回 null');

console.log('\nSection 3｜快照比對、同步與孤兒判定');

// 情境：甲客戶由 A(4次) 降為 B(2次)，且乙客戶在 A組 轄區多開一間門市
const CHANGED_CUSTOMERS = [
  { id: 'C1', name: '甲客戶', serviceLevel: 'B 保修(一年兩次)', periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 6 },
    { visitIndex: 2, startMonth: 7, endMonth: 12 }
  ] },
  SNAP_CUSTOMERS[1],
  SNAP_CUSTOMERS[2]
];
const CHANGED_STORES = SNAP_STORES.concat([
  { id: 'S6', customerName: '乙客戶', storeName: '乙三店', companyCity: '台北市', companyDistrict: '信義區', serviceLevel: 'B 保修(一年兩次)' }
]);

const noDiff = MAU.diffSnapshot(snap, SNAP_ASSIGNEES, SNAP_CUSTOMERS, SNAP_STORES, SERVICE_LEVELS);
assertDeep([noDiff.added.length, noDiff.removed.length, noDiff.changed.length], [0, 0, 0],
  '主檔未變動時無差異');
assertEq(MAU.hasSnapshotDiff(noDiff), false, 'hasSnapshotDiff 為 false');
assertEq(MAU.formatDiffSummary(noDiff), '', '無差異時摘要為空字串');

const diff = MAU.diffSnapshot(snap, SNAP_ASSIGNEES, CHANGED_CUSTOMERS, CHANGED_STORES, SERVICE_LEVELS);
assertEq(diff.added.length, 0, '無新增列');
assertEq(diff.removed.length, 0, '無移除列');
assertEq(diff.changed.length, 2, '甲客戶（等級與區間變）與乙客戶在 A組（門市數變）共 2 列變動');
assertEq(MAU.hasSnapshotDiff(diff), true, 'hasSnapshotDiff 為 true');
assertEq(MAU.formatDiffSummary(diff), '2 列設定變動', '摘要只列出有數量的項目');

const changedA = diff.changed.find(function (c) {
  return c.assigneeId === 'ASG1' && c.customerName === '甲客戶';
});
assertEq(changedA.from.serviceLevel, 'A 保修(一年四次)', 'from 為快照裡的舊等級');
assertEq(changedA.to.serviceLevel, 'B 保修(一年兩次)', 'to 為現行主檔的新等級');
assertEq(changedA.from.periods.length, 4, 'from 有四個區間');
assertEq(changedA.to.periods.length, 2, 'to 有兩個區間');
const changedB = diff.changed.find(function (c) {
  return c.assigneeId === 'ASG1' && c.customerName === '乙客戶';
});
assertEq(changedB.from.storeCount, 1, '乙客戶原本 1 間');
assertEq(changedB.to.storeCount, 2, '乙客戶現在 2 間');

// 新增與移除列
const FEWER_ASSIGNEES = [SNAP_ASSIGNEES[0]];
const removeDiff = MAU.diffSnapshot(snap, FEWER_ASSIGNEES, SNAP_CUSTOMERS, SNAP_STORES, SERVICE_LEVELS);
assertEq(removeDiff.removed.length, 1, '移除 B組 後少 1 列');
assertEq(MAU.formatDiffSummary(removeDiff), '移除 1 列', '摘要為「移除 1 列」');
const smallSnap = MAU.buildYearSnapshot(
  2026, FEWER_ASSIGNEES, SNAP_CUSTOMERS, SNAP_STORES, SERVICE_LEVELS, '2026-01-05'
);
const addDiff = MAU.diffSnapshot(smallSnap, SNAP_ASSIGNEES, SNAP_CUSTOMERS, SNAP_STORES, SERVICE_LEVELS);
assertEq(addDiff.added.length, 1, '補回 B組 後多 1 列');
assertEq(MAU.formatDiffSummary(addDiff), '新增 1 列', '摘要為「新增 1 列」');

// resyncYear
const resynced = MAU.resyncYear(
  snap, SNAP_ASSIGNEES, CHANGED_CUSTOMERS, CHANGED_STORES, SERVICE_LEVELS, '2026-06-01'
);
assertEq(resynced.year, 2026, '同步後 year 不變');
assertEq(resynced.createdAt, '2026-01-05', '同步後 createdAt 保留原值');
assertEq(resynced.syncedAt, '2026-06-01', 'syncedAt 更新為傳入日期');
assertEq(MAU.getSnapshotRows(resynced, 'ASG1')[1].periods.length, 2,
  '同步後甲客戶只剩兩個區間');
assertEq(snap.rows.length, 3, '原快照物件未被就地修改');
assertEq(MAU.getSnapshotRows(snap, 'ASG1')[1].periods.length, 4,
  '原快照的甲客戶仍是四個區間');
assertEq(MAU.resyncYear(null, SNAP_ASSIGNEES, SNAP_CUSTOMERS, SNAP_STORES, SERVICE_LEVELS, '2026-06-01'),
  null, 'snapshot 為 null 回 null');

// 孤兒判定
const YEAR_ALLOCS = [
  { id: 'A1', year: 2026, assigneeId: 'ASG1', customerName: '甲客戶', month: 2, visitIndex: 1, targetCount: 1 },
  { id: 'A2', year: 2026, assigneeId: 'ASG1', customerName: '甲客戶', month: 8, visitIndex: 3, targetCount: 1 },
  { id: 'A3', year: 2026, assigneeId: 'ASG1', customerName: '丁客戶', month: 2, visitIndex: 1, targetCount: 1 },
  { id: 'A4', year: 2025, assigneeId: 'ASG1', customerName: '甲客戶', month: 8, visitIndex: 3, targetCount: 1 }
];
assertEq(MAU.isOrphanAllocation(YEAR_ALLOCS[0], snap), false,
  '原快照下 2 月在第 1 次區間內，非孤兒');
assertEq(MAU.isOrphanAllocation(YEAR_ALLOCS[1], snap), false,
  '原快照下 8 月在第 3 次區間內，非孤兒');
assertEq(MAU.isOrphanAllocation(YEAR_ALLOCS[1], resynced), false,
  '同步後 8 月仍落在第 2 次（7-12月）區間內，非孤兒');
assertEq(MAU.isOrphanAllocation(YEAR_ALLOCS[2], snap), true,
  '列已不在快照中（丁客戶）為孤兒');
assertEq(MAU.isOrphanAllocation(YEAR_ALLOCS[3], snap), false,
  '不同年度的格子不被本年度快照判為孤兒');
assertEq(MAU.countOrphans(YEAR_ALLOCS, snap), 1, '本年度共 1 格孤兒');
assertEq(MAU.countOrphans(YEAR_ALLOCS, null), 0, 'snapshot 為 null 回 0');

// 區間縮減後真的產生孤兒：乙客戶由 B(2次) 改為 C(1次，僅 1-6 月)
const SHRUNK_CUSTOMERS = [
  SNAP_CUSTOMERS[0],
  { id: 'C2', name: '乙客戶', serviceLevel: 'B 保修(一年兩次)', periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 3 },
    { visitIndex: 2, startMonth: 4, endMonth: 6 }
  ] },
  SNAP_CUSTOMERS[2]
];
const shrunk = MAU.resyncYear(
  snap, SNAP_ASSIGNEES, SHRUNK_CUSTOMERS, SNAP_STORES, SERVICE_LEVELS, '2026-06-01'
);
const LATE_ALLOC = { id: 'A5', year: 2026, assigneeId: 'ASG1', customerName: '乙客戶', month: 11, visitIndex: 2, targetCount: 1 };
assertEq(MAU.isOrphanAllocation(LATE_ALLOC, snap), false, '同步前 11 月在乙客戶第 2 次區間內');
assertEq(MAU.isOrphanAllocation(LATE_ALLOC, shrunk), true, '同步後 11 月落在所有區間外，成為孤兒');


// ---------- headless Chrome 區段 ----------
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9347);
if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-allocation-years-profile',
  'about:blank'
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const consoleErrors = [];
function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
  }
  return r.result.value;
}

try {
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); break; }
    catch { await sleep(200); }
  }
  const page = targets.find(t => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(res => { ws.onopen = res; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(m.params.exceptionDetails.exception?.description
        || m.params.exceptionDetails.text);
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: `file://${ROOT}/index.html` });
  await sleep(4000);

  console.log('\nSection 4｜seed 年度快照與畫面接線');
  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');
  assertEq(await evaluate('INITIAL_MAINTENANCE_ALLOCATION_YEARS.length'), 1,
    'seed 有一筆年度快照');
  assertEq(await evaluate('Number(INITIAL_MAINTENANCE_ALLOCATION_YEARS[0].year)'),
    new Date().getFullYear(), 'seed 快照為當年度');
  assertTrue(await evaluate(`INITIAL_MAINTENANCE_ALLOCATIONS.every(function (a) {
    return Number(a.year) === Number(INITIAL_MAINTENANCE_ALLOCATION_YEARS[0].year);
  })`), 'seed 的分配格子全部屬於該年度');
  assertTrue(await evaluate(`INITIAL_MAINTENANCE_ALLOCATION_YEARS[0].rows.every(function (r) {
    return typeof r.assigneeId === 'string' && r.assigneeId
      && typeof r.customerName === 'string'
      && typeof r.storeCount === 'number'
      && Array.isArray(r.periods);
  })`), '快照每列的欄位齊備');
  assertEq(await evaluate(
    'MaintenanceAllocationUtils.countOrphans(INITIAL_MAINTENANCE_ALLOCATIONS, INITIAL_MAINTENANCE_ALLOCATION_YEARS[0])'
  ), 0, 'seed 資料下無孤兒格子');
  assertTrue(await evaluate(
    `/getSnapshotRows/.test(String(MaintenanceAllocation))`
  ), '元件的列來源改用 getSnapshotRows');
  assertTrue(await evaluate(
    `!/CustomerUtils\\.getPeriods/.test(String(MaintenanceAllocation))`
  ), '元件不再直接讀客戶的 periods');
  assertTrue(await evaluate(
    `!/CustomerUtils\\.findPeriodForMonth/.test(String(MaintenanceAllocation))`
  ), '元件不再用 CustomerUtils.findPeriodForMonth 查區間');
  assertTrue(await evaluate(
    `/findPeriodInRow/.test(String(MaintenanceAllocation))`
  ), '元件改用 findPeriodInRow 查區間');

  // ---- 操作輔助 ----
  // 注意：src/core/searchable-select.js 全域攔截了 h('select', ...)，頁面上沒有原生 <select>，
  // 而是 <input role="combobox"> + 掛在 document.body 的 portal 選單。選項是以 mousedown
  // 觸發 chooseOption()，也就是元件 props.onChange 真正被呼叫的路徑，等同於對原生
  // <select> 派發 change 事件。另外，整棵畫面被 mount() 換掉時，舊實體的 portal 選單
  // 不會被移除（既有行為），故每次開選單前先清掉殘留選單，避免點到失效的舊選單。
  await evaluate(`
    window.__ma = {
      clearMenus: function () {
        var ms = document.querySelectorAll('.searchable-select__menu--portal');
        Array.prototype.forEach.call(ms, function (m) { m.parentNode.removeChild(m); });
      },
      // 收起選單：input 的 mousedown 只會開不會關，唯一同步關閉的入口是
      // 收合鈕的 click（handleToggleClick → closeMenu）。
      closeMenus: function () {
        var roots = document.querySelectorAll('.searchable-select');
        Array.prototype.forEach.call(roots, function (root) {
          var input = root.querySelector('.searchable-select__input');
          var toggle = root.querySelector('.searchable-select__toggle');
          if (input && toggle && input.getAttribute('aria-expanded') === 'true') toggle.click();
        });
        window.__ma.clearMenus();
        return true;
      },
      openMenu: function (input) {
        window.__ma.closeMenus();
        input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        input.focus();
        return document.querySelectorAll('.searchable-select__menu--portal .searchable-select__option');
      },
      // 讀完選項後選單仍是開的，呼叫端須自行 closeMenus()
      options: function (input) {
        return Array.prototype.map.call(window.__ma.openMenu(input),
          function (o) { return o.textContent.trim(); });
      },
      // 點選項走的是 chooseOption()，元件會自行 closeMenu()，狀態乾淨
      choose: function (input, label) {
        var opts = window.__ma.openMenu(input);
        for (var i = 0; i < opts.length; i++) {
          if (opts[i].textContent.trim() === label) {
            opts[i].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            return true;
          }
        }
        window.__ma.closeMenus();
        return false;
      },
      combo: function (root, index) {
        return (root || document).querySelectorAll('.searchable-select__input')[index];
      },
      clickText: function (selector, text) {
        var els = document.querySelectorAll(selector);
        for (var i = els.length - 1; i >= 0; i--) {
          if (els[i].textContent.trim() === text) { els[i].click(); return true; }
        }
        return false;
      },
      // 有填值的月份格數（區段標頭不算，只算可點擊的格子本身）
      filledCells: function (root) {
        return Array.prototype.filter.call(
          (root || document).querySelectorAll('tbody td div.cursor-pointer'),
          function (d) { return d.innerText.trim() !== ''; }
        ).length;
      },
      toast: function () {
        var t = document.querySelector('.fixed.top-20.right-6');
        return t ? { text: t.innerText.trim(), error: t.className.indexOf('bg-red-600') >= 0 } : null;
      }
    };
    'ok'`);

  console.log('\nSection 4｜實際操作畫面：年度切換與建立年度');
  const THIS_YEAR = new Date().getFullYear();
  const NEXT_YEAR = THIS_YEAR + 1;
  // 讀年度下拉的選項清單（讀完把選單收回去，避免影響後續操作）
  async function yearOptions() {
    const out = await evaluate(`__ma.options(__ma.combo(null, 0))`);
    await evaluate('__ma.closeMenus()');
    return out;
  }

  assertTrue(await evaluate(`__ma.clickText('button, a, li, div, span', '系統權限')`),
    '側邊欄可點開「系統權限」');
  await sleep(400);
  assertTrue(await evaluate(`__ma.clickText('button, a, li, div, span', '保養分配')`),
    '側邊欄可點進「保養分配」');
  await sleep(800);

  assertEq(await evaluate(`__ma.combo(null, 0).value`), THIS_YEAR + ' 年',
    '預設選定當年度');
  assertDeep(await yearOptions(), [THIS_YEAR + ' 年'],
    '年度下拉一開始只有當年度一個選項');

  assertTrue(await evaluate(`__ma.choose(__ma.combo(null, 1), 'A組')`), '可選取指派人員 A組');
  await sleep(600);
  const seedFilled = await evaluate(`INITIAL_MAINTENANCE_ALLOCATIONS.filter(function (a) {
    return Number(a.year) === ${THIS_YEAR} && a.assigneeId === 'ASG1';
  }).length`);
  assertTrue(seedFilled > 0, 'seed 在 A組／當年度有分配格子可供比對', String(seedFilled));
  assertTrue(await evaluate(`document.querySelectorAll('tbody tr').length`) > 0, 'A組 網格有列');
  assertEq(await evaluate(`__ma.filledCells(null)`), seedFilled,
    '當年度網格顯示 seed 的分配格子');

  // 建立下一年度：點＋、填年份、按建立
  assertTrue(await evaluate(
    `(function () {
      var b = document.querySelector('button[aria-label="建立年度分配表"], button[title="建立年度分配表"]');
      if (!b) return false;
      b.click();
      return true;
    })()`), '可點開「建立年度分配表」的＋鈕');
  await sleep(400);
  assertEq(await evaluate(`document.querySelector('.app-modal-overlay input[type=number]').value`),
    String(NEXT_YEAR), '建立對話框預設帶入下一個年份');
  assertTrue(await evaluate(`(function () {
    var i = document.querySelector('.app-modal-overlay input[type=number]');
    i.value = '${NEXT_YEAR}';
    i.dispatchEvent(new Event('input', { bubbles: true }));
    i.dispatchEvent(new Event('change', { bubbles: true }));
    return __ma.clickText('.app-modal-overlay button', '建立');
  })()`), '可在對話框輸入年份並按「建立」');
  await sleep(800);

  assertEq(await evaluate(`(__ma.toast() || {}).text`), '已建立 ' + NEXT_YEAR + ' 年度分配表（12 列）',
    '建立成功的 toast 內容正確');
  assertDeep(await yearOptions(),
    [NEXT_YEAR + ' 年', THIS_YEAR + ' 年'], '年度下拉多出新年度且由大到小');
  // 迴歸守門：handleCreateYear 必須在呼叫 setMaintenanceAllocationYears（會同步重繪整個
  // App）之前先寫好 persistedSelectedYear，否則新元件實體會沿用舊年度。
  assertEq(await evaluate(`__ma.combo(null, 0).value`), NEXT_YEAR + ' 年',
    '建立後畫面自動切到新年度');
  assertTrue(await evaluate(`document.querySelectorAll('tbody tr').length`) > 0,
    '新年度仍有客戶列（骨架已建立）');
  assertEq(await evaluate(`__ma.filledCells(null)`), 0, '新年度的格子全部是空的');

  // 迴歸守門：年度下拉的 onChange 必須同時更新外層的 selectedYear，
  // 只寫 persistedSelectedYear 的話 rerender() 不會重跑外層，切年份會完全沒反應。
  assertTrue(await evaluate(`__ma.choose(__ma.combo(null, 0), '${THIS_YEAR} 年')`),
    '可從下拉切回當年度');
  await sleep(600);
  assertEq(await evaluate(`__ma.combo(null, 0).value`), THIS_YEAR + ' 年', '下拉顯示切回當年度');
  assertEq(await evaluate(`__ma.filledCells(null)`), seedFilled, '切回當年度後 seed 的格子回來了');
  assertTrue(await evaluate(`__ma.choose(__ma.combo(null, 0), '${NEXT_YEAR} 年')`),
    '可再切到新年度');
  await sleep(600);
  assertEq(await evaluate(`__ma.filledCells(null)`), 0,
    '切到新年度後屬於當年度的格子消失');

  // 重複建立同一年度
  await evaluate(`document.querySelector('button[aria-label="建立年度分配表"], button[title="建立年度分配表"]').click()`);
  await sleep(400);
  assertTrue(await evaluate(`(function () {
    var i = document.querySelector('.app-modal-overlay input[type=number]');
    i.value = '${NEXT_YEAR}';
    i.dispatchEvent(new Event('input', { bubbles: true }));
    i.dispatchEvent(new Event('change', { bubbles: true }));
    return __ma.clickText('.app-modal-overlay button', '建立');
  })()`), '再次以同一年份按「建立」');
  await sleep(500);
  assertDeep(await evaluate(`__ma.toast()`), { text: '該年度分配表已存在', error: true },
    '重複年份跳出錯誤 toast');
  assertDeep(await yearOptions(),
    [NEXT_YEAR + ' 年', THIS_YEAR + ' 年'], '重複建立不會多出年度');
  assertTrue(await evaluate(`!!document.querySelector('.app-modal-overlay')`),
    '建立失敗時對話框保持開啟');
  assertTrue(await evaluate(`__ma.clickText('.app-modal-overlay button', '取消')`), '可取消對話框');
  await sleep(400);
  assertEq(await evaluate(`document.querySelectorAll('.app-modal-overlay').length`), 0,
    '取消後對話框關閉');

  console.log('\nSection 4｜快照凍結：客戶改等級不影響已建立年度');
  // 關鍵手法：快照用「原始」主檔建立，卻把「已改過」的主檔當 props 傳進元件。
  // 只要網格是從快照長出來的，畫面就必須顯示舊等級與四個區間；
  // 一旦有人把列來源改回即時計算（getCustomerRows／CustomerUtils.getPeriods），
  // 畫面會變成 B 保修的兩個區間，下面三條斷言就會紅。
  const freeze = await evaluate(`(function () {
    var year = Number(INITIAL_MAINTENANCE_ALLOCATION_YEARS[0].year);
    var snapshot = MaintenanceAllocationUtils.buildYearSnapshot(
      year, INITIAL_ASSIGNEES, INITIAL_CUSTOMERS, INITIAL_STORES, INITIAL_SERVICE_LEVELS, '2026-01-01'
    );
    var customers = INITIAL_CUSTOMERS.map(function (c) {
      if (c.name !== '屈臣氏') return c;
      return Object.assign({}, c, {
        serviceLevel: 'B 保修(一年兩次)',
        periods: [
          { visitIndex: 1, startMonth: 1, endMonth: 6 },
          { visitIndex: 2, startMonth: 7, endMonth: 12 }
        ]
      });
    });
    var container = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(MaintenanceAllocation({
      assignees: INITIAL_ASSIGNEES, customers: customers, stores: INITIAL_STORES,
      maintenanceCases: [], serviceLevels: INITIAL_SERVICE_LEVELS,
      maintenanceAllocations: [], setMaintenanceAllocations: function () {},
      maintenanceAllocationYears: [snapshot], setMaintenanceAllocationYears: function () {},
      showToast: function () {}
    }));
    __ma.choose(__ma.combo(container, 1), 'A組');
    var row = Array.prototype.filter.call(container.querySelectorAll('tbody tr'), function (r) {
      return r.querySelector('td').textContent.indexOf('屈臣氏') === 0;
    })[0];
    var nextSnap = MaintenanceAllocationUtils.buildYearSnapshot(
      year + 1, INITIAL_ASSIGNEES, customers, INITIAL_STORES, INITIAL_SERVICE_LEVELS, '2027-01-02'
    );
    var nextRow = MaintenanceAllocationUtils.getSnapshotRows(nextSnap, 'ASG1')
      .find(function (r) { return r.customerName === '屈臣氏'; });
    var result = {
      level: row ? row.querySelectorAll('td')[0].innerText.replace(/^屈臣氏\\s*/, '').trim() : '(找不到屈臣氏列)',
      visits: row ? (row.innerText.match(/第\\d次/g) || []).length : -1,
      nextVisits: nextRow ? nextRow.periods.length : -1
    };
    container.parentNode.removeChild(container);
    __ma.closeMenus();
    return result;
  })()`);
  assertEq(freeze.level, 'A 保修(一年四次)',
    '畫面顯示快照凍結時的服務等級，而非現行主檔的新等級');
  assertEq(freeze.visits, 4,
    '畫面仍照快照畫出四個保養區間，而非新主檔的兩個');
  assertEq(freeze.nextVisits, 2,
    '以新主檔建立的下一年度快照才是兩個區間');

  console.log('\nSection 5｜孤兒格子與重新同步');
  assertTrue(await evaluate(
    `/isOrphanAllocation/.test(String(MaintenanceAllocation))`
  ), '元件會判定孤兒格子');
  assertTrue(await evaluate(
    `/formatDiffSummary/.test(String(MaintenanceAllocation))`
  ), '元件會顯示主檔變動摘要');
  assertTrue(await evaluate(
    `/resyncYear/.test(String(MaintenanceAllocation))`
  ), '元件提供重新同步');

  assertDeep(await evaluate(`(function(){
    var snap = INITIAL_MAINTENANCE_ALLOCATION_YEARS[0];
    // 把屈臣氏的區間縮成只有上半年，模擬服務等級由 A(4次) 降為 B(2次) 但月份也縮短
    var customers = INITIAL_CUSTOMERS.map(function (c) {
      if (c.name !== '屈臣氏') return c;
      return Object.assign({}, c, {
        serviceLevel: 'B 保修(一年兩次)',
        periods: [
          { visitIndex: 1, startMonth: 1, endMonth: 3 },
          { visitIndex: 2, startMonth: 4, endMonth: 6 }
        ]
      });
    });
    var diff = MaintenanceAllocationUtils.diffSnapshot(
      snap, INITIAL_ASSIGNEES, customers, INITIAL_STORES, INITIAL_SERVICE_LEVELS
    );
    var next = MaintenanceAllocationUtils.resyncYear(
      snap, INITIAL_ASSIGNEES, customers, INITIAL_STORES, INITIAL_SERVICE_LEVELS, '2026-06-01'
    );
    var before = MaintenanceAllocationUtils.countOrphans(INITIAL_MAINTENANCE_ALLOCATIONS, snap);
    var after = MaintenanceAllocationUtils.countOrphans(INITIAL_MAINTENANCE_ALLOCATIONS, next);
    return [
      MaintenanceAllocationUtils.hasSnapshotDiff(diff),
      before,
      after > before,
      next.rows.length === snap.rows.length
    ];
  })()`), [true, 0, true, true],
    '縮短區間後有變動、同步前無孤兒、同步後出現孤兒、列數不變');

  assertTrue(await evaluate(`(function(){
    var snap = INITIAL_MAINTENANCE_ALLOCATION_YEARS[0];
    var next = MaintenanceAllocationUtils.resyncYear(
      snap, INITIAL_ASSIGNEES, INITIAL_CUSTOMERS, INITIAL_STORES, INITIAL_SERVICE_LEVELS, '2026-06-01'
    );
    return next.createdAt === snap.createdAt && next.syncedAt === '2026-06-01';
  })()`), '同步保留 createdAt、更新 syncedAt');

  console.log('\nSection 5｜實際操作畫面：提示條 → 同步 → 孤兒格');
  // 手法：以「原始主檔」建立快照，再把「已縮短區間的主檔」當 props 傳進元件，
  // 並用會重新掛載元件的 setMaintenanceAllocationYears 模擬 app store 的同步重繪。
  const rs = await evaluate(`(function () {
    var year = Number(INITIAL_MAINTENANCE_ALLOCATION_YEARS[0].year);
    var snapshot = MaintenanceAllocationUtils.buildYearSnapshot(
      year, INITIAL_ASSIGNEES, INITIAL_CUSTOMERS, INITIAL_STORES, INITIAL_SERVICE_LEVELS, '2026-01-01'
    );
    var customers = INITIAL_CUSTOMERS.map(function (c) {
      if (c.name !== '屈臣氏') return c;
      return Object.assign({}, c, {
        serviceLevel: 'B 保修(一年兩次)',
        periods: [
          { visitIndex: 1, startMonth: 1, endMonth: 3 },
          { visitIndex: 2, startMonth: 4, endMonth: 6 }
        ]
      });
    });
    var years = [snapshot];
    var allocations = INITIAL_MAINTENANCE_ALLOCATIONS.slice();
    var toasts = [];
    var container = document.createElement('div');
    document.body.appendChild(container);
    function mount() {
      // 模擬 store.set()：同步換掉整個元件實體
      container.innerHTML = '';
      container.appendChild(MaintenanceAllocation({
        assignees: INITIAL_ASSIGNEES, customers: customers, stores: INITIAL_STORES,
        maintenanceCases: [], serviceLevels: INITIAL_SERVICE_LEVELS,
        maintenanceAllocations: allocations,
        setMaintenanceAllocations: function (next) { allocations = next; mount(); },
        maintenanceAllocationYears: years,
        setMaintenanceAllocationYears: function (next) { years = next; mount(); },
        showToast: function (msg, type) { toasts.push({ text: msg, error: type === 'error' }); }
      }));
    }
    function banner() {
      var el = container.querySelector('div.border-amber-200.bg-amber-50');
      return el ? el.innerText.trim() : '';
    }
    function overlay() {
      var el = container.querySelector('.app-modal-overlay');
      return el ? el.innerText.replace(/\\s+/g, ' ').trim() : '';
    }
    function cells() {
      return Array.prototype.filter.call(
        container.querySelectorAll('tbody td div.cursor-pointer'),
        function (d) { return d.innerText.trim() !== ''; }
      );
    }
    function orphanCells() {
      return cells().filter(function (d) {
        return d.className.indexOf('border-dashed') >= 0
          && d.className.indexOf('border-red-300') >= 0;
      });
    }
    function clickText(sel, text) {
      var els = container.querySelectorAll(sel);
      for (var i = 0; i < els.length; i++) {
        if (els[i].textContent.trim() === text) { els[i].click(); return true; }
      }
      return false;
    }
    function lastToast() { return toasts.length ? toasts[toasts.length - 1] : null; }

    mount();
    __ma.choose(__ma.combo(container, 1), 'A組');
    __ma.closeMenus();

    var out = {};
    out.bannerBefore = banner();
    out.filledBefore = cells().length;
    out.orphansBefore = orphanCells().length;

    out.clickedResync = clickText('button', '重新同步本年度');
    out.dialog = overlay();
    out.confirmed = clickText('.app-modal-overlay button', '確認同步');

    out.dialogAfter = overlay();
    out.bannerAfter = banner();
    out.syncToast = lastToast();
    out.syncedAt = years[0].syncedAt;
    out.createdAt = years[0].createdAt;
    out.filledAfter = cells().length;
    var orphans = orphanCells();
    out.orphanCount = orphans.length;
    out.orphanTexts = orphans.map(function (d) { return d.innerText.trim(); }).sort();
    out.orphanTitle = orphans.length ? orphans[0].title : '';
    out.normalTexts = cells().filter(function (d) {
      return orphans.indexOf(d) === -1;
    }).map(function (d) { return d.innerText.trim(); });

    if (orphans.length) orphans[0].click();
    out.orphanClickDialog = overlay();
    out.orphanClickToast = lastToast();

    container.parentNode.removeChild(container);
    __ma.closeMenus();
    return out;
  })()`);

  assertEq(rs.bannerBefore.indexOf('主檔已變動：') === 0
    && /列設定變動。本年度骨架維持建立當時的設定，需要時可重新同步。$/.test(rs.bannerBefore),
    true, '主檔變動後畫面出現黃色提示條', rs.bannerBefore);
  assertEq(rs.filledBefore, 3, 'A組 同步前有 3 個已填格子');
  assertEq(rs.orphansBefore, 0, '同步前沒有孤兒格');
  assertTrue(rs.clickedResync, '工具列有「重新同步本年度」按鈕可點');
  assertTrue(/^重新同步本年度 將以現行的客戶、門市與服務等級重拍 \d{4} 年度的骨架：/.test(rs.dialog),
    '確認 Modal 標題與說明正確', rs.dialog);
  assertTrue(/列設定變動 已填的目標完成數一律保留；同步後將有 5 格落在保養區間外，會標記為異常，需自行確認是否刪除。/
    .test(rs.dialog), 'Modal 顯示變動摘要與孤兒預估（5 格）', rs.dialog);
  assertTrue(rs.confirmed, 'Modal 可按「確認同步」');
  assertEq(rs.dialogAfter, '', '同步後 Modal 關閉');
  assertEq(rs.bannerAfter, '', '同步後提示條消失');
  assertTrue(/^已重新同步 \d{4} 年度；.*列設定變動，5 格已不在區間內，請確認$/.test((rs.syncToast || {}).text)
    && rs.syncToast.error === false, '同步成功 toast 內容正確', JSON.stringify(rs.syncToast));
  assertEq(rs.createdAt, '2026-01-01', '同步後仍保留原本的 createdAt');
  assertTrue(/^\d{4}-\d{2}-\d{2}$/.test(rs.syncedAt), '同步後寫入 syncedAt', rs.syncedAt);
  assertEq(rs.filledAfter, 3, '同步後已填的格子一格都沒少');
  assertEq(rs.orphanCount, 2, '屈臣氏 7、8 月成為孤兒格（紅色虛線框）');
  assertDeep(rs.orphanTexts, ['⚠ 第1次 1', '⚠ 第1次 3'], '孤兒格文字帶 ⚠ 前綴');
  assertEq(rs.orphanTitle, '此格已不在現行保養區間內', '孤兒格有提示 title');
  assertDeep(rs.normalTexts, ['第1次 2'], '區間內的格子維持原樣，不帶 ⚠ 與虛線');
  assertTrue(rs.orphanClickDialog.indexOf('確認刪除') === 0
    && rs.orphanClickDialog.indexOf('編輯保養分配') === -1,
    '點孤兒格開的是刪除確認、不是編輯 Modal', rs.orphanClickDialog);
  assertDeep(rs.orphanClickToast, { text: '此格已不在保養區間內，僅能刪除', error: true },
    '點孤兒格跳出僅能刪除的錯誤 toast');

} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}

console.log(`\n通過 ${passed}｜失敗 ${failed}`);
process.exit(failed ? 1 : 0);
