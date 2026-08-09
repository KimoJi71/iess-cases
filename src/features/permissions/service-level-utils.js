/*
 * features/permissions/service-level-utils.js — 服務等級工具函式
 *
 * 服務等級是「每年保養次數」「保養區間」「是否計算增額積分」的唯一資料來源。
 * 客戶／門市／案件存的是服務等級「名稱字串」，故改名時需以 renameServiceLevel 連帶同步。
 */
(function () {
  'use strict';

  function toName(value) {
    return String(value == null ? '' : value).trim();
  }

  function toMonth(value) {
    if (value === '' || value === null || value === undefined) return '';
    var n = Number(value);
    return isNaN(n) ? '' : n;
  }

  function normalizePeriods(periods) {
    return (periods || []).map(function (p) {
      return {
        visitIndex: Number((p && p.visitIndex) || 0),
        startMonth: toMonth(p && p.startMonth),
        endMonth: toMonth(p && p.endMonth)
      };
    }).sort(function (a, b) { return a.visitIndex - b.visitIndex; });
  }

  function normalizeRecord(record) {
    return {
      name: toName(record && record.name),
      maintenanceCount: Number((record && record.maintenanceCount) || 0),
      countsBonusPoints: !!(record && record.countsBonusPoints),
      periods: normalizePeriods(record && record.periods)
    };
  }

  function findByName(serviceLevels, name) {
    var target = toName(name);
    if (!target) return null;
    var found = (serviceLevels || []).find(function (sl) {
      return toName(sl && sl.name) === target;
    });
    return found || null;
  }

  function getMaintenanceCount(serviceLevels, name) {
    var rec = findByName(serviceLevels, name);
    return rec ? (Number(rec.maintenanceCount) || 0) : 0;
  }

  function countsBonusPoints(serviceLevels, name) {
    var rec = findByName(serviceLevels, name);
    return !!(rec && rec.countsBonusPoints);
  }

  function getPeriods(serviceLevels, name) {
    var rec = findByName(serviceLevels, name);
    return rec ? normalizePeriods(rec.periods) : [];
  }

  function findPeriodForMonth(serviceLevels, name, month) {
    var m = Number(month);
    var found = getPeriods(serviceLevels, name).find(function (p) {
      return Number(p.startMonth) <= m && m <= Number(p.endMonth);
    });
    return found || null;
  }

  function isAllocatable(serviceLevels, name) {
    return getMaintenanceCount(serviceLevels, name) > 0;
  }

  function validate(record, serviceLevels, excludeId) {
    var n = normalizeRecord(record);
    var errors = [];

    if (!n.name) errors.push('服務等級名稱為必填');

    var duplicated = (serviceLevels || []).some(function (sl) {
      return sl.id !== excludeId && toName(sl.name) === n.name;
    });
    if (n.name && duplicated) errors.push('服務等級名稱「' + n.name + '」已存在');

    var count = n.maintenanceCount;
    if (!isFinite(count) || Math.floor(count) !== count || count < 0) {
      errors.push('每年保養次數需為 0 或正整數');
    } else if (n.periods.length !== count) {
      errors.push('保養區間筆數（' + n.periods.length + '）與每年保養次數（' + count + '）不符');
    }

    var monthsValid = true;
    n.periods.forEach(function (p) {
      var s = p.startMonth;
      var e = p.endMonth;
      var sOk = typeof s === 'number' && Math.floor(s) === s && s >= 1 && s <= 12;
      var eOk = typeof e === 'number' && Math.floor(e) === e && e >= 1 && e <= 12;
      if (!sOk || !eOk) {
        monthsValid = false;
        errors.push('第' + p.visitIndex + '次的起始月與結束月需為 1–12 月');
      } else if (s > e) {
        monthsValid = false;
        errors.push('第' + p.visitIndex + '次的起始月不可大於結束月');
      }
    });

    if (monthsValid) {
      for (var i = 0; i < n.periods.length; i++) {
        for (var j = i + 1; j < n.periods.length; j++) {
          var a = n.periods[i];
          var b = n.periods[j];
          if (a.startMonth <= b.endMonth && b.startMonth <= a.endMonth) {
            errors.push('第' + a.visitIndex + '次與第' + b.visitIndex + '次的保養區間重疊');
          }
        }
      }
    }

    return errors;
  }

  function isServiceLevelInUse(name, customers, stores) {
    var target = toName(name);
    if (!target) return false;
    var hit = function (item) { return toName(item && item.serviceLevel) === target; };
    return (customers || []).some(hit) || (stores || []).some(hit);
  }

  // 就地改寫 SERVICE_LEVEL_OPTIONS 的內容（其他模組持有同一參考，不可整個重新指派）
  function syncServiceLevelOptions(serviceLevels) {
    var seen = {};
    var names = [];
    (serviceLevels || []).forEach(function (sl) {
      var n = toName(sl && sl.name);
      if (!n || seen[n]) return;
      seen[n] = true;
      names.push(n);
    });
    SERVICE_LEVEL_OPTIONS.length = 0;
    names.forEach(function (n) { SERVICE_LEVEL_OPTIONS.push(n); });
  }

  /**
   * 服務等級改名時，同步既有資料存的名稱字串。
   * @returns {{ customers, stores, cases, maintenanceCases, changedCount }}
   */
  function renameServiceLevel(oldName, newName, collections) {
    var from = toName(oldName);
    var to = toName(newName);
    var changedCount = 0;
    var src = collections || {};

    function mapList(list) {
      return (list || []).map(function (item) {
        if (!item || toName(item.serviceLevel) !== from) return item;
        if (from === to) return item;
        changedCount++;
        return Object.assign({}, item, { serviceLevel: to });
      });
    }

    return {
      customers: mapList(src.customers),
      stores: mapList(src.stores),
      cases: mapList(src.cases),
      maintenanceCases: mapList(src.maintenanceCases),
      changedCount: changedCount
    };
  }

  function formatPeriodsLabel(record) {
    var periods = normalizePeriods(record && record.periods);
    if (!periods.length) return '—';
    return periods.map(function (p) {
      return '第' + p.visitIndex + '次 ' + p.startMonth + '-' + p.endMonth + '月';
    }).join('、');
  }

  window.ServiceLevelUtils = {
    normalizeRecord: normalizeRecord,
    findByName: findByName,
    getMaintenanceCount: getMaintenanceCount,
    countsBonusPoints: countsBonusPoints,
    getPeriods: getPeriods,
    findPeriodForMonth: findPeriodForMonth,
    isAllocatable: isAllocatable,
    validate: validate,
    isServiceLevelInUse: isServiceLevelInUse,
    syncServiceLevelOptions: syncServiceLevelOptions,
    renameServiceLevel: renameServiceLevel,
    formatPeriodsLabel: formatPeriodsLabel
  };
})();
