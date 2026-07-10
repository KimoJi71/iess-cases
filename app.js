function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState,
  useMemo,
  useEffect,
  useRef
} = React;
const {
  Search,
  Plus,
  Edit,
  CheckCircle,
  Copy,
  AlertCircle,
  ChevronDown,
  QrCode,
  Save,
  ArrowLeft,
  X,
  Home,
  Settings,
  Wrench,
  Bell,
  User,
  Eye,
  Calendar,
  Star,
  Trash2,
  Paperclip,
  Send,
  FileText,
  Clock,
  Download
} = LucideReact;

// --- 模擬資料與選項設定 ---
const PROCESS_STATUS_OPTIONS = ['待料件', '待報價', '待汰換', '轉原廠', '尚未處理完成', '案件完成', '其他'];
const WORK_CATEGORY_OPTIONS = ['一般叫修', '緊急叫修', '保養清潔', '其他'];
const REPAIR_ITEMS = ['室內機', '室外機', '風管', '出風口', '控制面板', '跳代碼', '空氣門'];
const REPAIR_REASONS = ['不冷', '異音', '溫控故障', '跳機', '異味', '漏水', '代碼', '其他'];
const ASSIGNEES = ['A組', 'B組', 'C組', 'D組', '晉詮人員', '協力廠商', '案件待辦'];
const CUSTOMER_OPTIONS = ['屈臣氏', '星巴克', '萊爾富', '統一超商', '全家便利商店'];
const STORE_OPTIONS = ['台北信義店', '台中旗艦店', '高雄左營店', '站前店', '中山店'];
const REPORTER_OPTIONS = ['林店長', '陳副理', '王專員', '張小姐', '李先生'];
const PROCESS_METHOD_CATEGORIES = {
  '工資': {
    '分離式': ['檢修工資', '保養工資', '安裝工資', '管線配置', '拆機工資'],
    '冰水': ['檢修工資', '保養工資', '配管工資', '主機維護', '管路清洗'],
    '其他': ['一般工資', '勘估車馬費', '夜間加成']
  },
  '零件': {
    '分離式': ['主機板', '風扇馬達', '壓縮機', '感溫棒', '接收器', '顯示板'],
    '冰水': ['水泵', '水流開關', '冷卻水塔散熱片', '控制器', '閥門', '皮帶'],
    '其他': ['通用零件', '五金配件', '螺絲組']
  },
  '材料': {
    '保養材料': ['冷媒', '過濾網', '保溫棉', '清洗劑', '防鏽漆', '保養藥水'],
    '安裝材料': ['銅管', '控制線', '電源線', 'PVC排水管', '安裝鐵架']
  },
  '特殊工資': {
    '特殊作業': ['高空作業', '危險作業', '吊車吊掛', '局限空間作業', '夜間施工', '假日施工']
  }
};
const MAINTENANCE_STATUS_OPTIONS = ['待排程', '已排程', '保養中', '已完工', '逾期'];
const DISTRICT_OPTIONS = ['北區', '中區', '南區', '東區'];
const SERVICE_LEVEL_OPTIONS = ['保修(一年一次)', '保修(一年兩次)', '保養(一年一次)', '維修(無簽約客戶)'];
const MAINTENANCE_INTERVAL_OPTIONS = ['每季', '每半年', '每年'];

// 工程立案專用選項
const PROJECT_WORK_CATEGORIES = ['新開', '汰換', '撤店', '整裝', '加裝'];
const EQUIPMENT_CATEGORIES = ['室內機', '室外機', '全熱交換器', '風機', '水泵', '其他'];
const EQUIPMENT_BRANDS = ['大金', '日立', '國際', '三菱', '冰點', '其他'];
const EQUIPMENT_TYPES = ['內', '外', '無'];
const PROJECT_STAGES = ['立案時間', '工程發包作業', '現勘', '設備訂貨作業', '廠商驗收作業', '發票請款作業'];
const PROJECT_ASSIGNEES = ['管理員', '採購部', '工程A組', '工程B組', '晉詮人員', '機電維護商', '尚未指派'];
const PROJECT_TOPIC_TAGS = ['現勘', '設備', '材料', '施工', '驗收', '請款'];
let DYNAMIC_PROJECT_TAGS = [...PROJECT_TOPIC_TAGS];

// 現勘表收集專用選項
const SURVEY_TYPES = ['環境與施工', '設備與零件', '配管工程', '配電工程', '風管工程', '拆除工程', '汰換工程'];

// 設備與零件 現勘表選項
const EQUIP_CATEGORY_OPTIONS = ['分離式', '冰水', '空氣門'];
// 品牌／設備名稱／型號：實務上抓「設備清單」資料，此處以示範資料呈現
const EQUIP_BRAND_OPTIONS = ['日立', '大金', '三菱重工', '國際牌', 'LG', '其他'];
const EQUIP_NAME_OPTIONS = ['分離式冷氣', '箱型冷氣', '吊隱式冷氣', '冰水主機', '空氣門'];
const EQUIP_MODEL_OPTIONS = ['RAS-100', 'RAS-50', 'FXYP100', 'PA-063', '其他'];
// 零配件（多選 + 填數量），日立集中控制器於原表重複，此處取唯一值
const SURVEY_PARTS = ['日立集中控制器', '日立受光器', '得意溫控', '空氣門繼電器', '空氣門磁簧開關'];

// 配管工程 現勘表選項（多選 + 填數字）
// 銅管工程
const PIPING_COPPER_SIZES = ['2分5分', '3分5分', '4分', '1英吋', '1.1英吋']; // 長度 米
const PIPING_COPPER_FITTINGS = ['分歧管282', '分歧管452']; // 數量 個
// 排水工程
const PIPING_PVC_DRAIN = ['6分', '1英吋']; // 長度 米
const PIPING_DRAIN_INSULATION = ['6分x1/2', '1英吋x1/2']; // 長度 米
// 冰水管工程
const PIPING_CHILLED_FITTINGS = ['二通閥', '三通閥', '水流板', '水流開關', '溫度表', '水壓表', 'Y型過濾器']; // 數量 個
const PIPING_CHILLED_PIPE = ['6分', '1英吋', '2英吋', '3英吋']; // 長度 米
const PIPING_CHILLED_INSULATION = ['6分x2/3', '1英吋x1']; // 長度 米
// 管路保護
const PIPING_PROTECT_MATERIALS = ['膠帶', 'ABS管槽', '白鐵']; // 單選（ABS管槽需再選層數尺寸）
const PIPING_ABS_SIZES = ['80mm', '100mm', '140mm']; // ABS管槽 第二層尺寸
const PIPING_CHANNEL_FITTINGS = [
  { label: '管槽', unit: '米', qtyLabel: '長度' },
  { label: '軟管', unit: '支', qtyLabel: '數量' },
  { label: '彎頭', unit: '個', qtyLabel: '數量' }
]; // 多選 + 填數字（單位不同）
const PIPING_PROTECT_COLORS = ['黑色', '白色']; // 單選

// 配電工程 現勘表選項（多選 + 填數字，單位：米，填長度）
const WIRING_CONTROL_SIGNAL = ['隔離控制線1.25mm²*2C', '隔離訊號線1.25mm²*2C']; // 控制及訊號線材／米
const WIRING_POWER_CABLE = ['電纜線2.0mm²*3C', '電纜線5.5mm²*3C', '電纜線8.0mm²*4C', '電纜線14mm²*4C']; // 電源線線材／米

// 風管工程 現勘表選項
const DUCT_INSULATED_HOSE = ['4"', '6"', '8"', '10"', '12"']; // 保溫軟管(玻璃棉)／米（多選 + 填長度）
const DUCT_UNINSULATED_HOSE = ['4"', '6"', '8"', '10"', '12"']; // 無保溫軟管(鋁箔)／米（多選 + 填長度）
const DUCT_BOX_MATERIALS = ['PU貼鋁皮', '鐵製']; // 集風箱／出線型箱 材質（單選）
const DUCT_BOX_PIPES = ['4"風管', '6"風管', '8"風管', '10"風管', '12"風管']; // 集風箱／出線型箱 風管管徑（多選 + 孔數 + 數量）
const DUCT_TEE_PIPES = ['4"', '6"', '8"', '10"', '12"']; // 三通風箱 風管管徑（多選 + 數量）
const DUCT_VENT_OUTLETS = [
  { label: '輕鋼架-格柵出風口(60*60cm)' },
  { label: '格柵出風口(45*45cm)(含框)' },
  { label: '擴散出風口(45*45cm)(含框)' },
  { label: '線型出風口', dim: true }
]; // 出風口型式（多選 + 數量，線型另填寬高）
const DUCT_RETURN_OUTLETS = ['輕鋼架-抽取式回風口(60*60cm)(框+網)', '輕鋼架-一體成型回風口(60*60cm)(框+網)', '回風板(尺寸120*45cm)', '回風板(尺寸140*45cm)']; // 回風口（多選 + 數量）
const DUCT_CUSTOM_BOX_OPTIONS = ['特製風箱(NAS附圖)', '請風管廠商前來丈量安裝']; // 特製風箱（單選 + 其他）

// 客戶名稱對應服務等級的映射表
const CUSTOMER_SERVICE_LEVEL_MAP = {
  '屈臣氏': '保修(一年一次)',
  '星巴克': '保修(一年兩次)',
  '萊爾富': '保養(一年一次)',
  '統一超商': '維修(無簽約客戶)',
  '全家便利商店': '維修(無簽約客戶)'
};

// --- 日期計算 ---
const today = new Date();
const todayDate = today.toISOString().split('T')[0];
const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const twoDaysAgoDate = new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0];
const currentMonthStr = today.toISOString().slice(0, 7);

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
  createdDate: twoDaysAgoDate,
  contacts: []
}];

// --- 初始模擬案件列表 (維修) ---
const INITIAL_CASES = [{
  id: 'C20260709001',
  indicator: 'urgent',
  repairDate: todayDate,
  caseNumber: '20260709001',
  customerName: '屈臣氏',
  storeName: '台北信義店',
  district: '北區',
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
  completionDate: '',
  expectedDate: todayDate,
  isPerformanceIncluded: false
}, {
  id: 'C20260708002',
  indicator: 'overdue',
  repairDate: yesterdayDate,
  caseNumber: '20260708002',
  customerName: '星巴克',
  storeName: '台中旗艦店',
  district: '中區',
  workCategory: '一般叫修',
  repairItem: '室外機',
  repairReason: '異音',
  faultDesc: '室外機運轉聲音很大',
  actualReason: '風扇軸承老化',
  assignee: '協力廠商',
  processStatus: '待報價',
  isClosed: false,
  serviceLevel: '保修(一年兩次)',
  storeAddress: '台中市西屯區台灣大道X號',
  reporter: '陳副理',
  equipment: {
    id: 'E1',
    customerName: '星巴克',
    storeName: '台中旗艦店',
    area: '頂樓',
    type: '外',
    model: 'RAS-100'
  },
  processRecords: [],
  reRepairDate: '',
  completionDate: '',
  expectedDate: yesterdayDate,
  isPerformanceIncluded: false
}, {
  id: 'C20260707003',
  indicator: 'normal',
  repairDate: yesterdayDate,
  caseNumber: '20260707003',
  customerName: '萊爾富',
  storeName: '高雄左營店',
  district: '南區',
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
  completionDate: todayDate,
  expectedDate: todayDate,
  isPerformanceIncluded: false
}, {
  id: 'C20260706004',
  indicator: 'normal',
  repairDate: twoDaysAgoDate,
  caseNumber: '20260706004',
  customerName: '全家便利商店',
  storeName: '中山店',
  district: '北區',
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
  completionDate: twoDaysAgoDate,
  expectedDate: yesterdayDate,
  isPerformanceIncluded: true
}, {
  id: 'C20260710005',
  indicator: 'normal',
  repairDate: todayDate,
  caseNumber: '20260710005',
  customerName: '統一超商',
  storeName: '站前店',
  district: '中區',
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
  completionDate: todayDate,
  expectedDate: todayDate,
  isPerformanceIncluded: false
}];

// --- 初始模擬保養計畫列表 ---
const INITIAL_MAINTENANCE_CASES = [{
  id: 'M2026070001',
  caseNumber: '',
  customerName: '屈臣氏',
  storeName: '台北信義店',
  district: '北區',
  serviceLevel: '保修(一年一次)',
  status: '待排程',
  planDate: '',
  assignee: '尚未指派',
  isClosed: false,
  storeAddress: '台北市信義區松智路X號'
}, {
  id: 'M2026070002',
  caseNumber: `${todayDate.replace(/-/g, '')}002`,
  customerName: '星巴克',
  storeName: '台中旗艦店',
  district: '中區',
  serviceLevel: '保修(一年兩次)',
  status: '已排程',
  planDate: todayDate,
  assignee: 'A組',
  isClosed: false,
  storeAddress: '台中市西屯區台灣大道X號'
}, {
  id: 'M2026070003',
  caseNumber: `${yesterdayDate.replace(/-/g, '')}003`,
  customerName: '萊爾富',
  storeName: '高雄左營店',
  district: '南區',
  serviceLevel: '保養(一年一次)',
  status: '已完工',
  planDate: yesterdayDate,
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
  stageAssignee: '工程A組',
  isClosed: false,
  history: [{
    stage: '立案時間',
    date: todayDate,
    assignee: '管理員'
  }, {
    stage: '工程發包作業',
    date: todayDate,
    assignee: '採購部'
  }, {
    stage: '現勘',
    date: todayDate,
    assignee: '工程A組'
  }],
  comments: [{
    id: 1,
    author: '管理員',
    timestamp: `${todayDate} 09:00`,
    content: '工程已立案，請採購部協助後續。',
    attachment: null
  }, {
    id: 2,
    author: '採購部',
    timestamp: `${todayDate} 10:30`,
    content: '@工程A組 已安排發包，請確認 #現勘 時間。',
    attachment: '發包明細.pdf'
  }],
  details: {
    storeAddress: '台北市中山區中山北路X號',
    serviceLevel: '維修(無簽約客戶)',
    contactPerson: '李店長 0912-345-678',
    suggestedContractor: '內部工程組',
    entryDate: todayDate,
    remarks: '需避開營業尖峰時段',
    equipment: [{
      id: 1,
      category: '室內機',
      name: '1F賣場空調',
      brand: '大金',
      type: '內',
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
  storeName: '台中旗艦店',
  workCategory: '整裝',
  currentStage: '設備訂貨作業',
  stageDate: todayDate,
  stageAssignee: '採購部',
  isClosed: false,
  history: [{
    stage: '立案時間',
    date: yesterdayDate,
    assignee: '管理員'
  }, {
    stage: '工程發包作業',
    date: yesterdayDate,
    assignee: '採購部'
  }, {
    stage: '現勘',
    date: todayDate,
    assignee: '工程B組'
  }, {
    stage: '設備訂貨作業',
    date: todayDate,
    assignee: '採購部'
  }],
  comments: [],
  details: {
    storeAddress: '台中市西屯區台灣大道X號',
    serviceLevel: '保修(一年兩次)',
    contactPerson: '陳副理',
    suggestedContractor: '機電維護商',
    entryDate: yesterdayDate,
    remarks: '',
    equipment: []
  }
}];

// --- 初始模擬現勘表列表 ---
const INITIAL_SURVEY_CASES = [{
  id: 'S20260710001',
  fillDate: todayDate,
  customerName: '全家便利商店',
  storeName: '中山店',
  surveyType: '環境與施工',
  fileName: `全家便利商店_中山店_環境與施工_${todayDate.replace(/-/g, '')}`
}, {
  id: 'S20260709002',
  fillDate: yesterdayDate,
  customerName: '星巴克',
  storeName: '台中旗艦店',
  surveyType: '設備與零件',
  fileName: `星巴克_台中旗艦店_設備與零件_${yesterdayDate.replace(/-/g, '')}`
}];

// --- 自訂 Hook：滑鼠拖曳滑動表格 ---
const useDragScroll = () => {
  const ref = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const onMouseDown = e => {
    setIsDragging(true);
    setStartX(e.pageX - ref.current.offsetLeft);
    setScrollLeft(ref.current.scrollLeft);
  };
  const onMouseLeave = () => setIsDragging(false);
  const onMouseUp = () => setIsDragging(false);
  const onMouseMove = e => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    ref.current.scrollLeft = scrollLeft - walk;
  };
  return {
    ref,
    onMouseDown,
    onMouseLeave,
    onMouseUp,
    onMouseMove
  };
};

// --- 元件：Header ---
const Header = ({
  currentTopMenu,
  setCurrentTopMenu
}) => /*#__PURE__*/React.createElement("header", {
  className: "bg-blue-900 text-white shadow-md shrink-0"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between px-6 py-3"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center space-x-8"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center space-x-2"
}, /*#__PURE__*/React.createElement(Wrench, {
  className: "h-6 w-6 text-blue-300"
}), /*#__PURE__*/React.createElement("h1", {
  className: "text-xl font-bold tracking-wider"
}, "\u6649\u8A6E\u7CFB\u7D71")), /*#__PURE__*/React.createElement("nav", {
  className: "hidden md:flex space-x-1"
}, ['首頁', '戰情室', '案件管理', '設備管理', '系統設定'].map(menu => /*#__PURE__*/React.createElement("button", {
  key: menu,
  onClick: () => setCurrentTopMenu(menu),
  className: `px-4 py-2 rounded-md transition-colors ${currentTopMenu === menu ? 'bg-blue-800 text-white font-medium' : 'text-blue-200 hover:bg-blue-800 hover:text-white'}`
}, menu)))), /*#__PURE__*/React.createElement("div", {
  className: "flex items-center space-x-4"
}, /*#__PURE__*/React.createElement("button", {
  className: "text-blue-200 hover:text-white"
}, /*#__PURE__*/React.createElement(Bell, {
  className: "h-5 w-5"
})), /*#__PURE__*/React.createElement("div", {
  className: "flex items-center space-x-2 text-sm"
}, /*#__PURE__*/React.createElement("div", {
  className: "bg-blue-800 p-1.5 rounded-full"
}, /*#__PURE__*/React.createElement(User, {
  className: "h-4 w-4"
})), /*#__PURE__*/React.createElement("span", {
  className: "hidden sm:inline"
}, "\u7BA1\u7406\u54E1")))));

// ==========================================
//           1. 案件處理 (維修) 相關元件
// ==========================================

const CaseList = ({
  cases,
  setCases,
  setEditingCase,
  setView,
  showToast,
  statusFilter,
  setStatusFilter
}) => {
  const [closeConfirmModal, setCloseConfirmModal] = useState({
    show: false,
    caseId: null
  });
  const dragProps = useDragScroll();
  const filteredCases = useMemo(() => {
    let filtered = cases;
    if (statusFilter === '全部') {
      filtered = cases.filter(c => !c.isClosed);
    } else if (statusFilter !== '全部') {
      filtered = cases.filter(c => !c.isClosed && c.processStatus === statusFilter);
    }
    return filtered.sort((a, b) => new Date(b.repairDate) - new Date(a.repairDate));
  }, [cases, statusFilter]);
  const statusCounts = cases.filter(c => !c.isClosed).reduce((acc, c) => {
    acc[c.processStatus] = (acc[c.processStatus] || 0) + 1;
    return acc;
  }, {});
  const handleCopyUrl = caseNumber => {
    navigator.clipboard.writeText(`https://system.jinchuan.com/case/${caseNumber}`);
    showToast(`已複製 ${caseNumber} 案件連結`);
  };
  const handleCloseCase = caseId => {
    setCases(cases.map(c => c.id === caseId ? {
      ...c,
      isClosed: true,
      processStatus: '案件完成',
      completionDate: c.completionDate || todayDate
    } : c));
    setCloseConfirmModal({
      show: false,
      caseId: null
    });
    showToast('案件已結案，並移至銷案審核列表');
  };
  const getIndicatorColor = c => {
    if (c.processStatus === '案件完成') return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]';
    if (c.workCategory === '緊急叫修') return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
    if (c.expectedDate && c.expectedDate < todayDate) return 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]';
    return 'bg-gray-300';
  };
  const StatusFilterBtn = ({
    status,
    label
  }) => /*#__PURE__*/React.createElement("button", {
    onClick: () => setStatusFilter(status),
    className: `px-4 py-2 rounded-full text-sm font-medium transition-all ${statusFilter === status ? 'bg-blue-100 text-blue-800 border-2 border-blue-500' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`
  }, label, status !== '全部' && statusCounts[status] > 0 && /*#__PURE__*/React.createElement("span", {
    className: "ml-2 bg-blue-500 text-white text-xs py-0.5 px-2 rounded-full"
  }, statusCounts[status]));
  return /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-6 rounded-lg shadow-sm border border-gray-100"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2"
  }, /*#__PURE__*/React.createElement(StatusFilterBtn, {
    status: "\u5168\u90E8",
    label: "\u5168\u90E8"
  }), PROCESS_STATUS_OPTIONS.map(status => /*#__PURE__*/React.createElement(StatusFilterBtn, {
    key: status,
    status: status,
    label: status
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('add'),
    className: "flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors",
    title: "\u65B0\u589E\u53EB\u4FEE\u6848\u4EF6"
  }, /*#__PURE__*/React.createElement(Plus, {
    className: "h-5 w-5"
  }))), /*#__PURE__*/React.createElement("div", _extends({
    className: "overflow-x-auto border rounded-lg cursor-grab active:cursor-grabbing"
  }, dragProps), /*#__PURE__*/React.createElement("table", {
    className: "w-full text-left text-sm text-gray-600 whitespace-nowrap select-none"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 text-gray-700 border-b"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold text-center w-32"
  }, "\u64CD\u4F5C"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold text-center"
  }, "\u71C8\u865F"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u53EB\u4FEE\u65E5\u671F"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u6848\u4EF6\u7DE8\u865F"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u5BA2\u6236/\u9580\u5E02\u540D\u7A31"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u884C\u653F\u5340\u57DF"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u5DE5\u9805\u5206\u985E"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u53EB\u4FEE\u9805\u76EE/\u539F\u56E0"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold min-w-[200px]"
  }, "\u6545\u969C\u63CF\u8FF0"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u6307\u6D3E\u4EBA\u54E1"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u6848\u4EF6\u72C0\u614B"))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-gray-100"
  }, filteredCases.map(c => /*#__PURE__*/React.createElement("tr", {
    key: c.id,
    className: "hover:bg-blue-50/50 transition-colors"
  }, /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-center space-x-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEditingCase(c);
      setView('edit');
    },
    className: "p-1.5 text-blue-600 hover:bg-blue-100 rounded",
    title: "\u7DE8\u8F2F"
  }, /*#__PURE__*/React.createElement(Edit, {
    className: "h-4 w-4"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setCloseConfirmModal({
      show: true,
      caseId: c.id
    }),
    className: "p-1.5 text-green-600 hover:bg-green-100 rounded",
    title: "\u7D50\u6848"
  }, /*#__PURE__*/React.createElement(CheckCircle, {
    className: "h-4 w-4"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleCopyUrl(c.caseNumber),
    className: "p-1.5 text-gray-500 hover:bg-gray-200 rounded",
    title: "\u8907\u88FDURL"
  }, /*#__PURE__*/React.createElement(Copy, {
    className: "h-4 w-4"
  })))), /*#__PURE__*/React.createElement("td", {
    className: "p-3 text-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: `inline-block w-3 h-3 rounded-full ${getIndicatorColor(c)}`
  })), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.repairDate), /*#__PURE__*/React.createElement("td", {
    className: "p-3 font-medium text-blue-700"
  }, c.caseNumber), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, /*#__PURE__*/React.createElement("div", null, c.customerName), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-gray-500"
  }, c.storeName)), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.district), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: `px-2 py-1 rounded text-xs ${c.workCategory === '緊急叫修' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`
  }, c.workCategory)), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, /*#__PURE__*/React.createElement("div", null, c.repairItem), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-gray-500"
  }, c.repairReason)), /*#__PURE__*/React.createElement("td", {
    className: "p-3 max-w-[200px] truncate",
    title: c.faultDesc
  }, c.faultDesc), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.assignee), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
  }, c.processStatus))))))), closeConfirmModal.show && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center z-50"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-3 text-yellow-600 mb-4"
  }, /*#__PURE__*/React.createElement(AlertCircle, {
    className: "h-6 w-6"
  }), /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-gray-800"
  }, "\u78BA\u8A8D\u7D50\u6848")), /*#__PURE__*/React.createElement("p", {
    className: "text-gray-600 mb-6"
  }, "\u78BA\u5B9A\u8981\u5C07\u6B64\u6848\u4EF6\u6A19\u8A18\u70BA\u7D50\u6848\u55CE\uFF1F\u7D50\u6848\u5F8C\u72C0\u614B\u5C07\u66F4\u65B0\u4E26\u79FB\u81F3\u300C\u6848\u4EF6\u92B7\u6848\u5BE9\u6838\u300D\u5217\u8868\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end space-x-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setCloseConfirmModal({
      show: false,
      caseId: null
    }),
    className: "px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
  }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleCloseCase(closeConfirmModal.caseId),
    className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
  }, "\u78BA\u8A8D\u7D50\u6848")))));
};
const AddCaseForm = ({
  cases,
  setCases,
  setView,
  showToast
}) => {
  const [formData, setFormData] = useState({
    workCategory: '一般叫修',
    customerName: '',
    storeName: '',
    repairItem: '室內機',
    repairReason: '不冷',
    faultDesc: '',
    assignee: '案件待辦',
    expectedDate: '',
    expectedTimeStart: '',
    expectedTimeEnd: '',
    reporter: '',
    serviceLevel: '維修(無簽約客戶)'
  });
  const handleChange = e => {
    const {
      name,
      value
    } = e.target;
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: value
      };
      if (name === 'customerName') {
        newData.serviceLevel = CUSTOMER_SERVICE_LEVEL_MAP[value] || '維修(無簽約客戶)';
      }
      return newData;
    });
  };
  const handleSubmit = e => {
    e.preventDefault();
    const newCase = {
      id: `C${Date.now()}`,
      caseNumber: `${new Date().toISOString().split('T')[0].replace(/-/g, '')}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
      repairDate: new Date().toISOString().split('T')[0],
      ...formData,
      district: '自動帶入區',
      storeAddress: '自動帶入地址',
      processStatus: '待料件',
      indicator: formData.workCategory === '緊急叫修' ? 'urgent' : 'completed',
      isClosed: false,
      actualReason: '',
      processRecords: [],
      equipment: null,
      reRepairDate: '',
      completionDate: '',
      isPerformanceIncluded: false
    };
    setCases([newCase, ...cases]);
    showToast('案件新增成功');
    setView('list');
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-gray-100"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between mb-6 pb-4 border-b"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-bold flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Plus, {
    className: "text-blue-600"
  }), " \u65B0\u589E\u6848\u4EF6"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('list'),
    className: "p-2 hover:bg-gray-100 rounded-full"
  }, /*#__PURE__*/React.createElement(X, {
    className: "h-5 w-5"
  }))), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit,
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-3 gap-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "col-span-full font-semibold text-lg text-blue-800 border-b pb-2 mb-2"
  }, "\u57FA\u672C\u8CC7\u6599"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u5BA2\u6236\u540D\u7A31"), /*#__PURE__*/React.createElement("select", {
    required: true,
    name: "customerName",
    value: formData.customerName,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none"
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "\u8ACB\u9078\u64C7"), CUSTOMER_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u9580\u5E02\u540D\u7A31"), /*#__PURE__*/React.createElement("select", {
    required: true,
    name: "storeName",
    value: formData.storeName,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none"
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "\u8ACB\u9078\u64C7"), STORE_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u53EB\u4FEE\u4EBA\u54E1"), /*#__PURE__*/React.createElement("select", {
    required: true,
    name: "reporter",
    value: formData.reporter,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none"
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "\u8ACB\u9078\u64C7"), REPORTER_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", {
    className: "col-span-full md:col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-500 mb-1"
  }, "\u9580\u5E02\u5730\u5740 (\u6839\u64DA\u9580\u5E02\u81EA\u52D5\u5E36\u5165)"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    disabled: true,
    placeholder: "\u8F38\u5165\u9580\u5E02\u5F8C\u81EA\u52D5\u5E36\u5165",
    className: "w-full p-2.5 bg-gray-50 border rounded-md text-gray-500 cursor-not-allowed"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 mb-1"
  }, "\u670D\u52D9\u7B49\u7D1A"), /*#__PURE__*/React.createElement("select", {
    name: "serviceLevel",
    value: formData.serviceLevel,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none"
  }, SERVICE_LEVEL_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", {
    className: "col-span-full font-semibold text-lg text-blue-800 border-b pb-2 mt-4 mb-2"
  }, "\u53EB\u4FEE\u5167\u5BB9"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u5DE5\u9805\u5206\u985E"), /*#__PURE__*/React.createElement("select", {
    name: "workCategory",
    value: formData.workCategory,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none"
  }, WORK_CATEGORY_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u53EB\u4FEE\u9805\u76EE"), /*#__PURE__*/React.createElement("select", {
    name: "repairItem",
    value: formData.repairItem,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none"
  }, REPAIR_ITEMS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u53EB\u4FEE\u539F\u56E0"), /*#__PURE__*/React.createElement("select", {
    name: "repairReason",
    value: formData.repairReason,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none"
  }, REPAIR_REASONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", {
    className: "col-span-full"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u6545\u969C\u63CF\u8FF0"), /*#__PURE__*/React.createElement("textarea", {
    name: "faultDesc",
    value: formData.faultDesc,
    onChange: handleChange,
    rows: "2",
    className: "w-full p-2.5 border rounded-md outline-none"
  })), /*#__PURE__*/React.createElement("div", {
    className: "col-span-full font-semibold text-lg text-blue-800 border-b pb-2 mt-4 mb-2"
  }, "\u6392\u7A0B"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u6307\u6D3E\u4EBA\u54E1"), /*#__PURE__*/React.createElement("select", {
    name: "assignee",
    value: formData.assignee,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none"
  }, ASSIGNEES.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u9810\u8A08\u65E5\u671F"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    name: "expectedDate",
    value: formData.expectedDate,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end space-x-4 pt-6 border-t"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setView('list'),
    className: "px-6 py-2.5 border rounded-md"
  }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "px-6 py-2.5 bg-blue-600 text-white rounded-md flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Save, {
    className: "h-4 w-4"
  }), " \u5132\u5B58\u65B0\u589E"))));
};
const EditCaseForm = ({
  editingCase,
  cases,
  setCases,
  setView,
  showToast
}) => {
  const [formData, setFormData] = useState(JSON.parse(JSON.stringify(editingCase)));
  const [newRecord, setNewRecord] = useState({
    category1: '工資',
    category2: '分離式',
    category3: '檢修工資',
    qty: 1
  });
  const dragProps = useDragScroll();
  const cat2Options = Object.keys(PROCESS_METHOD_CATEGORIES[newRecord.category1] || {});
  const cat3Options = newRecord.category2 ? PROCESS_METHOD_CATEGORIES[newRecord.category1][newRecord.category2] || [] : [];
  const handleCat1Change = e => {
    const val = e.target.value;
    const defaultC2 = Object.keys(PROCESS_METHOD_CATEGORIES[val])[0];
    const defaultC3 = PROCESS_METHOD_CATEGORIES[val][defaultC2][0];
    setNewRecord({
      ...newRecord,
      category1: val,
      category2: defaultC2,
      category3: defaultC3
    });
  };
  const handleCat2Change = e => {
    const val = e.target.value;
    const defaultC3 = PROCESS_METHOD_CATEGORIES[newRecord.category1][val][0];
    setNewRecord({
      ...newRecord,
      category2: val,
      category3: defaultC3
    });
  };
  const handleChange = e => {
    const {
      name,
      value
    } = e.target;
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: value
      };
      if (name === 'processStatus') {
        const d = new Date().toISOString().split('T')[0];
        if (['待料件', '待報價', '尚未處理完成'].includes(value)) {
          newData.reRepairDate = d;
        } else if (value === '案件完成') {
          newData.completionDate = d;
        }
      }
      if (name === 'customerName') {
        newData.serviceLevel = CUSTOMER_SERVICE_LEVEL_MAP[value] || '維修(無簽約客戶)';
      }
      return newData;
    });
  };
  const handleSimulateScan = e => {
    if (e) e.preventDefault();
    setFormData(prev => ({
      ...prev,
      equipment: {
        id: `E${Date.now()}`,
        customerName: prev.customerName || '測試客戶',
        storeName: prev.storeName || '測試門市',
        area: '1F 營業廳',
        type: '內',
        model: `FXMQ${Math.floor(Math.random() * 100 + 100)}`
      }
    }));
    showToast('成功掃描設備並帶入資料');
  };
  const handleAddRecord = () => {
    setFormData(prev => ({
      ...prev,
      processRecords: [...(prev.processRecords || []), {
        ...newRecord,
        id: Date.now()
      }]
    }));
  };
  const handleRemoveRecord = id => {
    setFormData(prev => ({
      ...prev,
      processRecords: prev.processRecords.filter(r => r.id !== id)
    }));
  };
  const handleSubmit = () => {
    setCases(cases.map(c => c.id === formData.id ? formData : c));
    showToast('案件資料已更新');
    setView('list');
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col max-h-[calc(100vh-140px)]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between p-6 border-b shrink-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('list')
  }, /*#__PURE__*/React.createElement(ArrowLeft, null)), /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-bold flex items-center gap-2"
  }, "\u7DE8\u8F2F\u6848\u4EF6 ", /*#__PURE__*/React.createElement("span", {
    className: "text-lg text-blue-600 bg-blue-50 px-3 py-1 rounded-full"
  }, formData.caseNumber)))), /*#__PURE__*/React.createElement("div", {
    className: "p-6 overflow-y-auto space-y-8 flex-1 bg-gray-50"
  }, /*#__PURE__*/React.createElement("section", {
    className: "bg-white p-6 rounded-lg shadow-sm border border-gray-100"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4"
  }, "1. \u6848\u4EF6\u8CC7\u6599"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-4 text-sm items-start"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1"
  }, "\u5BA2\u6236\u540D\u7A31"), /*#__PURE__*/React.createElement("select", {
    name: "customerName",
    value: formData.customerName,
    onChange: handleChange,
    className: "w-full p-2 border rounded-md outline-none"
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "\u8ACB\u9078\u64C7"), CUSTOMER_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1"
  }, "\u9580\u5E02\u540D\u7A31"), /*#__PURE__*/React.createElement("select", {
    name: "storeName",
    value: formData.storeName,
    onChange: handleChange,
    className: "w-full p-2 border rounded-md outline-none"
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "\u8ACB\u9078\u64C7"), STORE_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1"
  }, "\u53EB\u4FEE\u4EBA\u54E1"), /*#__PURE__*/React.createElement("select", {
    name: "reporter",
    value: formData.reporter,
    onChange: handleChange,
    className: "w-full p-2 border rounded-md outline-none"
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "\u8ACB\u9078\u64C7"), REPORTER_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1"
  }, "\u670D\u52D9\u7B49\u7D1A"), /*#__PURE__*/React.createElement("select", {
    name: "serviceLevel",
    value: formData.serviceLevel,
    onChange: handleChange,
    className: "w-full p-2 border rounded-md outline-none"
  }, SERVICE_LEVEL_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", {
    className: "col-span-2 md:col-span-4"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1"
  }, "\u9580\u5E02\u5730\u5740"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "storeAddress",
    value: formData.storeAddress,
    onChange: handleChange,
    className: "w-full p-2 border rounded-md outline-none"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1"
  }, "\u5DE5\u9805\u5206\u985E"), /*#__PURE__*/React.createElement("select", {
    name: "workCategory",
    value: formData.workCategory,
    onChange: handleChange,
    className: "w-full p-2 border rounded-md outline-none"
  }, WORK_CATEGORY_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1"
  }, "\u53EB\u4FEE\u9805\u76EE"), /*#__PURE__*/React.createElement("select", {
    name: "repairItem",
    value: formData.repairItem,
    onChange: handleChange,
    className: "w-full p-2 border rounded-md outline-none"
  }, REPAIR_ITEMS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1"
  }, "\u53EB\u4FEE\u539F\u56E0"), /*#__PURE__*/React.createElement("select", {
    name: "repairReason",
    value: formData.repairReason,
    onChange: handleChange,
    className: "w-full p-2 border rounded-md outline-none"
  }, REPAIR_REASONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1"
  }, "\u6307\u6D3E\u4EBA\u54E1"), /*#__PURE__*/React.createElement("select", {
    name: "assignee",
    value: formData.assignee,
    onChange: handleChange,
    className: "w-full p-2 border rounded-md outline-none"
  }, ASSIGNEES.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1"
  }, "\u9810\u8A08\u65E5\u671F"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    name: "expectedDate",
    value: formData.expectedDate,
    onChange: handleChange,
    className: "w-full p-2 border rounded-md outline-none"
  })), /*#__PURE__*/React.createElement("div", {
    className: "col-span-full"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1"
  }, "\u6545\u969C\u63CF\u8FF0"), /*#__PURE__*/React.createElement("textarea", {
    name: "faultDesc",
    value: formData.faultDesc,
    onChange: handleChange,
    rows: "2",
    className: "w-full p-2 border rounded-md outline-none"
  })))), /*#__PURE__*/React.createElement("section", {
    className: "bg-white p-6 rounded-lg shadow-sm border border-gray-100"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center border-b pb-2 mb-4"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-blue-800"
  }, "2. \u8A2D\u5099\u8CC7\u6599"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleSimulateScan,
    className: "flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-md"
  }, /*#__PURE__*/React.createElement(QrCode, {
    className: "h-4 w-4"
  }), " \u6383\u63CF\u8A2D\u5099")), formData.equipment ? /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-5 gap-y-4 gap-x-6 text-sm bg-green-50/50 p-4 rounded-md border border-green-100"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1"
  }, "\u5BA2\u6236\u540D\u7A31"), /*#__PURE__*/React.createElement("div", {
    className: "font-medium"
  }, formData.equipment.customerName)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1"
  }, "\u9580\u5E02\u540D\u7A31"), /*#__PURE__*/React.createElement("div", {
    className: "font-medium"
  }, formData.equipment.storeName)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1"
  }, "\u8A2D\u5099\u5340\u57DF"), /*#__PURE__*/React.createElement("div", {
    className: "font-medium"
  }, formData.equipment.area)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1"
  }, "\u5167/\u5916"), /*#__PURE__*/React.createElement("div", {
    className: "font-medium"
  }, formData.equipment.type)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1"
  }, "\u578B\u865F"), /*#__PURE__*/React.createElement("div", {
    className: "font-medium"
  }, formData.equipment.model))) : /*#__PURE__*/React.createElement("div", {
    className: "text-center py-8 text-gray-400 bg-gray-50 rounded-md border border-dashed"
  }, "\u8ACB\u9EDE\u64CA\u4E0A\u65B9\u6309\u9215\u6383\u63CF")), /*#__PURE__*/React.createElement("section", {
    className: "bg-white p-6 rounded-lg shadow-sm border border-gray-100 relative overflow-hidden"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4"
  }, "3. \u8655\u7406\u8CC7\u6599"), /*#__PURE__*/React.createElement("div", {
    className: `space-y-6 ${!formData.equipment ? 'opacity-30 pointer-events-none' : ''}`
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u5BE6\u969B\u7DAD\u4FEE\u539F\u56E0"), /*#__PURE__*/React.createElement("textarea", {
    name: "actualReason",
    value: formData.actualReason || '',
    onChange: handleChange,
    rows: "2",
    className: "w-full p-2 border rounded-md outline-none"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 mb-2"
  }, "\u8655\u7406\u65B9\u5F0F\u6E05\u55AE"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-3 items-end bg-gray-50 p-4 rounded-md border border-gray-200 mb-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-1 min-w-[100px]"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-gray-500 block mb-1"
  }, "\u5927\u985E"), /*#__PURE__*/React.createElement("select", {
    value: newRecord.category1,
    onChange: handleCat1Change,
    className: "w-full p-2 border rounded outline-none text-sm"
  }, Object.keys(PROCESS_METHOD_CATEGORIES).map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  }, c)))), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 min-w-[100px]"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-gray-500 block mb-1"
  }, "\u4E2D\u985E"), /*#__PURE__*/React.createElement("select", {
    value: newRecord.category2,
    onChange: handleCat2Change,
    className: "w-full p-2 border rounded outline-none text-sm"
  }, cat2Options.map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  }, c)))), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 min-w-[120px]"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-gray-500 block mb-1"
  }, "\u5C0F\u985E"), /*#__PURE__*/React.createElement("select", {
    value: newRecord.category3,
    onChange: e => setNewRecord({
      ...newRecord,
      category3: e.target.value
    }),
    className: "w-full p-2 border rounded outline-none text-sm"
  }, cat3Options.map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  }, c)))), /*#__PURE__*/React.createElement("div", {
    className: "w-20"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-gray-500 block mb-1"
  }, "\u6578\u91CF"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    value: newRecord.qty,
    onChange: e => setNewRecord({
      ...newRecord,
      qty: e.target.value
    }),
    className: "w-full p-2 border rounded outline-none text-sm text-center"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleAddRecord,
    className: "bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 h-[38px]"
  }, "\u65B0\u589E")), /*#__PURE__*/React.createElement("div", _extends({
    className: "border rounded-md overflow-x-auto"
  }, dragProps), /*#__PURE__*/React.createElement("table", {
    className: "w-full text-left text-sm whitespace-nowrap"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-100"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-2 pl-4"
  }, "\u9805\u76EE (\u5927/\u4E2D/\u5C0F\u985E)"), /*#__PURE__*/React.createElement("th", {
    className: "p-2"
  }, "\u6578\u91CF"), /*#__PURE__*/React.createElement("th", {
    className: "p-2 text-right pr-4"
  }, "\u64CD\u4F5C"))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y"
  }, !formData.processRecords || formData.processRecords.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "3",
    className: "p-4 text-center text-gray-400"
  }, "\u5C1A\u672A\u52A0\u5165\u8655\u7406\u9805\u76EE")) : formData.processRecords.map((r, idx) => /*#__PURE__*/React.createElement("tr", {
    key: r.id || idx
  }, /*#__PURE__*/React.createElement("td", {
    className: "p-2 pl-4"
  }, r.category1, " - ", r.category2, " - ", /*#__PURE__*/React.createElement("span", {
    className: "font-medium text-gray-800"
  }, r.category3)), /*#__PURE__*/React.createElement("td", {
    className: "p-2"
  }, r.qty), /*#__PURE__*/React.createElement("td", {
    className: "p-2 text-right pr-4"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => handleRemoveRecord(r.id),
    className: "text-red-500"
  }, /*#__PURE__*/React.createElement(X, {
    className: "h-4 w-4"
  }))))))))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-6"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u8655\u7406\u72C0\u614B"), /*#__PURE__*/React.createElement("select", {
    name: "processStatus",
    value: formData.processStatus,
    onChange: handleChange,
    className: "w-full p-2.5 border-2 border-blue-200 rounded-md font-medium text-blue-900 bg-blue-50/30"
  }, PROCESS_STATUS_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt))))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-100"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u53EB\u4FEE\u65E5\u671F"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    name: "repairDate",
    value: formData.repairDate || '',
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u518D\u6B21\u53EB\u4FEE\u65E5\u671F"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    name: "reRepairDate",
    value: formData.reRepairDate || '',
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none bg-gray-50"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u5B8C\u5DE5\u65E5\u671F"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    name: "completionDate",
    value: formData.completionDate || '',
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none bg-gray-50"
  })))))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 border-t bg-white flex justify-end gap-4 shrink-0 rounded-b-lg"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('list'),
    className: "px-6 py-2.5 border rounded-md"
  }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
    onClick: handleSubmit,
    className: "px-8 py-2.5 bg-blue-600 text-white rounded-md flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Save, {
    className: "h-5 w-5"
  }), " \u5132\u5B58\u66F4\u65B0")));
};

// ==========================================
//           2. 案件紀錄查詢 相關元件
// ==========================================

const CaseRecordList = ({
  cases,
  setViewingCase,
  setView
}) => {
  const [startDate, setStartDate] = useState(todayDate);
  const [endDate, setEndDate] = useState(todayDate);
  const [appliedDateRange, setAppliedDateRange] = useState({
    start: todayDate,
    end: todayDate
  });
  const dragProps = useDragScroll();
  const handleSearch = () => {
    setAppliedDateRange({
      start: startDate,
      end: endDate
    });
  };
  const filteredCases = useMemo(() => {
    return cases.filter(c => c.repairDate >= appliedDateRange.start && c.repairDate <= appliedDateRange.end).sort((a, b) => new Date(b.repairDate) - new Date(a.repairDate));
  }, [cases, appliedDateRange]);
  return /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-6 rounded-lg shadow-sm border border-gray-100"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 mb-6 pb-6 border-b"
  }, /*#__PURE__*/React.createElement(Calendar, {
    className: "h-5 w-5 text-gray-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "font-medium text-gray-700"
  }, "\u67E5\u8A62\u5340\u9593\uFF1A"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: startDate,
    onChange: e => setStartDate(e.target.value),
    className: "p-2 border rounded-md outline-none"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500"
  }, "\u81F3"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: endDate,
    onChange: e => setEndDate(e.target.value),
    className: "p-2 border rounded-md outline-none"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleSearch,
    className: "bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors hover:bg-blue-700"
  }, /*#__PURE__*/React.createElement(Search, {
    className: "h-4 w-4"
  }), " \u641C\u5C0B")), /*#__PURE__*/React.createElement("div", _extends({
    className: "overflow-x-auto border rounded-lg cursor-grab active:cursor-grabbing"
  }, dragProps), /*#__PURE__*/React.createElement("table", {
    className: "w-full text-left text-sm text-gray-600 whitespace-nowrap select-none"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 text-gray-700 border-b"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-3 w-20 text-center"
  }, "\u64CD\u4F5C"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u53EB\u4FEE\u65E5\u671F"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u6848\u4EF6\u7DE8\u865F"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u5BA2\u6236\u540D\u7A31"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u9580\u5E02\u540D\u7A31"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u884C\u653F\u5340\u57DF"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u5DE5\u9805\u5206\u985E"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u53EB\u4FEE\u9805\u76EE"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u53EB\u4FEE\u539F\u56E0"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold max-w-[150px]"
  }, "\u6545\u969C\u63CF\u8FF0"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold max-w-[150px]"
  }, "\u5BE6\u969B\u539F\u56E0"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u6307\u6D3E\u4EBA\u54E1"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u6848\u4EF6\u72C0\u614B"))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-gray-100"
  }, filteredCases.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "13",
    className: "text-center p-8 text-gray-400"
  }, "\u7121\u8CC7\u6599\u7B26\u5408\u76EE\u524D\u641C\u5C0B\u5340\u9593")) : filteredCases.map(c => /*#__PURE__*/React.createElement("tr", {
    key: c.id,
    className: "hover:bg-gray-50 transition-colors"
  }, /*#__PURE__*/React.createElement("td", {
    className: "p-3 text-center"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setViewingCase(c);
      setView('record-view');
    },
    className: "p-1.5 text-blue-600 hover:bg-blue-100 rounded",
    title: "\u67E5\u770B\u660E\u7D30"
  }, /*#__PURE__*/React.createElement(Eye, {
    className: "h-4 w-4"
  }))), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.repairDate), /*#__PURE__*/React.createElement("td", {
    className: "p-3 font-medium text-blue-700"
  }, c.caseNumber), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.customerName), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.storeName), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.district), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.workCategory), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.repairItem), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.repairReason), /*#__PURE__*/React.createElement("td", {
    className: "p-3 max-w-[150px] truncate",
    title: c.faultDesc
  }, c.faultDesc), /*#__PURE__*/React.createElement("td", {
    className: "p-3 max-w-[150px] truncate",
    title: c.actualReason
  }, c.actualReason || '-'), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.assignee), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200"
  }, c.processStatus))))))));
};

// ==========================================
//           3. 案件銷案審核 相關元件
// ==========================================

const CaseReviewList = ({
  cases,
  setCases,
  setViewingCase,
  setView,
  showToast
}) => {
  const [startDate, setStartDate] = useState(todayDate);
  const [endDate, setEndDate] = useState(todayDate);
  const [appliedDateRange, setAppliedDateRange] = useState({
    start: todayDate,
    end: todayDate
  });
  const [includeConfirmModal, setIncludeConfirmModal] = useState({
    show: false,
    caseId: null
  });
  const dragProps = useDragScroll();
  const handleSearch = () => {
    setAppliedDateRange({
      start: startDate,
      end: endDate
    });
  };
  const filteredCases = useMemo(() => {
    return cases.filter(c => c.isClosed && !c.isPerformanceIncluded && c.repairDate >= appliedDateRange.start && c.repairDate <= appliedDateRange.end).sort((a, b) => new Date(b.repairDate) - new Date(a.repairDate));
  }, [cases, appliedDateRange]);
  const handleIncludePerformance = caseId => {
    setCases(cases.map(c => c.id === caseId ? {
      ...c,
      isPerformanceIncluded: true
    } : c));
    setIncludeConfirmModal({
      show: false,
      caseId: null
    });
    showToast('已成功列入案件績效');
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-6 rounded-lg shadow-sm border border-gray-100"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 mb-6 pb-6 border-b"
  }, /*#__PURE__*/React.createElement(Calendar, {
    className: "h-5 w-5 text-gray-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "font-medium text-gray-700"
  }, "\u67E5\u8A62\u5340\u9593\uFF1A"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: startDate,
    onChange: e => setStartDate(e.target.value),
    className: "p-2 border rounded-md outline-none"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500"
  }, "\u81F3"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: endDate,
    onChange: e => setEndDate(e.target.value),
    className: "p-2 border rounded-md outline-none"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleSearch,
    className: "bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors hover:bg-blue-700"
  }, /*#__PURE__*/React.createElement(Search, {
    className: "h-4 w-4"
  }), " \u641C\u5C0B")), /*#__PURE__*/React.createElement("div", _extends({
    className: "overflow-x-auto border rounded-lg cursor-grab active:cursor-grabbing"
  }, dragProps), /*#__PURE__*/React.createElement("table", {
    className: "w-full text-left text-sm text-gray-600 whitespace-nowrap select-none"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 text-gray-700 border-b"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-3 w-24 text-center"
  }, "\u64CD\u4F5C"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u53EB\u4FEE\u65E5\u671F"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u6848\u4EF6\u7DE8\u865F"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u5BA2\u6236\u540D\u7A31"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u9580\u5E02\u540D\u7A31"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u884C\u653F\u5340\u57DF"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u670D\u52D9\u7B49\u7D1A"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u5DE5\u9805\u5206\u985E"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u53EB\u4FEE\u9805\u76EE"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u53EB\u4FEE\u539F\u56E0"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold max-w-[150px]"
  }, "\u5BE6\u969B\u539F\u56E0"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u6307\u6D3E\u4EBA\u54E1"))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-gray-100"
  }, filteredCases.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "12",
    className: "text-center p-8 text-gray-400"
  }, "\u7121\u8CC7\u6599\u7B26\u5408\u76EE\u524D\u641C\u5C0B\u5340\u9593")) : filteredCases.map(c => /*#__PURE__*/React.createElement("tr", {
    key: c.id,
    className: "hover:bg-gray-50 transition-colors"
  }, /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-center space-x-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setViewingCase(c);
      setView('review-view');
    },
    className: "p-1.5 text-blue-600 hover:bg-blue-100 rounded",
    title: "\u67E5\u770B\u660E\u7D30"
  }, /*#__PURE__*/React.createElement(Eye, {
    className: "h-4 w-4"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setIncludeConfirmModal({
      show: true,
      caseId: c.id
    }),
    className: "p-1.5 text-amber-500 hover:bg-amber-100 rounded",
    title: "\u5217\u5165\u6848\u4EF6\u7E3E\u6548"
  }, /*#__PURE__*/React.createElement(Star, {
    className: "h-4 w-4"
  })))), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.repairDate), /*#__PURE__*/React.createElement("td", {
    className: "p-3 font-medium text-blue-700"
  }, c.caseNumber), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.customerName), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.storeName), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.district), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.serviceLevel), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.workCategory), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.repairItem), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.repairReason), /*#__PURE__*/React.createElement("td", {
    className: "p-3 max-w-[150px] truncate",
    title: c.actualReason
  }, c.actualReason || '-'), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.assignee)))))), includeConfirmModal.show && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center z-50"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-3 text-amber-500 mb-4"
  }, /*#__PURE__*/React.createElement(Star, {
    className: "h-6 w-6"
  }), /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-gray-800"
  }, "\u5217\u5165\u7E3E\u6548")), /*#__PURE__*/React.createElement("p", {
    className: "text-gray-600 mb-6"
  }, "\u78BA\u5B9A\u8981\u5C07\u6B64\u6848\u4EF6\u5217\u5165\u7E3E\u6548\u8A08\u7B97\u55CE\uFF1F\u64CD\u4F5C\u5F8C\u5C07\u5F9E\u6B64\u5BE9\u6838\u5217\u8868\u4E2D\u79FB\u9664\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end space-x-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setIncludeConfirmModal({
      show: false,
      caseId: null
    }),
    className: "px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
  }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleIncludePerformance(includeConfirmModal.caseId),
    className: "px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors"
  }, "\u78BA\u8A8D\u5217\u5165")))));
};

// --- 共用元件：查看案件明細 ---
const ViewCaseForm = ({
  viewingCase,
  setView,
  backView = 'record-list'
}) => {
  const dragProps = useDragScroll();
  const ReadOnlyField = ({
    label,
    value,
    fullWidth = false
  }) => /*#__PURE__*/React.createElement("div", {
    className: fullWidth ? "col-span-full" : ""
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1 text-xs"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "font-medium bg-gray-50 p-2.5 rounded-md border border-gray-100 min-h-[42px] flex items-center"
  }, value || '-'));
  return /*#__PURE__*/React.createElement("div", {
    className: "max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col max-h-[calc(100vh-140px)]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between p-6 border-b shrink-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setView(backView)
  }, /*#__PURE__*/React.createElement(ArrowLeft, null)), /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-bold flex items-center gap-2"
  }, "\u67E5\u770B\u6848\u4EF6\u660E\u7D30 ", /*#__PURE__*/React.createElement("span", {
    className: "text-lg text-blue-600 bg-blue-50 px-3 py-1 rounded-full"
  }, viewingCase?.caseNumber)))), /*#__PURE__*/React.createElement("div", {
    className: "p-6 overflow-y-auto space-y-8 flex-1 bg-gray-50"
  }, /*#__PURE__*/React.createElement("section", {
    className: "bg-white p-6 rounded-lg shadow-sm border border-gray-100"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4"
  }, "1. \u6848\u4EF6\u8CC7\u6599"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-4 text-sm items-start"
  }, /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u5BA2\u6236\u540D\u7A31",
    value: viewingCase?.customerName
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u9580\u5E02\u540D\u7A31",
    value: viewingCase?.storeName
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u53EB\u4FEE\u4EBA\u54E1",
    value: viewingCase?.reporter
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u670D\u52D9\u7B49\u7D1A",
    value: viewingCase?.serviceLevel
  }), /*#__PURE__*/React.createElement("div", {
    className: "col-span-2 md:col-span-4"
  }, /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u9580\u5E02\u5730\u5740",
    value: viewingCase?.storeAddress
  })), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u5DE5\u9805\u5206\u985E",
    value: viewingCase?.workCategory
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u53EB\u4FEE\u9805\u76EE",
    value: viewingCase?.repairItem
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u53EB\u4FEE\u539F\u56E0",
    value: viewingCase?.repairReason
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u6307\u6D3E\u4EBA\u54E1",
    value: viewingCase?.assignee
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u9810\u8A08\u65E5\u671F",
    value: viewingCase?.expectedDate
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u6545\u969C\u63CF\u8FF0",
    value: viewingCase?.faultDesc,
    fullWidth: true
  }))), /*#__PURE__*/React.createElement("section", {
    className: "bg-white p-6 rounded-lg shadow-sm border border-gray-100"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4"
  }, "2. \u8A2D\u5099\u8CC7\u6599"), viewingCase?.equipment ? /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-5 gap-4 text-sm bg-green-50/50 p-4 rounded-md border border-green-100"
  }, /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u5BA2\u6236\u540D\u7A31",
    value: viewingCase.equipment.customerName
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u9580\u5E02\u540D\u7A31",
    value: viewingCase.equipment.storeName
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u8A2D\u5099\u5340\u57DF",
    value: viewingCase.equipment.area
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u5167/\u5916",
    value: viewingCase.equipment.type
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u578B\u865F",
    value: viewingCase.equipment.model
  })) : /*#__PURE__*/React.createElement("div", {
    className: "text-center py-4 text-gray-400 bg-gray-50 rounded-md border border-dashed"
  }, "\u7121\u8A2D\u5099\u8CC7\u6599")), /*#__PURE__*/React.createElement("section", {
    className: "bg-white p-6 rounded-lg shadow-sm border border-gray-100"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4"
  }, "3. \u8655\u7406\u8CC7\u6599"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u5BE6\u969B\u7DAD\u4FEE\u539F\u56E0",
    value: viewingCase?.actualReason,
    fullWidth: true
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-2 text-sm"
  }, "\u8655\u7406\u65B9\u5F0F\u6E05\u55AE"), /*#__PURE__*/React.createElement("div", _extends({
    className: "border rounded-md overflow-x-auto"
  }, dragProps), /*#__PURE__*/React.createElement("table", {
    className: "w-full text-left text-sm whitespace-nowrap"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-100"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-2 pl-4"
  }, "\u9805\u76EE (\u5927/\u4E2D/\u5C0F\u985E)"), /*#__PURE__*/React.createElement("th", {
    className: "p-2"
  }, "\u6578\u91CF"))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y"
  }, !viewingCase?.processRecords || viewingCase.processRecords.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "2",
    className: "p-4 text-center text-gray-400"
  }, "\u7121\u8655\u7406\u65B9\u5F0F\u7D00\u9304")) : viewingCase.processRecords.map((r, idx) => /*#__PURE__*/React.createElement("tr", {
    key: r.id || idx
  }, /*#__PURE__*/React.createElement("td", {
    className: "p-2 pl-4"
  }, r.category1, " - ", r.category2, " - ", /*#__PURE__*/React.createElement("span", {
    className: "font-medium text-gray-800"
  }, r.category3)), /*#__PURE__*/React.createElement("td", {
    className: "p-2"
  }, r.qty))))))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-6"
  }, /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u8655\u7406\u72C0\u614B",
    value: viewingCase?.processStatus
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-100"
  }, /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u53EB\u4FEE\u65E5\u671F",
    value: viewingCase?.repairDate
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u518D\u6B21\u53EB\u4FEE\u65E5\u671F",
    value: viewingCase?.reRepairDate
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u5B8C\u5DE5\u65E5\u671F",
    value: viewingCase?.completionDate
  }))))));
};

// ==========================================
//           4. 保養計劃進度 相關元件
// ==========================================

const MaintenanceList = ({
  cases,
  setCases,
  setViewingCase,
  setEditingCase,
  setView,
  showToast
}) => {
  const [filterMonthStart, setFilterMonthStart] = useState(currentMonthStr);
  const [filterMonthEnd, setFilterMonthEnd] = useState(currentMonthStr);
  const [filterCustomer, setFilterCustomer] = useState('全部');
  const [filterDistrict, setFilterDistrict] = useState('全部');
  const [filterStatus, setFilterStatus] = useState('全部');
  const [appliedFilters, setAppliedFilters] = useState({
    start: currentMonthStr,
    end: currentMonthStr,
    customer: '全部',
    district: '全部',
    status: '全部'
  });
  const [closeConfirmModal, setCloseConfirmModal] = useState({
    show: false,
    id: null
  });
  const dragProps = useDragScroll();
  const handleSearch = () => {
    setAppliedFilters({
      start: filterMonthStart,
      end: filterMonthEnd,
      customer: filterCustomer,
      district: filterDistrict,
      status: filterStatus
    });
  };
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      if (c.isClosed) return false;
      const caseMonth = c.planDate ? c.planDate.slice(0, 7) : '';
      if (caseMonth && (caseMonth < appliedFilters.start || caseMonth > appliedFilters.end)) return false;
      if (appliedFilters.customer !== '全部' && c.customerName !== appliedFilters.customer) return false;
      if (appliedFilters.district !== '全部' && c.district !== appliedFilters.district) return false;
      if (appliedFilters.status !== '全部' && c.status !== appliedFilters.status) return false;
      return true;
    }).sort((a, b) => new Date(b.planDate || '1970-01-01') - new Date(a.planDate || '1970-01-01'));
  }, [cases, appliedFilters]);
  const handleCloseCase = id => {
    setCases(cases.map(c => c.id === id ? {
      ...c,
      isClosed: true,
      status: '已完工'
    } : c));
    setCloseConfirmModal({
      show: false,
      id: null
    });
    showToast('保養單已結案並移至銷案審核');
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-6 rounded-lg shadow-sm border border-gray-100"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-gray-500 mb-1"
  }, "\u958B\u59CB\u6708\u4EFD"), /*#__PURE__*/React.createElement("input", {
    type: "month",
    value: filterMonthStart,
    onChange: e => setFilterMonthStart(e.target.value),
    className: "w-full p-2 border rounded-md outline-none"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-gray-500 mb-1"
  }, "\u7D50\u675F\u6708\u4EFD"), /*#__PURE__*/React.createElement("input", {
    type: "month",
    value: filterMonthEnd,
    onChange: e => setFilterMonthEnd(e.target.value),
    className: "w-full p-2 border rounded-md outline-none"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-gray-500 mb-1"
  }, "\u5BA2\u6236\u540D\u7A31"), /*#__PURE__*/React.createElement("select", {
    value: filterCustomer,
    onChange: e => setFilterCustomer(e.target.value),
    className: "w-full p-2 border rounded-md outline-none"
  }, /*#__PURE__*/React.createElement("option", {
    value: "\u5168\u90E8"
  }, "\u5168\u90E8"), CUSTOMER_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-gray-500 mb-1"
  }, "\u884C\u653F\u5340\u57DF"), /*#__PURE__*/React.createElement("select", {
    value: filterDistrict,
    onChange: e => setFilterDistrict(e.target.value),
    className: "w-full p-2 border rounded-md outline-none"
  }, /*#__PURE__*/React.createElement("option", {
    value: "\u5168\u90E8"
  }, "\u5168\u90E8"), DISTRICT_OPTIONS.map(d => /*#__PURE__*/React.createElement("option", {
    key: d,
    value: d
  }, d)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-gray-500 mb-1"
  }, "\u4FDD\u990A\u72C0\u614B"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("select", {
    value: filterStatus,
    onChange: e => setFilterStatus(e.target.value),
    className: "w-full p-2 border rounded-md outline-none"
  }, /*#__PURE__*/React.createElement("option", {
    value: "\u5168\u90E8"
  }, "\u5168\u90E8"), MAINTENANCE_STATUS_OPTIONS.map(s => /*#__PURE__*/React.createElement("option", {
    key: s,
    value: s
  }, s))), /*#__PURE__*/React.createElement("button", {
    onClick: handleSearch,
    className: "bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-1"
  }, /*#__PURE__*/React.createElement(Search, {
    className: "h-4 w-4"
  }), " \u641C\u5C0B"))))), /*#__PURE__*/React.createElement("div", _extends({
    className: "overflow-x-auto border rounded-lg cursor-grab active:cursor-grabbing"
  }, dragProps), /*#__PURE__*/React.createElement("table", {
    className: "w-full text-left text-sm text-gray-600 whitespace-nowrap select-none"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 text-gray-700 border-b"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold text-center w-28"
  }, "\u64CD\u4F5C"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u6848\u4EF6\u7DE8\u865F"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u5BA2\u6236\u540D\u7A31"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u9580\u5E02\u540D\u7A31"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u884C\u653F\u5340\u57DF"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold text-center"
  }, "\u670D\u52D9\u7B49\u7D1A"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold text-center"
  }, "\u4FDD\u990A\u72C0\u614B"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u4FDD\u990A\u65E5\u671F"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u4FDD\u990A\u4EBA\u54E1"))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-gray-100"
  }, filteredCases.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "9",
    className: "text-center p-8 text-gray-400"
  }, "\u7121\u7B26\u5408\u689D\u4EF6\u4E4B\u4FDD\u990A\u8CC7\u6599")) : filteredCases.map(c => /*#__PURE__*/React.createElement("tr", {
    key: c.id,
    className: "hover:bg-blue-50/50 transition-colors"
  }, /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-center space-x-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEditingCase(c);
      setView('maintenance-edit');
    },
    className: "p-1.5 text-blue-600 hover:bg-blue-100 rounded",
    title: "\u67E5\u770B/\u7DE8\u8F2F"
  }, /*#__PURE__*/React.createElement(Edit, {
    className: "h-4 w-4"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setCloseConfirmModal({
      show: true,
      id: c.id
    }),
    className: "p-1.5 text-green-600 hover:bg-green-100 rounded",
    title: "\u6848\u4EF6\u7D50\u6848"
  }, /*#__PURE__*/React.createElement(CheckCircle, {
    className: "h-4 w-4"
  })))), /*#__PURE__*/React.createElement("td", {
    className: "p-3 font-medium text-blue-700"
  }, c.caseNumber || /*#__PURE__*/React.createElement("span", {
    className: "text-gray-400 italic"
  }, "\u5F85\u6392\u7A0B\u7522\u751F")), /*#__PURE__*/React.createElement("td", {
    className: "p-3 font-medium text-gray-800"
  }, c.customerName), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.storeName), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.district), /*#__PURE__*/React.createElement("td", {
    className: "p-3 text-center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
  }, c.serviceLevel)), /*#__PURE__*/React.createElement("td", {
    className: "p-3 text-center"
  }, /*#__PURE__*/React.createElement("span", {
    className: `px-2 py-1 rounded-full text-xs font-medium ${c.status === '已完工' ? 'bg-green-100 text-green-700' : c.status === '逾期' ? 'bg-red-100 text-red-700' : c.status === '待排程' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`
  }, c.status)), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.planDate || '未定'), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.assignee)))))), closeConfirmModal.show && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center z-50"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-3 text-yellow-600 mb-4"
  }, /*#__PURE__*/React.createElement(AlertCircle, {
    className: "h-6 w-6"
  }), /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-gray-800"
  }, "\u78BA\u8A8D\u7D50\u6848")), /*#__PURE__*/React.createElement("p", {
    className: "text-gray-600 mb-6"
  }, "\u78BA\u5B9A\u8981\u5C07\u6B64\u4FDD\u990A\u55AE\u6A19\u8A18\u70BA\u7D50\u6848\u55CE\uFF1F\u7D50\u6848\u5F8C\u72C0\u614B\u5C07\u66F4\u65B0\u4E26\u79FB\u81F3\u300C\u6848\u4EF6\u92B7\u6848\u5BE9\u6838\u300D\u5217\u8868\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end space-x-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setCloseConfirmModal({
      show: false,
      id: null
    }),
    className: "px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
  }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleCloseCase(closeConfirmModal.id),
    className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
  }, "\u78BA\u8A8D\u7D50\u6848")))));
};
const MaintenanceViewEditForm = ({
  targetCase,
  cases,
  setCases,
  setView,
  mode,
  showToast
}) => {
  const [formData, setFormData] = useState(targetCase);
  const isEdit = mode === 'edit';
  const ReadOnlyField = ({
    label,
    value
  }) => /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1 text-xs"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "font-medium bg-gray-50 p-2.5 rounded-md border border-gray-100 min-h-[42px]"
  }, value || '-'));
  const handleSubmit = () => {
    let updatedData = {
      ...formData
    };

    // 如果原本沒有編號，且現在有了保養日期，就產生一組新編號
    if (!updatedData.caseNumber && updatedData.planDate) {
      updatedData.caseNumber = `${updatedData.planDate.replace(/-/g, '')}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
      showToast(`已產生案件編號：${updatedData.caseNumber}`);
    } else {
      showToast('保養狀態已更新');
    }
    setCases(cases.map(c => c.id === updatedData.id ? updatedData : c));
    setView('maintenance-list');
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "max-w-4xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between p-6 border-b"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('maintenance-list')
  }, /*#__PURE__*/React.createElement(ArrowLeft, null)), /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-bold"
  }, "\u67E5\u770B/\u7DE8\u8F2F\u4FDD\u990A\u660E\u7D30 ", /*#__PURE__*/React.createElement("span", {
    className: "text-lg font-normal text-blue-600 bg-blue-50 px-3 py-1 rounded-full"
  }, formData.caseNumber || '待排程產生編號')))), /*#__PURE__*/React.createElement("div", {
    className: "p-6 space-y-8"
  }, /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4"
  }, "\u6848\u4EF6\u8207\u9580\u5E02\u8CC7\u8A0A"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-3 gap-4"
  }, /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u6848\u4EF6\u7DE8\u865F",
    value: formData.caseNumber || '(依保養日期自動產生)'
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u5BA2\u6236\u540D\u7A31",
    value: formData.customerName
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u9580\u5E02\u540D\u7A31",
    value: formData.storeName
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u884C\u653F\u5340\u57DF",
    value: formData.district
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u9580\u5E02\u5730\u5740",
    value: formData.storeAddress
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u670D\u52D9\u7B49\u7D1A",
    value: formData.serviceLevel
  }))), /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4"
  }, "\u4FDD\u990A\u4F5C\u696D\u72C0\u614B"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-3 gap-6"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1 text-xs"
  }, "\u4FDD\u990A\u72C0\u614B"), isEdit ? /*#__PURE__*/React.createElement("select", {
    value: formData.status,
    onChange: e => setFormData({
      ...formData,
      status: e.target.value
    }),
    className: "w-full p-2.5 border rounded outline-none"
  }, MAINTENANCE_STATUS_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt))) : /*#__PURE__*/React.createElement(ReadOnlyField, {
    value: formData.status
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1 text-xs"
  }, "\u4FDD\u990A\u65E5\u671F"), isEdit ? /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: formData.planDate,
    onChange: e => setFormData({
      ...formData,
      planDate: e.target.value
    }),
    className: "w-full p-2.5 border rounded outline-none"
  }) : /*#__PURE__*/React.createElement(ReadOnlyField, {
    value: formData.planDate
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1 text-xs"
  }, "\u4FDD\u990A\u4EBA\u54E1"), isEdit ? /*#__PURE__*/React.createElement("select", {
    value: formData.assignee,
    onChange: e => setFormData({
      ...formData,
      assignee: e.target.value
    }),
    className: "w-full p-2.5 border rounded outline-none"
  }, /*#__PURE__*/React.createElement("option", {
    value: "\u5C1A\u672A\u6307\u6D3E"
  }, "\u5C1A\u672A\u6307\u6D3E"), ASSIGNEES.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt))) : /*#__PURE__*/React.createElement(ReadOnlyField, {
    value: formData.assignee
  }))))), isEdit && /*#__PURE__*/React.createElement("div", {
    className: "p-4 border-t bg-white flex justify-end gap-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('maintenance-list'),
    className: "px-6 py-2.5 border rounded-md"
  }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
    onClick: handleSubmit,
    className: "px-8 py-2.5 bg-blue-600 text-white rounded-md"
  }, /*#__PURE__*/React.createElement(Save, {
    className: "inline h-4 w-4 mr-2"
  }), "\u5132\u5B58\u72C0\u614B")));
};

// ==========================================
//           5. 工程立案 相關元件
// ==========================================

const ProjectHistoryModal = ({
  caseData,
  onClose,
  onAddComment
}) => {
  const [inputText, setInputText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [tagMenu, setTagMenu] = useState({
    show: false,
    type: '',
    search: '',
    options: [],
    matchStart: 0,
    matchEnd: 0
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const menuRef = useRef(null);

  // 捲動到最新訊息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  }, [caseData.comments]);
  const handleInputChange = e => {
    const val = e.target.value;
    setInputText(val);
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    // 找出游標前最近的 @ 或 #
    const match = textBeforeCursor.match(/([@#])([^\s]*)$/);
    if (match) {
      const matchIndex = match.index;
      // 確保標記符號前是空白或為字串開頭
      const isPrecededBySpace = matchIndex === 0 || /\s/.test(textBeforeCursor[matchIndex - 1]);
      if (isPrecededBySpace) {
        const type = match[1];
        const search = match[2];
        const matchStart = matchIndex;
        const matchEnd = cursorPos;
        let options = [];
        if (type === '@') {
          options = PROJECT_ASSIGNEES.filter(a => a !== '尚未指派' && a.toLowerCase().includes(search.toLowerCase()));
        } else if (type === '#') {
          options = DYNAMIC_PROJECT_TAGS.filter(t => t.toLowerCase().includes(search.toLowerCase()));
          // 若搜尋的標籤不存在，允許新增
          if (search && !DYNAMIC_PROJECT_TAGS.some(t => t.toLowerCase() === search.toLowerCase())) {
            options.push(search);
          }
        }
        if (options.length > 0) {
          setTagMenu({
            show: true,
            type,
            search,
            options,
            matchStart,
            matchEnd
          });
          setSelectedIndex(0);
        } else {
          setTagMenu(prev => ({
            ...prev,
            show: false
          }));
        }
        return;
      }
    }
    setTagMenu(prev => ({
      ...prev,
      show: false
    }));
  };
  const handleTagSelect = option => {
    // 若為新的標籤，加入全域暫存
    if (tagMenu.type === '#' && !DYNAMIC_PROJECT_TAGS.includes(option)) {
      DYNAMIC_PROJECT_TAGS.push(option);
    }
    const before = inputText.slice(0, tagMenu.matchStart);
    const after = inputText.slice(tagMenu.matchEnd);
    const newText = before + tagMenu.type + option + ' ' + after;
    setInputText(newText);
    setTagMenu({
      show: false,
      type: '',
      search: '',
      options: [],
      matchStart: 0,
      matchEnd: 0
    });

    // 延遲讓 textarea 重新 focus 並設定正確的光標位置
    setTimeout(() => {
      const input = document.getElementById('chatInput');
      if (input) {
        input.focus();
        const newCursorPos = before.length + option.length + 2;
        input.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };
  const scrollMenuItemIntoView = index => {
    if (menuRef.current) {
      const items = menuRef.current.querySelectorAll('button');
      if (items[index]) items[index].scrollIntoView({
        block: 'nearest'
      });
    }
  };
  const handleKeyDown = e => {
    if (tagMenu.show) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => {
          const next = (prev + 1) % tagMenu.options.length;
          scrollMenuItemIntoView(next);
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => {
          const next = (prev - 1 + tagMenu.options.length) % tagMenu.options.length;
          scrollMenuItemIntoView(next);
          return next;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleTagSelect(tagMenu.options[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setTagMenu(prev => ({
          ...prev,
          show: false
        }));
      }
    } else {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    }
  };
  const handleFileSelect = e => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        alert('請上傳 PDF 檔案');
        return;
      }
      setAttachment(file);
    }
  };
  const handleSend = () => {
    if (!inputText.trim() && !attachment) return;
    const now = new Date();
    const timeString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newComment = {
      id: Date.now(),
      author: '管理員',
      timestamp: timeString,
      content: inputText.trim(),
      attachment: attachment ? attachment.name : null
    };
    onAddComment(caseData.id, newComment);
    setInputText('');
    setAttachment(null);
    setTagMenu({
      show: false,
      type: '',
      search: '',
      options: [],
      matchStart: 0,
      matchEnd: 0
    });
  };
  const renderContent = text => {
    if (!text) return null;
    const parts = text.split(/(@\S+|#\S+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) return /*#__PURE__*/React.createElement("span", {
        key: i,
        className: "text-blue-600 font-medium"
      }, part);
      if (part.startsWith('#')) return /*#__PURE__*/React.createElement("span", {
        key: i,
        className: "text-indigo-600 font-medium"
      }, part);
      return /*#__PURE__*/React.createElement("span", {
        key: i
      }, part);
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center z-50"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-lg shadow-xl w-[600px] max-w-full m-4 flex flex-col h-[80vh]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between p-4 border-b shrink-0 bg-gray-50 rounded-t-lg"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-gray-800 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Clock, {
    className: "h-5 w-5 text-indigo-600"
  }), "\u6848\u4EF6\u6B77\u7A0B ", /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-normal text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded"
  }, caseData.projectNumber)), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "text-gray-500 hover:bg-gray-200 p-1.5 rounded-full transition-colors"
  }, /*#__PURE__*/React.createElement(X, {
    className: "h-5 w-5"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-y-auto p-4 bg-gray-100/50 space-y-4"
  }, !caseData.comments || caseData.comments.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-center text-gray-400 py-8"
  }, "\u5C1A\u7121\u4EFB\u4F55\u8A3B\u8A18\u8AAA\u660E") : caseData.comments.map(msg => /*#__PURE__*/React.createElement("div", {
    key: msg.id,
    className: "flex flex-col gap-1 max-w-[85%]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-baseline gap-2 px-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-gray-800 text-sm"
  }, msg.author), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-gray-400"
  }, msg.timestamp)), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-3 rounded-lg rounded-tl-none shadow-sm border border-gray-100 text-gray-700 text-sm whitespace-pre-wrap"
  }, renderContent(msg.content), msg.attachment && /*#__PURE__*/React.createElement("div", {
    className: "mt-3 flex items-center gap-2 text-indigo-600 bg-indigo-50 p-2 rounded border border-indigo-100 cursor-pointer hover:bg-indigo-100 transition-colors"
  }, /*#__PURE__*/React.createElement(FileText, {
    className: "h-4 w-4 shrink-0"
  }), /*#__PURE__*/React.createElement("span", {
    className: "truncate"
  }, msg.attachment))))), /*#__PURE__*/React.createElement("div", {
    ref: messagesEndRef
  })), /*#__PURE__*/React.createElement("div", {
    className: "p-4 border-t bg-white shrink-0 relative rounded-b-lg"
  }, tagMenu.show && /*#__PURE__*/React.createElement("div", {
    ref: menuRef,
    className: "absolute bottom-full mb-2 left-4 bg-white border border-gray-200 rounded-md shadow-lg py-1 w-48 max-h-48 overflow-y-auto z-10"
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-3 py-1 text-xs font-bold text-gray-400 bg-gray-50 border-b border-gray-100 mb-1 flex justify-between"
  }, /*#__PURE__*/React.createElement("span", null, tagMenu.type === '@' ? '標註人員' : '加入主題標籤'), /*#__PURE__*/React.createElement("span", {
    className: "font-normal text-[10px]"
  }, "\u4E0A\u4E0B\u9375\u9078\u64C7")), tagMenu.options.map((opt, idx) => {
    const isSelected = idx === selectedIndex;
    const isNew = tagMenu.type === '#' && !DYNAMIC_PROJECT_TAGS.includes(opt);
    return /*#__PURE__*/React.createElement("button", {
      key: `${opt}-${idx}`,
      onClick: () => handleTagSelect(opt),
      onMouseEnter: () => setSelectedIndex(idx),
      className: `w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${isSelected ? 'bg-indigo-100 text-indigo-800 font-medium' : 'text-gray-700 hover:bg-indigo-50'}`
    }, /*#__PURE__*/React.createElement("span", null, opt), isNew && /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded shadow-sm border border-green-200"
    }, "\u65B0\u589E"));
  })), attachment && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between bg-indigo-50 p-2 rounded mb-2 border border-indigo-100"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 text-sm text-indigo-700 truncate"
  }, /*#__PURE__*/React.createElement(FileText, {
    className: "h-4 w-4 shrink-0"
  }), /*#__PURE__*/React.createElement("span", {
    className: "truncate"
  }, attachment.name)), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAttachment(null),
    className: "text-gray-400 hover:text-red-500 p-1"
  }, /*#__PURE__*/React.createElement(X, {
    className: "h-4 w-4"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-end gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-1 bg-gray-50 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all flex items-end"
  }, /*#__PURE__*/React.createElement("textarea", {
    id: "chatInput",
    value: inputText,
    onChange: handleInputChange,
    onKeyDown: handleKeyDown,
    placeholder: "\u8F38\u5165\u8A3B\u8A18\u8AAA\u660E... (\u4F7F\u7528 @ \u6A19\u8A3B\u4EBA\u54E1\uFF0C# \u52A0\u5165\u6A19\u7C64)",
    className: "w-full bg-transparent border-none focus:ring-0 resize-none p-3 text-sm outline-none",
    rows: "2"
  }), /*#__PURE__*/React.createElement("div", {
    className: "p-2 shrink-0"
  }, /*#__PURE__*/React.createElement("input", {
    type: "file",
    ref: fileInputRef,
    onChange: handleFileSelect,
    accept: ".pdf",
    className: "hidden"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => fileInputRef.current?.click(),
    className: `p-2 rounded-full transition-colors ${attachment ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600'}`,
    title: "\u4E0A\u50B3 PDF \u9644\u4EF6"
  }, /*#__PURE__*/React.createElement(Paperclip, {
    className: "h-5 w-5"
  })))), /*#__PURE__*/React.createElement("button", {
    onClick: handleSend,
    disabled: !inputText.trim() && !attachment,
    className: "p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0",
    title: "\u767C\u9001 (Enter)"
  }, /*#__PURE__*/React.createElement(Send, {
    className: "h-5 w-5"
  }))))));
};
const ProjectList = ({
  cases,
  setCases,
  setEditingCase,
  setView,
  showToast
}) => {
  const [startDate, setStartDate] = useState(todayDate);
  const [endDate, setEndDate] = useState(todayDate);
  const [appliedDateRange, setAppliedDateRange] = useState({
    start: todayDate,
    end: todayDate
  });
  const [historyModal, setHistoryModal] = useState({
    show: false,
    caseData: null
  });
  const [closeConfirmModal, setCloseConfirmModal] = useState({
    show: false,
    id: null
  });
  const dragProps = useDragScroll();
  const handleSearch = () => setAppliedDateRange({
    start: startDate,
    end: endDate
  });
  const filteredCases = useMemo(() => {
    return cases.filter(c => !c.isClosed && c.creationDate >= appliedDateRange.start && c.creationDate <= appliedDateRange.end).sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));
  }, [cases, appliedDateRange]);
  const handleAddComment = (caseId, newComment) => {
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        const updatedComments = [...(c.comments || []), newComment];
        if (historyModal.caseData && historyModal.caseData.id === caseId) {
          setHistoryModal(curr => ({
            ...curr,
            caseData: {
              ...curr.caseData,
              comments: updatedComments
            }
          }));
        }
        return {
          ...c,
          comments: updatedComments
        };
      }
      return c;
    }));
  };
  const handleCloseProject = id => {
    setCases(cases.map(c => c.id === id ? {
      ...c,
      isClosed: true
    } : c));
    setCloseConfirmModal({
      show: false,
      id: null
    });
    showToast('工程案件已結案並移至銷案審核列表');
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-6 rounded-lg shadow-sm border border-gray-100"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mb-6 pb-6 border-b"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement(Calendar, {
    className: "h-5 w-5 text-gray-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "font-medium text-gray-700"
  }, "\u67E5\u8A62\u5340\u9593\uFF1A"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: startDate,
    onChange: e => setStartDate(e.target.value),
    className: "p-2 border rounded-md outline-none"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500"
  }, "\u81F3"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: endDate,
    onChange: e => setEndDate(e.target.value),
    className: "p-2 border rounded-md outline-none"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleSearch,
    className: "bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors hover:bg-blue-700"
  }, /*#__PURE__*/React.createElement(Search, {
    className: "h-4 w-4"
  }), " \u641C\u5C0B")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('project-add'),
    className: "flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors",
    title: "\u65B0\u589E\u7ACB\u6848\u55AE"
  }, /*#__PURE__*/React.createElement(Plus, {
    className: "h-5 w-5"
  }))), /*#__PURE__*/React.createElement("div", _extends({
    className: "overflow-x-auto border rounded-lg cursor-grab active:cursor-grabbing"
  }, dragProps), /*#__PURE__*/React.createElement("table", {
    className: "w-full text-left text-sm text-gray-600 whitespace-nowrap select-none"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 text-gray-700 border-b"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-3 w-28 text-center font-semibold bg-gray-100/50"
  }, "\u64CD\u4F5C"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold bg-gray-100/50"
  }, "\u6848\u4EF6\u7DE8\u865F"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold bg-gray-100/50"
  }, "\u5BA2\u6236\u540D\u7A31"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold bg-gray-100/50 border-r"
  }, "\u9580\u5E02\u540D\u7A31"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold bg-gray-100/50 border-r"
  }, "\u5DE5\u9805\u5206\u985E"), PROJECT_STAGES.map(stage => /*#__PURE__*/React.createElement("th", {
    key: stage,
    className: "p-3 font-semibold text-center border-r"
  }, stage)))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-gray-100"
  }, filteredCases.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 5 + PROJECT_STAGES.length,
    className: "text-center p-8 text-gray-400"
  }, "\u7121\u8CC7\u6599\u7B26\u5408\u76EE\u524D\u641C\u5C0B\u5340\u9593")) : filteredCases.map(c => /*#__PURE__*/React.createElement("tr", {
    key: c.id,
    className: "hover:bg-gray-50 transition-colors"
  }, /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-center space-x-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEditingCase(c);
      setView('project-edit');
    },
    className: "p-1.5 text-blue-600 hover:bg-blue-100 rounded",
    title: "\u67E5\u770B/\u7DE8\u8F2F\u6848\u4EF6"
  }, /*#__PURE__*/React.createElement(Edit, {
    className: "h-4 w-4"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setHistoryModal({
      show: true,
      caseData: c
    }),
    className: "p-1.5 text-indigo-500 hover:bg-indigo-100 rounded",
    title: "\u6848\u4EF6\u6B77\u7A0B (\u8A3B\u8A18\u8AAA\u660E)"
  }, /*#__PURE__*/React.createElement(Clock, {
    className: "h-4 w-4"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setCloseConfirmModal({
      show: true,
      id: c.id
    }),
    className: "p-1.5 text-green-600 hover:bg-green-100 rounded",
    title: "\u7DE8\u8F2F\u7D50\u6848\u72C0\u614B"
  }, /*#__PURE__*/React.createElement(CheckCircle, {
    className: "h-4 w-4"
  })))), /*#__PURE__*/React.createElement("td", {
    className: "p-3 font-medium text-blue-700"
  }, c.projectNumber), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.customerName), /*#__PURE__*/React.createElement("td", {
    className: "p-3 border-r"
  }, c.storeName), /*#__PURE__*/React.createElement("td", {
    className: "p-3 border-r"
  }, /*#__PURE__*/React.createElement("span", {
    className: "px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700"
  }, c.workCategory)), PROJECT_STAGES.map(stage => {
    const stageData = c.history?.find(h => h.stage === stage);
    return /*#__PURE__*/React.createElement("td", {
      key: stage,
      className: "p-2 border-r min-w-[120px]"
    }, stageData ? /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col items-center justify-center bg-blue-50/50 rounded p-1.5 border border-blue-100"
    }, /*#__PURE__*/React.createElement("span", {
      className: "font-medium text-gray-800 text-xs mb-0.5"
    }, stageData.date), /*#__PURE__*/React.createElement("span", {
      className: "text-blue-700 text-[11px] bg-blue-100 px-1.5 rounded truncate max-w-full",
      title: stageData.assignee
    }, stageData.assignee)) : /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-center text-gray-300"
    }, "-"));
  })))))), historyModal.show && historyModal.caseData && /*#__PURE__*/React.createElement(ProjectHistoryModal, {
    caseData: historyModal.caseData,
    onClose: () => setHistoryModal({
      show: false,
      caseData: null
    }),
    onAddComment: handleAddComment
  }), closeConfirmModal.show && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center z-50"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-3 text-yellow-600 mb-4"
  }, /*#__PURE__*/React.createElement(AlertCircle, {
    className: "h-6 w-6"
  }), /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-gray-800"
  }, "\u78BA\u8A8D\u7D50\u6848")), /*#__PURE__*/React.createElement("p", {
    className: "text-gray-600 mb-6"
  }, "\u78BA\u5B9A\u8981\u5C07\u6B64\u5DE5\u7A0B\u7ACB\u6848\u55AE\u6A19\u8A18\u70BA\u7D50\u6848\u55CE\uFF1F\u7D50\u6848\u5F8C\u72C0\u614B\u5C07\u66F4\u65B0\u4E26\u79FB\u81F3\u300C\u6848\u4EF6\u92B7\u6848\u5BE9\u6838\u300D\u5217\u8868\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end space-x-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setCloseConfirmModal({
      show: false,
      id: null
    }),
    className: "px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
  }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleCloseProject(closeConfirmModal.id),
    className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
  }, "\u78BA\u8A8D\u7D50\u6848")))));
};
const AddProjectForm = ({
  cases,
  setCases,
  setView,
  showToast
}) => {
  const [formData, setFormData] = useState({
    workCategory: '新開',
    customerName: '',
    storeName: '',
    storeAddress: '自動帶入地址',
    serviceLevel: '維修(無簽約客戶)',
    contactPerson: '',
    suggestedContractor: '',
    entryDate: '',
    remarks: ''
  });
  const [contractors, setContractors] = useState(['內部工程組', '外包廠商A', '外包廠商B', '機電維護商']);
  const [showAddContractor, setShowAddContractor] = useState(false);
  const [newContractor, setNewContractor] = useState('');
  const [equipmentList, setEquipmentList] = useState([]);
  const [equipModal, setEquipModal] = useState({
    show: false
  });
  const [currentEquip, setCurrentEquip] = useState({
    category: '室內機',
    name: '預設空調設備',
    area: '',
    brand: '大金',
    manufactureDate: '',
    type: '內',
    installDate: '',
    model: '',
    assetNumber: '',
    serialNumber: ''
  });
  const handleChange = e => {
    const {
      name,
      value
    } = e.target;
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: value
      };
      if (name === 'customerName') {
        newData.serviceLevel = CUSTOMER_SERVICE_LEVEL_MAP[value] || '維修(無簽約客戶)';
      }
      return newData;
    });
  };
  const handleEquipChange = e => {
    setCurrentEquip({
      ...currentEquip,
      [e.target.name]: e.target.value
    });
  };
  const handleSaveEquipment = () => {
    if (!currentEquip.model) {
      showToast('設備型號為必填', 'error');
      return;
    }
    setEquipmentList([...equipmentList, {
      ...currentEquip,
      id: Date.now()
    }]);
    setEquipModal({
      show: false
    });
    showToast('設備暫存成功');
  };
  const handleDeleteEquipment = id => {
    setEquipmentList(equipmentList.filter(eq => eq.id !== id));
  };
  const handleAddContractor = () => {
    if (newContractor.trim()) {
      setContractors([...contractors, newContractor.trim()]);
      setFormData({
        ...formData,
        suggestedContractor: newContractor.trim()
      });
      setNewContractor('');
      setShowAddContractor(false);
      showToast('已新增並套用施作單位');
    }
  };
  const handleSubmit = e => {
    e.preventDefault();
    if (!formData.customerName || !formData.storeName) {
      showToast('客戶名稱與門市名稱為必填', 'error');
      return;
    }
    const newProjectNumber = `${todayDate.replace(/-/g, '')}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    const newCase = {
      id: `P${Date.now()}`,
      projectNumber: newProjectNumber,
      creationDate: todayDate,
      customerName: formData.customerName,
      storeName: formData.storeName,
      workCategory: formData.workCategory,
      currentStage: '立案時間',
      stageDate: todayDate,
      stageAssignee: '管理員',
      isClosed: false,
      history: [{
        stage: '立案時間',
        date: todayDate,
        assignee: '管理員'
      }],
      comments: [],
      details: {
        ...formData,
        equipment: equipmentList
      }
    };
    setCases([newCase, ...cases]);
    showToast(`工程立案單建立成功，編號：${newProjectNumber}`);
    setView('project-list');
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "max-w-5xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-gray-100 relative"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mb-6 pb-4 border-b"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-bold flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Plus, {
    className: "text-blue-600"
  }), " \u65B0\u589E\u7ACB\u6848\u55AE"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('project-list'),
    className: "p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
  }, /*#__PURE__*/React.createElement(X, {
    className: "h-5 w-5"
  }))), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit,
    className: "space-y-8"
  }, /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4"
  }, "1. \u6848\u4EF6\u8CC7\u6599"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-3 gap-6"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 mb-1"
  }, "\u5DE5\u9805\u5206\u985E"), /*#__PURE__*/React.createElement("select", {
    name: "workCategory",
    value: formData.workCategory,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500"
  }, PROJECT_WORK_CATEGORIES.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 mb-1"
  }, "\u5BA2\u6236\u540D\u7A31 ", /*#__PURE__*/React.createElement("span", {
    className: "text-red-500"
  }, "*")), /*#__PURE__*/React.createElement("select", {
    required: true,
    name: "customerName",
    value: formData.customerName,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500"
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "\u8ACB\u9078\u64C7"), CUSTOMER_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 mb-1"
  }, "\u9580\u5E02\u540D\u7A31 ", /*#__PURE__*/React.createElement("span", {
    className: "text-red-500"
  }, "*")), /*#__PURE__*/React.createElement("select", {
    required: true,
    name: "storeName",
    value: formData.storeName,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500"
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "\u8ACB\u9078\u64C7"), STORE_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", {
    className: "col-span-full md:col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-500 mb-1"
  }, "\u9580\u5E02\u5730\u5740 (\u6839\u64DA\u9580\u5E02\u81EA\u52D5\u5E36\u5165)"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    disabled: true,
    value: formData.storeAddress,
    className: "w-full p-2.5 bg-gray-50 border rounded-md text-gray-500 cursor-not-allowed"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 mb-1"
  }, "\u670D\u52D9\u7B49\u7D1A"), /*#__PURE__*/React.createElement("select", {
    name: "serviceLevel",
    value: formData.serviceLevel,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500"
  }, SERVICE_LEVEL_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 mb-1"
  }, "\u5DE5\u7A0B\u806F\u7D61\u4EBA"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "contactPerson",
    value: formData.contactPerson,
    onChange: handleChange,
    placeholder: "\u8ACB\u8F38\u5165\u806F\u7D61\u4EBA\u59D3\u540D/\u96FB\u8A71",
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 mb-1"
  }, "\u5EFA\u8B70\u65BD\u4F5C\u55AE\u4F4D"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("select", {
    name: "suggestedContractor",
    value: formData.suggestedContractor,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u8ACB\u9078\u64C7\u55AE\u4F4D"), contractors.map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  }, c))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setShowAddContractor(true),
    className: "px-3 border border-gray-300 rounded-md bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors",
    title: "\u65B0\u589E\u55AE\u4F4D\u9078\u9805"
  }, /*#__PURE__*/React.createElement(Plus, {
    className: "h-5 w-5"
  })))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 mb-1"
  }, "\u9032\u5834\u65E5\u671F"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    name: "entryDate",
    value: formData.entryDate,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500"
  })), /*#__PURE__*/React.createElement("div", {
    className: "col-span-full"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 mb-1"
  }, "\u5176\u4ED6\u4E8B\u9805\u8AAA\u660E"), /*#__PURE__*/React.createElement("textarea", {
    name: "remarks",
    value: formData.remarks,
    onChange: handleChange,
    rows: "3",
    placeholder: "\u8ACB\u8F38\u5165\u5176\u4ED6\u88DC\u5145\u4E8B\u9805...",
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500 resize-none"
  })))), /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center border-b pb-2 mb-4"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-blue-800"
  }, "2. \u8A2D\u5099\u8CC7\u6599"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      setCurrentEquip({
        category: '室內機',
        name: '預設空調設備',
        area: '',
        brand: '大金',
        manufactureDate: '',
        type: '內',
        installDate: '',
        model: '',
        assetNumber: '',
        serialNumber: ''
      });
      setEquipModal({
        show: true
      });
    },
    className: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-md flex items-center gap-2 font-medium transition-colors border border-indigo-200"
  }, /*#__PURE__*/React.createElement(Plus, {
    className: "h-4 w-4"
  }), " \u52A0\u5165\u8A2D\u5099")), /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto border rounded-lg border-gray-200"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-left text-sm text-gray-600 whitespace-nowrap"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 text-gray-700 border-b"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u8A2D\u5099\u5206\u985E"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u54C1\u724C / \u5167\u5916"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u578B\u865F"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u8A2D\u5099\u5340\u57DF"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u8CC7\u7522\u7DE8\u865F"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold text-center w-20"
  }, "\u64CD\u4F5C"))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-gray-100"
  }, equipmentList.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "6",
    className: "text-center p-8 text-gray-400 bg-gray-50/50"
  }, "\u5C1A\u672A\u52A0\u5165\u4EFB\u4F55\u8A2D\u5099\u8CC7\u6599")) : equipmentList.map(eq => /*#__PURE__*/React.createElement("tr", {
    key: eq.id,
    className: "hover:bg-gray-50"
  }, /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-medium text-gray-800"
  }, eq.category), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-gray-500"
  }, eq.name)), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, eq.brand, " ", /*#__PURE__*/React.createElement("span", {
    className: "text-gray-400"
  }, "|"), " ", eq.type), /*#__PURE__*/React.createElement("td", {
    className: "p-3 font-medium text-indigo-600"
  }, eq.model), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, eq.area || '-'), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, eq.assetNumber || '-'), /*#__PURE__*/React.createElement("td", {
    className: "p-3 text-center"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => handleDeleteEquipment(eq.id),
    className: "p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors",
    title: "\u79FB\u9664\u6B64\u8A2D\u5099"
  }, /*#__PURE__*/React.createElement(Trash2, {
    className: "h-4 w-4"
  }))))))))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end space-x-4 pt-6 border-t mt-8"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setView('project-list'),
    className: "px-6 py-2.5 border rounded-md text-gray-600 hover:bg-gray-50 font-medium transition-colors"
  }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "px-8 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 font-bold shadow-sm transition-colors"
  }, /*#__PURE__*/React.createElement(Save, {
    className: "h-5 w-5"
  }), " \u5132\u5B58\u7ACB\u6848\u55AE"))), equipModal.show && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center z-50"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-lg shadow-xl p-6 w-[600px] max-w-full m-4 flex flex-col max-h-[90vh]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-4 border-b pb-3 shrink-0"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-gray-800"
  }, "\u65B0\u589E / \u7DE8\u8F2F\u8A2D\u5099"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setEquipModal({
      show: false
    }),
    className: "text-gray-500 hover:bg-gray-100 p-1 rounded-full"
  }, /*#__PURE__*/React.createElement(X, {
    className: "h-5 w-5"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "overflow-y-auto pr-2 space-y-4 flex-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm text-gray-600 mb-1"
  }, "\u8A2D\u5099\u5206\u985E"), /*#__PURE__*/React.createElement("select", {
    name: "category",
    value: currentEquip.category,
    onChange: handleEquipChange,
    className: "w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none"
  }, EQUIPMENT_CATEGORIES.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm text-gray-600 mb-1"
  }, "\u8A2D\u5099\u540D\u7A31"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "name",
    value: currentEquip.name,
    onChange: handleEquipChange,
    className: "w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none",
    placeholder: "\u4F8B\u5982\uFF1A1F\u71DF\u696D\u5EF3\u7A7A\u8ABF"
  })), /*#__PURE__*/React.createElement("div", {
    className: "col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm text-gray-600 mb-1"
  }, "\u8A2D\u5099\u5340\u57DF"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "area",
    value: currentEquip.area,
    onChange: handleEquipChange,
    className: "w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none",
    placeholder: "\u4F8B\u5982\uFF1A\u5929\u82B1\u677F\u4E0A\u65B9"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm text-gray-600 mb-1"
  }, "\u54C1\u724C"), /*#__PURE__*/React.createElement("select", {
    name: "brand",
    value: currentEquip.brand,
    onChange: handleEquipChange,
    className: "w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none"
  }, EQUIPMENT_BRANDS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm text-gray-600 mb-1"
  }, "\u5167 / \u5916"), /*#__PURE__*/React.createElement("select", {
    name: "type",
    value: currentEquip.type,
    onChange: handleEquipChange,
    className: "w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none"
  }, EQUIPMENT_TYPES.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", {
    className: "col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm text-gray-600 mb-1"
  }, "\u578B\u865F ", /*#__PURE__*/React.createElement("span", {
    className: "text-red-500"
  }, "*")), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "model",
    value: currentEquip.model,
    onChange: handleEquipChange,
    className: "w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none",
    placeholder: "\u8F38\u5165\u8A2D\u5099\u578B\u865F",
    required: true
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm text-gray-600 mb-1"
  }, "\u51FA\u5EE0\u65E5\u671F"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    name: "manufactureDate",
    value: currentEquip.manufactureDate,
    onChange: handleEquipChange,
    className: "w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm text-gray-600 mb-1"
  }, "\u5B89\u88DD\u65E5\u671F"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    name: "installDate",
    value: currentEquip.installDate,
    onChange: handleEquipChange,
    className: "w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm text-gray-600 mb-1"
  }, "\u8CC7\u7522\u7DE8\u865F"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "assetNumber",
    value: currentEquip.assetNumber,
    onChange: handleEquipChange,
    className: "w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none",
    placeholder: "\u9078\u586B"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm text-gray-600 mb-1"
  }, "\u6D41\u6C34\u5E8F\u865F (QR Code)"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "serialNumber",
    value: currentEquip.serialNumber,
    onChange: handleEquipChange,
    className: "w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none",
    placeholder: "\u9078\u586B"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end space-x-3 mt-6 pt-4 border-t shrink-0"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setEquipModal({
      show: false
    }),
    className: "px-4 py-2 border rounded text-gray-600 hover:bg-gray-50 transition-colors"
  }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleSaveEquipment,
    className: "px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
  }, "\u66AB\u5B58\u8A2D\u5099")))), showAddContractor && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center z-[60]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-lg shadow-xl p-6 w-80 max-w-full m-4"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-gray-800 mb-4"
  }, "\u65B0\u589E\u65BD\u4F5C\u55AE\u4F4D"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newContractor,
    onChange: e => setNewContractor(e.target.value),
    placeholder: "\u8F38\u5165\u65B0\u7684\u55AE\u4F4D\u540D\u7A31",
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500 mb-6",
    autoFocus: true
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end space-x-3"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      setShowAddContractor(false);
      setNewContractor('');
    },
    className: "px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50"
  }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleAddContractor,
    className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
  }, "\u78BA\u5B9A\u65B0\u589E")))));
};
const EditProjectForm = ({
  editingCase,
  cases,
  setCases,
  setView,
  showToast
}) => {
  const [formData, setFormData] = useState(JSON.parse(JSON.stringify(editingCase)));
  const dragProps = useDragScroll();
  const initialStages = {};
  PROJECT_STAGES.forEach(s => {
    const existing = formData.history?.find(h => h.stage === s);
    initialStages[s] = {
      date: existing?.date || '',
      assignee: existing?.assignee || ''
    };
  });
  const [stagesData, setStagesData] = useState(initialStages);
  const handleStageChange = (stage, field, value) => {
    setStagesData(prev => ({
      ...prev,
      [stage]: {
        ...prev[stage],
        [field]: value
      }
    }));
  };
  const handleSubmit = e => {
    e.preventDefault();
    const newHistory = [];
    PROJECT_STAGES.forEach(stage => {
      if (stagesData[stage].date || stagesData[stage].assignee) {
        newHistory.push({
          stage,
          date: stagesData[stage].date,
          assignee: stagesData[stage].assignee
        });
      }
    });
    const updatedCase = {
      ...formData,
      history: newHistory,
      currentStage: newHistory.length > 0 ? newHistory[newHistory.length - 1].stage : '立案時間'
    };
    setCases(cases.map(c => c.id === updatedCase.id ? updatedCase : c));
    showToast('工程項目進度已成功更新');
    setView('project-list');
  };
  const ReadOnlyField = ({
    label,
    value,
    fullWidth = false
  }) => /*#__PURE__*/React.createElement("div", {
    className: fullWidth ? "col-span-full" : ""
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 block mb-1 text-xs"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "font-medium bg-gray-50 p-2.5 rounded-md border border-gray-100 min-h-[42px] flex items-center"
  }, value || '-'));
  return /*#__PURE__*/React.createElement("div", {
    className: "max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col max-h-[calc(100vh-140px)]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center p-6 border-b shrink-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('project-list'),
    className: "text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-colors"
  }, /*#__PURE__*/React.createElement(ArrowLeft, null)), /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-bold flex items-center gap-2"
  }, "\u67E5\u770B / \u7DE8\u8F2F\u5DE5\u7A0B\u6848\u4EF6 ", /*#__PURE__*/React.createElement("span", {
    className: "text-lg text-blue-600 bg-blue-50 px-3 py-1 rounded-full font-normal"
  }, formData.projectNumber)))), /*#__PURE__*/React.createElement("div", {
    className: "p-6 overflow-y-auto space-y-8 flex-1 bg-gray-50"
  }, /*#__PURE__*/React.createElement("form", {
    id: "editProjectForm",
    onSubmit: handleSubmit,
    className: "space-y-8"
  }, /*#__PURE__*/React.createElement("section", {
    className: "bg-white p-6 rounded-lg shadow-sm border border-gray-100"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4 flex items-center justify-between"
  }, "1. \u6848\u4EF6\u8CC7\u6599 ", /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-normal text-gray-400 bg-gray-100 px-2 py-1 rounded"
  }, "\u552F\u8B80")), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-4 text-sm items-start"
  }, /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u5DE5\u9805\u5206\u985E",
    value: formData.workCategory
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u5BA2\u6236\u540D\u7A31",
    value: formData.customerName
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u9580\u5E02\u540D\u7A31",
    value: formData.storeName
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u670D\u52D9\u7B49\u7D1A",
    value: formData.details?.serviceLevel
  }), /*#__PURE__*/React.createElement("div", {
    className: "col-span-2 md:col-span-4"
  }, /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u9580\u5E02\u5730\u5740",
    value: formData.details?.storeAddress
  })), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u5DE5\u7A0B\u806F\u7D61\u4EBA",
    value: formData.details?.contactPerson
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u5EFA\u8B70\u65BD\u4F5C\u55AE\u4F4D",
    value: formData.details?.suggestedContractor
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u9032\u5834\u65E5\u671F",
    value: formData.details?.entryDate
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u7ACB\u6848\u65E5\u671F",
    value: formData.creationDate
  }), /*#__PURE__*/React.createElement(ReadOnlyField, {
    label: "\u5176\u4ED6\u4E8B\u9805\u8AAA\u660E",
    value: formData.details?.remarks,
    fullWidth: true
  }))), /*#__PURE__*/React.createElement("section", {
    className: "bg-white p-6 rounded-lg shadow-sm border border-gray-100"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4 flex items-center justify-between"
  }, "2. \u8A2D\u5099\u8CC7\u6599 ", /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-normal text-gray-400 bg-gray-100 px-2 py-1 rounded"
  }, "\u552F\u8B80")), /*#__PURE__*/React.createElement("div", _extends({
    className: "overflow-x-auto border rounded-lg border-gray-200"
  }, dragProps), /*#__PURE__*/React.createElement("table", {
    className: "w-full text-left text-sm text-gray-600 whitespace-nowrap"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 text-gray-700 border-b"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u8A2D\u5099\u5206\u985E"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u54C1\u724C / \u5167\u5916"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u578B\u865F"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u8A2D\u5099\u5340\u57DF"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u51FA\u5EE0 / \u5B89\u88DD\u65E5\u671F"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u8CC7\u7522\u7DE8\u865F"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u6D41\u6C34\u5E8F\u865F"))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-gray-100"
  }, !formData.details?.equipment || formData.details.equipment.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "7",
    className: "text-center p-6 text-gray-400"
  }, "\u7121\u8A2D\u5099\u8CC7\u6599")) : formData.details.equipment.map(eq => /*#__PURE__*/React.createElement("tr", {
    key: eq.id,
    className: "hover:bg-gray-50"
  }, /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-medium text-gray-800"
  }, eq.category), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-gray-500"
  }, eq.name)), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, eq.brand, " ", /*#__PURE__*/React.createElement("span", {
    className: "text-gray-400"
  }, "|"), " ", eq.type), /*#__PURE__*/React.createElement("td", {
    className: "p-3 font-medium text-indigo-600"
  }, eq.model), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, eq.area || '-'), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs"
  }, "\u51FA\uFF1A", eq.manufactureDate || '-'), /*#__PURE__*/React.createElement("div", {
    className: "text-xs"
  }, "\u88DD\uFF1A", eq.installDate || '-')), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, eq.assetNumber || '-'), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, eq.serialNumber || '-'))))))), /*#__PURE__*/React.createElement("section", {
    className: "bg-white p-6 rounded-lg shadow-sm border border-indigo-100 ring-1 ring-indigo-50 relative"
  }, /*#__PURE__*/React.createElement("div", {
    className: "absolute top-0 right-0 bg-indigo-500 text-white text-xs px-3 py-1 rounded-bl-lg rounded-tr-lg font-medium"
  }, "\u53EF\u7DE8\u8F2F\u5340\u584A"), /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-indigo-800 border-b border-indigo-100 pb-2 mb-6"
  }, "3. \u5DE5\u7A0B\u9805\u76EE\u9032\u5EA6"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-4 mb-2"
  }, PROJECT_STAGES.map((stage, idx) => /*#__PURE__*/React.createElement("div", {
    key: stage,
    className: "flex flex-col md:flex-row md:items-center gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 w-48 shrink-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold"
  }, idx + 1), /*#__PURE__*/React.createElement("span", {
    className: "font-medium text-gray-800"
  }, stage)), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 grid grid-cols-1 md:grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-gray-500 mb-1"
  }, "\u4F5C\u696D\u65E5\u671F"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: stagesData[stage].date,
    onChange: e => handleStageChange(stage, 'date', e.target.value),
    className: "w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-gray-500 mb-1"
  }, "\u8CA0\u8CAC\u4EBA\u54E1"), /*#__PURE__*/React.createElement("select", {
    value: stagesData[stage].assignee,
    onChange: e => handleStageChange(stage, 'assignee', e.target.value),
    className: "w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u5C1A\u672A\u6307\u6D3E"), PROJECT_ASSIGNEES.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt))))))))))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 border-t bg-white flex justify-end gap-4 shrink-0 rounded-b-lg"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('project-list'),
    className: "px-6 py-2.5 border rounded-md text-gray-600 hover:bg-gray-50 font-medium transition-colors"
  }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    form: "editProjectForm",
    className: "px-8 py-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-2 font-bold shadow-sm transition-colors"
  }, /*#__PURE__*/React.createElement(Save, {
    className: "h-5 w-5"
  }), " \u5132\u5B58\u9032\u5EA6\u66F4\u65B0")));
};

// ==========================================
//           7. 現勘表收集 相關元件 (新增)
// ==========================================

const SurveyList = ({
  cases,
  setCases,
  setEditingCase,
  setView,
  showToast
}) => {
  const [startDate, setStartDate] = useState(todayDate);
  const [endDate, setEndDate] = useState(todayDate);
  const [appliedDateRange, setAppliedDateRange] = useState({
    start: todayDate,
    end: todayDate
  });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    show: false,
    id: null
  });
  const dragProps = useDragScroll();
  const handleSearch = () => setAppliedDateRange({
    start: startDate,
    end: endDate
  });
  const filteredCases = useMemo(() => {
    return cases.filter(c => c.fillDate >= appliedDateRange.start && c.fillDate <= appliedDateRange.end).sort((a, b) => new Date(b.fillDate) - new Date(a.fillDate));
  }, [cases, appliedDateRange]);
  const handleDelete = id => {
    setCases(cases.filter(c => c.id !== id));
    setDeleteConfirmModal({
      show: false,
      id: null
    });
    showToast('已刪除該筆現勘表資料');
  };
  const handleExportPDF = fileName => {
    showToast(`「匯出 PDF」功能開發中... (${fileName})`);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-6 rounded-lg shadow-sm border border-gray-100"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mb-6 pb-6 border-b"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement(Calendar, {
    className: "h-5 w-5 text-gray-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "font-medium text-gray-700"
  }, "\u67E5\u8A62\u5340\u9593\uFF1A"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: startDate,
    onChange: e => setStartDate(e.target.value),
    className: "p-2 border rounded-md outline-none"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500"
  }, "\u81F3"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: endDate,
    onChange: e => setEndDate(e.target.value),
    className: "p-2 border rounded-md outline-none"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleSearch,
    className: "bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors hover:bg-blue-700"
  }, /*#__PURE__*/React.createElement(Search, {
    className: "h-4 w-4"
  }), " \u641C\u5C0B")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('survey-add'),
    className: "flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors",
    title: "\u65B0\u589E\u73FE\u52D8\u8868"
  }, /*#__PURE__*/React.createElement(Plus, {
    className: "h-5 w-5"
  }))), /*#__PURE__*/React.createElement("div", _extends({
    className: "overflow-x-auto border rounded-lg cursor-grab active:cursor-grabbing"
  }, dragProps), /*#__PURE__*/React.createElement("table", {
    className: "w-full text-left text-sm text-gray-600 whitespace-nowrap select-none"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 text-gray-700 border-b"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-3 w-32 text-center font-semibold bg-gray-100/50"
  }, "\u64CD\u4F5C"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold bg-gray-100/50"
  }, "\u5BA2\u6236\u540D\u7A31"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold bg-gray-100/50"
  }, "\u9580\u5E02\u540D\u7A31"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold bg-gray-100/50"
  }, "\u6A94\u6848\u540D\u7A31"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold bg-gray-100/50"
  }, "\u586B\u55AE\u65E5\u671F"))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-gray-100"
  }, filteredCases.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "5",
    className: "text-center p-8 text-gray-400"
  }, "\u7121\u8CC7\u6599\u7B26\u5408\u76EE\u524D\u641C\u5C0B\u5340\u9593")) : filteredCases.map(c => /*#__PURE__*/React.createElement("tr", {
    key: c.id,
    className: "hover:bg-gray-50 transition-colors"
  }, /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-center space-x-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEditingCase(c);
      setView('survey-edit');
    },
    className: "p-1.5 text-blue-600 hover:bg-blue-100 rounded",
    title: "\u7DE8\u8F2F"
  }, /*#__PURE__*/React.createElement(Edit, {
    className: "h-4 w-4"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleExportPDF(c.fileName),
    className: "p-1.5 text-emerald-600 hover:bg-emerald-100 rounded",
    title: "\u532F\u51FA PDF"
  }, /*#__PURE__*/React.createElement(Download, {
    className: "h-4 w-4"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setDeleteConfirmModal({
      show: true,
      id: c.id
    }),
    className: "p-1.5 text-red-500 hover:bg-red-100 rounded",
    title: "\u522A\u9664"
  }, /*#__PURE__*/React.createElement(Trash2, {
    className: "h-4 w-4"
  })))), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.customerName), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.storeName), /*#__PURE__*/React.createElement("td", {
    className: "p-3 font-medium text-blue-700"
  }, c.fileName), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.fillDate)))))), deleteConfirmModal.show && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center z-50"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-3 text-red-600 mb-4"
  }, /*#__PURE__*/React.createElement(AlertCircle, {
    className: "h-6 w-6"
  }), /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-gray-800"
  }, "\u78BA\u8A8D\u522A\u9664")), /*#__PURE__*/React.createElement("p", {
    className: "text-gray-600 mb-6"
  }, "\u78BA\u5B9A\u8981\u522A\u9664\u9019\u7B46\u73FE\u52D8\u8868\u8CC7\u6599\u55CE\uFF1F\u522A\u9664\u5F8C\u7121\u6CD5\u5FA9\u539F\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end space-x-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setDeleteConfirmModal({
      show: false,
      id: null
    }),
    className: "px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
  }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleDelete(deleteConfirmModal.id),
    className: "px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
  }, "\u78BA\u8A8D\u522A\u9664")))));
};
const SurveyForm = ({
  cases,
  setCases,
  setView,
  showToast,
  targetCase
}) => {
  const isEdit = !!targetCase;
  const [formData, setFormData] = useState(targetCase || {
    customerName: '',
    storeName: '',
    storeAddress: '',
    fillDate: todayDate,
    surveyType: SURVEY_TYPES[0],
    surveyData: {} // 儲存各類型動態題目答案
  });
  // 室外機施工內容 - 可隱藏題目的顯示切換
  const [showOutdoorHideable, setShowOutdoorHideable] = useState(true);
  // 沿用設備 - 可隱藏題目的顯示切換
  const [showReuseEquipment, setShowReuseEquipment] = useState(true);
  const handleChange = e => {
    const {
      name,
      value
    } = e.target;
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: value
      };
      if (name === 'storeName') {
        const addressMap = {
          '台北信義店': '台北市信義區松智路X號',
          '台中旗艦店': '台中市西屯區台灣大道X號',
          '高雄左營店': '高雄市左營區博愛路X號',
          '站前店': '台中市中區建國路X號',
          '中山店': '台北市中山區中山北路X號'
        };
        newData.storeAddress = addressMap[value] || '自動帶入地址';
      }
      return newData;
    });
  };

  // 專門處理動態問卷題目的輸入變更
  const handleSurveyChange = e => {
    const {
      name,
      value,
      type,
      checked
    } = e.target;
    setFormData(prev => {
      const currentSurveyData = prev.surveyData || {};

      // 處理核取方塊 (多選)
      if (type === 'checkbox') {
        const currentArr = currentSurveyData[name] || [];
        const newArr = checked ? [...currentArr, value] : currentArr.filter(item => item !== value);
        return {
          ...prev,
          surveyData: {
            ...currentSurveyData,
            [name]: newArr
          }
        };
      }

      // 一般輸入框、下拉選單、單選按鈕
      return {
        ...prev,
        surveyData: {
          ...currentSurveyData,
          [name]: value
        }
      };
    });
  };

  // 室內機洗孔需求動態清單處理 (可增加多筆)
  const handleHoleChange = (index, value) => {
    setFormData(prev => {
      const currentSurveyData = prev.surveyData || {};
      const holes = [...(currentSurveyData.indoorUnitHoles || [])];
      holes[index] = {
        ...holes[index],
        diameter: value
      };
      return {
        ...prev,
        surveyData: {
          ...currentSurveyData,
          indoorUnitHoles: holes
        }
      };
    });
  };
  const addHole = () => {
    setFormData(prev => {
      const currentSurveyData = prev.surveyData || {};
      const holes = [...(currentSurveyData.indoorUnitHoles || []), {
        diameter: ''
      }];
      return {
        ...prev,
        surveyData: {
          ...currentSurveyData,
          indoorUnitHoles: holes
        }
      };
    });
  };
  const removeHole = index => {
    setFormData(prev => {
      const currentSurveyData = prev.surveyData || {};
      const holes = (currentSurveyData.indoorUnitHoles || []).filter((_, i) => i !== index);
      return {
        ...prev,
        surveyData: {
          ...currentSurveyData,
          indoorUnitHoles: holes
        }
      };
    });
  };
  // 設備清單動態處理 (可增加多筆設備)
  const handleEquipmentChange = (index, field, value) => {
    setFormData(prev => {
      const currentSurveyData = prev.surveyData || {};
      const list = [...(currentSurveyData.equipmentList || [])];
      list[index] = {
        ...list[index],
        [field]: value
      };
      return {
        ...prev,
        surveyData: {
          ...currentSurveyData,
          equipmentList: list
        }
      };
    });
  };
  const addEquipment = () => {
    setFormData(prev => {
      const currentSurveyData = prev.surveyData || {};
      const list = [...(currentSurveyData.equipmentList || []), {
        category: '',
        brand: '',
        name: '',
        model: '',
        area: ''
      }];
      return {
        ...prev,
        surveyData: {
          ...currentSurveyData,
          equipmentList: list
        }
      };
    });
  };
  const removeEquipment = index => {
    setFormData(prev => {
      const currentSurveyData = prev.surveyData || {};
      const list = (currentSurveyData.equipmentList || []).filter((_, i) => i !== index);
      return {
        ...prev,
        surveyData: {
          ...currentSurveyData,
          equipmentList: list
        }
      };
    });
  };
  // 零配件數量處理
  const handlePartQtyChange = (partKey, value) => {
    setFormData(prev => {
      const currentSurveyData = prev.surveyData || {};
      return {
        ...prev,
        surveyData: {
          ...currentSurveyData,
          partsQty: {
            ...(currentSurveyData.partsQty || {}),
            [partKey]: value
          }
        }
      };
    });
  };
  // 配管工程 各多選群組的數量／長度對照表處理（依 mapName 分開儲存）
  const handleQtyMapChange = (mapName, key, value) => {
    setFormData(prev => {
      const currentSurveyData = prev.surveyData || {};
      return {
        ...prev,
        surveyData: {
          ...currentSurveyData,
          [mapName]: {
            ...(currentSurveyData[mapName] || {}),
            [key]: value
          }
        }
      };
    });
  };
  // 配管工程「多選 + 填數字」單一列
  const renderPipingQtyRow = (checkName, mapName, opt) => {
    const selected = formData.surveyData?.[checkName] || [];
    const checked = selected.includes(opt.label);
    return /*#__PURE__*/React.createElement("div", {
      key: opt.label,
      className: "flex items-center justify-between bg-white p-3 rounded border border-gray-200"
    }, /*#__PURE__*/React.createElement("label", {
      className: "flex items-center gap-2 cursor-pointer"
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      name: checkName,
      value: opt.label,
      checked: checked,
      onChange: handleSurveyChange,
      className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-sm text-gray-700 font-medium"
    }, opt.label)), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2"
    }, /*#__PURE__*/React.createElement("input", {
      type: "number",
      value: formData.surveyData?.[mapName]?.[opt.label] || '',
      onChange: e => handleQtyMapChange(mapName, opt.label, e.target.value),
      disabled: !checked,
      placeholder: opt.qtyLabel,
      className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:opacity-50"
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-sm text-gray-500 whitespace-nowrap"
    }, opt.unit)));
  };
  // 配管工程「多選 + 填數字」的「其他」自填列
  const renderPipingOtherRow = (checkName, mapName, unit, qtyLabel) => {
    const selected = formData.surveyData?.[checkName] || [];
    const checked = selected.includes('其他');
    return /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between bg-white p-3 rounded border border-gray-200"
    }, /*#__PURE__*/React.createElement("label", {
      className: "flex items-center gap-2 cursor-pointer flex-1"
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      name: checkName,
      value: "其他",
      checked: checked,
      onChange: handleSurveyChange,
      className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 shrink-0"
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-sm text-gray-700 font-medium shrink-0"
    }, "其他："), /*#__PURE__*/React.createElement("input", {
      type: "text",
      name: `${checkName}_other`,
      value: formData.surveyData?.[`${checkName}_other`] || '',
      onChange: handleSurveyChange,
      disabled: !checked,
      placeholder: "請註明",
      className: "flex-1 max-w-xs p-1 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent text-sm disabled:opacity-50"
    })), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2"
    }, /*#__PURE__*/React.createElement("input", {
      type: "number",
      value: formData.surveyData?.[mapName]?.['其他'] || '',
      onChange: e => handleQtyMapChange(mapName, '其他', e.target.value),
      disabled: !checked,
      placeholder: qtyLabel,
      className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:opacity-50"
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-sm text-gray-500 whitespace-nowrap"
    }, unit)));
  };
  // 配管工程「多選 + 填數字」子題卡片（同一單位）
  const renderPipingCheckQtyGroup = (subtitle, note, checkName, mapName, options, unit, qtyLabel) => /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border border-gray-200"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "text-base font-bold text-indigo-700 mb-1"
  }, subtitle), note && /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-gray-400 mb-3"
  }, note), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2 mt-2"
  }, options.map(o => renderPipingQtyRow(checkName, mapName, typeof o === 'string' ? {
    label: o,
    unit,
    qtyLabel
  } : o)), renderPipingOtherRow(checkName, mapName, unit, qtyLabel)));
  // 配管工程 單選子題卡片
  const renderPipingSingleSelect = (subtitle, name, options, extra) => {
    const cur = formData.surveyData?.[name] || '';
    return /*#__PURE__*/React.createElement("div", {
      className: "bg-white p-4 rounded-lg border border-gray-200"
    }, /*#__PURE__*/React.createElement("h4", {
      className: "text-base font-bold text-indigo-700 mb-3"
    }, subtitle), /*#__PURE__*/React.createElement("div", {
      className: "flex flex-wrap gap-x-6 gap-y-3"
    }, options.map(opt => /*#__PURE__*/React.createElement("label", {
      key: opt,
      className: "flex items-center gap-2 cursor-pointer"
    }, /*#__PURE__*/React.createElement("input", {
      type: "radio",
      name: name,
      value: opt,
      checked: cur === opt,
      onChange: handleSurveyChange,
      className: "w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-sm text-gray-700 font-medium"
    }, opt))), /*#__PURE__*/React.createElement("label", {
      className: "flex items-center gap-2 cursor-pointer"
    }, /*#__PURE__*/React.createElement("input", {
      type: "radio",
      name: name,
      value: "其他",
      checked: cur === '其他',
      onChange: handleSurveyChange,
      className: "w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-sm text-gray-700 font-medium"
    }, "其他："), /*#__PURE__*/React.createElement("input", {
      type: "text",
      name: `${name}_other`,
      value: formData.surveyData?.[`${name}_other`] || '',
      onChange: handleSurveyChange,
      disabled: cur !== '其他',
      placeholder: "請註明",
      className: "w-32 p-1 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent text-sm disabled:opacity-50"
    }))), extra);
  };
  // 風管工程 集風箱／出線型箱「風管管徑 + 孔數 + 數量」多選列
  const renderDuctPipeRow = (checkName, holeMap, qtyMap, opt) => {
    const selected = formData.surveyData?.[checkName] || [];
    const checked = selected.includes(opt);
    return /*#__PURE__*/React.createElement("div", {
      key: opt,
      className: "flex items-center justify-between bg-white p-3 rounded border border-gray-200"
    }, /*#__PURE__*/React.createElement("label", {
      className: "flex items-center gap-2 cursor-pointer"
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      name: checkName,
      value: opt,
      checked: checked,
      onChange: handleSurveyChange,
      className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-sm text-gray-700 font-medium"
    }, opt)), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2"
    }, /*#__PURE__*/React.createElement("input", {
      type: "number",
      value: formData.surveyData?.[holeMap]?.[opt] || '',
      onChange: e => handleQtyMapChange(holeMap, opt, e.target.value),
      disabled: !checked,
      placeholder: "孔數",
      className: "w-20 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:opacity-50"
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-sm text-gray-500 whitespace-nowrap"
    }, "孔"), /*#__PURE__*/React.createElement("input", {
      type: "number",
      value: formData.surveyData?.[qtyMap]?.[opt] || '',
      onChange: e => handleQtyMapChange(qtyMap, opt, e.target.value),
      disabled: !checked,
      placeholder: "數量",
      className: "w-20 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:opacity-50"
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-sm text-gray-500 whitespace-nowrap"
    }, "個")));
  };
  // 風管工程 集風箱／出線型箱 卡片（材質單選 + 法蘭內徑 + 風管管徑孔數/數量多選）
  const renderDuctBox = (title, prefix) => /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " " + title), /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, renderPipingSingleSelect('材質（單選）', `${prefix}Material`, DUCT_BOX_MATERIALS), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border border-gray-200"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "text-base font-bold text-indigo-700 mb-3"
  }, "法蘭內徑"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap items-center gap-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, "寬"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    name: `${prefix}FlangeWidth`,
    value: formData.surveyData?.[`${prefix}FlangeWidth`] || '',
    onChange: handleSurveyChange,
    placeholder: "寬",
    className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-500"
  }, "cm"), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium ml-4"
  }, "高"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    name: `${prefix}FlangeHeight`,
    value: formData.surveyData?.[`${prefix}FlangeHeight`] || '',
    onChange: handleSurveyChange,
    placeholder: "高",
    className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-500"
  }, "cm"))), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border border-gray-200"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "text-base font-bold text-indigo-700 mb-1"
  }, "風管管徑、孔數與數量"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-gray-400 mb-3"
  }, "請勾選風管管徑並填寫孔數與數量（個）"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2 mt-2"
  }, DUCT_BOX_PIPES.map(o => renderDuctPipeRow(`${prefix}Pipes`, `${prefix}PipesHoles`, `${prefix}PipesQty`, o))))));
  // 風管工程 三通風箱 卡片（材質單選 + 風管管徑數量多選，無孔數／無其他列）
  const renderDuctTeeBox = (title, prefix) => /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " " + title), /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, renderPipingSingleSelect('材質（單選）', `${prefix}Material`, DUCT_BOX_MATERIALS), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border border-gray-200"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "text-base font-bold text-indigo-700 mb-1"
  }, "風管管徑、數量"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-gray-400 mb-3"
  }, "請勾選風管管徑並填寫數量（個）"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2 mt-2"
  }, DUCT_TEE_PIPES.map(o => renderPipingQtyRow(`${prefix}Pipes`, `${prefix}PipesQty`, {
    label: o,
    unit: '個',
    qtyLabel: '數量'
  }))))));
  // 風管工程 出風口 單一型式列（勾選 + 數量個，線型另填寬高 cm）
  const renderVentOutletRow = opt => {
    const selected = formData.surveyData?.ventOutlets || [];
    const checked = selected.includes(opt.label);
    return /*#__PURE__*/React.createElement("div", {
      key: opt.label,
      className: "bg-white p-3 rounded border border-gray-200"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between"
    }, /*#__PURE__*/React.createElement("label", {
      className: "flex items-center gap-2 cursor-pointer"
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      name: "ventOutlets",
      value: opt.label,
      checked: checked,
      onChange: handleSurveyChange,
      className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-sm text-gray-700 font-medium"
    }, opt.label)), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2"
    }, /*#__PURE__*/React.createElement("input", {
      type: "number",
      value: formData.surveyData?.ventOutletsQty?.[opt.label] || '',
      onChange: e => handleQtyMapChange('ventOutletsQty', opt.label, e.target.value),
      disabled: !checked,
      placeholder: "數量",
      className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:opacity-50"
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-sm text-gray-500 whitespace-nowrap"
    }, "個"))), opt.dim && /*#__PURE__*/React.createElement("div", {
      className: "flex flex-wrap items-center gap-3 mt-3 ml-6"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-sm text-gray-700 font-medium"
    }, "寬"), /*#__PURE__*/React.createElement("input", {
      type: "number",
      name: "ventLinearWidth",
      value: formData.surveyData?.ventLinearWidth || '',
      onChange: handleSurveyChange,
      disabled: !checked,
      placeholder: "寬",
      className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:opacity-50"
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-sm text-gray-500"
    }, "cm"), /*#__PURE__*/React.createElement("span", {
      className: "text-sm text-gray-700 font-medium ml-4"
    }, "高"), /*#__PURE__*/React.createElement("input", {
      type: "number",
      name: "ventLinearHeight",
      value: formData.surveyData?.ventLinearHeight || '',
      onChange: handleSurveyChange,
      disabled: !checked,
      placeholder: "高",
      className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:opacity-50"
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-sm text-gray-500"
    }, "cm")));
  };
  // 風管工程 出風口 卡片（多選型式 + 數量，線型另填寬高，含其他）
  const renderVentOutletBox = () => /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 出風口"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border border-gray-200"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "text-base font-bold text-indigo-700 mb-1"
  }, "出風口型式、數量"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-gray-400 mb-3"
  }, "請勾選出風口型式並填寫數量（個），線型出風口另填寬、高（cm）"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2 mt-2"
  }, DUCT_VENT_OUTLETS.map(renderVentOutletRow), renderPipingOtherRow('ventOutlets', 'ventOutletsQty', '個', '數量')))));
  // 風管工程 回風口 卡片（多選型式 + 數量，無其他列）
  const renderReturnOutletBox = () => /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 回風口"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border border-gray-200"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "text-base font-bold text-indigo-700 mb-1"
  }, "回風口型式、數量"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-gray-400 mb-3"
  }, "請勾選回風口型式並填寫數量（個）"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2 mt-2"
  }, DUCT_RETURN_OUTLETS.map(o => renderPipingQtyRow('returnOutlets', 'returnOutletsQty', {
    label: o,
    unit: '個',
    qtyLabel: '數量'
  }))))));
  // 風管工程 特製風箱 卡片（單選 + 其他）
  const renderCustomBox = () => /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 特製風箱"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, renderPipingSingleSelect('特製風箱（單選）', 'customBox', DUCT_CUSTOM_BOX_OPTIONS)));
  const handleSubmit = e => {
    e.preventDefault();
    if (!formData.customerName || !formData.storeName || !formData.storeAddress) {
      showToast('客戶名稱、門市名稱與門市地址皆為必填', 'error');
      return;
    }
    const fileName = `${formData.customerName}_${formData.storeName}_${formData.surveyType}_${formData.fillDate.replace(/-/g, '')}`;
    if (isEdit) {
      setCases(cases.map(c => c.id === formData.id ? {
        ...formData,
        fileName
      } : c));
      showToast('現勘表更新成功');
    } else {
      const newCase = {
        id: `S${Date.now()}`,
        ...formData,
        fileName
      };
      setCases([newCase, ...cases]);
      showToast('現勘表建立成功');
    }
    setView('survey-list');
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-gray-100 relative"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mb-6 pb-4 border-b"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-bold flex items-center gap-2"
  }, isEdit ? /*#__PURE__*/React.createElement(Edit, {
    className: "text-blue-600 h-6 w-6"
  }) : /*#__PURE__*/React.createElement(Plus, {
    className: "text-blue-600 h-6 w-6"
  }), isEdit ? '編輯現勘表' : '新增現勘表'), /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('survey-list'),
    className: "p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
  }, /*#__PURE__*/React.createElement(X, {
    className: "h-5 w-5"
  }))), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit,
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-lg border border-gray-200"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 mb-1"
  }, "\u5BA2\u6236\u540D\u7A31 ", /*#__PURE__*/React.createElement("span", {
    className: "text-red-500"
  }, "*")), /*#__PURE__*/React.createElement("select", {
    required: true,
    name: "customerName",
    value: formData.customerName,
    onChange: handleChange,
    className: "w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500"
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "\u8ACB\u9078\u64C7"), CUSTOMER_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 mb-1"
  }, "\u9580\u5E02\u540D\u7A31 ", /*#__PURE__*/React.createElement("span", {
    className: "text-red-500"
  }, "*")), /*#__PURE__*/React.createElement("select", {
    required: true,
    name: "storeName",
    value: formData.storeName,
    onChange: handleChange,
    className: "w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500"
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "\u8ACB\u9078\u64C7"), STORE_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", {
    className: "col-span-full"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 mb-1"
  }, "\u9580\u5E02\u5730\u5740 ", /*#__PURE__*/React.createElement("span", {
    className: "text-red-500"
  }, "*")), /*#__PURE__*/React.createElement("input", {
    type: "text",
    required: true,
    disabled: true,
    name: "storeAddress",
    value: formData.storeAddress,
    placeholder: "\u9078\u64C7\u9580\u5E02\u5F8C\u81EA\u52D5\u5E36\u5165",
    className: "w-full p-2 bg-gray-50 border rounded-md text-gray-500 cursor-not-allowed outline-none"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 mb-1"
  }, "\u586B\u55AE\u65E5\u671F"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    name: "fillDate",
    value: formData.fillDate,
    onChange: handleChange,
    required: true,
    className: "w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-blue-700 mb-1"
  }, "\u73FE\u52D8\u8868\u985E\u578B"), /*#__PURE__*/React.createElement("select", {
    name: "surveyType",
    value: formData.surveyType,
    onChange: handleChange,
    className: "w-full p-2 border-2 border-blue-300 rounded-md outline-none focus:border-blue-500 bg-white font-bold text-blue-900 shadow-sm"
  }, SURVEY_TYPES.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt))))), formData.surveyType === '環境與施工' ? /*#__PURE__*/React.createElement("div", {
    className: "mt-8 space-y-8"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(FileText, {
    className: "h-6 w-6"
  }), " \u74B0\u5883\u8207\u65BD\u5DE5 - \u73FE\u52D8\u660E\u7D30"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-2"
  }, "\u5DE5\u7A0B\u985E\u578B"), /*#__PURE__*/React.createElement("select", {
    name: "projectType",
    value: formData.surveyData?.projectType || '',
    onChange: handleSurveyChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u8ACB\u9078\u64C7(\u55AE\u9078)"), ['新開', '加裝', '移機', '撤店', '拆機', '維修汰換', '整裝汰換', '整裝沿用', '其他'].map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-3"
  }, "\u5DE5\u7A0B\u5DE5\u7A2E (\u4E0B\u62C9\u9078\u55AE - \u591A\u9078)"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-x-6 gap-y-3"
  }, ['分離式工程', '冰水機工程', '風管工程', '保養工程', '其他'].map(opt => /*#__PURE__*/React.createElement("label", {
    key: opt,
    className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    name: "projectTrades",
    value: opt,
    checked: (formData.surveyData?.projectTrades || []).includes(opt),
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, opt))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-2"
  }, "\u5730\u6BB5\u5340\u57DF"), /*#__PURE__*/React.createElement("select", {
    name: "locationArea",
    value: formData.surveyData?.locationArea || '',
    onChange: handleSurveyChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u8ACB\u9078\u64C7(\u55AE\u9078)"), ['街邊店', '軍營', '醫院', '高鐵、捷運、機場', '電子廠、科技園區', '百貨', '其他'].map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-2"
  }, "\u5DE5\u55AE\u7533\u8ACB"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-8 mt-2"
  }, ['是', '否'].map(opt => /*#__PURE__*/React.createElement("label", {
    key: opt,
    className: "flex items-center gap-2 cursor-pointer"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "workOrderApplied",
    value: opt,
    checked: formData.surveyData?.workOrderApplied === opt,
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, opt))))), /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-3"
  }, "\u7279\u6B8A\u74B0\u5883\u8655\u7406 (\u591A\u9078)"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-x-6 gap-y-3"
  }, ['防鹽害處理', '防硫處理', '沼氣處理'].map(opt => /*#__PURE__*/React.createElement("label", {
    key: opt,
    className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    name: "specialEnv",
    value: opt,
    checked: (formData.surveyData?.specialEnv || []).includes(opt),
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, opt))))), /*#__PURE__*/React.createElement("div", {
    className: "col-span-full border-t border-indigo-100/50 my-2"
  }), /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-2"
  }, "\u5BA4\u5167\u65BD\u4F5C\u5340\u57DF (\u55AE\u9078)"), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-6"
  }, /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 cursor-pointer shrink-0"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "indoorWorkArea",
    value: "\u5168\u5340",
    checked: formData.surveyData?.indoorWorkArea === '全區',
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, "\u5168\u5340")), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 cursor-pointer w-full max-w-sm"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "indoorWorkArea",
    value: "\u5176\u4ED6",
    checked: formData.surveyData?.indoorWorkArea === '其他',
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium shrink-0"
  }, "\u5176\u4ED6\uFF1A"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "indoorWorkArea_other",
    value: formData.surveyData?.indoorWorkArea_other || '',
    onChange: handleSurveyChange,
    disabled: formData.surveyData?.indoorWorkArea !== '其他',
    className: "flex-1 p-1.5 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent disabled:opacity-50 text-sm font-medium",
    placeholder: "\u8ACB\u8A3B\u660E"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-2"
  }, "\u73FE\u5834\u63D0\u4F9B\u96FB\u6E90 (\u55AE\u9078)"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-6 bg-white p-4 rounded border border-gray-200"
  }, ['單相110V', '單相220V', '三相220V', '三相380V'].map(opt => /*#__PURE__*/React.createElement("label", {
    key: opt,
    className: "flex items-center gap-2 cursor-pointer"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "onSitePower",
    value: opt,
    checked: formData.surveyData?.onSitePower === opt,
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, opt))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-1"
  }, "\u96FB\u7BB1\u4F4D\u7F6E"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "electricBoxLocation",
    value: formData.surveyData?.electricBoxLocation || '',
    onChange: handleSurveyChange,
    placeholder: "\u586B\u5BEB\u4F4D\u7F6E",
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
  })), /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-3"
  }, "\u73FE\u5834\u5DF2\u9810\u7559\u8AAA\u660E (\u591A\u9078)"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-x-6 gap-y-4 items-center"
  }, ['主機電源線', '無熔絲開關', '溫控位置', '空氣門電源', '排水位置', '冰水幹管'].map(opt => /*#__PURE__*/React.createElement("label", {
    key: opt,
    className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    name: "reservedItems",
    value: opt,
    checked: (formData.surveyData?.reservedItems || []).includes(opt),
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, opt))), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 cursor-pointer p-1"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    name: "reservedItems",
    value: "\u5176\u4ED6",
    checked: (formData.surveyData?.reservedItems || []).includes('其他'),
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, "\u5176\u4ED6\uFF1A"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "reservedItems_other",
    value: formData.surveyData?.reservedItems_other || '',
    onChange: handleSurveyChange,
    disabled: !(formData.surveyData?.reservedItems || []).includes('其他'),
    className: "w-40 p-1 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent disabled:opacity-50 text-sm font-medium",
    placeholder: "\u8ACB\u8A3B\u660E"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "col-span-full border-t border-indigo-100/50 my-2"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-1"
  }, "\u6A13\u677F\u9AD8\u5EA6 (/cm)"), /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    name: "floorHeight",
    value: formData.surveyData?.floorHeight || '',
    onChange: handleSurveyChange,
    placeholder: "\u586B\u5BEB\u9AD8\u5EA6",
    className: "w-full p-2.5 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
  }), /*#__PURE__*/React.createElement("span", {
    className: "absolute right-3 top-2.5 text-gray-400 text-sm"
  }, "/cm"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-1"
  }, "\u5929\u82B1\u677F\u53CA\u6697\u67B6\u9AD8\u5EA6 (/cm)"), /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    name: "ceilingHeight",
    value: formData.surveyData?.ceilingHeight || '',
    onChange: handleSurveyChange,
    placeholder: "\u586B\u5BEB\u9AD8\u5EA6",
    className: "w-full p-2.5 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
  }), /*#__PURE__*/React.createElement("span", {
    className: "absolute right-3 top-2.5 text-gray-400 text-sm"
  }, "/cm"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-1"
  }, "\u4E3B\u6A11\u9AD8\u5EA6 (/cm)"), /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    name: "mainBeamHeight",
    value: formData.surveyData?.mainBeamHeight || '',
    onChange: handleSurveyChange,
    placeholder: "\u586B\u5BEB\u9AD8\u5EA6",
    className: "w-full p-2.5 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
  }), /*#__PURE__*/React.createElement("span", {
    className: "absolute right-3 top-2.5 text-gray-400 text-sm"
  }, "/cm"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-1"
  }, "\u526F\u6A11\u9AD8\u5EA6 (/cm)"), /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    name: "subBeamHeight",
    value: formData.surveyData?.subBeamHeight || '',
    onChange: handleSurveyChange,
    placeholder: "\u586B\u5BEB\u9AD8\u5EA6",
    className: "w-full p-2.5 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
  }), /*#__PURE__*/React.createElement("span", {
    className: "absolute right-3 top-2.5 text-gray-400 text-sm"
  }, "/cm"))), /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-2"
  }, "\u7279\u6B8A\u65BD\u5DE5"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-4 items-center"
  }, /*#__PURE__*/React.createElement("select", {
    name: "specialConstruction",
    value: formData.surveyData?.specialConstruction || '',
    onChange: handleSurveyChange,
    className: "w-64 p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u8ACB\u9078\u64C7(\u55AE\u9078)"), /*#__PURE__*/React.createElement("option", {
    value: "\u4E09\u6A13\u4EE5\u4E0A\u5916\u7246\u914D\u7BA1"
  }, "\u4E09\u6A13\u4EE5\u4E0A\u5916\u7246\u914D\u7BA1"), /*#__PURE__*/React.createElement("option", {
    value: "\u5BA4\u5167\u6A13\u677F\u9AD8\u5EA66\u7C73\u4EE5\u4E0A"
  }, "\u5BA4\u5167\u6A13\u677F\u9AD8\u5EA66\u7C73\u4EE5\u4E0A"), /*#__PURE__*/React.createElement("option", {
    value: "\u5176\u4ED6"
  }, "\u5176\u4ED6")), formData.surveyData?.specialConstruction === '其他' && /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "specialConstruction_other",
    value: formData.surveyData?.specialConstruction_other || '',
    onChange: handleSurveyChange,
    placeholder: "\u8ACB\u8A3B\u660E\u7279\u6B8A\u65BD\u5DE5\u5167\u5BB9",
    className: "flex-1 p-2.5 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent font-medium"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "col-span-full border-t border-indigo-100/50 my-2"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-1"
  }, "\u5DF2\u5055\u540C\u73FE\u52D8\u5EE0\u5546"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "coSurveyContractor",
    value: formData.surveyData?.coSurveyContractor || '',
    onChange: handleSurveyChange,
    placeholder: "\u586B\u5BEB",
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-1"
  }, "\u696D\u4E3B\u5DE5\u52D9\u806F\u7E6B\u8CC7\u8A0A"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "ownerContact",
    value: formData.surveyData?.ownerContact || '',
    onChange: handleSurveyChange,
    placeholder: "\u586B\u5BEB",
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
  })), /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-1"
  }, "\u914D\u5408\u6C34\u96FB/\u88DD\u6F62\u806F\u7E6B\u8CC7\u8A0A"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "decoratorContact",
    value: formData.surveyData?.decoratorContact || '',
    onChange: handleSurveyChange,
    placeholder: "\u586B\u5BEB",
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
  })), /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-1"
  }, "\u5099\u8A3B"), /*#__PURE__*/React.createElement("textarea", {
    name: "remarks",
    value: formData.surveyData?.remarks || '',
    onChange: handleSurveyChange,
    rows: "3",
    placeholder: "\u586B\u5BEB",
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 resize-none shadow-sm"
  })), /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-2"
  }, "\u7167\u7247\u662F\u5426\u4E0A\u50B3 NSA"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-8 mt-1"
  }, ['是', '否'].map(opt => /*#__PURE__*/React.createElement("label", {
    key: opt,
    className: "flex items-center gap-2 cursor-pointer"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "photosUploadedNSA",
    value: opt,
    checked: formData.surveyData?.photosUploadedNSA === opt,
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, opt))))))), /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 室內機施工內容"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6"
  },
  /* 室內機安裝位置 — 點選(多選) */
  /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-3"
  }, "室內機安裝位置 (點選 - 多選)"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-x-6 gap-y-3"
  }, ['露明(開放區域)', '輕鋼架', '暗架天花'].map(opt => /*#__PURE__*/React.createElement("label", {
    key: opt,
    className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    name: "indoorUnitLocation",
    value: opt,
    checked: (formData.surveyData?.indoorUnitLocation || []).includes(opt),
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, opt))))),
  /* 室內機安裝高度 — 數字填寫 */
  /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-1"
  }, "室內機安裝高度 (/cm)"), /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    name: "indoorUnitHeight",
    value: formData.surveyData?.indoorUnitHeight || '',
    onChange: handleSurveyChange,
    placeholder: "填寫高度",
    className: "w-full p-2.5 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
  }), /*#__PURE__*/React.createElement("span", {
    className: "absolute right-3 top-2.5 text-gray-400 text-sm"
  }, "/cm"))),
  /* 室內機架1.5"角鋼需求 — 數字填寫 */
  /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-1"
  }, "室內機架1.5\" 角鋼需求"), /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    name: "indoorUnitAngleSteel",
    value: formData.surveyData?.indoorUnitAngleSteel || '',
    onChange: handleSurveyChange,
    placeholder: "填寫數量",
    className: "w-full p-2.5 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
  }), /*#__PURE__*/React.createElement("span", {
    className: "absolute right-3 top-2.5 text-gray-400 text-sm"
  }, "支"))),
  /* 室內機定位方式 — 下拉選單(多選) + 其他 */
  /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-3"
  }, "室內機定位方式 (下拉選單 - 多選)"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-x-6 gap-y-4 items-center"
  }, ['升降機', '鷹架', '自走車', '起重工人'].map(opt => /*#__PURE__*/React.createElement("label", {
    key: opt,
    className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    name: "indoorUnitPositioning",
    value: opt,
    checked: (formData.surveyData?.indoorUnitPositioning || []).includes(opt),
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, opt))), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 cursor-pointer p-1"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    name: "indoorUnitPositioning",
    value: "其他",
    checked: (formData.surveyData?.indoorUnitPositioning || []).includes('其他'),
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, "其他："), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "indoorUnitPositioning_other",
    value: formData.surveyData?.indoorUnitPositioning_other || '',
    onChange: handleSurveyChange,
    disabled: !(formData.surveyData?.indoorUnitPositioning || []).includes('其他'),
    className: "w-40 p-1 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent disabled:opacity-50 text-sm font-medium",
    placeholder: "請註明"
  })))),
  /* 室內機吊掛方式 — 下拉選單(多選) */
  /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-3"
  }, "室內機吊掛方式 (下拉選單 - 多選)"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-x-6 gap-y-3"
  }, ['膨脹螺絲', '萬向接頭', 'C型鋼扣3/4'].map(opt => /*#__PURE__*/React.createElement("label", {
    key: opt,
    className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    name: "indoorUnitHanging",
    value: opt,
    checked: (formData.surveyData?.indoorUnitHanging || []).includes(opt),
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, opt))))),
  /* 室內機洗孔需求 — 數字填寫 (可增加多筆) */
  /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-3"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700"
  }, "室內機洗孔需求 (數字填寫)"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: addHole,
    className: "flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
  }, /*#__PURE__*/React.createElement(Plus, {
    className: "h-4 w-4"
  }), "增加洗孔")), (formData.surveyData?.indoorUnitHoles || []).length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400"
  }, "尚未新增洗孔，請點選「增加洗孔」") : /*#__PURE__*/React.createElement("div", {
    className: "space-y-2"
  }, (formData.surveyData?.indoorUnitHoles || []).map((hole, index) => /*#__PURE__*/React.createElement("div", {
    key: index,
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-500 w-10 shrink-0"
  }, "#", index + 1), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium shrink-0"
  }, "孔徑"), /*#__PURE__*/React.createElement("div", {
    className: "relative w-40"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: hole.diameter || '',
    onChange: e => handleHoleChange(index, e.target.value),
    placeholder: "填寫",
    className: "w-full p-2 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
  }), /*#__PURE__*/React.createElement("span", {
    className: "absolute right-3 top-2 text-gray-400 text-sm"
  }, "cm")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => removeHole(index),
    className: "text-red-500 hover:text-red-700 p-1"
  }, /*#__PURE__*/React.createElement(Trash2, {
    className: "h-4 w-4"
  }))))))))
  /* ===== 室外機施工內容 ===== */
  , /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 室外機施工內容"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6"
  },
  /* 室外機搬運 — 下拉選單(多選) + 其他 */
  /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-3"
  }, "室外機搬運 (下拉選單 - 多選)"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-x-6 gap-y-4 items-center"
  }, ['卡吊', '附鐵籠', '全吊', '鷹架', '堆高機', '升降機', '小金剛', '起重工人', '樓梯種類'].map(opt => /*#__PURE__*/React.createElement("label", {
    key: opt,
    className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    name: "outdoorUnitTransport",
    value: opt,
    checked: (formData.surveyData?.outdoorUnitTransport || []).includes(opt),
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, opt))), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 cursor-pointer p-1"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    name: "outdoorUnitTransport",
    value: "其他",
    checked: (formData.surveyData?.outdoorUnitTransport || []).includes('其他'),
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, "其他："), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "outdoorUnitTransport_other",
    value: formData.surveyData?.outdoorUnitTransport_other || '',
    onChange: handleSurveyChange,
    disabled: !(formData.surveyData?.outdoorUnitTransport || []).includes('其他'),
    className: "w-40 p-1 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent disabled:opacity-50 text-sm font-medium",
    placeholder: "請註明"
  })))),
  /* 室外機定位 — 下拉選單(多選) */
  /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-3"
  }, "室外機定位 (下拉選單 - 多選)"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-x-6 gap-y-3"
  }, ['彈簧基座', '水泥基座', '橡膠墊片'].map(opt => /*#__PURE__*/React.createElement("label", {
    key: opt,
    className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    name: "outdoorUnitPositioning",
    value: opt,
    checked: (formData.surveyData?.outdoorUnitPositioning || []).includes(opt),
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, opt))))),
  /* 吊車需求 — 單選 + 其他 */
  /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-3"
  }, "吊車需求 (單選)"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-x-6 gap-y-3 items-center"
  }, ['裝新機', '拆舊機', '拆+裝同時處理', '拆+裝分開處理'].map(opt => /*#__PURE__*/React.createElement("label", {
    key: opt,
    className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "craneRequirement",
    value: opt,
    checked: formData.surveyData?.craneRequirement === opt,
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, opt))), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 cursor-pointer p-1"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "craneRequirement",
    value: "其他",
    checked: formData.surveyData?.craneRequirement === '其他',
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, "其他："), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "craneRequirement_other",
    value: formData.surveyData?.craneRequirement_other || '',
    onChange: handleSurveyChange,
    disabled: formData.surveyData?.craneRequirement !== '其他',
    className: "w-40 p-1 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent disabled:opacity-50 text-sm font-medium",
    placeholder: "請註明"
  })))),
  /* 室外機架類型 — 單選 + 噸 + 數量/組 */
  /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-3"
  }, "室外機架類型 (單選)"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-x-6 gap-y-3"
  }, ['鍍鋅', '白鐵', 'ABS', '沿用(需噴漆)'].map(opt => /*#__PURE__*/React.createElement("label", {
    key: opt,
    className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "outdoorRackType",
    value: opt,
    checked: formData.surveyData?.outdoorRackType === opt,
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, opt))), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-6 mt-4 pt-4 border-t border-gray-100"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-medium text-gray-700 shrink-0"
  }, "角鋼重量"), /*#__PURE__*/React.createElement("div", {
    className: "relative w-32"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    name: "outdoorRackTons",
    value: formData.surveyData?.outdoorRackTons || '',
    onChange: handleSurveyChange,
    placeholder: "填數字",
    className: "w-full p-2 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
  }), /*#__PURE__*/React.createElement("span", {
    className: "absolute right-3 top-2 text-gray-400 text-sm"
  }, "噸"))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-medium text-gray-700 shrink-0"
  }, "數量"), /*#__PURE__*/React.createElement("div", {
    className: "relative w-32"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    name: "outdoorRackQty",
    value: formData.surveyData?.outdoorRackQty || '',
    onChange: handleSurveyChange,
    placeholder: "填數字",
    className: "w-full p-2 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
  }), /*#__PURE__*/React.createElement("span", {
    className: "absolute right-3 top-2 text-gray-400 text-sm"
  }, "組")))))),
  /* 選配題目（需可隱藏）顯示切換 */
  /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2 flex items-center justify-between bg-amber-50 border border-amber-200 p-3 rounded"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-medium text-amber-800"
  }, "選配題目（可隱藏）"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setShowOutdoorHideable(v => !v),
    className: "text-sm font-medium text-indigo-600 hover:text-indigo-800"
  }, showOutdoorHideable ? '隱藏' : '顯示')),
  showOutdoorHideable && /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6"
  },
  /* 室外機是否加大 — 單選 */
  /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-2"
  }, "室外機是否加大"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-8 mt-1"
  }, ['是', '否'].map(opt => /*#__PURE__*/React.createElement("label", {
    key: opt,
    className: "flex items-center gap-2 cursor-pointer"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "outdoorUnitEnlarged",
    value: opt,
    checked: formData.surveyData?.outdoorUnitEnlarged === opt,
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, opt))))),
  /* 2" 角鋼增加數量 — 填寫 */
  /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-1"
  }, "2\" 角鋼增加數量（3支以上）"), /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    name: "outdoorAngleSteelExtra",
    value: formData.surveyData?.outdoorAngleSteelExtra || '',
    onChange: handleSurveyChange,
    placeholder: "填寫數量",
    className: "w-full p-2.5 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
  }), /*#__PURE__*/React.createElement("span", {
    className: "absolute right-3 top-2.5 text-gray-400 text-sm"
  }, "支"))))))) : formData.surveyType === '設備與零件' ? /*#__PURE__*/React.createElement("div", {
    className: "mt-8 space-y-8"
  },
  /* ===== 新增設備（可增加多個設備） ===== */
  /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center border-b-2 border-indigo-200 pb-3 mb-6"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 新增設備"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: addEquipment,
    className: "flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
  }, /*#__PURE__*/React.createElement(Plus, {
    className: "h-4 w-4"
  }), "增加設備")), (formData.surveyData?.equipmentList || []).length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-center text-gray-400 text-sm py-6 border-2 border-dashed border-gray-200 rounded-lg"
  }, "尚未新增設備，請點選「增加設備」") : /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, (formData.surveyData?.equipmentList || []).map((eq, index) => /*#__PURE__*/React.createElement("div", {
    key: index,
    className: "bg-white p-4 rounded-lg border border-gray-200"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mb-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-bold text-indigo-700"
  }, "設備 #", index + 1), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => removeEquipment(index),
    className: "text-red-500 hover:text-red-700 p-1"
  }, /*#__PURE__*/React.createElement(Trash2, {
    className: "h-4 w-4"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-4"
  },
  /* 設備分類 — 下拉單選 */
  /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-1"
  }, "設備分類"), /*#__PURE__*/React.createElement("select", {
    value: eq.category || '',
    onChange: e => handleEquipmentChange(index, 'category', e.target.value),
    className: "w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "請選擇(單選)"), EQUIP_CATEGORY_OPTIONS.map(o => /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o)))),
  /* 品牌 — 抓設備清單資料 */
  /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-1"
  }, "品牌"), /*#__PURE__*/React.createElement("select", {
    value: eq.brand || '',
    onChange: e => handleEquipmentChange(index, 'brand', e.target.value),
    className: "w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "抓設備清單資料"), EQUIP_BRAND_OPTIONS.map(o => /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o)))),
  /* 設備名稱 — 抓設備清單資料 */
  /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-1"
  }, "設備名稱"), /*#__PURE__*/React.createElement("select", {
    value: eq.name || '',
    onChange: e => handleEquipmentChange(index, 'name', e.target.value),
    className: "w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "抓設備清單資料"), EQUIP_NAME_OPTIONS.map(o => /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o)))),
  /* 型號 — 抓設備清單資料 */
  /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-1"
  }, "型號"), /*#__PURE__*/React.createElement("select", {
    value: eq.model || '',
    onChange: e => handleEquipmentChange(index, 'model', e.target.value),
    className: "w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "抓設備清單資料"), EQUIP_MODEL_OPTIONS.map(o => /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o)))),
  /* 設備區域 — 填寫 */
  /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-1"
  }, "設備區域"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: eq.area || '',
    onChange: e => handleEquipmentChange(index, 'area', e.target.value),
    placeholder: "填寫",
    className: "w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
  }))))))),
  /* ===== 零配件（多選 + 填數量） ===== */
  /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-2 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 零配件"), /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-500 mb-4"
  }, "請勾選需要的零配件並填寫數量（組）"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-3"
  }, SURVEY_PARTS.map(part => /*#__PURE__*/React.createElement("div", {
    key: part,
    className: "flex items-center justify-between bg-white p-3 rounded border border-gray-200"
  }, /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 cursor-pointer"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    name: "parts",
    value: part,
    checked: (formData.surveyData?.parts || []).includes(part),
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, part)), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: formData.surveyData?.partsQty?.[part] || '',
    onChange: e => handlePartQtyChange(part, e.target.value),
    disabled: !(formData.surveyData?.parts || []).includes(part),
    placeholder: "數量",
    className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:opacity-50"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-500"
  }, "組")))),
  /* 其他 — 自填名稱 + 數量 */
  /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between bg-white p-3 rounded border border-gray-200"
  }, /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 cursor-pointer flex-1"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    name: "parts",
    value: "其他",
    checked: (formData.surveyData?.parts || []).includes('其他'),
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 shrink-0"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium shrink-0"
  }, "其他："), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "parts_other",
    value: formData.surveyData?.parts_other || '',
    onChange: handleSurveyChange,
    disabled: !(formData.surveyData?.parts || []).includes('其他'),
    placeholder: "請註明",
    className: "flex-1 max-w-xs p-1 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent text-sm disabled:opacity-50"
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: formData.surveyData?.partsQty?.['其他'] || '',
    onChange: e => handlePartQtyChange('其他', e.target.value),
    disabled: !(formData.surveyData?.parts || []).includes('其他'),
    placeholder: "數量",
    className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:opacity-50"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-500"
  }, "組"))))),
  /* ===== 沿用設備（需可隱藏） ===== */
  /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center border-b-2 border-indigo-200 pb-3 mb-6"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 沿用設備"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setShowReuseEquipment(v => !v),
    className: "flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-indigo-300 text-indigo-700 hover:bg-indigo-50 transition-colors"
  }, showReuseEquipment ? '隱藏' : '顯示')), showReuseEquipment && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-1"
  }, "沿用設備"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "reuseEquipment",
    value: formData.surveyData?.reuseEquipment || '',
    onChange: handleSurveyChange,
    placeholder: "填寫",
    className: "w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-1"
  }, "備註"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-gray-400 mb-1"
  }, "現場舊機沿用（廠牌、型號、出廠年份、數量）及處理說明"), /*#__PURE__*/React.createElement("textarea", {
    name: "reuseEquipmentNote",
    rows: 4,
    value: formData.surveyData?.reuseEquipmentNote || '',
    onChange: handleSurveyChange,
    placeholder: "請填寫...",
    className: "w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
  }))))) : formData.surveyType === '配管工程' ? /*#__PURE__*/React.createElement("div", {
    className: "mt-8 space-y-8"
  },
  /* ===== 銅管工程 ===== */
  /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 銅管工程"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, renderPipingCheckQtyGroup('銅管尺寸與長度', '請勾選管徑規格並填寫長度（米）', 'copperSizes', 'copperSizesQty', PIPING_COPPER_SIZES, '米', '長度'), renderPipingCheckQtyGroup('銅管配件', '請勾選配件並填寫數量（個）', 'copperFittings', 'copperFittingsQty', PIPING_COPPER_FITTINGS, '個', '數量'))),
  /* ===== 排水工程 ===== */
  /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 排水工程"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, renderPipingCheckQtyGroup('PVC排水管', '請勾選管徑並填寫長度（米）', 'pvcDrain', 'pvcDrainQty', PIPING_PVC_DRAIN, '米', '長度'), renderPipingCheckQtyGroup('排水保溫', '請勾選規格並填寫長度（米）', 'drainInsulation', 'drainInsulationQty', PIPING_DRAIN_INSULATION, '米', '長度'))),
  /* ===== 冰水管工程 ===== */
  /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 冰水管工程"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, renderPipingCheckQtyGroup('冰水管配件', '請勾選配件並填寫數量（個）', 'chilledFittings', 'chilledFittingsQty', PIPING_CHILLED_FITTINGS, '個', '數量'), renderPipingCheckQtyGroup('冰水管', '請勾選管徑並填寫長度（米）', 'chilledPipe', 'chilledPipeQty', PIPING_CHILLED_PIPE, '米', '長度'), renderPipingCheckQtyGroup('冰水保溫管', '請勾選規格並填寫長度（米）', 'chilledInsulation', 'chilledInsulationQty', PIPING_CHILLED_INSULATION, '米', '長度'))),
  /* ===== 管路保護 ===== */
  /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 管路保護"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, renderPipingSingleSelect('管路保護材質（單選）', 'protectMaterial', PIPING_PROTECT_MATERIALS, formData.surveyData?.protectMaterial === 'ABS管槽' ? /*#__PURE__*/React.createElement("div", {
    className: "mt-4 ml-6 p-3 bg-indigo-50 rounded border border-indigo-100"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs font-bold text-indigo-700 mb-2"
  }, "ABS管槽 第二層尺寸（單選）"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-x-6 gap-y-2"
  }, PIPING_ABS_SIZES.map(sz => /*#__PURE__*/React.createElement("label", {
    key: sz,
    className: "flex items-center gap-2 cursor-pointer"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "absSize",
    value: sz,
    checked: (formData.surveyData?.absSize || '') === sz,
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, sz))))) : null), renderPipingCheckQtyGroup('管槽配件', '請勾選配件並填寫數量／長度', 'channelFittings', 'channelFittingsQty', PIPING_CHANNEL_FITTINGS, '個', '數量'), renderPipingSingleSelect('管路保護顏色（單選）', 'protectColor', PIPING_PROTECT_COLORS)))) : formData.surveyType === '配電工程' ? /*#__PURE__*/React.createElement("div", {
    className: "mt-8 space-y-8"
  },
  /* ===== 控制及訊號線材 ===== */
  /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 控制及訊號線材／米"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, renderPipingCheckQtyGroup('控制及訊號線材', '請勾選線材規格並填寫長度（米）', 'controlSignalWire', 'controlSignalWireQty', WIRING_CONTROL_SIGNAL, '米', '長度'))),
  /* ===== 電源線線材 ===== */
  /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 電源線線材／米"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, renderPipingCheckQtyGroup('電源線線材', '請勾選線材規格並填寫長度（米）', 'powerCableWire', 'powerCableWireQty', WIRING_POWER_CABLE, '米', '長度')))) : formData.surveyType === '風管工程' ? /*#__PURE__*/React.createElement("div", {
    className: "mt-8 space-y-8"
  },
  /* ===== 保溫軟管(玻璃棉) ===== */
  /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 保溫軟管(玻璃棉)／米"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, renderPipingCheckQtyGroup('保溫軟管(玻璃棉)', '請勾選管徑並填寫長度（米）', 'insulatedHose', 'insulatedHoseQty', DUCT_INSULATED_HOSE, '米', '長度'))),
  /* ===== 無保溫軟管(鋁箔) ===== */
  /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 無保溫軟管(鋁箔)／米"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, renderPipingCheckQtyGroup('無保溫軟管(鋁箔)', '請勾選管徑並填寫長度（米）', 'uninsulatedHose', 'uninsulatedHoseQty', DUCT_UNINSULATED_HOSE, '米', '長度'))),
  /* ===== 集風箱 ===== */
  renderDuctBox('集風箱（管徑、數量）', 'collectBox'),
  /* ===== 出／線型箱 ===== */
  renderDuctBox('出／線型箱', 'outletBox'),
  /* ===== 回風箱 ===== */
  renderDuctBox('回風箱', 'returnBox'),
  /* ===== 強制回風箱 ===== */
  renderDuctBox('強制回風箱', 'forcedReturnBox'),
  /* ===== 三通風箱 ===== */
  renderDuctTeeBox('三通風箱', 'teeBox'),
  /* ===== 出風口 ===== */
  renderVentOutletBox(),
  /* ===== 回風口 ===== */
  renderReturnOutletBox(),
  /* ===== 特製風箱 ===== */
  renderCustomBox()) : formData.surveyType === '拆除工程' ? /*#__PURE__*/React.createElement("div", {
    className: "mt-8 space-y-8"
  },
  /* ===== 舊設備拆除 ===== */
  /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 舊設備拆除"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  },
  /* 設備拆除/台 */
  /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-2"
  }, "設備拆除／台"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "demoEquip",
    value: formData.surveyData?.demoEquip || '',
    onChange: handleSurveyChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm",
    placeholder: "請填寫數量"
  }), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-gray-500 mt-1.5"
  }, "備註：品牌、主機、內機、空氣門、水塔、泵浦、送風機、冰水機")),
  /* 風管拆除/台 */
  /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-2"
  }, "風管拆除／台"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "demoDuct",
    value: formData.surveyData?.demoDuct || '',
    onChange: handleSurveyChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm",
    placeholder: "請填寫數量"
  })),
  /* 管路拆除/米 */
  /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-2"
  }, "管路拆除／米"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "demoPipe",
    value: formData.surveyData?.demoPipe || '',
    onChange: handleSurveyChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm",
    placeholder: "請填寫長度（米）"
  })),
  /* 其他拆除項目、數量說明 */
  /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-2"
  }, "其他拆除項目、數量說明"), /*#__PURE__*/React.createElement("textarea", {
    name: "demoOther",
    value: formData.surveyData?.demoOther || '',
    onChange: handleSurveyChange,
    rows: 3,
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm",
    placeholder: "請填寫"
  })))),
  /* ===== 舊機處理方式 ===== */
  /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 舊機處理方式"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  },
  /* 品牌、規格 */
  /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-2"
  }, "品牌、規格"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "oldMachineSpec",
    value: formData.surveyData?.oldMachineSpec || '',
    onChange: handleSurveyChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm",
    placeholder: "請填寫品牌、規格"
  })),
  /* 處理方式（單選） */
  /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-bold text-gray-700 mb-2"
  }, "處理方式（單選）"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-6 bg-white p-4 rounded border border-gray-200"
  }, ['協力商直接報廢', '載回晉詮', '回收補助'].map(opt => /*#__PURE__*/React.createElement("label", {
    key: opt,
    className: "flex items-center gap-2 cursor-pointer"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "oldMachineMethod",
    value: opt,
    checked: formData.surveyData?.oldMachineMethod === opt,
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, opt))))))),
  /* ===== 廢棄物(舊風管)清運處理說明 ===== */
  /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 廢棄物(舊風管)清運處理說明"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-x-6 gap-y-3 bg-white p-4 rounded border border-gray-200"
  }, ['裝潢處理', '晉詮處理', '協力商處理', '業主處理'].map(opt => /*#__PURE__*/React.createElement("label", {
    key: opt,
    className: "flex items-center gap-2 cursor-pointer"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "wasteDisposal",
    value: opt,
    checked: formData.surveyData?.wasteDisposal === opt,
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, opt))), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 cursor-pointer"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "wasteDisposal",
    value: "其他",
    checked: formData.surveyData?.wasteDisposal === '其他',
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium shrink-0"
  }, "其他："), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "wasteDisposal_other",
    value: formData.surveyData?.wasteDisposal_other || '',
    onChange: handleSurveyChange,
    disabled: formData.surveyData?.wasteDisposal !== '其他',
    className: "p-1.5 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent disabled:opacity-50 text-sm font-medium",
    placeholder: "請註明"
  }))))) : formData.surveyType === '汰換工程' ? /*#__PURE__*/React.createElement("div", {
    className: "mt-8 space-y-8"
  },
  /* ===== 裝潢區開孔尺寸說明 ===== */
  /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 裝潢區開孔尺寸說明"), /*#__PURE__*/React.createElement("textarea", {
    name: "renovationHoleSize",
    value: formData.surveyData?.renovationHoleSize || '',
    onChange: handleSurveyChange,
    rows: 3,
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm",
    placeholder: "請填寫"
  })),
  /* ===== 是否更新汰換 ===== */
  /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 是否更新汰換（單選）"), /*#__PURE__*/React.createElement("div", {
    className: "divide-y divide-indigo-100/70 bg-white rounded border border-gray-200"
  }, ['控制/訊號線', '室外機電源線', '室內機電源線', '銅管', '冰水管', '排水管', '保溫管', '軟管', '集風箱', '出/線型風箱', '回風箱', '強制回風箱', '三通風箱', '出風口', '回風口'].map(item => /*#__PURE__*/React.createElement("div", {
    key: item,
    className: "flex items-center justify-between px-4 py-2.5"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, item), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-6"
  }, ['是', '否'].map(opt => /*#__PURE__*/React.createElement("label", {
    key: opt,
    className: "flex items-center gap-2 cursor-pointer"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "replace_" + item,
    value: opt,
    checked: formData.surveyData?.['replace_' + item] === opt,
    onChange: handleSurveyChange,
    className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-gray-700 font-medium"
  }, opt)))))))),
  /* ===== 備註 ===== */
  /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Wrench, {
    className: "h-6 w-6"
  }), " 備註"), /*#__PURE__*/React.createElement("textarea", {
    name: "replaceRemark",
    value: formData.surveyData?.replaceRemark || '',
    onChange: handleSurveyChange,
    rows: 3,
    className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm",
    placeholder: "請填寫"
  }))) : /*#__PURE__*/React.createElement("div", {
    className: "mt-8 border-2 border-dashed border-gray-300 rounded-xl p-16 flex flex-col items-center justify-center bg-gray-50/50"
  }, /*#__PURE__*/React.createElement(FileText, {
    className: "h-16 w-16 text-gray-300 mb-4"
  }), /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-gray-700 mb-2"
  }, "\u3010 ", formData.surveyType, " \u3011\u984C\u5EAB\u5340\u584A"), /*#__PURE__*/React.createElement("p", {
    className: "text-gray-500 text-sm"
  }, "\u8ACB\u7B49\u5019\u63D0\u4F9B\u8A73\u7D30\u984C\u76EE\u5F8C\uFF0C\u65BC\u6B64\u8655\u751F\u6210\u5C0D\u61C9\u7684\u554F\u5377\u8868\u55AE\u5167\u5BB9\u3002")), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end space-x-4 pt-6 border-t mt-8"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setView('survey-list'),
    className: "px-6 py-2.5 border rounded-md text-gray-600 hover:bg-gray-50 font-medium transition-colors"
  }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "px-8 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 font-bold shadow-sm transition-colors"
  }, /*#__PURE__*/React.createElement(Save, {
    className: "h-5 w-5"
  }), " \u5132\u5B58\u8868\u55AE"))));
};

// ==========================================
//           9. 客戶建檔 (客戶管理) 相關元件
// ==========================================

const CustomerList = ({
  cases,
  setCases,
  setEditingCase,
  setView,
  showToast
}) => {
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [deleteModal, setDeleteModal] = useState({
    show: false,
    id: null
  });
  const dragProps = useDragScroll();
  const filteredCustomers = useMemo(() => {
    const kw = appliedKeyword.trim().toLowerCase();
    let list = cases;
    if (kw) {
      list = cases.filter(c => [c.name, c.taxId, c.principal, c.phone, c.address].filter(Boolean).some(v => String(v).toLowerCase().includes(kw)));
    }
    return [...list].sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
  }, [cases, appliedKeyword]);
  const handleSearch = () => setAppliedKeyword(keyword);
  const handleKeyDown = e => {
    if (e.key === 'Enter') handleSearch();
  };
  const handleDelete = id => {
    setCases(cases.filter(c => c.id !== id));
    setDeleteModal({
      show: false,
      id: null
    });
    showToast('客戶已刪除');
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-6 rounded-lg shadow-sm border border-gray-100"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap items-end gap-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-gray-500 mb-1"
  }, "\u95DC\u9375\u5B57"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: keyword,
    onChange: e => setKeyword(e.target.value),
    onKeyDown: handleKeyDown,
    placeholder: "\u5BA2\u6236\u540D\u7A31 / \u7D71\u4E00\u7DE8\u865F / \u8CA0\u8CAC\u4EBA",
    className: "w-64 p-2.5 border rounded-md outline-none focus:border-blue-500"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: handleSearch,
    className: "flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md shadow-sm transition-colors"
  }, /*#__PURE__*/React.createElement(Search, {
    className: "h-4 w-4"
  }), " \u641C\u5C0B")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('customer-add'),
    className: "flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md shadow-sm transition-colors",
    title: "\u65B0\u589E\u5BA2\u6236"
  }, /*#__PURE__*/React.createElement(Plus, {
    className: "h-5 w-5"
  }), " \u65B0\u589E\u5BA2\u6236")), /*#__PURE__*/React.createElement("div", _extends({}, dragProps, {
    className: "overflow-x-auto border rounded-lg cursor-grab active:cursor-grabbing"
  }), /*#__PURE__*/React.createElement("table", {
    className: "w-full text-left text-sm text-gray-600 whitespace-nowrap select-none"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 text-gray-700 border-b"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold text-center w-24"
  }, "\u64CD\u4F5C"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u5BA2\u6236\u540D\u7A31"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u7D71\u4E00\u7DE8\u865F"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u8CA0\u8CAC\u4EBA"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u670D\u52D9\u7B49\u7D1A"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u4FDD\u990A\u5340\u9593"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u516C\u53F8\u96FB\u8A71"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold text-center"
  }, "\u627F\u8FA6\u7B46\u6578"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u65B0\u589E\u65E5\u671F"))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-gray-100"
  }, filteredCustomers.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 9,
    className: "p-10 text-center text-gray-400 text-base"
  }, "\u7121\u8CC7\u6599")) : filteredCustomers.map(c => /*#__PURE__*/React.createElement("tr", {
    key: c.id,
    className: "hover:bg-blue-50/50 transition-colors"
  }, /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-center space-x-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEditingCase(c);
      setView('customer-edit');
    },
    className: "p-1.5 text-blue-600 hover:bg-blue-100 rounded",
    title: "\u7DE8\u8F2F"
  }, /*#__PURE__*/React.createElement(Edit, {
    className: "h-4 w-4"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setDeleteModal({
      show: true,
      id: c.id
    }),
    className: "p-1.5 text-red-600 hover:bg-red-100 rounded",
    title: "\u522A\u9664"
  }, /*#__PURE__*/React.createElement(Trash2, {
    className: "h-4 w-4"
  })))), /*#__PURE__*/React.createElement("td", {
    className: "p-3 font-medium text-gray-800"
  }, c.name), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.taxId || '—'), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.principal || '—'), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
  }, c.serviceLevel)), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.maintenanceInterval || '—'), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, c.phone || '—'), /*#__PURE__*/React.createElement("td", {
    className: "p-3 text-center"
  }, (c.contacts || []).length), /*#__PURE__*/React.createElement("td", {
    className: "p-3 text-gray-500"
  }, c.createdDate)))))), deleteModal.show && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center z-50"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-3 text-red-600 mb-4"
  }, /*#__PURE__*/React.createElement(AlertCircle, {
    className: "h-6 w-6"
  }), /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-gray-800"
  }, "\u78BA\u8A8D\u522A\u9664")), /*#__PURE__*/React.createElement("p", {
    className: "text-gray-600 mb-6"
  }, "\u78BA\u5B9A\u8981\u522A\u9664\u6B64\u5BA2\u6236\u55CE\uFF1F\u522A\u9664\u5F8C\u5C07\u7121\u6CD5\u5FA9\u539F\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end space-x-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setDeleteModal({
      show: false,
      id: null
    }),
    className: "px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
  }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleDelete(deleteModal.id),
    className: "px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
  }, "\u78BA\u8A8D\u522A\u9664")))));
};
const CustomerForm = ({
  cases,
  setCases,
  targetCase,
  setView,
  showToast
}) => {
  const isEdit = !!targetCase;
  const [formData, setFormData] = useState(() => ({
    name: targetCase?.name || '',
    taxId: targetCase?.taxId || '',
    principal: targetCase?.principal || '',
    serviceLevel: targetCase?.serviceLevel || '保修(一年一次)',
    maintenanceInterval: targetCase?.maintenanceInterval || '每半年',
    phone: targetCase?.phone || '',
    fax: targetCase?.fax || '',
    address: targetCase?.address || '',
    remarks: targetCase?.remarks || ''
  }));
  const [contacts, setContacts] = useState(() => targetCase?.contacts ? targetCase.contacts.map(ct => ({
    ...ct
  })) : []);
  const [contactModal, setContactModal] = useState({
    show: false
  });
  const [currentContact, setCurrentContact] = useState({
    id: null,
    title: '',
    name: '',
    phone: '',
    email: ''
  });
  const handleChange = e => {
    const {
      name,
      value
    } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  const handleContactChange = e => {
    const {
      name,
      value
    } = e.target;
    setCurrentContact(prev => ({
      ...prev,
      [name]: value
    }));
  };
  const openAddContact = () => {
    setCurrentContact({
      id: null,
      title: '',
      name: '',
      phone: '',
      email: ''
    });
    setContactModal({
      show: true
    });
  };
  const openEditContact = ct => {
    setCurrentContact({
      ...ct
    });
    setContactModal({
      show: true
    });
  };
  const handleSaveContact = () => {
    if (!currentContact.name.trim()) {
      showToast('承辦姓名為必填', 'error');
      return;
    }
    if (currentContact.id) {
      setContacts(contacts.map(ct => ct.id === currentContact.id ? {
        ...currentContact
      } : ct));
    } else {
      setContacts([...contacts, {
        ...currentContact,
        id: Date.now()
      }]);
    }
    setContactModal({
      show: false
    });
    showToast('承辦資料暫存成功');
  };
  const handleDeleteContact = id => {
    setContacts(contacts.filter(ct => ct.id !== id));
  };
  const handleSubmit = e => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('客戶名稱為必填', 'error');
      return;
    }
    if (isEdit) {
      setCases(cases.map(c => c.id === targetCase.id ? {
        ...c,
        ...formData,
        contacts
      } : c));
      showToast('客戶資料更新成功');
    } else {
      const newCustomer = {
        id: `CUST${Date.now()}`,
        ...formData,
        contacts,
        createdDate: todayDate
      };
      setCases([newCustomer, ...cases]);
      showToast('客戶新增成功');
    }
    setView('customer-list');
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "max-w-5xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-gray-100 relative"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mb-6 pb-4 border-b"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-bold flex items-center gap-2"
  }, isEdit ? /*#__PURE__*/React.createElement(Edit, {
    className: "text-blue-600"
  }) : /*#__PURE__*/React.createElement(Plus, {
    className: "text-blue-600"
  }), isEdit ? ' 編輯客戶' : ' 新增客戶'), /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('customer-list'),
    className: "p-2 hover:bg-gray-100 rounded-full"
  }, /*#__PURE__*/React.createElement(X, {
    className: "h-5 w-5"
  }))), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit,
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-3 gap-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "col-span-full font-semibold text-lg text-blue-800 border-b pb-2 mb-2"
  }, "\u57FA\u672C\u8CC7\u6599"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u5BA2\u6236\u540D\u7A31 ", /*#__PURE__*/React.createElement("span", {
    className: "text-red-500"
  }, "*")), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "name",
    value: formData.name,
    onChange: handleChange,
    required: true,
    className: "w-full p-2.5 border rounded-md outline-none focus:border-blue-500"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u7D71\u4E00\u7DE8\u865F"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "taxId",
    value: formData.taxId,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:border-blue-500"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u8CA0\u8CAC\u4EBA"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "principal",
    value: formData.principal,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:border-blue-500"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u670D\u52D9\u7B49\u7D1A"), /*#__PURE__*/React.createElement("select", {
    name: "serviceLevel",
    value: formData.serviceLevel,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none"
  }, SERVICE_LEVEL_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u4FDD\u990A\u5340\u9593"), /*#__PURE__*/React.createElement("select", {
    name: "maintenanceInterval",
    value: formData.maintenanceInterval,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none"
  }, MAINTENANCE_INTERVAL_OPTIONS.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt,
    value: opt
  }, opt)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u516C\u53F8\u96FB\u8A71"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "phone",
    value: formData.phone,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:border-blue-500"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u516C\u53F8\u50B3\u771F"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "fax",
    value: formData.fax,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:border-blue-500"
  })), /*#__PURE__*/React.createElement("div", {
    className: "col-span-full md:col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u516C\u53F8\u5730\u5740"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "address",
    value: formData.address,
    onChange: handleChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:border-blue-500"
  })), /*#__PURE__*/React.createElement("div", {
    className: "col-span-full"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u5099\u8A3B\u8AAA\u660E"), /*#__PURE__*/React.createElement("textarea", {
    name: "remarks",
    value: formData.remarks,
    onChange: handleChange,
    rows: 3,
    className: "w-full p-2.5 border rounded-md outline-none focus:border-blue-500"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between border-b pb-2 mb-4"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-semibold text-lg text-blue-800"
  }, "\u627F\u8FA6\u8CC7\u6599 ", /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-normal text-gray-400"
  }, "(\u53EF\u591A\u7B46)")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: openAddContact,
    className: "flex items-center gap-1.5 text-sm bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
  }, /*#__PURE__*/React.createElement(Plus, {
    className: "h-4 w-4"
  }), " \u52A0\u5165\u627F\u8FA6\u8CC7\u6599")), contacts.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-center text-gray-400 py-6 border border-dashed rounded-md"
  }, "\u5C1A\u672A\u52A0\u5165\u627F\u8FA6\u8CC7\u6599") : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto border rounded-lg"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-left text-sm text-gray-600"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 text-gray-700 border-b"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u627F\u8FA6\u8077\u7A31"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u627F\u8FA6\u59D3\u540D"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u627F\u8FA6\u96FB\u8A71"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold"
  }, "\u627F\u8FA6Mail"), /*#__PURE__*/React.createElement("th", {
    className: "p-3 font-semibold text-center w-24"
  }, "\u64CD\u4F5C"))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-gray-100"
  }, contacts.map(ct => /*#__PURE__*/React.createElement("tr", {
    key: ct.id,
    className: "hover:bg-blue-50/50"
  }, /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, ct.title || '—'), /*#__PURE__*/React.createElement("td", {
    className: "p-3 font-medium text-gray-800"
  }, ct.name), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, ct.phone || '—'), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, ct.email || '—'), /*#__PURE__*/React.createElement("td", {
    className: "p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-center space-x-2"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => openEditContact(ct),
    className: "p-1.5 text-blue-600 hover:bg-blue-100 rounded",
    title: "\u7DE8\u8F2F\u627F\u8FA6\u8CC7\u6599"
  }, /*#__PURE__*/React.createElement(Edit, {
    className: "h-4 w-4"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => handleDeleteContact(ct.id),
    className: "p-1.5 text-red-600 hover:bg-red-100 rounded",
    title: "\u522A\u9664\u627F\u8FA6\u8CC7\u6599"
  }, /*#__PURE__*/React.createElement(Trash2, {
    className: "h-4 w-4"
  })))))))))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-3 pt-4 border-t"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setView('customer-list'),
    className: "px-6 py-2.5 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
  }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-colors"
  }, /*#__PURE__*/React.createElement(Save, {
    className: "h-5 w-5"
  }), " \u5132\u5B58"))), contactModal.show && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mb-4 pb-3 border-b"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-gray-800"
  }, currentContact.id ? '編輯承辦資料' : '新增承辦資料'), /*#__PURE__*/React.createElement("button", {
    onClick: () => setContactModal({
      show: false
    }),
    className: "p-1.5 hover:bg-gray-100 rounded-full"
  }, /*#__PURE__*/React.createElement(X, {
    className: "h-5 w-5"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u627F\u8FA6\u8077\u7A31"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "title",
    value: currentContact.title,
    onChange: handleContactChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:border-blue-500"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u627F\u8FA6\u59D3\u540D ", /*#__PURE__*/React.createElement("span", {
    className: "text-red-500"
  }, "*")), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "name",
    value: currentContact.name,
    onChange: handleContactChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:border-blue-500"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u627F\u8FA6\u96FB\u8A71"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "phone",
    value: currentContact.phone,
    onChange: handleContactChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:border-blue-500"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm mb-1"
  }, "\u627F\u8FA6Mail"), /*#__PURE__*/React.createElement("input", {
    type: "email",
    name: "email",
    value: currentContact.email,
    onChange: handleContactChange,
    className: "w-full p-2.5 border rounded-md outline-none focus:border-blue-500"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-3 mt-6"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setContactModal({
      show: false
    }),
    className: "px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
  }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
    onClick: handleSaveContact,
    className: "flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
  }, /*#__PURE__*/React.createElement(Save, {
    className: "h-4 w-4"
  }), " \u5132\u5B58\u8A2D\u5099")))));
};

// ==========================================
//           8. 主應用程式框架
// ==========================================

function JinChuanWarRoom() {
  const [currentTopMenu, setCurrentTopMenu] = useState('戰情室');
  const [expandedSidebar, setExpandedSidebar] = useState(['維修服務', '工程服務', '客戶建檔']);
  const [currentSubMenu, setCurrentSubMenu] = useState('現勘表收集');
  const [view, setView] = useState('survey-list');
  const [cases, setCases] = useState(INITIAL_CASES);
  const [maintenanceCases, setMaintenanceCases] = useState(INITIAL_MAINTENANCE_CASES);
  const [projectCases, setProjectCases] = useState(INITIAL_PROJECT_CASES);
  const [surveyCases, setSurveyCases] = useState(INITIAL_SURVEY_CASES);
  const [customers, setCustomers] = useState(INITIAL_CUSTOMERS);
  const [editingCase, setEditingCase] = useState(null);
  const [viewingCase, setViewingCase] = useState(null);
  const [statusFilter, setStatusFilter] = useState('全部');
  const [toast, setToast] = useState({
    show: false,
    message: '',
    type: 'success'
  });

  // 切換次選單時自動切換預設視圖
  useEffect(() => {
    if (currentSubMenu === '案件處理') setView('list');
    if (currentSubMenu === '叫修案件紀錄') setView('record-list');
    if (currentSubMenu === '保養計劃進度') setView('maintenance-list');
    if (currentSubMenu === '案件銷案審核') setView('review-list');
    if (currentSubMenu === '工程立案') setView('project-list');
    if (currentSubMenu === '現勘表收集') setView('survey-list');
    if (currentSubMenu === '客戶管理') setView('customer-list');
  }, [currentSubMenu]);
  const showToast = (message, type = 'success') => {
    setToast({
      show: true,
      message,
      type
    });
    setTimeout(() => setToast({
      show: false,
      message: '',
      type: 'success'
    }), 3000);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "h-screen bg-gray-100 flex flex-col font-sans overflow-hidden"
  }, /*#__PURE__*/React.createElement(Header, {
    currentTopMenu: currentTopMenu,
    setCurrentTopMenu: setCurrentTopMenu
  }), toast.show && /*#__PURE__*/React.createElement("div", {
    className: `fixed top-20 right-6 px-6 py-3 rounded-md shadow-lg z-50 flex items-center gap-3 transform transition-all duration-300 translate-y-0 opacity-100 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`
  }, toast.type === 'error' ? /*#__PURE__*/React.createElement(AlertCircle, {
    className: "h-5 w-5"
  }) : /*#__PURE__*/React.createElement(CheckCircle, {
    className: "h-5 w-5"
  }), /*#__PURE__*/React.createElement("span", {
    className: "font-medium"
  }, toast.message)), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-1 overflow-hidden"
  }, currentTopMenu === '戰情室' && /*#__PURE__*/React.createElement("aside", {
    className: "w-56 bg-white border-r border-gray-200 shadow-sm flex flex-col shrink-0 z-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-4 border-b border-gray-100 bg-gray-50/50"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-base font-bold text-gray-700 tracking-wide"
  }, currentTopMenu, " \u9078\u55AE")), /*#__PURE__*/React.createElement("nav", {
    className: "flex-1 p-3 space-y-1 overflow-y-auto"
  }, [{
    id: '維修服務',
    icon: Wrench,
    children: [{
      id: '案件處理',
      label: '案件處理'
    }, {
      id: '叫修案件紀錄',
      label: '叫修案件紀錄'
    }, {
      id: '保養計劃進度',
      label: '保養計劃進度'
    }, {
      id: '案件銷案審核',
      label: '案件銷案審核'
    }]
  }, {
    id: '工程服務',
    icon: Home,
    children: [{
      id: '工程立案',
      label: '工程立案'
    }, {
      id: '現勘表收集',
      label: '現勘表收集'
    }]
  }, {
    id: '客戶建檔',
    icon: User,
    children: [{
      id: '客戶管理',
      label: '客戶管理'
    }]
  }].map(menu => /*#__PURE__*/React.createElement("div", {
    key: menu.id,
    className: "mb-1"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (menu.children) {
        setExpandedSidebar(prev => prev.includes(menu.id) ? prev.filter(id => id !== menu.id) : [...prev, menu.id]);
      } else {
        setCurrentSubMenu(menu.id);
      }
    },
    className: `w-full flex items-center justify-between px-3 py-3 rounded-md transition-all ${!menu.children && currentSubMenu === menu.id || menu.children && expandedSidebar.includes(menu.id) ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-3"
  }, /*#__PURE__*/React.createElement(menu.icon, {
    className: `h-5 w-5 ${!menu.children && currentSubMenu === menu.id || menu.children && expandedSidebar.includes(menu.id) ? 'text-blue-600' : 'text-gray-400'}`
  }), /*#__PURE__*/React.createElement("span", null, menu.id)), menu.children && /*#__PURE__*/React.createElement(ChevronDown, {
    className: `h-4 w-4 transition-transform ${expandedSidebar.includes(menu.id) ? 'rotate-180' : ''}`
  })), menu.children && expandedSidebar.includes(menu.id) && /*#__PURE__*/React.createElement("div", {
    className: "mt-1 ml-4 pl-4 border-l-2 border-gray-100 space-y-1"
  }, menu.children.map(sub => /*#__PURE__*/React.createElement("button", {
    key: sub.id,
    onClick: () => setCurrentSubMenu(sub.id),
    className: `w-full flex items-center px-3 py-2 rounded-md transition-all text-sm ${currentSubMenu === sub.id ? 'bg-blue-100/50 text-blue-700 font-bold' : 'text-gray-500 hover:bg-gray-50 hover:text-blue-600'}`
  }, sub.label))))))), /*#__PURE__*/React.createElement("main", {
    className: "flex-1 overflow-y-auto p-6 w-full"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-[1600px] mx-auto w-full"
  }, currentTopMenu !== '戰情室' ? /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-center h-64 text-gray-400"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xl"
  }, "\u6B64\u70BA\u300C", currentTopMenu, "\u300D\u6A21\u7D44\uFF0C\u6B63\u5728\u958B\u767C\u4E2D...")) : !['案件處理', '叫修案件紀錄', '案件銷案審核', '保養計劃進度', '工程立案', '現勘表收集', '客戶管理'].includes(currentSubMenu) ? /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-center h-64 text-gray-400"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xl"
  }, "\u6B64\u70BA\u300C", currentSubMenu, "\u300D\u529F\u80FD\uFF0C\u8ACB\u9EDE\u9078\u9078\u55AE\u67E5\u770B\u5BE6\u4F5C")) : /*#__PURE__*/React.createElement(React.Fragment, null, view === 'list' && /*#__PURE__*/React.createElement(CaseList, {
    cases: cases,
    setCases: setCases,
    setEditingCase: setEditingCase,
    setView: setView,
    showToast: showToast,
    statusFilter: statusFilter,
    setStatusFilter: setStatusFilter
  }), view === 'add' && /*#__PURE__*/React.createElement(AddCaseForm, {
    cases: cases,
    setCases: setCases,
    setView: setView,
    showToast: showToast
  }), view === 'edit' && /*#__PURE__*/React.createElement(EditCaseForm, {
    editingCase: editingCase,
    cases: cases,
    setCases: setCases,
    setView: setView,
    showToast: showToast
  }), view === 'record-list' && /*#__PURE__*/React.createElement(CaseRecordList, {
    cases: cases,
    setViewingCase: setViewingCase,
    setView: setView
  }), view === 'record-view' && /*#__PURE__*/React.createElement(ViewCaseForm, {
    viewingCase: viewingCase,
    setView: setView,
    backView: "record-list"
  }), view === 'review-list' && /*#__PURE__*/React.createElement(CaseReviewList, {
    cases: cases,
    setCases: setCases,
    setViewingCase: setViewingCase,
    setView: setView,
    showToast: showToast
  }), view === 'review-view' && /*#__PURE__*/React.createElement(ViewCaseForm, {
    viewingCase: viewingCase,
    setView: setView,
    backView: "review-list"
  }), view === 'maintenance-list' && /*#__PURE__*/React.createElement(MaintenanceList, {
    cases: maintenanceCases,
    setCases: setMaintenanceCases,
    setViewingCase: setViewingCase,
    setEditingCase: setEditingCase,
    setView: setView,
    showToast: showToast
  }), view === 'maintenance-view' && /*#__PURE__*/React.createElement(MaintenanceViewEditForm, {
    targetCase: viewingCase,
    setView: setView,
    mode: "view",
    showToast: showToast
  }), view === 'maintenance-edit' && /*#__PURE__*/React.createElement(MaintenanceViewEditForm, {
    targetCase: editingCase,
    cases: maintenanceCases,
    setCases: setMaintenanceCases,
    setView: setView,
    mode: "edit",
    showToast: showToast
  }), view === 'project-list' && /*#__PURE__*/React.createElement(ProjectList, {
    cases: projectCases,
    setCases: setProjectCases,
    setEditingCase: setEditingCase,
    setView: setView,
    showToast: showToast
  }), view === 'project-add' && /*#__PURE__*/React.createElement(AddProjectForm, {
    cases: projectCases,
    setCases: setProjectCases,
    setView: setView,
    showToast: showToast
  }), view === 'project-edit' && /*#__PURE__*/React.createElement(EditProjectForm, {
    editingCase: editingCase,
    cases: projectCases,
    setCases: setProjectCases,
    setView: setView,
    showToast: showToast
  }), view === 'survey-list' && /*#__PURE__*/React.createElement(SurveyList, {
    cases: surveyCases,
    setCases: setSurveyCases,
    setEditingCase: setEditingCase,
    setView: setView,
    showToast: showToast
  }), view === 'survey-add' && /*#__PURE__*/React.createElement(SurveyForm, {
    cases: surveyCases,
    setCases: setSurveyCases,
    setView: setView,
    showToast: showToast
  }), view === 'survey-edit' && /*#__PURE__*/React.createElement(SurveyForm, {
    cases: surveyCases,
    setCases: setSurveyCases,
    targetCase: editingCase,
    setView: setView,
    showToast: showToast
  }), view === 'customer-list' && /*#__PURE__*/React.createElement(CustomerList, {
    cases: customers,
    setCases: setCustomers,
    setEditingCase: setEditingCase,
    setView: setView,
    showToast: showToast
  }), view === 'customer-add' && /*#__PURE__*/React.createElement(CustomerForm, {
    cases: customers,
    setCases: setCustomers,
    setView: setView,
    showToast: showToast
  }), view === 'customer-edit' && /*#__PURE__*/React.createElement(CustomerForm, {
    cases: customers,
    setCases: setCustomers,
    targetCase: editingCase,
    setView: setView,
    showToast: showToast
  }))))));
}
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(JinChuanWarRoom));
