# 系統權限 — 服務等級管理設計

日期：2026-08-07

## 目標

1. 在「系統權限」新增「服務等級管理」，可新增／查看／編輯／刪除服務等級。
2. 現有寫死的四個服務等級（`SERVICE_LEVEL_OPTIONS`）改為此功能的預設假資料。
3. 客戶管理的「服務等級」下拉改由此功能供給；客戶管理設定的服務等級，要真正套用到叫修單、工程立案、案件排程的自動帶入。
4. 增額積分的判定從寫死的 `C`／`D` 前綴，改為服務等級上的「是否計算增額積分」旗標。
5. 服務等級持有「每年保養次數」與對應的「保養區間（第 N 次：起始月～結束月）」，取代保養分配寫死的 A/B/C 清單與客戶的「保養區間（每季／每半年／每年）」欄位。
6. 保養分配表格以區間分段呈現，並顯示各區間的「已完成門市數 / 負責門市數」。

## 決策

| 議題 | 決定 |
|---|---|
| 增額積分邏輯的替換方式 | 等價替換：服務等級勾選「計算增額積分」→ 一律計分；未勾選 → 仍可因設備為「增額設備」而計分（保留設備等級例外） |
| 每年保養次數的用途 | 次數 > 0 才納入保養分配；並決定該等級需設定幾個保養區間 |
| 保養區間歸屬 | 屬於服務等級，非客戶。每區間為 `{ visitIndex, startMonth, endMonth }`，同一等級內不得重疊 |
| 保養分配的區間呈現 | 表格結構不變，每一列依自己的服務等級畫區段（底色＋左右邊框），區段首格上方標「第N次 已完成/負責」 |
| 「已完成 / 負責」的定義 | 分子＝該區間月份內、該指派人員 × 該客戶、已結案保養案件的不重複門市數；分母＝該列現有的「負責門市數」 |
| 客戶的「保養區間」欄位 | 直接移除（職責已被服務等級的保養區間取代） |
| 服務等級 A 的次數 | 由一年一次改為一年四次，名稱同步改為「A 保修(一年四次)」 |
| 服務等級的識別 | 記錄有 `id`，但客戶／門市／案件仍存 `name` 字串。改名時需連帶同步既有資料 |
| 刪除保護 | 已有客戶或門市使用該等級時擋下並跳 toast |

## 資料模型

### 服務等級記錄

`src/data/seed.js` 新增 `INITIAL_SERVICE_LEVELS`：

```js
{
  id: 'SL001',
  name: 'A 保修(一年四次)',
  maintenanceCount: 4,
  countsBonusPoints: false,
  periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 3 },
    { visitIndex: 2, startMonth: 4, endMonth: 6 },
    { visitIndex: 3, startMonth: 7, endMonth: 9 },
    { visitIndex: 4, startMonth: 10, endMonth: 12 }
  ]
}
```

預設四筆：

| id | 名稱 | maintenanceCount | countsBonusPoints | periods |
|---|---|---|---|---|
| SL001 | A 保修(一年四次) | 4 | false | 1-3 / 4-6 / 7-9 / 10-12 月 |
| SL002 | B 保修(一年兩次) | 2 | false | 1-6 / 7-12 月 |
| SL003 | C 保養(一年一次) | 1 | true | 1-12 月 |
| SL004 | D 維修(無簽約客戶) | 0 | true | （空陣列） |

`countsBonusPoints` 的 `true`／`false` 對應現行 `isServiceLevelCD` 的結果，故預設資料下所有既有績效數字不變。

### seed 字串更新

`A 保修(一年一次)` 全面改為 `A 保修(一年四次)`，涵蓋 `src/data/seed.js` 的客戶、門市、叫修案件、保養案件、排程資料，以及 `scripts/verify-equipment-level-points.mjs`、`scripts/verify-equipment-level-ui.mjs`、`scripts/verify-case-review-bonus-points.mjs` 的 fixture。

### 移除的常數

`src/data/options.js`：

- `SERVICE_LEVEL_OPTIONS` — 改為空陣列，由 `syncServiceLevelOptions()` 於啟動與每次異動時填入。保留常數本身，因為 `customer-form.js` 與 `data-retrieval.js` 直接引用它。
- `CUSTOMER_SERVICE_LEVEL_MAP` — 刪除，改為從 customers 陣列查詢。
- `MAINTENANCE_INTERVAL_OPTIONS` — 刪除。

## service-level-utils.js

新檔 `src/features/permissions/service-level-utils.js`，export 於 `window.ServiceLevelUtils`。

| 函式 | 行為 |
|---|---|
| `normalizeRecord(record)` | 回傳 `{ name, maintenanceCount, countsBonusPoints, periods }`；name 去頭尾空白、maintenanceCount 轉數字、periods 依 visitIndex 排序 |
| `findByName(serviceLevels, name)` | 以去空白後的名稱精確比對，查無回 `null` |
| `getMaintenanceCount(serviceLevels, name)` | 查無回 `0` |
| `countsBonusPoints(serviceLevels, name)` | 查無回 `false` |
| `getPeriods(serviceLevels, name)` | 查無回 `[]`；回傳依 `visitIndex` 排序的陣列 |
| `findPeriodForMonth(serviceLevels, name, month)` | 回傳 `startMonth <= month <= endMonth` 的區間，查無回 `null` |
| `isAllocatable(serviceLevels, name)` | `getMaintenanceCount(...) > 0` |
| `validate(record, serviceLevels, excludeId)` | 回傳錯誤訊息字串陣列，空陣列代表通過。見下 |
| `isServiceLevelInUse(name, customers, stores)` | 任一 customer 或 store 的 `serviceLevel` 相符即 `true` |
| `syncServiceLevelOptions(serviceLevels)` | 就地改寫 `SERVICE_LEVEL_OPTIONS` 陣列內容為各筆 name（比照 `syncDeviceCategoryOptions` 對 `EQUIP_*` 的作法，不可整個重新指派，因為其他模組持有同一參考） |
| `renameServiceLevel(oldName, newName, collections)` | 就地把 customers／stores／cases／maintenanceCases 中 `serviceLevel === oldName` 的改為 `newName`，回傳更新後的四個陣列 |
| `formatPeriodsLabel(record)` | 列表顯示用，例：`第1次 1-3月、第2次 4-6月`；無區間回 `—` |

### `validate` 規則

1. 名稱必填。
2. 名稱不得與其他筆重複（排除 `excludeId`）。
3. 每年保養次數為 0 或正整數。
4. 區間筆數必須等於每年保養次數。
5. 每個區間的起始月與結束月皆為 1–12 的整數，且起始月 ≤ 結束月。
6. 同一等級的任兩區間不得重疊。

## service-level-list.js

新檔 `src/features/permissions/service-level-list.js`，比照 `device-category-list.js` 的版型（關鍵字搜尋列＋右上圓形新增鈕＋可拖曳橫捲表格＋`IESS.createListPagination()`＋刪除確認 Modal）。

props：`{ serviceLevels, setServiceLevels, customers, stores, setEditingCase, setView, showToast }`

欄位：

| 欄 | 內容 |
|---|---|
| 操作 | 編輯／刪除 icon 鈕 |
| 服務等級名稱 | `name` |
| 每年保養次數 | `maintenanceCount` |
| 是否計算增額積分 | `是` / `否` |
| 保養區間 | `formatPeriodsLabel(record)` |

關鍵字比對名稱欄。刪除時先呼叫 `isServiceLevelInUse`，為 `true` 則 `showToast('此服務等級已被客戶或門市使用，無法刪除', 'error')` 並關閉 Modal。

## service-level-form.js

新檔 `src/features/permissions/service-level-form.js`，比照 `device-category-form.js`。

欄位：

- **服務等級名稱** — text，必填。
- **每年保養次數** — number，`min=0`。變更時自動增減下方區間列：增加時補上 `{ visitIndex: n, startMonth: '', endMonth: '' }`，減少時砍掉尾端多的列，已填的前段保留。
- **是否計算增額積分** — select，`是` / `否`。
- **保養區間** — 依次數渲染 N 列，每列為唯讀的「第 N 次」加上起始月、結束月兩個 select（1–12 月）。次數為 0 時整區隱藏並顯示「此服務等級不納入保養分配」。

儲存時跑 `validate`，有錯誤則 `showToast(errors[0], 'error')` 且不關閉表單。

編輯模式下若名稱有變動，儲存時額外呼叫 `renameServiceLevel` 同步既有資料，並在成功 toast 中註明已同步的筆數。

## 增額積分邏輯

`src/features/reports/performance-utils.js`：

- 刪除 `isServiceLevelCD`，並自 export 移除。
- `isBonusEligible(c, deviceCategories, serviceLevels)` 改為：

  ```js
  return ServiceLevelUtils.countsBonusPoints(serviceLevels, c && c.serviceLevel)
    || isAddOnEquipmentCase(c, deviceCategories);
  ```

- 內部呼叫點 [performance-utils.js:136](../../../src/features/reports/performance-utils.js#L136) 一併補傳 `serviceLevels`，其外層函式亦需自 props 取得並往下傳。

`src/features/repair/case-review.js`：

- `resolveReviewCaseBonusPoints(c, deviceCategories, serviceLevels)` 補傳參數。
- 檔頭註解由「C/D 服務等級的叫修案件」改述為「服務等級設定為計算增額積分的叫修案件」。
- props 增加 `serviceLevels`。

`serviceLevels` 一律由 app store 經 props 傳入，不從全域直接讀取，與 `deviceCategories` 現行作法一致。

## 保養分配

### maintenance-allocation-utils.js

- 刪除 `ALLOCATABLE_SERVICE_LEVELS` 與 `getVisitIndexOptions`，自 export 移除。
- `isAllocatableServiceLevel(level, serviceLevels)` 改為 `ServiceLevelUtils.isAllocatable(serviceLevels, level)`。
- `getCoveredStoresForAssignee` 與 `getCustomerRows` 補收 `serviceLevels`。
- `getCustomerRows` 回傳的每列改為 `{ customerName, storeCount, serviceLevel }`，不再回 `maintenanceInterval`。`serviceLevel` 取自該客戶的 `customer.serviceLevel`。
- 新增 `countCompletedStores(maintenanceCases, assignee, customerName, period, year)`：篩選 `assignee` 相符、`customerName` 相符、`isClosed` 為 `true`、且 `completionDate`（無則 `planDate`）的月份落在 `period` 月份範圍內的保養案件，回傳不重複 `storeName` 的數量。年份取當年。

### maintenance-allocation.js

- 列首 badge 由 `row.maintenanceInterval` 改為 `row.serviceLevel`。
- 月份儲存格依該列服務等級的區間上色：同一區間的連續月份共用淡底色，區間首欄加左邊框、末欄加右邊框，相鄰區間交替兩種底色以利辨識。不屬於任何區間的月份維持白底。
- 區間首欄的儲存格上方加一行小字：`第N次 已完成/負責`，例 `第1次 3/8`。
- `openEditModal(row, month)` 先以 `findPeriodForMonth` 取區間；為 `null` 則不開 Modal，改 `showToast('此月份不在該服務等級的保養區間內', 'error')`。
- 編輯 Modal 的「保養次數」下拉改為唯讀顯示 `第 N 次（x-y月）`。`visitIndex` 由區間決定，不再由使用者選擇。
- Modal 需要 `maintenanceCases` 才能算完成數，props 增加 `maintenanceCases`、`serviceLevels`。

## 客戶端接線

### 服務等級下拉

`syncServiceLevelOptions(serviceLevels)` 在 app 初始化時呼叫一次，並在 `setServiceLevels` 的 setter 內再次呼叫（比照 [app.js:194-196](../../../src/app.js#L194-L196) 的 `setDeviceCategories`）。`customer-form.js` 與 `data-retrieval.js` 引用 `SERVICE_LEVEL_OPTIONS` 的部分不需改動。

`customer-form.js` 的預設值 `'A 保修(一年一次)'`（[customer-form.js:23](../../../src/features/customer/customer-form.js#L23)）改為 `SERVICE_LEVEL_OPTIONS[0] || ''`。

### 客戶名稱 → 服務等級

`CUSTOMER_SERVICE_LEVEL_MAP` 刪除，`src/features/customer/customer-utils.js` 新增：

```js
function getServiceLevelByCustomerName(customers, name) { … }  // 查無回 ''
```

改寫 5 處呼叫點，皆需確保該處已能取得 `customers`：

| 檔案 | 行 | 現況 |
|---|---|---|
| [case-form.js](../../../src/features/repair/case-form.js#L98) | 98 | `CUSTOMER_SERVICE_LEVEL_MAP[value] \|\| 'D 維修(無簽約客戶)'` |
| [case-form.js](../../../src/features/repair/case-form.js#L385) | 385 | 同上 |
| [project-form.js](../../../src/features/project/project-form.js#L304) | 304 | 同上 |
| [project-form.js](../../../src/features/project/project-form.js#L645) | 645 | 同上 |
| [case-arrangement.js](../../../src/features/scheduling/case-arrangement.js#L438) | 438 | `CUSTOMER_SERVICE_LEVEL_MAP[value] \|\| formData.serviceLevel` |

fallback 一律改為「查無則留空」，不再硬塞 `D 維修(無簽約客戶)`；`case-arrangement.js` 維持「查無則保留原值」的既有行為。

### 移除客戶的保養區間

- `customer-form.js` 移除「保養區間」select 與 `maintenanceInterval` 欄位。
- `seed.js` 的 customers 移除 `maintenanceInterval`。
- `options.js` 移除 `MAINTENANCE_INTERVAL_OPTIONS`。

### 選單與路由

| 檔案 | 變更 |
|---|---|
| `src/data/options.js` | `PERMISSION_PAGES` 與 `PERMISSION_TREE` 的「系統權限」children 加入 `'服務等級管理'`（置於「設備分類管理」之後） |
| `src/shell/permissions-sidebar.js` | 選單項目加入 `'服務等級管理'` |
| `src/app.js` | 選單映射加 `'服務等級管理': 'service-level-list'`；store 加 `serviceLevels: INITIAL_SERVICE_LEVELS` 與會同步選項的 `setServiceLevels`；view 路由加 `service-level-list` / `service-level-add` / `service-level-edit` |
| `index.html` | 依序加入三支新 script（utils 需在 list／form 之前，且在 `performance-utils.js` 之前） |

## 驗證

新增 `scripts/verify-service-level-management.mjs`，沿用現有 headless Chrome + CDP 腳本形式（見 `verify-case-review-bonus-points.mjs`）。涵蓋：

1. 列表渲染四筆預設資料，欄位與 `formatPeriodsLabel` 內容正確。
2. 新增一筆服務等級後出現在列表，且客戶表單的服務等級下拉多出該選項。
3. `validate` 擋關：名稱空白、名稱重複、區間數與次數不符、起訖月顛倒、區間重疊。
4. 刪除保護：刪除使用中的等級被擋下並跳 toast；刪除未使用的等級成功。
5. 改名後 customers／stores／cases／maintenanceCases 的 `serviceLevel` 同步更新。
6. `isBonusEligible`：勾選「計算增額積分」的等級一律計分；未勾選者僅在設備為增額設備時計分；查無等級時為 false。
7. 保養分配：`isAllocatable` 過濾正確（D 不入列）、區段分組的月份範圍正確、「已完成/負責」數字正確、點擊區間外月份不開 Modal。

回歸：重跑 `verify-equipment-level-points.mjs`、`verify-equipment-level-ui.mjs`、`verify-case-review-bonus-points.mjs`、`verify-case-record-points.mjs`、`verify-case-return.mjs`、`verify-equipment-level-surfaces.mjs`、`verify-repair-multi-assignee.mjs`，確認名稱字串更新後行為未變。

## 已知限制

- 客戶／門市／案件存的是服務等級**名稱字串**而非 id。改名靠 `renameServiceLevel` 同步，若同步遺漏某個集合，該集合的資料會對不上任何服務等級，其增額積分視為 `false`、且不納入保養分配。新增資料集合時須一併納入同步範圍。
- 保養分配的「已完成」數以當年為範圍，跨年度的歷史完成數不予顯示。
- 保養區間以「月」為最小單位，無法表達跨年度區間（例如 11 月至隔年 2 月）。
