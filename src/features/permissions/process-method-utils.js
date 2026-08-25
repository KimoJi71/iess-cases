/*
 * features/permissions/process-method-utils.js — 處理方式與積分工具函式
 */
(function () {
  'use strict';

  var FIELD_KEYS = ['category1', 'category2', 'category3', 'specification', 'unit', 'points'];
  var META_KEYS = ['brand', 'productCode', 'model'];

  function normalizeRecord(record) {
    var out = {};
    FIELD_KEYS.forEach(function (key) {
      if (key === 'points') {
        var n = Number(record[key]);
        out.points = isNaN(n) ? 0 : n;
      } else {
        out[key] = String(record[key] || '').trim();
      }
    });
    META_KEYS.forEach(function (key) {
      out[key] = String(record[key] || '').trim();
    });
    return out;
  }

  function recordKey(record) {
    var n = normalizeRecord(record);
    return [n.category1, n.category2, n.category3, n.specification, n.unit, String(n.points)].join('\0');
  }

  function processRecordKey(processRecord) {
    var pr = processRecord || {};
    return [
      String(pr.category1 || '').trim(),
      String(pr.category2 || '').trim(),
      String(pr.category3 || '').trim(),
      String(pr.specification || '').trim(),
      String(pr.unit || '').trim()
    ].join('\0');
  }

  function recordMatchesProcessRecord(record, processRecord) {
    var pr = processRecord || {};
    var n = normalizeRecord(record);
    if (n.category1 !== String(pr.category1 || '').trim()) return false;
    if (n.category2 !== String(pr.category2 || '').trim()) return false;
    if (n.category3 !== String(pr.category3 || '').trim()) return false;
    var prSpec = String(pr.specification || '').trim();
    var prUnit = String(pr.unit || '').trim();
    if (prSpec && n.specification !== prSpec) return false;
    if (prUnit && n.unit !== prUnit) return false;
    return true;
  }

  function getCat2Options(category1) {
    return Object.keys(PROCESS_METHOD_CATEGORIES[category1] || {});
  }

  function getCat3Options(category1, category2) {
    var sub = PROCESS_METHOD_CATEGORIES[category1];
    return (sub && sub[category2]) ? sub[category2].slice() : [];
  }

  function filterProcessMethods(processMethods, filters) {
    filters = filters || {};
    return (processMethods || []).filter(function (pm) {
      if (filters.category1 && pm.category1 !== filters.category1) return false;
      if (filters.category2 && pm.category2 !== filters.category2) return false;
      if (filters.category3 && pm.category3 !== filters.category3) return false;
      if (filters.specification != null && filters.specification !== '' &&
          pm.specification !== filters.specification) return false;
      if (filters.processMethodId && pm.id !== filters.processMethodId) return false;
      return true;
    });
  }

  function getDistinctValues(processMethods, field, filters) {
    var list = filterProcessMethods(processMethods, filters);
    var seen = {};
    var out = [];
    list.forEach(function (pm) {
      var val = String(pm[field] || '').trim();
      if (!val || seen[val]) return;
      seen[val] = true;
      out.push(val);
    });
    return out.sort(function (a, b) { return a.localeCompare(b, 'zh-Hant'); });
  }

  function getCat1OptionsFromMethods(processMethods) {
    return getDistinctValues(processMethods, 'category1', {});
  }

  function getCat2OptionsFromMethods(processMethods, category1) {
    return getDistinctValues(processMethods, 'category2', { category1: category1 });
  }

  function getCat3OptionsFromMethods(processMethods, category1, category2) {
    return getDistinctValues(processMethods, 'category3', {
      category1: category1,
      category2: category2
    });
  }

  function getSpecOptionsFromMethods(processMethods, category1, category2, category3) {
    return getDistinctValues(processMethods, 'specification', {
      category1: category1,
      category2: category2,
      category3: category3
    });
  }

  function findProcessMethodById(processMethods, id) {
    return (processMethods || []).find(function (pm) { return pm.id === id; });
  }

  function findProcessMethodForSelection(processMethods, selection) {
    var matches = filterProcessMethods(processMethods, {
      category1: selection.category1,
      category2: selection.category2,
      category3: selection.category3,
      specification: selection.specification
    });
    return matches[0] || null;
  }

  var CASE_DISPLAY_COLUMNS = [
    { key: 'category1', label: '大類' },
    { key: 'category2', label: '中類' },
    { key: 'category3', label: '小類' },
    { key: 'specification', label: '規格' }
  ];

  // 案件處理方式的處理狀態：只有「已處理」計入積分，舊資料（無 status）視為已處理。
  var PROCESS_RECORD_STATUS = { DONE: '已處理', PENDING: '待處理' };

  function getCaseRecordStatus(record) {
    var status = String((record && record.status) || '').trim();
    return status === PROCESS_RECORD_STATUS.PENDING
      ? PROCESS_RECORD_STATUS.PENDING
      : PROCESS_RECORD_STATUS.DONE;
  }

  function isCaseRecordDone(record) {
    return getCaseRecordStatus(record) === PROCESS_RECORD_STATUS.DONE;
  }

  function getCaseRecordStatusBadgeClass(record) {
    return isCaseRecordDone(record)
      ? 'inline-block px-2 py-0.5 rounded text-xs bg-green-100 text-green-700'
      : 'inline-block px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700';
  }

  function toggleCaseRecordStatus(status) {
    return status === PROCESS_RECORD_STATUS.DONE
      ? PROCESS_RECORD_STATUS.PENDING
      : PROCESS_RECORD_STATUS.DONE;
  }

  // 已處理在前、待處理在後；同組維持原本加入順序（穩定排序）。
  function sortCaseProcessRecords(records) {
    var done = [];
    var pending = [];
    (records || []).forEach(function (r) {
      (isCaseRecordDone(r) ? done : pending).push(r);
    });
    return done.concat(pending);
  }

  function toCaseProcessRecord(processMethod, qty, lineId, status) {
    var pm = normalizeRecord(processMethod);
    return {
      id: lineId != null ? lineId : Date.now(),
      processMethodId: processMethod.id,
      category1: pm.category1,
      category2: pm.category2,
      category3: pm.category3,
      specification: pm.specification,
      unit: pm.unit,
      points: pm.points,
      qty: Number(qty) > 0 ? Number(qty) : 1,
      status: getCaseRecordStatus({ status: status })
    };
  }

  function formatCaseProcessRecordLabel(record) {
    var n = normalizeRecord(record);
    var parts = [n.category1, n.category2, n.category3].filter(Boolean);
    if (n.specification) parts.push(n.specification);
    return parts.join(' / ');
  }

  function toPointsNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    var n = Number(value);
    return isNaN(n) ? null : n;
  }

  function resolveCaseRecordPoints(record, processMethods, isClosed) {
    if (!record) return null;
    var snapshot = toPointsNumber(record.points);
    if (isClosed) return snapshot;
    var pm = findProcessMethodById(processMethods, record.processMethodId);
    if (pm) {
      var live = toPointsNumber(pm.points);
      if (live !== null) return live;
    }
    return snapshot;
  }

  function getDefaultProcessMethodSelection(processMethods) {
    var pm = (processMethods || [])[0];
    if (!pm) {
      return { category1: '', category2: '', category3: '', specification: '', qty: 1 };
    }
    return {
      category1: pm.category1,
      category2: pm.category2,
      category3: pm.category3,
      specification: pm.specification,
      qty: 1
    };
  }

  function normalizeProcessMethodSelection(processMethods, selection) {
    var s = Object.assign({ qty: 1 }, selection || {});
    var cat1List = getCat1OptionsFromMethods(processMethods);
    if (!cat1List.length) {
      return getDefaultProcessMethodSelection(processMethods);
    }
    if (!s.category1 || cat1List.indexOf(s.category1) === -1) {
      s.category1 = cat1List[0];
    }
    var cat2List = getCat2OptionsFromMethods(processMethods, s.category1);
    if (!s.category2 || cat2List.indexOf(s.category2) === -1) {
      s.category2 = cat2List[0] || '';
    }
    var cat3List = getCat3OptionsFromMethods(processMethods, s.category1, s.category2);
    if (!s.category3 || cat3List.indexOf(s.category3) === -1) {
      s.category3 = cat3List[0] || '';
    }
    var specList = getSpecOptionsFromMethods(processMethods, s.category1, s.category2, s.category3);
    if (!s.specification || specList.indexOf(s.specification) === -1) {
      s.specification = specList[0] || '';
    }
    if (!findProcessMethodForSelection(processMethods, s)) {
      return getDefaultProcessMethodSelection(processMethods);
    }
    return s;
  }

  function getDefaultProcessRecord() {
    var cat1Keys = Object.keys(PROCESS_METHOD_CATEGORIES);
    if (!cat1Keys.length) {
      return { category1: '', category2: '', category3: '', qty: 1 };
    }
    var c1 = cat1Keys[0];
    var c2Keys = getCat2Options(c1);
    var c2 = c2Keys[0] || '';
    var c3List = getCat3Options(c1, c2);
    return { category1: c1, category2: c2, category3: c3List[0] || '', qty: 1 };
  }

  function normalizeProcessRecordSelection(record) {
    var r = Object.assign({ qty: 1 }, record || {});
    if (!r.category1 || !PROCESS_METHOD_CATEGORIES[r.category1]) {
      return getDefaultProcessRecord();
    }
    var c2Keys = getCat2Options(r.category1);
    if (!r.category2 || c2Keys.indexOf(r.category2) === -1) {
      r.category2 = c2Keys[0] || '';
    }
    var c3List = getCat3Options(r.category1, r.category2);
    if (!r.category3 || c3List.indexOf(r.category3) === -1) {
      r.category3 = c3List[0] || '';
    }
    return r;
  }

  function syncProcessMethodOptions(processMethods) {
    (processMethods || []).forEach(function (pm) {
      var c1 = String(pm.category1 || '').trim();
      var c2 = String(pm.category2 || '').trim();
      var c3 = String(pm.category3 || '').trim();
      if (!c1 || !c2 || !c3) return;
      if (!PROCESS_METHOD_CATEGORIES[c1]) PROCESS_METHOD_CATEGORIES[c1] = {};
      if (!PROCESS_METHOD_CATEGORIES[c1][c2]) PROCESS_METHOD_CATEGORIES[c1][c2] = [];
      if (PROCESS_METHOD_CATEGORIES[c1][c2].indexOf(c3) === -1) {
        PROCESS_METHOD_CATEGORIES[c1][c2].push(c3);
      }
    });
  }

  function findDuplicate(processMethods, record, excludeId) {
    var key = recordKey(record);
    return processMethods.some(function (pm) {
      return pm.id !== excludeId && recordKey(pm) === key;
    });
  }

  function collectCaseArrays(cases, maintenanceCases, projectCases) {
    var all = (cases || []).slice();
    (maintenanceCases || []).forEach(function (c) { all.push(c); });
    (projectCases || []).forEach(function (c) { all.push(c); });
    return all;
  }

  function hasUnincludedPerformanceCases(record, cases, maintenanceCases, projectCases) {
    var allCases = collectCaseArrays(cases, maintenanceCases, projectCases);
    return allCases.some(function (c) {
      if (c.isPerformanceIncluded) return false;
      // 叫修案件的處理紀錄已搬到各設備卡片；保養／工程案件沒有 serviceItems，維持原本欄位。
      // 這個判斷用來擋刪除：案件是 serviceItems 結構卻找不到 RepairCaseServiceItems 時，
      // 無法確認是否還有引用，寧可保守回 true（視為仍有引用、擋下刪除）。
      if (Array.isArray(c.serviceItems) && !window.RepairCaseServiceItems) return true;
      var records = Array.isArray(c.serviceItems)
        ? RepairCaseServiceItems.getAllProcessRecords(c)
        : (c.processRecords || []);
      return records.some(function (pr) {
        return recordMatchesProcessRecord(record, pr);
      });
    });
  }

  function formatRecordLabel(record) {
    var n = normalizeRecord(record);
    var parts = [n.category1, n.category2, n.category3].filter(Boolean);
    if (n.specification) parts.push(n.specification);
    if (n.unit) parts.push(n.unit);
    if (n.points) parts.push(String(n.points) + ' 積分');
    return parts.join(' / ');
  }

  window.ProcessMethodUtils = {
    FIELD_KEYS: FIELD_KEYS,
    normalizeRecord: normalizeRecord,
    recordKey: recordKey,
    syncProcessMethodOptions: syncProcessMethodOptions,
    findDuplicate: findDuplicate,
    hasUnincludedPerformanceCases: hasUnincludedPerformanceCases,
    formatRecordLabel: formatRecordLabel,
    recordMatchesProcessRecord: recordMatchesProcessRecord,
    getCat2Options: getCat2Options,
    getCat3Options: getCat3Options,
    getDefaultProcessRecord: getDefaultProcessRecord,
    normalizeProcessRecordSelection: normalizeProcessRecordSelection,
    filterProcessMethods: filterProcessMethods,
    getCat1OptionsFromMethods: getCat1OptionsFromMethods,
    getCat2OptionsFromMethods: getCat2OptionsFromMethods,
    getCat3OptionsFromMethods: getCat3OptionsFromMethods,
    getSpecOptionsFromMethods: getSpecOptionsFromMethods,
    findProcessMethodById: findProcessMethodById,
    findProcessMethodForSelection: findProcessMethodForSelection,
    CASE_DISPLAY_COLUMNS: CASE_DISPLAY_COLUMNS,
    PROCESS_RECORD_STATUS: PROCESS_RECORD_STATUS,
    getCaseRecordStatus: getCaseRecordStatus,
    isCaseRecordDone: isCaseRecordDone,
    getCaseRecordStatusBadgeClass: getCaseRecordStatusBadgeClass,
    toggleCaseRecordStatus: toggleCaseRecordStatus,
    sortCaseProcessRecords: sortCaseProcessRecords,
    toCaseProcessRecord: toCaseProcessRecord,
    formatCaseProcessRecordLabel: formatCaseProcessRecordLabel,
    resolveCaseRecordPoints: resolveCaseRecordPoints,
    getDefaultProcessMethodSelection: getDefaultProcessMethodSelection,
    normalizeProcessMethodSelection: normalizeProcessMethodSelection
  };
})();
