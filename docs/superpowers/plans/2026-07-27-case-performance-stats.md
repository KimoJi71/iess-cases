# 報表統計 — 案件績效統計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將案件績效統計改為雙區塊環形儀表板：上半指派人員（達成率／目標／完成／增額積分），下半依績效區域顯示總達成率與各客戶卡；目標來自保養分配，完成僅計保養案件，增額積分僅計 C／D 叫修案件。

**Architecture:** 擴充 `PerformanceUtils` 集中計算；改寫 `CasePerformanceStats` 為環形卡 UI；`app.js` 傳入 cases／maintenanceCases／assignees／allocations／stores／performanceAreas。可選補 seed 讓本季示範數字非全零。

**Tech Stack:** Vanilla JS IIFE、`IESS.h`、Tailwind CDN、既有 `AssigneeUtils`／`StoreUtils`、SVG 圓環（`stroke-dasharray`）。

**驗證方式:** 本專案無自動測試；utils 以 Console assert、頁面以瀏覽器手動驗收。不自動 commit（除非使用者要求）。

## Global Constraints

- 完成店數：僅已列入績效的 `maintenanceCases`（保養），計案件數
- 增額積分：僅已列入績效、服務等級 C／D 的叫修 `cases`，加總 `points × qty`
- 目標店數：本季三個月 `maintenanceAllocations.targetCount` 加總
- 客戶歸區：門市行政區 ∈ 績效區域 `districts`；可跨區重複；目標不依區域拆分
- 視覺：白底環形進度卡（非舊半圓指針）；區域總卡 teal、指派藍、客戶淡藍
- 不改銷案審核列入績效流程、不改保養分配 CRUD、不做 API
- 報表停止使用 `PERFORMANCE_ASSIGNEES`／`PERFORMANCE_QUARTERLY_TARGETS`（常數可不刪）

**Spec:** `docs/superpowers/specs/2026-07-27-case-performance-stats-design.md`

---

## File map

| 檔案 | 職責 |
|------|------|
| `src/features/reports/performance-utils.js` | 季度、目標加總、指派／區域績效計算 |
| `src/features/reports/case-performance-stats.js` | 雙區塊環形儀表板 UI |
| `src/app.js` | `CasePerformanceStats` props |
| `src/data/seed.js` | （可選）本季分配＋已列入績效保養案，供手動驗收 |

---

### Task 1: 擴充 PerformanceUtils

**Files:**
- Modify: `src/features/reports/performance-utils.js`

**Interfaces:**
- Produces on `window.PerformanceUtils`:
  - `getQuarterRange(date?)`（既有）
  - `getQuarterMonths(quarterRange) -> number[]` — 本季月份 1–12
  - `achievementRate(completed, target) -> number`
  - `isServiceLevelCD(serviceLevel) -> boolean`
  - `toDateKey(value) -> string` — 取 `YYYY-MM-DD`
  - `getRepairCaseDate(c) -> string`
  - `getMaintenanceCaseDate(c) -> string`
  - `sumAllocationTargets(allocations, opts) -> number`  
    `opts: { months: number[], assigneeId?: string, customerName?: string }`
  - `getCaseArea(record, stores) -> string`
  - `sumProcessPoints(c) -> number`
  - `computeAssigneePerformance(input) -> Array<{ id, name, target, completed, bonusPoints, rate }>`  
    `input: { cases, maintenanceCases, assignees, allocations, quarter }`
  - `computeRegionPerformance(input) -> Array<{ id, name, target, completed, rate, customers: Array<{ customerName, target, completed, rate }> }>`  
    `input: { maintenanceCases, stores, performanceAreas, allocations, quarter }`
- 可保留舊 `computePerformanceStats`（無人呼叫則可刪；建議刪以免誤用）

- [ ] **Step 1: 以完整實作取代 `performance-utils.js`**

```js
/*
 * features/reports/performance-utils.js — 案件績效統計計算
 */
(function () {
  'use strict';

  function getQuarterRange(date) {
    var d = date || new Date();
    var month = d.getMonth();
    var quarter = Math.floor(month / 3);
    var year = d.getFullYear();
    var startMonth = quarter * 3;
    var start = new Date(year, startMonth, 1);
    var end = new Date(year, startMonth + 3, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
      label: year + ' 年第 ' + (quarter + 1) + ' 季'
    };
  }

  function getQuarterMonths(quarterRange) {
    var start = new Date(quarterRange.start + 'T00:00:00');
    var m = start.getMonth() + 1;
    return [m, m + 1, m + 2];
  }

  function isDateInRange(dateStr, start, end) {
    return !!dateStr && dateStr >= start && dateStr <= end;
  }

  function toDateKey(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
  }

  function achievementRate(completed, target) {
    var t = Number(target) || 0;
    if (t <= 0) return 0;
    return Math.round(((Number(completed) || 0) / t) * 100);
  }

  function isServiceLevelCD(serviceLevel) {
    var s = String(serviceLevel || '');
    return s.indexOf('C ') === 0 || s.indexOf('D ') === 0;
  }

  function getRepairCaseDate(c) {
    return toDateKey((c && (c.completionDate || c.repairDate)) || '');
  }

  function getMaintenanceCaseDate(c) {
    if (!c) return '';
    return toDateKey(
      c.completionDate || c.closeDate || c.repairDate || c.planDate || ''
    );
  }

  function sumAllocationTargets(allocations, opts) {
    opts = opts || {};
    var months = opts.months || [];
    var monthSet = {};
    months.forEach(function (m) { monthSet[m] = true; });
    var total = 0;
    (allocations || []).forEach(function (row) {
      if (!monthSet[row.month]) return;
      if (opts.assigneeId && row.assigneeId !== opts.assigneeId) return;
      if (opts.customerName && row.customerName !== opts.customerName) return;
      total += Number(row.targetCount) || 0;
    });
    return total;
  }

  function getCaseArea(record, stores) {
    if (!record) return '';
    var store = (stores || []).find(function (s) {
      return StoreUtils.matchesStoreRecord(record, s);
    });
    if (store) return StoreUtils.getStoreArea(store);
    return StoreUtils.getRecordArea(record) || '';
  }

  function sumProcessPoints(c) {
    var total = 0;
    ((c && c.processRecords) || []).forEach(function (r) {
      var points = Number(r.points) || 0;
      var qty = Number(r.qty) > 0 ? Number(r.qty) : 1;
      total += points * qty;
    });
    return total;
  }

  function computeAssigneePerformance(input) {
    var cases = input.cases || [];
    var maintenanceCases = input.maintenanceCases || [];
    var assignees = input.assignees || [];
    var allocations = input.allocations || [];
    var quarter = input.quarter;
    var months = getQuarterMonths(quarter);

    return assignees.map(function (assignee) {
      var completed = 0;
      maintenanceCases.forEach(function (c) {
        if (!c.isPerformanceIncluded) return;
        if (!isDateInRange(getMaintenanceCaseDate(c), quarter.start, quarter.end)) return;
        if (AssigneeUtils.getPerformanceAssignee(c) !== assignee.name) return;
        completed++;
      });

      var bonusPoints = 0;
      cases.forEach(function (c) {
        if (!c.isPerformanceIncluded) return;
        if (!isServiceLevelCD(c.serviceLevel)) return;
        if (!isDateInRange(getRepairCaseDate(c), quarter.start, quarter.end)) return;
        if (AssigneeUtils.getPerformanceAssignee(c) !== assignee.name) return;
        bonusPoints += sumProcessPoints(c);
      });

      var target = sumAllocationTargets(allocations, {
        months: months,
        assigneeId: assignee.id
      });

      return {
        id: assignee.id,
        name: assignee.name,
        target: target,
        completed: completed,
        bonusPoints: bonusPoints,
        rate: achievementRate(completed, target)
      };
    });
  }

  function computeRegionPerformance(input) {
    var maintenanceCases = input.maintenanceCases || [];
    var stores = input.stores || [];
    var performanceAreas = input.performanceAreas || [];
    var allocations = input.allocations || [];
    var quarter = input.quarter;
    var months = getQuarterMonths(quarter);

    function districtSet(districts) {
      var set = {};
      (districts || []).forEach(function (d) { set[d] = true; });
      return set;
    }

    function customersInArea(areaDistricts) {
      var set = districtSet(areaDistricts);
      var names = {};
      (stores || []).forEach(function (store) {
        if (!StoreUtils.isActiveStore(store)) return;
        var area = StoreUtils.getStoreArea(store);
        if (!set[area]) return;
        if (store.customerName) names[store.customerName] = true;
      });
      return Object.keys(names).sort(function (a, b) {
        return a.localeCompare(b, 'zh-Hant');
      });
    }

    function completedForCustomerInArea(customerName, areaDistricts) {
      var set = districtSet(areaDistricts);
      var count = 0;
      maintenanceCases.forEach(function (c) {
        if (!c.isPerformanceIncluded) return;
        if (c.customerName !== customerName) return;
        if (!isDateInRange(getMaintenanceCaseDate(c), quarter.start, quarter.end)) return;
        var area = getCaseArea(c, stores);
        if (!set[area]) return;
        count++;
      });
      return count;
    }

    return (performanceAreas || []).slice().sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
    }).map(function (pa) {
      var customerNames = customersInArea(pa.districts);
      var customers = customerNames.map(function (customerName) {
        var target = sumAllocationTargets(allocations, {
          months: months,
          customerName: customerName
        });
        var completed = completedForCustomerInArea(customerName, pa.districts);
        return {
          customerName: customerName,
          target: target,
          completed: completed,
          rate: achievementRate(completed, target)
        };
      });

      var target = 0;
      var completed = 0;
      customers.forEach(function (row) {
        target += row.target;
        completed += row.completed;
      });

      return {
        id: pa.id,
        name: pa.name,
        target: target,
        completed: completed,
        rate: achievementRate(completed, target),
        customers: customers
      };
    });
  }

  window.PerformanceUtils = {
    getQuarterRange: getQuarterRange,
    getQuarterMonths: getQuarterMonths,
    achievementRate: achievementRate,
    isServiceLevelCD: isServiceLevelCD,
    toDateKey: toDateKey,
    getRepairCaseDate: getRepairCaseDate,
    getMaintenanceCaseDate: getMaintenanceCaseDate,
    sumAllocationTargets: sumAllocationTargets,
    getCaseArea: getCaseArea,
    sumProcessPoints: sumProcessPoints,
    computeAssigneePerformance: computeAssigneePerformance,
    computeRegionPerformance: computeRegionPerformance
  };
})();
```

- [ ] **Step 2: Console 手動驗收**

開啟 `index.html`，DevTools 執行：

```js
var q = PerformanceUtils.getQuarterRange(new Date('2026-07-15'));
console.assert(q.label.indexOf('第 3 季') !== -1);
console.assert(PerformanceUtils.getQuarterMonths(q).join() === '7,8,9');
console.assert(PerformanceUtils.achievementRate(3, 4) === 75);
console.assert(PerformanceUtils.achievementRate(1, 0) === 0);
console.assert(PerformanceUtils.isServiceLevelCD('C 保養(一年一次)') === true);
console.assert(PerformanceUtils.isServiceLevelCD('A 保修(一年一次)') === false);
console.assert(PerformanceUtils.toDateKey('2026-07-20 16:00:00') === '2026-07-20');
console.assert(PerformanceUtils.sumAllocationTargets([
  { assigneeId: 'ASG1', customerName: '屈臣氏', month: 7, targetCount: 2 },
  { assigneeId: 'ASG1', customerName: '星巴克', month: 8, targetCount: 3 },
  { assigneeId: 'ASG2', customerName: '屈臣氏', month: 7, targetCount: 9 }
], { months: [7, 8, 9], assigneeId: 'ASG1' }) === 5);
console.assert(PerformanceUtils.sumProcessPoints({
  processRecords: [{ points: 10, qty: 2 }, { points: 5, qty: 1 }]
}) === 25);

var assigneeRows = PerformanceUtils.computeAssigneePerformance({
  cases: [{
    isPerformanceIncluded: true,
    serviceLevel: 'C 保養(一年一次)',
    completionDate: '2026-07-10',
    assignee: 'A組',
    processRecords: [{ points: 4, qty: 2 }]
  }],
  maintenanceCases: [{
    isPerformanceIncluded: true,
    completionDate: '2026-07-11',
    assignee: 'A組'
  }, {
    isPerformanceIncluded: true,
    completionDate: '2026-07-12',
    assignee: 'A組'
  }],
  assignees: [{ id: 'ASG1', name: 'A組' }],
  allocations: [{ assigneeId: 'ASG1', customerName: '屈臣氏', month: 7, targetCount: 4 }],
  quarter: q
});
console.assert(assigneeRows[0].completed === 2);
console.assert(assigneeRows[0].bonusPoints === 8);
console.assert(assigneeRows[0].target === 4);
console.assert(assigneeRows[0].rate === 50);
console.log('PerformanceUtils OK');
```

Expected: 印出 `PerformanceUtils OK`，無 assert 失敗。

---

### Task 2: 環形儀表板 UI + app.js 接線

**Files:**
- Modify: `src/features/reports/case-performance-stats.js`
- Modify: `src/app.js`（`case-performance` case 的 props）

**Interfaces:**
- Consumes: `PerformanceUtils.computeAssigneePerformance`／`computeRegionPerformance`／`getQuarterRange`
- Produces: `window.CasePerformanceStats`
- Props: `cases`、`maintenanceCases`、`assignees`、`maintenanceAllocations`、`stores`、`performanceAreas`

- [ ] **Step 1: 改寫 `case-performance-stats.js`**

完整取代為：

```js
/*
 * features/reports/case-performance-stats.js — 案件績效統計（環形儀表板）
 * props: {
 *   cases, maintenanceCases, assignees,
 *   maintenanceAllocations, stores, performanceAreas
 * }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var RING_R = 44;
  var RING_C = 2 * Math.PI * RING_R;

  var THEME = {
    assignee: { stroke: '#0ea5e9', text: '#0369a1' },
    region: { stroke: '#14b8a6', text: '#0f766e' },
    customer: { stroke: '#93c5fd', text: '#1e40af' }
  };

  function createRingSvg(rate, theme, idSuffix) {
    var clamped = Math.min(Math.max(Number(rate) || 0, 0), 100);
    var filled = (clamped / 100) * RING_C;
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('class', 'w-24 h-24 mx-auto');
    svg.setAttribute('aria-hidden', 'true');

    var track = document.createElementNS(SVG_NS, 'circle');
    track.setAttribute('cx', '60');
    track.setAttribute('cy', '60');
    track.setAttribute('r', String(RING_R));
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke', '#e2e8f0');
    track.setAttribute('stroke-width', '10');
    svg.appendChild(track);

    var arc = document.createElementNS(SVG_NS, 'circle');
    arc.setAttribute('cx', '60');
    arc.setAttribute('cy', '60');
    arc.setAttribute('r', String(RING_R));
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', theme.stroke);
    arc.setAttribute('stroke-width', '10');
    arc.setAttribute('stroke-linecap', 'round');
    arc.setAttribute('stroke-dasharray', filled + ' ' + RING_C);
    arc.setAttribute('transform', 'rotate(-90 60 60)');
    svg.appendChild(arc);

    var label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', '60');
    label.setAttribute('y', '66');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', theme.text);
    label.setAttribute('font-size', '22');
    label.setAttribute('font-weight', '700');
    label.textContent = clamped + '%';
    svg.appendChild(label);

    return svg;
  }

  function RingStatCard(props) {
    var title = props.title;
    var rate = props.rate;
    var target = props.target;
    var completed = props.completed;
    var bonusPoints = props.bonusPoints;
    var showBonus = !!props.showBonus;
    var theme = THEME[props.variant] || THEME.assignee;
    var emphasize = !!props.emphasize;

    return h('div', {
      className: 'rounded-xl overflow-hidden shadow-sm border bg-white ' +
        (emphasize ? 'border-teal-200' : 'border-slate-200')
    },
      h('div', {
        className: 'px-4 py-3 border-b border-slate-100 ' +
          (emphasize ? 'bg-teal-50/80' : 'bg-slate-50')
      },
        h('span', {
          className: 'text-slate-800 font-bold text-base truncate block',
          title: title
        }, title)
      ),
      h('div', { className: 'px-5 pt-5 pb-4' },
        h('p', { className: 'text-slate-500 text-sm mb-2 text-center' },
          props.subtitle || '本季保養目標達成率'),
        createRingSvg(rate, theme, title),
        h('div', {
          className: 'mt-4 grid gap-2 text-center text-xs text-slate-500 ' +
            (showBonus ? 'grid-cols-3' : 'grid-cols-2')
        },
          h('div', null,
            h('div', null, '目標店數'),
            h('div', { className: 'text-slate-900 font-bold text-base mt-0.5' },
              String(target))
          ),
          h('div', null,
            h('div', null, '完成店數'),
            h('div', { className: 'text-slate-900 font-bold text-base mt-0.5' },
              String(completed))
          ),
          showBonus && h('div', null,
            h('div', null, '增額積分'),
            h('div', { className: 'text-sky-700 font-bold text-base mt-0.5' },
              String(bonusPoints))
          )
        )
      )
    );
  }

  function CasePerformanceStats(props) {
    var cases = props.cases || [];
    var maintenanceCases = props.maintenanceCases || [];
    var assignees = props.assignees || [];
    var allocations = props.maintenanceAllocations || [];
    var stores = props.stores || [];
    var performanceAreas = props.performanceAreas || [];
    var quarter = PerformanceUtils.getQuarterRange(new Date());

    var assigneeRows = PerformanceUtils.computeAssigneePerformance({
      cases: cases,
      maintenanceCases: maintenanceCases,
      assignees: assignees,
      allocations: allocations,
      quarter: quarter
    });

    var regionRows = PerformanceUtils.computeRegionPerformance({
      maintenanceCases: maintenanceCases,
      stores: stores,
      performanceAreas: performanceAreas,
      allocations: allocations,
      quarter: quarter
    });

    return h('div', null,
      h('div', {
        className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6'
      },
        h('div', { className: 'flex flex-wrap items-center justify-between gap-3' },
          h('div', { className: 'flex items-center gap-3' },
            Icons.BarChart({ className: 'h-6 w-6 text-blue-600' }),
            h('h2', { className: 'text-2xl font-bold text-gray-800' }, '案件績效統計')
          ),
          h('span', {
            className: 'text-sm font-medium text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full'
          }, quarter.label)
        ),
        h('p', { className: 'text-sm text-gray-500 mt-3' },
          '上半顯示各指派人員當季績效；下半依績效區域顯示總達成率與客戶達成率。',
          '完成店數僅計已列入績效之保養案件；增額積分僅計服務等級 C／D 之叫修案件。')
      ),

      h('section', { className: 'mb-8' },
        h('h3', { className: 'text-lg font-bold text-gray-800 mb-4' }, '指派人員績效'),
        assigneeRows.length === 0
          ? h('div', {
              className: 'rounded-lg border border-dashed border-gray-200 p-10 text-center text-gray-400'
            }, '尚無指派人員')
          : h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5' },
              assigneeRows.map(function (row) {
                return h(RingStatCard, {
                  key: row.id,
                  title: row.name,
                  rate: row.rate,
                  target: row.target,
                  completed: row.completed,
                  bonusPoints: row.bonusPoints,
                  showBonus: true,
                  variant: 'assignee'
                });
              })
            )
      ),

      h('section', null,
        h('h3', { className: 'text-lg font-bold text-gray-800 mb-4' }, '績效區域達成率'),
        regionRows.length === 0
          ? h('div', {
              className: 'rounded-lg border border-dashed border-gray-200 p-10 text-center text-gray-400'
            }, '尚無績效區域，請至系統權限設定')
          : regionRows.map(function (region) {
              return h('div', {
                key: region.id,
                className: 'mb-8 last:mb-0'
              },
                h('div', { className: 'max-w-sm mb-4' },
                  h(RingStatCard, {
                    title: region.name + '總目標達成率',
                    rate: region.rate,
                    target: region.target,
                    completed: region.completed,
                    showBonus: false,
                    variant: 'region',
                    emphasize: true
                  })
                ),
                region.customers.length === 0
                  ? h('p', { className: 'text-sm text-gray-400 mb-2' },
                      '此區域尚無對應門市客戶')
                  : h('div', {
                      className: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5'
                    },
                      region.customers.map(function (cust) {
                        return h(RingStatCard, {
                          key: region.id + ':' + cust.customerName,
                          title: cust.customerName,
                          rate: cust.rate,
                          target: cust.target,
                          completed: cust.completed,
                          showBonus: false,
                          variant: 'customer'
                        });
                      })
                    )
              );
            })
      )
    );
  }

  window.CasePerformanceStats = CasePerformanceStats;
})();
```

- [ ] **Step 2: 更新 `app.js` 接線**

將 `renderReportsView` 的 `case-performance` 改為：

```js
case 'case-performance':
  return h(CasePerformanceStats, {
    cases: s.cases,
    maintenanceCases: s.maintenanceCases,
    assignees: s.assignees,
    maintenanceAllocations: s.maintenanceAllocations,
    stores: s.stores,
    performanceAreas: s.performanceAreas
  });
```

- [ ] **Step 3: 手動驗收（UI 骨架）**

1. 報表統計 → 案件績效統計：無 console error（尤其無 `PERFORMANCE_ASSIGNEES is not defined`）
2. 可見頁首當季、上半每位指派人員環形卡（含增額積分欄）、下半北／中／南區總卡
3. 北區客戶應含有信義區門市之客戶（如屈臣氏）；中山區門市客戶不應出現在北區（因 seed 北區僅信義／大安）
4. 舊半圓指針 gauge 應已消失

---

### Task 3: Seed 示範資料（利於驗收）

**Files:**
- Modify: `src/data/seed.js`

**說明:** 現行 `INITIAL_MAINTENANCE_ALLOCATIONS` 為空、保養案多未列入績效，頁面目標／完成會全 0。補少量本季資料，不改變業務規則。

- [ ] **Step 1: 填入本季保養分配**

將 `INITIAL_MAINTENANCE_ALLOCATIONS` 改為（月份用當季；若實作時已非 Q3，改為 `getMonth()+1` 對應本季三個月——seed 為靜態常數，用「當前月份所在季」的第一個月即可；下列假設 2026-07 屬第 3 季）：

```js
const INITIAL_MAINTENANCE_ALLOCATIONS = [
  { id: 'MA1', assigneeId: 'ASG1', customerName: '屈臣氏', month: 7, visitIndex: 1, targetCount: 3 },
  { id: 'MA2', assigneeId: 'ASG1', customerName: '星巴克', month: 7, visitIndex: 1, targetCount: 2 },
  { id: 'MA3', assigneeId: 'ASG6', customerName: '萊爾富', month: 7, visitIndex: 1, targetCount: 2 },
  { id: 'MA4', assigneeId: 'ASG2', customerName: '星巴克', month: 8, visitIndex: 1, targetCount: 1 }
];
```

確認 seed 中這些客戶在對應 assignee 下確有 A/B/C 門市（與保養分配帶入規則一致即可；報表只讀加總，不驗證門市資格）。

- [ ] **Step 2: 標記一筆本季已列入績效的保養案**

在 `INITIAL_MAINTENANCE_CASES` 中選一筆有明確門市與指派者（例如屈臣氏／台北信義店，或將既有案補欄位），加上：

```js
isClosed: true,
isPerformanceIncluded: true,
performanceAssignee: 'A組',  // 或該案 assignee
completionDate: todayDate,
```

並確保 `customerName`／`storeName` 能對到 `stores` 且行政區落在某績效區域（屈臣氏台北信義店 → 北區）。

- [ ] **Step 3: 確認至少一筆 C／D 叫修已列入績效且有 processRecords**

檢查既有 `INITIAL_CASES`：若已有 `isPerformanceIncluded: true` 且 `serviceLevel` 為 C／D 並含 `processRecords.points`，可沿用；否則挑一筆 C／D 案補 `isPerformanceIncluded: true` 與至少一筆 processRecord，以便上半「增額積分」非 0。

- [ ] **Step 4: 手動驗收數字**

重新整理後：

1. A組目標應含 MA1+MA2（7 月）等本季加總  
2. A組完成 ≥ 1（若已標記屈臣氏保養列入績效）  
3. A組或其他組增額積分反映 C／D 叫修積分  
4. 北區總卡／屈臣氏客戶卡完成數有值；南區可見萊爾富（左營）

---

### Task 4: 端對端驗收（對照 spec §8）

**Files:** 無新增

- [ ] **Step 1: 對照驗收清單**

| # | 項目 | 預期 |
|---|------|------|
| 1 | 進入頁面 | 當季 label；上半所有指派人員環形卡含四欄指標 |
| 2 | 目標 | 與保養分配本季 `targetCount` 加總一致 |
| 3 | 完成 | 僅保養＋列入績效；叫修不增加完成店數 |
| 4 | 積分 | 僅叫修＋C／D＋列入績效的 `points×qty` |
| 5 | 區域 | 每區總卡＋客戶卡；客戶可跨區 |
| 6 | 歸區 | 依門市行政區 ↔ `performanceAreas.districts` |
| 7 | 空狀態 | 無區域／無客戶有文案；目標 0 → 達成率 0% |
| 8 | 回歸 | 銷案審核列入績效、保養分配頁仍可用 |

- [ ] **Step 2: 反向抽查**

- 將某保養案取消列入績效（若 UI 無取消，可在 console 改 store 後重渲染／重新整理 seed）：完成數應下降  
- 叫修列入績效且非 C／D：不應增加增額積分  

---

## Spec coverage (self-review)

| Spec 章節 | Task |
|-----------|------|
| §1 目標／雙區塊／環形卡 | Task 2 |
| §2 架構／資料來源 | Task 1–2 |
| §3.1–3.4 計算規則 | Task 1 |
| §3.5 區域×客戶 | Task 1–2 |
| §3.6 空狀態 | Task 2 |
| §4 UI／接線 | Task 2 |
| §5 PerformanceUtils API | Task 1 |
| §6 檔案清單 | Task 1–2；seed 為驗收輔助 Task 3 |
| §7 非目標 | 未改 case-review／maintenance-allocation |
| §8 驗收 | Task 4 |

**Placeholder scan:** 無 TBD／TODO。  
**型別一致性:** `computeAssigneePerformance`／`computeRegionPerformance` 輸入輸出與 Task 2 呼叫一致；月份為 1–12。
