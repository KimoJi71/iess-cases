/*
 * features/reports/data-retrieval-utils.js — 資料調閱：篩選、欄位定義與 CSV 匯出
 */
(function () {
  'use strict';

  var CASE_TYPES = ['維修', '保養', '工程'];

  // 篩選值為 string[]；空陣列代表「全部」，不做篩選。
  function isAny(list) {
    return !list || !list.length;
  }

  function matches(list, value) {
    return isAny(list) || list.indexOf(value) !== -1;
  }

  function inDateRange(dateStr, start, end) {
    if (!dateStr) return false;
    var date = dateStr.slice(0, 10);
    return date >= start && date <= end;
  }

  function resolveMaintenanceLocation(record, stores) {
    if (record.companyCity || record.companyDistrict) {
      return { city: record.companyCity || '', district: record.companyDistrict || '' };
    }
    var store = (stores || []).find(function (s) {
      return s.customerName === record.customerName && s.storeName === record.storeName;
    });
    return {
      city: (store && store.companyCity) || '',
      district: (store && store.companyDistrict) || ''
    };
  }

  function getMaintenanceDate(record) {
    return (record.completionDate && record.completionDate.slice(0, 10))
      || record.planDate
      || (record.dueMonth ? record.dueMonth + '-01' : '');
  }

  function formatAssignees(record) {
    if (window.CaseAssigneeUtils) {
      return CaseAssigneeUtils.formatAssignees(record) || '—';
    }
    return (record && record.assignee) || '—';
  }

  function filterProjectCases(cases, filters) {
    return (cases || []).filter(function (c) {
      if (!inDateRange(c.creationDate, filters.startDate, filters.endDate)) return false;
      if (!matches(filters.workCategory, c.workCategory)) return false;
      if (!matches(filters.customer, c.customerName)) return false;
      if (!isAny(filters.contactPerson)) {
        var person = (c.details && c.details.contactPerson) || c.stageAssignee || '';
        if (filters.contactPerson.indexOf(person) === -1) return false;
      }
      return true;
    }).sort(function (a, b) {
      return (b.creationDate || '').localeCompare(a.creationDate || '');
    });
  }

  function filterRepairCases(cases, filters) {
    return (cases || []).filter(function (c) {
      if (c.workCategory === '保養') return false;
      if (!inDateRange(c.repairDate, filters.startDate, filters.endDate)) return false;
      if (!matches(filters.workCategory, c.workCategory)) return false;
      if (!matches(filters.repairItem, c.repairItem)) return false;
      if (!matches(filters.repairReason, c.repairReason)) return false;
      if (!matches(filters.customer, c.customerName)) return false;
      if (!matches(filters.store, c.storeName)) return false;
      if (!isAny(filters.assignee)) {
        // 任一已選人員命中即通過（案件可能多人指派）
        var hit = filters.assignee.some(function (name) {
          return window.CaseAssigneeUtils
            ? CaseAssigneeUtils.includesAssignee(c, name)
            : c.assignee === name;
        });
        if (!hit) return false;
      }
      if (!matches(filters.serviceLevel, c.serviceLevel)) return false;
      return true;
    }).sort(function (a, b) {
      return (b.repairDate || '').localeCompare(a.repairDate || '');
    });
  }

  function filterMaintenanceCases(cases, stores, filters) {
    return (cases || []).filter(function (c) {
      var loc = resolveMaintenanceLocation(c, stores);
      if (!matches(filters.city, loc.city)) return false;
      if (!matches(filters.district, loc.district)) return false;
      if (!matches(filters.customer, c.customerName)) return false;
      if (!matches(filters.assignee, c.assignee)) return false;
      if (!matches(filters.serviceLevel, c.serviceLevel)) return false;
      var date = getMaintenanceDate(c);
      if (!inDateRange(date, filters.startDate, filters.endDate)) return false;
      return true;
    }).sort(function (a, b) {
      return getMaintenanceDate(b).localeCompare(getMaintenanceDate(a));
    });
  }

  function sortZhHant(names) {
    return names.sort(function (a, b) { return a.localeCompare(b, 'zh-Hant'); });
  }

  // 客戶名稱為多選：門市選項取所有已選客戶的門市聯集。
  // 未選客戶時沿用「所有營業中門市」。
  function getStoreOptionsForCustomers(stores, customerNames) {
    var names = [];
    var seen = {};
    function push(name) {
      if (name && !seen[name]) {
        seen[name] = true;
        names.push(name);
      }
    }
    if (!customerNames || !customerNames.length) {
      StoreUtils.getActiveStores(stores).forEach(function (s) { push(s.storeName); });
      return sortZhHant(names);
    }
    customerNames.forEach(function (customerName) {
      StoreUtils.getStoreNameOptions(stores, customerName, null, true).forEach(push);
    });
    return sortZhHant(names);
  }

  // 縣市為多選：行政區選項取所有已選縣市的聯集，未選縣市時為空。
  function getDistrictOptionsForCities(cityNames) {
    var districts = [];
    var seen = {};
    (cityNames || []).forEach(function (city) {
      StoreUtils.getDistrictsForCity(city).forEach(function (d) {
        if (d && !seen[d]) {
          seen[d] = true;
          districts.push(d);
        }
      });
    });
    return districts;
  }

  function mapProjectRow(c) {
    return {
      '立案編號': c.projectNumber || '—',
      '立案日期': c.creationDate || '—',
      '客戶名稱': c.customerName || '—',
      '門市名稱': c.storeName || '—',
      '工程類型': c.workCategory || '—',
      '目前階段': c.currentStage || '—',
      '負責專員': (c.details && c.details.contactPerson) || c.stageAssignee || '—',
      '階段日期': c.stageDate || '—',
      '結案狀態': c.isClosed ? '已結案' : '進行中'
    };
  }

  function resolveRepairArea(record, stores) {
    var area = StoreUtils.getRecordArea(record);
    if (area) return area;
    var store = (stores || []).find(function (s) {
      return s.customerName === record.customerName && s.storeName === record.storeName;
    });
    return store ? StoreUtils.getStoreArea(store) : '';
  }

  function mapRepairRow(c, stores) {
    return {
      '叫修時間': IESS.caseDateTime.format(c.repairDate) || '—',
      '案件編號': c.caseNumber || '—',
      '客戶名稱': c.customerName || '—',
      '門市名稱': c.storeName || '—',
      '公司區域': resolveRepairArea(c, stores) || '—',
      '客戶分級': c.serviceLevel || '—',
      '工項分類': c.workCategory || '—',
      '叫修項目': c.repairItem || '—',
      '叫修原因': c.repairReason || '—',
      '故障描述': c.faultDesc || '—',
      '實際原因': c.actualReason || '—',
      '維修人員': formatAssignees(c),
      '處理狀態': c.processStatus || '未處理',
      '結案狀態': c.isClosed ? '已結案' : '進行中',
      '結案日期': c.closeDate ? IESS.caseDateTime.format(c.closeDate) : '—'
    };
  }

  function mapMaintenanceRow(c, stores) {
    var loc = resolveMaintenanceLocation(c, stores);
    return {
      '基準日期': getMaintenanceDate(c) || '—',
      '案件編號': c.caseNumber || '—',
      '客戶名稱': c.customerName || '—',
      '門市名稱': c.storeName || '—',
      '縣市': loc.city || '—',
      '行政區': loc.district || '—',
      '客戶分級': c.serviceLevel || '—',
      '保養狀態': c.status || '—',
      '維修人員': c.assignee || '—',
      '預約日期': c.planDate || '—',
      '完成日期': c.completionDate ? IESS.caseDateTime.format(c.completionDate) : '—',
      '結案狀態': c.isClosed ? '已結案' : '進行中'
    };
  }

  function getColumns(caseType) {
    if (caseType === '工程') {
      return ['立案編號', '立案日期', '客戶名稱', '門市名稱', '工程類型', '目前階段', '負責專員', '階段日期', '結案狀態'];
    }
    if (caseType === '維修') {
      return ['叫修時間', '案件編號', '客戶名稱', '門市名稱', '公司區域', '客戶分級', '工項分類', '叫修項目', '叫修原因', '故障描述', '實際原因', '維修人員', '處理狀態', '結案狀態', '結案日期'];
    }
    return ['基準日期', '案件編號', '客戶名稱', '門市名稱', '縣市', '行政區', '客戶分級', '保養狀態', '維修人員', '預約日期', '完成日期', '結案狀態'];
  }

  function buildRows(caseType, items, stores) {
    if (caseType === '工程') {
      return items.map(mapProjectRow);
    }
    if (caseType === '維修') {
      return items.map(function (c) { return mapRepairRow(c, stores); });
    }
    return items.map(function (c) { return mapMaintenanceRow(c, stores); });
  }

  function escapeCsvCell(value) {
    var text = value == null ? '' : String(value);
    if (/[",\n\r]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function rowsToCsv(columns, rows) {
    var lines = [columns.join(',')];
    rows.forEach(function (row) {
      lines.push(columns.map(function (col) {
        return escapeCsvCell(row[col]);
      }).join(','));
    });
    return '\uFEFF' + lines.join('\n');
  }

  function downloadCsv(filename, content) {
    var blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  window.DataRetrievalUtils = {
    CASE_TYPES: CASE_TYPES,
    filterProjectCases: filterProjectCases,
    filterRepairCases: filterRepairCases,
    filterMaintenanceCases: filterMaintenanceCases,
    getStoreOptionsForCustomers: getStoreOptionsForCustomers,
    getDistrictOptionsForCities: getDistrictOptionsForCities,
    formatAssignees: formatAssignees,
    getColumns: getColumns,
    buildRows: buildRows,
    rowsToCsv: rowsToCsv,
    downloadCsv: downloadCsv
  };
})();
