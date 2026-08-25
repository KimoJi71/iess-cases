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
  { id: 'SL001', name: 'A 保修(一年四次)', maintenanceCount: 4, countsBonusPoints: false },
  { id: 'SL002', name: 'B 保修(一年兩次)', maintenanceCount: 2, countsBonusPoints: false },
  { id: 'SL003', name: 'C 保養(一年一次)', maintenanceCount: 1, countsBonusPoints: true },
  { id: 'SL004', name: 'D 維修(無簽約客戶)', maintenanceCount: 0, countsBonusPoints: true }
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
assertEq(SLU.isAllocatable(LEVELS, 'C 保養(一年一次)'), true, 'C 納入保養分配');
assertEq(SLU.isAllocatable(LEVELS, 'D 維修(無簽約客戶)'), false, 'D 不納入保養分配');
assertEq(SLU.isAllocatable(LEVELS, '不存在'), false, '查無等級不納入保養分配');

console.log('\nSection 1｜normalizeRecord');
const norm = SLU.normalizeRecord({
  name: '  X 等級 ', maintenanceCount: '2', countsBonusPoints: true
});
assertEq(norm.name, 'X 等級', 'normalizeRecord 去頭尾空白');
assertEq(norm.maintenanceCount, 2, 'normalizeRecord maintenanceCount 轉數字');

console.log('\nSection 1｜validate');
assertDeep(
  SLU.validate({ name: '有效等級', maintenanceCount: 2, countsBonusPoints: false }, [], undefined),
  [], 'validate 合法紀錄回傳空陣列');

assertDeep(
  SLU.validate({ name: '', maintenanceCount: 0 }, [], undefined),
  ['服務等級名稱為必填'], 'validate 空白名稱回必填錯誤');
assertDeep(
  SLU.validate({ name: '   ', maintenanceCount: 0 }, [], undefined),
  ['服務等級名稱為必填'], 'validate 純空白名稱回必填錯誤');

assertDeep(
  SLU.validate({ name: 'B 保修(一年兩次)', maintenanceCount: 2 }, LEVELS, undefined),
  ['服務等級名稱「B 保修(一年兩次)」已存在'], 'validate 名稱與他人重複回重複錯誤');
assertDeep(
  SLU.validate({ name: 'B 保修(一年兩次)', maintenanceCount: 2 }, LEVELS, 'SL002'),
  [], 'validate excludeId 排除自己時不算重複');

assertDeep(
  SLU.validate({ name: 'X', maintenanceCount: -1 }, [], undefined),
  ['每年保養次數需為 0 或正整數'], 'validate 保養次數為負數');
assertDeep(
  SLU.validate({ name: 'X', maintenanceCount: 2.5 }, [], undefined),
  ['每年保養次數需為 0 或正整數'], 'validate 保養次數非整數');

console.log('\nSection 1｜isServiceLevelInUse');
const custs = [{ id: 'C1', name: '甲', serviceLevel: 'A 保修(一年四次)' }];
const strs = [{ id: 'S1', storeName: '甲一店', serviceLevel: 'B 保修(一年兩次)' }];
const inUseCollections = { customers: custs, stores: strs };
assertEq(SLU.isServiceLevelInUse('A 保修(一年四次)', inUseCollections), true, '客戶使用中');
assertEq(SLU.isServiceLevelInUse('B 保修(一年兩次)', inUseCollections), true, '門市使用中');
assertEq(SLU.isServiceLevelInUse('C 保養(一年一次)', inUseCollections), false, '未被使用');
assertEq(SLU.isServiceLevelInUse('X 案件級', {
  cases: [{ id: 'R1', serviceLevel: 'X 案件級' }]
}), true, '僅被叫修案件使用（無客戶／門市）也視為使用中');
assertEq(SLU.isServiceLevelInUse('Y 保養案件級', {
  maintenanceCases: [{ id: 'M1', serviceLevel: 'Y 保養案件級' }]
}), true, '僅被保養案件使用也視為使用中');
assertEq(SLU.isServiceLevelInUse('Z 工程頂層', {
  projectCases: [{ id: 'P1', serviceLevel: 'Z 工程頂層' }]
}), true, '被工程案件頂層 serviceLevel 使用視為使用中');
assertEq(SLU.isServiceLevelInUse('Z 工程巢狀', {
  projectCases: [{ id: 'P1', serviceLevel: '', details: { serviceLevel: 'Z 工程巢狀' } }]
}), true, '被工程案件巢狀 details.serviceLevel 使用視為使用中');
assertEq(SLU.isServiceLevelInUse('W 勘查級', {
  surveyCases: [{ id: 'S1', serviceLevel: 'W 勘查級' }]
}), true, '僅被現勘案件使用也視為使用中');
assertEq(SLU.isServiceLevelInUse('V 人員狀態級', {
  personnelStatus: [{ id: 'PS1', serviceLevel: 'V 人員狀態級' }]
}), true, '僅被人員狀態使用也視為使用中');

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
  maintenanceCases: [{ id: 'M1', serviceLevel: 'A 保修(一年四次)' }, { id: 'M2', serviceLevel: '' }],
  projectCases: [
    { id: 'P1', serviceLevel: 'A 保修(一年四次)', details: { serviceLevel: 'A 保修(一年四次)' } },
    { id: 'P2', serviceLevel: 'A 保修(一年四次)', details: { serviceLevel: 'B 保修(一年兩次)' } }
  ],
  surveyCases: [{ id: 'SV1', serviceLevel: 'A 保修(一年四次)' }],
  personnelStatus: [{ id: 'PS1', serviceLevel: 'A 保修(一年四次)' }]
});
assertEq(renamed.customers[0].serviceLevel, 'A 全新名稱', 'customers 改名');
assertEq(renamed.customers[1].serviceLevel, 'B 保修(一年兩次)', '非目標等級不動');
assertEq(renamed.stores[0].serviceLevel, 'A 全新名稱', 'stores 改名');
assertEq(renamed.cases[0].serviceLevel, 'A 全新名稱', 'cases 改名');
assertEq(renamed.maintenanceCases[0].serviceLevel, 'A 全新名稱', 'maintenanceCases 改名');
assertEq(renamed.projectCases[0].serviceLevel, 'A 全新名稱', 'projectCases 頂層 serviceLevel 改名');
assertEq(renamed.projectCases[0].details.serviceLevel, 'A 全新名稱', 'projectCases 巢狀 details.serviceLevel 改名');
assertEq(renamed.projectCases[1].serviceLevel, 'A 全新名稱', '僅頂層命中的 projectCases 頂層仍改名');
assertEq(renamed.projectCases[1].details.serviceLevel, 'B 保修(一年兩次)', '僅頂層命中的 projectCases 巢狀非目標等級不動');
assertEq(renamed.surveyCases[0].serviceLevel, 'A 全新名稱', 'surveyCases 改名');
assertEq(renamed.personnelStatus[0].serviceLevel, 'A 全新名稱', 'personnelStatus 改名');
// changedCount 以「欄位」為單位計數：customers/stores/cases/maintenanceCases 各 1 筆（4），
// projectCases 第一筆頂層＋巢狀都命中算 2，第二筆只有頂層命中算 1（共 3），
// surveyCases、personnelStatus 各 1 筆，總計 4 + 3 + 1 + 1 = 9。
assertEq(renamed.changedCount, 9, 'changedCount 以欄位為單位計數，projectCases 頂層＋巢狀各算一次，共 9');
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
  // 系統權限自分群後改為巢狀（人員與權限／基礎資料設定／保養作業），
  // 服務等級管理是「基礎資料設定」底下的葉節點。
  assertTrue(await evaluate(`(function(){
    var top = PERMISSION_TREE.find(function (n) { return n.id === '系統權限'; });
    var group = top.children.find(function (n) { return n.id === '基礎資料設定'; });
    return group.children.indexOf('服務等級管理') === 0;
  })()`), 'PERMISSION_TREE 系統權限 > 基礎資料設定 的第一項是服務等級管理');

  console.log('\nSection 2｜列表渲染');
  await evaluate(`
    window.__levels = JSON.parse(JSON.stringify(INITIAL_SERVICE_LEVELS));
    window.__toasts = [];
    window.__renderList = function (customers, stores, extra) {
      extra = extra || {};
      return ServiceLevelList(Object.assign({
        serviceLevels: window.__levels,
        setServiceLevels: function (v) {
          window.__levels = typeof v === 'function' ? v(window.__levels) : v;
        },
        customers: customers || [],
        stores: stores || [],
        setEditingCase: function (v) { window.__editing = v; },
        setView: function (v) { window.__view = v; },
        showToast: function (msg, kind) { window.__toasts.push([msg, kind || 'success']); }
      }, extra));
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
    ['操作', '服務等級名稱', '每年保養次數', '是否計算增額積分'],
    '列表表頭四欄');

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
  assertDeep(rowTexts[0], ['A 保修(一年四次)', '4', '否'], 'A 列內容正確');
  assertDeep(rowTexts[3], ['D 維修(無簽約客戶)', '0', '是'], 'D 列內容正確');

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
    var names = window.__levels.map(function (s) { return s.name; });
    container.remove();
    return { count: count, names: names, toasts: window.__toasts };
  })()`);
  assertEq(blocked.count, 4, '使用中的等級未被刪除');
  assertTrue(blocked.names.indexOf('A 保修(一年四次)') !== -1, '使用中的等級「A 保修(一年四次)」本身仍存在於列表中', blocked.names.join('、'));
  assertDeep(blocked.toasts, [['此服務等級已被客戶或門市使用，無法刪除', 'error']], '跳出擋刪 toast');

  const blockedByCaseOnly = await evaluate(`(function(){
    window.__levels = JSON.parse(JSON.stringify(INITIAL_SERVICE_LEVELS));
    window.__toasts = [];
    // 無客戶、無門市，僅一筆叫修案件引用該服務等級：仍應擋刪
    var node = window.__renderList([], [], {
      cases: [{ id: 'R1', serviceLevel: 'A 保修(一年四次)' }]
    });
    var container = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(node);
    var rows = container.querySelectorAll('tbody tr');
    rows[0].querySelectorAll('td')[0].querySelectorAll('button')[1].click();
    var btns = Array.prototype.filter.call(container.querySelectorAll('button'), function (b) {
      return b.textContent.trim() === '確認刪除';
    });
    btns[0].click();
    var names = window.__levels.map(function (s) { return s.name; });
    container.remove();
    return { count: window.__levels.length, names: names, toasts: window.__toasts };
  })()`);
  assertEq(blockedByCaseOnly.count, 4, '僅被叫修案件使用（無客戶／門市）的等級也未被刪除');
  assertTrue(blockedByCaseOnly.names.indexOf('A 保修(一年四次)') !== -1,
    '僅被案件使用的等級本身仍存在於列表中', blockedByCaseOnly.names.join('、'));
  assertDeep(blockedByCaseOnly.toasts, [['此服務等級已被客戶或門市使用，無法刪除', 'error']],
    '僅被案件使用時同樣跳出擋刪 toast');

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
      window.__formProjects = [{ id: 'P1', serviceLevel: 'A 保修(一年四次)',
        details: { serviceLevel: 'A 保修(一年四次)' } }];
      window.__formSurveys = [{ id: 'SV1', serviceLevel: 'A 保修(一年四次)' }];
      window.__formPersonnel = [{ id: 'PS1', serviceLevel: 'A 保修(一年四次)' }];
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
        projectCases: window.__formProjects,
        setProjectCases: function (v) { window.__formProjects = v; },
        surveyCases: window.__formSurveys,
        setSurveyCases: function (v) { window.__formSurveys = v; },
        personnelStatus: window.__formPersonnel,
        setPersonnelStatus: function (v) { window.__formPersonnel = v; },
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

  console.log('\nSection 3｜次數欄位下方的說明文字');
  const hint = await evaluate(`(function(){
    var node = window.__mountForm(null);
    var out = {};
    out.zeroHint = node.textContent.indexOf('此服務等級不納入保養分配') !== -1;
    window.__fill(node, { maintenanceCount: 3 });
    out.nonZeroHint = node.textContent.indexOf('各次的月份區間由各客戶在「客戶管理」自行設定') !== -1;
    node.remove();
    return out;
  })()`);
  assertEq(hint.zeroHint, true, '次數 0 時顯示「此服務等級不納入保養分配」');
  assertEq(hint.nonZeroHint, true, '次數大於 0 時顯示「各次的月份區間由各客戶在『客戶管理』自行設定」');

  console.log('\nSection 3｜新增成功');
  const added = await evaluate(`(function(){
    var node = window.__mountForm(null);
    window.__fill(node, { name: 'E 特約(一年三次)', maintenanceCount: 3, countsBonusPoints: true });
    window.__submit(node);
    var created = window.__formLevels[0];
    var out = {
      count: window.__formLevels.length,
      name: created.name,
      maintenanceCount: created.maintenanceCount,
      countsBonusPoints: created.countsBonusPoints,
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
    out.projectTop = window.__formProjects[0].serviceLevel;
    out.projectNested = window.__formProjects[0].details.serviceLevel;
    out.survey = window.__formSurveys[0].serviceLevel;
    out.personnel = window.__formPersonnel[0].serviceLevel;
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
  assertEq(editRenamed.projectTop, 'A 保修(季保)', 'projectCases 頂層 serviceLevel 已同步');
  assertEq(editRenamed.projectNested, 'A 保修(季保)', 'projectCases 巢狀 details.serviceLevel 已同步');
  assertEq(editRenamed.survey, 'A 保修(季保)', 'surveyCases 已同步');
  assertEq(editRenamed.personnel, 'A 保修(季保)', 'personnelStatus 已同步');
  // changedCount：customers/stores/cases/maintenanceCases 各 1（4）＋ projectCases
  // 頂層與巢狀都命中算 2 ＋ surveyCases 1 ＋ personnelStatus 1 = 8。
  assertDeep(editRenamed.toasts, [['服務等級更新成功，已同步 8 筆既有資料', 'success']],
    'toast 註明同步筆數（含新收錄的 projectCases／surveyCases／personnelStatus）');

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
    // 設備等級存在設備紀錄上（設備管理設定），不再反查設備分類
    window.__case = function (level, equipLevel) {
      return { id: 'X', serviceLevel: level,
        serviceItems: [{ id: 'SI1',
          equipment: equipLevel ? { model: 'M-1', equipmentLevel: equipLevel } : null,
          actualReason: '', processRecords: [] }] };
    };
    'ok'`);
  const SLS = 'INITIAL_SERVICE_LEVELS';
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('C 保養(一年一次)', '一般設備'), ${SLS})`),
    true, 'C（勾選計分）+ 一般設備 計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('D 維修(無簽約客戶)', null), ${SLS})`),
    true, 'D（勾選計分）無設備仍計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('A 保修(一年四次)', '一般設備'), ${SLS})`),
    false, 'A（未勾選）+ 一般設備 不計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('A 保修(一年四次)', '增額設備'), ${SLS})`),
    true, 'A（未勾選）+ 增額設備 計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('B 保修(一年兩次)', '增額設備'), ${SLS})`),
    true, 'B（未勾選）+ 增額設備 計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('查無此等級', '一般設備'), ${SLS})`),
    false, '查無等級 + 一般設備 不計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('', '增額設備'), ${SLS})`),
    true, '等級空字串 + 增額設備 計分');
  assertEq(await evaluate(`PerformanceUtils.isBonusEligible(window.__case('C 保養(一年一次)', '一般設備'), [])`),
    false, 'serviceLevels 為空陣列時只看設備等級');
  assertEq(await evaluate('typeof PerformanceUtils.isServiceLevelCD'), 'undefined',
    'isServiceLevelCD 已自 export 移除');

  console.log('\nSection 4｜銷案審核總積分欄改由服務等級旗標決定');
  const reviewCells = await evaluate(`(function(){
    var levels = [
      { id: 'SL001', name: 'A 保修(一年四次)', maintenanceCount: 4, countsBonusPoints: true },
      { id: 'SL003', name: 'C 保養(一年一次)', maintenanceCount: 1, countsBonusPoints: false }
    ];
    var cases = [
      { id: 'R1', caseNumber: 'SL001', customerName: '甲', storeName: '甲一', serviceLevel: 'A 保修(一年四次)',
        workCategory: '一般叫修', isClosed: true, closeDate: todayDate + ' 10:00',
        serviceItems: [{ id: 'SI1', equipment: null, actualReason: '',
          processRecords: [{ points: 5, qty: 2 }] }] },
      { id: 'R2', caseNumber: 'SL002', customerName: '乙', storeName: '乙一', serviceLevel: 'C 保養(一年一次)',
        workCategory: '一般叫修', isClosed: true, closeDate: todayDate + ' 10:00',
        serviceItems: [{ id: 'SI1', equipment: null, actualReason: '',
          processRecords: [{ points: 7, qty: 1 }] }] }
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

  console.log('\nSection 5｜getServiceLevelByCustomerName');
  await evaluate(`
    window.__custs = [
      { id: 'C1', name: '屈臣氏', serviceLevel: 'A 保修(一年四次)' },
      { id: 'C2', name: '統一超商', serviceLevel: '' }
    ];
    'ok'`);
  assertEq(await evaluate(`CustomerUtils.getServiceLevelByCustomerName(window.__custs, '屈臣氏')`),
    'A 保修(一年四次)', '命中客戶回其服務等級');
  assertEq(await evaluate(`CustomerUtils.getServiceLevelByCustomerName(window.__custs, '統一超商')`),
    '', '客戶服務等級為空字串時回空字串');
  assertEq(await evaluate(`CustomerUtils.getServiceLevelByCustomerName(window.__custs, '不存在')`),
    '', '查無客戶回空字串');
  assertEq(await evaluate(`CustomerUtils.getServiceLevelByCustomerName(null, '屈臣氏')`),
    '', 'customers 為 null 回空字串');
  assertEq(await evaluate(`typeof window.CUSTOMER_SERVICE_LEVEL_MAP`), 'undefined',
    'CUSTOMER_SERVICE_LEVEL_MAP 已刪除');

  console.log('\nSection 5｜五處呼叫點已改寫');
  // 注意：case-form.js:85、project-form.js:277/634 仍合法保有裸字串
  // 'D 維修(無簽約客戶)'（表單初始預設值／另一個同步邏輯的 fallback，與客戶
  // 對照表無關），所以不能對整檔做「零次出現裸字串」的粗略檢查；改為精準比對
  // 「轉換後的呼叫點是否仍以該字串當 OR fallback」，才是這次重構真正要保證的事。
  // case-form.js 於「編輯叫修案件改五段排版」後只剩一個客戶名稱下拉，
  // 呼叫點由 2 處併為 1 處。
  const callSites = [
    ['src/features/repair/case-form.js', 1],
    ['src/features/project/project-form.js', 2],
    // 保養區間搬到客戶後，renderMaintenanceScheduleDetails 直接以 customerName
    // 取得區間，不再需要服務等級名稱，故呼叫點由 2 處回到 1 處。
    ['src/features/scheduling/case-arrangement.js', 1]
  ];
  for (const [rel, expectedCount] of callSites) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    assertEq((src.match(/CUSTOMER_SERVICE_LEVEL_MAP/g) || []).length, 0,
      `${rel} 不再引用 CUSTOMER_SERVICE_LEVEL_MAP`);
    assertEq((src.match(/getServiceLevelByCustomerName/g) || []).length, expectedCount,
      `${rel} 有 ${expectedCount} 處改用 getServiceLevelByCustomerName`);
    assertEq((src.match(/getServiceLevelByCustomerName\([^)]*\)\s*\|\|\s*'D 維修\(無簽約客戶\)'/g) || []).length, 0,
      `${rel} 轉換後的呼叫點不再以 'D 維修(無簽約客戶)' 作為 OR fallback`);
  }

  console.log('\nSection 5｜case-form.js／project-form.js 呼叫點無 OR fallback');
  const noFallbackSites = [
    ['src/features/repair/case-form.js', 1],
    ['src/features/project/project-form.js', 2]
  ];
  for (const [rel, expectedCount] of noFallbackSites) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    assertEq((src.match(/getServiceLevelByCustomerName\(customers, value\);/g) || []).length, expectedCount,
      `${rel} 的呼叫點賦值直接以呼叫結果結尾，無任何 || fallback`);
  }

  console.log('\nSection 5｜case-arrangement.js 呼叫點保留查無則沿用原值');
  const arrangementSrc = readFileSync(join(ROOT, 'src/features/scheduling/case-arrangement.js'), 'utf8');
  assertEq((arrangementSrc.match(/getServiceLevelByCustomerName\(customers, value\)\s*\|\|\s*scheduleModal\.formData\.serviceLevel;/g) || []).length, 1,
    'case-arrangement.js 查無客戶服務等級時仍 OR 回原有 scheduleModal.formData.serviceLevel');

  console.log('\nSection 6｜客戶不再有 maintenanceInterval');
  assertEq(await evaluate(`INITIAL_CUSTOMERS.some(function (c) { return 'maintenanceInterval' in c; })`),
    false, 'seed 客戶已移除 maintenanceInterval');
  assertEq(await evaluate('typeof window.MAINTENANCE_INTERVAL_OPTIONS'), 'undefined',
    'MAINTENANCE_INTERVAL_OPTIONS 已刪除');
  const custFormSrc = readFileSync(join(ROOT, 'src/features/customer/customer-form.js'), 'utf8');
  assertEq((custFormSrc.match(/maintenanceInterval/g) || []).length, 0,
    'customer-form.js 已移除保養區間欄位');
  assertTrue(custFormSrc.includes("SERVICE_LEVEL_OPTIONS[0] || ''"),
    'customer-form.js 服務等級預設值改為 SERVICE_LEVEL_OPTIONS[0]');

  // 註：「generateDueMaintenanceCases 改吃服務等級」一節（原以每年保養次數換算到期間隔月數）
  // 已隨保養單改為區間驅動產生而移除；新契約 generateDueMaintenanceCases(customers, stores,
  // existingCases, referenceMonth) 的行為改由 scripts/verify-maintenance-period-column.mjs
  // 的「Section 1｜generateDueMaintenanceCases（區間驅動）」涵蓋。

  console.log('\nSection 6｜app.js 的 serviceLevels 傳遞範圍');
  const appSrc6 = readFileSync(join(ROOT, 'src/app.js'), 'utf8');
  // 註：generateDueMaintenanceCases 已改為區間驅動，開單月份不再由 serviceLevels 決定，
  // 詳見 scripts/verify-maintenance-period-column.mjs；末位的 serviceLevels 參數只用來
  // 推導門市未設定「是否保養」時的預設值（見 StoreUtils.getStoreMaintenanceFlag）。
  // 取該元件自己的 props 區塊（到對應的收尾 `});` 為止），避免溢出到下一個 case
  function propsBlockOf(comp) {
    const i = appSrc6.indexOf('h(' + comp + ', {');
    if (i === -1) return null;
    const end = appSrc6.indexOf('\n        });', i);
    return end === -1 ? appSrc6.slice(i) : appSrc6.slice(i, end);
  }
  // 保養區間改由客戶持有後，保養檢視／案件排程都改以 customerName 取區間，
  // 不再需要 serviceLevels；ScheduleUtils 已完全不碰 ServiceLevelUtils，
  // 只把 store.serviceLevel 當欄位複製到案件上。
  // MaintenanceList 是例外：它要靠 serviceLevels 推導門市未設定的「是否保養」預設值，
  // 才知道哪些門市不該列示，故列在下方「仍真正使用」那組。
  for (const comp of ['MaintenanceViewEditForm', 'CaseArrangement']) {
    const block = propsBlockOf(comp);
    assertTrue(block !== null && !block.includes('serviceLevels'),
      `app.js 的 ${comp} 呼叫不再傳 serviceLevels`);
  }
  // 仍真正使用 serviceLevels 的元件必須繼續拿到它
  for (const comp of ['CaseReviewList', 'MaintenanceAllocation', 'ServiceLevelList', 'CustomerList', 'MaintenanceList']) {
    const block = propsBlockOf(comp);
    assertTrue(block !== null && block.includes('serviceLevels'),
      `app.js 的 ${comp} 呼叫仍傳 serviceLevels`);
  }

  console.log('\nSection 7｜allocation utils');
  assertEq(await evaluate('typeof MaintenanceAllocationUtils.ALLOCATABLE_SERVICE_LEVELS'), 'undefined',
    'ALLOCATABLE_SERVICE_LEVELS 已移除');
  assertEq(await evaluate('typeof MaintenanceAllocationUtils.getVisitIndexOptions'), 'undefined',
    'getVisitIndexOptions 已移除');
  assertEq(await evaluate(`MaintenanceAllocationUtils.isAllocatableServiceLevel('C 保養(一年一次)', INITIAL_SERVICE_LEVELS)`),
    true, 'C 納入保養分配');
  assertEq(await evaluate(`MaintenanceAllocationUtils.isAllocatableServiceLevel('D 維修(無簽約客戶)', INITIAL_SERVICE_LEVELS)`),
    false, 'D 不納入保養分配');

  const rowShape = await evaluate(`(function(){
    var assignee = { id: 'A1', name: 'A組', districts: ['台北市信義區'] };
    var customers = [{ id: 'C1', name: '甲', serviceLevel: 'B 保修(一年兩次)' }];
    var stores = [
      { id: 'S1', customerName: '甲', storeName: '甲一', serviceLevel: 'B 保修(一年兩次)',
        storeStatus: '正常營業', companyCity: '台北市', companyDistrict: '信義區' },
      { id: 'S2', customerName: '甲', storeName: '甲二', serviceLevel: 'B 保修(一年兩次)',
        storeStatus: '正常營業', companyCity: '台北市', companyDistrict: '信義區' },
      { id: 'S3', customerName: '甲', storeName: '甲三', serviceLevel: 'D 維修(無簽約客戶)',
        storeStatus: '正常營業', companyCity: '台北市', companyDistrict: '信義區' }
    ];
    return MaintenanceAllocationUtils.getCustomerRows(assignee, customers, stores, INITIAL_SERVICE_LEVELS);
  })()`);
  assertDeep(rowShape, [{ customerName: '甲', storeCount: 2, serviceLevel: 'B 保修(一年兩次)' }],
    'getCustomerRows 回傳 serviceLevel 且濾掉 D 等級門市');

  const mismatchRows = await evaluate(`(function(){
    // 客戶服務等級已改為 D（0 次、不納入保養分配），但門市尚未重新儲存，
    // 仍帶著舊的 B 等級（納入分配）。修正前：getCoveredStoresForAssignee 以門市
    // 等級篩選會收錄該門市，getCustomerRows 卻以客戶等級（D，0 區間）產生列，
    // 導致「有列但點哪個月都不在區間內」的死列。修正後：整列應直接不出現。
    var assignee = { id: 'A1', name: 'A組', districts: ['台北市信義區'] };
    var customers = [{ id: 'C1', name: '甲', serviceLevel: 'D 維修(無簽約客戶)' }];
    var stores = [
      { id: 'S1', customerName: '甲', storeName: '甲一', serviceLevel: 'B 保修(一年兩次)',
        storeStatus: '正常營業', companyCity: '台北市', companyDistrict: '信義區' }
    ];
    return MaintenanceAllocationUtils.getCustomerRows(assignee, customers, stores, INITIAL_SERVICE_LEVELS);
  })()`);
  assertDeep(mismatchRows, [],
    '客戶服務等級（不納入分配）與門市服務等級（納入分配）不一致時，不產生死列');

  // 注意：AssigneeUtils.getPerformanceAssignee 讀的是單數欄位
  // record.performanceAssignee（沒有則退回 record.assignee），
  // 不是陣列欄位 performanceAssignees，故 fixture 改用單數欄位，
  // 才能驗證到 countCompletedStores 真的有依人員過濾。
  const completed = await evaluate(`(function(){
    var year = new Date().getFullYear();
    var cases = [
      { id: 'M1', customerName: '甲', storeName: '甲一', isClosed: true,
        completionDate: year + '-02-10', performanceAssignee: 'A組' },
      { id: 'M2', customerName: '甲', storeName: '甲一', isClosed: true,
        completionDate: year + '-03-01', performanceAssignee: 'A組' },
      { id: 'M3', customerName: '甲', storeName: '甲二', isClosed: true,
        planDate: year + '-01-15', performanceAssignee: 'A組' },
      { id: 'M4', customerName: '甲', storeName: '甲三', isClosed: false,
        completionDate: year + '-02-10', performanceAssignee: 'A組' },
      { id: 'M5', customerName: '甲', storeName: '甲四', isClosed: true,
        completionDate: year + '-05-10', performanceAssignee: 'A組' },
      { id: 'M6', customerName: '乙', storeName: '乙一', isClosed: true,
        completionDate: year + '-02-10', performanceAssignee: 'A組' },
      { id: 'M7', customerName: '甲', storeName: '甲五', isClosed: true,
        completionDate: year + '-02-10', performanceAssignee: 'B組' },
      { id: 'M8', customerName: '甲', storeName: '甲六', isClosed: true,
        completionDate: (year - 1) + '-02-10', performanceAssignee: 'A組' }
    ];
    var period = { visitIndex: 1, startMonth: 1, endMonth: 3 };
    return MaintenanceAllocationUtils.countCompletedStores(cases, 'A組', '甲', period, year);
  })()`);
  assertEq(completed, 2, 'countCompletedStores 計不重複門市（甲一、甲二），排除未結案／他客戶／他人員／跨年／區間外');

  console.log('\nSection 7｜保養分配表格');
  // src/core/searchable-select.js 攔截了 h('select', ...)：保養分配的「組別」
  // 下拉沒有原生 <select>，也沒有設定 name prop，改用
  // input[role="combobox"]（唯一一個）以 mousedown 開啟選單、
  // 選項按鈕（portal 到 document.body 的 .searchable-select__menu--portal 內）
  // 以 mousedown 選取，見 Section 3 對此機制的說明。另外 stateful() 是以
  // parentNode.replaceChild 換掉整棵樹，故用一個固定的容器 div 承接元件節點，
  // 之後一律透過容器查詢，才能拿到 rerender 後的最新 DOM。
  // 保養分配改為「每年一份」後，工具列多了一個「年度」下拉排在組別之前，
  // 故組別是容器內第 2 個 combobox（index 1），不能再取第 1 個。
  await evaluate(`
    window.__chooseAllocAssignee = function (container, label) {
      var input = container.querySelectorAll('input[role="combobox"]')[1];
      if (!input) throw new Error('__chooseAllocAssignee: 找不到組別下拉');
      input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      // 選項按鈕在 label 之外還會帶 hint（組別的組員名單），textContent 會是
      // 「A組王小明、陳志豪」，不能拿整顆按鈕的文字去等值比對組別名稱。
      var btns = Array.prototype.filter.call(
        document.querySelectorAll('.searchable-select__menu--portal .searchable-select__option'),
        function (b) {
          var labelEl = b.querySelector('.searchable-select__option-label');
          return (labelEl ? labelEl.textContent : b.textContent).trim() === label;
        }
      );
      if (!btns.length) throw new Error('__chooseAllocAssignee: 找不到選項 ' + label);
      btns[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    };
    'ok'`);

  const grid = await evaluate(`(function(){
    var assignees = [{ id: 'A1', name: 'A組', districts: ['台北市信義區'] }];
    var customers = [{ id: 'C1', name: '甲', serviceLevel: 'B 保修(一年兩次)', periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 6 },
      { visitIndex: 2, startMonth: 7, endMonth: 12 }
    ] }];
    var stores = [
      { id: 'S1', customerName: '甲', storeName: '甲一', serviceLevel: 'B 保修(一年兩次)',
        storeStatus: '正常營業', companyCity: '台北市', companyDistrict: '信義區' },
      { id: 'S2', customerName: '甲', storeName: '甲二', serviceLevel: 'B 保修(一年兩次)',
        storeStatus: '正常營業', companyCity: '台北市', companyDistrict: '信義區' }
    ];
    var year = new Date().getFullYear();
    var maint = [{ id: 'M1', customerName: '甲', storeName: '甲一', isClosed: true,
      completionDate: year + '-02-10', performanceAssignee: 'A組' }];
    window.__allocToasts = [];
    var container = document.createElement('div');
    document.body.appendChild(container);
    // 網格是從「年度快照」長出來的，元件沒有年度就只會顯示空狀態；
    // 這裡用同一份 fixture 現拍一張當年度快照餵進去。
    var snapshot = MaintenanceAllocationUtils.buildYearSnapshot(
      year, assignees, customers, stores, INITIAL_SERVICE_LEVELS, year + '-01-01'
    );
    container.appendChild(MaintenanceAllocation({
      assignees: assignees, customers: customers, stores: stores,
      maintenanceCases: maint, serviceLevels: INITIAL_SERVICE_LEVELS,
      maintenanceAllocations: [], setMaintenanceAllocations: function () {},
      maintenanceAllocationYears: [snapshot], setMaintenanceAllocationYears: function () {},
      showToast: function (m, k) { window.__allocToasts.push([m, k || 'success']); }
    }));
    window.__chooseAllocAssignee(container, 'A組');
    var row = container.querySelector('tbody tr');
    var badge = row.querySelector('span').textContent.trim();
    var tds = row.querySelectorAll('td');
    var monthCells = Array.prototype.slice.call(tds, 2);
    var out = {
      badge: badge,
      firstPeriodHeader: monthCells[0].textContent.trim(),
      secondPeriodHeader: monthCells[6].textContent.trim(),
      midCellHasHeader: monthCells[1].textContent.indexOf('第') !== -1
    };
    // 點第 2 月（在區間內）應開啟 Modal
    monthCells[1].querySelector('div').click();
    out.modalOpened = container.textContent.indexOf('編輯保養分配') !== -1;
    // 原本是數整個容器的 combobox 數（=1，只有網格的組別下拉）；年度下拉加入後
    // 容器內固定有 2 個，數字會失去意義，故改為直接量 Modal 內的下拉數（應為 0）。
    var overlay = container.querySelector('.app-modal-overlay');
    out.modalComboCount = overlay ? overlay.querySelectorAll('input[role="combobox"]').length : -1;
    out.modalHasVisitLabel = overlay ? overlay.textContent.indexOf('保養次數') !== -1 : false;
    container.remove();
    return out;
  })()`);
  assertTrue(grid.badge === 'B 保修(一年兩次)', '列首 badge 顯示服務等級', grid.badge);
  assertTrue(grid.firstPeriodHeader.indexOf('第1次 1/2') === 0,
    '第 1 區間首欄顯示「第1次 1/2」', grid.firstPeriodHeader);
  assertTrue(grid.secondPeriodHeader.indexOf('第2次 0/2') === 0,
    '第 2 區間首欄顯示「第2次 0/2」', grid.secondPeriodHeader);
  assertEq(grid.midCellHasHeader, false, '非區間首欄不顯示小字標頭');
  assertEq(grid.modalOpened, true, '點區間內月份會開啟編輯 Modal');
  assertEq(grid.modalHasVisitLabel, true, 'Modal 仍顯示「保養次數」欄位');
  assertEq(grid.modalComboCount, 0, 'Modal 內沒有任何下拉（保養次數已改為唯讀文字）');

  const outsideClick = await evaluate(`(function(){
    var assignees = [{ id: 'A1', name: 'A組', districts: ['台北市信義區'] }];
    var customers = [{ id: 'C1', name: '甲', serviceLevel: 'E 半年檔', periods: [
      { visitIndex: 1, startMonth: 1, endMonth: 6 }
    ] }];
    var levels = [{ id: 'SLE', name: 'E 半年檔', maintenanceCount: 1, countsBonusPoints: false }];
    var stores = [{ id: 'S1', customerName: '甲', storeName: '甲一', serviceLevel: 'E 半年檔',
      storeStatus: '正常營業', companyCity: '台北市', companyDistrict: '信義區' }];
    window.__allocToasts = [];
    var container = document.createElement('div');
    document.body.appendChild(container);
    var snapshot = MaintenanceAllocationUtils.buildYearSnapshot(
      new Date().getFullYear(), assignees, customers, stores, levels, '2026-01-01'
    );
    container.appendChild(MaintenanceAllocation({
      assignees: assignees, customers: customers, stores: stores,
      maintenanceCases: [], serviceLevels: levels,
      maintenanceAllocations: [], setMaintenanceAllocations: function () {},
      maintenanceAllocationYears: [snapshot], setMaintenanceAllocationYears: function () {},
      showToast: function (m, k) { window.__allocToasts.push([m, k || 'success']); }
    }));
    window.__chooseAllocAssignee(container, 'A組');
    var tds = container.querySelector('tbody tr').querySelectorAll('td');
    Array.prototype.slice.call(tds, 2)[11].querySelector('div').click();
    var out = { toasts: window.__allocToasts,
      modalOpened: container.textContent.indexOf('編輯保養分配') !== -1 };
    container.remove();
    return out;
  })()`);
  assertEq(outsideClick.modalOpened, false, '點區間外月份不開 Modal');
  // 區間現在由年度快照提供，文案也隨之從「該客戶」改為「該年度」
  assertDeep(outsideClick.toasts, [['此月份不在該年度的保養區間內', 'error']],
    '點區間外月份跳出提示 toast');

  console.log('\nSection 7｜app.js 已往下傳 maintenanceCases / serviceLevels');
  const appSrc7 = readFileSync(join(ROOT, 'src/app.js'), 'utf8');
  const allocIdx = appSrc7.indexOf('MaintenanceAllocation, {');
  assertTrue(appSrc7.slice(allocIdx, allocIdx + 500).includes('maintenanceCases'),
    'app.js 的 MaintenanceAllocation 呼叫含 maintenanceCases');
  assertTrue(appSrc7.slice(allocIdx, allocIdx + 500).includes('serviceLevels'),
    'app.js 的 MaintenanceAllocation 呼叫含 serviceLevels');

  console.log('\nSection 8｜端到端接線');

  console.log('\nSection 8｜客戶表單的服務等級下拉來自服務等級管理');
  // 讀取選單內容時，選完（甚至選回原值）都會關閉 portal 選單，
  // 避免遺留在 document.body 上影響後續斷言；container.remove() 移除的只是
  // 表單本身，選單 portal 是另外 appendChild 到 document.body 的節點。
  const custDefaults = await evaluate(`(function(){
    var container = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(CustomerForm({
      cases: [], setCases: function(){}, setView: function(){}, showToast: function(){}
    }));
    var input = container.querySelector('[name="serviceLevel"]');
    var defaultValue = input.value;
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    var labels = Array.prototype.map.call(
      document.querySelectorAll('.searchable-select__menu--portal .searchable-select__option'),
      function (b) { return b.textContent.trim(); }
    );
    window.__chooseOption(container, 'serviceLevel', defaultValue);
    container.remove();
    return { defaultValue: defaultValue, labels: labels };
  })()`);
  const seedLevelNames = ['A 保修(一年四次)', 'B 保修(一年兩次)', 'C 保養(一年一次)', 'D 維修(無簽約客戶)'];
  assertEq(custDefaults.defaultValue, seedLevelNames[0],
    'CustomerForm 服務等級預設值為 SERVICE_LEVEL_OPTIONS[0]');
  assertDeep(custDefaults.labels, seedLevelNames,
    'CustomerForm 服務等級下拉選項與 SERVICE_LEVEL_OPTIONS 四筆同序');

  console.log('\nSection 8｜服務等級下拉為即時連動（非巧合寫死）');
  const liveLinkLabels = await evaluate(`(function(){
    var extended = INITIAL_SERVICE_LEVELS.concat([
      { id: 'SLZ', name: 'Z 測試等級(端到端)', maintenanceCount: 1, countsBonusPoints: false }
    ]);
    ServiceLevelUtils.syncServiceLevelOptions(extended);
    var container = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(CustomerForm({
      cases: [], setCases: function(){}, setView: function(){}, showToast: function(){}
    }));
    var input = container.querySelector('[name="serviceLevel"]');
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    var labels = Array.prototype.map.call(
      document.querySelectorAll('.searchable-select__menu--portal .searchable-select__option'),
      function (b) { return b.textContent.trim(); }
    );
    window.__chooseOption(container, 'serviceLevel', input.value);
    container.remove();
    // 還原為種子四筆，避免污染本檔案後續（若有）或其他驗證腳本共用的頁面狀態。
    ServiceLevelUtils.syncServiceLevelOptions(INITIAL_SERVICE_LEVELS);
    return labels;
  })()`);
  assertTrue(liveLinkLabels.indexOf('Z 測試等級(端到端)') !== -1,
    '新增一筆服務等級後，CustomerForm 下拉即時多出該選項（證明非寫死清單）');
  assertDeep(await evaluate('SERVICE_LEVEL_OPTIONS'), seedLevelNames,
    'SERVICE_LEVEL_OPTIONS 已還原為種子四筆，不影響後續斷言');

  console.log('\nSection 8｜叫修單選客戶時自動帶入服務等級（含 D-fallback 已移除的驗證）');
  const autoFillCase = await evaluate(`(function(){
    function readServiceLevelDisplay(container) {
      var labels = container.querySelectorAll('label');
      for (var i = 0; i < labels.length; i++) {
        if (labels[i].textContent.trim() === '服務等級') {
          return labels[i].parentElement.querySelector('input').value;
        }
      }
      return null;
    }
    var customers = [
      { id: 'CX1', name: '甲測試客戶', serviceLevel: 'B 保修(一年兩次)' },
      { id: 'CX2', name: '乙測試客戶', serviceLevel: '' }
    ];
    var container = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(AddCaseForm({
      cases: [], setCases: function(){}, stores: [], customers: customers,
      setView: function(){}, showToast: function(){}, currentOperatorName: '測試員'
    }));
    var out = { beforeSelect: readServiceLevelDisplay(container) };
    window.__chooseOption(container, 'customerName', '甲測試客戶');
    out.withLevel = readServiceLevelDisplay(container);
    window.__chooseOption(container, 'customerName', '乙測試客戶');
    out.withBlankLevel = readServiceLevelDisplay(container);
    container.remove();
    return out;
  })()`);
  assertEq(autoFillCase.beforeSelect, '—',
    '尚未選擇客戶前，服務等級欄位顯示「—」（空白初始值），不再寫死 D 維修(無簽約客戶)');
  assertEq(autoFillCase.withLevel, 'B 保修(一年兩次)',
    '選擇服務等級為 B 的客戶後，服務等級欄位自動帶入 B 保修(一年兩次)');
  assertEq(autoFillCase.withBlankLevel, '—',
    '選擇服務等級為空字串的客戶後，服務等級欄位顯示「—」（空白），而非任何等級名稱');
  assertTrue(autoFillCase.withBlankLevel !== 'D 維修(無簽約客戶)',
    '選擇服務等級為空字串的客戶後，不再退回硬編碼的 D 維修(無簽約客戶)（Task 5 移除的 OR-fallback）');

  console.log('\nSection 8｜報表的增額積分欄有值');
  const perfStats = await evaluate(`(function(){
    var quarter = PerformanceUtils.getQuarterRange(new Date());
    var assignees = [{ id: 'A1', name: 'A組' }, { id: 'B1', name: 'B組' }];
    var cases = [
      // A組：countsBonusPoints=true 的 D 級，無增額設備仍應計分
      { id: 'PD1', customerName: '甲', storeName: '甲一', serviceLevel: 'D 維修(無簽約客戶)',
        workCategory: '一般叫修', isPerformanceIncluded: true, completionDate: quarter.start,
        performanceAssignee: 'A組', serviceItems: [{ id: 'SI1', equipment: null,
          actualReason: '', processRecords: [{ points: 8, qty: 1 }] }] },
      // B組：countsBonusPoints=false 的 A 級 + 一般設備，不應計分
      { id: 'PA1', customerName: '乙', storeName: '乙一', serviceLevel: 'A 保修(一年四次)',
        workCategory: '一般叫修', isPerformanceIncluded: true, completionDate: quarter.start,
        performanceAssignee: 'B組', serviceItems: [{ id: 'SI1',
          equipment: { model: 'M-1', equipmentLevel: '一般設備' },
          actualReason: '', processRecords: [{ points: 5, qty: 1 }] }] },
      // B組：countsBonusPoints=false 的 A 級 + 增額設備，應計分
      { id: 'PA2', customerName: '乙', storeName: '乙一', serviceLevel: 'A 保修(一年四次)',
        workCategory: '一般叫修', isPerformanceIncluded: true, completionDate: quarter.start,
        performanceAssignee: 'B組', serviceItems: [{ id: 'SI1',
          equipment: { model: 'M-1', equipmentLevel: '增額設備' },
          actualReason: '', processRecords: [{ points: 6, qty: 1 }] }] }
    ];
    var container = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(CasePerformanceStats({
      cases: cases, maintenanceCases: [], assignees: assignees,
      maintenanceAllocations: [], stores: [], performanceAreas: [],
      serviceLevels: INITIAL_SERVICE_LEVELS
    }));
    function bonusPointsForCard(name) {
      var cards = container.querySelectorAll('.rounded-xl');
      for (var i = 0; i < cards.length; i++) {
        var titleEl = cards[i].querySelector('span[title]');
        if (titleEl && titleEl.textContent.trim() === name) {
          var m = cards[i].textContent.match(/增額積分(\\d+(\\.\\d+)?)/);
          return m ? m[1] : null;
        }
      }
      return null;
    }
    var out = { a: bonusPointsForCard('A組'), b: bonusPointsForCard('B組') };
    container.remove();
    return out;
  })()`);
  assertEq(perfStats.a, '8',
    'countsBonusPoints=true 的服務等級（D），無增額設備仍計入增額積分（A組 = 8）');
  assertEq(perfStats.b, '6',
    'countsBonusPoints=false 的服務等級（A），只有增額設備的案件計分，一般設備的 5 分被排除（B組 = 6，非 11）');

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
