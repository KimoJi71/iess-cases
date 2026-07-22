/*
 * features/scheduling/personnel-movement.js — 人員動向（唯讀日曆）
 * props: {
 *   maintenanceCases, cases, projectCases,
 *   showToast
 * }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
  var CalendarBridge = IESS.CalendarBridge;

  function PersonnelMovement(props) {
    var maintenanceCases = props.maintenanceCases;
    var cases = props.cases;
    var projectCases = props.projectCases;

    var calDate = CalendarBridge.formatDate(new Date());
    var calAssignee = '全部';
    var appliedCal = { start: calDate, end: calDate, assignee: '全部' };

    var bridge = null;

    function getEvents() {
      return ScheduleUtils.getPersonnelEvents(
        maintenanceCases, cases, projectCases,
        appliedCal.start, appliedCal.end, appliedCal.assignee
      );
    }

    function getFilteredRows() {
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

      function handleSearch() {
        appliedCal = { start: calDate, end: calDate, assignee: calAssignee };
        if (bridge) {
          bridge.gotoRange(appliedCal.start, appliedCal.end);
          bridge.setEvents(getEvents());
        }
        rerender();
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
              SCHEDULE_ASSIGNEE_OPTIONS.filter(function (a) { return a !== '案件待辦'; }).map(function (a) {
                return h('option', { key: a, value: a }, a);
              })
            )
          ),
          h('button', {
            onClick: handleSearch,
            className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1'
          }, Icons.Search({ className: 'h-4 w-4' }), '查詢')
        ),

        h('div', {
          className: 'min-h-[480px] border border-gray-200 rounded-lg p-2 bg-white mb-6',
          ref: initCalendar
        }),

        h('div', { className: 'overflow-x-auto' },
          h('table', { className: 'w-full text-sm text-left border-collapse' },
            h('thead', null,
              h('tr', { className: 'bg-gray-50 text-gray-600 border-b border-gray-200' },
                h('th', { className: 'px-4 py-3 font-medium' }, '日期'),
                h('th', { className: 'px-4 py-3 font-medium' }, '時間'),
                h('th', { className: 'px-4 py-3 font-medium' }, '指派人員'),
                h('th', { className: 'px-4 py-3 font-medium' }, '客戶名稱'),
                h('th', { className: 'px-4 py-3 font-medium' }, '門市名稱'),
                h('th', { className: 'px-4 py-3 font-medium' }, '工項分類')
              )
            ),
            h('tbody', null,
              rows.length === 0
                ? h('tr', null,
                  h('td', {
                    colSpan: 6,
                    className: 'px-4 py-8 text-center text-gray-400'
                  }, '查無符合條件的排程資料')
                )
                : rows.map(function (row) {
                  return h('tr', {
                    key: row.id,
                    className: 'border-b border-gray-100 hover:bg-gray-50'
                  },
                    h('td', { className: 'px-4 py-3 text-gray-800' }, row.date),
                    h('td', { className: 'px-4 py-3 text-gray-600' },
                      ScheduleUtils.formatTimeRange(row.timeStart, row.timeEnd)
                    ),
                    h('td', { className: 'px-4 py-3 text-gray-800' }, row.assignee),
                    h('td', { className: 'px-4 py-3 text-gray-800' }, row.customerName),
                    h('td', { className: 'px-4 py-3 text-gray-600' }, row.storeName),
                    h('td', { className: 'px-4 py-3' },
                      h('span', {
                        className: 'inline-block px-2 py-0.5 rounded text-xs font-medium',
                        style: {
                          backgroundColor: (ScheduleUtils.CATEGORY_COLORS[row.workCategory] || '#64748b') + '20',
                          color: ScheduleUtils.CATEGORY_COLORS[row.workCategory] || '#64748b'
                        }
                      }, row.workCategory)
                    )
                  );
                })
            )
          )
        )
      );
    });
  }

  window.PersonnelMovement = PersonnelMovement;
})();
