/*
 * features/repair/case-status.js — 案件處理狀態邏輯
 *
 * 時間欄位保留規則（savedProcessStatus = 進入編輯當下已儲存的狀態）：
 * - 維修時間 / 再次維修時間：僅在 saved 為待料件／待報價／尚未處理完成 時保留
 * - 完成時間：僅在 saved 為案件完成 時保留
 * 同一次編輯中未儲存的切換，會清空尚未儲存對應狀態所押的時間。
 */
(function (global) {
  'use strict';

  var RE_REPAIR_STATUSES = ['待料件', '待報價', '尚未處理完成'];
  var CLOSE_BUTTON_STATUSES = ['待汰換', '轉原廠', '案件完成'];
  var TRANSFER_STATUSES = ['待汰換', '轉原廠'];

  var UNASSIGNED_ASSIGNEES = ['', '案件待辦', '尚未指派'];

  function hasValidAssignee(c) {
    if (window.CaseAssigneeUtils) return CaseAssigneeUtils.hasFormalAssignee(c);
    var assignee = c && c.assignee;
    return !!assignee && UNASSIGNED_ASSIGNEES.indexOf(assignee) === -1;
  }

  function hasExpectedDate(c) {
    return !!((c && c.expectedDate) || (c && c.planDate));
  }

  function hasExpectedTime(c) {
    return !!((c && c.expectedTimeStart) || (c && c.planTimeStart));
  }

  function getExpectedScheduleDate(c) {
    return (c && (c.expectedDate || c.planDate)) || '';
  }

  function getExpectedScheduleTimeStart(c) {
    return (c && (c.expectedTimeStart || c.planTimeStart)) || '';
  }

  function isExpectedScheduleOverdue(c) {
    var date = getExpectedScheduleDate(c);
    if (!date) return false;
    if (date < todayDate) return true;
    if (date > todayDate) return false;

    var timeStart = getExpectedScheduleTimeStart(c);
    if (!timeStart) return false;

    var parts = timeStart.split(':');
    var now = new Date();
    var scheduled = new Date(now);
    scheduled.setHours(parseInt(parts[0], 10), parseInt(parts[1] || '0', 10), 0, 0);
    return now > scheduled;
  }

  function getCaseListIndicatorClass(c) {
    if (c && c.processStatus === '案件完成') {
      return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]';
    }
    if (c && c.workCategory === '緊急叫修') {
      return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
    }
    if (isExpectedScheduleOverdue(c)) {
      return 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]';
    }
    return 'bg-gray-300';
  }

  function isDispatched(c) {
    return hasValidAssignee(c) && hasExpectedDate(c) && hasExpectedTime(c);
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
    if (status === '待汰換') return '汰換完成';
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
      formData.secondRepairDate = '';
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
    if (c.secondRepairDate) return true;
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
    isExpectedScheduleOverdue: isExpectedScheduleOverdue,
    RE_REPAIR_STATUSES: RE_REPAIR_STATUSES,
    CLOSE_BUTTON_STATUSES: CLOSE_BUTTON_STATUSES
  };
})(window);
