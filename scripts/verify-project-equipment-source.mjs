#!/usr/bin/env node
/**
 * 工程立案「加入設備」：
 * - 汰換／撤店 → 從門市既有設備多選；新開／整裝／加裝 → 新增設備表單
 * - 設備欄位與「設備管理」一致（含設備名稱、設備狀態）
 * - 跨模式切換工項分類時跳確認視窗並清空
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9352);

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
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-project-equip-source-profile',
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

const EQUIP_COLUMNS = [
  '設備分類', '品牌', '設備名稱', '設備規格', '型號', '設備等級',
  '設備區域', '驗收日期', '安裝人員', '資產編號', '流水序號', '設備狀態'
];

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
    window.__toasts = [];
    window.__eq = function (id, extra) {
      return Object.assign({
        id: id, customerName: '測試客戶', storeName: '測試門市',
        category: '空調', brand: '大金', deviceName: '室內機',
        specification: '2.2kW', model: 'FTXS' + id, equipmentLevel: '一般設備',
        area: '廚房', acceptanceDate: '2020-02-01', installer: '王小明',
        assetNumber: 'A-' + id, serialNumber: 'SN-' + id, status: '運轉中',
        createdDate: '2024-01-01'
      }, extra || {});
    };
    window.__mount = function () {
      var wrap = document.createElement('div');
      wrap.id = 'probe';
      document.body.appendChild(wrap);
      wrap.appendChild(AddProjectForm({
        cases: [], setCases: function () {},
        stores: [{ id: 'S1', customerName: '測試客戶', storeName: '測試門市',
          city: '台北市', district: '中山區', address: '一號', serviceLevel: 'A' }],
        customers: [{ id: 'C1', name: '測試客戶', serviceLevel: 'A 全包(有簽約客戶)', status: '啟用' }],
        equipments: [window.__eq('E1'), window.__eq('E2'), window.__eq('E3', { status: '已汰換' })],
        deviceCategories: [],
        setView: function () {},
        showToast: function (msg, type) { window.__toasts.push((type || 'info') + ':' + msg); }
      }));
      return wrap;
    };
    window.__probe = function () { return document.getElementById('probe'); };
    window.__ths = function (node) {
      return Array.prototype.map.call(node.querySelectorAll('thead th'), function (t) {
        return t.textContent.trim();
      });
    };
    window.__find = function (sel, text) {
      return Array.prototype.find.call(window.__probe().querySelectorAll(sel), function (n) {
        return n.textContent.replace(/\\s+/g, ' ').trim().indexOf(text) !== -1;
      });
    };
    // 專案的下拉選單經 SearchableSelect 取代原生 select，需開選單後點選項
    window.__openSelect = function (root, name) {
      window.__clearMenus();
      var input = root.querySelector('input[name="' + name + '"]');
      input.parentNode.querySelector('button.searchable-select__toggle').click();
      return document.querySelector('.searchable-select__menu');
    };
    window.__selectOptions = function (root, name) {
      var menu = window.__openSelect(root, name);
      var labels = Array.prototype.map.call(
        menu.querySelectorAll('button.searchable-select__option'),
        function (b) { return b.textContent.trim(); }
      );
      document.body.click();
      return labels;
    };
    window.__selectValue = function (root, name) {
      return root.querySelector('input[name="' + name + '"]').value;
    };
    window.__setSelect = function (name, value, root) {
      root = root || window.__probe();
      var menu = window.__openSelect(root, name);
      var opt = Array.prototype.find.call(
        menu.querySelectorAll('button.searchable-select__option'),
        function (b) { return b.textContent.trim() === value; }
      );
      opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    };
    window.__clearMenus = function () {
      Array.prototype.forEach.call(
        document.querySelectorAll('.searchable-select__menu'),
        function (m) { m.remove(); }
      );
    };
    window.__unmount = function () {
      var p = window.__probe(); if (p) p.remove();
      window.__clearMenus();
      window.__toasts = [];
    };
  `);

  console.log('\n設備表格欄位');
  const headers = await evaluate(`(function () {
    window.__mount();
    var hs = window.__ths(window.__probe());
    window.__unmount();
    return hs;
  })()`);
  assertEq(headers, ['操作'].concat(EQUIP_COLUMNS), '立案單設備表頭 = 操作 + 設備管理欄位');

  console.log('\n案件處理設備面板');
  const panelLabels = await evaluate(`(function () {
    var node = RepairCaseEquipment.Panel({
      h: IESS.h, equipment: window.__eq('E1'),
      caseContext: { customerName: '測試客戶', storeName: '測試門市' }
    });
    return Array.prototype.map.call(node.querySelectorAll('span'), function (s) {
      return s.textContent.trim();
    });
  })()`);
  assertEq(panelLabels, EQUIP_COLUMNS, '案件處理設備欄位與立案單一致（已移除客戶／門市）');

  console.log('\n新開：開啟新增設備視窗');
  const addMode = await evaluate(`(function () {
    window.__mount();
    window.__find('button', '加入設備').click();
    var modal = window.__probe().querySelector('.app-modal-overlay');
    var title = modal ? modal.querySelector('h3').textContent.trim() : '';
    var statusValue = window.__selectValue(modal, 'status');
    var statusOptions = window.__selectOptions(modal, 'status');
    var res = { title: title, statusOptions: statusOptions, statusValue: statusValue };
    window.__unmount();
    return res;
  })()`);
  assertEq(addMode.title, '新增設備', '新開 → 開新增設備表單');
  assertEq(addMode.statusOptions, ['運轉中', '達年限', '已汰換'], '新增設備表單有設備狀態下拉');
  assertEq(addMode.statusValue, '運轉中', '設備狀態預設運轉中');

  console.log('\n汰換：未選門市');
  const noStore = await evaluate(`(function () {
    window.__mount();
    window.__setSelect('workCategory', '汰換');
    window.__find('button', '加入設備').click();
    var res = {
      toasts: window.__toasts.slice(),
      hasModal: !!window.__probe().querySelector('.app-modal-overlay')
    };
    window.__unmount();
    return res;
  })()`);
  assertEq(noStore.hasModal, false, '未選客戶門市時不開視窗');
  assertTrue(noStore.toasts.join('|').indexOf('請先選擇客戶與門市') !== -1,
    '提示先選客戶與門市', noStore.toasts.join('|'));

  console.log('\n汰換：多選既有設備');
  const picked = await evaluate(`(function () {
    window.__mount();
    window.__setSelect('customerName', '測試客戶');
    window.__setSelect('storeName', '測試門市');
    window.__setSelect('workCategory', '汰換');
    window.__find('button', '加入設備').click();
    var modal = window.__probe().querySelector('.app-modal-overlay');
    var pickerHeaders = window.__ths(modal).slice(1);
    var rows = modal.querySelectorAll('tbody tr');
    var retiredCell = rows[rows.length - 1].querySelector('td').textContent.trim();
    var boxes = modal.querySelectorAll('tbody input[type="checkbox"]');
    var confirmBtn = Array.prototype.find.call(modal.querySelectorAll('button'), function (b) {
      return b.textContent.indexOf('加入所選') !== -1;
    });
    var disabledBefore = confirmBtn.disabled;
    // 每次勾選都會 rerender，需重新取得 checkbox
    boxes[0].click();
    modal = window.__probe().querySelector('.app-modal-overlay');
    modal.querySelectorAll('tbody input[type="checkbox"]')[1].click();
    modal = window.__probe().querySelector('.app-modal-overlay');
    confirmBtn = Array.prototype.find.call(modal.querySelectorAll('button'), function (b) {
      return b.textContent.indexOf('加入所選') !== -1;
    });
    var label = confirmBtn.textContent.trim();
    confirmBtn.click();
    var table = window.__probe().querySelector('table');
    var bodyRows = table.querySelectorAll('tbody tr');
    var actionBtns = bodyRows[0].querySelectorAll('td:first-child button').length;
    var res = {
      pickerHeaders: pickerHeaders,
      checkboxCount: boxes.length,
      retiredCell: retiredCell,
      disabledBefore: disabledBefore,
      label: label,
      addedRows: bodyRows.length,
      actionBtns: actionBtns,
      toasts: window.__toasts.slice(),
      stillOpen: !!window.__probe().querySelector('.app-modal-overlay')
    };
    window.__unmount();
    return res;
  })()`);
  assertEq(picked.pickerHeaders, EQUIP_COLUMNS, '選擇設備視窗欄位與設備管理一致');
  assertEq(picked.checkboxCount, 2, '已汰換設備不提供勾選');
  assertEq(picked.retiredCell, '已汰換', '已汰換設備顯示但不可選');
  assertEq(picked.disabledBefore, true, '未勾選時 [加入所選] 停用');
  assertEq(picked.label, '加入所選（2）', '按鈕顯示已勾選筆數');
  assertEq(picked.addedRows, 2, '加入 2 筆設備');
  assertEq(picked.actionBtns, 1, '既有設備只有移除鈕（不可編輯）');
  assertEq(picked.stillOpen, false, '加入後關閉視窗');

  console.log('\n重複加入');
  const dup = await evaluate(`(function () {
    window.__mount();
    window.__setSelect('customerName', '測試客戶');
    window.__setSelect('storeName', '測試門市');
    window.__setSelect('workCategory', '汰換');
    window.__find('button', '加入設備').click();
    var modal = window.__probe().querySelector('.app-modal-overlay');
    modal.querySelectorAll('tbody input[type="checkbox"]')[0].click();
    modal = window.__probe().querySelector('.app-modal-overlay');
    Array.prototype.find.call(modal.querySelectorAll('button'), function (b) {
      return b.textContent.indexOf('加入所選') !== -1;
    }).click();
    window.__find('button', '加入設備').click();
    modal = window.__probe().querySelector('.app-modal-overlay');
    var firstCell = modal.querySelector('tbody tr td').textContent.trim();
    var boxes = modal.querySelectorAll('tbody input[type="checkbox"]').length;
    window.__unmount();
    return { firstCell: firstCell, boxes: boxes };
  })()`);
  assertEq(dup.firstCell, '已加入', '已加入的設備標示為已加入');
  assertEq(dup.boxes, 1, '已加入的設備不可重複勾選');

  console.log('\n切換工項分類');
  const switched = await evaluate(`(function () {
    window.__mount();
    window.__setSelect('customerName', '測試客戶');
    window.__setSelect('storeName', '測試門市');
    window.__setSelect('workCategory', '汰換');
    window.__find('button', '加入設備').click();
    var modal = window.__probe().querySelector('.app-modal-overlay');
    modal.querySelectorAll('tbody input[type="checkbox"]')[0].click();
    modal = window.__probe().querySelector('.app-modal-overlay');
    Array.prototype.find.call(modal.querySelectorAll('button'), function (b) {
      return b.textContent.indexOf('加入所選') !== -1;
    }).click();
    var rowsBefore = window.__probe().querySelectorAll('table tbody tr').length;
    window.__setSelect('workCategory', '新開');
    var confirmModal = window.__probe().querySelector('.app-modal-overlay');
    var confirmText = confirmModal ? confirmModal.textContent.replace(/\\s+/g, ' ').trim() : '';
    var categoryDuringConfirm = window.__selectValue(window.__probe(), 'workCategory');
    // 先取消
    Array.prototype.find.call(confirmModal.querySelectorAll('button'), function (b) {
      return b.textContent.trim() === '取消';
    }).click();
    var rowsAfterCancel = window.__probe().querySelectorAll('table tbody tr').length;
    var categoryAfterCancel = window.__selectValue(window.__probe(), 'workCategory');
    // 再確認
    window.__setSelect('workCategory', '新開');
    confirmModal = window.__probe().querySelector('.app-modal-overlay');
    Array.prototype.find.call(confirmModal.querySelectorAll('button'), function (b) {
      return b.textContent.trim() === '確認切換';
    }).click();
    var tbody = window.__probe().querySelector('table tbody');
    var res = {
      rowsBefore: rowsBefore,
      confirmText: confirmText,
      categoryDuringConfirm: categoryDuringConfirm,
      rowsAfterCancel: rowsAfterCancel,
      categoryAfterCancel: categoryAfterCancel,
      emptyText: tbody.textContent.replace(/\\s+/g, ' ').trim(),
      categoryAfterConfirm: window.__selectValue(window.__probe(), 'workCategory')
    };
    window.__unmount();
    return res;
  })()`);
  assertEq(switched.rowsBefore, 1, '切換前有 1 筆設備');
  assertTrue(switched.confirmText.indexOf('會清空已加入的設備資料') !== -1,
    '跳出確認視窗', switched.confirmText);
  assertEq(switched.categoryDuringConfirm, '汰換', '確認前工項分類未變更');
  assertEq(switched.rowsAfterCancel, 1, '取消後設備保留');
  assertEq(switched.categoryAfterCancel, '汰換', '取消後工項分類維持原值');
  assertEq(switched.emptyText, '尚未加入任何設備資料', '確認後清空設備');
  assertEq(switched.categoryAfterConfirm, '新開', '確認後套用新工項分類');

  console.log('\n換門市清空既有設備');
  const storeSwitch = await evaluate(`(function () {
    window.__mount();
    window.__setSelect('customerName', '測試客戶');
    window.__setSelect('storeName', '測試門市');
    window.__setSelect('workCategory', '撤店');
    window.__find('button', '加入設備').click();
    var modal = window.__probe().querySelector('.app-modal-overlay');
    modal.querySelectorAll('tbody input[type="checkbox"]')[0].click();
    modal = window.__probe().querySelector('.app-modal-overlay');
    Array.prototype.find.call(modal.querySelectorAll('button'), function (b) {
      return b.textContent.indexOf('加入所選') !== -1;
    }).click();
    window.__toasts = [];
    window.__setSelect('customerName', '測試客戶');
    var tbody = window.__probe().querySelector('table tbody');
    var res = {
      emptyText: tbody.textContent.replace(/\\s+/g, ' ').trim(),
      toasts: window.__toasts.slice()
    };
    window.__unmount();
    return res;
  })()`);
  assertEq(storeSwitch.emptyText, '尚未加入任何設備資料', '換客戶後清空原門市設備');
  assertTrue(storeSwitch.toasts.join('|').indexOf('已清空原門市的設備資料') !== -1,
    '提示已清空原門市設備', storeSwitch.toasts.join('|'));

  console.log('\n門市 → 新增立案單');
  const storeForm = await evaluate(`(function () {
    var wrap = document.createElement('div');
    wrap.id = 'probe';
    document.body.appendChild(wrap);
    wrap.appendChild(StoreProjectForm({
      store: { id: 'S1', customerName: '測試客戶', storeName: '測試門市',
        city: '台北市', district: '中山區', address: '一號', serviceLevel: 'A' },
      cases: [], setCases: function () {},
      equipments: [window.__eq('E1'), window.__eq('E2'), window.__eq('E3', { status: '已汰換' })],
      deviceCategories: [],
      setView: function () {}, showToast: function (m, t) { window.__toasts.push((t || 'info') + ':' + m); }
    }));
    var headers = window.__ths(window.__probe());
    window.__setSelect('workCategory', '汰換');
    window.__find('button', '加入設備').click();
    var modal = window.__probe().querySelector('.app-modal-overlay');
    var res = {
      headers: headers,
      pickerTitle: modal.querySelector('h3').textContent.trim(),
      checkboxes: modal.querySelectorAll('tbody input[type="checkbox"]').length
    };
    window.__unmount();
    return res;
  })()`);
  assertEq(storeForm.headers, ['操作'].concat(EQUIP_COLUMNS), '門市立案單設備表頭一致');
  assertEq(storeForm.pickerTitle, '選擇設備', '門市立案單：汰換 → 開選擇設備視窗');
  assertEq(storeForm.checkboxes, 2, '門市立案單：已汰換設備不可勾選');

  console.log('\n編輯工程案件');
  const editForm = await evaluate(`(function () {
    var wrap = document.createElement('div');
    wrap.id = 'probe';
    document.body.appendChild(wrap);
    wrap.appendChild(EditProjectForm({
      editingCase: {
        id: 'P1', projectNumber: '20260101001', creationDate: '2026-01-01',
        customerName: '測試客戶', storeName: '測試門市', workCategory: '撤店',
        currentStage: '立案時間', stageDate: '2026-01-01', isClosed: false,
        history: [{ stage: '立案時間', date: '2026-01-01', assignee: '' }], comments: [],
        details: { workCategory: '撤店', customerName: '測試客戶', storeName: '測試門市',
          storeAddress: '台北市中山區一號', serviceLevel: 'A', contactPerson: '',
          suggestedContractor: '', entryDate: '', remarks: '', equipment: [] }
      },
      cases: [], setCases: function () {},
      stores: [{ id: 'S1', customerName: '測試客戶', storeName: '測試門市',
        city: '台北市', district: '中山區', address: '一號', serviceLevel: 'A' }],
      customers: [{ id: 'C1', name: '測試客戶', serviceLevel: 'A 全包(有簽約客戶)', status: '啟用' }],
      accounts: [], equipments: [window.__eq('E1'), window.__eq('E2'), window.__eq('E3', { status: '已汰換' })],
      deviceCategories: [], repairCases: [],
      setView: function () {}, showToast: function (m, t) { window.__toasts.push((t || 'info') + ':' + m); }
    }));
    var headers = window.__ths(window.__probe());
    window.__find('button', '加入設備').click();
    var modal = window.__probe().querySelector('.app-modal-overlay');
    var pickerTitle = modal.querySelector('h3').textContent.trim();
    modal.querySelectorAll('tbody input[type="checkbox"]')[0].click();
    modal = window.__probe().querySelector('.app-modal-overlay');
    Array.prototype.find.call(modal.querySelectorAll('button'), function (b) {
      return b.textContent.indexOf('加入所選') !== -1;
    }).click();
    var rows = window.__probe().querySelectorAll('table tbody tr');
    var res = {
      headers: headers,
      pickerTitle: pickerTitle,
      rows: rows.length,
      actionBtns: rows[0].querySelectorAll('td:first-child button').length
    };
    window.__unmount();
    return res;
  })()`);
  assertEq(editForm.headers, ['操作'].concat(EQUIP_COLUMNS), '編輯工程案件設備表頭一致');
  assertEq(editForm.pickerTitle, '選擇設備', '編輯工程案件：撤店 → 開選擇設備視窗');
  assertEq(editForm.rows, 1, '加入 1 筆既有設備');
  assertEq(editForm.actionBtns, 1, '既有設備只有移除鈕');

  console.log('\n未結案立案單的設備操作鈕');
  const actions = await evaluate(`(function () {
    function mount(workCategory, mode) {
      var wrap = document.createElement('div');
      wrap.id = 'probe';
      document.body.appendChild(wrap);
      wrap.appendChild(EditProjectForm({
        editingCase: {
          id: 'P1', projectNumber: '20260101001', creationDate: '2026-01-01',
          customerName: '測試客戶', storeName: '測試門市', workCategory: workCategory,
          currentStage: '立案時間', stageDate: '2026-01-01', isClosed: mode === 'view',
          history: [{ stage: '立案時間', date: '2026-01-01', assignee: '' }], comments: [],
          details: { workCategory: workCategory, customerName: '測試客戶', storeName: '測試門市',
            storeAddress: '台北市中山區一號', serviceLevel: 'A', contactPerson: '',
            suggestedContractor: '', entryDate: '', remarks: '',
            equipment: [Object.assign(window.__eq('E1'), { id: 1 })] }
        },
        cases: [], setCases: function () {},
        stores: [{ id: 'S1', customerName: '測試客戶', storeName: '測試門市',
          city: '台北市', district: '中山區', address: '一號', serviceLevel: 'A' }],
        customers: [{ id: 'C1', name: '測試客戶', serviceLevel: 'A 全包(有簽約客戶)', status: '啟用' }],
        accounts: [], equipments: [], deviceCategories: [], repairCases: [],
        mode: mode,
        setView: function () {}, showToast: function () {}
      }));
      var row = window.__probe().querySelector('table tbody tr');
      var titles = Array.prototype.map.call(row.querySelectorAll('td:first-child button'), function (b) {
        return b.getAttribute('title') || b.getAttribute('aria-label') || b.textContent.trim();
      });
      window.__unmount();
      return titles;
    }
    return { add: mount('新開', 'edit'), retire: mount('汰換', 'edit'), view: mount('新開', 'view') };
  })()`);
  assertEq(actions.add, ['編輯設備', '移除此設備'], '新開：未結案可編輯可移除');
  assertEq(actions.retire, ['移除此設備'], '汰換：未結案只可移除');
  assertEq(actions.view, [], '唯讀檢視不提供編輯／移除');

  console.log('\n整體');
  assertEq(consoleErrors.length, 0, '操作過程無 JS 錯誤');
} catch (err) {
  fail('執行例外', err.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
