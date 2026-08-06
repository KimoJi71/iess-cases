# 叫修案件：多指派人員＋協作人員設定設計

日期：2026-08-06  
狀態：已核准（待實作計畫）

## 背景

叫修案件目前以單一字串 `assignee` 指派，績效增額積分整案歸戶一人。現場常有多人共同處理，且需另設協作人員與各自協作積分；處理項目總積分應先扣除協作積分後，剩餘再平分給指派人員。

## 目標

- 叫修「指派人員」改為多選；績效計算時剩餘積分平分給所有正式指派人員。
- 叫修案件新增「協作人員設定」：協作人員、協作人數（唯讀）、各協作人員各自的協作積分。
- 資料模型以陣列為唯一真相（作法 B）；列表、排程、日曆、績效報表全面改讀陣列。
- 新增／編輯可完整編輯；檢視／審核顯示（審核唯讀）。

## 非目標

- 不改保養 `maintenanceCases`、工程 `projectCases` 的單指派模型。
- 不因協作積分超過處理總積分而禁止儲存。
- 不強制指派人員或協作人員必填才能暫存／儲存（沿用現有案件必填規則；若現況指派可空則維持可空）。

## 決策摘要

| 項目 | 決定 |
|------|------|
| 積分分配 | 總積分 − Σ協作積分＝剩餘；剩餘 ÷ 指派人數；協作積分各自歸戶 |
| 協作人員來源 | 完整「指派人員管理」清單（不限本案件已選指派） |
| 協作人數 | 唯讀＝已選協作人員數 |
| 協作積分 | 每位協作人員各自手動填寫 |
| 兼任 | 允許同一人同時為指派與協作；兩邊積分都算 |
| 超額 | 允許剩餘為負 |
| 資料模型 | 僅 `assignees[]`／`collaborators[]`，不再以 `assignee` 字串為來源 |
| UI 範圍 | 新增＋編輯＋檢視＋審核（審核唯讀）；排程／列表一併相容 |

## 資料模型（叫修 `cases`）

### 來源真相

```js
assignees: ['A組', 'B組'],
collaborators: [
  { name: 'C組', points: 10 },
  { name: 'D組', points: 5 }
]
```

- `assignees`：指派人員名稱陣列（選項來自指派人員管理／`ASSIGNEES`）。
- `collaborators`：協作列；`name` 來自完整指派人員清單；`points` 為數字（可 0）。

### 不再作為來源

- 叫修案件不再寫入或依賴 `assignee: string` 作為真相。
- 讀取舊資料時正規化（見「遷移」）。

### 績效快照（列入績效時）

```js
performanceAssignees: ['A組', 'B組'],  // 當下 assignees 複本
performanceMemberIds: ['...'],         // 所有 performanceAssignees 對應組之 memberIds 聯集
isPerformanceIncluded: true
```

- 不再以單一 `performanceAssignee` 作為新寫入來源。
- 舊案僅有 `performanceAssignee` 時，讀取視為 `performanceAssignees: [performanceAssignee]`。

### 特殊指派值

下列視為「未正式指派」（與現況對齊）：

- `''`（空）
- `案件待辦`
- `尚未指派`

規則：

- 是否已指派：`assignees` 中存在任一**非**上述特殊值 → 已指派。
- 平分分母：只計**正式**指派名稱（排除特殊值）；若正式人數為 0，則 `share = 0`（協作積分仍可歸戶）。
- 列表顯示：無正式指派時顯示既有待辦／尚未指派文案；有多人時以「、」連接。

## 積分公式

對一筆已計績效條件之叫修案、對指派人員主檔成員 `A`：

```
total      = Σ(processRecords.points × qty)
collabSum  = Σ(collaborators.points)
remainder  = total − collabSum          // 可為負
n          = 正式指派人數
share      = n > 0 ? remainder / n : 0

A 的本案積分 =
  (A ∈ 正式 assignees 或 performanceAssignees ? share : 0)
  + (A 在 collaborators 中的 points；同名多筆則加總)
```

- 內部計算用浮點除法；UI 顯示可四捨五入至小數 1～2 位，加總避免過度中間捨入。
- 增額積分報表：對每位主檔指派人員，加總其在各符合條件叫修案上的「本案積分」。
**績效報表讀取規則（明確）：**

1. 指派名單：有正式 `assignees`（正規化後）則用它；否則回退 `performanceAssignees`；再否則回退舊 `performanceAssignee` 單字串。
2. 協作與處理積分：一律用案件當下 `collaborators`、`processRecords`。
3. 列入績效時仍寫入 `performanceAssignees`（當下 `assignees` 複本）與 `performanceMemberIds` 聯集，供稽核與舊資料回退；不另凍結每人積分明細。

## UI

### 新增／編輯叫修表單

1. **指派人員**：多選（checkbox 群組或同等多選），選項＝指派人員清單。
2. **協作人員設定**區塊（排程區下方或處理資料區上方）：
   - **協作人員**：多選，選項＝完整指派人員清單。
   - **協作人數**：唯讀，`collaborators.length`。
   - **協作積分**：每位已選協作人員各一數字輸入。
3. 新增與編輯皆具備完整協作設定；處理項目尚未加入時仍可先填協作。

### 檢視／審核

- 顯示指派人員（「、」連接）。
- 顯示協作區塊：人員、人數、各人積分。
- 審核頁唯讀。

### 列表／紀錄／門市歷史

- 「指派人員」欄顯示合併字串。
- 若有依指派篩選：改為 `assignees` **包含**該值。

### 排程／日曆／案件安排

- 待排／已排判斷改讀 `assignees`（特殊值規則同上）。
- 依指派人員篩選：`assignees` 包含該篩選值即符合。
- 日曆標題：合併字串。
- 案件安排寫回：指派改多選，寫入 `assignees` 陣列。

## 遷移與參考更新

### 讀取／seed／啟動正規化

| 條件 | 處理 |
|------|------|
| 有 `assignee`、無有效 `assignees` | `assignees = assignee ? [assignee] : []` |
| 無 `collaborators` | `collaborators = []` |
| 有 `performanceAssignee`、無 `performanceAssignees` | `performanceAssignees = performanceAssignee ? [performanceAssignee] : []` |
| seed | 叫修案改寫為陣列欄位，不再依賴字串 `assignee` |

正規化後呼叫端應只讀 `assignees`；可提供 `CaseAssigneeUtils`（或擴充 `AssigneeUtils`）統一：

- `getAssignees(record) → string[]`
- `formatAssignees(record) → string`
- `hasFormalAssignee(record) → boolean`
- `normalizeRepairAssignees(record) → record`
- `computeRepairBonusPointsForAssignee(record, assigneeName) → number`

### 指派人員更名

`updateAssigneeReferences` 須同步更新叫修案之：

- `assignees[]` 元素
- `collaborators[].name`
- `performanceAssignees[]`

（保養／工程仍更新其既有字串欄位。）

## 驗證

| 規則 | 行為 |
|------|------|
| 協作積分合計 > 處理總積分 | 允許；剩餘可為負；不擋存 |
| 協作人數 | 不手動輸入，唯讀 |
| 同一人兼任指派與協作 | 允許，兩邊都計分 |
| 協作人員不必是本案件指派 | 允許 |

## 主要改動檔（預期）

| 區域 | 檔案（示意） |
|------|----------------|
| 表單／檢視／審核／列表 | `case-form.js`, `case-view.js`, `case-review.js`, `case-list.js`, `case-record.js`, `case-status.js` |
| 門市叫修／歷史 | `store-repair-form.js`, `store-history.js` |
| 工具 | `assignee-utils.js`（或新 `case-assignee-utils.js`）、`performance-utils.js` |
| 排程 | `schedule-utils.js`, `case-arrangement.js`, `calendar-bridge.js`, `personnel-movement.js` |
| 資料 | `seed.js`；必要時 app 載入正規化 |

## 測試重點

- 單人／多人指派平分。
- 有協作／無協作；兼任兩邊。
- 協作合計 > 總積分 → 指派剩餘為負且可存。
- 舊 `assignee`／`performanceAssignee` 字串案讀取與績效加總。
- 排程篩選「包含」；日曆標題多人。
- 指派人員更名後陣列與協作名稱同步。
- 保養／工程指派行為不變。

## 成功標準

- 叫修可多選指派並儲存為 `assignees`。
- 協作設定可選人、見人數、各填積分，並於檢視／審核可見。
- 績效增額積分依公式正確歸戶（含負剩餘與兼任）。
- 列表／排程／日曆不再依賴叫修 `assignee` 字串真相。
- 舊資料可讀、可算。
