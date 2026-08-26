#!/usr/bin/env node
/**
 * 叫修案件：備註跟著設備走，一張「設備＋服務項目」卡片一個備註。
 * 涵蓋資料層遷移（舊案件層級 remarks 併進第一張卡片）、編輯表單逐卡片編輯、
 * 唯讀明細／PDF／派工明細逐設備呈現，以及沒有卡片的「其他」案件維持案件層級備註。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9384);

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
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-item-remarks-profile',
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
        category: '空調', brand: '大金', deviceName: name,
        specification: '2.2kW', model: model, equipmentLevel: '增額設備',
        area: '廚房', acceptanceDate: '2020-02-01', installer: '王小明',
        assetNumber: 'A-' + id, serialNumber: 'SN-' + id, status: '運轉中',
        createdDate: '${todayDate}'
      };
    };
    window.__rec = function (id, cat3) {
      return { id: id, category1: '維修', category2: '空調', category3: cat3,
        specification: '標準', qty: 1, unit: '台', points: 2, status: '已處理' };
    };
    window.__baseCase = function () {
      return {
        id: 'C1', caseNumber: '20260825001', customerName: '測試客戶', storeName: '測試門市',
        companyCity: '台北市', companyDistrict: '中山區', workCategory: '一般叫修',
        repairItem: '室內機', repairReason: '不冷', faultDesc: '出風不冷',
        isClosed: false, processStatus: null, assignees: [],
        createdAt: '${todayDate} 09:00:00', repairDate: '${todayDate} 09:00:00',
        expectedDate: '${todayDate}', expectedTimeStart: '09:00', expectedTimeEnd: '11:00'
      };
    };
    // 兩張卡片、各自備註，供表單／明細／PDF／派工明細共用
    window.__twoItemCase = function () {
      var c = window.__baseCase();
      c.serviceItems = [
        { id: 'SI1', equipment: window.__eq('E1', '室內機', 'FTXS'),
          actualReason: '第一台濾網堵塞', remarks: '第一台備註', processRecords: [window.__rec(1, '清洗')] },
        { id: 'SI2', equipment: window.__eq('E2', '冰水主機', 'CH-200'),
          actualReason: '第二台軸承磨損', remarks: '第二台備註', processRecords: [window.__rec(2, '更換')] }
      ];
      return c;
    };
    window.__text = function (node) { return node.textContent.replace(/\\s+/g, ' '); };
    // 多筆設備改成一次只顯示一張卡片，測試需要能在卡片之間切換。
    // 切換鈕是圖示按鈕，會被 icon-button 的 tooltip 包裝重建，故以 aria-label 定位。
    window.__pagerOf = function (root) {
      return root.querySelector('[data-role="service-item-pager"]');
    };
    window.__pagerTotal = function (root) {
      var label = root.querySelector('[data-role="service-item-pager-label"]');
      if (!label) return 1;
      return Number(label.textContent.split('/')[1].trim());
    };
    window.__pagerIndex = function (root) {
      var label = root.querySelector('[data-role="service-item-pager-label"]');
      if (!label) return 0;
      return Number(label.textContent.replace('設備', '').split('/')[0].trim()) - 1;
    };
    window.__gotoCard = function (root, target) {
      for (var guard = 0; guard < 20; guard++) {
        var cur = window.__pagerIndex(root);
        if (cur === target) return true;
        var pager = window.__pagerOf(root);
        if (!pager) return false;
        var label = cur < target ? '下一台設備' : '上一台設備';
        var btn = pager.querySelector('button[aria-label="' + label + '"]');
        if (!btn || btn.disabled) return false;
        btn.click();
      }
      return false;
    };
    // 逐張切過去收集，回傳每張卡片經 collect(root) 得到的值
    window.__eachCard = function (root, collect) {
      var total = window.__pagerTotal(root);
      var out = [];
      for (var i = 0; i < total; i++) {
        window.__gotoCard(root, i);
        out.push(collect(root));
      }
      return out;
    };

  `);

  console.log('\n資料層：備註屬於卡片');
  const model = await evaluate(`(function () {
    var created = RepairCaseServiceItems.createItem(window.__eq('E1', '室內機', 'FTXS'));
    var normalized = RepairCaseServiceItems.normalizeItem({ id: 'SI9', remarks: '保留' });
    var normalizedEmpty = RepairCaseServiceItems.normalizeItem({ id: 'SI9' });
    return {
      createdRemarks: created.remarks,
      normalizedRemarks: normalized.remarks,
      normalizedEmpty: normalizedEmpty.remarks
    };
  })()`);
  assertEq(model.createdRemarks, '', 'createItem 產出空備註欄');
  assertEq(model.normalizedRemarks, '保留', 'normalizeItem 保留既有備註');
  assertEq(model.normalizedEmpty, '', 'normalizeItem 補上缺少的備註欄');

  console.log('\n資料層：舊案件備註遷移');
  const migrate = await evaluate(`(function () {
    // 1. 完全舊格式：設備／原因／備註都攤在案件層級
    var legacy = window.__baseCase();
    legacy.equipment = window.__eq('E1', '室內機', 'FTXS');
    legacy.actualReason = '濾網堵塞';
    legacy.processRecords = [window.__rec(1, '清洗')];
    legacy.remarks = '舊案件備註';
    var legacyOut = CaseAssigneeUtils.normalizeRepairCase(legacy);

    // 2. 已是卡片陣列、但備註還留在案件層級
    var mid = window.__twoItemCase();
    mid.serviceItems.forEach(function (it) { delete it.remarks; });
    mid.remarks = '待遷移備註';
    var midOut = CaseAssigneeUtils.normalizeRepairCase(mid);

    // 3. 卡片已有備註時不得被案件層級覆蓋，也不得重複附加
    var filled = window.__twoItemCase();
    filled.remarks = '不該蓋掉';
    var filledOut = CaseAssigneeUtils.normalizeRepairCase(filled);

    // 4. 沒有卡片的案件（例如工項分類「其他」）維持案件層級備註
    var noItem = window.__baseCase();
    noItem.remarks = '其他案件備註';
    var noItemOut = CaseAssigneeUtils.normalizeRepairCase(noItem);

    return {
      legacyCount: RepairCaseServiceItems.getItems(legacyOut).length,
      legacyItemRemarks: RepairCaseServiceItems.getItems(legacyOut).map(function (it) { return it.remarks; }),
      legacyCaseRemarks: legacyOut.remarks || '',
      midItemRemarks: RepairCaseServiceItems.getItems(midOut).map(function (it) { return it.remarks; }),
      midCaseRemarks: midOut.remarks || '',
      filledItemRemarks: RepairCaseServiceItems.getItems(filledOut).map(function (it) { return it.remarks; }),
      filledCaseRemarks: filledOut.remarks || '',
      noItemCount: RepairCaseServiceItems.getItems(noItemOut).length,
      noItemCaseRemarks: noItemOut.remarks || ''
    };
  })()`);
  assertEq(migrate.legacyCount, 1, '完全舊格式摺成一張卡片');
  assertEq(migrate.legacyItemRemarks, ['舊案件備註'], '舊案件備註摺進該卡片');
  assertEq(migrate.legacyCaseRemarks, '', '遷移後不留案件層級備註');
  assertEq(migrate.midItemRemarks, ['待遷移備註', ''], '案件層級備註併進第一張卡片，不動第二張');
  assertEq(migrate.midCaseRemarks, '', '併入後清空案件層級備註');
  assertEq(migrate.filledItemRemarks, ['第一台備註', '第二台備註'], '卡片已有備註時不被案件層級覆蓋');
  assertEq(migrate.filledCaseRemarks, '', '卡片已有備註時案件層級備註仍清掉');
  assertEq(migrate.noItemCount, 0, '沒有設備的案件沒有卡片');
  assertEq(migrate.noItemCaseRemarks, '其他案件備註', '沒有卡片時維持案件層級備註');

  console.log('\n編輯表單逐卡片備註');
  const form = await evaluate(`(function () {
    var wrap = document.createElement('div');
    document.body.appendChild(wrap);
    wrap.appendChild(EditCaseForm({
      editingCase: window.__twoItemCase(),
      cases: [], setCases: function () {}, stores: [], customers: [],
      equipments: [], deviceCategories: [], processMethods: [],
      setView: function () {}, showToast: function () {}
    }));
    // 一次只顯示一張卡片，逐張切過去讀寫
    function remarkBox() {
      return wrap.querySelector('textarea[name="serviceItemRemarks"]');
    }
    var before = window.__eachCard(wrap, function () { return remarkBox().value; });
    // 改第二張卡片的備註，第一張不得被牽動
    window.__gotoCard(wrap, 1);
    var second = remarkBox();
    second.value = '改過的第二台備註';
    second.dispatchEvent(new Event('input', { bubbles: true }));
    var out = {
      itemCount: window.__pagerTotal(wrap),
      before: before,
      after: window.__eachCard(wrap, function () { return remarkBox().value; }),
      // 每張卡片同時只渲染一個備註欄
      boxesPerCard: wrap.querySelectorAll('textarea[name="serviceItemRemarks"]').length,
      caseLevelCount: wrap.querySelectorAll('textarea[name="remarks"]').length,
      repairRemarkCount: wrap.querySelectorAll('textarea[name="repairRemark"]').length
    };
    wrap.remove();
    return out;
  })()`);
  assertEq(form.itemCount, 2, '案件有兩張卡片');
  assertEq(form.boxesPerCard, 1, '一次只渲染一張卡片的備註欄');
  assertEq(form.before, ['第一台備註', '第二台備註'], '每張卡片帶出自己的備註');
  assertEq(form.after, ['第一台備註', '改過的第二台備註'], '改第二張備註不影響第一張');
  assertEq(form.caseLevelCount, 0, '表單不再有案件層級備註欄');
  assertEq(form.repairRemarkCount, 1, '維修結果的維修備註維持不變');

  console.log('\n唯讀明細逐卡片備註');
  const view = await evaluate(`(function () {
    var wrap = document.createElement('div');
    document.body.appendChild(wrap);
    wrap.appendChild(ViewCaseForm({
      viewingCase: window.__twoItemCase(), setView: function () {}, backView: 'list',
      processMethods: [], deviceCategories: [], vehicles: [], vendors: [],
      cases: [], openPrevCase: function () {}, currentView: 'case-view'
    }));
    // 一次只顯示一張卡片，逐張切過去確認各自的備註
    var texts = window.__eachCard(wrap, function (root) { return window.__text(root); });
    var out = {
      hasFirst: texts[0].indexOf('第一台備註') !== -1,
      hasSecond: !!(texts[1] && texts[1].indexOf('第二台備註') !== -1),
      firstHasNoSecond: texts[0].indexOf('第二台備註') === -1,
      editable: wrap.querySelectorAll('textarea').length
    };
    wrap.remove();
    return out;
  })()`);
  assertEq(view.hasFirst, true, '明細顯示第一台的備註');
  assertEq(view.hasSecond, true, '明細顯示第二台的備註');
  assertEq(view.firstHasNoSecond, true, '明細一次只顯示一張卡片的備註');
  assertEq(view.editable, 0, '唯讀明細沒有可編輯的備註欄');

  console.log('\nPDF 逐設備備註');
  const pdf = await evaluate(`(function () {
    var html = buildCasePdfHtml(window.__twoItemCase(), {
      deviceCategories: [], processMethods: []
    });
    var firstIdx = html.indexOf('第一台備註');
    var secondIdx = html.indexOf('第二台備註');
    var ch200Idx = html.indexOf('CH-200');
    return {
      hasFirst: firstIdx !== -1,
      hasSecond: secondIdx !== -1,
      // 第一台備註要落在第二台設備小節之前，代表備註跟著設備走而非集中在末尾
      firstBeforeSecondEquipment: firstIdx !== -1 && ch200Idx !== -1 && firstIdx < ch200Idx,
      secondAfterSecondEquipment: secondIdx !== -1 && ch200Idx !== -1 && secondIdx > ch200Idx
    };
  })()`);
  assertEq(pdf.hasFirst, true, 'PDF 含第一台備註');
  assertEq(pdf.hasSecond, true, 'PDF 含第二台備註');
  assertEq(pdf.firstBeforeSecondEquipment, true, '第一台備註排在第一台設備小節內');
  assertEq(pdf.secondAfterSecondEquipment, true, '第二台備註排在第二台設備小節內');

  console.log('\n派工明細逐卡片備註');
  // 派工明細已改用與編輯頁共用的 RepairCaseDetailSections（只取「設備與服務項目」段）
  const arrangement = await evaluate(`(function () {
    var c = window.__twoItemCase();
    var items = RepairCaseServiceItems.getItems(c);
    var ui = RepairCaseDetailSections.createUiState();
    // 一次只顯示一張卡片，目前是第幾張由呼叫端以 ui.activeItemIndex 帶入
    function render(activeIndex) {
      ui.activeItemIndex = activeIndex;
      var host = document.createElement('div');
      RepairCaseDetailSections.renderSections({
        formData: c,
        ui: ui,
        data: {
          equipments: [], deviceCategories: [], processMethods: [],
          vehicles: [], vendors: [], stores: []
        },
        rerender: function () {},
        showToast: function () {},
        include: ['equipment'],
        idPrefix: 'test'
      }).forEach(function (n) { host.appendChild(n); });
      return host;
    }
    function boxes(node) { return node.querySelectorAll('textarea[name="serviceItemRemarks"]'); }
    var first = render(0);
    document.body.appendChild(first);
    var out = {
      count: boxes(first).length,
      values: [boxes(first)[0].value]
    };
    first.remove();

    var second = render(1);
    document.body.appendChild(second);
    out.values.push(boxes(second)[0].value);
    var box = boxes(second)[0];
    box.value = '派工改備註';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    // 共用模組直接寫回 formData，不再透過回呼
    out.written = RepairCaseServiceItems.getItems(c).map(function (it) { return it.remarks; });
    out.secondItemId = items[1].id;
    out.writtenItemIds = RepairCaseServiceItems.getItems(c).map(function (it) { return it.id; });
    second.remove();
    return out;
  })()`);
  assertEq(arrangement.count, 1, '派工明細一次只渲染一張卡片的備註欄');
  assertEq(arrangement.values, ['第一台備註', '第二台備註'], '派工明細帶出各卡片自己的備註');
  assertEq(arrangement.written, ['第一台備註', '派工改備註'],
    '改第二張備註只寫回第二筆 item，第一筆不受影響');
  assertEq(arrangement.writtenItemIds[1], arrangement.secondItemId,
    '被改動的正是第二筆 item（id 不變）');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
