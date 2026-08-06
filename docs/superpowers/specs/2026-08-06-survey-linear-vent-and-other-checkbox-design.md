# 現勘表：線型出風口多尺寸＋「其他」保留勾選設計

日期：2026-08-06  
狀態：已核准（待實作計畫）  
修訂：覆寫 `2026-08-05-survey-multi-other-qty-design.md` 中「不再把『其他』寫入 checkbox」「預設不顯示其他列僅見＋」等相反條款；其餘（`{checkName}Others` 資料殼、PDF 其他列文案、範圍內 14 組）仍沿用。

## 背景

1. **線型出風口**：目前勾選後只能填一組 `ventLinearWidth`／`ventLinearHeight` 與一個 `ventOutletsQty['線型出風口']`。現場常有多組不同寬高與數量。
2. **多筆「其他」**：已實作獨立陣列 `{checkName}Others`，但 UI 拿掉勾選、改為直接「＋ 新增其他」。希望與線型一致：**保留勾選，勾選後再按＋新增多列**。

## 目標

- 線型出風口可新增多筆「寬 × 高 × 數量」。
- 全部「多選＋數量」群組的「其他」改回 checkbox；勾選後展開多列名稱＋數量。
- 舊單筆線型寬高／舊單筆其他讀取時遷移；儲存與 PDF 走新格式。
- 取消勾選時保留明細資料（隱藏／禁用），再勾選還在。

## 非目標

- 不改單選「其他：請註明」、純多選文字「其他」欄位。
- 不改集風箱／出線型箱「管徑＋孔數＋數量」、回風口。
- 不強制寬高／名稱／數量必填才能暫存。

## 範圍

| 項目 | 範圍 |
|------|------|
| 線型多尺寸 | 僅出風口「線型出風口」 |
| 其他勾選＋多列 | 既有 14 組：`copperSizes`…`parts`（見 2026-08-05 spec 表） |

## 資料模型

### 線型出風口

```js
// ventOutlets 仍可含 '線型出風口'
ventLinearSizes: [
  { id: 'ls_1', width: '120', height: '10', qty: '3' },
  { id: 'ls_2', width: '90', height: '15', qty: '2' }
]
```

新存檔規則：

- 不再寫 `ventLinearWidth`、`ventLinearHeight`。
- 不再寫 `ventOutletsQty['線型出風口']`（數量在各尺寸列）。

### 「其他」（14 組）

```js
// checkbox 陣列含 '其他' 表示勾選
copperSizesOthers: [
  { id: 'o_1', label: '排水旁通', qty: '12' },
  { id: 'o_2', label: '額外銅管', qty: '3' }
]
```

新存檔規則：

- **寫入** `'其他'` 至 checkbox 選取陣列（表示勾選狀態）。
- 明細只在 `{checkName}Others`；不寫 `{checkName}_other`、不寫 `qtyMap['其他']`。

## 共同互動

| 動作 | 行為 |
|------|------|
| 勾選且尚無明細列 | 自動新增一列空白 |
| 按「＋」 | 再加一列 |
| 刪除 | 可刪到 0 列；勾選狀態仍保留 |
| 取消勾選 | 明細資料保留，UI 隱藏或禁用；再勾選時還在；若陣列為空則再補一列空白 |

寬高／名稱／數量均可空字串暫存。

## UI

### 「其他」

```
☐ 其他                              （無右側總數量）
   ┌ 其他：［請註明］  ［數量］單位  ［刪除］ ┐  ← 勾選後顯示
   └ …可多列…                              ┘
   ［＋ 新增其他］                         ← 勾選後顯示
```

- 未勾選：只見與固定選項同風格的「其他」checkbox。
- 勾選：展開明細列與「＋」；若尚無列則自動一列空白。

### 線型出風口

```
☐ 線型出風口                         （無右側總數量）
   ┌ 寬［ ］cm  高［ ］cm  ［數量］個  ［刪除］ ┐  ← 勾選後顯示
   └ …可多列…                                 ┘
   ［＋ 新增尺寸］
```

- 其餘固定出風口型式維持「勾選＋右側數量」不變。

## 舊資料遷移

在讀取／正規化 `surveyData` 時執行。

### 線型

1. 若 `ventLinearSizes` 尚非陣列，且存在舊訊號（`ventLinearWidth`／`ventLinearHeight`／`ventOutletsQty['線型出風口']` 任一有值）：  
   - 建立一筆 `{ id, width, height, qty }`（缺值 `''`）。  
   - 確保 `ventOutlets` 含 `'線型出風口'`（僅有舊寬高／數量亦補勾選）。
2. 若 `ventLinearSizes` 已是陣列：不覆蓋內容。
3. 一律清除殘留：`ventLinearWidth`、`ventLinearHeight`、`ventOutletsQty['線型出風口']`。
4. 載入結束後：若已勾選「線型出風口」且 `ventLinearSizes` 為空或不存在，補一筆空白列（與勾選互動一致）。

### 其他

沿用 2026-08-05 遷移邏輯建立 `{checkName}Others`，並改為：

1. 若由舊格式遷移出一筆 others，或既有 others 陣列長度 > 0：確保 checkbox 含 `'其他'`。
2. 仍刪除 `{checkName}_other` 與 `qtyMap['其他']`（不再把清除勾選當目標；勾選由上款寫回）。
3. 若 others 已是陣列則不覆蓋內容。
4. 載入結束後：若已勾選「其他」且 others 為空，補一筆空白列。

## PDF

### 其他

與 2026-08-05 相同（`formatOthersList`）：

| label | qty | 顯示（單位為米時） |
|-------|-----|-------------------|
| 有 | 有 | `其他：排水旁通 12米` |
| 有 | 無 | `其他：排水旁通` |
| 無 | 有 | `其他 12米` |
| 無 | 無 | `其他` |

多筆與固定選項之間以「、」連接。

### 線型出風口（`fmtVentOutlets`）

對 `ventLinearSizes` 每一筆產生一段，再以「、」連接：

| width/height | qty | 顯示例 |
|--------------|-----|--------|
| 有 | 有 | `線型出風口 3個（120×10 cm）` |
| 無 | 有 | `線型出風口 3個` |
| 有 | 無 | `線型出風口（120×10 cm）` |
| 無 | 無 | `線型出風口` |

括號規則（對齊現行單筆）：該筆 `width` 或 `height` 任一有值時加 `（{width}×{height} cm）`（缺側為空字）；兩側皆空則不加括號。

輸出條件：`ventOutlets` 含「線型出風口」，或 `ventLinearSizes` 有列時，依各列輸出（遷移後有舊資料者應已勾選）。

## 實作落點

- `src/features/project/survey-check-qty-others-utils.js`  
  - 遷移寫回 `'其他'`；提供勾選時若空則 `addOther` 的輔助（或由表單在 onChange 呼叫）。
- 新建或同檔擴充：`ventLinearSizes` 的 migrate／get／add／update／remove／PDF 格式化。
- `src/features/project/survey-form.js`  
  - `renderCheckQtyOthersBlock`：改為「其他」checkbox ＋ 勾選後展開多列與「＋」。  
  - `renderVentOutletRow`：線型無右側總數量；勾選後多列寬高數量與「＋ 新增尺寸」。
- `src/features/project/survey-pdf.js`  
  - `fmtVentOutlets` 改讀 `ventLinearSizes`；其他列維持串 others。

## 驗收標準

1. 線型出風口可勾選、自動一列空白、可「＋」多筆寬／高／數量並刪除。
2. 取消勾選線型後資料仍在；再勾選可繼續編輯。
3. 舊單筆寬高＋數量開啟後成為一筆 `ventLinearSizes`，PDF 正確。
4. 全部 14 組「其他」為 checkbox；勾選後展開多列與「＋」；取消勾選保留明細。
5. 舊單筆其他遷移後勾選為真，並顯示一筆 others。
6. 固定選項（非線型、非其他）行為不變；集風箱／回風口／單選其他不變。
7. PDF：多筆其他與多筆線型尺寸皆正確列出。
