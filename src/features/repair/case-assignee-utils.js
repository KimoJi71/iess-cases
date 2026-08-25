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
      // 設備與服務項目改以卡片陣列承載；舊案件的三個單一欄位在此摺疊後移除
      serviceItems: RepairCaseServiceItems.normalizeServiceItems(record),
      processStatus: Object.prototype.hasOwnProperty.call(record, 'processStatus')
        ? normalizeProcessStatus(record.processStatus)
        : record.processStatus
    });
    delete next.assignee;
    delete next.collaborators;
    delete next.equipment;
    delete next.actualReason;
    delete next.processRecords;
    return next;
  }

  // 保養計劃的組別原本是單選字串（含 '尚未指派' 這個佔位值），改多選後一律以 assignees[] 為準。
  // '尚未指派' 不是真的組別，正規化時濾掉：空陣列就代表未指派。
  function normalizeMaintenanceCase(record) {
    if (!record) return record;
    var next = Object.assign({}, record, {
      assignees: getFormalAssignees(record),
      assigneeMemberIds: getAssigneeMemberIds(record),
      partnerVendorIds: asStringArray(record.partnerVendorIds),
      equipmentList: Array.isArray(record.equipmentList) ? record.equipmentList.slice() : [],
      remark: record.remark || '',
      customerSignature: record.customerSignature || ''
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

  // options.js 的權重表是 const 宣告，不會掛在 window 上，只能用裸識別字讀；
  // typeof 守衛是給沒載入 options.js 的驗證腳本用的。
  function getRolePointWeight(role) {
    var table = typeof ACCOUNT_ROLE_POINT_WEIGHTS !== 'undefined'
      ? ACCOUNT_ROLE_POINT_WEIGHTS : {};
    var fallback = typeof DEFAULT_ACCOUNT_ROLE_POINT_WEIGHT !== 'undefined'
      ? DEFAULT_ACCOUNT_ROLE_POINT_WEIGHT : 1;
    var w = table[role];
    return Number(w) >= 0 ? Number(w) : (Number(fallback) >= 0 ? Number(fallback) : 1);
  }

  /**
   * 一個組別在這筆案件裡的職務權重。
   * 取該案「指派人員」中屬於這組的成員；該組一個都沒被指派到（或整案都沒選人員）時，
   * 退回用該組主檔的全體成員計算——組別既然被選上就該分到積分，
   * 不能因為沒細選人員而變 0。
   */
  function groupRoleWeight(record, groupName, ctx) {
    var accountById = ctx.accountById;
    var group = (ctx.assignees || []).find(function (a) { return a.name === groupName; });
    var groupMemberIds = (group && Array.isArray(group.memberIds)) ? group.memberIds : [];
    var picked = getAssigneeMemberIds(record).filter(function (id) {
      return groupMemberIds.indexOf(id) !== -1;
    });
    var ids = picked.length ? picked : groupMemberIds;
    var total = 0;
    ids.forEach(function (id) {
      var account = accountById[id];
      if (!account) return;
      total += getRolePointWeight(account.role);
    });
    return total;
  }

  /**
   * 這筆案件的總積分該分給某個組別多少。
   * 積分歸組別所有，但比例由「指派人員」的職務決定（課長 5／副課長 4／課員 2／實習生 1）。
   * ctx: { accounts, assignees }；未給 ctx、或所有組別權重都算不出來（帳號查無、
   * 組別沒有成員）時退回各組平分，維持舊行為，避免積分整筆消失。
   */
  function computeBonusPointsForAssignee(record, assigneeName, ctx) {
    if (!record || !assigneeName) return 0;
    var formal = getPerformanceAssignees(record);
    if (formal.indexOf(assigneeName) === -1) return 0;
    var n = formal.length;
    if (n <= 0) return 0;
    var total = sumProcessPoints(record);

    if (!ctx || !ctx.accounts || !ctx.assignees) return total / n;

    var accountById = {};
    ctx.accounts.forEach(function (a) { accountById[a.id] = a; });
    var lookup = { accountById: accountById, assignees: ctx.assignees };

    var weights = formal.map(function (name) {
      return groupRoleWeight(record, name, lookup);
    });
    var weightSum = weights.reduce(function (acc, w) { return acc + w; }, 0);
    if (weightSum <= 0) return total / n;

    return total * (weights[formal.indexOf(assigneeName)] / weightSum);
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
    getRolePointWeight: getRolePointWeight,
    computeBonusPointsForAssignee: computeBonusPointsForAssignee
  };
})();
