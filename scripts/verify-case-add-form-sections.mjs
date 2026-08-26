#!/usr/bin/env node
/**
 * 新增叫修單改用與編輯叫修單相同的區塊卡片樣式（一個標題一區），
 * 驗證區塊標題、欄位分配、自動帶入與存檔流程仍正常。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9378);

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

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-case-add-sections-profile',
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
    window.__customers = [{ id: 'CX1', name: '測試客戶', serviceLevel: 'B 保修(一年兩次)', isEnabled: true }];
    window.__stores = [{
      id: 9001, customerName: '測試客戶', storeName: '測試門市',
      companyCity: '台北市', companyDistrict: '信義區', companyAddress: '松智路X號',
      serviceLevel: 'B 保修(一年兩次)', storeStatus: '正常營業',
      remarks: '一樓大廳需保持整潔，施工請走後門。'
    }];
    window.__saved = null;
    window.__mountAdd = function () {
      var wrap = document.createElement('div');
      document.body.appendChild(wrap);
      wrap.appendChild(AddCaseForm({
        cases: [], setCases: function (next) { window.__saved = next; },
        stores: window.__stores, customers: window.__customers,
        vehicles: [], vendors: [],
        setView: function () {}, showToast: function () {},
        currentOperatorName: '測試員'
      }));
      return wrap;
    };
    // 區塊卡片：section > h3 標題 + 內容
    window.__sections = function (root) {
      return Array.prototype.map.call(root.querySelectorAll('section'), function (sec) {
        var h3 = sec.querySelector('h3');
        return {
          title: h3 ? h3.textContent.replace(/\\s+/g, ' ').trim() : '',
          card: /bg-white/.test(sec.className) && /rounded-lg/.test(sec.className),
          labels: Array.prototype.map.call(sec.querySelectorAll('label, span'), function (n) {
            return n.textContent.trim();
          })
        };
      });
    };
    window.__pick = function (root, name, label) {
      var input = root.querySelector('[name="' + name + '"]');
      input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      var btns = Array.prototype.filter.call(
        document.querySelectorAll('.searchable-select__menu--portal .searchable-select__option'),
        function (b) { return b.textContent.trim() === label; }
      );
      if (!btns.length) throw new Error('找不到選項 ' + label);
      btns[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    };
  `);

  console.log('\n區塊結構');
  const layout = await evaluate(`(function () {
    var wrap = window.__mountAdd();
    var secs = window.__sections(wrap);
    var out = {
      titles: secs.map(function (s) { return s.title; }),
      allCards: secs.every(function (s) { return s.card; }),
      basicLabels: (secs[0] || {}).labels,
      contentHasCategory: ((secs[1] || {}).labels || []).indexOf('工項分類') !== -1,
      scheduleHasAssignee: ((secs[2] || {}).labels || []).indexOf('組別') !== -1,
      // 舊版把三段擠在同一張大表單，改版後不該再有非 section 的區塊標題
      legacyHeaders: wrap.querySelectorAll('div.col-span-full.font-semibold').length
    };
    wrap.remove();
    return out;
  })()`);
  assertEq(layout.titles, ['1. 基本資料', '2. 叫修內容', '3. 排程資料'], '三個區塊各一個標題');
  assertEq(layout.allCards, true, '每個區塊都是白底卡片');
  assertEq(layout.legacyHeaders, 0, '不再有舊版共用表單的行內標題');
  assertEq(
    layout.basicLabels.filter(t => ['客戶名稱', '門市名稱', '叫修人員', '服務等級', '門市地址', '門市備註'].indexOf(t) !== -1),
    ['客戶名稱', '門市名稱', '叫修人員', '服務等級', '門市地址', '門市備註'],
    '基本資料區欄位順序與編輯頁一致（門市備註接在門市地址後方）'
  );
  assertEq(layout.contentHasCategory, true, '叫修內容區含工項分類');
  assertEq(layout.scheduleHasAssignee, true, '排程資料區含組別');

  console.log('\n功能仍正常');
  const flow = await evaluate(`(function () {
    var wrap = window.__mountAdd();
    function readOnlyValue(label) {
      var nodes = wrap.querySelectorAll('span');
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].textContent.trim() === label && nodes[i].nextElementSibling) {
          return nodes[i].nextElementSibling.textContent.trim();
        }
      }
      return null;
    }
    var out = {
      reporter: readOnlyValue('叫修人員'),
      addressBefore: readOnlyValue('門市地址'),
      remarksBefore: readOnlyValue('門市備註')
    };
    window.__pick(wrap, 'customerName', '測試客戶');
    window.__pick(wrap, 'storeName', '測試門市');
    out.serviceLevel = readOnlyValue('服務等級');
    out.addressAfter = readOnlyValue('門市地址');
    out.storeRemarks = readOnlyValue('門市備註');
    wrap.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    out.savedCount = window.__saved ? window.__saved.length : 0;
    out.savedStore = window.__saved && window.__saved[0].storeName;
    out.savedAddress = window.__saved && window.__saved[0].storeAddress;
    wrap.remove();
    return out;
  })()`);
  assertEq(flow.reporter, '測試員', '叫修人員帶入目前操作者');
  assertEq(flow.addressBefore, '請先選擇客戶與門市', '未選門市時顯示提示文字');
  assertEq(flow.serviceLevel, 'B 保修(一年兩次)', '選客戶後自動帶入服務等級');
  assertEq(flow.addressAfter, '台北市信義區松智路X號', '選門市後自動帶入門市地址');
  assertEq(flow.remarksBefore, '—', '未選門市時門市備註為空');
  assertEq(flow.storeRemarks, '一樓大廳需保持整潔，施工請走後門。', '選門市後帶入門市建檔的備註說明');
  assertEq(flow.savedCount, 1, '送出後建立一筆案件');
  assertEq(flow.savedStore, '測試門市', '新案件帶入門市名稱');
  assertEq(flow.savedAddress, '台北市信義區松智路X號', '新案件帶入門市地址');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
