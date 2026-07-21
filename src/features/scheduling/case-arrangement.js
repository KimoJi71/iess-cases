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
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
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

    var weekRange = CalendarBridge.getWeekRange(new Date());
    var calStart = weekRange.start;
    var calEnd = weekRange.end;
    var calAssignee = '全部';
    var appliedCal = { start: calStart, end: calEnd, assignee: '全部' };

    var pendingWorkCategory = '';
    var pendingCustomer = '';
    var pendingDistrict = '';
    var pendingAssignee = '';
    var appliedPending = null;

    var bridge = null;
    var calendarEl = null;
    var pendingListEl = null;
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
      return !!(pendingWorkCategory && pendingCustomer && pendingDistrict && pendingAssignee);
    }

    function validatePendingAssigneeDistrict(assigneeName, districtName) {
      var assignee = assignees.find(function (a) { return a.name === assigneeName; });
      if (!assignee) return false;
      return (assignee.districts || []).indexOf(districtName) !== -1;
    }

    function getPendingAssigneeOptions(districtName) {
      if (!districtName) return [];
      return assignees
        .filter(function (a) {
          if (a.name === '案件待辦' || a.name === '管理員') return false;
          return (a.districts || []).indexOf(districtName) !== -1;
        })
        .map(function (a) { return a.name; });
    }

    function onPendingDistrictChange(districtName, rerender) {
      pendingDistrict = districtName;
      if (pendingAssignee && getPendingAssigneeOptions(districtName).indexOf(pendingAssignee) === -1) {
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

    function refreshCalendar() {
      if (!bridge) return;
      bridge.setEvents(getEvents());
      if (pendingListEl) {
        bridge.initExternalDrag(pendingListEl);
      }
    }

    function addHour(timeStr, hours) {
      var parts = timeStr.split(':');
      var h = parseInt(parts[0], 10) + hours;
      if (h > 23) h = 23;
      return String(h).padStart(2, '0') + ':' + (parts[1] || '00');
    }

    function applyDropSchedule(data, dateStr, timeStr) {
      if (!appliedPending || !appliedPending.assignee) {
        showToast('請先查詢待安排案件並選擇指派人員');
        return;
      }
      var timeStart = timeStr || '09:00';
      var payload = {
        planDate: dateStr,
        planTimeStart: timeStart,
        planTimeEnd: addHour(timeStart, 2),
        assignee: appliedPending.assignee
      };
      patchLocalCaseSchedule(data.sourceType, data.sourceId, payload);
      applyScheduleFromPayload(data.sourceType, data.sourceId, payload);
      showToast('排程已儲存');
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
        onDrop: function (data, dateStr, timeStr) {
          applyDropSchedule(data, dateStr, timeStr);
        },
        onEventChange: handleEventChange
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
      var customerNames = customers.map(function (c) { return c.name; });

      function handleCalSearch() {
        appliedCal = { start: calStart, end: calEnd, assignee: calAssignee };
        if (bridge) {
          bridge.gotoRange(appliedCal.start, appliedCal.end);
          bridge.setEvents(getEvents());
        }
        rerender();
      }

      function handlePendingSearch() {
        if (!isPendingFiltersReady()) {
          showToast('請選擇工項類別、客戶名稱、行政區域與指派人員');
          return;
        }
        if (!validatePendingAssigneeDistrict(pendingAssignee, pendingDistrict)) {
          showToast('此指派人員不負責所選行政區域');
          return;
        }
        appliedPending = {
          workCategory: pendingWorkCategory,
          customer: pendingCustomer,
          district: pendingDistrict,
          assignee: pendingAssignee
        };
        rerender();
      }

      var pendingAssigneeOptions = getPendingAssigneeOptions(pendingDistrict);
      var pendingFiltersReady = isPendingFiltersReady();

      setTimeout(function () { refreshCalendar(); }, 0);

      return h('div', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
        h('div', { className: 'flex flex-wrap items-end gap-3 mb-6' },
            h('div', null,
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '開始日期'),
              h('input', {
                type: 'date', value: calStart,
                onChange: function (e) { calStart = e.target.value; },
                className: 'p-2 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('div', null,
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '結束日期'),
              h('input', {
                type: 'date', value: calEnd,
                onChange: function (e) { calEnd = e.target.value; },
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
                  h('label', { className: 'block text-xs text-gray-500 mb-1' }, '工作項目類別'),
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
                  h('label', { className: 'block text-xs text-gray-500 mb-1' }, '行政區域'),
                  h('select', {
                    value: pendingDistrict,
                    onChange: function (e) { onPendingDistrictChange(e.target.value, rerender); },
                    className: 'w-full p-2 text-sm border rounded-md bg-white'
                  },
                    h('option', { value: '' }, '請選擇'),
                    DISTRICT_OPTIONS.map(function (d) {
                      return h('option', { key: d, value: d }, d);
                    })
                  )
                ),
                h('div', null,
                  h('label', { className: 'block text-xs text-gray-500 mb-1' }, '指派人員'),
                  h('select', {
                    value: pendingAssignee,
                    disabled: !pendingDistrict,
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
            h('div', {
              ref: function (el) { pendingListEl = el; },
              className: 'max-h-[520px] overflow-y-auto'
            },
              !appliedPending
                ? h('p', { className: 'text-sm text-gray-400 text-center py-8' }, '請先選擇篩選條件後查詢')
                : pendingItems.length === 0
                ? h('p', { className: 'text-sm text-gray-400 text-center py-8' }, '無待安排案件')
                : pendingItems.map(function (item) {
                  return h('div', {
                    key: item.sourceType + '-' + item.sourceId,
                    className: 'pending-item p-3 mb-2 bg-gray-50 border border-gray-200 rounded-md cursor-grab active:cursor-grabbing',
                    'data-source-type': item.sourceType,
                    'data-source-id': item.sourceId,
                    'data-customer-name': item.customerName,
                    'data-store-name': item.storeName,
                    'data-work-category': item.workCategory,
                    'data-assignee': appliedPending.assignee
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
        )
      );
    });
  }

  window.CaseArrangement = CaseArrangement;
})();
