/*
 * features/repair/case-form.js — 案件處理：新增案件表單 / 編輯案件表單
 * props:
 *   AddCaseForm  { cases, setCases, stores, customers, vehicles, vendors, setView, showToast }
 *   EditCaseForm { editingCase, cases, setCases, stores, customers, vehicles, vendors,
 *                  processMethods, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, TimeInput24 = IESS.TimeInput24;
  var caseDT = IESS.caseDateTime;
  var caseStatus = IESS.caseStatus;

  function isOtherWorkCategory(workCategory) {
    return workCategory === '其他';
  }

  function TimeRecordField(p) {
    return h('div', null,
      h('label', { className: 'block text-sm font-medium text-gray-800 mb-1.5' }, p.label),
      p.readOnly
        ? h('div', {
            className: 'w-full p-2.5 border rounded-md bg-gray-100 text-gray-700 min-h-[42px] flex items-center'
          }, p.value || '—')
        : h('input', {
            type: 'datetime-local',
            name: p.name,
            value: caseDT.toInput(p.value),
            onChange: p.onChange,
            step: '1',
            className: 'w-full p-2.5 border rounded-md outline-none bg-white'
          })
    );
  }

  function syncFormStoreFields(formData, stores) {
    var synced = ScheduleUtils.applyStoreSnapshot(formData, stores);
    formData.companyCity = synced.companyCity || '';
    formData.companyDistrict = synced.companyDistrict || '';
    formData.serviceLevel = synced.serviceLevel || formData.serviceLevel;
    formData.storeAddress = synced.storeAddress || '';
  }

  function ReporterField(p) {
    return h('div', null,
      h(p.labelTag || 'label', { className: p.labelClassName || 'block text-sm mb-1' }, '叫修人員'),
      h('input', {
        type: 'text',
        name: 'reporter',
        value: p.value || '—',
        disabled: true,
        readOnly: true,
        className: p.inputClassName || 'w-full p-2.5 border rounded-md bg-gray-50 text-gray-500 cursor-not-allowed'
      })
    );
  }

  function CaseReadOnlyField(p) {
    return h('div', { className: p.fullWidth ? 'col-span-full' : '' },
      h('span', { className: p.labelClassName || 'text-gray-500 block mb-1' }, p.label),
      h('div', {
        className: 'font-medium bg-gray-50 p-2.5 rounded-md border border-gray-100 min-h-[42px] flex items-center text-gray-700'
      }, p.value || '—')
    );
  }

  function ExpectedTimeRangeFields(p) {
    var labelTag = p.labelTag || 'label';
    return h('div', { className: p.wrapClass || 'col-span-full sm:col-span-2' },
      h(labelTag, { className: p.labelClassName || 'block text-sm mb-1' }, '預計時間'),
      h('div', { className: 'grid grid-cols-2 gap-4' },
        h('div', { className: 'flex items-center gap-2 min-h-[42px]' },
          h('span', { className: 'text-xs text-gray-500 shrink-0' }, '開始'),
          h(TimeInput24, {
            name: p.startName || 'expectedTimeStart',
            value: p.startValue || '',
            onChange: p.onChange,
            className: 'w-full h-[42px]'
          })
        ),
        h('div', { className: 'flex items-center gap-2 min-h-[42px]' },
          h('span', { className: 'text-xs text-gray-500 shrink-0' }, '結束'),
          h(TimeInput24, {
            name: p.endName || 'expectedTimeEnd',
            value: p.endValue || '',
            onChange: p.onChange,
            className: 'w-full h-[42px]'
          })
        )
      )
    );
  }

  var renderAssigneeMultiSelect = CaseAssigneeFields.renderAssigneeMultiSelect;
  var renderMemberMultiSelect = CaseAssigneeFields.renderMemberMultiSelect;

  function renderVehicleSelect(formData, vehicles, handleChange, className) {
    var options = VehicleUtils.getSelectOptions(vehicles, formData.vehicleId);
    return h('select', {
      name: 'vehicleId',
      value: formData.vehicleId || '',
      onChange: handleChange,
      className: className
    }, h('option', { value: '' }, '請選擇'), options.map(function (opt) {
      return h('option', { key: opt.value, value: opt.value }, opt.label);
    }));
  }

  function renderPartnerVendorMultiSelect(formData, vendors, onChange, id) {
    return IESS.MultiSelect({
      id: id,
      options: VendorUtils.getCooperatorSelectOptions(vendors, formData.partnerVendorIds),
      value: formData.partnerVendorIds || [],
      onChange: onChange,
      placeholder: '請選擇協力廠商'
    });
  }

  function AddCaseForm(props) {
    var cases = props.cases;
    var setCases = props.setCases;
    var stores = props.stores;
    var customers = props.customers;
    var vehicles = props.vehicles || [];
    var vendors = props.vendors || [];
    var setView = props.setView;
    var showToast = props.showToast;
    var currentOperatorName = props.currentOperatorName || '';

    var formData = {
      workCategory: '一般叫修',
      customerName: '',
      storeName: '',
      companyCity: '',
      companyDistrict: '',
      storeAddress: '',
      repairItem: '室內機',
      repairReason: '不冷',
      faultDesc: '',
      assignees: [],
      assigneeMemberIds: [],
      vehicleId: '',
      partnerVendorIds: [],
      expectedDate: '',
      expectedTimeStart: '',
      expectedTimeEnd: '',
      reporter: currentOperatorName,
      serviceLevel: ''
    };

    return stateful(function (rerender) {
      var isOther = isOtherWorkCategory(formData.workCategory);
      var storeOptions = ScheduleUtils.getStoreNamesForCustomer(stores, formData.customerName, formData.storeName);
      var customerOptions = CustomerUtils.getCustomerNameOptions(customers, formData.customerName);

      function handleChange(e) {
        var name = e.target.name;
        var value = e.target.value;
        formData[name] = value;
        if (name === 'customerName') {
          formData.serviceLevel = CustomerUtils.getServiceLevelByCustomerName(customers, value);
          formData.storeName = '';
          formData.companyCity = '';
          formData.companyDistrict = '';
          formData.storeAddress = '';
        }
        if (name === 'storeName') {
          syncFormStoreFields(formData, stores);
        }
        rerender();
      }
      function handleSubmit(e) {
        e.preventDefault();
        var payload = CaseAssigneeUtils.normalizeRepairCase(formData);
        var newCase = Object.assign({
          id: 'C' + Date.now(),
          caseNumber: new Date().toISOString().split('T')[0].replace(/-/g, '') + String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
          repairDate: caseDT.now(),
          createdAt: new Date().toISOString()
        }, payload, {
          companyCity: payload.companyCity || '',
          companyDistrict: payload.companyDistrict || '',
          storeAddress: payload.storeAddress || '',
          processStatus: null,
          indicator: payload.workCategory === '緊急叫修' ? 'urgent' : 'completed',
          isClosed: false,
          serviceItems: [],
          reRepairDate: '',
          completionDate: '',
          planDate: payload.expectedDate || '',
          planTimeStart: payload.expectedTimeStart || '',
          planTimeEnd: payload.expectedTimeEnd || '',
          isPerformanceIncluded: false,
          performanceAssignees: [],
          performanceAssignee: '',
          performanceMemberIds: [],
          isListClosed: false
        });
        setCases([newCase].concat(cases));
        showToast('案件新增成功');
        setView('list');
      }

      return h("div", {
        className: "max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100"
      }, PageHeader({
        title: '新增案件',
        onClose: function () { setView('list'); },
        wrapperClass: 'page-header-sticky flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
      }), h("form", {
        onSubmit: handleSubmit,
        className: "p-4 sm:p-6"
      }, h("div", {
        className: "space-y-6"
      }, h("div", {
        className: "grid grid-cols-1 md:grid-cols-3 gap-6"
      }, h("div", {
        className: "col-span-full font-semibold text-lg text-blue-800 border-b pb-2 mb-2"
      }, "基本資料"), h("div", null, h("label", {
        className: "block text-sm mb-1"
      }, "客戶名稱"), h("select", {
        required: true,
        name: "customerName",
        value: formData.customerName,
        onChange: handleChange,
        className: "w-full p-2.5 border rounded-md outline-none"
      }, h("option", {
        value: "",
        disabled: true
      }, "請選擇"), customerOptions.map(function (opt) { return h("option", {
        key: opt,
        value: opt
      }, opt); }))), h("div", null, h("label", {
        className: "block text-sm mb-1"
      }, "門市名稱"), h("select", {
        required: true,
        name: "storeName",
        value: formData.storeName,
        onChange: handleChange,
        className: "w-full p-2.5 border rounded-md outline-none"
      }, h("option", {
        value: "",
        disabled: true
      }, "請選擇"), storeOptions.map(function (opt) { return h("option", {
        key: opt,
        value: opt
      }, opt); }))), ReporterField({
        value: formData.reporter
      }), h("div", {
        className: "col-span-full md:col-span-2"
      }, h("label", {
        className: "block text-sm font-medium text-gray-500 mb-1"
      }, "門市地址 (根據門市自動帶入)"), h("input", {
        type: "text",
        disabled: true,
        value: formData.storeAddress,
        placeholder: "請先選擇客戶與門市",
        className: "w-full p-2.5 bg-gray-50 border rounded-md text-gray-500 cursor-not-allowed"
      })), h("div", null, h("label", {
        className: "block text-sm font-medium text-gray-700 mb-1"
      }, "服務等級"), h("input", {
        type: "text",
        disabled: true,
        value: formData.serviceLevel || "—",
        className: "w-full p-2.5 bg-gray-50 border rounded-md text-gray-500 cursor-not-allowed"
      })), h("div", {
        className: "col-span-full font-semibold text-lg text-blue-800 border-b pb-2 mt-4 mb-2"
      }, "叫修內容"), h("div", null, h("label", {
        className: "block text-sm mb-1"
      }, "工項分類"), h("select", {
        name: "workCategory",
        value: formData.workCategory,
        onChange: handleChange,
        className: "w-full p-2.5 border rounded-md outline-none"
      }, WORK_CATEGORY_OPTIONS.map(function (opt) { return h("option", {
        key: opt,
        value: opt
      }, opt); }))), !isOther && h("div", null, h("label", {
        className: "block text-sm mb-1"
      }, "叫修項目"), h("select", {
        name: "repairItem",
        value: formData.repairItem,
        onChange: handleChange,
        className: "w-full p-2.5 border rounded-md outline-none"
      }, REPAIR_ITEMS.map(function (opt) { return h("option", {
        key: opt,
        value: opt
      }, opt); }))), !isOther && h("div", null, h("label", {
        className: "block text-sm mb-1"
      }, "叫修原因"), h("select", {
        name: "repairReason",
        value: formData.repairReason,
        onChange: handleChange,
        className: "w-full p-2.5 border rounded-md outline-none"
      }, REPAIR_REASONS.map(function (opt) { return h("option", {
        key: opt,
        value: opt
      }, opt); }))), h("div", {
        className: "col-span-full"
      }, h("label", {
        className: "block text-sm mb-1"
      }, isOther ? "工作描述" : "故障描述"), h("textarea", {
        name: "faultDesc",
        value: formData.faultDesc,
        onChange: handleChange,
        rows: "2",
        className: "w-full p-2.5 border rounded-md outline-none"
      })), h("div", {
        className: "col-span-full font-semibold text-lg text-blue-800 border-b pb-2 mt-4 mb-2"
      }, "排程"), h("div", null, h("label", {
        className: "block text-sm mb-1"
      }, "組別"), renderAssigneeMultiSelect(formData, function (next) {
        formData.assignees = next;
        formData.assigneeMemberIds = CaseAssigneeFields.syncMemberIds(next, formData.assigneeMemberIds);
        rerender();
      }, { id: 'add-case-assignees' })), h("div", null, h("label", {
        className: "block text-sm mb-1"
      }, "指派人員"), renderMemberMultiSelect(formData, function (next) {
        formData.assigneeMemberIds = next;
        rerender();
      }, { id: 'add-case-assignee-members' })), h("div", null, h("label", {
        className: "block text-sm mb-1"
      }, "使用車輛"), renderVehicleSelect(
        formData, vehicles, handleChange, "w-full p-2.5 border rounded-md outline-none"
      )), h("div", null, h("label", {
        className: "block text-sm mb-1"
      }, "協力廠商"), renderPartnerVendorMultiSelect(formData, vendors, function (next) {
        formData.partnerVendorIds = next;
        rerender();
      }, 'add-case-partner-vendors')), h("div", null, h("label", {
        className: "block text-sm mb-1"
      }, "預計日期"), h("input", {
        type: "date",
        name: "expectedDate",
        value: formData.expectedDate,
        onChange: handleChange,
        className: "w-full p-2.5 border rounded-md outline-none"
      })), h("div", null, h("label", {
        className: "block text-sm mb-1"
      }, "預計開始時間"), h(TimeInput24, {
        name: "expectedTimeStart",
        value: formData.expectedTimeStart,
        onChange: handleChange,
        className: "w-full"
      })), h("div", null, h("label", {
        className: "block text-sm mb-1"
      }, "預計結束時間"), h(TimeInput24, {
        name: "expectedTimeEnd",
        value: formData.expectedTimeEnd,
        onChange: handleChange,
        className: "w-full"
      })))), h("div", {
        className: "mt-8 pt-6 border-t flex justify-end gap-4"
      }, h("button", {
        type: "button",
        onClick: function () { setView('list'); },
        className: "px-6 py-2.5 border rounded-md"
      }, "取消"), h("button", {
        type: "submit",
        className: "px-6 py-2.5 bg-blue-600 text-white rounded-md flex items-center gap-2"
      }, Icons.Save({
        className: "h-4 w-4"
      }), " 儲存"))));
    });
  }

  function EditCaseForm(props) {
    var editingCase = props.editingCase;
    var cases = props.cases;
    var setCases = props.setCases;
    var vehicles = props.vehicles || [];
    var vendors = props.vendors || [];
    var equipments = props.equipments || [];
    var deviceCategories = props.deviceCategories || [];
    var processMethods = props.processMethods || [];
    var setView = props.setView;
    var showToast = props.showToast;
    var openPrevCase = props.openPrevCase;

    var formData = CaseAssigneeUtils.normalizeRepairCase(
      JSON.parse(JSON.stringify(editingCase))
    );
    if (!formData.expectedTimeStart) formData.expectedTimeStart = formData.planTimeStart || '';
    if (!formData.expectedTimeEnd) formData.expectedTimeEnd = formData.planTimeEnd || '';
    if (!formData.expectedDate) formData.expectedDate = formData.planDate || '';
    if (!formData.remarks) formData.remarks = '';
    if (!formData.repairRemark) formData.repairRemark = '';
    // 每張卡片各自暫存「新增處理方式」的挑選，切換卡片不互相干擾
    var newRecordByItemId = {};
    function getNewRecord(itemId) {
      if (!newRecordByItemId[itemId]) {
        newRecordByItemId[itemId] = ProcessMethodUtils.normalizeProcessMethodSelection(processMethods, null);
      }
      return newRecordByItemId[itemId];
    }
    var pickerOpen = false;
    var addEquipMenuOpen = false;
    var signaturePad = { show: false };

    return stateful(function (rerender) {
      var storeEquipments = RepairCaseEquipment.listForCase(equipments, formData);

      function handleChange(e) {
        var name = e.target.name;
        var value = e.target.value;
        if (e.target.type === 'datetime-local') {
          value = value ? caseDT.fromInput(value) : '';
        }
        formData[name] = value;
        if (name === 'processStatus') {
          formData.processStatus = value || null;
          caseStatus.applyProcessStatusChange(formData, value || null, caseDT.now());
        }
        rerender();
      }
      function assignEquipment(eq) {
        // 已汰換的設備不可加入案件
        if (EquipmentUtils.isRetired(eq)) {
          showToast('已汰換的設備無法加入設備資料', 'error');
          pickerOpen = false;
          addEquipMenuOpen = false;
          rerender();
          return false;
        }
        formData.serviceItems = RepairCaseServiceItems.getItems(formData)
          .concat([RepairCaseServiceItems.createItem(eq)]);
        pickerOpen = false;
        addEquipMenuOpen = false;
        rerender();
        return true;
      }
      function handleRemoveItem(itemId) {
        formData.serviceItems = RepairCaseServiceItems.removeItem(formData, itemId);
        delete newRecordByItemId[itemId];
        rerender();
      }
      function handleReasonChange(itemId, value) {
        formData.serviceItems = RepairCaseServiceItems.updateItem(formData, itemId, { actualReason: value });
        rerender();
      }
      function handleAddRecord(itemId, pm, qty, status) {
        if (!pm) {
          showToast('請選擇處理方式', 'error');
          return;
        }
        var item = RepairCaseServiceItems.getItems(formData).filter(function (it) {
          return it.id === itemId;
        })[0];
        formData.serviceItems = RepairCaseServiceItems.updateItem(formData, itemId, {
          processRecords: (item.processRecords || []).concat([
            ProcessMethodUtils.toCaseProcessRecord(pm, qty, null, status)
          ])
        });
        rerender();
      }
      function handleRemoveRecord(itemId, recordId) {
        var item = RepairCaseServiceItems.getItems(formData).filter(function (it) {
          return it.id === itemId;
        })[0];
        formData.serviceItems = RepairCaseServiceItems.updateItem(formData, itemId, {
          processRecords: (item.processRecords || []).filter(function (r) { return r.id !== recordId; })
        });
        rerender();
      }
      function handleToggleRecordStatus(itemId, recordId) {
        var item = RepairCaseServiceItems.getItems(formData).filter(function (it) {
          return it.id === itemId;
        })[0];
        formData.serviceItems = RepairCaseServiceItems.updateItem(formData, itemId, {
          processRecords: (item.processRecords || []).map(function (r) {
            if (r.id !== recordId) return r;
            return Object.assign({}, r, {
              status: ProcessMethodUtils.toggleCaseRecordStatus(ProcessMethodUtils.getCaseRecordStatus(r))
            });
          })
        });
        rerender();
      }
      function handleSimulateScan(e) {
        if (e) e.preventDefault();
        var scanned = RepairCaseEquipment.findEquipmentForScan(equipments, formData);
        if (scanned) {
          assignEquipment(scanned);
        } else {
          assignEquipment({
            id: 'E' + Date.now(),
            customerName: formData.customerName || '測試客戶',
            storeName: formData.storeName || '測試門市',
            category: '分離式',
            brand: '日立',
            deviceName: '分離式冷氣',
            name: '分離式冷氣',
            specification: '3.5匹',
            model: 'RAS-100',
            area: '1F 營業廳',
            acceptanceDate: '',
            installer: '',
            assetNumber: '',
            serialNumber: '',
            status: EquipmentUtils.defaultStatus()
          });
        }
        showToast('成功掃描設備並帶入資料');
      }
      function handleSelectEquipment(eq) {
        if (assignEquipment(eq)) showToast('已帶入設備資料');
      }
      function handleSubmit() {
        var missingEquipment = RepairCaseServiceItems.getItems(formData).some(function (it) {
          return !it.equipment;
        });
        if (missingEquipment) {
          showToast('每份服務項目都必須對應一筆設備', 'error');
          return;
        }
        formData.planDate = formData.expectedDate || formData.planDate || '';
        formData.planTimeStart = formData.expectedTimeStart || formData.planTimeStart || '';
        formData.planTimeEnd = formData.expectedTimeEnd || formData.planTimeEnd || '';
        var payload = CaseAssigneeUtils.normalizeRepairCase(formData);
        setCases(cases.map(function (c) { return c.id === formData.id ? payload : c; }));
        showToast('案件資料已更新');
        setView('list');
      }

      var isOther = isOtherWorkCategory(formData.workCategory);
      var hasServiceItems = RepairCaseServiceItems.getItems(formData).length > 0;
      /* 維修結果原則上要先加入設備才可編輯；工項分類為「其他」時不受此限 */
      var resultLocked = !hasServiceItems && !isOther;

      function buildPrevCaseAction() {
        return CaseExtensionUtils.buildPrevCaseAction({
          cases: cases,
          targetCase: formData,
          currentView: 'edit',
          openPrevCase: openPrevCase
        });
      }

      return h("div", {
        className: "max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100"
      }, PageHeader({
        title: '編輯案件',
        badge: formData.caseNumber,
        onClose: function () { setView('list'); },
        actions: buildPrevCaseAction(),
        wrapperClass: 'page-header-sticky flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
      }), h("div", {
        className: "p-4 sm:p-6 space-y-6 sm:space-y-8 bg-gray-50"
      },
        h("section", { className: "bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100" },
          h("h3", { className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4" }, "1. 排程資料"),
          h("div", { className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm items-start" },
            h("div", null,
              h("span", { className: "text-gray-500 block mb-1" }, "預計日期"),
              h("input", {
                type: "date",
                name: "expectedDate",
                value: formData.expectedDate,
                onChange: handleChange,
                className: "w-full h-[42px] px-2.5 border rounded-md outline-none"
              })
            ),
            ExpectedTimeRangeFields({
              labelTag: 'span',
              labelClassName: 'text-gray-500 block mb-1',
              startValue: formData.expectedTimeStart,
              endValue: formData.expectedTimeEnd,
              onChange: handleChange
            }),
            h("div", { className: "col-span-full md:col-span-2" },
              h("span", { className: "text-gray-500 block mb-1" }, "組別"),
              renderAssigneeMultiSelect(formData, function (next) {
                formData.assignees = next;
                formData.assigneeMemberIds = CaseAssigneeFields.syncMemberIds(next, formData.assigneeMemberIds);
                rerender();
              }, { id: 'edit-case-assignees' })
            ),
            h("div", { className: "col-span-full md:col-span-2" },
              h("span", { className: "text-gray-500 block mb-1" }, "指派人員"),
              renderMemberMultiSelect(formData, function (next) {
                formData.assigneeMemberIds = next;
                rerender();
              }, { id: 'edit-case-assignee-members' })
            ),
            h("div", null,
              h("span", { className: "text-gray-500 block mb-1" }, "使用車輛"),
              renderVehicleSelect(formData, vehicles, handleChange, "w-full p-2.5 border rounded-md outline-none")
            ),
            h("div", { className: "col-span-full md:col-span-2" },
              h("span", { className: "text-gray-500 block mb-1" }, "協力廠商"),
              renderPartnerVendorMultiSelect(formData, vendors, function (next) {
                formData.partnerVendorIds = next;
                rerender();
              }, 'edit-case-partner-vendors')
            )
          )
        ),
        h("section", { className: "bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100" },
          h("h3", { className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4" }, "2. 案件資料"),
          h("div", { className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm items-start" },
            CaseReadOnlyField({ label: '案件編號', value: formData.caseNumber }),
            CaseReadOnlyField({ label: '工項分類', value: formData.workCategory }),
            CaseReadOnlyField({ label: '叫修人員', value: formData.reporter }),
            CaseReadOnlyField({ label: '客戶名稱', value: formData.customerName }),
            CaseReadOnlyField({ label: '門市名稱', value: formData.storeName }),
            CaseReadOnlyField({ label: '服務等級', value: formData.serviceLevel }),
            CaseReadOnlyField({ label: '門市地址', value: formData.storeAddress, fullWidth: true }),
            !isOther && CaseReadOnlyField({ label: '叫修項目', value: formData.repairItem }),
            !isOther && CaseReadOnlyField({ label: '叫修原因', value: formData.repairReason }),
            CaseReadOnlyField({
              label: isOther ? '工作描述' : '故障描述',
              value: formData.faultDesc,
              fullWidth: true
            })
          )
        ),
        h("section", {
          className: "bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100"
        },
          h("div", { className: "flex flex-wrap justify-between items-center gap-3 border-b pb-2 mb-4" },
            h("h3", { className: "text-lg font-bold text-blue-800" }, "3. 設備與服務項目"),
            h("div", { className: "relative" },
              addEquipMenuOpen && h("div", {
                className: "fixed inset-0 z-10",
                onClick: function () { addEquipMenuOpen = false; rerender(); }
              }),
              h("button", {
                type: "button",
                onClick: function (e) {
                  e.stopPropagation();
                  addEquipMenuOpen = !addEquipMenuOpen;
                  rerender();
                },
                className: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-md flex items-center gap-2 font-medium transition-colors border border-indigo-200"
              }, Icons.Plus({ className: "h-4 w-4" }), " 加入設備", Icons.ChevronDown({ className: "h-4 w-4" })),
              addEquipMenuOpen && h("div", {
                className: "absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1"
              },
                h("button", {
                  type: "button",
                  className: "w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50",
                  onClick: function () {
                    addEquipMenuOpen = false;
                    pickerOpen = true;
                    rerender();
                  }
                }, "手動選擇"),
                h("button", {
                  type: "button",
                  className: "w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2",
                  onClick: function () {
                    addEquipMenuOpen = false;
                    handleSimulateScan();
                  }
                }, Icons.QrCode({ className: "h-4 w-4" }), " 掃描 QR Code")
              )
            )
          ),
          hasServiceItems
            ? RepairCaseServiceItems.getItems(formData).map(function (item, idx) {
                return h(RepairCaseServiceItemCard, {
                  key: item.id,
                  h: h,
                  index: idx,
                  item: item,
                  caseContext: formData,
                  deviceCategories: deviceCategories,
                  processMethods: processMethods,
                  newRecord: getNewRecord(item.id),
                  isOther: isOther,
                  isClosed: formData.isClosed,
                  onNewRecordChange: function (sel) { newRecordByItemId[item.id] = sel; rerender(); },
                  onReasonChange: function (v) { handleReasonChange(item.id, v); },
                  onAddRecord: function (pm, qty, status) { handleAddRecord(item.id, pm, qty, status); },
                  onToggleRecordStatus: function (rid) { handleToggleRecordStatus(item.id, rid); },
                  onRemoveRecord: function (rid) { handleRemoveRecord(item.id, rid); },
                  onRemoveItem: function () { handleRemoveItem(item.id); }
                });
              })
            : h("div", {
                className: "text-center py-8 text-gray-400 bg-gray-50 rounded-md border border-dashed"
              }, "請點擊「加入設備」手動選擇或掃描 QR Code"),
          h("div", { className: "mt-4" },
            h("label", { className: "block text-sm mb-1" }, "備註"),
            h("textarea", {
              name: "remarks",
              value: formData.remarks || '',
              onChange: handleChange,
              disabled: !hasServiceItems,
              rows: "4",
              className: "w-full p-2.5 border rounded-md outline-none disabled:bg-gray-100 disabled:cursor-not-allowed",
              placeholder: hasServiceItems ? "請輸入備註..." : "請先加入設備"
            })
          ),
          pickerOpen && h(RepairCaseEquipment.PickerModal, {
            h: h,
            items: storeEquipments,
            onSelect: handleSelectEquipment,
            onClose: function () { pickerOpen = false; rerender(); }
          })
        ),
        h("section", {
        className: "bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100 relative overflow-hidden"
      }, h("h3", {
        className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4"
      }, "4. 維修結果"), h("div", {
        className: "space-y-6 " + (resultLocked ? 'opacity-30 pointer-events-none' : '')
      }, h("div", {
        className: "grid grid-cols-1 md:grid-cols-2 gap-6"
      }, h("div", null, h("label", {
        className: "block text-sm mb-1"
      }, "處理狀態"), h("select", {
        name: "processStatus",
        value: formData.processStatus || '',
        onChange: handleChange,
        disabled: resultLocked,
        className: "w-full p-2.5 border-2 border-blue-200 rounded-md font-medium text-blue-900 bg-blue-50/30 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
      }, h("option", {
        value: "",
        disabled: true
      }, resultLocked ? "請先加入設備" : "請選擇"), PROCESS_STATUS_OPTIONS.map(function (opt) { return h("option", {
        key: opt,
        value: opt
      }, opt); }))), h("div", null, h("label", {
        className: "block text-sm mb-1"
      }, "客戶簽收"), h("div", {
        className: "flex items-center gap-3"
      }, h("button", {
        type: "button",
        onClick: function () { signaturePad = { show: true }; rerender(); },
        disabled: resultLocked,
        className: "px-4 py-2.5 border border-blue-200 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors font-medium disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
      }, formData.customerSignature ? "重新簽收" : "客戶簽收"), formData.customerSignature ? h("img", {
        src: formData.customerSignature,
        alt: "客戶簽名",
        className: "h-[42px] bg-white border border-gray-200 rounded-md"
      }) : h("span", {
        className: "text-gray-400 text-sm"
      }, "尚未簽收")))), h("div", null, h("label", {
        className: "block text-sm mb-1"
      }, "維修備註"), h("textarea", {
        name: "repairRemark",
        value: formData.repairRemark || '',
        onChange: handleChange,
        disabled: resultLocked,
        rows: "3",
        className: "w-full p-2.5 border rounded-md outline-none disabled:bg-gray-100 disabled:cursor-not-allowed",
        placeholder: resultLocked ? "請先加入設備" : "請輸入維修備註..."
      })), h("div", {
        className: "pt-4 border-t border-gray-100"
      }, h("h4", {
        className: "text-sm font-semibold text-gray-800 mb-4"
      }, "時間紀錄"), h("div", {
        className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      }, TimeRecordField({
        label: '叫修時間',
        readOnly: true,
        value: caseDT.format(formData.createdAt || formData.repairDate)
      }), TimeRecordField({
        label: '到店時間',
        name: 'reRepairDate',
        value: formData.reRepairDate,
        onChange: handleChange
      }), TimeRecordField({
        label: '完成時間',
        name: 'completionDate',
        value: formData.completionDate,
        onChange: handleChange
      })))), h("div", {
        className: "mt-8 pt-6 border-t flex justify-end gap-4"
      }, h("button", {
        onClick: function () { setView('list'); },
        className: "px-6 py-2.5 border rounded-md"
      }, "取消"), h("button", {
        onClick: handleSubmit,
        className: "px-8 py-2.5 bg-blue-600 text-white rounded-md flex items-center gap-2"
      }, Icons.Save({
        className: "h-5 w-5"
      }), " 儲存")))), signaturePad.show && IESS.SignaturePadModal({
        title: '客戶簽收',
        value: formData.customerSignature,
        onConfirm: function (dataUrl) {
          formData.customerSignature = dataUrl;
          signaturePad = { show: false };
          showToast(dataUrl ? '客戶簽收已暫存，請記得儲存' : '已清除客戶簽名');
          rerender();
        },
        onClose: function () { signaturePad = { show: false }; rerender(); }
      }));
    });
  }

  window.AddCaseForm = AddCaseForm;
  window.EditCaseForm = EditCaseForm;
  window.ExpectedTimeRangeFields = ExpectedTimeRangeFields;
})();
