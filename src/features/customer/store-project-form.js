/*
 * features/customer/store-project-form.js — 門市管理：由門市資料新增立案單
 * props: { store, cases, setCases, deviceCategories, setView, showToast }
 *
 * 由「編輯門市」頁右上方 [新增立案單] 進入，客戶／門市／地址／服務等級皆由門市自動帶入。
 * 可透過 [加入設備] 暫存多筆設備資料，儲存後新增一筆工程立案單（寫入工程立案清單）。
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, useDragScroll = IESS.useDragScroll;
  var iconActionBtn = IESS.iconActionBtn;

  function StoreProjectForm(props) {
    var store = props.store || {};
    var cases = props.cases;
    var setCases = props.setCases;
    var deviceCategories = props.deviceCategories || [];
    var setView = props.setView;
    var showToast = props.showToast;

    var backToStore = function () { setView('store-edit'); };

    var contractors = ['內部工程組', '外包廠商A', '外包廠商B', '機電維護商'];
    var showAddContractor = false;
    var newContractor = '';

    var formData = {
      workCategory: PROJECT_WORK_CATEGORIES[0],
      contactPerson: '',
      suggestedContractor: '',
      entryDate: '',
      remarks: ''
    };
    var equipmentList = [];
    var equipModal = { show: false, editingId: null, initialEquip: null };

    var inputCls = 'w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500';
    var disabledCls = 'w-full p-2.5 bg-gray-50 border rounded-md text-gray-500 cursor-not-allowed';
    var dragProps = useDragScroll();

    return stateful(function (rerender) {
      function handleChange(e) {
        formData[e.target.name] = e.target.value;
        rerender();
      }
      function openEquipModal(eq) {
        equipModal = {
          show: true,
          editingId: eq ? eq.id : null,
          initialEquip: eq
            ? DeviceCategoryUtils.resolveProjectEquip(eq, deviceCategories)
            : DeviceCategoryUtils.defaultEquipRecord()
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
      function handleAddContractor() {
        if (newContractor.trim()) {
          contractors = contractors.concat([newContractor.trim()]);
          formData.suggestedContractor = newContractor.trim();
          newContractor = '';
          showAddContractor = false;
          showToast('已新增並套用施作單位');
          rerender();
        }
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
                  h('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, '建議施作單位'),
                  h('div', { className: 'flex gap-2' },
                    h('select', { name: 'suggestedContractor', value: formData.suggestedContractor, onChange: handleChange, className: inputCls },
                      h('option', { value: '' }, '請選擇單位'),
                      contractors.map(function (c) { return h('option', { key: c, value: c }, c); })),
                    iconActionBtn({
                      label: '新增單位選項', type: 'button',
                      onClick: function () { showAddContractor = true; rerender(); },
                      className: 'px-3 border border-gray-300 rounded-md bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors',
                      icon: Icons.Plus({ className: 'h-5 w-5' })
                    })
                  )
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
                  type: 'button', onClick: function () { openEquipModal(null); },
                  className: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-md flex items-center gap-2 font-medium transition-colors border border-indigo-200'
                }, Icons.Plus({ className: 'h-4 w-4' }), ' 加入設備')
              ),
              h('div', Object.assign({ className: 'overflow-x-auto border rounded-lg border-gray-200 cursor-grab active:cursor-grabbing' }, dragProps),
                h('table', { className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap select-none' },
                  h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
                    h('tr', null,
                      h('th', { className: 'p-3 font-semibold' }, '設備分類'),
                      h('th', { className: 'p-3 font-semibold' }, '品牌'),
                      h('th', { className: 'p-3 font-semibold' }, '設備規格'),
                      h('th', { className: 'p-3 font-semibold' }, '型號'),
                      h('th', { className: 'p-3 font-semibold' }, '設備等級'),
                      h('th', { className: 'p-3 font-semibold' }, '設備區域'),
                      h('th', { className: 'p-3 font-semibold text-center w-24' }, '操作'))),
                  h('tbody', { className: 'divide-y divide-gray-100' },
                    equipmentList.length === 0
                      ? h('tr', null, h('td', { colspan: '7', className: 'text-center p-8 text-gray-400 bg-gray-50/50' }, '尚未加入任何設備資料'))
                      : equipmentList.map(function (eq) {
                          return h('tr', { key: eq.id, className: 'hover:bg-gray-50' },
                            h('td', { className: 'p-3' },
                              h('div', { className: 'font-medium text-gray-800' }, eq.category || '-'),
                              eq.deviceName ? h('div', { className: 'text-xs text-gray-500' }, eq.deviceName) : null),
                            h('td', { className: 'p-3' }, eq.brand || '-'),
                            h('td', { className: 'p-3' }, eq.specification || '-'),
                            h('td', { className: 'p-3 font-medium text-indigo-600' }, eq.model || '-'),
                            h('td', { className: 'p-3' }, DeviceCategoryUtils.formatEquipmentLevel(deviceCategories, eq) || '-'),
                            h('td', { className: 'p-3' }, eq.area || '-'),
                            h('td', { className: 'p-3 text-center' },
                              h('div', { className: 'flex items-center justify-center gap-1' },
                                h('button', {
                                  type: 'button', onClick: function () { openEquipModal(eq); },
                                  className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors', title: '編輯設備'
                                }, Icons.Edit({ className: 'h-4 w-4' })),
                                h('button', {
                                  type: 'button', onClick: function () { handleDeleteEquipment(eq.id); },
                                  className: 'p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors', title: '刪除設備'
                                }, Icons.Trash2({ className: 'h-4 w-4' }))
                              )
                            ));
                        })
                  )
                )
              )
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
        showAddContractor && h('div', { className: 'app-modal-overlay' },
          h('div', { className: 'bg-white rounded-lg shadow-xl p-6 w-80 max-w-full m-4' },
            h('h3', { className: 'text-lg font-bold text-gray-800 mb-4' }, '新增施作單位'),
            h('input', {
              type: 'text', value: newContractor,
              onChange: function (e) { newContractor = e.target.value; rerender(); },
              placeholder: '輸入新的單位名稱',
              className: 'w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500 mb-6',
              autoFocus: true
            }),
            h('div', { className: 'flex justify-end space-x-3' },
              h('button', {
                type: 'button',
                onClick: function () { showAddContractor = false; newContractor = ''; rerender(); },
                className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50'
              }, '取消'),
              h('button', {
                type: 'button', onClick: handleAddContractor,
                className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
              }, '確定新增')
            )
          )
        )
      );
    });
  }

  window.StoreProjectForm = StoreProjectForm;
})();
