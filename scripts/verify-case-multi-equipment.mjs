#!/usr/bin/env node
/**
 * 編輯案件表單：「3. 設備與服務項目」合併區塊、支援多張卡片。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9362);

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
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-multi-equip-profile',
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
    window.__mkEq = function (id, name, model) {
      return {
        id: id, customerName: '測試客戶', storeName: '測試門市',
        category: '空調', brand: '大金', deviceName: name, specification: '2.2kW',
        model: model, equipmentLevel: '一般設備', area: '廚房',
        acceptanceDate: '2020-02-01', installer: '王小明',
        assetNumber: 'A-' + id, serialNumber: 'SN-' + id, status: '運轉中',
        createdDate: '2026-08-01'
      };
    };
    window.__saved = null;
    window.__mountEdit = function (editingCase) {
      var wrap = document.createElement('div');
      document.body.appendChild(wrap);
      wrap.appendChild(EditCaseForm({
        editingCase: editingCase,
        cases: [editingCase],
        setCases: function (next) { window.__saved = next; },
        stores: [], customers: [],
        equipments: [window.__mkEq('E1', '室內機', 'FTXS'), window.__mkEq('E2', '冰水主機', 'CH-200')],
        deviceCategories: [], processMethods: [],
        setView: function () {}, showToast: function () {}
      }));
      return wrap;
    };
    window.__baseCase = {
      id: 'C1', caseNumber: '20260825001', customerName: '測試客戶', storeName: '測試門市',
      companyCity: '台北市', companyDistrict: '中山區', workCategory: '一般叫修',
      repairItem: '室內機', repairReason: '不冷', faultDesc: '出風不冷',
      assignees: [], isClosed: false, processStatus: null,
      createdAt: '2026-08-25 09:00:00', repairDate: '2026-08-25 09:00:00',
      expectedDate: '2026-08-25', expectedTimeStart: '09:00', expectedTimeEnd: '11:00',
      serviceItems: []
    };
    window.__clickAdd = function (wrap, equipIndex) {
      var addBtn = Array.prototype.find.call(wrap.querySelectorAll('button'), function (b) {
        return b.textContent.indexOf('加入設備') !== -1;
      });
      addBtn.click();
      var pickBtn = Array.prototype.find.call(wrap.querySelectorAll('button'), function (b) {
        return b.textContent.replace(/\\s+/g, ' ').trim() === '手動選擇';
      });
      pickBtn.click();
      var rows = wrap.querySelectorAll('.app-modal-overlay tbody tr');
      rows[equipIndex].querySelector('button').click();
    };
    window.__cardTitles = function (wrap) {
      return Array.prototype.map.call(wrap.querySelectorAll('div.border.border-gray-200.rounded-lg > div:first-child span'),
        function (s) { return s.textContent.replace(/\\s+/g, ' ').trim(); });
    };
  `);

  console.log('\n合併區塊標題');
  const headings = await evaluate(`(function () {
    var wrap = window.__mountEdit(JSON.parse(JSON.stringify(window.__baseCase)));
    var hs = Array.prototype.map.call(wrap.querySelectorAll('h3'), function (n) {
      return n.textContent.replace(/\\s+/g, ' ').trim();
    });
    wrap.remove();
    return hs;
  })()`);
  assertTrue(headings.some(t => t.indexOf('3. 設備與服務項目') === 0), '區塊 3 已合併命名', headings.join(' | '));
  assertTrue(headings.some(t => t === '4. 維修結果'), '維修結果遞補為 4', headings.join(' | '));
  assertTrue(!headings.some(t => t === '4. 服務項目'), '不再有獨立的 4. 服務項目', headings.join(' | '));

  console.log('\n加入兩台設備');
  const twoCards = await evaluate(`(function () {
    var wrap = window.__mountEdit(JSON.parse(JSON.stringify(window.__baseCase)));
    window.__clickAdd(wrap, 0);
    window.__clickAdd(wrap, 1);
    var titles = window.__cardTitles(wrap);
    var reasons = wrap.querySelectorAll('textarea').length;
    wrap.remove();
    return { titles: titles, reasons: reasons };
  })()`);
  assertEq(twoCards.titles.length, 2, '加入兩台設備後有兩張卡片');
  assertTrue(twoCards.titles[0].indexOf('設備 1') === 0, '第一張標題為設備 1', twoCards.titles[0]);
  assertTrue(twoCards.titles[1].indexOf('設備 2') === 0, '第二張標題為設備 2', twoCards.titles[1]);
  assertTrue(twoCards.titles[0].indexOf('FTXS') !== -1, '第一張是先選的設備');
  assertTrue(twoCards.titles[1].indexOf('CH-200') !== -1, '第二張是後選的設備');

  console.log('\n維修原因互不干擾');
  const reasons = await evaluate(`(function () {
    var wrap = window.__mountEdit(JSON.parse(JSON.stringify(window.__baseCase)));
    window.__clickAdd(wrap, 0);
    window.__clickAdd(wrap, 1);
    function reasonBoxes() {
      return Array.prototype.filter.call(wrap.querySelectorAll('textarea'), function (t) {
        return t.previousSibling && t.previousSibling.textContent === '實際維修原因';
      });
    }
    var boxes = reasonBoxes();
    boxes[0].value = '第一台濾網堵塞';
    boxes[0].dispatchEvent(new Event('change', { bubbles: true }));
    var after = reasonBoxes();
    var out = [after[0].value, after[1].value];
    wrap.remove();
    return out;
  })()`);
  assertEq(reasons, ['第一台濾網堵塞', ''], '只有第一張卡片的維修原因被改動');

  console.log('\n移除中間卡片');
  const afterRemove = await evaluate(`(function () {
    var base = JSON.parse(JSON.stringify(window.__baseCase));
    base.serviceItems = [
      { id: 'SIa', equipment: window.__mkEq('E1', '室內機', 'FTXS'), actualReason: 'A', processRecords: [] },
      { id: 'SIb', equipment: window.__mkEq('E2', '冰水主機', 'CH-200'), actualReason: 'B', processRecords: [] },
      { id: 'SIc', equipment: window.__mkEq('E3', '排風機', 'VF-10'), actualReason: 'C', processRecords: [] }
    ];
    var wrap = window.__mountEdit(base);
    var removeBtns = Array.prototype.filter.call(wrap.querySelectorAll('button'), function (b) {
      return b.textContent.replace(/\\s+/g, ' ').trim() === '移除';
    });
    removeBtns[1].click();
    var titles = window.__cardTitles(wrap);
    wrap.remove();
    return titles;
  })()`);
  assertEq(afterRemove.length, 2, '移除後剩兩張卡片');
  assertTrue(afterRemove[0].indexOf('FTXS') !== -1, '第一張保留', afterRemove[0]);
  assertTrue(afterRemove[1].indexOf('VF-10') !== -1, '第三張遞補為設備 2', afterRemove[1]);
  assertTrue(afterRemove[1].indexOf('設備 2') === 0, '序號重新編號', afterRemove[1]);

  console.log('\n存檔保留多筆設備');
  const saved = await evaluate(`(function () {
    var base = JSON.parse(JSON.stringify(window.__baseCase));
    base.serviceItems = [
      { id: 'SIa', equipment: window.__mkEq('E1', '室內機', 'FTXS'), actualReason: 'A', processRecords: [] },
      { id: 'SIb', equipment: window.__mkEq('E2', '冰水主機', 'CH-200'), actualReason: 'B', processRecords: [] }
    ];
    window.__saved = null;
    var wrap = window.__mountEdit(base);
    var saveBtn = Array.prototype.find.call(wrap.querySelectorAll('button'), function (b) {
      return b.textContent.replace(/\\s+/g, ' ').trim().indexOf('儲存') !== -1;
    });
    saveBtn.click();
    var out = window.__saved
      ? window.__saved[0].serviceItems.map(function (it) {
          return [it.equipment.model, it.actualReason].join(':');
        })
      : null;
    wrap.remove();
    return out;
  })()`);
  assertEq(saved, ['FTXS:A', 'CH-200:B'], '存檔後兩張卡片與各自維修原因都保留');

  console.log('\n舊案自動遷移');
  const migrated = await evaluate(`(function () {
    var legacy = JSON.parse(JSON.stringify(window.__baseCase));
    delete legacy.serviceItems;
    legacy.equipment = window.__mkEq('E1', '室內機', 'FTXS');
    legacy.actualReason = '舊資料原因';
    legacy.processRecords = [];
    var wrap = window.__mountEdit(legacy);
    var titles = window.__cardTitles(wrap);
    // 實際維修原因是 <textarea value="...">，h() 直接設定 node.value，
    // 不會出現在 textContent 裡，故改讀 textarea 的 value 屬性。
    var reasonBox = Array.prototype.filter.call(wrap.querySelectorAll('textarea'), function (t) {
      return t.previousSibling && t.previousSibling.textContent === '實際維修原因';
    })[0];
    var hasReason = !!reasonBox && reasonBox.value === '舊資料原因';
    wrap.remove();
    return { titles: titles, hasReason: hasReason };
  })()`);
  assertEq(migrated.titles.length, 1, '舊案顯示為單張卡片');
  assertEq(migrated.hasReason, true, '舊案的維修原因仍在');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
