/*
 * features/project/project-form.js — 工程立案：新增立案單 / 編輯工程案件
 * AddProjectForm  props: { cases, setCases, stores, deviceCategories, setView, showToast }
 * EditProjectForm props: { editingCase, cases, setCases, stores, accounts, deviceCategories, repairCases, setView, showToast, backView, mode }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, useDragScroll = IESS.useDragScroll, TimeInput24 = IESS.TimeInput24;
  var iconActionBtn = IESS.iconActionBtn;

  function projectReadOnlyField(label, value, opts) {
    opts = opts || {};
    return h('div', { className: opts.fullWidth ? 'col-span-full' : '' },
      h('span', { className: 'text-gray-500 block mb-1 text-xs' }, label),
      h('div', {
        className: 'font-medium bg-gray-50 p-2.5 rounded-md border border-gray-100 min-h-[42px] flex items-center'
      }, value || '—')
    );
  }

  function defaultEquip() {
    return {
      category: '',
      brand: '',
      deviceName: '',
      specification: '',
      model: '',
      area: '',
      manufactureDate: '',
      installDate: '',
      assetNumber: '',
      serialNumber: ''
    };
  }

  function normalizeEquip(eq, deviceCategories) {
    if (!eq) return defaultEquip();
    if (deviceCategories && deviceCategories.length) {
      return DeviceCategoryUtils.resolveProjectEquip(eq, deviceCategories);
    }
    return {
      category: eq.category || '',
      brand: eq.brand || '',
      deviceName: eq.deviceName || eq.name || '',
      specification: eq.specification || '',
      model: eq.model || '',
      area: eq.area || '',
      manufactureDate: eq.manufactureDate || '',
      installDate: eq.installDate || '',
      assetNumber: eq.assetNumber || '',
      serialNumber: eq.serialNumber || ''
    };
  }

  function renderEquipSelect(label, name, options, currentEquip, onChange, opts) {
    opts = opts || {};
    var disabled = !!opts.disabled;
    if (name === 'category') {
      disabled = disabled || options.length === 0;
    } else if (opts.waitFor) {
      disabled = disabled || !currentEquip[opts.waitFor] || options.length === 0;
    } else {
      disabled = disabled || options.length === 0;
    }
    return h('div', null,
      h('label', { className: 'block text-sm text-gray-600 mb-1' },
        label,
        opts.required && h('span', { className: 'text-red-500' }, ' *')),
      h('select', {
        name: name,
        value: currentEquip[name] || '',
        onChange: onChange,
        disabled: disabled,
        className: 'w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none' + (disabled ? ' bg-gray-100 text-gray-400 cursor-not-allowed' : '')
      },
        h('option', { value: '', disabled: true }, disabled ? (opts.emptyHint || '請先選擇上層欄位') : '請選擇'),
        options.map(function (opt) {
          return h('option', { key: opt, value: opt }, opt);
        })
      )
    );
  }

  function ProjectEquipModal(props) {
    var deviceCategories = props.deviceCategories || [];
    var editingId = props.editingId;
    var onClose = props.onClose;
    var onSave = props.onSave;
    var showToast = props.showToast;
    var currentEquip = normalizeEquip(props.initialEquip, deviceCategories);

    return stateful(function (rerender) {
      function handleEquipChange(e) {
        currentEquip = DeviceCategoryUtils.applyEquipFieldChange(currentEquip, e.target.name, e.target.value);
        rerender();
      }

      function handleSaveClick() {
        if (!currentEquip.category) {
          showToast('設備分類為必填', 'error');
          return;
        }
        if (!currentEquip.model) {
          showToast('型號為必填', 'error');
          return;
        }
        if (!DeviceCategoryUtils.isValidEquipSelection(currentEquip, deviceCategories)) {
          showToast('請從設備分類管理選擇有效的設備型號', 'error');
          return;
        }
        onSave(currentEquip);
      }

      var fieldOptions = DeviceCategoryUtils.getEquipFieldOptions(deviceCategories, currentEquip);

      return h('div', { className: 'app-modal-overlay p-4 overflow-y-auto' },
        h('div', { className: 'bg-white rounded-lg shadow-xl p-6 w-full sm:w-[600px] max-w-full m-auto flex flex-col max-h-[90vh] min-w-0' },
          h('div', { className: 'flex items-center justify-between mb-4 border-b pb-3 shrink-0' },
            h('h3', { className: 'text-lg font-bold text-gray-800' }, editingId ? '編輯設備' : '新增設備'),
            h('button', {
              type: 'button',
              onClick: onClose,
              title: '關閉',
              className: 'text-gray-500 hover:bg-gray-100 p-1 rounded-full'
            }, Icons.X({ className: 'h-5 w-5' }))),
          h('div', { className: 'overflow-y-auto pr-2 space-y-4 flex-1' },
            h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
              renderEquipSelect('設備分類', 'category', fieldOptions.category, currentEquip, handleEquipChange, {
                required: true,
                emptyHint: '尚無設備分類資料'
              }),
              renderEquipSelect('品牌', 'brand', fieldOptions.brand, currentEquip, handleEquipChange, {
                waitFor: 'category',
                emptyHint: '請先選擇設備分類'
              }),
              renderEquipSelect('設備名稱', 'deviceName', fieldOptions.deviceName, currentEquip, handleEquipChange, {
                waitFor: 'brand',
                emptyHint: '請先選擇品牌'
              }),
              renderEquipSelect('設備規格', 'specification', fieldOptions.specification, currentEquip, handleEquipChange, {
                waitFor: 'deviceName',
                emptyHint: '請先選擇設備名稱'
              }),
              h('div', { className: 'col-span-2' },
                renderEquipSelect('型號', 'model', fieldOptions.model, currentEquip, handleEquipChange, {
                  required: true,
                  waitFor: 'specification',
                  emptyHint: '請先選擇設備規格'
                })),
              h('div', { className: 'col-span-2' },
                h('label', { className: 'block text-sm text-gray-600 mb-1' }, '設備等級'),
                h('input', {
                  type: 'text',
                  value: DeviceCategoryUtils.formatEquipmentLevel(deviceCategories, currentEquip),
                  placeholder: '請先選擇型號',
                  disabled: true,
                  className: 'w-full p-2 bg-gray-50 border rounded text-gray-500 cursor-not-allowed'
                })),
              h('div', { className: 'col-span-2' },
                h('label', { className: 'block text-sm text-gray-600 mb-1' }, '設備區域'),
                h('input', {
                  type: 'text',
                  name: 'area',
                  value: currentEquip.area,
                  onChange: handleEquipChange,
                  className: 'w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none',
                  placeholder: '例如：天花板上方'
                })),
              h('div', null,
                h('label', { className: 'block text-sm text-gray-600 mb-1' }, '出廠日期'),
                h('input', {
                  type: 'date',
                  name: 'manufactureDate',
                  value: currentEquip.manufactureDate,
                  onChange: handleEquipChange,
                  className: 'w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none'
                })),
              h('div', null,
                h('label', { className: 'block text-sm text-gray-600 mb-1' }, '安裝日期'),
                h('input', {
                  type: 'date',
                  name: 'installDate',
                  value: currentEquip.installDate,
                  onChange: handleEquipChange,
                  className: 'w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none'
                })),
              h('div', null,
                h('label', { className: 'block text-sm text-gray-600 mb-1' }, '資產編號'),
                h('input', {
                  type: 'text',
                  name: 'assetNumber',
                  value: currentEquip.assetNumber,
                  onChange: handleEquipChange,
                  className: 'w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none',
                  placeholder: '選填'
                })),
              h('div', null,
                h('label', { className: 'block text-sm text-gray-600 mb-1' }, '流水序號'),
                h('input', {
                  type: 'text',
                  name: 'serialNumber',
                  value: currentEquip.serialNumber,
                  onChange: handleEquipChange,
                  className: 'w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 outline-none',
                  placeholder: '選填'
                })))),
          h('div', { className: 'flex justify-end space-x-3 mt-6 pt-4 border-t shrink-0' },
            h('button', {
              type: 'button',
              onClick: onClose,
              className: 'px-4 py-2 border rounded text-gray-600 hover:bg-gray-50 transition-colors'
            }, '取消'),
            h('button', {
              type: 'button',
              onClick: handleSaveClick,
              className: 'px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors'
            }, editingId ? '更新設備' : '暫存設備'))));
    });
  }

  function renderEquipmentTableRow(eq, p) {
    return h('tr', { key: eq.id, className: 'hover:bg-gray-50' },
      h('td', { className: 'p-3' },
        h('div', { className: 'font-medium text-gray-800' }, eq.category || '-'),
        h('div', { className: 'text-xs text-gray-500' }, eq.deviceName || eq.name || '')),
      h('td', { className: 'p-3' }, eq.brand || '-'),
      h('td', { className: 'p-3' }, eq.specification || '-'),
      h('td', { className: 'p-3 font-medium text-indigo-600' }, eq.model || '-'),
      h('td', { className: 'p-3' }, DeviceCategoryUtils.formatEquipmentLevel(p.deviceCategories, eq) || '-'),
      h('td', { className: 'p-3' }, eq.area || '-'),
      h('td', { className: 'p-3' },
        h('div', { className: 'text-xs' }, '出：', eq.manufactureDate || '-'),
        h('div', { className: 'text-xs' }, '裝：', eq.installDate || '-')),
      h('td', { className: 'p-3' }, eq.assetNumber || '-'),
      h('td', { className: 'p-3' }, eq.serialNumber || '-'),
      (p.onEdit || p.onDelete) ? h('td', { className: 'p-3 text-center' },
        h('div', { className: 'flex items-center justify-center gap-1' },
          p.onEdit && h('button', {
            type: 'button',
            onClick: function () { p.onEdit(eq); },
            className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors',
            title: '編輯設備'
          }, Icons.Edit({ className: 'h-4 w-4' })),
          p.onDelete && iconActionBtn({ label: '移除此設備', type: 'button',
            onClick: function () { p.onDelete(eq.id); },
            className: 'p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors', icon: Icons.Trash2({ className: 'h-4 w-4' }) }))) : null);
  }

  function equipmentTableHeaders(includeActions) {
    return h('tr', null,
      h('th', { className: 'p-3 font-semibold' }, '設備分類'),
      h('th', { className: 'p-3 font-semibold' }, '品牌'),
      h('th', { className: 'p-3 font-semibold' }, '設備規格'),
      h('th', { className: 'p-3 font-semibold' }, '型號'),
      h('th', { className: 'p-3 font-semibold' }, '設備等級'),
      h('th', { className: 'p-3 font-semibold' }, '設備區域'),
      h('th', { className: 'p-3 font-semibold' }, '出廠 / 安裝日期'),
      h('th', { className: 'p-3 font-semibold' }, '資產編號'),
      h('th', { className: 'p-3 font-semibold' }, '流水序號'),
      includeActions ? h('th', { className: 'p-3 font-semibold text-center w-24' }, '操作') : null);
  }

  function AddProjectForm(props) {
    var cases = props.cases;
    var setCases = props.setCases;
    var stores = props.stores;
    var customers = props.customers;
    var deviceCategories = props.deviceCategories || [];
    var setView = props.setView;
    var showToast = props.showToast;

    var formData = {
      workCategory: '新開',
      customerName: '',
      storeName: '',
      storeAddress: '自動帶入地址',
      serviceLevel: 'D 維修(無簽約客戶)',
      contactPerson: '',
      suggestedContractor: '',
      entryDate: '',
      remarks: ''
    };
    var contractors = ['內部工程組', '外包廠商A', '外包廠商B', '機電維護商'];
    var showAddContractor = false;
    var newContractor = '';
    var equipmentList = [];
    var equipModal = { show: false, editingId: null, initialEquip: null };

    return stateful(function (rerender) {
      var storeOptions = ScheduleUtils.getStoreNamesForCustomer(stores, formData.customerName, formData.storeName);
      var customerOptions = CustomerUtils.getCustomerNameOptions(customers, formData.customerName);

      function syncProjectStoreFields() {
        var synced = ScheduleUtils.applyStoreSnapshot(formData, stores);
        formData.storeAddress = synced.storeAddress || '';
        formData.serviceLevel = synced.serviceLevel || formData.serviceLevel;
      }

      function handleChange(e) {
        var name = e.target.name;
        var value = e.target.value;
        formData[name] = value;
        if (name === 'customerName') {
          formData.serviceLevel = CustomerUtils.getServiceLevelByCustomerName(customers, value);
          formData.storeName = '';
          formData.storeAddress = '';
        }
        if (name === 'storeName') {
          syncProjectStoreFields();
        }
        rerender();
      }
      function openEquipModal(eq) {
        equipModal = {
          show: true,
          editingId: eq ? eq.id : null,
          initialEquip: eq ? normalizeEquip(eq, deviceCategories) : defaultEquip()
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
        if (!formData.customerName || !formData.storeName) {
          showToast('客戶名稱與門市名稱為必填', 'error');
          return;
        }
        var newProjectNumber = '' + todayDate.replace(/-/g, '') + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        var newCase = {
          id: 'P' + Date.now(),
          projectNumber: newProjectNumber,
          creationDate: todayDate,
          customerName: formData.customerName,
          storeName: formData.storeName,
          workCategory: formData.workCategory,
          currentStage: '立案時間',
          stageDate: todayDate,
          stageAssignee: formData.contactPerson || '',
          isClosed: false,
          history: [{
            stage: '立案時間',
            date: todayDate,
            assignee: formData.contactPerson || ''
          }],
          comments: [],
          details: Object.assign({}, formData, { equipment: equipmentList })
        };
        setCases([newCase].concat(cases));
        showToast('工程立案單建立成功，編號：' + newProjectNumber);
        setView('project-list');
      }

      return h('div', {
        className: 'max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative'
      }, PageHeader({
        title: '新增立案單',
        onClose: function () { setView('project-list'); },
        wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
      }), h('form', {
        onSubmit: handleSubmit,
        className: 'p-6'
      }, h('div', {
        className: 'space-y-8'
      }, h('section', null, h('h3', {
        className: 'text-lg font-bold text-blue-800 border-b pb-2 mb-4'
      }, '1. 案件資料'), h('div', {
        className: 'grid grid-cols-1 md:grid-cols-3 gap-6'
      }, h('div', null, h('label', {
        className: 'block text-sm font-medium text-gray-700 mb-1'
      }, '工項分類'), h('select', {
        name: 'workCategory',
        value: formData.workCategory,
        onChange: handleChange,
        className: 'w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500'
      }, PROJECT_WORK_CATEGORIES.map(function (opt) {
        return h('option', { key: opt, value: opt }, opt);
      }))), h('div', null, h('label', {
        className: 'block text-sm font-medium text-gray-700 mb-1'
      }, '客戶名稱 ', h('span', {
        className: 'text-red-500'
      }, '*')), h('select', {
        required: true,
        name: 'customerName',
        value: formData.customerName,
        onChange: handleChange,
        className: 'w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500'
      }, h('option', {
        value: '',
        disabled: true
      }, '請選擇'), customerOptions.map(function (opt) {
        return h('option', { key: opt, value: opt }, opt);
      }))), h('div', null, h('label', {
        className: 'block text-sm font-medium text-gray-700 mb-1'
      }, '門市名稱 ', h('span', {
        className: 'text-red-500'
      }, '*')), h('select', {
        required: true,
        name: 'storeName',
        value: formData.storeName,
        onChange: handleChange,
        className: 'w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500'
      }, h('option', {
        value: '',
        disabled: true
      }, '請選擇'), storeOptions.map(function (opt) {
        return h('option', { key: opt, value: opt }, opt);
      }))), h('div', {
        className: 'col-span-full md:col-span-2'
      }, h('label', {
        className: 'block text-sm font-medium text-gray-500 mb-1'
      }, '門市地址 (根據門市自動帶入)'), h('input', {
        type: 'text',
        disabled: true,
        value: formData.storeAddress,
        className: 'w-full p-2.5 bg-gray-50 border rounded-md text-gray-500 cursor-not-allowed'
      })), h('div', null, h('label', {
        className: 'block text-sm font-medium text-gray-700 mb-1'
      }, '服務等級'), h('input', {
        type: 'text',
        disabled: true,
        value: formData.serviceLevel || '—',
        className: 'w-full p-2.5 bg-gray-50 border rounded-md text-gray-500 cursor-not-allowed'
      })), h('div', null, h('label', {
        className: 'block text-sm font-medium text-gray-700 mb-1'
      }, '負責人員'), h('select', {
        name: 'contactPerson',
        value: formData.contactPerson,
        onChange: handleChange,
        className: 'w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500'
      }, h('option', {
        value: ''
      }, '請選擇'), PROJECT_ASSIGNEES.map(function (opt) {
        return h('option', { key: opt, value: opt }, opt);
      }))), h('div', null, h('label', {
        className: 'block text-sm font-medium text-gray-700 mb-1'
      }, '建議施作單位'), h('div', {
        className: 'flex gap-2'
      }, h('select', {
        name: 'suggestedContractor',
        value: formData.suggestedContractor,
        onChange: handleChange,
        className: 'w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500'
      }, h('option', {
        value: ''
      }, '請選擇單位'), contractors.map(function (c) {
        return h('option', { key: c, value: c }, c);
      })), iconActionBtn({ label: '新增單位選項', type: 'button',
        onClick: function () { showAddContractor = true; rerender(); },
        className: 'px-3 border border-gray-300 rounded-md bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors', icon: Icons.Plus({
        className: 'h-5 w-5'
      }) }))), h('div', null, h('label', {
        className: 'block text-sm font-medium text-gray-700 mb-1'
      }, '進場日期'), h('input', {
        type: 'date',
        name: 'entryDate',
        value: formData.entryDate,
        onChange: handleChange,
        className: 'w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500'
      })), h('div', {
        className: 'col-span-full'
      }, h('label', {
        className: 'block text-sm font-medium text-gray-700 mb-1'
      }, '其他事項說明'), h('textarea', {
        name: 'remarks',
        value: formData.remarks,
        onChange: handleChange,
        rows: '3',
        placeholder: '請輸入其他補充事項...',
        className: 'w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500 resize-none'
      })))), h('section', null, h('div', {
        className: 'flex justify-between items-center border-b pb-2 mb-4'
      }, h('h3', {
        className: 'text-lg font-bold text-blue-800'
      }, '2. 設備資料'), h('button', {
        type: 'button',
        onClick: function () { openEquipModal(null); },
        className: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-md flex items-center gap-2 font-medium transition-colors border border-indigo-200'
      }, Icons.Plus({
        className: 'h-4 w-4'
      }), ' 加入設備')), h('div', {
        className: 'overflow-x-auto border rounded-lg border-gray-200'
      }, h('table', {
        className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap'
      }, h('thead', {
        className: 'bg-gray-50 text-gray-700 border-b'
      }, equipmentTableHeaders(true)), h('tbody', {
        className: 'divide-y divide-gray-100'
      }, equipmentList.length === 0 ? h('tr', null, h('td', {
        colspan: '10',
        className: 'text-center p-8 text-gray-400 bg-gray-50/50'
      }, '尚未加入任何設備資料')) : equipmentList.map(function (eq) {
        return renderEquipmentTableRow(eq, {
          deviceCategories: deviceCategories,
          onEdit: openEquipModal,
          onDelete: handleDeleteEquipment
        });
      })))))), h('div', {
        className: 'mt-8 pt-6 border-t flex justify-end gap-4'
      }, h('button', {
        type: 'button',
        onClick: function () { setView('project-list'); },
        className: 'px-6 py-2.5 border rounded-md text-gray-600 hover:bg-gray-50 font-medium transition-colors'
      }, '取消'), h('button', {
        type: 'submit',
        className: 'px-8 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 font-bold shadow-sm transition-colors'
      }, Icons.Save({
        className: 'h-5 w-5'
      }), ' 儲存'))), equipModal.show && h(ProjectEquipModal, {
        initialEquip: equipModal.initialEquip,
        editingId: equipModal.editingId,
        deviceCategories: deviceCategories,
        showToast: showToast,
        onClose: function () {
          equipModal = { show: false, editingId: null, initialEquip: null };
          rerender();
        },
        onSave: handleEquipSaved
      }), showAddContractor && h('div', {
        className: 'app-modal-overlay'
      }, h('div', {
        className: 'bg-white rounded-lg shadow-xl p-6 w-80 max-w-full m-4'
      }, h('h3', {
        className: 'text-lg font-bold text-gray-800 mb-4'
      }, '新增施作單位'), h('input', {
        type: 'text',
        value: newContractor,
        onChange: function (e) { newContractor = e.target.value; rerender(); },
        placeholder: '輸入新的單位名稱',
        className: 'w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500 mb-6',
        autoFocus: true
      }), h('div', {
        className: 'flex justify-end space-x-3'
      }, h('button', {
        type: 'button',
        onClick: function () {
          showAddContractor = false;
          newContractor = '';
          rerender();
        },
        className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50'
      }, '取消'), h('button', {
        type: 'button',
        onClick: handleAddContractor,
        className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
      }, '確定新增')))));
    });
  }

  function EditProjectForm(props) {
    var editingCase = props.editingCase;
    var cases = props.cases;
    var setCases = props.setCases;
    var stores = props.stores;
    var customers = props.customers;
    var accounts = props.accounts || [];
    var deviceCategories = props.deviceCategories || [];
    var repairCases = props.repairCases || [];
    var setView = props.setView;
    var showToast = props.showToast;
    var backView = props.backView === undefined ? 'project-list' : props.backView;
    var isEdit = props.mode !== 'view';
    var viewFieldCls = 'w-full p-2.5 bg-gray-50 border rounded-md text-gray-700 cursor-not-allowed';

    var formData = JSON.parse(JSON.stringify(editingCase));
    if (!formData.details) formData.details = {};
    var detailsData = formData.details;
    var equipmentList = (detailsData.equipment || []).slice().map(function (eq) {
      return Object.assign({ id: eq.id }, normalizeEquip(eq, deviceCategories));
    });
    var contractors = ['內部工程組', '外包廠商A', '外包廠商B', '機電維護商'];
    if (detailsData.suggestedContractor && contractors.indexOf(detailsData.suggestedContractor) === -1) {
      contractors = contractors.concat([detailsData.suggestedContractor]);
    }
    var showAddContractor = false;
    var newContractor = '';
    var equipModal = { show: false, editingId: null, initialEquip: null };
    var dragProps = useDragScroll();
    var initialStages = {};
    PROJECT_STAGES.forEach(function (s) {
      var existing = (formData.history || []).find(function (hh) { return hh.stage === s; });
      initialStages[s] = {
        date: (existing && existing.date) || '',
        assignee: (existing && existing.assignee) || '',
        timeStart: (existing && existing.timeStart) || '',
        timeEnd: (existing && existing.timeEnd) || ''
      };
    });
    var stagesData = initialStages;
    var inputCls = 'w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500';
    var fieldCls = isEdit ? inputCls : viewFieldCls;

    return stateful(function (rerender) {
      var storeOptions = ScheduleUtils.getStoreNamesForCustomer(stores, formData.customerName, formData.storeName);
      var customerOptions = CustomerUtils.getCustomerNameOptions(customers, formData.customerName);
      var contactPersonOptions = AccountUtils.getProjectPersonOptions(accounts, [detailsData.contactPerson]);
      var stagePersonOptions = AccountUtils.getProjectPersonOptions(accounts, PROJECT_STAGES.map(function (stage) {
        return stagesData[stage].assignee;
      }).concat([detailsData.contactPerson]));

      function syncProjectStoreFields() {
        var synced = ScheduleUtils.applyStoreSnapshot({
          customerName: formData.customerName,
          storeName: formData.storeName
        }, stores);
        detailsData.storeAddress = synced.storeAddress || detailsData.storeAddress || '';
        detailsData.serviceLevel = synced.serviceLevel || detailsData.serviceLevel || 'D 維修(無簽約客戶)';
      }

      function handleChange(e) {
        var name = e.target.name;
        var value = e.target.value;
        if (name.indexOf('details.') === 0) {
          detailsData[name.slice(8)] = value;
        } else {
          formData[name] = value;
          if (name === 'customerName') {
            detailsData.serviceLevel = CustomerUtils.getServiceLevelByCustomerName(customers, value);
            formData.storeName = '';
            detailsData.storeAddress = '';
          }
          if (name === 'storeName') {
            syncProjectStoreFields();
          }
        }
        rerender();
      }

      function handleStageChange(stage, field, value) {
        stagesData[stage][field] = value;
        rerender();
      }

      function openEquipModal(eq) {
        equipModal = {
          show: true,
          editingId: eq ? eq.id : null,
          initialEquip: eq ? normalizeEquip(eq, deviceCategories) : defaultEquip()
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
          showToast('設備新增成功');
        }
        equipModal = { show: false, editingId: null, initialEquip: null };
        rerender();
      }

      function handleDeleteEquipment(id) {
        var blockedReason = EquipmentUtils.getProjectEquipmentRemoveBlockedReason(id, repairCases);
        if (blockedReason) {
          showToast(blockedReason, 'error');
          return;
        }
        equipmentList = equipmentList.filter(function (eq) { return eq.id !== id; });
        rerender();
      }

      function handleAddContractor() {
        if (newContractor.trim()) {
          contractors = contractors.concat([newContractor.trim()]);
          detailsData.suggestedContractor = newContractor.trim();
          newContractor = '';
          showAddContractor = false;
          showToast('已新增並套用施作單位');
          rerender();
        }
      }

      function handleSubmit(e) {
        e.preventDefault();
        if (!formData.customerName || !formData.storeName) {
          showToast('客戶名稱與門市名稱為必填', 'error');
          return;
        }
        var newHistory = [];
        PROJECT_STAGES.forEach(function (stage) {
          if (stagesData[stage].date || stagesData[stage].assignee) {
            newHistory.push({
              stage: stage,
              date: stagesData[stage].date,
              assignee: stagesData[stage].assignee,
              timeStart: stagesData[stage].timeStart || '',
              timeEnd: stagesData[stage].timeEnd || ''
            });
          }
        });
        var updatedCase = Object.assign({}, formData, {
          customerName: formData.customerName,
          storeName: formData.storeName,
          workCategory: formData.workCategory,
          details: Object.assign({}, detailsData, { equipment: equipmentList }),
          history: newHistory,
          currentStage: newHistory.length > 0 ? newHistory[newHistory.length - 1].stage : '立案時間'
        });
        var currentEntry = newHistory.length > 0 ? newHistory[newHistory.length - 1] : null;
        if (currentEntry && currentEntry.date) {
          updatedCase.planDate = currentEntry.date;
          updatedCase.planTimeStart = currentEntry.timeStart || '';
          updatedCase.planTimeEnd = currentEntry.timeEnd || '';
          updatedCase.stageDate = currentEntry.date;
          updatedCase.stageAssignee = currentEntry.assignee || updatedCase.stageAssignee;
        }
        setCases(cases.map(function (c) { return c.id === updatedCase.id ? updatedCase : c; }));
        showToast('工程案件已成功更新');
        setView(backView);
      }

      return h('div', {
        className: 'max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative'
      }, PageHeader({
        title: isEdit ? '編輯工程案件' : '查看工程案件',
        badge: formData.projectNumber,
        onClose: function () { setView(backView); },
        wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
      }), h('div', {
        className: 'p-6 space-y-8 bg-gray-50'
      }, h('form', {
        id: 'editProjectForm',
        onSubmit: isEdit ? handleSubmit : function (e) { e.preventDefault(); },
        className: 'space-y-8'
      }, h('section', {
        className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100'
      }, h('h3', {
        className: 'text-lg font-bold text-blue-800 border-b pb-2 mb-4'
      }, '1. 案件資料'), isEdit ? h('div', {
        className: 'grid grid-cols-1 md:grid-cols-3 gap-6'
      }, h('div', null, h('label', {
        className: 'block text-sm font-medium text-gray-700 mb-1'
      }, '工項分類'), h('select', {
        name: 'workCategory',
        value: formData.workCategory,
        onChange: handleChange,
        className: fieldCls
      }, PROJECT_WORK_CATEGORIES.map(function (opt) {
        return h('option', { key: opt, value: opt }, opt);
      }))), h('div', null, h('label', {
        className: 'block text-sm font-medium text-gray-700 mb-1'
      }, '客戶名稱 ', h('span', {
        className: 'text-red-500'
      }, '*')), h('select', {
        required: true,
        name: 'customerName',
        value: formData.customerName,
        onChange: handleChange,
        className: fieldCls
      }, h('option', {
        value: '',
        disabled: true
      }, '請選擇'), customerOptions.map(function (opt) {
        return h('option', { key: opt, value: opt }, opt);
      }))), h('div', null, h('label', {
        className: 'block text-sm font-medium text-gray-700 mb-1'
      }, '門市名稱 ', h('span', {
        className: 'text-red-500'
      }, '*')), h('select', {
        required: true,
        name: 'storeName',
        value: formData.storeName,
        onChange: handleChange,
        className: fieldCls
      }, h('option', {
        value: '',
        disabled: true
      }, '請選擇'), storeOptions.map(function (opt) {
        return h('option', { key: opt, value: opt }, opt);
      }))), h('div', {
        className: 'col-span-full md:col-span-2'
      }, h('label', {
        className: 'block text-sm font-medium text-gray-500 mb-1'
      }, '門市地址 (根據門市自動帶入)'), h('input', {
        type: 'text',
        disabled: true,
        value: detailsData.storeAddress || '',
        className: 'w-full p-2.5 bg-gray-50 border rounded-md text-gray-500 cursor-not-allowed'
      })), h('div', null, h('label', {
        className: 'block text-sm font-medium text-gray-700 mb-1'
      }, '服務等級'), h('input', {
        type: 'text',
        disabled: true,
        value: detailsData.serviceLevel || '—',
        className: 'w-full p-2.5 bg-gray-50 border rounded-md text-gray-500 cursor-not-allowed'
      })), h('div', null, h('label', {
        className: 'block text-sm font-medium text-gray-700 mb-1'
      }, '負責人員'), h('select', {
        name: 'details.contactPerson',
        value: detailsData.contactPerson || '',
        onChange: handleChange,
        className: fieldCls
      }, h('option', {
        value: ''
      }, '請選擇'), contactPersonOptions.map(function (opt) {
        return h('option', { key: opt, value: opt }, opt);
      }))), h('div', null, h('label', {
        className: 'block text-sm font-medium text-gray-700 mb-1'
      }, '建議施作單位'), h('div', {
        className: 'flex gap-2'
      }, h('select', {
        name: 'details.suggestedContractor',
        value: detailsData.suggestedContractor || '',
        onChange: handleChange,
        className: fieldCls
      }, h('option', {
        value: ''
      }, '請選擇單位'), contractors.map(function (c) {
        return h('option', { key: c, value: c }, c);
      })), iconActionBtn({ label: '新增單位選項', type: 'button',
        onClick: function () { showAddContractor = true; rerender(); },
        className: 'px-3 border border-gray-300 rounded-md bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors', icon: Icons.Plus({
        className: 'h-5 w-5'
      }) }))), h('div', null, h('label', {
        className: 'block text-sm font-medium text-gray-700 mb-1'
      }, '進場日期'), h('input', {
        type: 'date',
        name: 'details.entryDate',
        value: detailsData.entryDate || '',
        onChange: handleChange,
        className: fieldCls
      })), h('div', null, h('label', {
        className: 'block text-sm font-medium text-gray-500 mb-1'
      }, '立案日期'), h('input', {
        type: 'text',
        disabled: true,
        value: formData.creationDate || '',
        className: 'w-full p-2.5 bg-gray-50 border rounded-md text-gray-500 cursor-not-allowed'
      })), h('div', {
        className: 'col-span-full'
      }, h('label', {
        className: 'block text-sm font-medium text-gray-700 mb-1'
      }, '其他事項說明'), h('textarea', {
        name: 'details.remarks',
        value: detailsData.remarks || '',
        onChange: handleChange,
        rows: '3',
        placeholder: '請輸入其他補充事項...',
        className: fieldCls + ' resize-none'
      }))) : h('div', {
        className: 'grid grid-cols-1 md:grid-cols-3 gap-6'
      },
        projectReadOnlyField('工項分類', formData.workCategory),
        projectReadOnlyField('客戶名稱', formData.customerName),
        projectReadOnlyField('門市名稱', formData.storeName),
        projectReadOnlyField('門市地址', detailsData.storeAddress, { fullWidth: true }),
        projectReadOnlyField('服務等級', detailsData.serviceLevel),
        projectReadOnlyField('負責人員', detailsData.contactPerson),
        projectReadOnlyField('建議施作單位', detailsData.suggestedContractor),
        projectReadOnlyField('進場日期', detailsData.entryDate),
        projectReadOnlyField('立案日期', formData.creationDate),
        projectReadOnlyField('其他事項說明', detailsData.remarks, { fullWidth: true })
      ))), h('section', {
        className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100'
      }, h('div', {
        className: 'flex justify-between items-center border-b pb-2 mb-4'
      }, h('h3', {
        className: 'text-lg font-bold text-blue-800'
      }, '2. 設備資料'), isEdit && h('button', {
        type: 'button',
        onClick: function () { openEquipModal(null); },
        className: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-md flex items-center gap-2 font-medium transition-colors border border-indigo-200'
      }, Icons.Plus({
        className: 'h-4 w-4'
      }), ' 加入設備')), h('div', Object.assign({
        className: 'overflow-x-auto border rounded-lg border-gray-200'
      }, dragProps), h('table', {
        className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap'
      }, h('thead', {
        className: 'bg-gray-50 text-gray-700 border-b'
      }, equipmentTableHeaders(isEdit)), h('tbody', {
        className: 'divide-y divide-gray-100'
      }, equipmentList.length === 0 ? h('tr', null, h('td', {
        colspan: isEdit ? '10' : '9',
        className: 'text-center p-8 text-gray-400 bg-gray-50/50'
      }, '尚未加入任何設備資料')) : equipmentList.map(function (eq) {
        return renderEquipmentTableRow(eq, isEdit ? {
          deviceCategories: deviceCategories,
          onEdit: openEquipModal,
          onDelete: handleDeleteEquipment
        } : { deviceCategories: deviceCategories });
      }))))), h('section', {
        className: 'bg-white p-6 rounded-lg shadow-sm border border-indigo-100 ring-1 ring-indigo-50'
      }, h('h3', {
        className: 'text-lg font-bold text-indigo-800 border-b border-indigo-100 pb-2 mb-6'
      }, '3. 工程項目進度'), h('div', {
        className: 'space-y-4 mb-2'
      }, PROJECT_STAGES.map(function (stage, idx) {
        return h('div', {
          key: stage,
          className: 'flex flex-col md:flex-row md:items-center gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200'
        }, h('div', {
          className: 'flex items-center gap-3 w-48 shrink-0'
        }, h('div', {
          className: 'w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold'
        }, idx + 1), h('span', {
          className: 'font-medium text-gray-800'
        }, stage)), h('div', {
          className: 'flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'
        }, isEdit ? [h('div', { key: stage + '-date' }, h('label', {
          className: 'block text-xs text-gray-500 mb-1'
        }, '作業日期'), h('input', {
          type: 'date',
          value: stagesData[stage].date,
          onChange: function (e) { handleStageChange(stage, 'date', e.target.value); },
          className: 'w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500'
        })), h('div', { key: stage + '-start' }, h('label', {
          className: 'block text-xs text-gray-500 mb-1'
        }, '開始時間'), h(TimeInput24, {
          value: stagesData[stage].timeStart,
          onChange: function (e) { handleStageChange(stage, 'timeStart', e.target.value); },
          className: 'w-full'
        })), h('div', { key: stage + '-end' }, h('label', {
          className: 'block text-xs text-gray-500 mb-1'
        }, '結束時間'), h(TimeInput24, {
          value: stagesData[stage].timeEnd,
          onChange: function (e) { handleStageChange(stage, 'timeEnd', e.target.value); },
          className: 'w-full'
        })), h('div', { key: stage + '-assignee' }, h('label', {
          className: 'block text-xs text-gray-500 mb-1'
        }, '負責人員'), h('select', {
          value: stagesData[stage].assignee,
          onChange: function (e) { handleStageChange(stage, 'assignee', e.target.value); },
          className: 'w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500'
        }, h('option', {
          value: ''
        }, '尚未指派'), stagePersonOptions.map(function (opt) {
          return h('option', { key: opt, value: opt }, opt);
        })))] : [
          projectReadOnlyField('作業日期', stagesData[stage].date),
          projectReadOnlyField('開始時間', stagesData[stage].timeStart),
          projectReadOnlyField('結束時間', stagesData[stage].timeEnd),
          projectReadOnlyField('負責人員', stagesData[stage].assignee || '尚未指派')
        ]));
      }))), isEdit && h('div', {
        className: 'mt-8 pt-6 border-t flex justify-end gap-4'
      }, h('button', {
        type: 'button',
        onClick: function () { setView(backView); },
        className: 'px-6 py-2.5 border rounded-md text-gray-600 hover:bg-gray-50 font-medium transition-colors'
      }, '取消'), h('button', {
        type: 'submit',
        form: 'editProjectForm',
        className: 'px-8 py-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-2 font-bold shadow-sm transition-colors'
      }, Icons.Save({
        className: 'h-5 w-5'
      }), ' 儲存'))), isEdit && equipModal.show && h(ProjectEquipModal, {
        initialEquip: equipModal.initialEquip,
        editingId: equipModal.editingId,
        deviceCategories: deviceCategories,
        showToast: showToast,
        onClose: function () {
          equipModal = { show: false, editingId: null, initialEquip: null };
          rerender();
        },
        onSave: handleEquipSaved
      }), isEdit && showAddContractor && h('div', {
        className: 'app-modal-overlay'
      }, h('div', {
        className: 'bg-white rounded-lg shadow-xl p-6 w-80 max-w-full m-4'
      }, h('h3', {
        className: 'text-lg font-bold text-gray-800 mb-4'
      }, '新增施作單位'), h('input', {
        type: 'text',
        value: newContractor,
        onChange: function (e) { newContractor = e.target.value; rerender(); },
        placeholder: '輸入新的單位名稱',
        className: 'w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500 mb-6',
        autoFocus: true
      }), h('div', {
        className: 'flex justify-end space-x-3'
      }, h('button', {
        type: 'button',
        onClick: function () {
          showAddContractor = false;
          newContractor = '';
          rerender();
        },
        className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50'
      }, '取消'), h('button', {
        type: 'button',
        onClick: handleAddContractor,
        className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
      }, '確定新增')))));
    });
  }

  window.AddProjectForm = AddProjectForm;
  window.EditProjectForm = EditProjectForm;
  window.ProjectEquipModal = ProjectEquipModal;
})();
