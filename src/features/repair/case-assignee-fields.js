/*
 * features/repair/case-assignee-fields.js — 叫修表單共用欄位
 *
 * 組別：下拉複選（IESS.MultiSelect）
 *
 * 由 case-form.js（新增／編輯）與 store-repair-form.js（門市叫修）共用。
 */
(function () {
  'use strict';

  function renderAssigneeMultiSelect(formData, onChange, options) {
    var opts = options || {};
    return IESS.MultiSelect({
      id: opts.id,
      options: ASSIGNEES,
      value: CaseAssigneeUtils.getAssignees(formData),
      onChange: onChange,
      placeholder: '請選擇組別',
      disabled: !!opts.disabled,
      className: opts.className || ''
    });
  }

  window.CaseAssigneeFields = {
    renderAssigneeMultiSelect: renderAssigneeMultiSelect
  };
})();
