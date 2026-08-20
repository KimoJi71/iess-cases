# 戰情室 — 工程服務「工作安排」設計規格

**日期：** 2026-08-20  
**範圍：** 戰情室 → 工程服務 → 工作安排  
**狀態：** 待實作

## 1. 目標

在「工程服務」下新增「工作安排」：獨立主檔，支援列表搜尋、新增、編輯、刪除。每筆紀錄包含工作名稱、工作描述、備註、預計日期、預計時間、指派人員。

約束：

- **獨立主檔**：不接到工程立案、現勘表、案件排程日曆或其他既有流程
- 指派人員不可由使用者挑選；新增時寫入目前操作者帳號名稱，編輯時維持原值
- 必填只有工作名稱；預計日期、預計時間可空
- 後端／持久化不做（記憶體 store，重整後回到 seed）

## 2. 架構決策

採 **list／add／edit 全頁表單**（與廠商管理、績效區域管理一致）：

| 項目 | 決策 |
|------|------|
| UI 模式 | 列表 + 全頁新增／編輯表單（非 Modal） |
| 資料存放 | 全域 store 陣列 `jobSchedules`（記憶體） |
| 與其他功能關係 | 無連動 |
| 時間輸入 | 沿用既有 `IESS.TimeInput24`（HH:mm） |
| 日期輸入 | 原生 `input type="date"`（YYYY-MM-DD） |

## 3. 選單與路由

### Sidebar

於 `src/shell/sidebar.js` 的「工程服務」`children` 追加 `{ id: '工作安排', label: '工作安排' }`，置於「現勘表收集」之後。

### Views

| view | 元件 | 說明 |
|------|------|------|
| `job-schedule-list` | `JobScheduleList` | 列表＋搜尋＋刪除確認 |
| `job-schedule-add` | `JobScheduleForm` | 新增 |
| `job-schedule-edit` | `JobScheduleForm` | 編輯（以 `editingCase` 帶入） |

- `WARROOM_SUBMENU_DEFAULT_VIEW['工作安排'] = 'job-schedule-list'`
- `app.js` 的 `renderWarroomView` 增加對應 case
- Form 需傳入 `currentOperatorName`（與叫修表單相同，來自 `getCurrentOperatorName(accounts, currentAccountId)`）
- `index.html` 於「features / 工程服務」區塊載入：`job-schedule-utils.js`、`job-schedule-list.js`、`job-schedule-form.js`（utils 在前）

### 帳號權限樹

於 `options.js` 的 `PERMISSION_FUNCTIONS` 與 `PERMISSION_TREE`「工程服務」`children` 加入 `工作安排`（置於「現勘表收集」之後）。既有 `_buildAllPermissions()` 會依 `PERMISSION_FUNCTIONS` 產生，重整後管理員帳號自動含此葉項。

## 4. 資料模型

### 工作安排（jobSchedule）

```js
{
  id: 'JS1',
  name: '現場複測',
  description: '複測風管尺寸',
  remarks: '',
  estimatedDate: '2026-08-21', // YYYY-MM-DD，可空字串
  estimatedTime: '09:30',      // HH:mm，可空字串
  assigneeName: '系統管理員',  // 新增時寫入目前操作者名稱
  createdDate: '2026-08-20'
}
```

規則：

- `id`：新增時 `'JS' + Date.now()`
- `name`：必填；trim 後不可空白。名稱可重複
- `description`、`remarks`：選填
- `estimatedDate`、`estimatedTime`：選填；各自可空，不要求成對填寫
- `assigneeName`：新增時寫入 `currentOperatorName`；編輯時不覆寫。表單欄位唯讀。若編輯時原資料沒有指派人員，維持空值，不改成目前操作者

### Store

```js
jobSchedules: INITIAL_JOB_SCHEDULES
setJobSchedules(v)
```

Seed 提供 2～3 筆示範資料，涵蓋：有日期時間、只有名稱、指派人員為目前 demo 操作者（`ACC1`「系統管理員」）。日期使用 `todayDate` 等相對常數，不寫死日曆日。

頁面 props：

- List：`jobSchedules`、`setJobSchedules`、`setEditingCase`、`setView`、`showToast`
- Form：`jobSchedules`、`setJobSchedules`、`targetCase`、`setView`、`showToast`、`currentOperatorName`

## 5. 畫面與操作

### 5.1 顯示工作安排列表

- 進入頁面預設顯示全部工作安排
- 篩選欄位：關鍵字；按搜尋或 Enter 才套用（非即時篩選）
- 關鍵字比對：工作名稱、工作描述、備註、指派人員（trim、不分大小寫）
- 列表欄位：操作｜工作名稱｜預計日期｜預計時間｜指派人員
- 空值顯示「—」
- 排序：預計日期新到舊；沒日期的排最後；同日再比預計時間（空時間排該日最後）；再比 `createdDate`
- 分頁：沿用 `IESS.createListPagination`
- 右側「新增工作安排」（圓形 Plus，與其他列表一致）→ `setEditingCase(null)` + `setView('job-schedule-add')`

### 5.2 新增工作安排

全頁表單欄位：

| 欄位 | 必填 | 元件 |
|------|------|------|
| 工作名稱 | 是 | text |
| 工作描述 | 否 | textarea |
| 備註 | 否 | textarea |
| 預計日期 | 否 | `input type="date"` |
| 預計時間 | 否 | `TimeInput24` |
| 指派人員 | — | 唯讀灰底，帶入 `currentOperatorName` |

按鈕：取消（回列表）、儲存。通過驗證後插入 store 最前，toast「工作安排新增成功」，回列表。

### 5.3 查看／編輯工作安排

- 列上「編輯」→ `setEditingCase(record)` + `setView('job-schedule-edit')`
- 表單帶入既有欄位；指派人員顯示原 `assigneeName`，唯讀，儲存不覆寫
- 通過驗證後更新該筆，toast「工作安排更新成功」，回列表

### 5.4 刪除工作安排

- 列上「刪除」→ 確認彈窗（`app-modal-overlay`），文案含工作名稱
- 確認後自 store 移除，toast「工作安排已刪除」
- 獨立主檔，不做引用檢查

## 6. 驗證與錯誤處理

由 `job-schedule-utils.js`（`window.JobScheduleUtils`）集中關鍵字比對與排序：

| 條件 | 行為 |
|------|------|
| 工作名稱空白（含只空白字元） | toast 錯誤「工作名稱為必填」，不儲存 |
| 全部通過 | 寫入 store、toast 成功、回列表 |

Utils 方法：

- `matchesKeyword(record, keyword)` — 比對名稱、描述、備註、指派人員
- `sortRecords(records)` — 回傳依 5.1 規則排序的新陣列

不做名稱唯一檢查、不做日期／時間格式以外的驗證（瀏覽器 date 與 `TimeInput24` 已限制格式）。

## 7. 檔案清單

| 檔案 | 動作 |
|------|------|
| `src/features/project/job-schedule-utils.js` | 新建 |
| `src/features/project/job-schedule-list.js` | 新建 |
| `src/features/project/job-schedule-form.js` | 新建 |
| `src/shell/sidebar.js` | 工程服務選單項目 |
| `src/data/options.js` | `PERMISSION_FUNCTIONS`／`PERMISSION_TREE` |
| `src/data/seed.js` | `INITIAL_JOB_SCHEDULES` |
| `src/app.js` | store、setter、submenu default view、routing |
| `index.html` | script 標籤 |

## 8. 非目標（本次不做）

- 接到案件排程日曆、人員動向、工程立案、現勘表
- 指派給其他人、多人選派、狀態流程
- 權限實際攔截（與其他戰情室頁相同，僅權限樹可勾選）
- 後端 API／localStorage 持久化

## 9. 驗收標準

1. 側邊欄與帳號權限樹出現「工作安排」（工程服務、現勘表收集之後）
2. 列表預設顯示全部；關鍵字可篩選名稱、描述、備註、指派人員
3. 可新增、編輯、刪除；刪除有確認彈窗
4. 只填工作名稱即可儲存；預計日期、預計時間可空，列表顯示「—」
5. 新增時指派人員為目前操作者且不可改；編輯時指派人員維持原值
6. 重新整理後 seed／記憶體資料行為與其他戰情室主檔一致
