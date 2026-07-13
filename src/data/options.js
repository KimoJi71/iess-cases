/*
 * data/options.js — 全域選項常數
 *
 * 以頂層 const 宣告（classic script 的全域語彙作用域，後續所有 script 皆可存取）。
 * 純資料，無邏輯。
 */
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
const STORE_STATUS_OPTIONS = ['正常營業', '整裝', '撤店'];
const WORK_ORDER_APPLY_OPTIONS = ['是', '否'];

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
