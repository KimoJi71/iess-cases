#!/usr/bin/env node
/**
 * FullCalendar 外掛註冊驗證：
 * fullcalendar 的 index.global.min.js 是 standard bundle，已內含 interaction 外掛，
 * 若再另外載入 @fullcalendar/interaction，globalPlugins 會出現兩份，
 * 之後每建立一個 Calendar 就會在 console 印一次
 *   Duplicate plugin '@fullcalendar/interaction'
 * （側欄開關會重繪整頁 → 日曆重建 → 每次操作都噴一則警示）。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9403);

if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

let passed = 0, failed = 0;
const pass = (n, d) => { passed++; console.log(`  ✓ ${n}${d ? ` — ${d}` : ''}`); };
const fail = (n, d) => { failed++; console.error(`  ✗ ${n}${d ? ` — ${d}` : ''}`); };
function assertEq(actual, expected, name) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass(name, JSON.stringify(actual));
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=400,900',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-fc-plugins-profile',
  'about:blank'
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const consoleLogs = [];

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
const duplicates = () => consoleLogs.filter(l => /Duplicate plugin/.test(l.text));

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
    } else if (m.method === 'Runtime.consoleAPICalled') {
      consoleLogs.push({
        type: m.params.type,
        text: m.params.args.map(a => a.value ?? a.description).join(' ')
      });
    }
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 375, height: 812, deviceScaleFactor: 1, mobile: true
  });
  await send('Page.navigate', { url: `file://${ROOT}/index.html` });
  await sleep(4000);

  console.log('\n[1] 全域外掛註冊表');
  const plugins = await evaluate('(FullCalendar.globalPlugins || []).map(function (p) { return p.name; })');
  const dupNames = plugins.filter((n, i) => plugins.indexOf(n) !== i);
  assertTrue(plugins.length > 0, 'FullCalendar 已載入', `${plugins.length} 個外掛`);
  assertEq(dupNames, [], '沒有重複註冊的外掛');

  console.log('\n[2] 進入案件安排並反覆開關側欄');
  await evaluate(`Array.prototype.filter.call(document.querySelectorAll('header button'),
    function (b) { return b.textContent.trim() === '案件排程'; })[0].click(); 'ok'`);
  await sleep(1500);
  await evaluate(`Array.prototype.filter.call(document.querySelectorAll('.app-sidebar nav button'),
    function (b) { return b.textContent.trim() === '案件安排'; })[0].click(); 'ok'`);
  await sleep(1500);
  for (let i = 0; i < 3; i++) {
    await evaluate(`document.querySelector('.app-header__menu-btn').click(); 'ok'`);
    await sleep(500);
  }
  assertEq(duplicates().length, 0,
    `開關側欄不再印 Duplicate plugin 警示（樣本：${duplicates()[0]?.text || '無'}）`);

  console.log('\n[3] 日曆本身仍正常運作');
  const cal = await evaluate(`(function () {
    var el = document.querySelector('main .fc');
    return {
      rendered: !!el && !!el.querySelector('.fc-view-harness'),
      events: document.querySelectorAll('.fc-event').length
    };
  })()`);
  assertTrue(cal.rendered, '日曆仍完成渲染');
  assertTrue(cal.events > 0, '日曆仍畫得出排程事件', `${cal.events} 筆`);

  const errors = consoleLogs.filter(l => l.type === 'error');
  if (errors.length) console.log('ERRORS', JSON.stringify(errors.slice(0, 3)));
  assertEq(errors.length, 0, '全程無 console 錯誤');
} catch (err) {
  fail('UI 驗證中斷', err && err.stack ? err.stack : String(err));
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}

console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
