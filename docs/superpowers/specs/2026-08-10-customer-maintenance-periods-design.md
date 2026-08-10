# 保養區間改由客戶自訂設計

日期：2026-08-10

## 目標

把「保養區間」從服務等級搬到客戶，因為每間客戶的保養月份不一樣，即使服務等級相同。

搬遷後的職責切分：

- **服務等級**回答「一年幾次、是否納入保養分配、是否計算增額積分」。
- **客戶**回答「這幾次分別落在哪幾個月」。

## 決策

| 議題 | 決定 |
|---|---|
| 每年保養次數的歸屬 | 留在服務等級。它同時決定該客戶要設定幾個保養區間，以及是否納入保養分配 |
| 服務等級是否保留預設區間 | 完全移除。單一資料來源，避免「該看哪一份」的歧義 |
| 客戶未設定區間 | 視為無區間：保養分配該列月份全白、不可編輯，排程不帶入 |
| seed 假資料 | 每個客戶沿用其原服務等級的區間，畫面與現況完全一致 |
| 客戶區間的驗證 | 驗證但**不擋下**儲存，只跳提醒 toast；客戶列表對不完整者加註記 |
| 服務等級次數被改動後的既有客戶 | 不自動遷移。保養分配照客戶現有區間畫；客戶下次編輯時表單自動補齊空列並於儲存時提醒 |
| 門市的服務等級 | 不動。仍只用於篩選「該指派人員負責、且等級納入保養分配」的門市 |

## 資料模型

### 服務等級記錄

移除 `periods`，只留：

```js
{
  id: 'SL001',
  name: 'A 保修(一年四次)',
  maintenanceCount: 4,
  countsBonusPoints: false
}
```

`src/data/seed.js` 的 `INITIAL_SERVICE_LEVELS` 四筆皆刪去 `periods` 欄位，其餘值不變。

### 客戶記錄

新增 `periods`：

```js
{
  id: 'C001',
  name: '…',
  serviceLevel: 'A 保修(一年四次)',
  periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 3 },
    { visitIndex: 2, startMonth: 4, endMonth: 6 },
    { visitIndex: 3, startMonth: 7, endMonth: 9 },
    { visitIndex: 4, startMonth: 10, endMonth: 12 }
  ]
}
```

`src/data/seed.js` 的每筆客戶依其 `serviceLevel` 填入：

| 服務等級 | periods |
|---|---|
| A 保修(一年四次) | 1-3 / 4-6 / 7-9 / 10-12 月 |
| B 保修(一年兩次) | 1-6 / 7-12 月 |
| C 保養(一年一次) | 1-12 月 |
| D 維修(無簽約客戶) | `[]` |

如此保養分配、案件排程、保養進度的畫面與搬遷前完全一致。

## 函式搬遷

### service-level-utils.js（移除）

- 刪除 `getPeriods`、`findPeriodForMonth`、`formatPeriodsLabel`，並自 `window.ServiceLevelUtils` 移除。
- `normalizePeriods` 內部函式刪除。
- `normalizeRecord` 回傳 `{ name, maintenanceCount, countsBonusPoints }`。
- `validate` 只留：名稱必填、名稱不重複（排除 `excludeId`）、每年保養次數為 0 或正整數。區間筆數／月份／重疊三條規則刪除。
- `getMaintenanceCount`、`countsBonusPoints`、`isAllocatable`、`findByName`、`isServiceLevelInUse`、`syncServiceLevelOptions`、`renameServiceLevel` 維持不變。`renameServiceLevel` 不受影響，因為客戶區間不存服務等級名稱。
- 檔頭註解更新：服務等級是「每年保養次數」「是否計算增額積分」的唯一資料來源，保養區間改由客戶持有。

### customer-utils.js（新增）

四支對應函式，改以客戶名稱查詢：

| 函式 | 行為 |
|---|---|
| `getPeriods(customers, customerName)` | 依 `visitIndex` 排序回傳；查無客戶或無區間回 `[]` |
| `findPeriodForMonth(customers, customerName, month)` | 回傳 `startMonth <= month <= endMonth` 的區間，查無回 `null` |
| `formatPeriodsLabel(customer)` | 例 `第1次 1-3月、第2次 4-6月`；無區間回 `—` |
| `validatePeriods(periods, expectedCount)` | 回傳錯誤訊息字串陣列，空陣列代表通過 |

`normalizePeriods(periods)` 為模組內部 helper（`visitIndex` 轉數字、月份空字串保留、依 `visitIndex` 排序），供上述函式共用。

#### `validatePeriods` 規則

1. 區間筆數等於 `expectedCount`。
2. 每個區間的起始月與結束月皆為 1–12 的整數（留空即算錯）。
3. 起始月 ≤ 結束月（不支援跨年區間，與搬遷前一致）。
4. 同一客戶的任兩區間不得重疊。

錯誤訊息沿用搬遷前的措辭，例：`第2次的起始月不可大於結束月`、`第1次與第2次的保養區間重疊`。

## UI

### service-level-form.js

刪除「保養區間」整區與相關 state。「每年保養次數」變更時不再增減區間列。次數為 0 時仍顯示提示文字，改為「此服務等級不納入保養分配」。

### service-level-list.js

刪除「保養區間」欄與 `formatPeriodsLabel` 的引用。

### customer-form.js

在「服務等級」下拉底下新增「保養區間」區塊：

- 依 `ServiceLevelUtils.getMaintenanceCount(serviceLevels, formData.serviceLevel)` 渲染 N 列，每列為唯讀的「第 N 次」加上起始月、結束月兩個 select（1–12 月）。
- 切換服務等級時自動增減列：增加時補 `{ visitIndex: n, startMonth: '', endMonth: '' }`，減少時砍尾端多的列，已填的前段保留。
- 次數為 0 時整區隱藏，顯示「此服務等級不納入保養分配」。
- 編輯既有客戶時，若 `targetCase.periods` 筆數與目前等級次數不符（服務等級的次數事後被改動），比照上述規則補齊或截斷後渲染。
- 儲存時跑 `CustomerUtils.validatePeriods(periods, expectedCount)`。**有錯仍照常儲存**，額外 `showToast(errors[0], 'error')`（`showToast` 只支援 `success`／`error` 兩型，提醒沿用 `error` 的紅底樣式）。無錯則維持原本的成功 toast。

props 需新增 `serviceLevels`，由 app store 經 props 傳入（與 `deviceCategories` 現行作法一致）。

### customer-list.js

新增「保養區間」欄，內容為 `CustomerUtils.formatPeriodsLabel(customer)`。若 `validatePeriods` 不通過，改顯示紅字「區間未設完整」。此欄不納入關鍵字搜尋。列表需取得 `serviceLevels` 才能算 `expectedCount`，props 一併新增。

## 接線

### maintenance-allocation.js

- [maintenance-allocation.js:77](../../../src/features/permissions/maintenance-allocation.js#L77) 的 `ServiceLevelUtils.findPeriodForMonth(serviceLevels, row.serviceLevel, month)` 改為 `CustomerUtils.findPeriodForMonth(customers, row.customerName, month)`。
- [maintenance-allocation.js:182](../../../src/features/permissions/maintenance-allocation.js#L182) 的 `ServiceLevelUtils.getPeriods(serviceLevels, row.serviceLevel)` 改為 `CustomerUtils.getPeriods(customers, row.customerName)`。
- 點到非區間月份的 toast 文案改為「此月份不在該客戶的保養區間內」。
- `getCustomerRows` 回傳的列結構不變（仍含 `serviceLevel`，供列首 badge 顯示）。
- props 需確保有 `customers`（保養分配已透過 `getCustomerRows` 取用 customers，確認同樣傳入元件本身）。

### maintenance-allocation-utils.js

不需改動。`isAllocatableServiceLevel`、`getCoveredStoresForAssignee`、`getCustomerRows`、`countCompletedStores` 的邏輯皆不涉及區間查詢（`countCompletedStores` 收的是已解析好的 `period` 物件）。

### schedule-utils.js

- `formatMaintenancePeriod(dateStr, serviceLevels, serviceLevelName)` 改為 `formatMaintenancePeriod(dateStr, customers, customerName)`，內部改呼叫 `CustomerUtils.findPeriodForMonth`。查無區間時仍只回年份。
- 註解由「依服務等級的保養區間」改為「依客戶的保養區間」。
- `generateDueMaintenanceCases` 不變，仍以 `getMaintenanceCount` 換算到期間隔月數。

呼叫點：

| 檔案 | 行 | 改動 |
|---|---|---|
| [case-arrangement.js](../../../src/features/scheduling/case-arrangement.js#L727) | 727 | 傳 `customers` 與該案件的 `customerName` 取代 `serviceLevels` 與 `levelName` |
| [maintenance.js](../../../src/features/repair/maintenance.js#L338) | 338 | 同上 |

兩處案件皆已持有 `customerName`；若該檔尚未取得 `customers`，自 props 補上。

## 驗證腳本

`scripts/verify-service-level-management.mjs`：

- Section 1 的 `getPeriods`／`findPeriodForMonth`／`formatPeriodsLabel`／`isAllocatable` 相關斷言，區間部分改測 `CustomerUtils` 對應函式，`isAllocatable` 留在服務等級段落。
- `validate` 的區間筆數／月份／重疊三組斷言移到新的 `CustomerUtils.validatePeriods` 段落。
- Section 6 `formatMaintenancePeriod` 的斷言改用新簽章與客戶 fixture。
- 新增斷言：客戶表單切換服務等級時區間列數跟著變；區間不完整仍可儲存並跳提醒 toast；客戶列表對不完整客戶顯示「區間未設完整」。
- `INITIAL_SERVICE_LEVELS` 的 fixture 移除 `periods`；客戶 fixture 補上 `periods`。

## 測試重點

1. 保養分配畫面在 seed 資料下與搬遷前逐格一致（區段底色、邊框、`第N次 已完成/負責` 標記）。
2. 同一服務等級的兩個客戶設不同月份時，保養分配兩列各自依自己的區間分段。
3. 客戶區間留空儲存 → 存得下去、跳提醒、列表顯示「區間未設完整」、保養分配該列月份全白且點不開。
4. 服務等級在管理頁把次數由 2 改 4 後，既有 B 級客戶的保養分配仍照舊兩段；進客戶編輯頁會看到補出的兩列空白，儲存時跳提醒。
5. 增額積分、案件排程自動帶入服務等級等既有行為不受影響。
