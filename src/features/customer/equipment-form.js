/*
 * features/customer/equipment-form.js — 客戶建檔（設備管理）：設備新增/編輯表單
 * props: { equipments, setEquipments, targetCase?, equipmentCustomer, equipmentStore, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  function EquipmentForm(props) {
    var equipments = props.equipments;
    var setEquipments = props.setEquipments;
    var targetCase = props.targetCase;
    var equipmentCustomer = props.equipmentCustomer;
    var equipmentStore = props.equipmentStore;
    var setView = props.setView;
    var showToast = props.showToast;

    var isEdit = !!targetCase;
    var customerName = isEdit ? targetCase.customerName : equipmentCustomer;
    var storeName = isEdit ? targetCase.storeName : equipmentStore;

    var formData = {
      model: (targetCase && targetCase.model) || '',
      category: (targetCase && targetCase.category) || '',
      brand: (targetCase && targetCase.brand) || '',
      name: (targetCase && targetCase.name) || '',
      area: (targetCase && targetCase.area) || '',
      manufactureDate: (targetCase && targetCase.manufactureDate) || '',
      installDate: (targetCase && targetCase.installDate) || '',
      assetNumber: (targetCase && targetCase.assetNumber) || '',
      serialNumber: (targetCase && targetCase.serialNumber) || '',
      horsepower: (targetCase && targetCase.horsepower) || '',
      indoorOutdoor: (targetCase && targetCase.indoorOutdoor) || EQUIP_INDOOR_OUTDOOR_OPTIONS[0],
      voltage: (targetCase && targetCase.voltage) || EQUIP_VOLTAGE_OPTIONS[1]
    };

    var inputCls = 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500';
    var disabledCls = 'w-full p-2.5 border rounded-md bg-gray-100 text-gray-600';

    function applyModelCatalog(model) {
      var catalog = EQUIP_MODEL_CATALOG[model];
      if (!catalog) return;
      formData.category = catalog.category;
      formData.brand = catalog.brand;
      formData.horsepower = catalog.horsepower;
      formData.indoorOutdoor = catalog.indoorOutdoor;
      formData.voltage = catalog.voltage;
    }

    return stateful(function (rerender) {
      function handleChange(e) {
        var name = e.target.name;
        var value = e.target.value;
        formData[name] = value;
        if (name === 'model') applyModelCatalog(value);
        rerender();
      }

      function handleSubmit(e) {
        e.preventDefault();
        if (!formData.name.trim()) {
          showToast('設備名稱為必填', 'error');
          return;
        }
        if (!customerName || !storeName) {
          showToast('缺少客戶或門市資訊', 'error');
          return;
        }
        var payload = Object.assign({}, formData, {
          customerName: customerName,
          storeName: storeName
        });
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
            value: formData[name],
            onChange: handleChange,
            required: opts.required,
            className: inputCls
          })
        );
      }

      function selectField(label, name, options, opts) {
        opts = opts || {};
        return h('div', null,
          h('label', { className: 'block text-sm mb-1' }, label,
            opts.required && h('span', { className: 'text-red-500' }, ' *'),
            opts.hint && h('span', { className: 'text-xs text-gray-400' }, ' ' + opts.hint)),
          h('select', {
            name: name,
            value: formData[name],
            onChange: handleChange,
            className: inputCls + ' bg-white'
          },
            opts.emptyOption && h('option', { value: '' }, opts.emptyOption),
            options.map(function (opt) {
              return h('option', { key: opt, value: opt }, opt);
            })
          )
        );
      }

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
              selectField('型號', 'model', EQUIP_MODEL_OPTIONS, {
                emptyOption: '請選擇型號',
                hint: '(選擇後自動帶入)'
              }),
              selectField('設備分類', 'category', EQUIP_CATEGORY_OPTIONS, { emptyOption: '請選擇' }),
              selectField('品牌', 'brand', EQUIP_BRAND_OPTIONS, { emptyOption: '請選擇' }),
              field('設備名稱', 'name', { required: true }),
              field('設備區域', 'area'),
              field('出廠日期', 'manufactureDate', { type: 'date' }),
              field('安裝日期', 'installDate', { type: 'date' }),
              field('資產編號', 'assetNumber'),
              field('流水序號', 'serialNumber'),
              field('匹數', 'horsepower'),
              selectField('室內外機', 'indoorOutdoor', EQUIP_INDOOR_OUTDOOR_OPTIONS),
              selectField('電壓', 'voltage', EQUIP_VOLTAGE_OPTIONS)
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
              }, Icons.Save({ className: 'h-4 w-4' }), isEdit ? ' 儲存更新' : ' 儲存新增')
            )
          )
        )
      );
    });
  }

  window.EquipmentForm = EquipmentForm;
})();
