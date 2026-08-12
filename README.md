# IESS 戰情室 Demo

以**原生 HTML / CSS / JavaScript** 撰寫（無 React、無建置步驟）。雙擊開啟 `index.html` 即可操作（需能連網載入 Tailwind CDN）。

## 檔案結構

依「基礎設施 → 資料 → 外框 → 功能」分層，各功能再依維修／工程／客戶分類。

```
index.html            頁面殼層（Tailwind CDN + 依序載入下列 script）
styles.css            全域樣式
src/
├── core/             基礎設施
│   ├── dom.js        h() 建立 DOM 的 helper、stateful 元件基座
│   ├── icons.js      內嵌 SVG 圖示（取代 lucide-react）
│   ├── store.js      極簡全域狀態容器（訂閱／通知重繪）
│   └── toast.js      右上角提示訊息
├── data/             純資料
│   ├── options.js    各下拉選項常數
│   └── seed.js       記憶體假資料（重整後重置）
├── shell/            外框
│   ├── header.js     頂部藍色列與主選單
│   └── sidebar.js    戰情室左側功能選單
├── features/         各功能模組
│   ├── repair/       維修服務：案件處理／叫修紀錄／銷案審核／保養進度
│   │   ├── case-list.js     案件列表（未結案）
│   │   ├── case-form.js     新增／編輯叫修案件
│   │   ├── case-record.js   叫修案件紀錄（日期查詢）
│   │   ├── case-review.js   案件銷案審核
│   │   ├── case-view.js     案件唯讀明細
│   │   └── maintenance.js   保養計劃進度（依客戶保養區間列示 + 檢視／編輯）
│   ├── project/      工程服務：工程立案／現勘表收集
│   │   ├── project-list.js     工程立案列表
│   │   ├── project-form.js     新增／編輯工程立案
│   │   ├── project-history.js  工程歷程／討論串 Modal
│   │   ├── survey-list.js      現勘表列表
│   │   └── survey-form.js      現勘表填寫（依類型動態欄位）
│   └── customer/     客戶建檔：客戶管理／門市管理
│       ├── customer-list.js  客戶列表
│       ├── customer-form.js  新增／編輯客戶（含多筆承辦）
│       ├── store-list.js     門市列表
│       └── store-form.js     新增／編輯門市（含承辦／照片／履歷）
└── app.js            進入點：全域狀態、外框佈局與 view 路由
```

## 架構說明

- **無框架、無建置**：以多個 `<script>` 依序載入，全部掛在單一全域命名空間 `window.IESS`（基礎設施）與少數 `window.*` 元件；可直接雙擊 `index.html` 開啟。
- **狀態管理**：跨頁資料（各案件集、目前選單、編輯中案件…）集中於 `store`，變動即整頁重繪；各表單的欄位暫存則由元件自身的 `stateful` 閉包管理。
- **輸入不跳游標**：`stateful` 在重繪後會依節點路徑還原聚焦與游標位置，故受控輸入每次變更皆可安全重繪。

## 功能說明

戰情室 → 維修服務（案件處理／叫修案件紀錄／保養計劃進度／案件銷案審核）、工程服務（工程立案／現勘表收集）、客戶建檔（客戶管理／門市管理）。
保養計劃進度只列出已達客戶「開始保養時間」（於開幕 N 個月後）的門市；門市開幕日期為必填。

資料為記憶體假資料，重整後重置。
