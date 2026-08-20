/*
 * features/repair/maintenance.js — 保養：保養列表 + 保養明細檢視/編輯
 * props:
 *   MaintenanceList         { cases, setCases, stores, setStores, setViewingCase, setEditingCase, setView, showToast }
 *   MaintenanceViewEditForm { targetCase, cases, setCases, stores, setStores, setView, mode, showToast, backView }
 */
(function () {
  'use strict';
  var h = IESS.h, Fragment = IESS.Fragment, Icons = IESS.Icons,
      stateful = IESS.stateful, TimeInput24 = IESS.TimeInput24;

  function getMaintenanceStatusBadgeClass(status) {
    if (status === '已完成') return 'bg-green-100 text-green-700';
    if (status === '已預約') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-600';
  }

  function getMaintenanceStatusBadgeClass(status) {
    if (status === '已完成') return 'bg-green-100 text-green-700';
    if (status === '已預約') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-600';
  }

  function resolveMaintenanceCompletionDate(maintenanceCase) {
    return (maintenanceCase && maintenanceCase.planDate) || todayDate;
  }

  function updateStoreLastMaintenanceDate(stores, setStores, maintenanceCase) {
    if (!setStores || !stores || !maintenanceCase) return;
    var completionDate = resolveMaintenanceCompletionDate(maintenanceCase);
    setStores(stores.map(function (s) {
      return s.customerName === maintenanceCase.customerName && s.storeName === maintenanceCase.storeName
        ? Object.assign({}, s, { lastMaintenanceDate: completionDate })
        : s;
    }));
  }

  function closeMaintenanceCase(id, cases, setCases, stores, setStores, showToast) {
    var target = cases.find(function (c) { return c.id === id; });
    if (!target) return;
    var stamp = IESS.caseDateTime.now();
    var completionDate = target.completionDate || resolveMaintenanceCompletionDate(target);
    var closedCase = Object.assign({}, target, {
      isClosed: true,
      status: '已完成',
      completionDate: completionDate,
      closeDate: stamp,
      repairDate: completionDate
    });
    updateStoreLastMaintenanceDate(stores, setStores, closedCase);
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
    var setViewingCase = props.setViewingCase;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;

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
        className: "bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200"
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
      }, "公司區域"), h("select", {
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
        className: "p-3 font-semibold text-center min-w-[88px]"
      }, "操作"), h("th", {
        className: "p-3 font-semibold"
      }, "案件編號"), h("th", {
        className: "p-3 font-semibold"
      }, "客戶名稱"), h("th", {
        className: "p-3 font-semibold"
      }, "門市名稱"), h("th", {
        className: "p-3 font-semibold"
      }, "公司區域"), h("th", {
        className: "p-3 font-semibold text-center"
      }, "服務等級"), h("th", {
        className: "p-3 font-semibold text-center"
      }, "保養狀態"), h("th", {
        className: "p-3 font-semibold"
      }, "工項類別"), h("th", {
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
        colspan: "15",
        className: "text-center p-8 text-gray-400"
      }, "無符合條件之保養資料")) : pageResult.items.map(function (c) {
        var canClose = canCloseMaintenanceCase(c);
        return h("tr", {
          key: c.id,
          className: "hover:bg-blue-50/50 transition-colors"
        }, h("td", {
          className: "p-3"
        }, h("div", {
          className: "flex items-center justify-center flex-wrap gap-1"
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
        })))), h("td", {
          className: "p-3 font-medium text-blue-700"
        }, c.caseNumber || h("span", {
          className: "text-gray-400 italic"
        }, "待產生")), h("td", {
          className: "p-3 font-medium text-gray-800"
        }, c.customerName), h("td", {
          className: "p-3"
        }, c.storeName), h("td", {
          className: "p-3"
        }, StoreUtils.getRecordArea(c) || '—'), h("td", {
          className: "p-3 text-center"
        }, h("span", {
          className: "px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
        }, c.serviceLevel)), h("td", {
          className: "p-3 text-center"
        }, h("span", {
          className: "px-2 py-1 rounded-full text-xs font-medium " + getMaintenanceStatusBadgeClass(c.status)
        }, c.status)), h("td", {
          className: "p-3"
        }, c.workCategory || '保養'), h("td", {
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
    var formData = CaseAssigneeUtils.normalizeMaintenanceCase(targetCase);
    var isEdit = mode === 'edit';

    function getStoreForCase(c) {
      return ScheduleUtils.resolveStore(stores, c && c.customerName, c && c.storeName);
    }

    // 與列表的「保養區間」欄同源同格式，避免兩處對不上
    function getMaintenancePeriodLabel(c) {
      return ScheduleUtils.formatPeriodRange(ScheduleUtils.resolveCasePeriod(c, customers));
    }

    function ReadOnlyField(p) {
      var label = p.label;
      var value = p.value;
      return h("div", null, h("span", {
        className: "text-gray-500 block mb-1 text-xs"
      }, label), h("div", {
        className: "font-medium bg-gray-50 p-2.5 rounded-md border border-gray-100 min-h-[42px]"
      }, value || '-'));
    }

    return stateful(function (rerender) {
      function handleSubmit() {
        var updatedData = Object.assign({}, formData);
        if (updatedData.status !== '已完成') {
          updatedData.status = ScheduleUtils.resolveMaintenanceStatus(updatedData.status, updatedData.planDate);
        } else if (!updatedData.completionDate) {
          updatedData.completionDate = IESS.caseDateTime.now();
        }

        // 如果原本沒有編號，且現在有了保養日期，就產生一組新編號
        if (!updatedData.caseNumber && updatedData.planDate) {
          updatedData.caseNumber = updatedData.planDate.replace(/-/g, '') + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
          showToast('已產生案件編號：' + updatedData.caseNumber);
        } else {
          showToast('保養狀態已更新');
        }
        if (updatedData.status === '已完成') {
          updateStoreLastMaintenanceDate(stores, setStores, updatedData);
        }
        setCases(cases.map(function (c) {
          return c.id === updatedData.id ? updatedData : c;
        }));
        setView(backView);
      }

      return h("div", {
        className: "max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100"
      }, PageHeader({
        title: isEdit ? '編輯保養明細' : '查看保養明細',
        badge: formData.caseNumber || '待產生編號',
        onClose: function () { setView(backView); },
        wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
      }), h("div", {
        className: "p-6 space-y-8"
      }, h("section", null, h("h3", {
        className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4"
      }, "案件與門市資訊"), h("div", {
        className: "grid grid-cols-2 md:grid-cols-3 gap-4"
      }, h(ReadOnlyField, {
        label: "案件編號",
        value: formData.caseNumber || '(依保養日期自動產生)'
      }), h(ReadOnlyField, {
        label: "客戶名稱",
        value: formData.customerName
      }), h(ReadOnlyField, {
        label: "門市名稱",
        value: formData.storeName
      }), h(ReadOnlyField, {
        label: "公司區域",
        value: StoreUtils.getRecordArea(formData) || '—'
      }), h(ReadOnlyField, {
        label: "門市地址",
        value: (getStoreForCase(formData) && StoreUtils.buildFullAddress(getStoreForCase(formData))) || formData.storeAddress
      }), h(ReadOnlyField, {
        label: "服務等級",
        value: formData.serviceLevel
      }), h(ReadOnlyField, {
        label: "保養區間",
        value: getMaintenancePeriodLabel(formData)
      }), h(ReadOnlyField, {
        label: "室內機高度",
        value: (getStoreForCase(formData) || {}).indoorHeight
      }), h(ReadOnlyField, {
        label: "室外機高度",
        value: (getStoreForCase(formData) || {}).outdoorHeight
      }))), h("section", null, h("h3", {
        className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4"
      }, "保養作業狀態"), h("div", {
        className: "grid grid-cols-1 md:grid-cols-3 gap-6"
      }, h("div", null, h("span", {
        className: "text-gray-500 block mb-1 text-xs"
      }, "保養狀態"), isEdit ? h("select", {
        value: formData.status,
        onChange: function (e) { formData = Object.assign({}, formData, { status: e.target.value }); rerender(); },
        className: "w-full p-2.5 border rounded outline-none"
      }, MAINTENANCE_STATUS_OPTIONS.map(function (opt) {
        return h("option", { key: opt, value: opt }, opt);
      })) : h(ReadOnlyField, {
        value: formData.status
      })), h("div", null, h("span", {
        className: "text-gray-500 block mb-1 text-xs"
      }, "保養日期"), isEdit ? h("input", {
        type: "date",
        value: formData.planDate,
        onChange: function (e) { formData = Object.assign({}, formData, { planDate: e.target.value }); rerender(); },
        className: "w-full p-2.5 border rounded outline-none"
      }) : h(ReadOnlyField, {
        value: formData.planDate
      })), h("div", null, h("span", {
        className: "text-gray-500 block mb-1 text-xs"
      }, "組別"), isEdit ? CaseAssigneeFields.renderAssigneeMultiSelect(formData, function (next) {
        formData = Object.assign({}, formData, {
          assignees: next,
          assigneeMemberIds: CaseAssigneeFields.syncMemberIds(next, formData.assigneeMemberIds)
        });
        rerender();
      }, { id: 'maintenance-assignees' }) : h(ReadOnlyField, {
        value: CaseAssigneeUtils.formatMaintenanceAssignees(formData)
      })), h("div", null, h("span", {
        className: "text-gray-500 block mb-1 text-xs"
      }, "指派人員"), isEdit ? CaseAssigneeFields.renderMemberMultiSelect(formData, function (next) {
        formData = Object.assign({}, formData, { assigneeMemberIds: next });
        rerender();
      }, { id: 'maintenance-assignee-members' }) : h(ReadOnlyField, {
        value: CaseAssigneeUtils.formatAssigneeMembers(formData)
      })), h("div", null, h("span", {
        className: "text-gray-500 block mb-1 text-xs"
      }, "保養開始時間"), isEdit ? h(TimeInput24, {
        value: formData.planTimeStart || '',
        onChange: function (e) { formData = Object.assign({}, formData, { planTimeStart: e.target.value }); rerender(); },
        className: "w-full"
      }) : h(ReadOnlyField, {
        value: formData.planTimeStart
      })), h("div", null, h("span", {
        className: "text-gray-500 block mb-1 text-xs"
      }, "保養結束時間"), isEdit ? h(TimeInput24, {
        value: formData.planTimeEnd || '',
        onChange: function (e) { formData = Object.assign({}, formData, { planTimeEnd: e.target.value }); rerender(); },
        className: "w-full"
      }) : h(ReadOnlyField, {
        value: formData.planTimeEnd
      })), h(ReadOnlyField, {
        label: '完成時間',
        value: IESS.caseDateTime.format(formData.completionDate)
      }))), isEdit && h("div", {
        className: "mt-8 pt-6 border-t flex justify-end gap-3"
      },
        h("button", {
          onClick: function () { setView(backView); },
          className: "px-6 py-2.5 border rounded-md"
        }, "取消"),
        h("button", {
          onClick: handleSubmit,
          className: "px-8 py-2.5 bg-blue-600 text-white rounded-md"
        }, Icons.Save({
          className: "inline h-4 w-4 mr-2"
        }), "儲存")
      )));
    });
  }

  window.MaintenanceList = MaintenanceList;
  window.MaintenanceViewEditForm = MaintenanceViewEditForm;
})();
