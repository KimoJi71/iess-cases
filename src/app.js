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

  // 依子選單決定預設 view（對應原本的 useEffect 切換邏輯）
  var SUBMENU_DEFAULT_VIEW = {
    '案件處理': 'list',
    '叫修案件紀錄': 'record-list',
    '保養計劃進度': 'maintenance-list',
    '案件銷案審核': 'review-list',
    '工程立案': 'project-list',
    '現勘表收集': 'survey-list',
    '客戶管理': 'customer-list',
    '門市管理': 'store-list'
  };

  var KNOWN_SUBMENUS = Object.keys(SUBMENU_DEFAULT_VIEW);

  var initialSubMenu = readLS('iess:currentSubMenu', '現勘表收集');

  var store = IESS.createStore({
    currentTopMenu: readLS('iess:currentTopMenu', '戰情室'),
    currentSubMenu: initialSubMenu,
    expandedSidebar: ['維修服務', '工程服務', '客戶建檔'],
    view: SUBMENU_DEFAULT_VIEW[initialSubMenu] || 'survey-list',
    cases: INITIAL_CASES,
    maintenanceCases: INITIAL_MAINTENANCE_CASES,
    projectCases: INITIAL_PROJECT_CASES,
    surveyCases: INITIAL_SURVEY_CASES,
    customers: INITIAL_CUSTOMERS,
    stores: INITIAL_STORES,
    storeCustomer: '',
    editingCase: null,
    viewingCase: null,
    statusFilter: '全部'
  });

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
  var setStatusFilter = makeSetter('statusFilter');
  var setStoreCustomer = makeSetter('storeCustomer');
  var setCasesData = makeSetter('cases');
  var setMaintenanceCases = makeSetter('maintenanceCases');
  var setProjectCases = makeSetter('projectCases');
  var setSurveyCases = makeSetter('surveyCases');
  var setCustomers = makeSetter('customers');
  var setStores = makeSetter('stores');

  function setCurrentTopMenu(menu) {
    store.set({ currentTopMenu: menu });
    writeLS('iess:currentTopMenu', menu);
  }

  function setCurrentSubMenu(sub) {
    var defaultView = SUBMENU_DEFAULT_VIEW[sub];
    store.set({ currentSubMenu: sub, view: defaultView || store.get().view });
    writeLS('iess:currentSubMenu', sub);
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

  // --- 依 view 對應到功能元件 ---
  function renderView(s) {
    var v = s.view;
    switch (v) {
      case 'list':
        return h(CaseList, {
          cases: s.cases, setCases: setCasesData, setEditingCase: setEditingCase,
          setView: setView, showToast: showToast,
          statusFilter: s.statusFilter, setStatusFilter: setStatusFilter
        });
      case 'add':
        return h(AddCaseForm, {
          cases: s.cases, setCases: setCasesData, setView: setView, showToast: showToast
        });
      case 'edit':
        return h(EditCaseForm, {
          editingCase: s.editingCase, cases: s.cases, setCases: setCasesData,
          setView: setView, showToast: showToast
        });
      case 'record-list':
        return h(CaseRecordList, {
          cases: s.cases, setViewingCase: setViewingCase, setView: setView
        });
      case 'record-view':
        return h(ViewCaseForm, { viewingCase: s.viewingCase, setView: setView, backView: 'record-list' });
      case 'review-list':
        return h(CaseReviewList, {
          cases: s.cases, setCases: setCasesData, setViewingCase: setViewingCase,
          setView: setView, showToast: showToast
        });
      case 'review-view':
        return h(ViewCaseForm, { viewingCase: s.viewingCase, setView: setView, backView: 'review-list' });
      case 'maintenance-list':
        return h(MaintenanceList, {
          cases: s.maintenanceCases, setCases: setMaintenanceCases, setViewingCase: setViewingCase,
          setEditingCase: setEditingCase, setView: setView, showToast: showToast
        });
      case 'maintenance-view':
        return h(MaintenanceViewEditForm, {
          targetCase: s.viewingCase, setView: setView, mode: 'view', showToast: showToast
        });
      case 'maintenance-edit':
        return h(MaintenanceViewEditForm, {
          targetCase: s.editingCase, cases: s.maintenanceCases, setCases: setMaintenanceCases,
          setView: setView, mode: 'edit', showToast: showToast
        });
      case 'project-list':
        return h(ProjectList, {
          cases: s.projectCases, setCases: setProjectCases, setEditingCase: setEditingCase,
          setView: setView, showToast: showToast
        });
      case 'project-add':
        return h(AddProjectForm, {
          cases: s.projectCases, setCases: setProjectCases, setView: setView, showToast: showToast
        });
      case 'project-edit':
        return h(EditProjectForm, {
          editingCase: s.editingCase, cases: s.projectCases, setCases: setProjectCases,
          setView: setView, showToast: showToast
        });
      case 'survey-list':
        return h(SurveyList, {
          cases: s.surveyCases, setCases: setSurveyCases, setEditingCase: setEditingCase,
          setView: setView, showToast: showToast
        });
      case 'survey-add':
        return h(SurveyForm, {
          cases: s.surveyCases, setCases: setSurveyCases, setView: setView, showToast: showToast
        });
      case 'survey-edit':
        return h(SurveyForm, {
          cases: s.surveyCases, setCases: setSurveyCases, targetCase: s.editingCase,
          setView: setView, showToast: showToast
        });
      case 'customer-list':
        return h(CustomerList, {
          cases: s.customers, setCases: setCustomers, setEditingCase: setEditingCase,
          setView: setView, showToast: showToast
        });
      case 'customer-add':
        return h(CustomerForm, {
          cases: s.customers, setCases: setCustomers, setView: setView, showToast: showToast
        });
      case 'customer-edit':
        return h(CustomerForm, {
          cases: s.customers, setCases: setCustomers, targetCase: s.editingCase,
          setView: setView, showToast: showToast
        });
      case 'store-list':
        return h(StoreList, {
          stores: s.stores, setStores: setStores, customers: s.customers,
          storeCustomer: s.storeCustomer, setStoreCustomer: setStoreCustomer,
          setEditingCase: setEditingCase, setViewingCase: setViewingCase,
          setView: setView, showToast: showToast
        });
      case 'store-history':
        return h(StoreHistory, {
          store: s.viewingCase, setView: setView, showToast: showToast
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
          setView: setView, showToast: showToast
        });
      default:
        return null;
    }
  }

  function renderMain(s) {
    if (s.currentTopMenu !== '戰情室') {
      return h('div', { className: 'flex items-center justify-center h-64 text-gray-400' },
        h('p', { className: 'text-xl' }, '此為「' + s.currentTopMenu + '」模組，正在開發中...'));
    }
    if (KNOWN_SUBMENUS.indexOf(s.currentSubMenu) === -1) {
      return h('div', { className: 'flex items-center justify-center h-64 text-gray-400' },
        h('p', { className: 'text-xl' }, '此為「' + s.currentSubMenu + '」功能，請點選選單查看實作'));
    }
    return renderView(s);
  }

  function App(s) {
    return h('div', { className: 'h-screen bg-gray-100 flex flex-col font-sans overflow-hidden' },
      h(Header, { currentTopMenu: s.currentTopMenu, setCurrentTopMenu: setCurrentTopMenu }),
      h('div', { className: 'flex flex-1 overflow-hidden' },
        s.currentTopMenu === '戰情室' && h(Sidebar, {
          currentSubMenu: s.currentSubMenu,
          expandedSidebar: s.expandedSidebar,
          setCurrentSubMenu: setCurrentSubMenu,
          toggleExpand: toggleExpand
        }),
        h('main', { className: 'flex-1 overflow-y-auto p-6 w-full' },
          h('div', { className: 'max-w-[1600px] mx-auto w-full' }, renderMain(s))
        )
      )
    );
  }

  var root = document.getElementById('root');
  function draw() {
    mount(root, App(store.get()));
  }
  store.subscribe(draw);
  draw();
})();
