/*
 * data/seed.js — 記憶體假資料（重整後重置）
 *
 * 各資料集的初始內容，對應原本的 INITIAL_* 常數。
 * 依賴 data/options.js 內的日期常數（todayDate / yesterdayDate / twoDaysAgoDate）。
 */

// --- 初始模擬客戶列表 (客戶建檔) ---
const INITIAL_CUSTOMERS = [{
  id: 'CUST1',
  name: '屈臣氏',
  taxId: '12345678',
  principal: '王大明',
  serviceLevel: '保修(一年一次)',
  maintenanceInterval: '每半年',
  phone: '02-2712-3456',
  fax: '02-2712-3457',
  address: '台北市信義區松高路11號',
  remarks: '全台門市統一窗口。',
  enabled: true,
  createdDate: todayDate,
  contacts: [{
    id: 101,
    title: '設備課長',
    name: '林志明',
    phone: '0912-345-678',
    email: 'lin@watsons.example.com'
  }, {
    id: 102,
    title: '採購專員',
    name: '陳怡君',
    phone: '0922-111-222',
    email: 'chen@watsons.example.com'
  }]
}, {
  id: 'CUST2',
  name: '星巴克',
  taxId: '23456789',
  principal: '李美玲',
  serviceLevel: '保修(一年兩次)',
  maintenanceInterval: '每季',
  phone: '02-8780-1234',
  fax: '02-8780-1235',
  address: '台北市大安區復興南路一段39號',
  remarks: '',
  enabled: true,
  createdDate: yesterdayDate,
  contacts: [{
    id: 201,
    title: '營運經理',
    name: '張偉',
    phone: '0933-555-666',
    email: 'chang@starbucks.example.com'
  }]
}, {
  id: 'CUST3',
  name: '萊爾富',
  taxId: '34567890',
  principal: '吳建宏',
  serviceLevel: '保養(一年一次)',
  maintenanceInterval: '每年',
  phone: '03-322-8888',
  fax: '03-322-8889',
  address: '桃園市中壢區中央西路二段100號',
  remarks: '保養以桃竹苗門市優先排程。',
  enabled: true,
  createdDate: twoDaysAgoDate,
  contacts: []
}, {
  id: 'CUST4',
  name: '全家便利商店',
  taxId: '45678901',
  principal: '黃經理',
  serviceLevel: '維修(無簽約客戶)',
  maintenanceInterval: '每年',
  phone: '02-2521-6688',
  fax: '',
  address: '台北市中山區中山北路X號',
  remarks: '無簽約客戶，以單次維修為主。',
  enabled: false,
  createdDate: twoDaysAgoDate,
  contacts: []
}, {
  id: 'CUST5',
  name: '統一超商',
  taxId: '56789012',
  principal: '劉店長',
  serviceLevel: '維修(無簽約客戶)',
  maintenanceInterval: '每年',
  phone: '04-2223-8888',
  fax: '',
  address: '台中市中區建國路X號',
  remarks: '',
  enabled: true,
  createdDate: twoDaysAgoDate,
  contacts: []
}];

// --- 初始模擬門市列表 (客戶建檔 - 門市管理) ---
const INITIAL_STORES = [{
  id: 'STORE1',
  customerName: '屈臣氏',
  storeCode: 'WT-001',
  storeName: '台北信義店',
  serviceLevel: '保修(一年一次)',
  companyPhone: '02-2712-3456',
  companyFax: '02-2712-3457',
  companyCity: '台北市',
  companyDistrict: '信義區',
  companyAddress: '松智路X號',
  openDate: '2019-05-01',
  closeDate: '',
  storeStatus: '正常營業',
  workOrderApply: '是',
  lastRepairDate: yesterdayDate,
  lastMaintenanceDate: '2026-01-15',
  remarks: '一樓大廳需保持整潔，施工請走後門。',
  indoorHeight: '3.2m',
  outdoorHeight: '4.5m',
  createdDate: todayDate,
  contacts: [{
    id: 1101,
    title: '店長',
    name: '林店長',
    phone: '0912-345-678',
    email: 'xinyi@watsons.example.com'
  }],
  photos: [{
    id: 9101,
    name: '信義店_外觀.jpg',
    url: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="96"><rect width="128" height="96" fill="#e0e7ff"/><rect x="8" y="56" width="112" height="32" fill="#818cf8"/><circle cx="98" cy="26" r="14" fill="#fbbf24"/><polygon points="8,56 44,28 80,56" fill="#6366f1"/><text x="64" y="82" font-size="11" fill="#312e81" text-anchor="middle" font-family="sans-serif">信義店</text></svg>')
  }],
  history: [{
    id: 8101,
    workCategory: '緊急叫修',
    equipmentCategory: '分離式',
    equipmentName: '一號機 RAS-100',
    equipmentArea: '一樓大廳',
    repairItem: '室內機',
    repairReason: '不冷',
    assignee: 'A組',
    repairDate: yesterdayDate,
    closeDate: yesterdayDate
  }, {
    id: 8102,
    workCategory: '保養清潔',
    equipmentCategory: '箱型',
    equipmentName: '賣場主機 FXYP100',
    equipmentArea: '賣場區',
    repairItem: '濾網',
    repairReason: '定期保養',
    assignee: 'B組',
    repairDate: '2026-01-15',
    closeDate: '2026-01-16'
  }, {
    id: 8103,
    workCategory: '一般叫修',
    equipmentCategory: '分離式',
    equipmentName: '二號機 RAS-80',
    equipmentArea: '倉庫',
    repairItem: '室外機',
    repairReason: '異音',
    assignee: '協力廠商',
    repairDate: '2025-11-08',
    closeDate: '2025-11-10'
  }]
}, {
  id: 'STORE2',
  customerName: '屈臣氏',
  storeCode: 'WT-002',
  storeName: '台中旗艦店',
  serviceLevel: '保修(一年一次)',
  companyPhone: '04-2251-1234',
  companyFax: '04-2251-1235',
  companyCity: '台中市',
  companyDistrict: '西屯區',
  companyAddress: '台灣大道X號',
  openDate: '2020-11-20',
  closeDate: '',
  storeStatus: '正常營業',
  workOrderApply: '否',
  lastRepairDate: '2026-05-10',
  lastMaintenanceDate: '2026-03-02',
  remarks: '',
  indoorHeight: '3.5m',
  outdoorHeight: '5.0m',
  createdDate: yesterdayDate,
  contacts: [],
  photos: [],
  history: [{
    id: 8201,
    workCategory: '一般叫修',
    equipmentCategory: '箱型',
    equipmentName: '賣場空調 RAS-140',
    equipmentArea: '賣場區',
    repairItem: '室外機',
    repairReason: '異音',
    assignee: '協力廠商',
    repairDate: '2026-05-10',
    closeDate: '2026-05-12'
  }, {
    id: 8202,
    workCategory: '保養清潔',
    equipmentCategory: '箱型',
    equipmentName: '賣場空調 RAS-140',
    equipmentArea: '賣場區',
    repairItem: '濾網',
    repairReason: '定期保養',
    assignee: 'A組',
    repairDate: '2026-03-02',
    closeDate: '2026-03-02'
  }]
}, {
  id: 'STORE3',
  customerName: '星巴克',
  storeCode: 'SB-011',
  storeName: '站前店',
  serviceLevel: '保修(一年兩次)',
  companyPhone: '04-2223-8888',
  companyFax: '04-2223-8889',
  companyCity: '台中市',
  companyDistrict: '中區',
  companyAddress: '建國路X號',
  openDate: '2018-03-15',
  closeDate: '',
  storeStatus: '整裝',
  workOrderApply: '是',
  lastRepairDate: '2026-06-01',
  lastMaintenanceDate: '2026-04-20',
  remarks: '整裝期間僅開放夜間施工。',
  indoorHeight: '2.8m',
  outdoorHeight: '3.8m',
  createdDate: yesterdayDate,
  contacts: [{
    id: 1301,
    title: '營運經理',
    name: '張偉',
    phone: '0933-555-666',
    email: 'chang@starbucks.example.com'
  }],
  photos: [],
  history: [{
    id: 8301,
    workCategory: '一般叫修',
    equipmentCategory: '分離式',
    equipmentName: '吧台冷氣 FXMQ80',
    equipmentArea: '吧台區',
    repairItem: '室內機',
    repairReason: '異音',
    assignee: 'C組',
    repairDate: '2026-06-01',
    closeDate: '2026-06-03'
  }]
}, {
  id: 'STORE4',
  customerName: '星巴克',
  storeCode: 'SB-012',
  storeName: '中山店',
  serviceLevel: '保修(一年兩次)',
  companyPhone: '02-2521-6688',
  companyFax: '02-2521-6689',
  companyCity: '台北市',
  companyDistrict: '中山區',
  companyAddress: '中山北路X號',
  openDate: '2021-09-01',
  closeDate: '',
  storeStatus: '正常營業',
  workOrderApply: '否',
  lastRepairDate: '',
  lastMaintenanceDate: '2026-05-05',
  remarks: '',
  indoorHeight: '3.0m',
  outdoorHeight: '4.0m',
  createdDate: twoDaysAgoDate,
  contacts: [],
  photos: [],
  history: []
}, {
  id: 'STORE5',
  customerName: '萊爾富',
  storeCode: 'HL-021',
  storeName: '高雄左營店',
  serviceLevel: '保養(一年一次)',
  companyPhone: '07-345-2222',
  companyFax: '07-345-2223',
  companyCity: '高雄市',
  companyDistrict: '左營區',
  companyAddress: '博愛路X號',
  openDate: '2017-07-07',
  closeDate: '2026-06-30',
  storeStatus: '撤店',
  workOrderApply: '否',
  lastRepairDate: '2026-02-14',
  lastMaintenanceDate: '2025-12-01',
  remarks: '已於 2026/06/30 撤店，設備待回收。',
  indoorHeight: '2.6m',
  outdoorHeight: '3.5m',
  createdDate: twoDaysAgoDate,
  contacts: [],
  photos: [],
  history: [{
    id: 8501,
    workCategory: '一般叫修',
    equipmentCategory: '分離式',
    equipmentName: '賣場主機 RAS-100',
    equipmentArea: '賣場區',
    repairItem: '室外機',
    repairReason: '不冷',
    assignee: 'B組',
    repairDate: '2026-02-14',
    closeDate: '2026-02-15'
  }, {
    id: 8502,
    workCategory: '保養清潔',
    equipmentCategory: '窗型',
    equipmentName: '倉庫窗機 W-25',
    equipmentArea: '倉庫',
    repairItem: '濾網',
    repairReason: '定期保養',
    assignee: 'B組',
    repairDate: '2025-12-01',
    closeDate: '2025-12-01'
  }]
}, {
  id: 'STORE6',
  customerName: '全家便利商店',
  storeCode: 'FM-101',
  storeName: '中山店',
  serviceLevel: '維修(無簽約客戶)',
  companyPhone: '02-2521-6688',
  companyFax: '',
  companyCity: '台北市',
  companyDistrict: '中山區',
  companyAddress: '中山北路X號',
  openDate: '2016-04-01',
  closeDate: '',
  storeStatus: '正常營業',
  workOrderApply: '否',
  lastRepairDate: twoDaysAgoDate,
  lastMaintenanceDate: '',
  remarks: '',
  indoorHeight: '2.9m',
  outdoorHeight: '3.6m',
  createdDate: twoDaysAgoDate,
  contacts: [],
  photos: [],
  history: []
}, {
  id: 'STORE7',
  customerName: '全家便利商店',
  storeCode: 'FM-102',
  storeName: '站前店',
  serviceLevel: '維修(無簽約客戶)',
  companyPhone: '04-2223-8888',
  companyFax: '',
  companyCity: '台中市',
  companyDistrict: '中區',
  companyAddress: '建國路X號',
  openDate: '2018-08-10',
  closeDate: '',
  storeStatus: '正常營業',
  workOrderApply: '否',
  lastRepairDate: twoDaysAgoDate,
  lastMaintenanceDate: '',
  remarks: '',
  indoorHeight: '2.7m',
  outdoorHeight: '3.4m',
  createdDate: twoDaysAgoDate,
  contacts: [],
  photos: [],
  history: []
}, {
  id: 'STORE8',
  customerName: '統一超商',
  storeCode: 'UC-201',
  storeName: '中山店',
  serviceLevel: '維修(無簽約客戶)',
  companyPhone: '02-2521-6688',
  companyFax: '',
  companyCity: '台北市',
  companyDistrict: '中山區',
  companyAddress: '中山北路X號',
  openDate: '2015-02-20',
  closeDate: '',
  storeStatus: '正常營業',
  workOrderApply: '否',
  lastRepairDate: twoDaysAgoDate,
  lastMaintenanceDate: '',
  remarks: '',
  indoorHeight: '2.8m',
  outdoorHeight: '3.5m',
  createdDate: twoDaysAgoDate,
  contacts: [],
  photos: [],
  history: []
}, {
  id: 'STORE9',
  customerName: '統一超商',
  storeCode: 'UC-202',
  storeName: '站前店',
  serviceLevel: '維修(無簽約客戶)',
  companyPhone: '04-2223-8888',
  companyFax: '',
  companyCity: '台中市',
  companyDistrict: '中區',
  companyAddress: '建國路X號',
  openDate: '2017-11-05',
  closeDate: '',
  storeStatus: '正常營業',
  workOrderApply: '否',
  lastRepairDate: todayDate,
  lastMaintenanceDate: '',
  remarks: '',
  indoorHeight: '2.7m',
  outdoorHeight: '3.3m',
  createdDate: todayDate,
  contacts: [],
  photos: [],
  history: []
}];

// --- 初始模擬設備列表 (客戶建檔 - 設備管理) ---
const INITIAL_EQUIPMENTS = [{
  id: 'E1',
  customerName: '星巴克',
  storeName: '站前店',
  category: '分離式',
  brand: '日立',
  deviceName: '分離式冷氣',
  name: '分離式冷氣',
  specification: '3.5匹',
  model: 'RAS-100',
  area: '頂樓',
  manufactureDate: '2023-05-10',
  installDate: '2023-06-01',
  assetNumber: 'AST-SB-001',
  serialNumber: 'SN-SB-001',
  status: '運轉',
  createdDate: yesterdayDate
}, {
  id: 'E2',
  customerName: '屈臣氏',
  storeName: '台北信義店',
  category: '分離式',
  brand: '日立',
  deviceName: '分離式冷氣',
  name: '分離式冷氣',
  specification: '3.5匹',
  model: 'RAS-100',
  area: '一樓大廳',
  manufactureDate: '2022-03-15',
  installDate: '2022-04-01',
  assetNumber: 'AST-WT-001',
  serialNumber: 'SN-WT-001',
  status: '運轉',
  createdDate: todayDate
}, {
  id: 'E2b',
  customerName: '屈臣氏',
  storeName: '台北信義店',
  category: '分離式',
  brand: '日立',
  deviceName: '分離式冷氣',
  name: '分離式冷氣',
  specification: '2.0匹',
  model: 'RAS-50',
  area: '倉庫',
  manufactureDate: '2022-08-20',
  installDate: '2022-09-01',
  assetNumber: 'AST-WT-002',
  serialNumber: 'SN-WT-002',
  status: '運轉',
  createdDate: yesterdayDate
}, {
  id: 'E3',
  customerName: '萊爾富',
  storeName: '高雄左營店',
  category: '分離式',
  brand: '大金',
  deviceName: '吊隱式冷氣',
  name: '吊隱式冷氣',
  specification: '4.0匹',
  model: 'FXYP100',
  area: '賣場區',
  manufactureDate: '2021-11-01',
  installDate: '2021-12-15',
  assetNumber: 'AST-HF-001',
  serialNumber: 'SN-HF-001',
  status: '運轉',
  createdDate: twoDaysAgoDate
}, {
  id: 'E4',
  customerName: '全家便利商店',
  storeName: '中山店',
  category: '分離式',
  brand: '大金',
  deviceName: '卡式嵌入機',
  name: '卡式嵌入機',
  specification: '4.0匹',
  model: 'FXMQ125',
  area: '收銀台上方',
  manufactureDate: '2021-06-01',
  installDate: '2021-07-15',
  assetNumber: 'AST-FM-001',
  serialNumber: 'SN-FM-001',
  status: '運轉',
  createdDate: twoDaysAgoDate
}, {
  id: 'E5',
  customerName: '統一超商',
  storeName: '站前店',
  category: '分離式',
  brand: '大金',
  deviceName: '卡式嵌入機',
  name: '卡式嵌入機',
  specification: '2.5匹',
  model: 'FXMQ80',
  area: '休息區',
  manufactureDate: '2022-01-10',
  installDate: '2022-02-20',
  assetNumber: 'AST-UC-001',
  serialNumber: 'SN-UC-001',
  status: '轉汰換',
  createdDate: yesterdayDate
}, {
  id: 'E6',
  customerName: '屈臣氏',
  storeName: '台中旗艦店',
  category: '冰水',
  brand: '三菱重工',
  deviceName: '冰水主機',
  name: '冰水主機',
  specification: '5.0匹',
  model: 'PA-063',
  area: '機房',
  manufactureDate: '2020-01-10',
  installDate: '2020-03-01',
  assetNumber: 'AST-WT-TC-001',
  serialNumber: 'SN-WT-TC-001',
  status: '運轉',
  createdDate: todayDate
}, {
  id: 'E7',
  customerName: '星巴克',
  storeName: '中山店',
  category: '分離式',
  brand: '日立',
  deviceName: '分離式冷氣',
  name: '分離式冷氣',
  specification: '2.5匹',
  model: 'RAS-80',
  area: '大廳',
  manufactureDate: '2019-04-01',
  installDate: '2019-05-15',
  assetNumber: 'AST-SB-002',
  serialNumber: 'SN-SB-002',
  status: '已汰換',
  createdDate: twoDaysAgoDate
}, {
  id: 'E8',
  customerName: '統一超商',
  storeName: '中山店',
  category: '分離式',
  brand: '大金',
  deviceName: '卡式嵌入機',
  name: '卡式嵌入機',
  specification: '2.0匹',
  model: 'FXMQ50',
  area: '收銀台',
  manufactureDate: '2020-08-20',
  installDate: '2020-09-10',
  assetNumber: 'AST-UC-002',
  serialNumber: 'SN-UC-002',
  status: '運轉',
  createdDate: twoDaysAgoDate
}, {
  id: 'E9',
  customerName: '全家便利商店',
  storeName: '站前店',
  category: '分離式',
  brand: '日立',
  deviceName: '分離式冷氣',
  name: '分離式冷氣',
  specification: '3.0匹',
  model: 'RAS-80',
  area: '頂樓',
  manufactureDate: '2018-11-05',
  installDate: '2018-12-01',
  assetNumber: 'AST-FM-002',
  serialNumber: 'SN-FM-002',
  status: '運轉',
  createdDate: twoDaysAgoDate
}];

// --- 初始模擬案件列表 (維修) ---
const INITIAL_CASES = [{
  id: 'C20260709001',
  indicator: 'urgent',
  repairDate: todayDate,
  caseNumber: '20260709001',
  customerName: '屈臣氏',
  storeName: '台北信義店',
  workCategory: '緊急叫修',
  repairItem: '室內機',
  repairReason: '漏水',
  faultDesc: '室內機狂滴水，影響營業',
  actualReason: '',
  assignee: 'A組',
  processStatus: '待料件',
  isClosed: false,
  serviceLevel: '保修(一年一次)',
  storeAddress: '台北市信義區松智路X號',
  reporter: '林店長',
  equipment: null,
  processRecords: [],
  reRepairDate: '',
  secondRepairDate: '',
  completionDate: '',
  expectedDate: todayDate,
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isPerformanceIncluded: false
}, {
  id: 'C20260708002',
  indicator: 'overdue',
  repairDate: yesterdayDate,
  caseNumber: '20260708002',
  customerName: '星巴克',
  storeName: '站前店',
  workCategory: '一般叫修',
  repairItem: '室外機',
  repairReason: '異音',
  faultDesc: '室外機運轉聲音很大',
  actualReason: '風扇軸承老化',
  assignee: '協力廠商',
  processStatus: '待報價',
  isClosed: false,
  serviceLevel: '保修(一年兩次)',
  storeAddress: '台中市中區建國路X號',
  reporter: '陳副理',
  equipment: {
    id: 'E1',
    customerName: '星巴克',
    storeName: '站前店',
    area: '頂樓',
    type: '外',
    model: 'RAS-100'
  },
  processRecords: [],
  reRepairDate: '',
  secondRepairDate: '',
  completionDate: '',
  expectedDate: yesterdayDate,
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isPerformanceIncluded: false
}, {
  id: 'C20260707003',
  indicator: 'normal',
  repairDate: yesterdayDate,
  caseNumber: '20260707003',
  customerName: '萊爾富',
  storeName: '高雄左營店',
  workCategory: '保養清潔',
  repairItem: '風管',
  repairReason: '異味',
  faultDesc: '開冷氣有霉味',
  actualReason: '風管內部積塵過多，導致霉味',
  assignee: 'B組',
  processStatus: '案件完成',
  isClosed: false,
  serviceLevel: '保養(一年一次)',
  storeAddress: '高雄市左營區博愛路X號',
  reporter: '張小姐',
  equipment: {
    id: 'E3',
    customerName: '萊爾富',
    storeName: '高雄左營店',
    area: '賣場區',
    type: '內',
    model: 'FXYP100'
  },
  processRecords: [{
    id: 1,
    category1: '工資',
    category2: '分離式',
    category3: '保養工資',
    qty: 1
  }],
  reRepairDate: yesterdayDate,
  secondRepairDate: '',
  completionDate: todayDate,
  expectedDate: todayDate,
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isPerformanceIncluded: false
}, {
  id: 'C20260706004',
  indicator: 'normal',
  repairDate: twoDaysAgoDate,
  caseNumber: '20260706004',
  customerName: '全家便利商店',
  storeName: '中山店',
  workCategory: '一般叫修',
  repairItem: '室內機',
  repairReason: '不冷',
  faultDesc: '出風口沒有冷風',
  actualReason: '濾網過髒導致風量不足',
  assignee: '晉詮人員',
  processStatus: '案件完成',
  isClosed: true,
  serviceLevel: '維修(無簽約客戶)',
  storeAddress: '台北市中山區中山北路X號',
  reporter: '李先生',
  equipment: {
    id: 'E4',
    customerName: '全家便利商店',
    storeName: '中山店',
    area: '收銀台上方',
    type: '內',
    model: 'FXMQ125'
  },
  processRecords: [{
    id: 1,
    category1: '工資',
    category2: '分離式',
    category3: '檢修工資',
    qty: 1
  }, {
    id: 2,
    category1: '材料',
    category2: '保養材料',
    category3: '過濾網',
    qty: 2
  }],
  reRepairDate: '',
  secondRepairDate: '',
  completionDate: twoDaysAgoDate,
  expectedDate: yesterdayDate,
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isPerformanceIncluded: true
}, {
  id: 'C20260710005',
  indicator: 'normal',
  repairDate: todayDate,
  caseNumber: '20260710005',
  customerName: '統一超商',
  storeName: '站前店',
  workCategory: '一般叫修',
  repairItem: '室內機',
  repairReason: '漏水',
  faultDesc: '機台下方會漏水',
  actualReason: '排水管阻塞',
  assignee: 'C組',
  processStatus: '案件完成',
  isClosed: true,
  serviceLevel: '維修(無簽約客戶)',
  storeAddress: '台中市中區建國路X號',
  reporter: '王專員',
  equipment: {
    id: 'E5',
    customerName: '統一超商',
    storeName: '站前店',
    area: '休息區',
    type: '內',
    model: 'FXMQ80'
  },
  processRecords: [{
    id: 1,
    category1: '工資',
    category2: '分離式',
    category3: '檢修工資',
    qty: 1
  }],
  reRepairDate: '',
  secondRepairDate: '',
  completionDate: todayDate,
  expectedDate: todayDate,
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isPerformanceIncluded: false
}, {
  id: 'C20260713006',
  indicator: 'normal',
  repairDate: todayDate,
  caseNumber: '20260713006',
  customerName: '屈臣氏',
  storeName: '台中旗艦店',
  workCategory: '一般叫修',
  repairItem: '室內機',
  repairReason: '不冷',
  faultDesc: '冷氣不冷，待排程',
  actualReason: '',
  assignee: '案件待辦',
  processStatus: '尚未處理完成',
  isClosed: false,
  serviceLevel: '保修(一年一次)',
  storeAddress: '台中市西屯區台灣大道X號',
  reporter: '林店長',
  equipment: null,
  processRecords: [],
  reRepairDate: '',
  secondRepairDate: '',
  completionDate: '',
  expectedDate: '',
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isPerformanceIncluded: false
}, {
  id: 'C20260713007',
  indicator: 'normal',
  repairDate: todayDate,
  caseNumber: '20260713007',
  customerName: '屈臣氏',
  storeName: '台北信義店',
  workCategory: '一般叫修',
  repairItem: '室內機',
  repairReason: '不冷',
  faultDesc: '冷氣不冷，已排程',
  actualReason: '',
  assignee: 'B組',
  processStatus: '尚未處理完成',
  isClosed: false,
  serviceLevel: '保修(一年一次)',
  storeAddress: '台北市信義區松智路X號',
  reporter: '林店長',
  equipment: null,
  processRecords: [],
  reRepairDate: '',
  secondRepairDate: '',
  completionDate: '',
  expectedDate: todayDate,
  planDate: todayDate,
  planTimeStart: '13:00',
  planTimeEnd: '15:00',
  isPerformanceIncluded: false
}, {
  id: 'C20260705008',
  indicator: 'normal',
  repairDate: twoDaysAgoDate,
  caseNumber: '20260705008',
  customerName: '萊爾富',
  storeName: '高雄左營店',
  workCategory: '一般叫修',
  repairItem: '室外機',
  repairReason: '不冷',
  faultDesc: '室外機無法啟動',
  actualReason: '壓縮機故障已更換',
  assignee: 'A組',
  processStatus: '案件完成',
  isClosed: true,
  serviceLevel: '保養(一年一次)',
  storeAddress: '高雄市左營區博愛路X號',
  reporter: '林店長',
  equipment: {
    id: 'E3',
    customerName: '萊爾富',
    storeName: '高雄左營店',
    area: '賣場區',
    type: '外',
    model: 'FXYP100'
  },
  processRecords: [],
  reRepairDate: '',
  secondRepairDate: '',
  completionDate: twoDaysAgoDate,
  expectedDate: twoDaysAgoDate,
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isPerformanceIncluded: true
}, {
  id: 'C20260704009',
  indicator: 'normal',
  repairDate: twoDaysAgoDate,
  caseNumber: '20260704009',
  customerName: '星巴克',
  storeName: '中山店',
  workCategory: '一般叫修',
  repairItem: '室內機',
  repairReason: '異音',
  faultDesc: '室內機運轉異音',
  actualReason: '風扇馬達更換',
  assignee: 'A組',
  processStatus: '案件完成',
  isClosed: true,
  serviceLevel: '保修(一年兩次)',
  storeAddress: '台北市中山區中山北路X號',
  reporter: '陳副理',
  equipment: {
    id: 'E7',
    customerName: '星巴克',
    storeName: '中山店',
    area: '大廳',
    type: '內',
    model: 'RAS-80'
  },
  processRecords: [],
  reRepairDate: '',
  secondRepairDate: '',
  completionDate: todayDate,
  expectedDate: todayDate,
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isPerformanceIncluded: true
}, {
  id: 'C20260703010',
  indicator: 'normal',
  repairDate: twoDaysAgoDate,
  caseNumber: '20260703010',
  customerName: '屈臣氏',
  storeName: '台中旗艦店',
  workCategory: '保養清潔',
  repairItem: '風管',
  repairReason: '異味',
  faultDesc: '風管清潔保養',
  actualReason: '完成風管清潔',
  assignee: 'B組',
  processStatus: '案件完成',
  isClosed: true,
  serviceLevel: '保修(一年一次)',
  storeAddress: '台中市西屯區台灣大道X號',
  reporter: '張小姐',
  equipment: {
    id: 'E6',
    customerName: '屈臣氏',
    storeName: '台中旗艦店',
    area: '機房',
    type: '無',
    model: 'PA-063'
  },
  processRecords: [],
  reRepairDate: '',
  secondRepairDate: '',
  completionDate: todayDate,
  expectedDate: todayDate,
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isPerformanceIncluded: true
}, {
  id: 'C20260702011',
  indicator: 'normal',
  repairDate: twoDaysAgoDate,
  caseNumber: '20260702011',
  customerName: '統一超商',
  storeName: '中山店',
  workCategory: '一般叫修',
  repairItem: '控制面板',
  repairReason: '溫控故障',
  faultDesc: '溫控面板無反應',
  actualReason: '面板更換',
  assignee: 'C組',
  processStatus: '案件完成',
  isClosed: true,
  serviceLevel: '維修(無簽約客戶)',
  storeAddress: '台北市中山區中山北路X號',
  reporter: '王專員',
  equipment: {
    id: 'E8',
    customerName: '統一超商',
    storeName: '中山店',
    area: '收銀台',
    type: '內',
    model: 'FXMQ50'
  },
  processRecords: [],
  reRepairDate: '',
  secondRepairDate: '',
  completionDate: todayDate,
  expectedDate: todayDate,
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isPerformanceIncluded: true
}, {
  id: 'C20260701012',
  indicator: 'normal',
  repairDate: twoDaysAgoDate,
  caseNumber: '20260701012',
  customerName: '全家便利商店',
  storeName: '站前店',
  workCategory: '一般叫修',
  repairItem: '室外機',
  repairReason: '跳機',
  faultDesc: '室外機頻繁跳機',
  actualReason: '冷媒補充完成',
  assignee: '協力廠商',
  processStatus: '案件完成',
  isClosed: true,
  serviceLevel: '維修(無簽約客戶)',
  storeAddress: '台中市中區建國路X號',
  reporter: '李先生',
  equipment: {
    id: 'E9',
    customerName: '全家便利商店',
    storeName: '站前店',
    area: '頂樓',
    type: '外',
    model: 'RAS-80'
  },
  processRecords: [],
  reRepairDate: '',
  secondRepairDate: '',
  completionDate: todayDate,
  expectedDate: todayDate,
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isPerformanceIncluded: true
}];

function caseHasProcessData(c) {
  if (!c) return false;
  if (c.actualReason && String(c.actualReason).trim()) return true;
  if (c.processRecords && c.processRecords.length > 0) return true;
  if (c.processStatus) return true;
  if (c.reRepairDate) return true;
  if (c.completionDate) return true;
  if (c.secondRepairDate) return true;
  return false;
}

function snapshotCaseEquipment(equipmentRef) {
  if (!equipmentRef) return null;
  var master = null;
  if (equipmentRef.id) {
    master = INITIAL_EQUIPMENTS.find(function (e) { return e.id === equipmentRef.id; });
  }
  if (!master && equipmentRef.customerName && equipmentRef.storeName) {
    var matched = INITIAL_EQUIPMENTS.filter(function (e) {
      return e.customerName === equipmentRef.customerName && e.storeName === equipmentRef.storeName;
    });
    if (matched.length === 1) master = matched[0];
  }
  return master ? Object.assign({}, master) : equipmentRef;
}

INITIAL_CASES.forEach(function (c, i) {
  if (!c.createdAt) {
    var hour = 8 + (i % 10);
    var minute = (i * 11) % 60;
    c.createdAt = c.repairDate + 'T' + String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ':00';
  }
  c.repairDate = IESS.caseDateTime.format(c.createdAt || c.repairDate);
  ['reRepairDate', 'secondRepairDate', 'completionDate', 'closeDate'].forEach(function (field) {
    if (c[field]) c[field] = IESS.caseDateTime.format(c[field]);
  });
  if (c.isClosed && !c.closeDate) {
    c.closeDate = c.completionDate || c.repairDate || '';
  }
  if (c.equipment) {
    c.equipment = snapshotCaseEquipment(c.equipment);
  }
  if (!c.equipment) {
    if (!c.isClosed) c.processStatus = null;
    if (caseHasProcessData(c)) {
      c.actualReason = '';
      c.processRecords = [];
      c.processStatus = null;
      c.reRepairDate = '';
      c.secondRepairDate = '';
      c.completionDate = '';
    }
  }
  if (c.isListClosed == null) c.isListClosed = false;
});

// --- 初始模擬保養計畫列表 ---
const INITIAL_MAINTENANCE_CASES = [{
  id: 'M2026070001',
  caseNumber: '',
  customerName: '屈臣氏',
  storeName: '台北信義店',
  serviceLevel: '保修(一年一次)',
  status: '未保養',
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  dueMonth: currentMonthStr,
  workCategory: '保養',
  assignee: '尚未指派',
  isClosed: false,
  storeAddress: '台北市信義區松智路X號'
}, {
  id: 'M2026070002',
  caseNumber: `${todayDate.replace(/-/g, '')}002`,
  customerName: '星巴克',
  storeName: '中山店',
  serviceLevel: '保修(一年兩次)',
  status: '已預約',
  planDate: todayDate,
  planTimeStart: '09:00',
  planTimeEnd: '11:00',
  workCategory: '保養',
  assignee: 'A組',
  isClosed: false,
  storeAddress: '台北市中山區中山北路X號'
}, {
  id: 'M2026070003',
  caseNumber: `${yesterdayDate.replace(/-/g, '')}003`,
  customerName: '萊爾富',
  storeName: '高雄左營店',
  serviceLevel: '保養(一年一次)',
  status: '已完成',
  planDate: yesterdayDate,
  planTimeStart: '14:00',
  planTimeEnd: '16:00',
  completionDate: yesterdayDate + ' 16:00:00',
  assignee: '協力廠商',
  isClosed: false,
  storeAddress: '高雄市左營區博愛路X號'
}];

// --- 初始模擬工程立案列表 ---
const INITIAL_PROJECT_CASES = [{
  id: 'P20260710001',
  projectNumber: `${todayDate.replace(/-/g, '')}001`,
  creationDate: todayDate,
  customerName: '全家便利商店',
  storeName: '中山店',
  workCategory: '新開',
  currentStage: '現勘',
  stageDate: todayDate,
  stageAssignee: '王小明',
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isClosed: false,
  history: [{
    stage: '立案時間',
    date: todayDate,
    assignee: '系統管理員'
  }, {
    stage: '工程發包作業',
    date: todayDate,
    assignee: '王小明'
  }, {
    stage: '現勘',
    date: todayDate,
    assignee: '王小明'
  }],
  comments: [{
    id: 1,
    author: '系統管理員',
    timestamp: `${todayDate} 09:00`,
    content: '工程已立案，請王小明協助後續。',
    attachment: null
  }, {
    id: 2,
    author: '王小明',
    timestamp: `${todayDate} 10:30`,
    content: '@王小明 已安排發包，請確認 #現勘 時間。',
    attachment: '發包明細.pdf'
  }],
  details: {
    storeAddress: '台北市中山區中山北路X號',
    serviceLevel: '維修(無簽約客戶)',
    contactPerson: '王小明',
    suggestedContractor: '內部工程組',
    entryDate: todayDate,
    remarks: '需避開營業尖峰時段',
    equipment: [{
      id: 1,
      category: '分離式',
      brand: '大金',
      deviceName: '卡式嵌入機',
      specification: '4.0匹',
      model: 'FXMQ125',
      area: '賣場區',
      assetNumber: 'A-001',
      serialNumber: '',
      manufactureDate: '',
      installDate: ''
    }]
  }
}, {
  id: 'P20260710002',
  projectNumber: `${yesterdayDate.replace(/-/g, '')}002`,
  creationDate: yesterdayDate,
  customerName: '星巴克',
  storeName: '站前店',
  workCategory: '整裝',
  currentStage: '設備訂貨作業',
  stageDate: todayDate,
  stageAssignee: '王小明',
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isClosed: false,
  history: [{
    stage: '立案時間',
    date: yesterdayDate,
    assignee: '系統管理員'
  }, {
    stage: '工程發包作業',
    date: yesterdayDate,
    assignee: '王小明'
  }, {
    stage: '現勘',
    date: todayDate,
    assignee: '王小明'
  }, {
    stage: '設備訂貨作業',
    date: todayDate,
    assignee: '王小明'
  }],
  comments: [],
  details: {
    storeAddress: '台中市中區建國路X號',
    serviceLevel: '保修(一年兩次)',
    contactPerson: '王小明',
    suggestedContractor: '機電維護商',
    entryDate: yesterdayDate,
    remarks: '',
    equipment: []
  }
}, {
  id: 'P20260713003',
  projectNumber: `${todayDate.replace(/-/g, '')}003`,
  creationDate: todayDate,
  customerName: '萊爾富',
  storeName: '高雄左營店',
  workCategory: '汰換',
  currentStage: '現勘',
  stageDate: todayDate,
  stageAssignee: '',
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isClosed: false,
  history: [{ stage: '立案時間', date: todayDate, assignee: '系統管理員' }],
  comments: [],
  details: {
    storeAddress: '高雄市左營區博愛路X號',
    serviceLevel: '保養(一年一次)',
    contactPerson: '',
    suggestedContractor: '',
    entryDate: todayDate,
    remarks: '',
    equipment: []
  }
}, {
  id: 'P20260615004',
  projectNumber: `${twoDaysAgoDate.replace(/-/g, '')}004`,
  creationDate: twoDaysAgoDate,
  customerName: '屈臣氏',
  storeName: '台北信義店',
  workCategory: '汰換',
  currentStage: '發票請款作業',
  stageDate: todayDate,
  stageAssignee: '王小明',
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isClosed: true,
  closeDate: todayDate,
  history: [{
    stage: '立案時間',
    date: twoDaysAgoDate,
    assignee: '系統管理員'
  }, {
    stage: '工程發包作業',
    date: twoDaysAgoDate,
    assignee: '王小明'
  }, {
    stage: '現勘',
    date: yesterdayDate,
    assignee: '王小明'
  }, {
    stage: '設備訂貨作業',
    date: yesterdayDate,
    assignee: '王小明'
  }, {
    stage: '廠商驗收作業',
    date: todayDate,
    assignee: '王小明'
  }, {
    stage: '客戶驗收',
    date: todayDate,
    assignee: '王小明'
  }, {
    stage: '發票請款作業',
    date: todayDate,
    assignee: '王小明'
  }],
  comments: [],
  details: {
    storeAddress: '台北市信義區松智路X號',
    serviceLevel: '保修(一年一次)',
    contactPerson: '林店長',
    suggestedContractor: '機電維護商',
    entryDate: twoDaysAgoDate,
    remarks: '賣場主機汰換，夜間施工',
    equipment: [{
      id: 1,
      category: '箱型',
      brand: '大金',
      deviceName: '賣場空調',
      specification: '5.0匹',
      model: 'FXYP140',
      area: '賣場區',
      assetNumber: 'WT-001-A1',
      serialNumber: '',
      manufactureDate: '',
      installDate: ''
    }]
  }
}, {
  id: 'P20260620005',
  projectNumber: `${yesterdayDate.replace(/-/g, '')}005`,
  creationDate: yesterdayDate,
  customerName: '屈臣氏',
  storeName: '台中旗艦店',
  workCategory: '加裝',
  currentStage: '發票請款作業',
  stageDate: todayDate,
  stageAssignee: '王小明',
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isClosed: true,
  closeDate: todayDate,
  history: [{
    stage: '立案時間',
    date: yesterdayDate,
    assignee: '系統管理員'
  }, {
    stage: '工程發包作業',
    date: yesterdayDate,
    assignee: '王小明'
  }, {
    stage: '現勘',
    date: yesterdayDate,
    assignee: '王小明'
  }, {
    stage: '設備訂貨作業',
    date: todayDate,
    assignee: '王小明'
  }, {
    stage: '廠商驗收作業',
    date: todayDate,
    assignee: '王小明'
  }, {
    stage: '客戶驗收',
    date: todayDate,
    assignee: '王小明'
  }, {
    stage: '發票請款作業',
    date: todayDate,
    assignee: '王小明'
  }],
  comments: [],
  details: {
    storeAddress: '台中市西屯區台灣大道X號',
    serviceLevel: '保修(一年一次)',
    contactPerson: '張小姐',
    suggestedContractor: '內部工程組',
    entryDate: yesterdayDate,
    remarks: '倉庫區加裝分離式冷氣',
    equipment: []
  }
}, {
  id: 'P20260625006',
  projectNumber: `${todayDate.replace(/-/g, '')}006`,
  creationDate: twoDaysAgoDate,
  customerName: '統一超商',
  storeName: '站前店',
  workCategory: '新開',
  currentStage: '發票請款作業',
  stageDate: todayDate,
  stageAssignee: '王小明',
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isClosed: true,
  closeDate: todayDate,
  history: [{
    stage: '立案時間',
    date: twoDaysAgoDate,
    assignee: '系統管理員'
  }, {
    stage: '工程發包作業',
    date: twoDaysAgoDate,
    assignee: '王小明'
  }, {
    stage: '現勘',
    date: yesterdayDate,
    assignee: '王小明'
  }, {
    stage: '設備訂貨作業',
    date: yesterdayDate,
    assignee: '王小明'
  }, {
    stage: '廠商驗收作業',
    date: todayDate,
    assignee: '王小明'
  }, {
    stage: '客戶驗收',
    date: todayDate,
    assignee: '王小明'
  }, {
    stage: '發票請款作業',
    date: todayDate,
    assignee: '王小明'
  }],
  comments: [],
  details: {
    storeAddress: '台中市中區建國路X號',
    serviceLevel: '維修(無簽約客戶)',
    contactPerson: '王專員',
    suggestedContractor: '協力廠商',
    entryDate: twoDaysAgoDate,
    remarks: '新開店空調工程',
    equipment: []
  }
}, {
  id: 'P20260610007',
  projectNumber: `${twoDaysAgoDate.replace(/-/g, '')}007`,
  creationDate: oneMonthAgoDate,
  customerName: '全家便利商店',
  storeName: '中山店',
  workCategory: '撤店',
  currentStage: '發票請款作業',
  stageDate: twoDaysAgoDate,
  stageAssignee: '王小明',
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isClosed: true,
  closeDate: twoDaysAgoDate,
  history: [{
    stage: '立案時間',
    date: oneMonthAgoDate,
    assignee: '系統管理員'
  }, {
    stage: '工程發包作業',
    date: oneMonthAgoDate,
    assignee: '王小明'
  }, {
    stage: '現勘',
    date: oneMonthAgoDate,
    assignee: '王小明'
  }, {
    stage: '設備訂貨作業',
    date: yesterdayDate,
    assignee: '王小明'
  }, {
    stage: '廠商驗收作業',
    date: twoDaysAgoDate,
    assignee: '王小明'
  }, {
    stage: '客戶驗收',
    date: twoDaysAgoDate,
    assignee: '王小明'
  }, {
    stage: '發票請款作業',
    date: twoDaysAgoDate,
    assignee: '王小明'
  }],
  comments: [],
  details: {
    storeAddress: '台北市中山區中山北路X號',
    serviceLevel: '維修(無簽約客戶)',
    contactPerson: '李先生',
    suggestedContractor: '內部工程組',
    entryDate: oneMonthAgoDate,
    remarks: '設備拆除回收',
    equipment: []
  }
}, {
  id: 'P20260701008',
  projectNumber: `${todayDate.replace(/-/g, '')}008`,
  creationDate: yesterdayDate,
  customerName: '星巴克',
  storeName: '中山店',
  workCategory: '整裝',
  currentStage: '發票請款作業',
  stageDate: todayDate,
  stageAssignee: '王小明',
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isClosed: true,
  closeDate: todayDate,
  history: [{
    stage: '立案時間',
    date: yesterdayDate,
    assignee: '系統管理員'
  }, {
    stage: '工程發包作業',
    date: yesterdayDate,
    assignee: '王小明'
  }, {
    stage: '現勘',
    date: yesterdayDate,
    assignee: '王小明'
  }, {
    stage: '設備訂貨作業',
    date: todayDate,
    assignee: '王小明'
  }, {
    stage: '廠商驗收作業',
    date: todayDate,
    assignee: '王小明'
  }, {
    stage: '客戶驗收',
    date: todayDate,
    assignee: '王小明'
  }, {
    stage: '發票請款作業',
    date: todayDate,
    assignee: '王小明'
  }],
  comments: [],
  details: {
    storeAddress: '台北市中山區中山北路X號',
    serviceLevel: '保修(一年兩次)',
    contactPerson: '陳副理',
    suggestedContractor: '機電維護商',
    entryDate: yesterdayDate,
    remarks: '吧台區空調整裝',
    equipment: []
  }
}];

// --- 初始人員動向 ---
const INITIAL_PERSONNEL_STATUS = [{
  id: 'PS1',
  assignee: 'A組',
  date: todayDate,
  timeStart: '09:00',
  timeEnd: '11:00',
  customerName: '星巴克',
  storeName: '中山店',
  workCategory: '保養',
  sourceType: 'maintenance',
  sourceId: 'M2026070002'
}, {
  id: 'PS2',
  assignee: 'B組',
  date: todayDate,
  timeStart: '13:00',
  timeEnd: '15:00',
  customerName: '屈臣氏',
  storeName: '台北信義店',
  workCategory: '一般叫修',
  sourceType: 'repair',
  sourceId: 'C20260713007'
}];

// --- 初始模擬現勘表列表 ---
const INITIAL_SURVEY_CASES = [{
  id: 'S20260710001',
  fillDate: todayDate,
  customerName: '全家便利商店',
  storeName: '中山店',
  surveyData: { projectType: '新開', locationArea: '百貨' },
  fileName: '全家便利商店_中山店'
}, {
  id: 'S20260709002',
  fillDate: yesterdayDate,
  customerName: '星巴克',
  storeName: '站前店',
  surveyData: { equipmentList: [{ category: '分離式冷氣', brand: '大金', name: '室外機', model: 'RXQ10', area: '後場' }] },
  fileName: '星巴克_站前店'
}];

function syncRecordStoreFields(record, stores) {
  if (!record || !stores) return;
  var store = stores.find(function (s) {
    return s.customerName === record.customerName && s.storeName === record.storeName;
  });
  if (!store) return;
  record.companyCity = store.companyCity;
  record.companyDistrict = store.companyDistrict;
  record.serviceLevel = store.serviceLevel;
  record.storeAddress = StoreUtils.buildFullAddress(store);
}

function syncProjectStoreFields(project, stores) {
  syncRecordStoreFields(project, stores);
  if (!project.details) return;
  var store = stores.find(function (s) {
    return s.customerName === project.customerName && s.storeName === project.storeName;
  });
  if (!store) return;
  project.details.storeAddress = StoreUtils.buildFullAddress(store);
  project.details.serviceLevel = store.serviceLevel;
}

INITIAL_CASES.forEach(function (c) { syncRecordStoreFields(c, INITIAL_STORES); });
INITIAL_MAINTENANCE_CASES.forEach(function (c) {
  syncRecordStoreFields(c, INITIAL_STORES);
  if (c.completionDate) c.completionDate = IESS.caseDateTime.format(c.completionDate);
  if (c.closeDate) c.closeDate = IESS.caseDateTime.format(c.closeDate);
});
INITIAL_PROJECT_CASES.forEach(function (c) {
  syncProjectStoreFields(c, INITIAL_STORES);
  if (c.closeDate) c.closeDate = IESS.caseDateTime.format(c.closeDate);
});
INITIAL_PERSONNEL_STATUS.forEach(function (c) { syncRecordStoreFields(c, INITIAL_STORES); });
INITIAL_SURVEY_CASES.forEach(function (c) { syncRecordStoreFields(c, INITIAL_STORES); });

// --- 初始帳號列表（系統權限） ---
function _buildAllPermissions() {
  var perms = {};
  PERMISSION_FUNCTIONS.forEach(function (fn) {
    perms[fn] = { view: true, edit: true, close: true };
  });
  return perms;
}

function _buildLimitedPermissions() {
  var perms = {};
  PERMISSION_FUNCTIONS.forEach(function (fn) {
    perms[fn] = { view: false, edit: false, close: false };
  });
  perms['案件處理'] = { view: true, edit: true, close: false };
  perms['叫修案件紀錄'] = { view: true, edit: false, close: false };
  perms['保養計劃進度'] = { view: true, edit: false, close: false };
  return perms;
}

const INITIAL_DEVICE_CATEGORIES = [{
  id: 'DCAT1',
  category: '分離式',
  brand: '日立',
  deviceName: '分離式冷氣',
  specification: '3.5匹',
  model: 'RAS-100',
  refrigerant: 'R410A',
  powerSource: '220V',
  createdDate: todayDate
}, {
  id: 'DCAT2',
  category: '分離式',
  brand: '日立',
  deviceName: '分離式冷氣',
  specification: '2.0匹',
  model: 'RAS-50',
  refrigerant: 'R410A',
  powerSource: '110V',
  createdDate: todayDate
}, {
  id: 'DCAT3',
  category: '分離式',
  brand: '大金',
  deviceName: '吊隱式冷氣',
  specification: '4.0匹',
  model: 'FXYP100',
  refrigerant: 'R32',
  powerSource: '220V',
  createdDate: todayDate
}, {
  id: 'DCAT4',
  category: '冰水',
  brand: '三菱重工',
  deviceName: '冰水主機',
  specification: '5.0匹',
  model: 'PA-063',
  refrigerant: 'R134a',
  powerSource: '380V',
  createdDate: todayDate
}, {
  id: 'DCAT5',
  category: '分離式',
  brand: '大金',
  deviceName: '卡式嵌入機',
  specification: '4.0匹',
  model: 'FXMQ125',
  refrigerant: 'R32',
  powerSource: '220V',
  createdDate: todayDate
}, {
  id: 'DCAT6',
  category: '箱型',
  brand: '大金',
  deviceName: '賣場空調',
  specification: '5.0匹',
  model: 'FXYP140',
  refrigerant: 'R32',
  powerSource: '220V',
  createdDate: todayDate
}];

const INITIAL_ASSIGNEES = [
  { id: 'ASG1', name: 'A組', leaderId: 'ACC2', districts: ['台北市信義區', '台北市中山區'], memberIds: ['ACC2'], createdDate: todayDate },
  { id: 'ASG2', name: 'B組', leaderId: 'ACC3', districts: ['台中市中區', '台中市西屯區'], memberIds: ['ACC3'], createdDate: todayDate },
  { id: 'ASG3', name: 'C組', districts: ['高雄市左營區'], memberIds: [], createdDate: todayDate },
  { id: 'ASG4', name: 'D組', districts: ['台北市信義區'], memberIds: [], createdDate: todayDate },
  { id: 'ASG5', name: '晉詮人員', districts: ['台北市信義區', '台北市中山區', '台中市中區', '台中市西屯區', '高雄市左營區'], memberIds: [], createdDate: todayDate },
  { id: 'ASG6', name: '協力廠商', districts: ['台北市信義區', '台北市中山區', '高雄市左營區'], memberIds: [], createdDate: todayDate },
  { id: 'ASG7', name: '案件待辦', districts: ['台北市信義區', '台北市中山區', '台中市中區', '台中市西屯區', '高雄市左營區'], memberIds: [], createdDate: todayDate },
  { id: 'ASG8', name: '管理員', leaderId: 'ACC1', districts: ['台北市信義區', '台北市中山區', '台中市中區', '台中市西屯區', '高雄市左營區'], memberIds: ['ACC1'], createdDate: todayDate },
  { id: 'ASG9', name: '督導', districts: ['台北市信義區', '台北市中山區', '台中市中區', '台中市西屯區'], memberIds: [], createdDate: todayDate }
];

const INITIAL_ACCOUNTS = [{
  id: 'ACC1',
  name: '系統管理員',
  username: 'admin',
  passwordHash: AccountUtils.hashPassword('admin'),
  email: 'admin@jinchuan.example.com',
  enabled: true,
  level: 0,
  permissions: _buildAllPermissions(),
  createdDate: todayDate
}, {
  id: 'ACC2',
  name: '王小明',
  username: 'wangxm',
  passwordHash: AccountUtils.hashPassword('Pass1234'),
  email: 'wangxm@jinchuan.example.com',
  enabled: true,
  level: 1,
  permissions: _buildLimitedPermissions(),
  createdDate: yesterdayDate
}, {
  id: 'ACC3',
  name: '李美華',
  username: 'limeih',
  passwordHash: AccountUtils.hashPassword('Pass5678'),
  email: 'limeih@jinchuan.example.com',
  enabled: false,
  level: 1,
  permissions: _buildLimitedPermissions(),
  createdDate: twoDaysAgoDate
}];

var LEGACY_REPORTER_TO_ACCOUNT = {
  '林店長': '王小明',
  '陳副理': '王小明',
  '王專員': '系統管理員',
  '張小姐': '李美華',
  '李先生': '李美華'
};

function resolveAccountReporterName(reporter) {
  var accountNames = INITIAL_ACCOUNTS.map(function (a) { return a.name; });
  if (!reporter) return accountNames[0] || '系統管理員';
  if (LEGACY_REPORTER_TO_ACCOUNT[reporter]) return LEGACY_REPORTER_TO_ACCOUNT[reporter];
  if (accountNames.indexOf(reporter) !== -1) return reporter;
  return accountNames[0] || '系統管理員';
}

INITIAL_CASES.forEach(function (c) {
  c.reporter = resolveAccountReporterName(c.reporter);
});

INITIAL_CASES.forEach(function (c) {
  if (!c.isPerformanceIncluded || c.performanceAssignee) return;
  c.performanceAssignee = c.assignee || '';
  var performanceAssignee = INITIAL_ASSIGNEES.find(function (a) { return a.name === c.assignee; });
  c.performanceMemberIds = performanceAssignee ? performanceAssignee.memberIds.slice() : [];
});
