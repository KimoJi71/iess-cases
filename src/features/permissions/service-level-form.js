/*
 * features/permissions/service-level-form.js — 服務等級管理：新增/編輯表單
 * props: { serviceLevels, setServiceLevels, customers, setCustomers, stores, setStores,
 *          cases, setCases, maintenanceCases, setMaintenanceCases,
 *          projectCases, setProjectCases, surveyCases, setSurveyCases,
 *          personnelStatus, setPersonnelStatus,
 *          targetCase, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  function ServiceLevelForm(props) {
    var serviceLevels = props.serviceLevels || [];
    var setServiceLevels = props.setServiceLevels;
    var targetCase = props.targetCase;
    var setView = props.setView;
    var showToast = props.showToast;
    var isEdit = !!targetCase;
    var originalName = isEdit ? String(targetCase.name || '').trim() : '';

    var formData = {
      name: (targetCase && targetCase.name) || '',
      maintenanceCount: targetCase ? String(Number(targetCase.maintenanceCount) || 0) : '0',
      countsBonusPoints: !!(targetCase && targetCase.countsBonusPoints)
    };
    function buildRecord() {
      return {
        name: formData.name,
        maintenanceCount: formData.maintenanceCount === '' ? '' : Number(formData.maintenanceCount),
        countsBonusPoints: formData.countsBonusPoints
      };
    }

    function syncRenamedCollections(newName) {
      var result = ServiceLevelUtils.renameServiceLevel(originalName, newName, {
        customers: props.customers,
        stores: props.stores,
        cases: props.cases,
        maintenanceCases: props.maintenanceCases,
        projectCases: props.projectCases,
        surveyCases: props.surveyCases,
        personnelStatus: props.personnelStatus
      });
      props.setCustomers(result.customers);
      props.setStores(result.stores);
      props.setCases(result.cases);
      props.setMaintenanceCases(result.maintenanceCases);
      props.setProjectCases(result.projectCases);
      props.setSurveyCases(result.surveyCases);
      props.setPersonnelStatus(result.personnelStatus);
      return result.changedCount;
    }

    return stateful(function (rerender) {
      function handleNameChange(e) { formData.name = e.target.value; rerender(); }

      function handleCountChange(e) {
        formData.maintenanceCount = e.target.value;
        rerender();
      }

      function handleBonusChange(e) {
        formData.countsBonusPoints = e.target.value === '是';
        rerender();
      }

      function handleSubmit(e) {
        e.preventDefault();
        var record = buildRecord();
        var errors = ServiceLevelUtils.validate(
          record, serviceLevels, isEdit ? targetCase.id : null
        );
        if (errors.length) {
          showToast(errors[0], 'error');
          return;
        }

        var normalized = ServiceLevelUtils.normalizeRecord(record);

        if (isEdit) {
          setServiceLevels(serviceLevels.map(function (sl) {
            return sl.id === targetCase.id ? Object.assign({}, sl, normalized) : sl;
          }));
          if (normalized.name !== originalName) {
            var changed = syncRenamedCollections(normalized.name);
            showToast('服務等級更新成功，已同步 ' + changed + ' 筆既有資料');
          } else {
            showToast('服務等級更新成功');
          }
        } else {
          var newRecord = Object.assign({
            id: 'SL' + Date.now(),
            createdDate: todayDate
          }, normalized);
          setServiceLevels([newRecord].concat(serviceLevels));
          showToast('服務等級新增成功');
        }
        setView('service-level-list');
      }

      return h('div', {
        className: 'max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative'
      },
        PageHeader({
          title: isEdit ? '編輯服務等級' : '新增服務等級',
          badge: isEdit ? originalName : null,
          onClose: function () { setView('service-level-list'); },
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
        }),
        h('form', { onSubmit: handleSubmit, className: 'p-6' },
          h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
            h('div', null,
              h('label', { className: 'block text-sm mb-1' },
                '服務等級名稱 ', h('span', { className: 'text-red-500' }, '*')),
              h('input', {
                type: 'text',
                name: 'name',
                value: formData.name,
                onChange: handleNameChange,
                className: 'w-full p-2.5 border rounded-md outline-none'
              })
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '每年保養次數'),
              h('input', {
                type: 'number',
                min: '0',
                name: 'maintenanceCount',
                value: formData.maintenanceCount,
                onChange: handleCountChange,
                className: 'w-full p-2.5 border rounded-md outline-none'
              }),
              h('p', { className: 'text-xs text-gray-500 mt-1' },
                Number(formData.maintenanceCount) > 0
                  ? '各次的月份區間由各客戶在「客戶管理」自行設定'
                  : '此服務等級不納入保養分配')
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '是否計算增額積分'),
              h('select', {
                name: 'countsBonusPoints',
                value: formData.countsBonusPoints ? '是' : '否',
                onChange: handleBonusChange,
                className: 'w-full p-2.5 border rounded-md outline-none bg-white'
              },
                h('option', { value: '否' }, '否'),
                h('option', { value: '是' }, '是')
              )
            )
          ),
          h('div', { className: 'flex justify-end gap-3 mt-8 pt-6 border-t' },
            h('button', {
              type: 'button',
              onClick: function () { setView('service-level-list'); },
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

  window.ServiceLevelForm = ServiceLevelForm;
})();
