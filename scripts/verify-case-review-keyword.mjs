#!/usr/bin/env node
/**
 * Executed UI verification for 案件銷案審核列表的關鍵字搜尋。
 * Launches headless Chrome, loads index.html, renders CaseReviewList with
 * fixture cases, types a keyword, clicks 搜尋 and asserts on the rendered rows.
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
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) pass(name, a);
  else fail(name, `expected ${b}, got ${a}`);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-review-keyword-check-profile',
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

  await evaluate(`
    window.__fixtureCases = [
      { id: 'R1', caseNumber: 'KW001', customerName: '全家便利商店', storeName: '信義門市',
        serviceLevel: 'C 保養(一年一次)', workCategory: '一般叫修', repairItem: '冷氣',
        repairReason: '不冷', isClosed: true, closeDate: '${todayDate} 10:00',
        serviceItems: [{ id: 'SI1', equipment: null, actualReason: '缺冷媒', processRecords: [] }] },
      { id: 'R2', caseNumber: 'KW002', customerName: '萊爾富', storeName: '中山門市',
        serviceLevel: 'A 保修(一年四次)', workCategory: '一般叫修', repairItem: '冰箱',
        repairReason: '異音', isClosed: true, closeDate: '${todayDate} 10:00',
        serviceItems: [{ id: 'SI2', equipment: null, actualReason: '軸承磨損', processRecords: [] }] }
    ];
    window.__fixtureMaintenance = [
      { id: 'M1', caseNumber: 'KW003', customerName: '全家便利商店', storeName: '大安門市',
        serviceLevel: 'C 保養(一年一次)', status: '已完成', isClosed: true,
        closeDate: '${todayDate} 11:00', planDate: '${todayDate}', processRecords: [] }
    ];
    window.__mountReview = function () {
      var host = document.getElementById('__reviewHost');
      if (host) host.remove();
      host = document.createElement('div');
      host.id = '__reviewHost';
      document.body.appendChild(host);
      host.appendChild(CaseReviewList({
        cases: window.__fixtureCases,
        setCases: function () {},
        maintenanceCases: window.__fixtureMaintenance,
        setMaintenanceCases: function () {},
        assignees: [],
        serviceLevels: INITIAL_SERVICE_LEVELS,
        setViewingCase: function () {},
        setView: function () {},
        showToast: function () {}
      }));
      return host;
    };
    window.__caseNumbers = function () {
      var host = document.getElementById('__reviewHost');
      return Array.prototype.map.call(host.querySelectorAll('tbody tr'), function (tr) {
        var tds = tr.querySelectorAll('td');
        return tds.length > 2 ? tds[2].textContent.trim() : '';
      }).filter(Boolean);
    };
    window.__search = function (kw) {
      var host = document.getElementById('__reviewHost');
      var input = host.querySelector('input[type="text"]');
      input.value = kw;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      var btn = Array.prototype.find.call(host.querySelectorAll('button'), function (b) {
        return b.textContent.trim().indexOf('搜尋') !== -1;
      });
      btn.click();
      return window.__caseNumbers();
    };
    'ok'`);

  console.log('\n關鍵字輸入框');
  const inputInfo = await evaluate(`(function(){
    var host = window.__mountReview();
    var input = host.querySelector('input[type="text"]');
    return input ? { placeholder: input.placeholder, exists: true } : { exists: false };
  })()`);
  assertTrue(inputInfo.exists, '搜尋列出現文字輸入框');
  assertEq(inputInfo.placeholder, '請輸入關鍵字', 'placeholder 與其他列表一致');

  console.log('\n未輸入關鍵字時');
  const all = await evaluate('window.__caseNumbers()');
  assertEq(all.slice().sort(), ['KW001', 'KW002', 'KW003'], '顯示區間內全部案件');

  console.log('\n關鍵字過濾');
  assertEq((await evaluate(`window.__search('全家')`)).slice().sort(), ['KW001', 'KW003'],
    '客戶名稱可搜尋（叫修與保養案件皆命中）');
  assertEq(await evaluate(`window.__search('中山門市')`), ['KW002'], '門市名稱可搜尋');
  assertEq(await evaluate(`window.__search('kw002')`), ['KW002'], '案件編號可搜尋（不分大小寫）');
  assertEq(await evaluate(`window.__search('冰箱')`), ['KW002'], '叫修項目可搜尋');
  assertEq(await evaluate(`window.__search('軸承磨損')`), ['KW002'], '實際原因可搜尋');
  assertEq(await evaluate(`window.__search('例行保養')`), ['KW003'], '保養案件工項分類顯示值可搜尋');
  assertEq(await evaluate(`window.__search('不存在的關鍵字')`), [], '無相符時列表為空');
  assertEq((await evaluate(`window.__search('')`)).slice().sort(),
    ['KW001', 'KW002', 'KW003'], '清空關鍵字後恢復全部');

  console.log('\n輸入中尚未按搜尋');
  const typingOnly = await evaluate(`(function(){
    var host = window.__mountReview();
    var input = host.querySelector('input[type="text"]');
    input.value = '中山門市';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return window.__caseNumbers();
  })()`);
  assertEq(typingOnly.slice().sort(), ['KW001', 'KW002', 'KW003'], '僅輸入未按搜尋時不套用過濾');

  console.log('\nEnter 觸發搜尋');
  const enterResult = await evaluate(`(function(){
    var host = document.getElementById('__reviewHost');
    var input = host.querySelector('input[type="text"]');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return window.__caseNumbers();
  })()`);
  assertEq(enterResult, ['KW002'], '按 Enter 可套用關鍵字');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
