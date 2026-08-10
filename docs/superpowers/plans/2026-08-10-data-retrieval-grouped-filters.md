# 資料調閱層級篩選分組 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓資料調閱的門市選單依客戶分組、行政區選單依縣市分組，並把勾選語意從「名稱」升級為「上層 + 下層」配對，消除跨客戶同名門市、跨縣市同名行政區的混淆。

**Architecture:** 分三層改。核心的 `IESS.MultiSelect` 新增「群組選項」形態（向下相容既有的字串陣列呼叫端）；`DataRetrievalUtils` 改用 `父\u0001子` 複合鍵產生群組選項並據以比對；`DataRetrieval` 只換 options 來源。

**Tech Stack:** 原生 ES5 風格瀏覽器 IIFE 模組（無 build step，`index.html` 依序載入 script）、自製 `IESS.h` / `stateful` 迷你 render 層、Tailwind CDN + `styles.css`、驗證腳本為 Node ESM（`node:vm` 載入 IIFE 做邏輯層測試、CDP 驅動 headless Chrome 做 DOM 測試）。

## Global Constraints

- 專案沒有測試框架，也沒有 `package.json` script。測試一律是可直接執行的 Node 腳本：`node scripts/<name>.mjs`，自行累計 `passed/failed` 並在失敗時 `process.exit(1)`。
- 所有 `src/` 下的檔案都是瀏覽器直接載入的 IIFE，**不可使用 ESM `import`/`export`**，一律 `var`/`function`、掛到 `window`。
- 新檔案必須加進 `index.html` 的 script 清單才會被載入；本計畫不新增 `src/` 檔案，故不需要改 `index.html`。
- 複合鍵分隔字元固定為 `'\u0001'`，只在 `data-retrieval-utils.js` 內定義一次（常數 `KEY_SEP`）。
- 註解一律繁體中文，說明「為什麼」而非「做什麼」，與現有檔案風格一致。
- CDP 驗證腳本需要 Chrome：`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`，可用 `CHROME_PATH` 覆寫。若環境無 Chrome，腳本以 exit code 2 結束，此時視為「無法驗證」而非通過，須回報。

---

### Task 1: MultiSelect 支援群組選項

**Files:**
- Modify: `src/core/multi-select.js`
- Modify: `styles.css:806`（在 `.multi-select__empty` 之前插入 `.multi-select__group`）
- Test: `scripts/verify-multi-select-groups-ui.mjs`（新建）

**Interfaces:**
- Consumes: 既有 `IESS.MultiSelect({ id, options, value, onChange, placeholder, disabled, className })`
- Produces: `options` 新增群組形態
  ```js
  options: [{ group: '屈臣氏', options: [{ value: '屈臣氏\u0001大安忠孝店', label: '大安忠孝店', chipLabel: '屈臣氏 · 大安忠孝店' }] }]
  ```
  `value` prop 仍是 `string[]`，內容為 option 的 `value`；`onChange(next)` 收到的也是 `value` 陣列。既有的字串陣列形態行為完全不變。

- [ ] **Step 1: 寫失敗測試**

新建 `scripts/verify-multi-select-groups-ui.mjs`。CDP 連線樣板直接沿用 `scripts/verify-data-retrieval-multi-filter-ui.mjs` 第 1–83 行（shebang、`CHROME`/`PORT`、`pass`/`fail`/`assertEq`/`assertTrue`、`spawn`、`send`/`evaluate`/`evaluateAsync`、`ws.onmessage` 那一整段），只把 `--user-data-dir` 改成 `/tmp/iess-ms-group-profile`、`CDP_PORT` 預設改成 `9336`（避免與既有腳本搶埠）。以下是該樣板之後的主體：

```js
const MOUNT = `
  window.__groups = [
    { group: '甲客戶', options: [
      { value: '甲客戶\\u0001甲一店', label: '甲一店', chipLabel: '甲客戶 · 甲一店' },
      { value: '甲客戶\\u0001甲二店', label: '甲二店', chipLabel: '甲客戶 · 甲二店' }
    ] },
    { group: '乙客戶', options: [
      { value: '乙客戶\\u0001甲一店', label: '甲一店', chipLabel: '乙客戶 · 甲一店' }
    ] },
    { group: '丙客戶', options: [] }
  ];
  window.__selected = [];
  window.__mount = function (options) {
    var host = document.getElementById('ms-host');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'ms-host';
    document.body.appendChild(host);
    window.__selected = [];
    host.appendChild(IESS.MultiSelect({
      id: 'ms-test',
      options: options,
      value: window.__selected,
      onChange: function (next) {
        window.__selected = next;
        window.__mount(options);
      },
      placeholder: '全部'
    }));
    return host;
  };
`;

try {
  // ...（樣板的 targets 探測 / WebSocket 連線 / Runtime.enable / Page.navigate / sleep(4000) 沿用）

  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');
  await evaluate(MOUNT + "'ok'");

  console.log('\n1. 群組標題渲染且不可點選');
  const menu = await evaluateAsync(`(function () {
    var host = window.__mount(window.__groups);
    host.querySelector('.multi-select__control').click();
    return new Promise(function (resolve) {
      setTimeout(function () {
        var menuEl = document.querySelector('.multi-select__menu');
        resolve({
          groups: Array.prototype.map.call(
            menuEl.querySelectorAll('.multi-select__group'),
            function (g) { return g.textContent.trim(); }),
          groupButtons: menuEl.querySelectorAll('.multi-select__group button').length,
          options: Array.prototype.map.call(
            menuEl.querySelectorAll('.multi-select__option'),
            function (o) { return o.textContent.trim(); })
        });
      }, 50);
    });
  })()`);
  assertJson(menu.groups, ['甲客戶', '乙客戶'], '只渲染有選項的群組標題（丙客戶為空群組，不渲染）');
  assertEq(menu.groupButtons, 0, '群組標題內沒有 button，無法被點選');
  assertJson(menu.options, ['甲一店', '甲二店', '甲一店'], '選項顯示 label，同名門市各自出現一次');

  console.log('\n2. 勾選同名選項互不影響，chip 顯示 chipLabel');
  const chips = await evaluateAsync(`(function () {
    var host = window.__mount(window.__groups);
    host.querySelector('.multi-select__control').click();
    return new Promise(function (resolve) {
      setTimeout(function () {
        // 索引 0 = 甲客戶/甲一店（索引 2 是乙客戶底下的同名門市，此處刻意只點索引 0，
        // 用來確認勾選不會連動到另一個群組的同名選項）
        document.querySelectorAll('.multi-select__menu .multi-select__option')[0].click();
        setTimeout(function () {
          var host2 = document.getElementById('ms-host');
          resolve({
            selected: window.__selected,
            chips: Array.prototype.map.call(
              host2.querySelectorAll('.multi-select__chip'),
              function (c) { return c.textContent.replace('×', '').trim(); })
          });
        }, 80);
      }, 50);
    });
  })()`);
  assertJson(chips.selected, ['甲客戶\u0001甲一店'], '回傳的是複合 value，不是 label');
  assertJson(chips.chips, ['甲客戶 · 甲一店'], 'chip 顯示 chipLabel');

  console.log('\n3. 舊的字串陣列形態不受影響');
  const flat = await evaluateAsync(`(function () {
    var host = window.__mount(['維修', '保養']);
    host.querySelector('.multi-select__control').click();
    return new Promise(function (resolve) {
      setTimeout(function () {
        var menuEl = document.querySelector('.multi-select__menu');
        var texts = Array.prototype.map.call(
          menuEl.querySelectorAll('.multi-select__option'),
          function (o) { return o.textContent.trim(); });
        menuEl.querySelectorAll('.multi-select__option')[1].click();
        setTimeout(function () {
          resolve({
            options: texts,
            groups: menuEl.querySelectorAll('.multi-select__group').length,
            selected: window.__selected
          });
        }, 80);
      }, 50);
    });
  })()`);
  assertJson(flat.options, ['維修', '保養'], '字串陣列照舊渲染');
  assertEq(flat.groups, 0, '字串陣列不產生群組標題');
  assertJson(flat.selected, ['保養'], '字串陣列的選取值仍是字串本身');

  console.log('\n4. 全空群組顯示「無可選項目」');
  const empty = await evaluateAsync(`(function () {
    var host = window.__mount([{ group: '甲客戶', options: [] }]);
    host.querySelector('.multi-select__control').click();
    return new Promise(function (resolve) {
      setTimeout(function () {
        var menuEl = document.querySelector('.multi-select__menu');
        resolve({
          empty: menuEl.querySelectorAll('.multi-select__empty').length,
          groups: menuEl.querySelectorAll('.multi-select__group').length
        });
      }, 50);
    });
  })()`);
  assertEq(empty.empty, 1, '所有群組皆空時顯示「無可選項目」');
  assertEq(empty.groups, 0, '所有群組皆空時不渲染任何群組標題');

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
```

樣板裡沒有 `assertJson`，補上（與 `verify-data-retrieval-multi-filter.mjs` 同款）：

```js
function assertJson(actual, expected, name) {
  assertEq(JSON.stringify(actual), JSON.stringify(expected), name);
}
```

- [ ] **Step 2: 執行測試，確認失敗**

Run: `node scripts/verify-multi-select-groups-ui.mjs`
Expected: FAIL — 群組標題斷言得到 `[]`（目前元件把群組物件當字串塞進選項，`.multi-select__group` 不存在），chip 斷言得到 `[object Object]` 之類的字串。

- [ ] **Step 3: 實作 — `src/core/multi-select.js`**

在 IIFE 頂部（`autoIdSeq` 宣告之後）加入正規化函式：

```js
  // options 支援兩種形態：
  //   A. string[]（既有呼叫端）
  //   B. [{ group, options: [{ value, label, chipLabel }] }]（依上層分組，如客戶→門市）
  // 內部一律轉成形態 B 的結構處理，形態 A 視為單一個 group 為 null 的群組。
  function normalizeOption(opt) {
    if (typeof opt === 'string') {
      return { value: opt, label: opt, chipLabel: opt };
    }
    var value = String(opt.value);
    var label = opt.label != null ? opt.label : value;
    return {
      value: value,
      label: label,
      chipLabel: opt.chipLabel != null ? opt.chipLabel : label
    };
  }

  function normalizeGroups(options) {
    var list = options || [];
    var grouped = list.length && list[0] && typeof list[0] === 'object'
      && Array.isArray(list[0].options);
    if (!grouped) {
      return [{ group: null, options: list.map(normalizeOption) }];
    }
    return list.map(function (g) {
      return { group: g.group, options: (g.options || []).map(normalizeOption) };
    });
  }
```

在 `stateful` 回呼內，把 `var options = props.options || [];` 換成：

```js
      var groups = normalizeGroups(props.options);
      var flatOptions = groups.reduce(function (acc, g) { return acc.concat(g.options); }, []);
      var chipLabels = {};
      flatOptions.forEach(function (o) { chipLabels[o.value] = o.chipLabel; });
      // 對照不到時退回顯示 value 原文：資料來源變動時 chip 不會變成空白
      function chipLabelOf(v) { return chipLabels[v] != null ? chipLabels[v] : v; }
```

`buildMenu` 內，把「`if (!options.length)` 顯示 empty」的判斷改用 `flatOptions`，並把 `options.forEach(...)` 整段換成群組迴圈：

```js
        if (!flatOptions.length) {
          var empty = document.createElement('li');
          empty.className = 'multi-select__empty';
          empty.textContent = '無可選項目';
          menuEl.appendChild(empty);
          return;
        }

        groups.forEach(function (group) {
          if (!group.options.length) return;
          if (group.group != null) {
            var head = document.createElement('li');
            head.className = 'multi-select__group';
            head.setAttribute('role', 'presentation');
            head.textContent = group.group;
            menuEl.appendChild(head);
          }
          group.options.forEach(function (opt) {
            var checked = value.indexOf(opt.value) !== -1;
            var item = document.createElement('li');
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('role', 'option');
            btn.setAttribute('aria-selected', checked ? 'true' : 'false');
            btn.className = 'multi-select__option' + (checked ? ' multi-select__option--selected' : '');

            var box = document.createElement('span');
            box.className = 'multi-select__checkbox' + (checked ? ' multi-select__checkbox--checked' : '');
            box.textContent = checked ? '✓' : '';
            btn.appendChild(box);
            btn.appendChild(document.createTextNode(opt.label));

            // 用 click 而非 mousedown：click 才會被鍵盤 Enter/Space 觸發（button 原生行為），
            // 讓鍵盤使用者也能選取選項。改用 click 不會被 outside 監聽器誤判成「點外面」而先關閉選單，
            // 因為 outside 監聽器（mousedown 階段）已用 menuEl.contains(e.target) 排除選單內部。
            btn.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              toggleOption(opt.value);
            });

            item.appendChild(btn);
            menuEl.appendChild(item);
          });
        });
```

chips 區塊改用 label 顯示、value 做移除：

```js
              ? value.map(function (v) {
                  var text = chipLabelOf(v);
                  return h('span', { className: 'multi-select__chip' },
                    text,
                    disabled ? null : h('button', {
                      type: 'button',
                      className: 'multi-select__chip-remove',
                      'aria-label': '移除 ' + text,
                      'data-no-tooltip': true,
                      onMouseDown: function (e) { e.preventDefault(); e.stopPropagation(); },
                      onClick: function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        removeOption(v);
                      }
                    }, '×')
                  );
                })
```

`toggleOption` / `removeOption` 本體不用改（它們處理的一直都是 value 字串）。同時更新檔頭註解，把 `options` 的兩種形態寫進去。

- [ ] **Step 4: 實作 — `styles.css`**

在 `.multi-select__empty` 規則之前插入：

```css
.multi-select__group {
  padding: 0.375rem 0.75rem;
  background: #f9fafb;
  color: #6b7280;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.025em;
}
```

- [ ] **Step 5: 執行測試，確認通過**

Run: `node scripts/verify-multi-select-groups-ui.mjs`
Expected: PASS，`failed` 為 0。

- [ ] **Step 6: 回歸既有 MultiSelect 使用者**

Run: `node scripts/verify-data-retrieval-multi-filter-ui.mjs`
Expected: PASS（此時 DataRetrieval 仍傳字串陣列，行為應完全不變）。

- [ ] **Step 7: Commit**

```bash
git add src/core/multi-select.js styles.css scripts/verify-multi-select-groups-ui.mjs
git commit -m "feat: support grouped options in MultiSelect"
```

---

### Task 2: DataRetrievalUtils 改用複合鍵與群組選項

**Files:**
- Modify: `src/features/reports/data-retrieval-utils.js`
- Test: `scripts/verify-data-retrieval-multi-filter.mjs`

**Interfaces:**
- Consumes: Task 1 的群組 options 結構（`{ group, options: [{ value, label, chipLabel }] }`）
- Produces（掛在 `window.DataRetrievalUtils`）：
  - `makeKey(parent, child) -> string`
  - `parseKey(key) -> { parent, child }`
  - `getStoreGroupsForCustomers(stores, customerNames) -> [{ group, options }]`
  - `getDistrictGroupsForCities(cityNames) -> [{ group, options }]`
  - `filterRepairCases` 的 `filters.store`、`filterMaintenanceCases` 的 `filters.district` 改吃複合鍵
  - **移除** `getStoreOptionsForCustomers`、`getDistrictOptionsForCities`（唯一呼叫端是 `data-retrieval.js`，Task 3 會接上）

- [ ] **Step 1: 寫失敗測試 — 擴充既有 fixture**

在 `scripts/verify-data-retrieval-multi-filter.mjs` 的 `REPAIR_CASES` 陣列末尾加入一筆同名門市案件：

```js
  // 與 R1 同門市名稱、不同客戶：用來檢驗門市篩選是「客戶+門市」配對而非只比門市名。
  { id: 'R5', repairDate: '2026-08-05', workCategory: '一般叫修', repairItem: '漏水',
    repairReason: '排水堵塞', customerName: '乙客戶', storeName: '甲一店',
    assignees: ['B組'], serviceLevel: 'B 進階' },
```

`testEmptyMeansAll` 的期望值同步改成 `['R1', 'R2', 'R3', 'R5']`；`testSingleFieldOr` 內 `customer: ['乙客戶']` 的期望值改成 `['R2', 'R5']`、`customer: ['甲客戶','乙客戶']` 改成 `['R1', 'R2', 'R5']`。

在 `testProjectAndMaintenance` 的 `stores` 陣列末尾加入：

```js
    // 與 S1 同行政區名稱、不同縣市：用來檢驗行政區篩選是「縣市+行政區」配對。
    { id: 'S3', customerName: '丙客戶', storeName: '丙一店', companyCity: '基隆市', companyDistrict: '中正區' },
```

`maintenanceCases` 陣列末尾加入：

```js
    { id: 'M3', customerName: '丙客戶', storeName: '丙一店', assignee: 'C組',
      serviceLevel: 'C 標準', planDate: '2026-08-03' },
```

並把該函式內 `district: ['板橋區']` 那則斷言改成複合鍵版本（`DRU` 已在函式參數中）：

```js
  assertJson(
    ids(DRU.filterMaintenanceCases(maintenanceCases, stores, emptyFilters({
      district: [DRU.makeKey('新北市', '板橋區')]
    }))),
    ['M2'],
    '行政區篩選經由門市地址 fallback 命中（區辨式斷言，鎖定 store 查回的 loc.city + loc.district）'
  );
  assertJson(
    ids(DRU.filterMaintenanceCases(maintenanceCases, stores, emptyFilters({
      district: [DRU.makeKey('台北市', '中正區')]
    }))),
    ['M1'],
    '跨縣市同名行政區互不汙染：台北市中正區不得撈到基隆市中正區的 M3'
  );
```

- [ ] **Step 2: 寫失敗測試 — 改寫 `testCascadeOptions`**

把整個 `testCascadeOptions` 函式換成：

```js
function groupNames(groups) {
  return groups.map(function (g) { return g.group; });
}

function labelsOf(groups, name) {
  var g = groups.find(function (x) { return x.group === name; });
  return g ? g.options.map(function (o) { return o.label; }) : null;
}

function testStoreGroups(DRU) {
  console.log('\n6. 門市選項依客戶分組');
  const all = DRU.getStoreGroupsForCustomers(STORES, []);
  assertJson(
    groupNames(all).slice().sort(),
    ['丙客戶', '乙客戶', '甲客戶'].slice().sort(),
    '未選客戶時涵蓋所有客戶（含只有撤店門市以外情形）'
  );
  assertJson(
    groupNames(all),
    ['甲客戶', '乙客戶', '丙客戶'].sort(function (a, b) { return a.localeCompare(b, 'zh-Hant'); }),
    '群組依客戶名稱 zh-Hant 排序'
  );
  assertJson(labelsOf(all, '甲客戶'), ['甲一店', '甲二店'], '甲客戶群組內的門市');
  assertJson(
    labelsOf(all, '乙客戶'), ['乙一店', '甲一店'],
    '乙客戶底下的「甲一店」獨立存在（區辨式斷言：若仍以門市名去重跨客戶合併，此店會被甲客戶的同名門市吃掉）'
  );
  assertJson(
    labelsOf(all, '丙客戶'), ['丙二店', '丁一店'],
    '群組內營業中門市排在撤店門市之前（純 zh-Hant 排序會把撤店的丁一店排到丙二店之前）'
  );

  const one = DRU.getStoreGroupsForCustomers(STORES, ['甲客戶']);
  assertJson(groupNames(one), ['甲客戶'], '選一個客戶時只回傳該客戶群組');

  const optA = all.find(function (g) { return g.group === '甲客戶'; }).options[0];
  assertEq(optA.value, DRU.makeKey('甲客戶', '甲一店'), '選項 value 是「客戶+門市」複合鍵');
  assertEq(optA.chipLabel, '甲客戶 · 甲一店', 'chipLabel 帶出客戶名稱');
  assertJson(DRU.parseKey(optA.value), { parent: '甲客戶', child: '甲一店' }, 'parseKey 還原複合鍵');
}

function testStoreFilterByPair(DRU) {
  console.log('\n7. 門市篩選比對「客戶+門市」配對');
  assertJson(
    ids(DRU.filterRepairCases(REPAIR_CASES, emptyFilters({
      store: [DRU.makeKey('甲客戶', '甲一店')]
    }))),
    ['R1'],
    '甲客戶的甲一店不得撈到乙客戶的同名門市 R5'
  );
  assertJson(
    ids(DRU.filterRepairCases(REPAIR_CASES, emptyFilters({
      store: [DRU.makeKey('乙客戶', '甲一店')]
    }))),
    ['R5'],
    '乙客戶的甲一店只回傳 R5'
  );
  assertJson(
    ids(DRU.filterRepairCases(REPAIR_CASES, emptyFilters({
      store: [DRU.makeKey('甲客戶', '甲一店'), DRU.makeKey('乙客戶', '甲一店')]
    }))),
    ['R1', 'R5'],
    '多選門市取聯集'
  );
  assertJson(
    ids(DRU.filterRepairCases(REPAIR_CASES, emptyFilters({ store: [] }))),
    ['R1', 'R2', 'R3', 'R5'],
    '門市空陣列仍代表不篩選'
  );
}

function testDistrictGroups(DRU, SU, sandbox) {
  console.log('\n8. 行政區選項依縣市分組');
  const cities = sandbox.TAIWAN_CITY_OPTIONS;
  const all = DRU.getDistrictGroupsForCities([]);
  assertEq(groupNames(all).length, cities.length, '未選縣市時涵蓋所有縣市');
  assertJson(groupNames(all), cities, '群組順序沿用 TAIWAN_CITY_OPTIONS');

  const two = DRU.getDistrictGroupsForCities(['台南市', '台中市']);
  assertJson(
    groupNames(two),
    cities.filter(function (c) { return c === '台中市' || c === '台南市'; }),
    '選取縣市的群組順序仍沿用 TAIWAN_CITY_OPTIONS（不隨勾選順序跑掉）'
  );
  const taichung = SU.getDistrictsForCity('台中市');
  assertJson(labelsOf(two, '台中市'), taichung, '群組內行政區沿用 StoreUtils.getDistrictsForCity 的順序');

  const overlap = taichung.filter(function (d) {
    return SU.getDistrictsForCity('台南市').indexOf(d) !== -1;
  });
  assertTrue(overlap.length > 0, '台中市與台南市有同名行政區（測試前提）', overlap.join('、'));
  const values = two.reduce(function (acc, g) {
    return acc.concat(g.options.map(function (o) { return o.value; }));
  }, []);
  assertEq(new Set(values).size, values.length, '同名行政區因帶縣市前綴而不重複');
  assertEq(
    two.find(function (g) { return g.group === '台中市'; }).options[0].value,
    DRU.makeKey('台中市', taichung[0]),
    '選項 value 是「縣市+行政區」複合鍵'
  );
}
```

`main()` 改成：

```js
function main() {
  const { DRU, SU, sandbox } = loadModules();
  testEmptyMeansAll(DRU);
  testSingleFieldOr(DRU);
  testFieldsAreAnded(DRU);
  testRepairAssigneeMultiValue(DRU);
  testProjectAndMaintenance(DRU);
  testStoreGroups(DRU);
  testStoreFilterByPair(DRU);
  testDistrictGroups(DRU, SU, sandbox);
  // ...（結尾統計不變）
}
```

`STORES` fixture 不需要改動——它已經同時具備跨客戶同名門市（S1 甲客戶/甲一店 與 S4 乙客戶/甲一店）與撤店門市（S5）。順手把 `STORES` 上方那段講「跨客戶合併聯集」的舊註解換成：

```js
  // S4 與 S1 同名不同客戶，S5/S6 用來檢驗群組內「營業在前、撤店在後」
  // （'丁一店' < '丙二店'，純 zh-Hant 排序會把撤店的丁一店排到營業的丙二店之前）。
```

- [ ] **Step 3: 執行測試，確認失敗**

Run: `node scripts/verify-data-retrieval-multi-filter.mjs`
Expected: FAIL — `DRU.makeKey is not a function` / `DRU.getStoreGroupsForCustomers is not a function`。

- [ ] **Step 4: 實作 — `src/features/reports/data-retrieval-utils.js`**

在 `CASE_TYPES` 下方加入複合鍵工具：

```js
  // 門市名稱會跨客戶重複（中山店同時屬於星巴克、全家、統一超商），行政區也會跨縣市重複
  // （中正區見於台北市、基隆市、台中市）。篩選值改用「上層\u0001下層」複合鍵，
  // 分隔字元選 \u0001 是因為它不可能出現在任何客戶、門市、縣市、行政區名稱裡。
  var KEY_SEP = '\u0001';

  function makeKey(parent, child) {
    return String(parent == null ? '' : parent) + KEY_SEP + String(child == null ? '' : child);
  }

  function parseKey(key) {
    var text = String(key == null ? '' : key);
    var idx = text.indexOf(KEY_SEP);
    if (idx === -1) return { parent: '', child: text };
    return { parent: text.slice(0, idx), child: text.slice(idx + 1) };
  }
```

`filterRepairCases` 內的門市比對改成：

```js
      if (!matches(filters.store, makeKey(c.customerName, c.storeName))) return false;
```

`filterMaintenanceCases` 內的行政區比對改成（`loc` 已在函式開頭算出）：

```js
      if (!matches(filters.district, makeKey(loc.city, loc.district))) return false;
```

把整個 `getStoreOptionsForCustomers` 函式（含其上方那段長註解）換成：

```js
  // 門市選項依客戶分組：每個客戶一個群組，選項值為「客戶\u0001門市」複合鍵，
  // 讓跨客戶同名門市成為彼此獨立的選項。未選客戶時列出所有客戶的群組。
  // 群組內沿用 StoreUtils 的慣例：營業中門市在前、撤店門市在後，各自再依 zh-Hant 排序。
  function getStoreGroupsForCustomers(stores, customerNames) {
    var list = stores || [];
    var scope;
    if (customerNames && customerNames.length) {
      scope = customerNames.slice();
    } else {
      scope = list.map(function (s) { return s.customerName; });
    }
    var seenCustomer = {};
    scope = scope.filter(function (name) {
      if (!name || seenCustomer[name]) return false;
      seenCustomer[name] = true;
      return true;
    });
    sortZhHant(scope);

    return scope.map(function (customerName) {
      // 同一客戶下可能有多筆同名門市紀錄；任一筆營業中即視為營業中。
      var activeByName = {};
      list.forEach(function (s) {
        if (s.customerName !== customerName || !s.storeName) return;
        if (activeByName[s.storeName] !== true) {
          activeByName[s.storeName] = StoreUtils.isActiveStore(s);
        }
      });
      var names = Object.keys(activeByName).sort(function (a, b) {
        if (activeByName[a] !== activeByName[b]) return activeByName[a] ? -1 : 1;
        return a.localeCompare(b, 'zh-Hant');
      });
      return {
        group: customerName,
        options: names.map(function (name) {
          return {
            value: makeKey(customerName, name),
            label: name,
            chipLabel: customerName + ' · ' + name
          };
        })
      };
    }).filter(function (g) { return g.options.length > 0; });
  }
```

把整個 `getDistrictOptionsForCities` 函式換成：

```js
  // 行政區選項依縣市分組，選項值為「縣市\u0001行政區」複合鍵。
  // 未選縣市時列出所有縣市，與門市的規則一致；群組順序一律沿用 TAIWAN_CITY_OPTIONS。
  function getDistrictGroupsForCities(cityNames) {
    var selected = cityNames || [];
    var cities = selected.length
      ? TAIWAN_CITY_OPTIONS.filter(function (c) { return selected.indexOf(c) !== -1; })
      : TAIWAN_CITY_OPTIONS.slice();
    var groups = [];
    cities.forEach(function (city) {
      var districts = StoreUtils.getDistrictsForCity(city) || [];
      if (!districts.length) return;
      groups.push({
        group: city,
        options: districts.map(function (d) {
          return { value: makeKey(city, d), label: d, chipLabel: city + ' · ' + d };
        })
      });
    });
    return groups;
  }
```

更新 `window.DataRetrievalUtils` 匯出：移除 `getStoreOptionsForCustomers`、`getDistrictOptionsForCities`，加入 `makeKey`、`parseKey`、`getStoreGroupsForCustomers`、`getDistrictGroupsForCities`。

- [ ] **Step 5: 執行測試，確認通過**

Run: `node scripts/verify-data-retrieval-multi-filter.mjs`
Expected: PASS，`failed` 為 0。

- [ ] **Step 6: Commit**

```bash
git add src/features/reports/data-retrieval-utils.js scripts/verify-data-retrieval-multi-filter.mjs
git commit -m "feat: key data-retrieval store/district filters by parent pair"
```

---

### Task 3: DataRetrieval 接上分組選項

**Files:**
- Modify: `src/features/reports/data-retrieval.js:139-141`（`storeOptions` / `districtOptions` 兩行）
- Test: `scripts/verify-data-retrieval-multi-filter-ui.mjs`

**Interfaces:**
- Consumes: Task 2 的 `DataRetrievalUtils.getStoreGroupsForCustomers` / `getDistrictGroupsForCities`，以及 Task 1 的 MultiSelect 群組 options
- Produces: 無新 API；`維修` 分頁門市欄位與 `保養` 分頁行政區欄位改為分組呈現

- [ ] **Step 1: 寫失敗測試**

在 `scripts/verify-data-retrieval-multi-filter-ui.mjs` 的 `MOUNT` 常數中，把 `window.__stores` 換成含跨客戶同名門市的版本：

```js
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
```

把既有的「3. 客戶改變時清空門市，且門市選項為聯集」整段測試改寫成下面這段（標題與斷言都換掉，選單開啟時額外收集群組標題與 chip 文字）：

```js
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
    // index 3 = 客戶名稱, index 4 = 門市名稱
    return openAndClick(3, 0)                            // 選甲客戶
      .then(function () { return openAndClick(4, 0); })  // 選甲客戶底下第一間門市
      .then(function () {
        var storeChips = Array.prototype.map.call(
          ms(4).querySelectorAll('.multi-select__chip'),
          function (c) { return c.textContent.replace('×', '').trim(); });
        return openAndClick(3, 1).then(function () {     // 再加選乙客戶 -> 應清空門市
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
  assertJson(cascade.storeGroups, ['甲客戶', '乙客戶'], '門市選單依客戶分組');
  assertJson(
    cascade.storeOptions, ['甲一店', '甲二店', '甲一店', '乙一店'],
    '同名門市在各自客戶群組下各出現一次（區辨式斷言：若仍以門市名去重，第二個甲一店會消失）'
  );
```

注意：`assertJson` 目前不在這支 UI 腳本中，需要補上（放在 `assertTrue` 之後）：

```js
function assertJson(actual, expected, name) {
  assertEq(JSON.stringify(actual), JSON.stringify(expected), name);
}
```

再於「4. 鍵盤切換案件類型…」之前插入保養分頁的行政區斷言：

```js
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
              resolve({
                firstCity: firstCity,
                groups: Array.prototype.map.call(
                  menuEl.querySelectorAll('.multi-select__group'),
                  function (g) { return g.textContent.trim(); })
              });
            }, 50);
          }, 80);
        }, 50);
      }, 50);
    });
  })()`);
  assertJson(districts.groups, [districts.firstCity], '選一個縣市後，行政區選單只有該縣市一個群組');
```

- [ ] **Step 2: 執行測試，確認失敗**

Run: `node scripts/verify-data-retrieval-multi-filter-ui.mjs`
Expected: FAIL — `storeGroups` 得到 `[]`、`storeChipsBefore` 得到 `['甲一店']`（`data-retrieval.js` 仍呼叫已被移除的舊函式，載入時會出現 `DataRetrievalUtils.getStoreOptionsForCustomers is not a function`）。

- [ ] **Step 3: 實作 — `src/features/reports/data-retrieval.js`**

把 `stateful` 回呼開頭這兩行：

```js
      var storeOptions = DataRetrievalUtils.getStoreOptionsForCustomers(stores, filterCustomer);
      var districtOptions = DataRetrievalUtils.getDistrictOptionsForCities(filterCity);
```

改成：

```js
      var storeOptions = DataRetrievalUtils.getStoreGroupsForCustomers(stores, filterCustomer);
      var districtOptions = DataRetrievalUtils.getDistrictGroupsForCities(filterCity);
```

其餘不動：客戶變更清空 `filterStore`、縣市變更清空 `filterDistrict`、切換案件類型全清的行為都保留。

- [ ] **Step 4: 執行測試，確認通過**

Run: `node scripts/verify-data-retrieval-multi-filter-ui.mjs`
Expected: PASS，`failed` 為 0。

- [ ] **Step 5: 全套回歸**

Run:
```bash
node scripts/verify-data-retrieval-multi-filter.mjs
node scripts/verify-multi-select-groups-ui.mjs
node scripts/verify-data-retrieval-multi-filter-ui.mjs
```
Expected: 三支皆 PASS。

- [ ] **Step 6: Commit**

```bash
git add src/features/reports/data-retrieval.js scripts/verify-data-retrieval-multi-filter-ui.mjs
git commit -m "feat: group data-retrieval store and district filters by parent"
```

---

## 自我檢查對照（spec → task）

| Spec 項目 | 對應 |
| --- | --- |
| MultiSelect 群組能力、chipLabel、空群組、`li.multi-select__group` 樣式 | Task 1 |
| 複合鍵 `makeKey`/`parseKey` | Task 2 Step 4 |
| `getStoreGroupsForCustomers`（未選客戶列全部、群組排序、營業在前撤店在後、同客戶同名去重） | Task 2 Step 2/4 |
| `getDistrictGroupsForCities`（未選縣市列全部、順序沿用 TAIWAN_CITY_OPTIONS） | Task 2 Step 2/4 |
| `filterRepairCases` / `filterMaintenanceCases` 改比對複合鍵 | Task 2 Step 1/4 |
| `data-retrieval.js` 換 options 來源、清空行為不變 | Task 3 |
| 撤店門市不加標記 | Task 2（`label` 只有門市名，無附加文字） |
| 不改工程分頁、不動 `StoreUtils` API | 三個 Task 都未觸及 |
