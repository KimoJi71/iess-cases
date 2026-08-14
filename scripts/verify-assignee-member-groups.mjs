#!/usr/bin/env node
/**
 * 組別 + 指派人員：UI 驗證。
 *
 * 涵蓋本次改動：
 *   1. 叫修單（新增／編輯／門市叫修）組別後方新增「指派人員」欄位
 *   2. 保養計劃「保養人員」單選 → 「組別」多選，並新增「指派人員」
 *   3. 指派人員只列已選組別的成員，並依組別分 group
 *   4. 取消某個組別時，該組成員自動從指派人員移除
 *
 * 啟動 headless Chrome 載入 index.html，直接掛載元件後斷言 DOM。
 * CDP 連線流程參考 scripts/verify-multi-select-groups-ui.mjs。
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
  if (actual === expected) pass(name, JSON.stringify(actual));
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertJson(actual, expected, name) {
  assertEq(JSON.stringify(actual), JSON.stringify(expected), name);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-assignee-member-profile',
  'about:blank'
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const consoleErrors = [];
const EVAL_TIMEOUT_MS = Number(process.env.EVAL_TIMEOUT_MS || 8000);

function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}

async function evaluate(expression, timeoutMs = EVAL_TIMEOUT_MS) {
  const call = send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true
  });
  const r = await Promise.race([
    call,
    sleep(timeoutMs).then(() => {
      throw new Error(`逾時 ${timeoutMs}ms 無回應 — 運算式開頭：${expression.slice(0, 120)}`);
    })
  ]);
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
  }
  return r.result.value;
}

// 與 verify-multi-select-groups-ui.mjs 同樣的理由：跨 setTimeout tick 的 Promise
// 只靠 Runtime.evaluate 回傳值持有時可能被 GC，先釘在 global 再分兩趟 await。
async function evaluateAsync(expression) {
  await evaluate(`window.__pending = (${expression}); 'queued'`);
  return evaluate('window.__pending');
}

// 測試用的組別／帳號主檔：
//   A組、B組 各兩位啟用中成員；C組 只有一位停用帳號；D組 沒有設定成員。
//   後兩者用來驗證「組別沒有可指派成員時仍看得到組別標題與說明」。
const FIXTURE = `
  window.__accounts = [
    { id: 'ACC_A1', name: '甲一', enabled: true },
    { id: 'ACC_A2', name: '甲二', enabled: true },
    { id: 'ACC_B1', name: '乙一', enabled: true },
    { id: 'ACC_B2', name: '乙二', enabled: true },
    { id: 'ACC_X', name: '無組員', enabled: true },
    { id: 'ACC_C1', name: '丙一', enabled: false }
  ];
  window.__assignees = [
    { id: 'ASG_A', name: 'A組', memberIds: ['ACC_A1', 'ACC_A2'], districts: [] },
    { id: 'ASG_B', name: 'B組', memberIds: ['ACC_B1', 'ACC_B2'], districts: [] },
    { id: 'ASG_C', name: 'C組', memberIds: ['ACC_C1'], districts: [] },
    { id: 'ASG_D', name: 'D組', memberIds: [], districts: [] }
  ];
  AssigneeUtils.syncAssigneeOptions(window.__assignees);
  AssigneeUtils.syncAssigneeMemberGroups(window.__assignees, window.__accounts);

  window.__renderMembers = function (formData) {
    var host = document.getElementById('member-host');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'member-host';
    document.body.appendChild(host);
    host.appendChild(CaseAssigneeFields.renderMemberMultiSelect(formData, function (next) {
      window.__form.assigneeMemberIds = next;
      window.__renderMembers(window.__form);
    }, { id: 'member-test' }));
    return host;
  };
  window.__mountMembers = function (formData) {
    IESS.MultiSelect.closeAll();
    window.__form = formData;
    return window.__renderMembers(formData);
  };
  window.__openMenu = function () {
    document.querySelector('#member-host .multi-select__control').click();
  };
  window.__mountGroups = function (formData) {
    IESS.MultiSelect.closeAll();
    var host = document.getElementById('group-host');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'group-host';
    document.body.appendChild(host);
    window.__groupForm = formData || { assignees: [] };
    host.appendChild(CaseAssigneeFields.renderAssigneeMultiSelect(window.__groupForm, function (next) {
      window.__groupForm = { assignees: next };
      window.__mountGroups(window.__groupForm);
    }, { id: 'group-test' }));
    return host;
  };
  window.__openGroupMenu = function () {
    document.querySelector('#group-host .multi-select__control').click();
  };
  window.__readGroupMenu = function () {
    var menuEl = document.querySelector('.multi-select__menu');
    var host = document.getElementById('group-host');
    return {
      labels: menuEl
        ? Array.prototype.map.call(menuEl.querySelectorAll('.multi-select__option-label'),
          function (o) { return o.textContent.trim(); })
        : [],
      hints: menuEl
        ? Array.prototype.map.call(menuEl.querySelectorAll('.multi-select__option'),
          function (o) {
            var hint = o.querySelector('.multi-select__option-hint');
            return hint ? hint.textContent.trim() : '';
          })
        : [],
      chips: Array.prototype.map.call((host || document).querySelectorAll('#group-host .multi-select__chip'),
        function (c) { return c.textContent.replace('×', '').trim(); })
    };
  };
  window.__readMenu = function () {
    var menuEl = document.querySelector('.multi-select__menu');
    return {
      groups: Array.prototype.map.call(menuEl.querySelectorAll('.multi-select__group'),
        function (g) { return g.textContent.trim(); }),
      options: Array.prototype.map.call(menuEl.querySelectorAll('.multi-select__option'),
        function (o) { return o.textContent.trim(); }),
      empties: Array.prototype.map.call(menuEl.querySelectorAll('.multi-select__empty'),
        function (e) { return e.textContent.trim(); })
    };
  };
`;

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

  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');
  await evaluate(FIXTURE + "'ok'");

  console.log('\nSection 0｜組別選單以 hint 顯示成員名單');
  const groupMenu = await evaluateAsync(`(function () {
    window.__mountGroups({ assignees: [] });
    window.__openGroupMenu();
    return new Promise(function (resolve) {
      setTimeout(function () { resolve(window.__readGroupMenu()); }, 50);
    });
  })()`);
  assertJson(groupMenu.labels, ['A組', 'B組', 'C組', 'D組'], '選項主標是組別名稱');
  assertJson(groupMenu.hints, ['甲一、甲二', '乙一、乙二', '丙一', ''],
    'hint 為成員名單（含停用；無成員則空白）');

  const groupChip = await evaluateAsync(`(function () {
    window.__mountGroups({ assignees: [] });
    window.__openGroupMenu();
    return new Promise(function (resolve) {
      setTimeout(function () {
        document.querySelector('.multi-select__menu .multi-select__option').click();
        setTimeout(function () { resolve(window.__readGroupMenu()); }, 50);
      }, 50);
    });
  })()`);
  assertJson(groupChip.chips, ['A組'], '已選 chip 只顯示組別名稱，不含成員名單');

  console.log('\nSection 1｜指派人員選單依組別分群，且只列已選組別的成員');
  const noGroup = await evaluate(`(function () {
    var host = window.__mountMembers({ assignees: [], assigneeMemberIds: [] });
    var control = host.querySelector('.multi-select__control');
    return {
      disabled: control.classList.contains('multi-select__control--disabled'),
      text: control.textContent.trim()
    };
  })()`);
  assertTrue(noGroup.disabled, '未選組別時指派人員欄位停用', noGroup.text);
  assertTrue(noGroup.text.indexOf('請先選擇組別') !== -1, '未選組別時提示「請先選擇組別」', noGroup.text);

  const oneGroup = await evaluateAsync(`(function () {
    window.__mountMembers({ assignees: ['A組'], assigneeMemberIds: [] });
    window.__openMenu();
    return new Promise(function (resolve) {
      setTimeout(function () { resolve(window.__readMenu()); }, 50);
    });
  })()`);
  assertJson(oneGroup.groups, ['A組'], '只選 A組時，選單只有 A組這個群組');
  assertJson(oneGroup.options, ['甲一', '甲二'], '只列出 A組的成員');

  const twoGroups = await evaluateAsync(`(function () {
    window.__mountMembers({ assignees: ['A組', 'B組'], assigneeMemberIds: [] });
    window.__openMenu();
    return new Promise(function (resolve) {
      setTimeout(function () { resolve(window.__readMenu()); }, 50);
    });
  })()`);
  assertJson(twoGroups.groups, ['A組', 'B組'], '選兩組時，選單出現兩個群組標題');
  assertJson(twoGroups.options, ['甲一', '甲二', '乙一', '乙二'], '兩組成員各自列在自己的群組下');

  const emptyGroups = await evaluateAsync(`(function () {
    window.__mountMembers({ assignees: ['B組', 'C組', 'D組'], assigneeMemberIds: [] });
    window.__openMenu();
    return new Promise(function (resolve) {
      setTimeout(function () { resolve(window.__readMenu()); }, 50);
    });
  })()`);
  assertJson(emptyGroups.groups, ['B組', 'C組', 'D組'],
    '沒有可指派成員的組別，仍會畫出組別標題（C組成員已停用、D組未設成員）');
  assertJson(emptyGroups.options, ['乙一', '乙二'], '停用帳號不列入可選成員');
  assertJson(emptyGroups.empties, ['此組別無可指派成員', '此組別無可指派成員'],
    '空組別底下標註「此組別無可指派成員」');

  console.log('\nSection 2｜勾選成員後，取消組別會連帶移除該組成員');
  const picked = await evaluateAsync(`(function () {
    window.__mountMembers({ assignees: ['A組', 'B組'], assigneeMemberIds: [] });
    window.__openMenu();
    return new Promise(function (resolve) {
      setTimeout(function () {
        var opts = document.querySelectorAll('.multi-select__menu .multi-select__option');
        opts[0].click();   // 甲一（A組）
        setTimeout(function () {
          var opts2 = document.querySelectorAll('.multi-select__menu .multi-select__option');
          opts2[2].click(); // 乙一（B組）
          setTimeout(function () { resolve(window.__form.assigneeMemberIds); }, 50);
        }, 50);
      }, 50);
    });
  })()`);
  assertJson(picked, ['ACC_A1', 'ACC_B1'], '可跨組別勾選多位指派人員');

  const afterDrop = await evaluate(
    `CaseAssigneeFields.syncMemberIds(['A組'], ['ACC_A1', 'ACC_B1'])`
  );
  assertJson(afterDrop, ['ACC_A1'], '取消 B組後，B組成員自動從指派人員移除');

  const afterDropAll = await evaluate(
    `CaseAssigneeFields.syncMemberIds([], ['ACC_A1', 'ACC_B1'])`
  );
  assertJson(afterDropAll, [], '組別全部取消時，指派人員一併清空');

  console.log('\nSection 3｜叫修單表單有「組別」與「指派人員」兩個欄位');
  const addFormLabels = await evaluate(`(function () {
    var node = AddCaseForm({
      cases: [], setCases: function () {}, stores: [], customers: [],
      setView: function () {}, showToast: function () {}, currentOperatorName: '測試員'
    });
    document.body.appendChild(node);
    var labels = Array.prototype.map.call(node.querySelectorAll('label'),
      function (l) { return l.textContent.trim(); });
    node.remove();
    return labels;
  })()`);
  assertTrue(addFormLabels.indexOf('組別') !== -1, '新增叫修單有「組別」欄位');
  assertTrue(addFormLabels.indexOf('指派人員') !== -1, '新增叫修單有「指派人員」欄位');
  assertEq(addFormLabels.indexOf('指派人員'), addFormLabels.indexOf('組別') + 1,
    '「指派人員」緊接在「組別」之後');

  console.log('\nSection 4｜保養計劃：保養人員 → 組別（多選）＋ 指派人員');
  const maintenanceForm = await evaluate(`(function () {
    var node = MaintenanceViewEditForm({
      targetCase: {
        id: 'M1', caseNumber: '', customerName: '測試客戶', storeName: '測試門市',
        serviceLevel: 'A', status: '未保養', planDate: '', workCategory: '保養',
        assignee: 'A組', isClosed: false
      },
      cases: [], setCases: function () {}, stores: [], setStores: function () {},
      customers: [], setView: function () {}, mode: 'edit', showToast: function () {}
    });
    document.body.appendChild(node);
    var labels = Array.prototype.map.call(node.querySelectorAll('span'),
      function (l) { return l.textContent.trim(); });
    var result = {
      labels: labels,
      hasMaintainerLabel: labels.indexOf('保養人員') !== -1,
      hasGroupLabel: labels.indexOf('組別') !== -1,
      hasMemberLabel: labels.indexOf('指派人員') !== -1,
      multiSelects: node.querySelectorAll('.multi-select__control').length,
      // 逐欄確認「組別」「指派人員」用的是複選元件，而非原本的單選下拉
      fieldControls: ['組別', '指派人員'].map(function (name) {
        var label = Array.prototype.find.call(node.querySelectorAll('span'), function (sp) {
          return sp.textContent.trim() === name;
        });
        var field = label && label.parentNode;
        if (!field) return name + ':無此欄位';
        if (field.querySelector('.multi-select')) return name + ':multi-select';
        if (field.querySelector('.searchable-select')) return name + ':single-select';
        return name + ':其他';
      }),
      chips: Array.prototype.map.call(node.querySelectorAll('.multi-select__chip'),
        function (c) { return c.textContent.replace('×', '').trim(); })
    };
    node.remove();
    return result;
  })()`);
  assertTrue(!maintenanceForm.hasMaintainerLabel, '保養計劃不再有「保養人員」欄位');
  assertTrue(maintenanceForm.hasGroupLabel, '保養計劃有「組別」欄位');
  assertTrue(maintenanceForm.hasMemberLabel, '保養計劃有「指派人員」欄位');
  assertEq(maintenanceForm.multiSelects, 2, '組別與指派人員都是複選元件');
  assertJson(maintenanceForm.fieldControls, ['組別:multi-select', '指派人員:multi-select'],
    '「組別」與「指派人員」欄位都改用複選元件（不再是單選下拉）');
  assertJson(maintenanceForm.chips, ['A組'], '舊的單值 assignee 會轉成組別多選的已選值');

  console.log('\nSection 5｜保養列表表頭');
  const maintenanceHeaders = await evaluate(`(function () {
    var node = MaintenanceList({
      cases: [], setCases: function () {}, stores: [], setStores: function () {},
      customers: [], setViewingCase: function () {}, setEditingCase: function () {},
      setView: function () {}, showToast: function () {}
    });
    document.body.appendChild(node);
    var hs = Array.prototype.map.call(node.querySelectorAll('thead th'),
      function (th) { return th.textContent.trim(); });
    node.remove();
    return hs;
  })()`);
  assertTrue(maintenanceHeaders.indexOf('保養人員') === -1, '保養列表不再有「保養人員」欄');
  assertEq(maintenanceHeaders.indexOf('指派人員'), maintenanceHeaders.indexOf('組別') + 1,
    '保養列表「指派人員」緊接在「組別」之後');

  console.log('');
  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (err) {
  fail('腳本執行', err.message);
} finally {
  try { ws?.close(); } catch { /* noop */ }
  chrome.kill();
}

console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed ? 1 : 0);
