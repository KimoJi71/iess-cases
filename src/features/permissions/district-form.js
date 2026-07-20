/*
 * features/permissions/district-form.js — 行政區域管理：新增/編輯表單
 * props: { districts, setDistricts, assignees, setAssignees, stores, setStores, setView, showToast, targetCase }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  function DistrictForm(props) {
    var districts = props.districts;
    var setDistricts = props.setDistricts;
    var assignees = props.assignees;
    var setAssignees = props.setAssignees;
    var stores = props.stores;
    var setStores = props.setStores;
    var targetCase = props.targetCase;
    var setView = props.setView;
    var showToast = props.showToast;
    var isEdit = !!targetCase;

    var formData = {
      name: (targetCase && targetCase.name) || ''
    };

    return stateful(function (rerender) {
      function handleChange(e) {
        formData[e.target.name] = e.target.value;
        rerender();
      }

      function handleSubmit(e) {
        e.preventDefault();
        var name = formData.name.trim();
        if (!name) {
          showToast('行政區域名稱為必填', 'error');
          return;
        }
        if (DistrictUtils.findDuplicateName(districts, name, isEdit ? targetCase.id : null)) {
          showToast('行政區域名稱已存在', 'error');
          return;
        }

        if (isEdit) {
          var oldName = targetCase.name;
          setDistricts(districts.map(function (d) {
            return d.id === targetCase.id ? Object.assign({}, d, { name: name }) : d;
          }));
          if (oldName !== name) {
            var updated = DistrictUtils.updateDistrictReferences(oldName, name, assignees, stores);
            setAssignees(updated.assignees);
            setStores(updated.stores);
          }
          showToast('行政區域更新成功');
        } else {
          var newDistrict = {
            id: 'DIST' + Date.now(),
            name: name,
            createdDate: todayDate
          };
          setDistricts([newDistrict].concat(districts));
          showToast('行政區域新增成功');
        }
        setView('district-list');
      }

      return h('div', {
        className: 'max-w-xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative'
      },
        PageHeader({
          title: isEdit ? '編輯行政區域' : '新增行政區域',
          badge: isEdit ? targetCase.name : null,
          onClose: function () { setView('district-list'); },
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
        }),
        h('form', { onSubmit: handleSubmit, className: 'p-6' },
          h('div', null,
            h('label', { className: 'block text-sm mb-1' }, '行政區域名稱 ', h('span', { className: 'text-red-500' }, '*')),
            h('input', {
              type: 'text',
              name: 'name',
              value: formData.name,
              onChange: handleChange,
              className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
            })
          ),
          h('div', { className: 'flex justify-end gap-3 mt-8 pt-6 border-t' },
            h('button', {
              type: 'button',
              onClick: function () { setView('district-list'); },
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

  window.DistrictForm = DistrictForm;
})();
