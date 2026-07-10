# 戰情室 - 維修服務 - 叫修案件紀錄 Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在既有 demo 上新增**第三層功能**「叫修案件紀錄」：導覽由兩層擴充為三層（維修服務 → 叫修案件／叫修案件紀錄），並提供依日期區間查詢的唯讀案件列表與唯讀案件明細。既有「叫修案件」（MaintenanceModule）功能不受影響。

**Architecture:** 沿用殼層 `index.html` + `app.js`；`app.js` 導覽改為支援第二層底下可含第三層子項。新增 `modules/case-records.js` 讀取 `AppData.SEED_CASES`（唯讀），渲染列表與明細 Modal。`data.js` 補上今日日期 seed 案件，讓「預設查當日」進頁面即有資料。無建置、無後端、重整重置。

**Tech Stack:** 原生 HTML / CSS / JS（無框架、無 bundler）。驗證以瀏覽器手動操作為主（本專案無測試框架）。

**Spec:** `docs/superpowers/specs/2026-07-10-case-records-demo-design.md`

---

## File Structure

| 檔案 | 本次職責／改動 |
|------|------|
| `index.html` | 新增載入 `js/modules/case-records.js`（在 `app.js` 之前） |
| `css/styles.css` | 新增第三層導覽、日期篩選、唯讀明細樣式（沿用既有變數與元件） |
| `js/data.js` | 補數筆叫修日期為今日的 seed 案件（涵蓋未結案／結案、含／不含設備） |
| `js/app.js` | 導覽由兩層擴充為三層：第二層可含 `children`，渲染第三層並掛載對應模組（向下相容） |
| `js/modules/case-records.js` | **新增**：叫修案件紀錄（日期區間篩選列表 + 唯讀明細 Modal） |
| `js/modules/maintenance.js` | 不變 |

---

### Task 1: 導覽擴充為三層（`app.js`）

**Files:**
- Modify: `js/app.js`
- Modify: `css/styles.css`（第三層導覽樣式）

- [ ] **Step 1: NAV 加入第三層子項**

第二層「維修服務」由「直接掛載模組」改為含 `children`：

```js
const NAV = [
  {
    id: "war-room",
    label: "戰情室",
    children: [
      {
        id: "maintenance",
        label: "維修服務",
        children: [
          { id: "maintenance-cases", label: "叫修案件", module: "MaintenanceModule" },
          { id: "case-records", label: "叫修案件紀錄", module: "CaseRecordsModule" },
        ],
      },
    ],
  },
];
```

- [ ] **Step 2: 狀態與查詢 helper**

新增 `currentTertiary`，並提供 `getPrimary()` / `getSecondary()` / `getTertiary()`。預設路由：`war-room` → `maintenance` → `maintenance-cases`（維持既有預設畫面）。

- [ ] **Step 3: 渲染第三層並向下相容**

- `renderSecondary()`：對 active 的第二層項目，若有 `children` 則在其下渲染 `.tertiary-nav`（縮排子項 `.nav-btn-sub`）。
- `resolveModule()`：若第二層有 `children` → 回傳目前第三層項目；否則回傳第二層自身（相容舊結構）。
- `mountModule()` 依 `resolveModule()` 取 `module` 掛載，卸載前一模組。

事件：`secondaryNav` 的 click 需同時處理 `[data-secondary]` 與 `[data-tertiary]`；切第二層時重設 `currentTertiary` 為該層第一個子項。

- [ ] **Step 4: 第三層導覽 CSS**

```css
.tertiary-nav { display: flex; flex-direction: column; gap: 4px; margin: 4px 0 4px 12px; }
.nav-btn-sub { font-size: 13px; padding: 6px 12px; }
```
（沿用既有 `.nav-btn` / `.nav-btn.active` 色彩變數。）

- [ ] **Step 5: 瀏覽器確認導覽**

Run: 用瀏覽器開啟 `index.html`

Expected: Sidebar「維修服務」下出現兩個子項「叫修案件」「叫修案件紀錄」；預設落在「叫修案件」且原維修服務畫面正常；點「叫修案件紀錄」時主區顯示「功能尚未實作」（模組尚未建立）。

- [ ] **Step 6: Commit**

```bash
git add js/app.js css/styles.css
git commit -m "Add third-level navigation under maintenance"
```

---

### Task 2: 補當日 seed 案件（`data.js`）

**Files:**
- Modify: `js/data.js`

- [ ] **Step 1: 新增數筆叫修日期為今日的 seed 案件**

在 `SEED_CASES` 陣列補約 3–4 筆 `repairDate` 為今日（例如 `2026-07-10`）的案件，欄位 shape 與既有案件一致（沿用相同 key）。ID 用當日前綴＋序號（如 `20260710001`）。須涵蓋：

- 至少 1 筆 `closed: false`（未結案）
- 至少 1 筆 `closed: true`（結案）— 驗證紀錄頁同時顯示結案案件
- 至少 1 筆 `equipment` 非 null 且 `equipmentScanned: true`（明細設備段有資料）
- 至少 1 筆 `equipment: null`（明細設備段顯示「尚無設備資料」）
- 至少 1 筆含 `processMethods`（明細處理方式列表有資料）

> 注意：保留既有 `2026-07-08` 案件，供調整日期區間時查詢；不刪除既有資料。

- [ ] **Step 2: 瀏覽器 Console 快速驗證**

```js
const s = AppData.createCaseStore(AppData.SEED_CASES);
console.log(s.getAll().filter(c => c.repairDate === "2026-07-10").length); // >= 3
```

- [ ] **Step 3: Commit**

```bash
git add js/data.js
git commit -m "Add same-day seed cases for records demo"
```

---

### Task 3: 叫修案件紀錄列表（`case-records.js`）

**Files:**
- Create: `js/modules/case-records.js`
- Modify: `index.html`（載入新模組）
- Modify: `css/styles.css`（日期篩選列樣式）

- [ ] **Step 1: 在 `index.html` 載入模組**

於 `js/app.js` 之前、`js/data.js` 之後加入：

```html
<script src="js/modules/case-records.js"></script>
```

- [ ] **Step 2: 建立模組骨架與狀態**

```js
window.CaseRecordsModule = (function () {
  const store = AppData.createCaseStore(AppData.SEED_CASES);
  let root = null;
  let startDate = null;   // "YYYY-MM-DD"
  let endDate = null;
  let viewingId = null;   // 目前查看明細的案件 id
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  function escapeHtml(value) { /* 同 maintenance.js */ }

  function getVisibleCases() {
    return store.getAll()
      .filter((c) => !startDate || c.repairDate >= startDate)
      .filter((c) => !endDate || c.repairDate <= endDate)
      .sort((a, b) => (a.repairDate < b.repairDate ? 1 : a.repairDate > b.repairDate ? -1 : 0));
  }

  function getCaseStatus(c) { return c.closed ? "結案" : "未結案"; }

  return { mount, unmount };
})();
```

進入時預設 `startDate = endDate = today()`（預設查當日、含結案與未結案）。

- [ ] **Step 3: 渲染篩選列 + 表格**

Toolbar（沿用 `.toolbar`）：

- 左側：開始日期 `input[type=date]`、結束日期 `input[type=date]`、「搜尋」按鈕（`data-action="search"`）
- 點「搜尋」讀取兩個日期 input 值寫入 `startDate` / `endDate` 後重繪

表格欄位順序（依 spec §4.3）：操作（查看）、叫修日期、案件編號、客戶名稱、門市名稱、行政區域、工項分類、叫修項目、叫修原因、故障描述、實際原因、指派人員、案件狀態。

- 操作 cell：`<button data-action="view" data-id="...">查看</button>`
- 案件狀態：`getCaseStatus(c)`（結案／未結案）
- 無資料列：`<tr><td colspan="13" class="empty-state">無資料</td></tr>`

- [ ] **Step 4: 事件委派與 mount / unmount**

比照 `maintenance.js`：`mount` 綁 `root` 的 `click`（處理 `search` / `view` / 關閉明細）；`unmount` 移除監聽並清狀態。`render()` 重畫整個 module HTML。

- [ ] **Step 5: 日期篩選列 CSS**

```css
.filter-fields { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.filter-fields label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-muted); }
.filter-fields input[type="date"] { /* 沿用 form input 樣式 */ }
```

- [ ] **Step 6: 瀏覽器驗收列表**

Expected:

- 進頁面預設以今日查詢，顯示當日 seed 案件（含結案與未結案）
- 調整日期至 `2026-07-08` 並搜尋，出現舊案件
- 區間無資料時顯示「無資料」
- 日期新到舊排序

- [ ] **Step 7: Commit**

```bash
git add js/modules/case-records.js index.html css/styles.css
git commit -m "Add case records list with date range filter"
```

---

### Task 4: 查看案件明細（唯讀 Modal）

**Files:**
- Modify: `js/modules/case-records.js`
- Modify: `css/styles.css`（唯讀明細樣式）

- [ ] **Step 1: 開啟／關閉明細**

- `view` action：`viewingId = id` 後 `render()`
- 關閉：點 backdrop 或關閉鈕 → `viewingId = null` 後 `render()`
- `render()` 末端：`viewingId ? renderDetailModal(store.getById(viewingId)) : ""`

- [ ] **Step 2: 三段唯讀內容**

沿用 `.modal` / `.modal-wide` / `.modal-header` / `.modal-actions`（僅「關閉」鈕，無儲存）。內容用純顯示卡片（無 input/select/textarea）：

1. **案件資料**：案件編號、工項分類、叫修人員、客戶名稱、門市名稱、服務等級、門市地址、叫修項目、故障描述、叫修原因
2. **設備資料**：客戶名稱、門市名稱、設備區域、內／外、型號
   - `equipment` 為 null → 顯示「尚無設備資料」
3. **處理資料**：實際維修原因、處理方式（大／中／小分類＋數量列表）、備註、處理狀態
   - `processMethods` 為空 → 顯示「無處理方式」

明細呈現 helper：

```js
function renderDetailItem(label, value) {
  return `<div class="detail-item"><span class="detail-label">${escapeHtml(label)}</span>
    <span class="detail-value">${escapeHtml(value || "—")}</span></div>`;
}
```

- [ ] **Step 3: 唯讀明細 CSS**

```css
.detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px 16px; padding: 20px 24px; }
.detail-item { display: flex; flex-direction: column; gap: 4px; }
.detail-item.detail-full { grid-column: 1 / -1; }
.detail-label { font-size: 12px; font-weight: 600; color: var(--text-muted); }
.detail-value { font-size: 14px; }
```
處理方式列表可用簡單 `.data-table` 或條列呈現。

- [ ] **Step 4: 瀏覽器驗收明細**

Expected:

- 點「查看」開啟明細，三段資料正確
- 完全不可編輯（無輸入元件、僅關閉鈕）
- 未掃描設備案件 → 設備段「尚無設備資料」
- 無處理方式 → 處理段「無處理方式」

- [ ] **Step 5: Commit**

```bash
git add js/modules/case-records.js css/styles.css
git commit -m "Add read-only case detail modal for records"
```

---

### Task 5: 收尾對齊與 README

**Files:**
- Modify: `README.md`
- Modify: 任何與 spec 不一致的字串／邏輯

- [ ] **Step 1: 對照 spec §9 驗收清單逐項確認**

- Sidebar 第三層：叫修案件、叫修案件紀錄
- 預設查當日、日期區間搜尋、含結案與未結案、日期新到舊
- 無資料顯示「無資料」
- 明細三段正確且不可編輯；無設備／無處理方式的替代文字
- 切回「叫修案件」原功能（新增／編輯／結案）不受影響

- [ ] **Step 2: 更新 `README.md`**

於功能說明補上第三層：

```markdown
目前功能：戰情室 → 維修服務 → 叫修案件（列表／新增／編輯／結案）、叫修案件紀錄（日期查詢／唯讀明細）。
```
並在主要檔案清單補上 `js/modules/case-records.js`。

- [ ] **Step 3: Commit**

```bash
git add README.md js/ css/ index.html
git commit -m "Align case records demo with spec and update README"
```

---

## Self-Review

1. **Spec coverage:** §2 檔案改動 → Task 1/2/3；§3 三層導覽 → Task 1；§4 列表＋日期篩選 → Task 3（含「補當日 seed」以支援預設查當日 → Task 2）；§5 唯讀明細三段 → Task 4；§8 不在範圍（唯讀、不共享 runtime）在 Task 3/4 以獨立 store、無編輯元件落實。
2. **向下相容:** `app.js` 的 `resolveModule()` 對「無 children 的第二層」仍回傳第二層自身，確保未來其他第二層項目沿用舊寫法；本次既有 MaintenanceModule 移至第三層子項，畫面與行為不變。
3. **Placeholders:** 無 TBD；驗證步驟為瀏覽器手動（專案無測試框架，符合 demo 範圍）。
4. **決策記錄:** 「預設查當日」與既有 seed 日期（2026-07-08）不一致 → 採「補當日 seed 資料」（Task 2），維持規格語意且進頁面即有資料。
