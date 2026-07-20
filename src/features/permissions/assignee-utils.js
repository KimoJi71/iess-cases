/*
 * features/permissions/assignee-utils.js — 指派人員工具函式
 */
(function () {
  'use strict';

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

  function findAssigneeForMember(assignees, accountId) {
    for (var i = 0; i < assignees.length; i++) {
      var ids = assignees[i].memberIds || [];
      if (ids.indexOf(accountId) !== -1) return assignees[i].name;
    }
    return '';
  }

  function formatMembers(accounts, assignee) {
    var ids = getMemberIds(assignee);
    var names = accounts.filter(function (a) { return ids.indexOf(a.id) !== -1; })
      .map(function (a) { return a.name; });
    if (!names.length) return '—';
    return names.join('、');
  }

  function isAssigneeInUse(name, cases, maintenanceCases, projectCases) {
    if (cases.some(function (c) { return c.assignee === name; })) return true;
    if (maintenanceCases.some(function (c) { return c.assignee === name; })) return true;
    if (projectCases.some(function (c) {
      return c.assignee === name || c.stageAssignee === name;
    })) return true;
    return false;
  }

  function findDuplicateName(assignees, name, excludeId) {
    var trimmed = name.trim();
    return assignees.some(function (a) {
      return a.name === trimmed && a.id !== excludeId;
    });
  }

  function applyMemberIds(assignees, assigneeId, memberIds) {
    var idSet = {};
    memberIds.forEach(function (id) { idSet[id] = true; });
    return assignees.map(function (a) {
      if (a.id === assigneeId) {
        return Object.assign({}, a, { memberIds: memberIds.slice() });
      }
      var next = (a.memberIds || []).filter(function (id) { return !idSet[id]; });
      if (next.length !== (a.memberIds || []).length) {
        return Object.assign({}, a, { memberIds: next });
      }
      return a;
    });
  }

  function removeMemberFromAll(assignees, accountId) {
    return assignees.map(function (a) {
      if (!a.memberIds || a.memberIds.indexOf(accountId) === -1) return a;
      return Object.assign({}, a, {
        memberIds: a.memberIds.filter(function (id) { return id !== accountId; })
      });
    });
  }

  function updateAssigneeReferences(oldName, newName, cases, maintenanceCases, projectCases) {
    var nextCases = cases.map(function (c) {
      if (c.assignee !== oldName) return c;
      return Object.assign({}, c, { assignee: newName });
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
    findAssigneeForMember: findAssigneeForMember,
    formatMembers: formatMembers,
    isAssigneeInUse: isAssigneeInUse,
    findDuplicateName: findDuplicateName,
    applyMemberIds: applyMemberIds,
    removeMemberFromAll: removeMemberFromAll,
    updateAssigneeReferences: updateAssigneeReferences
  };
})();
