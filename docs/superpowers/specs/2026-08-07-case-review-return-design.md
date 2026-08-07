# 案件銷案審核：退回案件

日期：2026-08-07

## 背景

「案件銷案審核」列表（`src/features/repair/case-review.js`）目前只有「查看明細」與「列入案件績效」兩個操作。審核人員若發現案件內容有誤，只能列入績效或放著不管，沒有把案件打回承辦人修正的途徑。

本次新增「退回案件」操作：審核人員填寫退回原因後，案件回到原本的處理列表，承辦人修正後可再次結案，重新進入審核。

## 資料模型

`repairCases` 與 `maintenanceCases` 共用同一組新欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `returnReason` | string | 最近一次的退回原因 |
| `returnedAt` | string | 退回時間戳，格式同 `IESS.caseDateTime.now()` |

採覆蓋式：再次被退回時直接覆寫舊值；承辦人修正後再次結案時**不清除**，保留可追溯紀錄。seed 資料不預設這兩個欄位，未退回過的案件為 `undefined`。

## 銷案審核列表（case-review.js）

### 操作按鈕

「操作」欄在「列入案件績效」右側加入第三顆 icon 按鈕：

- label：`退回案件`
- className：`p-1.5 text-red-600 hover:bg-red-100 rounded`
- icon：新增的 `Icons.Undo`
- 沿用既有的 `IESS.iconActionBtn`

### 退回 Modal

點擊後開啟 Modal，樣式沿用現有「列入績效」確認框（`app-modal-overlay` + `bg-white rounded-lg shadow-xl p-6 w-96`）：

- 標題列：`Icons.Undo` 紅色 + 標題「退回案件」
- 說明文字：「退回後案件將回到原處理列表，請填寫退回原因。」
- 必填 textarea：label「退回原因」，`rows=4`，placeholder「請說明退回原因…」
- 按鈕：「取消」／「確認退回」（紅色）。原因 trim 後為空字串時，「確認退回」為 `disabled` 且套用淡化樣式

Modal 狀態以元件內變數 `returnModal = { show, caseId, sourceType, reason }` 管理，關閉時重置 `reason`。

### 退回處理

依 `sourceType` 分流：

**保養案件**（`sourceType === 'maintenance'`，走 `setMaintenanceCases`）
```
isClosed: false
closeDate: ''
returnReason: <輸入值 trim>
returnedAt: IESS.caseDateTime.now()
```
`status` 維持「已完成」，承辦人修正後可直接再次結案（`canCloseMaintenanceCase` 條件為 `status === '已完成' && !isClosed`）。

**叫修案件**（走 `setCases`）
```
isClosed: false
isListClosed: false
closeDate: ''
returnReason: <輸入值 trim>
returnedAt: IESS.caseDateTime.now()
```
清除 `isListClosed` 是因為轉單類案件（`caseStatus.isTransferStatus`）結案時會一併設為 `true`；不清除的話案件回到列表後會殘留錯誤的階段狀態。`processStatus` 不變動。

退回後案件因 `isClosed === false` 自動不符合審核列表的篩選條件而離開列表。toast 指出去向：叫修為「案件已退回至「案件處理」列表」，保養為「案件已退回至「保養計劃進度」列表」。

## 目的地列表新增「退回原因」欄

兩處皆於表格**最後一欄**新增，樣式一致：

- `<th>`：`p-3 font-semibold`，文字「退回原因」
- `<td>`：`p-3 max-w-[150px] truncate`，`title` 帶完整原因（有 `returnedAt` 時 title 為「<returnedAt> <returnReason>」），無值顯示 `—`

實作位置：

- `src/features/repair/case-list.js`：接在最後一欄「案件狀態」之後
- `src/features/repair/maintenance.js`：接在最後一欄「保養人員」之後

兩檔案的空資料列 `colspan` 需同步更新：

- `case-list.js`：`10` → `12`（表頭原本就有 11 欄，現值 10 是既有的少算，一併修正）
- `maintenance.js`：`"12"` → `"13"`

## 核心變更

`src/core/icons.js` 新增 `Undo` 圖示（lucide `rotate-ccw` 的 path）：

```
Undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>'
```

## 驗證

無測試框架，以 headless browser 腳本（`scripts/` 既有模式）驗證：

1. 銷案審核列表出現「退回案件」按鈕
2. 原因空白時「確認退回」為 disabled
3. 退回叫修案件後，該案件離開審核列表、出現在案件處理列表，且「退回原因」欄顯示輸入內容
4. 退回保養案件後，該案件出現在保養計劃進度列表且「退回原因」欄正確
5. 再次結案後案件回到審核列表，`returnReason` 仍保留

## 範圍外

- 退回原因的歷史紀錄（僅保留最新一筆）
- 預設退回原因下拉選單
- 案件明細頁（`case-view.js`）顯示退回原因
- 退回通知／權限控管

## 已知限制

- 退回**不會**回滾門市的 `lastRepairDate` / `lastMaintenanceDate`（結案時寫入）。因此退回一張保養單後，該門市的「最後保養日」仍停在被退回的完成日，`ScheduleUtils.buildMaintenanceSchedule` 推算的下次保養月份也不會回復。回滾需要重算「上一筆已結案紀錄」，屬另一個題目。
- 保養單若 `planDate` 不在當月，退回後不會出現在「保養計劃進度」的預設月份篩選中，需自行放寬查詢區間。toast 已指出去向以降低困惑。
