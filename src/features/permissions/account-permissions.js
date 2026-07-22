/*
 * features/permissions/account-permissions.js — 帳號權限設定面板（供新增/編輯帳號表單使用）
 */
(function () {
  'use strict';
  var h = IESS.h;

  var GROUP_ROW_STYLES = [
    'bg-gray-100 font-bold text-gray-800',
    'bg-gray-50 font-semibold text-gray-700'
  ];
  var LEAF_INDENT = ['pl-3', 'pl-8', 'pl-14'];

  function clonePermissions(perms) {
    var next = {};
    PERMISSION_FUNCTIONS.forEach(function (fn) {
      var row = perms[fn] || {};
      next[fn] = { view: !!row.view, edit: !!row.edit, close: !!row.close };
    });
    return next;
  }

  function collectLeafFunctions(node) {
    if (typeof node === 'string') return [node];
    var leaves = [];
    (node.children || []).forEach(function (child) {
      leaves = leaves.concat(collectLeafFunctions(child));
    });
    return leaves;
  }

  function getGroupOpState(permissions, node, op) {
    var leaves = collectLeafFunctions(node);
    if (!leaves.length) return 'none';
    var checkedCount = leaves.filter(function (fn) {
      return !!(permissions[fn] && permissions[fn][op]);
    }).length;
    if (checkedCount === 0) return 'none';
    if (checkedCount === leaves.length) return 'all';
    return 'some';
  }

  function renderGroupCheckbox(state, onChange) {
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

  function renderPermissionRows(permissions, togglePermission, toggleGroupPermission, nodes, depth) {
    var rows = [];
    nodes.forEach(function (node) {
      if (typeof node === 'string') {
        var row = permissions[node];
        rows.push(h('tr', { key: node, className: 'hover:bg-blue-50/30' },
          h('td', {
            className: 'p-3 font-medium text-gray-800 ' + (LEAF_INDENT[depth] || 'pl-14')
          }, node),
          PERMISSION_OPERATION_TYPES.map(function (op) {
            return h('td', { key: op, className: 'p-3 text-center' },
              h('input', {
                type: 'checkbox',
                checked: !!row[op],
                onChange: function () { togglePermission(node, op); },
                className: 'h-4 w-4'
              })
            );
          })
        ));
        return;
      }

      rows.push(h('tr', { key: node.id + '-group-' + depth, className: GROUP_ROW_STYLES[depth] || GROUP_ROW_STYLES[1] },
        h('td', {
          className: 'p-3 ' + (LEAF_INDENT[depth] || 'pl-3')
        }, node.id),
        PERMISSION_OPERATION_TYPES.map(function (op) {
          var state = getGroupOpState(permissions, node, op);
          return h('td', { key: op, className: 'p-3 text-center' },
            renderGroupCheckbox(state, function () { toggleGroupPermission(node, op); })
          );
        })
      ));
      rows = rows.concat(renderPermissionRows(
        permissions, togglePermission, toggleGroupPermission, node.children, depth + 1
      ));
    });
    return rows;
  }

  function AccountPermissionsPanel(props) {
    var permissions = props.permissions;
    var togglePermission = props.togglePermission;
    var toggleGroupPermission = props.toggleGroupPermission;
    var toggleSelectAll = props.toggleSelectAll;
    var allSelected = AccountUtils.isAllSelected(permissions);

    return h('div', null,
      h('div', { className: 'flex items-center justify-between mb-4' },
        h('p', { className: 'text-sm text-gray-500' },
          '勾選群組或「編輯／結案」時，系統將自動連動底下功能；勾選「編輯」或「結案」亦會自動授予「檢視」。'),
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
            renderPermissionRows(
              permissions, togglePermission, toggleGroupPermission, PERMISSION_TREE, 0
            )
          )
        )
      )
    );
  }

  window.AccountPermissionsPanel = AccountPermissionsPanel;
  window.AccountPermissionHelpers = {
    clonePermissions: clonePermissions,
    collectLeafFunctions: collectLeafFunctions
  };
})();
