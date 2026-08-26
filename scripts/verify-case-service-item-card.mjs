#!/usr/bin/env node
/**
 * 設備＋服務項目卡片元件：標題、設備欄位、維修原因、處理方式表、移除鈕、唯讀模式。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9361);

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
function assertTrue(cond, name, detail) { if (cond) pass(name, detail); else fail(name, detail); }

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-si-card-profile',
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

  console.log('page load');
  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');

  await evaluate(`
    window.__item = {
      id: 'SI1',
      equipment: {
        id: 'E1', customerName: '測試客戶', storeName: '測試門市',
        category: '空調', brand: '大金', deviceName: '室內機', specification: '2.2kW',
        model: 'FTXS', equipmentLevel: '一般設備', area: '廚房',
        acceptanceDate: '2020-02-01', installer: '王小明',
        assetNumber: 'A-001', serialNumber: 'SN-001', status: '運轉中'
      },
      actualReason: '濾網堵塞',
      processRecords: [{
        id: 11, category1: '維修', category2: '空調', category3: '清洗',
        specification: '標準', qty: 2, unit: '台', points: 3, status: '已處理'
      }]
    };
    window.__text = function (node) { return node.textContent.replace(/\\s+/g, ' ').trim(); };
    window.__render = function (extra) {
      var wrap = document.createElement('div');
      document.body.appendChild(wrap);
      var props = {
        h: IESS.h, index: 0, item: window.__item,
        caseContext: { customerName: '測試客戶', storeName: '測試門市' },
        deviceCategories: [], processMethods: [],
        newRecord: ProcessMethodUtils.normalizeProcessMethodSelection([], null),
        isOther: false, readOnly: false, isClosed: false,
        onNewRecordChange: function () {}, onReasonChange: function () {},
        onAddRecord: function () {}, onToggleRecordStatus: function () {},
        onRemoveRecord: function () {}, onRemoveItem: function () {}
      };
      Object.keys(extra || {}).forEach(function (k) { props[k] = extra[k]; });
      wrap.appendChild(RepairCaseServiceItemCard(props));
      return wrap;
    };
  `);

  console.log('\n編輯模式');
  const edit = await evaluate(`(function () {
    var wrap = window.__render({});
    var text = window.__text(wrap);
    var buttons = Array.prototype.map.call(wrap.querySelectorAll('button'), function (b) {
      return b.textContent.replace(/\\s+/g, ' ').trim();
    });
    var reason = wrap.querySelector('textarea');
    var out = {
      text: text,
      buttons: buttons,
      reasonValue: reason ? reason.value : null,
      hasRemoveBtn: !!wrap.querySelector('button[aria-label="移除此設備"]'),
      rowCount: wrap.querySelectorAll('tbody tr').length
    };
    wrap.remove();
    return out;
  })()`);
  assertTrue(edit.text.indexOf('設備 1') !== -1, '卡片標題含序號', edit.text.slice(0, 60));
  assertTrue(edit.text.indexOf('室內機') !== -1, '標題含設備名稱');
  assertTrue(edit.text.indexOf('FTXS') !== -1, '標題含型號');
  assertTrue(edit.text.indexOf('大金') !== -1, '卡片含設備欄位（品牌）');
  assertEq(edit.reasonValue, '濾網堵塞', '維修原因帶入 textarea');
  assertTrue(edit.hasRemoveBtn, '有移除卡片按鈕（垃圾桶圖示）');
  assertTrue(edit.buttons.some(b => b === '待處理'), '有「待處理」加入鈕');
  assertTrue(edit.buttons.some(b => b === '已處理'), '有「已處理」加入鈕');
  assertEq(edit.rowCount, 1, '處理方式表有一列');

  console.log('\n移除卡片回呼');
  const removed = await evaluate(`(function () {
    var called = 0;
    var wrap = window.__render({ onRemoveItem: function () { called += 1; } });
    var btn = wrap.querySelector('button[aria-label="移除此設備"]');
    if (btn) btn.click();
    wrap.remove();
    return called;
  })()`);
  assertEq(removed, 1, '點「移除」觸發 onRemoveItem 一次');

  console.log('\n工項分類為「其他」');
  const other = await evaluate(`(function () {
    var wrap = window.__render({ isOther: true });
    var out = window.__text(wrap).indexOf('實際維修原因') === -1;
    wrap.remove();
    return out;
  })()`);
  assertEq(other, true, 'isOther 時不顯示實際維修原因');

  console.log('\n唯讀模式');
  const readOnly = await evaluate(`(function () {
    var wrap = window.__render({ readOnly: true });
    var out = {
      buttons: wrap.querySelectorAll('button').length,
      inputs: wrap.querySelectorAll('input, textarea, select').length,
      hasReason: window.__text(wrap).indexOf('濾網堵塞') !== -1,
      rowCount: wrap.querySelectorAll('tbody tr').length
    };
    wrap.remove();
    return out;
  })()`);
  assertEq(readOnly.buttons, 0, '唯讀模式無按鈕');
  assertEq(readOnly.inputs, 0, '唯讀模式無輸入控制項');
  assertEq(readOnly.hasReason, true, '唯讀模式仍顯示維修原因文字');
  assertEq(readOnly.rowCount, 1, '唯讀模式仍顯示處理方式列');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
