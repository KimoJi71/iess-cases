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

  // 指派人員選單：依組別分群的成員帳號。組別主檔或帳號主檔異動時都要重跑。
  // 停用帳號不列入（與 syncProjectPersonOptions 一致），但已存檔的舊資料仍會保留 id。
  function syncAssigneeMemberGroups(assignees, accounts) {
    var accountById = {};
    (accounts || []).forEach(function (a) { accountById[a.id] = a; });
    var groups = (assignees || []).slice().sort(function (a, b) {
      return a.name.localeCompare(b.name, 'zh-Hant');
    }).map(function (assignee) {
      var options = getMemberIds(assignee).map(function (id) {
        return accountById[id];
      }).filter(function (account) {
        return account && account.enabled;
      }).sort(function (a, b) {
        return a.name.localeCompare(b.name, 'zh-Hant');
      }).map(function (account) {
        return { value: account.id, label: account.name };
      });
      return { group: assignee.name, options: options };
    });
    ASSIGNEE_MEMBER_GROUPS.length = 0;
    groups.forEach(function (g) { ASSIGNEE_MEMBER_GROUPS.push(g); });
    Object.keys(ASSIGNEE_MEMBER_LABELS).forEach(function (k) {
      delete ASSIGNEE_MEMBER_LABELS[k];
    });
    (accounts || []).forEach(function (a) { ASSIGNEE_MEMBER_LABELS[a.id] = a.name; });
    Object.keys(ASSIGNEE_GROUP_HINTS).forEach(function (k) {
      delete ASSIGNEE_GROUP_HINTS[k];
    });
    (assignees || []).forEach(function (assignee) {
      if (!assignee || !assignee.name) return;
      ASSIGNEE_GROUP_HINTS[assignee.name] = formatMemberHint(assignee, accountById);
    });
  }

  function formatMemberHint(assignee, accountById) {
    return getMemberIds(assignee).map(function (id) {
      return accountById[id];
    }).filter(Boolean).sort(function (a, b) {
      return a.name.localeCompare(b.name, 'zh-Hant');
    }).map(function (account) {
      return account.name;
    }).join('、');
  }

  function getGroupHint(name) {
    return (name && ASSIGNEE_GROUP_HINTS[name]) || '';
  }

  // 組別下拉：value／chip 仍是組別名稱；hint 是成員名單，給選單當次要說明。
  function getSelectOptions(names) {
    return (names || ASSIGNEES).map(function (name) {
      return {
        value: name,
        label: name,
        hint: getGroupHint(name),
        chipLabel: name
      };
    });
  }

  // 只留下屬於 groupNames 這些組別的成員；組別被取消選取時，其成員要一併移除。
  function filterMemberIdsByGroups(memberIds, groupNames) {
    var allowed = {};
    ASSIGNEE_MEMBER_GROUPS.forEach(function (g) {
      if ((groupNames || []).indexOf(g.group) === -1) return;
      g.options.forEach(function (o) { allowed[o.value] = true; });
    });
    return (memberIds || []).filter(function (id) { return allowed[id]; });
  }

  function getMemberGroupsForGroupNames(groupNames) {
    return ASSIGNEE_MEMBER_GROUPS.filter(function (g) {
      return (groupNames || []).indexOf(g.group) !== -1;
    });
  }

  // 對照不到（帳號已刪除）時回傳原 id，避免顯示成空白而看不出資料還在。
  function formatMemberIds(memberIds) {
    return (memberIds || []).map(function (id) {
      return ASSIGNEE_MEMBER_LABELS[id] != null ? ASSIGNEE_MEMBER_LABELS[id] : String(id);
    });
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
      || (c.details && (c.details.contactPerson === name
        || c.details.suggestedContractor === name));
  }

  function hasOpenCasesForAssignee(name, cases, maintenanceCases, projectCases) {
    if ((cases || []).some(function (c) {
      if (!isRepairCaseOpen(c)) return false;
      if (window.CaseAssigneeUtils) return CaseAssigneeUtils.includesAssignee(c, name);
      return c.assignee === name;
    })) return true;
    if ((maintenanceCases || []).some(function (c) {
      if (c.isClosed) return false;
      if (window.CaseAssigneeUtils) return CaseAssigneeUtils.includesAssignee(c, name);
      return c.assignee === name;
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
    return getPerformanceAssigneeNames(record)[0] || '';
  }

  // 保養單的組別改為多選後，績效歸屬也可能對應多組。
  function getPerformanceAssigneeNames(record) {
    if (!record) return [];
    if (Array.isArray(record.performanceAssignees) && record.performanceAssignees.length) {
      return record.performanceAssignees.slice();
    }
    if (record.performanceAssignee) return [record.performanceAssignee];
    if (window.CaseAssigneeUtils) return CaseAssigneeUtils.getFormalAssignees(record);
    return record.assignee ? [record.assignee] : [];
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
      if (!window.CaseAssigneeUtils) {
        if (c.assignee !== oldName) return c;
        return Object.assign({}, c, { assignee: newName });
      }
      var names = CaseAssigneeUtils.getAssignees(c);
      if (names.indexOf(oldName) === -1) return c;
      var next = Object.assign({}, c, {
        assignees: names.map(function (n) { return n === oldName ? newName : n; })
      });
      delete next.assignee;
      return next;
    });
    var nextProjects = projectCases.map(function (c) {
      var changed = false;
      var next = Object.assign({}, c);
      if (c.assignee === oldName) { next.assignee = newName; changed = true; }
      if (c.stageAssignee === oldName) { next.stageAssignee = newName; changed = true; }
      if (c.details && c.details.contactPerson === oldName) {
        next.details = Object.assign({}, next.details || c.details, { contactPerson: newName });
        changed = true;
      }
      if (c.details && c.details.suggestedContractor === oldName) {
        next.details = Object.assign({}, next.details || c.details, { suggestedContractor: newName });
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
    syncAssigneeMemberGroups: syncAssigneeMemberGroups,
    getGroupHint: getGroupHint,
    getSelectOptions: getSelectOptions,
    filterMemberIdsByGroups: filterMemberIdsByGroups,
    getMemberGroupsForGroupNames: getMemberGroupsForGroupNames,
    formatMemberIds: formatMemberIds,
    getAssigneeNames: getAssigneeNames,
    getMemberIds: getMemberIds,
    formatMembers: formatMembers,
    formatLeader: formatLeader,
    hasOpenCasesForAssignee: hasOpenCasesForAssignee,
    buildPerformanceSnapshot: buildPerformanceSnapshot,
    getPerformanceAssignee: getPerformanceAssignee,
    getPerformanceAssigneeNames: getPerformanceAssigneeNames,
    findDuplicateName: findDuplicateName,
    getOccupiedDistricts: getOccupiedDistricts,
    findConflictingDistricts: findConflictingDistricts,
    applyMemberIds: applyMemberIds,
    removeMemberFromAll: removeMemberFromAll,
    updateAssigneeReferences: updateAssigneeReferences
  };
})();
