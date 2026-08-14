#!/usr/bin/env node
/**
 * Executed UI verification for:
 * 1. 案件處理列表欄位順序（含實際原因／預計日期／預計時間）
 * 2. 工項分類為「其他」時，第 3 區塊與一般叫修相同（實際維修原因／處理方式／處理狀態）
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
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass(name, JSON.stringify(actual));
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-columns-check-profile',
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

const EXPECTED_HEADERS = [
  '操作', '燈號', '案件狀態', '客戶名稱', '門市名稱', '工項分類', '案件編號', '叫修日期',
  '行政區域', '叫修項目', '叫修原因', '故障描述', '實際原因', '組別', '指派人員', '預計日期', '預計時間',
  '退回原因'
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
    window.__mkCase = function (extra) {
      return Object.assign({
        id: 'C1', caseNumber: '20260813001', customerName: '測試客戶', storeName: '測試門市',
        companyCity: '台北市', companyDistrict: '中山區', workCategory: '一般叫修',
        repairItem: '室內機', repairReason: '不冷', faultDesc: '出風不冷',
        actualReason: '冷媒不足', assignees: [], isClosed: false, processStatus: '案件完成',
        createdAt: '${todayDate} 09:00:00', repairDate: '${todayDate} 09:00:00',
        expectedDate: '${todayDate}', expectedTimeStart: '09:00', expectedTimeEnd: '11:00',
        processRecords: [], equipment: null
      }, extra || {});
    };
    window.__mkList = function (cases) {
      var node = CaseList({
        cases: cases,
        setCases: function () {},
        stores: [], setStores: function () {},
        setEditingCase: function () {}, setView: function () {}, showToast: function () {},
        statusFilter: '案件完成', setStatusFilter: function () {}
      });
      document.body.appendChild(node);
      return node;
    };
    'ok'`);

  console.log('\n案件處理列表 — 欄位順序');
  const headers = await evaluate(`(function(){
    var node = window.__mkList([window.__mkCase()]);
    var hs = Array.prototype.slice.call(node.querySelectorAll('thead th'))
      .map(function (th) { return th.textContent.trim(); });
    node.remove();
    return hs;
  })()`);
  assertEq(headers, EXPECTED_HEADERS, '表頭順序符合指定欄位');

  console.log('\n案件處理列表 — 一般叫修列內容');
  const normalRow = await evaluate(`(function(){
    var node = window.__mkList([window.__mkCase()]);
    var tds = Array.prototype.slice.call(node.querySelectorAll('tbody tr td'))
      .map(function (td) { return td.textContent.trim(); });
    node.remove();
    return tds;
  })()`);
  assertEq(normalRow.length, EXPECTED_HEADERS.length, '資料列欄位數與表頭一致');
  assertEq(normalRow[3], '測試客戶', '客戶名稱欄');
  assertEq(normalRow[4], '測試門市', '門市名稱欄');
  assertEq(normalRow[6], '20260813001', '案件編號欄');
  assertEq(normalRow[8], '台北市中山區', '行政區域欄');
  assertEq(normalRow[9], '室內機', '叫修項目欄');
  assertEq(normalRow[10], '不冷', '叫修原因欄');
  assertEq(normalRow[12], '冷媒不足', '實際原因欄');
  assertEq(normalRow[15], todayDate, '預計日期欄');
  assertEq(normalRow[16], '09:00 ~ 11:00', '預計時間欄');

  console.log('\n案件處理列表 — 工項分類「其他」');
  const otherRow = await evaluate(`(function(){
    var node = window.__mkList([window.__mkCase({ workCategory: '其他' })]);
    var tds = Array.prototype.slice.call(node.querySelectorAll('tbody tr td'))
      .map(function (td) { return td.textContent.trim(); });
    node.remove();
    return tds;
  })()`);
  assertEq(otherRow[5], '其他', '工項分類欄為「其他」');
  assertEq(otherRow[9], '', '叫修項目欄留空');
  assertEq(otherRow[10], '', '叫修原因欄留空');

  console.log('\n查看案件明細 — 工項分類「其他」');
  const otherView = await evaluate(`(function(){
    var node = ViewCaseForm({
      viewingCase: window.__mkCase({ workCategory: '其他', remarks: '安裝完成' }),
      setView: function () {}, backView: 'list', processMethods: [], deviceCategories: []
    });
    document.body.appendChild(node);
    var text = node.textContent;
    var result = {
      hasServiceSection: text.indexOf('4. 服務項目') !== -1,
      hasRemarkOnlySection: text.indexOf('3. 備註') !== -1,
      hasScheduleSection: text.indexOf('1. 排程資料') !== -1,
      hasCaseSection: text.indexOf('2. 案件資料') !== -1,
      hasEquipmentSection: text.indexOf('3. 設備資料') !== -1,
      hasResultSection: text.indexOf('5. 維修結果') !== -1,
      hasActualReason: text.indexOf('實際維修原因') !== -1,
      hasProcessMethods: text.indexOf('處理方式') !== -1,
      hasProcessStatus: text.indexOf('處理狀態') !== -1,
      hasRemarks: text.indexOf('安裝完成') !== -1,
      hasWorkDesc: text.indexOf('工作描述') !== -1,
      hasRepairItemLabel: text.indexOf('叫修項目') !== -1
    };
    node.remove();
    return result;
  })()`);
  assertTrue(otherView.hasServiceSection, '其他案件顯示「4. 服務項目」區塊');
  assertEq(otherView.hasRemarkOnlySection, false, '不再是只有「3. 備註」的區塊');
  assertTrue(otherView.hasScheduleSection, '顯示「1. 排程資料」');
  assertTrue(otherView.hasCaseSection, '顯示「2. 案件資料」');
  assertTrue(otherView.hasEquipmentSection, '顯示「3. 設備資料」');
  assertTrue(otherView.hasResultSection, '顯示「5. 維修結果」');
  assertEq(otherView.hasActualReason, false, '其他案件不顯示實際維修原因');
  assertTrue(otherView.hasProcessMethods, '顯示處理方式');
  assertTrue(otherView.hasProcessStatus, '顯示處理狀態');
  assertTrue(otherView.hasRemarks, '仍顯示備註內容');
  assertTrue(otherView.hasWorkDesc, '其他案件描述欄仍為「工作描述」');
  assertEq(otherView.hasRepairItemLabel, false, '其他案件不顯示叫修項目欄位');

  console.log('\n編輯案件 — 工項分類「其他」');
  const otherEdit = await evaluate(`(function(){
    var node = EditCaseForm({
      editingCase: window.__mkCase({ workCategory: '其他', equipment: { id: 'E1' } }),
      cases: [], setCases: function () {}, stores: [], customers: [], equipments: [],
      deviceCategories: [], processMethods: [],
      setView: function () {}, showToast: function () {}
    });
    document.body.appendChild(node);
    var result = {
      hasActualReason: !!node.querySelector('textarea[name="actualReason"]'),
      hasRemarks: !!node.querySelector('textarea[name="remarks"]'),
      // 原生 <select> 會被 searchable-select 攔截成 input[role=combobox]
      hasProcessStatus: !!node.querySelector('[name="processStatus"]'),
      hasProcessMethodTable: node.textContent.indexOf('處理方式') !== -1,
      hasTimeRecords: node.textContent.indexOf('時間紀錄') !== -1,
      hasScheduleSection: node.textContent.indexOf('1. 排程資料') !== -1,
      hasManualPick: node.textContent.indexOf('手動選擇') !== -1,
      hasScanQr: node.textContent.indexOf('掃描 QR Code') !== -1,
      hasCustomerSelect: !!node.querySelector('select[name="customerName"]'),
      processStatusOptions: PROCESS_STATUS_OPTIONS.slice()
    };
    node.remove();
    return result;
  })()`);
  assertEq(otherEdit.hasActualReason, false, '編輯表單不顯示實際維修原因欄');
  assertTrue(otherEdit.hasProcessMethodTable, '編輯表單有處理方式');
  assertTrue(otherEdit.hasRemarks, '編輯表單保留備註欄');
  assertTrue(otherEdit.hasProcessStatus, '編輯表單有處理狀態');
  assertTrue(otherEdit.hasTimeRecords, '編輯表單有時間紀錄');
  assertTrue(otherEdit.hasScheduleSection, '編輯表單有排程資料區塊');
  assertTrue(otherEdit.hasManualPick, '編輯表單有手動選擇設備');
  assertTrue(otherEdit.hasScanQr, '編輯表單有掃描 QR Code');
  assertEq(otherEdit.hasCustomerSelect, false, '編輯表單案件資料為唯讀（無客戶下拉）');
  assertEq(
    otherEdit.processStatusOptions.indexOf('其他') === -1,
    true,
    '處理狀態不含「其他」'
  );
  assertTrue(otherEdit.processStatusOptions.indexOf('轉汰換') !== -1, '處理狀態含「轉汰換」');
  assertEq(otherEdit.processStatusOptions.indexOf('待汰換') === -1, true, '處理狀態不含「待汰換」');

  console.log('\n一般叫修 — 實際維修原因仍保留');
  const normalDetail = await evaluate(`(function(){
    var viewNode = ViewCaseForm({
      viewingCase: window.__mkCase(), setView: function () {}, backView: 'list',
      processMethods: [], deviceCategories: []
    });
    var editNode = EditCaseForm({
      editingCase: window.__mkCase({ equipment: { id: 'E1' } }),
      cases: [], setCases: function () {}, stores: [], customers: [], equipments: [],
      deviceCategories: [], processMethods: [],
      setView: function () {}, showToast: function () {}
    });
    document.body.appendChild(viewNode);
    document.body.appendChild(editNode);
    var result = {
      viewHasActualReason: viewNode.textContent.indexOf('實際維修原因') !== -1,
      editHasActualReason: !!editNode.querySelector('textarea[name="actualReason"]')
    };
    viewNode.remove();
    editNode.remove();
    return result;
  })()`);
  assertTrue(normalDetail.viewHasActualReason, '一般叫修明細顯示實際維修原因');
  assertTrue(normalDetail.editHasActualReason, '一般叫修編輯表單有實際維修原因欄');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
