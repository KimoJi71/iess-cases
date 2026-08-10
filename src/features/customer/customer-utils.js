/*
 * features/customer/customer-utils.js — 客戶啟用狀態、下拉選單與保養區間工具
 */
(function () {
  'use strict';

  function isEnabled(customer) {
    return customer && customer.enabled !== false;
  }

  function getEnabledCustomers(customers) {
    if (!customers) return [];
    return customers.filter(isEnabled);
  }

  function getCustomerNameOptions(customers, selectedName, includeDisabled) {
    var names = [];
    var seen = {};
    var enabledByName = {};
    (customers || []).forEach(function (c) {
      if (c.name) enabledByName[c.name] = isEnabled(c);
    });
    var source = includeDisabled ? (customers || []) : getEnabledCustomers(customers);
    source.forEach(function (c) {
      if (c.name && !seen[c.name]) {
        seen[c.name] = true;
        names.push(c.name);
      }
    });
    if (selectedName && !seen[selectedName]) {
      names.push(selectedName);
    }
    return names.sort(function (a, b) {
      if (includeDisabled) {
        var aEnabled = enabledByName[a] !== false;
        var bEnabled = enabledByName[b] !== false;
        if (aEnabled !== bEnabled) return aEnabled ? -1 : 1;
      }
      return a.localeCompare(b, 'zh-Hant');
    });
  }

  // 由客戶名稱查其服務等級；查無客戶或客戶未設定時回空字串
  function getServiceLevelByCustomerName(customers, name) {
    if (!name) return '';
    var customer = (customers || []).find(function (c) { return c && c.name === name; });
    return (customer && customer.serviceLevel) || '';
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

  // 判斷區間是否「可用」：起始月與結束月皆為 1–12 的整數，且起始月不大於結束月。
  // 半填（例如只填了結束月）的區間視為未設定，不參與分段／月份查詢，但仍保留在
  // normalizePeriods 的輸出中，讓表單與驗證仍能看到原始資料以便使用者補完整。
  function isUsablePeriod(p) {
    var s = p && p.startMonth;
    var e = p && p.endMonth;
    var sOk = typeof s === 'number' && Math.floor(s) === s && s >= 1 && s <= 12;
    var eOk = typeof e === 'number' && Math.floor(e) === e && e >= 1 && e <= 12;
    return sOk && eOk && s <= e;
  }

  function findCustomerByName(customers, name) {
    var target = String(name == null ? '' : name).trim();
    if (!target) return null;
    var found = (customers || []).find(function (c) {
      return c && String(c.name == null ? '' : c.name).trim() === target;
    });
    return found || null;
  }

  function getPeriods(customers, customerName) {
    var cust = findCustomerByName(customers, customerName);
    if (!cust) return [];
    return normalizePeriods(cust.periods).filter(isUsablePeriod);
  }

  function findPeriodForMonth(customers, customerName, month) {
    var m = Number(month);
    var found = getPeriods(customers, customerName).find(function (p) {
      return p.startMonth <= m && m <= p.endMonth;
    });
    return found || null;
  }

  function formatPeriodsLabel(customer) {
    var periods = normalizePeriods(customer && customer.periods);
    if (!periods.length) return '—';
    return periods.map(function (p) {
      return '第' + p.visitIndex + '次 ' + p.startMonth + '-' + p.endMonth + '月';
    }).join('、');
  }

  /**
   * 客戶保養區間驗證。expectedCount 為該客戶服務等級的「每年保養次數」。
   * 回傳錯誤訊息陣列，空陣列代表通過。呼叫端只提醒、不擋下儲存。
   */
  function validatePeriods(periods, expectedCount) {
    var list = normalizePeriods(periods);
    var count = Number(expectedCount) || 0;
    var errors = [];

    if (list.length !== count) {
      errors.push('保養區間筆數（' + list.length + '）與每年保養次數（' + count + '）不符');
    }

    var monthsValid = true;
    list.forEach(function (p) {
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
      for (var i = 0; i < list.length; i++) {
        for (var j = i + 1; j < list.length; j++) {
          var a = list[i];
          var b = list[j];
          if (a.startMonth <= b.endMonth && b.startMonth <= a.endMonth) {
            errors.push('第' + a.visitIndex + '次與第' + b.visitIndex + '次的保養區間重疊');
          }
        }
      }
    }

    return errors;
  }

  window.CustomerUtils = {
    isEnabled: isEnabled,
    getEnabledCustomers: getEnabledCustomers,
    getCustomerNameOptions: getCustomerNameOptions,
    getServiceLevelByCustomerName: getServiceLevelByCustomerName,
    getPeriods: getPeriods,
    findPeriodForMonth: findPeriodForMonth,
    formatPeriodsLabel: formatPeriodsLabel,
    validatePeriods: validatePeriods
  };
})();
