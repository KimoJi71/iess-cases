/*
 * features/customer/store-project-form.js — 門市管理：由門市資料新增立案單
 * props: { store, cases, setCases, setView, showToast }
 *
 * 由「編輯門市」頁右上方 [新增立案單] 進入，客戶／門市／地址／服務等級皆由門市自動帶入。
 * 可透過 [加入設備] 暫存多筆設備資料，儲存後新增一筆工程立案單（寫入工程立案清單）。
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, useDragScroll = IESS.useDragScroll;

  function defaultEquip() {
    return {
      category: EQUIPMENT_CATEGORIES[0],
      name: '',
      area: '',
      brand: EQUIPMENT_BRANDS[0],
      manufactureDate: '',
      type: EQUIPMENT_TYPES[0],
      installDate: '',
      model: '',
      assetNumber: '',
      serialNumber: ''
    };
  }

  function StoreProjectForm(props) {
    var store = props.store || {};
    var cases = props.cases;
    var setCases = props.setCases;
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
    var equipModal = { show: false };
    var currentEquip = defaultEquip();

    var inputCls = 'w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500';
    var disabledCls = 'w-full p-2.5 bg-gray-50 border rounded-md text-gray-500 cursor-not-allowed';
    var dragProps = useDragScroll();

    return stateful(function (rerender) {
      function handleChange(e) {
        formData[e.target.name] = e.target.value;
        rerender();
      }
      function handleEquipChange(e) {
        currentEquip[e.target.name] = e.target.value;
        rerender();
      }
      function openAddEquip() {
        currentEquip = defaultEquip();
        equipModal = { show: true };
        rerender();
      }
      function handleSaveEquipment() {
        if (!currentEquip.model.trim()) {
          showToast('設備型號為必填', 'error');
          return;
        }
        equipmentList = equipmentList.concat([Object.assign({}, currentEquip, { id: Date.now() })]);
        equipModal = { show: false };
        showToast('設備暫存成功');
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
          stageAssignee: '管理員',
          isClosed: false,
          history: [{ stage: '立案時間', date: todayDate, assignee: '管理員' }],
          comments: [],
          details: {
            workCategory: formData.workCategory,
            customerName: store.customerName || '',
            storeName: store.storeName || '',
            storeAddress: store.companyAddress || '',
            serviceLevel: store.serviceLevel || '維修(無簽約客戶)',
            contactPerson: formData.contactPerson,
            suggestedContractor: formData.suggestedContractor,
            entryDate: formData.entryDate,
            remarks: formData.remarks,
            equipment: equipmentList
          }
        };
        setCases([newCase].concat(cases));
        showToast('立案單建立成功，編號：' + newProjectNumber);
        backToStore();
      }

      return h('div', { className: 'max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative' },
        PageHeader({
          title: '新增立案單',
          badge: store.storeName ? (store.customerName + ' / ' + store.storeName) : null,
          onClose: backToStore,
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
        }),
        h('form', { onSubmit: handleSubmit, className: 'p-6' },
          h('div', { className: 'space-y-8' },
            // === 1. 案件資料 ===
            h('section', null,
              h('h3', { className: 'text-lg font-bold text-blue-800 border-b pb-2 mb-4' }, '1. 案件資料'),
              h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-6' },
                h('div', null,
                  h('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, '工項分類'),
                  h('select', { name: 'workCategory', value: formData.workCategory, onChange: handleChange, className: inputCls },
                    PROJECT_WORK_CATEGORIES.map(function (opt) { return h('option', { key: opt, value: opt }, opt); }))
                ),
                h('div', null,
                  h('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, '客戶名稱 ',
                    h('span', { className: 'text-xs text-gray-400' }, '(自動帶入)')),
                  h('input', { type: 'text', value: store.customerName || '—', disabled: true, className: disabledCls })
                ),
                h('div', null,
                  h('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, '門市名稱 ',
                    h('span', { className: 'text-xs text-gray-400' }, '(自動帶入)')),
                  h('input', { type: 'text', value: store.storeName || '—', disabled: true, className: disabledCls })
                ),
                h('div', { className: 'col-span-full md:col-span-2' },
                  h('label', { className: 'block text-sm font-medium text-gray-500 mb-1' }, '門市地址 ',
                    h('span', { className: 'text-xs text-gray-400' }, '(自動帶入)')),
                  h('input', { type: 'text', value: store.companyAddress || '—', disabled: true, className: disabledCls })
                ),
                h('div', null,
                  h('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, '服務等級 ',
                    h('span', { className: 'text-xs text-gray-400' }, '(自動帶入)')),
                  h('input', { type: 'text', value: store.serviceLevel || '—', disabled: true, className: disabledCls })
                ),
                h('div', null,
                  h('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, '工程聯絡人'),
                  h('input', {
                    type: 'text', name: 'contactPerson', value: formData.contactPerson, onChange: handleChange,
                    placeholder: '請輸入聯絡人姓名/電話', className: inputCls
                  })
                ),
                h('div', null,
                  h('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, '建議施作單位'),
                  h('div', { className: 'flex gap-2' },
                    h('select', { name: 'suggestedContractor', value: formData.suggestedContractor, onChange: handleChange, className: inputCls },
                      h('option', { value: '' }, '請選擇單位'),
                      contractors.map(function (c) { return h('option', { key: c, value: c }, c); })),
                    h('button', {
                      type: 'button', onClick: function () { showAddContractor = true; rerender(); },
                      className: 'px-3 border border-gray-300 rounded-md bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors',
                      title: '新增單位選項'
                    }, Icons.Plus({ className: 'h-5 w-5' })))
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
            // === 2. 設備資料 ===
            h('section', null,
              h('div', { className: 'flex justify-between items-center border-b pb-2 mb-4' },
                h('h3', { className: 'text-lg font-bold text-blue-800' }, '2. 設備資料 ',
                  h('span', { className: 'text-sm font-normal text-gray-400' }, '(可多筆)')),
                h('button', {
                  type: 'button', onClick: openAddEquip,
                  className: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-md flex items-center gap-2 font-medium transition-colors border border-indigo-200'
                }, Icons.Plus({ className: 'h-4 w-4' }), ' 加入設備')
              ),
              h('div', Object.assign({ className: 'overflow-x-auto border rounded-lg border-gray-200 cursor-grab active:cursor-grabbing' }, dragProps),
                h('table', { className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap select-none' },
                  h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
                    h('tr', null,
                      h('th', { className: 'p-3 font-semibold' }, '設備分類'),
                      h('th', { className: 'p-3 font-semibold' }, '品牌 / 內外'),
                      h('th', { className: 'p-3 font-semibold' }, '型號'),
                      h('th', { className: 'p-3 font-semibold' }, '設備區域'),
                      h('th', { className: 'p-3 font-semibold' }, '資產編號'),
                      h('th', { className: 'p-3 font-semibold text-center w-20' }, '操作'))),
                  h('tbody', { className: 'divide-y divide-gray-100' },
                    equipmentList.length === 0
                      ? h('tr', null, h('td', { colspan: '6', className: 'text-center p-8 text-gray-400 bg-gray-50/50' }, '尚未加入任何設備資料'))
                      : equipmentList.map(function (eq) {
                          return h('tr', { key: eq.id, className: 'hover:bg-gray-50' },
                            h('td', { className: 'p-3' },
                              h('div', { className: 'font-medium text-gray-800' }, eq.category),
                              eq.name ? h('div', { className: 'text-xs text-gray-500' }, eq.name) : null),
                            h('td', { className: 'p-3' }, eq.brand, ' ', h('span', { className: 'text-gray-400' }, '|'), ' ', eq.type),
                            h('td', { className: 'p-3 font-medium text-indigo-600' }, eq.model),
                            h('td', { className: 'p-3' }, eq.area || '-'),
                            h('td', { className: 'p-3' }, eq.assetNumber || '-'),
                            h('td', { className: 'p-3 text-center' },
                              h('button', {
                                type: 'button', onClick: function () { handleDeleteEquipment(eq.id); },
                                className: 'p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors', title: '刪除設備'
                              }, Icons.Trash2({ className: 'h-4 w-4' }))));
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
        // === 設備 Modal ===
        equipModal.show && h('div', { className: 'fixed inset-0 bg-black/40 flex items-center justify-center z-50' },
          h('div', { className: 'bg-white rounded-lg shadow-xl p-6 w-[600px] max-w-full m-4 flex flex-col max-h-[90vh]' },
            h('div', { className: 'flex items-center justify-between mb-4 border-b pb-3 shrink-0' },
              h('h3', { className: 'text-lg font-bold text-gray-800' }, '新增 / 編輯設備'),
              h('button', {
                type: 'button', onClick: function () { equipModal = { show: false }; rerender(); },
                className: 'text-gray-500 hover:bg-gray-100 p-1 rounded-full'
              }, Icons.X({ className: 'h-5 w-5' }))
            ),
            h('div', { className: 'overflow-y-auto pr-2 space-y-4 flex-1' },
              h('div', { className: 'grid grid-cols-2 gap-4' },
                h('div', null,
                  h('label', { className: 'block text-sm text-gray-600 mb-1' }, '設備分類'),
                  h('select', { name: 'category', value: currentEquip.category, onChange: handleEquipChange, className: 'w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none' },
                    EQUIPMENT_CATEGORIES.map(function (opt) { return h('option', { key: opt, value: opt }, opt); }))
                ),
                h('div', null,
                  h('label', { className: 'block text-sm text-gray-600 mb-1' }, '設備名稱'),
                  h('input', { type: 'text', name: 'name', value: currentEquip.name, onChange: handleEquipChange, placeholder: '例如：1F營業廳空調', className: 'w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none' })
                ),
                h('div', { className: 'col-span-2' },
                  h('label', { className: 'block text-sm text-gray-600 mb-1' }, '設備區域'),
                  h('input', { type: 'text', name: 'area', value: currentEquip.area, onChange: handleEquipChange, placeholder: '例如：天花板上方', className: 'w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none' })
                ),
                h('div', null,
                  h('label', { className: 'block text-sm text-gray-600 mb-1' }, '品牌'),
                  h('select', { name: 'brand', value: currentEquip.brand, onChange: handleEquipChange, className: 'w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none' },
                    EQUIPMENT_BRANDS.map(function (opt) { return h('option', { key: opt, value: opt }, opt); }))
                ),
                h('div', null,
                  h('label', { className: 'block text-sm text-gray-600 mb-1' }, '出廠日期'),
                  h('input', { type: 'date', name: 'manufactureDate', value: currentEquip.manufactureDate, onChange: handleEquipChange, className: 'w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none' })
                ),
                h('div', null,
                  h('label', { className: 'block text-sm text-gray-600 mb-1' }, '內 / 外'),
                  h('select', { name: 'type', value: currentEquip.type, onChange: handleEquipChange, className: 'w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none' },
                    EQUIPMENT_TYPES.map(function (opt) { return h('option', { key: opt, value: opt }, opt); }))
                ),
                h('div', null,
                  h('label', { className: 'block text-sm text-gray-600 mb-1' }, '安裝日期'),
                  h('input', { type: 'date', name: 'installDate', value: currentEquip.installDate, onChange: handleEquipChange, className: 'w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none' })
                ),
                h('div', { className: 'col-span-2' },
                  h('label', { className: 'block text-sm text-gray-600 mb-1' }, '型號 ', h('span', { className: 'text-red-500' }, '*')),
                  h('input', { type: 'text', name: 'model', value: currentEquip.model, onChange: handleEquipChange, placeholder: '輸入設備型號', required: true, className: 'w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none' })
                ),
                h('div', null,
                  h('label', { className: 'block text-sm text-gray-600 mb-1' }, '資產編號'),
                  h('input', { type: 'text', name: 'assetNumber', value: currentEquip.assetNumber, onChange: handleEquipChange, placeholder: '選填', className: 'w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none' })
                ),
                h('div', null,
                  h('label', { className: 'block text-sm text-gray-600 mb-1' }, '流水序號 (QR Code)'),
                  h('input', { type: 'text', name: 'serialNumber', value: currentEquip.serialNumber, onChange: handleEquipChange, placeholder: '選填', className: 'w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none' })
                )
              )
            ),
            h('div', { className: 'flex justify-end space-x-3 mt-6 pt-4 border-t shrink-0' },
              h('button', {
                type: 'button', onClick: function () { equipModal = { show: false }; rerender(); },
                className: 'px-4 py-2 border rounded text-gray-600 hover:bg-gray-50 transition-colors'
              }, '取消'),
              h('button', {
                type: 'button', onClick: handleSaveEquipment,
                className: 'px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors'
              }, '儲存')
            )
          )
        ),
        // === 新增施作單位 Modal ===
        showAddContractor && h('div', { className: 'fixed inset-0 bg-black/40 flex items-center justify-center z-[60]' },
          h('div', { className: 'bg-white rounded-lg shadow-xl p-6 w-80 max-w-full m-4' },
            h('h3', { className: 'text-lg font-bold text-gray-800 mb-4' }, '新增施作單位'),
            h('input', {
              type: 'text', value: newContractor,
              onChange: function (e) { newContractor = e.target.value; rerender(); },
              placeholder: '輸入新的單位名稱', autoFocus: true,
              className: 'w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500 mb-6'
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
