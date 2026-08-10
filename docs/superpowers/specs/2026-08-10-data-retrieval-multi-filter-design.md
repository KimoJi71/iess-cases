# 資料調閱：篩選下拉選單改為多選

日期：2026-08-10

## 背景與目標

「報表 → 資料調閱」（`src/features/reports/data-retrieval.js`）目前所有篩選條件都是單選的原生 `<select>`，每個欄位只能鎖定一個值或選「全部」。使用者要一次比對多個客戶、多位維修人員或多個行政區時，只能反覆查詢再自行合併。

目標：把資料調閱的**全部**篩選下拉選單改為多選，樣式沿用叫修單「指派人員」所使用的 `IESS.MultiSelect`（`src/core/multi-select.js`）。

涵蓋的欄位（依案件類型）：

| 案件類型 | 欄位 |
| --- | --- |
| 工程 | 工程類型、負責人員、客戶名稱 |
| 維修 | 工項分類、叫修項目、叫修原因、客戶名稱、門市名稱、維修人員、服務等級 |
| 保養 | 縣市、行政區、客戶名稱、維修人員、服務等級 |

時間區間（`FilterDateRange`）不在範圍內，維持現狀。

## 核心語意

- 篩選狀態由字串（`'全部'` 或某個值）改為**字串陣列**。
- **未選任何項目 = 全部**。選單內不再提供「全部」選項；`placeholder` 顯示「全部」。
- 同一欄位的多個選值之間是 **OR**；不同欄位之間維持 **AND**。

## 設計

### 1. 元件層（`src/features/reports/data-retrieval.js`）

以 `FilterMultiSelect(props)` 取代 `FilterSelect(props)`。外層結構與樣式不變（`div` + `labelCls` 的 `label`），控制項換成 `IESS.MultiSelect`：

```js
IESS.MultiSelect({
  id: props.id,              // 固定字串，例如 'dr-workCategory'
  options: props.options || [],
  value: props.value || [],
  onChange: props.onChange,  // function (nextValues)
  placeholder: '全部'
})
```

- `id` 為必填。`MultiSelect` 用它在父層 rerender 後維持展開狀態，缺少會 `console.warn` 且選單一點就關。每個欄位給固定且唯一的 id：`dr-workCategory`、`dr-repairItem`、`dr-repairReason`、`dr-customer`、`dr-store`、`dr-assignee`、`dr-serviceLevel`、`dr-contactPerson`、`dr-city`、`dr-district`。工程與維修共用 `dr-workCategory`／`dr-customer` 等 id 沒有衝突，因為同一時間只會渲染一種案件類型的篩選區。
- `onChange` 收到的是新的字串陣列（不是 event），與原本的 `e.target.value` 不同。
- 控制項高度會隨已選 chips 增加而變高；外層 grid 已是 `items-end`，對齊仍成立，不需調整版面。

`FilterDateRange` 不動。

### 2. 狀態層（`DataRetrieval`）

以下 11 個變數的初始值由 `'全部'` 改為 `[]`：

`filterWorkCategory`、`filterRepairItem`、`filterRepairReason`、`filterCustomer`、`filterStore`、`filterAssignee`、`filterServiceLevel`、`filterContactPerson`、`filterCity`、`filterDistrict`

`handleCaseTypeChange` 內的重設同步改為 `[]`。`getCurrentFilters()` 回傳的物件形狀不變，只是各欄位的值變成陣列。

### 3. 連動欄位

沿用現行行為：**上游一改就清空下游**。

- 客戶名稱 `onChange` → `filterCustomer = next; filterStore = [];`
- 縣市 `onChange` → `filterCity = next; filterDistrict = [];`

下游的**選項來源改為聯集**：

- 門市名稱
  - `filterCustomer` 為空陣列 → 維持現行「所有啟用門市名稱去重排序」。
  - 否則 → 對每個已選客戶呼叫 `StoreUtils.getStoreNameOptions(stores, customerName, null, true)`，合併、去重、以 `localeCompare(b, 'zh-Hant')` 排序。
- 行政區
  - `filterCity` 為空陣列 → `[]`（維持現行：未選縣市時行政區無可選項）。
  - 否則 → 對每個已選縣市呼叫 `StoreUtils.getDistrictsForCity(city)`，合併去重。

`CustomerUtils.getCustomerNameOptions` 與 `StoreUtils.getStoreNameOptions` 的 `selectedName` / `selectedStoreName` 參數原本用來保留「已選但已不在清單中」的舊值。改多選後，選值一律出自當下的選項清單，此需求消失，統一傳 `null`。兩支 util 本身不修改。

### 4. 篩選層（`src/features/reports/data-retrieval-utils.js`）

- `isAll(value)` 改為 `isAny(list)`：`return !list || !list.length;`。舊的 `'全部'` 字串判斷不需保留 —— 本檔僅由 `data-retrieval.js` 使用。
- 各欄位比對由 `c.x !== filters.x` 改為 `filters.x.indexOf(c.x) === -1`。
- `filterRepairCases` 的維修人員：現行為
  ```js
  CaseAssigneeUtils.includesAssignee(c, filters.assignee)
  ```
  改為「任一已選人員命中即通過」：
  ```js
  filters.assignee.some(function (name) {
    return window.CaseAssigneeUtils
      ? CaseAssigneeUtils.includesAssignee(c, name)
      : c.assignee === name;
  })
  ```
- `filterMaintenanceCases` 的維修人員為單一 `c.assignee` 欄位，改為 `filters.assignee.indexOf(c.assignee) !== -1`。
- `filterProjectCases` 的負責人員：解析邏輯 `(c.details && c.details.contactPerson) || c.stageAssignee || ''` 不變，只把相等比對改為陣列包含。

### 5. 不受影響的部分

`getColumns`、`buildRows`、`rowsToCsv`、`downloadCsv`、分頁與匯出檔名都只讀 `applied.items` 與 `applied.caseType`，不接觸 filters，無需改動。查詢按鈕的日期驗證（起日不可晚於迄日）維持原樣。

## 驗證

新增 `scripts/verify-data-retrieval-multi-filter.mjs`，比照 `scripts/verify-repair-multi-assignee.mjs` 的寫法，覆蓋：

1. 所有篩選為空陣列時，結果等同「全部」（僅受時間區間限制）。
2. 單一欄位多值時取 OR：選 `[A, B]` 的結果 = 選 `[A]` 的結果 ∪ 選 `[B]` 的結果。
3. 不同欄位之間仍是 AND。
4. 維修案件的維修人員多選，能命中多人指派（`CaseAssigneeUtils.includesAssignee`）的案件。
5. 客戶多選時，門市選項為各客戶門市的聯集且已去重。
6. 縣市多選時，行政區選項為各縣市的聯集。
7. 上游（客戶／縣市）變動後，下游（門市／行政區）被清空。

## 不在範圍內

- 時間區間欄位。
- 「案件績效統計」頁面的篩選。
- 匯出 CSV 的欄位或檔名格式。
- 把篩選條件持久化或寫入 URL。
