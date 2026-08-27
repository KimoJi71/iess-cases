/*
 * features/scheduling/case-arrangement.js — 案件安排主頁
 * props: {
 *   maintenanceCases, setMaintenanceCases,
 *   cases, setCases,
 *   projectCases, setProjectCases,
 *   personnelStatus, setPersonnelStatus,
 *   customers, stores, setStores, assignees,
 *   vehicles, vendors, equipments,
 *   showToast
 * }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, TimeInput24 = IESS.TimeInput24;
  var CalendarBridge = IESS.CalendarBridge;

  var arrangementCalState = null;

  function loadArrangementCalState() {
    if (!arrangementCalState) {
      var today = CalendarBridge.formatDate(new Date());
      var week = CalendarBridge.getWeekRange(today);
      arrangementCalState = {
        calDate: today,
        calAssignee: '全部',
        appliedCal: { start: week.start, end: week.end, assignee: '全部', date: today }
      };
    }
    return arrangementCalState;
  }

  function persistArrangementCalState(calDate, calAssignee, appliedCal) {
    arrangementCalState = {
      calDate: calDate,
      calAssignee: calAssignee,
      appliedCal: {
        start: appliedCal.start,
        end: appliedCal.end,
        assignee: appliedCal.assignee,
        date: appliedCal.date
      }
    };
  }

  function CaseArrangement(props) {
    var maintenanceCases = props.maintenanceCases;
    var setMaintenanceCases = props.setMaintenanceCases;
    var cases = props.cases;
    var setCases = props.setCases;
    var projectCases = props.projectCases;
    var setProjectCases = props.setProjectCases;
    var personnelStatus = props.personnelStatus;
    var setPersonnelStatus = props.setPersonnelStatus;
    var customers = props.customers;
    var stores = props.stores;
    // 保養分支的共用區塊要在保養完成時回寫門市的上次保養日期（見 Task 4）
    var setStores = props.setStores;
    var assignees = props.assignees || [];
    // 排程彈窗的維修分支沿用編輯頁區塊，需要與編輯頁相同的參照資料
    var vehicles = props.vehicles || [];
    var vendors = props.vendors || [];
    var equipments = props.equipments || [];
    var processMethods = props.processMethods || [];
    var deviceCategories = props.deviceCategories || [];
    var showToast = props.showToast;

    var calState = loadArrangementCalState();
    var calDate = calState.calDate;
    var calAssignee = calState.calAssignee;
    var appliedCal = {
      start: calState.appliedCal.start,
      end: calState.appliedCal.end,
      assignee: calState.appliedCal.assignee,
      date: calState.appliedCal.date
    };

    var pendingWorkCategory = '';
    var pendingCustomer = '';
    var pendingStoreAreas = [];
    var pendingAssignee = '';
    var appliedPending = null;
    // 手機上「待安排案件」預設收合，日曆才在第一屏；md 以上此旗標不影響版面。
    var pendingPanelOpen = false;

    var bridge = null;
    var calendarEl = null;
    var scheduleModal = null;
    var rerenderRef = function () {};
    var openEditScheduleModalRef = function () {};

    function getEvents() {
      return ScheduleUtils.getScheduledEvents(
        maintenanceCases, cases, projectCases,
        appliedCal.start, appliedCal.end, appliedCal.assignee, vendors
      );
    }

    function getPendingList() {
      if (!appliedPending) return [];
      return ScheduleUtils.getPendingCases(
        maintenanceCases, cases, projectCases, appliedPending, stores, assignees
      );
    }

    function isPendingFiltersReady() {
      return !!(pendingWorkCategory && pendingCustomer && pendingAssignee);
    }

    function isAllStoreAreasSelected() {
      return pendingStoreAreas.length === 0;
    }

    function toggleAllStoreAreas(rerender) {
      pendingStoreAreas = [];
      rerender();
    }

    function toggleStoreArea(area, checked, rerender) {
      if (checked) {
        if (pendingStoreAreas.indexOf(area) === -1) {
          pendingStoreAreas = pendingStoreAreas.concat([area]);
        }
      } else {
        pendingStoreAreas = pendingStoreAreas.filter(function (a) { return a !== area; });
      }
      rerender();
    }

    function getPendingAssigneeOptions() {
      return assignees.map(function (a) { return a.name; });
    }

    function getRepairModalAssignees(record, fallbackAssignee) {
      if (window.CaseAssigneeUtils) {
        var formal = CaseAssigneeUtils.getFormalAssignees(record);
        if (formal.length) return formal.slice();
      } else if (record && record.assignee && record.assignee !== '案件待辦') {
        return [record.assignee];
      }
      return fallbackAssignee ? [fallbackAssignee] : [];
    }

    function formatRepairModalAssignees(list) {
      if (window.CaseAssigneeUtils) {
        return CaseAssigneeUtils.formatAssignees({ assignees: list || [] }) || '';
      }
      return (list || []).join('、');
    }

    function patchLocalCaseRecord(sourceType, sourceId, record) {
      if (sourceType === 'maintenance') {
        maintenanceCases = maintenanceCases.map(function (c) {
          return c.id === sourceId ? Object.assign({}, c, record) : c;
        });
      } else if (sourceType === 'repair') {
        cases = cases.map(function (c) {
          return c.id === sourceId ? Object.assign({}, c, record) : c;
        });
      } else if (sourceType === 'project') {
        projectCases = projectCases.map(function (c) {
          return c.id === sourceId ? Object.assign({}, c, record) : c;
        });
      }
    }

    function buildScheduledRecord(sourceType, formData, payload) {
      var merged = Object.assign({}, formData, {
        planDate: payload.planDate,
        planTimeStart: payload.planTimeStart,
        planTimeEnd: payload.planTimeEnd
      });
      if (sourceType === 'repair') {
        merged.assignees = (payload.assignees && payload.assignees.length)
          ? payload.assignees.slice()
          : (window.CaseAssigneeUtils
              ? CaseAssigneeUtils.getAssignees({ assignee: payload.assignee })
              : (payload.assignee ? [payload.assignee] : []));
        delete merged.assignee;
        merged.expectedDate = payload.planDate;
        merged.expectedTimeStart = payload.planTimeStart;
        merged.expectedTimeEnd = payload.planTimeEnd;
      } else if (sourceType === 'maintenance') {
        // 保養單的組別同樣是多選：排程面板只能挑一組，包成一元素陣列存回去。
        merged.assignees = payload.assignee ? [payload.assignee] : [];
        delete merged.assignee;
      } else {
        merged.assignee = payload.assignee;
      }
      if (sourceType === 'maintenance') {
        // 「已完成」是使用者在彈窗裡手動決定的終態，不因 planDate 而被推算回去；
        // 其餘狀態仍依排程資料校正，與保養明細頁共用 resolveProgressStatus 同一套規則。
        merged.status = MaintenanceDetailSections.resolveProgressStatus(merged);
        if (merged.status === '已完成' && !merged.completionDate) {
          merged.completionDate = IESS.caseDateTime.now();
        }
      } else if (sourceType === 'project') {
        // 與 ScheduleUtils.applyScheduleUpdate 一致：只動點到的那一段階段，
        // 目前階段才連帶更新案件層級的 stageDate／stageAssignee。
        var targetStage = (payload.stageKey && payload.stageKey !== 'current')
          ? payload.stageKey
          : (merged.currentStage || '');
        if (targetStage === (merged.currentStage || '')) {
          merged.stageDate = payload.planDate;
          merged.stageAssignee = payload.assignee;
        } else {
          delete merged.planDate;
          delete merged.planTimeStart;
          delete merged.planTimeEnd;
        }
        merged.history = (merged.history || []).map(function (entry) {
          if (entry.stage !== targetStage) return entry;
          return Object.assign({}, entry, {
            date: payload.planDate,
            timeStart: payload.planTimeStart,
            timeEnd: payload.planTimeEnd,
            assignee: payload.assignee
          });
        });
      }
      return merged;
    }

    /* 這裡是彈窗 formData 與 store 記錄之間的隔離邊界：共用區塊會就地寫入 formData，
     * 故除了複製頂層物件，還要把模組真的會動到的巢狀陣列（serviceItems／equipmentList）
     * 各切一份出來，彈窗的編輯才不會反向改到 store 裡的原始案件。與 maintenance.js 的
     * 作法一致——只保證「整包替換」安全：若之後改成就地改動陣列裡的物件（例如
     * eq.qty = n），仍會寫進原始資料，務必整包 REPLACE。 */
    function buildIsolatedFormData(record) {
      var formData = Object.assign({}, record);
      if (record.serviceItems) formData.serviceItems = record.serviceItems.slice();
      if (record.equipmentList) formData.equipmentList = record.equipmentList.slice();
      return formData;
    }

    /* 彈窗頂端的「組別」是這裡的唯一真相，但共用區塊的「指派人員」選單是依
     * formData.assignees 列出可選成員的，因此組別一異動就同步回 formData，並比照
     * 編輯頁用 syncMemberIds 濾掉已不屬於任何已選組別的成員。 */
    function syncFormDataAssignees(formData, list) {
      if (!formData) return;
      formData.assignees = list.slice();
      formData.assigneeMemberIds = CaseAssigneeFields.syncMemberIds(list, formData.assigneeMemberIds);
    }

    function resolveCaseRecord(sourceType, sourceId) {
      if (sourceType === 'maintenance') {
        return maintenanceCases.find(function (c) { return c.id === sourceId; }) || null;
      }
      if (sourceType === 'repair') {
        return cases.find(function (c) { return c.id === sourceId; }) || null;
      }
      if (sourceType === 'project') {
        return projectCases.find(function (c) { return c.id === sourceId; }) || null;
      }
      return null;
    }

    function refreshCalendar() {
      if (!bridge) return;
      bridge.setEvents(getEvents());
    }

    function applySchedule(sourceType, sourceId, payload, formData) {
      var merged = buildScheduledRecord(sourceType, formData, payload);
      patchLocalCaseRecord(sourceType, sourceId, merged);
      // 保養結案時門市的「上次保養日期」要跟著走，否則此入口與保養明細頁寫出的資料不一致
      if (sourceType === 'maintenance' && merged.status === '已完成') {
        MaintenanceDetailSections.updateStoreLastMaintenanceDate(stores, setStores, merged);
      }
      calDate = payload.planDate;
      var week = CalendarBridge.getWeekRange(payload.planDate);
      appliedCal = {
        start: week.start,
        end: week.end,
        assignee: '全部',
        date: payload.planDate
      };
      persistArrangementCalState(calDate, calAssignee, appliedCal);
      applyScheduleFromPayload(sourceType, sourceId, payload);
      showToast('排程已儲存');
      scheduleModal = null;
      // 排完一筆就把手機的待安排面板收回去，直接看到剛落點的日曆
      pendingPanelOpen = false;
      rerenderRef();
    }

    function initCalendar(el) {
      if (!el) return;
      if (bridge) bridge.destroy();
      calendarEl = el;
      bridge = CalendarBridge.createBridge(el, {
        rangeStart: appliedCal.start,
        rangeEnd: appliedCal.end,
        focusDate: appliedCal.date,
        initialEvents: getEvents(),
        eventStartEditable: false,
        eventDurationEditable: false,
        onEventClick: function (event) {
          var props = event.extendedProps || {};
          if (!props.sourceType || !props.sourceId) return;
          openEditScheduleModalRef(props.sourceType, props.sourceId, props.stageKey);
        }
      });
      refreshCalendar();
    }

    function applyScheduleFromPayload(sourceType, sourceId, payload) {
      var storeSnapshot = {
        maintenanceCases: maintenanceCases,
        cases: cases,
        projectCases: projectCases,
        personnelStatus: personnelStatus
      };
      ScheduleUtils.applyScheduleUpdate(
        sourceType,
        sourceId,
        payload,
        storeSnapshot,
        {
          setMaintenanceCases: setMaintenanceCases,
          setCases: setCases,
          setProjectCases: setProjectCases,
          setPersonnelStatus: setPersonnelStatus
        }
      );
    }

    return stateful(function (rerender) {
      rerenderRef = rerender;
      var pendingItems = getPendingList();
      var customerNames = CustomerUtils.getCustomerNameOptions(customers, pendingCustomer);

      function handleCalSearch() {
        var week = CalendarBridge.getWeekRange(calDate);
        appliedCal = { start: week.start, end: week.end, assignee: calAssignee, date: calDate };
        persistArrangementCalState(calDate, calAssignee, appliedCal);
        if (bridge) {
          bridge.gotoRange(appliedCal.start, appliedCal.end, appliedCal.date);
          bridge.setEvents(getEvents());
        }
        rerender();
      }

      function handlePendingSearch() {
        if (!pendingWorkCategory || !pendingCustomer) {
          showToast('請選擇工項類別與客戶名稱');
          return;
        }
        if (!pendingAssignee) {
          showToast('請選擇組別');
          return;
        }
        appliedPending = {
          workCategory: pendingWorkCategory,
          customer: pendingCustomer,
          storeAreas: pendingStoreAreas.slice(),
          assignee: pendingAssignee
        };
        rerender();
      }

      var pendingAssigneeOptions = getPendingAssigneeOptions();
      var pendingStoreAreaOptions = StoreUtils.getAreaOptionsFromStores(stores);
      var pendingFiltersReady = isPendingFiltersReady();

      // 建立彈窗 formData：走隔離邊界複製一份，再讓「組別」與共用區塊的指派人員對齊。
      // 彈窗沒帶到組別時（例如從日曆點開的保養單）不覆寫，保留案件原本的組別。
      function buildScheduleModalFormData(sourceType, record, repairAssignees, assignee) {
        var formData = buildIsolatedFormData(record);
        var list = sourceType === 'repair'
          ? (repairAssignees || [])
          : (assignee ? [assignee] : []);
        if (list.length) syncFormDataAssignees(formData, list);
        return formData;
      }

      function buildScheduleModalState(sourceType, sourceId, assignee) {
        var record = resolveCaseRecord(sourceType, sourceId);
        if (!record) return null;
        var repairAssignees = sourceType === 'repair'
          ? getRepairModalAssignees(record, assignee)
          : [];
        return {
          mode: 'create',
          item: {
            sourceType: sourceType,
            sourceId: sourceId,
            stageKey: sourceType === 'project' ? 'current' : '',
            stageLabel: sourceType === 'project' ? (record.currentStage || '') : '',
            customerName: record.customerName,
            storeName: record.storeName,
            workCategory: record.workCategory || '保養'
          },
          assignee: sourceType === 'repair'
            ? (repairAssignees[0] || assignee || '')
            : assignee,
          assignees: repairAssignees,
          planDate: record.expectedDate || record.planDate || calDate,
          planTimeStart: record.expectedTimeStart || record.planTimeStart || '',
          planTimeEnd: record.expectedTimeEnd || record.planTimeEnd || '',
          formData: buildScheduleModalFormData(sourceType, record, repairAssignees, assignee),
          // 共用區塊的 UI 暫存狀態（分頁索引／設備挑選器／簽名板）掛在彈窗狀態上，
          // 才撐得過每次輸入造成的整頁重繪
          ui: sourceType === 'repair'
            ? RepairCaseDetailSections.createUiState()
            : sourceType === 'maintenance'
            ? MaintenanceDetailSections.createUiState()
            : null
        };
      }

      function openScheduleModal(item) {
        if (!appliedPending) {
          showToast('請先查詢待安排案件');
          return;
        }
        if (!pendingAssignee) {
          showToast('請選擇組別');
          return;
        }
        var nextModal = buildScheduleModalState(item.sourceType, item.sourceId, pendingAssignee);
        if (!nextModal) {
          showToast('找不到案件資料');
          return;
        }
        scheduleModal = nextModal;
        rerender();
      }

      /* 彈窗頂端的組別是單選字串：維修取多選的第一個，保養取 assignees[] 的第一組，
       * 工程則沿用該階段排程的單值組別。 */
      function resolveModalAssignee(sourceType, sched, repairAssignees) {
        if (sourceType === 'repair') return (repairAssignees && repairAssignees[0]) || '';
        if (sourceType === 'maintenance') return (sched.assignees && sched.assignees[0]) || '';
        return sched.assignee || '';
      }

      function openEditScheduleModal(sourceType, sourceId, stageKey) {
        var record = resolveCaseRecord(sourceType, sourceId);
        if (!record) {
          showToast('找不到案件資料');
          return;
        }
        var sched;
        if (sourceType === 'repair') {
          sched = ScheduleUtils.getRepairSchedule(record);
        } else if (sourceType === 'project') {
          // 工程立案單以「點到的那一段階段排程」為準，而非案件層級欄位
          sched = ScheduleUtils.getProjectStageSchedule(record, stageKey);
        } else {
          // 保養單的組別只存在 assignees[]，讀舊的單值 assignee 會拿到空字串，
          // 彈窗「組別」變空白、儲存還會把原本的組別洗掉。
          sched = ScheduleUtils.getMaintenanceSchedule(record);
        }
        var repairAssignees = sourceType === 'repair'
          ? ((sched.assignees && sched.assignees.length)
              ? sched.assignees.slice()
              : getRepairModalAssignees(record, ''))
          : [];
        scheduleModal = {
          mode: 'edit',
          item: {
            sourceType: sourceType,
            sourceId: sourceId,
            stageKey: sourceType === 'project' ? (sched.stageKey || 'current') : '',
            stageLabel: sourceType === 'project' ? (sched.stage || '') : '',
            customerName: record.customerName,
            storeName: record.storeName,
            workCategory: record.workCategory || '保養'
          },
          // 彈窗的組別是單選：多組的保養單先帶第一組（存回去時同樣只留一組）。
          assignee: resolveModalAssignee(sourceType, sched, repairAssignees),
          assignees: repairAssignees,
          planDate: sched.planDate || calDate,
          planTimeStart: sched.planTimeStart || '',
          planTimeEnd: sched.planTimeEnd || '',
          formData: buildScheduleModalFormData(
            sourceType, record, repairAssignees, resolveModalAssignee(sourceType, sched, repairAssignees)
          ),
          ui: sourceType === 'repair'
            ? RepairCaseDetailSections.createUiState()
            : sourceType === 'maintenance'
            ? MaintenanceDetailSections.createUiState()
            : null
        };
        rerender();
      }

      openEditScheduleModalRef = openEditScheduleModal;

      function updateScheduleModalTime(field, value) {
        if (!scheduleModal) return;
        scheduleModal = Object.assign({}, scheduleModal, (function () {
          var patch = {};
          patch[field] = value;
          return patch;
        })());
        rerender();
      }

      function updateScheduleModalAssignee(value) {
        if (!scheduleModal) return;
        syncFormDataAssignees(scheduleModal.formData, value ? [value] : []);
        scheduleModal = Object.assign({}, scheduleModal, { assignee: value });
        rerender();
      }

      function setScheduleModalAssignees(next) {
        if (!scheduleModal) return;
        var list = (next || []).slice();
        syncFormDataAssignees(scheduleModal.formData, list);
        scheduleModal = Object.assign({}, scheduleModal, {
          assignee: list[0] || '',
          assignees: list
        });
        rerender();
      }

      function confirmScheduleModal() {
        if (!scheduleModal) return;
        var item = scheduleModal.item;
        var isRepair = item.sourceType === 'repair';
        var assignee = scheduleModal.assignee;
        var repairAssignees = isRepair ? (scheduleModal.assignees || []).slice() : [];
        if (isRepair) {
          if (!repairAssignees.length) {
            showToast('請至少選擇 1 個組別');
            return;
          }
        } else if (!assignee) {
          showToast('請選擇組別');
          return;
        }
        if (!scheduleModal.planDate || !scheduleModal.planTimeStart || !scheduleModal.planTimeEnd) {
          showToast('請填寫預計日期與時間區間');
          return;
        }
        if (scheduleModal.planTimeEnd <= scheduleModal.planTimeStart) {
          showToast('結束時間需晚於開始時間');
          return;
        }
        var payload = {
          planDate: scheduleModal.planDate,
          planTimeStart: scheduleModal.planTimeStart,
          planTimeEnd: scheduleModal.planTimeEnd,
          stageKey: item.stageKey || '',
          assignees: isRepair ? repairAssignees : undefined,
          assignee: isRepair
            ? formatRepairModalAssignees(repairAssignees)
            : assignee
        };
        applySchedule(item.sourceType, item.sourceId, payload, scheduleModal.formData);
      }

      function renderScheduleAssigneeEditor() {
        if (!scheduleModal) return null;
        if (scheduleModal.item.sourceType === 'repair') {
          var selected = scheduleModal.assignees || [];
          return h('div', { className: 'sm:col-span-3' },
            h('label', { className: 'block text-xs text-gray-500 mb-1' }, '組別'),
            h('div', { className: 'border border-gray-200 rounded-md bg-white p-3 space-y-2' },
              h('div', { className: 'text-xs text-gray-500' },
                formatRepairModalAssignees(selected) || '請至少選擇 1 個組別'
              ),
              IESS.MultiSelect({
                id: 'schedule-modal-assignees',
                options: AssigneeUtils.getSelectOptions(),
                value: selected,
                onChange: setScheduleModalAssignees,
                placeholder: '請選擇組別'
              })
            )
          );
        }
        return h('div', { className: 'sm:col-span-3' },
          h('label', { className: 'block text-xs text-gray-500 mb-1' }, '組別'),
          h('select', {
            value: scheduleModal.assignee || '',
            onChange: function (e) { updateScheduleModalAssignee(e.target.value); },
            className: 'w-full p-2.5 border rounded-md outline-none bg-white'
          },
            h('option', { value: '' }, '請選擇'),
            ASSIGNEES.map(function (opt) {
              return CaseAssigneeFields.renderGroupOption(opt);
            })
          )
        );
      }

      /* 指派人員／使用車輛／協力廠商與「組別」同屬派工設定，故畫在彈窗頂端的排程主控列，
       * 而不是案件內容區塊——共用區塊的「排程資料」段會連預計日期／時間一起帶進來，
       * 與頂端主控欄位重複控制同一組值。控制項本身仍沿用共用模組的同一份實作。 */
      function renderScheduleResourceFields(detailCtx) {
        if (!detailCtx) return null;
        var opts = {
          labelTag: 'label',
          labelClassName: 'block text-xs text-gray-500 mb-1',
          memberWrapClass: 'sm:col-span-3',
          vendorWrapClass: 'sm:col-span-2'
        };
        if (scheduleModal.item.sourceType === 'repair') {
          return RepairCaseDetailSections.renderDispatchResourceFields(detailCtx, opts);
        }
        if (scheduleModal.item.sourceType === 'maintenance') {
          return MaintenanceDetailSections.renderDispatchResourceFields(detailCtx, opts);
        }
        return null;
      }

      /**
       * 工程立案單在日曆上點開時，直接沿用「編輯工程立案」頁的三段式排版
       * （ProjectDetailView.renderSections），案件內容一律唯讀——工程立案頁才是
       * 編輯入口，這裡只讓使用者調整本次階段的排程時間與負責人員。
       */
      function renderProjectScheduleDetails(formData, item) {
        return h('div', { className: 'space-y-8 bg-gray-50 -m-2 p-4 rounded-lg' },
          h('div', { className: 'flex items-center gap-2' },
            h('span', { className: 'text-sm font-bold text-gray-800' }, '工程立案單'),
            formData.projectNumber
              ? h('span', {
                  className: 'px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100'
                }, formData.projectNumber)
              : null
          ),
          ProjectDetailView.renderSections(formData, {
            deviceCategories: deviceCategories,
            highlightStage: item.stageLabel || formData.currentStage || ''
          })
        );
      }

      // detailCtx 由 renderScheduleModal 建好後傳進來：區塊與浮層必須共用同一個 ctx 物件，
      // 否則浮層改到的是另一份 ui 狀態（與 EditCaseForm 的作法一致）。
      function renderScheduleModalDetails(item, detailCtx) {
        if (!scheduleModal || !scheduleModal.formData) return null;
        var formData = scheduleModal.formData;
        if (item.sourceType === 'repair') {
          return h('div', { className: 'space-y-6' },
            RepairCaseDetailSections.renderSections(detailCtx));
        }
        if (item.sourceType === 'maintenance') {
          return h('div', { className: 'space-y-6' },
            MaintenanceDetailSections.renderSections(detailCtx));
        }
        if (item.sourceType === 'project') return renderProjectScheduleDetails(formData, item);
        return h('div', { className: 'space-y-2 bg-gray-50 border border-gray-200 rounded-md p-4 text-sm text-gray-500' },
          '此案件類型暫不支援詳細編輯'
        );
      }

      // 排程彈窗與編輯頁共用同一份區塊實作；彈窗略過「排程資料」段，
      // 因為頂端已有預計日期／時間／組別的主控欄位。
      function buildDetailCtx(sourceType) {
        if (sourceType === 'repair') {
          return {
            formData: scheduleModal.formData,
            ui: scheduleModal.ui,
            data: {
              equipments: equipments,
              deviceCategories: deviceCategories,
              processMethods: processMethods,
              vehicles: vehicles,
              vendors: vendors,
              stores: stores
            },
            rerender: rerender,
            showToast: showToast,
            include: ['case', 'equipment', 'result'],
            idPrefix: 'schedule-modal'
          };
        }
        if (sourceType === 'maintenance') {
          return {
            formData: scheduleModal.formData,
            ui: scheduleModal.ui,
            data: {
              equipments: equipments,
              vendors: vendors,
              stores: stores,
              customers: customers
            },
            rerender: rerender,
            showToast: showToast,
            include: ['case', 'equipment', 'result'],
            mode: 'edit',
            idPrefix: 'schedule-modal'
          };
        }
        return null;
      }

      function renderScheduleModal() {
        if (!scheduleModal) return null;
        var isEdit = scheduleModal.mode === 'edit';
        var detailCtx = buildDetailCtx(scheduleModal.item.sourceType);
        // 浮層（設備挑選器／簽名板）必須是彈窗的兄弟節點：彈窗中段是 overflow-y-auto，
        // 掛在裡面會被裁掉。
        return [
          h('div', { className: 'app-modal-overlay p-2 sm:p-4' },
            // 頭尾 shrink-0、只讓中段捲動，按鈕才不會被長內容推出畫面
            h('div', { className: 'bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] flex flex-col' },
              h('div', { className: 'flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 shrink-0' },
                h('h3', { className: 'text-lg font-bold text-gray-800' },
                  isEdit ? '編輯排程' : '安排排程'),
                h('button', {
                  type: 'button',
                  onClick: function () { scheduleModal = null; rerender(); },
                  title: '關閉',
                  className: 'text-gray-500 hover:bg-gray-100 p-1.5 rounded-full transition-colors'
                }, Icons.X({ className: 'h-5 w-5' }))
              ),
              h('div', { className: 'flex-1 overflow-y-auto p-4 sm:p-6 space-y-6' },
                h('div', { className: 'grid grid-cols-1 sm:grid-cols-3 gap-4' },
                  h('div', null,
                    h('label', { className: 'block text-xs text-gray-500 mb-1' }, '預計日期'),
                    h('input', {
                      type: 'date',
                      value: scheduleModal.planDate,
                      onChange: function (e) { updateScheduleModalTime('planDate', e.target.value); },
                      className: 'w-full p-2.5 border rounded-md outline-none'
                    })
                  ),
                  h('div', null,
                    h('label', { className: 'block text-xs text-gray-500 mb-1' }, '預計開始時間'),
                    h(TimeInput24, {
                      value: scheduleModal.planTimeStart,
                      onChange: function (e) { updateScheduleModalTime('planTimeStart', e.target.value); },
                      className: 'w-full'
                    })
                  ),
                  h('div', null,
                    h('label', { className: 'block text-xs text-gray-500 mb-1' }, '預計結束時間'),
                    h(TimeInput24, {
                      value: scheduleModal.planTimeEnd,
                      onChange: function (e) { updateScheduleModalTime('planTimeEnd', e.target.value); },
                      className: 'w-full'
                    })
                  ),
                  renderScheduleAssigneeEditor(),
                  renderScheduleResourceFields(detailCtx)
                ),
                h('div', null,
                  h('h4', { className: 'text-sm font-bold text-gray-700 mb-3' }, '案件詳細內容'),
                  renderScheduleModalDetails(scheduleModal.item, detailCtx)
                )
              ),
              h('div', { className: 'p-4 sm:p-6 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-white rounded-b-lg' },
                h('button', {
                  onClick: function () { scheduleModal = null; rerender(); },
                  className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50'
                }, '取消'),
                h('button', {
                  onClick: confirmScheduleModal,
                  className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
                }, '確認')
              )
            )
          ),
          detailCtx && (scheduleModal.item.sourceType === 'repair'
            ? RepairCaseDetailSections.renderOverlays(detailCtx)
            : MaintenanceDetailSections.renderOverlays(detailCtx))
        ];
      }

      setTimeout(function () { refreshCalendar(); }, 0);

      return h('div', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
        h('div', { className: 'bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6' },
        // 手機兩欄網格、查詢鈕獨占一列滿版；sm 以上維持原本的單排 flex
        h('div', { className: 'grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap' },
            h('div', { className: 'min-w-0' },
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '指定日期'),
              h('input', {
                type: 'date', value: calDate,
                onChange: function (e) { calDate = e.target.value; rerender(); },
                className: 'w-full p-2.5 border rounded-md outline-none bg-white sm:w-auto'
              })
            ),
            h('div', { className: 'min-w-0' },
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '組別'),
              h('select', {
                value: calAssignee,
                onChange: function (e) { calAssignee = e.target.value; rerender(); },
                className: 'w-full p-2.5 border rounded-md outline-none bg-white sm:w-auto sm:min-w-[120px]'
              },
                h('option', { value: '全部' }, '全部'),
                SCHEDULE_ASSIGNEE_OPTIONS.map(function (a) {
                  return CaseAssigneeFields.renderGroupOption(a);
                })
              )
            ),
            h('button', {
              onClick: handleCalSearch,
              className: 'col-span-2 w-full px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center gap-1.5 min-h-[42px] sm:col-span-1 sm:w-auto'
            }, Icons.Search({ className: 'h-4 w-4' }), '查詢')
        )),

        h('div', { className: 'flex flex-col xl:flex-row gap-4' },
          h('div', { className: 'w-full xl:w-72 shrink-0' },
            h('div', { className: 'bg-gray-50 p-3 rounded-lg border border-gray-200 mb-3' },
              // 桌機此列只是標題（pointer-events 關掉），手機才是收合／展開的開關
              h('button', {
                type: 'button',
                'data-testid': 'pending-panel-toggle',
                'aria-expanded': pendingPanelOpen ? 'true' : 'false',
                onClick: function () { pendingPanelOpen = !pendingPanelOpen; rerender(); },
                className: 'w-full flex items-center justify-between gap-2 text-left mb-3 md:pointer-events-none'
              },
                h('h3', { className: 'text-sm font-bold text-gray-700' },
                  '待安排案件',
                  appliedPending
                    ? h('span', { className: 'text-gray-500 font-normal ml-1' }, '(' + pendingItems.length + ')')
                    : null
                ),
                Icons.ChevronDown({
                  className: 'h-4 w-4 text-gray-500 shrink-0 transition-transform md:hidden'
                    + (pendingPanelOpen ? ' rotate-180' : '')
                })
              ),
              h('div', { className: (pendingPanelOpen ? '' : 'hidden ') + 'md:block space-y-2' },
                h('div', null,
                  h('label', { className: 'block text-xs text-gray-500 mb-1' }, '工項分類'),
                  h('select', {
                    value: pendingWorkCategory,
                    onChange: function (e) { pendingWorkCategory = e.target.value; rerender(); },
                    className: 'w-full p-2 text-sm border rounded-md bg-white'
                  },
                    h('option', { value: '' }, '請選擇'),
                    SCHEDULE_WORK_CATEGORY_OPTIONS.map(function (w) {
                      return h('option', { key: w, value: w }, w);
                    })
                  )
                ),
                h('div', null,
                  h('label', { className: 'block text-xs text-gray-500 mb-1' }, '客戶名稱'),
                  h('select', {
                    value: pendingCustomer,
                    onChange: function (e) { pendingCustomer = e.target.value; rerender(); },
                    className: 'w-full p-2 text-sm border rounded-md bg-white'
                  },
                    h('option', { value: '' }, '請選擇'),
                    customerNames.map(function (n) {
                      return h('option', { key: n, value: n }, n);
                    })
                  )
                ),
                h('div', null,
                  h('label', { className: 'block text-xs text-gray-500 mb-1' },
                    '組別',
                    h('span', { className: 'text-red-500 ml-0.5' }, '*')
                  ),
                  h('select', {
                    value: pendingAssignee,
                    onChange: function (e) { pendingAssignee = e.target.value; rerender(); },
                    className: 'w-full p-2 text-sm border rounded-md bg-white'
                  },
                    h('option', { value: '' }, '請選擇'),
                    pendingAssigneeOptions.map(function (a) {
                      return CaseAssigneeFields.renderGroupOption(a);
                    })
                  )
                ),
                h('div', null,
                  h('label', { className: 'block text-xs text-gray-500 mb-1' }, '行政區域'),
                  h('div', {
                    className: 'border border-gray-200 rounded-md bg-white p-2 max-h-36 overflow-y-auto space-y-1'
                  },
                    h('label', {
                      className: 'flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5'
                    },
                      h('input', {
                        type: 'checkbox',
                        checked: isAllStoreAreasSelected(),
                        onChange: function () { toggleAllStoreAreas(rerender); },
                        className: 'rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                      }),
                      '全部'
                    ),
                    pendingStoreAreaOptions.map(function (d) {
                      var checked = pendingStoreAreas.indexOf(d) !== -1;
                      return h('label', {
                        key: d,
                        className: 'flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5'
                      },
                        h('input', {
                          type: 'checkbox',
                          checked: checked,
                          onChange: function (e) { toggleStoreArea(d, e.target.checked, rerender); },
                          className: 'rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                        }),
                        d
                      );
                    })
                  )
                ),
                h('button', {
                  onClick: handlePendingSearch,
                  disabled: !pendingFiltersReady,
                  className: 'w-full py-2 text-white text-sm rounded-md ' + (
                    pendingFiltersReady
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-gray-300 cursor-not-allowed'
                  )
                }, '查詢')
              )
            ),
            h('div', {
              className: (pendingPanelOpen ? '' : 'hidden ')
                + 'md:block max-h-[320px] overflow-y-auto md:max-h-[520px]'
            },
              !appliedPending
                ? h('p', { className: 'text-sm text-gray-400 text-center py-8' }, '請先選擇篩選條件後查詢')
                : pendingItems.length === 0
                ? h('p', { className: 'text-sm text-gray-400 text-center py-8' }, '無待安排案件')
                : pendingItems.map(function (item) {
                  return h('div', {
                    key: item.sourceType + '-' + item.sourceId,
                    onClick: function () { openScheduleModal(item); },
                    className: 'p-3 mb-2 bg-gray-50 border border-gray-200 rounded-md cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors'
                  },
                    h('div', { className: 'font-medium text-sm text-gray-800' }, item.customerName),
                    h('div', { className: 'text-sm text-gray-600' }, item.storeName),
                    h('div', { className: 'text-xs text-gray-400 mt-1' }, item.workCategory)
                  );
                })
            )
          ),

          h('div', {
            className: 'flex-1 min-h-[480px] md:min-h-[520px] border border-gray-200 rounded-lg p-2 bg-white',
            ref: initCalendar
          })
        ),
        renderScheduleModal()
      );
    });
  }

  window.CaseArrangement = CaseArrangement;
})();
