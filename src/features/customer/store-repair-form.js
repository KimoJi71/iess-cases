/*
 * features/customer/store-repair-form.js — 門市管理：由門市資料新增叫修單
 * props: { store, cases, setCases, setStores, stores, setView, showToast }
 *
 * 由「編輯門市」頁右上方 [新增叫修單] 進入，客戶／門市／地址／服務等級皆由門市自動帶入，
 * 儲存後新增一筆叫修單（寫入案件處理清單），並同步寫入該門市歷史紀錄。
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  var renderAssigneeMultiSelect = CaseAssigneeFields.renderAssigneeMultiSelect;
  var renderMemberMultiSelect = CaseAssigneeFields.renderMemberMultiSelect;

  function StoreRepairForm(props) {
    var store = props.store || {};
    var cases = props.cases;
    var setCases = props.setCases;
    var stores = props.stores;
    var setStores = props.setStores;
    var setView = props.setView;
    var showToast = props.showToast;

    var backToStore = function () { setView('store-edit'); };

    var formData = {
      workCategory: WORK_CATEGORY_OPTIONS[0],
      reporter: '',
      repairItem: REPAIR_ITEMS[0],
      repairReason: REPAIR_REASONS[0],
      faultDesc: '',
      expectedDate: '',
      assignees: [],
      assigneeMemberIds: [],
      expectedTimeStart: '',
      expectedTimeEnd: ''
    };

    var inputCls = IESS.inputCls;
    var disabledCls = 'w-full p-2.5 border rounded-md bg-gray-100 text-gray-600';

    return stateful(function (rerender) {
      function handleChange(e) {
        formData[e.target.name] = e.target.value;
        rerender();
      }
      function handleSubmit(e) {
        e.preventDefault();
        var payload = CaseAssigneeUtils.normalizeRepairCase(formData);
        var newCase = Object.assign({
          id: 'C' + Date.now(),
          caseNumber: todayDate.replace(/-/g, '') + String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
          repairDate: IESS.caseDateTime.now(),
          createdAt: new Date().toISOString()
        }, payload, {
          workCategory: payload.workCategory,
          customerName: store.customerName || '',
          storeName: store.storeName || '',
          repairItem: payload.repairItem,
          repairReason: payload.repairReason,
          faultDesc: payload.faultDesc,
          expectedDate: payload.expectedDate,
          expectedTimeStart: payload.expectedTimeStart,
          expectedTimeEnd: payload.expectedTimeEnd,
          reporter: payload.reporter,
          serviceLevel: store.serviceLevel || '',
          companyCity: store.companyCity || '',
          companyDistrict: store.companyDistrict || '',
          storeAddress: StoreUtils.buildFullAddress(store),
          processStatus: null,
          indicator: formData.workCategory === '緊急叫修' ? 'urgent' : 'completed',
          isClosed: false,
          actualReason: '',
          processRecords: [],
          equipment: null,
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

        // 同步寫入門市歷史紀錄
        if (setStores && stores) {
          var historyRec = {
            id: Date.now(),
            workCategory: payload.workCategory,
            equipmentCategory: '',
            equipmentName: '',
            equipmentArea: '',
            repairItem: payload.repairItem,
            repairReason: payload.repairReason,
            assignee: CaseAssigneeUtils.formatAssignees(payload),
            repairDate: todayDate,
            closeDate: ''
          };
          setStores(stores.map(function (s) {
            return s.id === store.id
              ? Object.assign({}, s, {
                  history: [historyRec].concat(s.history || []),
                  lastRepairDate: todayDate
                })
              : s;
          }));
        }

        showToast('叫修單新增成功，案號：' + newCase.caseNumber);
        backToStore();
      }

      return h('div', { className: 'max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100' },
        PageHeader({
          title: '新增叫修單',
          badge: store.storeName ? (store.customerName + ' / ' + store.storeName) : null,
          onClose: backToStore,
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
        }),
        h('form', { onSubmit: handleSubmit, className: 'p-6' },
          h('div', { className: 'space-y-6' },
            h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-6' },
              h('div', { className: 'col-span-full font-semibold text-lg text-blue-800 border-b pb-2 mb-2' }, '門市資料'),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '客戶名稱'),
                h('input', { type: 'text', value: store.customerName || '—', disabled: true, className: disabledCls })
              ),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '門市名稱'),
                h('input', { type: 'text', value: store.storeName || '—', disabled: true, className: disabledCls })
              ),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '服務等級'),
                h('input', { type: 'text', value: store.serviceLevel || '—', disabled: true, className: disabledCls })
              ),
              h('div', { className: 'col-span-full' },
                h('label', { className: 'block text-sm mb-1' }, '門市地址'),
                h('input', { type: 'text', value: StoreUtils.buildFullAddress(store) || '—', disabled: true, className: disabledCls })
              ),

              h('div', { className: 'col-span-full font-semibold text-lg text-blue-800 border-b pb-2 mt-4 mb-2' }, '叫修內容'),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '工項分類'),
                h('select', { name: 'workCategory', value: formData.workCategory, onChange: handleChange, className: inputCls + ' bg-white' },
                  WORK_CATEGORY_OPTIONS.map(function (opt) { return h('option', { key: opt, value: opt }, opt); }))
              ),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '叫修人員'),
                h('select', { name: 'reporter', value: formData.reporter, onChange: handleChange, className: inputCls + ' bg-white' },
                  h('option', { value: '' }, '請選擇'),
                  REPORTER_OPTIONS.map(function (opt) { return h('option', { key: opt, value: opt }, opt); }))
              ),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '叫修項目'),
                h('select', { name: 'repairItem', value: formData.repairItem, onChange: handleChange, className: inputCls + ' bg-white' },
                  REPAIR_ITEMS.map(function (opt) { return h('option', { key: opt, value: opt }, opt); }))
              ),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '叫修原因'),
                h('select', { name: 'repairReason', value: formData.repairReason, onChange: handleChange, className: inputCls + ' bg-white' },
                  REPAIR_REASONS.map(function (opt) { return h('option', { key: opt, value: opt }, opt); }))
              ),
              h('div', { className: 'col-span-full' },
                h('label', { className: 'block text-sm mb-1' }, '故障描述'),
                h('textarea', { name: 'faultDesc', value: formData.faultDesc, onChange: handleChange, rows: 2, className: inputCls })
              ),

              h('div', { className: 'col-span-full font-semibold text-lg text-blue-800 border-b pb-2 mt-4 mb-2' }, '排程'),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '預計日期'),
                h('input', { type: 'date', name: 'expectedDate', value: formData.expectedDate, onChange: handleChange, className: IESS.inputClsDate })
              ),
              ExpectedTimeRangeFields({
                startValue: formData.expectedTimeStart,
                endValue: formData.expectedTimeEnd,
                onChange: handleChange
              }),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '組別'),
                renderAssigneeMultiSelect(formData, function (next) {
                  formData.assignees = next;
                  formData.assigneeMemberIds = CaseAssigneeFields.syncMemberIds(next, formData.assigneeMemberIds);
                  rerender();
                }, { id: 'store-repair-assignees' })
              ),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '指派人員'),
                renderMemberMultiSelect(formData, function (next) {
                  formData.assigneeMemberIds = next;
                  rerender();
                }, { id: 'store-repair-assignee-members' })
              )
            )
          ),
          h('div', { className: 'mt-8 pt-6 border-t flex justify-end gap-3' },
            h('button', {
              type: 'button', onClick: backToStore,
              className: 'px-6 py-2.5 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
            }, '取消'),
            h('button', {
              type: 'submit',
              className: 'flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-colors'
            }, Icons.Save({ className: 'h-5 w-5' }), ' 儲存')
          )
        )
      );
    });
  }

  window.StoreRepairForm = StoreRepairForm;
})();
