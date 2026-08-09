/*
 * features/permissions/maintenance-allocation-utils.js — 保養分配：客戶列、驗證、CRUD 輔助
 */
(function () {
  'use strict';

  function isAllocatableServiceLevel(level, serviceLevels) {
    return ServiceLevelUtils.isAllocatable(serviceLevels, level);
  }

  function formatCellLabel(allocation) {
    if (!allocation) return '';
    return '第' + allocation.visitIndex + '次 ' + allocation.targetCount;
  }

  function getCoveredStoresForAssignee(stores, assignee, customerName, serviceLevels) {
    return (stores || []).filter(function (s) {
      if (customerName && s.customerName !== customerName) return false;
      if (!StoreUtils.isActiveStore(s)) return false;
      if (!isAllocatableServiceLevel(s.serviceLevel, serviceLevels)) return false;
      var area = StoreUtils.getStoreArea(s);
      return StoreUtils.assigneeCoversArea(assignee, area);
    });
  }

  /**
   * @returns {Array<{ customerName, storeCount, serviceLevel }>}
   */
  function getCustomerRows(assignee, customers, stores, serviceLevels) {
    if (!assignee) return [];
    var byCustomer = {};
    getCoveredStoresForAssignee(stores, assignee, null, serviceLevels).forEach(function (s) {
      if (!byCustomer[s.customerName]) byCustomer[s.customerName] = 0;
      byCustomer[s.customerName] += 1;
    });
    var rows = [];
    Object.keys(byCustomer).forEach(function (name) {
      var cust = (customers || []).find(function (c) { return c.name === name; });
      rows.push({
        customerName: name,
        storeCount: byCustomer[name],
        serviceLevel: (cust && cust.serviceLevel) || ''
      });
    });
    rows.sort(function (a, b) {
      return a.customerName.localeCompare(b.customerName, 'zh-Hant');
    });
    return rows;
  }

  /**
   * 該區間月份內、該指派人員 × 該客戶、已結案保養案件的不重複門市數。
   * 日期取 completionDate，無則取 planDate；年份限定為傳入的 year。
   */
  function countCompletedStores(maintenanceCases, assignee, customerName, period, year) {
    if (!period) return 0;
    var yearPrefix = String(year);
    var start = Number(period.startMonth);
    var end = Number(period.endMonth);
    var seen = {};
    (maintenanceCases || []).forEach(function (c) {
      if (!c || !c.isClosed) return;
      if (c.customerName !== customerName) return;
      if (AssigneeUtils.getPerformanceAssignee(c) !== assignee) return;
      var dateStr = String(c.completionDate || c.planDate || '');
      if (dateStr.slice(0, 4) !== yearPrefix) return;
      var month = Number(dateStr.slice(5, 7));
      if (!(month >= start && month <= end)) return;
      if (c.storeName) seen[c.storeName] = true;
    });
    return Object.keys(seen).length;
  }

  function findAllocation(allocations, assigneeId, customerName, month) {
    return (allocations || []).find(function (a) {
      return a.assigneeId === assigneeId &&
        a.customerName === customerName &&
        Number(a.month) === Number(month);
    }) || null;
  }

  function sumVisitIndexTotal(allocations, assigneeId, customerName, visitIndex, excludeMonth) {
    var sum = 0;
    (allocations || []).forEach(function (a) {
      if (a.assigneeId !== assigneeId) return;
      if (a.customerName !== customerName) return;
      if (Number(a.visitIndex) !== Number(visitIndex)) return;
      if (excludeMonth != null && Number(a.month) === Number(excludeMonth)) return;
      sum += Number(a.targetCount) || 0;
    });
    return sum;
  }

  /**
   * @returns {string[]} 警示／提示文案（可為空）
   */
  function buildSaveWarnings(params) {
    var storeCount = Number(params.storeCount) || 0;
    var targetCount = Number(params.targetCount) || 0;
    var visitIndex = Number(params.visitIndex);
    var month = Number(params.month);
    var warnings = [];

    if (targetCount > storeCount) {
      warnings.push('本月數量超過負責門市數（' + targetCount + '／' + storeCount + '）');
    }

    var otherSum = sumVisitIndexTotal(
      params.allocations, params.assigneeId, params.customerName, visitIndex, month
    );
    var total = otherSum + targetCount;
    if (total !== storeCount) {
      var kind = total < storeCount ? '不足' : '超量';
      warnings.push(
        '第' + visitIndex + '次合計與負責門市數不符（目前 ' + total + '／應為 ' + storeCount + '，' + kind + '）'
      );
    }
    return warnings;
  }

  function upsertAllocation(allocations, record) {
    var list = (allocations || []).slice();
    var idx = list.findIndex(function (a) {
      return a.assigneeId === record.assigneeId &&
        a.customerName === record.customerName &&
        Number(a.month) === Number(record.month);
    });
    if (idx >= 0) {
      list[idx] = Object.assign({}, list[idx], {
        visitIndex: Number(record.visitIndex),
        targetCount: Number(record.targetCount)
      });
    } else {
      list.push({
        id: record.id || ('MA' + Date.now()),
        assigneeId: record.assigneeId,
        customerName: record.customerName,
        month: Number(record.month),
        visitIndex: Number(record.visitIndex),
        targetCount: Number(record.targetCount)
      });
    }
    return list;
  }

  function removeAllocation(allocations, assigneeId, customerName, month) {
    return (allocations || []).filter(function (a) {
      return !(a.assigneeId === assigneeId &&
        a.customerName === customerName &&
        Number(a.month) === Number(month));
    });
  }

  window.MaintenanceAllocationUtils = {
    isAllocatableServiceLevel: isAllocatableServiceLevel,
    formatCellLabel: formatCellLabel,
    getCoveredStoresForAssignee: getCoveredStoresForAssignee,
    getCustomerRows: getCustomerRows,
    countCompletedStores: countCompletedStores,
    findAllocation: findAllocation,
    sumVisitIndexTotal: sumVisitIndexTotal,
    buildSaveWarnings: buildSaveWarnings,
    upsertAllocation: upsertAllocation,
    removeAllocation: removeAllocation
  };
})();
