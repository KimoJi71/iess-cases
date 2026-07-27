/*
 * features/permissions/district-tree-picker.js — 縣市行政區樹狀多選（共用）
 * props: {
 *   selectedDistricts, onChange,
 *   expandedCities, onExpandedCitiesChange,
 *   disabledDistricts?  // 不可勾選的行政區（合併字串）
 * }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons;

  function DistrictTreePicker(props) {
    var districts = props.selectedDistricts || [];
    var onChange = props.onChange;
    var expandedCities = props.expandedCities || [];
    var onExpandedCitiesChange = props.onExpandedCitiesChange;
    var disabledDistricts = props.disabledDistricts || [];

    function isDisabled(area) {
      return disabledDistricts.indexOf(area) !== -1;
    }

    function getCityAreas(city) {
      return TAIWAN_CITY_DISTRICTS[city].map(function (district) {
        return city + district;
      });
    }

    function getEnabledCityAreas(city) {
      return getCityAreas(city).filter(function (area) {
        return !isDisabled(area);
      });
    }

    function setDistricts(next) {
      onChange(next.slice());
    }

    function toggleDistrict(area) {
      if (isDisabled(area)) return;
      var next = districts.slice();
      var idx = next.indexOf(area);
      if (idx === -1) next.push(area);
      else next.splice(idx, 1);
      setDistricts(next);
    }

    function getCityCheckState(city) {
      var areas = getEnabledCityAreas(city);
      if (!areas.length) return 'none';
      var checkedCount = areas.filter(function (area) {
        return districts.indexOf(area) !== -1;
      }).length;
      if (checkedCount === 0) return 'none';
      if (checkedCount === areas.length) return 'all';
      return 'some';
    }

    function toggleCity(city) {
      var areas = getEnabledCityAreas(city);
      var next = districts.slice();
      if (getCityCheckState(city) === 'all') {
        areas.forEach(function (area) {
          var idx = next.indexOf(area);
          if (idx !== -1) next.splice(idx, 1);
        });
      } else {
        areas.forEach(function (area) {
          if (next.indexOf(area) === -1) next.push(area);
        });
      }
      setDistricts(next);
    }

    function toggleCityExpanded(city) {
      var next = expandedCities.slice();
      var idx = next.indexOf(city);
      if (idx === -1) next.push(city);
      else next.splice(idx, 1);
      onExpandedCitiesChange(next);
    }

    function renderCityCheckbox(state, onToggle) {
      return h('input', {
        type: 'checkbox',
        checked: state === 'all',
        ref: function (el) {
          if (el) el.indeterminate = state === 'some';
        },
        onChange: onToggle,
        className: 'h-4 w-4'
      });
    }

    return h('div', {
      className: 'border rounded-md max-h-96 overflow-y-auto divide-y divide-gray-100'
    },
      TAIWAN_CITY_OPTIONS.map(function (city) {
        var isExpanded = expandedCities.indexOf(city) !== -1;
        var cityState = getCityCheckState(city);
        var allAreas = getCityAreas(city);
        var selectedInCity = allAreas.filter(function (area) {
          return districts.indexOf(area) !== -1;
        }).length;
        return h('div', { key: city },
          h('div', {
            className: 'flex items-center gap-2 px-3 py-2.5 bg-gray-50 hover:bg-gray-100'
          },
            h('button', {
              type: 'button',
              onClick: function () { toggleCityExpanded(city); },
              className: 'p-0.5 text-gray-500 hover:text-gray-700 rounded',
              'aria-expanded': isExpanded ? 'true' : 'false',
              'aria-label': isExpanded ? '收合' : '展開',
              'data-no-tooltip': true
            },
              Icons.ChevronDown({
                className: 'h-4 w-4 transition-transform ' + (isExpanded ? '' : '-rotate-90')
              })
            ),
            renderCityCheckbox(cityState, function () { toggleCity(city); }),
            h('button', {
              type: 'button',
              onClick: function () { toggleCityExpanded(city); },
              className: 'font-semibold text-gray-800 text-sm hover:text-blue-700'
            }, city),
            cityState !== 'none' && h('span', {
              className: 'text-xs text-blue-600 ml-auto'
            }, selectedInCity + ' / ' + allAreas.length)
          ),
          isExpanded && h('div', {
            className: 'py-2 pl-10 pr-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1'
          },
            TAIWAN_CITY_DISTRICTS[city].map(function (district) {
              var area = city + district;
              var checked = districts.indexOf(area) !== -1;
              var disabled = isDisabled(area);
              return h('label', {
                key: area,
                className: 'inline-flex items-center gap-2 px-2 py-1.5 rounded text-sm ' +
                  (disabled
                    ? 'text-gray-400 cursor-not-allowed'
                    : (checked ? 'text-blue-700 bg-blue-50/50 cursor-pointer' : 'text-gray-600 hover:bg-gray-50 cursor-pointer'))
              },
                h('input', {
                  type: 'checkbox',
                  checked: checked,
                  disabled: disabled,
                  onChange: function () { toggleDistrict(area); },
                  className: 'h-4 w-4'
                }),
                district
              );
            })
          )
        );
      })
    );
  }

  window.DistrictTreePicker = DistrictTreePicker;
})();
