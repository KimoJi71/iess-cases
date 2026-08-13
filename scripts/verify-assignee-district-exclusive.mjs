#!/usr/bin/env node
/**
 * 組別「一個行政區只屬於一組」互斥規則：純函式 + UI 驗證。
 * 啟動 headless Chrome 載入 index.html，直接掛載 AssigneeForm 元件，斷言
 * 已被其他組別佔用的行政區在樹狀選單中反灰、縣市全選會跳過它們、編輯自己時
 * 自己的轄區仍可勾選，以及送出時的第二道防線會擋下衝突資料。
 * 參考 scripts/verify-permissions-sidebar-groups.mjs 的 CDP 連線流程。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9347);

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
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-assignee-district-profile',
  'about:blank'
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const consoleErrors = [];

// 與 verify-permissions-sidebar-groups.mjs 同樣的看門狗：頁面內回呼若拋例外，
// 該 Promise 永不 settle，沒有逾時 Node 就會永遠卡住。
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

// AssigneeForm 是 stateful()：重繪時用 replaceChild 換掉整棵樹，所以每次操作後
// 都要從 container 重新查詢節點，不能沿用先前抓到的參照。
const HELPERS = `
  window.__af = (function () {
    var container = null;
    var state = null;

    function mount(assignees, targetCase) {
      if (container) container.parentNode.removeChild(container);
      container = document.createElement('div');
      document.body.appendChild(container);
      state = { assignees: assignees, saved: null, toasts: [], view: null };
      container.appendChild(AssigneeForm({
        assignees: assignees,
        setAssignees: function (next) { state.saved = next; },
        accounts: [],
        cases: [], setCases: function () {},
        maintenanceCases: [], setMaintenanceCases: function () {},
        projectCases: [], setProjectCases: function () {},
        setView: function (v) { state.view = v; },
        showToast: function (msg, type) {
          state.toasts.push({ text: msg, error: type === 'error' });
        },
        targetCase: targetCase || null
      }));
      return state;
    }

    // 樹狀選單的每個行政區是一個 <label>，文字即區名（不含縣市）。
    function districtLabels() {
      return Array.prototype.filter.call(
        container.querySelectorAll('label'),
        function (l) { return l.querySelector('input[type=checkbox]') && !l.querySelector('span'); }
      );
    }
    function findDistrict(name) {
      return districtLabels().filter(function (l) {
        return l.textContent.trim() === name;
      })[0] || null;
    }
    // 編輯模式下，含已選轄區的縣市預設就是展開的，直接點會反而收合，故先確認狀態。
    function expandCity(city) {
      if (findDistrict(TAIWAN_CITY_DISTRICTS[city][0])) return true;
      var btns = container.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.trim() === city) { btns[i].click(); return true; }
      }
      return false;
    }
    // 縣市的全選 checkbox 就在縣市列（含縣市名稱按鈕）裡的那一個。
    function cityCheckbox(city) {
      var rows = container.querySelectorAll('div.flex.items-center.gap-2');
      for (var i = 0; i < rows.length; i++) {
        var btn = rows[i].querySelector('button + input + button');
        if (btn && btn.textContent.trim() === city) {
          return rows[i].querySelector('input[type=checkbox]');
        }
      }
      return null;
    }
    function districtState(name) {
      var l = findDistrict(name);
      if (!l) return null;
      var cb = l.querySelector('input[type=checkbox]');
      return { checked: cb.checked, disabled: cb.disabled };
    }
    function checkedDistricts() {
      return districtLabels().filter(function (l) {
        return l.querySelector('input[type=checkbox]').checked;
      }).map(function (l) { return l.textContent.trim(); });
    }
    function clickDistrict(name) {
      var l = findDistrict(name);
      if (!l) throw new Error('找不到行政區：' + name);
      l.querySelector('input[type=checkbox]').click();
    }
    function setName(value) {
      var input = container.querySelector('input[name=name]');
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function submit() {
      var btns = container.querySelectorAll('button[type=submit]');
      btns[btns.length - 1].click();
    }
    function lastToast() {
      return state.toasts.length ? state.toasts[state.toasts.length - 1] : null;
    }
    function unmount() {
      if (container) container.parentNode.removeChild(container);
      container = null;
    }

    return {
      mount: mount, expandCity: expandCity, cityCheckbox: cityCheckbox,
      districtState: districtState, checkedDistricts: checkedDistricts,
      clickDistrict: clickDistrict, setName: setName, submit: submit,
      lastToast: lastToast, state: function () { return state; }, unmount: unmount
    };
  })();
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
  await sleep(2000);
  await evaluate('localStorage.clear(); "cleared"');
  await send('Page.navigate', { url: `file://${ROOT}/index.html` });
  await sleep(4000);

  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');
  await evaluate(HELPERS + "'ok'");

  console.log('\nSection 1｜seed 主檔本身互斥');
  assertJson(await evaluate(`(function () {
    var seen = {}, dup = [];
    INITIAL_ASSIGNEES.forEach(function (a) {
      (a.districts || []).forEach(function (d) {
        if (seen[d]) dup.push(d);
        seen[d] = true;
      });
    });
    return dup;
  })()`), [], 'seed 的組別轄區沒有任何行政區重複');

  console.log('\nSection 2｜getOccupiedDistricts / findConflictingDistricts');
  assertJson(await evaluate(
    `AssigneeUtils.getOccupiedDistricts(INITIAL_ASSIGNEES, null).sort()`
  ), ['台中市中區', '台中市北屯區', '台中市西屯區', '台北市中山區', '台北市信義區', '台北市大安區', '高雄市左營區'],
    '不排除任何組別時，回傳全部已被佔用的行政區');

  assertJson(await evaluate(
    `AssigneeUtils.getOccupiedDistricts(INITIAL_ASSIGNEES, 'ASG1').sort()`
  ), ['台中市中區', '台中市北屯區', '台中市西屯區', '台北市大安區', '高雄市左營區'],
    '排除 A組 後，A組 自己的信義區、中山區不算被佔用');

  assertJson(await evaluate(`AssigneeUtils.getOccupiedDistricts([], null)`), [],
    '空組別清單回空陣列');

  assertJson(await evaluate(`AssigneeUtils.getOccupiedDistricts(
    [{ id: 'X1', districts: ['台北市信義區'] }, { id: 'X2', districts: ['台北市信義區'] }], null
  )`), ['台北市信義區'], '同一行政區被多組持有（既有髒資料）時只回一筆');

  assertJson(await evaluate(`AssigneeUtils.findConflictingDistricts(
    INITIAL_ASSIGNEES, ['台北市信義區', '台北市大安區', '台北市中正區'], null
  )`), ['台北市信義區', '台北市大安區'], '只回真正衝突的行政區，未被佔用的中正區放行');

  assertJson(await evaluate(`AssigneeUtils.findConflictingDistricts(
    INITIAL_ASSIGNEES, ['台北市信義區', '台北市大安區'], 'ASG1'
  )`), ['台北市大安區'], '編輯 A組 時，自己的信義區不算衝突');

  assertJson(await evaluate(`AssigneeUtils.findConflictingDistricts(
    INITIAL_ASSIGNEES, ['台北市信義區', '台北市信義區'], null
  )`), ['台北市信義區'], '輸入重複時衝突清單去重');

  assertJson(await evaluate(`AssigneeUtils.findConflictingDistricts(
    INITIAL_ASSIGNEES, [], null
  )`), [], '沒選任何行政區就沒有衝突');

  console.log('\nSection 3｜新增組別：被佔用的行政區在樹狀選單反灰');
  const fresh = await evaluate(`(function () {
    __af.mount(INITIAL_ASSIGNEES, null);
    __af.expandCity('台北市');
    return {
      xinyi: __af.districtState('信義區'),
      zhongshan: __af.districtState('中山區'),
      daan: __af.districtState('大安區'),
      zhongzheng: __af.districtState('中正區')
    };
  })()`);
  assertJson(fresh.xinyi, { checked: false, disabled: true }, 'A組 的信義區不可勾選');
  assertJson(fresh.zhongshan, { checked: false, disabled: true }, 'A組 的中山區不可勾選');
  assertJson(fresh.daan, { checked: false, disabled: true }, 'D組 的大安區不可勾選');
  assertJson(fresh.zhongzheng, { checked: false, disabled: false }, '無人認領的中正區可勾選');

  console.log('\nSection 4｜縣市全選會跳過被佔用的行政區');
  const cityAll = await evaluate(`(function () {
    __af.mount(INITIAL_ASSIGNEES, null);
    __af.expandCity('台北市');
    __af.cityCheckbox('台北市').click();
    return __af.checkedDistricts().sort();
  })()`);
  assertEq(cityAll.length, 9, '台北市 12 區扣掉 3 個已被佔用，只勾到 9 區');
  assertTrue(
    ['信義區', '中山區', '大安區'].every(d => !cityAll.includes(d)),
    '全選結果不含信義區、中山區、大安區', JSON.stringify(cityAll)
  );

  console.log('\nSection 5｜編輯組別：自己的轄區仍可勾可取消');
  const editA = await evaluate(`(function () {
    var a1 = INITIAL_ASSIGNEES.filter(function (a) { return a.id === 'ASG1'; })[0];
    __af.mount(INITIAL_ASSIGNEES, a1);
    __af.expandCity('台北市');
    var before = __af.districtState('信義區');
    __af.clickDistrict('信義區');
    var after = __af.districtState('信義區');
    return { before: before, after: after, daan: __af.districtState('大安區') };
  })()`);
  assertJson(editA.before, { checked: true, disabled: false }, '編輯 A組 時自己的信義區已勾選且可操作');
  assertJson(editA.after, { checked: false, disabled: false }, '可取消勾選自己的信義區');
  assertJson(editA.daan, { checked: false, disabled: true }, '其他組的大安區在編輯時仍反灰');

  console.log('\nSection 6｜送出時的第二道防線（既有重疊的髒資料）');
  const dirty = await evaluate(`(function () {
    // 模擬規則上線前就存在的重疊資料：D組 也持有 A組 的信義區。
    var assignees = INITIAL_ASSIGNEES.map(function (a) {
      if (a.id !== 'ASG4') return a;
      return Object.assign({}, a, { districts: ['台北市大安區', '台北市信義區'] });
    });
    var target = assignees.filter(function (a) { return a.id === 'ASG4'; })[0];
    var state = __af.mount(assignees, target);
    __af.expandCity('台北市');
    var xinyi = __af.districtState('信義區');
    __af.submit();
    return { toast: __af.lastToast(), saved: state.saved, view: state.view, xinyi: xinyi };
  })()`);
  assertJson(dirty.xinyi, { checked: true, disabled: false },
    '已勾選的衝突行政區維持可操作，使用者才有辦法取消它');
  assertJson(dirty.toast, { text: '以下行政區已被其他組別使用：台北市信義區', error: true },
    '送出重疊資料時出現錯誤 toast');
  assertEq(dirty.saved, null, '衝突時沒有寫入組別主檔');
  assertEq(dirty.view, null, '衝突時停留在表單，不切回列表');

  console.log('\nSection 7｜修掉衝突後可正常存檔');
  const fixed = await evaluate(`(function () {
    var assignees = INITIAL_ASSIGNEES.map(function (a) {
      if (a.id !== 'ASG4') return a;
      return Object.assign({}, a, { districts: ['台北市大安區', '台北市信義區'] });
    });
    var target = assignees.filter(function (a) { return a.id === 'ASG4'; })[0];
    var state = __af.mount(assignees, target);
    __af.expandCity('台北市');
    __af.clickDistrict('信義區');
    var afterUncheck = __af.districtState('信義區');
    __af.submit();
    var saved = (state.saved || []).filter(function (a) { return a.id === 'ASG4'; })[0];
    __af.unmount();
    return {
      toast: __af.lastToast(), districts: saved ? saved.districts : null,
      view: state.view, afterUncheck: afterUncheck
    };
  })()`);
  assertJson(fixed.afterUncheck, { checked: false, disabled: true },
    '取消勾選後，該行政區立刻反灰，不能再加回來');
  assertJson(fixed.toast, { text: '組別更新成功', error: false }, '取消衝突的行政區後可成功更新');
  assertJson(fixed.districts, ['台北市大安區'], '存下的轄區只剩沒有衝突的大安區');
  assertEq(fixed.view, 'assignee-list', '存檔後切回組別列表');

  assertEq(consoleErrors.length, 0, '互動過程無 JS 錯誤');
} catch (err) {
  fail('腳本執行例外', err.message);
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
