#!/usr/bin/env node
/**
 * 服務等級管理驗證腳本。
 * Section 1-3 以 node:vm 載入 IIFE 模組做純函式驗證；
 * Section 4-7 由後續 Task 追加（headless Chrome + CDP 的 UI 驗證）。
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
const SLU = sandbox.ServiceLevelUtils;

// 與 seed 的 INITIAL_SERVICE_LEVELS 內容一致的 fixture
const LEVELS = [
  { id: 'SL001', name: 'A 保修(一年四次)', maintenanceCount: 4, countsBonusPoints: false,
    periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 3 },
      { visitIndex: 2, startMonth: 4, endMonth: 6 },
      { visitIndex: 3, startMonth: 7, endMonth: 9 },
      { visitIndex: 4, startMonth: 10, endMonth: 12 }
    ] },
  { id: 'SL002', name: 'B 保修(一年兩次)', maintenanceCount: 2, countsBonusPoints: false,
    periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 6 },
      { visitIndex: 2, startMonth: 7, endMonth: 12 }
    ] },
  { id: 'SL003', name: 'C 保養(一年一次)', maintenanceCount: 1, countsBonusPoints: true,
    periods: [{ visitIndex: 1, startMonth: 1, endMonth: 12 }] },
  { id: 'SL004', name: 'D 維修(無簽約客戶)', maintenanceCount: 0, countsBonusPoints: true,
    periods: [] }
];

console.log('Section 1｜ServiceLevelUtils 查詢函式');
assertEq(SLU.findByName(LEVELS, 'B 保修(一年兩次)').id, 'SL002', 'findByName 命中');
assertEq(SLU.findByName(LEVELS, '  B 保修(一年兩次)  ').id, 'SL002', 'findByName 去頭尾空白');
assertEq(SLU.findByName(LEVELS, '不存在'), null, 'findByName 查無回 null');
assertEq(SLU.findByName(LEVELS, ''), null, 'findByName 空字串回 null');
assertEq(SLU.getMaintenanceCount(LEVELS, 'A 保修(一年四次)'), 4, 'getMaintenanceCount A 為 4');
assertEq(SLU.getMaintenanceCount(LEVELS, '不存在'), 0, 'getMaintenanceCount 查無回 0');
assertEq(SLU.countsBonusPoints(LEVELS, 'C 保養(一年一次)'), true, 'C 計算增額積分');
assertEq(SLU.countsBonusPoints(LEVELS, 'A 保修(一年四次)'), false, 'A 不計算增額積分');
assertEq(SLU.countsBonusPoints(LEVELS, '不存在'), false, 'countsBonusPoints 查無回 false');
assertEq(SLU.getPeriods(LEVELS, 'D 維修(無簽約客戶)').length, 0, 'D 無區間');
assertEq(SLU.getPeriods(LEVELS, '不存在').length, 0, 'getPeriods 查無回空陣列');
assertEq(SLU.getPeriods(
  [{ name: 'X', maintenanceCount: 2, periods: [
    { visitIndex: 2, startMonth: 7, endMonth: 12 },
    { visitIndex: 1, startMonth: 1, endMonth: 6 }] }], 'X'
)[0].visitIndex, 1, 'getPeriods 依 visitIndex 排序');
assertEq(SLU.findPeriodForMonth(LEVELS, 'A 保修(一年四次)', 5).visitIndex, 2, '5 月落在 A 的第 2 次');
assertEq(SLU.findPeriodForMonth(LEVELS, 'A 保修(一年四次)', 1).visitIndex, 1, '起始月為含界');
assertEq(SLU.findPeriodForMonth(LEVELS, 'A 保修(一年四次)', 3).visitIndex, 1, '結束月為含界');
assertEq(SLU.findPeriodForMonth(LEVELS, 'D 維修(無簽約客戶)', 5), null, 'D 任何月份都回 null');
assertEq(SLU.isAllocatable(LEVELS, 'C 保養(一年一次)'), true, 'C 納入保養分配');
assertEq(SLU.isAllocatable(LEVELS, 'D 維修(無簽約客戶)'), false, 'D 不納入保養分配');
assertEq(SLU.isAllocatable(LEVELS, '不存在'), false, '查無等級不納入保養分配');

console.log('\nSection 1｜normalizeRecord / formatPeriodsLabel');
const norm = SLU.normalizeRecord({
  name: '  X 等級 ', maintenanceCount: '2', countsBonusPoints: true,
  periods: [{ visitIndex: 2, startMonth: '7', endMonth: '12' },
            { visitIndex: 1, startMonth: '1', endMonth: '6' }]
});
assertEq(norm.name, 'X 等級', 'normalizeRecord 去頭尾空白');
assertEq(norm.maintenanceCount, 2, 'normalizeRecord maintenanceCount 轉數字');
assertEq(norm.periods[0].visitIndex, 1, 'normalizeRecord periods 依 visitIndex 排序');
assertEq(norm.periods[0].startMonth, 1, 'normalizeRecord 月份轉數字');
assertEq(SLU.formatPeriodsLabel(LEVELS[1]), '第1次 1-6月、第2次 7-12月', 'formatPeriodsLabel 兩區間');
assertEq(SLU.formatPeriodsLabel(LEVELS[3]), '—', 'formatPeriodsLabel 無區間回 —');

console.log('\nSection 1｜validate');
assertDeep(
  SLU.validate({
    name: '有效等級', maintenanceCount: 2, countsBonusPoints: false,
    periods: [{ visitIndex: 1, startMonth: 1, endMonth: 6 }, { visitIndex: 2, startMonth: 7, endMonth: 12 }]
  }, [], undefined),
  [], 'validate 合法紀錄回傳空陣列');

assertDeep(
  SLU.validate({ name: '', maintenanceCount: 0, periods: [] }, [], undefined),
  ['服務等級名稱為必填'], 'validate 空白名稱回必填錯誤');
assertDeep(
  SLU.validate({ name: '   ', maintenanceCount: 0, periods: [] }, [], undefined),
  ['服務等級名稱為必填'], 'validate 純空白名稱回必填錯誤');

assertDeep(
  SLU.validate({
    name: 'B 保修(一年兩次)', maintenanceCount: 2, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 6 }, { visitIndex: 2, startMonth: 7, endMonth: 12 }
    ]
  }, LEVELS, undefined),
  ['服務等級名稱「B 保修(一年兩次)」已存在'], 'validate 名稱與他人重複回重複錯誤');
assertDeep(
  SLU.validate({
    name: 'B 保修(一年兩次)', maintenanceCount: 2, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 6 }, { visitIndex: 2, startMonth: 7, endMonth: 12 }
    ]
  }, LEVELS, 'SL002'),
  [], 'validate excludeId 排除自己時不算重複');

assertDeep(
  SLU.validate({ name: 'X', maintenanceCount: -1, periods: [] }, [], undefined),
  ['每年保養次數需為 0 或正整數'], 'validate 保養次數為負數');
assertDeep(
  SLU.validate({ name: 'X', maintenanceCount: 2.5, periods: [] }, [], undefined),
  ['每年保養次數需為 0 或正整數'], 'validate 保養次數非整數');

assertDeep(
  SLU.validate({
    name: 'X', maintenanceCount: 2, periods: [{ visitIndex: 1, startMonth: 1, endMonth: 6 }]
  }, [], undefined),
  ['保養區間筆數（1）與每年保養次數（2）不符'], 'validate 區間筆數少於保養次數');
assertDeep(
  SLU.validate({
    name: 'X', maintenanceCount: 1, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 6 }, { visitIndex: 2, startMonth: 7, endMonth: 12 }
    ]
  }, [], undefined),
  ['保養區間筆數（2）與每年保養次數（1）不符'], 'validate 區間筆數多於保養次數');

assertDeep(
  SLU.validate({
    name: 'X', maintenanceCount: 1, periods: [{ visitIndex: 1, startMonth: 0, endMonth: 6 }]
  }, [], undefined),
  ['第1次的起始月與結束月需為 1–12 月'], 'validate 起始月為 0 超出範圍');
assertDeep(
  SLU.validate({
    name: 'X', maintenanceCount: 1, periods: [{ visitIndex: 1, startMonth: 1, endMonth: 13 }]
  }, [], undefined),
  ['第1次的起始月與結束月需為 1–12 月'], 'validate 結束月為 13 超出範圍');
assertDeep(
  SLU.validate({
    name: 'X', maintenanceCount: 1, periods: [{ visitIndex: 1, startMonth: '', endMonth: 6 }]
  }, [], undefined),
  ['第1次的起始月與結束月需為 1–12 月'], 'validate 起始月為空字串視為超出範圍');
assertDeep(
  SLU.validate({
    name: 'X', maintenanceCount: 1, periods: [{ visitIndex: 1, startMonth: 8, endMonth: 3 }]
  }, [], undefined),
  ['第1次的起始月不可大於結束月'], 'validate 起始月大於結束月');

assertDeep(
  SLU.validate({
    name: 'X', maintenanceCount: 2, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 6 }, { visitIndex: 2, startMonth: 4, endMonth: 10 }
    ]
  }, [], undefined),
  ['第1次與第2次的保養區間重疊'], 'validate 兩區間重疊');
assertDeep(
  SLU.validate({
    name: 'X', maintenanceCount: 2, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 6 }, { visitIndex: 2, startMonth: 6, endMonth: 12 }
    ]
  }, [], undefined),
  ['第1次與第2次的保養區間重疊'], 'validate 共用邊界月份視為重疊');
assertDeep(
  SLU.validate({
    name: 'X', maintenanceCount: 2, periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 6 }, { visitIndex: 2, startMonth: 7, endMonth: 12 }
    ]
  }, [], undefined),
  [], 'validate 相鄰不重疊區間視為合法');

console.log('\nSection 1｜isServiceLevelInUse');
const custs = [{ id: 'C1', name: '甲', serviceLevel: 'A 保修(一年四次)' }];
const strs = [{ id: 'S1', storeName: '甲一店', serviceLevel: 'B 保修(一年兩次)' }];
assertEq(SLU.isServiceLevelInUse('A 保修(一年四次)', custs, strs), true, '客戶使用中');
assertEq(SLU.isServiceLevelInUse('B 保修(一年兩次)', custs, strs), true, '門市使用中');
assertEq(SLU.isServiceLevelInUse('C 保養(一年一次)', custs, strs), false, '未被使用');

console.log('\nSection 1｜syncServiceLevelOptions');
sandbox.SERVICE_LEVEL_OPTIONS.push('殘留舊值');
const optRef = sandbox.SERVICE_LEVEL_OPTIONS;
SLU.syncServiceLevelOptions(LEVELS);
assertTrue(sandbox.SERVICE_LEVEL_OPTIONS === optRef, 'syncServiceLevelOptions 就地改寫，不換參考');
assertDeep(sandbox.SERVICE_LEVEL_OPTIONS,
  ['A 保修(一年四次)', 'B 保修(一年兩次)', 'C 保養(一年一次)', 'D 維修(無簽約客戶)'],
  'syncServiceLevelOptions 內容為四筆名稱且清掉舊值');
SLU.syncServiceLevelOptions([{ id: 'SL001', name: 'A 保修(一年四次)' }]);
assertDeep(sandbox.SERVICE_LEVEL_OPTIONS, ['A 保修(一年四次)'], '刪除後的等級不再出現在選項');
SLU.syncServiceLevelOptions(LEVELS); // 還原給後續 section 用

console.log('\nSection 1｜renameServiceLevel');
const renamed = SLU.renameServiceLevel('A 保修(一年四次)', 'A 全新名稱', {
  customers: [{ id: 'C1', serviceLevel: 'A 保修(一年四次)' }, { id: 'C2', serviceLevel: 'B 保修(一年兩次)' }],
  stores: [{ id: 'S1', serviceLevel: 'A 保修(一年四次)' }],
  cases: [{ id: 'R1', serviceLevel: 'A 保修(一年四次)' }],
  maintenanceCases: [{ id: 'M1', serviceLevel: 'A 保修(一年四次)' }, { id: 'M2', serviceLevel: '' }]
});
assertEq(renamed.customers[0].serviceLevel, 'A 全新名稱', 'customers 改名');
assertEq(renamed.customers[1].serviceLevel, 'B 保修(一年兩次)', '非目標等級不動');
assertEq(renamed.stores[0].serviceLevel, 'A 全新名稱', 'stores 改名');
assertEq(renamed.cases[0].serviceLevel, 'A 全新名稱', 'cases 改名');
assertEq(renamed.maintenanceCases[0].serviceLevel, 'A 全新名稱', 'maintenanceCases 改名');
assertEq(renamed.changedCount, 4, 'changedCount 為 4');
const noop = SLU.renameServiceLevel('A', 'A', { customers: [{ serviceLevel: 'A' }] });
assertEq(noop.changedCount, 0, '新舊同名時 changedCount 為 0');

// ---------- headless Chrome 區段 ----------
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9341);
if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-service-level-check-profile',
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

  console.log('\nSection 2｜頁面載入與預設資料');
  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');
  assertEq(await evaluate('INITIAL_SERVICE_LEVELS.length'), 4, 'INITIAL_SERVICE_LEVELS 有四筆');
  assertDeep(await evaluate('SERVICE_LEVEL_OPTIONS'),
    ['A 保修(一年四次)', 'B 保修(一年兩次)', 'C 保養(一年一次)', 'D 維修(無簽約客戶)'],
    '啟動時 SERVICE_LEVEL_OPTIONS 已被填入');
  assertTrue(await evaluate('PERMISSION_FUNCTIONS.indexOf("服務等級管理") !== -1'),
    'PERMISSION_FUNCTIONS 含服務等級管理');
  assertTrue(await evaluate(`(function(){
    var node = PERMISSION_TREE.find(function (n) { return n.id === '系統權限'; });
    return node.children.indexOf('服務等級管理') === node.children.indexOf('設備分類管理') + 1;
  })()`), 'PERMISSION_TREE 系統權限的服務等級管理緊接設備分類管理之後');

  console.log('\nSection 2｜列表渲染');
  await evaluate(`
    window.__levels = JSON.parse(JSON.stringify(INITIAL_SERVICE_LEVELS));
    window.__toasts = [];
    window.__renderList = function (customers, stores) {
      return ServiceLevelList({
        serviceLevels: window.__levels,
        setServiceLevels: function (v) {
          window.__levels = typeof v === 'function' ? v(window.__levels) : v;
        },
        customers: customers || [],
        stores: stores || [],
        setEditingCase: function (v) { window.__editing = v; },
        setView: function (v) { window.__view = v; },
        showToast: function (msg, kind) { window.__toasts.push([msg, kind || 'success']); }
      });
    };
    'ok'`);

  const listHeaders = await evaluate(`(function(){
    var node = window.__renderList();
    var ths = Array.prototype.map.call(node.querySelectorAll('thead th'),
      function (t) { return t.textContent.trim(); });
    node.remove();
    return ths;
  })()`);
  assertDeep(listHeaders,
    ['操作', '服務等級名稱', '每年保養次數', '是否計算增額積分', '保養區間'],
    '列表表頭五欄');

  const rowTexts = await evaluate(`(function(){
    var node = window.__renderList();
    var out = Array.prototype.map.call(node.querySelectorAll('tbody tr'), function (tr) {
      return Array.prototype.map.call(tr.querySelectorAll('td'), function (td) {
        return td.textContent.trim();
      }).slice(1);
    });
    node.remove();
    return out;
  })()`);
  assertEq(rowTexts.length, 4, '列表渲染四筆');
  assertDeep(rowTexts[0],
    ['A 保修(一年四次)', '4', '否', '第1次 1-3月、第2次 4-6月、第3次 7-9月、第4次 10-12月'],
    'A 列內容正確');
  assertDeep(rowTexts[3], ['D 維修(無簽約客戶)', '0', '是', '—'], 'D 列內容正確');

  console.log('\nSection 2｜刪除保護');
  const blocked = await evaluate(`(function(){
    window.__toasts = [];
    var custs = [{ id: 'C1', name: '甲', serviceLevel: 'A 保修(一年四次)' }];
    var node = window.__renderList(custs, []);
    var container = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(node);
    var rows = container.querySelectorAll('tbody tr');
    rows[0].querySelectorAll('td')[0].querySelectorAll('button')[1].click();
    var btns = Array.prototype.filter.call(container.querySelectorAll('button'), function (b) {
      return b.textContent.trim() === '確認刪除';
    });
    btns[0].click();
    var count = window.__levels.length;
    container.remove();
    return { count: count, toasts: window.__toasts };
  })()`);
  assertEq(blocked.count, 4, '使用中的等級未被刪除');
  assertDeep(blocked.toasts, [['此服務等級已被客戶或門市使用，無法刪除', 'error']], '跳出擋刪 toast');

  const removed = await evaluate(`(function(){
    window.__levels = JSON.parse(JSON.stringify(INITIAL_SERVICE_LEVELS));
    window.__toasts = [];
    var node = window.__renderList([], []);
    var container = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(node);
    container.querySelectorAll('tbody tr')[0].querySelectorAll('td')[0].querySelectorAll('button')[1].click();
    Array.prototype.filter.call(container.querySelectorAll('button'), function (b) {
      return b.textContent.trim() === '確認刪除';
    })[0].click();
    var names = window.__levels.map(function (s) { return s.name; });
    container.remove();
    return { names: names, toasts: window.__toasts };
  })()`);
  assertEq(removed.names.indexOf('A 保修(一年四次)'), -1, '未使用的等級刪除成功');
  assertEq(removed.names.length, 3, '刪除後剩三筆');
  assertDeep(removed.toasts, [['服務等級已刪除', 'success']], '跳出刪除成功 toast');

  console.log('\nSection 2｜app.js 路由與選單');
  const appSrc = readFileSync(join(ROOT, 'src/app.js'), 'utf8');
  assertTrue(appSrc.includes(`'服務等級管理': 'service-level-list'`), 'app.js 有選單映射');
  assertTrue(appSrc.includes(`case 'service-level-list':`), 'app.js 有 service-level-list 路由');
  const sidebarSrc = readFileSync(join(ROOT, 'src/shell/permissions-sidebar.js'), 'utf8');
  assertTrue(sidebarSrc.includes('服務等級管理'), 'permissions-sidebar 有選單項目');

  console.log('\nSection 3｜表單 validate 擋關');
  await evaluate(`
    window.__renderForm = function (target, levels) {
      window.__formLevels = levels || JSON.parse(JSON.stringify(INITIAL_SERVICE_LEVELS));
      window.__formCustomers = [{ id: 'C1', name: '甲', serviceLevel: 'A 保修(一年四次)' }];
      window.__formStores = [{ id: 'S1', storeName: '甲一店', serviceLevel: 'A 保修(一年四次)' }];
      window.__formCases = [{ id: 'R1', serviceLevel: 'A 保修(一年四次)' }];
      window.__formMaint = [{ id: 'M1', serviceLevel: 'A 保修(一年四次)' }];
      window.__toasts = [];
      window.__view = '';
      return ServiceLevelForm({
        serviceLevels: window.__formLevels,
        setServiceLevels: function (v) { window.__formLevels = v; },
        customers: window.__formCustomers,
        setCustomers: function (v) { window.__formCustomers = v; },
        stores: window.__formStores,
        setStores: function (v) { window.__formStores = v; },
        cases: window.__formCases,
        setCases: function (v) { window.__formCases = v; },
        maintenanceCases: window.__formMaint,
        setMaintenanceCases: function (v) { window.__formMaint = v; },
        targetCase: target,
        setView: function (v) { window.__view = v; },
        showToast: function (msg, kind) { window.__toasts.push([msg, kind || 'success']); }
      });
    };
    // stateful() 的 rerender 是以 parentNode.replaceChild 換掉整棵樹，
    // 所以測試需固定持有一個「容器」節點：容器本身不會被換掉，
    // 之後所有 fill/submit/查詢一律透過容器進行，才能拿到 rerender 後的最新樹。
    window.__mountForm = function (target, levels) {
      var container = document.createElement('div');
      document.body.appendChild(container);
      container.appendChild(window.__renderForm(target, levels));
      return container;
    };
    // src/core/searchable-select.js 攔截了 h('select', ...)：頁面上完全沒有原生 <select>，
    // 而是一個保留 name 屬性、role="combobox" 的 <input>，開啟時才會把選項選單
    // portal 到 document.body（<ul class="searchable-select__menu--portal">，
    // 內含 <button role="option">）。元件監聽的是 input 的 mousedown 來開啟選單、
    // 選項按鈕的 mousedown（而非 click）來選取（見該檔 handleInputMouseDown/chooseOption）。
    // 實測 input.focus() 在 headless Chrome 中會更新 document.activeElement，
    // 但不一定真的觸發 'focus' 事件（需要瀏覽器視窗本身有焦點），故改用更可靠的
    // mousedown 合成事件來開啟選單，貼近使用者以滑鼠點擊下拉框的操作。
    window.__chooseOption = function (container, name, label) {
      var input = container.querySelector('[name="' + name + '"]');
      if (!input) throw new Error('__chooseOption: 找不到欄位 ' + name);
      input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      var btns = Array.prototype.filter.call(
        document.querySelectorAll('.searchable-select__menu--portal .searchable-select__option'),
        function (b) { return b.textContent.trim() === label; }
      );
      if (!btns.length) throw new Error('__chooseOption: 欄位 ' + name + ' 找不到選項 ' + label);
      btns[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    };
    window.__fill = function (node, values) {
      // 文字／數字 input 的 onChange 在此框架對應原生 'input' 事件（貼近 React 語意），
      // 只有 select/checkbox 等才對應 'change'，故底下依欄位型別分別 dispatch。
      var name = node.querySelector('input[name="name"]');
      if (values.name !== undefined) {
        name.value = values.name;
        name.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (values.maintenanceCount !== undefined) {
        var cnt = node.querySelector('input[name="maintenanceCount"]');
        cnt.value = String(values.maintenanceCount);
        cnt.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (values.countsBonusPoints !== undefined) {
        window.__chooseOption(node, 'countsBonusPoints', values.countsBonusPoints ? '是' : '否');
      }
      (values.periods || []).forEach(function (p, i) {
        window.__chooseOption(node, 'startMonth-' + (i + 1), p[0] + '月');
        window.__chooseOption(node, 'endMonth-' + (i + 1), p[1] + '月');
      });
    };
    window.__submit = function (node) {
      node.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    };
    'ok'`);

  async function submitCase(script) {
    return await evaluate(`(function(){
      var node = window.__mountForm(null);
      ${script}
      var out = { toasts: window.__toasts, view: window.__view, count: window.__formLevels.length };
      node.remove();
      return out;
    })()`);
  }

  const emptyName = await submitCase(`
    window.__fill(node, { name: '   ', maintenanceCount: 0 });
    window.__submit(node);`);
  assertEq(emptyName.toasts[0][0], '服務等級名稱為必填', '名稱空白被擋');
  assertEq(emptyName.toasts[0][1], 'error', '以 error toast 顯示');
  assertEq(emptyName.view, '', '不關閉表單');
  assertEq(emptyName.count, 4, '未新增任何資料');

  const dupName = await submitCase(`
    window.__fill(node, { name: 'C 保養(一年一次)', maintenanceCount: 0 });
    window.__submit(node);`);
  assertEq(dupName.toasts[0][0], '服務等級名稱「C 保養(一年一次)」已存在', '名稱重複被擋');

  const badRange = await submitCase(`
    window.__fill(node, { name: '新等級', maintenanceCount: 1, periods: [[6, 3]] });
    window.__submit(node);`);
  assertEq(badRange.toasts[0][0], '第1次的起始月不可大於結束月', '起訖月顛倒被擋');

  const overlap = await submitCase(`
    window.__fill(node, { name: '新等級', maintenanceCount: 2, periods: [[1, 6], [5, 12]] });
    window.__submit(node);`);
  assertEq(overlap.toasts[0][0], '第1次與第2次的保養區間重疊', '區間重疊被擋');

  const blankMonth = await submitCase(`
    window.__fill(node, { name: '新等級', maintenanceCount: 1 });
    window.__submit(node);`);
  assertEq(blankMonth.toasts[0][0], '第1次的起始月與結束月需為 1–12 月', '未選月份被擋');

  console.log('\nSection 3｜次數變更時區間列的增減');
  const rowCounts = await evaluate(`(function(){
    // searchable-select 沒有原生 <select>，區間列的月份欄位改用 name 屬性選取
    // （name 屬性仍保留在元件內部的 <input role="combobox"> 上）。
    var node = window.__mountForm(null);
    var out = {};
    out.zero = node.querySelectorAll('[name^="startMonth-"]').length;
    out.zeroHint = node.textContent.indexOf('此服務等級不納入保養分配') !== -1;
    window.__fill(node, { maintenanceCount: 3 });
    out.three = node.querySelectorAll('[name^="startMonth-"]').length;
    window.__fill(node, { periods: [[1, 4], [5, 8], [9, 12]] });
    window.__fill(node, { maintenanceCount: 2 });
    out.two = node.querySelectorAll('[name^="startMonth-"]').length;
    out.keptFirst = node.querySelector('[name="startMonth-1"]').value;
    out.keptSecond = node.querySelector('[name="endMonth-2"]').value;
    node.remove();
    return out;
  })()`);
  assertEq(rowCounts.zero, 0, '次數 0 時不顯示區間列');
  assertEq(rowCounts.zeroHint, true, '次數 0 時顯示「此服務等級不納入保養分配」');
  assertEq(rowCounts.three, 3, '次數改 3 產生 3 列');
  assertEq(rowCounts.two, 2, '次數改 2 砍到 2 列');
  // searchable-select 的 input.value 顯示的是選項標籤（如「1月」），而非原始數值，
  // 故此處讀回標籤字串以證明「縮減列數時已填值仍保留」。
  assertEq(rowCounts.keptFirst, '1月', '減少列數時保留第 1 列已填值');
  assertEq(rowCounts.keptSecond, '8月', '減少列數時保留第 2 列已填值');

  console.log('\nSection 3｜新增成功');
  const added = await evaluate(`(function(){
    var node = window.__mountForm(null);
    window.__fill(node, { name: 'E 特約(一年三次)', maintenanceCount: 3, countsBonusPoints: true,
      periods: [[1, 4], [5, 8], [9, 12]] });
    window.__submit(node);
    var created = window.__formLevels[0];
    var out = {
      count: window.__formLevels.length,
      name: created.name,
      maintenanceCount: created.maintenanceCount,
      countsBonusPoints: created.countsBonusPoints,
      periods: created.periods,
      hasId: !!created.id,
      view: window.__view,
      toasts: window.__toasts
    };
    node.remove();
    return out;
  })()`);
  assertEq(added.count, 5, '新增後共五筆');
  assertEq(added.name, 'E 特約(一年三次)', '名稱正確');
  assertEq(added.maintenanceCount, 3, '次數為數字 3');
  assertEq(added.countsBonusPoints, true, 'countsBonusPoints 為 true');
  assertDeep(added.periods, [
    { visitIndex: 1, startMonth: 1, endMonth: 4 },
    { visitIndex: 2, startMonth: 5, endMonth: 8 },
    { visitIndex: 3, startMonth: 9, endMonth: 12 }
  ], '區間正確');
  assertEq(added.hasId, true, '有產生 id');
  assertEq(added.view, 'service-level-list', '儲存後回列表');
  assertDeep(added.toasts, [['服務等級新增成功', 'success']], '跳出新增成功 toast');

  console.log('\nSection 3｜編輯改名時同步既有資料');
  const editRenamed = await evaluate(`(function(){
    var target = JSON.parse(JSON.stringify(INITIAL_SERVICE_LEVELS))[0];
    var node = window.__mountForm(target);
    var out = { initialName: node.querySelector('input[name="name"]').value };
    window.__fill(node, { name: 'A 保修(季保)' });
    window.__submit(node);
    out.levelName = window.__formLevels[0].name;
    out.levelCount = window.__formLevels.length;
    out.customer = window.__formCustomers[0].serviceLevel;
    out.store = window.__formStores[0].serviceLevel;
    out.case = window.__formCases[0].serviceLevel;
    out.maint = window.__formMaint[0].serviceLevel;
    out.toasts = window.__toasts;
    node.remove();
    return out;
  })()`);
  assertEq(editRenamed.initialName, 'A 保修(一年四次)', '編輯時帶入原名稱');
  assertEq(editRenamed.levelCount, 4, '編輯不會多出資料');
  assertEq(editRenamed.levelName, 'A 保修(季保)', '服務等級本身已改名');
  assertEq(editRenamed.customer, 'A 保修(季保)', 'customers 已同步');
  assertEq(editRenamed.store, 'A 保修(季保)', 'stores 已同步');
  assertEq(editRenamed.case, 'A 保修(季保)', 'cases 已同步');
  assertEq(editRenamed.maint, 'A 保修(季保)', 'maintenanceCases 已同步');
  assertDeep(editRenamed.toasts, [['服務等級更新成功，已同步 4 筆既有資料', 'success']],
    'toast 註明同步筆數');

  const editNoRename = await evaluate(`(function(){
    var target = JSON.parse(JSON.stringify(INITIAL_SERVICE_LEVELS))[1];
    var node = window.__mountForm(target);
    window.__fill(node, { countsBonusPoints: true });
    window.__submit(node);
    var out = { name: window.__formLevels[1].name, bonus: window.__formLevels[1].countsBonusPoints,
      toasts: window.__toasts };
    node.remove();
    return out;
  })()`);
  assertEq(editNoRename.name, 'B 保修(一年兩次)', '未改名時名稱不變');
  assertEq(editNoRename.bonus, true, '其他欄位更新成功');
  assertDeep(editNoRename.toasts, [['服務等級更新成功', 'success']], '未改名時 toast 不提同步筆數');

  console.log('\nSection 4｜isBonusEligible 改吃 serviceLevels');
  await evaluate(`
    window.__cats = [
      { id: 'DC1', category: '室內機', brand: '大金', deviceName: '分離式',
        specification: '2噸', model: 'ADD-1', equipmentLevel: '增額設備' },
      { id: 'DC2', category: '室內機', brand: '大金', deviceName: '分離式',
        specification: '3噸', model: 'BASE-1', equipmentLevel: '基礎設備' }
    ];
    window.__case = function (level, model) {
      return { id: 'X', serviceLevel: level, equipment: model ? { model: model } : null };
    };
    'ok'`);
  const SLS = 'INITIAL_SERVICE_LEVELS';
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('C 保養(一年一次)', 'BASE-1'), window.__cats, ${SLS})`),
    true, 'C（勾選計分）+ 基礎設備 計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('D 維修(無簽約客戶)', null), window.__cats, ${SLS})`),
    true, 'D（勾選計分）無設備仍計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('A 保修(一年四次)', 'BASE-1'), window.__cats, ${SLS})`),
    false, 'A（未勾選）+ 基礎設備 不計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('A 保修(一年四次)', 'ADD-1'), window.__cats, ${SLS})`),
    true, 'A（未勾選）+ 增額設備 計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('B 保修(一年兩次)', 'ADD-1'), window.__cats, ${SLS})`),
    true, 'B（未勾選）+ 增額設備 計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('查無此等級', 'BASE-1'), window.__cats, ${SLS})`),
    false, '查無等級 + 基礎設備 不計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('', 'ADD-1'), window.__cats, ${SLS})`),
    true, '等級空字串 + 增額設備 計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('C 保養(一年一次)', 'BASE-1'), window.__cats, [])`),
    false, 'serviceLevels 為空陣列時只看設備等級');
  assertEq(await evaluate('typeof PerformanceUtils.isServiceLevelCD'), 'undefined',
    'isServiceLevelCD 已自 export 移除');

  console.log('\nSection 4｜銷案審核總積分欄改由服務等級旗標決定');
  const reviewCells = await evaluate(`(function(){
    var levels = [
      { id: 'SL001', name: 'A 保修(一年四次)', maintenanceCount: 4, countsBonusPoints: true, periods: [] },
      { id: 'SL003', name: 'C 保養(一年一次)', maintenanceCount: 1, countsBonusPoints: false, periods: [] }
    ];
    var cases = [
      { id: 'R1', caseNumber: 'SL001', customerName: '甲', storeName: '甲一', serviceLevel: 'A 保修(一年四次)',
        workCategory: '一般叫修', isClosed: true, closeDate: todayDate + ' 10:00',
        processRecords: [{ points: 5, qty: 2 }] },
      { id: 'R2', caseNumber: 'SL002', customerName: '乙', storeName: '乙一', serviceLevel: 'C 保養(一年一次)',
        workCategory: '一般叫修', isClosed: true, closeDate: todayDate + ' 10:00',
        processRecords: [{ points: 7, qty: 1 }] }
    ];
    var node = CaseReviewList({
      cases: cases, setCases: function () {},
      maintenanceCases: [], setMaintenanceCases: function () {},
      assignees: [], deviceCategories: window.__cats, serviceLevels: levels,
      setViewingCase: function () {}, setView: function () {}, showToast: function () {}
    });
    var headers = Array.prototype.map.call(node.querySelectorAll('thead th'),
      function (t) { return t.textContent.trim(); });
    var idx = headers.indexOf('總積分');
    var out = {};
    Array.prototype.forEach.call(node.querySelectorAll('tbody tr'), function (tr) {
      var tds = tr.querySelectorAll('td');
      if (!tds.length) return;
      out[tds[2].textContent.trim()] = tds[idx].textContent.trim();
    });
    node.remove();
    return out;
  })()`);
  assertEq(reviewCells.SL001, '10', '勾選計分的 A 顯示 5×2 = 10');
  assertEq(reviewCells.SL002, '', '未勾選計分且非增額設備的 C 留空');

  console.log('\nSection 4｜app.js 已往下傳 serviceLevels');
  const appSrc4 = readFileSync(join(ROOT, 'src/app.js'), 'utf8');
  const reviewIdx = appSrc4.indexOf('CaseReviewList');
  assertTrue(appSrc4.slice(reviewIdx, reviewIdx + 400).includes('serviceLevels'),
    'app.js 的 CaseReviewList 呼叫含 serviceLevels');
  const statsIdx = appSrc4.indexOf('CasePerformanceStats');
  assertTrue(appSrc4.slice(statsIdx, statsIdx + 500).includes('serviceLevels'),
    'app.js 的 CasePerformanceStats 呼叫含 serviceLevels');

  // === UI sections 由後續 Task 追加 ===

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
