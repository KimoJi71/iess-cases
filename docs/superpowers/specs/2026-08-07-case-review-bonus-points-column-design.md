# 案件銷案審核列表新增「總積分」欄位

日期：2026-08-07

## 目標

在「案件銷案審核」列表加入「總積分」欄，讓審核者在列入績效前就看到該案件會帶進多少增額積分。非增額任務留空。

## 現況

判定與計算的邏輯都已存在，缺的只有顯示：

- `PerformanceUtils.isBonusEligible(c, deviceCategories)`（`performance-utils.js:65`）—— C/D 服務等級一律符合；A/B 僅在設備為增額設備時符合。與需求描述的「增額任務」定義一致。
- `PerformanceUtils.sumProcessPoints(c)`（`performance-utils.js:104`）—— 整案 `Σ(積分 × 數量)`。
- 績效統計（`computeAssigneePerformance`）的增額積分只累加**叫修案件**，保養案件完全不進增額積分。

`CaseReviewList` 目前未取得 `deviceCategories`（`src/app.js:345`），判定增額設備需要補這個 prop。

## 判定規則

顯示值 `resolveReviewCaseBonusPoints(c, deviceCategories)`：

1. `c.sourceType === 'maintenance'` → 回傳 `null`（留空）
2. `!PerformanceUtils.isBonusEligible(c, deviceCategories)` → 回傳 `null`（留空）
3. 否則回傳 `PerformanceUtils.sumProcessPoints(c)`

保養案件一律留空，與績效計算的口徑一致 —— 若此處顯示分數，會與報表對不起來。

顯示的是**整案**總積分，不是分攤到個別人員的值（`CaseAssigneeUtils.computeBonusPointsForAssignee` 不在此處使用）。列表一列代表一件案件，整案總額才是審核者要看的數字。

## 積分來源

此列表的案件都已結案（篩選條件含 `c.isClosed`），`processRecords[].points` 為結案時的快照值，`sumProcessPoints` 取用的正是這個值 —— 與績效計算同源，不會出現列表與報表不一致的情況。

## 變更

### 1. `src/features/repair/case-review.js`

- 新增區域函式 `resolveReviewCaseBonusPoints(c, deviceCategories)`，規則如上。
- 元件讀取 `props.deviceCategories || []`。
- 在「服務等級」與「工項分類」之間插入 `th`「總積分」與對應 `td`。位置緊鄰判定依據的服務等級，方便對照。
- 儲存格內容：`null` → 空字串；數字 → `String(points)`，總和為 `0` 時顯示 `0`（非 `—`），以區別「不是增額任務」與「是增額任務但零分」。
- 空資料列 `colspan` 由 `12` 改為 `13`。

### 2. `src/app.js:345`

`CaseReviewList` 加上 `deviceCategories: s.deviceCategories`。

## 不變更

- 案件存檔結構，不新增欄位。
- 績效計算（`performance-utils.js`）、`buildPerformanceSnapshot`。
- 退回案件、列入績效的既有行為。
- 其他列表（案件處理、保養計劃進度）不加此欄。

## 驗證

無測試框架，以 headless browser 腳本驗證（沿用 `scripts/` 既有模式，新增 `scripts/verify-case-review-bonus-points.mjs`）：

1. 銷案審核列表表頭出現「總積分」，位於「服務等級」與「工項分類」之間
2. C 或 D 級客戶的叫修案件 → 顯示 `sumProcessPoints` 的值
3. A 或 B 級客戶、設備為增額設備的叫修案件 → 顯示數值
4. A 或 B 級客戶、設備為基礎設備的叫修案件 → 儲存格為空
5. 保養計劃案件（含服務等級為 C/D 者）→ 儲存格為空
6. 增額任務但處理方式積分合計為 0 → 顯示 `0` 而非空白
7. 無資料時空列橫跨全部 13 欄

驗證資料以既有種子資料為準，若涵蓋不到上述組合則在腳本內就地建構案件物件呼叫 `resolveReviewCaseBonusPoints`，避免依賴當日日期。

## 範圍外

- 依總積分排序或篩選
- 積分明細的 tooltip／展開
- 人員分攤積分的顯示（協作者拆分）
- 在其他案件列表加同樣欄位
