#!/usr/bin/env node
/**
 * MultiSelect 群組選項：UI 驗證。
 * 啟動 headless Chrome 載入 index.html，直接掛載 IESS.MultiSelect 後斷言 DOM。
 * 參考 scripts/verify-data-retrieval-multi-filter-ui.mjs 的 CDP 連線流程。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9336);

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
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}
function assertJson(actual, expected, name) {
  assertEq(JSON.stringify(actual), JSON.stringify(expected), name);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-ms-group-profile',
  'about:blank'
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const consoleErrors = [];

// Bound how long any single CDP round trip may take. Page-side code below runs
// inside setTimeout callbacks (e.g. clicking `opts[N]` for some hardcoded N); if a
// selector or index is ever wrong, the callback throws, the *page-side* Promise it's
// building never settles, and a plain `await` on it would hang the Node process
// forever (no assertion, no exit code, no Chrome cleanup). This watchdog turns that
// into a normal thrown Error, which the outer try/catch below converts into a failed
// assertion — the script still exits 1 and still kills Chrome.
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

// Headless Chrome's CDP can garbage-collect a Promise that's only reachable via the
// Runtime.evaluate return value before it settles ("Promise was collected"), especially
// across chained setTimeout ticks. Pin the promise to a global first so it stays
// strongly referenced, then await it in a second round trip.
async function evaluateAsync(expression) {
  await evaluate(`window.__pending = (${expression}); 'queued'`);
  return evaluate('window.__pending');
}

const MOUNT = `
  window.__groups = [
    { group: '甲客戶', options: [
      { value: '甲客戶\\u0001甲一店', label: '甲一店', chipLabel: '甲客戶 · 甲一店' },
      { value: '甲客戶\\u0001甲二店', label: '甲二店', chipLabel: '甲客戶 · 甲二店' }
    ] },
    { group: '乙客戶', options: [
      { value: '乙客戶\\u0001甲一店', label: '甲一店', chipLabel: '乙客戶 · 甲一店' }
    ] },
    { group: '丙客戶', options: [] }
  ];
  window.__selected = [];
  // window.__renderInto 只負責「用目前的 window.__selected 重繪」，不重置選取狀態；
  // onChange 呼叫它來反映剛剛的勾選結果。window.__mount 才是每個測試場景的進入點，
  // 由它負責重置成全新的空選取狀態。
  window.__renderInto = function (options) {
    var host = document.getElementById('ms-host');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'ms-host';
    document.body.appendChild(host);
    host.appendChild(IESS.MultiSelect({
      id: 'ms-test',
      options: options,
      value: window.__selected,
      onChange: function (next) {
        window.__selected = next;
        window.__renderInto(options);
      },
      placeholder: '全部'
    }));
    return host;
  };
  window.__mount = function (options) {
    // 每個測試步驟都整批換掉 ms-host（模擬切換案件類型時整批換掉 filter 面板），
    // 而非同一元件實例的 rerender；依 MultiSelect.closeAll 的文件用途，
    // 呼叫端在卸載整個面板前需主動清理，否則上一步驟殘留的展開狀態
    // （openId 依 id 跨重掛載持續存在，這是元件刻意設計的行為）
    // 會被下一步驟的第一次 click 誤判成「收合」而非「展開」。
    IESS.MultiSelect.closeAll();
    window.__selected = [];
    return window.__renderInto(options);
  };
`;

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
  await evaluate(MOUNT + "'ok'");

  console.log('\n1. 群組標題渲染且不可點選');
  const menu = await evaluateAsync(`(function () {
    var host = window.__mount(window.__groups);
    host.querySelector('.multi-select__control').click();
    return new Promise(function (resolve) {
      setTimeout(function () {
        var menuEl = document.querySelector('.multi-select__menu');
        resolve({
          groups: Array.prototype.map.call(
            menuEl.querySelectorAll('.multi-select__group'),
            function (g) { return g.textContent.trim(); }),
          groupButtons: menuEl.querySelectorAll('.multi-select__group button').length,
          options: Array.prototype.map.call(
            menuEl.querySelectorAll('.multi-select__option'),
            function (o) { return o.textContent.trim(); })
        });
      }, 50);
    });
  })()`);
  assertJson(menu.groups, ['甲客戶', '乙客戶'], '只渲染有選項的群組標題（丙客戶為空群組，不渲染）');
  assertEq(menu.groupButtons, 0, '群組標題內沒有 button，無法被點選');
  assertJson(menu.options, ['甲一店', '甲二店', '甲一店'], '選項顯示 label，同名門市各自出現一次');

  console.log('\n2. 勾選同名選項互不影響，chip 顯示 chipLabel');
  const chips = await evaluateAsync(`(function () {
    var host = window.__mount(window.__groups);
    host.querySelector('.multi-select__control').click();
    return new Promise(function (resolve) {
      setTimeout(function () {
        // 索引 0 = 甲客戶/甲一店（索引 2 是乙客戶底下的同名門市，此處刻意只點索引 0，
        // 用來確認勾選不會連動到另一個群組的同名選項）
        document.querySelectorAll('.multi-select__menu .multi-select__option')[0].click();
        setTimeout(function () {
          var host2 = document.getElementById('ms-host');
          resolve({
            selected: window.__selected,
            chips: Array.prototype.map.call(
              host2.querySelectorAll('.multi-select__chip'),
              function (c) { return c.textContent.replace('×', '').trim(); })
          });
        }, 80);
      }, 50);
    });
  })()`);
  assertJson(chips.selected, ['甲客戶甲一店'], '回傳的是複合 value，不是 label');
  assertJson(chips.chips, ['甲客戶 · 甲一店'], 'chip 顯示 chipLabel');

  console.log('\n3. 舊的字串陣列形態不受影響');
  const flat = await evaluateAsync(`(function () {
    var host = window.__mount(['維修', '保養']);
    host.querySelector('.multi-select__control').click();
    return new Promise(function (resolve) {
      setTimeout(function () {
        var menuEl = document.querySelector('.multi-select__menu');
        var texts = Array.prototype.map.call(
          menuEl.querySelectorAll('.multi-select__option'),
          function (o) { return o.textContent.trim(); });
        menuEl.querySelectorAll('.multi-select__option')[1].click();
        setTimeout(function () {
          resolve({
            options: texts,
            groups: menuEl.querySelectorAll('.multi-select__group').length,
            selected: window.__selected
          });
        }, 80);
      }, 50);
    });
  })()`);
  assertJson(flat.options, ['維修', '保養'], '字串陣列照舊渲染');
  assertEq(flat.groups, 0, '字串陣列不產生群組標題');
  assertJson(flat.selected, ['保養'], '字串陣列的選取值仍是字串本身');

  console.log('\n4. 全空群組顯示「無可選項目」');
  const empty = await evaluateAsync(`(function () {
    var host = window.__mount([{ group: '甲客戶', options: [] }]);
    host.querySelector('.multi-select__control').click();
    return new Promise(function (resolve) {
      setTimeout(function () {
        var menuEl = document.querySelector('.multi-select__menu');
        resolve({
          empty: menuEl.querySelectorAll('.multi-select__empty').length,
          groups: menuEl.querySelectorAll('.multi-select__group').length
        });
      }, 50);
    });
  })()`);
  assertEq(empty.empty, 1, '所有群組皆空時顯示「無可選項目」');
  assertEq(empty.groups, 0, '所有群組皆空時不渲染任何群組標題');

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
