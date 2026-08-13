# 保養分配加上年份（年度快照）設計

日期：2026-08-13

## 目標

保養分配改為每年一份分配表，切換年份可查看歷年的分配結果。

核心問題不是「格子要加年份」，而是**表格骨架目前完全是即時算的**：哪些客戶入列、負責門市數、一年幾次、區間落在哪幾個月，全部每次進頁面用現行主檔重算。若只替格子加 `year`，客戶把服務等級從 A(4次) 改成 B(2次) 之後，去年的分配表會被今年的設定重畫——舊格子落在非區間月份、畫不出區段、點不開，等級改成 D 甚至整列消失。

因此本設計凍結的是骨架，不只是格子。

## 決策

| 議題 | 決定 |
|---|---|
| 歷史年度的骨架來源 | 快照。建立年度分配表時把當時的客戶列、服務等級、門市數、保養區間寫進該年度資料 |
| 快照建立時機 | 手動按「建立年度分配表」。未建立的年份顯示空狀態，不自動建立 |
| 快照的列粒度 | `assigneeId × customerName`。必須含 `assigneeId`，把所有指派人員的列一次拍下，否則切人時又回到即時計算 |
| 保養區間存放位置 | 快照的列上。客戶身上的 `periods` 繼續是「現行設定」，快照裡的是「當年用的設定」 |
| 年中主檔變動 | 預設凍結，提供「重新同步本年度」按鈕重拍骨架；已填格子一律保留 |
| 同步後的孤兒格子 | 保留但標異常（紅色虛線框＋⚠），只能刪除不能編輯。不自動清除 |
| 「主檔已變動」提示條與同步按鈕的適用年度 | **只對當年度**。過去年度必然 drift（且服務等級一改名就會全面觸發），提示條會變成永久噪音，而按鈕就在旁邊——按下去會用今天的主檔重寫歷史骨架、把整年格子大量變成孤兒。過去年度改顯示中性灰字「{year} 年度骨架已凍結（建立於 {createdAt}）」，不顯示同步按鈕 |
| 格子上的 `visitIndex` | 只是快取，不是真相。畫面標籤與「同一次合計」的分組一律由該月所屬區間推導；同步後存活但落進別的區間的格子會顯示新的次數，合計也歸到新的那一組 |
| 整列從快照消失的孤兒格 | 客戶降到 D 級、門市全關、指派人員被刪除後同步，該列的格子不屬於任何快照列。以唯讀紅虛線列補在網格底部（列首標「已不在本年度骨架中」、僅能刪除、刪光即消失），否則看不見也刪不掉 |
| 「已完成／負責」 | 分母（`storeCount`）是計畫值，凍結；分子是實績，永遠從 `maintenanceCases` 即時算 |
| 服務等級的修改時機 | **不做系統限制**。隨時可改，只影響下一份新建的年度表或按下同步的那一刻 |
| 跨年區間（11月～隔年2月） | 仍不支援，與現況一致 |

## 資料模型

### 年度快照

`src/data/seed.js` 新增 `INITIAL_MAINTENANCE_ALLOCATION_YEARS`：

```js
{
  year: 2026,
  createdAt: '2026-01-05',
  syncedAt: '',
  rows: [
    {
      assigneeId: 'ASG1',
      customerName: '星巴克',
      serviceLevel: 'A 保修(一年四次)',
      storeCount: 8,
      periods: [
        { visitIndex: 1, startMonth: 1, endMonth: 3 },
        { visitIndex: 2, startMonth: 4, endMonth: 6 },
        { visitIndex: 3, startMonth: 7, endMonth: 9 },
        { visitIndex: 4, startMonth: 10, endMonth: 12 }
      ]
    }
  ]
}
```

`periods` 為深拷貝，不與客戶記錄共用參考。

seed 只給一筆 2026 年度，內容由現行主檔推出（即 `buildYearSnapshot` 對 seed 主檔的結果），確保畫面與加年份前逐格一致。

### 分配格子

`INITIAL_MAINTENANCE_ALLOCATIONS` 每筆加 `year: 2026`：

```js
{ id: 'MA1', year: 2026, assigneeId: 'ASG1', customerName: '屈臣氏', month: 7, visitIndex: 1, targetCount: 3 }
```

唯一性由 `assigneeId + customerName + month` 改為 `year + assigneeId + customerName + month`。

### Store

`src/app.js`：

- state 加 `maintenanceAllocationYears: INITIAL_MAINTENANCE_ALLOCATION_YEARS`
- `setMaintenanceAllocationYears = makeSetter('maintenanceAllocationYears')`
- `maintenance-allocation` view 的 props 加上這兩者

## maintenance-allocation-utils.js

### 新增

| 函式 | 行為 |
|---|---|
| `buildYearSnapshot(year, assignees, customers, stores, serviceLevels, today)` | 對每位 assignee 跑現有 `getCustomerRows`，攤平成 `rows`，每列附上 `CustomerUtils.getPeriods` 的深拷貝。回傳 `{ year, createdAt: today, syncedAt: '', rows }` |
| `findYearSnapshot(years, year)` | 查無回 `null`；`year` 以數字比對 |
| `listYears(years)` | 回傳已建立年度的數字陣列，由大到小 |
| `getSnapshotRows(snapshot, assigneeId)` | 該指派人員的列，依 `customerName` 以 `zh-Hant` 排序；查無回 `[]` |
| `buildSegmentMap(row)` | 由 `row.periods` 建 `{ 月份: { period, order } }`。取代元件內原本讀 `customers` 的同名區域函式 |
| `findPeriodInRow(row, month)` | `startMonth <= month <= endMonth` 的區間，查無回 `null` |
| `diffSnapshot(snapshot, assignees, customers, stores, serviceLevels)` | 比對快照與現行主檔，回傳 `{ added, removed, changed }`。`added`／`removed` 為 `{ assigneeId, customerName }` 陣列；`changed` 為 `{ assigneeId, customerName, from, to }`，`from`／`to` 含 `storeCount`、`serviceLevel`、`periods` 的比較結果。無差異時三個陣列皆空 |
| `resyncYear(snapshot, assignees, customers, stores, serviceLevels, today)` | 以 `buildYearSnapshot` 重算 `rows`，保留原 `year` 與 `createdAt`，`syncedAt` 設為 `today` |
| `isOrphanAllocation(allocation, snapshot)` | 該格所屬的列已不在快照中，或月份不落在該列任一區間內 → `true` |
| `countOrphans(allocations, snapshot)` | 該年度孤兒格子數 |
| `formatDiffSummary(diff)` | 例：`新增 2 列、移除 1 列、3 列設定變動`；無差異回 `''` |

`buildYearSnapshot` 與 `resyncYear` 的 `today` 由呼叫端傳入（`YYYY-MM-DD`），utils 不自行取現在時間，便於驗證腳本斷言。

### 改簽章（全部加 `year`）

| 函式 | 新簽章 |
|---|---|
| `findAllocation` | `(allocations, year, assigneeId, customerName, month)` |
| `sumVisitIndexTotal` | `(allocations, year, assigneeId, customerName, visitIndex, excludeMonth)` |
| `removeAllocation` | `(allocations, year, assigneeId, customerName, month)` |
| `upsertAllocation` | `(allocations, record)`，`record` 需含 `year`；比對與新增皆帶 `year` |
| `buildSaveWarnings` | `params` 加 `year`，內部 `sumVisitIndexTotal` 一併傳入 |

`year` 一律以 `Number()` 比對。

### 不變

`isAllocatableServiceLevel`、`formatCellLabel`、`getCoveredStoresForAssignee`、`getCustomerRows`、`countCompletedStores` 邏輯不動。`getCustomerRows` 仍是快照的產生器，只是不再被畫面直接呼叫。

## maintenance-allocation.js

props 新增 `maintenanceAllocationYears`、`setMaintenanceAllocationYears`。

### 頂部工具列

由左至右：

1. **年份** select — 來源 `listYears(years)`，倒序。旁邊一個圓形「＋」鈕開建立年度 Modal。無任何年度時 select 隱藏，只留建立鈕。
2. **指派人員** select — 行為不變。
3. 右側：客戶數統計，以及有快照時顯示的「重新同步本年度」按鈕。

選定年份以模組層變數 `persistedSelectedYear` 記住（比照現有的 `persistedSelectedAssigneeId`）。初次進入時預設為 `listYears` 的第一筆（最新年度）；若當年度已建立則優先選當年。

### 建立年度 Modal

- 年份 number input，預設當年；當年已存在則預設「最大已建立年度 + 1」
- 已存在的年份擋下，`showToast('該年度分配表已存在', 'error')`
- 確認後 `buildYearSnapshot`，加入 `maintenanceAllocationYears`，並把 `persistedSelectedYear` 切到新年度
- toast：`已建立 {year} 年度分配表（{n} 列）`

### 空狀態

- 尚無任何年度 → 「尚未建立任何年度分配表」＋建立鈕
- 已選年份但快照不存在（理論上不會發生，防呆）→ 同上
- 已選年份與指派人員，但該人員在快照中無列 → 沿用現有「尚無符合條件的客戶」

### 網格

骨架 100% 讀快照：

- 列來源改為 `getSnapshotRows(snapshot, selectedAssigneeId)`
- 區段底色與邊框改由 `MaintenanceAllocationUtils.buildSegmentMap(row)`（讀 `row.periods`），元件內原本讀 `customers` 的 `buildSegmentMap` 刪除
- 區段首格的 `第N次 已完成/負責`：分母用 `row.storeCount`（快照值），分子 `countCompletedStores(maintenanceCases, assignee.name, row.customerName, period, selectedYear)` — 年份由寫死的 `CURRENT_YEAR` 改為選定年度，`CURRENT_YEAR` 常數刪除
- 列首 badge 顯示 `row.serviceLevel`（快照值，非客戶現值）

### 孤兒格子

判定：該格有值，但月份不落在該列任一區間內（列本身已不存在的情況不會顯示，因為列來自快照）。

呈現：`border-red-300 border-dashed bg-red-50/50`，標籤前綴 `⚠ `，`title` 為「此格已不在現行保養區間內」。

點擊：不開編輯 Modal，直接開刪除確認 Modal，並 `showToast('此格已不在保養區間內，僅能刪除', 'error')`。

空白的非區間月份維持現行行為（點擊跳「此月份不在該客戶的保養區間內」，文案改為「此月份不在該年度的保養區間內」）。

### 編輯／刪除

`openEditModal` 的區間查詢由 `CustomerUtils.findPeriodForMonth(customers, ...)` 改為 `MaintenanceAllocationUtils.findPeriodInRow(row, month)`。`handleSave`／`handleDelete` 的 utils 呼叫全部帶入 `selectedYear`。

Modal 標題副文字加上年度：`{year} 年 / {customerName} / {month}月 / 負責門市數 {n}`。

### 主檔變動提示與同步

**僅當選定年度為當年時**（`selectedYear === new Date().getFullYear()`）才跑 `diffSnapshot`、才顯示提示條與「重新同步本年度」按鈕。過去年度改顯示中性灰字：

> {year} 年度骨架已凍結（建立於 {createdAt}）

當年度有差異時在工具列下方顯示黃色提示條：

> ⚠ 主檔已變動：新增 2 列、移除 1 列、3 列設定變動

「重新同步本年度」按鈕開確認 Modal，內容為 `formatDiffSummary(diff)` 與孤兒格子預估數（同步後會有幾格落在區間外），確認後：

- `setMaintenanceAllocationYears` 寫入 `resyncYear` 結果
- 格子完全不動
- toast：`已重新同步 {year} 年度；{summary}`，若同步後有孤兒格子則追加 `，{n} 格已不在區間內，請確認`

無差異時按鈕仍可按，跳 `showToast('本年度骨架與現行主檔一致，無需同步')`。

## 統計頁接線

`src/features/reports/performance-utils.js`：

- `sumAllocationTargets(allocations, opts)` 的 `opts` 新增 `year`，有值時過濾 `Number(row.year) === Number(opts.year)`
- `computeAssigneePerformance` 與 `computeRegionPerformance` 由 `quarter.start.slice(0, 4)` 推出年份，傳入 `sumAllocationTargets`

`case-performance-stats.js` 需新增 `maintenanceAllocationYears` prop（由 `src/app.js` 的 `case-performance` view 傳入）：本季所屬年度若尚無對應快照，顯示「{year} 年度分配表尚未建立」說明列。否則每年 1 月 1 日起、在有人手動建立該年度分配表之前，所有組會靜默顯示目標 0／達成率 0%。

## 驗證

新增 `scripts/verify-maintenance-allocation-years.mjs`，沿用現有 headless Chrome + CDP 形式（見 `verify-customer-maintenance-periods.mjs`）。涵蓋：

1. `buildYearSnapshot` 對 seed 主檔的結果與 `INITIAL_MAINTENANCE_ALLOCATION_YEARS` 的 2026 筆一致（列數、`storeCount`、`serviceLevel`、`periods`）。
2. seed 資料下 2026 年度的網格與加年份前逐格一致（區段底色、邊框、`第N次 已完成/負責`）。
3. 建立 2027 年度後年份下拉多一筆、格子全空；重複建立同年被擋。
4. **核心情境**：建立 2026 → 填格 → 把某客戶服務等級由 A(4次) 改為 B(2次) 並調整客戶區間 → 2026 年度的區段、門市數、badge 全部不變，格子仍點得開。
5. 接續 4：建立 2027 → 該客戶在 2027 只有兩個區段。
6. 接續 4：對 2026 按「重新同步本年度」→ 區段變兩段，原本第 3、4 次的格子仍在、標為孤兒、點擊只能刪除。
7. 主檔變動提示條在新增門市後出現，同步後消失。
8. `sumAllocationTargets` 的年份過濾：他年度的格子不計入本季目標。
9. `findAllocation`／`upsertAllocation`／`removeAllocation`／`buildSaveWarnings` 的同 `assigneeId + customerName + month` 但不同 `year` 互不干擾。

回歸：重跑 `verify-service-level-management.mjs`、`verify-customer-maintenance-periods.mjs`、`verify-maintenance-period-column.mjs`、`verify-maintenance-start-months.mjs`。

## 刻意不做

- 不限制服務等級的修改時機（快照已解決失真問題，硬擋擋不住年中升級的現實）
- 不自動建立年度、不從上一年複製格子
- 不快照實績（已完成門市數永遠即時算）
- 不支援跨年保養區間
- 不改客戶／服務等級管理頁的任何行為（客戶的 `periods` 仍是唯一的「現行設定」來源）
- 不刪除年度分配表（先不做；要重來就同步）

## 已知限制

- 快照存的 `serviceLevel` 是名稱字串。服務等級改名後，歷史年度的 badge 會顯示舊名稱——這是刻意的（當年就是叫那個名字），但與 `renameServiceLevel` 的全域同步行為不一致，需在該函式的註解註明快照刻意排除。
- `diffSnapshot` 只比對列的存在與 `storeCount`／`serviceLevel`／`periods`，不比對指派人員本身的增刪；新增指派人員後其列會出現在 `added` 中，行為正確但摘要文案不會特別點出「新指派人員」。
- 年度分配表無刪除功能，誤建的年度只能留著（格子全空，不影響統計）。
- 孤兒格子仍計入 `sumAllocationTargets`，所以在使用者刪除它們之前，案件績效統計的目標數會偏高。刻意如此：孤兒格已在畫面上可見、標為異常且可刪除，若在統計端偷偷排除，畫面數字與報表數字就會對不起來，且會讓 `features/reports` 相依快照結構。
- 網格底部的「已不在本年度骨架中」孤兒列只列出目前選定指派人員的格子，而同步 Modal／toast 的孤兒數是全指派人員合計。文案已標明範圍，但兩個數字仍可能不同。
- 該類孤兒列的「第N次」標籤顯示格子上存的舊值（那些格子不屬於任何區間，無從推導）。
