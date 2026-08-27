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

  // 日曆事件以組別上色：沒有人員色票設定，改用姓名雜湊對應固定調色盤，
  // 同一個人在任何時候、任何檢視都會拿到同一個顏色。
  var ASSIGNEE_COLORS = [
    '#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#db2777',
    '#0891b2', '#ca8a04', '#4f46e5', '#059669', '#dc2626'
  ];
  var UNASSIGNED_COLOR = '#94a3b8';

  function getAssigneeColor(assignee) {
    var name = (assignee || '').trim();
    if (!name) return UNASSIGNED_COLOR;
    var hash = 0;
    for (var i = 0; i < name.length; i += 1) {
      hash = (hash * 31 + name.charCodeAt(i)) % 100000;
    }
    return ASSIGNEE_COLORS[hash % ASSIGNEE_COLORS.length];
  }

  var UNASSIGNED_ASSIGNEE_NAMES = ['', '案件待辦', '尚未指派'];

  // 卡片上的組別是「、」串起來的字串，只要有一個正式組別就算有派組別。
  function hasFormalAssigneeName(assignee) {
    return String(assignee || '').split('、').some(function (name) {
      var n = name.trim();
      if (!n) return false;
      return window.CaseAssigneeUtils
        ? !CaseAssigneeUtils.isUnassignedValue(n)
        : UNASSIGNED_ASSIGNEE_NAMES.indexOf(n) === -1;
    });
  }

  function getPartnerVendorIds(record) {
    if (window.CaseAssigneeUtils) return CaseAssigneeUtils.getPartnerVendorIds(record);
    var ids = record && record.partnerVendorIds;
    if (Array.isArray(ids)) return ids.filter(Boolean).map(String);
    return ids ? [String(ids)] : [];
  }

  function formatPartnerVendorNames(vendors, ids) {
    if (!ids || !ids.length) return '';
    if (window.VendorUtils) return VendorUtils.formatCooperatorLabels(vendors, ids);
    return ids.join('、');
  }

  // 地址與設備仍保留在 extendedProps，只是不佔用日曆卡片版面
  // 協力廠商接在組別下方自成一行；沒有協力廠商時整行省略，不留空行。
  function formatScheduleEventTitle(workCategory, assignee, customerName, storeName, partnerVendorName) {
    var lines = [
      '[' + (workCategory || '其他') + ']',
      assignee || '未指派'
    ];
    if (partnerVendorName) lines.push(partnerVendorName);
    lines.push(customerName || '', storeName || '');
    return lines.join('\n');
  }

  // 一筆叫修案件可能對到多台設備，日曆卡片仍只留一行文字，故串接顯示
  function getRepairEquipmentName(c) {
    if (!c || !window.RepairCaseServiceItems) return '';
    return RepairCaseServiceItems.getEquipments(c).map(function (eq) {
      return eq.deviceName || eq.name || '';
    }).filter(Boolean).join('、');
  }

  function getProjectStoreAddress(c) {
    return (c.details && c.details.storeAddress) || c.storeAddress || '';
  }

  /**
   * 工程案件目前階段的排程：以案件層級的 planDate 為主，
   * 沒填時退回 history 裡「目前階段」那一筆。
   */
  function resolveProjectCurrentSchedule(c) {
    var stageEntry = (c.history || []).find(function (entry) {
      return entry.stage === (c.currentStage || '');
    });
    if (c.planDate) {
      return {
        planDate: c.planDate,
        planTimeStart: c.planTimeStart || '',
        planTimeEnd: c.planTimeEnd || '',
        assignee: c.stageAssignee || ''
      };
    }
    if (stageEntry && stageEntry.date) {
      return {
        planDate: stageEntry.date,
        planTimeStart: stageEntry.timeStart || '',
        planTimeEnd: stageEntry.timeEnd || '',
        assignee: stageEntry.assignee || c.stageAssignee || ''
      };
    }
    return {
      planDate: c.stageDate || '',
      planTimeStart: '',
      planTimeEnd: '',
      assignee: c.stageAssignee || ''
    };
  }

  /**
   * 工程案件依進度往前推，日曆上只呈現「目前階段」這一段排程；
   * 先前階段屬於已走過的歷史進度，不再排進日曆（案件安排與人員動向皆同）。
   */
  function collectProjectScheduleEntries(c) {
    var sched = resolveProjectCurrentSchedule(c);
    if (!sched.planDate) return [];
    return [{
      stageKey: 'current',
      stage: c.currentStage || '',
      planDate: sched.planDate,
      planTimeStart: sched.planTimeStart || '',
      planTimeEnd: sched.planTimeStart ? (sched.planTimeEnd || '') : '',
      assignee: sched.assignee || c.stageAssignee || '',
      workCategory: c.workCategory
    }];
  }

  /**
   * 取出工程案件上某一段排程。stageKey 'current'（或空值）代表案件層級的
   * planDate／stageAssignee，其餘對應 history 內同名階段。
   */
  function getProjectStageSchedule(c, stageKey) {
    if (!c) return null;
    if (stageKey && stageKey !== 'current') {
      var entry = (c.history || []).find(function (h) { return h.stage === stageKey; });
      if (entry) {
        return {
          stageKey: stageKey,
          stage: entry.stage,
          planDate: entry.date || '',
          planTimeStart: entry.timeStart || '',
          planTimeEnd: entry.timeEnd || '',
          assignee: entry.assignee || ''
        };
      }
    }
    var current = resolveProjectCurrentSchedule(c);
    return {
      stageKey: 'current',
      stage: c.currentStage || '',
      planDate: current.planDate,
      planTimeStart: current.planTimeStart,
      planTimeEnd: current.planTimeEnd,
      assignee: current.assignee
    };
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
      partnerVendorIds: getPartnerVendorIds(c),
      workCategory: c.workCategory
    };
  }

  /* 保養單的排程讀取入口（日曆點開編輯時共用）。
   * 組別在正規化後只存在 assignees[]，這裡一律走 CaseAssigneeUtils，
   * 不再讀舊的單值 assignee，否則彈窗的「組別」會空白、儲存還會把組別洗掉。 */
  function getMaintenanceSchedule(c) {
    if (!c) return { planDate: '', planTimeStart: '', planTimeEnd: '', assignee: '', assignees: [], partnerVendorIds: [], workCategory: '保養' };
    var assignees = window.CaseAssigneeUtils
      ? CaseAssigneeUtils.getFormalAssignees(c)
      : (c.assignee ? [c.assignee] : []);
    return {
      planDate: c.planDate || '',
      planTimeStart: c.planTimeStart || '',
      planTimeEnd: c.planTimeEnd || '',
      assignee: assignees.join('、'),
      assignees: assignees,
      partnerVendorIds: getPartnerVendorIds(c),
      workCategory: getMaintenanceWorkCategory(c)
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

  var ALL_DAY_LABEL = '整天';

  /** 排程情境的時間顯示：沒填時間就是整天案件。 */
  function formatScheduleTimeRange(start, end) {
    return start ? formatTimeRange(start, end) : ALL_DAY_LABEL;
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

  /* 未指派的保養單，依門市所在行政區帶入負責組別與該組成員。
   * 只補空白：已經有組別的（不論是人工挑的還是先前帶入的）一律不動，已結案的也不碰，
   * 免得回頭改寫歷史資料。查不到負責組別時維持空白，列表照舊顯示「尚未指派」。
   * assignees 未傳時整段跳過，既有的四參數呼叫端行為完全不變。 */
  function applyDefaultMaintenanceAssignees(cases, assignees, accounts) {
    if (!assignees || !assignees.length) return cases;
    if (typeof AssigneeUtils === 'undefined') return cases;
    return (cases || []).map(function (c) {
      if (!c || c.isClosed) return c;
      if ((c.assignees || []).length) return c;
      var preset = AssigneeUtils.getDefaultAssignment(
        assignees, accounts, c.companyCity, c.companyDistrict
      );
      if (!preset) return c;
      return Object.assign({}, c, {
        assignees: preset.assignees,
        assigneeMemberIds: preset.assigneeMemberIds
      });
    });
  }

  /**
   * 依客戶的保養區間產生保養單：每個門市在「參考月份所在的區間」各一筆。
   * 不論上一個區間是否完成，進入下一個區間都會重新建一筆。
   * referenceMonth 為選填的 'YYYY-MM'，省略時取當月。
   * serviceLevels 為選填，用來推導門市未設定「是否保養」時的預設值（見 StoreUtils.getStoreMaintenanceFlag）。
   * assignees／accounts 為選填的組別與帳號主檔，用來把未指派的保養單依行政區補上預設組別。
   */
  function generateDueMaintenanceCases(customers, stores, existingCases, referenceMonth, serviceLevels, assignees, accounts) {
    var refMonth = referenceMonth || new Date().toISOString().slice(0, 7);
    var refYear = parseInt(String(refMonth).slice(0, 4), 10);
    var monthNumber = parseInt(String(refMonth).slice(5, 7), 10);
    var result = backfillCasePeriods(existingCases, customers);

    var customerMap = {};
    (customers || []).forEach(function (c) { customerMap[c.name] = c; });

    // 參考月份無效時不開新單，但既有未指派的仍要補預設組別，故不在此提前 return。
    if (refYear && monthNumber) (stores || []).forEach(function (store) {
      // 「整裝」「撤店」，或「正常營業」但「是否保養」為否的門市都不開保養單。
      if (!StoreUtils.isMaintainableStore(store, serviceLevels)) return;
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
        assignees: [],
        assigneeMemberIds: [],
        isClosed: false,
        storeAddress: StoreUtils.buildFullAddress(store)
      });
    });
    return applyDefaultMaintenanceAssignees(result, assignees, accounts);
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
        assignee: window.CaseAssigneeUtils
          ? CaseAssigneeUtils.formatMaintenanceAssignees(c)
          : (c.assignee || '尚未指派')
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
    function tryPush(sourceType, sourceId, sched, customerName, storeName, storeAddress, equipmentName, eventId, stageKey) {
      if (!sched.planDate) return;
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
        // 只填日期沒填時間 → 視為整天，時間一律留空
        timeStart: sched.planTimeStart || '',
        timeEnd: sched.planTimeStart ? (sched.planTimeEnd || sched.planTimeStart) : '',
        customerName: customerName,
        storeName: storeName,
        storeAddress: storeAddress || '',
        equipmentName: equipmentName || '',
        workCategory: sched.workCategory || '其他',
        remark: sched.remark || '',
        partnerVendorIds: sched.partnerVendorIds || [],
        // 工程案件一筆案子可能有多個階段排程，靠 stageKey 才知道點到的是哪一段
        stageKey: stageKey || ''
      });
    }
    maintenanceCases.forEach(function (c) {
      tryPush('maintenance', c.id, {
        planDate: c.planDate,
        planTimeStart: c.planTimeStart,
        planTimeEnd: c.planTimeEnd,
        assignee: window.CaseAssigneeUtils ? CaseAssigneeUtils.formatAssignees(c) : (c.assignee || ''),
        assignees: window.CaseAssigneeUtils ? CaseAssigneeUtils.getAssignees(c) : (c.assignee ? [c.assignee] : []),
        partnerVendorIds: getPartnerVendorIds(c),
        workCategory: getMaintenanceWorkCategory(c),
        remark: c.remark || ''
      }, c.customerName, c.storeName, c.storeAddress || '');
    });
    cases.forEach(function (c) {
      var repairSched = Object.assign({}, getRepairSchedule(c), { remark: c.repairRemark || '' });
      tryPush('repair', c.id, repairSched, c.customerName, c.storeName, c.storeAddress || '', getRepairEquipmentName(c));
    });
    projectCases.forEach(function (c) {
      var addr = getProjectStoreAddress(c);
      collectProjectScheduleEntries(c).forEach(function (entry) {
        tryPush('project', c.id, {
          planDate: entry.planDate,
          planTimeStart: entry.planTimeStart,
          planTimeEnd: entry.planTimeEnd,
          assignee: entry.assignee,
          partnerVendorIds: getPartnerVendorIds(c),
          workCategory: entry.workCategory,
          remark: (c.details && c.details.remarks) || c.remarks || ''
        }, c.customerName, c.storeName, addr, '', 'project-' + c.id + '-' + entry.stageKey, entry.stageKey);
      });
    });
    return items.sort(function (a, b) {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.timeStart || '').localeCompare(b.timeStart || '');
    });
  }

  /**
   * 依有無時間決定日曆事件的時間屬性。
   * 沒填時間 → allDay 事件，FullCalendar 會固定排在當天最上方的「整天」列。
   */
  function buildEventTiming(planDate, planTimeStart, planTimeEnd) {
    if (!planTimeStart) {
      return { start: planDate, allDay: true };
    }
    return {
      start: planDate + 'T' + formatTime24(planTimeStart) + ':00',
      end: planDate + 'T' + formatTime24(planTimeEnd || planTimeStart) + ':00',
      allDay: false
    };
  }

  function buildEvent(sourceType, sourceId, sched, customerName, storeName, storeAddress, equipmentName, eventId, stageKey) {
    if (!sched.planDate) return null;
    var timing = buildEventTiming(sched.planDate, sched.planTimeStart, sched.planTimeEnd);
    var wc = sched.workCategory || '其他';
    var assignee = sched.assignee || '';
    var partnerVendorName = sched.partnerVendorName || '';
    return {
      id: eventId || (sourceType + '-' + sourceId),
      title: formatScheduleEventTitle(wc, assignee, customerName, storeName, partnerVendorName),
      start: timing.start,
      end: timing.end,
      allDay: timing.allDay,
      backgroundColor: getAssigneeColor(assignee),
      borderColor: getAssigneeColor(assignee),
      extendedProps: {
        sourceType: sourceType,
        sourceId: sourceId,
        workCategory: wc,
        assignee: assignee,
        partnerVendorName: partnerVendorName,
        customerName: customerName,
        storeName: storeName,
        storeAddress: storeAddress || '',
        equipmentName: equipmentName || '',
        stageKey: stageKey || ''
      }
    };
  }

  /* 日曆卡片：組別下方接一行協力廠商。
   * 只掛協力廠商、沒有正式組別的案件不進日曆（日曆是看組別排程用的，
   * 這種案件在卡片上只會顯示「未指派」，反而誤導）；兩者皆無的仍照舊顯示未指派。 */
  function getScheduledEvents(maintenanceCases, cases, projectCases, rangeStart, rangeEnd, assigneeFilter, vendors) {
    return collectScheduledItems(maintenanceCases, cases, projectCases, rangeStart, rangeEnd, assigneeFilter)
      .filter(function (item) {
        if (hasFormalAssigneeName(item.assignee)) return true;
        return !(item.partnerVendorIds && item.partnerVendorIds.length);
      })
      .map(function (item) {
        return buildEvent(item.sourceType, item.sourceId, {
          planDate: item.date,
          planTimeStart: item.timeStart,
          planTimeEnd: item.timeEnd,
          assignee: item.assignee,
          partnerVendorName: formatPartnerVendorNames(vendors, item.partnerVendorIds),
          workCategory: item.workCategory
        }, item.customerName, item.storeName, item.storeAddress, item.equipmentName, item.id, item.stageKey);
      })
      .filter(Boolean);
  }

  function getPersonnelRows(maintenanceCases, cases, projectCases, rangeStart, rangeEnd, assigneeFilter) {
    return collectScheduledItems(maintenanceCases, cases, projectCases, rangeStart, rangeEnd, assigneeFilter);
  }

  /* 日曆卡片比照案件安排：組別下方接一行協力廠商；
   * 只掛協力廠商、沒有正式組別的案件不進日曆（下方表格仍完整列出）。 */
  function getPersonnelEvents(maintenanceCases, cases, projectCases, rangeStart, rangeEnd, assigneeFilter, vendors) {
    return getPersonnelRows(maintenanceCases, cases, projectCases, rangeStart, rangeEnd, assigneeFilter)
      .filter(function (item) {
        if (hasFormalAssigneeName(item.assignee)) return true;
        return !(item.partnerVendorIds && item.partnerVendorIds.length);
      })
      .map(function (item) {
        var wc = item.workCategory;
        var timing = buildEventTiming(item.date, item.timeStart, item.timeEnd);
        var partnerVendorName = formatPartnerVendorNames(vendors, item.partnerVendorIds);
        return {
          id: 'ps-' + item.id,
          title: formatScheduleEventTitle(wc, item.assignee, item.customerName, item.storeName, partnerVendorName),
          start: timing.start,
          end: timing.end,
          allDay: timing.allDay,
          backgroundColor: getAssigneeColor(item.assignee),
          borderColor: getAssigneeColor(item.assignee),
          extendedProps: {
            assignee: item.assignee,
            partnerVendorName: partnerVendorName,
            customerName: item.customerName,
            storeName: item.storeName,
            workCategory: wc,
            timeRange: formatScheduleTimeRange(item.timeStart, item.timeEnd),
            storeAddress: item.storeAddress || '',
            equipmentName: item.equipmentName || ''
          }
        };
      });
  }

  /* 工作安排（工程服務主檔）落在指定週的排程。
   * 沒填預計日期的無法定位到某一週，日曆與表格都不列。 */
  function getJobScheduleRows(jobSchedules, rangeStart, rangeEnd, assigneeFilter) {
    return (jobSchedules || [])
      .filter(function (row) {
        var date = row && row.estimatedDate;
        if (!date || date < rangeStart || date > rangeEnd) return false;
        if (assigneeFilter && assigneeFilter !== '全部') {
          return (row.assigneeName || '') === assigneeFilter;
        }
        return true;
      })
      .map(function (row) {
        return {
          id: 'job-' + row.id,
          sourceType: 'jobSchedule',
          sourceId: row.id,
          name: row.name || '',
          assigneeName: row.assigneeName || '',
          date: row.estimatedDate,
          // 只填日期沒填時間 → 視為整天，時間一律留空
          timeStart: row.estimatedTime || '',
          timeEnd: '',
          remark: row.remarks || ''
        };
      })
      .sort(function (a, b) {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.timeStart || '').localeCompare(b.timeStart || '');
      });
  }

  // 卡片只放工作名稱與指派人員兩行
  function formatJobScheduleEventTitle(name, assigneeName) {
    return [name || '(未命名工作)', assigneeName || '未指派'].join('\n');
  }

  function getJobScheduleEvents(jobSchedules, rangeStart, rangeEnd, assigneeFilter) {
    return getJobScheduleRows(jobSchedules, rangeStart, rangeEnd, assigneeFilter)
      .map(function (item) {
        var timing = buildEventTiming(item.date, item.timeStart, item.timeEnd);
        return {
          id: 'js-' + item.id,
          title: formatJobScheduleEventTitle(item.name, item.assigneeName),
          start: timing.start,
          end: timing.end,
          allDay: timing.allDay,
          backgroundColor: getAssigneeColor(item.assigneeName),
          borderColor: getAssigneeColor(item.assigneeName),
          extendedProps: {
            sourceType: 'jobSchedule',
            sourceId: item.sourceId,
            name: item.name,
            assigneeName: item.assigneeName,
            timeRange: formatScheduleTimeRange(item.timeStart, item.timeEnd),
            remark: item.remark
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
        // 排程面板的組別是單選，保養單則以 assignees[] 為準：包成一元素陣列並丟掉舊的單值欄位。
        var nextMaintenance = Object.assign({}, c, {
          planDate: planDate,
          planTimeStart: planTimeStart,
          planTimeEnd: planTimeEnd,
          assignees: assignee ? [assignee] : [],
          status: resolveMaintenanceStatus(c.status, planDate)
        });
        delete nextMaintenance.assignee;
        return nextMaintenance;
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
        // 日曆上一筆工程案件可能有多段階段排程，只改點到的那一段；
        // stageKey 未帶（或指向目前階段）時才連帶更新案件層級的排程欄位。
        var targetStage = (payload.stageKey && payload.stageKey !== 'current')
          ? payload.stageKey
          : (c.currentStage || '');
        var isCurrentStage = targetStage === (c.currentStage || '');
        var history = (c.history || []).map(function (h) {
          if (h.stage !== targetStage) return h;
          return Object.assign({}, h, {
            date: planDate,
            timeStart: planTimeStart,
            timeEnd: planTimeEnd,
            assignee: assignee
          });
        });
        var next = Object.assign({}, c, { history: history });
        if (isCurrentStage) {
          next.planDate = planDate;
          next.planTimeStart = planTimeStart;
          next.planTimeEnd = planTimeEnd;
          next.stageDate = planDate;
          next.stageAssignee = assignee;
        }
        return next;
      }));
    }

    var stageKey = sourceType === 'project' ? (payload.stageKey || 'current') : '';
    var ps = store.personnelStatus.filter(function (p) {
      if (p.sourceId !== sourceId) return true;
      if (p.sourceType === sourceType) {
        // 工程案件一筆案子可有多段階段排程，只取代同一階段的紀錄
        if (sourceType === 'project') return (p.stageKey || 'current') !== stageKey;
        return false;
      }
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
      sourceId: sourceId,
      stageKey: stageKey
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
    applyDefaultMaintenanceAssignees: applyDefaultMaintenanceAssignees,
    getPendingCases: getPendingCases,
    getScheduledEvents: getScheduledEvents,
    applyScheduleUpdate: applyScheduleUpdate,
    upsertPersonnelStatus: upsertPersonnelStatus,
    getPersonnelRows: getPersonnelRows,
    getPersonnelEvents: getPersonnelEvents,
    getJobScheduleRows: getJobScheduleRows,
    getJobScheduleEvents: getJobScheduleEvents,
    getRepairSchedule: getRepairSchedule,
    getMaintenanceSchedule: getMaintenanceSchedule,
    getProjectStageSchedule: getProjectStageSchedule,
    resolveMaintenanceStatus: resolveMaintenanceStatus,
    resolveCasePeriod: resolveCasePeriod,
    formatPeriodRange: formatPeriodRange,
    casePeriodMatchesMonthRange: casePeriodMatchesMonthRange,
    caseMaintenanceStarted: caseMaintenanceStarted,
    periodMonthRange: periodMonthRange,
    resolveStore: resolveStore,
    applyStoreSnapshot: applyStoreSnapshot,
    getStoreNamesForCustomer: getStoreNamesForCustomer,
    getCustomerNamesFromStores: getCustomerNamesFromStores,
    resolveMaintenanceReferenceDate: resolveMaintenanceReferenceDate,
    formatTimeRange: formatTimeRange,
    formatScheduleTimeRange: formatScheduleTimeRange,
    ALL_DAY_LABEL: ALL_DAY_LABEL,
    formatTime24: formatTime24,
    formatScheduleEventTitle: formatScheduleEventTitle,
    CATEGORY_COLORS: CATEGORY_COLORS,
    getAssigneeColor: getAssigneeColor
  };
})();
