/*
 * features/customer/equipment-utils.js — 設備刪除／移除共用邏輯、設備等級讀取
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
    return (repairCases || []).some(function (c) {
      return c.equipment && String(c.equipment.id) === target;
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

  function getEquipmentDeleteBlockedReason(equipmentId, repairCases) {
    if (isEquipmentUsedInRepair(equipmentId, repairCases)) {
      return '此設備已有叫修紀錄，無法刪除';
    }
    return '';
  }

  function canDeleteEquipment(equipmentId, repairCases) {
    return !getEquipmentDeleteBlockedReason(equipmentId, repairCases);
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

  var LIST_COLUMNS = [
    { key: 'category', label: '設備分類' },
    { key: 'brand', label: '品牌' },
    { key: 'deviceName', label: '設備名稱', altKey: 'name', cellClass: 'p-3 font-medium text-gray-800' },
    { key: 'specification', label: '設備規格' },
    { key: 'model', label: '型號' },
    { key: 'equipmentLevel', label: '設備等級', kind: 'level' },
    { key: 'area', label: '設備區域' },
    { key: 'manufactureDate', label: '出廠日期' },
    { key: 'installDate', label: '安裝日期' },
    { key: 'assetNumber', label: '資產編號' },
    { key: 'serialNumber', label: '流水序號' },
    { key: 'status', label: '設備狀態', kind: 'status' }
  ];

  function renderStatusBadge(h, status) {
    var map = {
      運轉: 'bg-green-100 text-green-700',
      轉汰換: 'bg-amber-100 text-amber-700',
      已汰換: 'bg-gray-200 text-gray-600'
    };
    var label = status || (typeof EQUIP_STATUS_OPTIONS !== 'undefined' ? EQUIP_STATUS_OPTIONS[0] : '運轉');
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

  function removeEquipmentFromProjectCases(equipmentId, projectCases) {
    var target = String(equipmentId);
    return (projectCases || []).map(function (project) {
      var equipment = (project.details && project.details.equipment) || [];
      var nextEquipment = equipment.filter(function (eq) {
        return !eq || String(eq.id) !== target;
      });
      if (nextEquipment.length === equipment.length) return project;
      return Object.assign({}, project, {
        details: Object.assign({}, project.details, { equipment: nextEquipment })
      });
    });
  }

  window.EquipmentUtils = {
    LIST_COLUMNS: LIST_COLUMNS,
    getLevel: getLevel,
    formatLevel: formatLevel,
    renderStatusBadge: renderStatusBadge,
    renderLevelBadge: renderLevelBadge,
    renderListHeaderCells: renderListHeaderCells,
    renderListDataCells: renderListDataCells,
    isEquipmentUsedInRepair: isEquipmentUsedInRepair,
    isEquipmentInProjectCases: isEquipmentInProjectCases,
    getEquipmentDeleteBlockedReason: getEquipmentDeleteBlockedReason,
    canDeleteEquipment: canDeleteEquipment,
    canRemoveProjectEquipment: canRemoveProjectEquipment,
    getProjectEquipmentRemoveBlockedReason: getProjectEquipmentRemoveBlockedReason,
    removeEquipmentFromProjectCases: removeEquipmentFromProjectCases
  };
})();
