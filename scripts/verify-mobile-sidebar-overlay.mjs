#!/usr/bin/env node
/**
 * 手機版側欄抽屜層級驗證：
 * 抽屜是 top:0 的全高浮層並自備關閉鈕，設計上要蓋過頂部 header。
 * 若 z-index 低於 header，抽屜頂端的關閉鈕與第一個選單項目會被 header 蓋住，
 * 連點擊都會被 header 攔走（elementFromPoint 命中 header 的按鈕）。
 * 這裡用 elementFromPoint 驗「真的點得到」，而不是只比對 z-index 數字。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9389);

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
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-sidebar-overlay-profile',
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

const HELPERS = `
  window.__openDrawer = function () {
    document.querySelector('.app-header__menu-btn').click();
    return true;
  };
  // 用四角＋中心探點，確認整顆按鈕都真的接得到點擊，而不是只有露出來的下半截
  window.__hitTest = function (selector) {
    var el = document.querySelector(selector);
    if (!el) return { found: false };
    var r = el.getBoundingClientRect();
    var pts = [
      [r.left + 2, r.top + 2], [r.right - 2, r.top + 2],
      [r.left + 2, r.bottom - 2], [r.right - 2, r.bottom - 2],
      [r.left + r.width / 2, r.top + r.height / 2]
    ];
    var blockedBy = null;
    var covered = 0;
    pts.forEach(function (p) {
      var hit = document.elementFromPoint(p[0], p[1]);
      if (hit === el || el.contains(hit)) { covered++; return; }
      if (!blockedBy) {
        blockedBy = hit
          ? (hit.className || hit.tagName) + '｜' + (hit.textContent || '').trim().slice(0, 12)
          : 'null';
      }
    });
    return {
      found: true, total: pts.length, covered: covered, blockedBy: blockedBy,
      rect: { top: Math.round(r.top), bottom: Math.round(r.bottom) }
    };
  };
  window.__rects = function () {
    var header = document.querySelector('.app-header');
    var slot = document.querySelector('.app-sidebar-slot');
    var backdrop = document.querySelector('.app-sidebar-backdrop');
    return {
      headerBottom: Math.round(header.getBoundingClientRect().bottom),
      headerZ: Number(getComputedStyle(header).zIndex),
      slotZ: Number(getComputedStyle(slot).zIndex),
      backdropZ: backdrop ? Number(getComputedStyle(backdrop).zIndex) : null,
      open: slot.classList.contains('app-sidebar-slot--open')
    };
  };
  'ok'`;

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
  await send('Emulation.setDeviceMetricsOverride', {
    width: 375, height: 812, deviceScaleFactor: 1, mobile: true
  });
  await send('Page.navigate', { url: `file://${ROOT}/index.html` });
  await sleep(4000);
  await evaluate(HELPERS);
  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');

  console.log('\n[手機 375×812] 抽屜開啟後的層級');
  await evaluate('window.__openDrawer()');
  await sleep(600);

  const layers = await evaluate('window.__rects()');
  assertTrue(layers.open, '抽屜已開啟');
  assertTrue(layers.headerBottom > 0,
    'header 佔住畫面頂端（抽屜 top:0 會與它重疊）', `headerBottom=${layers.headerBottom}`);
  assertTrue(layers.slotZ > layers.headerZ,
    '抽屜層級高於 header', `slot=${layers.slotZ} header=${layers.headerZ}`);
  assertTrue(layers.backdropZ > layers.headerZ && layers.backdropZ < layers.slotZ,
    '遮罩夾在 header 與抽屜之間',
    `backdrop=${layers.backdropZ} header=${layers.headerZ} slot=${layers.slotZ}`);

  const first = await evaluate(`window.__hitTest('.app-sidebar nav button')`);
  assertTrue(first.found, '取得側欄第一個選單項目');
  assertEq(first.covered, first.total,
    `第一個選單項目整顆都點得到（被 ${first.blockedBy || '無'} 擋住）`);

  const close = await evaluate(`window.__hitTest('.app-sidebar__close')`);
  assertTrue(close.found, '取得抽屜關閉鈕');
  assertEq(close.covered, close.total,
    `抽屜關閉鈕整顆都點得到（被 ${close.blockedBy || '無'} 擋住）`);

  console.log('\n[手機] 關閉鈕與遮罩仍能關掉抽屜');
  await evaluate(`document.querySelector('.app-sidebar__close').click()`);
  await sleep(500);
  assertEq((await evaluate('window.__rects()')).open, false, '按關閉鈕可收起抽屜');

  await evaluate('window.__openDrawer()');
  await sleep(500);
  await evaluate(`document.querySelector('.app-sidebar-backdrop').click()`);
  await sleep(500);
  assertEq((await evaluate('window.__rects()')).open, false, '點遮罩可收起抽屜');

  console.log('\n[桌機 1280×900] 側欄仍在版面內、不做浮層');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 900, deviceScaleFactor: 1, mobile: false
  });
  await send('Page.navigate', { url: `file://${ROOT}/index.html` });
  await sleep(4000);
  await evaluate(HELPERS);
  const desktop = await evaluate(`(function () {
    var slot = document.querySelector('.app-sidebar-slot');
    var header = document.querySelector('.app-header');
    return {
      position: getComputedStyle(slot).position,
      slotTop: Math.round(slot.getBoundingClientRect().top),
      headerBottom: Math.round(header.getBoundingClientRect().bottom)
    };
  })()`);
  assertEq(desktop.position, 'static', '桌機側欄不是浮層');
  assertTrue(desktop.slotTop >= desktop.headerBottom,
    '桌機側欄排在 header 下方，不重疊',
    `slotTop=${desktop.slotTop} headerBottom=${desktop.headerBottom}`);
  const dFirst = await evaluate(`window.__hitTest('.app-sidebar nav button')`);
  assertEq(dFirst.covered, dFirst.total,
    `桌機第一個選單項目整顆都點得到（被 ${dFirst.blockedBy || '無'} 擋住）`);

  if (consoleErrors.length) console.log('ERRORS', JSON.stringify(consoleErrors));
  assertEq(consoleErrors.length, 0, '操作後仍無 JS 錯誤');
} catch (err) {
  fail('UI 驗證中斷', err && err.stack ? err.stack : String(err));
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}

console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
