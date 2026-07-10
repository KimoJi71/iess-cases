# 案件日期欄位（叫修／再次叫修／完工）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在「案件處理」編輯視窗與「叫修案件紀錄」明細視窗顯示叫修／再次叫修／完工日期；儲存處理狀態時依規則自動押日期（不清空既有值）。

**Architecture:** 在 `data.js` 新增 `reRepairDate`／`completionDate` 至 seed，並匯出 `applyProcessStatusDates` 共用 helper。「案件處理」儲存編輯時呼叫 helper；兩處 Modal 以唯讀方式顯示三個日期。不做工作排程／新建工程提示。

**Tech Stack:** 原生 HTML / CSS / JS（無框架、無測試框架；以瀏覽器 Console／手動操作驗證）。

**Spec:** `docs/superpowers/specs/2026-07-10-case-date-fields-design.md`

---

## File Structure

| 檔案 | 本次職責／改動 |
|------|------|
| `js/data.js` | 每筆 seed 補 `reRepairDate`、`completionDate`；新增並匯出 `applyProcessStatusDates` |
| `js/modules/maintenance.js` | 編輯 Modal 顯示三日期（唯讀）；新建初始化空日期；儲存時套用 helper |
| `js/modules/case-records.js` | 明細「案件資料」顯示三日期 |
| `css/styles.css` | 預期無需改動（沿用 form／detail 樣式）；僅在顯示異常時微調 |

---

### Task 1: Seed 欄位 + `applyProcessStatusDates` helper

**Files:**
- Modify: `js/data.js`

- [ ] **Step 1: 新增 helper 函式**

在 `createCaseStore` 之前加入：

```js
const RE_REPAIR_STATUSES = ["待料", "待報價", "尚未完成"];

function applyProcessStatusDates(caseData, processStatus, todayStr) {
  if (RE_REPAIR_STATUSES.includes(processStatus)) {
    return { ...caseData, reRepairDate: todayStr };
  }
  if (processStatus === "案件完成") {
    return { ...caseData, completionDate: todayStr };
  }
  // 轉汰換、轉原廠、其他：不寫入日期
  return caseData;
}
```

並在 `return { ... }` 匯出 `applyProcessStatusDates`。

- [ ] **Step 2: 為每筆 SEED_CASES 補上日期欄位**

規則（對齊 spec §5）：

| processStatus | reRepairDate | completionDate |
|---------------|--------------|----------------|
| 待料／待報價／尚未完成 | 有值（可用 `repairDate` 或翌日） | `""` |
| 案件完成 | 可有可無（至少一筆有值示範保留） | 有值（可用 `repairDate`） |
| 轉汰換／轉原廠 | `""` | `""` |

具體建議值（依現有 id）：

```
20260708001 待料     → reRepairDate: "2026-07-08", completionDate: ""
20260708002 待報價   → reRepairDate: "2026-07-08", completionDate: ""
20260708003 案件完成 → reRepairDate: "2026-07-06", completionDate: "2026-07-08"
20260708004 轉汰換   → reRepairDate: "", completionDate: ""
20260708005 轉原廠   → reRepairDate: "", completionDate: ""
20260707001 尚未完成 → reRepairDate: "2026-07-07", completionDate: ""
（其餘待料／待報價／尚未完成同模式；其餘案件完成給 completionDate）
20260710001 尚未完成 → reRepairDate: "2026-07-10", completionDate: ""
20260710002 案件完成 → reRepairDate: "", completionDate: "2026-07-10"
20260710003 案件完成 → reRepairDate: "2026-07-09", completionDate: "2026-07-10"
20260710004 待報價   → reRepairDate: "2026-07-10", completionDate: ""
```

欄位插入位置：建議放在 `repairDate` 之後，方便閱讀。例如：

```js
repairDate: "2026-07-08",
reRepairDate: "2026-07-08",
completionDate: "",
```

> 注意：請對照 `js/data.js` 實際 id／狀態逐筆補齊，勿漏任何一筆。

- [ ] **Step 3: 瀏覽器 Console 驗證 helper**

用瀏覽器開啟 `index.html`，在 Console 執行：

```js
const base = { reRepairDate: "2026-07-01", completionDate: "2026-07-02" };
console.log(AppData.applyProcessStatusDates(base, "待料", "2026-07-10"));
// → reRepairDate: "2026-07-10", completionDate: "2026-07-02"（不清空）

console.log(AppData.applyProcessStatusDates(base, "案件完成", "2026-07-10"));
// → reRepairDate: "2026-07-01", completionDate: "2026-07-10"

console.log(AppData.applyProcessStatusDates(base, "轉汰換", "2026-07-10"));
// → 兩日期皆維持原值

console.log(AppData.SEED_CASES.every((c) => "reRepairDate" in c && "completionDate" in c));
// → true
```

- [ ] **Step 4: Commit**

```bash
git add js/data.js
git commit -m "Add case date fields to seed and applyProcessStatusDates helper"
```

---

### Task 2: 案件處理 — 顯示日期 + 儲存連動

**Files:**
- Modify: `js/modules/maintenance.js`

- [ ] **Step 1: 編輯／新增表單顯示三個唯讀日期**

在 `renderCaseInfoFields` 的 `.form-grid` 開頭（工項分類之前）插入：

```js
<label>
  <span>叫修日期</span>
  <input type="text" name="repairDate" value="${escapeHtml(values.repairDate || "—")}" readonly />
</label>
<label>
  <span>再次叫修日期</span>
  <input type="text" name="reRepairDate" value="${escapeHtml(values.reRepairDate || "—")}" readonly />
</label>
<label>
  <span>完工日期</span>
  <input type="text" name="completionDate" value="${escapeHtml(values.completionDate || "—")}" readonly />
</label>
```

> 新增案件時 `values` 無這些欄位 → 顯示 `—`。`getCreateFormData` **不要**讀取這三個 input（避免把 `—` 寫進資料）。

- [ ] **Step 2: 新建案件初始化空日期**

在 `saveNewCase` 的 `store.add({...})` 內，於 `repairDate` 之後加入：

```js
reRepairDate: "",
completionDate: "",
```

（新建預設 `processStatus: "尚未完成"`，但尚未儲存處理資訊，故日期先留空；之後編輯儲存才依 helper 押上。）

- [ ] **Step 3: `cloneForEdit` 確保日期欄位存在**

```js
function cloneForEdit(c) {
  return structuredClone({
    ...c,
    reRepairDate: c.reRepairDate || "",
    completionDate: c.completionDate || "",
    processMethods: c.processMethods || [],
    equipmentScanned: Boolean(c.equipmentScanned),
    equipment: c.equipment || null,
    actualReason: c.actualReason || "",
    remarks: c.remarks || "",
    processStatus: c.processStatus || "尚未完成",
  });
}
```

- [ ] **Step 4: `saveEditCase` 套用 helper 並寫入 store**

在 `store.update` 之前，對 `editDraft` 套用日期規則：

```js
const withDates = AppData.applyProcessStatusDates(
  editDraft,
  editDraft.processStatus,
  today()
);
editDraft = withDates;

store.update(editingId, {
  // ...既有欄位...
  processStatus: editDraft.processStatus,
  reRepairDate: editDraft.reRepairDate || "",
  completionDate: editDraft.completionDate || "",
});
```

完整 `store.update` patch 需包含既有欄位，並加上 `reRepairDate`、`completionDate`。

- [ ] **Step 5: 瀏覽器手動驗收（案件處理）**

Expected:

1. 開啟一筆「待料」案件 → 可見叫修日期、再次叫修日期（有值）、完工日期（空／—）
2. 改處理狀態為「案件完成」並儲存 → 再開啟，完工日期＝今天，再次叫修日期仍保留
3. 改為「轉汰換」並儲存 → 兩日期維持不變
4. 改為「待報價」並儲存 → 再次叫修日期＝今天，完工日期若原本有值則仍保留
5. 三個日期欄位為 readonly，無法手動輸入

- [ ] **Step 6: Commit**

```bash
git add js/modules/maintenance.js
git commit -m "Show case dates in edit modal and apply status date linkage"
```

---

### Task 3: 叫修案件紀錄 — 明細顯示三日期

**Files:**
- Modify: `js/modules/case-records.js`

- [ ] **Step 1: 在 `renderDetailModal` 的「案件資料」段加入三日期**

在 `detailItem("案件編號", c.id)` 之後插入：

```js
${detailItem("叫修日期", c.repairDate)}
${detailItem("再次叫修日期", c.reRepairDate)}
${detailItem("完工日期", c.completionDate)}
```

（`detailItem` 已對空值顯示 `—`，無需額外處理。）

- [ ] **Step 2: 瀏覽器手動驗收（叫修案件紀錄）**

Expected:

1. 進入「叫修案件紀錄」，調整日期區間涵蓋 seed 案件
2. 查看「待料」案件 → 有再次叫修日期、完工日期為 —
3. 查看「案件完成」案件 → 有完工日期
4. 查看「轉汰換」案件 → 再次叫修／完工皆 —
5. 欄位完全唯讀（無 input）

- [ ] **Step 3: Commit**

```bash
git add js/modules/case-records.js
git commit -m "Show repair/re-repair/completion dates in case records detail"
```

---

### Task 4: 對照 spec 驗收收尾

**Files:**
- 必要時微調：`css/styles.css`（僅當 readonly 日期欄位排版異常）
- 可選：`README.md`（若功能說明需提及日期欄位；非必須）

- [ ] **Step 1: 對照 spec §8 逐項勾選**

- [ ] 「案件處理」編輯視窗可見三日期（唯讀）
- [ ] 「叫修案件紀錄」明細可見三日期（唯讀）
- [ ] Seed 依狀態對齊
- [ ] 待料／待報價／尚未完成 → 押再次叫修日期，不清空完工日期
- [ ] 案件完成 → 押完工日期，不清空再次叫修日期
- [ ] 轉汰換／轉原廠 → 不改寫日期
- [ ] 不可手動編輯三日期
- [ ] 無「回到工作排程／新建工程」提示

- [ ] **Step 2: Commit（若有收尾改動）**

```bash
git add js/ css/ README.md
git commit -m "Align case date fields demo with spec"
```

若無檔案變更則跳過 commit。

---

## Self-Review

1. **Spec coverage:** §2 欄位 → Task 1；§3 連動 helper → Task 1 + Task 2 Step 4；§4.1 編輯顯示 → Task 2；§4.2 紀錄明細 → Task 3；§5 seed → Task 1 Step 2；§7 不在範圍（無提示、不清空、不可手動編輯）已在 Task 2/4 落實；§8 驗收 → Task 4。
2. **Placeholders:** 無 TBD；驗證以瀏覽器手動／Console（專案無測試框架）。
3. **Type consistency:** key 統一為 `reRepairDate`、`completionDate`；helper 名稱 `applyProcessStatusDates`；狀態字串與既有 `PROCESS_STATUSES` 一致（含「尚未完成」）。
4. **不清空模式:** helper 只 spread 寫入對應欄位，從不設 `""` 覆蓋另一日期；轉汰換／轉原廠直接回傳原物件。
