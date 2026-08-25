/*
 * features/repair/case-status.js — 案件處理狀態邏輯
 *
 * 時間欄位規則：
 * - 到店時間：由維修人員自行填寫，系統不自動押上也不清空
 * - 完成時間：只要變更「處理狀態」（任一狀態）即押上當下時間，再次變更則覆蓋為最新一次；
 *   仍可由維修人員手動修改，未儲存就離開表單則不生效。
 * 押上完成時間後，列表即出現「案件結案」按鈕。
 */
(function (global) {
  'use strict';

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

  function isTransferStatus(status) {
    return TRANSFER_STATUSES.indexOf(status) !== -1;
  }

  // 結案按鈕一律顯示，以停用狀態控制：選過處理狀態（不分哪一種）且尚未結案才可結案。
  function canCloseCase(c) {
    return !!(c && c.processStatus) && !c.isClosed;
  }

  // 停用時的說明，同時作為按鈕的 tooltip。
  function getCaseCloseDisabledReason(c) {
    if (c && c.isClosed) return '此案件已結案';
    if (!c || !c.processStatus) return '請先於維修結果選擇處理狀態';
    return '';
  }

  function showsInterimCompleteButton(c) {
    return !!(c.isClosed && c.isListClosed && isTransferStatus(c.processStatus));
  }

  function getInterimCompleteLabel(status) {
    if (status === '轉汰換') return '汰換完成';
    if (status === '轉原廠') return '轉原廠完成';
    return '';
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

  function applyProcessStatusChange(formData, newStatus, now) {
    if (!newStatus) {
      formData.completionDate = '';
      return;
    }
    formData.completionDate = now || global.IESS.caseDateTime.now();
  }

  global.IESS = global.IESS || {};
  global.IESS.caseStatus = {
    isTransferStatus: isTransferStatus,
    canCloseCase: canCloseCase,
    getCaseCloseDisabledReason: getCaseCloseDisabledReason,
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
    OVERTIME_WARNING_HOURS: OVERTIME_WARNING_HOURS
  };
})(window);
