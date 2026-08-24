#!/usr/bin/env node
/**
 * 下拉／挑選器的關鍵字篩選：UI 驗證。
 * 啟動 headless Chrome 載入 index.html，分別掛載三個元件後斷言 DOM：
 *   1. IESS.MultiSelect        複選下拉（選單頂端搜尋框）
 *   2. DistrictTreePicker      縣市／行政區樹狀勾選（上方搜尋框）
 *   3. ProjectEquipPicker      工程設備多選 Modal（標題下搜尋框）
 * 參考 scripts/verify-multi-select-groups-ui.mjs 的 CDP 連線流程。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9351);

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

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-searchable-dropdowns-profile',
  'about:blank'
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const consoleErrors = [];

// 與 verify-multi-select-groups-ui.mjs 相同的看門狗：頁面內 setTimeout 回呼若拋例外，
// 其 Promise 永遠不會 settle，沒有逾時就會讓整個 Node 程序無聲卡死。
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

// headless Chrome 可能在 Promise settle 前就回收只由 Runtime.evaluate 回傳值持有的 Promise
// （"Promise was collected"）。先釘在 global 上保持強參照，第二趟往返再 await。
async function evaluateAsync(expression) {
  await evaluate(`window.__pending = (${expression}); 'queued'`);
  return evaluate('window.__pending');
}

const HELPERS = `
  // 對原生 DOM 的搜尋框輸入關鍵字：模擬使用者實際打字（非組字狀態）
  window.__type = function (input, text) {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  // 模擬中文注音組字：組字期間 input 事件不應觸發篩選，compositionend 後才套用
  window.__typeComposing = function (input, text) {
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  window.__endComposing = function (input) {
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
  };
  window.__texts = function (root, selector) {
    return Array.prototype.map.call(root.querySelectorAll(selector), function (el) {
      return el.textContent.trim();
    });
  };
  window.__host = function () {
    var host = document.getElementById('probe-host');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'probe-host';
    document.body.appendChild(host);
    return host;
  };
`;

const MOUNT_MULTI_SELECT = `
  window.__msGroups = [
    { group: '甲客戶', options: [
      { value: '甲客戶\\u0001台北一店', label: '台北一店', chipLabel: '甲客戶 · 台北一店', hint: '張三' },
      { value: '甲客戶\\u0001高雄二店', label: '高雄二店', chipLabel: '甲客戶 · 高雄二店', hint: '李四' }
    ] },
    { group: '乙客戶', options: [
      { value: '乙客戶\\u0001台中三店', label: '台中三店', chipLabel: '乙客戶 · 台中三店', hint: '王五' }
    ] }
  ];
  window.__msSelected = [];
  window.__msRender = function (options) {
    var host = document.getElementById('probe-host');
    host.innerHTML = '';
    host.appendChild(IESS.MultiSelect({
      id: 'ms-search-test',
      options: options,
      value: window.__msSelected,
      onChange: function (next) {
        window.__msSelected = next;
        window.__msRender(options);
      },
      placeholder: '全部'
    }));
    return host;
  };
  window.__msMount = function (options, selected) {
    IESS.MultiSelect.closeAll();
    window.__host();
    window.__msSelected = selected || [];
    return window.__msRender(options);
  };
  window.__msOpen = function (options, selected) {
    var host = window.__msMount(options, selected);
    host.querySelector('.multi-select__control').click();
    return host;
  };
  window.__msMenu = function () { return document.querySelector('.multi-select__menu'); };
  window.__msSearch = function () {
    var menu = window.__msMenu();
    return menu && menu.querySelector('.multi-select__search-input');
  };
`;

const MOUNT_SEARCHABLE_SELECT = `
  window.__ssValue = '';
  window.__ssRender = function () {
    var host = document.getElementById('probe-host');
    host.innerHTML = '';
    host.appendChild(IESS.h('select', {
      value: window.__ssValue,
      onChange: function (e) { window.__ssValue = e.target.value; window.__ssRender(); }
    },
      IESS.h('option', { value: '' }, '請選擇'),
      ['台北一店', '台北二店', '高雄一店'].map(function (s) {
        return IESS.h('option', { value: s }, s);
      })
    ));
    return host;
  };
  window.__ssMount = function () {
    document.querySelectorAll('.searchable-select__menu').forEach(function (m) { m.remove(); });
    window.__host();
    window.__ssValue = '';
    return window.__ssRender();
  };
  window.__ssOpen = function () {
    var host = window.__ssMount();
    host.querySelector('.searchable-select__input')
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    return host;
  };
  window.__ssInput = function () {
    return document.getElementById('probe-host').querySelector('.searchable-select__input');
  };
`;

const MOUNT_DISTRICT_PICKER = `
  window.__dpSelected = [];
  window.__dpExpanded = [];
  window.__dpRender = function () {
    var host = document.getElementById('probe-host');
    host.innerHTML = '';
    host.appendChild(DistrictTreePicker({
      selectedDistricts: window.__dpSelected,
      onChange: function (next) { window.__dpSelected = next; window.__dpRender(); },
      expandedCities: window.__dpExpanded,
      onExpandedCitiesChange: function (next) { window.__dpExpanded = next; window.__dpRender(); }
    }));
    return host;
  };
  window.__dpMount = function (selected, expanded) {
    window.__host();
    window.__dpSelected = selected || [];
    window.__dpExpanded = expanded || [];
    return window.__dpRender();
  };
  window.__dpSearch = function () {
    return document.getElementById('probe-host').querySelector('.district-picker__search-input');
  };
  // 目前畫面上「有列出來」的縣市與其展開中的行政區
  window.__dpSnapshot = function () {
    var host = document.getElementById('probe-host');
    return Array.prototype.map.call(host.querySelectorAll('.district-picker__city'), function (cityEl) {
      return {
        city: cityEl.querySelector('.district-picker__city-name').textContent.trim(),
        count: (cityEl.querySelector('.district-picker__city-count') || {}).textContent || '',
        districts: window.__texts(cityEl, '.district-picker__district')
      };
    });
  };
`;

const MOUNT_EQUIP_PICKER = `
  window.__eqItems = [
    { id: 'e1', customerName: '甲客戶', storeName: '台北一店', category: '冷氣', brand: '大金',
      deviceName: '室外機', model: 'RXS-100', area: '一樓', assetNumber: 'A-001',
      serialNumber: 'S-001', status: '運轉中', createdDate: '2026-01-03' },
    { id: 'e2', customerName: '甲客戶', storeName: '台北一店', category: '冰箱', brand: '日立',
      deviceName: '冷藏櫃', model: 'HTC-200', area: '二樓', assetNumber: 'A-002',
      serialNumber: 'S-002', status: '運轉中', createdDate: '2026-01-02' },
    { id: 'e3', customerName: '甲客戶', storeName: '台北一店', category: '冷氣', brand: '大金',
      deviceName: '室內機', model: 'RXS-300', area: '三樓', assetNumber: 'A-003',
      serialNumber: 'S-003', status: '已汰換', createdDate: '2026-01-01' }
  ];
  window.__eqConfirmed = null;
  window.__eqMount = function () {
    var host = window.__host();
    window.__eqConfirmed = null;
    host.appendChild(ProjectEquipPicker({
      equipments: window.__eqItems,
      customerName: '甲客戶',
      storeName: '台北一店',
      addedIds: [],
      onConfirm: function (picked) {
        window.__eqConfirmed = picked.map(function (p) { return p.model; });
      },
      onClose: function () {}
    }));
    return host;
  };
  window.__eqSearch = function () {
    return document.getElementById('probe-host').querySelector('.equip-picker__search-input');
  };
  window.__eqRows = function () {
    var host = document.getElementById('probe-host');
    return Array.prototype.map.call(host.querySelectorAll('tbody tr'), function (tr) {
      return tr.textContent.trim();
    });
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
  await evaluate(HELPERS + MOUNT_MULTI_SELECT + MOUNT_SEARCHABLE_SELECT
    + MOUNT_DISTRICT_PICKER + MOUNT_EQUIP_PICKER + "'ok'");

  /* ---------------- 1. 複選下拉 MultiSelect ---------------- */
  console.log('\n1. 複選下拉：選單頂端有搜尋框且自動聚焦');
  const msOpened = await evaluateAsync(`(function () {
    window.__msOpen(window.__msGroups);
    return new Promise(function (resolve) {
      setTimeout(function () {
        var input = window.__msSearch();
        resolve({
          hasSearch: !!input,
          focused: !!input && document.activeElement === input,
          placeholder: input ? input.placeholder : null,
          options: window.__texts(window.__msMenu(), '.multi-select__option-label')
        });
      }, 80);
    });
  })()`);
  assertEq(msOpened.hasSearch, true, '展開時選單頂端有關鍵字輸入框');
  assertEq(msOpened.focused, true, '展開時自動聚焦搜尋框，可直接打字');
  assertEq(msOpened.placeholder, '輸入關鍵字篩選', '搜尋框有提示文字');
  assertJson(msOpened.options, ['台北一店', '高雄二店', '台中三店'], '未輸入關鍵字時列出全部選項');

  console.log('\n2. 複選下拉：關鍵字即時篩選，整組被篩掉就連群組標題一起隱藏');
  const msFiltered = await evaluateAsync(`(function () {
    window.__msOpen(window.__msGroups);
    return new Promise(function (resolve) {
      setTimeout(function () {
        window.__type(window.__msSearch(), '台北');
        setTimeout(function () {
          var menu = window.__msMenu();
          resolve({
            options: window.__texts(menu, '.multi-select__option-label'),
            groups: window.__texts(menu, '.multi-select__group'),
            searchStillThere: !!window.__msSearch(),
            searchValue: window.__msSearch() ? window.__msSearch().value : null
          });
        }, 80);
      }, 80);
    });
  })()`);
  assertJson(msFiltered.options, ['台北一店'], '只留下命中關鍵字的選項');
  assertJson(msFiltered.groups, ['甲客戶'], '選項全被篩掉的群組連標題一起隱藏');
  assertEq(msFiltered.searchStillThere, true, '篩選後搜尋框仍在，可繼續修改關鍵字');
  assertEq(msFiltered.searchValue, '台北', '篩選後搜尋框保留已輸入的關鍵字');

  console.log('\n3. 複選下拉：hint 與 chipLabel 也納入比對');
  const msHint = await evaluateAsync(`(function () {
    window.__msOpen(window.__msGroups);
    return new Promise(function (resolve) {
      setTimeout(function () {
        window.__type(window.__msSearch(), '王五');
        setTimeout(function () {
          var byHint = window.__texts(window.__msMenu(), '.multi-select__option-label');
          window.__type(window.__msSearch(), '乙客戶');
          setTimeout(function () {
            resolve({
              byHint: byHint,
              byChipLabel: window.__texts(window.__msMenu(), '.multi-select__option-label')
            });
          }, 80);
        }, 80);
      }, 80);
    });
  })()`);
  assertJson(msHint.byHint, ['台中三店'], '可用 hint（組別成員等次要說明）搜尋');
  assertJson(msHint.byChipLabel, ['台中三店'], '可用 chipLabel（含客戶前綴）搜尋，跨群組同名門市才分得出來');

  console.log('\n4. 複選下拉：無命中顯示提示，不是空白選單');
  const msEmpty = await evaluateAsync(`(function () {
    window.__msOpen(window.__msGroups);
    return new Promise(function (resolve) {
      setTimeout(function () {
        window.__type(window.__msSearch(), 'zzz查無此店');
        setTimeout(function () {
          var menu = window.__msMenu();
          resolve({
            empty: window.__texts(menu, '.multi-select__empty'),
            options: menu.querySelectorAll('.multi-select__option').length,
            groups: menu.querySelectorAll('.multi-select__group').length
          });
        }, 80);
      }, 80);
    });
  })()`);
  assertJson(msEmpty.empty, ['找不到符合的選項'], '無命中時顯示「找不到符合的選項」');
  assertEq(msEmpty.options, 0, '無命中時不留任何選項');
  assertEq(msEmpty.groups, 0, '無命中時不留任何群組標題');

  console.log('\n5. 複選下拉：中文組字期間不篩選，組字完成才套用');
  const msComposition = await evaluateAsync(`(function () {
    window.__msOpen(window.__msGroups);
    return new Promise(function (resolve) {
      setTimeout(function () {
        var input = window.__msSearch();
        window.__typeComposing(input, 'ㄊㄞ');
        setTimeout(function () {
          var during = window.__texts(window.__msMenu(), '.multi-select__option-label');
          window.__type(input, '高雄');
          window.__endComposing(input);
          setTimeout(function () {
            resolve({
              during: during,
              after: window.__texts(window.__msMenu(), '.multi-select__option-label')
            });
          }, 80);
        }, 80);
      }, 80);
    });
  })()`);
  assertJson(msComposition.during, ['台北一店', '高雄二店', '台中三店'], '注音組字未完成時不篩選，選項不會整份消失');
  assertJson(msComposition.after, ['高雄二店'], 'compositionend 後才依組好的字篩選');

  console.log('\n6. 複選下拉：篩選不影響已選 chips，關閉後關鍵字清空');
  const msChips = await evaluateAsync(`(function () {
    window.__msOpen(window.__msGroups, ['甲客戶\\u0001高雄二店']);
    return new Promise(function (resolve) {
      setTimeout(function () {
        window.__type(window.__msSearch(), '台北');
        setTimeout(function () {
          var host = document.getElementById('probe-host');
          var chipsWhileFiltered = window.__texts(host, '.multi-select__chip').map(function (t) {
            return t.replace('×', '').trim();
          });
          host.querySelector('.multi-select__control').click();
          setTimeout(function () {
            host.querySelector('.multi-select__control').click();
            setTimeout(function () {
              var input = window.__msSearch();
              resolve({
                chipsWhileFiltered: chipsWhileFiltered,
                reopenedValue: input ? input.value : null,
                reopenedOptions: window.__texts(window.__msMenu(), '.multi-select__option-label')
              });
            }, 80);
          }, 80);
        }, 80);
      }, 80);
    });
  })()`);
  assertJson(msChips.chipsWhileFiltered, ['甲客戶 · 高雄二店'],
    '已選項目被關鍵字篩掉時，chip 仍留在欄位上（篩選只作用於選單）');
  assertEq(msChips.reopenedValue, '', '關閉再展開時關鍵字已清空');
  assertJson(msChips.reopenedOptions, ['台北一店', '高雄二店', '台中三店'], '關閉再展開時選項回到全部');

  /* ---------------- 2. 縣市／行政區樹狀勾選 ---------------- */
  console.log('\n7. 行政區樹：上方有搜尋框，未輸入時維持原本收合狀態');
  const dpInitial = await evaluateAsync(`(function () {
    window.__dpMount([], []);
    var input = window.__dpSearch();
    return {
      hasSearch: !!input,
      placeholder: input ? input.placeholder : null,
      cities: window.__dpSnapshot().map(function (c) { return c.city; }),
      expandedDistricts: window.__dpSnapshot().reduce(function (n, c) { return n + c.districts.length; }, 0)
    };
  })()`);
  assertEq(dpInitial.hasSearch, true, '樹狀勾選上方有關鍵字輸入框');
  assertEq(dpInitial.placeholder, '搜尋縣市或行政區', '搜尋框有提示文字');
  assertJson(dpInitial.cities, ['台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市'],
    '未輸入關鍵字時列出所有縣市');
  assertEq(dpInitial.expandedDistricts, 0, '未輸入關鍵字時維持原本的收合狀態，不自動展開');

  console.log('\n8. 行政區樹：搜行政區名 → 只留命中的縣市並自動展開命中的行政區');
  const dpByDistrict = await evaluateAsync(`(function () {
    window.__dpMount([], []);
    window.__type(window.__dpSearch(), '中正');
    return window.__dpSnapshot();
  })()`);
  assertJson(dpByDistrict.map(c => c.city), ['台北市'], '沒有命中的縣市整個隱藏');
  assertJson(dpByDistrict[0] ? dpByDistrict[0].districts : [], ['中正區'],
    '命中的縣市自動展開，且只列出命中的行政區');

  console.log('\n9. 行政區樹：搜縣市名 → 該縣市的行政區全部列出');
  const dpByCity = await evaluateAsync(`(function () {
    window.__dpMount([], []);
    window.__type(window.__dpSearch(), '桃園');
    return window.__dpSnapshot();
  })()`);
  assertJson(dpByCity.map(c => c.city), ['桃園市'], '只留下縣市名命中的縣市');
  assertJson(dpByCity[0] ? dpByCity[0].districts : [],
    ['桃園區', '中壢區', '平鎮區', '八德區'],
    '縣市名命中時列出該縣市全部行政區');

  console.log('\n10. 行政區樹：計數仍以該縣市全部行政區為分母，不受篩選影響');
  const dpCount = await evaluateAsync(`(function () {
    window.__dpMount(['台北市中正區'], []);
    window.__type(window.__dpSearch(), '中正');
    return window.__dpSnapshot();
  })()`);
  assertEq(dpCount[0] ? dpCount[0].count : '', '1 / 12',
    '篩選中的計數分母仍是台北市全部 12 個行政區，不會誤以為已全選');

  console.log('\n11. 行政區樹：無命中顯示提示；清空關鍵字回到原本展開狀態');
  const dpEmpty = await evaluateAsync(`(function () {
    window.__dpMount([], ['台中市']);
    window.__type(window.__dpSearch(), 'zzz查無此區');
    var host = document.getElementById('probe-host');
    var emptyText = window.__texts(host, '.district-picker__empty');
    var citiesWhileEmpty = window.__dpSnapshot().length;
    window.__type(window.__dpSearch(), '');
    var restored = window.__dpSnapshot();
    return {
      emptyText: emptyText,
      citiesWhileEmpty: citiesWhileEmpty,
      restoredCities: restored.map(function (c) { return c.city; }),
      taichungDistricts: (restored.find(function (c) { return c.city === '台中市'; }) || {}).districts
    };
  })()`);
  assertJson(dpEmpty.emptyText, ['找不到符合的縣市或行政區'], '無命中時顯示提示文字');
  assertEq(dpEmpty.citiesWhileEmpty, 0, '無命中時不留任何縣市');
  assertJson(dpEmpty.restoredCities, ['台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市'],
    '清空關鍵字後所有縣市回來');
  assertEq((dpEmpty.taichungDistricts || []).length, 10,
    '清空關鍵字後回到使用者原本手動展開的台中市，搜尋不會污染展開狀態');

  /* ---------------- 3. 工程設備多選 Modal ---------------- */
  console.log('\n12. 設備 Modal：標題下有搜尋框，關鍵字篩選表格列');
  const eqFiltered = await evaluateAsync(`(function () {
    window.__eqMount();
    var input = window.__eqSearch();
    var before = window.__eqRows().length;
    window.__type(input, 'HTC');
    var after = window.__eqRows();
    return {
      hasSearch: !!input,
      placeholder: input.placeholder,
      before: before,
      afterCount: after.length,
      afterHasModel: after.length === 1 && after[0].indexOf('HTC-200') !== -1
    };
  })()`);
  assertEq(eqFiltered.hasSearch, true, '設備 Modal 有關鍵字輸入框');
  assertEq(eqFiltered.placeholder, '搜尋設備', '搜尋框有提示文字');
  assertEq(eqFiltered.before, 3, '未輸入關鍵字時列出全部設備');
  assertEq(eqFiltered.afterCount, 1, '輸入型號關鍵字後只留下該設備');
  assertEq(eqFiltered.afterHasModel, true, '留下的正是型號命中的那一列');

  console.log('\n13. 設備 Modal：全選只作用於目前篩選結果中可選的設備');
  const eqSelectAll = await evaluateAsync(`(function () {
    window.__eqMount();
    var host = document.getElementById('probe-host');
    window.__type(window.__eqSearch(), '大金');
    // 大金有兩台：RXS-100（運轉中，可選）與 RXS-300（已汰換，不可選）
    host.querySelector('thead input[type="checkbox"]').click();
    var confirmBtn = host.querySelectorAll('button');
    return {
      rows: window.__eqRows().length,
      checked: host.querySelectorAll('tbody input[type="checkbox"]:checked').length,
      confirmLabel: Array.prototype.map.call(confirmBtn, function (b) { return b.textContent.trim(); })
        .filter(function (t) { return t.indexOf('加入所選') === 0; })[0]
    };
  })()`);
  assertEq(eqSelectAll.rows, 2, '「大金」命中兩台設備');
  assertEq(eqSelectAll.checked, 1, '全選只勾選篩選結果中可選的設備，已汰換的不勾');
  assertEq(eqSelectAll.confirmLabel, '加入所選（1）', '確認鈕數量反映實際勾選數');

  console.log('\n14. 設備 Modal：已勾選但被關鍵字篩掉的設備，確認時仍會加入');
  const eqKeepSelection = await evaluateAsync(`(function () {
    window.__eqMount();
    var host = document.getElementById('probe-host');
    window.__type(window.__eqSearch(), 'RXS-100');
    host.querySelector('tbody input[type="checkbox"]').click();
    window.__type(window.__eqSearch(), 'HTC');
    var rowsNow = window.__eqRows().length;
    host.querySelector('tbody input[type="checkbox"]').click();
    var confirm = Array.prototype.filter.call(host.querySelectorAll('button'), function (b) {
      return b.textContent.trim().indexOf('加入所選') === 0;
    })[0];
    var label = confirm.textContent.trim();
    confirm.click();
    return { rowsNow: rowsNow, label: label, confirmed: window.__eqConfirmed };
  })()`);
  assertEq(eqKeepSelection.rowsNow, 1, '換關鍵字後只剩另一台設備');
  assertEq(eqKeepSelection.label, '加入所選（2）', '被篩掉的已勾選設備仍計入數量');
  assertJson((eqKeepSelection.confirmed || []).slice().sort(), ['HTC-200', 'RXS-100'],
    '確認時兩台都加入，關鍵字只是視野不是取消勾選');

  console.log('\n15. 設備 Modal：無命中顯示提示');
  const eqEmpty = await evaluateAsync(`(function () {
    window.__eqMount();
    window.__type(window.__eqSearch(), 'zzz查無此設備');
    var host = document.getElementById('probe-host');
    return {
      rows: window.__eqRows().length,
      empty: window.__texts(host, '.equip-picker__empty')
    };
  })()`);
  assertEq(eqEmpty.rows, 0, '無命中時不留任何資料列');
  assertJson(eqEmpty.empty, ['找不到符合的設備'], '無命中時顯示提示文字');

  /* ---------------- 4. 單選下拉 SearchableSelect ---------------- */
  console.log('\n16. 單選下拉：輸入關鍵字即時篩選，組字期間不篩選');
  const ssFilter = await evaluateAsync(`(function () {
    window.__ssOpen();
    return new Promise(function (resolve) {
      setTimeout(function () {
        var input = window.__ssInput();
        var all = window.__texts(document, '.searchable-select__option-label');
        window.__typeComposing(input, 'ㄊㄞ');
        setTimeout(function () {
          var during = window.__texts(document, '.searchable-select__option-label');
          window.__type(input, '高雄');
          window.__endComposing(input);
          setTimeout(function () {
            resolve({
              all: all,
              during: during,
              after: window.__texts(document, '.searchable-select__option-label')
            });
          }, 80);
        }, 80);
      }, 120);
    });
  })()`);
  assertJson(ssFilter.all, ['台北一店', '台北二店', '高雄一店'], '展開時列出全部選項（不含 placeholder）');
  assertJson(ssFilter.during, ['台北一店', '台北二店', '高雄一店'], '注音組字未完成時不篩選');
  assertJson(ssFilter.after, ['高雄一店'], 'compositionend 後才依組好的字篩選');

  console.log('\n17. 單選下拉：元件被父層移除時，展開中的浮動選單要一起收掉');
  const ssOrphan = await evaluateAsync(`(function () {
    window.__ssOpen();
    return new Promise(function (resolve) {
      setTimeout(function () {
        var whileMounted = document.querySelectorAll('.searchable-select__menu').length;
        // 模擬「下拉展開時切換頁面／關掉 Modal」：元件所在的子樹被整批換掉，
        // 元件本身沒有機會收到 blur 或 click，浮動選單容易變成孤兒留在畫面上。
        document.getElementById('probe-host').remove();
        setTimeout(function () {
          resolve({
            whileMounted: whileMounted,
            orphan: document.querySelectorAll('.searchable-select__menu').length
          });
        }, 600);
      }, 120);
    });
  })()`);
  assertEq(ssOrphan.whileMounted, 1, '展開時畫面上有一個浮動選單');
  assertEq(ssOrphan.orphan, 0, '元件被移除後浮動選單不留在畫面上');

  console.log('\n18. 單選下拉：浮動選單對齊整個欄位控制項，不是內層的 input');
  const ssAlign = await evaluateAsync(`(function () {
    window.__ssOpen();
    return new Promise(function (resolve) {
      setTimeout(function () {
        var root = document.querySelector('#probe-host .searchable-select');
        var menu = document.querySelector('.searchable-select__menu');
        var r = root.getBoundingClientRect();
        var m = menu.getBoundingClientRect();
        resolve({
          leftGap: Math.round(m.left - r.left),
          widthGap: Math.round(m.width - r.width)
        });
      }, 200);
    });
  })()`);
  assertEq(ssAlign.leftGap, 0, '選單左緣對齊欄位左緣');
  assertEq(ssAlign.widthGap, 0, '選單寬度與欄位同寬');

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
