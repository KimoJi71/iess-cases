/*
 * features/customer/equipment-utils.js — 設備移除（工程立案）共用邏輯、設備等級讀取
 */
(function () {
  'use strict';

  // 設備等級的唯一來源是設備紀錄本身（於「設備管理」設定），不再回頭查設備分類。
  function getLevel(equip) {
    var level = String((equip && equip.equipmentLevel) || '').trim();
    return level || DEFAULT_EQUIPMENT_LEVEL;
  }

  // 顯示用：未選型號的空白設備列回空字串，避免被標成「一般設備」
  function formatLevel(equip) {
    if (!equip || !String(equip.model || '').trim()) return '';
    return getLevel(equip);
  }

  function isEquipmentUsedInRepair(equipmentId, repairCases) {
    if (equipmentId == null || equipmentId === '') return false;
    var target = String(equipmentId);
    // 這個判斷用來擋刪除：找不到 RepairCaseServiceItems 時無法確認設備是否還在用，
    // 寧可保守回 true（視為仍在使用、擋下刪除），也不要因缺依賴而誤判成可刪除。
    if (!window.RepairCaseServiceItems) return true;
    return (repairCases || []).some(function (c) {
      // 一筆叫修案件可能掛多台設備，逐張卡片比對
      return RepairCaseServiceItems.getEquipments(c).some(function (eq) {
        return eq && String(eq.id) === target;
      });
    });
  }

  function isEquipmentInProjectCases(equipmentId, projectCases) {
    if (equipmentId == null || equipmentId === '') return false;
    var target = String(equipmentId);
    return (projectCases || []).some(function (project) {
      return ((project.details && project.details.equipment) || []).some(function (eq) {
        return eq && String(eq.id) === target;
      });
    });
  }

  function canRemoveProjectEquipment(equipmentId, repairCases) {
    if (isEquipmentUsedInRepair(equipmentId, repairCases)) {
      return false;
    }
    return true;
  }

  function getProjectEquipmentRemoveBlockedReason(equipmentId, repairCases) {
    if (isEquipmentUsedInRepair(equipmentId, repairCases)) {
      return '此設備已有叫修紀錄，無法移除';
    }
    return '';
  }

  function defaultStatus() {
    return typeof EQUIP_STATUS_OPTIONS !== 'undefined' ? EQUIP_STATUS_OPTIONS[0] : '運轉中';
  }

  // 舊資料的設備狀態（運轉／轉汰換）對應到新選項
  var LEGACY_STATUS_MAP = { 運轉: '運轉中', 轉汰換: '達年限' };

  function normalizeStatus(status) {
    var val = String(status || '').trim();
    if (!val) return defaultStatus();
    return LEGACY_STATUS_MAP[val] || val;
  }

  // 已汰換的設備不可再被叫修案件加入
  function isRetired(equip) {
    return normalizeStatus(equip && equip.status) === '已汰換';
  }

  // 達年限的設備仍可選用，但在列表以紅字提醒
  function isOverAge(equip) {
    return normalizeStatus(equip && equip.status) === '達年限';
  }

  var LIST_COLUMNS = [
    { key: 'category', label: '設備分類' },
    { key: 'brand', label: '品牌' },
    { key: 'deviceName', label: '設備名稱', altKey: 'name', cellClass: 'p-3 font-medium text-gray-800' },
    { key: 'specification', label: '設備規格' },
    { key: 'model', label: '型號' },
    { key: 'equipmentLevel', label: '設備等級', kind: 'level' },
    { key: 'area', label: '設備區域' },
    { key: 'acceptanceDate', label: '驗收日期' },
    { key: 'installer', label: '安裝人員' },
    { key: 'assetNumber', label: '資產編號' },
    { key: 'serialNumber', label: '流水序號' },
    { key: 'status', label: '設備狀態', kind: 'status' }
  ];

  function renderStatusBadge(h, status) {
    var map = {
      運轉中: 'bg-green-100 text-green-700',
      達年限: 'bg-red-100 text-red-700',
      已汰換: 'bg-gray-200 text-gray-600'
    };
    var label = normalizeStatus(status);
    return h('span', {
      className: 'px-2 py-0.5 rounded-full text-xs font-medium ' + (map[label] || 'bg-gray-100 text-gray-600')
    }, label);
  }

  function renderLevelBadge(h, eq) {
    if (!eq || !String(eq.model || '').trim()) return '—';
    var level = getLevel(eq);
    var cls = level === '增額設備'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-gray-100 text-gray-600';
    return h('span', {
      className: 'px-2 py-0.5 rounded-full text-xs font-medium ' + cls
    }, level);
  }

  function listCellText(eq, col) {
    if (col.kind === 'level') {
      if (!eq || !String(eq.model || '').trim()) return '';
      return getLevel(eq);
    }
    var val = eq && eq[col.key];
    if (!val && col.altKey) val = eq[col.altKey];
    return val ? String(val).trim() : '';
  }

  // 設備列表列的可搜尋文字：與畫面上看得到的欄位一致（含設備等級與狀態徽章的文字），
  // 使用者搜什麼就該找得到什麼。
  function listRowText(eq) {
    return LIST_COLUMNS.map(function (col) {
      if (col.kind === 'status') return normalizeStatus(eq && eq.status);
      return listCellText(eq, col);
    }).filter(Boolean).join(' ');
  }

  function renderListHeaderCells(h) {
    return LIST_COLUMNS.map(function (col) {
      return h('th', { className: 'p-3 font-semibold' }, col.label);
    });
  }

  function renderListDataCells(h, eq) {
    return LIST_COLUMNS.map(function (col) {
      var cls = col.cellClass || 'p-3';
      if (col.kind === 'level') return h('td', { className: cls }, renderLevelBadge(h, eq));
      if (col.kind === 'status') return h('td', { className: cls }, renderStatusBadge(h, eq && eq.status));
      return h('td', { className: cls }, listCellText(eq, col) || '—');
    });
  }

  /* --- 工程立案單結案時的設備同步 ---
   * 新開／整裝／加裝：立案單上的設備新增到該門市（安裝人員＝施作單位、驗收日期＝客戶驗收日期）
   * 汰換／撤店：立案單上的設備在設備管理中改為「已汰換」
   */
  var PROJECT_ADD_CATEGORIES = ['新開', '整裝', '加裝'];
  var PROJECT_RETIRE_CATEGORIES = ['汰換', '撤店'];

  function getCustomerAcceptanceDate(projectCase) {
    var entry = ((projectCase && projectCase.history) || []).find(function (item) {
      return item && item.stage === '客戶驗收';
    });
    return (entry && entry.date) || '';
  }

  function sameText(a, b) {
    return String(a || '').trim() === String(b || '').trim();
  }

  // 立案單上的設備多為手動輸入，先比對 id，再以「門市＋型號＋資產編號／流水序號／區域」比對
  function matchesProjectEquip(eq, projectEq, projectCase) {
    if (!eq || !projectEq) return false;
    // 從門市設備列表挑進立案單的設備，用來源 id 直接對上
    if (projectEq.sourceEquipmentId != null && String(eq.id) === String(projectEq.sourceEquipmentId)) return true;
    if (projectEq.id != null && String(eq.id) === String(projectEq.id)) return true;
    if (!sameText(eq.customerName, projectCase.customerName)) return false;
    if (!sameText(eq.storeName, projectCase.storeName)) return false;
    if (!sameText(eq.model, projectEq.model)) return false;
    if (projectEq.assetNumber) return sameText(eq.assetNumber, projectEq.assetNumber);
    if (projectEq.serialNumber) return sameText(eq.serialNumber, projectEq.serialNumber);
    return sameText(eq.area, projectEq.area);
  }

  function toStoreEquipment(projectEq, projectCase, idSuffix) {
    return {
      id: 'E' + idSuffix,
      customerName: projectCase.customerName,
      storeName: projectCase.storeName,
      category: projectEq.category || '',
      brand: projectEq.brand || '',
      deviceName: projectEq.deviceName || projectEq.name || '',
      name: projectEq.deviceName || projectEq.name || '',
      specification: projectEq.specification || '',
      model: projectEq.model || '',
      equipmentLevel: projectEq.equipmentLevel || DEFAULT_EQUIPMENT_LEVEL,
      area: projectEq.area || '',
      acceptanceDate: getCustomerAcceptanceDate(projectCase),
      installer: (projectCase.details && projectCase.details.suggestedContractor) || '',
      assetNumber: projectEq.assetNumber || '',
      serialNumber: projectEq.serialNumber || '',
      status: defaultStatus(),
      createdDate: typeof todayDate !== 'undefined' ? todayDate : ''
    };
  }

  function applyProjectCloseToEquipments(projectCase, equipments) {
    var list = (equipments || []).slice();
    var projectEquips = ((projectCase && projectCase.details && projectCase.details.equipment) || []);
    var category = (projectCase && projectCase.workCategory) || '';
    var result = { equipments: list, added: 0, retired: 0 };
    if (!projectCase || !projectEquips.length) return result;

    if (PROJECT_ADD_CATEGORIES.indexOf(category) !== -1) {
      var stamp = Date.now();
      var added = projectEquips.map(function (projectEq, idx) {
        return toStoreEquipment(projectEq, projectCase, stamp + idx);
      });
      result.equipments = added.concat(list);
      result.added = added.length;
      return result;
    }

    if (PROJECT_RETIRE_CATEGORIES.indexOf(category) !== -1) {
      var retired = 0;
      result.equipments = list.map(function (eq) {
        var hit = projectEquips.some(function (projectEq) {
          return matchesProjectEquip(eq, projectEq, projectCase);
        });
        if (!hit || normalizeStatus(eq.status) === '已汰換') return eq;
        retired += 1;
        return Object.assign({}, eq, { status: '已汰換' });
      });
      result.retired = retired;
      return result;
    }

    return result;
  }

  window.EquipmentUtils = {
    LIST_COLUMNS: LIST_COLUMNS,
    defaultStatus: defaultStatus,
    normalizeStatus: normalizeStatus,
    isRetired: isRetired,
    isOverAge: isOverAge,
    getLevel: getLevel,
    formatLevel: formatLevel,
    renderStatusBadge: renderStatusBadge,
    renderLevelBadge: renderLevelBadge,
    listRowText: listRowText,
    renderListHeaderCells: renderListHeaderCells,
    renderListDataCells: renderListDataCells,
    isEquipmentUsedInRepair: isEquipmentUsedInRepair,
    isEquipmentInProjectCases: isEquipmentInProjectCases,
    canRemoveProjectEquipment: canRemoveProjectEquipment,
    getProjectEquipmentRemoveBlockedReason: getProjectEquipmentRemoveBlockedReason,
    getCustomerAcceptanceDate: getCustomerAcceptanceDate,
    PROJECT_ADD_CATEGORIES: PROJECT_ADD_CATEGORIES,
    PROJECT_RETIRE_CATEGORIES: PROJECT_RETIRE_CATEGORIES,
    applyProjectCloseToEquipments: applyProjectCloseToEquipments
  };
})();
