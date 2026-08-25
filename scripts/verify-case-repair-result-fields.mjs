#!/usr/bin/env node
/**
 * 叫修案件「5. 維修結果」新增欄位驗證：
 * 編輯表單的客戶簽收（簽名板，比照保養計劃進度）與維修備註，
 * 以及案件明細檢視頁（案件紀錄／門市歷史紀錄共用）與案件明細 PDF 是否同步呈現。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9361);

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
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-case-repair-result-profile',
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
    window.__saved = null;
    window.__mkEq = function () {
      return {
        id: 'E1', customerName: '測試客戶', storeName: '測試門市',
        category: '空調', brand: '大金', deviceName: '室內機',
        specification: '2.2kW', model: 'FTXS', area: '廚房',
        acceptanceDate: '2020-02-01', installer: '王小明',
        assetNumber: 'A-001', serialNumber: 'SN-001', status: '運轉中',
        createdDate: '${todayDate}'
      };
    };
    window.__mkCase = function (overrides) {
      return Object.assign({
        id: 'C1', caseNumber: '20260814001', customerName: '測試客戶', storeName: '測試門市',
        companyCity: '台北市', companyDistrict: '中山區', workCategory: '一般叫修',
        repairItem: '室內機', repairReason: '不冷', faultDesc: '出風不冷',
        assignees: [], isClosed: false, processStatus: null,
        createdAt: '${todayDate} 09:00:00', repairDate: '${todayDate} 09:00:00',
        expectedDate: '${todayDate}', expectedTimeStart: '09:00', expectedTimeEnd: '11:00',
        serviceItems: [{ id: 'SI1', equipment: window.__mkEq(), actualReason: '', processRecords: [] }]
      }, overrides || {});
    };
    window.__mountEdit = function (overrides) {
      var host = document.getElementById('case-host');
      if (host) host.remove();
      host = document.createElement('div');
      host.id = 'case-host';
      document.body.appendChild(host);
      window.__saved = null;
      host.appendChild(EditCaseForm({
        editingCase: window.__mkCase(overrides),
        cases: [window.__mkCase(overrides)],
        setCases: function (next) { window.__saved = next[0]; },
        stores: [], customers: [], equipments: [window.__mkEq()],
        vehicles: [], vendors: [], deviceCategories: [], processMethods: [],
        setView: function () {}, showToast: function () {}
      }));
      return true;
    };
    window.__mountView = function (overrides) {
      var host = document.getElementById('case-host');
      if (host) host.remove();
      host = document.createElement('div');
      host.id = 'case-host';
      document.body.appendChild(host);
      host.appendChild(ViewCaseForm({
        viewingCase: window.__mkCase(overrides),
        setView: function () {}, backView: 'record-list',
        processMethods: [], deviceCategories: [], vehicles: [], vendors: []
      }));
      return true;
    };
    // 編輯表單與案件明細檢視頁合併區塊後，維修結果標題都遞補為「4. 維修結果」；
    // 標題仍可傳入覆寫以便未來版面調整。
    window.__section5 = function (title) {
      title = title || '4. 維修結果';
      return Array.prototype.slice.call(document.querySelectorAll('#case-host section'))
        .filter(function (s) {
          var h3 = s.querySelector('h3');
          return h3 && h3.textContent.trim() === title;
        })[0] || null;
    };
    window.__section5Labels = function (title) {
      var sec = window.__section5(title);
      if (!sec) return null;
      return Array.prototype.map.call(sec.querySelectorAll('label, span.text-xs, h4'),
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
    true;
  `);

  console.log('\nSection 1｜編輯表單「5. 維修結果」欄位');
  await evaluate('window.__mountEdit()');
  assertEq(await evaluate('window.__section5Labels()'),
    ['處理狀態', '客戶簽收', '維修備註', '時間紀錄', '叫修時間', '到店時間', '完成時間'],
    '處理狀態下方依序為客戶簽收、維修備註，時間紀錄不變');
  assertTrue(await evaluate(`!!window.__section5().querySelector('textarea[name=repairRemark]')`),
    '維修備註為 textarea[name=repairRemark]');
  assertEq(await evaluate(`window.__section5()
    .querySelector('textarea[name=repairRemark]').getAttribute('placeholder')`),
    '請輸入維修備註...', '有設備時維修備註可輸入');

  console.log('\nSection 2｜沒有設備時整區停用');
  await evaluate('window.__mountEdit({ serviceItems: [] })');
  assertEq(await evaluate(`(function () {
    var sec = window.__section5();
    return {
      remark: sec.querySelector('textarea[name=repairRemark]').disabled,
      sign: Array.prototype.slice.call(sec.querySelectorAll('button'))
        .filter(function (b) { return b.textContent.trim() === '客戶簽收'; })[0].disabled
    };
  })()`), { remark: true, sign: true }, '未加入設備時維修備註與客戶簽收皆停用');

  console.log('\nSection 3｜客戶簽收簽名板（比照保養計劃進度）');
  await evaluate('window.__mountEdit()');
  assertEq(await evaluate(`window.__section5().textContent.indexOf('尚未簽收') !== -1`), true,
    '未簽名時顯示「尚未簽收」');
  await evaluate(`window.__clickText('客戶簽收', '#case-host')`);
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
  assertTrue(await evaluate(`!!window.__section5().querySelector('img[alt=客戶簽名]')`),
    '簽名確認後在維修結果區顯示縮圖');
  assertTrue(await evaluate(`!!Array.prototype.slice.call(window.__section5().querySelectorAll('button'))
    .filter(function (b) { return b.textContent.trim() === '重新簽收'; })[0]`),
    '已簽名後按鈕改為「重新簽收」');

  console.log('\nSection 4｜儲存後寫入案件');
  await evaluate(`(function () {
    var ta = window.__section5().querySelector('textarea[name=repairRemark]');
    ta.value = '更換壓縮機並測試運轉正常';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(200);
  await evaluate(`window.__clickText('儲存', '#case-host')`);
  await sleep(200);
  assertEq(await evaluate('window.__saved.repairRemark'), '更換壓縮機並測試運轉正常',
    '維修備註寫入案件');
  assertTrue(await evaluate(`/^data:image\\/png;base64,/.test(window.__saved.customerSignature || '')`),
    '客戶簽名以 PNG dataURL 寫入案件');

  console.log('\nSection 5｜案件明細檢視頁（案件紀錄／門市歷史紀錄共用）');
  // 檢視頁（case-view.js）也已改為「4. 維修結果」
  await evaluate(`window.__mountView({
    processStatus: '已完成', repairRemark: '更換壓縮機並測試運轉正常',
    customerSignature: 'data:image/png;base64,iVBORw0KGgo='
  })`);
  assertEq(await evaluate("window.__section5Labels('4. 維修結果')"),
    ['處理狀態', '客戶簽收', '維修備註', '時間紀錄', '叫修時間', '到店時間', '完成時間'],
    '檢視頁欄位順序與編輯表單一致');
  assertTrue(await evaluate(`window.__section5('4. 維修結果').textContent.indexOf('客戶簽收') !== -1`),
    '檢視頁顯示客戶簽收欄');
  assertTrue(await evaluate(`!!window.__section5('4. 維修結果').querySelector('img[alt=客戶簽名]')`),
    '檢視頁顯示簽名圖');
  assertTrue(await evaluate(`window.__section5('4. 維修結果').textContent.indexOf('更換壓縮機並測試運轉正常') !== -1`),
    '檢視頁顯示維修備註內容');
  await evaluate('window.__mountView({ processStatus: "已完成" })');
  assertTrue(await evaluate(`window.__section5('4. 維修結果').textContent.indexOf('尚未簽收') !== -1`),
    '沒有簽名時檢視頁顯示「尚未簽收」');

  console.log('\nSection 6｜案件明細 PDF');
  const pdfHtml = await evaluate(`window.buildCasePdfHtml(window.__mkCase({
    processStatus: '已完成', repairRemark: '更換壓縮機並測試運轉正常',
    customerSignature: 'data:image/png;base64,iVBORw0KGgo='
  }), {})`);
  assertTrue(pdfHtml.includes('客戶簽收'), 'PDF 維修結果含客戶簽收欄');
  assertTrue(pdfHtml.includes('<img class="sign"'), 'PDF 以圖片輸出簽名');
  assertTrue(pdfHtml.includes('維修備註'), 'PDF 維修結果含維修備註欄');
  assertTrue(pdfHtml.includes('更換壓縮機並測試運轉正常'), 'PDF 輸出維修備註內容');
  const pdfNoSign = await evaluate(`window.buildCasePdfHtml(window.__mkCase({ processStatus: '已完成' }), {})`);
  assertTrue(pdfNoSign.includes('尚未簽收'), '沒有簽名時 PDF 顯示「尚未簽收」');

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
