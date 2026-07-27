# 報表統計 — 案件績效統計設計規格

**日期：** 2026-07-27  
**範圍：** 報表統計 → 案件績效統計  
**狀態：** 待實作

## 1. 目標

將「案件績效統計」對齊功能規格：進入頁面即顯示當季績效，採上下兩區塊儀表板（環形進度卡）。

| 區塊 | 內容 |
|------|------|
| 上半 | 所有指派人員：本季保養目標達成率、目標店數、完成店數、目前累計增額積分 |
| 下半 | 依績效區域分組：先顯示「{區域名}總目標達成率」，再列出該區所有客戶之達成率／目標／完成 |

視覺採**環形進度卡**（白底、圓環百分比、下方數據列）；指派人員卡含增額積分，區域總卡與客戶卡不含積分。

## 2. 架構決策

採 **擴充既有報表模組**（不另拆多個 feature 檔）：

| 項目 | 決策 |
|------|------|
| 計算 | 集中在 `PerformanceUtils` |
| UI | 改寫 `CasePerformanceStats`；環形卡為頁內共用函式／元件 |
| 目標來源 | 讀取 `maintenanceAllocations` 本季各格 `targetCount` 加總 |
| 指派人員清單 | 改從 `assignees`（不再依賴 `PERFORMANCE_ASSIGNEES`／`PERFORMANCE_QUARTERLY_TARGETS`） |
| 區域 | 接上 `performanceAreas`；客戶歸區依門市行政區 |
| 案件來源 | 同時使用 `cases`（叫修）與 `maintenanceCases`（保養） |

## 3. 資料規則與計算

### 3.1 共用

- 季度：沿用 `PerformanceUtils.getQuarterRange`
- 達成率：`目標 > 0` 時 `Math.round((完成 / 目標) * 100)`，否則 `0`
- 列入績效：僅 `isPerformanceIncluded === true` 的案件參與完成數／積分
- 指派歸戶：`AssigneeUtils.getPerformanceAssignee(record)`
- 案件行政區：以 `customerName`＋`storeName` 查 `stores`，再用 `StoreUtils.getStoreArea`（與績效區域 `districts` 字串比對）

### 3.2 案件類型分工（重要）

| 用途 | 來源 | 條件 |
|------|------|------|
| **完成店數** | `maintenanceCases`（保養計畫／銷案審核「例行保養」） | 已列入績效，且完成／結案日落在本季 |
| **增額積分** | `cases`（叫修） | 已列入績效、本季、服務等級為 **C 或 D**，加總處理項目 `points × qty` |

- 服務等級判定：字串以 `C ` 或 `D ` 開頭（相容 `C 保養…`／`D 維修…`）
- 叫修案件**不計入**完成店數；保養案件**不計入**增額積分
- 完成店數為**案件數**（同一門市多案可重複計）

### 3.3 日期欄位

| 來源 | 用於判斷是否在本季的日期 |
|------|--------------------------|
| 叫修 `cases` | `completionDate \|\| repairDate` |
| 保養 `maintenanceCases` | `completionDate \|\| closeDate \|\| repairDate \|\| planDate`（取第一個有值者，格式 `YYYY-MM-DD`） |

### 3.4 上半 — 指派人員

對每位 `assignees` 成員：

- **目標店數**：該 `assigneeId` 在本季三個月，`maintenanceAllocations` 各格 `targetCount` 加總
- **完成店數**：保養案件、已列入績效、本季、歸戶為該指派人員
- **增額積分**：叫修案件、已列入績效、本季、C／D、歸戶為該指派人員，加總 `processRecords` 的 `points × qty`
- **達成率**：完成店數 ÷ 目標店數

### 3.5 下半 — 績效區域 × 客戶

- **客戶歸區**：門市行政區落在該 `performanceArea.districts` → 該客戶列入該區；一客戶跨區可出現在多區
- **客戶目標**：該客戶本季所有保養分配 `targetCount` 加總（**不**依區域拆分目標；區域僅篩選顯示哪些客戶與完成數）
- **客戶完成**：保養、已列入績效、本季、門市屬該區、且 `customerName` 相符
- **區域總目標**：該區所列客戶之目標加總
- **區域總完成**：該區所列客戶之完成加總（等同該區所有符合條件的保養績效案件數）
- 區域卡／客戶卡**無**增額積分

### 3.6 空狀態

- 無指派人員：上半顯示空狀態
- 無績效區域：下半顯示空狀態
- 某區無客戶：仍顯示區域總卡（目標／完成為 0），底下提示無客戶

## 4. UI 與元件

### 4.1 環形卡

- 標題、SVG 圓環達成率（`stroke-dasharray`，無指針）
- 指標列：目標店數｜完成店數；僅指派人員卡另顯示增額積分
- 色系：指派人員藍；區域總達成 teal；客戶卡較淡藍／灰藍

### 4.2 版面

1. 頁首：標題「案件績效統計」＋當季 label  
2. 「指派人員績效」→ grid 環形卡  
3. 「績效區域達成率」→ 每區一個 section：區域總卡置頂，其下客戶卡 grid  

### 4.3 接線

`app.js` `case-performance` 傳入：

```js
h(CasePerformanceStats, {
  cases: s.cases,
  maintenanceCases: s.maintenanceCases,
  assignees: s.assignees,
  maintenanceAllocations: s.maintenanceAllocations,
  stores: s.stores,
  performanceAreas: s.performanceAreas
})
```

報表不再讀取 `PERFORMANCE_ASSIGNEES`／`PERFORMANCE_QUARTERLY_TARGETS`（常數可暫留 `options.js`，本次不強制刪除）。

## 5. `PerformanceUtils` 建議介面

在既有 `getQuarterRange` 之外，擴充（名稱可微調，語意需一致）：

- `sumAllocationTargets(allocations, { assigneeId?, customerName?, months })`
- `isServiceLevelCD(serviceLevel)`
- `getCaseArea(record, stores)` — 經 store 查行政區
- `computeAssigneePerformance({ cases, maintenanceCases, assignees, allocations, quarter })`
- `computeRegionPerformance({ maintenanceCases, stores, performanceAreas, allocations, quarter })`

回傳列需含：`rate`、`target`、`completed`；指派人員列另含 `bonusPoints`。

## 6. 檔案清單

| 檔案 | 動作 |
|------|------|
| `src/features/reports/performance-utils.js` | 擴充計算 |
| `src/features/reports/case-performance-stats.js` | 改為雙區塊環形儀表板 |
| `src/app.js` | 補傳 props |

## 7. 非目標（本次不做）

- 不改銷案審核「列入績效」按鈕／流程（報表只讀 `isPerformanceIncluded`）
- 不改保養分配網格、編輯與儲存規則（報表只讀 `targetCount`）
- 不做後端 API／持久化
- 不強制刪除 `PERFORMANCE_*` 常數（僅報表停止使用）

## 8. 驗收標準

1. 進入頁面顯示當季；上半為所有指派人員環形卡，含達成率、目標、完成、增額積分  
2. 目標店數與保養分配本季 `targetCount` 加總一致  
3. 完成店數僅含已列入績效的**保養**案件；叫修不計入完成店數  
4. 增額積分僅含已列入績效、C／D 的**叫修**案件處理積分加總  
5. 下半依績效區域分組；每區有總達成率卡＋該區客戶卡（客戶可跨區重複）  
6. 客戶歸區依門市行政區與 `performanceAreas.districts`  
7. 無資料時有合理空狀態；達成率在目標為 0 時顯示 0%  
