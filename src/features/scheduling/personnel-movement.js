/*
 * features/scheduling/personnel-movement.js — 人員動向（唯讀日曆）
 * 可切換「案件」（叫修／保養／立案）與「工作安排」兩種日曆。
 * props: {
 *   maintenanceCases, cases, projectCases, jobSchedules,
 *   vendors, accounts, showToast
 * }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
  var CalendarBridge = IESS.CalendarBridge;

  var MODE_CASE = '案件';
  var MODE_JOB = '工作安排';
  var MODES = [MODE_CASE, MODE_JOB];

  var personnelCalState = null;

  function makeFilterState(today) {
    var week = CalendarBridge.getWeekRange(today);
    return {
      calDate: today,
      calAssignee: '全部',
      appliedCal: { start: week.start, end: week.end, assignee: '全部', date: today }
    };
  }

  // 兩種模式的篩選各自保存，切回來不會被對方覆蓋
  function loadPersonnelCalState() {
    if (!personnelCalState) {
      var today = CalendarBridge.formatDate(new Date());
      personnelCalState = {
        mode: MODE_CASE,
        filters: {}
      };
      personnelCalState.filters[MODE_CASE] = makeFilterState(today);
      personnelCalState.filters[MODE_JOB] = makeFilterState(today);
    }
    return personnelCalState;
  }

  function persistPersonnelCalState(mode, calDate, calAssignee, appliedCal) {
    personnelCalState.mode = mode;
    personnelCalState.filters[mode] = {
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

  function getAccountAssigneeNames(accounts) {
    var seen = {};
    var names = [];
    (accounts || []).forEach(function (a) {
      var name = (a && a.name) || '';
      if (!name || seen[name]) return;
      seen[name] = true;
      names.push(name);
    });
    return names;
  }

  function displayCell(value) {
    return (value == null || value === '') ? '—' : String(value);
  }

  function PersonnelMovement(props) {
    var maintenanceCases = props.maintenanceCases;
    var cases = props.cases;
    var projectCases = props.projectCases;
    var jobSchedules = props.jobSchedules || [];
    var vendors = props.vendors || [];
    var accounts = props.accounts || [];

    var calState = loadPersonnelCalState();
    var mode = calState.mode;
    var current = calState.filters[mode];
    var calDate = current.calDate;
    var calAssignee = current.calAssignee;
    var appliedCal = {
      start: current.appliedCal.start,
      end: current.appliedCal.end,
      assignee: current.appliedCal.assignee,
      date: current.appliedCal.date
    };

    var bridge = null;
    var listPagination = IESS.createListPagination();

    function getEvents() {
      if (mode === MODE_JOB) {
        return ScheduleUtils.getJobScheduleEvents(
          jobSchedules, appliedCal.start, appliedCal.end, appliedCal.assignee
        );
      }
      return ScheduleUtils.getPersonnelEvents(
        maintenanceCases, cases, projectCases,
        appliedCal.start, appliedCal.end, appliedCal.assignee, vendors
      );
    }

    function getFilteredRows() {
      if (mode === MODE_JOB) {
        return ScheduleUtils.getJobScheduleRows(
          jobSchedules, appliedCal.start, appliedCal.end, appliedCal.assignee
        );
      }
      return ScheduleUtils.getPersonnelRows(
        maintenanceCases, cases, projectCases,
        appliedCal.start, appliedCal.end, appliedCal.assignee
      );
    }

    function initCalendar(el) {
      if (!el) return;
      if (bridge) bridge.destroy();
      bridge = CalendarBridge.createBridge(el, {
        rangeStart: appliedCal.start,
        rangeEnd: appliedCal.end,
        focusDate: appliedCal.date,
        initialEvents: getEvents(),
        readOnly: true
      });
    }

    function refreshCalendar() {
      if (!bridge) return;
      bridge.setEvents(getEvents());
    }

    return stateful(function (rerender) {
      var rows = getFilteredRows();
      var pageResult = listPagination.slice(rows);
      var isJobMode = mode === MODE_JOB;

      function switchMode(next) {
        if (next === mode) return;
        mode = next;
        var saved = calState.filters[mode];
        calDate = saved.calDate;
        calAssignee = saved.calAssignee;
        appliedCal = {
          start: saved.appliedCal.start,
          end: saved.appliedCal.end,
          assignee: saved.appliedCal.assignee,
          date: saved.appliedCal.date
        };
        calState.mode = mode;
        listPagination.resetPage();
        rerender();
      }

      function handleSearch() {
        var week = CalendarBridge.getWeekRange(calDate);
        appliedCal = { start: week.start, end: week.end, assignee: calAssignee, date: calDate };
        persistPersonnelCalState(mode, calDate, calAssignee, appliedCal);
        listPagination.resetPage();
        if (bridge) {
          bridge.gotoRange(appliedCal.start, appliedCal.end, appliedCal.date);
          bridge.setEvents(getEvents());
        }
        rerender();
      }

      setTimeout(function () { refreshCalendar(); }, 0);

      function renderAssigneeField() {
        if (isJobMode) {
          return h('div', { className: 'min-w-0' },
            h('label', { className: 'block text-xs text-gray-500 mb-1' }, '指派人員'),
            h('select', {
              value: calAssignee,
              onChange: function (e) { calAssignee = e.target.value; rerender(); },
              className: 'w-full p-2.5 border rounded-md outline-none bg-white sm:w-auto sm:min-w-[120px]'
            },
              h('option', { value: '全部' }, '全部'),
              getAccountAssigneeNames(accounts).map(function (name) {
                return h('option', { key: name, value: name }, name);
              })
            )
          );
        }
        return h('div', { className: 'min-w-0' },
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
        );
      }

      function renderTableHead() {
        var labels = isJobMode
          ? ['日期', '時間', '指派人員', '工作名稱', '備註']
          : ['日期', '時間', '組別', '客戶名稱', '門市名稱', '工項分類', '備註'];
        return h('tr', { className: 'bg-gray-50 text-gray-600 border-b border-gray-200' },
          labels.map(function (label) {
            return h('th', { key: label, className: 'px-4 py-3 font-medium' }, label);
          })
        );
      }

      function renderRow(row) {
        if (isJobMode) {
          return h('tr', {
            key: row.id,
            className: 'border-b border-gray-100 hover:bg-gray-50'
          },
            h('td', { className: 'px-4 py-3 text-gray-800' }, row.date),
            h('td', { className: 'px-4 py-3 text-gray-600' },
              ScheduleUtils.formatScheduleTimeRange(row.timeStart, row.timeEnd)
            ),
            h('td', { className: 'px-4 py-3 text-gray-800' }, displayCell(row.assigneeName)),
            h('td', { className: 'px-4 py-3 text-gray-800' }, displayCell(row.name)),
            h('td', { className: 'px-4 py-3 text-gray-600' }, displayCell(row.remark))
          );
        }
        return h('tr', {
          key: row.id,
          className: 'border-b border-gray-100 hover:bg-gray-50'
        },
          h('td', { className: 'px-4 py-3 text-gray-800' }, row.date),
          h('td', { className: 'px-4 py-3 text-gray-600' },
            ScheduleUtils.formatScheduleTimeRange(row.timeStart, row.timeEnd)
          ),
          h('td', { className: 'px-4 py-3 text-gray-800' }, row.assignee),
          h('td', { className: 'px-4 py-3 text-gray-800' }, row.customerName),
          h('td', { className: 'px-4 py-3 text-gray-600' }, row.storeName),
          h('td', { className: 'px-4 py-3 text-gray-800' }, displayCell(row.workCategory)),
          h('td', { className: 'px-4 py-3 text-gray-600' }, displayCell(row.remark))
        );
      }

      return h('div', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
        // 日曆內容切換：案件（叫修／保養／立案）或工作安排
        h('div', { className: 'flex border-b border-gray-200 mb-4' },
          MODES.map(function (item) {
            var isActive = mode === item;
            return h('button', {
              key: item,
              type: 'button',
              onClick: function () { switchMode(item); },
              className: 'px-4 py-2.5 -mb-px border-b-2 text-sm transition-colors ' +
                (isActive
                  ? 'border-blue-600 text-blue-700 font-bold'
                  : 'border-transparent text-gray-500 hover:text-blue-600')
            }, item);
          })
        ),

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
          renderAssigneeField(),
          h('button', {
            onClick: handleSearch,
            className: 'col-span-2 w-full px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center gap-1.5 min-h-[42px] sm:col-span-1 sm:w-auto'
          }, Icons.Search({ className: 'h-4 w-4' }), '查詢')
        )),

        h('div', {
          className: 'min-h-[480px] border border-gray-200 rounded-lg p-2 bg-white mb-6',
          ref: initCalendar
        }),

        // 手機沿用列表既有慣例：橫向捲動 + 捲動提示，欄位不折行
        h('div', { className: 'overflow-x-auto border rounded-lg table-scroll-hint' },
          h('table', { className: 'w-full text-sm text-left border-collapse whitespace-nowrap' },
            h('thead', null, renderTableHead()),
            h('tbody', null,
              rows.length === 0
                ? h('tr', null,
                  h('td', {
                    colSpan: isJobMode ? 5 : 7,
                    className: 'px-4 py-8 text-center text-gray-400'
                  }, '查無符合條件的排程資料')
                )
                : pageResult.items.map(renderRow)
            )
          )
        ),
        listPagination.renderBar(pageResult, rerender)
      );
    });
  }

  window.PersonnelMovement = PersonnelMovement;
})();
