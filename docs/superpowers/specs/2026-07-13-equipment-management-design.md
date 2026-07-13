# 設備管理（客戶建檔）設計規格

**日期：** 2026-07-13  
**範圍：** 戰情室 → 客戶建檔 → 設備管理  
**狀態：** 待實作

## 1. 目標

在「客戶建檔」下新增獨立的「設備管理」功能，提供依客戶／門市篩選的設備列表，以及新增、編輯、刪除（含關聯叫修案件連動刪除）。

## 2. 架構決策

採 **獨立設備清單**（與門市管理相同模式）：

- 全域 store 新增 `equipments` 陣列
- 列表篩選狀態：`equipmentCustomer`、`equipmentStore`（字串，對應客戶名稱／門市名稱）
- 不掛在 `stores[].equipments` 底下，避免篩選與案件連動過繞

## 3. 選單與路由

### Sidebar

於「客戶建檔」群組新增子選單：`設備管理`（排在「門市管理」之後）。

### Views

| view | 元件 | 說明 |
|------|------|------|
| `equipment-list` | `EquipmentList` | 預設進入頁 |
| `equipment-add` | `EquipmentForm` | 新增 |
| `equipment-edit` | `EquipmentForm` | 編輯（`editingCase` 帶入目標設備） |

`SUBMENU_DEFAULT_VIEW['設備管理'] = 'equipment-list'`，並加入 `KNOWN_SUBMENUS`。

## 4. 資料模型

### 設備（equipment）

```js
{
  id: 'E1',                    // 字串，與案件 equipment.id 對齊
  customerName: '星巴克',
  storeName: '台中旗艦店',
  category: '分離式',           // 設備分類
  brand: '日立',
  name: '一號機 RAS-100',      // 設備名稱
  model: 'RAS-100',            // 型號
  area: '一樓大廳',             // 設備區域
  manufactureDate: '2024-01-15',
  installDate: '2024-03-01',
  assetNumber: 'AST-001',
  serialNumber: 'SN-001',
  horsepower: '3.5',           // 匹數
  indoorOutdoor: '室內機',      // 室內外機
  voltage: '220V',
  createdDate: '2026-07-01'
}
```

### 型號對照表（示範用）

於 `options.js` 新增 `EQUIP_MODEL_CATALOG`，選型號時自動帶入：

| 型號 | 設備分類 | 品牌 | 匹數 | 室內外機 | 電壓 |
|------|----------|------|------|----------|------|
| RAS-100 | 分離式 | 日立 | 3.5 | 室內機 | 220V |
| RAS-50 | 分離式 | 日立 | 2.0 | 室內機 | 110V |
| FXYP100 | 分離式 | 大金 | 4.0 | 室外機 | 220V |
| PA-063 | 冰水 | 三菱重工 | 5.0 | 無 | 380V |
| 其他 | （不自動帶入，手動填） | | | | |

選項常數可沿用／擴充：`EQUIP_CATEGORY_OPTIONS`、`EQUIP_BRAND_OPTIONS`、`EQUIP_NAME_OPTIONS`、`EQUIP_MODEL_OPTIONS`；另加：

- `EQUIP_INDOOR_OUTDOOR_OPTIONS = ['室內機', '室外機', '無']`
- `EQUIP_VOLTAGE_OPTIONS = ['110V', '220V', '380V']`

## 5. 列表頁（EquipmentList）

### 篩選

- **客戶名稱**（必選）：下拉，來源 `customers`
- **門市名稱**（必選）：下拉，依已選客戶過濾 `stores`；未選客戶時 disabled
- 兩者皆選後才查詢並顯示該門市設備；否則顯示提示：「請先篩選客戶與門市，才可查詢設備列表」
- 右上角 **新增設備**：未選客戶／門市時 toast 錯誤提示

### 表格欄位

操作（編輯／刪除）、設備分類、品牌、設備名稱、型號、設備區域、出廠日期、安裝日期、資產編號、流水序號

- **不顯示** 匹數、室內外機、電壓（僅表單）
- 無資料列顯示「無資料」
- UI 風格對齊 `store-list.js`（白底卡片、拖曳橫向捲動、刪除確認 modal）

### 刪除行為

1. 點刪除 → 確認 modal（文案需提及將一併刪除關聯案件）
2. 確認後：
   - 從 `equipments` 移除該筆
   - 從 `cases`（叫修案件）移除所有 `equipment && equipment.id === 被刪設備 id` 的案件
3. toast 成功訊息

## 6. 表單頁（EquipmentForm）

### 進入條件

- 新增：帶入目前篩選的 `equipmentCustomer` / `equipmentStore`（唯讀顯示）
- 編輯：帶入 `editingCase`（設備物件）

### 欄位

| 欄位 | 控制項 | 備註 |
|------|--------|------|
| 客戶名稱 | 唯讀 | 篩選／設備帶入 |
| 門市名稱 | 唯讀 | 同上 |
| 型號 | select | 變更時套用 `EQUIP_MODEL_CATALOG` |
| 設備分類 | select | 可由型號帶入，可改 |
| 品牌 | select | 可由型號帶入，可改 |
| 設備名稱 | text / select | 可填寫 |
| 設備區域 | text | |
| 出廠日期 | date | |
| 安裝日期 | date | |
| 資產編號 | text | |
| 流水序號 | text | |
| 匹數 | text | 可由型號帶入 |
| 室內外機 | select | 可由型號帶入 |
| 電壓 | select | 可由型號帶入 |

選「其他」型號時不清空已填欄位（或僅不清自動欄位以外的名稱／區域等），不強制覆寫為空。

### 儲存

- 新增：產生 `id`（如 `'E' + Date.now()`）、`createdDate`，append 至 `equipments`
- 編輯：依 `id` 更新
- 成功後返回 `equipment-list` 並 toast

### 頁首

使用既有 `PageHeader`（標題：新增設備／編輯設備；關閉回列表）。

## 7. 檔案異動清單

| 檔案 | 變更 |
|------|------|
| `src/shell/sidebar.js` | 客戶建檔加上「設備管理」 |
| `src/app.js` | store、setter、`SUBMENU_DEFAULT_VIEW`、view 路由 |
| `src/data/options.js` | 型號 catalog、室內外機／電壓選項 |
| `src/data/seed.js` | `INITIAL_EQUIPMENTS`，id 對齊既有案件 `equipment.id`（E1、E3、E4 等） |
| `src/features/customer/equipment-list.js` | 新增 |
| `src/features/customer/equipment-form.js` | 新增 |
| `index.html` | 載入上述兩個 script |

## 8. 非範圍（本次不做）

- 型號主檔獨立 CRUD 模組
- 工程立案／現勘表與設備清單的雙向同步
- 列表顯示匹數／室內外機／電壓
- 刪除設備時連動刪除工程立案單、保養案件（僅叫修 `cases`）

## 9. 驗收標準

1. 側邊選單可進入設備管理列表
2. 未選客戶／門市時不顯示資料，僅提示
3. 選客戶＋門市後可看到該門市設備；無則「無資料」
4. 可新增設備並出現在列表
5. 可編輯並儲存
6. 選型號可自動帶入分類、品牌、匹數、室內外機、電壓
7. 刪除設備會一併刪除 `equipment.id` 相符的叫修案件，並有確認視窗
