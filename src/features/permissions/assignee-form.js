/*
 * features/permissions/assignee-form.js — 指派人員管理：新增/編輯表單
 * props: { assignees, setAssignees, accounts, cases, setCases,
 *          maintenanceCases, setMaintenanceCases, projectCases, setProjectCases,
 *          setView, showToast, targetCase }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  function AssigneeForm(props) {
    var assignees = props.assignees;
    var setAssignees = props.setAssignees;
    var accounts = props.accounts;
    var cases = props.cases;
    var setCases = props.setCases;
    var maintenanceCases = props.maintenanceCases;
    var setMaintenanceCases = props.setMaintenanceCases;
    var projectCases = props.projectCases;
    var setProjectCases = props.setProjectCases;
    var targetCase = props.targetCase;
    var setView = props.setView;
    var showToast = props.showToast;
    var isEdit = !!targetCase;

    var formData = {
      name: (targetCase && targetCase.name) || '',
      leaderId: (targetCase && targetCase.leaderId) || ''
    };
    var districts = (targetCase && targetCase.districts)
      ? targetCase.districts.slice()
      : [];
    var expandedCities = TAIWAN_CITY_OPTIONS.filter(function (city) {
      return TAIWAN_CITY_DISTRICTS[city].some(function (district) {
        return districts.indexOf(city + district) !== -1;
      });
    });
    var memberIds = isEdit
      ? AssigneeUtils.getMemberIds(targetCase)
      : [];

    return stateful(function (rerender) {
      function handleChange(e) {
        formData[e.target.name] = e.target.value;
        rerender();
      }

      function toggleDistrict(district) {
        var idx = districts.indexOf(district);
        if (idx === -1) districts.push(district);
        else districts.splice(idx, 1);
        rerender();
      }

      function getCityAreas(city) {
        return TAIWAN_CITY_DISTRICTS[city].map(function (district) {
          return city + district;
        });
      }

      function getCityCheckState(city) {
        var areas = getCityAreas(city);
        var checkedCount = areas.filter(function (area) {
          return districts.indexOf(area) !== -1;
        }).length;
        if (checkedCount === 0) return 'none';
        if (checkedCount === areas.length) return 'all';
        return 'some';
      }

      function toggleCity(city) {
        var areas = getCityAreas(city);
        if (getCityCheckState(city) === 'all') {
          areas.forEach(function (area) {
            var idx = districts.indexOf(area);
            if (idx !== -1) districts.splice(idx, 1);
          });
        } else {
          areas.forEach(function (area) {
            if (districts.indexOf(area) === -1) districts.push(area);
          });
        }
        rerender();
      }

      function toggleCityExpanded(city) {
        var idx = expandedCities.indexOf(city);
        if (idx === -1) expandedCities.push(city);
        else expandedCities.splice(idx, 1);
        rerender();
      }

      function renderCityCheckbox(state, onChange) {
        return h('input', {
          type: 'checkbox',
          checked: state === 'all',
          ref: function (el) {
            if (el) el.indeterminate = state === 'some';
          },
          onChange: onChange,
          className: 'h-4 w-4'
        });
      }

      function renderDistrictTree() {
        return h('div', {
          className: 'border rounded-md max-h-96 overflow-y-auto divide-y divide-gray-100'
        },
          TAIWAN_CITY_OPTIONS.map(function (city) {
            var isExpanded = expandedCities.indexOf(city) !== -1;
            var cityState = getCityCheckState(city);
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
                }, getCityAreas(city).filter(function (area) {
                  return districts.indexOf(area) !== -1;
                }).length + ' / ' + getCityAreas(city).length)
              ),
              isExpanded && h('div', {
                className: 'py-2 pl-10 pr-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1'
              },
                TAIWAN_CITY_DISTRICTS[city].map(function (district) {
                  var area = city + district;
                  var checked = districts.indexOf(area) !== -1;
                  return h('label', {
                    key: area,
                    className: 'inline-flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ' +
                      (checked ? 'text-blue-700 bg-blue-50/50' : 'text-gray-600 hover:bg-gray-50')
                  },
                    h('input', {
                      type: 'checkbox',
                      checked: checked,
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

      function toggleMember(accountId) {
        var idx = memberIds.indexOf(accountId);
        if (idx === -1) memberIds.push(accountId);
        else memberIds.splice(idx, 1);
        rerender();
      }

      function handleSubmit(e) {
        e.preventDefault();
        var name = formData.name.trim();
        if (!name) {
          showToast('指派人員名稱為必填', 'error');
          return;
        }
        if (AssigneeUtils.findDuplicateName(assignees, name, isEdit ? targetCase.id : null)) {
          showToast('指派人員名稱已存在', 'error');
          return;
        }

        if (isEdit) {
          var oldName = targetCase.name;
          var updatedAssignees = assignees.map(function (a) {
            if (a.id !== targetCase.id) return a;
            return Object.assign({}, a, {
              name: name,
              leaderId: formData.leaderId || '',
              districts: districts.slice(),
              memberIds: memberIds.slice()
            });
          });
          setAssignees(AssigneeUtils.applyMemberIds(updatedAssignees, targetCase.id, memberIds));
          if (oldName !== name) {
            var updated = AssigneeUtils.updateAssigneeReferences(
              oldName, name, cases, maintenanceCases, projectCases
            );
            setCases(updated.cases);
            setMaintenanceCases(updated.maintenanceCases);
            setProjectCases(updated.projectCases);
          }
          showToast('指派人員更新成功');
        } else {
          var newAssignee = {
            id: 'ASG' + Date.now(),
            name: name,
            leaderId: formData.leaderId || '',
            districts: districts.slice(),
            memberIds: memberIds.slice(),
            createdDate: todayDate
          };
          setAssignees(AssigneeUtils.applyMemberIds(
            [newAssignee].concat(assignees), newAssignee.id, memberIds
          ));
          showToast('指派人員新增成功');
        }
        setView('assignee-list');
      }

      var sortedAccounts = accounts.slice().sort(function (a, b) {
        return a.name.localeCompare(b.name, 'zh-Hant');
      });

      return h('div', {
        className: 'max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative'
      },
        PageHeader({
          title: isEdit ? '編輯指派人員' : '新增指派人員',
          badge: isEdit ? targetCase.name : null,
          onClose: function () { setView('assignee-list'); },
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
        }),
        h('form', { onSubmit: handleSubmit, className: 'p-6' },
          h('div', { className: 'space-y-6' },
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '指派人員名稱 ', h('span', { className: 'text-red-500' }, '*')),
              h('input', {
                type: 'text',
                name: 'name',
                value: formData.name,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '組長'),
              h('select', {
                name: 'leaderId',
                value: formData.leaderId,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white'
              },
                h('option', { value: '' }, '請選擇'),
                sortedAccounts.map(function (acc) {
                  return h('option', { key: acc.id, value: acc.id }, acc.name);
                })
              )
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-2' }, '負責公司區域'),
              h('p', { className: 'text-xs text-gray-400 mb-3' },
                '依縣市展開選擇行政區；勾選縣市可一次全選或取消該縣市下所有行政區'),
              renderDistrictTree()
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-2' }, '成員名單'),
              h('p', { className: 'text-xs text-gray-400 mb-3' }, '勾選帳號以加入此指派人員；同一帳號可同時歸屬多個指派人員'),
              sortedAccounts.length === 0
                ? h('p', { className: 'text-gray-400 text-sm' }, '尚無帳號資料')
                : h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto border rounded-md p-3' },
                    sortedAccounts.map(function (acc) {
                      var checked = memberIds.indexOf(acc.id) !== -1;
                      return h('label', {
                        key: acc.id,
                        className: 'inline-flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer ' +
                          (checked ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200')
                      },
                        h('input', {
                          type: 'checkbox',
                          checked: checked,
                          onChange: function () { toggleMember(acc.id); }
                        }),
                        h('span', null, acc.name)
                      );
                    })
                  )
            )
          ),
          h('div', { className: 'flex justify-end gap-3 mt-8 pt-6 border-t' },
            h('button', {
              type: 'button',
              onClick: function () { setView('assignee-list'); },
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

  window.AssigneeForm = AssigneeForm;
})();
