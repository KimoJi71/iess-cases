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
    getLevel: getLevel,
    formatLevel: formatLevel,
    isEquipmentUsedInRepair: isEquipmentUsedInRepair,
    isEquipmentInProjectCases: isEquipmentInProjectCases,
    getEquipmentDeleteBlockedReason: getEquipmentDeleteBlockedReason,
    canDeleteEquipment: canDeleteEquipment,
    canRemoveProjectEquipment: canRemoveProjectEquipment,
    getProjectEquipmentRemoveBlockedReason: getProjectEquipmentRemoveBlockedReason,
    removeEquipmentFromProjectCases: removeEquipmentFromProjectCases
  };
})();
