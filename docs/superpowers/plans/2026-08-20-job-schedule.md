# 工程服務「工作安排」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在戰情室 → 工程服務下新增「工作安排」獨立主檔 CRUD（列表搜尋、新增、編輯、刪除）。

**Architecture:** 沿用 list／add／edit 全頁表單。新建 `JobScheduleUtils`、`JobScheduleList`、`JobScheduleForm`；store 陣列 `jobSchedules`；經 sidebar／options／seed／app.js／index.html 註冊。不接到工程立案、現勘表、案件排程。

**Tech Stack:** Vanilla JS IIFE + `IESS.h` / `stateful` / `createListPagination` / `TimeInput24`、Tailwind CDN、既有 `PageHeader`、`app-modal-overlay`、`iconActionBtn`。

**驗證方式:** 本專案無自動測試框架。Utils 用 `node` + `vm` 驗純函式；畫面以瀏覽器手動驗收。不自動 commit（除非使用者要求）。

## Global Constraints

- 獨立主檔：不接到工程立案、現勘表、案件排程日曆、人員動向
- 必填只有工作名稱；預計日期、預計時間可空，不要求成對填寫
- 指派人員不可挑選：新增寫入目前操作者名稱，編輯不覆寫；原資料沒有指派人員則維持空
- 名稱可重複
- 資料為記憶體 store，重整後回到 seed
- 權限樹可勾選「工作安排」，本次不做實際攔截

---

## File map

| 檔案 | 職責 |
|------|------|
| `src/features/project/job-schedule-utils.js` | 關鍵字比對、列表排序 |
| `src/features/project/job-schedule-list.js` | 列表、關鍵字、刪除確認 |
| `src/features/project/job-schedule-form.js` | 新增／編輯全頁表單 |
| `src/shell/sidebar.js` | 工程服務選單「工作安排」 |
| `src/data/options.js` | `PERMISSION_FUNCTIONS`／`PERMISSION_TREE` |
| `src/data/seed.js` | `INITIAL_JOB_SCHEDULES` |
| `src/app.js` | store、setter、submenu、routing |
| `index.html` | script 載入順序 |

---

### Task 1: JobScheduleUtils

**Files:**
- Create: `src/features/project/job-schedule-utils.js`

**Interfaces:**
- Produces: `window.JobScheduleUtils`
  - `matchesKeyword(record, keyword) → boolean`
  - `sortRecords(records) → jobSchedule[]`（新陣列；不改原陣列）
- `record` 欄位：`name`、`description`、`remarks`、`assigneeName`、`estimatedDate`、`estimatedTime`、`createdDate`

- [ ] **Step 1: 建立 `job-schedule-utils.js`**

```js
/*
 * features/project/job-schedule-utils.js — 工作安排：關鍵字比對與排序
 */
(function () {
  'use strict';

  function matchesKeyword(record, keyword) {
    var kw = String(keyword || '').trim().toLowerCase();
    if (!kw) return true;
    var row = record || {};
    return [row.name, row.description, row.remarks, row.assigneeName].some(function (v) {
      return v && String(v).toLowerCase().includes(kw);
    });
  }

  function sortRecords(records) {
    return (records || []).slice().sort(function (a, b) {
      var da = (a && a.estimatedDate) || '';
      var db = (b && b.estimatedDate) || '';
      if (da && !db) return -1;
      if (!da && db) return 1;
      if (da !== db) return String(db).localeCompare(String(da));
      var ta = (a && a.estimatedTime) || '';
      var tb = (b && b.estimatedTime) || '';
      if (ta && !tb) return -1;
      if (!ta && tb) return 1;
      if (ta !== tb) return String(tb).localeCompare(String(ta));
      return String((b && b.createdDate) || '').localeCompare(String((a && a.createdDate) || ''));
    });
  }

  window.JobScheduleUtils = {
    matchesKeyword: matchesKeyword,
    sortRecords: sortRecords
  };
})();
```

- [ ] **Step 2: 用 node 驗 Utils**

在專案根目錄執行：

```bash
node -e '
const fs = require("fs");
const vm = require("vm");
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("src/features/project/job-schedule-utils.js", "utf8"), ctx);
const U = ctx.window.JobScheduleUtils;
const rec = { name: "現場複測", description: "風管", remarks: "備註A", assigneeName: "系統管理員" };
if (U.matchesKeyword(rec, "") !== true) throw new Error("empty kw");
if (U.matchesKeyword(rec, "複測") !== true) throw new Error("name");
if (U.matchesKeyword(rec, "風管") !== true) throw new Error("desc");
if (U.matchesKeyword(rec, "備註A") !== true) throw new Error("remarks");
if (U.matchesKeyword(rec, "系統管理") !== true) throw new Error("assignee");
if (U.matchesKeyword(rec, "xyz") !== false) throw new Error("miss");
const rows = [
  { id: "1", estimatedDate: "", estimatedTime: "09:00", createdDate: "2026-08-20" },
  { id: "2", estimatedDate: "2026-08-21", estimatedTime: "08:00", createdDate: "2026-08-19" },
  { id: "3", estimatedDate: "2026-08-21", estimatedTime: "10:00", createdDate: "2026-08-18" },
  { id: "4", estimatedDate: "2026-08-21", estimatedTime: "", createdDate: "2026-08-22" }
];
const ids = U.sortRecords(rows).map(function (r) { return r.id; }).join(",");
if (ids !== "3,2,4,1") throw new Error("sort " + ids);
if (rows[0].id !== "1") throw new Error("mutated");
console.log("ok");
'
```

Expected: `ok`

---

### Task 2: 列表可進入（seed／選單／routing／JobScheduleList）

**Files:**
- Create: `src/features/project/job-schedule-list.js`
- Modify: `src/data/seed.js`（在 `INITIAL_SURVEY_CASES` 之後插入 `INITIAL_JOB_SCHEDULES`）
- Modify: `src/data/options.js`（`PERMISSION_FUNCTIONS`、`PERMISSION_TREE`）
- Modify: `src/shell/sidebar.js`（工程服務 children）
- Modify: `src/app.js`（store、setter、submenu default、list routing）
- Modify: `index.html`（載入 utils + list）

**Interfaces:**
- Consumes: `JobScheduleUtils.matchesKeyword`、`JobScheduleUtils.sortRecords`
- Produces: `window.JobScheduleList`；store `jobSchedules`／`setJobSchedules`；view `job-schedule-list`
- List props: `{ jobSchedules, setJobSchedules, setEditingCase, setView, showToast }`

- [ ] **Step 1: seed 加入 `INITIAL_JOB_SCHEDULES`**

插在 `src/data/seed.js` 的 `INITIAL_SURVEY_CASES` 陣列結束後、`function syncRecordStoreFields` 之前：

```js
// --- 初始模擬工作安排列表 ---
const INITIAL_JOB_SCHEDULES = [{
  id: 'JS1',
  name: '現場複測',
  description: '複測風管尺寸',
  remarks: '',
  estimatedDate: todayDate,
  estimatedTime: '09:30',
  assigneeName: '系統管理員',
  createdDate: todayDate
}, {
  id: 'JS2',
  name: '設備清點',
  description: '',
  remarks: '倉庫盤點',
  estimatedDate: yesterdayDate,
  estimatedTime: '',
  assigneeName: '系統管理員',
  createdDate: yesterdayDate
}, {
  id: 'JS3',
  name: '內部會議',
  description: '工程進度同步',
  remarks: '',
  estimatedDate: '',
  estimatedTime: '',
  assigneeName: '系統管理員',
  createdDate: twoDaysAgoDate
}];
```

- [ ] **Step 2: 權限樹**

`src/data/options.js` 的 `PERMISSION_FUNCTIONS`，在 `'現勘表收集'` 之後插入 `'工作安排'`：

```js
  '工程立案',
  '現勘表收集',
  '工作安排',
  '客戶管理',
```

`PERMISSION_TREE` 戰情室 → 工程服務：

```js
      {
        id: '工程服務',
        children: ['工程立案', '現勘表收集', '工作安排']
      },
```

- [ ] **Step 3: 側選單**

`src/shell/sidebar.js` 工程服務 children：

```js
      id: '工程服務', children: [
        { id: '工程立案', label: '工程立案' },
        { id: '現勘表收集', label: '現勘表收集' },
        { id: '工作安排', label: '工作安排' }
      ]
```

- [ ] **Step 4: 建立 `job-schedule-list.js`**

```js
/*
 * features/project/job-schedule-list.js — 工程服務：工作安排列表
 * props: { jobSchedules, setJobSchedules, setEditingCase, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
  var iconActionBtn = IESS.iconActionBtn;

  function displayCell(value) {
    return (value == null || value === '') ? '—' : String(value);
  }

  function JobScheduleList(props) {
    var jobSchedules = props.jobSchedules;
    var setJobSchedules = props.setJobSchedules;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;

    var keyword = '';
    var appliedKeyword = '';
    var deleteModal = { show: false, id: null, name: '' };
    var listPagination = IESS.createListPagination();

    return stateful(function (rerender) {
      var filtered = (function () {
        var list = jobSchedules || [];
        if (appliedKeyword.trim()) {
          list = list.filter(function (row) {
            return JobScheduleUtils.matchesKeyword(row, appliedKeyword);
          });
        }
        return JobScheduleUtils.sortRecords(list);
      })();
      var pageResult = listPagination.slice(filtered);

      function handleSearch() { appliedKeyword = keyword; listPagination.resetPage(); rerender(); }
      function handleKeyDown(e) { if (e.key === 'Enter') handleSearch(); }

      function handleDelete(id) {
        var target = (jobSchedules || []).find(function (row) { return row.id === id; });
        if (!target) {
          deleteModal = { show: false, id: null, name: '' };
          rerender();
          return;
        }
        setJobSchedules(jobSchedules.filter(function (row) { return row.id !== id; }));
        deleteModal = { show: false, id: null, name: '' };
        showToast('工作安排已刪除');
      }

      return h('div', {
        className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100'
      },
        h('div', {
          className: 'flex flex-col md:flex-row justify-between items-start mb-6 gap-4'
        },
          h('div', { className: 'bg-gray-50 p-4 rounded-lg border border-gray-200 flex-1' },
          h('div', { className: 'flex flex-wrap items-end gap-3' },
            h('div', { className: 'min-w-0' },
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '關鍵字'),
              h('input', {
                type: 'text',
                value: keyword,
                onChange: function (e) { keyword = e.target.value; rerender(); },
                onKeyDown: handleKeyDown,
                placeholder: '請輸入關鍵字',
                className: 'w-64 max-w-full p-2.5 border rounded-md outline-none bg-white'
              })
            ),
            h('button', {
              onClick: handleSearch,
              className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md shadow-sm transition-colors min-h-[42px]'
            }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋')
          )),
          iconActionBtn({
            label: '新增工作安排',
            className: 'flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors shrink-0',
            onClick: function () { setEditingCase(null); setView('job-schedule-add'); },
            icon: Icons.Plus({ className: 'h-5 w-5' })
          })
        ),
        h('div', { className: 'overflow-x-auto border rounded-lg' },
          h('table', {
            className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap'
          },
            h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
              h('tr', null,
                h('th', { className: 'p-3 font-semibold text-center w-24' }, '操作'),
                h('th', { className: 'p-3 font-semibold' }, '工作名稱'),
                h('th', { className: 'p-3 font-semibold' }, '預計日期'),
                h('th', { className: 'p-3 font-semibold' }, '預計時間'),
                h('th', { className: 'p-3 font-semibold' }, '指派人員')
              )
            ),
            h('tbody', { className: 'divide-y divide-gray-100' },
              filtered.length === 0
                ? h('tr', null,
                    h('td', { colspan: 5, className: 'p-10 text-center text-gray-400 text-base' }, '無資料'))
                : pageResult.items.map(function (row) {
                    return h('tr', { key: row.id, className: 'hover:bg-blue-50/50 transition-colors' },
                      h('td', { className: 'p-3' },
                        h('div', { className: 'flex items-center justify-center space-x-2' },
                          h('button', {
                            onClick: function () { setEditingCase(row); setView('job-schedule-edit'); },
                            className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                            title: '編輯'
                          }, Icons.Edit({ className: 'h-4 w-4' })),
                          iconActionBtn({
                            label: '刪除',
                            onClick: function () {
                              deleteModal = { show: true, id: row.id, name: row.name };
                              rerender();
                            },
                            className: 'p-1.5 text-red-600 hover:bg-red-100 rounded',
                            icon: Icons.Trash2({ className: 'h-4 w-4' })
                          })
                        )
                      ),
                      h('td', { className: 'p-3 font-medium text-gray-800' }, displayCell(row.name)),
                      h('td', { className: 'p-3' }, displayCell(row.estimatedDate)),
                      h('td', { className: 'p-3' }, displayCell(row.estimatedTime)),
                      h('td', { className: 'p-3' }, displayCell(row.assigneeName))
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
              '確定要刪除工作安排「' + deleteModal.name + '」嗎？'),
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

  window.JobScheduleList = JobScheduleList;
})();
```

- [ ] **Step 5: `index.html` 載入**

在「features / 工程服務」區塊、`survey-form.js` 之後加入（utils 須先於 list）：

```html
  <script src="src/features/project/job-schedule-utils.js"></script>
  <script src="src/features/project/job-schedule-list.js"></script>
```

- [ ] **Step 6: `app.js` store 與 list routing**

`WARROOM_SUBMENU_DEFAULT_VIEW` 在 `'現勘表收集': 'survey-list'` 之後加：

```js
    '工作安排': 'job-schedule-list',
```

store 初始狀態在 `surveyCases: INITIAL_SURVEY_CASES,` 之後加：

```js
    jobSchedules: INITIAL_JOB_SCHEDULES,
```

setter 區在 `var setSurveyCases = makeSetter('surveyCases');` 之後加：

```js
  var setJobSchedules = makeSetter('jobSchedules');
```

`renderWarroomView` 在 `survey-edit` case 之後、`customer-list` 之前加：

```js
      case 'job-schedule-list':
        return h(JobScheduleList, {
          jobSchedules: s.jobSchedules, setJobSchedules: setJobSchedules,
          setEditingCase: setEditingCase, setView: setView, showToast: showToast
        });
```

此 task 先不要加 add／edit case。點「新增」或「編輯」暫時會落到 `default: return null`，下一 task 補上。

- [ ] **Step 7: 手動驗收列表**

1. 戰情室 → 工程服務展開，可見「工作安排」（現勘表收集之後）
2. 進入後看到 3 筆 seed：現場複測（今日 09:30）在最前；內部會議無日期，預計日期／時間為「—」，排最後
3. 關鍵字「風管」只剩現場複測；「倉庫」只剩設備清點；「系統管理」3 筆都在；搜尋後按搜尋或 Enter 才套用
4. 刪除「內部會議」→ 確認彈窗 → 確認後列表少一筆，toast「工作安排已刪除」；重整後 seed 回來
5. 系統權限 → 帳號管理 → 編輯系統管理員：權限樹工程服務下有「工作安排」

---

### Task 3: 新增／編輯表單

**Files:**
- Create: `src/features/project/job-schedule-form.js`
- Modify: `index.html`（載入 form）
- Modify: `src/app.js`（add／edit routing，傳 `currentOperatorName`）

**Interfaces:**
- Consumes: `IESS.TimeInput24`、`PageHeader`、`todayDate`
- Produces: `window.JobScheduleForm`
- Form props: `{ jobSchedules, setJobSchedules, targetCase, setView, showToast, currentOperatorName }`
- Views: `job-schedule-add`、`job-schedule-edit`

- [ ] **Step 1: 建立 `job-schedule-form.js`**

```js
/*
 * features/project/job-schedule-form.js — 工程服務：新增／編輯工作安排
 * props: { jobSchedules, setJobSchedules, targetCase, setView, showToast, currentOperatorName }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, TimeInput24 = IESS.TimeInput24;

  function JobScheduleForm(props) {
    var jobSchedules = props.jobSchedules;
    var setJobSchedules = props.setJobSchedules;
    var targetCase = props.targetCase;
    var setView = props.setView;
    var showToast = props.showToast;
    var currentOperatorName = props.currentOperatorName || '';
    var isEdit = !!targetCase;

    var formData = {
      name: (targetCase && targetCase.name) || '',
      description: (targetCase && targetCase.description) || '',
      remarks: (targetCase && targetCase.remarks) || '',
      estimatedDate: (targetCase && targetCase.estimatedDate) || '',
      estimatedTime: (targetCase && targetCase.estimatedTime) || ''
    };
    var assigneeName = isEdit
      ? ((targetCase && targetCase.assigneeName) || '')
      : currentOperatorName;

    return stateful(function (rerender) {
      function handleChange(e) {
        formData[e.target.name] = e.target.value;
        rerender();
      }

      function goList() { setView('job-schedule-list'); }

      function handleSubmit(e) {
        e.preventDefault();
        var name = String(formData.name || '').trim();
        if (!name) {
          showToast('工作名稱為必填', 'error');
          return;
        }
        var payload = {
          name: name,
          description: String(formData.description || '').trim(),
          remarks: String(formData.remarks || '').trim(),
          estimatedDate: formData.estimatedDate || '',
          estimatedTime: formData.estimatedTime || ''
        };
        if (isEdit) {
          setJobSchedules(jobSchedules.map(function (row) {
            if (row.id !== targetCase.id) return row;
            return Object.assign({}, row, payload);
          }));
          showToast('工作安排更新成功');
        } else {
          var newRecord = Object.assign({
            id: 'JS' + Date.now(),
            assigneeName: currentOperatorName,
            createdDate: todayDate
          }, payload);
          setJobSchedules([newRecord].concat(jobSchedules));
          showToast('工作安排新增成功');
        }
        goList();
      }

      return h('div', {
        className: 'max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative'
      },
        PageHeader({
          title: isEdit ? '編輯工作安排' : '新增工作安排',
          badge: isEdit ? targetCase.name : null,
          onClose: goList,
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
        }),
        h('form', { onSubmit: handleSubmit, className: 'p-6' },
          h('div', { className: 'space-y-6' },
            h('div', null,
              h('label', { className: 'block text-sm mb-1' },
                '工作名稱 ', h('span', { className: 'text-red-500' }, '*')),
              h('input', {
                type: 'text',
                name: 'name',
                value: formData.name,
                onChange: handleChange,
                className: IESS.inputCls
              })
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '工作描述'),
              h('textarea', {
                name: 'description',
                value: formData.description,
                onChange: handleChange,
                rows: 3,
                className: IESS.inputCls + ' resize-none'
              })
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '備註'),
              h('textarea', {
                name: 'remarks',
                value: formData.remarks,
                onChange: handleChange,
                rows: 3,
                className: IESS.inputCls + ' resize-none'
              })
            ),
            h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '預計日期'),
                h('input', {
                  type: 'date',
                  name: 'estimatedDate',
                  value: formData.estimatedDate,
                  onChange: handleChange,
                  className: IESS.inputClsDate
                })
              ),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '預計時間'),
                h(TimeInput24, {
                  name: 'estimatedTime',
                  value: formData.estimatedTime,
                  onChange: handleChange
                })
              )
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '指派人員'),
              h('input', {
                type: 'text',
                value: assigneeName,
                readOnly: true,
                className: IESS.inputCls + ' bg-gray-50 text-gray-600 cursor-not-allowed'
              })
            )
          ),
          h('div', { className: 'flex justify-end gap-3 mt-8 pt-6 border-t' },
            h('button', {
              type: 'button',
              onClick: goList,
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

  window.JobScheduleForm = JobScheduleForm;
})();
```

編輯儲存用 `Object.assign({}, row, payload)`，`payload` 不含 `assigneeName`，因此原指派人員不會被目前操作者覆寫。

- [ ] **Step 2: `index.html` 載入 form**

緊接 `job-schedule-list.js` 之後：

```html
  <script src="src/features/project/job-schedule-form.js"></script>
```

- [ ] **Step 3: `app.js` add／edit routing**

在 `job-schedule-list` case 之後加入：

```js
      case 'job-schedule-add':
        return h(JobScheduleForm, {
          jobSchedules: s.jobSchedules, setJobSchedules: setJobSchedules,
          setView: setView, showToast: showToast,
          currentOperatorName: getCurrentOperatorName(s.accounts, s.currentAccountId)
        });
      case 'job-schedule-edit':
        return h(JobScheduleForm, {
          jobSchedules: s.jobSchedules, setJobSchedules: setJobSchedules,
          targetCase: s.editingCase, setView: setView, showToast: showToast,
          currentOperatorName: getCurrentOperatorName(s.accounts, s.currentAccountId)
        });
```

- [ ] **Step 4: 手動驗收表單**

1. 新增：名稱空白按儲存 → 紅 toast「工作名稱為必填」，仍在表單頁
2. 只填名稱「測試工作」儲存 → 回列表最前（無日期排在有日期之後，因排序規則）；指派人員為「系統管理員」
3. 新增時指派人員欄灰底不可改
4. 再新增一筆含日期、時間、描述、備註，列表欄位正確
5. 編輯「現場複測」：改名稱與備註、清空時間後儲存；指派人員仍為原值
6. 取消／頁首 X 回列表且不寫入

---

### Task 4: 端對端驗收

**Files:** 無新增（僅驗證）

- [ ] **Step 1: 對照規格驗收清單**

| # | 項目 | 預期 |
|---|------|------|
| 1 | 側邊欄＋帳號權限樹 | 「工作安排」在工程服務、現勘表收集之後 |
| 2 | 列表預設 | 顯示 seed 全部；無日期顯示「—」 |
| 3 | 關鍵字 | 名稱／描述／備註／指派人員；按鈕或 Enter |
| 4 | 新增／編輯／刪除 | CRUD 完整；刪除有確認彈窗 |
| 5 | 必填 | 只填名稱可存；日期時間可空 |
| 6 | 指派人員 | 新增＝目前操作者且唯讀；編輯不覆寫 |
| 7 | 重新整理 | 回到 seed |
| 8 | 非目標 | 案件排程日曆沒有工作安排事件 |

- [ ] **Step 2: 回歸抽查**

- 工程立案、現勘表收集仍可進入、無 console error
- 案件排程 → 案件安排日曆行為不變

---

## Spec coverage (self-review)

| Spec 章節 | Task |
|-----------|------|
| §1 目標／獨立主檔／必填規則 | Task 2–3；非目標見 Global Constraints 與 Task 4 #8 |
| §3 選單與路由／權限樹 | Task 2–3 |
| §4 資料模型／seed／store | Task 2 |
| §5.1 列表 | Task 2 |
| §5.2–5.3 新增／編輯 | Task 3 |
| §5.4 刪除 | Task 2 |
| §6 Utils 與驗證 | Task 1＋Task 3 |
| §7 檔案清單 | 全 tasks |
| §8 非目標 | 未實作日曆／多人指派／API |
| §9 驗收 | Task 4 |

**Placeholder scan:** 無 TBD／TODO；程式碼步驟含完整實作。  
**型別一致性:** `jobSchedules`、`assigneeName`、view 名稱 `job-schedule-*`、Utils 方法名全計畫一致。
