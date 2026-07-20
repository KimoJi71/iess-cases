/*
 * features/permissions/district-utils.js — 行政區域工具函式
 */
(function () {
  'use strict';

  function syncDistrictOptions(districts) {
    var names = districts.slice().sort(function (a, b) {
      return a.name.localeCompare(b.name, 'zh-Hant');
    }).map(function (d) { return d.name; });
    DISTRICT_OPTIONS.length = 0;
    names.forEach(function (n) { DISTRICT_OPTIONS.push(n); });
  }

  function getDistrictNames(districts) {
    return districts.map(function (d) { return d.name; });
  }

  function isDistrictInUse(name, assignees, stores) {
    var usedByAssignee = assignees.some(function (a) {
      return (a.districts || []).indexOf(name) !== -1;
    });
    if (usedByAssignee) return true;
    return stores.some(function (s) { return s.district === name; });
  }

  function findDuplicateName(districts, name, excludeId) {
    var trimmed = name.trim();
    return districts.some(function (d) {
      return d.name === trimmed && d.id !== excludeId;
    });
  }

  function updateDistrictReferences(oldName, newName, assignees, stores) {
    var nextAssignees = assignees.map(function (a) {
      if (!a.districts || a.districts.indexOf(oldName) === -1) return a;
      return Object.assign({}, a, {
        districts: a.districts.map(function (d) { return d === oldName ? newName : d; })
      });
    });
    var nextStores = stores.map(function (s) {
      if (s.district !== oldName) return s;
      return Object.assign({}, s, { district: newName });
    });
    return { assignees: nextAssignees, stores: nextStores };
  }

  window.DistrictUtils = {
    syncDistrictOptions: syncDistrictOptions,
    getDistrictNames: getDistrictNames,
    isDistrictInUse: isDistrictInUse,
    findDuplicateName: findDuplicateName,
    updateDistrictReferences: updateDistrictReferences
  };
})();
