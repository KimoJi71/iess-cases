/*
 * features/customer/equipment-form.js — 客戶建檔（設備管理）：設備新增/編輯表單
 * props: { equipments, setEquipments, deviceCategories, targetCase?, equipmentCustomer, equipmentStore, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  function renderEquipSelect(label, name, options, formData, onChange, opts) {
    opts = opts || {};
    var disabled = !!opts.disabled;
    if (name === 'category') {
      disabled = disabled || options.length === 0;
    } else if (opts.waitFor) {
      disabled = disabled || !formData[opts.waitFor] || options.length === 0;
    } else {
      disabled = disabled || options.length === 0;
    }
    return h('div', { className: opts.wrap || null },
      h('label', { className: 'block text-sm mb-1' },
        label,
        opts.required && h('span', { className: 'text-red-500' }, ' *')),
      h('select', {
        name: name,
        value: formData[name] || '',
        onChange: onChange,
        disabled: disabled,
        className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white' +
          (disabled ? ' bg-gray-100 text-gray-400 cursor-not-allowed' : '')
      },
        h('option', { value: '', disabled: true }, disabled ? (opts.emptyHint || '請先選擇上層欄位') : '請選擇'),
        options.map(function (opt) {
          return h('option', { key: opt, value: opt }, opt);
        })
      )
    );
  }

  function EquipmentForm(props) {
    var equipments = props.equipments;
    var setEquipments = props.setEquipments;
    var deviceCategories = props.deviceCategories || [];
    var targetCase = props.targetCase;
    var equipmentCustomer = props.equipmentCustomer;
    var equipmentStore = props.equipmentStore;
    var setView = props.setView;
    var showToast = props.showToast;

    var isEdit = !!targetCase;
    var customerName = isEdit ? targetCase.customerName : equipmentCustomer;
    var storeName = isEdit ? targetCase.storeName : equipmentStore;

    var formData = isEdit
      ? DeviceCategoryUtils.resolveProjectEquip(targetCase, deviceCategories)
      : DeviceCategoryUtils.defaultEquipRecord();

    var inputCls = 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500';
    var disabledCls = 'w-full p-2.5 border rounded-md bg-gray-100 text-gray-600';

    return stateful(function (rerender) {
      function handleChange(e) {
        var name = e.target.name;
        var value = e.target.value;
        if (['category', 'brand', 'deviceName', 'specification', 'model'].indexOf(name) >= 0) {
          formData = DeviceCategoryUtils.applyEquipFieldChange(formData, name, value);
        } else {
          formData[name] = value;
        }
        rerender();
      }

      function handleSubmit(e) {
        e.preventDefault();
        if (!formData.category) {
          showToast('設備分類為必填', 'error');
          return;
        }
        if (!formData.model) {
          showToast('型號為必填', 'error');
          return;
        }
        if (!customerName || !storeName) {
          showToast('缺少客戶或門市資訊', 'error');
          return;
        }
        var payload = {
          category: formData.category,
          brand: formData.brand,
          deviceName: formData.deviceName,
          name: formData.deviceName,
          specification: formData.specification,
          model: formData.model,
          area: formData.area,
          manufactureDate: formData.manufactureDate,
          installDate: formData.installDate,
          assetNumber: formData.assetNumber,
          serialNumber: formData.serialNumber,
          status: formData.status,
          customerName: customerName,
          storeName: storeName
        };
        if (isEdit) {
          setEquipments(equipments.map(function (eq) {
            return eq.id === targetCase.id ? Object.assign({}, eq, payload) : eq;
          }));
          showToast('設備資料更新成功');
        } else {
          var newEq = Object.assign({ id: 'E' + Date.now() }, payload, {
            createdDate: todayDate
          });
          setEquipments([newEq].concat(equipments));
          showToast('設備新增成功');
        }
        setView('equipment-list');
      }

      function field(label, name, opts) {
        opts = opts || {};
        return h('div', { className: opts.wrap || null },
          h('label', { className: 'block text-sm mb-1' }, label,
            opts.required && h('span', { className: 'text-red-500' }, ' *')),
          h('input', {
            type: opts.type || 'text',
            name: name,
            value: formData[name] || '',
            onChange: handleChange,
            required: opts.required,
            placeholder: opts.placeholder,
            className: inputCls
          })
        );
      }

      var fieldOptions = DeviceCategoryUtils.getEquipFieldOptions(deviceCategories, formData);

      return h('div', { className: 'max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100' },
        PageHeader({
          title: isEdit ? '編輯設備' : '新增設備',
          badge: (customerName || '') + ' / ' + (storeName || ''),
          onClose: function () { setView('equipment-list'); },
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
        }),
        h('form', { onSubmit: handleSubmit, className: 'p-6' },
          h('div', { className: 'space-y-6' },
            h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-6' },
              h('div', { className: 'col-span-full font-semibold text-lg text-blue-800 border-b pb-2 mb-2' }, '基本資料'),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '客戶名稱'),
                h('input', { type: 'text', value: customerName || '', disabled: true, className: disabledCls })
              ),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '門市名稱'),
                h('input', { type: 'text', value: storeName || '', disabled: true, className: disabledCls })
              ),
              renderEquipSelect('設備分類', 'category', fieldOptions.category, formData, handleChange, {
                required: true,
                emptyHint: '尚無設備分類資料'
              }),
              renderEquipSelect('品牌', 'brand', fieldOptions.brand, formData, handleChange, {
                waitFor: 'category',
                emptyHint: '請先選擇設備分類'
              }),
              renderEquipSelect('設備名稱', 'deviceName', fieldOptions.deviceName, formData, handleChange, {
                waitFor: 'brand',
                emptyHint: '請先選擇品牌'
              }),
              renderEquipSelect('設備規格', 'specification', fieldOptions.specification, formData, handleChange, {
                waitFor: 'deviceName',
                emptyHint: '請先選擇設備名稱'
              }),
              renderEquipSelect('型號', 'model', fieldOptions.model, formData, handleChange, {
                required: true,
                waitFor: 'specification',
                emptyHint: '請先選擇設備規格'
              }),
              field('設備區域', 'area', { placeholder: '例如：天花板上方' }),
              field('出廠日期', 'manufactureDate', { type: 'date' }),
              field('安裝日期', 'installDate', { type: 'date' }),
              field('資產編號', 'assetNumber'),
              field('流水序號', 'serialNumber'),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '設備狀態 ',
                  h('span', { className: 'text-red-500' }, '*')),
                h('select', {
                  name: 'status',
                  value: formData.status || EQUIP_STATUS_OPTIONS[0],
                  onChange: handleChange,
                  className: inputCls + ' bg-white'
                },
                  EQUIP_STATUS_OPTIONS.map(function (opt) {
                    return h('option', { key: opt, value: opt }, opt);
                  })
                )
              )
            ),
            h('div', { className: 'flex justify-end gap-3 pt-4 border-t' },
              h('button', {
                type: 'button',
                onClick: function () { setView('equipment-list'); },
                className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
              }, '取消'),
              h('button', {
                type: 'submit',
                className: 'flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
              }, Icons.Save({ className: 'h-4 w-4' }), ' 儲存')
            )
          )
        )
      );
    });
  }

  window.EquipmentForm = EquipmentForm;
})();
