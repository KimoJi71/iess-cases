/*
 * features/permissions/assignee-list.js — 指派人員管理：列表
 * props: { assignees, accounts, cases, maintenanceCases, projectCases, setEditingCase, setView, showToast, setAssignees }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, useDragScroll = IESS.useDragScroll;
  var iconActionBtn = IESS.iconActionBtn;

  function AssigneeList(props) {
    var assignees = props.assignees;
    var setAssignees = props.setAssignees;
    var accounts = props.accounts;
    var cases = props.cases;
    var maintenanceCases = props.maintenanceCases;
    var projectCases = props.projectCases;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;

    var keyword = '';
    var appliedKeyword = '';
    var deleteModal = { show: false, id: null, name: '' };
    var dragProps = useDragScroll();

    function getFilteredAssignees() {
      var kw = appliedKeyword.trim().toLowerCase();
      var list = assignees;
      if (kw) {
        list = assignees.filter(function (a) {
          return [
            a.name,
            AccountUtils.formatDistricts(a.districts),
            AssigneeUtils.formatMembers(accounts, a)
          ].filter(Boolean).some(function (v) {
            return String(v).toLowerCase().includes(kw);
          });
        });
      }
      return list.slice().sort(function (a, b) {
        return a.name.localeCompare(b.name, 'zh-Hant');
      });
    }

    return stateful(function (rerender) {
      var filteredAssignees = getFilteredAssignees();

      function handleSearch() { appliedKeyword = keyword; rerender(); }
      function handleKeyDown(e) { if (e.key === 'Enter') handleSearch(); }

      function handleDelete(id) {
        var target = assignees.find(function (a) { return a.id === id; });
        if (!target) {
          deleteModal = { show: false, id: null, name: '' };
          rerender();
          return;
        }
        if (AssigneeUtils.isAssigneeInUse(
          target.name, cases, maintenanceCases, projectCases
        )) {
          showToast('此指派人員已被帳號或案件使用，無法刪除', 'error');
          deleteModal = { show: false, id: null, name: '' };
          rerender();
          return;
        }
        setAssignees(assignees.filter(function (a) { return a.id !== id; }));
        deleteModal = { show: false, id: null, name: '' };
        showToast('指派人員已刪除');
      }

      return h('div', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
        h('div', { className: 'flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4' },
          h('div', { className: 'flex flex-wrap items-end gap-3' },
            h('div', null,
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '關鍵字'),
              h('input', {
                type: 'text',
                value: keyword,
                onChange: function (e) { keyword = e.target.value; rerender(); },
                onKeyDown: handleKeyDown,
                placeholder: '名稱 / 公司區域 / 成員',
                className: 'w-72 p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('button', {
              onClick: handleSearch,
              className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md shadow-sm transition-colors'
            }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋')
          ),
          h('button', {
            onClick: function () { setEditingCase(null); setView('assignee-add'); },
            className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md shadow-sm transition-colors',
            title: '新增指派人員'
          }, Icons.Plus({ className: 'h-5 w-5' }), ' 新增指派人員')
        ),
        h('div', Object.assign({}, dragProps, {
          className: 'overflow-x-auto border rounded-lg cursor-grab active:cursor-grabbing'
        }),
          h('table', { className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap select-none' },
            h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
              h('tr', null,
                h('th', { className: 'p-3 font-semibold text-center w-36' }, '操作'),
                h('th', { className: 'p-3 font-semibold' }, '指派人員名稱'),
                h('th', { className: 'p-3 font-semibold' }, '負責公司區域'),
                h('th', { className: 'p-3 font-semibold' }, '成員名單')
              )
            ),
            h('tbody', { className: 'divide-y divide-gray-100' },
              filteredAssignees.length === 0
                ? h('tr', null, h('td', { colspan: 4, className: 'p-10 text-center text-gray-400 text-base' }, '無資料'))
                : filteredAssignees.map(function (a) {
                    return h('tr', { key: a.id, className: 'hover:bg-blue-50/50 transition-colors' },
                      h('td', { className: 'p-3' },
                        h('div', { className: 'flex items-center justify-center space-x-2' },
                          h('button', {
                            onClick: function () { setEditingCase(a); setView('assignee-edit'); },
                            className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                            title: '編輯'
                          }, Icons.Edit({ className: 'h-4 w-4' })),
                          iconActionBtn({ label: '刪除', onClick: function () {
                              deleteModal = { show: true, id: a.id, name: a.name };
                              rerender();
                            },
                            className: 'p-1.5 text-red-600 hover:bg-red-100 rounded', icon: Icons.Trash2({ className: 'h-4 w-4' }) })
                        )
                      ),
                      h('td', { className: 'p-3 font-medium text-gray-800' }, a.name),
                      h('td', { className: 'p-3' }, AccountUtils.formatDistricts(a.districts)),
                      h('td', { className: 'p-3 max-w-md truncate', title: AssigneeUtils.formatMembers(accounts, a) },
                        AssigneeUtils.formatMembers(accounts, a))
                    );
                  })
            )
          )
        ),
        deleteModal.show && h('div', {
          className: 'fixed inset-0 bg-black/40 flex items-center justify-center z-50'
        },
          h('div', { className: 'bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4' },
            h('div', { className: 'flex items-center space-x-3 text-red-600 mb-4' },
              Icons.AlertCircle({ className: 'h-6 w-6' }),
              h('h3', { className: 'text-lg font-bold text-gray-800' }, '確認刪除')
            ),
            h('p', { className: 'text-gray-600 mb-6' },
              '確定要刪除指派人員「' + deleteModal.name + '」嗎？若已被帳號或案件使用則無法刪除。'),
            h('div', { className: 'flex justify-end space-x-3' },
              h('button', {
                onClick: function () { deleteModal = { show: false, id: null, name: '' }; rerender(); },
                className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
              }, '取消'),
              h('button', {
                onClick: function () { handleDelete(deleteModal.id); },
                className: 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors'
              }, '確認刪除')
            )
          )
        )
      );
    });
  }

  window.AssigneeList = AssigneeList;
})();
