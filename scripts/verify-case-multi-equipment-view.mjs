#!/usr/bin/env node
/**
 * 唯讀明細與 PDF：合併後的「3. 設備與服務項目」逐設備輸出，維修結果遞補為 4。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9363);

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
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-multi-equip-view-profile',
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
    window.__eq = function (id, name, model) {
      return {
        id: id, customerName: '測試客戶', storeName: '測試門市', category: '空調',
        brand: '大金', deviceName: name, specification: '2.2kW', model: model,
        equipmentLevel: '一般設備', area: '廚房', acceptanceDate: '2020-02-01',
        installer: '王小明', assetNumber: 'A-' + id, serialNumber: 'SN-' + id, status: '運轉中'
      };
    };

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
    window.__rec = function (id, cat3) {
      return { id: id, category1: '維修', category2: '空調', category3: cat3,
        specification: '標準', qty: 1, unit: '台', points: 2, status: '已處理' };
    };
    window.__case = {
      id: 'C1', caseNumber: '20260825001', customerName: '測試客戶', storeName: '測試門市',
      workCategory: '一般叫修', repairItem: '室內機', repairReason: '不冷', faultDesc: '出風不冷',
      isClosed: false, processStatus: null,
      createdAt: '2026-08-25 09:00:00', repairDate: '2026-08-25 09:00:00',
      assignees: [],
      serviceItems: [
        { id: 'SI1', equipment: window.__eq('E1', '室內機', 'FTXS'),
          actualReason: '第一台濾網堵塞', remarks: '第一台備註',
          processRecords: [window.__rec(1, '清洗')] },
        { id: 'SI2', equipment: window.__eq('E2', '冰水主機', 'CH-200'),
          actualReason: '第二台軸承磨損', remarks: '第二台備註',
          processRecords: [window.__rec(2, '更換')] }
      ]
    };
  `);

  console.log('\n唯讀明細');
  const view = await evaluate(`(function () {
    var wrap = document.createElement('div');
    document.body.appendChild(wrap);
    wrap.appendChild(ViewCaseForm({
      viewingCase: window.__case, setView: function () {}, backView: 'list',
      processMethods: [], deviceCategories: [], vehicles: [], vendors: [],
      cases: [window.__case], openPrevCase: function () {}, currentView: 'case-view'
    }));
    var hs = Array.prototype.map.call(wrap.querySelectorAll('h3'), function (n) {
      return n.textContent.replace(/\\s+/g, ' ').trim();
    });
    // 一次只顯示一張卡片，逐張切過去把兩台的內容都看過
    var texts = window.__eachCard(wrap, function (root) {
      return root.textContent.replace(/\\s+/g, ' ');
    });
    var text = texts.join(' ');
    var out = {
      headings: hs,
      cardCount: texts.length,
      buttonsInCards: wrap.querySelectorAll('table button').length,
      hasFirst: texts[0].indexOf('第一台濾網堵塞') !== -1,
      hasSecond: texts[1] && texts[1].indexOf('第二台軸承磨損') !== -1,
      hasFtxs: texts[0].indexOf('FTXS') !== -1,
      hasCh200: !!(texts[1] && texts[1].indexOf('CH-200') !== -1),
      // 第一張卡片不得同時出現第二台的內容
      firstHasNoSecond: texts[0].indexOf('CH-200') === -1
    };
    wrap.remove();
    return out;
  })()`);
  assertTrue(view.headings.some(t => t.indexOf('3. 設備與服務項目') === 0), '明細區塊 3 已合併', view.headings.join(' | '));
  assertTrue(view.headings.some(t => t === '4. 維修結果'), '明細維修結果遞補為 4', view.headings.join(' | '));
  assertEq(view.cardCount, 2, '明細有兩張卡片可切換');
  assertEq(view.firstHasNoSecond, true, '一次只顯示一張卡片');
  assertEq(view.hasFirst, true, '明細含第一台維修原因');
  assertEq(view.hasSecond, true, '明細含第二台維修原因');
  assertEq(view.hasFtxs, true, '明細含第一台型號');
  assertEq(view.hasCh200, true, '明細含第二台型號');
  assertEq(view.buttonsInCards, 0, '唯讀明細的處理方式表無操作按鈕');

  console.log('\nPDF HTML');
  const pdf = await evaluate(`(function () {
    var html = buildCasePdfHtml(window.__case, {
      deviceCategories: [], processMethods: []
    });
    return {
      hasMerged: html.indexOf('3. 設備與服務項目') !== -1,
      hasResult4: html.indexOf('4. 維修結果') !== -1,
      hasOldService: html.indexOf('4. 服務項目') !== -1,
      hasFirst: html.indexOf('第一台濾網堵塞') !== -1,
      hasSecond: html.indexOf('第二台軸承磨損') !== -1,
      hasFtxs: html.indexOf('FTXS') !== -1,
      hasCh200: html.indexOf('CH-200') !== -1,
      hasFirstRemarks: html.indexOf('第一台備註') !== -1,
      hasSecondRemarks: html.indexOf('第二台備註') !== -1
    };
  })()`);
  assertEq(pdf.hasMerged, true, 'PDF 有合併後的區塊標題');
  assertEq(pdf.hasResult4, true, 'PDF 維修結果為 4');
  assertEq(pdf.hasOldService, false, 'PDF 不再有獨立的 4. 服務項目');
  assertEq(pdf.hasFirst, true, 'PDF 含第一台維修原因');
  assertEq(pdf.hasSecond, true, 'PDF 含第二台維修原因');
  assertEq(pdf.hasFtxs, true, 'PDF 含第一台型號');
  assertEq(pdf.hasCh200, true, 'PDF 含第二台型號');
  assertEq(pdf.hasFirstRemarks, true, 'PDF 含第一台的備註');
  assertEq(pdf.hasSecondRemarks, true, 'PDF 含第二台的備註');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
