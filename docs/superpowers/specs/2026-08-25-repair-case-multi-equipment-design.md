# 叫修案件多筆設備資料設計

## 需求

一張叫修案件可加入多筆設備資料，每一筆設備對應一份獨立的服務項目（實際維修原因＋處理方式清單）。

## 現況

案件的設備與服務項目都是單一份，散在案件物件的三個欄位：

- `case.equipment`：單筆設備快照（`null` 表示尚未加入）
- `case.actualReason`：實際維修原因（字串）
- `case.processRecords`：處理方式陣列（大類／中類／小類／規格／數量／待處理·已完成／積分）

編輯案件頁面把它們拆成兩個區塊：「3. 設備資料」與「4. 服務項目」，服務項目區在未加入設備前是半透明鎖定狀態。

讀取端共 11 處：`case-view.js`、`case-pdf.js`、`case-arrangement.js`、`case-status.js`、
`case-extension.js`、`performance-utils.js`、`case-assignee-utils.js`、`store-repair-form.js`、
`case-form.js`、`case-equipment.js`、`data/seed.js`。

## 資料模型

案件改以 `serviceItems` 陣列承載，順序即畫面卡片順序：

```js
case.serviceItems = [{
  id: 'SI...',           // 卡片識別，移除／編輯用
  equipment: {...},      // 設備快照，格式同原 case.equipment
  actualReason: '',      // 該設備的實際維修原因
  processRecords: [...]  // 該設備的處理方式，單筆格式完全不變
}]
```

`case.equipment`、`case.actualReason`、`case.processRecords` 自案件物件移除，不做雙寫，
避免兩份真相分歧。

### 遷移

遷移邏輯放在 `CaseAssigneeUtils.normalizeRepairCase()`（`src/features/repair/case-assignee-utils.js`）。
該函式是全站唯一鎖點：`seed.js` 載入時對每筆案件跑一次，`case-form.js` 的新增／編輯與
`store-repair-form.js` 存檔各跑一次。規則：

1. 已有 `serviceItems` → 只補齊欄位（`id`、`actualReason`、`processRecords` 預設值）。
2. 沒有 `serviceItems`，但 `equipment`／`actualReason`／`processRecords` 任一有值
   → 摺成單筆 `serviceItems[0]`，並 `delete` 掉三個舊欄位（同現有 `delete next.assignee` 手法）。
3. 三者皆空 → `serviceItems: []`。

seed.js 的既有資料因此不需逐筆改寫。

### 聚合 helper

新檔 `src/features/repair/case-service-items.js`，掛 `window.RepairCaseServiceItems`：

- `getItems(c)` → `serviceItems` 陣列（永遠回傳陣列）
- `getAllProcessRecords(c)` → 攤平所有卡片的處理方式
- `getEquipments(c)` → 所有設備快照
- `hasAnyProcessData(c)` → 任一卡片有維修原因或處理方式
- `createItem(equipment)` → 新卡片物件
- `removeItem(c, id)` / `updateItem(c, id, patch)`

讀取端多半只需把 `c.processRecords` 換成 `RepairCaseServiceItems.getAllProcessRecords(c)`。

## 版面

編輯案件頁的「3. 設備資料」與「4. 服務項目」合併為 **「3. 設備與服務項目」**，
原「5. 維修結果」遞補為「4. 維修結果」。同一套編號用於 `case-form.js`、`case-view.js`
與 `case-pdf.js` 的叫修案件明細；保養明細 PDF 的編號（1./2./3./4. 保養結果）不受影響。

```
3. 設備與服務項目          [＋ 加入設備 ▾]
┌─ 設備 1  分離式冷氣 RAS-100        [移除] ─┐
│ 分類 品牌 名稱 規格 型號 等級 區域 …       │
│ ─────────────────────────────────────────  │
│ 實際維修原因 [                          ]  │
│ 處理方式 [大][中][小][規格][數量] (＋加入)  │
│  • 清洗濾網  x2   已完成   [移除]          │
└────────────────────────────────────────────┘
┌─ 設備 2  冰水主機 …                [移除] ─┐
```

- 區塊標頭右側維持既有的「加入設備 ▾」下拉（手動選擇／掃描 QR Code）；
  每觸發一次**新增一張卡片**，不再覆蓋既有設備。
- 卡片設備欄位沿用 `RepairCaseEquipment.Panel`；處理方式挑選列與明細表沿用 `ProcessMethodUtils`。
- 卡片右上角「移除」刪除整張卡片（含其服務項目）。
- 沒有任何卡片時顯示現行的虛線空狀態文字。
- 工項分類為「其他」時，卡片內隱藏「實際維修原因」（維持現行行為）。
- **允許**同一設備被加入多張卡片（同一台機器可能有兩種修法），不做重複檢查。

卡片抽成新元件 `src/features/repair/case-service-item-card.js`，
避免 `case-form.js`（現 948 行）繼續膨脹。
「新增處理方式」的暫存選擇（大／中／小／規格／數量）改為 per-card，
以 `newRecordByItemId` map 保存，各卡片互不干擾。

### 驗證與鎖定

- 現行「有服務項目時必須先加入設備」的存檔檢查隨結構消失（服務項目本就掛在設備下）；
  改為擋「卡片缺少設備快照」這種不應發生的狀況。
- 「維修結果」區塊的鎖定條件由 `!formData.equipment` 改為 `serviceItems.length === 0`
  （工項分類為「其他」時不受此限，維持現行）。
- 已汰換設備不可加入的規則不變。

## 下游改動

| 檔案 | 改法 |
|---|---|
| `case-view.js` | 唯讀明細改為逐設備分卡呈現，與編輯頁一致 |
| `case-pdf.js` | 原 3./4. 兩節合併，逐設備輸出「設備欄位＋維修原因＋處理方式表」 |
| `case-arrangement.js` | 派工明細的設備／服務項目改讀 helper，多設備依序列出 |
| `case-status.js` | `hasProcessData` 改用 `RepairCaseServiceItems.hasAnyProcessData` |
| `case-extension.js` | 見下節 |
| `performance-utils.js`、`case-assignee-utils.sumProcessPoints` | 計分改攤平所有卡片的處理方式 |
| `store-repair-form.js`、`case-form.js` 新增案件 | 初始值改 `serviceItems: []` |
| `seed.js` | 不改既有資料（靠 normalize 遷移）；另補 1–2 筆多設備案例供展示 |

### 延伸案件

`buildExtensionCase` 帶**全部**設備卡片到新案，但每張卡片只保留狀態為「待處理」的處理方式；
已完成的項目留在原案作為歷史紀錄。因此新案可能出現「有設備、服務項目為空」的卡片，這是預期行為。
`actualReason` 隨各自卡片帶過去（原本是案件層級單一欄位）。

### 增額積分

`performance-utils.isAddOnEquipmentCase` 目前依單一設備的等級判定。多設備時採
**任一設備等級為「增額設備」即整案符合**，因為積分本就是案件層級加總。
逐設備分開計分屬另一議題，不在本次範圍。

## 驗證

新增 `scripts/verify-case-multi-equipment.mjs`，沿用既有 CDP headless Chrome 流程，斷言：

1. 加入兩台設備 → 出現兩張卡片
2. 兩張卡片的實際維修原因與處理方式互不干擾
3. 移除中間一張卡片，其餘不受影響
4. 存檔後重開，多筆設備資料仍在
5. 舊案（seed 單設備）自動遷移後顯示正常

回歸驗證：`verify-case-extension.mjs`、`verify-case-repair-edit-gating.mjs`、
`verify-equipment-level-points.mjs`、`verify-process-record-status.mjs`、
`verify-case-add-equipment-menu.mjs`。

## 不在範圍

- 逐設備分別計算績效積分
- 保養單（`maintenance.js` 的 `equipmentList`）結構調整
- 設備卡片排序拖拉
