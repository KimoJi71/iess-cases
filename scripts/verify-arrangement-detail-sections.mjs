#!/usr/bin/env node
/**
 * 「案件安排排程彈窗的維修分支沿用編輯頁區塊」驗證腳本。
 *
 * 彈窗不像元件可以直接掛載，必須走真實 UI 路徑：主選單「案件排程 → 案件安排」，
 * 在待安排面板選好篩選條件後查詢，再點開第一筆案件。
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
const PORT = Number(process.env.CDP_PORT || 9372);
if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-arrangement-detail-profile',
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

// 全站的 <select> 都被 core/searchable-select.js 換成 combobox（input + 選單），
// 因此下拉一律以「開啟選單 → 點選項」操作，不能直接寫 select.value。
const SETUP = String.raw`(function () {
  // 走真實選單路徑進入「案件安排」，避免測試綁死內部 view 名稱
  window.__go = function (subMenu) {
    var top = Array.prototype.slice.call(document.querySelectorAll('header button'))
      .filter(function (b) { return b.textContent.trim() === '案件排程'; })[0];
    if (!top) throw new Error('找不到主選單：案件排程');
    top.click();
    var sub = Array.prototype.slice.call(document.querySelectorAll('.app-sidebar nav button'))
      .filter(function (b) { return b.textContent.trim() === subMenu; })[0];
    if (!sub) throw new Error('找不到子選單：' + subMenu);
    sub.click();
    return true;
  };
  // 待安排面板＝收合開關所在的那張灰底卡片
  window.__panel = function () {
    return document.querySelector('[data-testid="pending-panel-toggle"]').parentElement;
  };
  window.__openSelect = function (root, labelText) {
    var target = Array.prototype.slice.call(root.querySelectorAll('.searchable-select'))
      .filter(function (w) {
        var lab = w.parentElement.querySelector('label');
        return lab && lab.textContent.trim().replace('*', '') === labelText;
      })[0];
    if (!target) throw new Error('找不到欄位：' + labelText);
    var input = target.querySelector('input');
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    input.focus();
    return true;
  };
  // 組別選項標籤帶組員姓名（例：「B組李美華、林雅婷」），故以開頭比對
  window.__pickOptionStarting = function (prefix) {
    var opt = Array.prototype.slice.call(document.querySelectorAll('.searchable-select__option'))
      .filter(function (o) { return o.textContent.trim().indexOf(prefix) === 0; })[0];
    if (!opt) throw new Error('選單無此項：' + prefix);
    opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    return opt.textContent.trim();
  };
  window.__clickPanelSearch = function () {
    var b = Array.prototype.slice.call(window.__panel().querySelectorAll('button'))
      .filter(function (x) { return x.textContent.trim() === '查詢'; })[0];
    if (!b) throw new Error('待安排面板找不到「查詢」');
    if (b.disabled) return false;
    b.click();
    return true;
  };
  window.__pendingCount = function () {
    return document.querySelectorAll('div.cursor-pointer.hover\\:bg-blue-50').length;
  };
  window.__openFirstPending = function () {
    var items = document.querySelectorAll('div.cursor-pointer.hover\\:bg-blue-50');
    if (!items.length) throw new Error('待安排清單為空');
    items[0].click();
    return true;
  };
  window.__modal = function () {
    return document.querySelector('.app-modal-overlay');
  };
  // 只取區塊自己的標題；區塊標題一律 h3；區塊內的「時間紀錄」等小標是 h4，不算一段
  window.__modalSectionTitles = function () {
    var m = window.__modal();
    if (!m) return null;
    return Array.prototype.map.call(m.querySelectorAll('section h3'),
      function (el) { return el.textContent.trim(); });
  };
  window.__modalSectionByTitle = function (title) {
    var m = window.__modal();
    if (!m) return null;
    return Array.prototype.slice.call(m.querySelectorAll('section')).filter(function (s) {
      var t = s.querySelector('h3, h4');
      return t && t.textContent.trim() === title;
    })[0] || null;
  };
  window.__modalEditableCount = function (title) {
    var s = window.__modalSectionByTitle(title);
    if (!s) return -1;
    return s.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])').length;
  };
  // 工項分類同時有「保養清潔」與「保養」，開頭比對會選錯，故另備一支完全比對
  window.__pickOptionExact = function (text) {
    var opt = Array.prototype.slice.call(document.querySelectorAll('.searchable-select__option'))
      .filter(function (o) {
        var lab = o.querySelector('.searchable-select__option-label');
        return (lab ? lab.textContent : o.textContent).trim() === text;
      })[0];
    if (!opt) throw new Error('選單無此項：' + text);
    opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    return opt.textContent.trim();
  };
  // 共用區塊的欄位標題是 <span> 不是 <label>，__openSelect 那條路徑走不到，
  // 因此以「區塊 → 第 n 個 searchable-select」定位。
  window.__openSectionSelect = function (title, idx) {
    var s = window.__modalSectionByTitle(title);
    if (!s) throw new Error('找不到區塊：' + title);
    var wrap = s.querySelectorAll('.searchable-select')[idx || 0];
    if (!wrap) throw new Error('區塊內找不到下拉：' + title);
    var input = wrap.querySelector('input');
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    input.focus();
    return true;
  };
  // 彈窗頂端的預計開始／結束時間是 TimeInput24（小時、分鐘兩個下拉）
  window.__openModalTimeSelect = function (labelText, idx) {
    var m = window.__modal();
    var lab = Array.prototype.slice.call(m.querySelectorAll('label'))
      .filter(function (l) { return l.textContent.trim() === labelText; })[0];
    if (!lab) throw new Error('彈窗找不到欄位：' + labelText);
    var wrap = lab.parentElement.querySelectorAll('.searchable-select')[idx];
    if (!wrap) throw new Error('欄位內找不到下拉：' + labelText);
    var input = wrap.querySelector('input');
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    input.focus();
    return true;
  };
  window.__modalDateValue = function () {
    var m = window.__modal();
    var el = m && m.querySelector('input[type="date"]');
    return el ? el.value : null;
  };
  // ReadOnlyField ＝ <span>標題</span> + <div>值</div>
  window.__modalReadOnlyValue = function (title, label) {
    var s = window.__modalSectionByTitle(title);
    if (!s) return null;
    var span = Array.prototype.slice.call(s.querySelectorAll('span'))
      .filter(function (e) { return e.textContent.trim() === label; })[0];
    if (!span || !span.nextElementSibling) return null;
    return span.nextElementSibling.textContent.trim();
  };
  // 保養結果的「保養狀態」是 searchable-select，讀 input 的顯示值即為目前狀態
  window.__modalSectionSelectValue = function (title, idx) {
    var s = window.__modalSectionByTitle(title);
    if (!s) return null;
    var wrap = s.querySelectorAll('.searchable-select')[idx || 0];
    return wrap ? wrap.querySelector('input').value : null;
  };
  window.__savedStoreName = '';
  window.__savedCustomerName = '';
  window.__savedPlanDate = '';
  window.__openCalendarEventByText = function (text) {
    var el = Array.prototype.slice.call(document.querySelectorAll('.fc-event, .fc-event-title'))
      .filter(function (e) { return e.textContent.indexOf(text) !== -1; })[0];
    if (!el) throw new Error('日曆上找不到事件：' + text);
    el.click();
    return true;
  };
  // 走真實選單路徑切到「客戶建檔 → 門市管理」，避免綁死內部 view 名稱
  window.__gotoStoreList = function () {
    var top = Array.prototype.slice.call(document.querySelectorAll('header button'))
      .filter(function (b) { return b.textContent.trim() === '戰情室'; })[0];
    if (!top) throw new Error('找不到主選單：戰情室');
    top.click();
    var sub = Array.prototype.slice.call(document.querySelectorAll('.app-sidebar nav button'))
      .filter(function (b) { return b.textContent.trim() === '門市管理'; })[0];
    if (!sub) throw new Error('找不到子選單：門市管理');
    sub.click();
    return true;
  };
  // 門市列表的「客戶名稱」label 帶必填星號，__openSelect 的完全比對對不上，故改為包含比對
  window.__openSelectLoose = function (labelText) {
    var target = Array.prototype.slice.call(document.querySelectorAll('.searchable-select'))
      .filter(function (w) {
        var lab = w.parentElement.querySelector('label');
        return lab && lab.textContent.indexOf(labelText) !== -1;
      })[0];
    if (!target) throw new Error('找不到欄位：' + labelText);
    var input = target.querySelector('input');
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    input.focus();
    return true;
  };
  window.__openStoreRowEdit = function (storeName) {
    var row = Array.prototype.slice.call(document.querySelectorAll('tbody tr'))
      .filter(function (tr) { return tr.textContent.indexOf(storeName) !== -1; })[0];
    if (!row) throw new Error('門市列表找不到該門市：' + storeName);
    // 全站的 icon 按鈕被 tooltip 層改寫，title 會被搬到 aria-label
    var btn = Array.prototype.slice.call(row.querySelectorAll('button'))
      .filter(function (b) { return (b.getAttribute('aria-label') || '') === '編輯'; })[0];
    if (!btn) throw new Error('該列沒有編輯鈕：' + storeName);
    btn.click();
    return true;
  };
  window.__clickText = function (text, scope) {
    var root = scope ? document.querySelector(scope) : document;
    var el = Array.prototype.slice.call(root.querySelectorAll('button'))
      .filter(function (b) { return b.textContent.trim() === text; })[0];
    if (!el) throw new Error('找不到按鈕：' + text);
    el.click();
    return true;
  };
  window.__clickAriaLabel = function (label, scope) {
    var root = scope ? document.querySelector(scope) : document;
    var el = Array.prototype.slice.call(root.querySelectorAll('button'))
      .filter(function (b) { return (b.getAttribute('aria-label') || '') === label; })[0];
    if (!el) throw new Error('找不到按鈕：' + label);
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
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false
  });
  await send('Page.navigate', { url: `file://${ROOT}/index.html` });
  await sleep(4000);
  await evaluate(SETUP);
  await evaluate(`window.__go('案件安排')`);
  await sleep(1200);

  // 待安排面板：工項分類／客戶名稱／組別皆為必填，且組別須涵蓋門市所在公司區域，
  // 因此逐一試組別×客戶，取第一組真的查得到待安排維修案件的條件。
  await evaluate(`window.__openSelect(window.__panel(), '工項分類')`);
  await sleep(250);
  await evaluate(`window.__pickOptionStarting('一般叫修')`);
  await sleep(350);
  const groupPrefixes = ['A組', 'B組', 'C組', 'D組'];
  const customers = ['屈臣氏', '星巴克', '統一超商', '萊爾富'];
  let opened = false;
  outer:
  for (const g of groupPrefixes) {
    let picked;
    await evaluate(`window.__openSelect(window.__panel(), '組別')`);
    await sleep(250);
    try { picked = await evaluate(`window.__pickOptionStarting(${JSON.stringify(g)})`); }
    catch { continue; }
    await sleep(300);
    for (const c of customers) {
      await evaluate(`window.__openSelect(window.__panel(), '客戶名稱')`);
      await sleep(250);
      try { await evaluate(`window.__pickOptionStarting(${JSON.stringify(c)})`); }
      catch { continue; }
      await sleep(300);
      if (!await evaluate('window.__clickPanelSearch()')) continue;
      await sleep(500);
      if (await evaluate('window.__pendingCount()') > 0) {
        console.log(`  （待安排條件：一般叫修／${c}／${picked}）`);
        opened = true;
        break outer;
      }
    }
  }
  assertTrue(opened, '待安排面板查得到可安排的維修案件');
  await evaluate('window.__openFirstPending()');
  await sleep(700);

  console.log('\nSection 1｜維修排程彈窗沿用編輯頁區塊');
  assertDeep(await evaluate('window.__modalSectionTitles()'),
    ['1. 案件資料', '2. 設備與服務項目', '3. 維修結果'],
    '彈窗為三段式，編號自 1 起算（頂端已有排程主控）');

  console.log('\nSection 2｜案件資料改為唯讀');
  assertEq(await evaluate(`window.__modalEditableCount('1. 案件資料')`), 0,
    '客戶／門市／工項分類／叫修項目／叫修原因／故障描述皆為唯讀');

  console.log('\nSection 3｜維修結果區塊存在且欄位齊全');
  // 沒有這道 gate 的話，區塊消失時 s.querySelector 會直接丟例外中斷整支腳本，
  // 後面的 Section 就再也不會回報——壞掉時反而看不出還壞了哪些。
  assertTrue(await evaluate(`window.__modalSectionByTitle('3. 維修結果') !== null`),
    '彈窗有「3. 維修結果」區塊');
  assertDeep(await evaluate(`(function () {
    var s = window.__modalSectionByTitle('3. 維修結果');
    if (!s) return null;
    return {
      processStatus: !!s.querySelector('[name="processStatus"]'),
      repairRemark: !!s.querySelector('textarea[name="repairRemark"]'),
      signButton: Array.prototype.slice.call(s.querySelectorAll('button'))
        .some(function (b) { return b.textContent.trim().indexOf('客戶簽收') !== -1; }),
      timeInputs: s.querySelectorAll('input[type="datetime-local"]').length
    };
  })()`), { processStatus: true, repairRemark: true, signButton: true, timeInputs: 2 },
    '處理狀態、維修備註、客戶簽收、到店與完成時間皆在');

  console.log('\nSection 4｜設備區可加入設備並解除維修結果鎖定');
  assertEq(await evaluate(`(function () {
    var s = window.__modalSectionByTitle('3. 維修結果');
    if (!s || !s.querySelector('[name="processStatus"]')) return null;
    return s.querySelector('[name="processStatus"]').disabled;
  })()`), true, '未加入設備時處理狀態鎖住');
  await evaluate(`window.__clickAriaLabel('加入設備', '.app-modal-overlay')`);
  await sleep(300);
  assertTrue(await evaluate(`(function () {
    var m = window.__modal();
    var labels = Array.prototype.map.call(m.querySelectorAll('button'),
      function (b) { return b.textContent.trim(); });
    return labels.indexOf('手動選擇') !== -1
      && labels.some(function (t) { return t.indexOf('掃描 QR Code') !== -1; });
  })()`), '「加入設備」下拉出現「手動選擇」與「掃描 QR Code」');

  console.log('\nSection 5｜設備挑選器不被彈窗捲動容器裁掉');
  await evaluate(`window.__clickText('手動選擇', '.app-modal-overlay')`);
  await sleep(600);
  assertTrue(await evaluate(`document.querySelectorAll('.app-modal-overlay').length >= 2`),
    '設備挑選器另開一層 overlay');
  assertEq(await evaluate(`(function () {
    var all = document.querySelectorAll('.app-modal-overlay');
    return all.length >= 2 ? all[0].contains(all[1]) : null;
  })()`), false, '挑選器是排程彈窗的兄弟節點，不在其捲動容器內');

  console.log('\nSection 6｜加入設備後共用模組的 handler 在彈窗內也生效');
  await evaluate(`(function () {
    var picker = document.querySelectorAll('.app-modal-overlay')[1];
    var btn = Array.prototype.slice.call(picker.querySelectorAll('button'))
      .filter(function (b) { return b.textContent.trim() === '選擇'; })[0];
    if (!btn) throw new Error('挑選器沒有可選的設備');
    btn.click();
    return true;
  })()`);
  await sleep(600);
  assertEq(await evaluate(`document.querySelectorAll('.app-modal-overlay').length`), 1,
    '選完設備後挑選器關閉');
  assertTrue(await evaluate(`window.__modalSectionByTitle('2. 設備與服務項目') !== null`),
    '彈窗有「2. 設備與服務項目」區塊');
  assertTrue(await evaluate(`(function () {
    var s = window.__modalSectionByTitle('2. 設備與服務項目');
    if (!s) return false;
    return !!s.querySelector('textarea[name="serviceItemActualReason"]');
  })()`), '設備段長出服務項目卡片');
  assertEq(await evaluate(`(function () {
    var s = window.__modalSectionByTitle('3. 維修結果');
    if (!s || !s.querySelector('[name="processStatus"]')) return null;
    return s.querySelector('[name="processStatus"]').disabled;
  })()`), false, '加入設備後維修結果解鎖');

  // ---- 保養分支 ----
  // 先把維修彈窗收掉，再用同一組待安排篩選條件換成「保養」重新查一次
  await evaluate(`window.__clickText('取消', '.app-modal-overlay')`);
  await sleep(400);
  await evaluate(`window.__openSelect(window.__panel(), '工項分類')`);
  await sleep(250);
  await evaluate(`window.__pickOptionExact('保養')`);
  await sleep(350);
  let mOpened = false;
  outerM:
  for (const g of groupPrefixes) {
    let picked;
    await evaluate(`window.__openSelect(window.__panel(), '組別')`);
    await sleep(250);
    try { picked = await evaluate(`window.__pickOptionStarting(${JSON.stringify(g)})`); }
    catch { continue; }
    await sleep(300);
    for (const c of customers) {
      await evaluate(`window.__openSelect(window.__panel(), '客戶名稱')`);
      await sleep(250);
      try { await evaluate(`window.__pickOptionStarting(${JSON.stringify(c)})`); }
      catch { continue; }
      await sleep(300);
      if (!await evaluate('window.__clickPanelSearch()')) continue;
      await sleep(500);
      if (await evaluate('window.__pendingCount()') > 0) {
        console.log(`  （待安排條件：保養／${c}／${picked}）`);
        mOpened = true;
        break outerM;
      }
    }
  }
  assertTrue(mOpened, '待安排面板查得到可安排的保養案件');
  await evaluate('window.__openFirstPending()');
  await sleep(700);

  console.log('\nSection 7｜保養排程彈窗沿用保養明細區塊');
  assertDeep(await evaluate('window.__modalSectionTitles()'),
    ['1. 案件資料', '2. 設備資料', '3. 保養結果'],
    '保養彈窗為三段式，編號自 1 起算');

  console.log('\nSection 8｜保養案件資料改為唯讀');
  assertEq(await evaluate(`window.__modalEditableCount('1. 案件資料')`), 0,
    '客戶／門市／行政區域／服務等級／門市地址皆為唯讀');

  console.log('\nSection 9｜保養結果可編輯');
  assertTrue(await evaluate(`window.__modalSectionByTitle('3. 保養結果') !== null`),
    '彈窗有「3. 保養結果」區塊');
  assertDeep(await evaluate(`(function () {
    var s = window.__modalSectionByTitle('3. 保養結果');
    if (!s) return null;
    return {
      status: !!s.querySelector('.searchable-select input'),
      remark: !!s.querySelector('textarea'),
      signButton: Array.prototype.slice.call(s.querySelectorAll('button'))
        .some(function (b) { return b.textContent.trim().indexOf('客戶簽收') !== -1; })
    };
  })()`), { status: true, remark: true, signButton: true },
    '保養狀態、備註、客戶簽收皆可操作');

  console.log('\nSection 10｜手選「已完成」不被 planDate 推算覆寫');
  // 儲存前先把門市／客戶／預計日期記下來，之後要拿去比對門市的「上次保養日期」
  await evaluate(`(function () {
    window.__savedStoreName = window.__modalReadOnlyValue('1. 案件資料', '門市名稱');
    window.__savedCustomerName = window.__modalReadOnlyValue('1. 案件資料', '客戶名稱');
    window.__savedPlanDate = window.__modalDateValue();
    return true;
  })()`);
  const savedStoreName = await evaluate('window.__savedStoreName');
  const savedPlanDate = await evaluate('window.__savedPlanDate');
  assertTrue(!!savedStoreName && !!savedPlanDate,
    '讀得到彈窗的門市名稱與預計日期', `${savedStoreName} / ${savedPlanDate}`);
  // 確認排程需要完整時間區間，先補上開始與結束時間
  for (const [label, hour] of [['預計開始時間', '09'], ['預計結束時間', '11']]) {
    await evaluate(`window.__openModalTimeSelect(${JSON.stringify(label)}, 0)`);
    await sleep(250);
    await evaluate(`window.__pickOptionExact(${JSON.stringify(hour)})`);
    await sleep(300);
    await evaluate(`window.__openModalTimeSelect(${JSON.stringify(label)}, 1)`);
    await sleep(250);
    await evaluate(`window.__pickOptionExact('00')`);
    await sleep(300);
  }
  await evaluate(`window.__openSectionSelect('3. 保養結果', 0)`);
  await sleep(250);
  await evaluate(`window.__pickOptionExact('已完成')`);
  await sleep(400);
  assertEq(await evaluate(`window.__modalSectionSelectValue('3. 保養結果', 0)`), '已完成',
    '將保養狀態手動改為「已完成」');
  await evaluate(`window.__clickText('確認', '.app-modal-overlay')`);
  await sleep(600);
  assertEq(await evaluate('window.__modal() === null'), true, '排程已儲存，彈窗關閉');
  // app.js 的 store 是 IIFE 內的區域變數，測試讀不到；改以「重新點開日曆上同一筆案件」
  // 從 UI 讀回儲存結果，這也更貼近使用者實際會看到的東西。
  await evaluate(`window.__openCalendarEventByText(window.__savedStoreName)`);
  await sleep(700);
  assertEq(await evaluate(`window.__modalSectionSelectValue('3. 保養結果', 0)`), '已完成',
    '重新開啟後狀態仍為「已完成」，未被 planDate 推算覆寫');
  assertTrue(await evaluate(`(function () {
    var v = window.__modalReadOnlyValue('3. 保養結果', '完成時間');
    return !!v && v !== '-' && v !== '—';
  })()`), '已完成同時押上完成時間');

  console.log('\nSection 11｜門市「上次保養日期」同步更新');
  await evaluate(`window.__clickText('取消', '.app-modal-overlay')`);
  await sleep(400);
  await evaluate(`window.__gotoStoreList()`);
  await sleep(600);
  await evaluate(`window.__openSelectLoose('客戶名稱')`);
  await sleep(250);
  await evaluate(`window.__pickOptionExact(window.__savedCustomerName)`);
  await sleep(500);
  await evaluate(`window.__openStoreRowEdit(window.__savedStoreName)`);
  await sleep(600);
  assertEq(await evaluate(`(function () {
    var el = document.querySelector('input[name="lastMaintenanceDate"]');
    return el ? el.value : null;
  })()`), savedPlanDate, '門市的上次保養日期等於本次保養日期');

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
