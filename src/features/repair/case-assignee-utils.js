/*
 * features/repair/case-assignee-utils.js — 叫修多指派／積分
 */
(function () {
  'use strict';

  var UNASSIGNED_VALUES = ['', '案件待辦', '尚未指派'];

  function isUnassignedValue(name) {
    return UNASSIGNED_VALUES.indexOf(name == null ? '' : String(name)) !== -1;
  }

  function asStringArray(value) {
    if (Array.isArray(value)) {
      return value.map(function (v) { return String(v || ''); }).filter(function (v, i, arr) {
        return v && arr.indexOf(v) === i;
      });
    }
    if (value == null || value === '') return [];
    return [String(value)];
  }

  function getAssignees(record) {
    if (!record) return [];
    if (Array.isArray(record.assignees)) {
      var fromArray = asStringArray(record.assignees);
      if (fromArray.length) return fromArray;
    }
    return asStringArray(record.assignee);
  }

  // 指派人員：存組別成員的帳號 id（與 assignees[].memberIds、performanceMemberIds 同一套 id）。
  function getAssigneeMemberIds(record) {
    if (!record) return [];
    return asStringArray(record.assigneeMemberIds);
  }

  function formatAssigneeMembers(record) {
    var ids = getAssigneeMemberIds(record);
    if (!ids.length) return '';
    var names = window.AssigneeUtils ? AssigneeUtils.formatMemberIds(ids) : ids;
    return names.join('、');
  }

  function getFormalAssignees(record) {
    return getAssignees(record).filter(function (n) { return !isUnassignedValue(n); });
  }

  function hasFormalAssignee(record) {
    return getFormalAssignees(record).length > 0;
  }

  function getPartnerVendorIds(record) {
    return asStringArray(record && record.partnerVendorIds);
  }

  function hasPartnerVendor(record) {
    return getPartnerVendorIds(record).length > 0;
  }

  function formatAssignees(record) {
    var list = getAssignees(record);
    if (!list.length) return '';
    return list.join('、');
  }

  function includesAssignee(record, name) {
    if (!name) return false;
    return getAssignees(record).indexOf(name) !== -1;
  }

  function getPerformanceAssignees(record) {
    if (!record) return [];
    var formal = getFormalAssignees(record);
    if (formal.length) return formal;
    if (Array.isArray(record.performanceAssignees)) {
      var fromPerf = asStringArray(record.performanceAssignees).filter(function (n) {
        return !isUnassignedValue(n);
      });
      if (fromPerf.length) return fromPerf;
    }
    if (record.performanceAssignee && !isUnassignedValue(record.performanceAssignee)) {
      return [String(record.performanceAssignee)];
    }
    return [];
  }

  function normalizeProcessStatus(status) {
    if (!status || status === '其他') return null;
    if (status === '待汰換') return '轉汰換';
    return status;
  }

  function normalizeRepairCase(record) {
    if (!record) return record;
    var assignees = getAssignees(record);
    var performanceAssignees = Array.isArray(record.performanceAssignees)
      ? asStringArray(record.performanceAssignees)
      : [];
    if (!performanceAssignees.length) {
      performanceAssignees = asStringArray(record.performanceAssignee);
    }
    var next = Object.assign({}, record, {
      assignees: assignees,
      assigneeMemberIds: getAssigneeMemberIds(record),
      performanceAssignees: performanceAssignees,
      vehicleId: record.vehicleId || '',
      partnerVendorIds: asStringArray(record.partnerVendorIds),
      processStatus: Object.prototype.hasOwnProperty.call(record, 'processStatus')
        ? normalizeProcessStatus(record.processStatus)
        : record.processStatus
    });
    delete next.assignee;
    delete next.collaborators;
    return next;
  }

  // 保養計劃的組別原本是單選字串（含 '尚未指派' 這個佔位值），改多選後一律以 assignees[] 為準。
  // '尚未指派' 不是真的組別，正規化時濾掉：空陣列就代表未指派。
  function normalizeMaintenanceCase(record) {
    if (!record) return record;
    var next = Object.assign({}, record, {
      assignees: getFormalAssignees(record),
      assigneeMemberIds: getAssigneeMemberIds(record)
    });
    delete next.assignee;
    return next;
  }

  function formatMaintenanceAssignees(record) {
    return formatAssignees(record) || '尚未指派';
  }

  // 只有「已處理」的處理方式計入積分（舊資料無 status 視為已處理）。
  function sumProcessPoints(record) {
    var total = 0;
    ((record && record.processRecords) || []).forEach(function (r) {
      if (!ProcessMethodUtils.isCaseRecordDone(r)) return;
      var points = Number(r.points) || 0;
      var qty = Number(r.qty) > 0 ? Number(r.qty) : 1;
      total += points * qty;
    });
    return total;
  }

  function computeBonusPointsForAssignee(record, assigneeName) {
    if (!record || !assigneeName) return 0;
    var formal = getPerformanceAssignees(record);
    if (formal.indexOf(assigneeName) === -1) return 0;
    var n = formal.length;
    return n > 0 ? sumProcessPoints(record) / n : 0;
  }

  window.CaseAssigneeUtils = {
    UNASSIGNED_VALUES: UNASSIGNED_VALUES,
    isUnassignedValue: isUnassignedValue,
    getAssignees: getAssignees,
    getAssigneeMemberIds: getAssigneeMemberIds,
    formatAssigneeMembers: formatAssigneeMembers,
    getFormalAssignees: getFormalAssignees,
    hasFormalAssignee: hasFormalAssignee,
    getPartnerVendorIds: getPartnerVendorIds,
    hasPartnerVendor: hasPartnerVendor,
    formatAssignees: formatAssignees,
    includesAssignee: includesAssignee,
    getPerformanceAssignees: getPerformanceAssignees,
    normalizeProcessStatus: normalizeProcessStatus,
    normalizeRepairCase: normalizeRepairCase,
    normalizeMaintenanceCase: normalizeMaintenanceCase,
    formatMaintenanceAssignees: formatMaintenanceAssignees,
    sumProcessPoints: sumProcessPoints,
    computeBonusPointsForAssignee: computeBonusPointsForAssignee
  };
})();
