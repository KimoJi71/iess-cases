/*
 * data/seed.js — 記憶體假資料（重整後重置）
 *
 * 各資料集的初始內容，對應原本的 INITIAL_* 常數。
 * 依賴 data/options.js 內的日期常數（todayDate / yesterdayDate / twoDaysAgoDate /
 * oneMonthAgoDate / threeMonthsAgoDate）。日期一律用相對常數，不要寫死，
 * 否則假資料會隨時間變陳舊。
 */

// --- 初始服務等級 (系統權限 - 服務等級管理) ---
// countsBonusPoints 的值刻意對應原本寫死的 C/D 前綴判定，確保既有績效數字不變。
const INITIAL_SERVICE_LEVELS = [{
  id: 'SL001',
  name: 'A 保修(一年四次)',
  maintenanceCount: 4,
  countsBonusPoints: false
}, {
  id: 'SL002',
  name: 'B 保修(一年兩次)',
  maintenanceCount: 2,
  countsBonusPoints: false
}, {
  id: 'SL003',
  name: 'C 保養(一年一次)',
  maintenanceCount: 1,
  countsBonusPoints: true
}, {
  id: 'SL004',
  name: 'D 維修(無簽約客戶)',
  maintenanceCount: 0,
  countsBonusPoints: true
}];

// --- 初始模擬客戶列表 (客戶建檔) ---
const INITIAL_CUSTOMERS = [{
  id: 'CUST1',
  name: '屈臣氏',
  taxId: '12345678',
  principal: '王大明',
  serviceLevel: 'A 保修(一年四次)',
  maintenanceStartMonths: 0,
  periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 3 },
    { visitIndex: 2, startMonth: 4, endMonth: 6 },
    { visitIndex: 3, startMonth: 7, endMonth: 9 },
    { visitIndex: 4, startMonth: 10, endMonth: 12 }
  ],
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
  serviceLevel: 'B 保修(一年兩次)',
  maintenanceStartMonths: 6,
  periods: [
    { visitIndex: 1, startMonth: 1, endMonth: 6 },
    { visitIndex: 2, startMonth: 7, endMonth: 12 }
  ],
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
  serviceLevel: 'C 保養(一年一次)',
  overtimeHours: 8,
  periods: [{ visitIndex: 1, startMonth: 1, endMonth: 12 }],
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
  serviceLevel: 'D 維修(無簽約客戶)',
  periods: [],
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
  serviceLevel: 'D 維修(無簽約客戶)',
  periods: [],
  phone: '04-2223-8888',
  fax: '',
  address: '台中市中區建國路X號',
  remarks: '',
  enabled: true,
  createdDate: twoDaysAgoDate,
  contacts: []
}];

// --- 初始模擬廠商列表 (客戶建檔 - 廠商管理) ---
const INITIAL_VENDORS = [{
  id: 'VEND1',
  name: '台灣大金空調',
  type: '供貨商',
  taxId: '11223344',
  principal: '高志遠',
  phone: '02-2655-8888',
  fax: '02-2655-8800',
  address: '台北市內湖區瑞光路500號',
  remarks: '室內外機主要供貨來源。',
  createdDate: todayDate,
  contacts: [{
    id: 301,
    title: '業務經理',
    name: '周佳穎',
    phone: '0918-222-333',
    email: 'chou@daikin.example.com'
  }]
}, {
  id: 'VEND2',
  name: '協成工程行',
  type: '協力商',
  taxId: '22334455',
  principal: '許建成',
  phone: '04-2320-5678',
  fax: '',
  address: '台中市西屯區台灣大道三段200號',
  remarks: '中部風管與安裝協力。',
  createdDate: yesterdayDate,
  contacts: [{
    id: 401,
    title: '工地主任',
    name: '蔡明宏',
    phone: '0921-888-999',
    email: 'tsai@xiecheng.example.com'
  }, {
    id: 402,
    title: '會計',
    name: '林淑芬',
    phone: '04-2320-5679',
    email: 'lin@xiecheng.example.com'
  }]
}, {
  id: 'VEND3',
  name: '南區冷凍材料行',
  type: '其他',
  taxId: '33445566',
  principal: '鄭文傑',
  phone: '07-333-2211',
  fax: '07-333-2212',
  address: '高雄市三民區建國三路88號',
  remarks: '',
  createdDate: twoDaysAgoDate,
  contacts: []
}, {
  id: 'VEND4',
  name: '東陽機電工程',
  type: '協力商',
  taxId: '44556677',
  principal: '黃建國',
  phone: '07-311-7788',
  fax: '',
  address: '高雄市前鎮區中山二路100號',
  remarks: '南部配管與吊裝協力。',
  createdDate: twoDaysAgoDate,
  contacts: [{
    id: 501,
    title: '現場領班',
    name: '吳志偉',
    phone: '0912-555-666',
    email: 'wu@dongyang.example.com'
  }]
}];

// --- 初始模擬門市列表 (客戶建檔 - 門市管理) ---
const INITIAL_STORES = [{
  id: 'STORE1',
  customerName: '屈臣氏',
  storeCode: 'WT-001',
  storeName: '台北信義店',
  serviceLevel: 'A 保修(一年四次)',
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
    assignee: 'A組',
    repairDate: '2025-11-08',
    closeDate: '2025-11-10'
  }]
}, {
  id: 'STORE2',
  customerName: '屈臣氏',
  storeCode: 'WT-002',
  storeName: '台中旗艦店',
  serviceLevel: 'A 保修(一年四次)',
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
    assignee: 'B組',
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
  serviceLevel: 'B 保修(一年兩次)',
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
  // 兩天前完成的保養（M2026070005）即掛在本店，兩者需一致。
  lastMaintenanceDate: twoDaysAgoDate,
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
  serviceLevel: 'B 保修(一年兩次)',
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
  serviceLevel: 'C 保養(一年一次)',
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
  serviceLevel: 'D 維修(無簽約客戶)',
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
  serviceLevel: 'D 維修(無簽約客戶)',
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
  serviceLevel: 'D 維修(無簽約客戶)',
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
  serviceLevel: 'D 維修(無簽約客戶)',
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
}, {
  id: 'STORE10',
  customerName: '萊爾富',
  storeCode: 'HL-022',
  storeName: '左營重愛店',
  serviceLevel: 'C 保養(一年一次)',
  companyPhone: '07-345-3333',
  companyFax: '07-345-3334',
  companyCity: '高雄市',
  companyDistrict: '左營區',
  companyAddress: '重愛路X號',
  openDate: '2024-03-01',
  closeDate: '',
  storeStatus: '正常營業',
  workOrderApply: '否',
  lastRepairDate: '',
  lastMaintenanceDate: '',
  remarks: '',
  indoorHeight: '2.6m',
  outdoorHeight: '3.5m',
  createdDate: todayDate,
  contacts: [],
  photos: [],
  history: []
}, {
  id: 'STORE11',
  customerName: '屈臣氏',
  storeCode: 'WT-003',
  storeName: '大安忠孝店',
  serviceLevel: 'A 保修(一年四次)',
  companyPhone: '02-2771-8888',
  companyFax: '02-2771-8889',
  companyCity: '台北市',
  companyDistrict: '大安區',
  companyAddress: '忠孝東路X號',
  openDate: '2022-04-12',
  closeDate: '',
  storeStatus: '正常營業',
  workOrderApply: '是',
  lastRepairDate: yesterdayDate,
  lastMaintenanceDate: threeMonthsAgoDate,
  remarks: '',
  indoorHeight: '3.1m',
  outdoorHeight: '4.2m',
  createdDate: todayDate,
  contacts: [],
  photos: [],
  history: []
}, {
  id: 'STORE12',
  customerName: '星巴克',
  storeCode: 'SB-013',
  storeName: '北屯崇德店',
  serviceLevel: 'B 保修(一年兩次)',
  companyPhone: '04-2230-5566',
  companyFax: '04-2230-5567',
  companyCity: '台中市',
  companyDistrict: '北屯區',
  companyAddress: '崇德路X號',
  // 本月開幕；星巴克設定「開幕 6 個月後才保養」，故此門市目前不應出現在保養計劃進度。
  // 開幕日必須讓「起始保養月」晚於當期保養區間的結束月，未達標的示範才會全年成立。
  openDate: todayDate,
  closeDate: '',
  storeStatus: '正常營業',
  workOrderApply: '否',
  lastRepairDate: '',
  // 才剛開幕、又要等 6 個月才保養，因此沒有任何保養歷史紀錄。
  lastMaintenanceDate: '',
  remarks: '',
  indoorHeight: '2.9m',
  outdoorHeight: '3.9m',
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
  equipmentLevel: '增額設備',
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
  equipmentLevel: '一般設備',
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
  equipmentLevel: '一般設備',
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
  equipmentLevel: '增額設備',
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
  equipmentLevel: '一般設備',
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
  equipmentLevel: '一般設備',
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
  equipmentLevel: '增額設備',
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
  equipmentLevel: '一般設備',
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
  equipmentLevel: '一般設備',
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
  equipmentLevel: '一般設備',
  area: '頂樓',
  manufactureDate: '2018-11-05',
  installDate: '2018-12-01',
  assetNumber: 'AST-FM-002',
  serialNumber: 'SN-FM-002',
  status: '運轉',
  createdDate: twoDaysAgoDate
}];

// --- 初始模擬案件列表 (維修) ---
function hoursAgoStamp(hours) {
  var d = new Date(Date.now() - hours * 3600000);
  function pad(n) { return String(n).padStart(2, '0'); }
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
    pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

function caseProcessRecordFromPm(pmId, qty, lineId) {
  var pm = INITIAL_PROCESS_METHODS.find(function (m) { return m.id === pmId; });
  if (!pm) return null;
  return {
    id: lineId,
    processMethodId: pm.id,
    category1: pm.category1,
    category2: pm.category2,
    category3: pm.category3,
    specification: pm.specification,
    unit: pm.unit,
    points: pm.points,
    qty: qty
  };
}

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
  vehicleId: 'VEH1',
  partnerVendorIds: ['VEND2'],
  serviceLevel: 'A 保修(一年四次)',
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
  assignee: 'B組',
  processStatus: '待報價',
  isClosed: false,
  serviceLevel: 'B 保修(一年兩次)',
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
  serviceLevel: 'C 保養(一年一次)',
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
  processRecords: [caseProcessRecordFromPm('MS0001', 1, 1)],
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
  assignee: 'A組',
  processStatus: '案件完成',
  isClosed: true,
  serviceLevel: 'D 維修(無簽約客戶)',
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
  processRecords: [
    caseProcessRecordFromPm('RG0004', 1, 1),
    caseProcessRecordFromPm('MC0012', 2, 2)
  ],
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
  serviceLevel: 'D 維修(無簽約客戶)',
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
  processRecords: [caseProcessRecordFromPm('RG0002', 1, 1)],
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
  assignee: '',
  processStatus: '尚未處理完成',
  isClosed: false,
  serviceLevel: 'A 保修(一年四次)',
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
  serviceLevel: 'A 保修(一年四次)',
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
  serviceLevel: 'C 保養(一年一次)',
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
  processRecords: [
    caseProcessRecordFromPm('RG0004', 1, 1),
    caseProcessRecordFromPm('MS0001', 2, 2)
  ],
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
  serviceLevel: 'B 保修(一年兩次)',
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
  serviceLevel: 'A 保修(一年四次)',
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
  serviceLevel: 'D 維修(無簽約客戶)',
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
  processRecords: [caseProcessRecordFromPm('RG0002', 1, 1), caseProcessRecordFromPm('MC0012', 1, 2)],
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
  assignee: 'B組',
  processStatus: '案件完成',
  isClosed: true,
  serviceLevel: 'D 維修(無簽約客戶)',
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
  processRecords: [caseProcessRecordFromPm('RG0004', 2, 1)],
  reRepairDate: '',
  secondRepairDate: '',
  completionDate: todayDate,
  expectedDate: todayDate,
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isPerformanceIncluded: true
}, {
  id: 'C20260701013',
  indicator: 'normal',
  repairDate: yesterdayDate,
  caseNumber: '20260701013',
  customerName: '萊爾富',
  storeName: '左營重愛店',
  workCategory: '一般叫修',
  repairItem: '室內機',
  repairReason: '漏水',
  faultDesc: '室內機集水盤溢水',
  actualReason: '排水管疏通完成',
  assignee: 'B組',
  processStatus: '案件完成',
  isClosed: true,
  serviceLevel: 'C 保養(一年一次)',
  storeAddress: '高雄市左營區重愛路X號',
  reporter: '林店長',
  equipment: {
    id: 'E3',
    customerName: '萊爾富',
    storeName: '左營重愛店',
    area: '賣場區',
    type: '內',
    model: 'RAS-80'
  },
  processRecords: [caseProcessRecordFromPm('RG0002', 1, 1), caseProcessRecordFromPm('PS0001', 1, 2)],
  reRepairDate: '',
  secondRepairDate: '',
  completionDate: yesterdayDate,
  expectedDate: yesterdayDate,
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isPerformanceIncluded: true
}, {
  id: 'C20260701014',
  indicator: 'normal',
  repairDate: todayDate,
  caseNumber: '20260701014',
  customerName: '統一超商',
  storeName: '站前店',
  workCategory: '緊急叫修',
  repairItem: '室外機',
  repairReason: '不冷',
  faultDesc: '營業尖峰無冷氣',
  actualReason: '風扇皮帶更換',
  assignee: 'D組',
  processStatus: '案件完成',
  isClosed: true,
  serviceLevel: 'D 維修(無簽約客戶)',
  storeAddress: '台中市中區建國路X號',
  reporter: '王專員',
  equipment: {
    id: 'E5',
    customerName: '統一超商',
    storeName: '站前店',
    area: '頂樓',
    type: '外',
    model: 'RAS-100'
  },
  processRecords: [caseProcessRecordFromPm('RG0004', 1, 1)],
  reRepairDate: '',
  secondRepairDate: '',
  completionDate: todayDate,
  expectedDate: todayDate,
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  isPerformanceIncluded: true
}, {
  id: 'C20260814015',
  indicator: 'overdue',
  createdAt: hoursAgoStamp(16),
  repairDate: todayDate,
  caseNumber: todayDate.replace(/-/g, '') + '015',
  customerName: '萊爾富',
  storeName: '高雄左營店',
  workCategory: '一般叫修',
  repairItem: '室內機',
  repairReason: '漏水',
  faultDesc: '天花板持續滴水，已超過處理時限',
  actualReason: '',
  assignee: 'A組',
  processStatus: '',
  isClosed: false,
  serviceLevel: 'C 保養(一年一次)',
  storeAddress: '高雄市左營區博愛路X號',
  reporter: '張小姐',
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
  id: 'C20260814016',
  indicator: 'warning',
  createdAt: hoursAgoStamp(5),
  repairDate: todayDate,
  caseNumber: todayDate.replace(/-/g, '') + '016',
  customerName: '萊爾富',
  storeName: '高雄左營店',
  workCategory: '一般叫修',
  repairItem: '室內機',
  repairReason: '不冷',
  faultDesc: '冷氣不冷，距逾時不到 6 小時',
  actualReason: '',
  assignee: '',
  processStatus: '',
  isClosed: false,
  serviceLevel: 'C 保養(一年一次)',
  storeAddress: '高雄市左營區博愛路X號',
  reporter: '張小姐',
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
  caseNumber: `${todayDate.replace(/-/g, '')}001`,
  customerName: '屈臣氏',
  storeName: '台北信義店',
  serviceLevel: 'A 保修(一年四次)',
  status: '已完成',
  planDate: todayDate,
  planTimeStart: '09:00',
  planTimeEnd: '11:00',
  dueMonth: currentMonthStr,
  workCategory: '保養',
  assignee: 'A組',
  isClosed: true,
  isPerformanceIncluded: true,
  performanceAssignee: 'A組',
  completionDate: todayDate,
  storeAddress: '台北市信義區松智路X號'
}, {
  id: 'M2026070002',
  caseNumber: `${todayDate.replace(/-/g, '')}002`,
  customerName: '星巴克',
  storeName: '中山店',
  serviceLevel: 'B 保修(一年兩次)',
  status: '已完成',
  planDate: yesterdayDate,
  planTimeStart: '09:00',
  planTimeEnd: '11:00',
  workCategory: '保養',
  assignee: 'A組',
  isClosed: true,
  isPerformanceIncluded: true,
  performanceAssignee: 'A組',
  completionDate: yesterdayDate,
  storeAddress: '台北市中山區中山北路X號'
}, {
  id: 'M2026070003',
  caseNumber: `${yesterdayDate.replace(/-/g, '')}003`,
  customerName: '萊爾富',
  storeName: '左營重愛店',
  serviceLevel: 'C 保養(一年一次)',
  status: '已完成',
  planDate: yesterdayDate,
  planTimeStart: '14:00',
  planTimeEnd: '16:00',
  completionDate: yesterdayDate,
  assignee: 'C組',
  isClosed: true,
  isPerformanceIncluded: true,
  performanceAssignee: 'C組',
  storeAddress: '高雄市左營區重愛路X號'
}, {
  id: 'M2026070004',
  caseNumber: `${yesterdayDate.replace(/-/g, '')}004`,
  customerName: '屈臣氏',
  storeName: '台中旗艦店',
  serviceLevel: 'A 保修(一年四次)',
  status: '已完成',
  planDate: yesterdayDate,
  planTimeStart: '10:00',
  planTimeEnd: '12:00',
  completionDate: yesterdayDate,
  assignee: 'B組',
  isClosed: true,
  isPerformanceIncluded: true,
  performanceAssignee: 'B組',
  storeAddress: '台中市西屯區台灣大道X號'
}, {
  id: 'M2026070005',
  caseNumber: `${twoDaysAgoDate.replace(/-/g, '')}005`,
  customerName: '星巴克',
  // 北屯崇德店本月才開幕、且要等 6 個月後才保養，不可能有已完成的保養紀錄，
  // 因此這筆歷史紀錄改掛在同客戶、早已開幕的站前店（績效統計數字不變）。
  storeName: '站前店',
  serviceLevel: 'B 保修(一年兩次)',
  status: '已完成',
  planDate: twoDaysAgoDate,
  planTimeStart: '13:00',
  planTimeEnd: '15:00',
  completionDate: twoDaysAgoDate,
  assignee: 'B組',
  isClosed: true,
  isPerformanceIncluded: true,
  performanceAssignee: 'B組',
  storeAddress: '台中市中區建國路X號'
}, {
  id: 'M2026070006',
  caseNumber: '',
  customerName: '屈臣氏',
  storeName: '大安忠孝店',
  serviceLevel: 'A 保修(一年四次)',
  status: '未保養',
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  dueMonth: currentMonthStr,
  workCategory: '保養',
  assignee: '尚未指派',
  isClosed: false,
  storeAddress: '台北市大安區忠孝東路X號'
}, {
  id: 'M2026070007',
  caseNumber: `${todayDate.replace(/-/g, '')}007`,
  customerName: '萊爾富',
  storeName: '左營重愛店',
  serviceLevel: 'C 保養(一年一次)',
  status: '已完成',
  planDate: todayDate,
  planTimeStart: '15:00',
  planTimeEnd: '17:00',
  completionDate: todayDate,
  assignee: 'C組',
  isClosed: true,
  isPerformanceIncluded: true,
  performanceAssignee: 'C組',
  storeAddress: '高雄市左營區重愛路X號'
}, {
  id: 'M2026070008',
  caseNumber: `${yesterdayDate.replace(/-/g, '')}008`,
  customerName: '星巴克',
  storeName: '中山店',
  serviceLevel: 'B 保修(一年兩次)',
  status: '已完成',
  planDate: yesterdayDate,
  planTimeStart: '16:00',
  planTimeEnd: '18:00',
  completionDate: yesterdayDate,
  assignee: 'A組',
  isClosed: true,
  isPerformanceIncluded: true,
  performanceAssignee: 'A組',
  storeAddress: '台北市中山區中山北路X號'
}, {
  id: 'M2026070009',
  caseNumber: `${twoDaysAgoDate.replace(/-/g, '')}009`,
  customerName: '屈臣氏',
  storeName: '台北信義店',
  serviceLevel: 'A 保修(一年四次)',
  status: '已完成',
  planDate: twoDaysAgoDate,
  planTimeStart: '11:00',
  planTimeEnd: '13:00',
  completionDate: twoDaysAgoDate,
  assignee: 'A組',
  isClosed: true,
  isPerformanceIncluded: true,
  performanceAssignee: 'A組',
  storeAddress: '台北市信義區松智路X號'
}, {
  id: 'M2026070010',
  caseNumber: `${todayDate.replace(/-/g, '')}010`,
  customerName: '屈臣氏',
  storeName: '台中旗艦店',
  serviceLevel: 'A 保修(一年四次)',
  status: '已完成',
  planDate: todayDate,
  planTimeStart: '14:00',
  planTimeEnd: '16:00',
  completionDate: todayDate,
  assignee: 'B組',
  isClosed: true,
  isPerformanceIncluded: true,
  performanceAssignee: 'B組',
  storeAddress: '台中市西屯區台灣大道X號'
}, {
  // 北屯崇德店未達「開始保養時間」（本月開幕、星巴克設定開幕 6 個月後才保養），
  // 但仍留有一筆未結案的保養單（例如客戶事後才把開始保養時間調大）。
  // 這筆單尚未排定日期、狀態仍是「未保養」，因此不適用「已進入作業流程」的豁免，
  // 應被保養計劃進度的列表端過濾擋下，用來驗證該過濾確實有效。
  id: 'M2026070011',
  caseNumber: '',
  customerName: '星巴克',
  storeName: '北屯崇德店',
  serviceLevel: 'B 保修(一年兩次)',
  status: '未保養',
  planDate: '',
  planTimeStart: '',
  planTimeEnd: '',
  dueMonth: currentMonthStr,
  workCategory: '保養',
  assignee: '尚未指派',
  isClosed: false,
  storeAddress: '台中市北屯區崇德路X號'
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
    serviceLevel: 'D 維修(無簽約客戶)',
    contactPerson: '王小明',
    suggestedContractor: 'A組',
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
    assignee: '系統管理員',
    done: true
  }, {
    stage: '工程發包作業',
    date: yesterdayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '現勘',
    date: todayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '設備訂貨作業',
    date: todayDate,
    assignee: '王小明'
  }],
  comments: [],
  details: {
    storeAddress: '台中市中區建國路X號',
    serviceLevel: 'B 保修(一年兩次)',
    contactPerson: '王小明',
    suggestedContractor: 'B組',
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
    serviceLevel: 'C 保養(一年一次)',
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
    assignee: '系統管理員',
    done: true
  }, {
    stage: '工程發包作業',
    date: twoDaysAgoDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '現勘',
    date: yesterdayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '設備訂貨作業',
    date: yesterdayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '廠商驗收作業',
    date: todayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '客戶驗收',
    date: todayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '發票請款作業',
    date: todayDate,
    assignee: '王小明',
    done: true
  }],
  comments: [],
  details: {
    storeAddress: '台北市信義區松智路X號',
    serviceLevel: 'A 保修(一年四次)',
    contactPerson: '林店長',
    suggestedContractor: 'B組',
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
    assignee: '系統管理員',
    done: true
  }, {
    stage: '工程發包作業',
    date: yesterdayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '現勘',
    date: yesterdayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '設備訂貨作業',
    date: todayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '廠商驗收作業',
    date: todayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '客戶驗收',
    date: todayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '發票請款作業',
    date: todayDate,
    assignee: '王小明',
    done: true
  }],
  comments: [],
  details: {
    storeAddress: '台中市西屯區台灣大道X號',
    serviceLevel: 'A 保修(一年四次)',
    contactPerson: '張小姐',
    suggestedContractor: 'A組',
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
    assignee: '系統管理員',
    done: true
  }, {
    stage: '工程發包作業',
    date: twoDaysAgoDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '現勘',
    date: yesterdayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '設備訂貨作業',
    date: yesterdayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '廠商驗收作業',
    date: todayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '客戶驗收',
    date: todayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '發票請款作業',
    date: todayDate,
    assignee: '王小明',
    done: true
  }],
  comments: [],
  details: {
    storeAddress: '台中市中區建國路X號',
    serviceLevel: 'D 維修(無簽約客戶)',
    contactPerson: '王專員',
    suggestedContractor: 'C組',
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
    assignee: '系統管理員',
    done: true
  }, {
    stage: '工程發包作業',
    date: oneMonthAgoDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '現勘',
    date: oneMonthAgoDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '設備訂貨作業',
    date: yesterdayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '廠商驗收作業',
    date: twoDaysAgoDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '客戶驗收',
    date: twoDaysAgoDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '發票請款作業',
    date: twoDaysAgoDate,
    assignee: '王小明',
    done: true
  }],
  comments: [],
  details: {
    storeAddress: '台北市中山區中山北路X號',
    serviceLevel: 'D 維修(無簽約客戶)',
    contactPerson: '李先生',
    suggestedContractor: 'A組',
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
    assignee: '系統管理員',
    done: true
  }, {
    stage: '工程發包作業',
    date: yesterdayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '現勘',
    date: yesterdayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '設備訂貨作業',
    date: todayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '廠商驗收作業',
    date: todayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '客戶驗收',
    date: todayDate,
    assignee: '王小明',
    done: true
  }, {
    stage: '發票請款作業',
    date: todayDate,
    assignee: '王小明',
    done: true
  }],
  comments: [],
  details: {
    storeAddress: '台北市中山區中山北路X號',
    serviceLevel: 'B 保修(一年兩次)',
    contactPerson: '陳副理',
    suggestedContractor: 'B組',
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

// 保養單的組別改為多選：把種子資料的單值 assignee 轉成 assignees[]，全站只讀一種形態。
INITIAL_MAINTENANCE_CASES.forEach(function (c) {
  var normalized = CaseAssigneeUtils.normalizeMaintenanceCase(c);
  Object.keys(c).forEach(function (k) { delete c[k]; });
  Object.assign(c, normalized);
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


const SEED_YEAR = new Date().getFullYear();

const INITIAL_MAINTENANCE_ALLOCATIONS = [
  { id: 'MA1', year: SEED_YEAR, assigneeId: 'ASG1', customerName: '屈臣氏', month: 7, visitIndex: 1, targetCount: 3 },
  { id: 'MA2', year: SEED_YEAR, assigneeId: 'ASG1', customerName: '星巴克', month: 7, visitIndex: 1, targetCount: 2 },
  { id: 'MA3', year: SEED_YEAR, assigneeId: 'ASG1', customerName: '屈臣氏', month: 8, visitIndex: 1, targetCount: 1 },
  { id: 'MA4', year: SEED_YEAR, assigneeId: 'ASG2', customerName: '星巴克', month: 7, visitIndex: 1, targetCount: 2 },
  { id: 'MA5', year: SEED_YEAR, assigneeId: 'ASG2', customerName: '屈臣氏', month: 7, visitIndex: 1, targetCount: 2 },
  { id: 'MA6', year: SEED_YEAR, assigneeId: 'ASG2', customerName: '星巴克', month: 8, visitIndex: 1, targetCount: 1 },
  { id: 'MA7', year: SEED_YEAR, assigneeId: 'ASG3', customerName: '萊爾富', month: 7, visitIndex: 1, targetCount: 2 },
  { id: 'MA8', year: SEED_YEAR, assigneeId: 'ASG4', customerName: '屈臣氏', month: 7, visitIndex: 1, targetCount: 2 }
];

const INITIAL_PERFORMANCE_AREAS = [
  {
    id: 'PA1',
    name: '北區',
    districts: ['台北市信義區', '台北市大安區', '台北市中山區'],
    createdDate: todayDate
  },
  {
    id: 'PA2',
    name: '中區',
    districts: ['台中市西屯區', '台中市北屯區', '台中市中區'],
    createdDate: todayDate
  },
  {
    id: 'PA3',
    name: '南區',
    districts: ['高雄市左營區', '高雄市鳳山區'],
    createdDate: todayDate
  }
];

// 一個行政區只能歸屬一組，四組的 districts 必須互斥（見 AssigneeUtils.findConflictingDistricts）
// B組的李美華（ACC3）是停用帳號，刻意保留：指派人員選單只列啟用中的組員，
// 這組資料同時示範「組別有成員，但其中一位已停用」的情況。
const INITIAL_ASSIGNEES = [
  { id: 'ASG1', name: 'A組', leaderId: 'ACC2', districts: ['台北市信義區', '台北市中山區'], memberIds: ['ACC2', 'ACC4'], createdDate: todayDate },
  { id: 'ASG2', name: 'B組', leaderId: 'ACC5', districts: ['台中市中區', '台中市西屯區'], memberIds: ['ACC3', 'ACC5'], createdDate: todayDate },
  { id: 'ASG3', name: 'C組', leaderId: 'ACC6', districts: ['高雄市左營區'], memberIds: ['ACC6'], createdDate: todayDate },
  { id: 'ASG4', name: 'D組', leaderId: 'ACC7', districts: ['台北市大安區', '台中市北屯區'], memberIds: ['ACC7'], createdDate: todayDate }
];

const INITIAL_VEHICLES = [{
  id: 'VEH1',
  plateNo: 'ABC-1234',
  personInCharge: '王小明',
  owner: '金川工程股份有限公司',
  company: '金川工程股份有限公司',
  createdDate: todayDate
}, {
  id: 'VEH2',
  plateNo: 'KAA-5678',
  personInCharge: '陳志豪',
  owner: '陳志豪',
  company: '金川工程股份有限公司',
  createdDate: yesterdayDate
}, {
  id: 'VEH3',
  plateNo: 'NCA-9012',
  personInCharge: '林雅婷',
  owner: '金川工程股份有限公司',
  company: '金川工程股份有限公司',
  createdDate: twoDaysAgoDate
}];

const INITIAL_ACCOUNTS = [{
  id: 'ACC1',
  name: '系統管理員',
  username: 'admin',
  passwordHash: AccountUtils.hashPassword('admin'),
  email: 'admin@jinchuan.example.com',
  role: '課長',
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
  role: '副課長',
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
  role: '課員',
  enabled: false,
  level: 1,
  permissions: _buildLimitedPermissions(),
  createdDate: twoDaysAgoDate
}, {
  id: 'ACC4',
  name: '陳志豪',
  username: 'chenzh',
  passwordHash: AccountUtils.hashPassword('Pass1234'),
  email: 'chenzh@jinchuan.example.com',
  role: '課員',
  enabled: true,
  level: 1,
  permissions: _buildLimitedPermissions(),
  createdDate: twoDaysAgoDate
}, {
  id: 'ACC5',
  name: '林雅婷',
  username: 'linyt',
  passwordHash: AccountUtils.hashPassword('Pass1234'),
  email: 'linyt@jinchuan.example.com',
  role: '課員',
  enabled: true,
  level: 1,
  permissions: _buildLimitedPermissions(),
  createdDate: twoDaysAgoDate
}, {
  id: 'ACC6',
  name: '張建國',
  username: 'zhangjg',
  passwordHash: AccountUtils.hashPassword('Pass1234'),
  email: 'zhangjg@jinchuan.example.com',
  role: '課員',
  enabled: true,
  level: 1,
  permissions: _buildLimitedPermissions(),
  createdDate: twoDaysAgoDate
}, {
  id: 'ACC7',
  name: '黃淑芬',
  username: 'huangsf',
  passwordHash: AccountUtils.hashPassword('Pass1234'),
  email: 'huangsf@jinchuan.example.com',
  role: '實習生',
  enabled: true,
  level: 2,
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
  var normalized = CaseAssigneeUtils.normalizeRepairCase(c);
  Object.keys(c).forEach(function (k) { delete c[k]; });
  Object.assign(c, normalized);
  if (c.isPerformanceIncluded) {
    if (!c.performanceAssignees || !c.performanceAssignees.length) {
      c.performanceAssignees = CaseAssigneeUtils.getFormalAssignees(c);
      c.performanceAssignee = c.performanceAssignees[0] || '';
    }
    var memberIds = [];
    (c.performanceAssignees || []).forEach(function (name) {
      var ag = INITIAL_ASSIGNEES.find(function (a) { return a.name === name; });
      if (!ag) return;
      ag.memberIds.forEach(function (id) {
        if (memberIds.indexOf(id) === -1) memberIds.push(id);
      });
    });
    c.performanceMemberIds = memberIds;
  }
});

// 年度快照由現行主檔計算產生，確保 demo 資料與畫面一致。
// 載入順序依賴：本行在模組載入時就會執行，故 index.html 裡的
// src/features/permissions/maintenance-allocation-utils.js 必須排在 src/data/seed.js 之前
// （目前分別在第 39、44 行）。順序一旦對調，開機時就是一個裸的 ReferenceError。
const INITIAL_MAINTENANCE_ALLOCATION_YEARS = [
  MaintenanceAllocationUtils.buildYearSnapshot(
    SEED_YEAR,
    INITIAL_ASSIGNEES,
    INITIAL_CUSTOMERS,
    INITIAL_STORES,
    INITIAL_SERVICE_LEVELS,
    todayDate
  )
];
