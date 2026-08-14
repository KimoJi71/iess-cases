/*
 * features/customer/vendor-utils.js — 廠商關鍵字比對與協力商下拉選項
 */
(function () {
  'use strict';

  var COOPERATOR_TYPE = '協力商';

  function matchesKeyword(vendor, keyword) {
    var kw = String(keyword || '').trim().toLowerCase();
    if (!kw) return true;
    return [vendor.name, vendor.type, vendor.taxId, vendor.principal].some(function (v) {
      return v && String(v).toLowerCase().includes(kw);
    });
  }

  function getCooperatorSelectOptions(vendors, currentIds) {
    var seen = {};
    var options = [];
    (vendors || []).forEach(function (v) {
      if (!v || !v.id || v.type !== COOPERATOR_TYPE || seen[v.id]) return;
      seen[v.id] = true;
      options.push({ value: v.id, label: v.name || v.id });
    });
    (currentIds || []).forEach(function (id) {
      if (!id || seen[id]) return;
      var match = (vendors || []).find(function (v) { return v && v.id === id; });
      seen[id] = true;
      options.push({ value: id, label: (match && match.name) || id });
    });
    return options.sort(function (a, b) {
      return String(a.label).localeCompare(String(b.label), 'zh-Hant');
    });
  }

  function formatCooperatorLabels(vendors, ids) {
    var options = getCooperatorSelectOptions(vendors, ids);
    return (ids || []).map(function (id) {
      var opt = options.find(function (o) { return o.value === id; });
      return (opt && opt.label) || id;
    }).filter(Boolean).join('、');
  }

  window.VendorUtils = {
    matchesKeyword: matchesKeyword,
    getCooperatorSelectOptions: getCooperatorSelectOptions,
    formatCooperatorLabels: formatCooperatorLabels
  };
})();
