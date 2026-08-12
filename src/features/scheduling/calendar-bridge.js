/*
 * features/scheduling/calendar-bridge.js — FullCalendar 命令式封裝
 */
(function () {
  'use strict';

  var DEFAULT_CALENDAR_HEIGHT = 700;
  var DEFAULT_DAY_MAX_EVENTS = 2;

  function pad(n) { return String(n).padStart(2, '0'); }

  function formatDate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function formatTime(d) {
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function getWeekRange(date) {
    var d = new Date(date);
    var day = d.getDay();
    var diffToMon = day === 0 ? -6 : 1 - day;
    var mon = new Date(d);
    mon.setDate(d.getDate() + diffToMon);
    var sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { start: formatDate(mon), end: formatDate(sun) };
  }

  function createBridge(containerEl, options) {
    var calendar = null;
    var draggableInstances = [];

    function destroy() {
      draggableInstances.forEach(function (d) {
        if (d && d.destroy) d.destroy();
      });
      draggableInstances = [];
      if (calendar) {
        calendar.destroy();
        calendar = null;
      }
    }

    function setEvents(events) {
      if (!calendar) return;
      calendar.removeAllEvents();
      (events || []).forEach(function (ev) {
        calendar.addEvent(ev);
      });
    }

    function init() {
      destroy();
      if (!containerEl || typeof FullCalendar === 'undefined') return;

      var endPlusOne = options.rangeEnd
        ? new Date(new Date(options.rangeEnd).getTime() + 86400000).toISOString().split('T')[0]
        : undefined;

      var timeFormat = { hour: '2-digit', minute: '2-digit', hour12: false };
      var startEditable = options.eventStartEditable !== undefined
        ? options.eventStartEditable
        : !options.readOnly;
      var durationEditable = options.eventDurationEditable !== undefined
        ? options.eventDurationEditable
        : !options.readOnly;

      calendar = new FullCalendar.Calendar(containerEl, {
        initialView: 'timeGridWeek',
        // 週檢視以週一起算，與 getWeekRange 的查詢區間對齊
        firstDay: 1,
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' },
        buttonText: { today: '今天', week: '週', day: '日' },
        // 時間軸涵蓋完整 24 小時，預設捲動到 08:00；固定高度才會產生捲軸
        slotMinTime: '00:00:00',
        slotMaxTime: '24:00:00',
        scrollTime: '08:00:00',
        allDaySlot: true,
        allDayText: '整天',
        // 整天列預設會隨事件數無限長高，把下方時間格擠掉並撐破容器；
        // 限制筆數後多的收進「+N」浮層，整天列高度才固定得住
        dayMaxEvents: options.dayMaxEvents || DEFAULT_DAY_MAX_EVENTS,
        moreLinkText: function (n) { return '+' + n + ' 筆'; },
        height: options.height || DEFAULT_CALENDAR_HEIGHT,
        slotLabelFormat: timeFormat,
        eventTimeFormat: timeFormat,
        editable: startEditable || durationEditable,
        eventStartEditable: startEditable,
        eventDurationEditable: durationEditable,
        droppable: !options.readOnly && !!options.onDrop,
        eventContent: function (info) {
          var wrap = document.createElement('div');
          wrap.className = 'fc-schedule-event';
          wrap.textContent = info.event.title || '';
          return { domNodes: [wrap] };
        },
        events: options.initialEvents || [],
        eventClick: function (info) {
          if (!options.onEventClick) return;
          info.jsEvent.preventDefault();
          options.onEventClick(info.event);
        },
        visibleRange: options.rangeStart && options.rangeEnd ? {
          start: options.rangeStart,
          end: endPlusOne
        } : undefined,
        eventDrop: function (info) {
          if (!options.onEventChange) return;
          options.onEventChange(info.event);
        },
        eventResize: function (info) {
          if (!options.onEventChange) return;
          options.onEventChange(info.event);
        },
        drop: function (info) {
          if (!options.onDrop) return;
          var ds = info.draggedEl.dataset;
          var dateStr = formatDate(info.date);
          // 丟進「整天」列時不帶時間，交由後續流程視為整天案件
          var timeStr = info.allDay
            ? ''
            : pad(info.date.getHours()) + ':' + pad(info.date.getMinutes());
          options.onDrop({
            sourceType: ds.sourceType,
            sourceId: ds.sourceId,
            customerName: ds.customerName,
            storeName: ds.storeName,
            workCategory: ds.workCategory,
            assignee: ds.assignee
          }, dateStr, timeStr);
          calendar.getEvents().forEach(function (ev) {
            var p = ev.extendedProps || {};
            if (p.isPreview && p.sourceId === ds.sourceId) {
              ev.remove();
            }
          });
        }
      });
      calendar.render();
      var initialDate = options.focusDate || options.rangeStart;
      if (initialDate) calendar.gotoDate(initialDate);
    }

    function buildPreviewTitle(ds) {
      if (window.ScheduleUtils && ScheduleUtils.formatScheduleEventTitle) {
        return ScheduleUtils.formatScheduleEventTitle(
          ds.workCategory, ds.assignee, ds.customerName, ds.storeName
        );
      }
      return '[' + (ds.workCategory || '其他') + ']\n' + (ds.assignee || '未指派') + '\n' +
        ds.customerName + '\n' + ds.storeName;
    }

    function initExternalDrag(containerEl) {
      draggableInstances.forEach(function (d) {
        if (d && d.destroy) d.destroy();
      });
      draggableInstances = [];
      if (typeof FullCalendar === 'undefined' || !FullCalendar.Draggable || !containerEl) return;

      var draggable = new FullCalendar.Draggable(containerEl, {
        itemSelector: '.pending-item',
        eventData: function (eventEl) {
          var ds = eventEl.dataset;
          var color = window.ScheduleUtils && ScheduleUtils.getAssigneeColor
            ? ScheduleUtils.getAssigneeColor(ds.assignee)
            : undefined;
          return {
            title: buildPreviewTitle(ds),
            duration: '02:00',
            backgroundColor: color,
            borderColor: color,
            extendedProps: {
              isPreview: true,
              sourceType: ds.sourceType,
              sourceId: ds.sourceId,
              customerName: ds.customerName,
              storeName: ds.storeName,
              workCategory: ds.workCategory,
              assignee: ds.assignee || ''
            }
          };
        }
      });
      draggableInstances.push(draggable);
    }

    // focusDate：使用者實際查詢的那一天。日檢視要停在這一天，
    // 週檢視則會顯示包含這一天的整週，兩種檢視切換時焦點才一致。
    function gotoRange(startStr, endStr, focusDate) {
      if (!calendar) return;
      var endPlusOne = new Date(new Date(endStr).getTime() + 86400000).toISOString().split('T')[0];
      calendar.setOption('visibleRange', { start: startStr, end: endPlusOne });
      calendar.gotoDate(focusDate || startStr);
    }

    init();
    return {
      destroy: destroy,
      setEvents: setEvents,
      initExternalDrag: initExternalDrag,
      gotoRange: gotoRange
    };
  }

  window.IESS = window.IESS || {};
  window.IESS.CalendarBridge = {
    createBridge: createBridge,
    getWeekRange: getWeekRange,
    formatDate: formatDate,
    formatTime: formatTime
  };
})();
