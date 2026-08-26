#!/usr/bin/env node
/**
 * 保養計劃進度：組別依門市所在行政區由系統預設指派。
 *
 * 組別主檔的「負責行政區」一區只歸一組（見 verify-assignee-district-exclusive），
 * 因此行政區 → 組別是唯一對應。本腳本以 node:vm 載入 IIFE 模組做純函式驗證：
 *   Section 1  AssigneeUtils.getDefaultAssignment 查表
 *   Section 2  ScheduleUtils.generateDueMaintenanceCases 產生／回填時套用預設
 * Section 3 改以 headless Chrome 載入真實 index.html，驗證 app.js 的呼叫端確實接上，
 * 且保養計劃進度列表的「組別」欄真的顯示出預設組別（純函式測不到這段接線）。
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import vm from 'node:vm';

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

const sandbox = {
  console,
  SERVICE_LEVEL_OPTIONS: [],
  ASSIGNEES: [],
  ACCOUNT_ASSIGNEE_OPTIONS: [],
  SCHEDULE_ASSIGNEE_OPTIONS: [],
  ASSIGNEE_MEMBER_GROUPS: [],
  ASSIGNEE_MEMBER_LABELS: {},
  ASSIGNEE_GROUP_HINTS: {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
function load(relPath) {
  vm.runInContext(readFileSync(join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath.split('/').pop()
  });
}
load('src/features/customer/customer-utils.js');
load('src/features/customer/store-utils.js');
load('src/features/permissions/service-level-utils.js');
load('src/features/permissions/assignee-utils.js');
load('src/features/scheduling/schedule-utils.js');
const AU = sandbox.AssigneeUtils;
const SU = sandbox.ScheduleUtils;

// A 組負責台北市信義區、中山區；B 組負責高雄市左營區，其中 U4 帳號已停用。
const ASSIGNEE_MASTER = [
  { id: 'G1', name: 'A組', memberIds: ['U1', 'U2'], leaderId: 'U1',
    districts: ['台北市信義區', '台北市中山區'] },
  { id: 'G2', name: 'B組', memberIds: ['U3', 'U4'], leaderId: 'U3',
    districts: ['高雄市左營區'] },
  // 未設定負責行政區的組別不該被任何行政區對到
  { id: 'G3', name: 'C組', memberIds: ['U5'], leaderId: 'U5', districts: [] }
];
const ACCOUNTS = [
  { id: 'U1', name: '甲員', enabled: true },
  { id: 'U2', name: '乙員', enabled: true },
  { id: 'U3', name: '丙員', enabled: true },
  { id: 'U4', name: '丁員', enabled: false },
  { id: 'U5', name: '戊員', enabled: true }
];

console.log('Section 1｜getDefaultAssignment 依行政區查表');
assertDeep(
  AU.getDefaultAssignment(ASSIGNEE_MASTER, ACCOUNTS, '台北市', '信義區'),
  { assignees: ['A組'], assigneeMemberIds: ['U1', 'U2'] },
  '對到 A 組並帶入該組全部成員'
);
assertDeep(
  AU.getDefaultAssignment(ASSIGNEE_MASTER, ACCOUNTS, '台北市', '中山區'),
  { assignees: ['A組'], assigneeMemberIds: ['U1', 'U2'] },
  '同一組的第二個行政區也對得到'
);
assertDeep(
  AU.getDefaultAssignment(ASSIGNEE_MASTER, ACCOUNTS, '高雄市', '左營區'),
  { assignees: ['B組'], assigneeMemberIds: ['U3'] },
  '停用帳號不列入預設成員'
);
assertEq(AU.getDefaultAssignment(ASSIGNEE_MASTER, ACCOUNTS, '台中市', '西屯區'), null,
  '無組別負責該行政區時回 null');
assertEq(AU.getDefaultAssignment(ASSIGNEE_MASTER, ACCOUNTS, '台北市', ''), null,
  '行政區為空時回 null');
assertEq(AU.getDefaultAssignment(ASSIGNEE_MASTER, ACCOUNTS, '', '信義區'), null,
  '縣市為空時回 null（同名行政區不可只靠區名對應）');
assertEq(AU.getDefaultAssignment([], ACCOUNTS, '台北市', '信義區'), null,
  '沒有任何組別時回 null');

console.log('\nSection 2｜generateDueMaintenanceCases 套用預設組別');

const CUSTOMERS = [
  { id: 'C1', name: '甲客戶', serviceLevel: 'A 保修(一年四次)', enabled: true, periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 3 },
    { visitIndex: 2, startMonth: 4, endMonth: 6 },
    { visitIndex: 3, startMonth: 7, endMonth: 9 },
    { visitIndex: 4, startMonth: 10, endMonth: 12 }
  ] }
];
const STORES = [
  { id: 'S1', customerName: '甲客戶', storeName: '信義店', serviceLevel: 'A 保修(一年四次)',
    companyCity: '台北市', companyDistrict: '信義區', companyRoad: '松智路X號',
    storeStatus: '正常營業', maintenanceFlag: '是', openDate: '2020-01-01' },
  { id: 'S2', customerName: '甲客戶', storeName: '西屯店', serviceLevel: 'A 保修(一年四次)',
    companyCity: '台中市', companyDistrict: '西屯區', companyRoad: '台灣大道X號',
    storeStatus: '正常營業', maintenanceFlag: '是', openDate: '2020-01-01' }
];
const REF_MONTH = '2026-08';

function gen(existing, assignees, accounts) {
  return SU.generateDueMaintenanceCases(
    CUSTOMERS, STORES, existing, REF_MONTH, [], assignees, accounts
  );
}
function findCase(list, storeName) {
  return list.find(function (c) { return c.storeName === storeName; });
}

const generated = gen([], ASSIGNEE_MASTER, ACCOUNTS);
const shinyi = findCase(generated, '信義店');
assertDeep(shinyi.assignees, ['A組'], '新產生的保養單依行政區帶入組別');
assertDeep(shinyi.assigneeMemberIds, ['U1', 'U2'], '新產生的保養單帶入該組全部成員');

const xitun = findCase(generated, '西屯店');
assertDeep(xitun.assignees, [], '行政區無人負責時組別維持空白');
assertDeep(xitun.assigneeMemberIds, [], '行政區無人負責時指派人員維持空白');

console.log('\n不覆蓋既有指派');
const existingAssigned = [{
  id: 'M1', customerName: '甲客戶', storeName: '信義店',
  companyCity: '台北市', companyDistrict: '信義區',
  periodYear: 2026, periodVisitIndex: 3,
  assignees: ['B組'], assigneeMemberIds: ['U3'], isClosed: false
}];
const keptCase = findCase(gen(existingAssigned, ASSIGNEE_MASTER, ACCOUNTS), '信義店');
assertDeep(keptCase.assignees, ['B組'], '已人工指派的組別不被行政區覆蓋');
assertDeep(keptCase.assigneeMemberIds, ['U3'], '已人工指派的成員不被覆蓋');

console.log('\n未指派的既有案件一併回填');
const existingBlank = [{
  id: 'M2', customerName: '甲客戶', storeName: '信義店',
  companyCity: '台北市', companyDistrict: '中山區',
  periodYear: 2026, periodVisitIndex: 3,
  assignees: [], assigneeMemberIds: [], isClosed: false
}];
const filled = gen(existingBlank, ASSIGNEE_MASTER, ACCOUNTS)
  .find(function (c) { return c.id === 'M2'; });
assertDeep(filled.assignees, ['A組'], '既有未指派案件也依行政區回填');
assertDeep(filled.assigneeMemberIds, ['U1', 'U2'], '既有未指派案件也帶入成員');

console.log('\n已結案的案件不回填');
const existingClosed = [{
  id: 'M3', customerName: '甲客戶', storeName: '信義店',
  companyCity: '台北市', companyDistrict: '信義區',
  periodYear: 2026, periodVisitIndex: 3,
  assignees: [], assigneeMemberIds: [], isClosed: true
}];
const closed = gen(existingClosed, ASSIGNEE_MASTER, ACCOUNTS)
  .find(function (c) { return c.id === 'M3'; });
assertDeep(closed.assignees, [], '已結案案件的組別不被回填改寫');
assertDeep(closed.assigneeMemberIds, [], '已結案案件的指派人員不被回填改寫');

console.log('\n未傳組別主檔時行為不變（既有呼叫端回歸保護）');
const legacy = SU.generateDueMaintenanceCases(CUSTOMERS, STORES, [], REF_MONTH, []);
const legacyShinyi = findCase(legacy, '信義店');
assertDeep(legacyShinyi.assignees, [], '不傳 assignees 參數時組別維持空白');
assertEq(legacy.length, generated.length, '不傳 assignees 參數時產生的筆數相同');

console.log('\n參考月份無效時仍套用預設');
// referenceMonth 解析失敗時提前返回、不產生新單，但既有未指派的仍要回填 —— 提前返回
// 那條路徑很容易在改動時被漏掉，故獨立驗一次。（空字串會退回當月，不算無效值。）
const invalidMonth = SU.generateDueMaintenanceCases(
  CUSTOMERS, STORES, existingBlank, 'abcd-ee', [], ASSIGNEE_MASTER, ACCOUNTS
);
assertTrue(!invalidMonth.some(function (c) { return c.id !== 'M2'; }),
  '參考月份無效時不產生新單', String(invalidMonth.length));
assertDeep(invalidMonth[0].assignees, ['A組'], '參考月份無效時既有未指派案件仍回填');

console.log('\n不修改輸入資料');
assertDeep(existingBlank[0].assignees, [], '回填不就地改寫呼叫端傳入的案件物件');

console.log('\nSection 3｜真實 index.html：app.js 呼叫端與列表顯示');

const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9371);

if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-default-assignee-profile',
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
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
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
  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');

  // 種子資料：大安忠孝店位於台北市大安區，由 D 組（成員 ACC7）負責。
  const seeded = await evaluate(`(function () {
    var gen = ScheduleUtils.generateDueMaintenanceCases(
      INITIAL_CUSTOMERS, INITIAL_STORES, INITIAL_MAINTENANCE_CASES, null,
      INITIAL_SERVICE_LEVELS, INITIAL_ASSIGNEES, INITIAL_ACCOUNTS);
    var plain = ScheduleUtils.generateDueMaintenanceCases(
      INITIAL_CUSTOMERS, INITIAL_STORES, INITIAL_MAINTENANCE_CASES, null,
      INITIAL_SERVICE_LEVELS);
    var target = gen.find(function (c) { return c.storeName === '大安忠孝店' && !c.isClosed; });
    var before = plain.find(function (c) { return c.storeName === '大安忠孝店' && !c.isClosed; });
    return {
      beforeGroups: (before.assignees || []).join('、'),
      groups: (target.assignees || []).join('、'),
      members: (target.assigneeMemberIds || []).join('、'),
      // 已結案的種子資料不該被改寫，逐筆比對兩次產生的結果
      closedUntouched: gen.filter(function (c) { return c.isClosed; }).every(function (c, i) {
        var other = plain.filter(function (p) { return p.isClosed; })[i];
        return JSON.stringify(c.assignees) === JSON.stringify(other.assignees);
      })
    };
  })()`);
  assertEq(seeded.beforeGroups, '', '未傳組別主檔時該筆保養單原本是未指派');
  assertEq(seeded.groups, 'D組', '真實種子資料依台北市大安區帶入 D 組');
  assertEq(seeded.members, 'ACC7', '同時帶入 D 組成員');
  assertTrue(seeded.closedUntouched, '已結案的種子保養單組別完全未被改寫');

  const listed = await evaluate(`(function () {
    var nav = Array.prototype.find.call(document.querySelectorAll('button, a, li, div'), function (b) {
      return b.textContent.replace(/\\s+/g, ' ').trim() === '保養計劃進度';
    });
    if (!nav) return { error: 'no-nav' };
    nav.click();
    return { ok: true };
  })()`);
  assertTrue(listed.ok, '側選單可進入保養計劃進度');
  await sleep(800);

  const row = await evaluate(`(function () {
    var ths = Array.prototype.map.call(document.querySelectorAll('table thead th'), function (t) {
      return t.textContent.trim();
    });
    var gi = ths.indexOf('組別');
    var rows = Array.prototype.slice.call(document.querySelectorAll('table tbody tr'));
    var hit = rows.find(function (tr) {
      var tds = tr.querySelectorAll('td');
      return tds[2] && tds[2].textContent.trim() === '大安忠孝店';
    });
    if (gi < 0 || !hit) return { groupIndex: gi, found: false };
    return { groupIndex: gi, found: true, group: hit.querySelectorAll('td')[gi].textContent.trim() };
  })()`);
  assertTrue(row.found, '列表中找得到大安忠孝店那一列');
  assertEq(row.group, 'D組', '保養計劃進度列表的組別欄顯示預設組別（原為尚未指派）');

  assertEq(consoleErrors.length, 0, '操作後仍無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
