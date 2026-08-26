/*
 * features/repair/maintenance-detail-sections.js — 保養案件的可編輯區塊渲染器
 *
 * 「保養明細」頁與「案件安排」排程彈窗共用同一份區塊實作。模組本身無狀態：
 * formData 與 UI 暫存狀態都由呼叫端保管。
 *
 * ctx = {
 *   formData, ui,
 *   data: { equipments, vendors, stores, customers },
 *   rerender, showToast,
 *   include,          // SECTION_KEYS 的子集，決定畫哪幾段與編號
 *   mode,             // 'edit' | 'view'；'view' 時全區塊唯讀
 *   idPrefix          // 多選欄位的 id 前綴，避免同頁重複
 * }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, TimeInput24 = IESS.TimeInput24;

  var SECTION_KEYS = ['schedule', 'case', 'equipment', 'result'];
  var SECTION_TITLES = {
    schedule: '排程資料',
    case: '案件資料',
    equipment: '設備資料',
    result: '保養結果'
  };

  // 編號依 include 的實際內容產生：彈窗略過某段時，其餘段落編號才會跟著調整
  function sectionTitle(include, key) {
    return (include.indexOf(key) + 1) + '. ' + SECTION_TITLES[key];
  }

  function createUiState() {
    return { equipPicker: { show: false }, signaturePad: { show: false } };
  }

  // 多選欄位的 id 前綴：明細頁用預設值，排程彈窗傳 idPrefix 避免同頁重複 id
  function fieldId(ctx, suffix) {
    return (ctx.idPrefix || 'maintenance') + '-' + suffix;
  }

  var renderAssigneeMultiSelect = CaseAssigneeFields.renderAssigneeMultiSelect;
  var renderMemberMultiSelect = CaseAssigneeFields.renderMemberMultiSelect;

  function getEquipmentList(ctx) {
    return ctx.formData.equipmentList || [];
  }

  function resolveMaintenanceCompletionDate(maintenanceCase) {
    return (maintenanceCase && maintenanceCase.planDate) || todayDate;
  }

  function updateStoreLastMaintenanceDate(stores, setStores, maintenanceCase) {
    if (!setStores || !stores || !maintenanceCase) return;
    var completionDate = resolveMaintenanceCompletionDate(maintenanceCase);
    setStores(stores.map(function (s) {
      return s.customerName === maintenanceCase.customerName && s.storeName === maintenanceCase.storeName
        ? Object.assign({}, s, { lastMaintenanceDate: completionDate })
        : s;
    }));
  }

  /* 保養狀態的自動判斷（「已完成」只能手動指定）：
   * 已預約＝有組別或協力廠商，且有保養日期；其餘皆為未保養。 */
  function resolveProgressStatus(formData) {
    if (formData.status === '已完成') return '已完成';
    var dispatched = CaseAssigneeUtils.hasFormalAssignee(formData)
      || CaseAssigneeUtils.hasPartnerVendor(formData);
    return (dispatched && formData.planDate) ? '已預約' : '未保養';
  }

  function ReadOnlyField(p) {
    var label = p.label;
    var value = p.value;
    return h("div", null, label && h("span", {
      className: "text-gray-500 block mb-1 text-xs"
    }, label), h("div", {
      className: "font-medium bg-gray-50 p-2.5 rounded-md border border-gray-100 min-h-[42px]"
    }, value || '-'));
  }

  function sectionCard(title, extraHeader, body) {
    return h("section", {
      className: "bg-white p-6 rounded-lg shadow-sm border border-gray-100"
    }, h("div", {
      className: "flex justify-between items-center border-b pb-2 mb-4"
    }, h("h3", {
      className: "text-lg font-bold text-blue-800"
    }, title), extraHeader), body);
  }

  function fieldLabel(text) {
    return h("span", { className: "text-gray-500 block mb-1 text-xs" }, text);
  }

  function getStoreForCase(ctx, c) {
    return ScheduleUtils.resolveStore(ctx.data.stores, c && c.customerName, c && c.storeName);
  }

  // 與列表的「保養區間」欄同源同格式，避免兩處對不上
  function getMaintenancePeriodLabel(ctx, c) {
    return ScheduleUtils.formatPeriodRange(ScheduleUtils.resolveCasePeriod(c, ctx.data.customers));
  }

  function applyChange(ctx, patch) {
    Object.keys(patch).forEach(function (k) { ctx.formData[k] = patch[k]; });
    // 排程資料一有異動就重算保養狀態（「已完成」維持手動）
    ctx.formData.status = resolveProgressStatus(ctx.formData);
    ctx.rerender();
  }

  function handleStatusChange(ctx, value) {
    var f = ctx.formData;
    f.status = value;
    if (value === '已完成') {
      // 手動改為已完成時就押上完成時間
      if (!f.completionDate) f.completionDate = IESS.caseDateTime.now();
    } else {
      f.completionDate = '';
      f.status = resolveProgressStatus(f);
    }
    ctx.rerender();
  }

  // 設備清單改存在 formData 上，排程彈窗的整筆 merge 才帶得走
  function handlePickerConfirm(ctx, picked) {
    var stamp = Date.now();
    ctx.formData.equipmentList = getEquipmentList(ctx).concat(
      picked.map(function (eq, idx) {
        return Object.assign({}, eq, { id: stamp + idx });
      }));
    ctx.ui.equipPicker = { show: false };
    ctx.showToast('已加入 ' + picked.length + ' 筆設備');
    ctx.rerender();
  }

  function handleRemoveEquipment(ctx, id) {
    ctx.formData.equipmentList = getEquipmentList(ctx).filter(function (eq) {
      return eq.id !== id;
    });
    ctx.rerender();
  }

  function renderScheduleSection(ctx, include) {
    var formData = ctx.formData, vendors = ctx.data.vendors;
    var isEdit = ctx.mode !== 'view';
    return sectionCard(sectionTitle(include, 'schedule'), null, h("div", {
      className: "grid grid-cols-1 md:grid-cols-3 gap-6"
    }, h("div", null, fieldLabel('保養日期'), isEdit ? h("input", {
      type: "date",
      value: formData.planDate || '',
      onChange: function (e) { applyChange(ctx, { planDate: e.target.value }); },
      className: "w-full p-2.5 border rounded outline-none"
    }) : h(ReadOnlyField, { value: formData.planDate })),
      h("div", null, fieldLabel('保養開始時間'), isEdit ? h(TimeInput24, {
        value: formData.planTimeStart || '',
        onChange: function (e) { applyChange(ctx, { planTimeStart: e.target.value }); },
        className: "w-full"
      }) : h(ReadOnlyField, { value: formData.planTimeStart })),
      h("div", null, fieldLabel('保養結束時間'), isEdit ? h(TimeInput24, {
        value: formData.planTimeEnd || '',
        onChange: function (e) { applyChange(ctx, { planTimeEnd: e.target.value }); },
        className: "w-full"
      }) : h(ReadOnlyField, { value: formData.planTimeEnd })),
      h("div", null, fieldLabel('組別'), isEdit ? renderAssigneeMultiSelect(formData, function (next) {
        applyChange(ctx, {
          assignees: next,
          assigneeMemberIds: CaseAssigneeFields.syncMemberIds(next, formData.assigneeMemberIds)
        });
      }, { id: fieldId(ctx, 'assignees') }) : h(ReadOnlyField, {
        value: CaseAssigneeUtils.formatMaintenanceAssignees(formData)
      })),
      h("div", null, fieldLabel('指派人員'), isEdit ? renderMemberMultiSelect(formData, function (next) {
        applyChange(ctx, { assigneeMemberIds: next });
      }, { id: fieldId(ctx, 'assignee-members') }) : h(ReadOnlyField, {
        value: CaseAssigneeUtils.formatAssigneeMembers(formData)
      })),
      h("div", null, fieldLabel('協力廠商'), isEdit ? IESS.MultiSelect({
        id: fieldId(ctx, 'partner-vendors'),
        options: VendorUtils.getCooperatorSelectOptions(vendors, formData.partnerVendorIds),
        value: formData.partnerVendorIds || [],
        onChange: function (next) { applyChange(ctx, { partnerVendorIds: next }); },
        placeholder: '請選擇協力廠商'
      }) : h(ReadOnlyField, {
        value: VendorUtils.formatCooperatorLabels(vendors, formData.partnerVendorIds)
      }))
    ));
  }

  function renderCaseSection(ctx, include) {
    var formData = ctx.formData;
    return sectionCard(sectionTitle(include, 'case'), null, h("div", {
      className: "grid grid-cols-2 md:grid-cols-4 gap-4"
    }, h(ReadOnlyField, {
      label: "客戶名稱",
      value: formData.customerName
    }), h(ReadOnlyField, {
      label: "門市名稱",
      value: formData.storeName
    }), h(ReadOnlyField, {
      label: "行政區域",
      value: StoreUtils.getRecordArea(formData) || '—'
    }), h(ReadOnlyField, {
      label: "服務等級",
      value: formData.serviceLevel
    }), h(ReadOnlyField, {
      label: "保養區間",
      value: getMaintenancePeriodLabel(ctx, formData)
    }), h(ReadOnlyField, {
      label: "門市地址",
      value: (getStoreForCase(ctx, formData) && StoreUtils.buildFullAddress(getStoreForCase(ctx, formData))) || formData.storeAddress
    }), h(ReadOnlyField, {
      label: "室內機高度",
      value: (getStoreForCase(ctx, formData) || {}).indoorHeight
    }), h(ReadOnlyField, {
      label: "室外機高度",
      value: (getStoreForCase(ctx, formData) || {}).outdoorHeight
    })));
  }

  function renderEquipmentSection(ctx, include) {
    var formData = ctx.formData;
    var isEdit = ctx.mode !== 'view';
    var equipmentList = getEquipmentList(ctx);
    return sectionCard(sectionTitle(include, 'equipment'), isEdit && h("button", {
      type: "button",
      onClick: function () { ctx.ui.equipPicker = { show: true }; ctx.rerender(); },
      className: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-md flex items-center gap-2 font-medium transition-colors border border-indigo-200"
    }, Icons.Plus({ className: "h-4 w-4" }), ' 加入設備'), h("div", {
      className: "overflow-x-auto border rounded-lg border-gray-200"
    }, h("table", {
      className: "w-full text-left text-sm text-gray-600 whitespace-nowrap"
    }, h("thead", {
      className: "bg-gray-50 text-gray-700 border-b"
    }, h("tr", null,
      isEdit && h("th", { className: "p-3 font-semibold text-center w-20" }, "操作"),
      EquipmentUtils.renderListHeaderCells(h)
    )), h("tbody", {
      className: "divide-y divide-gray-100"
    }, equipmentList.length === 0 ? h("tr", null, h("td", {
      colspan: String(12 + (isEdit ? 1 : 0)),
      className: "text-center p-8 text-gray-400 bg-gray-50/50"
    }, '尚未加入任何設備資料')) : equipmentList.map(function (eq) {
      return h("tr", { key: eq.id, className: "hover:bg-gray-50 transition-colors" },
        isEdit && h("td", { className: "p-3 text-center" }, h("button", {
          type: "button",
          onClick: function () { handleRemoveEquipment(ctx, eq.id); },
          className: "p-1.5 text-red-600 hover:bg-red-100 rounded",
          title: "移除設備"
        }, Icons.Trash2({ className: "h-4 w-4" }))),
        EquipmentUtils.renderListDataCells(h, eq)
      );
    })))));
  }

  function renderResultSection(ctx, include) {
    var formData = ctx.formData;
    var isEdit = ctx.mode !== 'view';
    return sectionCard(sectionTitle(include, 'result'), null, h("div", {
      className: "grid grid-cols-1 md:grid-cols-3 gap-6"
    }, h("div", null, fieldLabel('保養狀態'), isEdit ? h("select", {
      value: formData.status,
      onChange: function (e) { handleStatusChange(ctx, e.target.value); },
      className: "w-full p-2.5 border rounded outline-none"
    }, MAINTENANCE_STATUS_OPTIONS.map(function (opt) {
      return h("option", { key: opt, value: opt }, opt);
    })) : h(ReadOnlyField, { value: formData.status })),
      h(ReadOnlyField, {
        label: '完成時間',
        value: IESS.caseDateTime.format(formData.completionDate)
      }),
      h("div", null, fieldLabel('客戶簽收'), isEdit ? h("div", {
        className: "flex items-center gap-3"
      }, h("button", {
        type: "button",
        onClick: function () { ctx.ui.signaturePad = { show: true }; ctx.rerender(); },
        className: "px-4 py-2.5 border border-blue-200 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors font-medium"
      }, formData.customerSignature ? '重新簽收' : '客戶簽收'),
        formData.customerSignature ? h("img", {
          src: formData.customerSignature,
          alt: '客戶簽名',
          className: "h-[42px] bg-white border border-gray-200 rounded-md"
        }) : h("span", { className: "text-gray-400 text-sm" }, '尚未簽收')
      ) : (formData.customerSignature ? h("img", {
        src: formData.customerSignature,
        alt: '客戶簽名',
        className: "h-[42px] bg-white border border-gray-200 rounded-md"
      }) : h(ReadOnlyField, { value: '尚未簽收' }))),
      h("div", { className: "md:col-span-3" }, fieldLabel('備註'), isEdit ? h("textarea", {
        rows: "3",
        value: formData.remark || '',
        // 就地寫入且不重繪：重繪會讓游標跳掉，stateful 的還原機制只在有 rerender 時作用
        onChange: function (e) { ctx.formData.remark = e.target.value; },
        placeholder: '請輸入保養備註...',
        className: "w-full p-2.5 border rounded outline-none resize-none"
      }) : h(ReadOnlyField, { value: formData.remark }))
    ));
  }

  function renderSections(ctx) {
    var include = ctx.include || SECTION_KEYS;
    return include.map(function (key) {
      if (key === 'schedule') return renderScheduleSection(ctx, include);
      if (key === 'case') return renderCaseSection(ctx, include);
      if (key === 'equipment') return renderEquipmentSection(ctx, include);
      if (key === 'result') return renderResultSection(ctx, include);
      return null;
    }).filter(Boolean);
  }

  function renderOverlays(ctx) {
    var isEdit = ctx.mode !== 'view';
    return [
      isEdit && ctx.ui.equipPicker.show && h(ProjectEquipPicker, {
        equipments: ctx.data.equipments,
        customerName: ctx.formData.customerName,
        storeName: ctx.formData.storeName,
        addedIds: getEquipmentList(ctx).map(function (eq) {
          return eq.sourceEquipmentId;
        }).filter(Boolean),
        onConfirm: function (picked) { handlePickerConfirm(ctx, picked); },
        onClose: function () { ctx.ui.equipPicker = { show: false }; ctx.rerender(); }
      }),
      isEdit && ctx.ui.signaturePad.show && IESS.SignaturePadModal({
        title: '客戶簽收',
        value: ctx.formData.customerSignature,
        onConfirm: function (dataUrl) {
          ctx.formData.customerSignature = dataUrl;
          ctx.ui.signaturePad = { show: false };
          ctx.showToast(dataUrl ? '客戶簽收已暫存，請記得儲存' : '已清除客戶簽名');
          ctx.rerender();
        },
        onClose: function () { ctx.ui.signaturePad = { show: false }; ctx.rerender(); }
      })
    ];
  }

  window.MaintenanceDetailSections = {
    SECTION_KEYS: SECTION_KEYS,
    createUiState: createUiState,
    renderSections: renderSections,
    renderOverlays: renderOverlays,
    resolveProgressStatus: resolveProgressStatus,
    updateStoreLastMaintenanceDate: updateStoreLastMaintenanceDate,
    // closeMaintenanceCase（maintenance.js）也需要同一套完成日期回退規則，匯出以免各自留一份
    resolveMaintenanceCompletionDate: resolveMaintenanceCompletionDate
  };
})();
