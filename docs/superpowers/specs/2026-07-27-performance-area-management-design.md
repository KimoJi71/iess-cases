# 系統權限 — 績效區域管理設計規格

**日期：** 2026-07-27  
**範圍：** 系統權限 → 績效區域管理  
**狀態：** 待實作

## 1. 目標

在「系統權限」下新增「績效區域管理」：以績效區域為獨立主檔，支援列表搜尋、新增、編輯、刪除。每筆績效區域包含區域名稱與縣市行政區清單。

約束：

- **獨立主檔**：不接到績效報表、指派人員負責區域或其他既有績效流程
- 行政區選項來源為既有台灣縣市／行政區資料（`TAIWAN_CITY_DISTRICTS`），不區分客戶名稱與店家名稱
- 同一縣市行政區**不可**同時屬於多個績效區域
- 抽出共用行政區樹狀選擇元件，指派人員表單改為使用該元件（行為不變）

## 2. 架構決策

採 **list／add／edit 全頁表單**（與設備分類、指派人員一致），並先抽出共用 picker：

| 項目 | 決策 |
|------|------|
| UI 模式 | 列表 + 全頁新增／編輯表單（非 Modal） |
| 行政區選擇 | 新建 `DistrictTreePicker`，供指派人員與績效區域共用 |
| 資料存放 | 全域 store 陣列 `performanceAreas`（記憶體，與其他主檔相同） |
| 與指派人員關係 | 僅共用 picker UI；`assignee.districts` 與 `performanceArea.districts` 資料互不連動 |
| 行政區互斥 | 僅套用在績效區域之間；不影響指派人員可選範圍 |

## 3. 選單與路由

### Sidebar

於 `permissions-sidebar.js` 的 `MENU_ITEMS` 追加：`績效區域管理`。

### Views

| view | 元件 | 說明 |
|------|------|------|
| `performance-area-list` | `PerformanceAreaList` | 列表＋搜尋＋刪除確認 |
| `performance-area-add` | `PerformanceAreaForm` | 新增 |
| `performance-area-edit` | `PerformanceAreaForm` | 編輯（以 `editingCase` 帶入） |

- `PERMISSIONS_SUBMENU_DEFAULT_VIEW['績效區域管理'] = 'performance-area-list'`
- `app.js` 的 `renderPermissionsView` 增加對應 case
- `index.html` 載入：`district-tree-picker.js`、`performance-area-utils.js`、list、form（utils／picker 在前）

### 帳號權限樹

於 `options.js` 的 `PERMISSION_FUNCTIONS`／`PERMISSION_TREE`「系統權限」子項加入 `績效區域管理`。

## 4. 資料模型

### 績效區域（performanceArea）

```js
{
  id: 'PA1',
  name: '北區',
  districts: ['台北市信義區', '台北市大安區'],  // city + district 合併字串
  createdDate: '2026-07-27'
}
```

規則：

- `id`：新增時 `'PA' + Date.now()`
- `name`：必填；同名不可重複（編輯時排除自身）
- `districts`：至少一個；每個字串為既有「縣市＋行政區」組合
- 行政區互斥：任一 `district` 字串在同一時間最多屬於一個績效區域

### Store

```js
performanceAreas: INITIAL_PERFORMANCE_AREAS
setPerformanceAreas(v)
```

Seed 提供 2～3 筆示範資料，行政區互不重疊。

頁面 props：

- List：`performanceAreas`、`setPerformanceAreas`、`setEditingCase`、`setView`、`showToast`
- Form：`performanceAreas`、`setPerformanceAreas`、`editingCase`、`setEditingCase`、`setView`、`showToast`

## 5. 共用元件：DistrictTreePicker

**檔案：** `src/features/permissions/district-tree-picker.js`  
**全域：** `window.DistrictTreePicker`

從 `assignee-form.js` 抽出縣市展開、縣市全選／半選（indeterminate）、行政區葉節點勾選邏輯。

### Props

| prop | 型別 | 說明 |
|------|------|------|
| `selectedDistricts` | `string[]` | 目前已選行政區（合併字串） |
| `onChange` | `(districts: string[]) => void` | 選取變更 |
| `disabledDistricts` | `string[]`（可選） | 不可勾選的行政區；已選中者若在此清單應視為衝突狀態，由表單驗證擋儲存 |

### 行為

- 選項來源：`TAIWAN_CITY_DISTRICTS`（與現況一致）
- 葉節點值：`city + district`（如 `台北市信義區`）
- `disabledDistricts` 內的項目：顯示但不可勾選（checkbox disabled）；縣市全選略過 disabled 葉節點
- 指派人員表單：不傳 `disabledDistricts`，重構後行為與現況相同
- 績效區域表單：傳入「其他績效區域已占用」的行政區

### 重構範圍

- `assignee-form.js` 改為呼叫 `DistrictTreePicker`，刪除內嵌重複 UI／狀態邏輯
- 不改變 `assignee.districts` 的儲存格式與驗證

## 6. 畫面與操作

### 6.1 顯示績效區域列表

- 進入頁面預設顯示全部績效區域
- 篩選欄位：關鍵字；按搜尋或 Enter 才套用（非即時篩選）
- 關鍵字比對：區域名稱、行政區清單顯示字串（不分大小寫）
- 列表欄位：操作｜區域名稱｜縣市行政區清單
- 行政區顯示：沿用 `AccountUtils.formatDistricts`
- 分頁：沿用 `IESS.createListPagination`
- 右上角「新增績效區域」→ `setEditingCase(null)` + `setView('performance-area-add')`

### 6.2 新增績效區域

- 全頁表單欄位：區域名稱、縣市行政區清單（`DistrictTreePicker`）
- 縣市行政區從既有縣市＋行政區選項勾選（不區分客戶／店家名稱）
- 儲存通過驗證後寫入 store，回列表並 toast 成功

### 6.3 查看／編輯績效區域

- 列上「編輯」→ `setEditingCase(record)` + `setView('performance-area-edit')`
- 表單帶入既有 `name`、`districts`
- `disabledDistricts` = 其他績效區域（排除自身）已占用的行政區
- 儲存通過驗證後更新 store，回列表

### 6.4 刪除績效區域

- 列上「刪除」→ 確認彈窗（`app-modal-overlay`）
- 確認後自 store 移除；獨立主檔，不做引用檢查

## 7. 驗證與錯誤處理

由 `performance-area-utils.js`（`window.PerformanceAreaUtils`）集中處理：

| 條件 | 行為 |
|------|------|
| 區域名稱空白 | toast 錯誤，不儲存 |
| 名稱與其他績效區域重複 | toast 錯誤，不儲存 |
| 未選任何行政區 | toast 錯誤，不儲存 |
| 所選行政區已被其他績效區域占用 | toast 錯誤，不儲存 |
| 全部通過 | 寫入 store、toast 成功、回列表 |

Utils 建議方法：

- `findDuplicateName(performanceAreas, name, excludeId)`
- `findConflictingDistricts(performanceAreas, districts, excludeId)` — 回傳衝突的行政區字串陣列
- `getOccupiedDistricts(performanceAreas, excludeId)` — 供 form 的 `disabledDistricts`

## 8. 檔案清單

| 檔案 | 動作 |
|------|------|
| `src/features/permissions/district-tree-picker.js` | 新建 |
| `src/features/permissions/performance-area-utils.js` | 新建 |
| `src/features/permissions/performance-area-list.js` | 新建 |
| `src/features/permissions/performance-area-form.js` | 新建 |
| `src/features/permissions/assignee-form.js` | 改為使用 `DistrictTreePicker` |
| `src/shell/permissions-sidebar.js` | 選單項目 |
| `src/data/options.js` | 權限樹 |
| `src/data/seed.js` | `INITIAL_PERFORMANCE_AREAS` |
| `src/app.js` | store、setter、submenu default view、routing |
| `index.html` | script 標籤 |

## 9. 非目標（本次不做）

- 接到案件績效報表、季度目標、`PERFORMANCE_*` 選項
- 與指派人員 `districts` 雙向同步或互相鎖定
- 後端 API／持久化（維持記憶體 store）
- 復原已刪除的「行政區域管理」（北中南東粗分區）

## 10. 驗收標準

1. 側邊欄與帳號權限樹出現「績效區域管理」
2. 列表預設顯示全部；關鍵字搜尋可篩選名稱與行政區
3. 可新增、編輯、刪除績效區域；刪除有確認彈窗
4. 行政區選擇為縣市樹狀多選；來源為既有台灣行政區，不出現客戶／店家名稱
5. 已被其他績效區域占用的行政區在表單中不可勾選；若仍有衝突，儲存會被擋下
6. 指派人員表單的行政區選擇行為與重構前一致（可重疊、無 disabled 限制）
7. 重新整理後 seed／記憶體資料行為與其他系統權限主檔一致
