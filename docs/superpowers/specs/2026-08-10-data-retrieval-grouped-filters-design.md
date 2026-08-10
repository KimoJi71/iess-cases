# 資料調閱：層級篩選依上層分組

日期：2026-08-10

## 問題

資料調閱的篩選區塊有兩處「先選 A 再選 B」的層級關係，下層選單目前都把名稱去重後平鋪：

| 分頁 | 層級 | 現況 |
| --- | --- | --- |
| 維修 | 客戶 → 門市 | 取所有已選客戶的門市名稱聯集去重 |
| 保養 | 縣市 → 行政區 | 取所有已選縣市的行政區聯集去重 |

平鋪帶來兩個問題：

1. **看不出歸屬**：選了三個客戶後，門市清單是一長串名稱，無從得知哪家門市屬於哪個客戶。
2. **同名混淆**：跨客戶同名門市確實存在（種子資料中 `中山店`、`站前店` 同時屬於星巴克、全家便利商店、統一超商），行政區同樣有跨縣市同名（`中正區` 見於台北市、基隆市、台中市）。目前勾選 `中山店` 會同時撈到三家客戶的中山店，且介面上沒有任何提示。

工程分頁沒有門市或行政區篩選，不在此範圍內。

## 目標

門市選單依客戶分組、行政區選單依縣市分組，並讓勾選的語意精確到「客戶 + 門市」與「縣市 + 行政區」配對。

```
屈臣氏
  大安忠孝店
  台中旗艦店
  台北信義店
星巴克
  中山店
  北屯崇德店
  站前店
```

## 決策

- **同名項目各自獨立**：星巴克/中山店 與 全家便利商店/中山店 是兩個獨立選項，勾選其一不影響另一個。篩選改為比對配對值。
- **未選上層時照樣列出全部**：客戶未選時列出所有客戶的門市群組，縣市未選時列出所有縣市的行政區群組。維持現有「不先選客戶也能直接找門市」的能力，不停用欄位。

  註：行政區在現況中，未選縣市時是空清單；本次改為列出全部縣市的群組，是刻意的行為擴充，與門市的規則一致。
- **撤店門市不加標記**：仍列出，群組內排在營業中門市之後，不加「（已撤店）」等文字，維持現有呈現。

## 設計

### 1. `src/core/multi-select.js` — 新增分組選項能力

`options` 接受兩種形態，現有以字串陣列呼叫的所有呼叫端不需要改動：

```js
// 形態 A（現有）：扁平字串
options: ['維修', '保養']

// 形態 B（新增）：群組
options: [
  {
    group: '屈臣氏',
    options: [
      { value: '屈臣氏\u0001大安忠孝店', label: '大安忠孝店', chipLabel: '屈臣氏 · 大安忠孝店' }
    ]
  }
]
```

判定方式：`options[0]` 是物件且具有 `options` 屬性時視為形態 B。

- `value` prop 仍是 `string[]`，內容為 option 的 `value`。
- 選單多渲染一層不可點的群組標題 `li.multi-select__group`，樣式加在 `styles.css`。
- 收合時欄位內的 chip 文字取 `chipLabel`（未提供時退回 `label`，再退回 `value`）。元件內部由 options 建立 `value → chipLabel` 對照表；對照不到時直接顯示 `value` 原文，避免資料變動後 chip 變空白。
- 群組內無任何 option 時不渲染該群組標題。所有群組皆為空時，沿用現有的「無可選項目」提示。
- 現有的 portal 定位、`closeAll`、鍵盤操作等行為完全不變。

### 2. `src/features/reports/data-retrieval-utils.js` — 改用複合鍵

複合鍵以 `\u0001` 連接，該字元不會出現在客戶、門市、縣市、行政區名稱中。

- 新增 `makeKey(parent, child)` 與 `parseKey(key)`，並匯出供驗證腳本使用。
- `getStoreOptionsForCustomers` → `getStoreGroupsForCustomers(stores, customerNames)`
  - 回傳 `[{ group: 客戶名稱, options: [{ value, label, chipLabel }] }]`。
  - `customerNames` 為空時，涵蓋所有出現在 `stores` 裡的客戶。
  - 群組依客戶名稱 `localeCompare(zh-Hant)` 排序。
  - 群組內：營業中門市在前、撤店門市在後，各自再依 `localeCompare(zh-Hant)` 排序。營運狀態沿用 `StoreUtils.isActiveStore`。因為選項現在是客戶+門市配對，每筆的營運狀態可直接由該筆 store 判定，不需要現行跨客戶合併時的 `activeByName` 推測邏輯。
  - 同一客戶下若有多筆同名門市紀錄，仍去重成一個選項；其中任一筆為營業中即視為營業中。
- `getDistrictOptionsForCities` → `getDistrictGroupsForCities(cityNames)`
  - 回傳同樣的群組結構，`value = 縣市\u0001行政區`，`chipLabel = 縣市 · 行政區`。
  - `cityNames` 為空時，涵蓋 `TAIWAN_CITY_OPTIONS` 的所有縣市。
  - 群組順序沿用 `TAIWAN_CITY_OPTIONS` 的既有順序；群組內行政區沿用 `StoreUtils.getDistrictsForCity` 的既有順序。
- `filterRepairCases`：`filters.store` 改為比對 `makeKey(c.customerName, c.storeName)`。
- `filterMaintenanceCases`：`filters.district` 改為比對 `makeKey(loc.city, loc.district)`，其中 `loc` 來自現有的 `resolveMaintenanceLocation`。
- 兩者皆維持「空陣列 = 全部，不篩選」的既有語意。
- `filters.city` 的比對邏輯不變（縣市本身沒有上層）。

### 3. `src/features/reports/data-retrieval.js` — 換 options 來源

- 維修分頁門市欄位改吃 `getStoreGroupsForCustomers` 的結果，保養分頁行政區欄位改吃 `getDistrictGroupsForCities` 的結果。
- 客戶變更時清空 `filterStore`、縣市變更時清空 `filterDistrict` 的現行行為保留不動。
- 切換案件類型時全部清空的行為不變。

## 測試

- `scripts/verify-data-retrieval-multi-filter.mjs`（邏輯層，node:vm）新增：
  - `getStoreGroupsForCustomers` 回傳的群組數與群組順序，未選客戶時涵蓋所有客戶。
  - 群組內營業中門市排在撤店門市之前。
  - 跨客戶同名門市互不汙染：`filters.store = ['星巴克\u0001中山店']` 不得撈到全家便利商店的中山店。
  - `getDistrictGroupsForCities` 未選縣市時涵蓋所有縣市，且跨縣市同名行政區互不汙染。
  - 空陣列仍代表不篩選。
- `scripts/verify-data-retrieval-multi-filter-ui.mjs`（真實 DOM）新增：
  - 展開門市選單後出現群組標題，且標題不可點選。
  - 勾選後 chip 顯示「客戶 · 門市」。

## 不做的事

- 不變更工程分頁的任何篩選。
- 不對撤店門市加視覺標記。
- 不改動 `StoreUtils` 既有的 `getStoreNameOptions` 等 API，其他頁面的門市選單不在此範圍。
