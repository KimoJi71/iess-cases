#!/usr/bin/env node
/**
 * 派工明細、seed 多設備樣本：排程逐設備列出實際維修原因，且各卡片可獨立編輯。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9364);

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
function assertTrue(cond, name, detail) { if (cond) pass(name, detail); else fail(name, detail); }

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-multi-equip-arr-profile',
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

  console.log('\nseed 有多設備案例');
  const seedCheck = await evaluate(`(function () {
    var multi = (INITIAL_CASES || []).filter(function (c) {
      return RepairCaseServiceItems.getItems(c).length >= 2;
    });
    return {
      count: multi.length,
      itemCount: multi.length ? RepairCaseServiceItems.getItems(multi[0]).length : 0,
      allMigrated: (INITIAL_CASES || []).every(function (c) {
        return !('equipment' in c) && !('processRecords' in c) && !('actualReason' in c);
      })
    };
  })()`);
  assertTrue(seedCheck.count >= 1, 'seed 至少有一筆多設備案件', String(seedCheck.count));
  assertTrue(seedCheck.itemCount >= 2, '該案件至少兩張卡片', String(seedCheck.itemCount));
  assertEq(seedCheck.allMigrated, true, 'seed 全部案件已遷移，無殘留舊欄位');

  console.log('\n派工明細（RepairCaseDetailSections 的設備段）逐設備列出');
  const arrangement = await evaluate(`(function () {
    // 深拷貝一份，避免共用模組的直接寫回污染 seed
    var c = JSON.parse(JSON.stringify((INITIAL_CASES || []).filter(function (x) {
      return RepairCaseServiceItems.getItems(x).length >= 2;
    })[0]));
    var items = RepairCaseServiceItems.getItems(c);
    var ui = RepairCaseDetailSections.createUiState();
    // 一次只顯示一張卡片，目前是第幾張由呼叫端以 ui.activeItemIndex 帶入
    function render(activeIndex) {
      ui.activeItemIndex = activeIndex;
      var host = document.createElement('div');
      RepairCaseDetailSections.renderSections({
        formData: c,
        ui: ui,
        data: {
          equipments: [], deviceCategories: [],
          processMethods: (typeof INITIAL_PROCESS_METHODS !== 'undefined' ? INITIAL_PROCESS_METHODS : []),
          vehicles: [], vendors: [], stores: []
        },
        rerender: function () {},
        showToast: function () {},
        include: ['equipment'],
        idPrefix: 'test'
      }).forEach(function (n) { host.appendChild(n); });
      return host;
    }
    // 每張卡片有「實際維修原因」與「備註」兩個 textarea，這裡只驗前者
    function reasonBoxes(node) {
      return node.querySelectorAll('textarea[name="serviceItemActualReason"]');
    }
    var text = '';
    // textarea 的值走 .value，不會出現在 textContent，故另外蒐集（見 assertion-honesty）；
    // 要在觸發 input 事件、覆寫第二張卡片的值之前先讀出來，否則驗證的就不是原始渲染結果
    var textareaValues = [];
    var perCardCounts = [];
    for (var i = 0; i < items.length; i++) {
      var node = render(i);
      document.body.appendChild(node);
      text += ' ' + node.textContent.replace(/\\s+/g, ' ');
      perCardCounts.push(reasonBoxes(node).length);
      textareaValues.push(reasonBoxes(node)[0].value);
      node.remove();
    }
    // 觸發第二張卡片的「實際維修原因」textarea input，驗證寫回的是第二筆 item
    var secondNode = render(1);
    document.body.appendChild(secondNode);
    var second = reasonBoxes(secondNode)[0];
    second.value = '改過的原因';
    second.dispatchEvent(new Event('input', { bubbles: true }));
    var out = {
      models: items.map(function (it) { return (it.equipment || {}).model || ''; }),
      reasons: items.map(function (it) { return it.actualReason || ''; }),
      textareaValues: textareaValues,
      text: text,
      perCardCounts: perCardCounts,
      // 共用模組直接寫回 formData，不再透過回呼
      writtenReasons: RepairCaseServiceItems.getItems(c).map(function (it) { return it.actualReason || ''; }),
      writtenItemIds: RepairCaseServiceItems.getItems(c).map(function (it) { return it.id; }),
      secondItemId: items[1].id
    };
    secondNode.remove();
    return out;
  })()`);
  assertTrue(arrangement.models.length >= 2, '取得多設備案件', arrangement.models.join(' | '));
  assertTrue(
    arrangement.models.every(function (m) { return !m || arrangement.text.indexOf(m) !== -1; }),
    '派工明細列出每一台設備（型號）',
    arrangement.text.slice(0, 200)
  );
  assertTrue(
    arrangement.reasons.every(function (r) { return !r || arrangement.textareaValues.indexOf(r) !== -1; }),
    '派工明細列出每一台設備的實際維修原因',
    arrangement.textareaValues.join(' | ')
  );
  assertTrue(
    arrangement.perCardCounts.length === arrangement.models.length
      && arrangement.perCardCounts.every(function (n) { return n === 1; }),
    '一次只渲染一張卡片，且各有一個實際維修原因 textarea',
    arrangement.perCardCounts.join(' | ')
  );
  assertEq(arrangement.writtenReasons[1], '改過的原因', '第二張卡片的輸入寫回第二筆 item 的 actualReason');
  assertEq(arrangement.writtenReasons[0], arrangement.reasons[0], '第一筆 item 的實際維修原因不受影響');
  assertEq(arrangement.writtenItemIds[1], arrangement.secondItemId, '被改動的正是第二筆 item（id 不變）');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {
  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
