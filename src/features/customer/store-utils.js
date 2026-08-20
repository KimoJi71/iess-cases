/*
 * features/customer/store-utils.js — 門市地址與區域工具函式
 */
(function () {
  'use strict';

  function formatStoreArea(city, district) {
    if (!city && !district) return '';
    return (city || '') + (district || '');
  }

  function getStoreArea(store) {
    if (!store) return '';
    return formatStoreArea(store.companyCity, store.companyDistrict);
  }

  function getRecordArea(record) {
    if (!record) return '';
    return formatStoreArea(record.companyCity, record.companyDistrict);
  }

  function buildFullAddress(store) {
    if (!store) return '';
    return [store.companyCity, store.companyDistrict, store.companyAddress].filter(Boolean).join('');
  }

  function getDistrictsForCity(city) {
    if (!city || !TAIWAN_CITY_DISTRICTS[city]) return [];
    return TAIWAN_CITY_DISTRICTS[city].slice();
  }

  function getAreaOptionsFromStores(stores) {
    var seen = {};
    var options = [];
    (stores || []).forEach(function (s) {
      var area = getStoreArea(s);
      if (area && !seen[area]) {
        seen[area] = true;
        options.push(area);
      }
    });
    return options.sort(function (a, b) { return a.localeCompare(b, 'zh-Hant'); });
  }

  function matchesRecordArea(record, areaFilter) {
    if (!areaFilter || areaFilter === '全部') return true;
    return getRecordArea(record) === areaFilter;
  }

  function assigneeCoversArea(assignee, area) {
    if (!assignee || !area) return false;
    return (assignee.districts || []).indexOf(area) !== -1;
  }

  function matchesStoreRecord(record, store) {
    if (!record || !store) return false;
    return record.customerName === store.customerName && record.storeName === store.storeName;
  }

  function isActiveStore(store) {
    return store && store.storeStatus !== '撤店';
  }

  function getActiveStores(stores) {
    if (!stores) return [];
    return stores.filter(isActiveStore);
  }

  /**
   * 門市「是否保養」。門市自身有設定時以門市為準；未設定（舊資料／尚未存過此欄位）
   * 時，由服務等級管理的「每年保養次數」推導：0 → 否，> 0 → 是。
   * serviceLevels 未提供時一律回 '是'——無從判斷就不套用此規則，
   * 免得資料不全的門市從保養計劃無聲消失。
   */
  function getStoreMaintenanceFlag(store, serviceLevels) {
    var raw = store && store.maintenanceFlag;
    if (raw === '是' || raw === '否') return raw;
    if (!serviceLevels || !serviceLevels.length) return '是';
    var count = (typeof ServiceLevelUtils !== 'undefined')
      ? ServiceLevelUtils.getMaintenanceCount(serviceLevels, store && store.serviceLevel)
      : 0;
    return count > 0 ? '是' : '否';
  }

  function isStoreMaintenanceEnabled(store, serviceLevels) {
    return getStoreMaintenanceFlag(store, serviceLevels) === '是';
  }

  /**
   * 該門市是否納入保養計劃（開單與保養計劃進度列表共用）：
   * 門市狀態為「整裝」「撤店」，或狀態為「正常營業」但「是否保養」為「否」時排除。
   */
  function isMaintainableStore(store, serviceLevels) {
    if (!store) return false;
    if (store.storeStatus !== '正常營業') return false;
    return isStoreMaintenanceEnabled(store, serviceLevels);
  }

  function getStoreNameOptions(stores, customerName, selectedStoreName, includeClosed) {
    if (!customerName) return [];
    var activeByName = {};
    (stores || []).forEach(function (s) {
      if (s.customerName === customerName && s.storeName) {
        activeByName[s.storeName] = isActiveStore(s);
      }
    });
    var source = (stores || []).filter(function (s) { return s.customerName === customerName; });
    if (!includeClosed) {
      source = source.filter(isActiveStore);
    }
    var names = [];
    var seen = {};
    source.forEach(function (s) {
      if (s.storeName && !seen[s.storeName]) {
        seen[s.storeName] = true;
        names.push(s.storeName);
      }
    });
    if (selectedStoreName && !seen[selectedStoreName]) {
      names.push(selectedStoreName);
    }
    return names.sort(function (a, b) {
      if (includeClosed) {
        var aActive = activeByName[a] !== false;
        var bActive = activeByName[b] !== false;
        if (aActive !== bActive) return aActive ? -1 : 1;
      }
      return a.localeCompare(b, 'zh-Hant');
    });
  }

  function resolveCaseEquipmentFields(caseItem, equipments) {
    var eq = caseItem && caseItem.equipment;
    if (!eq) return { category: '', name: '', area: '' };
    if (eq.id && equipments) {
      var full = equipments.find(function (e) { return e.id === eq.id; });
      if (full) {
        return {
          category: full.category || '',
          name: full.deviceName || full.name || '',
          area: full.area || eq.area || '',
          specification: full.specification || ''
        };
      }
    }
    return {
      category: eq.category || '',
      name: eq.deviceName || eq.name || eq.model || '',
      area: eq.area || '',
      specification: eq.specification || ''
    };
  }

  function formatHistoryDateTime(raw) {
    if (!raw) return '—';
    return IESS.caseDateTime.format(raw);
  }

  function getCaseCloseDate(record) {
    if (!record || !record.isClosed) return '';
    return record.closeDate || record.completionDate || record.repairDate || '';
  }

  function getRepairFilingTime(caseItem) {
    if (!caseItem) return '';
    return caseItem.createdAt || caseItem.repairDate || '';
  }

  function getMaintenanceFilingTime(caseItem) {
    if (!caseItem) return '';
    // planDate 才是使用者實際填的保養日期；dueMonth 只是區間標記
    // （區間驅動後填的是區間起始月，不代表案件發生的時間），僅作為舊案件的退路。
    if (caseItem.planDate) return caseItem.planDate + ' 00:00:00';
    if (caseItem.dueMonth) return caseItem.dueMonth + '-01 00:00:00';
    return '';
  }

  function getProjectFilingTime(project) {
    if (!project) return '';
    var filing = (project.history || []).find(function (item) {
      return item.stage === '立案時間';
    });
    if (filing && filing.date) return filing.date + ' 00:00:00';
    if (project.creationDate) return project.creationDate + ' 00:00:00';
    return '';
  }

  function buildRepairMaintenanceHistoryRows(store, cases, maintenanceCases, equipments) {
    var rows = [];
    (cases || []).forEach(function (c) {
      if (!c.isClosed || !matchesStoreRecord(c, store)) return;
      var eq = resolveCaseEquipmentFields(c, equipments);
      var filingTime = getRepairFilingTime(c);
      var finishTime = getCaseCloseDate(c);
      rows.push({
        id: 'repair-' + c.id,
        sourceType: 'repair',
        sourceId: c.id,
        sortDate: finishTime.slice(0, 10),
        caseNumber: c.caseNumber || '—',
        storeName: c.storeName || store.storeName,
        workCategory: c.workCategory || '—',
        equipmentCategory: eq.category || '—',
        equipmentName: eq.name || '—',
        equipmentArea: eq.area || '—',
        repairItem: c.repairItem || '—',
        repairReason: c.repairReason || '—',
        assignee: window.CaseAssigneeUtils
          ? CaseAssigneeUtils.formatAssignees(c)
          : (c.assignee || '—'),
        filingTime: filingTime,
        finishTime: finishTime
      });
    });
    (maintenanceCases || []).forEach(function (c) {
      if (!c.isClosed || !matchesStoreRecord(c, store)) return;
      var filingTime = getMaintenanceFilingTime(c);
      var finishTime = getCaseCloseDate(c);
      rows.push({
        id: 'maintenance-' + c.id,
        sourceType: 'maintenance',
        sourceId: c.id,
        sortDate: finishTime.slice(0, 10),
        caseNumber: c.caseNumber || '—',
        storeName: c.storeName || store.storeName,
        workCategory: '例行保養',
        equipmentCategory: '—',
        equipmentName: '—',
        equipmentArea: '—',
        repairItem: '',
        repairReason: '',
        assignee: (window.CaseAssigneeUtils
          ? CaseAssigneeUtils.formatAssignees(c)
          : c.assignee) || '—',
        filingTime: filingTime,
        finishTime: finishTime
      });
    });
    return rows.sort(function (a, b) {
      return new Date(b.sortDate || 0) - new Date(a.sortDate || 0);
    });
  }

  function buildProjectHistoryRows(store, projectCases) {
    return (projectCases || []).filter(function (p) {
      return p.isClosed && matchesStoreRecord(p, store);
    }).map(function (p) {
      var filingTime = getProjectFilingTime(p);
      var finishTime = getCaseCloseDate(p);
      return {
        id: 'project-' + p.id,
        sourceType: 'project',
        sourceId: p.id,
        sortDate: finishTime.slice(0, 10),
        caseNumber: p.projectNumber || '—',
        storeName: p.storeName || store.storeName,
        workCategory: p.workCategory || '—',
        assignee: p.stageAssignee || '—',
        filingTime: filingTime,
        finishTime: finishTime
      };
    }).sort(function (a, b) {
      return new Date(b.sortDate || 0) - new Date(a.sortDate || 0);
    });
  }

  function withStoreHistoryContext(record, store) {
    if (!record || !store) return record;
    return Object.assign({}, record, {
      customerName: record.customerName || store.customerName || '',
      storeName: record.storeName || store.storeName || '',
      storeAddress: record.storeAddress || buildFullAddress(store) || '',
      serviceLevel: record.serviceLevel || store.serviceLevel || ''
    });
  }

  /* --- 「撤店」工程立案單結案時的門市同步 ---
   * 撤店日期取歷程中的「客戶驗收」日期（同設備同步的驗收日期），沒有才退回結案日期。
   * 門市狀態一併改為「撤店」，門市列表與保養計劃進度才會立即視為已撤店。
   */
  function resolveProjectCloseDate(projectCase) {
    var entry = ((projectCase && projectCase.history) || []).find(function (item) {
      return item && item.stage === '客戶驗收';
    });
    if (entry && entry.date) return String(entry.date).slice(0, 10);
    return String((projectCase && projectCase.closeDate) || '').slice(0, 10);
  }

  function applyProjectCloseToStores(projectCase, stores) {
    var list = (stores || []).slice();
    var result = { stores: list, closedStore: '', closeDate: '' };
    if (!projectCase || projectCase.workCategory !== '撤店') return result;
    var closeDate = resolveProjectCloseDate(projectCase);
    if (!closeDate) return result;
    var hit = null;
    result.stores = list.map(function (s) {
      if (!matchesStoreRecord(projectCase, s)) return s;
      hit = s;
      return Object.assign({}, s, { closeDate: closeDate, storeStatus: '撤店' });
    });
    if (!hit) return { stores: list, closedStore: '', closeDate: '' };
    result.closedStore = hit.storeName || '';
    result.closeDate = closeDate;
    return result;
  }

  window.StoreUtils = {
    formatStoreArea: formatStoreArea,
    getStoreArea: getStoreArea,
    getRecordArea: getRecordArea,
    buildFullAddress: buildFullAddress,
    getDistrictsForCity: getDistrictsForCity,
    getAreaOptionsFromStores: getAreaOptionsFromStores,
    matchesRecordArea: matchesRecordArea,
    assigneeCoversArea: assigneeCoversArea,
    matchesStoreRecord: matchesStoreRecord,
    isActiveStore: isActiveStore,
    getActiveStores: getActiveStores,
    getStoreMaintenanceFlag: getStoreMaintenanceFlag,
    isStoreMaintenanceEnabled: isStoreMaintenanceEnabled,
    isMaintainableStore: isMaintainableStore,
    getStoreNameOptions: getStoreNameOptions,
    buildRepairMaintenanceHistoryRows: buildRepairMaintenanceHistoryRows,
    buildProjectHistoryRows: buildProjectHistoryRows,
    formatHistoryDateTime: formatHistoryDateTime,
    withStoreHistoryContext: withStoreHistoryContext,
    applyProjectCloseToStores: applyProjectCloseToStores
  };
})();
