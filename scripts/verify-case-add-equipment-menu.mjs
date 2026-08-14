#!/usr/bin/env node
/**
 * 編輯叫修案件「加入設備」：按鈕選單（手動選擇 / 掃描 QR Code），
 * 以及手動選擇視窗表格欄位對齊「設備管理」。
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
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass(name, JSON.stringify(actual));
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-add-equip-menu-profile',
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

const EQUIPMENT_TABLE_HEADERS = [
  '操作', '設備分類', '品牌', '設備名稱', '設備規格', '型號', '設備等級',
  '設備區域', '出廠日期', '安裝日期', '資產編號', '流水序號', '設備狀態'
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
  await send('Page.navigate', { url: `file://${ROOT}/index.html` });
  await sleep(4000);

  console.log('page load');
  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');

  const todayDate = await evaluate('todayDate');

  await evaluate(`
    window.__mkEq = function () {
      return {
        id: 'E1', customerName: '測試客戶', storeName: '測試門市',
        category: '空調', brand: '大金', deviceName: '室內機',
        specification: '2.2kW', model: 'FTXS', equipmentLevel: '增額設備',
        area: '廚房', manufactureDate: '2020-01-01', installDate: '2020-02-01',
        assetNumber: 'A-001', serialNumber: 'SN-001', status: '運轉',
        createdDate: '${todayDate}'
      };
    };
    window.__ths = function (node) {
      return Array.prototype.map.call(node.querySelectorAll('thead th'), function (t) {
        return t.textContent.trim();
      });
    };
    window.__btnLabels = function (node) {
      return Array.prototype.map.call(node.querySelectorAll('button'), function (b) {
        return b.textContent.replace(/\\s+/g, ' ').trim();
      });
    };
  `);

  console.log('\n設備管理列表欄位');
  const listHeaders = await evaluate(`(function () {
    var node = EquipmentList({
      equipments: [window.__mkEq()], setEquipments: function () {},
      customers: [{ id: 'C1', customerName: '測試客戶' }],
      stores: [{ id: 'S1', customerName: '測試客戶', storeName: '測試門市' }],
      deviceCategories: [], repairCases: [], projectCases: [], setProjectCases: function () {},
      equipmentCustomer: '測試客戶', setEquipmentCustomer: function () {},
      equipmentStore: '測試門市', setEquipmentStore: function () {},
      openStoreEdit: function () {}, openStoreHistory: function () {},
      setEditingCase: function () {}, setView: function () {}, showToast: function () {}
    });
    return window.__ths(node);
  })()`);
  assertEq(listHeaders, EQUIPMENT_TABLE_HEADERS, '設備管理表頭');

  console.log('\n手動選擇視窗表格');
  const picker = await evaluate(`(function () {
    var node = RepairCaseEquipment.PickerModal({
      h: IESS.h,
      items: [window.__mkEq()],
      onSelect: function () {},
      onClose: function () {}
    });
    var headers = window.__ths(node);
    var firstRow = Array.prototype.map.call(
      node.querySelectorAll('tbody tr:first-child td'),
      function (td) { return td.textContent.trim(); }
    );
    var actionText = (node.querySelector('tbody tr:first-child td') || {}).textContent || '';
    return { headers: headers, firstRow: firstRow, actionText: actionText.trim() };
  })()`);
  assertEq(picker.headers, EQUIPMENT_TABLE_HEADERS, '選擇設備表頭對齊設備管理');
  assertTrue(picker.actionText.indexOf('選擇') !== -1, '操作欄為「選擇」', picker.actionText);
  assertTrue(picker.firstRow.indexOf('空調') !== -1, '列含設備分類', picker.firstRow.join(' | '));
  assertTrue(picker.firstRow.indexOf('大金') !== -1, '列含品牌', picker.firstRow.join(' | '));
  assertTrue(picker.firstRow.indexOf('2.2kW') !== -1, '列含設備規格', picker.firstRow.join(' | '));
  assertTrue(picker.firstRow.indexOf('增額設備') !== -1, '列含設備等級', picker.firstRow.join(' | '));
  assertTrue(picker.firstRow.indexOf('2020-01-01') !== -1, '列含出廠日期', picker.firstRow.join(' | '));
  assertTrue(picker.firstRow.indexOf('2020-02-01') !== -1, '列含安裝日期', picker.firstRow.join(' | '));

  console.log('\n編輯表單加入設備按鈕選單');
  const menu = await evaluate(`(function () {
    var wrap = document.createElement('div');
    document.body.appendChild(wrap);
    wrap.appendChild(EditCaseForm({
      editingCase: {
        id: 'C1', caseNumber: '20260814001', customerName: '測試客戶', storeName: '測試門市',
        companyCity: '台北市', companyDistrict: '中山區', workCategory: '一般叫修',
        repairItem: '室內機', repairReason: '不冷', faultDesc: '出風不冷',
        actualReason: '', assignees: [], isClosed: false, processStatus: null,
        createdAt: '${todayDate} 09:00:00', repairDate: '${todayDate} 09:00:00',
        expectedDate: '${todayDate}', expectedTimeStart: '09:00', expectedTimeEnd: '11:00',
        processRecords: [], equipment: null
      },
      cases: [], setCases: function () {}, stores: [], customers: [],
      equipments: [window.__mkEq()],
      deviceCategories: [], processMethods: [],
      setView: function () {}, showToast: function () {}
    }));
    function labels() { return window.__btnLabels(wrap.firstChild); }
    var before = labels();
    var addBtn = Array.prototype.find.call(wrap.querySelectorAll('button'), function (b) {
      return b.textContent.indexOf('加入設備') !== -1;
    });
    if (addBtn) addBtn.click();
    var after = labels();
    var pickBtn = Array.prototype.find.call(wrap.querySelectorAll('button'), function (b) {
      return b.textContent.replace(/\\s+/g, ' ').trim() === '手動選擇';
    });
    if (pickBtn) pickBtn.click();
    var modal = wrap.querySelector('.app-modal-overlay');
    var afterPick = {
      labels: window.__btnLabels(wrap.firstChild),
      headers: modal ? window.__ths(modal) : []
    };
    wrap.remove();
    return { before: before, after: after, afterPick: afterPick, clickedAdd: !!addBtn };
  })()`);
  assertTrue(menu.clickedAdd, '有「加入設備」按鈕');
  assertTrue(
    !menu.before.some(function (l) { return l === '手動選擇'; }),
    '點擊前不直接顯示「手動選擇」按鈕',
    menu.before.join(' | ')
  );
  assertTrue(
    menu.after.some(function (l) { return l === '手動選擇'; }),
    '點擊後選單有「手動選擇」',
    menu.after.join(' | ')
  );
  assertTrue(
    menu.after.some(function (l) { return l.indexOf('掃描 QR Code') !== -1; }),
    '點擊後選單有「掃描 QR Code」',
    menu.after.join(' | ')
  );
  assertEq(menu.afterPick.headers, EQUIPMENT_TABLE_HEADERS, '從選單打開的選擇視窗表頭對齊設備管理');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
