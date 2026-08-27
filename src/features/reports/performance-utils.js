/*
 * features/reports/performance-utils.js — 案件績效統計計算
 */
(function () {
  'use strict';

  function formatLocalDate(d) {
    var y = d.getFullYear();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return y + '-' + m + '-' + day;
  }

  function getQuarterRange(date) {
    var d = date || new Date();
    var month = d.getMonth();
    var quarter = Math.floor(month / 3);
    var year = d.getFullYear();
    var startMonth = quarter * 3;
    var start = new Date(year, startMonth, 1);
    var end = new Date(year, startMonth + 3, 0);
    return {
      start: formatLocalDate(start),
      end: formatLocalDate(end),
      label: year + ' 年第 ' + (quarter + 1) + ' 季'
    };
  }

  function getQuarterMonths(quarterRange) {
    var start = new Date(quarterRange.start + 'T00:00:00');
    var m = start.getMonth() + 1;
    return [m, m + 1, m + 2];
  }

  function isDateInRange(dateStr, start, end) {
    return !!dateStr && dateStr >= start && dateStr <= end;
  }

  function toDateKey(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
  }

  function achievementRate(completed, target) {
    var t = Number(target) || 0;
    if (t <= 0) return 0;
    return Math.round(((Number(completed) || 0) / t) * 100);
  }

  // 案件的設備等級來自建案當下的設備快照（設備管理設定），不再反查設備分類
  function getCaseEquipmentLevels(c) {
    return RepairCaseServiceItems.getEquipments(c).map(function (eq) {
      return EquipmentUtils.getLevel(eq);
    });
  }

  // 積分是案件層級的加總，故任一設備為增額設備即整案適用
  function isAddOnEquipmentCase(c) {
    return getCaseEquipmentLevels(c).some(function (level) {
      return level === '增額設備';
    });
  }

  // 服務等級勾選「計算增額積分」者一律計分；未勾選者僅在設備為增額設備時計分
  function isBonusEligible(c, serviceLevels) {
    return ServiceLevelUtils.countsBonusPoints(serviceLevels, c && c.serviceLevel)
      || isAddOnEquipmentCase(c);
  }

  function getRepairCaseDate(c) {
    return toDateKey((c && (c.completionDate || c.repairDate)) || '');
  }

  function getMaintenanceCaseDate(c) {
    if (!c) return '';
    return toDateKey(
      c.completionDate || c.closeDate || c.repairDate || c.planDate || ''
    );
  }

  /**
   * 加總保養分配的目標完成數。
   * opts: { months, year, assigneeId, customerName }
   * 保養分配自「年度快照」後每年一份，格子帶 year；opts.year 未給時不過濾年份
   * （維持既有呼叫相容），給了就只計該年度，年份一律以 Number() 比對。
   */
  function sumAllocationTargets(allocations, opts) {
    opts = opts || {};
    var months = opts.months || [];
    var monthSet = {};
    months.forEach(function (m) { monthSet[m] = true; });
    var total = 0;
    (allocations || []).forEach(function (row) {
      if (!monthSet[row.month]) return;
      if (opts.year != null && Number(row.year) !== Number(opts.year)) return;
      if (opts.assigneeId && row.assigneeId !== opts.assigneeId) return;
      if (opts.customerName && row.customerName !== opts.customerName) return;
      total += Number(row.targetCount) || 0;
    });
    return total;
  }

  function getCaseArea(record, stores) {
    if (!record) return '';
    var store = (stores || []).find(function (s) {
      return StoreUtils.matchesStoreRecord(record, s);
    });
    if (store) return StoreUtils.getStoreArea(store);
    return StoreUtils.getRecordArea(record) || '';
  }

  // 只有「已處理」的處理方式計入積分（舊資料無 status 視為已處理）；跨所有設備卡片加總。
  function sumProcessPoints(c) {
    var total = 0;
    RepairCaseServiceItems.getAllProcessRecords(c).forEach(function (r) {
      if (!ProcessMethodUtils.isCaseRecordDone(r)) return;
      var points = Number(r.points) || 0;
      var qty = Number(r.qty) > 0 ? Number(r.qty) : 1;
      total += points * qty;
    });
    return total;
  }

  function computeAssigneePerformance(input) {
    var cases = input.cases || [];
    var maintenanceCases = input.maintenanceCases || [];
    var assignees = input.assignees || [];
    var allocations = input.allocations || [];
    var serviceLevels = input.serviceLevels || [];
    var accounts = input.accounts || [];
    var quarter = input.quarter;
    var months = getQuarterMonths(quarter);
    // 積分依「指派人員」的職務比例分到各組，需要帳號主檔（職務）與組別主檔（成員）。
    var assigneeProfiles = input.assigneeProfiles || assignees;
    var bonusContext = accounts.length
      ? { accounts: accounts, assignees: assigneeProfiles }
      : null;

    return assignees.map(function (assignee) {
      var completed = 0;
      maintenanceCases.forEach(function (c) {
        if (!c.isPerformanceIncluded) return;
        if (!isDateInRange(getMaintenanceCaseDate(c), quarter.start, quarter.end)) return;
        if (AssigneeUtils.getPerformanceAssignee(c) !== assignee.name) return;
        completed++;
      });

      var bonusPoints = 0;
      cases.forEach(function (c) {
        if (!c.isPerformanceIncluded) return;
        if (!isDateInRange(getRepairCaseDate(c), quarter.start, quarter.end)) return;
        if (!isBonusEligible(c, serviceLevels)) return;
        bonusPoints += CaseAssigneeUtils.computeBonusPointsForAssignee(c, assignee.name, bonusContext);
      });

      var target = sumAllocationTargets(allocations, {
        months: months,
        year: Number(String(quarter.start).slice(0, 4)),
        assigneeId: assignee.id
      });

      return {
        id: assignee.id,
        name: assignee.name,
        target: target,
        completed: completed,
        bonusPoints: bonusPoints,
        rate: achievementRate(completed, target)
      };
    });
  }

  function computeRegionPerformance(input) {
    var maintenanceCases = input.maintenanceCases || [];
    var stores = input.stores || [];
    var performanceAreas = input.performanceAreas || [];
    var allocations = input.allocations || [];
    var quarter = input.quarter;
    var months = getQuarterMonths(quarter);
    // 客戶主檔；用來剔除沒有設定保養次數（保養區間）的客戶。
    // 未傳入時代表呼叫端不做這個過濾，全部保留。
    var customerProfiles = input.customers || [];

    // 沒有任何可用保養區間的客戶，本來就不會有保養案件，
    // 留在績效統計裡只是一張永遠 0% 的空卡。
    function hasMaintenanceVisits(customerName) {
      if (!customerProfiles.length) return true;
      return CustomerUtils.getPeriods(customerProfiles, customerName).length > 0;
    }

    function districtSet(districts) {
      var set = {};
      (districts || []).forEach(function (d) { set[d] = true; });
      return set;
    }

    function customersInArea(areaDistricts) {
      var set = districtSet(areaDistricts);
      var names = {};
      (stores || []).forEach(function (store) {
        var area = StoreUtils.getStoreArea(store);
        if (!set[area]) return;
        if (store.customerName) names[store.customerName] = true;
      });
      return Object.keys(names).filter(hasMaintenanceVisits).sort(function (a, b) {
        return a.localeCompare(b, 'zh-Hant');
      });
    }

    function completedForCustomerInArea(customerName, areaDistricts) {
      var set = districtSet(areaDistricts);
      var count = 0;
      maintenanceCases.forEach(function (c) {
        if (!c.isPerformanceIncluded) return;
        if (c.customerName !== customerName) return;
        if (!isDateInRange(getMaintenanceCaseDate(c), quarter.start, quarter.end)) return;
        var area = getCaseArea(c, stores);
        if (!set[area]) return;
        count++;
      });
      return count;
    }

    return (performanceAreas || []).slice().sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
    }).map(function (pa) {
      var customerNames = customersInArea(pa.districts);
      var customers = customerNames.map(function (customerName) {
        var target = sumAllocationTargets(allocations, {
          months: months,
          year: Number(String(quarter.start).slice(0, 4)),
          customerName: customerName
        });
        var completed = completedForCustomerInArea(customerName, pa.districts);
        return {
          customerName: customerName,
          target: target,
          completed: completed,
          rate: achievementRate(completed, target)
        };
      });

      var target = 0;
      var completed = 0;
      customers.forEach(function (row) {
        target += row.target;
        completed += row.completed;
      });

      return {
        id: pa.id,
        name: pa.name,
        target: target,
        completed: completed,
        rate: achievementRate(completed, target),
        customers: customers
      };
    });
  }


  // --- 圖卡「查看」用：把統計數字還原成一列一案件的明細 ---

  // 卡片上的數字與這裡的列表必須同源，否則點進去會對不起來：
  // 保養沿用「完成店數」的條件，增額沿用「增額積分」的條件（分到本組 > 0 才算）。
  function buildPerformanceCaseRow(record, sourceType, stores) {
    var isMaintenance = sourceType === 'maintenance';
    return {
      id: record.id,
      sourceType: sourceType,
      source: record,
      // 保養單沒有案件編號，欄位留空（規格）
      caseNumber: isMaintenance ? '' : (record.caseNumber || ''),
      customerName: record.customerName || '',
      storeName: record.storeName || '',
      serviceLevel: record.serviceLevel || '',
      area: getCaseArea(record, stores),
      workCategory: isMaintenance ? '例行保養' : (record.workCategory || ''),
      repairItem: isMaintenance ? '' : (record.repairItem || ''),
      repairReason: isMaintenance ? '' : (record.repairReason || ''),
      actualReason: window.RepairCaseServiceItems
        ? RepairCaseServiceItems.formatActualReasonSummary(record)
        : '',
      assigneeText: AssigneeUtils.getPerformanceAssigneeNames(record).join('、'),
      // 叫修案件才有處理方式積分；保養單沒有服務項目卡片，欄位留空
      points: isMaintenance ? null : sumProcessPoints(record),
      closeDate: isMaintenance ? getMaintenanceCaseDate(record) : getRepairCaseDate(record)
    };
  }

  function sortRowsByCloseDateDesc(rows) {
    return rows.sort(function (a, b) {
      return String(b.closeDate || '').localeCompare(String(a.closeDate || ''));
    });
  }

  /**
   * 某組別當季的完成案件明細（保養案件 + 有分到本組積分的增額案件）。
   * input 與 computeAssigneePerformance 相同，另加 stores、assigneeName。
   */
  function collectAssigneeQuarterCases(input) {
    var cases = input.cases || [];
    var maintenanceCases = input.maintenanceCases || [];
    var serviceLevels = input.serviceLevels || [];
    var accounts = input.accounts || [];
    var stores = input.stores || [];
    var quarter = input.quarter;
    var assigneeName = input.assigneeName;
    var bonusContext = accounts.length
      ? { accounts: accounts, assignees: input.assigneeProfiles || [] }
      : null;
    var rows = [];

    maintenanceCases.forEach(function (c) {
      if (!c.isPerformanceIncluded) return;
      if (!isDateInRange(getMaintenanceCaseDate(c), quarter.start, quarter.end)) return;
      if (AssigneeUtils.getPerformanceAssignee(c) !== assigneeName) return;
      rows.push(buildPerformanceCaseRow(c, 'maintenance', stores));
    });

    cases.forEach(function (c) {
      if (!c.isPerformanceIncluded) return;
      if (!isDateInRange(getRepairCaseDate(c), quarter.start, quarter.end)) return;
      if (!isBonusEligible(c, serviceLevels)) return;
      if (CaseAssigneeUtils.computeBonusPointsForAssignee(c, assigneeName, bonusContext) <= 0) return;
      rows.push(buildPerformanceCaseRow(c, 'repair', stores));
    });

    return sortRowsByCloseDateDesc(rows);
  }

  /**
   * 績效區域內某客戶當季「已完成」的保養案件明細。
   * 條件與卡片的完成店數一致（isPerformanceIncluded），點進來的筆數才對得上。
   */
  function collectRegionCustomerQuarterCases(input) {
    var maintenanceCases = input.maintenanceCases || [];
    var stores = input.stores || [];
    var quarter = input.quarter;
    var customerName = input.customerName;
    var set = {};
    (input.areaDistricts || []).forEach(function (d) { set[d] = true; });

    var rows = maintenanceCases.filter(function (c) {
      if (!c.isPerformanceIncluded) return false;
      if (c.customerName !== customerName) return false;
      if (!isDateInRange(getMaintenanceCaseDate(c), quarter.start, quarter.end)) return false;
      return !!set[getCaseArea(c, stores)];
    }).map(function (c) {
      return buildPerformanceCaseRow(c, 'maintenance', stores);
    });

    return sortRowsByCloseDateDesc(rows);
  }

  /**
   * 當季保養目標店數的客戶明細（總店數 100，星巴克 50 / 萊爾富 20…）。
   * opts 同 sumAllocationTargets。
   */
  function getAllocationTargetBreakdown(allocations, opts) {
    opts = opts || {};
    var months = opts.months || [];
    var monthSet = {};
    months.forEach(function (m) { monthSet[m] = true; });
    var byCustomer = {};
    var total = 0;
    (allocations || []).forEach(function (row) {
      if (!monthSet[row.month]) return;
      if (opts.year != null && Number(row.year) !== Number(opts.year)) return;
      if (opts.assigneeId && row.assigneeId !== opts.assigneeId) return;
      if (opts.customerName && row.customerName !== opts.customerName) return;
      var count = Number(row.targetCount) || 0;
      if (!count) return;
      byCustomer[row.customerName] = (byCustomer[row.customerName] || 0) + count;
      total += count;
    });
    var items = Object.keys(byCustomer).sort(function (a, b) {
      return a.localeCompare(b, 'zh-Hant');
    }).map(function (name) {
      return { customerName: name, target: byCustomer[name] };
    });
    return { total: total, items: items };
  }

  window.PerformanceUtils = {
    getQuarterRange: getQuarterRange,
    getQuarterMonths: getQuarterMonths,
    achievementRate: achievementRate,
    getCaseEquipmentLevels: getCaseEquipmentLevels,
    isAddOnEquipmentCase: isAddOnEquipmentCase,
    isBonusEligible: isBonusEligible,
    toDateKey: toDateKey,
    getRepairCaseDate: getRepairCaseDate,
    getMaintenanceCaseDate: getMaintenanceCaseDate,
    sumAllocationTargets: sumAllocationTargets,
    getCaseArea: getCaseArea,
    sumProcessPoints: sumProcessPoints,
    computeAssigneePerformance: computeAssigneePerformance,
    computeRegionPerformance: computeRegionPerformance,
    collectAssigneeQuarterCases: collectAssigneeQuarterCases,
    collectRegionCustomerQuarterCases: collectRegionCustomerQuarterCases,
    getAllocationTargetBreakdown: getAllocationTargetBreakdown
  };
})();
