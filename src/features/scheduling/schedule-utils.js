/*
 * features/scheduling/schedule-utils.js — 待安排／已排程聚合、保養產生與更新
 */
(function () {
  'use strict';

  var CATEGORY_COLORS = {
    '保養': '#16a34a',
    '保養清潔': '#16a34a',
    '一般叫修': '#2563eb',
    '緊急叫修': '#ea580c',
    '新開': '#7c3aed',
    '汰換': '#7c3aed',
    '撤店': '#6b7280',
    '整裝': '#7c3aed',
    '加裝': '#7c3aed'
  };

  function formatScheduleEventTitle(workCategory, assignee, customerName, storeName, storeAddress, options) {
    options = options || {};
    var wc = workCategory || '其他';
    var lines = [
      '[' + wc + ']',
      assignee || '未指派',
      customerName || '',
      storeName || '',
      storeAddress || ''
    ];
    if (options.sourceType === 'repair' && options.equipmentName) {
      lines.push(options.equipmentName);
    }
    return lines.join('\n');
  }

  function getRepairEquipmentName(c) {
    if (!c || !c.equipment) return '';
    return c.equipment.deviceName || c.equipment.name || '';
  }

  function getProjectStoreAddress(c) {
    return (c.details && c.details.storeAddress) || c.storeAddress || '';
  }

  function collectProjectScheduleEntries(c) {
    var entries = [];
    var seen = {};

    function pushEntry(stageKey, sched, assignee) {
      if (!sched.planDate || !sched.planTimeStart) return;
      var key = sched.planDate + '|' + sched.planTimeStart + '|' + (assignee || '');
      if (seen[key]) return;
      seen[key] = true;
      entries.push({
        stageKey: stageKey,
        planDate: sched.planDate,
        planTimeStart: sched.planTimeStart,
        planTimeEnd: sched.planTimeEnd || '',
        assignee: assignee || c.stageAssignee || '',
        workCategory: c.workCategory
      });
    }

    pushEntry('current', {
      planDate: c.planDate,
      planTimeStart: c.planTimeStart,
      planTimeEnd: c.planTimeEnd
    }, c.stageAssignee);

    (c.history || []).forEach(function (entry) {
      pushEntry(entry.stage || ('stage-' + entries.length), {
        planDate: entry.date,
        planTimeStart: entry.timeStart,
        planTimeEnd: entry.timeEnd
      }, entry.assignee);
    });

    return entries;
  }

  function getMaintenanceWorkCategory(c) {
    return c.workCategory || '保養';
  }

  function getRepairSchedule(c) {
    var assignees = window.CaseAssigneeUtils
      ? CaseAssigneeUtils.getAssignees(c)
      : (c.assignee ? [c.assignee] : []);
    return {
      planDate: c.planDate || c.expectedDate || '',
      planTimeStart: c.planTimeStart || c.expectedTimeStart || '',
      planTimeEnd: c.planTimeEnd || c.expectedTimeEnd || '',
      assignee: window.CaseAssigneeUtils
        ? CaseAssigneeUtils.formatAssignees(c)
        : (c.assignee || ''),
      assignees: assignees,
      workCategory: c.workCategory
    };
  }

  function getProjectSchedule(c) {
    return {
      planDate: c.planDate || '',
      planTimeStart: c.planTimeStart || '',
      planTimeEnd: c.planTimeEnd || '',
      assignee: c.stageAssignee,
      workCategory: c.workCategory
    };
  }

  function formatTime24(timeStr) {
    if (!timeStr) return '';
    var parts = timeStr.split(':');
    return String(parseInt(parts[0], 10)).padStart(2, '0') + ':' +
      String(parseInt(parts[1] || '0', 10)).padStart(2, '0');
  }

  function formatTimeRange(start, end) {
    if (!start) return '';
    var s = formatTime24(start);
    var e = end ? formatTime24(end) : '';
    return e && e !== s ? s + ' ~ ' + e : s;
  }

  /**
   * 為既有保養案件補上區間身分（periodYear / periodVisitIndex）。
   * 用 planDate（或 dueMonth）的年月回推客戶區間；查不到就原樣保留，
   * 該筆案件之後不會被以區間為準的月份篩選命中。
   */
  function backfillCasePeriods(existingCases, customers) {
    return (existingCases || []).map(function (c) {
      if (!c) return c;
      if (Number(c.periodYear) && Number(c.periodVisitIndex)) return c;
      var period = resolveCasePeriod(c, customers);
      if (!period) return c;
      return Object.assign({}, c, {
        periodYear: period.year,
        periodVisitIndex: period.visitIndex
      });
    });
  }

  /**
   * 依客戶的保養區間產生保養單：每個門市在「參考月份所在的區間」各一筆。
   * 不論上一個區間是否完成，進入下一個區間都會重新建一筆。
   * referenceMonth 為選填的 'YYYY-MM'，省略時取當月。
   */
  function generateDueMaintenanceCases(customers, stores, existingCases, referenceMonth) {
    var refMonth = referenceMonth || new Date().toISOString().slice(0, 7);
    var refYear = parseInt(String(refMonth).slice(0, 4), 10);
    var monthNumber = parseInt(String(refMonth).slice(5, 7), 10);
    var result = backfillCasePeriods(existingCases, customers);
    if (!refYear || !monthNumber) return result;

    var customerMap = {};
    (customers || []).forEach(function (c) { customerMap[c.name] = c; });

    (stores || []).forEach(function (store) {
      if (store.storeStatus !== '正常營業') return;
      var cust = customerMap[store.customerName];
      if (!cust || cust.enabled === false) return;
      // 客戶設定「於開幕 N 個月後開始保養」時，未滿期的門市這一輪不開單。
      // 門市沒有開幕日期時同樣不開單（開幕日期為門市必填欄位）。
      if (!CustomerUtils.isMaintenanceStartedForMonth(customers, store, refMonth)) return;

      var period = CustomerUtils.findPeriodForMonth(customers, store.customerName, monthNumber);
      if (!period) return;

      var exists = result.some(function (m) {
        return m
          && m.customerName === store.customerName
          && m.storeName === store.storeName
          && Number(m.periodYear) === refYear
          && Number(m.periodVisitIndex) === period.visitIndex;
      });
      if (exists) return;

      result.push({
        id: 'M' + Date.now() + String(Math.floor(Math.random() * 10000)),
        caseNumber: '',
        customerName: store.customerName,
        storeName: store.storeName,
        companyCity: store.companyCity,
        companyDistrict: store.companyDistrict,
        serviceLevel: store.serviceLevel,
        status: '未保養',
        planDate: '',
        planTimeStart: '',
        planTimeEnd: '',
        dueMonth: refYear + '-' + padMonth(period.startMonth),
        periodYear: refYear,
        periodVisitIndex: period.visitIndex,
        workCategory: '保養',
        assignee: '尚未指派',
        isClosed: false,
        storeAddress: StoreUtils.buildFullAddress(store)
      });
    });
    return result;
  }

  function resolveStore(stores, customerName, storeName) {
    if (!stores) return null;
    return stores.find(function (s) {
      return s.customerName === customerName && s.storeName === storeName;
    }) || null;
  }

  function resolveStoreArea(stores, customerName, storeName) {
    var store = resolveStore(stores, customerName, storeName);
    return store ? StoreUtils.getStoreArea(store) : '';
  }

  function applyStoreSnapshot(record, stores) {
    var store = resolveStore(stores, record.customerName, record.storeName);
    if (!store) return record;
    return Object.assign({}, record, {
      companyCity: store.companyCity,
      companyDistrict: store.companyDistrict,
      serviceLevel: store.serviceLevel,
      storeAddress: StoreUtils.buildFullAddress(store)
    });
  }

  function getStoreNamesForCustomer(stores, customerName, selectedStoreName, includeClosed) {
    return StoreUtils.getStoreNameOptions(stores, customerName, selectedStoreName, includeClosed);
  }

  function getCustomerNamesFromStores(stores, customers, selectedName) {
    if (!stores) return [];
    var enabledNames = null;
    if (customers) {
      enabledNames = {};
      CustomerUtils.getEnabledCustomers(customers).forEach(function (c) {
        if (c.name) enabledNames[c.name] = true;
      });
    }
    var seen = {};
    var names = [];
    stores.forEach(function (s) {
      if (!s.customerName || seen[s.customerName]) return;
      if (enabledNames && !enabledNames[s.customerName] && s.customerName !== selectedName) return;
      seen[s.customerName] = true;
      names.push(s.customerName);
    });
    if (selectedName && !seen[selectedName]) {
      names.push(selectedName);
    }
    return names.sort(function (a, b) { return a.localeCompare(b, 'zh-Hant'); });
  }

  function resolveMaintenanceReferenceDate(maintenanceCase) {
    if (!maintenanceCase) return '';
    if (maintenanceCase.planDate) return maintenanceCase.planDate;
    if (maintenanceCase.dueMonth) return maintenanceCase.dueMonth + '-01';
    return '';
  }

  function padMonth(month) {
    return String(month).length < 2 ? '0' + month : String(month);
  }

  /**
   * 解析一筆保養案件所屬的保養區間。
   * 優先用案件自帶的 periodYear / periodVisitIndex（區間身分），
   * 舊案件沒有這兩個欄位時，退回用 planDate（或 dueMonth）的年月回推。
   * 客戶未設定區間、或月份落在所有區間之外時回 null。
   */
  function resolveCasePeriod(maintenanceCase, customers) {
    if (!maintenanceCase) return null;
    var customerName = maintenanceCase.customerName;
    var year = Number(maintenanceCase.periodYear) || 0;
    var visitIndex = Number(maintenanceCase.periodVisitIndex) || 0;

    if (year && visitIndex) {
      var found = CustomerUtils.getPeriods(customers, customerName).find(function (p) {
        return p.visitIndex === visitIndex;
      });
      if (!found) return null;
      return {
        year: year,
        visitIndex: visitIndex,
        startMonth: found.startMonth,
        endMonth: found.endMonth
      };
    }

    var refDate = resolveMaintenanceReferenceDate(maintenanceCase);
    if (!refDate) return null;
    var refYear = parseInt(String(refDate).slice(0, 4), 10);
    var refMonth = parseInt(String(refDate).slice(5, 7), 10);
    if (!refYear || !refMonth) return null;
    var period = CustomerUtils.findPeriodForMonth(customers, customerName, refMonth);
    if (!period) return null;
    return {
      year: refYear,
      visitIndex: period.visitIndex,
      startMonth: period.startMonth,
      endMonth: period.endMonth
    };
  }

  function formatPeriodRange(period) {
    if (!period) return '—';
    return '第' + period.visitIndex + '次 ' + period.startMonth + '-' + period.endMonth + '月';
  }

  function periodMonthRange(period) {
    if (!period) return null;
    return {
      start: period.year + '-' + padMonth(period.startMonth),
      end: period.year + '-' + padMonth(period.endMonth)
    };
  }

  // 案件是否帶有區間身分（產生時寫入的 periodYear / periodVisitIndex）。
  function hasPeriodIdentity(maintenanceCase) {
    return !!(maintenanceCase
      && Number(maintenanceCase.periodYear)
      && Number(maintenanceCase.periodVisitIndex));
  }

  /**
   * 案件所屬區間是否與篩選的月份範圍重疊。start / end 為 'YYYY-MM'，
   * 空字串代表該側無限制。
   * 有區間身分但解析不到區間者（客戶服務等級調降後尾端區間被砍掉）視為符合任何月份：
   * 這種案件在案件排程待辦仍存在且可排程，濾掉會讓它從保養計劃進度永久消失。
   * 完全沒有區間身分、客戶也未設定區間者維持排除。
   */
  function casePeriodMatchesMonthRange(maintenanceCase, customers, start, end) {
    var range = periodMonthRange(resolveCasePeriod(maintenanceCase, customers));
    if (!range) return hasPeriodIdentity(maintenanceCase);
    if (start && range.end < start) return false;
    if (end && range.start > end) return false;
    return true;
  }

  // 案件用於判斷「開始保養時間」的參考年月：優先取所屬區間的「結束年月」，
  // 解析不到區間時退回 planDate（或 dueMonth）的年月，兩者皆無時回空字串。
  // 取結束月是為了與產生端（用當月判斷）對齊：只要區間內有任何一個月已達起始
  // 保養月，產生端就會開單，列表端就必須看得到，否則會出現開了單卻永不顯示的
  // 孤兒案件（門市在區間中段開幕時必然發生），而該案件也就無法結案。
  function caseStartReferenceMonth(maintenanceCase, customers) {
    var period = resolveCasePeriod(maintenanceCase, customers);
    if (period) return period.year + '-' + padMonth(period.endMonth);
    var refDate = resolveMaintenanceReferenceDate(maintenanceCase);
    return refDate ? String(refDate).slice(0, 7) : '';
  }

  /**
   * 該筆保養案件是否已達客戶設定的「開始保養時間」（開幕 N 個月後）。
   * 查無門市、或案件既無區間身分也無日期時回 true（不套用此規則）——
   * 資料不全的案件不該因此從保養計劃無聲消失。
   * 已排定日期（有 planDate）或狀態已非「未保養」的案件同樣回 true：
   * 已進入作業流程的單不該因為客戶事後調整設定而被追溯隱藏、變成無法結案。
   * 門市存在但沒有開幕日期時回 false，與產生端一致。
   */
  function caseMaintenanceStarted(maintenanceCase, customers, stores) {
    if (!maintenanceCase) return true;
    if (maintenanceCase.planDate) return true;
    if (maintenanceCase.status && maintenanceCase.status !== '未保養') return true;
    var store = resolveStore(stores, maintenanceCase.customerName, maintenanceCase.storeName);
    if (!store) return true;
    var refMonth = caseStartReferenceMonth(maintenanceCase, customers);
    if (!refMonth) return true;
    return CustomerUtils.isMaintenanceStartedForMonth(customers, store, refMonth);
  }

  /**
   * 「YYYY 第N次（X-Y月）」——案件排程與保養明細共用，
   * 避免同一筆案件在兩處顯示的次數不一致。
   */
  function formatCasePeriodLabel(maintenanceCase, customers) {
    var period = resolveCasePeriod(maintenanceCase, customers);
    if (!period) return '';
    return period.year + ' 第' + period.visitIndex + '次（'
      + period.startMonth + '-' + period.endMonth + '月）';
  }

  function resolveMaintenanceStatus(currentStatus, planDate) {
    if (currentStatus === '已完成') return '已完成';
    if (planDate) return '已預約';
    if (currentStatus === '已預約') return '未保養';
    return '未保養';
  }

  function getPendingCases(maintenanceCases, cases, projectCases, filters, stores, assignees) {
    if (!filters || !filters.workCategory || !filters.customer || !filters.assignee) {
      return [];
    }
    var items = [];
    maintenanceCases.forEach(function (c) {
      if (c.isClosed || c.status !== '未保養') return;
      items.push({
        sourceType: 'maintenance',
        sourceId: c.id,
        customerName: c.customerName,
        storeName: c.storeName,
        storeArea: StoreUtils.getRecordArea(c),
        workCategory: getMaintenanceWorkCategory(c),
        assignee: c.assignee || '尚未指派'
      });
    });
    cases.forEach(function (c) {
      var sched = getRepairSchedule(c);
      var hasFormal = window.CaseAssigneeUtils
        ? CaseAssigneeUtils.hasFormalAssignee(c)
        : (c.assignee && c.assignee !== '案件待辦');
      if (c.isClosed || hasFormal || sched.planDate) return;
      items.push({
        sourceType: 'repair',
        sourceId: c.id,
        customerName: c.customerName,
        storeName: c.storeName,
        storeArea: StoreUtils.getRecordArea(c),
        workCategory: c.workCategory,
        assignee: window.CaseAssigneeUtils
          ? (CaseAssigneeUtils.formatAssignees(c) || '案件待辦')
          : c.assignee
      });
    });
    projectCases.forEach(function (c) {
      if (c.isClosed || c.stageAssignee !== '尚未指派' || c.planDate) return;
      items.push({
        sourceType: 'project',
        sourceId: c.id,
        customerName: c.customerName,
        storeName: c.storeName,
        storeArea: resolveStoreArea(stores, c.customerName, c.storeName),
        workCategory: c.workCategory,
        assignee: c.stageAssignee
      });
    });

    var selectedAssignee = (assignees || []).find(function (a) {
      return a.name === filters.assignee;
    });

    return items.filter(function (item) {
      if (item.workCategory !== filters.workCategory) return false;
      if (item.customerName !== filters.customer) return false;
      if (!selectedAssignee) return false;
      if (!StoreUtils.assigneeCoversArea(selectedAssignee, item.storeArea)) return false;
      if (filters.storeAreas && filters.storeAreas.length > 0) {
        if (filters.storeAreas.indexOf(item.storeArea) === -1) return false;
      }
      return true;
    });
  }

  function collectScheduledItems(maintenanceCases, cases, projectCases, rangeStart, rangeEnd, assigneeFilter) {
    var items = [];
    function inRange(dateStr) {
      return dateStr && dateStr >= rangeStart && dateStr <= rangeEnd;
    }
    function tryPush(sourceType, sourceId, sched, customerName, storeName, storeAddress, equipmentName, eventId) {
      if (!sched.planDate || !sched.planTimeStart) return;
      if (!inRange(sched.planDate)) return;
      if (assigneeFilter !== '全部') {
        if (sched.assignees && sched.assignees.length) {
          if (sched.assignees.indexOf(assigneeFilter) === -1) return;
        } else if (sched.assignee !== assigneeFilter) {
          return;
        }
      }
      items.push({
        id: eventId || (sourceType + '-' + sourceId),
        sourceType: sourceType,
        sourceId: sourceId,
        assignee: sched.assignee,
        date: sched.planDate,
        timeStart: sched.planTimeStart,
        timeEnd: sched.planTimeEnd || sched.planTimeStart,
        customerName: customerName,
        storeName: storeName,
        storeAddress: storeAddress || '',
        equipmentName: equipmentName || '',
        workCategory: sched.workCategory || '其他'
      });
    }
    maintenanceCases.forEach(function (c) {
      tryPush('maintenance', c.id, {
        planDate: c.planDate,
        planTimeStart: c.planTimeStart,
        planTimeEnd: c.planTimeEnd,
        assignee: c.assignee,
        workCategory: getMaintenanceWorkCategory(c)
      }, c.customerName, c.storeName, c.storeAddress || '');
    });
    cases.forEach(function (c) {
      tryPush('repair', c.id, getRepairSchedule(c), c.customerName, c.storeName, c.storeAddress || '', getRepairEquipmentName(c));
    });
    projectCases.forEach(function (c) {
      var addr = getProjectStoreAddress(c);
      collectProjectScheduleEntries(c).forEach(function (entry) {
        tryPush('project', c.id, {
          planDate: entry.planDate,
          planTimeStart: entry.planTimeStart,
          planTimeEnd: entry.planTimeEnd,
          assignee: entry.assignee,
          workCategory: entry.workCategory
        }, c.customerName, c.storeName, addr, '', 'project-' + c.id + '-' + entry.stageKey);
      });
    });
    return items.sort(function (a, b) {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.timeStart || '').localeCompare(b.timeStart || '');
    });
  }

  function buildEvent(sourceType, sourceId, sched, customerName, storeName, storeAddress, equipmentName, eventId) {
    if (!sched.planDate || !sched.planTimeStart) return null;
    var endTime = sched.planTimeEnd || sched.planTimeStart;
    var wc = sched.workCategory || '其他';
    var assignee = sched.assignee || '';
    return {
      id: eventId || (sourceType + '-' + sourceId),
      title: formatScheduleEventTitle(wc, assignee, customerName, storeName, storeAddress, {
        sourceType: sourceType,
        equipmentName: equipmentName
      }),
      start: sched.planDate + 'T' + formatTime24(sched.planTimeStart) + ':00',
      end: sched.planDate + 'T' + formatTime24(endTime) + ':00',
      backgroundColor: CATEGORY_COLORS[wc] || '#64748b',
      borderColor: CATEGORY_COLORS[wc] || '#64748b',
      extendedProps: {
        sourceType: sourceType,
        sourceId: sourceId,
        workCategory: wc,
        assignee: assignee,
        customerName: customerName,
        storeName: storeName,
        storeAddress: storeAddress || '',
        equipmentName: equipmentName || ''
      }
    };
  }

  function getScheduledEvents(maintenanceCases, cases, projectCases, rangeStart, rangeEnd, assigneeFilter) {
    return collectScheduledItems(maintenanceCases, cases, projectCases, rangeStart, rangeEnd, assigneeFilter)
      .map(function (item) {
        return buildEvent(item.sourceType, item.sourceId, {
          planDate: item.date,
          planTimeStart: item.timeStart,
          planTimeEnd: item.timeEnd,
          assignee: item.assignee,
          workCategory: item.workCategory
        }, item.customerName, item.storeName, item.storeAddress, item.equipmentName, item.id);
      })
      .filter(Boolean);
  }

  function getPersonnelRows(maintenanceCases, cases, projectCases, rangeStart, rangeEnd, assigneeFilter) {
    return collectScheduledItems(maintenanceCases, cases, projectCases, rangeStart, rangeEnd, assigneeFilter);
  }

  function getPersonnelEvents(maintenanceCases, cases, projectCases, rangeStart, rangeEnd, assigneeFilter) {
    return getPersonnelRows(maintenanceCases, cases, projectCases, rangeStart, rangeEnd, assigneeFilter)
      .map(function (item) {
        var wc = item.workCategory;
        return {
          id: 'ps-' + item.id,
          title: formatScheduleEventTitle(wc, item.assignee, item.customerName, item.storeName, item.storeAddress, {
            sourceType: item.sourceType,
            equipmentName: item.equipmentName
          }),
          start: item.date + 'T' + formatTime24(item.timeStart) + ':00',
          end: item.date + 'T' + formatTime24(item.timeEnd) + ':00',
          backgroundColor: CATEGORY_COLORS[wc] || '#64748b',
          borderColor: CATEGORY_COLORS[wc] || '#64748b',
          extendedProps: {
            assignee: item.assignee,
            customerName: item.customerName,
            storeName: item.storeName,
            workCategory: wc,
            timeRange: formatTimeRange(item.timeStart, item.timeEnd),
            storeAddress: item.storeAddress || '',
            equipmentName: item.equipmentName || ''
          }
        };
      });
  }

  function applyScheduleUpdate(sourceType, sourceId, payload, store, setters) {
    var planDate = payload.planDate;
    var planTimeStart = payload.planTimeStart;
    var planTimeEnd = payload.planTimeEnd;
    var assignee = payload.assignee;
    var customerName = '';
    var storeName = '';
    var workCategory = '';

    if (sourceType === 'maintenance') {
      setters.setMaintenanceCases(store.maintenanceCases.map(function (c) {
        if (c.id !== sourceId) return c;
        customerName = c.customerName;
        storeName = c.storeName;
        workCategory = getMaintenanceWorkCategory(c);
        return Object.assign({}, c, {
          planDate: planDate,
          planTimeStart: planTimeStart,
          planTimeEnd: planTimeEnd,
          assignee: assignee,
          status: resolveMaintenanceStatus(c.status, planDate)
        });
      }));
    } else if (sourceType === 'repair') {
      setters.setCases(store.cases.map(function (c) {
        if (c.id !== sourceId) return c;
        customerName = c.customerName;
        storeName = c.storeName;
        workCategory = c.workCategory;
        return Object.assign({}, c, {
          planDate: planDate,
          planTimeStart: planTimeStart,
          planTimeEnd: planTimeEnd,
          expectedDate: planDate,
          expectedTimeStart: planTimeStart,
          expectedTimeEnd: planTimeEnd,
          assignee: assignee
        });
      }));
    } else if (sourceType === 'project') {
      setters.setProjectCases(store.projectCases.map(function (c) {
        if (c.id !== sourceId) return c;
        customerName = c.customerName;
        storeName = c.storeName;
        workCategory = c.workCategory;
        var history = (c.history || []).map(function (h) {
          if (h.stage !== c.currentStage) return h;
          return Object.assign({}, h, {
            date: planDate,
            timeStart: planTimeStart,
            timeEnd: planTimeEnd,
            assignee: assignee
          });
        });
        return Object.assign({}, c, {
          planDate: planDate,
          planTimeStart: planTimeStart,
          planTimeEnd: planTimeEnd,
          stageDate: planDate,
          stageAssignee: assignee,
          history: history
        });
      }));
    }

    var ps = store.personnelStatus.filter(function (p) {
      if (p.sourceId !== sourceId) return true;
      if (p.sourceType === sourceType) return false;
      if (sourceType === 'repair' && p.sourceType === 'manual') return false;
      return true;
    });
    ps.push({
      id: 'PS' + Date.now(),
      assignee: assignee,
      date: planDate,
      timeStart: planTimeStart,
      timeEnd: planTimeEnd,
      customerName: customerName,
      storeName: storeName,
      workCategory: workCategory,
      sourceType: sourceType,
      sourceId: sourceId
    });
    setters.setPersonnelStatus(ps);
  }

  function upsertPersonnelStatus(personnelStatus, entry, setPersonnelStatus) {
    var ps = personnelStatus.filter(function (p) {
      return !(p.sourceType === entry.sourceType && p.sourceId === entry.sourceId);
    });
    ps.push(entry);
    setPersonnelStatus(ps);
  }

  window.ScheduleUtils = {
    generateDueMaintenanceCases: generateDueMaintenanceCases,
    getPendingCases: getPendingCases,
    getScheduledEvents: getScheduledEvents,
    applyScheduleUpdate: applyScheduleUpdate,
    upsertPersonnelStatus: upsertPersonnelStatus,
    getPersonnelRows: getPersonnelRows,
    getPersonnelEvents: getPersonnelEvents,
    getRepairSchedule: getRepairSchedule,
    resolveMaintenanceStatus: resolveMaintenanceStatus,
    resolveCasePeriod: resolveCasePeriod,
    formatPeriodRange: formatPeriodRange,
    casePeriodMatchesMonthRange: casePeriodMatchesMonthRange,
    caseMaintenanceStarted: caseMaintenanceStarted,
    formatCasePeriodLabel: formatCasePeriodLabel,
    periodMonthRange: periodMonthRange,
    resolveStore: resolveStore,
    applyStoreSnapshot: applyStoreSnapshot,
    getStoreNamesForCustomer: getStoreNamesForCustomer,
    getCustomerNamesFromStores: getCustomerNamesFromStores,
    resolveMaintenanceReferenceDate: resolveMaintenanceReferenceDate,
    formatTimeRange: formatTimeRange,
    formatTime24: formatTime24,
    formatScheduleEventTitle: formatScheduleEventTitle,
    CATEGORY_COLORS: CATEGORY_COLORS
  };
})();
