/*
 * features/permissions/device-category-utils.js — 設備分類工具函式
 */
(function () {
  'use strict';

  var FIELD_KEYS = ['category', 'brand', 'deviceName', 'specification', 'model', 'refrigerant', 'powerSource'];

  function normalizeRecord(record) {
    var out = {};
    FIELD_KEYS.forEach(function (key) {
      out[key] = String(record[key] || '').trim();
    });
    return out;
  }

  function recordKey(record) {
    var n = normalizeRecord(record);
    return FIELD_KEYS.map(function (k) { return n[k]; }).join('\0');
  }

  function syncOptionArray(target, values) {
    var seen = {};
    var merged = target.filter(function (v) {
      seen[v] = true;
      return true;
    });
    values.forEach(function (v) {
      var trimmed = String(v || '').trim();
      if (!trimmed || seen[trimmed]) return;
      seen[trimmed] = true;
      merged.push(trimmed);
    });
    target.length = 0;
    merged.forEach(function (v) { target.push(v); });
  }

  function syncDeviceCategoryOptions(deviceCategories) {
    var models = [];
    var categories = [];
    var brands = [];
    var deviceNames = [];

    deviceCategories.forEach(function (dc) {
      if (dc.model) models.push(dc.model);
      if (dc.category) categories.push(dc.category);
      if (dc.brand) brands.push(dc.brand);
      if (dc.deviceName) deviceNames.push(dc.deviceName);

      if (!dc.model) return;
      var existing = EQUIP_MODEL_CATALOG[dc.model] || {};
      var spec = String(dc.specification || '').trim();
      var horsepower = spec.replace(/匹$/, '') || spec;
      EQUIP_MODEL_CATALOG[dc.model] = {
        category: dc.category || existing.category || '',
        brand: dc.brand || existing.brand || '',
        horsepower: horsepower || existing.horsepower || '',
        indoorOutdoor: existing.indoorOutdoor || '無',
        voltage: dc.powerSource || existing.voltage || ''
      };
    });

    syncOptionArray(EQUIP_MODEL_OPTIONS, models);
    syncOptionArray(EQUIP_CATEGORY_OPTIONS, categories);
    syncOptionArray(EQUIP_BRAND_OPTIONS, brands);
    syncOptionArray(EQUIP_NAME_OPTIONS, deviceNames);
  }

  function findDuplicate(deviceCategories, record, excludeId) {
    var key = recordKey(record);
    return deviceCategories.some(function (dc) {
      return dc.id !== excludeId && recordKey(dc) === key;
    });
  }

  function isDeviceCategoryInUse(model, equipments) {
    if (!model) return false;
    return equipments.some(function (eq) { return eq.model === model; });
  }

  function formatRecordLabel(record) {
    var n = normalizeRecord(record);
    return [n.category, n.brand, n.model].filter(Boolean).join(' / ');
  }

  window.DeviceCategoryUtils = {
    FIELD_KEYS: FIELD_KEYS,
    normalizeRecord: normalizeRecord,
    syncDeviceCategoryOptions: syncDeviceCategoryOptions,
    findDuplicate: findDuplicate,
    isDeviceCategoryInUse: isDeviceCategoryInUse,
    formatRecordLabel: formatRecordLabel
  };
})();
