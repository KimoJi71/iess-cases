/*
 * features/repair/case-assignee-utils.js — 叫修多指派／協作／積分
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

  function normalizeCollaboratorCount(value) {
    var n = Math.floor(Number(value));
    return n > 0 ? n : 1;
  }

  function getCollaborators(record) {
    if (!record || !Array.isArray(record.collaborators)) return [];
    return record.collaborators.map(function (row) {
      return {
        name: String((row && row.name) || ''),
        count: normalizeCollaboratorCount(row && row.count),
        points: Number(row && row.points) || 0
      };
    }).filter(function (row) { return !!row.name; });
  }

  function formatCollaborators(record) {
    var list = getCollaborators(record);
    if (!list.length) return '—';
    return list.map(function (row) {
      return row.name + '（' + row.count + '人／' + row.points + '分）';
    }).join('、');
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
    var collaborators = getCollaborators(record);
    var performanceAssignees = Array.isArray(record.performanceAssignees)
      ? asStringArray(record.performanceAssignees)
      : [];
    if (!performanceAssignees.length) {
      performanceAssignees = asStringArray(record.performanceAssignee);
    }
    var next = Object.assign({}, record, {
      assignees: assignees,
      collaborators: collaborators,
      performanceAssignees: performanceAssignees
    });
    delete next.assignee;
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
    var collaborators = getCollaborators(record);
    var total = sumProcessPoints(record);
    var collabSum = 0;
    var ownCollab = 0;
    collaborators.forEach(function (row) {
      collabSum += row.points;
      if (row.name === assigneeName) ownCollab += row.points;
    });
    var n = formal.length;
    var share = n > 0 ? (total - collabSum) / n : 0;
    var fromAssign = formal.indexOf(assigneeName) !== -1 ? share : 0;
    return fromAssign + ownCollab;
  }

  function toggleAssignee(assignees, name) {
    var list = asStringArray(assignees);
    var idx = list.indexOf(name);
    if (idx === -1) list.push(name);
    else list.splice(idx, 1);
    return list;
  }

  function toggleCollaborator(collaborators, name) {
    var list = (collaborators || []).map(function (row) {
      return { name: row.name, points: Number(row.points) || 0 };
    });
    var idx = -1;
    list.forEach(function (row, i) { if (row.name === name) idx = i; });
    if (idx === -1) list.push({ name: name, points: 0 });
    else list.splice(idx, 1);
    return list;
  }

  function setCollaboratorPoints(collaborators, name, points) {
    var n = Number(points);
    if (isNaN(n)) n = 0;
    return (collaborators || []).map(function (row) {
      if (row.name !== name) return row;
      return { name: row.name, points: n };
    });
  }

  function addCollaboratorRow(collaborators) {
    return (collaborators || []).slice().concat([{ name: '', count: 1, points: 0 }]);
  }

  function updateCollaboratorRow(collaborators, index, patch) {
    return (collaborators || []).map(function (row, i) {
      if (i !== index) return row;
      return Object.assign({ name: '', count: 1, points: 0 }, row, patch || {});
    });
  }

  function removeCollaboratorRow(collaborators, index) {
    return (collaborators || []).filter(function (row, i) { return i !== index; });
  }

  function getAvailableCollaboratorNames(collaborators, index, allNames) {
    var taken = (collaborators || []).map(function (row, i) {
      return i === index ? '' : String((row && row.name) || '');
    });
    return (allNames || []).filter(function (name) {
      return taken.indexOf(name) === -1;
    });
  }

  window.CaseAssigneeUtils = {
    UNASSIGNED_VALUES: UNASSIGNED_VALUES,
    isUnassignedValue: isUnassignedValue,
    getAssignees: getAssignees,
    getFormalAssignees: getFormalAssignees,
    hasFormalAssignee: hasFormalAssignee,
    formatAssignees: formatAssignees,
    getCollaborators: getCollaborators,
    formatCollaborators: formatCollaborators,
    includesAssignee: includesAssignee,
    getPerformanceAssignees: getPerformanceAssignees,
    normalizeRepairCase: normalizeRepairCase,
    sumProcessPoints: sumProcessPoints,
    computeBonusPointsForAssignee: computeBonusPointsForAssignee,
    toggleAssignee: toggleAssignee,
    toggleCollaborator: toggleCollaborator,
    setCollaboratorPoints: setCollaboratorPoints,
    addCollaboratorRow: addCollaboratorRow,
    updateCollaboratorRow: updateCollaboratorRow,
    removeCollaboratorRow: removeCollaboratorRow,
    getAvailableCollaboratorNames: getAvailableCollaboratorNames
  };
})();
