/*
 * features/repair/case-status.js — 案件處理狀態邏輯
 *
 * 時間欄位保留規則（savedProcessStatus = 進入編輯當下已儲存的狀態）：
 * - 維修時間：僅在 saved 為待料件／待報價／尚未處理完成 時保留
 * - 完成時間：僅在 saved 為案件完成 時保留
 * 同一次編輯中未儲存的切換，會清空尚未儲存對應狀態所押的時間。
 */
(function (global) {
  'use strict';

  var RE_REPAIR_STATUSES = ['待料件', '待報價', '尚未處理完成'];
  var CLOSE_BUTTON_STATUSES = ['轉汰換', '轉原廠', '案件完成'];
  var TRANSFER_STATUSES = ['轉汰換', '轉原廠'];

  var UNASSIGNED_ASSIGNEES = ['', '案件待辦', '尚未指派'];

  function hasValidAssignee(c) {
    if (window.CaseAssigneeUtils) return CaseAssigneeUtils.hasFormalAssignee(c);
    var assignee = c && c.assignee;
    return !!assignee && UNASSIGNED_ASSIGNEES.indexOf(assignee) === -1;
  }

  function hasExpectedDate(c) {
    return !!((c && c.expectedDate) || (c && c.planDate));
  }

  function hasPartnerVendor(c) {
    if (window.CaseAssigneeUtils && CaseAssigneeUtils.hasPartnerVendor) {
      return CaseAssigneeUtils.hasPartnerVendor(c);
    }
    var ids = c && c.partnerVendorIds;
    if (Array.isArray(ids)) {
      return ids.some(function (id) { return !!id; });
    }
    return !!ids;
  }

  var OVERTIME_WARNING_HOURS = 6;
  var MS_PER_HOUR = 3600000;

  /**
   * 案件的逾時期限＝建立時間＋客戶設定的「逾時時間(時)」。
   * 客戶未設定（或非正數）、案件無建立時間時回 null，代表不做逾時管控。
   */
  function getOvertimeDeadline(c, customers) {
    if (!c) return null;
    var hours = global.CustomerUtils
      ? global.CustomerUtils.getOvertimeHours(customers, c.customerName)
      : 0;
    if (!hours) return null;
    var start = global.IESS.caseDateTime.parse(c.createdAt || c.repairDate);
    if (!start) return null;
    return new Date(start.getTime() + hours * MS_PER_HOUR);
  }

  /**
   * 逾時燈號狀態：
   * - 'overdue'：已過期限
   * - 'warning'：距期限 6 小時內
   * - 'none'：尚未接近期限，或未設定逾時管控
   */
  function getOvertimeState(c, customers, now) {
    var deadline = getOvertimeDeadline(c, customers);
    if (!deadline) return 'none';
    var current = now || new Date();
    var remainMs = deadline.getTime() - current.getTime();
    if (remainMs <= 0) return 'overdue';
    if (remainMs <= OVERTIME_WARNING_HOURS * MS_PER_HOUR) return 'warning';
    return 'none';
  }

  var INDICATOR_RANK = { overdue: 0, warning: 1, none: 2, complete: 3 };

  function getCaseListIndicatorKey(c, customers, now) {
    if (c && c.processStatus === '案件完成') return 'complete';
    return getOvertimeState(c, customers, now);
  }

  function getCaseListIndicatorRank(c, customers, now) {
    var key = getCaseListIndicatorKey(c, customers, now);
    return INDICATOR_RANK.hasOwnProperty(key) ? INDICATOR_RANK[key] : 2;
  }

  function getCaseListIndicatorClass(c, customers) {
    var key = getCaseListIndicatorKey(c, customers);
    if (key === 'complete') {
      return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]';
    }
    if (key === 'overdue') {
      return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
    }
    if (key === 'warning') {
      return 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]';
    }
    return 'bg-gray-300';
  }

  // 已派工＝有組別或協力廠商，且有預計日期（只填日期沒填時間＝整天，同樣算已派工）。
  function isDispatched(c) {
    return (hasValidAssignee(c) || hasPartnerVendor(c)) && hasExpectedDate(c);
  }

  function getCaseListDispatchStatus(c) {
    if (c && c.processStatus === '案件完成') return '已完成';
    if (isDispatched(c)) return '已派工';
    return '未派工';
  }

  function getCaseListDispatchBadgeClass(status) {
    if (status === '已完成') return 'bg-green-100 text-green-700 border-green-200';
    if (status === '已派工') return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  }

  function isReRepairPendingStatus(status) {
    return RE_REPAIR_STATUSES.indexOf(status) !== -1;
  }

  function isTransferStatus(status) {
    return TRANSFER_STATUSES.indexOf(status) !== -1;
  }

  function showsCaseCloseButton(c) {
    return CLOSE_BUTTON_STATUSES.indexOf(c.processStatus) !== -1 && !c.isClosed;
  }

  function showsInterimCompleteButton(c) {
    return !!(c.isClosed && c.isListClosed && isTransferStatus(c.processStatus));
  }

  function getInterimCompleteLabel(status) {
    if (status === '轉汰換') return '汰換完成';
    if (status === '轉原廠') return '轉原廠完成';
    return '';
  }

  function clearCompletionIfNotSaved(formData, savedProcessStatus) {
    if (savedProcessStatus !== '案件完成') {
      formData.completionDate = '';
    }
  }

  function clearReRepairIfNotSaved(formData, savedProcessStatus) {
    if (!isReRepairPendingStatus(savedProcessStatus)) {
      formData.reRepairDate = '';
    }
  }

  function clearScheduleFields(formData) {
    formData.expectedDate = '';
    formData.expectedTimeStart = '';
    formData.expectedTimeEnd = '';
    formData.planDate = '';
    formData.planTimeStart = '';
    formData.planTimeEnd = '';
  }

  function hasProcessData(c) {
    if (!c) return false;
    if (c.actualReason && String(c.actualReason).trim()) return true;
    if (c.processRecords && c.processRecords.length > 0) return true;
    if (c.processStatus) return true;
    if (c.reRepairDate) return true;
    if (c.completionDate) return true;
    return false;
  }

  function applyProcessStatusChange(formData, newStatus, savedProcessStatus, now) {
    var stamp = now || global.IESS.caseDateTime.now();

    if (isReRepairPendingStatus(newStatus)) {
      formData.reRepairDate = stamp;
      clearScheduleFields(formData);
      clearCompletionIfNotSaved(formData, savedProcessStatus);
      return;
    }

    if (isTransferStatus(newStatus)) {
      clearReRepairIfNotSaved(formData, savedProcessStatus);
      clearCompletionIfNotSaved(formData, savedProcessStatus);
      return;
    }

    if (newStatus === '案件完成') {
      formData.completionDate = stamp;
      clearReRepairIfNotSaved(formData, savedProcessStatus);
      return;
    }

    clearReRepairIfNotSaved(formData, savedProcessStatus);
    clearCompletionIfNotSaved(formData, savedProcessStatus);
  }

  global.IESS = global.IESS || {};
  global.IESS.caseStatus = {
    isReRepairPendingStatus: isReRepairPendingStatus,
    isTransferStatus: isTransferStatus,
    showsCaseCloseButton: showsCaseCloseButton,
    showsInterimCompleteButton: showsInterimCompleteButton,
    getInterimCompleteLabel: getInterimCompleteLabel,
    applyProcessStatusChange: applyProcessStatusChange,
    hasProcessData: hasProcessData,
    getCaseListDispatchStatus: getCaseListDispatchStatus,
    getCaseListDispatchBadgeClass: getCaseListDispatchBadgeClass,
    getCaseListIndicatorClass: getCaseListIndicatorClass,
    getCaseListIndicatorRank: getCaseListIndicatorRank,
    getOvertimeDeadline: getOvertimeDeadline,
    getOvertimeState: getOvertimeState,
    OVERTIME_WARNING_HOURS: OVERTIME_WARNING_HOURS,
    RE_REPAIR_STATUSES: RE_REPAIR_STATUSES,
    CLOSE_BUTTON_STATUSES: CLOSE_BUTTON_STATUSES
  };
})(window);
