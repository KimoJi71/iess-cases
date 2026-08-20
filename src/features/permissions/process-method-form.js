/*
 * features/permissions/process-method-form.js — 處理方式與積分管理：新增/編輯表單
 * props: { processMethods, setProcessMethods, setView, showToast, targetCase }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  var FIELDS = [
    { name: 'category1', label: '大類', required: true, type: 'text' },
    { name: 'category2', label: '中類', required: true, type: 'text' },
    { name: 'category3', label: '小類', required: true, type: 'text' },
    { name: 'specification', label: '規格', required: true, type: 'text' },
    { name: 'unit', label: '單位', required: true, type: 'text' },
    { name: 'brand', label: '品牌', required: false, type: 'text' },
    { name: 'productCode', label: '產品編號', required: false, type: 'text' },
    { name: 'model', label: '型號', required: false, type: 'text' },
    { name: 'points', label: '積分數', required: true, type: 'number' }
  ];

  function ProcessMethodForm(props) {
    var processMethods = props.processMethods;
    var setProcessMethods = props.setProcessMethods;
    var targetCase = props.targetCase;
    var setView = props.setView;
    var showToast = props.showToast;
    var isEdit = !!targetCase;

    var formData = {};
    FIELDS.forEach(function (field) {
      var val = targetCase && targetCase[field.name];
      formData[field.name] = val != null ? val : (field.type === 'number' ? '' : '');
    });

    return stateful(function (rerender) {
      function handleChange(e) {
        formData[e.target.name] = e.target.value;
        rerender();
      }

      function handleSubmit(e) {
        e.preventDefault();
        var normalized = ProcessMethodUtils.normalizeRecord(formData);
        var missing = FIELDS.find(function (field) {
          if (!field.required) return false;
          if (field.name === 'points') return !normalized.points && normalized.points !== 0;
          return !normalized[field.name];
        });
        if (missing) {
          showToast(missing.label + '為必填', 'error');
          return;
        }
        if (normalized.points < 0) {
          showToast('積分數不可為負數', 'error');
          return;
        }
        if (ProcessMethodUtils.findDuplicate(
          processMethods, normalized, isEdit ? targetCase.id : null
        )) {
          showToast('此六項欄位組合已存在，請修改後再儲存', 'error');
          return;
        }

        if (isEdit) {
          setProcessMethods(processMethods.map(function (pm) {
            return pm.id === targetCase.id ? Object.assign({}, pm, normalized) : pm;
          }));
          showToast('處理方式與積分更新成功');
        } else {
          var newRecord = Object.assign({
            id: 'PM' + Date.now(),
            createdDate: todayDate
          }, normalized);
          setProcessMethods([newRecord].concat(processMethods));
          showToast('處理方式與積分新增成功');
        }
        setView('process-method-list');
      }

      return h('div', {
        className: 'max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative'
      },
        PageHeader({
          title: isEdit ? '編輯處理方式與積分' : '新增處理方式與積分',
          badge: isEdit ? ProcessMethodUtils.formatRecordLabel(targetCase) : null,
          onClose: function () { setView('process-method-list'); },
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
                  type: field.type,
                  name: field.name,
                  value: formData[field.name],
                  min: field.type === 'number' ? '0' : undefined,
                  step: field.type === 'number' ? '0.1' : undefined,
                  onChange: handleChange,
                  className: 'w-full p-2.5 border rounded-md outline-none'
                })
              );
            })
          ),
          h('p', { className: 'text-xs text-gray-500 mt-4' },
            '各欄位可重複，但六項欄位組合必須唯一。'),
          h('div', { className: 'flex justify-end gap-3 mt-8 pt-6 border-t' },
            h('button', {
              type: 'button',
              onClick: function () { setView('process-method-list'); },
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

  window.ProcessMethodForm = ProcessMethodForm;
})();
