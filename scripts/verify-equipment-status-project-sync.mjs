#!/usr/bin/env node
/**
 * Executed UI verification: 設備欄位改版（驗收日期／安裝人員／設備狀態三選項）、
 * 工程立案單結案時的設備同步、案件處理設備選擇的已汰換／達年限規則。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9338);

if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

let passed = 0, failed = 0;
const pass = (n, d) => { passed++; console.log(`  ✓ ${n}${d ? ` — ${d}` : ''}`); };
const fail = (n, d) => { failed++; console.error(`  ✗ ${n}${d ? ` — ${d}` : ''}`); };

function assertEq(actual, expected, name) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass(name, a);
  else fail(name, `expected ${e}, got ${a}`);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-equip-status-profile',
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

const EQUIPMENT_TABLE_HEADERS = [
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
    window.__labels = function (node, sel) {
      return Array.prototype.map.call(node.querySelectorAll(sel), function (n) {
        return n.textContent.replace(/\\s+/g, ' ').trim();
      });
    };
    window.__mkEq = function (over) {
      return Object.assign({
        id: 'E1', customerName: '測試客戶', storeName: '測試門市',
        category: '空調', brand: '大金', deviceName: '室內機',
        specification: '2.2kW', model: 'FTXS', equipmentLevel: '一般設備',
        area: '廚房', acceptanceDate: '2020-02-01', installer: '王小明',
        assetNumber: 'A-001', serialNumber: 'SN-001', status: '運轉中',
        createdDate: todayDate
      }, over || {});
    };
  `);

  console.log('\n設備狀態選項');
  assertEq(await evaluate('EQUIP_STATUS_OPTIONS'), ['運轉中', '達年限', '已汰換'], '狀態三選項');
  assertEq(await evaluate("EquipmentUtils.normalizeStatus('運轉')"), '運轉中', '舊資料「運轉」正規化');
  assertEq(await evaluate("EquipmentUtils.normalizeStatus('轉汰換')"), '達年限', '舊資料「轉汰換」正規化');

  console.log('\n設備管理欄位');
  assertEq(
    await evaluate('EquipmentUtils.LIST_COLUMNS.map(function (c) { return c.label; })'),
    EQUIPMENT_TABLE_HEADERS,
    '列表欄位含驗收日期／安裝人員且無出廠／安裝日期'
  );
  // NOTE: src/core/searchable-select.js 會把 h('select', ...) 換成 combobox 元件，
  // 畫面上沒有原生 <select>，選項要展開下拉後從 portal menu 讀。
  const formFields = await evaluate(`(function () {
    var node = EquipmentForm({
      equipments: [], setEquipments: function () {},
      deviceCategories: [], accounts: [{ id: 'A1', name: '陳志豪', enabled: true }],
      equipmentCustomer: '測試客戶', equipmentStore: '測試門市',
      setView: function () {}, showToast: function () {}
    });
    document.body.appendChild(node);
    function optionsOf(name) {
      var el = node.querySelector('[name="' + name + '"]');
      if (!el) return null;
      var toggle = el.parentNode.querySelector('.searchable-select__toggle');
      if (toggle) toggle.click();
      var opts = Array.prototype.map.call(
        document.querySelectorAll('.searchable-select__option'),
        function (o) { return o.textContent.trim(); });
      if (toggle) toggle.click();
      return opts;
    }
    var result = {
      labels: window.__labels(node, 'label'),
      hasAcceptanceDate: !!node.querySelector('input[name="acceptanceDate"][type="date"]'),
      statusOptions: optionsOf('status'),
      installerOptions: optionsOf('installer')
    };
    node.remove();
    return result;
  })()`);
  assertTrue(formFields.hasAcceptanceDate, '表單有「驗收日期」日期欄位');
  assertTrue(formFields.labels.indexOf('安裝人員') !== -1, '表單有「安裝人員」欄位', formFields.labels.join(' | '));
  assertTrue(
    formFields.labels.every(function (l) { return l.indexOf('出廠日期') === -1 && l.indexOf('安裝日期') === -1; }),
    '表單已移除出廠／安裝日期', formFields.labels.join(' | ')
  );
  assertEq(formFields.statusOptions, ['運轉中', '達年限', '已汰換'], '狀態下拉為三選項');
  // 空值的「請選擇」在 searchable-select 是 placeholder，不會列在選項裡
  assertEq(formFields.installerOptions, ['陳志豪'], '安裝人員選項取自帳號管理');

  console.log('\n工程立案單結案 — 新開／整裝／加裝新增設備');
  const added = await evaluate(`(function () {
    var project = {
      id: 'P1', customerName: '測試客戶', storeName: '測試門市', workCategory: '新開',
      history: [{ stage: '客戶驗收', date: '2026-08-01' }],
      details: {
        suggestedContractor: '協成工程行',
        equipment: [{ id: 1, category: '空調', brand: '大金', deviceName: '室內機',
          specification: '2.2kW', model: 'NEW-1', area: '賣場區', assetNumber: 'N-001' }]
      }
    };
    var out = EquipmentUtils.applyProjectCloseToEquipments(project, []);
    return { added: out.added, retired: out.retired, eq: out.equipments[0] };
  })()`);
  assertEq(added.added, 1, '新增 1 筆設備到該門市');
  assertEq(added.eq.storeName, '測試門市', '設備掛在立案單門市下');
  assertEq(added.eq.installer, '協成工程行', '安裝人員自動帶入施作單位');
  assertEq(added.eq.acceptanceDate, '2026-08-01', '驗收日期自動帶入客戶驗收日期');
  assertEq(added.eq.status, '運轉中', '新增設備狀態為運轉中');

  console.log('\n工程立案單結案 — 汰換／撤店改為已汰換');
  const retired = await evaluate(`(function () {
    var project = {
      id: 'P2', customerName: '測試客戶', storeName: '測試門市', workCategory: '汰換',
      history: [{ stage: '客戶驗收', date: '2026-08-02' }],
      details: {
        suggestedContractor: '協成工程行',
        equipment: [{ id: 'E1', category: '空調', model: 'FTXS', assetNumber: 'A-001' }]
      }
    };
    var out = EquipmentUtils.applyProjectCloseToEquipments(project, [
      window.__mkEq(), window.__mkEq({ id: 'E2', model: 'OTHER', assetNumber: 'A-002' })
    ]);
    return {
      retired: out.retired,
      statuses: out.equipments.map(function (e) { return e.id + ':' + e.status; })
    };
  })()`);
  assertEq(retired.retired, 1, '汰換 1 筆設備');
  assertEq(retired.statuses, ['E1:已汰換', 'E2:運轉中'], '只有立案單上的設備被改為已汰換');

  const notSynced = await evaluate(`(function () {
    var project = {
      id: 'P3', customerName: '測試客戶', storeName: '測試門市', workCategory: '整裝',
      history: [], details: { equipment: [] }
    };
    var out = EquipmentUtils.applyProjectCloseToEquipments(project, [window.__mkEq()]);
    return { added: out.added, retired: out.retired };
  })()`);
  assertEq(notSynced, { added: 0, retired: 0 }, '立案單無設備時不同步');

  console.log('\n工程立案列表 — 按下「確認結案」會同步設備');
  const e2e = await evaluate(`(function () {
    var project = {
      id: 'P9', projectNumber: 'PJ-9', creationDate: todayDate,
      customerName: '測試客戶', storeName: '測試門市', workCategory: '加裝',
      isClosed: false, currentStage: '客戶驗收',
      history: [{ stage: '客戶驗收', date: '2026-08-05' }],
      comments: [],
      details: {
        suggestedContractor: '協成工程行',
        equipment: [{ id: 91, category: '空調', brand: '大金', deviceName: '室內機',
          specification: '2.2kW', model: 'ADD-1', area: '賣場區' }]
      }
    };
    var equipments = [];
    var node = ProjectList({
      cases: [project], setCases: function () {},
      customers: [{ id: 'C1', customerName: '測試客戶' }],
      equipments: equipments, setEquipments: function (next) { equipments = next; },
      setEditingCase: function () {}, setView: function () {}, showToast: function () {}
    });
    document.body.appendChild(node);
    function clickByText(text) {
      var btn = Array.prototype.filter.call(document.querySelectorAll('button'), function (b) {
        return b.textContent.replace(/\\s+/g, ' ').trim() === text;
      })[0];
      if (btn) btn.click();
      return !!btn;
    }
    var closeBtn = node.querySelector('button[aria-label="編輯結案狀態"]');
    var opened = !!closeBtn;
    if (closeBtn) closeBtn.click();
    var confirmed = clickByText('確認結案');
    var result = { opened: opened, confirmed: confirmed, equipments: equipments };
    node.remove();
    return result;
  })()`);
  assertTrue(e2e.opened && e2e.confirmed, '可從列表開啟結案確認並按下確認結案',
    JSON.stringify({ opened: e2e.opened, confirmed: e2e.confirmed }));
  assertEq(e2e.equipments.length, 1, '結案後門市多了 1 筆設備');
  assertEq(
    e2e.equipments[0] && [e2e.equipments[0].model, e2e.equipments[0].installer,
      e2e.equipments[0].acceptanceDate, e2e.equipments[0].status],
    ['ADD-1', '協成工程行', '2026-08-05', '運轉中'],
    '結案新增的設備帶入型號／施作單位／客戶驗收日期／運轉中'
  );

  console.log('\n案件處理 — 選擇設備規則');
  const picker = await evaluate(`(function () {
    var node = RepairCaseEquipment.PickerModal({
      h: IESS.h,
      items: [
        window.__mkEq({ id: 'E1', status: '運轉中', createdDate: '2026-08-03' }),
        window.__mkEq({ id: 'E2', status: '達年限', createdDate: '2026-08-02' }),
        window.__mkEq({ id: 'E3', status: '已汰換', createdDate: '2026-08-01' })
      ],
      onSelect: function () {}, onClose: function () {}
    });
    var rows = Array.prototype.map.call(node.querySelectorAll('tbody tr'), function (tr) {
      var firstCell = tr.querySelector('td');
      return {
        cls: tr.className,
        action: firstCell.textContent.trim(),
        hasButton: !!firstCell.querySelector('button')
      };
    });
    return rows;
  })()`);
  assertEq(picker.length, 3, '三筆設備都列出');
  assertTrue(picker[0].hasButton && picker[0].action === '選擇', '運轉中可選擇', picker[0].action);
  assertTrue(picker[1].hasButton && picker[1].cls.indexOf('text-red-600') === -1,
    '達年限可選擇且整列不上色（僅狀態標籤為紅色）', picker[1].cls);
  assertTrue(!picker[2].hasButton && picker[2].action === '已汰換',
    '已汰換無法被加入（無選擇按鈕）', picker[2].action);

  const scan = await evaluate(`(function () {
    var eqs = [
      window.__mkEq({ id: 'E1', status: '已汰換' }),
      window.__mkEq({ id: 'E2', status: '運轉中' })
    ];
    var picked = RepairCaseEquipment.findEquipmentForScan(eqs, {
      customerName: '測試客戶', storeName: '測試門市'
    });
    return picked ? picked.id : null;
  })()`);
  assertEq(scan, 'E2', '掃描 QR Code 跳過已汰換設備');

  const tone = await evaluate(`(function () {
    var fields = RepairCaseEquipment.getDisplayFields(window.__mkEq({ status: '達年限' }), {});
    var status = fields.filter(function (f) { return f.label === '設備狀態'; })[0];
    return { value: status.value, tone: status.tone || '' };
  })()`);
  assertEq(tone, { value: '達年限', tone: 'danger' }, '設備資料面板的達年限標為紅字');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
