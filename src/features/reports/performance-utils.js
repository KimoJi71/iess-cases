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

  function isDateInRange(dateStr, start, end) {
    return !!dateStr && dateStr >= start && dateStr <= end;
  }

  function computePerformanceStats(cases, assignees, targets, quarterRange) {
    var counts = {};
    assignees.forEach(function (a) { counts[a] = 0; });

    cases.forEach(function (c) {
      if (!c.isPerformanceIncluded) return;
      var date = c.completionDate || c.repairDate;
      if (!isDateInRange(date, quarterRange.start, quarterRange.end)) return;
      var assigneeKey = AssigneeUtils.getPerformanceAssignee(c);
      if (counts[assigneeKey] !== undefined) counts[assigneeKey]++;
    });

    return assignees.map(function (a) {
      var completed = counts[a] || 0;
      var target = targets[a] || 0;
      var rate = target > 0 ? Math.round((completed / target) * 100) : 0;
      return { assignee: a, completed: completed, target: target, rate: rate };
    });
  }

  window.PerformanceUtils = {
    getQuarterRange: getQuarterRange,
    computePerformanceStats: computePerformanceStats
  };
})();
