#!/usr/bin/env node
/**
 * Executed verification for the 延伸案件 feature.
 * Launches headless Chrome, loads index.html, then asserts on the real
 * modules attached to window (pure functions + rendered DOM nodes).
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9337);

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

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-extension-check-profile',
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

  console.log('\n延伸狀態判定');
  assertEq(await evaluate(`IESS.caseStatus.isExtensionStatus('待料件')`), true, '待料件為延伸狀態');
  assertEq(await evaluate(`IESS.caseStatus.isExtensionStatus('尚未處理完成')`), true, '尚未處理完成為延伸狀態');
  assertEq(await evaluate(`IESS.caseStatus.isExtensionStatus('案件完成')`), false, '案件完成不是延伸狀態');
  assertEq(await evaluate(`IESS.caseStatus.isExtensionStatus('轉汰換')`), false, '轉汰換不是延伸狀態');
  assertEq(await evaluate(`IESS.caseStatus.isExtensionStatus(null)`), false, 'null 不是延伸狀態');

  console.log('\n延伸編號');
  await evaluate(`
    window.__origCase = {
      id: 'C1', caseNumber: '20260825001', workCategory: '一般叫修',
      customerName: '測試客戶', storeName: '測試門市',
      companyCity: '台北市', companyDistrict: '中山區', storeAddress: '中山北路一段1號',
      serviceLevel: 'A', repairItem: '室內機', repairReason: '不冷',
      faultDesc: '出風不冷', reporter: '王小明', actualReason: '缺冷媒',
      assignees: ['北區一組'], assigneeMemberIds: ['M1'], partnerVendorIds: ['V1'],
      vehicleId: 'VH1',
      equipment: { id: 'E1', category: '分離式', brand: '日立', specification: '3.5匹' },
      processRecords: [
        { id: 1, processMethodId: 'PM1', category1: '冷氣', category2: '維修',
          category3: '加冷媒', specification: 'R410', unit: '式', points: 3, qty: 1, status: '已處理' },
        { id: 2, processMethodId: 'PM2', category1: '冷氣', category2: '更換',
          category3: '壓縮機', specification: '3.5匹', unit: '台', points: 8, qty: 2, status: '待處理' }
      ],
      processStatus: '待料件', completionDate: '2026-08-25 15:00', reRepairDate: '2026-08-25 13:00',
      expectedDate: '2026-08-25', expectedTimeStart: '13:00', expectedTimeEnd: '15:00',
      planDate: '2026-08-25', planTimeStart: '13:00', planTimeEnd: '15:00',
      isClosed: true, isListClosed: false, closeDate: '2026-08-25 16:00',
      isPerformanceIncluded: false, performanceAssignees: [], performanceAssignee: '',
      performanceMemberIds: [], returnReason: '格式有誤', returnedAt: '2026-08-24 10:00',
      indicator: 'completed', createdAt: '2026-08-20T01:00:00.000Z', repairDate: '2026-08-20 09:00'
    };
    'ok'`);

  assertEq(await evaluate(`CaseExtensionUtils.getRootCaseNumber(window.__origCase)`),
    '20260825001', '原始案件的 root 為自身編號');
  assertEq(await evaluate(`CaseExtensionUtils.getRootCaseNumber({ caseNumber: '20260825001-1', rootCaseNumber: '20260825001' })`),
    '20260825001', '延伸案件的 root 為原始編號');
  assertEq(await evaluate(`CaseExtensionUtils.getNextExtensionSeq([window.__origCase], '20260825001')`),
    1, '尚無延伸時序號為 1');
  assertEq(await evaluate(`CaseExtensionUtils.getNextExtensionSeq(
      [window.__origCase, { rootCaseNumber: '20260825001', extensionSeq: 1 }], '20260825001')`),
    2, '已有 -1 時序號為 2');
  assertEq(await evaluate(`CaseExtensionUtils.getNextExtensionCaseNumber(window.__origCase, [window.__origCase])`),
    '20260825001-1', '第一筆延伸編號為 -1');

  console.log('\nbuildExtensionCase — 欄位');
  const built = await evaluate(`(function(){
    var ext = CaseExtensionUtils.buildExtensionCase(window.__origCase, [window.__origCase]);
    return {
      caseNumber: ext.caseNumber,
      rootCaseNumber: ext.rootCaseNumber,
      extensionSeq: ext.extensionSeq,
      prevCaseId: ext.prevCaseId,
      differentId: ext.id !== window.__origCase.id,
      customerName: ext.customerName,
      storeName: ext.storeName,
      storeAddress: ext.storeAddress,
      faultDesc: ext.faultDesc,
      actualReason: ext.actualReason,
      assignees: ext.assignees.join(','),
      memberIds: ext.assigneeMemberIds.join(','),
      vendorIds: ext.partnerVendorIds.join(','),
      vehicleId: ext.vehicleId,
      equipmentId: ext.equipment && ext.equipment.id,
      equipmentIsCopy: ext.equipment !== window.__origCase.equipment,
      recordCount: ext.processRecords.length,
      recordCategory3: ext.processRecords[0] && ext.processRecords[0].category3,
      recordStatus: ext.processRecords[0] && ext.processRecords[0].status,
      recordQty: ext.processRecords[0] && ext.processRecords[0].qty,
      recordIdIsNew: ext.processRecords[0] && ext.processRecords[0].id !== 2,
      processStatus: ext.processStatus,
      completionDate: ext.completionDate,
      reRepairDate: ext.reRepairDate,
      expectedDate: ext.expectedDate,
      expectedTimeStart: ext.expectedTimeStart,
      planDate: ext.planDate,
      isClosed: ext.isClosed,
      isListClosed: ext.isListClosed,
      closeDate: ext.closeDate,
      isPerformanceIncluded: ext.isPerformanceIncluded,
      hasReturnReason: Object.prototype.hasOwnProperty.call(ext, 'returnReason'),
      originRecordsUntouched: window.__origCase.processRecords.length === 2
    };
  })()`);
  assertEq(built.caseNumber, '20260825001-1', '延伸案件編號');
  assertEq(built.rootCaseNumber, '20260825001', 'rootCaseNumber');
  assertEq(built.extensionSeq, 1, 'extensionSeq');
  assertEq(built.prevCaseId, 'C1', 'prevCaseId 指向原案件');
  assertTrue(built.differentId, '延伸案件有自己的 id');
  assertEq(built.customerName, '測試客戶', '客戶名稱帶入');
  assertEq(built.storeName, '測試門市', '門市名稱帶入');
  assertEq(built.storeAddress, '中山北路一段1號', '門市地址帶入');
  assertEq(built.faultDesc, '出風不冷', '故障描述帶入');
  assertEq(built.actualReason, '缺冷媒', '實際維修原因帶入');
  assertEq(built.assignees, '北區一組', '組別帶入');
  assertEq(built.memberIds, 'M1', '指派人員帶入');
  assertEq(built.vendorIds, 'V1', '協力廠商帶入');
  assertEq(built.vehicleId, 'VH1', '車輛帶入');
  assertEq(built.equipmentId, 'E1', '設備資料帶入');
  assertTrue(built.equipmentIsCopy, '設備為深拷貝，非同一物件');
  assertEq(built.recordCount, 1, '只帶一筆待處理服務項目');
  assertEq(built.recordCategory3, '壓縮機', '帶入的是待處理那筆');
  assertEq(built.recordStatus, '待處理', '服務項目維持待處理');
  assertEq(built.recordQty, 2, '服務項目數量保留');
  assertTrue(built.recordIdIsNew, '服務項目取得新 id');
  assertEq(built.processStatus, null, '處理狀態清空');
  assertEq(built.completionDate, '', '完成時間清空');
  assertEq(built.reRepairDate, '', '到店時間清空');
  assertEq(built.expectedDate, '', '預計日期清空');
  assertEq(built.expectedTimeStart, '', '預計時間清空');
  assertEq(built.planDate, '', 'planDate 清空');
  assertEq(built.isClosed, false, 'isClosed 為 false');
  assertEq(built.isListClosed, false, 'isListClosed 為 false');
  assertEq(built.closeDate, '', '結案日期清空');
  assertEq(built.isPerformanceIncluded, false, '未列入績效');
  assertEq(built.hasReturnReason, false, '不帶入退回原因');
  assertTrue(built.originRecordsUntouched, '原案件服務項目未被更動');

  console.log('\nbuildExtensionCase — 連續延伸與空項目');
  const chain = await evaluate(`(function(){
    var ext1 = CaseExtensionUtils.buildExtensionCase(window.__origCase, [window.__origCase]);
    var closed1 = Object.assign({}, ext1, { processStatus: '尚未處理完成', isClosed: true });
    var ext2 = CaseExtensionUtils.buildExtensionCase(closed1, [window.__origCase, closed1]);
    var noPending = Object.assign({}, window.__origCase, {
      id: 'C9', caseNumber: '20260825009',
      processRecords: [{ id: 7, category3: '加冷媒', status: '已處理', qty: 1 }]
    });
    var ext3 = CaseExtensionUtils.buildExtensionCase(noPending, [noPending]);
    return {
      seq2Number: ext2.caseNumber,
      seq2Root: ext2.rootCaseNumber,
      seq2Prev: ext2.prevCaseId,
      seq2PrevMatchesClosed1: ext2.prevCaseId === closed1.id,
      seq2Seq: ext2.extensionSeq,
      emptyNumber: ext3.caseNumber,
      emptyRecords: ext3.processRecords.length
    };
  })()`);
  assertEq(chain.seq2Number, '20260825001-2', '第二次延伸為 -2（非 -1-1）');
  assertEq(chain.seq2Root, '20260825001', '第二次延伸沿用原始 root');
  assertTrue(chain.seq2PrevMatchesClosed1, 'prevCaseId 指向上一筆案件（closed1.id）', chain.seq2Prev);
  assertEq(chain.seq2Seq, 2, '第二次延伸序號為 2');
  assertEq(chain.emptyNumber, '20260825009-1', '無待處理項目仍建立延伸案件');
  assertEq(chain.emptyRecords, 0, '無待處理項目時服務項目為空');

  console.log('\n案件處理列表 — 延伸結案');
  await evaluate(`
    window.__mkList = function () {
      var target = Object.assign({}, window.__origCase, {
        isClosed: false, isListClosed: false, closeDate: '',
        returnReason: undefined, returnedAt: undefined
      });
      window.__written = { cases: null, stores: null, toast: null };
      var node = CaseList({
        cases: [target],
        setCases: function (next) { window.__written.cases = next; },
        stores: [], setStores: function (next) { window.__written.stores = next; },
        customers: [],
        setEditingCase: function () {}, setView: function () {},
        showToast: function (msg) { window.__written.toast = msg; },
        statusFilter: '全部', setStatusFilter: function () {},
        processMethods: [], deviceCategories: [], vehicles: [], vendors: []
      });
      document.body.appendChild(node);
      return node;
    };
    window.__findCloseBtn = function (node, caseNumber) {
      var rows = Array.prototype.slice.call(node.querySelectorAll('tbody tr'));
      var row = rows.filter(function (tr) { return tr.textContent.indexOf(caseNumber) !== -1; })[0];
      if (!row) return null;
      return row.querySelector('button[aria-label="案件結案"]');
    };
    window.__findBtnByText = function (text) {
      return Array.prototype.slice.call(document.body.querySelectorAll('button'))
        .filter(function (b) { return b.textContent.trim() === text; })[0];
    };
    'ok'`);

  const modalCheck = await evaluate(`(function(){
    var node = window.__mkList();
    window.__findCloseBtn(node, '20260825001').click();
    var text = document.body.textContent;
    var result = {
      mentionsExtension: text.indexOf('延伸案件') !== -1,
      mentionsNumber: text.indexOf('20260825001-1') !== -1
    };
    document.body.innerHTML = '';
    return result;
  })()`);
  assertTrue(modalCheck.mentionsExtension, '確認視窗文案提到延伸案件');
  assertTrue(modalCheck.mentionsNumber, '確認視窗預告延伸編號 20260825001-1');

  const closeResult = await evaluate(`(function(){
    var node = window.__mkList();
    window.__findCloseBtn(node, '20260825001').click();
    window.__findBtnByText('確認').click();
    var written = window.__written.cases || [];
    var origin = written.filter(function (c) { return c.id === 'C1'; })[0];
    var ext = written.filter(function (c) { return c.caseNumber === '20260825001-1'; })[0];
    var result = {
      total: written.length,
      originClosed: origin && origin.isClosed,
      originIsListClosed: origin && !!origin.isListClosed,
      originHasCloseDate: !!(origin && origin.closeDate),
      originRecords: origin && origin.processRecords.length,
      hasExtension: !!ext,
      extPrev: ext && ext.prevCaseId,
      extStatus: ext && ext.processStatus,
      extRecords: ext && ext.processRecords.length,
      toast: window.__written.toast
    };
    document.body.innerHTML = '';
    return result;
  })()`);
  assertEq(closeResult.total, 2, '結案後案件集共 2 筆（原案 + 延伸案）');
  assertEq(closeResult.originClosed, true, '原案件已結案');
  assertEq(closeResult.originIsListClosed, false, '原案件不留在處理列表');
  assertTrue(closeResult.originHasCloseDate, '原案件寫入結案時間');
  assertEq(closeResult.originRecords, 2, '原案件服務項目保留原樣');
  assertTrue(closeResult.hasExtension, '建立延伸案件 20260825001-1');
  assertEq(closeResult.extPrev, 'C1', '延伸案件連結原案件');
  assertEq(closeResult.extStatus, null, '延伸案件為未處理');
  assertEq(closeResult.extRecords, 1, '延伸案件只帶待處理項目');
  assertTrue(String(closeResult.toast).indexOf('20260825001-1') !== -1,
    'toast 提示延伸案件編號', closeResult.toast);

  const plainClose = await evaluate(`(function(){
    window.__written = { cases: null, stores: null, toast: null };
    var target = Object.assign({}, window.__origCase, {
      id: 'C2', caseNumber: '20260825002', processStatus: '案件完成',
      isClosed: false, isListClosed: false, closeDate: ''
    });
    var node = CaseList({
      cases: [target],
      setCases: function (next) { window.__written.cases = next; },
      stores: [], setStores: function () {}, customers: [],
      setEditingCase: function () {}, setView: function () {},
      showToast: function (msg) { window.__written.toast = msg; },
      statusFilter: '全部', setStatusFilter: function () {},
      processMethods: [], deviceCategories: [], vehicles: [], vendors: []
    });
    document.body.appendChild(node);
    window.__findCloseBtn(node, '20260825002').click();
    var modalText = document.body.textContent;
    window.__findBtnByText('確認').click();
    var result = {
      mentionsExtension: modalText.indexOf('延伸案件') !== -1,
      total: (window.__written.cases || []).length,
      toast: window.__written.toast
    };
    document.body.innerHTML = '';
    return result;
  })()`);
  assertEq(plainClose.mentionsExtension, false, '案件完成的確認視窗不提延伸案件');
  assertEq(plainClose.total, 1, '案件完成結案不產生延伸案件');
  assertTrue(String(plainClose.toast).indexOf('延伸') === -1,
    '案件完成的 toast 不提延伸', plainClose.toast);

  console.log('\nPageHeader actions 與 Icons.History');
  assertEq(await evaluate('typeof IESS.Icons.History'), 'function', 'Icons.History 已定義');
  assertEq(await evaluate(`IESS.Icons.History({ className: 'h-4 w-4' }).tagName`),
    'svg', 'Icons.History 回傳 svg 節點');
  assertTrue(await evaluate(`IESS.Icons.History({ className: 'h-4 w-4' }).querySelectorAll('path').length > 0`),
    'Icons.History 含 path');

  const headerCheck = await evaluate(`(function(){
    var plain = PageHeader({ title: '測試', badge: 'X1', onClose: function () {} });
    var withActions = PageHeader({
      title: '測試', badge: 'X1', onClose: function () {},
      actions: [IESS.h('button', { type: 'button' }, '先前案件')]
    });
    var actionBtn = Array.prototype.slice.call(withActions.querySelectorAll('button'))
      .filter(function (b) { return b.textContent.trim() === '先前案件'; })[0];
    var closeBtn = withActions.querySelector('button[aria-label="關閉並返回列表"]');
    var buttons = Array.prototype.slice.call(withActions.querySelectorAll('button'));
    return {
      plainButtons: plain.querySelectorAll('button').length,
      plainHasClose: !!plain.querySelector('button[aria-label="關閉並返回列表"]'),
      hasActionBtn: !!actionBtn,
      hasCloseBtn: !!closeBtn,
      actionBeforeClose: buttons.indexOf(actionBtn) < buttons.indexOf(closeBtn)
    };
  })()`);
  assertEq(headerCheck.plainButtons, 1, '未傳 actions 時仍只有關閉鈕');
  assertTrue(headerCheck.plainHasClose, '未傳 actions 時關閉鈕不變');
  assertTrue(headerCheck.hasActionBtn, '傳入 actions 後出現該按鈕');
  assertTrue(headerCheck.hasCloseBtn, '傳入 actions 後關閉鈕仍在');
  assertTrue(headerCheck.actionBeforeClose, 'actions 渲染於關閉鈕左側');
} catch (err) {
  console.error(err);
  failed++;
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
