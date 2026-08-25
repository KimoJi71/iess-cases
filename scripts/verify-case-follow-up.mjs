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
        faultDesc: '出風不冷', reporter: '王小明',
        assignees: ['北區一組'], assigneeMemberIds: ['M1'], partnerVendorIds: ['V1'],
        vehicleId: 'VH1',
        serviceItems: [{
          id: 'SI1',
          equipment: { id: 'E1', category: '分離式', brand: '日立', specification: '3.5匹' },
          actualReason: '缺冷媒',
          processRecords: [
            { id: 1, processMethodId: 'PM1', category1: '冷氣', category2: '維修',
              category3: '加冷媒', specification: 'R410', unit: '式', points: 3, qty: 1, status: '已處理' },
            { id: 2, processMethodId: 'PM2', category1: '冷氣', category2: '更換',
              category3: '壓縮機', specification: '3.5匹', unit: '台', points: 8, qty: 2, status: '待處理' }
          ]
        }],
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
        extRecords: ext && window.RepairCaseServiceItems.getAllProcessRecords(ext)
          .map(function (p) { return p.category3; }),
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

  console.log('\n後續處理結果欄位：定義');
  const fieldsOf = async (status) => evaluate(
    `IESS.caseStatus.getFollowUpFields(window.__makeCase(${JSON.stringify(status)}))
       .map(function (f) { return f.key + ':' + f.label + ':' + f.value; })`);

  assertEq((await fieldsOf('待報價')).join('|'),
    'status:報價狀態:|at:修改報價狀態時間:', '待報價的欄位為 報價狀態／修改報價狀態時間');
  assertEq((await fieldsOf('轉汰換')).join('|'),
    'status:汰換狀態:|at:修改汰換狀態時間:', '轉汰換的欄位為 汰換狀態／修改汰換狀態時間');
  assertEq((await fieldsOf('轉原廠')).join('|'),
    'at:轉原廠完成時間:', '轉原廠只有 轉原廠完成時間 一欄');
  assertEq((await fieldsOf('待料件')).length, 0, '待料件沒有後續處理結果欄位');
  assertEq((await fieldsOf('案件完成')).length, 0, '案件完成沒有後續處理結果欄位');
  assertEq(await evaluate('IESS.caseStatus.getFollowUpFields(null).length'), 0,
    '案件為 null 時回空陣列');

  console.log('\n後續處理結果欄位：動作押上狀態與時間');
  const TS_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  for (const [status, key, label, expectStatus] of [
    ['待報價', 'quoteAccept', '接受報價', '接受'],
    ['待報價', 'quoteReject', '拒絕報價', '拒絕'],
    ['轉汰換', 'toRepair', '轉維修', '轉維修'],
    ['轉汰換', 'replaceDone', '汰換完成', '完成'],
    ['轉原廠', 'vendorDone', '轉原廠完成', '完成']
  ]) {
    const r = await evaluate(`(function () {
      var res = IESS.caseStatus.applyFollowUpAction(
        [window.__makeCase(${JSON.stringify(status)})], 'C1', ${JSON.stringify(key)});
      var orig = res.cases[0];
      return {
        followUpStatus: orig.followUpStatus,
        followUpStatusAt: orig.followUpStatusAt,
        fields: IESS.caseStatus.getFollowUpFields(orig)
          .map(function (f) { return f.label + '=' + f.value; }),
        extFollowUp: res.cases[1] ? res.cases[1].followUpStatus : undefined
      };
    })()`);
    assertEq(r.followUpStatus, expectStatus, `${label} 押上 followUpStatus`);
    assertTrue(TS_RE.test(r.followUpStatusAt || ''),
      `${label} 押上 followUpStatusAt`, r.followUpStatusAt);
    assertTrue(r.fields[0].endsWith('=' + (status === '轉原廠' ? r.followUpStatusAt : expectStatus)),
      `${label} 後第一個結果欄位帶值`, r.fields.join('|'));
    if (status !== '轉原廠') {
      assertEq(r.fields[1], (status === '待報價' ? '修改報價狀態時間=' : '修改汰換狀態時間=')
        + r.followUpStatusAt, `${label} 後時間欄位顯示押上的時間`);
    }
    assertEq(r.extFollowUp, undefined, `${label} 的延伸案件不帶後續處理結果`);
  }

  console.log('\n後續處理結果欄位：資料調閱匯出');
  assertTrue(await evaluate(
    `DataRetrievalUtils.getColumns('維修').join('|').indexOf('處理狀態|後續處理狀態|後續處理時間|結案狀態') !== -1`),
    '維修匯出欄位在處理狀態後接後續處理狀態／時間');
  const exported = await evaluate(`(function () {
    var res = IESS.caseStatus.applyFollowUpAction(
      [window.__makeCase('待報價')], 'C1', 'quoteReject');
    var rows = DataRetrievalUtils.buildRows('維修', res.cases, []);
    var pending = DataRetrievalUtils.buildRows('維修', [window.__makeCase('轉汰換')], []);
    return {
      status: rows[0]['後續處理狀態'],
      at: rows[0]['後續處理時間'],
      pendingStatus: pending[0]['後續處理狀態'],
      pendingAt: pending[0]['後續處理時間']
    };
  })()`);
  assertEq(exported.status, '拒絕', '匯出帶出後續處理狀態');
  assertTrue(TS_RE.test(exported.at || ''), '匯出帶出後續處理時間', exported.at);
  assertEq(exported.pendingStatus, '—', '尚未後續處理時匯出狀態為 —');
  assertEq(exported.pendingAt, '—', '尚未後續處理時匯出時間為 —');

  console.log('\n後續處理結果欄位：案件 PDF');
  const pdf = await evaluate(`(function () {
    var res = IESS.caseStatus.applyFollowUpAction(
      [window.__makeCase('轉汰換')], 'C1', 'replaceDone');
    return {
      done: buildCasePdfHtml(res.cases[0], { processMethods: [], deviceCategories: [] }),
      pending: buildCasePdfHtml(window.__makeCase('轉原廠'), { processMethods: [], deviceCategories: [] }),
      plain: buildCasePdfHtml(window.__makeCase('案件完成'), { processMethods: [], deviceCategories: [] }),
      at: res.cases[0].followUpStatusAt
    };
  })()`);
  assertTrue(pdf.done.indexOf('汰換狀態') !== -1 && pdf.done.indexOf('修改汰換狀態時間') !== -1,
    'PDF 帶出汰換狀態與修改時間欄位');
  assertTrue(pdf.done.indexOf(pdf.at) !== -1, 'PDF 顯示押上的時間', pdf.at);
  assertTrue(pdf.pending.indexOf('轉原廠完成時間') !== -1,
    '轉原廠 PDF 帶出轉原廠完成時間欄位');
  assertTrue(pdf.plain.indexOf('報價狀態') === -1 && pdf.plain.indexOf('汰換狀態') === -1,
    '非滯留狀態的 PDF 不出現後續處理欄位');

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

  assertEq(await evaluate(`(function () {
    var btns = document.querySelectorAll('#follow-up-host tbody tr:first-child td:first-child button');
    var closeIcon = btns[1].querySelector('svg').innerHTML;
    var followUpIcon = btns[2].querySelector('svg').innerHTML;
    return closeIcon !== followUpIcon;
  })()`), true, '案件結案與後續處理的圖示不同');

  await evaluate(`window.__clickAction('後續處理')`);
  assertEq(await evaluate('window.__menuItems()'), ['接受報價', '拒絕報價'],
    '待報價的後續處理選單');
  assertEq(await evaluate(`(function () {
    var items = document.querySelectorAll('.action-menu__menu .action-menu__item');
    return items[0].querySelector('svg').innerHTML !== items[1].querySelector('svg').innerHTML;
  })()`), true, '延伸類與結束類選項的圖示不同');

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

  console.log('\n已結案案件：編輯鈕改開唯讀明細');
  await evaluate(`
    window.__views = [];
    window.__viewing = null;
    window.__mkListWithNav = function (cases, filter) {
      document.querySelectorAll('.action-menu__menu').forEach(function (m) { m.remove(); });
      var old = document.getElementById('follow-up-host');
      if (old) old.remove();
      var host = document.createElement('div');
      host.id = 'follow-up-host';
      document.body.appendChild(host);
      window.__views = [];
      window.__viewing = null;
      window.__editing = null;
      host.appendChild(CaseList({
        cases: cases,
        setCases: function () {},
        stores: [], setStores: function () {},
        setEditingCase: function (c) { window.__editing = c && c.id; },
        setViewingCase: function (c) { window.__viewing = c && c.id; },
        setView: function (v) { window.__views.push(v); },
        showToast: function () {},
        statusFilter: filter, setStatusFilter: function () {}
      }));
      return true;
    };
    'ok'`);

  await evaluate(`window.__mkListWithNav([window.__makeCase('待報價')], '待報價')`);
  assertEq(await evaluate('window.__actionLabels()[0]'), '編輯',
    '已結案案件仍顯示編輯按鈕');
  await evaluate(`window.__clickAction('編輯')`);
  assertEq(await evaluate('({ views: window.__views, viewing: window.__viewing, editing: window.__editing })'),
    { views: ['case-view'], viewing: 'C1', editing: null },
    '已結案案件的編輯鈕開啟唯讀明細，不進入編輯表單');

  await evaluate(
    `window.__mkListWithNav([window.__makeCase('待報價', { isClosed: false, isListClosed: false })], '待報價')`);
  await evaluate(`window.__clickAction('編輯')`);
  assertEq(await evaluate('({ views: window.__views, viewing: window.__viewing, editing: window.__editing })'),
    { views: ['edit'], viewing: null, editing: 'C1' },
    '未結案案件的編輯鈕仍進入編輯表單');

  console.log('\n唯讀明細：結案提示與無可編輯欄位');
  await evaluate(`
    window.__mkDetail = function (targetCase) {
      var old = document.getElementById('detail-host');
      if (old) old.remove();
      var host = document.createElement('div');
      host.id = 'detail-host';
      document.body.appendChild(host);
      host.appendChild(ViewCaseForm({
        viewingCase: targetCase, setView: function (v) { window.__views.push(v); },
        backView: 'list', currentView: 'case-view',
        notice: '此案件已結案，已轉為叫修案件紀錄，僅供檢視、不可編輯。',
        processMethods: [], deviceCategories: [], vehicles: [], vendors: [], cases: []
      }));
      return true;
    };
    'ok'`);
  await evaluate(`window.__mkDetail(window.__makeCase('待報價'))`);
  assertTrue(await evaluate(
    `document.querySelector('#detail-host').textContent.indexOf('僅供檢視、不可編輯') !== -1`),
    '唯讀明細顯示已結案提示文字');
  assertEq(await evaluate(`(function () {
    return Array.prototype.filter.call(
      document.querySelectorAll('#detail-host input, #detail-host select, #detail-host textarea'),
      function (el) { return !el.disabled && !el.readOnly; }
    ).length;
  })()`), 0, '唯讀明細沒有任何可編輯欄位');

  console.log('\n唯讀明細：處理狀態後方的後續處理結果欄位');
  // 取「處理狀態」起算的 n 個唯讀欄位，驗證後續處理欄位確實接在它後面。
  const detailFields = async (targetCaseExpr, n) => evaluate(`(function () {
    window.__mkDetail(${targetCaseExpr});
    var labels = Array.prototype.slice.call(
      document.querySelectorAll('#detail-host span.text-gray-500'));
    var idx = -1;
    labels.forEach(function (el, i) { if (el.textContent.trim() === '處理狀態') idx = i; });
    return labels.slice(idx, idx + ${n}).map(function (el) {
      return el.textContent.trim() + '=' + el.nextSibling.textContent.trim();
    });
  })()`);

  assertEq(await detailFields(`window.__makeCase('待報價')`, 4),
    ['處理狀態=待報價', '報價狀態=—', '修改報價狀態時間=—', '客戶簽收=尚未簽收'],
    '尚未後續處理的待報價明細顯示欄位且值為 —');

  const appliedFields = await detailFields(`(function () {
      var res = IESS.caseStatus.applyFollowUpAction(
        [window.__makeCase('待報價')], 'C1', 'quoteReject');
      window.__applied = res.cases[0];
      return window.__applied;
    })()`, 3);
  assertEq(appliedFields, await evaluate(
    `['處理狀態=待報價', '報價狀態=拒絕', '修改報價狀態時間=' + window.__applied.followUpStatusAt]`),
    '拒絕報價後明細顯示報價狀態與修改時間');

  assertEq(await detailFields(`window.__makeCase('轉原廠')`, 3),
    ['處理狀態=轉原廠', '轉原廠完成時間=—', '客戶簽收=尚未簽收'],
    '轉原廠明細只多出轉原廠完成時間一欄');

  assertEq(await detailFields(`window.__makeCase('案件完成')`, 3),
    ['處理狀態=案件完成', '客戶簽收=尚未簽收', '維修備註=-'],
    '非滯留狀態的明細不出現後續處理欄位');

  console.log('\n真實 app：case-view 路由與返回');
  const routed = await evaluate(`(function () {
    // 先移除前面直接掛載元件用的測試容器，避免混入真實 app 的斷言。
    ['follow-up-host', 'detail-host'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });
    document.querySelectorAll('.action-menu__menu').forEach(function (m) { m.remove(); });
    var nav = window.__caseNavForTest;
    var s = nav.store.get();
    var target = s.cases.filter(function (c) { return c.isClosed; })[0];
    nav.store.set({ view: 'case-view', viewingCase: target });
    var root = document.getElementById('app') || document.body;
    var text = root.textContent;
    var editable = Array.prototype.filter.call(
      root.querySelectorAll('input, select, textarea'),
      function (el) { return !el.disabled && !el.readOnly; }
    ).length;
    return {
      hasTitle: text.indexOf('查看案件明細') !== -1,
      hasNotice: text.indexOf('僅供檢視、不可編輯') !== -1,
      hasCaseNumber: text.indexOf(target.caseNumber) !== -1,
      editable: editable,
    };
  })()`);
  assertEq(routed.hasTitle, true, 'case-view 路由渲染查看案件明細');
  assertEq(routed.hasNotice, true, 'case-view 路由帶入結案提示');
  assertEq(routed.hasCaseNumber, true, 'case-view 顯示該案件編號');
  assertEq(routed.editable, 0, 'case-view 全頁無可編輯欄位');

  assertEq(await evaluate(`(function () {
    var root = document.getElementById('app') || document.body;
    var back = Array.prototype.slice.call(root.querySelectorAll('button'))
      .filter(function (b) { return (b.getAttribute('aria-label') || '') === '關閉'; })[0]
      || root.querySelector('.page-header-sticky button');
    back.click();
    return window.__caseNavForTest.store.get().view;
  })()`), 'list', '返回鍵回到案件處理列表');
  assertEq(consoleErrors.length, 0, 'case-view 路由無 JS 錯誤');

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
