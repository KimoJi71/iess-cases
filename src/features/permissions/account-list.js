/*
 * features/permissions/account-list.js — 帳號管理：帳號列表
 * props: { accounts, setAccounts, assignees, setAssignees, setEditingCase, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
  var iconActionBtn = IESS.iconActionBtn;

  function enabledBadge(enabled) {
    return h('span', {
      className: 'px-2 py-0.5 rounded-full text-xs font-medium ' +
        (enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600')
    }, AccountUtils.formatEnabled(enabled));
  }

  function AccountList(props) {
    var accounts = props.accounts;
    var setAccounts = props.setAccounts;
    var assignees = props.assignees;
    var setAssignees = props.setAssignees;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;

    var keyword = '';
    var appliedKeyword = '';
    var deleteModal = { show: false, id: null };
    var listPagination = IESS.createListPagination();

    function getFilteredAccounts() {
      var kw = appliedKeyword.trim().toLowerCase();
      var list = accounts;
      if (kw) {
        list = accounts.filter(function (a) {
          return [a.name, a.username, a.email]
            .filter(Boolean)
            .some(function (v) { return String(v).toLowerCase().includes(kw); });
        });
      }
      return list.slice().sort(function (a, b) { return new Date(b.createdDate) - new Date(a.createdDate); });
    }

    return stateful(function (rerender) {
      var filteredAccounts = getFilteredAccounts();
      var pageResult = listPagination.slice(filteredAccounts);

      function handleSearch() { appliedKeyword = keyword; listPagination.resetPage(); rerender(); }
      function handleKeyDown(e) { if (e.key === 'Enter') handleSearch(); }

      function handleDelete(id) {
        var target = accounts.find(function (a) { return a.id === id; });
        if (target && target.username === 'admin') {
          showToast('預設最高權限帳號 admin 不可刪除', 'error');
          deleteModal = { show: false, id: null };
          rerender();
          return;
        }
        setAccounts(accounts.filter(function (a) { return a.id !== id; }));
        setAssignees(AssigneeUtils.removeMemberFromAll(assignees, id));
        deleteModal = { show: false, id: null };
        showToast('帳號已刪除');
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
                placeholder: '姓名 / 帳號 / Email',
                className: 'w-72 p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('button', {
              onClick: handleSearch,
              className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md shadow-sm transition-colors'
            }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋')
          ),
          iconActionBtn({
            label: '新增帳號',
            className: 'flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors shrink-0',
            onClick: function () { setEditingCase(null); setView('account-add'); },
            icon: Icons.Plus({ className: 'h-5 w-5' })
          })
        ),
        h('div', {
          className: 'overflow-x-auto border rounded-lg'
        },
          h('table', { className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap' },
            h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
              h('tr', null,
                h('th', { className: 'p-3 font-semibold text-center w-36' }, '操作'),
                h('th', { className: 'p-3 font-semibold' }, '姓名'),
                h('th', { className: 'p-3 font-semibold' }, '帳號'),
                h('th', { className: 'p-3 font-semibold' }, 'Email'),
                h('th', { className: 'p-3 font-semibold' }, '啟用狀態')
              )
            ),
            h('tbody', { className: 'divide-y divide-gray-100' },
              filteredAccounts.length === 0
                ? h('tr', null, h('td', { colspan: 5, className: 'p-10 text-center text-gray-400 text-base' }, '無資料'))
                : pageResult.items.map(function (a) {
                    return h('tr', { key: a.id, className: 'hover:bg-blue-50/50 transition-colors' },
                      h('td', { className: 'p-3' },
                        h('div', { className: 'flex items-center justify-center space-x-2' },
                          h('button', {
                            onClick: function () { setEditingCase(a); setView('account-edit'); },
                            className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                            title: '編輯'
                          }, Icons.Edit({ className: 'h-4 w-4' })),
                          h('button', {
                            onClick: function () { deleteModal = { show: true, id: a.id }; rerender(); },
                            className: 'p-1.5 text-red-600 hover:bg-red-100 rounded',
                            title: '刪除',
                            disabled: a.username === 'admin'
                          }, Icons.Trash2({ className: 'h-4 w-4 ' + (a.username === 'admin' ? 'opacity-30' : '') }))
                        )
                      ),
                      h('td', { className: 'p-3 font-medium text-gray-800' }, a.name),
                      h('td', { className: 'p-3' }, a.username),
                      h('td', { className: 'p-3' }, a.email || '—'),
                      h('td', { className: 'p-3' }, enabledBadge(a.enabled))
                    );
                  })
            )
          )
        ),
        listPagination.renderBar(pageResult, rerender),
        deleteModal.show && h('div', {
          className: 'app-modal-overlay'
        },
          h('div', { className: 'bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4' },
            h('div', { className: 'flex items-center space-x-3 text-red-600 mb-4' },
              Icons.AlertCircle({ className: 'h-6 w-6' }),
              h('h3', { className: 'text-lg font-bold text-gray-800' }, '確認刪除')
            ),
            h('p', { className: 'text-gray-600 mb-6' }, '確定要刪除此帳號嗎？刪除後將一併從相關成員名單中移除，且無法復原。'),
            h('div', { className: 'flex justify-end space-x-3' },
              h('button', {
                onClick: function () { deleteModal = { show: false, id: null }; rerender(); },
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

  window.AccountList = AccountList;
})();
