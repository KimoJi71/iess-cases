# 案件處理：待料件／尚未處理完成結案時產生延伸案件

日期：2026-08-25

## 背景

「案件處理」列表（`src/features/repair/case-list.js`）目前的結案分兩種走法：

- **轉汰換／轉原廠**（`caseStatus.isTransferStatus`）：結案後同步進入「案件銷案審核」，同時以 `isListClosed` 保留在處理列表，待點「汰換完成」／「轉原廠完成」才移除。
- **其他狀態**：結案後單純移入「案件銷案審核」。

但處理狀態為「待料件」「尚未處理完成」時，案子實際上還沒做完：料件到貨後、或未完成的工項仍需再跑一趟。目前結案就等於案子消失，後續作業沒有承載的單據。

本次新增**延伸案件**：以這兩種狀態結案時，原案件照常進入銷案審核（可列入績效），同時自動複製出一筆新案件回到「案件處理」列表的「未處理」，承接尚未完成的服務項目，並可從新案件回溯前一筆案件。

## 資料模型

叫修案件（`repairCases`）新增三個欄位，只有延伸案件會帶：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `rootCaseNumber` | string | 延伸鏈最初的原始案件編號，例如 `20260825001` |
| `prevCaseId` | string | 直接上一筆案件的 `id`，供「先前案件」按鈕逐層回溯 |
| `extensionSeq` | number | 此案在延伸鏈中的序號（1、2、3…） |

原始案件三個欄位皆為 `undefined`（seed 資料不預設）。

### 編號規則

延伸案件編號 = `rootCaseNumber + '-' + extensionSeq`。

`rootCaseNumber` 取自來源案件的 `rootCaseNumber`；來源案件沒有（代表它就是原始案件）時取其 `caseNumber`。
`extensionSeq` = 全案件集中所有 `rootCaseNumber` 相同者的 `extensionSeq` 最大值 + 1，沒有則為 1。

因此是**沿用原始案件遞增**，不逐層疊加：

```
20260825001  →  20260825001-1  →  20260825001-2  →  20260825001-3
```

序號以最大值 +1 計算，因此即使中間某筆被刪除也不會撞號。

## 延伸狀態判定（case-status.js）

新增並匯出：

```js
var EXTENSION_STATUSES = ['待料件', '尚未處理完成'];
function isExtensionStatus(status) {
  return EXTENSION_STATUSES.indexOf(status) !== -1;
}
```

`isTransferStatus` 與 `isExtensionStatus` 互斥，兩者的結案分支不會同時成立。
`canCloseCase` / `getCaseCloseDisabledReason` 維持不變——選過任一處理狀態且未結案即可結案。

## 延伸案件的建立（新檔 src/features/repair/case-extension.js）

純函式模組，掛在 `window.CaseExtensionUtils`，載入順序置於 `case-status.js` 之後、`case-list.js` 之前（`index.html`）。

```js
CaseExtensionUtils.getRootCaseNumber(c)      // c.rootCaseNumber || c.caseNumber
CaseExtensionUtils.getNextExtensionSeq(cases, rootCaseNumber)
CaseExtensionUtils.buildExtensionCase(original, cases)  // 回傳新案件物件
```

### buildExtensionCase 的欄位處理

**帶入（複製自原案件）**

- 案件資料：`workCategory`、`customerName`、`storeName`、`companyCity`、`companyDistrict`、`storeAddress`、`serviceLevel`、`repairItem`、`repairReason`、`faultDesc`、`reporter`
- 設備資料：`equipment` 全部（深拷貝）
- 派工資料：`assignees`、`assigneeMemberIds`、`partnerVendorIds`、`vehicleId`
- 維修結果：`actualReason`

**服務項目**

只複製 `ProcessMethodUtils.getCaseRecordStatus(r) === '待處理'` 的 `processRecords`，每筆給新的 `id`，`status` 維持 `待處理`，其餘欄位（處理方式分類、規格、單位、積分、數量）原樣帶入。
一筆待處理項目都沒有時仍建立延伸案件，`processRecords` 為 `[]`。
原案件的 `processRecords` **不動**（待處理項目保留原樣，僅作歷史紀錄，本來就不計積分）。

**清空／重設**

| 欄位 | 值 |
| --- | --- |
| `processStatus` | `null`（落在列表「未處理」篩選） |
| `completionDate`（完成時間） | `''` |
| `expectedDate`、`expectedTimeStart`、`expectedTimeEnd` | `''` |
| `planDate`、`planTimeStart`、`planTimeEnd` | `''` |
| `isClosed`、`isListClosed`、`isPerformanceIncluded` | `false` |
| `closeDate`、`performanceAssignee` | `''` |
| `performanceAssignees`、`performanceMemberIds` | `[]` |
| `returnReason`、`returnedAt` | 不帶入（`undefined`） |
| `reRepairDate`（到店時間） | `''` |

預計日期／時間刻意不帶入：延伸案件需重新排程。

**新設**

| 欄位 | 值 |
| --- | --- |
| `id` | `'C' + Date.now()` |
| `caseNumber` | `rootCaseNumber + '-' + extensionSeq` |
| `rootCaseNumber`、`extensionSeq`、`prevCaseId` | 如上「資料模型」 |
| `repairDate` | `IESS.caseDateTime.now()` |
| `createdAt` | `new Date().toISOString()` |
| `indicator` | 同原案規則：`workCategory === '緊急叫修' ? 'urgent' : 'completed'` |

`createdAt` 取當下，因此逾時燈號（`getOvertimeDeadline` 以 `createdAt` 起算）從延伸案件建立時重新計時。

## 結案流程（case-list.js）

`handleCloseCase` 由兩分支變三分支，順序：transfer → extension → 一般。

新增的 extension 分支：

1. 與其他分支一致地呼叫 `updateStoreLastRepairDate(target)`
2. 原案件標記 `isClosed: true`、`closeDate: stamp`（**不設** `isListClosed`，故離開處理列表、進入銷案審核）
3. 以 `CaseExtensionUtils.buildExtensionCase(target, cases)` 產生新案件，與更新後的案件陣列一起 `setCases`（單次 setState，避免兩次重繪造成序號重算）
4. toast：`'案件已結案並移至「案件銷案審核」列表，已建立延伸案件 ' + newCase.caseNumber`

確認視窗文案：`isExtensionStatus` 時顯示

> 確定要將此案件結案嗎？結案後將移至「案件銷案審核」列表，並自動建立一筆延伸案件（編號 `<預告編號>`）於案件處理列表。

預告編號在渲染 modal 時以 `getRootCaseNumber` + `getNextExtensionSeq` 計算，與實際建立採同一組函式，結果一致。

列表**不加**任何延伸標記——編號末尾的 `-1`、`-2` 已足以辨識。

## 先前案件按鈕

### PageHeader 擴充

`src/shell/page-header.js` 目前只吃 `{ title, badge, onClose, wrapperClass }`，右側固定只有關閉鈕。新增可選的 `actions`（節點陣列），渲染於關閉鈕左側，並以 `flex items-center gap-2 shrink-0` 包住兩者；未傳 `actions` 時輸出與現況完全一致。

### 按鈕

`prevCaseId` 存在時，於下列兩處以 `actions` 傳入按鈕「先前案件」：

- `src/features/repair/case-view.js`（查看案件明細，唯讀）
- `src/features/repair/case-form.js` 的 `EditCaseForm`（`src/features/repair/case-form.js:543` 的 PageHeader；`AddCaseForm` 不需要，新增的案件不會有 `prevCaseId`）

樣式比照既有次要按鈕：`px-3 py-1.5 text-sm border rounded-md text-blue-600 hover:bg-blue-50 flex items-center gap-1.5`，配新增的 `Icons.History`（`src/core/icons.js` 目前無此圖示，補上 lucide `history` 的 path）：

```
History: '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/>',
```

### 導覽

點擊行為：找出 `cases` 中 `id === prevCaseId` 的案件 → `setViewingCase(該案件)`、`setPrevCaseBackView(來源 view)`、`setView('prev-case-view')`。來源 view 於 `case-view.js` 為目前的 `backView`（`record-view` 為 `'record-list'`、`review-view` 為 `'review-list'`、`prev-case-view` 為 `'prev-case-view'`），於 `EditCaseForm` 為 `'edit'`。

`app.js` 新增：

- state：`prevCaseBackView`（字串，預設 `'list'`）與其 setter
- view route `'prev-case-view'`：以 `ViewCaseForm` 唯讀呈現 `s.viewingCase`，`backView: s.prevCaseBackView`

`ViewCaseForm` 與 `EditCaseForm` 需多收 `cases`、`setViewingCase`、`setPrevCaseBackView` 三個 props（`EditCaseForm` 已有 `cases`）。

從 `'prev-case-view'` 返回 `'edit'` 時，`s.editingCase` 未被更動，故編輯中的案件仍在（表單欄位暫存於元件閉包，會重置為儲存值——這與現有離開表單的行為一致）。

前案本身若也有 `prevCaseId`，其明細頁同樣顯示「先前案件」，可逐層往前回溯；每次跳轉都把 `prevCaseBackView` 設為 `'prev-case-view'`，故關閉時逐層退回。

找不到 `prevCaseId` 對應案件時按鈕不顯示。

## 驗證

無測試框架，比照 `scripts/` 既有模式新增 `scripts/verify-case-extension.mjs`（headless Chrome + CDP）：

1. 處理狀態為「待料件」的案件，結案確認視窗文案含預告編號 `-1`
2. 確認結案後：原案件離開處理列表、出現在銷案審核列表
3. 處理列表出現編號 `<原編號>-1` 的新案件，狀態篩選「未處理」可見
4. 延伸案件只帶原案的「待處理」服務項目，且設備資料、組別、車輛、實際維修原因皆保留
5. 延伸案件的預計日期／時間為空、`processStatus` 為空
6. 原案件的 `processRecords` 未被更動（待處理項目仍在）
7. 對 `-1` 以「尚未處理完成」再次結案，得到 `-2`（非 `-1-1`）
8. 延伸案件明細頁與編輯頁均有「先前案件」按鈕，點擊可看到前一筆案件，可逐層回溯並逐層返回
9. 無待處理項目時仍建立延伸案件（`processRecords` 為空）

## 範圍外

- 延伸案件的列表視覺標記／篩選條件
- 銷案審核列表顯示延伸關係
- 「後續案件」反向連結（只做往前回溯）
- 延伸鏈的整體檢視／時間軸
- 保養計劃案件（`maintenanceCases`）的延伸——本次僅叫修案件
- 手動建立延伸案件的入口
- PDF 匯出／資料調閱加入延伸欄位

## 已知限制

- 原案件與延伸案件的待處理服務項目為兩份副本；原案件的那份保留作歷史，若日後有人回頭編輯原案件的服務項目，兩邊不會同步。
- 延伸案件的積分以自身的服務項目計算，故同一批待處理項目在原案（未計分）與延伸案（完成後計分）各出現一次，績效統計不會重複計分，但資料調閱的「服務項目」逐筆匯出會看到重複列。
- `extensionSeq` 由當下 `cases` 陣列推算，屬記憶體假資料的做法；正式後端需以資料庫唯一鍵保證不撞號。
