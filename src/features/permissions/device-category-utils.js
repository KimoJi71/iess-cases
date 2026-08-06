/*
 * features/permissions/device-category-utils.js — 設備分類工具函式
 */
(function () {
  'use strict';

  var FIELD_KEYS = ['category', 'brand', 'deviceName', 'specification', 'model', 'refrigerant', 'powerSource'];
  // 屬性欄位：參與正規化與儲存，但不參與重複性判定
  var ATTR_KEYS = ['equipmentLevel'];

  function normalizeRecord(record) {
    var out = {};
    FIELD_KEYS.concat(ATTR_KEYS).forEach(function (key) {
      out[key] = String((record && record[key]) || '').trim();
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

  function uniqueFieldValues(deviceCategories, field, filters) {
    filters = filters || {};
    var seen = {};
    var result = [];
    (deviceCategories || []).forEach(function (dc) {
      var match = Object.keys(filters).every(function (key) {
        return !filters[key] || String(dc[key] || '').trim() === filters[key];
      });
      if (!match) return;
      var val = String(dc[field] || '').trim();
      if (!val || seen[val]) return;
      seen[val] = true;
      result.push(val);
    });
    return result;
  }

  function withCurrentValue(options, currentValue) {
    var val = String(currentValue || '').trim();
    if (!val || options.indexOf(val) >= 0) return options;
    return options.concat([val]);
  }

  function findRecordByModel(deviceCategories, model) {
    var target = String(model || '').trim();
    if (!target) return null;
    for (var i = 0; i < (deviceCategories || []).length; i++) {
      if (String(deviceCategories[i].model || '').trim() === target) {
        return deviceCategories[i];
      }
    }
    return null;
  }

  function getEquipmentLevel(record) {
    var level = String((record && record.equipmentLevel) || '').trim();
    return level || EQUIPMENT_LEVEL_OPTIONS[0];
  }

  function getEquipmentLevelByModel(deviceCategories, model) {
    return getEquipmentLevel(findRecordByModel(deviceCategories, model));
  }

  function findBestMatchingRecord(deviceCategories, equip) {
    var list = deviceCategories || [];
    if (!list.length || !equip) return null;

    var model = String(equip.model || '').trim();
    if (model) {
      var byModel = findRecordByModel(list, model);
      if (byModel) return byModel;
    }

    var category = String(equip.category || '').trim();
    var brand = String(equip.brand || '').trim();
    var deviceName = String(equip.deviceName || equip.name || '').trim();
    var specification = String(equip.specification || '').trim();

    var best = null;
    var bestScore = 0;
    list.forEach(function (dc) {
      var score = 0;
      if (model && String(dc.model || '').trim() === model) score += 8;
      if (category && String(dc.category || '').trim() === category) score += 4;
      if (brand && String(dc.brand || '').trim() === brand) score += 2;
      if (deviceName && String(dc.deviceName || '').trim() === deviceName) score += 2;
      if (specification && String(dc.specification || '').trim() === specification) score += 1;
      if (score > bestScore) {
        bestScore = score;
        best = dc;
      }
    });
    return bestScore >= 4 ? best : null;
  }

  function resolveProjectEquip(equip, deviceCategories) {
    if (!equip) {
      return defaultEquipRecord();
    }

    var matched = findBestMatchingRecord(deviceCategories, equip);
    if (matched) {
      return {
        category: matched.category || '',
        brand: matched.brand || '',
        deviceName: matched.deviceName || '',
        specification: matched.specification || '',
        model: matched.model || '',
        area: equip.area || '',
        manufactureDate: equip.manufactureDate || '',
        installDate: equip.installDate || '',
        assetNumber: equip.assetNumber || '',
        serialNumber: equip.serialNumber || '',
        status: equip.status || (typeof EQUIP_STATUS_OPTIONS !== 'undefined' ? EQUIP_STATUS_OPTIONS[0] : '運轉')
      };
    }

    return {
      category: equip.category || '',
      brand: equip.brand || '',
      deviceName: equip.deviceName || equip.name || '',
      specification: equip.specification || '',
      model: equip.model || '',
      area: equip.area || '',
      manufactureDate: equip.manufactureDate || '',
      installDate: equip.installDate || '',
      assetNumber: equip.assetNumber || '',
      serialNumber: equip.serialNumber || '',
      status: equip.status || (typeof EQUIP_STATUS_OPTIONS !== 'undefined' ? EQUIP_STATUS_OPTIONS[0] : '運轉')
    };
  }

  function defaultEquipRecord() {
    return {
      category: '',
      brand: '',
      deviceName: '',
      specification: '',
      model: '',
      area: '',
      manufactureDate: '',
      installDate: '',
      assetNumber: '',
      serialNumber: '',
      status: typeof EQUIP_STATUS_OPTIONS !== 'undefined' ? EQUIP_STATUS_OPTIONS[0] : '運轉'
    };
  }

  function applyEquipFieldChange(currentEquip, name, value) {
    var next = Object.assign({}, currentEquip);
    next[name] = value;
    if (name === 'category') {
      next.brand = '';
      next.deviceName = '';
      next.specification = '';
      next.model = '';
    } else if (name === 'brand') {
      next.deviceName = '';
      next.specification = '';
      next.model = '';
    } else if (name === 'deviceName') {
      next.specification = '';
      next.model = '';
    } else if (name === 'specification') {
      next.model = '';
    }
    return next;
  }

  function getEquipFieldOptions(deviceCategories, currentEquip) {
    var filters = { category: currentEquip.category };
    return {
      category: uniqueFieldValues(deviceCategories, 'category'),
      brand: currentEquip.category
        ? uniqueFieldValues(deviceCategories, 'brand', filters)
        : [],
      deviceName: currentEquip.category && currentEquip.brand
        ? uniqueFieldValues(deviceCategories, 'deviceName', Object.assign({}, filters, { brand: currentEquip.brand }))
        : [],
      specification: currentEquip.category && currentEquip.brand && currentEquip.deviceName
        ? uniqueFieldValues(deviceCategories, 'specification', Object.assign({}, filters, {
          brand: currentEquip.brand,
          deviceName: currentEquip.deviceName
        }))
        : [],
      model: currentEquip.category && currentEquip.brand && currentEquip.deviceName && currentEquip.specification
        ? uniqueFieldValues(deviceCategories, 'model', Object.assign({}, filters, {
          brand: currentEquip.brand,
          deviceName: currentEquip.deviceName,
          specification: currentEquip.specification
        }))
        : []
    };
  }

  function isValidEquipSelection(equip, deviceCategories) {
    var model = String((equip && equip.model) || '').trim();
    if (!model) return false;
    return !!findRecordByModel(deviceCategories, model);
  }

  window.DeviceCategoryUtils = {
    FIELD_KEYS: FIELD_KEYS,
    ATTR_KEYS: ATTR_KEYS,
    normalizeRecord: normalizeRecord,
    syncDeviceCategoryOptions: syncDeviceCategoryOptions,
    findDuplicate: findDuplicate,
    isDeviceCategoryInUse: isDeviceCategoryInUse,
    formatRecordLabel: formatRecordLabel,
    uniqueFieldValues: uniqueFieldValues,
    withCurrentValue: withCurrentValue,
    findRecordByModel: findRecordByModel,
    getEquipmentLevel: getEquipmentLevel,
    getEquipmentLevelByModel: getEquipmentLevelByModel,
    findBestMatchingRecord: findBestMatchingRecord,
    resolveProjectEquip: resolveProjectEquip,
    defaultEquipRecord: defaultEquipRecord,
    applyEquipFieldChange: applyEquipFieldChange,
    getEquipFieldOptions: getEquipFieldOptions,
    isValidEquipSelection: isValidEquipSelection
  };
})();
