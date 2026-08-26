#!/usr/bin/env node
/**
 * 案件安排／人員動向手機版 RWD 驗證：
 * 以 CDP 分別用 375×812（手機）與 1280×900（桌機）兩種視窗載入頁面，檢查
 *   - 篩選列在手機是兩欄網格、查詢鈕滿版；桌機仍是單排 flex
 *   - 日曆高度手機壓到 480、桌機維持 700
 *   - 案件安排的「待安排案件」面板手機預設收合、可點開；桌機一律展開
 *   - 人員動向表格沿用既有的橫向捲動提示
 *   - 兩頁在手機都沒有水平溢出
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9387);

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
  '--window-size=1280,900',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-scheduling-rwd-profile',
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
  window.__go = function (subMenu) {
    var top = Array.prototype.filter.call(document.querySelectorAll('header button'), function (b) {
      return b.textContent.trim() === '案件排程';
    })[0];
    if (!top) throw new Error('找不到主選單：案件排程');
    top.click();
    var sub = Array.prototype.filter.call(
      document.querySelectorAll('.app-sidebar nav button'), function (b) {
        return b.textContent.trim() === subMenu;
      })[0];
    if (!sub) throw new Error('找不到子選單：' + subMenu);
    sub.click();
    return true;
  };
  // 篩選列是頁面主卡片裡灰底區塊內的第一個容器
  window.__filterRow = function () {
    return document.querySelector('main .bg-gray-50 > .grid, main .bg-gray-50 > .flex');
  };
  window.__searchBtn = function () {
    return Array.prototype.filter.call(window.__filterRow().querySelectorAll('button'),
      function (b) { return b.textContent.trim() === '查詢'; })[0];
  };
  window.__calHeight = function () {
    var el = document.querySelector('main .fc');
    return el ? Math.round(el.getBoundingClientRect().height) : null;
  };
  window.__toggle = function () {
    return document.querySelector('[data-testid="pending-panel-toggle"]');
  };
  // 收合的判斷用 offsetParent：class 是否帶 hidden 是實作細節，實際看不看得見才是行為
  window.__panelVisible = function () {
    var t = window.__toggle();
    if (!t) return null;
    var body = t.nextElementSibling;
    var list = t.parentElement.nextElementSibling;
    return { filters: body.offsetParent !== null, list: list.offsetParent !== null };
  };
  window.__overflowX = function () {
    var d = document.documentElement;
    return { scrollWidth: d.scrollWidth, clientWidth: d.clientWidth };
  };
  window.__layout = function () {
    var row = window.__filterRow();
    var btn = window.__searchBtn();
    return {
      display: getComputedStyle(row).display,
      rowWidth: Math.round(row.getBoundingClientRect().width),
      btnWidth: Math.round(btn.getBoundingClientRect().width),
      togglePointerEvents: window.__toggle()
        ? getComputedStyle(window.__toggle()).pointerEvents : null
    };
  };
  window.__movementTableWrap = function () {
    // FullCalendar 內部也用 <table>，要挑出動向清單那張（表頭有「工項分類」）
    var t = Array.prototype.filter.call(document.querySelectorAll('main table'), function (tb) {
      return !tb.closest('.fc') && /工項分類/.test(tb.textContent);
    })[0];
    if (!t) return null;
    var wrap = t.parentElement;
    return { className: wrap.className, hasHint: wrap.classList.contains('table-scroll-hint') };
  };
  'ok'`;

async function loadAt(width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile
  });
  await send('Page.navigate', { url: `file://${ROOT}/index.html` });
  await sleep(4000);
  await evaluate(HELPERS);
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

  // ===== 手機 375×812 =====
  await loadAt(375, 812, true);
  assertEq(consoleErrors.length, 0, '手機載入時無 JS 錯誤');

  console.log('\n[手機] 案件安排');
  await evaluate(`window.__go('案件安排')`);
  await sleep(1200);

  const mArrange = await evaluate('window.__layout()');
  assertEq(mArrange.display, 'grid', '篩選列在手機是網格排版');
  assertTrue(mArrange.btnWidth >= mArrange.rowWidth - 2,
    '查詢鈕在手機占滿整列', `btn=${mArrange.btnWidth} row=${mArrange.rowWidth}`);

  assertEq(await evaluate(`window.__toggle().getAttribute('aria-expanded')`), 'false',
    '待安排案件面板預設收合');
  assertEq(await evaluate('window.__panelVisible()'), { filters: false, list: false },
    '收合時篩選與清單都看不到');

  await evaluate('window.__toggle().click()');
  await sleep(400);
  assertEq(await evaluate(`window.__toggle().getAttribute('aria-expanded')`), 'true',
    '點標題可展開面板');
  assertEq(await evaluate('window.__panelVisible()'), { filters: true, list: true },
    '展開後篩選與清單都出現');
  await evaluate('window.__toggle().click()');
  await sleep(400);

  assertEq(await evaluate('window.__calHeight()'), 480,
    '案件安排日曆在手機壓到 480');

  const mArrangeOverflow = await evaluate('window.__overflowX()');
  assertTrue(mArrangeOverflow.scrollWidth <= mArrangeOverflow.clientWidth + 1,
    '案件安排在手機無水平溢出',
    `scrollWidth=${mArrangeOverflow.scrollWidth} clientWidth=${mArrangeOverflow.clientWidth}`);

  console.log('\n[手機] 人員動向');
  await evaluate(`window.__go('人員動向')`);
  await sleep(1200);

  const mMoveLayout = await evaluate('window.__layout()');
  assertEq(mMoveLayout.display, 'grid', '篩選列在手機是網格排版');
  assertTrue(mMoveLayout.btnWidth >= mMoveLayout.rowWidth - 2,
    '查詢鈕在手機占滿整列', `btn=${mMoveLayout.btnWidth} row=${mMoveLayout.rowWidth}`);

  const wrap = await evaluate('window.__movementTableWrap()');
  assertTrue(wrap && wrap.hasHint, '動向表格容器帶橫向捲動提示', wrap && wrap.className);

  assertEq(await evaluate('window.__calHeight()'), 480,
    '人員動向日曆在手機壓到 480');

  const mMoveOverflow = await evaluate('window.__overflowX()');
  assertTrue(mMoveOverflow.scrollWidth <= mMoveOverflow.clientWidth + 1,
    '人員動向在手機無水平溢出',
    `scrollWidth=${mMoveOverflow.scrollWidth} clientWidth=${mMoveOverflow.clientWidth}`);

  // ===== 桌機 1280×900 =====
  console.log('\n[桌機] 案件安排');
  await loadAt(1280, 900, false);
  await evaluate(`window.__go('案件安排')`);
  await sleep(1200);

  const dArrange = await evaluate('window.__layout()');
  assertEq(dArrange.display, 'flex', '篩選列在桌機維持單排 flex');
  assertTrue(dArrange.btnWidth < dArrange.rowWidth / 2,
    '查詢鈕在桌機維持原本寬度', `btn=${dArrange.btnWidth} row=${dArrange.rowWidth}`);
  assertEq(dArrange.togglePointerEvents, 'none', '桌機的面板標題不可點（只是標題）');
  assertEq(await evaluate('window.__panelVisible()'), { filters: true, list: true },
    '桌機面板一律展開（不受收合旗標影響）');

  const dArrangeCal = await evaluate('window.__calHeight()');
  assertTrue(dArrangeCal !== null && dArrangeCal > 600,
    '案件安排日曆在桌機維持 700', `height=${dArrangeCal}`);

  console.log('\n[桌機] 人員動向');
  await evaluate(`window.__go('人員動向')`);
  await sleep(1200);
  assertEq((await evaluate('window.__layout()')).display, 'flex',
    '篩選列在桌機維持單排 flex');
  const dMoveCal = await evaluate('window.__calHeight()');
  assertTrue(dMoveCal !== null && dMoveCal > 600,
    '人員動向日曆在桌機維持 700', `height=${dMoveCal}`);

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
