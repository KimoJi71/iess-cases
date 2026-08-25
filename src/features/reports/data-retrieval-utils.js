/*
 * features/reports/data-retrieval-utils.js — 資料調閱：篩選、欄位定義與 CSV 匯出
 */
(function () {
  'use strict';

  var CASE_TYPES = ['維修', '保養', '工程'];

  // 門市名稱會跨客戶重複（中山店同時屬於星巴克、全家、統一超商），行政區也會跨縣市重複
  // （中正區見於台北市、基隆市、台中市）。篩選值改用「上層\u0001下層」複合鍵，
  // 分隔字元選 \u0001 是因為它不可能出現在任何客戶、門市、縣市、行政區名稱裡。
  var KEY_SEP = '\u0001';

  function makeKey(parent, child) {
    return String(parent == null ? '' : parent) + KEY_SEP + String(child == null ? '' : child);
  }

  function parseKey(key) {
    var text = String(key == null ? '' : key);
    var idx = text.indexOf(KEY_SEP);
    if (idx === -1) return { parent: '', child: text };
    return { parent: text.slice(0, idx), child: text.slice(idx + 1) };
  }

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
      if (!matches(filters.store, makeKey(c.customerName, c.storeName))) return false;
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
      if (!matches(filters.district, makeKey(loc.city, loc.district))) return false;
      if (!matches(filters.customer, c.customerName)) return false;
      // 保養單的組別改多選後，任一已選組別命中即通過
      if (!isAny(filters.assignee)) {
        var hit = filters.assignee.some(function (name) {
          return window.CaseAssigneeUtils
            ? CaseAssigneeUtils.includesAssignee(c, name)
            : c.assignee === name;
        });
        if (!hit) return false;
      }
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

  // 門市選項依客戶分組：每個客戶一個群組，選項值為「客戶\u0001門市」複合鍵，
  // 讓跨客戶同名門市成為彼此獨立的選項。未選客戶時列出所有客戶的群組。
  // 群組內沿用 StoreUtils 的慣例：營業中門市在前、撤店門市在後，各自再依 zh-Hant 排序。
  function getStoreGroupsForCustomers(stores, customerNames) {
    var list = stores || [];
    var scope;
    if (customerNames && customerNames.length) {
      scope = customerNames.slice();
    } else {
      scope = list.map(function (s) { return s.customerName; });
    }
    var seenCustomer = {};
    scope = scope.filter(function (name) {
      if (!name || seenCustomer[name]) return false;
      seenCustomer[name] = true;
      return true;
    });
    sortZhHant(scope);

    return scope.map(function (customerName) {
      // 同一客戶下可能有多筆同名門市紀錄；任一筆營業中即視為營業中。
      var activeByName = {};
      list.forEach(function (s) {
        if (s.customerName !== customerName || !s.storeName) return;
        if (activeByName[s.storeName] !== true) {
          activeByName[s.storeName] = StoreUtils.isActiveStore(s);
        }
      });
      var names = Object.keys(activeByName).sort(function (a, b) {
        if (activeByName[a] !== activeByName[b]) return activeByName[a] ? -1 : 1;
        return a.localeCompare(b, 'zh-Hant');
      });
      return {
        group: customerName,
        options: names.map(function (name) {
          return {
            value: makeKey(customerName, name),
            label: name,
            chipLabel: customerName + ' · ' + name
          };
        })
      };
    }).filter(function (g) { return g.options.length > 0; });
  }

  // 行政區選項依縣市分組，選項值為「縣市\u0001行政區」複合鍵。
  // 未選縣市時列出所有縣市，與門市的規則一致；群組順序一律沿用 TAIWAN_CITY_OPTIONS。
  function getDistrictGroupsForCities(cityNames) {
    var selected = cityNames || [];
    var cities = selected.length
      ? TAIWAN_CITY_OPTIONS.filter(function (c) { return selected.indexOf(c) !== -1; })
      : TAIWAN_CITY_OPTIONS.slice();
    var groups = [];
    cities.forEach(function (city) {
      var districts = StoreUtils.getDistrictsForCity(city) || [];
      if (!districts.length) return;
      groups.push({
        group: city,
        options: districts.map(function (d) {
          return { value: makeKey(city, d), label: d, chipLabel: city + ' · ' + d };
        })
      });
    });
    return groups;
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

  // 實際原因已改成逐設備卡片，匯出報表沿用一列一案件的格式，彙整所有卡片文字
  function getActualReasonSummary(c) {
    if (!c || !window.RepairCaseServiceItems) return '';
    return RepairCaseServiceItems.getItems(c).map(function (it) {
      return it.actualReason;
    }).filter(Boolean).join('、');
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
      '實際原因': getActualReasonSummary(c) || '—',
      '維修人員': formatAssignees(c),
      '處理狀態': c.processStatus || '未處理',
      // 後續處理（待報價／轉汰換／轉原廠）的結果；匯出為扁平表格，欄名不隨處理狀態浮動。
      '後續處理狀態': c.followUpStatus || '—',
      '後續處理時間': c.followUpStatusAt ? IESS.caseDateTime.format(c.followUpStatusAt) : '—',
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
      '維修人員': formatAssignees(c),
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
      return ['叫修時間', '案件編號', '客戶名稱', '門市名稱', '公司區域', '客戶分級', '工項分類', '叫修項目', '叫修原因', '故障描述', '實際原因', '維修人員', '處理狀態', '後續處理狀態', '後續處理時間', '結案狀態', '結案日期'];
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
    makeKey: makeKey,
    parseKey: parseKey,
    filterProjectCases: filterProjectCases,
    filterRepairCases: filterRepairCases,
    filterMaintenanceCases: filterMaintenanceCases,
    getStoreGroupsForCustomers: getStoreGroupsForCustomers,
    getDistrictGroupsForCities: getDistrictGroupsForCities,
    formatAssignees: formatAssignees,
    getColumns: getColumns,
    buildRows: buildRows,
    rowsToCsv: rowsToCsv,
    downloadCsv: downloadCsv
  };
})();
