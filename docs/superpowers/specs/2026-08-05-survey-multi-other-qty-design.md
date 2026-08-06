# 現勘表「多選＋數量」可多筆「其他」設計

日期：2026-08-05  
狀態：已核准（部分條款已由 2026-08-06-survey-linear-vent-and-other-checkbox-design.md 覆寫：其他改回保留勾選、勾選後才展開多列）

## 背景

現勘表中配管工程、配電工程、風管軟管／出風口、零配件等「多選＋填數量／長度」群組，目前「其他」只有一列：勾選後填一個名稱與一個數量。現場常需要多筆自填項目（例如「其他：排水旁通 12米」「其他：額外銅管 3米」），現行結構無法表達。

## 目標

- 在「多選＋數量」類型群組中，可用「＋ 新增其他」新增多筆「其他：名稱＋數量」。
- 舊單筆「其他」資料讀取時自動遷移為新格式；儲存與 PDF 一律走新格式。
- 資料模型預留日後擴充（例如孔數＋數量），但本次不實作「x孔 x個」的其他列。

## 非目標

- 不改單選「其他：請註明」、純多選文字「其他」欄位。
- 不為集風箱／出線型箱「管徑＋孔數＋數量」新增「其他」（該區塊目前也沒有其他列）。
- 不強制要求名稱／數量必填才能暫存。

## 範圍內群組

凡目前使用 `renderPipingOtherRow`／`renderPipingCheckQtyGroup` 的群組，以及手寫同等「其他」列的零配件：

| 欄位前綴 (`checkName`) | 數量 map | 新 others 鍵 |
|------------------------|----------|--------------|
| `copperSizes` | `copperSizesQty` | `copperSizesOthers` |
| `copperFittings` | `copperFittingsQty` | `copperFittingsOthers` |
| `pvcDrain` | `pvcDrainQty` | `pvcDrainOthers` |
| `drainInsulation` | `drainInsulationQty` | `drainInsulationOthers` |
| `chilledFittings` | `chilledFittingsQty` | `chilledFittingsOthers` |
| `chilledPipe` | `chilledPipeQty` | `chilledPipeOthers` |
| `chilledInsulation` | `chilledInsulationQty` | `chilledInsulationOthers` |
| `channelFittings` | `channelFittingsQty` | `channelFittingsOthers` |
| `controlSignalWire` | `controlSignalWireQty` | `controlSignalWireOthers` |
| `powerCableWire` | `powerCableWireQty` | `powerCableWireOthers` |
| `insulatedHose` | `insulatedHoseQty` | `insulatedHoseOthers` |
| `uninsulatedHose` | `uninsulatedHoseQty` | `uninsulatedHoseOthers` |
| `ventOutlets` | `ventOutletsQty` | `ventOutletsOthers` |
| `parts` | `partsQty` | `partsOthers` |

命名規則：`{checkName}Others`。

## 資料模型

採「獨立陣列」方案：固定選項仍走 checkbox 陣列＋qty map；自填項目另存陣列。

```js
// 例：copperSizesOthers
[
  { id: 'o_1', label: '排水旁通', qty: '12' },
  { id: 'o_2', label: '額外銅管', qty: '3' }
]
```

欄位說明：

- `id`：列穩定識別（新增時產生），供 React key／更新／刪除。
- `label`：使用者自填名稱（可空字串）。
- `qty`：數量或長度字串（與現有 number input 一致，存字串即可）。

新存檔規則：

- 不再把 `'其他'` 寫入 checkbox 選取陣列。
- 不再寫 `{checkName}_other` 或 `qtyMap['其他']`。

### 日後擴充（本次不實作）

若未來某群組需要更多數字欄（如孔數），同一陣列殼子可長成：

```js
[{ id, label, holes, qty }]
```

UI 對齊該群組固定選項列的欄位；本次僅實作 `{ id, label, qty }`。

## UI

每個「多選＋數量」群組底部：

1. **預設**：不顯示其他列；顯示「＋ 新增其他」按鈕。
2. **按＋**：新增一列  
   `其他：［請註明］　［數量／長度］單位　［刪除］`  
   名稱與數量可直接填，無需再勾 checkbox。
3. 可重複按＋；每列可刪除。刪到 0 列後只剩「＋」。
4. 版面與固定選項列對齊（白底邊框列）；「其他：」為固定前綴，名稱用底線輸入框。

## 舊資料遷移

在讀取／正規化 `surveyData` 時執行（每個範圍內 `checkName` 各做一次）：

若尚未有非空的 `{checkName}Others`，且存在舊格式任一訊號：

- checkbox 陣列含 `'其他'`，或
- `{checkName}_other` 有值，或
- `qtyMap['其他']` 有值

則：

1. 建立一筆 `{ id, label: xxx_other || '', qty: qtyMap['其他'] || '' }` 寫入 `{checkName}Others`。
2. 從 checkbox 陣列移除 `'其他'`。
3. 刪除 `{checkName}_other` 與 `qtyMap['其他']`。

若 `{checkName}Others` 已存在且為陣列，則不覆蓋；仍可清掉殘留的舊 `'其他'` 欄位以免雙重顯示。

遷移可在表單載入 `formData.surveyData` 時做一次；之後儲存只留新格式。

## PDF

更新 `survey-pdf.js`：

- `fmtCheckQtyFromMaps`：固定選項照舊格式化後，再串接對應 `{checkName}Others`。
- `fmtVentOutlets`：同上（含既有線型寬高邏輯僅套用固定選項）。
- `fmtParts`：同上，單位仍為「組」。

其他列顯示規則：

| label | qty | 顯示（單位為米時） |
|-------|-----|-------------------|
| 有 | 有 | `其他：排水旁通 12米` |
| 有 | 無 | `其他：排水旁通` |
| 無 | 有 | `其他 12米` |
| 無 | 無 | `其他` |

多筆與固定選項之間以「、」連接。

## 實作落點

- `src/features/project/survey-form.js`
  - 以可多筆 others 渲染取代 `renderPipingOtherRow`。
  - `renderPipingCheckQtyGroup`／出風口／零配件改用同一 helpers：add / update / remove。
  - 載入時 normalize／migrate 上述群組。
- `src/features/project/survey-pdf.js`
  - 上述格式化函式支援 `{checkName}Others`。

## 驗收標準

1. 配管／配電／風管軟管／出風口／零配件等範圍內群組可新增多筆其他，每筆可填名稱與數量並刪除。
2. 預設不顯示其他列，僅見「＋ 新增其他」。
3. 舊單筆「其他」開啟後顯示為一筆 others，且不再出現舊 checkbox「其他」列。
4. PDF 正確列出多筆「其他：…」與數量單位。
5. 集風箱／出線型箱管徑區行為不變（仍無其他列）。
6. 單選／純文字「其他」欄位行為不變。
