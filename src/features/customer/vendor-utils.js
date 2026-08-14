/*
 * features/customer/vendor-utils.js — 廠商關鍵字比對
 */
(function () {
  'use strict';

  function matchesKeyword(vendor, keyword) {
    var kw = String(keyword || '').trim().toLowerCase();
    if (!kw) return true;
    return [vendor.name, vendor.type, vendor.taxId, vendor.principal].some(function (v) {
      return v && String(v).toLowerCase().includes(kw);
    });
  }

  window.VendorUtils = {
    matchesKeyword: matchesKeyword
  };
})();
