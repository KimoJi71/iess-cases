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

  function syncFormStoreFields(formData, stores) {
    var synced = ScheduleUtils.applyStoreSnapshot(formData, stores);
    formData.companyCity = synced.companyCity || '';
    formData.companyDistrict = synced.companyDistrict || '';
    formData.serviceLevel = synced.serviceLevel || formData.serviceLevel;
    formData.storeAddress = synced.storeAddress || '';
  }

  // 「編輯案件」與「案件安排」共用的區塊實作都搬到 RepairCaseDetailSections，
  // 這裡只留別名，AddCaseForm 內文不必逐一改名。
  var Sections = window.RepairCaseDetailSections;
  var CaseReadOnlyField = Sections.CaseReadOnlyField;
  var ExpectedTimeRangeFields = window.ExpectedTimeRangeFields;
  var renderVehicleSelect = Sections.renderVehicleSelect;
  var renderPartnerVendorMultiSelect = Sections.renderPartnerVendorMultiSelect;
  var isOtherWorkCategory = Sections.isOtherWorkCategory;

  var renderAssigneeMultiSelect = CaseAssigneeFields.renderAssigneeMultiSelect;
  var renderMemberMultiSelect = CaseAssigneeFields.renderMemberMultiSelect;

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

      var selectCls = "w-full p-2.5 border rounded-md outline-none";
      var labelCls = "text-gray-500 block mb-1";

      function renderSelectField(label, name, options, required) {
        return h("div", null,
          h("label", { className: labelCls }, label),
          h("select", {
            required: required,
            name: name,
            value: formData[name],
            onChange: handleChange,
            className: selectCls
          },
            required && h("option", { value: "", disabled: true }, "請選擇"),
            options.map(function (opt) { return h("option", { key: opt, value: opt }, opt); })
          )
        );
      }

      return h("div", {
        className: "max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100"
      }, PageHeader({
        title: '新增案件',
        onClose: function () { setView('list'); },
        wrapperClass: 'page-header-sticky flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
      }), h("form", {
        onSubmit: handleSubmit,
        className: "p-4 sm:p-6 space-y-6 sm:space-y-8 bg-gray-50"
      },
        h("section", { className: "bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100" },
          h("h3", { className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4" }, "1. 基本資料"),
          h("div", { className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm items-start" },
            renderSelectField("客戶名稱", "customerName", customerOptions, true),
            renderSelectField("門市名稱", "storeName", storeOptions, true),
            CaseReadOnlyField({ label: '叫修人員', value: formData.reporter }),
            CaseReadOnlyField({ label: '服務等級', value: formData.serviceLevel }),
            CaseReadOnlyField({
              label: '門市地址',
              value: formData.storeAddress || '請先選擇客戶與門市',
              fullWidth: true
            }),
            CaseReadOnlyField({
              label: '門市備註',
              value: StoreUtils.resolveStoreRemarks(stores, formData),
              fullWidth: true
            })
          )
        ),
        h("section", { className: "bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100" },
          h("h3", { className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4" }, "2. 叫修內容"),
          h("div", { className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm items-start" },
            renderSelectField("工項分類", "workCategory", WORK_CATEGORY_OPTIONS),
            !isOther && renderSelectField("叫修項目", "repairItem", REPAIR_ITEMS),
            !isOther && renderSelectField("叫修原因", "repairReason", REPAIR_REASONS),
            h("div", { className: "col-span-full" },
              h("label", { className: labelCls }, isOther ? "工作描述" : "故障描述"),
              h("textarea", {
                name: "faultDesc",
                value: formData.faultDesc,
                onChange: handleChange,
                rows: "2",
                className: selectCls
              })
            )
          )
        ),
        h("section", { className: "bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100" },
          h("h3", { className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4" }, "3. 排程資料"),
          h("div", { className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm items-start" },
            h("div", null,
              h("label", { className: labelCls }, "預計日期"),
              h("input", {
                type: "date",
                name: "expectedDate",
                value: formData.expectedDate,
                onChange: handleChange,
                className: "w-full h-[42px] px-2.5 border rounded-md outline-none"
              })
            ),
            ExpectedTimeRangeFields({
              labelClassName: labelCls,
              startValue: formData.expectedTimeStart,
              endValue: formData.expectedTimeEnd,
              onChange: handleChange
            }),
            h("div", { className: "col-span-full md:col-span-2" },
              h("label", { className: labelCls }, "組別"),
              renderAssigneeMultiSelect(formData, function (next) {
                formData.assignees = next;
                formData.assigneeMemberIds = CaseAssigneeFields.syncMemberIds(next, formData.assigneeMemberIds);
                rerender();
              }, { id: 'add-case-assignees' })
            ),
            h("div", { className: "col-span-full md:col-span-2" },
              h("label", { className: labelCls }, "指派人員"),
              renderMemberMultiSelect(formData, function (next) {
                formData.assigneeMemberIds = next;
                rerender();
              }, { id: 'add-case-assignee-members' })
            ),
            h("div", null,
              h("label", { className: labelCls }, "使用車輛"),
              renderVehicleSelect(formData, vehicles, handleChange, selectCls)
            ),
            h("div", { className: "col-span-full md:col-span-2" },
              h("label", { className: labelCls }, "協力廠商"),
              renderPartnerVendorMultiSelect(formData, vendors, function (next) {
                formData.partnerVendorIds = next;
                rerender();
              }, 'add-case-partner-vendors')
            )
          )
        ),
        h("div", {
          className: "mt-8 pt-6 border-t flex justify-end gap-4"
        }, h("button", {
          type: "button",
          onClick: function () { setView('list'); },
          className: "px-6 py-2.5 border rounded-md"
        }, "取消"), h("button", {
          type: "submit",
          className: "px-8 py-2.5 bg-blue-600 text-white rounded-md flex items-center gap-2"
        }, Icons.Save({ className: "h-5 w-5" }), " 儲存"))
      ));
    });
  }

  function EditCaseForm(props) {
    var editingCase = props.editingCase;
    var cases = props.cases;
    var stores = props.stores || [];
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
    if (!formData.repairRemark) formData.repairRemark = '';
    // ui 宣告在 stateful 之外，與原本各個暫存變數的位置一致，才撐得過重繪
    var ui = RepairCaseDetailSections.createUiState();

    return stateful(function (rerender) {
      var ctx = {
        formData: formData,
        ui: ui,
        data: {
          equipments: equipments,
          deviceCategories: deviceCategories,
          processMethods: processMethods,
          vehicles: vehicles,
          vendors: vendors,
          stores: props.stores || []
        },
        rerender: rerender,
        showToast: showToast,
        include: RepairCaseDetailSections.SECTION_KEYS
      };

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
      }),
        h("div", { className: "p-4 sm:p-6 space-y-6 sm:space-y-8 bg-gray-50" },
          RepairCaseDetailSections.renderSections(ctx),
          h("div", { className: "mt-8 pt-6 border-t flex justify-end gap-4" },
            h("button", {
              onClick: function () { setView('list'); },
              className: "px-6 py-2.5 border rounded-md"
            }, "取消"),
            h("button", {
              onClick: handleSubmit,
              className: "px-8 py-2.5 bg-blue-600 text-white rounded-md flex items-center gap-2"
            }, Icons.Save({ className: "h-5 w-5" }), " 儲存")
          )
        ),
        RepairCaseDetailSections.renderOverlays(ctx)
      );
    });
  }

  window.AddCaseForm = AddCaseForm;
  window.EditCaseForm = EditCaseForm;
})();
