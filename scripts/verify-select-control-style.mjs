#!/usr/bin/env node
/**
 * 編輯叫修案件：單選下拉（使用車輛等）的關閉態外框要對齊「組別」MultiSelect，
 * 展開後的選項內容仍維持原本 searchable-select 樣式（無 checkbox）。
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
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-select-style-profile',
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
  const result = await evaluate(`(function () {
    function box(el) {
      if (!el) return null;
      var s = getComputedStyle(el);
      return {
        minHeight: s.minHeight,
        paddingTop: s.paddingTop,
        paddingRight: s.paddingRight,
        paddingBottom: s.paddingBottom,
        paddingLeft: s.paddingLeft,
        borderTopWidth: s.borderTopWidth,
        borderRightWidth: s.borderRightWidth,
        borderBottomWidth: s.borderBottomWidth,
        borderLeftWidth: s.borderLeftWidth,
        borderTopLeftRadius: s.borderTopLeftRadius,
        borderTopColor: s.borderTopColor,
        backgroundColor: s.backgroundColor
      };
    }
    var wrap = document.createElement('div');
    document.body.appendChild(wrap);
    wrap.appendChild(EditCaseForm({
      editingCase: {
        id: 'C1', caseNumber: '20260814001', customerName: '測試客戶', storeName: '測試門市',
        companyCity: '台北市', companyDistrict: '中山區', workCategory: '一般叫修',
        repairItem: '室內機', repairReason: '不冷', faultDesc: '出風不冷',
        actualReason: '', assignees: [], isClosed: false, processStatus: null,
        createdAt: '${todayDate} 09:00:00', repairDate: '${todayDate} 09:00:00',
        expectedDate: '${todayDate}', expectedTimeStart: '09:00', expectedTimeEnd: '11:00',
        processRecords: [], equipment: { id: 'E1' }, vehicleId: ''
      },
      cases: [], setCases: function () {}, stores: [], customers: [],
      equipments: [], vehicles: [{ id: 'V1', plateNo: 'ABC-123' }],
      vendors: [{ id: 'VN1', name: '協力A', type: '協力商' }],
      deviceCategories: [], processMethods: [],
      setView: function () {}, showToast: function () {}
    }));
    function fieldHost(label) {
      var spans = wrap.querySelectorAll('span, label');
      for (var i = 0; i < spans.length; i++) {
        if (spans[i].textContent.trim() !== label) continue;
        return spans[i].parentNode;
      }
      return null;
    }
    function fieldControl(label) {
      var host = fieldHost(label);
      if (!host) return null;
      return host.querySelector('.multi-select__control')
        || host.querySelector('.searchable-select');
    }
    var group = fieldControl('組別');
    var partner = fieldControl('協力廠商');
    var vehicle = fieldControl('使用車輛');
    var processBox = fieldControl('處理狀態');
    var boxes = {
      group: box(group),
      partner: box(partner),
      vehicle: box(vehicle),
      process: box(processBox)
    };
    var dateInput = wrap.querySelector('input[name="expectedDate"]');
    var timeHost = fieldHost('預計時間');
    var timeBox = timeHost && timeHost.querySelector('.searchable-select');
    var heights = {
      date: dateInput ? dateInput.offsetHeight : null,
      time: timeBox ? timeBox.offsetHeight : null,
      timeCompact: !!(timeBox && timeBox.classList.contains('searchable-select--compact')),
      timePaddingTop: timeBox ? getComputedStyle(timeBox).paddingTop : null
    };
    var vehicleInput = wrap.querySelector('[name="vehicleId"]');
    var vehicleToggle = vehicle && vehicle.querySelector('.searchable-select__toggle');
    if (vehicleToggle) vehicleToggle.click();
    else if (vehicleInput) vehicleInput.click();
    var vehicleMenu = document.querySelector('.searchable-select__menu');
    var vehicleHasCheckbox = !!(vehicleMenu && vehicleMenu.querySelector('.multi-select__checkbox'));
    var vehicleOptionClass = vehicleMenu && vehicleMenu.querySelector('[class*="option"]')
      ? vehicleMenu.querySelector('[class*="option"]').className
      : '';
    wrap.remove();
    if (vehicleMenu && vehicleMenu.parentNode) vehicleMenu.parentNode.removeChild(vehicleMenu);
    return Object.assign(boxes, {
      vehicleHasCheckbox: vehicleHasCheckbox,
      vehicleOptionClass: vehicleOptionClass,
      heights: heights
    });
  })()`);

  console.log('\n關閉態外框對齊組別');
  assertTrue(!!result.group, '找得到組別控制項');
  assertEq(result.vehicle, result.group, '使用車輛外框對齊組別');
  assertEq(result.partner, result.group, '協力廠商外框對齊組別');
  assertEq(result.process, result.group, '處理狀態外框對齊組別');

  console.log('\n預計時間維持緊湊高度');
  assertEq(result.heights && result.heights.time, 42, '時／分下拉高度維持 42px');
  assertEq(result.heights && result.heights.timePaddingTop, '0px', '時／分下拉不套用組別內距');
  assertEq(result.heights && result.heights.timeCompact, true, '時／分下拉使用緊湊樣式');

  console.log('\n展開內容維持單選樣式');
  assertEq(result.vehicleHasCheckbox, false, '使用車輛選單沒有複選 checkbox');
  assertTrue(
    result.vehicleOptionClass.indexOf('searchable-select__option') !== -1,
    '使用車輛選項仍用 searchable-select 樣式',
    result.vehicleOptionClass
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
