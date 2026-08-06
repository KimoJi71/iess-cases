/*
 * features/repair/case-assignee-fields.js — 叫修表單共用欄位
 *
 * 指派人員：下拉複選（IESS.MultiSelect）
 * 協作人員設定：可多筆的（協作人員／協作人數／協作積分）組合列
 *
 * 由 case-form.js（新增／編輯）與 store-repair-form.js（門市叫修）共用。
 */
(function () {
  'use strict';
  var h = IESS.h;

  function renderAssigneeMultiSelect(formData, onChange, options) {
    var opts = options || {};
    return IESS.MultiSelect({
      id: opts.id,
      options: ASSIGNEES,
      value: CaseAssigneeUtils.getAssignees(formData),
      onChange: onChange,
      placeholder: '請選擇指派人員',
      disabled: !!opts.disabled,
      className: opts.className || ''
    });
  }

  function renderCollaboratorRow(rows, row, index, handlers) {
    var nameOptions = CaseAssigneeUtils.getAvailableCollaboratorNames(rows, index, ASSIGNEES);
    return h('div', {
      className: 'grid grid-cols-1 sm:grid-cols-[1fr_6rem_6rem_2.5rem] gap-2 items-center'
    },
      h('select', {
        value: row.name || '',
        onChange: function (e) { handlers.onUpdateRow(index, { name: e.target.value }); },
        className: 'w-full p-2 border rounded-md outline-none bg-white'
      },
        h('option', { value: '' }, '請選擇'),
        nameOptions.map(function (opt) {
          return h('option', { key: opt, value: opt }, opt);
        })
      ),
      h('input', {
        type: 'number',
        min: '1',
        value: row.count == null ? 1 : row.count,
        onChange: function (e) { handlers.onUpdateRow(index, { count: e.target.value }); },
        className: 'w-full p-2 border rounded-md outline-none'
      }),
      h('input', {
        type: 'number',
        value: row.points == null ? 0 : row.points,
        onChange: function (e) { handlers.onUpdateRow(index, { points: e.target.value }); },
        className: 'w-full p-2 border rounded-md outline-none'
      }),
      h('button', {
        type: 'button',
        'aria-label': '刪除此協作',
        onClick: function () { handlers.onRemoveRow(index); },
        className: 'p-2 text-red-500 hover:bg-red-50 rounded-md'
      }, '×')
    );
  }

  function renderCollaboratorSettings(formData, handlers) {
    var rows = Array.isArray(formData.collaborators) ? formData.collaborators : [];
    var isFull = rows.length >= ASSIGNEES.length;
    return h('div', { className: 'col-span-full border rounded-md p-3 bg-gray-50 space-y-3' },
      h('div', { className: 'font-semibold text-sm text-blue-800' }, '協作人員設定'),
      rows.length
        ? h('div', { className: 'space-y-2' },
            h('div', {
              className: 'hidden sm:grid sm:grid-cols-[1fr_6rem_6rem_2.5rem] gap-2 text-xs text-gray-500'
            },
              h('div', null, '協作人員'),
              h('div', null, '協作人數'),
              h('div', null, '協作積分'),
              h('div', null, '')
            ),
            rows.map(function (row, index) {
              return renderCollaboratorRow(rows, row, index, handlers);
            })
          )
        : h('div', { className: 'text-xs text-gray-400' }, '尚未新增協作'),
      h('button', {
        type: 'button',
        disabled: isFull,
        onClick: function () { handlers.onAddRow(); },
        className: 'px-3 py-1.5 text-sm border rounded-md ' + (isFull
          ? 'text-gray-400 border-gray-200 cursor-not-allowed'
          : 'text-blue-600 border-blue-300 hover:bg-blue-50')
      }, '＋ 新增協作')
    );
  }

  window.CaseAssigneeFields = {
    renderAssigneeMultiSelect: renderAssigneeMultiSelect,
    renderCollaboratorSettings: renderCollaboratorSettings
  };
})();
