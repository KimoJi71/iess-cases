/*
 * features/repair/case-status.js — 案件處理狀態邏輯
 *
 * 時間欄位規則：
 * - 到店時間：由維修人員自行填寫，系統不自動押上也不清空
 * - 完成時間：只要變更「處理狀態」（任一狀態）即押上當下時間，再次變更則覆蓋為最新一次；
 *   仍可由維修人員手動修改，未儲存就離開表單則不生效。
 * 押上完成時間後，列表即出現「案件結案」按鈕。
 *
 * 待報價／轉汰換／轉原廠結案後仍留在案件處理列表，改由「後續處理」選單收尾，
 * 詳見 LIST_RETAINED_STATUSES 與 FOLLOW_UP_ACTIONS。
 */
(function (global) {
  'use strict';

  var EXTENSION_STATUSES = ['待料件', '尚未處理完成'];

  /*
   * 結案後仍保留於「案件處理」列表的處理狀態：案子雖已送進銷案審核，實際還在等外部
   * 回覆（報價、汰換、原廠），要等後續處理有結果才真正離開列表。
   *
   * 每個狀態的後續處理動作分兩類：
   * - finish：外部流程結束，isListClosed 轉 false 自處理列表移除（銷案審核那筆不動）
   * - extend：案件還要繼續做，比照「待料件」複製一筆延伸案件回列表重新派工
   */
  var LIST_RETAINED_STATUSES = ['待報價', '轉汰換', '轉原廠'];

  var FOLLOW_UP_ACTIONS = {
    '待報價': [
      { key: 'quoteAccept', label: '接受報價', kind: 'extend' },
      { key: 'quoteReject', label: '拒絕報價', kind: 'finish' }
    ],
    '轉汰換': [
      { key: 'toRepair', label: '轉維修', kind: 'extend' },
      { key: 'replaceDone', label: '汰換完成', kind: 'finish' }
    ],
    '轉原廠': [
      { key: 'vendorDone', label: '轉原廠完成', kind: 'finish' }
    ]
  };

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

  // 延伸狀態：結案時要複製出一筆延伸案件，承接尚未完成的服務項目。
  function isExtensionStatus(status) {
    return EXTENSION_STATUSES.indexOf(status) !== -1;
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

  function isListRetainedStatus(status) {
    return LIST_RETAINED_STATUSES.indexOf(status) !== -1;
  }

  // 只有「已結案且仍滯留列表」的案件才有後續處理可選；離開列表後不再重複觸發。
  function getFollowUpActions(c) {
    if (!c || !c.isClosed || !c.isListClosed) return [];
    return FOLLOW_UP_ACTIONS[c.processStatus] || [];
  }

  function showsFollowUpButton(c) {
    return getFollowUpActions(c).length > 0;
  }

  function getFollowUpAction(c, actionKey) {
    return getFollowUpActions(c).filter(function (a) { return a.key === actionKey; })[0] || null;
  }

  /*
   * 套用一個後續處理動作，回傳 { cases, action, message }；案件不存在或動作與處理狀態
   * 不相符時回 null（呼叫端不應更動任何資料）。
   */
  function applyFollowUpAction(cases, caseId, actionKey) {
    var list = cases || [];
    var target = list.filter(function (c) { return c && c.id === caseId; })[0];
    if (!target) return null;
    var action = getFollowUpAction(target, actionKey);
    if (!action) return null;

    function leaveList(patch) {
      return list.map(function (c) {
        return c.id === caseId ? Object.assign({}, c, { isListClosed: false }, patch || {}) : c;
      });
    }

    if (action.kind === 'finish') {
      return {
        cases: leaveList(),
        action: action,
        message: '案件已標記「' + action.label + '」，已自案件處理列表移除'
      };
    }

    // extend：退回重開後再次點選時，沿用既有的延伸案件而不重複建立。
    var existing = global.CaseExtensionUtils.findExistingExtensionCase(target, list);
    if (existing) {
      return {
        cases: leaveList(),
        action: action,
        message: '已標記「' + action.label + '」，延伸案件 ' + existing.caseNumber +
          ' 已存在，不再重複建立'
      };
    }

    var extensionCase = global.CaseExtensionUtils.buildExtensionCase(target, list);
    return {
      // 原案件與延伸案件在同一次寫入，避免兩次重繪讓序號重算。
      cases: leaveList({ extensionCaseId: extensionCase.id }).concat([extensionCase]),
      action: action,
      message: '已標記「' + action.label + '」，已建立延伸案件 ' + extensionCase.caseNumber +
        ' 於案件處理列表'
    };
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
    isExtensionStatus: isExtensionStatus,
    canCloseCase: canCloseCase,
    getCaseCloseDisabledReason: getCaseCloseDisabledReason,
    isListRetainedStatus: isListRetainedStatus,
    getFollowUpActions: getFollowUpActions,
    getFollowUpAction: getFollowUpAction,
    showsFollowUpButton: showsFollowUpButton,
    applyFollowUpAction: applyFollowUpAction,
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
