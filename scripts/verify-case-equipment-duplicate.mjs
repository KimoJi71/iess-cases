#!/usr/bin/env node
/**
 * 叫修案件：已加入的設備不可再被加入。
 * 涵蓋 PickerModal 的「已加入」標示、isSelectable/findEquipmentForScan 的排除，
 * 以及編輯表單手動選擇／掃描 QR Code 的重複防呆。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9342);

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
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-equip-duplicate-profile',
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
    window.__mkEq = function (id, name) {
      return {
        id: id, customerName: '測試客戶', storeName: '測試門市',
        category: '空調', brand: '大金', deviceName: name,
        specification: '2.2kW', model: 'FTXS', equipmentLevel: '增額設備',
        area: '廚房', acceptanceDate: '2020-02-01', installer: '王小明',
        assetNumber: 'A-' + id, serialNumber: 'SN-' + id, status: '運轉中',
        createdDate: '${todayDate}'
      };
    };
    window.__eqs = [window.__mkEq('E1', '室內機'), window.__mkEq('E2', '室外機')];
    // 掃描不得跨門市取件，因此測試資料含另一家門市的設備
    window.__otherStoreEq = (function () {
      var eq = window.__mkEq('E9', '他店室內機');
      eq.customerName = '其他客戶';
      eq.storeName = '其他門市';
      return eq;
    })();
    window.__allEqs = window.__eqs.concat([window.__otherStoreEq]);

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
    window.__rowActions = function (node) {
      return Array.prototype.map.call(node.querySelectorAll('tbody tr'), function (tr) {
        var td = tr.querySelector('td');
        return td ? td.textContent.replace(/\\s+/g, ' ').trim() : '';
      });
    };
    window.__mkCase = function () {
      return {
        id: 'C1', caseNumber: '20260814001', customerName: '測試客戶', storeName: '測試門市',
        companyCity: '台北市', companyDistrict: '中山區', workCategory: '一般叫修',
        repairItem: '室內機', repairReason: '不冷', faultDesc: '出風不冷',
        actualReason: '', assignees: [], isClosed: false, processStatus: null,
        createdAt: '${todayDate} 09:00:00', repairDate: '${todayDate} 09:00:00',
        expectedDate: '${todayDate}', expectedTimeStart: '09:00', expectedTimeEnd: '11:00',
        processRecords: [], equipment: null
      };
    };
  `);

  console.log('\n工具函式排除已加入設備');
  const utils = await evaluate(`(function () {
    var eq1 = window.__eqs[0], eq2 = window.__eqs[1];
    var form = { customerName: '測試客戶', storeName: '測試門市' };
    return {
      addedTrue: RepairCaseEquipment.isAdded(eq1, ['E1']),
      addedFalse: RepairCaseEquipment.isAdded(eq2, ['E1']),
      selectableWhenAdded: RepairCaseEquipment.isSelectable(eq1, ['E1']),
      selectableWhenNotAdded: RepairCaseEquipment.isSelectable(eq2, ['E1']),
      selectableNoArg: RepairCaseEquipment.isSelectable(eq1),
      scanFirst: (RepairCaseEquipment.findEquipmentForScan(window.__eqs, form, []) || {}).id,
      scanSkipAdded: (RepairCaseEquipment.findEquipmentForScan(window.__eqs, form, ['E1']) || {}).id,
      scanAllAdded: RepairCaseEquipment.findEquipmentForScan(window.__eqs, form, ['E1', 'E2']),
      scanNoCrossStore: RepairCaseEquipment.findEquipmentForScan(
        window.__allEqs, form, ['E1', 'E2']
      ),
      scanStoreOnly: (RepairCaseEquipment.findEquipmentForScan(
        window.__allEqs, form, ['E1']
      ) || {}).id
    };
  })()`);
  assertEq(utils.addedTrue, true, 'isAdded 命中已加入 id');
  assertEq(utils.addedFalse, false, 'isAdded 不誤判其他設備');
  assertEq(utils.selectableWhenAdded, false, '已加入的設備不可選');
  assertEq(utils.selectableWhenNotAdded, true, '未加入的設備仍可選');
  assertEq(utils.selectableNoArg, true, '未傳 addedIds 時維持原行為');
  assertEq(utils.scanFirst, 'E1', '掃描取第一筆可用設備');
  assertEq(utils.scanSkipAdded, 'E2', '掃描跳過已加入的設備');
  assertEq(utils.scanAllAdded, null, '全部已加入時掃描回傳 null');
  assertEq(utils.scanNoCrossStore, null, '本店設備全加入時不會掃到他店設備');
  assertEq(utils.scanStoreOnly, 'E2', '掃描只取本客戶／門市的設備');

  console.log('\n選擇設備視窗標示已加入');
  const picker = await evaluate(`(function () {
    var node = RepairCaseEquipment.PickerModal({
      h: IESS.h, items: window.__eqs, addedIds: ['E1'],
      onSelect: function () {}, onClose: function () {}
    });
    var rows = Array.prototype.map.call(node.querySelectorAll('tbody tr'), function (tr) {
      var td = tr.querySelector('td');
      return {
        text: td ? td.textContent.replace(/\\s+/g, ' ').trim() : '',
        hasButton: !!(td && td.querySelector('button')),
        title: td && td.firstChild ? (td.firstChild.getAttribute('title') || '') : ''
      };
    });
    return { rows: rows };
  })()`);
  const addedRow = picker.rows.find(r => r.text === '已加入');
  const openRow = picker.rows.find(r => r.text === '選擇');
  assertTrue(!!addedRow, '已加入的設備列顯示「已加入」', JSON.stringify(picker.rows));
  assertTrue(addedRow && !addedRow.hasButton, '「已加入」列沒有可點的選擇按鈕');
  assertEq(addedRow && addedRow.title, '已加入此案件', '「已加入」列的 title 說明原因');
  assertTrue(!!openRow && openRow.hasButton, '未加入的設備列仍可點選擇');

  console.log('\n編輯表單重複加入防呆');
  const form = await evaluate(`(function () {
    var toasts = [];
    var wrap = document.createElement('div');
    document.body.appendChild(wrap);
    wrap.appendChild(EditCaseForm({
      editingCase: window.__mkCase(),
      cases: [], setCases: function () {}, stores: [], customers: [],
      equipments: window.__allEqs,
      deviceCategories: [], processMethods: [],
      setView: function () {},
      showToast: function (msg, tone) { toasts.push({ msg: msg, tone: tone || 'success' }); }
    }));
    function findBtn(text) {
      return Array.prototype.find.call(wrap.querySelectorAll('button'), function (b) {
        return b.textContent.replace(/\\s+/g, ' ').trim().indexOf(text) !== -1;
      });
    }
    function openPicker() {
      findBtn('加入設備').click();
      findBtn('手動選擇').click();
      return wrap.querySelector('.app-modal-overlay');
    }
    // 第一次：選第一筆設備
    var modal = openPicker();
    var firstActions = window.__rowActions(modal);
    Array.prototype.find.call(modal.querySelectorAll('tbody tr td button'), function () {
      return true;
    }).click();
    // 第二次開啟：該筆應已標示「已加入」
    modal = openPicker();
    var secondActions = window.__rowActions(modal);
    var closeBtn = Array.prototype.find.call(modal.querySelectorAll('button'), function (b) {
      return b.textContent.replace(/\\s+/g, ' ').trim() === '取消';
    });
    if (closeBtn) closeBtn.click();
    // 掃描兩次：第二次應被擋下（E2 加入後兩筆設備都已在案件中）
    findBtn('加入設備').click();
    findBtn('掃描 QR Code').click();
    findBtn('加入設備').click();
    findBtn('掃描 QR Code').click();
    var result = {
      firstActions: firstActions,
      secondActions: secondActions,
      toasts: toasts,
      // 一次只顯示一張卡片，總張數看切換列；只有一張時沒有切換列
      itemCount: window.__pagerTotal(wrap),
      // 逐張切過去收集卡片內的流水序號，確認沒有混進他店設備
      serialNumbers: window.__eachCard(wrap, function (root) {
        return Array.prototype.filter.call(
          root.querySelectorAll('div'),
          function (n) { return /^SN-E\\d$/.test(n.textContent.trim()); }
        ).map(function (n) { return n.textContent.trim(); }).join(',');
      })
    };
    wrap.remove();
    return result;
  })()`);
  assertEq(form.firstActions, ['選擇', '選擇'], '初次開啟兩筆設備皆可選');
  assertTrue(
    form.secondActions.filter(t => t === '已加入').length === 1
      && form.secondActions.filter(t => t === '選擇').length === 1,
    '加入一筆後該列變「已加入」，另一筆仍可選',
    form.secondActions.join(' | ')
  );
  assertTrue(
    form.toasts.some(t => t.msg === '已無可加入的設備' && t.tone === 'error'),
    '設備全數加入後再掃描會被擋下',
    form.toasts.map(t => `${t.msg}(${t.tone})`).join(' | ')
  );
  assertTrue(
    !form.toasts.some(t => t.msg === '此設備已加入本案件' && t.tone !== 'error'),
    '重複加入提示為錯誤色調'
  );
  assertEq(form.itemCount, 2, '本店兩筆設備加入後不再增加服務項目卡片');
  assertEq(form.serialNumbers.length, 2, '兩張卡片都取得到內容');
  assertTrue(
    form.serialNumbers.every(sn => sn === 'SN-E1' || sn === 'SN-E2'),
    '卡片內不會出現他店設備',
    form.serialNumbers.join(' | ')
  );

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
