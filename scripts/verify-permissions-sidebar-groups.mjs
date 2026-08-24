#!/usr/bin/env node
/**
 * 系統權限側選單分群：UI 驗證。
 * 啟動 headless Chrome 載入 index.html，切到「系統權限」後斷言側選單的群組結構、
 * 展開／收合行為，以及點子項會切到對應畫面。
 * 參考 scripts/verify-multi-select-groups-ui.mjs 的 CDP 連線流程。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9341);

if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

let passed = 0, failed = 0;
const pass = (n, d) => { passed++; console.log(`  ✓ ${n}${d ? ` — ${d}` : ''}`); };
const fail = (n, d) => { failed++; console.error(`  ✗ ${n}${d ? ` — ${d}` : ''}`); };
function assertEq(actual, expected, name) {
  if (actual === expected) pass(name, JSON.stringify(actual));
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertJson(actual, expected, name) {
  assertEq(JSON.stringify(actual), JSON.stringify(expected), name);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-perm-sidebar-profile',
  'about:blank'
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const consoleErrors = [];

// 與 verify-multi-select-groups-ui.mjs 同樣的看門狗：頁面內 setTimeout 回呼若拋例外，
// 該 Promise 永不 settle，沒有逾時就會讓 Node 永遠卡住（不會有斷言、退出碼、Chrome 清理）。
const EVAL_TIMEOUT_MS = Number(process.env.EVAL_TIMEOUT_MS || 8000);

function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}

async function evaluate(expression, timeoutMs = EVAL_TIMEOUT_MS) {
  const call = send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true
  });
  const r = await Promise.race([
    call,
    sleep(timeoutMs).then(() => {
      throw new Error(
        `逾時 ${timeoutMs}ms 無回應（可能是頁面內某個 setTimeout 回呼拋出例外，導致該 Promise 永遠不會 resolve）— 運算式開頭：${expression.slice(0, 120)}`
      );
    })
  ]);
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
  }
  return r.result.value;
}

async function evaluateAsync(expression) {
  await evaluate(`window.__pending = (${expression}); 'queued'`);
  return evaluate('window.__pending');
}

// 側選單的群組標題與子項共用 <button>，靠 DOM 位置區分：
// 群組標題是 nav > div > button（第一個子節點），子項在其後的 div 內。
const HELPERS = `
  window.__sidebarNav = function () {
    return document.querySelector('.app-sidebar nav');
  };
  window.__readSidebar = function () {
    var nav = window.__sidebarNav();
    return Array.prototype.map.call(nav.children, function (group) {
      var head = group.querySelector(':scope > button');
      var body = group.querySelector(':scope > div');
      return {
        title: head.textContent.trim(),
        expanded: !!body,
        children: body
          ? Array.prototype.map.call(body.querySelectorAll('button'), function (b) {
              return b.textContent.trim();
            })
          : []
      };
    });
  };
  window.__clickGroup = function (title) {
    var nav = window.__sidebarNav();
    var found = Array.prototype.filter.call(nav.children, function (group) {
      return group.querySelector(':scope > button').textContent.trim() === title;
    })[0];
    if (!found) throw new Error('找不到群組：' + title);
    found.querySelector(':scope > button').click();
  };
  window.__clickChild = function (label) {
    var nav = window.__sidebarNav();
    var btn = Array.prototype.filter.call(nav.querySelectorAll('div button'), function (b) {
      return b.textContent.trim() === label;
    })[0];
    if (!btn) throw new Error('找不到子項（可能所屬群組是收合的）：' + label);
    btn.click();
  };
  window.__clickTopMenu = function (label) {
    var btn = Array.prototype.filter.call(document.querySelectorAll('header button'), function (b) {
      return b.textContent.trim() === label;
    })[0];
    if (!btn) throw new Error('找不到主選單：' + label);
    btn.click();
  };
`;

// 「車輛管理」於「新增車輛管理列表與新增表單」後加入，歸在人員與權限底下。
const EXPECTED_TREE = [
  { title: '人員與權限', expanded: true, children: ['帳號管理', '組別管理', '車輛管理'] },
  { title: '基礎資料設定', expanded: true, children: ['服務等級管理', '處理方式與積分管理', '設備分類管理', '績效區域管理'] },
  { title: '保養作業', expanded: true, children: ['保養分配'] }
];

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
  // localStorage 會記住上次停留的主選單／子選單，先清掉才能從乾淨狀態驗證預設值。
  await send('Page.navigate', { url: `file://${ROOT}/index.html` });
  await sleep(2000);
  await evaluate('localStorage.clear(); "cleared"');
  await send('Page.navigate', { url: `file://${ROOT}/index.html` });
  await sleep(4000);

  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');
  await evaluate(HELPERS + "'ok'");

  console.log('\n1. 切到系統權限後，側選單呈現三個群組且預設展開');
  const tree = await evaluateAsync(`(function () {
    window.__clickTopMenu('系統權限');
    return new Promise(function (resolve) {
      setTimeout(function () { resolve(window.__readSidebar()); }, 120);
    });
  })()`);
  assertJson(tree, EXPECTED_TREE, '三個群組、順序與子項皆符合設計');

  console.log('\n2. 點群組標題可收合，再點可展開');
  const toggled = await evaluateAsync(`(function () {
    window.__clickGroup('基礎資料設定');
    return new Promise(function (resolve) {
      setTimeout(function () {
        var collapsed = window.__readSidebar();
        window.__clickGroup('基礎資料設定');
        setTimeout(function () {
          resolve({ collapsed: collapsed, reopened: window.__readSidebar() });
        }, 120);
      }, 120);
    });
  })()`);
  assertJson(
    toggled.collapsed.map(g => ({ title: g.title, expanded: g.expanded })),
    [
      { title: '人員與權限', expanded: true },
      { title: '基礎資料設定', expanded: false },
      { title: '保養作業', expanded: true }
    ],
    '只收合被點的群組，其他群組不受影響'
  );
  assertJson(toggled.reopened, EXPECTED_TREE, '再點一次回到全展開');

  console.log('\n3. 點子項會切到對應畫面');
  const navigated = await evaluateAsync(`(function () {
    window.__clickChild('保養分配');
    return new Promise(function (resolve) {
      setTimeout(function () {
        var active = Array.prototype.filter.call(
          window.__sidebarNav().querySelectorAll('div button'),
          function (b) { return b.className.indexOf('bg-blue-100/50') !== -1; }
        ).map(function (b) { return b.textContent.trim(); });
        resolve({
          active: active,
          stored: localStorage.getItem('iess:permissionsSubMenu'),
          hasGrid: document.body.textContent.indexOf('保養分配') !== -1
        });
      }, 300);
    });
  })()`);
  assertJson(navigated.active, ['保養分配'], '被點的子項標為 active，且只有一個');
  assertEq(navigated.stored, '保養分配', 'localStorage 存的仍是原本的葉節點名稱，不需資料遷移');
  assertEq(navigated.hasGrid, true, '主畫面切換到保養分配');

  console.log('\n4. 切回戰情室時，戰情室的群組仍是展開的');
  const warroom = await evaluateAsync(`(function () {
    window.__clickTopMenu('戰情室');
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(window.__readSidebar().map(function (g) {
          return { title: g.title, expanded: g.expanded };
        }));
      }, 200);
    });
  })()`);
  assertJson(
    warroom,
    [
      { title: '維修服務', expanded: true },
      { title: '工程服務', expanded: true },
      { title: '客戶建檔', expanded: true }
    ],
    '共用 expandedSidebar 不會讓戰情室的群組被系統權限的展開狀態影響'
  );

  console.log('\n5. 帳號權限設定的 PERMISSION_TREE 與側選單同構');
  const permTree = await evaluate(`(function () {
    var top = PERMISSION_TREE.find(function (n) { return n.id === '系統權限'; });
    return top.children.map(function (g) {
      return { title: g.id, children: g.children.slice() };
    });
  })()`);
  assertJson(
    permTree,
    EXPECTED_TREE.map(g => ({ title: g.title, children: g.children })),
    'PERMISSION_TREE 的系統權限分群與側選單完全一致'
  );
  const permLeaves = await evaluate(`(function () {
    var top = PERMISSION_TREE.find(function (n) { return n.id === '系統權限'; });
    var leaves = [];
    top.children.forEach(function (g) { leaves = leaves.concat(g.children); });
    return {
      missing: leaves.filter(function (fn) { return PERMISSION_FUNCTIONS.indexOf(fn) === -1; }),
      count: leaves.length
    };
  })()`);
  assertJson(permLeaves.missing, [], '每個葉節點都在 PERMISSION_FUNCTIONS 內（權限勾選才會生效）');
  assertEq(permLeaves.count, 8, '系統權限底下共 8 個功能，依三個群組分群');

  console.log('\n6. 權限面板渲染出巢狀群組列，且群組勾選會連動底下功能');
  const panel = await evaluateAsync(`(function () {
    window.__perms = AccountUtils.createEmptyPermissions();
    var host = document.getElementById('perm-host');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'perm-host';
    document.body.appendChild(host);
    host.appendChild(AccountPermissionsPanel({
      permissions: window.__perms,
      togglePermission: function () {},
      toggleGroupPermission: function (node, op) {
        AccountPermissionHelpers.collectLeafFunctions(node).forEach(function (fn) {
          window.__perms[fn][op] = true;
        });
      },
      toggleSelectAll: function () {}
    }));
    var rows = Array.prototype.map.call(host.querySelectorAll('tbody tr'), function (tr) {
      return tr.querySelector('td').textContent.trim();
    });
    // 找到「基礎資料設定」那一列的群組 checkbox（檢視欄）並點下去
    var groupRow = Array.prototype.filter.call(host.querySelectorAll('tbody tr'), function (tr) {
      return tr.querySelector('td').textContent.trim() === '基礎資料設定';
    })[0];
    groupRow.querySelectorAll('input[type=checkbox]')[0].click();
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve({
          rows: rows,
          viewAfter: ['服務等級管理', '處理方式與積分管理', '設備分類管理', '績效區域管理', '帳號管理']
            .map(function (fn) { return window.__perms[fn].view; })
        });
      }, 80);
    });
  })()`);
  assertJson(
    panel.rows.slice(panel.rows.indexOf('系統權限')),
    [
      '系統權限',
      '人員與權限', '帳號管理', '組別管理', '車輛管理',
      '基礎資料設定', '服務等級管理', '處理方式與積分管理', '設備分類管理', '績效區域管理',
      '保養作業', '保養分配'
    ],
    '權限表格的系統權限段落照新分群展開為三層'
  );
  assertJson(
    panel.viewAfter,
    [true, true, true, true, false],
    '勾選「基礎資料設定」的檢視會連動其四個功能，不波及其他群組'
  );

  assertEq(consoleErrors.length, 0, '互動過程無 JS 錯誤');
} catch (err) {
  fail('腳本執行例外', err.message);
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
