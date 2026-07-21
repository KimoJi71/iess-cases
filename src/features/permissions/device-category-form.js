/*
 * features/permissions/device-category-form.js — 設備分類管理：新增/編輯表單
 * props: { deviceCategories, setDeviceCategories, setView, showToast, targetCase }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  var FIELDS = [
    { name: 'category', label: '設備分類', required: true },
    { name: 'brand', label: '品牌', required: true },
    { name: 'deviceName', label: '設備名稱', required: true },
    { name: 'specification', label: '設備規格', required: true },
    { name: 'model', label: '型號', required: true },
    { name: 'refrigerant', label: '冷媒', required: false },
    { name: 'powerSource', label: '電源', required: false }
  ];

  function DeviceCategoryForm(props) {
    var deviceCategories = props.deviceCategories;
    var setDeviceCategories = props.setDeviceCategories;
    var targetCase = props.targetCase;
    var setView = props.setView;
    var showToast = props.showToast;
    var isEdit = !!targetCase;

    var formData = {};
    FIELDS.forEach(function (field) {
      formData[field.name] = (targetCase && targetCase[field.name]) || '';
    });

    return stateful(function (rerender) {
      function handleChange(e) {
        formData[e.target.name] = e.target.value;
        rerender();
      }

      function handleSubmit(e) {
        e.preventDefault();
        var normalized = DeviceCategoryUtils.normalizeRecord(formData);
        var missing = FIELDS.find(function (field) {
          return field.required && !normalized[field.name];
        });
        if (missing) {
          showToast(missing.label + '為必填', 'error');
          return;
        }
        if (DeviceCategoryUtils.findDuplicate(
          deviceCategories, normalized, isEdit ? targetCase.id : null
        )) {
          showToast('此七項欄位組合已存在，請修改後再儲存', 'error');
          return;
        }

        if (isEdit) {
          setDeviceCategories(deviceCategories.map(function (dc) {
            return dc.id === targetCase.id ? Object.assign({}, dc, normalized) : dc;
          }));
          showToast('設備分類更新成功');
        } else {
          var newRecord = Object.assign({
            id: 'DCAT' + Date.now(),
            createdDate: todayDate
          }, normalized);
          setDeviceCategories([newRecord].concat(deviceCategories));
          showToast('設備分類新增成功');
        }
        setView('device-category-list');
      }

      return h('div', {
        className: 'max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative'
      },
        PageHeader({
          title: isEdit ? '編輯設備分類' : '新增設備分類',
          badge: isEdit ? DeviceCategoryUtils.formatRecordLabel(targetCase) : null,
          onClose: function () { setView('device-category-list'); },
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
        }),
        h('form', { onSubmit: handleSubmit, className: 'p-6' },
          h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
            FIELDS.map(function (field) {
              return h('div', { key: field.name },
                h('label', { className: 'block text-sm mb-1' },
                  field.label,
                  field.required && ' ',
                  field.required && h('span', { className: 'text-red-500' }, '*')),
                h('input', {
                  type: 'text',
                  name: field.name,
                  value: formData[field.name],
                  onChange: handleChange,
                  className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
                })
              );
            })
          ),
          h('p', { className: 'text-xs text-gray-500 mt-4' },
            '備註：各欄位可重複，但七項欄位組合在系統中必須唯一。'),
          h('div', { className: 'flex justify-end gap-3 mt-8 pt-6 border-t' },
            h('button', {
              type: 'button',
              onClick: function () { setView('device-category-list'); },
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

  window.DeviceCategoryForm = DeviceCategoryForm;
})();
