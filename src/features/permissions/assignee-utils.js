/*
 * features/permissions/assignee-utils.js — 組別工具函式
 */
(function () {
  'use strict';
  var global = window;

  function syncAssigneeOptions(assignees) {
    var names = assignees.slice().sort(function (a, b) {
      return a.name.localeCompare(b.name, 'zh-Hant');
    }).map(function (a) { return a.name; });
    ASSIGNEES.length = 0;
    names.forEach(function (n) { ASSIGNEES.push(n); });
    ACCOUNT_ASSIGNEE_OPTIONS.length = 0;
    names.forEach(function (n) { ACCOUNT_ASSIGNEE_OPTIONS.push(n); });
    SCHEDULE_ASSIGNEE_OPTIONS.length = 0;
    names.forEach(function (n) { SCHEDULE_ASSIGNEE_OPTIONS.push(n); });
  }

  function getAssigneeNames(assignees) {
    return assignees.map(function (a) { return a.name; });
  }

  function getMemberIds(assignee) {
    return (assignee && assignee.memberIds) ? assignee.memberIds.slice() : [];
  }

  function formatMembers(accounts, assignee) {
    var ids = getMemberIds(assignee);
    var names = accounts.filter(function (a) { return ids.indexOf(a.id) !== -1; })
      .map(function (a) { return a.name; });
    if (!names.length) return '—';
    return names.join('、');
  }

  function formatLeader(accounts, assignee) {
    if (!assignee || !assignee.leaderId) return '—';
    var account = accounts.find(function (a) { return a.id === assignee.leaderId; });
    return account ? account.name : '—';
  }

  function isRepairCaseOpen(c) {
    if (!c) return false;
    if (!c.isClosed) return true;
    if (c.isListClosed && global.IESS && IESS.caseStatus
      && IESS.caseStatus.isTransferStatus(c.processStatus)) {
      return true;
    }
    return false;
  }

  function projectReferencesAssignee(c, name) {
    if (!c || !name) return false;
    return c.assignee === name || c.stageAssignee === name
      || (c.details && c.details.contactPerson === name);
  }

  function hasOpenCasesForAssignee(name, cases, maintenanceCases, projectCases) {
    if ((cases || []).some(function (c) {
      if (!isRepairCaseOpen(c)) return false;
      if (window.CaseAssigneeUtils) return CaseAssigneeUtils.includesAssignee(c, name);
      return c.assignee === name;
    })) return true;
    if ((maintenanceCases || []).some(function (c) {
      return !c.isClosed && c.assignee === name;
    })) return true;
    if ((projectCases || []).some(function (c) {
      return !c.isClosed && projectReferencesAssignee(c, name);
    })) return true;
    return false;
  }

  function buildPerformanceSnapshot(record, assignees) {
    var names = (window.CaseAssigneeUtils
      ? CaseAssigneeUtils.getFormalAssignees(record)
      : [(record && record.assignee) || ''].filter(Boolean));
    var memberIds = [];
    (assignees || []).forEach(function (a) {
      if (names.indexOf(a.name) === -1) return;
      getMemberIds(a).forEach(function (id) {
        if (memberIds.indexOf(id) === -1) memberIds.push(id);
      });
    });
    return {
      isPerformanceIncluded: true,
      performanceAssignees: names.slice(),
      performanceAssignee: names[0] || '',
      performanceMemberIds: memberIds
    };
  }

  function getPerformanceAssignee(record) {
    if (!record) return '';
    if (record.performanceAssignee) return record.performanceAssignee;
    return record.assignee || '';
  }

  function findDuplicateName(assignees, name, excludeId) {
    var trimmed = name.trim();
    return assignees.some(function (a) {
      return a.name === trimmed && a.id !== excludeId;
    });
  }

  // 一個行政區只能歸屬一組。excludeId 是「正在編輯的這一組」，它自己已選的行政區
  // 不算被佔用，否則編輯時會把自己的轄區鎖死。
  function getOccupiedDistricts(assignees, excludeId) {
    var occupied = [];
    var seen = {};
    (assignees || []).forEach(function (a) {
      if (excludeId && a.id === excludeId) return;
      (a.districts || []).forEach(function (d) {
        if (!d || seen[d]) return;
        seen[d] = true;
        occupied.push(d);
      });
    });
    return occupied;
  }

  function findConflictingDistricts(assignees, districts, excludeId) {
    var occupiedSet = {};
    getOccupiedDistricts(assignees, excludeId).forEach(function (d) {
      occupiedSet[d] = true;
    });
    var conflicts = [];
    var seen = {};
    (districts || []).forEach(function (d) {
      if (!d || seen[d] || !occupiedSet[d]) return;
      seen[d] = true;
      conflicts.push(d);
    });
    return conflicts;
  }

  function applyMemberIds(assignees, assigneeId, memberIds) {
    return assignees.map(function (a) {
      if (a.id !== assigneeId) return a;
      return Object.assign({}, a, { memberIds: memberIds.slice() });
    });
  }

  function removeMemberFromAll(assignees, accountId) {
    return assignees.map(function (a) {
      var changed = false;
      var next = a;
      if (a.memberIds && a.memberIds.indexOf(accountId) !== -1) {
        next = Object.assign({}, next, {
          memberIds: a.memberIds.filter(function (id) { return id !== accountId; })
        });
        changed = true;
      }
      if (a.leaderId === accountId) {
        next = changed ? next : Object.assign({}, a);
        next.leaderId = '';
        changed = true;
      }
      return changed ? next : a;
    });
  }

  function updateAssigneeReferences(oldName, newName, cases, maintenanceCases, projectCases) {
    var nextCases = cases.map(function (c) {
      var changed = false;
      var next = Object.assign({}, c);
      if (window.CaseAssigneeUtils) {
        var assignees = CaseAssigneeUtils.getAssignees(c).map(function (n) {
          if (n !== oldName) return n;
          changed = true;
          return newName;
        });
        var performanceAssignees = (Array.isArray(c.performanceAssignees)
          ? c.performanceAssignees
          : (c.performanceAssignee ? [c.performanceAssignee] : [])).map(function (n) {
          if (n !== oldName) return n;
          changed = true;
          return newName;
        });
        if (c.assignee === oldName) { next.assignee = newName; changed = true; }
        if (changed) {
          next.assignees = assignees;
          next.performanceAssignees = performanceAssignees;
          if (next.performanceAssignee === oldName) next.performanceAssignee = newName;
        }
      } else if (c.assignee === oldName) {
        next.assignee = newName;
        changed = true;
      }
      return changed ? next : c;
    });
    var nextMaintenance = maintenanceCases.map(function (c) {
      if (c.assignee !== oldName) return c;
      return Object.assign({}, c, { assignee: newName });
    });
    var nextProjects = projectCases.map(function (c) {
      var changed = false;
      var next = Object.assign({}, c);
      if (c.assignee === oldName) { next.assignee = newName; changed = true; }
      if (c.stageAssignee === oldName) { next.stageAssignee = newName; changed = true; }
      if (c.details && c.details.contactPerson === oldName) {
        next.details = Object.assign({}, c.details, { contactPerson: newName });
        changed = true;
      }
      return changed ? next : c;
    });
    return {
      cases: nextCases,
      maintenanceCases: nextMaintenance,
      projectCases: nextProjects
    };
  }

  window.AssigneeUtils = {
    syncAssigneeOptions: syncAssigneeOptions,
    getAssigneeNames: getAssigneeNames,
    getMemberIds: getMemberIds,
    formatMembers: formatMembers,
    formatLeader: formatLeader,
    hasOpenCasesForAssignee: hasOpenCasesForAssignee,
    buildPerformanceSnapshot: buildPerformanceSnapshot,
    getPerformanceAssignee: getPerformanceAssignee,
    findDuplicateName: findDuplicateName,
    getOccupiedDistricts: getOccupiedDistricts,
    findConflictingDistricts: findConflictingDistricts,
    applyMemberIds: applyMemberIds,
    removeMemberFromAll: removeMemberFromAll,
    updateAssigneeReferences: updateAssigneeReferences
  };
})();
