/*
 * features/scheduling/schedule-utils.js — 待安排／已排程聚合、保養產生與更新
 */
(function () {
  'use strict';

  var INTERVAL_MONTHS = { '每季': 3, '每半年': 6, '每年': 12 };

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

  function formatScheduleEventTitle(workCategory, assignee, customerName, storeName) {
    var wc = workCategory || '其他';
    var person = assignee || '未指派';
    return '[' + wc + '] ' + person + ' ' + customerName + ' ' + storeName;
  }

  function addMonthsToMonth(dateStr, months) {
    var d = new Date(dateStr);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 7);
  }

  function getMaintenanceWorkCategory(c) {
    return c.workCategory || '保養';
  }

  function getRepairSchedule(c) {
    return {
      planDate: c.planDate || c.expectedDate || '',
      planTimeStart: c.planTimeStart || c.expectedTimeStart || '',
      planTimeEnd: c.planTimeEnd || c.expectedTimeEnd || '',
      assignee: c.assignee,
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

  function generateDueMaintenanceCases(customers, stores, existingCases) {
    var result = existingCases.slice();
    var customerMap = {};
    customers.forEach(function (c) { customerMap[c.name] = c; });
    var currentMonth = new Date().toISOString().slice(0, 7);

    stores.forEach(function (store) {
      if (!store.lastMaintenanceDate || store.storeStatus !== '正常營業') return;
      var cust = customerMap[store.customerName];
      if (!cust || cust.enabled === false || !cust.maintenanceInterval) return;
      var months = INTERVAL_MONTHS[cust.maintenanceInterval];
      if (!months) return;

      var dueMonth = addMonthsToMonth(store.lastMaintenanceDate, months);
      if (dueMonth > currentMonth) return;

      var hasOpen = result.some(function (m) {
        if (m.isClosed) return false;
        if (m.customerName !== store.customerName || m.storeName !== store.storeName) return false;
        if (m.status === '未保養') return true;
        var mMonth = m.planDate ? m.planDate.slice(0, 7) : (m.dueMonth || '');
        return mMonth === dueMonth;
      });
      if (hasOpen) return;

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
        dueMonth: dueMonth,
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

  function formatMaintenancePeriod(dateStr, maintenanceInterval) {
    if (!dateStr) return '';
    var year = parseInt(dateStr.slice(0, 4), 10);
    var month = parseInt(dateStr.slice(5, 7), 10);
    if (!year || !month) return '';

    if (maintenanceInterval === '每季') {
      return year + ' Q' + Math.ceil(month / 3);
    }
    if (maintenanceInterval === '每半年') {
      return year + (month <= 6 ? ' 上半年' : ' 下半年');
    }
    if (maintenanceInterval === '每年') {
      return String(year);
    }
    return String(year);
  }

  function resolveMaintenanceStatus(currentStatus, planDate) {
    if (currentStatus === '已完成') return '已完成';
    if (planDate) return '已預約';
    if (currentStatus === '已預約') return '未保養';
    return '未保養';
  }

  function getPendingCases(maintenanceCases, cases, projectCases, filters, stores) {
    if (!filters || !filters.workCategory || !filters.customer || !filters.storeArea) {
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
      if (c.isClosed || c.assignee !== '案件待辦' || sched.planDate) return;
      items.push({
        sourceType: 'repair',
        sourceId: c.id,
        customerName: c.customerName,
        storeName: c.storeName,
        storeArea: StoreUtils.getRecordArea(c),
        workCategory: c.workCategory,
        assignee: c.assignee
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
    return items.filter(function (item) {
      if (item.workCategory !== filters.workCategory) return false;
      if (item.customerName !== filters.customer) return false;
      if (item.storeArea !== filters.storeArea) return false;
      return true;
    });
  }

  function collectScheduledItems(maintenanceCases, cases, projectCases, rangeStart, rangeEnd, assigneeFilter) {
    var items = [];
    function inRange(dateStr) {
      return dateStr && dateStr >= rangeStart && dateStr <= rangeEnd;
    }
    function tryPush(sourceType, sourceId, sched, customerName, storeName) {
      if (!sched.planDate || !sched.planTimeStart) return;
      if (!inRange(sched.planDate)) return;
      if (assigneeFilter !== '全部' && sched.assignee !== assigneeFilter) return;
      items.push({
        id: sourceType + '-' + sourceId,
        sourceType: sourceType,
        sourceId: sourceId,
        assignee: sched.assignee,
        date: sched.planDate,
        timeStart: sched.planTimeStart,
        timeEnd: sched.planTimeEnd || sched.planTimeStart,
        customerName: customerName,
        storeName: storeName,
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
      }, c.customerName, c.storeName);
    });
    cases.forEach(function (c) {
      tryPush('repair', c.id, getRepairSchedule(c), c.customerName, c.storeName);
    });
    projectCases.forEach(function (c) {
      tryPush('project', c.id, getProjectSchedule(c), c.customerName, c.storeName);
    });
    return items.sort(function (a, b) {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.timeStart || '').localeCompare(b.timeStart || '');
    });
  }

  function buildEvent(sourceType, sourceId, sched, customerName, storeName) {
    if (!sched.planDate || !sched.planTimeStart) return null;
    var endTime = sched.planTimeEnd || sched.planTimeStart;
    var wc = sched.workCategory || '其他';
    var assignee = sched.assignee || '';
    return {
      id: sourceType + '-' + sourceId,
      title: formatScheduleEventTitle(wc, assignee, customerName, storeName),
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
        storeName: storeName
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
        }, item.customerName, item.storeName);
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
          title: '[' + wc + '] ' + item.assignee + ' ' + item.customerName + ' ' + item.storeName,
          start: item.date + 'T' + formatTime24(item.timeStart) + ':00',
          end: item.date + 'T' + formatTime24(item.timeEnd) + ':00',
          backgroundColor: CATEGORY_COLORS[wc] || '#64748b',
          borderColor: CATEGORY_COLORS[wc] || '#64748b',
          extendedProps: {
            assignee: item.assignee,
            customerName: item.customerName,
            storeName: item.storeName,
            workCategory: wc,
            timeRange: formatTimeRange(item.timeStart, item.timeEnd)
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
    resolveStore: resolveStore,
    applyStoreSnapshot: applyStoreSnapshot,
    getStoreNamesForCustomer: getStoreNamesForCustomer,
    getCustomerNamesFromStores: getCustomerNamesFromStores,
    resolveMaintenanceReferenceDate: resolveMaintenanceReferenceDate,
    formatMaintenancePeriod: formatMaintenancePeriod,
    formatTimeRange: formatTimeRange,
    formatTime24: formatTime24,
    formatScheduleEventTitle: formatScheduleEventTitle,
    CATEGORY_COLORS: CATEGORY_COLORS
  };
})();
