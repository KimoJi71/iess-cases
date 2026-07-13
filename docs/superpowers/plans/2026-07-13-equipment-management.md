# 設備管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在客戶建檔下新增設備管理 CRUD（列表篩選、表單、型號自動帶入、刪除連動叫修案件）。

**Architecture:** 獨立 `equipments` 全域 store，列表／表單對齊門市管理；型號對照表在 `options.js`；刪除時依 `equipment.id` 過濾 `cases`。

**Tech Stack:** Vanilla JS IIFE + `IESS.h` / `stateful`、Tailwind CDN、既有 PageHeader／Icons。

**驗證方式:** 本專案無自動測試；各 task 以瀏覽器手動驗收對應規格第 9 節。不自動 commit（除非使用者要求）。

---

### Task 1: 選項與假資料

**Files:**
- Modify: `src/data/options.js`
- Modify: `src/data/seed.js`

- [x] **Step 1:** 在 `options.js` 新增 `EQUIP_MODEL_CATALOG`、`EQUIP_INDOOR_OUTDOOR_OPTIONS`、`EQUIP_VOLTAGE_OPTIONS`（內容見設計規格 §4）。
- [x] **Step 2:** 在 `seed.js` 新增 `INITIAL_EQUIPMENTS`，至少含 `E1`（星巴克／站前店）、`E3`（萊爾富／高雄左營店），以及屈臣氏門市 1～2 筆，欄位齊全。

### Task 2: 選單與路由

**Files:**
- Modify: `src/shell/sidebar.js`
- Modify: `src/app.js`
- Modify: `index.html`

- [x] **Step 1:** Sidebar「客戶建檔」加上「設備管理」。
- [x] **Step 2:** `app.js` 加入 `equipments`、`equipmentCustomer`、`equipmentStore`、setter、`SUBMENU_DEFAULT_VIEW`、三個 view 路由。
- [x] **Step 3:** `index.html` 載入 `equipment-list.js`、`equipment-form.js`。

### Task 3: 列表頁

**Files:**
- Create: `src/features/customer/equipment-list.js`

- [x] **Step 1:** 實作篩選（客戶→門市）、表格欄位、新增按鈕、刪除 modal（文案含連動案件）、刪除時同步 `setCases`。

### Task 4: 表單頁

**Files:**
- Create: `src/features/customer/equipment-form.js`

- [x] **Step 1:** 新增／編輯表單，型號變更套用 catalog，儲存後回列表。

### Task 5: 驗收

- [x] **Step 1:** 對照規格 §9 七項手動確認。
