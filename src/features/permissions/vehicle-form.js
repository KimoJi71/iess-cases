/*
 * features/permissions/vehicle-form.js — 車輛管理：新增/編輯表單
 * props: { vehicles, setVehicles, accounts, setView, showToast, targetCase }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  function VehicleForm(props) {
    var vehicles = props.vehicles;
    var setVehicles = props.setVehicles;
    var accounts = props.accounts;
    var targetCase = props.targetCase;
    var setView = props.setView;
    var showToast = props.showToast;
    var isEdit = !!targetCase;

    var formData = {
      plateNo: (targetCase && targetCase.plateNo) || '',
      personInCharge: (targetCase && targetCase.personInCharge) || '',
      owner: (targetCase && targetCase.owner) || '',
      company: (targetCase && targetCase.company) || ''
    };

    return stateful(function (rerender) {
      var personOptions = VehicleUtils.getPersonInChargeOptions(
        accounts, formData.personInCharge
      );

      function handleChange(e) {
        formData[e.target.name] = e.target.value;
        rerender();
      }

      function handleSubmit(e) {
        e.preventDefault();
        var plateNo = VehicleUtils.normalizePlate(formData.plateNo);
        if (!plateNo) {
          showToast('車號為必填', 'error');
          return;
        }
        if (VehicleUtils.findDuplicatePlate(
          vehicles, plateNo, isEdit ? targetCase.id : null
        )) {
          showToast('車號已存在', 'error');
          return;
        }

        var payload = {
          plateNo: plateNo,
          personInCharge: String(formData.personInCharge || '').trim(),
          owner: String(formData.owner || '').trim(),
          company: String(formData.company || '').trim()
        };

        if (isEdit) {
          setVehicles(vehicles.map(function (v) {
            return v.id === targetCase.id ? Object.assign({}, v, payload) : v;
          }));
          showToast('車輛資料更新成功');
        } else {
          var newRecord = Object.assign({
            id: 'VEH' + Date.now(),
            createdDate: todayDate
          }, payload);
          setVehicles([newRecord].concat(vehicles));
          showToast('車輛新增成功');
        }
        setView('vehicle-list');
      }

      return h('div', {
        className: 'max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative'
      },
        PageHeader({
          title: isEdit ? '編輯車輛' : '新增車輛',
          badge: isEdit ? targetCase.plateNo : null,
          onClose: function () { setView('vehicle-list'); },
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
        }),
        h('form', { onSubmit: handleSubmit, className: 'p-6' },
          h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
            h('div', null,
              h('label', { className: 'block text-sm mb-1' },
                '車號 ', h('span', { className: 'text-red-500' }, '*')),
              h('input', {
                type: 'text',
                name: 'plateNo',
                value: formData.plateNo,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '負責人'),
              h('select', {
                name: 'personInCharge',
                value: formData.personInCharge,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white'
              },
                h('option', { value: '' }, '請選擇'),
                personOptions.map(function (name) {
                  return h('option', { key: name, value: name }, name);
                })
              )
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '車輛所有人'),
              h('input', {
                type: 'text',
                name: 'owner',
                value: formData.owner,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '公司'),
              h('input', {
                type: 'text',
                name: 'company',
                value: formData.company,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            )
          ),
          h('div', { className: 'flex justify-end gap-3 mt-8 pt-6 border-t' },
            h('button', {
              type: 'button',
              onClick: function () { setView('vehicle-list'); },
              className: 'px-5 py-2.5 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
            }, '取消'),
            h('button', {
              type: 'submit',
              className: 'flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
            }, Icons.Save({ className: 'h-4 w-4' }), ' 儲存')
          )
        )
      );
    });
  }

  window.VehicleForm = VehicleForm;
})();
