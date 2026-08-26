#!/usr/bin/env node
/**
 * 叫修案件多筆設備的版面優化：一次只顯示一張設備卡片，靠左右切換列換台；
 * 卡片內的設備唯讀資料預設收成一行重點，展開才看到完整欄位。
 * 涵蓋切換元件本身、編輯表單／唯讀明細／派工明細的切換行為，以及 PDF 仍輸出全部設備。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9386);

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
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-item-pager-profile',
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

  const todayDate = await evaluate('todayDate');

  await evaluate(`
    window.__eq = function (id, name, model) {
      return {
        id: id, customerName: '測試客戶', storeName: '測試門市',
        category: '分離式', brand: '大金', deviceName: name,
        specification: '2.2kW', model: model, equipmentLevel: '增額設備',
        area: '賣場區', acceptanceDate: '2020-02-01', installer: '王小明',
        assetNumber: 'A-' + id, serialNumber: 'SN-' + id, status: '運轉中',
        createdDate: '${todayDate}'
      };
    };
    window.__item = function (n) {
      return {
        id: 'SI' + n,
        equipment: window.__eq('E' + n, '設備' + n, 'MODEL-' + n),
        actualReason: '原因' + n,
        remarks: '備註' + n,
        processRecords: []
      };
    };
    window.__mkCase = function (count) {
      var items = [];
      for (var i = 1; i <= count; i++) items.push(window.__item(i));
      return {
        id: 'C1', caseNumber: '20260825001', customerName: '測試客戶', storeName: '測試門市',
        companyCity: '台北市', companyDistrict: '中山區', workCategory: '一般叫修',
        repairItem: '室內機', repairReason: '不冷', faultDesc: '出風不冷',
        isClosed: false, processStatus: null, assignees: [],
        createdAt: '${todayDate} 09:00:00', repairDate: '${todayDate} 09:00:00',
        expectedDate: '${todayDate}', expectedTimeStart: '09:00', expectedTimeEnd: '11:00',
        serviceItems: items
      };
    };
    // 切換列與其按鈕的共用查詢；以 data-role 定位，避免抓到卡片內其他按鈕
    window.__pager = function (root) {
      if (root.matches && root.matches('[data-role="service-item-pager"]')) return root;
      return root.querySelector('[data-role="service-item-pager"]');
    };
    // 只取計數文字；圖示按鈕的 tooltip 也在切換列內，會混進 textContent
    window.__pagerText = function (root) {
      var p = window.__pager(root);
      var label = p && p.querySelector('[data-role="service-item-pager-label"]');
      return label ? label.textContent.replace(/\\s+/g, ' ').trim() : null;
    };
    // 圖示按鈕會被 icon-button 的 tooltip 包裝重建，aria-label 是保留下來的把手
    window.__PAGER_LABEL = { prev: '上一台設備', next: '下一台設備' };
    window.__pagerBtn = function (root, dir) {
      var p = window.__pager(root);
      return p ? p.querySelector('button[aria-label="' + window.__PAGER_LABEL[dir] + '"]') : null;
    };
    // 目前渲染幾張卡片：以卡片內的備註欄計數
    window.__cardRemarks = function (root) {
      return Array.prototype.map.call(
        root.querySelectorAll('[name="serviceItemRemarks"]'),
        function (t) { return t.value; }
      );
    };
  `);

  console.log('\n切換元件本身');
  const pager = await evaluate(`(function () {
    var calls = [];
    function mk(index, total) {
      return RepairCaseServiceItemPager({
        h: IESS.h, index: index, total: total,
        onPrev: function (i) { calls.push({ dir: 'prev', index: i }); },
        onNext: function (i) { calls.push({ dir: 'next', index: i }); }
      });
    }
    var single = mk(0, 1);
    var none = mk(0, 0);
    var middle = mk(1, 3);
    var first = mk(0, 3);
    var last = mk(2, 3);
    document.body.appendChild(middle);
    window.__pagerBtn(middle, 'prev').click();
    window.__pagerBtn(middle, 'next').click();
    var out = {
      single: single,
      none: none,
      middleText: window.__pagerText(middle),
      firstPrevDisabled: window.__pagerBtn(first, 'prev').disabled,
      firstNextDisabled: window.__pagerBtn(first, 'next').disabled,
      lastPrevDisabled: window.__pagerBtn(last, 'prev').disabled,
      lastNextDisabled: window.__pagerBtn(last, 'next').disabled,
      calls: calls
    };
    middle.remove();
    return out;
  })()`);
  assertEq(pager.single, null, '只有一台設備時不顯示切換列');
  assertEq(pager.none, null, '沒有設備時不顯示切換列');
  assertEq(pager.middleText, '設備 2 / 3', '切換列顯示目前第幾台／共幾台');
  assertEq(pager.firstPrevDisabled, true, '第一台時上一台停用');
  assertEq(pager.firstNextDisabled, false, '第一台時下一台可用');
  assertEq(pager.lastPrevDisabled, false, '最後一台時上一台可用');
  assertEq(pager.lastNextDisabled, true, '最後一台時下一台停用');
  assertEq(pager.calls, [{ dir: 'prev', index: 0 }, { dir: 'next', index: 2 }], '回呼帶切換後的 index');

  console.log('\n設備唯讀資料收成一行');
  const panel = await evaluate(`(function () {
    var eq = window.__eq('E1', '室內機', 'FTXS');
    var collapsed = RepairCaseEquipment.Panel({
      h: IESS.h, equipment: eq, caseContext: {}, deviceCategories: [], collapsible: true
    });
    var plain = RepairCaseEquipment.Panel({
      h: IESS.h, equipment: eq, caseContext: {}, deviceCategories: []
    });
    document.body.appendChild(collapsed);
    var summary = collapsed.querySelector('summary');
    var summaryText = summary ? summary.textContent.replace(/\\s+/g, ' ').trim() : null;
    var out = {
      isDetails: collapsed.tagName.toLowerCase(),
      defaultOpen: collapsed.open,
      summaryText: summaryText,
      // 展開後仍看得到完整 12 欄
      fieldCount: RepairCaseEquipment.FIELD_DEFS.length,
      hasInstaller: collapsed.textContent.indexOf('安裝人員') !== -1,
      hasSerial: collapsed.textContent.indexOf('SN-E1') !== -1,
      plainIsDetails: plain.tagName.toLowerCase() === 'details'
    };
    collapsed.remove();
    return out;
  })()`);
  assertEq(panel.isDetails, 'details', 'collapsible 的設備資料用 details 呈現');
  assertEq(panel.defaultOpen, false, '設備資料預設收合');
  assertEq(panel.summaryText, '分離式 · 室內機 · FTXS · 賣場區 · 運轉中', '摘要列是一行重點');
  assertEq(panel.hasInstaller, true, '展開內容仍有完整欄位（安裝人員）');
  assertEq(panel.hasSerial, true, '展開內容仍有完整欄位（流水序號）');
  assertEq(panel.plainIsDetails, false, '未指定 collapsible 時維持原本版面');

  console.log('\n編輯表單一次一台');
  const form = await evaluate(`(function () {
    var wrap = document.createElement('div');
    document.body.appendChild(wrap);
    wrap.appendChild(EditCaseForm({
      editingCase: window.__mkCase(3),
      cases: [], setCases: function () {}, stores: [], customers: [],
      equipments: [], deviceCategories: [], processMethods: [],
      setView: function () {}, showToast: function () {}
    }));
    var out = { steps: [] };
    function snap(label) {
      out.steps.push({
        label: label,
        pager: window.__pagerText(wrap),
        remarks: window.__cardRemarks(wrap)
      });
    }
    snap('初始');
    window.__pagerBtn(wrap, 'next').click();
    snap('下一台');
    window.__pagerBtn(wrap, 'next').click();
    snap('再下一台');
    window.__pagerBtn(wrap, 'prev').click();
    snap('上一台');
    // 移除目前這張（第 2 台）後，index 需夾在範圍內且改顯示其他卡片
    wrap.querySelector('button[aria-label="移除此設備"]').click();
    snap('移除目前卡片');
    wrap.remove();
    return out;
  })()`);
  assertEq(form.steps[0].remarks, ['備註1'], '編輯表單初始只渲染第一張卡片');
  assertEq(form.steps[0].pager, '設備 1 / 3', '編輯表單顯示切換列');
  assertEq(form.steps[1].remarks, ['備註2'], '按下一台換到第二張');
  assertEq(form.steps[2].remarks, ['備註3'], '再按一次換到第三張');
  assertEq(form.steps[3].remarks, ['備註2'], '按上一台回到第二張');
  assertEq(form.steps[4].pager, '設備 2 / 2', '移除後總數更新且 index 夾在範圍內');
  assertEq(form.steps[4].remarks, ['備註3'], '移除第二張後顯示原本的第三張');

  console.log('\n編輯表單：加入設備自動跳到新卡片');
  const added = await evaluate(`(function () {
    var wrap = document.createElement('div');
    document.body.appendChild(wrap);
    var newEq = window.__eq('E9', '新設備', 'NEW-9');
    wrap.appendChild(EditCaseForm({
      editingCase: window.__mkCase(2),
      cases: [], setCases: function () {}, stores: [], customers: [],
      equipments: [newEq], deviceCategories: [], processMethods: [],
      setView: function () {}, showToast: function () {}
    }));
    function findBtn(text) {
      return Array.prototype.find.call(wrap.querySelectorAll('button'), function (b) {
        return b.textContent.replace(/\\s+/g, ' ').trim().indexOf(text) !== -1;
      });
    }
    var before = window.__pagerText(wrap);
    findBtn('加入設備').click();
    findBtn('掃描 QR Code').click();
    var out = {
      before: before,
      after: window.__pagerText(wrap),
      remarks: window.__cardRemarks(wrap),
      summary: (function () {
        var s = wrap.querySelector('summary');
        return s ? s.textContent.replace(/\\s+/g, ' ').trim() : null;
      })()
    };
    wrap.remove();
    return out;
  })()`);
  assertEq(added.before, '設備 1 / 2', '加入前在第一台');
  assertEq(added.after, '設備 3 / 3', '加入設備後自動跳到新卡片');
  assertEq(added.remarks, [''], '新卡片的備註為空');
  assertTrue(
    added.summary && added.summary.indexOf('NEW-9') !== -1,
    '新卡片顯示新設備的摘要',
    added.summary
  );

  console.log('\n單一設備不出現切換列');
  const single = await evaluate(`(function () {
    var wrap = document.createElement('div');
    document.body.appendChild(wrap);
    wrap.appendChild(EditCaseForm({
      editingCase: window.__mkCase(1),
      cases: [], setCases: function () {}, stores: [], customers: [],
      equipments: [], deviceCategories: [], processMethods: [],
      setView: function () {}, showToast: function () {}
    }));
    var out = { pager: window.__pagerText(wrap), remarks: window.__cardRemarks(wrap) };
    wrap.remove();
    return out;
  })()`);
  assertEq(single.pager, null, '只有一台設備時編輯表單沒有切換列');
  assertEq(single.remarks, ['備註1'], '仍正常渲染那一張卡片');

  console.log('\n唯讀明細一次一台');
  const view = await evaluate(`(function () {
    var wrap = document.createElement('div');
    document.body.appendChild(wrap);
    wrap.appendChild(ViewCaseForm({
      viewingCase: window.__mkCase(3), setView: function () {}, backView: 'list',
      processMethods: [], deviceCategories: [], vehicles: [], vendors: [],
      cases: [], openPrevCase: function () {}, currentView: 'case-view'
    }));
    function shown() {
      var text = wrap.textContent.replace(/\\s+/g, ' ');
      return ['備註1', '備註2', '備註3'].filter(function (t) {
        return text.indexOf(t) !== -1;
      });
    }
    var out = { first: shown(), pager: window.__pagerText(wrap) };
    window.__pagerBtn(wrap, 'next').click();
    out.second = shown();
    out.secondPager = window.__pagerText(wrap);
    wrap.remove();
    return out;
  })()`);
  assertEq(view.first, ['備註1'], '唯讀明細初始只顯示第一台');
  assertEq(view.pager, '設備 1 / 3', '唯讀明細有切換列');
  assertEq(view.second, ['備註2'], '唯讀明細可切到第二台');
  assertEq(view.secondPager, '設備 2 / 3', '唯讀明細切換列跟著更新');

  console.log('\n派工明細一次一台');
  const arrangement = await evaluate(`(function () {
    var c = window.__mkCase(3);
    var h = IESS.h;
    var calls = [];
    function render(activeIndex) {
      return CaseArrangement.renderScheduleServiceItems(c, {
        h: h, deviceCategories: [],
        ReadOnlyField: function (p) {
          return h('div', null, h('span', null, p.label), h('span', null, p.value));
        },
        renderScheduleFieldLabel: function (label) { return h('label', null, label); },
        inputCls: 'w-full', isClosed: false, processMethods: [],
        onReasonChange: function () {},
        onRemarksChange: function () {},
        activeIndex: activeIndex,
        onActiveIndexChange: function (i) { calls.push(i); }
      });
    }
    var node = render(0);
    document.body.appendChild(node);
    var out = {
      firstRemarks: window.__cardRemarks(node),
      firstPager: window.__pagerText(node)
    };
    window.__pagerBtn(node, 'next').click();
    node.remove();
    var node2 = render(1);
    document.body.appendChild(node2);
    out.secondRemarks = window.__cardRemarks(node2);
    out.secondPager = window.__pagerText(node2);
    out.calls = calls;
    node2.remove();
    return out;
  })()`);
  assertEq(arrangement.firstRemarks, ['備註1'], '派工明細初始只顯示第一台');
  assertEq(arrangement.firstPager, '設備 1 / 3', '派工明細有切換列');
  assertEq(arrangement.calls, [1], '切換時回呼帶新的 index 給呼叫端');
  assertEq(arrangement.secondRemarks, ['備註2'], 'activeIndex 為 1 時顯示第二台');
  assertEq(arrangement.secondPager, '設備 2 / 3', '派工明細切換列跟著 activeIndex');

  console.log('\nPDF 仍輸出全部設備');
  const pdf = await evaluate(`(function () {
    var html = buildCasePdfHtml(window.__mkCase(3), {
      deviceCategories: [], processMethods: []
    });
    return {
      all: ['備註1', '備註2', '備註3'].every(function (t) { return html.indexOf(t) !== -1; }),
      models: ['MODEL-1', 'MODEL-2', 'MODEL-3'].every(function (t) { return html.indexOf(t) !== -1; }),
      hasPager: html.indexOf('service-item-pager') !== -1,
      hasDetails: html.indexOf('<details') !== -1
    };
  })()`);
  assertEq(pdf.all, true, 'PDF 輸出全部三台的備註');
  assertEq(pdf.models, true, 'PDF 輸出全部三台的型號');
  assertEq(pdf.hasPager, false, 'PDF 不含切換列');
  assertEq(pdf.hasDetails, false, 'PDF 的設備欄位不收合');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
