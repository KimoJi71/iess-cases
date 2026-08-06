# 設備等級（基礎／增額）設計

日期：2026-08-06

## 目標

1. 在「設備分類管理」新增「設備等級」欄位，選項為`基礎設備`、`增額設備`。
2. 「客戶建檔-設備管理」選完型號後唯讀顯示該型號的設備等級。
3. 兩個功能的列表都要顯示設備等級。
4. A、B 服務等級客戶的叫修單，若設備為「增額設備」，其處理方式積分也要計入績效。

## 決策

| 議題 | 決定 |
|---|---|
| 客戶設備能否覆寫等級 | 不能。唯讀，依型號即時查設備分類 |
| 設備分類的等級是否必填 | 必填，新增時預設`基礎設備` |
| 舊資料（無此欄位） | seed 補`基礎設備`；讀取時空值一律視為`基礎設備` |
| A/B + 增額設備的積分算法 | 與 C/D 完全相同，不另設倍率或上限 |

## 資料模型

`src/data/options.js` 新增：

```js
const EQUIPMENT_LEVEL_OPTIONS = ['基礎設備', '增額設備'];
```

設備分類記錄新增欄位 `equipmentLevel`（字串，值域為 `EQUIPMENT_LEVEL_OPTIONS`）。

`src/data/seed.js` 的 `INITIAL_DEVICE_CATEGORIES` 每一筆補 `equipmentLevel: '基礎設備'`。

設備記錄（equipments）**不新增欄位**。等級一律由 `eq.model` 反查設備分類取得，因此修改分類設定後，所有引用該型號的設備與歷史案件會自動跟著變動。

## device-category-utils.js

現況陷阱：`normalizeRecord()` 只輸出 `FIELD_KEYS` 七欄，而表單存檔存的是 `normalizeRecord(formData)` 的結果。若只在表單加欄位而不改這裡，`equipmentLevel` 會被靜默丟掉。

變更：

- 新增 `ATTR_KEYS = ['equipmentLevel']`。
- `normalizeRecord()` 輸出 `FIELD_KEYS.concat(ATTR_KEYS)`。
- `recordKey()` **維持只用 `FIELD_KEYS`**。設備等級是屬性而非識別，改等級不得被判定為重複紀錄。
- 新增 `getEquipmentLevel(record)`：回傳 `record.equipmentLevel` 去頭尾空白後的值；空值回傳 `'基礎設備'`。
- 新增 `getEquipmentLevelByModel(deviceCategories, model)`：以 `findRecordByModel` 查記錄後交給 `getEquipmentLevel`；查無記錄或 model 為空時回傳 `'基礎設備'`。
- 兩個新函式與 `ATTR_KEYS` 一併 export。

## 設備分類管理

### 表單 `src/features/permissions/device-category-form.js`

`FIELDS` 目前全數以 text input 渲染。新增 `type` 屬性支援，`type: 'select'` 時渲染 `<select>`，其餘維持 text input。

在「型號」之後插入：

```js
{ name: 'equipmentLevel', label: '設備等級', required: true,
  type: 'select', options: EQUIPMENT_LEVEL_OPTIONS }
```

新增模式下 `formData.equipmentLevel` 初值為 `EQUIPMENT_LEVEL_OPTIONS[0]`（`基礎設備`），不是空字串——避免必填檢查在使用者未動作時就擋下。編輯模式下沿用既有值，空值以 `getEquipmentLevel` 正規化為 `基礎設備`。

必填檢查沿用既有的 `FIELDS.find(field => field.required && !normalized[field.name])`，不需額外邏輯。

### 列表 `src/features/permissions/device-category-list.js`

`COLUMNS` 在 `model` 之後插入 `{ key: 'equipmentLevel', label: '設備等級' }`。

因為關鍵字搜尋掃的就是 `COLUMNS`，設備等級自動成為可搜尋欄位，無需另外處理。搜尋比對的是原始值，因此 `equipmentLevel` 為空的舊資料不會被關鍵字「基礎」命中——由於 seed 已補齊、表單必填，實務上不會出現這種資料，接受此行為。

表格儲存格目前是 `dc[col.key] || '—'`。設備等級改用 `DeviceCategoryUtils.getEquipmentLevel(dc)`，讓舊資料顯示`基礎設備`而非`—`（符合必填語意）。其餘欄位行為不變。

## 客戶建檔-設備管理

### 表單 `src/features/customer/equipment-form.js`

在「型號」下拉之後插入一個 disabled 的唯讀輸入框，沿用檔內既有的 `disabledCls`：

- label：`設備等級`
- value：`formData.model ? DeviceCategoryUtils.getEquipmentLevelByModel(deviceCategories, formData.model) : ''`
- 未選型號時 value 為空字串，placeholder 為`請先選擇型號`

`handleSubmit` 的 payload **不含** `equipmentLevel`。

### 列表 `src/features/customer/equipment-list.js`

- 新增 prop `deviceCategories`（預設 `[]`）。
- 表頭在「型號」之後插入`設備等級`。
- 儲存格以 badge 呈現，沿用檔內既有 `equipmentStatusBadge` 的樣式慣例，新增 `equipmentLevelBadge(level)`：
  - `增額設備` → `bg-amber-100 text-amber-700`
  - `基礎設備` → `bg-gray-100 text-gray-600`
- 空資料列的 `colspan: 12` 改為 `13`。

### `src/app.js`

`equipment-list` 分支的 `EquipmentList` props 補上 `deviceCategories: s.deviceCategories`（目前只有 `EquipmentForm` 兩個分支有傳）。

## 積分規則

現況：`src/features/reports/performance-utils.js` 的 `computeAssigneePerformance` 內唯一閘門為

```js
if (!isServiceLevelCD(c.serviceLevel)) return;
```

新增三個函式並 export：

```js
function getCaseEquipmentLevel(c, deviceCategories) {
  var model = (c && c.equipment && c.equipment.model) || '';
  return DeviceCategoryUtils.getEquipmentLevelByModel(deviceCategories, model);
}

function isAddOnEquipmentCase(c, deviceCategories) {
  return getCaseEquipmentLevel(c, deviceCategories) === '增額設備';
}

function isBonusEligible(c, deviceCategories) {
  return isServiceLevelCD(c.serviceLevel) || isAddOnEquipmentCase(c, deviceCategories);
}
```

閘門改為 `if (!isBonusEligible(c, deviceCategories)) return;`。

寫成「C/D 或 增額設備」而非「C/D 或 (A/B 且增額)」：對 A/B 案件結果相同（C/D 本來就全計），少一個分支，也順帶涵蓋服務等級為空的案件。

`isServiceLevelCD` 維持原樣不動（已對外 export）。

積分計算公式完全不動——`CaseAssigneeUtils.computeBonusPointsForAssignee` 的「(總分 − 協作分) ÷ 正式指派人數 + 自己的協作分」照舊。本次僅放寬「哪些案件納入計算」。

其餘既有條件（`isPerformanceIncluded`、季度日期範圍）不變。

### 資料串接

- `computeAssigneePerformance(input)` 讀取 `input.deviceCategories || []`。
- `src/features/reports/case-performance-stats.js` 讀 `props.deviceCategories` 並傳入 `computeAssigneePerformance`。
- `src/app.js` 的 `CasePerformanceStats` props 補 `deviceCategories: s.deviceCategories`。

`computeRegionPerformance` 不受影響（只統計保養案件件數，不含積分）。

## 驗證

新增 `scripts/verify-equipment-level-points.mjs`，比照 `scripts/verify-case-record-points.mjs` 的 vm sandbox 手法，依序載入 `device-category-utils.js`、`case-assignee-utils.js`、`performance-utils.js` 到同一個 sandbox。

`device-category-utils.js` 在 sandbox 需要的全域 stub：`EQUIP_MODEL_CATALOG`、`EQUIP_MODEL_OPTIONS`、`EQUIP_CATEGORY_OPTIONS`、`EQUIP_BRAND_OPTIONS`、`EQUIP_NAME_OPTIONS`、`EQUIP_STATUS_OPTIONS`。`performance-utils.js` 需要 `StoreUtils`、`AssigneeUtils` 的最小 stub（僅 `computeRegionPerformance` 用到，測試不觸及）。

測試案例：

| 案例 | 預期 |
|---|---|
| A 保修 + 基礎設備 | 0 分 |
| A 保修 + 增額設備 | 計入全額 |
| B 保修 + 增額設備 | 計入全額 |
| C 保養 + 基礎設備 | 計入（回歸） |
| D 維修 + 基礎設備 | 計入（回歸） |
| A 保修 + 型號查無對應分類 | 視為基礎設備，0 分 |
| A 保修 + 案件無 `equipment` | 視為基礎設備，0 分 |
| A 保修 + 分類 `equipmentLevel` 為空字串 | 視為基礎設備，0 分 |
| A 保修 + 增額 + 多人指派含協作 | 分攤結果與同條件 C/D 案件相同 |
| `isPerformanceIncluded` 為 false + A/增額 | 0 分（既有條件優先） |
| 季度範圍外 + A/增額 | 0 分（既有條件優先） |

另補 `device-category-utils` 測試：

| 案例 | 預期 |
|---|---|
| `normalizeRecord` 帶 `equipmentLevel` | 輸出保留該欄位 |
| `recordKey` 對七欄相同、等級不同的兩筆記錄 | key 相同（`findDuplicate` 仍判定重複） |
| `getEquipmentLevel({})` | `'基礎設備'` |
| `getEquipmentLevelByModel(cats, '不存在')` | `'基礎設備'` |

腳本以 `node scripts/verify-equipment-level-points.mjs` 執行，全數通過才算完成。

## 已知問題（本輪未修）

**編輯共用型號的設備時，品牌會被默默改掉。**

`DeviceCategoryUtils.findBestMatchingRecord` 在有型號時會先呼叫 `findRecordByModel`
「取第一筆符合型號的紀錄」就短路回傳，根本走不到它自己下面的加權評分。
`resolveProjectEquip` 靠它帶入「編輯設備」表單的資料。

因此當同一個型號存在於多筆設備分類（品牌或規格不同，七欄組合不重複所以合法），
點開編輯會把設備的品牌改成第一筆的品牌，設備等級跟著錯，存檔就寫入錯的品牌。
新增的分類是插在陣列最前面，所以「最新那筆」會贏。

此行為早於本次異動，但設備等級功能讓它變得看得見也有後果。
列表顯示與積分計算不受影響——它們走的是本次新增的
`getEquipmentLevelByEquip`（五欄完整比對），不是 `findBestMatchingRecord`。

修法：拿掉 `findBestMatchingRecord` 開頭的型號短路，讓它走既有的加權評分
（型號 8 分、分類 4 分、品牌 2 分、設備名稱 2 分、規格 1 分），完整符合的那筆
自然勝出；只有型號的資料行為不變，仍以 8 分跨過 `>= 4` 的門檻。

`scripts/verify-equipment-level-ui.mjs` 有一行 `KNOWN ISSUE` 標記這個情境。

## 不在範圍內

- 叫修單表單／檢視頁不顯示設備等級（使用者未要求；`RepairCaseEquipment.FIELD_DEFS` 不動）。
- 工程立案的設備區塊不動。
- 設備等級不參與設備分類的重複性判定。
- 不提供依設備等級篩選案件的報表。
