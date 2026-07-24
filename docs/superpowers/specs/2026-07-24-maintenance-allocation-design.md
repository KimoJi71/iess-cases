# 系統權限 — 保養分配設計規格

**日期：** 2026-07-24  
**範圍：** 系統權限 → 保養分配  
**狀態：** 待實作

## 1. 目標

在「系統權限」下新增獨立的「保養分配」功能：依指派人員顯示客戶 × 月份網格，供設定各月保養次數與目標完成數。此為獨立規劃資料，**不產生、不修改**保養案件。

約束：以新檔與註冊為主，不改動既有帳號／指派人員／設備分類／處理方式等功能邏輯。服務等級選項需全域改名並同步 seed／既有資料字串。

## 2. 架構決策

採 **獨立單頁 + 編輯 Modal**（非 list／edit 雙 view，亦不嵌在指派人員表單內）：

- 全域 store 新增 `maintenanceAllocations` 陣列
- 新元件 `MaintenanceAllocation`（`window.MaintenanceAllocation`）
- 純邏輯放 `MaintenanceAllocationUtils`（篩選客戶、門市數、格點文字、驗證）
- 編輯／刪除在同一 view 內以 Modal／confirm 完成，不另開 view

## 3. 選單與路由

### Sidebar

於 `permissions-sidebar.js` 的 `MENU_ITEMS` 追加：`保養分配`。

### Views

| view | 元件 | 說明 |
|------|------|------|
| `maintenance-allocation` | `MaintenanceAllocation` | 唯一進入頁（含網格與編輯 Modal） |

- `PERMISSIONS_SUBMENU_DEFAULT_VIEW['保養分配'] = 'maintenance-allocation'`
- `app.js` 的 `renderPermissionsView` 增加對應 case
- `index.html` 載入新 script（utils 在前、頁面在後）

### 帳號權限樹

於 `options.js` 的 `PERMISSION_FUNCTIONS`／`PERMISSION_TREE`「系統權限」子項加入 `保養分配`，讓帳號權限設定可勾選。

## 4. 資料模型

### 分配紀錄（maintenanceAllocation）

一格一筆；**不含 year**（畫面固定對應月份 1–12）。

```js
{
  id: 'MA1',
  assigneeId: 'ASG1',       // 指派人員（組）id
  customerName: '星巴克',
  month: 3,                 // 1–12
  visitIndex: 1,            // 第 N 次
  targetCount: 5            // 目標完成數
}
```

唯一性：同一 `assigneeId` + `customerName` + `month` 最多一筆；存檔時 upsert。

### Store

```js
maintenanceAllocations: INITIAL_MAINTENANCE_ALLOCATIONS  // seed 可給少量示範資料
setMaintenanceAllocations(v)
```

頁面 props：`assignees`、`customers`、`stores`、`maintenanceAllocations`、`setMaintenanceAllocations`、`showToast`。

## 5. 服務等級全域改名

| 新值 | 舊值 |
|------|------|
| `A 保修(一年一次)` | `保修(一年一次)` |
| `B 保修(一年兩次)` | `保修(一年兩次)` |
| `C 保養(一年一次)` | `保養(一年一次)` |
| `D 維修(無簽約客戶)` | `維修(無簽約客戶)` |

更新範圍：

- `SERVICE_LEVEL_OPTIONS`
- `CUSTOMER_SERVICE_LEVEL_MAP`（及其他硬編碼舊字串）
- `seed.js` 客戶／門市／案件等 `serviceLevel` 欄位

保養分配客戶帶入僅含 **A／B／C**（排除 D）。

## 6. 客戶列自動帶入規則

選定指派人員後，列出符合以下條件的客戶（一列一客戶）：

1. 以**門市**為單位篩選：非撤店（`StoreUtils.isActiveStore`）、行政區落在該指派人員 `districts`（`assigneeCoversArea`）、門市 `serviceLevel` 為 A／B／C（排除 D）
2. 客戶列：至少有一間符合上列條件的門市
3. **負責門市數**：該客戶符合上列條件的門市數量
4. **保養區間**：取自客戶 `maintenanceInterval`（`每季`／`每半年`／`每年`）

無符合客戶時顯示空狀態文案。

## 7. 畫面與操作

### 篩選

- 「指派人員」下拉（來源 `assignees`）
- 未選：不顯示網格，提示先選擇

### 網格

| 固定欄 | 內容 |
|--------|------|
| 客戶名稱 | 自動帶入 |
| 負責門市數 | 見 §6 |
| 保養區間 | 客戶欄位 |
| 1–12 月 | 儲存格 |

- 儲存格有資料：顯示「第N次 {數量}」（例：`第1次 5`）；無資料：空白
- 橫向捲動：`useDragScroll`

### 編輯（點格子 → Modal）

| 欄位 | 行為 |
|------|------|
| 月份 | 唯讀（來自被點的格） |
| 保養次數 | 依區間：每季 1–4、每半年 1–2、每年僅 1 |
| 目標完成數 | 數字輸入 |

- ［儲存］：upsert 該格；執行驗證（見 §8），僅 toast／提示，**不擋存檔**
- 取消／關閉：不寫入

### 刪除

有資料的格子提供［刪除］→ confirm → 移除該筆，格子變空白。

## 8. 驗證（不擋存檔）

存檔時檢查並以 toast／提示呈現（可一併顯示多則）：

1. **單月超量：** `targetCount` > 負責門市數 → 警示
2. **同一次數合計：** 同一 `assigneeId` + `customerName` + `visitIndex` 在各月的 `targetCount` 加總（含本次存檔後）≠ 負責門市數 → 提示不足或超量（需帶出目前合計與應有門市數）

先填第一筆時合計通常不符，故刻意不阻擋存檔。

## 9. 刻意不做

- 不產生／不修改 `maintenanceCases` 或排程邏輯
- 不加 year 欄位或年份選擇器
- 不改既有帳號／指派人員／設備分類／處理方式 list／form 行為（僅選單註冊與服務等級字串對齊）
- 不將此功能嵌進指派人員表單

## 10. 檔案變更清單

| 檔案 | 變更 |
|------|------|
| `src/features/permissions/maintenance-allocation-utils.js` | **新增** |
| `src/features/permissions/maintenance-allocation.js` | **新增** |
| `src/shell/permissions-sidebar.js` | 追加選單項 |
| `src/app.js` | 路由、store、props |
| `index.html` | script 標籤 |
| `src/data/options.js` | 權限樹 + `SERVICE_LEVEL_OPTIONS` |
| `src/data/seed.js` | 服務等級字串 + 可選示範分配資料 |

## 11. 成功標準

- 系統權限可進入「保養分配」，選指派人員後見客戶 × 月份網格
- 點格可編輯並存檔；刪除可清空；驗證僅提示不擋存
- 客戶列／門市數符合行政區 + A／B／C 規則
- 全站服務等級顯示為 A／B／C／D 新字串
- 既有帳號／指派人員等頁面功能行為不變
