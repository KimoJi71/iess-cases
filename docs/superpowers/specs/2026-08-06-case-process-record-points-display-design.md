# 叫修案件處理方式顯示「積分數」

日期：2026-08-06

## 目標

在叫修案件的「處理方式」加入「積分數」顯示。純顯示，值由「處理方式與積分管理」主檔帶入，不新增可編輯欄位、不改變存檔結構。

## 現況

- 處理方式主檔（`INITIAL_PROCESS_METHODS`）每筆都有 `points`。
- 案件加入處理方式時，`ProcessMethodUtils.toCaseProcessRecord()` 已把 `points` 快照寫進 `case.processRecords[]`；種子資料（`seed.js` 的 `caseProcessRecordFromPm`）同樣帶入。
- 績效計算（`performance-utils.js:93`）用的就是這個快照值。
- 三個畫面渲染案件處理方式表格，但都沒有顯示積分：`case-form.js:727`、`case-view.js:109`、`case-arrangement.js:675`。

也就是說，資料早就在了，缺的只有顯示。

## 積分來源規則

主檔積分事後被管理員修改時：

- **未結案案件**（`!case.isClosed`）→ 顯示主檔目前的積分（即時值）
- **已結案案件**（`case.isClosed`）→ 顯示案件內的快照值

實作為單一函式，三個畫面共用：

```js
ProcessMethodUtils.resolveCaseRecordPoints(record, processMethods, isClosed)
```

- `isClosed` 為 true → 回傳 `record.points`
- 否則以 `record.processMethodId` 查 `processMethods`；命中回傳主檔 `points`，未命中（項目已被刪除）退回 `record.points`
- 回傳數字；兩者皆無值時回傳 `null`

## 變更

### 1. `src/features/permissions/process-method-utils.js`

新增 `resolveCaseRecordPoints()`，並掛到 `window.ProcessMethodUtils`。

### 2. 清單表格欄位（三處）

在「規格」與「數量」欄之間插入「積分數」欄。

不擴充 `CASE_DISPLAY_COLUMNS`：該常數代表純分類欄位，三個渲染點的儲存格邏輯都是 `r[col.key] || '—'`，`points` 為 `0` 時會被誤顯示成 `—`；且積分需要 `processMethods` 與 `isClosed` 兩個外部脈絡，不屬於欄位定義。改為各表格顯式加一組 `th` / `td`，並將空資料列的 `colspan` 相應 +1。

儲存格內容：`resolveCaseRecordPoints()` 的結果，`null` 顯示 `—`，`0` 顯示 `0`。

涉及檔案：

- `src/features/repair/case-form.js` — 編輯叫修案件
- `src/features/repair/case-view.js` — 查看案件明細
- `src/features/scheduling/case-arrangement.js` — 排程派工

### 3. 選擇列預覽（僅 `case-form.js`）

在「規格」下拉與「數量」輸入之間，加入唯讀的「積分數」顯示，樣式比照相鄰的「單位」。值取 `selectedPm ? selectedPm.points : '—'` —— 尚未加入案件，本來就沒有快照，直接用主檔即時值。

`case-view.js` 與 `case-arrangement.js` 沒有新增列，不適用。

### 4. 資料串接（`src/app.js`）

`case-view.js` 與 `case-arrangement.js` 目前拿不到處理方式主檔，需補 prop：

- `app.js:339`、`app.js:348`、`app.js:443` — `ViewCaseForm` 加上 `processMethods: s.processMethods`
- `app.js:521` — `CaseArrangement` 加上 `processMethods: s.processMethods`

兩個元件內部對 `props.processMethods` 取用時以 `|| []` 保底。

## 不變更

- `toCaseProcessRecord()` 的 points 快照行為維持不變。
- 案件存檔結構不變，不新增欄位。
- 績效計算維持使用快照值（`performance-utils.js`）。

## 已知取捨

未結案案件的畫面積分（即時值）會與績效預估（快照值）不一致。此為本次刻意接受的取捨：績效改用同一套解析規則超出「只做顯示」的範圍，不在此變更內。

## 驗證

- 未結案案件加入處理方式 → 到「處理方式與積分管理」改該項目積分 → 回案件三個畫面，積分數應顯示新值。
- 已結案案件同樣操作 → 積分數應維持原快照值。
- 主檔項目被刪除後，案件仍顯示快照值而非 `—`。
- 積分為 `0` 的項目顯示 `0`，不是 `—`。
- 空處理方式清單時，表格「尚未加入處理項目」列仍橫跨全部欄位。
