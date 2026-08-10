/*
 * features/permissions/service-level-utils.js — 服務等級工具函式
 *
 * 服務等級是「每年保養次數」與「是否計算增額積分」的唯一資料來源；
 * 保養區間改由各客戶自行設定（見 features/customer/customer-utils.js）。
 * 客戶／門市／案件存的是服務等級「名稱字串」，故改名時需以 renameServiceLevel 連帶同步。
 */
(function () {
  'use strict';

  function toName(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalizeRecord(record) {
    return {
      name: toName(record && record.name),
      maintenanceCount: Number((record && record.maintenanceCount) || 0),
      countsBonusPoints: !!(record && record.countsBonusPoints)
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
    }

    return errors;
  }

  // 服務等級名稱字串會被以下集合快照，改名／刪除保護皆需以此表為準，
  // 避免未來新增集合時，只更新了 renameServiceLevel 或 isServiceLevelInUse 其中一個。
  // nested 表示該集合的項目底下還有一層巢狀物件也存了服務等級名稱字串。
  var SERVICE_LEVEL_COLLECTIONS = [
    { key: 'customers' },
    { key: 'stores' },
    { key: 'cases' },
    { key: 'maintenanceCases' },
    { key: 'projectCases', nested: 'details' },
    { key: 'surveyCases' },
    { key: 'personnelStatus' }
  ];

  function isServiceLevelInUse(name, collections) {
    var target = toName(name);
    if (!target) return false;
    var src = collections || {};
    return SERVICE_LEVEL_COLLECTIONS.some(function (desc) {
      return (src[desc.key] || []).some(function (item) {
        if (!item) return false;
        if (toName(item.serviceLevel) === target) return true;
        if (desc.nested && item[desc.nested] && toName(item[desc.nested].serviceLevel) === target) return true;
        return false;
      });
    });
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
   * 服務等級改名時，同步既有資料存的名稱字串。依 SERVICE_LEVEL_COLLECTIONS 驅動，
   * 每個「集合」在回傳物件中皆有同名欄位（見該表的 key）。
   * changedCount 以「欄位」為單位計數：projectCases 若頂層 serviceLevel 與巢狀
   * details.serviceLevel 同時命中舊名，算 2（各自代表一個獨立快照，皆需同步）。
   * @returns {{ customers, stores, cases, maintenanceCases, projectCases, surveyCases,
   *             personnelStatus, changedCount }}
   */
  function renameServiceLevel(oldName, newName, collections) {
    var from = toName(oldName);
    var to = toName(newName);
    var noop = from === to;
    var changedCount = 0;
    var src = collections || {};

    function mapList(list, nestedKey) {
      return (list || []).map(function (item) {
        if (!item || noop) return item;
        var next = item;
        var changed = false;
        if (toName(item.serviceLevel) === from) {
          next = Object.assign({}, next, { serviceLevel: to });
          changed = true;
          changedCount++;
        }
        if (nestedKey && item[nestedKey] && toName(item[nestedKey].serviceLevel) === from) {
          var nestedPatch = {};
          nestedPatch[nestedKey] = Object.assign({}, next[nestedKey], { serviceLevel: to });
          next = Object.assign({}, next, nestedPatch);
          changed = true;
          changedCount++;
        }
        return changed ? next : item;
      });
    }

    var result = {};
    SERVICE_LEVEL_COLLECTIONS.forEach(function (desc) {
      result[desc.key] = mapList(src[desc.key], desc.nested);
    });
    result.changedCount = changedCount;
    return result;
  }

  window.ServiceLevelUtils = {
    normalizeRecord: normalizeRecord,
    findByName: findByName,
    getMaintenanceCount: getMaintenanceCount,
    countsBonusPoints: countsBonusPoints,
    isAllocatable: isAllocatable,
    validate: validate,
    isServiceLevelInUse: isServiceLevelInUse,
    syncServiceLevelOptions: syncServiceLevelOptions,
    renameServiceLevel: renameServiceLevel
  };
})();
