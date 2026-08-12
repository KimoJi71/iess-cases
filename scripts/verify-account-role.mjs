#!/usr/bin/env node
/**
 * 帳號「職務」欄位：UI 驗證。
 * 啟動 headless Chrome 載入 index.html，切到「系統權限 → 帳號管理」後斷言：
 * 列表多出職務欄、關鍵字可搜職務、新增／編輯表單有職務下拉且選項正確、儲存後回寫列表。
 * 參考 scripts/verify-permissions-sidebar-groups.mjs 的 CDP 連線流程。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9347);

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
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-account-role-profile',
  'about:blank'
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const consoleErrors = [];
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
        `逾時 ${timeoutMs}ms 無回應 — 運算式開頭：${expression.slice(0, 120)}`
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

const HELPERS = `
  window.__clickTopMenu = function (label) {
    var btn = Array.prototype.filter.call(document.querySelectorAll('header button'), function (b) {
      return b.textContent.trim() === label;
    })[0];
    if (!btn) throw new Error('找不到主選單：' + label);
    btn.click();
  };
  window.__clickChild = function (label) {
    var btn = Array.prototype.filter.call(
      document.querySelectorAll('.app-sidebar nav div button'), function (b) {
        return b.textContent.trim() === label;
      })[0];
    if (!btn) throw new Error('找不到子項：' + label);
    btn.click();
  };
  window.__headers = function () {
    return Array.prototype.map.call(document.querySelectorAll('main table thead th'), function (th) {
      return th.textContent.trim();
    });
  };
  window.__rows = function () {
    return Array.prototype.map.call(document.querySelectorAll('main table tbody tr'), function (tr) {
      return Array.prototype.map.call(tr.querySelectorAll('td'), function (td) {
        return td.textContent.trim();
      });
    });
  };
  window.__setInput = function (el, value) {
    var setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  // 專案的 h() 會把 <select> 換成 searchable-select（input + 下拉選單 portal），
  // 所以職務欄位要用這組 helper 操作，而不是原生 select。
  window.__ssInput = function (label) {
    return window.__labeledField(label, '.searchable-select input');
  };
  window.__ssOpen = function (label) {
    window.__labeledField(label, '.searchable-select__toggle').click();
  };
  window.__ssMenuOptions = function () {
    return Array.prototype.map.call(
      document.querySelectorAll('.searchable-select__menu button'),
      function (b) { return b.textContent.trim(); }
    );
  };
  window.__ssPick = function (value) {
    var btn = Array.prototype.filter.call(
      document.querySelectorAll('.searchable-select__menu button'),
      function (b) { return b.textContent.trim() === value; })[0];
    if (!btn) throw new Error('下拉沒有這個選項：' + value);
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  };
  window.__labeledField = function (label, tag) {
    var wrap = Array.prototype.filter.call(document.querySelectorAll('main form div'), function (d) {
      var lb = d.querySelector(':scope > label');
      return lb && lb.textContent.trim().replace(/\\s*\\*$/, '') === label;
    })[0];
    if (!wrap) throw new Error('找不到欄位：' + label);
    return wrap.querySelector(tag);
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
  await sleep(2000);
  await evaluate('localStorage.clear(); "cleared"');
  await send('Page.navigate', { url: `file://${ROOT}/index.html` });
  await sleep(4000);

  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');
  await evaluate(HELPERS + "'ok'");

  console.log('\n1. 職務選項常數');
  assertJson(await evaluate('ACCOUNT_ROLE_OPTIONS'),
    ['課長', '副課長', '課員', '實習生'], 'ACCOUNT_ROLE_OPTIONS 為四個選項');

  console.log('\n2. 帳號列表出現職務欄，且種子資料有值');
  const list = await evaluateAsync(`(function () {
    window.__clickTopMenu('系統權限');
    return new Promise(function (resolve) {
      setTimeout(function () {
        window.__clickChild('帳號管理');
        setTimeout(function () {
          resolve({ headers: window.__headers(), rows: window.__rows() });
        }, 300);
      }, 200);
    });
  })()`);
  assertJson(list.headers, ['操作', '姓名', '帳號', 'Email', '職務', '啟用狀態'],
    '表頭在 Email 之後、啟用狀態之前插入職務');
  assertJson(list.rows.map(r => [r[1], r[4]]),
    [['系統管理員', '課長'], ['王小明', '副課長'], ['李美華', '課員']],
    '每列都顯示對應的職務');

  console.log('\n3. 關鍵字可搜職務');
  const searched = await evaluateAsync(`(function () {
    var input = document.querySelector('main input[type=text]');
    window.__setInput(input, '副課長');
    return new Promise(function (resolve) {
      setTimeout(function () {
        var btn = Array.prototype.filter.call(document.querySelectorAll('main button'), function (b) {
          return b.textContent.trim() === '搜尋';
        })[0];
        btn.click();
        setTimeout(function () {
          var placeholder = document.querySelector('main input[type=text]').placeholder;
          resolve({ rows: window.__rows(), placeholder: placeholder });
        }, 300);
      }, 100);
    });
  })()`);
  assertJson(searched.rows.map(r => r[1]), ['王小明'], '搜「副課長」只剩王小明');
  assertEq(searched.placeholder, '姓名 / 帳號 / Email / 職務', '搜尋提示文字含職務');

  console.log('\n4. 新增帳號表單有職務下拉，選項為四個職務');
  const addForm = await evaluateAsync(`(function () {
    var input = document.querySelector('main input[type=text]');
    window.__setInput(input, '');
    return new Promise(function (resolve) {
      setTimeout(function () {
        Array.prototype.filter.call(document.querySelectorAll('main button'), function (b) {
          return b.textContent.trim() === '搜尋';
        })[0].click();
        setTimeout(function () {
          document.querySelector('main button[aria-label="新增帳號"]').click();
          setTimeout(function () {
            var value = window.__ssInput('職務').value;
            var placeholder = window.__ssInput('職務').placeholder;
            window.__ssOpen('職務');
            setTimeout(function () {
              resolve({
                options: window.__ssMenuOptions(),
                value: value,
                placeholder: placeholder
              });
            }, 200);
          }, 300);
        }, 200);
      }, 100);
    });
  })()`);
  assertJson(addForm.options, ['課長', '副課長', '課員', '實習生'], '下拉選項為四個職務');
  assertEq(addForm.value, '請選擇', '新增時預設未選（沿用專案其他下拉的「請選擇」佔位）');
  assertEq(addForm.placeholder, '請選擇', '未選時顯示「請選擇」');

  console.log('\n5. 填入資料並儲存，職務寫回列表');
  const created = await evaluateAsync(`(function () {
    window.__setInput(window.__labeledField('姓名', 'input'), '測試員');
    window.__setInput(window.__labeledField('帳號', 'input'), 'tester');
    window.__setInput(window.__labeledField('密碼', 'input'), 'Pass0000');
    window.__ssPick('實習生');
    return new Promise(function (resolve) {
      setTimeout(function () {
        Array.prototype.filter.call(document.querySelectorAll('main button[type=submit]'), function (b) {
          return b.textContent.trim().indexOf('儲存') !== -1;
        })[0].click();
        setTimeout(function () {
          resolve({ rows: window.__rows() });
        }, 400);
      }, 100);
    });
  })()`);
  assertEq((created.rows.find(r => r[1] === '測試員') || [])[4], '實習生', '列表顯示新帳號的職務');

  console.log('\n6. 編輯既有帳號可改職務');
  const edited = await evaluateAsync(`(function () {
    var rows = Array.prototype.slice.call(document.querySelectorAll('main table tbody tr'));
    var row = rows.filter(function (tr) {
      return tr.querySelectorAll('td')[1].textContent.trim() === '測試員';
    })[0];
    row.querySelector('button[aria-label="編輯"]').click();
    return new Promise(function (resolve) {
      setTimeout(function () {
        var initial = window.__ssInput('職務').value;
        window.__ssOpen('職務');
        setTimeout(function () {
          window.__ssPick('課員');
          Array.prototype.filter.call(document.querySelectorAll('main button[type=submit]'), function (b) {
            return b.textContent.trim().indexOf('儲存') !== -1;
          })[0].click();
          setTimeout(function () {
            resolve({ initial: initial, rows: window.__rows() });
          }, 400);
        }, 250);
      }, 300);
    });
  })()`);
  assertEq(edited.initial, '實習生', '編輯表單帶出原本的職務');
  assertEq((edited.rows.find(r => r[1] === '測試員') || [])[4], '課員', '儲存後列表的職務更新');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (err) {
  fail('執行錯誤', err.message);
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}

console.log(`\n通過 ${passed}，失敗 ${failed}`);
process.exit(failed ? 1 : 0);
