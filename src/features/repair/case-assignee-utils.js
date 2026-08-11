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

  function getFormalAssignees(record) {
    return getAssignees(record).filter(function (n) { return !isUnassignedValue(n); });
  }

  function hasFormalAssignee(record) {
    return getFormalAssignees(record).length > 0;
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
      performanceAssignees: performanceAssignees
    });
    delete next.assignee;
    delete next.collaborators;
    return next;
  }

  function sumProcessPoints(record) {
    var total = 0;
    ((record && record.processRecords) || []).forEach(function (r) {
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
    getFormalAssignees: getFormalAssignees,
    hasFormalAssignee: hasFormalAssignee,
    formatAssignees: formatAssignees,
    includesAssignee: includesAssignee,
    getPerformanceAssignees: getPerformanceAssignees,
    normalizeRepairCase: normalizeRepairCase,
    sumProcessPoints: sumProcessPoints,
    computeBonusPointsForAssignee: computeBonusPointsForAssignee
  };
})();
