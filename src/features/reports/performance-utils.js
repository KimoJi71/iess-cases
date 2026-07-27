/*
 * features/reports/performance-utils.js — 案件績效統計計算
 */
(function () {
  'use strict';

  function getQuarterRange(date) {
    var d = date || new Date();
    var month = d.getMonth();
    var quarter = Math.floor(month / 3);
    var year = d.getFullYear();
    var startMonth = quarter * 3;
    var start = new Date(year, startMonth, 1);
    var end = new Date(year, startMonth + 3, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
      label: year + ' 年第 ' + (quarter + 1) + ' 季'
    };
  }

  function getQuarterMonths(quarterRange) {
    var start = new Date(quarterRange.start + 'T00:00:00');
    var m = start.getMonth() + 1;
    return [m, m + 1, m + 2];
  }

  function isDateInRange(dateStr, start, end) {
    return !!dateStr && dateStr >= start && dateStr <= end;
  }

  function toDateKey(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
  }

  function achievementRate(completed, target) {
    var t = Number(target) || 0;
    if (t <= 0) return 0;
    return Math.round(((Number(completed) || 0) / t) * 100);
  }

  function isServiceLevelCD(serviceLevel) {
    var s = String(serviceLevel || '');
    return s.indexOf('C ') === 0 || s.indexOf('D ') === 0;
  }

  function getRepairCaseDate(c) {
    return toDateKey((c && (c.completionDate || c.repairDate)) || '');
  }

  function getMaintenanceCaseDate(c) {
    if (!c) return '';
    return toDateKey(
      c.completionDate || c.closeDate || c.repairDate || c.planDate || ''
    );
  }

  function sumAllocationTargets(allocations, opts) {
    opts = opts || {};
    var months = opts.months || [];
    var monthSet = {};
    months.forEach(function (m) { monthSet[m] = true; });
    var total = 0;
    (allocations || []).forEach(function (row) {
      if (!monthSet[row.month]) return;
      if (opts.assigneeId && row.assigneeId !== opts.assigneeId) return;
      if (opts.customerName && row.customerName !== opts.customerName) return;
      total += Number(row.targetCount) || 0;
    });
    return total;
  }

  function getCaseArea(record, stores) {
    if (!record) return '';
    var store = (stores || []).find(function (s) {
      return StoreUtils.matchesStoreRecord(record, s);
    });
    if (store) return StoreUtils.getStoreArea(store);
    return StoreUtils.getRecordArea(record) || '';
  }

  function sumProcessPoints(c) {
    var total = 0;
    ((c && c.processRecords) || []).forEach(function (r) {
      var points = Number(r.points) || 0;
      var qty = Number(r.qty) > 0 ? Number(r.qty) : 1;
      total += points * qty;
    });
    return total;
  }

  function computeAssigneePerformance(input) {
    var cases = input.cases || [];
    var maintenanceCases = input.maintenanceCases || [];
    var assignees = input.assignees || [];
    var allocations = input.allocations || [];
    var quarter = input.quarter;
    var months = getQuarterMonths(quarter);

    return assignees.map(function (assignee) {
      var completed = 0;
      maintenanceCases.forEach(function (c) {
        if (!c.isPerformanceIncluded) return;
        if (!isDateInRange(getMaintenanceCaseDate(c), quarter.start, quarter.end)) return;
        if (AssigneeUtils.getPerformanceAssignee(c) !== assignee.name) return;
        completed++;
      });

      var bonusPoints = 0;
      cases.forEach(function (c) {
        if (!c.isPerformanceIncluded) return;
        if (!isServiceLevelCD(c.serviceLevel)) return;
        if (!isDateInRange(getRepairCaseDate(c), quarter.start, quarter.end)) return;
        if (AssigneeUtils.getPerformanceAssignee(c) !== assignee.name) return;
        bonusPoints += sumProcessPoints(c);
      });

      var target = sumAllocationTargets(allocations, {
        months: months,
        assigneeId: assignee.id
      });

      return {
        id: assignee.id,
        name: assignee.name,
        target: target,
        completed: completed,
        bonusPoints: bonusPoints,
        rate: achievementRate(completed, target)
      };
    });
  }

  function computeRegionPerformance(input) {
    var maintenanceCases = input.maintenanceCases || [];
    var stores = input.stores || [];
    var performanceAreas = input.performanceAreas || [];
    var allocations = input.allocations || [];
    var quarter = input.quarter;
    var months = getQuarterMonths(quarter);

    function districtSet(districts) {
      var set = {};
      (districts || []).forEach(function (d) { set[d] = true; });
      return set;
    }

    function customersInArea(areaDistricts) {
      var set = districtSet(areaDistricts);
      var names = {};
      (stores || []).forEach(function (store) {
        if (!StoreUtils.isActiveStore(store)) return;
        var area = StoreUtils.getStoreArea(store);
        if (!set[area]) return;
        if (store.customerName) names[store.customerName] = true;
      });
      return Object.keys(names).sort(function (a, b) {
        return a.localeCompare(b, 'zh-Hant');
      });
    }

    function completedForCustomerInArea(customerName, areaDistricts) {
      var set = districtSet(areaDistricts);
      var count = 0;
      maintenanceCases.forEach(function (c) {
        if (!c.isPerformanceIncluded) return;
        if (c.customerName !== customerName) return;
        if (!isDateInRange(getMaintenanceCaseDate(c), quarter.start, quarter.end)) return;
        var area = getCaseArea(c, stores);
        if (!set[area]) return;
        count++;
      });
      return count;
    }

    return (performanceAreas || []).slice().sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
    }).map(function (pa) {
      var customerNames = customersInArea(pa.districts);
      var customers = customerNames.map(function (customerName) {
        var target = sumAllocationTargets(allocations, {
          months: months,
          customerName: customerName
        });
        var completed = completedForCustomerInArea(customerName, pa.districts);
        return {
          customerName: customerName,
          target: target,
          completed: completed,
          rate: achievementRate(completed, target)
        };
      });

      var target = 0;
      var completed = 0;
      customers.forEach(function (row) {
        target += row.target;
        completed += row.completed;
      });

      return {
        id: pa.id,
        name: pa.name,
        target: target,
        completed: completed,
        rate: achievementRate(completed, target),
        customers: customers
      };
    });
  }

  window.PerformanceUtils = {
    getQuarterRange: getQuarterRange,
    getQuarterMonths: getQuarterMonths,
    achievementRate: achievementRate,
    isServiceLevelCD: isServiceLevelCD,
    toDateKey: toDateKey,
    getRepairCaseDate: getRepairCaseDate,
    getMaintenanceCaseDate: getMaintenanceCaseDate,
    sumAllocationTargets: sumAllocationTargets,
    getCaseArea: getCaseArea,
    sumProcessPoints: sumProcessPoints,
    computeAssigneePerformance: computeAssigneePerformance,
    computeRegionPerformance: computeRegionPerformance
  };
})();
