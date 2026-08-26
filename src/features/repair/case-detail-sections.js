/*
 * features/repair/case-detail-sections.js — 維修案件的可編輯區塊渲染器
 *
 * 「編輯案件」頁與「案件安排」排程彈窗共用同一份區塊實作，兩處的版面、欄位
 * 與互動功能才不會各自漂移。模組本身無狀態：formData 與 UI 暫存狀態都由
 * 呼叫端保管，模組只負責把它們畫出來。
 *
 * ctx = {
 *   formData,   // 直接 mutate，沿用 EditCaseForm 現行寫法
 *   ui,         // createUiState() 的產出，由呼叫端保管
 *   data: { equipments, deviceCategories, processMethods, vehicles, vendors, stores },
 *   rerender, showToast,
 *   include     // SECTION_KEYS 的子集，決定畫哪幾段與編號
 * }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, TimeInput24 = IESS.TimeInput24;
  var caseDT = IESS.caseDateTime;
  var caseStatus = IESS.caseStatus;

  var SECTION_KEYS = ['schedule', 'case', 'equipment', 'result'];
  var SECTION_TITLES = {
    schedule: '排程資料',
    case: '案件資料',
    equipment: '設備與服務項目',
    result: '維修結果'
  };

  // 編號依 include 的實際內容產生：彈窗略過「排程資料」時，案件資料就是 1.
  function sectionTitle(include, key) {
    return (include.indexOf(key) + 1) + '. ' + SECTION_TITLES[key];
  }

  function isOtherWorkCategory(workCategory) {
    return workCategory === '其他';
  }

  function TimeRecordField(p) {
    return h('div', null,
      h('label', { className: 'block text-sm font-medium text-gray-800 mb-1.5' }, p.label),
      p.readOnly
        ? h('div', {
            className: 'w-full p-2.5 border rounded-md bg-gray-100 text-gray-700 min-h-[42px] flex items-center'
          }, p.value || '—')
        : h('input', {
            type: 'datetime-local',
            name: p.name,
            value: caseDT.toInput(p.value),
            onChange: p.onChange,
            step: '1',
            className: 'w-full p-2.5 border rounded-md outline-none bg-white'
          })
    );
  }

  function CaseReadOnlyField(p) {
    return h('div', { className: p.fullWidth ? 'col-span-full' : '' },
      h('span', { className: p.labelClassName || 'text-gray-500 block mb-1' }, p.label),
      h('div', {
        className: 'font-medium bg-gray-50 p-2.5 rounded-md border border-gray-100 min-h-[42px] flex items-center text-gray-700'
      }, p.value || '—')
    );
  }

  function ExpectedTimeRangeFields(p) {
    var labelTag = p.labelTag || 'label';
    return h('div', { className: p.wrapClass || 'col-span-full sm:col-span-2' },
      h(labelTag, { className: p.labelClassName || 'block text-sm mb-1' }, '預計時間'),
      h('div', { className: 'grid grid-cols-2 gap-4' },
        h('div', { className: 'flex items-center gap-2 min-h-[42px]' },
          h('span', { className: 'text-xs text-gray-500 shrink-0' }, '開始'),
          h(TimeInput24, {
            name: p.startName || 'expectedTimeStart',
            value: p.startValue || '',
            onChange: p.onChange,
            className: 'w-full h-[42px]'
          })
        ),
        h('div', { className: 'flex items-center gap-2 min-h-[42px]' },
          h('span', { className: 'text-xs text-gray-500 shrink-0' }, '結束'),
          h(TimeInput24, {
            name: p.endName || 'expectedTimeEnd',
            value: p.endValue || '',
            onChange: p.onChange,
            className: 'w-full h-[42px]'
          })
        )
      )
    );
  }

  var renderAssigneeMultiSelect = CaseAssigneeFields.renderAssigneeMultiSelect;
  var renderMemberMultiSelect = CaseAssigneeFields.renderMemberMultiSelect;

  function renderVehicleSelect(formData, vehicles, handleChange, className) {
    var options = VehicleUtils.getSelectOptions(vehicles, formData.vehicleId);
    return h('select', {
      name: 'vehicleId',
      value: formData.vehicleId || '',
      onChange: handleChange,
      className: className
    }, h('option', { value: '' }, '請選擇'), options.map(function (opt) {
      return h('option', { key: opt.value, value: opt.value }, opt.label);
    }));
  }

  function renderPartnerVendorMultiSelect(formData, vendors, onChange, id) {
    return IESS.MultiSelect({
      id: id,
      options: VendorUtils.getCooperatorSelectOptions(vendors, formData.partnerVendorIds),
      value: formData.partnerVendorIds || [],
      onChange: onChange,
      placeholder: '請選擇協力廠商'
    });
  }

  // 多選欄位的 id 前綴：編輯頁用預設值，排程彈窗傳 idPrefix 避免同頁重複 id
  function fieldId(ctx, suffix) {
    return (ctx.idPrefix || 'edit-case') + '-' + suffix;
  }

  function createUiState() {
    return {
      activeItemIndex: 0,
      pickerOpen: false,
      addEquipMenuOpen: false,
      signaturePad: { show: false },
      newRecordByItemId: {}
    };
  }

  function getNewRecord(ctx, itemId) {
    if (!ctx.ui.newRecordByItemId[itemId]) {
      ctx.ui.newRecordByItemId[itemId] = ProcessMethodUtils.normalizeProcessMethodSelection(
        ctx.data.processMethods, null
      );
    }
    return ctx.ui.newRecordByItemId[itemId];
  }

  function handleChange(ctx, e) {
    var name = e.target.name;
    var value = e.target.value;
    if (e.target.type === 'datetime-local') {
      value = value ? caseDT.fromInput(value) : '';
    }
    ctx.formData[name] = value;
    if (name === 'processStatus') {
      ctx.formData.processStatus = value || null;
      caseStatus.applyProcessStatusChange(ctx.formData, value || null, caseDT.now());
    }
    ctx.rerender();
  }

  function getAddedEquipmentIds(ctx) {
    return RepairCaseServiceItems.getEquipments(ctx.formData).map(function (eq) {
      return String(eq.id);
    });
  }

  function assignEquipment(ctx, eq) {
    // 已汰換的設備不可加入案件
    if (EquipmentUtils.isRetired(eq)) {
      ctx.showToast('已汰換的設備無法加入設備資料', 'error');
      ctx.ui.pickerOpen = false;
      ctx.ui.addEquipMenuOpen = false;
      ctx.rerender();
      return false;
    }
    // 同一筆設備在同一張案件只能出現一次
    if (RepairCaseEquipment.isAdded(eq, getAddedEquipmentIds(ctx))) {
      ctx.showToast('此設備已加入本案件', 'error');
      ctx.ui.pickerOpen = false;
      ctx.ui.addEquipMenuOpen = false;
      ctx.rerender();
      return false;
    }
    ctx.formData.serviceItems = RepairCaseServiceItems.getItems(ctx.formData)
      .concat([RepairCaseServiceItems.createItem(eq)]);
    // 加入後直接把畫面切到新卡片，否則使用者會以為沒加成功
    ctx.ui.activeItemIndex = ctx.formData.serviceItems.length - 1;
    ctx.ui.pickerOpen = false;
    ctx.ui.addEquipMenuOpen = false;
    ctx.rerender();
    return true;
  }

  function handleRemoveItem(ctx, itemId) {
    ctx.formData.serviceItems = RepairCaseServiceItems.removeItem(ctx.formData, itemId);
    delete ctx.ui.newRecordByItemId[itemId];
    ctx.rerender();
  }

  function handleReasonChange(ctx, itemId, value) {
    ctx.formData.serviceItems = RepairCaseServiceItems.updateItem(ctx.formData, itemId, { actualReason: value });
    ctx.rerender();
  }

  function handleRemarksChange(ctx, itemId, value) {
    ctx.formData.serviceItems = RepairCaseServiceItems.updateItem(ctx.formData, itemId, { remarks: value });
    ctx.rerender();
  }

  function handleAddRecord(ctx, itemId, pm, qty, status) {
    if (!pm) {
      ctx.showToast('請選擇處理方式', 'error');
      return;
    }
    var item = RepairCaseServiceItems.getItems(ctx.formData).filter(function (it) {
      return it.id === itemId;
    })[0];
    ctx.formData.serviceItems = RepairCaseServiceItems.updateItem(ctx.formData, itemId, {
      processRecords: (item.processRecords || []).concat([
        ProcessMethodUtils.toCaseProcessRecord(pm, qty, null, status)
      ])
    });
    ctx.rerender();
  }

  function handleRemoveRecord(ctx, itemId, recordId) {
    var item = RepairCaseServiceItems.getItems(ctx.formData).filter(function (it) {
      return it.id === itemId;
    })[0];
    ctx.formData.serviceItems = RepairCaseServiceItems.updateItem(ctx.formData, itemId, {
      processRecords: (item.processRecords || []).filter(function (r) { return r.id !== recordId; })
    });
    ctx.rerender();
  }

  function handleToggleRecordStatus(ctx, itemId, recordId) {
    var item = RepairCaseServiceItems.getItems(ctx.formData).filter(function (it) {
      return it.id === itemId;
    })[0];
    ctx.formData.serviceItems = RepairCaseServiceItems.updateItem(ctx.formData, itemId, {
      processRecords: (item.processRecords || []).map(function (r) {
        if (r.id !== recordId) return r;
        return Object.assign({}, r, {
          status: ProcessMethodUtils.toggleCaseRecordStatus(ProcessMethodUtils.getCaseRecordStatus(r))
        });
      })
    });
    ctx.rerender();
  }

  function handleSimulateScan(ctx, e) {
    if (e) e.preventDefault();
    var storeEquipments = RepairCaseEquipment.listForCase(ctx.data.equipments, ctx.formData);
    var scanned = RepairCaseEquipment.findEquipmentForScan(
      ctx.data.equipments, ctx.formData, getAddedEquipmentIds(ctx)
    );
    if (scanned) {
      if (!assignEquipment(ctx, scanned)) return;
    } else if (storeEquipments.length || RepairCaseServiceItems.getItems(ctx.formData).length) {
      // 此門市有設備卻掃不到可用的，代表能加的都加了；門市無設備時也只補一次假資料
      ctx.showToast('已無可加入的設備', 'error');
      ctx.ui.addEquipMenuOpen = false;
      ctx.rerender();
      return;
    } else {
      assignEquipment(ctx, {
        id: 'E' + Date.now(),
        customerName: ctx.formData.customerName || '測試客戶',
        storeName: ctx.formData.storeName || '測試門市',
        category: '分離式',
        brand: '日立',
        deviceName: '分離式冷氣',
        name: '分離式冷氣',
        specification: '3.5匹',
        model: 'RAS-100',
        area: '1F 營業廳',
        acceptanceDate: '',
        installer: '',
        assetNumber: '',
        serialNumber: '',
        status: EquipmentUtils.defaultStatus()
      });
    }
    ctx.showToast('成功掃描設備並帶入資料');
  }

  function handleSelectEquipment(ctx, eq) {
    if (assignEquipment(ctx, eq)) ctx.showToast('已帶入設備資料');
  }

  // 卡片增減後 index 可能落在範圍外（例如移除最後一張），統一在此夾回來
  function derive(ctx) {
    var isOther = isOtherWorkCategory(ctx.formData.workCategory);
    var serviceItems = RepairCaseServiceItems.getItems(ctx.formData);
    var hasServiceItems = serviceItems.length > 0;
    var activeIndex = Math.min(Math.max(ctx.ui.activeItemIndex, 0),
      Math.max(serviceItems.length - 1, 0));
    ctx.ui.activeItemIndex = activeIndex;
    return {
      isOther: isOther,
      serviceItems: serviceItems,
      hasServiceItems: hasServiceItems,
      activeIndex: activeIndex,
      activeItem: serviceItems[activeIndex],
      /* 維修結果原則上要先加入設備才可編輯；工項分類為「其他」時不受此限 */
      resultLocked: !hasServiceItems && !isOther
    };
  }

  /* 派工資源欄位（指派人員／使用車輛／協力廠商）。
   * 編輯頁把它們畫在「排程資料」段裡，排程彈窗則畫在頂端的排程主控列（組別旁邊）——
   * 版面位置不同，但控制項必須是同一份實作，否則兩處會各自漂移。opts 只調整外框與
   * 標題的樣式／標籤標籤名，控制項本身兩處完全相同。 */
  function renderDispatchResourceFields(ctx, opts) {
    var o = opts || {};
    var formData = ctx.formData, rerender = ctx.rerender;
    var labelTag = o.labelTag || 'span';
    var labelClassName = o.labelClassName || 'text-gray-500 block mb-1';
    function field(wrapClass, label, control) {
      return h('div', wrapClass ? { className: wrapClass } : null,
        h(labelTag, { className: labelClassName }, label), control);
    }
    return [
      field(o.memberWrapClass || 'col-span-full md:col-span-2', '指派人員',
        renderMemberMultiSelect(formData, function (next) {
          formData.assigneeMemberIds = next;
          rerender();
        }, { id: fieldId(ctx, 'assignee-members') })),
      field(o.vehicleWrapClass || '', '使用車輛',
        renderVehicleSelect(formData, ctx.data.vehicles, function (e) { handleChange(ctx, e); },
          'w-full p-2.5 border rounded-md outline-none')),
      field(o.vendorWrapClass || 'col-span-full md:col-span-2', '協力廠商',
        renderPartnerVendorMultiSelect(formData, ctx.data.vendors, function (next) {
          formData.partnerVendorIds = next;
          rerender();
        }, fieldId(ctx, 'partner-vendors')))
    ];
  }

  function renderScheduleSection(ctx, include) {
    var formData = ctx.formData;
    var rerender = ctx.rerender;
    return h("section", { className: "bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100" },
      h("h3", { className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4" }, sectionTitle(include, 'schedule')),
      h("div", { className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm items-start" },
        h("div", null,
          h("span", { className: "text-gray-500 block mb-1" }, "預計日期"),
          h("input", {
            type: "date",
            name: "expectedDate",
            value: formData.expectedDate,
            onChange: function (e) { handleChange(ctx, e); },
            className: "w-full h-[42px] px-2.5 border rounded-md outline-none"
          })
        ),
        ExpectedTimeRangeFields({
          labelTag: 'span',
          labelClassName: 'text-gray-500 block mb-1',
          startValue: formData.expectedTimeStart,
          endValue: formData.expectedTimeEnd,
          onChange: function (e) { handleChange(ctx, e); }
        }),
        h("div", { className: "col-span-full md:col-span-2" },
          h("span", { className: "text-gray-500 block mb-1" }, "組別"),
          renderAssigneeMultiSelect(formData, function (next) {
            formData.assignees = next;
            formData.assigneeMemberIds = CaseAssigneeFields.syncMemberIds(next, formData.assigneeMemberIds);
            rerender();
          }, { id: fieldId(ctx, 'assignees') })
        ),
        renderDispatchResourceFields(ctx)
      )
    );
  }

  function renderCaseSection(ctx, include) {
    var formData = ctx.formData;
    var isOther = isOtherWorkCategory(formData.workCategory);
    return h("section", { className: "bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100" },
      h("h3", { className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4" }, sectionTitle(include, 'case')),
      h("div", { className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm items-start" },
        CaseReadOnlyField({ label: '案件編號', value: formData.caseNumber }),
        CaseReadOnlyField({ label: '工項分類', value: formData.workCategory }),
        CaseReadOnlyField({ label: '叫修人員', value: formData.reporter }),
        CaseReadOnlyField({ label: '客戶名稱', value: formData.customerName }),
        CaseReadOnlyField({ label: '門市名稱', value: formData.storeName }),
        CaseReadOnlyField({ label: '服務等級', value: formData.serviceLevel }),
        CaseReadOnlyField({ label: '門市地址', value: formData.storeAddress, fullWidth: true }),
        !isOther && CaseReadOnlyField({ label: '叫修項目', value: formData.repairItem }),
        !isOther && CaseReadOnlyField({ label: '叫修原因', value: formData.repairReason }),
        CaseReadOnlyField({
          label: isOther ? '工作描述' : '故障描述',
          value: formData.faultDesc,
          fullWidth: true
        })
      )
    );
  }

  function renderEquipmentSection(ctx, include) {
    var formData = ctx.formData, deviceCategories = ctx.data.deviceCategories, processMethods = ctx.data.processMethods;
    var rerender = ctx.rerender;
    var d = derive(ctx);
    var isOther = d.isOther, serviceItems = d.serviceItems, hasServiceItems = d.hasServiceItems, activeIndex = d.activeIndex, activeItem = d.activeItem;
    return h("section", {
      className: "bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100"
    },
      h("div", { className: "flex flex-wrap justify-between items-center gap-3 border-b pb-2 mb-4" },
        h("h3", { className: "text-lg font-bold text-blue-800" }, sectionTitle(include, 'equipment')),
        h("div", { className: "flex items-center gap-3" },
        h(RepairCaseServiceItemPager, {
          h: h,
          index: activeIndex,
          total: serviceItems.length,
          onPrev: function (next) { ctx.ui.activeItemIndex = next; rerender(); },
          onNext: function (next) { ctx.ui.activeItemIndex = next; rerender(); }
        }),
        h("div", { className: "relative" },
          ctx.ui.addEquipMenuOpen && h("div", {
            className: "fixed inset-0 z-10",
            onClick: function () { ctx.ui.addEquipMenuOpen = false; rerender(); }
          }),
          h("button", {
            type: "button",
            onClick: function (e) {
              e.stopPropagation();
              ctx.ui.addEquipMenuOpen = !ctx.ui.addEquipMenuOpen;
              rerender();
            },
            'aria-label': "加入設備",
            // 手機版寬度不夠，按鈕只留「＋」與下拉箭頭，文字在 sm 以上才出現
            className: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2 sm:px-4 py-2 rounded-md flex items-center gap-1 sm:gap-2 font-medium transition-colors border border-indigo-200 whitespace-nowrap"
          }, Icons.Plus({ className: "h-4 w-4" }),
            h("span", { className: "hidden sm:inline" }, "加入設備"),
            Icons.ChevronDown({ className: "h-4 w-4" })),
          ctx.ui.addEquipMenuOpen && h("div", {
            className: "absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1"
          },
            h("button", {
              type: "button",
              className: "w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50",
              onClick: function () {
                ctx.ui.addEquipMenuOpen = false;
                ctx.ui.pickerOpen = true;
                rerender();
              }
            }, "手動選擇"),
            h("button", {
              type: "button",
              className: "w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2",
              onClick: function () {
                ctx.ui.addEquipMenuOpen = false;
                handleSimulateScan(ctx);
              }
            }, Icons.QrCode({ className: "h-4 w-4" }), " 掃描 QR Code")
          )
        )
        )
      ),
      hasServiceItems
        ? [activeItem].map(function (item) {
            var idx = activeIndex;
            return h(RepairCaseServiceItemCard, {
              key: item.id,
              h: h,
              index: idx,
              item: item,
              caseContext: formData,
              deviceCategories: deviceCategories,
              processMethods: processMethods,
              newRecord: getNewRecord(ctx, item.id),
              isOther: isOther,
              isClosed: formData.isClosed,
              onNewRecordChange: function (sel) { ctx.ui.newRecordByItemId[item.id] = sel; rerender(); },
              onReasonChange: function (v) { handleReasonChange(ctx, item.id, v); },
              onRemarksChange: function (v) { handleRemarksChange(ctx, item.id, v); },
              onAddRecord: function (pm, qty, status) { handleAddRecord(ctx, item.id, pm, qty, status); },
              onToggleRecordStatus: function (rid) { handleToggleRecordStatus(ctx, item.id, rid); },
              onRemoveRecord: function (rid) { handleRemoveRecord(ctx, item.id, rid); },
              onRemoveItem: function () { handleRemoveItem(ctx, item.id); }
            });
          })
        : h("div", {
            className: "text-center py-8 text-gray-400 bg-gray-50 rounded-md border border-dashed"
          }, "請點擊「加入設備」手動選擇或掃描 QR Code")
    );
  }

  function renderResultSection(ctx, include) {
    var formData = ctx.formData;
    var d = derive(ctx);
    var resultLocked = d.resultLocked;
    return h("section", {
      className: "bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100 relative overflow-hidden"
    }, h("h3", {
      className: "text-lg font-bold text-blue-800 border-b pb-2 mb-4"
    }, sectionTitle(include, 'result')), h("div", {
      className: "space-y-6 " + (resultLocked ? 'opacity-30 pointer-events-none' : '')
    }, h("div", {
      className: "grid grid-cols-1 md:grid-cols-2 gap-6"
    }, h("div", null, h("label", {
      className: "block text-sm mb-1"
    }, "處理狀態"), h("select", {
      name: "processStatus",
      value: formData.processStatus || '',
      onChange: function (e) { handleChange(ctx, e); },
      disabled: resultLocked,
      className: "w-full p-2.5 border-2 border-blue-200 rounded-md font-medium text-blue-900 bg-blue-50/30 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
    }, h("option", {
      value: "",
      disabled: true
    }, resultLocked ? "請先加入設備" : "請選擇"), PROCESS_STATUS_OPTIONS.map(function (opt) { return h("option", {
      key: opt,
      value: opt
    }, opt); }))), h("div", null, h("label", {
      className: "block text-sm mb-1"
    }, "客戶簽收"), h("div", {
      className: "flex items-center gap-3"
    }, h("button", {
      type: "button",
      onClick: function () { ctx.ui.signaturePad = { show: true }; ctx.rerender(); },
      disabled: resultLocked,
      className: "px-4 py-2.5 border border-blue-200 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors font-medium disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
    }, formData.customerSignature ? "重新簽收" : "客戶簽收"), formData.customerSignature ? h("img", {
      src: formData.customerSignature,
      alt: "客戶簽名",
      className: "h-[42px] bg-white border border-gray-200 rounded-md"
    }) : h("span", {
      className: "text-gray-400 text-sm"
    }, "尚未簽收")))), h("div", null, h("label", {
      className: "block text-sm mb-1"
    }, "維修備註"), h("textarea", {
      name: "repairRemark",
      value: formData.repairRemark || '',
      onChange: function (e) { handleChange(ctx, e); },
      disabled: resultLocked,
      rows: "3",
      className: "w-full p-2.5 border rounded-md outline-none disabled:bg-gray-100 disabled:cursor-not-allowed",
      placeholder: resultLocked ? "請先加入設備" : "請輸入維修備註..."
    })), h("div", {
      className: "pt-4 border-t border-gray-100"
    }, h("h4", {
      className: "text-sm font-semibold text-gray-800 mb-4"
    }, "時間紀錄"), h("div", {
      className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    }, TimeRecordField({
      label: '叫修時間',
      readOnly: true,
      value: caseDT.format(formData.createdAt || formData.repairDate)
    }), TimeRecordField({
      label: '到店時間',
      name: 'reRepairDate',
      value: formData.reRepairDate,
      onChange: function (e) { handleChange(ctx, e); }
    }), TimeRecordField({
      label: '完成時間',
      name: 'completionDate',
      value: formData.completionDate,
      onChange: function (e) { handleChange(ctx, e); }
    })))));
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
    return [
      ctx.ui.pickerOpen && h(RepairCaseEquipment.PickerModal, {
        h: h,
        items: RepairCaseEquipment.listForCase(ctx.data.equipments, ctx.formData),
        addedIds: getAddedEquipmentIds(ctx),
        onSelect: function (eq) { handleSelectEquipment(ctx, eq); },
        onClose: function () { ctx.ui.pickerOpen = false; ctx.rerender(); }
      }),
      ctx.ui.signaturePad.show && IESS.SignaturePadModal({
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

  window.RepairCaseDetailSections = {
    SECTION_KEYS: SECTION_KEYS,
    createUiState: createUiState,
    renderSections: renderSections,
    renderOverlays: renderOverlays,
    // 「新增案件」表單沿用同一組欄位元件，一併匯出避免兩份實作
    CaseReadOnlyField: CaseReadOnlyField,
    TimeRecordField: TimeRecordField,
    renderVehicleSelect: renderVehicleSelect,
    // 排程彈窗把派工資源欄位畫在頂端的排程主控列，沿用同一份控制項
    renderDispatchResourceFields: renderDispatchResourceFields,
    renderPartnerVendorMultiSelect: renderPartnerVendorMultiSelect,
    isOtherWorkCategory: isOtherWorkCategory
  };

  // src/features/customer/store-repair-form.js 仍在用這個全域匯出
  window.ExpectedTimeRangeFields = ExpectedTimeRangeFields;
})();
