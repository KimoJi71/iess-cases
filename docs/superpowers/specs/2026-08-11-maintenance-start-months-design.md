# 開始保養時間（於開幕 N 個月後開始保養）

日期：2026-08-11

## 目的

新開幕的門市通常有一段「新機保固／不需保養」的觀察期。目前保養計劃只要門市是「正常營業」
且客戶有設定保養區間，就會在每個區間開出保養單，剛開幕的門市也不例外。

本功能讓客戶可以設定「開幕 N 個月後才開始保養」，未滿期的門市不產生保養單、也不出現在
保養計劃進度列表。

## 資料模型

客戶物件（`INITIAL_CUSTOMERS` 及客戶表單存檔結果）新增欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `maintenanceStartMonths` | number \| `''` | 於開幕幾個月後開始保養。空字串代表未設定，讀取端一律當 0。 |

門市端沿用既有的 `openDate`（開幕日期），不新增欄位。

## 判斷規則

以**月**為粒度，與保養區間同單位（區間本來就只有月份、不含日）。

```
起始保養月 = 門市 openDate 的年月 + maintenanceStartMonths 個月
```

例：`openDate = 2024-03-15`、`maintenanceStartMonths = 6` → 起始保養月為 `2024-09`，
2024-09 整月都算已達標（不比較日）。

某門市在某個「參考月份」是否已可保養：

```
參考月 >= 起始保養月
```

邊界行為：

- `maintenanceStartMonths` 為空字串、`null`、`undefined`、非數字 → 視為 0（開幕即可保養）。
- `maintenanceStartMonths` 為負數或非整數 → 讀取端夾成 `Math.max(0, Math.floor(n))`。
- 門市沒有 `openDate` → 視為尚未達標，不產生也不顯示。門市表單將 `openDate` 改為必填，
  現有假資料每筆門市皆有 `openDate`，不受影響。

## 共用函式（`src/features/customer/customer-utils.js`）

客戶欄位的解讀本來就集中在此檔，判斷函式一併放這裡，讓產生端與列表端共用同一份規則、
不會兩邊算法漂移。對外新增：

- `getMaintenanceStartMonths(customers, customerName)` → number（預設 0）
- `getMaintenanceStartMonth(customers, store)` → `'YYYY-MM'`，無 `openDate` 時回 `''`
- `isMaintenanceStartedForMonth(customers, store, referenceMonth)` → boolean，
  `referenceMonth` 為 `'YYYY-MM'`。無 `openDate` 或參考月無效時回 `false`。

## 客戶管理表單（`src/features/customer/customer-form.js`）

基本資料區、緊接「服務等級」之後新增一格：

```
開始保養時間
[ 6 ]  於開幕 N 個月後開始保養
```

- `type="number"`、`min="0"`、`step="1"`，非必填。
- 輸入框右側（或下方）以小字顯示說明文字「於開幕 N 個月後開始保養」。
- 存檔時正規化：空字串存 `''`，否則存 `Math.max(0, Math.floor(Number(v)))`。
  夾值不跳警告 — 此欄位沒有語意模糊空間，直接夾值比提醒乾淨。

客戶列表**不加**這一欄（列表欄位已多，YAGNI）。

## 保養計劃過濾

兩處都擋，畫面與資料一致。

### 產生端 — `src/features/scheduling/schedule-utils.js` `generateDueMaintenanceCases`

在 store 迴圈中、`findPeriodForMonth` 之前加一道判斷：以 `refMonth`（`'YYYY-MM'`）為
參考月，`isMaintenanceStartedForMonth` 為 false 就 `return`（該門市這輪不開單）。

### 列表端 — `src/features/repair/maintenance.js` `MaintenanceList`

`filteredCases` 加一條過濾：取該案件所屬區間的起始年月當參考月，早於起始保養月就不顯示。

參考月取得順序：
1. `ScheduleUtils.resolveCasePeriod(c, customers)` → `periodYear` + `startMonth`
2. 解析不到區間時退回 `ScheduleUtils.resolveMaintenanceReferenceDate(c)`（`planDate`
   或 `dueMonth`）的年月
3. 兩者皆無 → 不套用此過濾（維持現行顯示，避免資料不全的案件無聲消失）

門市查找沿用 `ScheduleUtils.resolveStore(stores, c.customerName, c.storeName)`；
查無門市時不套用此過濾。

### 不受影響的畫面

只擋「保養計劃進度」列表。**案件排程待辦、案件銷案審核、叫修案件紀錄不動** —
已排程或已結案的保養單不該因為客戶事後改設定就消失。

## 門市表單（`src/features/customer/store-form.js`）

`field('開幕日期', 'openDate', { type: 'date' })` 改為
`field('開幕日期', 'openDate', { type: 'date', required: true })`，沿用既有 `required`
機制（label 自動帶紅色 `*`、input 加 `required`）。

## 假資料（`src/data/seed.js`）

幾家客戶補上 `maintenanceStartMonths` 示例值，讓效果在 demo 可見：

- 屈臣氏：`0`（開幕即保養，維持現狀）
- 至少一家客戶設為 `6`，且其底下有一家 `openDate` 在近半年內的門市，
  使該門市在保養計劃中被擋下

## 驗證（`scripts/verify-maintenance-start-months.mjs`）

比照既有 verify 腳本的做法（載入 src 各檔後直接呼叫函式），涵蓋：

1. 起始保養月計算正確（含跨年，例 `2024-10` + 6 → `2025-04`）
2. `maintenanceStartMonths` 空白／非數字／負數 → 視為 0
3. 門市無 `openDate` → `isMaintenanceStartedForMonth` 回 false
4. `generateDueMaintenanceCases` 對未滿期門市不開單、對已滿期門市照常開單
5. 保養計劃列表過濾：未滿期案件不出現、已滿期案件出現
6. 案件解析不到區間且無 `planDate`／`dueMonth` 時不被此規則濾掉

## 文件

README 功能說明補一句，說明保養計劃會依客戶的「開始保養時間」排除未滿期門市。
