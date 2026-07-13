# 案件安排（案件排程）設計規格

**日期：** 2026-07-13  
**範圍：** 頂部選單重構 → 案件排程 → 案件安排  
**狀態：** 待實作

## 1. 目標

在頂部主選單新增與「戰情室」同層的「案件排程」模組，其下實作「案件安排」子功能：提供週檢視排程日曆、待安排案件查詢與拖曳排程、以及手動新增排程（寫入叫修案件紀錄並同步人員動向）。

## 2. 架構決策

### 2.1 頂部選單

僅保留兩個主選單項：**戰情室**、**案件排程**。移除首頁、案件管理、設備管理、系統設定。

### 2.2 頁面佈局（方案 ①）

左側待安排案件清單 + 右側 FullCalendar 週檢視。拖放從左側清單拖入日曆格。

### 2.3 排程資料策略（方案 A）

不建立獨立 `schedules` 表。排程資訊直接寫入各案件集的 `planDate`、`planTimeStart`、`planTimeEnd`、`assignee`（工程案件寫入 `stageAssignee`）。日曆事件由各案件集聚合讀取。

### 2.4 日曆元件

採 FullCalendar v6 CDN（含 `interaction` plugin），命令式掛載於 `ref` 容器，避免 `stateful` 重繪摧毀日曆實例。

## 3. 選單與路由

### 頂部主選單（header.js）

```js
var menus = ['戰情室', '案件排程'];
```

### 案件排程側邊選單（scheduling-sidebar.js，新建）

```
案件排程 選單
└── 案件安排
```

### Views（app.js）

| view | 元件 | 說明 |
|------|------|------|
| `arrangement` | `CaseArrangement` | 案件安排主頁 |
| `arrangement-add` | `ScheduleAddForm` | 新增排程（Modal 或全頁） |

`SCHEDULING_SUBMENU_DEFAULT_VIEW['案件安排'] = 'arrangement'`

切換 `currentTopMenu` 時：
- `戰情室` → 顯示現有 `Sidebar`（維修／工程／客戶建檔）
- `案件排程` → 顯示 `SchedulingSidebar`

`renderMain` 需分別處理兩個頂層模組的路由，不再對非戰情室顯示「開發中」佔位。

## 4. 資料模型

### 4.1 共用排程欄位（三種案件皆新增）

```js
planDate: '',          // YYYY-MM-DD
planTimeStart: '',     // HH:mm
planTimeEnd: ''        // HH:mm
```

既有 `maintenanceCases` 已有 `planDate`、`assignee`；叫修 `cases`、工程 `projectCases` 需補上三個時間欄位。

### 4.2 待安排判定

| 來源 | store 鍵 | 條件 | 工作項目類別顯示 |
|------|----------|------|-----------------|
| 保養 | `maintenanceCases` | `status === '待排程'` 且 `!isClosed` | `'保養清潔'` |
| 叫修 | `cases` | `assignee === '案件待辦'` 且 `!planDate` 且 `!isClosed` | `workCategory` |
| 工程 | `projectCases` | `stageAssignee === '尚未指派'` 且 `!planDate` 且 `!isClosed` | `workCategory` |

待安排清單項目需帶 `sourceType`（`maintenance` / `repair` / `project`）與 `sourceId`，供拖放後定位原案件。

### 4.3 排程後更新規則

拖入日曆並確認時段後自動儲存：

| 來源 | 更新欄位 | 狀態變更 |
|------|----------|----------|
| 保養 | `planDate`, `planTimeStart`, `planTimeEnd`, `assignee` | `status → '已排程'` |
| 叫修 | 同上 | `assignee` 脫離「案件待辦」 |
| 工程 | `planDate`, `planTimeStart`, `planTimeEnd`, `stageAssignee` | `stageAssignee` 脫離「尚未指派」 |

### 4.4 人員動向（personnelStatus）

store 新增 `personnelStatus` 陣列：

```js
{
  id: 'PS1',
  assignee: 'A組',
  date: '2026-07-14',
  timeStart: '09:00',
  timeEnd: '11:00',
  customerName: '屈臣氏',
  storeName: '台北信義店',
  workCategory: '保養清潔',
  sourceType: 'maintenance',  // maintenance | repair | project | manual
  sourceId: 'M2026070001'
}
```

排程（拖放或新增）時，依 `sourceType + sourceId` 刪除舊紀錄後新增；`manual` 類型用於「新增排程」表單建立之叫修案件。

本次僅在 store 維護資料，不實作獨立查詢頁面。

### 4.5 Seed 資料補充（seed.js）

- **叫修**：新增 1–2 筆 `assignee: '案件待辦'`、`planDate: ''`
- **工程**：新增 1 筆 `stageAssignee: '尚未指派'`、`planDate: ''`
- **人員動向**：依既有已排程保養單（如 M2026070002）預填 2–3 筆
- 既有已排程案件補上 `planTimeStart` / `planTimeEnd`（如 `09:00` / `11:00`）

## 5. 案件安排主頁（CaseArrangement）

### 5.1 頂部篩選列（日曆用）

| 欄位 | 控制項 | 預設 |
|------|--------|------|
| 開始日期 | date | 本週週一 |
| 結束日期 | date | 本週週日 |
| 指派組別 | select（含「全部」） | 全部 |

點 **[查詢]** 更新日曆事件範圍。進入頁面時自動以本週為預設並載入。

右上角 **[+ 新增案件排程]** → 開啟 `ScheduleAddForm`（建議 Modal）。

### 5.2 左側：待安排案件

**篩選：**

| 欄位 | 控制項 |
|------|--------|
| 工作項目類別 | select（全部、保養清潔、一般叫修、緊急叫修、新開、汰換…） |
| 客戶名稱 | select（全部 + customers） |
| 行政區域 | select（全部 + DISTRICT_OPTIONS） |
| 指派組別 | select（全部 + ASSIGNEES） |

點 **[查詢]** 顯示符合 §4.2 條件且通過篩選的案件列表。

**列表顯示：** 客戶名稱、門市名稱（規格圖僅列此兩欄；可副標顯示工作類別）。

**拖放：** 每列設為 FullCalendar `Draggable` 外部事件源，拖入日曆後開啟時段 Modal。

### 5.3 右側：排程日曆

- FullCalendar `timeGridWeek` 檢視
- 事件來源：三種案件中 `planDate` 落在篩選區間內且 `planTimeStart` 有值的案件
- 事件標題：`{assignee} {customerName} {storeName}`；tooltip 或 extendedProps 含工作類別
- 可依「指派組別」篩選隱藏非選定組別事件
- 語系：`zh-tw` 或自訂 `buttonText`

### 5.4 拖放時段 Modal

拖入日曆格後彈出：

| 欄位 | 說明 |
|------|------|
| 日期 | 唯讀，取自拖放目標格 |
| 開始時間 | time，預設 09:00 |
| 結束時間 | time，預設 11:00 |
| 指派組別 | select，預設 A組 |

點確認 → 執行 §4.3 更新 + §4.4 人員動向同步 → toast「排程已儲存」→ 刷新日曆與待安排清單。

## 6. 新增排程表單（ScheduleAddForm）

### 欄位

| 欄位 | 控制項 | 備註 |
|------|--------|------|
| 工作名稱 | text | 必填 |
| 客戶名稱 | select | 來源 `customers` |
| 門市名稱 | select | 依客戶過濾 `stores`；未選客戶時 disabled |
| 門市地址 | 唯讀 | 依門市 `companyAddress` 帶入 |
| 服務等級 | 唯讀 | 依門市 `serviceLevel` 帶入 |
| 安排人員 | 唯讀 | 固定「管理員」 |
| 工作說明 | textarea | |
| 指派組別 | select | `SCHEDULE_ASSIGNEE_OPTIONS` |
| 預定日期 | date | 必填 |
| 預定開始時間 | time | 必填 |
| 預定結束時間 | time | 必填 |

### 儲存行為

1. 新增一筆 `cases`（叫修案件紀錄）：
   - `workCategory`: 工作名稱欄位值
   - `faultDesc`: 工作說明
   - `customerName`, `storeName`, `storeAddress`, `serviceLevel`
   - `assignee`: 選定組別
   - `planDate`, `planTimeStart`, `planTimeEnd`
   - `processStatus`: `'尚未處理完成'`
   - `repairDate`: 預定日期
   - 其餘欄位比照 `AddCaseForm` 預設值
2. 新增 `personnelStatus`（`sourceType: 'manual'`, `sourceId` 為新案件 id）
3. 關閉表單，日曆顯示新事件
4. toast「排程已新增」

## 7. FullCalendar 整合（calendar-bridge.js）

封裝職責：

- `initCalendar(container, options)` — 建立 Calendar 實例
- `setEvents(events)` — 重設事件來源
- `initExternalDrag(pendingItems, onDrop)` — 左側清單 Draggable
- `destroyCalendar()` — 卸載實例
- `getWeekRange(date)` — 回傳本週週一／週日

整合要點：

- `CaseArrangement` 以 `stateful` 管理篩選與 Modal 狀態
- 日曆 DOM 以 `ref` 掛載，僅在容器首次建立或日期區間變更時重建
- store 資料變更（排程儲存後）透過 callback 呼叫 `setEvents`，不觸發整頁 `stateful` 重繪日曆區

### index.html CDN

```html
<script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js"></script>
```

若需外部拖放，一併載入 `@fullcalendar/interaction`（或確認 global bundle 已含）。

## 8. 選項常數（options.js）

新增：

```js
const SCHEDULE_ASSIGNEE_OPTIONS = ['A組', 'B組', 'C組', 'D組', '督導', '協力廠商', '案件待辦'];
const SCHEDULE_WORK_CATEGORY_OPTIONS = ['保養清潔', '一般叫修', '緊急叫修', '新開', '汰換', '撤店', '整裝', '加裝'];
```

`ASSIGNEES` 沿用於叫修；排程表單與日曆篩選使用 `SCHEDULE_ASSIGNEE_OPTIONS`（含「督導」）。

## 9. 檔案異動清單

| 檔案 | 變更 |
|------|------|
| `src/shell/header.js` | 主選單只留戰情室、案件排程 |
| `src/shell/scheduling-sidebar.js` | **新增** 案件排程側邊選單 |
| `src/app.js` | 雙模組路由、`personnelStatus`、setter、`SCHEDULING_SUBMENU_DEFAULT_VIEW` |
| `src/data/seed.js` | 補 seed、`INITIAL_PERSONNEL_STATUS`、時間欄位 |
| `src/data/options.js` | `SCHEDULE_ASSIGNEE_OPTIONS`、`SCHEDULE_WORK_CATEGORY_OPTIONS` |
| `src/features/scheduling/case-arrangement.js` | **新增** 主頁 |
| `src/features/scheduling/schedule-add-form.js` | **新增** 新增排程 |
| `src/features/scheduling/calendar-bridge.js` | **新增** FullCalendar 封裝 |
| `index.html` | FullCalendar CDN + 新 script |

## 10. 非範圍（本次不做）

- 人員動向獨立查詢／列表頁面
- 日曆上拖移已排程事件以變更時間（僅支援從待安排拖入）
- 案件排程下其他子功能
- 後端 API 串接
- 叫修待安排列表顯示設備名稱（規格備註待確認，本次不顯示）

## 11. 驗收標準

1. 頂部只剩「戰情室」「案件排程」，切換正常
2. 「案件排程」側邊可進入「案件安排」
3. 進入案件安排，日曆預設顯示本週已排程案件
4. 待安排清單正確列出保養／叫修／工程三種來源案件
5. 篩選可查詢日曆與待安排清單
6. 拖曳待安排案件至日曆、設定時段後自動儲存，原案件與 `personnelStatus` 同步更新
7. 「新增案件排程」可寫入 `cases` 並出現在日曆與人員動向
8. UI 風格對齊現有白底卡片、Tailwind 樣式
