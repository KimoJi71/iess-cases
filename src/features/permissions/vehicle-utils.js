/*
 * features/permissions/vehicle-utils.js — 車輛管理工具函式
 */
(function () {
  'use strict';
  var global = window;

  function normalizePlate(plateNo) {
    return String(plateNo || '').trim().toUpperCase();
  }

  function matchesKeyword(vehicle, keyword) {
    var kw = String(keyword || '').trim().toLowerCase();
    if (!kw) return true;
    return [
      vehicle.plateNo,
      vehicle.personInCharge,
      vehicle.owner,
      vehicle.company
    ].some(function (v) {
      return v && String(v).toLowerCase().includes(kw);
    });
  }

  function findDuplicatePlate(vehicles, plateNo, excludeId) {
    var normalized = normalizePlate(plateNo);
    if (!normalized) return null;
    for (var i = 0; i < (vehicles || []).length; i++) {
      var item = vehicles[i];
      if (excludeId && item.id === excludeId) continue;
      if (normalizePlate(item.plateNo) === normalized) return item;
    }
    return null;
  }

  function formatLabel(vehicles, vehicleId) {
    if (!vehicleId) return '';
    var match = (vehicles || []).find(function (v) { return v && v.id === vehicleId; });
    return (match && (match.plateNo || match.id)) || String(vehicleId);
  }

  function getSelectOptions(vehicles, currentId) {
    var seen = {};
    var options = [];
    (vehicles || []).forEach(function (v) {
      if (!v || !v.id || seen[v.id]) return;
      seen[v.id] = true;
      options.push({ value: v.id, label: v.plateNo || v.id });
    });
    if (currentId && !seen[currentId]) {
      options.push({ value: currentId, label: currentId });
    }
    return options.sort(function (a, b) {
      return String(a.label).localeCompare(String(b.label), 'zh-Hant');
    });
  }

  function getPersonInChargeOptions(accounts, currentValue) {
    var names = (accounts || []).filter(function (a) {
      return a && a.enabled;
    }).map(function (a) {
      return a.name;
    });
    if (currentValue && names.indexOf(currentValue) === -1) {
      names = [currentValue].concat(names);
    }
    return names.sort(function (a, b) {
      return String(a).localeCompare(String(b), 'zh-Hant');
    });
  }

  function isRepairCaseOpen(c) {
    if (!c) return false;
    if (!c.isClosed) return true;
    // 待報價／轉汰換／轉原廠結案後仍滯留處理列表，等後續處理才真正結束，期間繼續佔用資源。
    if (c.isListClosed && global.IESS && IESS.caseStatus
      && IESS.caseStatus.isListRetainedStatus(c.processStatus)) {
      return true;
    }
    return false;
  }

  function caseReferencesVehicle(c, vehicle) {
    if (!c || !vehicle) return false;
    if (c.vehicleId && c.vehicleId === vehicle.id) return true;
    var plate = normalizePlate(vehicle.plateNo);
    if (!plate) return false;
    return normalizePlate(c.vehiclePlate || c.plateNo) === plate;
  }

  function hasOpenCasesForVehicle(vehicle, cases, maintenanceCases, projectCases) {
    if ((cases || []).some(function (c) {
      return isRepairCaseOpen(c) && caseReferencesVehicle(c, vehicle);
    })) return true;
    if ((maintenanceCases || []).some(function (c) {
      return !c.isClosed && caseReferencesVehicle(c, vehicle);
    })) return true;
    if ((projectCases || []).some(function (c) {
      return !c.isClosed && caseReferencesVehicle(c, vehicle);
    })) return true;
    return false;
  }

  window.VehicleUtils = {
    normalizePlate: normalizePlate,
    matchesKeyword: matchesKeyword,
    findDuplicatePlate: findDuplicatePlate,
    formatLabel: formatLabel,
    getSelectOptions: getSelectOptions,
    getPersonInChargeOptions: getPersonInChargeOptions,
    hasOpenCasesForVehicle: hasOpenCasesForVehicle
  };
})();
