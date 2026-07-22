/*
 * features/customer/equipment-utils.js — 設備刪除／移除共用邏輯
 */
(function () {
  'use strict';

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
    isEquipmentUsedInRepair: isEquipmentUsedInRepair,
    isEquipmentInProjectCases: isEquipmentInProjectCases,
    getEquipmentDeleteBlockedReason: getEquipmentDeleteBlockedReason,
    canDeleteEquipment: canDeleteEquipment,
    canRemoveProjectEquipment: canRemoveProjectEquipment,
    getProjectEquipmentRemoveBlockedReason: getProjectEquipmentRemoveBlockedReason,
    removeEquipmentFromProjectCases: removeEquipmentFromProjectCases
  };
})();
