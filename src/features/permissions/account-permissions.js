/*
 * features/permissions/account-permissions.js — 帳號設定：編輯權限
 * props: { accounts, setAccounts, targetCase, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  function clonePermissions(perms) {
    var next = {};
    PERMISSION_FUNCTIONS.forEach(function (fn) {
      var row = perms[fn] || {};
      next[fn] = { view: !!row.view, edit: !!row.edit, close: !!row.close };
    });
    return next;
  }

  function AccountPermissions(props) {
    var accounts = props.accounts;
    var setAccounts = props.setAccounts;
    var targetCase = props.targetCase;
    var setView = props.setView;
    var showToast = props.showToast;

    if (!targetCase) {
      return h('div', { className: 'text-center text-gray-400 p-12' }, '請從帳號列表選擇帳號');
    }

    var permissions = clonePermissions(targetCase.permissions || {});

    return stateful(function (rerender) {
      function togglePermission(fn, op) {
        var row = permissions[fn];
        row[op] = !row[op];
        if ((op === 'edit' || op === 'close') && row[op]) {
          row.view = true;
        }
        if (op === 'view' && !row.view) {
          row.edit = false;
          row.close = false;
        }
        permissions = AccountUtils.normalizePermissions(permissions);
        rerender();
      }

      function toggleSelectAll() {
        var allSelected = AccountUtils.isAllSelected(permissions);
        permissions = AccountUtils.setAllPermissions(permissions, !allSelected);
        rerender();
      }

      function handleSave() {
        var normalized = AccountUtils.normalizePermissions(permissions);
        setAccounts(accounts.map(function (a) {
          return a.id === targetCase.id
            ? Object.assign({}, a, { permissions: normalized })
            : a;
        }));
        showToast('權限已更新，該帳號使用者將被登出');
        setView('account-list');
      }

      var allSelected = AccountUtils.isAllSelected(permissions);

      return h('div', {
        className: 'max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative'
      },
        PageHeader({
          title: '權限設定',
          badge: targetCase.name + '（' + targetCase.username + '）',
          onClose: function () { setView('account-list'); },
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
        }),
        h('div', { className: 'p-6' },
          h('div', { className: 'flex items-center justify-between mb-4' },
            h('p', { className: 'text-sm text-gray-500' },
              '勾選「編輯」或「結案」時，系統將自動授予「檢視」權限。'),
            h('label', { className: 'inline-flex items-center gap-2 text-sm font-medium text-blue-700 cursor-pointer' },
              h('input', {
                type: 'checkbox',
                checked: allSelected,
                onChange: toggleSelectAll
              }),
              '全選'
            )
          ),
          h('div', { className: 'border rounded-lg overflow-hidden' },
            h('table', { className: 'w-full text-left text-sm text-gray-600' },
              h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
                h('tr', null,
                  h('th', { className: 'p-3 font-semibold' }, '功能名稱'),
                  PERMISSION_OPERATION_TYPES.map(function (op) {
                    return h('th', {
                      key: op,
                      className: 'p-3 font-semibold text-center w-24'
                    }, PERMISSION_OPERATION_LABELS[op]);
                  })
                )
              ),
              h('tbody', { className: 'divide-y divide-gray-100' },
                PERMISSION_FUNCTIONS.map(function (fn) {
                  var row = permissions[fn];
                  return h('tr', { key: fn, className: 'hover:bg-blue-50/30' },
                    h('td', { className: 'p-3 font-medium text-gray-800' }, fn),
                    PERMISSION_OPERATION_TYPES.map(function (op) {
                      return h('td', { key: op, className: 'p-3 text-center' },
                        h('input', {
                          type: 'checkbox',
                          checked: !!row[op],
                          onChange: function () { togglePermission(fn, op); },
                          className: 'h-4 w-4'
                        })
                      );
                    })
                  );
                })
              )
            )
          ),
          h('div', { className: 'flex justify-end gap-3 mt-8 pt-6 border-t' },
            h('button', {
              type: 'button',
              onClick: function () { setView('account-list'); },
              className: 'px-5 py-2.5 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
            }, '取消'),
            h('button', {
              type: 'button',
              onClick: handleSave,
              className: 'flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
            }, Icons.Save({ className: 'h-4 w-4' }), ' 儲存')
          )
        )
      );
    });
  }

  window.AccountPermissions = AccountPermissions;
})();
