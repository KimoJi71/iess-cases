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

  function resolveCaseEquipmentFields(caseItem, equipments) {
    var eq = caseItem && caseItem.equipment;
    if (!eq) return { category: '', name: '', area: '' };
    if (eq.id && equipments) {
      var full = equipments.find(function (e) { return e.id === eq.id; });
      if (full) {
        return {
          category: full.category || '',
          name: full.name || '',
          area: full.area || eq.area || ''
        };
      }
    }
    return {
      category: eq.category || '',
      name: eq.name || eq.model || '',
      area: eq.area || ''
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
    if (caseItem.dueMonth) return caseItem.dueMonth + '-01 00:00:00';
    if (caseItem.planDate) return caseItem.planDate + ' 00:00:00';
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
        assignee: c.assignee || '—',
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
        assignee: c.assignee || '—',
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
    buildRepairMaintenanceHistoryRows: buildRepairMaintenanceHistoryRows,
    buildProjectHistoryRows: buildProjectHistoryRows,
    formatHistoryDateTime: formatHistoryDateTime
  };
})();
