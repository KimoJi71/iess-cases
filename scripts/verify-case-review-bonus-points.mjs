#!/usr/bin/env node
/**
 * Executed UI verification for the 銷案審核「總積分」欄.
 * Launches headless Chrome, loads index.html, renders CaseReviewList with
 * fixture cases, then asserts on the rendered table.
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
  if (actual === expected) pass(name, JSON.stringify(actual));
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-bonus-points-check-profile',
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
  assertTrue(!!todayDate, '成功取得頁面 todayDate', todayDate);

  // 所有 fixture 的 closeDate 都綁在頁面自身的 todayDate，
  // 避免依賴腳本執行當日的系統日期。
  await evaluate(`
    window.__deviceCategories = [
      { id: 'DC1', category: '室內機', brand: '大金', deviceName: '分離式',
        specification: '2噸', model: 'ADD-1', equipmentLevel: '增額設備' },
      { id: 'DC2', category: '室內機', brand: '大金', deviceName: '分離式',
        specification: '3噸', model: 'BASE-1', equipmentLevel: '基礎設備' }
    ];
    window.__fixtureCases = [
      { id: 'R1', caseNumber: 'BP001', customerName: 'C級客戶', storeName: '門市一',
        serviceLevel: 'C 保養(一年一次)', workCategory: '一般叫修', repairItem: '冷氣',
        repairReason: '不冷', actualReason: '缺冷媒', isClosed: true,
        closeDate: '${todayDate} 10:00',
        processRecords: [{ points: 5, qty: 2 }, { points: 3, qty: 1 }] },
      { id: 'R2', caseNumber: 'BP002', customerName: 'A級客戶', storeName: '門市二',
        serviceLevel: 'A 保修(一年四次)', workCategory: '一般叫修', repairItem: '冷氣',
        repairReason: '異音', actualReason: '軸承', isClosed: true,
        closeDate: '${todayDate} 10:00',
        equipment: { model: 'ADD-1' },
        processRecords: [{ points: 4, qty: 1 }] },
      { id: 'R3', caseNumber: 'BP003', customerName: 'B級客戶', storeName: '門市三',
        serviceLevel: 'B 保修(一年兩次)', workCategory: '一般叫修', repairItem: '冷氣',
        repairReason: '漏水', actualReason: '排水管', isClosed: true,
        closeDate: '${todayDate} 10:00',
        equipment: { model: 'BASE-1' },
        processRecords: [{ points: 9, qty: 1 }] },
      { id: 'R4', caseNumber: 'BP004', customerName: 'D級客戶', storeName: '門市四',
        serviceLevel: 'D 維修(無簽約客戶)', workCategory: '一般叫修', repairItem: '冷氣',
        repairReason: '不運轉', actualReason: '電容', isClosed: true,
        closeDate: '${todayDate} 10:00',
        processRecords: [] },
      { id: 'R5', caseNumber: 'BP006', customerName: 'A級客戶2', storeName: '門市六',
        serviceLevel: 'A 保修(一年四次)', workCategory: '一般叫修', repairItem: '冷氣',
        repairReason: '不冷', actualReason: '缺冷媒', isClosed: true,
        closeDate: '${todayDate} 10:00',
        processRecords: [{ points: 6, qty: 1 }] }
    ];
    window.__fixtureMaintenance = [
      { id: 'M1', caseNumber: 'BP005', customerName: 'C級客戶', storeName: '門市五',
        serviceLevel: 'C 保養(一年一次)', status: '已完成', isClosed: true,
        closeDate: '${todayDate} 11:00', planDate: '${todayDate}',
        processRecords: [{ points: 7, qty: 1 }] }
    ];
    window.__renderReview = function (cases, maintenanceCases) {
      return CaseReviewList({
        cases: cases,
        setCases: function () {},
        maintenanceCases: maintenanceCases,
        setMaintenanceCases: function () {},
        assignees: [],
        deviceCategories: window.__deviceCategories,
        setViewingCase: function () {},
        setView: function () {},
        showToast: function () {}
      });
    };
    'ok'`);

  console.log('\n表頭欄位');
  const headers = await evaluate(`(function(){
    var node = window.__renderReview(window.__fixtureCases, window.__fixtureMaintenance);
    var ths = Array.prototype.map.call(node.querySelectorAll('thead th'),
      function (t) { return t.textContent.trim(); });
    node.remove();
    return ths;
  })()`);
  const bonusIdx = headers.indexOf('總積分');
  assertTrue(bonusIdx !== -1, '表頭出現「總積分」欄', headers.join(' | '));
  assertEq(headers[bonusIdx - 1], '服務等級', '「總積分」緊接在「服務等級」之後');
  assertEq(headers[bonusIdx + 1], '工項分類', '「總積分」之後為「工項分類」');
  assertEq(headers.length, 13, '表頭共 13 欄');

  console.log('\n各案件的總積分儲存格');
  const cells = await evaluate(`(function(){
    var node = window.__renderReview(window.__fixtureCases, window.__fixtureMaintenance);
    var idx = ${bonusIdx};
    var out = {};
    Array.prototype.forEach.call(node.querySelectorAll('tbody tr'), function (tr) {
      var tds = tr.querySelectorAll('td');
      if (!tds.length) return;
      var num = tds[2].textContent.trim();
      out[num] = tds[idx].textContent.trim();
    });
    node.remove();
    return out;
  })()`);
  assertEq(cells.BP001, '13', 'C 級叫修案件顯示總積分 5×2 + 3×1 = 13');
  assertEq(cells.BP002, '4', 'A 級 + 增額設備顯示總積分 4');
  assertEq(cells.BP003, '', 'B 級 + 基礎設備留空');
  assertEq(cells.BP004, '0', 'D 級但無處理方式顯示 0（非空白）');
  assertEq(cells.BP005, '', 'C 級保養計劃案件留空');
  assertEq(cells.BP006, '', 'A 級且無 equipment 欄位留空');

  console.log('\n空資料列');
  const emptyColspan = await evaluate(`(function(){
    var node = window.__renderReview([], []);
    var td = node.querySelector('tbody td');
    var result = { text: td.textContent.trim(), colspan: td.getAttribute('colspan') };
    node.remove();
    return result;
  })()`);
  assertEq(emptyColspan.colspan, '13', '空資料列 colspan 為 13');
  assertEq(emptyColspan.text, '無資料符合目前搜尋區間', '空資料列文字不變');

  console.log('\napp.js 已傳入 deviceCategories');
  const appSrc = await import('node:fs').then(fs => fs.readFileSync(join(ROOT, 'src/app.js'), 'utf8'));
  const callIdx = appSrc.indexOf('CaseReviewList');
  assertTrue(appSrc.slice(callIdx, callIdx + 400).includes('deviceCategories'),
    'app.js 的 CaseReviewList 呼叫含 deviceCategories');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
