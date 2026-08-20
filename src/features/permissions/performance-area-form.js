/*
 * features/permissions/performance-area-form.js — 績效區域管理：新增/編輯表單
 * props: { performanceAreas, setPerformanceAreas, setView, showToast, targetCase }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  function PerformanceAreaForm(props) {
    var performanceAreas = props.performanceAreas;
    var setPerformanceAreas = props.setPerformanceAreas;
    var targetCase = props.targetCase;
    var setView = props.setView;
    var showToast = props.showToast;
    var isEdit = !!targetCase;

    var formData = {
      name: (targetCase && targetCase.name) || ''
    };
    var districts = (targetCase && targetCase.districts)
      ? targetCase.districts.slice()
      : [];
    var expandedCities = TAIWAN_CITY_OPTIONS.filter(function (city) {
      return TAIWAN_CITY_DISTRICTS[city].some(function (district) {
        return districts.indexOf(city + district) !== -1;
      });
    });

    return stateful(function (rerender) {
      var excludeId = isEdit ? targetCase.id : null;
      var occupiedDistricts = PerformanceAreaUtils.getOccupiedDistricts(
        performanceAreas, excludeId
      );

      function handleChange(e) {
        formData[e.target.name] = e.target.value;
        rerender();
      }

      function handleSubmit(e) {
        e.preventDefault();
        var name = formData.name.trim();
        if (!name) {
          showToast('區域名稱為必填', 'error');
          return;
        }
        if (PerformanceAreaUtils.findDuplicateName(performanceAreas, name, excludeId)) {
          showToast('區域名稱已存在', 'error');
          return;
        }
        if (!districts.length) {
          showToast('請至少選擇一個縣市行政區', 'error');
          return;
        }
        var conflicts = PerformanceAreaUtils.findConflictingDistricts(
          performanceAreas, districts, excludeId
        );
        if (conflicts.length) {
          showToast('以下行政區已被其他績效區域使用：' + conflicts.join('、'), 'error');
          return;
        }

        if (isEdit) {
          setPerformanceAreas(performanceAreas.map(function (area) {
            if (area.id !== targetCase.id) return area;
            return Object.assign({}, area, {
              name: name,
              districts: districts.slice()
            });
          }));
          showToast('績效區域更新成功');
        } else {
          var newRecord = {
            id: 'PA' + Date.now(),
            name: name,
            districts: districts.slice(),
            createdDate: todayDate
          };
          setPerformanceAreas([newRecord].concat(performanceAreas));
          showToast('績效區域新增成功');
        }
        setView('performance-area-list');
      }

      return h('div', {
        className: 'max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative'
      },
        PageHeader({
          title: isEdit ? '編輯績效區域' : '新增績效區域',
          badge: isEdit ? targetCase.name : null,
          onClose: function () { setView('performance-area-list'); },
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
        }),
        h('form', { onSubmit: handleSubmit, className: 'p-6' },
          h('div', { className: 'space-y-6' },
            h('div', null,
              h('label', { className: 'block text-sm mb-1' },
                '區域名稱 ', h('span', { className: 'text-red-500' }, '*')),
              h('input', {
                type: 'text',
                name: 'name',
                value: formData.name,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none'
              })
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-2' },
                '縣市行政區清單 ', h('span', { className: 'text-red-500' }, '*')),
              h('p', { className: 'text-xs text-gray-400 mb-3' },
                '依縣市展開選擇行政區；已被其他績效區域使用的行政區不可勾選'),
              h(DistrictTreePicker, {
                selectedDistricts: districts,
                onChange: function (next) { districts = next; rerender(); },
                expandedCities: expandedCities,
                onExpandedCitiesChange: function (next) { expandedCities = next; rerender(); },
                disabledDistricts: occupiedDistricts
              })
            )
          ),
          h('div', { className: 'flex justify-end gap-3 mt-8 pt-6 border-t' },
            h('button', {
              type: 'button',
              onClick: function () { setView('performance-area-list'); },
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

  window.PerformanceAreaForm = PerformanceAreaForm;
})();
