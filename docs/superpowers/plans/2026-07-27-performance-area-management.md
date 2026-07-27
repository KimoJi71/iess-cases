# 系統權限 — 績效區域管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在系統權限下新增「績效區域管理」獨立主檔 CRUD（列表／新增／編輯／刪除），並抽出共用 `DistrictTreePicker` 供指派人員與績效區域表單使用；績效區域間行政區互斥。

**Architecture:** 沿用 list／add／edit 全頁表單模式。新建 `DistrictTreePicker`（純 VDOM，展開狀態由父層持有，避免 IESS 每次 `h(Comp)` 重掛導致展開重置）、`PerformanceAreaUtils`、list／form；store 陣列 `performanceAreas`；經 sidebar／options／seed／app.js／index.html 註冊。不連動績效報表或指派人員 `districts` 資料。

**Tech Stack:** Vanilla JS IIFE + `IESS.h` / `stateful` / `useDragScroll` / `createListPagination`、Tailwind CDN、既有 `PageHeader`、`app-modal-overlay`、`AccountUtils.formatDistricts`、`TAIWAN_CITY_DISTRICTS`。

**驗證方式:** 本專案無自動測試；各 task 以瀏覽器手動驗收。不自動 commit（除非使用者要求）。

## Global Constraints

- 獨立主檔：不接到績效報表、指派人員負責區域、`PERFORMANCE_*`
- 行政區選項僅來自 `TAIWAN_CITY_DISTRICTS`（不區分客戶／店家名稱）
- 同一行政區字串不可同時屬於多個績效區域；互斥不套用到指派人員
- 抽出 `DistrictTreePicker` 後，指派人員表單行為須與重構前一致（可重疊、無 disabled）
- 資料為記憶體 store，與其他系統權限主檔相同

---

## File map

| 檔案 | 職責 |
|------|------|
| `src/features/permissions/district-tree-picker.js` | 縣市樹狀行政區多選（共用） |
| `src/features/permissions/assignee-form.js` | 改為呼叫 `DistrictTreePicker` |
| `src/features/permissions/performance-area-utils.js` | 名稱重複、占用／衝突行政區 |
| `src/features/permissions/performance-area-list.js` | 列表、關鍵字、刪除確認 |
| `src/features/permissions/performance-area-form.js` | 新增／編輯全頁表單 |
| `src/shell/permissions-sidebar.js` | 選單「績效區域管理」 |
| `src/data/options.js` | `PERMISSION_FUNCTIONS`／`PERMISSION_TREE` |
| `src/data/seed.js` | `INITIAL_PERFORMANCE_AREAS` |
| `src/app.js` | store、setter、submenu、routing |
| `index.html` | script 載入順序 |

---

### Task 1: DistrictTreePicker + 重構 assignee-form

**Files:**
- Create: `src/features/permissions/district-tree-picker.js`
- Modify: `src/features/permissions/assignee-form.js`
- Modify: `index.html`（加入 picker script，須在 `assignee-form.js` 之前）

**Interfaces:**
- Produces: `window.DistrictTreePicker(props)` → DOM node
- Props:
  - `selectedDistricts: string[]`
  - `onChange: (districts: string[]) => void`
  - `expandedCities: string[]`
  - `onExpandedCitiesChange: (cities: string[]) => void`
  - `disabledDistricts: string[]`（可選，預設 `[]`）
- Consumes: `TAIWAN_CITY_OPTIONS`、`TAIWAN_CITY_DISTRICTS`、`IESS.h`、`IESS.Icons`

**說明:** IESS 的 `h(Comp, props)` 每次呼叫都會重新執行元件函式且不保留巢狀 `stateful`。因此展開縣市狀態必須由父層 closure 持有，經 `expandedCities`／`onExpandedCitiesChange` 傳入。

- [ ] **Step 1: 建立 `district-tree-picker.js`**

```js
/*
 * features/permissions/district-tree-picker.js — 縣市行政區樹狀多選（共用）
 * props: {
 *   selectedDistricts, onChange,
 *   expandedCities, onExpandedCitiesChange,
 *   disabledDistricts?  // 不可勾選的行政區（合併字串）
 * }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons;

  function DistrictTreePicker(props) {
    var districts = props.selectedDistricts || [];
    var onChange = props.onChange;
    var expandedCities = props.expandedCities || [];
    var onExpandedCitiesChange = props.onExpandedCitiesChange;
    var disabledDistricts = props.disabledDistricts || [];

    function isDisabled(area) {
      return disabledDistricts.indexOf(area) !== -1;
    }

    function getCityAreas(city) {
      return TAIWAN_CITY_DISTRICTS[city].map(function (district) {
        return city + district;
      });
    }

    function getEnabledCityAreas(city) {
      return getCityAreas(city).filter(function (area) {
        return !isDisabled(area);
      });
    }

    function setDistricts(next) {
      onChange(next.slice());
    }

    function toggleDistrict(area) {
      if (isDisabled(area)) return;
      var next = districts.slice();
      var idx = next.indexOf(area);
      if (idx === -1) next.push(area);
      else next.splice(idx, 1);
      setDistricts(next);
    }

    function getCityCheckState(city) {
      var areas = getEnabledCityAreas(city);
      if (!areas.length) return 'none';
      var checkedCount = areas.filter(function (area) {
        return districts.indexOf(area) !== -1;
      }).length;
      if (checkedCount === 0) return 'none';
      if (checkedCount === areas.length) return 'all';
      return 'some';
    }

    function toggleCity(city) {
      var areas = getEnabledCityAreas(city);
      var next = districts.slice();
      if (getCityCheckState(city) === 'all') {
        areas.forEach(function (area) {
          var idx = next.indexOf(area);
          if (idx !== -1) next.splice(idx, 1);
        });
      } else {
        areas.forEach(function (area) {
          if (next.indexOf(area) === -1) next.push(area);
        });
      }
      setDistricts(next);
    }

    function toggleCityExpanded(city) {
      var next = expandedCities.slice();
      var idx = next.indexOf(city);
      if (idx === -1) next.push(city);
      else next.splice(idx, 1);
      onExpandedCitiesChange(next);
    }

    function renderCityCheckbox(state, onToggle) {
      return h('input', {
        type: 'checkbox',
        checked: state === 'all',
        ref: function (el) {
          if (el) el.indeterminate = state === 'some';
        },
        onChange: onToggle,
        className: 'h-4 w-4'
      });
    }

    return h('div', {
      className: 'border rounded-md max-h-96 overflow-y-auto divide-y divide-gray-100'
    },
      TAIWAN_CITY_OPTIONS.map(function (city) {
        var isExpanded = expandedCities.indexOf(city) !== -1;
        var cityState = getCityCheckState(city);
        var allAreas = getCityAreas(city);
        var selectedInCity = allAreas.filter(function (area) {
          return districts.indexOf(area) !== -1;
        }).length;
        return h('div', { key: city },
          h('div', {
            className: 'flex items-center gap-2 px-3 py-2.5 bg-gray-50 hover:bg-gray-100'
          },
            h('button', {
              type: 'button',
              onClick: function () { toggleCityExpanded(city); },
              className: 'p-0.5 text-gray-500 hover:text-gray-700 rounded',
              'aria-expanded': isExpanded ? 'true' : 'false',
              'aria-label': isExpanded ? '收合' : '展開',
              'data-no-tooltip': true
            },
              Icons.ChevronDown({
                className: 'h-4 w-4 transition-transform ' + (isExpanded ? '' : '-rotate-90')
              })
            ),
            renderCityCheckbox(cityState, function () { toggleCity(city); }),
            h('button', {
              type: 'button',
              onClick: function () { toggleCityExpanded(city); },
              className: 'font-semibold text-gray-800 text-sm hover:text-blue-700'
            }, city),
            cityState !== 'none' && h('span', {
              className: 'text-xs text-blue-600 ml-auto'
            }, selectedInCity + ' / ' + allAreas.length)
          ),
          isExpanded && h('div', {
            className: 'py-2 pl-10 pr-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1'
          },
            TAIWAN_CITY_DISTRICTS[city].map(function (district) {
              var area = city + district;
              var checked = districts.indexOf(area) !== -1;
              var disabled = isDisabled(area);
              return h('label', {
                key: area,
                className: 'inline-flex items-center gap-2 px-2 py-1.5 rounded text-sm ' +
                  (disabled
                    ? 'text-gray-400 cursor-not-allowed'
                    : (checked ? 'text-blue-700 bg-blue-50/50 cursor-pointer' : 'text-gray-600 hover:bg-gray-50 cursor-pointer'))
              },
                h('input', {
                  type: 'checkbox',
                  checked: checked,
                  disabled: disabled,
                  onChange: function () { toggleDistrict(area); },
                  className: 'h-4 w-4'
                }),
                district
              );
            })
          )
        );
      })
    );
  }

  window.DistrictTreePicker = DistrictTreePicker;
})();
```

- [ ] **Step 2: 在 `index.html` 加入 script**

在 `assignee-utils.js` 之後、`assignee-form.js` 之前加入（建議放在 permissions utils 區塊，與 list／form 區塊皆可，但**必須早於** `assignee-form.js`）：

```html
<script src="src/features/permissions/district-tree-picker.js"></script>
```

建議位置：與其他 permissions 元件一起，在 line ~97 `assignee-list.js` 之前或緊鄰 `assignee-form.js` 之前：

```html
<script src="src/features/permissions/assignee-list.js"></script>
<script src="src/features/permissions/district-tree-picker.js"></script>
<script src="src/features/permissions/assignee-form.js"></script>
```

- [ ] **Step 3: 重構 `assignee-form.js`**

刪除內嵌的 `toggleDistrict`／`getCityAreas`／`getCityCheckState`／`toggleCity`／`toggleCityExpanded`／`renderCityCheckbox`／`renderDistrictTree`。

保留外層：

```js
var districts = (targetCase && targetCase.districts)
  ? targetCase.districts.slice()
  : [];
var expandedCities = TAIWAN_CITY_OPTIONS.filter(function (city) {
  return TAIWAN_CITY_DISTRICTS[city].some(function (district) {
    return districts.indexOf(city + district) !== -1;
  });
});
```

表單中「負責公司區域」區塊改為：

```js
h('div', null,
  h('label', { className: 'block text-sm mb-2' }, '負責公司區域'),
  h('p', { className: 'text-xs text-gray-400 mb-3' },
    '依縣市展開選擇行政區；勾選縣市可一次全選或取消該縣市下所有行政區'),
  h(DistrictTreePicker, {
    selectedDistricts: districts,
    onChange: function (next) { districts = next; rerender(); },
    expandedCities: expandedCities,
    onExpandedCitiesChange: function (next) { expandedCities = next; rerender(); }
  })
)
```

其餘欄位、驗證、儲存邏輯不變。

- [ ] **Step 4: 手動驗收**

開啟 `index.html` → 系統權限 → 指派人員管理 → 編輯「A組」：

1. 已選行政區對應縣市應展開
2. 可展開／收合縣市、勾選行政區、縣市全選／取消
3. 儲存後列表「負責公司區域」顯示正確
4. Console 無 `DistrictTreePicker is not defined` 等錯誤

---

### Task 2: PerformanceAreaUtils

**Files:**
- Create: `src/features/permissions/performance-area-utils.js`
- Modify: `index.html`（載入 utils，建議與其他 `*-utils.js` 同區）

**Interfaces:**
- Produces: `window.PerformanceAreaUtils`：
  - `findDuplicateName(performanceAreas, name, excludeId) -> object|null`
  - `getOccupiedDistricts(performanceAreas, excludeId) -> string[]`
  - `findConflictingDistricts(performanceAreas, districts, excludeId) -> string[]`

- [ ] **Step 1: 建立 utils**

```js
/*
 * features/permissions/performance-area-utils.js — 績效區域工具函式
 */
(function () {
  'use strict';

  function findDuplicateName(performanceAreas, name, excludeId) {
    var trimmed = String(name || '').trim();
    if (!trimmed) return null;
    for (var i = 0; i < (performanceAreas || []).length; i++) {
      var area = performanceAreas[i];
      if (excludeId && area.id === excludeId) continue;
      if (String(area.name || '').trim() === trimmed) return area;
    }
    return null;
  }

  function getOccupiedDistricts(performanceAreas, excludeId) {
    var occupied = [];
    var seen = {};
    (performanceAreas || []).forEach(function (area) {
      if (excludeId && area.id === excludeId) return;
      (area.districts || []).forEach(function (d) {
        if (!d || seen[d]) return;
        seen[d] = true;
        occupied.push(d);
      });
    });
    return occupied;
  }

  function findConflictingDistricts(performanceAreas, districts, excludeId) {
    var occupied = getOccupiedDistricts(performanceAreas, excludeId);
    var occupiedSet = {};
    occupied.forEach(function (d) { occupiedSet[d] = true; });
    var conflicts = [];
    var seen = {};
    (districts || []).forEach(function (d) {
      if (!d || seen[d] || !occupiedSet[d]) return;
      seen[d] = true;
      conflicts.push(d);
    });
    return conflicts;
  }

  window.PerformanceAreaUtils = {
    findDuplicateName: findDuplicateName,
    getOccupiedDistricts: getOccupiedDistricts,
    findConflictingDistricts: findConflictingDistricts
  };
})();
```

- [ ] **Step 2: 在 `index.html` 加入 script**

與其他 utils 並列（`maintenance-allocation-utils.js` 附近）：

```html
<script src="src/features/permissions/performance-area-utils.js"></script>
```

- [ ] **Step 3: 手動驗收（Console）**

開啟頁面後在 DevTools 執行：

```js
var sample = [
  { id: 'PA1', name: '北區', districts: ['台北市信義區'] },
  { id: 'PA2', name: '中區', districts: ['台中市西屯區'] }
];
console.assert(PerformanceAreaUtils.findDuplicateName(sample, '北區', null).id === 'PA1');
console.assert(PerformanceAreaUtils.findDuplicateName(sample, '北區', 'PA1') === null);
console.assert(PerformanceAreaUtils.getOccupiedDistricts(sample, 'PA1').join() === '台中市西屯區');
console.assert(PerformanceAreaUtils.findConflictingDistricts(sample, ['台北市信義區', '高雄市左營區'], 'PA2').join() === '台北市信義區');
console.log('PerformanceAreaUtils OK');
```

Expected: 印出 `PerformanceAreaUtils OK`，無 assert 失敗。

---

### Task 3: 註冊選單、seed、store、路由

**Files:**
- Modify: `src/shell/permissions-sidebar.js`
- Modify: `src/data/options.js`
- Modify: `src/data/seed.js`
- Modify: `src/app.js`

**Interfaces:**
- Produces: submenu `績效區域管理` → default view `performance-area-list`；store `performanceAreas`／`setPerformanceAreas`；`INITIAL_PERFORMANCE_AREAS`

- [ ] **Step 1: Sidebar**

`permissions-sidebar.js` 的 `MENU_ITEMS` 追加 `'績效區域管理'`（建議放在「保養分配」之前或之後，與產品順序一致即可；本計畫放在最後）：

```js
var MENU_ITEMS = [
  '帳號管理',
  '指派人員管理',
  '設備分類管理',
  '處理方式與積分管理',
  '保養分配',
  '績效區域管理'
];
```

- [ ] **Step 2: 權限樹**

`options.js`：

1. `PERMISSION_FUNCTIONS` 陣列末尾追加 `'績效區域管理'`
2. `PERMISSION_TREE` 中 `id: '系統權限'` 的 `children` 追加 `'績效區域管理'`

- [ ] **Step 3: Seed**

在 `seed.js` 的 `INITIAL_MAINTENANCE_ALLOCATIONS` 附近新增（行政區須互不重疊，且存在於 `TAIWAN_CITY_DISTRICTS`）：

```js
const INITIAL_PERFORMANCE_AREAS = [
  {
    id: 'PA1',
    name: '北區',
    districts: ['台北市信義區', '台北市大安區'],
    createdDate: todayDate
  },
  {
    id: 'PA2',
    name: '中區',
    districts: ['台中市西屯區', '台中市北屯區'],
    createdDate: todayDate
  },
  {
    id: 'PA3',
    name: '南區',
    districts: ['高雄市左營區', '高雄市鳳山區'],
    createdDate: todayDate
  }
];
```

- [ ] **Step 4: `app.js` store 與路由**

1. `PERMISSIONS_SUBMENU_DEFAULT_VIEW` 增加：

```js
'績效區域管理': 'performance-area-list'
```

2. store 初始狀態增加：

```js
performanceAreas: INITIAL_PERFORMANCE_AREAS,
```

3. setter（與 `setMaintenanceAllocations` 同層即可）：

```js
var setPerformanceAreas = makeSetter('performanceAreas');
```

4. `renderPermissionsView` 在 `maintenance-allocation` case 之前或之後加入（list／form 元件於 Task 4／5 建立；若尚未建立可先留 case 回傳 null，但建議與 Task 4／5 同一實作波次完成 wiring）：

```js
case 'performance-area-list':
  return h(PerformanceAreaList, {
    performanceAreas: s.performanceAreas,
    setPerformanceAreas: setPerformanceAreas,
    setEditingCase: setEditingCase,
    setView: setView,
    showToast: showToast
  });
case 'performance-area-add':
  return h(PerformanceAreaForm, {
    performanceAreas: s.performanceAreas,
    setPerformanceAreas: setPerformanceAreas,
    setView: setView,
    showToast: showToast
  });
case 'performance-area-edit':
  return h(PerformanceAreaForm, {
    performanceAreas: s.performanceAreas,
    setPerformanceAreas: setPerformanceAreas,
    targetCase: s.editingCase,
    setView: setView,
    showToast: showToast
  });
```

- [ ] **Step 5: 手動驗收（註冊）**

1. 系統權限側邊欄可見「績效區域管理」
2. 點擊後若 list 尚未實作，畫面可能空白／null — 可接受；若已接 Task 4 則應見列表
3. 帳號管理 → 編輯帳號 → 權限樹「系統權限」下可見「績效區域管理」勾選項

---

### Task 4: PerformanceAreaList

**Files:**
- Create: `src/features/permissions/performance-area-list.js`
- Modify: `index.html`（載入 list script）

**Interfaces:**
- Consumes: `PerformanceAreaUtils`（本 task 不直接呼叫也可）、`AccountUtils.formatDistricts`、`IESS.createListPagination`
- Produces: `window.PerformanceAreaList`
- Props: `performanceAreas`、`setPerformanceAreas`、`setEditingCase`、`setView`、`showToast`

- [ ] **Step 1: 建立 list 元件**

對齊 `assignee-list.js`／`device-category-list.js` 模式，完整實作：

```js
/*
 * features/permissions/performance-area-list.js — 績效區域管理：列表
 * props: { performanceAreas, setPerformanceAreas, setEditingCase, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, useDragScroll = IESS.useDragScroll;
  var iconActionBtn = IESS.iconActionBtn;

  function renderEllipsisCell(value, extraClass) {
    var text = value == null || value === '' ? '—' : String(value);
    return h('td', { className: 'p-3 max-w-0 ' + (extraClass || '') },
      h('div', {
        className: 'truncate',
        title: text !== '—' ? text : undefined
      }, text)
    );
  }

  function PerformanceAreaList(props) {
    var performanceAreas = props.performanceAreas;
    var setPerformanceAreas = props.setPerformanceAreas;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;

    var keyword = '';
    var appliedKeyword = '';
    var deleteModal = { show: false, id: null, name: '' };
    var dragProps = useDragScroll();
    var listPagination = IESS.createListPagination();

    function getFilteredAreas() {
      var kw = appliedKeyword.trim().toLowerCase();
      var list = performanceAreas;
      if (kw) {
        list = performanceAreas.filter(function (area) {
          return [
            area.name,
            AccountUtils.formatDistricts(area.districts)
          ].filter(Boolean).some(function (v) {
            return String(v).toLowerCase().includes(kw);
          });
        });
      }
      return list.slice().sort(function (a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
      });
    }

    return stateful(function (rerender) {
      var filteredAreas = getFilteredAreas();
      var pageResult = listPagination.slice(filteredAreas);

      function handleSearch() { appliedKeyword = keyword; listPagination.resetPage(); rerender(); }
      function handleKeyDown(e) { if (e.key === 'Enter') handleSearch(); }

      function handleDelete(id) {
        var target = performanceAreas.find(function (a) { return a.id === id; });
        if (!target) {
          deleteModal = { show: false, id: null, name: '' };
          rerender();
          return;
        }
        setPerformanceAreas(performanceAreas.filter(function (a) { return a.id !== id; }));
        deleteModal = { show: false, id: null, name: '' };
        showToast('績效區域已刪除');
      }

      return h('div', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
        h('div', { className: 'flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4' },
          h('div', { className: 'flex flex-wrap items-end gap-3' },
            h('div', null,
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '關鍵字'),
              h('input', {
                type: 'text',
                value: keyword,
                onChange: function (e) { keyword = e.target.value; rerender(); },
                onKeyDown: handleKeyDown,
                placeholder: '區域名稱 / 行政區',
                className: 'w-72 p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('button', {
              onClick: handleSearch,
              className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md shadow-sm transition-colors'
            }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋')
          ),
          iconActionBtn({
            label: '新增績效區域',
            className: 'flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors shrink-0',
            onClick: function () { setEditingCase(null); setView('performance-area-add'); },
            icon: Icons.Plus({ className: 'h-5 w-5' })
          })
        ),
        h('div', Object.assign({}, dragProps, {
          className: 'overflow-x-auto border rounded-lg cursor-grab active:cursor-grabbing'
        }),
          h('table', { className: 'w-full table-fixed text-left text-sm text-gray-600 select-none' },
            h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
              h('tr', null,
                h('th', { className: 'p-3 font-semibold text-center w-36' }, '操作'),
                h('th', { className: 'p-3 font-semibold w-40' }, '區域名稱'),
                h('th', { className: 'p-3 font-semibold' }, '縣市行政區清單')
              )
            ),
            h('tbody', { className: 'divide-y divide-gray-100' },
              filteredAreas.length === 0
                ? h('tr', null, h('td', { colspan: 3, className: 'p-10 text-center text-gray-400 text-base' }, '無資料'))
                : pageResult.items.map(function (area) {
                    return h('tr', { key: area.id, className: 'hover:bg-blue-50/50 transition-colors' },
                      h('td', { className: 'p-3 whitespace-nowrap' },
                        h('div', { className: 'flex items-center justify-center space-x-2' },
                          h('button', {
                            onClick: function () { setEditingCase(area); setView('performance-area-edit'); },
                            className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                            title: '編輯'
                          }, Icons.Edit({ className: 'h-4 w-4' })),
                          iconActionBtn({
                            label: '刪除',
                            onClick: function () {
                              deleteModal = { show: true, id: area.id, name: area.name };
                              rerender();
                            },
                            className: 'p-1.5 text-red-600 hover:bg-red-100 rounded',
                            icon: Icons.Trash2({ className: 'h-4 w-4' })
                          })
                        )
                      ),
                      renderEllipsisCell(area.name, 'font-medium text-gray-800'),
                      renderEllipsisCell(AccountUtils.formatDistricts(area.districts))
                    );
                  })
            )
          )
        ),
        listPagination.renderBar(pageResult, rerender),
        deleteModal.show && h('div', { className: 'app-modal-overlay' },
          h('div', { className: 'bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4' },
            h('div', { className: 'flex items-center space-x-3 text-red-600 mb-4' },
              Icons.AlertCircle({ className: 'h-6 w-6' }),
              h('h3', { className: 'text-lg font-bold text-gray-800' }, '確認刪除')
            ),
            h('p', { className: 'text-gray-600 mb-6' },
              '確定要刪除績效區域「' + deleteModal.name + '」嗎？'),
            h('div', { className: 'flex justify-end space-x-3' },
              h('button', {
                onClick: function () { deleteModal = { show: false, id: null, name: '' }; rerender(); },
                className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
              }, '取消'),
              h('button', {
                onClick: function () { handleDelete(deleteModal.id); },
                className: 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors'
              }, '確認刪除')
            )
          )
        )
      );
    });
  }

  window.PerformanceAreaList = PerformanceAreaList;
})();
```

- [ ] **Step 2: `index.html` 載入**

放在 permissions list／form 區塊（`process-method-form.js` 附近）：

```html
<script src="src/features/permissions/performance-area-list.js"></script>
```

確認 Task 3 的 `app.js` routing case 已接上。

- [ ] **Step 3: 手動驗收**

1. 進入「績效區域管理」預設顯示北區／中區／南區
2. 關鍵字「信義」→ 搜尋後僅北區（或含信義區者）
3. 刪除出現確認彈窗；確認後列消失並 toast
4. 點新增會切到 add view（Task 5 完成前可能空白）

---

### Task 5: PerformanceAreaForm

**Files:**
- Create: `src/features/permissions/performance-area-form.js`
- Modify: `index.html`（載入 form；須在 list 之後、且 `DistrictTreePicker`／utils 已載入）

**Interfaces:**
- Consumes: `DistrictTreePicker`、`PerformanceAreaUtils`、`PageHeader`、`todayDate`
- Produces: `window.PerformanceAreaForm`
- Props: `performanceAreas`、`setPerformanceAreas`、`targetCase?`、`setView`、`showToast`

- [ ] **Step 1: 建立 form**

```js
/*
 * features/permissions/performance-area-form.js — 績效區域管理：新增/編輯表單
 * props: { performanceAreas, setPerformanceAreas, setView, showToast, targetCase }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  function PerformanceAreaForm(props) {
    var performanceAreas = props.performanceAreas;
    var setPerformanceAreas = props.setPerformanceAreas;
    var targetCase = props.targetCase;
    var setView = props.setView;
    var showToast = props.showToast;
    var isEdit = !!targetCase;

    var formData = {
      name: (targetCase && targetCase.name) || ''
    };
    var districts = (targetCase && targetCase.districts)
      ? targetCase.districts.slice()
      : [];
    var expandedCities = TAIWAN_CITY_OPTIONS.filter(function (city) {
      return TAIWAN_CITY_DISTRICTS[city].some(function (district) {
        return districts.indexOf(city + district) !== -1;
      });
    });

    return stateful(function (rerender) {
      var excludeId = isEdit ? targetCase.id : null;
      var occupiedDistricts = PerformanceAreaUtils.getOccupiedDistricts(
        performanceAreas, excludeId
      );

      function handleChange(e) {
        formData[e.target.name] = e.target.value;
        rerender();
      }

      function handleSubmit(e) {
        e.preventDefault();
        var name = formData.name.trim();
        if (!name) {
          showToast('區域名稱為必填', 'error');
          return;
        }
        if (PerformanceAreaUtils.findDuplicateName(performanceAreas, name, excludeId)) {
          showToast('區域名稱已存在', 'error');
          return;
        }
        if (!districts.length) {
          showToast('請至少選擇一個縣市行政區', 'error');
          return;
        }
        var conflicts = PerformanceAreaUtils.findConflictingDistricts(
          performanceAreas, districts, excludeId
        );
        if (conflicts.length) {
          showToast('以下行政區已被其他績效區域使用：' + conflicts.join('、'), 'error');
          return;
        }

        if (isEdit) {
          setPerformanceAreas(performanceAreas.map(function (area) {
            if (area.id !== targetCase.id) return area;
            return Object.assign({}, area, {
              name: name,
              districts: districts.slice()
            });
          }));
          showToast('績效區域更新成功');
        } else {
          var newRecord = {
            id: 'PA' + Date.now(),
            name: name,
            districts: districts.slice(),
            createdDate: todayDate
          };
          setPerformanceAreas([newRecord].concat(performanceAreas));
          showToast('績效區域新增成功');
        }
        setView('performance-area-list');
      }

      return h('div', {
        className: 'max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative'
      },
        PageHeader({
          title: isEdit ? '編輯績效區域' : '新增績效區域',
          badge: isEdit ? targetCase.name : null,
          onClose: function () { setView('performance-area-list'); },
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
        }),
        h('form', { onSubmit: handleSubmit, className: 'p-6' },
          h('div', { className: 'space-y-6' },
            h('div', null,
              h('label', { className: 'block text-sm mb-1' },
                '區域名稱 ', h('span', { className: 'text-red-500' }, '*')),
              h('input', {
                type: 'text',
                name: 'name',
                value: formData.name,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-2' },
                '縣市行政區清單 ', h('span', { className: 'text-red-500' }, '*')),
              h('p', { className: 'text-xs text-gray-400 mb-3' },
                '依縣市展開選擇行政區；已被其他績效區域使用的行政區不可勾選'),
              h(DistrictTreePicker, {
                selectedDistricts: districts,
                onChange: function (next) { districts = next; rerender(); },
                expandedCities: expandedCities,
                onExpandedCitiesChange: function (next) { expandedCities = next; rerender(); },
                disabledDistricts: occupiedDistricts
              })
            )
          ),
          h('div', { className: 'flex justify-end gap-3 mt-8 pt-6 border-t' },
            h('button', {
              type: 'button',
              onClick: function () { setView('performance-area-list'); },
              className: 'px-5 py-2.5 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
            }, '取消'),
            h('button', {
              type: 'submit',
              className: 'flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
            }, Icons.Save({ className: 'h-4 w-4' }), ' 儲存')
          )
        )
      );
    });
  }

  window.PerformanceAreaForm = PerformanceAreaForm;
})();
```

- [ ] **Step 2: `index.html` 載入**

```html
<script src="src/features/permissions/performance-area-form.js"></script>
```

須在 `district-tree-picker.js`、`performance-area-utils.js` 之後。

- [ ] **Step 3: 手動驗收**

1. 新增：名稱空白 → error toast；無行政區 → error toast
2. 名稱「北區」→「區域名稱已存在」
3. 嘗試勾選已被南區占用的「高雄市左營區」→ checkbox disabled
4. 合法新增後回列表可見新列
5. 編輯北區：可改名稱／行政區，儲存後更新；自身已選區不可被標為 disabled
6. 取消／關閉回列表

---

### Task 6: 端對端驗收

**Files:** 無新增（僅驗證）

- [ ] **Step 1: 對照規格驗收清單**

| # | 項目 | 預期 |
|---|------|------|
| 1 | 側邊欄＋帳號權限樹 | 出現「績效區域管理」 |
| 2 | 列表預設 | 顯示 seed 全部 |
| 3 | 關鍵字搜尋 | 可依名稱／行政區篩選；按鈕或 Enter |
| 4 | 新增／編輯／刪除 | CRUD 完整；刪除有確認彈窗 |
| 5 | 行政區來源 | 縣市樹；無客戶／店家名稱 |
| 6 | 互斥 | 占用區 disabled；儲存衝突會擋 |
| 7 | 指派人員 | 行政區選擇與重構前一致（可重疊、無灰掉他組區域） |
| 8 | 重新整理 | 回到 seed（記憶體，與其他主檔相同） |

- [ ] **Step 2: 回歸抽查**

- 指派人員：編輯 A組，改行政區後儲存成功
- 設備分類／保養分配：選單仍可進入、無 console error

---

## Spec coverage (self-review)

| Spec 章節 | Task |
|-----------|------|
| §1 目標／獨立主檔／互斥／共用 picker | Task 1–5；非目標見 Global Constraints |
| §3 選單與路由 | Task 3 |
| §4 資料模型／seed／store | Task 3 |
| §5 DistrictTreePicker＋assignee 重構 | Task 1（含 expandedCities 父層持有之實作細節） |
| §6.1 列表 | Task 4 |
| §6.2–6.3 新增／編輯 | Task 5 |
| §6.4 刪除 | Task 4 |
| §7 驗證 | Task 2＋Task 5 |
| §8 檔案清單 | 全 tasks |
| §9 非目標 | 未實作連動報表／API |
| §10 驗收 | Task 6 |

**Placeholder scan:** 無 TBD／TODO；程式碼步驟含完整實作。  
**型別一致性:** `districts: string[]`、`PerformanceAreaUtils.*`、view 名稱 `performance-area-*` 全計畫一致。
