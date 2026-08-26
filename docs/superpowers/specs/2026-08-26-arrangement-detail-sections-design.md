# 案件安排：單一案件沿用編輯頁區塊

日期：2026-08-26

## 背景

「案件安排」日曆點開單一案件時會開啟排程彈窗（`src/features/scheduling/case-arrangement.js`
的 `renderScheduleModal`）。三種來源的呈現方式目前不一致：

- **工程立案（project）**：已直接沿用編輯頁的 `ProjectDetailView.renderSections()`，全欄位唯讀。
- **維修（repair）**：`renderRepairScheduleDetails()` 是另外手刻的兩段式版面。
- **保養（maintenance）**：`renderMaintenanceScheduleDetails()` 同樣是手刻版面。

維修與保養的手刻版面跟各自的編輯頁（`EditCaseForm`、`MaintenanceViewEditForm`）有兩類落差：

**缺少的功能**：指派人員、使用車輛、協力廠商、案件編號、整段「維修結果」（處理狀態／客戶簽收
簽名／維修備註／時間紀錄），以及設備區的「加入設備／QR 掃描／移除設備」與處理紀錄的增刪與
狀態切換。

**相反的可編性**：編輯頁把客戶、門市、工項分類、叫修項目、叫修原因、故障描述設為唯讀，
排程彈窗卻讓它們可編輯。

## 目標

排程彈窗點開維修或保養案件時，案件內容區塊與各自的編輯頁完全一致——版面、欄位、可編性、
互動功能皆同一份實作。工程立案維持現狀不動。

## 非目標

- 不改工程立案彈窗的唯讀性質。工程立案頁仍是該類型唯一的編輯入口。
- 不改日曆本身、待安排案件清單、排程時間與組別的主控欄位。
- 不新增任何欄位；只做「同一份實作被兩處使用」。

## 決策紀錄

| 決策 | 選擇 | 理由 |
|---|---|---|
| 對齊程度 | 完整沿用編輯頁區塊，含互動功能 | 使用者要求「畫面與功能」都參考編輯時 |
| 涵蓋類型 | 維修、保養；工程維持唯讀 | 工程已沿用編輯頁排版，且立案頁才是編輯入口 |
| 彈窗儲存語意 | 排程與案件內容一併儲存 | `buildScheduledRecord` 本來就整筆 merge `formData` |
| 彈窗儲存驗證 | 只驗證排程三條規則 | 避免使用者在排程階段被編輯頁的完整性規則擋下 |
| 作法 | 抽出共用可編輯區塊渲染器 | 單一真實來源；與既有 `ProjectDetailView` 同模式 |

被否決的兩個作法：**在彈窗內直接掛 `EditCaseForm`**——它綁死 `setView('list')`、自己的
`setCases` 儲存流程與 sticky header，要塞大量「嵌入模式」開關，且其「1. 排程資料」會與彈窗
頂端的排程欄位重複控制同一組值。**點日曆事件直接跳轉編輯頁**——離開日曆脈絡，等於取消
排程彈窗，與需求不符。

## 架構

新增兩支共用模組，層級與 `window.ProjectDetailView` 相同：

```
src/features/repair/case-detail-sections.js         → window.RepairCaseDetailSections
src/features/repair/maintenance-detail-sections.js  → window.MaintenanceDetailSections
```

### 模組介面

兩支模組各暴露相同形狀的三個函式：

```js
createUiState()      // 產生呼叫端自行保管的 UI 暫存狀態物件
renderSections(ctx)  // 回傳 section 陣列
renderOverlays(ctx)  // 回傳浮層（設備挑選器、簽名板）
```

`ctx` 的形狀：

```js
{
  formData,   // 直接 mutate，沿用 EditCaseForm 現行寫法
  ui,         // createUiState() 的產出，由呼叫端保管
  data: { equipments, deviceCategories, processMethods, vehicles, vendors, stores, customers },
  rerender,
  showToast,
  include,    // 要渲染哪些區塊，見下
  mode        // 'edit' | 'view'；'view' 時全區塊唯讀（僅保養用到）
}
```

`RepairCaseDetailSections.createUiState()` 產出：

```js
{ activeItemIndex: 0, pickerOpen: false, addEquipMenuOpen: false,
  signaturePad: { show: false }, newRecordByItemId: {} }
```

`MaintenanceDetailSections.createUiState()` 產出：

```js
{ equipPicker: { show: false }, signaturePad: { show: false } }
```

### 三個設計要點

**`include` 決定區塊組成與編號。** 區塊代號固定為 `'schedule' | 'case' | 'equipment' |
'result'`。編輯頁傳完整四段，得到「1. 排程資料 / 2. 案件資料 / 3. 設備與服務項目 /
4. 維修結果」；排程彈窗省略 `'schedule'`（頂端已有排程主控），得到「1. 案件資料 /
2. 設備與服務項目 / 3. 維修結果」。編號由模組依 `include` 的實際內容動態產生，不寫死在
標題字串裡。保養的區塊標題同理為「排程資料／案件資料／設備資料／保養結果」。

**UI 暫存狀態由呼叫端持有，模組本身無狀態。** `EditCaseForm` 與 `MaintenanceViewEditForm`
放在各自 `stateful` 回呼外層的閉包（即現況位置）；排程彈窗放在 `scheduleModal.ui`。
`scheduleModal` 宣告於 `CaseArrangement` 的 `stateful` 之外，能撐過重繪。

**浮層獨立回傳。** `RepairCaseEquipment.PickerModal`、`ProjectEquipPicker` 與
`IESS.SignaturePadModal` 都是 fixed 定位。若隨 section 一起回傳，在彈窗中會被中段的
`overflow-y-auto` 容器裁切，故由 `renderOverlays(ctx)` 分開回傳，呼叫端掛在自己的最外層。

### 從編輯頁搬出的內容

`case-form.js` 搬出至 `case-detail-sections.js`：`TimeRecordField`、`CaseReadOnlyField`、
`ExpectedTimeRangeFields`、`renderVehicleSelect`、`renderPartnerVendorMultiSelect`、
`isOtherWorkCategory`，以及 handler `handleChange`、`assignEquipment`、`handleSimulateScan`、
`handleSelectEquipment`、`handleRemoveItem`、`handleReasonChange`、`handleRemarksChange`、
`handleAddRecord`、`handleRemoveRecord`、`handleToggleRecordStatus`、`getNewRecord`，
與四段 section 的 DOM。`ExpectedTimeRangeFields` 目前掛在 `window`，須維持匯出（其他模組有用）。

`maintenance.js` 搬出至 `maintenance-detail-sections.js`：`ReadOnlyField`、`sectionCard`、
`fieldLabel`、`getStoreForCase`、`getMaintenancePeriodLabel`、`applyChange`、
`handleStatusChange`、`handlePickerConfirm`、`handleRemoveEquipment`，與四段 section 的 DOM。
`resolveMaintenanceProgressStatus` 與 `updateStoreLastMaintenanceDate` 須從 `maintenance.js`
匯出供彈窗儲存流程使用。

`MaintenanceViewEditForm` 的 `mode`（`'view'` / `'edit'`）語意透過 `ctx.mode` 帶入，維持查看
模式全唯讀的既有行為。排程彈窗一律傳 `'edit'`。

## 資料流與儲存

排程彈窗的改動集中在 `case-arrangement.js`：

1. `openScheduleModal` / `openEditScheduleModal` 建立 `scheduleModal` 時，依 `sourceType`
   多帶一個 `ui: <對應模組>.createUiState()`。工程立案不帶。
2. `renderScheduleModalDetails()` 的 repair 與 maintenance 分支改呼叫共用模組的
   `renderSections`；project 分支原封不動。
3. 彈窗最外層掛上 `renderOverlays(ctx)`，位置在 `app-modal-overlay` 之外。
4. 頂端「預計日期／預計開始時間／預計結束時間／組別」維持現行的
   `updateScheduleModalTime` 與 `setScheduleModalAssignees` 路徑，不進共用模組。

`confirmScheduleModal` 的驗證維持現況三條：組別至少一個、預計日期與時間區間必填、結束時間
須晚於開始時間。不加入編輯頁的「每份服務項目都必須對應一筆設備」。案件內容透過
`buildScheduledRecord` 的整筆 `formData` merge 帶走，不另開儲存路徑。

### 四個必須一併處理的連動

**保養狀態被推算覆寫。** `buildScheduledRecord` 目前無條件執行
`ScheduleUtils.resolveMaintenanceStatus(merged.status, payload.planDate)`。彈窗一旦能手選
「已完成」，該行會將其推翻。改為沿用 `maintenance.js` 的 `resolveMaintenanceProgressStatus`
語意：「已完成」為手動狀態，不因日期而改變。

**保養設備清單的存放位置。** `MaintenanceViewEditForm` 目前把 `equipmentList` 放在 `formData`
之外的區域變數，於 `handleSubmit` 手動合併。共用模組改為直接讀寫 `formData.equipmentList`，
整筆 merge 才能帶走。`MaintenanceViewEditForm` 自身的儲存流程同步調整。

**門市「上次保養日期」。** 保養轉為「已完成」時，`maintenance.js` 會呼叫
`updateStoreLastMaintenanceDate(stores, setStores, ...)`。彈窗儲存為「已完成」時須執行同一
動作，否則兩個入口寫出的門市資料不一致。

**`CaseArrangement` 缺少 props。** 共用模組需要 `vehicles`、`vendors`、`equipments`、
`setStores`，目前 `app.js` 未傳給 `CaseArrangement`，須補上。

## 欄位可編性

一律以編輯頁為準。以下為相對於現行彈窗的變動：

| 欄位 | 彈窗現況 | 改後 |
|---|---|---|
| 維修：客戶名稱、門市名稱、工項分類、叫修項目、叫修原因、故障描述 | 可編 | 唯讀 |
| 保養：客戶名稱、門市名稱、門市地址、服務等級 | 可編 | 唯讀 |
| 維修：指派人員、使用車輛、協力廠商 | 無 | 可編 |
| 維修：處理狀態、客戶簽收、維修備註、時間紀錄 | 無 | 可編 |
| 維修：加入設備、QR 掃描、移除設備、處理紀錄增刪與狀態切換 | 無 | 可用 |
| 保養：加入／移除設備、保養狀態、客戶簽收、備註 | 部分 | 全部可編 |

沿用而不改的規則：`resultLocked`（未加入設備時「維修結果」鎖住，工項分類為「其他」時不受
此限）、`formData.isClosed` 的已結案唯讀行為。

因可編性改動而成為死碼、須一併刪除的：`updateScheduleFormField` 中 `customerName` 與
`storeName` 的連動分支（含「查無則保留原值」的註解），以及手刻的唯讀版
`renderScheduleServiceItems`（約 110 行）。設備卡片改用編輯頁已在使用的
`RepairCaseServiceItemCard`。

## 載入順序

`index.html` 需在 `case-form.js` 之前載入 `case-detail-sections.js`，在 `maintenance.js`
之前載入 `maintenance-detail-sections.js`。兩者都須早於
`src/features/scheduling/case-arrangement.js`。

`maintenance-detail-sections.js` 用到 `ProjectEquipPicker`（`src/features/project/
project-equip-picker.js`），該檔目前載入於 repair 區塊之後。此相依只在渲染時解析，非載入時，
故維持現有順序即可，與 `maintenance.js` 現況相同。

## 驗證

新增 `scripts/verify-arrangement-detail-sections.mjs`，格式比照既有的 `verify-*.mjs`
（headless Chrome 驅動真實頁面）。涵蓋：

- 維修與保養彈窗渲染出的區塊標題與編號（彈窗為 1..3、編輯頁為 1..4）
- 上表的可編性對照
- 加入設備後 `resultLocked` 解除
- 處理紀錄的新增、刪除、狀態切換
- 彈窗儲存後案件內容確實寫回 store
- 保養手選「已完成」不被 `planDate` 推算覆寫，且門市「上次保養日期」同步更新

既有的三支 script 直接呼叫 `CaseArrangement.renderScheduleServiceItems`，該函式將被刪除：
`verify-case-service-item-remarks.mjs`、`verify-case-multi-equipment-arrangement.mjs`、
`verify-case-service-item-pager.mjs`。它們斷言的是唯讀渲染，行為本就要改變，故改為走新模組
的 API 重寫斷言，不保留相容 alias。

回歸須一併跑過：`verify-case-repair-edit-gating`、`verify-case-status-completion`、
`verify-maintenance-detail-sections`、`verify-all-day-schedule`、`verify-scheduling-rwd`。
