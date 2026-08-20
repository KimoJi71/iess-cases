/*
 * features/customer/store-project-form.js — 門市管理：由門市資料新增立案單
 * props: { store, cases, setCases, equipments, deviceCategories, setView, showToast }
 *
 * 由「編輯門市」頁右上方 [新增立案單] 進入，客戶／門市／地址／服務等級皆由門市自動帶入。
 * 可透過 [加入設備] 暫存多筆設備資料，儲存後新增一筆工程立案單（寫入工程立案清單）。
 * 工項分類為「汰換／撤店」時，[加入設備] 改為從該門市既有設備多選。
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  function StoreProjectForm(props) {
    var store = props.store || {};
    var cases = props.cases;
    var setCases = props.setCases;
    var equipments = props.equipments || [];
    var deviceCategories = props.deviceCategories || [];
    var setView = props.setView;
    var showToast = props.showToast;

    var backToStore = function () { setView('store-edit'); };

    // 施作單位選項來自組別管理，不提供新增
    var contractors = ASSIGNEES.slice();

    var formData = {
      workCategory: PROJECT_WORK_CATEGORIES[0],
      contactPerson: '',
      suggestedContractor: '',
      entryDate: '',
      remarks: ''
    };
    var equipmentList = [];
    var equipModal = { show: false, editingId: null, initialEquip: null };
    var equipPicker = { show: false };
    var categoryConfirm = { show: false, nextCategory: '' };

    var inputCls = IESS.inputCls;
    var disabledCls = 'w-full p-2.5 bg-gray-50 border rounded-md text-gray-500 cursor-not-allowed';

    return stateful(function (rerender) {
      function handleChange(e) {
        var name = e.target.name;
        var value = e.target.value;
        // 工項分類跨越「既有設備／手動填寫」兩種模式時，先確認再清空已加入的設備
        if (name === 'workCategory' && equipmentList.length
          && ProjectEquipmentShared.usesEquipmentPicker(value)
            !== ProjectEquipmentShared.usesEquipmentPicker(formData.workCategory)) {
          categoryConfirm = { show: true, nextCategory: value };
          rerender();
          return;
        }
        formData[name] = value;
        rerender();
      }
      function confirmCategorySwitch() {
        equipmentList = [];
        formData.workCategory = categoryConfirm.nextCategory;
        categoryConfirm = { show: false, nextCategory: '' };
        rerender();
      }
      function openAddEquipment() {
        if (ProjectEquipmentShared.usesEquipmentPicker(formData.workCategory)) {
          equipPicker = { show: true };
          rerender();
          return;
        }
        openEquipModal(null);
      }
      function handlePickerConfirm(picked) {
        var stamp = Date.now();
        equipmentList = equipmentList.concat(picked.map(function (eq, idx) {
          return Object.assign({}, eq, { id: stamp + idx });
        }));
        equipPicker = { show: false };
        showToast('已加入 ' + picked.length + ' 筆設備');
        rerender();
      }
      function openEquipModal(eq) {
        equipModal = {
          show: true,
          editingId: eq ? eq.id : null,
          initialEquip: eq
            ? ProjectEquipmentShared.normalizeEquip(eq, deviceCategories)
            : ProjectEquipmentShared.defaultEquip()
        };
        rerender();
      }
      function handleEquipSaved(equip) {
        if (equipModal.editingId) {
          equipmentList = equipmentList.map(function (item) {
            return item.id === equipModal.editingId
              ? Object.assign({}, equip, { id: item.id })
              : item;
          });
          showToast('設備更新成功');
        } else {
          equipmentList = equipmentList.concat([Object.assign({}, equip, { id: Date.now() })]);
          showToast('設備暫存成功');
        }
        equipModal = { show: false, editingId: null, initialEquip: null };
        rerender();
      }
      function handleDeleteEquipment(id) {
        equipmentList = equipmentList.filter(function (eq) { return eq.id !== id; });
        rerender();
      }
      function handleSubmit(e) {
        e.preventDefault();
        var newProjectNumber = '' + todayDate.replace(/-/g, '') + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        var newCase = {
          id: 'P' + Date.now(),
          projectNumber: newProjectNumber,
          creationDate: todayDate,
          customerName: store.customerName || '',
          storeName: store.storeName || '',
          workCategory: formData.workCategory,
          currentStage: '立案時間',
          stageDate: todayDate,
          stageAssignee: formData.contactPerson || '',
          isClosed: false,
          history: [{ stage: '立案時間', date: todayDate, assignee: formData.contactPerson || '' }],
          comments: [],
          details: {
            workCategory: formData.workCategory,
            customerName: store.customerName || '',
            storeName: store.storeName || '',
            storeAddress: StoreUtils.buildFullAddress(store),
            serviceLevel: store.serviceLevel || 'D 維修(無簽約客戶)',
            contactPerson: formData.contactPerson,
            suggestedContractor: formData.suggestedContractor,
            entryDate: formData.entryDate,
            remarks: formData.remarks,
            equipment: equipmentList
          }
        };
        setCases([newCase].concat(cases));
        showToast('工程立案單建立成功，編號：' + newProjectNumber);
        backToStore();
      }

      return h('div', { className: 'max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative' },
        PageHeader({
          title: '新增立案單',
          badge: (store.customerName || '') + ' / ' + (store.storeName || ''),
          onClose: backToStore,
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
        }),
        h('form', { onSubmit: handleSubmit, className: 'p-6' },
          h('div', { className: 'space-y-8' },
            h('section', null,
              h('h3', { className: 'text-lg font-bold text-blue-800 border-b pb-2 mb-4' }, '1. 案件資料'),
              h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-6' },
                h('div', null,
                  h('label', { className: 'block text-sm font-medium text-gray-500 mb-1' }, '客戶名稱'),
                  h('input', { type: 'text', value: store.customerName || '', disabled: true, className: disabledCls })
                ),
                h('div', null,
                  h('label', { className: 'block text-sm font-medium text-gray-500 mb-1' }, '門市名稱'),
                  h('input', { type: 'text', value: store.storeName || '', disabled: true, className: disabledCls })
                ),
                h('div', { className: 'col-span-full md:col-span-2' },
                  h('label', { className: 'block text-sm font-medium text-gray-500 mb-1' }, '門市地址'),
                  h('input', { type: 'text', value: StoreUtils.buildFullAddress(store), disabled: true, className: disabledCls })
                ),
                h('div', null,
                  h('label', { className: 'block text-sm font-medium text-gray-500 mb-1' }, '服務等級'),
                  h('input', { type: 'text', value: store.serviceLevel || '—', disabled: true, className: disabledCls })
                ),
                h('div', null,
                  h('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, '工項分類'),
                  h('select', { name: 'workCategory', value: formData.workCategory, onChange: handleChange, className: inputCls },
                    PROJECT_WORK_CATEGORIES.map(function (opt) { return h('option', { key: opt, value: opt }, opt); }))
                ),
                h('div', null,
                  h('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, '負責人員'),
                  h('select', { name: 'contactPerson', value: formData.contactPerson, onChange: handleChange, className: inputCls },
                    h('option', { value: '' }, '請選擇'),
                    PROJECT_ASSIGNEES.map(function (opt) { return h('option', { key: opt, value: opt }, opt); }))
                ),
                h('div', null,
                  h('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, '施作單位'),
                  h('select', { name: 'suggestedContractor', value: formData.suggestedContractor, onChange: handleChange, className: inputCls },
                    h('option', { value: '' }, '請選擇單位'),
                    contractors.map(function (c) { return CaseAssigneeFields.renderGroupOption(c); }))
                ),
                h('div', null,
                  h('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, '進場日期'),
                  h('input', { type: 'date', name: 'entryDate', value: formData.entryDate, onChange: handleChange, className: inputCls })
                ),
                h('div', { className: 'col-span-full' },
                  h('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, '其他事項說明'),
                  h('textarea', {
                    name: 'remarks', value: formData.remarks, onChange: handleChange, rows: 3,
                    placeholder: '請輸入其他補充事項...', className: inputCls + ' resize-none'
                  })
                )
              )
            ),
            h('section', null,
              h('div', { className: 'flex justify-between items-center border-b pb-2 mb-4' },
                h('h3', { className: 'text-lg font-bold text-blue-800' }, '2. 設備資料 ',
                  h('span', { className: 'text-sm font-normal text-gray-400' }, '(可多筆)')),
                h('button', {
                  type: 'button', onClick: openAddEquipment,
                  className: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-md flex items-center gap-2 font-medium transition-colors border border-indigo-200'
                }, Icons.Plus({ className: 'h-4 w-4' }), ' 加入設備')
              ),
              // 設備欄位與「設備管理」一致，與工程立案的設備表格共用
              ProjectEquipmentShared.equipmentTable(equipmentList, {
                deviceCategories: deviceCategories,
                // 汰換／撤店的設備是既有資料，只可移除
                onEdit: ProjectEquipmentShared.usesEquipmentPicker(formData.workCategory)
                  ? null : openEquipModal,
                onDelete: handleDeleteEquipment
              })
            )
          ),
          h('div', { className: 'mt-8 pt-6 border-t flex justify-end gap-4' },
            h('button', {
              type: 'button', onClick: backToStore,
              className: 'px-6 py-2.5 border rounded-md text-gray-600 hover:bg-gray-50 font-medium transition-colors'
            }, '取消'),
            h('button', {
              type: 'submit',
              className: 'px-8 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 font-bold shadow-sm transition-colors'
            }, Icons.Save({ className: 'h-5 w-5' }), ' 儲存')
          )
        ),
        equipModal.show && h(ProjectEquipModal, {
          initialEquip: equipModal.initialEquip,
          editingId: equipModal.editingId,
          deviceCategories: deviceCategories,
          showToast: showToast,
          onClose: function () {
            equipModal = { show: false, editingId: null, initialEquip: null };
            rerender();
          },
          onSave: handleEquipSaved
        }),
        equipPicker.show && h(ProjectEquipPicker, {
          equipments: equipments,
          customerName: store.customerName || '',
          storeName: store.storeName || '',
          addedIds: ProjectEquipmentShared.pickedSourceIds(equipmentList),
          onConfirm: handlePickerConfirm,
          onClose: function () {
            equipPicker = { show: false };
            rerender();
          }
        }),
        categoryConfirm.show && h(ProjectEquipmentShared.CategorySwitchConfirmModal, {
          nextCategory: categoryConfirm.nextCategory,
          onConfirm: confirmCategorySwitch,
          onCancel: function () {
            categoryConfirm = { show: false, nextCategory: '' };
            rerender();
          }
        })
      );
    });
  }

  window.StoreProjectForm = StoreProjectForm;
})();
