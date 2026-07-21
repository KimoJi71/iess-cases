/*
 * features/permissions/account-utils.js — 帳號與權限工具函式
 */
(function () {
  'use strict';

  function hashPassword(password) {
    var h = 5381;
    for (var i = 0; i < password.length; i++) {
      h = ((h << 5) + h) + password.charCodeAt(i);
      h |= 0;
    }
    return 'sha_demo_' + Math.abs(h).toString(16);
  }

  function createEmptyPermissions() {
    var perms = {};
    PERMISSION_FUNCTIONS.forEach(function (fn) {
      perms[fn] = { view: false, edit: false, close: false };
    });
    return perms;
  }

  function normalizePermissions(perms) {
    var next = {};
    PERMISSION_FUNCTIONS.forEach(function (fn) {
      var row = perms[fn] || {};
      var view = !!row.view;
      var edit = !!row.edit;
      var close = !!row.close;
      if (edit || close) view = true;
      next[fn] = { view: view, edit: edit, close: close };
    });
    return next;
  }

  function isAllSelected(perms) {
    return PERMISSION_FUNCTIONS.every(function (fn) {
      var row = perms[fn] || {};
      return row.view && row.edit && row.close;
    });
  }

  function setAllPermissions(perms, checked) {
    var next = {};
    PERMISSION_FUNCTIONS.forEach(function (fn) {
      next[fn] = { view: checked, edit: checked, close: checked };
    });
    return next;
  }

  function formatDistricts(districts) {
    if (!districts || !districts.length) return '—';
    return districts.join('、');
  }

  function formatEnabled(enabled) {
    return enabled ? '啟用' : '停用';
  }

  function syncProjectPersonOptions(accounts) {
    PROJECT_ASSIGNEES.length = 0;
    accounts
      .filter(function (a) { return a.enabled; })
      .map(function (a) { return a.name; })
      .sort(function (a, b) { return a.localeCompare(b, 'zh-Hant'); })
      .forEach(function (n) { PROJECT_ASSIGNEES.push(n); });
  }

  function getProjectPersonOptions(accounts, extraNames) {
    var seen = {};
    var list = [];
    accounts
      .filter(function (a) { return a.enabled; })
      .forEach(function (a) {
        if (!seen[a.name]) {
          seen[a.name] = true;
          list.push(a.name);
        }
      });
    (extraNames || []).forEach(function (name) {
      if (name && !seen[name]) {
        seen[name] = true;
        list.push(name);
      }
    });
    return list.sort(function (a, b) { return a.localeCompare(b, 'zh-Hant'); });
  }

  window.AccountUtils = {
    hashPassword: hashPassword,
    createEmptyPermissions: createEmptyPermissions,
    normalizePermissions: normalizePermissions,
    isAllSelected: isAllSelected,
    setAllPermissions: setAllPermissions,
    formatDistricts: formatDistricts,
    formatEnabled: formatEnabled,
    syncProjectPersonOptions: syncProjectPersonOptions,
    getProjectPersonOptions: getProjectPersonOptions
  };
})();
