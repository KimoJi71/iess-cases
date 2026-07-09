# 戰情室 - 維修服務 Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可雙擊開啟的戰情室深色風格靜態 demo，完成「戰情室 → 維修服務」案件列表、新增、編輯（含 QR 解鎖）、結案、複製 URL。

**Architecture:** 殼層 `index.html` + `app.js` 負責第一／二層導覽與模組掛載；`data.js` 提供假資料與選項；`modules/maintenance.js` 負責維修服務全部 UI 與記憶體狀態。無建置、無後端、重整重置。

**Tech Stack:** 原生 HTML / CSS / JS（無框架、無 bundler）。驗證以瀏覽器手動操作為主（本專案無測試框架）。

**Spec:** `docs/superpowers/specs/2026-07-09-war-room-maintenance-demo-design.md`

---

## File Structure

| 檔案 | 職責 |
|------|------|
| `index.html` | 殼：header、sidebar、`#app-content` 掛載點、script 載入順序 |
| `css/styles.css` | 深色主題、layout、表格、按鈕、Modal、燈號、toast |
| `js/data.js` | 選項常數、客戶／門市對照、初始案件陣列、`createCaseStore()` |
| `js/app.js` | 導覽設定、切換第一／二層、呼叫 module `mount` / `unmount` |
| `js/modules/maintenance.js` | 列表、篩選、新增／編輯 Modal、結案、複製 URL、燈號／案件狀態計算 |

---

### Task 1: 殼層 HTML + 深色 Layout CSS

**Files:**
- Create: `index.html`
- Create: `css/styles.css`

- [ ] **Step 1: 建立 `index.html` 殼層**

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>戰情室 - 維修服務 Demo</title>
  <link rel="stylesheet" href="css/styles.css" />
</head>
<body>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand">IESS 戰情室</div>
      <nav class="primary-nav" id="primary-nav" aria-label="第一層功能"></nav>
    </header>
    <div class="app-body">
      <aside class="app-sidebar">
        <nav class="secondary-nav" id="secondary-nav" aria-label="第二層功能"></nav>
      </aside>
      <main class="app-main" id="app-content"></main>
    </div>
  </div>
  <div id="toast" class="toast" hidden></div>

  <script src="js/data.js"></script>
  <script src="js/modules/maintenance.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: 建立 `css/styles.css` 基礎 layout 與深色主題**

至少包含：

```css
:root {
  --bg: #0b1220;
  --bg-panel: #121a2b;
  --bg-elevated: #1a2438;
  --border: #2a3650;
  --text: #e8eefc;
  --text-muted: #9aa8c7;
  --accent: #3b82f6;
  --danger: #ef4444;
  --warn: #f59e0b;
  --ok: #22c55e;
  --header-h: 56px;
  --sidebar-w: 200px;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
  background: var(--bg);
  color: var(--text);
}

.app-shell { min-height: 100vh; display: flex; flex-direction: column; }
.app-header {
  height: var(--header-h);
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 0 20px;
  background: #070d18;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 20;
}
.brand { font-weight: 700; letter-spacing: 0.04em; }
.primary-nav, .secondary-nav { display: flex; gap: 8px; }
.primary-nav { flex: 1; }
.secondary-nav { flex-direction: column; padding: 12px; }

.nav-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
}
.nav-btn.active {
  color: var(--text);
  background: var(--bg-elevated);
  border-color: var(--border);
}
.nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.app-body { display: flex; flex: 1; min-height: 0; }
.app-sidebar {
  width: var(--sidebar-w);
  background: var(--bg-panel);
  border-right: 1px solid var(--border);
  position: sticky;
  top: var(--header-h);
  height: calc(100vh - var(--header-h));
}
.app-main {
  flex: 1;
  padding: 20px;
  overflow: auto;
  min-width: 0;
}
```

同時預留後續會用到的 class 區塊（可先寫空規則或基本樣式）：`.toolbar`、`.filter-btn`、`.btn`、`.btn-primary`、`.btn-danger`、`.table-wrap`、`.data-table`、`.light`、`.light-red`、`.light-yellow`、`.light-green`、`.modal-backdrop`、`.modal`、`.form-grid`、`.toast`、`.empty-state`。

- [ ] **Step 3: 用瀏覽器開啟確認殼層**

Run: 用瀏覽器開啟 `index.html`（或 `open index.html`）

Expected: 深色頁面、頂部有品牌文字、左側有側欄區域、主內容空白。此時導覽按鈕尚未由 JS 渲染亦可。

- [ ] **Step 4: Commit**

```bash
git add index.html css/styles.css
git commit -m "Add app shell layout and dark theme styles"
```

---

### Task 2: 資料層 `data.js`（選項、門市、假資料、store）

**Files:**
- Create: `js/data.js`

- [ ] **Step 1: 建立選項常數與客戶／門市對照**

依 spec 使用以下值（字串需一致，供篩選與顯示）：

```js
window.AppData = (function () {
  const WORK_CATEGORIES = ["一般叫修", "緊急叫修", "保養清潔", "其他"];
  const REPAIR_ITEMS = ["室內機", "室外機", "風管", "出風口", "控制面板", "跳代碼", "空氣門"];
  const REPAIR_REASONS = ["不冷", "異音", "溫控故障", "跳機", "異味", "漏水", "代碼", "其他"];
  const ASSIGNEES = ["A組", "B組", "C組", "D組", "晉詮人員", "協力廠商", "案件待辦"];
  const PROCESS_STATUSES = ["待料", "待報價", "尚未完成", "轉原廠", "轉汰換", "案件完成"];
  const FILTER_STATUSES = ["待料", "待報價", "待汰換", "轉原廠", "其他"];
  const REGIONS = ["北區", "中區", "南區", "東區"];
  const PROCESS_LARGE = ["人工", "零件", "材料", "特殊工"];
  const PROCESS_MEDIUM = ["分離式", "冰水機", "其他"];
  const PROCESS_SMALL = ["更換零件", "清洗", "檢測", "管路處理", "其他"];

  const CUSTOMERS = [
    {
      name: "星巴克",
      stores: [
        { name: "台北信義店", address: "台北市信義區信義路五段7號", serviceLevel: "A", region: "北區" },
        { name: "台中公益店", address: "台中市西區公益路150號", serviceLevel: "B", region: "中區" },
      ],
    },
    {
      name: "屈臣氏",
      stores: [
        { name: "高雄夢時代店", address: "高雄市前鎮區中華五路789號", serviceLevel: "A", region: "南區" },
        { name: "花蓮中山店", address: "花蓮市中山路100號", serviceLevel: "C", region: "東區" },
      ],
    },
    {
      name: "萊爾富",
      stores: [
        { name: "新北板橋店", address: "新北市板橋區文化路一段188號", serviceLevel: "B", region: "北區" },
        { name: "台南中正店", address: "台南市中西區中正路50號", serviceLevel: "B", region: "南區" },
      ],
    },
  ];

  const REQUESTERS = ["王小明", "陳美玲", "林志豪", "黃雅婷"];

  // ... seed cases + createCaseStore below
})();
```

- [ ] **Step 2: 建立 10 筆左右 seed cases**

每筆案件物件欄位（之後 `maintenance.js` 一律用這些 key）：

```js
{
  id: "20260708001",
  repairDate: "2026-07-08",          // 叫修日期 YYYY-MM-DD
  workCategory: "緊急叫修",
  customerName: "星巴克",
  storeName: "台北信義店",
  storeAddress: "台北市信義區信義路五段7號",
  serviceLevel: "A",
  region: "北區",
  requester: "王小明",
  repairItem: "室內機",
  repairReason: "不冷",
  faultDescription: "出風無冷意",
  assignee: "A組",
  estimatedDate: "2026-07-07",       // 用於黃燈判斷
  estimatedTime: "09:00-12:00",
  actualReason: "",
  processMethods: [],                // [{ large, medium, small, qty }]
  remarks: "",
  processStatus: "待料",             // 篩選用；「待汰換」對應 processStatus「轉汰換」
  equipmentScanned: false,
  equipment: null,                   // { customer, store, area, io, model }
  closed: false,
}
```

Seed 資料須涵蓋：

- 各篩選狀態：待料、待報價、轉汰換（顯示為待汰換）、轉原廠、其他（用「尚未完成」等非前四者）
- 紅燈：`workCategory === "緊急叫修"`
- 黃燈：`estimatedDate` 早於今天且 `processStatus !== "案件完成"` 且非緊急（或緊急優先紅）
- 綠燈：`processStatus === "案件完成"` 且 `closed: false`（仍可出現在未結案列表，或另備一筆已完成未結案）
- 至少 1 筆 `closed: true`（預設列表不顯示）
- 至少 1 筆未派工（`assignee` 為「案件待辦」或空，且無預計日期／時段）
- 至少 1 筆已派工

燈號優先順序（實作時寫進 helper，seed 需能測到）：

1. 綠：`processStatus === "案件完成"`
2. 紅：`workCategory === "緊急叫修"`
3. 黃：有 `estimatedDate` 且日期 `< 今天` 且尚未完成
4. 其他：無燈號

案件狀態計算：

- `已完成`：`processStatus === "案件完成"`
- `已派工`：有指派人員（非空且非「案件待辦」）且有預計日期且有預計時段
- `未派工`：其餘

- [ ] **Step 3: 實作 `createCaseStore()`**

```js
function createCaseStore(seed) {
  let cases = seed.map((c) => structuredClone(c));

  return {
    getAll() { return cases.slice(); },
    getById(id) { return cases.find((c) => c.id === id) || null; },
    add(caseData) {
      cases = [caseData, ...cases];
      return caseData;
    },
    update(id, patch) {
      cases = cases.map((c) => (c.id === id ? { ...c, ...patch } : c));
      return this.getById(id);
    },
    close(id) {
      return this.update(id, { closed: true });
    },
    nextId(dateStr) {
      // dateStr: "2026-07-09" -> prefix "20260709"
      const prefix = dateStr.replaceAll("-", "");
      const seqs = cases
        .filter((c) => String(c.id).startsWith(prefix))
        .map((c) => Number(String(c.id).slice(8)))
        .filter((n) => !Number.isNaN(n));
      const next = (seqs.length ? Math.max(...seqs) : 0) + 1;
      return prefix + String(next).padStart(3, "0");
    },
  };
}

return {
  WORK_CATEGORIES,
  REPAIR_ITEMS,
  REPAIR_REASONS,
  ASSIGNEES,
  PROCESS_STATUSES,
  FILTER_STATUSES,
  REGIONS,
  PROCESS_LARGE,
  PROCESS_MEDIUM,
  PROCESS_SMALL,
  CUSTOMERS,
  REQUESTERS,
  SEED_CASES, // 上面的 seed 陣列
  createCaseStore,
};
```

- [ ] **Step 4: 在瀏覽器 Console 快速驗證**

開啟 `index.html`，Console：

```js
const s = AppData.createCaseStore(AppData.SEED_CASES);
console.log(s.getAll().length);
console.log(s.nextId("2026-07-09"));
```

Expected: 筆數約 8–12；`nextId` 回傳如 `20260709001`（若當日尚無案件）。

- [ ] **Step 5: Commit**

```bash
git add js/data.js
git commit -m "Add demo data store and seed maintenance cases"
```

---

### Task 3: 導覽殼 `app.js`

**Files:**
- Create: `js/app.js`

- [ ] **Step 1: 實作導覽設定與模組掛載**

```js
(function () {
  const NAV = [
    {
      id: "war-room",
      label: "戰情室",
      children: [
        { id: "maintenance", label: "維修服務", module: "MaintenanceModule" },
      ],
    },
  ];

  let currentPrimary = "war-room";
  let currentSecondary = "maintenance";
  let activeModule = null;

  const primaryNav = document.getElementById("primary-nav");
  const secondaryNav = document.getElementById("secondary-nav");
  const content = document.getElementById("app-content");

  function renderPrimary() {
    primaryNav.innerHTML = NAV.map((item) => `
      <button type="button" class="nav-btn ${item.id === currentPrimary ? "active" : ""}"
        data-primary="${item.id}">${item.label}</button>
    `).join("");
  }

  function renderSecondary() {
    const primary = NAV.find((n) => n.id === currentPrimary);
    secondaryNav.innerHTML = (primary?.children || []).map((child) => `
      <button type="button" class="nav-btn ${child.id === currentSecondary ? "active" : ""}"
        data-secondary="${child.id}">${child.label}</button>
    `).join("");
  }

  function mountModule() {
    if (activeModule?.unmount) activeModule.unmount();
    content.innerHTML = "";
    const primary = NAV.find((n) => n.id === currentPrimary);
    const child = primary?.children.find((c) => c.id === currentSecondary);
    const mod = child ? window[child.module] : null;
    if (!mod) {
      content.innerHTML = `<div class="empty-state">功能尚未實作</div>`;
      activeModule = null;
      return;
    }
    activeModule = mod;
    mod.mount(content);
  }

  primaryNav.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-primary]");
    if (!btn) return;
    currentPrimary = btn.dataset.primary;
    const primary = NAV.find((n) => n.id === currentPrimary);
    currentSecondary = primary?.children[0]?.id || null;
    renderPrimary();
    renderSecondary();
    mountModule();
  });

  secondaryNav.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-secondary]");
    if (!btn) return;
    currentSecondary = btn.dataset.secondary;
    renderSecondary();
    mountModule();
  });

  renderPrimary();
  renderSecondary();
  mountModule();
})();
```

注意：此時 `MaintenanceModule` 尚不存在，主內容會顯示「功能尚未實作」——下一步再補。

- [ ] **Step 2: 瀏覽器確認導覽**

Expected: Header 有「戰情室」active；Sidebar 有「維修服務」active；主區顯示「功能尚未實作」或空白提示。

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "Add primary/secondary navigation shell"
```

---

### Task 4: 維修服務列表 + 篩選 + 燈號／狀態

**Files:**
- Create: `js/modules/maintenance.js`
- Modify: `css/styles.css`（表格、toolbar、燈號、空狀態）

- [ ] **Step 1: 建立 module 骨架與 helper**

```js
window.MaintenanceModule = (function () {
  const store = AppData.createCaseStore(AppData.SEED_CASES);
  let root = null;
  let filterStatus = null; // null = 全部未結案
  let today = () => new Date().toISOString().slice(0, 10);

  function getLight(c) {
    if (c.processStatus === "案件完成") return "green";
    if (c.workCategory === "緊急叫修") return "red";
    if (c.estimatedDate && c.estimatedDate < today() && c.processStatus !== "案件完成") {
      return "yellow";
    }
    return null;
  }

  function getCaseStatus(c) {
    if (c.processStatus === "案件完成") return "已完成";
    const assigned =
      c.assignee && c.assignee !== "案件待辦" && c.estimatedDate && c.estimatedTime;
    return assigned ? "已派工" : "未派工";
  }

  // 篩選「待汰換」對應 processStatus「轉汰換」
  function matchesFilter(c, filter) {
    if (!filter) return true;
    if (filter === "待汰換") return c.processStatus === "轉汰換";
    if (filter === "其他") {
      return !["待料", "待報價", "轉汰換", "轉原廠"].includes(c.processStatus);
    }
    return c.processStatus === filter;
  }

  function getVisibleCases() {
    return store
      .getAll()
      .filter((c) => !c.closed)
      .filter((c) => matchesFilter(c, filterStatus))
      .sort((a, b) => (a.repairDate < b.repairDate ? 1 : a.repairDate > b.repairDate ? -1 : 0));
  }

  function countByFilter(status) {
    return store.getAll().filter((c) => !c.closed && matchesFilter(c, status)).length;
  }

  function mount(container) {
    root = container;
    render();
  }

  function unmount() {
    root = null;
  }

  function render() {
    if (!root) return;
    // toolbar + table HTML...
  }

  return { mount, unmount };
})();
```

- [ ] **Step 2: 實作 `render()` 列表 UI**

Toolbar：

- 左側：`AppData.FILTER_STATUSES` 各一顆 `.filter-btn`，文字如 `待料 (3)`；active 時加 class；點同一顆則 `filterStatus = null`
- 右側：`新增叫修單` 按鈕（先 `console.log` 或空 handler，Task 5 再接）

表格欄位順序依 spec：操作、燈號、叫修日期、案件編號、客戶名稱、門市名稱、行政區域、工項分類、叫修項目、叫修原因、故障描述、實際原因、指派人員、案件狀態。

燈號 cell：

```html
<span class="light light-red" title="緊急叫修"></span>
```

無燈號則空白。無資料列：

```html
<tr><td colspan="14" class="empty-state">無資料</td></tr>
```

操作按鈕：`data-action="edit|close|copy"` + `data-id`。

- [ ] **Step 3: 綁定篩選點擊（事件委派在 root）**

在 `mount` 後對 `root` 做一次 `click` 委派即可（每次 `render` 重畫 HTML 時仍有效）。

- [ ] **Step 4: 補齊 CSS**

`.filter-btn`、`.data-table`（`white-space: nowrap`）、`.table-wrap { overflow-x: auto }`、`.light` 圓點 10–12px、紅黃綠色。

- [ ] **Step 5: 瀏覽器驗收列表**

Expected:

- 預設只見未結案、日期新到舊
- 篩選數量正確；點選／取消有效
- 緊急叫修紅燈、逾期黃燈、案件完成綠燈
- 案件狀態顯示 已派工／未派工／已完成

- [ ] **Step 6: Commit**

```bash
git add js/modules/maintenance.js css/styles.css
git commit -m "Add maintenance case list with filters and status lights"
```

---

### Task 5: 新增叫修單 Modal

**Files:**
- Modify: `js/modules/maintenance.js`
- Modify: `css/styles.css`

- [ ] **Step 1: 實作 Modal 開啟／關閉與表單 HTML**

欄位依 spec §5。客戶／門市連動：

```js
function onCustomerChange(customerName) {
  const customer = AppData.CUSTOMERS.find((c) => c.name === customerName);
  // 重填門市 options；清空地址、服務等級
}

function onStoreChange(customerName, storeName) {
  const store = AppData.CUSTOMERS
    .find((c) => c.name === customerName)
    ?.stores.find((s) => s.name === storeName);
  // 填 storeAddress、serviceLevel、region（region 存進案件）
}
```

叫修原因變更：若為「其他」，故障描述加 `required` 並標示必填。

- [ ] **Step 2: 儲存邏輯**

```js
function saveNewCase(form) {
  const repairReason = form.repairReason;
  const faultDescription = form.faultDescription.trim();
  if (repairReason === "其他" && !faultDescription) {
    alert("叫修原因為「其他」時，故障描述為必填");
    return;
  }
  const repairDate = today();
  const id = store.nextId(repairDate);
  store.add({
    id,
    repairDate,
    workCategory: form.workCategory,
    customerName: form.customerName,
    storeName: form.storeName,
    storeAddress: form.storeAddress,
    serviceLevel: form.serviceLevel,
    region: form.region,
    requester: form.requester,
    repairItem: form.repairItem,
    repairReason,
    faultDescription,
    assignee: form.assignee,
    estimatedDate: form.estimatedDate,
    estimatedTime: form.estimatedTime,
    actualReason: "",
    processMethods: [],
    remarks: "",
    processStatus: "尚未完成",
    equipmentScanned: false,
    equipment: null,
    closed: false,
  });
  closeModal();
  render();
}
```

- [ ] **Step 3: Modal CSS**

`.modal-backdrop` 全螢幕半透明；`.modal` 置中、深色面板、最大寬度約 720px、內容可捲動。

- [ ] **Step 4: 瀏覽器驗收新增**

Expected: 新增後列表最上方（或依日期排序正確）出現新案件；原因「其他」且描述空白時無法儲存。

- [ ] **Step 5: Commit**

```bash
git add js/modules/maintenance.js css/styles.css
git commit -m "Add create repair case modal with validation"
```

---

### Task 6: 編輯案件（三段）+ QR 解鎖 + 處理方式動態列

**Files:**
- Modify: `js/modules/maintenance.js`
- Modify: `css/styles.css`

- [ ] **Step 1: 開啟編輯 Modal，帶入案件資料**

三段：

1. 案件資訊（同新增欄位，可改）
2. 設備資訊：按鈕「掃描設備 QR CODE」；未掃描顯示提示；掃描後顯示欄位
3. 處理資訊：包在 `fieldset` 或 `div`，`disabled` 直到 `equipmentScanned`

- [ ] **Step 2: 模擬掃描**

```js
function scanEquipment(caseId) {
  const c = store.getById(caseId);
  store.update(caseId, {
    equipmentScanned: true,
    equipment: {
      customer: c.customerName,
      store: c.storeName,
      area: "賣場空調區",
      io: "室內",
      model: "AC-DEMO-100",
    },
  });
  // 重新渲染編輯 Modal 內容（保持開啟）
}
```

- [ ] **Step 3: 處理方式動態列**

每列：大／中／小分類 select + 數量 number + 刪除；底部「新增列」。至少保留 0 列亦可儲存。

- [ ] **Step 4: 儲存編輯**

`store.update(id, { ...表單欄位, processMethods, equipmentScanned, equipment })` 後關閉並 `render()`。

- [ ] **Step 5: 瀏覽器驗收編輯**

Expected: 未掃描時處理區無法操作；掃描後可填實際原因／處理方式／處理狀態並儲存；列表實際原因與狀態更新。

- [ ] **Step 6: Commit**

```bash
git add js/modules/maintenance.js css/styles.css
git commit -m "Add edit case modal with QR unlock and process rows"
```

---

### Task 7: 結案確認 + 複製 URL + Toast

**Files:**
- Modify: `js/modules/maintenance.js`
- Modify: `css/styles.css`

- [ ] **Step 1: 結案**

```js
function confirmClose(id) {
  if (!confirm("確定要將此案件結案？結案後將自列表移除。")) return;
  store.close(id);
  render();
}
```

- [ ] **Step 2: 複製 URL + Toast**

```js
async function copyCaseUrl(id) {
  const url = `https://demo.local/cases/${id}`;
  await navigator.clipboard.writeText(url);
  showToast("已複製");
}

function showToast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { el.hidden = true; }, 1600);
}
```

若 `clipboard` 在 `file://` 失敗，fallback：

```js
try {
  await navigator.clipboard.writeText(url);
} catch {
  prompt("複製以下網址：", url);
}
```

- [ ] **Step 3: Toast CSS**

固定於畫面下方中央，深色底、短暫顯示。

- [ ] **Step 4: 完整驗收（對照 spec §12）**

逐項勾選：

- Header「戰情室」、Sidebar「維修服務」
- 列表、篩選、燈號、狀態
- 新增、其他必填
- 編輯三段、QR 鎖定
- 結案移除
- 複製提示
- 篩到無資料時「無資料」

- [ ] **Step 5: Commit**

```bash
git add js/modules/maintenance.js css/styles.css
git commit -m "Add case close confirmation and copy URL toast"
```

---

### Task 8: 收尾對齊與 README

**Files:**
- Create: `README.md`（簡短即可）
- Modify: 任何與 spec 不一致的字串／邏輯

- [ ] **Step 1: 對照 spec 快速檢查**

特別確認使用者改過的規則：

- 燈號：紅＝緊急叫修；黃＝超過預計日期尚未完成；綠＝案件完成；其他不顯示
- 案件狀態：已派工／未派工／已完成定義
- 工項／叫修項目／原因／指派人員用詞與 spec 表格一致
- 篩選「待汰換」對應 `轉汰換`

- [ ] **Step 2: 寫簡短 `README.md`**

```markdown
# IESS 戰情室 Demo

雙擊開啟 `index.html` 即可操作。

目前功能：戰情室 → 維修服務（案件列表／新增／編輯／結案）。

資料為記憶體假資料，重整後重置。
```

- [ ] **Step 3: Commit**

```bash
git add README.md js/ css/ index.html
git commit -m "Add README and align demo with maintenance spec"
```

---

## Self-Review

1. **Spec coverage:** §3 導覽 → Task 1/3；§4 列表篩選燈號狀態 → Task 4；§5 新增 → Task 5；§6 編輯 QR → Task 6；§7 結案／複製 → Task 7；擴充結構 → Task 2/3 的 NAV + module 介面。
2. **Placeholders:** 無 TBD；驗證步驟為瀏覽器手動（專案無測試框架，符合 demo 範圍）。
3. **Type consistency:** 案件欄位以 Task 2 的物件 shape 為準；篩選「待汰換」↔`轉汰換` 在 Task 4 明確處理。
