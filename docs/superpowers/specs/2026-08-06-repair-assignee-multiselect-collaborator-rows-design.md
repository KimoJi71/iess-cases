# 叫修案件：指派人員下拉複選 selector ＋ 協作列（人員／人數／積分）

日期：2026-08-06  
狀態：已核准（待實作計畫）

前置設計：`2026-08-06-repair-multi-assignee-collaborators-design.md`（多指派與協作積分的資料模型與績效公式）。本文件只調整**輸入介面**與**協作資料結構**，不改績效歸戶原則。

## 背景

多指派與協作積分已實作，但輸入介面是長條 checkbox 清單：指派人員一次列出所有人員，協作人員也是 checkbox 群組＋唯讀人數＋各人一格積分。清單會把表單撐長，且協作端無法表達「這一筆協作出動了幾個人」。

## 目標

- 指派人員改為**下拉式複選 selector**（收合時以 chips 顯示已選），套用於叫修新增／編輯表單、門市叫修表單、案件安排日曆的排程 Modal。
- 協作人員設定改為**可多筆的組合列**：每列＝（協作人員、協作人數、協作積分），全部手動選取或登打，可新增／刪除。
- 協作人數不再唯讀計算，改為手動輸入，僅作紀錄。

## 非目標

- 不改績效積分公式的歸戶原則（協作積分整筆歸戶、剩餘平分給正式指派人員）。
- 不改保養、工程的單指派模型。
- 不加搜尋過濾功能到複選 selector（人員清單短，YAGNI）。

## 決策摘要

| 項目 | 決定 |
|------|------|
| 指派 selector 樣式 | 下拉面板＋勾選框；收合時欄位內顯示 chips，chip 可單獨移除 |
| selector 套用範圍 | 叫修新增／編輯表單、門市叫修表單、案件安排日曆排程 Modal |
| 協作列語意 | 單選人員＋手動人數＋該筆總積分，整筆歸戶給該人員 |
| 協作人數 | 手動輸入整數，預設 1，**不參與積分計算**，僅紀錄 |
| 協作人員重複 | 不允許；已被其他列選走的人員在本列下拉中不可選 |
| 積分公式 | 不變 |

## 元件：`src/core/multi-select.js`

比照 `src/core/searchable-select.js` 的既有寫法（`global.IESS.h`、`global.IESS.stateful`、IIFE 掛載），對外掛在 `window.IESS.MultiSelect`。

介面（純受控，元件不保存資料）：

```js
MultiSelect({
  options: ['A組', 'B組'],   // string[]
  value: ['A組'],            // string[]
  onChange: function (next) {},  // 回傳新的 string[]
  placeholder: '請選擇',
  disabled: false,
  className: ''
})
```

行為：

- 收合：欄位內以 chips 顯示 `value`，每個 chip 帶 `×` 可單獨移除（觸發 `onChange`）。`value` 為空時顯示 placeholder。右側 chevron。
- 展開：面板列出 `options`，每列勾選框＋名稱，點擊切換該項。
- 關閉：點面板外、Esc、或按欄位本身。
- `disabled` 時不可展開、chip 不顯示 `×`。
- 欄位高度隨 chips 換行增加，但不再是整段清單。

載入順序：`index.html` 於 `src/core/searchable-select.js` 之後加入 `<script src="src/core/multi-select.js"></script>`。

## 指派人員改用 selector

三處把現有 checkbox 群組換成 `IESS.MultiSelect`，`options` 為 `ASSIGNEES`／`assignees.map(a => a.name)`，`value` 為 `CaseAssigneeUtils.getAssignees(formData)`，`onChange` 直接寫回 `formData.assignees` 後 rerender：

| 檔案 | 位置 |
|------|------|
| `src/features/repair/case-form.js` | `renderAssigneeMultiSelect` 改為包裝 `IESS.MultiSelect`；新增與編輯表單共用 |
| `src/features/customer/store-repair-form.js` | 同名的區域 `renderAssigneeMultiSelect` 同步改寫 |
| `src/features/scheduling/case-arrangement.js` | 排程 Modal 內叫修指派的 checkbox 群組（約 `case-arrangement.js:954`、`:968` 一帶） |

`CaseAssigneeUtils.toggleAssignee` 保留（`onChange` 已回傳完整陣列，新 UI 不需要它，但既有呼叫端可續用）。

## 協作資料模型

`collaborators` 每筆由 `{ name, points }` 改為：

```js
collaborators: [
  { name: 'B組', count: 2, points: 10 },
  { name: 'C組', count: 1, points: 5 }
]
```

| 欄位 | 意義 | 型別／規則 |
|------|------|-----------|
| `name` | 協作人員，來源＝完整指派人員清單 | 字串；空字串的列於讀取時捨棄 |
| `count` | 協作人數，僅作紀錄 | 整數；`Number(count) > 0 ? Math.floor(...) : 1` |
| `points` | 該筆總積分，整筆歸戶給 `name` | 數字，可為 0 或負 |

`CaseAssigneeUtils` 調整：

- `getCollaborators(record)` 一併正規化並回傳 `count`；缺值或非正整數補 `1`。
- `normalizeRepairCase` 沿用 `getCollaborators`，舊資料自動補 `count: 1`。
- 舊資料若已存在同名多筆，讀取時不強制合併（僅新輸入時擋重複），計算仍為加總，與現況一致。
- 新增以 index 為基準的列操作，取代目前以 name 為鍵的寫法：
  - `addCollaboratorRow(collaborators) → collaborators.concat({ name: '', count: 1, points: 0 })`
  - `updateCollaboratorRow(collaborators, index, patch) → 新陣列`
  - `removeCollaboratorRow(collaborators, index) → 新陣列`
  - `getAvailableCollaboratorNames(collaborators, index, allNames) → string[]`（排除其他列已選的人員）
- `toggleCollaborator` / `setCollaboratorPoints` 保留供既有呼叫端，新 UI 不使用。

### 積分公式（不變）

```
total     = Σ(processRecords.points × qty)
collabSum = Σ(collaborators.points)          // count 不進公式
remainder = total − collabSum                 // 可為負
n         = 正式指派人數
share     = n > 0 ? remainder / n : 0

A 的本案積分 = (A ∈ 正式指派 ? share : 0) + (A 的協作列 points)
```

`computeBonusPointsForAssignee` 邏輯不需改動（既有實作已對同名列加總）。

## 協作區塊 UI

叫修新增／編輯表單與門市叫修表單的「協作人員設定」改為列表：

```
協作人員設定
┌ 協作人員 ──────┬ 協作人數 ┬ 協作積分 ┬─┐
│ [B組      ▾]  │ [  2  ] │ [  10 ] │×│
│ [C組      ▾]  │ [  1  ] │ [   5 ] │×│
└───────────────┴─────────┴─────────┴─┘
[＋ 新增協作]
```

- 每列：人員下拉單選（選項＝`getAvailableCollaboratorNames`，本列現值恆保留）、人數 `type="number"`、積分 `type="number"`、刪除鈕。
- 「＋ 新增協作」附加 `{ name: '', count: 1, points: 0 }`；可選人員被選完時停用。
- 無協作列時只顯示新增鈕。
- 未選人員的列儲存時由 `getCollaborators` 過濾掉。

### 唯讀顯示

`formatCollaborators` 改為 `B組（2人／10分）、C組（1人／5分）`；無資料維持 `—`。影響 `case-view.js`、`case-review.js`、`store-history.js` 等既有呼叫端，無需個別改寫。

## 參考更新

`AssigneeUtils.updateAssigneeReferences` 對 `collaborators[].name` 的更名同步邏輯不變（新增的 `count` 不受影響）。

## 測試重點

`scripts/verify-repair-multi-assignee.mjs` 補上：

- 多筆協作列的 `collabSum` 與各自歸戶正確。
- `count` 改變不影響任何人的積分。
- 舊資料（無 `count`）讀取後補為 `1`。
- `getAvailableCollaboratorNames` 排除其他列已選人員、保留本列現值。
- `addCollaboratorRow` / `updateCollaboratorRow` / `removeCollaboratorRow` 不變動原陣列。
- 空 `name` 的列被 `getCollaborators` 濾除。
- `formatCollaborators` 輸出格式。

`MultiSelect` 為 DOM 元件，以手動驗證涵蓋：勾選／取消、chip 移除、點外關閉、`disabled`。

## 成功標準

- 三處指派人員皆為下拉複選，收合時看得到已選 chips，表單不再被人員清單撐長。
- 協作可新增多筆（人員／人數／積分），可刪除，人員不重複。
- 協作人數手動輸入且不影響績效積分；協作積分歸戶結果與改版前一致。
- 舊資料讀取後 `count` 自動補 `1`，績效報表數字不變。
