/*
 * features/customer/customer-utils.js — 客戶啟用狀態與下拉選單工具
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

  window.CustomerUtils = {
    isEnabled: isEnabled,
    getEnabledCustomers: getEnabledCustomers,
    getCustomerNameOptions: getCustomerNameOptions
  };
})();
