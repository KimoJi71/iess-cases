#!/usr/bin/env node
/**
 * 「保養計劃進度 — 保養明細五段式版面」驗證腳本。
 * 以 headless Chrome + CDP 直接呼叫 MaintenanceViewEditForm 元件，
 * 驗證欄位分區、設備加入、客戶簽收簽名板與保養狀態判斷規則。
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0, failed = 0;
const pass = (n, d) => { passed++; console.log(`  ✓ ${n}${d ? ` — ${d}` : ''}`); };
const fail = (n, d) => { failed++; console.error(`  ✗ ${n}${d ? ` — ${d}` : ''}`); };
function assertEq(actual, expected, name) {
  if (actual === expected) pass(name, JSON.stringify(actual));
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertDeep(actual, expected, name) {
  assertEq(JSON.stringify(actual), JSON.stringify(expected), name);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9351);
if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-maintenance-detail-profile',
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

// 測試用的保養單／門市／設備／協力廠商，全部在頁面內組出來，不依賴種子資料
const SETUP = `(function () {
  window.__written = { cases: null, stores: null, toasts: [] };
  window.__mountDetail = function (overrides, mode) {
    var host = document.getElementById('detail-host');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'detail-host';
    document.body.appendChild(host);
    var target = Object.assign({
      id: 'M-T1', caseNumber: '', customerName: '保養客戶', storeName: '保養門市',
      serviceLevel: 'B 保修(一年兩次)', status: '未保養', workCategory: '保養',
      planDate: '', planTimeStart: '', planTimeEnd: '', dueMonth: '2026-08',
      companyCity: '台北市', companyDistrict: '大安區', isClosed: false
    }, overrides || {});
    host.appendChild(MaintenanceViewEditForm({
      targetCase: target,
      cases: [target],
      setCases: function (next) { window.__written.cases = next; },
      stores: [{ customerName: '保養客戶', storeName: '保養門市', companyCity: '台北市',
        companyDistrict: '大安區', companyAddress: '忠孝東路X號',
        indoorHeight: '3M', outdoorHeight: '5M' }],
      setStores: function (next) { window.__written.stores = next; },
      customers: [{ name: '保養客戶', enabled: true,
        periods: [{ visitIndex: 1, startMonth: 1, endMonth: 12 }] }],
      vendors: [{ id: 'V1', name: '大同協力', type: '協力商' }],
      equipments: [
        { id: 'E1', customerName: '保養客戶', storeName: '保養門市', category: '分離式冷氣',
          brand: '大金', deviceName: '一樓內機', specification: '3噸', model: 'DK-100',
          area: '一樓', acceptanceDate: '2024-01-10', installer: '王工',
          assetNumber: 'A-001', serialNumber: 'S-001', status: '運轉中' }
      ],
      setView: function () {},
      mode: mode || 'edit',
      showToast: function (msg) { window.__written.toasts.push(msg); }
    }));
    return true;
  };
  window.__sectionTitles = function () {
    return Array.prototype.map.call(
      document.querySelectorAll('#detail-host section h3'),
      function (el) { return el.textContent.trim(); });
  };
  window.__labelsIn = function (title) {
    var section = Array.prototype.slice.call(
      document.querySelectorAll('#detail-host section')).filter(function (s) {
        var h3 = s.querySelector('h3');
        return h3 && h3.textContent.trim() === title;
      })[0];
    if (!section) return null;
    return Array.prototype.map.call(section.querySelectorAll('span.text-xs'),
      function (el) { return el.textContent.trim(); });
  };
  window.__clickText = function (text, scope) {
    var root = scope ? document.querySelector(scope) : document;
    var el = Array.prototype.slice.call(root.querySelectorAll('button'))
      .filter(function (b) { return b.textContent.trim() === text; })[0];
    if (!el) throw new Error('找不到按鈕：' + text);
    el.click();
    return true;
  };
  return true;
})()`;

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
  await evaluate(SETUP);
  await evaluate('window.__mountDetail({}, "edit")');

  console.log('Section 1｜五段式版面');
  assertEq(consoleErrors.length, 0, '載入與掛載明細頁時無 JS 錯誤');
  assertDeep(await evaluate('window.__sectionTitles()'),
    ['1. 排程資料', '2. 案件資料', '3. 設備資料', '4. 保養結果'],
    '區塊依序為 排程資料／案件資料／設備資料／保養結果');

  console.log('\nSection 2｜排程資料（唯一可編輯的欄位群）');
  assertDeep(await evaluate('window.__labelsIn("1. 排程資料")'),
    ['保養日期', '保養開始時間', '保養結束時間', '組別', '指派人員', '協力廠商'],
    '排程資料欄位齊全');
  assertEq(await evaluate(`document.querySelectorAll('#detail-host input[type=date]').length`), 1,
    '保養日期為可編輯的日期輸入');

  console.log('\nSection 3｜案件資料（唯讀，門市資料自動帶入）');
  assertDeep(await evaluate('window.__labelsIn("2. 案件資料")'),
    ['客戶名稱', '門市名稱', '行政區域', '服務等級', '保養區間', '門市地址', '室內機高度', '室外機高度'],
    '案件資料欄位齊全，區域欄名為「行政區域」');
  assertDeep(await evaluate(`(function () {
    var section = Array.prototype.slice.call(document.querySelectorAll('#detail-host section'))
      .filter(function (s) { return s.querySelector('h3').textContent.trim() === '2. 案件資料'; })[0];
    return {
      inputs: section.querySelectorAll('input, select, textarea').length,
      height: Array.prototype.map.call(section.querySelectorAll('div.bg-gray-50'),
        function (d) { return d.textContent.trim(); }).slice(-2)
    };
  })()`), { inputs: 0, height: ['3M', '5M'] },
    '案件資料全唯讀，室內外機高度由門市帶入');

  console.log('\nSection 4｜設備資料：從門市設備清單加入');
  assertEq(await evaluate(`(function () {
    var ths = Array.prototype.map.call(
      document.querySelectorAll('#detail-host section:nth-of-type(3) thead th'),
      function (th) { return th.textContent.trim(); });
    return ths.join(',');
  })()`),
    '操作,設備分類,品牌,設備名稱,設備規格,型號,設備等級,設備區域,驗收日期,安裝人員,資產編號,流水序號,設備狀態',
    '設備欄位比照設備管理列表（唯讀）＋操作欄');
  assertEq(await evaluate(`document.querySelector('#detail-host section:nth-of-type(3) tbody td').textContent.trim()`),
    '尚未加入任何設備資料', '初始為空清單');
  await evaluate(`window.__clickText('加入設備', '#detail-host')`);
  await sleep(300);
  assertTrue(await evaluate(`!!Array.prototype.slice.call(document.querySelectorAll('h3'))
    .filter(function (el) { return el.textContent.trim() === '選擇設備'; })[0]`),
    '點「加入設備」開啟該門市的設備清單視窗');
  await evaluate(`(function () {
    var modal = document.querySelector('.app-modal-overlay');
    modal.querySelector('tbody input[type=checkbox]').click();
    return true;
  })()`);
  await sleep(200);
  await evaluate(`(function () {
    var modal = document.querySelector('.app-modal-overlay');
    var btn = Array.prototype.slice.call(modal.querySelectorAll('button'))
      .filter(function (b) { return b.textContent.indexOf('加入所選') === 0; })[0];
    btn.click();
    return true;
  })()`);
  await sleep(300);
  assertEq(await evaluate(`(function () {
    var row = document.querySelector('#detail-host section:nth-of-type(3) tbody tr');
    return Array.prototype.map.call(row.querySelectorAll('td'), function (td) {
      return td.textContent.trim();
    }).slice(1, 4).join('/');
  })()`), '分離式冷氣/大金/一樓內機', '選取的設備以唯讀欄位列在設備資料');

  console.log('\nSection 5｜保養結果：狀態／備註／客戶簽收／完成時間');
  assertDeep(await evaluate('window.__labelsIn("4. 保養結果")'),
    ['保養狀態', '完成時間', '客戶簽收', '備註'],
    '保養結果欄位齊全');
  await evaluate(`window.__clickText('客戶簽收', '#detail-host')`);
  await sleep(300);
  assertTrue(await evaluate(`!!document.querySelector('.app-modal-overlay canvas')`),
    '點「客戶簽收」開啟簽名板');
  await evaluate(`(function () {
    var modal = document.querySelector('.app-modal-overlay');
    var canvas = modal.querySelector('canvas');
    var ctx = canvas.getContext('2d');
    ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(200, 120); ctx.stroke();
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    Array.prototype.slice.call(modal.querySelectorAll('button'))
      .filter(function (b) { return b.textContent.trim() === '確認簽收'; })[0].click();
    return true;
  })()`);
  await sleep(300);
  assertTrue(await evaluate(`!!document.querySelector('#detail-host img[alt=客戶簽名]')`),
    '簽名確認後暫存於明細頁');

  console.log('\nSection 6｜保養狀態判斷');
  await evaluate('window.__mountDetail({}, "edit")');
  await evaluate(`window.__clickText('儲存', '#detail-host')`);
  await sleep(200);
  assertEq(await evaluate('window.__written.cases[0].status'), '未保養',
    '沒有組別、協力廠商、保養日期＝未保養');
  await evaluate(`window.__mountDetail({ assignees: ['A組'], planDate: '2026-08-20' }, 'edit')`);
  await evaluate(`window.__clickText('儲存', '#detail-host')`);
  await sleep(200);
  assertEq(await evaluate('window.__written.cases[0].status'), '已預約',
    '有組別且有保養日期＝已預約');
  await evaluate(`window.__mountDetail({ partnerVendorIds: ['V1'], planDate: '2026-08-20' }, 'edit')`);
  await evaluate(`window.__clickText('儲存', '#detail-host')`);
  await sleep(200);
  assertEq(await evaluate('window.__written.cases[0].status'), '已預約',
    '只有協力廠商加保養日期也算已預約');
  await evaluate(`window.__mountDetail({ assignees: ['A組'] }, 'edit')`);
  await evaluate(`window.__clickText('儲存', '#detail-host')`);
  await sleep(200);
  assertEq(await evaluate('window.__written.cases[0].status'), '未保養',
    '有組別但沒有保養日期＝未保養');

  console.log('\nSection 7｜手動改為已完成時押上完成時間與門市上次保養日期');
  await evaluate(`window.__mountDetail({ assignees: ['A組'], planDate: '2026-08-20' }, 'edit')`);
  assertEq(await evaluate(`document.querySelector('#detail-host section:nth-of-type(4) .searchable-select__input').value`),
    '已預約', '排程資料填妥後保養狀態自動顯示已預約');
  // 專案的 <select> 會升級為 searchable-select，因此以展開選單再點選項的方式操作
  await evaluate(`(function () {
    var input = document.querySelector('#detail-host section:nth-of-type(4) .searchable-select__input');
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    input.focus();
    return true;
  })()`);
  await sleep(200);
  await evaluate(`(function () {
    var opt = Array.prototype.slice.call(document.querySelectorAll('.searchable-select__option'))
      .filter(function (b) { return b.textContent.trim() === '已完成'; })[0];
    if (!opt) throw new Error('選單中找不到「已完成」');
    opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    return true;
  })()`);
  await sleep(200);
  await evaluate(`window.__clickText('儲存', '#detail-host')`);
  await sleep(200);
  assertEq(await evaluate('window.__written.cases[0].status'), '已完成', '狀態寫入已完成');
  assertTrue(await evaluate(`/^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$/.test(window.__written.cases[0].completionDate)`),
    '已完成同時押上完成時間', await evaluate('window.__written.cases[0].completionDate'));
  assertEq(await evaluate('window.__written.stores[0].lastMaintenanceDate'), '2026-08-20',
    '門市的上次保養日期同步為保養日期');

  console.log('\nSection 8｜檢視模式全唯讀');
  await evaluate('window.__mountDetail({}, "view")');
  assertEq(await evaluate(`document.querySelectorAll('#detail-host input, #detail-host select, #detail-host textarea').length`), 0,
    '檢視模式沒有任何可編輯欄位');
  assertEq(await evaluate(`(function () {
    return Array.prototype.slice.call(document.querySelectorAll('#detail-host button'))
      .map(function (b) { return b.textContent.trim(); })
      .filter(function (t) { return t === '儲存' || t === '加入設備' || t === '客戶簽收'; }).length;
  })()`), 0, '檢視模式沒有儲存／加入設備／客戶簽收按鈕');

  if (consoleErrors.length) console.log('ERRORS', JSON.stringify(consoleErrors));
  assertEq(consoleErrors.length, 0, '操作後仍無 JS 錯誤');
} catch (err) {
  fail('UI 驗證中斷', err && err.stack ? err.stack : String(err));
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}

console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
