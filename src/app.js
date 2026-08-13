/*
 * app.js — 應用進入點：全域狀態、外框佈局與 view 路由
 *
 * 取代原本的 JinChuanWarRoom 元件。任何跨頁資料或導覽變更皆透過 store，
 * store 變動即整頁重繪（Header + Sidebar + 目前 view）；各 view 內部的表單
 * 暫存狀態則由自身的 stateful 閉包管理，不受整頁重繪影響（編輯途中不會觸發 store 變更）。
 */
(function () {
  'use strict';
  var h = IESS.h, Fragment = IESS.Fragment, mount = IESS.mount, showToast = IESS.showToast;

  function readLS(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
  }
  function writeLS(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* localStorage 不可用時略過 */ }
  }

  // 依子選單決定預設 view（戰情室）
  var WARROOM_SUBMENU_DEFAULT_VIEW = {
    '案件處理': 'list',
    '叫修案件紀錄': 'record-list',
    '保養計劃進度': 'maintenance-list',
    '案件銷案審核': 'review-list',
    '工程立案': 'project-list',
    '現勘表收集': 'survey-list',
    '客戶管理': 'customer-list',
    '門市管理': 'store-list',
    '設備管理': 'equipment-list'
  };

  var SCHEDULING_SUBMENU_DEFAULT_VIEW = {
    '案件安排': 'arrangement',
    '人員動向': 'personnel-movement',
    'GPS': 'gps'
  };

  var REPORTS_SUBMENU_DEFAULT_VIEW = {
    '案件績效統計': 'case-performance',
    '資料調閱': 'data-retrieval'
  };

  var PERMISSIONS_SUBMENU_DEFAULT_VIEW = {
    '帳號管理': 'account-list',
    '組別管理': 'assignee-list',
    '設備分類管理': 'device-category-list',
    '服務等級管理': 'service-level-list',
    '處理方式與積分管理': 'process-method-list',
    '保養分配': 'maintenance-allocation',
    '績效區域管理': 'performance-area-list'
  };

  var WARROOM_SUBMENUS = Object.keys(WARROOM_SUBMENU_DEFAULT_VIEW);
  var SCHEDULING_SUBMENUS = Object.keys(SCHEDULING_SUBMENU_DEFAULT_VIEW);
  var REPORTS_SUBMENUS = Object.keys(REPORTS_SUBMENU_DEFAULT_VIEW);
  var PERMISSIONS_SUBMENUS = Object.keys(PERMISSIONS_SUBMENU_DEFAULT_VIEW);

  var initialTopMenu = readLS('iess:currentTopMenu', '戰情室');
  var initialSubMenu = readLS('iess:currentSubMenu', '案件處理');
  var initialSchedulingSubMenu = readLS('iess:schedulingSubMenu', '案件安排');
  var initialReportsSubMenu = readLS('iess:reportsSubMenu', '案件績效統計');
  var initialPermissionsSubMenu = readLS('iess:permissionsSubMenu', '帳號管理');
  if (initialPermissionsSubMenu === '行政區域管理') {
    initialPermissionsSubMenu = '帳號管理';
  }
  var initialView = initialTopMenu === '案件排程'
    ? (SCHEDULING_SUBMENU_DEFAULT_VIEW[initialSchedulingSubMenu] || 'arrangement')
    : initialTopMenu === '報表統計'
      ? (REPORTS_SUBMENU_DEFAULT_VIEW[initialReportsSubMenu] || 'case-performance')
      : initialTopMenu === '系統權限'
        ? (PERMISSIONS_SUBMENU_DEFAULT_VIEW[initialPermissionsSubMenu] || 'account-list')
        : (WARROOM_SUBMENU_DEFAULT_VIEW[initialSubMenu] || 'list');

  var store = IESS.createStore({
    currentTopMenu: initialTopMenu,
    currentSubMenu: initialSubMenu,
    schedulingSubMenu: initialSchedulingSubMenu,
    reportsSubMenu: initialReportsSubMenu,
    permissionsSubMenu: initialPermissionsSubMenu,
    // 戰情室與系統權限的側選單群組共用這個陣列（群組 id 不重疊），預設全部展開
    expandedSidebar: ['維修服務', '工程服務', '客戶建檔', '人員與權限', '基礎資料設定', '保養作業'],
    mobileSidebarOpen: false,
    view: initialView,
    cases: INITIAL_CASES,
    // 僅在 store 建構時執行一次：之後編輯客戶的保養區間不會回頭重新產生保養案件
    // （這是記憶體版 demo 可接受的限制，需重新整理頁面才會依最新設定重算）
    maintenanceCases: ScheduleUtils.generateDueMaintenanceCases(INITIAL_CUSTOMERS, INITIAL_STORES, INITIAL_MAINTENANCE_CASES),
    projectCases: INITIAL_PROJECT_CASES,
    surveyCases: INITIAL_SURVEY_CASES,
    customers: INITIAL_CUSTOMERS,
    stores: INITIAL_STORES,
    storeCustomer: '',
    equipments: INITIAL_EQUIPMENTS,
    equipmentCustomer: '',
    equipmentStore: '',
    personnelStatus: INITIAL_PERSONNEL_STATUS,
    accounts: INITIAL_ACCOUNTS,
    deviceCategories: INITIAL_DEVICE_CATEGORIES,
    serviceLevels: INITIAL_SERVICE_LEVELS,
    processMethods: INITIAL_PROCESS_METHODS,
    assignees: INITIAL_ASSIGNEES,
    maintenanceAllocations: INITIAL_MAINTENANCE_ALLOCATIONS,
    maintenanceAllocationYears: INITIAL_MAINTENANCE_ALLOCATION_YEARS,
    performanceAreas: INITIAL_PERFORMANCE_AREAS,
    editingCase: null,
    viewingCase: null,
    historyStore: null,
    customerBackView: '',
    statusFilter: '未處理',
    currentAccountId: 'ACC1'
  });

  function getCurrentOperatorName(accounts, accountId) {
    var account = (accounts || []).find(function (a) { return a.id === accountId; });
    return (account && account.name) || '系統管理員';
  }

  // --- 各種 setter（提供給 view 作為 props） ---
  function makeSetter(key) {
    return function (v) {
      store.set(function (s) {
        var next = {};
        next[key] = typeof v === 'function' ? v(s[key]) : v;
        return next;
      });
    };
  }

  var setView = makeSetter('view');
  var setEditingCase = makeSetter('editingCase');
  var setViewingCase = makeSetter('viewingCase');
  var setHistoryStore = makeSetter('historyStore');
  var setCustomerBackView = makeSetter('customerBackView');
  var setStatusFilter = makeSetter('statusFilter');

  function openStoreHistory(storeRecord, backView) {
    store.set({
      historyStore: storeRecord,
      view: 'store-history',
      viewingCase: null,
      editingCase: null,
      customerBackView: backView || 'store-list'
    });
  }

  function openStoreEdit(storeRecord, backView) {
    store.set({
      editingCase: storeRecord,
      view: 'store-edit',
      viewingCase: null,
      customerBackView: backView || 'store-list'
    });
  }

  function clearCustomerBackView() {
    setCustomerBackView('');
  }

  function openStoreHistoryDetail(view, record) {
    store.set(function (s) {
      var enriched = StoreUtils.withStoreHistoryContext(record, s.historyStore);
      var next = { view: view };
      if (view === 'store-history-project-view') {
        next.editingCase = enriched;
      } else {
        next.viewingCase = enriched;
      }
      return next;
    });
  }
  var setStoreCustomer = makeSetter('storeCustomer');
  var setCasesData = makeSetter('cases');
  var setMaintenanceCases = makeSetter('maintenanceCases');
  var setProjectCases = makeSetter('projectCases');
  var setSurveyCases = makeSetter('surveyCases');
  var setCustomers = makeSetter('customers');
  var setStores = makeSetter('stores');
  var setEquipments = makeSetter('equipments');
  var setEquipmentCustomer = makeSetter('equipmentCustomer');
  var setEquipmentStore = makeSetter('equipmentStore');
  var setPersonnelStatus = makeSetter('personnelStatus');
  var setMaintenanceAllocations = makeSetter('maintenanceAllocations');
  var setMaintenanceAllocationYears = makeSetter('maintenanceAllocationYears');
  var setPerformanceAreas = makeSetter('performanceAreas');
  function setAccounts(v) {
    store.set(function (s) {
      var next = typeof v === 'function' ? v(s.accounts) : v;
      AccountUtils.syncProjectPersonOptions(next);
      return { accounts: next };
    });
  }

  function setDeviceCategories(v) {
    store.set(function (s) {
      var next = typeof v === 'function' ? v(s.deviceCategories) : v;
      DeviceCategoryUtils.syncDeviceCategoryOptions(next);
      return { deviceCategories: next };
    });
  }

  function setServiceLevels(v) {
    store.set(function (s) {
      var next = typeof v === 'function' ? v(s.serviceLevels) : v;
      ServiceLevelUtils.syncServiceLevelOptions(next);
      return { serviceLevels: next };
    });
  }

  function setAssignees(v) {
    store.set(function (s) {
      var next = typeof v === 'function' ? v(s.assignees) : v;
      AssigneeUtils.syncAssigneeOptions(next);
      return { assignees: next };
    });
  }

  function setProcessMethods(v) {
    store.set(function (s) {
      var next = typeof v === 'function' ? v(s.processMethods) : v;
      ProcessMethodUtils.syncProcessMethodOptions(next);
      return { processMethods: next };
    });
  }

  function setCurrentTopMenu(menu) {
    var s = store.get();
    var nextView;
    var nextExpanded = s.expandedSidebar.slice();
    if (menu === '案件排程') {
      nextView = SCHEDULING_SUBMENU_DEFAULT_VIEW[s.schedulingSubMenu] || 'arrangement';
    } else if (menu === '報表統計') {
      nextView = REPORTS_SUBMENU_DEFAULT_VIEW[s.reportsSubMenu] || 'case-performance';
    } else if (menu === '系統權限') {
      nextView = PERMISSIONS_SUBMENU_DEFAULT_VIEW[s.permissionsSubMenu] || 'account-list';
    } else {
      nextView = WARROOM_SUBMENU_DEFAULT_VIEW[s.currentSubMenu] || 'list';
    }
    store.set({ currentTopMenu: menu, view: nextView, expandedSidebar: nextExpanded, mobileSidebarOpen: false });
    writeLS('iess:currentTopMenu', menu);
  }

  function setCurrentSubMenu(sub) {
    var defaultView = WARROOM_SUBMENU_DEFAULT_VIEW[sub];
    store.set({
      currentSubMenu: sub,
      view: defaultView || store.get().view,
      mobileSidebarOpen: false
    });
    writeLS('iess:currentSubMenu', sub);
  }

  function setSchedulingSubMenu(sub) {
    var defaultView = SCHEDULING_SUBMENU_DEFAULT_VIEW[sub];
    store.set({
      schedulingSubMenu: sub,
      view: defaultView || store.get().view,
      mobileSidebarOpen: false
    });
    writeLS('iess:schedulingSubMenu', sub);
  }

  function setReportsSubMenu(sub) {
    var defaultView = REPORTS_SUBMENU_DEFAULT_VIEW[sub];
    store.set({
      reportsSubMenu: sub,
      view: defaultView || store.get().view,
      mobileSidebarOpen: false
    });
    writeLS('iess:reportsSubMenu', sub);
  }

  function setPermissionsSubMenu(sub) {
    var defaultView = PERMISSIONS_SUBMENU_DEFAULT_VIEW[sub];
    store.set({
      permissionsSubMenu: sub,
      view: defaultView || store.get().view,
      mobileSidebarOpen: false
    });
    writeLS('iess:permissionsSubMenu', sub);
  }

  function setMobileSidebarOpen(open) {
    store.set({ mobileSidebarOpen: !!open });
  }

  function toggleMobileSidebar() {
    store.set(function (s) {
      return { mobileSidebarOpen: !s.mobileSidebarOpen };
    });
  }

  function toggleExpand(id) {
    store.set(function (s) {
      var has = s.expandedSidebar.indexOf(id) !== -1;
      return {
        expandedSidebar: has
          ? s.expandedSidebar.filter(function (x) { return x !== id; })
          : s.expandedSidebar.concat([id])
      };
    });
  }

  function openAddRepairCase() {
    var s = store.get();
    var expanded = s.expandedSidebar.indexOf('維修服務') === -1
      ? s.expandedSidebar.concat(['維修服務'])
      : s.expandedSidebar;
    store.set({
      currentTopMenu: '戰情室',
      currentSubMenu: '案件處理',
      view: 'add',
      expandedSidebar: expanded,
      mobileSidebarOpen: false
    });
    writeLS('iess:currentTopMenu', '戰情室');
    writeLS('iess:currentSubMenu', '案件處理');
  }

  // --- 依 view 對應到功能元件（戰情室） ---
  function renderWarroomView(s) {
    var v = s.view;
    switch (v) {
      case 'list':
        return h(CaseList, {
          cases: s.cases, setCases: setCasesData, stores: s.stores, setStores: setStores,
          setEditingCase: setEditingCase, setView: setView, showToast: showToast,
          statusFilter: s.statusFilter, setStatusFilter: setStatusFilter
        });
      case 'add':
        return h(AddCaseForm, {
          cases: s.cases, setCases: setCasesData, stores: s.stores, customers: s.customers,
          setView: setView, showToast: showToast,
          currentOperatorName: getCurrentOperatorName(s.accounts, s.currentAccountId)
        });
      case 'edit':
        return h(EditCaseForm, {
          editingCase: s.editingCase, cases: s.cases, setCases: setCasesData,
          stores: s.stores, customers: s.customers, equipments: s.equipments,
          deviceCategories: s.deviceCategories,
          processMethods: s.processMethods,
          setView: setView, showToast: showToast,
          currentOperatorName: getCurrentOperatorName(s.accounts, s.currentAccountId)
        });
      case 'record-list':
        return h(CaseRecordList, {
          cases: s.cases, setViewingCase: setViewingCase, setView: setView
        });
      case 'record-view':
        return h(ViewCaseForm, {
          viewingCase: s.viewingCase, setView: setView, backView: 'record-list',
          processMethods: s.processMethods, deviceCategories: s.deviceCategories
        });
      case 'review-list':
        return h(CaseReviewList, {
          cases: s.cases, setCases: setCasesData,
          maintenanceCases: s.maintenanceCases, setMaintenanceCases: setMaintenanceCases,
          assignees: s.assignees,
          serviceLevels: s.serviceLevels,
          setViewingCase: setViewingCase, setView: setView, showToast: showToast
        });
      case 'review-view':
        return h(ViewCaseForm, {
          viewingCase: s.viewingCase, setView: setView, backView: 'review-list',
          processMethods: s.processMethods, deviceCategories: s.deviceCategories
        });
      case 'maintenance-list':
        return h(MaintenanceList, {
          cases: s.maintenanceCases, setCases: setMaintenanceCases,
          stores: s.stores, setStores: setStores, customers: s.customers,
          setViewingCase: setViewingCase, setEditingCase: setEditingCase,
          setView: setView, showToast: showToast
        });
      case 'maintenance-view':
        return h(MaintenanceViewEditForm, {
          targetCase: s.viewingCase, stores: s.stores, customers: s.customers,
          setView: setView, mode: 'view', showToast: showToast, backView: 'maintenance-list'
        });
      case 'review-maintenance-view':
        return h(MaintenanceViewEditForm, {
          targetCase: s.viewingCase, stores: s.stores, customers: s.customers,
          setView: setView, mode: 'view', showToast: showToast, backView: 'review-list'
        });
      case 'maintenance-edit':
        return h(MaintenanceViewEditForm, {
          targetCase: s.editingCase, cases: s.maintenanceCases, setCases: setMaintenanceCases,
          stores: s.stores, setStores: setStores, customers: s.customers,
          setView: setView, mode: 'edit', showToast: showToast
        });
      case 'project-list':
        return h(ProjectList, {
          cases: s.projectCases, setCases: setProjectCases, customers: s.customers,
          setEditingCase: setEditingCase, setView: setView, showToast: showToast
        });
      case 'project-add':
        return h(AddProjectForm, {
          cases: s.projectCases, setCases: setProjectCases, stores: s.stores,
          customers: s.customers, deviceCategories: s.deviceCategories,
          setView: setView, showToast: showToast
        });
      case 'project-edit':
        return h(EditProjectForm, {
          editingCase: s.editingCase, cases: s.projectCases, setCases: setProjectCases,
          stores: s.stores, customers: s.customers, accounts: s.accounts,
          deviceCategories: s.deviceCategories, repairCases: s.cases,
          setView: setView, showToast: showToast
        });
      case 'survey-list':
        return h(SurveyList, {
          cases: s.surveyCases, setCases: setSurveyCases, setEditingCase: setEditingCase,
          setView: setView, showToast: showToast, deviceCategories: s.deviceCategories
        });
      case 'survey-add':
        return h(SurveyForm, {
          cases: s.surveyCases, setCases: setSurveyCases, stores: s.stores,
          customers: s.customers, deviceCategories: s.deviceCategories,
          setView: setView, showToast: showToast
        });
      case 'survey-edit':
        return h(SurveyForm, {
          cases: s.surveyCases, setCases: setSurveyCases, stores: s.stores,
          customers: s.customers, deviceCategories: s.deviceCategories,
          targetCase: s.editingCase, setView: setView, showToast: showToast
        });
      case 'customer-list':
        return h(CustomerList, {
          cases: s.customers, setCases: setCustomers, serviceLevels: s.serviceLevels,
          setEditingCase: setEditingCase, setView: setView, showToast: showToast
        });
      case 'customer-add':
        return h(CustomerForm, {
          cases: s.customers, setCases: setCustomers, serviceLevels: s.serviceLevels,
          setView: setView, showToast: showToast
        });
      case 'customer-edit':
        return h(CustomerForm, {
          cases: s.customers, setCases: setCustomers, targetCase: s.editingCase,
          serviceLevels: s.serviceLevels, setView: setView, showToast: showToast
        });
      case 'store-list':
        return h(StoreList, {
          stores: s.stores, setStores: setStores, customers: s.customers,
          storeCustomer: s.storeCustomer, setStoreCustomer: setStoreCustomer,
          setEditingCase: setEditingCase,
          openStoreEdit: openStoreEdit, openStoreHistory: openStoreHistory,
          setView: setView, showToast: showToast
        });
      case 'store-history':
        return h(StoreHistory, {
          store: s.historyStore,
          cases: s.cases,
          maintenanceCases: s.maintenanceCases,
          projectCases: s.projectCases,
          equipments: s.equipments,
          openStoreHistoryDetail: openStoreHistoryDetail,
          setHistoryStore: setHistoryStore,
          setView: setView,
          backView: s.customerBackView || 'store-list',
          clearCustomerBackView: clearCustomerBackView
        });
      case 'store-history-repair-view':
        return h(ViewCaseForm, {
          viewingCase: StoreUtils.withStoreHistoryContext(s.viewingCase, s.historyStore),
          setView: setView, backView: 'store-history',
          processMethods: s.processMethods, deviceCategories: s.deviceCategories
        });
      case 'store-history-maintenance-view':
        return h(MaintenanceViewEditForm, {
          targetCase: StoreUtils.withStoreHistoryContext(s.viewingCase, s.historyStore),
          stores: s.stores, customers: s.customers,
          setView: setView, mode: 'view', showToast: showToast, backView: 'store-history'
        });
      case 'store-history-project-view':
        return h(EditProjectForm, {
          editingCase: StoreUtils.withStoreHistoryContext(s.editingCase, s.historyStore),
          cases: s.projectCases, setCases: setProjectCases,
          stores: s.stores, customers: s.customers, accounts: s.accounts,
          deviceCategories: s.deviceCategories, repairCases: s.cases,
          setView: setView, showToast: showToast,
          backView: 'store-history',
          mode: 'view'
        });
      case 'store-add':
        return h(StoreForm, {
          stores: s.stores, setStores: setStores, customers: s.customers,
          storeCustomer: s.storeCustomer, setView: setView, showToast: showToast
        });
      case 'store-edit':
        return h(StoreForm, {
          stores: s.stores, setStores: setStores, customers: s.customers,
          targetCase: s.editingCase, storeCustomer: s.storeCustomer,
          setView: setView, showToast: showToast,
          backView: s.customerBackView || 'store-list',
          clearCustomerBackView: clearCustomerBackView
        });
      case 'store-repair-add':
        return h(StoreRepairForm, {
          store: s.editingCase, cases: s.cases, setCases: setCasesData,
          stores: s.stores, setStores: setStores,
          setView: setView, showToast: showToast
        });
      case 'store-project-add':
        return h(StoreProjectForm, {
          store: s.editingCase, cases: s.projectCases, setCases: setProjectCases,
          deviceCategories: s.deviceCategories,
          setView: setView, showToast: showToast
        });
      case 'equipment-list':
        return h(EquipmentList, {
          equipments: s.equipments, setEquipments: setEquipments,
          customers: s.customers, stores: s.stores,
          deviceCategories: s.deviceCategories,
          repairCases: s.cases, projectCases: s.projectCases, setProjectCases: setProjectCases,
          equipmentCustomer: s.equipmentCustomer, setEquipmentCustomer: setEquipmentCustomer,
          equipmentStore: s.equipmentStore, setEquipmentStore: setEquipmentStore,
          openStoreEdit: openStoreEdit, openStoreHistory: openStoreHistory,
          setEditingCase: setEditingCase, setView: setView, showToast: showToast
        });
      case 'equipment-add':
        return h(EquipmentForm, {
          equipments: s.equipments, setEquipments: setEquipments,
          deviceCategories: s.deviceCategories,
          equipmentCustomer: s.equipmentCustomer, equipmentStore: s.equipmentStore,
          setView: setView, showToast: showToast
        });
      case 'equipment-edit':
        return h(EquipmentForm, {
          equipments: s.equipments, setEquipments: setEquipments,
          deviceCategories: s.deviceCategories,
          targetCase: s.editingCase,
          equipmentCustomer: s.equipmentCustomer, equipmentStore: s.equipmentStore,
          setView: setView, showToast: showToast
        });
      default:
        return null;
    }
  }

  function renderSchedulingView(s) {
    switch (s.view) {
      case 'arrangement':
        return h(CaseArrangement, {
          maintenanceCases: s.maintenanceCases,
          setMaintenanceCases: setMaintenanceCases,
          cases: s.cases,
          setCases: setCasesData,
          projectCases: s.projectCases,
          setProjectCases: setProjectCases,
          personnelStatus: s.personnelStatus,
          setPersonnelStatus: setPersonnelStatus,
          customers: s.customers,
          stores: s.stores,
          assignees: s.assignees,
          processMethods: s.processMethods,
          deviceCategories: s.deviceCategories,
          showToast: showToast
        });
      case 'personnel-movement':
        return h(PersonnelMovement, {
          maintenanceCases: s.maintenanceCases,
          cases: s.cases,
          projectCases: s.projectCases,
          showToast: showToast
        });
      case 'gps':
        return h(GpsTracking);
      default:
        return null;
    }
  }

  function renderReportsView(s) {
    switch (s.view) {
      case 'case-performance':
        return h(CasePerformanceStats, {
          cases: s.cases,
          maintenanceCases: s.maintenanceCases,
          assignees: s.assignees,
          maintenanceAllocations: s.maintenanceAllocations,
          maintenanceAllocationYears: s.maintenanceAllocationYears,
          stores: s.stores,
          performanceAreas: s.performanceAreas,
          serviceLevels: s.serviceLevels
        });
      case 'data-retrieval':
        return h(DataRetrieval, {
          cases: s.cases,
          maintenanceCases: s.maintenanceCases,
          projectCases: s.projectCases,
          customers: s.customers,
          stores: s.stores,
          showToast: showToast
        });
      default:
        return null;
    }
  }

  function renderPermissionsView(s) {
    switch (s.view) {
      case 'account-list':
        return h(AccountList, {
          accounts: s.accounts,
          setAccounts: setAccounts,
          assignees: s.assignees,
          setAssignees: setAssignees,
          setEditingCase: setEditingCase,
          setView: setView,
          showToast: showToast
        });
      case 'account-add':
        return h(AccountForm, {
          accounts: s.accounts,
          setAccounts: setAccounts,
          setView: setView,
          showToast: showToast,
          currentAccountId: s.currentAccountId
        });
      case 'account-edit':
        return h(AccountForm, {
          accounts: s.accounts,
          setAccounts: setAccounts,
          targetCase: s.editingCase,
          setView: setView,
          showToast: showToast,
          currentAccountId: s.currentAccountId
        });
      case 'assignee-list':
        return h(AssigneeList, {
          assignees: s.assignees,
          setAssignees: setAssignees,
          accounts: s.accounts,
          cases: s.cases,
          maintenanceCases: s.maintenanceCases,
          projectCases: s.projectCases,
          setEditingCase: setEditingCase,
          setView: setView,
          showToast: showToast
        });
      case 'assignee-add':
        return h(AssigneeForm, {
          assignees: s.assignees,
          setAssignees: setAssignees,
          accounts: s.accounts,
          cases: s.cases,
          setCases: setCasesData,
          maintenanceCases: s.maintenanceCases,
          setMaintenanceCases: setMaintenanceCases,
          projectCases: s.projectCases,
          setProjectCases: setProjectCases,
          setView: setView,
          showToast: showToast
        });
      case 'assignee-edit':
        return h(AssigneeForm, {
          assignees: s.assignees,
          setAssignees: setAssignees,
          accounts: s.accounts,
          cases: s.cases,
          setCases: setCasesData,
          maintenanceCases: s.maintenanceCases,
          setMaintenanceCases: setMaintenanceCases,
          projectCases: s.projectCases,
          setProjectCases: setProjectCases,
          targetCase: s.editingCase,
          setView: setView,
          showToast: showToast
        });
      case 'device-category-list':
        return h(DeviceCategoryList, {
          deviceCategories: s.deviceCategories,
          setDeviceCategories: setDeviceCategories,
          equipments: s.equipments,
          setEditingCase: setEditingCase,
          setView: setView,
          showToast: showToast
        });
      case 'device-category-add':
        return h(DeviceCategoryForm, {
          deviceCategories: s.deviceCategories,
          setDeviceCategories: setDeviceCategories,
          setView: setView,
          showToast: showToast
        });
      case 'device-category-edit':
        return h(DeviceCategoryForm, {
          deviceCategories: s.deviceCategories,
          setDeviceCategories: setDeviceCategories,
          targetCase: s.editingCase,
          setView: setView,
          showToast: showToast
        });
      case 'service-level-list':
        return h(ServiceLevelList, {
          serviceLevels: s.serviceLevels,
          setServiceLevels: setServiceLevels,
          customers: s.customers,
          stores: s.stores,
          cases: s.cases,
          maintenanceCases: s.maintenanceCases,
          projectCases: s.projectCases,
          surveyCases: s.surveyCases,
          personnelStatus: s.personnelStatus,
          setEditingCase: setEditingCase,
          setView: setView,
          showToast: showToast
        });
      case 'service-level-add':
        return h(ServiceLevelForm, {
          serviceLevels: s.serviceLevels,
          setServiceLevels: setServiceLevels,
          customers: s.customers, setCustomers: setCustomers,
          stores: s.stores, setStores: setStores,
          cases: s.cases, setCases: setCasesData,
          maintenanceCases: s.maintenanceCases, setMaintenanceCases: setMaintenanceCases,
          projectCases: s.projectCases, setProjectCases: setProjectCases,
          surveyCases: s.surveyCases, setSurveyCases: setSurveyCases,
          personnelStatus: s.personnelStatus, setPersonnelStatus: setPersonnelStatus,
          setView: setView,
          showToast: showToast
        });
      case 'service-level-edit':
        return h(ServiceLevelForm, {
          serviceLevels: s.serviceLevels,
          setServiceLevels: setServiceLevels,
          customers: s.customers, setCustomers: setCustomers,
          stores: s.stores, setStores: setStores,
          cases: s.cases, setCases: setCasesData,
          maintenanceCases: s.maintenanceCases, setMaintenanceCases: setMaintenanceCases,
          projectCases: s.projectCases, setProjectCases: setProjectCases,
          surveyCases: s.surveyCases, setSurveyCases: setSurveyCases,
          personnelStatus: s.personnelStatus, setPersonnelStatus: setPersonnelStatus,
          targetCase: s.editingCase,
          setView: setView,
          showToast: showToast
        });
      case 'process-method-list':
        return h(ProcessMethodList, {
          processMethods: s.processMethods,
          setProcessMethods: setProcessMethods,
          cases: s.cases,
          maintenanceCases: s.maintenanceCases,
          projectCases: s.projectCases,
          setEditingCase: setEditingCase,
          setView: setView,
          showToast: showToast
        });
      case 'process-method-add':
        return h(ProcessMethodForm, {
          processMethods: s.processMethods,
          setProcessMethods: setProcessMethods,
          setView: setView,
          showToast: showToast
        });
      case 'process-method-edit':
        return h(ProcessMethodForm, {
          processMethods: s.processMethods,
          setProcessMethods: setProcessMethods,
          targetCase: s.editingCase,
          setView: setView,
          showToast: showToast
        });
      case 'maintenance-allocation':
        return h(MaintenanceAllocation, {
          assignees: s.assignees,
          customers: s.customers,
          stores: s.stores,
          maintenanceCases: s.maintenanceCases,
          serviceLevels: s.serviceLevels,
          maintenanceAllocations: s.maintenanceAllocations,
          setMaintenanceAllocations: setMaintenanceAllocations,
          maintenanceAllocationYears: s.maintenanceAllocationYears,
          setMaintenanceAllocationYears: setMaintenanceAllocationYears,
          showToast: showToast
        });
      case 'performance-area-list':
        return h(PerformanceAreaList, {
          performanceAreas: s.performanceAreas,
          setPerformanceAreas: setPerformanceAreas,
          setEditingCase: setEditingCase,
          setView: setView,
          showToast: showToast
        });
      case 'performance-area-add':
        return h(PerformanceAreaForm, {
          performanceAreas: s.performanceAreas,
          setPerformanceAreas: setPerformanceAreas,
          setView: setView,
          showToast: showToast
        });
      case 'performance-area-edit':
        return h(PerformanceAreaForm, {
          performanceAreas: s.performanceAreas,
          setPerformanceAreas: setPerformanceAreas,
          targetCase: s.editingCase,
          setView: setView,
          showToast: showToast
        });
      default:
        return null;
    }
  }

  function renderMain(s) {
    if (s.currentTopMenu === '案件排程') {
      if (SCHEDULING_SUBMENUS.indexOf(s.schedulingSubMenu) === -1) {
        return h('div', { className: 'flex items-center justify-center h-64 text-gray-400' },
          h('p', { className: 'text-xl' }, '此為「' + s.schedulingSubMenu + '」功能，請點選選單查看實作'));
      }
      return renderSchedulingView(s);
    }
    if (s.currentTopMenu === '報表統計') {
      if (REPORTS_SUBMENUS.indexOf(s.reportsSubMenu) === -1) {
        return h('div', { className: 'flex items-center justify-center h-64 text-gray-400' },
          h('p', { className: 'text-xl' }, '此為「' + s.reportsSubMenu + '」功能，請點選選單查看實作'));
      }
      return renderReportsView(s);
    }
    if (s.currentTopMenu === '系統權限') {
      if (PERMISSIONS_SUBMENUS.indexOf(s.permissionsSubMenu) === -1) {
        return h('div', { className: 'flex items-center justify-center h-64 text-gray-400' },
          h('p', { className: 'text-xl' }, '此為「' + s.permissionsSubMenu + '」功能，請點選選單查看實作'));
      }
      return renderPermissionsView(s);
    }
    if (WARROOM_SUBMENUS.indexOf(s.currentSubMenu) === -1) {
      return h('div', { className: 'flex items-center justify-center h-64 text-gray-400' },
        h('p', { className: 'text-xl' }, '此為「' + s.currentSubMenu + '」功能，請點選選單查看實作'));
    }
    return renderWarroomView(s);
  }

  function renderSidebarSlot(s, sidebarEl) {
    if (!sidebarEl) return null;
    return h(Fragment, null,
      s.mobileSidebarOpen && h('div', {
        className: 'app-sidebar-backdrop app-sidebar-backdrop--visible',
        onClick: function () { setMobileSidebarOpen(false); },
        'aria-hidden': 'true'
      }),
      h('div', {
        className: 'app-sidebar-slot' + (s.mobileSidebarOpen ? ' app-sidebar-slot--open' : '')
      }, sidebarEl)
    );
  }

  function App(s) {
    var quickActions = [
      {
        id: 'add-repair-case',
        label: '新增叫修案件',
        icon: 'Plus',
        variant: 'primary',
        onClick: openAddRepairCase
      }
    ];

    var sidebarEl = s.currentTopMenu === '戰情室'
      ? h(Sidebar, {
          currentSubMenu: s.currentSubMenu,
          expandedSidebar: s.expandedSidebar,
          setCurrentSubMenu: setCurrentSubMenu,
          toggleExpand: toggleExpand,
          onClose: function () { setMobileSidebarOpen(false); }
        })
      : s.currentTopMenu === '案件排程'
        ? h(SchedulingSidebar, {
            currentSubMenu: s.schedulingSubMenu,
            setCurrentSubMenu: setSchedulingSubMenu,
            onClose: function () { setMobileSidebarOpen(false); }
          })
        : s.currentTopMenu === '報表統計'
          ? h(ReportsSidebar, {
              currentSubMenu: s.reportsSubMenu,
              setCurrentSubMenu: setReportsSubMenu,
              onClose: function () { setMobileSidebarOpen(false); }
            })
          : s.currentTopMenu === '系統權限'
            ? h(PermissionsSidebar, {
                currentSubMenu: s.permissionsSubMenu,
                expandedSidebar: s.expandedSidebar,
                setCurrentSubMenu: setPermissionsSubMenu,
                toggleExpand: toggleExpand,
                onClose: function () { setMobileSidebarOpen(false); }
              })
            : null;

    return h('div', { className: 'h-screen bg-gray-100 flex flex-col font-sans overflow-hidden' },
      h(Header, {
        currentTopMenu: s.currentTopMenu,
        setCurrentTopMenu: setCurrentTopMenu,
        quickActions: quickActions,
        onMenuToggle: toggleMobileSidebar,
        mobileSidebarOpen: s.mobileSidebarOpen
      }),
      h('div', { className: 'flex flex-1 overflow-hidden min-h-0' },
        renderSidebarSlot(s, sidebarEl),
        h('main', { className: 'flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 w-full min-w-0' },
          h('div', { className: 'max-w-[1600px] mx-auto w-full' }, renderMain(s))
        )
      )
    );
  }

  ServiceLevelUtils.syncServiceLevelOptions(INITIAL_SERVICE_LEVELS);
  DeviceCategoryUtils.syncDeviceCategoryOptions(INITIAL_DEVICE_CATEGORIES);
  ProcessMethodUtils.syncProcessMethodOptions(INITIAL_PROCESS_METHODS);
  AssigneeUtils.syncAssigneeOptions(INITIAL_ASSIGNEES);
  AccountUtils.syncProjectPersonOptions(INITIAL_ACCOUNTS);

  var root = document.getElementById('root');
  function draw() {
    var s = store.get();
    var isMobile = window.matchMedia('(max-width: 767px)').matches;
    document.body.style.overflow = s.mobileSidebarOpen && isMobile ? 'hidden' : '';
    mount(root, App(s));
  }
  store.subscribe(draw);
  draw();
})();
