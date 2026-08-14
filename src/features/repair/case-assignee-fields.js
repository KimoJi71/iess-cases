/*
 * features/repair/case-assignee-fields.js — 叫修／保養表單共用欄位
 *
 * 組別：下拉複選（IESS.MultiSelect），值為組別名稱
 * 指派人員：下拉複選，只列出「已選組別」底下的成員帳號，並依組別分群顯示；
 *           值為帳號 id。組別被取消選取時，其成員必須一併移除 —— 呼叫端在組別的
 *           onChange 裡用 syncMemberIds() 過濾即可。
 *
 * 由 case-form.js（新增／編輯）、store-repair-form.js（門市叫修）與
 * maintenance.js（保養計劃）共用。
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

  function syncMemberIds(groupNames, memberIds) {
    return AssigneeUtils.filterMemberIdsByGroups(memberIds, groupNames);
  }

  function renderMemberMultiSelect(formData, onChange, options) {
    var opts = options || {};
    var groupNames = CaseAssigneeUtils.getAssignees(formData);
    var groups = AssigneeUtils.getMemberGroupsForGroupNames(groupNames);
    var hasGroups = groupNames.length > 0;
    return IESS.MultiSelect({
      id: opts.id,
      options: groups,
      value: CaseAssigneeUtils.getAssigneeMemberIds(formData),
      onChange: onChange,
      placeholder: hasGroups ? '請選擇指派人員' : '請先選擇組別',
      disabled: !!opts.disabled || !hasGroups,
      // 組別是使用者剛剛親手選的：即使該組沒有可指派的成員（未設定成員，或成員帳號已停用），
      // 也要把組別標題連同說明畫出來，否則畫面看起來像是選了組別卻沒反應。
      showEmptyGroups: true,
      emptyGroupText: '此組別無可指派成員',
      className: opts.className || ''
    });
  }

  window.CaseAssigneeFields = {
    renderAssigneeMultiSelect: renderAssigneeMultiSelect,
    renderMemberMultiSelect: renderMemberMultiSelect,
    syncMemberIds: syncMemberIds
  };
})();
