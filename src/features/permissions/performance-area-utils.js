/*
 * features/permissions/performance-area-utils.js — 績效區域工具函式
 */
(function () {
  'use strict';

  function findDuplicateName(performanceAreas, name, excludeId) {
    var trimmed = String(name || '').trim();
    if (!trimmed) return null;
    for (var i = 0; i < (performanceAreas || []).length; i++) {
      var area = performanceAreas[i];
      if (excludeId && area.id === excludeId) continue;
      if (String(area.name || '').trim() === trimmed) return area;
    }
    return null;
  }

  function getOccupiedDistricts(performanceAreas, excludeId) {
    var occupied = [];
    var seen = {};
    (performanceAreas || []).forEach(function (area) {
      if (excludeId && area.id === excludeId) return;
      (area.districts || []).forEach(function (d) {
        if (!d || seen[d]) return;
        seen[d] = true;
        occupied.push(d);
      });
    });
    return occupied;
  }

  function findConflictingDistricts(performanceAreas, districts, excludeId) {
    var occupied = getOccupiedDistricts(performanceAreas, excludeId);
    var occupiedSet = {};
    occupied.forEach(function (d) { occupiedSet[d] = true; });
    var conflicts = [];
    var seen = {};
    (districts || []).forEach(function (d) {
      if (!d || seen[d] || !occupiedSet[d]) return;
      seen[d] = true;
      conflicts.push(d);
    });
    return conflicts;
  }

  window.PerformanceAreaUtils = {
    findDuplicateName: findDuplicateName,
    getOccupiedDistricts: getOccupiedDistricts,
    findConflictingDistricts: findConflictingDistricts
  };
})();
