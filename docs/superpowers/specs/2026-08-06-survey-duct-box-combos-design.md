# 現勘表：風箱多組合（材質／法蘭／管徑／孔數／數量）設計

日期：2026-08-06  
狀態：已核准（待實作計畫）  
相關：`2026-08-06-survey-linear-vent-and-other-checkbox-design.md`（線型多尺寸／其他勾選；本文件補齊當時非目標的風箱區）

## 背景

集風箱、出／線型箱、回風箱、強制回風箱、三通風箱目前是「整卡共用」材質與法蘭內徑，管徑則以勾選＋孔數／數量（三通無孔數／無法蘭）。現場常需多組不同材質／法蘭／管徑組合，無法以單一答案表達。

## 目標

- 五種風箱改為「一列一組答案」，可新增多組。
- 一般風箱每列含：材質（含其他註明）、法蘭寬高、管徑、孔數、數量。
- 三通風箱每列含：材質（含其他註明）、管徑、數量（無法蘭、無孔數）。
- 舊資料自動遷移；儲存與 PDF 走新格式。
- 欄位可不填仍可暫存。

## 非目標

- 不改出風口／回風口／特製風箱／軟管等其他風管區塊。
- 不改管徑固定選項清單（仍用 `DUCT_BOX_PIPES`／`DUCT_TEE_PIPES`）。
- 不強制任一欄必填才能暫存。
- 不做通用 multi-row 抽象元件（僅風箱專用 utils，對齊線型 utils 模式）。

## 範圍

| 項目 | prefix | 有法蘭／孔數 |
|------|--------|--------------|
| 集風箱（管徑、數量） | `collectBox` | 是 |
| 出／線型箱 | `outletBox` | 是 |
| 回風箱 | `returnBox` | 是 |
| 強制回風箱 | `forcedReturnBox` | 是 |
| 三通風箱 | `teeBox` | 否 |

## 資料模型

```js
// 一般風箱（四種）
collectBoxCombos: [
  {
    id: 'db_1',
    material: 'PU貼鋁皮',  // '' | 'PU貼鋁皮' | '鐵製' | '其他'
    materialOther: '',     // material === '其他' 時的註明
    flangeWidth: '30',
    flangeHeight: '20',
    pipe: '6"風管',        // 固定選項或 ''
    holes: '2',
    qty: '3'
  }
]

// 三通風箱
teeBoxCombos: [
  {
    id: 'db_2',
    material: '鐵製',
    materialOther: '',
    pipe: '8"',
    qty: '1'
  }
]
```

新存檔規則：

- 只寫 `{prefix}Combos`。
- 不再寫：`{prefix}Material`、`{prefix}Material_other`、`{prefix}FlangeWidth`、`{prefix}FlangeHeight`、`{prefix}Pipes`、`{prefix}PipesHoles`、`{prefix}PipesQty`。
- 各欄位可為空字串。

## UI

採分區卡片：每一組合一張白底列，內含材質／法蘭／管徑區（三通無法蘭與孔數）。

```
┌ 集風箱（管徑、數量） ─────────────────────┐
│ ┌ 組合列 ─────────────────────────── 🗑 ┐ │
│ │ 材質 ○PU貼鋁皮 ○鐵製 ○其他［請註明］   │ │
│ │ 法蘭內徑 寬［ ］cm  高［ ］cm          │ │
│ │ 管徑［4"風管▾］  ［ ］孔  ［ ］個      │ │
│ └────────────────────────────────────┘ │
│ ［＋ 新增組合］                          │
└────────────────────────────────────────┘
```

| 動作 | 行為 |
|------|------|
| 開啟／載入後陣列為空 | 自動一列空白 |
| 按「＋ 新增組合」 | 再加一列空白 |
| 刪除 | 可刪到 0 列，只留「＋」 |
| 材質選「其他」 | 該列可填註明；非其他時禁用註明欄（保留既有字串，對齊現行單選其他） |
| 管徑 | `<select>`，選項為對應固定清單，可選空白 |

卡片標題維持現況；樣式對齊現有 indigo 區塊與線型／其他多列互動。

## 舊資料遷移

在讀取／正規化 `surveyData` 時，對每個 prefix 執行。

1. 若 `{prefix}Combos` 已是陣列：不覆蓋內容。
2. 否則若存在舊訊號（`Material`／`Material_other`／`FlangeWidth`／`FlangeHeight`／`Pipes`／`PipesHoles`／`PipesQty` 任一有值）：
   - 若 `Pipes` 為非空陣列：每個管徑一列，帶入共用材質、`materialOther`、法蘭（三通無）、該管徑孔數（三通無）與數量。
   - 若無勾選管徑但有材質／法蘭等：建立一列，管徑／孔數／數量為空。
3. 無論是否新建 Combos，結束時皆刪除舊鍵（避免與 Combos 雙軌殘留）。
4. 載入結束後：若 `Combos` 為空或不存在，補一筆空白列。

## PDF

改寫 `fmtDuctBox(prefix, sd)`：讀 `{prefix}Combos`，每列格式化後以「；」連接。

單列組裝（缺段省略）：

| 區段 | 規則 |
|------|------|
| 材質 | 有 `material` 時：`材質：{顯示}`；若為「其他」且 `materialOther` 有值則用註明，否則「其他」 |
| 法蘭 | `flangeWidth` 或 `flangeHeight` 任一有值：`法蘭內徑 {w}×{h} cm`（缺側空字） |
| 管徑段 | `pipe`；其後若有 `holes` 加 ` {holes}孔`；若有 `qty` 加 ` {qty}個` |

三通略過法蘭與孔數。  
列內各段以「；」連接；列與列之間亦以「；」連接（與現行 `fmtDuctBox` 一致）。  
整列組裝後為空則略過；全無有效列則回傳空字串。

尚未 migrate 的舊資料：PDF 路徑應先呼叫 migrate（或與表單載入相同正規化），避免雙軌格式。

## 實作落點

- 新建 `src/features/project/survey-duct-box-combos-utils.js`  
  - `PREFIXES`、migrate／get／add／update／remove／ensureBlank／formatCombo／formatCombosList
- `index.html`：在 vent-linear utils 之後、survey-pdf／form 之前載入
- `src/features/project/survey-form.js`：以多組合列取代 `renderDuctBox`／`renderDuctTeeBox` 舊結構；載入時呼叫 migrate
- `src/features/project/survey-pdf.js`：`fmtDuctBox` 改讀 Combos（必要時先 migrate）

## 驗收標準

1. 五種風箱皆可預設一列空白、「＋」多列、刪到 0 列。
2. 一般風箱每列可填材質（含其他）、法蘭、管徑、孔數、數量；三通無法蘭／孔數。
3. 刪到 0 列後再「＋」可繼續新增；空欄可暫存。
4. 舊「共用材質＋多管徑」開啟後變成多列 Combos，舊鍵清除。
5. PDF 多組合以「；」正確列出；材質其他註明正確。
6. 出風口線型／其他等多選數量行為不變。
