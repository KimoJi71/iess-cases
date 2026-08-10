#!/usr/bin/env node
/**
 * 資料調閱多選篩選：UI 驗證。
 * 啟動 headless Chrome 載入 index.html，渲染真實的 DataRetrieval 元件後斷言 DOM。
 * 參考 scripts/verify-equipment-level-ui.mjs 的 CDP 連線流程。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9334);

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
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}
function assertJson(actual, expected, name) {
  assertEq(JSON.stringify(actual), JSON.stringify(expected), name);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-dr-ui-profile',
  'about:blank'
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const consoleErrors = [];

// Bound how long any single CDP round trip may take. Page-side code below runs
// inside setTimeout callbacks (e.g. clicking `opts[N]` for some hardcoded N); if a
// selector or index is ever wrong, the callback throws, the *page-side* Promise it's
// building never settles, and a plain `await` on it would hang the Node process
// forever (no assertion, no exit code, no Chrome cleanup). This watchdog turns that
// into a normal thrown Error, which the outer try/catch below converts into a failed
// assertion — the script still exits 1 and still kills Chrome.
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
      throw new Error(
        `逾時 ${timeoutMs}ms 無回應（可能是頁面內某個 setTimeout 回呼拋出例外，導致該 Promise 永遠不會 resolve）— 運算式開頭：${expression.slice(0, 120)}`
      );
    })
  ]);
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
  }
  return r.result.value;
}

// Headless Chrome's CDP can garbage-collect a Promise that's only reachable via the
// Runtime.evaluate return value before it settles ("Promise was collected"), especially
// across chained setTimeout ticks. Pin the promise to a global first so it stays
// strongly referenced, then await it in a second round trip.
async function evaluateAsync(expression) {
  await evaluate(`window.__pending = (${expression}); 'queued'`);
  return evaluate('window.__pending');
}

// 在頁面裡渲染 DataRetrieval 並掛到 document.body，回傳一段可重複使用的前置程式碼。
const MOUNT = `
  window.__stores = [
    { id:'S1', customerName:'甲客戶', storeName:'甲一店', storeStatus:'營業',
      companyCity:'台北市', companyDistrict:'中正區' },
    { id:'S2', customerName:'甲客戶', storeName:'甲二店', storeStatus:'營業',
      companyCity:'台北市', companyDistrict:'大安區' },
    { id:'S3', customerName:'乙客戶', storeName:'乙一店', storeStatus:'營業',
      companyCity:'新北市', companyDistrict:'板橋區' },
    // 與 S1 同名不同客戶：檢驗門市選單分組後兩者是獨立選項。
    { id:'S4', customerName:'乙客戶', storeName:'甲一店', storeStatus:'營業',
      companyCity:'新北市', companyDistrict:'新莊區' }
  ];
  window.__mount = function () {
    var host = document.getElementById('dr-host');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'dr-host';
    document.body.appendChild(host);
    host.appendChild(DataRetrieval({
      cases: [], maintenanceCases: [], projectCases: [],
      customers: [{ id:'C1', name:'甲客戶' }, { id:'C2', name:'乙客戶' }],
      stores: window.__stores,
      showToast: function () {}
    }));
    return host;
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
  await evaluate(MOUNT + "'ok'");
  const assigneeFirst = await evaluate('ASSIGNEES[0]');

  console.log('\n1. 篩選欄位渲染為 MultiSelect');
  const rendered = await evaluate(`(function () {
    var host = window.__mount();
    var labels = Array.prototype.map.call(
      host.querySelectorAll('label'), function (l) { return l.textContent.trim(); });
    var multi = host.querySelectorAll('.multi-select').length;
    var placeholders = Array.prototype.map.call(
      host.querySelectorAll('.multi-select__placeholder'),
      function (p) { return p.textContent.trim(); });
    return { labels: labels, multi: multi, placeholders: placeholders };
  })()`);
  // 預設案件類型為「維修」：工項分類/叫修項目/叫修原因/客戶名稱/門市名稱/維修人員/服務等級 = 7 個
  assertEq(rendered.multi, 7, '維修篩選區有 7 個 MultiSelect');
  assertTrue(rendered.labels.includes('維修人員'), '有「維修人員」欄位', rendered.labels.join(' | '));
  assertTrue(
    rendered.placeholders.length === 7 && rendered.placeholders.every(p => p === '全部'),
    '未選時全部顯示 placeholder「全部」',
    JSON.stringify(rendered.placeholders)
  );

  console.log('\n2. 選取後以 chip 呈現，且可多選');
  const chips = await evaluateAsync(`(function () {
    var host = window.__mount();
    var roots = host.querySelectorAll('.multi-select');
    // 第 6 個（index 5）為「維修人員」
    var control = roots[5].querySelector('.multi-select__control');
    control.click();
    return new Promise(function (resolve) {
      setTimeout(function () {
        var opts = document.querySelectorAll('.multi-select__menu .multi-select__option');
        opts[0].click();
        // MultiSelect 選取選項後選單維持展開（一次可連續多選，不會自動關閉，
        // 見 src/core/multi-select.js 的 toggleOption：只呼叫 onChange，不呼叫 closeMenu）。
        // 因此不需要再次點擊 control 重新開啟，直接在同一個已展開的選單裡點第二個選項即可。
        setTimeout(function () {
          var opts2 = document.querySelectorAll('.multi-select__menu .multi-select__option');
          opts2[1].click();
          setTimeout(function () {
            var texts = Array.prototype.map.call(
              host.querySelectorAll('.multi-select')[5].querySelectorAll('.multi-select__chip'),
              function (c) { return c.textContent.replace('×', '').trim(); });
            resolve(texts);
          }, 50);
        }, 50);
      }, 50);
    });
  })()`);
  assertEq(chips.length, 2, '維修人員可同時選兩位', JSON.stringify(chips));
  assertEq(chips[0], assigneeFirst, '第一個 chip 為選單第一項');

  console.log('\n3. 客戶改變時清空門市，門市選項依客戶分組');
  const cascade = await evaluateAsync(`(function () {
    var host = window.__mount();
    function ms(i) { return host.querySelectorAll('.multi-select')[i]; }
    function openAndClick(index, optionIndex) {
      ms(index).querySelector('.multi-select__control').click();
      return new Promise(function (resolve) {
        setTimeout(function () {
          var opts = document.querySelectorAll('.multi-select__menu .multi-select__option');
          opts[optionIndex].click();
          setTimeout(resolve, 50);
        }, 50);
      });
    }
    // 客戶名稱選單依 zh-Hant 排序（非陣列填入順序），用文字比對找選項，
    // 才能確實選到「甲客戶」而不是巧合命中排序後排第一的選項。
    function openAndClickByText(index, text) {
      ms(index).querySelector('.multi-select__control').click();
      return new Promise(function (resolve) {
        setTimeout(function () {
          var opts = Array.prototype.slice.call(
            document.querySelectorAll('.multi-select__menu .multi-select__option'));
          var target = opts.find(function (o) { return o.textContent.trim() === text; });
          target.click();
          setTimeout(resolve, 50);
        }, 50);
      });
    }
    // index 3 = 客戶名稱, index 4 = 門市名稱
    return openAndClickByText(3, '甲客戶')                // 選甲客戶
      .then(function () { return openAndClick(4, 0); })  // 選甲客戶底下第一間門市
      .then(function () {
        var storeChips = Array.prototype.map.call(
          ms(4).querySelectorAll('.multi-select__chip'),
          function (c) { return c.textContent.replace('×', '').trim(); });
        return openAndClickByText(3, '乙客戶').then(function () {  // 再加選乙客戶 -> 應清空門市
          ms(4).querySelector('.multi-select__control').click();
          return new Promise(function (resolve) {
            setTimeout(function () {
              var menuEl = document.querySelector('.multi-select__menu');
              resolve({
                storeChipsBefore: storeChips,
                storeChipsAfter: ms(4).querySelectorAll('.multi-select__chip').length,
                storeGroups: Array.prototype.map.call(
                  menuEl.querySelectorAll('.multi-select__group'),
                  function (g) { return g.textContent.trim(); }),
                storeOptions: Array.prototype.map.call(
                  menuEl.querySelectorAll('.multi-select__option'),
                  function (o) { return o.textContent.trim(); })
              });
            }, 50);
          });
        });
      });
  })()`);
  assertJson(cascade.storeChipsBefore, ['甲客戶 · 甲一店'], '選門市後 chip 顯示「客戶 · 門市」');
  assertEq(cascade.storeChipsAfter, 0, '客戶變動後門市被清空');
  const byZh = (a, b) => a.localeCompare(b, 'zh-Hant');
  // 期望值用與 getStoreGroupsForCustomers 相同的 collator 推導，而不是寫死 ICU 的排序結果：
  // 這裡要鎖定的是「群組依客戶、群組內依 zh-Hant 排序」，不是某個特定 ICU 版本的筆畫序。
  const expectedByCustomer = {
    '甲客戶': ['甲一店', '甲二店'].sort(byZh),
    '乙客戶': ['乙一店', '甲一店'].sort(byZh)
  };
  const expectedGroups = ['甲客戶', '乙客戶'].sort(byZh);
  const expectedOptions = expectedGroups.reduce(function (acc, c) {
    return acc.concat(expectedByCustomer[c]);
  }, []);
  assertJson(cascade.storeGroups, expectedGroups, '門市選單依客戶分組（順序與 getStoreGroupsForCustomers 的 zh-Hant 排序一致）');
  assertJson(
    cascade.storeOptions, expectedOptions,
    '同名門市在各自客戶群組下各出現一次（區辨式斷言：若仍以門市名去重，第二個甲一店會消失，長度會是 3）'
  );
  assertEq(cascade.storeOptions.length, 4, '兩客戶共 4 個門市選項（同名門市未被跨客戶去重）');

  console.log('\n3b. 保養分頁行政區依縣市分組');
  const districts = await evaluateAsync(`(function () {
    window.__mount();
    var buttons = Array.prototype.slice.call(document.querySelectorAll('button'));
    buttons.find(function (b) { return b.textContent.trim() === '保養'; }).click();
    return new Promise(function (resolve) {
      setTimeout(function () {
        var host = document.getElementById('dr-host');
        function ms(i) { return host.querySelectorAll('.multi-select')[i]; }
        // index 0 = 縣市, index 1 = 行政區
        ms(0).querySelector('.multi-select__control').click();
        setTimeout(function () {
          var cityOpts = document.querySelectorAll('.multi-select__menu .multi-select__option');
          var firstCity = cityOpts[0].textContent.trim();
          cityOpts[0].click();
          setTimeout(function () {
            var host2 = document.getElementById('dr-host');
            host2.querySelectorAll('.multi-select')[1]
              .querySelector('.multi-select__control').click();
            setTimeout(function () {
              var menuEl = document.querySelector('.multi-select__menu');
              var groups = Array.prototype.map.call(
                menuEl.querySelectorAll('.multi-select__group'),
                function (g) { return g.textContent.trim(); });
              var districtOpts = menuEl.querySelectorAll('.multi-select__option');
              var firstDistrict = districtOpts[0].textContent.trim();
              districtOpts[0].click();
              setTimeout(function () {
                var host3 = document.getElementById('dr-host');
                var chip = host3.querySelectorAll('.multi-select')[1].querySelector('.multi-select__chip');
                resolve({
                  firstCity: firstCity,
                  groups: groups,
                  firstDistrict: firstDistrict,
                  districtChip: chip.textContent.replace('×', '').trim()
                });
              }, 50);
            }, 50);
          }, 80);
        }, 50);
      }, 50);
    });
  })()`);
  assertJson(districts.groups, [districts.firstCity], '選一個縣市後，行政區選單只有該縣市一個群組');
  assertEq(
    districts.districtChip, districts.firstCity + ' · ' + districts.firstDistrict,
    '選行政區後 chip 顯示「縣市 · 行政區」，而非帶控制字元的複合鍵原文'
  );

  console.log('\n4. 鍵盤切換案件類型時，展開中的選單不會孤兒化');
  const orphan = await evaluateAsync(`(function () {
    var host = window.__mount();
    // 展開第一個 MultiSelect（工項分類）。這裡直接呼叫 .click()（不經過 mousedown）
    // 是為了重現鍵盤操作的路徑：Enter 觸發的是 click 事件，不會先觸發滑鼠版
    // outside 監聽器賴以運作的 capture-phase mousedown。
    host.querySelectorAll('.multi-select')[0].querySelector('.multi-select__control').click();
    return new Promise(function (resolve) {
      setTimeout(function () {
        var menuBeforeSwitch = document.querySelectorAll('.multi-select__menu').length;
        // 切換案件類型會整批換掉 filter 面板；同樣用 .click() 模擬鍵盤 Enter，
        // 不觸發 mousedown。
        var buttons = Array.prototype.slice.call(document.querySelectorAll('button'));
        var maintenanceBtn = buttons.find(function (b) { return b.textContent.trim() === '保養'; });
        maintenanceBtn.click();
        setTimeout(function () {
          resolve({
            menuBeforeSwitch: menuBeforeSwitch,
            menuAfterSwitch: document.querySelectorAll('.multi-select__menu').length
          });
        }, 50);
      }, 50);
    });
  })()`);
  assertEq(orphan.menuBeforeSwitch, 1, '切換案件類型前選單確實已展開');
  assertEq(orphan.menuAfterSwitch, 0, '鍵盤（click 無 mousedown）切換案件類型後，document.body 不留下孤兒選單');

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
