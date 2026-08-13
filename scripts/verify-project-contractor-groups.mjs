#!/usr/bin/env node
/**
 * Executed UI verification for:
 * 工程立案「建議施作單位」→「施作單位」，選項取自組別管理（ASSIGNEES），且不可新增。
 * 涵蓋：新增立案單、編輯／檢視立案單、門市端新增立案單。
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
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass(name, JSON.stringify(actual));
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-contractor-check-profile',
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

  const groups = await evaluate('ASSIGNEES.slice()');
  assertTrue(groups.length > 0, '組別管理有組別可用', JSON.stringify(groups));

  await evaluate(`
    // 原生 <select> 會被 searchable-select 攔截成 input[role=combobox]，
    // 選項要展開選單後才會掛到 document 上。
    window.__probe = function (node) {
      document.body.appendChild(node);
      var sel = node.querySelector('[name="suggestedContractor"], [name="details.suggestedContractor"]');
      var label = null;
      var labels = Array.prototype.slice.call(node.querySelectorAll('label'));
      for (var i = 0; i < labels.length; i++) {
        if (labels[i].textContent.trim().indexOf('施作單位') !== -1) { label = labels[i].textContent.trim(); break; }
      }
      var options = null;
      if (sel) {
        var toggle = sel.parentNode.querySelector('.searchable-select__toggle');
        toggle.click();
        options = Array.prototype.slice.call(document.querySelectorAll('.searchable-select__option'))
          .map(function (o) { return o.textContent.trim(); })
          .filter(function (t) { return t !== '請選擇單位'; });
        toggle.click();
      }
      var result = {
        label: label,
        hasOldLabel: node.textContent.indexOf('建議施作單位') !== -1,
        hasSelect: !!sel,
        options: options,
        hasAddButton: !!node.querySelector('[aria-label="新增單位選項"], [title="新增單位選項"]'),
        hasAddText: node.textContent.indexOf('新增施作單位') !== -1
      };
      node.remove();
      return result;
    };
    'ok'`);

  console.log('\n新增立案單');
  const add = await evaluate(`window.__probe(AddProjectForm({
    cases: [], setCases: function () {}, stores: [], customers: [], accounts: [],
    deviceCategories: [], setView: function () {}, showToast: function () {}
  }))`);
  assertEq(add.label, '施作單位', '欄位標題為「施作單位」');
  assertEq(add.hasOldLabel, false, '不再出現「建議施作單位」');
  assertTrue(add.hasSelect, '有施作單位下拉選單');
  assertEq(add.options, groups, '選項等同組別管理清單');
  assertEq(add.hasAddButton, false, '沒有新增單位按鈕');
  assertEq(add.hasAddText, false, '沒有新增施作單位彈窗');

  console.log('\n編輯立案單（既有值不在組別清單時仍保留）');
  const edit = await evaluate(`window.__probe(EditProjectForm({
    editingCase: {
      id: 'P1', projectNumber: '20260813001', creationDate: '2026-08-13',
      customerName: '測試客戶', storeName: '測試門市', workCategory: '新增設備',
      currentStage: '立案時間', stageDate: '2026-08-13', history: [], comments: [],
      details: { suggestedContractor: '舊廠商X', contactPerson: '', equipment: [] }
    },
    cases: [], setCases: function () {}, stores: [], customers: [], accounts: [],
    deviceCategories: [], repairCases: [], setView: function () {}, showToast: function () {}
  }))`);
  assertEq(edit.label, '施作單位', '編輯頁欄位標題為「施作單位」');
  assertEq(edit.hasOldLabel, false, '編輯頁不再出現「建議施作單位」');
  assertEq(edit.options, groups.concat(['舊廠商X']), '選項為組別清單加上既有舊值');
  assertEq(edit.hasAddButton, false, '編輯頁沒有新增單位按鈕');
  assertEq(edit.hasAddText, false, '編輯頁沒有新增施作單位彈窗');

  console.log('\n門市端新增立案單');
  const store = await evaluate(`window.__probe(StoreProjectForm({
    store: { customerName: '測試客戶', storeName: '測試門市', serviceLevel: 'A' },
    cases: [], setCases: function () {}, deviceCategories: [],
    setView: function () {}, showToast: function () {}
  }))`);
  assertEq(store.label, '施作單位', '門市端欄位標題為「施作單位」');
  assertEq(store.hasOldLabel, false, '門市端不再出現「建議施作單位」');
  assertEq(store.options, groups, '門市端選項等同組別管理清單');
  assertEq(store.hasAddButton, false, '門市端沒有新增單位按鈕');
  assertEq(store.hasAddText, false, '門市端沒有新增施作單位彈窗');

  console.log('\n組別更名時同步施作單位');
  const renamed = await evaluate(`(function () {
    var result = AssigneeUtils.updateAssigneeReferences('A組', 'A1組', [], [], [
      { id: 'P1', details: { suggestedContractor: 'A組', contactPerson: 'A組' } }
    ]);
    return result.projectCases[0].details;
  })()`);
  assertEq(renamed.suggestedContractor, 'A1組', '施作單位跟著組別更名');
  assertEq(renamed.contactPerson, 'A1組', '負責人員仍正常更名');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
