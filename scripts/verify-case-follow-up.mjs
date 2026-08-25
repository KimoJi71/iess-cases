#!/usr/bin/env node
/**
 * Executed verification for the 案件後續處理（待報價／轉汰換／轉原廠）feature.
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
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-follow-up-check-profile',
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

  console.log('\n結案後仍保留於案件處理列表的狀態');
  for (const s of ['待報價', '轉汰換', '轉原廠']) {
    assertEq(await evaluate(`IESS.caseStatus.isListRetainedStatus(${JSON.stringify(s)})`),
      true, `${s} 結案後保留於列表`);
  }
  for (const s of ['待料件', '尚未處理完成', '案件完成', null]) {
    assertEq(await evaluate(`IESS.caseStatus.isListRetainedStatus(${JSON.stringify(s)})`),
      false, `${s === null ? 'null' : s} 結案後不保留於列表`);
  }

  // 建立一筆「已結案且滯留列表」的案件，作為後續處理的測試對象。
  await evaluate(`
    window.__makeCase = function (status, over) {
      return Object.assign({
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
        processStatus: status, completionDate: '2026-08-25 15:00', reRepairDate: '',
        expectedDate: '2026-08-25', expectedTimeStart: '13:00', expectedTimeEnd: '15:00',
        planDate: '', planTimeStart: '', planTimeEnd: '',
        isClosed: true, isListClosed: true, closeDate: '2026-08-25 16:00',
        isPerformanceIncluded: false, performanceAssignees: [], performanceAssignee: '',
        performanceMemberIds: [],
        indicator: 'completed', createdAt: '2026-08-20T01:00:00.000Z', repairDate: '2026-08-20 09:00'
      }, over || {});
    };
    'ok'`);

  console.log('\n後續處理選單項目');
  const menuOf = async (status) => evaluate(
    `IESS.caseStatus.getFollowUpActions(window.__makeCase(${JSON.stringify(status)}))
       .map(function (a) { return a.key + ':' + a.label + ':' + a.kind; })`);

  assertEq((await menuOf('待報價')).join('|'),
    'quoteAccept:接受報價:extend|quoteReject:拒絕報價:finish', '待報價的後續處理為 接受報價／拒絕報價');
  assertEq((await menuOf('轉汰換')).join('|'),
    'toRepair:轉維修:extend|replaceDone:汰換完成:finish', '轉汰換的後續處理為 轉維修／汰換完成');
  assertEq((await menuOf('轉原廠')).join('|'),
    'vendorDone:轉原廠完成:finish', '轉原廠的後續處理只有 轉原廠完成');
  assertEq((await menuOf('待料件')).length, 0, '待料件沒有後續處理選單');
  assertEq((await menuOf('案件完成')).length, 0, '案件完成沒有後續處理選單');

  console.log('\n後續處理按鈕的顯示條件');
  assertEq(await evaluate(
    `IESS.caseStatus.showsFollowUpButton(window.__makeCase('待報價'))`),
    true, '已結案且滯留列表的待報價案件顯示後續處理');
  assertEq(await evaluate(
    `IESS.caseStatus.showsFollowUpButton(window.__makeCase('待報價', { isClosed: false, isListClosed: false }))`),
    false, '尚未結案時不顯示後續處理');
  assertEq(await evaluate(
    `IESS.caseStatus.showsFollowUpButton(window.__makeCase('轉汰換', { isListClosed: false }))`),
    false, '已離開處理列表後不再顯示後續處理');

  console.log('\nfinish 類動作：自處理列表移除，銷案審核那筆不動');
  for (const [status, key, label] of [
    ['待報價', 'quoteReject', '拒絕報價'],
    ['轉汰換', 'replaceDone', '汰換完成'],
    ['轉原廠', 'vendorDone', '轉原廠完成']
  ]) {
    const r = await evaluate(`(function () {
      var c = window.__makeCase(${JSON.stringify(status)});
      var res = IESS.caseStatus.applyFollowUpAction([c], 'C1', ${JSON.stringify(key)});
      return {
        len: res.cases.length,
        isClosed: res.cases[0].isClosed,
        isListClosed: res.cases[0].isListClosed,
        status: res.cases[0].processStatus,
        message: res.message
      };
    })()`);
    assertEq(r.len, 1, `${label} 不建立新案件`);
    assertEq(r.isListClosed, false, `${label} 後自案件處理列表移除`);
    assertEq(r.isClosed, true, `${label} 後仍保留於案件銷案審核`);
    assertEq(r.status, status, `${label} 不更動處理狀態`);
    assertTrue(r.message.indexOf(label) !== -1, `${label} 的提示訊息包含動作名稱`, r.message);
  }

  console.log('\nextend 類動作：建立延伸案件並將原案自處理列表移除');
  for (const [status, key, label] of [
    ['待報價', 'quoteAccept', '接受報價'],
    ['轉汰換', 'toRepair', '轉維修']
  ]) {
    const r = await evaluate(`(function () {
      var c = window.__makeCase(${JSON.stringify(status)});
      var res = IESS.caseStatus.applyFollowUpAction([c], 'C1', ${JSON.stringify(key)});
      var orig = res.cases[0], ext = res.cases[1];
      return {
        len: res.cases.length,
        origListClosed: orig.isListClosed,
        origClosed: orig.isClosed,
        extensionCaseId: orig.extensionCaseId,
        extId: ext && ext.id,
        extNumber: ext && ext.caseNumber,
        extRoot: ext && ext.rootCaseNumber,
        extPrev: ext && ext.prevCaseId,
        extStatus: ext && ext.processStatus,
        extClosed: ext && ext.isClosed,
        extRecords: ext && ext.processRecords.map(function (p) { return p.category3; }),
        message: res.message
      };
    })()`);
    assertEq(r.len, 2, `${label} 建立一筆延伸案件`);
    assertEq(r.origListClosed, false, `${label} 後原案自案件處理列表移除`);
    assertEq(r.origClosed, true, `${label} 後原案仍保留於案件銷案審核`);
    assertEq(r.extensionCaseId, r.extId, `${label} 於原案寫回 extensionCaseId`);
    assertEq(r.extNumber, '20260825001-1', `${label} 延伸案件沿用原編號遞增`);
    assertEq(r.extRoot, '20260825001', `${label} 延伸案件記錄 root 編號`);
    assertEq(r.extPrev, 'C1', `${label} 延伸案件指向先前案件`);
    assertEq(r.extStatus, null, `${label} 延伸案件的處理狀態清空`);
    assertEq(r.extClosed, false, `${label} 延伸案件回到未結案`);
    assertEq((r.extRecords || []).join('|'), '壓縮機', `${label} 延伸案件只承接待處理服務項目`);
    assertTrue(r.message.indexOf('20260825001-1') !== -1,
      `${label} 的提示訊息包含延伸案件編號`, r.message);
  }

  console.log('\n延伸案件防呆：已存在的延伸案件不重複建立');
  const dup = await evaluate(`(function () {
    var c = window.__makeCase('待報價');
    var first = IESS.caseStatus.applyFollowUpAction([c], 'C1', 'quoteAccept');
    // 模擬自銷案審核退回後重新結案、再次點選接受報價。
    var reopened = first.cases.map(function (x) {
      return x.id === 'C1' ? Object.assign({}, x, { isListClosed: true }) : x;
    });
    var second = IESS.caseStatus.applyFollowUpAction(reopened, 'C1', 'quoteAccept');
    return { len: second.cases.length, message: second.message };
  })()`);
  assertEq(dup.len, 2, '既有延伸案件存在時不再多建一筆');
  assertTrue(dup.message.indexOf('已存在') !== -1, '重複時提示延伸案件已存在', dup.message);

  console.log('\n無效輸入');
  assertEq(await evaluate(
    `IESS.caseStatus.applyFollowUpAction([window.__makeCase('待報價')], 'NOPE', 'quoteAccept') === null`),
    true, '找不到案件時回 null');
  assertEq(await evaluate(
    `IESS.caseStatus.applyFollowUpAction([window.__makeCase('待報價')], 'C1', 'vendorDone') === null`),
    true, '動作與處理狀態不相符時回 null');

  console.log('\n人員／車輛佔用：滯留列表的待報價案件仍視為進行中');
  assertEq(await evaluate(
    `AssigneeUtils.hasOpenCasesForAssignee('北區一組', [window.__makeCase('待報價')], [], [])`),
    true, '待報價滯留案件仍佔用組別');
  assertEq(await evaluate(
    `AssigneeUtils.hasOpenCasesForAssignee('北區一組', [window.__makeCase('待報價', { isListClosed: false })], [], [])`),
    false, '待報價案件離開處理列表後釋放組別');
  assertEq(await evaluate(
    `VehicleUtils.hasOpenCasesForVehicle({ id: 'VH1', plateNo: 'ABC-1234' },
       [window.__makeCase('待報價')], [], [])`),
    true, '待報價滯留案件仍佔用車輛');
  assertEq(await evaluate(
    `VehicleUtils.hasOpenCasesForVehicle({ id: 'VH1', plateNo: 'ABC-1234' },
       [window.__makeCase('待報價', { isListClosed: false })], [], [])`),
    false, '待報價案件離開處理列表後釋放車輛');

  console.log('\n列表 UI：後續處理按鈕與選單');
  await evaluate(`
    window.__toasts = [];
    window.__cases = [];
    window.__mkList = function (cases, filter) {
      document.querySelectorAll('.action-menu__menu').forEach(function (m) { m.remove(); });
      var old = document.getElementById('follow-up-host');
      if (old) old.remove();
      var host = document.createElement('div');
      host.id = 'follow-up-host';
      document.body.appendChild(host);
      window.__cases = cases;
      host.appendChild(CaseList({
        cases: cases,
        setCases: function (next) { window.__cases = next; },
        stores: [], setStores: function () {},
        setEditingCase: function () {}, setView: function () {},
        showToast: function (msg) { window.__toasts.push(msg); },
        statusFilter: filter, setStatusFilter: function () {}
      }));
      return true;
    };
    window.__actionLabels = function () {
      return Array.prototype.map.call(
        document.querySelectorAll('#follow-up-host tbody tr:first-child td:first-child button'),
        function (b) { return b.getAttribute('aria-label'); }
      );
    };
    window.__clickAction = function (label) {
      var btn = Array.prototype.slice.call(
        document.querySelectorAll('#follow-up-host tbody tr:first-child td:first-child button')
      ).filter(function (b) { return b.getAttribute('aria-label') === label; })[0];
      if (!btn) throw new Error('操作欄找不到：' + label);
      btn.click();
      return true;
    };
    window.__menuItems = function () {
      return Array.prototype.map.call(
        document.querySelectorAll('.action-menu__menu .action-menu__item'),
        function (b) { return b.textContent.trim(); }
      );
    };
    window.__clickMenuItem = function (label) {
      var btn = Array.prototype.slice.call(
        document.querySelectorAll('.action-menu__menu .action-menu__item')
      ).filter(function (b) { return b.textContent.trim() === label; })[0];
      if (!btn) throw new Error('選單中找不到：' + label);
      btn.click();
      return true;
    };
    window.__modalText = function () {
      var overlay = document.querySelector('#follow-up-host .app-modal-overlay');
      if (!overlay) return null;
      return {
        title: overlay.querySelector('h3').textContent.trim(),
        body: overlay.querySelector('p').textContent.trim()
      };
    };
    window.__confirmModal = function () {
      var overlay = document.querySelector('#follow-up-host .app-modal-overlay');
      var btns = overlay.querySelectorAll('button');
      btns[btns.length - 1].click();
      return true;
    };
    'ok'`);

  await evaluate(`window.__mkList([window.__makeCase('待報價')], '待報價')`);
  assertEq(await evaluate('window.__actionLabels()'),
    ['編輯', '此案件已結案', '後續處理', '更多'],
    '滯留列表的待報價案件顯示後續處理按鈕，結案鈕已停用');

  await evaluate(`window.__clickAction('後續處理')`);
  assertEq(await evaluate('window.__menuItems()'), ['接受報價', '拒絕報價'],
    '待報價的後續處理選單');

  await evaluate(`window.__clickMenuItem('接受報價')`);
  const modal = await evaluate('window.__modalText()');
  assertEq(modal.title, '確認接受報價', '確認視窗標題為動作名稱');
  assertTrue(modal.body.indexOf('20260825001-1') !== -1,
    '確認視窗顯示即將建立的延伸案件編號', modal.body);

  await evaluate('window.__confirmModal()');
  const applied = await evaluate(`({
    len: window.__cases.length,
    origListClosed: window.__cases[0].isListClosed,
    toast: window.__toasts[window.__toasts.length - 1]
  })`);
  assertEq(applied.len, 2, '確認後建立延伸案件');
  assertEq(applied.origListClosed, false, '確認後原案自處理列表移除');
  assertTrue(applied.toast.indexOf('20260825001-1') !== -1, '提示延伸案件編號', applied.toast);

  await evaluate(`window.__mkList([window.__makeCase('轉汰換')], '轉汰換')`);
  await evaluate(`window.__clickAction('後續處理')`);
  assertEq(await evaluate('window.__menuItems()'), ['轉維修', '汰換完成'], '轉汰換的後續處理選單');

  await evaluate(`window.__mkList([window.__makeCase('轉原廠')], '轉原廠')`);
  await evaluate(`window.__clickAction('後續處理')`);
  assertEq(await evaluate('window.__menuItems()'), ['轉原廠完成'], '轉原廠的後續處理選單');

  await evaluate(
    `window.__mkList([window.__makeCase('待料件', { isClosed: false, isListClosed: false })], '待料件')`);
  assertEq(await evaluate('window.__actionLabels()'), ['編輯', '案件結案', '更多'],
    '待料件案件沒有後續處理按鈕');

  // 待料件結案後會建立延伸案件並離開處理列表，因此列表中查無此案。
  await evaluate(`window.__mkList([window.__makeCase('待料件')], '待料件')`);
  assertEq(await evaluate('window.__actionLabels()'), [],
    '已結案的待料件案件不再出現於案件處理列表');

  assertEq(consoleErrors.length, 0, '列表操作後仍無 JS 錯誤');

  console.log('\n列表顯示：待報價結案後仍留在案件處理列表');
  assertEq(await evaluate(`(function () {
    var c = window.__makeCase('待報價');
    return IESS.caseStatus.isListRetainedStatus(c.processStatus) && c.isClosed && c.isListClosed;
  })()`), true, '待報價案件結案後 isListClosed 為 true');
} catch (err) {
  console.error(err);
  failed++;
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
