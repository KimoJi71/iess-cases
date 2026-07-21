/*
 * features/repair/case-form.js — 案件處理：新增案件表單 / 編輯案件表單
 * props:
 *   AddCaseForm  { cases, setCases, setView, showToast }
 *   EditCaseForm { editingCase, cases, setCases, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, useDragScroll = IESS.useDragScroll, TimeInput24 = IESS.TimeInput24;
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

  function AddCaseForm(props) {
    var cases = props.cases;
    var setCases = props.setCases;
    var stores = props.stores;
    var customers = props.customers;
    var setView = props.setView;
    var showToast = props.showToast;

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
      assignee: '案件待辦',
      expectedDate: '',
      expectedTimeStart: '',
      expectedTimeEnd: '',
      reporter: '',
      serviceLevel: '維修(無簽約客戶)'
    };

    return stateful(function (rerender) {
      var isOther = isOtherWorkCategory(formData.workCategory);
      var storeOptions = ScheduleUtils.getStoreNamesForCustomer(stores, formData.customerName);
      var customerOptions = CustomerUtils.getCustomerNameOptions(customers, formData.customerName);

      function handleChange(e) {
        var name = e.target.name;
        var value = e.target.value;
        formData[name] = value;
        if (name === 'customerName') {
          formData.serviceLevel = CUSTOMER_SERVICE_LEVEL_MAP[value] || '維修(無簽約客戶)';
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
        var newCase = Object.assign({
          id: 'C' + Date.now(),
          caseNumber: new Date().toISOString().split('T')[0].replace(/-/g, '') + String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
          repairDate: caseDT.now(),
          createdAt: new Date().toISOString()
        }, formData, {
          companyCity: formData.companyCity || '',
          companyDistrict: formData.companyDistrict || '',
          storeAddress: formData.storeAddress || '',
          processStatus: null,
          indicator: formData.workCategory === '緊急叫修' ? 'urgent' : 'completed',
          isClosed: false,
          actualReason: '',
          processRecords: [],
          equipment: null,
          reRepairDate: '',
          secondRepairDate: '',
          completionDate: '',
          planDate: formData.expectedDate || '',
          planTimeStart: formData.expectedTimeStart || '',
          planTimeEnd: formData.expectedTimeEnd || '',
          isPerformanceIncluded: false,
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
      }, opt); }))), h("div", null, h("label", {
        className: "block text-sm mb-1"
      }, "叫修人員"), h("select", {
        required: true,
        name: "reporter",
        value: formData.reporter,
        onChange: handleChange,
        className: "w-full p-2.5 border rounded-md outline-none"
      }, h("option", {
        value: "",
        disabled: true
      }, "請選擇"), REPORTER_OPTIONS.map(function (opt) { return h("option", {
        key: opt,
        value: opt
      }, opt); }))), h("div", {
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
      }, "指派人員"), h("select", {
        name: "assignee",
        value: formData.assignee,
        onChange: handleChange,
        className: "w-full p-2.5 border rounded-md outline-none"
      }, ASSIGNEES.map(function (opt) { return h("option", {
        key: opt,
        value: opt
      }, opt); }))), h("div", null, h("label", {
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
      }), " 儲存新增"))));
    });
  }

  function EditCaseForm(props) {
    var editingCase = props.editingCase;
    var cases = props.cases;
    var setCases = props.setCases;
    var stores = props.stores;
    var customers = props.customers;
    var setView = props.setView;
    var showToast = props.showToast;

    var formData = JSON.parse(JSON.stringify(editingCase));
    if (!formData.expectedTimeStart) formData.expectedTimeStart = formData.planTimeStart || '';
    if (!formData.expectedTimeEnd) formData.expectedTimeEnd = formData.planTimeEnd || '';
    if (!formData.expectedDate) formData.expectedDate = formData.planDate || '';
    if (!formData.remarks) formData.remarks = '';
    var savedProcessStatus = editingCase.processStatus || null;
    var newRecord = {
      category1: '工資',
      category2: '分離式',
      category3: '檢修工資',
      qty: 1
    };
    var dragProps = useDragScroll();

    return stateful(function (rerender) {
      var cat2Options = Object.keys(PROCESS_METHOD_CATEGORIES[newRecord.category1] || {});
      var cat3Options = newRecord.category2 ? PROCESS_METHOD_CATEGORIES[newRecord.category1][newRecord.category2] || [] : [];
      var storeOptions = ScheduleUtils.getStoreNamesForCustomer(stores, formData.customerName);
      var customerOptions = CustomerUtils.getCustomerNameOptions(customers, formData.customerName);

      function handleCat1Change(e) {
        var val = e.target.value;
        var defaultC2 = Object.keys(PROCESS_METHOD_CATEGORIES[val])[0];
        var defaultC3 = PROCESS_METHOD_CATEGORIES[val][defaultC2][0];
        newRecord = Object.assign({}, newRecord, {
          category1: val,
          category2: defaultC2,
          category3: defaultC3
        });
        rerender();
      }
      function handleCat2Change(e) {
        var val = e.target.value;
        var defaultC3 = PROCESS_METHOD_CATEGORIES[newRecord.category1][val][0];
        newRecord = Object.assign({}, newRecord, {
          category2: val,
          category3: defaultC3
        });
        rerender();
      }
      function handleChange(e) {
        var name = e.target.name;
        var value = e.target.value;
        if (e.target.type === 'datetime-local') {
          value = value ? caseDT.fromInput(value) : '';
        }
        formData[name] = value;
        if (name === 'processStatus') {
          formData.processStatus = value || null;
          caseStatus.applyProcessStatusChange(formData, value || null, savedProcessStatus, caseDT.now());
        }
        if (name === 'customerName') {
          formData.serviceLevel = CUSTOMER_SERVICE_LEVEL_MAP[value] || '維修(無簽約客戶)';
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
      function handleSimulateScan(e) {
        if (e) e.preventDefault();
        formData.equipment = {
          id: 'E' + Date.now(),
          customerName: formData.customerName || '測試客戶',
          storeName: formData.storeName || '測試門市',
          area: '1F 營業廳',
          type: '內',
          model: 'FXMQ' + Math.floor(Math.random() * 100 + 100)
        };
        showToast('成功掃描設備並帶入資料');
        rerender();
      }
      function handleAddRecord() {
        formData.processRecords = (formData.processRecords || []).concat([Object.assign({}, newRecord, {
          id: Date.now()
        })]);
        rerender();
      }
      function handleRemoveRecord(id) {
        formData.processRecords = formData.processRecords.filter(function (r) { return r.id !== id; });
        rerender();
      }
      function handleSubmit() {
        if (caseStatus.hasProcessData(formData) && !formData.equipment) {
          showToast('有處理資料時必須先掃描設備', 'error');
          return;
        }
        formData.planDate = formData.expectedDate || formData.planDate || '';
        formData.planTimeStart = formData.expectedTimeStart || formData.planTimeStart || '';
        formData.planTimeEnd = formData.expectedTimeEnd || formData.planTimeEnd || '';
        setCases(cases.map(function (c) { return c.id === formData.id ? formData : c; }));
        showToast('案件資料已更新');
        setView('list');
      }

      var showSecondRepairDate = caseStatus.isReRepairPendingStatus(formData.processStatus);
      var isOther = isOtherWorkCategory(formData.workCategory);

      return h("div", {
        className: "max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100"
      }, PageHeader({
        title: '編輯案件',
        badge: formData.caseNumber,
        onClose: function () { setView('list'); },
        wrapperClass: 'page-header-sticky flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
      }), h("div", {
        className: "p-4 sm:p-6 space-y-6 sm:space-y-8 bg-gray-50"
      }, h("section", {
        className: "bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100"
      }, h("h3", {
        className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4"
      }, "1. 案件資料"), h("div", {
        className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm items-start"
      }, h("div", null, h("span", {
        className: "text-gray-500 block mb-1"
      }, "客戶名稱"), h("select", {
        name: "customerName",
        value: formData.customerName,
        onChange: handleChange,
        className: "w-full p-2 border rounded-md outline-none"
      }, h("option", {
        value: "",
        disabled: true
      }, "請選擇"), customerOptions.map(function (opt) { return h("option", {
        key: opt,
        value: opt
      }, opt); }))), h("div", null, h("span", {
        className: "text-gray-500 block mb-1"
      }, "門市名稱"), h("select", {
        name: "storeName",
        value: formData.storeName,
        onChange: handleChange,
        className: "w-full p-2 border rounded-md outline-none"
      }, h("option", {
        value: "",
        disabled: true
      }, "請選擇"), storeOptions.map(function (opt) { return h("option", {
        key: opt,
        value: opt
      }, opt); }))), h("div", null, h("span", {
        className: "text-gray-500 block mb-1"
      }, "叫修人員"), h("select", {
        name: "reporter",
        value: formData.reporter,
        onChange: handleChange,
        className: "w-full p-2 border rounded-md outline-none"
      }, h("option", {
        value: "",
        disabled: true
      }, "請選擇"), REPORTER_OPTIONS.map(function (opt) { return h("option", {
        key: opt,
        value: opt
      }, opt); }))), h("div", null, h("span", {
        className: "text-gray-500 block mb-1"
      }, "服務等級"), h("input", {
        type: "text",
        disabled: true,
        value: formData.serviceLevel || "—",
        className: "w-full p-2 border rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
      })), h("div", {
        className: "col-span-full md:col-span-4"
      }, h("span", {
        className: "text-gray-500 block mb-1"
      }, "門市地址"), h("input", {
        type: "text",
        disabled: true,
        value: formData.storeAddress,
        placeholder: "請先選擇客戶與門市",
        className: "w-full p-2 border rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
      })), h("div", null, h("span", {
        className: "text-gray-500 block mb-1"
      }, "工項分類"), h("select", {
        name: "workCategory",
        value: formData.workCategory,
        onChange: handleChange,
        className: "w-full p-2 border rounded-md outline-none"
      }, WORK_CATEGORY_OPTIONS.map(function (opt) { return h("option", {
        key: opt,
        value: opt
      }, opt); }))), !isOther && h("div", null, h("span", {
        className: "text-gray-500 block mb-1"
      }, "叫修項目"), h("select", {
        name: "repairItem",
        value: formData.repairItem,
        onChange: handleChange,
        className: "w-full p-2 border rounded-md outline-none"
      }, REPAIR_ITEMS.map(function (opt) { return h("option", {
        key: opt,
        value: opt
      }, opt); }))), !isOther && h("div", null, h("span", {
        className: "text-gray-500 block mb-1"
      }, "叫修原因"), h("select", {
        name: "repairReason",
        value: formData.repairReason,
        onChange: handleChange,
        className: "w-full p-2 border rounded-md outline-none"
      }, REPAIR_REASONS.map(function (opt) { return h("option", {
        key: opt,
        value: opt
      }, opt); }))), h("div", null, h("span", {
        className: "text-gray-500 block mb-1"
      }, "指派人員"), h("select", {
        name: "assignee",
        value: formData.assignee,
        onChange: handleChange,
        className: "w-full p-2 border rounded-md outline-none"
      }, ASSIGNEES.map(function (opt) { return h("option", {
        key: opt,
        value: opt
      }, opt); }))), h("div", null, h("span", {
        className: "text-gray-500 block mb-1"
      }, "預計日期"), h("input", {
        type: "date",
        name: "expectedDate",
        value: formData.expectedDate,
        onChange: handleChange,
        className: "w-full p-2 border rounded-md outline-none"
      })), h("div", null, h("span", {
        className: "text-gray-500 block mb-1"
      }, "預計開始時間"), h(TimeInput24, {
        name: "expectedTimeStart",
        value: formData.expectedTimeStart || '',
        onChange: handleChange,
        className: "w-full"
      })), h("div", null, h("span", {
        className: "text-gray-500 block mb-1"
      }, "預計結束時間"), h(TimeInput24, {
        name: "expectedTimeEnd",
        value: formData.expectedTimeEnd || '',
        onChange: handleChange,
        className: "w-full"
      })), h("div", {
        className: "col-span-full"
      }, h("span", {
        className: "text-gray-500 block mb-1"
      }, isOther ? "工作描述" : "故障描述"), h("textarea", {
        name: "faultDesc",
        value: formData.faultDesc,
        onChange: handleChange,
        rows: "2",
        className: "w-full p-2 border rounded-md outline-none"
      })))), h("section", {
        className: "bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100"
      }, h("div", {
        className: "flex justify-between items-center border-b pb-2 mb-4"
      }, h("h3", {
        className: "text-lg font-bold text-blue-800"
      }, "2. 設備資料"), h("button", {
        type: "button",
        onClick: handleSimulateScan,
        className: "flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-md"
      }, Icons.QrCode({
        className: "h-4 w-4"
      }), " 掃描設備")), formData.equipment ? h("div", {
        className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-y-4 gap-x-6 text-sm bg-green-50/50 p-4 rounded-md border border-green-100"
      }, h("div", null, h("span", {
        className: "text-gray-500 block mb-1"
      }, "客戶名稱"), h("div", {
        className: "font-medium"
      }, formData.equipment.customerName)), h("div", null, h("span", {
        className: "text-gray-500 block mb-1"
      }, "門市名稱"), h("div", {
        className: "font-medium"
      }, formData.equipment.storeName)), h("div", null, h("span", {
        className: "text-gray-500 block mb-1"
      }, "設備區域"), h("div", {
        className: "font-medium"
      }, formData.equipment.area)), h("div", null, h("span", {
        className: "text-gray-500 block mb-1"
      }, "內/外"), h("div", {
        className: "font-medium"
      }, formData.equipment.type)), h("div", null, h("span", {
        className: "text-gray-500 block mb-1"
      }, "型號"), h("div", {
        className: "font-medium"
      }, formData.equipment.model))) : h("div", {
        className: "text-center py-8 text-gray-400 bg-gray-50 rounded-md border border-dashed"
      }, "請點擊上方按鈕掃描")), isOther ? h("section", {
        className: "bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100 relative overflow-hidden"
      }, h("h3", {
        className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4"
      }, "3. 備註"), h("div", {
        className: !formData.equipment ? 'opacity-30 pointer-events-none' : ''
      }, h("textarea", {
        name: "remarks",
        value: formData.remarks || '',
        onChange: handleChange,
        disabled: !formData.equipment,
        rows: "4",
        className: "w-full p-2 border rounded-md outline-none disabled:bg-gray-100 disabled:cursor-not-allowed",
        placeholder: formData.equipment ? "請輸入備註..." : "請先掃描設備"
      }))) : h("section", {
        className: "bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100 relative overflow-hidden"
      }, h("h3", {
        className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4"
      }, "3. 處理資料"), h("div", {
        className: "space-y-6 " + (!formData.equipment ? 'opacity-30 pointer-events-none' : '')
      }, h("div", null, h("label", {
        className: "block text-sm mb-1"
      }, "實際維修原因"), h("textarea", {
        name: "actualReason",
        value: formData.actualReason || '',
        onChange: handleChange,
        rows: "2",
        className: "w-full p-2 border rounded-md outline-none"
      })), h("div", null, h("label", {
        className: "block text-sm font-medium text-gray-700 mb-2"
      }, "處理方式清單"), h("div", {
        className: "flex flex-wrap gap-3 items-end bg-gray-50 p-4 rounded-md border border-gray-200 mb-4"
      }, h("div", {
        className: "flex-1 min-w-[100px]"
      }, h("span", {
        className: "text-xs text-gray-500 block mb-1"
      }, "大類"), h("select", {
        value: newRecord.category1,
        onChange: handleCat1Change,
        className: "w-full p-2 border rounded outline-none text-sm"
      }, Object.keys(PROCESS_METHOD_CATEGORIES).map(function (c) { return h("option", {
        key: c,
        value: c
      }, c); }))), h("div", {
        className: "flex-1 min-w-[100px]"
      }, h("span", {
        className: "text-xs text-gray-500 block mb-1"
      }, "中類"), h("select", {
        value: newRecord.category2,
        onChange: handleCat2Change,
        className: "w-full p-2 border rounded outline-none text-sm"
      }, cat2Options.map(function (c) { return h("option", {
        key: c,
        value: c
      }, c); }))), h("div", {
        className: "flex-1 min-w-[120px]"
      }, h("span", {
        className: "text-xs text-gray-500 block mb-1"
      }, "小類"), h("select", {
        value: newRecord.category3,
        onChange: function (e) {
          newRecord = Object.assign({}, newRecord, {
            category3: e.target.value
          });
          rerender();
        },
        className: "w-full p-2 border rounded outline-none text-sm"
      }, cat3Options.map(function (c) { return h("option", {
        key: c,
        value: c
      }, c); }))), h("div", {
        className: "w-20"
      }, h("span", {
        className: "text-xs text-gray-500 block mb-1"
      }, "數量"), h("input", {
        type: "number",
        min: "1",
        value: newRecord.qty,
        onChange: function (e) {
          newRecord = Object.assign({}, newRecord, {
            qty: e.target.value
          });
          rerender();
        },
        className: "w-full p-2 border rounded outline-none text-sm text-center"
      })), h("button", {
        type: "button",
        onClick: handleAddRecord,
        className: "bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 h-[38px]"
      }, "新增")), h("div", Object.assign({
        className: "border rounded-md overflow-x-auto table-scroll-hint"
      }, dragProps), h("table", {
        className: "w-full text-left text-sm whitespace-nowrap"
      }, h("thead", {
        className: "bg-gray-100"
      }, h("tr", null, h("th", {
        className: "p-2 pl-4"
      }, "項目 (大/中/小類)"), h("th", {
        className: "p-2"
      }, "數量"), h("th", {
        className: "p-2 text-right pr-4"
      }, "操作"))), h("tbody", {
        className: "divide-y"
      }, !formData.processRecords || formData.processRecords.length === 0 ? h("tr", null, h("td", {
        colspan: "3",
        className: "p-4 text-center text-gray-400"
      }, "尚未加入處理項目")) : formData.processRecords.map(function (r, idx) { return h("tr", {
        key: r.id || idx
      }, h("td", {
        className: "p-2 pl-4"
      }, r.category1, " - ", r.category2, " - ", h("span", {
        className: "font-medium text-gray-800"
      }, r.category3)), h("td", {
        className: "p-2"
      }, r.qty), h("td", {
        className: "p-2 text-right pr-4"
      }, h("button", {
        type: "button",
        onClick: function () { handleRemoveRecord(r.id); },
        title: "移除此處理方式",
        className: "text-red-500"
      }, Icons.X({
        className: "h-4 w-4"
      })))); }))))), h("div", {
        className: "grid grid-cols-1 md:grid-cols-2 gap-6"
      }, h("div", null, h("label", {
        className: "block text-sm mb-1"
      }, "處理狀態"), h("select", {
        name: "processStatus",
        value: formData.processStatus || '',
        onChange: handleChange,
        disabled: !formData.equipment,
        className: "w-full p-2.5 border-2 border-blue-200 rounded-md font-medium text-blue-900 bg-blue-50/30 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
      }, h("option", {
        value: "",
        disabled: true
      }, formData.equipment ? "請選擇" : "請先掃描設備"), PROCESS_STATUS_OPTIONS.map(function (opt) { return h("option", {
        key: opt,
        value: opt
      }, opt); })))), h("div", {
        className: "pt-4 border-t border-gray-100"
      }, h("h4", {
        className: "text-sm font-semibold text-gray-800 mb-4"
      }, "時間紀錄"), h("div", {
        className: showSecondRepairDate
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      }, TimeRecordField({
        label: '叫修時間',
        readOnly: true,
        value: caseDT.format(formData.createdAt || formData.repairDate)
      }), TimeRecordField({
        label: '維修時間',
        name: 'reRepairDate',
        value: formData.reRepairDate,
        onChange: handleChange
      }), showSecondRepairDate ? TimeRecordField({
        label: '再次維修時間',
        name: 'secondRepairDate',
        value: formData.secondRepairDate,
        onChange: handleChange
      }) : null, TimeRecordField({
        label: '完成時間',
        name: 'completionDate',
        value: formData.completionDate,
        onChange: handleChange
      }))))), h("div", {
        className: "mt-8 pt-6 border-t flex justify-end gap-4"
      }, h("button", {
        onClick: function () { setView('list'); },
        className: "px-6 py-2.5 border rounded-md"
      }, "取消"), h("button", {
        onClick: handleSubmit,
        className: "px-8 py-2.5 bg-blue-600 text-white rounded-md flex items-center gap-2"
      }, Icons.Save({
        className: "h-5 w-5"
      }), " 儲存更新"))));
    });
  }

  window.AddCaseForm = AddCaseForm;
  window.EditCaseForm = EditCaseForm;
})();
