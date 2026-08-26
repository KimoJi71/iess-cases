/*
 * features/repair/maintenance.js — 保養：保養列表 + 保養明細檢視/編輯
 * props:
 *   MaintenanceList         { cases, setCases, stores, setStores, customers, serviceLevels, setViewingCase, setEditingCase, setView, showToast }
 *   MaintenanceViewEditForm { targetCase, cases, setCases, stores, setStores, setView, mode, showToast, backView }
 */
(function () {
  'use strict';
  var h = IESS.h, Fragment = IESS.Fragment, Icons = IESS.Icons,
      stateful = IESS.stateful;

  function getMaintenanceStatusTone(status) {
    if (status === '已完成') return 'green';
    if (status === '已預約') return 'blue';
    return 'gray';
  }

  function closeMaintenanceCase(id, cases, setCases, stores, setStores, showToast) {
    var target = cases.find(function (c) { return c.id === id; });
    if (!target) return;
    var stamp = IESS.caseDateTime.now();
    var completionDate = target.completionDate
      || MaintenanceDetailSections.resolveMaintenanceCompletionDate(target);
    var closedCase = Object.assign({}, target, {
      isClosed: true,
      status: '已完成',
      completionDate: completionDate,
      closeDate: stamp,
      repairDate: completionDate
    });
    MaintenanceDetailSections.updateStoreLastMaintenanceDate(stores, setStores, closedCase);
    setCases(cases.map(function (c) {
      return c.id === id ? closedCase : c;
    }));
    showToast('保養單已結案並移至銷案審核');
  }

  function canCloseMaintenanceCase(c) {
    return !!(c && c.status === '已完成' && !c.isClosed);
  }

  function MaintenanceList(props) {
    var cases = props.cases;
    var setCases = props.setCases;
    var stores = props.stores;
    var setStores = props.setStores;
    var customers = props.customers;
    var serviceLevels = props.serviceLevels;
    var setViewingCase = props.setViewingCase;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;
    var vendors = props.vendors || [];

    function handleExportPdf(c) {
      if (typeof exportMaintenancePdf !== 'function') {
        showToast('PDF 匯出功能尚未載入', 'error');
        return;
      }
      showToast('正在產生 PDF…');
      exportMaintenancePdf(c, {
        stores: stores,
        customers: customers,
        vendors: vendors,
        onError: function (msg) { showToast(msg || 'PDF 匯出失敗', 'error'); }
      }).then(function () {
        showToast('PDF 已下載：' + [c.customerName, c.storeName].filter(Boolean).join(' '));
      }).catch(function () { /* onError 已提示 */ });
    }

    var filterMonthStart = currentMonthStr;
    var filterMonthEnd = currentMonthStr;
    var filterCustomer = '全部';
    var filterStoreArea = '全部';
    var filterStatus = '全部';
    var appliedFilters = {
      start: currentMonthStr,
      end: currentMonthStr,
      customer: '全部',
      storeArea: '全部',
      status: '全部'
    };
    var closeConfirmModal = { show: false, caseId: null };
    var listPagination = IESS.createListPagination();

    return stateful(function (rerender) {
      function getCasePeriod(c) {
        return ScheduleUtils.resolveCasePeriod(c, customers);
      }

      function matchesPeriodMonthFilter(c) {
        return ScheduleUtils.casePeriodMatchesMonthRange(
          c, customers, appliedFilters.start, appliedFilters.end);
      }

      var customerFilterOptions = CustomerUtils.getCustomerNameOptions(
        customers,
        filterCustomer !== '全部' ? filterCustomer : null,
        true
      );

      function handleSearch() {
        appliedFilters = {
          start: filterMonthStart,
          end: filterMonthEnd,
          customer: filterCustomer,
          storeArea: filterStoreArea,
          status: filterStatus
        };
        listPagination.resetPage();
        rerender();
      }

      var filteredCases = cases.filter(function (c) {
        if (c.isClosed) return false;
        if (appliedFilters.customer !== '全部' && c.customerName !== appliedFilters.customer) return false;
        if (appliedFilters.storeArea !== '全部' && !StoreUtils.matchesRecordArea(c, appliedFilters.storeArea)) return false;
        if (appliedFilters.status !== '全部' && c.status !== appliedFilters.status) return false;
        if (!matchesPeriodMonthFilter(c)) return false;
        // 客戶設定「於開幕 N 個月後開始保養」時，未滿期的門市不出現在保養計劃。
        // 只擋這份列表——案件排程待辦、銷案審核、叫修紀錄不受影響。
        if (!ScheduleUtils.caseMaintenanceStarted(c, customers, stores)) return false;
        // 門市狀態為「整裝」「撤店」，或「正常營業」但「是否保養」為否時不列示。
        // 查無門市時不擋（與 caseMaintenanceStarted 一致，資料不全的案件不該無聲消失）。
        var store = ScheduleUtils.resolveStore(stores, c.customerName, c.storeName);
        if (store && !StoreUtils.isMaintainableStore(store, serviceLevels)) return false;
        return true;
      }).sort(function (a, b) {
        var aDate = a.planDate || a.dueMonth || '1970-01-01';
        var bDate = b.planDate || b.dueMonth || '1970-01-01';
        return new Date(bDate) - new Date(aDate);
      });
      var pageResult = listPagination.slice(filteredCases);

      var storeAreaOptions = StoreUtils.getAreaOptionsFromStores(stores);

      return h("div", {
        className: "bg-white p-6 rounded-lg shadow-sm border border-gray-100"
      }, h("div", {
        className: "bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6"
      }, h("div", {
        className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-end"
      }, h("div", { className: "min-w-0" }, h("label", {
        className: "block text-xs text-gray-500 mb-1"
      }, "開始月份"), h("input", {
        type: "month",
        value: filterMonthStart,
        onChange: function (e) { filterMonthStart = e.target.value; rerender(); },
        className: "w-full p-2.5 border rounded-md outline-none bg-white"
      })), h("div", { className: "min-w-0" }, h("label", {
        className: "block text-xs text-gray-500 mb-1"
      }, "結束月份"), h("input", {
        type: "month",
        value: filterMonthEnd,
        onChange: function (e) { filterMonthEnd = e.target.value; rerender(); },
        className: "w-full p-2.5 border rounded-md outline-none bg-white"
      })), h("div", { className: "min-w-0" }, h("label", {
        className: "block text-xs text-gray-500 mb-1"
      }, "客戶名稱"), h("select", {
        value: filterCustomer,
        onChange: function (e) { filterCustomer = e.target.value; rerender(); },
        className: "w-full p-2.5 border rounded-md outline-none bg-white"
      }, h("option", {
        value: "全部"
      }, "全部"), customerFilterOptions.map(function (opt) {
        return h("option", { key: opt, value: opt }, opt);
      }))), h("div", { className: "min-w-0" }, h("label", {
        className: "block text-xs text-gray-500 mb-1"
      }, "行政區域"), h("select", {
        value: filterStoreArea,
        onChange: function (e) { filterStoreArea = e.target.value; rerender(); },
        className: "w-full p-2.5 border rounded-md outline-none bg-white"
      }, h("option", {
        value: "全部"
      }, "全部"), storeAreaOptions.map(function (d) {
        return h("option", { key: d, value: d }, d);
      }))), h("div", { className: "min-w-0" }, h("label", {
        className: "block text-xs text-gray-500 mb-1"
      }, "保養狀態"), h("select", {
        value: filterStatus,
        onChange: function (e) { filterStatus = e.target.value; rerender(); },
        className: "w-full p-2.5 border rounded-md outline-none bg-white"
      }, h("option", {
        value: "全部"
      }, "全部"), MAINTENANCE_STATUS_OPTIONS.map(function (s) {
        return h("option", { key: s, value: s }, s);
      }))), h("div", { className: "min-w-0 flex items-end" }, h("button", {
        type: "button",
        onClick: handleSearch,
        className: "w-full xl:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md flex items-center justify-center gap-1.5 whitespace-nowrap min-h-[42px] transition-colors"
      }, Icons.Search({
        className: "h-4 w-4 shrink-0"
      }), "搜尋")))), h("div", {
        className: "overflow-x-auto border rounded-lg"
      }, h("table", {
        className: "w-full text-left text-sm text-gray-600 whitespace-nowrap"
      }, h("thead", {
        className: "bg-gray-50 text-gray-700 border-b"
      }, h("tr", null, h("th", {
        className: "p-3 font-semibold text-center w-px whitespace-nowrap"
      }, "操作"), h("th", {
        className: "p-3 font-semibold"
      }, "客戶名稱"), h("th", {
        className: "p-3 font-semibold"
      }, "門市名稱"), h("th", {
        className: "p-3 font-semibold"
      }, "行政區域"), h("th", {
        className: "p-3 font-semibold text-center"
      }, "服務等級"), h("th", {
        className: "p-3 font-semibold text-center"
      }, "保養狀態"), h("th", {
        className: "p-3 font-semibold"
      }, "保養區間"), h("th", {
        className: "p-3 font-semibold"
      }, "保養日期"), h("th", {
        className: "p-3 font-semibold"
      }, "保養時間"), h("th", {
        className: "p-3 font-semibold"
      }, "完成時間"), h("th", {
        className: "p-3 font-semibold"
      }, "組別"), h("th", {
        className: "p-3 font-semibold"
      }, "指派人員"), h("th", {
        className: "p-3 font-semibold"
      }, "退回原因"))), h("tbody", {
        className: "divide-y divide-gray-100"
      }, filteredCases.length === 0 ? h("tr", null, h("td", {
        colspan: "13",
        className: "text-center p-8 text-gray-400"
      }, "無符合條件之保養資料")) : pageResult.items.map(function (c) {
        var canClose = canCloseMaintenanceCase(c);
        return h("tr", {
          key: c.id,
          className: "hover:bg-blue-50/50 transition-colors"
        }, h("td", {
          className: "p-3"
        }, h("div", {
          className: "flex items-center justify-center flex-nowrap gap-1"
        }, h("button", {
          onClick: function () {
            setEditingCase(c);
            setView('maintenance-edit');
          },
          className: "p-1.5 text-blue-600 hover:bg-blue-100 rounded",
          title: "編輯"
        }, Icons.Edit({
          className: "h-4 w-4"
        })), h("button", {
          type: "button",
          disabled: !canClose,
          onClick: function () {
            if (!canClose) return;
            closeConfirmModal = { show: true, caseId: c.id };
            rerender();
          },
          className: "p-1.5 text-green-600 hover:bg-green-100 rounded disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed",
          title: canClose ? "案件結案" : "保養完成後方可結案"
        }, Icons.CheckCircle({
          className: "h-4 w-4"
        })), h("button", {
          type: "button",
          onClick: function () { handleExportPdf(c); },
          className: "p-1.5 text-emerald-600 hover:bg-emerald-100 rounded",
          title: "下載 PDF"
        }, Icons.Download({
          className: "h-4 w-4"
        })))), h("td", {
          className: "p-3 font-medium text-gray-800"
        }, c.customerName), h("td", {
          className: "p-3"
        }, c.storeName), h("td", {
          className: "p-3"
        }, StoreUtils.getRecordArea(c) || '—'), h("td", {
          className: "p-3 text-center"
        }, c.serviceLevel || '—'), h("td", {
          className: "p-3 text-center"
        }, IESS.statusBadge(c.status, getMaintenanceStatusTone(c.status))), h("td", {
          className: "p-3"
        }, ScheduleUtils.formatPeriodRange(getCasePeriod(c))), h("td", {
          className: "p-3"
        }, c.planDate || ''), h("td", {
          className: "p-3"
        }, c.planTimeStart ? (c.planTimeEnd && c.planTimeEnd !== c.planTimeStart
          ? c.planTimeStart + ' ~ ' + c.planTimeEnd : c.planTimeStart) : '-'), h("td", {
          className: "p-3"
        }, IESS.caseDateTime.format(c.completionDate)), h("td", {
          className: "p-3"
        }, CaseAssigneeUtils.formatMaintenanceAssignees(c)), h("td", {
          className: "p-3"
        }, CaseAssigneeUtils.formatAssigneeMembers(c) || '—'), h("td", {
          className: "p-3 max-w-[150px] truncate",
          title: c.returnReason ? ((c.returnedAt ? c.returnedAt + ' ' : '') + c.returnReason) : ''
        }, c.returnReason || '—'));
      })))),
      listPagination.renderBar(pageResult, rerender),
      closeConfirmModal.show && h("div", {
        className: "app-modal-overlay"
      }, h("div", {
        className: "bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4"
      }, h("div", {
        className: "flex items-center space-x-3 text-yellow-600 mb-4"
      }, Icons.AlertCircle({
        className: "h-6 w-6"
      }), h("h3", {
        className: "text-lg font-bold text-gray-800"
      }, "確認結案")), h("p", {
        className: "text-gray-600 mb-6"
      }, "確定要將此保養單標記為結案嗎？結案後狀態將更新並移至「案件銷案審核」列表。"), h("div", {
        className: "flex justify-end space-x-3"
      }, h("button", {
        onClick: function () {
          closeConfirmModal = { show: false, caseId: null };
          rerender();
        },
        className: "px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
      }, "取消"), h("button", {
        onClick: function () {
          closeMaintenanceCase(closeConfirmModal.caseId, cases, setCases, stores, setStores, showToast);
          closeConfirmModal = { show: false, caseId: null };
          rerender();
        },
        className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      }, "確認結案")))));
    });
  }

  function MaintenanceViewEditForm(props) {
    var targetCase = props.targetCase;
    var cases = props.cases;
    var setCases = props.setCases;
    var stores = props.stores;
    var setStores = props.setStores;
    var setView = props.setView;
    var mode = props.mode;
    var showToast = props.showToast;
    var backView = props.backView === undefined ? 'maintenance-list' : props.backView;
    var customers = props.customers;
    var vendors = props.vendors || [];
    var equipments = props.equipments || [];

    // 這一行是表單與 store 記錄之間的隔離邊界：normalizeMaintenanceCase 回傳全新的頂層物件、
    // 且會重建 assignees / equipmentList 等陣列，因此下面 ctx.formData 的就地寫入不會反向影響
    // targetCase。但這只保證「整包替換」安全——若之後改成直接改動它複製來的巢狀物件（例如
    // eq.qty = n），還是會改到 store 內的原始資料，務必整包 REPLACE 而非就地 mutate。
    var formData = CaseAssigneeUtils.normalizeMaintenanceCase(targetCase);
    // 進頁時先依排程資料校正一次保養狀態，避免顯示與判斷規則對不上
    formData.status = MaintenanceDetailSections.resolveProgressStatus(formData);
    // 設備清單改存在 formData 上，排程彈窗的整筆 merge 才帶得走
    formData.equipmentList = (formData.equipmentList || []).slice();
    var isEdit = mode === 'edit';
    var ui = MaintenanceDetailSections.createUiState();

    return stateful(function (rerender) {
      var ctx = {
        formData: formData,
        ui: ui,
        data: { equipments: equipments, vendors: vendors, stores: stores, customers: customers },
        rerender: rerender,
        showToast: showToast,
        include: MaintenanceDetailSections.SECTION_KEYS,
        mode: mode,
        idPrefix: 'maintenance'
      };

      function handleSubmit() {
        var updatedData = Object.assign({}, formData);
        updatedData.status = MaintenanceDetailSections.resolveProgressStatus(updatedData);
        if (updatedData.status === '已完成' && !updatedData.completionDate) {
          updatedData.completionDate = IESS.caseDateTime.now();
        }

        showToast('保養狀態已更新');
        // 保養完成同時押上門市的「上次保養日期」
        if (updatedData.status === '已完成') {
          MaintenanceDetailSections.updateStoreLastMaintenanceDate(stores, setStores, updatedData);
        }
        setCases(cases.map(function (c) {
          return c.id === updatedData.id ? updatedData : c;
        }));
        setView(backView);
      }

      return h("div", { className: "max-w-6xl mx-auto space-y-6" },
        PageHeader({
          title: isEdit ? '編輯保養明細' : '查看保養明細',
          onClose: function () { setView(backView); },
          wrapperClass: 'flex justify-between items-center p-6 bg-white rounded-lg shadow-sm border border-gray-100'
        }),
        MaintenanceDetailSections.renderSections(ctx),
        isEdit && h("div", { className: "flex justify-end gap-3 pb-2" },
          h("button", {
            type: "button",
            onClick: function () { setView(backView); },
            className: "px-6 py-2.5 border rounded-md bg-white"
          }, "取消"),
          h("button", {
            type: "button",
            onClick: handleSubmit,
            className: "px-8 py-2.5 bg-blue-600 text-white rounded-md"
          }, Icons.Save({ className: "inline h-4 w-4 mr-2" }), "儲存")
        ),
        MaintenanceDetailSections.renderOverlays(ctx)
      );
    });
  }

  window.MaintenanceList = MaintenanceList;
  window.MaintenanceViewEditForm = MaintenanceViewEditForm;
})();
