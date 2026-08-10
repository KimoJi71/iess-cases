# 保養計劃進度：保養區間欄位與區間驅動排程

日期：2026-08-10

## 背景

「保養計劃進度」列表（`src/features/repair/maintenance.js` 的 `MaintenanceList`）目前：

- 「保養日期」欄未填保養日期時顯示 `2026-06（未保養）`。
- 月份篩選拿 `planDate`（沒有就 `dueMonth`）的月份與「開始／結束月份」比對。
- 保養單由 `ScheduleUtils.generateDueMaintenanceCases` 依門市 `lastMaintenanceDate` 加上「12 ÷ 服務等級年保養次數」的間隔月數推算到期月產生。

而「保養區間」（第N次、起訖月）已經是客戶檔的資料（`customer.periods`，見 `src/features/customer/customer-utils.js`），例如屈臣氏為 1-3 / 4-6 / 7-9 / 10-12 四個區間。列表沒有呈現它，排程也沒有用它。

## 目標

1. 列表新增「保養區間」欄，顯示該筆案件所屬的區間，格式 `第3次 7-9月`。
2. 「保養日期」欄未填時清空（不再顯示 `2026-06（未保養）`）。
3. 列表顯示「當月被區間涵蓋且尚未完成」的保養案件。例如現在是 8 月，屈臣氏第3次區間為 7~9 月，某門市該次尚未完成保養，就要出現在列表。
4. 保養單改為「每個保養區間一筆」：不論上一個區間是否完成，進入下一個區間就重新建立一筆。

## 非目標

- 篩選列的 UI 不改動（欄位、預設值、搜尋按鈕維持原樣），只改比對邏輯。
- 不調整客戶保養區間的設定介面。
- 不改動排序、分頁、結案流程。

## 設計

### 1. 資料模型

保養案件（maintenanceCase）新增兩個欄位，讓「這筆屬於哪一次保養」成為案件自身的身分，不再每次從日期回推：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `periodYear` | number | 區間所屬年份，如 `2026` |
| `periodVisitIndex` | number | 第幾次，如 `3` |

`dueMonth` 保留，改填該區間的起始月（第3次 7-9月 → `2026-07`）。`case-review.js`、`data-retrieval-utils.js`、`store-utils.js` 都以它作為日期／排序基準，語意仍成立。

既有 seed 案件沒有這兩個欄位，在初始化時回填：以 `planDate`（沒有就 `dueMonth`）的年月查該客戶的區間；查不到就留空，該筆不會被月份篩選命中。

### 2. 工具函式

沿用 `CustomerUtils.findPeriodForMonth(customers, customerName, month)`（已存在，只回傳「可用」區間）。

`src/features/scheduling/schedule-utils.js` 新增並匯出：

- `resolveCasePeriod(maintenanceCase, customers)` → `{ year, visitIndex, startMonth, endMonth }` 或 `null`
  - 優先用案件的 `periodYear` / `periodVisitIndex` 到客戶區間查起訖月。
  - 查不到時（舊案件）用 `planDate` → `dueMonth` 的年月回推。
  - 客戶無區間、或月份對不到任何區間 → `null`。
- `formatPeriodRange(period)` → `第3次 7-9月`；`null` 回 `—`。
- `periodMonthRange(period)` → `{ start: 'YYYY-MM', end: 'YYYY-MM' }`，供月份篩選比對；`null` 回 `null`。

### 3. 產生邏輯：`generateDueMaintenanceCases`

改為區間驅動：

1. 門市須 `storeStatus === '正常營業'`、對應客戶 `enabled !== false`。**不再要求 `lastMaintenanceDate`**，尚未保養過的新門市也會納入排程。
2. 取客戶可用區間，找涵蓋「當月」的那一個；找不到（含未設定區間的「D 維修(無簽約客戶)」）→ 跳過該門市。
3. 若已存在同 `(customerName, storeName, 今年, visitIndex)` 的案件（不論是否完成或結案）→ 跳過。
4. 否則新建一筆：`status: '未保養'`、`planDate: ''`、`dueMonth` = 今年 + 區間起始月、帶 `periodYear` / `periodVisitIndex`，其餘欄位比照現行。

只產生「當月所在區間」，今年已過去的區間不補建；上一個區間未完成的舊案件保留在資料中，但因區間不涵蓋當月而不出現在當月清單。

服務等級的 `maintenanceCount` 不再用於推算間隔月數，`addMonthsToMonth` 隨之成為死碼並移除；`generateDueMaintenanceCases` 的 `serviceLevels` 參數也一併移除，`src/app.js:92` 的呼叫端同步調整。每年保養次數實質由客戶區間筆數決定；客戶列表既有的「區間筆數與年保養次數不符」提示仍然有效。

### 4. 列表 UI（`MaintenanceList`）

- 「工項類別」與「保養日期」之間插入「保養區間」欄，內容為 `formatPeriodRange(resolveCasePeriod(c, customers))`。
- 「保養日期」欄改為 `c.planDate || ''`。
- 無資料列的 `colspan` 由 `13` 改為 `14`。
- 月份篩選改為區間判定：取案件區間的 `YYYY-MM` 起訖，與 `appliedFilters.start` / `appliedFilters.end` 有重疊即命中（`periodStart <= end && periodEnd >= start`）。`resolveCasePeriod` 回 `null` 的案件一律排除。
- 客戶／公司區域／保養狀態篩選、`isClosed` 排除、排序與分頁維持不變。

### 5. 明細頁（`MaintenanceViewEditForm`）

「目前保養季度」改用 `resolveCasePeriod`，顯示 `2026 第3次（7-9月）`，與列表同源，避免兩處對不上。原本的 `resolveMaintenanceReferenceDate` + `formatMaintenancePeriod` 組合在 `case-arrangement.js` 仍有使用，保留不動。

### 6. 驗證

新增 `scripts/verify-maintenance-period-column.mjs`，沿用既有 vm + headless Chrome CDP 兩段式寫法。

純函式段：

- 同一區間重複呼叫產生器不會重複建單。
- 進入下一個區間會重新建一筆，即使上一區間已完成或仍未完成。
- 客戶無區間時不建單。
- 沒有 `lastMaintenanceDate` 的正常營業門市會建單。
- `resolveCasePeriod` 對舊案件（只有 `planDate` / `dueMonth`）能正確回推。
- `formatPeriodRange` 輸出 `第3次 7-9月`、`null` 輸出 `—`。

UI 段：

- 表頭出現「保養區間」且位置在「工項類別」之後、「保養日期」之前。
- 未填保養日期的列，保養日期儲存格為空字串。
- 以當月（8 月）搜尋時，屈臣氏第3次未完成的門市會出現，保養區間顯示 `第3次 7-9月`。
- 區間不涵蓋當月的未完成案件不出現。

## 風險

- 舊案件回填不到區間時會從當月清單消失。這是「完全以區間判定」的預期結果；seed 中未結案案件會在初始化時回填，實務上影響有限。
- 未設定保養區間的客戶（D 類）不再產生保養單，也不會出現在列表。此為明確決策。
