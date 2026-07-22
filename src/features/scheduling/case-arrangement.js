/*
 * features/scheduling/case-arrangement.js — 案件安排主頁
 * props: {
 *   maintenanceCases, setMaintenanceCases,
 *   cases, setCases,
 *   projectCases, setProjectCases,
 *   personnelStatus, setPersonnelStatus,
 *   customers, stores, assignees,
 *   showToast
 * }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, TimeInput24 = IESS.TimeInput24;
  var CalendarBridge = IESS.CalendarBridge;

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
    var assignees = props.assignees || [];
    var showToast = props.showToast;

    var calDate = CalendarBridge.formatDate(new Date());
    var calAssignee = '全部';
    var appliedCal = { start: calDate, end: calDate, assignee: '全部' };

    var pendingWorkCategory = '';
    var pendingCustomer = '';
    var pendingStoreArea = '';
    var pendingAssignee = '';
    var appliedPending = null;

    var bridge = null;
    var calendarEl = null;
    var scheduleModal = null;
    var maintenanceEventModal = null;
    var rerenderRef = function () {};

    function getEvents() {
      return ScheduleUtils.getScheduledEvents(
        maintenanceCases, cases, projectCases,
        appliedCal.start, appliedCal.end, appliedCal.assignee
      );
    }

    function getPendingList() {
      if (!appliedPending) return [];
      return ScheduleUtils.getPendingCases(
        maintenanceCases, cases, projectCases, appliedPending, stores
      );
    }

    function isPendingFiltersReady() {
      return !!(pendingWorkCategory && pendingCustomer && pendingStoreArea && pendingAssignee);
    }

    function validatePendingAssigneeArea(assigneeName, storeArea) {
      var assignee = assignees.find(function (a) { return a.name === assigneeName; });
      return StoreUtils.assigneeCoversArea(assignee, storeArea);
    }

    function getPendingAssigneeOptions(storeArea) {
      if (!storeArea) return [];
      return assignees
        .filter(function (a) {
          if (a.name === '案件待辦' || a.name === '管理員') return false;
          return StoreUtils.assigneeCoversArea(a, storeArea);
        })
        .map(function (a) { return a.name; });
    }

    function onPendingStoreAreaChange(storeArea, rerender) {
      pendingStoreArea = storeArea;
      if (pendingAssignee && getPendingAssigneeOptions(storeArea).indexOf(pendingAssignee) === -1) {
        pendingAssignee = '';
      }
      rerender();
    }

    function resolveAssigneeForEvent(props, sourceType, sourceId) {
      if (props.assignee) return props.assignee;
      if (appliedPending && appliedPending.assignee) return appliedPending.assignee;
      if (sourceType === 'maintenance') {
        var mc = maintenanceCases.find(function (c) { return c.id === sourceId; });
        return mc ? (mc.assignee || '') : '';
      }
      if (sourceType === 'repair') {
        var rc = cases.find(function (c) { return c.id === sourceId; });
        return rc ? (rc.assignee || '') : '';
      }
      if (sourceType === 'project') {
        var pc = projectCases.find(function (c) { return c.id === sourceId; });
        return pc ? (pc.stageAssignee || '') : '';
      }
      return '';
    }

    function patchLocalCaseSchedule(sourceType, sourceId, payload) {
      if (sourceType === 'maintenance') {
        maintenanceCases = maintenanceCases.map(function (c) {
          if (c.id !== sourceId) return c;
          return Object.assign({}, c, {
            planDate: payload.planDate,
            planTimeStart: payload.planTimeStart,
            planTimeEnd: payload.planTimeEnd,
            assignee: payload.assignee,
            status: ScheduleUtils.resolveMaintenanceStatus(c.status, payload.planDate)
          });
        });
      } else if (sourceType === 'repair') {
        cases = cases.map(function (c) {
          if (c.id !== sourceId) return c;
          return Object.assign({}, c, {
            planDate: payload.planDate,
            planTimeStart: payload.planTimeStart,
            planTimeEnd: payload.planTimeEnd,
            expectedDate: payload.planDate,
            expectedTimeStart: payload.planTimeStart,
            expectedTimeEnd: payload.planTimeEnd,
            assignee: payload.assignee
          });
        });
      } else if (sourceType === 'project') {
        projectCases = projectCases.map(function (c) {
          if (c.id !== sourceId) return c;
          var history = (c.history || []).map(function (h) {
            if (h.stage !== c.currentStage) return h;
            return Object.assign({}, h, {
              date: payload.planDate,
              timeStart: payload.planTimeStart,
              timeEnd: payload.planTimeEnd,
              assignee: payload.assignee
            });
          });
          return Object.assign({}, c, {
            planDate: payload.planDate,
            planTimeStart: payload.planTimeStart,
            planTimeEnd: payload.planTimeEnd,
            stageDate: payload.planDate,
            stageAssignee: payload.assignee,
            history: history
          });
        });
      }
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

    function getRecordAddress(record) {
      if (!record) return '';
      var store = ScheduleUtils.resolveStore(stores, record.customerName, record.storeName);
      return (store && StoreUtils.buildFullAddress(store)) || record.storeAddress || '';
    }

    function refreshCalendar() {
      if (!bridge) return;
      bridge.setEvents(getEvents());
    }

    function applySchedule(sourceType, sourceId, payload) {
      patchLocalCaseSchedule(sourceType, sourceId, payload);
      applyScheduleFromPayload(sourceType, sourceId, payload);
      showToast('排程已儲存');
      scheduleModal = null;
      rerenderRef();
      setTimeout(function () { refreshCalendar(); }, 0);
    }

    function handleMaintenanceComplete(sourceId) {
      var target = maintenanceCases.find(function (c) { return c.id === sourceId; });
      if (!target) return;
      if (target.status === '已完成') {
        showToast('此保養案件已完成');
        return;
      }
      maintenanceCases = maintenanceCases.map(function (c) {
        if (c.id !== sourceId) return c;
        return Object.assign({}, c, {
          status: '已完成',
          completionDate: IESS.caseDateTime.now()
        });
      });
      setMaintenanceCases(maintenanceCases);
      maintenanceEventModal = null;
      showToast('保養已完成，可至保養計劃進度進行結案');
      rerenderRef();
      setTimeout(function () { refreshCalendar(); }, 0);
    }

    function initCalendar(el) {
      if (!el) return;
      if (bridge) bridge.destroy();
      calendarEl = el;
      bridge = CalendarBridge.createBridge(el, {
        rangeStart: appliedCal.start,
        rangeEnd: appliedCal.end,
        initialEvents: getEvents(),
        onEventChange: handleEventChange,
        onEventClick: function (event) {
          var props = event.extendedProps || {};
          if (props.isPreview || props.sourceType !== 'maintenance' || !props.sourceId) return;
          maintenanceEventModal = { sourceId: props.sourceId };
          rerenderRef();
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

    function handleEventChange(event) {
      var props = event.extendedProps || {};
      if (props.isPreview) return;
      var sourceType = props.sourceType;
      var sourceId = props.sourceId;
      var assignee = resolveAssigneeForEvent(props, sourceType, sourceId);
      if (!sourceType || !sourceId || !event.start || !assignee) return;

      var end = event.end || event.start;
      var payload = {
        planDate: CalendarBridge.formatDate(event.start),
        planTimeStart: CalendarBridge.formatTime(event.start),
        planTimeEnd: CalendarBridge.formatTime(end),
        assignee: assignee
      };
      patchLocalCaseSchedule(sourceType, sourceId, payload);
      applyScheduleFromPayload(sourceType, sourceId, payload);
      showToast('排程時間已更新');
    }

    return stateful(function (rerender) {
      rerenderRef = rerender;
      var pendingItems = getPendingList();
      var customerNames = CustomerUtils.getCustomerNameOptions(customers, pendingCustomer);

      function handleCalSearch() {
        appliedCal = { start: calDate, end: calDate, assignee: calAssignee };
        if (bridge) {
          bridge.gotoRange(appliedCal.start, appliedCal.end);
          bridge.setEvents(getEvents());
        }
        rerender();
      }

      function handlePendingSearch() {
        if (!isPendingFiltersReady()) {
          showToast('請選擇工項類別、客戶名稱、公司區域與指派人員');
          return;
        }
        if (!validatePendingAssigneeArea(pendingAssignee, pendingStoreArea)) {
          showToast('此指派人員不負責所選公司區域');
          return;
        }
        appliedPending = {
          workCategory: pendingWorkCategory,
          customer: pendingCustomer,
          storeArea: pendingStoreArea,
          assignee: pendingAssignee
        };
        rerender();
      }

      var pendingAssigneeOptions = getPendingAssigneeOptions(pendingStoreArea);
      var pendingStoreAreaOptions = StoreUtils.getAreaOptionsFromStores(stores);
      var pendingFiltersReady = isPendingFiltersReady();

      function openScheduleModal(item) {
        if (!appliedPending || !appliedPending.assignee) {
          showToast('請先查詢待安排案件並選擇指派人員');
          return;
        }
        scheduleModal = {
          item: item,
          planDate: appliedCal.start || calDate,
          planTimeStart: '09:00',
          planTimeEnd: '11:00'
        };
        rerender();
      }

      function confirmScheduleModal() {
        if (!scheduleModal || !appliedPending || !appliedPending.assignee) return;
        if (!scheduleModal.planDate || !scheduleModal.planTimeStart || !scheduleModal.planTimeEnd) {
          showToast('請填寫日期與時間區間');
          return;
        }
        if (scheduleModal.planTimeEnd <= scheduleModal.planTimeStart) {
          showToast('結束時間需晚於開始時間');
          return;
        }
        var item = scheduleModal.item;
        applySchedule(item.sourceType, item.sourceId, {
          planDate: scheduleModal.planDate,
          planTimeStart: scheduleModal.planTimeStart,
          planTimeEnd: scheduleModal.planTimeEnd,
          assignee: appliedPending.assignee
        });
      }

      function renderDetailRow(label, value) {
        return h('div', { className: 'text-sm' },
          h('span', { className: 'text-gray-500' }, label + '：'),
          h('span', { className: 'text-gray-800' }, value || '—')
        );
      }

      function renderScheduleModalDetails(item) {
        var record = resolveCaseRecord(item.sourceType, item.sourceId);
        var address = getRecordAddress(record || item);
        var rows = [
          renderDetailRow('工項分類', item.workCategory),
          renderDetailRow('客戶名稱', item.customerName),
          renderDetailRow('門市名稱', item.storeName),
          renderDetailRow('門市地址', address),
          renderDetailRow('指派人員', appliedPending && appliedPending.assignee)
        ];
        if (item.sourceType === 'repair' && record) {
          rows.push(
            renderDetailRow('叫修項目', record.repairItem),
            renderDetailRow('叫修原因', record.repairReason),
            renderDetailRow('故障描述', record.faultDesc)
          );
        }
        if (item.sourceType === 'maintenance' && record) {
          rows.push(
            renderDetailRow('服務等級', record.serviceLevel),
            renderDetailRow('保養月份', record.dueMonth || (record.planDate && record.planDate.slice(0, 7)))
          );
        }
        if (item.sourceType === 'project' && record) {
          rows.push(
            renderDetailRow('目前階段', record.currentStage),
            renderDetailRow('負責人員', record.stageAssignee)
          );
        }
        return h('div', { className: 'space-y-2 bg-gray-50 border border-gray-200 rounded-md p-4' }, rows);
      }

      function renderScheduleModal() {
        if (!scheduleModal) return null;
        return h('div', { className: 'app-modal-overlay p-4' },
          h('div', { className: 'bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto' },
            h('div', { className: 'p-6 border-b border-gray-100' },
              h('h3', { className: 'text-lg font-bold text-gray-800' }, '安排排程')
            ),
            h('div', { className: 'p-6 space-y-4' },
              h('div', { className: 'grid grid-cols-1 sm:grid-cols-3 gap-4' },
                h('div', null,
                  h('label', { className: 'block text-xs text-gray-500 mb-1' }, '日期'),
                  h('input', {
                    type: 'date',
                    value: scheduleModal.planDate,
                    onChange: function (e) {
                      scheduleModal = Object.assign({}, scheduleModal, { planDate: e.target.value });
                      rerender();
                    },
                    className: 'w-full p-2 border rounded-md outline-none focus:border-blue-500'
                  })
                ),
                h('div', null,
                  h('label', { className: 'block text-xs text-gray-500 mb-1' }, '開始時間'),
                  h(TimeInput24, {
                    value: scheduleModal.planTimeStart,
                    onChange: function (e) {
                      scheduleModal = Object.assign({}, scheduleModal, { planTimeStart: e.target.value });
                      rerender();
                    },
                    className: 'w-full'
                  })
                ),
                h('div', null,
                  h('label', { className: 'block text-xs text-gray-500 mb-1' }, '結束時間'),
                  h(TimeInput24, {
                    value: scheduleModal.planTimeEnd,
                    onChange: function (e) {
                      scheduleModal = Object.assign({}, scheduleModal, { planTimeEnd: e.target.value });
                      rerender();
                    },
                    className: 'w-full'
                  })
                )
              ),
              h('div', null,
                h('h4', { className: 'text-sm font-bold text-gray-700 mb-2' }, '案件詳細內容'),
                renderScheduleModalDetails(scheduleModal.item)
              )
            ),
            h('div', { className: 'p-6 border-t border-gray-100 flex justify-end gap-3' },
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
        );
      }

      function renderMaintenanceEventModal() {
        if (!maintenanceEventModal) return null;
        var record = resolveCaseRecord('maintenance', maintenanceEventModal.sourceId);
        if (!record) return null;
        var address = getRecordAddress(record);
        var isCompleted = record.status === '已完成';
        return h('div', { className: 'app-modal-overlay p-4' },
          h('div', { className: 'bg-white rounded-lg shadow-xl w-full max-w-lg' },
            h('div', { className: 'p-6 border-b border-gray-100' },
              h('h3', { className: 'text-lg font-bold text-gray-800' }, '保養案件')
            ),
            h('div', { className: 'p-6 space-y-4' },
              h('div', { className: 'space-y-2 bg-gray-50 border border-gray-200 rounded-md p-4' },
                renderDetailRow('客戶名稱', record.customerName),
                renderDetailRow('門市名稱', record.storeName),
                renderDetailRow('門市地址', address),
                renderDetailRow('服務等級', record.serviceLevel),
                renderDetailRow('保養日期', record.planDate),
                renderDetailRow('保養時間', ScheduleUtils.formatTimeRange(record.planTimeStart, record.planTimeEnd)),
                renderDetailRow('保養人員', record.assignee),
                renderDetailRow('保養狀態', record.status)
              ),
              isCompleted && h('p', { className: 'text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-3' },
                '保養已完成，請至「保養計劃進度」進行結案。')
            ),
            h('div', { className: 'p-6 border-t border-gray-100 flex justify-end gap-3' },
              h('button', {
                onClick: function () { maintenanceEventModal = null; rerender(); },
                className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50'
              }, '關閉'),
              !isCompleted && h('button', {
                onClick: function () { handleMaintenanceComplete(maintenanceEventModal.sourceId); },
                className: 'px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700'
              }, '保養完成')
            )
          )
        );
      }

      setTimeout(function () { refreshCalendar(); }, 0);

      return h('div', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
        h('div', { className: 'flex flex-wrap items-end gap-3 mb-6' },
            h('div', null,
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '指定日期'),
              h('input', {
                type: 'date', value: calDate,
                onChange: function (e) { calDate = e.target.value; },
                className: 'p-2 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('div', null,
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '指派人員'),
              h('select', {
                value: calAssignee,
                onChange: function (e) { calAssignee = e.target.value; },
                className: 'p-2 border rounded-md outline-none focus:border-blue-500 bg-white min-w-[120px]'
              },
                h('option', { value: '全部' }, '全部'),
                SCHEDULE_ASSIGNEE_OPTIONS.map(function (a) {
                  return h('option', { key: a, value: a }, a);
                })
              )
            ),
            h('button', {
              onClick: handleCalSearch,
              className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1'
            }, Icons.Search({ className: 'h-4 w-4' }), '查詢')
        ),

        h('div', { className: 'flex flex-col xl:flex-row gap-4' },
          h('div', { className: 'w-full xl:w-72 shrink-0' },
            h('div', { className: 'bg-gray-50 p-3 rounded-lg border border-gray-200 mb-3' },
              h('h3', { className: 'text-sm font-bold text-gray-700 mb-3' }, '待安排案件'),
              h('div', { className: 'space-y-2' },
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
                  h('label', { className: 'block text-xs text-gray-500 mb-1' }, '公司區域'),
                  h('select', {
                    value: pendingStoreArea,
                    onChange: function (e) { onPendingStoreAreaChange(e.target.value, rerender); },
                    className: 'w-full p-2 text-sm border rounded-md bg-white'
                  },
                    h('option', { value: '' }, '請選擇'),
                    pendingStoreAreaOptions.map(function (d) {
                      return h('option', { key: d, value: d }, d);
                    })
                  )
                ),
                h('div', null,
                  h('label', { className: 'block text-xs text-gray-500 mb-1' }, '指派人員'),
                  h('select', {
                    value: pendingAssignee,
                    disabled: !pendingStoreArea,
                    onChange: function (e) { pendingAssignee = e.target.value; rerender(); },
                    className: 'w-full p-2 text-sm border rounded-md bg-white disabled:bg-gray-100'
                  },
                    h('option', { value: '' }, '請選擇'),
                    pendingAssigneeOptions.map(function (a) {
                      return h('option', { key: a, value: a }, a);
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
            h('div', { className: 'max-h-[520px] overflow-y-auto' },
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
            className: 'flex-1 min-h-[520px] border border-gray-200 rounded-lg p-2 bg-white',
            ref: initCalendar
          })
        ),
        renderScheduleModal(),
        renderMaintenanceEventModal()
      );
    });
  }

  window.CaseArrangement = CaseArrangement;
})();
