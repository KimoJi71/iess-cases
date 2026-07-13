# 案件安排 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增頂部「案件排程」模組與「案件安排」子功能：週檢視日曆、待安排案件拖曳排程、新增排程（寫入叫修紀錄 + 人員動向）。

**Architecture:** 排程資料直接寫入三種案件集的 `planDate/planTime*` 欄位；日曆以 FullCalendar CDN 命令式掛載；左側待安排清單 + 右側週檢視；`personnelStatus` 陣列同步更新。

**Tech Stack:** Vanilla JS IIFE + `IESS.h` / `stateful`、Tailwind CDN、FullCalendar v6 CDN（global bundle）。

**驗證方式:** 本專案無自動測試；各 task 以瀏覽器手動驗收對應規格 §11。不自動 commit（除非使用者要求）。

---

### Task 1: 選項常數與假資料

**Files:**
- Modify: `src/data/options.js`
- Modify: `src/data/seed.js`

- [ ] **Step 1:** 在 `options.js` 末尾新增：

```js
const SCHEDULE_ASSIGNEE_OPTIONS = ['A組', 'B組', 'C組', 'D組', '督導', '協力廠商', '案件待辦'];
const SCHEDULE_WORK_CATEGORY_OPTIONS = ['保養清潔', '一般叫修', '緊急叫修', '新開', '汰換', '撤店', '整裝', '加裝'];
```

- [ ] **Step 2:** 在 `seed.js` 為既有案件補排程時間欄位：
  - `INITIAL_MAINTENANCE_CASES` 每筆加 `planTimeStart: ''`, `planTimeEnd: ''`
  - M2026070002 設 `planTimeStart: '09:00'`, `planTimeEnd: '11:00'`
  - `INITIAL_CASES` 每筆加 `planDate: ''`, `planTimeStart: ''`, `planTimeEnd: ''`
  - `INITIAL_PROJECT_CASES` 每筆加 `planDate: ''`, `planTimeStart: ''`, `planTimeEnd: ''`

- [ ] **Step 3:** 在 `INITIAL_CASES` 新增待安排叫修案件：

```js
{
  id: 'C20260713006',
  indicator: 'normal',
  repairDate: todayDate,
  caseNumber: '20260713006',
  customerName: '屈臣氏',
  storeName: '台中旗艦店',
  district: '中區',
  workCategory: '一般叫修',
  repairItem: '室內機',
  repairReason: '不冷',
  faultDesc: '冷氣不冷，待排程',
  actualReason: '',
  assignee: '案件待辦',
  processStatus: '尚未處理完成',
  isClosed: false,
  serviceLevel: '保修(一年一次)',
  storeAddress: '台中市西屯區台灣大道X號',
  reporter: '林店長',
  equipment: null,
  processRecords: [],
  reRepairDate: '',
  completionDate: '',
  expectedDate: '',
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isPerformanceIncluded: false
}
```

- [ ] **Step 4:** 在 `INITIAL_PROJECT_CASES` 新增待安排工程案件：

```js
{
  id: 'P20260713003',
  projectNumber: `${todayDate.replace(/-/g, '')}003`,
  creationDate: todayDate,
  customerName: '萊爾富',
  storeName: '高雄左營店',
  workCategory: '汰換',
  currentStage: '現勘',
  stageDate: todayDate,
  stageAssignee: '尚未指派',
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isClosed: false,
  history: [{ stage: '立案時間', date: todayDate, assignee: '管理員' }],
  comments: [],
  details: {
    storeAddress: '高雄市左營區博愛路X號',
    serviceLevel: '保養(一年一次)',
    contactPerson: '',
    suggestedContractor: '',
    entryDate: todayDate,
    remarks: '',
    equipment: []
  }
}
```

- [ ] **Step 5:** 新增 `INITIAL_PERSONNEL_STATUS`：

```js
const INITIAL_PERSONNEL_STATUS = [{
  id: 'PS1',
  assignee: 'A組',
  date: todayDate,
  timeStart: '09:00',
  timeEnd: '11:00',
  customerName: '星巴克',
  storeName: '台中旗艦店',
  workCategory: '保養清潔',
  sourceType: 'maintenance',
  sourceId: 'M2026070002'
}];
```

- [ ] **Step 6:** 手動驗證 — 開啟 `index.html`，Console 無錯誤；`INITIAL_PERSONNEL_STATUS` 可被後續 `app.js` 讀取。

---

### Task 2: 頂部選單與案件排程側邊選單

**Files:**
- Modify: `src/shell/header.js`
- Create: `src/shell/scheduling-sidebar.js`

- [ ] **Step 1:** `header.js` 將 `menus` 改為：

```js
var menus = ['戰情室', '案件排程'];
```

- [ ] **Step 2:** 建立 `scheduling-sidebar.js`（結構對齊 `sidebar.js`）：

```js
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons;

  var MENU_TREE = [{
    id: '案件排程', icon: 'Calendar', children: [
      { id: '案件安排', label: '案件安排' }
    ]
  }];

  function SchedulingSidebar(props) {
    var currentSubMenu = props.currentSubMenu;
    var expandedSidebar = props.expandedSidebar;
    var setCurrentSubMenu = props.setCurrentSubMenu;
    var toggleExpand = props.toggleExpand;

    return h('aside', {
      className: 'w-56 bg-white border-r border-gray-200 shadow-sm flex flex-col shrink-0 z-0'
    },
      h('div', { className: 'p-4 border-b border-gray-100 bg-gray-50/50' },
        h('h2', { className: 'text-base font-bold text-gray-700 tracking-wide' }, '案件排程 選單')
      ),
      h('nav', { className: 'flex-1 p-3 space-y-1 overflow-y-auto' },
        MENU_TREE.map(function (menu) {
          var Icon = Icons[menu.icon] || Icons.Wrench;
          var isOpen = expandedSidebar.indexOf(menu.id) !== -1;
          return h('div', { key: menu.id, className: 'mb-1' },
            h('button', {
              onClick: function () { toggleExpand(menu.id); },
              className: 'w-full flex items-center justify-between px-3 py-3 rounded-md transition-all ' +
                (isOpen ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600')
            },
              h('div', { className: 'flex items-center space-x-3' },
                Icon({ className: 'h-5 w-5 ' + (isOpen ? 'text-blue-600' : 'text-gray-400') }),
                h('span', null, menu.id)
              ),
              Icons.ChevronDown({ className: 'h-4 w-4 transition-transform ' + (isOpen ? 'rotate-180' : '') })
            ),
            isOpen && h('div', { className: 'mt-1 ml-4 pl-4 border-l-2 border-gray-100 space-y-1' },
              menu.children.map(function (sub) {
                return h('button', {
                  key: sub.id,
                  onClick: function () { setCurrentSubMenu(sub.id); },
                  className: 'w-full flex items-center px-3 py-2 rounded-md transition-all text-sm ' +
                    (currentSubMenu === sub.id
                      ? 'bg-blue-100/50 text-blue-700 font-bold'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-blue-600')
                }, sub.label);
              })
            )
          );
        })
      )
    );
  }

  window.SchedulingSidebar = SchedulingSidebar;
})();
```

- [ ] **Step 3:** 在 `src/core/icons.js` 確認有 `Calendar` 圖示；若無則新增簡易 SVG calendar icon。

- [ ] **Step 4:** 手動驗證 — 頂部只剩兩個選單項（需 Task 3 完成後才可切換案件排程側邊欄）。

---

### Task 3: app.js 雙模組路由

**Files:**
- Modify: `src/app.js`
- Modify: `index.html`

- [ ] **Step 1:** 拆分選單預設 view：

```js
var WARROOM_SUBMENU_DEFAULT_VIEW = { /* 既有 SUBMENU_DEFAULT_VIEW 內容 */ };
var SCHEDULING_SUBMENU_DEFAULT_VIEW = {
  '案件安排': 'arrangement'
};
var WARROOM_SUBMENUS = Object.keys(WARROOM_SUBMENU_DEFAULT_VIEW);
var SCHEDULING_SUBMENUS = Object.keys(SCHEDULING_SUBMENU_DEFAULT_VIEW);
```

- [ ] **Step 2:** store 初始值新增：

```js
personnelStatus: INITIAL_PERSONNEL_STATUS,
schedulingSubMenu: readLS('iess:schedulingSubMenu', '案件安排'),
```

並將 `currentSubMenu` 的 localStorage 邏輯分開：戰情室用 `iess:currentSubMenu`，案件排程用 `iess:schedulingSubMenu`。

- [ ] **Step 3:** 新增 setter：

```js
var setPersonnelStatus = makeSetter('personnelStatus');

function setSchedulingSubMenu(sub) {
  var defaultView = SCHEDULING_SUBMENU_DEFAULT_VIEW[sub];
  store.set({ schedulingSubMenu: sub, view: defaultView || store.get().view });
  writeLS('iess:schedulingSubMenu', sub);
}

function setCurrentTopMenu(menu) {
  var s = store.get();
  var nextView;
  if (menu === '案件排程') {
    nextView = SCHEDULING_SUBMENU_DEFAULT_VIEW[s.schedulingSubMenu] || 'arrangement';
  } else {
    nextView = WARROOM_SUBMENU_DEFAULT_VIEW[s.currentSubMenu] || 'survey-list';
  }
  store.set({ currentTopMenu: menu, view: nextView });
  writeLS('iess:currentTopMenu', menu);
}
```

- [ ] **Step 4:** `renderMain` 改為：

```js
function renderMain(s) {
  if (s.currentTopMenu === '案件排程') {
    if (SCHEDULING_SUBMENUS.indexOf(s.schedulingSubMenu) === -1) {
      return h('div', { className: 'flex items-center justify-center h-64 text-gray-400' },
        h('p', { className: 'text-xl' }, '此為「' + s.schedulingSubMenu + '」功能，請點選選單查看實作'));
    }
    return renderSchedulingView(s);
  }
  if (WARROOM_SUBMENUS.indexOf(s.currentSubMenu) === -1) {
    return h('div', { className: 'flex items-center justify-center h-64 text-gray-400' },
      h('p', { className: 'text-xl' }, '此為「' + s.currentSubMenu + '」功能，請點選選單查看實作'));
  }
  return renderWarroomView(s);
}
```

將現有 `renderView` 改名 `renderWarroomView`；新增 `renderSchedulingView`（`arrangement`、`arrangement-add` case，先回傳 placeholder 待 Task 5/6 完成）。

- [ ] **Step 5:** `App` 元件依 `currentTopMenu` 切換側邊欄：

```js
s.currentTopMenu === '戰情室' && h(Sidebar, { ... }),
s.currentTopMenu === '案件排程' && h(SchedulingSidebar, {
  currentSubMenu: s.schedulingSubMenu,
  expandedSidebar: s.expandedSidebar,
  setCurrentSubMenu: setSchedulingSubMenu,
  toggleExpand: toggleExpand
}),
```

- [ ] **Step 6:** `index.html` 在 `sidebar.js` 之後載入 `scheduling-sidebar.js`。

- [ ] **Step 7:** 手動驗證 — 切換「案件排程」顯示左側「案件安排」選單，主區顯示 placeholder 或空白。

---

### Task 4: FullCalendar 封裝（calendar-bridge.js）

**Files:**
- Create: `src/features/scheduling/calendar-bridge.js`
- Modify: `index.html`

- [ ] **Step 1:** `index.html` `<head>` 或 body 頂部加入 CDN：

```html
<link href="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.css" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js"></script>
```

- [ ] **Step 2:** 建立 `calendar-bridge.js`，掛在 `window.IESS.CalendarBridge`：

```js
(function () {
  'use strict';

  function pad(n) { return String(n).padStart(2, '0'); }

  function formatDate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function getWeekRange(date) {
    var d = new Date(date);
    var day = d.getDay();
    var diffToMon = day === 0 ? -6 : 1 - day;
    var mon = new Date(d);
    mon.setDate(d.getDate() + diffToMon);
    var sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { start: formatDate(mon), end: formatDate(sun) };
  }

  function createBridge(containerEl, options) {
    var calendar = null;
    var draggableInstances = [];

    function destroy() {
      draggableInstances.forEach(function (d) { if (d && d.destroy) d.destroy(); });
      draggableInstances = [];
      if (calendar) { calendar.destroy(); calendar = null; }
    }

    function setEvents(events) {
      if (!calendar) return;
      calendar.removeAllEvents();
      events.forEach(function (ev) { calendar.addEvent(ev); });
    }

    function init() {
      destroy();
      calendar = new FullCalendar.Calendar(containerEl, {
        initialView: 'timeGridWeek',
        locale: 'zh-tw',
        headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
        slotMinTime: '08:00:00',
        slotMaxTime: '20:00:00',
        allDaySlot: false,
        height: 'auto',
        editable: false,
        droppable: true,
        events: options.initialEvents || [],
        drop: function (info) {
          if (options.onDrop) {
            var dateStr = formatDate(info.date);
            var timeStr = pad(info.date.getHours()) + ':' + pad(info.date.getMinutes());
            options.onDrop(info.draggedEl.dataset, dateStr, timeStr);
          }
        }
      });
      calendar.render();
      if (options.visibleRange) {
        calendar.setOption('visibleRange', options.visibleRange);
      }
    }

    function initExternalDrag(pendingItems, eventDataAttr) {
      draggableInstances.forEach(function (d) { if (d && d.destroy) d.destroy(); });
      draggableInstances = [];
      pendingItems.forEach(function (el) {
        if (!el) return;
        var draggable = new FullCalendar.Draggable(el, {
          eventData: function () {
            var ds = el.dataset;
            return {
              title: ds.customerName + ' ' + ds.storeName,
              duration: '02:00',
              extendedProps: {
                sourceType: ds.sourceType,
                sourceId: ds.sourceId,
                customerName: ds.customerName,
                storeName: ds.storeName,
                workCategory: ds.workCategory
              }
            };
          }
        });
        draggableInstances.push(draggable);
      });
    }

    function gotoRange(startStr, endStr) {
      if (!calendar) return;
      calendar.setOption('visibleRange', {
        start: startStr,
        end: new Date(new Date(endStr).getTime() + 86400000).toISOString().split('T')[0]
      });
      calendar.gotoDate(startStr);
    }

    init();
    return { destroy: destroy, setEvents: setEvents, initExternalDrag: initExternalDrag, gotoRange: gotoRange, getCalendar: function () { return calendar; } };
  }

  window.IESS = window.IESS || {};
  window.IESS.CalendarBridge = { createBridge: createBridge, getWeekRange: getWeekRange };
})();
```

- [ ] **Step 3:** `index.html` 在 scheduling feature scripts 之前載入 `calendar-bridge.js`。

- [ ] **Step 4:** 手動驗證 — Console 執行 `IESS.CalendarBridge.getWeekRange(new Date())` 回傳本週一／週日字串。

---

### Task 5: 共用排程工具函式

**Files:**
- Create: `src/features/scheduling/schedule-utils.js`

- [ ] **Step 1:** 建立工具模組 `window.ScheduleUtils`：

```js
(function () {
  'use strict';

  function getPendingCases(maintenanceCases, cases, projectCases, filters) {
    var items = [];
    maintenanceCases.forEach(function (c) {
      if (c.isClosed || c.status !== '待排程') return;
      items.push({
        sourceType: 'maintenance', sourceId: c.id,
        customerName: c.customerName, storeName: c.storeName,
        district: c.district, workCategory: '保養清潔', assignee: c.assignee || '尚未指派'
      });
    });
    cases.forEach(function (c) {
      if (c.isClosed || c.assignee !== '案件待辦' || c.planDate) return;
      items.push({
        sourceType: 'repair', sourceId: c.id,
        customerName: c.customerName, storeName: c.storeName,
        district: c.district, workCategory: c.workCategory, assignee: c.assignee
      });
    });
    projectCases.forEach(function (c) {
      if (c.isClosed || c.stageAssignee !== '尚未指派' || c.planDate) return;
      items.push({
        sourceType: 'project', sourceId: c.id,
        customerName: c.customerName, storeName: c.storeName,
        district: (c.details && c.details.district) || '',
        workCategory: c.workCategory, assignee: c.stageAssignee
      });
    });
    return items.filter(function (item) {
      if (filters.workCategory !== '全部' && item.workCategory !== filters.workCategory) return false;
      if (filters.customer !== '全部' && item.customerName !== filters.customer) return false;
      if (filters.district !== '全部' && item.district !== filters.district) return false;
      if (filters.assignee !== '全部' && item.assignee !== filters.assignee) return false;
      return true;
    });
  }

  function getScheduledEvents(maintenanceCases, cases, projectCases, rangeStart, rangeEnd, assigneeFilter) {
    var events = [];
    function inRange(dateStr) {
      return dateStr && dateStr >= rangeStart && dateStr <= rangeEnd;
    }
    function pushEvent(sourceType, c, assignee, workCategory) {
      if (!inRange(c.planDate) || !c.planTimeStart) return;
      if (assigneeFilter !== '全部' && assignee !== assigneeFilter) return;
      var start = c.planDate + 'T' + c.planTimeStart + ':00';
      var end = c.planDate + 'T' + (c.planTimeEnd || c.planTimeStart) + ':00';
      events.push({
        id: sourceType + '-' + c.id,
        title: assignee + ' ' + c.customerName + ' ' + c.storeName,
        start: start,
        end: end,
        extendedProps: { sourceType: sourceType, sourceId: c.id, workCategory: workCategory, assignee: assignee }
      });
    }
    maintenanceCases.forEach(function (c) {
      pushEvent('maintenance', c, c.assignee, '保養清潔');
    });
    cases.forEach(function (c) {
      if (!c.planDate) return;
      pushEvent('repair', c, c.assignee, c.workCategory);
    });
    projectCases.forEach(function (c) {
      if (!c.planDate) return;
      pushEvent('project', c, c.stageAssignee, c.workCategory);
    });
    return events;
  }

  function applyScheduleUpdate(sourceType, sourceId, payload, store, setters) {
    var planDate = payload.planDate;
    var planTimeStart = payload.planTimeStart;
    var planTimeEnd = payload.planTimeEnd;
    var assignee = payload.assignee;
    var customerName = '';
    var storeName = '';
    var workCategory = '';

    if (sourceType === 'maintenance') {
      setters.setMaintenanceCases(store.maintenanceCases.map(function (c) {
        if (c.id !== sourceId) return c;
        customerName = c.customerName; storeName = c.storeName; workCategory = '保養清潔';
        return Object.assign({}, c, {
          planDate: planDate, planTimeStart: planTimeStart, planTimeEnd: planTimeEnd,
          assignee: assignee, status: '已排程'
        });
      }));
    } else if (sourceType === 'repair') {
      setters.setCases(store.cases.map(function (c) {
        if (c.id !== sourceId) return c;
        customerName = c.customerName; storeName = c.storeName; workCategory = c.workCategory;
        return Object.assign({}, c, {
          planDate: planDate, planTimeStart: planTimeStart, planTimeEnd: planTimeEnd, assignee: assignee
        });
      }));
    } else if (sourceType === 'project') {
      setters.setProjectCases(store.projectCases.map(function (c) {
        if (c.id !== sourceId) return c;
        customerName = c.customerName; storeName = c.storeName; workCategory = c.workCategory;
        return Object.assign({}, c, {
          planDate: planDate, planTimeStart: planTimeStart, planTimeEnd: planTimeEnd, stageAssignee: assignee
        });
      }));
    }

    var ps = store.personnelStatus.filter(function (p) {
      return !(p.sourceType === sourceType && p.sourceId === sourceId);
    });
    ps.push({
      id: 'PS' + Date.now(),
      assignee: assignee,
      date: planDate,
      timeStart: planTimeStart,
      timeEnd: planTimeEnd,
      customerName: customerName,
      storeName: storeName,
      workCategory: workCategory,
      sourceType: sourceType,
      sourceId: sourceId
    });
    setters.setPersonnelStatus(ps);
  }

  window.ScheduleUtils = {
    getPendingCases: getPendingCases,
    getScheduledEvents: getScheduledEvents,
    applyScheduleUpdate: applyScheduleUpdate
  };
})();
```

- [ ] **Step 2:** `index.html` 在 `calendar-bridge.js` 之後載入 `schedule-utils.js`。

---

### Task 6: 案件安排主頁（case-arrangement.js）

**Files:**
- Create: `src/features/scheduling/case-arrangement.js`
- Modify: `src/app.js`
- Modify: `index.html`

- [ ] **Step 1:** 實作 `CaseArrangement` 元件，props：

```js
{
  maintenanceCases, setMaintenanceCases,
  cases, setCases,
  projectCases, setProjectCases,
  personnelStatus, setPersonnelStatus,
  customers,
  setView, showToast
}
```

- [ ] **Step 2:** 版面結構：
  - 頂部：日曆篩選（開始／結束日期、指派組別、查詢按鈕）+ 右上角「+ 新增案件排程」
  - 主體 `flex`：左欄 `w-72` 待安排清單 + 右欄 `flex-1` 日曆容器 `#calendar-mount`

- [ ] **Step 3:** 左欄待安排篩選（工作類別、客戶、行政區域、指派組別）+ 查詢；列表每項：

```js
h('div', {
  className: 'pending-item p-3 mb-2 bg-gray-50 border rounded cursor-grab',
  'data-source-type': item.sourceType,
  'data-source-id': item.sourceId,
  'data-customer-name': item.customerName,
  'data-store-name': item.storeName,
  'data-work-category': item.workCategory
}, ...)
```

- [ ] **Step 4:** 使用 `IESS.CalendarBridge.createBridge`：
  - 進入時 `getWeekRange(new Date())` 設預設篩選
  - `ref` 掛載後建立 bridge
  - `onDrop` 開啟時段 Modal（日期唯讀、開始／結束時間、指派組別）
  - 確認後呼叫 `ScheduleUtils.applyScheduleUpdate` + `showToast('排程已儲存')` + 刷新事件與清單

- [ ] **Step 5:** 日曆篩選查詢：更新 `gotoRange` + `setEvents(getScheduledEvents(...))`

- [ ] **Step 6:** 元件卸載或重繪時呼叫 `bridge.destroy()`（在替換 calendar 容器前）

- [ ] **Step 7:** `app.js` `renderSchedulingView` 的 `arrangement` case 接上 `CaseArrangement`；`index.html` 載入 script。

- [ ] **Step 8:** 手動驗證：
  - 進入案件安排，日曆顯示本週 M2026070002 事件
  - 左側顯示保養待排程、叫修案件待辦、工程尚未指派
  - 拖曳一筆至日曆、填時段後，該筆從待安排消失、日曆出現新事件

---

### Task 7: 新增排程表單（schedule-add-form.js）

**Files:**
- Create: `src/features/scheduling/schedule-add-form.js`
- Modify: `src/app.js`

- [ ] **Step 1:** 實作 `ScheduleAddForm`，可由 `CaseArrangement` 以 Modal 開啟（`showAddModal` state）或獨立 view `arrangement-add`。建議 Modal 嵌在 `CaseArrangement` 內，減少路由複雜度。

- [ ] **Step 2:** 表單欄位依規格 §6；客戶變更時過濾門市；門市變更時帶入 `companyAddress`、`serviceLevel`。

- [ ] **Step 3:** 儲存時新增 `cases` 一筆：

```js
var newCase = {
  id: 'C' + Date.now(),
  caseNumber: planDate.replace(/-/g, '') + String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
  repairDate: planDate,
  customerName: form.customerName,
  storeName: form.storeName,
  district: store.district || '北區',
  workCategory: form.workName,
  repairItem: '室內機',
  repairReason: '其他',
  faultDesc: form.workDesc,
  actualReason: '',
  assignee: form.assignee,
  processStatus: '尚未處理完成',
  indicator: 'normal',
  isClosed: false,
  serviceLevel: form.serviceLevel,
  storeAddress: form.storeAddress,
  reporter: '管理員',
  equipment: null,
  processRecords: [],
  reRepairDate: '',
  completionDate: '',
  expectedDate: planDate,
  planDate: planDate,
  planTimeStart: form.timeStart,
  planTimeEnd: form.timeEnd,
  isPerformanceIncluded: false
};
```

- [ ] **Step 4:** 同步 `personnelStatus`（`sourceType: 'manual'`）。

- [ ] **Step 5:** 關閉 Modal、刷新日曆事件、`showToast('排程已新增')`。

- [ ] **Step 6:** 手動驗證 — 新增排程後日曆出現事件；戰情室叫修案件列表可見新案件。

---

### Task 8: 整體驗收

**Files:** （無新增）

- [ ] **Step 1:** 對照規格 `2026-07-13-case-arrangement-design.md` §11 八項手動確認。
- [ ] **Step 2:** 確認切換戰情室／案件排程時側邊欄與 view 正確、localStorage 記憶各自子選單。
- [ ] **Step 3:** 確認 Console 無 FullCalendar／Draggable 相關錯誤。
