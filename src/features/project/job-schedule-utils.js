/*
 * features/project/job-schedule-utils.js — 工作安排：關鍵字比對與排序
 */
(function () {
  'use strict';

  function matchesKeyword(record, keyword) {
    var kw = String(keyword || '').trim().toLowerCase();
    if (!kw) return true;
    var row = record || {};
    return [row.name, row.description, row.remarks, row.assigneeName].some(function (v) {
      return v && String(v).toLowerCase().includes(kw);
    });
  }

  function sortRecords(records) {
    return (records || []).slice().sort(function (a, b) {
      var da = (a && a.estimatedDate) || '';
      var db = (b && b.estimatedDate) || '';
      if (da && !db) return -1;
      if (!da && db) return 1;
      if (da !== db) return String(db).localeCompare(String(da));
      var ta = (a && a.estimatedTime) || '';
      var tb = (b && b.estimatedTime) || '';
      if (ta && !tb) return -1;
      if (!ta && tb) return 1;
      if (ta !== tb) return String(tb).localeCompare(String(ta));
      return String((b && b.createdDate) || '').localeCompare(String((a && a.createdDate) || ''));
    });
  }

  window.JobScheduleUtils = {
    matchesKeyword: matchesKeyword,
    sortRecords: sortRecords
  };
})();
