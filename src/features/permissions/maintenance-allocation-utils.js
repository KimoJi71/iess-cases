/*
 * features/permissions/maintenance-allocation-utils.js — 保養分配：客戶列、驗證、CRUD 輔助
 */
(function () {
  'use strict';

  function isAllocatableServiceLevel(level, serviceLevels) {
    return ServiceLevelUtils.isAllocatable(serviceLevels, level);
  }

  /**
   * 區段是唯一真相：格子上存的 visitIndex 只是寫入當下的快取，重新同步後可能過期
   * （例：A(4次) 降為 B(2次) 後，原本第 3 次的 8 月落進新的第 2 次區段）。
   * 呼叫端若知道該月所屬區段，請傳入 effectiveVisitIndex，畫面才會與區段一致。
   */
  function formatCellLabel(allocation, effectiveVisitIndex) {
    if (!allocation) return '';
    var visitIndex = effectiveVisitIndex != null ? effectiveVisitIndex : allocation.visitIndex;
    return '第' + visitIndex + '次 ' + allocation.targetCount;
  }

  function getCoveredStoresForAssignee(stores, assignee, customerName, serviceLevels) {
    return (stores || []).filter(function (s) {
      if (customerName && s.customerName !== customerName) return false;
      if (!StoreUtils.isActiveStore(s)) return false;
      if (!isAllocatableServiceLevel(s.serviceLevel, serviceLevels)) return false;
      var area = StoreUtils.getStoreArea(s);
      return StoreUtils.assigneeCoversArea(assignee, area);
    });
  }

  /**
   * 列的服務等級（決定月份區間切段）採客戶身上的等級為準；門市身上的等級只用來
   * 篩選該指派人員負責、且服務等級仍納入保養分配的門市數。兩者理論上應一致
   * （門市儲存時會從所屬客戶同步），但客戶等級被改到「不納入保養分配」後、
   * 門市尚未重新儲存前會短暫不一致——此時以客戶等級為準整列不顯示，
   * 避免產生「有列但無區間可點」的死列。
   * @returns {Array<{ customerName, storeCount, serviceLevel }>}
   */
  function getCustomerRows(assignee, customers, stores, serviceLevels) {
    if (!assignee) return [];
    var byCustomer = {};
    getCoveredStoresForAssignee(stores, assignee, null, serviceLevels).forEach(function (s) {
      if (!byCustomer[s.customerName]) byCustomer[s.customerName] = 0;
      byCustomer[s.customerName] += 1;
    });
    var rows = [];
    Object.keys(byCustomer).forEach(function (name) {
      var cust = (customers || []).find(function (c) { return c.name === name; });
      var level = (cust && cust.serviceLevel) || '';
      if (!ServiceLevelUtils.isAllocatable(serviceLevels, level)) return;
      rows.push({
        customerName: name,
        storeCount: byCustomer[name],
        serviceLevel: level
      });
    });
    rows.sort(function (a, b) {
      return a.customerName.localeCompare(b.customerName, 'zh-Hant');
    });
    return rows;
  }

  /**
   * 該區間月份內、該指派人員 × 該客戶、已結案保養案件的不重複門市數。
   * 日期取 completionDate，無則取 planDate；年份限定為傳入的 year。
   */
  function countCompletedStores(maintenanceCases, assignee, customerName, period, year) {
    if (!period) return 0;
    var yearPrefix = String(year);
    var start = Number(period.startMonth);
    var end = Number(period.endMonth);
    var seen = {};
    (maintenanceCases || []).forEach(function (c) {
      if (!c || !c.isClosed) return;
      if (c.customerName !== customerName) return;
      if (AssigneeUtils.getPerformanceAssignee(c) !== assignee) return;
      var dateStr = String(c.completionDate || c.planDate || '');
      if (dateStr.slice(0, 4) !== yearPrefix) return;
      var month = Number(dateStr.slice(5, 7));
      if (!(month >= start && month <= end)) return;
      if (c.storeName) seen[c.storeName] = true;
    });
    return Object.keys(seen).length;
  }

  /**
   * 年度快照：把「哪些客戶入列、負責幾間門市、當時的服務等級與保養區間」凍結下來。
   * 之後客戶改服務等級或區間都不影響已建立的年度，除非明確呼叫 resyncYear。
   * @param {string} today 'YYYY-MM-DD'，由呼叫端傳入（utils 不取現在時間，便於測試）
   */
  function buildYearSnapshot(year, assignees, customers, stores, serviceLevels, today) {
    var rows = [];
    (assignees || []).forEach(function (assignee) {
      getCustomerRows(assignee, customers, stores, serviceLevels).forEach(function (row) {
        rows.push({
          assigneeId: assignee.id,
          customerName: row.customerName,
          serviceLevel: row.serviceLevel,
          storeCount: Number(row.storeCount) || 0,
          periods: CustomerUtils.getPeriods(customers, row.customerName).map(function (p) {
            return {
              visitIndex: Number(p.visitIndex),
              startMonth: Number(p.startMonth),
              endMonth: Number(p.endMonth)
            };
          })
        });
      });
    });
    return { year: Number(year), createdAt: today || '', syncedAt: '', rows: rows };
  }

  function findYearSnapshot(years, year) {
    return (years || []).find(function (y) {
      return Number(y.year) === Number(year);
    }) || null;
  }

  function listYears(years) {
    return (years || []).map(function (y) { return Number(y.year); })
      .sort(function (a, b) { return b - a; });
  }

  function getSnapshotRows(snapshot, assigneeId) {
    if (!snapshot) return [];
    return (snapshot.rows || []).filter(function (r) {
      return r.assigneeId === assigneeId;
    }).sort(function (a, b) {
      return String(a.customerName).localeCompare(String(b.customerName), 'zh-Hant');
    });
  }

  // 月份 → { period, order }；order 供區段底色交替使用
  function buildSegmentMap(row) {
    var map = {};
    ((row && row.periods) || []).forEach(function (p, order) {
      for (var m = Number(p.startMonth); m <= Number(p.endMonth); m++) {
        map[m] = { period: p, order: order };
      }
    });
    return map;
  }

  function findPeriodInRow(row, month) {
    var m = Number(month);
    return ((row && row.periods) || []).find(function (p) {
      return m >= Number(p.startMonth) && m <= Number(p.endMonth);
    }) || null;
  }

  function snapshotRowKey(row) {
    return row.assigneeId + '|' + row.customerName;
  }

  function periodsEqual(a, b) {
    var x = a || [], y = b || [];
    if (x.length !== y.length) return false;
    for (var i = 0; i < x.length; i++) {
      if (Number(x[i].visitIndex) !== Number(y[i].visitIndex)) return false;
      if (Number(x[i].startMonth) !== Number(y[i].startMonth)) return false;
      if (Number(x[i].endMonth) !== Number(y[i].endMonth)) return false;
    }
    return true;
  }

  /**
   * 比對快照與現行主檔，供「主檔已變動」提示與同步前摘要使用。
   * 只比對列的存在與 storeCount／serviceLevel／periods，不比對格子。
   */
  function diffSnapshot(snapshot, assignees, customers, stores, serviceLevels) {
    var currentRows = buildYearSnapshot(
      snapshot ? snapshot.year : 0, assignees, customers, stores, serviceLevels, ''
    ).rows;
    var oldRows = (snapshot && snapshot.rows) || [];
    var oldMap = {}, newMap = {};
    oldRows.forEach(function (r) { oldMap[snapshotRowKey(r)] = r; });
    currentRows.forEach(function (r) { newMap[snapshotRowKey(r)] = r; });

    var added = [], removed = [], changed = [];
    currentRows.forEach(function (r) {
      if (!oldMap[snapshotRowKey(r)]) {
        added.push({ assigneeId: r.assigneeId, customerName: r.customerName });
      }
    });
    oldRows.forEach(function (r) {
      var next = newMap[snapshotRowKey(r)];
      if (!next) {
        removed.push({ assigneeId: r.assigneeId, customerName: r.customerName });
        return;
      }
      if (Number(r.storeCount) !== Number(next.storeCount)
        || r.serviceLevel !== next.serviceLevel
        || !periodsEqual(r.periods, next.periods)) {
        changed.push({
          assigneeId: r.assigneeId,
          customerName: r.customerName,
          from: { storeCount: Number(r.storeCount), serviceLevel: r.serviceLevel, periods: r.periods },
          to: { storeCount: Number(next.storeCount), serviceLevel: next.serviceLevel, periods: next.periods }
        });
      }
    });
    return { added: added, removed: removed, changed: changed };
  }

  function hasSnapshotDiff(diff) {
    if (!diff) return false;
    return !!(diff.added.length || diff.removed.length || diff.changed.length);
  }

  function formatDiffSummary(diff) {
    if (!hasSnapshotDiff(diff)) return '';
    var parts = [];
    if (diff.added.length) parts.push('新增 ' + diff.added.length + ' 列');
    if (diff.removed.length) parts.push('移除 ' + diff.removed.length + ' 列');
    if (diff.changed.length) parts.push(diff.changed.length + ' 列設定變動');
    return parts.join('、');
  }

  /**
   * 以現行主檔重拍該年度的骨架。格子不動，故同步後可能出現孤兒格（見 isOrphanAllocation）。
   */
  function resyncYear(snapshot, assignees, customers, stores, serviceLevels, today) {
    if (!snapshot) return null;
    var next = buildYearSnapshot(snapshot.year, assignees, customers, stores, serviceLevels, today);
    return {
      year: Number(snapshot.year),
      createdAt: snapshot.createdAt || '',
      syncedAt: today || '',
      rows: next.rows
    };
  }

  /** 該格所屬的列已不在快照中，或月份不落在該列任一區間內 */
  function isOrphanAllocation(allocation, snapshot) {
    if (!allocation || !snapshot) return false;
    if (Number(allocation.year) !== Number(snapshot.year)) return false;
    var row = (snapshot.rows || []).find(function (r) {
      return r.assigneeId === allocation.assigneeId && r.customerName === allocation.customerName;
    });
    if (!row) return true;
    return !findPeriodInRow(row, allocation.month);
  }

  /**
   * 該年度、該指派人員底下「整列已從快照消失」（客戶降級、門市全關、指派人員轄區變動）
   * 的孤兒格，依客戶分組。這些格子在正常的網格列裡找不到位置，必須另外以唯讀列渲染，
   * 否則使用者看不見也刪不掉，卻仍留在資料裡。
   * @returns {Array<{ customerName, cells: Array }>} 客戶依 zh-Hant 排序、格子依月份排序
   */
  function getRemovedRowGroups(allocations, snapshot, assigneeId) {
    if (!snapshot || !assigneeId) return [];
    var groups = {};
    (allocations || []).forEach(function (a) {
      if (Number(a.year) !== Number(snapshot.year)) return;
      if (a.assigneeId !== assigneeId) return;
      var row = (snapshot.rows || []).find(function (r) {
        return r.assigneeId === a.assigneeId && r.customerName === a.customerName;
      });
      if (row) return;
      if (!groups[a.customerName]) groups[a.customerName] = [];
      groups[a.customerName].push(a);
    });
    return Object.keys(groups).sort(function (a, b) {
      return String(a).localeCompare(String(b), 'zh-Hant');
    }).map(function (name) {
      return {
        customerName: name,
        cells: groups[name].slice().sort(function (x, y) {
          return Number(x.month) - Number(y.month);
        })
      };
    });
  }

  function countOrphans(allocations, snapshot) {
    if (!snapshot) return 0;
    var n = 0;
    (allocations || []).forEach(function (a) {
      if (isOrphanAllocation(a, snapshot)) n += 1;
    });
    return n;
  }

  function findAllocation(allocations, year, assigneeId, customerName, month) {
    return (allocations || []).find(function (a) {
      return Number(a.year) === Number(year) &&
        a.assigneeId === assigneeId &&
        a.customerName === customerName &&
        Number(a.month) === Number(month);
    }) || null;
  }

  /**
   * 加總同一區段（第 N 次）已填的目標完成數。
   * 傳入 row 時以「該月在 row 裡所屬區間的 visitIndex」分組（區段為唯一真相，
   * 格子上過期的 visitIndex 不算數，落在所有區間外的孤兒格一律不計入任何區段）；
   * 未傳 row 則退回格子上存的 visitIndex。
   */
  function sumVisitIndexTotal(allocations, year, assigneeId, customerName, visitIndex, excludeMonth, row) {
    var sum = 0;
    (allocations || []).forEach(function (a) {
      if (Number(a.year) !== Number(year)) return;
      if (a.assigneeId !== assigneeId) return;
      if (a.customerName !== customerName) return;
      var effective = a.visitIndex;
      if (row) {
        var period = findPeriodInRow(row, a.month);
        if (!period) return;
        effective = period.visitIndex;
      }
      if (Number(effective) !== Number(visitIndex)) return;
      if (excludeMonth != null && Number(a.month) === Number(excludeMonth)) return;
      sum += Number(a.targetCount) || 0;
    });
    return sum;
  }

  /**
   * @returns {string[]} 警示／提示文案（可為空）
   */
  function buildSaveWarnings(params) {
    var storeCount = Number(params.storeCount) || 0;
    var targetCount = Number(params.targetCount) || 0;
    var visitIndex = Number(params.visitIndex);
    var month = Number(params.month);
    var warnings = [];

    if (targetCount > storeCount) {
      warnings.push('本月數量超過負責門市數（' + targetCount + '／' + storeCount + '）');
    }

    var otherSum = sumVisitIndexTotal(
      params.allocations, params.year, params.assigneeId, params.customerName,
      visitIndex, month, params.row
    );
    var total = otherSum + targetCount;
    if (total !== storeCount) {
      var kind = total < storeCount ? '不足' : '超量';
      warnings.push(
        '第' + visitIndex + '次合計與負責門市數不符（目前 ' + total + '／應為 ' + storeCount + '，' + kind + '）'
      );
    }
    return warnings;
  }

  function upsertAllocation(allocations, record) {
    var list = (allocations || []).slice();
    var idx = list.findIndex(function (a) {
      return Number(a.year) === Number(record.year) &&
        a.assigneeId === record.assigneeId &&
        a.customerName === record.customerName &&
        Number(a.month) === Number(record.month);
    });
    if (idx >= 0) {
      list[idx] = Object.assign({}, list[idx], {
        visitIndex: Number(record.visitIndex),
        targetCount: Number(record.targetCount)
      });
    } else {
      list.push({
        id: record.id || ('MA' + Date.now()),
        year: Number(record.year),
        assigneeId: record.assigneeId,
        customerName: record.customerName,
        month: Number(record.month),
        visitIndex: Number(record.visitIndex),
        targetCount: Number(record.targetCount)
      });
    }
    return list;
  }

  function removeAllocation(allocations, year, assigneeId, customerName, month) {
    return (allocations || []).filter(function (a) {
      return !(Number(a.year) === Number(year) &&
        a.assigneeId === assigneeId &&
        a.customerName === customerName &&
        Number(a.month) === Number(month));
    });
  }

  window.MaintenanceAllocationUtils = {
    isAllocatableServiceLevel: isAllocatableServiceLevel,
    formatCellLabel: formatCellLabel,
    getCoveredStoresForAssignee: getCoveredStoresForAssignee,
    getCustomerRows: getCustomerRows,
    countCompletedStores: countCompletedStores,
    buildYearSnapshot: buildYearSnapshot,
    findYearSnapshot: findYearSnapshot,
    listYears: listYears,
    getSnapshotRows: getSnapshotRows,
    buildSegmentMap: buildSegmentMap,
    findPeriodInRow: findPeriodInRow,
    diffSnapshot: diffSnapshot,
    hasSnapshotDiff: hasSnapshotDiff,
    formatDiffSummary: formatDiffSummary,
    resyncYear: resyncYear,
    isOrphanAllocation: isOrphanAllocation,
    getRemovedRowGroups: getRemovedRowGroups,
    countOrphans: countOrphans,
    findAllocation: findAllocation,
    sumVisitIndexTotal: sumVisitIndexTotal,
    buildSaveWarnings: buildSaveWarnings,
    upsertAllocation: upsertAllocation,
    removeAllocation: removeAllocation
  };
})();
